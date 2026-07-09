# Backlog — Migrasi Otorisasi Per-Domain (RBAC R6)

**Tanggal:** 2026-07-09
**Sumber rencana:** `docs/2026-07-08-rbac-permission-plumbing.md` (§10–12) + preview R6 di
[[2026-07-08-rbac-permission-plumbing]]
**Scope:** `apps/backoffice` (route `app/api/bo/**` + konsumen read-side)
**Depends:** Fase plumbing **R1–R5 SELESAI** (helper `lib/authz.ts`, seed 28 permission/67 matriks,
login mengisi `permissions`+`branchScope`). Ini kelanjutan **INISIATIF #1**.

> Di sinilah konstanta `_ROLES` lokal diganti `requirePermission(code)` + `scopeFilter`, dan **di
> sinilah `CHANGELOG.md` mencatat perubahan perilaku** (fase plumbing tak mengubah perilaku apa pun).

---

## Prinsip yang dikunci
1. **Default = parity.** Migrasi meniru perilaku `_ROLES` aktual. Seed R2 sudah paritas → mayoritas
   route hanya berubah *mekanis* (konstanta → `requirePermission`), tanpa perubahan siapa-boleh-apa.
2. **Dua sumbu jangan dicampur.** Banyak route memakai `GLOBAL_ROLES = ['OWNER','GM']` **bukan** sebagai
   gate, melainkan sebagai **scope** (`isGlobal ? lihat semua : cabang sendiri`). Yang begini → `scopeFilter`,
   **bukan** `requirePermission`. Salah tafsir = bug otorisasi.
3. **Anomali diputuskan sadar (bukan diam-diam).** 3 titik di bawah mengubah/mempertahankan perilaku —
   butuh keputusan eksplisit + entri CHANGELOG bila berubah.
4. **Aditif & reversible per domain.** Tiap item Mx berdiri sendiri, bisa di-review & merge terpisah.

---

## ✅ Keputusan anomali — FINAL (Owner, 2026-07-09)

| # | Route | Perilaku AKTUAL | **KEPUTUSAN** | Dampak |
|---|---|---|---|---|
| **A1** | `stock-opnames/[id]/approve`+`reject`+`pending` | `['OWNER','MANAGER']` — GM tak bisa | **`stock_opname.approve` = OWNER/GM/MANAGER (TAMBAH GM)** — eksklusi GM dianggap bug (GM > MANAGER) | **Ubah perilaku** (GM dapat akses) → seed diperbarui + **CHANGELOG di M4** |
| **A2** | `retur/[returnId]/cancel` | OWNER-only | **`return.cancel` = OWNER (PERTAHANKAN)** | Tanpa perubahan — hanya formalisasi ke permission |
| **A3** | `inventory/stock-adjustment` | TANPA gate role (hanya scope cabang) | **`inventory.adjustment.manage` = OWNER/GM/MANAGER (KETATKAN)** — tutup celah | **Ubah perilaku** (KASIR/GUDANG/FINANCE kehilangan adjustment) → **CHANGELOG di M4** |

> Seed `packages/db/src/seed/permissions.ts` sudah diperbarui (A1 tambah GM; A3 sudah OWNER/GM/MANAGER)
> + komentar keputusan. Matriks kini **68 baris** `role_permissions` (GM 24→25). **Penegakan di route +
> entri CHANGELOG untuk A1/A3 dilakukan saat M4**, bukan sekarang (belum ada route yang membaca).
> Editor UI role→permission (atur akses tanpa SQL) **ditunda** → [[2026-07-09-rbac-roles-permissions-editor]].

---

## Urutan pengerjaan (aman → tricky)
`M1 → M2 → M3 → M4 → M5 → M6 → M7` lalu `M8` (verifikasi menyeluruh). Boleh review/merge per item.

---

## M1 — Master Data (paling seragam, risiko rendah)
**Effort:** M · **Depends:** — · **Pola:** `['OWNER','GM']` seragam → capability murni

### Route (semua mutasi `ALLOWED_MUTATE_ROLES = ['OWNER','GM']`)
- `master-data/categories` (+`[id]`) → `master.category.manage`
- `master-data/brands` (+`[id]`) → `master.brand.manage`
- `master-data/suppliers` (+`[id]`) → `master.supplier.manage`
- `master-data/uom` (+`[id]`) → `master.uom.manage`
- `master-data/payment-methods` (+`[id]`) → `master.payment_method.manage`
- `master-data/products/[id]/prices`, `/costs`, `/uom-conversions` (+`[convId]`), `products/generate-barcodes` → `master.product.manage`
- `master-data/prices` (+`copy-branch`, `copy-product`) → `master.price.manage`

