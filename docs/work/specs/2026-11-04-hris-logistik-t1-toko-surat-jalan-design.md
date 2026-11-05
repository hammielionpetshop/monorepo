# Spec Logistik Tahap 1 (LT1) — Cara Kirim di Kasir, Surat Jalan, Toko, dan Kunjungan di Trip

Tanggal: 2026-11-04 · Status: **v5 — LT1-K tayang produksi (1.107.108–110, lolos uji owner); LT1a tayang staging, owner "ok" 2026-11-04 (rincian §12); LT1b dipecah 3 (§13), LT1b-1 lolos uji, LT1b-2a dikerjakan (§13.3)**
Cakupan: tahap pertama **Logistik penuh**, di atas L6 Logistik Minimal ([spec L6](2026-11-03-hris-l6-logistik-design.md)). Menyentuh **tiga aplikasi**: kasir POS (`apps/pos-desktop`), backoffice (`apps/backoffice`), HRIS (`apps/hris` + `packages/logistics`).
Keputusan owner 2026-11-04:
- Urutan 5 tahap Logistik penuh (1 surat jalan + toko + kunjungan; 2 uang, tertunda, retur, potong nota; 3 laporan muat cabang + antar sendiri; 4 pemeriksaan uang + Catat di Kasir + tagih; 5 dashboard, laporan, bensin). Dikerjakan bersamaan dengan L9.
- **Toko dan surat jalan dibaca langsung dari kasir** (satu proyek), bukan diketik ulang di HRIS.
- Kiriman truk berasal dari **Gudang dan Toko Pusat**. Toko Pusat **tidak memakai Bulk Sale**. Fitur antar/ongkir kasir yang ada sekarang **bukan** kiriman orang logistik.
- **Wajib pilih cara kirim saat bayar**, hanya untuk nota berpelanggan (nota Umum tidak ditanya). Salah tandai harus punya jalan keluar.
- Truk **mampir ke Toko Pusat** mengambil barang. Grosir Gudang mayoritas dikirim, sebagian diambil. **PO Internal** Gudang → cabang dan Toko Pusat → cabang kadang dibawa truk, kadang dikirim sendiri.

Sumber v3: `04-logistik` LOG-01, 05 s.d. 10, 12, 13, 16, 19, 20, 22 s.d. 27, 41, 55, 56, 93, 95, 96, 99, 103; spec v3 `2026-10-13-logistik-spec.md` §3.1 (4F-1) dan §3.2 (4F-2, bagian kunjungan). Penyimpangan dari v3 dicatat di §11.
Dasar kode: L6 (`packages/logistics` migrasi 0001), L7a (tarif, logistics 0002), pola view baca kasir (`hris.pos_deliveries`, `hris.pos_suppliers`), kasir: `PaymentDialog` (POS), Bulk Sale (`/api/bo/bulk-sales`), PO Internal (`/api/bo/internal-transfers/[id]/status`, aksi `ship` → `IN_TRANSIT`), antar + ongkir (`petshop.service_deliveries`).
Aliran migrasi: **`petshop`** (kolom cara kirim + riwayat), **`logistics` 0003** (tabel + view), **`hris`** (hak, pengaturan, jenis pemberitahuan).

## 0. Pembaruan 2026-11-04 (sesudah LT1-K tayang) — mengalahkan isi di bawah bila bertentangan

