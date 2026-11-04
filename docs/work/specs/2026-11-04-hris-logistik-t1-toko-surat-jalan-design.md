# Spec HRIS Logistik Tahap 1 (LT1) — Toko, Surat Jalan, dan Kunjungan Toko di Trip

Tanggal: 2026-11-04 · Status: **DRAF — menunggu keputusan owner §9**
Cakupan: tahap pertama **Logistik penuh**, di atas L6 Logistik Minimal ([spec L6](2026-11-03-hris-l6-logistik-design.md)).
Keputusan owner 2026-11-04: urutan 5 tahap (1 toko + surat jalan + kunjungan; 2 uang, tertunda, retur, potong nota; 3 laporan muat cabang + antar sendiri; 4 pemeriksaan uang + Catat di Kasir + tagih; 5 dashboard, laporan, bensin); **toko dan surat jalan dibaca langsung dari kasir** (satu proyek), bukan diketik ulang; dikerjakan bersamaan dengan L9.
Sumber v3: `04-logistik` LOG-01, 03 s.d. 10, 12, 13, 16, 19, 20, 22 s.d. 27, 55, 56, 90, 93, 95 s.d. 97, 99, 103; spec v3 `2026-10-13-logistik-spec.md` §3.1 (4F-1) dan §3.2 (4F-2, bagian kunjungan). Yang tidak disebut di sini tidak dibawa.
Dasar kode: L6 (`packages/logistics` migrasi 0001, modul `apps/hris/modules/logistics`), L7a (tarif, migrasi logistics 0002), pola view baca kasir di schema HRIS (`hris.pos_deliveries`, `hris.pos_suppliers`, L4d/L8).
Aliran migrasi: **`logistics` 0003** (tabel, view baca kasir) dan **`hris` berikutnya** (hak, pengaturan, jenis pemberitahuan).

## 1. Batas

**Pokoknya:** setiap penjualan **grosir (Bulk Sale) di kasir cabang pengirim** (bawaan: **Gudang dan Toko Pusat**, catatan owner 2026-11-04) ke pelanggan toko otomatis muncul di HRIS sebagai **surat jalan** yang menunggu dikirim. Kepala Gudang memasukkan surat jalan ke **trip**; beberapa surat jalan satu toko menjadi **satu kunjungan**. Dari HP, driver/kenek menyelesaikan tiap kunjungan dengan **Terkirim**, **Kirim Besok**, atau **Gagal**. Toko = pelanggan kasir; HRIS hanya menambah **rute bawaan, catatan pengiriman, dan titik lokasi**.

**Upah driver tidak berubah:** ritase dan belanja tetap lahir seperti L6/L7 (1 ritase per awak per trip berute kirim, LOG-33). Uji Banding gaji driver tidak terpengaruh.

**Dikerjakan:**

| Bagian | Isi |
|---|---|
| Data Toko | Daftar pelanggan kasir yang menjadi toko kiriman; tambahan HRIS: rute bawaan, catatan pengiriman, titik |
| Titik toko | Dipasang driver/kenek saat kunjungan (foto depan toko + GPS), disetujui Kepala Gudang; Kepala Gudang/Pemilik boleh pasang langsung |
| Surat Jalan | Lahir dari penjualan grosir Gudang; status Menunggu dikirim / Dalam perjalanan / Terkirim / Perlu keputusan / Diambil toko / Batal |
| Trip + kunjungan | Pilih surat jalan saat buat/ubah trip Draft; lepas kunjungan yang belum diproses sesudah berangkat |
| Trip Saya (HP) | Daftar kunjungan: alamat, telepon, buka peta, Terkirim / Kirim Besok / Gagal, pasang titik |
| Selesai lebih awal | Sisa kunjungan menjadi Kirim Besok, alasan + foto |
| Perlu keputusan | Surat jalan Gagal diputuskan Kepala Gudang/Pemilik: Kirim ulang atau Batal |

**Tidak dikerjakan di LT1:**

