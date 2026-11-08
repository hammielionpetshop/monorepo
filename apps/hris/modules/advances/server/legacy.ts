import { and, eq, inArray } from 'drizzle-orm';
import { advanceHandovers, advanceInstallments, advances } from '@petshop/hris-db/schema/advances';
import { db } from '@/lib/db';
import { hasAction, recordAudit, type Actor, type Tx } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { listPeopleForModules, todayWib } from '@/modules/employees';
import { notify } from '@/modules/notifications';
import type { RequestHandler } from '@/modules/requests';
import { settingOn } from '@/modules/settings';
import { LEGACY_MAX_INSTALLMENTS, STAGE_LABELS, STAGE_TONES, advanceNumber, legacyInputProblem, periodLabel, placeSchedule, rupiah, splitInstallments, type IsoDate } from '../rules/advance';
import { closedPeriodsOf, lastPeriodOf, loadAdvances, lockAdvances, nextNumber, payBasisOf, personOf, personTrack } from './data';
import { syncMainSlip } from './manage';
import { closedStateOf } from './requests';

// Sisa kasbon bawaan sistem lama (spec L9 §3.1, SIS-28): satu angka sisa per orang, diketik Finance, disahkan Pemilik/GM.
// Disahkan = dianggap sudah diserahkan (serah ber-method LEGACY tanpa sumber uang), jadwal potong 1–3 kali mulai slip
// hari pindah. Tidak ditolak walau di atas batas per orang; sisanya terhitung terpakai di batas orang dan Dana Kasbon.

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string };
const fail = (status: Fail['status'], error: string): Fail => ({ ok: false, status, error });

export const LEGACY_DEFAULT_REASON = 'Sisa kasbon bawaan sistem lama';

