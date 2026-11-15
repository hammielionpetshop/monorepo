import { describe, expect, it } from 'vitest';
import {
  breakOverMinutes, distanceMeters, earlyLeaveMinutes, guardDecision, lateMinutes, locationFresh, matchAssistShift, screenState,
  validPoint, wibClock, wibInstant, withinOutCutoff, type ScreenInput,
} from './attendance';

const day = '2026-11-02';
const at = (time: string, date = day) => wibInstant(date, time);
const hours = { startTime: '08:00', endTime: '17:00', breakMinutes: 60, breakStartFrom: '11:00', breakStartUntil: '15:00' };
const base: ScreenInput = {
  now: at('08:00'), workDate: day, times: {}, hours, breakRequired: true, closed: false, hasPoint: true, earliestInMinutes: 120, minOutMinutes: 15,
};

describe('tombol berlabel (W9, KEH-17, 83, 108)', () => {
  it('belum masuk: hanya Masuk, seberapa pun terlambatnya (no 19)', () => {
    expect(screenState({ ...base, now: at('15:00') }).buttons).toEqual(['IN']);
  });
  it('sudah masuk, dalam rentang istirahat: Istirahat dan Pulang', () => {
    expect(screenState({ ...base, now: at('12:00'), times: { IN: at('08:00') } }).buttons).toEqual(['BREAK', 'OUT']);
  });
  it('di luar rentang atau tidak wajib: hanya Pulang', () => {
    expect(screenState({ ...base, now: at('10:00'), times: { IN: at('08:00') } }).buttons).toEqual(['OUT']);
    expect(screenState({ ...base, now: at('12:00'), breakRequired: false, times: { IN: at('08:00') } }).buttons).toEqual(['OUT']);
  });
  it('shift tanpa istirahat: tombol Istirahat tidak tampil (KEH-82)', () => {
    const none = { ...hours, breakMinutes: null, breakStartFrom: null, breakStartUntil: null };
    expect(screenState({ ...base, hours: none, now: at('12:00'), times: { IN: at('08:00') } }).buttons).toEqual(['OUT']);
  });
  it('sedang istirahat: hanya Masuk Kembali; sudah kembali: Istirahat tidak muncul lagi', () => {
    expect(screenState({ ...base, now: at('12:30'), times: { IN: at('08:00'), BREAK: at('12:00') } }).buttons).toEqual(['RETURN']);
    expect(screenState({ ...base, now: at('13:30'), times: { IN: at('08:00'), BREAK: at('12:00'), RETURN: at('13:00') } }).buttons).toEqual(['OUT']);
  });
  it('sudah pulang: tidak ada', () => {
    expect(screenState({ ...base, times: { IN: at('08:00'), OUT: at('17:00') } })).toMatchObject({ status: 'OUT', buttons: [] });
  });
  it('hari tutup dan cabang tanpa titik: tidak ada (no 30, KAR-25)', () => {
    expect(screenState({ ...base, closed: true })).toMatchObject({ status: 'CLOSED', buttons: [] });
    expect(screenState({ ...base, hasPoint: false })).toMatchObject({ status: 'NO_POINT', buttons: [] });
  });
});

describe('batas jam', () => {
  it('W10: pulang paling cepat 15 menit', () => {
    expect(screenState({ ...base, now: at('08:10'), times: { IN: at('08:00') } })).toMatchObject({ outLocked: true, opensAt: '08.15' });
    expect(screenState({ ...base, now: at('08:16'), times: { IN: at('08:00') } })).toMatchObject({ outLocked: false });
  });
  it('W11: batas 04.00 keesokan hari', () => {
    expect(withinOutCutoff(day, at('01:30', '2026-11-03'), 4)).toBe(true);
    expect(withinOutCutoff(day, at('04:10', '2026-11-03'), 4)).toBe(false);
  });
  it('W12: masuk paling awal 2 jam (no 24)', () => {
    expect(screenState({ ...base, now: at('05:59') })).toMatchObject({ status: 'TOO_EARLY', buttons: [], opensAt: '06.00' });
    expect(screenState({ ...base, now: at('06:00') }).buttons).toEqual(['IN']);
  });
  it('shift belum ditentukan: Masuk boleh kapan saja (KEH-103)', () => {
    expect(screenState({ ...base, hours: null, now: at('03:00') }).buttons).toEqual(['IN']);
  });
  it('W14: lewat batas istirahat', () => {
    expect(breakOverMinutes(at('12:00'), at('13:20'), 60)).toBe(20);
    expect(breakOverMinutes(at('12:00'), at('12:50'), 60)).toBe(0);
  });
  it('lokasi berlaku 5 menit', () => {
    expect(locationFresh(at('08:00'), at('08:05'))).toBe(true);
    expect(locationFresh(at('08:00'), at('08:06'))).toBe(false);
  });
});

