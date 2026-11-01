import { describe, expect, it } from 'vitest';
import { detectImageMime, isFileId } from './detect';

describe('berkas terlindungi', () => {
  const pad = (bytes: number[]) => new Uint8Array([...bytes, ...new Array(16).fill(0)]);
  it('jenis dibaca dari isi berkas', () => {
    expect(detectImageMime(pad([0xff, 0xd8, 0xff]))).toBe('image/jpeg');
    expect(detectImageMime(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(detectImageMime(pad([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe('image/webp');
    expect(detectImageMime(new TextEncoder().encode('<svg onload="x"></svg>'))).toBeNull();
    expect(detectImageMime(pad([0x25, 0x50, 0x44, 0x46]))).toBeNull();
  });
  it('id berkas harus uuid (menutup jalur "../")', () => {
    expect(isFileId('3f2b6c1e-aaaa-4bbb-8ccc-0123456789ab')).toBe(true);
    expect(isFileId('../../etc/passwd')).toBe(false);
  });
});
