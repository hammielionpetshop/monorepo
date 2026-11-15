# Backlog — Jasa (Grooming)

**Status:** J0–J4 **tayang 1.107.69 (2026-10-12) — menunggu uji coba owner** (dirilis sekaligus atas perintah owner, tanpa uji di layar lebih dulu) · Hotel Cat pending
**Tanggal:** 2026-10-11
**Sumber rencana:** [`docs/work/specs/2026-10-11-jasa-grooming-design.md`](../specs/2026-10-11-jasa-grooming-design.md)
**Istilah:** [`docs/glosarium-bisnis.md`](../../glosarium-bisnis.md)
**Scope:** `apps/backoffice` (POS web + Back Office) + `packages/db` (+ saringan katalog `apps/order-web`)

Satu item = satu sesi = satu branch/worktree = satu commit fitur (pesan menyebut `Jn`).
Tiap item mengikuti alur baku: `klaim: <branch>` di `main` (+ **kunci migrasi** bila ada
migrasi) → worktree → kode + tes → typecheck/lint/test/`changelog:check`/`migrations:check` →
lapor owner (bahasa sederhana + risiko) → **izin push per item** → backup DB produksi → rilis →
`klaim: lepas <branch>`. Status sesudah rilis: **"tayang — menunggu uji coba owner"**.

**Perubahan alur rilis — keputusan owner 2026-10-11 malam:** owner memilih **lanjut ke tahap berikutnya tanpa menayangkan J1** ("lanjut J2 tanpa tayang"). Jadi tetap satu item = satu sesi = satu branch = satu commit fitur, tetapi branch tiap tahap **bertumpuk** di atas tahap sebelumnya dan **belum ada yang di-push ke main**. Kapan dirilis (per tahap atau gabungan) diputuskan owner; izin push tetap diminta saat itu.

**Setiap pertanyaan bisnis baru atau temuan yang bertentangan dengan spec/keputusan** dilaporkan
ke owner dan dicatat di spec/glosarium **sebelum** item itu dilanjutkan — tidak diputuskan sendiri.

## Urutan pengerjaan

```
J0 ✅ → J1 ✅ → J2 ✅ → J3a ✅ → J3a2 ✅ → J3b ✅ → J3c ✅ → J4 ✅         (Hotel Cat: pending, dirancang terpisah)
        tinggi  rendah sedang rendah
```

---

## J0 — Dokumen ✅

- [x] Keputusan owner dicatat di daftar bahas & glosarium
- [x] Spec jasa grooming
- [x] Backlog ini

## J1 — Tanda jasa di produk; jasa tidak memotong stok

**Branch:** `feat/jasa-tanda-produk` · **Migrasi:** 0037 (kunci migrasi) · **Risiko:** sedang–tinggi
(jalur transaksi kasir)

- [x] Migrasi 0037: `products.product_kind` (`BARANG` bawaan) + `transaction_items.is_service`
      (snapshot per baris nota) + tandai empat produk grooming
- [x] Penjaga di `StockService` (`assertStockProduct`): dokumen stok untuk produk jasa ditolak
- [x] Jalur jual (tanpa stok/utang stok, modal 0), batal nota, retur pelanggan + batal retur,
      koreksi nota (baris jasa dikunci) — tes DB masing-masing
- [x] Mutasi Stok tidak menampilkan baris jasa
- [x] Form produk Back Office: pilihan "Jenis" (Owner/GM, berjejak audit, ditolak bila masih ada stok)
- [x] Jasa disaring dari stock opname, penyesuaian stok, PO, PO Internal/transfer, Bulk Sale,
      barang rusak, retur supplier, katalog portal pesanan (+ ditolak server)
- [x] Layar kasir: "Jasa — tanpa stok" sebagai ganti peringatan stok kosong
- [x] Potongan changelog, cek lengkap, laporan ke owner
- [x] Izin push owner → backup DB → rilis → **tayang 1.107.69 — menunggu uji coba owner**

