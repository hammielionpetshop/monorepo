<!-- markdownlint-disable MD013 -->

# Backoffice Stock Opname Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengunci seluruh flow stock opname POS dan backoffice agar branch, aktor, status, dan mutasi stok selalu berasal dari sesi tepercaya.

**Architecture:** Implementasi mengikuti pola hardening route yang sudah ada di POS purchase receiving dan transaksi: auth dilakukan langsung di route dengan `cookies()`, `verifyAccessToken()`, dan `getPosBranchId()`. Tidak ada helper lintas-folder baru supaya blast radius kecil; setiap route memiliki schema Zod lokal dan mapping error Bahasa Indonesia. Mutasi stock opname yang mengubah stok wajib berjalan dalam transaksi, mengunci row header dengan `.for('update')`, memakai `payload.userId` sebagai aktor, dan memakai branch dari POS session atau JWT, bukan dari body/query.

**Tech Stack:** Next.js App Router route handlers, TypeScript, Zod, Drizzle ORM, Vitest, pnpm, markdownlint-cli2.

---

## File Map

**POS route changes:**

- Modify: `apps/backoffice/app/api/pos/stock-opnames/route.ts`
- Modify: `apps/backoffice/app/api/pos/stock-opnames/[id]/add-items/route.ts`
- Modify: `apps/backoffice/app/api/pos/stock-opnames/[id]/approve/route.ts`
- Modify: `apps/backoffice/app/api/pos/stock-opnames/[id]/reject/route.ts`
- Modify: `apps/backoffice/app/api/pos/stock-opname/skip/route.ts`
- Modify: `apps/backoffice/app/api/pos/stock-opnames/active-full/route.ts`
- Modify: `apps/backoffice/app/api/pos/stock-opname/suggestions/route.ts`

**Backoffice route/page changes:**

- Modify: `apps/backoffice/app/api/bo/stock-opnames/route.ts`
- Modify: `apps/backoffice/app/api/bo/stock-opnames/history/route.ts`
- Modify: `apps/backoffice/app/(dashboard)/inventory/stock-opname/page.tsx`

**Tests to add or expand:**

- Create: `apps/backoffice/app/api/pos/stock-opnames/route.test.ts`
- Create: `apps/backoffice/app/api/pos/stock-opnames/[id]/add-items/route.test.ts`
- Create: `apps/backoffice/app/api/pos/stock-opnames/[id]/approve/route.test.ts`
- Create: `apps/backoffice/app/api/pos/stock-opnames/[id]/reject/route.test.ts`
- Create: `apps/backoffice/app/api/pos/stock-opname/skip/route.test.ts`
- Create: `apps/backoffice/app/api/pos/stock-opnames/active-full/route.test.ts`
- Create: `apps/backoffice/app/api/pos/stock-opname/suggestions/route.test.ts`
- Create: `apps/backoffice/app/api/bo/stock-opnames/route.test.ts`
- Create: `apps/backoffice/app/api/bo/stock-opnames/history/route.test.ts`

**Documentation:**

- Modify: `apps/backoffice/CHANGELOG.md`

---

## Shared Implementation Rules

Use these exact rules in every task:

- POS route auth imports:

```typescript
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'
import { getPosBranchId } from '@/lib/pos-branch'
```

- POS auth block:

```typescript
const cookieStore = await cookies()
const token = cookieStore.get('accessToken')?.value
const payload = token ? await verifyAccessToken(token) : null
if (!payload) {
  return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
}

const branchId = getPosBranchId(payload, cookieStore)
const actorId = payload.userId
```

- Never read these fields from request body/query for authority: `branchId`, `createdById`, `cashierId`, `approvedById`, `rejectedById`.
- If the client still sends spoofable fields, ignore them unless the test expects explicit rejection for BO manager branch access.
- Use only Indonesian error strings.
- Never return `error.message` to clients.
- Route tests must mock `next/headers`, `@/lib/auth`, `@/lib/pos-branch`, and `@/lib/db` using the patterns from `apps/backoffice/app/api/pos/transactions/route.test.ts` and `apps/backoffice/app/api/pos/purchase-orders/[id]/receive/route.test.ts`.
- Every implementation commit must pair the route with its direct route test.
- Every git command must be prefixed with `$env:GIT_MASTER='1';`.

---

### Task 1: Harden POS Stock Opname Submit

**Files:**

- Modify: `apps/backoffice/app/api/pos/stock-opnames/route.ts`
- Create: `apps/backoffice/app/api/pos/stock-opnames/route.test.ts`

- [ ] **Step 1: Write failing route tests for trusted branch and actor**

Create `apps/backoffice/app/api/pos/stock-opnames/route.test.ts` with tests that prove unauthenticated requests fail and spoofed branch/user values are ignored.

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'
import { verifyAccessToken } from '@/lib/auth'
import { getPosBranchId } from '@/lib/pos-branch'
import { db } from '@/lib/db'

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn((name: string) => (name === 'accessToken' ? { value: 'token' } : undefined)),
  })),
}))

vi.mock('@/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
}))

