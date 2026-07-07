# Desain Fase Plumbing — Migrasi RBAC ke Permission-Level

> Status: **Draft untuk review** · Scope: `apps/backoffice` + `packages/shared` + `packages/db`
> Fase ini **hanya membangun fondasi**. Belum menyentuh 68 route. Tujuannya: setelah fase ini
> selesai, migrasi tiap route jadi mekanis dan aman.
>
> 📋 **Backlog eksekusi:** [`docs/superpowers/backlog/2026-07-08-rbac-permission-plumbing.md`](superpowers/backlog/2026-07-08-rbac-permission-plumbing.md)
> — rencana ini dipecah jadi item `R1–R6` yang bisa dikerjakan per sesi.
> **Urutan global: inisiatif #1** (fondasi buat Staff Dashboard & Portal).

---

## 1. Tujuan & Non-Tujuan

**Tujuan fase plumbing:**
1. Menyediakan **dua sumbu otorisasi** yang terpisah bersih:
   - **Capability** → `hasPermission(payload, code)`
   - **Scope cabang** → `scopeFilter(payload, column)`
2. Mengisi `permissions` di JWT (sekarang selalu `[]`, lihat `login/route.ts:70`).
3. Menyeed katalog permission + peta `role → permission` sesuai perilaku kode **saat ini**
   (parity — tidak mengubah siapa boleh apa).
4. Membuat helper + tipe yang dipakai fase migrasi berikutnya.

**BUKAN tujuan fase ini (sengaja ditunda):**
- Mengubah 68 route (itu fase migrasi per-domain).
- UI untuk mengelola permission per role (seed manual dulu via SQL).
- Scope granular berbasis `ownerAssignments` (disiapkan jalurnya, belum diaktifkan).
- Mengubah kebijakan otorisasi yang ada (anomali seperti stock-opname approve tanpa GM
  **didokumentasikan**, keputusan ubah/tidak diambil saat migrasi domain terkait).

---

## 2. Dua Sumbu Otorisasi

Setiap route menjawab **dua pertanyaan berbeda**. Jangan gabungkan.

| Sumbu | Pertanyaan | Model | Helper |
|---|---|---|---|
| **Capability** | "Boleh melakukan aksi X?" | Permission code | `hasPermission()` |
| **Scope** | "Cabang **mana** datanya?" | `branchScope` | `scopeFilter()` |

> **Aturan emas:** scope **tidak boleh** dikodekan ke dalam permission code.
> Jangan bikin `stock_opname.read.own` vs `stock_opname.read.all`. Cukup `stock_opname.read`
> untuk capability, lalu `scopeFilter` yang menentukan cabang mana.

---

## 3. Bentuk Final `JWTPayload`

`packages/shared/src/types/user.ts`

```typescript
export type UserRole = 'OWNER' | 'GM' | 'MANAGER' | 'KASIR' | 'GUDANG' | 'FINANCE';

// Sumbu scope — cukup 2 nilai untuk kondisi sekarang.
// Jalur upgrade: ganti jadi number[] yang di-load dari ownerAssignments (lihat §8).
export type BranchScope = 'ALL' | 'OWN';

export interface JWTPayload {
  userId: number;
  userName: string;
  staffNumber: string | null;
  branchId: number;          // cabang home user
  branchName: string;
  role: UserRole;            // tetap ada — sebagai label & fallback
  permissions: string[];     // BARU DIISI: ['stock_opname.approve', ...]
  branchScope: BranchScope;  // BARU: 'ALL' | 'OWN'
  iat?: number;
  exp?: number;
}
```

Catatan ukuran token: ~25 permission code × ~25 char ≈ <1KB, aman untuk cookie.

---

## 4. Katalog Permission

Konvensi kode: `domain.action`. Diturunkan langsung dari konstanta `_ROLES` yang ada sekarang.

### 4.1 Master Data
| Code | Aksi | Route asal |
|---|---|---|
| `master.category.manage` | CRUD kategori | `master-data/categories` |
| `master.brand.manage` | CRUD brand | `master-data/brands` |
| `master.supplier.manage` | CRUD supplier | `master-data/suppliers` |
| `master.uom.manage` | CRUD satuan | `master-data/uom` |
| `master.payment_method.manage` | CRUD metode bayar | `master-data/payment-methods` |
| `master.product.manage` | Ubah produk, UOM conversion, barcode | `products/*`, `uom-conversions` |
| `master.price.manage` | Ubah harga jual/beli, copy harga | `master-data/prices`, `products/[id]/prices`, `costs` |

