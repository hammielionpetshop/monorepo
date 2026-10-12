# Promo Otomatis, Diskon per Barang & Laporan Diskon

**Tanggal:** 2026-10-12
**Status:** **P1a–P1c dikoding** (tabel catatan potongan + dua mesin; server menerima & memeriksa diskon per barang; retur mengembalikan nilai yang benar-benar dibayar; layar kasir belum berubah, belum tayang). Tahap: [`../backlog/2026-10-12-promo-otomatis.md`](../backlog/2026-10-12-promo-otomatis.md)
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

Tambahan 2026-10-12 (jawaban owner sesudah P1b):

15. **Potongan per barang di Penjualan Grosir (Bulk Sale) ikut tampil di Laporan Riwayat Diskon**
    ("ya perlu"). Potongan itu sudah lama ada di Back Office, tanpa alasan.
16. **Nota PO Internal yang diproses di kasir tidak boleh diberi diskon per barang** — mengikuti
    aturan yang ada: harga nota itu menjadi modal cabang penerima. Dijaga mesin diskon manual.

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

## Pelaksanaan P1a (2026-10-12)

- **Tabel `transaction_item_discounts`** (migrasi `0043`, `schema/transaction_discounts.ts`): satu baris per
  potongan pada satu baris nota — `kind` (`MANUAL` / `PROMO`, dijaga database), `amount` (rupiah untuk
  seluruh baris, harus > 0), `reason_code` + `reason_note` (manual), `promotion_id` +
  `promotion_name` + `promotion_snapshot` (promo; tabel promo baru ada di P2, jadi belum berkunci
  asing), `created_by_id`, `created_at`. Tanpa edit/hapus — nota yang dibatalkan tetap menyimpan
  catatannya; laporan menyaring lewat status nota.
- **Mesin diskon manual** (`lib/manual-discount.ts`): potongan per pcs / per baris, pemeriksaan
  (rupiah bulat > 0, tidak melebihi nilai baris, tidak di baris promo, alasan dari daftar, "Lainnya"
  wajib diketik), dan batas diskon (`DEFAULT_MANUAL_DISCOUNT_POLICY` = tanpa batas; bisa dibatasi
  persen dan/atau rupiah per baris tanpa mengubah kode lain). Daftar alasan di mesin masih
  **sementara** (hal terbuka butir 2).
- **Mesin nilai bersih baris** (`lib/line-net-value.ts`): nilai bersih = nilai baris yang tersimpan
  (sudah dipotong diskon barisnya) × yang dibayar ÷ jumlah semua baris, dibulatkan ke bawah. Nota
  tanpa diskon total → sama dengan nilai baris. Uang kembali retur sebagian = bagian sebanding qty,
  dibulatkan ke bawah; retur yang menghabiskan sisa qty mengembalikan seluruh sisa nilai, jadi
  total retur satu baris tepat sama dengan nilai bersihnya. Rumus yang dulu ada di
  `lib/grooming-bonus.ts` dipindah ke sini (hasil sama) — bonus jasa, retur (P1c), dan laporan
  memakai satu rumus.
- Belum ada kode yang menulis ke tabel baru atau memakai mesin diskon manual; itu P1b–P1d.

## Pelaksanaan P1b (2026-10-12)

- **Bentuk kiriman.** Tiap baris nota di `POST /api/pos/transactions` boleh membawa
  `manualDiscount: { amount, reasonCode, reasonNote? }` — `amount` = potongan untuk seluruh baris.
  Baris tanpa isian itu diperlakukan persis seperti sebelumnya.
- **Server sebagai hakim** (`lib/services/line-discount-service.ts`, dipanggil
  `TransactionService` sebelum apa pun ditulis): tiap baris berdiskon diperiksa mesin diskon manual
  (`checkManualDiscountLine`) — aturan mesin (alasan, tidak melebihi nilai baris, batas diskon,
  bukan baris gratis ongkir) **dan** angka layar harus cocok: potongan baris = diskon manual,
  tagihan baris = qty × harga − potongan. Lalu total nota (`checkManualDiscountTotals`): nota yang
  memakai diskon per barang **tidak boleh** sekaligus memakai diskon total nota (keputusan owner
  butir 6), dan total harus sama dengan jumlah tagihan baris. Satu saja tidak sah → seluruh nota
  ditolak (400, pesan untuk kasir), tidak ada stok atau uang yang tercatat.
- **Nota PO Internal** (`sourceIbtId` terisi) yang membawa diskon per barang ditolak
  (`checkManualDiscountAllowed`, keputusan owner butir 16).
- **Catatan potongan.** Sesudah baris nota tersimpan, satu baris `MANUAL` ditulis ke
  `transaction_item_discounts` (nilai, alasan, catatan, kasir). Gratis ongkir tidak dicatat di sini
  — itu urusan mesin ongkir.
