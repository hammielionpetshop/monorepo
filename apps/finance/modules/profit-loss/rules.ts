import Big from 'big.js';

/**
 * Laba Rugi bersih F2-6b (spec docs/work/specs/2026-11-12-f2-6b-laba-rugi-design.md §2): kolom tiap cabang kasir,
 * Kantor (biaya Bersama / tanpa cabang), Gabungan = jumlah cabang − Kantor. Rumus murni; pembacanya di sources.ts.
 */

/** Bulan pertama Laba Rugi (§0 butir 8). */
export const FIRST_MONTH = '2026-11';

export type CostGroup = 'CATEGORY' | 'PAYROLL' | 'UNLOADING' | 'FUEL' | 'VEHICLE_RENTAL';

/** Penjualan per cabang, setara BO › Laporan Laba Rugi (getProfitLossReport). */
export type SalesRow = {
  branchId: number;
  /** Penjualan kotor nota COMPLETED (payable_amount). */
  sales: number;
  /** Retur penjualan dalam bulan (refund). */
  returns: number;
  /** Koreksi omzet pengirim karena Revisi Harga Beli kiriman internal. */
  revisionRevenue: number;
  cogs: number;
  returnCogs: number;
  damaged: number;
  /** Penyesuaian Modal: positif = modal turun (laba naik). */
  costAdjustment: number;
};

/** Satu catatan biaya / pendapatan lain yang ditanggung satu cabang (null = Kantor). */
export type CostItem = {
  branchId: number | null;
  group: CostGroup;
  /** COST mengurangi laba, INCOME (pendapatan lain) menambah. */
  kind: 'COST' | 'INCOME';
  /** Nama kategori Arus Kas (group CATEGORY). */
  category: string | null;
  amount: number;
  date: string;
  label: string;
  source: 'BO' | 'HRIS' | 'LOGISTIK';
  ref: string;
  /** Biaya Rutin belum dibayar: dihitung sebesar tagihan (§0 butir 5). */
  unpaidBill?: boolean;
};

export type Column = { key: string; branchId: number | null; name: string };

export const OFFICE_KEY = 'office';
export const TOTAL_KEY = 'total';

export const GROUP_LABEL: Record<Exclude<CostGroup, 'CATEGORY'>, string> = {
  PAYROLL: 'Gaji',
  UNLOADING: 'Bongkaran',
  FUEL: 'Bensin',
  VEHICLE_RENTAL: 'Sewa mobil',
};

export function columnKey(branchId: number | null): string {
  return branchId == null ? OFFICE_KEY : `b${branchId}`;
}

