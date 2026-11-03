import { and, eq, inArray } from 'drizzle-orm';
import { advanceFollowups, advanceHandovers, advanceInstallments, advances } from '@petshop/hris-db/schema/advances';
import { requests } from '@petshop/hris-db/schema/requests';
import { db } from '@/lib/db';
import { can, listEmployeesWithAnyAction, recordAudit, type Actor, type ChangeAnnounce, type Tx } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { todayWib } from '@/modules/employees';
import { notify } from '@/modules/notifications';
import type { RequestHandler } from '@/modules/requests';
import { settingOn } from '@/modules/settings';
import { advanceNumber, amountProblem, installmentsProblem, rupiah, splitInstallments } from '../rules/advance';
import { checkAdvance, loadAdvances, lockAdvances, nextNumber, openFollowup, personOf, rulesOn } from './data';
import { cancelApprovedInTx } from './actions';

// Jenis pengajuan kasbon (spec L5 §3.1–3.6): `advance` (periksa → putuskan), `advance_cancel`, `advance_not_received`.

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string };
const fail = (status: Fail['status'], error: string): Fail => ({ ok: false, status, error });

async function advanceOfRequest(executor: typeof db | Tx, requestId: number) {
  const [row] = await executor.select().from(advances).where(eq(advances.requestId, requestId));
  return row ?? null;
}

async function accountsWith(action: Parameters<typeof listEmployeesWithAnyAction>[0], employeeIdToSkip: number | null): Promise<number[]> {
  const ids = (await listEmployeesWithAnyAction(action)).filter((id) => id !== employeeIdToSkip);
  return [...(await activeHrisAccounts(ids)).values()];
}

const nameOf = async (employeeId: number) => (await personOf(employeeId))?.name ?? `#${employeeId}`;
const plan = (amount: number, count: number) => `${rupiah(amount)}, ${count} kali potong${count > 1 ? ` (${splitInstallments(amount, count).map(rupiah).join(' + ')})` : ''}`;

type AdvanceInput = { employeeId?: unknown; amount: unknown; installments: unknown; reason: unknown };

/** Angka usulan Finance / angka akhir (DRV-122, 124, 125): kelipatan, minimum, ≤ diajukan; berubah = catatan wajib. */
async function checkNumbers(row: typeof advances.$inferSelect, fields: Record<string, unknown>): Promise<{ amount: number; installments: number; note: string | null } | Fail> {
  const rules = await rulesOn(todayWib());
  const amount = Number(fields.amount ?? row.requestedAmount);
  const installments = Number(fields.installments ?? row.requestedInstallments);
  const problem = amountProblem(amount, rules) ?? installmentsProblem(installments, rules.maxInstallments);
  if (problem) return fail(400, problem);
  if (amount > row.requestedAmount) return fail(400, `Nominal paling banyak sebesar yang diajukan (${rupiah(row.requestedAmount)}).`);
  const note = String(fields.note ?? '').trim() || null;
  const changed = amount !== row.requestedAmount || installments !== row.requestedInstallments;
  if (changed && (note ?? '').length < rules.reasonMin) return fail(400, `Angka diubah dari pengajuan: tulis catatan paling sedikit ${rules.reasonMin} huruf.`);
  return { amount, installments, note };
}

