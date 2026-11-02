import { describe, expect, it } from 'vitest';
import { wibInstant } from './attendance';
import {
  EMPTY_STATE, correctionProblem, countableDates, dayStatus, effectiveDay, payPeriodOf, recomputeMinutes, repeatOutsideHit, sameState,
  sharedPointPairs, shiftPeriod, summarizeDays, wibLocal, withinTolerance, type CorrectionState,
} from './review';

const day = '2026-10-07';
const at = (time: string, date = day) => wibInstant(date, time);
const original = { branchId: 1, shiftId: 2, shiftVersionId: 3, inAt: at('08:07'), outAt: at('17:00'), lateMinutes: 7, earlyLeaveMinutes: 0 };
const correction = (id: number, patch: Partial<CorrectionState> = {}): CorrectionState => ({
  id, branchId: 1, shiftId: 2, shiftVersionId: 3, inAt: at('08:00'), outAt: at('17:00'), lateMinutes: 0, earlyLeaveMinutes: 0, ...patch,
});

describe('keadaan hari berlaku (spec L3c §3)', () => {
  it('tanpa koreksi memakai catatan asli', () => {
    expect(effectiveDay(original, [])).toMatchObject({ correctionId: null, lateMinutes: 7, state: { inAt: original.inAt } });
  });

  it('koreksi terbaru menang, urutan masukan tidak berpengaruh', () => {
    const result = effectiveDay(original, [correction(5, { inAt: at('08:03'), lateMinutes: 3 }), correction(2)]);
    expect(result).toMatchObject({ correctionId: 5, lateMinutes: 3 });
    expect(result.state.inAt).toEqual(at('08:03'));
  });

  it('koreksi dibalik: keadaan kembali seperti asli', () => {
    const reversed = correction(9, { inAt: original.inAt, lateMinutes: 7 });
    const result = effectiveDay(original, [correction(4), reversed]);
    expect(sameState(result.state, { ...original })).toBe(true);
    expect(result.lateMinutes).toBe(7);
  });

  it('Tambah absen pada hari tanpa absen, lalu dibalik menjadi tanpa absen lagi', () => {
    const added = effectiveDay(null, [correction(1)]);
    expect(added.state.inAt).toEqual(at('08:00'));
    const undone = effectiveDay(null, [correction(1), correction(2, { ...EMPTY_STATE, lateMinutes: null, earlyLeaveMinutes: null })]);
    expect(undone.state.inAt).toBeNull();
    expect(effectiveDay(null, []).state).toEqual(EMPTY_STATE);
  });
});

