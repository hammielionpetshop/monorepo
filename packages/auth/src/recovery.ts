import { randomBytes, randomInt } from 'node:crypto';
import * as argon2 from 'argon2';
import type { Sql, TransactionSql } from 'postgres';
import {
  audit, createSession, databaseNow, failure, hashSessionToken, loginEvent, lockAccounts, validToken,
} from './sessions';
import type { AuthResult } from './sessions';

/*
 * Lupa password (KAR-70, AUT-13, spec L2f-2 §4). Pencocokan HP dan tanggal lahir dikerjakan HRIS karena datanya
 * milik karyawan; di sini hanya hitungan salah, tiket, kode, dan penggantian password. Dipanggil pemanggil tepercaya.
 * Angka tetap di kode sampai cutover L1, seperti angka masuk lainnya (L2e §8 butir 5).
 */
const MAX_FAILS = 3;
const LOCK_MS = 5 * 60 * 1000;
const LOCKS_TO_CLOSE = 3;
const CLOSE_MS = 24 * 60 * 60 * 1000;
const TICKET_MS = 10 * 60 * 1000;
const CODE_MS = 60 * 60 * 1000;
const CODE_MAX_FAILS = 5;

const MESSAGES: Record<string, string> = {
  RECOVERY_TICKET_INVALID: 'Waktu mengganti password sudah habis. Ulangi dari awal.',
  RECOVERY_ACCOUNT_DISABLED: 'Akun ini tidak aktif. Hubungi GM.',
  RECOVERY_CODE_INVALID: 'Kode salah. Periksa lagi kode dari GM.',
  RECOVERY_CODE_EXPIRED: 'Kode sudah kedaluwarsa. Minta kode baru ke GM.',
  RECOVERY_CODE_BURNED: 'Kode salah 5 kali dan sudah hangus. Minta kode baru ke GM.',
  RECOVERY_PASSWORD_INVALID: 'Password baru harus berisi 8 sampai 1024 karakter.',
};

function fail(code: string) {
  return { ok: false as const, code, error: MESSAGES[code] ?? failure(code).error };
}

export function normalizeRecoveryIdentifier(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase().slice(0, 255) : '';
}

function validPassword(password: unknown): password is string {
  return typeof password === 'string' && password.length >= 8 && password.length <= 1024;
}

export type RecoveryAccount = { accountId: number; isActive: boolean; hrisEmployeeId: number | null };

/** Akun untuk identifier ini; identifier yang cocok ke dua akun dianggap tidak ada, sama dengan masuk. */
export async function findRecoveryAccount(sql: Sql, identifierInput: unknown): Promise<RecoveryAccount | null> {
  const identifier = normalizeRecoveryIdentifier(identifierInput);
  if (!identifier) return null;
  const rows = await sql`select a.id, a.is_active, l.local_user_id from auth.accounts a
    left join auth.account_links l on l.account_id = a.id and l.app_code = 'hris' and l.revoked_at is null
    where a.username = ${identifier} or a.email = ${identifier}`;
  if (rows.length !== 1) return null;
  return { accountId: rows[0].id, isActive: rows[0].is_active, hrisEmployeeId: rows[0].local_user_id ?? null };
}

export type RecoveryGate = { state: 'OPEN' } | { state: 'LOCKED' | 'CLOSED'; until: Date };

export async function recoveryGate(sql: Sql, identifierInput: unknown): Promise<RecoveryGate> {
  const identifier = normalizeRecoveryIdentifier(identifierInput);
  const [row] = await sql`select locked_until, closed_until, clock_timestamp() as now
    from auth.recovery_throttles where identifier = ${identifier}`;
  if (!row) return { state: 'OPEN' };
  const now = new Date(row.now);
  if (row.closed_until && new Date(row.closed_until) > now) return { state: 'CLOSED', until: new Date(row.closed_until) };
  if (row.locked_until && new Date(row.locked_until) > now) return { state: 'LOCKED', until: new Date(row.locked_until) };
  return { state: 'OPEN' };
}

