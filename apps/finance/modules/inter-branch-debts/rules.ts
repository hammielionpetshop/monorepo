import Big from 'big.js';

/**
 * Aturan murni Utang Antar Cabang & Setoran bebas (spec docs/work/specs/2026-11-12-f2-6c-utang-setoran-bebas-dana-belum-cair-design.md §2).
 * Uang bilangan bulat rupiah, dijumlah dengan big.js.
 */

/** Utang yang lahir sebelum tanggal ini = "utang lama" (pelunasan otomatis mulai 1 Nov 2026, spec F2-3 §10). */
export const AUTO_SETTLEMENT_START = '2026-11-01';
/** Batas umur merah, sama dengan bawaan BO › Utang Internal (`auto_settlement_settings.redAgeDays`). */
export const RED_AGE_DAYS = 30;

export type PaymentGroup = 'AUTO' | 'MANUAL' | 'RETURN';

/** Pengelompokan `inter_branch_payments.source_type`: otomatis dari Setoran/pelunasan susulan, manual, atau retur & saldo internal. */
export function paymentGroup(sourceType: string | null): PaymentGroup {
  if (sourceType == null || sourceType === 'BATAL_BAYAR') return 'MANUAL';
  if (['SETORAN', 'BATAL_SETORAN', 'SUSULAN', 'BATAL_SUSULAN'].includes(sourceType)) return 'AUTO';
  return 'RETURN';
}

export type Payable = {
  id: number;
  ibtNumber: string;
  debtorId: number;
  debtorName: string;
  creditorId: number;
  creditorName: string;
  total: number;
  /** `paid_amount` utang (sumber kebenaran sisa, sama dengan BO). */
  paid: number;
  status: 'UNPAID' | 'PARTIAL' | 'PAID' | 'WAIVED';
  bornOn: string; // YYYY-MM-DD WIB
  /** Tanggal terakhir diubah (WIB) — dipakai sebagai tanggal penghapusan untuk WAIVED. */
  updatedOn: string;
};

export type Payment = { payableId: number; date: string; amount: number; group: PaymentGroup };

const sum = (values: number[]) => values.reduce((acc, v) => acc.plus(v), new Big(0)).toNumber();

export const isOpen = (p: Payable) => p.status === 'UNPAID' || p.status === 'PARTIAL';
export const remainingOf = (p: Payable) => (isOpen(p) ? Math.max(p.total - p.paid, 0) : 0);
export const isLegacy = (p: Payable) => p.bornOn < AUTO_SETTLEMENT_START;

export function daysBetween(from: string, to: string): number {
  return Math.max(0, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000));
}

export type AgeBucket = 'D0_7' | 'D8_30' | 'D31';
export const AGE_LABELS: Record<AgeBucket, string> = { D0_7: '0–7 hari', D8_30: '8–30 hari', D31: '> 30 hari' };
export const ageBucket = (days: number): AgeBucket => (days <= 7 ? 'D0_7' : days <= 30 ? 'D8_30' : 'D31');

export type OpenDebt = Payable & {
  remaining: number;
  ageDays: number;
  bucket: AgeBucket;
  red: boolean;
  legacy: boolean;
  paidBy: Record<PaymentGroup, number>;
};

/** Tagihan terbuka beserta umur dan rincian yang sudah dibayar per kelompok. */
export function openDebts(payables: Payable[], payments: Payment[], today: string, redAgeDays = RED_AGE_DAYS): OpenDebt[] {
  const paidBy = new Map<number, Record<PaymentGroup, Big>>();
  for (const pay of payments) {
    const cur = paidBy.get(pay.payableId) ?? { AUTO: new Big(0), MANUAL: new Big(0), RETURN: new Big(0) };
    cur[pay.group] = cur[pay.group].plus(pay.amount);
    paidBy.set(pay.payableId, cur);
  }
  return payables
    .filter((p) => remainingOf(p) > 0)
    .map((p) => {
      const ageDays = daysBetween(p.bornOn, today);
      const g = paidBy.get(p.id);
      return {
        ...p,
        remaining: remainingOf(p),
        ageDays,
        bucket: ageBucket(ageDays),
        red: ageDays > redAgeDays,
        legacy: isLegacy(p),
        paidBy: { AUTO: g?.AUTO.toNumber() ?? 0, MANUAL: g?.MANUAL.toNumber() ?? 0, RETURN: g?.RETURN.toNumber() ?? 0 },
      };
    })
    .sort((a, b) => (a.bornOn === b.bornOn ? a.ibtNumber.localeCompare(b.ibtNumber) : a.bornOn.localeCompare(b.bornOn)));
}