Yang **tidak** berubah di J1: grooming masih dijual dari tab Kasir; stok minus & utang stok lama
dibiarkan; Hotel Cat tidak disentuh.

## J2 — Pengaturan groomer + data pemilik & kucing (Back Office)

**Branch:** `feat/jasa-groomer-kucing` (bertumpuk di atas `feat/jasa-tanda-produk`) · **Migrasi:** 0038 (tabel baru + izin) · **Risiko:** rendah

- [x] Tabel `groomers`, `pets`; izin `grooming.groomer.manage` (Owner, GM) & `grooming.pet.manage`
      (Owner, GM, Manager, Kasir) dipasang migrasi
- [x] Pengaturan → Groomer (tambah, ubah nama, nonaktifkan — tanpa hapus, berjejak audit)
- [x] Master Data → Data Kucing (daftar, cari, tambah, ubah, nonaktifkan) + daftar kucing di detail pelanggan
- [x] Pemilik baru otomatis jadi pelanggan Retail; nomor telepon yang sudah terdaftar ditolak dan
      layar menawarkan pemilik yang sudah ada
- [x] Cari pemilik dari nama/nomor telepon beserta kucingnya (`/api/bo/pets/owners`) — dipakai J3
- [x] Tanda "Baru" di menu & tambahan barunya
- [x] Izin push owner → backup DB → rilis → **tayang 1.107.69 — menunggu uji coba owner**

> **J3 dipecah menjadi tiga (2026-10-12)** karena terlalu besar untuk satu tahap — sama seperti pola Retur Internal (mesin dulu, layar kemudian):
> **J3a** mesin di server (tabel `grooming_orders`, nota membawa data kucing & groomer, grooming ikut batal saat nota dibatalkan/diretur, daftar & tandai diambil — tanpa layar) → **J3b** layar tab Grooming (Terima Kucing, Sedang Dikerjakan, Hotel "Segera hadir", Sudah Selesai, karcis, Lunas sekarang / Bayar saat ambil / Bayar & Ambil) → **J3c** Tambah belanja (satu nota dengan barang), jasa hilang dari daftar produk tab Kasir, nota berisi jasa tidak bisa ditahan.

## J3a — Mesin grooming di server (tanpa layar)

**Branch:** `feat/jasa-grooming-order` · **Migrasi:** 0039 · **Risiko:** sedang (menyentuh simpan nota, batal nota, retur)

- [x] Tabel `grooming_orders` (satu baris per ekor per kunjungan, menempel ke baris nota) + izin
      `grooming.order.manage` (Owner, GM, Manager, Kasir)
- [x] Simpan nota: baris jasa boleh membawa `grooming { petId, groomerId, condition }` → dibuat
      `grooming_orders`; data tidak sah membatalkan seluruh nota
- [x] Batal nota → grooming batal; retur baris jasa → grooming batal; batal retur → pulih
- [x] Daftar per cabang (aktif / selesai, cari, LUNAS / BELUM LUNAS dari piutang nota), tandai
      diambil (boleh walau belum lunas), hitung cetak karcis
- [x] Rute `api/pos/grooming/orders` (+ `[id]/pickup`, `[id]/ticket-printed`)
- [x] Data grooming masih **opsional** di J3a (jasa tetap bisa dijual dari tab Kasir); diwajibkan di J3c

## J3a2 — Delivery antar-jemput & ongkir jadi jasa (sisipan, tanpa layar kasir)

**Branch:** `feat/jasa-delivery-ongkir` · **Migrasi:** 0040 · **Risiko:** sedang–tinggi (mengubah **harga** ongkir; menyentuh simpan nota)

Tambahan owner 2026-10-12 (spec butir 21–27).

- [x] Jenis produk `JASA_ONGKIR`; produk ongkir ditandai jasa lewat migrasi (nama persis)
- [x] Harga ongkir → Rp 1.000 di semua tingkat harga (baris tidak dihapus), **dengan jejak audit**;
      besar ongkir lewat qty
