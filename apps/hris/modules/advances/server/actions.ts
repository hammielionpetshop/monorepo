import { and, eq, inArray } from 'drizzle-orm';
import { advanceHandovers, advanceInstallments, advances } from '@petshop/hris-db/schema/advances';
import { paymentSources } from '@petshop/hris-db/schema/payroll';
import { db } from '@/lib/db';
import { can, hasAction, listEmployeesWithAnyAction, recordAudit, type Actor, type ChangeAnnounce, type ServiceResult, type Tx } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { todayWib } from '@/modules/employees';
import { filesUploadedBy } from '@/modules/files';
import { notify } from '@/modules/notifications';
import { checkReason } from '@/modules/settings';
import { handoverDateProblem, periodLabel, placeSchedule, rupiah } from '../rules/advance';
import { closedPeriodsOf, lastPeriodOf, loadAdvances, lockAdvances, openFollowup, personOf, type AdvanceView } from './data';

// Serah uang, batalkan, batal serah (spec L5 §3.5–3.6; DRV-63, 72, 126 s.d. 129).

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string };
const fail = (status: Fail['status'], error: string): Fail => ({ ok: false, status, error });

const wibDate = (d: Date) => new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

async function accountOf(employeeId: number) {
  return (await activeHrisAccounts([employeeId])).get(employeeId) ?? null;
}

async function accountsWith(actions: string[], skipEmployeeId: number | null = null) {
  const ids = (await listEmployeesWithAnyAction(actions)).filter((id) => id !== skipEmployeeId);
  return [...(await activeHrisAccounts(ids)).values()];
}

/** Ganti versi jadwal (DRV-132): cicilan Terjadwal versi berlaku → Diganti; versi baru dengan periode (atau kosong). */
async function rewriteSchedule(tx: Tx, view: AdvanceView, periods: (string | null)[], cause: 'HANDOVER' | 'HANDOVER_UNDO') {
  const open = view.installments.filter((i) => i.status === 'SCHEDULED');
  if (!open.length) return [];
  const version = view.installments.reduce((max, i) => Math.max(max, i.version), 0) + 1;
  await tx.update(advanceInstallments).set({ status: 'REPLACED' }).where(inArray(advanceInstallments.id, open.map((i) => i.id)));
  const rows = open.map((i, index) => ({
    advanceId: view.row.id, version, sequence: i.sequence, total: i.total, amount: i.amount, periodStart: periods[index] ?? null, cause,
  }));
  await tx.insert(advanceInstallments).values(rows);
  return rows;
}

type HandOverInput = { sourceId: unknown; moneyDate: unknown; dateReason?: unknown; viaEmployeeId?: unknown; proofFileId?: unknown };

