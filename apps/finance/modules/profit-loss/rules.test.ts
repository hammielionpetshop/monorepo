import { describe, expect, it } from 'vitest';
import { buildProfitLoss, cell, monthRange, OFFICE_KEY, payslipMonth, TOTAL_KEY, type CostItem, type SalesRow } from './rules';

const sale = (branchId: number, o: Partial<SalesRow> = {}): SalesRow => ({
  branchId, sales: 0, returns: 0, revisionRevenue: 0, cogs: 0, returnCogs: 0, damaged: 0, costAdjustment: 0, ...o,
});
const cost = (branchId: number | null, amount: number, o: Partial<CostItem> = {}): CostItem => ({
  branchId, amount, group: 'CATEGORY', kind: 'COST', category: 'Listrik', date: '2026-11-05', label: '', source: 'BO', ref: `x${Math.random()}`, ...o,
});
const branches = [{ id: 1, name: 'Toko A', isActive: true }, { id: 2, name: 'Gudang', isActive: true }];
const line = (pl: ReturnType<typeof buildProfitLoss>, key: string) => pl.lines.find((l) => l.key === key)!;

describe('Laba Rugi F2-6b', () => {
  it('susunan cabang: penjualan bersih − harga pokok − rusak ± penyesuaian − biaya + pendapatan lain', () => {
    const pl = buildProfitLoss({
      branches,
      sales: [sale(1, { sales: 10_000_000, returns: 500_000, revisionRevenue: 0, cogs: 7_000_000, returnCogs: 350_000, damaged: 100_000, costAdjustment: 50_000 })],
      costs: [cost(1, 300_000), cost(1, 2_000_000, { group: 'PAYROLL', category: null }), cost(1, 80_000, { kind: 'INCOME', category: 'Jasa titip' })],
      internalSales: 0,
    });
    expect(cell(line(pl, 'sales'), 'b1')).toBe(9_500_000);
    expect(cell(line(pl, 'cogs'), 'b1')).toBe(6_650_000);
    expect(cell(line(pl, 'gross'), 'b1')).toBe(2_850_000);
    expect(cell(line(pl, 'cost-total'), 'b1')).toBe(2_300_000);
    // 2.850.000 − 100.000 + 50.000 − 2.300.000 + 80.000
    expect(cell(line(pl, 'net'), 'b1')).toBe(580_000);
  });

  it('Kantor hanya biaya tanpa cabang; Gabungan = jumlah cabang − Kantor', () => {
    const pl = buildProfitLoss({
      branches,
      sales: [sale(1, { sales: 5_000_000, cogs: 3_000_000 }), sale(2, { sales: 4_000_000, cogs: 3_500_000 })],
      costs: [cost(1, 200_000), cost(null, 1_000_000, { category: 'Sewa toko' }), cost(null, 600_000, { group: 'PAYROLL', category: null })],
      internalSales: 0,
    });
    const net = line(pl, 'net');
    expect(cell(line(pl, 'sales'), OFFICE_KEY)).toBe(0);
    expect(cell(net, OFFICE_KEY)).toBe(-1_600_000);
    expect(cell(net, 'b1')).toBe(1_800_000);
    expect(cell(net, 'b2')).toBe(500_000);
    expect(cell(net, TOTAL_KEY)).toBe(1_800_000 + 500_000 - 1_600_000);
    expect(cell(line(pl, 'cost:cat:Sewa toko'), TOTAL_KEY)).toBe(1_000_000);
  });

  it('penjualan ke cabang sendiri keluar dari Penjualan & Harga pokok Gabungan, laba kotor tetap', () => {
    const input = { branches, sales: [sale(2, { sales: 4_000_000, cogs: 3_500_000 }), sale(1, { sales: 6_000_000, cogs: 4_000_000 })], costs: [] };
    const without = buildProfitLoss({ ...input, internalSales: 0 });
    const withInternal = buildProfitLoss({ ...input, internalSales: 4_000_000 });
    expect(cell(line(withInternal, 'sales'), TOTAL_KEY)).toBe(6_000_000);
    expect(cell(line(withInternal, 'cogs'), TOTAL_KEY)).toBe(3_500_000);
    expect(cell(line(withInternal, 'gross'), TOTAL_KEY)).toBe(cell(line(without, 'gross'), TOTAL_KEY));
    expect(cell(line(withInternal, 'sales'), 'b2')).toBe(4_000_000);
  });

  it('biaya dikelompokkan: kategori urut nama lalu Gaji, Bongkaran, Bensin, Sewa mobil', () => {
    const pl = buildProfitLoss({
      branches,
      sales: [],
      costs: [
        cost(1, 1, { group: 'VEHICLE_RENTAL', category: null }), cost(1, 1, { group: 'PAYROLL', category: null }),
        cost(1, 1, { category: 'Listrik' }), cost(1, 1, { category: 'Air' }), cost(1, 1, { group: 'FUEL', category: null }),
        cost(1, 1, { group: 'UNLOADING', category: null }),
      ],
      internalSales: 0,
    });
    const labels = pl.lines.filter((l) => l.key.startsWith('cost:')).map((l) => l.label);
    expect(labels).toEqual(['Air', 'Listrik', 'Gaji', 'Bongkaran', 'Bensin', 'Sewa mobil']);
  });

  it('cabang nonaktif hanya tampil bila punya angka', () => {
    const pl = buildProfitLoss({
      branches: [...branches, { id: 3, name: 'Toko Tutup', isActive: false }, { id: 4, name: 'Toko Lama', isActive: false }],
      sales: [sale(3, { sales: 1000 })], costs: [], internalSales: 0,
    });
    expect(pl.columns.map((c) => c.name)).toEqual(['Toko A', 'Gudang', 'Toko Tutup', 'Kantor', 'Gabungan']);
  });

  it('bulan gaji: slip bulanan 26–25 = bulan akhir; slip mingguan = bulan hari terakhir', () => {
    expect(payslipMonth('MONTHLY', '2026-10-26', null)).toBe('2026-11');
    expect(payslipMonth('MONTHLY', '2026-12-26', null)).toBe('2027-01');
    expect(payslipMonth('WEEKLY', '2026-11-27', '2026-12-03')).toBe('2026-12');
    expect(payslipMonth('WEEKLY_EXTRA', '2026-11-20', '2026-11-26')).toBe('2026-11');
  });

  it('rentang bulan', () => {
    expect(monthRange('2026-11')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(monthRange('2027-02')).toEqual({ from: '2027-02-01', to: '2027-02-28' });
  });
});
