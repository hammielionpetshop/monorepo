# Story 8.3: Adjustment Logs

**Story ID:** 8.3
**Story Key:** 8-3-adjustment-logs
**Epic:** 8 - Backoffice Operational Quick Wins (P1 — Backend Ready)
**Status:** done
**Created:** 2026-05-15

---

## User Story

Sebagai Owner,
saya ingin melihat riwayat semua penyesuaian stok (manual adjustment, SO result) di Backoffice,
Agar saya dapat mengaudit perubahan stok kapanpun tanpa harus cek database langsung.

---

## Acceptance Criteria

**AC1 — Daftar Adjustment Logs**
Given Owner membuka halaman `/inventory/adjustment-logs`
When halaman dimuat
Then daftar entri penyesuaian stok ditampilkan dengan kolom: tanggal, produk, perubahan qty (delta), alasan, petugas, cabang

**AC2 — Filter Tanggal**
Given Owner menggunakan filter tanggal (startDate/endDate)
When filter diterapkan
Then daftar hanya menampilkan entri dalam rentang tanggal tersebut

**AC3 — Filter Produk**
Given Owner mengetik nama produk di kolom pencarian produk
When input berubah
Then daftar difilter secara client-side untuk menampilkan entri yang cocok dengan nama produk

**AC4 — Auth**
Given akses tanpa autentikasi
When halaman atau API diakses
Then redirect ke `/login` (halaman) atau return 401 (API)

**AC5 — Scope MANAGER**
Given user ber-role MANAGER
When halaman dimuat
Then hanya adjustment dari cabang user tersebut yang ditampilkan

---

## Scope & Batasan

**In scope:**
- Halaman `/inventory/adjustment-logs` (Server Component + Client Component)
- API baru: `GET /api/bo/inventory/adjustment-logs` dengan filter startDate, endDate
- Filter produk dilakukan secara client-side (data sudah di-load)
- Sumber data: tabel `stock_adjustments` saja (lihat Dev Notes untuk penjelasan lengkap)
- Limit 100 entri terbaru, diurutkan `createdAt DESC`
- Delta qty = `newQty - previousQty` dihitung di API layer menggunakan `big.js`

**Out of scope:**
- SO result adjustments dari `audit_logs` (action: 'STOCK_OPNAME_ADJUSTMENT') — defer ke story terpisah (lihat Dev Notes)
- Pagination/infinite scroll
- Export CSV
- Edit atau delete adjustment log

---

## Skema Database yang Relevan

**Tabel utama:** `stock_adjustments` — `packages/db/src/schema/inventory.ts`

```typescript
export const stockAdjustments = petshop.table('stock_adjustments', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id).notNull(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  adjustedById: integer('adjusted_by_id').references(() => users.id).notNull(),
  previousQty: decimal('previous_qty', { precision: 12, scale: 2 }).notNull(),
  newQty: decimal('new_qty', { precision: 12, scale: 2 }).notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
```

**Tabel join:**
```typescript
// products: { id, name, sku }
// branches: { id, name }
// users: { id, name }
```

**Semua export dari `@/lib/db`** — `stockAdjustments`, `products`, `branches`, `users`, `eq`, `and`, `desc`, `gte`, `lte`, `sql` tersedia via `export * from '@petshop/db'`.

---

## Dev Notes & Guardrails

### Sumber Data: `stockAdjustments` vs `auditLogs` — KEPUTUSAN PENTING

`applyManualStockAdjustment` (di `apps/backoffice/lib/stock-adjustment.ts`) menulis ke DUA tempat:
1. `stockAdjustments` — data terstruktur lengkap: productId, branchId, adjustedById, previousQty, newQty, reason
2. `auditLogs` (action: `'MANUAL_STOCK_ADJUSTMENT'`) — hanya JSON blob, tidak ada productId sebagai FK

`applySOStockAdjustment` (di file yang sama) hanya menulis ke `auditLogs` (action: `'STOCK_OPNAME_ADJUSTMENT'`), **TIDAK** ke `stockAdjustments`.