| Hal | Tahap | Akibat sementara |
|---|---|---|
| Uang di toko (cash/transfer/deposit/tempo), potong nota, barang kejadian | 2 | Terkirim tanpa angka uang; penagihan tetap seperti sekarang di kasir |
| Catatan tertunda terpisah, warna merah > 3 hari, retur | 2 | Surat jalan yang pernah Kirim Besok cukup bertanda "pernah tertunda" + hitungannya, tampil paling atas |
| Laporan muat cabang, paket, antar sendiri, nota cabang | 3 | Hanya grosir Gudang + Toko Pusat |
| Pemeriksaan uang, Catat di Kasir, daftar tagih | 4 | Batal di HRIS hanya mengingatkan "batalkan juga di kasir" |
| Dashboard, laporan, bensin, kirim di luar titik ditinjau | 5 | Jarak dari titik toko **dicatat** saat Terkirim, belum ada layar tinjau |
| Status Siap Kirim dan Menuju Garasi, foto bak kosong, Laporan Pulang | — (§9 butir 8) | Trip tetap Draft → Berjalan → Selesai seperti L6 |
| Gabung toko dobel | — (§9 butir 4) | Pelanggan dobel digabung/dinonaktifkan di kasir |

Tiap branch membawa fragment `apps/hris/changelog.d` dan tanda Baru di `lib/new-features.ts`.

## 2. Data

### 2.1 Dibaca dari kasir (view, tanpa salin)

Schema `logistics` mendapat view baca atas `petshop` (pola `hris.pos_*`; peran app tidak membaca `petshop` langsung). Kolomnya kontrak, dengan stub tes.

| View | Isi |
|---|---|
| `logistics.pos_customers` | id pelanggan, kode, nama, HP, alamat, aktif, `is_internal_branch` |
| `logistics.pos_wholesale_sales` | penjualan **BULK** di **cabang kasir pengirim**: id transaksi, cabang kasir, nomor struk, tanggal (WIB), pelanggan, nominal (`payable_amount`), status (`COMPLETED`/`VOIDED`/`PENDING_VOID`), revisi, jam ubah terakhir |

**Penjualan yang menjadi surat jalan** (LOG-08, 95): `sale_type = 'BULK'`, cabang kasir termasuk daftar **cabang pengirim** (pengaturan `logistics.delivery_branches`, bawaan Gudang + Toko Pusat; dikenali dari pengaturan, bukan nama, LOG-13), ada pelanggan, pelanggan **bukan** cabang internal (penjualan ke cabang sendiri = PO Internal, bukan kiriman), dan tanggal ≥ pengaturan `logistics.delivery_from` (§9 butir 2).

**Nomor surat jalan = nomor struk kasir** (sudah unik di kasir, PRI-41 butir 3). Nominal, toko, dan status batal **selalu dibaca hidup dari kasir**: koreksi nota di kasir otomatis terlihat (F5).

### 2.2 Milik Logistik (tabel baru, migrasi logistics 0003)

Tanpa foreign key ke `petshop`/`hris` (angka biasa, dijaga pintu server + tes). Tanpa hapus (PRI-02), jejak oleh + kapan.

| Tabel | Isi |
|---|---|
| `stores` (data pengiriman toko) | id pelanggan kasir (**unik**), rute bawaan (rute kirim, boleh kosong), catatan pengiriman, "bukan toko kiriman" (sembunyikan dari daftar), diubah oleh/kapan. Baris dibuat saat pertama diisi |
| `store_points` (titik toko) | pelanggan, lintang/bujur, akurasi, foto depan toko (`files`), dipasang oleh (karyawan/akun), sumber (kunjungan/kantor), status `PENDING` / `APPROVED` / `REJECTED` / `REPLACED`, diputuskan oleh + alasan tolak, "laporan titik salah" + alasan. Satu `APPROVED` per toko (indeks unik sebagian) |
| `delivery_notes` (surat jalan) | id transaksi kasir (**unik**), nomor struk, pelanggan, status `WAITING` / `ON_TRIP` / `DELIVERED` / `NEEDS_DECISION` / `PICKED_UP` / `CANCELLED`, hitungan Kirim Besok, Diambil toko oleh/kapan/alasan, Batal oleh/kapan/alasan, nominal saat berangkat (pembanding perubahan kasir). **Baris dibuat saat surat jalan pertama kali disentuh** (masuk trip, Diambil toko); sebelum itu ia "Menunggu" langsung dari view |
| `trip_visits` (kunjungan) | trip, pelanggan, urutan tampil, status `OPEN` / `DELIVERED` / `TOMORROW` / `FAILED` / `RELEASED`, diproses oleh + kapan, alasan, foto (`files`: terima barang / alasan), lokasi + akurasi + **jarak dari titik toko** (bila ada titik disetujui), dilepas oleh + alasan |
| `trip_visit_notes` | kunjungan ↔ surat jalan (satu surat jalan hanya di satu kunjungan terbuka) |
| `delivery_note_events` | riwayat surat jalan: masuk trip, dilepas, terkirim, Kirim Besok, Gagal, keputusan, diambil toko, dibuka lagi, batal, "berubah di kasir sesudah berangkat" |

