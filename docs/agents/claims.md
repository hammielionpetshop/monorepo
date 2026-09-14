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

Setelah pekerjaan ter-merge, **hapus barisnya**. Tabel yang penuh klaim mati sama tidak
bergunanya dengan tabel kosong.

---

## Kunci migrasi

> **Pemegang: —**

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

`feat/laporan-stok-batch-agregat` **sudah ter-merge ke `main`** (2026-09-15, belum di-push):
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
