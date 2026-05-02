# Epic 5 Context: Enterprise Dashboard & Reporting

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Memungkinkan Owner untuk memantau performa bisnis (penjualan, profit) dan kesehatan operasional (status offline) dari seluruh cabang secara terpusat melalui Backoffice, sehingga Owner tidak perlu hadir secara fisik atau melakukan remote desktop ke cabang untuk mengetahui angka harian.

## Stories

- Story 5.1: Daily Summary Dashboard
- Story 5.2: Offline Branch Notification
- Story 5.3: Profit and Loss Report
- Story 5.4: FIFO Stock Valuation Report

## Requirements & Constraints

- **Performance**: Dashboard dan Laporan harus memuat data dalam waktu < 3 detik (NFR-P2).
- **Financial Precision**: Seluruh kalkulasi finansial (Pendapatan, HPP, Laba Kotor) WAJIB menggunakan `big.js` untuk menghindari floating-point error (NFR-S3).
- **Localization**: Semua pesan kesalahan dan tampilan angka harus menggunakan Bahasa Indonesia dan format Rupiah (IDR).
- **Real-time Monitoring**: Dashboard harus menampilkan metrik agregat hari ini mencakup Total Pendapatan, Jumlah Transaksi, dan Estimasi Laba Kotor.
- **Sync Awareness**: Sistem harus memberikan notifikasi jika cabang offline lebih dari durasi wajar atau memiliki transaksi yang belum tersinkronisasi.

## Technical Decisions

- **Framework**: Menggunakan Next.js 15 (App Router) dengan Tailwind CSS 4 dan Radix UI.
- **Data Access**: Menggunakan Server Components secara default untuk fetching data dan Drizzle ORM untuk akses database.
- **Precision Enforcement**: Kalkulasi dilakukan di layer service menggunakan `big.js` sebelum dikonversi menjadi string untuk disimpan atau ditampilkan.
- **Responsive Strategy**: 
    - **Mobile-first**: Dashboard ringkasan, notifikasi sync, dan persetujuan aksi kritis.
    - **Desktop-first**: Laporan detail dan manajemen data intensif.

## UX & Interaction Patterns

- **Theme Support**: Harus mendukung Light dan Dark Mode secara konsisten menggunakan variabel CSS dari `globals.css` (e.g., `--background`, `--foreground`).
- **Data Presentation**: Menggunakan tabel untuk laporan detail dengan baris TOTAL yang ditekankan (bold).
- **Exporting**: Laporan harus dapat diekspor ke format CSV (dan direncanakan PDF di masa depan).

## Cross-Story Dependencies

- **Data Stability**: Story 5.1, 5.2, dan 5.3 bergantung pada stabilitas sinkronisasi data dari Epic 1 (Offline Sync).
- **Financial Baseline**: Laporan Laba Rugi (5.3) menggunakan data pendapatan dan HPP yang dihasilkan dari transaksi yang tersinkronisasi secara akurat.