vi.mock('@/lib/pos-branch', () => ({
  getPosBranchId: vi.fn(),
}))

const insertedHeaders: Array<Record<string, unknown>> = []
const stockWhereCalls: unknown[] = []

vi.mock('@/lib/db', () => {
  const insert = vi.fn((table: unknown) => ({
    values: vi.fn((value: Record<string, unknown>) => {
      insertedHeaders.push(value)
      return {
        returning: vi.fn(async () => [{ id: 10, ...value }]),
      }
    }),
  }))

  const select = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn((condition: unknown) => {
        stockWhereCalls.push(condition)
        return {
          limit: vi.fn(async () => [{ quantity: '5' }]),
          orderBy: vi.fn(async () => [{ id: 1, remainingQty: '5', costPrice: 1000 }]),
        }
      }),
    })),
  }))

  return {
    db: { insert, select },
    sql: vi.fn(),
    eq: vi.fn((field, value) => ({ field, value })),
    and: vi.fn((...conditions) => conditions),
    asc: vi.fn((field) => field),
    stockOpnames: { id: 'so.id', branchId: 'so.branchId' },
    stockOpnameItems: { id: 'item.id' },
    productStocks: { branchId: 'stock.branchId', productId: 'stock.productId', uomId: 'stock.uomId' },
    productStockBatches: {
      branchId: 'batch.branchId',
      productId: 'batch.productId',
      uomId: 'batch.uomId',
      receivedAt: 'batch.receivedAt',
    },
  }
})

vi.mock('@/lib/stock-adjustment', () => ({
  calculateFIFOCost: vi.fn(() => 5000),
}))

function jsonRequest(body: unknown) {
  return new NextRequest('http://localhost/api/pos/stock-opnames', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/pos/stock-opnames', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    insertedHeaders.length = 0
    stockWhereCalls.length = 0
    vi.mocked(verifyAccessToken).mockResolvedValue({
      userId: 7,
      userName: 'Kasir',
      staffNumber: 'K-001',
      branchId: 2,
      branchName: 'Cabang 2',
      role: 'KASIR',
      permissions: [],
    })
    vi.mocked(getPosBranchId).mockReturnValue(2)
  })

  it('menolak request tanpa sesi valid', async () => {
    vi.mocked(verifyAccessToken).mockResolvedValue(null)

    const response = await POST(jsonRequest({ type: 'DAILY', items: [] }))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Sesi tidak valid, silakan login kembali' })
  })

  it('menggunakan branch dan aktor dari JWT, bukan body spoofable', async () => {
    const response = await POST(jsonRequest({
      branchId: 999,
      createdById: 999,
      shiftId: 3,
      type: 'DAILY',
      method: 'MANUAL',
      notes: 'cek pagi',
      items: [{ productId: 11, uomId: 1, physicalQty: 8 }],
    }))

    expect(response.status).toBe(201)
    expect(insertedHeaders[0]).toMatchObject({ branchId: 2, createdById: 7 })
  })
})
```

- [ ] **Step 2: Run submit test and confirm it fails**

Run:

```powershell
pnpm --filter backoffice exec vitest run apps/backoffice/app/api/pos/stock-opnames/route.test.ts
```

Expected: FAIL because the current route trusts `branchId` and `createdById` from the body.

- [ ] **Step 3: Harden submit route**

Modify `apps/backoffice/app/api/pos/stock-opnames/route.ts` so the body schema excludes authority fields.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { db, sql, eq, and, asc } from '@/lib/db'
import { verifyAccessToken } from '@/lib/auth'
import { getPosBranchId } from '@/lib/pos-branch'
import { stockOpnames, stockOpnameItems, productStocks, productStockBatches } from '@/lib/db'
import { calculateFIFOCost } from '@/lib/stock-adjustment'

const submitSchema = z.object({
  shiftId: z.coerce.number().int().positive().optional(),
  type: z.enum(['DAILY', 'FULL']),
  method: z.enum(['MANUAL', 'BEST_SELLER', 'SOLD_TODAY']).optional(),
  notes: z.string().max(500).optional(),
  items: z.array(z.object({
    productId: z.coerce.number().int().positive(),
    uomId: z.coerce.number().int().positive(),
    physicalQty: z.coerce.number().min(0),
    varianceReason: z.string().max(255).optional(),
  })).min(1, 'Minimal satu item harus dihitung'),
})
```

Use the shared POS auth block. Insert header with trusted values only:

```typescript
const body = await req.json()
const parsed = submitSchema.safeParse(body)
if (!parsed.success) {
  return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
}

const { shiftId, type, method, notes, items } = parsed.data

const [so] = await db.insert(stockOpnames).values({
  branchId,
  shiftId: shiftId ?? null,
  type,
  method: method ?? null,
  status: 'PENDING',
  createdById: actorId,
  notes: notes ?? null,
}).returning()
```

When calculating stock and FIFO, use `branchId` from auth only:

