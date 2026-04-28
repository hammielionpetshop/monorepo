---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation-skipped', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish']
classification:
  projectType: 'Desktop App & Web App'
  domain: 'Fintech / Retail'
  complexity: 'High'
  projectContext: 'brownfield'

inputDocuments: 
  - 'docs/progress-tracker.md'
  - 'docs/pos_prd_1/00-ai-directives.md'
  - 'docs/pos_prd_1/01-document-control.md'
  - 'docs/pos_prd_1/02-executive-summary.md'
  - 'docs/pos_prd_1/03-goals-and-metrics.md'
  - 'docs/pos_prd_1/04-user-personas.md'
  - 'docs/pos_prd_1/05-functional-requirements.md'
  - 'docs/pos_prd_1/05.1-multi-uom.md'
  - 'docs/pos_prd_1/05.10-stock-opname.md'
  - 'docs/pos_prd_1/05.11-purchase-order.md'
  - 'docs/pos_prd_1/05.2-pricing.md'
  - 'docs/pos_prd_1/05.3-fifo-costing.md'
  - 'docs/pos_prd_1/05.4-sales-transaction.md'
  - 'docs/pos_prd_1/05.6-settlement.md'
  - 'docs/pos_prd_1/05.7-customer-debt.md'
  - 'docs/pos_prd_1/05.8-discount-engine.md'
  - 'docs/pos_prd_1/05.9-daily-expenses.md'
  - 'docs/pos_prd_1/06-non-functional-requirements.md'
  - 'docs/pos_prd_1/07-database-schema.md'
  - 'docs/pos_prd_1/08-api-specifications.md'
  - 'docs/pos_prd_1/09-user-flows.md'
  - 'docs/pos_prd_1/10-business-rules.md'
  - 'docs/pos_prd_1/11-testing-requirements.md'
  - 'docs/pos_prd_1/12-user-stories.md'
  - 'docs/pos_prd_1/13-appendix.md'
  - 'docs/pos_prd_1/14-progress-tracker.md'
  - 'docs/pos_prd_1/README.md'
  - '_bmad-output/project-context.md'
workflowType: 'prd'
documentCounts:
  briefCount: 0
  researchCount: 0
  brainstormingCount: 0
  projectDocsCount: 28
---

# Product Requirements Document - hammielion-monorepo

**Author:** Cundus
**Date:** 2026-04-27

## Executive Summary

Hammielion POS adalah ekosistem Point-of-Sale hybrid (Electron Desktop + Next.js Backoffice) yang dirancang khusus untuk bisnis retail Petshop. Sistem ini menjawab masalah fundamental pemilik toko multi-cabang: **ketidakmampuan mengontrol stok dan cash flow secara real-time tanpa harus hadir secara fisik atau melakukan remote desktop ke setiap PC kasir.**

PRD ini mencakup fase-fase pengembangan yang belum dikerjakan dari roadmap Hammielion (Phase 6: Dashboard & Laporan, Phase 7: Offline Sync, serta fitur korektif seperti Void Transaksi dan History). Fokus utamanya adalah memberikan Owner **kendali penuh via sistem terpusat**, sementara Kasir mendapatkan **alur kerja yang efisien dan aman** untuk menangani kesalahan transaksi.

### What Makes This Special

- **Remote Authorization tanpa Remote Desktop:** Owner dapat menyetujui aksi-aksi kritis (Void, override harga) melalui mekanisme PIN dari Backoffice — menghilangkan kebutuhan untuk remote desktop ke PC kasir di cabang mana pun.
- **Void & Clone to Cart:** Strategi koreksi transaksi yang aman. Transaksi yang salah di-Void (bukan di-edit), lalu item otomatis dimuat kembali ke keranjang untuk diperbaiki dalam hitungan detik. Ini menjaga integritas FIFO Costing tanpa mengorbankan kecepatan kasir.
- **Settlement Lock:** Transaksi dalam shift yang sudah ditutup tidak dapat di-Void oleh Kasir. Koreksi pasca-settlement hanya dapat dilakukan melalui modul Retur di Backoffice dengan otorisasi Owner.
- **Keamanan PIN Offline-Cached:** PIN Owner disimpan sebagai salted-hash (dengan salt unik per perangkat) di database lokal terenkripsi, memungkinkan validasi otorisasi bahkan saat internet mati. DevTools dinonaktifkan di build produksi.

