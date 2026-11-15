import { describe, expect, it } from 'vitest';
import {
  addYears, checkDeadline, countKindOf, cutBereavement, leaveBalance, leaveYearOf, letterDaysLeft, sickRunLength, statusOfCount, workdaysIn,
  type AbsenceRules,
} from './absence';
import { dayStatus, summarizeDays } from './review';

const RULES: AbsenceRules = {
  annualQuota: 10, annualNoticeDays: 7, permitNoticeDays: 2, lateSubmitDays: 3, sickNoLetterMaxDays: 2, bereavementDays: 2, letterGraceDays: 3,
};

describe('L3f aturan izin, sakit, dan cuti', () => {
  it('KEH-41: hari kerja melewati libur dan hari tutup', () => {
    const off = new Set(['2026-11-12', '2026-11-14']);
    expect(workdaysIn('2026-11-11', '2026-11-15', (d) => off.has(d))).toEqual(['2026-11-11', '2026-11-13', '2026-11-15']);
  });

  it('KEH-142: izin H-2 biasa, kurang dari itu izin mendadak sampai 3 hari sesudah hari pertama', () => {
    const today = '2026-11-10';
    expect(checkDeadline('PERMIT', '2026-11-12', today, RULES)).toEqual({ ok: true, sudden: false });
    expect(checkDeadline('PERMIT', '2026-11-11', today, RULES)).toEqual({ ok: true, sudden: true });
    expect(checkDeadline('PERMIT', '2026-11-10', today, RULES)).toEqual({ ok: true, sudden: true });
    expect(checkDeadline('PERMIT', '2026-11-07', today, RULES)).toEqual({ ok: true, sudden: true });
    expect(checkDeadline('PERMIT', '2026-11-06', today, RULES).ok).toBe(false);
  });

  it('KEH-48, 141: cuti H-7, kurang dari itu ditolak', () => {
    expect(checkDeadline('ANNUAL_LEAVE', '2026-11-17', '2026-11-10', RULES)).toEqual({ ok: true, sudden: false });
    const late = checkDeadline('ANNUAL_LEAVE', '2026-11-16', '2026-11-10', RULES);
    expect(late.ok).toBe(false);
  });

  it('KEH-141: sakit dan duka boleh sampai 3 hari sesudah hari pertama, lewat itu ditolak', () => {
    for (const kind of ['SICK', 'SICK_LETTER', 'BEREAVEMENT'] as const) {
      expect(checkDeadline(kind, '2026-11-07', '2026-11-10', RULES)).toEqual({ ok: true, sudden: false });
      expect(checkDeadline(kind, '2026-11-06', '2026-11-10', RULES).ok).toBe(false);
    }
  });

  it('KEH-143: deret sakit tanpa surat dihitung pada hari kerja, termasuk sakit yang sudah ada di sebelahnya', () => {
    const workdays = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-13', '2026-11-14'];
    expect(sickRunLength(workdays, new Set(['2026-11-10', '2026-11-11']), new Set())).toBe(2);
    expect(sickRunLength(workdays, new Set(['2026-11-11']), new Set(['2026-11-09', '2026-11-10']))).toBe(3);
    // Libur 12 Nov di tengah tidak memutus deret: 11 dan 13 berturut-turut pada hari kerja.
    expect(sickRunLength(workdays, new Set(['2026-11-13']), new Set(['2026-11-11']))).toBe(2);
    // Sakit lama yang tidak bersambung tidak ikut.
    expect(sickRunLength(workdays, new Set(['2026-11-14']), new Set(['2026-11-09', '2026-11-10']))).toBe(1);
  });

  it('KEH-146: izin duka dipotong pada hari kerja ke-2', () => {
    expect(cutBereavement(['a', 'b', 'c'], 2)).toEqual({ days: ['a', 'b'], cut: true });
    expect(cutBereavement(['a'], 2)).toEqual({ days: ['a'], cut: false });
  });

  it('KEH-145: tahun cuti mulai tepat 1 tahun sesudah tanggal bergabung dan berlaku setahun', () => {
    expect(leaveYearOf('2026-03-01', '2027-02-28')).toBeNull();
    expect(leaveYearOf('2026-03-01', '2027-03-01')).toEqual({ index: 1, start: '2027-03-01', end: '2028-02-29' });
    expect(leaveYearOf('2026-03-01', '2028-02-29')?.index).toBe(1);
    expect(leaveYearOf('2026-03-01', '2028-03-01')).toEqual({ index: 2, start: '2028-03-01', end: '2029-02-28' });
    expect(addYears('2024-02-29', 1)).toBe('2025-02-28');
    expect(leaveYearOf('2024-02-29', '2026-01-15')?.start).toBe('2025-02-28');
  });

  it('KEH-145: sisa = jatah − pesan + kembali − hangus + sesuaikan; USE tidak mengubah sisa', () => {
    expect(leaveBalance(10, [
      { kind: 'RESERVE', days: 3 }, { kind: 'USE', days: 3 }, { kind: 'RESERVE', days: 2 }, { kind: 'RETURN', days: 2 }, { kind: 'ADJUST', days: -1 },
    ])).toBe(6);
    expect(leaveBalance(10, [{ kind: 'EXPIRE', days: 10 }])).toBe(0);
  });

  it('KEH-51, 143: surat menyusul paling lambat 3 hari sesudah masuk kembali', () => {
    expect(letterDaysLeft(null, '2026-11-20', 3)).toBe(3);
    expect(letterDaysLeft('2026-11-16', '2026-11-18', 3)).toBe(1);
    expect(letterDaysLeft('2026-11-16', '2026-11-19', 3)).toBe(0);
    expect(letterDaysLeft('2026-11-16', '2026-11-20', 3)).toBeNull();
  });

  it('hitungan per hari: surat menyusul dihitung sakit tanpa surat, izin mendadak terpisah', () => {
    expect(countKindOf('SICK_LETTER', false, true)).toBe('SICK');
    expect(countKindOf('SICK_LETTER', false, false)).toBe('SICK_LETTER');
    expect(countKindOf('PERMIT', true, false)).toBe('PERMIT_SUDDEN');
    expect(statusOfCount('BEREAVEMENT')).toBe('PERMIT');
    expect(statusOfCount('ANNUAL_LEAVE')).toBe('LEAVE');
  });

  it('KEH-118: absen nyata menang, lalu hari tutup, libur, izin/sakit/cuti; kosong tidak ditebak', () => {
    expect(dayStatus(true, false, false, 'SICK')).toBe('PRESENT');
    expect(dayStatus(false, true, false, 'SICK')).toBe('CLOSED');
    expect(dayStatus(false, false, true, 'LEAVE')).toBe('DAY_OFF');
    expect(dayStatus(false, false, false, 'LEAVE')).toBe('LEAVE');
    expect(dayStatus(false, false, false, null)).toBe('UNDETERMINED');
    const totals = summarizeDays(['PERMIT', 'SICK', 'SICK', 'LEAVE'].map((status) => ({
      status: status as 'PERMIT', lateMinutes: null, earlyLeaveMinutes: null, pendingReviews: 0,
    })));
    expect([totals.permit, totals.sick, totals.leave]).toEqual([1, 2, 1]);
  });
});
