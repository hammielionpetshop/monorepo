# Story 7.4: Price Tier Manager

**Story ID:** 7.4
**Story Key:** 7-4-price-tier-manager
**Epic:** 7 - Backoffice Master Data Management (P0 — Critical Blocker)
**Status:** done
**Created:** 2026-05-09

---

## User Story

Sebagai Admin/Owner,
saya ingin mengatur 6 tingkat harga per produk per cabang per UOM melalui Backoffice,
Agar harga yang tepat diterapkan otomatis oleh POS berdasarkan tipe pelanggan.

---

## Acceptance Criteria

**AC1 — Tab "Harga" di Product Detail**
Given Admin membuka halaman detail produk (`/master-data/products/[id]`)
When halaman dimuat
Then tab "Harga" tersedia di samping tab "Satuan" dan dapat diklik untuk berpindah

**AC2 — Tampilan Grid Harga**
Given Admin mengklik tab "Harga"
When halaman tab dimuat
Then dropdown pemilih cabang (branch) tersedia
And setelah cabang dipilih, grid harga ditampilkan dengan:
- Baris = setiap UOM yang dikonfigurasi untuk produk ini (UOM dasar + semua UOM konversi)
- Kolom = 6 tier harga: RETAIL, GROSIR, MEMBER, DISTRIBUTOR, RESELLER, PROMO

**AC3 — Tambah Harga Baru**
Given Admin mengisi harga pada sel kosong untuk kombinasi UOM + tier yang belum ada
When Admin menekan "Simpan Semua"
Then entri baru tersimpan ke tabel `product_prices`

**AC4 — Edit Harga yang Sudah Ada**
Given Admin mengubah angka pada sel yang sudah ada harganya
When Admin menekan "Simpan Semua"
Then harga diperbarui di database

**AC5 — Hapus Harga (Bersihkan Sel)**
Given Admin mengosongkan sel harga yang sebelumnya berisi nilai
When Admin menekan "Simpan Semua"
Then entri tersebut dihapus dari `product_prices`

**AC6 — Validasi Harga**
Given Admin mengisi harga dengan nilai negatif atau teks bukan angka
When menekan "Simpan Semua"
Then error validasi ditampilkan dan tidak ada perubahan di database

**AC7 — Auth & Role**
Given akses tanpa autentikasi
When API diakses
Then return 401
Given user role bukan OWNER/GM mencoba PUT
When request dikirim
Then return 403

---

## Scope & Batasan

- **In scope:**
  - Tab "Harga" di halaman detail produk `/master-data/products/[id]`
  - Branch selector dropdown (semua cabang aktif dari DB)
  - Grid harga 6-tier per UOM (base + conversions)
  - GET dan PUT API route di path `bo/master-data`
  - Strategi upsert: replace-per-branch dalam satu transaction (DELETE existing → INSERT baru)
  - Sel kosong = tidak disimpan (dihapus jika sebelumnya ada)
- **Out of scope:**
  - Validasi silang harga antar tier (misal: GROSIR harus < RETAIL)
  - History perubahan harga
  - Import/export harga via CSV
  - Harga promo dengan tanggal berlaku

---

## Skema Database yang Relevan

File: `packages/db/src/schema/products.ts` — **SUDAH ADA, tidak perlu migration baru**

```typescript
export const productPrices = petshop.table('product_prices', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id).notNull(),
  branchId: integer('branch_id').notNull(), // referensi branches.id, no FK di schema
  uomId: integer('uom_id').references(() => unitsOfMeasure.id).notNull(),
  tierType: varchar('tier_type', { length: 20 }).notNull(), // RETAIL, GROSIR, MEMBER, DISTRIBUTOR, RESELLER, PROMO
  price: decimal('price', { precision: 12, scale: 2 }).notNull(),
});
```

**Penting:**
- `price` adalah decimal string dari Drizzle (bukan number). Semua kalkulasi harus via **big.js**.
- **Tidak ada unique constraint** di level DB untuk `(productId, branchId, uomId, tierType)`. Logika upsert WAJIB dilakukan di aplikasi level dalam `db.transaction()`.
- `productPrices` sudah ter-export dari `packages/db/src/schema/index.ts` → tersedia via `import { productPrices } from '@/lib/db'`.

