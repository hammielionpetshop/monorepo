# Story 5.3: Profit and Loss Report

Status: done

## Story

As an Owner,
I want menghasilkan laporan Laba Rugi (P&L) untuk periode tertentu,
so that saya bisa menganalisis tingkat profitabilitas nyata dari operasional toko saya.

## Acceptance Criteria

1. **Given** Owner berada di modul Laporan
   **When** halaman `/reports/profit-loss` dimuat
   **Then** layar menampilkan form input rentang tanggal (tanggal mulai & tanggal selesai) dan tombol "Hasilkan Laba Rugi"

2. **Given** Owner telah mengisi rentang tanggal yang valid dan menekan "Hasilkan Laba Rugi"
   **When** halaman dimuat ulang dengan search params
   **Then** sistem menampilkan tabel laporan dengan kolom: Cabang, Pendapatan, HPP, Laba Kotor, Jumlah Transaksi

3. **Given** laporan berhasil di-generate
   **When** Owner menekan tombol "Export CSV"
   **Then** browser mengunduh file CSV dengan nama `laporan-laba-rugi-{startDate}-{endDate}.csv`

4. **Given** tidak ada transaksi pada periode yang dipilih
   **When** laporan di-generate
   **Then** tabel tetap muncul dengan semua cabang aktif menampilkan nilai Rp 0

5. **Given** Owner mengakses dashboard tanpa sesi aktif
   **When** mengakses `/reports/profit-loss`
   **Then** diarahkan ke `/login` (auth existing via layout.tsx tidak berubah)

## Tasks / Subtasks

- [x] Task 1: Service Layer — `getProfitLossReport()`
  - [x] Buat `apps/backoffice/lib/services/report-service.ts`
  - [x] Implementasikan fungsi `getProfitLossReport(params)` — lihat Dev Notes untuk query lengkap
  - [x] Gunakan 3 query paralel (`Promise.all`): revenues per branch, COGS per branch, all active branches
  - [x] Merge hasil di JS layer dengan `Map<branchId, data>`
  - [x] Kalkulasi finansial WAJIB menggunakan `big.js` — lihat Dev Notes
  - [x] Return `PLReportData` dengan `items[]` per cabang + total aggregate

- [x] Task 2: Export API — CSV Download
  - [x] Buat `apps/backoffice/app/api/bo/reports/profit-loss/export/route.ts`
  - [x] Validasi query params dengan Zod: `startDate`, `endDate` (format YYYY-MM-DD), `format=csv`
  - [x] Panggil `getProfitLossReport()` dari service layer
  - [x] Generate CSV string dan return sebagai `Response` dengan `Content-Type: text/csv` — lihat Dev Notes
  - [x] Tambahkan `export const dynamic = 'force-dynamic'` (tidak boleh di-cache)
  - [x] Error response dalam Bahasa Indonesia

- [x] Task 3: Report Page UI
  - [x] Buat `apps/backoffice/app/(dashboard)/reports/profit-loss/page.tsx`
  - [x] Async Server Component yang membaca `searchParams` (Next.js 15: `await searchParams`) — lihat Dev Notes
  - [x] Form native HTML dengan `method="GET"` untuk date range input
  - [x] Jika `startDate` + `endDate` tersedia di searchParams: panggil `getProfitLossReport()` langsung (bukan internal HTTP fetch)
  - [x] Tampilkan tabel hasil: kolom [Cabang | Pendapatan | HPP | Laba Kotor | Jml Transaksi]
  - [x] Baris terakhir tabel adalah baris "TOTAL" (bold)
  - [x] Tombol "Export CSV" hanya tampil jika data sudah ada (link ke `/api/bo/reports/profit-loss/export?...`)
  - [x] Format angka menggunakan `Intl.NumberFormat` IDR — konsisten dengan `formatRupiah()` di dashboard/page.tsx
  - [x] Error state jika query gagal — tampilkan banner merah dengan pesan Indonesia

