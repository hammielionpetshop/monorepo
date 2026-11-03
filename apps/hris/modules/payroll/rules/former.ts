import { PAYSLIP_FROM } from './payslip';
import { addPeriods, periodStartOf, type IsoDate } from './salary';
import { dayEndWib } from './slip-objection';

// L4g-3 (spec L4g §3.7–3.8): urusan uang mantan karyawan dan Total Diterima per Orang. Aturan murni, tanpa DB.

export type MoneyMatterFacts = {
  /** Periode hari terakhir bekerja; null bila sebelum slip pertama HRIS. */
  lastPeriod: IsoDate | null;
  /** Slip bulanan sampai periode terakhir. `paidAt` = saat ditandai Dibayar (pembayaran aktif), termasuk tanpa uang. */
  slips: readonly { periodStart: IsoDate; status: 'ESTIMATE' | 'CLOSED'; paidAt: Date | null }[];
  /** Keberatan slip Menunggu atau "menunggu pembetulan". */
  openObjections: number;
  /** Tagihan bayar di luar slip yang Menunggu bayar. */
  waitingClaims: number;
};

/** Hari sesudah ditandai Dibayar yang masih dihitung urusan (sama dengan masa "uang belum saya terima"). */
export const FORMER_PAID_DAYS = 7;

/**
 * `hasMoneyMatters` (spec L4g §3.7): slip terakhir belum Dibayar, atau Dibayar belum lewat 23.59 hari ke-7, atau keberatan
 * slip Menunggu / menunggu pembetulan, atau tagihan bayar di luar slip Menunggu bayar.
 */
export function moneyMattersFrom(f: MoneyMatterFacts, now: Date): boolean {
  if (f.openObjections > 0 || f.waitingClaims > 0) return true;
  const relevant = f.slips.filter((s) => s.periodStart >= PAYSLIP_FROM && (!f.lastPeriod || s.periodStart <= f.lastPeriod));
  if (f.lastPeriod && !relevant.some((s) => s.periodStart === f.lastPeriod)) return true;
  if (relevant.some((s) => s.status !== 'CLOSED' || !s.paidAt)) return true;
  const latest = relevant.reduce<Date | null>((max, s) => (s.paidAt && (!max || s.paidAt > max) ? s.paidAt : max), null);
  return latest != null && now <= dayEndWib(latest, FORMER_PAID_DAYS);
}

/** Periode hari terakhir bekerja dari tanggal mulai nonaktif; null bila sebelum slip pertama HRIS. */
export function lastPeriodOf(lastWorkingDay: IsoDate): IsoDate | null {
  const period = periodStartOf(lastWorkingDay);
  return period >= PAYSLIP_FROM ? period : null;
}

// ---- Total Diterima per Orang (GAJ-114) ----

export const TOTALS_MAX_PERIODS = 12;

export type TotalsRange = { from: IsoDate; to: IsoDate; periods: IsoDate[] };

const isPeriod = (v: unknown): v is IsoDate => typeof v === 'string' && /^\d{4}-\d{2}-26$/.test(v);

/**
 * Rentang 1–12 periode. Bawaan: periode terakhir yang sudah ditutup (`fallback`). Masukan tak sah → bawaan;
 * terbalik → ditukar; lebih dari 12 → dipotong dari `to` mundur 12 periode.
 */
export function totalsRange(input: { from?: string | null; to?: string | null }, fallback: IsoDate, latest: IsoDate): TotalsRange {
  let to = isPeriod(input.to) && input.to >= PAYSLIP_FROM && input.to <= latest ? input.to : fallback;
  let from = isPeriod(input.from) && input.from >= PAYSLIP_FROM && input.from <= latest ? input.from : to;
  if (from > to) [from, to] = [to, from];
  const periods: IsoDate[] = [];
  for (let p = to; p >= from && periods.length < TOTALS_MAX_PERIODS; p = addPeriods(p, -1)) periods.unshift(p);
  return { from: periods[0], to, periods };
}

export type TotalsSlip = { employeeId: number; periodStart: IsoDate; net: number; paid: boolean };
export type TotalsClaim = { employeeId: number; periodStart: IsoDate; amount: number; paid: boolean };
export type TotalsRow = { employeeId: number; slipMonthly: number; offSlip: number; received: number; pending: number; total: number };

/** Satu baris per orang: slip bulanan Ditutup + bayar di luar slip. Diterima + Belum dibayar = Jumlah. Slip Perkiraan tidak ikut. */
export function totalsFrom(slips: readonly TotalsSlip[], claims: readonly TotalsClaim[]): TotalsRow[] {
  const rows = new Map<number, TotalsRow>();
  const rowOf = (id: number) => {
    let row = rows.get(id);
    if (!row) rows.set(id, (row = { employeeId: id, slipMonthly: 0, offSlip: 0, received: 0, pending: 0, total: 0 }));
    return row;
  };
  for (const s of slips) {
    const row = rowOf(s.employeeId);
    row.slipMonthly += s.net;
    if (s.paid) row.received += s.net; else row.pending += s.net;
  }
  for (const c of claims) {
    const row = rowOf(c.employeeId);
    row.offSlip += c.amount;
    if (c.paid) row.received += c.amount; else row.pending += c.amount;
  }
  for (const row of rows.values()) row.total = row.slipMonthly + row.offSlip;
  return [...rows.values()];
}

/** Jumlah semua baris (kaki tabel dan baris akhir CSV). */
export function totalsSum(rows: readonly TotalsRow[]): Omit<TotalsRow, 'employeeId'> {
  return rows.reduce((sum, r) => ({
    slipMonthly: sum.slipMonthly + r.slipMonthly, offSlip: sum.offSlip + r.offSlip, received: sum.received + r.received,
    pending: sum.pending + r.pending, total: sum.total + r.total,
  }), { slipMonthly: 0, offSlip: 0, received: 0, pending: 0, total: 0 });
}

const csvCell = (value: string) => (/[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/** CSV Total Diterima (§9 butir 7, bentuk Daftar Transfer): titik koma, mingguan & bongkaran "—" sampai L7. */
export function totalsCsv(
  rows: readonly (TotalsRow & { name: string; code: string; branchName: string; positionName: string; former: boolean })[],
  meta: { range: string; madeBy: string; madeAt: string },
): string {
  const sum = totalsSum(rows);
  const lines = [
    'sep=;',
    [`Total Diterima per Orang ${meta.range}`, `dibuat ${meta.madeBy}`, meta.madeAt].map(csvCell).join(';'),
    ['Kode', 'Nama', 'Cabang', 'Jabatan', 'Status', 'Slip bulanan', 'Slip mingguan', 'Bongkaran', 'Bayar di luar slip', 'Diterima', 'Belum dibayar', 'Jumlah'].join(';'),
    ...rows.map((r) => [
      csvCell(r.code), csvCell(r.name), csvCell(r.branchName), csvCell(r.positionName), r.former ? 'Mantan' : 'Aktif',
      String(r.slipMonthly), '—', '—', String(r.offSlip), String(r.received), String(r.pending), String(r.total),
    ].join(';')),
    ['Jumlah', '', '', '', '', String(sum.slipMonthly), '—', '—', String(sum.offSlip), String(sum.received), String(sum.pending), String(sum.total)].join(';'),
  ];
  return `${lines.join('\r\n')}\r\n`;
}
