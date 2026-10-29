# Referensi Teknis Hammielion

Aturan development berada di [AGENTS.md](../../AGENTS.md). Dokumen ini berisi peta kode, pola, dan perilaku tooling; baca bagian yang relevan dengan pekerjaan. Path kode dan dokumen di bawah relatif terhadap root repo.

Bagian HRIS berlaku pada `dev_hris`/`staging`; package, perintah, dan dokumen HRIS belum tentu ada di `main`. Periksa isi branch sebelum menjalankan perintah atau membuka rujukan lintas branch. Penyalinan aturan development ke `main` tidak mengaktifkan HRIS produksi.

## Monorepo Overview

```
hammielion-monorepo/
├── apps/
│   ├── backoffice/       # Next.js 15 — dashboard admin & manajemen
│   ├── pos-desktop/      # Electron + Vite + React 19 — POS offline desktop
│   └── db-compare/       # CLI utility — compare & migrate DB
├── packages/
│   ├── @petshop/db       # Drizzle ORM — schema & DB factory
│   └── @petshop/shared   # Shared types, Zod schemas, utilities
└── docs/
```

**Versi dependency:** cek `package.json` dan lockfile; tabel di bawah adalah referensi historis, bukan patokan upgrade.

**Package manager:** pnpm 9.15.9
**Build orchestrator:** Turbo

---

## Tech Stack

| Layer | Library | Versi |
|---|---|---|
| Framework | Next.js (App Router) | 15.5.15 |
| Runtime | React | 19.1.0 |
| Language | TypeScript | ^5.0.0 |
| ORM | Drizzle ORM | ^0.45.2 |
| Database | PostgreSQL (self-host) | — |
| Auth | jose (JWT HS256) + argon2 | Latest |
| Validation | Zod | Latest |
| Kalkulasi harga | big.js | ^7.0.1 |
| Styling | Tailwind CSS | ^4 |
| Icons | Lucide React | Latest |
| Desktop POS | Electron + Dexie (IndexedDB) | ^30 + ^4.4.2 |
| State (POS) | Zustand | ^5.0.13 |

---

## Struktur Backoffice

### App Router
```
apps/backoffice/app/
├── (dashboard)/          # Route group — semua halaman yang butuh auth
│   ├── master-data/      # Produk, kategori, brand, satuan ukur
│   ├── inventory/        # Stok, stock adjustment, stock opname
│   ├── purchase-orders/  # Purchase order & penerimaan barang
│   ├── transactions/     # Riwayat transaksi & retur
│   ├── shifts/           # Manajemen shift kasir
│   ├── reports/          # Laporan laba rugi & nilai stok
│   └── settings/         # User & cabang
├── api/
│   ├── auth/             # Login (email/password & staff PIN)
│   ├── bo/               # Back office API (butuh auth)
│   ├── pos/              # POS sync API (desktop ↔ server)
│   ├── products/         # Public product search
│   └── customers/        # Public customer search
└── pos/                  # Web POS (select-branch, login, shift, dll)
```

### Konvensi File per Halaman
```
[halaman]/
├── page.tsx              # Server component — fetch awal, pass ke client
└── _components/
    ├── types.ts          # Interface & type lokal
    ├── [nama]-client.tsx # Client component — state & interaktivitas
    └── [nama]-form.tsx   # Form component
```

### Lib Utilities
```
apps/backoffice/lib/
├── auth.ts               # signAccessToken, signRefreshToken, verifyAccessToken
├── db.ts                 # Drizzle instance (import `db` dari sini)
├── pos-branch.ts         # getPosBranchId(), getPosBranchName()
└── services/             # dashboard, report, retur, stock, transaction
```

---

## Database Schema

**Semua schema:** `packages/db/src/schema/`
**Namespace backoffice:** `petshop`; fondasi HRIS menambah `auth`, `logistics`, dan `hris`. Lihat `docs/hris_planning/PRD/fase_1/01-arsitektur.md`.

