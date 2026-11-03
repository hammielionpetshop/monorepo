import { describe, expect, it } from 'vitest';
import { headline, issueConsequence, mySlipState, paymentText, payIssuesFrom, withoutTolerance, type MySlipStateInput } from './my-pay';

const none = { unexplained: [], outsideReviews: [], clarifications: [], overtimeClaims: [], noSalary: false, lastSlipBonus: false };
const base: MySlipStateInput = {
  periodStart: '2026-10-26', status: 'ESTIMATE', reopened: false, held: false, payment: null, due: '2026-12-01', today: '2026-11-10', carried: 0, reopenReason: null,
};

describe('urusan gaji saya (GAJ-108)', () => {
  it('Anda dengan tautan Isi sekarang, Kantor tanpa tombol', () => {
    const issues = payIssuesFrom({ ...none, unexplained: ['2026-11-18', '2026-11-12', '2026-11-14', '2026-11-12'], clarifications: ['2026-11-05'] });
    expect(issues).toEqual([
      { who: 'YOU', text: '3 hari belum dijelaskan (12, 14, 18 November 2026)', link: '/perlu-dijelaskan' },
      { who: 'OFFICE', text: 'Penjelasan 5 November 2026 menunggu keputusan HR', link: null },
    ]);
  });
  it('tanggal lintas bulan ditulis lengkap; penahan slip terakhir tanpa isi', () => {
    const issues = payIssuesFrom({ ...none, outsideReviews: ['2026-10-30', '2026-11-02'], lastSlipBonus: true });
    expect(issues[0].text).toBe('Absen 30 Oktober 2026, 2 November 2026 di luar titik sedang ditinjau');
    expect(issues[1]).toEqual({ who: 'OFFICE', text: 'Menunggu keputusan kantor', link: null });
  });
  it('kalimat akibat mengikuti tanggal', () => {
    expect(issueConsequence('2026-10-26', '2026-11-25')).toMatch(/sebelum tanggal 25/);
    expect(issueConsequence('2026-10-26', '2026-11-26')).toMatch(/tertahan/);
  });
});

describe('keadaan Slip Saya (GAJ-109)', () => {
  it('Perkiraan, Tertahan sesudah periode berakhir, Sedang dibetulkan', () => {
    expect(mySlipState(base).key).toBe('ESTIMATE');
    expect(mySlipState({ ...base, held: true }).key).toBe('ESTIMATE');
    expect(mySlipState({ ...base, held: true, today: '2026-11-26' }).key).toBe('HELD');
    expect(mySlipState({ ...base, reopened: true, reopenReason: 'Tunjangan salah' })).toMatchObject({ key: 'REOPENED', text: expect.stringMatching(/Tunjangan salah/) });
  });
  it('Ditutup, lewat jatuh bayar, Dibayar, tanpa uang', () => {
    const closed = { ...base, status: 'CLOSED' as const, today: '2026-11-28' };
    expect(mySlipState(closed).key).toBe('CLOSED');
    expect(mySlipState({ ...closed, today: '2026-12-02' })).toMatchObject({ key: 'LATE', text: 'Belum ditandai dibayar. Jatuh bayar 1 Desember 2026.' });
    expect(mySlipState({ ...closed, payment: { kind: 'MONEY', moneyDate: '2026-12-01', method: 'TRANSFER', accountTail: '7890' } }).text)
      .toBe('Dibayar 1 Desember 2026 lewat transfer ke rekening ****7890.');
    expect(mySlipState({ ...closed, carried: 50000, payment: { kind: 'NO_MONEY', moneyDate: '2026-11-28', method: null, accountTail: null } }).text)
      .toMatch(/Sisa Rp50\.000 dibawa/);
  });
  it('status bayar tunai tidak menyebut sumber uang atau pembayar', () => {
    expect(paymentText({ kind: 'MONEY', moneyDate: '2026-12-01', method: 'CASH', accountTail: null })).toBe('Dibayar 1 Desember 2026 lewat tunai.');
  });
});

describe('kepala tiga angka (GAJ-107)', () => {
  it('pendapatan = diterima + belum; perkiraan bila ada slip Perkiraan', () => {
    expect(headline([{ net: 3000000, estimate: false, paid: true }, { net: 150000, estimate: false, paid: false }]))
      .toEqual({ income: 3150000, received: 3000000, pending: 150000, estimate: false });
    expect(headline([{ net: 2500000, estimate: true, paid: false }]).estimate).toBe(true);
  });
});

it('hitungan karyawan tanpa hari dalam toleransi (KEH-119)', () => {
  expect(withoutTolerance([{ note: 'Dalam toleransi' }, { note: null }, { note: 'Ditiadakan' }])).toEqual([{ note: null }, { note: 'Ditiadakan' }]);
});