## Project Classification

| Aspek | Detail |
|---|---|
| **Tipe Proyek** | Desktop App (Electron POS) & Web App (Next.js Backoffice) |
| **Domain** | Fintech / Retail (Petshop) |
| **Kompleksitas** | Tinggi — FIFO Costing, Pessimistic Locking, Multi-UOM, Otorisasi PIN, Offline-first |
| **Konteks Proyek** | Brownfield — Melanjutkan dari Phase 5 (~70% selesai) |
| **Target Pengguna** | Owner Petshop (multi-cabang) & Kasir toko |

## Success Criteria

### User Success

- **Owner:** Dapat melihat laporan harian tanpa menelepon kasir. Dapat menyetujui aksi kritis (Void/override) dari Backoffice tanpa remote desktop. Tidak perlu membuat transaksi palsu untuk mengeluarkan missing stock dari sistem saat Stock Opname.
- **Kasir:** Proses koreksi transaksi yang sebelumnya membutuhkan ~5 menit (input ulang manual) menjadi ~10 detik (Void & Clone to Cart). Semua aktivitas tercatat dan terlacak.

### Business Success

- Selisih stok fisik vs sistem turun signifikan setelah fitur Stock Adjustment dan History diimplementasikan.
- Owner tidak perlu hadir di toko untuk urusan operasional rutin — cukup pantau dan kontrol via Backoffice.
- Semua aktivitas (penjualan, void, adjustment, pengeluaran) memiliki report yang lengkap dan dapat diaudit.

### Technical Success

- Waktu muat Dashboard dan Laporan < 3 detik.
- Aplikasi POS tetap berfungsi penuh saat koneksi internet terputus (Offline Sync).
- PIN Owner divalidasi secara offline menggunakan salted-hash dengan salt unik per perangkat.
- Zero data loss pada skenario offline → online sync.

### Measurable Outcomes

| Metrik | Target |
|---|---|
| Response time Dashboard/Laporan | < 3 detik |
| Koreksi transaksi (Void & Clone) | < 15 detik end-to-end |
| Downtime akibat internet mati | 0 — POS tetap beroperasi |
| Audit trail coverage | 100% aktivitas kritis tercatat |



## User Journeys

### Journey 1: Kasir Dewi — Mencari Transaksi yang Ditanyakan Pelanggan (History - Happy Path)

**Opening Scene:** Dewi, kasir shift siang di cabang Petshop "Hammielion Ragunan", sedang melayani pelanggan tetap bernama Pak Budi. Pak Budi bertanya, "Kemarin saya beli makanan kucing merk Royal Canin, tapi saya lupa berapa harganya. Bisa dicek?"

**Rising Action:** Dewi membuka menu **History Transaksi** di POS. Ia mengetik "Budi" di kolom pencarian, lalu memfilter berdasarkan tanggal kemarin. Daftar transaksi muncul dalam hitungan detik.

**Climax:** Dewi menemukan transaksi Pak Budi dan bisa melihat detail lengkap: item yang dibeli, jumlah, harga satuan, dan total. Pak Budi merasa puas karena informasinya akurat.

**Resolution:** Dewi kembali melayani antrean berikutnya tanpa perlu meninggalkan meja kasir atau menelepon Owner untuk mengecek catatan manual.

### Journey 2: Kasir Dewi — Internet Mati Saat Jam Sibuk (Offline Sync - Edge Case)

**Opening Scene:** Sabtu sore, jam paling ramai. Tiba-tiba internet mati karena gangguan provider. Layar POS menunjukkan ikon "Offline" di status bar.