describe('status hari (KEH-118)', () => {
  it('absen nyata menang atas hari tutup; hari kosong tidak ditebak', () => {
    expect(dayStatus(true, true)).toBe('PRESENT');
    expect(dayStatus(false, true)).toBe('CLOSED');
    expect(dayStatus(false, false)).toBe('UNDETERMINED');
  });

  it('hari berjalan dan sebelum tanggal masuk tidak dihitung', () => {
    expect(countableDates('2026-10-26', '2026-11-25', '2026-10-29', null)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28']);
    expect(countableDates('2026-10-26', '2026-11-25', '2026-10-29', '2026-10-28')).toEqual(['2026-10-28']);
    expect(countableDates('2026-09-26', '2026-10-25', '2026-11-02', null)).toHaveLength(30);
  });
});

describe('periode 26 sampai 25 (KEH-119)', () => {
  it('tanggal 1–25 ikut periode yang mulai 26 bulan lalu; 26 ke atas periode baru', () => {
    expect(payPeriodOf('2026-11-02')).toEqual({ start: '2026-10-26', end: '2026-11-25' });
    expect(payPeriodOf('2026-11-25')).toEqual({ start: '2026-10-26', end: '2026-11-25' });
    expect(payPeriodOf('2026-11-26')).toEqual({ start: '2026-11-26', end: '2026-12-25' });
    expect(payPeriodOf('2027-01-05')).toEqual({ start: '2026-12-26', end: '2027-01-25' });
    expect(shiftPeriod('2026-10-26', -1)).toBe('2026-09-26');
    expect(shiftPeriod('2026-12-26', 1)).toBe('2027-01-26');
  });
});

describe('hitung ulang telat dan pulang cepat (KEH-29)', () => {
  const hours = { startTime: '08:00', endTime: '17:00' };
  const state = (inAt: Date, outAt: Date | null) => ({ branchId: 1, shiftId: 2, shiftVersionId: 3, inAt, outAt });

  it('dibulatkan ke bawah per menit; jabatan tanpa telat kosong; tanpa shift kosong', () => {
    expect(recomputeMinutes(day, hours, state(new Date(at('08:05').getTime() + 40_000), at('16:30')), true)).toEqual({ lateMinutes: 5, earlyLeaveMinutes: 30 });
    expect(recomputeMinutes(day, hours, state(at('08:05'), null), false)).toEqual({ lateMinutes: null, earlyLeaveMinutes: null });
    expect(recomputeMinutes(day, null, state(at('08:05'), at('17:00')), true)).toEqual({ lateMinutes: null, earlyLeaveMinutes: null });
  });

  it('shift lewat tengah malam: pulang keesokan hari', () => {
    const night = { startTime: '20:00', endTime: '04:00' };
    expect(recomputeMinutes(day, night, state(at('20:10'), at('03:00', '2026-10-08')), true)).toEqual({ lateMinutes: 10, earlyLeaveMinutes: 60 });
  });

  it('dalam toleransi hanya untuk telat 1 sampai batas', () => {
    expect(withinTolerance(5, 5)).toBe(true);
    expect(withinTolerance(6, 5)).toBe(false);
    expect(withinTolerance(0, 5)).toBe(false);
    expect(withinTolerance(null, 5)).toBe(false);
  });
});

describe('jam koreksi', () => {
  it('isian datetime-local dibaca sebagai WIB', () => {
    expect(wibLocal('2026-10-07T08:00')).toEqual(at('08:00'));
    expect(wibLocal('08:00')).toBeNull();
  });

  it('masuk di hari itu; pulang sesudah masuk dan sebelum batas 04.00', () => {
    expect(correctionProblem(day, at('08:00'), at('17:00'), 4)).toBeNull();
    expect(correctionProblem(day, at('23:00', '2026-10-06'), null, 4)).toContain('Jam masuk');
    expect(correctionProblem(day, at('08:00'), at('07:00'), 4)).toContain('sesudah');
    expect(correctionProblem(day, at('20:00'), at('03:59', '2026-10-08'), 4)).toBeNull();
    expect(correctionProblem(day, at('20:00'), at('04:00', '2026-10-08'), 4)).toContain('04.00');
  });
});

describe('rekap satu hitungan (KEH-76)', () => {
  it('menjumlah hadir, telat, pulang cepat, tutup, belum ditentukan, perlu ditinjau', () => {
    expect(summarizeDays([
      { status: 'PRESENT', lateMinutes: 5, earlyLeaveMinutes: 0, pendingReviews: 1 },
      { status: 'PRESENT', lateMinutes: 0, earlyLeaveMinutes: 20, pendingReviews: 0 },
      { status: 'CLOSED', lateMinutes: null, earlyLeaveMinutes: null, pendingReviews: 0 },
      { status: 'UNDETERMINED', lateMinutes: null, earlyLeaveMinutes: null, pendingReviews: 0 },
      { status: 'DAY_OFF', lateMinutes: null, earlyLeaveMinutes: null, pendingReviews: 0 },
    ])).toEqual({ present: 2, lateCount: 1, lateMinutes: 5, earlyCount: 1, closed: 1, dayOff: 1, undetermined: 1, permit: 0, sick: 0, leave: 0, pendingReviews: 1 });
  });
});

describe('pola lokasi (KEH-115)', () => {
  it('3 kali luar titik dalam rentang dan hari terbaru ikut luar titik', () => {
    const days = [
      { workDate: '2026-10-07', outsideRecordIds: [30] },
      { workDate: '2026-10-06', outsideRecordIds: [] },
      { workDate: '2026-10-05', outsideRecordIds: [10, 20] },
    ];
    expect(repeatOutsideHit(days, 3)).toEqual([10, 20, 30]);
    expect(repeatOutsideHit(days, 4)).toBeNull();
    expect(repeatOutsideHit([{ workDate: '2026-10-08', outsideRecordIds: [] }, ...days], 3)).toBeNull();
    expect(repeatOutsideHit([], 3)).toBeNull();
  });

  it('titik nyaris sama: hanya dua orang berbeda, sekali per pasangan', () => {
    const base = { latitude: -7.35, longitude: 108.1 };
    const near = { latitude: -7.35004, longitude: 108.1 }; // ±4 m
    const far = { latitude: -7.36, longitude: 108.1 };
    const pairs = sharedPointPairs([
      { recordId: 1, employeeId: 5, ...base },
      { recordId: 2, employeeId: 6, ...near },
      { recordId: 3, employeeId: 5, ...near },
      { recordId: 4, employeeId: 7, ...far },
    ], 10);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].map((point) => point.employeeId)).toEqual([5, 6]);
    expect(sharedPointPairs([{ recordId: 1, employeeId: 5, ...base }, { recordId: 3, employeeId: 5, ...near }], 10)).toEqual([]);
  });
});
