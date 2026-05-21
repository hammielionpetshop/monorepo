---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories']
inputDocuments: ['prd.md']
---

# Hammielion POS - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Hammielion POS, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Sistem (POS) dapat mendeteksi status koneksi internet dan menampilkannya kepada Kasir secara real-time.
FR2: Sistem (POS) dapat beroperasi penuh (mencari produk, menambah ke keranjang, proses pembayaran, cetak struk) tanpa koneksi internet.
FR3: Sistem (POS) dapat mengunduh seluruh data master (produk, harga, stok, pengaturan pajak) dari server dan menyimpannya ke database lokal dengan benar saat awal inisialisasi (Bootstrap).
FR4: Sistem (POS) dapat menyimpan transaksi yang terjadi saat offline ke dalam antrean lokal.
FR5: Sistem (POS) dapat secara otomatis menyinkronkan antrean transaksi lokal ke server pusat saat koneksi internet pulih.
FR6: Sistem (Server) dapat menerima sinkronisasi transaksi offline dan menyimpan data transaksi dengan menggunakan harga yang berlaku saat transaksi tersebut terjadi.
FR7: Sistem (Server) dapat memperbarui data stok berdasarkan urutan waktu transaksi yang masuk.
FR8: Kasir dapat melihat daftar riwayat transaksi yang terjadi pada perangkat lokal.
FR9: Kasir dapat mencari riwayat transaksi berdasarkan kata kunci tertentu (misal: nama pelanggan).
FR10: Kasir dapat memfilter riwayat transaksi berdasarkan tanggal.
FR11: Kasir dapat memfilter riwayat transaksi berdasarkan shift operasional.
FR12: Kasir dapat melihat detail lengkap dari sebuah transaksi (item, jumlah, harga satuan, pajak, total, metode pembayaran).
FR13: Kasir dapat mencetak ulang struk dari riwayat transaksi yang sudah selesai.
FR14: Kasir dapat membatalkan (Void) sebuah transaksi melalui otorisasi PIN Owner.
FR15: Kasir dapat menggunakan fitur "Clone to Cart" pada transaksi yang di-void untuk mengulang pesanan dengan modifikasi.
FR16: Sistem (POS) dapat mencegah pembatalan transaksi (Void) untuk transaksi yang berada di shift yang sudah ditutup (Settled).
FR17: Owner dapat melakukan koreksi/retur transaksi pasca-settlement melalui Backoffice.
FR18: Owner dapat melihat ringkasan harian (penjualan, pengeluaran, status shift) dari seluruh cabang melalui Dashboard Backoffice.
FR19: Owner dapat menerima notifikasi terkait status sinkronisasi cabang yang sempat offline.
FR20: Owner dapat melihat laporan detail laba rugi per cabang atau agregasi.
FR21: Owner dapat melihat laporan nilai stok berbasis metode FIFO.
FR22: Owner dapat melakukan penyesuaian stok (Stock Adjustment) mandiri tanpa harus melalui transaksi penjualan/pembelian.

### NonFunctional Requirements

NFR1: [Performance] Pencarian produk dan pencarian riwayat transaksi di POS harus menampilkan hasil awal dalam waktu < 200 milidetik setelah keystroke terakhir.
NFR2: [Performance] Dashboard Backoffice dan Laporan History harus memuat data dalam waktu < 3 detik.
NFR3: [Reliability] Kemampuan POS untuk memproses transaksi penjualan tidak boleh terputus meskipun internet mati (100% availability untuk kasir).
NFR4: [Reliability] Auto-retry sinkronisasi secara eksponensial tanpa memerlukan intervensi kasir.
NFR5: [Security] Seluruh database lokal (Dexie.js) di perangkat POS wajib dienkripsi AES-256.
NFR6: [Security] PIN otorisasi Owner harus divalidasi secara lokal menggunakan metode salted hash per perangkat.
NFR7: [Precision] Kalkulasi finansial wajib dihitung tanpa error floating-point menggunakan library big.js.

### Additional Requirements

- [Infrastructure] Starter Template: None specified in architecture (Architecture document is missing).
- [Compliance] Mendukung perhitungan PPN 11% dan cetak struk thermal.
- [Technical] Mutasi stok menggunakan Pessimistic Locking (.for('update')).
- [Deployment] Auto-Update menggunakan electron-updater di latar belakang.
- [Security] DevTools dinonaktifkan di build production (nodeIntegration: false).

### UX Design Requirements

*(No UX Design document available for extraction)*

### FR Coverage Map

