import { describe, expect, it } from 'vitest';
import { parsePeriodKey, weekKey, weeklyCloseOpensAt, weeklyPayDate, weeklyReminderDue, weeklySlipNumber } from './wage-week';

describe('slip mingguan (spec L7 §3.5)', () => {
  it('kunci periode memisahkan minggu dari periode bulanan', () => {
    expect(parsePeriodKey('2026-10-26')).toEqual({ weekly: false, start: '2026-10-26' });
    expect(parsePeriodKey(weekKey('2026-10-30'))).toEqual({ weekly: true, start: '2026-10-30' });
    expect(parsePeriodKey('W2027-02-26')).toEqual({ weekly: true, start: '2027-02-26' });
    expect(parsePeriodKey('2026-10-30')).toBeNull();
    expect(parsePeriodKey('Wxx')).toBeNull();
  });

  it('nomor, tombol Tutup, dan jatuh bayar', () => {
    expect(weeklySlipNumber('2026-11-05', 3)).toBe('SM-20261105-0003');
    expect(weeklyCloseOpensAt('2026-11-05', 10).toISOString()).toBe('2026-11-06T03:00:00.000Z'); // Jumat 10.00 WIB
    expect(weeklyPayDate('2026-11-05')).toBe('2026-11-07'); // Sabtu
  });

  it('pengingat: hari Tutup aktif di jam pengingat, sesudahnya pukul 07.00', () => {
    expect(weeklyReminderDue('2026-11-05', '2026-11-05', 15, 15)).toBe(false);
    expect(weeklyReminderDue('2026-11-05', '2026-11-06', 7, 15)).toBe(false);
    expect(weeklyReminderDue('2026-11-05', '2026-11-06', 15, 15)).toBe(true);
    expect(weeklyReminderDue('2026-11-05', '2026-11-07', 7, 15)).toBe(true);
    expect(weeklyReminderDue('2026-11-05', '2026-11-07', 15, 15)).toBe(false);
  });
});
