<!-- markdownlint-disable MD013 -->

# Backoffice POS Transaction Sync Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden POS online transaction and offline sync routes so branch and cashier identity come from the authenticated POS session, not client payload.

**Architecture:** Add route-local session validation to the two highest-risk POS mutation endpoints. Keep `TransactionService` contract mostly unchanged by sanitising payloads at the route boundary.

**Tech Stack:** Next.js App Router route handlers, TypeScript, Zod, Drizzle ORM, Vitest.

---

## Files

- Modify: `apps/backoffice/app/api/pos/transactions/route.ts`
- Modify: `apps/backoffice/app/api/pos/sync/batch/route.ts`
- Create: `apps/backoffice/app/api/pos/transactions/route.test.ts`
- Create: `apps/backoffice/app/api/pos/sync/batch/route.test.ts`
- Modify: `apps/backoffice/CHANGELOG.md`

## Task 1: Online Transaction Route Tests

**Files:**

- Create: `apps/backoffice/app/api/pos/transactions/route.test.ts`
- Read: `apps/backoffice/app/api/pos/transactions/route.ts`

- [ ] **Step 1: Write failing tests**

Create tests that mock cookies, JWT, DB shift/session checks, and `TransactionService.createTransaction`.

Required behaviours:

- Reject body `cashierId` that differs from JWT user.
- For valid payload, call `TransactionService.createTransaction` with `cashierId` from JWT and branch from POS session.

- [ ] **Step 2: Run red test**

Run:

```bash
pnpm exec vitest run apps/backoffice/app/api/pos/transactions/route.test.ts --config apps/backoffice/vitest.config.ts
```

Expected: at least one test fails because the current route trusts body branch/cashier.

## Task 2: Harden Online Transaction Route

**Files:**

- Modify: `apps/backoffice/app/api/pos/transactions/route.ts`

- [ ] **Step 1: Add route-local session auth**

Use `cookies()`, `verifyAccessToken`, and `getPosBranchId`.

- [ ] **Step 2: Add guards**

Guard order:

1. invalid session -> `401`.
2. non-JSON -> `415`.
3. invalid schema -> `400`.
4. body `branchId` conflict -> `403`.
5. body `cashierId` conflict -> `403`.
6. shift not open in branch -> `400`.
7. cashier not active in shift -> `403`.

- [ ] **Step 3: Sanitize service payload**

Call service with `branchId` from POS session and `cashierId` from JWT.

- [ ] **Step 4: Run green test**

Run the same Vitest command. Expected: all online transaction tests pass.

## Task 3: Sync Batch Route Tests

**Files:**

- Create: `apps/backoffice/app/api/pos/sync/batch/route.test.ts`
- Read: `apps/backoffice/app/api/pos/sync/batch/route.ts`

- [ ] **Step 1: Write failing tests**

Required behaviours:

- A synced item with spoofed branch goes to `failed` and does not call `TransactionService.createTransaction`.
- A valid synced item calls service with verified `branchId` and `cashierId`, and does not forward client `authorizedOversell`.

- [ ] **Step 2: Run red test**

Run:

```bash
pnpm exec vitest run apps/backoffice/app/api/pos/sync/batch/route.test.ts --config apps/backoffice/vitest.config.ts
```

Expected: at least one test fails because the current route trusts body branch/cashier and forwards oversell flags.

## Task 4: Harden Sync Batch Route

**Files:**

- Modify: `apps/backoffice/app/api/pos/sync/batch/route.ts`

- [ ] **Step 1: Add route-local session auth**

Use `cookies()`, `verifyAccessToken`, and `getPosBranchId`.

- [ ] **Step 2: Validate each item against session**

For each item:

1. branch mismatch -> push failed reason.
2. cashier mismatch -> push failed reason.
3. shift not open in branch -> push failed reason.
4. cashier not active in shift -> push failed reason.

- [ ] **Step 3: Sanitize service payload**

Call service with verified branch and cashier. Do not pass client `authorizedOversell`.

- [ ] **Step 4: Keep partial success**

A failed item must not stop later valid items from syncing.

- [ ] **Step 5: Run green test**

Run the sync batch Vitest command. Expected: all sync tests pass.

## Task 5: Changelog and Verification

**Files:**

- Modify: `apps/backoffice/CHANGELOG.md`

- [ ] **Step 1: Add changelog entry**

Add a new `### Fixed` bullet in Bahasa Indonesia for POS transaction/sync hardening.

- [ ] **Step 2: Format and lint markdown**

Run:

```bash
pnpm exec prettier --write apps/backoffice/app/api/pos/transactions/route.ts apps/backoffice/app/api/pos/sync/batch/route.ts apps/backoffice/app/api/pos/transactions/route.test.ts apps/backoffice/app/api/pos/sync/batch/route.test.ts apps/backoffice/CHANGELOG.md docs/work/specs/2026-06-11-backoffice-pos-transaction-sync-hardening-design.md docs/work/plans/2026-06-11-backoffice-pos-transaction-sync-hardening.md
npx markdownlint-cli2 docs/work/specs/2026-06-11-backoffice-pos-transaction-sync-hardening-design.md docs/work/plans/2026-06-11-backoffice-pos-transaction-sync-hardening.md apps/backoffice/CHANGELOG.md
```

- [ ] **Step 3: Run tests and typecheck**

Run:

```bash
pnpm exec vitest run apps/backoffice/app/api/pos/transactions/route.test.ts apps/backoffice/app/api/pos/sync/batch/route.test.ts --config apps/backoffice/vitest.config.ts
pnpm --filter backoffice exec tsc --noEmit
```

Expected: targeted tests pass and backoffice TypeScript passes.

- [ ] **Step 4: Review diff**

Run:

```bash
git diff -- apps/backoffice/app/api/pos/transactions apps/backoffice/app/api/pos/sync apps/backoffice/CHANGELOG.md docs/superpowers
```

Expected: diff only covers Stage 2 scope.
