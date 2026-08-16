### Added
- Halaman Harga & Modal (`Master Data › Harga`): tombol **Ekspor** (CSV/XLSX) untuk mengunduh daftar harga per cabang, dan tombol **Impor** untuk memuat file XLSX/CSV massal dengan pratinjau sebelum diterapkan.
- Endpoint `GET /api/bo/master-data/prices/export?branchId&format=csv|xlsx&categoryId&search` — permission `master.price.manage`.
- Endpoint `POST /api/bo/master-data/prices/import/preview` (multipart) — mem-parsing file, validasi baris (match SKU dulu, fallback nama; deteksi ambigu, duplikat, satuan tanpa konversi), simpan sesi 15 menit, kembalikan pratinjau perubahan (insert/update/unchanged/rejected).
- Endpoint `POST /api/bo/master-data/prices/import/apply` — menerapkan perubahan yang sudah dipratinjau dalam **satu transaksi** (semua berhasil atau tidak sama sekali). Sel kosong pada file di-skip, autocalc antar UOM tidak dipicu oleh impor (literal).
- **Jejak audit perubahan harga.** Setiap penyimpanan harga — lewat grid Manajemen Harga maupun impor file — kini menulis satu baris `audit_logs` berisi nilai lama dan nilai baru per field, siapa pelakunya, dan nama file kalau dari impor (`PRICE_BULK_UPDATE` / `PRICE_IMPORT`). Sebelumnya `product_prices` sama sekali tidak punya riwayat: tidak ada `updated_at`, tidak ada trigger, sehingga pertanyaan "siapa yang mengembalikan harga ini ke nilai lama" tidak bisa dijawab.

### Changed
- `apps/backoffice/lib/services/price-service.ts` baru: ekstrak logika `applyPriceBulk` (dari PUT `/api/bo/master-data/prices`) supaya bisa dipakai ulang endpoint import + tetap dipakai endpoint edit lama.
- `applyPriceBulk` sekarang memotong INSERT per 500 baris **di dalam** transaksinya sendiri, bukan di pemanggil. Satu INSERT dengan puluhan ribu baris menembus batas 65.535 parameter Postgres, sementara pemanggil yang memotong per chunk meninggalkan impor separuh jadi kalau chunk di tengah gagal.

### Fixed
- `POST /api/bo/master-data/prices/import/preview` menolak `branchId` yang tidak ada (404). `product_prices.branch_id` tidak punya foreign key, jadi cabang ngawur sebelumnya menghasilkan baris harga yatim yang tidak muncul di cabang mana pun.