**Keputusan untuk Story ini:** Gunakan `stockAdjustments` sebagai satu-satunya sumber data karena:
- Memiliki semua kolom terstruktur yang dibutuhkan AC (productId, reason, adjustedById, qty)
- Data di `auditLogs` dengan action `MANUAL_STOCK_ADJUSTMENT` adalah duplikat dari `stockAdjustments`
- SO adjustments dari `auditLogs` tidak memiliki productId sebagai FK — butuh parsing JSON untuk display

**Catatan deferred:** SO result adjustments (`STOCK_OPNAME_ADJUSTMENT` di `auditLogs`) **tidak masuk** story ini karena tidak memiliki product linkage terstruktur. Ini bisa ditambahkan sebagai section terpisah di halaman yang sama di masa depan.

### File Baru yang Harus Dibuat

```
apps/backoffice/app/(dashboard)/inventory/adjustment-logs/
  page.tsx                                    ← Server Component: fetch initial data
  _components/
    adjustment-logs-client.tsx                ← Client Component: filter UI + tabel

apps/backoffice/app/api/bo/inventory/adjustment-logs/
  route.ts                                    ← GET endpoint dengan filter startDate/endDate
```

### API: `GET /api/bo/inventory/adjustment-logs/route.ts`

Query params: `startDate` (YYYY-MM-DD, opsional), `endDate` (YYYY-MM-DD, opsional)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { verifyAccessToken } from '@/lib/auth'
import Big from 'big.js'
import {
  db, stockAdjustments, products, branches, users,
  eq, and, desc, gte, lte, sql,
} from '@/lib/db'

export const dynamic = 'force-dynamic'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const querySchema = z.object({
  startDate: z.string().regex(ISO_DATE_RE, 'Format startDate tidak valid (gunakan YYYY-MM-DD)').optional(),
  endDate: z.string().regex(ISO_DATE_RE, 'Format endDate tidak valid (gunakan YYYY-MM-DD)').optional(),
})

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const parsed = querySchema.safeParse({
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Parameter tidak valid' }, { status: 400 })
    }

    const conditions = []

    // MANAGER: scoped ke branchId sendiri; OWNER: semua cabang
    if (payload.role === 'MANAGER') {
      conditions.push(eq(stockAdjustments.branchId, payload.branchId))
    }

    if (parsed.data.startDate) {
      conditions.push(gte(stockAdjustments.createdAt, new Date(parsed.data.startDate)))
    }
    if (parsed.data.endDate) {
      const end = new Date(parsed.data.endDate)
      end.setUTCHours(23, 59, 59, 999)
      conditions.push(lte(stockAdjustments.createdAt, end))
    }

    const rows = await db
      .select({
        id: stockAdjustments.id,
        previousQty: stockAdjustments.previousQty,
        newQty: stockAdjustments.newQty,
        reason: stockAdjustments.reason,
        createdAt: stockAdjustments.createdAt,
        productName: products.name,
        productSku: products.sku,
        branchName: branches.name,
        adjustedByName: sql<string>`COALESCE(${users.name}, 'User dihapus')`,
      })
      .from(stockAdjustments)
      .innerJoin(products, eq(stockAdjustments.productId, products.id))
      .innerJoin(branches, eq(stockAdjustments.branchId, branches.id))
      .leftJoin(users, eq(stockAdjustments.adjustedById, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(stockAdjustments.createdAt))
      .limit(100)

    // Hitung delta di application layer menggunakan big.js
    const data = rows.map((row) => {
      const prev = new Big(row.previousQty)
      const next = new Big(row.newQty)
      const delta = next.minus(prev)
      return {
        ...row,
        deltaQty: delta.toFixed(2),                     // signed: "-5.00" atau "3.00"
        deltaFormatted: delta.gte(0) ? `+${delta.toFixed(2)}` : delta.toFixed(2), // "+3.00" atau "-5.00"
      }
    })

    return NextResponse.json({ data, total: data.length })
  } catch (error: unknown) {
    console.error('[adjustment-logs] GET error:', error)
    return NextResponse.json({ error: 'Gagal mengambil data adjustment logs' }, { status: 500 })
  }
}
```

> **Catatan:** `Big` diimport dari `big.js` (sudah ada di project — digunakan di `stock-adjustment.ts`). Perlu pastikan `big.js` tersedia di dependencies `backoffice`, atau import dari `@petshop/shared` jika sudah di-re-export.

> **Catatan produk INNER JOIN**: Gunakan `innerJoin` bukan `leftJoin` untuk products dan branches karena data `stockAdjustments` memiliki FK NOT NULL ke keduanya. Untuk users, gunakan `leftJoin` karena user bisa dihapus (seperti pola di `so-client` Story 8.2).

### Server Component: `adjustment-logs/page.tsx`

Fetch initial data dari API route (atau langsung dari DB dengan pola yang sama). Pola konsisten dengan `stock-opname/page.tsx`:

```typescript
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessToken } from '@/lib/auth'
import Big from 'big.js'
import {
  db, stockAdjustments, products, branches, users,
  eq, and, desc, sql,
} from '@/lib/db'
import AdjustmentLogsClient from './_components/adjustment-logs-client'