**Rising Action:** Dewi tetap melanjutkan transaksi seperti biasa. Produk bisa dicari, harga muncul, dan struk tetap bisa dicetak. Semua data tersimpan di database lokal Electron.

**Climax:** Setelah 2 jam, internet pulih. Aplikasi secara otomatis mulai menyinkronkan seluruh transaksi yang terjadi selama offline ke server pusat. Tidak ada data yang hilang.

**Resolution:** Owner melihat di Backoffice bahwa data penjualan sore itu lengkap, meskipun ada gap waktu "offline". Laporan harian tetap akurat.

### Journey 3: Owner Hendra — Memantau Cabang dari Rumah (Admin/Operations)

**Opening Scene:** Hendra, pemilik 3 cabang Petshop Hammielion, sedang di rumah pada malam hari. Ia ingin mengetahui performa penjualan hari ini di ketiga cabang tanpa harus menelepon masing-masing kasir atau melakukan remote desktop.

**Rising Action:** Hendra membuka Backoffice di laptop. Dashboard menampilkan ringkasan penjualan, pengeluaran, dan status shift dari semua cabang. Ia melihat ada notifikasi bahwa cabang Ragunan sempat offline selama 2 jam tapi semua data sudah tersinkronisasi.

**Climax:** Hendra melihat bahwa total penjualan hari ini di semua cabang mencapai target, dan cash flow tercatat jelas tanpa ada selisih yang mencurigakan.

**Resolution:** Hendra merasa tenang dan bisa fokus pada hal lain. Tidak ada lagi kebutuhan untuk datang ke toko atau remote desktop hanya untuk mengecek angka harian.

### Journey 4: Kasir Dewi — Data Produk Berubah Saat POS Offline (Offline Sync - Conflict)

**Opening Scene:** Selama internet mati di cabang Ragunan, Owner Hendra mengubah harga Royal Canin 4kg dari Rp 250.000 menjadi Rp 265.000 via Backoffice. POS Ragunan belum menerima update ini.

**Rising Action:** Dewi menjual 3 unit Royal Canin 4kg dengan harga lama (Rp 250.000) selama offline. Saat internet pulih dan sinkronisasi berjalan, sistem mendeteksi bahwa transaksi terjadi dengan harga yang sudah tidak berlaku.

**Climax:** Sistem menyinkronkan transaksi dengan harga yang *digunakan saat transaksi terjadi* (Rp 250.000) — karena itu adalah harga yang sah pada saat penjualan. Harga baru (Rp 265.000) berlaku untuk transaksi selanjutnya. Sistem mencatat log bahwa ada 3 transaksi yang menggunakan harga sebelum update.

**Resolution:** Owner melihat di Backoffice bahwa ada 3 penjualan dengan harga lama beserta timestamp-nya. Tidak ada data yang perlu dikoreksi — sistem menghormati harga yang berlaku pada saat transaksi terjadi.

### Journey Requirements Summary

| Journey | Kapabilitas yang Dibutuhkan |
|---|---|
| **Kasir - History (Happy Path)** | UI History Transaksi, Pencarian & Filter, Detail Transaksi |
| **Kasir - Offline (Edge Case)** | Local DB (Dexie.js), Offline Detection, Auto-Sync, Status Indicator |
| **Owner - Remote Monitoring** | Backoffice Dashboard, Aggregasi Multi-Cabang, Notifikasi Sync Status |
| **Kasir - Sync Conflict** | Price-at-time-of-sale preservation, Sync Log, Owner Notification |

> **Catatan Arsitektur:** Stok bersifat independen per toko. Setiap cabang memiliki inventaris mandiri. Tidak ada shared stock pool antar cabang.

## Domain-Specific Requirements

### Kepatuhan & Regulasi

- **Pajak Penjualan:** Sistem harus mendukung perhitungan PPN 11% (atau tarif yang berlaku) pada item-item yang dikenakan pajak. Konfigurasi pajak harus bisa diubah tanpa coding.
- **Bukti Transaksi:** Struk thermal harus memenuhi standar bukti transaksi minimal (nama toko, NPWP, tanggal, detail item, total, metode pembayaran).

