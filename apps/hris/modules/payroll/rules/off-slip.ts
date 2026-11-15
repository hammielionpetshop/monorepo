// Aturan murni L4f-2 (spec L4f §3.7, §3.8): potong Piutang Lain lebih dulu, tagihan koreksi, dan Ringkasan Gaji.
import { GROUP_LABELS, type DeductionGroup } from './deductions';

export type ClaimStatus = 'WAITING' | 'PAID' | 'CANCELLED';
export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = { WAITING: 'Menunggu dibayar', PAID: 'Dibayar', CANCELLED: 'Dibatalkan' };
export type ClaimKind = 'BONUS' | 'CORRECTION';
export const CLAIM_KIND_LABELS: Record<ClaimKind, string> = { BONUS: 'Bonus susulan', CORRECTION: 'Koreksi plus' };

/**
 * Potong Piutang Lain lebih dulu (Y5, GAJ-96): nominal tagihan mengurangi piutang terbuka orang itu, yang paling lama lebih dulu,
 * tanpa uang bergerak. Sisanya dibayar dengan uang (boleh Rp0).
 */
export function settleAgainst(amount: number, receivables: readonly { id: number; remaining: number }[]): { settlements: { receivableId: number; amount: number; clears: boolean }[]; cash: number } {
  let left = Math.max(0, amount);
  const settlements: { receivableId: number; amount: number; clears: boolean }[] = [];
  for (const r of receivables) {
    if (left <= 0) break;
    if (r.remaining <= 0) continue;
    const take = Math.min(left, r.remaining);
    settlements.push({ receivableId: r.id, amount: take, clears: take === r.remaining });
    left -= take;
  }
  return { settlements, cash: left };
}

/**
 * Tagihan koreksi per kunci sumber (spec L4f §3.7 b): `target` = selisih yang belum masuk slip tertutup mana pun, dibandingkan
 * dengan tagihan yang sudah ada. Tagihan Menunggu yang tidak cocok lagi dibatalkan lalu dibuat ulang dengan nominal baru;
 * tagihan yang sudah Dibayar tidak disentuh (kekurangan berikutnya menjadi tagihan baru).
 */
export function correctionPlan(target: number, live: readonly { id: number; amount: number; status: 'WAITING' | 'PAID' }[]): { cancel: number[]; create: number } {
  const paid = live.filter((c) => c.status === 'PAID').reduce((s, c) => s + c.amount, 0);
  const waiting = live.filter((c) => c.status === 'WAITING');
  const need = Math.max(0, target - paid);
  const waitingTotal = waiting.reduce((s, c) => s + c.amount, 0);
  if (waitingTotal === need) return { cancel: [], create: 0 };
  return { cancel: waiting.map((c) => c.id), create: need };
}

// ---- Ringkasan Gaji (GAJ-55, 105) ----

export type SummaryLine = { section: 'INCOME' | 'DEDUCTION' | 'NOTE'; group: string | null; sourceKey: string; lineKind: string; label: string; amount: number; taken: number; remaining: number; fund: boolean };
export type SummarySlip = {
  status: 'ESTIMATE' | 'HELD' | 'CLOSED' | 'PAID';
  branchName: string;
  ownerOnly: boolean;
  lastSlip: boolean;
  income: number; taken: number; net: number; carried: number;
  lines: readonly SummaryLine[];
  payment: { kind: 'MONEY' | 'NO_MONEY'; source: string | null } | null;
};

export type SummaryTotals = {
  counts: { ESTIMATE: number; HELD: number; CLOSED: number; PAID: number };
  income: { label: string; amount: number }[];
  incomeTotal: number;
  taken: { group: DeductionGroup; label: string; amount: number }[];
  takenTotal: number;
  carried: number; uncollectible: number; receivables: number;
  funds: { fund: 'DISCIPLINE' | 'ABSENCE'; in: number; out: number }[];
  net: number; paid: { source: string; amount: number }[]; paidTotal: number; unpaid: number; zero: number;
};

