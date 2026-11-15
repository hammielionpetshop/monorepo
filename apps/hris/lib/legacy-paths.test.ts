import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { legacyPathTarget } from './legacy-paths';

const APP_DIR = join(__dirname, '..', 'app');

/** Semua alamat halaman yang ada (folder berisi page.tsx), dengan grup `(app)` dibuang. */
function pagePaths(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (!statSync(full).isDirectory() || name === 'api' || name.startsWith('_')) continue;
    const next = name.startsWith('(') ? prefix : `${prefix}/${name}`;
    if (readdirSync(full).includes('page.tsx')) out.push(next || '/');
    out.push(...pagePaths(full, next));
  }
  return out;
}

describe('alamat lama → alamat baru', () => {
  it('alamat lama dialihkan per bagian, id dan query tidak berubah', () => {
    expect(legacyPathTarget('/gaji/kasbon/12/lunasi')).toBe('/payroll/advances/12/settle');
    expect(legacyPathTarget('/absen')).toBe('/clock-in');
    expect(legacyPathTarget('/logistik/trip/5/ubah')).toBe('/logistics/trips/5/edit');
    expect(legacyPathTarget('/gaji/periode/2026-10-26/tutup')).toBe('/payroll/periods/2026-10-26/close');
    expect(legacyPathTarget('/lupa-password/kode')).toBe('/forgot-password/code');
  });

  it('alamat baru, API, dan beranda tidak dialihkan', () => {
    expect(legacyPathTarget('/')).toBeNull();
    expect(legacyPathTarget('/payroll/advances')).toBeNull();
    expect(legacyPathTarget('/api/payroll')).toBeNull();
    expect(legacyPathTarget('/login')).toBeNull();
  });

  it('semua alamat halaman sudah bahasa Inggris (tidak ada yang masih dialihkan)', () => {
    const stillLegacy = pagePaths(APP_DIR).filter((path) => legacyPathTarget(path) !== null);
    expect(stillLegacy).toEqual([]);
  });
});
