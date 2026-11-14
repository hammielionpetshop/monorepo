import { describe, expect, it } from 'vitest';
import { redirectTarget, webForHost, webOriginsFromEnv, type WebOrigins } from './web-split';

const origins: WebOrigins = { hris: 'https://hris.test', logistics: 'https://logistik.test' };
const off: WebOrigins = { hris: 'https://hris.test', logistics: null };

describe('pembagian alamat HRIS / Logistik (F2-7b §3)', () => {
  it('web ditentukan dari Host; tanpa alamat Logistik selalu HRIS', () => {
    expect(webForHost('logistik.test', origins)).toBe('logistik');
    expect(webForHost('LOGISTIK.TEST', origins)).toBe('logistik');
    expect(webForHost('hris.test', origins)).toBe('hris');
    expect(webForHost('logistik.test', off)).toBe('hris');
    expect(webForHost(null, origins)).toBe('hris');
  });

  it('layar Logistik dan Trip Saya di HRIS dialihkan ke Logistik dengan alamat yang sama', () => {
    expect(redirectTarget('hris', '/logistik/trip', '?tab=RUNNING', origins)).toBe('https://logistik.test/logistik/trip?tab=RUNNING');
    expect(redirectTarget('hris', '/trip-saya', '', origins)).toBe('https://logistik.test/trip-saya');
    expect(redirectTarget('hris', '/logistikx', '', origins)).toBeNull();
  });

  it('layar HRIS di Logistik dialihkan ke HRIS; Beranda, Pemberitahuan, Profil tetap', () => {
    expect(redirectTarget('logistik', '/gaji/kasbon', '?tab=periksa', origins)).toBe('https://hris.test/gaji/kasbon?tab=periksa');
    expect(redirectTarget('logistik', '/kehadiran/absen-trip', '', origins)).toBe('https://hris.test/kehadiran/absen-trip');
    for (const path of ['/', '/pemberitahuan', '/profil', '/logistik/bensin-mobil', '/trip-saya']) {
      expect(redirectTarget('logistik', path, '', origins)).toBeNull();
    }
  });

  it('pemisahan belum diatur: tidak ada pengalihan', () => {
    expect(redirectTarget('hris', '/logistik/trip', '', off)).toBeNull();
  });

  it('alamat env dibersihkan; yang tidak sah diabaikan', () => {
    expect(webOriginsFromEnv({ HRIS_PUBLIC_URL: 'https://hris.test/', LOGISTICS_PUBLIC_URL: 'javascript:alert(1)' }))
      .toEqual({ hris: 'https://hris.test', logistics: null });
  });
});
