# Changelog

## [1.1.0] - 2026-06-07

### Added
- Branch isolation untuk Web POS — OWNER, GM, dan MANAGER kini dapat memilih cabang saat membuka POS melalui halaman `/pos/select-branch`
- Tombol **Ganti Cabang** di header POS untuk berpindah cabang tanpa logout
- Endpoint `GET /api/pos/branches` dan `POST /api/pos/set-branch` untuk manajemen sesi cabang aktif
- Helper `lib/pos-branch.ts` dengan fungsi `getPosBranchId()` dan `getPosBranchName()` yang dipakai di seluruh halaman POS
- Filter **Cabang** di halaman Riwayat Shift (hanya tampil untuk OWNER/GM)
- Filter **Cabang** di halaman Riwayat Penyesuaian Stok (hanya tampil untuk OWNER)
- Dropdown **Cabang** di halaman Penyesuaian Stok — OWNER dapat menyesuaikan stok untuk cabang manapun
- Endpoint `GET /api/bo/inventory/stock-adjustment?branchId=` untuk memuat ulang produk saat cabang diganti
- Komponen reusable `ProductSelect` dengan fitur pencarian client-side (filter nama & SKU)
- Halaman Changelog ini

### Fixed
- MANAGER kini hanya dapat melihat Stock Opname pending milik cabang sendiri (sebelumnya dapat melihat semua cabang)
- OWNER/GM/MANAGER yang login via `/pos/login` diarahkan ke halaman pilih cabang, bukan ke `/dashboard`

### Changed
- Seluruh halaman POS (`shift`, `page`, `settlement`, `history`, `receiving`) kini membaca `branchId` dari cookie `posBranchId` untuk OWNER/GM/MANAGER, bukan dari JWT

---

## [1.0.0] - 2026-05-21

### Added
- Rilis pertama sistem backoffice dan Web POS Hammielion
- Manajemen produk, kategori, brand, dan satuan ukur
- Manajemen stok: stock adjustment dan stock opname
- Purchase orders dan penerimaan barang
- Manajemen shift kasir dan settlement
- Laporan laba rugi dan nilai stok
- Sistem retur transaksi
- Audit log aktivitas pengguna
- Manajemen pengguna dan cabang
- Web POS dengan transaksi, open bill, dan void