| File | Tabel Utama |
|---|---|
| `master.ts` | `categories`, `brands`, `suppliers`, `customers`, `unitsOfMeasure`, `paymentMethods` |
| `products.ts` | `products` (`product_kind`: `BARANG` / `JASA_GROOMING` / `JASA_ONGKIR` — jasa tanpa stok, migrasi 0037 & 0040; lihat `docs/work/specs/2026-10-11-jasa-grooming-design.md`), `productUomConversions`, `productPrices` |
| `inventory.ts` | `productStocks`, `productStockBatches`, `stockAdjustments` |
| `transactions.ts` | `transactions`, `transactionItems` (`is_service` = snapshot baris jasa, tidak pernah memotong stok), `transactionPayments`, `openBills` |
| `shifts.ts` | `shifts`, `shiftExpenses`, `shiftCashierSessions` |
| `purchase_orders.ts` | `purchaseOrders`, `purchaseOrderItems`, `poReceivingLogs` |
| `stock_opnames.ts` | Stock opname / audit stok |
| `users.ts` | `users`, `roles`, `permissions`, `ownerAssignments` |
| `branches.ts` | `branches` |
| `audit.ts` | `auditLogs`, `voidRequests`, `ownerPriceOverrides` |
| `finance.ts` | `customerDebts`, `debtPayments` (`proof_photo_url` — foto bukti transfer opsional, migrasi 0036; juga di `supplier_payable_payments`) |
| `returns.ts` | Return management |
| `supplier_returns.ts` | `supplierReturns`, `supplierReturnItems`, `supplierCreditEntries` — Retur ke Supplier + saldo supplier. Migrasi 0031, tayang 1.107.58; kolom pembatalan (RI3b) migrasi 0033 — lihat `docs/work/specs/2026-10-10-retur-supplier-design.md` |
| `internal_returns.ts` | `internalReturns`, `internalReturnItems`, `internalCreditEntries`, `internalReturnBatchAdjustments` — Retur Internal (Barang Dikembalikan / Revisi Harga Beli) + Saldo Internal per pasangan cabang + jejak koreksi modal batch. Migrasi 0034 (RI4), 0035 (RI8; juga `product_stock_batches.transfer_item_id`) — lihat `docs/work/specs/2026-10-11-retur-internal-design.md` |
| `grooming.ts` | `groomers`, `pets` (migrasi 0038), `groomingOrders` (migrasi 0039: satu baris per ekor per kunjungan, menempel ke baris nota), `serviceDeliveries` (migrasi 0040: delivery antar-jemput per nota, menempel ke baris ongkir; `groomers.is_groomer`/`is_courier`), `groomingGroomerChanges` (migrasi 0041: jejak Ganti Groomer); 0042: `service_deliveries` juga mencatat antar barang dari tab Kasir (alamat & pelanggan kosong) — daftar groomer, data kucing milik pelanggan, dan catatan grooming (tanpa hapus, hanya nonaktif / dibatalkan) — lihat `docs/work/specs/2026-10-11-jasa-grooming-design.md` |
| `transaction_discounts.ts` | `transactionItemDiscounts` — catatan potongan per baris nota (`MANUAL` / `PROMO`), migrasi 0043; aturan diskon ketikan kasir hanya di `lib/manual-discount.ts`, rumus nilai bersih baris hanya di `lib/line-net-value.ts`, potongan di struk hanya di `lib/receipt-lines.ts`, pengelompokan laporan Riwayat Diskon hanya di `lib/discount-history.ts` — lihat `docs/work/specs/2026-10-12-promo-otomatis-design.md` |
| `promos.ts` | `promos`, `promoBranches`, `promoConditions`, `promoRewards` — promo otomatis: syarat + hadiah + batas (cabang, masa berlaku, jam, kelipatan, maksimal per nota), migrasi 0044; aturan promo hanya di `lib/promo/promo-engine.ts`; tabel `promotions` lama tidak dipakai — lihat `docs/work/specs/2026-10-12-promo-otomatis-design.md` |
| `inter_branch_payables.ts` | `interBranchPayables`, `interBranchPayments` — hutang internal antar cabang; `source_type` (0034) menandai baris otomatis Retur/Saldo Internal |

**Import di backoffice:**
```typescript
import { db, products, eq, and, or, ilike } from '@/lib/db'
```

---

## Auth Pattern

**JWT disimpan di cookie HTTP-only `accessToken`**

```typescript
// Verifikasi di setiap API route:
const cookieStore = await cookies()
const token = cookieStore.get('accessToken')?.value
const payload = token ? await verifyAccessToken(token) : null
if (!payload) {
  return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
}
```

**JWT Payload:**
```typescript
{
  userId: number
  userName: string
  staffNumber: string | null
  branchId: number
  branchName: string
  role: 'OWNER' | 'GM' | 'MANAGER' | 'KASIR' | 'GUDANG' | 'FINANCE'
  permissions: string[]
}
```

**Role hierarchy untuk mutasi data master:**
```typescript
const ALLOWED_MUTATE_ROLES = ['OWNER', 'GM']
```

