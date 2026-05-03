# Story 5.4: FIFO Stock Valuation Report

Status: done

## Story

As an Owner,
I want melihat nilai inventaris saya saat ini berdasarkan metode FIFO,
so that saya mengetahui nilai aset sebenarnya dari barang yang ada di toko.

## Acceptance Criteria

1. **Given** Owner berada di modul Laporan
   **When** halaman `/reports/stock-valuation` dimuat
   **Then** layar menampilkan tabel nilai stok berisi daftar produk aktif yang memiliki stok > 0
   **And** halaman harus dimuat dalam waktu < 3 detik (NFR-P2)

2. **Given** laporan stock valuation dimuat
   **When** tabel ditampilkan
   **Then** setiap baris memuat: Nama Produk, SKU, Cabang, Stok Saat Ini (qty), Nilai FIFO (Rp)
   **And** baris terakhir tabel adalah baris "TOTAL" (bold) dengan jumlah nilai FIFO keseluruhan

3. **Given** laporan berhasil dimuat
   **When** Owner menekan tombol "Export CSV"
   **Then** browser mengunduh file CSV dengan nama `laporan-nilai-stok-{YYYY-MM-DD}.csv`
   **And** CSV berisi kolom: Nama Produk, SKU, Cabang, Stok, Nilai FIFO (IDR), dan baris TOTAL

4. **Given** produk aktif tidak memiliki stok tersisa (semua batch `qtyRemaining = 0`)
   **When** laporan dimuat
   **Then** produk tersebut TIDAK ditampilkan dalam laporan

5. **Given** Owner mengakses dashboard tanpa sesi aktif
   **When** mengakses `/reports/stock-valuation`
   **Then** diarahkan ke `/login` (auth existing via layout.tsx tidak berubah)

## Tasks / Subtasks

- [x] Task 1: Service Layer — `getStockValuationReport()`
  - [x] Tambahkan imports `products`, `productStockBatches`, `gt` ke `apps/backoffice/lib/services/report-service.ts`
  - [x] Tambahkan interface `StockValuationItem` dan `StockValuationData`
  - [x] Implementasikan fungsi `getStockValuationReport()` — lihat Dev Notes untuk query lengkap
  - [x] Query JOIN: `productStockBatches` ← `products` (isActive=true) ← `branches`
  - [x] Filter: hanya batch dengan `qtyRemaining > 0`; GROUP BY product + branch
  - [x] Kalkulasi `totalValue = SUM(qtyRemaining * costPrice)` — lihat Dev Notes
  - [x] Kalkulasi finansial WAJIB menggunakan `big.js`
  - [x] Return `StockValuationData` dengan `items[]` + `totalValue` aggregate

- [x] Task 2: Export API — CSV Download
  - [x] Buat `apps/backoffice/app/api/bo/reports/stock-valuation/export/route.ts`
  - [x] Auth check: verifikasi cookies `accessToken` (pelajari dari review finding Story 5.3)
  - [x] Tambahkan `export const dynamic = 'force-dynamic'`
  - [x] Panggil `getStockValuationReport()` dari service layer
  - [x] Gunakan helper `escapeCsvCell` untuk CSV injection safety + RFC 4180 compliance
  - [x] CSV kolom: Nama Produk, SKU, Cabang, Stok (Base UOM), Nilai FIFO (IDR)
  - [x] Baris terakhir CSV: baris TOTAL
  - [x] Line endings: `\r\n` (RFC 4180)
  - [x] Nama file: `laporan-nilai-stok-{YYYY-MM-DD}.csv`
  - [x] Error response dalam Bahasa Indonesia

- [x] Task 3: Report Page UI
  - [x] Buat `apps/backoffice/app/(dashboard)/reports/stock-valuation/page.tsx`
  - [x] Async Server Component — langsung panggil `getStockValuationReport()` (bukan internal HTTP fetch)
  - [x] Auto-load saat halaman dibuka (tidak ada form filter — ini snapshot "saat ini")
  - [x] Tampilkan tabel: kolom [Nama Produk | SKU | Cabang | Stok | Nilai FIFO]
  - [x] Baris terakhir tabel adalah baris "TOTAL" (bold)
  - [x] Tombol "Export CSV" (link ke `/api/bo/reports/stock-valuation/export`)
  - [x] `formatRupiah` — gunakan `new Big(value).toNumber()` (bukan `parseFloat`) + `Intl.NumberFormat` IDR
  - [x] Tampilkan `generatedAt` sebagai timestamp laporan
  - [x] Error state jika query gagal — tampilkan banner merah dengan pesan Indonesia
  - [x] State kosong jika tidak ada produk dengan stok > 0

