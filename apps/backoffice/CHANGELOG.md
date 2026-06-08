# Changelog

## [1.2.20] - 2026-06-09

### Fixed
- Hapus import `useSearchParams` dan penggunaan variabel `searchParams` yang tidak terpakai di `transaction-list-client.tsx` — menghilangkan TypeScript error "declared but its value is never read".

---

## [1.2.19] - 2026-06-09

### Added
- **Halaman Riwayat Transaksi** (`/transactions`): Daftar semua transaksi penjualan dengan server-side pagination (20 per halaman).
  - Filter: No. Transaksi (search), Status (COMPLETED/PENDING_VOID/VOIDED), rentang tanggal, dan pilihan cabang (khusus OWNER/GM).
  - Role gate cabang: KASIR otomatis terkunci ke cabang sendiri; OWNER/GM bisa lihat semua cabang.
  - Kolom tabel: No. Transaksi, Tanggal, Cabang, Kasir, Customer, Metode Bayar, Total, Status (badge warna), Aksi.
  - Status badge: Selesai = hijau, Dibatalkan = merah, Menunggu Void = kuning.
  - Tombol "Ajukan Void" muncul hanya untuk transaksi berstatus COMPLETED — membuka modal konfirmasi dengan input alasan.
  - Setelah void request berhasil, status baris di-update ke PENDING_VOID tanpa reload halaman.
  - Filter dan pagination disimpan di URL query params (bookmarkable).
- **API `GET /api/bo/transactions`**: Query dengan pagination, filter multi-kriteria, dan agregasi metode pembayaran per transaksi (dipisah koma).
- **API `POST /api/bo/transactions/[trxNumber]/void-request`**: Insert ke `voidRequests` dengan status PENDING; validasi transaksi harus COMPLETED dan belum ada void request PENDING.
- **Sidebar**: Tambah link "Transaksi" di section Manajemen.

---

## [1.2.18] - 2026-06-09

### Added
- **Hutang/Piutang Customer**: Tambah section "Hutang / Piutang" di halaman detail customer, hanya tampil untuk role OWNER, GM, MANAGER, dan FINANCE.
  - Summary bar total outstanding (hutang UNPAID + PARTIAL yang belum lunas).
  - Tabel hutang dengan kolom No. Transaksi, Tanggal, Total Hutang, Sudah Dibayar, Sisa, Status (badge UNPAID=merah / PARTIAL=kuning / PAID=hijau).
  - Tombol "Catat Pembayaran" per baris hutang yang belum lunas — membuka modal form dengan input nominal (wajib, validasi max = sisa hutang), metode pembayaran (dropdown dari tabel `paymentMethods`), dan keterangan (opsional).
  - API endpoint `POST /api/bo/customers/[id]/debts/[debtId]/pay` — mencatat `debtPayments`, update `paidAmount`, `remainingAmount`, dan status hutang (PARTIAL/PAID) dalam satu transaksi DB.

---

## [1.2.17] - 2026-06-09

### Added
- **Halaman Detail Customer**: Tambah halaman `/master-data/customers/[id]` yang menampilkan info lengkap customer (Kode, Nama, Telepon, Email, Alamat, Status, Tanggal daftar) beserta tabel riwayat transaksi (No. Transaksi, Tanggal, Total, Status) — 50 transaksi terbaru, diurutkan dari yang terbaru.
- **Tabel Customer — tombol Detail**: Tambah link "Detail" di kolom Aksi pada tabel daftar customer, mengarah ke halaman detail masing-masing customer.

---

## [1.2.16] - 2026-06-09

### Added
- **Web POS — Quick-add customer baru dari dialog pencarian**: Ketika hasil pencarian kosong, muncul tombol "+ Tambah '[nama]' sebagai customer baru". Klik tombol tersebut membuka form inline di dalam dialog dengan field Nama (wajib, pre-filled dari query) dan Telepon (opsional). Submit langsung POST ke `/api/bo/customers`, dan jika sukses customer otomatis terpilih di cart tanpa perlu search ulang.

---

## [1.2.15] - 2026-06-09

### Added
- **Halaman Master Data Customer**: Tambah halaman `/master-data/customers` dengan fitur CRUD lengkap — tabel daftar customer (kolom Kode, Nama, Telepon, Email, Status), pencarian client-side by nama/kode/telepon, form tambah/edit via modal dialog, konfirmasi sebelum hapus, dan badge status Aktif/Nonaktif.
- **Sidebar — entry Customer**: Tambah link "Customer" di section Master Data pada sidebar navigasi.

---

## [1.2.14] - 2026-06-09

### Fixed
- **API Customer** — perbaiki TypeScript error: ganti `z.string().email()` (deprecated di Zod v4) ke `z.email()` di `route.ts` dan `[id]/route.ts`; ubah parameter `req` yang tidak dipakai di handler DELETE menjadi `_req`.

---

## [1.2.13] - 2026-06-09