## 3. Aturan

### 3.1 Toko (LOG-01, 06, 07, 90)

- **Toko = pelanggan kasir.** Toko baru dibuat di kasir (Master Pelanggan); muncul di HRIS seketika. Nama, HP, dan alamat **diubah di kasir** (satu sumber, §9 butir 3).
- Data Toko menampilkan pelanggan **non-internal** yang pernah punya penjualan grosir dari cabang pengirim, ditambah yang sudah diberi data pengiriman. Pelanggan lain bisa dicari lalu diisi.
- Tambahan HRIS: **rute bawaan** (rute kirim aktif, boleh kosong), **catatan pengiriman** ("masuk gang samping masjid"), **titik**. Diubah oleh hak `logistics.store.manage`.
- Pelanggan nonaktif di kasir tetap tampil bertanda "nonaktif di kasir"; surat jalan lamanya tetap.
- Driver dan kenek hanya melihat toko yang ada di trip-nya (nama, alamat, HP, catatan, titik) (LOG-07).

### 3.2 Titik toko (LOG-05, 93)

- **Pasang** dari kunjungan di Trip Saya: posisi GPS HP (akurasi paling buruk **50 m**, lebih buruk ditolak "Keluar dari bangunan dan coba lagi") + **foto depan toko** (kamera langsung). Status **Menunggu**.
- Kepala Gudang / Pemilik / GM **Setujui** atau **Tolak** (alasan) di tab "Titik menunggu"; yang ditolak kembali "belum ada titik". Pasangan dari mereka sendiri langsung Disetujui.
- Titik yang sudah disetujui hanya diganti Kepala Gudang / Pemilik / GM. Driver yang menemukan titik salah menekan **Laporkan titik salah** (alasan) → usulan baru; titik lama tetap dipakai sampai diputuskan. Riwayat disimpan (lama = Diganti).
- Toko tanpa titik bertanda **"belum ada titik"** di Data Toko, pilihan surat jalan, dan kunjungan.

### 3.3 Surat jalan (LOG-08 s.d. 10, 12, 95, 96)

| Status | Masuk lewat | Keluar ke |
|---|---|---|
| **Menunggu dikirim** | Penjualan grosir cabang pengirim di kasir; Kirim Besok; keputusan Kirim ulang; dilepas dari trip; trip Draft dibatalkan; Diambil toko dibuka lagi | Dalam perjalanan, Diambil toko, Batal |
| **Dalam perjalanan** | Masuk trip (Draft maupun Berjalan) | Terkirim, Menunggu (Kirim Besok / dilepas), Perlu keputusan |
| **Terkirim** | Kunjungan Terkirim | akhir |
| **Perlu keputusan** | Kunjungan Gagal | Menunggu (Kirim ulang), Batal |
| **Diambil toko** | Ditandai kantor selagi Menunggu (alasan singkat) | Menunggu (dibuka lagi ≤ 7 hari oleh penanda atau Pemilik/GM) |
| **Batal** | Dari Menunggu atau Perlu keputusan, alasan wajib; **atau otomatis** saat nota dibatalkan di kasir selagi Menunggu | akhir |

- **Nota dibatalkan/dikoreksi di kasir** sesudah surat jalan masuk trip: surat jalan bertanda **"berubah di kasir"** (nominal lama → baru, atau "dibatalkan di kasir") di rincian trip dan Trip Saya; Kepala Gudang memutuskan lepas atau tetap antar. Tidak ada pembagian uang di LT1.
- **Batal di HRIS** tidak membatalkan nota kasir; layar menulis "Batalkan juga nota [nomor] di kasir" (daftar Catat di Kasir menyusul di Tahap 4). Surat jalan yang notanya masih berlaku di kasir hanya bisa Batal dari **Perlu keputusan** (sesudah Gagal) atau oleh Pemilik/GM dengan alasan (§9 butir 6).
- Urutan daftar Menunggu: **pernah tertunda** paling atas (dari yang paling lama, LOG-20), lalu toko di rute bawaan yang dipilih (LOG-06), lalu tanggal.
- Satu toko boleh banyak surat jalan; di satu trip semuanya menjadi **satu kunjungan** (LOG-10). Driver tidak mengetik nominal.

