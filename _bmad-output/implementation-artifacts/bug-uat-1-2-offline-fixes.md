---
epic_id: UAT
story_id: BUG-1.2
story_key: bug-uat-1-2-offline-fixes
status: in-progress
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

### File List
- `apps/pos-desktop/src/store/pos-store.ts` [MODIFY]
- `apps/pos-desktop/src/services/bootstrap-service.ts` [MODIFY]
- `apps/pos-desktop/src/store/shift-store.ts` [MODIFY]
- `apps/pos-desktop/src/components/shift/ShiftGateScreen.tsx` [MODIFY]
- `apps/pos-desktop/src/hooks/useBootstrap.ts` [MODIFY]

### Change Log
