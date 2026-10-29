<!-- markdownlint-disable MD013 -->

# Klaim Pekerjaan Paralel

Papan tulis bersama untuk beberapa orang/agent yang mengerjakan repo ini sekaligus.
Isinya tiga hal: **kunci migrasi**, **siapa sedang pegang apa**, dan **peta domain**
untuk membagi pekerjaan supaya tidak saling menabrak.

## Cara mengklaim

**Klaim di-commit ke `main` lebih dulu, sebelum branch kerjanya dibuat.**

Ini bukan formalitas. Klaim yang ditulis di branch sendiri tidak terlihat oleh siapa
pun sampai branch itu di-merge — padahal justru saat itulah tabrakannya sudah terjadi.
Hanya klaim yang sudah ada di `main` yang bisa dibaca orang lain sebelum mereka mulai.

```bash
# di worktree utama, di main
# 1. tambah satu baris di tabel bawah, 2. commit, 3. push
git commit -am "klaim: feat/laporan-kas" && git push
pnpm worktree:new feat/laporan-kas
```

Kalau dua orang menambah baris bersamaan, konfliknya sepele: simpan dua-duanya.

Setelah pekerjaan ter-merge, **hapus barisnya** — di commit `klaim: lepas <branch>` yang sama dengan rilisnya, jangan ditunda. (Klaim `docs/usulan-laporan` sempat menggantung dari 2026-10-03 sampai 2026-10-11 padahal kodenya sudah tayang di 1.107.31.) Tabel yang penuh klaim mati sama tidak
bergunanya dengan tabel kosong.

---

## Kunci migrasi

> **Pemegang: `—`** (aliran `petshop`)
>
> Aliran HRIS (`auth`, `hris`, `logistics`): **`—`**. Satu kunci per aliran; aliran HRIS ber-merge ke `dev_hris`, bukan `main`.

**Hanya satu branch yang boleh menambah migrasi DB pada satu waktu.** Yang mau menambah
migrasi menulis nama branch-nya di baris atas, commit ke `main`, lalu kerjakan. Lepaskan
(kembalikan ke `—`) begitu migrasinya ter-merge.

Kenapa dikunci padahal sudah ada `pnpm migrations:check`: cek itu menangkap tabrakan
*sesudah* terjadi, dan memperbaikinya berarti menomori ulang migrasi yang mungkin sudah
dijalankan orang lain di DB lokalnya. Menghindari tabrakan jauh lebih murah daripada
membereskannya. Perubahan `packages/db/src/schema/**` tanpa migrasi baru tidak perlu kunci.

---

## Klaim aktif

Kolom **Siapa** dan **Mulai** diisi saat pekerjaannya benar-benar diambil. Baris tanpa
pengambil = sudah dipetakan, belum dikerjakan.

| Branch | Siapa | Domain | Path utama | Mulai |
|---|---|---|---|---|
| refactor/hris-english-identifiers | Claude (owner) | HRIS (app baru) + skrip repo — nama teknis Indonesia → Inggris | `packages/db-roles/**`, `apps/hris/tests/**`, `scripts/{check-migrations,check-module-boundaries,new-worktree}.mjs` — branch induk `dev_hris`; tanpa migrasi, tanpa perubahan perilaku | 2026-10-29 |

