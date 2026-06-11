<!-- markdownlint-disable MD013 -->

# Backoffice POS Receiving Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden POS purchase-order receiving so branch, actor, PO item, and receiving quantity are validated server-side.

**Architecture:** Keep the fix inside the existing route boundary. The route authenticates with the cookie JWT, resolves the POS branch from session cookies, validates body with Zod, and performs all PO/item checks inside the DB transaction before inserting receiving rows.

**Tech Stack:** Next.js App Router route handlers, TypeScript, Zod, Drizzle ORM, Vitest.

---

## File Map

- Modify: `apps/backoffice/app/api/pos/purchase-orders/[id]/receive/route.ts`
- Create: `apps/backoffice/app/api/pos/purchase-orders/[id]/receive/route.test.ts`
- Modify: `apps/backoffice/CHANGELOG.md`

## Task 1: Add Receiving Route Regression Tests

**Files:**

- Create: `apps/backoffice/app/api/pos/purchase-orders/[id]/receive/route.test.ts`

- [ ] **Step 1: Write failing tests**

Create a Vitest file that mocks auth, cookies, and the DB transaction chain.

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const verifyAccessToken = vi.fn();
const cookieStore = {
  get: vi.fn((name: string) => {
    if (name === "accessToken") return { value: "token" };
    return undefined;
  }),
};

const insertValues = vi.fn();
const updateWhere = vi.fn();
const transaction = vi.fn();
const findPo = vi.fn();
const selectLimit = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

vi.mock("@/lib/auth", () => ({ verifyAccessToken }));

vi.mock("@/lib/pos-branch", () => ({
  getPosBranchId: vi.fn(() => 2),
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      purchaseOrders: { findFirst: findPo },
    },
    transaction,
  },
  purchaseOrders: {
    id: "purchaseOrders.id",
    branchId: "purchaseOrders.branchId",
    status: "purchaseOrders.status",
  },
  purchaseOrderItems: {
    id: "purchaseOrderItems.id",
    poId: "purchaseOrderItems.poId",
    qtyReceived: "purchaseOrderItems.qtyReceived",
    qtyDamaged: "purchaseOrderItems.qtyDamaged",
    expiryDate: "purchaseOrderItems.expiryDate",
  },
  poReceivingLogs: "poReceivingLogs",
  poReceivingItems: "poReceivingItems",
  eq: vi.fn((field, value) => ({ type: "eq", field, value })),
  and: vi.fn((...conditions) => ({ type: "and", conditions })),
  sql: vi.fn((strings, ...values) => ({ strings, values })),
}));

function request(body: Record<string, unknown>) {
  return new NextRequest(
    "http://localhost/api/pos/purchase-orders/10/receive",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    receivedById: 999,
    invoiceReceived: true,
    note: "diterima",
    items: [
      {
        poItemId: 50,
        qtyReceived: 2,
        qtyDamaged: 0,
        expiryDate: null,
        note: null,
      },
    ],
    ...overrides,
  };
}

