import { describe, expect, it } from 'vitest';
import { pendingByPlace, type PendingRow } from './rules';

const row = (o: Partial<PendingRow> & { key: string }): PendingRow => ({
  branchId: 1, branchName: 'Toko A', businessDate: '2026-11-11', shiftNumber: 1, paymentMethodName: 'QRIS', amount: 100_000,
  status: 'UNVERIFIED', placeId: 5, placeName: 'BCA Toko A', ...o,
});

describe('Dana Belum Cair — aturan', () => {
  it('per rekening: belum cair vs belum diverifikasi, tertua, merah lewat 2 hari; belum ditautkan terakhir; nol diabaikan', () => {
    const { groups, total } = pendingByPlace([
      row({ key: 'a', status: 'AWAITING', businessDate: '2026-11-09', amount: 250_000 }),
      row({ key: 'b' }),
      row({ key: 'c', placeId: null, placeName: null, amount: 40_000 }),
      row({ key: 'd', placeId: 3, placeName: 'Mandiri Toko B', branchName: 'Toko B', businessDate: '2026-11-10' }),
      row({ key: 'e', amount: 0 }),
    ], '2026-11-12');
    expect(groups.map((g) => [g.placeName, g.total, g.oldestDays, g.overdue])).toEqual([
      ['BCA Toko A', 350_000, 3, true],
      ['Mandiri Toko B', 100_000, 2, false],
      ['Rekening belum ditautkan', 40_000, 1, false],
    ]);
    expect(groups[0].awaiting).toEqual({ amount: 250_000, count: 1 });
    expect(groups[0].unverified).toEqual({ amount: 100_000, count: 1 });
    expect(groups[0].items.map((i) => i.key)).toEqual(['a', 'b']);
    expect(total).toBe(490_000);
  });
});
