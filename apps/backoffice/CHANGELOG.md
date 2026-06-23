<!-- markdownlint-disable MD013 MD024 -->

# Changelog

## [1.13.0] - 2026-06-23

### Added
- **Konfigurasi header struk per cabang.** Header struk (penjualan & settlement) yang sebelumnya hardcode `HAMMIELION` kini dapat diatur per cabang.
  - **Skema `branches.receipt_name`.** Kolom baru `receipt_name` (varchar 100, NOT NULL, default `HAMMIELION`) untuk menyimpan teks header besar struk per cabang. Migrasi: `20260623000000_add_receipt_name_to_branches.sql`. Field `address` & `phone` cabang yang sudah ada kini ikut dipakai sebagai alamat & kontak di struk.
  - **Pengaturan Cabang.** Form edit cabang (Settings → Cabang) menambahkan input **Nama di Struk** (default `HAMMIELION`). API `PATCH /api/bo/settings/branches/[id]` menerima & memvalidasi `receiptName` (1–100 karakter); hanya OWNER yang dapat mengubah.
  - **Tampilan struk.** Header struk penjualan & laporan settlement kini menampilkan **Nama di Struk** (header besar), nama cabang, **alamat**, dan **Telp: kontak** — semua diambil dari data cabang aktif (mendukung override cabang multi-branch). Default tetap `HAMMIELION` bila belum diisi.

### Fixed
- **Pembayaran non-tunai (Transfer Bank / E-Wallet) tidak terhitung di total omzet settlement shift.** Pada cetak settlement, pembayaran via `BANK_TRANSFER` (mis. TRANSFER_BCA) atau `E-WALLET` muncul di daftar "TRANSAKSI NON-TUNAI" tetapi **tidak ikut** dijumlahkan ke total **Non-Tunai** maupun **OMZET**.
  - **Penyebab:** route `breakdown` (`GET .../breakdown`) dan `settle` (`POST .../settle`) membagi pembayaran per metode hanya menangani tipe `QRIS`, `DEBIT`, dan `CREDIT` untuk non-tunai. Tipe `DEBIT`/`CREDIT` bahkan tidak ada di sistem (legacy), sedangkan tipe non-tunai yang sebenarnya — `BANK_TRANSFER` dan `E-WALLET` — tidak masuk bucket manapun, sehingga nilainya hilang dari total non-tunai dan omzet.
  - **Perbaikan:** logika pembagian dibuat menyeluruh — `BANK_TRANSFER` dipetakan ke `totalSalesDebit`, dan `E-WALLET` (serta metode non-tunai lain di luar `CASH`/`DEBT`/`QRIS`) ke `totalSalesCredit`. Ketiga kolom non-tunai memang selalu dijumlahkan sebagai satu nilai "Non-Tunai" di tampilan, sehingga total kini benar tanpa perubahan skema DB.
  - **Catatan data lama:** shift yang sudah ditutup sebelum perbaikan (mis. 22 Juni) sudah menyimpan breakdown lama di tabel `shift_cashier_breakdown`, sehingga cetak ulang dari Back Office masih menampilkan angka lama. Perbaikan berlaku untuk shift yang ditutup setelah ini.

## [1.12.1] - 2026-06-23

### Fixed
- **Scanner barcode menampilkan kamera blank di HP.** Dua perbaikan: (1) elemen video memakai `autoPlay` dengan `muted`/`playsinline` yang di-set langsung pada properti elemen (bukan hanya atribut React) untuk mengatasi kebijakan autoplay browser mobile; (2) start kamera ditunda satu tick (`setTimeout`) agar tahan terhadap pemanggilan ganda React Strict Mode di dev — sebelumnya preview muncul sepersekian detik lalu blank karena `stop()` dari stream mount pertama ikut menghapus `srcObject` milik stream mount kedua. Constraint kamera belakang juga dilonggarkan ke `facingMode: { ideal: 'environment' }`.
- **Sidebar dashboard backoffice tidak muncul di tampilan mobile.** Sidebar sebelumnya `hidden md:flex` tanpa tombol pembuka, sehingga di layar < 768px navigasi dashboard tidak bisa diakses sama sekali. Kini sidebar menjadi **drawer geser** di mobile: tombol hamburger di pojok kiri header membuka drawer (dengan backdrop), menutup otomatis saat pindah halaman, dan mengunci scroll body saat terbuka. Definisi menu tetap satu sumber (dipakai ulang untuk tampilan desktop & drawer mobile).