/** Serahkan uang (DRV-63, 126, 127): satu langkah utuh; nominal = nominal akhir; lalu pasang jadwal (DRV-132). */
export async function handOver(actor: Actor | null, advanceId: number, input: HandOverInput, announce: ChangeAnnounce, now: Date = new Date())
  : Promise<ServiceResult<{ message: string }>> {
  if (!actor || !hasAction(actor, 'advance.hand_over')) return fail(403, 'Anda tidak berhak menyerahkan uang kasbon.');
  const today = todayWib(now);
  const [source] = await db.select().from(paymentSources).where(eq(paymentSources.id, Number(input.sourceId)));
  if (!source?.active) return fail(400, 'Pilih sumber uang yang aktif.');
  const moneyDate = String(input.moneyDate ?? '');
  const dateReason = String(input.dateReason ?? '').trim() || null;
  const viaEmployeeId = input.viaEmployeeId ? Number(input.viaEmployeeId) : null;
  const proofFileId = String(input.proofFileId ?? '').trim() || null;
  return db.transaction(async (tx) => {
    await lockAdvances(tx);
    const [view] = await loadAdvances({ ids: [advanceId] }, tx);
    if (!view) return fail(404, 'Kasbon tidak ditemukan.');
    const person = await personOf(view.row.employeeId);
    if (!person) return fail(404, 'Karyawan tidak ditemukan.');
    if (!can(actor, 'advance.hand_over', person.target) && !actor.fullAccess) return fail(403, 'Anda tidak berhak menyerahkan uang kasbon orang ini.');
    // Penyerah bukan penerima kasbon itu (K3); Pemilik dan GM tetap boleh, tercatat dan diberitahukan.
    if (view.row.employeeId === actor.personId && !actor.fullAccess) return fail(403, 'Kasbon Anda sendiri diserahkan orang lain.');
    if (view.handover) return fail(409, 'Uang kasbon ini sudah diserahkan. Satu kasbon cair sekali.');
    if (view.stage !== 'APPROVED') return fail(409, 'Hanya kasbon yang disetujui dan belum diberikan yang bisa diserahkan.');
    if (await openFollowup(advanceId, 'CANCEL', tx)) return fail(409, 'Pengaju meminta kasbon ini dibatalkan; tunggu keputusan Pemilik atau GM.');
    const lastDay = person.lastStatus?.kind === 'DEACTIVATE' ? person.lastStatus.effectiveOn : null;
    if (lastDay && moneyDate >= lastDay) return fail(409, 'Orang ini sudah melewati hari terakhir bekerja; uang kasbon tidak diserahkan.');
    const approvedOn = wibDate(view.row.decidedAt ?? now);
    const problem = handoverDateProblem({ moneyDate, today, approvedOn, reason: dateReason });
    if (problem) return fail(400, problem);
    if (viaEmployeeId != null) {
      const via = await personOf(viaEmployeeId);
      if (!via?.activeToday || viaEmployeeId === view.row.employeeId) return fail(400, 'Pilih satu karyawan aktif lain yang dititipi.');
    }
    if (proofFileId && !(await filesUploadedBy(tx, actor.accountId, [proofFileId])).length) return fail(400, 'Foto bukti tidak ditemukan. Unggah ulang.');
    const amount = view.row.finalAmount!;
    const [handover] = await tx.insert(advanceHandovers).values({
      advanceId, amount, moneyDate, sourceId: source.id, method: source.method, handedByAccountId: actor.accountId, viaEmployeeId,
      proofFileId, dateReason, beforeApproval: moneyDate < approvedOn,
    }).returning({ id: advanceHandovers.id });
    const amounts = view.installments.filter((i) => i.status === 'SCHEDULED').map((i) => i.amount);
    const periods = placeSchedule(amounts, moneyDate, await closedPeriodsOf(view.row.employeeId, tx), lastPeriodOf(person));
    await rewriteSchedule(tx, view, periods, 'HANDOVER');
    await recordAudit(tx, {
      actorAccountId: actor.accountId, entity: 'advance', entityId: advanceId, action: 'advance.hand_over',
      after: { handoverId: handover.id, amount, moneyDate, sourceId: source.id, viaEmployeeId, periods }, reason: dateReason ?? undefined,
    });
    const how = source.method === 'TRANSFER' ? 'transfer' : 'tunai';
    const account = await accountOf(view.row.employeeId);
    if (account) {
      await notify(tx, [account], {
        kind: 'advance.handed_over',
        title: `Kasbon ${rupiah(amount)} sudah diberikan tanggal ${moneyDate.split('-').reverse().join('-')} lewat ${how}.`,
        body: `Dipotong ${periods.length} kali mulai gajian ${periodLabel(periods[0])}. Kalau uangnya belum Anda terima, lapor dari Kasbon Saya.`,
        link: '/kasbon', entity: 'advance', entityId: advanceId,
      }, actor.accountId);
    }
    if (view.row.employeeId === actor.personId) {
      await announce(tx, actor.accountId, { what: `menyerahkan uang kasbonnya sendiri ${view.row.number} (${rupiah(amount)})`, link: `/gaji/kasbon/${advanceId}`, entity: 'advance', entityId: advanceId });
    }
    return { ok: true as const, data: { message: `Uang kasbon ${view.row.number} ${rupiah(amount)} untuk ${person.name} tercatat diserahkan. Cicilan pertama di slip ${periodLabel(periods[0])}.` } };
  });
}

/** Batalkan kasbon yang disetujui belum diberikan (DRV-72, 129), di transaksi pemanggil. */
export async function cancelApprovedInTx(tx: Tx, actorAccountId: number, advanceId: number, reason: string, announce: ChangeAnnounce): Promise<{ ok: true } | Fail> {
  const [view] = await loadAdvances({ ids: [advanceId] }, tx);
  if (!view) return fail(404, 'Kasbon tidak ditemukan.');
  if (view.stage !== 'APPROVED') return fail(409, view.handover ? 'Uang kasbon ini sudah diberikan; kasbon tidak dibatalkan. Bila catatan penyerahannya salah, pakai Batal serah uang.' : 'Kasbon ini tidak sedang menunggu diberikan.');
  const done = await tx.update(advances).set({ state: 'CANCELLED', closeReason: reason, closedByAccountId: actorAccountId, closedAt: new Date() })
    .where(and(eq(advances.id, advanceId), eq(advances.state, 'APPROVED'))).returning({ id: advances.id });
  if (!done.length) return fail(409, 'Kasbon ini baru saja diubah orang lain.');
  await tx.update(advanceInstallments).set({ status: 'CANCELLED' }).where(and(eq(advanceInstallments.advanceId, advanceId), eq(advanceInstallments.status, 'SCHEDULED')));
  await recordAudit(tx, { actorAccountId, entity: 'advance', entityId: advanceId, action: 'advance.cancel', before: { state: 'APPROVED' }, after: { state: 'CANCELLED' }, reason });
  const recipients = [...await accountsWith(['advance.hand_over'], view.row.employeeId)];
  const account = await accountOf(view.row.employeeId);
  if (account) recipients.push(account);
  if (view.row.filledByAccountId !== account) recipients.push(view.row.filledByAccountId);
  await notify(tx, recipients, {
    kind: 'advance.cancelled', title: `Kasbon ${view.row.number} ${rupiah(view.row.finalAmount ?? 0)} dibatalkan; uangnya tidak diserahkan.`,
    body: `Alasan: ${reason}`, link: '/kasbon', entity: 'advance', entityId: advanceId,
  }, actorAccountId);
  await announce(tx, actorAccountId, { what: `membatalkan kasbon ${view.row.number}`, link: `/gaji/kasbon/${advanceId}`, entity: 'advance', entityId: advanceId });
  return { ok: true };
}

