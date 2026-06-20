<!-- markdownlint-disable MD013 MD024 -->

# Changelog

## [1.4.0] - 2026-06-19

### Added
- **Master Data Supplier — CRUD lengkap:** halaman `/master-data/suppliers` untuk mengelola daftar supplier.
  - Tabel menampilkan nama, kontak, telepon, email, dan termin pembayaran.
  - Form tambah/edit di modal dengan field: nama, nama kontak, telepon, email, rekening bank, alamat, dan termin pembayaran (hari).
  - Konfirmasi hapus; supplier yang memiliki riwayat purchase order tidak dapat dihapus.
  - API route `GET/POST /api/bo/master-data/suppliers` dan `PUT/DELETE /api/bo/master-data/suppliers/[id]` dengan auth, validasi Zod, dan cek duplikat nama.
  - Hanya role Owner dan GM yang dapat menambah, mengubah, atau menghapus supplier.

## [1.3.0] - 2026-06-13

### Added
- **Utang Piutang Customer — penjualan kredit & laporan piutang:** fitur hutang customer kini berfungsi penuh dari hulu ke hilir.
  - **Pembuatan hutang terpusat:** `TransactionService.createTransaction` otomatis mencatat `customer_debts` ketika ada baris pembayaran bertipe `DEBT`. Karena Bulk Sale, POS online, dan POS offline-sync semua memakai service ini, ketiganya langsung mendukung penjualan kredit.
  - **Bulk Sale:** opsi "Penjualan Kredit (Hutang)" dengan uang muka (DP) opsional dan tanggal jatuh tempo. Sisa setelah DP dicatat sebagai hutang.
  - **POS:** memilih metode pembayaran "Hutang" mencatat seluruh total sebagai hutang (wajib pilih customer, jatuh tempo opsional).
  - **Input hutang manual:** endpoint `POST /api/bo/customers/[id]/debts` dan tombol "Tambah Hutang Manual" di halaman detail customer untuk mencatat hutang tanpa transaksi (mis. saldo awal piutang).
  - **Laporan Piutang terpusat:** halaman `/reports/receivables` (menu Laporan → Piutang) menampilkan seluruh hutang belum lunas lintas customer & cabang, ringkasan total outstanding & jatuh tempo terlewat, filter status/pencarian, dan aksi catat pembayaran. Akses: Owner, GM, Manager, Finance.
  - **Jatuh tempo:** kolom `due_at` kini diisi; hutang yang lewat jatuh tempo ditandai di halaman detail customer & laporan piutang.

### Changed
- **Schema `customer_debts` & `debt_payments`:** penambahan kolom `branch_id`, `note`, `created_by` (customer_debts) dan `note`, `created_by` (debt_payments) untuk pelaporan per cabang, keterangan, dan audit. Catatan pembayaran (`note`) kini benar-benar tersimpan.

## [1.2.78] - 2026-06-13

### Fixed
- **Master Data Customer — gagal tambah customer baru:** form mengirim `null` untuk field opsional yang dikosongkan (telepon, email, alamat), tetapi `createSchema` di API POST hanya menerima `string | undefined` sehingga validasi Zod selalu gagal dengan status 400. Field `code`, `phone`, `email`, dan `address` pada schema create kini diberi `.nullable()` agar konsisten dengan schema update (PUT) yang sudah berfungsi.

---

## [1.2.77] - 2026-06-13

### Fixed
- **Bulk Sale — tier harga & harga kosong setelah produk dipilih:** API mengembalikan kolom harga dengan nama field `tierType`, padahal komponen klien (tipe `BulkSalePriceOption` & dropdown Tier) membaca `priceTier`. Akibatnya tier harga selalu blank dan harga/subtotal tidak terisi. API bulk sale kini menambahkan field `priceTier` (dipetakan dari `tierType`) pada tiap harga sehingga dropdown tier dan harga otomatis terisi saat produk ditambahkan.

---

## [1.2.76] - 2026-06-13

### Fixed
- **Bulk Sale — produk tidak muncul di kolom pencarian:** seluruh produk memiliki `sku` kosong (NULL) sehingga API mengembalikan `code: null`, lalu divalidasi gugur di sisi klien (`code` wajib string) dan setiap produk tersaring habis — dropdown selalu kosong. API bulk sale kini mengisi `code` dengan `COALESCE(sku, barcode, '')` sehingga selalu berupa string dan menampilkan barcode sebagai identitas produk.

---

## [1.2.75] - 2026-06-13

### Fixed
- **Master Data Produk — gagal simpan "UOM yang dipilih bukan UOM dasar":** validasi pembuatan/perubahan produk mengharuskan `units_of_measure.is_base = true`, padahal tidak ada satu pun UOM yang ditandai sebagai satuan dasar sehingga semua produk gagal disimpan. Validasi `isBase` dihapus dari API produk; UOM mana pun kini bisa dijadikan satuan dasar produk (konsisten dengan cara `isBase` diturunkan per-produk di halaman detail). Pengecekan keberadaan UOM tetap dipertahankan.

---

## [1.2.74] - 2026-06-13

