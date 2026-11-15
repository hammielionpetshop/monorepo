import { describe, expect, it } from 'vitest';
import { objectionDeadline, scheduleInstallments, takeDeductions, type DeductionItem } from './deductions';

describe('scheduleInstallments (GAJ-80)', () => {
  it('Rp600.000 tiga kali: Rp200.000 per slip, periode berurutan', () => {
    expect(scheduleInstallments(600_000, 3, '2026-10-26')).toEqual([
      { sequence: 1, periodStart: '2026-10-26', amount: 200_000 },
      { sequence: 2, periodStart: '2026-11-26', amount: 200_000 },
      { sequence: 3, periodStart: '2026-12-26', amount: 200_000 },
    ]);
  });
  it('sisa pembagian masuk cicilan terakhir', () => {
    expect(scheduleInstallments(100_000, 3, '2026-10-26').map((i) => i.amount)).toEqual([33_333, 33_333, 33_334]);
  });
});

describe('takeDeductions (GAJ-75)', () => {
  const item = (group: DeductionItem['group'], amount: number, date = '2026-11-01', key = `${group}${amount}`): DeductionItem => ({ group, key, label: key, date, amount });

  it('contoh v3: pendapatan Rp1.000.000, (a) 300rb (b) 200rb (c) 400rb (d) 250rb → kasbon terpotong 100rb, sisa 150rb', () => {
    const result = takeDeductions(1_000_000, [item('d', 250_000), item('c', 400_000), item('b', 200_000), item('a', 300_000)]);
    expect(result.items.map((i) => [i.group, i.taken, i.left])).toEqual([['a', 300_000, 0], ['b', 200_000, 0], ['c', 400_000, 0], ['d', 100_000, 150_000]]);
    expect(result).toMatchObject({ net: 0, carried: 150_000 });
  });

  it('dalam satu kelompok: sisa slip lalu dulu, lalu tanggal paling lama', () => {
    const result = takeDeductions(150_000, [
      item('b', 100_000, '2026-11-10', 'baru'), item('b', 100_000, '2026-11-02', 'lama'), { ...item('b', 100_000, '2026-11-20', 'sisa'), carried: true },
    ]);
    expect(result.items.map((i) => [i.key, i.taken])).toEqual([['sisa', 100_000], ['lama', 50_000], ['baru', 0]]);
  });

  it('gaji bersih tidak pernah di bawah Rp0', () => {
    expect(takeDeductions(0, [item('a', 10_000)]).net).toBe(0);
    expect(takeDeductions(50_000, []).net).toBe(50_000);
  });
});

describe('objectionDeadline (GAJ-81)', () => {
  it('diberi tahu 3 November 10.00 WIB → batas 6 November 23.59.59 WIB', () => {
    expect(objectionDeadline(new Date('2026-11-03T03:00:00Z')).toISOString()).toBe('2026-11-06T16:59:59.000Z');
  });
  it('diberi tahu 3 November 23.30 WIB tetap dihitung dari tanggal WIB', () => {
    expect(objectionDeadline(new Date('2026-11-03T16:30:00Z')).toISOString()).toBe('2026-11-06T16:59:59.000Z');
  });
});