### Kendala Teknis

- **Keamanan Data Finansial:** Semua data transaksi dan keuangan harus terenkripsi saat disimpan lokal (at-rest) dan saat dikirim ke server (in-transit).
- **Audit Trail Lengkap:** Setiap mutasi stok dan keuangan wajib tercatat di log yang immutable (tidak bisa dihapus oleh siapa pun, termasuk Owner).
- **Presisi Desimal:** Seluruh perhitungan finansial wajib menggunakan `big.js` untuk menghindari floating-point error.
- **Pessimistic Locking:** Setiap mutasi stok harus menggunakan `.for('update')` dalam transaksi Drizzle.

### Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Stok negatif akibat race condition | Pessimistic locking pada setiap mutasi stok |
| Kehilangan data saat offline | Local DB (Dexie.js) + Auto-sync dengan retry mechanism |
| PIN Owner bocor | Salted-hash + device-unique salt + brute-force delay |
| Manipulasi data oleh kasir | DevTools disabled di produksi + Immutable audit log |
| Floating-point error pada HPP/COGS | Wajib `big.js` untuk semua kalkulasi finansial |

## Desktop App & Web App — Specific Requirements

### Project-Type Overview

Hammielion adalah sistem hybrid: **Electron POS (Desktop)** sebagai titik penjualan di toko, dan **Next.js Backoffice (Web App)** sebagai pusat kontrol Owner. Keduanya terhubung melalui API server yang sama namun beroperasi secara independen.

### Technical Architecture — Desktop App (Electron POS)

- **Platform:** Windows 10/11 (x64) only.
- **Auto-Update:** Otomatis tanpa intervensi user menggunakan `electron-updater`. Update diunduh di background dan diterapkan saat aplikasi restart.
- **Offline Capability:** Tidak terbatas. POS harus beroperasi penuh tanpa batas waktu tanpa koneksi internet. Sinkronisasi dilakukan otomatis saat koneksi pulih dengan retry mechanism.
- **Local Database:** Dexie.js (IndexedDB) sebagai penyimpanan lokal. Data dienkripsi at-rest.
- **System Integrations:**
  - **Printer Thermal:** USB/LAN untuk cetak struk (sudah ada).
  - **Barcode Scanner:** Input via keyboard emulation (HID). Tidak perlu driver khusus.
  - **Cash Drawer:** Trigger via printer thermal (ESC/POS command) atau port COM langsung.
- **Security:** DevTools dinonaktifkan di build produksi. `nodeIntegration: false`, `contextIsolation: true`.

### Technical Architecture — Web App (Next.js Backoffice)

- **Browser Support:** Modern browsers only (Chrome/Edge/Firefox terbaru). Tidak perlu mendukung IE atau browser lama.
- **Responsivitas:** **"Mobile-first for Monitoring, Desktop-first for Management"**:
  - ✅ **Dioptimalkan untuk HP:** Dashboard ringkasan, notifikasi sync, History transaksi, approval Void.
  - ⚠️ **Desktop only:** Manajemen produk/stok, konfigurasi sistem, laporan detail, Stock Opname.
- **Data Refresh:** Manual refresh untuk saat ini. Dapat ditingkatkan ke polling di fase berikutnya.
- **Authentication:** Session-based dengan role (Owner, Manager, Kasir). Akses Backoffice dibatasi hanya untuk Owner dan Manager.

### Implementation Considerations

- Shared logic (perhitungan FIFO, validasi bisnis) harus berada di `@petshop/shared` agar bisa digunakan oleh POS dan Backoffice.
- API endpoint harus mendukung payload sinkronisasi batch (banyak transaksi sekaligus saat online kembali).
- Konflik sinkronisasi menggunakan strategi **"last-write-wins untuk harga, server-wins untuk stok"**.

## Product Scope & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Problem-solving MVP — menyelesaikan masalah operasional kritis yang sudah teridentifikasi pada sistem yang berjalan (~70% complete).
**Timeline Target:** 1 minggu (dengan bantuan AI agent + human testing).