describe('telat dan pulang cepat', () => {
  it('telat dibulatkan ke bawah (KEH-21, §9 butir 7)', () => {
    expect(lateMinutes(day, '08:00', new Date(at('08:05').getTime() + 40_000))).toBe(5);
    expect(lateMinutes(day, '08:00', at('07:30'))).toBe(0);
    expect(lateMinutes(day, '08:00', at('15:00'))).toBe(420);
  });
  it('W13: telat dihitung dari jam shift cabang tujuan', () => {
    expect(lateMinutes(day, '09:00', at('09:10'))).toBe(10);
  });
  it('pulang cepat, termasuk shift lewat tengah malam (KEH-24)', () => {
    expect(earlyLeaveMinutes(day, '08:00', '17:00', at('16:30'))).toBe(30);
    expect(earlyLeaveMinutes(day, '08:00', '17:00', at('17:30'))).toBe(0);
    expect(earlyLeaveMinutes(day, '22:00', '02:00', at('23:00'))).toBe(180);
    expect(earlyLeaveMinutes(day, '22:00', '02:00', at('01:30', '2026-11-03'))).toBe(30);
  });
  it('W15: jam tampil dalam WIB', () => {
    expect(wibClock(new Date('2026-11-02T01:02:00Z'))).toBe('08.02');
  });
});

describe('lokasi', () => {
  const pusat = { latitude: -7.350564720030627, longitude: 108.10865608125447 };
  const depan = { latitude: -7.35148882045046, longitude: 108.11040975611628 };
  it('jarak sesuai spec L3a: Toko Pusat ke Toko Depan sekitar 219 m', () => {
    expect(distanceMeters(pusat, depan)).toBeGreaterThanOrEqual(215);
    expect(distanceMeters(pusat, depan)).toBeLessThanOrEqual(223);
    expect(distanceMeters(pusat, pusat)).toBe(0);
  });
  it('titik tidak masuk akal sama dengan tanpa lokasi', () => {
    expect(validPoint(-7.3, 108.1)).toBe(true);
    expect(validPoint(null, 108.1)).toBe(false);
    expect(validPoint(91, 108.1)).toBe(false);
    expect(validPoint(Number.NaN, 108.1)).toBe(false);
  });
});

describe('penjaga cabang (no 25 s.d. 27, KEH-85)', () => {
  const ani = { employeeId: 1, name: 'Ani', onBreakUntil: null };
  const budi = { employeeId: 2, name: 'Budi', onBreakUntil: '13.00' };
  it('masih ada penjaga lain: boleh', () => {
    expect(guardDecision([ani], 1)).toEqual({ ok: true });
  });
  it('teman sedang istirahat: ditolak dengan namanya', () => {
    expect(guardDecision([budi], 1)).toEqual({ ok: false, reason: 'FRIEND_ON_BREAK', friend: budi });
  });
  it('satu-satunya penjaga: ditolak sendiri', () => {
    expect(guardDecision([], 1)).toEqual({ ok: false, reason: 'ALONE' });
  });
  it('angka minimum dibaca dari pengaturan', () => {
    expect(guardDecision([ani], 2)).toEqual({ ok: false, reason: 'ALONE' });
  });
});

describe('shift perbantuan (W13, KEH-109)', () => {
  const shifts = [{ id: 1, name: 'Pagi' }, { id: 2, name: 'Siang' }];
  it('nama sama dipakai, tidak peka huruf besar', () => {
    expect(matchAssistShift('pagi ', shifts)?.id).toBe(1);
  });
  it('tidak ada yang sama: orang memilih sendiri', () => {
    expect(matchAssistShift('Malam', shifts)).toBeNull();
    expect(matchAssistShift(null, shifts)).toBeNull();
  });
});
