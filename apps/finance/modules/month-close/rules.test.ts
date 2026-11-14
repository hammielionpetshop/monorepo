import { describe, expect, it } from 'vitest';
import { buildProfitLoss } from '@/modules/profit-loss';
import {
  checkClose, closableMonth, confirmLabel, correctionEffect, countOpenItems, monthStates, netChange, overdueMonths, profitLossChanges,
  restatement, type Correction,
} from './rules';

describe('urutan bulan', () => {
  it('bulan berjalan tidak bisa ditutup; yang bisa = bulan lewat tertua yang belum ditutup', () => {
    expect(closableMonth([], '2026-11')).toBeNull();
    expect(closableMonth([], '2027-01')).toBe('2026-11');
    expect(closableMonth(['2026-11'], '2027-01')).toBe('2026-12');
    expect(closableMonth(['2026-11', '2026-12'], '2027-01')).toBeNull();
    expect(monthStates(['2026-11'], '2027-02')).toEqual([
      { month: '2027-02', state: 'CURRENT' },
      { month: '2027-01', state: 'WAITING' },
      { month: '2026-12', state: 'NEXT' },
      { month: '2026-11', state: 'CLOSED' },
    ]);
  });

  it('pengingat sesudah tanggal 10 bulan berikutnya', () => {
    expect(overdueMonths([], '2026-12-10')).toEqual([]);
    expect(overdueMonths([], '2026-12-11')).toEqual(['2026-11']);
    expect(overdueMonths([], '2027-01-02')).toEqual(['2026-11']);
    expect(overdueMonths(['2026-11'], '2027-01-11')).toEqual(['2026-12']);
  });
});

describe('isian tutup bulan', () => {
  const base = { month: '2026-11', closable: '2026-11', confirmText: 'november  2026 ', openItems: [], note: '' };
  it('wajib ketik nama bulan, berurutan, dan alasan bila ada yang belum beres', () => {
    expect(confirmLabel('2026-11')).toBe('November 2026');
    expect(checkClose(base)).toBeNull();
    expect(checkClose({ ...base, confirmText: 'Desember 2026' })).toMatch(/Ketik "November 2026"/);
    expect(checkClose({ ...base, month: '2026-12' })).toMatch(/berurutan/);
    expect(checkClose({ ...base, closable: null })).toMatch(/Belum ada bulan/);
    const openItems = [{ key: 'x', label: 'x', count: 1, amount: null }];
    expect(checkClose({ ...base, openItems, note: 'ok' })).toMatch(/alasan/);
    expect(checkClose({ ...base, openItems, note: 'slip menyusul' })).toBeNull();
  });
});

describe('perubahan sesudah ditutup', () => {
  const branches = [{ id: 1, name: 'Toko A', isActive: true }];
  const sale = { branchId: 1, sales: 1_000_000, returns: 0, revisionRevenue: 0, cogs: 600_000, returnCogs: 0, damaged: 0, costAdjustment: 0 };
  it('hanya sel yang berubah, termasuk baris yang baru muncul', () => {
    const closed = buildProfitLoss({ branches, sales: [sale], costs: [], internalSales: 0 });
    const live = buildProfitLoss({
      branches,
      sales: [{ ...sale, returns: 100_000, returnCogs: 60_000 }],
      costs: [{ branchId: null, group: 'PAYROLL', kind: 'COST', category: null, amount: 50_000, date: '2026-11-25', label: 'slip', source: 'HRIS', ref: 'p1' }],
      internalSales: 0,
    });
    const changes = profitLossChanges(closed, live);
    expect(changes.find((c) => c.lineKey === 'sales' && c.columnKey === 'b1')).toMatchObject({ closed: 1_000_000, live: 900_000, delta: -100_000 });
    expect(changes.find((c) => c.lineKey === 'cost:PAYROLL' && c.columnKey === 'office')).toMatchObject({ closed: 0, delta: 50_000 });
    // Laba Gabungan: 400.000 → (900.000 − 540.000) − 50.000 = 310.000.
    expect(netChange(changes)).toBe(-90_000);
    expect(profitLossChanges(closed, closed)).toEqual([]);
  });
});

describe('Hitung Kas akhir bulan', () => {
  const place = (id: number, name: string) => ({ id, name, kind: 'CASH' as const, branchId: 1, branchName: 'A', heldBy: 'FINANCE', isActive: true, opening: 1_000 });
  const count = (placeId: number, countedOn: string, amount: number) => ({ id: placeId, placeId, countedOn, amount, createdByName: null, note: null, adjustment: null });
  it('belum dihitung di hari terakhir dan masih berselisih', () => {
    const items = countOpenItems([place(1, 'Brankas'), place(2, 'Kas kecil'), place(3, 'Bank')], [],
      [count(1, '2026-11-30', 1_000), count(2, '2026-11-29', 1_000), count(3, '2026-11-30', 900)], '2026-11-30');
    expect(items).toEqual([
      { key: 'count-missing', label: 'Tunai/Rekening tidak dihitung pada hari terakhir bulan (Kas kecil)', count: 1, amount: null },
      { key: 'count-variance', label: 'Hitung Kas akhir bulan masih berselisih dengan saldo catatan', count: 1, amount: 100 },
    ]);
  });
});

describe('Koreksi bulan lalu & penyajian kembali (F2-6f §5)', () => {
  const branches = [{ id: 1, name: 'Toko A', isActive: true }];
  const sale = { branchId: 1, sales: 1_000_000, returns: 0, revisionRevenue: 0, cogs: 600_000, returnCogs: 0, damaged: 0, costAdjustment: 0 };
  const fix = (over: Partial<Correction> = {}): Correction => ({
    id: 1, occurredOn: '2026-12-03', branchName: 'Toko A', category: 'Listrik', type: 'EXPENSE', reportKind: 'COST',
    amount: 20_000, reason: 'listrik November lupa dicatat', createdByName: 'Finance', ...over,
  });
  const listrik = { branchId: 1, group: 'CATEGORY' as const, kind: 'COST' as const, category: 'Listrik', amount: 20_000, date: '2026-12-03', label: 'Listrik', source: 'BO' as const, ref: 'cf:1' };

  it('pengaruh ke laba: biaya mengurangi, pendapatan lain menambah, jenis lain nol', () => {
    expect(correctionEffect(fix())).toBe(-20_000);
    expect(correctionEffect(fix({ type: 'INCOME', reportKind: 'INCOME' }))).toBe(20_000);
    expect(correctionEffect(fix({ reportKind: 'NON_COST' }))).toBe(0);
  });

  it('saat ditutup → koreksi → perubahan lain → disajikan kembali', () => {
    const closed = buildProfitLoss({ branches, sales: [sale], costs: [], internalSales: 0 });
    // Sesudah ditutup: listrik lupa dicatat (koreksi) dan satu slip HRIS ditutup terlambat (perubahan lain).
    const live = buildProfitLoss({
      branches,
      sales: [sale],
      costs: [listrik, { branchId: null, group: 'PAYROLL', kind: 'COST', category: null, amount: 50_000, date: '2026-11-25', label: 'slip', source: 'HRIS', ref: 'p1' }],
      internalSales: 0,
    });
    expect(restatement(closed, live, [fix()])).toEqual({ closed: 400_000, corrections: -20_000, other: -50_000, restated: 330_000 });
    // Tanpa perubahan apa pun.
    expect(restatement(closed, closed, [])).toEqual({ closed: 400_000, corrections: 0, other: 0, restated: 400_000 });
  });
});

