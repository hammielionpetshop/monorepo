# Stock Opname Approval Review Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan modal review detail stock opname di halaman approval backoffice sebelum approver menekan `Setujui`.

**Architecture:** Tambahkan endpoint baca-saja `GET /api/bo/stock-opnames/[id]` untuk header dan item detail SO, lalu sambungkan `SOClient` ke modal lazy-fetch yang memakai endpoint ini. Logika approve/reject yang ada tetap dipakai; modal hanya memberi konteks review dan titik aksi approve yang lebih aman.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, Drizzle ORM, React client state

---

### Task 1: Tambah route detail SO

**Files:**
- Create: `apps/backoffice/app/api/bo/stock-opnames/[id]/route.ts`
- Create: `apps/backoffice/app/api/bo/stock-opnames/[id]/route.test.ts`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Write minimal implementation route**
- [ ] **Step 4: Run test to verify it passes**

### Task 2: Tambah modal review di halaman approval

**Files:**
- Modify: `apps/backoffice/app/(dashboard)/inventory/stock-opname/page.tsx`
- Modify: `apps/backoffice/app/(dashboard)/inventory/stock-opname/_components/so-client.tsx`

- [ ] **Step 1: Tambah tipe data detail SO untuk client**
- [ ] **Step 2: Tambah state modal + lazy fetch detail**
- [ ] **Step 3: Tambah tombol `Review` pada tabel approval**
- [ ] **Step 4: Render modal review dengan header, tabel item, dan tombol approve**

### Task 3: Verifikasi

**Files:**
- Verify: `apps/backoffice/app/api/bo/stock-opnames/[id]/route.test.ts`
- Verify: `apps/backoffice/app/(dashboard)/inventory/stock-opname/_components/so-client.tsx`

- [ ] **Step 1: Run targeted tests**
- [ ] **Step 2: Run `pnpm --filter backoffice exec tsc --noEmit`**
- [ ] **Step 3: Review diff untuk memastikan scope tetap sempit**