_Tidak ada klaim aktif. `feat/diskon-persen` sudah ter-merge & tayang (PR #23, squash `8a380917`, deploy VPS hijau 2026-10-21): opsi **Diskon %** di popup Diskon per barang — kasir ketik persen bulat 1–100, potongan = persen × nilai baris **dibulatkan ke bawah** (favor toko). Nilai uang tetap `amount` rupiah; `percent` hanya untuk ditampilkan (kolom baru `transaction_item_discounts.percent`, migrasi `0048`, nullable = diskon rupiah). Struk cetak "Diskon 10%" (cetak pertama & cetak ulang via `manualDiscountPercentOfItemSql`), Laporan Riwayat Diskon beri akhiran "(10%)". Kunci migrasi 0048 sudah dilepas. **Tayang — menunggu uji coba owner** (belum diklik di layar sebelum rilis). Catatan: diskon 100% membuat baris tampil gaya hadiah "GRATIS" di struk (jujur, diterima); batas diskon kasir `maxPercentOfLine` masih tanpa batas. `feat/so-hitung-ulang` sudah ter-merge & tayang (lihat di bawah). SO Besar reset halaman diperbaiki 1.107.83; Riwayat Pelunasan (filter metode + Nota Asal diklik) dirilis 1.107.82; P4 & IBT perjelas tidak dipenuhi juga sudah dirilis — lihat tabel riwayat di bawah._

`feat/so-hitung-ulang` **sudah ter-merge ke `main` & tayang** (PR #20, squash `d7194759`, deploy VPS hijau 2026-10-21): tombol **"Hitung Ulang"** pada SO Besar (`type=FULL`) yang sudah `APPROVED` → dokumen koreksi tertaut ke SO induk (nomor `SOR-…`, kolom `recount_of_so_id`), catatan wajib. Pembanding = stok sistem terkini (transaksi tercatat saling meniadakan; kolom "Mutasi sejak SO induk" menjelaskan selisih). Menyetujui per item mengoreksi stok lewat `/items/decide` + `applySOStockAdjustment`. Dikecualikan dari ringkasan nilai selisih laporan (`recount_of_so_id IS NULL`). Migrasi `0047_so_recount_link` (kunci migrasi sudah dilepas). **Tayang — menunggu uji coba owner** (belum diklik di layar sebelum rilis). Potongan changelog `changelog.d/feat-so-hitung-ulang.md` menunggu `changelog:release` berikutnya untuk dapat nomor versi. Batasan R3 (bila SO induk sudah lewat resolusi pembebanan karyawan, balik stok TIDAK otomatis balik pembebanan uang) dicatat untuk owner — di luar cakupan. Spec: `docs/work/specs/2026-10-21-so-hitung-ulang-design.md`.

### Pekerjaan 10–11 Okt 2026 tanpa klaim saat itu (dicatat susulan)

Dikerjakan Claude atas permintaan owner, langsung di folder utama (bukan worktree) dan **tanpa
commit klaim** di `main` sebelum mulai. Dicatat susulan 2026-10-11 supaya jejaknya tetap ada.
**Semua sudah ter-merge & tayang — tidak ada yang masih berjalan.** Branch-nya ada di remote.

| Branch | Domain | Path utama | Rilis | Tanggal | Dokumen |
|---|---|---|---|---|---|
| fix/promo-gratis-gift-flag | Promo & diskon + POS & transaksi | Promo **"beli X gratis Y"** selalu ditolak saat bayar ("Promo ... sudah tidak berlaku, keranjang dihitung ulang"): skema Zod baris nota di `app/api/pos/transactions/route.ts` membuang `promo.gift`, sehingga baris hadiah dikira barang beli berpromo (`promo-judge.ts:101`). Tambah `gift: z.boolean().optional()` + test regresi jalur HTTP di `route.test.ts`. Ditemukan dari promo nyata "Oricat kotak promo". Tanpa migrasi; PR #31 squash `efd6f465` (tayang sejak merge 2026-10-27, versi dicatat di 1.107.99). **Tayang — menunggu uji coba owner**. | 1.107.99 | 2026-10-29 | — |
| main (langsung) | Infra | `infra/apps/docker-compose.yml`: service `waha` dipindah ke profil `whatsapp` supaya tidak dinyalakan ulang oleh `docker compose up -d` saat deploy (belum dipakai, ±950 MB RAM; container dimatikan manual 2026-10-28). Commit `51d0e0d2`. Tanpa migrasi. | 1.107.99 | 2026-10-29 | — |
| fix/shift-pelunasan-piutang | Shift | Detail Shift (Riwayat Shift) kini menjelaskan pelunasan piutang tunai yang membuat **Kas Expected** tidak cocok dengan jumlah kolom "Kas Penjualan": baris rekonsiliasi `Total Kas Penjualan + Pelunasan Piutang Tunai = Kas Expected` di bawah tabel Breakdown Kasir, tab baru **"Pelunasan Piutang"** (pelanggan/nota/metode/penerima/nominal, ditandai tunai vs non-tunai + total tunai), tooltip rumus. Tampilan saja — data `debtPaymentsReceived`/`totalDebtPaymentCash` sudah dikirim `api/bo/shifts/[id]`, berlaku untuk shift berjalan & tertutup. `app/(dashboard)/shift-history/_components/shift-history-client.tsx`, `lib/new-features.ts`. Tanpa migrasi; sesi solo, diklaim di branch (PR #30 squash `c5404103`); typecheck/lint/CI hijau. Pemicu: owner hitung manual kas Toko Pusat tak cocok (gap Rp 256.000 = pelunasan piutang tunai tak terlihat). **Tayang — menunggu uji coba owner**. | 1.107.98 | 2026-10-27 | — |
| fix/popup-shift-retur | Shift + Transaksi & retur | Popup daftar nota di balik angka "Trx" Breakdown Kasir (Riwayat Shift) kini mengurangi retur aktif — nominal bersih + baris retur + nilai kotor dicoret, sama seperti Riwayat Transaksi. Sebelumnya tampil kotor (payableAmount apa adanya). `api/bo/shifts/[id]/transactions/route.ts` (join `returns` aktif `cancelledAt IS NULL`, kirim `returnAmount` — logika sama dgn `/api/bo/transactions`), `shift-transactions-modal.tsx`. Tanpa migrasi; sesi solo, diklaim di branch (PR #29 squash `bd7408a7`); typecheck/lint/CI hijau. **Tayang — menunggu uji coba owner**. Catatan: popup **Laba Rugi per kelas harga** (`tier-transactions`) sengaja belum diubah — retur satu-nota belum tentu milik item tier yang sama, perlu keputusan pemetaan retur→tier. | 1.107.97 | 2026-10-26 | — |
| feat/transaksi-tier-kolom | Transaksi + Shift | Kolom **Tier** (kelas harga unik per nota, inisial ret/res/gro/mem, campuran berjejer) di Riwayat Transaksi & popup Transaksi per kasir; popup diperlebar max-w-5xl — helper `lib/tier-initials.ts` + `components/ui/tier-tags.tsx`, endpoint `api/bo/{transactions,shifts/[id]/transactions}` kirim distinct `priceTier` per nota. Tanpa migrasi; sesi solo, diklaim di branch. **Tayang — menunggu uji coba owner** (belum diklik di layar sebelum rilis) | 1.107.96 | 2026-10-25 | — |
| feat/shift-lintas-cabang | Shift + Laporan + Transaksi | (1) OWNER/GM pindah cabang walau shift terbuka (popup peringatan) — `pos/select-branch`, penukar cabang BO; (2) angka Trx Breakdown Kasir diklik → popup nota (`api/bo/shifts/[id]/transactions`, `shift-transactions-modal.tsx`); (3) Jml Transaksi per kelas harga di Laba Rugi diklik → popup nota (`api/bo/reports/profit-loss/tier-transactions`, `tier-transactions-modal.tsx`, `tier-breakdown-client.tsx`); (4) inisial kelas harga (ret/res/gro) di samping subtotal Detail Transaksi (layar saja, bukan struk) — tanpa migrasi; 4 fitur digabung satu rilis atas perintah owner. **Tayang — menunggu uji coba owner** (belum diklik di layar sebelum rilis) | 1.107.95 | 2026-10-25 | — |
| fix/manajemen-harga-tampil-modal | Master data | `api/bo/master-data/prices/route.ts` (GET: baris satuan non-dasar yang hanya punya modal dari terima PO ikut tampil, bukan cuma yang punya harga jual) — tanpa migrasi; diklaim di main lokal; dirilis sendiri atas permintaan owner (hanya perbaikan ini; pekerjaan promo ditahan, tidak ikut di-push). **Tayang — menunggu uji coba owner** | 1.107.77 | 2026-10-15 | — |
| feat/retur-pintu-pilihan → feat/retur-batalkan → feat/retur-internal-db → feat/retur-internal-service → feat/retur-internal-layar → feat/retur-internal-saldo → feat/retur-internal-revisi-harga → feat/retur-internal-revisi-laporan → feat/retur-internal-revisi-layar | Retur supplier (pintu, batalkan & tarik) + Retur internal (Barang Dikembalikan, Saldo Internal, Revisi Harga Beli, laporan) | `purchase-orders/retur/**`, `lib/services/supplier-return-*`, `lib/services/internal-return-*.ts`, `internal-credit-service.ts`, `internal-price-revision-service.ts`, `api/{bo,pos}/internal-returns/**`, `components/internal-returns/**`, `api/bo/internal-transfers/[id]/status` (terima transfer), `stock-ledger.ts`, `report-service.ts`, migrasi `0033`–`0035` (RI3–RI9, branch bertumpuk, satu rilis gabungan atas keputusan owner; tiap branch diklaim di main sebelum mulai, kunci migrasi dilepas saat rilis; **belum diuji di layar sebelum rilis**) | 1.107.62 | 2026-10-11 | `docs/work/specs/2026-10-11-retur-internal-design.md`, `docs/work/backlog/2026-10-11-retur-internal.md` |
| fix/nomor-transaksi-kembar | POS & transaksi | `lib/services/transaction-service.ts` (coba ulang ≤5× hanya untuk constraint `transactions_trx_number_unique`; kunci idempotensi tidak diulang; format nomor tetap), tes `trx-number-retry.integration.test.ts` — tanpa migrasi; diklaim di main sebelum mulai; **tayang — menunggu uji coba owner** | 1.107.68 | 2026-10-11 | `docs/work/backlog/2026-10-11-daftar-tunda-owner.md` |
| feat/jasa-tanda-produk → feat/jasa-groomer-kucing → feat/jasa-grooming-order → feat/jasa-delivery-ongkir → feat/jasa-tab-grooming → feat/jasa-tambah-belanja → feat/jasa-riwayat-bonus (J1–J4, bertumpuk, satu rilis) | Jasa & grooming + Master data produk + Inventory & stok + POS & transaksi + Laporan | migrasi `0037`–`0041`; `lib/services/stock-service.ts` (penjaga jasa), `transaction-service.ts`, `grooming-*-service.ts`, `lib/grooming-bonus.ts`, `pos/(authenticated)/grooming/**`, `components/pos/cart-store.ts`, `(dashboard)/reports/grooming/**`, `settings/groomers/**`, `master-data/pets/**` — lima branch pertama diklaim di main sebelum mulai; J3c & J4 diklaim di branch (catatan ke main tidak bisa dikirim dari sesi itu). **Tayang — menunggu uji coba owner**; dirilis atas perintah owner tanpa uji di layar lebih dulu | 1.107.69 | 2026-10-12 | [`specs/2026-10-11-jasa-grooming-design.md`](../work/specs/2026-10-11-jasa-grooming-design.md) |
| feat/antar-barang-pengantar | Jasa & grooming + POS & transaksi | migrasi `0042`; `components/pos/checkout-modal.tsx` (pilih pengantar + Gratis ongkir bila ada ongkir), `transaction-service.ts` & `grooming-order-service.ts` (ongkir wajib pengantar; antar barang; gratis ongkir), laporan Delivery & Antar Barang — diklaim di main sebelum mulai. **Tayang — menunggu uji coba owner** | 1.107.70 | 2026-10-12 | [`specs/2026-10-11-jasa-grooming-design.md`](../work/specs/2026-10-11-jasa-grooming-design.md) butir 28–34 |
| docs/promo-rancangan → feat/diskon-per-barang-mesin → -server → -retur → -layar → -struk → -jalur-lain → -laporan → -periksa (P0, P1a–P1g, bertumpuk, satu rilis) | Promo & diskon + POS & transaksi + Transaksi & retur + Shift + Laporan | migrasi `0043` (`transaction_item_discounts`); `lib/manual-discount.ts`, `lib/line-net-value.ts`, `lib/receipt-lines.ts`, `lib/discount-history.ts`; `lib/services/line-discount-service.ts`, `transaction-service.ts`, `retur-service.ts` (uang kembali = nilai dibayar), `transaction-edit-service.ts`; `components/pos/**` (tombol Diskon per barang, diskon total nota dihapus), tab Grooming, tiga penyusun struk, "Total Diskon" shift, `(dashboard)/reports/discount-history/**` — klaim ditulis di branch karena owner menunda push dokumen ke `main`. **Tayang — menunggu uji coba owner** (belum diklik di layar sebelum rilis) | 1.107.75 | 2026-10-13 | [`specs/2026-10-12-promo-otomatis-design.md`](../work/specs/2026-10-12-promo-otomatis-design.md) |
| feat/promo-mesin → feat/promo-layar-bo → feat/promo-server → feat/promo-layar-kasir → feat/promo-struk-jalur-lain → feat/promo-laporan → feat/promo-periksa (P2a–P2g, bertumpuk, satu rilis) | Promo & diskon + POS & transaksi + Laporan | migrasi `0044` (`promos`, `promo_branches`, `promo_conditions`, `promo_rewards`); `lib/promo/promo-engine.ts` (mesin promo), `promo-service.ts` + `api/bo/promos/**` + `(dashboard)/promos/**` (layar Promo + saklar darurat), `promo-judge.ts` + `promo-sale-service.ts` + `transaction-service.ts` (server sebagai hakim) + `api/pos/promos`, `components/pos/promo-store.ts` + `promo-cart.ts` + `cart-panel.tsx`/`checkout-*` (layar kasir), `lib/receipt-lines.ts` + `receipt-data.ts` + `promo-server.ts` (nama promo di struk), `lib/promo/promo-report.ts` + `promo-report-service.ts` + `(dashboard)/reports/promo/**` (Laporan Promo) — bertumpuk, satu rilis P2; **P2c membuat server menolak promo bila layar kasir lama → P2a–P2g wajib tayang bersama**. **Tayang — menunggu uji coba owner** (belum diklik di layar sebelum rilis) | 1.107.78 | 2026-10-15 | [`specs/2026-10-12-promo-otomatis-design.md`](../work/specs/2026-10-12-promo-otomatis-design.md), [`backlog/2026-10-12-promo-otomatis.md`](../work/backlog/2026-10-12-promo-otomatis.md) |
| fix/so-besar-reset-halaman | Inventory & opname | `inventory/stock-opname/_components/so-full-input-table.tsx` (prop `resetPageKey={search\|statusFilter}` di DataTable) — tanpa migrasi; sesi solo, diklaim di branch; tabel input SO Besar tidak lagi lompat ke halaman 1 saat Kunci/Simpan/Setujui/Tolak. typecheck 0, lint 0 error/51 warning, 11 tes DataTable lulus. **Tayang — menunggu uji coba owner** (belum diklik di layar sebelum rilis) | 1.107.83 | 2026-10-20 | — |
| feat/riwayat-pelunasan-filter-nota | Laporan (pelunasan) + Transaksi & retur | `reports/debt-payments/_components/debt-payments-client.tsx` (filter metode bayar dari data termuat + Nota Asal jadi tautan ke detail nota di tab baru), `transactions/page.tsx` & `transactions/_components/transaction-list-client.tsx` (param `?trx=` langsung membuka modal `TransactionDetailModal` yang sudah ada), `lib/new-features.ts` (`fitur/pelunasan-filter-metode`, `fitur/pelunasan-nota-klik`) — tanpa migrasi; sesi solo, diklaim di branch; typecheck+lint hijau, diverifikasi DB salinan prod (5 metode bayar, semua pelunasan tertaut nota). **Tayang — menunggu uji coba owner** (belum diklik di layar sebelum rilis) | 1.107.82 | 2026-10-18 | — |
| feat/ibt-perjelas-tidak-dipenuhi | Purchase order (Transfer Internal) + Inventory (Mutasi Stok) | `purchase-orders/internal/**` (detail + daftar), `lib/ibt-fulfillment.ts` (+tes), `inventory/stock-logs/_components/stock-logs-client.tsx` (baca filter dari URL) — tanpa migrasi; diklaim di main sebelum mulai; kejelasan tampilan "item tidak dipenuhi" (stok tak berpindah, tidak ditagih) + tautan bukti Mutasi Stok. **Tayang — menunggu uji coba owner** (belum diklik di layar sebelum rilis; DB salinan prod membuktikan IBT-20261015-0001 = 2 item) | 1.107.81 | 2026-10-18 | [`specs/2026-10-18-ibt-perjelas-tidak-dipenuhi.md`](../work/specs/2026-10-18-ibt-perjelas-tidak-dipenuhi.md) |
| feat/promo-gratis-mesin → -layar-bo → -server → -layar-kasir → -struk-retur → -jalur-lain (P4a–P4f, bertumpuk, satu rilis) | Promo & diskon + POS & transaksi + Transaksi & retur + Laporan | migrasi `0046` (`transaction_items.promo_package_no` untuk retur paket utuh); `lib/promo/promo-engine.ts` (hadiah `GRATIS` → `PromoResult.gifts` + bundling banyak syarat), `promo-form.ts`/`promo-service.ts` + `(dashboard)/promos/**` (bentuk beli X gratis Y & bundling), `promo-judge.ts` + `promo-sale-service.ts` + `transaction-service.ts` (hakim: baris gratis + nomor grup paket), `api/{bo,pos}/promos`, `components/pos/promo-store.ts` + `promo-cart.ts` + `cart-panel.tsx`/`checkout-*` (baris hadiah gratis otomatis), `lib/receipt-lines.ts` (struk hadiah "GRATIS"), `retur-service.ts` (retur paket utuh) + `transaction-edit-service.ts` (koreksi kunci baris paket), `promo-report-service.ts` (laporan hadiah gratis sbg potongan/laba) — bertumpuk, satu rilis P4; **P4c menolak promo paket bila layar kasir lama → P4a–P4f tayang bersama**. **Tayang — menunggu uji coba owner** (belum diklik di layar sebelum rilis) | 1.107.80 | 2026-10-18 | [`specs/2026-10-12-promo-otomatis-design.md`](../work/specs/2026-10-12-promo-otomatis-design.md), [`backlog/2026-10-12-promo-otomatis.md`](../work/backlog/2026-10-12-promo-otomatis.md) |
| feat/promo-kuota-mesin → -layar-bo → -server → -layar-kasir → -jalur-lain (P3a–P3e, bertumpuk, satu rilis) | Promo & diskon + POS & transaksi + Laporan | migrasi `0045` (kolom `quota_kind`/`quota_per_branch`/`require_stock` di `promos` + tabel `promo_branch_usage`); `lib/promo/promo-engine.ts` (kuota & syarat stok di mesin), `promo-form.ts`/`promo-service.ts` (isi & tampil kuota), `promo-sale-service.ts` + `void-service.ts` (hakim: kunci `promo_branch_usage` FOR UPDATE, tambah pemakaian, batal kembalikan jatah, retur hangus), `api/{bo,pos}/promos`, `components/pos/promo-store.ts` + `promo-cart.ts` (layar kasir berhenti sendiri saat jatah/stok habis), `lib/promo/promo-report.ts` + `(dashboard)/reports/promo/**` (jatah terpakai/sisa per cabang) — bertumpuk, satu rilis P3; **P3c menolak promo berkuota bila layar kasir lama → P3a–P3e wajib tayang bersama**. **Tayang — menunggu uji coba owner** (belum diklik di layar sebelum rilis) | 1.107.79 | 2026-10-18 | [`specs/2026-10-12-promo-otomatis-design.md`](../work/specs/2026-10-12-promo-otomatis-design.md), [`backlog/2026-10-12-promo-otomatis.md`](../work/backlog/2026-10-12-promo-otomatis.md) |
| fix/cari-produk-per-kata | Master data produk + Inventory & stok + Laporan | pencarian produk per kata diratakan: `lib/search-words.ts` (layar) & `lib/product-search.ts` (server) dipakai di Master Harga + ekspor harga, Cetak Barcode, Stock Opname (tabel input, saran, kandidat), `components/ui/product-{select,multi-select}.tsx`, Log Penyesuaian Stok, Peringatan Margin, laporan Utang Stok — tanpa migrasi; diklaim di main sebelum mulai. **Tayang — menunggu uji coba owner** (belum dilihat di layar sebelum rilis). Pencarian bukan produk & reset halaman di layar lain belum diratakan | 1.107.74 | 2026-10-12 | — |
| fix/laporan-grooming-tanggal | Laporan | `(dashboard)/reports/grooming/page.tsx` — saringan tanggal Riwayat Grooming & Bonus memakai `isCalendarDay` (tanggal yang tidak ada di kalender kembali ke bulan berjalan); tanpa migrasi; diklaim di main sebelum rilis. **Tayang — menunggu uji coba owner** | 1.107.76 | 2026-10-13 | — |
| fix/produk-halaman-reset | Master data produk | `components/ui/data-table.tsx` (prop opsional `resetPageKey` — tabel lain tidak berubah), `lib/search-words.ts` (pencarian per kata), `(dashboard)/master-data/products/_components/product-{client,table}.tsx` — tanpa migrasi; diklaim di main sebelum mulai. **Tayang — menunggu uji coba owner** (belum dilihat di layar sebelum rilis). ±13 layar daftar lain masih memakai pencarian frasa utuh & reset halaman bawaan — belum diratakan | 1.107.73 | 2026-10-12 | — |
| feat/mesin-berat | Master data produk + Penjualan grosir (tonase surat jalan) | `lib/product-weight.ts` (mesin berat — satu-satunya tempat aturan berat per satuan: satuan besar = isi × berat satuan terkecil; GRAM/KG pasti), `api/bo/bulk-sale-products`, `api/bo/transactions/[trxNumber]/detail`, `(dashboard)/master-data/products/**` (tanda "Belum ada berat", berat tab Satuan dihitung otomatis) — tanpa migrasi; diklaim di main sebelum mulai. **Tayang — menunggu uji coba owner** (belum dilihat di layar sebelum rilis) | 1.107.72 | 2026-10-12 | [`specs/2026-10-12-mesin-berat-design.md`](../work/specs/2026-10-12-mesin-berat-design.md) |
| feat/mesin-ongkir | Jasa & grooming + POS & transaksi + Laporan | `lib/ongkir.ts` & `lib/ongkir-server.ts` (mesin ongkir + tes penjaga), struk (`escpos-receipt`, `receipt-image`, `receipt-print`, cetak ulang), pengaturan nilai gratis ongkir, rumus pendapatan `report-service.ts` — tanpa migrasi; diklaim di main sebelum mulai. **Tayang — menunggu uji coba owner** | 1.107.71 | 2026-10-12 | [`specs/2026-10-11-jasa-grooming-design.md`](../work/specs/2026-10-11-jasa-grooming-design.md) butir 35–38 |
| feat/badge-baru-di-halaman | Navigasi | kunci `fitur/...` di `lib/new-features.ts` + `<NewBadge>` di tambahan dalam halaman (foto bukti, daftar pilih kiriman, Saldo Internal, Estafet, tab Belum Ada Harga) — tanpa migrasi; diklaim di main sebelum mulai; **tayang — menunggu uji coba owner** | 1.107.67 | 2026-10-11 | `apps/backoffice/lib/new-features.ts` |
| feat/badge-baru → feat/retur-internal-daftar-kiriman | Navigasi + Retur internal | `lib/new-features.ts`, `components/ui/new-badge.tsx`, sidebar & navigasi POS (tanda "Baru" 7 hari); `listReturnableTransfers`, `api/{bo,pos}/internal-returns/candidates`, `components/internal-returns/transfer-picker.tsx` (daftar pilih kiriman, terbaru di atas) — dua branch bertumpuk, satu rilis, tanpa migrasi; diklaim di main sebelum mulai; **tayang — menunggu uji coba owner** | 1.107.66 | 2026-10-11 | `docs/work/backlog/2026-10-11-daftar-tunda-owner.md` |
| chore/deploy-buang-image-lama | Infra deploy | `.github/workflows/deploy-vps.yml` (image aplikasi lama dibuang otomatis, sisakan 6 terbaru), `docs/ops/**`, `docs/work/backlog/2026-10-11-daftar-tunda-owner.md` (diklaim di main sebelum mulai; tanpa perubahan aplikasi/DB) | 1.107.65 | 2026-10-11 | `docs/ops/README.md` |
| feat/foto-bukti-transfer | Keuangan & kas | `components/ui/proof-photo-field.tsx`, `lib/proof-photo.ts`, `api/pos/uploads` (hanya gambar), `api/bo/customers/[id]/debts/**`, `api/bo/supplier-payables/[id]/pay`, `purchase-orders/supplier-payables/**`, `master-data/customers/[id]`, `reports/{receivables,debt-payments}`, migrasi `0036` (diklaim di main + kunci migrasi sebelum mulai, dilepas saat rilis; **tayang — menunggu uji coba owner, belum diuji di layar**) | 1.107.64 | 2026-10-11 | `docs/work/specs/2026-10-11-foto-bukti-transfer-design.md` |
| fix/mutasi-stok-batal-retur | Laporan (stok) | `lib/services/stock-ledger.ts` (baris `RETURN_CANCEL_OUT`), `inventory/stock-logs/_components/stock-logs-client.tsx`, `reports/stock-overview/_components/mutation-format.ts` (tanpa migrasi; diklaim di main sebelum mulai; belum diuji di layar sebelum rilis) | 1.107.63 | 2026-10-11 | `docs/work/backlog/2026-10-11-retur-internal.md` ("Perbaikan terpisah") |
| fix/void-lunasi-utang-stok | Inventory & stok | `lib/services/void-service.ts`, `stock-service.ts` (addStock `settleShortfalls`, sumber `VOID_REVERSAL`), `lib/po-batch-updater.ts` | 1.107.52 | 2026-10-10 | CHANGELOG 1.107.52 |
| fix/utang-stok-filter | Inventory & stok | `(dashboard)/inventory/stock-shortfalls/**` | 1.107.53 | 2026-10-10 | CHANGELOG 1.107.53 |
| feat/timeline-pihak | Laporan (stok) | `lib/services/stock-mutation-summary.ts`, `reports/stock-overview/_components/stock-mutation-timeline-dialog.tsx` (`stockLedgerUnion` tidak diubah) | 1.107.54 | 2026-10-10 | CHANGELOG 1.107.54 |
| feat/hutang-supplier | Keuangan & kas + Purchase order | `purchase-orders/supplier-payables/**`, `purchase-orders/internal/payables/**`, `api/bo/supplier-payables/**`, `api/bo/inter-branch-payables/**`, `lib/supplier-due-date.ts`, `lib/payment-date.ts` | 1.107.55 | 2026-10-10 | `docs/work/specs/2026-10-10-hutang-supplier-design.md` |
| feat/alur-po-baru | Purchase order | `purchase-orders/**` (daftar, terima, detail), `api/bo/purchase-orders/[id]/{receive,cancel-receiving}`, `lib/po-stage*.ts`, `lib/po-payment-status.ts`, `lib/po-batch-updater.ts` | 1.107.56 | 2026-10-10 | `docs/work/specs/2026-10-10-alur-po-baru-design.md` |
| feat/retur-alasan-tidak-datang | Retur supplier | alasan `TIDAK_DATANG` di `components/supplier-returns/types.ts`, `lib/services/supplier-return-service.ts` (RI2, tanpa migrasi; diklaim di main sebelum mulai) | 1.107.61 | 2026-10-11 | `docs/work/backlog/2026-10-11-retur-internal.md` |
| feat/supplier-tanpa-hapus | Master data supplier | master-data/suppliers (tombol Hapus dihapus), `api/bo/master-data/suppliers/[id]` DELETE → 405 (RI1b, tanpa migrasi) | 1.107.60 | 2026-10-11 | `docs/work/backlog/2026-10-11-retur-internal.md` |
| feat/supplier-nonaktif | Master data supplier | migrasi `0032` `suppliers.is_active`, master-data/suppliers, pilihan supplier PO & retur (RI1; diklaim + kunci migrasi, dilepas saat rilis) | 1.107.59 | 2026-10-11 | `docs/work/backlog/2026-10-11-retur-internal.md` |
| feat/retur-supplier | Retur supplier | `purchase-orders/supplier-returns/**`, `pos/(authenticated)/produk/retur-supplier/**`, `api/{bo,pos}/supplier-returns/**`, `lib/services/supplier-return-*.ts`, migrasi `0031` (diklaim + kunci migrasi 2026-10-11, dilepas saat rilis) | 1.107.58 | 2026-10-11 | `docs/work/specs/2026-10-10-retur-supplier-design.md` |
| feat/estafet-shift | Shift & kasir | `components/pos/settlement-*.tsx`, `lib/escpos-settlement.ts`, `lib/services/shift-day-recap.ts`, `(dashboard)/shift-history/**` | 1.107.57 | 2026-10-11 | `docs/work/specs/2026-10-11-estafet-shift-design.md` |

Catatan: commit dari laptop owner tercatat atas nama **"Naurakhazzam"** (akun git laptop belum
dibetulkan). Estafet shift mengubah perilaku serah terima kanban #53 (tombol hanya di shift 1)
atas permintaan owner — lihat dokumen estafet.

`feat/inline-edit-batch-stok` **sudah ter-merge ke `main` & di-push** (2026-09-22): koreksi
inline modal/unit batch stok di Laporan Nilai Stok (drill-down cabang → batch), permission baru
`inventory.stock_batch.correct_cost` (OWNER/GM). Qty sisa batch sengaja tetap read-only —
koreksi qty tetap lewat Stock Adjustment (FIFO) supaya aggregate `product_stocks` tidak drift.
Tanpa migrasi DB; permission baru perlu di-seed manual ke produksi
(`pnpm --filter @petshop/db db:seed-permissions` tidak bisa langsung ke prod karena TCP
langsung mati — dieksekusi lewat SQL manual via SSH+docker exec).

`feat/export-customer-csv` **sudah ter-merge ke `main`** (2026-09-21, belum di-push): export
daftar customer ke CSV (`GET /api/bo/customers/export`, ikut filter pencarian aktif) + tombol
"Export CSV" di Master Data > Customer. Tanpa migrasi DB, tanpa perubahan API lain.

`feat/ship-manual-po-internal-pos` **sudah ter-merge ke `main`** (2026-09-17, belum di-push):
task kanban #38 Bagian C. PO Internal yang diproses jadi Bulk Sale di kasir tidak lagi
otomatis naik ke `IN_TRANSIT` (autoShipIbt dicabut dari `TransactionService.createTransaction`)
— berhenti di `APPROVED`, kasir mengonfirmasi kirim manual lewat endpoint baru
`PATCH /api/pos/internal-po/[id]/ship` (qty dikunci lewat `resolveBulkSaleQtyByItem`, helper
yang sudah ada). Sengaja TIDAK merefactor `PATCH /api/bo/internal-transfers/[id]/status` (700+
baris, sensitif finansial) — duplikasi yang tersisa cuma ~15 baris. Drawer kasir dapat tab baru
"Menunggu Pengiriman" (`GET /api/pos/internal-po?scope=awaiting_ship`), badge gabung
pending+awaiting_ship. Tanpa migrasi DB. Belum diuji end-to-end di layar.

`feat/draft-bulk-sale-ke-db` **sudah ter-merge ke `main`** (2026-09-17, belum di-push):
task kanban #38 Bagian B. Draft "Tahan" Bulk Sale dipindah dari localStorage ke DB — draft
berbentuk list snapshot bernama per user (bukan satu draft aktif seperti Bagian A), tabel baru
`bulk_sale_drafts` (migrasi `0025`). API baru `GET/POST /api/bo/bulk-sale-drafts` +
`DELETE /api/bo/bulk-sale-drafts/[id]`; batas 20 draft/user ditegakkan di server. Tipe
`BulkSaleDraft.id` dipertahankan `string` di klien (di-stringify dari serial id server) supaya
komponen drawer tidak perlu berubah. Diverifikasi unit test + query manual ke Postgres
worktree; belum diuji end-to-end di layar.

`feat/draft-po-internal-ke-db` **sudah ter-merge ke `main`** (2026-09-17, belum di-push):
task kanban #38 Bagian A. Draft form pembuatan PO Internal di kasir dipindah dari localStorage
ke DB — sebelumnya draft cuma tersimpan di browser tempat ia diketik, hilang begitu kasir ganti
device/browser. Tabel baru `internal_order_drafts` (migrasi `0024`), satu draft aktif per
(branchId, createdById) lewat unique index + upsert. API baru
`GET/PUT/DELETE /api/pos/internal-order/draft`; `internal-order-draft-storage.ts` jadi wrapper
fetch async, autosave di-debounce 600ms. Diverifikasi unit test + query manual langsung ke
Postgres worktree (upsert idempotent, delete bersih); belum diuji end-to-end di layar (perlu
login POS sungguhan).

`feat/barang-rusak-approval-foto` **sudah ter-merge ke `main`** (2026-09-16, belum di-push):
input barang rusak kasir tidak lagi memotong stok seketika — laporan masuk PENDING (stok
belum tersentuh, costPrice/lossValue item cuma estimasi FIFO baca-saja) sampai OWNER/GM
approve di halaman baru `/inventory/damaged-goods-approval` (tab Menunggu/Disetujui/Ditolak).
Approve memilih tindak lanjut (Musnahkan/Retur Supplier/Jual Diskon/Lainnya) lalu baru
memanggil `StockService.deductStock` sungguhan (nilai FIFO nyata, `allowNegative=false` —
kalau stok ternyata tidak cukup lagi, approval ditolak 409); reject butuh alasan dan tidak
menyentuh stok. Kasir wajib lampirkan foto per item (upload ke `/api/pos/uploads`, endpoint
lama yang sebelumnya cuma dipakai pos-desktop). Laporan Barang Rusak (`/reports/damaged-goods`)
sekarang cuma menampilkan yang APPROVED. Migrasi `0023_damaged_goods_approval`: kolom
status/resolved_by/resolved_at/resolution_action/resolution_notes/rejection_reason di
`damaged_goods`, photo_url di `damaged_goods_items`. Permission baru `damaged_goods.approve`
(OWNER/GM) — **perlu di-seed manual ke produksi setelah deploy** (`pnpm db:seed-permissions`).
Ditemukan saat testing: beberapa produk lama punya `product_stocks.qty` positif tapi nol baris
di `product_stock_batches` (drift lama, bukan bug fitur ini) — approve akan menolak (409) untuk
produk begini sampai batch-nya direkonsiliasi lewat Stock Opname (`applySOStockAdjustment`
otomatis membuat batch koreksi kalau hasil hitung fisik = angka sistem).

`fix/internal-po-riwayat-void` **sudah ter-merge ke `main`** (2026-09-15, belum di-push):
halaman detail PO Internal kini menampilkan riwayat Bulk Sale yang pernah dibuat dari transfer
tersebut lalu dibatalkan (void) — sebelumnya lenyap total dari layar karena void mereset
`convertedTransactionId` ke NULL. Dipicu insiden nyata: `IBT-20260914-0002` diproses jadi Bulk
Sale, di-void, lalu dipenuhi manual di POS tanpa tertaut ke PO-nya, lalu diproses ulang jadi Bulk
Sale kedua yang duplikat (`TRX-20260915-3961`, metode bayarnya salah CASH sehingga sempat
membengkakkan kas settle — dikoreksi manual lewat psql produksi, di luar migrasi). Tanpa migrasi
DB, tanpa endpoint baru.

`refactor/laporan-stok-pagination` **sudah ter-merge ke `main`** (2026-09-15, belum di-push):
Laporan Nilai Stok FIFO & Ringkasan Stok per Produk kepanjangan ke bawah (semua baris dirender
sekaligus, total di paling bawah). Tabel valuasi dimigrasi ke `DataTable` (paginasi 20
baris/halaman, persisted page index); ringkasan per produk dipaginasi manual (baris expandable,
tidak cocok pakai `DataTable` langsung). Total nilai stok (& total utang stok) dipindah ke header
atas. Tanpa migrasi, tanpa endpoint baru.

`feat/laporan-stok-batch-agregat` **sudah ter-merge ke `main` dan ter-push** (2026-09-15):
halaman baru `/reports/stock-overview` ("Ringkasan Stok per Produk") mengagregasi
`product_stock_batches` per produk lintas cabang (bukan per produk×cabang seperti Laporan Nilai
Stok FIFO), dengan drill-down per cabang lalu per batch — termasuk utang stok terbuka dari
`stock_shortfalls`, di-union (bukan inner join) supaya cabang yang kehabisan semua batch tapi
masih ber-shortfall tetap muncul. Ditautkan dari Laporan Nilai Stok FIFO. Dibatasi
OWNER/GM/MANAGER lewat permission baru `report.stock_overview.view` — **perlu di-seed manual ke
produksi setelah deploy** (`pnpm db:seed-permissions`), pipeline tidak menjalankan seed otomatis.
Migrasi `0022_batch_code_po_link`: tambah `batch_code` (nullable, `BTC-YYYYMMDD-NNNN`, batch lama
tidak di-backfill) dan `purchase_order_id` (nullable) ke `product_stock_batches`; batch baru dapat
kode otomatis lewat `StockService.addStock()`, hanya penerimaan PO yang mengisi
`purchase_order_id`. Kunci migrasi sudah dilepas.

`feat/stock-shortfall-ledger` (+ `-fase2`) **Fase 1 & 2 sudah ter-merge ke `main`**
(2026-09-15, belum di-push): task kanban #32. Oversell (jual/koreksi nota melebihi stok)
sekarang membuat baris ledger `stock_shortfalls` (produk, cabang, qty kurang, referensi
transaksi asal) alih-alih hilang dari angka stok — dilunasi FIFO oleh penerimaan PO
berikutnya, dengan true-up HPP kalau harga PO beda dari estimasi saat oversell. Invariant
baru: `product_stocks.qty = SUM(batch.qty_remaining) - SUM(shortfall terbuka)` — sengaja
membalikkan sebagian aritmatika "Fix A" (`fix/stok-ledger-agregat-vs-batch`), bedanya
sekarang minus itu berjejak, bukan diam-diam. SO Besar/adjustment manual (qty naik)
otomatis menutup shortfall terbuka produk itu; reverse-receiving PO yang sudah melunasi
shortfall diblokir (409) sampai reversal penuh dikerjakan terpisah. Migrasi
`0021_stock_shortfalls`, kunci migrasi sudah dilepas.

Fase 2: halaman `/inventory/stock-shortfalls` (Owner/GM, permission
`inventory.stock_shortfall.manage` — **perlu di-seed manual ke produksi setelah deploy**,
pipeline tidak menjalankan seed) menampilkan shortfall terbuka dengan tanda "tinjau"
setelah >=7 hari, plus tombol tutup manual (write-off, alasan wajib, tidak mengubah
qty/batch/agregat) untuk kasus barang terbukti hilang/rusak. Badge jumlah terbuka di
sidebar.

**Di luar cakupan** (dicatat untuk owner, bukan lupa): jalur oversell IBT ship dengan
bypass PIN Owner (FIFO sendiri, bukan lewat `deductStock`) belum masuk ledger; backfill
shortfall historis dari `audit_logs` OVERSELL dan rekonsiliasi satu-kali
`product_stocks.qty` lama (Fix B) belum dikerjakan; reversal penuh reverse-receiving PO
yang sudah melunasi shortfall belum dikerjakan (saat ini diblokir, bukan direversal).
Belum diuji manual end-to-end di layar (jual melebihi stok → cek qty minus & baris
shortfall → terima PO produk sama → cek pelunasan & HPP true-up → cek halaman laporan +
tombol tutup manual).

`fix/stock-shortfall-invariant` **sudah ter-merge ke `main`** (2026-09-15, belum
di-push): pertanyaan user ("kenapa -3 jadi 4, bukan 10?") membongkar bug nyata di
aritmatika Fase 1 — porsi pelunasan PO terpotong dua kali (batch baru tidak dikurangi
porsi pelunasan, tapi agregat dikurangi terpisah), dan `applyManualStockAdjustment`
menutup shortfall tanpa kompensasi ke agregat. Diperbaiki + ditambah test invariant
end-to-end berantai (oversell → PO) yang sebelumnya tidak pernah benar-benar
menyambungkan dua state — celah metodologis yang membuat bug ini lolos di Fase 1.

`fix/piutang-internal-po-cancel-orphan` **sudah ter-merge ke `main`** (2026-09-14, belum
di-push): task kanban #28. Field customer di form Bulk Sale sekarang terkunci ke customer
internal cabang tujuan saat prefill dari Internal PO berhasil menemukannya — sebelumnya field
pencarian tetap bisa diketik ulang, dan kalau ada customer biasa yang kebetulan namanya sama
(ditemukan: dua data "Toko Pusat", id 109 non-internal vs id 151 internal), kasir bisa salah
pilih sehingga piutang tertaut ke customer yang salah. Juga rekonsiliasi data manual satu kali
di produksi (bukan lewat migrasi): `IBT-20260904-0004` sempat di-cancel setelah terlanjur
terkonversi jadi Bulk Sale (`TRX-20260905-7446`, sebelum guard 409 di commit `896e720`/task #15
ada) — transaksinya sekarang VOIDED, piutang Rp 2.480.000 (customer salah, id 109) VOIDED, stok
96 PCS x2 produk dikembalikan ke Gudang, IBT direset ke PENDING_APPROVAL. Tanpa migrasi DB.

`fix/tombol-konfirmasi-koreksi-tampil-void` **sudah ter-merge ke `main`** (2026-09-14, belum
di-push): modal Setujui/Tolak di halaman Permintaan Persetujuan (`/void-requests`) selalu
menampilkan teks "Void Transaksi" walau permintaannya berjenis Koreksi — tombol konfirmasi,
judul, dan deskripsi modal sekarang mengikuti `kind` (KOREKSI/VOID). Tanpa migrasi DB, tanpa
endpoint baru.

`feat/pagination-persistent-list` **sudah ter-merge ke `main`** (2026-09-14, belum di-push):
tabel daftar (produk, customer, pengguna, PO, transfer internal, payables, piutang, pelunasan,
laporan SO, resolusi SO) tidak lagi reset ke halaman pertama saat balik dari halaman detail —
`components/ui/data-table.tsx` dapat prop opt-in `persistKey` yang menyimpan `pageIndex` ke
sessionStorage. Transaksi, Retur Riwayat, dan POS History tidak disentuh karena paginasinya
sudah lewat query param URL (otomatis persistent). Tanpa migrasi DB, tanpa endpoint baru.

`fix/so-besar-tombol-ganda-dan-kunci-item` **sudah ter-merge ke `main`** (2026-09-13, belum
di-push): tombol "Simpan Koreksi" ganda di modal review SO Besar dihapus (footer modal tidak
pernah aktif untuk SO Besar, cuma dobel dengan tombol milik tabel input); tambah tombol "Kunci"
per baris di tabel input SO Besar supaya qty fisik yang baru dihitung langsung tersimpan &
mengunci stok sistem pembanding saat itu juga, alih-alih menunggu "Simpan Koreksi" batch di akhir
sesi hitung yang bisa berjam-jam (jendela itu yang tadinya bikin transaksi jual/beli di tengah
sesi ikut menggeser stok sistem pembanding). Tanpa migrasi DB, tanpa endpoint baru.

`fix/stok-ledger-agregat-vs-batch` **sudah ter-merge ke `main`** (2026-09-04): dua ledger stok
berhenti memisah. `deductStock` dulu memotong `product_stocks.qty` sebesar qty yang dijual
padahal batch hanya terpotong sebanyak stok yang ada, sehingga tiap oversell melebarkan
`SUM(qty_remaining)` vs `qty` secara permanen; kini agregat turun `coveredQty` saja. Bypass PIN
Owner saat kirim IBT berhenti menulis stok minus tanpa batch. Approval Stock Opname berhenti
melewati item ber-selisih 0 — justru item itulah yang membuktikan agregat benar, jadi batch-nya
kini ikut disamakan (jalur rekonsiliasi ini sengaja toleran supaya satu produk tidak
membatalkan approval seluruh SO). Tanpa migrasi DB. Diagnostik, query verifikasi, dan desainnya
di `docs/audit-stok-nilai-vs-pos/`.

**Belum dikerjakan, menyusul:** rekonsiliasi data lama (toko lewat SO Besar, Gudang lewat SQL ke
nilai batch) dan kebijakan gerbang oversell (Fix B) — keduanya butuh keputusan owner.

`feat/so-resolusi-grouping-per-so` **sudah ter-merge ke `main`** (2026-08-27): halaman
Resolusi Selisih SO dikelompokkan per SO — pilih SO dulu (daftar dengan jumlah item &
total nilai minus/plus), baru masuk ke item-itemnya di `/resolusi/[soId]`.

`feat/so-resolusi-modal-filter` **sudah ter-merge ke `main`** (2026-08-27): harga modal
manual untuk resolusi minus saat HPP tidak berhasil dihitung otomatis, plus filter
(cabang/tanggal/pencarian) & pagination di halaman Resolusi Selisih SO.

`feat/so-resolusi-selisih` **sudah ter-merge ke `main`** (2026-08-27): fase investigasi &
resolusi selisih SO Besar pasca-approval — disposisi ditemukan (koreksi stok otomatis),
kerugian toko, tagihan ke karyawan (boleh dibagi & sebagian, penanggung jawab tidak wajib
punya akun sistem), atau lebih dijelaskan. Migrasi `0020_so_variance_resolution`, permission
baru `stock_opname.resolve` (OWNER/GM), halaman `/inventory/stock-opname/resolusi`, tab baru
di laporan SO. Diverifikasi end-to-end terhadap Postgres sungguhan.

`feat/po-riwayat-cetak-penerimaan` **sudah ter-merge ke `main`** (2026-08-26): halaman detail PO
kini menampilkan riwayat tiap sesi penerimaan (penerima, waktu, item, qty diterima/rusak,
catatan) dengan tombol cetak bukti penerimaan (thermal 80mm) per sesi.

`fix/po-notes-null-validasi` dan `feat/po-penerimaan-langsung-bo` **sudah ter-merge ke `main` dan
ter-push** (2026-08-26): penerimaan PO langsung dari BO oleh OWNER/GM
(`/purchase-orders/[id]/receive`), plus perbaikan `POST /api/bo/purchase-orders` yang dulu
menolak `notes: null` dengan pesan "expected string, received null".

`feat/so-besar-input-langsung-bo` **sudah ter-merge ke `main`** (2026-08-26): input langsung SO
Besar dari backoffice (daftar kandidat produk, search, paginasi, draft localStorage) plus
perbaikan bug fokus hilang tiap ketikan pada kolom `DataTable` yang editable (`meta` baru di
`components/ui/data-table.tsx`, dipakai lewat `table.options.meta` alih-alih closure di `columns`).

Tidak ada klaim aktif lainnya (2026-08-25) — ketujuh branch dari batch feedback user 2026-08-20 sudah
di-merge lokal ke `main` (belum di-push ke remote): `fix/piutang-tanggal-transaksi`,
`feat/copy-harga-modal-opsional`, `feat/hapus-produk-master`, `fix/open-bill-harga-edit`,
`fix/void-reset-ibt`, `investigate/sj-internal-transfer`, `feat/edit-po-internal`. Worktree-nya
belum dibersihkan (`pnpm worktree:remove`) — biarkan sampai push/PR beres, siapa tahu masih perlu
dicek ulang.

Gelombang 2 (domain `purchase-orders/internal`) dikerjakan sekuensial, bukan paralel:
`fix/void-reset-ibt` → `investigate/sj-internal-transfer` → `feat/edit-po-internal`. Baris untuk
dua branch berikutnya ditambah saat masing-masing benar-benar mulai dikerjakan.

**Migrasi DB kini jalan sendiri saat deploy** (`chore/migrasi-db-di-deploy`, ter-merge
2026-08-16). `deploy-vps.yml` menjalankan image `migrator` di dalam jaringan compose sebelum
container app di-restart, jadi migrasi tidak perlu — dan tidak bisa — dijalankan manual dari
laptop: sejak Postgres pindah ke jaringan Docker VPS (tanpa `ports:`), DB produksi memang tidak
terjangkau dari luar. Yang perlu dilakukan penambah migrasi hanya menaruh berkasnya di
`packages/db/src/migrations/` + `_journal.json` seperti biasa; pipeline yang menerapkannya.

Tiga pekerjaan retur (`feat/riwayat-retur`, `fix/retur-piutang`, `chore/migrasi-db-di-deploy`)
**sudah ter-merge 2026-08-16**, migrasi terakhir `0018_retur_piutang`.

`chore/pindah-postgres-ke-vps` memindahkan Postgres produksi dari VPS lama ke VPS baru,
sebagai container tanpa port yang terbuka ke internet. Hanya menyentuh `infra/apps/**`,
tidak ada perubahan kode aplikasi. **Selama pekerjaan ini berjalan, jangan mengubah
`DATABASE_URL` di mana pun.**

`chore/migrasi-deployment-vps` **sudah ter-merge** (2026-08-15). Hasilnya: backoffice di
`admin.hammielion.com`, order-web di `order.hammielion.com`, keduanya di VPS baru dengan
deploy otomatis lewat `deploy-vps.yml`. Vercel masih hidup sebagai cadangan, belum dimatikan.
Catatan lengkap: `docs/work/specs/2026-08-14-migrasi-deployment-vps.md`.

Pekerjaan yang siap diambil ada di `docs/work/backlog/2026-08-10-input-user-15-item.md`.

### Belum dipetakan

`#12` (harga reseller otomatis) **kodenya sudah masuk** — sisa uji di layar dengan satu pelanggan
bertier non-RETAIL. Menyentuh POS **dan** master data customer (`master-data/customers/**`,
`api/bo/customers/**`), karena `default_tier_type` ternyata belum bisa diisi dari mana pun.
`#18` (cetak struk via QZ Tray, tanpa dialog) **kodenya sudah masuk `main`** — sisa satu langkah:
uji cetak di printer termal asli, lalu setel `RECEIPT_COLUMNS` bila 56 kolom terlalu rapat.
`#16` (staf bertugas di banyak cabang) **sudah mendarat di `main`** — migrasi `0013`,
tabel `user_branch_assignments`. Sisa: uji di layar dengan staf bercabang dua, dan **semua user
wajib login ulang** supaya `branchIds` masuk ke token.
`#7` (satu akun satu perangkat) **sudah mendarat di `main`** — migrasi `0014`, tabel `user_sessions`.
Cek sesi ada di `verifyAccessToken`; `middleware.ts` sengaja hanya memverifikasi tanda tangan karena
Edge tak bisa memanggil Postgres. Sisa: uji dua perangkat.
`#6` (ajukan void/koreksi dari POS) **sudah mendarat di `main`** — migrasi `0015`, `void_requests`
kini menampung dua jenis lewat kolom `kind` + `payload`. Namanya sengaja tidak diganti meski
cakupannya melebar. Settlement ditahan selama ada permintaan menggantung untuk nota shift itu.
Sisa: uji alur ajukan → setujui/tolak → settle dengan transaksi sungguhan.

**Seluruh #16, #7, #6 sudah di `main`.** Yang tersisa dari triase 2026-08-10 tinggal uji di
layar/perangkat dan `#2` yang ditahan.
`#2` (pemasukan stok supplier luar) **ditahan** sampai jelas apa yang sebenarnya gagal.

---

## Peta domain

Bagi pekerjaan **per domain (irisan vertikal)**, bukan per lapisan. Satu orang mengerjakan
UI + API + service satu domain; jangan satu orang memegang semua API sementara yang lain
memegang semua UI — irisan mendatar seperti itu dijamin bertabrakan di tiap berkas.

| Domain | UI | API | Service & schema |
|---|---|---|---|
| Master data | `app/(dashboard)/master-data/**` | `app/api/bo/master-data/**`, `products/**` | `schema/master.ts`, `products.ts` |
| Inventory & opname | `(dashboard)/inventory/**` | `api/bo/inventory/**`, `stock-opnames/**` | `lib/services/stock-*.ts`, `stock-ledger.ts`, `schema/inventory.ts`, `stock_opnames.ts` |
| Transaksi & retur | `(dashboard)/transactions/**`, `retur/**` | `api/bo/transactions/**`, `retur/**`, `bulk-sales/**` | `lib/services/transaction-*.ts`, `retur-service.ts`, `schema/transactions.ts`, `returns.ts` |
| Purchase order | `(dashboard)/purchase-orders/**` | `api/bo/purchase-orders/**`, `internal-transfers/**` | `lib/po-batch-updater.ts`, `schema/purchase_orders.ts` |
| Keuangan & kas | `(dashboard)/cash-flow/**` | `api/bo/cash-flow/**`, `supplier-payables/**`, `inter-branch-payables/**` | `lib/services/shift-debt-cash.ts`, `schema/finance.ts`, `cash_flow.ts` |
| Shift & kasir | `(dashboard)/shift-history/**` | `api/bo/shifts/**` | `lib/services/shift-resolver.ts`, `schema/shifts.ts` |
| Laporan | `(dashboard)/reports/**` | `api/bo/reports/**` | `lib/services/report-service.ts` |
| Pesanan pelanggan | `(dashboard)/orders/**` | `api/bo/customer-orders/**` | `schema/customer_portal.ts` + `apps/order-web/**` |
| Pengguna & akses | `(dashboard)/settings/**`, `staff/**` | `api/bo/settings/**` | `lib/authz.ts`, `lib/auth.ts`, `schema/users.ts` |
| Audit & void | `(dashboard)/audit-log/**`, `void-requests/**` | `api/bo/audit-log/**`, `void-requests/**` | `lib/services/void-service.ts`, `schema/audit.ts` |
| POS (web) | `app/pos/**` | `app/api/pos/**` | `lib/pos-branch.ts` |
| Retur supplier | `(dashboard)/purchase-orders/supplier-returns/**`, `pos/(authenticated)/produk/retur-supplier/**`, `components/supplier-returns/**` | `api/bo/supplier-returns/**`, `api/pos/supplier-returns/**` | `lib/services/supplier-return-*.ts`, `lib/supplier-return-http.ts`, `schema/supplier_returns.ts` (saldo: `supplier_credit_entries`) |
| Jasa & grooming | `(dashboard)/settings/groomers/**`, `(dashboard)/master-data/pets/**`, `pos/(authenticated)/grooming/**`, `(dashboard)/reports/grooming/**` | `api/bo/groomers/**`, `api/bo/pets/**`, `api/pos/grooming/**`, `api/bo/grooming/**` | `lib/services/grooming-master-service.ts`, `grooming-order-service.ts`, `grooming-report-service.ts`, `lib/grooming-bonus.ts`, `lib/ongkir.ts` & `lib/ongkir-server.ts` (mesin ongkir — satu-satunya tempat aturan & tampilan ongkir), `lib/product-kind.ts`, `lib/pet-age.ts`, `lib/phone.ts`, `schema/grooming.ts` |
| Promo & diskon | `(dashboard)/reports/discount-history/**` (laporan Riwayat Diskon; P1d: keranjang & layar bayar kasir), `(dashboard)/promos/**` (layar Promo + saklar darurat; P2b), `components/pos/{cart-panel,checkout-modal,pos-client}.tsx` (tanda promo di keranjang + kiriman promo; P2d) | `api/pos/transactions` (menerima `manualDiscount` & `promo` per baris), `api/pos/promos` (promo untuk layar kasir; P2c), `api/bo/promos/**`, `api/bo/settings/promo-switch` | `lib/services/line-discount-service.ts` (pintu tulis catatan potongan), `lib/promo/promo-engine.ts` (mesin promo — satu-satunya tempat aturan promo otomatis; P2a), `lib/promo/promo-form.ts` (isian layar Promo → aturan promo; P2b), `lib/promo/promo-judge.ts` + `lib/services/promo-sale-service.ts` (server sebagai hakim promo saat nota disimpan; P2c), `lib/services/promo-service.ts` (simpan/daftar/nonaktifkan promo, saklar darurat; P2b), `components/pos/promo-store.ts` (promo cabang + jam server untuk layar) & `components/pos/promo-cart.ts` (hitung promo keranjang di layar — pakai mesin promo yang sama; P2d), `lib/manual-discount.ts` (mesin diskon manual — satu-satunya tempat aturan diskon ketikan kasir), `lib/line-net-value.ts` (mesin nilai bersih baris — satu rumus untuk bonus, retur, laporan), `lib/discount-history.ts` + `lib/services/discount-history-service.ts` (laporan Riwayat Diskon — hanya membaca), `schema/transaction_discounts.ts` |
| Retur internal | `purchase-orders/internal-returns/**`, `pos/(authenticated)/produk/retur-internal/**`, `components/internal-returns/**`, antrean di `void-requests/_components/internal-return-approvals.tsx` (Revisi Harga Beli: RI9, belum ada) | `api/bo/internal-returns/**`, `api/pos/internal-returns/**`, `lib/services/internal-return-*.ts`, `lib/internal-return-http.ts` (RI7–RI8 belum ada) | `schema/internal_returns.ts` (Saldo Internal: `internal_credit_entries`), `inter_branch_payments.source_type` |

---

## Berkas magnet

Berkas yang hampir semua pekerjaan tergoda menyentuhnya. Di sinilah konflik paralel
benar-benar muncul — bukan di kode domain masing-masing.

| Berkas | Kenapa berbahaya | Aturan |
|---|---|---|
| `app/(dashboard)/_components/sidebar.tsx` | 440 baris daftar menu; tiap fitur baru menambah entry | Tambah entry di dekat kelompok domainmu, jangan rapikan urutan menu lain |
| `packages/db/src/schema/*.ts` | dua branch menambah kolom di tabel yang sama | Pegang kunci migrasi dulu; sentuh hanya berkas domainmu |
| `packages/db/src/migrations/**` | penomoran berurut, tabrakan tak terdeteksi git | Kunci migrasi; `pnpm migrations:check` sebelum push |
| `lib/authz.ts` | daftar permission dipakai semua route | Tambah konstanta, jangan ubah/urutkan yang sudah ada |
| `lib/db.ts` | 11 baris re-export yang diimpor semua orang | Nyaris tidak pernah perlu diubah |
| `apps/backoffice/CHANGELOG.md` | dulu selalu diedit di baris paling atas | **Jangan disentuh** — tulis potongan di `changelog.d/` |
| `CLAUDE.md`, `AGENTS.md` | aturan bersama | Ubah lewat PR tersendiri, jangan dibonceng PR fitur |
