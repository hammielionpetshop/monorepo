import { describe, expect, it } from 'vitest';
import {
  attendancePay, dayAmount, escalationAt, escalationSeries, proratedBase, sickLetterAt, waiverKey, type PayDay, type PayInput, type PayRules,
} from './attendance-pay';

// Angka HRIS lama yang berlaku sejak 26 September 2026 (spec L4b §3.1).
const OLD_RULES: PayRules = {
  divisor: 26, lateRate: 1000, overtimeRate: 10000,
  permitSick: { start: 1, step: 0, max: 2 }, sudden: { start: 1, step: 0, max: 2 }, alpha: { start: 1, step: 0, max: 2 },
  sickLetter: { day1: 0, day2to3: 0.5, day4plus: 1 }, training: 1, compensation: 1,
  fines: { IN: 15000, OUT: 5000, RETURN: 5000, surcharge: 5000, dayOffMissing: 10000 },
};
const RISING: PayRules = {
  ...OLD_RULES,
  permitSick: { start: 1.5, step: 0.2, max: 2 }, sudden: { start: 1.25, step: 0.25, max: 2 }, alpha: { start: 1.5, step: 0.5, max: 3 },
};

const PERIOD = { start: '2026-10-26', end: '2026-11-25' };
const day = (workDate: string, over: Partial<PayDay> = {}): PayDay => ({ workDate, status: 'PRESENT', lateMinutes: null, absence: null, tags: [], ...over });

function input(over: Partial<PayInput> = {}): PayInput {
  return {
    monthly: 2_600_000, period: PERIOD, workedFrom: PERIOD.start, workedUntil: PERIOD.end,
    ownerPosition: false, training: false, compensationApplies: true, tracked: true, days: [],
    lateTolerance: () => 5, lateExplained: new Set(), overtime: [], forgot: [], dayOffMissing: false, workRequests: [],
    waived: new Map(), rules: RISING, ...over,
  };
}
const line = (result: ReturnType<typeof attendancePay>, key: string) => result.lines.find((l) => l.key === key);

describe('tangga pengali seperti HRIS lama (start, step, max)', () => {
  it('naik tiap hari lalu mentok', () => {
    expect(escalationSeries({ start: 1.5, step: 0.2, max: 2 })).toEqual([1.5, 1.7, 1.9, 2]);
    expect(escalationAt({ start: 1.5, step: 0.2, max: 2 }, 9)).toBe(2);
  });
  it('step 0 = rata, tidak naik', () => {
    expect(escalationSeries({ start: 1, step: 0, max: 2 })).toEqual([1]);
    expect(escalationAt({ start: 1, step: 0, max: 2 }, 5)).toBe(1);
  });
  it('sakit dengan surat: 0 · 0,5 · 0,5 · 1', () => {
    expect([1, 2, 3, 4, 7].map((n) => sickLetterAt(OLD_RULES.sickLetter, n))).toEqual([0, 0.5, 0.5, 1, 1]);
  });
});

describe('rupiah per hari dan prorata', () => {
  it('pembulatan per hari ,5 ke atas (contoh Rp390.385)', () => {
    expect(dayAmount(2_900_000, 1.5, 26) + dayAmount(2_900_000, 2, 26)).toBe(390_385);
    expect(dayAmount(2_600_000, 1, 26)).toBe(100_000);
  });
  it('masuk tanggal 11 November di periode 31 hari', () => {
    expect(proratedBase(3_100_000, PERIOD, '2026-11-11', PERIOD.end)).toBe(1_500_000);
    expect(proratedBase(3_100_000, PERIOD, PERIOD.start, PERIOD.end)).toBe(3_100_000);
  });
});