- [x] Task 4: Navigasi Sidebar
  - [x] Modifikasi `apps/backoffice/app/(dashboard)/layout.tsx`
  - [x] Tambahkan link "Laporan Laba Rugi" di sidebar nav (di bawah link Dashboard) — lihat Dev Notes untuk snippet

## Dev Notes

### Service Layer — `getProfitLossReport()`

```typescript
// apps/backoffice/lib/services/report-service.ts
import Big from 'big.js'
import {
  db,
  transactions,
  transactionItems,
  branches,
  eq,
  and,
  sql,
} from '@/lib/db'

export interface PLReportItem {
  branchId: number
  branchName: string
  revenue: string        // big.js string
  cogs: string           // big.js string
  grossProfit: string    // big.js string
  transactionCount: number
}

export interface PLReportData {
  startDate: string
  endDate: string
  items: PLReportItem[]
  totalRevenue: string
  totalCogs: string
  totalGrossProfit: string
  totalTransactionCount: number
}

export async function getProfitLossReport(params: {
  startDate: string  // format: YYYY-MM-DD
  endDate: string    // format: YYYY-MM-DD
}): Promise<PLReportData> {
  const dateFilter = and(
    eq(transactions.status, 'COMPLETED'),
    sql`(${transactions.createdAt} AT TIME ZONE 'Asia/Jakarta')::date >= ${params.startDate}::date`,
    sql`(${transactions.createdAt} AT TIME ZONE 'Asia/Jakarta')::date <= ${params.endDate}::date`
  )

  const [revenueRows, cogsRows, branchRows] = await Promise.all([
    // Query 1: Revenue dan jumlah transaksi per cabang
    db
      .select({
        branchId: transactions.branchId,
        revenue: sql<string | null>`COALESCE(SUM(${transactions.payableAmount}), '0')`,
        transactionCount: sql<number>`COUNT(${transactions.id})::integer`,
      })
      .from(transactions)
      .where(dateFilter)
      .groupBy(transactions.branchId),

    // Query 2: COGS per cabang (INNER JOIN — hanya item dari transaksi COMPLETED)
    db
      .select({
        branchId: transactions.branchId,
        cogs: sql<string | null>`COALESCE(SUM(COALESCE(${transactionItems.cogs}, 0)), '0')`,
      })
      .from(transactionItems)
      .innerJoin(
        transactions,
        and(
          eq(transactionItems.transactionId, transactions.id),
          dateFilter
        )
      )
      .groupBy(transactions.branchId),

    // Query 3: Semua cabang aktif (untuk menampilkan baris Rp 0 jika tidak ada transaksi)
    db
      .select({ id: branches.id, name: branches.name })
      .from(branches)
      .where(eq(branches.isActive, true))
      .orderBy(branches.name),
  ])

  const revenueMap = new Map(revenueRows.map((r) => [r.branchId, r]))
  const cogsMap = new Map(cogsRows.map((r) => [r.branchId, r]))

  let totalRevenue = new Big(0)
  let totalCogs = new Big(0)
  let totalTransactionCount = 0

  const items: PLReportItem[] = branchRows.map((branch) => {
    const rev = revenueMap.get(branch.id)
    const cog = cogsMap.get(branch.id)
    const revenue = new Big(rev?.revenue ?? '0')
    const cogs = new Big(cog?.cogs ?? '0')
    const grossProfit = revenue.minus(cogs)
    const transactionCount = rev?.transactionCount ?? 0

    totalRevenue = totalRevenue.plus(revenue)
    totalCogs = totalCogs.plus(cogs)
    totalTransactionCount += transactionCount

    return {
      branchId: branch.id,
      branchName: branch.name,
      revenue: revenue.toString(),
      cogs: cogs.toString(),
      grossProfit: grossProfit.toString(),
      transactionCount,
    }
  })

  return {
    startDate: params.startDate,
    endDate: params.endDate,
    items,
    totalRevenue: totalRevenue.toString(),
    totalCogs: totalCogs.toString(),
    totalGrossProfit: totalRevenue.minus(totalCogs).toString(),
    totalTransactionCount,
  }
}
```