- [x] `groomers.is_groomer` / `is_courier`; Pengaturan → Groomer & Pengantar (centang tugas)
- [x] Tabel `service_deliveries`; baris ongkir boleh membawa `delivery { courierId, address }`;
      satu per nota; hanya pada nota grooming; data tidak sah membatalkan seluruh nota
- [x] Alamat tersalin ke data pelanggan (berjejak audit)
- [x] Delivery selesai saat kucing terakhir diserahkan; batal/retur/pulih mengikuti nota
- [x] Daftar grooming menyertakan data delivery (pengantar, alamat, ongkir)

## J3b — Layar tab Grooming di POS

**Branch:** `feat/jasa-tab-grooming` · **Migrasi:** tidak · **Risiko:** sedang (layar kasir baru; menyentuh layar bayar & pelunasan piutang secara terbatas)

- [x] Tab Grooming + empat bagian (Hotel = "Segera hadir")
- [x] Terima Kucing: pemilik (cari / baru) → kucing (pilih / baru) → jasa + groomer + kondisi
- [x] Pilihan **Delivery Ya/Tidak** → alamat (terisi dari data pelanggan, bisa dilengkapi) + pengantar + qty ongkir
- [x] **Diskon nota** — memakai layar bayar kasir yang sudah ada (tombol "+ Diskon")
- [x] "Lunas sekarang" dan "Bayar saat ambil" (layar bayar terbuka dengan metode piutang terpilih)
- [x] Karcis dua lembar per ekor (Bluetooth → QZ → cetak browser); cetak ulang bertanda
- [x] Sedang Dikerjakan: "Diambil" / "Sudah diantar" / "Bayar & Ambil" (pelunasan piutang nota itu, lalu tandai diambil)
- [x] Sudah Selesai (riwayat per tanggal, cari, hanya lihat)
- [ ] **Dicoba di layar** (laptop) — belum

## J3c — Tambah belanja & kunci jalur lama

**Branch:** `feat/jasa-tambah-belanja` (bertumpuk di atas `feat/jasa-tab-grooming`) · **Migrasi:** tidak · **Risiko:** sedang (keranjang tab Kasir; aturan baru di simpan nota)

- [x] "Tambah belanja": baris jasa masuk keranjang Kasir tanpa digabung (satu nota dengan barang);
      barang yang sudah ada di keranjang dipertahankan
- [x] Di keranjang Kasir baris jasa terkunci (qty, tier, hapus per baris tidak berlaku); pelanggan
      terkunci ke pemilik kucing; "Lepas grooming" melepas semua baris jasa sekaligus
- [x] Sesudah nota tersimpan dari tab Kasir, layar pindah ke tab Grooming dan karcis tercetak
- [x] Jasa **grooming** hilang dari daftar produk tab Kasir dan tanpa data kucing ditolak server; **ongkir tetap** ada di tab Kasir (dipakai untuk antar barang)
- [x] Nota berisi grooming tidak bisa ditahan (Tunggu) — ditolak di layar dan di server
- [ ] **Dicoba di layar** (laptop) — belum

Catatan untuk rilis: daftar tunggu (nota yang ditahan) LAMA yang kebetulan berisi produk grooming
akan ditolak saat dibayar sesudah rilis ("jual lewat tab Grooming") — kasir cukup menghapus baris
itu dan mengisinya lewat tab Grooming. Periksa daftar tunggu yang masih terbuka sebelum tayang.

## J4 — Riwayat Grooming, Ganti Groomer, laporan jasa & bonus

**Branch:** `feat/jasa-riwayat-bonus` (bertumpuk di atas `feat/jasa-tambah-belanja`) · **Migrasi:** 0041 (jejak ganti groomer + dua izin; hanya menambah) · **Risiko:** rendah (halaman baru & laporan; tidak menyentuh keranjang, simpan nota, atau stok)

- [x] Halaman **Riwayat Grooming & Bonus** (Back Office → Laporan): saring tanggal, cabang, groomer, status bayar, cari
- [x] Ganti Groomer (Owner/GM, alasan wajib, berjejak di tabel + audit; grooming dibatalkan tidak bisa diganti)
- [x] Laporan jasa & bonus (per cabang / jasa / groomer) + **bonus delivery 50% ongkir untuk pengantar**
- [x] Tanda "Grooming" di Laporan Piutang
- [ ] **Dicoba di layar** (laptop) — belum

