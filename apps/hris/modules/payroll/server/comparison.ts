import { and, asc, desc, eq } from 'drizzle-orm';
import { comparisonRuns, comparisonSlips } from '@petshop/hris-db/schema/payroll';
import { db } from '@/lib/db';
import { hasAction, recordAudit, type Actor, type ServiceResult } from '@/modules/access';
import { listPeopleForModules, todayWib } from '@/modules/employees';
import {
  COMPARISON_KIND_LABELS, MAX_COMPUTE, causeProblem, comparisonCsv, computationComponents, latestHris,
  type ComparisonCause, type ComparisonComponent, type ComparisonSlipKind,
} from '../rules/comparison';
import { periodEndOf, type IsoDate } from '../rules/salary';
import { accountNames, loadPeriodPeople, type PayrollPerson } from './data';
import { computeSlip, periodLabel, wibTime } from './payslip';
import { computeWeeklySlip } from './weekly-slip';

// Lembar Banding (spec L9 §4; SIS-15, 16, 41): angka slip lama vs hitungan HRIS per orang, sebab selisih dari Pemilik/GM.

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string };
const fail = (status: Fail['status'], error: string): Fail => ({ ok: false, status, error });

/** Hanya Pemilik/GM (jabatan berhak penuh). */
export const canCompare = (actor: Actor | null): actor is Actor => Boolean(actor?.fullAccess && hasAction(actor, 'migration.comparison'));

type RunRow = typeof comparisonRuns.$inferSelect;

async function runOf(runId: number | null): Promise<RunRow | null> {
  const [run] = runId
    ? await db.select().from(comparisonRuns).where(eq(comparisonRuns.id, runId))
    : await db.select().from(comparisonRuns).where(eq(comparisonRuns.status, 'LOADED')).orderBy(desc(comparisonRuns.id)).limit(1);
  return run ?? null;
}

