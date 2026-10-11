# Foto Bukti Transfer di Pembayaran Manual

**Tanggal:** 2026-10-11
**Status:** dikoding di `feat/foto-bukti-transfer` — setelah rilis ditulis **"tayang — menunggu uji coba owner"**, bukan "selesai"
**Backlog:** [`../backlog/2026-10-11-retur-internal.md`](../backlog/2026-10-11-retur-internal.md) bagian "Perbaikan terpisah"

## Latar belakang

Rencana awal: mewajibkan nomor referensi saat mencatat pembayaran. Owner memutuskan (2026-10-11)
**tidak mewajibkan apa pun dulu** karena sistem masih baru. Sebagai gantinya ditambah **foto bukti
transfer yang opsional**, supaya owner mudah memeriksa pembayaran belakangan.

## Keputusan owner

1. Tidak ada isian baru yang wajib. Foto boleh kosong.
2. Kotak foto hanya muncul untuk metode **non-tunai** (jenis metode bayar selain `CASH`).
3. Ruang lingkup: **Back Office saja**, dua tempat —
   - pelunasan piutang pelanggan ke toko (paling dibutuhkan),
   - pembayaran hutang ke supplier.
4. **Tidak termasuk:** hutang internal antar cabang (cukup pilih metode seperti biasa), pelunasan
   piutang lewat layar kasir (POS), dan pembayaran penjualan di POS.
5. Rute unggah foto sekalian diperketat (hanya berkas gambar).

## Rancangan

- **Migrasi 0036** — kolom `proof_photo_url text` (boleh kosong) di `debt_payments` dan
  `supplier_payable_payments`. Hanya menambah kolom; data lama tidak diubah.
- **Unggah** memakai rute yang sudah ada, `POST /api/pos/uploads` (volume `uploads_data`, disajikan
  Caddy di `/uploads/*`). Diperketat: wajib login (diperiksa di rute, bukan hanya middleware), hanya
  jenis gambar, maksimal 15 MB, **nama berkas dibuat server** (`<uuid>.<ext>` dari jenis gambar —
  nama kiriman tidak dipakai).
- **Komponen** `components/ui/proof-photo-field.tsx`: `ProofPhotoField` (pilih/ambil foto, diperkecil
  di browser ke sisi terpanjang 1600 px JPEG sebelum diunggah, pratinjau, hapus) dan `ProofPhotoLink`
  ("Lihat bukti" di riwayat, membuka tab baru).
- **Validasi server** `lib/proof-photo.ts`: alamat foto harus berbentuk `/uploads/<nama-berkas>`;
  alamat lain ditolak (400). Untuk metode tunai / bayar dari Saldo Supplier, foto diabaikan.
- **Form yang mendapat kotak foto:**
  - Hutang Supplier → Catat Pembayaran ke Supplier (juga dari detail PO),
  - Detail pelanggan → Bayar hutang dan Lunasi Sekaligus (satu foto menempel ke semua baris
    pelunasan yang terbentuk),
  - Laporan Piutang → Bayar.
- **Riwayat yang menampilkan "Lihat bukti":** riwayat pembayaran Hutang Supplier, riwayat pembayaran
  di detail pelanggan, Laporan Pelunasan Piutang.

## Tidak diubah

- Hitungan uang, status hutang, shift/kas, dan Pendapatan & Pengeluaran — tidak ada yang berubah.
- Pembayaran lama tetap tanpa foto (prinsip tidak ada edit); foto hanya bisa dilampirkan saat mencatat.

## Catatan yang perlu diketahui

- Berkas foto **tidak ikut backup harian** (`backup-db.sh` hanya database) — sama seperti foto Barang
  Rusak / retur yang sudah ada. Perlu keputusan terpisah bila ingin dicadangkan.
- Belum ada pembersihan foto yang diunggah lalu dibatalkan (form ditutup tanpa Simpan); ukurannya
  kecil setelah diperkecil.

## Tes

- `lib/proof-photo.test.ts`, `app/api/pos/uploads/route.test.ts` (unit).
- `lib/services/payment-proof-photo.integration.test.ts` (DB lokal): foto tersimpan untuk transfer,
  diabaikan untuk tunai, tanpa foto tetap bisa, alamat asing ditolak, lunasi sekaligus.