/** Nama kelompok pendapatan Ringkasan dari satu baris slip tersimpan. */
export function incomeLabelOf(line: Pick<SummaryLine, 'sourceKey' | 'lineKind' | 'label' | 'fund'>, kindLabels: Record<string, string>, bonusLabel: (kind: string) => string): string {
  if (line.sourceKey.startsWith('corr:') || line.sourceKey.startsWith('refund:')) return 'Koreksi plus dan pengembalian';
  if (line.sourceKey.startsWith('bonus:')) return `${bonusLabel(line.lineKind)}${line.fund ? ' (Dana Disiplin)' : ' (kantor)'}`;
  return kindLabels[line.lineKind] ?? line.label;
}

/**
 * Jumlah Ringkasan satu kelompok slip. Hanya slip Ditutup/Dibayar yang dijumlah (Perkiraan dan Tertahan hanya dihitung orangnya).
 * Selalu: pendapatan − terpotong = bersih = dibayar + belum dibayar (+ Rp0 tanpa uang).
 */
export function summarize(
  slips: readonly SummarySlip[], funds: readonly { fund: 'DISCIPLINE' | 'ABSENCE'; amount: number }[],
  kindLabels: Record<string, string>, bonusLabel: (kind: string) => string,
): SummaryTotals {
  const counts = { ESTIMATE: 0, HELD: 0, CLOSED: 0, PAID: 0 };
  const income = new Map<string, number>();
  const taken = new Map<DeductionGroup, number>();
  const paid = new Map<string, number>();
  let carried = 0, uncollectible = 0, receivables = 0, net = 0, unpaid = 0, zero = 0, incomeTotal = 0, takenTotal = 0;
  for (const s of slips) {
    counts[s.status] += 1;
    if (s.status !== 'CLOSED' && s.status !== 'PAID') continue;
    incomeTotal += s.income;
    takenTotal += s.taken;
    net += s.net;
    carried += s.carried;
    for (const l of s.lines) {
      if (l.section === 'INCOME') {
        const key = incomeLabelOf(l, kindLabels, bonusLabel);
        income.set(key, (income.get(key) ?? 0) + l.amount);
      } else if (l.section === 'DEDUCTION' && l.group) {
        const g = l.group as DeductionGroup;
        taken.set(g, (taken.get(g) ?? 0) + l.taken);
        if (s.lastSlip && l.remaining > 0) {
          if (g === 'b' || g === 'c') receivables += l.remaining;
          else uncollectible += l.remaining;
        }
      }
    }
    if (s.payment?.kind === 'MONEY') {
      const src = s.payment.source ?? '-';
      paid.set(src, (paid.get(src) ?? 0) + s.net);
    } else if (s.payment?.kind === 'NO_MONEY') {
      zero += 1;
    } else {
      unpaid += s.net;
    }
  }
  const fundTotals = (['DISCIPLINE', 'ABSENCE'] as const).map((fund) => ({
    fund,
    in: funds.filter((f) => f.fund === fund && f.amount > 0).reduce((a, f) => a + f.amount, 0),
    out: funds.filter((f) => f.fund === fund && f.amount < 0).reduce((a, f) => a - f.amount, 0),
  }));
  const paidList = [...paid].map(([source, amount]) => ({ source, amount })).sort((a, b) => a.source.localeCompare(b.source));
  return {
    counts,
    income: [...income].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount),
    incomeTotal,
    taken: (['a', 'b', 'c', 'd'] as const).map((group) => ({ group, label: GROUP_LABELS[group], amount: taken.get(group) ?? 0 })),
    takenTotal,
    carried, uncollectible, receivables,
    funds: fundTotals,
    net, paid: paidList, paidTotal: paidList.reduce((a, p) => a + p.amount, 0), unpaid, zero,
  };
}
