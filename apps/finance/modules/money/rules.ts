import Big from 'big.js';

/**
 * Aturan murni Saldo Tempat Uang & Arus Uang (spec docs/work/specs/2026-11-12-f2-6-modul-finance-design.md §3).
 * Semua uang bilangan bulat rupiah; dijumlah dengan big.js lalu dikembalikan sebagai number.
 */

/** Tanggal mulai hitungan saldo semua Tempat Uang (keputusan owner 2026-11-12). */
export const START_DATE = '2026-11-01';

export type Source = 'BO' | 'HRIS' | 'LOGISTIK';

/** Jenis baris uang. Pindahan antar tempat dipisah dari masuk/keluar. */
export type LineKind =
  | 'CASH_DEPOSIT' // setoran tunai terverifikasi (masuk)
  | 'NONCASH' // non-tunai cair (masuk)
  | 'CASHFLOW_IN' // Arus Kas uang masuk
  | 'ADVANCE_REPAY' // pelunasan kasbon tunai (masuk)
  | 'UNLOADING_REFUND' // uang kembali lebih bayar bongkaran (masuk)
  | 'CASHFLOW_OUT' // Arus Kas uang keluar (termasuk Biaya Rutin)
  | 'SUPPLIER' // bayar supplier
  | 'PAYROLL' // gaji & tagihan luar slip
  | 'ADVANCE' // kasbon diserahkan
  | 'UNLOADING' // bayar bongkaran
  | 'VEHICLE_RENTAL' // sewa mobil
  | 'TRANSFER_IN' // pindah dana masuk
  | 'TRANSFER_OUT'; // pindah dana keluar

export const KIND_LABELS: Record<LineKind, string> = {
  CASH_DEPOSIT: 'Setoran tunai',
  NONCASH: 'Non-tunai cair',
  CASHFLOW_IN: 'Arus Kas masuk',
  ADVANCE_REPAY: 'Pelunasan kasbon tunai',
  UNLOADING_REFUND: 'Uang kembali bongkaran',
  CASHFLOW_OUT: 'Arus Kas keluar',
  SUPPLIER: 'Bayar supplier',
  PAYROLL: 'Gaji',
  ADVANCE: 'Kasbon',
  UNLOADING: 'Bongkaran',
  VEHICLE_RENTAL: 'Sewa mobil',
  TRANSFER_IN: 'Pindah dana masuk',
  TRANSFER_OUT: 'Pindah dana keluar',
};

export const IN_KINDS: LineKind[] = ['CASH_DEPOSIT', 'NONCASH', 'CASHFLOW_IN', 'ADVANCE_REPAY', 'UNLOADING_REFUND'];
export const OUT_KINDS: LineKind[] = ['SUPPLIER', 'CASHFLOW_OUT', 'PAYROLL', 'ADVANCE', 'UNLOADING', 'VEHICLE_RENTAL'];
export const TRANSFER_KINDS: LineKind[] = ['TRANSFER_IN', 'TRANSFER_OUT'];

/**
 * Satu baris uang pada satu Tempat Uang. `amount` bertanda: + masuk, − keluar. Pembalikan (mis. setoran
 * dikoreksi) memakai tanda kebalikan baris asalnya, jadi keduanya saling meniadakan di jumlah.
 */
export type MoneyLine = {
  placeId: number;
  date: string; // YYYY-MM-DD, tanggal uang
  amount: number;
  kind: LineKind;
  /** Rincian dalam jenis, mis. nama kategori Arus Kas. */
  group: string | null;
  label: string;
  source: Source;
  /** Kunci unik baris untuk tampilan & tautan, mis. `cf:12`. */
  ref: string;
};

export type Place = {
  id: number;
  name: string;
  kind: 'CASH' | 'BANK';
  branchId: number;
  branchName: string;
  heldBy: string;
  isActive: boolean;
  /** null = saldo awal belum diisi (dihitung 0). */
  opening: number | null;
};

const sum = (values: number[]) => values.reduce((acc, v) => acc.plus(v), new Big(0));

/** Baris yang ikut hitungan s.d. tanggal `to` (inklusif), mulai START_DATE. */
export function linesUntil(lines: MoneyLine[], to: string): MoneyLine[] {
  return lines.filter((l) => l.date >= START_DATE && l.date <= to);
}

export type PlaceBalance = {
  place: Place;
  opening: number;
  inTotal: number;
  outTotal: number;
  transferNet: number;
  balance: number;
};

/** Saldo = saldo awal + masuk − keluar ± pindahan, dengan tanggal uang START_DATE..to. */
export function placeBalance(place: Place, lines: MoneyLine[], to: string): PlaceBalance {
  const mine = linesUntil(lines, to).filter((l) => l.placeId === place.id);
  const inTotal = sum(mine.filter((l) => IN_KINDS.includes(l.kind)).map((l) => l.amount));
  const outTotal = sum(mine.filter((l) => OUT_KINDS.includes(l.kind)).map((l) => -l.amount));
  const transferNet = sum(mine.filter((l) => TRANSFER_KINDS.includes(l.kind)).map((l) => l.amount));
  const opening = place.opening ?? 0;
  const balance = new Big(opening).plus(inTotal).minus(outTotal).plus(transferNet);
  return {
    place, opening, inTotal: inTotal.toNumber(), outTotal: outTotal.toNumber(), transferNet: transferNet.toNumber(),
    balance: balance.toNumber(),
  };
}

export type BranchGroup = { branchId: number; branchName: string; rows: PlaceBalance[]; total: number };