**KRITIS — Jangan JOIN transactions + transactionItems dalam satu query GROUP BY:**
Jika digabung, `SUM(payableAmount)` akan terhitung duplikat (sekali per baris item). Selalu gunakan dua query terpisah lalu merge di JS. Pola ini sama dengan `getDailySummary()` di `dashboard-service.ts`.

### Task 2: CSV Export Endpoint

```typescript
// apps/backoffice/app/api/bo/reports/profit-loss/export/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getProfitLossReport } from '@/lib/services/report-service'

const querySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  format: z.literal('csv').optional(),
})

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams))

    if (!parsed.success) {
      return NextResponse.json({ error: 'Parameter tidak valid' }, { status: 400 })
    }

    const { startDate, endDate } = parsed.data
    const data = await getProfitLossReport({ startDate, endDate })

    // Build CSV
    const rows = [
      ['Cabang', 'Pendapatan', 'HPP', 'Laba Kotor', 'Jumlah Transaksi'],
      ...data.items.map((item) => [
        item.branchName,
        item.revenue,
        item.cogs,
        item.grossProfit,
        item.transactionCount.toString(),
      ]),
      ['TOTAL', data.totalRevenue, data.totalCogs, data.totalGrossProfit, data.totalTransactionCount.toString()],
    ]

    const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')
    const filename = `laporan-laba-rugi-${startDate}-${endDate}.csv`

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

### Task 3: Report Page — Next.js 15 searchParams Pattern

**PENTING — Next.js 15 searchParams adalah async:**
```typescript
// apps/backoffice/app/(dashboard)/reports/profit-loss/page.tsx
import { getProfitLossReport, type PLReportData } from '@/lib/services/report-service'

export default async function ProfitLossPage({
  searchParams,
}: {
  searchParams: Promise<{ startDate?: string; endDate?: string }>
}) {
  const params = await searchParams  // ← WAJIB await di Next.js 15
  const { startDate, endDate } = params
  
  let reportData: PLReportData | null = null
  let error: string | null = null

  if (startDate && endDate) {
    try {
      reportData = await getProfitLossReport({ startDate, endDate })
    } catch (err) {
      error = 'Gagal mengambil data laporan. Silakan coba lagi.'
    }
  }

  // ... render form + tabel
}
```

**Jangan menggunakan `export const revalidate`** di halaman ini — data bersifat on-demand (user pilih date range), bukan time-based revalidation.

**Format currency (konsisten dengan dashboard/page.tsx):**
```typescript
function formatRupiah(value: string): string {
  const num = parseFloat(value)
  if (isNaN(num)) return 'Rp 0'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}
```

**Export button URL pattern:**
```tsx
<a
  href={`/api/bo/reports/profit-loss/export?startDate=${startDate}&endDate=${endDate}&format=csv`}
  className="..."
>
  Export CSV
</a>
```

### Task 4: Sidebar Navigation Update

```tsx
// apps/backoffice/app/(dashboard)/layout.tsx — di dalam <nav> setelah link Dashboard:
<a
  href="/reports/profit-loss"
  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors"
>
  <span>📈</span>
  Laporan Laba Rugi