```typescript
const [stock] = await db.select({ quantity: productStocks.quantity })
  .from(productStocks)
  .where(and(
    eq(productStocks.branchId, branchId),
    eq(productStocks.productId, item.productId),
    eq(productStocks.uomId, item.uomId),
  ))
  .limit(1)
```

Catch block must be safe:

```typescript
console.error('POS stock opname submit error:', error)
return NextResponse.json({ error: 'Gagal menyimpan stock opname' }, { status: 500 })
```

- [ ] **Step 4: Run submit test and type diagnostics**

Run:

```powershell
pnpm --filter backoffice exec vitest run apps/backoffice/app/api/pos/stock-opnames/route.test.ts
```

Expected: PASS.

Run:

```powershell
pnpm --filter backoffice exec tsc --noEmit
```

Expected: exit code 0 or only pre-existing unrelated errors documented before continuing.

- [ ] **Step 5: Commit submit hardening**

Run:

```powershell
$env:GIT_MASTER='1'; git add apps/backoffice/app/api/pos/stock-opnames/route.ts apps/backoffice/app/api/pos/stock-opnames/route.test.ts
$env:GIT_MASTER='1'; git diff --staged --stat
$env:GIT_MASTER='1'; git commit -m "fix(pos): kunci submit stock opname" -m "Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)" -m "Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>"
```

Expected: one commit containing only the submit route and its direct test.

---

### Task 2: Harden POS Stock Opname Add Items

**Files:**

- Modify: `apps/backoffice/app/api/pos/stock-opnames/[id]/add-items/route.ts`
- Create: `apps/backoffice/app/api/pos/stock-opnames/[id]/add-items/route.test.ts`

- [ ] **Step 1: Write failing add-items tests**

Create `apps/backoffice/app/api/pos/stock-opnames/[id]/add-items/route.test.ts` with these cases:

```typescript
it('menolak stock opname dari branch lain', async () => {
  // Mock JWT branch 2, existing SO branch 9, status PENDING.
  // Call PATCH with body containing branchId 2 and one item.
  // Expect 403 and no stockOpnameItems insert.
})

it('menghitung stok memakai branch header stock opname, bukan body', async () => {
  // Mock JWT branch 2, existing SO branch 2, status PENDING.
  // Send body branchId 999.
  // Expect stock lookup condition uses branch 2.
})

it('menolak stock opname yang tidak PENDING', async () => {
  // Mock existing SO status APPROVED.
  // Expect 409 and no stockOpnameItems insert.
})
```

Use the concrete mocking style from Task 1. Import route with:

```typescript
import { PATCH } from './route'
```

Call route params with:

```typescript
await PATCH(request, { params: Promise.resolve({ id: '10' }) })
```

- [ ] **Step 2: Run add-items test and confirm it fails**

Run:

```powershell
pnpm --filter backoffice exec vitest run apps/backoffice/app/api/pos/stock-opnames/[id]/add-items/route.test.ts
```

Expected: FAIL because the current route trusts body `branchId` and does not scope by SO branch.

- [ ] **Step 3: Harden add-items route**

Modify `apps/backoffice/app/api/pos/stock-opnames/[id]/add-items/route.ts` to add POS auth, params validation, body validation, transaction lock, branch check, and safe errors.

```typescript
const paramsSchema = z.object({ id: z.coerce.number().int().positive() })
const addItemsSchema = z.object({
  items: z.array(z.object({
    productId: z.coerce.number().int().positive(),
    uomId: z.coerce.number().int().positive(),
    physicalQty: z.coerce.number().min(0),
    varianceReason: z.string().max(255).optional(),
  })).min(1, 'Minimal satu item harus ditambahkan'),
})
```

Inside transaction, lock header and use `so.branchId` for all calculations:

```typescript
const result = await db.transaction(async (tx) => {
  const [so] = await tx.select()
    .from(stockOpnames)
    .where(eq(stockOpnames.id, id))
    .for('update')
    .limit(1)

  if (!so) throw new Error('SO_NOT_FOUND')
  if (so.branchId !== branchId) throw new Error('BRANCH_FORBIDDEN')
  if (so.status !== 'PENDING') throw new Error('ALREADY_PROCESSED')

  for (const item of items) {
    const trustedBranchId = so.branchId
    // stock and FIFO queries must use trustedBranchId.
  }

  return { success: true }
})
```

Map errors:

```typescript
if (error instanceof Error) {
  if (error.message === 'SO_NOT_FOUND') return NextResponse.json({ error: 'Stock opname tidak ditemukan' }, { status: 404 })
  if (error.message === 'BRANCH_FORBIDDEN') return NextResponse.json({ error: 'Stock opname bukan milik cabang ini' }, { status: 403 })
  if (error.message === 'ALREADY_PROCESSED') return NextResponse.json({ error: 'Stock opname sudah diproses' }, { status: 409 })
}
```

- [ ] **Step 4: Run add-items test and diagnostics**

Run:

```powershell
pnpm --filter backoffice exec vitest run apps/backoffice/app/api/pos/stock-opnames/[id]/add-items/route.test.ts
pnpm --filter backoffice exec tsc --noEmit
```