export const dynamic = 'force-dynamic'

export interface AdjustmentLogEntry {
  id: number
  productName: string
  productSku: string | null
  branchName: string
  adjustedByName: string
  previousQty: string
  newQty: string
  deltaQty: string        // e.g. "3.00" atau "-5.00"
  deltaFormatted: string  // e.g. "+3.00" atau "-5.00"
  reason: string
  createdAt: Date | string
}

export default async function AdjustmentLogsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  if (!payload) redirect('/login')

  const conditions = []
  if (payload.role === 'MANAGER') {
    conditions.push(eq(stockAdjustments.branchId, payload.branchId))
  }

  let logs: AdjustmentLogEntry[] = []
  let error: string | null = null

  try {
    const rows = await db
      .select({
        id: stockAdjustments.id,
        previousQty: stockAdjustments.previousQty,
        newQty: stockAdjustments.newQty,
        reason: stockAdjustments.reason,
        createdAt: stockAdjustments.createdAt,
        productName: products.name,
        productSku: products.sku,
        branchName: branches.name,
        adjustedByName: sql<string>`COALESCE(${users.name}, 'User dihapus')`,
      })
      .from(stockAdjustments)
      .innerJoin(products, eq(stockAdjustments.productId, products.id))
      .innerJoin(branches, eq(stockAdjustments.branchId, branches.id))
      .leftJoin(users, eq(stockAdjustments.adjustedById, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(stockAdjustments.createdAt))
      .limit(100)

    logs = rows.map((row) => {
      const prev = new Big(row.previousQty)
      const next = new Big(row.newQty)
      const delta = next.minus(prev)
      return {
        ...row,
        deltaQty: delta.toFixed(2),
        deltaFormatted: delta.gte(0) ? `+${delta.toFixed(2)}` : delta.toFixed(2),
      }
    })
  } catch (e) {
    console.error('AdjustmentLogsPage error:', e)
    error = 'Terjadi kesalahan saat mengambil data adjustment logs'
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-foreground mb-1">Riwayat Penyesuaian Stok</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Riwayat semua penyesuaian stok manual. Menampilkan maksimal 100 entri terbaru.
      </p>
      <AdjustmentLogsClient initialData={logs} />
    </div>
  )
}
```

### Client Component: `adjustment-logs-client.tsx`

Filter tanggal dilakukan via re-fetch dari API. Filter produk dilakukan secara client-side:

```typescript
'use client'

import { useState } from 'react'
import type { AdjustmentLogEntry } from '../page'

interface Props {
  initialData: AdjustmentLogEntry[]
}

