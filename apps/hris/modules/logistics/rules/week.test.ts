import { describe, expect, it } from 'vitest';
import { nextWeek, prevWeek, weekOf, weekRegimes, weekStartsBetween } from './week';

const fri = weekRegimes([{ from: '2026-01-01', value: 'FRI' }]);

describe('minggu upah bertanggal (spec L7 §3.5)', () => {
  it('bawaan Jumat–Kamis', () => {
    expect(weekOf('2026-11-03', fri)).toEqual({ start: '2026-10-30', end: '2026-11-05' }); // Selasa
    expect(weekOf('2026-11-05', fri)).toEqual({ start: '2026-10-30', end: '2026-11-05' }); // Kamis
    expect(weekOf('2026-11-06', fri)).toEqual({ start: '2026-11-06', end: '2026-11-12' }); // Jumat
    expect(weekRegimes([])).toEqual([{ boundary: null, day: 'FRI' }]);
  });

  it('ganti hari awal: minggu berjalan dipotong, minggu berikutnya mengikuti hari baru', () => {
    // Senin mulai 4 Nov (Rabu) → Senin pertama 9 Nov. Minggu Jumat 6 Nov jadi 6–8 Nov.
    const r = weekRegimes([{ from: '2026-01-01', value: 'FRI' }, { from: '2026-11-04', value: 'MON' }]);
    expect(weekOf('2026-11-03', r)).toEqual({ start: '2026-10-30', end: '2026-11-05' });
    expect(weekOf('2026-11-07', r)).toEqual({ start: '2026-11-06', end: '2026-11-08' });
    expect(weekOf('2026-11-09', r)).toEqual({ start: '2026-11-09', end: '2026-11-15' });
    expect(nextWeek('2026-11-06', r).start).toBe('2026-11-09');
    expect(prevWeek('2026-11-09', r).start).toBe('2026-11-06');
    expect(weekStartsBetween('2026-10-30', '2026-11-10', r)).toEqual(['2026-11-09', '2026-11-06', '2026-10-30']);
  });

  it('hari baru jatuh di tengah minggu berjalan memotong minggu itu', () => {
    // Minggu mulai 31 Okt (Sabtu) → Minggu pertama 1 Nov: minggu 30 Okt jadi 30–31 Okt.
    const r = weekRegimes([{ from: '2026-01-01', value: 'FRI' }, { from: '2026-10-31', value: 'SUN' }]);
    expect(weekOf('2026-10-30', r)).toEqual({ start: '2026-10-30', end: '2026-10-31' });
    expect(weekOf('2026-11-03', r)).toEqual({ start: '2026-11-01', end: '2026-11-07' });
  });

  it('perubahan sesudahnya yang lebih dulu mulai menggantikan rezim yang belum sempat dimulai', () => {
    // Senin berlaku 4 Nov (mulai 9 Nov), lalu Sabtu berlaku 5 Nov (mulai 7 Nov): Senin tidak pernah dimulai.
    const r = weekRegimes([{ from: '2026-01-01', value: 'FRI' }, { from: '2026-11-04', value: 'MON' }, { from: '2026-11-05', value: 'SAT' }]);
    expect(r).toEqual([{ boundary: null, day: 'FRI' }, { boundary: '2026-11-07', day: 'SAT' }]);
    expect(weekOf('2026-11-06', r)).toEqual({ start: '2026-11-06', end: '2026-11-06' });
    expect(weekOf('2026-11-10', r)).toEqual({ start: '2026-11-07', end: '2026-11-13' });
  });
});
