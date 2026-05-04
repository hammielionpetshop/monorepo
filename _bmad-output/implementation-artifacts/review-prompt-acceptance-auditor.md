You are an Acceptance Auditor. Review this diff against the spec and context docs. Check for: violations of acceptance criteria, deviations from spec intent, missing implementation of specified behavior, contradictions between spec constraints and actual code. 

### SPECIFICATION

# Story 4.4: Backoffice Retur Management

**Story ID:** 4.4
**Story Key:** 4-4-backoffice-retur-management
**Epic:** 4 - Transaction Correction & Retur (Post-MVP)
**Status:** completed
**Created:** 2026-05-03
**FR Coverage:** FR17

---

## User Story

Sebagai Owner,
saya ingin memproses Retur dari dashboard backoffice,
Agar saya dapat menangani pengembalian barang secara aman di luar area kasir yang sibuk, dengan penyesuaian stok dan audit trail yang terjaga.

---

## Acceptance Criteria

**AC1 â€” Search Transaksi**
Given Owner login ke Backoffice dan membuka modul Retur
When mereka memasukkan nomor transaksi (format TRX-YYYYMMDD-XXXX) dan menekan Cari
Then sistem menampilkan detail transaksi beserta daftar item dengan sisa qty yang bisa diretur
And transaksi dari branch lain tidak bisa ditemukan (branch-scoped)

**AC2 â€” Proses Retur Partial atau Full**
Given Owner memilih item dan qty yang ingin diretur
When mereka mengisi alasan retur dan mengkonfirmasi
Then sistem mencatat retur di database (tabel `returns` + `returnItems`)
And stok item dikembalikan ke inventaris sebagai batch FIFO baru dengan COGS asli
And audit log dicatat dengan action `'RETURN_PROCESSED'`
And halaman menampilkan pesan sukses beserta nomor retur (RTN-YYYYMMDD-XXXX)

**AC3 â€” Validasi Qty**
Given Owner memasukkan qty retur > sisa qty yang belum diretur
When form dikirim
Then sistem menolak dengan error: "Kuantitas retur melebihi sisa item yang dapat dikembalikan"

**AC4 â€” Double Return Prevention**
Given semua item di suatu transaksi sudah diretur penuh
When Owner mencari transaksi tersebut
Then sistem menampilkan label "Sudah Diretur Penuh" dan menonaktifkan form retur

**AC5 â€” Alasan Wajib**
Given Owner tidak mengisi alasan retur
When form dikirim
Then sistem menampilkan error: "Alasan retur wajib diisi"

**AC6 â€” Auth**
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
â”œâ”€â”€ app/
â”‚   â”œâ”€â”€ (dashboard)/
â”‚   â”‚   â”œâ”€â”€ layout.tsx                         # UPDATE: tambah nav link Retur
â”‚   â”‚   â””â”€â”€ retur/
â”‚   â”‚       â”œâ”€â”€ page.tsx                       # BARU: Server Component
â”‚   â”‚       â””â”€â”€ _components/
â”‚   â”‚           â”œâ”€â”€ transaction-search-form.tsx # BARU: Client Component
â”‚   â”‚           â””â”€â”€ return-processing-form.tsx  # BARU: Client Component
â”‚   â””â”€â”€ api/bo/
â”‚       â”œâ”€â”€ transactions/
â”‚       â”‚   â””â”€â”€ [trxNumber]/
â”‚       â”‚       â””â”€â”€ route.ts                   # BARU: GET transaction by trxNumber
â”‚       â””â”€â”€ retur/
â”‚           â””â”€â”€ route.ts                       # BARU: POST process return
â””â”€â”€ lib/
    â””â”€â”€ services/
        â””â”€â”€ retur-service.ts                   # BARU: getTransactionByTrxNumber, processRetur

packages/db/src/schema/
â””â”€â”€ returns.ts                                 # BARU: returns + returnItems tables
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
3. Jika ada item yang qty > remainingQty â†’ throw error
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

### `retur/page.tsx` â€” Server Component

```typescript
export const dynamic = 'force-dynamic';

// Tidak perlu fetch data awal â€” search form handle semua
// Render TransactionSearchForm (client component)
// Tidak perlu auth check manual â€” layout.tsx sudah cover
```

### `_components/transaction-search-form.tsx` â€” Client Component

State:
- `trxNumber: string` â€” input
- `transaction: TransactionWithReturInfo | null`
- `isLoading: boolean`
- `searchError: string | null`