---

## Pola API Route

### Response Shape
```typescript
// Success GET
return NextResponse.json(data)

// Success POST/CREATE
return NextResponse.json(created, { status: 201 })

// Error — SELALU format ini
return NextResponse.json({ error: 'Pesan dalam Bahasa Indonesia' }, { status: 4xx | 5xx })
```

### Status Code
| Code | Kondisi |
|---|---|
| 400 | Validasi gagal / data tidak valid |
| 401 | Token tidak ada / expired |
| 403 | Role tidak punya akses |
| 409 | Duplikat (SKU, kode, nama) |
| 415 | Content-Type bukan application/json |
| 500 | Server error |

### Validasi dengan Zod
```typescript
const parsed = schema.safeParse(body)
if (!parsed.success) {
  return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
}
```

### Cek Duplikat dalam Transaksi DB
```typescript
const result = await db.transaction(async (trx) => {
  const existing = await trx.select({ id: table.id }).from(table).where(eq(table.code, value)).limit(1)
  if (existing.length > 0) throw new Error('DUPLICATE_CODE')
  return await trx.insert(table).values(data).returning()
})
```

---

## Environment Variables

```
DATABASE_URL          # PostgreSQL connection string
JWT_SECRET            # Access token key (min 32 char)
JWT_REFRESH_SECRET    # Refresh token key (min 32 char)
```

---

## Dev Commands

```bash
pnpm dev:backoffice   # Jalankan backoffice di port 6969
pnpm dev:hris         # Jalankan HRIS di port 7171
pnpm dev:pos          # Jalankan pos-desktop
pnpm db:migrate       # Jalankan migrasi DB (4 aliran: petshop → auth → logistics → hris)
pnpm db:studio        # Buka Drizzle Studio
pnpm db:push          # Push schema ke DB
pnpm typecheck        # TypeScript check
pnpm lint             # ESLint
pnpm test             # Vitest
pnpm changelog:check  # Validasi potongan changelog.d/
pnpm migrations:check # Cek penomoran & keutuhan migrasi DB
pnpm pos:check        # Khusus pos-desktop (dibekukan, lihat bawah)
```

**CI (`.github/workflows/ci.yml`)** menjalankan typecheck, lint, test, `changelog:check`, dan `migrations:check` di setiap PR.

### Kerja Paralel — Worktree

Satu pekerjaan = satu worktree = satu branch. Jangan menumpuk beberapa fitur di folder yang sama.

```bash
pnpm worktree:new feat/cash-report --from origin/main
pnpm worktree:new feat/hris-attendance --from origin/dev_hris
pnpm worktree:remove feat/cash-report --keep-branch --keep-db
```

`worktree:new` mengurus yang tidak bisa disalin git karena gitignored:

| Hal | Perlakuan |
|---|---|
| `.env`, `apps/*/.env.local` | disalin dari worktree sumber |
| `DATABASE_URL` | **selalu** ditulis ulang ke Postgres lokal, tidak pernah produksi |
| Database | `petshop_wt_<slug>` dibuat `TEMPLATE petshop_db` — isinya sama, bebas di-reset |
| `PORT` | port kosong berikutnya (6969/7070/7171 dicadangkan untuk worktree utama) |

Port app dibaca dari `PORT` (env → `.env.local` → bawaan) lewat `scripts/next-with-port.mjs`, jadi dua worktree bisa menjalankan `pnpm dev:backoffice` bersamaan.

`worktree:new` secara bawaan memakai branch lokal `main`; tulis `--from` secara eksplisit setelah fetch agar dasar pekerjaan benar.

`worktree:remove` saat ini mengecek integrasi terhadap `main`, bukan `dev_hris` atau `staging`, dan secara bawaan menghapus branch serta DB lokal. Jangan memakai `--force` untuk melewati pemeriksaan commit HRIS yang belum ke produksi. Untuk cleanup setelah integrasi HRIS/staging, periksa status bersih serta ketercakupan commit di target integrasinya, lalu gunakan `git worktree remove <path>` dan `git worktree prune`; branch/DB tetap disimpan. Jika folder tidak habis terhapus, laporkan sisanya. Jangan mengubah atau menghapus worktree agent lain yang masih aktif.

Di Windows, path worktree + nama berkas terpanjang repo ini harus < 260 karakter. Skripnya menolak lebih awal kalau kelewat — pilih folder pendek (`--dir C:\wt\nama`) atau `git config --global core.longpaths true`.
