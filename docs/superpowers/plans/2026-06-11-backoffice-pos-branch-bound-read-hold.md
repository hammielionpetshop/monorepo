<!-- markdownlint-disable MD013 -->

# Backoffice POS Branch Bound Read Hold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden POS bootstrap, stock snapshot, users, and open bill endpoints so branch access comes from the authenticated POS session.

**Architecture:** Follow the Stage 2 route-boundary pattern: each route validates `accessToken`, resolves branch through `getPosBranchId(payload, cookieStore)`, and rejects conflicting query/body branch IDs. Keep response shapes stable and avoid a broad shared auth refactor in this stage.

**Tech Stack:** Next.js App Router route handlers, TypeScript, Zod, Drizzle ORM, Vitest.

---

## Files

- Modify: `apps/backoffice/app/api/pos/bootstrap/route.ts`
- Modify: `apps/backoffice/app/api/pos/stock-snapshot/route.ts`
- Modify: `apps/backoffice/app/api/pos/users/route.ts`
- Modify: `apps/backoffice/app/api/pos/open-bills/route.ts`
- Modify: `apps/backoffice/app/api/pos/open-bills/[id]/route.ts`
- Create: `apps/backoffice/app/api/pos/bootstrap/route.test.ts`
- Create: `apps/backoffice/app/api/pos/stock-snapshot/route.test.ts`
- Create: `apps/backoffice/app/api/pos/users/route.test.ts`
- Create: `apps/backoffice/app/api/pos/open-bills/route.test.ts`
- Create: `apps/backoffice/app/api/pos/open-bills/[id]/route.test.ts`
- Modify: `apps/backoffice/CHANGELOG.md`

## Task 1: Bootstrap Branch Tests

**Files:**

- Create: `apps/backoffice/app/api/pos/bootstrap/route.test.ts`
- Read: `apps/backoffice/app/api/pos/bootstrap/route.ts`

- [ ] **Step 1: Write failing tests**

Create tests that mock `next/headers`, `@/lib/auth`, and `@/lib/db`.

Required behaviours:

- Query `branchId=999` returns `403` when POS session branch is `2`.
- Query without `branchId` uses session branch `2` for stock and price lookup.

- [ ] **Step 2: Run red test**

Run:

```bash
pnpm exec vitest run apps/backoffice/app/api/pos/bootstrap/route.test.ts --config apps/backoffice/vitest.config.ts
```

Expected: at least one test fails because the current route defaults/trusts query `branchId`.

## Task 2: Harden Bootstrap Route

**Files:**

- Modify: `apps/backoffice/app/api/pos/bootstrap/route.ts`

- [ ] **Step 1: Add session auth**

Use `cookies()`, `verifyAccessToken`, and `getPosBranchId`.

- [ ] **Step 2: Validate branch query**

If query `branchId` exists and differs from session branch, return `403` with `Cabang POS tidak sesuai dengan sesi`.

- [ ] **Step 3: Use session branch in all branch-sensitive queries**

Use session branch for product stock and product price queries. Keep response shape unchanged.

- [ ] **Step 4: Run green bootstrap test**

Run the Task 1 Vitest command. Expected: all bootstrap tests pass.

## Task 3: Snapshot and Users Tests

**Files:**

- Create: `apps/backoffice/app/api/pos/stock-snapshot/route.test.ts`
- Create: `apps/backoffice/app/api/pos/users/route.test.ts`
- Read: `apps/backoffice/app/api/pos/stock-snapshot/route.ts`
- Read: `apps/backoffice/app/api/pos/users/route.ts`

- [ ] **Step 1: Write failing tests**

Required behaviours:

- Stock snapshot without query branch uses session branch `2`.
- POS users with query `branchId=999` returns `403` and does not run the users query.

- [ ] **Step 2: Run red tests**

Run:

```bash
pnpm exec vitest run apps/backoffice/app/api/pos/stock-snapshot/route.test.ts apps/backoffice/app/api/pos/users/route.test.ts --config apps/backoffice/vitest.config.ts
```

Expected: at least one test fails because the current routes default/trust query `branchId`.

## Task 4: Harden Snapshot and Users Routes

**Files:**

- Modify: `apps/backoffice/app/api/pos/stock-snapshot/route.ts`
- Modify: `apps/backoffice/app/api/pos/users/route.ts`

- [ ] **Step 1: Add route-local auth to both routes**

Use `cookies()`, `verifyAccessToken`, and `getPosBranchId`.

- [ ] **Step 2: Reject branch spoofing**

If query `branchId` exists and differs from session branch, return `403`.

- [ ] **Step 3: Use session branch for queries**

Replace default branch `1` with session branch.

- [ ] **Step 4: Run green tests**

Run the Task 3 Vitest command. Expected: all snapshot and users tests pass.

## Task 5: Open Bills Tests

**Files:**