describe('attendancePay', () => {
  it('telat: dalam toleransi 0, lebih dipotong seluruh menit; dijelaskan dan ditiadakan 0', () => {
    const result = attendancePay(input({
      days: [day('2026-10-27', { lateMinutes: 5 }), day('2026-10-28', { lateMinutes: 6 }), day('2026-10-29', { lateMinutes: 40 }), day('2026-10-30', { lateMinutes: 12 })],
      lateExplained: new Set(['2026-10-29']),
      waived: new Map([[waiverKey('LATE', '2026-10-30'), 'QR rusak']]),
    }));
    const late = line(result, 'LATE');
    expect(late?.amount).toBe(6000);
    expect(late?.details.map((d) => d.amount)).toEqual([0, 6000, 0, 0]);
    expect(late?.details[3].note).toContain('QR rusak');
  });

  it('tiga tangga terpisah; izin duka ikut tangga izin', () => {
    const result = attendancePay(input({
      days: [
        day('2026-10-27', { status: 'PERMIT', absence: 'PERMIT' }),
        day('2026-10-28', { status: 'ALPHA' }),
        day('2026-10-29', { status: 'PERMIT', absence: 'BEREAVEMENT' }),
        day('2026-10-30', { status: 'SICK', absence: 'SICK' }),
        day('2026-10-31', { status: 'PERMIT', absence: 'PERMIT_SUDDEN' }),
      ],
    }));
    expect(line(result, 'PERMIT_SICK')?.details.map((d) => d.text)).toEqual([
      'Hari ke-1 (izin), pengali 1,5×', 'Hari ke-2 (izin duka), pengali 1,7×', 'Hari ke-3 (sakit tanpa surat), pengali 1,9×',
    ]);
    expect(line(result, 'PERMIT_SICK')?.amount).toBe(150_000 + 170_000 + 190_000);
    expect(line(result, 'ALPHA')?.amount).toBe(150_000);
    expect(line(result, 'SUDDEN')?.amount).toBe(125_000);
  });

  it('sakit dengan surat per periode, cuti dan libur dibayar penuh', () => {
    const result = attendancePay(input({
      days: [
        day('2026-11-03', { status: 'SICK', absence: 'SICK_LETTER' }),
        day('2026-11-20', { status: 'SICK', absence: 'SICK_LETTER' }),
        day('2026-11-21', { status: 'SICK', absence: 'SICK_LETTER' }),
        day('2026-11-22', { status: 'LEAVE', absence: 'ANNUAL_LEAVE' }),
        day('2026-11-23', { status: 'DAY_OFF' }),
        day('2026-11-24', { status: 'CLOSED' }),
      ],
    }));
    expect(line(result, 'SICK_LETTER')?.amount).toBe(0 + 50_000 + 50_000);
    expect(result.paidFull).toEqual({ dayOff: 1, leave: 1, closed: 1 });
  });

  it('Training: rata pengali training, surat dokter tetap aturan surat', () => {
    const result = attendancePay(input({
      training: true,
      days: [day('2026-10-27', { status: 'ALPHA' }), day('2026-10-28', { status: 'ALPHA' }), day('2026-10-29', { status: 'ALPHA' }),
        day('2026-10-30', { status: 'SICK', absence: 'SICK_LETTER' }), day('2026-10-31', { status: 'SICK', absence: 'SICK_LETTER' })],
    }));
    expect(line(result, 'ALPHA')?.amount).toBe(300_000);
    expect(line(result, 'SICK_LETTER')?.amount).toBe(50_000);
  });

  it('belum ditentukan dan alpha yang penjelasannya menunggu tidak dipotong', () => {
    const result = attendancePay(input({
      days: [day('2026-10-27', { status: 'UNDETERMINED' }), day('2026-10-28', { status: 'ALPHA', tags: ['Penjelasan menunggu keputusan'] })],
    }));
    expect(result.deductions).toBe(0);
    expect(result.pending).toHaveLength(2);
  });

  it('lembur, kompensasi libur (hanya yang masuk), dan jabatan tanpa kompensasi', () => {
    const base = { overtime: [{ workDate: '2026-11-02', hours: 2 }], workRequests: [{ workDate: '2026-11-08', present: true }, { workDate: '2026-11-15', present: false }] };
    const result = attendancePay(input({ ...base, rules: OLD_RULES }));
    expect(line(result, 'OVERTIME')?.amount).toBe(20_000);
    expect(line(result, 'COMPENSATION')?.amount).toBe(100_000);
    expect(line(attendancePay(input({ ...base, compensationApplies: false })), 'COMPENSATION')).toBeUndefined();
  });

  it('denda lupa absen: tambahan mulai kejadian ke-5 per jenis; ditiadakan tetap tampil; tidak memilih libur', () => {
    const forgot = [1, 2, 3, 4, 5].map((nth) => ({ eventId: nth, kind: 'OUT' as const, workDate: `2026-11-0${nth}`, nth }));
    const result = attendancePay(input({
      forgot: [...forgot, { eventId: 9, kind: 'IN', workDate: '2026-11-06', nth: 1 }],
      dayOffMissing: true,
      waived: new Map([[waiverKey('FINE', '2026-11-01', 'OUT'), 'Server bermasalah']]),
    }));
    const fine = line(result, 'FINE');
    expect(fine?.details.map((d) => d.amount)).toEqual([0, 5000, 5000, 5000, 10000, 15000, 10000]);
    expect(fine?.amount).toBe(50_000);
  });

  it('Pemilik dan orang tidak diabsen hanya mendapat gaji tetap', () => {
    const facts = { days: [day('2026-10-27', { status: 'ALPHA' })], overtime: [{ workDate: '2026-11-02', hours: 3 }] };
    for (const result of [attendancePay(input({ ...facts, ownerPosition: true })), attendancePay(input({ ...facts, tracked: false }))]) {
      expect(result.lines.map((l) => l.key)).toEqual(['BASE']);
      expect(result.estimate).toBe(2_600_000);
    }
  });

  it('perkiraan = gaji tetap + tambahan − potongan', () => {
    const result = attendancePay(input({ rules: OLD_RULES, days: [day('2026-10-27', { status: 'ALPHA' })], overtime: [{ workDate: '2026-11-02', hours: 1 }] }));
    expect(result.estimate).toBe(2_600_000 + 10_000 - 100_000);
  });
});