### Changed
- **POS — keyboard shortcut untuk minim klik di PC:**
  - `F2` → fokus ke kotak pencarian produk dari mana saja
  - `Enter` di kotak cari → langsung buka produk pertama di hasil
  - Kotak cari auto-focus saat halaman dimuat
  - `Enter` di dialog pilih UOM/harga → konfirmasi tambah ke keranjang (input qty auto-focus)
  - `F10` → buka modal pembayaran (Bayar) dari mana saja
  - `Enter` di input nominal bayar → proses pembayaran
  - `Enter` di layar sukses transaksi → langsung transaksi baru
  - Hint shortcut ditampilkan di tombol Bayar (`F10`), Tambah ke Keranjang (`Enter`), dan Proses Pembayaran (`Enter`)

---

## [1.2.73] - 2026-06-13

### Changed
- **POS — sembunyikan menu Penerimaan:** tab navigasi Penerimaan dihapus dari nav POS.

---

## [1.2.72] - 2026-06-13

### Fixed
- **POS — nomor struk salah (TRX-1):** client membaca field `receiptNumber` yang tidak ada, seharusnya `trxNumber`. Nomor struk kini menampilkan format yang benar, contoh `TRX-20260613-XXXX`.

---

## [1.2.71] - 2026-06-13

### Fixed
- **Tambah Produk — dropdown UOM kosong:** dropdown UOM Dasar di form tambah/edit produk tidak menampilkan pilihan karena hanya memfilter UOM dengan `isBase = true`, padahal default saat buat UOM adalah `false`. Filter dihapus sehingga semua satuan ukur kini tampil di dropdown.

---

## [1.2.70] - 2026-06-12

### Added
- Menambahkan halaman **Bulk Sale** di backoffice untuk input transaksi penjualan banyak produk dengan pilihan customer, branch, UOM, tier harga, diskon nominal, cetak struk, dan cetak surat jalan.

---

## [1.2.69] - 2026-06-12

### Fixed
- **Manajemen Harga — build backoffice gagal karena type error:** hasil query `cost_price` dari `db.execute` kini diberi tipe row secara eksplisit sehingga Next.js build tidak lagi gagal pada cast data harga modal.

---
## [1.2.68] - 2026-06-12

### Added
- **Manajemen Harga — hint shortcut keyboard di atas tabel:** ↑↓, Enter, Tab, dan Ctrl+S ditampilkan sebagai badge `<kbd>` di sebelah kanan baris summary, tepat sebelum tabel harga.

---

## [1.2.67] - 2026-06-12

### Fixed
- **Manajemen Harga — 500 error saat ambil data harga:** query `cost_price` dipisah ke query terpisah dengan try/catch; jika tabel `product_uom_costs` belum ada di DB (migration belum jalan), halaman tetap bisa dimuat dan kolom Harga Modal tampil kosong (null) tanpa mematikan seluruh endpoint.

---

## [1.2.66] - 2026-06-12

### Fixed
- **Manajemen Harga — loading state awal salah:** `isLoading` diinisialisasi `true` sehingga skeleton langsung tampil saat halaman dibuka; sebelumnya nilai awal `false` menyebabkan "Tidak ada data" muncul sesaat sebelum data dimuat.

### Added
- **Manajemen Harga — skeleton loading tabel:** tampilan loading kini berupa skeleton tabel 8 baris yang menyerupai struktur kolom asli (Produk, UOM, Harga Modal, RETAIL/RESELLER/GROSIR/MEMBER), menggantikan teks "Memuat data..." yang kurang informatif.

---

## [1.2.65] - 2026-06-12

### Added
- **Manajemen Harga — kolom Harga Modal per UOM:** Halaman `/master-data/prices` kini menampilkan kolom "Harga Modal" di samping harga jual per tier. Pengguna dapat mengedit harga modal langsung dari tabel (inline edit), dan perubahan disimpan bersama harga jual dalam satu kali klik Simpan atau Ctrl+S.

---
## [1.2.64] - 2026-06-12

### Fixed
- **Internal Transfer — type error `expiryDate` saat ship:** `firstExpiryDate` bertipe `Date` (dari kolom timestamp `productStockBatches`) dikonversi ke ISO string sebelum di-set ke `interBranchTransferItems.expiryDate` yang bertipe `varchar`; sebelumnya build gagal dengan type error.

---

## [1.2.63] - 2026-06-11

### Fixed

- Memperketat stock opname POS agar submit, tambah item, approve, reject, skip, dan baca data selalu mengambil cabang serta pengguna dari sesi terautentikasi, sekaligus menolak spoofing branch dan actor dari payload request.
- Memperketat create, history, dan halaman stock opname Backoffice agar akses manager tetap terbatas pada cabang sesi dan error dikembalikan secara aman.

---

## [1.2.62] - 2026-06-11

### Fixed

- Memperketat endpoint penerimaan Purchase Order POS agar actor, cabang, item PO, dan qty diterima tidak dapat dipalsukan dari payload request.

---

## [1.2.61] - 2026-06-11

### Fixed

- Memperketat endpoint bootstrap, snapshot stok, user POS, dan open bill agar akses cabang selalu mengikuti sesi POS.

---

## [1.2.60] - 2026-06-11

### Fixed

- Memperketat sinkronisasi transaksi POS agar branch, kasir, shift, dan flag oversell tidak dapat dipalsukan dari payload request.

---

## [1.2.59] - 2026-06-11

### Fixed

- Memperketat otorisasi Purchase Order dan hutang supplier agar role, actor, branch, dan pembayaran tidak dapat dipalsukan dari payload request.

