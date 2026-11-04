import { describe, expect, it } from 'vitest';
import { accuracyProblem, correctionReason, mapUrl, outsidePoint, parseCoordinates } from './store-points';

describe('titik toko (spec LT1 §13.4)', () => {
  it('akurasi GPS paling buruk sesuai pengaturan', () => {
    expect(accuracyProblem(12, 50)).toBeNull();
    expect(accuracyProblem(50, 50)).toBeNull();
    expect(accuracyProblem(50.4, 50)).toMatch(/50 m, harus 50 m/);
    expect(accuracyProblem(null, 50)).toMatch(/tidak terbaca/);
  });

  it('tempel angka koordinat', () => {
    expect(parseCoordinates('-7.35050, 108.10860')).toEqual({ ok: true, latitude: -7.3505, longitude: 108.1086 });
    expect(parseCoordinates(' -7.3505 108.1086 ')).toMatchObject({ ok: true, latitude: -7.3505 });
    expect(parseCoordinates('-7.3505;108.1086')).toMatchObject({ ok: true, longitude: 108.1086 });
  });

  it('tempel tautan Google Maps', () => {
    expect(parseCoordinates('https://www.google.com/maps/place/Toko/@-7.3501,108.1001,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d-7.3505!4d108.1086'))
      .toEqual({ ok: true, latitude: -7.3505, longitude: 108.1086 });
    expect(parseCoordinates('https://www.google.com/maps/@-7.3501,108.1001,17z')).toEqual({ ok: true, latitude: -7.3501, longitude: 108.1001 });
    expect(parseCoordinates('https://maps.google.com/?q=-7.35,108.11')).toEqual({ ok: true, latitude: -7.35, longitude: 108.11 });
    expect(parseCoordinates('https://www.google.com/maps/search/?api=1&query=-7.35%2C108.11')).toEqual({ ok: true, latitude: -7.35, longitude: 108.11 });
  });

  it('menolak yang tidak berisi koordinat', () => {
    expect(parseCoordinates('')).toMatchObject({ ok: false });
    expect(parseCoordinates('https://maps.app.goo.gl/abc123')).toMatchObject({ ok: false, error: expect.stringMatching(/Tautan pendek/) });
    expect(parseCoordinates('Jl. Merdeka 5')).toMatchObject({ ok: false });
    expect(parseCoordinates('0, 0')).toMatchObject({ ok: false, error: expect.stringMatching(/tidak masuk akal/) });
    expect(parseCoordinates('95, 108')).toMatchObject({ ok: false });
  });

  it('alasan laporan titik salah wajib', () => {
    expect(correctionReason('  ')).toMatchObject({ ok: false });
    expect(correctionReason('Titik di  rumah   sebelah')).toEqual({ ok: true, value: 'Titik di rumah sebelah' });
  });

  it('tautan peta dan tanda di luar titik', () => {
    expect(mapUrl(-7.3505, 108.1086)).toBe('https://www.google.com/maps/search/?api=1&query=-7.350500,108.108600');
    expect(outsidePoint(101, 100)).toBe(true);
    expect(outsidePoint(100, 100)).toBe(false);
    expect(outsidePoint(null, 100)).toBe(false);
  });
});
