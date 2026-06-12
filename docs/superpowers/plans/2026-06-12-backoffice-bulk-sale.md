<!-- markdownlint-disable MD013 -->

# Backoffice Bulk Sale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a backoffice bulk sale transaction page that supports required customer and branch selection, fast multi-product entry, nominal item discounts, persisted POS-style transaction creation, receipt printing, and delivery note printing.

**Architecture:** Add a focused bulk sale feature under dashboard transactions. Keep calculations in a small tested helper, keep API validation/auth/shift resolution in the BO route, reuse `TransactionService.createTransaction`, and build the UI from the existing internal-order keyboard flow plus POS pricing data shape.

**Tech Stack:** Next.js App Router, React 19 client components, TypeScript, Zod, Drizzle ORM, Big.js, Vitest, existing backoffice auth and transaction service.

---

## File Structure

- Create: `apps/backoffice/app/(dashboard)/transactions/bulk-sale/page.tsx` - server page that fetches initial branches/payment methods and renders the client.
- Create: `apps/backoffice/app/(dashboard)/transactions/bulk-sale/_components/types.ts` - local UI and API-facing types.
- Create: `apps/backoffice/app/(dashboard)/transactions/bulk-sale/_components/bulk-sale-calculations.ts` - integer/Big.js calculation helpers and validation helpers.
- Create: `apps/backoffice/app/(dashboard)/transactions/bulk-sale/_components/bulk-sale-calculations.test.ts` - helper tests.
- Create: `apps/backoffice/app/(dashboard)/transactions/bulk-sale/_components/bulk-sale-client.tsx` - main low-click bulk sale UI.
- Create: `apps/backoffice/app/(dashboard)/transactions/bulk-sale/_components/bulk-sale-item-row.tsx` - compact row editor with focus handoff.
- Create: `apps/backoffice/app/(dashboard)/transactions/bulk-sale/_components/bulk-sale-delivery-note-print.tsx` - print-only surat jalan component.
- Create: `apps/backoffice/app/api/bo/bulk-sales/route.ts` - authenticated BO transaction creation endpoint.
- Create: `apps/backoffice/app/api/bo/bulk-sales/route.test.ts` - route validation/auth/shift tests with mocks.
- Create: `apps/backoffice/app/api/bo/bulk-sale-products/route.ts` - branch-explicit product search endpoint with POS-compatible response shape.
- Modify: `apps/backoffice/app/(dashboard)/_components/sidebar.tsx` - add bulk sale navigation under Transaksi.
- Modify: `apps/backoffice/CHANGELOG.md` - add Indonesian feature entry.

## Task 1: Calculation Helper

**Files:**
- Create: `apps/backoffice/app/(dashboard)/transactions/bulk-sale/_components/types.ts`
- Create: `apps/backoffice/app/(dashboard)/transactions/bulk-sale/_components/bulk-sale-calculations.ts`
- Create: `apps/backoffice/app/(dashboard)/transactions/bulk-sale/_components/bulk-sale-calculations.test.ts`

- [ ] **Step 1: Write the failing calculation tests**

Create `bulk-sale-calculations.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { calculateBulkSaleTotals, calculateRowSubtotal } from "./bulk-sale-calculations";
import type { BulkSaleRow } from "./types";

function row(overrides: Partial<BulkSaleRow> = {}): BulkSaleRow {
  return {
    id: "row-1",
    productId: 1,
    productCode: "SKU-1",
    productName: "Produk A",
    uomId: 1,
    uomCode: "PCS",
    availableUoms: [{ uomId: 1, uomCode: "PCS", conversionRate: 1 }],
    priceTier: "RETAIL",
    availablePrices: [{ uomId: 1, priceTier: "RETAIL", price: 10000 }],
    qty: 2,
    unitPrice: 10000,
    discountAmount: 3000,
    subtotal: 17000,
    ...overrides,
  };
}

describe("bulk sale calculations", () => {
  it("calculates row subtotal with nominal discount", () => {
    expect(calculateRowSubtotal({ qty: 2, unitPrice: 10000, discountAmount: 3000 })).toBe(17000);
  });

  it("rejects discount greater than gross row amount", () => {
    expect(() =>
      calculateRowSubtotal({ qty: 2, unitPrice: 10000, discountAmount: 25000 }),
    ).toThrow("Diskon tidak boleh lebih besar dari subtotal bruto");
  });

  it("calculates transaction totals and change", () => {
    expect(calculateBulkSaleTotals([row(), row({ id: "row-2", discountAmount: 0, subtotal: 20000 })], 50000)).toEqual({
      subtotal: 40000,
      discountTotal: 3000,
      grandTotal: 37000,
      amountPaid: 50000,
      change: 13000,
      itemCount: 4,
    });
  });
});
```

