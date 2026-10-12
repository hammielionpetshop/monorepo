# Promo Otomatis, Diskon per Barang & Laporan Diskon

**Tanggal:** 2026-10-12
**Status:** **rancangan (P0)** — belum ada kode. Tahap: [`../backlog/2026-10-12-promo-otomatis.md`](../backlog/2026-10-12-promo-otomatis.md)
**Istilah:** [`../../glosarium-bisnis.md`](../../glosarium-bisnis.md) bagian "Jasa, promo & sistem luar"

## Latar belakang

Owner (2026-10-12) ingin promo yang diatur kantor dan **berlaku sendiri di kasir** supaya kasir
tidak perlu mengetik diskon: bisa dipilih cabangnya, jumlah pcs-nya, bisa bundling, beli 1 gratis
1, "beli ini, produk itu dipotong", grooming gratis makanan pilihan, dan flash sale per jam. Setiap
promo wajib punya laporan (efektivitas + toko mana yang paling banyak menjual). Owner juga minta
**laporan riwayat produk yang kena diskon** di luar promo (kapan, oleh siapa, diklik muncul
notanya), dan menunjuk masalahnya sendiri: diskon kasir sekarang dicatat untuk **total nota**, bukan
per produk — "ini harus kita perbaiki".

## Keadaan kode sebelum pekerjaan ini (hasil analisa)

1. **Diskon hanya di kepala nota.** Layar bayar (`components/pos/checkout-modal.tsx`) punya satu
   isian "+ Diskon" yang masuk ke `transactions.discount_amount`. Kolom per baris
   `transaction_items.discount_amount` ada tetapi praktis tidak pernah terisi. Tidak ada alasan
   diskon; pelakunya hanya bisa ditebak dari kasir nota.
2. **Server tidak menghitung ulang harga.** `POST /api/pos/transactions` dan
   `TransactionService.createTransaction` menyimpan `unitPrice`, `subtotal`, dan `totals` persis
   seperti kiriman layar kasir (yang diperiksa hanya bentuk data dan cukup-tidaknya pembayaran).
3. **Retur pelanggan mengembalikan harga penuh.** `retur-service` menghitung uang kembali =
   qty retur × `unit_price`, tanpa melihat diskon nota maupun diskon baris.
4. **Laporan tidak sejalan.** Penjualan per Produk menjumlah `transaction_items.total_price`
   (tidak tahu diskon nota); Laba Rugi memakai `transactions.payable_amount` (sudah dipotong).
5. **Tabel `promotions`** sudah ada sejak developer lama, kosong, dan tidak dibaca kode mana pun.
   Bentuknya (satu nilai, satu jenis) tidak cukup untuk syarat + hadiah + cabang + jam.
   Tingkat harga `PROMO` terdaftar tetapi tidak punya harga.
6. Jalur lain yang menyentuh angka nota: koreksi nota (`transaction-edit-service`, sudah mengenal
   diskon baris dan diskon kepala), batal nota, daftar tunggu (`open_bills`, dipulihkan apa adanya),
   bonus groomer/pengantar (`lib/grooming-bonus.ts`, membagi diskon nota sebanding), struk
   (`escpos-receipt`, `receipt-image`, `receipt-print`), settlement shift.

## Keputusan owner

Dari pembahasan 2026-10-11 (sudah di glosarium) dan 2026-10-12:

1. Promo dibuat **Owner/GM**, berlaku otomatis di **cabang yang dipilih**.
2. Promo hanya untuk golongan **Retail**. Pelanggan **Reseller dan Grosir tidak kena promo**.
3. Promo **tidak digabung** dengan diskon manual kasir.
4. Jasa boleh kena promo.
5. Bentuk promo: potongan per barang (dengan jumlah pcs), **beli X gratis Y**, **bundling** (harga
   paket; owner menentukan barang mana yang dipotong), **grooming gratis makanan pilihan**,
   **flash sale** (dari jam sekian sampai jam sekian harga jadi sekian).
6. **Diskon manual total nota diganti diskon per barang.** Kasir memilih barangnya lalu mengisi
   potongan.
7. Diskon manual punya **alasan berupa pilihan singkat** (+ "Lainnya" diketik).
8. **Batas diskon kasir: dibahas nanti**, tetapi dibuatkan "mesin" supaya aturannya jelas di satu
   tempat. Sampai dibahas, kasir bebas seperti sekarang.
