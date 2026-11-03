import { describe, expect, it } from 'vitest';
import {
  contentProblem, crewProblem, fridayOf, garageCheck, isHanging, manualDateProblem, normalizePlate, tripNumber, wagesFor, wibDate,
} from './trip';

const duties: Record<number, { drive: boolean; assist: boolean }> = {
  1: { drive: true, assist: true }, 2: { drive: false, assist: true }, 3: { drive: true, assist: false },
};
const duty = (id: number) => duties[id] ?? null;
const name = (id: number) => `Orang ${id}`;

describe('aturan trip L6', () => {
  it('awak: driver wajib, izin menyetir/kenek dicek, orang tidak boleh ganda', () => {
    expect(crewProblem(null, [], duty, name)).toBe('Pilih driver.');
    expect(crewProblem(2, [], duty, name)).toContain('tidak punya izin menyetir');
    expect(crewProblem(1, [3], duty, name)).toContain('tidak punya izin jadi kenek');
    expect(crewProblem(1, [1], duty, name)).toContain('dua kali');
    expect(crewProblem(1, [9], duty, name)).toContain('tidak aktif');
    expect(crewProblem(1, [2], duty, name)).toBeNull();
    expect(crewProblem(3, [], duty, name)).toBeNull();
  });

  it('isi trip: rute kirim atau minimal satu supplier, supplier tidak ganda', () => {
    expect(contentProblem(null, [])).toContain('rute kirim');
    expect(contentProblem(null, [7, 7])).toContain('sekali');
    expect(contentProblem(5, [])).toBeNull();
    expect(contentProblem(null, [7])).toBeNull();
  });

  it('ritase kirim + belanja per supplier selesai, per awak (penjelasan owner 2026-11-03)', () => {
    const crew = [{ employeeId: 1, role: 'DRIVER' as const }, { employeeId: 2, role: 'ASSISTANT' as const }];
    const rows = wagesFor({ routeId: 10, crew, shoppingDone: [{ id: 100, routeId: 70 }] });
    expect(rows).toEqual([
      { employeeId: 1, role: 'DRIVER', kind: 'RITASE', shoppingId: null, routeId: 10, withAssistant: true },
      { employeeId: 1, role: 'DRIVER', kind: 'SHOPPING', shoppingId: 100, routeId: 70, withAssistant: true },
      { employeeId: 2, role: 'ASSISTANT', kind: 'RITASE', shoppingId: null, routeId: 10, withAssistant: true },
      { employeeId: 2, role: 'ASSISTANT', kind: 'SHOPPING', shoppingId: 100, routeId: 70, withAssistant: true },
    ]);
  });

  it('trip belanja saja tanpa ritase; trip tanpa kenek = tanpa kenek; dua supplier = dua belanja', () => {
    const solo = [{ employeeId: 1, role: 'DRIVER' as const }];
    const shopOnly = wagesFor({ routeId: null, crew: solo, shoppingDone: [{ id: 1, routeId: 70 }, { id: 2, routeId: 71 }] });
    expect(shopOnly.map((r) => r.kind)).toEqual(['SHOPPING', 'SHOPPING']);
    expect(shopOnly.every((r) => !r.withAssistant)).toBe(true);
    expect(wagesFor({ routeId: 10, crew: solo, shoppingDone: [] })).toHaveLength(1);
  });

  it('Sampai Garasi: di dalam radius lolos, di luar ditolak, tanpa lokasi ditolak, pagar mati lolos bertanda', () => {
    const garage = { latitude: -7.3505, longitude: 108.1086, radiusM: 100, name: 'Gudang' };
    expect(garageCheck({ point: { latitude: -7.3505, longitude: 108.1087 }, garage, fenceOff: false })).toMatchObject({ ok: true, fenceOff: false });
    const far = garageCheck({ point: { latitude: -7.36, longitude: 108.1086 }, garage, fenceOff: false });
    expect(far.ok).toBe(false);
    expect(garageCheck({ point: null, garage, fenceOff: false }).ok).toBe(false);
    expect(garageCheck({ point: null, garage: null, fenceOff: false }).ok).toBe(false);
    expect(garageCheck({ point: { latitude: -7.36, longitude: 108.1086 }, garage, fenceOff: true })).toMatchObject({ ok: true, fenceOff: true });
  });

  it('menggantung mulai jam batas hari sesudah tanggal trip (LOG-31)', () => {
    expect(isHanging('2026-11-02', new Date('2026-11-03T11:59:00+07:00'), 12)).toBe(false);
    expect(isHanging('2026-11-02', new Date('2026-11-03T12:00:00+07:00'), 12)).toBe(true);
    expect(isHanging(null, new Date(), 12)).toBe(false);
  });

  it('tanggal, minggu Jumat–Kamis, nomor trip, plat', () => {
    expect(wibDate(new Date('2026-11-02T18:30:00Z'))).toBe('2026-11-03');
    expect(fridayOf('2026-11-05')).toBe('2026-10-30'); // Kamis
    expect(fridayOf('2026-11-06')).toBe('2026-11-06'); // Jumat
    expect(fridayOf('2026-11-08')).toBe('2026-11-06'); // Minggu
    expect(tripNumber('2026-11-03', 2)).toBe('TR-261103-2');
    expect(normalizePlate('  d  8209   yr ')).toBe('D 8209 YR');
  });

  it('ritase tangan paling jauh N hari ke belakang, bukan tanggal depan', () => {
    expect(manualDateProblem('2026-11-04', '2026-11-03', 14)).toContain('belum lewat');
    expect(manualDateProblem('2026-10-20', '2026-11-03', 14)).toBeNull();
    expect(manualDateProblem('2026-10-19', '2026-11-03', 14)).toContain('14 hari');
  });
});