---
## [1.2.58] - 2026-06-12

### Fixed
- **Internal Transfer — false STOK_PERLU_PECAH saat UOM ratio desimal:** kondisi `remainingInBase > 0` diganti `> 1e-9` untuk toleransi floating-point; sebelumnya aritmetika JS bisa meninggalkan residu `1e-15` setelah deduct cukup stok dengan ratio seperti 0.1 atau 0.5, menyebabkan transfer valid diblok dengan error palsu.

---

## [1.2.57] - 2026-06-12

### Fixed
- **Internal Transfer — pesan error STOK_PERLU_PECAH lebih informatif (M-1):** error kini menyertakan nomor produk (`#ID`) yang bermasalah dan menjelaskan dua opsi tindakan: kurangi qty agar sesuai kelipatan satuan, atau pecah stok via Stock Adjustment.
- **Internal Transfer — validasi notes partial receive di client (M-2):** `handleReceiveSubmit` sekarang memvalidasi sebelum request dikirim bahwa setiap item yang qty-terimanya kurang dari sisa kirim sudah diisi alasannya; error muncul langsung di UI dengan nama produk spesifik tanpa perlu round-trip ke server.

---

## [1.2.56] - 2026-06-12

### Fixed
- **Internal Transfer — kalkulasi stok tersedia konsisten dengan logika pengiriman:** stock-check kini mengumpulkan total base unit dari semua baris stok terlebih dahulu lalu membagi sekali dengan `Math.floor`, menggantikan pola sum-of-floors per baris yang bisa menghasilkan angka lebih kecil dari aktual. Hasilnya sekarang konsisten dengan validasi di ship action.
- **Internal Transfer — batch query stock-check (M-3):** query stock-check tidak lagi N+1 per item; semua produk, konversi UOM, dan stok diambil dalam 3 query flat lalu di-group di memory, mengurangi beban DB secara signifikan untuk transfer dengan banyak item.

---

## [1.2.55] - 2026-06-12

### Fixed
- **Internal Transfer — eliminasi race condition penomoran IBT:** generasi nomor IBT (COUNT + 1) kini dilindungi `pg_advisory_xact_lock` level transaksi; request simultan antri satu per satu dan tidak lagi menghasilkan duplikat nomor yang berakhir dengan error 409.

---

## [1.2.54] - 2026-06-12

### Fixed
- **Internal Transfer — expiry date batch diteruskan ke cabang tujuan:** saat ship, expiry date batch pertama yang dideduct (FIFO = tertua) kini disimpan ke `interBranchTransferItems.expiryDate`; saat receive, nilai tersebut diteruskan ke `StockService.addStock` sehingga batch baru di cabang tujuan mewarisi expiry date asli dari batch sumber, bukan null.

---

## [1.2.53] - 2026-06-12

### Added
- **Payable Antar Cabang — fitur hapus hutang (waive):** endpoint `PATCH /api/bo/inter-branch-payables/[id]/waive` untuk Owner dan GM; melengkapi status `WAIVED` yang sudah ada di guard pembayaran dan display UI tetapi belum punya endpoint. UI payables menambahkan tab "Dihapus" dan tombol "Hapus Hutang" dengan konfirmasi inline.

---

## [1.2.52] - 2026-06-12

### Fixed
- **Internal Transfer — validasi UOM conversion wajib saat ship & stock-check:** fallback diam-diam ke ratio = 1 ketika satuan ukur transfer atau stok tidak terdefinisi di `productUomConversions` dihapus. Sekarang sistem melempar error eksplisit (`409`) dengan pesan yang mengarahkan user ke master data produk, mencegah deduction stok yang salah tanpa peringatan.
- **Internal Transfer — penyatuan update status transaksi:** pola double-update pada action `receive` (update pertama tanpa mengubah status, update kedua mengisi status final) diganti menjadi satu SELECT fail-fast di awal dan satu UPDATE tunggal di akhir untuk semua action, mencegah potensi inconsistent state dan memperjelas alur transaksi DB.
- **Internal Transfer — auto-fill harga modal saat buat transfer:** item dengan `costPrice = 0` kini otomatis diisi dari `productUomCosts` cabang sumber (per produk + satuan), dengan fallback ke `defaultCostPrice × ratio konversi UOM`, sebelum transfer disimpan; mencegah payable tercatat dengan nilai nol akibat kelalaian input.

---

## [1.2.51] - 2026-06-11

### Added

- **POS API — sinkronisasi harga modal per cabang & UOM:** bootstrap POS
  dan pencarian produk POS kini mengirim `product_uom_costs` sesuai cabang.
  POS desktop, payload transaksi penjualan, sync batch, HPP server, cart,
  dan grid kasir tidak diubah pada milestone ini.

---

## [1.2.50] - 2026-06-11

### Fixed
- **Laporan Laba Rugi — fallback HPP per cabang & UOM:** item transaksi lama tanpa `cogs` kini menghitung HPP dari `product_uom_costs` sesuai cabang, produk, dan satuan transaksi sebelum fallback ke `defaultCostPrice`; nilai `cogs` transaksi yang sudah tersimpan tetap dipakai apa adanya.

---

## [1.2.49] - 2026-06-11

### Added