FR1: Epic 1 - Deteksi status koneksi
FR2: Epic 1 - Operasi POS offline
FR3: Epic 1 - Bootstrap master data
FR4: Epic 1 - Simpan transaksi ke antrean lokal
FR5: Epic 1 - Auto-sync antrean transaksi
FR6: Epic 1 - Terima sync transaksi offline dengan harga historis
FR7: Epic 1 - Update stok berurutan
FR8: Epic 2 (Electron, done), Epic 10 Story 10.1 (Web POS) - Lihat daftar riwayat transaksi
FR9: Epic 3 (Electron, done), Epic 10 Story 10.2 (Web POS) - Cari riwayat berdasarkan nama
FR10: Epic 3 (Electron, done), Epic 10 Story 10.2 (Web POS) - Filter riwayat berdasarkan tanggal
FR11: Epic 3 (Electron, done), Epic 10 Story 10.2 (Web POS) - Filter riwayat berdasarkan shift
FR12: Epic 2 (Electron, done), Epic 10 Story 10.1 (Web POS) - Lihat detail transaksi
FR13: Epic 2 (Electron, done), Epic 10 Story 10.1 (Web POS) - Cetak ulang struk
FR14: Epic 4 (Electron, done), Epic 10 Story 10.3 (Web POS) - Void transaksi dengan PIN
FR15: Epic 4 (Electron, done), Epic 10 Story 10.3 (Web POS) - Clone to Cart
FR16: Epic 4 (Electron, done), Epic 10 Story 10.3 (Web POS) - Cegah void di shift tertutup
FR17: Epic 4 - Retur via Backoffice
FR18: Epic 5 - Ringkasan harian di Dashboard Backoffice
FR19: Epic 5 - Notifikasi sinkronisasi cabang
FR20: Epic 5 - Laporan laba rugi
FR21: Epic 5 - Laporan nilai stok FIFO
FR22: Epic 6 - Penyesuaian stok mandiri

## Epic List

### Epic 1: Offline Retail Operations (MVP)
**Goal:** Kasir dapat melayani pelanggan secara penuh tanpa mempedulikan koneksi internet, dan sistem menjamin data tersinkronisasi sempurna tanpa merugikan pencatatan finansial.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7

### Epic 2: Transaction History & Basic Auditing (MVP)
**Goal:** Kasir dapat melacak detail dan mencetak ulang transaksi yang terjadi pada perangkatnya dengan sangat cepat (< 200ms) untuk layanan pelanggan dasar.
**FRs covered:** FR8, FR12, FR13

### Epic 3: Advanced History Filters (Fast Follow)
**Goal:** Kasir dapat mencari riwayat transaksi spesifik menggunakan filter nama pelanggan, rentang tanggal, atau shift operasional.
**FRs covered:** FR9, FR10, FR11

### Epic 4: Transaction Correction & Retur (Post-MVP)
**Goal:** Kasir dan Owner dapat mengoreksi kesalahan input transaksi (Void & Clone-to-Cart) secara aman menggunakan PIN otorisasi, tanpa merusak integritas pencatatan.
**FRs covered:** FR14, FR15, FR16, FR17

### Epic 5: Enterprise Dashboard & Reporting (Post-MVP)
**Goal:** Owner dapat memantau performa bisnis (penjualan, profit) dan kesehatan operasional (status offline) dari seluruh cabang secara terpusat.
**FRs covered:** FR18, FR19, FR20, FR21

### Epic 6: Inventory Management (Post-MVP)
**Goal:** Owner dapat menjaga keakuratan stok fisik toko dengan melakukan penyesuaian (stock adjustment) tanpa harus memanipulasi transaksi kasir.
**FRs covered:** FR22

### Epic 7: Backoffice Master Data Management (P0 — Critical Blocker)
**Goal:** Owner dan Admin dapat mengelola seluruh data master (produk, brand, kategori, UOM, harga, pengguna, cabang) secara mandiri melalui Backoffice tanpa memerlukan akses langsung ke database atau seed script.
**Priority:** P0 — Tanpa ini Owner tidak bisa operate sistem secara mandiri
**FRs covered:** Foundational requirement (tidak tercakup di PRD awal)

### Epic 8: Backoffice Operational Quick Wins (P1 — Backend Ready)
**Goal:** Owner dapat mengelola operasional stok (approval SO, inisiasi SO, riwayat adjustment) dari Backoffice menggunakan API yang sudah ada — hanya membutuhkan UI.
**Priority:** P1 — Backend sudah selesai, hanya perlu UI
**FRs covered:** Operational requirement (sebagian dari FR22 + Stock Opname ops)

### Epic 9: Web POS Foundation (P0 — Strategic Pivot)
**Goal:** Kasir dapat login dan memproses transaksi penjualan dasar melalui browser di tablet/HP, sebagai fondasi pengganti Electron POS jangka panjang.
**Priority:** P0 — Inisiatif strategis utama sprint berikutnya
**Stack:** Next.js route group `(pos)` di dalam `apps/backoffice`
**Note:** Electron POS (`apps/pos-desktop`) di-freeze per 2026-05-15. Web POS adalah pengganti jangka panjang.
**FRs covered:** Subset transaksi dasar (diimplementasi ulang untuk web, pure online)