describe("POST /api/pos/purchase-orders/[id]/receive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyAccessToken.mockResolvedValue({
      userId: 7,
      branchId: 2,
      role: "MANAGER",
      permissions: [],
    });
    findPo.mockResolvedValue({ id: 10, branchId: 2, status: "APPROVED" });
    selectLimit.mockResolvedValue([
      { id: 50, poId: 10, qtyOrdered: 5, qtyReceived: 1, qtyDamaged: 0 },
    ]);
    insertValues.mockReturnValue({
      returning: vi.fn(async () => [{ id: 123 }]),
    });
    updateWhere.mockResolvedValue(undefined);
    transaction.mockImplementation(async (callback) =>
      callback({
        insert: vi.fn(() => ({ values: insertValues })),
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: selectLimit })),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({ where: updateWhere })),
        })),
      }),
    );
  });

  it("uses JWT userId instead of body receivedById", async () => {
    const { POST } = await import("./route");

    const res = await POST(request(validBody()), {
      params: Promise.resolve({ id: "10" }),
    });

    expect(res.status).toBe(200);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ poId: 10, receivedById: 7 }),
    );
  });

  it("rejects item that does not belong to the route PO", async () => {
    selectLimit.mockResolvedValueOnce([]);
    const { POST } = await import("./route");

    const res = await POST(request(validBody()), {
      params: Promise.resolve({ id: "10" }),
    });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain("Item PO");
    expect(updateWhere).not.toHaveBeenCalled();
  });

  it("rejects quantity above remaining item quantity", async () => {
    const { POST } = await import("./route");

    const res = await POST(
      request(
        validBody({
          items: [{ poItemId: 50, qtyReceived: 10, qtyDamaged: 0 }],
        }),
      ),
      {
        params: Promise.resolve({ id: "10" }),
      },
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("melebihi sisa");
    expect(updateWhere).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests and verify red**

Run:

```bash
pnpm exec vitest run apps/backoffice/app/api/pos/purchase-orders/[id]/receive/route.test.ts --config apps/backoffice/vitest.config.ts
```

Expected: at least the actor spoof or item ownership test fails against the current route.

## Task 2: Harden POS Receiving Route

**Files:**

- Modify: `apps/backoffice/app/api/pos/purchase-orders/[id]/receive/route.ts`
- Test: `apps/backoffice/app/api/pos/purchase-orders/[id]/receive/route.test.ts`

- [ ] **Step 1: Add route-local auth and schema**

Update imports and add Zod schema:

```ts
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAccessToken } from "@/lib/auth";
import {
  db,
  purchaseOrders,
  purchaseOrderItems,
  poReceivingLogs,
  poReceivingItems,
  eq,
  and,
  sql,
} from "@/lib/db";
import { getPosBranchId } from "@/lib/pos-branch";

const receivingSchema = z.object({
  receivedById: z.number().int().positive().optional(),
  invoiceReceived: z.boolean().optional(),
  note: z.string().max(1000).nullable().optional(),
  items: z
    .array(
      z.object({
        poItemId: z.number().int().positive(),
        qtyReceived: z.number().int().nonnegative(),
        qtyDamaged: z.number().int().nonnegative().default(0),
        expiryDate: z.string().date().nullable().optional(),
        note: z.string().max(500).nullable().optional(),
      }),
    )
    .min(1),
});

const RECEIVABLE_STATUSES = ["APPROVED", "IN_TRANSIT", "PARTIALLY_RECEIVED"];
```

- [ ] **Step 2: Replace body trust with session trust**

Inside `POST`, authenticate cookie token, reject invalid content type, parse params and body, compute branch from `getPosBranchId`, and fetch PO by id + branch.

- [ ] **Step 3: Validate each item before mutation**

Inside the transaction, fetch each item with `and(eq(purchaseOrderItems.id, item.poItemId), eq(purchaseOrderItems.poId, poId))`. Reject missing item with `PO_ITEM_NOT_FOUND`. Reject damaged quantity above received quantity and received quantity above remaining quantity.

- [ ] **Step 4: Insert log and update scoped items**

Insert receiving log with `receivedById: payload.userId`. Update item quantity with `where(and(eq(purchaseOrderItems.id, item.poItemId), eq(purchaseOrderItems.poId, poId)))`.

- [ ] **Step 5: Map errors to Indonesian responses**

Use known error codes:

- `PO_NOT_FOUND` -> 404 `Purchase Order tidak ditemukan untuk cabang POS ini`
- `PO_STATUS_INVALID` -> 409 `Status Purchase Order belum bisa diterima`
- `PO_ITEM_NOT_FOUND` -> 404 `Item PO tidak ditemukan`
- `RECEIVE_QTY_EXCEEDED` -> 400 `Qty diterima melebihi sisa item PO`
- `DAMAGED_QTY_EXCEEDED` -> 400 `Qty rusak tidak boleh melebihi qty diterima`

Unknown errors log internally and return 500 `Gagal mencatat penerimaan PO`.

- [ ] **Step 6: Run green tests**

Run:

```bash
pnpm exec vitest run apps/backoffice/app/api/pos/purchase-orders/[id]/receive/route.test.ts --config apps/backoffice/vitest.config.ts
```

Expected: test file passes.

## Task 3: Changelog and Verification

**Files:**

- Modify: `apps/backoffice/CHANGELOG.md`
- Verify: Stage 4 route and test

- [ ] **Step 1: Add changelog entry**

Add a new top entry above `[1.2.36]`:

```md
## [1.2.37] - 2026-06-11

### Fixed

- Memperketat endpoint penerimaan Purchase Order POS agar actor, cabang, item PO, dan qty diterima tidak dapat dipalsukan dari payload request.
```

- [ ] **Step 2: Run formatter**

Run:

```bash
pnpm exec prettier --write apps/backoffice/app/api/pos/purchase-orders/[id]/receive/route.ts apps/backoffice/app/api/pos/purchase-orders/[id]/receive/route.test.ts apps/backoffice/CHANGELOG.md docs/superpowers/specs/2026-06-11-backoffice-pos-receiving-hardening-design.md docs/superpowers/plans/2026-06-11-backoffice-pos-receiving-hardening.md
```

Expected: command exits 0.

- [ ] **Step 3: Run targeted tests**

Run:

```bash
pnpm exec vitest run apps/backoffice/app/api/pos/purchase-orders/[id]/receive/route.test.ts --config apps/backoffice/vitest.config.ts
```

Expected: 1 test file passes.

- [ ] **Step 4: Run backoffice typecheck**

Run:

```bash
pnpm --filter backoffice exec tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 5: Run markdown lint**

Run:

```bash
npx markdownlint-cli2 apps/backoffice/CHANGELOG.md docs/superpowers/specs/2026-06-11-backoffice-pos-receiving-hardening-design.md docs/superpowers/plans/2026-06-11-backoffice-pos-receiving-hardening.md
```

Expected: Summary 0 errors.

- [ ] **Step 6: Review scoped diff**

Run:

```bash
git diff -- apps/backoffice/app/api/pos/purchase-orders/[id]/receive apps/backoffice/CHANGELOG.md docs/superpowers/specs/2026-06-11-backoffice-pos-receiving-hardening-design.md docs/superpowers/plans/2026-06-11-backoffice-pos-receiving-hardening.md
```

Expected: diff only contains Stage 4 scope.