- **Inventory — harga modal default per cabang & UOM:** penambahan stok dari stock opname dan manual adjustment tanpa HPP eksplisit kini memakai `product_uom_costs` sebagai fallback. HPP eksplisit dari PO, retur, void transaksi, dan internal transfer tetap tidak diubah.

---

## [1.2.48] - 2026-06-11

### Added

- **Master Data Produk — harga modal per cabang & UOM:** tambah tabel `product_uom_costs`, API detail produk untuk simpan/muat harga modal per cabang dan satuan, serta tab "Harga Modal" di detail produk. Milestone ini hanya mengelola data master; stok, laporan, dan POS belum diubah.

---

## [1.2.47] - 2026-06-11

### Fixed

- **Manajemen Harga — debounce double-fetch:** filter cabang, kategori, search, dan page digabung ke satu state objek; reset `page` ke 1 kini atomik dengan perubahan search sehingga tidak ada lagi dua request berurutan saat mengetik di kotak pencarian

### Changed

- **Manajemen Harga — grouping multi-UOM:** produk dengan lebih dari satu UOM kini ditampilkan dalam baris yang dikelompokkan — nama produk muncul sekali dengan `rowspan`, baris UOM ke-2 dst di-indent ringan dan bertanda badge jumlah UOM
- **Manajemen Harga — format angka:** kolom harga beralih dari `type="number"` ke `type="text" inputMode="numeric"`; nilai ditampilkan dengan pemisah ribuan format Indonesia (contoh: `150.000`); input menerima angka mentah maupun yang sudah diformat (strip otomatis titik/koma saat parse), sehingga tidak ada lagi konflik ArrowUp/Down dengan increment bawaan browser
- **Manajemen Harga — keyboard navigation:** navigasi tanpa mouse — ↑↓ atau Enter untuk pindah baris, Tab untuk pindah kolom; Ctrl+S menyimpan dari mana saja; semua cell auto-select saat difokus sehingga bisa langsung ketik nilai baru

---

## [1.2.46] - 2026-06-11

### Added

- **API GET /api/bo/master-data/prices:** endpoint bulk harga produk — mengembalikan data flatten product × UOM dengan harga per tier (RETAIL/RESELLER/GROSIR/dll), mendukung filter `branchId`, `categoryId`, `search`, dan pagination 50 baris per halaman
- **API PUT /api/bo/master-data/prices:** endpoint batch upsert harga — terima array hingga 500 perubahan `{productId, uomId, tierType, price}` sekaligus, hanya OWNER dan GM yang dapat mengakses
- **API POST /api/bo/master-data/prices/copy-branch:** salin semua harga dari cabang sumber ke cabang tujuan dengan opsional markup persentase; mendukung `?preview=1` untuk cek jumlah data sebelum eksekusi
- **Halaman Manajemen Harga** (`/master-data/prices`): tabel inline-edit harga massal per cabang — filter cabang, kategori, dan search; highlight sel yang diubah; tombol simpan batch hingga 500 perubahan sekaligus; pagination 50 baris; link ditambahkan di sidebar Master Data
- **Modal Salin Harga Antar Cabang:** tombol "Salin dari Cabang Lain" di halaman Manajemen Harga — pilih cabang sumber, atur markup %, preview jumlah harga sebelum eksekusi, konfirmasi salin

---

## [1.2.45] - 2026-06-11

### Changed

- **Struk POS:** Ukuran cetak dikunci ke 80mm (`@page { size: 80mm auto; margin: 3mm }`); konten mengisi lebar penuh halaman (`width: 100%`) tanpa batasan `maxWidth` berbasis pixel; tambah `padding: 0 4mm` agar harga di sisi kanan tidak terpotong tepi kertas; font dinaikkan ke 18px (1.5x dari sebelumnya)

---

## [1.2.44] - 2026-06-11

### Fixed

- **Deployment B — Normalisasi stok (write layer):** Semua operasi tulis stok kini menyimpan dalam base UOM secara otomatis, sehingga tidak akan ada lagi row duplikat per (productId, branchId) dengan UOM berbeda.
  - `StockService.addStock()` — konversi qty dan costPrice ke base UOM sebelum insert batch dan upsert aggregate; batch menyimpan uomId asli sebagai audit trail
  - `StockService.deductStock()` — FIFO deduction lintas semua batch (tanpa filter uomId); update aggregate selalu di row base UOM
  - `applySOStockAdjustment()` — refactor menggunakan `StockService.deductStock/addStock` untuk konsistensi base UOM
  - Receive action internal transfer — mengganti direct insert `productStocks`/`productStockBatches` dengan `StockService.addStock()` agar qty diterima langsung tersimpan di base UOM
- **Schema:** Ditambahkan `UNIQUE INDEX(productId, branchId)` pada tabel `productStocks` untuk mencegah regresi multi-row setelah migrasi data
- **Skrip migrasi data:** `scripts/migrate-stock-to-base-uom.ts` — menggabungkan semua row `productStocks` per (productId, branchId) ke satu row base UOM; harus dijalankan sekali dalam maintenance window sebelum `pnpm db:push`

---

## [1.2.43] - 2026-06-11

### Fixed