- Create: `apps/backoffice/app/api/pos/open-bills/route.test.ts`
- Create: `apps/backoffice/app/api/pos/open-bills/[id]/route.test.ts`
- Read: `apps/backoffice/app/api/pos/open-bills/route.ts`
- Read: `apps/backoffice/app/api/pos/open-bills/[id]/route.ts`

- [ ] **Step 1: Write failing tests**

Required behaviours:

- `POST /api/pos/open-bills` rejects body `branchId=999` for session branch `2`.
- Valid open bill insert uses branch `2` from session even when body has branch `2`.
- `DELETE /api/pos/open-bills/[id]` deletes with both `id` and session branch condition.

- [ ] **Step 2: Run red tests**

Run:

```bash
pnpm exec vitest run apps/backoffice/app/api/pos/open-bills/route.test.ts apps/backoffice/app/api/pos/open-bills/[id]/route.test.ts --config apps/backoffice/vitest.config.ts
```

Expected: at least one test fails because current routes trust body branch and delete by id only.

## Task 6: Harden Open Bills Routes

**Files:**

- Modify: `apps/backoffice/app/api/pos/open-bills/route.ts`
- Modify: `apps/backoffice/app/api/pos/open-bills/[id]/route.ts`

- [ ] **Step 1: Add auth and schemas**

Use route-local auth. Add Zod schema for create payload with positive `branchId`, positive `shiftId`, optional `billName`/`holdName`, array `items`, nullable `customerId`, and nonnegative `totalAmount`.

- [ ] **Step 2: Harden list/create**

`GET` uses session branch; `POST` rejects branch mismatch and inserts session branch.

- [ ] **Step 3: Harden delete**

`DELETE` validates numeric id and deletes with `and(eq(openBills.id, id), eq(openBills.branchId, branchId))`. Return `404` if no row deleted.

- [ ] **Step 4: Run green open bills tests**

Run the Task 5 Vitest command. Expected: all open bills tests pass.

## Task 7: Changelog and Verification

**Files:**

- Modify: `apps/backoffice/CHANGELOG.md`

- [ ] **Step 1: Add changelog entry**

Add a new top version `[1.2.36] - 2026-06-11` with `### Fixed` and this entry:

```markdown
- Memperketat endpoint bootstrap, snapshot stok, user POS, dan open bill agar akses cabang selalu mengikuti sesi POS.
```

- [ ] **Step 2: Format touched files**

Run:

```bash
pnpm exec prettier --write apps/backoffice/app/api/pos/bootstrap/route.ts apps/backoffice/app/api/pos/bootstrap/route.test.ts apps/backoffice/app/api/pos/stock-snapshot/route.ts apps/backoffice/app/api/pos/stock-snapshot/route.test.ts apps/backoffice/app/api/pos/users/route.ts apps/backoffice/app/api/pos/users/route.test.ts apps/backoffice/app/api/pos/open-bills/route.ts apps/backoffice/app/api/pos/open-bills/route.test.ts apps/backoffice/app/api/pos/open-bills/[id]/route.ts apps/backoffice/app/api/pos/open-bills/[id]/route.test.ts apps/backoffice/CHANGELOG.md docs/superpowers/specs/2026-06-11-backoffice-pos-branch-bound-read-hold-design.md docs/superpowers/plans/2026-06-11-backoffice-pos-branch-bound-read-hold.md
```

- [ ] **Step 3: Run all targeted tests**

Run:

```bash
pnpm exec vitest run apps/backoffice/app/api/pos/bootstrap/route.test.ts apps/backoffice/app/api/pos/stock-snapshot/route.test.ts apps/backoffice/app/api/pos/users/route.test.ts apps/backoffice/app/api/pos/open-bills/route.test.ts apps/backoffice/app/api/pos/open-bills/[id]/route.test.ts --config apps/backoffice/vitest.config.ts
```

Expected: all Stage 3 tests pass.

- [ ] **Step 4: Typecheck backoffice**

Run:

```bash
pnpm --filter backoffice exec tsc --noEmit
```

Expected: exit `0` with no TypeScript errors.

- [ ] **Step 5: Verify markdown**

Run:

```bash
npx markdownlint-cli2 apps/backoffice/CHANGELOG.md docs/superpowers/specs/2026-06-11-backoffice-pos-branch-bound-read-hold-design.md docs/superpowers/plans/2026-06-11-backoffice-pos-branch-bound-read-hold.md
```

Expected: `Summary: 0 error(s)`.

- [ ] **Step 6: Review scoped diff**

Run:

```bash
git diff -- apps/backoffice/app/api/pos/bootstrap apps/backoffice/app/api/pos/stock-snapshot apps/backoffice/app/api/pos/users apps/backoffice/app/api/pos/open-bills apps/backoffice/CHANGELOG.md docs/superpowers
```

Expected: only Stage 3 files changed.
