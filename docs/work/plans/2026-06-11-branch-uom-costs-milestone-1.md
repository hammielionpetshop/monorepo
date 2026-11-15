# Branch UOM Costs Milestone 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add branch-scoped harga modal per UOM management in product detail without changing inventory/report/POS behaviour yet.

**Architecture:** Store default modal costs in a new `product_uom_costs` table keyed by product, branch, and UOM. Expose a product-scoped GET/PUT API that mirrors the existing product price route pattern, then add a product detail tab that saves one cost value per UOM for the selected branch.

**Tech Stack:** Next.js 15 App Router, React 19 client components, Drizzle ORM, PostgreSQL schema under `petshop`, Zod, Big.js, Vitest for targeted API contract tests.

---

### Task 1: Schema and Migration

**Files:**
- Modify: `packages/db/src/schema/products.ts`
- Create: `packages/db/src/migrations/20260611000001_add_product_uom_costs.sql`

- [ ] Add `productUomCosts` to `products.ts` with columns `id`, `productId`, `branchId`, `uomId`, `costPrice`, `createdAt`, `updatedAt`.
- [ ] Add unique constraint `product_uom_costs_unique_product_branch_uom` on `(productId, branchId, uomId)`.
- [ ] Add migration SQL creating `petshop.product_uom_costs` with foreign keys to `products`, `branches`, and `units_of_measure`, plus the unique constraint.
- [ ] Keep `products.defaultCostPrice` unchanged as global fallback for later milestones.

### Task 2: API Contract Test

**Files:**
- Create: `apps/backoffice/app/api/bo/master-data/products/[id]/costs/costs-route.test.ts`

- [ ] Write targeted Vitest coverage before route implementation:
  - GET requires auth and `branchId`.
  - PUT allows only OWNER/GM.
  - PUT rejects negative/overflow/duplicate UOM costs.
  - PUT validates branch and product existence.
  - PUT deletes/reinserts costs for one product+branch.
- [ ] Run the test and confirm it fails because the route does not exist yet.

### Task 3: Product Costs API Route

**Files:**
- Create: `apps/backoffice/app/api/bo/master-data/products/[id]/costs/route.ts`

- [ ] Implement `GET /api/bo/master-data/products/[id]/costs?branchId=...` returning `[{ uomId, costPrice }]`.
- [ ] Implement `PUT /api/bo/master-data/products/[id]/costs` with body `{ branchId, costs: [{ uomId, costPrice }] }`.
- [ ] Use auth cookie and `verifyAccessToken` pattern from product price route.
- [ ] Use `OWNER`/`GM` mutation guard with Indonesian error message.
- [ ] Use Big.js to validate integer-safe non-negative cost values and round to integer rupiah.
- [ ] Delete/reinsert rows inside one transaction for the selected product+branch.
- [ ] Run the targeted route test and confirm it passes.

### Task 4: Product Detail UI

**Files:**
- Create: `apps/backoffice/app/(dashboard)/master-data/products/[id]/_components/cost-matrix-client.tsx`
- Modify: `apps/backoffice/app/(dashboard)/master-data/products/[id]/_components/product-detail-tabs.tsx`

- [ ] Add a new tab label `Harga Modal` beside `Satuan` and `Harga`.
- [ ] Build a branch selector using the existing `branches` prop.
- [ ] Fetch `/api/bo/master-data/products/${productId}/costs?branchId=${branchId}` on branch change.
- [ ] Render one editable text input per UOM from `uomsForPricing`.
- [ ] Validate non-negative numeric Rupiah values client-side before save.
- [ ] Save `{ branchId, costs }` to the new PUT endpoint.
- [ ] Show Indonesian loading, success, and error messages.
- [ ] Do not auto-derive values between UOMs in Milestone 1; stored costs are independently branch+UOM scoped.

### Task 5: Changelog

**Files:**
- Modify: `apps/backoffice/CHANGELOG.md`

- [ ] Add new top entry `[1.2.48] - 2026-06-11`.
- [ ] Under `### Added`, mention table/API/UI harga modal per cabang dan UOM for master data product detail.

### Task 6: Minimal Verification

**Files:**
- All changed files from Tasks 1-5.

- [ ] Run `pnpm --filter @petshop/backoffice test -- costs-route.test.ts` or the closest available targeted Vitest command.
- [ ] Run `pnpm typecheck` if feasible; otherwise run the narrowest available TypeScript check and report limits.
- [ ] Run `lsp_diagnostics` on changed TypeScript/TSX files.
- [ ] Manually inspect route/UI for no POS, report, or inventory behaviour changes in Milestone 1.
- [ ] Confirm `apps/backoffice/CHANGELOG.md` was updated.