Expected: both commands pass or unrelated pre-existing errors are documented.

- [ ] **Step 5: Commit add-items hardening**

Run:

```powershell
$env:GIT_MASTER='1'; git add apps/backoffice/app/api/pos/stock-opnames/[id]/add-items/route.ts apps/backoffice/app/api/pos/stock-opnames/[id]/add-items/route.test.ts
$env:GIT_MASTER='1'; git diff --staged --stat
$env:GIT_MASTER='1'; git commit -m "fix(pos): kunci item stock opname" -m "Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)" -m "Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>"
```

Expected: one commit containing only add-items route and its test.

---

### Task 3: Harden POS Stock Opname Approval and Rejection

**Files:**

- Modify: `apps/backoffice/app/api/pos/stock-opnames/[id]/approve/route.ts`
- Modify: `apps/backoffice/app/api/pos/stock-opnames/[id]/reject/route.ts`
- Create: `apps/backoffice/app/api/pos/stock-opnames/[id]/approve/route.test.ts`
- Create: `apps/backoffice/app/api/pos/stock-opnames/[id]/reject/route.test.ts`

- [ ] **Step 1: Write failing approval tests**

Create `apps/backoffice/app/api/pos/stock-opnames/[id]/approve/route.test.ts` with these cases:

```typescript
it('menolak approval tanpa sesi valid', async () => {
  // verifyAccessToken returns null.
  // Expect 401 and applySOStockAdjustment not called.
})

it('menolak approval stock opname branch lain', async () => {
  // JWT branch 2, SO branch 9, status PENDING.
  // Expect 403 and applySOStockAdjustment not called.
})

it('menolak approval stock opname yang sudah diproses', async () => {
  // JWT branch 2, SO branch 2, status APPROVED.
  // Expect 409 and applySOStockAdjustment not called.
})

it('menggunakan user JWT sebagai approvedById', async () => {
  // Body contains approvedById 999.
  // JWT userId is 7.
  // Expect update approvedById is 7 and applySOStockAdjustment currentUserId is 7.
})
```

- [ ] **Step 2: Write failing rejection tests**

Create `apps/backoffice/app/api/pos/stock-opnames/[id]/reject/route.test.ts` with these cases:

```typescript
it('menolak reject tanpa content-type JSON', async () => {
  // Auth valid, missing content-type.
  // Expect 415 and no update.
})

it('menolak reject stock opname branch lain', async () => {
  // JWT branch 2, SO branch 9.
  // Expect 403 and no update.
})

it('menggunakan user JWT sebagai rejectedById', async () => {
  // Body contains rejectedById 999 and reason.
  // JWT userId is 7.
  // Expect update rejectedById is 7.
})
```

- [ ] **Step 3: Run approval/rejection tests and confirm failures**

Run:

```powershell
pnpm --filter backoffice exec vitest run apps/backoffice/app/api/pos/stock-opnames/[id]/approve/route.test.ts apps/backoffice/app/api/pos/stock-opnames/[id]/reject/route.test.ts
```

Expected: FAIL because current routes do not authenticate or scope by branch.

- [ ] **Step 4: Harden approval route**

Modify `apps/backoffice/app/api/pos/stock-opnames/[id]/approve/route.ts` to follow the BO approval route pattern.

```typescript
const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

const result = await db.transaction(async (tx) => {
  const [so] = await tx.select()
    .from(stockOpnames)
    .where(eq(stockOpnames.id, id))
    .for('update')
    .limit(1)

  if (!so) throw new Error('SO_NOT_FOUND')
  if (so.branchId !== branchId) throw new Error('BRANCH_FORBIDDEN')
  if (so.status !== 'PENDING') throw new Error('ALREADY_PROCESSED')

  const items = await tx.select().from(stockOpnameItems).where(eq(stockOpnameItems.soId, id))
  if (items.length === 0) throw new Error('SO_HAS_NO_ITEMS')

  for (const item of items) {
    await applySOStockAdjustment(tx, {
      productId: item.productId,
      branchId: so.branchId,
      uomId: item.uomId,
      systemQty: Number(item.systemQty),
      physicalQty: Number(item.physicalQty),
      currentUserId: actorId,
    })
  }

  const [updated] = await tx.update(stockOpnames)
    .set({
      status: 'APPROVED',
      approvedById: actorId,
      approvedAt: new Date(),
      completedAt: new Date(),
    })
    .where(eq(stockOpnames.id, id))
    .returning()

  return updated
})
```

- [ ] **Step 5: Harden rejection route**

Modify `apps/backoffice/app/api/pos/stock-opnames/[id]/reject/route.ts` to require JSON, validate reason, lock header, branch-check, and use JWT actor.

```typescript
const rejectSchema = z.object({
  reason: z.string().trim().min(3, 'Alasan penolakan minimal 3 karakter').max(500),
})
```

Update with trusted actor:

```typescript
const [updated] = await tx.update(stockOpnames)
  .set({
    status: 'REJECTED',
    rejectedById: actorId,
    rejectedAt: new Date(),
    rejectionNote: reason,
    completedAt: new Date(),
  })
  .where(eq(stockOpnames.id, id))
  .returning()
```