## Epic 1: Offline Retail Operations (MVP)

**Goal:** Kasir dapat melayani pelanggan secara penuh tanpa mempedulikan koneksi internet, dan sistem menjamin data tersinkronisasi sempurna tanpa merugikan pencatatan finansial.

### Story 1.1: Offline Status Indicator

As a Kasir,
I want melihat indikator status koneksi internet secara real-time,
So that saya tahu apakah transaksi saya sedang dikirim ke server atau hanya disimpan di perangkat.

**Acceptance Criteria:**

**Given** aplikasi POS sedang berjalan
**When** koneksi internet terputus
**Then** header aplikasi harus menampilkan peringatan "Mode Offline" berwarna kuning/merah

**Given** aplikasi POS dalam Mode Offline
**When** koneksi internet kembali pulih
**Then** indikator harus kembali berubah menjadi "Online" berwarna hijau

### Story 1.2: Bootstrap Master Data

As a Kasir,
I want sistem mengunduh seluruh data produk, harga, dan pajak di awal shift,
So that saya tetap bisa melayani pembeli meskipun internet mati di tengah hari.

**Acceptance Criteria:**

**Given** POS online saat inisialisasi aplikasi
**When** sistem mulai memuat
**Then** seluruh master data diunduh dari server
**And** disimpan ke dalam IndexedDB/Dexie.js lokal

**Given** aplikasi berhasil melakukan bootstrap
**When** internet mati dan kasir mencari barang
**Then** hasil pencarian tetap muncul seketika (< 200ms) dari database lokal

### Story 1.3: Local Transaction Queue

As a Kasir,
I want memproses pembayaran dan mencetak struk seperti biasa saat offline,
So that antrean pembeli tidak terhenti karena masalah jaringan.

**Acceptance Criteria:**

**Given** POS berada di Mode Offline
**When** pembayaran berhasil diselesaikan
**Then** data transaksi disimpan ke table `sync_queue` di dalam Dexie.js
**And** struk dapat dicetak seketika tanpa perlu menunggu timeout dari server

### Story 1.4: Auto-Sync Queue to Server

As a System,
I want secara otomatis mengirim transaksi yang tertunda ke server saat online,
So that data pusat tetap akurat tanpa mengharuskan Kasir menekan tombol "Sinkronisasi Manual".

**Acceptance Criteria:**

**Given** ada transaksi di antrean lokal
**When** indikator kembali "Online"
**Then** aplikasi otomatis mengirim transaksi (satu per satu / batch) ke server di latar belakang
**And** server memproses pesanan menggunakan harga historis (price-at-time-of-sale) yang dikirim dari lokal

**Given** proses sync gagal karena server down / jaringan labil
**When** request terputus
**Then** sistem akan melakukan retry eksponensial di latar belakang tanpa memblokir layar kasir

## Epic 2: Transaction History & Basic Auditing (MVP)

**Goal:** Kasir dapat melacak detail dan mencetak ulang transaksi yang terjadi pada perangkatnya dengan sangat cepat (< 200ms) untuk layanan pelanggan dasar.

### Story 2.1: View Local Transaction History

As a Kasir,
I want melihat daftar transaksi yang diproses di perangkat ini pada hari yang sama,
So that saya dapat memverifikasi penjualan terbaru secara instan.

**Acceptance Criteria:**

**Given** Kasir membuka tab History
**When** halaman dimuat
**Then** aplikasi menampilkan daftar transaksi hari ini yang ditarik dari Dexie.js lokal
**And** daftar memuat waktu, nomor struk, total harga, dan metode pembayaran
**And** data harus dimuat dalam waktu kurang dari 200ms

### Story 2.2: View Transaction Details

As a Kasir,
I want melihat rincian sebuah transaksi dari daftar riwayat,
So that saya bisa melihat barang apa saja yang dibeli dan berapa pajaknya.

**Acceptance Criteria:**

**Given** Kasir berada di halaman daftar History
**When** mereka mengklik salah satu baris transaksi
**Then** aplikasi menampilkan detail transaksi yang berisi daftar barang, kuantitas, harga satuan, pajak, dan grand total

### Story 2.3: Reprint Receipt

As a Kasir,
I want dapat mencetak ulang struk dari riwayat transaksi yang dipilih,
So that saya bisa memberikan salinan kepada pelanggan jika diminta.

**Acceptance Criteria:**

**Given** Kasir sedang melihat rincian transaksi
**When** mereka menekan tombol "Cetak Ulang"
**Then** thermal printer akan mencetak salinan struk tersebut
**And** struk hasil cetak ulang harus secara jelas mencantumkan label "COPY" atau "REPRINT" untuk mencegah penyalahgunaan

## Epic 3: Advanced History Filters (Fast Follow)

**Goal:** Kasir dapat mencari riwayat transaksi spesifik menggunakan filter nama pelanggan, rentang tanggal, atau shift operasional.