- **Cara lama masih diterima.** Nota tanpa `manualDiscount` (termasuk yang memakai "+ Diskon" total
  nota) tidak diperiksa dan tidak membuat catatan potongan, sampai layar kasir diganti di P1d.
  Penjualan Grosir (Bulk Sale) dan sinkron offline tidak mengirim `manualDiscount`.
- **Batal nota** tidak berubah: stok dan uang dibalik seperti biasa; catatan potongan tetap ada
  (laporan kelak menyaring lewat status nota).

## Pelaksanaan P1c (2026-10-12)

- **Uang kembali retur pelanggan** (`ReturService.applyReturInTx`) = mesin nilai bersih baris:
  `netLineAmount` (nilai baris tersimpan × yang dibayar ÷ jumlah semua baris) lalu
  `netRefundAmount` (bagian sebanding qty, dibulatkan ke bawah; retur yang menghabiskan sisa qty
  mengembalikan seluruh sisa). Dasarnya dimuat satu fungsi, `loadReturLineBasis`, yang juga
  dipakai layar retur — perkiraan di layar dan hasil server tidak bisa berbeda.
- **Jumlah semua baris dihitung dari baris nota**, bukan kepala nota: Penjualan Grosir menyimpan
  kepala nota sebelum potongan baris, sehingga memakai kepala nota akan memotong dua kali.
- **Berlaku untuk nota yang sudah ada**: nota lama berdiskon total, gratis ongkir (uang kembali
  Rp 0), dan Penjualan Grosir berpotongan kini mengembalikan yang dibayar, bukan harga penuh.
  Nota tanpa diskon tidak berubah. Retur lama yang sudah tercatat tidak diubah; bila sebuah baris
  sudah pernah diretur dengan harga penuh, retur berikutnya hanya mengembalikan sisa nilainya.
- **Potong piutang** memakai uang kembali yang baru; **batal retur** mengembalikan persis yang
  tercatat (tidak berubah). **Laporan** (Laba Rugi, dashboard, daftar retur) menjumlah
  `return_items.refund_amount` yang tersimpan, jadi ikut benar tanpa diubah. `unit_price` di
  catatan retur tetap harga nota (untuk tampilan).
- **Perbaikan ikutan**: server dulu menghitung retur yang sudah dibatalkan sebagai "sudah
  diretur", sehingga barang yang returnya dibatalkan tidak bisa diretur lagi walau layar
  menampilkan sisanya. Kini sama dengan layar.

## Pelaksanaan P1d bagian 1 — layar kasir (2026-10-12)

- **Isian kasir disimpan di baris keranjang** (`CartItem.manualDiscount`: cara potong per pcs /
  untuk barang itu, nilai, alasan). Potongan dan tagihan baris **selalu dihitung ulang** dari isian
  itu oleh satu fungsi (`priceLine` di `cart-store`) lewat mesin diskon manual
  (`resolveManualDiscount`) — setiap qty berubah, golongan harga diganti, atau dua baris kembar
  digabung. Potongan per pcs ikut qty; potongan untuk barang itu tetap.
- **Isian yang tidak sah lagi dilepas**, bukan dipaksakan: bila qty dikurangi sampai potongan
  melebihi harga barangnya, diskonnya hilang dari baris itu dan kasir mengisinya ulang. Tagihan
  baris tidak pernah minus.
- **Popup Diskon** (`components/pos/line-discount-dialog.tsx`) = jendela wajib pilih: Batal /
  Hapus diskon / Pasang diskon. Pesan salah berasal dari mesin yang sama dengan server.
- **Layar bayar tanpa diskon total nota.** Tombol "+ Diskon" dan isiannya dihapus; kiriman layar
  disusun satu fungsi (`components/pos/checkout-payload.ts`) dan **selalu** membawa diskon total
  nota 0, baris berdiskon membawa `manualDiscount`. Jadi diskon ganda tidak mungkin dibuat dari
  layar, dan server tetap menolaknya (P1b). Akibatnya nota PO Internal tidak punya diskon sama
  sekali (butir 16).
- **Tanpa tombol Diskon:** baris ongkos kirim (potongannya = Gratis ongkir di layar bayar), baris
  jasa yang sudah dipindah ke keranjang tab Kasir lewat "Tambah belanja" (diatur dari tab
  Grooming, di keranjang hanya ditampilkan), dan seluruh keranjang PO Internal.
- **Tab Grooming:** tombol Diskon di tiap kucing pada daftar Terima Kucing; qty jasa selalu 1.
- **Daftar tunggu** menyimpan isi keranjang apa adanya, jadi diskonnya ikut tersimpan dan terbawa
  saat dibuka lagi.
- **Belum:** struk (bagian 2), koreksi nota dan jalur lain (P1e).