- [ ] **Step 2: Run the failing helper test**

Run:

```bash
pnpm --filter backoffice exec vitest run "app/(dashboard)/transactions/bulk-sale/_components/bulk-sale-calculations.test.ts"
```

Expected: FAIL because the helper files do not exist.

- [ ] **Step 3: Create the local types**

Create `types.ts`:

```typescript
export type BulkSaleUomOption = {
  uomId: number;
  uomCode: string;
  conversionRate: number;
};

export type BulkSalePriceOption = {
  uomId: number;
  priceTier: string;
  price: number;
};

export type BulkSaleProduct = {
  id: number;
  code: string;
  name: string;
  barcode: string | null;
  baseUomId: number;
  baseUomCode: string;
  stock: number;
  availableUoms: BulkSaleUomOption[];
  prices: BulkSalePriceOption[];
};

export type BulkSaleRow = {
  id: string;
  productId: number;
  productCode: string;
  productName: string;
  uomId: number;
  uomCode: string;
  availableUoms: BulkSaleUomOption[];
  priceTier: string;
  availablePrices: BulkSalePriceOption[];
  qty: number;
  unitPrice: number;
  discountAmount: number;
  subtotal: number;
};

export type BulkSaleTotals = {
  subtotal: number;
  discountTotal: number;
  grandTotal: number;
  amountPaid: number;
  change: number;
  itemCount: number;
};
```

- [ ] **Step 4: Implement calculation helpers**

Create `bulk-sale-calculations.ts`:

```typescript
import Big from "big.js";
import type { BulkSaleRow, BulkSaleTotals } from "./types";

type RowInput = {
  qty: number;
  unitPrice: number;
  discountAmount: number;
};

function assertNonNegativeInteger(value: number, field: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} harus berupa angka bulat minimal 0`);
  }
}

export function calculateRowSubtotal(input: RowInput) {
  if (!Number.isInteger(input.qty) || input.qty <= 0) {
    throw new Error("Qty harus berupa angka bulat positif");
  }
  if (!Number.isInteger(input.unitPrice) || input.unitPrice <= 0) {
    throw new Error("Harga harus berupa angka bulat positif");
  }
  assertNonNegativeInteger(input.discountAmount, "Diskon");

  const gross = new Big(input.qty).times(input.unitPrice);
  const discount = new Big(input.discountAmount);

  if (discount.gt(gross)) {
    throw new Error("Diskon tidak boleh lebih besar dari subtotal bruto");
  }

  return Number(gross.minus(discount).toFixed(0));
}