/** Catat satu kali salah. `newlyBlocked` benar tepat saat jeda atau penutupan baru dimulai. */
export async function recordRecoveryFailure(sql: Sql, identifierInput: unknown): Promise<{ gate: RecoveryGate; newlyBlocked: boolean }> {
  const identifier = normalizeRecoveryIdentifier(identifierInput);
  return await sql.begin(async (tx) => {
    await tx`insert into auth.recovery_throttles (identifier) values (${identifier}) on conflict (identifier) do nothing`;
    const [row] = await tx`select * from auth.recovery_throttles where identifier = ${identifier} for update`;
    const now = await databaseNow(tx);
    if (row.closed_until && new Date(row.closed_until) > now) {
      return { gate: { state: 'CLOSED' as const, until: new Date(row.closed_until) }, newlyBlocked: false };
    }
    if (row.locked_until && new Date(row.locked_until) > now) {
      return { gate: { state: 'LOCKED' as const, until: new Date(row.locked_until) }, newlyBlocked: false };
    }
    const failed = row.failed_count + 1;
    if (failed < MAX_FAILS) {
      await tx`update auth.recovery_throttles set failed_count = ${failed}, updated_at = ${now.toISOString()} where identifier = ${identifier}`;
      return { gate: { state: 'OPEN' as const }, newlyBlocked: false };
    }
    const windowOpen = !!row.first_lock_at && now.getTime() - new Date(row.first_lock_at).getTime() < CLOSE_MS;
    const locks = windowOpen ? row.lock_count + 1 : 1;
    const firstLockAt = windowOpen ? new Date(row.first_lock_at) : now;
    const closing = locks >= LOCKS_TO_CLOSE;
    const until = new Date(now.getTime() + (closing ? CLOSE_MS : LOCK_MS));
    await tx`update auth.recovery_throttles set failed_count = 0,
      locked_until = ${closing ? null : until.toISOString()}, closed_until = ${closing ? until.toISOString() : null},
      lock_count = ${closing ? 0 : locks}, first_lock_at = ${closing ? null : firstLockAt.toISOString()},
      updated_at = ${now.toISOString()} where identifier = ${identifier}`;
    return { gate: { state: closing ? 'CLOSED' as const : 'LOCKED' as const, until }, newlyBlocked: true };
  });
}

/** Ketiga data cocok: buat tiket langkah 2. Tiket lama akun itu tidak berlaku lagi. */
export async function issueRecoveryTicket(sql: Sql, input: { accountId: number; identifier: unknown }): Promise<{ ticket: string }> {
  const identifier = normalizeRecoveryIdentifier(input.identifier);
  const ticket = randomBytes(32).toString('base64url');
  return await sql.begin(async (tx) => {
    const now = await databaseNow(tx);
    await tx`update auth.recovery_tickets set used_at = ${now.toISOString()} where account_id = ${input.accountId} and used_at is null`;
    await tx`insert into auth.recovery_tickets (account_id, token_hash, expires_at)
      values (${input.accountId}, ${hashSessionToken(ticket)}, ${new Date(now.getTime() + TICKET_MS).toISOString()})`;
    await tx`update auth.recovery_throttles set failed_count = 0, updated_at = ${now.toISOString()} where identifier = ${identifier}`;
    return { ticket };
  });
}

type Completed = { accountId: number; token: string };

/** Ganti password, keluarkan semua perangkat (termasuk kasir), lalu buat sesi HRIS baru. Satu transaksi. */
async function finishRecovery(tx: TransactionSql, accountId: number, method: 'SELF' | 'CODE', passwordHash: string, deviceLabel?: string): Promise<AuthResult<Completed>> {
  const [account] = await tx`select a.is_active, l.id as link_id from auth.accounts a
    left join auth.account_links l on l.account_id = a.id and l.app_code = 'hris' and l.revoked_at is null where a.id = ${accountId}`;
  if (!account?.is_active || !account.link_id) return fail('RECOVERY_ACCOUNT_DISABLED');
  const now = await databaseNow(tx);
  await tx`update auth.accounts set password_hash = ${passwordHash}, must_change_password = false, failed_login_count = 0,
    locked_until = null, credentials_changed_at = ${now.toISOString()}, updated_at = ${now.toISOString()} where id = ${accountId}`;
  await tx`update auth.sessions set revoked_at = ${now.toISOString()}, revoked_reason = 'PASSWORD_RECOVERED'
    where account_id = ${accountId} and revoked_at is null`;
  await tx`update auth.recovery_tickets set used_at = ${now.toISOString()} where account_id = ${accountId} and used_at is null`;
  await tx`update auth.recovery_codes set voided_at = ${now.toISOString()} where account_id = ${accountId} and used_at is null and voided_at is null`;
  await audit(tx, accountId, accountId, 'PASSWORD_RECOVERED', { method, allSessionsRevoked: true },
    method === 'SELF' ? 'Password diganti lewat lupa password.' : 'Password diganti memakai kode dari Pemilik/GM.');
  const session = await createSession(tx, accountId, 'PASSWORD', false, { appCode: 'hris', deviceLabel }, now, null);
  if (!session.ok) throw new Error('Tautan akses berubah selama pemulihan password.');
  await loginEvent(tx, accountId, 'hris', 'PASSWORD', 'SUCCESS', deviceLabel);
  return { ok: true, accountId, token: session.token };
}

