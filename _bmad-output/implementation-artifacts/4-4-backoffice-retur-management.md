# Story 4.4: Backoffice Retur Management

**Story ID:** 4.4
**Story Key:** 4-4-backoffice-retur-management
**Epic:** 4 - Transaction Correction & Retur (Post-MVP)
**Status:** ready-for-dev
**Created:** 2026-05-03
**FR Coverage:** FR17

---

## User Story

Sebagai Owner,
saya ingin memproses Retur dari dashboard backoffice,
Agar saya dapat menangani pengembalian barang secara aman di luar area kasir yang sibuk, dengan penyesuaian stok dan audit trail yang terjaga.

---

## Acceptance Criteria

**AC1 — Search Transaksi**
Given Owner login ke Backoffice dan membuka modul Retur
When mereka memasukkan nomor transaksi (format TRX-YYYYMMDD-XXXX) dan menekan Cari
Then sistem menampilkan detail transaksi beserta daftar item dengan sisa qty yang bisa diretur
And transaksi dari branch lain tidak bisa ditemukan (branch-scoped)

**AC2 — Proses Retur Partial atau Full**
Given Owner memilih item dan qty yang ingin diretur
When mereka mengisi alasan retur dan mengkonfirmasi
Then sistem mencatat retur di database (tabel `returns` + `returnItems`)
And stok item dikembalikan ke inventaris sebagai batch FIFO baru dengan COGS asli
And audit log dicatat dengan action `'RETURN_PROCESSED'`
And halaman menampilkan pesan sukses beserta nomor retur (RTN-YYYYMMDD-XXXX)

**AC3 — Validasi Qty**
Given Owner memasukkan qty retur > sisa qty yang belum diretur
When form dikirim
Then sistem menolak dengan error: "Kuantitas retur melebihi sisa item yang dapat dikembalikan"

**AC4 — Double Return Prevention**
Given semua item di suatu transaksi sudah diretur penuh
When Owner mencari transaksi tersebut
Then sistem menampilkan label "Sudah Diretur Penuh" dan menonaktifkan form retur

**AC5 — Alasan Wajib**
Given Owner tidak mengisi alasan retur
When form dikirim
Then sistem menampilkan error: "Alasan retur wajib diisi"

**AC6 — Auth**
Given akses tanpa autentikasi
When halaman `/retur` diakses
Then redirect ke `/login`

---

## Scope & Batasan

- **In scope:** Search transaksi, pilih item (full/partial), stock reversal, audit log, nomor retur
- **Out of scope:** Pencatatan refund pembayaran ke customer (belum ada modul keuangan), notifikasi ke kasir, perubahan status transaksi asli (transaksi tetap COMPLETED)

---

## Database Changes

### File Baru: `packages/db/src/schema/returns.ts`

```typescript
import { pgTable, uuid, varchar, text, numeric, timestamp } from 'drizzle-orm/pg-core';
import { transactions } from './transactions';
import { transactionItems } from './transactions';
import { branches } from './master';  // atau file yang berisi branches
import { users } from './users';
import { products } from './products';
import { unitsOfMeasure } from './master';

export const returns = pgTable('returns', {
  id: uuid('id').defaultRandom().primaryKey(),
  returnNumber: varchar('return_number', { length: 50 }).notNull().unique(),
  transactionId: uuid('transaction_id').notNull().references(() => transactions.id),
  branchId: uuid('branch_id').notNull(),
  processedById: uuid('processed_by_id').notNull(),
  reason: text('reason').notNull(),
  totalRefundAmount: numeric('total_refund_amount', { precision: 15, scale: 4 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const returnItems = pgTable('return_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  returnId: uuid('return_id').notNull().references(() => returns.id),
  transactionItemId: uuid('transaction_item_id').notNull().references(() => transactionItems.id),
  productId: uuid('product_id').notNull(),
  uomId: uuid('uom_id').notNull(),
  qty: numeric('qty', { precision: 15, scale: 4 }).notNull(),
  unitPrice: numeric('unit_price', { precision: 15, scale: 4 }).notNull(),
  cogs: numeric('cogs', { precision: 15, scale: 4 }).notNull(),
  refundAmount: numeric('refund_amount', { precision: 15, scale: 4 }).notNull(),
});
```