9. Produk A promo dan produk B promo dibeli bersama → **dua-duanya tetap promo**.
10. Satu barang cocok dengan dua promo sekaligus → **hanya satu promo yang dipakai**: yang total
    belanjanya paling murah untuk pelanggan. Promo tidak pernah bertumpuk di satu barang.
11. **Kelipatan** diatur per promo ("mesin"): berlaku kelipatan ya/tidak + maksimal berapa kali per
    nota.
12. **Barang gratis otomatis masuk keranjang** ("biar jelas"). Bila hadiahnya pilihan (mis. makanan
    yang dipilih), kasir memilih satu dari daftar yang ditentukan promo.
13. Promo paket (bundling, beli X gratis Y) **hanya bisa diretur satu paket utuh**.
14. Setiap promo punya **laporan**: efektivitas dan peringkat toko. Ada **laporan riwayat diskon**
    per produk; diklik menampilkan nota-notanya (popup seperti yang sudah ada), berikut kapan dan
    oleh siapa.

Belum diputuskan (lihat "Hal terbuka"): isi aturan batas diskon kasir; daftar alasan diskon; promo
di portal pesanan.

## Rancangan

### Bentuk umum promo

Satu promo = **syarat** + **hadiah** + **batas**.

| Bagian | Isi |
|---|---|
| Syarat | Daftar barang (produk + satuan) dan jumlah minimalnya yang harus ada di keranjang. |
| Hadiah | Barang mana yang dipotong dan caranya: potong sekian per pcs, harga jadi sekian, atau gratis. Barang hadiah bisa sama dengan barang syarat atau barang lain; bisa berupa daftar pilihan. |
| Batas | Cabang, tanggal mulai–selesai, jam (opsional, untuk flash sale), kelipatan ya/tidak, maksimal kali per nota, aktif/nonaktif. Golongan selalu Retail. |

| Contoh owner | Syarat | Hadiah |
|---|---|---|
| Potongan per barang, mulai N pcs | N pcs produk A | A dipotong sekian per pcs / harga jadi sekian |
| Beli 1 gratis 1 | produk A | 1 produk A (atau B) gratis, otomatis masuk keranjang |
| Beli A, B lebih murah | produk A | produk B dipotong sekian |
| Bundling | produk A + produk B | potongan pada barang yang ditentukan owner |
| Grooming gratis makanan | jasa grooming | satu makanan dari daftar pilihan, gratis |
| Flash sale | produk A, pada jam tertentu | harga jadi sekian |

### Mesin-mesin (modul murni, satu tempat aturan)

Mengikuti pola `lib/ongkir.ts` dan `lib/product-weight.ts`: aturan ditulis sekali, dipakai layar
kasir **dan** server, dijaga tes.

| Mesin | Tugas |
|---|---|
| **Mesin promo** (`lib/promo/`) | Masukan: isi keranjang, golongan pelanggan, cabang, waktu, daftar promo aktif. Keluaran: potongan per baris + barang gratis yang harus ada + promo mana yang dipakai. Memuat aturan "satu barang satu promo", "pilih yang paling murah untuk pelanggan", kelipatan, dan maksimal per nota. |
| **Mesin diskon manual** (`lib/manual-discount.ts`) | Aturan diskon ketikan kasir: tidak boleh melebihi harga baris, tidak boleh di baris promo, alasan wajib dari daftar, dan **batas diskon** (bawaan: tanpa batas — diisi setelah dibahas owner). |
| **Mesin nilai bersih baris** | Satu rumus "berapa yang benar-benar dibayar untuk baris ini" — dipakai retur, laporan, dan bonus jasa supaya tidak ada rumus kembar. |

### Data

Tabel baru (nama final ditetapkan saat tahapnya; tabel `promotions` lama tidak dipakai dan
dibiarkan):

- **Promo**: kepala promo, barang syarat, barang hadiah, cabang yang berlaku.
- **Catatan potongan per baris nota**: satu baris per potongan — jenis (`PROMO` / `MANUAL`), nilai,
  untuk promo: id + **salinan nama & aturan promo saat itu**; untuk manual: alasan + pelaku + waktu.
  Inilah sumber semua laporan.