### Story 3.1: Search Transaction by Customer Name

As a Kasir,
I want mencari riwayat transaksi menggunakan nama pelanggan,
So that saya dapat dengan mudah menemukan struk spesifik untuk pelanggan yang kembali.

**Acceptance Criteria:**

**Given** Kasir berada di halaman History
**When** mereka mengetik nama pelanggan di kolom pencarian
**Then** daftar akan langsung disaring (filtered) untuk menampilkan transaksi yang cocok dengan nama tersebut
**And** hasil pencarian harus muncul dalam waktu kurang dari 200ms

### Story 3.2: Filter History by Date Range

As a Kasir,
I want menyaring riwayat transaksi berdasarkan tanggal tertentu,
So that saya dapat melihat penjualan dari hari-hari sebelumnya jika diperlukan.

**Acceptance Criteria:**

**Given** Kasir berada di halaman History
**When** mereka memilih sebuah tanggal dari komponen kalender
**Then** daftar akan menampilkan seluruh transaksi yang terjadi pada tanggal tersebut

**Given** tanggal yang dipilih tidak memiliki transaksi
**When** filter diterapkan
**Then** layar akan menampilkan pesan "Tidak ada transaksi pada tanggal ini"

### Story 3.3: Filter History by Shift

As a Kasir,
I want menyaring riwayat transaksi berdasarkan shift operasional,
So that saya dapat mencocokkan total transaksi dengan uang di laci kasir pada akhir shift saya.

**Acceptance Criteria:**

**Given** Kasir berada di halaman History
**When** mereka memilih shift tertentu dari menu dropdown
**Then** daftar hanya akan menampilkan transaksi yang diselesaikan dalam rentang waktu shift tersebut
**And** filter ini dapat digabungkan dengan filter tanggal

## Epic 4: Transaction Correction & Retur (Post-MVP)

**Goal:** Kasir dan Owner dapat mengoreksi kesalahan input transaksi (Void & Clone-to-Cart) secara aman menggunakan PIN otorisasi, tanpa merusak integritas pencatatan.

### Story 4.1: Void Transaction with PIN

As a Kasir,
I want membatalkan (Void) transaksi yang salah jika saya mendapatkan PIN Otorisasi dari Owner,
So that saya dapat mengoreksi kesalahan input tanpa merusak catatan finansial permanen.

**Acceptance Criteria:**

**Given** Kasir sedang melihat rincian transaksi
**When** mereka menekan tombol "Void"
**Then** muncul modal yang meminta PIN Otorisasi

**Given** PIN dimasukkan dengan benar
**When** form dikirim
**Then** status transaksi berubah menjadi 'VOID' (tidak dihapus dari database)
**And** stok barang dari transaksi tersebut otomatis dikembalikan (bertambah)

### Story 4.2: Prevent Void on Closed Shift

As a System,
I want mencegah pembatalan transaksi dari shift yang sudah ditutup,
So that data historis shift yang sudah disetor (settled) tidak terganggu.

**Acceptance Criteria:**

**Given** sebuah transaksi terjadi pada shift yang statusnya sudah ditutup (Closed)
**When** Kasir melihat rincian transaksi tersebut
**Then** tombol "Void" akan dinonaktifkan atau disembunyikan

### Story 4.3: Clone to Cart

As a Kasir,
I want menyalin barang-barang dari transaksi yang baru saja di-void ke keranjang aktif,
So that saya tidak perlu memasukkan ulang semua barang satu per satu hanya untuk memperbaiki kesalahan kecil.

**Acceptance Criteria:**

**Given** Kasir berhasil melakukan Void transaksi
**When** mereka menekan tombol "Clone to Cart"
**Then** seluruh barang, kuantitas, dan harga dari transaksi asli akan otomatis masuk ke keranjang POS aktif

### Story 4.4: Backoffice Retur Management (DEFERRED)

**Note: Ditunda ke Epic 5 untuk penyelarasan dengan pengembangan modul Backoffice.**

As an Owner,
I want memproses Retur dari dashboard backoffice,
So that saya dapat menangani pengembalian dana (refund) atau pertukaran barang secara aman di luar area kasir yang sibuk.

**Acceptance Criteria:**

**Given** Owner login ke Backoffice
**When** mereka mengakses modul Retur
**Then** mereka dapat mencari transaksi masa lalu dan memproses pengembalian penuh atau sebagian
**And** penyesuaian stok dan pencatatan finansial terkait retur akan langsung dieksekusi di backend

## Epic 5: Enterprise Dashboard & Reporting (Post-MVP)

**Goal:** Owner dapat memantau performa bisnis (penjualan, profit) dan kesehatan operasional (status offline) dari seluruh cabang secara terpusat.

### Story 5.1: Daily Summary Dashboard

As an Owner,
I want melihat ringkasan penjualan, jumlah transaksi, dan laba kotor harian dari seluruh cabang di dashboard backoffice,
So that saya dapat memantau kesehatan bisnis secara cepat setiap harinya.

