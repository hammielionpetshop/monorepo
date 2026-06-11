# Branch UOM Costs Milestone 2 Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use branch-scoped UOM modal costs as fallback HPP for inventory stock additions that do not provide explicit cost.

**Architecture:** Keep `StockService.addStock()` behaviour unchanged for existing callers by adding an opt-in default-cost option. Only stock opname positive variance and manual stock additions without `costPricePerUnit` use `product_uom_costs`; PO, retur, void transaksi, internal transfer, laporan, and POS sync remain unchanged.

**Tech Stack:** Next.js backoffice, TypeScript, Drizzle ORM, PostgreSQL schema from `@petshop/db`, Big.js, Vitest.

---

### Task 1: StockService Fallback Test

**Files:**

- Create: `apps/backoffice/lib/services/stock-service.test.ts`
- Modify: `apps/backoffice/lib/services/stock-service.ts`

- [ ] Add failing Vitest coverage proving `StockService.addStock()` uses `product_uom_costs` only when called with `{ useDefaultUomCost: true }` and cost `'0'`.
- [ ] Add coverage proving explicit non-zero cost is preserved even with opt-in.
- [ ] Add coverage proving zero cost remains zero without opt-in.
- [ ] Implement `AddStockOptions` and default-cost lookup inside `StockService.addStock()`.
- [ ] Run `pnpm exec vitest run "lib/services/stock-service.test.ts" --config vitest.config.ts` from `apps/backoffice`.

### Task 2: Stock Adjustment Fallback Test

**Files:**

- Create: `apps/backoffice/lib/stock-adjustment.test.ts`
- Modify: `apps/backoffice/lib/stock-adjustment.ts`

- [ ] Add failing Vitest coverage proving positive stock opname calls `StockService.addStock()` with `{ useDefaultUomCost: true }`.
- [ ] Add failing Vitest coverage proving manual stock addition without `costPricePerUnit` looks up `product_uom_costs` and inserts that cost.
- [ ] Add coverage proving manual stock addition with explicit `costPricePerUnit` preserves the explicit value.
- [ ] Import `productUomCosts` in `stock-adjustment.ts` and default only when `costPricePerUnit === undefined`.
- [ ] Pass `{ useDefaultUomCost: true }` in positive stock opname `StockService.addStock()` call.
- [ ] Run `pnpm exec vitest run "lib/stock-adjustment.test.ts" --config vitest.config.ts` from `apps/backoffice`.

### Task 3: Changelog And Verification

**Files:**

- Modify: `apps/backoffice/CHANGELOG.md`

- [ ] Add `[1.2.49] - 2026-06-11` entry above `[1.2.48]` in Bahasa Indonesia.
- [ ] Mention that stock opname/manual adjustment fallback uses `product_uom_costs`.
- [ ] Mention that explicit costs from PO, retur, void, and internal transfer are unchanged.
- [ ] Run targeted Vitest for new inventory tests and existing product costs API test.
- [ ] Run backoffice and db TypeScript checks.
