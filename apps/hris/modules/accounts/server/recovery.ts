import { sql } from 'drizzle-orm';
import {
  completeRecoveryWithCode, completeRecoveryWithTicket, createRecoveryCode, findEmployeeAccount, findRecoveryAccount,
  issueRecoveryTicket, purgeRecoveryRecords, recordRecoveryFailure, recoveryGate, type RecoveryGate,
} from '@petshop/auth';
import { getAuthSql } from '@/lib/auth';
import { db } from '@/lib/db';
import { listEmployeesWithAnyAction, loadActor, recordAudit, type Actor, type ServiceResult } from '@/modules/access';
import { checkRecoveryFacts, getEmployeeBasic, todayWib } from '@/modules/employees';
import { notify } from '@/modules/notifications';
import { settingOn } from '@/modules/settings';
import { activeHrisAccounts } from './accounts';

const CONTACT_GM = 'Hubungi GM untuk meminta kode.';

export type RecoveryVerifyResult =
  | { ok: true; ticket: string }
  | { ok: false; status: 400 | 403 | 429; error: string; blockedUntil?: string; useCode?: boolean };

function blocked(gate: Exclude<RecoveryGate, { state: 'OPEN' }>): RecoveryVerifyResult {
  return {
    ok: false, status: 429, useCode: true, blockedUntil: gate.until.toISOString(),
    error: gate.state === 'CLOSED'
      ? `Jalur ini ditutup sementara karena terlalu banyak salah. ${CONTACT_GM}`
      : `Terlalu banyak salah. Tunggu sebentar lalu coba lagi, atau hubungi GM untuk meminta kode.`,
  };
}

/** Akun penerima laporan lupa password (KAR-70 butir 7); kosong → Pemilik/GM (PRI-43 butir 4). */
async function reportRecipients(): Promise<number[]> {
  const positionId = Number(await settingOn('accounts.recovery_contact_position', todayWib()));
  const rows = await db.execute<{ employee_id: number }>(sql`
    select employee_id from hris.current_placements where active and position_id = ${positionId}`);
  const contacts = await activeHrisAccounts(rows.map((row) => Number(row.employee_id)));
  if (contacts.size) return [...contacts.values()];
  return [...(await activeHrisAccounts(await listEmployeesWithAnyAction([]))).values()];
}

/**
 * Pemberitahuan tidak boleh menggagalkan urusan akun yang sudah selesai: transaksinya beda dengan transaksi `auth`
 * (spec L2f-2 §4.3), jadi kegagalannya hanya dicatat di log server.
 */
async function report(recipients: number[], kind: string, title: string, employeeId: number) {
  try {
    await db.transaction((tx) => notify(tx, recipients, {
      kind, title, link: `/karyawan/${employeeId}`, entity: 'employee', entityId: employeeId,
    }, null).then(() => undefined));
  } catch (error) {
    console.error('Pemberitahuan lupa password gagal dikirim', error);
  }
}