export function advanceHandler(): RequestHandler {
  return {
    async prepare(tx, actor, input) {
      const fields = input as AdvanceInput;
      const today = todayWib();
      const forOther = fields.employeeId != null && Number(fields.employeeId) !== actor.personId;
      const employeeId = forOther ? Number(fields.employeeId) : actor.personId;
      const person = await personOf(employeeId);
      if (!person) return fail(404, 'Karyawan tidak ditemukan.');
      // Atas nama: HR, Admin HR, Pemilik, GM; bukan untuk dirinya sendiri (DRV-123). Isian nama diabaikan untuk pengajuan sendiri.
      if (forOther && !can(actor, 'advance.fill_for', person.target)) return fail(403, 'Anda tidak berhak mengisikan kasbon atas nama orang lain.');
      const rules = await rulesOn(today);
      const amount = Number(fields.amount);
      const installments = Number(fields.installments);
      const problem = amountProblem(amount, rules) ?? installmentsProblem(installments, rules.maxInstallments);
      if (problem) return fail(400, problem);
      const reason = String(fields.reason ?? '').trim();
      if (reason.length < rules.reasonMin) return fail(400, `Alasan paling sedikit ${rules.reasonMin} huruf.`);
      await lockAdvances(tx);
      const checked = await checkAdvance(employeeId, amount, today, tx);
      if (!checked.ok) return fail(409, checked.message);
      return {
        ok: true as const,
        data: {
          subjectEmployeeId: employeeId,
          summary: `Kasbon ${person.name} ${plan(amount, installments)}`,
          dedupeKey: `advance:${employeeId}`,
          requiredAttachment: null,
          save: async (saveTx, requestId) => {
            const number = advanceNumber(await nextNumber(saveTx));
            const [row] = await saveTx.insert(advances).values({
              number, employeeId, kind: 'REGULAR', requestId, filledByAccountId: actor.accountId, filledByEmployeeId: actor.personId,
              requestedAmount: amount, requestedInstallments: installments, reason, fund: checked.fund ?? 'MONTHLY',
            }).returning({ id: advances.id });
            if (forOther) {
              const account = (await activeHrisAccounts([employeeId])).get(employeeId);
              const filler = await nameOf(actor.personId);
              if (account) {
                await notify(saveTx, [account], {
                  kind: 'advance.filled_for', title: `${filler} mengisikan kasbon ${rupiah(amount)} atas nama Anda.`,
                  body: 'Kalau Anda tidak memintanya, batalkan dari Kasbon Saya.', link: '/kasbon', entity: 'advance', entityId: row.id,
                }, actor.accountId);
              }
            }
          },
        },
      };
    },
    async review(tx, actorAccountId, requestId, fields) {
      const row = await advanceOfRequest(tx, requestId);
      if (!row || row.state !== 'OPEN') return fail(404, 'Kasbon yang menunggu diperiksa tidak ditemukan.');
      const checked = await checkNumbers(row, fields);
      if ('ok' in checked) return checked;
      await tx.update(advances).set({
        reviewAmount: checked.amount, reviewInstallments: checked.installments, reviewNote: checked.note, reviewedByAccountId: actorAccountId, reviewedAt: new Date(),
      }).where(eq(advances.id, row.id));
      await recordAudit(tx, { actorAccountId, entity: 'advance', entityId: row.id, action: 'advance.review', after: { amount: checked.amount, installments: checked.installments, note: checked.note } });
      return { ok: true as const, effect: `Usulan ${plan(checked.amount, checked.installments)}. Pemilik dan GM diberi tahu.` };
    },
    async apply(tx, actorAccountId, requestId, fields = {}) {
      const row = await advanceOfRequest(tx, requestId);
      if (!row || row.state !== 'OPEN') return fail(404, 'Kasbon yang menunggu keputusan tidak ditemukan.');
      const checked = await checkNumbers(row, {
        amount: fields.amount ?? row.reviewAmount ?? row.requestedAmount, installments: fields.installments ?? row.reviewInstallments ?? row.requestedInstallments, note: fields.note,
      });
      if ('ok' in checked) return checked;
      const now = new Date();
      const withoutReview = row.reviewedAt == null;
      // Satu langkah utuh (DRV-62, 125): status, angka akhir, dan baris cicilan; slip tujuan dipasang saat uang diberikan.
      await tx.update(advances).set({
        state: 'APPROVED', finalAmount: checked.amount, finalInstallments: checked.installments, decisionNote: checked.note,
        decidedByAccountId: actorAccountId, decidedAt: now, withoutReview,
      }).where(eq(advances.id, row.id));
      const amounts = splitInstallments(checked.amount, checked.installments);
      await tx.insert(advanceInstallments).values(amounts.map((amount, index) => ({
        advanceId: row.id, version: 1, sequence: index + 1, total: amounts.length, amount, periodStart: null, cause: 'APPROVE',
      })));
      await recordAudit(tx, { actorAccountId, entity: 'advance', entityId: row.id, action: 'advance.approve', after: { amount: checked.amount, installments: checked.installments, withoutReview } });
      const name = await nameOf(row.employeeId);
      const finance = await accountsWith(['advance.hand_over'], row.employeeId);
      await notify(tx, finance, {
        kind: 'advance.to_hand_over', title: `Kasbon ${row.number} ${name} ${rupiah(checked.amount)} disetujui: serahkan uangnya.`,
        body: withoutReview ? 'Diputuskan tanpa pemeriksaan Finance.' : undefined, link: `/gaji/kasbon/${row.id}`, entity: 'advance', entityId: row.id,
      }, actorAccountId);
      const lowered = checked.amount !== row.requestedAmount || checked.installments !== row.requestedInstallments;
      return {
        ok: true as const,
        effect: `Kasbon ${plan(checked.amount, checked.installments)} disetujui${lowered ? ` (diajukan ${plan(row.requestedAmount, row.requestedInstallments)}; catatan: ${checked.note})` : ''}. Uangnya akan diserahkan Finance.`,
      };
    },
    async close(tx, actorAccountId, requestId, reason) {
      const row = await advanceOfRequest(tx, requestId);
      if (!row || row.state !== 'OPEN') return;
      const [request] = await tx.select({ status: requests.status }).from(requests).where(eq(requests.id, requestId));
      const state = request?.status === 'REJECTED' ? 'REJECTED' : 'WITHDRAWN';
      await tx.update(advances).set({ state, closeReason: reason, closedByAccountId: actorAccountId, closedAt: new Date() }).where(eq(advances.id, row.id));
    },
    async effectPreview(requestId) {
      const row = await advanceOfRequest(db, requestId);
      return row ? `Kasbon ${row.number} disetujui dengan angka akhir di atas. Pengaju dan Finance diberi tahu; uang diserahkan lewat langkah Serahkan uang.` : 'Kasbon ini akan disetujui.';
    },
    async describe(requestId) {
      const row = await advanceOfRequest(db, requestId);
      if (!row) return [];
      return [
        { label: 'Nomor', before: null, after: row.number },
        { label: 'Untuk', before: null, after: await nameOf(row.employeeId) },
        { label: 'Nominal diajukan', before: null, after: rupiah(row.requestedAmount) },
        { label: 'Kali potong', before: null, after: String(row.requestedInstallments) },
        { label: 'Alasan', before: null, after: row.reason },
      ];
    },
    async resubmitValues(requestId) {
      const row = await advanceOfRequest(db, requestId);
      return row ? { employeeId: row.employeeId, amount: row.requestedAmount, installments: row.requestedInstallments, reason: row.reason } : null;
    },
  };
}