- **Deployment A — Normalisasi stok (read layer):** Semua operasi baca stok kini mengagregasi semua UOM row dan mengonversi ke base UOM, sehingga produk yang stoknya tersimpan dalam SAK/UOM besar tidak lagi tampil 0 di listing, validasi POS, laporan nilai stok, dan stock opname.
  - `getProductsWithStock()` — subquery agregasi cross-UOM dengan konversi ratio ke base UOM
  - `asyncValidateInventory()` — agregasi semua UOM sebelum bandingkan dengan qty transaksi (fix potensi double-count SAK + PCS)
  - `getStockValuationReport()` — `totalQty` kini dalam base UOM via konversi ratio; `totalValue` tetap benar
  - Stock opname create & add-items — `systemQty` dihitung dari total semua UOM yang dikonversi ke UOM item opname; FIFO cost calculation juga dilakukan dalam base UOM

---

## [1.2.42] - 2026-06-11

### Fixed

- **Internal transfer — stok sistem salah (0) saat UOM transfer berbeda dari UOM stok** — stock-check dan aksi ship kini mendukung konversi lintas UOM menggunakan `productUomConversions`. Stok yang tersimpan dalam SAK dapat memenuhi transfer yang meminta PCS (dan sebaliknya), dengan deduction diprioritaskan ke UOM yang sama dulu lalu fallback ke UOM lain. Jika qty tidak habis terbagi secara bulat (butuh pecah stok), sistem menampilkan pesan error yang jelas.

---

## [1.2.41] - 2026-06-10

### Changed

- **Semua popup/modal tidak bisa ditutup dengan klik di luar area** — backdrop click dihapus dari seluruh dialog dan modal (expense, void PIN, open shift, checkout, customer search, UOM price, transaction detail, shift history, void transaksi) agar tidak ada yang tidak sengaja menutup popup saat sedang bekerja.

---

## [1.2.40] - 2026-06-10

### Fixed

- **Internal transfer — stok tidak terbarukan saat proses selesai** — aksi `ship` kini juga melakukan FIFO deduction dari `productStockBatches` di cabang sumber (sebelumnya hanya mengurangi aggregate `productStocks`), dan aksi `receive` kini membuat entri batch baru di `productStockBatches` cabang tujuan dengan HPP dari transfer, sehingga FIFO tracking konsisten dan produk yang diterima bisa langsung dijual.

---

## [1.2.39] - 2026-06-10

### Fixed

- **Tooling gate lint backoffice** — `@typescript-eslint` kini dioverride ke versi kompatibel ESLint 9 untuk `eslint-config-next`, sehingga lint tidak crash sebelum memeriksa kode dan tetap cocok dengan lint phase Next build.

---

## [1.2.38] - 2026-06-09

### Fixed

- **Hardening login backoffice dan POS** — endpoint login kini menyetel `accessToken` dan `refreshToken` sebagai cookie HTTP-only dari server, tidak lagi mengirim token lewat JSON response, dan halaman login tidak lagi membuat cookie token dari client-side JavaScript.
- **Konfigurasi JWT wajib eksplisit** — signing/verifikasi token kini gagal jika `JWT_SECRET` atau `JWT_REFRESH_SECRET` belum dikonfigurasi, sehingga tidak ada fallback secret di runtime.

### Added

- **Regression test login session response** — menambah guard Vitest untuk memastikan token login dikirim via cookie HTTP-only dan tidak bocor ke body JSON.

---

## [1.2.37] - 2026-06-09

### Fixed

- **Atomic status transition transfer internal** — update status kini dijaga dengan kondisi status lama di dalam transaction sebelum efek samping stok/payable, sehingga double-submit ship/receive/cancel tidak bisa memproses status yang sudah berubah.
- **Pembayaran payable anti-overpay** — pembayaran hutang internal kini memakai guarded update di database; request paralel yang melebihi sisa hutang ditolak dengan 409 dan tidak membuat payment log baru.
- **Branch-scope authorization** — MANAGER/non-global kini hanya bisa create, approve, cancel, prepare, ship, receive, dan membaca transfer/payable yang terkait cabang sesinya.
- **Receive parsial lanjutan** — transfer `PARTIALLY_RECEIVED` bisa diproses lagi untuk sisa qty yang belum diterima; payable existing ditambah sesuai nilai penerimaan lanjutan tanpa membuat duplikat payable.
- **Detail transfer internal** — halaman detail kini mengambil `receiveNotes` langsung dari query server dan tidak lagi menutup mismatch type dengan cast paksa.
- **UI aksi transfer internal** — tombol aksi hanya tampil untuk role/cabang yang sesuai dengan aturan API; qty kirim/terima dikunci ke batas maksimal valid saat input.
- **POS internal order** — hanya OWNER/GM yang dapat memilih cabang pengirim lintas cabang; MANAGER mengikuti cabang sesi.

---

## [1.2.36] - 2026-06-09

### Added

- **Route `GET /api/bo/internal-transfers/[id]/stock-check`** — endpoint baru dengan autentikasi penuh; hanya role GUDANG/MANAGER/GM/OWNER yang boleh akses, dan non-global hanya boleh melihat stok cabang sendiri.
- **Unique index `idx_ibp_transfer_unique`** pada kolom `transfer_id` di tabel `inter_branch_payables` — DB-level guard agar satu transfer tidak bisa memiliki dua payable (migration `20260609000005`).

### Fixed