export type CreditorPart = { creditorId: number; creditorName: string; remaining: number; count: number };

export type DebtorSummary = {
  debtorId: number;
  debtorName: string;
  remaining: number;
  count: number;
  oldestBornOn: string;
  oldestDays: number;
  red: boolean;
  buckets: Record<AgeBucket, number>;
  legacyRemaining: number;
  creditors: CreditorPart[];
};

/** Ringkasan per cabang yang berutang (urut sisa terbesar) dan total semua. */
export function debtorSummaries(debts: OpenDebt[]): { rows: DebtorSummary[]; total: number } {
  const map = new Map<number, OpenDebt[]>();
  for (const d of debts) map.set(d.debtorId, [...(map.get(d.debtorId) ?? []), d]);
  const rows = [...map.values()].map((list) => {
    const oldest = list.reduce((a, b) => (b.bornOn < a.bornOn ? b : a));
    const creditors = new Map<number, CreditorPart>();
    for (const d of list) {
      const c = creditors.get(d.creditorId) ?? { creditorId: d.creditorId, creditorName: d.creditorName, remaining: 0, count: 0 };
      c.remaining = new Big(c.remaining).plus(d.remaining).toNumber();
      c.count += 1;
      creditors.set(d.creditorId, c);
    }
    const bucket = (b: AgeBucket) => sum(list.filter((d) => d.bucket === b).map((d) => d.remaining));
    return {
      debtorId: list[0].debtorId,
      debtorName: list[0].debtorName,
      remaining: sum(list.map((d) => d.remaining)),
      count: list.length,
      oldestBornOn: oldest.bornOn,
      oldestDays: oldest.ageDays,
      red: list.some((d) => d.red),
      buckets: { D0_7: bucket('D0_7'), D8_30: bucket('D8_30'), D31: bucket('D31') },
      legacyRemaining: sum(list.filter((d) => d.legacy).map((d) => d.remaining)),
      creditors: [...creditors.values()].sort((a, b) => b.remaining - a.remaining),
    };
  });
  rows.sort((a, b) => b.remaining - a.remaining || a.debtorName.localeCompare(b.debtorName, 'id'));
  return { rows, total: sum(rows.map((r) => r.remaining)) };
}

/**
 * Sisa satu utang pada akhir tanggal `date`: total − pembayaran (termasuk pembalikan) s.d. tanggal itu; utang yang
 * dihapuskan (WAIVED) dianggap nol mulai tanggal terakhir diubah. Utang yang belum lahir = 0.
 */
export function remainingAt(p: Payable, payments: Payment[], date: string): number {
  if (p.bornOn > date) return 0;
  if (p.status === 'WAIVED' && p.updatedOn <= date) return 0;
  const paid = sum(payments.filter((x) => x.payableId === p.id && x.date <= date).map((x) => x.amount));
  return Math.max(p.total - paid, 0);
}

