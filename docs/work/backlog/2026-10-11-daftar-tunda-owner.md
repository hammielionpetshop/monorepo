# Daftar Tunda & Daftar Bahas — keputusan owner

**Terakhir diperbarui:** 2026-10-11
**Sumber:** tinjauan menyeluruh bersama owner 2026-10-11 (setelah rilis 1.107.64).
**Cara pakai:** baca berkas ini di awal sesi kerja. Yang berstatus **TUNDA** jangan dikerjakan atau
ditawarkan ulang kecuali owner memintanya; yang berstatus **BAHAS** wajib diangkat lagi ke owner
sebelum disentuh. Repo ini publik — urusan keamanan/akses server **tidak** dicatat di sini.

Aturan status (owner 2026-10-11): pekerjaan yang sudah tayang tetapi belum dicoba owner ditulis
**"tayang — menunggu uji coba owner"**, bukan "selesai".

## A. Menunggu uji coba owner di toko

| Versi | Isi |
|---|---|
| 1.107.52–54 | Utang stok dilunasi saat void; filter halaman Utang Stok; kolom Pelanggan/Pihak di Timeline Mutasi Stok |
| 1.107.55 | Hutang Supplier (halaman, catat bayar, jatuh tempo) |
| 1.107.57 | Estafet shift (struk shift 2 berisi rekap hari; Riwayat Shift digabung) |
| 1.107.58–61 | Retur ke Supplier; supplier nonaktif; alasan "barang tidak datang" |
| 1.107.62 | Retur Internal (Barang Dikembalikan, Saldo Internal otomatis, Revisi Harga Beli); Batalkan Retur Supplier |
| 1.107.63 | Baris "Batal Retur" di Mutasi Stok |
| 1.107.64 | Foto bukti transfer opsional (piutang pelanggan & hutang supplier, Back Office) |

Sudah dicoba owner dan dinyatakan cocok: 1.107.56 (alur PO baru).

## B. BAHAS — wajib dibahas dengan owner sebelum dikerjakan

1. **Catatan kas otomatis untuk pembayaran hutang internal antar cabang.** Sejak 1.107.48 setiap
   Catat Pembayaran hutang internal otomatis membuat pengeluaran di cabang yang membayar dan
   pemasukan di cabang penerima di Pendapatan & Pengeluaran. Owner pernah meminta ini **ditahan
   (jangan diubah)**; 2026-10-11 owner menyatakan **harus dibahas**. Pertanyaan yang belum dijawab:
   apakah perpindahan uang antar cabang sendiri memang mau tampil sebagai pendapatan/pengeluaran,
   dan bagaimana tampilnya di laporan gabungan semua cabang.
2. *(dipindah ke D)* Utang stok — owner memutuskan 2026-10-11: dibereskan lewat **stock opname besar**.

## C. Disarankan, menunggu "ok" owner

1. **Tautan dari layar Transfer Internal / Hutang Piutang Internal ke form Retur Internal** — supaya
   nomor kiriman tidak perlu diketik manual. Kecil, hanya tampilan. Saran: dikerjakan **setelah**
   owner mencoba Retur Internal di toko, supaya masukan dari uji coba bisa ikut sekalian.
2. ~~Papan klaim & dokumen basi~~ — **dikerjakan 2026-10-11** atas izin owner: baris klaim
   `docs/usulan-laporan` dihapus, dua dokumen status April diberi tanda BASI, dan aturan
   pencegahnya ditulis di `CLAUDE.md` (Aturan Wajib).

## D. TUNDA — keputusan owner, jangan ditawarkan ulang

| Hal | Keputusan owner |
|---|---|
| Pembayaran ke supplier ikut tercatat di Pendapatan & Pengeluaran | nanti dulu |
| Bayar hutang internal banyak sekaligus | **tidak usah ada** (dicoret) |
| Nomor referensi wajib saat catat pembayaran | opsional dulu; diganti foto bukti transfer (1.107.64) |
| Foto bukti di hutang internal antar cabang & di layar kasir | tidak perlu; cukup pilih metode |
| Salin ulang data toko ke laptop untuk uji coba | tunda dulu |
| Stok ringkas ≠ rincian batch (audit 3 Okt) dan **utang stok** (termasuk yang tidak terlunasi oleh retur / terima transfer / koreksi) | akan dibereskan owner lewat **stock opname besar** — menyetujui stock opname menutup utang stok produk yang dihitung (`applySOStockAdjustment` → `closeOpenShortfallsForRecount`). Tidak perlu perubahan kode dulu. |
| 46 hutang supplier lama | dikerjakan sesuai alur biasa lewat layar Hutang Supplier — tidak perlu ditindaklanjuti |
| Tawaran catat bayar setelah Setujui Penerimaan PO | **sudah ada** (popup "Nanti (Tempo)" / "Catat Bayar" di detail PO) — dianggap selesai |