## [1.12.0] - 2026-06-22

### Added
- **Menu Kelola Produk mobile di POS Web (barcode & stock opname).** *(dalam pengerjaan)*
  - **Skema `product_barcodes`.** Tabel baru untuk menampung barcode tambahan/alternatif per produk (kasus "kemasan sama, barcode berbeda"). Bersifat additive — `products.barcode` tetap menjadi barcode utama sehingga alur POS, sync bootstrap, dan master-data yang ada tidak terpengaruh. Migrasi: `20260622000000_add_product_barcodes.sql`.
  - **API barcode POS.** Helper lookup terpusat (`lib/services/barcode.ts`) yang mencari produk di kedua sumber barcode sekaligus, plus endpoint: `GET /api/pos/barcodes/lookup` (cari produk dari hasil scan), `GET`/`POST /api/pos/products/[id]/barcodes` (lihat & tambah barcode), `DELETE /api/pos/products/[id]/barcodes/[barcodeId]`. Saat menambah barcode: bila produk belum punya barcode utama, nilai diisi ke `products.barcode`; jika sudah, disimpan sebagai barcode tambahan. Uniqueness divalidasi lintas kedua tabel (konflik → 409).
  - **Menu "Produk" di POS Web (mobile).** Tab baru di navigasi POS berisi hub Kelola Produk. Halaman **Tambah / Scan Barcode**: cari & pilih produk, lihat barcode terdaftar (utama + tambahan), tambah barcode manual atau lewat **kamera HP** (`@zxing/browser`), dan hapus barcode tambahan. Scanner menampilkan peringatan bila bukan koneksi aman (kamera butuh HTTPS).

## [1.11.8] - 2026-06-22

### Fixed
- **Form PO Internal di POS Web: cabang yang dikunci ke kasir sekarang cabang tujuan (penerima), bukan cabang pengirim.** PO Internal adalah permintaan stok **masuk** ke cabang kasir dari cabang lain, sehingga yang seharusnya terkunci adalah cabang tujuan.
  - **Front-end:** untuk role non-global (KASIR, dll), **Cabang Tujuan** kini terkunci ke cabang kasir dan **Cabang Pengirim** yang dapat dipilih. Role OWNER/GM tetap bisa mengubah keduanya.
  - **Back-end:** validasi pembuatan transfer diubah dari `sourceBranchId === branchId` menjadi `destinationBranchId === branchId` agar konsisten — non-global user hanya boleh membuat permintaan transfer **ke** cabangnya sendiri.

## [1.11.7] - 2026-06-22

### Fixed
- **Settlement shift tidak menggabung penjualan kasir yang menyusul (gabung di tengah shift).** Saat kasir 1 buka shift lalu kasir 2 gabung dan melanjutkan sampai tutup toko, ringkasan settlement hanya menampilkan penjualan kasir 1 — transaksi kasir 2 tidak ikut dihitung.
  - **Penyebab:** breakdown (`GET .../breakdown`) dan settle (`POST .../settle`) menghitung per-kasir hanya dengan looping `shifts.assignedCashiers`, yang merupakan snapshot saat **buka** shift. Route `join` hanya membuat baris `shiftCashierSessions` tanpa menambahkan kasir ke `assignedCashiers`, sehingga transaksi kasir yang menyusul tidak pernah masuk perhitungan.
  - **Perbaikan:** daftar kasir untuk breakdown & settle kini diambil dari gabungan (union) `assignedCashiers` + sesi kasir (`shiftCashierSessions`) + `cashierId` aktual pada transaksi & expense shift tersebut. Bersifat self-healing — shift yang sedang terbuka pun kini tutup dengan total yang benar.
  - Route `join` juga ikut menambahkan kasir ke `assignedCashiers` agar jumlah kasir pada laporan shift akurat.
  - **Sembunyikan kasir tanpa aktivitas dari rincian settlement.** Kasir yang gabung shift tapi tidak melakukan penjualan dan tidak ada pengeluaran tidak lagi ditampilkan sebagai baris bernilai 0 di breakdown maupun settlement (dan tidak disimpan ke `shift_cashier_breakdown`).