/** Akhir minggu (Minggu) dari minggu yang memuat `from`, lalu tiap Minggu sampai `today`; titik terakhir = hari ini. */
export function weekEnds(from: string, today: string): string[] {
  const d = new Date(`${from}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7));
  const out: string[] = [];
  while (d.toISOString().slice(0, 10) < today) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  out.push(today);
  return out;
}

export type TrendRow = { debtorId: number; debtorName: string; points: number[] };

/** Tren sisa utang per cabang di tiap titik (spec F2-6c §0 butir 4). Cabang tanpa sisa di semua titik tidak tampil. */
export function trend(payables: Payable[], payments: Payment[], points: string[]): { rows: TrendRow[]; totals: number[] } {
  const byPayable = new Map<number, Payment[]>();
  for (const pay of payments) byPayable.set(pay.payableId, [...(byPayable.get(pay.payableId) ?? []), pay]);
  const map = new Map<number, TrendRow>();
  for (const p of payables) {
    const own = byPayable.get(p.id) ?? [];
    const values = points.map((t) => remainingAt(p, own, t));
    const row = map.get(p.debtorId) ?? { debtorId: p.debtorId, debtorName: p.debtorName, points: points.map(() => 0) };
    row.points = row.points.map((v, i) => new Big(v).plus(values[i]).toNumber());
    map.set(p.debtorId, row);
  }
  const rows = [...map.values()].filter((r) => r.points.some((v) => v !== 0)).sort((a, b) => a.debtorName.localeCompare(b.debtorName, 'id'));
  const totals = points.map((_, i) => sum(rows.map((r) => r.points[i])));
  return { rows, totals };
}

/** Satu potongan alokasi `deposit_settlements` (spec F2-3 §5). `payableId` null = setoran bebas. */
export type SettlementPiece = {
  payerId: number;
  payerName: string;
  level: number;
  payableId: number | null;
  creditorId: number | null;
  creditorName: string | null;
  amount: number;
  /** Tanggal uang setoran asal (WIB). Pembalikan ikut tanggal asalnya. */
  date: string;
};

export type FreeDepositRow = {
  branchId: number;
  branchName: string;
  /** Setoran terverifikasi cabang ini sendiri (tingkat 1). */
  ownDeposits: number;
  /** Uang setoran cabang lain yang diteruskan ke cabang ini lewat rantai (tingkat ≥ 2). */
  received: number;
  /** Dipakai melunasi utang cabang ini, per pemasok. */
  settled: number;
  settledByCreditor: { creditorId: number; creditorName: string; amount: number }[];
  /** Sisa = setoran bebas. ownDeposits + received = settled + free. */
  free: number;
};

/** Setoran bebas per cabang untuk satu bulan (YYYY-MM), menurut tanggal uang setoran. */
export function freeDeposits(pieces: SettlementPiece[], month: string): { rows: FreeDepositRow[]; totalFree: number } {
  const inMonth = pieces.filter((p) => p.date.slice(0, 7) === month.slice(0, 7));
  const map = new Map<number, { name: string; own: Big; received: Big; settled: Big; free: Big; byCred: Map<number, { name: string; amount: Big }> }>();
  for (const p of inMonth) {
    const cur = map.get(p.payerId) ?? { name: p.payerName, own: new Big(0), received: new Big(0), settled: new Big(0), free: new Big(0), byCred: new Map() };
    if (p.level === 1) cur.own = cur.own.plus(p.amount);
    else cur.received = cur.received.plus(p.amount);
    if (p.payableId == null) cur.free = cur.free.plus(p.amount);
    else {
      cur.settled = cur.settled.plus(p.amount);
      const key = p.creditorId ?? 0;
      const c = cur.byCred.get(key) ?? { name: p.creditorName ?? '—', amount: new Big(0) };
      c.amount = c.amount.plus(p.amount);
      cur.byCred.set(key, c);
    }
    map.set(p.payerId, cur);
  }
  const rows = [...map.entries()]
    .map(([branchId, v]) => ({
      branchId,
      branchName: v.name,
      ownDeposits: v.own.toNumber(),
      received: v.received.toNumber(),
      settled: v.settled.toNumber(),
      settledByCreditor: [...v.byCred.entries()]
        .map(([creditorId, c]) => ({ creditorId, creditorName: c.name, amount: c.amount.toNumber() }))
        .filter((c) => c.amount !== 0)
        .sort((a, b) => b.amount - a.amount),
      free: v.free.toNumber(),
    }))
    .filter((r) => r.ownDeposits !== 0 || r.received !== 0 || r.settled !== 0 || r.free !== 0)
    .sort((a, b) => a.branchName.localeCompare(b.branchName, 'id'));
  return { rows, totalFree: sum(rows.map((r) => r.free)) };
}
