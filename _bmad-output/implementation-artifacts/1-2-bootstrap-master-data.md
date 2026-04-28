---
epic_id: 1
story_id: 1.2
story_key: 1-2-bootstrap-master-data
status: done
created_at: 2026-04-27
---

# Story 1.2: Bootstrap Master Data

## Story

As a Kasir,
I want sistem mengunduh seluruh data produk, harga, dan pajak di awal shift,
So that saya tetap bisa melayani pembeli meskipun internet mati di tengah hari.

## Acceptance Criteria

1. **Given** POS online saat inisialisasi aplikasi
   **When** sistem mulai memuat
   **Then** seluruh master data (products, prices, taxes, customers, payment methods) diunduh dari server
   **And** disimpan ke dalam IndexedDB/Dexie.js lokal menggunakan transaksi atomic (`bulkPut`)

2. **Given** aplikasi berhasil melakukan bootstrap
   **When** internet mati dan kasir mencari barang
   **Then** hasil pencarian tetap muncul seketika (< 200ms) dari database lokal

3. **Given** proses bootstrap sedang berjalan
   **When** terjadi error koneksi
   **Then** aplikasi menampilkan pesan error dalam Bahasa Indonesia dan memberikan opsi retry

## Tasks / Subtasks

- [x] Setup Dexie.js dan Enkripsi (ADR-001)
  - [x] Instal `dexie`, `dexie-encrypted`
  - [x] Implementasi `SecureDb` abstraction di `src/lib/db.ts`
  - [x] Gunakan `Electron safeStorage` untuk encryption key (via IPC bridge)
- [x] Implementasi Service Layer (ADR-002)
  - [x] Buat `src/renderer/services/bootstrap-service.ts`
  - [x] Implementasi fungsi `populate()` dengan `db.transaction('rw', ...)`
  - [x] Pastikan penggunaan `bulkPut` untuk performa dan atomisitas
- [x] Refaktor Hook dan Store
  - [x] Update `src/hooks/useBootstrap.ts` untuk memanggil `bootstrapService.populate()`
  - [x] Sinkronisasi `usePOSStore` dengan data dari Dexie setelah bootstrap berhasil
- [x] Error Handling & UX
  - [x] Tambahkan error handling dengan pesan Bahasa Indonesia
  - [x] Pastikan UI loading state terkelola dengan baik di `pos-store`

## Dev Notes

### Architecture Compliance
- **NFR-P1**: Pencarian produk wajib < 200ms → Harus ditarik dari Dexie lokal.
- **NFR-S1**: Database lokal WAJIB dienkripsi AES-256 menggunakan `dexie-encrypted`.
- **ADR-001**: Key enkripsi disimpan di `Electron safeStorage`.
- **NFR-S3**: Gunakan `big.js` untuk semua nilai finansial dalam data master (harga, pajak).

### Project Structure
- Services: `apps/pos-desktop/src/renderer/services/`
- DB Lib: `apps/pos-desktop/src/lib/db.ts`
- Hooks: `apps/pos-desktop/src/hooks/`
- Stores: `apps/pos-desktop/src/store/`

### Dependencies to Add
- `dexie`
- `dexie-encrypted`
- `big.js`

## Referensi Konteks Proyek
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2]
- [Source: apps/pos-desktop/src/hooks/useBootstrap.ts] (Existing basic implementation)

## Dev Agent Record

### Agent Model Used
Antigravity (Gemini 3 Flash)

### Debug Log References
- N/A

### Completion Notes List
- Ultimate context engine analysis completed - comprehensive developer guide created.

### File List
- `apps/pos-desktop/src/lib/db.ts` [NEW]
- `apps/pos-desktop/src/renderer/services/bootstrap-service.ts` [NEW]
- `apps/pos-desktop/src/hooks/useBootstrap.ts` [MODIFY]
### Review Findings

- [x] [Review][Patch] Race Condition in `getDb` [src/lib/db.ts:103]
- [x] [Review][Patch] Inconsistent `Product` interface [src/lib/db.ts:6]
- [x] [Review][Patch] Search Performance Bottleneck [src/services/bootstrap-service.ts:121]
- [x] [Review][Patch] Hardcoded `branchId` [src/hooks/useBootstrap.ts:19]
- [x] [Review][Patch] Missing `categoryId` Truthy Check [src/services/bootstrap-service.ts:129]
- [x] [Review][Patch] Missing `db.close()` on Open Error [src/lib/db.ts:137]
- [x] [Review][Patch] `loadFromLocal` returns empty non-db states [src/services/bootstrap-service.ts:103]
- [x] [Review][Patch] Potential Memory Issue with large `bulkPut` [src/services/bootstrap-service.ts:24]
- [x] [Review][Patch] `safeStorage` Availability Gap [src/lib/db.ts:110]
- [x] [Review][Patch] `ProductSearch` Spamming [src/pages/POS.tsx:89]
