import { describe, expect, it } from 'vitest';
import {
  ageBucket, debtorSummaries, freeDeposits, openDebts, paymentGroup, remainingAt, trend, weekEnds,
  type Payable, type Payment, type SettlementPiece,
} from './rules';

const payable = (o: Partial<Payable> & { id: number }): Payable => ({
  ibtNumber: `IBT-${o.id}`, debtorId: 1, debtorName: 'Toko A', creditorId: 9, creditorName: 'Toko Pusat', total: 1_000_000, paid: 0,
  status: 'UNPAID', bornOn: '2026-11-02', updatedOn: '2026-11-02', ...o,
});

describe('Utang Antar Cabang — aturan', () => {
  it('kelompok pembayaran: otomatis, manual, retur & saldo', () => {
    expect(['SETORAN', 'BATAL_SETORAN', 'SUSULAN', 'BATAL_SUSULAN'].map(paymentGroup)).toEqual(['AUTO', 'AUTO', 'AUTO', 'AUTO']);
    expect([null, 'BATAL_BAYAR'].map(paymentGroup)).toEqual(['MANUAL', 'MANUAL']);
    expect(['RETUR_INTERNAL', 'SALDO_INTERNAL', 'BATAL_RETUR'].map(paymentGroup)).toEqual(['RETURN', 'RETURN', 'RETURN']);
  });

  it('kelompok umur 0–7 / 8–30 / >30', () => {
    expect([0, 7, 8, 30, 31].map(ageBucket)).toEqual(['D0_7', 'D0_7', 'D8_30', 'D8_30', 'D31']);
  });

  it('tagihan terbuka: sisa, umur, merah lewat batas, utang lama, rincian bayar; lunas & dihapuskan tidak ikut', () => {
    const payables = [
      payable({ id: 1, bornOn: '2026-10-05', paid: 300_000, status: 'PARTIAL' }),
      payable({ id: 2, bornOn: '2026-11-10', creditorId: 8, creditorName: 'Gudang' }),
      payable({ id: 3, status: 'PAID', paid: 1_000_000 }),
      payable({ id: 4, status: 'WAIVED', paid: 100_000 }),
      payable({ id: 5, debtorId: 9, debtorName: 'Toko Pusat', creditorId: 8, creditorName: 'Gudang', total: 500_000 }),
    ];
    const payments: Payment[] = [
      { payableId: 1, date: '2026-10-20', amount: 200_000, group: 'MANUAL' },
      { payableId: 1, date: '2026-11-09', amount: 150_000, group: 'AUTO' },
      { payableId: 1, date: '2026-11-10', amount: -50_000, group: 'AUTO' },
    ];
    const debts = openDebts(payables, payments, '2026-11-12');
    expect(debts.map((d) => [d.id, d.remaining, d.ageDays, d.red, d.legacy])).toEqual([
      [1, 700_000, 38, true, true], [5, 500_000, 10, false, false], [2, 1_000_000, 2, false, false],
    ]);
    expect(debts[0].paidBy).toEqual({ AUTO: 100_000, MANUAL: 200_000, RETURN: 0 });

    const s = debtorSummaries(debts);
    expect(s.total).toBe(2_200_000);
    expect(s.rows[0]).toMatchObject({
      debtorName: 'Toko A', remaining: 1_700_000, count: 2, oldestBornOn: '2026-10-05', red: true, legacyRemaining: 700_000,
      buckets: { D0_7: 1_000_000, D8_30: 0, D31: 700_000 },
    });
    expect(s.rows[0].creditors.map((c) => [c.creditorName, c.remaining])).toEqual([['Gudang', 1_000_000], ['Toko Pusat', 700_000]]);
  });

  it('sisa per tanggal: belum lahir 0, pembayaran & pembalikan, dihapuskan nol sejak tanggal diubah', () => {
    const p = payable({ id: 1, bornOn: '2026-11-03' });
    const pays: Payment[] = [
      { payableId: 1, date: '2026-11-05', amount: 400_000, group: 'AUTO' },
      { payableId: 1, date: '2026-11-09', amount: -400_000, group: 'AUTO' },
    ];
    expect(remainingAt(p, pays, '2026-11-02')).toBe(0);
    expect(remainingAt(p, pays, '2026-11-05')).toBe(600_000);
    expect(remainingAt(p, pays, '2026-11-09')).toBe(1_000_000);
    const w = payable({ id: 2, status: 'WAIVED', updatedOn: '2026-11-07' });
    expect(remainingAt(w, [], '2026-11-06')).toBe(1_000_000);
    expect(remainingAt(w, [], '2026-11-07')).toBe(0);
  });

  it('akhir minggu (Minggu) sejak minggu 1 Nov sampai hari ini', () => {
    expect(weekEnds('2026-11-01', '2026-11-12')).toEqual(['2026-11-01', '2026-11-08', '2026-11-12']);
    expect(weekEnds('2026-11-01', '2026-11-15')).toEqual(['2026-11-01', '2026-11-08', '2026-11-15']);
  });

  it('tren per cabang dan total', () => {
    const payables = [payable({ id: 1, bornOn: '2026-11-03' }), payable({ id: 2, debtorId: 2, debtorName: 'Toko B', bornOn: '2026-10-20', total: 500_000 })];
    const pays: Payment[] = [{ payableId: 1, date: '2026-11-10', amount: 1_000_000, group: 'AUTO' }];
    const t = trend(payables, pays, ['2026-11-01', '2026-11-08', '2026-11-12']);
    expect(t.rows.map((r) => [r.debtorName, r.points])).toEqual([
      ['Toko A', [0, 1_000_000, 0]], ['Toko B', [500_000, 500_000, 500_000]],
    ]);
    expect(t.totals).toEqual([500_000, 1_500_000, 500_000]);
  });

  it('setoran bebas per bulan: rantai, pembalikan, setoran + diterima = melunasi + bebas', () => {
    const piece = (o: Partial<SettlementPiece>): SettlementPiece => ({
      payerId: 1, payerName: 'Toko A', level: 1, payableId: null, creditorId: null, creditorName: null, amount: 0, date: '2026-11-10', ...o,
    });
    // Contoh spec F2-3 §2: Toko A setor 5 jt → Toko Pusat 3 jt, Gudang 1 jt, bebas 1 jt; Toko Pusat 3 jt → Gudang 2 jt, bebas 1 jt.
    const pieces = [
      piece({ payableId: 11, creditorId: 9, creditorName: 'Toko Pusat', amount: 3_000_000 }),
      piece({ payableId: 12, creditorId: 8, creditorName: 'Gudang', amount: 1_000_000 }),
      piece({ amount: 1_000_000 }),
      piece({ payerId: 9, payerName: 'Toko Pusat', level: 2, payableId: 13, creditorId: 8, creditorName: 'Gudang', amount: 2_000_000 }),
      piece({ payerId: 9, payerName: 'Toko Pusat', level: 2, amount: 1_000_000 }),
      piece({ payerId: 8, payerName: 'Gudang', level: 2, amount: 1_000_000 }),
      piece({ payerId: 8, payerName: 'Gudang', level: 3, amount: 2_000_000 }),
      // Setoran lain dikoreksi: baris & pembalikannya saling meniadakan.
      piece({ amount: 500_000, date: '2026-11-11' }),
      piece({ amount: -500_000, date: '2026-11-11' }),
      // Bulan lain tidak ikut.
      piece({ amount: 9_000_000, date: '2026-12-01' }),
    ];
    const f = freeDeposits(pieces, '2026-11');
    expect(f.rows.map((r) => [r.branchName, r.ownDeposits, r.received, r.settled, r.free])).toEqual([
      ['Gudang', 0, 3_000_000, 0, 3_000_000],
      ['Toko A', 5_000_000, 0, 4_000_000, 1_000_000],
      ['Toko Pusat', 0, 3_000_000, 2_000_000, 1_000_000],
    ]);
    for (const r of f.rows) expect(r.ownDeposits + r.received).toBe(r.settled + r.free);
    expect(f.totalFree).toBe(5_000_000);
  });
});
