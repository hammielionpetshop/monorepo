import Big from 'big.js';

/**
 * Jembatan Laba bersih → Setoran bebas F2-6c-2 (spec docs/work/specs/2026-11-12-f2-6c-2-setoran-bebas-vs-laba-design.md §1–§2).
 * Rumus murni: setiap baris dijumlah dari catatan sumbernya (BridgeItem, nilai = pengaruhnya pada uang, bertanda),
 * Selisih belum terjelaskan = Setoran bebas − (Laba bersih + Σ baris). Pembacanya di sources.ts.
 */

export type BridgeGroup = 'A' | 'B' | 'C' | 'D';

export type BridgeLineKey =
  | 'goods' | 'settled'
  | 'costs-elsewhere' | 'cashier-costs' | 'other-income'
  | 'internal-sales' | 'receivables' | 'cashier-expenses' | 'variances' | 'cash-undeposited' | 'cash-prior'
  | 'noncash-pending' | 'noncash-before-start' | 'non-finance'
  | 'received' | 'legacy';

export const LINE_DEFS: { key: BridgeLineKey; group: BridgeGroup; label: string }[] = [
  { key: 'goods', group: 'A', label: 'Harga pokok, barang rusak, penyesuaian modal (bukan uang keluar dari setoran)' },
  { key: 'settled', group: 'A', label: 'Pelunasan utang belanja ke cabang lain dari setoran' },
  { key: 'costs-elsewhere', group: 'B', label: 'Biaya yang dibayar dari tempat lain' },
  { key: 'cashier-costs', group: 'B', label: 'Pengeluaran Kasir yang sudah jadi biaya di Laba Rugi (dipindah ke baris C)' },
  { key: 'other-income', group: 'B', label: 'Pendapatan lain (masuk lewat Arus Kas, bukan setoran)' },
  { key: 'internal-sales', group: 'C', label: 'Penjualan ke cabang lain (dibayar lewat utang internal)' },
  { key: 'receivables', group: 'C', label: 'Piutang pelanggan bertambah (nota kredit − pelunasan piutang)' },
  { key: 'cashier-expenses', group: 'C', label: 'Pengeluaran Kasir dari laci' },
  { key: 'variances', group: 'C', label: 'Selisih kas shift & selisih setoran' },
  { key: 'cash-undeposited', group: 'C', label: 'Tunai shift bulan ini belum disetor / menunggu verifikasi / disetor bulan depan' },
  { key: 'cash-prior', group: 'C', label: 'Tunai shift bulan lalu yang disetor bulan ini' },
  { key: 'noncash-pending', group: 'C', label: 'Non-tunai belum diverifikasi / belum cair' },
  { key: 'noncash-before-start', group: 'C', label: 'Non-tunai sebelum Setoran non-tunai berlaku' },
  { key: 'non-finance', group: 'C', label: 'Setoran ke Tempat Uang yang tidak dipegang Finance' },
  { key: 'received', group: 'D', label: 'Uang setoran cabang lain yang diteruskan ke cabang ini' },
  { key: 'legacy', group: 'D', label: 'Pelunasan susulan memakai setoran bulan-bulan lalu' },
];

export const GROUP_LABEL: Record<BridgeGroup, string> = {
  A: 'A. Barang',
  B: 'B. Biaya & pendapatan di luar setoran',
  C: 'C. Penjualan yang belum jadi setoran terverifikasi',
  D: 'D. Utang internal & rantai',
};

/** Satu catatan asal sebuah baris. `amount` = pengaruhnya pada uang setoran (minus = mengurangi). branchId null = Kantor. */
export type BridgeItem = {
  branchId: number | null;
  line: BridgeLineKey;
  amount: number;
  date: string;
  label: string;
  ref: string;
};

/** Angka per cabang dari Laba Rugi F2-6b dan Utang Antar Cabang F2-6c-1 (dipakai apa adanya). */
export type BranchBase = { branchId: number; name: string; net: number; netSales: number; free: number };

export type Column = { key: string; branchId: number | null; name: string };
export const TOTAL_KEY = 'total';
export const columnKey = (branchId: number) => `b${branchId}`;

export type Level = 'ok' | 'yellow' | 'red';