File: `packages/db/src/schema/branches.ts` — **SUDAH ADA**

```typescript
export const branches = petshop.table('branches', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  address: text('address'),
  phone: varchar('phone', { length: 20 }),
  isActive: boolean('is_active').default(true).notNull(),
  // ...
});
```

`branches` ter-export via `@/lib/db` (melalui `packages/db/src/schema/index.ts`).

**6 Tier Types yang Valid** (dari `packages/shared/src/utils/pricing.ts`):
```typescript
export type PriceTier = 'RETAIL' | 'GROSIR' | 'MEMBER' | 'DISTRIBUTOR' | 'RESELLER' | 'PROMO';
```
Urutan tampil di grid: RETAIL, GROSIR, MEMBER, DISTRIBUTOR, RESELLER, PROMO.

---

## File Structure

```
apps/backoffice/
├── app/
│   ├── (dashboard)/
│   │   └── master-data/
│   │       └── products/
│   │           └── [id]/
│   │               ├── page.tsx                          # UPDATE: fetch branches, build uomsForPricing, render ProductDetailTabs
│   │               └── _components/
│   │                   ├── uom-conversion-client.tsx     # EXISTING — JANGAN DIUBAH
│   │                   ├── uom-conversion-form.tsx       # EXISTING — JANGAN DIUBAH
│   │                   ├── product-detail-tabs.tsx       # BARU: client component tab switcher
│   │                   └── price-tier-client.tsx         # BARU: branch selector + price grid + save
│   └── api/
│       └── bo/
│           └── master-data/
│               └── products/
│                   └── [id]/
│                       ├── uom-conversions/              # EXISTING — JANGAN DIUBAH
│                       │   ├── route.ts
│                       │   └── [convId]/route.ts
│                       └── prices/
│                           └── route.ts                  # BARU: GET, PUT
```

**JANGAN GUNAKAN** route lama di `apps/backoffice/app/api/products/[id]/prices/route.ts` — itu unprotected, wrong path, dan tidak mengikuti pola `bo/master-data`. Buat route baru di path `bo/master-data`.

---

## Tasks / Subtasks

- [x] Task 1: API Route — GET & PUT `/api/bo/master-data/products/[id]/prices`
  - [x] Buat `apps/backoffice/app/api/bo/master-data/products/[id]/prices/route.ts`
  - [x] `export const dynamic = 'force-dynamic'`
  - [x] GET: Auth check → validate `id` param → validate `branchId` query param → query `productPrices` WHERE `productId = id AND branchId = branchId` → return `{ uomId, tierType, price }[]`
  - [x] PUT: Auth check → role check (OWNER/GM only) → Zod validate body `{ branchId: number, prices: { uomId: number, tierType: string, price: string }[] }` → validate setiap `price` via big.js (>= 0) → validate setiap `tierType` termasuk salah satu dari 6 tier valid → dalam `db.transaction()`: DELETE existing entries untuk (productId, branchId), INSERT semua baris baru → return 200

- [x] Task 2: Update `page.tsx` — tambah fetch branches & refactor ke ProductDetailTabs
  - [x] Import `branches` dari `@/lib/db`
  - [x] Tambah fetch `allBranches` (id, code, name, isActive) ke dalam `Promise.all` yang sudah ada
  - [x] Build `uomsForPricing`: `[{ id: product.baseUomId, code: product.uomCode, name: product.uomName, isBase: true }, ...conversions.map(c => ({ id: c.uomId!, code: c.uomCode!, name: c.uomName!, isBase: false }))]`
  - [x] Ganti render tab statis + `UomConversionClient` langsung dengan `ProductDetailTabs`
  - [x] Pass props ke `ProductDetailTabs`: `productId`, `product`, `conversions`, `availableUoms`, `branches`, `uomsForPricing`

- [x] Task 3: Buat `ProductDetailTabs` — client tab switcher
  - [x] `'use client'`
  - [x] State: `activeTab: 'satuan' | 'harga'` (default: `'satuan'`)
  - [x] Render dua tab button: "Satuan" dan "Harga" (active state: `border-b-2 border-primary text-primary`)
  - [x] Render `UomConversionClient` jika `activeTab === 'satuan'`
  - [x] Render `PriceTierClient` jika `activeTab === 'harga'`
  - [x] Props: `productId`, `initialConversions`, `availableUoms`, `baseUomId`, `branches`, `uomsForPricing`

