<!-- markdownlint-disable MD013 -->

# Backoffice PO Supplier Payable Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden purchase order and supplier payable endpoints so authenticated users cannot spoof role, actor, branch, or payable amounts.

**Architecture:** Use existing route-local auth patterns from `inter-branch-payables/[id]/pay/route.ts` and `purchase-orders/[id]/reverse-receiving/route.ts`. Keep this stage narrow: authenticate each target route with `verifyAccessToken`, derive actor/role/branch from JWT, validate request bodies with Zod, and use conditional updates for payable payments.

**Tech Stack:** Next.js App Router route handlers, TypeScript, Drizzle ORM, Zod, jose JWT via `verifyAccessToken`, pnpm/turbo verification.

---

## File Map

- Modify: `apps/backoffice/app/api/bo/purchase-orders/route.ts`
  - Add route-local auth for GET/POST, branch scoping, Zod create schema, and JWT-derived `createdById`.
- Modify: `apps/backoffice/app/api/bo/purchase-orders/[id]/route.ts`
  - Add auth, branch-scoped detail lookup, and PATCH allowlist.
- Modify: `apps/backoffice/app/api/bo/purchase-orders/[id]/approve/route.ts`
  - Replace body role/actor trust with JWT role and `payload.userId`.
- Modify: `apps/backoffice/app/api/bo/purchase-orders/[id]/approve-receiving/route.ts`
  - Add auth, OWNER/GM role gate, branch-scoped PO lookup, and JWT actor.
- Modify: `apps/backoffice/app/api/bo/purchase-orders/[id]/reject/route.ts`
  - Add auth, role gate, branch scope, and JWT actor.
- Modify: `apps/backoffice/app/api/bo/purchase-orders/[id]/update-invoice/route.ts`
  - Add auth, OWNER/GM gate, branch scope, Zod schema, and item-to-PO ownership check.
- Modify: `apps/backoffice/app/api/bo/supplier-payables/route.ts`
  - Add auth and branch scoping through joined PO branch.
- Modify: `apps/backoffice/app/api/bo/supplier-payables/[id]/pay/route.ts`
  - Add auth, role/branch gate, positive amount schema, JWT actor, and conditional payable update.
- Modify: `apps/backoffice/CHANGELOG.md`
  - Add Bahasa Indonesia `### Fixed` entry for PO/payable authorization hardening.

## Shared Constants Per Route

Use these role lists consistently inside the changed route files:

```ts
const GLOBAL_ROLES = ["OWNER", "GM"];
const PO_MUTATE_ROLES = ["OWNER", "GM", "MANAGER"];
const PO_FINANCIAL_ROLES = ["OWNER", "GM"];
const PAYABLE_PAYMENT_ROLES = ["OWNER", "GM", "MANAGER", "FINANCE"];
```

Use this repeated branch helper pattern inline until a later shared-helper stage:

```ts
const isGlobalRole = GLOBAL_ROLES.includes(payload.role);
const effectiveBranchId =
  isGlobalRole && requestedBranchId ? requestedBranchId : payload.branchId;
```

## Task 1: Add Regression Tests For Supplier Payable Payment Rules

**Files:**

- Test: `apps/backoffice/app/api/bo/supplier-payables/[id]/pay/route.test.ts`

- [ ] **Step 1: Inspect test harness**

Run:

```bash
rg -n "vitest|describe\(|mock\(" apps/backoffice -g "*.test.ts" -g "*.test.tsx"
```

Expected: identify whether route handler tests already exist. If none exist, use Vitest mocks in this task.

- [ ] **Step 2: Write failing tests**

Create `apps/backoffice/app/api/bo/supplier-payables/[id]/pay/route.test.ts` with tests that mock `cookies`, `verifyAccessToken`, and `db.transaction`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => ({ value: "token" }) })),
}));

const verifyAccessToken = vi.fn();
vi.mock("@/lib/auth", () => ({ verifyAccessToken }));