### Update Export

Tambahkan export di `packages/db/src/schema/index.ts`:
```typescript
export * from './returns';
```

Tambahkan ke schema object di `packages/db/src/db.ts` (pola sama dengan tabel lain).

### Jalankan Migration

```bash
cd packages/db && npx drizzle-kit generate
```

Migration baru akan muncul sebagai `0004_*.sql`. Jalankan `npx drizzle-kit migrate`.

---

## File Structure

```
apps/backoffice/
├── app/
│   ├── (dashboard)/
│   │   ├── layout.tsx                         # UPDATE: tambah nav link Retur
│   │   └── retur/
│   │       ├── page.tsx                       # BARU: Server Component
│   │       └── _components/
│   │           ├── transaction-search-form.tsx # BARU: Client Component
│   │           └── return-processing-form.tsx  # BARU: Client Component
│   └── api/bo/
│       ├── transactions/
│       │   └── [trxNumber]/
│       │       └── route.ts                   # BARU: GET transaction by trxNumber
│       └── retur/
│           └── route.ts                       # BARU: POST process return
└── lib/
    └── services/
        └── retur-service.ts                   # BARU: getTransactionByTrxNumber, processRetur

packages/db/src/schema/
└── returns.ts                                 # BARU: returns + returnItems tables
```

---

## Service Layer: `apps/backoffice/lib/services/retur-service.ts`

### `getTransactionByTrxNumber(trxNumber: string, branchId: string)`

Query transactions dengan JOIN ke transactionItems, products, dan returnItems untuk hitung remainingQty:

```typescript
// Query dasar:
// SELECT t.*, ti.*, p.name, p.sku,
//   ti.qty - COALESCE(SUM(ri.qty), 0) AS remaining_qty
// FROM transactions t
// JOIN transaction_items ti ON ti.transaction_id = t.id
// JOIN products p ON p.id = ti.product_id
// LEFT JOIN return_items ri ON ri.transaction_item_id = ti.id
// WHERE t.trx_number = ? AND t.branch_id = ?
// GROUP BY t.id, ti.id, p.id
```

Return type:
```typescript
type TransactionWithReturInfo = {
  id: string;
  trxNumber: string;
  createdAt: Date;
  totalAmount: string;
  items: {
    transactionItemId: string;
    productId: string;
    productName: string;
    sku: string;
    uomId: string;
    qty: string;         // qty asli
    remainingQty: string; // qty yang belum diretur
    unitPrice: string;
    cogs: string;
  }[];
  isFullyReturned: boolean; // true jika semua item remainingQty = 0
};
```

Return `null` jika tidak ditemukan atau beda branch.

### `generateReturnNumber(db)`

```typescript
// Format: RTN-YYYYMMDD-XXXX
// Mirip pola generateTrxNumber() di transaction-service.ts
// Query COUNT WHERE return_number LIKE 'RTN-YYYYMMDD-%'
// Pad ke 4 digit: String(count + 1).padStart(4, '0')
```

### `processRetur(payload, db)`

```typescript
type ReturPayload = {
  transactionId: string;
  branchId: string;
  processedById: string;
  reason: string;
  items: { transactionItemId: string; qty: string; }[];
};
```

Urutan operasi dalam `db.transaction()`:
1. Lock `productStocks` rows yang terdampak dengan `.for('update')`
2. Validasi ulang setiap item: fetch remainingQty dari DB (bukan dari payload)
3. Jika ada item yang qty > remainingQty → throw error
4. Hitung `totalRefundAmount` dengan big.js: `SUM(qty * unitPrice)`
5. Generate returnNumber
6. Insert ke `returns`
7. Insert ke `returnItems` (bulk)
8. Per item: INSERT batch baru ke `productStockBatches` dengan `cogs` asli
9. Per item: UPDATE `productStocks` qty += returnQty (dengan `.for('update')`)
10. Insert ke `auditLogs`:
    ```typescript
    {
      userId: processedById,
      action: 'RETURN_PROCESSED',
      tableName: 'returns',
      recordId: returns.id,
      newData: JSON.stringify({ returnNumber, items }),
    }
    ```