### 4.2 Inventory
| Code | Aksi | Route asal |
|---|---|---|
| `inventory.adjustment.manage` | Stock adjustment | `inventory/stock-adjustment` |
| `stock_opname.create` | Buat stock opname | `stock-opnames` (POST) |
| `stock_opname.read` | Lihat riwayat | `stock-opnames/history` |
| `stock_opname.approve` | Approve/reject | `stock-opnames/[id]/approve`,`reject` |
| `damaged_goods.read_global` | Lihat lintas cabang | `damaged-goods` |

### 4.3 Purchase Order & Internal Transfer
| Code | Aksi | Route asal |
|---|---|---|
| `po.manage` | Buat/ubah/hapus PO | `purchase-orders` (PO_MUTATE_ROLES) |
| `po.approve` | Approve PO & receiving | `purchase-orders/[id]/approve*` |
| `po.financial` | Ubah invoice/nilai finansial | `purchase-orders/[id]/update-invoice` |
| `internal_transfer.manage` | Buat/ubah IBT | `internal-transfers` (GLOBAL_ROLES) |
| `internal_transfer.stock_check` | Cek & potong stok | `internal-transfers/[id]/stock-check` (STOCK_ROLES) |
| `internal_transfer.receive` | Terima barang IBT | `internal-transfers/[id]/status` (RECEIVE_ROLES) |

### 4.4 Transaksi & Keuangan
| Code | Aksi | Route asal |
|---|---|---|
| `transaction.bulk_sale` | Buat bulk sale | `bulk-sales`, `bulk-sale-products` |
| `void.approve` | Approve/reject void request | `void-requests/[id]/*` |
| `return.cancel` | Batalkan retur | `retur/[returnId]/cancel` (OWNER only) |
| `debt.payment_void` | Void pembayaran hutang | `customers/.../payments/[id]/void` |
| `payable.pay` | Bayar hutang supplier/antar-cabang | `supplier-payables/[id]/pay`, `inter-branch-payables/[id]/pay` |
| `payable.waive` | Hapus hutang antar-cabang | `inter-branch-payables/[id]/waive` |
| `cashflow.category.manage` | CRUD kategori kas | `cash-flow/categories` |

### 4.5 Sistem
| Code | Aksi | Route asal |
|---|---|---|
| `user.manage` | CRUD user | `settings/users` (OWNER only) |
| `branch.manage` | CRUD cabang | `settings/branches` (OWNER only) |
| `shift.read` | Lihat shift lintas cabang | `shifts` |

---

## 5. Peta Seed `role → permission` (Parity dengan Kode Sekarang)

`✓` = punya izin. Diturunkan dari konstanta `_ROLES` aktual — **tidak** mengubah kebijakan.

| Permission | OWNER | GM | MANAGER | FINANCE | GUDANG | KASIR |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| `master.*.manage` | ✓ | ✓ | | | | |
| `inventory.adjustment.manage` | ✓ | ✓ | ✓ | | | |
| `stock_opname.create` | ✓ | ✓ | ✓ | | | |
| `stock_opname.read` | ✓ | ✓ | ✓ | | | |
| `stock_opname.approve` | ✓ | | ✓ | | | |
| `damaged_goods.read_global` | ✓ | ✓ | | | | |
| `po.manage` | ✓ | ✓ | ✓ | | | |
| `po.approve` | ✓ | ✓ | | | | |
| `po.financial` | ✓ | ✓ | | | | |
| `internal_transfer.manage` | ✓ | ✓ | | | | |
| `internal_transfer.stock_check` | ✓ | ✓ | ✓ | | ✓ | |
| `internal_transfer.receive` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `transaction.bulk_sale` | ✓ | ✓ | ✓ | | | |
| `void.approve` | ✓ | ✓ | | | | |
| `return.cancel` | ✓ | | | | | |
| `debt.payment_void` | ✓ | ✓ | | | | |
| `payable.pay` | ✓ | ✓ | ✓ | ✓ | | |
| `payable.waive` | ✓ | ✓ | | | | |
| `cashflow.category.manage` | ✓ | ✓ | ✓ | | | |
| `user.manage` | ✓ | | | | | |
| `branch.manage` | ✓ | | | | | |
| `shift.read` | ✓ | ✓ | | | | |

> **Anomali terdokumentasi** (jangan diperbaiki di fase ini, catat untuk fase migrasi):
> - `stock_opname.approve`: GM **tidak** punya (kode: `['OWNER','MANAGER']`). Cek apakah disengaja.
> - `return.cancel`: hanya OWNER.