export function isMonth(v: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

/** Tanggal pertama & terakhir bulan YYYY-MM. */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Bulan Laba Rugi sebuah slip gaji (§0 butir 1): slip bulanan 26 bulan lalu–25 = bulan akhir periode;
 * slip mingguan = bulan hari terakhirnya.
 */
export function payslipMonth(kind: string, periodStart: string, periodEnd: string | null): string {
  if (kind === 'MONTHLY' || !periodEnd) return addMonths(periodStart.slice(0, 7), 1);
  return periodEnd.slice(0, 7);
}

export type Line = {
  key: string;
  label: string;
  /** Baris hasil (laba kotor, laba bersih) tampil tebal. */
  total?: boolean;
  /** Tanda depan: '−' biaya, '+' pendapatan, '±' penyesuaian. */
  sign?: '−' | '+' | '±' | '=';
  /** Kelompok biaya/pendapatan untuk rincian. */
  group?: CostGroup;
  category?: string | null;
  kind?: 'COST' | 'INCOME';
  values: Record<string, number>;
};

export type ProfitLoss = {
  columns: Column[];
  lines: Line[];
  /** Penjualan ke cabang sendiri yang dikeluarkan dari Gabungan (§0 butir 7). */
  internalSales: number;
};

const add = (rec: Record<string, number>, key: string, v: number) => {
  rec[key] = new Big(rec[key] ?? 0).plus(v).toNumber();
};

/**
 * Susun tabel Laba Rugi. Kolom cabang = cabang aktif + cabang lain yang punya angka bulan itu; Kantor hanya biaya
 * & pendapatan lain tanpa cabang. Gabungan = Σ cabang − Kantor (biaya Kantor dikurangkan, pendapatan Kantor
 * ditambahkan); penjualan internal dikeluarkan dari Penjualan & Harga pokok Gabungan dengan jumlah sama.
 */
export function buildProfitLoss(input: {
  branches: { id: number; name: string; isActive: boolean }[];
  sales: SalesRow[];
  costs: CostItem[];
  internalSales: number;
}): ProfitLoss {
  const used = new Set<number>([...input.sales.map((s) => s.branchId), ...input.costs.flatMap((c) => (c.branchId == null ? [] : [c.branchId]))]);
  const branchCols: Column[] = input.branches
    .filter((b) => b.isActive || used.has(b.id))
    .map((b) => ({ key: columnKey(b.id), branchId: b.id, name: b.name }));
  const columns: Column[] = [...branchCols, { key: OFFICE_KEY, branchId: null, name: 'Kantor' }, { key: TOTAL_KEY, branchId: null, name: 'Gabungan' }];
  const known = new Set(branchCols.map((c) => c.key));

  const netSales: Record<string, number> = {};
  const cogs: Record<string, number> = {};
  const damaged: Record<string, number> = {};
  const adjustment: Record<string, number> = {};
  for (const s of input.sales) {
    const k = columnKey(s.branchId);
    if (!known.has(k)) continue;
    add(netSales, k, new Big(s.sales).minus(s.returns).minus(s.revisionRevenue).toNumber());
    add(cogs, k, new Big(s.cogs).minus(s.returnCogs).toNumber());
    add(damaged, k, s.damaged);
    add(adjustment, k, s.costAdjustment);
  }

  // Baris biaya: kategori Arus Kas (urut nama) lalu Gaji · Bongkaran · Bensin · Sewa mobil; pendapatan lain per kategori.
  const costLines = new Map<string, Line>();
  const incomeLines = new Map<string, Line>();
  for (const c of input.costs) {
    const target = c.kind === 'COST' ? costLines : incomeLines;
    const id = c.group === 'CATEGORY' ? `cat:${c.category ?? ''}` : c.group;
    const lineKey = `${c.kind === 'COST' ? 'cost' : 'income'}:${id}`;
    let line = target.get(lineKey);
    if (!line) {
      line = {
        key: lineKey,
        label: c.group === 'CATEGORY' ? (c.category ?? 'Tanpa kategori') : GROUP_LABEL[c.group],
        sign: c.kind === 'COST' ? '−' : '+',
        group: c.group,
        category: c.category,
        kind: c.kind,
        values: {},
      };
      target.set(lineKey, line);
    }
    add(line.values, columnKey(c.branchId), c.amount);
  }
  const groupOrder: CostGroup[] = ['CATEGORY', 'PAYROLL', 'UNLOADING', 'FUEL', 'VEHICLE_RENTAL'];
  const sortLines = (ls: Line[]) =>
    ls.sort((a, b) => groupOrder.indexOf(a.group!) - groupOrder.indexOf(b.group!) || a.label.localeCompare(b.label, 'id'));
  const costList = sortLines([...costLines.values()]);
  const incomeList = sortLines([...incomeLines.values()]);

  const totalOf = (rec: Record<string, number>) => branchCols.reduce((s, c) => s.plus(rec[c.key] ?? 0), new Big(0));

  // Gabungan per baris: Σ cabang, dan untuk biaya/pendapatan juga Kantor.
  const withTotal = (rec: Record<string, number>, includeOffice: boolean, minus = 0) => {
    rec[TOTAL_KEY] = totalOf(rec).plus(includeOffice ? (rec[OFFICE_KEY] ?? 0) : 0).minus(minus).toNumber();
    return rec;
  };
  withTotal(netSales, false, input.internalSales);
  withTotal(cogs, false, input.internalSales);
  withTotal(damaged, false);
  withTotal(adjustment, false);
  for (const l of [...costList, ...incomeList]) withTotal(l.values, true);

  const allKeys = columns.map((c) => c.key);
  const gross: Record<string, number> = {};
  const totalCost: Record<string, number> = {};
  const net: Record<string, number> = {};
  for (const k of allKeys) {
    if (k === OFFICE_KEY) {
      gross[k] = 0;
    } else {
      gross[k] = new Big(netSales[k] ?? 0).minus(cogs[k] ?? 0).toNumber();
    }
    const costs = costList.reduce((s, l) => s.plus(l.values[k] ?? 0), new Big(0));
    const incomes = incomeList.reduce((s, l) => s.plus(l.values[k] ?? 0), new Big(0));
    totalCost[k] = costs.toNumber();
    net[k] = new Big(gross[k]).minus(damaged[k] ?? 0).plus(adjustment[k] ?? 0).minus(costs).plus(incomes).toNumber();
  }

  const lines: Line[] = [
    { key: 'sales', label: 'Penjualan bersih', values: netSales },
    { key: 'cogs', label: 'Harga pokok', sign: '−', values: cogs },
    { key: 'gross', label: 'Laba kotor', sign: '=', total: true, values: gross },
    { key: 'damaged', label: 'Barang rusak', sign: '−', values: damaged },
    { key: 'adjustment', label: 'Penyesuaian Modal', sign: '±', values: adjustment },
    ...costList,
    { key: 'cost-total', label: 'Jumlah biaya', sign: '−', total: true, values: totalCost },
    ...incomeList,
    { key: 'net', label: 'Laba bersih', sign: '=', total: true, values: net },
  ];
  return { columns, lines, internalSales: input.internalSales };
}

/** Angka satu sel; sel kosong = 0. */
export function cell(line: Line, key: string): number {
  return line.values[key] ?? 0;
}
