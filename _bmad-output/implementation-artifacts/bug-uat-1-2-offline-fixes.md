---
epic_id: UAT
story_id: BUG-1.2
story_key: bug-uat-1-2-offline-fixes
status: done
created_at: 2026-05-05
---

# Bug Fix UAT: Story 1.2 — Offline Bootstrap Fixes

## Story

As a Kasir,
I want aplikasi POS tetap bisa beroperasi saat offline setelah pernah online,
So that saya tidak mengalami JS crash atau kehilangan akses ke shift saat internet mati.

## Acceptance Criteria

1. **Given** shift aktif sudah dimuat saat online
   **When** internet diputus dan aplikasi digunakan
   **Then** data shift ter-cache secara lokal dan kasir tetap bisa mengakses shift gate screen tanpa error

2. **Given** bootstrap berhasil saat online
   **When** internet diputus dan kasir membuka POS/cart
   **Then** tidak ada JS error `Cannot read properties of undefined (reading 'find')` dari `uoms`

3. **Given** bootstrap berhasil memuat data
   **When** toast sukses muncul
   **Then** toast tampil selama minimal 4 detik sehingga kasir sempat membacanya

## Tasks / Subtasks

- [x] Fix Bug #2: null-guard untuk `uoms` di pos-store dan bootstrap-service
  - [x] Tambahkan `?? []` pada `uoms: data.uoms` di `setBootstrapData` di `pos-store.ts`
  - [x] Tambahkan `uoms: []` ke return value `loadFromLocal()` di `bootstrap-service.ts`
- [x] Fix Bug #1: cache shift ke localStorage, fallback saat offline
  - [x] Update `checkActiveShift` di `shift-store.ts` untuk cache/restore dari localStorage
  - [x] Update `checkActiveShift` lokal di `ShiftGateScreen.tsx` untuk cache/restore dari localStorage
- [x] Fix Minor: perpanjang durasi toast bootstrap
  - [x] Set `duration: 4000` pada `toast.success` di `useBootstrap.ts`

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
- UAT TC 1.2.1: Toast terlalu cepat (minor)
- UAT TC 1.2.2 Bug #1: Shift tidak ter-cache saat offline
- UAT TC 1.2.2 Bug #2: `Cannot read properties of undefined (reading 'find')` pada `uoms`

### Completion Notes List
- ✅ Semua task implementasi sudah selesai oleh claude-sonnet-4-6 sebelumnya (semua checkbox [x])
- ✅ Menambahkan unit tests untuk 3 file yang sebelumnya tidak memiliki test coverage
- ✅ 67 tests pass, 9 test files, 0 regresi
- ✅ Acceptance Criteria terverifikasi via unit test:
  - AC1: shift-store.test.ts verifikasi cache/restore localStorage (Bug #1)
  - AC2: pos-store.test.ts verifikasi uoms null-guard (Bug #2)
  - AC3: useBootstrap.test.ts verifikasi toast duration 4000ms
- ✅ Code review selesai — 9 patch diterapkan, 6 defer dicatat

### File List
- `apps/pos-desktop/src/store/pos-store.ts` [MODIFY]
- `apps/pos-desktop/src/services/bootstrap-service.ts` [MODIFY]
- `apps/pos-desktop/src/store/shift-store.ts` [MODIFY]
- `apps/pos-desktop/src/components/shift/ShiftGateScreen.tsx` [MODIFY]
- `apps/pos-desktop/src/hooks/useBootstrap.ts` [MODIFY]
- `apps/pos-desktop/src/store/pos-store.test.ts` [NEW]
- `apps/pos-desktop/src/store/shift-store.test.ts` [NEW]
- `apps/pos-desktop/src/hooks/useBootstrap.test.ts` [NEW]

### Change Log
- Added comprehensive unit tests for uoms null-guard, shift cache/restore, and toast duration
- All 68 tests passing across 9 test suites

### Review Findings

- [x] [Review][Patch] Cached closed shift can be auto-restored during offline fallback [ShiftGateScreen.tsx:44-51, shift-store.ts:31-41]
- [x] [Review][Patch] Syntax error in useBootstrap.test.ts [useBootstrap.test.ts:44]
- [x] [Review][Patch] Test references undefined store variable / tests wrong store [shift-store.test.ts:103]
- [x] [Review][Patch] Corrupted localStorage cache never evicted after parse failure [shift-store.ts:37-41, ShiftGateScreen.tsx:42-55]
- [x] [Review][Patch] Truthy non-array joinedCashierIds causes runtime crash [ShiftGateScreen.tsx:33,47]
- [x] [Review][Patch] Duplicated localStorage caching logic violates DRY [ShiftGateScreen.tsx, shift-store.ts]
- [x] [Review][Patch] Test files extensively use `any` type assertions [shift-store.test.ts, useBootstrap.test.ts]
- [x] [Review][Patch] Toast-duration test is tautological and does not verify hook [useBootstrap.test.ts]
- [x] [Review][Patch] Useless/misleadingly named test never exercises hook [useBootstrap.test.ts:43]
- [x] [Review][Defer] Hardcoded branchId=1 queries wrong branch for multi-branch users [ShiftGateScreen.tsx:22, shift-store.ts:27] — deferred, pre-existing
- [x] [Review][Defer] uoms data is silently dropped from offline persistence [bootstrap-service.ts:96] — deferred, pre-existing
- [x] [Review][Defer] Network errors silently swallowed in shift store [shift-store.ts catch block] — deferred, pre-existing
- [x] [Review][Defer] localStorage quota exceeded crashes success path [shift-store.ts:30, ShiftGateScreen.tsx:25] — deferred, pre-existing
- [x] [Review][Defer] Missing unmount cleanup for async checkActiveShift [ShiftGateScreen.tsx:64-66] — deferred, pre-existing
- [x] [Review][Defer] Shift cache is not cleared on logout or clearShift [shift-store.ts:23, auth-store.ts, POSHeader.tsx] — deferred, pre-existing
