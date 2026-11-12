import { describe, expect, it } from 'vitest';
import { countCheck, countFreshness, latestCount, type CashCount, type MoneyLine, type Place } from './rules';

// Hitung Kas F2-6e-2: selisih = uang nyata − saldo menurut catatan akhir hari hitung.
const place: Place = { id: 1, name: 'Brankas', kind: 'CASH', branchId: 1, branchName: 'Gudang', heldBy: 'OTHER', isActive: true, opening: 5_000_000 };
const line = (date: string, amount: number, ref: string, kind: MoneyLine['kind'] = 'CASHFLOW_OUT'): MoneyLine => ({
  placeId: 1, date, amount, kind, group: null, label: ref, source: 'BO', ref,
});
const count = (id: number, countedOn: string, amount: number, placeId = 1): CashCount => ({
  id, placeId, countedOn, amount, createdByName: null, note: null, adjustment: null,
});

describe('Hitung Kas — selisih', () => {
  const lines = [line('2026-11-03', -200_000, 'cf:1'), line('2026-11-10', -100_000, 'cf:2')];

  it('kurang, lebih, dan cocok dihitung terhadap saldo akhir hari hitung (baris sesudahnya tidak ikut)', () => {
    expect(countCheck(place, lines, count(1, '2026-11-05', 4_750_000))).toMatchObject({ systemBalance: 4_800_000, variance: -50_000 });
    expect(countCheck(place, lines, count(2, '2026-11-05', 4_810_000)).variance).toBe(10_000);
    expect(countCheck(place, lines, count(3, '2026-11-10', 4_700_000)).variance).toBe(0);
  });

  it('selisih hidup: catatan terlupa bertanggal ≤ hari hitung, atau penyesuaian, meniadakan selisih', () => {
    const late = [...lines, line('2026-11-04', -50_000, 'cf:3')];
    expect(countCheck(place, late, count(1, '2026-11-05', 4_750_000)).variance).toBe(0);
  });

  it('hitungan terakhir s.d. tanggal pilihan dan tanda 7 hari', () => {
    const all = [count(1, '2026-11-02', 1), count(2, '2026-11-09', 2), count(3, '2026-11-12', 3, 2)];
    expect(latestCount(all, 1, '2026-11-08')?.id).toBe(1);
    expect(latestCount(all, 1, '2026-11-30')?.id).toBe(2);
    expect(latestCount(all, 3, '2026-11-30')).toBeNull();
    expect(countFreshness(null, '2026-11-12')).toBe('NEVER');
    expect(countFreshness('2026-11-05', '2026-11-12')).toBe('FRESH');
    expect(countFreshness('2026-11-04', '2026-11-12')).toBe('STALE');
  });
});
