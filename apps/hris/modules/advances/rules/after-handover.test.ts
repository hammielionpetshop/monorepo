import { describe, expect, it } from 'vitest';
import { placeFrom, postponePeriods, postponeProblem, reduceAmountProblem, reduceOrder, repayDateProblem, rescheduleProblem } from './advance';

// L5b: sesudah kasbon diberikan (spec L5 §3.9–3.11, §8).

describe('kasbon: pelunasan dan hapus utang (DRV-69, 70, 136, 137)', () => {
  it('urutan pengurangan: sisa dibawa dulu, lalu cicilan terdekat', () => {
    const plan = reduceOrder(100_000, [{ id: 7, amount: 30_000 }], [
      { id: 2, amount: 75_000, periodStart: '2026-12-26' },
      { id: 1, amount: 75_000, periodStart: '2026-11-26' },
    ]);
    expect(plan.fromCarry).toEqual([{ id: 7, take: 30_000, rest: 0 }]);
    expect(plan.schedule).toEqual([
      { id: 1, periodStart: '2026-11-26', amount: 5_000 },
      { id: 2, periodStart: '2026-12-26', amount: 75_000 },
    ]);
    expect(plan.left).toBe(0);
  });

  it('pelunasan kecil hanya mengurangi sebagian sisa dibawa; cicilan utuh', () => {
    const plan = reduceOrder(10_000, [{ id: 7, amount: 30_000 }], [{ id: 1, amount: 75_000, periodStart: '2026-11-26' }]);
    expect(plan.fromCarry).toEqual([{ id: 7, take: 10_000, rest: 20_000 }]);
    expect(plan.schedule[0].amount).toBe(75_000);
  });

  it('lunasi semua: semua cicilan menjadi 0', () => {
    const plan = reduceOrder(150_000, [], [{ id: 1, amount: 75_000, periodStart: '2026-11-26' }, { id: 2, amount: 75_000, periodStart: '2026-12-26' }]);
    expect(plan.schedule.map((s) => s.amount)).toEqual([0, 0]);
  });

  it('nominal > 0 dan tidak lebih dari sisa', () => {
    expect(reduceAmountProblem(0, 100_000)).toMatch(/lebih dari 0/);
    expect(reduceAmountProblem(100_001, 100_000)).toMatch(/sisa kasbon/);
    expect(reduceAmountProblem(100_000, 100_000)).toBeNull();
  });

  it('tanggal uang pelunasan: tidak masa depan, tidak sebelum diberikan, > 7 hari wajib alasan', () => {
    const base = { today: '2026-11-20', handedOn: '2026-11-05', reason: null };
    expect(repayDateProblem({ ...base, moneyDate: '2026-11-21' })).toMatch(/sesudah hari ini/);
    expect(repayDateProblem({ ...base, moneyDate: '2026-11-04' })).toMatch(/sebelum kasbon diberikan/);
    expect(repayDateProblem({ ...base, moneyDate: '2026-11-12' })).toMatch(/7 hari/);
    expect(repayDateProblem({ ...base, moneyDate: '2026-11-12', reason: 'Uang diterima saat Finance cuti' })).toBeNull();
    expect(repayDateProblem({ ...base, moneyDate: '2026-11-13' })).toBeNull();
  });
});

describe('kasbon: tunda cicilan (DRV-68, 134)', () => {
  it('semua cicilan bergeser satu periode, melewati slip yang sudah ditutup', () => {
    expect(postponePeriods(['2026-10-26', '2026-11-26'], new Set())).toEqual(['2026-11-26', '2026-12-26']);
    expect(postponePeriods(['2026-10-26'], new Set(['2026-11-26']))).toEqual(['2026-12-26']);
  });

  it('jatah 1 kali; ditolak bila tidak berjalan, akan berhenti, ada yang menunggu, atau tak ada cicilan di slip Perkiraan', () => {
    const ok = { stage: 'RUNNING' as const, used: 0, quota: 1, hasOpenScheduled: true, pending: false, leaving: false };
    expect(postponeProblem(ok)).toBeNull();
    expect(postponeProblem({ ...ok, used: 1 })).toMatch(/sudah pernah ditunda/);
    expect(postponeProblem({ ...ok, stage: 'PAID_OFF' })).toMatch(/berjalan/);
    expect(postponeProblem({ ...ok, leaving: true })).toMatch(/berhenti/);
    expect(postponeProblem({ ...ok, pending: true })).toMatch(/menunggu/);
    expect(postponeProblem({ ...ok, hasOpenScheduled: false })).toMatch(/Perkiraan/);
  });
});

describe('kasbon: ubah jadwal (DRV-69, 135)', () => {
  const base = { count: 2, maxCount: 3, start: '2026-11-26', nearestOpen: '2026-10-26', maxAhead: 3, closed: new Set<string>(), lastPeriod: null, total: 150_000 };
  it('batas banyaknya, slip ditutup, sebelum slip terbuka terdekat, paling jauh N gajian, slip terakhir', () => {
    expect(rescheduleProblem(base)).toBeNull();
    expect(rescheduleProblem({ ...base, count: 4 })).toMatch(/1 sampai 3/);
    expect(rescheduleProblem({ ...base, count: 12, maxCount: 12 })).toBeNull();
    expect(rescheduleProblem({ ...base, closed: new Set(['2026-11-26']) })).toMatch(/ditutup/);
    expect(rescheduleProblem({ ...base, start: '2026-09-26' })).toMatch(/sebelum slip terbuka/);
    expect(rescheduleProblem({ ...base, start: '2027-01-26' })).toBeNull();
    expect(rescheduleProblem({ ...base, start: '2027-02-26' })).toMatch(/paling jauh 3/);
    expect(rescheduleProblem({ ...base, lastPeriod: '2026-10-26' })).toMatch(/slip terakhir/);
    expect(rescheduleProblem({ ...base, total: 0 })).toMatch(/Tidak ada cicilan/);
  });

  it('pasang berturut-turut mulai periode, melewati yang ditutup, menumpuk di slip terakhir', () => {
    expect(placeFrom(3, '2026-11-26', new Set(['2026-12-26']), null)).toEqual(['2026-11-26', '2027-01-26', '2027-02-26']);
    expect(placeFrom(3, '2026-11-26', new Set(), '2026-12-26')).toEqual(['2026-11-26', '2026-12-26', '2026-12-26']);
  });
});