---

## 6. Model `branchScope` (Sumbu Multi-Branch)

### 6.1 Derivasi saat login (parity)
```
OWNER, GM              → 'ALL'   (GLOBAL_ROLES: where = undefined, lihat semua cabang)
MANAGER, FINANCE,
GUDANG, KASIR          → 'OWN'   (dipaksa ke payload.branchId)
```

### 6.2 "Cabang aktif" vs "scope" — dua hal berbeda
- **`branchScope`** = cabang mana yang **boleh dilihat** (visibility). Dipakai `scopeFilter`.
- **Cabang aktif** (`posBranchId` cookie) = cabang mana yang **sedang dioperasikan** untuk POS.
  Sudah ada di `lib/pos-branch.ts` (`MULTI_BRANCH_ROLES = ['OWNER','GM','MANAGER']`).

Fase plumbing **tidak** mengubah `getPosBranchId`. Hanya menambah `scopeFilter` untuk query BO.
`isMultiBranchRole()` tetap dipakai apa adanya untuk pemilihan cabang aktif.

---

## 7. API Helper (Inti Fase Ini)

`apps/backoffice/lib/authz.ts` (file baru)

```typescript
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { and, eq, type SQL } from 'drizzle-orm'
import { verifyAccessToken } from '@/lib/auth'
import type { JWTPayload } from '@petshop/shared'

/** Ambil & verifikasi payload dari cookie. null jika tidak valid. */
export async function getAuth(): Promise<JWTPayload | null> {
  const token = (await cookies()).get('accessToken')?.value
  return token ? await verifyAccessToken(token) : null
}

/** Sumbu CAPABILITY. */
export function hasPermission(payload: JWTPayload, code: string): boolean {
  return payload.permissions.includes(code)
}

/**
 * Guard siap-pakai untuk route. Mengembalikan payload jika lolos,
 * atau NextResponse error (401/403) jika gagal.
 *
 *   const gate = await requirePermission('master.category.manage')
 *   if (gate instanceof NextResponse) return gate
 *   const payload = gate
 */
export async function requirePermission(
  code: string,
): Promise<JWTPayload | NextResponse> {
  const payload = await getAuth()
  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  }
  if (!hasPermission(payload, code)) {
    return NextResponse.json({ error: 'Akses ditolak untuk aksi ini' }, { status: 403 })
  }
  return payload
}

/**
 * Sumbu SCOPE. Kembalikan kondisi WHERE untuk membatasi query ke cabang
 * yang boleh dilihat user. 'ALL' → undefined (tanpa filter).
 *
 *   .where(and(scopeFilter(payload, stockOpnames.branchId), eq(...status)))
 */
export function scopeFilter(payload: JWTPayload, branchColumn: any): SQL | undefined {
  if (payload.branchScope === 'ALL') return undefined
  return eq(branchColumn, payload.branchId)
}

/** Untuk kolom scope ganda (mis. debtor/creditor branch). */
export function scopeFilterAny(
  payload: JWTPayload,
  ...branchColumns: any[]
): SQL | undefined {
  if (payload.branchScope === 'ALL') return undefined
  const conds = branchColumns.map((c) => eq(c, payload.branchId))
  return conds.length === 1 ? conds[0] : (conds.reduce((a, b) => (a && b ? undefined : undefined), conds[0]) as any)
}
```

> Catatan: `scopeFilterAny` untuk kasus `inter-branch-payables` (OR debtor/creditor).
> Implementasi final pakai `or(...)` dari drizzle — disederhanakan di draft ini.

---

## 8. Perubahan Login — Isi `permissions` & `branchScope`

`apps/backoffice/app/api/auth/login/route.ts` (ganti blok `payload`, baris 63–71)

```typescript
// Load permission codes dari role_permissions (1 query join)
const perms = await db
  .select({ code: permissions.code })
  .from(rolePermissions)
  .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
  .where(eq(rolePermissions.roleId, user.roleId))

const branchScope: BranchScope =
  role.name === 'OWNER' || role.name === 'GM' ? 'ALL' : 'OWN'

const payload = {
  userId: user.id,
  userName: user.name,
  staffNumber: user.staffNumber || null,
  branchId: user.branchId,
  branchName: branch.name,
  role: role.name as UserRole,
  permissions: perms.map((p) => p.code),   // ← ganti `[]`
  branchScope,                              // ← baru
}
```