- [x] Task 4: Buat `PriceTierClient` — branch selector + price grid
  - [x] `'use client'`
  - [x] Props: `productId: number`, `branches: BranchOption[]`, `uomsForPricing: UomForPricing[]`
  - [x] State: `selectedBranchId: number | null` (default: pertama dari branches jika ada), `prices: PriceEntry[]`, `isLoading`, `isSaving`, `successMsg`, `errorMsg`
  - [x] `useEffect` fetch prices dari API saat `selectedBranchId` berubah
  - [x] Fungsi `buildPriceMap(prices)` → `Record<uomId, Record<tierType, string>>` untuk akses O(1) di grid
  - [x] Render: dropdown cabang → grid harga → tombol "Simpan Semua"
  - [x] Grid: thead = ["UOM", "RETAIL", "GROSIR", "MEMBER", "DISTRIBUTOR", "RESELLER", "PROMO"], tbody = satu baris per UOM dari `uomsForPricing`
  - [x] Setiap sel harga: `<input type="text" inputMode="decimal">` dengan value dari `localPrices[uomId][tier] ?? ''`
  - [x] Saat berubah: update local state saja (belum kirim ke API)
  - [x] Tombol "Simpan Semua": kumpulkan semua sel non-kosong → PUT ke API → refresh
  - [x] Success/error banner dengan auto-dismiss pattern (3 detik) dari Story 7.2/7.3
  - [x] Disable semua input + tombol saat `isSaving`

### Review Findings (2026-05-09 — Round 1)

**decision-needed:** 1 | **patch:** 6 | **defer:** 5 | **dismissed:** 9

#### decision-needed

- [x] [Review][Decision] PUT dengan `prices: []` menghapus semua harga tanpa konfirmasi — **RESOLVED (opsi 1)**: tambah `window.confirm()` saat `rows.length === 0` — **PATCHED 2026-05-09**

#### patch

- [x] [Review][Patch] `uomsForPricing` tidak di-deduplikasi — base UOM duplikat jika juga ada di conversions [page.tsx] — **PATCHED 2026-05-09**: tambah `&& c.uomId !== product.baseUomId` di filter
- [x] [Review][Patch] Duplicate `(uomId, tierType)` dalam PUT body → multiple rows ter-insert [prices/route.ts] — **PATCHED 2026-05-09**: tambah Set-based dedup check, return 400 jika duplikat
- [x] [Review][Patch] `fetchPrices` race condition saat branch switching cepat [price-tier-client.tsx] — **PATCHED 2026-05-09**: `AbortController` + `useRef`, clear `localPrices` di awal fetch
- [x] [Review][Patch] Price melebihi `decimal(12,2)` → DB overflow → 500 [prices/route.ts] — **PATCHED 2026-05-09**: `MAX_PRICE = new Big('9999999999.99')` + validasi → 400
- [x] [Review][Patch] `branches` kosong → no empty-state message [price-tier-client.tsx] — **PATCHED 2026-05-09**: early-return dengan pesan "Tidak ada cabang aktif yang terdaftar"
- [x] [Review][Patch] Tiers hardcoded lokal, tidak dari `@petshop/shared` [prices/route.ts, price-tier-client.tsx] — **PATCHED 2026-05-09**: export `PRICE_TIERS` dari shared, semua referensi diperbarui

#### defer