- **Perbaiki error TypeScript yang menggagalkan build deployment.**
  - `stock-service.ts`: `batches` kini di-resolve dengan `??` sehingga selalu bertipe array (sebelumnya `possibly undefined` saat FIFO deduction).
  - `bootstrap-route.test.ts`: argumen `Request` di-cast agar cocok dengan tipe `NextRequest` yang diharapkan handler `GET`.

## [1.11.6] - 2026-06-22

### Added
- **Pilih produk minim mouse di POS Web (alur keyboard penuh).**
  - **Navigasi panah pada hasil cari.** Tekan `↑`/`↓` untuk memindah sorotan antar kartu produk, lalu `Enter` membuka produk yang **disorot** (sebelumnya `Enter` selalu mengambil produk pertama). Kartu tersorot otomatis di-scroll agar tetap terlihat, dan sorotan ikut mengikuti posisi mouse.
  - **Auto-refokus kotak cari.** Setelah menekan "Tambah ke Keranjang" atau menutup dialog, fokus otomatis kembali ke kotak cari sehingga alur "ketik → Enter → ketik → Enter" berjalan tanpa menyentuh mouse.
  - **Navigasi satuan & harga via keyboard di dialog.** Di dialog Pilih UOM & Harga: `←`/`→` mengganti satuan, `↑`/`↓` mengganti tier harga (petunjuk shortcut muncul di label bila ada lebih dari satu pilihan). `Enter` tetap menambah ke keranjang, `Esc` membatalkan.

## [1.11.5] - 2026-06-22

### Changed
- **Sederhanakan modal Pembayaran POS Web agar muat di layar kecil tanpa scroll.** Tata letak dirapatkan dan disusun ulang supaya kasir bisa fokus tanpa menggulir:
  - **Input Diskon kini collapsible** — disembunyikan di balik chip **+ Diskon** (otomatis tampil bila ada diskon). Tidak lagi memakan ruang di setiap transaksi yang umumnya tanpa diskon.
  - **Toggle Diskon & Bayar Gabungan (Split) digabung jadi sebaris chip** yang ringkas dan menunjukkan status aktif.
  - **Ringkasan total dipadatkan** jadi satu baris (item · subtotal · diskon di kiri, Total besar di kanan).
  - Ritme vertikal antar-bagian dirapatkan (`mb-5/mb-6` → `mb-3/mb-4`) tanpa mengubah ukuran target sentuh tombol utama. Semua fitur (split, hutang, quick fill nominal, kembalian) tetap lengkap.

## [1.11.4] - 2026-06-22

### Added
- **Pilihan satuan + konversi di form Penyesuaian Stok.** User kini bisa memilih satuan (satuan dasar maupun satuan konversi seperti Dus/Karton) saat menyesuaikan stok. Service `getProductsWithStock` mengembalikan `baseUomName` dan daftar `uoms` (base UOM + konversi dari `product_uom_conversions`) per produk.

### Changed
- **Rombak UX form Penyesuaian Stok jadi berbasis tambah/kurang (delta).** Sebelumnya user harus mengetik kuantitas absolut akhir; sekarang cukup memilih mode **+ Tambah Stok** / **− Kurangi Stok**, mengisi jumlah, dan satuan dipilih lewat dropdown inline di sebelah input. Form menampilkan pratinjau "Stok akhir" hasil konversi ke base UOM dan memvalidasi stok tidak cukup sebelum submit.
  - API `POST /api/bo/inventory/stock-adjustment` kini menerima `adjustmentType` (`add`/`subtract`), `qty`, dan `uomId`; jumlah dikonversi ke base UOM (×ratio), HPP dikonversi (÷ratio), lalu kuantitas akhir dihitung dari stok saat ini ± delta sebelum diterapkan.

## [1.11.3] - 2026-06-21