const transaction = vi.fn();
vi.mock("@/lib/db", () => ({
  db: { transaction },
  supplierPayables: {
    id: "supplierPayables.id",
    branchId: "supplierPayables.branchId",
    paidAmount: "supplierPayables.paidAmount",
    totalAmount: "supplierPayables.totalAmount",
    status: "supplierPayables.status",
  },
  supplierPayablePayments: {},
  eq: vi.fn((left, right) => ({ left, right, op: "eq" })),
  and: vi.fn((...conditions) => ({ conditions, op: "and" })),
  sql: vi.fn((strings, ...values) => ({ strings, values, op: "sql" })),
}));

describe("POST supplier payable payment", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    verifyAccessToken.mockResolvedValue({
      userId: 7,
      branchId: 2,
      role: "FINANCE",
      permissions: [],
    });
  });

  it("rejects non-positive amount before transaction", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://test.local", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: 0, method: "CASH", paidById: 999 }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "10" }) });

    expect(res.status).toBe(400);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("uses JWT userId instead of paidById from body", async () => {
    const { POST } = await import("./route");
    const insertedValues: unknown[] = [];

    transaction.mockImplementation(async (callback) =>
      callback({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [
                {
                  id: 10,
                  branchId: 2,
                  status: "UNPAID",
                  totalAmount: 100000,
                  paidAmount: 0,
                },
              ],
            }),
          }),
        }),
        update: () => ({
          set: () => ({
            where: () => ({
              returning: async () => [
                { id: 10, paidAmount: 25000, status: "PARTIAL" },
              ],
            }),
          }),
        }),
        insert: () => ({
          values: (values: Record<string, unknown>) => {
            insertedValues.push(values);
            return { returning: async () => [{ id: 1, ...values }] };
          },
        }),
      }),
    );

    const req = new Request("http://test.local", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: 25000, method: "CASH", paidById: 999 }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "10" }) });

    expect(res.status).toBe(201);
    expect(insertedValues[0]).toMatchObject({ paidById: 7 });
  });
});
```

- [ ] **Step 3: Run tests and confirm red state**

Run:

```bash
pnpm --filter backoffice exec vitest run apps/backoffice/app/api/bo/supplier-payables/[id]/pay/route.test.ts
```

Expected: tests fail because current route accepts amount `0` by truthy checks or stores `paidById` from body.

## Task 2: Harden Supplier Payable Payment Endpoint

**Files:**

- Modify: `apps/backoffice/app/api/bo/supplier-payables/[id]/pay/route.ts`
- Test: `apps/backoffice/app/api/bo/supplier-payables/[id]/pay/route.test.ts`

- [ ] **Step 1: Add imports and schema**

Update imports to include `NextRequest`, `cookies`, `z`, `verifyAccessToken`, and `and`. Add schema:

```ts
const PAYABLE_PAYMENT_ROLES = ["OWNER", "GM", "MANAGER", "FINANCE"];
const GLOBAL_ROLES = ["OWNER", "GM"];

const paySchema = z.object({
  amount: z
    .number()
    .int()
    .positive({ message: "Jumlah pembayaran harus lebih dari 0" }),
  method: z.string().min(1, "Metode pembayaran wajib diisi").max(50),
  referenceNumber: z.string().max(100).optional(),
  note: z.string().max(500).optional(),
});
```

- [ ] **Step 2: Authenticate and validate request**

At the start of `POST`, read cookie token, verify payload, enforce `PAYABLE_PAYMENT_ROLES`, validate numeric id, content-type, and `paySchema.safeParse(await req.json())`. Return Indonesian errors with 401, 403, 400, or 415.

- [ ] **Step 3: Replace transaction body**

Inside transaction:

```ts
const [payable] = await tx
  .select()
  .from(supplierPayables)
  .where(eq(supplierPayables.id, payableId))
  .limit(1);

if (!payable) throw new Error("PAYABLE_NOT_FOUND");

const isGlobal = GLOBAL_ROLES.includes(payload.role);
if (!isGlobal && payable.branchId !== payload.branchId)
  throw new Error("PAYABLE_FORBIDDEN");
if (payable.status === "PAID" || payable.status === "WAIVED")
  throw new Error("PAYABLE_CLOSED");