/** KAR-L04 langkah 1: cocokkan email, nomor HP, tanggal lahir. Pesan menyebut data yang salah (KAR-70 butir 2). */
export async function verifyRecovery(input: { identifier: string; phone: string; birthDate: string }): Promise<RecoveryVerifyResult> {
  const auth = getAuthSql();
  const gate = await recoveryGate(auth, input.identifier);
  if (gate.state !== 'OPEN') return blocked(gate);

  const miss = async (error: string, employeeId: number | null): Promise<RecoveryVerifyResult> => {
    const recorded = await recordRecoveryFailure(auth, input.identifier);
    if (recorded.gate.state === 'OPEN') return { ok: false, status: 400, error };
    if (recorded.newlyBlocked && employeeId) {
      const person = await getEmployeeBasic(employeeId);
      await report(await reportRecipients(), 'account.recovery_blocked',
        `${person?.name ?? 'Seorang karyawan'} salah mengisi lupa password berkali-kali. Pastikan orangnya sebelum membuat kode.`, employeeId);
    }
    return blocked(recorded.gate);
  };

  const account = await findRecoveryAccount(auth, input.identifier);
  if (!account) return miss('Email atau username tidak terdaftar.', null);
  if (!account.hrisEmployeeId) return { ok: false, status: 403, error: 'Akun ini tidak tertaut ke data karyawan. Minta Pemilik atau GM mereset password Anda.' };
  if (!account.isActive) return { ok: false, status: 403, error: `Akun ini tidak aktif. ${CONTACT_GM}` };

  const facts = await checkRecoveryFacts(account.hrisEmployeeId, input);
  switch (facts) {
    case 'INACTIVE': return { ok: false, status: 403, error: `Akun ini tidak aktif. ${CONTACT_GM}` };
    case 'MISSING': return { ok: false, status: 403, useCode: true, error: `Nomor HP atau tanggal lahir Anda belum tercatat. ${CONTACT_GM}` };
    case 'PHONE': return miss('Nomor HP tidak cocok dengan data karyawan.', account.hrisEmployeeId);
    case 'BIRTH_DATE': return miss('Tanggal lahir tidak cocok dengan data karyawan.', account.hrisEmployeeId);
    case 'OK': break;
  }
  // Baru diperiksa sesudah semua data cocok, supaya tidak memberi tahu orang luar akun mana yang berhak penuh.
  const actor = await loadActor(account.accountId, account.hrisEmployeeId);
  if (actor?.fullAccess) return { ok: false, status: 403, useCode: true, error: 'Akun Pemilik dan GM tidak bisa memakai jalur ini. Minta kode atau reset dari Pemilik/GM lain.' };
  const { ticket } = await issueRecoveryTicket(auth, { accountId: account.accountId, identifier: input.identifier });
  return { ok: true, ticket };
}

async function afterRecovered(accountId: number, how: string) {
  const account = await findEmployeeOfAccount(accountId);
  if (!account) return;
  const person = await getEmployeeBasic(account);
  await report([accountId], 'account.password_recovered', `Password Anda diganti ${how}. Bila bukan Anda, segera hubungi GM.`, account);
  await report((await reportRecipients()).filter((id) => id !== accountId), 'account.password_recovered',
    `Password ${person?.name ?? 'seorang karyawan'} diganti ${how}.`, account);
}

async function findEmployeeOfAccount(accountId: number): Promise<number | null> {
  const rows = await db.execute<{ local_user_id: number }>(sql`
    select local_user_id from auth.account_links where account_id = ${accountId} and app_code = 'hris' and revoked_at is null`);
  return rows[0] ? Number(rows[0].local_user_id) : null;
}

export async function finishRecoveryWithTicket(input: { ticket: string; newPassword: string; deviceLabel: string }) {
  const result = await completeRecoveryWithTicket(getAuthSql(), input);
  if (result.ok) await afterRecovered(result.accountId, 'lewat lupa password');
  return result;
}

export async function finishRecoveryWithCode(input: { identifier: string; code: string; newPassword: string; deviceLabel: string }) {
  const result = await completeRecoveryWithCode(getAuthSql(), input);
  if (result.ok) await afterRecovered(result.accountId, 'memakai kode dari Pemilik/GM');
  return result;
}

/** KAR-L05: kode 6 angka untuk orang ini. Route sudah memeriksa `account.reset_password`; kode tidak masuk jejak. */
export async function createRecoveryCodeFor(actor: Actor, employeeId: number): Promise<ServiceResult<{ code: string; expiresAt: string }>> {
  const person = await getEmployeeBasic(employeeId);
  if (!person) return { ok: false, status: 404, error: 'Karyawan tidak ditemukan.' };
  if (!person.activeToday) return { ok: false, status: 409, error: 'Karyawan nonaktif: akunnya tidak bisa diubah.' };
  const account = await findEmployeeAccount(getAuthSql(), employeeId);
  if (!account) return { ok: false, status: 404, error: 'Karyawan ini tidak punya akun yang tertaut.' };
  const result = await createRecoveryCode(getAuthSql(), { accountId: account.accountId, actorAccountId: actor.accountId });
  if (!result.ok) return { ok: false, status: result.code === 'SELF_FORBIDDEN' ? 403 : 400, error: result.error };
  await db.transaction((tx) => recordAudit(tx, {
    actorAccountId: actor.accountId, entity: 'account', entityId: employeeId, action: 'account_recovery_code',
    after: { accountId: account.accountId, expiresAt: result.expiresAt.toISOString() },
  }));
  return { ok: true, data: { code: result.code, expiresAt: result.expiresAt.toISOString() } };
}

export function purgeRecovery() {
  return purgeRecoveryRecords(getAuthSql());
}