Flow:
1. Input nomor transaksi + tombol "Cari"
2. Fetch `GET /api/bo/transactions/{trxNumber}`
3. Jika ditemukan: render `ReturnProcessingForm`
4. Jika 404: tampilkan "Transaksi tidak ditemukan"
5. Jika `isFullyReturned`: tampilkan badge "Sudah Diretur Penuh" + disable form

### `_components/return-processing-form.tsx` â€” Client Component

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
- Qty > 0 dan â‰¤ remainingQty
- Reason tidak kosong

### Sidebar Update: `layout.tsx`

Tambahkan setelah link "Penyesuaian Stok":
```tsx
<Link href="/retur" className="...">
  ðŸ”„ Manajemen Retur
</Link>
```

---

## Architecture Compliance (MANDATORY)

| Rule | Implementation |
|------|---------------|
| big.js untuk semua kalkulasi qty/amount | `import Big from 'big.js'` â€” TIDAK boleh `+`, `-`, `*` langsung pada qty/amount |
| Pessimistic locking | `.for('update')` pada SEMUA UPDATE productStocks |
| Atomicity | Seluruh processRetur dalam satu `db.transaction()` |
| Audit trail | Insert `auditLogs` action `'RETURN_PROCESSED'` WAJIB |
| Drizzle ORM | Semua DB query via Drizzle â€” tidak ada raw SQL di luar service |
| Zod validation | Di API route handler, bukan di service |
| Auth | `verifyAccessToken()` dari `@/lib/auth` di SETIAP API route |
| branchId dari JWT | TIDAK dari request body |
| `force-dynamic` | Di semua API route files |
| Error messages | Bahasa Indonesia |
| Tailwind CSS 4 | Styling â€” tidak ada inline style |
| Server Component | `retur/page.tsx` adalah Server Component |
| Fetch pattern | Page â†’ service langsung, BUKAN fetch ke API sendiri |

---

## Anti-Patterns (FORBIDDEN)

- âŒ `Number()`, `parseFloat()` pada qty/amount â€” gunakan `new Big(value)`
- âŒ Skip `.for('update')` saat update productStocks
- âŒ `branchId` dari request body â€” HARUS dari JWT payload
- âŒ Update batch FIFO lama saat stock reversal â€” BUAT batch baru
- âŒ Skip audit log â€” setiap retur HARUS masuk `auditLogs`
- âŒ Validasi qty hanya di frontend â€” WAJIB revalidasi di service layer
- âŒ Membolehkan retur di luar branch sendiri (branch-scoped strict)
- âŒ Mengubah status transaksi asli menjadi VOIDED â€” retur BERBEDA dari void
- âŒ Client Component sebagai page.tsx â€” harus Server Component
- âŒ Fetch internal dari Server Component â€” panggil service langsung

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
Lihat `apps/backoffice/lib/services/stock-service.ts` â€” deductStock() untuk FIFO deduction.
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
- `generateTrxNumber()` â†’ tirukan untuk `generateReturnNumber()` dengan prefix `RTN-`
- `db.transaction()` pattern â†’ tirukan untuk atomicity

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


### DIFF OUTPUT

