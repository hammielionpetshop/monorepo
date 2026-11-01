/**
 * Tanda "Baru" HRIS (permintaan owner 2026-11-01, sama dengan kasir `apps/backoffice/lib/new-features.ts`).
 * Tanda tampil selama pengaturan "Tanda Baru tampil" (awal 7 hari) sejak tanggalnya, lalu hilang sendiri.
 *
 * WAJIB tiap update HRIS yang menambah menu atau bagian halaman baru: tambah satu baris di sini.
 * - Kunci = `href` menu persis seperti di `lib/nav.ts`, atau `fitur/...` untuk bagian di dalam halaman
 *   (dipasang dengan `<NewBadge feature="fitur/..." />`).
 * - Nilai = tanggal WIB `YYYY-MM-DD`: tanggal tayang staging selama HRIS belum rilis; diganti tanggal
 *   rilis produksi di branch rilis.
 */
export const NEW_FEATURES: Record<string, string> = {
  // L2e Pengaturan bertanggal (tayang staging 2026-11-01)
  '/pengaturan/umum': '2026-11-01',
  '/pengaturan/jabatan': '2026-11-01',
  'fitur/saran-role-kasir': '2026-11-01', // role terisi dari saran jabatan di kartu Akses kasir
  'fitur/tugas-lapangan-otomatis': '2026-11-01', // tanda "Otomatis (jabatan …)" di Izin tugas lapangan
  // Apa yang baru + tanda Baru (tayang staging 2026-11-01)
  '/apa-yang-baru': '2026-11-01',
  // L2f-1 Mesin Pengajuan, Pemberitahuan, Beranda (tayang staging 2026-11-01)
  '/pengajuan': '2026-11-01',
  '/persetujuan': '2026-11-01',
  '/pemberitahuan': '2026-11-01',
  '/pengaturan/jenis-pengajuan': '2026-11-01',
  'fitur/ajukan-ubah-data-diri': '2026-11-01', // tombol Ajukan perubahan di Profil saya
  'fitur/beranda-perlu-perhatian': '2026-11-01', // kartu Perlu perhatian di Beranda
  // L2f-2 (tayang staging 2026-11-01)
  'fitur/usulan-pengaturan-jabatan': '2026-11-01', // catatan + tombol Usulkan di Pengaturan Jabatan
  'fitur/buat-kode-lupa-password': '2026-11-01', // tombol di kartu Akun halaman orang
  // L3a Jam Kerja & Jadwal (tayang staging 2026-11-01)
  '/jadwal': '2026-11-01',
  // L3b Absen dan Istirahat (tayang staging 2026-11-01)
  '/absen': '2026-11-01',
  '/kehadiran/perbantuan': '2026-11-01',
  '/kehadiran/foto-hari-ini': '2026-11-01',
  '/kehadiran/jadwal': '2026-11-01',
  '/kehadiran/hari-tutup': '2026-11-01',
  '/kehadiran/qr': '2026-11-01',
  '/pengaturan/jam-kerja': '2026-11-01',
};

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Kunci yang tanda Barunya tampil pada `today`: tanggal ≤ hari ini < tanggal + lama tampil. */
export function activeNewFeatures(features: Record<string, string>, today: string, days: number): string[] {
  return Object.entries(features)
    .filter(([, date]) => date <= today && today < addDays(date, days))
    .map(([key]) => key);
}