**Keputusan owner 2026-10-12:** laporan jasa di layar kasir **sudah cukup** dengan bagian "Sudah
Selesai" di tab Grooming (riwayat per tanggal, tanpa angka bonus); laporan bonus **cukup di Back
Office**. Tidak ada pekerjaan tambahan untuk ini.

Catatan untuk J3: umur disimpan sebagai perkiraan tanggal lahir (`pets.birth_date`) dari isian
tahun + bulan, supaya bertambah sendiri; kondisi kucing **tidak** ada di `pets` — ditulis per
kunjungan di `grooming_orders` (J3).

## Antar barang — pengantar & bonus untuk ongkir dari tab Kasir

**Branch:** `feat/antar-barang-pengantar` (dari `main` sesudah 1.107.69) · **Migrasi:** 0042 (alamat & pelanggan di `service_deliveries` boleh kosong; hanya melonggarkan) · **Risiko:** sedang (layar bayar tab Kasir — kotak hanya muncul bila ada ongkir)

Keputusan owner 2026-10-12 (spec butir 28–31): satu jalur — ada ongkir → pilih pengantar → selesai.

- [x] Layar bayar: kotak "siapa yang mengantar?" muncul otomatis bila keranjang berisi ongkir; Bayar terkunci sampai dipilih
- [x] Server: ongkir tanpa pengantar ditolak; antar barang tercatat tanpa alamat/pelanggan dan langsung Selesai; satu baris ongkir per nota
- [x] Nota grooming tetap memakai delivery dari tab Grooming (alamat wajib); ongkir tambahan di nota grooming ditolak dengan petunjuk
- [x] Laporan: bagian "Delivery & Antar Barang" dengan tanda jenis; bonus pengantar 50% ongkir sesudah diskon
- [x] **Gratis ongkir** (spec butir 32–34): centang di layar bayar & di Delivery tab Grooming; nilai ongkir tercatat sebagai ditanggung toko, tanpa bonus
- [ ] **Dicoba di layar** — belum
- [x] Izin push owner → backup DB → rilis → **tayang 1.107.70 — menunggu uji coba owner**

## Mesin ongkir — nilai standar gratis ongkir, struk, perbaikan laporan

**Branch:** `feat/mesin-ongkir` · **Migrasi:** tidak · **Risiko:** sedang (struk semua nota; layar bayar & tab Grooming saat gratis ongkir)

Keputusan owner 2026-10-12 (spec butir 35–38).

- [x] `lib/ongkir.ts` (mesin ongkir) + `lib/ongkir-server.ts`; tes penjaga `lib/ongkir-guard.test.ts` (gagal bila kode lain mengenali / mencetak ongkir sendiri)
- [x] Gratis ongkir = nilai standar dari Pengaturan (bawaan Rp 10.000), dicek server; tab Kasir & tab Grooming
- [x] Pengaturan nilai gratis ongkir (Owner/GM, berjejak `FREE_SHIPPING_VALUE_UPDATE`)
- [x] Struk: "Ongkos kirim", "GRATIS ONGKIR", "Anda hemat" — QZ/Bluetooth, cetak browser, gambar struk, cetak ulang dari riwayat POS & Back Office
- [x] Ringkasan antaran berbayar / gratis di laporan
- [x] Perbaikan rumus pendapatan Penjualan per Produk (diskon baris dikurangi dua kali)
- [ ] **Dicoba di layar** — belum
- [x] Izin push owner → backup DB → rilis → **tayang 1.107.71 — menunggu uji coba owner**

## Pending — Hotel Cat

Dibahas ulang dengan owner sebelum dirancang (check-in/out, makanan, grooming saat menginap,
tanpa bonus, dibayar saat keluar).

## Catatan kerja (log)