### 3.4 Surat jalan di trip (LOG-15, 16, 19, 22, 23)

- Saat **buat/ubah trip Draft**, Kepala Gudang mencentang surat jalan Menunggu (langkah baru di form trip). Trip yang berisi surat jalan **wajib punya rute kirim** (ritase tetap per trip, upah tidak berubah).
- Masuk trip = surat jalan **Dalam perjalanan** (LOG-16). Satu surat jalan hanya di satu trip yang belum selesai.
- **Sesudah Berangkat** (LOG-19, 22, 103): surat jalan **tidak bisa ditambah** (masuk trip berikutnya); kantor masih bisa **melepas** kunjungan yang belum diproses (alasan) → surat jalannya kembali Menunggu. Kunjungan yang sudah Terkirim/Gagal terkunci.
- **Batal trip Draft** (LOG-23): semua surat jalannya kembali Menunggu dalam satu langkah.
- Trip tanpa surat jalan tetap boleh (trip kirim seperti L6 hari ini, atau belanja saja) — supaya peralihan tidak memaksa semua trip langsung memakai surat jalan (§9 butir 7).

### 3.5 Kunjungan di Trip Saya (LOG-24, 26, 27, 55, 56, 99)

- Kartu kunjungan: nama toko besar, alamat, catatan pengiriman, **telepon** (tombol panggil), **Buka peta** (titik disetujui) atau **Pasang titik**, daftar nomor surat jalan + nominal, tanda "berubah di kasir".
- Urutan bebas (LOG-26). Hanya selagi trip **Berjalan**. Ditekan driver atau kenek trip itu. Dua awak menekan bersamaan: yang kedua menerima "Sudah diproses [nama] pukul [jam]".
- **Terkirim**: **foto barang diterima** (kamera langsung, §9 butir 5); lokasi dicatat, **jarak dari titik toko dicatat, tidak ditolak** (R1/LOG-99). Semua surat jalan kunjungan → Terkirim.
- **Kirim Besok** (toko tutup, tidak ada orang): alasan (pilihan + tulis) + foto wajib → surat jalan kembali **Menunggu**, hitungan tertunda +1. Boleh dibuka lagi oleh awak selama trip masih Berjalan ("Coba lagi", LOG-121).
- **Gagal** (ditolak, batal pesan): alasan + foto wajib → **Perlu keputusan**. Tidak bisa dicoba lagi.
- Kirim Besok dan Gagal berlaku untuk **seluruh kunjungan** (LOG-122); penolakan sebagian menunggu potong nota Tahap 2.
- Setiap foto langsung tersimpan begitu diambil; tombol dikunci sekali tekan.

### 3.6 Menutup trip (LOG-27, 29, 30, 103)

- **Sampai Garasi ditolak** selama masih ada kunjungan **Terbuka**; pesan menyebut tokonya. Jalan keluarnya **Selesai lebih awal**: alasan + foto, semua kunjungan terbuka menjadi **Kirim Besok** (surat jalan kembali Menunggu, hitungan +1), lalu Sampai Garasi seperti biasa.
- **Tutup atas nama driver** oleh kantor (L6 §3.6): kunjungan terbuka otomatis Kirim Besok.
- Ritase, belanja, absen: **tidak berubah** dari L6/L7.

### 3.7 Perlu keputusan (LOG-56, 123)

- Kepala Gudang / Pemilik / GM memilih **Kirim ulang** (kembali Menunggu, bertanda pernah tertunda) atau **Batal** (alasan wajib, pengingat "batalkan di kasir").
- Batal dibuka lagi hanya oleh Pemilik/GM dalam 7 hari.

### 3.8 Pengaturan

| Kunci | Bawaan | Arti |
|---|---|---|
| `logistics.delivery_from` | tanggal tayang produksi LT1 (staging: 7 hari sebelum tayang staging) | Penjualan grosir sebelum tanggal ini tidak menjadi surat jalan |
| `logistics.point_accuracy_m` | 50 | Akurasi GPS terburuk saat pasang titik toko |
| `logistics.store_radius_m` | sama dengan radius absen cabang (100) | Batas "di luar titik toko" (dicatat saja di LT1) |
| `logistics.pickup_reopen_days` | 7 | Batas buka lagi Diambil toko dan Batal |

