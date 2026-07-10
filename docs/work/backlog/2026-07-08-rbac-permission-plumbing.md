# Backlog — Fondasi RBAC Permission-Level (Fase Plumbing)

**Tanggal:** 2026-07-08
**Sumber rencana:** `docs/work/specs/2026-07-08-rbac-permission-plumbing.md`
**Scope:** `apps/backoffice` + `packages/shared` + `packages/db`
**Urutan global:** **INISIATIF #1** (dikerjakan lebih dulu — fondasi buat Staff Dashboard & Portal)

Fase ini **hanya membangun fondasi otorisasi** — dua sumbu terpisah: **capability** (`hasPermission`)
dan **scope cabang** (`scopeFilter`). **Tidak ada** route yang diubah; 100% backward-compatible
(field `payload.role` tetap ada). Setelah fase ini, migrasi tiap route jadi mekanis (fase terpisah,
lihat R6).

## Prinsip yang dikunci
1. **Scope tidak dikodekan ke permission code.** `stock_opname.read` (capability) + `scopeFilter`
   (cabang mana) — bukan `stock_opname.read.own` vs `.all`.
2. **Parity dulu.** Seed `role → permission` meniru perilaku konstanta `_ROLES` yang ada sekarang —
   tidak mengubah siapa boleh apa.
3. **Additif & reversible.** Tiap langkah tak merusak yang lama; rollback = revert commit login + helper.

## Urutan pengerjaan
`R1 → R2 → R3 → R4 → R5` lalu **berhenti & review** sebelum R6 (migrasi per-domain).

Alasan: tipe dulu (R1), lalu data seed (R2), helper (R3), baru login mengisi field (R4), terakhir
verifikasi (R5). Tiap langkah aman berdiri sendiri.

---

## R1 — `JWTPayload` + `BranchScope` di shared ✅ SELESAI (2026-07-08)
**Prioritas:** Tinggi · **Effort:** S · **Depends:** —
> `packages/shared/src/types/user.ts`: tambah `type BranchScope = 'ALL' | 'OWN'` + field
> `branchScope?: BranchScope` (opsional dulu — rencana §12 "opsional dulu bila perlu" — agar login
> lama tetap kompilasi; diketatkan jadi wajib di R4 setelah login mengisinya). `permissions` sudah ada.
> `BranchScope` ter-ekspor via `export * from './user'`. `scopeFilter` (R3) memperlakukan `undefined`
> sebagai OWN (default restriktif). Commit type-only, tanpa perubahan runtime → CHANGELOG ditunda ke R4/R5.

### Scope teknis
- `packages/shared/src/types/user.ts`: tambah `type BranchScope = 'ALL' | 'OWN'`; tambah field
  `permissions: string[]` (sudah ada tapi selalu `[]`) & `branchScope: BranchScope` ke `JWTPayload`.
- Field bersifat aditif — semua konsumen lama tetap kompilasi.

### Kriteria selesai
- [x] `JWTPayload` punya `permissions` & `branchScope`; `BranchScope` diekspor dari `@petshop/shared`.
- [x] `tsc --noEmit` hijau di `@petshop/shared` & `backoffice`. (Catatan: `petshop-pos` punya error
      pra-eksisting tak berkaitan — `lucide-react` belum terpasang, `import.meta.env` — & tak memakai
      `JWTPayload`/`BranchScope`, jadi di luar dampak fase ini.)

---

## R2 — Katalog permission + seed `role → permission` ✅ SELESAI (2026-07-08)
**Prioritas:** Tinggi · **Effort:** M · **Depends:** —
> `packages/db/src/seed/permissions.ts` (+ script `db:seed-permissions`). Satu sumber kebenaran:
> tiap permission membawa daftar role-nya → diturunkan jadi katalog (28 kode) + matriks
> (67 baris `role_permissions`: OWNER 28, GM 24, MANAGER 10, FINANCE 2, GUDANG 2, KASIR 1).
> Idempotent (`onConflictDoNothing`). Terverifikasi parity dgn `_ROLES` aktual (grep 2026-07-08).
> `tsc --noEmit` hijau. **Sudah dijalankan ke DB & diverifikasi**: query langsung menunjukkan 28/67
> dengan per-role tepat; dijalankan 2× (idempotensi terbukti, tanpa duplikat).

### Scope teknis
- Isi tabel `permissions` (kode `domain.action`) sesuai §4 rencana: master data, inventory, PO/IBT,
  transaksi/keuangan, sistem (~25 kode).