function formatDateTime(value: Date | string): string {
  if (!value) return '-'
  const d = typeof value === 'string' ? new Date(value) : value
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleString('id-ID', {
    day: 'numeric', month: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function AdjustmentLogsClient({ initialData }: Props) {
  const [data, setData] = useState<AdjustmentLogEntry[]>(initialData)
  const [productFilter, setProductFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Filter produk secara client-side
  const filtered = productFilter.trim()
    ? data.filter(row =>
        row.productName.toLowerCase().includes(productFilter.toLowerCase()) ||
        (row.productSku ?? '').toLowerCase().includes(productFilter.toLowerCase())
      )
    : data

  async function applyDateFilter() {
    setLoading(true)
    setErrorMsg(null)
    try {
      const params = new URLSearchParams()
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const res = await fetch(`/api/bo/inventory/adjustment-logs?${params.toString()}`)
      const json = await res.json()

      if (!res.ok) {
        setErrorMsg(json.error ?? `Gagal mengambil data (${res.status})`)
        return
      }
      setData(json.data ?? [])
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setLoading(false)
    }
  }

  function resetFilter() {
    setStartDate('')
    setEndDate('')
    setProductFilter('')
    setData(initialData)
    setErrorMsg(null)
  }

  return (
    <div className="space-y-4">
      {/* Filter Panel */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Dari Tanggal</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="border border-input rounded-md px-3 py-1.5 text-sm bg-background"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Sampai Tanggal</label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="border border-input rounded-md px-3 py-1.5 text-sm bg-background"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Cari Produk</label>
          <input
            type="text"
            value={productFilter}
            onChange={e => setProductFilter(e.target.value)}
            placeholder="Nama atau SKU produk..."
            className="border border-input rounded-md px-3 py-1.5 text-sm bg-background w-52"
          />
        </div>
        <button
          onClick={applyDateFilter}
          disabled={loading}
          className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? 'Memuat...' : 'Terapkan Filter'}
        </button>
        <button
          onClick={resetFilter}
          className="px-3 py-1.5 text-sm font-medium border border-border rounded-md hover:bg-accent"
        >
          Reset
        </button>
      </div>

      {errorMsg && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          {errorMsg}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Menampilkan {filtered.length} entri{data.length === 100 ? ' (maks 100 terbaru)' : ''}
      </p>

      {filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          Tidak ada data penyesuaian stok.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Tanggal</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Produk</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Cabang</th>
                <th className="text-right py-2 px-3 font-medium text-muted-foreground">Sebelum</th>
                <th className="text-right py-2 px-3 font-medium text-muted-foreground">Sesudah</th>
                <th className="text-right py-2 px-3 font-medium text-muted-foreground">Selisih</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Alasan</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Petugas</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => (
                <tr key={row.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
                    {formatDateTime(row.createdAt)}
                  </td>
                  <td className="py-2 px-3">
                    <div className="font-medium">{row.productName}</div>
                    {row.productSku && (
                      <div className="text-xs text-muted-foreground">{row.productSku}</div>
                    )}
                  </td>
                  <td className="py-2 px-3 text-muted-foreground">{row.branchName}</td>
                  <td className="py-2 px-3 text-right font-mono">{row.previousQty}</td>
                  <td className="py-2 px-3 text-right font-mono">{row.newQty}</td>
                  <td className={`py-2 px-3 text-right font-mono font-semibold ${
                    row.deltaQty.startsWith('-')
                      ? 'text-destructive'
                      : 'text-green-600'
                  }`}>
                    {row.deltaFormatted}
                  </td>
                  <td className="py-2 px-3 max-w-xs">
                    <span className="line-clamp-2 text-sm">{row.reason}</span>
                  </td>
                  <td className="py-2 px-3 text-muted-foreground">{row.adjustedByName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

### Catatan Kritis

1. **`big.js` di Server Component**: `Big` sudah ada di project (digunakan di `stock-adjustment.ts`). Import langsung `import Big from 'big.js'`. Jika ada error resolusi module di backoffice, cek `package.json` backoffice — jika `big.js` tidak ada di dependencies, tambahkan atau gunakan cara alternatif (JavaScript native string parsing untuk display saja).

2. **`force-dynamic`** wajib di `page.tsx` (ada cookie read).

3. **Branch scope AC5**: MANAGER hanya lihat branchnya sendiri — implementasi via kondisi `eq(stockAdjustments.branchId, payload.branchId)` ketika `payload.role === 'MANAGER'`. OWNER tanpa filter. Role lain (KASIR) — pertimbangkan apakah boleh akses; jika tidak ada kebutuhan eksplisit, izinkan semua authenticated user (konsisten dengan pola audit-log yang ada).

4. **`conditions` array typing**: Gunakan pola yang sama dengan `history/route.ts` (menggunakan `SQL<unknown>[]` atau biarkan TypeScript infer dari kondisi Drizzle). Jangan gunakan explicit cast yang tidak perlu.

5. **Tidak ada migration baru** — skema `stockAdjustments` sudah ada di database.

6. **Existing `audit-log/route.ts` tidak punya auth**: Ini adalah pre-existing issue (dicatat di Story 8.2 DFR1). Jangan fix di story ini — hanya buat route baru `/inventory/adjustment-logs` dengan auth yang benar.

7. **`deltaQty` negatif**: String `-5.00` dari Big.toFixed() sudah dimulai dengan `-`. Cek dengan `row.deltaQty.startsWith('-')` aman untuk tujuan tampilan. Jangan parse ulang sebagai number.

8. **`line-clamp-2`**: Pastikan Tailwind CSS v4 mendukung utility ini. Jika tidak ada, gunakan `overflow-hidden text-ellipsis` atau potong text secara manual.

### Learnings dari Story 8.1 & 8.2

- Pola Server Component + Client Component (fetch di server, interaksi di client) — gunakan konsisten
- `COALESCE(${users.name}, 'User dihapus')` untuk handle user yang dihapus via `leftJoin`
- `Number.isNaN(Number(payload.userId))` guard — tidak diperlukan di story ini karena tidak ada mutasi
- `export const dynamic = 'force-dynamic'` wajib di semua page yang baca cookies
- Error messages dalam **Bahasa Indonesia**
- `parsed.error.issues[0]?.message` (bukan `.errors[0]`) untuk Zod v4

---

## Tasks / Subtasks

- [x] **Task 1: Buat API route `GET /api/bo/inventory/adjustment-logs/route.ts`**
  - [x] 1.1 Auth check: `verifyAccessToken` → 401 jika tidak ada token
  - [x] 1.2 Zod validation untuk query params `startDate` dan `endDate`
  - [x] 1.3 Branch scope: tambahkan kondisi `branchId` jika role === 'MANAGER'
  - [x] 1.4 Query `stockAdjustments` dengan joins ke `products`, `branches`, `users (leftJoin)`
  - [x] 1.5 Hitung `deltaQty` dan `deltaFormatted` per row menggunakan `big.js`
  - [x] 1.6 Return `{ data, total }` — limit 100, order by `createdAt DESC`

- [x] **Task 2: Buat Server Component `adjustment-logs/page.tsx`**
  - [x] 2.1 Auth check + `redirect('/login')` jika tidak ada token
  - [x] 2.2 `export const dynamic = 'force-dynamic'`
  - [x] 2.3 Branch scope: filter berdasarkan role (MANAGER vs OWNER)
  - [x] 2.4 Fetch data dari DB langsung (bukan via fetch API) — ikuti pola `stock-opname/page.tsx`
  - [x] 2.5 Hitung delta per row menggunakan `big.js`
  - [x] 2.6 Export `AdjustmentLogEntry` interface untuk digunakan di client component
  - [x] 2.7 Render `AdjustmentLogsClient` dengan `initialData`

- [x] **Task 3: Buat Client Component `adjustment-logs-client.tsx`**
  - [x] 3.1 Filter tanggal (startDate/endDate) — input type="date", tombol "Terapkan Filter"
  - [x] 3.2 Date filter men-fetch ulang data dari `/api/bo/inventory/adjustment-logs` via `fetch`
  - [x] 3.3 Filter produk client-side — input text, filter `filtered` array berdasarkan `productName` atau `productSku`
  - [x] 3.4 Tombol "Reset" — kembalikan ke `initialData`, hapus semua filter
  - [x] 3.5 Tabel dengan kolom: Tanggal, Produk (nama + SKU), Cabang, Sebelum, Sesudah, Selisih, Alasan, Petugas
  - [x] 3.6 Delta qty warna: hijau untuk positif, merah untuk negatif
  - [x] 3.7 Loading state saat fetch date filter
  - [x] 3.8 Error banner jika fetch gagal
  - [x] 3.9 Empty state: "Tidak ada data penyesuaian stok"

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `tsc --noEmit` bersih (0 error) setelah implementasi.

### Completion Notes List

✅ AC1: Halaman `/inventory/adjustment-logs` menampilkan daftar adjustment dengan kolom tanggal, produk, cabang, qty sebelum/sesudah/selisih, alasan, petugas.
✅ AC2: Filter tanggal (startDate/endDate) di-fetch ulang dari API `/api/bo/inventory/adjustment-logs`.
✅ AC3: Filter produk dilakukan secara client-side berdasarkan nama atau SKU produk.
✅ AC4: Auth check di page.tsx → `redirect('/login')` dan di API route → 401.
✅ AC5: MANAGER hanya lihat data cabangnya sendiri (`payload.branchId`). OWNER lihat semua.
✅ Delta qty dihitung dengan `big.js` untuk akurasi presisi. Ditampilkan dengan warna hijau (positif) / merah (negatif).
✅ `COALESCE(users.name, 'User dihapus')` untuk handle user yang sudah dihapus.
✅ `force-dynamic` pada page.tsx dan API route.

### File List

**Baru:**
- `apps/backoffice/app/(dashboard)/inventory/adjustment-logs/page.tsx`
- `apps/backoffice/app/(dashboard)/inventory/adjustment-logs/_components/adjustment-logs-client.tsx`
- `apps/backoffice/app/api/bo/inventory/adjustment-logs/route.ts`

**Tidak ada file yang dimodifikasi** untuk story ini.

---

### Review Findings

**Decision Needed:**
- [x] [Review][Decision] Scope RBAC untuk role non-MANAGER/non-OWNER — resolved: OWNER-only. OWNER lihat semua cabang; MANAGER dan role lain dibatasi ke cabang sendiri. [page.tsx:27-29, route.ts:79-81]

**Patch:**
- [x] [Review][Patch] Timezone inkonsisten startDate vs endDate di API route [route.ts:89-90] — fixed: kedua tanggal menggunakan ISO string UTC.
- [x] [Review][Patch] Type assertion `json.data as AdjustmentLogEntry[]` tanpa validasi Zod [adjustment-logs-client.tsx:55] — fixed: Zod schema `apiResponseSchema` + `safeParse`.
- [x] [Review][Patch] `new Big(value)` tanpa guard untuk data DB [page.tsx:49-55, route.ts:103-111] — fixed: `safeBig()` helper dengan try-catch fallback ke `Big(0)`.
- [x] [Review][Patch] Tidak ada AbortController pada fetch — race condition [adjustment-logs-client.tsx:42-56] — fixed: `useRef<AbortController>` + cancel on re-fetch/reset/unmount.
- [x] [Review][Patch] `res.json()` throw jika API return non-JSON [adjustment-logs-client.tsx:46] — fixed: `res.text()` fallback + JSON.parse manual.
- [x] [Review][Patch] `startDate > endDate` tidak divalidasi (client & server) [route.ts:27-35] — fixed: Zod `.refine()` cross-field validation.
- [x] [Review][Patch] Tanggal tanpa validasi semantik — "0000-01-01" lolos regex [route.ts:27-35] — fixed: Zod `.refine()` dengan `isNaN(new Date(v).getTime())`.
- [x] [Review][Patch] `reason` kosong tidak ada placeholder [adjustment-logs-client.tsx:166] — fixed: `{row.reason || '-'}`.
- [x] [Review][Patch] `+0.00` untuk delta nol — warna hijau salah [page.tsx:51-55, adjustment-logs-client.tsx:147-149] — fixed: `delta.eq(0)` check + `text-muted-foreground` untuk 0.
- [x] [Review][Patch] Filter produk pada snapshot stale (tidak auto-refresh) [adjustment-logs-client.tsx:33-38] — by design per spec: client-side filter data di-memory, tidak auto-refresh.
- [x] [Review][Patch] `initialData` bisa termutasi — useState pakai referensi sama [adjustment-logs-client.tsx:31] — fixed: `useState(() => [...initialData])`.

**Deferred:**
- [x] [Review][Defer] JWT role mungkin stale (tidak sync DB) — deferred, pre-existing architectural concern [Edge #3]
- [x] [Review][Defer] Timezone di `formatDateTime` browser vs server — deferred, browser-level concern [adjustment-logs-client.tsx:13-21]

---

## Change Log

| Date | Change |
|------|--------|
| 2026-05-15 | Story created |
| 2026-05-15 | Implementasi lengkap: API route dengan auth/Zod/branch-scope, Server Component page.tsx, Client Component dengan filter tanggal + produk + tabel |
| 2026-05-15 | Code review: fix RBAC OWNER-only, timezone UTC, Zod response validation, safeBig guard, AbortController, date validation, empty reason placeholder, delta nol color, initialData spread |