const remaining = Number(payable.totalAmount) - Number(payable.paidAmount);
if (amount > remaining) throw new Error("PAYMENT_EXCEEDS_REMAINING");

const [updated] = await tx
  .update(supplierPayables)
  .set({
    paidAmount: sql`${supplierPayables.paidAmount} + ${amount}`,
    status: sql`CASE WHEN ${supplierPayables.paidAmount} + ${amount} >= ${supplierPayables.totalAmount} THEN 'PAID' ELSE 'PARTIAL' END`,
  })
  .where(
    and(
      eq(supplierPayables.id, payableId),
      sql`${supplierPayables.status} NOT IN ('PAID', 'WAIVED')`,
      sql`${supplierPayables.paidAmount} + ${amount} <= ${supplierPayables.totalAmount}`,
    ),
  )
  .returning();

if (!updated) throw new Error("PAYMENT_CONFLICT");

const [payment] = await tx
  .insert(supplierPayablePayments)
  .values({
    payableId,
    amount,
    method,
    referenceNumber: referenceNumber ?? null,
    note: note ?? null,
    paidById: payload.userId,
    paidAt: new Date(),
  })
  .returning();
```

- [ ] **Step 4: Map errors safely**

Map known errors to Indonesian responses:

```ts
PAYABLE_NOT_FOUND -> 404 Data hutang supplier tidak ditemukan
PAYABLE_FORBIDDEN -> 403 Akses ditolak
PAYABLE_CLOSED -> 409 Hutang supplier sudah lunas atau ditutup
PAYMENT_EXCEEDS_REMAINING -> 400 Jumlah pembayaran melebihi sisa tagihan
PAYMENT_CONFLICT -> 409 Sisa hutang sudah berubah, silakan refresh halaman
```

For unknown errors, log and return `{ error: 'Gagal mencatat pembayaran supplier' }` with 500.

- [ ] **Step 5: Run focused tests**

Run:

```bash
pnpm --filter backoffice exec vitest run apps/backoffice/app/api/bo/supplier-payables/[id]/pay/route.test.ts
```

Expected: tests pass.

## Task 3: Harden PO Approval and Receiving Mutations

**Files:**

- Modify: `apps/backoffice/app/api/bo/purchase-orders/[id]/approve/route.ts`
- Modify: `apps/backoffice/app/api/bo/purchase-orders/[id]/approve-receiving/route.ts`
- Modify: `apps/backoffice/app/api/bo/purchase-orders/[id]/reject/route.ts`

- [ ] **Step 1: Add route-local auth imports**

For each file, add:

```ts
import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/auth";
```

Also import `and` where branch-scoped queries are needed.

- [ ] **Step 2: Replace body role and actor trust in approve route**

Use JWT payload:

```ts
const payload = token ? await verifyAccessToken(token) : null;
if (!payload)
  return NextResponse.json(
    { error: "Sesi tidak valid, silakan login kembali" },
    { status: 401 },
  );
if (!PO_MUTATE_ROLES.includes(payload.role))
  return NextResponse.json(
    { error: "Anda tidak memiliki akses untuk menyetujui Purchase Order." },
    { status: 403 },
  );