- **Spoofing `requestedById`** — field ini dihapus dari payload POST create transfer; server selalu pakai `userId` dari JWT, client tidak bisa spoof identitas user lain.
- **Default status transfer dari POS** — transfer yang dibuat dari POS kini langsung berstatus `PENDING_APPROVAL` (sebelumnya `DRAFT`), sehingga wajib melalui approval manager sebelum diproses.
- **Validasi cabang asal untuk non-global role** — user biasa (bukan OWNER/GM/MANAGER) tidak bisa membuat transfer dari cabang lain selain cabang sesinya sendiri.
- **Validasi cabang aktif saat create** — API menolak jika cabang asal atau tujuan tidak aktif.
- **Atomic stock deduction saat ship** — pengurangan stok kini memakai kondisi `qty >= qty_kirim` di level SQL; jika stok tidak mencukupi, transfer tidak berubah ke `IN_TRANSIT` dan API mengembalikan 409.
- **Validasi qty kirim tidak melebihi qty request** — API menolak jika qty kirim per item melebihi `qtyRequested`, meski client dimanipulasi.
- **Authorization per aksi status** — prepare/ship hanya boleh dilakukan GUDANG/MANAGER/GM/OWNER dari cabang asal; receive hanya boleh dilakukan dari cabang tujuan; approve/cancel hanya MANAGER/GM/OWNER.
- **Idempotency receive/payable** — sebelum insert payable, API cek dulu apakah sudah ada; jika sudah ada, skip insert (tidak duplikat). Race condition dijaga oleh unique index DB.
- **Cancel IN_TRANSIT diblokir jika sudah ada payable** — transfer yang sudah berdampak finansial tidak bisa dibatalkan; API mengembalikan 409.
- **Pembayaran payable dibatasi ke cabang sendiri** — MANAGER/FINANCE non-global hanya bisa mencatat pembayaran untuk hutang cabangnya sendiri (sebagai debitur).
- **Pesan sukses POS** — setelah submit permintaan transfer, pesan kini berbunyi "berhasil dibuat dan menunggu approval" sesuai lifecycle baru.
- **Hapus `as any` di halaman detail transfer** — `payload?.role` kini diakses dengan type-safe tanpa cast.
- **Hapus `currentUserId` dari props POS internal-order** — props tidak lagi dikirim dari server ke client karena server sudah handle via JWT.

### Changed

- **Nomor IBT digenerate di dalam transaction** — mengurangi potensi race condition pada nomor urut; unique constraint menangkap konflik yang tersisa dengan respon 409.

---

## [1.2.35] - 2026-06-09

### Added

- **Kolom `receive_notes`** di tabel `inter_branch_transfer_items` — menyimpan alasan selisih penerimaan per item.
- **Kolom "Alasan Selisih"** di tabel item halaman detail transfer internal — tampil oranye jika ada alasan.

### Fixed

- **Status `PARTIALLY_RECEIVED`** — penerimaan yang tidak penuh kini mengubah status transfer menjadi `Diterima Sebagian` (bukan `Diterima Penuh`). Status ditentukan otomatis: semua item `qtyReceived = qtyShipped` → `FULLY_RECEIVED`, ada yang kurang → `PARTIALLY_RECEIVED`.
- **Alasan selisih wajib diisi** — jika qty terima < qty dikirim pada item manapun, field alasan wajib diisi sebelum konfirmasi. API menolak request dengan error 400 jika ada item parsial tanpa alasan. Field alasan tampil otomatis di form (backoffice & POS) hanya saat qty dikurangi.
- **Aksi tersembunyi setelah `PARTIALLY_RECEIVED`** — section aksi di halaman detail tidak lagi tampil setelah status `PARTIALLY_RECEIVED` (sebelumnya masih muncul karena hanya `FULLY_RECEIVED` dan `CANCELLED` yang dikecualikan).

---

## [1.2.34] - 2026-06-09

### Added

- **Halaman Transfer Masuk POS** (`/pos/incoming-transfers`) — halaman baru di POS untuk non-KASIR melihat semua transfer internal berstatus `IN_TRANSIT` yang ditujukan ke cabang ini. Menampilkan daftar transfer dengan item (produk, qty dikirim), tombol "Terima Barang", dan inline form input qty terima per item sebelum konfirmasi.
- **Tab "Transfer Masuk"** di navigasi POS — muncul untuk semua role selain KASIR.

### Fixed

- **Penerimaan Transfer Internal** — tombol "Konfirmasi Diterima" sebelumnya langsung eksekusi tanpa validasi manual (stok langsung ditambah sejumlah `qtyShipped`). Kini diganti dengan form konfirmasi: staff input qty aktual yang diterima per item (pre-fill dari `qtyShipped`, bisa dikurangi jika ada selisih), dilengkapi warning oranye jika qty kurang dari yang dikirim.
- **API `PATCH /api/bo/internal-transfers/[id]/status` (receive)** — kini wajib menerima `items: [{itemId, qty}]` sebagai qty terima aktual. Validasi: `qty ≤ qtyShipped`, minimal satu item > 0. Stok cabang tujuan diperbarui berdasarkan `qtyReceived` (bukan `qtyShipped`). Hutang piutang juga dihitung dari `qtyReceived × costPrice`.
- **API `PATCH /api/bo/internal-transfers/[id]/status` (ship)** — payload item diubah dari `{itemId, qtyShipped}` menjadi `{itemId, qty}` untuk konsistensi.