export function calculateBulkSaleTotals(rows: BulkSaleRow[], amountPaid: number): BulkSaleTotals {
  assertNonNegativeInteger(amountPaid, "Jumlah bayar");

  const subtotal = rows.reduce((total, row) => total.plus(new Big(row.qty).times(row.unitPrice)), new Big(0));
  const discountTotal = rows.reduce((total, row) => total.plus(row.discountAmount), new Big(0));
  const grandTotal = subtotal.minus(discountTotal);
  const itemCount = rows.reduce((total, row) => total + row.qty, 0);

  return {
    subtotal: Number(subtotal.toFixed(0)),
    discountTotal: Number(discountTotal.toFixed(0)),
    grandTotal: Number(grandTotal.toFixed(0)),
    amountPaid,
    change: Number(new Big(amountPaid).minus(grandTotal).toFixed(0)),
    itemCount,
  };
}
```

- [ ] **Step 5: Run helper test until passing**

Run:

```bash
pnpm --filter backoffice exec vitest run "app/(dashboard)/transactions/bulk-sale/_components/bulk-sale-calculations.test.ts"
```

Expected: PASS.

## Task 2: Bulk Sale API Route

**Files:**
- Create: `apps/backoffice/app/api/bo/bulk-sales/route.ts`
- Create: `apps/backoffice/app/api/bo/bulk-sales/route.test.ts`

- [ ] **Step 1: Write route tests for required customer, branch access, payment, and shift resolution**

Create `route.test.ts` using the existing route-test mocking style:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyAccessToken = vi.fn();
const createTransaction = vi.fn();
const eq = vi.fn((left, right) => ({ left, right, op: "eq" }));
const and = vi.fn((...conditions) => ({ conditions, op: "and" }));

const cookieStore = { get: vi.fn(() => ({ value: "token" })) };

const db = {
  query: {
    shifts: {
      findMany: vi.fn(),
    },
  },
};

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("@/lib/auth", () => ({ verifyAccessToken }));
vi.mock("@/lib/services/transaction-service", () => ({ TransactionService: { createTransaction } }));
vi.mock("@/lib/db", () => ({
  db,
  shifts: { id: "shifts.id", branchId: "shifts.branchId", status: "shifts.status" },
  eq,
  and,
}));

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    branchId: 2,
    customerId: 11,
    paymentMethodId: 1,
    amountPaid: 20000,
    items: [
      {
        productId: 1,
        productName: "Produk A",
        uomId: 1,
        uomCode: "PCS",
        qty: 2,
        unitPrice: 10000,
        priceTier: "RETAIL",
        discountAmount: 3000,
        subtotal: 17000,
      },
    ],
    totals: {
      subtotal: 20000,
      discountTotal: 3000,
      grandTotal: 17000,
      itemCount: 2,
    },
    change: 3000,
    ...overrides,
  };
}

function jsonRequest(body: unknown) {
  return new Request("http://test.local/api/bo/bulk-sales", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/bo/bulk-sales", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    cookieStore.get.mockReturnValue({ value: "token" });
    verifyAccessToken.mockResolvedValue({
      userId: 7,
      userName: "Manager",
      branchId: 2,
      branchName: "Pusat",
      role: "MANAGER",
      permissions: [],
    });
    db.query.shifts.findMany.mockResolvedValue([{ id: 10, branchId: 2, status: "OPEN" }]);
    createTransaction.mockResolvedValue({ id: 99, trxNumber: "TRX-20260612-0001" });
  });

  it("requires customerId", async () => {
    const { POST } = await import("./route");
    const res = await POST(jsonRequest(validPayload({ customerId: null })));

    expect(res.status).toBe(400);
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("rejects branch outside non-global JWT branch", async () => {
    const { POST } = await import("./route");
    const res = await POST(jsonRequest(validPayload({ branchId: 3 })));

    expect(res.status).toBe(403);
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("rejects payment below grand total", async () => {
    const { POST } = await import("./route");
    const res = await POST(jsonRequest(validPayload({ amountPaid: 10000, change: 0 })));

    expect(res.status).toBe(400);
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("rejects branch with no active shift", async () => {
    db.query.shifts.findMany.mockResolvedValue([]);
    const { POST } = await import("./route");
    const res = await POST(jsonRequest(validPayload()));

    expect(res.status).toBe(400);
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("rejects branch with multiple active shifts", async () => {
    db.query.shifts.findMany.mockResolvedValue([
      { id: 10, branchId: 2, status: "OPEN" },
      { id: 11, branchId: 2, status: "OPEN" },
    ]);
    const { POST } = await import("./route");
    const res = await POST(jsonRequest(validPayload()));

    expect(res.status).toBe(409);
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("creates transaction using JWT cashier and resolved shift", async () => {
    const { POST } = await import("./route");
    const res = await POST(jsonRequest(validPayload()));

    expect(res.status).toBe(201);
    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 2, cashierId: 7, shiftId: 10, customerId: 11 }),
    );
  });
});
```

- [ ] **Step 2: Run route test to verify it fails**

Run:

```bash
pnpm --filter backoffice exec vitest run app/api/bo/bulk-sales/route.test.ts
```

Expected: FAIL because route does not exist.

- [ ] **Step 3: Implement the route**

Create `route.ts` with auth, content-type check, Zod validation, branch access, shift resolution, and `TransactionService.createTransaction` call. Use Indonesian errors and do not trust actor fields from body.

Core implementation shape:

```typescript
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAccessToken } from "@/lib/auth";
import { and, db, eq, shifts } from "@/lib/db";
import { TransactionService } from "@/lib/services/transaction-service";

const ALLOWED_ROLES = ["OWNER", "GM", "MANAGER"] as const;
const GLOBAL_ROLES = ["OWNER", "GM"] as const;

const itemSchema = z.object({
  productId: z.number().int().positive(),
  productName: z.string().min(1),
  uomId: z.number().int().positive(),
  uomCode: z.string().min(1),
  qty: z.number().int().positive(),
  unitPrice: z.number().int().positive(),
  priceTier: z.string().min(1),
  discountAmount: z.number().int().min(0),
  subtotal: z.number().int().min(0),
});

const payloadSchema = z.object({
  branchId: z.number().int().positive(),
  customerId: z.number().int().positive({ message: "Customer wajib dipilih" }),
  paymentMethodId: z.number().int().positive(),
  amountPaid: z.number().int().min(0),
  change: z.number().int().min(0),
  items: z.array(itemSchema).min(1, "Minimal satu produk harus dipilih"),
  totals: z.object({
    subtotal: z.number().int().min(0),
    discountTotal: z.number().int().min(0),
    grandTotal: z.number().int().min(0),
    itemCount: z.number().int().positive(),
  }),
});

function isGlobalRole(role: string) {
  return GLOBAL_ROLES.includes(role as (typeof GLOBAL_ROLES)[number]);
}

export async function POST(request: Request) {
  try {
    if (!request.headers.get("content-type")?.includes("application/json")) {
      return NextResponse.json({ error: "Content-Type harus application/json" }, { status: 415 });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get("accessToken")?.value;
    const payload = token ? await verifyAccessToken(token) : null;

    if (!payload) {
      return NextResponse.json({ error: "Sesi tidak valid, silakan login kembali" }, { status: 401 });
    }

    if (!ALLOWED_ROLES.includes(payload.role as (typeof ALLOWED_ROLES)[number])) {
      return NextResponse.json({ error: "Role tidak memiliki akses membuat bulk sale" }, { status: 403 });
    }

    const parsed = payloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid" }, { status: 400 });
    }

    const body = parsed.data;
    if (!isGlobalRole(payload.role) && body.branchId !== payload.branchId) {
      return NextResponse.json({ error: "Anda tidak memiliki akses ke cabang transaksi ini" }, { status: 403 });
    }

    const calculatedGross = body.items.reduce((total, item) => total + item.qty * item.unitPrice, 0);
    const calculatedDiscount = body.items.reduce((total, item) => total + item.discountAmount, 0);
    const calculatedGrandTotal = body.items.reduce((total, item) => total + item.subtotal, 0);

    if (body.items.some((item) => item.discountAmount > item.qty * item.unitPrice)) {
      return NextResponse.json({ error: "Diskon item tidak boleh lebih besar dari subtotal bruto" }, { status: 400 });
    }

    if (
      calculatedGross !== body.totals.subtotal ||
      calculatedDiscount !== body.totals.discountTotal ||
      calculatedGrandTotal !== body.totals.grandTotal
    ) {
      return NextResponse.json({ error: "Total transaksi tidak sesuai dengan item" }, { status: 400 });
    }

    if (body.amountPaid < body.totals.grandTotal) {
      return NextResponse.json({ error: "Jumlah bayar kurang dari total transaksi" }, { status: 400 });
    }

    const activeShifts = await db.query.shifts.findMany({
      where: and(eq(shifts.branchId, body.branchId), eq(shifts.status, "OPEN")),
    });

    if (activeShifts.length === 0) {
      return NextResponse.json({ error: "Tidak ada shift aktif untuk cabang transaksi" }, { status: 400 });
    }

    if (activeShifts.length > 1) {
      return NextResponse.json({ error: "Ada lebih dari satu shift aktif, pilih shift di POS terlebih dahulu" }, { status: 409 });
    }

    const transaction = await TransactionService.createTransaction({
      branchId: body.branchId,
      shiftId: activeShifts[0].id,
      cashierId: payload.userId,
      customerId: body.customerId,
      items: body.items,
      payments: [{ paymentMethodId: body.paymentMethodId, amount: body.amountPaid, referenceNumber: null }],
      totals: body.totals,
      amountPaid: body.amountPaid,
      change: body.amountPaid - body.totals.grandTotal,
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error("Bulk sale error:", error);
    return NextResponse.json({ error: "Gagal membuat transaksi bulk sale" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run route test until passing**

Run:

```bash
pnpm --filter backoffice exec vitest run app/api/bo/bulk-sales/route.test.ts
```

Expected: PASS.

## Task 3: Branch-Explicit Product Search API

**Files:**
- Create: `apps/backoffice/app/api/bo/bulk-sale-products/route.ts`

- [ ] **Step 1: Inspect POS product route before implementation**

Read `apps/backoffice/app/api/pos/products/route.ts`. Copy the response shape, but replace POS branch cookie resolution with explicit `branchId` query validation and BO role/branch access.

- [ ] **Step 2: Implement BO product search route**

Create `route.ts` with this behavior:

- Require valid `accessToken`.
- Allow `OWNER`, `GM`, and `MANAGER`.
- Read `branchId`, `search`, `barcode`, and `limit` from query.
- For non-global roles, reject `branchId` that differs from `payload.branchId`.
- Return products with `id`, `code`, `name`, `barcode`, `baseUomId`, `baseUomCode`, `stock`, `prices`, `conversions`, and mapped `availableUoms` compatible with UI type.
- Use Indonesian error shape `{ error: string }`.

Use the same Drizzle imports and joins as `/api/pos/products`, scoped to the selected branch. Do not alter the POS route unless extraction is truly smaller than duplication.

- [ ] **Step 3: Smoke-check the product route types**

Run:

```bash
pnpm --filter backoffice exec tsc --noEmit --pretty false
```

Expected: no TypeScript errors from the new route. If the project has unrelated existing errors, record them and continue only if new files are clean via LSP diagnostics.

## Task 4: Bulk Sale Page and Client UI

**Files:**
- Create: `apps/backoffice/app/(dashboard)/transactions/bulk-sale/page.tsx`
- Create: `apps/backoffice/app/(dashboard)/transactions/bulk-sale/_components/bulk-sale-client.tsx`
- Create: `apps/backoffice/app/(dashboard)/transactions/bulk-sale/_components/bulk-sale-item-row.tsx`

- [ ] **Step 1: Inspect internal order client and item row**

Read:

- `apps/backoffice/app/pos/(authenticated)/internal-order/_components/internal-order-client.tsx`
- `apps/backoffice/app/pos/(authenticated)/internal-order/_components/item-row.tsx`

Use the same keyboard search and focus patterns, but do not import POS authenticated components into dashboard code.

- [ ] **Step 2: Create server page**

Implement `page.tsx` to fetch allowed branches and payment methods using existing `db` imports. Verify auth from cookie and redirect/login pattern by following nearby dashboard pages. Pass `currentUser`, `branches`, and `paymentMethods` to `BulkSaleClient`.

- [ ] **Step 3: Create item row component**

Implement `bulk-sale-item-row.tsx` as a client component with props:

```typescript
type BulkSaleItemRowProps = {
  row: BulkSaleRow;
  onChange: (row: BulkSaleRow) => void;
  onRemove: () => void;
  onLastFieldTab: () => void;
};
```

Use `forwardRef<HTMLInputElement, BulkSaleItemRowProps>` to focus qty after adding a product. UOM select updates `uomId/uomCode`, filters price options, picks first valid tier, recalculates `unitPrice`, and recomputes subtotal with `calculateRowSubtotal`. Price tier select updates `priceTier/unitPrice/subtotal`. Discount and price inputs are integer-only.

- [ ] **Step 4: Create main client component**

Implement `bulk-sale-client.tsx` with:

- `use client` first line.
- Customer search/selection, branch selector, payment method selector, amount paid input.
- Product search calling `/api/bo/bulk-sale-products?branchId=${branchId}&search=${query}&limit=8`.
- ArrowUp/ArrowDown/Enter/Escape handling.
- `addProduct(product)` creates a row using the product base UOM, first valid price tier, qty 1, discount 0, and calculated subtotal.
- Focus newly added row qty input.
- Submit calls `/api/bo/bulk-sales` with branch, customer, items, totals, payment method, amount paid, and change.
- On success, store transaction response for print actions and show success message.

- [ ] **Step 5: Run UI diagnostics**

Run LSP diagnostics on:

- `apps/backoffice/app/(dashboard)/transactions/bulk-sale/page.tsx`
- `apps/backoffice/app/(dashboard)/transactions/bulk-sale/_components/bulk-sale-client.tsx`
- `apps/backoffice/app/(dashboard)/transactions/bulk-sale/_components/bulk-sale-item-row.tsx`
- `apps/backoffice/app/(dashboard)/transactions/bulk-sale/_components/types.ts`
- `apps/backoffice/app/(dashboard)/transactions/bulk-sale/_components/bulk-sale-calculations.ts`

Expected: no diagnostics in changed files.

## Task 5: Print Components

**Files:**
- Create: `apps/backoffice/app/(dashboard)/transactions/bulk-sale/_components/bulk-sale-delivery-note-print.tsx`
- Modify: `apps/backoffice/app/(dashboard)/transactions/bulk-sale/_components/bulk-sale-client.tsx`

- [ ] **Step 1: Inspect existing print components**

Read:

- `apps/backoffice/components/pos/receipt-print.tsx`
- `apps/backoffice/app/(dashboard)/purchase-orders/internal/[id]/_components/internal-transfer-detail-client.tsx`

- [ ] **Step 2: Create delivery note print component**

Create a print-only component with props:

```typescript
type BulkSaleDeliveryNotePrintProps = {
  transactionNumber: string;
  transactionDate: string;
  branchName: string;
  customerName: string;
  items: BulkSaleRow[];
};
```

Render a Surat Jalan title, transaction/customer/branch/date metadata, table of product code/name/UOM/qty, and signature blocks. Add print CSS using a unique wrapper class, following receipt-print isolation.

- [ ] **Step 3: Wire receipt and delivery note buttons**

In `bulk-sale-client.tsx`, after successful submit:

- Render `ReceiptPrint` with adapted rows.
- Render `BulkSaleDeliveryNotePrint` with transaction response and selected customer/branch.
- Add `Cetak Struk` and `Cetak Surat Jalan` buttons that call `window.print()` after setting the active print mode.

- [ ] **Step 4: Run print diagnostics**

Run LSP diagnostics on changed print/client files. Expected: no diagnostics.

## Task 6: Navigation and Changelog

**Files:**
- Modify: `apps/backoffice/app/(dashboard)/_components/sidebar.tsx`
- Modify: `apps/backoffice/CHANGELOG.md`

- [ ] **Step 1: Add sidebar link**

Add a Transaksi child/link to `/transactions/bulk-sale` with Indonesian label `Bulk Sale`. Keep existing sidebar structure and icon style.

- [ ] **Step 2: Update changelog**

At the top of `apps/backoffice/CHANGELOG.md`, add a new dated version entry in Bahasa Indonesia:

```markdown
## [x.y.z] - 2026-06-12