`diff
diff --git a/apps/backoffice/app/(dashboard)/layout.tsx b/apps/backoffice/app/(dashboard)/layout.tsx index 77d5ffc..2ed3402 100644 --- a/apps/backoffice/app/(dashboard)/layout.tsx +++ b/apps/backoffice/app/(dashboard)/layout.tsx @@ -59,6 +59,13 @@ export default async function DashboardLayout({              <span>🔧</span>              Penyesuaian Stok            </a> +          <a +            href="/retur" +            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-primary transition-colors" +          > +            <span>🔄</span> +            Manajemen Retur +          </a>          </nav>        </aside>  
diff --git a/packages/db/src/schema/index.ts b/packages/db/src/schema/index.ts index c859776..230a091 100644 --- a/packages/db/src/schema/index.ts +++ b/packages/db/src/schema/index.ts @@ -15,3 +15,4 @@ export * from './audit';  export * from './notifications';  export * from './damaged_goods';  export * from './delivery_orders'; +export * from './returns';
diff --git a/apps/backoffice/app/(dashboard)/retur/_components/return-processing-form.tsx b/apps/backoffice/app/(dashboard)/retur/_components/return-processing-form.tsx new file mode 100644 index 0000000..f20b98b --- /dev/null +++ b/apps/backoffice/app/(dashboard)/retur/_components/return-processing-form.tsx @@ -0,0 +1,197 @@ +'use client'; + +import { useState, useMemo } from 'react'; +import Big from 'big.js'; +import type { TransactionWithReturInfo } from '@/lib/services/retur-service'; + +export default function ReturnProcessingForm({  +  transaction,  +  onSuccess  +}: {  +  transaction: TransactionWithReturInfo;  +  onSuccess: () => void; +}) { +  const [reason, setReason] = useState(''); +  const [returnQtys, setReturnQtys] = useState<Record<number, string>>({}); +  const [isSubmitting, setIsSubmitting] = useState(false); +  const [error, setError] = useState<string | null>(null); + +  // Filter items that have return quantity > 0 +  const selectedItems = useMemo(() => { +    return Object.entries(returnQtys) +      .filter(([_, qty]) => { +        try { +          return qty && new Big(qty).gt(0); +        } catch { +          return false; +        } +      }) +      .map(([id, qty]) => ({ +        transactionItemId: Number(id), +        qty: qty +      })); +  }, [returnQtys]); + +  // Calculate total refund estimate +  const totalRefund = useMemo(() => { +    let total = new Big(0); +    for (const item of selectedItems) { +      const trxItem = transaction.items.find(i => i.transactionItemId === item.transactionItemId); +      if (trxItem) { +        try { +          total = total.plus(new Big(item.qty).times(new Big(trxItem.unitPrice))); +        } catch (e) { +          // Ignore invalid numbers during typing +        } +      } +    } +    return total.toString(); +  }, [selectedItems, transaction.items]); + +  const handleQtyChange = (itemId: number, qty: string, max: string) => { +    try { +      if (qty && new Big(qty).gt(new Big(max))) { +        qty = max; +      } +      setReturnQtys(prev => ({ ...prev, [itemId]: qty })); +    } catch { +      setReturnQtys(prev => ({ ...prev, [itemId]: qty })); +    } +  }; + +  async function handleSubmit(e: React.FormEvent) { +    e.preventDefault(); +    if (selectedItems.length === 0) { +      setError('Pilih minimal satu item untuk diretur'); +      return; +    } +    if (!reason.trim()) { +      setError('Alasan retur wajib diisi'); +      return; +    } + +    setIsSubmitting(true); +    setError(null); + +    try { +      const res = await fetch('/api/bo/retur', { +        method: 'POST', +        headers: { 'Content-Type': 'application/json' }, +        body: JSON.stringify({ +          transactionId: transaction.id, +          reason, +          items: selectedItems +        }) +      }); + +      const data = await res.json(); +      if (!res.ok) { +        throw new Error(data.error || 'Gagal memproses retur'); +      } + +      alert(`Retur berhasil diproses dengan nomor: ${data.returnNumber}`); +      setReason(''); +      setReturnQtys({}); +      onSuccess(); +    } catch (err: any) { +      setError(err.message); +    } finally { +      setIsSubmitting(false); +    } +  } + +  return ( +    <form onSubmit={handleSubmit} className="space-y-6"> +      <div className="overflow-x-auto border border-border rounded-lg"> +        <table className="w-full text-sm text-left"> +          <thead className="bg-muted/50 border-b border-border"> +            <tr> +              <th className="px-4 py-3 font-semibold text-foreground">Produk</th> +              <th className="px-4 py-3 font-semibold text-foreground text-right">Harga Satuan</th> +              <th className="px-4 py-3 font-semibold text-foreground text-right">Qty Beli</th> +              <th className="px-4 py-3 font-semibold text-foreground text-right">Sisa Bisa Retur</th> +              <th className="px-4 py-3 font-semibold text-foreground text-right w-32">Qty Retur</th> +            </tr> +          </thead> +          <tbody className="divide-y divide-border/50"> +            {transaction.items.map((item) => { +              const isFull = new Big(item.remainingQty).lte(0); +              return ( +                <tr key={item.transactionItemId} className={`hover:bg-muted/5 transition-colors ${isFull ? 'opacity-60 bg-muted/20' : ''}`}> +                  <td className="px-4 py-4"> +                    <div className="font-medium text-foreground">{item.productName}</div> +                    <div className="text-xs text-muted-foreground">{item.sku || '-'}</div> +                  </td> +                  <td className="px-4 py-4 text-right tabular-nums"> +                    Rp {Number(item.unitPrice).toLocaleString('id-ID')} +                  </td> +                  <td className="px-4 py-4 text-right tabular-nums"> +                    {item.qty} +                  </td> +                  <td className="px-4 py-4 text-right font-medium tabular-nums text-primary"> +                    {item.remainingQty} +                  </td> +                  <td className="px-4 py-4 text-right"> +                    <input +                      type="number" +                      min="0" +                      step="any" +                      disabled={transaction.isFullyReturned || isFull} +                      value={returnQtys[item.transactionItemId] || ''} +                      onChange={(e) => handleQtyChange(item.transactionItemId, e.target.value, item.remainingQty)} +                      placeholder="0" +                      className="w-full bg-background border border-input rounded px-2 py-1.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:bg-muted/50 transition-all" +                    /> +                  </td> +                </tr> +              ); +            })} +          </tbody> +        </table> +      </div> + +      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2"> +        <div> +          <label className="block text-sm font-semibold mb-2 text-foreground">Alasan Pengembalian</label> +          <textarea +            value={reason} +            onChange={(e) => setReason(e.target.value)} +            disabled={transaction.isFullyReturned} +            placeholder="Contoh: Barang cacat saat diterima, Salah ukuran, dll" +            className="w-full bg-background border border-input rounded-md px-4 py-2 text-sm h-32 focus:outline-none focus:ring-2 focus:ring-ring disabled:bg-muted/50 transition-all" +            required +          /> +        </div> +         +        <div className="bg-primary/5 p-6 rounded-xl border border-primary/10 flex flex-col justify-center items-center text-center"> +          <p className="text-sm text-muted-foreground font-medium">Estimasi Total Refund</p> +          <h2 className="text-4xl font-black text-primary mt-2"> +            Rp {Number(totalRefund).toLocaleString('id-ID')} +          </h2> +          <div className="mt-6 flex items-start gap-2 text-left bg-background/50 p-3 rounded-lg border border-border/50"> +            <span className="text-amber-500">⚠️</span> +            <p className="text-[10px] leading-relaxed text-muted-foreground uppercase font-bold tracking-tight"> +              PENGEMBALIAN DANA DILAKUKAN SECARA MANUAL DI LUAR SISTEM INI. PASTIKAN STOK FISIK TELAH DITERIMA KEMBALI. +            </p> +          </div> +        </div> +      </div> + +      {error && ( +        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm font-medium animate-in fade-in slide-in-from-top-1"> +          {error} +        </div> +      )} + +      <div className="flex justify-end pt-4 border-t border-border"> +        <button +          type="submit" +          disabled={isSubmitting || transaction.isFullyReturned || selectedItems.length === 0} +          className="bg-primary text-primary-foreground px-10 py-3.5 rounded-lg text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 hover:translate-y-[-2px] disabled:opacity-50 disabled:translate-y-0 transition-all active:scale-95" +        > +          {isSubmitting ? 'Memproses Transaksi...' : 'Konfirmasi Retur Barang'} +        </button> +      </div> +    </form> +  ); +}
diff --git a/apps/backoffice/app/(dashboard)/retur/_components/transaction-search-form.tsx b/apps/backoffice/app/(dashboard)/retur/_components/transaction-search-form.tsx new file mode 100644 index 0000000..474913e --- /dev/null +++ b/apps/backoffice/app/(dashboard)/retur/_components/transaction-search-form.tsx @@ -0,0 +1,99 @@ +'use client'; + +import { useState } from 'react'; +import type { TransactionWithReturInfo } from '@/lib/services/retur-service'; +import ReturnProcessingForm from './return-processing-form'; + +export default function TransactionSearchForm() { +  const [trxNumber, setTrxNumber] = useState(''); +  const [transaction, setTransaction] = useState<TransactionWithReturInfo | null>(null); +  const [isLoading, setIsLoading] = useState(false); +  const [searchError, setSearchError] = useState<string | null>(null); + +  async function handleSearch(e: React.FormEvent) { +    e.preventDefault(); +    if (!trxNumber.trim()) return; + +    setIsLoading(true); +    setSearchError(null); +    setTransaction(null); + +    try { +      const res = await fetch(`/api/bo/transactions/${trxNumber.trim()}`); +      const data = await res.json(); + +      if (!res.ok) { +        setSearchError(data.error || 'Gagal mencari transaksi'); +        return; +      } + +      setTransaction(data); +    } catch (error) { +      setSearchError('Terjadi kesalahan koneksi'); +    } finally { +      setIsLoading(false); +    } +  } + +  return ( +    <div className="space-y-6"> +      <div className="bg-card p-6 rounded-lg border border-border shadow-sm"> +        <h3 className="text-sm font-semibold mb-4 text-foreground uppercase tracking-wider">Cari Transaksi</h3> +        <form onSubmit={handleSearch} className="flex gap-2"> +          <input +            type="text" +            value={trxNumber} +            onChange={(e) => setTrxNumber(e.target.value)} +            placeholder="TRX-YYYYMMDD-XXXX" +            className="flex-1 bg-background border border-input rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" +            required +          /> +          <button +            type="submit" +            disabled={isLoading} +            className="bg-primary text-primary-foreground px-6 py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors" +          > +            {isLoading ? 'Mencari...' : 'Cari'} +          </button> +        </form> + +        {searchError && ( +          <div className="mt-4 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm"> +            {searchError} +          </div> +        )} +      </div> + +      {transaction && ( +        <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden"> +          <div className="p-6 border-b border-border bg-muted/30 flex justify-between items-center"> +            <div> +              <p className="text-xs text-muted-foreground uppercase font-bold tracking-tight">Detail Transaksi</p> +              <h4 className="text-lg font-bold text-foreground">{transaction.trxNumber}</h4> +              <p className="text-sm text-muted-foreground">{new Date(transaction.createdAt).toLocaleString('id-ID')}</p> +            </div> +            {transaction.isFullyReturned ? ( +              <span className="bg-destructive/10 text-destructive text-xs font-bold px-3 py-1 rounded-full border border-destructive/20"> +                Sudah Diretur Penuh +              </span> +            ) : ( +              <span className="bg-green-50 text-green-700 text-xs font-bold px-3 py-1 rounded-full border border-green-200"> +                Siap Diretur +              </span> +            )} +          </div> +           +          <div className="p-6"> +             <ReturnProcessingForm  +               transaction={transaction}  +               onSuccess={() => { +                 // Refresh transaction data after success +                 handleSearch({ preventDefault: () => {} } as any); +               }} +             /> +          </div> +        </div> +      )} +    </div> +  ); +}
diff --git a/apps/backoffice/app/(dashboard)/retur/page.tsx b/apps/backoffice/app/(dashboard)/retur/page.tsx new file mode 100644 index 0000000..935fc1f --- /dev/null +++ b/apps/backoffice/app/(dashboard)/retur/page.tsx @@ -0,0 +1,20 @@ +import TransactionSearchForm from './_components/transaction-search-form'; + +export const dynamic = 'force-dynamic'; + +export default function ReturPage() { +  return ( +    <div className="p-6"> +      <div className="mb-8"> +        <h1 className="text-2xl font-bold text-foreground">Manajemen Retur</h1> +        <p className="text-muted-foreground mt-1"> +          Cari transaksi dan proses pengembalian barang secara aman. +        </p> +      </div> + +      <div className="max-w-4xl"> +        <TransactionSearchForm /> +      </div> +    </div> +  ); +}
diff --git a/apps/backoffice/app/api/bo/retur/route.ts b/apps/backoffice/app/api/bo/retur/route.ts new file mode 100644 index 0000000..69da9d3 --- /dev/null +++ b/apps/backoffice/app/api/bo/retur/route.ts @@ -0,0 +1,48 @@ +import { NextRequest, NextResponse } from 'next/server'; +import { cookies } from 'next/headers'; +import { z } from 'zod'; +import { verifyAccessToken } from '@/lib/auth'; +import { ReturService } from '@/lib/services/retur-service'; + +export const dynamic = 'force-dynamic'; + +const returSchema = z.object({ +  transactionId: z.number().int().positive(), +  reason: z.string().min(1, 'Alasan retur wajib diisi'), +  items: z.array(z.object({ +    transactionItemId: z.number().int().positive(), +    qty: z.string().regex(/^\d+(\.\d+)?$/, 'Kuantitas tidak valid'), +  })).min(1, 'Pilih minimal 1 item untuk diretur'), +}); + +export async function POST(req: NextRequest) { +  try { +    const cookieStore = await cookies(); +    const token = cookieStore.get('accessToken')?.value; +    const payload = token ? await verifyAccessToken(token) : null; +     +    if (!payload) { +      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 }); +    } + +    const { userId, branchId } = payload; +    const body = await req.json(); +     +    const parsed = returSchema.safeParse(body); +    if (!parsed.success) { +      const message = parsed.error.issues[0]?.message ?? 'Data tidak valid'; +      return NextResponse.json({ error: message }, { status: 400 }); +    } + +    const result = await ReturService.processRetur({ +      ...parsed.data, +      branchId, +      processedById: userId, +    }); + +    return NextResponse.json(result, { status: 201 }); +  } catch (error: unknown) { +    const message = error instanceof Error ? error.message : 'Gagal memproses retur'; +    return NextResponse.json({ error: message }, { status: 500 }); +  } +}
diff --git a/apps/backoffice/lib/services/retur-service.ts b/apps/backoffice/lib/services/retur-service.ts new file mode 100644 index 0000000..47033b7 --- /dev/null +++ b/apps/backoffice/lib/services/retur-service.ts @@ -0,0 +1,306 @@ +import {  +  db,  +  transactions,  +  transactionItems,  +  returns,  +  returnItems,  +  products,  +  productStocks,  +  productStockBatches,  +  auditLogs, +  eq,  +  and,  +  sql,  +  desc,  +  asc, +  like, +  inArray +} from '../db'; +import Big from 'big.js'; + +export type TransactionWithReturInfo = { +  id: number; +  trxNumber: string; +  createdAt: Date; +  totalAmount: string; +  items: { +    transactionItemId: number; +    productId: number; +    productName: string; +    sku: string | null; +    uomId: number; +    qty: string; +    remainingQty: string; +    unitPrice: string; +    cogs: string; +  }[]; +  isFullyReturned: boolean; +}; + +export class ReturService { +  /** +   * Menghasilkan nomor retur unik dengan format RTN-YYYYMMDD-XXXX. +   * Counter XXXX dihitung berdasarkan jumlah retur pada hari tersebut. +   */ +  static async generateReturnNumber() { +    const today = new Date(); +    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); +    const prefix = `RTN-${dateStr}-`; + +    const [row] = await db +      .select({ count: sql<number>`count(*)` }) +      .from(returns) +      .where(like(returns.returnNumber, `${prefix}%`)); + +    const nextId = (Number(row?.count || 0) + 1).toString().padStart(4, '0'); +    return `${prefix}${nextId}`; +  } + +  /** +   * Mengambil detail transaksi berdasarkan nomor transaksi dan branch. +   * Menghitung sisa kuantitas yang bisa diretur per item. +   */ +  static async getTransactionByTrxNumber(trxNumber: string, branchId: number): Promise<TransactionWithReturInfo | null> { +    const trxRows = await db +      .select({ +        id: transactions.id, +        trxNumber: transactions.trxNumber, +        createdAt: transactions.createdAt, +        totalAmount: transactions.payableAmount, +      }) +      .from(transactions) +      .where( +        and( +          eq(transactions.trxNumber, trxNumber), +          eq(transactions.branchId, branchId) +        ) +      ) +      .limit(1); + +    if (trxRows.length === 0) return null; + +    const trx = trxRows[0]; + +    const itemRows = await db +      .select({ +        transactionItemId: transactionItems.id, +        productId: transactionItems.productId, +        productName: products.name, +        sku: products.sku, +        uomId: transactionItems.uomId, +        qty: transactionItems.qty, +        unitPrice: transactionItems.unitPrice, +        cogs: transactionItems.cogs, +        returnedQty: sql<string>`COALESCE(SUM(${returnItems.qty}), '0')`, +      }) +      .from(transactionItems) +      .innerJoin(products, eq(products.id, transactionItems.productId)) +      .leftJoin(returnItems, eq(returnItems.transactionItemId, transactionItems.id)) +      .where(eq(transactionItems.transactionId, trx.id)) +      .groupBy( +        transactionItems.id, +        transactionItems.productId, +        products.name, +        products.sku, +        transactionItems.uomId, +        transactionItems.qty, +        transactionItems.unitPrice, +        transactionItems.cogs +      ); + +    const items = itemRows.map(row => { +      const originalQty = new Big(row.qty); +      const returnedQty = new Big(row.returnedQty || '0'); +      const remainingQty = originalQty.minus(returnedQty); + +      return { +        transactionItemId: row.transactionItemId, +        productId: row.productId, +        productName: row.productName, +        sku: row.sku, +        uomId: row.uomId, +        qty: row.qty, +        remainingQty: remainingQty.lt(0) ? '0' : remainingQty.toString(), +        unitPrice: row.unitPrice, +        cogs: row.cogs || '0', +      }; +    }); + +    const isFullyReturned = items.length > 0 && items.every(item => new Big(item.remainingQty).lte(0)); + +    return { +      id: trx.id, +      trxNumber: trx.trxNumber, +      createdAt: trx.createdAt, +      totalAmount: trx.totalAmount, +      items, +      isFullyReturned, +    }; +  } + +  /** +   * Memproses retur dalam satu transaksi database. +   * Mencakup validasi, pencatatan retur, pembalikan stok (FIFO), dan audit log. +   */ +  static async processRetur(payload: { +    transactionId: number; +    branchId: number; +    processedById: number; +    reason: string; +    items: { transactionItemId: number; qty: string }[]; +  }) { +    return await db.transaction(async (tx) => { +      const itemIds = payload.items.map(i => i.transactionItemId); + +      // Fetch transaction item details +      const txItems = await tx +        .select({ +          id: transactionItems.id, +          productId: transactionItems.productId, +          uomId: transactionItems.uomId, +          unitPrice: transactionItems.unitPrice, +          cogs: transactionItems.cogs, +          qty: transactionItems.qty, +        }) +        .from(transactionItems) +        .where(inArray(transactionItems.id, itemIds)); + +      // Map payload items with their details +      const itemsWithDetails = payload.items.map(pItem => { +        const detail = txItems.find(ti => ti.id === pItem.transactionItemId); +        if (!detail) throw new Error(`Item transaksi ${pItem.transactionItemId} tidak ditemukan`); +        return { ...pItem, ...detail, returnQty: pItem.qty }; +      }); + +      // 1. Lock affected product stocks to prevent race conditions +      const productIds = Array.from(new Set(itemsWithDetails.map(i => i.productId))); +      if (productIds.length > 0) { +        await tx +          .select({ id: productStocks.id }) +          .from(productStocks) +          .where( +            and( +              inArray(productStocks.productId, productIds), +              eq(productStocks.branchId, payload.branchId) +            ) +          ) +          .for('update'); +      } + +      // 2. Revalidate remainingQty per item +      let totalRefundAmount = new Big(0); +      for (const item of itemsWithDetails) { +        const [retRow] = await tx +          .select({ returnedQty: sql<string>`COALESCE(SUM(${returnItems.qty}), '0')` }) +          .from(returnItems) +          .where(eq(returnItems.transactionItemId, item.transactionItemId)); +         +        const alreadyReturned = new Big(retRow?.returnedQty || '0'); +        const originalQty = new Big(item.qty); +        const remainingQty = originalQty.minus(alreadyReturned); +         +        if (new Big(item.returnQty).gt(remainingQty)) { +          throw new Error(`Kuantitas retur melebihi sisa item yang dapat dikembalikan`); +        } +         +        totalRefundAmount = totalRefundAmount.plus(new Big(item.returnQty).times(new Big(item.unitPrice))); +      } + +      // 3. Generate return number +      // We do this inside transaction to ensure order if multiple returns happen simultaneously +      const today = new Date(); +      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); +      const prefix = `RTN-${dateStr}-`; +      const [countRow] = await tx +        .select({ count: sql<number>`count(*)` }) +        .from(returns) +        .where(like(returns.returnNumber, `${prefix}%`)); +       +      const nextId = (Number(countRow?.count || 0) + 1).toString().padStart(4, '0'); +      const returnNumber = `${prefix}${nextId}`; + +      // 4. Insert into returns header +      const [newReturn] = await tx.insert(returns).values({ +        returnNumber, +        transactionId: payload.transactionId, +        branchId: payload.branchId, +        processedById: payload.processedById, +        reason: payload.reason, +        totalRefundAmount: totalRefundAmount.toString(), +      }).returning(); + +      // 5. Process each item for stock reversal +      for (const item of itemsWithDetails) { +        const returnQty = new Big(item.returnQty); +         +        // Insert into return_items +        await tx.insert(returnItems).values({ +          returnId: newReturn.id, +          transactionItemId: item.transactionItemId, +          productId: item.productId, +          uomId: item.uomId, +          qty: item.returnQty, +          unitPrice: item.unitPrice, +          cogs: item.cogs || '0', +          refundAmount: returnQty.times(new Big(item.unitPrice)).toString(), +        }); + +        // 6. Stock Reversal Logic +        // Update aggregate stock in product_stocks +        const [stock] = await tx +          .select() +          .from(productStocks) +          .where( +            and( +              eq(productStocks.productId, item.productId), +              eq(productStocks.branchId, payload.branchId), +              eq(productStocks.uomId, item.uomId) +            ) +          ); + +        if (stock) { +          await tx +            .update(productStocks) +            .set({ qty: sql`${productStocks.qty} + ${item.returnQty}` }) +            .where(eq(productStocks.id, stock.id)); +        } else { +          await tx.insert(productStocks).values({ +            productId: item.productId, +            branchId: payload.branchId, +            uomId: item.uomId, +            qty: item.returnQty, +          }); +        } + +        // Add back as a NEW FIFO batch to maintain valuation accuracy +        // We use the original COGS from the transaction +        await tx.insert(productStockBatches).values({ +          productId: item.productId, +          branchId: payload.branchId, +          uomId: item.uomId, +          qtyReceived: item.returnQty, +          qtyRemaining: item.returnQty, +          costPrice: item.cogs || '0', +          receivedAt: new Date(), +        }); +      } + +      // 7. Record Audit Trail +      await tx.insert(auditLogs).values({ +        branchId: payload.branchId, +        userId: payload.processedById, +        action: 'RETURN_PROCESSED', +        tableName: 'returns', +        recordId: newReturn.id, +        newData: JSON.stringify({  +          returnNumber,  +          transactionId: payload.transactionId, +          totalRefundAmount: totalRefundAmount.toString(), +          items: payload.items  +        }), +      }); + +      return { returnNumber }; +    }); +  } +}
diff --git a/packages/db/src/migrations/0004_broken_hardball.sql b/packages/db/src/migrations/0004_broken_hardball.sql new file mode 100644 index 0000000..7e65e55 --- /dev/null +++ b/packages/db/src/migrations/0004_broken_hardball.sql @@ -0,0 +1,31 @@ +CREATE TABLE "petshop"."return_items" ( +	"id" serial PRIMARY KEY NOT NULL, +	"return_id" integer NOT NULL, +	"transaction_item_id" integer NOT NULL, +	"product_id" integer NOT NULL, +	"uom_id" integer NOT NULL, +	"qty" numeric(12, 2) NOT NULL, +	"unit_price" numeric(12, 2) NOT NULL, +	"cogs" numeric(12, 2) NOT NULL, +	"refund_amount" numeric(12, 2) NOT NULL +); +--> statement-breakpoint +CREATE TABLE "petshop"."returns" ( +	"id" serial PRIMARY KEY NOT NULL, +	"return_number" varchar(50) NOT NULL, +	"transaction_id" integer NOT NULL, +	"branch_id" integer NOT NULL, +	"processed_by_id" integer NOT NULL, +	"reason" text NOT NULL, +	"total_refund_amount" numeric(12, 2) NOT NULL, +	"created_at" timestamp DEFAULT now() NOT NULL, +	CONSTRAINT "returns_return_number_unique" UNIQUE("return_number") +); +--> statement-breakpoint +ALTER TABLE "petshop"."return_items" ADD CONSTRAINT "return_items_return_id_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "petshop"."returns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint +ALTER TABLE "petshop"."return_items" ADD CONSTRAINT "return_items_transaction_item_id_transaction_items_id_fk" FOREIGN KEY ("transaction_item_id") REFERENCES "petshop"."transaction_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint +ALTER TABLE "petshop"."return_items" ADD CONSTRAINT "return_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "petshop"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint +ALTER TABLE "petshop"."return_items" ADD CONSTRAINT "return_items_uom_id_units_of_measure_id_fk" FOREIGN KEY ("uom_id") REFERENCES "petshop"."units_of_measure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint +ALTER TABLE "petshop"."returns" ADD CONSTRAINT "returns_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "petshop"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint +ALTER TABLE "petshop"."returns" ADD CONSTRAINT "returns_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "petshop"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint +ALTER TABLE "petshop"."returns" ADD CONSTRAINT "returns_processed_by_id_users_id_fk" FOREIGN KEY ("processed_by_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action; \ No newline at end of file
diff --git a/packages/db/src/schema/returns.ts b/packages/db/src/schema/returns.ts new file mode 100644 index 0000000..10fb399 --- /dev/null +++ b/packages/db/src/schema/returns.ts @@ -0,0 +1,30 @@ +import { serial, varchar, text, decimal, timestamp, integer } from 'drizzle-orm/pg-core'; +import { petshop } from './_schema'; +import { transactions, transactionItems } from './transactions'; +import { branches } from './branches'; +import { users } from './users'; +import { products } from './products'; +import { unitsOfMeasure } from './master'; + +export const returns = petshop.table('returns', { +  id: serial('id').primaryKey(), +  returnNumber: varchar('return_number', { length: 50 }).notNull().unique(), +  transactionId: integer('transaction_id').notNull().references(() => transactions.id), +  branchId: integer('branch_id').notNull().references(() => branches.id), +  processedById: integer('processed_by_id').notNull().references(() => users.id), +  reason: text('reason').notNull(), +  totalRefundAmount: decimal('total_refund_amount', { precision: 12, scale: 2 }).notNull(), +  createdAt: timestamp('created_at').defaultNow().notNull(), +}); + +export const returnItems = petshop.table('return_items', { +  id: serial('id').primaryKey(), +  returnId: integer('return_id').notNull().references(() => returns.id), +  transactionItemId: integer('transaction_item_id').notNull().references(() => transactionItems.id), +  productId: integer('product_id').notNull().references(() => products.id), +  uomId: integer('uom_id').notNull().references(() => unitsOfMeasure.id), +  qty: decimal('qty', { precision: 12, scale: 2 }).notNull(), +  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull(), +  cogs: decimal('cogs', { precision: 12, scale: 2 }).notNull(), +  refundAmount: decimal('refund_amount', { precision: 12, scale: 2 }).notNull(), +});


`

Output findings as a Markdown list. Each finding: one-line title, which AC/constraint it violates, and evidence from the diff.