## E. Sudah beres (dicatat supaya tidak ditanyakan lagi)

- **Koreksi stok Gudang 1 DUS Whiskas (`docs/koreksi-ibt-20261006-0004.sql`)** — ternyata **sudah
  dijalankan** pada 2026-10-08 (retur `RTN-20261008-0001`); nota bersih = hutang. Tidak perlu
  dijalankan lagi; skripnya sendiri menolak dijalankan dua kali.
- **Izin akses (permission)** — diperiksa 2026-10-11: seluruh pasangan izin × role di katalog repo
  (`packages/db/src/seed/permissions.ts`) sudah terpasang di server; tidak ada yang kurang.
- **Folder kerja lama** di laptop (`wt-alasan`, `wt-hapus`, `wt-retur`, `wt-supplier`) — dihapus
  2026-10-11 atas izin owner; branch-nya tetap ada di remote.
- **Disk server** — dibersihkan 2026-10-11 (83% → 27%), lihat [`../../ops/README.md`](../../ops/README.md).

## F. Fitur lama yang tercatat belum tuntas (bukan pekerjaan Oktober)

**Keputusan owner 2026-10-11:** tiga butir bertanda **CEK NANTI** masuk daftar yang harus diperiksa
bersama owner di lain waktu; rencana kerja Juni **dilewati (skip)**.

Hasil menyisir `docs/work/backlog` dan `docs/work/plans`. **Tidak ada** kode yang sudah jadi tetapi
belum tayang: semua branch sudah masuk `main` dan tidak ada potongan changelog yang menggantung.

| Hal | Keadaan |
|---|---|
| Verifikasi manual izin per role (`plans/2026-07-13-rbac-manual-role-matrix-verification.md`) | belum pernah dijalankan — uji klik per role |
| Editor Role → Permission di Pengaturan | layarnya sudah ada; yang terbuka: verifikasi di atas + menandai izin "sensitif" |
| Portal pesanan pelanggan (`backlog/2026-07-08-customer-order-portal.md`) | tayang; terbuka: verifikasi OTP WhatsApp sungguhan & notifikasi WA konfirmasi pesanan |
| **CEK NANTI** — Pengetatan stock opname (`backlog/2026-07-16-stock-opname-concurrent-sales-hardening.md`) | sebagian besar selesai; sisa beberapa butir + "SO Besar per cabang" (terkait D) |
| **CEK NANTI** — Halaman Panduan | sebagian kartu masih "Segera hadir" |
| **CEK NANTI** — Foto produk untuk katalog | kolomnya ada, layar unggahnya belum |
| ~~Rencana Juni di `docs/work/plans/2026-06-*`~~ — **skip** (owner) | kotaknya tidak pernah dicentang walau banyak yang sudah tayang — statusnya **tidak bisa dipercaya dari dokumen**, perlu dicek per rencana bila diperlukan |

## Catatan utang stok

"Utang stok" terjadi bila kasir menjual barang saat stok di sistem 0 (barang fisiknya ada, tetapi
penerimaannya belum dicatat). Sistem mencatat utang itu dan melunasinya saat barang masuk.

Yang melunasi utang stok sekarang: **penerimaan PO**, **stock opname / penyesuaian**, dan sejak
1.107.52 **void transaksi**. Yang **belum** melunasi: barang masuk lewat **retur pelanggan**,
**terima transfer antar cabang**, dan **koreksi transaksi**. Akibatnya pada produk yang sedang
berutang, barang masuk lewat tiga jalur itu menambah rincian batch tanpa mengurangi utangnya —
angka "rincian batch" jadi lebih besar daripada stok ringkas (stok ringkasnya sendiri tetap benar).

Owner memilih (2026-10-10) memperbaiki void saja dulu. Penyelesaian datanya tetap lewat stock opname.
