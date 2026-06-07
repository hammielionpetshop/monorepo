# Changelog

## [1.2.4] - 2026-06-08

### Added
- **Auto Pricing Multi-UOM**: saat user mengisi harga satu UOM pada tab Harga produk, harga UOM lain dalam tier yang sama otomatis dikalkulasi berdasarkan rasio konversi — berlaku dua arah (mengisi harga UOM besar menghitung UOM kecil, dan sebaliknya)

---

## [1.2.3] - 2026-06-08

### Added
- Field **Harga Modal Default** per produk (master data) — fallback HPP saat data FIFO batch belum tersedia
- Kolom `default_cost_price` di tabel `petshop.products` (migration `20260608000001`)
- Tampilkan **Harga Modal Default** di halaman detail produk — format Rupiah jika diisi, "Belum diatur" jika kosong

### Changed
- **Laporan Laba Rugi**: item transaksi dengan `cogs = NULL` kini diestimasikan menggunakan `defaultCostPrice × qty × ratio_ke_base` dari data produk, bukan dihitung sebagai 0
- **StockService.deductStock**: jika FIFO menghasilkan `totalCogs = 0` (batch tanpa harga modal), otomatis fallback ke `defaultCostPrice × baseQty` dari produk

---

## [1.2.2] - 2026-06-08

### Added
- Filter rentang tanggal cepat di halaman **Laporan Laba Rugi** — tombol shortcut: Hari Ini, Kemarin, Minggu Ini, Bulan Ini

---

## [1.2.1] - 2026-06-08

### Fixed
- Error `ERR_INVALID_ARG_TYPE` di halaman Mutasi Stok — parameter tanggal dikirim sebagai `Date` object ke Drizzle `sql` template, diperbaiki dengan menggunakan ISO string langsung

---

## [1.2.0] - 2026-06-08

### Added
- Halaman **Mutasi Stok** (`/inventory/stock-logs`) — riwayat komprehensif semua pergerakan stok dari 7 sumber: penjualan, void penjualan, penerimaan PO, penyesuaian manual, stock opname, pecah satuan (break), dan retur
- API `GET /api/bo/inventory/stock-logs` dengan filter cabang, jenis mutasi, rentang tanggal, dan pencarian produk
- Kolom tabel: Tanggal, Jenis Mutasi (badge warna), Produk, Cabang, Satuan, Qty (merah/hijau), Harga Satuan, Referensi, Petugas, Keterangan
- Link "Mutasi Stok" di sidebar navigasi backoffice

---

## [1.1.9] - 2026-06-08

### Fixed
- Error `trim is not a function` saat menyimpan harga tier di halaman detail produk — `price` dari API dikembalikan sebagai `number` bukan `string`, diperbaiki dengan konversi `String(entry.price)` saat data harga dimuat

---

## [1.1.8] - 2026-06-08

### Fixed
- Data duplikat di tabel `product_prices` — 3.209 baris duplikat dihapus, menyisakan harga terendah per kombinasi produk/cabang/satuan/tier
- Tambah unique constraint `product_prices_unique_tier` pada kolom `(product_id, branch_id, uom_id, tier_type)` untuk mencegah duplikat harga di masa depan

---

## [1.1.7] - 2026-06-07

### Fixed
- Cetak struk dari checkout menghasilkan 2 lembar — diperbaiki dengan menambahkan `print:hidden` pada success dialog dan menghapus `inset-0` (full-height) dari container receipt agar tinggi container menyesuaikan konten
- Cetak ulang struk dari halaman riwayat transaksi menghasilkan halaman kosong — diperbaiki dengan memindahkan `ReceiptPrint` ke luar wrapper `print:hidden` di `TransactionHistoryClient` agar tidak ter-hide saat print

---

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