**Acceptance Criteria:**

**Given** Owner masuk ke Backoffice
**When** halaman dashboard dimuat
**Then** layar menampilkan metrik agregat untuk hari ini
**And** metrik tersebut mencakup: Total Pendapatan, Jumlah Transaksi, dan Estimasi Laba Kotor

### Story 5.2: Offline Branch Notification

As an Owner,
I want melihat daftar cabang mana saja yang sedang offline atau memiliki transaksi yang belum tersinkronisasi,
So that saya bisa memastikan semua pendapatan pada akhirnya tercatat di database pusat.

**Acceptance Criteria:**

**Given** satu atau lebih klien POS terputus dari server lebih dari durasi wajar
**When** Owner melihat dashboard
**Then** widget peringatan akan menampilkan daftar cabang yang offline beserta waktu sinkronisasi terakhir mereka

### Story 5.3: Profit and Loss Report

As an Owner,
I want menghasilkan laporan Laba Rugi (P&L) untuk periode tertentu,
So that saya bisa menganalisis tingkat profitabilitas nyata dari operasional toko saya.

**Acceptance Criteria:**

**Given** Owner berada di modul Laporan
**When** mereka memilih rentang tanggal dan menekan "Hasilkan Laba Rugi"
**Then** sistem menghitung Revenue dikurangi HPP (Harga Pokok Penjualan)
**And** laporan tersebut dapat diekspor ke format CSV atau PDF

### Story 5.4: FIFO Stock Valuation Report

As an Owner,
I want melihat nilai inventaris saya saat ini berdasarkan metode FIFO,
So that saya mengetahui nilai aset sebenarnya dari barang yang ada di toko.

**Acceptance Criteria:**

**Given** Owner berada di modul Laporan
**When** mereka membuka laporan Stock Valuation
**Then** sistem menampilkan daftar barang dengan level stok saat ini yang dikalikan dengan harga beli (purchase price) aktif menggunakan logika FIFO

## Epic 6: Inventory Management (Post-MVP)

**Goal:** Owner dapat menjaga keakuratan stok fisik toko dengan melakukan penyesuaian (stock adjustment) tanpa harus memanipulasi transaksi kasir.

### Story 6.1: Manual Stock Adjustment

As an Owner,
I want menyesuaikan jumlah stok barang secara manual,
So that saya dapat mengoreksi selisih stok (barang hilang/rusak) yang ditemukan saat stock opname fisik tanpa harus memanipulasi transaksi penjualan.

**Acceptance Criteria:**

**Given** Owner berada di modul Inventory di Backoffice
**When** mereka memilih suatu produk dan memasukkan kuantitas stok yang baru
**Then** sistem akan mencatat entri penyesuaian (adjustment entry) dengan wajib menyertakan alasan penyesuaian
**And** jumlah stok aktual akan segera diperbarui di database pusat, dan perubahan ini akan tersinkronisasi ke seluruh klien POS pada siklus sync berikutnya

## Epic 7: Backoffice Master Data Management (P0 — Critical Blocker)

**Goal:** Owner dan Admin dapat mengelola seluruh data master secara mandiri melalui Backoffice tanpa memerlukan akses langsung ke database atau seed script.

### Story 7.1: Product Master CRUD

As an Admin/Owner,
I want mengelola data produk (tambah, lihat, edit, nonaktifkan) melalui Backoffice,
So that produk baru dapat ditambahkan ke sistem tanpa memerlukan akses database langsung.

**Acceptance Criteria:**

**Given** Admin/Owner membuka halaman `/master-data/products`
**When** halaman dimuat
**Then** daftar semua produk aktif ditampilkan dengan kolom: Nama, SKU, Barcode, Kategori, Brand, UOM Dasar, Status

**Given** Admin menekan tombol "Tambah Produk"
**When** form diisi dengan valid (nama wajib, SKU unik, UOM dasar wajib)
**Then** produk baru tersimpan ke database dan muncul di daftar

**Given** Admin memilih produk dan menekan "Edit"
**When** perubahan disimpan
**Then** data produk diperbarui di database

**Given** Admin memilih produk aktif dan menekan "Nonaktifkan"
**When** dikonfirmasi
**Then** produk `isActive` menjadi `false` dan tidak muncul di POS Bootstrap

### Story 7.2: Brand, Category & UOM Management

As an Admin/Owner,
I want mengelola data Brand, Kategori, dan Satuan Ukur (UOM) melalui Backoffice,
So that klasifikasi produk dapat dikelola secara mandiri.

**Acceptance Criteria:**

**Given** Admin membuka halaman `/master-data/brands` (atau `/categories`, `/uom`)
**When** halaman dimuat
**Then** daftar data master ditampilkan

