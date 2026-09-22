### Added
- **Koreksi inline modal/unit batch stok di Laporan Nilai Stok.** Owner/GM sekarang bisa membetulkan modal satu batch langsung dari drill-down cabang → batch, tanpa raw SQL manual ke produksi.
  - Permission baru `inventory.stock_batch.correct_cost` (OWNER/GM), perlu di-seed manual ke produksi setelah rilis (`pnpm --filter @petshop/db db:seed-permissions`).
  - Setiap koreksi wajib diisi alasan dan tercatat di `audit_logs` (nilai lama & baru).
  - Qty sisa batch tetap read-only — koreksi qty tetap lewat Stock Adjustment supaya aggregate `product_stocks` tidak drift.