/** Hari pindah dari Pengaturan (SIS-13); null bila belum ditetapkan. */
export async function cutoverOn(today: IsoDate = todayWib()): Promise<IsoDate | null> {
  const value = await settingOn<string>('migration.cutover_on', today);
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

async function legacyOfRequest(executor: typeof db | Tx, requestId: number) {
  const [row] = await executor.select().from(advances).where(and(eq(advances.requestId, requestId), eq(advances.kind, 'LEGACY')));
  return row ?? null;
}

const plan = (amount: number, count: number) => `${rupiah(amount)}, ${count} kali potong${count > 1 ? ` (${splitInstallments(amount, count).map(rupiah).join(' + ')})` : ''}`;

export function legacyAdvanceHandler(): RequestHandler {
  return {
    async prepare(tx, actor, input) {
      const employeeId = Number(input.employeeId);
      if (employeeId === actor.personId) return fail(403, 'Sisa kasbon bawaan Anda sendiri diketik orang lain.');
      const person = await personOf(employeeId);
      if (!person?.activeToday) return fail(404, 'Pilih karyawan aktif.');
      const today = todayWib();
      const cutover = await cutoverOn(today);
      if (!cutover) return fail(409, 'Hari pindah belum ditetapkan di Pengaturan.');
      const basis = await payBasisOf(person.positionId, cutover);
      if (!basis) return fail(409, 'Jabatan orang ini belum punya dasar gaji (bulanan/mingguan) di Pengaturan Jabatan.');
      const amount = Number(input.amount);
      const installments = Number(input.installments);
      const note = String(input.note ?? '').trim();
      const problem = legacyInputProblem({ amount, installments, note });
      if (problem) return fail(400, problem);
      await lockAdvances(tx);
      const [taken] = await tx.select({ id: advances.id }).from(advances)
        .where(and(eq(advances.employeeId, employeeId), eq(advances.kind, 'LEGACY'), inArray(advances.state, ['OPEN', 'APPROVED'])));
      if (taken) return fail(409, `${person.name} sudah punya sisa kasbon bawaan. Satu orang satu.`);
      return {
        ok: true as const,
        data: {
          subjectEmployeeId: employeeId,
          summary: `Sisa kasbon bawaan ${person.name} ${plan(amount, installments)}`,
          dedupeKey: `advance_legacy:${employeeId}`,
          requiredAttachment: null,
          save: async (saveTx, requestId) => {
            const number = advanceNumber(await nextNumber(saveTx));
            await saveTx.insert(advances).values({
              number, employeeId, kind: 'LEGACY', requestId, filledByAccountId: actor.accountId, filledByEmployeeId: actor.personId,
              requestedAmount: amount, requestedInstallments: installments, reason: note || LEGACY_DEFAULT_REASON, fund: basis,
            });
          },
        },
      };
    },
    async apply(tx, actorAccountId, requestId) {
      const row = await legacyOfRequest(tx, requestId);
      if (!row || row.state !== 'OPEN') return fail(404, 'Sisa kasbon bawaan yang menunggu disahkan tidak ditemukan.');
      const cutover = await cutoverOn();
      if (!cutover) return fail(409, 'Hari pindah belum ditetapkan di Pengaturan.');
      const person = await personOf(row.employeeId);
      if (!person) return fail(404, 'Karyawan tidak ditemukan.');
      await lockAdvances(tx);
      const now = new Date();
      await tx.update(advances).set({
        state: 'APPROVED', finalAmount: row.requestedAmount, finalInstallments: row.requestedInstallments,
        decidedByAccountId: actorAccountId, decidedAt: now, withoutReview: true,
      }).where(eq(advances.id, row.id));
      // Tidak ada uang keluar: serah bertanda LEGACY bertanggal hari pindah, tanpa sumber uang (spec L9 §2).
      await tx.insert(advanceHandovers).values({
        advanceId: row.id, amount: row.requestedAmount, moneyDate: cutover, moneyPlaceId: null, method: 'LEGACY', handedByAccountId: actorAccountId,
      });
      const amounts = splitInstallments(row.requestedAmount, row.requestedInstallments);
      const track = await personTrack(row.employeeId, cutover, tx);
      const periods = placeSchedule(amounts, cutover, await closedPeriodsOf(row.employeeId, tx, track.kind), lastPeriodOf(person, track), track);
      await tx.insert(advanceInstallments).values(amounts.map((amount, index) => ({
        advanceId: row.id, version: 1, sequence: index + 1, total: amounts.length, amount, periodStart: periods[index], slipKind: track.kind, cause: 'APPROVE',
      })));
      await syncMainSlip(row.employeeId, tx, false);
      await recordAudit(tx, {
        actorAccountId, entity: 'advance', entityId: row.id, action: 'advance.legacy_approve',
        after: { number: row.number, amount: row.requestedAmount, installments: row.requestedInstallments, cutover, periods },
      });
      const first = periodLabel(periods[0], track.kind);
      const account = (await activeHrisAccounts([row.employeeId])).get(row.employeeId);
      if (account) {
        await notify(tx, [account], {
          kind: 'advance.legacy_approved', title: `Sisa kasbon dari sistem lama ${rupiah(row.requestedAmount)} tercatat di HRIS baru.`,
          body: `Dipotong ${amounts.length} kali mulai gajian ${first}.`, link: '/kasbon', entity: 'advance', entityId: row.id,
        }, actorAccountId);
      }
      return { ok: true as const, effect: `Sisa kasbon bawaan ${plan(row.requestedAmount, row.requestedInstallments)} disahkan; dipotong mulai slip ${first}.` };
    },
    async close(tx, actorAccountId, requestId, reason) {
      const row = await legacyOfRequest(tx, requestId);
      if (!row || row.state !== 'OPEN') return;
      const state = await closedStateOf(tx, requestId);
      await tx.update(advances).set({ state, closeReason: reason, closedByAccountId: actorAccountId, closedAt: new Date() }).where(eq(advances.id, row.id));
    },
    async effectPreview(requestId) {
      const row = await legacyOfRequest(db, requestId);
      const cutover = await cutoverOn();
      return row
        ? `Sisa ${rupiah(row.requestedAmount)} dicatat sebagai kasbon berjalan bertanda "Bawaan sistem lama", dipotong ${row.requestedInstallments} kali mulai slip hari pindah${cutover ? ` (${cutover.split('-').reverse().join('-')})` : ''}. Tidak ada uang keluar.`
        : 'Sisa kasbon bawaan ini akan disahkan.';
    },
    async describe(requestId) {
      const row = await legacyOfRequest(db, requestId);
      if (!row) return [];
      return [
        { label: 'Nomor', before: null, after: row.number },
        { label: 'Untuk', before: null, after: (await personOf(row.employeeId))?.name ?? `#${row.employeeId}` },
        { label: 'Sisa dari sistem lama', before: null, after: rupiah(row.requestedAmount) },
        { label: 'Kali potong', before: null, after: String(row.requestedInstallments) },
        { label: 'Catatan', before: null, after: row.reason },
      ];
    },
    async resubmitValues(requestId) {
      const row = await legacyOfRequest(db, requestId);
      return row ? { employeeId: row.employeeId, amount: row.requestedAmount, installments: row.requestedInstallments, note: row.reason === LEGACY_DEFAULT_REASON ? '' : row.reason } : null;
    },
  };
}

// ---- Layar Sisa Kasbon Bawaan (/gaji/kasbon/bawaan) ----

export async function legacyScreen(actor: Actor | null) {
  if (!actor || !(hasAction(actor, 'advance.legacy_enter') || hasAction(actor, 'advance.decide'))) return null;
  const today = todayWib();
  const cutover = await cutoverOn(today);
  const people = await listPeopleForModules();
  const views = (await loadAdvances()).filter((v) => v.row.kind === 'LEGACY');
  const rows = views.map((v) => {
    const p = people.find((x) => x.id === v.row.employeeId);
    return {
      id: v.row.id, number: v.row.number, name: p?.name ?? `#${v.row.employeeId}`, branchName: p?.branchName ?? '-',
      amount: v.row.finalAmount ?? v.row.requestedAmount, installments: v.row.finalInstallments ?? v.row.requestedInstallments,
      remaining: v.handover ? v.remaining : null, stageLabel: STAGE_LABELS[v.stage], tone: STAGE_TONES[v.stage], requestId: v.row.requestId,
    };
  }).sort((a, b) => a.name.localeCompare(b.name, 'id'));
  const taken = new Set(views.filter((v) => v.row.state === 'OPEN' || v.row.state === 'APPROVED').map((v) => v.row.employeeId));
  const candidates = [];
  for (const p of people) {
    if (!p.activeToday || p.id === actor.personId || taken.has(p.id)) continue;
    const basis = cutover ? await payBasisOf(p.positionId, cutover) : null;
    candidates.push({ id: p.id, name: p.name, branchName: p.branchName, basis });
  }
  candidates.sort((a, b) => a.name.localeCompare(b.name, 'id'));
  return {
    cutover, rows, candidates, canEnter: hasAction(actor, 'advance.legacy_enter'), maxInstallments: LEGACY_MAX_INSTALLMENTS,
    total: rows.filter((r) => r.remaining != null).reduce((sum, r) => sum + (r.remaining ?? 0), 0),
  };
}

export async function legacyApprovedCount(): Promise<{ open: number; approved: number }> {
  const rows = await db.select({ state: advances.state }).from(advances).where(and(eq(advances.kind, 'LEGACY'), inArray(advances.state, ['OPEN', 'APPROVED'])));
  return { open: rows.filter((r) => r.state === 'OPEN').length, approved: rows.filter((r) => r.state === 'APPROVED').length };
}
