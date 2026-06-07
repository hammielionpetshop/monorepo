# Changelog

## [1.1.6] - 2026-06-07

### Fixed
- OWNER/GM di Web POS terus diredirect balik ke halaman pilih cabang setelah memilih cabang — diganti dari `router.push` ke `window.location.href` agar Next.js router cache tidak serve redirect lama sebelum cookie `posBranchId` ter-set

---

## [1.1.5] - 2026-06-07

### Added
- Tombol "Dashboard" di header Web POS untuk navigasi kembali ke dashboard backoffice — hanya tampil untuk role OWNER dan GM

---

## [1.1.4] - 2026-06-07

### Fixed
- Stok produk di Web POS tidak berkurang setelah transaksi selesai (stale state) — daftar produk kini di-refresh otomatis dari server setelah tombol "Transaksi Baru" diklik

---

## [1.1.3] - 2026-06-07

### Fixed
- Stok produk di daftar produk POS tidak berkurang setelah transaksi selesai (stale state) — daftar produk kini di-refresh otomatis dari Dexie setelah pengurangan stok lokal berhasil

---

## [1.1.2] - 2026-06-07

### Added
- `CLAUDE.md` di root monorepo — dokumentasi arsitektur, tech stack, konvensi kode, dan aturan wajib untuk mempercepat development dengan Claude Code
- Hook otomatis di `.claude/settings.json` — mengingatkan update `CHANGELOG.md` setiap kali ada perubahan file kode

---

## [1.1.1] - 2026-06-07

### Added
- Tombol **+ Buat satuan baru** di form tambah konversi UOM pada halaman detail produk — pengguna dapat membuat satuan ukur baru langsung dari halaman `/master-data/products/:id` tanpa perlu berpindah ke halaman Master Satuan

---

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