11. Return `{ returnNumber }`

---

## API Routes

### `GET /api/bo/transactions/[trxNumber]/route.ts`

```typescript
export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  // 1. Auth: verifyAccessToken dari cookies 'accessToken'
  // 2. Extract branchId dari JWT payload
  // 3. Call getTransactionByTrxNumber(params.trxNumber, branchId)
  // 4. Return 404 jika null: { error: 'Transaksi tidak ditemukan' }
  // 5. Return 200 dengan data
}
```

### `POST /api/bo/retur/route.ts`

```typescript
export const dynamic = 'force-dynamic';

const returSchema = z.object({
  transactionId: z.string().uuid(),
  reason: z.string().min(1, 'Alasan retur wajib diisi'),
  items: z.array(z.object({
    transactionItemId: z.string().uuid(),
    qty: z.string(), // string karena big.js
  })).min(1, 'Pilih minimal 1 item untuk diretur'),
});

export async function POST(req) {
  // 1. Auth: verifyAccessToken dari cookies 'accessToken'
  // 2. Extract userId, branchId dari JWT payload
  // 3. Zod parse body
  // 4. Call processRetur({ ...body, branchId, processedById: userId }, db)
  // 5. Return 201: { returnNumber }
  // 6. Catch & return 400/500 dengan error message Indonesia
}
```

---

## UI Components

### `retur/page.tsx` — Server Component

```typescript
export const dynamic = 'force-dynamic';

// Tidak perlu fetch data awal — search form handle semua
// Render TransactionSearchForm (client component)
// Tidak perlu auth check manual — layout.tsx sudah cover
```

### `_components/transaction-search-form.tsx` — Client Component

State:
- `trxNumber: string` — input
- `transaction: TransactionWithReturInfo | null`
- `isLoading: boolean`
- `searchError: string | null`

Flow:
1. Input nomor transaksi + tombol "Cari"
2. Fetch `GET /api/bo/transactions/{trxNumber}`
3. Jika ditemukan: render `ReturnProcessingForm`
4. Jika 404: tampilkan "Transaksi tidak ditemukan"
5. Jika `isFullyReturned`: tampilkan badge "Sudah Diretur Penuh" + disable form

### `_components/return-processing-form.tsx` — Client Component

Props: `transaction: TransactionWithReturInfo`

State:
- `selectedItems: { transactionItemId: string; qty: string; }[]`
- `reason: string`
- `isSubmitting: boolean`
- `successReturnNumber: string | null`
- `errors: Record<string, string>`

UI:
- Info transaksi (nomor, tanggal, total)
- Tabel item: Checkbox | Nama Produk | SKU | Qty Asli | Sisa Retur | Qty Diretur (input)
- Textarea: Alasan Retur (required)
- Tombol: "Proses Retur"
- Success state: "Retur berhasil! Nomor Retur: RTN-YYYYMMDD-XXXX" + tombol "Retur Lain"

Validasi client-side:
- Minimal 1 item dipilih
- Qty > 0 dan ≤ remainingQty
- Reason tidak kosong

### Sidebar Update: `layout.tsx`

Tambahkan setelah link "Penyesuaian Stok":
```tsx
<Link href="/retur" className="...">
  🔄 Manajemen Retur
</Link>
```

---

## Architecture Compliance (MANDATORY)

| Rule | Implementation |
|------|---------------|
| big.js untuk semua kalkulasi qty/amount | `import Big from 'big.js'` — TIDAK boleh `+`, `-`, `*` langsung pada qty/amount |
| Pessimistic locking | `.for('update')` pada SEMUA UPDATE productStocks |
| Atomicity | Seluruh processRetur dalam satu `db.transaction()` |
| Audit trail | Insert `auditLogs` action `'RETURN_PROCESSED'` WAJIB |
| Drizzle ORM | Semua DB query via Drizzle — tidak ada raw SQL di luar service |
| Zod validation | Di API route handler, bukan di service |
| Auth | `verifyAccessToken()` dari `@/lib/auth` di SETIAP API route |
| branchId dari JWT | TIDAK dari request body |
| `force-dynamic` | Di semua API route files |
| Error messages | Bahasa Indonesia |
| Tailwind CSS 4 | Styling — tidak ada inline style |
| Server Component | `retur/page.tsx` adalah Server Component |
| Fetch pattern | Page → service langsung, BUKAN fetch ke API sendiri |