### Fixed
- **Perbaikan pergeseran zona waktu transaksi (+7 jam) di database lokal.** Koneksi database (`createDb` di `@petshop/db`) kini otomatis memaksa parameter session timezone ke `UTC` dengan menyisipkan `options=-c timezone=UTC` ke `DATABASE_URL`. Hal ini memastikan `now()` PostgreSQL mengevaluasi sebagai UTC untuk kolom `timestamp` tanpa timezone, menyelaraskan penyimpanan data baru baik di lingkungan lokal maupun produksi.
- **Sinkronisasi filter rentang tanggal di API dan Web POS.** API filter rentang tanggal (`transactions`, `stock-logs`, `adjustment-logs`, `shifts`, `audit-log`) dan halaman riwayat POS (`resolvedFrom`/`resolvedTo`) kini diparse menggunakan batas offset WIB (`+07:00`) alih-alih `Z` (UTC) atau parser lokal server, agar pencarian filter riwayat transaksi tepat mencakup batas hari WIB (00:00:00 sampai 23:59:59.999 WIB) secara konsisten di semua lingkungan.

## [1.11.2] - 2026-06-21

### Added
- **Bagian "PENJUALAN" di cetak settlement** menampilkan omzet per metode (Tunai / Non-Tunai / Hutang) dengan total **OMZET**. Komponen Tunai = kas penjualan net kembalian (sebelum dipotong pengeluaran).

### Changed
- **Rombak layout cetak settlement untuk hilangkan redundansi.** Sebelumnya beberapa angka tampil berulang (Tunai = Kas Bersih di tiap kasir; Non-Tunai muncul 3x di per-kasir/omzet/total; Kas Penjualan Harus Ada = Kas Bersih). Sekarang:
  - **PENJUALAN** (omzet per metode) jadi ringkasan tunggal di atas.
  - **RINCIAN PER KASIR** selalu tampil (termasuk bila hanya 1 kasir). Baris Tunai = penjualan tunai net, sehingga Tunai − Pengeluaran = Kas Bersih (tidak lagi dua angka kembar). Baris "TOTAL SEMUA KASIR" dihapus.
  - **TRANSAKSI NON-TUNAI** tidak lagi menampilkan baris "Total Non-Tunai" (sudah ada di PENJUALAN).
  - **REKONSILIASI KAS**: derivasi `Kas Penjualan Tunai − Pengeluaran` hanya muncul bila ada pengeluaran; "Kas Penjualan Harus Ada" → "Kas Harus Ada"; modal awal jadi baris info di bawah.

### Fixed
- **Tendered (uang tunai diterima) tidak pernah lagi dicatat sebagai penjualan.** Sebelumnya `totalSalesCash` & `totalSales` di breakdown shift menyimpan nilai *tendered* (termasuk kembalian), sehingga kolom "Cash" & "Total Jual" di detail Riwayat Shift menggelembung sebesar kembalian. Sekarang yang disimpan adalah nilai **NET** (setelah kembalian): `totalSalesCash = ΣCASH − kembalian`, `totalSales = net penjualan (omzet)`, `expectedCash = totalSalesCash(net) − pengeluaran`. Diterapkan di endpoint `settle`, `force-close`, dan `breakdown` (preview). Nilai `expectedCash`/variance tidak berubah. (Catatan: data shift lama yang sudah ditutup perlu di-backfill agar ikut terkoreksi.)

### Changed
- **Baris "Tunai" di RINCIAN PER KASIR cetak settlement kini menampilkan nilai kas bersih** (sudah dikurangi kembalian & pengeluaran), bukan lagi penjualan tunai bruto. Sebelumnya nilainya ambigu karena berbeda dengan baris "Kas Bersih" sehingga membingungkan user. Berlaku juga untuk baris Tunai pada "TOTAL SEMUA KASIR".

## [1.11.1] - 2026-06-21

### Fixed
- **Semua tampilan & cetakan tanggal/waktu kini konsisten WIB (Asia/Jakarta).** Sebelumnya format tanggal tidak meng-set timezone, sehingga yang dirender di server (UTC) tergeser 7 jam dari WIB (mis. cetak settlement, header tanggal dashboard, "Dibuat pada" laporan nilai stok, nama bill default). Timestamp di DB tetap UTC; perbaikan murni di lapisan format.
  - Helper bersama baru `formatWIB(date, options)` di `@petshop/shared` (memaksa `timeZone: 'Asia/Jakarta'`), plus preset `formatDate`, `formatDateTime`, `formatDateTimeShort`, `formatTime`, `formatDateLong`.
  - Semua call site `toLocaleDateString`/`toLocaleTimeString`/`Intl.DateTimeFormat` untuk tanggal di backoffice dialihkan ke helper ini (struk POS, riwayat transaksi & shift, settlement, PO, transfer internal, audit log, stock/adjustment logs, retur, piutang, dll).