---

## [1.2.33] - 2026-06-09

### Added

- **Hutang Piutang Transfer Internal (desentralisasi)** — saat cabang penerima konfirmasi barang diterima, sistem otomatis mencatat hutang ke tabel `inter_branch_payables`: debitur = cabang penerima, kreditur = cabang pengirim, nilai = `sum(qtyShipped × costPriceAtTransfer)`.
- **Halaman Hutang Piutang Internal** (`/purchase-orders/internal/payables`) — list semua hutang piutang antar cabang dengan tab filter (Belum Bayar / Sebagian / Lunas), summary total belum lunas, dan inline form catat pembayaran (jumlah, no. bukti transfer bank, catatan). Hanya role OWNER/GM/MANAGER/FINANCE yang bisa mencatat pembayaran.
- **API `GET /api/bo/inter-branch-payables`** — list semua hutang piutang antar cabang dengan join nama cabang debitur/kreditur dan nomor IBT.
- **API `POST /api/bo/inter-branch-payables/[id]/pay`** — catat pembayaran: validasi sisa hutang, insert ke `inter_branch_payments`, update `paidAmount` dan status (`PARTIAL` / `PAID`) secara atomic dalam satu transaksi.
- **DB migration** — tabel `petshop.inter_branch_payables` dan `petshop.inter_branch_payments` dengan index pada `transfer_id`, `debtor_branch_id`, `creditor_branch_id`, `status`.
- **Sidebar** — tambah link "Hutang Piutang Internal" di grup Pembelian.

---

## [1.2.32] - 2026-06-09

### Fixed

- **Transfer Internal** — tab filter di halaman list tidak lagi menampilkan scrollbar horizontal; hapus `overflow-x-auto` dan sesuaikan struktur container tab dengan pola standar halaman lain.

---

## [1.2.31] - 2026-06-09

### Changed

- **Konfirmasi Pengiriman Transfer Internal** — aksi "Tandai Sudah Dikirim" kini tidak otomatis menggunakan qty permintaan. Admin harus mengisi qty kirim aktual per item melalui inline form (pre-fill dari qty request, bisa dikurangi). Form menampilkan kolom **Stok Sistem** (merah jika di bawah qty permintaan) dan warning per baris: merah ⚠ jika qty kirim melebihi stok sistem, oranye jika qty kirim kurang dari permintaan. Pengiriman tetap bisa diproses meski stok kurang — validasi fisik tanggung jawab admin.
- **API `PATCH /api/bo/internal-transfers/[id]/status` (ship)** — terima body `items: [{itemId, qtyShipped}]`; hapus logika blokir stok tidak cukup; validasi total qty kirim > 0; item dengan qty 0 tidak dideduct.

### Added

- **API `GET /api/bo/internal-transfers/[id]/stock-check`** — return stok sistem per item transfer di cabang asal (`[{itemId, currentQty}]`); dipakai form konfirmasi pengiriman untuk menampilkan warning stok.

---

## [1.2.30] - 2026-06-09

### Added

- **Print Surat Jalan** — halaman detail Transfer Internal kini menyertakan layout cetak surat jalan yang dioptimalkan untuk printer dot-matrix: font monospace (Courier New), border solid sederhana, tabel items (No, Nama Produk, SKU, Qty, Satuan, kolom Terima kosong untuk paraf), kolom catatan, dan tiga blok tanda tangan (Pengirim, Kurir/Pengantar, Penerima). Layout hanya muncul saat `window.print()` — semua elemen UI disembunyikan via `@media print`. Tombol print muncul saat status `IN_TRANSIT`, `PARTIALLY_RECEIVED`, atau `FULLY_RECEIVED`.

---

## [1.2.29] - 2026-06-09

### Added

- **Halaman Transfer Internal** — halaman list di `/purchase-orders/internal` menampilkan semua transfer antar cabang dengan filter tab status (Draft, Menunggu, Disetujui, Disiapkan, Pengiriman, Diterima, Dibatalkan) dan dropdown filter cabang asal/tujuan; badge status berwarna sesuai kondisi.
- **Halaman Detail Transfer Internal** — halaman `/purchase-orders/internal/[id]` menampilkan header transfer (nomor IBT, status, arah cabang pengirim → tujuan, pemohon, catatan), tabel items (qty request/kirim/terima, satuan, est. HPP), dan panel aksi kontekstual sesuai status dan role.
- **Panel aksi Transfer Internal** — tombol Ajukan & Setujui / Setujui / Batalkan untuk role OWNER/GM/MANAGER; tombol Mulai Persiapan untuk semua role; tombol Tandai Sudah Dikirim dan Konfirmasi Diterima; tombol Print Surat Jalan (`window.print()`) saat status IN_TRANSIT, PARTIALLY_RECEIVED, atau FULLY_RECEIVED.
- **Sidebar** — tambah link "Transfer Internal" di grup Pembelian, di bawah "Purchase Orders".

---

## [1.2.28] - 2026-06-09

### Added

