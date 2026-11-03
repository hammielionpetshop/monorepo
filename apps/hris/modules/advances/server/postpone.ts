import { eq } from 'drizzle-orm';
import { advanceFollowups, advances } from '@petshop/hris-db/schema/advances';
import { db } from '@/lib/db';
import { can, recordAudit, type Actor, type Tx } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { todayWib } from '@/modules/employees';
import { notify } from '@/modules/notifications';
import type { RequestHandler } from '@/modules/requests';
import { settingOn } from '@/modules/settings';
import { periodLabel, postponePeriods, postponeProblem, rupiah, type SlipKind } from '../rules/advance';
import { closedPeriodsOf, leavingOn, loadAdvances, lockAdvances, openFollowup, personOf, postponesUsed, trackOf, type AdvanceView, type Executor } from './data';
import { isWaiting, kindOf, labelOf, writeVersion } from './manage';

// "Tunda cicilan kasbon" (spec L5 §3.9; DRV-68, 134): diminta pemilik kasbon (HR/Admin HR boleh atas nama), diputuskan
// Pemilik/GM bukan miliknya. Gugur saat slip cicilan terdekat ditutup lebih dulu (slip.ts `lapsePostpones`).

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string };
const fail = (status: Fail['status'], error: string): Fail => ({ ok: false, status, error });

/** Syarat minta tunda atas satu kasbon, dibaca dari data hari ini (dipakai layar dan pengajuan). */
export async function postponeCheck(view: AdvanceView, executor: Executor = db, today = todayWib()): Promise<string | null> {
  const person = await personOf(view.row.employeeId);
  const quota = Number(await settingOn<number>('advance.postpone_quota', today) ?? 1);
  const closed = { MONTHLY: await closedPeriodsOf(view.row.employeeId, executor, 'MONTHLY'), WEEKLY: await closedPeriodsOf(view.row.employeeId, executor, 'WEEKLY') };
  return postponeProblem({
    stage: view.stage, used: await postponesUsed(view.row.id, executor), quota: Number.isFinite(quota) ? quota : 1,
    hasOpenScheduled: view.installments.some((i) => i.status === 'SCHEDULED' && i.periodStart && !closed[kindOf(i)].has(i.periodStart)),
    pending: Boolean(await openFollowup(view.row.id, 'POSTPONE', executor)), leaving: Boolean(person && leavingOn(person, today)),
  });
}

async function followupOf(executor: typeof db | Tx, requestId: number) {
  const [row] = await executor.select({ followup: advanceFollowups, advance: advances }).from(advanceFollowups)
    .innerJoin(advances, eq(advances.id, advanceFollowups.advanceId)).where(eq(advanceFollowups.requestId, requestId));
  return row ?? null;
}

const waitingOf = (view: AdvanceView) => view.installments.filter((i) => isWaiting(i.status) && i.periodStart)
  .sort((a, b) => (a.periodStart! < b.periodStart! ? -1 : a.periodStart! > b.periodStart! ? 1 : a.id - b.id));

/** Kasbon milik pelaku, atau HR/Admin HR yang mengisikan atas nama (bukan dirinya). */
async function mayAsk(actor: Actor, view: AdvanceView) {
  if (view.row.employeeId === actor.personId) return true;
  const person = await personOf(view.row.employeeId);
  return Boolean(person && can(actor, 'advance.fill_for', person.target));
}

