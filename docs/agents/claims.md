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

> **Pemegang: —** (kosong = bebas diambil)

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
| `feat/settlement-buta-hitung` | — | Shift & kasir | `components/pos/settlement-client.tsx`, `settlement-print.tsx` | — |
| `feat/transfer-internal-nominal` | — | PO internal | `(dashboard)/purchase-orders/internal/_components/internal-transfer-list-client.tsx`, `types.ts` | — |

Keduanya **tanpa migrasi DB**, jadi kunci migrasi tidak terpakai dan semuanya boleh jalan
bersamaan. Tidak ada berkas yang beririsan — sudah dicek, termasuk bahwa `sidebar.tsx` tidak
perlu disentuh satu pun (semuanya mengubah halaman yang sudah ada).

Rinciannya di `docs/work/backlog/2026-08-10-input-user-15-item.md`.

### Belum dipetakan

`#2` (pemasukan stok supplier luar) menunggu kejelasan apa yang sebenarnya gagal.
`#12` (harga reseller otomatis) siap tapi belum dijadwalkan.
`#6`, `#7`, `#16` butuh migrasi → harus bergantian memegang kunci migrasi, urutannya #16 → #7 → #6.

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