- [x] [Review][Defer] GET tidak memvalidasi `branchId` aktif — bisa baca harga dari branch nonaktif [prices/route.ts:46-65] — deferred, low-risk (GET only reads, nonaktif branch tidak tampil di UI)
- [x] [Review][Defer] PUT tidak memvalidasi `branchId` aktif — bisa tulis harga untuk branch nonaktif [prices/route.ts:122-129] — deferred, data integrity minor (UI tidak menampilkan branch nonaktif)
- [x] [Review][Defer] PUT `uomId` tidak divalidasi sebagai milik produk ini — phantom prices bisa di-insert via direct API call [prices/route.ts:150-160] — deferred, hanya OWNER/GM, phantom rows hilang pada save berikutnya
- [x] [Review][Defer] `localPrices` tidak di-refresh setelah save gagal → UI state bisa diverge dari DB state [price-tier-client.tsx:120-134] — deferred, jarang terjadi, user bisa manual refresh
- [x] [Review][Defer] Whitespace dalam `row.price` string → error message "Harga tidak valid untuk UOM ID X" misleading [prices/route.ts:113-120] — deferred, edge case kecil, hanya via direct API

---

## Dev Notes

### Pola Golden Template — Wajib Diikuti

Semua pola dari Story 7.1, 7.2, 7.3 sudah post-review. Ikuti:
- API auth pattern: `apps/backoffice/app/api/bo/master-data/uom/route.ts`
- API PUT dengan param: `apps/backoffice/app/api/bo/master-data/products/[id]/uom-conversions/route.ts`
- Client component pattern: `apps/backoffice/app/(dashboard)/master-data/products/[id]/_components/uom-conversion-client.tsx`
- Success/error banner pattern (mutually exclusive, auto-dismiss): persis sama

### Pola Auth (wajib di SETIAP API route)

```typescript
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'

const cookieStore = await cookies()
const token = cookieStore.get('accessToken')?.value
const payload = token ? await verifyAccessToken(token) : null
if (!payload) {
  return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
}
```

### Role Check untuk Mutasi (PUT)

```typescript
const ALLOWED_MUTATE_ROLES = ['OWNER', 'GM']

if (!ALLOWED_MUTATE_ROLES.includes(payload.role)) {
  return NextResponse.json({ error: 'Akses ditolak. Hanya Owner dan GM yang dapat mengubah harga.' }, { status: 403 })
}
```

### API Route GET prices

```typescript
// GET /api/bo/master-data/products/[id]/prices?branchId=X
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Auth check
  // 2. Validate id param: /^\d+$/ → productId
  // 3. Validate branchId query param: req.nextUrl.searchParams.get('branchId') → /^\d+$/
  // 4. Query:
  const result = await db
    .select({
      uomId: productPrices.uomId,
      tierType: productPrices.tierType,
      price: productPrices.price,
    })
    .from(productPrices)
    .where(
      and(
        eq(productPrices.productId, productId),
        eq(productPrices.branchId, branchId)
      )
    )
  return NextResponse.json(result)
}
```

### API Route PUT prices — Replace-per-Branch dalam Transaction

```typescript
const VALID_TIER_TYPES = ['RETAIL', 'GROSIR', 'MEMBER', 'DISTRIBUTOR', 'RESELLER', 'PROMO'] as const

const putSchema = z.object({
  branchId: z.number().int().positive('branchId wajib diisi'),
  prices: z.array(z.object({
    uomId: z.number().int().positive(),
    tierType: z.enum(['RETAIL', 'GROSIR', 'MEMBER', 'DISTRIBUTOR', 'RESELLER', 'PROMO']),
    price: z.string().min(1),
  })),
})

// Dalam handler:
// Validasi setiap price >= 0 via big.js
for (const row of parsed.data.prices) {
  try {
    const p = new Big(row.price)
    if (p.lt(0)) throw new Error()
  } catch {
    return NextResponse.json({ error: 'Harga tidak boleh negatif' }, { status: 400 })
  }
}

// Cek branch ada
const branch = await db.select({ id: branches.id }).from(branches).where(eq(branches.id, parsed.data.branchId)).limit(1)
if (branch.length === 0) return NextResponse.json({ error: 'Cabang tidak ditemukan' }, { status: 404 })

// Cek produk ada
const product = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1)
if (product.length === 0) return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 })

// Replace-per-branch dalam transaction
await db.transaction(async (trx) => {
  // DELETE semua entri lama untuk productId + branchId ini
  await trx.delete(productPrices).where(
    and(
      eq(productPrices.productId, productId),
      eq(productPrices.branchId, parsed.data.branchId)
    )
  )
  // INSERT baru (hanya sel non-kosong yang dikirim client)
  if (parsed.data.prices.length > 0) {
    await trx.insert(productPrices).values(
      parsed.data.prices.map(row => ({
        productId,
        branchId: parsed.data.branchId,
        uomId: row.uomId,
        tierType: row.tierType,
        price: new Big(row.price).toString(),
      }))
    )
  }
})

return NextResponse.json({ message: 'Harga berhasil disimpan' })
```