- **API PO Internal** — `POST /api/bo/internal-transfers`: buat transfer antar cabang baru dengan generate nomor `IBT-YYYYMMDD-XXXX`, insert header + items dalam satu transaksi DB.
- **API PO Internal** — `GET /api/bo/internal-transfers`: list transfer dengan filter `status`, `sourceBranchId`, `destinationBranchId`, `limit`, `offset`; join nama cabang asal/tujuan dan nama pemohon.
- **API PO Internal** — `GET /api/bo/internal-transfers/[id]`: detail satu transfer beserta semua items (join nama produk, SKU, kode & nama UOM).
- **API PO Internal** — `PATCH /api/bo/internal-transfers/[id]/status`: lifecycle transfer via `action` (`approve`, `prepare`, `ship`, `receive`, `cancel`); aksi `ship` mengurangi stok cabang asal secara atomic dengan cek stok tidak minus; aksi `receive` melakukan upsert stok cabang tujuan; aksi `cancel` dari status `IN_TRANSIT` mengembalikan stok ke cabang asal.

---

## [1.2.27] - 2026-06-09

### Changed

- **PO Internal** — tombol "Kirim Permintaan" kini membuka dialog konfirmasi terlebih dahulu, menampilkan ringkasan lengkap (cabang pengirim & tujuan, daftar produk, qty, satuan, estimasi HPP per item dan total, catatan) sebelum permintaan dikirim.

---

## [1.2.26] - 2026-06-09

### Fixed

- **PO Internal** — Tab dari field Qty kini mengikuti urutan yang benar: Qty → UOM → Harga, bukan langsung ke search box. Tab dari field Harga di baris terakhir akan fokus ke search, dan dari baris non-terakhir akan fokus ke Qty baris berikutnya.

---

## [1.2.25] - 2026-06-09

### Fixed

- **PO Internal** — dropdown hasil pencarian produk kini auto-scroll mengikuti item yang di-highlight saat navigasi dengan Arrow Up/Down, sehingga item yang berada di luar viewport tetap terlihat tanpa perlu scroll manual.

---

## [1.2.24] - 2026-06-09

### Added

- **Form PO Internal** di `/pos/internal-order`: halaman keyboard-first untuk kasir/manager membuat permintaan transfer stok antar cabang.
- Search produk dengan debounce 300ms, navigasi keyboard (Arrow Up/Down, Enter untuk pilih, Escape untuk tutup dropdown).
- Auto-fokus ke input Qty setelah produk dipilih; search box otomatis re-fokus setelah item ditambah atau dihapus.
- Auto-fill HPP estimasi dari `defaultCostPrice` produk; saat UOM diubah, HPP dikalikan ulang dengan rasio konversi.
- Dropdown cabang pengirim hanya bisa diubah oleh role OWNER, GM, dan MANAGER; KASIR otomatis menggunakan cabang sendiri.
- Tab navigasi "PO Internal" ditambahkan di `PosNavTabs` (tampil untuk semua role).
- Submit placeholder menangani endpoint `/api/bo/internal-transfers` yang belum ada (404/405) dengan menampilkan toast "Fitur segera tersedia".

---

## [1.2.23] - 2026-06-09

### Added

- **Schema Inter Branch Transfer**: Tambah tabel `inter_branch_transfers` (header) dan `inter_branch_transfer_items` (detail) di `packages/db/src/schema/inter_branch_transfers.ts` untuk pencatatan transfer stok antar cabang.
- **Migration SQL** `20260609000002_inter_branch_transfers.sql`: DDL lengkap kedua tabel dalam namespace `petshop`.
- Tabel `inter_branch_transfers` mendukung lifecycle status: `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `PREPARING`, `IN_TRANSIT`, `PARTIALLY_RECEIVED`, `FULLY_RECEIVED`, `CANCELLED`.
- Field `cost_price_at_transfer` di `inter_branch_transfer_items` untuk mencatat HPP FIFO cabang pengirim saat barang dikirim (diisi saat status → `IN_TRANSIT`).

---

## [1.2.22] - 2026-06-09

### Added

- **Schema PO Internal**: Tambah kolom `po_type` (default `'EXTERNAL'`) dan `source_branch_id` (nullable, FK ke `branches`) di tabel `purchase_orders` untuk mendukung Purchase Order antar cabang.
- **Migration SQL** `20260609000001_po_internal_schema.sql`: Migrasi non-breaking — semua PO existing tetap valid dengan `po_type = 'EXTERNAL'`.

### Changed

- Kolom `supplier_id` di tabel `purchase_orders` diubah menjadi nullable untuk mengakomodasi PO internal yang tidak memerlukan supplier eksternal.

---

## [1.2.21] - 2026-06-09

### Changed

- **Sidebar**: Diekstrak dari `layout.tsx` ke komponen terpisah `_components/sidebar.tsx` (client component).
- **Sidebar**: Reorganisasi nav menjadi 9 group — Operasional, Transaksi, Inventori, Pembelian, Laporan, Shift, Master Data, Pengaturan, Lainnya.
- **Sidebar**: Semua emoji diganti dengan icon Lucide React yang sesuai.
- **Sidebar**: Tambah collapsible per group dengan state tersimpan di `localStorage`; group yang berisi halaman aktif otomatis terbuka.
- **Sidebar**: Tambah active link highlight — item aktif tampil dengan `bg-primary/10 text-primary font-semibold` menggunakan `usePathname()`.
- **Sidebar**: Tambah info nama user dan cabang di bagian bawah sidebar.
- **Sidebar**: Tambah item "Supplier" di group Master Data.

---

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