| Hal | Keputusan owner | Status |
|---|---|---|
| LT1-K Cara kirim | Tayang produksi **1.107.108** (PR #70): pilihan di layar bayar (nota berpelanggan), Bulk Sale, Kirim PO Internal, Ubah cara kirim + riwayat, saklar Pengaturan Cabang, migrasi petshop `0050` | Tayang produksi |
| Langkah **Pengiriman** (mengganti §3.1 di layar bayar kasir) | Proses Bayar → jendela Pengiriman dulu (1 Ambil sendiri / 2 Kurir cabang / 3 Truk Gudang) → baru layar bayar (Opsi A, dua langkah; alasan: total final sebelum uang diketik). **Setiap nota kasir**, termasuk nota Umum | Tayang produksi 1.107.109, lolos uji |
| Kurir cabang | Wajib pilih pengantar + ongkir (8/10/15 rb atau ketik, kelipatan Rp 1.000) atau **Gratis ongkir**; baris ongkir dibuat otomatis lewat mesin ongkir. Produk Ongkos Kirim disembunyikan dari pencarian kasir. Tidak ada di Bulk Sale; tidak bisa lewat Ubah cara kirim; server menolak kurir tanpa ongkir | Tayang produksi 1.107.109, lolos uji |
| Truk Gudang | **Selalu gratis ongkir** — penanda antrean surat jalan HRIS; hanya nota berpelanggan | Tayang produksi 1.107.109, lolos uji |
| Grooming / PO Internal | Tab Grooming (antar-jemput kucing) tidak berubah dan melewati langkah Pengiriman (server: grooming tanpa antar = Ambil sendiri). PO Internal: cara kirim saat Kirim | Tayang produksi |
| Saklar Pengaturan Cabang | Mati = Truk Gudang disembunyikan + Bulk Sale/PO Internal tidak ditanya + kolom/saringan disembunyikan; langkah Pengiriman (ambil/kurir) tetap karena ongkir diisi di sana | Tayang produksi |
| Menu **Ongkir** kasir POS + laporan BO **Riwayat Ongkir** | Riwayat ongkir + pengantar cabang sendiri, semua kasir; **tanpa bonus** (bonus hanya di laporan BO) | Tayang produksi 1.107.109–110, lolos uji |
| Ojol / kurir luar | **Ambil sendiri** (keputusan owner) | Diputuskan |
| Belum dibuat | Cara kirim tercetak di struk (§3.1 butir 4) | Menyusul |
| **LT1a** | Disetujui owner 2026-11-04: §9 butir 3, 5, 6 sesuai saran; **salah tandai tetap diubah di Back Office** (HRIS hanya menautkan, tanpa pintu tulis ke kasir); Data Toko hanya toko yang pernah dikirimi truk / sudah diisi data pengiriman, lainnya lewat pencarian. Rincian §12 | Dikerjakan |

## 1. Batas

**Pokoknya:** saat bayar, kasir **wajib memilih cara kirim** untuk setiap nota berpelanggan: **Ambil sendiri**, **Diantar kurir cabang**, atau **Dikirim truk Gudang**. Nota "truk Gudang" (dari cabang mana pun, termasuk Toko Pusat) dan PO Internal bertanda "truk Gudang" otomatis muncul di HRIS sebagai **surat jalan** yang menunggu dikirim. Kepala Gudang memasukkannya ke **trip**. Driver mampir mengambil barang di cabang asal bila bukan Gudang, lalu menyelesaikan tiap kunjungan dengan **Terkirim**, **Kirim Besok**, atau **Gagal**.

**Upah driver tidak berubah:** ritase dan belanja tetap lahir seperti L6/L7 (LOG-33). Uji Banding gaji driver tidak terpengaruh.

**Tiga bagian, tayang berurutan (§10):**

| Bagian | Aplikasi | Isi |
|---|---|---|
| **LT1-K** Cara kirim di kasir | POS, backoffice | Pilihan wajib saat bayar (POS + Bulk Sale), pilihan wajib saat Kirim PO Internal, ubah cara kirim (jalan keluar salah tandai) + riwayatnya, kolom & saringan "Cara kirim" di Riwayat Transaksi |
| **LT1a** Surat Jalan + Data Toko | HRIS | Antrean surat jalan dari kasir, Diambil toko / Masukkan ke antrean, Perlu keputusan, Data Toko (rute bawaan, catatan, titik) |
| **LT1b** Surat jalan di trip | HRIS | Pilih surat jalan di trip, ambil barang di cabang asal, kunjungan Terkirim / Kirim Besok / Gagal di HP, Selesai lebih awal, titik toko, baris "Lewat trip" di Rekap Kehadiran (sisa L6) |

**Tidak dikerjakan di LT1:**

| Hal | Tahap | Akibat sementara |
|---|---|---|
| Uang di toko (cash/transfer/deposit/tempo), potong nota, barang kejadian | 2 | Terkirim tanpa angka uang; penagihan tetap seperti sekarang di kasir |
| Catatan tertunda terpisah, merah > 3 hari, retur | 2 | Surat jalan yang pernah Kirim Besok bertanda "pernah tertunda ×n", tampil paling atas |
| Antar kurir cabang di HRIS (3 foto, PJ), laporan muat, paket | 3 | Pilihan "Diantar kurir cabang" tetap memakai alur antar + ongkir kasir yang ada |
| Pemeriksaan uang, Catat di Kasir, daftar tagih | 4 | Batal di HRIS menampilkan pengingat "batalkan juga di kasir" |
| Dashboard, laporan, bensin, tinjau kirim di luar titik | 5 | Jarak dari titik toko **dicatat** saat Terkirim |
| Status Siap Kirim, Menuju Garasi, foto bak kosong, Laporan Pulang | — (§9 butir 9) | Trip tetap Draft → Berjalan → Selesai seperti L6 |
| Gabung toko dobel | — (§9 butir 6) | Pelanggan dobel dirapikan di kasir |

Branch backoffice/POS membawa fragment changelog kasir + tanda Baru backoffice (`apps/backoffice/lib/new-features.ts`); branch HRIS membawa fragment `apps/hris/changelog.d` + tanda Baru HRIS.

## 2. Data

### 2.1 Kasir (schema `petshop`, migrasi petshop)

| Perubahan | Isi |
|---|---|
| `transactions.delivery_method` | `PICKUP` (ambil sendiri) / `BRANCH_COURIER` (kurir cabang) / `TRUCK` (truk Gudang); **kosong** = nota Umum atau nota sebelum fitur ini. Wajib terisi bila nota punya pelanggan (diperiksa server, juga untuk transaksi offline yang masuk belakangan) |
| `inter_branch_transfers.delivery_method` | `TRUCK` / `SELF` (kirim sendiri); wajib saat aksi **Kirim** (`ship`) |
| `delivery_method_changes` (baru) | riwayat ubah cara kirim: jenis dokumen (nota/PO Internal), id, lama → baru, alasan, oleh (user kasir/backoffice atau akun HRIS), sumber (kasir/backoffice/HRIS), kapan. Tanpa hapus |

Nota hasil konversi PO Internal (Bulk Sale ke pelanggan cabang internal, `source_ibt_id` terisi) **tidak** ditanya cara kirim: pilihannya ada di PO Internal-nya, supaya tidak dobel.

### 2.2 Dibaca HRIS dari kasir (view di schema `logistics`, tanpa salin)

Pola `hris.pos_*`: peran app HRIS tidak membaca `petshop` langsung. Kolomnya kontrak, dengan stub tes.

| View | Isi |
|---|---|
| `logistics.pos_customers` | id, kode, nama, HP, alamat, aktif, `is_internal_branch`, cabang tertaut |
| `logistics.pos_truck_sales` | nota `delivery_method = 'TRUCK'`: id transaksi, cabang kasir asal, nomor struk, tanggal (WIB), pelanggan, nominal (`payable_amount`), status (`COMPLETED`/`VOIDED`/`PENDING_VOID`), revisi |
| `logistics.pos_truck_transfers` | PO Internal `delivery_method = 'TRUCK'`: id, nomor, cabang asal, cabang tujuan, status, tanggal kirim |
| `logistics.pos_sales_lookup` | pencarian nota berpelanggan per nomor (untuk "Masukkan ke antrean" dari HRIS) |

**Nomor surat jalan = nomor struk kasir / nomor PO Internal** (sudah unik). Nominal, toko, dan status batal **dibaca hidup**: koreksi atau batal nota di kasir langsung terlihat.

Hanya nota dan PO Internal bertanggal ≥ `logistics.delivery_from` yang masuk antrean (§9 butir 3).

### 2.3 Milik Logistik (tabel baru, migrasi logistics 0003)

Tanpa foreign key ke `petshop`/`hris` (angka biasa, dijaga pintu server + tes). Tanpa hapus (PRI-02), jejak oleh + kapan.

| Tabel | Isi |
|---|---|
| `stores` (data pengiriman toko) | id pelanggan kasir (unik), rute bawaan (rute kirim, boleh kosong), catatan pengiriman. Baris dibuat saat pertama diisi |
| `store_points` (titik toko) | pelanggan, lintang/bujur, akurasi, foto depan toko, pemasang, sumber (kunjungan/kantor), status `PENDING` / `APPROVED` / `REJECTED` / `REPLACED`, pemutus + alasan tolak, laporan "titik salah". Satu `APPROVED` per toko |
| `delivery_notes` (surat jalan) | jenis `SALE` (nota) / `TRANSFER` (PO Internal), id dokumen kasir (unik per jenis), nomor, cabang asal, tujuan (pelanggan **atau** cabang), status `WAITING` / `ON_TRIP` / `DELIVERED` / `NEEDS_DECISION` / `CANCELLED`, hitungan Kirim Besok, nominal saat masuk trip (pembanding perubahan kasir). Baris dibuat saat pertama disentuh; sebelumnya "Menunggu" langsung dari view |
| `trip_pickups` (ambil di cabang asal) | trip, cabang asal (bukan Gudang), status `OPEN` / `DONE`, foto barang dimuat, oleh + kapan |
| `trip_visits` (kunjungan) | trip, tujuan (pelanggan atau cabang), status `OPEN` / `DELIVERED` / `TOMORROW` / `FAILED` / `RELEASED`, diproses oleh + kapan, alasan, foto, lokasi + akurasi + jarak dari titik toko, dilepas oleh + alasan |
| `trip_visit_notes` | kunjungan ↔ surat jalan (satu surat jalan hanya di satu kunjungan terbuka) |
| `delivery_note_events` | riwayat surat jalan: masuk trip, dilepas, barang dimuat, terkirim, Kirim Besok, Gagal, keputusan, batal, "berubah di kasir sesudah masuk trip" |

## 3. Aturan

### 3.1 Pilihan cara kirim saat bayar (LT1-K)

- Muncul di **layar Bayar POS** dan **Bulk Sale backoffice**, **hanya bila nota punya pelanggan**. Nota Umum / Guest tidak ditanya.
- Tiga tombol besar: **Ambil sendiri**, **Diantar kurir cabang**, **Dikirim truk Gudang**. **Tidak ada yang tercentang dari awal**; tombol Bayar baru aktif sesudah memilih. Urutan tombol: cabang dengan pengaturan "truk sering" (bawaan **Gudang**) menaruh **Dikirim truk Gudang** paling depan.
- **Diantar kurir cabang** memakai alur antar + ongkir yang sudah ada. Bila nota sudah berisi baris ongkir/antar, pilihan otomatis Diantar kurir cabang dan pilihan lain dikunci (ubah lewat batal antar di kasir).
- Pilihan tercetak di struk/surat jalan ("Dikirim truk Gudang").
- **Offline:** pilihan ikut tersimpan di antrean offline. Server menolak nota berpelanggan tanpa pilihan; versi POS lama yang belum diperbarui diterima dengan cara kirim kosong dan bertanda "belum dipilih", tampil di Riwayat Transaksi untuk dilengkapi.
- **PO Internal:** saat aksi **Kirim**, wajib pilih **Truk Gudang** atau **Kirim sendiri**. Berlaku untuk semua cabang asal (Gudang → cabang, Toko Pusat → cabang).

### 3.2 Jalan keluar salah tandai

Semua perubahan tercatat di `delivery_method_changes` (lama, baru, alasan wajib, siapa, kapan); tidak ada yang dihapus.

| Salahnya | Kapan | Jalan keluar | Oleh |
|---|---|---|---|
| Ditandai **truk**, ternyata diambil sendiri / kirim sendiri | Belum masuk trip, atau trip masih Draft | **Ubah cara kirim** (detail transaksi / PO Internal di backoffice, atau **Tandai diambil sendiri** di HRIS). Bila di trip Draft, otomatis keluar dari trip | Kasir & Kepala Toko cabang asal (detail transaksi), Kepala Gudang, Marketing, Pemilik/GM |
| Sama | Sesudah truk berangkat | Kepala Gudang **lepas kunjungan** (alasan), lalu ubah cara kirim | Kepala Gudang, Pemilik/GM |
| Ditandai **ambil sendiri / kirim sendiri**, ternyata perlu truk | ≤ 7 hari sejak nota (`logistics.reopen_days`) | **Ubah cara kirim** di backoffice, atau **Masukkan ke antrean** dari HRIS (cari nomor nota/PO) | Kasir & Kepala Toko cabang asal, Kepala Gudang, Pemilik/GM |
| Ditandai **kurir cabang**, ternyata truk (atau sebaliknya) | Kapan saja sebelum Terkirim | Ubah di backoffice; antar + ongkir **dibatalkan dulu** di kasir (ongkir dan bonus kurir milik kasir) | Kepala Toko cabang asal, Pemilik/GM |
| Nota Umum yang ternyata perlu dikirim | ≤ 7 hari | Isi pelanggan lewat koreksi nota yang sudah ada, lalu pilih cara kirim | Sesuai aturan koreksi nota |
| Apa pun sesudah **Terkirim** | — | Terkunci; **Buka lagi** hanya Pemilik/GM dengan alasan | Pemilik/GM |
| Lewat 7 hari | — | Hanya Pemilik/GM | Pemilik/GM |

### 3.3 Surat jalan (LOG-08 s.d. 10, 12, 95, 96)

| Status | Masuk lewat | Keluar ke |
|---|---|---|
| **Menunggu dikirim** | Nota / PO Internal bertanda truk; Kirim Besok; Kirim ulang; dilepas dari trip; trip Draft dibatalkan | Dalam perjalanan; keluar antrean bila cara kirim diubah (§3.2); Batal |
| **Dalam perjalanan** | Masuk trip | Terkirim; Menunggu (Kirim Besok / dilepas); Perlu keputusan |
| **Terkirim** | Kunjungan Terkirim | akhir (Buka lagi: Pemilik/GM) |
| **Perlu keputusan** | Kunjungan Gagal | Menunggu (Kirim ulang); Batal |
| **Batal** | Dari Perlu keputusan (alasan); otomatis bila nota/PO dibatalkan di kasir selagi Menunggu | akhir (buka lagi Pemilik/GM ≤ 7 hari) |

- "Diambil toko" v3 diganti **ubah cara kirim** (§3.2): satu tempat kebenaran, yaitu tanda di kasir.
- **Nota dikoreksi/dibatalkan di kasir sesudah masuk trip**: surat jalan bertanda **"berubah di kasir"** (nominal lama → baru, atau "dibatalkan di kasir") di rincian trip dan Trip Saya; Kepala Gudang diberi tahu dan memutuskan lepas atau tetap antar.
- **Batal di HRIS** tidak membatalkan nota kasir; layar menulis "Batalkan juga nota [nomor] di kasir" (daftar Catat di Kasir: Tahap 4).
- Urutan antrean: **pernah tertunda** paling atas (paling lama dulu, LOG-20), lalu toko di rute bawaan yang dipilih (LOG-06), lalu tanggal. Tanda cabang asal ("dari Toko Pusat") di tiap baris.
- Satu tujuan boleh banyak surat jalan; di satu trip semuanya **satu kunjungan** (LOG-10). PO Internal ke cabang = kunjungan ke **cabang**, tanpa urusan uang di tahap mana pun.

### 3.4 Surat jalan di trip (LOG-15, 16, 19, 22, 23)

- Saat **buat/ubah trip Draft**, Kepala Gudang mencentang surat jalan Menunggu. Trip berisi surat jalan wajib punya **rute kirim** (ritase tetap per trip).
- Surat jalan dari cabang asal selain Gudang otomatis membuat langkah **Ambil barang di [cabang]** di trip (satu per cabang asal).
- Masuk trip = **Dalam perjalanan**. Satu surat jalan hanya di satu trip yang belum selesai.
- **Sesudah Berangkat:** surat jalan tidak bisa ditambah (masuk trip berikutnya, LOG-19); kantor masih bisa **melepas** kunjungan yang belum diproses (alasan) → kembali Menunggu. Kunjungan Terkirim/Gagal terkunci.
- **Batal trip Draft:** semua surat jalannya kembali Menunggu.
- Trip **tanpa surat jalan tetap boleh** (masa peralihan, §9 butir 8).

### 3.5 Ambil barang di cabang asal (catatan owner: truk mampir ke Toko Pusat)

- Di Trip Saya, langkah **Ambil barang di Toko Pusat** (daftar nota/PO dari cabang itu) diselesaikan driver/kenek dengan **satu foto barang dimuat**.
- Selama belum selesai, kunjungan yang **semua** surat jalannya dari cabang itu belum bisa Terkirim; kunjungan campuran (Gudang + Toko Pusat) menunggu juga.
- Barang cabang yang ternyata belum siap: kantor melepas surat jalannya dari trip (kembali Menunggu) atau driver menandai **Belum siap** (alasan) → surat jalan cabang itu kembali Menunggu, kunjungan yang tinggal isinya tetap jalan.

### 3.6 Kunjungan di Trip Saya (LOG-24, 26, 27, 55, 56, 99)

- Kartu kunjungan: nama toko/cabang besar, alamat, catatan pengiriman, **telepon**, **Buka peta** (titik disetujui) atau **Pasang titik**, daftar nomor surat jalan + nominal (PO Internal tanpa nominal), cabang asal, tanda "berubah di kasir".
- Hanya selagi trip **Berjalan**, oleh driver atau kenek trip itu. Urutan bebas. Dua awak menekan bersamaan: yang kedua menerima "Sudah diproses [nama] pukul [jam]".
- **Terkirim:** **foto barang diterima** (kamera langsung); lokasi dicatat, jarak dari titik toko **dicatat, tidak ditolak** (LOG-99).
- **Kirim Besok** (toko tutup, tidak ada orang): alasan + foto → surat jalan kembali Menunggu, hitungan +1. Bisa **Coba lagi** selama trip masih Berjalan (LOG-121).
- **Gagal** (ditolak, batal pesan): alasan + foto → Perlu keputusan. Tidak bisa dicoba lagi.
- Kirim Besok dan Gagal berlaku untuk seluruh kunjungan (LOG-122).
- Foto langsung tersimpan begitu diambil; tombol dikunci sekali tekan.

### 3.7 Menutup trip (LOG-27, 29, 30, 103)

- **Sampai Garasi ditolak** selama ada kunjungan atau ambil barang **terbuka**; pesan menyebut yang tersisa. Jalan keluarnya **Selesai lebih awal**: alasan + foto, sisa kunjungan menjadi Kirim Besok, sisa ambil barang menjadi Belum siap.
- **Tutup atas nama driver** oleh kantor: sisa otomatis Kirim Besok / Belum siap.
- Ritase, belanja, absen: **tidak berubah** dari L6/L7.

### 3.8 Toko dan titik (LOG-01, 05 s.d. 07, 93)

- **Toko = pelanggan kasir.** Nama, HP, alamat diubah **di kasir** (satu sumber). HRIS menambah **rute bawaan**, **catatan pengiriman**, **titik**.
- Data Toko menampilkan pelanggan non-internal yang pernah punya surat jalan, ditambah yang sudah diberi data pengiriman; pelanggan lain bisa dicari.
- **Titik:** dipasang driver/kenek dari kunjungan (GPS akurasi ≤ 50 m + foto depan toko, kamera langsung) → **Menunggu** → Kepala Gudang/Pemilik/GM **Setujui** atau **Tolak** (alasan). Pasangan mereka sendiri langsung Disetujui. Titik disetujui hanya diganti mereka; driver menekan **Laporkan titik salah**. Riwayat disimpan.
- Driver/kenek hanya melihat toko di trip-nya (LOG-07).

### 3.9 Perlu keputusan (LOG-56, 123)

- Kepala Gudang / Pemilik / GM memilih **Kirim ulang** (kembali Menunggu, pernah tertunda) atau **Batal** (alasan, pengingat batalkan di kasir). Batal dibuka lagi Pemilik/GM ≤ 7 hari.

### 3.10 Pengaturan

| Kunci | Bawaan | Arti |
|---|---|---|
| `logistics.delivery_from` | tanggal tayang produksi LT1-K | Nota/PO sebelum tanggal ini tidak masuk antrean |
| `logistics.reopen_days` | 7 | Batas ubah cara kirim oleh kasir/Kepala Gudang, buka lagi Batal |
| `logistics.point_accuracy_m` | 50 | Akurasi GPS terburuk saat pasang titik |
| `logistics.store_radius_m` | 100 | Batas "di luar titik toko" (dicatat saja) |
| Kasir: "truk sering" per cabang | Gudang | Urutan tombol cara kirim (§3.1) |

## 4. Layar

| Layar | Aplikasi | Dipakai | Isi |
|---|---|---|---|
| **Bayar** (ubah) | POS, Bulk Sale backoffice | Kasir | Tiga tombol cara kirim, wajib bila ada pelanggan |
| **PO Internal › Kirim** (ubah) | backoffice / POS | Pengirim PO | Pilih Truk Gudang / Kirim sendiri |
| **Detail transaksi / PO Internal** (ubah) | backoffice | Kasir, Kepala Toko, Pemilik/GM | Cara kirim + **Ubah** (alasan) + riwayat; status kiriman dari HRIS (Menunggu / Dalam perjalanan / Terkirim) bila ada |
| **Riwayat Transaksi** (ubah) | backoffice | sama | Kolom & saringan "Cara kirim", tanda "belum dipilih" |
| **Surat Jalan** (baru) | HRIS `/logistik/surat-jalan` | Kepala Gudang, Marketing, Pemilik, GM; Finance lihat | Tab per status dengan angka. Baris: nomor, tanggal, asal, tujuan (+ belum ada titik), rute bawaan, nominal, umur, pernah tertunda ×n, berubah di kasir. Tombol **Masukkan ke antrean** (cari nomor), **Tandai diambil sendiri** |
| Rincian surat jalan | HRIS | sama | Data dari kasir, status + riwayat, trip & kunjungan, foto; tombol menurut status |
| **Data Toko** (baru) | HRIS `/logistik/toko` | Kepala Gudang, Marketing, Pemilik, GM; Finance lihat | Tab **Toko** dan **Titik menunggu**; rincian toko: data kasir (baca), data pengiriman (Ubah), titik + riwayat, surat jalan |
| **Trip** (ubah) | HRIS | Kepala Gudang, Pemilik, GM | Langkah **Surat jalan** di form; rincian trip: ambil barang + kunjungan + **Lepas** |
| **Trip Saya** (ubah) | HRIS HP | Driver, kenek | "Berjalan: 4 dari 9 selesai"; Ambil barang di Toko Pusat; kartu kunjungan; Selesai lebih awal |
| **Rekap Kehadiran** (ubah) | HRIS | sama seperti sekarang | Baris "Lewat trip": Jalan / Tidak jalan (sisa L6) |

**Beranda HRIS:** kartu "Surat jalan perlu keputusan", "Titik toko menunggu", "Nota berubah di kasir".

## 5. Hak

| Hak | Bawaan |
|---|---|
| Kasir: ubah cara kirim nota/PO cabang sendiri ≤ 7 hari | Kasir, Kepala Toko (izin backoffice yang ada untuk detail transaksi); lewat 7 hari: Pemilik/GM |
| `logistics.delivery_note.view` | Kepala Gudang, Marketing, Finance, Pemilik, GM |
| `logistics.delivery_note.manage` (masukkan ke antrean, tandai diambil sendiri) | Kepala Gudang, Marketing, Pemilik, GM |
| `logistics.delivery_note.decide` (Perlu keputusan, lepas kunjungan) | Kepala Gudang, Pemilik, GM |
| `logistics.store.view` / `.manage` | lihat: + Finance; ubah: Kepala Gudang, Marketing, Pemilik, GM |
| `logistics.store_point.decide` | Kepala Gudang, Pemilik, GM |
| Kunjungan, ambil barang, pasang titik | tanpa hak khusus: hanya awak trip itu, dicek server |

HRIS mengubah cara kirim kasir **hanya lewat satu pintu tulis** yang terdaftar (fungsi DB milik `petshop` yang mencatat riwayat), bukan menulis tabel kasir langsung; dijaga tes batas.

## 6. Mesin terjadwal

Tidak ada mesin baru (dibaca hidup dari kasir). `logistics-daily` (L6) ikut membuang foto kunjungan sesuai umur foto absen; foto titik yang disetujui disimpan.

## 7. Pemberitahuan (HRIS)

| Kejadian | Ke |
|---|---|
| Kunjungan Gagal | Kepala Gudang, Pemilik, GM |
| Nota berubah/dibatalkan di kasir sesudah masuk trip | Kepala Gudang |
| Ambil barang di cabang: Belum siap | Kepala Gudang |
| Titik diusulkan / dilaporkan salah; titik ditolak | Kepala Gudang; pemasang |

## 8. Tes

- **Kasir (unit + integrasi):** nota berpelanggan tanpa cara kirim ditolak server; nota Umum lolos; nota berongkir terkunci "kurir cabang"; nota hasil PO Internal tidak ditanya; offline dengan pilihan tersimpan; POS lama → "belum dipilih"; PO Internal Kirim tanpa pilihan ditolak; ubah cara kirim mencatat riwayat, ditolak lewat 7 hari untuk kasir.
- **HRIS aturan (unit):** peralihan status §3.3 termasuk yang ditolak; satu surat jalan satu trip terbuka; kunjungan per tujuan; ambil barang menahan Terkirim; syarat Sampai Garasi; Selesai lebih awal; urutan antrean.
- **HRIS integrasi (stub `petshop`):** nota truk → Menunggu → trip → ambil barang Toko Pusat → Terkirim → **ritase sama persis dengan L6** (tes pembanding upah); Kirim Besok; Gagal → Kirim ulang / Batal; nota dibatalkan di kasir selagi Menunggu → Batal, sesudah masuk trip → bertanda; ubah cara kirim dari HRIS lewat pintu tulis tercatat di riwayat kasir.
- **Batas:** HRIS tidak membaca `petshop` selain view; tidak menulis `petshop` selain pintu tulis; `bo_app` tidak menulis `logistics`.

## 9. Keputusan owner

Butir 1, 2, 4, 13 selesai lewat LT1-K yang tayang. Butir 3, 5, 6 **disetujui 2026-11-04** (LT1a). Butir 7–12 **dijawab owner 2026-11-04** (kolom Saran diganti jawaban; rincian §13).

| # | Pertanyaan | Saran |
|---|---|---|
| 1 | Pilihan cara kirim **wajib** saat bayar, hanya nota berpelanggan, **tanpa pilihan tercentang**, tombol truk paling depan di Gudang | **Ya** (catatan owner) — tayang |
| 2 | Tiga pilihan: Ambil sendiri / Diantar kurir cabang / Dikirim truk Gudang | **Ya**. Kurir cabang tetap alur ongkir yang ada — tayang |
| 3 | Antrean mulai dari tanggal berapa? | **4 Nov 2026** (tayang LT1-K) — **disetujui** |
| 4 | Batas ubah cara kirim oleh kasir/Kepala Gudang | **7 hari**, sesudahnya Pemilik/GM — tayang di Back Office |
| 5 | Alamat & HP toko diubah di mana? | **Di kasir** (satu sumber) — **disetujui** |
| 6 | Gabung toko dobel ikut? | **Tidak**; dirapikan di kasir — **disetujui** |
| 7 | Terkirim wajib foto barang diterima? | **Wajib.** Owner menambah: saat Terkirim driver juga **wajib memilih cara bayar** dan mengisi **laporan kunjungan** (§13.2) — ditarik maju dari Tahap 2 ke LT1b-3 |
| 8 | Trip tanpa surat jalan tetap boleh? | **Ya**, masa peralihan — disetujui |
| 9 | Siap Kirim / Menuju Garasi / foto bak kosong v3 ikut? | **Ikut** (owner: driver sudah terbiasa di aplikasi lama) — LT1b-2, beserta Laporan Pulang (amper bensin, keadaan mobil, perlu bensin) |
| 10 | Ambil barang di Toko Pusat: satu foto barang dimuat oleh driver/kenek, tanpa tanda terima staf Toko Pusat? | **Ya**, cukup 1 foto barang diterima driver — disetujui (LT1b-1) |
| 11 | Titik toko ikut LT1b? | **Ya** — disetujui (LT1b-2) |
| 12 | Baris "Lewat trip" di Rekap Kehadiran (sisa L6) ikut LT1b? | **Ya** — disetujui (LT1b-1) |
| 13 | Urutan tayang LT1-K → LT1a → LT1b (§10)? | **Ya** |

## 10. Urutan kerja dan tayang

| Urutan | Bagian | Kenapa di urutan ini | Tayang produksi |
|---|---|---|---|
| **1** | **LT1-K** Cara kirim di kasir | HRIS hanya membaca tanda ini; tanpa tanda, antrean kosong. Kasir perlu waktu membiasakan diri. Data asli langsung terkumpul untuk uji LT1a/b. Berguna sendiri: Riwayat Transaksi bisa disaring "truk Gudang" | **Bisa segera** sesudah lolos uji staging (kasir sudah di produksi) |
| 2 | **LT1a** Surat Jalan + Data Toko | Kepala Gudang mulai melihat antrean dari data asli; tanpa mengubah trip driver | Ikut kepindahan HRIS ke produksi (target 26 Des) |
| 3 | **LT1b** Surat jalan di trip + HP driver | Paling besar dan mengubah kebiasaan driver; diuji sesudah antrean terbukti benar | Ikut / sesudah kepindahan HRIS |

Catatan: HRIS (termasuk L6 Trip) **belum di produksi**. LT1a dan LT1b diuji di staging dan baru dipakai sungguhan saat HRIS pindah. LT1-K tidak menunggu itu.

## 11. Penyimpangan dari v3

| Hal | v3 | LT1 | Alasan |
|---|---|---|---|
| Asal surat jalan | Tarik transaksi Gudang tiap menit; sebelum itu diketik | **Tanda cara kirim di kasir**, dibaca hidup | Satu proyek; catatan owner (Toko Pusat tanpa Bulk Sale) |
| Diambil toko | Status di HRIS | **Ubah cara kirim** (satu sumber di kasir) | Jalan keluar salah tandai satu tempat |
| Nota cabang ke truk | Laporan muat + paket (4F-3) | **Nota cabang bertanda truk** + langkah Ambil barang | Kebiasaan nyata: truk mampir ke Toko Pusat |
| PO Internal | Tidak lewat Logistik | Ikut bila bertanda truk, kunjungan ke cabang | Catatan owner |
| Toko diketik di HRIS | Ada (sebelum sambungan) | Tidak; toko = pelanggan kasir | Satu sumber |

## 12. Rincian LT1a (disetujui owner 2026-11-04)

LT1a **hanya membaca** kasir dan menyimpan data pengiriman toko. Tidak ada tabel surat jalan, trip, atau kunjungan (itu LT1b), dan tidak ada pintu tulis ke kasir.

**Data.** Migrasi `logistics` 0003: view `pos_customers`, `pos_truck_sales`, `pos_truck_transfers` (§2.2; `pos_sales_lookup` tidak perlu karena salah tandai diubah di Back Office), semuanya ditolak bila ditulis; tabel `stores` (§2.3, tanpa titik). Migrasi `hris`: pengaturan `logistics.delivery_from` = 2026-11-04 dan hak bawaan.

**Surat Jalan** (`/logistik/surat-jalan`), status dihitung dari kasir:

| Tab | Nota truk | PO Internal truk |
|---|---|---|
| **Menunggu dikirim** | `COMPLETED` | `IN_TRANSIT` |
| **Diterima cabang** | — | `PARTIALLY_RECEIVED` / `FULLY_RECEIVED` |
| **Batal di kasir** | `VOIDED` / `PENDING_VOID` (tertulis "menunggu batal") | `CANCELLED` |

- Hanya dokumen bertanggal ≥ `logistics.delivery_from`. Urutan: paling lama dulu. Baris: nomor, tanggal + umur (hari), cabang asal, tujuan (toko + rute bawaan, atau cabang), nominal (nota saja).
- Saringan: cabang asal, rute bawaan, cari nomor / nama toko.
- Tombol **Ubah di Back Office** membuka detail nota (`/transactions?trx=`) atau PO Internal (`/purchase-orders/internal/[id]`) di Back Office; alamat Back Office dari env `BACKOFFICE_PUBLIC_URL` (staging: `STAGING_BO_ORIGIN`). Bila kosong, tombol diganti teks "Ubah di Back Office › Transaksi".
- Sampai LT1b, nota tetap di Menunggu dikirim (belum ada Terkirim); keluar bila cara kirimnya diubah di Back Office atau dibatalkan.

**Data Toko** (`/logistik/toko`):
- Daftar: pelanggan **bukan internal** yang pernah punya nota truk (≥ `delivery_from`) atau sudah punya data pengiriman. Kotak cari mencari **semua** pelanggan (nama, kode, HP).
- Rincian: data kasir (nama, kode, HP, alamat — hanya baca, "ubah di kasir"), data pengiriman (**rute bawaan** = rute kirim aktif, **catatan pengiriman** ≤ 500 huruf) + tombol Ubah, nota truk terakhir.

**Hak:** `logistics.delivery_note.view` (Kepala Gudang, Marketing, Finance), `logistics.store.view` (Kepala Gudang, Marketing, Finance), `logistics.store.manage` (Kepala Gudang, Marketing). Pemilik/GM semuanya. Hak `manage`/`decide` surat jalan menyusul di LT1b.

## 13. LT1b dipecah tiga (owner 2026-11-04)

Owner menyetujui LT1b dikerjakan dan diuji dalam tiga bagian: kantor dulu, lalu HP driver, lalu uang dan laporan di toko.

| Bagian | Isi | Diuji oleh |
|---|---|---|
| **LT1b-1 Kantor** | Centang surat jalan di form trip, kunjungan per tujuan, langkah Ambil barang (1 foto), Lepas, tab Dalam perjalanan, tanda berubah di kasir, tabel "Lewat trip" Rekap Kehadiran | Kepala Gudang |
| **LT1b-2 HP driver** | Siap Kirim → Berangkat → kunjungan (Terkirim + foto / Kirim Besok / Gagal) → foto bak kosong → Menuju Garasi → Sampai Garasi + Laporan Pulang; Selesai lebih awal; Perlu keputusan; titik toko | Driver |
| **LT1b-3 Uang & laporan di toko** | Cara bayar saat Terkirim, foto bukti transfer, laporan kunjungan, retur dibawa pulang, daftar uang untuk Finance | Driver + Finance |

### 13.1 LT1b-1 (dikerjakan 2026-11-04)

**Data.** Migrasi `logistics` 0004: `delivery_notes` (unik per jenis + id dokumen kasir; status `WAITING`/`ON_TRIP`/`DELIVERED`/`NEEDS_DECISION`/`CANCELLED`; hitungan tertunda; nominal + revisi kasir saat masuk trip), `trip_pickups`, `trip_visits`, `trip_visit_notes` (satu surat jalan satu kunjungan terbuka, indeks unik), `delivery_note_events`. Semua tidak bisa dihapus. Tanpa migrasi `hris` (hak `logistics.trip.manage` yang ada sudah cukup).

- **Form trip Draft**: langkah Surat jalan berisi antrean Menunggu (paling lama dulu, saringan rute trip / cari, centang semua). Server memeriksa ulang: kasir masih menunggu, tanggal ≥ `logistics.delivery_from`, belum di trip lain (409 menyebut nomor trip-nya). Wajib rute kirim bila ada surat jalan.
- **Gudang** = cabang kasir yang ditautkan ke cabang garasi (Mobil & Rute). Surat jalan dari cabang lain membuat satu langkah **Ambil barang di [cabang]** per trip; bila tidak ada lagi surat jalan dari cabang itu, langkahnya "Tidak jadi". Kunjungan yang isinya dari cabang itu bertuliskan "Menunggu barang diambil di …" (penahan Terkirim berlaku di LT1b-2).
- **Ambil barang** ditandai awak trip selama Berjalan dengan 1 foto (kamera langsung); dicatat sebagai riwayat "barang dimuat" pada surat jalan dari cabang itu.
- **Lepas** (kantor, alasan wajib, trip Draft atau Berjalan): surat jalan kunjungan itu kembali Menunggu.
- **Batal trip Draft**: semua surat jalan kembali Menunggu, ambil barang "Tidak jadi".
- **Trip ditutup** (Sampai Garasi / ditutup kantor) dengan kunjungan yang belum diproses: kunjungan menjadi Kirim Besok, surat jalannya kembali Menunggu dengan hitungan tertunda +1, ambil barang yang belum diambil menjadi Belum siap. Ini sementara sampai LT1b-2 (Sampai Garasi kelak ditolak selama ada kunjungan terbuka).
- **Berubah di kasir**: nominal/revisi kasir dibandingkan dengan saat masuk trip; batal / menunggu batal di kasir ditandai merah. Ditampilkan di rincian trip dan Trip Saya. Pemberitahuan ke Kepala Gudang menyusul di LT1b-2.
- **Surat Jalan**: tab baru **Dalam perjalanan** (dengan nomor trip); Menunggu tidak lagi memuat yang sedang di trip; nota yang dibatalkan di kasir selagi di trip pindah ke Batal di kasir dengan nomor trip-nya; tanda "Pernah tertunda ×n".
- **Rekap Kehadiran**: tabel "Lewat trip" untuk orang ber-cara absen Lewat trip: hari Jalan (ada trip yang berangkat), jumlah trip, hari Tidak jalan, dihitung sampai kemarin.

### 13.2 Keputusan owner untuk LT1b-3 (2026-11-04)

- Cara bayar di toko dipilih driver saat Terkirim, satu pilihan baku:
  - **Lunas cash**.
  - **Lunas transfer**: wajib foto bukti transfer.
  - **Deposit / titip cash** = **bayar sebagian** (contoh: tagihan 2 juta, dibayar 1 juta); sisa ditagih kantor kemudian. Ini **berbeda** dari arti "deposit" di LOG-44 v3.
  - **Tempo**: tidak ada uang dan tidak ada bukti transfer.
- Laporan kunjungan sesudah Terkirim memakai **pilihan baku** supaya seragam (mis. barang salah, kurang, rusak, retur, kendala lain) + foto + catatan; **kantor** yang memutuskan potong nota.
- **Retur boleh langsung dibawa pulang** driver saat kunjungan (beda dari LOG-58/126 v3 yang hanya lewat tugas kantor).
- Uang yang dicatat driver: HRIS mencatat dan menampilkan daftar untuk Finance; pencatatan ke kasir tetap diketik tangan Finance; pemeriksaan uang menyusul (Tahap 4).

### 13.3 LT1b-2 (owner "ok, setuju semua" 2026-11-04)

LT1b-2 dipecah dua: **LT1b-2a** alur trip di HP driver (di bawah) dan **LT1b-2b** titik toko (§3.8: pasang dari kunjungan dengan GPS ≤ 50 m + foto depan toko → Menunggu → Setujui/Tolak; Laporkan titik salah; Buka peta). LT1b-1 lolos uji owner 2026-11-04.

**Alur trip:** Draft → **Siap Kirim** → Berangkat → kunjungan → **Foto bak kosong** → **Menuju Garasi** → Sampai Garasi + **foto amper bensin** → **Laporan Pulang** (driver). Status di database tetap `DRAFT`/`RUNNING`/`DONE`/`CANCELLED`; Siap Kirim dan Menuju Garasi adalah tanda di atasnya (`ready_at`, `heading_home_at`) supaya absen lewat trip, ritase, denda, dan Uji Banding yang membaca `RUNNING` tidak berubah. **Ritase dan jam pulang tetap lahir saat Sampai Garasi.**

| # | Keputusan |
|---|---|
| 1 | **Siap Kirim** ditekan Kepala Gudang (`logistics.trip.manage`); syarat: awak sah, isi (rute kirim atau belanja), tarif ada. Driver/kenek hanya melihat trip Siap Kirim, Berjalan, dan yang selesai hari ini. **Berangkat hanya dari Siap Kirim.** **Kembali ke Draft** boleh sebelum Berangkat; Ubah trip hanya selagi Draft |
| 2 | Kunjungan (awak trip, selama Berjalan dan belum Menuju Garasi): **Terkirim** = foto barang diterima (kamera langsung), lokasi dicatat; **Kirim Besok** dan **Gagal** = alasan baku + foto (+ keterangan, wajib untuk Lainnya). Kirim Besok: Toko tutup / Tidak ada orang / Waktu habis / Lainnya → surat jalan kembali Menunggu, tertunda +1, bisa **Coba lagi** selama trip Berjalan. Gagal: Ditolak toko / Batal pesan / Alamat tidak ketemu / Lainnya → **Perlu keputusan**. Terkirim ditahan selama Ambil barang cabang asalnya belum selesai, dan bila ada nota yang dibatalkan di kasir (minta kantor Lepas). Dua awak bersamaan: yang kedua menerima "Sudah diproses [nama] pukul [jam]" |
| 3 | **Foto bak kosong** = langkah Menuju Garasi; hanya bila semua kunjungan, ambil barang, dan belanja beres. Layar menampilkan barang yang ikut pulang (Kirim Besok/Gagal). Tanpa langkah turunkan barang terpisah |
| 4 | **Selesai lebih awal** (alasan + foto bak): sisa kunjungan → Kirim Besok, ambil barang → Belum siap, belanja → Tidak jadi, lalu Menuju Garasi. **Sampai Garasi ditolak sebelum Menuju Garasi**; penutupan otomatis sisa kunjungan saat Sampai Garasi (sementara LT1b-1) dihapus. Tutup atas nama driver oleh kantor tetap (sisa → Kirim Besok / Belum siap) |
| 5 | **Sampai Garasi** = titik garasi + foto amper bensin (wajib), trip Selesai. **Laporan Pulang trip** diisi driver aktif trip itu, satu layar satu tugas: keadaan mobil (Baik / Perlu perhatian + isi masalah, foto boleh) → perlu isi bensin besok? (ya = perkiraan nominal, kelipatan Rp 1.000) → ada masalah? (boleh dilewati) → Kirim. Kenek tidak mengisi. **Tanpa serah terima** (owner). Belum terkirim = kartu "Laporan Pulang menunggu" di Trip Saya (2 hari); tidak mengubah jam pulang |
| 6 | Daftar **Bensin & Mobil** (`/logistik/bensin-mobil`, hak baru `logistics.vehicle_followup.manage`: Kepala Gudang, Finance; Pemilik/GM): "Perlu isi bensin" (satu per mobil, laporan baru menggantikan) → **Sudah diisi**; "Mobil perlu perhatian" → **Selesai** (catatan). Tanpa Buku Kas (Tahap 5). Kartu Beranda |
| 7 | **Perlu keputusan** (tab di Surat Jalan, hak baru `logistics.delivery_note.decide`: Kepala Gudang; Pemilik/GM): **Kirim ulang** (kembali Menunggu, tertunda +1) atau **Batal** (alasan wajib, pengingat "batalkan juga di kasir"). Batal dibuka lagi Pemilik/GM ≤ `logistics.reopen_days` (7) hari. Kunjungan Gagal memberi tahu Kepala Gudang, Pemilik, GM. Tab baru **Terkirim**, **Perlu keputusan**, **Batal logistik** |
| 8 | Titik toko → LT1b-2b |
| 9 | Ganti awak oleh kantor sampai Menuju Garasi (seperti L6); surat jalan tidak bisa ditambah sesudah Berangkat |

**Data.** Migrasi `logistics` 0005: kolom trip `ready_at/ready_by_account_id`, `heading_home_at/heading_home_by_employee_id/empty_bed_photo_file_id/early_finish_reason`, `fuel_gauge_photo_file_id`; kolom kunjungan `reason_code`; riwayat surat jalan `RESENT`/`DROPPED`/`REOPENED`/`RETRY`; tabel `trip_end_reports` (satu per trip, tidak dihapus) dengan tindak lanjut bensin/mobil. Migrasi `hris` 0042: hak + pengaturan `logistics.reopen_days`.

**Belum di LT1b-2a:** pemberitahuan "nota berubah di kasir sesudah masuk trip" (butuh pemeriksa berkala), titik toko (LT1b-2b), uang dan laporan di toko (LT1b-3).

### 13.4 LT1b-2b Titik toko (owner "ok, saya setuju" 2026-11-04)

Owner menyetujui 9 butir usulan, termasuk saran butir 3 (laporan titik salah sekaligus mengusulkan titik baru) dan butir 8 (kantor boleh menempel koordinat).

| # | Keputusan |
|---|---|
| 1 | **Pasang titik** dari kartu kunjungan di Trip Saya: awak trip, selama trip Berjalan dan belum Menuju Garasi, hanya kunjungan ke toko (bukan cabang). Lokasi HP dibaca dulu; akurasi harus ≤ `logistics.point_accuracy_m` (50 m), kalau tidak ditolak dengan pesan "akurasi X m, tunggu sebentar lalu ulangi". Lalu **foto depan toko** (kamera langsung). Titik masuk **Menunggu** |
| 2 | **Setujui / Tolak** (alasan wajib) oleh pemegang hak baru `logistics.store_point.decide` (Kepala Gudang; Pemilik/GM lewat full_access) di tab **Titik menunggu** di Data Toko. Usulan dari pemegang hak itu sendiri langsung **Disetujui** |
| 3 | Satu toko paling banyak **satu titik Disetujui** dan **satu usulan Menunggu**. Bila toko sudah punya titik Disetujui, awak hanya bisa **Laporkan titik salah** (alasan wajib) yang sekaligus membawa titik baru (GPS + foto). Titik lama tetap dipakai sampai usulan baru disetujui; sesudah disetujui titik lama menjadi **Diganti** |
| 4 | **Buka peta** (Google Maps, `https://www.google.com/maps/search/?api=1&query=lat,lng`) di kartu kunjungan, rincian trip, dan rincian toko bila titik Disetujui ada |
| 5 | **Jarak saat Terkirim**: bila toko punya titik Disetujui dan lokasi HP terbaca, jarak dicatat di kunjungan (`trip_visits.distance_m`). Lebih dari `logistics.store_radius_m` (100 m) tampil tanda **Di luar titik** di rincian trip. Hanya dicatat, tidak menolak |
| 6 | Riwayat titik tidak bisa dihapus (trigger `forbid_delete`). Foto titik tidak ikut dibuang mesin harian |
| 7 | Pemberitahuan: usulan baru / laporan titik salah → pemegang `logistics.store_point.decide`; ditolak → pemasang |
| 8 | **Tempel koordinat** di rincian toko (pemegang `logistics.store_point.decide`): angka "lat, lng" atau tautan Google Maps (`@lat,lng`, `q=lat,lng`, `!3dlat!4dlng`), tanpa foto, langsung Disetujui |
| 9 | Driver/kenek hanya melihat titik toko yang ada di trip-nya (kartu kunjungan), tidak membuka Data Toko |

**Data.** Migrasi `logistics` 0006: tabel `store_points` (toko, status `PENDING`/`APPROVED`/`REJECTED`/`REPLACED`, asal `VISIT`/`OFFICE`, jenis `NEW`/`CORRECTION` + alasan, lat/lng/akurasi, foto, trip + kunjungan asal, pemasang, pemutus, alasan tolak; indeks unik satu Disetujui dan satu Menunggu per toko; tanpa hapus), kolom kunjungan `distance_m`. Migrasi `hris` 0043: hak `logistics.store_point.decide` (Kepala Gudang) + pengaturan `logistics.point_accuracy_m` (50) dan `logistics.store_radius_m` (100).

**Layar.** Trip Saya (kartu kunjungan: Pasang titik toko / Titik menunggu persetujuan / Buka peta + Laporkan titik salah), Data Toko (kolom Titik, tab **Titik menunggu**), rincian toko (kartu Titik toko + riwayat + Tempel koordinat), rincian trip (jarak + Di luar titik, Buka peta), kartu Beranda "titik toko menunggu persetujuan". Foto titik dibuka lewat `/api/logistics/store-photo` (pemegang `logistics.store.view` / `logistics.store_point.decide`, atau pemasangnya).

### 13.5 LT1b-3 Uang dan laporan di toko (keputusan owner §13.2; owner "kerjakan langsung" 2026-11-04)

Rincian ini mengikuti §13.2. Bagian yang tidak diputuskan owner memakai pilihan paling hati-hati dan dicatat di bawah supaya bisa ditinjau saat uji.

| # | Aturan |
|---|---|
| 1 | **Tagihan** kunjungan toko = jumlah **sisa piutang kasir** (`petshop.customer_debts.remaining_amount`, status belum `PAID`) dari nota-nota di kunjungan itu, dibaca hidup lewat view baru `logistics.pos_customer_debts`. Nota tanpa piutang = sudah lunas di kasir. PO Internal (kunjungan ke cabang) tidak punya cara bayar |
| 2 | **Cara bayar** dipilih awak di layar Terkirim, sesudah foto barang diterima: **Lunas cash** (diterima = tagihan), **Lunas transfer** (diterima = tagihan, foto bukti transfer wajib, kamera langsung), **Bayar sebagian / titip cash** (nominal cash 1 s.d. tagihan − 1), **Tempo** (tidak ada uang dan bukti). Tagihan 0 → tidak ada pilihan, dicatat "Tidak ada tagihan (lunas di kasir)". Layar menampilkan ringkasan sebelum Simpan karena catatan uang tidak bisa diubah awak |
| 3 | Catatan cara bayar satu per kunjungan (`visit_payments`), disimpan bersama Terkirim dalam satu transaksi; tidak bisa diubah atau dihapus. Koreksi menyusul di pemeriksaan uang (Tahap 4) |
| 4 | **Laporan kunjungan** sesudah Terkirim, selama trip Berjalan dan belum Menuju Garasi: pilihan baku **Barang salah / Barang kurang / Barang rusak / Retur (dibawa pulang) / Kendala lain** + foto wajib + catatan (wajib untuk Kendala lain). Boleh lebih dari satu per kunjungan. Retur ditandai "dibawa pulang" dan tampil di daftar barang yang ikut pulang saat Menuju Garasi |
| 5 | Laporan kunjungan memberi tahu pemegang `logistics.delivery_note.decide` (Kepala Gudang, Pemilik, GM). Kantor yang memutuskan potong nota di Back Office; di HRIS laporan ditutup **Selesai** dengan catatan wajib (mis. "nota dipotong Rp 20.000"). Daftar di menu baru **Laporan Toko** (`/logistik/laporan-toko`, pemegang `logistics.delivery_note.view`); kartu Beranda bila ada yang belum selesai |
| 6 | **Uang dari Toko** (`/logistik/uang-toko`, hak baru `logistics.store_payment.view`: Finance, Kepala Gudang; Pemilik/GM; pemegangnya juga bisa membuka foto bukti transfer): per tanggal trip, baris per kunjungan (trip, awak, toko, nota, tagihan, cara bayar, diterima, foto bukti) + jumlah per trip: cash dibawa driver, transfer, sisa ditagih kantor (sebagian + tempo). Hanya daftar; pencatatan ke kasir tetap diketik Finance, pemeriksaan uang menyusul (Tahap 4) |
| 7 | Rincian trip dan Trip Saya menampilkan cara bayar + laporan kunjungan per kunjungan |

**Data.** Migrasi `logistics` 0007: view baca saja `pos_customer_debts`, tabel `visit_payments` (unik per kunjungan; cara bayar, tagihan, diterima, foto bukti; cek isi per cara bayar; tanpa hapus) dan `visit_reports` (jenis, catatan, foto, dibawa pulang, ditutup kantor + catatan; tanpa hapus). Migrasi `hris` 0044: hak `logistics.store_payment.view` (Finance, Kepala Gudang). Stub tes `petshop-pos.sql` ditambah `customer_debts`.

## 14. Logistik Tahap 2 (owner "ok" 2026-11-05)

Usulan Tahap 2 disetujui owner 2026-11-05 ("ok" = semua sesuai saran). Tahap 2 dipecah tiga dan diuji berurutan:

| Bagian | Isi | Diuji oleh |
|---|---|---|
| **LT2a Barang kembali & tertunda** | Barang yang ikut pulang diterima di Gudang (lalu cabang pemilik), rincian barang retur, tab Tertunda | Kepala Gudang + driver |
| **LT2b Potong nota & koreksi uang** | Keputusan potong nota → daftar "Perlu dicatat di kasir", koreksi cara bayar salah tekan, janji bayar sisa | Finance + Kepala Gudang |
| **LT2c Nota berubah di kasir** | Pemeriksa berkala memberi tahu Kepala Gudang bila nota yang sudah di trip diubah/dibatalkan di kasir | Kepala Gudang |

Keputusan owner atas butir terbuka (2026-11-05):

- **B.** Harga beda tanpa barang yang diretur: dicatat di HRIS sebagai "potongan harga"; Finance mengoreksinya manual di kasir (LT2b).
- **C.** Nilai retur **tidak** diisi di HRIS; nilainya ikut Retur di Back Office (pengecualian atas LOG-60/124).
- **D.** Koreksi cara bayar (LOG-116) ditarik maju dari Tahap 4 ke LT2b.
- **E.** Lebih bayar / titipan toko (LOG-49/114) belum dibuat.
- **F.** Retur yang ditugaskan kantor lewat trip (LOG-58/126) belum dibuat; driver tetap membawa retur langsung saat kunjungan (§13.2).

### 14.1 LT2a Barang kembali, rincian retur, dan tertunda

| # | Aturan |
|---|---|
| 1 | **Barang Kembali** (`/logistik/barang-kembali`; LOG-115, 120): daftar dibaca dari trip **Selesai** sejak `logistics.returned_goods_from` (2026-11-05). Sumbernya (a) surat jalan di kunjungan **Kirim Besok / Gagal** yang barangnya memang dimuat (asal Gudang, atau Ambil barang di cabang asalnya Selesai) dan tidak dicoba lagi di trip yang sama; (b) laporan kunjungan **Retur (dibawa pulang)**. Semua turun di Gudang: pemegang hak baru `logistics.returned_goods.receive` (Kepala Gudang; Pemilik/GM lewat full_access) menekan **Terima** dengan foto kamera langsung, **Sesuai** atau **Tidak sesuai** (catatan wajib ≥ 5 huruf). Barang milik cabang selain Gudang lalu muncul di "Perlu diantar ke cabang pemilik" dan diterima lagi di cabang itu (hak yang sama; Kepala Toko diberi lewat Hak Akses Jabatan bila perlu). Tidak ada langkah turunkan barang terpisah untuk driver (§13.3 butir 3 tetap). Awak trip itu tidak boleh menerima barang yang ia bawa. Tidak sesuai memberi tahu pemegang `logistics.trip.manage` (Kepala Gudang, Pemilik, GM), kecuali penerimanya sendiri. Penerimaan tidak bisa diubah atau dihapus. Kartu Beranda "barang kembali belum diterima" |
| 2 | **Rincian retur** (LOG-59): Lapor masalah › Retur wajib 1–20 baris barang: nama (2–120 huruf), jumlah > 0 (boleh 2 angka di belakang koma), satuan (1–20 huruf). Pemilik barang = cabang asal surat jalan kunjungan itu; bila asalnya lebih dari satu cabang, driver memilih. Rincian tampil di Laporan Toko, rincian trip / Trip Saya, dan Barang Kembali |
| 3 | **Tertunda** (LOG-57, 119; halaman `/logistik/surat-jalan/tertunda`, tombol tab di Surat Jalan): surat jalan Menunggu / Dalam perjalanan yang kasirnya masih aktif dan, sejak tutup terakhir, punya Kirim Besok / trip ditutup dengan kunjungan sisa / Kirim ulang yang tidak dibatalkan Coba lagi. Paling lama di atas; **merah** bila lebih dari `logistics.pending_red_days` (3) hari sejak pertama tertunda. **Tutup** oleh pemegang `logistics.delivery_note.decide` (Kepala Gudang, Pemilik, GM), keterangan wajib; tercatat sebagai riwayat surat jalan `PENDING_CLOSED`, surat jalan tetap di antreannya, dan Kirim Besok berikutnya memunculkannya lagi. Perlu keputusan (Gagal) tidak masuk Tertunda; tempatnya tab Perlu keputusan. Kartu Beranda bila ada yang merah |

**Data.** Migrasi `logistics` 0008: tabel `goods_receipts` (sumber `NOTE` = `trip_visit_notes.id` / `RETURN` = `visit_reports.id`, langkah `WAREHOUSE`/`OWNER`, hasil `MATCH`/`MISMATCH` + catatan, foto, penerima; unik per sumber + langkah; tanpa hapus), `visit_report_items` (nama, jumlah numeric(12,2), satuan; tanpa hapus), kolom `visit_reports.owner_branch_id`, jenis riwayat surat jalan `PENDING_CLOSED`. Migrasi `hris` 0045: hak `logistics.returned_goods.receive` (Kepala Gudang), pengaturan `logistics.returned_goods_from` (2026-11-05) dan `logistics.pending_red_days` (3). Foto penerimaan dan foto retur dibuka lewat pintu foto trip (pemegang `logistics.trip.view` atau `logistics.returned_goods.receive`) dan tidak ikut dibuang mesin harian.

### 14.2 LT2b Potong nota, Perlu dicatat di kasir, koreksi cara bayar, janji bayar sisa (owner "ok" 2026-11-05)

| # | Aturan |
|---|---|
| 1 | **Keputusan potong nota** (LOG-51, 122; pengganti tombol Selesai §13.5 butir 5): pemegang hak baru `logistics.note_cut.decide` (Finance; Pemilik/GM lewat full_access), bukan pelapornya, memilih satu keputusan per laporan toko: **Potong nota** (nota kasir kunjungan itu + nominal rupiah bulat + alasan Barang salah / kurang / rusak / Harga beda / Ditolak toko / Lainnya; Lainnya wajib catatan), **Dicatat lewat Retur BO** (hanya laporan Retur; nilai tidak di HRIS, keputusan C), atau **Tidak dipotong** (catatan wajib). Potongan ≤ nominal nota dikurangi potongan lain yang berlaku di nota itu; nominal nota = `pos_truck_sales.payable_amount`, atau nominal saat masuk trip bila nota tidak lagi terbaca sebagai kiriman truk. Laporan ditutup dengan ringkasan keputusan. **Ubah keputusan**: alasan wajib, hanya selama belum Sudah dicatat; baris lama ditandai Diganti. Laporan yang sudah ditutup LT1b-3 tanpa keputusan tidak dibuka lagi |
| 2 | **Harga beda** (keputusan B): pilihan baru Lapor masalah driver, foto + catatan harga yang diminta toko wajib |
| 3 | **Perlu dicatat di kasir** (`/logistik/catat-kasir`, hak yang sama): keputusan Potong nota / Retur BO yang berlaku dan belum dicatat, paling lama di atas, merah bila > 3 hari sejak diputuskan; **Sudah dicatat** dengan nomor retur / keterangan (3–100 huruf), lalu terkunci. Kartu Beranda. 30 terakhir yang sudah dicatat |
| 4 | **Koreksi cara bayar** (LOG-116, keputusan D): awak selama trip Berjalan dan belum Menuju Garasi; sesudahnya hak baru `logistics.store_payment.correct` (Kepala Gudang; Pemilik/GM). Alasan wajib (≥ 5 huruf); tagihan tetap tagihan saat Terkirim; Lunas transfer wajib bukti (bukti lama dipakai lagi bila sebelumnya juga transfer; foto kamera atau galeri). Baris lama `replaced_at`, baris baru menyimpan `correction_of_id` + alasan; pemegang `logistics.store_payment.view` diberi tahu. Kunci "sudah diperiksa Finance" menyusul Tahap 4 |
| 5 | **Janji bayar sisa** (LOG-113): wajib untuk Bayar sebagian / Tempo, bawaan hari + 7, paling cepat besok, paling lama hari + 60. Tampil di Uang dari Toko (kolom Janji bayar) dan kartu kunjungan; **Lewat janji** bila tanggalnya lewat dan sisa piutang kasir nota kunjungan itu masih ada. Catatan cara bayar sebelum LT2b tanpa tanggal |

**Data.** Migrasi `logistics` 0009: tabel `report_decisions` (keputusan, nota, nominal, alasan, catatan, pemutus, alasan ubah, `replaced_at`, Sudah dicatat + nomor referensi; satu yang berlaku per laporan; tanpa hapus), kolom `visit_payments.promise_date`, `correction_of_id`, `correction_reason`, `recorded_by_account_id`, `replaced_at` (unik per kunjungan hanya untuk baris yang berlaku), jenis laporan `PRICE`. Migrasi `hris` 0046: hak `logistics.note_cut.decide` (Finance) dan `logistics.store_payment.correct` (Kepala Gudang).

### 14.3 LT2c Nota berubah di kasir (owner "ok" 2026-11-05)

| # | Keputusan |
|---|---|
| 1 | **Pemeriksa berkala** `logistics-kasir-check` tiap 10 menit, sepanjang hari: surat jalan aktif di kunjungan terbuka pada trip Draft/Berjalan dibandingkan dengan `amount_at_trip`/`revision_at_trip` memakai aturan `kasirChange` yang sudah ada (§3.3). |
| 2 | **Yang diberi tahu**: Kepala Gudang + Pemilik/GM (`logistics.trip.manage`, tautan rincian trip) dan driver/kenek trip itu (tautan Trip Saya). |
| 3 | **Sekali per keadaan**: penanda = jenis + nominal + revisi kasir (`CHANGED:<nominal>:<revisi>`, `PENDING_CANCEL`, `CANCELLED`). Diubah lagi = keadaan baru, diberi tahu lagi. Tiap keadaan baru dicatat di riwayat surat jalan (`KASIR_CHANGED`). Kasir kembali seperti semula / surat jalan lepas dari trip = keadaan ditutup (`cleared_at`). |
| 4 | **Keputusan Kepala Gudang** di rincian trip: **Lepas** (sudah ada) atau **Tetap antar** (baru, riwayat `KASIR_KEPT`): tanda abu-abu, keluar dari kartu Beranda. Nota batal final tidak bisa Tetap antar. |
| 5 | **Kartu Beranda** "Nota berubah di kasir" (pemegang `logistics.trip.manage`): jumlah nota yang belum diputuskan; satu trip → rincian trip, lebih → Surat Jalan tab Dalam perjalanan. |
| 6 | **Terkirim**: tetap ditolak bila ada nota kunjungan yang **batal final** di kasir (aturan LT1b-2a yang lebih ketat dari usulan "semua nota batal" dipertahankan). **Menunggu batal** = peringatan saja, tidak menolak. |
| 7 | **Di luar**: perubahan nota sesudah Terkirim (lewat potong nota / Retur BO, §14.2), cara bayar, upah. |

**Data.** Migrasi `logistics` 0010: tabel `kasir_changes` (surat jalan, trip, jenis, penanda unik per surat jalan+trip, nominal saat trip → kasir, revisi, ditemukan, Tetap antar oleh/kapan, ditutup; tanpa hapus) + jenis riwayat `KASIR_CHANGED`, `KASIR_KEPT`. Tanpa migrasi hris (hak memakai `logistics.trip.manage`). Jadwal di `infra/apps/cron/crontab` (`*/10`).

## 15. Logistik Tahap 3 (owner 2026-11-05)

Tahap 3 = laporan muat cabang + antar sendiri. Dipecah tiga, diuji berurutan:

| Bagian | Isi | Status |
|---|---|---|
| **LT3a Laporan Muat** | Bukti foto barang yang dimuat di Toko Pusat untuk menjawab komplain | Disetujui owner 2026-11-05 (§15.1) |
| **LT3b Antar sendiri (HP pengantar)** | Nota Kurir cabang: Foto 1 ambil barang, Foto 2 + Terkirim / Kirim Besok / Gagal + cara bayar di tujuan, Foto 3 kembali | Disetujui owner 2026-11-05 (§15.2) |
| **LT3c Antar sendiri (kantor)** | Daftar per cabang, tutup perjalanan dengan alasan, alihkan PJ, keputusan Gagal, tanda 23.59, pengantar kasir belum dipasangkan | Disetujui owner 2026-11-05 (§15.3) |
| **LT3d Uang & laporan antar sendiri** | Uang antar sendiri di Uang dari Toko, koreksi cara bayar, Lapor masalah / retur dari tujuan antar sendiri | Disetujui owner 2026-11-05, menyusul LT3c |

### 15.1 LT3a Laporan Muat (owner 2026-11-05)

**Keputusan owner.** Laporan muat **tetap ada**, tetapi **hanya sebagai bukti** (pelaporan) agar bila konsumen komplain ada foto muatnya. Kebiasaan sekarang: orang yang menyiapkan barang memilih toko, memotret nota, memotret barang, lalu klik Selesai. Yang memakai hanya **Toko Pusat**; nama toko harus **sinkron dengan nota kasir Toko Pusat**, jadi **nota kasir wajib dipilih**. Foto **dari kamera langsung**. Yang melihat: Pemilik, GM, Kepala Gudang, Kepala Toko cabang itu, Marketing, dan staf cabang untuk laporannya sendiri ("ok" atas saran).

Ini mengganti bacaan LOG-37 s.d. 41 dan 105 s.d. 111 (laporan muat sebagai jalur kirim + paket): jalur kirim tetap lewat cara kirim kasir dan surat jalan (§11). Laporan muat **tidak menahan** apa pun (trip, antar, kasir) dan tidak mengubah data kasir.

| # | Aturan |
|---|---|
| 1 | **Saklar per cabang** `logistics.load_report_on` (Ya/Tidak, sasaran Semua atau Cabang). Isi awal: Semua = Tidak, **Toko Pusat = Ya**. Cabang lain tinggal dinyalakan di Pengaturan |
| 2 | **Buat laporan** (hak baru `logistics.load_report.create`, lingkup cabang: Kepala Toko, Kasir, Pramuniaga; Pemilik/GM lewat full_access memilih cabang): pilih **nota kasir** cabang itu yang berpelanggan, tidak batal, tanggal nota 7 hari terakhir, dan belum dipakai laporan muat lain yang tidak batal. Toko = pelanggan nota itu (tidak diketik). Boleh menambah nota lain **dari pelanggan yang sama** dalam satu laporan (1–10 nota). Satu nota hanya di satu laporan yang berlaku |
| 3 | **Foto nota lalu foto barang**, kamera langsung (bukan galeri), jam server. Foto nota 1–5; foto barang baru bisa diambil sesudah ada foto nota, 1–20. Tiap foto langsung tersimpan, jadi laporan boleh ditinggal dan dilanjutkan (status **Proses**). Selama Proses foto boleh dibuang (tercatat, tidak dihapus) dan nota boleh ditambah / dilepas |
| 4 | **Selesai** (wajib ≥ 1 foto nota dan ≥ 1 foto barang): laporan terkunci; nota dan foto tidak bisa dibuang atau diubah. Masih bisa **Tambah foto susulan** (nota / barang, kamera langsung, dalam batas jumlah), bertanda "susulan" + siapa + jam |
| 5 | **Batal** hanya selama Proses, alasan wajib (≥ 5 huruf); nota dilepas dan bisa dipakai laporan lain. Riwayat dan fotonya tetap |
| 6 | **Siapa yang mengerjakan laporan Proses / susulan**: pemegang hak buat di cabang laporan itu (rekan satu cabang boleh melanjutkan) |
| 7 | **Melihat** (hak baru `logistics.load_report.view`): Kepala Gudang dan Marketing semua cabang, Kepala Toko cabangnya; Pemilik/GM semua. Pemegang hak buat melihat laporan Proses cabangnya dan laporan yang ia buat sendiri |
| 8 | **Halaman Laporan Muat** (`/logistik/laporan-muat`): tab Proses dan Selesai (+ Batal), saring tanggal (bawaan 7 hari), cari nomor nota / nama toko / pembuat. Rincian (`/logistik/laporan-muat/[id]`): toko, nota (nomor, nominal kasir), foto nota, foto barang, pembuat, jam Selesai, foto susulan, alasan batal |
| 9 | **Di luar LT3a**: menautkan laporan muat ke surat jalan / kunjungan (foto muat tampil di rincian surat jalan), tanda "belum ada foto muat", pemberitahuan |

**Data.** Migrasi `logistics` 0011: view `pos_branch_sales` (nota kasir berpelanggan: id, nomor, cabang kasir, pelanggan, nominal, status, cara kirim, jam; baca saja), tabel `load_reports` (cabang HRIS + cabang kasir, pelanggan, status `DRAFT`/`DONE`/`CANCELLED`, pembuat, Selesai oleh/jam, Batal oleh/jam/alasan), `load_report_notes` (laporan, `transaction_id`, nomor + nominal saat dipilih, `released_at`; unik per nota selama belum dilepas), `load_report_photos` (laporan, jenis `NOTE`/`GOODS`, berkas, susulan, pemotret, jam, `removed_at` hanya selama Proses). Tanpa hapus. Migrasi `hris` 0047: pengaturan `logistics.load_report_on`, hak `logistics.load_report.create` (Kepala Toko, Kasir, Pramuniaga: cabang) dan `logistics.load_report.view` (Kepala Gudang, Marketing: semua; Kepala Toko: cabang). Foto dibuka lewat `/api/logistics/load-photo` dengan hak lihat laporannya; tidak ikut dibuang mesin harian.

### 15.2 LT3b Antar sendiri di HP pengantar (owner 2026-11-05)

**Keputusan owner.** "ok" atas 7 butir usulan (2026-11-05). Pertanyaan "nota kurir bayar di tempat: kasir mencatat lunas atau piutang?" belum dijawab; rancangan aman untuk keduanya: tagihan = sisa piutang kasir, nota lunas / Umum = tanpa tagihan.

| # | Aturan |
|---|---|
| 1 | **Tugas antar** = nota kasir `delivery_method = BRANCH_COURIER` cabang kasir pengantar, sejak `logistics.self_delivery_from` (isi awal 2026-11-05), tidak batal / menunggu batal, belum punya tujuan yang berlaku (Belum / Terkirim / Gagal). Kirim Besok mengembalikan nota ke daftar. Pengantar kasir (`service_deliveries.courier_id`) dipasangkan ke karyawan lewat `hris.pos_groomer_links` (L4d-1). Nota pengantar sendiri = "Untuk Anda"; nota lain di cabang boleh dibawa siapa pun yang berhak, bertanda **pengantar beda dengan kasir** (LOG-108). Bonus ongkir tetap dari kasir |
| 2 | **Mulai antar** (hak `logistics.self_delivery.run`, BRANCH: Kepala Toko, Kasir, Pramuniaga): 1–10 nota, **Foto 1** kamera langsung, PJ = pemotret. Hanya sudah absen masuk dan belum pulang (hari kemarin berlaku sampai `attendance.out_cutoff_hour`). Satu orang satu perjalanan berjalan (indeks unik). Nomor AS-YYMMDD-n |
| 3 | **Foto 2 per tujuan**: Terkirim (ditolak bila nota batal di kasir) / Kirim Besok / Gagal dengan alasan baku yang sama dengan truk. Gagal memberi tahu pemegang `logistics.self_delivery.view` cabang itu; keputusan kirim ulang / batal = LT3c |
| 4 | **Cara bayar** saat Terkirim = aturan LT1b-3/LT2b (`cleanPayment`, bukti transfer, janji bayar sisa), tagihan = sisa piutang kasir nota itu (`pos_customer_debts` belum PAID). Tabel `self_trip_payments` (tanpa koreksi salah tekan di LT3b) |
| 5 | **Tahap & selisih** (LOG-43): Foto 2 / Foto 3 ditolak sebelum `logistics.self_stage_min_minutes` (2) menit sejak foto sebelumnya. Selisih |lama berangkat (Foto 1 → tujuan pertama) − lama kembali (tujuan terakhir → Foto 3)| ≥ `logistics.self_gap_minutes` (20) wajib alasan baku (macet, isi bensin, istirahat, menunggu di toko, tugas lain, lainnya + keterangan) |
| 6 | **Foto 3** hanya bila semua tujuan diproses. Tunai (Lunas cash + Bayar sebagian) dijumlah ke `cash_amount`; pemegang `logistics.self_delivery.cash_receive` cabang itu (Kepala Toko, Kasir; bukan PJ) diberi tahu dan menekan **Sudah diterima** (LOG-128). Belum diterima sesudah hari kembali = tanda merah |
| 7 | **Absen Pulang ditolak** selama perjalanan antar orang itu masih berjalan (LOG-110) |
| 8 | **Bonus ongkir ⚠** (LOG-109): di Persetujuan Bonus › Ongkir, baris ongkir nota kurir sejak tanggal mulai yang belum punya tujuan Terkirim/Gagal di perjalanan yang sudah Foto 3 sesudah 23.59 hari berikutnya diberi tanda `SELF_PHOTO` — hanya tampilan, `bonus_entries` tidak ditulis |
| 9 | **Titik toko** dari tujuan berpelanggan: aturan LT1b-2b; `store_points.self_stop_id` baru, check sumber VISIT = foto + (trip atau tujuan antar sendiri). Jarak Terkirim dicatat `self_trip_stops.distance_m` |
| 10 | **Melihat**: PJ (perjalanannya), Kepala Toko (cabang, 7 hari), Kepala Gudang / Marketing / Finance (semua) lewat `logistics.self_delivery.view`; penerima tunai melihat perjalanan yang menunggu diterima. Foto lewat `/api/logistics/self-photo` |
| 11 | **Di luar LT3b** (LT3c / berikutnya): tutup perjalanan oleh kantor dengan alasan, alihkan PJ, keputusan Gagal, tanda belum kembali 23.59, pilih pengantar kantor, Lapor masalah / retur dari tujuan antar sendiri, koreksi cara bayar, masuknya uang antar sendiri ke Uang dari Toko, kartu Beranda tunai menunggu |

**Data.** Migrasi `logistics` 0012: `self_trips`, `self_trip_stops` (unik per nota selama Belum/Terkirim/Gagal), `self_trip_payments`, kolom `store_points.self_stop_id`, view `pos_courier_sales` (nota kurir + pelanggan + alamat + pengantar kasir; baca saja), tanpa hapus. Migrasi `hris` 0048: pengaturan `logistics.self_delivery_from`, `logistics.self_stage_min_minutes`, `logistics.self_gap_minutes`; hak `logistics.self_delivery.run` / `.cash_receive` / `.view`. Halaman `/logistik/antar-sendiri`, API `/api/logistics/self-delivery` (POST aksi berfoto).

### 15.3 LT3c Antar sendiri sisi kantor (owner "ok lanjutkan" 2026-11-05)

**Keputusan owner.** "ok lanjutkan" atas usulan 9 butir, dipecah LT3c (butir 1–6, kantor) + LT3d (butir 7–9: uang antar sendiri di Uang dari Toko, koreksi cara bayar oleh Kepala Toko / Kepala Gudang, Lapor masalah / retur dari tujuan antar sendiri ke Laporan Toko). Di luar keduanya: pengantar dipilih kantor (PJ tetap pemotret Foto 1).

| # | Aturan |
|---|---|
| 1 | **Layar kantor** `/logistik/antar-sendiri/kantor` (hak `logistics.self_delivery.view` atau `.manage`): tab Berjalan (hari ini), Belum kembali (RUNNING yang mulai sebelum hari ini), Gagal perlu keputusan, Tunai belum diterima (DONE/CLOSED, tunai > 0, belum diterima), Selesai (7 hari). Lingkup ALL (Kepala Gudang, Marketing, Finance, Pemilik/GM) bisa saring per cabang; BRANCH = cabang penempatan. Halaman pengantar tidak lagi memuat daftar cabang, gantinya tombol ke layar kantor |
| 2 | **Tutup perjalanan** (LOG-110): hak baru `logistics.self_delivery.manage` (Kepala Toko BRANCH, Kepala Gudang ALL; Pemilik/GM lewat full_access), bukan PJ perjalanan itu, alasan 5–300 huruf. Status `CLOSED` (+ closed_at/by/reason). Tujuan OPEN → TOMORROW tanpa Foto 2 (`office_closed`, alasan "Ditutup kantor: …"), nota kembali ke daftar tugas. Tunai yang sudah dicatat = `cash_amount` dan tetap diterima laci (penerima diberi tahu). Absen Pulang PJ terbuka. Tanda ⚠ bonus tetap (LOG-109: ditutup kantor = foto tidak lengkap) |
| 3 | **Alihkan PJ** (LOG-43, 108): aturan pelaku sama dengan butir 2, alasan wajib. PJ baru = karyawan aktif cabang itu yang jabatannya memegang `.run`, sudah absen masuk dan belum pulang, punya akun HRIS, tanpa perjalanan berjalan (indeks unik). Tujuan OPEN yang pengantar kasirnya bukan PJ baru → `courier_mismatch`. PJ lama dan baru diberi tahu |
| 4 | **Keputusan Gagal**: pemegang `.manage` cabang itu (PJ sendiri boleh). Kirim ulang = `decision RESEND` (catatan boleh kosong), nota lepas dari indeks unik dan kembali ke daftar tugas (dihitung "pernah Kirim Besok"). Batal kirim = `DROP` alasan wajib, nota tidak diantar lagi; tautan "Buka nota di BO" untuk ubah cara kirim / batal di kasir. Pemberitahuan Gagal kini membuka tab Gagal perlu keputusan |
| 5 | **Tanda 23.59 + Beranda**: kartu untuk pemegang `.view`/`.manage` sesuai lingkup — belum kembali, Gagal belum diputuskan, tunai belum diterima lewat hari (kembali/ditutup sebelum hari ini); kartu tunai menunggu diterima untuk pemegang `.cash_receive` cabang (bukan uangnya sendiri). Dihitung saat dibuka, tanpa job baru |
| 6 | **Pengantar kasir belum dipasangkan** (LOG-108): nama pengantar kasir pada nota kurir yang menunggu diantar tanpa pasangan karyawan, per cabang, dengan tautan ke Pasangkan Groomer & Pengantar (pemegang `pos_groomer_link.manage` / `bonus.view`) |
| 7 | **Riwayat**: tabel `self_trip_events` (CLOSED, HANDOVER, RESENT, DROPPED; tanpa hapus) tampil di rincian perjalanan |

**Data.** Migrasi `logistics` 0013: `self_trips` status + `CLOSED` dan kolom closed_*; `self_trip_stops.office_closed`, `decision`, `decision_reason`, `decided_at`, `decided_by_account_id`; indeks `self_trip_stops_live` kini `OPEN/DELIVERED` atau `FAILED` yang bukan RESEND; tabel `self_trip_events`. Migrasi `hris` 0049: hak `logistics.self_delivery.manage`. Layanan `server/self-delivery-office.ts`, UI `ui/self-delivery-office-screen.tsx`, API tetap `/api/logistics/self-delivery` (aksi close/handover/decide).

### 15.4 LT3d Uang & laporan antar sendiri (owner "ok" 2026-11-05)

**Keputusan owner.** "ok" atas usulan 3 butir (butir 7–9 usulan LT3c), termasuk dua saran: koreksi yang mengubah tunai sesudah diterima laci membuka lagi penerimaannya, dan retur antar sendiri tanpa langkah Barang kembali.

| # | Aturan |
|---|---|
| 1 | **Uang dari Toko** (`/logistik/uang-toko`, hak tetap `logistics.store_payment.view`) memuat cara bayar antar sendiri (`self_trip_payments` yang berlaku) menurut tanggal mulai perjalanan (WIB). Saringan sumber Semua / Truk / Antar sendiri (`?sumber=`) dan cabang (`?cabang=`, hanya antar sendiri; trip truk disembunyikan). Kolom sama dengan truk (tujuan, nota kasir, tagihan, cara bayar, diterima, sisa, janji bayar + Lewat janji, bukti) + PJ dan cabang. Kartu: cash dibawa driver truk, tunai antar sendiri ke laci cabang, transfer, sisa ditagih kantor. Per perjalanan: tanda belum kembali / tunai sudah atau belum diterima laci |
| 2 | **Koreksi cara bayar antar sendiri** (LOG-116): aturan isi = §14.2 butir 4 (alasan ≥ 5 huruf, tagihan tetap, Lunas transfer wajib bukti — bukti lama dipakai lagi bila sebelumnya juga transfer, janji bayar, tidak ada yang berubah ditolak). Pelaku: PJ selama perjalanan RUNNING; sesudah Foto 3 / ditutup kantor pemegang `logistics.self_delivery.manage` cabang itu (Kepala Toko, Kepala Gudang; Pemilik/GM), bukan PJ-nya. Tanpa hak baru. Baris lama `replaced_at`, baris baru `correction_of_id` + alasan. Finance (`store_payment.view`) diberi tahu. Sesudah Foto 3 `self_trips.cash_amount` dihitung ulang dari cara bayar yang berlaku; bila tunai sudah diterima laci dan jumlahnya berubah, `cash_received_*` dikosongkan sehingga perjalanan kembali ke tab Tunai belum diterima dan penerima cabang diberi tahu (jumlah lama → baru). Setiap koreksi = event `PAYMENT_CORRECTED` (cash_before, cash_after, cash_received_before). Tombol: kartu tujuan Antar Sendiri (PJ), Antar Sendiri · Kantor, Uang dari Toko |
| 3 | **Lapor masalah / retur dari tujuan antar sendiri** (LOG-44..49): PJ, tujuan Terkirim, perjalanan masih RUNNING (sebelum Foto 3). Pilihan + foto + catatan + rincian retur sama dengan truk (§13.5 butir 4, §14.1 butir 2, §14.2 butir 2). Disimpan di `visit_reports` dengan `self_stop_id` + `self_trip_id` (tanpa `visit_id`/`trip_id`); pemilik barang retur = cabang kasir perjalanan. Diberi tahu: pemegang `delivery_note.decide` / `note_cut.decide` + `.manage` cabang itu. Tampil di Laporan Toko dan Perlu dicatat di kasir bertanda "Antar sendiri · cabang", tautan ke layar kantor. Keputusan potong nota (§14.2 butir 1) memakai nota kasir tujuan itu (`report_decisions.transaction_id`; nominal = nota kasir sekarang atau saat dibawa, dikurangi potongan lain di nota itu). Retur antar sendiri **tidak** masuk Barang Kembali (dibawa PJ langsung ke tokonya) |
| 4 | Foto laporan dan bukti transfer antar sendiri lewat `/api/logistics/self-photo` (`kind=report&report=`, `kind=proof` = bukti yang berlaku); selain pelihat perjalanan, juga pemegang Laporan Toko / potong nota (foto laporan) dan Uang dari Toko (bukti) |

**Data.** Migrasi `logistics` 0014: `self_trip_payments` + `correction_of_id`, `correction_reason`, `replaced_at` (unik per tujuan hanya baris berlaku); `self_trip_events` jenis `PAYMENT_CORRECTED` + `cash_before`/`cash_after`/`cash_received_before`; `visit_reports.visit_id`/`trip_id`/`customer_id` boleh kosong + `self_stop_id`/`self_trip_id` (cek satu sumber); `report_decisions.transaction_id` (cek: `note_id` atau `transaction_id`, tidak keduanya). Tanpa migrasi hris. Layanan `server/self-delivery-money.ts`, form bersama `ui/report-form.tsx`, aksi `correct_payment` / `self_report` di `/api/logistics/self-delivery`.

## 16. Logistik Tahap 4 (owner 2026-11-05)

Tahap 4 disederhanakan owner (2026-11-05): **tanpa** Catat di Kasir (LOG-133..137), Daftar Tagih dan catatan tagih (LOG-138, 139), Kas Masuk / Brankas (LOG-64, 131) — piutang tetap milik kasir dan HRIS tidak menggandakan data POS (aturan AGENTS "tanpa data ganda", PR #76). Janji bayar LT2b dibiarkan seperti sekarang. Yang tersisa: pemeriksaan uang (LOG-62, 63, 127, 129, 132 versi sederhana) = **LT4a Terima Uang**.

### 16.1 LT4a Terima Uang (owner 2026-11-05: butir A–D "ok", butir 1 dipertegas)

Temuan sebelum rancangan: (1) POS mencatat pelunasan per piutang, piutang per nota (`debt_payments.debt_id` → `customer_debts.transaction_id`), tetapi BO juga punya **bayar gabungan** (`pay-bulk`, dibagi ke nota tertua dulu); (2) cara bayar truk di HRIS dicatat **per kunjungan** (`visit_payments`), antar sendiri per nota (`self_trip_payments`).

| No | Keputusan |
|---|---|
| 1 | Layar **Logistik › Terima Uang** (`/logistik/terima-uang`): uang trip truk dan antar sendiri yang ada uangnya (Lunas cash, Lunas transfer, Bayar sebagian), per trip, lalu per toko, lalu **per nota**. Tab: Belum diperiksa (paling lama di atas), Sudah diperiksa (30 hari), Selisih. Masuk daftar sejak `logistics.money_check_from` (isi awal 2026-11-05). Truk siap diperiksa sesudah Menuju Garasi / trip selesai; antar sendiri sesudah Foto 3 / ditutup kantor. Tempo tidak diperiksa. |
| 2 | **Pembagian per nota.** Mulai LT4a, saat Terkirim truk tagihan per nota disimpan (`visit_note_bills`, sisa piutang kasir tiap nota saat itu). Lunas cash / transfer → tiap nota = tagihannya. Bayar sebagian dengan satu nota → nota itu. Bayar sebagian dengan beberapa nota → Finance mengetik pembagian mengikuti ikatan uang driver (saran awal: nota paling lama dulu, sama dengan bayar gabungan BO); tiap nota 0..tagihannya, jumlahnya = uang yang dilaporkan. Langkah driver di HP tidak berubah. Kunjungan sebelum LT4a (tanpa tagihan per nota): satu nota otomatis, beberapa nota diketik Finance. |
| 3 | **Cocok / Tidak cocok per nota.** Tidak cocok: ketik jumlah sebenarnya + catatan (≥ 5 huruf). Disimpan sekaligus per toko (semua nota toko itu). Pemeriksa = pemegang `logistics.money_check.do` (Finance; Pemilik/GM lewat full_access); bukan yang mencatat cara bayar itu. Kepala Gudang hanya melihat (Uang dari Toko). |
| 4 | **Selisih tunai = tanggung jawab pembawa uang** (owner: driver hanya tanggung jawab uang cash): kurang → **kurang serah** atas nama driver trip (kenek tidak) atau PJ antar sendiri; diberi tahu lewat Pemberitahuan; tampil di tab Selisih sebagai bahan Potongan Lain HR (tidak memotong gaji otomatis). Piutang toko di POS tetap dilunasi sesuai laporan driver (toko tidak ditagih lagi). |
| 5 | **Transfer tidak masuk / kurang = bukan tanggung jawab driver**: sisanya tetap piutang toko di POS (yang dilunasi di POS = jumlah sebenarnya). |
| 6 | **Lebih serah** (uang lebih dari laporan): hanya dicatat dan tampil di tab Selisih; Finance memutuskan sendiri (dikembalikan / dititipkan). |
| 7 | **Tanda pelunasan POS (pengingat)** per nota yang sudah diperiksa, dibaca dari `logistics.pos_customer_debts` tanpa data ganda: masuk POS sejak Terkirim = tagihan nota saat Terkirim − sisa piutang sekarang − potong nota HRIS yang sudah dicatat. ✅ sudah ≥ yang harus dilunasi; ⚠️ baru sebagian; ⏳ belum (merah > 3 hari sejak diperiksa); "Piutang tidak ada di kasir" bila piutang dibatalkan/hilang; "—" bila tagihan per nota tidak diketahui (kunjungan sebelum LT4a). Tautan ke halaman pelanggan BO. **Aturan kerja Finance: pelunasan uang trip memakai Bayar per nota di BO** (bukan bayar gabungan), supaya cocok per nota. |
| 8 | Belum diperiksa > 3 hari = merah; kartu Beranda pemeriksa: jumlah toko belum diperiksa (merah) dan nota ⏳ merah. |
| 9 | **Kunci & batal.** Cara bayar yang sudah diperiksa tidak bisa dikoreksi (truk dan antar sendiri) — batalkan pemeriksaan dulu. Batal pemeriksaan: alasan wajib; pemeriksa sendiri dalam 7 hari, Pemilik/GM kapan saja; baris lama ditandai Dibatalkan (tidak dihapus), riwayat tersimpan. |

**Data.** Migrasi `logistics` 0015: `visit_note_bills` (kunjungan × nota, tagihan saat Terkirim, ditulis bersama cara bayar), `money_checks` (satu baris per nota per cara bayar: sumber, kind CASH/TRANSFER, dilaporkan, sebenarnya, yang harus dilunasi di POS, penanggung kurang serah, catatan, pemeriksa, batal + alasan; unik per baris berlaku; tidak dihapus). Migrasi `hris` 0050: hak `logistics.money_check.do` (Finance ALL), setting `logistics.money_check_from`.

**Di luar LT4a:** penyerahan tunai per trip sebagai langkah terpisah (pemeriksaan per nota sudah mencakupnya), Potongan Lain otomatis, rekening/Kas Masuk, Tahap 5 (dashboard, laporan, bensin).