**Given** Admin mengisi form tambah data baru dengan nama yang valid dan unik
**When** disimpan
**Then** data tersimpan ke tabel `brands` / `categories` / `units_of_measure`

**Given** Admin mencoba menambah nama yang sudah ada
**When** disimpan
**Then** error "Nama sudah digunakan" ditampilkan

### Story 7.3: Multi-UOM Config per Produk

As an Admin/Owner,
I want mengkonfigurasi konversi satuan (UOM) per produk di Backoffice,
So that kasir dapat menjual produk dalam satuan yang berbeda (misal: Pcs, Lusin, Karton) dengan harga yang tepat.

**Acceptance Criteria:**

**Given** Admin membuka halaman detail produk dan mengakses tab "Satuan"
**When** halaman dimuat
**Then** daftar UOM conversion yang sudah ada ditampilkan (dengan ratio)

**Given** Admin mengisi UOM baru dengan ratio yang valid (> 0)
**When** disimpan
**Then** entri tersimpan ke `productUomConversions`

**Given** Admin mencoba menyimpan ratio 0 atau negatif
**When** disimpan
**Then** error validasi ditampilkan

### Story 7.4: Price Tier Manager

As an Admin/Owner,
I want mengatur 6 tingkat harga per produk per cabang per UOM melalui Backoffice,
So that harga yang tepat diterapkan otomatis oleh POS berdasarkan tipe pelanggan.

**Acceptance Criteria:**

**Given** Admin membuka tab "Harga" di halaman detail produk
**When** halaman dimuat
**Then** tabel harga ditampilkan dengan kolom: Cabang, UOM, Tier (RETAIL/GROSIR/MEMBER/dll), Harga

**Given** Admin mengisi harga untuk kombinasi cabang + UOM + tier yang belum ada
**When** disimpan
**Then** entri baru tersimpan ke `productPrices`

**Given** Admin mengubah harga yang sudah ada
**When** disimpan
**Then** harga diperbarui di database

### Story 7.5: User Management

As an Owner,
I want mengelola data pengguna sistem (tambah, edit, nonaktifkan) melalui Backoffice,
So that karyawan baru dapat diberikan akses sistem tanpa bantuan teknis.

**Acceptance Criteria:**

**Given** Owner membuka halaman `/settings/users`
**When** halaman dimuat
**Then** daftar pengguna ditampilkan dengan kolom: Nama, Nomor Staf, Email, Role, Cabang, Status

**Given** Owner mengisi form tambah pengguna dengan data valid
**When** disimpan
**Then** pengguna baru tersimpan ke tabel `users` dengan password hash awal

**Given** Owner memilih pengguna dan mengubah role atau cabang
**When** disimpan
**Then** data pengguna diperbarui

**Given** Owner menonaktifkan pengguna
**When** dikonfirmasi
**Then** `isActive` menjadi `false` dan pengguna tidak bisa login

### Story 7.6: Branch Settings

As an Owner,
I want melihat dan mengedit data cabang (nama, alamat, kode cabang, kontak) melalui Backoffice,
So that informasi cabang yang tercetak di struk dan laporan selalu akurat.

**Acceptance Criteria:**

**Given** Owner membuka halaman `/settings/branches`
**When** halaman dimuat
**Then** daftar semua cabang ditampilkan

**Given** Owner memilih cabang dan mengubah data (nama, alamat, telepon)
**When** disimpan
**Then** data cabang diperbarui di tabel `branches`

## Epic 8: Backoffice Operational Quick Wins (P1 — Backend Ready)

**Goal:** Owner dapat mengelola operasional stok dari Backoffice menggunakan API yang sudah ada — hanya membutuhkan UI.

### Story 8.1: SO Approval Dashboard

As an Owner/Manager,
I want melihat daftar Stock Opname yang sudah disubmit kasir dan menyetujui atau menolaknya melalui Backoffice,
So that selisih stok dapat ditindaklanjuti tanpa harus hadir langsung di toko.

**Acceptance Criteria:**

**Given** Owner membuka halaman `/inventory/stock-opname`
**When** halaman dimuat
**Then** daftar SO berstatus `PENDING` ditampilkan beserta: tanggal, cabang, jumlah item, petugas

**Given** Owner memilih SO dan menekan "Setujui"
**When** dikonfirmasi
**Then** API `PATCH /api/bo/stock-opnames/[id]/approve` dipanggil dan stok diperbarui via FIFO

**Given** Owner menekan "Tolak" dan mengisi alasan
**When** dikonfirmasi
**Then** API `PATCH /api/bo/stock-opnames/[id]/reject` dipanggil

### Story 8.2: SO Initiator dari BO

As an Owner/Manager,
I want memulai Stock Opname Besar dari Backoffice (pilih kategori, cabang, petugas),
So that SO Besar dapat diinisiasi secara terpusat tanpa harus datang ke toko.

**Acceptance Criteria:**