async function followupOf(executor: typeof db | Tx, requestId: number) {
  const [row] = await executor.select({ followup: advanceFollowups, advance: advances }).from(advanceFollowups)
    .innerJoin(advances, eq(advances.id, advanceFollowups.advanceId)).where(eq(advanceFollowups.requestId, requestId));
  return row ?? null;
}

/** Kasbon milik pelaku: orangnya, atau pengisinya bila diisikan atas nama (DRV-123, 129). */
function ownsAdvance(actor: Actor, row: typeof advances.$inferSelect) {
  return row.employeeId === actor.personId || row.filledByAccountId === actor.accountId;
}

/** "Minta dibatalkan" (DRV-129): Disetujui belum diberikan; selama menunggu, serah uang ditolak. Setujui = dibatalkan. */
export function advanceCancelHandler(announce: ChangeAnnounce): RequestHandler {
  return {
    async prepare(tx, actor, input) {
      const id = Number(input.advanceId);
      const [view] = await loadAdvances({ ids: [id] }, tx);
      if (!view || !ownsAdvance(actor, view.row)) return fail(404, 'Kasbon tidak ditemukan.');
      if (view.stage !== 'APPROVED') return fail(409, 'Hanya kasbon yang disetujui dan belum diberikan yang bisa diminta dibatalkan.');
      const reason = String(input.reason ?? '').trim();
      if (reason.length < 15) return fail(400, 'Alasan paling sedikit 15 huruf.');
      return {
        ok: true as const,
        data: {
          subjectEmployeeId: view.row.employeeId,
          summary: `Minta batalkan kasbon ${view.row.number} ${rupiah(view.row.finalAmount ?? 0)}: ${reason}`,
          dedupeKey: `advance_cancel:${id}`,
          requiredAttachment: null,
          save: async (saveTx, requestId) => {
            await saveTx.insert(advanceFollowups).values({ requestId, advanceId: id, kind: 'CANCEL' });
          },
        },
      };
    },
    async apply(tx, actorAccountId, requestId) {
      const found = await followupOf(tx, requestId);
      if (!found) return fail(404, 'Permintaan tidak ditemukan.');
      const done = await cancelApprovedInTx(tx, actorAccountId, found.advance.id, `Diminta pengaju (PJ-${requestId})`, announce);
      if (!done.ok) return done;
      return { ok: true as const, effect: `Kasbon ${found.advance.number} dibatalkan; uangnya tidak diserahkan.` };
    },
    async effectPreview(requestId) {
      const found = await followupOf(db, requestId);
      return found ? `Setujui = kasbon ${found.advance.number} dibatalkan dan uangnya tidak diserahkan. Tolak (alasan wajib) = kasbon tetap berjalan.` : 'Kasbon dibatalkan.';
    },
    async describe(requestId) {
      const found = await followupOf(db, requestId);
      if (!found) return [];
      return [
        { label: 'Kasbon', before: null, after: `${found.advance.number} — ${await nameOf(found.advance.employeeId)}` },
        { label: 'Nominal disetujui', before: null, after: rupiah(found.advance.finalAmount ?? 0) },
      ];
    },
    async resubmitValues(requestId) {
      const found = await followupOf(db, requestId);
      return found ? { advanceId: found.advance.id } : null;
    },
  };
}

