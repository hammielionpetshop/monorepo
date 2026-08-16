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
- Ekspor CSV memberi awalan apostrof pada sel yang diawali `=` `+` `-` `@` supaya Excel memperlakukannya sebagai teks, bukan rumus — mengikuti pola ekspor laporan lain. Parser impor membuang awalan itu lagi, jadi file hasil ekspor tetap bisa diimpor balik apa adanya.
- `xlsx` dipasang dari rilis resmi SheetJS (`cdn.sheetjs.com`, 0.20.3), bukan dari npm. Versi terakhir yang terbit di npm (0.18.5) punya kerentanan prototype pollution (CVE-2023-30533) dan ReDoS (CVE-2024-22363) yang perbaikannya tidak pernah dirilis ke npm — padahal paket ini mem-parsing berkas unggahan pengguna.
- `argon2` dipin ke `0.44.0` (sebelumnya `latest` di `apps/backoffice` dan `packages/db`). Versi 0.45.1 tidak punya binary prebuilt yang cocok untuk `node:20-bookworm-slim`, jadi ia dikompilasi dari sumber dan gagal karena image itu tanpa Python — `pnpm install` siapa pun bisa merusak image produksi tanpa mengubah satu baris kode.