### Added
- **API Customer — CRUD lengkap**: Tambah dua route baru untuk manajemen customer.
  - `GET /api/bo/customers` — list semua customer, support query param `q` (search by name/phone/code) dan `isActive` filter. Semua role boleh akses.
  - `POST /api/bo/customers` — buat customer baru. Auto-generate kode `CST-XXXXXX` jika tidak diisi. Role: Owner, GM, Manager, Finance.
  - `PUT /api/bo/customers/[id]` — edit customer, cek duplikat kode. Role: Owner, GM, Manager.
  - `DELETE /api/bo/customers/[id]` — hapus permanen, ditolak jika customer punya riwayat transaksi. Role: Owner, GM.

---

## [1.2.12] - 2026-06-09

### Added
- **DB Schema — kolom `code` pada tabel `customers`**: Tambah kolom `code VARCHAR(20) UNIQUE` (nullable) untuk menyimpan kode pelanggan, baik yang di-generate otomatis maupun diisi manual.

---

## [1.2.11] - 2026-06-08

### Changed
- **POS — UOM selector hanya tampilkan UOM yang punya harga di branch aktif**: Pilihan satuan (UOM) pada produk kini difilter berdasarkan entry harga yang tersedia di branch tersebut. UOM tanpa harga tidak akan muncul di selector. Efeknya, setiap branch bisa mengontrol UOM mana yang bisa dipilih kasir cukup dengan mengisi atau tidak mengisi harga untuk UOM tersebut.

---

## [1.2.10] - 2026-06-08

### Fixed
- **POS Produk — stok & harga salah untuk Owner di branch non-HQ**: API `/api/pos/products` mengambil `branchId` dari JWT payload (selalu HQ untuk Owner), sehingga stok dan harga produk yang ditampilkan adalah milik HQ bukan cabang yang dipilih. Diperbaiki dengan menggunakan `getPosBranchId()` yang membaca cookie `posBranchId` untuk role multi-branch (OWNER, GM, MANAGER).

---

## [1.2.9] - 2026-06-08

### Fixed
- **POS Open Shift — list kasir kosong untuk Owner di branch non-HQ**: API `/api/pos/users` sebelumnya memfilter semua user berdasarkan `branchId` di record mereka, sehingga Owner (yang hanya punya satu `branchId` = HQ) tidak muncul saat membuka shift di cabang lain. Query diubah agar KASIR dan MANAGER tetap difilter per cabang, sedangkan OWNER ditampilkan untuk semua cabang tanpa filter branch.
- Tambahkan filter `users.isActive = true` pada query yang sama agar user yang sudah dinonaktifkan tidak muncul di daftar kasir shift.

---

## [1.2.8] - 2026-06-08

### Added
- **Navigation Progress Bar**: top loading bar tipis (3px) yang muncul otomatis saat navigasi antar halaman berlangsung
  - Muncul segera saat user mengklik link internal
  - Animasi progres bertahap secara acak hingga 90%, lalu selesai ke 100% saat halaman baru sudah dirender
  - Warna mengikuti `--primary` (amber brand color), dengan efek glow
  - Aksesibel via `role="progressbar"` dan `aria-label`
  - Implementasi tanpa library tambahan menggunakan `usePathname` dari `next/navigation`

---

## [1.2.7] - 2026-06-08

### Added
- **Batalkan Penerimaan PO**: endpoint `POST /api/bo/purchase-orders/[id]/reverse-receiving` untuk membatalkan penerimaan barang yang sudah di-approve
  - Hanya dapat dilakukan oleh role **OWNER** atau **GM** dengan verifikasi PIN Owner
  - Stok yang sebelumnya masuk dari approve-receiving akan dipotong kembali via FIFO
  - Hutang supplier (`supplier_payables`) dihapus jika masih berstatus `UNPAID` dan belum ada pembayaran
  - Diblokir jika hutang supplier sudah dibayar sebagian atau penuh
  - Status PO dikembalikan ke `PARTIALLY_RECEIVED`
  - Seluruh aksi dicatat di `audit_logs` dengan action `PO_RECEIVING_REVERSED`

---

## [1.2.6] - 2026-06-08

### Added
- **Batalkan Retur**: endpoint `POST /api/bo/retur/[returnId]/cancel` untuk membatalkan retur yang sudah diproses
  - Hanya dapat dilakukan oleh role **OWNER** dengan verifikasi PIN
  - Stok yang sebelumnya dikembalikan oleh retur akan dipotong kembali via FIFO
  - Retur ditandai soft-delete (`cancelled_at`, `cancelled_by_id`, `cancel_reason`) — data tetap tersimpan untuk audit trail
  - Qty retur yang sudah dibatalkan tidak dihitung lagi sebagai "sudah diretur" pada transaksi asal
- Migration `20260608000003`: tambah kolom `cancelled_at`, `cancelled_by_id`, `cancel_reason` pada tabel `petshop.returns`

---

## [1.2.5] - 2026-06-08

### Changed
- **Stock Adjustment**: saat penambahan stok, selalu membuat batch FIFO baru (bukan menambah ke batch lama) agar cost tracking tetap akurat
- **Stock Adjustment**: tambah input opsional **Harga Beli per Unit (HPP)** yang muncul saat qty baru lebih besar dari stok saat ini — nilai diteruskan ke batch baru sebagai `costPrice`

---

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
