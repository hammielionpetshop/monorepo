import { describe, expect, it } from 'vitest';
import { wibInstant } from './attendance';
import {
  causesFor, daysLeft, deadlineAfter, detectEvents, earliestInProblem, forgotKindOf, forgotSequence, isContiguous, lastDayOf,
  lateSubmitAllowed, returnProblem, seriesAllowed, streakHits, urgencyOf, type DayFacts,
} from './clarification';
import { dayStatus, summarizeDays } from './review';

const base: DayFacts = {
  scheduled: true, closed: false, dayOff: false, absent: false, present: false, outCounted: false, hasBreak: false, hasReturn: false,
  lateMinutes: null, earlyLeaveMinutes: null,
};
const T = { late: 30, early: 30 };
const kinds = (facts: Partial<DayFacts>) => detectEvents({ ...base, ...facts }, T).map((e) => e.kind);

describe('KEH-150: alpha hanya untuk hari kerja tanpa absen yang tidak dibereskan', () => {
  it('hari kerja tanpa absen = alpha', () => expect(kinds({})).toEqual(['ALPHA']));
  it('dilewati: hari tutup, libur, izin/sakit/cuti (termasuk menunggu, KEH-147), tanpa shift (§9 butir 7)', () => {
    expect(kinds({ closed: true })).toEqual([]);
    expect(kinds({ dayOff: true })).toEqual([]);
    expect(kinds({ absent: true })).toEqual([]);
    expect(kinds({ scheduled: false })).toEqual([]);
  });
});

describe('KEH-151: lima jenis kejadian dan ambang 30 menit', () => {
  it('hadir tanpa jam pulang berlaku = lupa absen pulang (termasuk Laporan Pulang tidak terkirim, KEH-89)', () => {
    expect(kinds({ present: true })).toEqual(['FORGOT_OUT']);
  });
  it('Istirahat tanpa Masuk Kembali = lupa Masuk Kembali', () => {
    expect(kinds({ present: true, outCounted: true, hasBreak: true })).toEqual(['FORGOT_RETURN']);
  });
  it('telat dan pulang cepat hanya di atas ambang', () => {
    expect(kinds({ present: true, outCounted: true, lateMinutes: 30, earlyLeaveMinutes: 30 })).toEqual([]);
    expect(kinds({ present: true, outCounted: true, lateMinutes: 31, earlyLeaveMinutes: 45 })).toEqual(['LATE', 'EARLY_LEAVE']);
    expect(detectEvents({ ...base, present: true, outCounted: true, lateMinutes: 42 }, T)[0]).toEqual({ kind: 'LATE', minutes: 42 });
  });
  it('lupa absen masuk tidak punya penanda sendiri: hadir tanpa absen = alpha, sebabnya Lupa absen (KEH-54)', () => {
    expect(causesFor('ALPHA')).toEqual(['SICK', 'SICK_LETTER', 'FORGOT', 'SUDDEN_PERMIT']);
    expect(forgotKindOf('ALPHA', 'FORGOT')).toBe('IN');
    expect(forgotKindOf('ALPHA', 'SICK')).toBeNull();
  });
});

describe('KEH-58, 151: batas 3 hari pukul 23.59', () => {
  const deadline = deadlineAfter('2026-11-02', 3);
  it('berlaku sampai 5 Nov 23.59 WIB', () => {
    expect(lastDayOf(deadline)).toBe('2026-11-05');
    expect(daysLeft(deadline, wibInstant('2026-11-05', '23:59'))).toBe(0);
    expect(daysLeft(deadline, wibInstant('2026-11-06', '00:00'))).toBeNull();
  });
  it('kuning sisa 1 hari, merah hari terakhir', () => {
    expect(urgencyOf(deadline, wibInstant('2026-11-03', '09:00'))).toBe('normal');
    expect(urgencyOf(deadline, wibInstant('2026-11-04', '09:00'))).toBe('warn');
    expect(urgencyOf(deadline, wibInstant('2026-11-05', '09:00'))).toBe('danger');
  });
});

describe('KEH-152: alpha berturut-turut', () => {
  it('libur di tengah tidak memutus; hari Hadir dan alpha yang tidak dipilih memutus', () => {
    expect(isContiguous(['2026-11-02', '2026-11-04'], new Set(), new Set())).toBe(true);
    expect(isContiguous(['2026-11-02', '2026-11-04'], new Set(), new Set(['2026-11-03']))).toBe(false);
    expect(isContiguous(['2026-11-02', '2026-11-04'], new Set(['2026-11-03']), new Set())).toBe(false);
  });
  it('rangkaian hanya untuk sakit dan izin mendadak; lupa absen per hari', () => {
    expect(seriesAllowed('SICK')).toBe(true);
    expect(seriesAllowed('SUDDEN_PERMIT')).toBe(true);
    expect(seriesAllowed('FORGOT')).toBe(false);
  });
});