## [1.11.0] - 2026-06-20

### Added
- **Daftar transaksi non-tunai di cetak settlement** (kolom: Tgl | Nominal | Metode, Nominal rata kiri) beserta total non-tunai. Data diambil dari pembayaran bertipe QRIS/Debit/Kredit pada shift (`CASH` & `DEBT`/Hutang tidak termasuk).
  - Field baru `nonCashPayments` di `ShiftBreakdownSummary` (`@petshop/shared`), diisi oleh endpoint `settle` & `GET /api/bo/shifts/[id]`.
- **Baris "TOTAL SEMUA KASIR"** pada rincian per kasir di cetak settlement (muncul bila shift punya lebih dari satu kasir): total tunai, non-tunai, hutang, pengeluaran, dan kas bersih.

### Changed
- **Hapus footer tanda tangan** (Kasir/Penyetor) pada cetak settlement.

## [1.10.0] - 2026-06-20

### Added
- **Cetak laporan settlement shift (thermal 80mm).** Setelah shift ditutup, muncul layar sukses dengan tombol "🖨️ Cetak Settlement" dan "Selesai".
  - Komponen baru `settlement-print.tsx`: header toko, info shift (buka/tutup/ditutup oleh), rincian penjualan per kasir (tunai, non-tunai, hutang, pengeluaran, kas bersih), rekonsiliasi (modal terpisah, kas harus ada, kas disetor, selisih), catatan settlement, dan kolom tanda tangan kasir/penyetor.
  - `settlement-client.tsx` kini menahan respons `settle` untuk menampilkan ringkasan + opsi cetak sebelum kembali ke POS (sebelumnya langsung redirect).
  - `page.tsx` settlement meneruskan `branchName` & `cashierName` dari JWT untuk dicetak.
- **Cetak ulang settlement dari Riwayat Shift.** Modal detail shift (`shift-history-client.tsx`) kini punya tombol "🖨️ Cetak Settlement" untuk shift yang sudah ditutup (CLOSED/FORCE_CLOSED), memakai ulang komponen `settlement-print.tsx`.

## [1.9.1] - 2026-06-20

### Changed
- **Modal dipisahkan dari rekonsiliasi kas settlement (modal terpisah, dikembalikan utuh).** Melengkapi 1.9.0:
  - Ekspektasi kas = **net cash penjualan** = `Σ(tunai diterima) − kembalian − pengeluaran tunai` (pengurangan kembalian dari 1.9.0 tetap dipertahankan).
  - `total_closing_cash_expected` & input kas fisik kini **hanya net cash penjualan (di luar modal)**; modal awal **tidak lagi dijumlahkan** ke ekspektasi kas.
  - UI settlement (`settlement-client.tsx`): input berlabel "Total Uang Tunai di Luar Modal", modal ditampilkan terpisah sebagai info, selisih dihitung dari net cash penjualan saja.
  - Riwayat shift: kolom breakdown "Kas Bersih" diganti "Kas Penjualan".
  - Berlaku di `settle`, `breakdown`, dan `force-close`.

## [1.9.0] - 2026-06-20

### Fixed
- **Settlement shift salah hitung kas (kembalian & modal):** kalkulasi kas yang harus ada di laci sebelumnya keliru sehingga setiap shift dengan kembalian selalu tampak "kurang".
  - **Kembalian kini dikurangi dari kas tunai.** Sebelumnya `totalSalesCash` memakai nominal uang yang diserahkan customer (tendered) tanpa mengurangi kembalian (`changeAmount`) yang keluar dari laci. Rumus diperbaiki menjadi `kas tunai bersih = Σ(tunai diterima) − Σ(kembalian)`.
  - **Modal awal tidak lagi dibagi per kasir.** Sebelumnya modal dibagi rata (`floor(openingCash / jumlahKasir)`) sehingga sisa pembagian hilang dan ekspektasi kas per kasir tidak akurat. Kini modal dihitung utuh sekali di level shift.
  - Rumus final: `Kas Harus Ada = Modal Awal + Σ(kas tunai bersih per kasir) − Σ(pengeluaran tunai)`.
  - Berlaku di `POST /api/pos/shifts/[id]/settle`, `GET /api/pos/shifts/[id]/breakdown`, dan `POST /api/pos/shifts/[id]/force-close`. Shift yang sudah ditutup sebelumnya tidak ikut dihitung ulang (data lama tetap).

