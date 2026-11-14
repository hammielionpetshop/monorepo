/**
 * Alamat lama berbahasa Indonesia → alamat baru bahasa Inggris (spec `docs/work/specs/2026-11-14-english-routes-design.md`).
 * Tautan lama yang sudah tersimpan (pemberitahuan, QR cetak, bookmark) dialihkan lewat `middleware.ts`.
 * Satu tabel padanan per bagian alamat; segmen yang tidak ada di tabel (id, tanggal) dibiarkan.
 */
const SEGMENTS: Readonly<Record<string, string>> = {
  'arus-uang': 'cash-flow',
  'dana-belum-cair': 'pending-funds',
  'hitung-kas': 'cash-counts',
  'laba-rugi': 'profit-loss',
  'mutasi': 'movements',
  'rincian': 'details',
  'setoran-vs-laba': 'deposits-vs-profit',
  'tutup-bulan': 'month-close',
  'utang-antar-cabang': 'inter-branch-debts',
};

/** Bagian pertama alamat lama; hanya alamat yang diawali salah satunya yang dialihkan. */
const LEGACY_ROOTS: ReadonlySet<string> = new Set(['arus-uang', 'dana-belum-cair', 'hitung-kas', 'laba-rugi', 'mutasi', 'setoran-vs-laba', 'tutup-bulan', 'utang-antar-cabang']);

/** Alamat baru untuk alamat lama, atau `null` bila bukan alamat lama. */
export function legacyPathTarget(pathname: string): string | null {
  const parts = pathname.split('/');
  if (!LEGACY_ROOTS.has(parts[1] ?? '')) return null;
  return parts.map((part) => SEGMENTS[part] ?? part).join('/');
}
