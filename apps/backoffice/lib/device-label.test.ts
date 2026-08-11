import { describe, expect, it } from 'vitest';
import { describeDevice } from './device-label';

describe('describeDevice', () => {
  it('null bila user-agent tidak ada', () => {
    expect(describeDevice(null)).toBeNull();
  });

  it('mengenali Chrome di Android', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
    expect(describeDevice(ua)).toBe('Chrome / Android');
  });

  it('Edge tidak salah dibaca sebagai Chrome', () => {
    // UA Edge menyebut "Chrome" juga — urutan pemeriksaannya yang menentukan.
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
    expect(describeDevice(ua)).toBe('Edge / Windows');
  });

  it('Chrome tidak salah dibaca sebagai Safari', () => {
    // UA Chrome menyebut "Safari" di ujungnya.
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    expect(describeDevice(ua)).toBe('Chrome / macOS');
  });

  it('Safari asli di iOS', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    expect(describeDevice(ua)).toBe('Safari / iOS');
  });

  it('null bila tak ada yang dikenali sama sekali', () => {
    expect(describeDevice('curl/8.4.0')).toBeNull();
  });

  it('dipotong agar muat di kolom varchar(200)', () => {
    const ua = `Mozilla/5.0 (Windows NT 10.0) Chrome/120 ${'x'.repeat(500)}`;
    expect(describeDevice(ua)!.length).toBeLessThanOrEqual(200);
  });
});