### Added

- Menambahkan halaman Bulk Sale di backoffice untuk input transaksi penjualan banyak produk dengan pilihan customer, branch, UOM, tier harga, diskon nominal, cetak struk, dan cetak surat jalan.
```

Pick the next patch version based on the current top entry. Do not duplicate an existing version.

- [ ] **Step 3: Run diagnostics on touched files**

Run LSP diagnostics on `sidebar.tsx`. Read the changelog after edit to verify format.

## Task 7: Final Verification

**Files:**
- All changed files from Tasks 1-6.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
pnpm --filter backoffice exec vitest run "app/(dashboard)/transactions/bulk-sale/_components/bulk-sale-calculations.test.ts" app/api/bo/bulk-sales/route.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run typecheck/build-level verification**

Run:

```bash
pnpm typecheck
```

Expected: PASS or only pre-existing unrelated errors. If errors are from touched files, fix them before completion.

- [ ] **Step 3: Run lint if typecheck passes or errors are unrelated**

Run:

```bash
pnpm --filter backoffice lint
```

Expected: PASS or only pre-existing unrelated warnings/errors. If lint errors are from touched files, fix them.

- [ ] **Step 4: Manual browser QA if app can run**

Run backoffice:

```bash
pnpm dev:backoffice
```

Open `/transactions/bulk-sale` and verify:

- Page loads for an authenticated dashboard user.
- Branch selector follows role scope.
- Product search returns branch-specific products.
- Enter adds a row and focuses qty.
- UOM/tier/price/discount updates totals.
- Submit rejects missing customer.
- Valid submit creates a transaction when branch has exactly one open shift.
- Print buttons show the correct struk and surat jalan layouts.

If authentication or database credentials prevent browser QA, document the blocker and rely on tests, diagnostics, and typecheck.

## Self-Review

- Spec coverage: The plan covers page/client, branch/customer requirements, fast product UX, UOM/tier/price/discount, API persistence through `TransactionService`, shift strategy, receipt print, delivery note print, tests, sidebar, and changelog.
- Placeholder scan: No placeholder tasks remain; each implementation task has exact files and expected behavior.
- Type consistency: `BulkSaleRow`, `BulkSaleProduct`, `BulkSaleTotals`, `calculateRowSubtotal`, and `calculateBulkSaleTotals` are defined before use and reused consistently.
