import { and, eq, inArray } from 'drizzle-orm';
import { fundEntries, payslipLines, payslips, paymentSources } from '@petshop/hris-db/schema/payroll';
import { db } from '@/lib/db';
import { hasAction, type Actor } from '@/modules/access';
import { todayWib } from '@/modules/employees';
import { LINE_LABELS } from '../rules/attendance-pay';
import { entryKindLabel } from '../rules/bonus';
import { summarize, type SummarySlip, type SummaryTotals } from '../rules/off-slip';
import { PAYSLIP_FROM } from '../rules/payslip';
import { periodEndOf, periodStartOf, type IsoDate } from '../rules/salary';
import { loadPeriodPeople } from './data';
import { activePayments } from './payment';
import { periodLabel } from './payslip';

// L4f-2 Ringkasan Gaji (GAJ-55, 105; spec L4f §3.8): membaca baris slip tersimpan dan pembayarannya, tidak menghitung ulang.

export type SummaryView = 'FULL' | 'HR' | 'FINANCE';

const bonusLabel = (kind: string) => (kind === 'TYPED' ? 'Bonus jenis ketik (Bonus Bebas, dll.)' : `Bonus ${entryKindLabel(kind, null).toLowerCase()}`);
export const OWNER_GM_ROW = 'Gaji Pemilik dan GM';

/** Bentuk yang boleh dilihat: Pemilik/GM semua; HR tanpa jabatan bertanda; Finance total perusahaan saja (spec L4f §3.8). */
export function summaryViewOf(actor: Actor | null, finance: boolean): SummaryView | null {
  if (!actor) return null;
  if (actor.fullAccess) return finance ? 'FINANCE' : 'FULL';
  if (!hasAction(actor, 'payroll_summary.view')) return null;
  if (!finance && hasAction(actor, 'payslip.view')) return 'HR';
  return 'FINANCE';
}

export async function payrollSummary(actor: Actor | null, periodStart: string, opts: { finance?: boolean; heldSlipIds?: ReadonlySet<number> } = {}, now: Date = new Date()) {
  const view = summaryViewOf(actor, Boolean(opts.finance));
  if (!view) return null;
  if (!/^\d{4}-\d{2}-26$/.test(periodStart) || periodStart < PAYSLIP_FROM || periodStart > periodStartOf(todayWib(now))) return null;
  const start = periodStart as IsoDate;
  const rows = await db.select().from(payslips).where(and(eq(payslips.periodStart, start), eq(payslips.kind, 'MONTHLY')));
  const people = new Map((await loadPeriodPeople(start, periodEndOf(start))).map((p) => [p.id, p]));
  const closedIds = rows.filter((r) => r.status === 'CLOSED').map((r) => r.id);
  const [lines, paid, sources, funds] = await Promise.all([
    closedIds.length ? db.select().from(payslipLines).where(and(inArray(payslipLines.payslipId, closedIds), eq(payslipLines.status, 'ACTIVE'))) : Promise.resolve([]),
    activePayments(closedIds),
    db.select().from(paymentSources),
    closedIds.length ? db.select({ payslipId: fundEntries.payslipId, fund: fundEntries.fund, amount: fundEntries.amount }).from(fundEntries).where(inArray(fundEntries.payslipId, closedIds)) : Promise.resolve([]),
  ]);

  const slips: (SummarySlip & { id: number })[] = [];
  for (const r of rows) {
    const person = people.get(r.employeeId);
    const ownerOnly = person?.ownerOnly ?? false;
    // Jabatan bertanda "gaji hanya Pemilik/GM" tidak ikut dan tidak disebut untuk HR dan Finance.
    if (ownerOnly && view !== 'FULL') continue;
    const pay = paid.get(r.id);
    const status = r.status === 'CLOSED' ? (pay ? 'PAID' : 'CLOSED') : opts.heldSlipIds?.has(r.id) ? 'HELD' : 'ESTIMATE';
    slips.push({
      id: r.id, status, branchName: r.branchName ?? person?.branchName ?? '-', ownerOnly, lastSlip: r.lastSlip,
      income: r.income ?? 0, taken: r.taken ?? 0, net: r.net ?? 0, carried: r.carried ?? 0,
      lines: lines.filter((l) => l.payslipId === r.id && l.version === r.version).map((l) => ({
        section: l.section as SummarySlip['lines'][number]['section'], group: l.deductionGroup, sourceKey: l.sourceKey, lineKind: l.lineKind, label: l.label,
        amount: l.amount, taken: l.taken, remaining: l.remaining, fund: (l.details as { fund?: string } | null)?.fund === 'DISCIPLINE_FUND',
      })),
      payment: pay ? { kind: pay.kind as 'MONEY' | 'NO_MONEY', source: sources.find((s) => s.id === pay.sourceId)?.name ?? null } : null,
    });
  }
  const fundsOf = (ids: Set<number>) => funds.filter((f) => f.payslipId != null && ids.has(f.payslipId)).map((f) => ({ fund: f.fund as 'DISCIPLINE' | 'ABSENCE', amount: f.amount }));
  const total = summarize(slips, view === 'FINANCE' ? [] : fundsOf(new Set(slips.map((s) => s.id))), LINE_LABELS, bonusLabel);

  let branches: { name: string; totals: SummaryTotals }[] = [];
  if (view !== 'FINANCE') {
    const groups = new Map<string, typeof slips>();
    for (const s of slips) {
      const key = s.ownerOnly ? OWNER_GM_ROW : s.branchName;
      groups.set(key, [...(groups.get(key) ?? []), s]);
    }
    branches = [...groups].map(([name, list]) => ({ name, totals: summarize(list, fundsOf(new Set(list.map((s) => s.id))), LINE_LABELS, bonusLabel) }))
      .sort((a, b) => (a.name === OWNER_GM_ROW ? 1 : b.name === OWNER_GM_ROW ? -1 : a.name.localeCompare(b.name)));
  }
  return {
    view,
    period: { start, label: periodLabel(start) },
    total,
    branches,
    heldKnown: Boolean(opts.heldSlipIds),
    balanced: total.incomeTotal - total.takenTotal === total.net && total.net === total.paidTotal + total.unpaid,
  };
}
