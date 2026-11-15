import { describe, expect, it } from 'vitest';
import { correctionInputs } from './payslip';
import { LINE_LABELS, type PayLine } from './attendance-pay';
import { dayEndWib, fixPathsFor, notReceivedWindow, periodEndedAt, waitingFixDays, wrongWindow } from './slip-objection';

// Spec L4g §3.5–3.6: masa keberatan slip, jalan pembetulan, Koreksi gaji tetap.

const wib = (iso: string) => new Date(`${iso}+07:00`);

describe('masa keberatan "Ada yang salah"', () => {
  const P = '2026-10-26';
  it('belum ada tombol sebelum periode berakhir (26 pukul 00.00 WIB)', () => {
    expect(periodEndedAt(P).toISOString()).toBe(wib('2026-11-26T00:00:00').toISOString());
    expect(wrongWindow({ periodStart: P, status: 'ESTIMATE', objectionUntil: null }, wib('2026-11-25T23:59:00'))).toMatchObject({ open: false });
    expect(wrongWindow({ periodStart: P, status: 'ESTIMATE', objectionUntil: null }, wib('2026-11-26T00:00:00'))).toMatchObject({ open: true, until: null });
  });

  it('slip ditutup: sampai 23.59 hari ke-3 sesudah penutupan terakhir', () => {
    const until = dayEndWib(wib('2026-11-28T10:00:00'), 3);
    expect(until.toISOString()).toBe(wib('2026-12-01T23:59:59').toISOString());
    const slip = { periodStart: P, status: 'CLOSED' as const, objectionUntil: until };
    expect(wrongWindow(slip, wib('2026-12-01T23:59:00'))).toMatchObject({ open: true });
    expect(wrongWindow(slip, wib('2026-12-02T00:00:00'))).toMatchObject({ open: false });
    // Ditutup ulang: batas baru dihitung dari penutupan terakhir.
    const reclosed = { ...slip, objectionUntil: dayEndWib(wib('2026-12-05T08:00:00'), 3) };
    expect(wrongWindow(reclosed, wib('2026-12-06T12:00:00'))).toMatchObject({ open: true });
  });
});

describe('masa keberatan "Uang belum saya terima"', () => {
  const paidAt = wib('2026-12-01T09:00:00');
  it('sampai 23.59 hari ke-7 sesudah ditandai Dibayar; slip tanpa uang dan belum dibayar tidak bisa', () => {
    expect(notReceivedWindow({ kind: 'MONEY', createdAt: paidAt }, wib('2026-12-08T23:59:00'))).toMatchObject({ open: true });
    expect(notReceivedWindow({ kind: 'MONEY', createdAt: paidAt }, wib('2026-12-09T00:00:01'))).toMatchObject({ open: false });
    expect(notReceivedWindow({ kind: 'NO_MONEY', createdAt: paidAt }, paidAt)).toMatchObject({ open: false });
    expect(notReceivedWindow(null, paidAt)).toMatchObject({ open: false });
  });
});

describe('jalan pembetulan menurut keadaan slip', () => {
  it('server menyaring pilihan penyetuju', () => {
    expect(fixPathsFor({ kind: 'WRONG', status: 'ESTIMATE', reopenable: false })).toEqual(['SOURCE']);
    expect(fixPathsFor({ kind: 'WRONG', status: 'CLOSED', reopenable: true })).toEqual(['REOPEN']);
    expect(fixPathsFor({ kind: 'WRONG', status: 'CLOSED', reopenable: false })).toEqual(['PAST_CORRECTION', 'SALARY_CORRECTION']);
    expect(fixPathsFor({ kind: 'NOT_RECEIVED', status: 'CLOSED', reopenable: false })).toEqual(['CANCEL_PAYMENT']);
  });

  it('hari menunggu pembetulan dihitung penuh', () => {
    expect(waitingFixDays(wib('2026-12-01T10:00:00'), wib('2026-12-03T09:59:00'))).toBe(1);
    expect(waitingFixDays(wib('2026-12-01T10:00:00'), wib('2026-12-03T10:00:00'))).toBe(2);
  });
});

describe('Koreksi gaji tetap (Pembetulan gaji periode lalu)', () => {
  const base = (amount: number): PayLine => ({ key: 'BASE', sign: 1, amount, details: [] });
  const stored = [{ section: 'INCOME' as const, lineKind: 'BASE', amount: 2_600_000 }];

  it('tanpa asal pembetulan gaji tetap tidak dibandingkan', () => {
    expect(correctionInputs('2026-10-26', [base(3_000_000)], stored, [], LINE_LABELS)).toEqual({ income: [], deductions: [] });
  });

  it('dua arah: plus jadi pendapatan, minus jadi potongan (a); yang sudah dikoreksi tidak diulang', () => {
    const up = correctionInputs('2026-10-26', [base(3_000_000)], stored, [], LINE_LABELS, { includeBase: true });
    expect(up.income).toEqual([expect.objectContaining({ sourceKey: 'corr:2026-10-26:BASE', amount: 400_000, label: expect.stringMatching(/^Koreksi gaji tetap periode/) })]);
    const down = correctionInputs('2026-10-26', [base(2_000_000)], stored, [], LINE_LABELS, { includeBase: true });
    expect(down.deductions).toEqual([expect.objectContaining({ group: 'a', amount: 600_000, lineKind: 'BASE' })]);
    const done = correctionInputs('2026-10-26', [base(3_000_000)], stored, [{ section: 'INCOME', lineKind: 'BASE', amount: 400_000 }], LINE_LABELS, { includeBase: true });
    expect(done).toEqual({ income: [], deductions: [] });
  });
});