### Pola migrasi (per route)
Ganti `const gate = ... verifyAccessToken ...` + cek `ALLOWED_MUTATE_ROLES.includes` →
```ts
const gate = await requirePermission('master.category.manage');
if (gate instanceof NextResponse) return gate;
const payload = gate;
```

### Kriteria selesai
- [ ] Semua route master-data pakai `requirePermission`; konstanta `_ROLES` lokal dihapus.
- [ ] Perilaku identik (OWNER/GM boleh, lainnya 403). `pnpm typecheck` hijau.
- [ ] CHANGELOG: entri (mekanis, tanpa perubahan perilaku — boleh 1 entri ringkas).

---

## M2 — Settings (users & branches), risiko rendah
**Effort:** S · **Depends:** — · **Pola:** `['OWNER']` → capability murni

### Route
- `settings/users` (+`[id]`) → `user.manage`
- `settings/branches/[id]` → `branch.manage`

> ⚠️ Sinkron dgn Inisiatif #2 (S6 juga menyentuh `settings/users`). Bila #2 jalan paralel, koordinasikan
> agar tak bentrok — idealnya M2 dulu, lalu S6 menambah `username` di atasnya.

### Kriteria selesai
- [ ] `user.manage`/`branch.manage` menggantikan konstanta; non-OWNER 403 (identik).

---

## M3 — Cash-flow & Shifts, risiko rendah
**Effort:** S · **Depends:** —

### Route
- `cash-flow/categories` (+`[id]`) → `cashflow.category.manage` (`['OWNER','GM','MANAGER']`)
- `shifts` (+`[id]`) → `shift.read` (`['OWNER','GM']`)

> Cek: `shifts` route memakai role sebagai **gate** atau **scope**? Bila `shift.read` = "lihat lintas
> cabang", MANAGER mungkin perlu lihat shift **cabang sendiri** → itu **scope**, bukan gate. **Verifikasi
> file sebelum migrasi**; bila ternyata scope, pakai `scopeFilter`, jangan 403-kan MANAGER.

### Kriteria selesai
- [ ] Pola gate/scope diverifikasi per file & dimigrasi sesuai sumbunya.

---

## M4 — Stock Opname + Stock Adjustment, risiko sedang (ANOMALI A1 & A3)
**Effort:** M · **Depends:** keputusan **A1**, **A3**

### Route
- `stock-opnames` (create) → `stock_opname.create` (OWNER/GM/MANAGER)
- `stock-opnames/history` (read) → `stock_opname.read` (OWNER/GM/MANAGER) **+ `scopeFilter`** (MANAGER
  hanya cabang sendiri — saat ini via cek `role==='MANAGER'` manual; lihat §10 rencana)
- `stock-opnames/[id]/approve`, `/reject`, `/pending` → `stock_opname.approve` **(A1: OWNER/MANAGER)**
- `inventory/stock-adjustment` → `inventory.adjustment.manage` **(A3: MENGETATKAN — CHANGELOG wajib)**
- `inventory/adjustment-logs`, `inventory/stock-logs` → verifikasi sumbu (kemungkinan `scopeFilter` read)

### Kriteria selesai
- [ ] Capability + `scopeFilter` menggantikan cek `role==='MANAGER'` manual pada history.
- [ ] A3 diterapkan sesuai keputusan; **CHANGELOG mencatat perubahan perilaku** bila diketatkan.
- [ ] Manual test: MANAGER approve OK, GM approve → 403 (bila A1 = parity).

---

## M5 — Purchase Orders (banyak sub-aksi), risiko sedang
**Effort:** M · **Depends:** —

### Route
- `purchase-orders` (create/list) → mutasi `po.manage` (OWNER/GM/MANAGER); list pakai `GLOBAL_ROLES`
  sebagai **scope** → `scopeFilter`
- `purchase-orders/[id]/approve`, `/approve-receiving` → `po.approve` (OWNER/GM)
- `purchase-orders/[id]/update-invoice` → `po.financial` (OWNER/GM)

### Kriteria selesai
- [ ] Pisahkan gate (`po.manage`/`po.approve`/`po.financial`) dari scope list (`scopeFilter`).
- [ ] Read-side `(dashboard)/purchase-orders/internal/[id]/page.tsx` (pakai `GLOBAL_ROLES` utk scope) ikut dimigrasi/diselaraskan.

---

## M6 — Internal Transfers (multi-state, STOCK/RECEIVE roles), risiko tinggi
**Effort:** M–L · **Depends:** M5 (pola PO serupa)