**Given** Owner membuka form "Mulai SO Besar" di Backoffice
**When** mengisi kategori produk, cabang, dan petugas yang ditugaskan lalu menekan "Mulai"
**Then** API `POST /api/bo/stock-opnames` dipanggil dan SO Besar aktif muncul di POS cabang tersebut

### Story 8.3: Adjustment Logs

As an Owner,
I want melihat riwayat semua penyesuaian stok (manual adjustment, SO result) di Backoffice,
So that saya dapat mengaudit perubahan stok kapanpun tanpa harus cek database langsung.

**Acceptance Criteria:**

**Given** Owner membuka halaman `/inventory/adjustment-logs`
**When** halaman dimuat
**Then** daftar entri dari tabel `stock_adjustments` dan `audit_logs` (action: MANUAL_STOCK_ADJUSTMENT) ditampilkan dengan: tanggal, produk, perubahan qty, alasan, petugas

**Given** Owner menggunakan filter tanggal atau produk
**When** filter diterapkan
**Then** daftar difilter sesuai kriteria

## Epic 9: Web POS Foundation (P0 — Strategic Pivot)

**Goal:** Kasir dapat login dan memproses transaksi penjualan dasar melalui browser di tablet/HP, sebagai fondasi pengganti Electron POS jangka panjang.

**Catatan Strategis:** Electron POS (`apps/pos-desktop`) di-freeze per 2026-05-15. Web POS diimplementasi sebagai route group `(pos)` di dalam `apps/backoffice` — satu deployment, shared auth, pure online (tanpa offline capability di V1).

### Story 9.1: Web POS Authentication

As a Kasir,
I want login ke Web POS menggunakan username dan password,
So that saya bisa mengakses sistem kasir dari tablet atau HP saya.

**Acceptance Criteria:**

**Given** Kasir membuka URL `/pos/login` di browser
**When** mereka memasukkan kredensial yang valid
**Then** sistem mengarahkan mereka ke halaman utama POS (`/pos`)

**Given** Kasir login dengan role `KASIR`
**When** mereka mencoba mengakses halaman Backoffice (`/bo/*`)
**Then** sistem menolak akses dan mengarahkan kembali ke `/pos`

**Given** Kasir yang sudah login menutup browser dan membukanya kembali
**When** mereka mengunjungi `/pos`
**Then** session masih aktif selama cookie belum expired (tidak perlu login ulang)

**Technical Notes:**
- Gunakan auth middleware Next.js yang sudah ada di `apps/backoffice`
- Route group: `app/(pos)/` dengan layout terpisah dari `(dashboard)`
- Layout Web POS harus mobile/tablet-first (min touch target 44px, font lebih besar)
- Halaman `/pos/login` terpisah dari `/bo/login` tapi boleh share komponen form

### Story 9.2: Web POS Basic Sales Transaction

As a Kasir,
I want mencari produk, memasukkannya ke keranjang, dan menyelesaikan pembayaran,
So that saya dapat melayani pelanggan secara penuh dari perangkat web.

**Acceptance Criteria:**

**Given** Kasir berada di halaman utama POS (`/pos`)
**When** mereka mengetik nama atau SKU produk di kolom pencarian
**Then** daftar produk yang cocok muncul dalam waktu < 200ms

**Given** Kasir memilih produk dari hasil pencarian
**When** produk ditambahkan ke keranjang
**Then** keranjang menampilkan item, kuantitas, harga satuan, dan subtotal secara real-time

**Given** Kasir menekan tombol "Bayar"
**When** metode pembayaran dipilih dan jumlah dimasukkan
**Then** transaksi tersimpan ke server via `POST /api/pos/transactions`
**And** halaman menampilkan konfirmasi transaksi berhasil beserta nomor struk

**Given** transaksi berhasil
**When** Kasir menekan "Cetak Struk"
**Then** browser membuka print dialog dengan layout struk thermal

**Given** koneksi internet terputus saat Kasir mencoba checkout
**When** request ke server gagal
**Then** sistem menampilkan pesan error yang jelas dan kasir dapat mencoba ulang

**Technical Notes:**
- State keranjang: Zustand store (client component) — tidak ada persistensi lokal
- Pencarian produk: `GET /api/pos/products?q=` (API sudah tersedia)
- Checkout: `POST /api/pos/transactions` (API sudah tersedia)
- Layout tablet (≥768px): split-view — daftar produk di kiri, keranjang di kanan
- Layout mobile (<768px): bottom sheet untuk keranjang, full-screen untuk produk
- Semua kalkulasi finansial wajib menggunakan `big.js`

## Epic 10: Web POS Advanced Features (P1 — Web POS Continuation)

**Goal:** Kasir dapat melihat riwayat transaksi shift-nya, mencetak ulang struk, dan membatalkan transaksi yang salah dengan otorisasi PIN Owner — semua dari browser Web POS.

