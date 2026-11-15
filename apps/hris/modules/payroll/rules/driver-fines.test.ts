import { describe, expect, it } from 'vitest';
import { earliestKindChange, endKind, fineAmountOn, kindChangeProblem, occurredOnProblem, tabOf, targetProblem, versionOn } from './driver-fines';

const v = (id: number, effectiveOn: string, amount: number, active = true, cancelled = false) => ({ id, effectiveOn, amount, active, cancelled });

describe('versionOn / fineAmountOn', () => {
  const versions = [v(1, '2026-10-30', 10_000), v(2, '2026-11-10', 15_000), v(3, '2026-11-20', 15_000, false), v(4, '2026-11-15', 99_000, true, true)];
  it('mengambil versi terbaru sebelum atau pada tanggal itu', () => {
    expect(versionOn(versions, '2026-11-09')?.id).toBe(1);
    expect(fineAmountOn(versions, '2026-11-10')).toBe(15_000);
  });
  it('versi yang dibatalkan diabaikan', () => {
    expect(fineAmountOn(versions, '2026-11-16')).toBe(15_000);
  });
  it('sebelum ada versi atau sesudah nonaktif = tidak bisa didenda', () => {
    expect(fineAmountOn(versions, '2026-10-29')).toBeNull();
    expect(fineAmountOn(versions, '2026-11-21')).toBeNull();
  });
});

describe('earliestKindChange', () => {
  const today = '2026-11-04';
  it('jenis baru, naik, dan aktif lagi = 7 hari', () => {
    expect(earliestKindChange(null, { amount: 10_000, active: true }, today)).toBe('2026-11-11');
    expect(earliestKindChange({ amount: 10_000, active: true }, { amount: 12_000, active: true }, today)).toBe('2026-11-11');
    expect(earliestKindChange({ amount: 10_000, active: false }, { amount: 10_000, active: true }, today)).toBe('2026-11-11');
  });
  it('turun, sama, dan nonaktif = 1 hari', () => {
    expect(earliestKindChange({ amount: 10_000, active: true }, { amount: 5_000, active: true }, today)).toBe('2026-11-05');
    expect(earliestKindChange({ amount: 10_000, active: true }, { amount: 10_000, active: true }, today)).toBe('2026-11-05');
    expect(earliestKindChange({ amount: 10_000, active: true }, { amount: 20_000, active: false }, today)).toBe('2026-11-05');
  });
  it('isian ditolak bila lebih cepat dari batas', () => {
    expect(kindChangeProblem({ amount: 10_000, active: true, effectiveOn: '2026-11-10', reason: 'nominal naik sesuai rapat' }, '2026-11-11')).toMatch(/paling cepat/);
    expect(kindChangeProblem({ amount: 10_000, active: true, effectiveOn: '2026-11-11', reason: 'nominal naik sesuai rapat' }, '2026-11-11')).toBeNull();
    expect(kindChangeProblem({ amount: 0, active: true, effectiveOn: '2026-11-11', reason: 'nominal naik sesuai rapat' }, '2026-11-11')).toMatch(/Nominal/);
  });
});

describe('occurredOnProblem (S3)', () => {
  it('hari ini sampai 7 hari ke belakang', () => {
    expect(occurredOnProblem('2026-11-04', '2026-11-04', 7)).toBeNull();
    expect(occurredOnProblem('2026-10-28', '2026-11-04', 7)).toBeNull();
    expect(occurredOnProblem('2026-10-27', '2026-11-04', 7)).toMatch(/7 hari/);
    expect(occurredOnProblem('2026-11-05', '2026-11-04', 7)).toMatch(/sesudah hari ini/);
  });
});

describe('targetProblem', () => {
  const base = { id: 5, weekly: true, onTrip: false, ownerOrGm: false };
  it('orang Mingguan atau awak trip sah', () => {
    expect(targetProblem(base, 1)).toBeNull();
    expect(targetProblem({ ...base, weekly: false, onTrip: true }, 1)).toBeNull();
  });
  it('bukan diri sendiri, Pemilik/GM, atau orang Bulanan tanpa trip', () => {
    expect(targetProblem(base, 5)).toMatch(/diri sendiri/);
    expect(targetProblem({ ...base, ownerOrGm: true }, 1)).toMatch(/Pemilik/);
    expect(targetProblem({ ...base, weekly: false }, 1)).toMatch(/Mingguan atau awak trip/);
    expect(targetProblem(null, 1)).toMatch(/tidak aktif/);
  });
});

describe('tab dan akhir denda', () => {
  it('status ke tab', () => {
    expect(tabOf('PENDING')).toBe('PENDING');
    expect(tabOf('ACTIVE')).toBe('ACTIVE');
    expect(tabOf('WAIVED')).toBe('DONE');
  });
  it('batalkan sebelum terpotong, tiadakan sesudahnya', () => {
    expect(endKind(false)).toBe('CANCELLED');
    expect(endKind(true)).toBe('WAIVED');
  });
});
