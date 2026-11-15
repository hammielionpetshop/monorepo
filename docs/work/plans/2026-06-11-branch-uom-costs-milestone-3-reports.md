# Branch UOM Costs Milestone 3 Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use branch-scoped harga modal per UOM as the Profit/Loss HPP fallback for historical transaction items that do not have persisted COGS.

**Architecture:** Keep persisted `transaction_items.cogs` authoritative. When it is `NULL`, `getProfitLossReport()` should prefer `product_uom_costs` for the exact branch, product, and transaction UOM before falling back to the existing `products.defaultCostPrice` estimate. Stock valuation, POS sync, dashboard, inventory writes, and persisted transaction rows stay unchanged.

**Tech Stack:** Next.js backoffice service layer, TypeScript, Drizzle ORM, PostgreSQL, Vitest.

---

## Files

- Modify: `apps/backoffice/lib/services/report-service.ts`
- Create: `apps/backoffice/lib/services/report-service.test.ts`
- Modify: `apps/backoffice/CHANGELOG.md`

## Task 1: Report Fallback Red Test

- [ ] Create `apps/backoffice/lib/services/report-service.test.ts`.
- [ ] Mock `@/lib/db` fluent Drizzle calls enough to run `getProfitLossReport()`.
- [ ] Assert the COGS SQL fallback order is `transactionItems.cogs`, then `productUomCosts.costPrice`, then `products.defaultCostPrice`, then `0`.
- [ ] Assert report aggregation still maps revenue, COGS, gross profit, and transaction count correctly.
- [ ] Run `pnpm exec vitest run "lib/services/report-service.test.ts" --config vitest.config.ts` from `apps/backoffice` and confirm it fails before production code.

## Task 2: Profit/Loss Query Change

- [ ] Import `productUomCosts` in `apps/backoffice/lib/services/report-service.ts`.
- [ ] Add a left join to `productUomCosts` in the COGS query using `productId`, `branchId`, and `uomId`.
- [ ] Change COGS fallback to `COALESCE(transactionItems.cogs, productUomCosts.costPrice * transactionItems.qty, products.defaultCostPrice * transactionItems.qty * COALESCE(productUomConversions.ratio, 1), 0)`.
- [ ] Do not change stock valuation; batch `costPrice` is already the valuation source.
- [ ] Do not change dashboard, POS sync, transaction service, or persisted transaction rows.
- [ ] Run the report test again and confirm it passes.

## Task 3: Changelog

- [ ] Add `[1.2.50] - 2026-06-11` at the top of `apps/backoffice/CHANGELOG.md`.
- [ ] Use `### Fixed` and Bahasa Indonesia.
- [ ] Mention that old transaction items without `cogs` now use `product_uom_costs` before `defaultCostPrice`, while persisted `cogs` remains unchanged.

## Task 4: Verification

- [ ] Run `pnpm exec vitest run "lib/services/report-service.test.ts" --config vitest.config.ts` from `apps/backoffice`.
- [ ] Run `pnpm exec vitest run "lib/services/stock-service.test.ts" "lib/stock-adjustment.test.ts" --config vitest.config.ts` from `apps/backoffice`.
- [ ] Run `pnpm exec tsc -p apps/backoffice/tsconfig.json --noEmit` from repo root.
- [ ] Run `pnpm exec tsc -p packages/db/tsconfig.json --noEmit` from repo root.
- [ ] Attempt LSP diagnostics on changed TypeScript files; if TypeScript LSP still exits with `-4058`, report that and rely on `tsc`.

## Risks

- Drizzle unit mocks can become brittle. Keep the test focused on SQL fallback shape and returned aggregation mapping.
- `product_uom_costs.cost_price * qty` assumes cost is stored per exact transaction UOM, matching Milestone 1's branch/UOM model.
- Historical rows without branch/UOM cost still use the existing product default estimate, preserving current behavior.