### Update `page.tsx` — Tambah Fetch Branches

```typescript
// Tambah import
import { db, products, categories, brands, unitsOfMeasure, productUomConversions, branches, eq } from '@/lib/db'
import ProductDetailTabs from './_components/product-detail-tabs'

// Dalam Promise.all tambah fetchBranches:
let conversions, allUoms, allBranches
[conversions, allUoms, allBranches] = await Promise.all([
  fetchConversions(productId),
  fetchAllUoms(),
  fetchAllBranches(),
])

// Build uomsForPricing setelah fetch berhasil:
const uomsForPricing = [
  { id: product.baseUomId, code: product.uomCode ?? '-', name: product.uomName ?? '-', isBase: true },
  ...conversions
    .filter(c => c.uomId !== null)
    .map(c => ({ id: c.uomId as number, code: c.uomCode ?? '-', name: c.uomName ?? '-', isBase: false }))
]

// Ganti render tab statis + UomConversionClient:
<ProductDetailTabs
  productId={product.id}
  initialConversions={conversions}
  availableUoms={allUoms}
  baseUomId={product.baseUomId}
  branches={allBranches}
  uomsForPricing={uomsForPricing}
/>

// Helper function baru:
function fetchAllBranches() {
  return db
    .select({ id: branches.id, code: branches.code, name: branches.name })
    .from(branches)
    .where(eq(branches.isActive, true))
    .orderBy(branches.name)
}
```

### `ProductDetailTabs` — Tab Switcher Client Component

```typescript
'use client'
import { useState } from 'react'
import UomConversionClient from './uom-conversion-client'
import PriceTierClient from './price-tier-client'

type ActiveTab = 'satuan' | 'harga'

interface Props {
  productId: number
  initialConversions: UomConversion[]
  availableUoms: UomOption[]
  baseUomId: number
  branches: BranchOption[]
  uomsForPricing: UomForPricing[]
}

export default function ProductDetailTabs({ productId, initialConversions, availableUoms, baseUomId, branches, uomsForPricing }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('satuan')

  const tabClass = (tab: ActiveTab) =>
    `px-4 py-2 text-sm font-medium transition-colors ${
      activeTab === tab
        ? 'text-primary border-b-2 border-primary'
        : 'text-muted-foreground hover:text-foreground'
    }`

  return (
    <>
      {/* Tab nav */}
      <div className="border-b border-border mb-6">
        <nav className="flex gap-0">
          <button onClick={() => setActiveTab('satuan')} className={tabClass('satuan')}>
            Satuan
          </button>
          <button onClick={() => setActiveTab('harga')} className={tabClass('harga')}>
            Harga
          </button>
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'satuan' && (
        <UomConversionClient
          productId={productId}
          initialConversions={initialConversions}
          availableUoms={availableUoms}
          baseUomId={baseUomId}
        />
      )}
      {activeTab === 'harga' && (
        <PriceTierClient
          productId={productId}
          branches={branches}
          uomsForPricing={uomsForPricing}
        />
      )}
    </>
  )
}
```

### `PriceTierClient` — State & Fetch Pattern