| `logistics.delivery_branches` | Gudang, Toko Pusat | Cabang kasir yang penjualan grosirnya menjadi surat jalan truk (diubah Pemilik/GM) |

Cabang dipilih dari cabang HRIS yang bertaut ke cabang kasir.

**Bukan sumber:** fitur *delivery order* / antar di kasir (`petshop.delivery_orders`, `service_deliveries`). Catatan owner 2026-11-04: itu tidak dikirim orang logistik (antar sendiri cabang = Tahap 3).

## 4. Layar

| Layar | Alamat | Dipakai | Isi |
|---|---|---|---|
| **Surat Jalan** (baru, PC) | `/logistik/surat-jalan` | Kepala Gudang, Marketing, Pemilik, GM; Finance lihat | Tab per status dengan angka (Menunggu, Dalam perjalanan, Terkirim, Perlu keputusan, Diambil toko, Batal). Baris: nomor struk, tanggal, toko (+ "belum ada titik"), rute bawaan, nominal, umur, tanda "pernah tertunda ×n" / "berubah di kasir". Saring rute, tanggal; cari nomor/toko. Centang beberapa → **Tandai diambil toko** |
| Rincian surat jalan | `/logistik/surat-jalan/[id]` | sama | Data nota dari kasir (tautan buka nota di backoffice), status + riwayat, trip & kunjungan, foto. Tombol menurut status: Diambil toko, Buka lagi, Kirim ulang, Batal |
| **Data Toko** (baru, PC, terbaca HP) | `/logistik/toko` | Kepala Gudang, Marketing, Pemilik, GM; Finance lihat | Tab **Toko** (nama, alamat, HP, rute bawaan, tanda titik, jumlah surat jalan berjalan; cari nama/alamat/HP/kode) dan **Titik menunggu** (angka penanda; kartu peta + foto + jarak dari titik lama → Setujui / Tolak) |
| Rincian toko | `/logistik/toko/[id]` | sama | Data dari kasir (baca), data pengiriman (Ubah), titik + riwayat (Pasang titik untuk Kepala Gudang/Pemilik), daftar surat jalan & kunjungan |
| **Trip** (ubah) | form buat/ubah trip | Kepala Gudang, Pemilik, GM | Langkah baru **Surat jalan**: daftar Menunggu (urutan §3.3), centang; ringkasan "8 toko, 11 surat jalan, Rp…" |
| Rincian trip (ubah) | `/logistik/trip/[id]` | sama | Daftar kunjungan (toko, surat jalan, status, jam, jarak dari titik, foto) + tombol **Lepas** per kunjungan terbuka |
| **Trip Saya** (ubah, HP) | `/trip-saya` | Driver, kenek | "Berjalan: 4 dari 9 toko selesai"; daftar kunjungan → kartu kunjungan (§3.5); **Selesai lebih awal**; Sampai Garasi aktif setelah semua kunjungan diproses |

**Beranda**: kartu "Surat jalan perlu keputusan" dan "Titik toko menunggu" untuk Kepala Gudang/Pemilik/GM. Foto kunjungan dan titik: tertutup seperti foto awak (L6), dibuang mengikuti `attendance.photo_retention_days` kecuali foto titik yang disetujui (bukti titik).

## 5. Hak

| Hak | Bawaan |
|---|---|
| `logistics.delivery_note.view` | Kepala Gudang, Marketing, Finance, HR tidak; Pemilik, GM |
| `logistics.delivery_note.manage` (diambil toko, buka lagi) | Kepala Gudang, Marketing, Pemilik, GM |
| `logistics.delivery_note.decide` (Kirim ulang / Batal dari Perlu keputusan) | Kepala Gudang, Pemilik, GM |
| `logistics.store.view` / `.manage` (data pengiriman) | lihat: + Finance; ubah: Kepala Gudang, Marketing, Pemilik, GM |
| `logistics.store_point.decide` (setujui/tolak/pasang langsung) | Kepala Gudang, Pemilik, GM |
| Kunjungan & pasang titik di Trip Saya | tanpa hak khusus: hanya awak trip itu, dicek server |

Marketing **tidak** memutuskan Perlu keputusan (LOG-84: yang menagih bukan yang mengesahkan); Finance hanya melihat di LT1.

## 6. Mesin terjadwal