- [x] Task 4: Navigasi Sidebar
  - [x] Modifikasi `apps/backoffice/app/(dashboard)/layout.tsx`
  - [x] Tambahkan link "Laporan Nilai Stok" di sidebar nav (di bawah link Laporan Laba Rugi)
  - [x] Gunakan ikon 📦 dan className konsisten dengan link sidebar yang sudah ada

### Review Findings

- [x] [Review][Patch] `Big` not imported in `report-service.ts` [apps/backoffice/lib/services/report-service.ts]
- [x] [Review][Patch] `isActive` condition in `innerJoin` [apps/backoffice/lib/services/report-service.ts:133]
- [x] [Review][Patch] UTC date in CSV filename [apps/backoffice/app/api/bo/reports/stock-valuation/export/route.ts:25]

## Dev Notes

### Service Layer — `getStockValuationReport()`

Tambahkan ke file yang sudah ada: `apps/backoffice/lib/services/report-service.ts`

```typescript
// Tambahkan ke imports yang sudah ada di atas file:
// products, productStockBatches, gt sudah tersedia via '@/lib/db'
import {
  db,
  transactions,
  transactionItems,
  branches,
  products,
  productStockBatches,
  eq,
  and,
  gt,
  sql,
} from '@/lib/db'

export interface StockValuationItem {
  productId: number
  productName: string
  sku: string | null
  branchId: number
  branchName: string
  totalQty: string   // big.js string (in base UOM)
  totalValue: string // big.js string (IDR)
}

export interface StockValuationData {
  generatedAt: string   // ISO timestamp
  items: StockValuationItem[]
  totalValue: string    // big.js string — grand total semua produk
}

export async function getStockValuationReport(): Promise<StockValuationData> {
  const rows = await db
    .select({
      productId: products.id,
      productName: products.name,
      sku: products.sku,
      branchId: branches.id,
      branchName: branches.name,
      totalQty: sql<string>`COALESCE(SUM(${productStockBatches.qtyRemaining}), '0')`,
      totalValue: sql<string>`COALESCE(SUM(${productStockBatches.qtyRemaining} * ${productStockBatches.costPrice}), '0')`,
    })
    .from(productStockBatches)
    .innerJoin(
      products,
      and(
        eq(productStockBatches.productId, products.id),
        eq(products.isActive, true)
      )
    )
    .innerJoin(branches, eq(productStockBatches.branchId, branches.id))
    .where(gt(productStockBatches.qtyRemaining, '0'))
    .groupBy(products.id, products.name, products.sku, branches.id, branches.name)
    .orderBy(branches.name, products.name)

  let grandTotal = new Big(0)

  const items: StockValuationItem[] = rows.map((row) => {
    const value = new Big(row.totalValue)
    grandTotal = grandTotal.plus(value)
    return {
      productId: row.productId,
      productName: row.productName,
      sku: row.sku,
      branchId: row.branchId,
      branchName: row.branchName,
      totalQty: new Big(row.totalQty).toString(),
      totalValue: value.toString(),
    }
  })

  return {
    generatedAt: new Date().toISOString(),
    items,
    totalValue: grandTotal.toString(),
  }
}
```

**Kenapa `SUM(qtyRemaining * costPrice)` langsung di SQL:**
`productStockBatches.costPrice` sudah menyimpan cost per base UOM dari saat receiving — ini adalah harga FIFO yang valid dan tidak perlu JOIN ke purchase_orders. Menggunakan nilai yang sudah ada di batch lebih efisien dan akurat.

**Kenapa `gt(productStockBatches.qtyRemaining, '0')` bukan `ne(..., '0')`:**
Kolom `qtyRemaining` adalah decimal. Menggunakan `gt` (greater than) lebih semantically correct dan menghindari false negative jika ada nilai negatif dari adjustment.

**Kenapa GROUP BY mencakup semua non-aggregated columns:**
PostgreSQL mengharuskan semua kolom SELECT yang bukan aggregate ada di GROUP BY. `products.id`, `products.name`, `products.sku`, `branches.id`, `branches.name` semuanya wajib ada.

### Task 2: CSV Export Endpoint