**Prasyarat MVP (Bug Fix — Harus Selesai Lebih Dulu):**
- **Fix Bootstrap Sync:** API bootstrap sudah ada, namun data belum tersimpan dengan benar di Dexie.js lokal. Ini adalah blocker utama untuk kedua fitur MVP.

### MVP Feature Set (Phase 6 — 1 Minggu)

**Core User Journeys yang Didukung:**
- Kasir mencari transaksi lama dari data lokal perangkat.
- POS beroperasi penuh saat internet mati dan sync otomatis saat online.

**Must-Have Capabilities:**

| # | Fitur | Catatan |
|---|---|---|
| 0 | **Fix Bootstrap Sync** | Prasyarat — data produk/harga/stok tersimpan benar di Dexie.js |
| 1 | **History Transaksi (POS)** | Tampilkan transaksi dari data lokal. Filter per tanggal dan shift. Detail per transaksi. |
| 2 | **Offline Detection & Indicator** | Status bar menampilkan ikon online/offline secara real-time |
| 3 | **Offline Transaction Queue** | Transaksi yang dibuat saat offline masuk ke antrian lokal |
| 4 | **Auto-Sync on Reconnect** | Kirim antrian transaksi ke server otomatis saat koneksi pulih. Retry jika gagal. |

### Post-MVP Features (Growth — Phase 7+)

**Fase Berikutnya (Setelah MVP Stabil):**

| # | Fitur | Dependency |
|---|---|---|
| 1 | **Void & Clone to Cart** | Membutuhkan History Transaksi (MVP) sebagai UI entry point |
| 2 | **Dashboard Ringkasan Harian** | Membutuhkan data sync yang stabil (MVP) |
| 3 | **Laporan Laba Rugi** | Membutuhkan Dashboard |
| 4 | **Laporan Stok (FIFO Valuasi)** | Membutuhkan data sync yang stabil |
| 5 | **Stock Adjustment (tanpa transaksi)** | Membutuhkan Laporan Stok |
| 6 | **Retur Pasca-Settlement (Backoffice)** | Membutuhkan Void & Clone |

### Vision (Future)

| # | Fitur |
|---|---|
| 1 | Hutang Pelanggan |
| 2 | Discount Engine |
| 3 | Multi-Cabang Terpusat (Dashboard Agregasi) |

### Risk Mitigation Strategy

| Risiko | Mitigasi |
|---|---|
| **Teknis:** Bootstrap fix lebih kompleks dari perkiraan | Isolasi bug di layer Dexie.js dulu sebelum menyentuh sync logic |
| **Teknis:** Offline queue bertabrakan dengan data server saat sync | Gunakan `price-at-time-of-sale` preservation — server menerima semua transaksi offline |
| **Resource:** Waktu 1 minggu terlalu singkat | Prioritas: Fix bootstrap → History UI → Offline indicator → Auto-sync |

## Functional Requirements

### Synchronization & Offline Operations (MVP)
- FR1: Sistem (POS) dapat mendeteksi status koneksi internet dan menampilkannya kepada Kasir secara real-time.
- FR2: Sistem (POS) dapat beroperasi penuh (mencari produk, menambah ke keranjang, proses pembayaran, cetak struk) tanpa koneksi internet.
- FR3: Sistem (POS) dapat mengunduh seluruh data master (produk, harga, stok, pengaturan pajak) dari server dan menyimpannya ke database lokal dengan benar saat awal inisialisasi (Bootstrap).
- FR4: Sistem (POS) dapat menyimpan transaksi yang terjadi saat offline ke dalam antrean lokal.
- FR5: Sistem (POS) dapat secara otomatis menyinkronkan antrean transaksi lokal ke server pusat saat koneksi internet pulih.
- FR6: Sistem (Server) dapat menerima sinkronisasi transaksi offline dan menyimpan data transaksi dengan menggunakan harga yang berlaku saat transaksi tersebut terjadi.
- FR7: Sistem (Server) dapat memperbarui data stok berdasarkan urutan waktu transaksi yang masuk.

