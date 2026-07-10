# Branch UOM Costs Milestone 4 POS API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development or superpowers:executing-plans.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sinkronkan harga modal per cabang dan UOM ke API POS backoffice
sebagai data master tanpa mengubah POS desktop.

**Architecture:** Backoffice menambahkan `productUomCosts` pada payload
bootstrap dan pencarian produk POS. Server tetap menghitung COGS dari FIFO.
Transaksi penjualan, sync batch, POS desktop, cart, dan grid kasir tidak berubah.

**Tech Stack:** Next.js App Router API, Drizzle ORM, Vitest.

---

## Task 1: POS Bootstrap Cost Payload

**Files:**

- Modify: `apps/backoffice/app/api/pos/bootstrap/route.ts`
- Create: `apps/backoffice/app/api/pos/bootstrap/bootstrap-route.test.ts`

- [ ] Add a failing Vitest test for `/api/pos/bootstrap?branchId=2`.
- [ ] Assert top-level `productUomCosts` is filtered by branch.
- [ ] Import/query `productUomCosts` in bootstrap route.
- [ ] Return `{ id, productId, branchId, uomId, costPrice }` for costs.
- [ ] Preserve existing bootstrap payload fields.

## Task 2: POS Product Search Cost Payload

**Files:**

- Modify: `apps/backoffice/app/api/pos/products/route.ts`
- Create: `apps/backoffice/app/api/pos/products/products-route.test.ts`

- [ ] Add a failing Vitest test for `/api/pos/products`.
- [ ] Assert each product includes branch-scoped `productUomCosts`.
- [ ] Query costs by active POS branch and returned product IDs.
- [ ] Group costs by product and attach them to each product row.
- [ ] Preserve auth, pagination, prices, conversions, and stock behavior.

## Task 3: Changelog and Verification

**Files:**

- Modify: `apps/backoffice/CHANGELOG.md`

- [ ] Add `[1.2.51] - 2026-06-11` above `[1.2.50]`.
- [ ] Mention POS bootstrap and product search expose `product_uom_costs`.
- [ ] Mention POS desktop and transaction flows are unchanged.
- [ ] Run targeted POS API tests from `apps/backoffice`.
- [ ] Run scoped TypeScript check for backoffice.

## Scope Guard

Do not modify `apps/pos-desktop/**`, POS transaction API, POS sync batch API,
`TransactionService`, POS cart types, or cashier product grid code.