/**
 * Daftar Saldo per cabang pemilik. Tempat nonaktif tetap tampil bila saldonya bukan 0 atau ada baris di periode.
 */
export function balanceBoard(places: Place[], lines: MoneyLine[], to: string): { groups: BranchGroup[]; total: number } {
  const rows = places
    .map((p) => placeBalance(p, lines, to))
    .filter((r) => r.place.isActive || r.balance !== 0 || r.inTotal !== 0 || r.outTotal !== 0 || r.transferNet !== 0);
  const map = new Map<number, BranchGroup>();
  for (const r of rows) {
    const g = map.get(r.place.branchId) ?? { branchId: r.place.branchId, branchName: r.place.branchName, rows: [], total: 0 };
    g.rows.push(r);
    map.set(r.place.branchId, g);
  }
  const groups = [...map.values()]
    .map((g) => ({ ...g, total: sum(g.rows.map((r) => r.balance)).toNumber() }))
    .sort((a, b) => a.branchName.localeCompare(b.branchName, 'id'));
  return { groups, total: sum(groups.map((g) => g.total)).toNumber() };
}

export type LedgerRow = MoneyLine & { running: number };

/** Mutasi satu tempat dalam periode, urut tanggal, dengan saldo berjalan dan saldo awal periode. */
export function ledger(place: Place, lines: MoneyLine[], from: string, to: string): { startBalance: number; rows: LedgerRow[]; endBalance: number } {
  const start = from < START_DATE ? START_DATE : from;
  const before = placeBalance(place, lines, previousDay(start)).balance;
  const startBalance = start === START_DATE ? (place.opening ?? 0) : before;
  const mine = lines
    .filter((l) => l.placeId === place.id && l.date >= start && l.date <= to)
    .sort((a, b) => (a.date === b.date ? a.ref.localeCompare(b.ref) : a.date.localeCompare(b.date)));
  let running = new Big(startBalance);
  const rows = mine.map((l) => {
    running = running.plus(l.amount);
    return { ...l, running: running.toNumber() };
  });
  return { startBalance, rows, endBalance: running.toNumber() };
}

export type FlowItem = { kind: LineKind; group: string | null; amount: number; count: number };

export type FlowReport = {
  opening: number;
  inItems: FlowItem[];
  inTotal: number;
  outItems: FlowItem[];
  outTotal: number;
  transferIn: number;
  transferOut: number;
  closing: number;
};

/**
 * Arus Uang satu bulan untuk sekumpulan tempat (Gabungan / satu cabang / satu tempat). Pindahan antar tempat di
 * dalam kumpulan yang sama saling meniadakan; pindahan dari/ke luar kumpulan tampil sebagai pindahan masuk/keluar.
 * Penutup = pembuka + masuk − keluar + pindahan masuk − pindahan keluar (sama dengan Saldo akhir bulan).
 */
export function flowReport(places: Place[], lines: MoneyLine[], month: string): FlowReport {
  const from = month < START_DATE ? START_DATE : month;
  const to = lastDayOfMonth(month);
  const ids = new Set(places.map((p) => p.id));
  const opening = sum(places.map((p) => (from === START_DATE ? (p.opening ?? 0) : placeBalance(p, lines, previousDay(from)).balance))).toNumber();
  const inPeriod = lines.filter((l) => ids.has(l.placeId) && l.date >= from && l.date <= to);

  const group = (kinds: LineKind[], sign: 1 | -1): FlowItem[] => {
    const map = new Map<string, FlowItem>();
    for (const l of inPeriod.filter((x) => kinds.includes(x.kind))) {
      const key = `${l.kind}|${l.group ?? ''}`;
      const item = map.get(key) ?? { kind: l.kind, group: l.group, amount: 0, count: 0 };
      item.amount = new Big(item.amount).plus(sign * l.amount).toNumber();
      item.count += 1;
      map.set(key, item);
    }
    return [...map.values()].filter((i) => i.amount !== 0 || i.count > 0).sort((a, b) => b.amount - a.amount);
  };

  const inItems = group(IN_KINDS, 1);
  const outItems = group(OUT_KINDS, -1);
  // Pindahan: hitung per pasangan (ref sama) — bila kedua sisi di dalam kumpulan, tidak dihitung.
  const transfers = inPeriod.filter((l) => TRANSFER_KINDS.includes(l.kind));
  const refsInside = new Map<string, number>();
  for (const t of transfers) refsInside.set(t.ref, (refsInside.get(t.ref) ?? 0) + 1);
  const external = transfers.filter((t) => refsInside.get(t.ref) === 1);
  const transferIn = sum(external.filter((t) => t.kind === 'TRANSFER_IN').map((t) => t.amount)).toNumber();
  const transferOut = sum(external.filter((t) => t.kind === 'TRANSFER_OUT').map((t) => -t.amount)).toNumber();
  const inTotal = sum(inItems.map((i) => i.amount)).toNumber();
  const outTotal = sum(outItems.map((i) => i.amount)).toNumber();
  const closing = new Big(opening).plus(inTotal).minus(outTotal).plus(transferIn).minus(transferOut).toNumber();
  return { opening, inItems, inTotal, outItems, outTotal, transferIn, transferOut, closing };
}

export function previousDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** `month` = YYYY-MM-01. */
export function lastDayOfMonth(month: string): string {
  const d = new Date(`${month.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
}

/** Hari ini menurut WIB, YYYY-MM-DD. */
export function todayWib(now = new Date()): string {
  return new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

export function isDate(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}