- [ ] **Step 6: Run approval/rejection tests and diagnostics**

Run:

```powershell
pnpm --filter backoffice exec vitest run apps/backoffice/app/api/pos/stock-opnames/[id]/approve/route.test.ts apps/backoffice/app/api/pos/stock-opnames/[id]/reject/route.test.ts
pnpm --filter backoffice exec tsc --noEmit
```

Expected: both commands pass or unrelated pre-existing errors are documented.

- [ ] **Step 7: Commit approval/rejection hardening**

Run:

```powershell
$env:GIT_MASTER='1'; git add apps/backoffice/app/api/pos/stock-opnames/[id]/approve/route.ts apps/backoffice/app/api/pos/stock-opnames/[id]/approve/route.test.ts apps/backoffice/app/api/pos/stock-opnames/[id]/reject/route.ts apps/backoffice/app/api/pos/stock-opnames/[id]/reject/route.test.ts
$env:GIT_MASTER='1'; git diff --staged --stat
$env:GIT_MASTER='1'; git commit -m "fix(pos): kunci approval stock opname" -m "Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)" -m "Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>"
```

Expected: one commit containing approval/rejection mutation routes and their tests, because these two endpoints are a single approval-state transition boundary.

---

### Task 4: Harden POS Stock Opname Skip

**Files:**

- Modify: `apps/backoffice/app/api/pos/stock-opname/skip/route.ts`
- Create: `apps/backoffice/app/api/pos/stock-opname/skip/route.test.ts`

- [ ] **Step 1: Write failing skip tests**

Create `apps/backoffice/app/api/pos/stock-opname/skip/route.test.ts` with these cases:

```typescript
it('menolak skip tanpa sesi valid', async () => {
  // verifyAccessToken returns null.
  // Expect 401 and no insert.
})

it('menggunakan branch dan cashier dari JWT, bukan body', async () => {
  // Body contains branchId 999 and cashierId 999.
  // JWT branch 2 and userId 7.
  // Expect stockOpnames insert branchId 2, createdById 7, isSkipped true, status APPROVED.
})

it('menolak alasan skip kosong', async () => {
  // Body reason is blank.
  // Expect 400 and no insert.
})
```

- [ ] **Step 2: Run skip test and confirm failure**

Run:

```powershell
pnpm --filter backoffice exec vitest run apps/backoffice/app/api/pos/stock-opname/skip/route.test.ts
```

Expected: FAIL because current route trusts body branch and cashier.

- [ ] **Step 3: Harden skip route**

Modify `apps/backoffice/app/api/pos/stock-opname/skip/route.ts`.

```typescript
const skipSchema = z.object({
  shiftId: z.coerce.number().int().positive().optional(),
  reason: z.string().trim().min(3, 'Alasan skip minimal 3 karakter').max(500),
})
```

Insert with trusted branch and actor:

```typescript
const [so] = await db.insert(stockOpnames).values({
  branchId,
  shiftId: shiftId ?? null,
  type: 'DAILY',
  status: 'APPROVED',
  isSkipped: true,
  skipReason: reason,
  createdById: actorId,
  approvedById: actorId,
  approvedAt: new Date(),
  completedAt: new Date(),
}).returning()
```

Notification metadata must also use trusted IDs:

```typescript
await db.insert(notifications).values({
  type: 'STOCK_OPNAME_SKIPPED',
  branchId,
  actorId,
  title: 'Stock opname harian dilewati',
  message: reason,
})
```

If the existing `notifications` schema uses different column names, preserve the existing insert shape but replace body branch/cashier values with `branchId` and `actorId`.

- [ ] **Step 4: Run skip test and diagnostics**

Run:

```powershell
pnpm --filter backoffice exec vitest run apps/backoffice/app/api/pos/stock-opname/skip/route.test.ts
pnpm --filter backoffice exec tsc --noEmit
```

Expected: both commands pass or unrelated pre-existing errors are documented.

- [ ] **Step 5: Commit skip hardening**

Run:

```powershell
$env:GIT_MASTER='1'; git add apps/backoffice/app/api/pos/stock-opname/skip/route.ts apps/backoffice/app/api/pos/stock-opname/skip/route.test.ts
$env:GIT_MASTER='1'; git diff --staged --stat
$env:GIT_MASTER='1'; git commit -m "fix(pos): kunci skip stock opname" -m "Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)" -m "Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>"
```

Expected: one commit containing skip route and its direct test.

---

### Task 5: Harden POS Stock Opname Read Routes

**Files:**

- Modify: `apps/backoffice/app/api/pos/stock-opnames/active-full/route.ts`
- Modify: `apps/backoffice/app/api/pos/stock-opname/suggestions/route.ts`
- Create: `apps/backoffice/app/api/pos/stock-opnames/active-full/route.test.ts`
- Create: `apps/backoffice/app/api/pos/stock-opname/suggestions/route.test.ts`

