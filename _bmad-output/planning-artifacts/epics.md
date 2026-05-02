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
FR8: Epic 2 - Lihat daftar riwayat transaksi
FR9: Epic 3 - Cari riwayat berdasarkan nama
FR10: Epic 3 - Filter riwayat berdasarkan tanggal
FR11: Epic 3 - Filter riwayat berdasarkan shift
FR12: Epic 2 - Lihat detail transaksi
FR13: Epic 2 - Cetak ulang struk
FR14: Epic 4 - Void transaksi dengan PIN
FR15: Epic 4 - Clone to Cart
FR16: Epic 4 - Cegah void di shift tertutup
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
