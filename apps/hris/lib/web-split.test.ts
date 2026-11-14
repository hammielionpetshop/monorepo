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
    expect(redirectTarget('hris', '/logistics/trips', '?tab=RUNNING', origins)).toBe('https://logistik.test/logistics/trips?tab=RUNNING');
    expect(redirectTarget('hris', '/my-trips', '', origins)).toBe('https://logistik.test/my-trips');
    expect(redirectTarget('hris', '/logistikx', '', origins)).toBeNull();
  });

  it('layar HRIS di Logistik dialihkan ke HRIS; Beranda, Pemberitahuan, Profil tetap', () => {
    expect(redirectTarget('logistik', '/payroll/advances', '?tab=periksa', origins)).toBe('https://hris.test/payroll/advances?tab=periksa');
    expect(redirectTarget('logistik', '/attendance/trip-attendance', '', origins)).toBe('https://hris.test/attendance/trip-attendance');
    for (const path of ['/', '/notifications', '/profile', '/logistics/fuel', '/my-trips']) {
      expect(redirectTarget('logistik', path, '', origins)).toBeNull();
    }
  });

  it('pemisahan belum diatur: tidak ada pengalihan', () => {
    expect(redirectTarget('hris', '/logistics/trips', '', off)).toBeNull();
  });

  it('alamat env dibersihkan; yang tidak sah diabaikan', () => {
    expect(webOriginsFromEnv({ HRIS_PUBLIC_URL: 'https://hris.test/', LOGISTICS_PUBLIC_URL: 'javascript:alert(1)' }))
      .toEqual({ hris: 'https://hris.test', logistics: null });
  });
});