- [ ] **Step 1: Write failing active-full tests**

Create `apps/backoffice/app/api/pos/stock-opnames/active-full/route.test.ts`.

```typescript
it('menolak request tanpa sesi valid', async () => {
  // verifyAccessToken returns null.
  // Expect 401.
})

it('mengabaikan query branchId dan memakai branch POS session', async () => {
  // Request URL has branchId=999.
  // getPosBranchId returns 2.
  // Expect query condition uses branch 2.
})
```

- [ ] **Step 2: Write failing suggestions tests**

Create `apps/backoffice/app/api/pos/stock-opname/suggestions/route.test.ts`.

```typescript
it('mengabaikan query branchId dan memakai branch POS session', async () => {
  // Request URL has branchId=999&method=MANUAL&q=abc.
  // getPosBranchId returns 2.
  // Expect product/stock query uses branch 2.
})

it('menolak method tidak dikenal dengan pesan Indonesia', async () => {
  // Request URL has method=UNKNOWN.
  // Expect 400 { error: 'Metode stock opname tidak valid' }.
})

it('tidak membocorkan error mentah saat query gagal', async () => {
  // Mock db select throws Error('database secret').
  // Expect 500 { error: 'Gagal mengambil rekomendasi stock opname' }.
})
```

- [ ] **Step 3: Run read-route tests and confirm failures**

Run:

```powershell
pnpm --filter backoffice exec vitest run apps/backoffice/app/api/pos/stock-opnames/active-full/route.test.ts apps/backoffice/app/api/pos/stock-opname/suggestions/route.test.ts
```

Expected: FAIL because current routes trust query `branchId`.

- [ ] **Step 4: Harden active-full route**

Modify `apps/backoffice/app/api/pos/stock-opnames/active-full/route.ts` to use POS auth and no query branch.

```typescript
const cookieStore = await cookies()
const token = cookieStore.get('accessToken')?.value
const payload = token ? await verifyAccessToken(token) : null
if (!payload) {
  return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
}
const branchId = getPosBranchId(payload, cookieStore)
```

Query only trusted branch:

```typescript
.where(and(
  eq(stockOpnames.branchId, branchId),
  eq(stockOpnames.type, 'FULL'),
  eq(stockOpnames.status, 'PENDING'),
))
```

- [ ] **Step 5: Harden suggestions route**

Modify `apps/backoffice/app/api/pos/stock-opname/suggestions/route.ts`.

```typescript
const querySchema = z.object({
  shiftId: z.coerce.number().int().positive().optional(),
  method: z.enum(['MANUAL', 'BEST_SELLER', 'SOLD_TODAY']).default('MANUAL'),
  q: z.string().trim().max(100).optional(),
})
```

Every branch filter must use trusted `branchId` from `getPosBranchId()`. For invalid query parsing:

```typescript
return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Parameter tidak valid' }, { status: 400 })
```

For safe 500:

```typescript
console.error('POS stock opname suggestions error:', error)
return NextResponse.json({ error: 'Gagal mengambil rekomendasi stock opname' }, { status: 500 })
```

- [ ] **Step 6: Run read-route tests and diagnostics**

Run:

```powershell
pnpm --filter backoffice exec vitest run apps/backoffice/app/api/pos/stock-opnames/active-full/route.test.ts apps/backoffice/app/api/pos/stock-opname/suggestions/route.test.ts
pnpm --filter backoffice exec tsc --noEmit
```

Expected: both commands pass or unrelated pre-existing errors are documented.

- [ ] **Step 7: Commit read-route hardening**

Run:

```powershell
$env:GIT_MASTER='1'; git add apps/backoffice/app/api/pos/stock-opnames/active-full/route.ts apps/backoffice/app/api/pos/stock-opnames/active-full/route.test.ts apps/backoffice/app/api/pos/stock-opname/suggestions/route.ts apps/backoffice/app/api/pos/stock-opname/suggestions/route.test.ts
$env:GIT_MASTER='1'; git diff --staged --stat
$env:GIT_MASTER='1'; git commit -m "fix(pos): scope baca stock opname" -m "Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)" -m "Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>"
```

Expected: one commit containing only POS read routes and their tests.

---

### Task 6: Harden Backoffice Stock Opname Scope

**Files:**

- Modify: `apps/backoffice/app/api/bo/stock-opnames/route.ts`
- Modify: `apps/backoffice/app/api/bo/stock-opnames/history/route.ts`
- Modify: `apps/backoffice/app/(dashboard)/inventory/stock-opname/page.tsx`
- Create: `apps/backoffice/app/api/bo/stock-opnames/route.test.ts`
- Create: `apps/backoffice/app/api/bo/stock-opnames/history/route.test.ts`

- [ ] **Step 1: Write failing BO create tests**

Create `apps/backoffice/app/api/bo/stock-opnames/route.test.ts`.

