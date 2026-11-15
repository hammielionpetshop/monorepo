# Mesin Berat Produk & Tanda "Belum ada berat"

**Tanggal:** 2026-10-12
**Status:** **tayang 1.107.72 (2026-10-12) — menunggu uji coba owner** (belum dilihat di layar sebelum rilis; belum dianggap selesai)

## Latar belakang

Berat produk hanya dipakai untuk baris **TONASE** di surat jalan Penjualan Grosir. Owner memeriksa
data berat (2026-10-12) dan menemukan tonase bisa salah karena tiga hal:

1. Berat satuan besar (dus, sak) diketik manual di tab Satuan dan **mengalahkan** hitungan
   isi × berat satuan terkecil. Banyak yang tidak cocok dengan isinya.
2. Produk yang dijual per GRAM beratnya terisi angka lain (mis. 500), sehingga tonase membengkak.
3. Banyak produk belum punya berat sama sekali dan tidak ada tanda di layar untuk mencarinya.

Saat owner membetulkan lewat form produk, yang tersimpan hanya berat satuan terkecil — angka yang
salah ada di tab Satuan, jadi perbaikannya tidak terlihat.

## Keputusan owner

1. Beri **tanda "Belum ada berat"** di Master Data Produk ("beri saja tanda tidak ada berat").
2. Buat **mesin** yang menghitung ulang berat supaya tonase tidak salah.

3. Berat satuan besar **selalu dihitung**, tidak lagi diketik — tafsir pelaksana, sudah dijelaskan
   ke owner (termasuk contoh sak yang dulu ditimbang sendiri) dan owner memerintahkan tayang.

## Rancangan

Satu modul murni: `apps/backoffice/lib/product-weight.ts` — satu-satunya tempat aturan berat.

| Aturan | Isi |
|---|---|
| Sumber berat | Hanya berat 1 satuan terkecil (`products.weight_gram`). |
| Satuan besar | isi (ratio) × berat satuan terkecil. `product_uom_conversions.weight_gram` tidak dibaca lagi. |
| Satuan berat | Satuan terkecil `GRAM`/`GR`/`G` = 1 gram, `KG` = 1.000 gram, apa pun isi datanya. |
| Belum terdata | Kosong, 0, atau negatif → baris tidak ikut tonase dan produk diberi tanda. |

Pemakai mesin:

- `api/bo/bulk-sale-products` dan `api/bo/transactions/[trxNumber]/detail` (bahan tonase surat jalan,
  cetak baru & cetak ulang).
- Daftar produk (tanda "Belum ada berat"), halaman detail produk, dan tab Satuan (kolom berat
  menampilkan hasil hitungan; isian berat dihapus dari form).

Tanpa migrasi. Kolom `product_uom_conversions.weight_gram` dibiarkan (data lama tidak dihapus);
rute simpan satuan masih menerima kolom itu tetapi layar tidak lagi mengirimnya.

## Tidak termasuk

- Mengisi berat produk yang masih kosong — tetap dikerjakan owner/staf.
- Mengoreksi berat satuan terkecil yang tidak sesuai ukuran di nama produk.
- `apps/pos-desktop` (dibekukan) masih membaca kolom lama.

## Cara membatalkan

Kembalikan commit fitur ini. Tidak ada perubahan data, jadi tidak perlu pemulihan DB.