describe('KEH-155: pengajuan terlambat hanya untuk lupa absen', () => {
  it('lupa pulang dan Masuk Kembali boleh; alpha hanya dengan sebab Lupa absen; telat tidak', () => {
    expect(lateSubmitAllowed('FORGOT_OUT', 'FORGOT')).toBe(true);
    expect(lateSubmitAllowed('FORGOT_RETURN', 'FORGOT')).toBe(true);
    expect(lateSubmitAllowed('ALPHA', 'FORGOT')).toBe(true);
    expect(lateSubmitAllowed('ALPHA', 'SICK')).toBe(false);
    expect(lateSubmitAllowed('LATE', 'REASON')).toBe(false);
  });
});

describe('KEH-154: kejadian ke-n menurut tanggal kejadian, tiga jenis terpisah', () => {
  it('urutan per jenis menurut tanggal, bukan urutan disahkan; dicabut = dihitung ulang', () => {
    const items = [
      { id: 10, kind: 'OUT' as const, workDate: '2026-11-10' }, { id: 11, kind: 'OUT' as const, workDate: '2026-11-03' },
      { id: 12, kind: 'IN' as const, workDate: '2026-11-04' }, { id: 13, kind: 'OUT' as const, workDate: '2026-11-05' },
    ];
    const seq = forgotSequence(items);
    expect([seq.get(11), seq.get(13), seq.get(10), seq.get(12)]).toEqual([1, 2, 3, 1]);
    expect(forgotSequence(items.filter((item) => item.id !== 11)).get(10)).toBe(2);
  });
});

describe('KEH-157: tanda tidak masuk berturut-turut', () => {
  const day = (date: string, mark: 'COUNT' | 'BREAK' | 'SKIP') => ({ date, mark, cause: mark === 'COUNT' ? 'Alpha' : null });
  const dates = Array.from({ length: 10 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`);
  it('hari ke-7 sekali; libur tidak memutus dan tidak dihitung; Hadir memutus', () => {
    const run = dates.map((date, i) => day(date, i === 3 ? 'SKIP' : 'COUNT'));
    expect(streakHits(run, 7)).toEqual([{ startDate: '2026-11-01', flaggedDate: '2026-11-08', causes: Array(7).fill('Alpha') }]);
    const broken = dates.map((date, i) => day(date, i === 5 ? 'BREAK' : 'COUNT'));
    expect(streakHits(broken, 7)).toEqual([]);
  });
});

describe('KEH-18, 111: jam yang masuk akal', () => {
  it('jam masuk paling awal 2 jam sebelum shift; Masuk Kembali sesudah Istirahat dan sebelum Pulang', () => {
    expect(earliestInProblem('2026-11-02', '08:00', wibInstant('2026-11-02', '05:59'), 120)).toMatch(/2 jam/);
    expect(earliestInProblem('2026-11-02', '08:00', wibInstant('2026-11-02', '06:00'), 120)).toBeNull();
    const brk = wibInstant('2026-11-02', '12:00');
    expect(returnProblem(brk, wibInstant('2026-11-02', '11:59'), null)).not.toBeNull();
    expect(returnProblem(brk, wibInstant('2026-11-02', '13:00'), wibInstant('2026-11-02', '12:30'))).not.toBeNull();
    expect(returnProblem(brk, wibInstant('2026-11-02', '13:00'), null)).toBeNull();
  });
});

describe('Status hari Alpha (KEH-118)', () => {
  it('absen, hari tutup, libur, dan izin menang atas alpha; alpha dihitung di rekap', () => {
    expect(dayStatus(false, false, false, null, true)).toBe('ALPHA');
    expect(dayStatus(true, false, false, null, true)).toBe('PRESENT');
    expect(dayStatus(false, false, false, 'SICK', true)).toBe('SICK');
    expect(dayStatus(false, false, false, null, false)).toBe('UNDETERMINED');
    expect(summarizeDays([{ status: 'ALPHA', lateMinutes: null, earlyLeaveMinutes: null, pendingReviews: 0 }]).alpha).toBe(1);
  });
});
