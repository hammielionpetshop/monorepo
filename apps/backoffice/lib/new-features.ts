/**
 * Tanda "Baru" di menu / kotak fitur (permintaan owner 2026-10-11): supaya staf tahu ada fitur
 * yang baru rilis. Tanda tampil selama `NEW_BADGE_DAYS` hari sejak tanggal rilis, lalu hilang
 * sendiri — entri lama tidak perlu dihapus, tapi boleh dibersihkan sesekali.
 *
 * Cara pakai saat merilis fitur baru: tambahkan satu baris di `NEW_FEATURES` dengan kunci =
 * `href` menu (persis seperti di sidebar / navigasi POS) atau kunci bebas untuk kotak di dalam
 * halaman, dan nilai = tanggal rilis (WIB, `YYYY-MM-DD`).
 */
export const NEW_BADGE_DAYS = 7

export const NEW_FEATURES: Record<string, string> = {
  // Isi tanggal produksi WIB pada branch rilis; kosong berarti belum dirilis.
  'fitur/po-filter-periode': '',
  'fitur/transaksi-filter-kasir': '',
  'fitur/piutang-filter-periode': '',
  // Back Office — menu samping
  '/purchase-orders': '2026-10-10', // alur PO baru (tahap PO, harga menyusul)
  '/purchase-orders/supplier-payables': '2026-10-11', // Hutang Supplier (10 Okt) + foto bukti transfer (11 Okt)
  '/purchase-orders/retur': '2026-10-11', // Retur ke Supplier + Retur Internal
  '/purchase-orders/internal/payables': '2026-10-11', // Saldo Internal otomatis
  '/shift-history': '2026-10-11', // Riwayat Shift digabung per estafet
  '/reports/receivables': '2026-10-11', // foto bukti transfer saat Bayar
  '/reports/debt-payments': '2026-10-11', // "Lihat bukti"
  '/master-data/pets': '2026-10-12', // Data Kucing (jasa grooming)
  '/settings/groomers': '2026-10-12', // daftar groomer (jasa grooming)
  // POS
  '/pos/produk': '2026-10-11', // Retur Barang di menu Produk
  '/pos/grooming': '2026-10-12', // tab Grooming (terima kucing, karcis, delivery)
  '/pos/produk/retur': '2026-10-11',
  // Kotak di dalam halaman
  'retur-supplier-luar': '2026-10-11',
  'retur-internal': '2026-10-11',
  'retur-internal/barang-dikembalikan': '2026-10-11',
  'retur-internal/revisi-harga-beli': '2026-10-11',
  // Tambahan di dalam halaman (owner 2026-10-11: yang baru di dalam halaman juga ditandai,
  // supaya jelas APA yang baru — bukan hanya menunya)
  'fitur/foto-bukti-transfer': '2026-10-11', // kotak Foto Bukti Transfer + tautan "Lihat bukti"
  'fitur/daftar-pilih-kiriman': '2026-10-11', // daftar pilih kiriman di form Retur Internal
  'fitur/saldo-internal': '2026-10-11', // kotak Saldo Internal di Hutang Piutang Internal
  'fitur/estafet-shift': '2026-10-11', // baris Estafet di Riwayat Shift
  'fitur/po-belum-ada-harga': '2026-10-10', // tab Belum Ada Harga di daftar PO
  'fitur/kucing-pelanggan': '2026-10-12', // daftar kucing di detail pelanggan
  'fitur/jenis-produk-jasa': '2026-10-12', // pilihan Jenis (Barang / Jasa Grooming) di form produk
  '/reports/grooming': '2026-10-12', // Riwayat Grooming & Bonus (laporan jasa, bonus groomer & pengantar)
  'fitur/ganti-groomer': '2026-10-12', // tombol Ganti groomer di Riwayat Grooming
  'fitur/piutang-grooming': '2026-10-12', // tanda Grooming di Laporan Piutang
  'fitur/nilai-gratis-ongkir': '2026-10-12', // Pengaturan nilai gratis ongkir (ongkir standar) di Groomer & Pengantar
  'fitur/antar-barang-pengantar': '2026-10-12', // pilih pengantar saat ada ongkir di layar bayar + laporan antar barang
  'fitur/diskon-per-barang': '2026-10-13', // tombol Diskon per barang di keranjang kasir
  '/reports/discount-history': '2026-10-13', // laporan Riwayat Diskon
  'fitur/mesin-berat': '2026-10-12', // berat satuan besar dihitung otomatis (tab Satuan) + tanda Belum ada berat
  '/promos': '2026-10-15', // layar Promo otomatis (daftar, buat, nonaktifkan) — rilis P2
  'fitur/saklar-promo': '2026-10-15', // saklar darurat "matikan semua promo" di layar Promo — rilis P2
  'fitur/promo-kasir': '2026-10-15', // tanda promo otomatis pada baris keranjang kasir — rilis P2
  '/reports/promo': '2026-10-15', // Laporan Promo (efektivitas + peringkat toko) — rilis P2
  'fitur/promo-kuota': '2026-10-18', // kotak Batas kuota & stok di form Promo — rilis P3 (samakan tanggal ini dengan tanggal rilis P3)
  'fitur/promo-gratis': '2026-10-18', // bentuk "Beli X gratis Y" & "Bundling" di form Promo — rilis P4 (samakan tanggal ini dengan tanggal rilis P4)
  'fitur/ibt-tidak-dipenuhi': '2026-10-18', // penegasan item tidak dipenuhi di Transfer Internal (samakan dengan tanggal rilis saat merge)
  'fitur/pelunasan-filter-metode': '2026-10-18', // filter metode bayar di Riwayat Pelunasan (samakan dengan tanggal rilis saat merge)
  'fitur/pelunasan-nota-klik': '2026-10-18', // Nota Asal bisa diklik → detail nota di tab baru (samakan dengan tanggal rilis saat merge)
  'fitur/nonaktif-customer': '2026-10-21', // tombol Aktifkan/Nonaktifkan status customer di Manajemen Customer (samakan dengan tanggal rilis saat merge)
  'fitur/so-ringkasan-selisih': '2026-10-21', // kotak Perkiraan Nilai Selisih + filter barang plus/minus di Review SO Besar (samakan dengan tanggal rilis saat merge)
  'fitur/so-hitung-ulang': '2026-10-21', // tombol Hitung Ulang di detail SO Besar yang sudah disetujui (samakan dengan tanggal rilis saat merge)
  'fitur/diskon-persen': '2026-10-21', // pilihan "Diskon %" di popup Diskon per barang (samakan dengan tanggal rilis saat merge)
  'fitur/penjualan-per-tier': '2026-10-22', // rincian per kelas harga (Retail/Reseller/Grosir) + margin di Penjualan per Produk (samakan dengan tanggal rilis saat merge)
  'fitur/laba-rugi-per-tier': '2026-10-22', // bagian Penjualan & Laba Kotor per Kelas Harga di Laporan Laba Rugi (samakan dengan tanggal rilis saat merge)
  'fitur/karcis-grooming-klik': '2026-10-24', // nomor karcis di Riwayat Grooming bisa diklik → detail nota di tab baru (samakan dengan tanggal rilis saat merge)
  'fitur/promo-nota-klik': '2026-10-24', // angka "Nota" di Laporan Promo bisa diklik → pop-up daftar nota (samakan dengan tanggal rilis saat merge)
  'fitur/so-input-satuan': '2026-10-25', // tombol "⊞ Satuan" di kolom Fisik SO Besar — ketik qty per satuan (1 SAK + 2 PCS) (samakan dengan tanggal rilis saat merge)
  'fitur/so-selesaikan-manual': '2026-10-25', // tombol "Selesaikan SO Besar" — SO Besar tak lagi tertutup otomatis (samakan dengan tanggal rilis saat merge)
  'fitur/so-laporan-tab-ditolak': '2026-10-25', // tab "Ditolak" terpisah di Laporan Stock Opname (samakan dengan tanggal rilis saat merge)
  'fitur/shift-trx-klik': '2026-10-25', // angka "Trx" di Breakdown Kasir (Detail Shift) bisa diklik → pop-up daftar nota (samakan dengan tanggal rilis saat merge)
  'fitur/laba-rugi-trx-klik': '2026-10-25', // angka "Jml Transaksi" per kelas harga di Laba Rugi bisa diklik → pop-up daftar nota (samakan dengan tanggal rilis saat merge)
  'fitur/detail-tier-inisial': '2026-10-25', // inisial kelas harga (ret/res/gro) di samping subtotal item di Detail Transaksi (samakan dengan tanggal rilis saat merge)
  'fitur/transaksi-tier-kolom': '2026-10-25', // kolom Tier (inisial kelas harga per nota) di Riwayat Transaksi + popup Transaksi per kasir (samakan dengan tanggal rilis saat merge)
  'fitur/shift-pelunasan-piutang': '2026-10-27', // tab Pelunasan Piutang + rincian rekonsiliasi Kas Expected di Detail Shift (samakan dengan tanggal rilis saat merge)
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Tanggal rilis dihitung dari pukul 00.00 WIB hari itu. */
export function isNewFeature(key: string, now: Date = new Date()): boolean {
  const releasedOn = NEW_FEATURES[key]
  if (!releasedOn) return false
  const start = new Date(`${releasedOn}T00:00:00+07:00`).getTime()
  if (Number.isNaN(start)) return false
  const t = now.getTime()
  return t >= start && t < start + NEW_BADGE_DAYS * DAY_MS
}