/** Slip lama satu uji banding beserta nama dan kode HRIS orangnya, urut nama. */
async function slipRows(runId: number) {
  const [slips, people] = await Promise.all([
    db.select().from(comparisonSlips).where(eq(comparisonSlips.runId, runId)).orderBy(asc(comparisonSlips.slipKind), asc(comparisonSlips.slipStart)),
    listPeopleForModules(),
  ]);
  const byId = new Map(people.map((p) => [p.id, p]));
  return slips
    .map((slip) => ({ slip, name: byId.get(slip.employeeId)?.name ?? `#${slip.employeeId}`, code: byId.get(slip.employeeId)?.code ?? '-' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'id'));
}

export async function comparisonScreen(actor: Actor | null, runInput: string | null) {
  if (!canCompare(actor)) return null;
  const runs = await db.select().from(comparisonRuns).orderBy(desc(comparisonRuns.id));
  const run = await runOf(runInput && /^\d+$/.test(runInput) ? Number(runInput) : null);
  if (!run) return { runs, run: null, rows: [], summary: null };
  const names = await accountNames();
  const rows = (await slipRows(run.id)).map(({ slip, name, code }) => {
    const hris = latestHris(slip, run.computedCount);
    return {
      id: slip.id, employeeId: slip.employeeId, name, code, legacyCode: slip.legacyCode, slipKind: slip.slipKind as ComparisonSlipKind,
      kindLabel: COMPARISON_KIND_LABELS[slip.slipKind as ComparisonSlipKind], slipStart: slip.slipStart,
      oldTotal: slip.oldTotal, oldComponents: slip.oldComponents, firstTotal: slip.firstTotal, secondTotal: slip.secondTotal,
      hris, hrisComponents: (run.computedCount >= 2 ? slip.secondComponents : slip.firstComponents) ?? [],
      diff: hris == null ? null : hris - slip.oldTotal,
      cause: slip.cause as ComparisonCause | null, ruleRef: slip.ruleRef, note: slip.note,
      decidedBy: slip.decidedByAccountId ? names.get(slip.decidedByAccountId) ?? '-' : null,
      decidedAt: slip.decidedAt ? wibTime(slip.decidedAt) : null,
    };
  });
  const differing = rows.filter((r) => r.diff != null && r.diff !== 0);
  return {
    runs, run: { ...run, periodText: periodLabel(run.periodStart) }, rows,
    summary: {
      total: rows.length, same: rows.filter((r) => r.diff === 0).length, differing: differing.length,
      unexplained: differing.filter((r) => !r.cause).length, toFix: rows.filter((r) => r.cause === 'FIX').length,
      canCompute: run.status === 'LOADED' && run.computedCount < MAX_COMPUTE,
    },
  };
}

/** Hitung satu slip dengan mesin yang sama (tanpa tutup/bayar). Null = orang tidak punya gaji/slip di rentang itu. */
async function computeOne(person: PayrollPerson | undefined, kind: ComparisonSlipKind, start: IsoDate, now: Date): Promise<{ total: number; components: ComparisonComponent[] } | null> {
  if (!person) return null;
  if (kind === 'MONTHLY') {
    const result = await computeSlip(person, start, now);
    return result ? { total: result.computation.net, components: computationComponents(result.computation) } : null;
  }
  const result = await computeWeeklySlip(person, { kind, periodStart: start }, now);
  return { total: result.computation.net, components: computationComponents(result.computation) };
}

/**
 * Simpan hitungan HRIS seluruh slip uji banding ini: pertama kali = hitungan 1, sesudah perbaikan = hitung ulang
 * (paling banyak sekali, SIS-16). Membaca data saja; tidak ada slip yang ditutup atau dibayar.
 */
export async function computeComparison(actor: Actor | null, runId: number, now: Date = new Date()): Promise<ServiceResult<{ computed: number; round: number }>> {
  if (!canCompare(actor)) return fail(403, 'Hanya Pemilik atau GM.');
  const run = await runOf(runId);
  if (!run) return fail(404, 'Uji banding tidak ditemukan.');
  if (run.status !== 'LOADED') return fail(409, 'Data salinan uji banding ini sudah dihapus.');
  if (run.computedCount >= MAX_COMPUTE) return fail(409, 'Hitung ulang hanya boleh sekali. Keputusan selanjutnya di tangan Pemilik.');
  const people = new Map((await loadPeriodPeople(run.periodStart, periodEndOf(run.periodStart), 'ANY')).map((p) => [p.id, p]));
  const slips = await db.select().from(comparisonSlips).where(eq(comparisonSlips.runId, run.id));
  const results: { id: number; value: { total: number; components: ComparisonComponent[] } | null }[] = [];
  for (const slip of slips) {
    results.push({ id: slip.id, value: await computeOne(people.get(slip.employeeId), slip.slipKind as ComparisonSlipKind, slip.slipStart, now) });
  }
  const round = run.computedCount + 1;
  const outcome = await db.transaction(async (tx) => {
    const [locked] = await tx.update(comparisonRuns).set({ computedCount: round })
      .where(and(eq(comparisonRuns.id, run.id), eq(comparisonRuns.computedCount, run.computedCount), eq(comparisonRuns.status, 'LOADED')))
      .returning({ id: comparisonRuns.id });
    if (!locked) return false;
    for (const { id, value } of results) {
      // Tanpa gaji di rentang itu: dicatat 0 dengan keterangan, supaya selisihnya terlihat.
      const total = value?.total ?? 0;
      const components = value?.components ?? [{ label: 'Tidak dihitung: belum ada gaji atau orang tidak aktif di rentang ini', side: 'INCOME' as const, amount: 0 }];
      await tx.update(comparisonSlips)
        .set(round === 1 ? { firstTotal: total, firstComponents: components } : { secondTotal: total, secondComponents: components })
        .where(eq(comparisonSlips.id, id));
    }
    await recordAudit(tx, { actorAccountId: actor.accountId, entity: 'comparison_run', entityId: run.id, action: round === 1 ? 'compute' : 'recompute', after: { slips: results.length } });
    return true;
  });
  if (!outcome) return fail(409, 'Uji banding ini baru saja dihitung orang lain. Muat ulang halaman.');
  return { ok: true, data: { computed: results.length, round } };
}

export type CauseInput = { cause: ComparisonCause | null; ruleRef: string | null; note: string | null };

/** Sebab selisih satu slip: beda disengaja (nomor aturan wajib) atau perlu diperbaiki; kosong = belum dijelaskan. */
export async function saveComparisonCause(actor: Actor | null, slipId: number, input: CauseInput, now: Date = new Date()): Promise<ServiceResult<object>> {
  if (!canCompare(actor)) return fail(403, 'Hanya Pemilik atau GM.');
  const problem = causeProblem(input.cause, input.ruleRef, input.note);
  if (problem) return fail(400, problem);
  const [slip] = await db.select({ slip: comparisonSlips, status: comparisonRuns.status }).from(comparisonSlips)
    .innerJoin(comparisonRuns, eq(comparisonRuns.id, comparisonSlips.runId)).where(eq(comparisonSlips.id, slipId));
  if (!slip) return fail(404, 'Baris tidak ditemukan.');
  if (slip.status !== 'LOADED') return fail(409, 'Data salinan uji banding ini sudah dihapus.');
  const clean = (v: string | null) => (v?.trim() ? v.trim() : null);
  const after = input.cause
    ? { cause: input.cause, ruleRef: clean(input.ruleRef), note: clean(input.note), decidedByAccountId: actor.accountId, decidedAt: now }
    : { cause: null, ruleRef: null, note: clean(input.note), decidedByAccountId: null, decidedAt: null };
  await db.transaction(async (tx) => {
    await tx.update(comparisonSlips).set(after).where(eq(comparisonSlips.id, slipId));
    await recordAudit(tx, {
      actorAccountId: actor.accountId, entity: 'comparison_slip', entityId: slipId, action: 'cause',
      before: { cause: slip.slip.cause, ruleRef: slip.slip.ruleRef, note: slip.slip.note }, after: { cause: after.cause, ruleRef: after.ruleRef, note: after.note },
    });
  });
  return { ok: true, data: {} };
}

export async function comparisonDownload(actor: Actor | null, runId: number, now: Date = new Date()): Promise<{ filename: string; csv: string } | null> {
  if (!canCompare(actor)) return null;
  const run = await runOf(runId);
  if (!run) return null;
  const rows = (await slipRows(run.id)).map(({ slip, name, code }) => ({
    code, legacyCode: slip.legacyCode, name, slipKind: slip.slipKind as ComparisonSlipKind, slipStart: slip.slipStart, oldTotal: slip.oldTotal,
    firstTotal: slip.firstTotal, secondTotal: slip.secondTotal, hris: latestHris(slip, run.computedCount),
    cause: slip.cause as ComparisonCause | null, ruleRef: slip.ruleRef, note: slip.note,
  }));
  const madeBy = (await accountNames()).get(actor.accountId) ?? '-';
  return {
    filename: `lembar-banding-${run.periodStart}-dibuat-${todayWib(now)}.csv`,
    csv: comparisonCsv(rows, { label: periodLabel(run.periodStart), madeBy, madeAt: wibTime(now) }),
  };
}