Import tambahan: `permissions, rolePermissions` dari `@/lib/db`, `BranchScope` dari `@petshop/shared`.

---

## 9. Seed Database

`packages/db/src/seed/permissions.ts` (atau SQL migration). Idempotent (`ON CONFLICT DO NOTHING`).

1. Insert semua `permissions.code` dari §4.
2. Insert baris `role_permissions` sesuai matriks §5.

Karena `permissions.code` sudah `unique` dan `role_permissions` PK gabungan `(roleId, permissionId)`,
seed aman dijalankan berulang.

---

## 10. Pola Migrasi Route (Contoh — untuk Fase Berikutnya, bukan sekarang)

Menunjukkan bagaimana helper menyederhanakan route. Digabung: capability + scope.

**Sebelum** (`stock-opnames/history/route.ts`):
```typescript
const ALLOWED_READ_ROLES = ['OWNER', 'GM', 'MANAGER']
// ...
if (!ALLOWED_READ_ROLES.includes(payload.role)) return NextResponse.json({ error: '...' }, { status: 403 })
if (payload.role === 'MANAGER' && requestedBranchId !== null && requestedBranchId !== payload.branchId) { ... }
const conditions = []
if (payload.role === 'MANAGER') conditions.push(eq(stockOpnames.branchId, payload.branchId))
else if (requestedBranchId !== null) conditions.push(eq(stockOpnames.branchId, requestedBranchId))
```

**Sesudah:**
```typescript
const gate = await requirePermission('stock_opname.read')
if (gate instanceof NextResponse) return gate
const payload = gate
// scope otomatis: OWN → dikunci ke branchId, ALL → boleh pakai requestedBranchId
const scope = scopeFilter(payload, stockOpnames.branchId)
const conditions = scope ? [scope] : (requestedBranchId !== null ? [eq(stockOpnames.branchId, requestedBranchId)] : [])
```

Konstanta lokal hilang, dua sumbu eksplisit.

---

## 11. Definition of Done (Fase Plumbing)

- [ ] `JWTPayload` + `BranchScope` diperbarui di `packages/shared`.
- [ ] Tabel `permissions` terisi katalog §4; `role_permissions` terisi matriks §5 (via seed).
- [ ] `lib/authz.ts` dibuat: `getAuth`, `hasPermission`, `requirePermission`, `scopeFilter`, `scopeFilterAny`.
- [ ] `login/route.ts` mengisi `permissions` (real) + `branchScope`.
- [ ] `pnpm typecheck` hijau.
- [ ] Login manual OWNER & MANAGER → cek JWT membawa `permissions` benar & `branchScope` sesuai.
- [ ] **Tidak ada** route yang diubah (route lama tetap jalan pakai `payload.role`, karena field
      role tetap ada — 100% backward-compatible).
- [ ] `CHANGELOG.md` di-update saat fase migrasi mulai mengubah perilaku (fase plumbing = aditif).

---

## 12. Urutan Eksekusi & Rollback

**Urutan aman** (tiap langkah tidak merusak yang lama):
1. Tambah field tipe (aditif, opsional dulu bila perlu) → typecheck.
2. Seed DB (data baru, tak menyentuh yang lama).
3. Buat `lib/authz.ts` (file baru, belum dipakai siapa-pun).
4. Update login (mengisi field baru; route lama tak peduli field baru).
5. **Berhenti & review.** Baru mulai migrasi domain per-domain (fase terpisah).

**Rollback:** karena `payload.role` tidak dihapus dan semua route lama masih memakainya,
membatalkan fase ini cukup dengan revert commit login + helper. Tidak ada data yang hilang.

---

## 13. Peta Migrasi Domain (Preview Fase Selanjutnya)

Urutan disarankan — dari paling seragam/aman ke paling tricky:

| Urutan | Domain | Pola | Risiko |
|---|---|---|---|
| 1 | master-data (7 route) | `['OWNER','GM']` seragam, tanpa scope | Rendah |
| 2 | settings (users/branches) | `['OWNER']`, tanpa scope | Rendah |
| 3 | cash-flow, shifts | capability sederhana | Rendah |
| 4 | stock-opname | capability + scope MANAGER | Sedang |
| 5 | purchase-orders | banyak sub-aksi | Sedang |
| 6 | internal-transfers | multi-state + STOCK/RECEIVE roles | Tinggi |
| 7 | inter-branch/supplier payables | scope OR debtor/creditor | Tinggi |
```