```typescript
'use client'
import { useState, useEffect, useCallback } from 'react'
import Big from 'big.js'

const TIERS = ['RETAIL', 'GROSIR', 'MEMBER', 'DISTRIBUTOR', 'RESELLER', 'PROMO'] as const
type TierType = typeof TIERS[number]

interface BranchOption { id: number; code: string; name: string }
interface UomForPricing { id: number; code: string; name: string; isBase: boolean }
interface PriceEntry { uomId: number; tierType: string; price: string }

// localPrices = map { uomId → { tierType → priceString } }
type LocalPrices = Record<number, Partial<Record<TierType, string>>>

export default function PriceTierClient({ productId, branches, uomsForPricing }: Props) {
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(branches[0]?.id ?? null)
  const [localPrices, setLocalPrices] = useState<LocalPrices>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!successMsg) return
    const t = setTimeout(() => setSuccessMsg(null), 3000)
    return () => clearTimeout(t)
  }, [successMsg])

  const fetchPrices = useCallback(async (branchId: number) => {
    setIsLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/bo/master-data/products/${productId}/prices?branchId=${branchId}`)
      if (!res.ok) { setErrorMsg('Gagal mengambil data harga'); return }
      const data: PriceEntry[] = await res.json()
      // Build localPrices map
      const map: LocalPrices = {}
      for (const entry of data) {
        if (!map[entry.uomId]) map[entry.uomId] = {}
        map[entry.uomId][entry.tierType as TierType] = entry.price
      }
      setLocalPrices(map)
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan saat mengambil harga')
    } finally {
      setIsLoading(false)
    }
  }, [productId])

  useEffect(() => {
    if (selectedBranchId !== null) fetchPrices(selectedBranchId)
    else setLocalPrices({})
  }, [selectedBranchId, fetchPrices])

  function handlePriceChange(uomId: number, tier: TierType, value: string) {
    setLocalPrices(prev => ({
      ...prev,
      [uomId]: { ...prev[uomId], [tier]: value }
    }))
  }

  async function handleSave() {
    if (!selectedBranchId || isSaving) return

    // Validasi semua nilai terisi
    const rows: { uomId: number; tierType: string; price: string }[] = []
    for (const uom of uomsForPricing) {
      for (const tier of TIERS) {
        const val = localPrices[uom.id]?.[tier]?.trim() ?? ''
        if (!val) continue // Skip kosong
        try {
          const p = new Big(val)
          if (p.lt(0)) throw new Error()
          rows.push({ uomId: uom.id, tierType: tier, price: p.toString() })
        } catch {
          setErrorMsg(`Harga tidak valid: UOM ${uom.name} - ${tier}`)
          setSuccessMsg(null)
          return
        }
      }
    }

    setIsSaving(true)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/bo/master-data/products/${productId}/prices`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId: selectedBranchId, prices: rows }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Gagal menyimpan harga')
        setSuccessMsg(null)
      } else {
        setSuccessMsg('Harga berhasil disimpan')
        setErrorMsg(null)
        await fetchPrices(selectedBranchId)
      }
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan')
      setSuccessMsg(null)
    } finally {
      setIsSaving(false)
    }
  }
}
```

### Import DB yang Benar

```typescript
// Di API route GET/PUT prices:
import { db, productPrices, products, branches, unitsOfMeasure, eq, and } from '@/lib/db'
import Big from 'big.js'

// Di page.tsx (server component):
import { db, products, categories, brands, unitsOfMeasure, productUomConversions, branches, eq } from '@/lib/db'
```

### Anti-Patterns yang Dilarang

- ❌ Gunakan route lama `apps/backoffice/app/api/products/[id]/prices/route.ts` — WAJIB path `bo/master-data`
- ❌ Kalkulasi harga dengan JS native number — wajib **big.js**
- ❌ Upsert tanpa `db.transaction()` — race condition + inkonsistensi data
- ❌ `fetch()` ke API route dari Server Component — panggil Drizzle langsung di page.tsx
- ❌ `alert()` untuk error — tampilkan inline
- ❌ Lewatkan `export const dynamic = 'force-dynamic'` di API routes
- ❌ `price` disimpan sebagai JS number ke DB — harus `string` (Drizzle decimal)
- ❌ Tidak cek `branchId` ada di DB sebelum menyimpan
- ❌ Buat migration baru — schema `product_prices` sudah ada
- ❌ Simpan semua harga termasuk string kosong — hanya simpan baris non-kosong
- ❌ Izinkan `tierType` selain 6 tier valid — Zod enum validation wajib
- ❌ Gunakan `<a>` tag untuk navigasi — wajib `<Link>` dari next/link
- ❌ Banner success dan error muncul bersamaan — harus mutually exclusive

### Architecture Compliance

| Rule | Implementation |
|------|---------------|
| Server Component page.tsx | ✅ Drizzle langsung, bukan fetch ke API |
| Client Component interaksi | ✅ `'use client'`, fetch ke API route |
| Auth setiap API route | ✅ `verifyAccessToken` dari `@/lib/auth` |
| Role check mutasi | ✅ OWNER/GM only pada PUT |
| Zod validation input | ✅ Di API route handler |
| big.js untuk decimal | ✅ Validasi dan stringify price |
| Atomic replace-per-branch | ✅ `db.transaction()` DELETE + INSERT |
| Error bahasa Indonesia | ✅ Semua pesan user-facing |
| `force-dynamic` API routes | ✅ Semua route baru |
| Tidak ada migration baru | ✅ Schema sudah ada |

### Urutan Implementasi yang Disarankan

1. **Task 1** — API route GET + PUT prices (core backend)
2. **Task 3** — `ProductDetailTabs` (tab switcher, sederhana)
3. **Task 4** — `PriceTierClient` (orchestrator harga)
4. **Task 2** — Update `page.tsx` (integrasi semua bagian)

Test manual setelah Task 1: curl GET dan PUT ke API untuk verifikasi sebelum lanjut ke UI.

---

## Context dari Story Sebelumnya (7.3)

### Review Findings dari Story 7.3 — Jangan Diulangi

- ✅ POST dan mutasi routes WAJIB ada role check (`ALLOWED_MUTATE_ROLES = ['OWNER', 'GM']`) setelah auth check
- ✅ `notFound()` TIDAK boleh dipanggil di dalam blok `try/catch` — Next.js NEXT_NOT_FOUND akan tertangkap oleh catch. Fetch produk di luar try/catch dulu, `notFound()` sebelum blok try.
- ✅ `export const dynamic = 'force-dynamic'` wajib di semua API routes (termasuk PATCH, PUT)
- ✅ `aria-live="polite"` pada banner success, `aria-live="assertive"` pada banner error
- ✅ Banner success dan error TIDAK bisa muncul bersamaan (mutually exclusive)
- ✅ Form tidak bisa disubmit ganda via keyboard saat in-flight (`isSaving` state)
- ✅ `window.confirm()` diizinkan untuk destructive action per spec

### Pola yang Sudah Teruji (Post-Review Story 7.1, 7.2, 7.3)

Dev agent **WAJIB** mengacu pada implementasi yang sudah ada sebagai referensi — jangan reinvent.

---

## Dev Agent Record

### Agent Model Used

GLM-5.1

### Debug Log

- TypeScript compilation: PASSED (no errors)
- ESLint: Pre-existing config issue with @typescript-eslint/no-unused-expressions rule (unrelated to Story 7.4 changes)
- All patterns followed from Stories 7.1-7.3 (auth, role check, Zod, big.js, db.transaction, mutually exclusive banners)

### Completion Notes

- Implemented all 4 tasks following the exact spec order
- Task 1: Created API route with GET (auth + branchId validation + query) and PUT (auth + role check + Zod + big.js validation + replace-per-branch transaction)
- Task 2: Updated page.tsx to add branches fetch, build uomsForPricing, replace static tab with ProductDetailTabs
- Task 3: Created ProductDetailTabs client component with tab switcher between Satuan and Harga
- Task 4: Created PriceTierClient with branch selector, 6-tier price grid, client-side validation via big.js, and save functionality
- All anti-patterns avoided: no native number math, no route outside bo/master-data, no migration, proper role check, mutually exclusive banners

---

## File List

**Baru (dibuat):**
- `apps/backoffice/app/api/bo/master-data/products/[id]/prices/route.ts`
- `apps/backoffice/app/(dashboard)/master-data/products/[id]/_components/product-detail-tabs.tsx`
- `apps/backoffice/app/(dashboard)/master-data/products/[id]/_components/price-tier-client.tsx`

**Dimodifikasi:**
- `apps/backoffice/app/(dashboard)/master-data/products/[id]/page.tsx` — fetch branches, build uomsForPricing, render ProductDetailTabs

---

## Change Log

- 2026-05-09: Story 7.4 dibuat — Price Tier Manager
- 2026-05-09: Implementasi selesai — semua 4 task (API route, page.tsx update, ProductDetailTabs, PriceTierClient)