export async function completeRecoveryWithTicket(sql: Sql, input: {
  ticket: unknown; newPassword: unknown; deviceLabel?: string;
}): Promise<AuthResult<Completed>> {
  if (!validPassword(input.newPassword)) return fail('RECOVERY_PASSWORD_INVALID');
  if (!validToken(input.ticket)) return fail('RECOVERY_TICKET_INVALID');
  const passwordHash = await argon2.hash(input.newPassword);
  const tokenHash = hashSessionToken(input.ticket);
  return await sql.begin(async (tx) => {
    const [peek] = await tx`select account_id from auth.recovery_tickets where token_hash = ${tokenHash}`;
    if (!peek) return fail('RECOVERY_TICKET_INVALID');
    await lockAccounts(tx, [peek.account_id]);
    const [ticket] = await tx`select * from auth.recovery_tickets where token_hash = ${tokenHash} for update`;
    const now = await databaseNow(tx);
    if (ticket.used_at || new Date(ticket.expires_at) <= now) return fail('RECOVERY_TICKET_INVALID');
    const result = await finishRecovery(tx, ticket.account_id, 'SELF', passwordHash, input.deviceLabel);
    if (result.ok) {
      await tx`delete from auth.recovery_throttles where identifier in
        (select username from auth.accounts where id = ${ticket.account_id} and username is not null
         union select email from auth.accounts where id = ${ticket.account_id} and email is not null)`;
    }
    return result;
  });
}

/** Buat kode untuk akun lain; kode lama akun itu batal. Kode polos hanya ada di nilai balik ini, tidak di jejak. */
export async function createRecoveryCode(sql: Sql, input: { accountId: number; actorAccountId: number }): Promise<AuthResult<{ code: string; expiresAt: Date }>> {
  if (input.accountId === input.actorAccountId) return failure('SELF_FORBIDDEN');
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const codeHash = await argon2.hash(code);
  return await sql.begin(async (tx) => {
    await lockAccounts(tx, [input.accountId]);
    const [account] = await tx`select is_active from auth.accounts where id = ${input.accountId}`;
    if (!account) return failure('NOT_FOUND');
    if (!account.is_active) return fail('RECOVERY_ACCOUNT_DISABLED');
    const now = await databaseNow(tx);
    await tx`update auth.recovery_codes set voided_at = ${now.toISOString()} where account_id = ${input.accountId} and used_at is null and voided_at is null`;
    const expiresAt = new Date(now.getTime() + CODE_MS);
    await tx`insert into auth.recovery_codes (account_id, code_hash, created_by_account_id, expires_at)
      values (${input.accountId}, ${codeHash}, ${input.actorAccountId}, ${expiresAt.toISOString()})`;
    await audit(tx, input.accountId, input.actorAccountId, 'RECOVERY_CODE_CREATED', { expiresAt: expiresAt.toISOString() }, 'Kode lupa password dibuat.');
    return { ok: true, code, expiresAt };
  });
}

export async function completeRecoveryWithCode(sql: Sql, input: {
  identifier: unknown; code: unknown; newPassword: unknown; deviceLabel?: string;
}): Promise<AuthResult<Completed>> {
  if (!validPassword(input.newPassword)) return fail('RECOVERY_PASSWORD_INVALID');
  const code = typeof input.code === 'string' ? input.code.trim() : '';
  if (!/^\d{6}$/.test(code)) return fail('RECOVERY_CODE_INVALID');
  const account = await findRecoveryAccount(sql, input.identifier);
  if (!account) return fail('RECOVERY_CODE_INVALID');
  const passwordHash = await argon2.hash(input.newPassword);
  return await sql.begin(async (tx) => {
    await lockAccounts(tx, [account.accountId]);
    const [row] = await tx`select * from auth.recovery_codes where account_id = ${account.accountId}
      and used_at is null and voided_at is null for update`;
    if (!row) return fail('RECOVERY_CODE_INVALID');
    const now = await databaseNow(tx);
    if (new Date(row.expires_at) <= now) return fail('RECOVERY_CODE_EXPIRED');
    let matches = false;
    try { matches = await argon2.verify(row.code_hash, code); } catch { matches = false; }
    if (!matches) {
      const failed = row.failed_count + 1;
      const burned = failed >= CODE_MAX_FAILS;
      await tx`update auth.recovery_codes set failed_count = ${failed}, voided_at = ${burned ? now.toISOString() : null} where id = ${row.id}`;
      return fail(burned ? 'RECOVERY_CODE_BURNED' : 'RECOVERY_CODE_INVALID');
    }
    await tx`update auth.recovery_codes set used_at = ${now.toISOString()} where id = ${row.id}`;
    return await finishRecovery(tx, account.accountId, 'CODE', passwordHash, input.deviceLabel);
  });
}

/** Buang catatan jeda dan tiket yang sudah 30 hari diam. Kode tetap disimpan sebagai jejak. */
export async function purgeRecoveryRecords(sql: Sql): Promise<{ throttles: number; tickets: number }> {
  const throttles = await sql`delete from auth.recovery_throttles where updated_at < now() - interval '30 days'
    and (closed_until is null or closed_until < now()) returning identifier`;
  const tickets = await sql`delete from auth.recovery_tickets where expires_at < now() - interval '30 days' returning id`;
  return { throttles: throttles.length, tickets: tickets.length };
}