export function advancePostponeHandler(): RequestHandler {
  return {
    async prepare(tx, actor, input) {
      const id = Number(input.advanceId);
      const [view] = await loadAdvances({ ids: [id] }, tx);
      if (!view || !(await mayAsk(actor, view))) return fail(404, 'Kasbon tidak ditemukan.');
      const problem = await postponeCheck(view, tx);
      if (problem) return fail(409, problem);
      const reason = String(input.reason ?? '').trim();
      if (reason.length < 15) return fail(400, 'Alasan paling sedikit 15 huruf.');
      const next = waitingOf(view)[0];
      return {
        ok: true as const,
        data: {
          subjectEmployeeId: view.row.employeeId,
          summary: `Tunda cicilan kasbon ${view.row.number} (${rupiah(next?.amount ?? 0)} di gajian ${next ? labelOf(next) : '-'}): ${reason}`,
          dedupeKey: `advance_postpone:${id}`,
          requiredAttachment: null,
          save: async (saveTx, requestId) => {
            await saveTx.insert(advanceFollowups).values({ requestId, advanceId: id, kind: 'POSTPONE' });
          },
        },
      };
    },
    async apply(tx, actorAccountId, requestId) {
      const found = await followupOf(tx, requestId);
      if (!found) return fail(404, 'Permintaan tidak ditemukan.');
      await lockAdvances(tx);
      const [view] = await loadAdvances({ ids: [found.advance.id] }, tx);
      if (view.stage !== 'RUNNING') return fail(409, 'Kasbon ini sudah tidak berjalan; tunda tidak bisa disetujui.');
      const person = await personOf(view.row.employeeId);
      if (person && leavingOn(person, todayWib())) return fail(409, 'Tanggal berhenti orang ini sudah tercatat; cicilan tidak ditunda.');
      const waiting = waitingOf(view);
      if (!waiting.length) return fail(409, 'Tidak ada cicilan yang menunggu dipotong.');
      // Semua cicilan yang menunggu bergeser satu periode; sisa potongan yang dibawa tidak ikut (DRV-134).
      // Tiap cicilan bergeser satu periode di jalurnya sendiri (bulanan atau mingguan).
      const periods: string[] = [];
      for (const i of waiting) {
        const kind: SlipKind = kindOf(i);
        periods.push(postponePeriods([i.periodStart!], await closedPeriodsOf(view.row.employeeId, tx, kind), await trackOf(kind))[0]);
      }
      await writeVersion(tx, view, waiting.map((i, index) => ({ sequence: i.sequence, total: i.total, amount: i.amount, periodStart: periods[index], slipKind: kindOf(i) })), 'POSTPONE');
      const firstLabel = periodLabel(periods[0], kindOf(waiting[0]));
      await recordAudit(tx, { actorAccountId, entity: 'advance', entityId: view.row.id, action: 'advance.postpone', after: { requestId, periods } });
      const account = (await activeHrisAccounts([view.row.employeeId])).get(view.row.employeeId);
      if (account) {
        await notify(tx, [account], {
          kind: 'advance.postponed', title: `Cicilan kasbon ${view.row.number} ditunda: mulai gajian ${firstLabel}.`,
          link: '/kasbon', entity: 'advance', entityId: view.row.id,
        }, actorAccountId);
      }
      return { ok: true as const, effect: `Semua cicilan kasbon ${view.row.number} bergeser satu gajian; cicilan berikutnya di slip ${firstLabel}.` };
    },
    async effectPreview(requestId) {
      const found = await followupOf(db, requestId);
      if (!found) return 'Cicilan kasbon ditunda satu gajian.';
      const [view] = await loadAdvances({ ids: [found.advance.id] });
      const next = view ? waitingOf(view)[0] : null;
      return `Setujui = semua cicilan kasbon ${found.advance.number} yang belum terpotong bergeser satu gajian${next ? ` (cicilan ${rupiah(next.amount)} di ${labelOf(next)} pindah ke gajian berikutnya)` : ''}; jatah tunda terpakai. Tolak (alasan wajib) = cicilan dipotong biasa. Bila slipnya ditutup lebih dulu, permintaan gugur.`;
    },
    async describe(requestId) {
      const found = await followupOf(db, requestId);
      if (!found) return [];
      const [view] = await loadAdvances({ ids: [found.advance.id] });
      const person = await personOf(found.advance.employeeId);
      return [
        { label: 'Kasbon', before: null, after: `${found.advance.number} — ${person?.name ?? '-'}` },
        { label: 'Sisa', before: null, after: rupiah(view?.remaining ?? 0) },
        { label: 'Cicilan menunggu', before: null, after: view ? waitingOf(view).map((i) => `${rupiah(i.amount)} · ${labelOf(i)}`).join('; ') || '-' : '-' },
      ];
    },
    async resubmitValues(requestId) {
      const found = await followupOf(db, requestId);
      return found ? { advanceId: found.advance.id } : null;
    },
  };
}
