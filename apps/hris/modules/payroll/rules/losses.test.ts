import { describe, expect, it } from 'vitest';
import { daysBetween, netShortage, splitEvenly, splitLoss } from './losses';

const person = (employeeId: number, weight: number, days: number) => ({ employeeId, name: `Orang ${employeeId}`, weight, days });

describe('splitLoss (GAJ-77)', () => {
  it('contoh v3: Rp1.000.000, kantor 40%, periode 30 hari, bobot 2-1-1-1, hari 30-30-10-20', () => {
    const result = splitLoss({ amount: 1_000_000, officePercent: 40, periodDays: 30, holders: [person(1, 2, 30), person(2, 1, 30), person(3, 1, 10), person(4, 1, 20)] });
    expect(result.shares.map((s) => s.amount)).toEqual([240_000, 120_000, 40_000, 80_000]);
    expect(result.office).toEqual({ total: 520_000, percentPart: 400_000, dayRemainder: 120_000, rounding: 0 });
  });

  it('jumlah bagian orang + kantor selalu sama dengan nilai; selisih pembulatan ke kantor', () => {
    const result = splitLoss({ amount: 100_001, officePercent: 33, periodDays: 31, holders: [person(1, 3, 31), person(2, 1, 17), person(3, 2, 5)] });
    const people = result.shares.reduce((s, x) => s + x.amount, 0);
    expect(people + result.office.total).toBe(100_001);
    expect(result.office.percentPart + result.office.dayRemainder + result.office.rounding).toBe(result.office.total);
  });

  it('tanpa yang ikut menanggung: seluruhnya kantor', () => {
    const result = splitLoss({ amount: 500_000, officePercent: 20, periodDays: 30, holders: [] });
    expect(result.shares).toEqual([]);
    expect(result.office.total).toBe(500_000);
  });

  it('kantor 100%: bagian orang Rp0', () => {
    const result = splitLoss({ amount: 90_000, officePercent: 100, periodDays: 30, holders: [person(1, 1, 30)] });
    expect(result.shares[0].amount).toBe(0);
    expect(result.office.total).toBe(90_000);
  });
});

describe('netShortage (GAJ-20)', () => {
  it('minus Rp50.000 dan plus Rp20.000 di periode yang sama → dipotong Rp30.000', () => {
    expect(netShortage([{ amount: -50_000, waived: false }, { amount: 20_000, waived: false }])).toEqual({ minus: 50_000, plus: 20_000, net: 30_000 });
  });
  it('plus saja tidak menjadi tambahan gaji', () => {
    expect(netShortage([{ amount: 20_000, waived: false }]).net).toBe(0);
  });
  it('shift yang ditiadakan tidak dihitung', () => {
    expect(netShortage([{ amount: -50_000, waived: true }, { amount: -10_000, waived: false }]).net).toBe(10_000);
  });
});

describe('splitEvenly (GAJ-79)', () => {
  it('Rp90.000 tiga orang hadir: masing-masing Rp30.000', () => {
    expect(splitEvenly(90_000, [1, 2, 3])).toEqual({ shares: [{ employeeId: 1, amount: 30_000 }, { employeeId: 2, amount: 30_000 }, { employeeId: 3, amount: 30_000 }], office: 0 });
  });
  it('sisa pembulatan ditanggung kantor', () => {
    expect(splitEvenly(100_000, [1, 2, 3]).office).toBe(1);
  });
});

describe('daysBetween', () => {
  it('periode 26 Oktober – 25 November = 31 hari', () => {
    expect(daysBetween('2026-10-26', '2026-11-25')).toBe(31);
  });
});