## Pelaksanaan P1d bagian 2 — struk (2026-10-12)

- **Mesin baris struk** (`lib/receipt-lines.ts`) = satu-satunya tempat aturan potongan di struk.
  Tiga penyusun struk — printer kasir (`escpos-receipt.ts`), cetak browser (`receipt-print.tsx`),
  gambar (`receipt-image.ts`) — memakainya, sehingga struk pertama dan cetak ulang (Riwayat kasir,
  detail nota Back Office) selalu sama. Baris ongkir tetap urusan mesin ongkir.
- **Angka di kertas bisa dijumlahkan dari atas ke bawah.** Baris "qty x harga" memuat nilai
  sebelum potongan; potongannya dicetak tepat di bawahnya sebagai "Diskon -x". Jumlah semua angka
  di daftar barang = total (bila tidak ada diskon nota).
- **"Subtotal / Diskon" di bawah daftar barang hanya untuk diskon nota** (nota kasir lama, diskon
  transaksi Penjualan Grosir). Nota tanpa potongan per barang tercetak persis seperti dulu. Pada
  nota berpotongan per barang yang kepala notanya sudah memuat potongan baris (Penjualan Grosir),
  hanya selisihnya yang dicetak — dulu potongan baris tercetak dua kali di printer kasir.
- **"Anda hemat Rp …"** = potongan per barang + gratis ongkir, dengan sebabnya: "(diskon)",
  "(gratis ongkir)", atau "(diskon + gratis ongkir)". Kalimatnya pindah dari mesin ongkir ke mesin
  baris struk; tes penjaga ongkir tetap melarang teks itu di tempat lain.
- **Alasan diskon tidak dicetak** di struk (bawaan sementara — pertanyaan untuk owner di backlog).
- **Cetak ulang** tidak perlu data baru: potongan baris sudah tersimpan di baris nota
  (`transaction_items.discount_amount`) dan sudah ikut dibaca kedua jalur cetak ulang.
- **Belum:** koreksi nota dan jalur lain (P1e); belum dicoba di printer toko.

## Pelaksanaan P1e — jalur lain (2026-10-12)

- **Dua cara tulis kepala nota** hidup berdampingan dan tidak boleh tertukar: nota kasir menyimpan
  `total_amount` = jumlah baris **sesudah** potongan baris dan `discount_amount` = diskon nota
  saja; Penjualan Grosir menyimpan `total_amount` **sebelum** potongan baris dan `discount_amount`
  yang sudah memuat potongan barisnya. `noteHeaderDiscount` (`lib/line-net-value.ts`) mengenali
  keduanya dan memisahkan diskon nota dari potongan baris.
- **Koreksi nota** (`transaction-edit-service` + layar Koreksi) memakai mesin itu dan
  mempertahankan cara tulis notanya. Sebelumnya koreksi selalu menulis ulang kepala nota dengan
  cara Penjualan Grosir, dan pada nota kasir "gratis ongkir + diskon total nota" diskon notanya
  hilang (tagihan naik diam-diam) — diperbaiki.
- **Baris berdiskon per barang dikunci di Koreksi** — baris yang punya catatan di
  `transaction_item_discounts` tidak bisa diubah qty/harga/potongannya, dihapus, atau diganti
  barangnya; jalan keluarnya batal nota atau retur. Alasannya: catatan potongan memuat alasan dan
  pelaku, dan tidak ada edit/hapus untuk catatan uang. Sama dengan baris jasa dan rencana baris
  promo. **Bawaan sementara — ditanyakan ke owner** (backlog, no. 4).
- **Koreksi bukan pintu diskon:** potongan baris tidak boleh bertambah dan barang yang baru
  ditambahkan tidak boleh membawa potongan. Diskon hanya lewat tombol Diskon di kasir.
- **"Total Diskon" di rekap shift** (tutup shift, pratinjau, rekap estafet, Riwayat Shift Back
  Office) = diskon kepala nota + potongan per barang yang tercatat, lewat satu pembaca di
  `line-discount-service`. Baris yang dikeluarkan lewat Koreksi dan nota batal tidak dihitung.
  Gratis ongkir bukan diskon (seperti sebelumnya). Kas yang diharapkan tidak terpengaruh.
- **Daftar tunggu:** isi keranjang tetap dipulihkan apa adanya; hanya potongan baris berdiskon
  yang dihitung ulang dari qty & harga barisnya sendiri (isian tak sah dilepas).
- **Tidak perlu diubah, dibuktikan dengan tes:** bonus groomer/pengantar (sudah memakai nilai
  baris sesudah potongan), Penjualan per Produk (jumlah yang ditagih per baris), Laba Rugi (yang
  dibayar) — keduanya berbeda hanya sebesar diskon total nota.
- **Belum:** Laporan Riwayat Diskon (P1f); belum dibuka di browser.

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