### Transaction History & Viewing (MVP)
- FR8: Kasir dapat melihat daftar riwayat transaksi yang terjadi pada perangkat lokal.
- FR9: Kasir dapat mencari riwayat transaksi berdasarkan kata kunci tertentu (misal: nama pelanggan).
- FR10: Kasir dapat memfilter riwayat transaksi berdasarkan tanggal.
- FR11: Kasir dapat memfilter riwayat transaksi berdasarkan shift operasional.
- FR12: Kasir dapat melihat detail lengkap dari sebuah transaksi (item, jumlah, harga satuan, pajak, total, metode pembayaran).
- FR13: Kasir dapat mencetak ulang struk dari riwayat transaksi yang sudah selesai.

### Transaction Correction (Post-MVP)
- FR14: Kasir dapat membatalkan (Void) sebuah transaksi melalui otorisasi PIN Owner.
- FR15: Kasir dapat menggunakan fitur "Clone to Cart" pada transaksi yang di-void untuk mengulang pesanan dengan modifikasi.
- FR16: Sistem (POS) dapat mencegah pembatalan transaksi (Void) untuk transaksi yang berada di shift yang sudah ditutup (Settled).
- FR17: Owner dapat melakukan koreksi/retur transaksi pasca-settlement melalui Backoffice.

### Reporting & Analytics (Post-MVP)
- FR18: Owner dapat melihat ringkasan harian (penjualan, pengeluaran, status shift) dari seluruh cabang melalui Dashboard Backoffice.
- FR19: Owner dapat menerima notifikasi terkait status sinkronisasi cabang yang sempat offline.
- FR20: Owner dapat melihat laporan detail laba rugi per cabang atau agregasi.

### Inventory Management (Post-MVP)
- FR21: Owner dapat melihat laporan nilai stok berbasis metode FIFO.
- FR22: Owner dapat melakukan penyesuaian stok (Stock Adjustment) mandiri tanpa harus melalui transaksi penjualan/pembelian.

## Non-Functional Requirements

### Performance
- **NFR-P1 (Search Responsiveness):** Pencarian produk dan pencarian riwayat transaksi di POS harus menampilkan hasil awal dalam waktu **kurang dari 200 milidetik** setelah *keystroke* terakhir (seperti yang diharapkan untuk pengalaman *as-you-type* lokal).
- **NFR-P2 (Report Load Time):** Dashboard Backoffice dan Laporan History harus memuat data dalam waktu **kurang dari 3 detik** pada koneksi internet standar.

### Reliability & Availability
- **NFR-R1 (Offline Uptime):** Kemampuan POS untuk memproses transaksi penjualan tidak boleh terputus meskipun internet mati. POS harus mencapai **100% ketersediaan operasional** untuk fungsi kasir utama.
- **NFR-R2 (Sync Retry Logic):** Jika koneksi gagal saat proses auto-sync, sistem harus melakukan *retry* otomatis secara eksponensial (misal: 1 menit, 2 menit, 5 menit) tanpa memerlukan intervensi kasir.

### Security & Data Integrity
- **NFR-S1 (Data at Rest):** Seluruh database lokal (Dexie.js) di perangkat POS yang menyimpan transaksi offline dan stok wajib dienkripsi (misal: AES-256) agar tidak bisa dibaca oleh *tools* eksternal.
- **NFR-S2 (PIN Security):** PIN otorisasi Owner harus divalidasi secara lokal menggunakan metode *salted hash* (misal: bcrypt/Argon2) dengan *salt* yang spesifik per perangkat, bukan menyimpan plain-text.
- **NFR-S3 (Financial Precision):** Seluruh kalkulasi finansial dan pajakan wajib dihitung tanpa error *floating-point* (deviasi Rp 0), dibuktikan dengan penggunaan library `big.js` atau setara secara komprehensif di seluruh layer logika transaksi.

