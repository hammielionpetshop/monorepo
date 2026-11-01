import { describe, expect, it } from 'vitest';
import {
  closingTime, closureCovers, closuresOverlap, earliestEffectiveDate, mondayOf, qrLink, resolveShift, rotationIndex,
  shiftHoursProblem, versionOn, type ShiftVersion,
} from './schedule';

const version = (id: number, effectiveFrom: string, effectiveUntil: string | null = null, cancelled = false): ShiftVersion => ({
  id, startTime: '08:00', endTime: '16:00', breakMinutes: null, breakStartFrom: null, breakStartUntil: null,
  effectiveFrom, effectiveUntil, cancelled,
});
const hours = { startTime: '08:00', endTime: '16:00', breakMinutes: null, breakStartFrom: null, breakStartUntil: null };

describe('jam kerja bertanggal (KEH-02)', () => {
  it('W1: tanggal sebelum perubahan memakai jam lama', () => {
    const list = [version(1, '2026-01-01'), version(2, '2026-11-01')];
    expect(versionOn(list, '2026-10-31')?.id).toBe(1);
    expect(versionOn(list, '2026-11-01')?.id).toBe(2);
  });
  it('versi momen tertentu menang selama masanya, lalu versi tetap berlaku lagi', () => {
    const list = [version(1, '2026-01-01'), version(2, '2026-12-24', '2026-12-26')];
    expect(versionOn(list, '2026-12-25')?.id).toBe(2);
    expect(versionOn(list, '2026-12-27')?.id).toBe(1);
  });
  it('versi dibatalkan diabaikan; sebelum berlaku tidak ada versi', () => {
    expect(versionOn([version(1, '2026-01-01'), version(2, '2026-11-01', null, true)], '2026-12-01')?.id).toBe(1);
    expect(versionOn([version(1, '2026-11-01')], '2026-10-01')).toBeNull();
  });
  it('berlaku paling cepat besok; shift baru boleh hari ini', () => {
    expect(earliestEffectiveDate('2026-11-30', true)).toBe('2026-12-01');
    expect(earliestEffectiveDate('2026-11-30', false)).toBe('2026-11-30');
  });
});

describe('giliran (KEH-06)', () => {
  it('W2: kelompok bertukar tiap Senin', () => {
    expect(rotationIndex(0, '2026-11-02', '2026-11-02')).toBe(0);
    expect(rotationIndex(1, '2026-11-02', '2026-11-02')).toBe(1);
    expect(rotationIndex(0, '2026-11-02', '2026-11-09')).toBe(1);
    expect(rotationIndex(1, '2026-11-02', '2026-11-09')).toBe(0);
  });
  it('W3: minggu terlewat tidak membalik giliran', () => {
    expect(rotationIndex(0, '2026-11-02', '2026-11-16')).toBe(0);
    expect(rotationIndex(0, '2026-11-02', '2026-11-23')).toBe(1);
  });
  it('minggu sebelum acuan tetap menghasilkan 0 atau 1', () => {
    expect(rotationIndex(0, '2026-11-09', '2026-11-02')).toBe(1);
  });
  it('mondayOf: Minggu masuk minggu yang dimulai Senin sebelumnya', () => {
    expect(mondayOf('2026-11-01')).toBe('2026-10-26');
    expect(mondayOf('2026-11-02')).toBe('2026-11-02');
  });
});

describe('urutan baca shift (KEH-07)', () => {
  it('perubahan harian > jadwal minggu > kelompok > satu-satunya shift > belum ditentukan', () => {
    expect(resolveShift({ dayChangeShiftId: 1, assignmentShiftId: 2, groupShiftId: 3, soleShiftId: 4 })).toEqual({ shiftId: 1, source: 'DAY_CHANGE' });
    expect(resolveShift({ assignmentShiftId: 2, groupShiftId: 3 }).shiftId).toBe(2);
    expect(resolveShift({ groupShiftId: 3, soleShiftId: 4 }).shiftId).toBe(3);
    expect(resolveShift({ soleShiftId: 4 }).source).toBe('SOLE');
    expect(resolveShift({})).toEqual({ shiftId: null, source: 'NONE' });
  });
});

describe('isian jam', () => {
  it('pulang lewat tengah malam boleh, jam sama ditolak', () => {
    expect(shiftHoursProblem({ ...hours, startTime: '20:00', endTime: '02:00' })).toBeNull();
    expect(shiftHoursProblem({ ...hours, endTime: '08:00' })).toMatch(/tidak boleh sama/);
  });
  it('istirahat terisi semua atau kosong semua (KEH-82)', () => {
    expect(shiftHoursProblem({ ...hours, breakMinutes: 60 })).toMatch(/semua/);
    expect(shiftHoursProblem({ ...hours, breakMinutes: 60, breakStartFrom: '11:00', breakStartUntil: '15:00' })).toBeNull();
    expect(shiftHoursProblem({ ...hours, breakMinutes: 60, breakStartFrom: '15:00', breakStartUntil: '11:00' })).toMatch(/sebelum/);
  });
  it('W5: jam tutup mengikuti jam pulang shift terakhir', () => {
    expect(closingTime([{ position: 0, endTime: '16:00' }, { position: 1, endTime: '21:00' }])).toBe('21:00');
    expect(closingTime([{ position: 0, endTime: '16:00' }, { position: 1, endTime: '20:00' }])).toBe('20:00');
    expect(closingTime([])).toBeNull();
  });
});

describe('hari tutup (KEH-79)', () => {
  const all = { startDate: '2026-12-25', endDate: '2026-12-26', branchId: null };
  it('semua cabang mencakup tiap cabang pada rentangnya', () => {
    expect(closureCovers(all, 7, '2026-12-26')).toBe(true);
    expect(closureCovers(all, 7, '2026-12-27')).toBe(false);
    expect(closureCovers({ ...all, branchId: 1 }, 7, '2026-12-25')).toBe(false);
  });
  it('tumpukan: semua cabang bertabrakan dengan cabang mana pun', () => {
    expect(closuresOverlap(all, { startDate: '2026-12-26', endDate: '2026-12-26', branchId: 3 })).toBe(true);
    expect(closuresOverlap({ ...all, branchId: 1 }, { ...all, branchId: 2 })).toBe(false);
    expect(closuresOverlap(all, { startDate: '2026-12-27', endDate: '2026-12-27', branchId: 3 })).toBe(false);
  });
});

it('QR berisi tautan absen', () => {
  expect(qrLink('https://hris.example/', 'abc')).toBe('https://hris.example/absen?c=abc');
});