### Changed
- **Rekonsiliasi kas settlement jadi per-shift (satu laci), bukan per kasir.** Karena kasir berbagi satu laci, input kas fisik saat settlement (`settlement-client.tsx`) kini berupa **satu** kolom "Kas Fisik di Laci" beserta selisihnya, bukan input per kasir. Rincian penjualan per kasir tetap ditampilkan sebagai informasi.
  - Di riwayat shift (`shift-history`), tabel breakdown kasir menyederhanakan kolom rekonsiliasi per-kasir (Modal Share/Kas Expected/Kas Real/Selisih) menjadi satu kolom "Kas Bersih"; angka Expected/Real/Selisih level shift tetap di header detail.

### Added
- **Verifikasi auth pada API shift settlement:** route `settle`, `breakdown`, dan `force-close` kini memverifikasi `accessToken` (sebelumnya tidak ada). Operasi `settle` dan `force-close` juga dibungkus dalam satu transaksi DB agar tidak setengah jalan bila gagal.

## [1.8.2] - 2026-06-20

### Fixed
- **History POS web kosong saat shift dibuka akun lain:** mode shift pada halaman riwayat (`/pos/history`) sebelumnya memfilter `cashierId = user yang login`, sehingga ketika shift dibuka/diisi transaksi oleh akun lain lalu dibuka oleh akun berbeda (mis. owner yang join shift), daftar transaksi tampil kosong. Filter `cashierId` dihapus di mode shift sehingga menampilkan semua transaksi pada shift aktif tersebut, lintas kasir yang join.

## [1.8.1] - 2026-06-20

### Changed
- **Struk penjualan dirapatkan & ganti font:** font struk diganti dari `monospace` ke jenis condensed (`Arial Narrow`) dengan `letter-spacing` dirapatkan (-0.4px) dan `line-height` lebih padat, sehingga karakter tidak terlalu renggang (`receipt-print.tsx`).

### Added
- **Nama pelanggan & diskon tampil di struk:** nama customer (jika ada) kini ikut tercetak di struk penjualan, baik saat checkout (`checkout-modal.tsx` → `pos-client.tsx`) maupun cetak ulang dari riwayat transaksi (query history di-`leftJoin` ke tabel `customers`). Baris diskon juga dipastikan muncul saat transaksi memiliki potongan.

## [1.8.0] - 2026-06-20

### Added
- **Split payment (bayar gabungan) di POS web:** kasir dapat melunasi satu transaksi dengan beberapa metode pembayaran sekaligus pada modal pembayaran (`checkout-modal.tsx`).
  - Tombol "Bayar Gabungan (Split)" mengalihkan modal ke editor multi-metode; "← Bayar Tunggal" untuk kembali ke mode lama.
  - Setiap baris pembayaran punya dropdown metode + input nominal (format ribuan otomatis). Tombol "+ Tambah Metode" menambah baris, dan tombol "Isi Sisa" mengisi kekurangan ke baris terkait.
  - Ringkasan menampilkan Total Terbayar, Sisa (jika kurang), dan Jumlah Hutang (jika ada baris bertipe Hutang). Tombol proses aktif saat total terbayar ≥ total transaksi.
  - Baris bertipe Hutang menghasilkan pencatatan piutang otomatis (memerlukan customer terpilih) lengkap dengan input jatuh tempo; kembalian dihitung saat ada kelebihan bayar tunai tanpa hutang.
  - Rincian semua metode pembayaran dikirim ke `POST /api/pos/transactions` lewat array `payments` (sudah didukung `TransactionService`), serta tercetak per baris di struk penjualan dan ringkasan transaksi berhasil.

## [1.7.1] - 2026-06-20