</a>
```

### Architecture Compliance

- **big.js WAJIB** untuk semua kalkulasi Revenue, COGS, Gross Profit — tidak boleh `+`, `-`, `*` operator langsung
- **Server Component** untuk halaman report (bukan Client Component)
- **Drizzle ORM** untuk semua DB access — jangan raw SQL string
- **Zod validation** di export API route (input boundary dari user/browser)
- **Error messages** user-facing dalam Bahasa Indonesia
- **Tailwind CSS 4** untuk styling — konsisten dengan komponen di `dashboard/page.tsx`
- **`export const dynamic = 'force-dynamic'`** di export route (data real-time, tidak di-cache)
- **Service function langsung** dari page (bukan internal `fetch()`) — pola sama persis dengan `getDailySummary()` di `dashboard/page.tsx`
- **Date filter pattern**: `(column AT TIME ZONE 'Asia/Jakarta')::date` — konsisten dengan `getDailySummary()` dan `SHIFT_TODAY_FILTER`

### Anti-Patterns (DILARANG)

- JANGAN JOIN `transactions` + `transactionItems` dalam satu query GROUP BY untuk aggregate finansial — menyebabkan double-count `payableAmount`
- JANGAN gunakan `Math.round()`, `parseFloat()`, atau operator `+`/`-`/`*` untuk nilai finansial — wajib big.js
- JANGAN buat Client Component hanya untuk form date range — gunakan native HTML `<form method="GET">`
- JANGAN panggil `fetch('/api/bo/reports/...')` dari Server Component — panggil service function langsung
- JANGAN tambahkan `export const revalidate` di report page — ini on-demand, bukan time-based
- JANGAN filter transaksi VOIDED ke dalam kalkulasi — hanya `status = 'COMPLETED'`
- JANGAN implementasi PDF export di story ini — butuh library tambahan, luar scope AC

### Previous Story Intelligence (Story 5.2)

- **Auth pattern**: layout.tsx melindungi semua route di `(dashboard)/` termasuk `/reports/*` — tidak perlu auth tambahan di route level
- **Cookie name**: `accessToken` (bukan `access_token`)
- **Service pattern**: `lib/services/dashboard-service.ts` — tambahkan `report-service.ts` di folder yang sama
- **`@/lib/db` exports semua**: `db`, `branches`, `transactions`, `transactionItems`, `eq`, `and`, `sql`, `desc` sudah tersedia
- **Drizzle import**: `import { ... } from '@/lib/db'` — lib/db.ts melakukan `export * from '@petshop/db'`
- **big.js import**: `import Big from 'big.js'` — sudah ada di `backoffice/package.json` (ditambahkan Story 5.1)
- **TypeScript errors pre-existing**: Jangan fix TS error di file yang tidak dimodifikasi
- **Sidebar saat ini**: hanya ada 1 link (Dashboard) di `layout.tsx` — tambahkan link Laporan di bawahnya

### Catatan Scope

- **PDF export bukan bagian story ini**: Perlu library tambahan (`@react-pdf/renderer` atau `puppeteer`). Story ini mengimplementasikan CSV export yang memenuhi AC "CSV atau PDF".
- **Per-branch filter dropdown bukan bagian story ini**: Laporan menampilkan semua cabang aktif secara agregat. Filter per cabang bisa menjadi enhancement berikutnya.
- **Definisi P&L story ini**: Gross Profit = Revenue - COGS. Tidak termasuk `shiftExpenses` (pengeluaran operasional). AC spesifik menyebut "Revenue dikurangi HPP".

### Project Structure

File yang akan dibuat/dimodifikasi:
```
apps/backoffice/lib/services/report-service.ts                                      ← BARU

apps/backoffice/app/api/bo/reports/profit-loss/export/route.ts                      ← BARU

apps/backoffice/app/(dashboard)/reports/profit-loss/page.tsx                        ← BARU

apps/backoffice/app/(dashboard)/layout.tsx                                          ← MODIFIKASI (tambah nav link)
```

### References

- [Epic 5, Story 5.3 — FR20](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/_bmad-output/planning-artifacts/epics.md)
- [Architecture: Data Architecture, Financial Precision](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/_bmad-output/planning-artifacts/architecture.md)
- [dashboard-service.ts — Pola service query yang WAJIB diikuti](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/apps/backoffice/lib/services/dashboard-service.ts)
- [dashboard/page.tsx — Pola formatRupiah + Server Component](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/apps/backoffice/app/(dashboard)/dashboard/page.tsx)
- [layout.tsx — Sidebar yang dimodifikasi](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/apps/backoffice/app/(dashboard)/layout.tsx)
- [Schema: transactions + transactionItems](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/packages/db/src/schema/transactions.ts)
- [Story 5.2 — Offline Branch Notification (pola yang diikuti)](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/_bmad-output/implementation-artifacts/5-2-offline-branch-notification.md)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- Story mencakup semua komponen: service layer (report-service.ts), export API (CSV), UI page (Server Component + searchParams), dan navigasi.
- Dua query terpisah (revenue + cogs) dan merge di JS untuk menghindari double-count pada JOIN aggregation — pola ini sudah terbukti dari getDailySummary().
- PDF export sengaja tidak diimplementasikan (butuh library baru); CSV sudah memenuhi AC "CSV atau PDF".
- Next.js 15 mengharuskan `await searchParams` di Server Component page — dev wajib ikuti pattern ini.
- big.js WAJIB untuk semua kalkulasi finansial sesuai NFR-S3 dan architecture enforcement.

### File List

- `apps/backoffice/lib/services/report-service.ts` — BARU: service layer dengan fungsi `getProfitLossReport()`, 3 query paralel, kalkulasi big.js
- `apps/backoffice/app/api/bo/reports/profit-loss/export/route.ts` — BARU: CSV export API route dengan Zod validation
- `apps/backoffice/app/(dashboard)/reports/profit-loss/page.tsx` — BARU: Report page (Async Server Component, form GET, tabel + TOTAL row, Export CSV link)
- `apps/backoffice/app/(dashboard)/layout.tsx` — DIMODIFIKASI: tambah link "Laporan Laba Rugi" di sidebar nav

### Change Log

- **2026-05-03**: Implementasi Story 5.3 selesai — service layer `getProfitLossReport()` dengan 3 query paralel + big.js, CSV export API (Zod validation, force-dynamic), Report Page UI (Server Component + await searchParams + tabel + Export CSV), dan navigasi sidebar.
- **2026-05-03**: Patching hasil review selesai — Menambahkan validasi date range di service layer, memperkuat auth check di export API, memperbaiki anti-pattern parseFloat, dan menangani CSV injection/escaping.

### Review Findings

- [x] [Review][Decision] Migration regression: `timestamp` vs `TIMESTAMPTZ` + `IF NOT EXISTS` dihapus — Drizzle menggenerate `timestamp` (tanpa timezone) berbeda dengan migrasi manual lama (`TIMESTAMPTZ`). Jika kolom `last_seen_at` sudah diterapkan di environment mana pun via migrasi lama (`20260502_add_branch_last_seen_at.sql`), menjalankan `0002_low_starhawk.sql` akan gagal karena kolom duplikat (tidak ada `IF NOT EXISTS`). Konfirmasi diperlukan: (a) apakah migrasi lama pernah dijalankan di environment mana pun, dan (b) apakah tipe kolom harus `timestamptz` di skema. [`packages/db/src/migrations/0002_low_starhawk.sql:1`]

- [x] [Review][Patch] Export API route tidak memiliki auth check — siapapun yang mengetahui URL dapat mengunduh seluruh data finansial tanpa sesi yang valid [`apps/backoffice/app/api/bo/reports/profit-loss/export/route.ts`]
- [x] [Review][Patch] `page.tsx` tidak memvalidasi format `startDate`/`endDate` dari `searchParams` sebelum memanggil service — tidak ada Zod, berbeda dengan export route yang sudah menggunakannya [`apps/backoffice/app/(dashboard)/reports/profit-loss/page.tsx:25-31`]
- [x] [Review][Patch] Tidak ada validasi `startDate <= endDate` — range terbalik menghasilkan laporan kosong tanpa pesan error bagi pengguna [`apps/backoffice/lib/services/report-service.ts:35-39`]
- [x] [Review][Patch] CSV export menulis nilai desimal mentah (misal `"1500000"`) bukan format Rupiah — tidak konsisten dengan tampilan tabel yang sudah terformat [`apps/backoffice/app/api/bo/reports/profit-loss/export/route.ts:28-36`]
- [x] [Review][Patch] CSV injection: nama cabang dengan karakter formula (`=`, `+`, `-`, `@`) tidak di-sanitasi, dapat dieksekusi sebagai formula di Excel/LibreOffice [`apps/backoffice/app/api/bo/reports/profit-loss/export/route.ts:43`]
- [x] [Review][Patch] CSV: double-quote dalam nilai sel tidak di-escape sesuai RFC 4180 (harus `""`) — nama cabang seperti `Petshop "Maju"` akan merusak struktur CSV [`apps/backoffice/app/api/bo/reports/profit-loss/export/route.ts:43`]
- [x] [Review][Patch] `formatRupiah` menggunakan `parseFloat()` — melanggar aturan anti-pattern finansial project (wajib big.js, dilarang native float untuk nilai finansial) [`apps/backoffice/app/(dashboard)/reports/profit-loss/page.tsx:4`]

- [x] [Review][Defer] Tidak ada batas maksimum rentang tanggal — query tak terbatas dapat menyebabkan full table scan pada data besar [`apps/backoffice/lib/services/report-service.ts`] — deferred, performance concern out of scope story ini
- [x] [Review][Defer] `Content-Disposition` filename tidak menggunakan RFC 5987 encoding — saat ini aman (hanya ASCII), namun pattern fragile untuk karakter non-ASCII di masa depan [`apps/backoffice/app/api/bo/reports/profit-loss/export/route.ts:49`] — deferred, low risk saat ini
- [x] [Review][Defer] `new Big()` dapat throw jika driver DB mengembalikan string non-numerik tak terduga meski ada `COALESCE` [`apps/backoffice/lib/services/report-service.ts:88-89`] — deferred, hipotesis edge case driver
- [x] [Review][Defer] Missing `aria-label` pada link Export CSV — aksesibilitas WCAG AA [`apps/backoffice/app/(dashboard)/reports/profit-loss/page.tsx:94-99`] — deferred, enhancement
- [x] [Review][Defer] `_journal.json` tidak memiliki trailing newline — pre-existing [`packages/db/src/migrations/meta/_journal.json`] — deferred, pre-existing
- [x] [Review][Defer] Nav link tidak memiliki active-state indicator atau role-based visibility guard [`apps/backoffice/app/(dashboard)/layout.tsx:41-47`] — deferred, UX enhancement

- [x] [Review][Patch] Anti-pattern `parseFloat` di `formatRupiah` [apps/backoffice/app/(dashboard)/reports/profit-loss/page.tsx:4]
- [x] [Review][Patch] Precision loss pada Export menggunakan `.toNumber()` [apps/backoffice/app/api/bo/reports/profit-loss/export/route.ts:18]
- [x] [Review][Patch] Kurangnya validasi format tanggal di `page.tsx` dan `report-service.ts` [apps/backoffice/app/(dashboard)/reports/profit-loss/page.tsx:28]
- [x] [Review][Patch] Penggunaan LF (`\n`) bukan CRLF (`\r\n`) pada CSV [apps/backoffice/app/api/bo/reports/profit-loss/export/route.ts:74]
- [x] [Review][Patch] CSV corruption akibat karakter baris baru di nama cabang [apps/backoffice/app/api/bo/reports/profit-loss/export/route.ts:25]
- [x] [Review][Patch] Redundansi kalkulasi `totalGrossProfit` di service layer [apps/backoffice/lib/services/report-service.ts:117]
- [x] [Review][Patch] Validasi `startDate > endDate` di service layer melempar Error mentah [apps/backoffice/lib/services/report-service.ts:35]
