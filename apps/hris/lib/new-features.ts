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
  // L3c Tinjau, Koreksi, dan Rekap (tayang staging 2026-11-02)
  '/kehadiran/tinjau': '2026-11-02',
  '/kehadiran/koreksi': '2026-11-02',
  '/kehadiran/catatan-hari': '2026-11-02',
  '/kehadiran/rekap': '2026-11-02',
  '/kehadiran-saya': '2026-11-02',
  'fitur/foto-absen-pilih-tanggal': '2026-11-02', // pilihan tanggal di Foto Absen Hari Ini
  'fitur/beranda-tinjau-absen': '2026-11-02', // kartu "Absen menunggu tinjauan" di Beranda
  // L3d Laporan Pulang, Serah Terima, Lapor Masalah (tayang staging 2026-11-02)
  '/serah-terima': '2026-11-02',
  '/lapor-masalah': '2026-11-02',
  '/kehadiran/serah-terima': '2026-11-02',
  '/kehadiran/laporan-masalah': '2026-11-02',
  'fitur/laporan-pulang': '2026-11-02', // kartu "Laporan Pulang menunggu" di Absen
  'fitur/sudah-pindah-cabang': '2026-11-02', // pertanyaan "Sudah pindah cabang?" di Absen
  // L3e Libur dan Tukar (tayang staging 2026-11-02)
  '/libur': '2026-11-02',
  '/tukar': '2026-11-02',
  '/kehadiran/libur': '2026-11-02',
  '/kehadiran/minta-masuk': '2026-11-02',
  'fitur/beranda-libur': '2026-11-02', // kartu jatah libur, ajakan tukar, diminta masuk, pengganti di Beranda
  'fitur/jadwal-libur': '2026-11-02', // tanda Libur di Jadwal & Shift, Jadwal Saya, dan status Libur terjadwal di rekap
  // L3f Izin, Sakit, dan Cuti (tayang staging 2026-11-02)
  '/tidak-masuk/ajukan': '2026-11-02',
  '/cuti': '2026-11-02',
  '/tidak-masuk/surat-dokter': '2026-11-02',
  '/kehadiran/isikan': '2026-11-02',
  'fitur/libur-cabang-tidak-masuk': '2026-11-02', // tab Tidak masuk di Libur Cabang
  'fitur/cabut-persetujuan': '2026-11-02', // tombol Cabut persetujuan di Persetujuan
  'fitur/sisa-cuti-orang': '2026-11-02', // kartu Sisa cuti + Sesuaikan sisa di halaman orang
  'fitur/beranda-surat-dokter': '2026-11-02', // kartu surat dokter belum disusulkan / izin menunggu di hari H
  // L3g Perlu Dijelaskan dan alpha (tayang staging 2026-11-02)
  '/perlu-dijelaskan': '2026-11-02',
  '/kehadiran/perlu-dijelaskan': '2026-11-02',
  '/kehadiran/kebiasaan-lupa-absen': '2026-11-02',
  'fitur/ajukan-terlambat': '2026-11-02', // tombol Ajukan terlambat untuk lupa absen yang lewat batas
  'fitur/beranda-perlu-dijelaskan': '2026-11-02', // kartu hal perlu dijelaskan / tidak masuk berturut-turut di Beranda
  'fitur/status-alpha': '2026-11-02', // status Alpha di Catatan Hari Kerja, Rekap, Kehadiran Saya
  // L3h Lembur (tayang staging 2026-11-02)
  '/lembur': '2026-11-02',
  '/kehadiran/lembur': '2026-11-02',
  'fitur/ini-lembur': '2026-11-02', // jendela Ini lembur? di Absen sesudah Laporan Pulang
  'fitur/beranda-lembur': '2026-11-02', // kartu lembur belum diklaim di Beranda
  // L4a Komponen Gaji (tayang staging 2026-11-02)
  '/gaji': '2026-11-02',
  '/pengaturan/komponen-gaji': '2026-11-02',
  '/pengaturan/gaji-standar': '2026-11-02',
  'fitur/gaji-di-halaman-orang': '2026-11-02', // kartu Gaji di halaman orang
  'fitur/beranda-belum-ada-gaji': '2026-11-02', // kartu Belum ada gaji di Beranda
  '/gaji/tiadakan': '2026-11-03', // L4b Tiadakan Potongan
  '/pengaturan/potongan-lembur': '2026-11-03', // L4b Potongan & Lembur
  '/panduan/aturan-potongan': '2026-11-03', // L4b Aturan Potongan
  'fitur/hitungan-kehadiran': '2026-11-03', // tab Hitungan di Gaji Seseorang
  // L4c-1 Kehilangan Barang dan Minus Kas (tayang staging 2026-11-03)
  '/potongan/kehilangan-barang': '2026-11-03',
  '/potongan/minus-kas': '2026-11-03',
  '/pengaturan/tanggungan-kehilangan': '2026-11-03',
  'fitur/tautan-akun-kasir': '2026-11-03', // Tautan Akun Kasir di Minus Kas
  // L4c-2 Potongan Lain, Keberatan, urutan potongan (tayang staging 2026-11-03)
  '/potongan/lain': '2026-11-03',
  '/pengaturan/jenis-potongan-lain': '2026-11-03',
  'fitur/tab-potongan': '2026-11-03', // tab Potongan di Gaji Seseorang
  'fitur/keberatan-potongan': '2026-11-03', // Keberatan Potongan dari pemberitahuan
  // L4d-1 Buku Bonus grooming dan ongkir (tayang staging 2026-11-03)
  '/bonus/persetujuan': '2026-11-03',
  '/bonus/buku': '2026-11-03',
  '/bonus/pasangkan': '2026-11-03',
  '/pengaturan/jenis-bonus': '2026-11-03',
  'fitur/tab-bonus': '2026-11-03', // tab Bonus di Gaji Seseorang
  'fitur/kartu-bonus': '2026-11-03', // kartu bonus grooming dan ongkir di Aturan Potongan
  // L4d-2 Bonus Bebas, Dana Disiplin & Dana Tidak Hadir (tayang staging 2026-11-03)
  'fitur/catat-bonus-bebas': '2026-11-03', // layar Catat Bonus Bebas
  '/dana': '2026-11-03',
  'fitur/bonus-bebas': '2026-11-03', // tab Bonus Bebas di Persetujuan Bonus
  'fitur/jenis-bonus-ketik': '2026-11-03', // jenis ketik di Jenis Bonus
  'fitur/kartu-dana-disiplin': '2026-11-03', // kartu Dana Disiplin di Aturan Potongan
  // L4e-1 Periode Slip, Tutup Slip, dan Cetak (tayang staging 2026-11-03)
  '/gaji/periode': '2026-11-03',
  'fitur/slip-gaji': '2026-11-03', // layar Slip, Tutup, dan Cetak
  'fitur/tab-slip': '2026-11-03', // tab Slip di Gaji Seseorang
  // L4e-2 Buka kembali, slip terakhir, Piutang Lain, Koreksi Periode Lalu (tayang staging 2026-11-03)
  '/gaji/piutang': '2026-11-03',
  'fitur/buka-kembali-slip': '2026-11-03', // Buka kembali / Minta buka kembali + riwayat versi di layar Slip
  'fitur/tutup-lebih-cepat': '2026-11-03', // Tutup lebih cepat slip terakhir
  'fitur/koreksi-periode-lalu': '2026-11-03', // tab Koreksi Periode Lalu di halaman periode
  'fitur/hapuskan-sisa': '2026-11-03', // Hapuskan sisa di Potongan Lain
  // L4f-1 Bayar Slip, Jadwal Bayar, Daftar Transfer, Sumber Uang (tayang staging 2026-11-03)
  '/gaji/jadwal-bayar': '2026-11-03',
  '/pengaturan/sumber-uang': '2026-11-03',
  'fitur/bayar-slip': '2026-11-03', // tombol Bayar, kotak Pembayaran di Slip, angka Dibayar di periode
  'fitur/daftar-transfer': '2026-11-03', // Daftar Transfer + unduh CSV
  // L4f-2 Bayar di luar slip, Ringkasan Gaji (tayang staging 2026-11-03)
  'fitur/bayar-luar-slip': '2026-11-03', // kartu Bayar di luar slip di Jadwal Bayar
  'fitur/ringkasan-gaji': '2026-11-03', // tab Ringkasan di halaman periode + bentuk Finance
  // L4g-1 Pendapatan Saya, Slip Saya (tayang staging 2026-11-03)
  '/pendapatan': '2026-11-03',
  'fitur/unduh-slip-saya': '2026-11-03', // Unduh beberapa slip di Pendapatan Saya
  'fitur/beranda-urusan-gaji': '2026-11-03', // kartu Urusan gaji Anda di Beranda
  // L4g-2 Keberatan slip, Tautkan pembetulan, Pembetulan gaji periode lalu (tayang staging 2026-11-03)
  'fitur/keberatan-slip': '2026-11-03', // kartu Keberatan slip di Slip Saya
  'fitur/keberatan-slip-putuskan': '2026-11-03', // isi khas keberatan slip di Persetujuan + Tautkan pembetulan
  'fitur/beranda-keberatan-slip': '2026-11-03', // kartu keberatan menunggu pembetulan di Beranda
  'fitur/pembetulan-gaji': '2026-11-03', // tombol Pembetulan gaji periode lalu di Gaji Karyawan
  // L4g-3 Akses terbatas mantan karyawan, Total Diterima per Orang (tayang staging 2026-11-03)
  '/gaji/total-diterima': '2026-11-03',
  // L5a Kasbon: ajukan sampai uang diberikan + cicilan di slip (tayang staging 2026-11-03)
  '/kasbon': '2026-11-03',
  '/gaji/kasbon': '2026-11-03',
  'fitur/cicilan-kasbon-di-slip': '2026-11-03', // baris Kasbon (kelompok d) di slip, Slip Saya, dan cetak
  'fitur/kasbon-sesudah-diberikan': '2026-11-03', // L5b: Minta tunda, Terima pelunasan, Ubah jadwal, Hapus utang
  'fitur/uang-kasbon': '2026-11-03', // tab Uang Kasbon + CSV
  'fitur/kasbon-khusus': '2026-11-03', // tombol Kasbon Khusus di Gaji › Kasbon
  // L6 Logistik Minimal (tanggal tayang staging; diganti tanggal rilis produksi di branch rilis).
  '/trip-saya': '2026-11-03',
  '/logistik/trip': '2026-11-03',
  '/logistik/ritase': '2026-11-03',
  '/logistik/mobil-rute': '2026-11-03',
  '/kehadiran/absen-trip': '2026-11-03',
  'fitur/titik-garasi': '2026-11-03', // titik garasi + pagar uji di Mobil & Rute
  'fitur/beranda-trip': '2026-11-03', // kartu trip menggantung / pagar uji di Beranda
  '/pengaturan/tarif-ritase': '2026-11-03',
  '/pengaturan/jenis-upah': '2026-11-03',
  '/gaji/upah-ritase': '2026-11-03',
  'fitur/beranda-upah-ritase': '2026-11-03', // kartu upah ritase belum bertarif / perlu dilihat di Beranda
  'fitur/slip-mingguan': '2026-11-03', // daftar minggu upah di Periode Slip + halaman satu minggu
  'fitur/beranda-upah-minggu-ini': '2026-11-03', // kartu Upah minggu ini di Beranda
  'fitur/kasbon-mingguan': '2026-11-03', // kasbon driver & kenek: cicilan per minggu upah (langkah Serahkan Uang)
  '/gaji/denda-driver': '2026-11-04', // Denda Driver & Kenek (L7c)
  '/pengaturan/jenis-denda': '2026-11-04', // Jenis Denda (L7c)
  // L8a Laporan Bongkaran (tayang staging 2026-11-04)
  '/gaji/bongkaran': '2026-11-04', // Laporan Bongkaran: daftar, Laporan baru, rincian, Barang lain
  'fitur/bongkaran-berat': '2026-11-04', // Berat per Satuan + Berat berubah
  'fitur/beranda-bongkaran': '2026-11-04', // kartu bongkaran belum dibayar / perlu dilihat / berat berubah di Beranda
  '/karyawan/pekerja-lepas': '2026-11-04', // Pekerja Lepas (KAR-L28)
  // L8b Bayar Bongkaran (tayang staging 2026-11-04)
  'fitur/bongkaran-bayar': '2026-11-04', // Bayar, Tanyakan dulu, Koreksi, Batalkan, Batal bayar, Lebih bayar, Per orang
  'fitur/pendapatan-bongkaran': '2026-11-04', // kartu Upah bongkaran + Uang belum saya terima di Pendapatan Saya
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