### Changed
- **Semua fitur terkait pelanggan kini dapat diakses oleh semua role:** seluruh batasan role pada modul pelanggan dihapus, sehingga setiap pengguna yang sudah login (termasuk KASIR dan GUDANG) dapat:
  - Menambah, mengubah, dan menghapus data customer (`POST/PUT/DELETE /api/bo/customers` & `/api/bo/customers/[id]`).
  - Melihat dan mencatat utang customer serta mencatat pembayaran utang (`POST /api/bo/customers/[id]/debts` & `/api/bo/customers/[id]/debts/[debtId]/pay`).
  - Membuka tab Hutang pada halaman detail customer (sebelumnya hanya OWNER/GM/MANAGER/FINANCE).
  - Mengakses Laporan Piutang (`/reports/receivables`) — menu sidebar dan halaman tidak lagi dibatasi role.

## [1.7.0] - 2026-06-20

### Added
- **Master Data Metode Pembayaran — CRUD lengkap:** halaman `/master-data/payment-methods` untuk mengelola daftar metode pembayaran yang tersedia di kasir.
  - Tabel menampilkan nama dan tipe (Tunai, Transfer Bank, E-Wallet, QRIS, Hutang).
  - Form tambah/edit di modal dengan field nama dan dropdown tipe.
  - Konfirmasi hapus; metode pembayaran yang sudah dipakai pada transaksi tidak dapat dihapus.
  - API route `GET/POST /api/bo/master-data/payment-methods` dan `PATCH/DELETE /api/bo/master-data/payment-methods/[id]` dengan auth, validasi Zod, cek duplikat nama, dan proteksi role (hanya OWNER & GM).
  - Menu "Metode Pembayaran" ditambahkan ke grup Master Data pada sidebar.

## [1.6.0] - 2026-06-20

### Added
- **Diskon nominal per transaksi di POS web:** kasir dapat memasukkan potongan harga berupa nominal rupiah langsung (bukan persentase) pada modal pembayaran (`checkout-modal.tsx`).
  - Input "Diskon (Rp)" dengan format ribuan otomatis. Diskon dibatasi maksimal sebesar subtotal (tidak bisa membuat total negatif).
  - Ringkasan pembayaran menampilkan Subtotal, Diskon, dan Total bersih. Validasi jumlah bayar, tombol "Uang Pas", pecahan cepat, dan jumlah hutang semuanya mengikuti total bersih (setelah diskon).
  - Diskon dikirim ke `POST /api/pos/transactions` lewat `totals.discountTotal` (subtotal kotor di `totals.subtotal`, total bersih di `totals.grandTotal`) dan tersimpan di `transactions.discount_amount`.
  - Struk penjualan mencetak baris Subtotal dan Diskon saat diskon > 0.

## [1.5.0] - 2026-06-20

### Changed
- **Penjualan produk stok 0 (oversell) kini diizinkan — stok minus tetap tercatat:** kasir dapat menjual produk meski stok 0 atau tidak mencukupi, tanpa otorisasi tambahan. Stok agregat (`product_stocks.qty`) akan turun menjadi negatif dan tercatat apa adanya.
  - **Backend:** `TransactionService.createTransaction` tidak lagi memblokir transaksi karena stok kurang (validasi inventory dihapus). `StockService.deductStock` menerima parameter `allowNegative` (transaksi POS mengirim `true`): batch yang ada dikuras via FIFO, sisa kekurangan dicatat sebagai stok minus. Jika row aggregate belum ada, dibuat baru dengan nilai negatif (upsert).
  - **HPP porsi oversell:** untuk qty yang melebihi stok batch, HPP dihitung dari `products.defaultCostPrice`.
  - **FIFO engine (`fifoDeduct`):** menerima flag `allowNegative` dan mengembalikan `shortfallQty` (qty yang tidak tertutup batch). Tanpa flag, perilaku lama (gagal jika stok kurang) tetap dipertahankan untuk retur, barang rusak, dan reverse-receiving.
  - **POS web:** dialog UOM & harga tidak lagi memblokir qty melebihi stok — qty bisa dinaikkan bebas, satuan dengan stok habis tetap dapat dipilih, dengan peringatan "Stok akan tercatat minus". Kartu produk menandai stok 0/minus dengan warna amber.

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
