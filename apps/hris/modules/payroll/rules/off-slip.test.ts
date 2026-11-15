import { describe, expect, it } from 'vitest';
import { correctionPlan, settleAgainst, summarize, type SummarySlip } from './off-slip';

describe('potong Piutang Lain lebih dulu (Y5)', () => {
  it('tagihan habis terpakai piutang: uang Rp0', () => {
    expect(settleAgainst(50_000, [{ id: 1, remaining: 200_000 }])).toEqual({ settlements: [{ receivableId: 1, amount: 50_000, clears: false }], cash: 0 });
  });
  it('piutang habis: sisanya dibayar uang, piutang Lunas', () => {
    expect(settleAgainst(80_000, [{ id: 1, remaining: 30_000 }])).toEqual({ settlements: [{ receivableId: 1, amount: 30_000, clears: true }], cash: 50_000 });
  });
  it('beberapa piutang: paling lama lebih dulu, yang sisanya 0 dilewati', () => {
    expect(settleAgainst(100_000, [{ id: 1, remaining: 0 }, { id: 2, remaining: 40_000 }, { id: 3, remaining: 100_000 }])).toEqual({
      settlements: [{ receivableId: 2, amount: 40_000, clears: true }, { receivableId: 3, amount: 60_000, clears: false }], cash: 0,
    });
  });
  it('tanpa piutang: semuanya uang', () => {
    expect(settleAgainst(25_000, [])).toEqual({ settlements: [], cash: 25_000 });
  });
});

describe('tagihan koreksi per kunci sumber', () => {
  it('belum ada tagihan: buat sebesar selisih', () => {
    expect(correctionPlan(10_000, [])).toEqual({ cancel: [], create: 10_000 });
  });
  it('tagihan Menunggu masih cocok: tidak berubah (idempoten)', () => {
    expect(correctionPlan(10_000, [{ id: 1, amount: 10_000, status: 'WAITING' }])).toEqual({ cancel: [], create: 0 });
  });
  it('nominal berubah: Menunggu dibatalkan, dibuat ulang; yang Dibayar tidak disentuh', () => {
    expect(correctionPlan(15_000, [{ id: 1, amount: 10_000, status: 'PAID' }, { id: 2, amount: 2_000, status: 'WAITING' }])).toEqual({ cancel: [2], create: 5_000 });
  });
  it('koreksi hilang: tagihan Menunggu dibatalkan', () => {
    expect(correctionPlan(0, [{ id: 3, amount: 7_000, status: 'WAITING' }])).toEqual({ cancel: [3], create: 0 });
  });
});

describe('Ringkasan Gaji', () => {
  const line = (section: 'INCOME' | 'DEDUCTION', sourceKey: string, lineKind: string, amount: number, extra: Partial<SummarySlip['lines'][number]> = {}) => ({
    section, group: null, sourceKey, lineKind, label: lineKind, amount, taken: section === 'DEDUCTION' ? amount : 0, remaining: 0, fund: false, ...extra,
  });
  const slips: SummarySlip[] = [
    {
      status: 'PAID', branchName: 'Pusat', ownerOnly: false, lastSlip: false, income: 2_650_000, taken: 50_000, net: 2_600_000, carried: 0,
      lines: [line('INCOME', 'att:BASE', 'BASE', 2_600_000), line('INCOME', 'bonus:GROOMING::OFFICE:2026-10-26', 'GROOMING', 50_000), line('DEDUCTION', 'att:LATE', 'LATE', 50_000, { group: 'a' })],
      payment: { kind: 'MONEY', source: 'Brankas' },
    },
    {
      status: 'CLOSED', branchName: 'Pusat', ownerOnly: false, lastSlip: true, income: 1_000_000, taken: 1_000_000, net: 0, carried: 0,
      lines: [line('INCOME', 'att:BASE', 'BASE', 1_000_000), line('DEDUCTION', 'other:1', 'OTHER', 1_500_000, { group: 'c', taken: 1_000_000, remaining: 500_000 })],
      payment: { kind: 'NO_MONEY', source: null },
    },
    {
      status: 'CLOSED', branchName: 'Cabang', ownerOnly: false, lastSlip: false, income: 1_200_000, taken: 0, net: 1_200_000, carried: 0,
      lines: [line('INCOME', 'att:BASE', 'BASE', 1_000_000), line('INCOME', 'corr:2026-09-26:LATE', 'LATE', 200_000)], payment: null,
    },
    { status: 'ESTIMATE', branchName: 'Cabang', ownerOnly: false, lastSlip: false, income: 0, taken: 0, net: 0, carried: 0, lines: [], payment: null },
  ];
  const t = summarize(slips, [{ fund: 'DISCIPLINE', amount: 50_000 }, { fund: 'ABSENCE', amount: -20_000 }], { BASE: 'Gaji tetap' }, (k) => `Bonus ${k}`);
  it('pendapatan − terpotong = bersih = dibayar + belum dibayar (+ Rp0)', () => {
    expect(t.incomeTotal - t.takenTotal).toBe(t.net);
    expect(t.net).toBe(t.paidTotal + t.unpaid);
    expect(t).toMatchObject({ net: 3_800_000, paidTotal: 2_600_000, unpaid: 1_200_000, zero: 1, receivables: 500_000, uncollectible: 0 });
  });
  it('jumlah slip per status; Perkiraan tidak dijumlah', () => {
    expect(t.counts).toEqual({ ESTIMATE: 1, HELD: 0, CLOSED: 2, PAID: 1 });
  });
  it('pendapatan per jenis: gaji tetap, bonus per sumber dana, koreksi plus', () => {
    expect(t.income).toEqual(expect.arrayContaining([
      { label: 'Gaji tetap', amount: 4_600_000 }, { label: 'Bonus GROOMING (kantor)', amount: 50_000 }, { label: 'Koreksi plus dan pengembalian', amount: 200_000 },
    ]));
    expect(t.funds).toEqual([{ fund: 'DISCIPLINE', in: 50_000, out: 0 }, { fund: 'ABSENCE', in: 0, out: 20_000 }]);
  });
});