Tidak ada mesin baru: surat jalan dibaca hidup dari kasir (tanpa tarik per menit). Mesin `logistics-daily` (L6) ikut membuang foto kunjungan sesuai umur.

## 7. Pemberitahuan

| Kejadian | Ke | Isi |
|---|---|---|
| Kunjungan Gagal | Kepala Gudang, Pemilik, GM | "Toko Maju gagal dikirim (ditolak) — perlu keputusan" |
| Titik toko diusulkan / dilaporkan salah | Kepala Gudang | Toko, pemasang |
| Nota berubah/dibatalkan di kasir sesudah masuk trip | Kepala Gudang | Nomor struk, nominal lama → baru |
| Titik ditolak | Pemasang | Alasan |

## 8. Tes

- **Aturan (unit):** penjualan mana yang menjadi surat jalan (BULK, cabang pengirim Gudang/Toko Pusat, cabang lain ditolak, pelanggan non-internal, tanggal); peralihan status (tabel §3.3) termasuk yang ditolak; satu surat jalan satu trip terbuka; kunjungan per toko; syarat Sampai Garasi; Selesai lebih awal; urutan daftar Menunggu; akurasi titik.
- **Integrasi (DB, stub `petshop`):** nota grosir → Menunggu → masuk trip → Berangkat → Terkirim → ritase **sama persis** dengan L6 (tes pembanding upah); Kirim Besok kembali Menunggu + hitungan; Gagal → Kirim ulang / Batal; nota dibatalkan di kasir selagi Menunggu → Batal otomatis, sesudah masuk trip → bertanda; batal trip Draft melepas semua; dua awak menekan kunjungan sama → sekali.
- **Batas:** modul HRIS selain logistics tidak mengimpor tabel baru; `hris_app`/peran logistik tidak membaca `petshop` selain lewat view; `bo_app` tidak menulis `logistics`.

## 9. Keputusan owner (menunggu)

| # | Pertanyaan | Saran |
|---|---|---|
| 1 | Penjualan kasir mana yang menjadi surat jalan? | **Bulk Sale (grosir) di kasir Gudang dan Toko Pusat ke pelanggan bukan-cabang** (catatan owner). Retail, PO Internal ke cabang sendiri, dan delivery order kasir tidak. Daftar cabang bisa diubah di pengaturan. Bulk Sale yang tidak diantar truk ditandai **Diambil toko** |
| 2 | Mulai dari tanggal berapa? | **Tanggal tayang produksi LT1** (penjualan lama tidak membanjiri daftar). Di staging 7 hari ke belakang untuk uji |
| 3 | Alamat & HP toko diubah di mana? | **Di kasir** (Master Pelanggan), satu sumber. HRIS hanya menambah rute bawaan, catatan pengiriman, titik |
| 4 | Gabung toko dobel (v3 F6) ikut? | **Tidak**; pelanggan dobel dirapikan di kasir |
| 5 | Terkirim wajib **foto barang diterima**? | **Ya** (bukti; v3 Kirim truk juga berfoto). Tanpa tanda tangan |
| 6 | Siapa boleh **Batal** surat jalan yang notanya masih berlaku di kasir? | Dari **Perlu keputusan**: Kepala Gudang/Pemilik/GM. Dari Menunggu: **Pemilik/GM saja** (alasan). Selebihnya: pakai **Diambil toko** |
| 7 | Trip **tanpa surat jalan** tetap boleh? | **Ya, selama masa peralihan**; bisa dikunci kelak lewat pengaturan |
| 8 | Status Siap Kirim, Menuju Garasi, foto bak kosong (v3) ikut? | **Tidak** di LT1; alur trip L6 sudah dikenal driver. Ditimbang lagi bersama retur (Tahap 2) |
| 9 | **Titik toko** (pasang + setujui) ikut LT1? | **Ya**; dibutuhkan driver (Buka peta) dan dasar "di luar titik" Tahap 5 |
| 10 | Tayang sekali atau dipecah? | **Dipecah 2**: **LT1a** Data Toko + Surat Jalan (+ Diambil toko, Batal, Perlu keputusan); **LT1b** surat jalan di trip + kunjungan di Trip Saya + titik toko |
| 11 | Sisa L6: baris "Lewat trip" (Jalan / Tidak jalan) di **Rekap Kehadiran** ikut? | **Ya, ikut LT1b** (kecil, satu layar) |
