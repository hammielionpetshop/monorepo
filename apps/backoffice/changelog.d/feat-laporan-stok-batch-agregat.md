### Added
- **Halaman "Ringkasan Stok per Produk" (`/reports/stock-overview`).** Menampilkan stok & nilai FIFO diagregasi lintas cabang (satu baris per produk, bukan per produk×cabang), termasuk jumlah cabang, jumlah batch aktif, dan total utang stok (oversell) yang masih terbuka. Klik baris untuk lihat breakdown per cabang, lalu per batch (kode batch, PO asal, qty diterima/sisa, harga modal, tanggal masuk/kedaluwarsa). Diakses lewat tombol "Ringkasan per Produk" di halaman Laporan Nilai Stok FIFO. Dibatasi untuk role Owner, GM, dan Manager lewat permission baru `report.stock_overview.view` — **perlu di-seed manual ke produksi setelah deploy** (`pnpm db:seed-permissions`), pipeline tidak menjalankan seed otomatis.
- **Kode batch & link PO pada `product_stock_batches`.** Batch stok sekarang dapat kode tampilan `BTC-YYYYMMDD-NNNN` (mirip nomor PO) dan, khusus batch dari penerimaan PO, tertaut ke PO asalnya. Batch lama (sebelum migrasi ini) tetap tanpa kode/link — ditampilkan sebagai "Batch #\<id\>".

### Changed
- Migrasi `0022_batch_code_po_link`: tambah kolom nullable `batch_code` dan `purchase_order_id` ke `product_stock_batches`.