/** DRV-L30 Batalkan kasbon (Pemilik/GM, boleh tanpa diminta, alasan wajib). */
export async function cancelAdvance(actor: Actor | null, advanceId: number, reasonInput: unknown, announce: ChangeAnnounce): Promise<ServiceResult<{ message: string }>> {
  if (!actor?.fullAccess || !hasAction(actor, 'advance.cancel')) return fail(403, 'Hanya Pemilik atau GM yang membatalkan kasbon.');
  const reason = await checkReason(reasonInput, 'Alasan membatalkan');
  if (!reason.ok) return fail(400, reason.error);
  return db.transaction(async (tx) => {
    const done = await cancelApprovedInTx(tx, actor.accountId, advanceId, reason.reason, announce);
    return done.ok ? { ok: true as const, data: { message: 'Kasbon dibatalkan. Tidak ada uang yang bergerak.' } } : done;
  });
}

/**
 * DRV-L31 Batal serah uang (K6, DRV-128): untuk catatan penyerahan yang salah; Pemilik/GM, alasan wajib, selama belum
 * ada catatan berkurang. Kasbon kembali "Disetujui, belum diberikan"; slip tujuan cicilan dilepas.
 */
export async function cancelHandover(actor: Actor | null, advanceId: number, reasonInput: unknown, announce: ChangeAnnounce): Promise<ServiceResult<{ message: string }>> {
  if (!actor?.fullAccess || !hasAction(actor, 'advance.cancel')) return fail(403, 'Hanya Pemilik atau GM yang membatalkan serah uang.');
  const reason = await checkReason(reasonInput, 'Alasan membatalkan');
  if (!reason.ok) return fail(400, reason.error);
  return db.transaction(async (tx) => {
    await lockAdvances(tx);
    const [view] = await loadAdvances({ ids: [advanceId] }, tx);
    if (!view?.handover) return fail(404, 'Penyerahan uang kasbon ini tidak ditemukan.');
    if (view.movements.some((m) => m.status === 'ACTIVE')) {
      return fail(409, 'Cicilan kasbon ini sudah terpotong, dilunasi, atau dihapus; serah uang tidak bisa dibatalkan lagi.');
    }
    await tx.update(advanceHandovers).set({ status: 'CANCELLED', cancelReason: reason.reason, cancelledByAccountId: actor.accountId, cancelledAt: new Date() })
      .where(eq(advanceHandovers.id, view.handover.id));
    await rewriteSchedule(tx, view, [], 'HANDOVER_UNDO');
    await recordAudit(tx, { actorAccountId: actor.accountId, entity: 'advance', entityId: advanceId, action: 'advance.hand_over_cancel', before: { handoverId: view.handover.id }, after: null, reason: reason.reason });
    const recipients = await accountsWith(['advance.hand_over'], view.row.employeeId);
    const account = await accountOf(view.row.employeeId);
    if (account) recipients.push(account);
    await notify(tx, recipients, {
      kind: 'advance.hand_over_cancelled', title: `Catatan serah uang kasbon ${view.row.number} dibatalkan; kasbon kembali menunggu diberikan.`,
      body: `Alasan: ${reason.reason}`, link: '/kasbon', entity: 'advance', entityId: advanceId,
    }, actor.accountId);
    await announce(tx, actor.accountId, { what: `membatalkan catatan serah uang kasbon ${view.row.number}`, link: `/gaji/kasbon/${advanceId}`, entity: 'advance', entityId: advanceId });
    return { ok: true as const, data: { message: `Serah uang ${view.row.number} dibatalkan. Kasbon kembali menunggu diberikan.` } };
  });
}