| Tanggal | Item | Catatan |
|---|---|---|
| 2026-10-11 | J0 | Rancangan dibahas dengan owner dalam delapan putaran tanya-jawab; semua keputusan ada di spec. Owner memberi perintah mulai. |
| 2026-10-11 | J1 | Diklaim di `main` (+ kunci migrasi) sebelum mulai; branch `feat/jasa-tanda-produk`. Migrasi 0037 dijalankan di DB uji (salinan data toko): tepat empat produk grooming bertanda jasa; Hotel Cat dan barang yang namanya mengandung "grooming" tidak ikut. Cek: typecheck lulus, lint 0 error (52 peringatan = angka dasar), 1293 tes unit, 101 tes DB (9 baru: `jasa-tanpa-stok.integration.test.ts`), `changelog:check`, `migrations:check`. **Belum dicoba di layar.** |
| 2026-10-11 | J1 | Temuan saat mengerjakan (dicatat, tidak diubah): (1) nota grooming LAMA dulu memotong stok, jadi pembalikannya (batal nota/retur) tetap lewat stok supaya cocok dengan Mutasi Stok — karena itu dipakai snapshot `is_service` per baris, bukan jenis produk saat ini; (2) nilai uang retur dihitung dari harga satuan tanpa memperhitungkan diskon baris (perilaku lama fitur Retur) — perlu diperhatikan saat bonus jasa dihitung di J4; (3) persetujuan stock opname dan hapus-buku utang stok mengubah stok tanpa lewat `StockService` — jasa dicegah masuk stock opname di pintu pembuatannya, sedangkan hapus-buku utang stok lama sengaja tetap bisa (owner akan membereskan utang stok lama sendiri). |
| 2026-10-11 | J2 | Owner memilih lanjut tanpa menayangkan J1 → branch bertumpuk. Diklaim di `main` (kunci migrasi berpindah ke `feat/jasa-groomer-kucing`). Migrasi 0038 dijalankan di DB uji. Cek: typecheck lulus, lint 0 error (52 peringatan = angka dasar), 1304 tes unit, tes DB lulus (6 baru: `grooming-master.integration.test.ts`), `changelog:check`, `migrations:check`. **Belum dicoba di layar.** Catatan: izin baru terbaca setelah pengguna keluar lalu masuk lagi (izin disimpan di token login). |
| 2026-10-12 | J3a | J3 dipecah tiga (mesin → layar → Tambah belanja) karena terlalu besar. Diklaim di `main` (kunci migrasi berpindah ke `feat/jasa-grooming-order`). Migrasi 0039 dijalankan di DB uji. Cek: typecheck lulus, lint 0 error (52 peringatan = angka dasar), 1304 tes unit (4 berkas tes ber-DB-tiruan diberi tiruan modul grooming), 116 tes DB (9 baru: `grooming-order.integration.test.ts`), `changelog:check`, `migrations:check`. **Tanpa layar — belum ada yang bisa dicoba pengguna.** Keputusan teknis: pelunasan "Bayar & Ambil" TIDAK dibuat jalur baru — layar J3b memanggil pelunasan piutang yang sudah ada lalu menandai diambil, supaya jalur uang tidak bertambah. |
| 2026-10-12 | J3a2 | Tambahan owner (delivery, ongkir jadi jasa Rp 1.000 × qty, bonus pengantar 50%, diskon di tab Grooming) dicatat di spec butir 21–27 & glosarium di `main` SEBELUM dikerjakan; diklaim di `main` (kunci migrasi berpindah). Temuan dari data toko: ongkir selama ini satu produk dengan tiga tarif yang disimpan di tingkat harga dan dipilih manual; ongkir juga dipakai untuk antar barang (lebih banyak daripada untuk grooming) → tetap dijual dari tab Kasir. Migrasi 0040 dijalankan di DB uji: satu produk ongkir bertanda jasa, sepuluh baris harga menjadi 1.000, sepuluh jejak audit. Cek: typecheck lulus, lint 0 error (52 peringatan), 1305 tes unit, 123 tes DB (7 baru: `grooming-delivery.integration.test.ts`), `changelog:check`, `migrations:check`. Perbaikan ikutan: pencarian nomor HP tidak lagi mencocokkan angka di dalam nama. **Belum dicoba di layar.** |
| 2026-10-12 | J3b | Diklaim di `main` (tanpa migrasi; kunci migrasi tetap di `feat/jasa-delivery-ongkir`). Layar bayar **tidak dibuat ulang**: tab Grooming memakai `CheckoutModal` kasir apa adanya (diskon, bayar pecah, piutang, struk), yang hanya ditambah tiga hal — meneruskan data grooming/delivery ke server, pilihan metode awal, dan panggilan saat nota tersimpan; hitungan uangnya tidak diubah. Temuan: pelunasan piutang di kasir selalu ke piutang TERTUA pelanggan, jadi "Bayar & Ambil" bisa salah melunasi nota lain → `payCustomerDebtsAtPos` diberi pilihan `transactionId` (tanpa pilihan itu perilakunya tetap). Cek: typecheck lulus, lint 0 error (52 peringatan), 1314 tes unit (baru: karcis, susunan baris nota), 124 tes DB (baru: pelunasan per nota), `changelog:check`, `migrations:check`. **Layar belum pernah dibuka di browser** — wajib dicoba di laptop sebelum tayang. |
| 2026-10-12 | J3c | Branch `feat/jasa-tambah-belanja`, tanpa migrasi. Baris klaim ditulis di branch ini (bukan lebih dulu di `main`) karena pengiriman catatan ke `main` ditolak pengaman otomatis sesi itu — `main` tidak disentuh sama sekali. Keranjang kasir: baris jasa dikenali dari data kucing/pengantaran yang dibawanya, tidak pernah digabung, dan dikecualikan dari ubah qty / ubah tier per baris / hapus per baris; ubah tier seluruh keranjang tetap menghargai ulang jasa (harga jasa mengikuti golongan pelanggan). Keputusan teknis (dilaporkan ke owner): (1) melepas grooming dari keranjang = semua baris jasa sekaligus, supaya ongkir delivery tidak tertinggal tanpa grooming; (2) yang tidak bisa ditahan adalah nota berisi **grooming** (atau baris yang membawa data pengantaran) — ongkir biasa untuk antar barang tetap boleh ditahan; (3) jasa grooming juga disaring dari data awal POS (`/api/pos/bootstrap`). Tes "jasa tanpa stok" (J1) kini memakai jasa tanpa data wajib (ongkir) karena grooming wajib membawa data kucing. Cek: typecheck lulus, lint 0 error (51 peringatan), 1324 tes unit (baru: 7 keranjang, 2 tahan nota, 1 daftar produk), 124 tes DB (tes "grooming tanpa data kucing ditolak" menggantikan tes lama yang membolehkannya), `changelog:check` (6 potongan), `migrations:check`. **Layar belum pernah dibuka di browser.** |
| 2026-10-12 | J3c | Analisa ulang atas permintaan owner. Diperbaiki: dua pertanyaan konfirmasi ("Lepas grooming" di keranjang Kasir, dan "ganti grooming lain di keranjang" saat Tambah belanja) semula memakai popup bawaan browser — diganti jendela wajib-pilih (`RequiredChoiceDialog`, aturan tampilan owner); tombol pintas kasir (F8/F9/F10, scanner) dikunci selama jendela itu terbuka. Diperiksa & tidak perlu diubah: tidak ada rute/aksi hapus di domain grooming (hanya nonaktif/dibatalkan); peta domain dan daftar tabel sudah memuat grooming; izin baru dipasang migrasi; lanjutkan daftar tunggu / proses PO Internal tetap bertanya dulu sebelum mengganti isi keranjang. Cek ulang: typecheck lulus, lint 0 error (51 peringatan), 1324 tes unit. |
| 2026-10-12 | J4 | Owner: "ok kerjakan j4". Branch `feat/jasa-riwayat-bonus`; klaim & kunci migrasi dicatat di branch (bukan `main`, alasan sama dengan J3c). Migrasi 0041 dijalankan di DB uji. Keputusan teknis (dilaporkan ke owner): (1) **dasar bonus** = nilai baris × (yang dibayar ÷ jumlah semua baris nota) — begitulah diskon nota "dibagi sebanding"; tidak bergantung pada cara diskon disimpan; dibulatkan ke bawah; (2) **tanggal laporan** = waktu kucing diterima (tanggal nota), bukan waktu diambil; (3) grooming **belum lunas tetap dihitung** bonusnya, tetapi ditampilkan terpisah ("di antaranya belum lunas") dan bisa disaring — owner yang memutuskan dibayar kapan; (4) bonus dihitung saat laporan dibuka, tidak disimpan — jadi pembatalan nota, retur, dan Ganti Groomer langsung tercermin, dan tidak ada angka bonus yang bisa "tertinggal"; (5) dua izin baru: lihat laporan (Owner, GM, Manager — Manager hanya cabangnya) dan Ganti Groomer (Owner, GM); (6) satu halaman dengan tiga bagian, bukan tiga menu. Cek: typecheck lulus, lint 0 error (51 peringatan), 1330 tes unit (6 baru: hitungan bonus), 133 tes DB (9 baru: `grooming-report.integration.test.ts`), `changelog:check` (7 potongan), `migrations:check` (0..41). **Layar belum pernah dibuka di browser.** |
| 2026-10-12 | J1–J4 | Pemeriksaan menyeluruh atas permintaan owner ("apakah semua mesin berjalan baik"). Semua cek otomatis diulang di ujung branch dan lulus (typecheck, lint 0 error, 1330 tes unit, 133 tes DB, changelog, migrasi). Tambahan yang baru kali ini dilakukan: (1) **build produksi** — seluruh halaman terakit termasuk halaman baru; berhenti hanya di langkah salin berkas "standalone" (kendala izin symlink Windows di laptop, bukan kode; tidak terjadi di server Linux); (2) **uji asap di laptop** — aplikasi hasil build dinyalakan dengan DB uji, lalu halaman dan rute dibuka lewat perintah dengan sesi Owner uji: Riwayat Grooming & Bonus (dengan dan tanpa saringan), Laporan Piutang, Groomer & Pengantar, Data Kucing, Master Produk, tab Kasir, tab Grooming, daftar jasa, daftar grooming aktif/selesai — semuanya menjawab 200 tanpa galat di log server; daftar produk tab Kasir mengembalikan 0 produk berjenis jasa grooming dan tetap memuat ongkir (harga 1.000). **Yang tetap belum terbukti:** tampilan dan klik di browser oleh manusia (tata letak, tombol, cetak karcis ke printer, alur bayar dari awal sampai akhir). |
| 2026-10-12 | Rilis | Owner: "ok coba rilis" (uji di laptop dilewati atas keputusan owner). Sebelum rilis, dibaca dari data toko (hanya baca): tidak ada nota di daftar tunggu yang berisi produk grooming; tepat empat produk grooming + satu produk ongkir yang akan ditandai migrasi; tabel/kolom jasa belum ada. Backup DB dibuat. J1–J4 masuk `main` sebagai satu rilis **1.107.69**; tujuh baris klaim dilepas dan kunci migrasi dikembalikan ke `—` di commit yang sama. Status: **tayang — menunggu uji coba owner**. Kotak "Dicoba di layar" di J3b, J3c, J4 sengaja **belum** dicentang. |
| 2026-10-12 | Antar barang | Owner meminta pengantaran barang biasa juga mencatat pengantar & bonus; dibahas tiga putaran, keputusan dicatat di spec butir 28–31 & glosarium **sebelum** dikerjakan; diklaim di `main` (+ kunci migrasi). Keputusan teknis (dilaporkan): jenis delivery dibedakan dari ada/tidaknya alamat (grooming selalu beralamat, antar barang tidak), jadi tanpa kolom baru; layar bayar mengenali baris ongkir lewat jenis produk yang kini ikut tersimpan di keranjang — daftar tunggu lama tanpa data itu ditolak server dengan petunjuk "hapus lalu tambahkan lagi". Migrasi 0042 dijalankan di DB uji. Cek: typecheck lulus, lint 0 error (51 peringatan), 1330 tes unit, 135 tes DB (baru: antar barang tanpa pelanggan/alamat, void/retur/batal retur, ongkir tanpa pengantar ditolak, dua baris ongkir ditolak, bonus antar barang dengan diskon nota), `changelog:check`, `migrations:check` (0..42). **Layar belum dibuka di browser.** |
| 2026-10-12 | Antar barang | Owner teringat **gratis ongkir** yang selama ini tidak tercatat; keputusan (butir 32–34) dicatat di spec & glosarium sebelum dikerjakan; rilis antar barang ditahan supaya digabung. Dikerjakan di branch & migrasi yang sama (0042 belum tayang, diperluas dengan kolom `service_deliveries.is_free_shipping`; di DB uji kolomnya ditambahkan manual karena 0042 sudah pernah dijalankan di sana). Keputusan teknis (dilaporkan): gratis ongkir = baris ongkir tetap qty × Rp 1.000 lalu **dipotong penuh** (Rp 0 di nota), jadi nilai yang ditanggung toko terbaca dari baris itu; server menolak tanda gratis yang masih tertagih dan ongkir Rp 0 tanpa tanda gratis. Cek: typecheck lulus, lint 0 error, 1331 tes unit, 137 tes DB (baru: gratis ongkir barang & grooming, gratis ongkir tidak sah ditolak). **Layar belum dibuka di browser.** |
| 2026-10-12 | Mesin ongkir | Owner: ongkir standar Rp 10.000 menjadi nilai gratis ongkir (bisa diubah di Pengaturan), struk "GRATIS ONGKIR" + "Anda hemat", dan meminta mesin khusus ongkir. Keputusan dicatat di spec butir 35–38 & glosarium, diklaim di `main` sebelum dikerjakan. **Temuan saat analisa:** rumus pendapatan Penjualan per Produk (dan daftar transaksi berisi produk) mengurangi diskon baris dua kali — tidak pernah terlihat (0 baris berdiskon di data toko, 0 nota gratis ongkir saat dicek), tetapi gratis ongkir 1.107.70 akan membuat baris ongkir minus; owner disarankan menunda pemakaian centang gratis ongkir sampai perbaikan tayang. Tes rumus dibuktikan gagal dengan rumus lama (Rp 5.000) dan lulus dengan perbaikan (Rp 15.000). Keputusan teknis (dilaporkan): tidak ada migrasi (nilai standar di `app_settings`, nilai gratis tiap nota terbaca dari baris nota); izin pengaturan memakai izin daftar Groomer & Pengantar (Owner/GM); cetak ulang membaca tanda gratis dari catatan pengantaran. Cek: typecheck, lint 0 error, tes unit (baru: mesin ongkir, penjaga, struk ongkir), 139 tes DB (baru: nilai standar, ubah pengaturan, rumus laporan). **Layar belum dibuka di browser.** |
| 2026-10-12 | Rilis mesin ongkir | Owner: "ok push". Build produksi lulus (EPERM standalone Windows saja); data toko: 0 nota gratis ongkir. Backup DB dibuat. Dirilis sebagai **1.107.71**; klaim dilepas di commit yang sama (tanpa migrasi, kunci tetap `—`). Status: **tayang — menunggu uji coba owner**. |
| 2026-10-12 | Rilis antar barang | Owner: "jika sudah aman bisa kita push". Sebelum rilis: build produksi lulus (berhenti hanya di salin "standalone", kendala Windows); dibaca dari data toko — 4 pengantar aktif sudah terdaftar, 0 daftar tunggu berisi ongkir. Backup DB dibuat. Dirilis sebagai **1.107.70**; klaim dilepas & kunci migrasi `—` di commit yang sama. Status: **tayang — menunggu uji coba owner**. |