/** "Uang belum saya terima" (DRV-127, K5): selama N hari sejak diberi tahu; tidak ada akibat uang otomatis. */
export function advanceNotReceivedHandler(): RequestHandler {
  return {
    async prepare(tx, actor, input) {
      const id = Number(input.advanceId);
      const [view] = await loadAdvances({ ids: [id] }, tx);
      if (!view || view.row.employeeId !== actor.personId || !view.handover) return fail(404, 'Kasbon yang sudah diberikan tidak ditemukan.');
      const days = Number(await settingOn<number>('advance.not_received_days', todayWib())) || 3;
      if (Date.now() > view.handover.createdAt.getTime() + days * 86_400_000) return fail(409, `Batas lapor ${days} hari sejak diberi tahu sudah lewat. Hubungi Pemilik atau GM.`);
      const reason = String(input.reason ?? '').trim();
      if (reason.length < 15) return fail(400, 'Tulis singkat, paling sedikit 15 huruf.');
      const handoverId = view.handover.id;
      return {
        ok: true as const,
        data: {
          subjectEmployeeId: actor.personId,
          summary: `Uang kasbon ${view.row.number} ${rupiah(view.handover.amount)} belum diterima: ${reason}`,
          dedupeKey: `advance_not_received:${id}`,
          requiredAttachment: null,
          save: async (saveTx, requestId) => {
            await saveTx.insert(advanceFollowups).values({ requestId, advanceId: id, kind: 'NOT_RECEIVED', handoverId });
            const ids = [view.handover!.handedByAccountId];
            if (view.handover!.viaEmployeeId) {
              const via = (await activeHrisAccounts([view.handover!.viaEmployeeId])).get(view.handover!.viaEmployeeId);
              if (via) ids.push(via);
            }
            await notify(saveTx, ids, {
              kind: 'advance.not_received', title: `${await nameOf(actor.personId)} melapor uang kasbon ${view.row.number} belum diterima.`,
              body: reason, link: `/gaji/kasbon/${id}`, entity: 'advance', entityId: id,
            }, actor.accountId);
          },
        },
      };
    },
    async apply(tx, actorAccountId, requestId, fields = {}) {
      const found = await followupOf(tx, requestId);
      if (!found) return fail(404, 'Laporan tidak ditemukan.');
      const note = String(fields.note ?? '').trim();
      await tx.update(advanceFollowups).set({ decisionNote: note }).where(eq(advanceFollowups.id, found.followup.id));
      await recordAudit(tx, { actorAccountId, entity: 'advance', entityId: found.advance.id, action: 'advance.not_received_settled', after: { note } });
      return { ok: true as const, effect: `Sudah diselesaikan: ${note}` };
    },
    async effectPreview() {
      return 'Setujui = "Sudah diselesaikan" (catatan wajib, dibaca orangnya). Tolak = "Tidak terbukti" (alasan wajib). Tidak ada akibat uang otomatis; bila uangnya memang belum diberikan, pakai Batal serah uang di Rincian Kasbon.';
    },
    async describe(requestId) {
      const found = await followupOf(db, requestId);
      if (!found) return [];
      const [handover] = found.followup.handoverId
        ? await db.select().from(advanceHandovers).where(eq(advanceHandovers.id, found.followup.handoverId)) : [];
      return [
        { label: 'Kasbon', before: null, after: `${found.advance.number} — ${await nameOf(found.advance.employeeId)}` },
        { label: 'Diserahkan', before: null, after: handover ? `${rupiah(handover.amount)}, tanggal uang ${handover.moneyDate}` : '—' },
      ];
    },
    async resubmitValues(requestId) {
      const found = await followupOf(db, requestId);
      return found ? { advanceId: found.advance.id } : null;
    },
  };
}

/** Kasbon dengan pengajuan "Minta dibatalkan" yang masih menunggu (serah uang ditolak selama itu). */
export async function cancelPending(advanceIds: number[]): Promise<Set<number>> {
  if (!advanceIds.length) return new Set();
  const rows = await db.select({ advanceId: advanceFollowups.advanceId }).from(advanceFollowups)
    .innerJoin(requests, eq(requests.id, advanceFollowups.requestId))
    .where(and(inArray(advanceFollowups.advanceId, advanceIds), eq(advanceFollowups.kind, 'CANCEL'), inArray(requests.status, ['PENDING', 'REVIEWED'])));
  return new Set(rows.map((r) => r.advanceId));
}

export { openFollowup };