`transaction_items.discount_amount` dan `total_price` tetap diisi (jumlah potongan baris itu), jadi
laporan dan struk lama tetap terbaca. Nota lama tidak diubah.

### Pengaman

1. **Server sebagai hakim.** Saat nota disimpan, server menjalankan mesin promo dan mesin diskon
   manual sendiri atas isi keranjang. Hasil berbeda dari kiriman layar → nota ditolak dengan pesan
   yang bisa dipahami kasir (mis. promo sudah berakhir) dan layar menghitung ulang.
2. **Jam memakai jam server (WIB)**, bukan jam perangkat kasir.
3. **Satu barang satu promo; promo dan diskon manual tidak pernah di baris yang sama.**
4. **Tanpa edit/hapus**: promo yang sudah pernah terpakai tidak bisa diubah atau dihapus — hanya
   dinonaktifkan atau dibuat promo baru. Nota menyimpan salinan aturannya.
5. **Peringatan jual rugi** saat membuat promo: harga sesudah promo di bawah modal → popup wajib
   pilih.
6. **Retur** mengembalikan nilai yang benar-benar dibayar; barang promo paket hanya bisa diretur
   satu paket utuh. **Koreksi nota** mengunci baris promo (seperti baris jasa). **Batal nota**
   membalik seluruhnya seperti biasa.
7. **Daftar tunggu**: promo dihitung ulang saat nota dibayar, bukan saat ditahan.
8. **Saklar darurat** di Pengaturan (Owner/GM): mematikan semua promo sekaligus; kasir kembali
   seperti sebelum fitur ini.
9. **Di luar jangkauan promo**: Penjualan Grosir (Bulk Sale), PO Internal, kiriman antar cabang.
10. **Barang gratis tetap memotong stok dan modalnya tetap dihitung** — laba tidak tampak palsu.
11. Tes penjaga: tulisan dan rumus promo/diskon tidak boleh muncul di luar modul mesinnya.

### Tampilan (perkiraan yang sudah dilihat owner)

- Keranjang kasir: tombol **Diskon** di tiap baris barang → popup wajib pilih (potongan per pcs /
  untuk baris, alasan). Baris promo bertanda nama promonya dan tidak punya tombol Diskon.
- Layar bayar: tombol "+ Diskon" total nota dihapus; ringkasan memisahkan "Diskon manual" dan
  "Promo".
- Struk: potongan di bawah barangnya + "Anda hemat Rp …".
- Back Office: menu Promo (daftar, buat, nonaktifkan), Laporan Riwayat Diskon, Laporan Promo.

### Laporan

- **Riwayat Diskon** — per produk: berapa kali, total potongan, jenis (manual/promo), alasan; diklik
  → popup daftar nota (kapan, kasir, cabang). Nota sebelum fitur ini tampil sebagai "diskon nota
  (tidak per barang)" karena datanya memang tidak ada.
- **Laporan Promo** — per promo: jumlah nota, qty, omzet, total potongan, laba; perbandingan dengan
  masa sebelum promo; **peringkat toko**.

## Tidak termasuk

- Promo di portal pesanan (pesanan portal menjadi Penjualan Grosir) — dibahas terpisah.
- Promo "minimal belanja" untuk seluruh nota — disebut owner 2026-10-11, tidak ada di daftar
  2026-10-12; ditanyakan ulang sebelum tahap terakhir.
- Isi aturan batas diskon kasir — mesinnya disiapkan, aturannya menunggu owner.
- `apps/pos-desktop` (dibekukan).

## Hal terbuka

1. Isi aturan **batas diskon kasir** (owner: "dibahas dengan jelas nanti").
2. **Daftar alasan** diskon manual (contoh sementara: kemasan rusak, langganan, hampir kedaluwarsa,
   lainnya).
3. Promo di **portal pesanan**.

## Risiko & cara membatalkan

Tahap P1 dan P2 menyentuh jalur transaksi kasir dan retur (uang) — **risiko sedang–tinggi**: backup
DB sebelum rilis, tes DB di salinan data toko, dan dicoba di layar sebelum tayang. Tabel dan kolom
baru hanya tambahan, sehingga kode bisa dikembalikan ke rilis sebelumnya tanpa memulihkan DB; nota
yang sudah memakai promo tetap sah dan tetap terbaca. Sesudah tayang, saklar darurat mematikan promo
tanpa rilis ulang.