- Isi `role_permissions` sesuai matriks §5 (parity dengan `_ROLES` aktual).
- Seed di `packages/db/src/seed/permissions.ts` (atau SQL migration), **idempotent**
  (`ON CONFLICT DO NOTHING`) — `permissions.code` unique, `role_permissions` PK `(roleId, permissionId)`.

### Anomali yang WAJIB dicatat (jangan diperbaiki di sini)
- `stock_opname.approve`: GM **tidak** punya (kode aktual `['OWNER','MANAGER']`). Verifikasi apakah disengaja saat migrasi domain.
- `return.cancel`: hanya OWNER.
- **`inventory.adjustment.manage`** (ditemukan saat R2): route `inventory/stock-adjustment` **tidak
  punya gate role** — hanya scope cabang (`role !== 'OWNER' && branchId !== payload.branchId` → 403).
  Artinya *role apa pun* bisa adjustment untuk cabang sendiri. Seed memakai **maksud** rencana
  (OWNER/GM/MANAGER), BUKAN perilaku aktual. Saat migrasi route ini, putuskan sadar: ketatkan ke
  matriks, atau longgarkan ke semua role demi parity murni.

### Kriteria selesai
- [x] Semua kode §4 masuk katalog `permissions` (28); matriks §5 terpetakan (67 baris `role_permissions`).
- [x] Seed idempotent (`onConflictDoNothing`); id role/permission di-resolve dari DB, tak berasumsi id tetap.
- [x] Anomali terdokumentasi di komentar seed + backlog.
- [x] Seed dijalankan ke DB (`pnpm --filter @petshop/db db:seed-permissions`) & diverifikasi via query: 28 permission, 67 role_permissions (OWNER 28, GM 24, MANAGER 10, FINANCE 2, GUDANG 2, KASIR 1).

---

## R3 — `lib/authz.ts` (helper inti) ✅ SELESAI (2026-07-09)
**Prioritas:** Tinggi · **Effort:** M · **Depends:** R1
> `apps/backoffice/lib/authz.ts` dibuat dengan 5 helper. `scopeFilterAny` memakai `or(...)` drizzle
> yang benar (bukan reduce placeholder dari draft rencana); kolom bertipe `AnyColumn`. Semua helper
> diekspor, belum dipakai route mana pun (aman/aditif). `scopeFilter` memperlakukan `branchScope`
> `undefined` sebagai OWN (default restriktif). `tsc --noEmit` hijau di backoffice. CHANGELOG ditunda ke R5.

### Scope teknis
File baru `apps/backoffice/lib/authz.ts`:
- `getAuth()` → ambil & verifikasi payload dari cookie `accessToken`.
- `hasPermission(payload, code)` → sumbu capability.
- `requirePermission(code)` → guard siap-pakai; return payload atau `NextResponse` 401/403.
- `scopeFilter(payload, branchColumn)` → `'ALL'` → `undefined`; `'OWN'` → `eq(col, branchId)`.
- `scopeFilterAny(payload, ...cols)` → untuk scope OR (mis. inter-branch payables debtor/creditor);
  implementasi final pakai `or(...)` drizzle (draft di rencana disederhanakan — perbaiki di sini).

### Kriteria selesai
- [x] Kelima helper ada & diekspor; belum dipakai route mana pun (aman).
- [x] `scopeFilterAny` memakai `or(...)` yang benar (bukan reduce placeholder).
- [x] `pnpm typecheck` hijau.

---

## R4 — Login mengisi `permissions` + `branchScope` ✅ SELESAI (2026-07-09)
**Prioritas:** Tinggi · **Effort:** S · **Depends:** R1, R2
> `login/route.ts`: tambah 1 query join `rolePermissions ⋈ permissions WHERE roleId` → `permissions`
> diisi kode real (bukan `[]`), plus `branchScope = (OWNER|GM) ? 'ALL' : 'OWN'`. `payload.role` tetap
> ada (route lama utuh). `getPosBranchId`/`isMultiBranchRole` tak disentuh. `tsc --noEmit` hijau.
> **Verifikasi login DB nyata OWNER/MANAGER ditunda ke R5.**
>
> **Temuan ukuran token** (diukur via jose, `slice` katalog 28 kode, nama contoh pendek):
> OWNER 28→**1095 char**, GM 24→993, MANAGER 10→645, FINANCE/GUDANG 2→363, KASIR 1→324.
> OWNER sedikit **melewati target <1KB (~7%)**; nilai naik bila nama user/cabang panjang. Semua **jauh
> di bawah batas keras cookie 4KB** → tanpa dampak fungsional. **Keputusan: diterima** (target <1KB =
> panduan lunak, bukan batas keras). Bila kelak katalog membengkak, opsi: pendekkan kode / muat
> permission server-side, bukan di JWT — di luar scope fase plumbing.