---

## Anti-Patterns (FORBIDDEN)

- ❌ `Number()`, `parseFloat()` pada qty/amount — gunakan `new Big(value)`
- ❌ Skip `.for('update')` saat update productStocks
- ❌ `branchId` dari request body — HARUS dari JWT payload
- ❌ Update batch FIFO lama saat stock reversal — BUAT batch baru
- ❌ Skip audit log — setiap retur HARUS masuk `auditLogs`
- ❌ Validasi qty hanya di frontend — WAJIB revalidasi di service layer
- ❌ Membolehkan retur di luar branch sendiri (branch-scoped strict)
- ❌ Mengubah status transaksi asli menjadi VOIDED — retur BERBEDA dari void
- ❌ Client Component sebagai page.tsx — harus Server Component
- ❌ Fetch internal dari Server Component — panggil service langsung

---

## Referensi Implementasi Existing

### Pattern Auth (dari Story 5.x, 6.1)
```typescript
// Di setiap API route:
const token = cookies().get('accessToken')?.value;
if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const payload = verifyAccessToken(token);
if (!payload) return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });
const { userId, branchId } = payload;
```

### Pattern Stock Reversal (kebalikan dari `StockService.deductStock()`)
Lihat `apps/backoffice/lib/services/stock-service.ts` — deductStock() untuk FIFO deduction.
Untuk reversal: INSERT batch baru (bukan update existing), UPDATE aggregate qty += amount.

### Pattern Audit Log (dari `applyManualStockAdjustment()`)
```typescript
// Dari: apps/backoffice/lib/stock-adjustment.ts
await db.insert(auditLogs).values({
  userId,
  action: 'RETURN_PROCESSED',
  tableName: 'returns',
  recordId: returnId,
  oldData: null,
  newData: JSON.stringify({ returnNumber, totalRefundAmount, itemCount }),
});
```

### Pattern Service di `transaction-service.ts`
- `generateTrxNumber()` → tirukan untuk `generateReturnNumber()` dengan prefix `RTN-`
- `db.transaction()` pattern → tirukan untuk atomicity

### Pattern Form (dari `adjustment-form.tsx`)
- Client component dengan state lokal
- Submit ke API route via `fetch()`
- Error handling dengan Indonesian messages
- Success state dengan reset form

---

## Catatan Penting untuk Dev Agent

1. **remainingQty harus dihitung di DB**, bukan di frontend. Saat fetch transaksi, JOIN ke `returnItems` dan hitung `originalQty - SUM(returnedQty)`.

2. **Cogs untuk stock reversal**: Ambil dari `transactionItems.cogs` (bukan recalculate). Field ini sudah tersimpan saat transaksi terjadi.

3. **Return number format**: `RTN-` + tanggal + counter harian 4 digit. Counter dihitung dari jumlah returns hari itu. Mirip `generateTrxNumber()`.

4. **Transaksi asli tidak berubah**: Status transaksi asli tetap `COMPLETED`. Retur adalah dokumen terpisah yang REFERENSI ke transaksi asli.

5. **Jika semua item di transaksi sudah diretur**: `isFullyReturned = true`. Tampilkan info ini di UI agar owner tidak bingung.

6. **Big.js untuk perbandingan**: Gunakan `new Big(returnQty).gt(new Big(remainingQty))` bukan `returnQty > remainingQty`.

7. **`branches` table reference**: Cek nama tabel di `packages/db/src/schema/master.ts` atau file terkait. Field `branchId` di `returns` tidak perlu FK constraint jika tidak ada tabel `branches` yang bisa di-reference (hindari coupling jika tidak perlu).