```

Fetch PO with branch scope for non-global roles. Use `payload.role` for threshold check and set `approvedById: payload.userId`.

- [ ] **Step 3: Harden approve-receiving route**

Require `OWNER` or `GM`. Before calling `applyPOReceivingBatches`, load PO by id and `payload.branchId` for non-global roles. Call:

```ts
await applyPOReceivingBatches(db, poId, payload.userId);
```

Do not read `approvedById` from the body.

- [ ] **Step 4: Harden reject route**

Require `OWNER`, `GM`, or `MANAGER`. Validate `rejectionNote` as optional string. Scope PO by branch for non-global roles. Set `rejectedById: payload.userId` if schema has the field; otherwise only set status/note/date fields that exist.

- [ ] **Step 5: Run diagnostics**

Run LSP diagnostics on the three changed route files. Expected: no new TypeScript errors in these files.

## Task 4: Harden PO List, Detail, Patch, and Invoice Update

**Files:**

- Modify: `apps/backoffice/app/api/bo/purchase-orders/route.ts`
- Modify: `apps/backoffice/app/api/bo/purchase-orders/[id]/route.ts`
- Modify: `apps/backoffice/app/api/bo/purchase-orders/[id]/update-invoice/route.ts`

- [ ] **Step 1: Add auth to PO list/create**

GET:

- Verify token.
- If `OWNER` or `GM`, allow optional `branchId` query.
- Otherwise force `branchId = payload.branchId` regardless of query.

POST:

- Verify token.
- Require `OWNER`, `GM`, or `MANAGER`.
- Validate JSON body with Zod.
- Use requested branch only for `OWNER` or `GM`; otherwise use `payload.branchId`.
- Insert `createdById: payload.userId`.

- [ ] **Step 2: Add auth to PO detail**

GET:

- Verify token.
- Fetch PO by id and branch scope for non-global roles.
- Return 404 if not found.

PATCH:

- Verify token and role.
- Replace `...body` update with allowlist, for example `notes`, `targetDeliveryDate`, and other safe editable fields currently required by UI.
- Do not allow direct `status`, `totalAmount`, `branchId`, `supplierId`, `approvedById`, or `createdById` through generic PATCH.

- [ ] **Step 3: Harden invoice update**

- Verify token and require `OWNER` or `GM`.
- Validate body: `invoiceNumber` optional string and `items` array with positive `id` and non-negative integer `invoiceUnitCost`.
- Fetch PO branch and scope it.
- For each item update, include both item `id` and `poId` in the `where` condition.
- Recalculate payable only after all item updates complete.

- [ ] **Step 4: Run diagnostics**

Run LSP diagnostics on all three changed route files. Expected: no new TypeScript errors in these files.

## Task 5: Harden Supplier Payable List and Changelog

**Files:**

- Modify: `apps/backoffice/app/api/bo/supplier-payables/route.ts`
- Modify: `apps/backoffice/CHANGELOG.md`

- [ ] **Step 1: Add auth and branch scoping to payable list**

- Verify token.
- Allow `OWNER` and `GM` to filter any branch when query supports branch.
- For non-global roles, only return payables whose PO branch matches `payload.branchId`.
- Keep supplier/status filters, but avoid unsafe string interpolation for status arrays. Use Drizzle-safe helpers if available.

- [ ] **Step 2: Add changelog entry**

At the top of `apps/backoffice/CHANGELOG.md`, add a new version entry dated `2026-06-11`:

```md
## [x.y.z] - 2026-06-11

### Fixed

- Memperketat otorisasi Purchase Order dan hutang supplier agar role, actor, branch, dan pembayaran tidak dapat dipalsukan dari payload request.
```

Use the next patch version based on the existing top entry.

- [ ] **Step 3: Run markdown formatting check for changelog**

Run repository markdown verification if available. If absent, include `apps/backoffice/CHANGELOG.md` in the targeted markdownlint fallback.

## Task 6: Final Verification

**Files:**

- All files modified in Tasks 1-5.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
pnpm --filter backoffice exec vitest run apps/backoffice/app/api/bo/supplier-payables/[id]/pay/route.test.ts
```

Expected: pass.

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: exit 0, or report pre-existing unrelated failures separately with evidence.

- [ ] **Step 3: Run lint if feasible**

Run:

```bash
pnpm --filter backoffice lint
```

Expected: exit 0, or report pre-existing unrelated failures separately with evidence.

- [ ] **Step 4: Review diff**

Run:

```bash
git diff -- apps/backoffice/app/api/bo/purchase-orders apps/backoffice/app/api/bo/supplier-payables apps/backoffice/CHANGELOG.md
```

Expected: diff only touches stage-1 scope and does not revert unrelated dirty-tree changes.

- [ ] **Step 5: Report remaining backlog**

Report these deferred areas explicitly:

- POS transaction and sync branch/actor binding.
- Stock opname branch/approval hardening.
- POS open bills branch binding.
- Stock FIFO concurrency and UOM validation.
- Shared auth helper extraction after repeated route-local pattern stabilizes.
