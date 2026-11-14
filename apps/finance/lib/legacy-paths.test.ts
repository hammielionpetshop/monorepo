import { describe, expect, it } from 'vitest';
import { legacyPathTarget } from './legacy-paths';

describe('alamat lama Finance → alamat baru', () => {
  it('dialihkan per bagian', () => {
    expect(legacyPathTarget('/laba-rugi/rincian')).toBe('/profit-loss/details');
    expect(legacyPathTarget('/mutasi/7')).toBe('/movements/7');
    expect(legacyPathTarget('/tutup-bulan')).toBe('/month-close');
  });
  it('alamat baru dan beranda tidak dialihkan', () => {
    expect(legacyPathTarget('/')).toBeNull();
    expect(legacyPathTarget('/profit-loss')).toBeNull();
  });
});