### Route
- `internal-transfers` (create) → `internal_transfer.manage` (OWNER/GM); list `GLOBAL_ROLES` = **scope**
- `internal-transfers/[id]` → gate/scope campur (verifikasi)
- `internal-transfers/[id]/stock-check` → `internal_transfer.stock_check` (OWNER/GM/MANAGER/GUDANG)
- `internal-transfers/[id]/status` → **paling rumit**: `GLOBAL_ROLES`/`MANAGER_ROLES`/`STOCK_ROLES`/
  `RECEIVE_ROLES` + cek `userBranchId === source/destination`. Petakan tiap transisi state ke
  `internal_transfer.manage`/`.stock_check`/`.receive` + `scopeFilterAny(source, destination)`.

### Titik rawan
State machine transfer: tiap aksi (kirim/terima/cek stok) role & cabang berbeda. **Baca file penuh &
buat tabel transisi→(permission, scope) sebelum mengubah.** Sertakan konsumen POS
`pos/(authenticated)/internal-order/_components/internal-order-form.tsx` (`MULTI_BRANCH_ROLES`).

### Kriteria selesai
- [ ] Tiap transisi state termigrasi dgn permission + scope yang benar; manual test alur kirim→terima
      lintas cabang untuk tiap role terkait.

---

## M7 — Payables & Transaksi (scope OR debtor/creditor), risiko tinggi (ANOMALI A2)
**Effort:** M–L · **Depends:** —

### Route
- `supplier-payables` (+`[id]/pay`) → `payable.pay` (OWNER/GM/MANAGER/FINANCE) + **`scopeFilterAny`**
  (debtor/creditor branch — kasus utama `scopeFilterAny`)
- inter-branch payables waive → `payable.waive` (OWNER/GM)
- `void-requests` (+`[id]/approve`,`/reject`) → `void.approve` (OWNER/GM)
- `customers/[id]/debts/[debtId]/payments/[paymentId]/void` → `debt.payment_void` (OWNER/GM)
- `retur/[returnId]/cancel` → `return.cancel` **(A2: OWNER-only)**
- `bulk-sales`, `bulk-sale-products` → `transaction.bulk_sale` (OWNER/GM/MANAGER); `GLOBAL_ROLES` = scope
- `damaged-goods` → `damaged_goods.read_global` (OWNER/GM) — `GLOBAL_ROLES` di sini = **scope**
  (`isGlobal ? semua cabang : cabang sendiri`)
- `nav-badges` → agregator read; `GLOBAL_ROLES` = **scope** murni → `scopeFilter`, tanpa gate

### Kriteria selesai
- [ ] `scopeFilterAny` terpakai benar di payables (uji: FINANCE cabang X lihat hutang di mana cabangnya = debitur ATAU kreditur).
- [ ] Pembeda gate vs scope benar di damaged-goods & nav-badges (jangan 403-kan pembaca).

---

## M8 — Verifikasi menyeluruh & DoD R6
**Effort:** S · **Depends:** M1–M7

### Kriteria selesai
- [ ] `grep` konstanta `_ROLES`/`ALLOWED_*`/`GLOBAL_ROLES` di `app/api/bo/**` → **nol sisa** (atau
      terdaftar sebagai sengaja dibiarkan, mis. scope helper).
- [ ] Manual test matriks per role (OWNER/GM/MANAGER/GUDANG/FINANCE/KASIR) untuk aksi kunci tiap domain.
- [ ] `pnpm typecheck` hijau; `pos-desktop` error pra-eksisting tetap di luar scope.
- [ ] CHANGELOG mencatat: (a) 1 entri "otorisasi berbasis permission" per domain/agregat, (b)
      **eksplisit** perubahan perilaku A3 (dan A1/A2 bila diputus berubah).
- [ ] Anomali A1–A3 ditandai final (parity/berubah) di komentar seed & backlog ini.

---

## Catatan lintas-item
- **Sumbu read-side/UI** juga perlu selaras: server components `app/(dashboard)/**/page.tsx` &
  komponen POS yang memakai `GLOBAL_ROLES`/`MULTI_BRANCH_ROLES` untuk memutuskan tampilan/scope. Bukan
  gate API, tapi bila tak diselaraskan UI bisa menampilkan tombol yang lalu ditolak API.
- Semua pesan error/label/komentar **Bahasa Indonesia**; harga **big.js** + integer.
- **Keputusan anomali A1–A3 sebaiknya dikonfirmasi Owner** sebelum M4/M7 — terutama A3 (mengubah akses).
- Terkait: [[2026-07-08-rbac-permission-plumbing]] (fondasi), [[2026-07-08-staff-dashboard-onboarding]]
  (Inisiatif #2 — `scopeFilter` yang sama dipakai widget `/staff`).