```typescript
// apps/backoffice/app/api/bo/reports/stock-valuation/export/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'
import { getStockValuationReport } from '@/lib/services/report-service'

export const dynamic = 'force-dynamic'

function escapeCsvCell(val: string): string {
  const sanitized =
    val.startsWith('=') || val.startsWith('+') || val.startsWith('-') || val.startsWith('@')
      ? `'${val}`
      : val
  return `"${sanitized.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`
}

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const data = await getStockValuationReport()
    const today = new Date().toISOString().split('T')[0]

    const rows = [
      ['Nama Produk', 'SKU', 'Cabang', 'Stok (Base UOM)', 'Nilai FIFO (IDR)'],
      ...data.items.map((item) => [
        item.productName,
        item.sku ?? '',
        item.branchName,
        item.totalQty,
        item.totalValue,
      ]),
      ['TOTAL', '', '', '', data.totalValue],
    ]

    const csv = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')
    const filename = `laporan-nilai-stok-${today}.csv`

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal mengekspor laporan' },
      { status: 500 }
    )
  }
}
```

### Task 3: Report Page Pattern

```typescript
// apps/backoffice/app/(dashboard)/reports/stock-valuation/page.tsx
import Big from 'big.js'
import { getStockValuationReport, type StockValuationData } from '@/lib/services/report-service'

function formatRupiah(value: string): string {
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(new Big(value).toNumber())
  } catch {
    return 'Rp 0'
  }
}

export default async function StockValuationPage() {
  let reportData: StockValuationData | null = null
  let error: string | null = null

  try {
    reportData = await getStockValuationReport()
  } catch {
    error = 'Gagal mengambil data laporan. Silakan coba lagi.'
  }

  // ... render tabel + Export CSV button
}
```

**Format qty (bukan Rupiah):**
`totalQty` adalah desimal biasa (bukan currency). Format: `new Big(item.totalQty).toFixed(2)` untuk tampilan dengan 2 desimal.

**Export button (tidak ada query params — snapshot saat ini):**
```tsx
<a href="/api/bo/reports/stock-valuation/export">
  Export CSV
</a>
```

**Timestamp laporan:**
```tsx
<p className="text-xs text-muted-foreground">
  Dibuat pada: {new Date(reportData.generatedAt).toLocaleString('id-ID')}
</p>
```

### Task 4: Sidebar Navigation

```tsx
// Di dalam <nav> di apps/backoffice/app/(dashboard)/layout.tsx — setelah link Laporan Laba Rugi:
<a
  href="/reports/stock-valuation"
  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-primary transition-colors"
>
  <span>📦</span>
  Laporan Nilai Stok
