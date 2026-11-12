import { describe, expect, it } from 'vitest';
import { depreciationFor, disposalLossIn, type AssetRow } from './assets';
import { buildProfitLoss, cell, type CostItem } from './rules';

const freezer: AssetRow = {
  id: 1, name: 'Freezer', branchId: 1, branchName: 'Toko A', purchasePrice: 7_500_000, usefulLifeMonths: 48,
  purchasedOn: '2026-11-10', status: 'IN_USE', disposedOn: null, saleAmount: null,
};

describe('Aset di Laba Rugi F2-6d-2 (salinan rumus BO)', () => {
  it('penyusutan bulanan mulai bulan beli, sisa pembulatan di bulan terakhir', () => {
    expect(depreciationFor(freezer, '2026-11')).toBe(156_250);
    expect(depreciationFor(freezer, '2026-10')).toBe(0);
    const odd = { ...freezer, purchasePrice: 1_000_000, usefulLifeMonths: 3 };
    expect(['2026-11', '2026-12', '2027-01', '2027-02'].map((m) => depreciationFor(odd, m))).toEqual([333_333, 333_333, 333_334, 0]);
  });

  it('contoh spec: dijual Rp3 juta Maret 2028 → kerugian Rp2 juta, penyusutan berhenti', () => {
    const sold = { ...freezer, status: 'SOLD' as const, disposedOn: '2028-03-05', saleAmount: 3_000_000 };
    expect(disposalLossIn(sold, '2028-03')).toBe(2_000_000);
    expect(disposalLossIn(sold, '2028-02')).toBeNull();
    expect(depreciationFor(sold, '2028-03')).toBe(0);
  });

  it('dijual melebihi sisa nilai → untung (negatif)', () => {
    const a = { ...freezer, purchasePrice: 1_200_000, usefulLifeMonths: 2, status: 'SOLD' as const, disposedOn: '2027-06-01', saleAmount: 300_000 };
    expect(disposalLossIn(a, '2027-06')).toBe(-300_000);
  });

  it('baris Penyusutan aset & Untung jual aset di tabel', () => {
    const item = (o: Partial<CostItem>): CostItem => ({
      branchId: 1, amount: 0, group: 'DEPRECIATION', kind: 'COST', category: null, date: '2026-11-01', label: '', source: 'BO', ref: 'fa:1', ...o,
    });
    const pl = buildProfitLoss({
      branches: [{ id: 1, name: 'Toko A', isActive: true }],
      sales: [],
      costs: [item({ amount: 156_250 }), item({ group: 'ASSET_LOSS', kind: 'INCOME', amount: 300_000, ref: 'fa:2' })],
      internalSales: 0,
    });
    const dep = pl.lines.find((l) => l.key === 'cost:DEPRECIATION')!;
    const gain = pl.lines.find((l) => l.key === 'income:ASSET_LOSS')!;
    expect(dep.label).toBe('Penyusutan aset');
    expect(gain.label).toBe('Untung jual aset');
    expect(cell(pl.lines.find((l) => l.key === 'net')!, 'b1')).toBe(143_750);
  });
});