/** Batas warna Selisih belum terjelaskan (§0 butir 4). */
export const YELLOW_MIN = 100_000;
export const YELLOW_RATIO = 0.01;
export const RED_RATIO = 0.05;

export function unexplainedLevel(unexplained: number, netSales: number): Level {
  const abs = Math.abs(unexplained);
  const base = Math.abs(netSales);
  if (abs <= YELLOW_MIN) return 'ok';
  if (base === 0 || new Big(abs).gt(new Big(base).times(RED_RATIO))) return 'red';
  if (new Big(abs).gt(new Big(base).times(YELLOW_RATIO))) return 'yellow';
  return 'ok';
}

export type Bridge = {
  columns: Column[];
  net: Record<string, number>;
  netSales: Record<string, number>;
  lines: { key: BridgeLineKey; group: BridgeGroup; label: string; values: Record<string, number> }[];
  unexplained: Record<string, number>;
  free: Record<string, number>;
  levels: Record<string, Level>;
};

const plus = (rec: Record<string, number>, key: string, v: number) => {
  rec[key] = new Big(rec[key] ?? 0).plus(v).toNumber();
};

/**
 * Susun jembatan. Kolom = cabang + Gabungan (Kantor tidak menyetor: biaya/pendapatan Kantor masuk Gabungan sebagai
 * "dibayar dari tempat lain", §0 butir 5). Gabungan tiap baris = Σ cabang (+ Kantor). Baris nol di semua kolom disembunyikan.
 * `officeNet` = laba bersih kolom Kantor Laba Rugi (−biaya + pendapatan Kantor), ikut Laba bersih Gabungan.
 */
export function buildBridge(input: { bases: BranchBase[]; items: BridgeItem[]; officeNet: number; totalNetSales: number }): Bridge {
  const branchCols: Column[] = input.bases.map((b) => ({ key: columnKey(b.branchId), branchId: b.branchId, name: b.name }));
  const columns: Column[] = [...branchCols, { key: TOTAL_KEY, branchId: null, name: 'Gabungan' }];
  const known = new Set(branchCols.map((c) => c.key));

  const net: Record<string, number> = {};
  const netSales: Record<string, number> = {};
  const free: Record<string, number> = {};
  for (const b of input.bases) {
    const k = columnKey(b.branchId);
    net[k] = b.net;
    netSales[k] = b.netSales;
    free[k] = b.free;
    plus(net, TOTAL_KEY, b.net);
    plus(free, TOTAL_KEY, b.free);
  }
  plus(net, TOTAL_KEY, input.officeNet);
  netSales[TOTAL_KEY] = input.totalNetSales;

  const values = new Map<BridgeLineKey, Record<string, number>>(LINE_DEFS.map((d) => [d.key, {}]));
  for (const it of input.items) {
    const rec = values.get(it.line)!;
    if (it.branchId != null) {
      const k = columnKey(it.branchId);
      if (!known.has(k)) continue;
      plus(rec, k, it.amount);
    }
    plus(rec, TOTAL_KEY, it.amount);
  }

  const lines = LINE_DEFS.map((d) => ({ ...d, values: values.get(d.key)! })).filter((l) =>
    columns.some((c) => (l.values[c.key] ?? 0) !== 0),
  );

  const unexplained: Record<string, number> = {};
  const levels: Record<string, Level> = {};
  for (const c of columns) {
    const explained = lines.reduce((s, l) => s.plus(l.values[c.key] ?? 0), new Big(net[c.key] ?? 0));
    unexplained[c.key] = new Big(free[c.key] ?? 0).minus(explained).toNumber();
    levels[c.key] = unexplainedLevel(unexplained[c.key], netSales[c.key] ?? 0);
  }
  return { columns, net, netSales, lines, unexplained, free, levels };
}

export const value = (rec: Record<string, number>, key: string) => rec[key] ?? 0;

/** Catatan asal satu baris untuk satu kolom (rincian). */
export function itemsOf(items: BridgeItem[], line: BridgeLineKey, key: string): BridgeItem[] {
  return items
    .filter((i) => i.line === line && (key === TOTAL_KEY || (i.branchId != null && columnKey(i.branchId) === key)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label, 'id'));
}