```typescript
it('menolak MANAGER membuat stock opname untuk branch lain', async () => {
  // JWT role MANAGER branchId 2.
  // Body branchId 9.
  // Expect 403 { error: 'Anda tidak memiliki akses ke cabang ini' } and no insert.
})

it('mengizinkan OWNER memilih branch target', async () => {
  // JWT role OWNER branchId 1.
  // Body branchId 9.
  // Expect insert branchId 9 and createdById from JWT.
})
```

- [ ] **Step 2: Write failing BO history tests**

Create `apps/backoffice/app/api/bo/stock-opnames/history/route.test.ts`.

```typescript
it('menolak role selain OWNER GM MANAGER', async () => {
  // JWT role KASIR.
  // Expect 403.
})

it('menolak MANAGER membaca branch lain dari query', async () => {
  // JWT role MANAGER branchId 2.
  // Query branchId=9.
  // Expect 403 { error: 'Anda tidak memiliki akses ke cabang ini' }.
})

it('membatasi MANAGER ke branch miliknya saat query branchId kosong', async () => {
  // JWT role MANAGER branchId 2.
  // No branchId query.
  // Expect query condition contains branch 2.
})

it('tidak membocorkan error mentah saat query gagal', async () => {
  // Mock db throws Error('database secret').
  // Expect 500 { error: 'Gagal mengambil riwayat stock opname' }.
})
```

- [ ] **Step 3: Run BO route tests and confirm failures**

Run:

```powershell
pnpm --filter backoffice exec vitest run apps/backoffice/app/api/bo/stock-opnames/route.test.ts apps/backoffice/app/api/bo/stock-opnames/history/route.test.ts
```

Expected: FAIL because current BO create and history do not enforce the new branch rules.

- [ ] **Step 4: Harden BO create route**

Modify `apps/backoffice/app/api/bo/stock-opnames/route.ts`.

```typescript
const targetBranchId = payload.role === 'MANAGER' ? payload.branchId : parsed.data.branchId
if (payload.role === 'MANAGER' && parsed.data.branchId !== payload.branchId) {
  return NextResponse.json({ error: 'Anda tidak memiliki akses ke cabang ini' }, { status: 403 })
}
```

Move pending check and insert into a transaction:

```typescript
const result = await db.transaction(async (trx) => {
  const existing = await trx.select({ id: stockOpnames.id })
    .from(stockOpnames)
    .where(and(
      eq(stockOpnames.branchId, targetBranchId),
      eq(stockOpnames.status, 'PENDING'),
    ))
    .limit(1)

  if (existing.length > 0) throw new Error('PENDING_EXISTS')

  const [created] = await trx.insert(stockOpnames).values({
    branchId: targetBranchId,
    type: 'FULL',
    status: 'PENDING',
    categoryScope: parsed.data.categoryScope ?? null,
    assignedUserIds: parsed.data.assignedUserIds ?? null,
    notes: parsed.data.notes ?? null,
    createdById: payload.userId,
  }).returning()

  return created
})
```

- [ ] **Step 5: Harden BO history route**

Modify `apps/backoffice/app/api/bo/stock-opnames/history/route.ts`.

```typescript
const ALLOWED_HISTORY_ROLES = ['OWNER', 'GM', 'MANAGER'] as const
if (!ALLOWED_HISTORY_ROLES.includes(payload.role as typeof ALLOWED_HISTORY_ROLES[number])) {
  return NextResponse.json({ error: 'Anda tidak memiliki akses ke riwayat stock opname' }, { status: 403 })
}

if (payload.role === 'MANAGER' && parsed.data.branchId && parsed.data.branchId !== payload.branchId) {
  return NextResponse.json({ error: 'Anda tidak memiliki akses ke cabang ini' }, { status: 403 })
}

const effectiveBranchId = payload.role === 'MANAGER' ? payload.branchId : parsed.data.branchId
```

Use `effectiveBranchId` for branch condition. Replace raw 500 with:

```typescript
console.error('BO stock opname history error:', error)
return NextResponse.json({ error: 'Gagal mengambil riwayat stock opname' }, { status: 500 })
```

- [ ] **Step 6: Scope pending page for managers**

Modify `apps/backoffice/app/(dashboard)/inventory/stock-opname/page.tsx` so the pending query uses a condition list.

```typescript
const pendingConditions = [eq(stockOpnames.status, 'PENDING')]
if (payload.role === 'MANAGER') {
  pendingConditions.push(eq(stockOpnames.branchId, payload.branchId))
}

const pendingSOs = await db.select({
  // existing select shape stays unchanged
})
  .from(stockOpnames)
  .where(and(...pendingConditions))
```

If TypeScript rejects the array type, import the Drizzle `SQL` type from `drizzle-orm` and type the array as `SQL[]`.

- [ ] **Step 7: Run BO tests and diagnostics**

Run:

```powershell
pnpm --filter backoffice exec vitest run apps/backoffice/app/api/bo/stock-opnames/route.test.ts apps/backoffice/app/api/bo/stock-opnames/history/route.test.ts
pnpm --filter backoffice exec tsc --noEmit
```

Expected: both commands pass or unrelated pre-existing errors are documented.

- [ ] **Step 8: Commit BO scope hardening**

Run:

```powershell
$env:GIT_MASTER='1'; git add apps/backoffice/app/api/bo/stock-opnames/route.ts apps/backoffice/app/api/bo/stock-opnames/route.test.ts apps/backoffice/app/api/bo/stock-opnames/history/route.ts apps/backoffice/app/api/bo/stock-opnames/history/route.test.ts apps/backoffice/app/(dashboard)/inventory/stock-opname/page.tsx
$env:GIT_MASTER='1'; git diff --staged --stat
$env:GIT_MASTER='1'; git commit -m "fix(stock): scope stock opname backoffice" -m "Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)" -m "Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>"
```

Expected: one commit containing BO route/page scope changes and direct route tests.

---

### Task 7: Update Changelog and Run Full Verification

**Files:**

- Modify: `apps/backoffice/CHANGELOG.md`

- [ ] **Step 1: Add changelog entry**

Add a new top entry using the existing changelog format.

```markdown
## [x.y.z] - 2026-06-11

### Fixed

- Mengunci flow stock opname POS agar branch dan aktor selalu berasal dari sesi tepercaya.
- Membatasi akses stock opname backoffice agar MANAGER hanya dapat membuat dan membaca data cabangnya sendiri.
- Mengamankan approval, reject, skip, dan pembacaan stock opname dari spoofing branch serta kebocoran pesan error mentah.
```

Use the next patch version according to the existing top version in `apps/backoffice/CHANGELOG.md`.

- [ ] **Step 2: Run all targeted route tests**

Run:

```powershell
pnpm --filter backoffice exec vitest run apps/backoffice/app/api/pos/stock-opnames/route.test.ts apps/backoffice/app/api/pos/stock-opnames/[id]/add-items/route.test.ts apps/backoffice/app/api/pos/stock-opnames/[id]/approve/route.test.ts apps/backoffice/app/api/pos/stock-opnames/[id]/reject/route.test.ts apps/backoffice/app/api/pos/stock-opname/skip/route.test.ts apps/backoffice/app/api/pos/stock-opnames/active-full/route.test.ts apps/backoffice/app/api/pos/stock-opname/suggestions/route.test.ts apps/backoffice/app/api/bo/stock-opnames/route.test.ts apps/backoffice/app/api/bo/stock-opnames/history/route.test.ts
```

Expected: all targeted tests pass.

- [ ] **Step 3: Run project checks**

Run:

```powershell
pnpm --filter backoffice exec tsc --noEmit
pnpm --filter backoffice lint
```

Expected: both commands pass. If they fail due to pre-existing unrelated issues, capture exact file/error lines and keep the hardening diff clean.

- [ ] **Step 4: Inspect final diff for forbidden patterns**

Run:

```powershell
rg "as any|@ts-ignore|@ts-expect-error|error\.message|Missing required|Invalid method" apps/backoffice/app/api/pos/stock-opname apps/backoffice/app/api/pos/stock-opnames apps/backoffice/app/api/bo/stock-opnames apps/backoffice/app/\(dashboard\)/inventory/stock-opname apps/backoffice/CHANGELOG.md
```

Expected: no matches for new unsafe code. If existing safe `console.error(..., error)` appears, it is acceptable; client responses must not expose `error.message`.

- [ ] **Step 5: Commit changelog**

Run:

```powershell
$env:GIT_MASTER='1'; git add apps/backoffice/CHANGELOG.md
$env:GIT_MASTER='1'; git diff --staged --stat
$env:GIT_MASTER='1'; git commit -m "docs(changelog): catat hardening stock opname" -m "Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)" -m "Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>"
```

Expected: one changelog-only commit.

- [ ] **Step 6: Final git verification**

Run:

```powershell
$env:GIT_MASTER='1'; git status --porcelain=v1
$env:GIT_MASTER='1'; git log --oneline -10
```

Expected: clean status and recent commits show focused hardening commits.

---

## Spec Coverage Checklist

- POS submit derives branch and actor from trusted session: Task 1.
- POS add-items enforces same branch and uses SO header branch for calculations: Task 2.
- POS approve locks row, checks status, checks branch, uses JWT actor, and prevents double mutation: Task 3.
- POS reject locks row, checks branch/status, validates reason, and uses JWT actor: Task 3.
- POS skip derives branch/cashier from session and validates reason: Task 4.
- POS active-full and suggestions ignore query branch and use safe Indonesian errors: Task 5.
- BO create prevents MANAGER cross-branch creation and keeps OWNER branch selection: Task 6.
- BO history role-gates and prevents MANAGER cross-branch reads: Task 6.
- Pending stock opname page aligns MANAGER branch scope with API: Task 6.
- Changelog updated in Indonesian for the bugfix: Task 7.
- Targeted tests, TypeScript, lint, and unsafe-pattern scan are required before completion: Task 7.

## Out of Scope

- Database migrations or new unique indexes for pending stock opname.
- Refactoring all POS auth into a shared library.
- Changing stock adjustment math in `apps/backoffice/lib/stock-adjustment.ts`.
- Creating a PR automatically.