</a>
```

### Architecture Compliance

- **big.js WAJIB** untuk semua kalkulasi nilai stok — tidak boleh operator `+`/`-`/`*` langsung
- **Server Component** untuk halaman report (bukan Client Component)
- **Drizzle ORM** untuk semua DB access — jangan raw SQL string
- **Auth check WAJIB** di export API route (pelajari dari review finding Story 5.3)
- **`export const dynamic = 'force-dynamic'`** di export route (data real-time, tidak di-cache)
- **Service function langsung** dari page (bukan internal `fetch()`)
- **Tailwind CSS 4** untuk styling — konsisten dengan komponen di profit-loss/page.tsx
- **Error messages** user-facing dalam Bahasa Indonesia

### Anti-Patterns (DILARANG)

- JANGAN gunakan `Math.round()`, `parseFloat()`, atau operator `+`/`-`/`*` untuk nilai finansial — wajib big.js
- JANGAN JOIN ke `purchase_orders` atau `purchase_order_items` untuk costPrice — sudah ada di `productStockBatches.costPrice`
- JANGAN sertakan batch dengan `qtyRemaining = 0` — hasilkan baris dengan nilai 0 yang tidak informatif
- JANGAN buat Client Component untuk halaman ini — tidak ada interaktivitas yang membutuhkan client state
- JANGAN panggil `fetch('/api/bo/reports/...')` dari Server Component — panggil service function langsung
- JANGAN export API tanpa auth check — pelajari dari review finding Story 5.3
- JANGAN gunakan `parseFloat()` di `formatRupiah` — wajib `new Big(value).toNumber()` (pelajari dari Story 5.3)
- JANGAN tulis nilai CSV dengan `\n` saja — gunakan `\r\n` sesuai RFC 4180
- JANGAN filter produk VOIDED/inactive — hanya tampilkan `products.isActive = true`

### Previous Story Intelligence (Story 5.3)

- **Auth pattern**: layout.tsx melindungi semua route di `(dashboard)/` — tidak perlu auth di page level
- **Export API auth**: WAJIB cek cookies `accessToken` di export route (pre-existing oversight yang diperbaiki di Story 5.3)
- **CSV escaping**: Gunakan `escapeCsvCell()` helper — sanitasi CSV injection + escape double-quotes + strip newlines
- **CSV line endings**: Gunakan `\r\n` bukan `\n` (RFC 4180)
- **`@/lib/db` exports semua**: `db`, `branches`, `products`, `productStockBatches`, `eq`, `and`, `gt`, `sql` tersedia
- **big.js import**: `import Big from 'big.js'` — sudah ada di `backoffice/package.json`
- **formatRupiah WAJIB big.js**: Gunakan `new Big(value).toNumber()` bukan `parseFloat()` sebelum masuk `Intl.NumberFormat`
- **Sidebar saat ini**: 2 link (Dashboard + Laporan Laba Rugi) di `layout.tsx` — tambahkan di bawah Laporan Laba Rugi
- **TypeScript errors pre-existing**: Jangan fix TS error di file yang tidak dimodifikasi

### Project Structure

File yang akan dibuat/dimodifikasi:
```
apps/backoffice/lib/services/report-service.ts                                              ← MODIFIKASI (tambah fungsi + interfaces)
apps/backoffice/app/api/bo/reports/stock-valuation/export/route.ts                          ← BARU
apps/backoffice/app/(dashboard)/reports/stock-valuation/page.tsx                            ← BARU
apps/backoffice/app/(dashboard)/layout.tsx                                                  ← MODIFIKASI (tambah nav link)
```

### References

- [Epic 5, Story 5.4 — FR21](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/_bmad-output/planning-artifacts/epics.md)
- [Schema: productStockBatches + products + branches](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/packages/db/src/schema/inventory.ts)
- [report-service.ts — Pola service yang WAJIB diikuti](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/apps/backoffice/lib/services/report-service.ts)
- [profit-loss/page.tsx — Pola formatRupiah + Server Component](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/apps/backoffice/app/(dashboard)/reports/profit-loss/page.tsx)
- [layout.tsx — Sidebar yang dimodifikasi](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/apps/backoffice/app/(dashboard)/layout.tsx)
- [Story 5.3 — Profit and Loss Report (pola yang diikuti)](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/_bmad-output/implementation-artifacts/5-3-profit-and-loss-report.md)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- Service layer `getStockValuationReport()` ditambahkan ke `report-service.ts` yang sudah ada — tidak membuat file baru untuk service.
- Query menggunakan single JOIN query dengan GROUP BY product+branch dan filter `qtyRemaining > 0`. `costPrice` di `productStockBatches` sudah menyimpan harga FIFO per base UOM — tidak perlu JOIN ke purchase_orders.
- Export API menggunakan `error instanceof Error` pattern (bukan `error: any`) sesuai TypeScript strict mode.
- Semua kalkulasi finansial menggunakan `big.js` (`grandTotal.plus(value)`, `new Big(row.totalQty).toString()`).
- `formatRupiah` menggunakan `new Big(value).toNumber()` bukan `parseFloat()` — mengikuti patch dari Story 5.3.
- CSV menggunakan `\r\n` (RFC 4180) dan `escapeCsvCell` helper untuk CSV injection safety.
- Auth check ada di export API route — mengikuti temuan review Story 5.3.
- Report page adalah pure Server Component tanpa filter form — data adalah snapshot "saat ini".
- TypeScript errors dari file-file lain (purchase_orders routes) adalah pre-existing, tidak terkait story ini.

### File List

- `apps/backoffice/lib/services/report-service.ts` — DIMODIFIKASI: tambah imports `products`, `productStockBatches`, `gt`; tambah interfaces `StockValuationItem`, `StockValuationData`; tambah fungsi `getStockValuationReport()`
- `apps/backoffice/app/api/bo/reports/stock-valuation/export/route.ts` — BARU: CSV export API dengan auth check, `escapeCsvCell`, `force-dynamic`
- `apps/backoffice/app/(dashboard)/reports/stock-valuation/page.tsx` — BARU: Async Server Component dengan tabel FIFO, baris TOTAL, Export CSV button, timestamp, error state, empty state
- `apps/backoffice/app/(dashboard)/layout.tsx` — DIMODIFIKASI: tambah link "Laporan Nilai Stok" dengan ikon 📦 di sidebar nav

### Change Log

- **2026-05-03**: Implementasi Story 5.4 selesai — service layer `getStockValuationReport()` (single JOIN query, `gt` filter, big.js), CSV export API (auth check, `escapeCsvCell`, RFC 4180, `force-dynamic`), Report Page UI (Server Component, tabel per produk-cabang, baris TOTAL, Export CSV, empty state), dan navigasi sidebar.