### Scope teknis
- `apps/backoffice/app/api/auth/login/route.ts` (blok `payload`, ~baris 63–71):
  - Load kode permission via join `role_permissions` ⋈ `permissions` `WHERE roleId = user.roleId`.
  - `branchScope = (role === 'OWNER' || role === 'GM') ? 'ALL' : 'OWN'` (parity `GLOBAL_ROLES`).
  - Ganti `permissions: []` → `perms.map(p => p.code)`; tambah `branchScope`.
- Import `permissions, rolePermissions` dari `@/lib/db`, `BranchScope` dari `@petshop/shared`.
- **Jangan** ubah `getPosBranchId`/`isMultiBranchRole` (cabang aktif ≠ scope).

### Kriteria selesai
- [x] JWT hasil login membawa `permissions` real + `branchScope` benar (wiring; verifikasi DB → R5).
- [~] Ukuran token: OWNER 1095 char (>1KB ~7%), sisanya <1KB; semua ≪ 4KB cookie → **diterima** (lihat catatan).
- [x] Route lama tetap jalan (`payload.role` tetap diisi, tak ada konsumen yang berubah).

---

## R5 — Verifikasi & Definition of Done fase plumbing ✅ SELESAI (2026-07-09)
**Prioritas:** Tinggi · **Effort:** S · **Depends:** R1–R4
> Fase plumbing RBAC (R1–R5) **SELESAI**. Diverifikasi via query login identik ke DB nyata
> (bukan hanya tipe). CHANGELOG `1.48.0` dicatat (aditif). Siap **berhenti & review** sebelum R6.

### Kriteria selesai
- [x] **OWNER** → `branchScope='ALL'`, 28 permissions (diverifikasi jalankan query login persis ke DB).
- [x] **MANAGER** → `branchScope='OWN'`, 10 permissions sesuai matriks (kode terverifikasi). GM `ALL`/24, FINANCE/GUDANG `OWN`/2, KASIR `OWN`/1 — semua cocok R2.
- [x] Typecheck hijau: `backoffice` & `@petshop/shared` (`tsc --noEmit`). `pos-desktop` punya error **pra-eksisting tak berkaitan** (`lucide-react` belum terpasang, `import.meta.env`, unused var, `CachedShift`) — di luar dampak fase ini.
- [x] Tidak ada route domain/gating yang diubah — `git diff` hanya menyentuh `login/route.ts` (itulah perubahan R4 yang diniatkan; mengisi token, tak menggerbang).
- [x] `CHANGELOG.md` `1.48.0` — entry aditif, fase plumbing belum mengubah perilaku otorisasi.

---

## R6 — Migrasi domain per-domain → **backlog tersendiri dibuat 2026-07-09**
**Prioritas:** —  · **Effort:** — · **Depends:** R1–R5 selesai & di-review
> ➡️ Sudah dipecah jadi item kerja M1–M8 di [[2026-07-09-rbac-domain-migration]]
> (7 domain + verifikasi; 3 anomali A1–A3 diangkat sebagai keputusan eksplisit). Tabel di bawah = ringkasan.

Urutan disarankan (aman → tricky). Buat backlog tersendiri saat mulai:

| Urutan | Domain | Pola | Risiko |
|---|---|---|---|
| 1 | master-data (7 route) | `['OWNER','GM']` seragam | Rendah |
| 2 | settings (users/branches) | `['OWNER']` | Rendah |
| 3 | cash-flow, shifts | capability sederhana | Rendah |
| 4 | stock-opname | capability + scope MANAGER | Sedang |
| 5 | purchase-orders | banyak sub-aksi | Sedang |
| 6 | internal-transfers | multi-state + STOCK/RECEIVE roles | Tinggi |
| 7 | inter-branch/supplier payables | scope OR debtor/creditor | Tinggi |

Setiap route migrasi: ganti konstanta `_ROLES` lokal → `requirePermission(code)` + `scopeFilter`.
Di sinilah anomali (R2) diputuskan diperbaiki atau tidak. **Baru di sini `CHANGELOG.md` mencatat
perubahan perilaku.**

---

## Catatan lintas-item
- Semua pesan error/label/komentar **Bahasa Indonesia**.
- Fase plumbing = aditif; jaga backward-compat sampai R5.
- Terkait: Staff Dashboard ([[2026-07-08-staff-dashboard-onboarding]]) idealnya memanfaatkan
  `scopeFilter` dari fase ini untuk widget per-cabang.