**Catatan Strategis:** Kelanjutan langsung dari Epic 9. Pure online — data diambil langsung dari server via API (tidak ada IndexedDB). Arsitektur identik dengan Epic 9: route group `(pos)` di `apps/backoffice`, Server Components + Client Components, mobile/tablet-first.

### Story 10.1: Web POS Transaction History & Reprint

As a Kasir,
I want melihat daftar transaksi yang sudah saya proses dalam shift aktif dan mencetak ulang struk,
So that saya bisa memverifikasi transaksi dan membantu pelanggan yang membutuhkan bukti pembayaran ulang.

**Acceptance Criteria:**

**Given** Kasir membuka halaman History di Web POS (`/pos/history`)
**When** halaman dimuat
**Then** sistem menampilkan daftar transaksi shift aktif, diurutkan terbaru di atas, memuat dalam < 3 detik

**Given** Kasir melihat daftar transaksi
**When** mereka menekan salah satu transaksi
**Then** tampil detail lengkap: nomor struk, tanggal/jam, daftar item (nama, qty, harga satuan, subtotal), metode pembayaran, dan grand total

**Given** Kasir berada di halaman detail transaksi
**When** mereka menekan tombol "Cetak Ulang Struk"
**Then** browser membuka print dialog dengan layout struk thermal yang identik dengan struk asli

**Technical Notes:**
- Route: `app/pos/(authenticated)/history/page.tsx` (Server Component)
- API: `GET /api/pos/transactions?shiftId={activeShiftId}` — query server langsung
- Print: gunakan komponen `ReceiptPrint` yang sudah ada dari Story 9.2
- Layout: list transaksi full-width, detail sebagai modal atau slide-over
- Mobile-first, min touch target 44px

### Story 10.2: Web POS History Search & Filter

As a Kasir,
I want mencari dan memfilter riwayat transaksi berdasarkan nomor struk atau rentang waktu,
So that saya bisa menemukan transaksi tertentu dengan cepat tanpa scroll panjang.

**Acceptance Criteria:**

**Given** Kasir berada di halaman History
**When** mereka mengetik nomor struk atau kata kunci di kolom pencarian
**Then** daftar transaksi difilter secara real-time, hasil muncul dalam < 200ms (client-side dari data yang sudah dimuat)

**Given** Kasir memilih filter tanggal
**When** mereka memilih rentang tanggal tertentu
**Then** sistem melakukan fetch ulang ke server dengan parameter tanggal, dan menampilkan transaksi dalam rentang tersebut

**Given** Kasir memilih filter "Shift ini"
**When** filter aktif
**Then** hanya transaksi dalam shift aktif yang ditampilkan (default view)

**Technical Notes:**
- Search: client-side filter dari data yang sudah di-load (sesuai NFR < 200ms)
- Date filter: server-side — fetch ulang dengan `?from=&to=` params
- Shift filter: gunakan `shiftId` dari context shift aktif (sudah ada dari halaman utama POS)
- Komponen filter: reuse pola dari Backoffice history jika memungkinkan

### Story 10.3: Web POS Void Transaction

As a Kasir,
I want membatalkan transaksi yang salah dengan otorisasi PIN Owner,
So that kesalahan input dapat dikoreksi tanpa merusak data finansial shift.

**Acceptance Criteria:**

**Given** Kasir melihat detail transaksi di halaman History
**When** mereka menekan tombol "Void Transaksi"
**Then** sistem menampilkan dialog konfirmasi dan kolom input PIN Owner

**Given** Kasir memasukkan PIN Owner yang benar
**When** mereka mengkonfirmasi void
**Then** sistem mengirim request `POST /api/pos/transactions/{id}/void` ke server
**And** transaksi ditandai sebagai `VOIDED` dan tidak bisa di-void ulang
**And** stok yang terkait dikembalikan secara otomatis oleh server

**Given** Kasir mencoba void transaksi dari shift yang sudah ditutup (status `SETTLED`)
**When** mereka menekan tombol "Void"
**Then** tombol tidak aktif (disabled) dan ditampilkan pesan "Transaksi dari shift yang sudah ditutup tidak dapat di-void dari POS. Gunakan Retur di Backoffice."

**Given** PIN Owner yang dimasukkan salah
**When** konfirmasi void dikirim
**Then** sistem menampilkan pesan error "PIN tidak valid" dan Kasir dapat mencoba ulang

**Technical Notes:**
- Validasi shift status: cek `shift.status !== 'OPEN'` sebelum izinkan tombol void
- PIN validation: `POST /api/pos/void/validate-pin` — server-side validation (tidak ada cached PIN di Web POS, berbeda dengan Electron)
- Void API: `POST /api/pos/transactions/{id}/void` — sudah ada dari Epic 4 Backoffice
- Setelah void berhasil: tampilkan opsi "Clone to Cart" — load item transaksi ke keranjang baru
- Clone to Cart: redirect ke `/pos` dengan cart pre-filled via Zustand store
