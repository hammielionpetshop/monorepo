---
epic_id: 1
story_id: 1.1
story_key: 1-1-offline-status-indicator
status: done
created_at: 2026-04-27
---

# Story 1.1: Offline Status Indicator

## Kebutuhan Story

**Pernyataan User Story:**
As a Kasir,
I want melihat indikator status koneksi internet secara real-time,
So that saya tahu apakah transaksi saya sedang dikirim ke server atau hanya disimpan di perangkat.

**Kriteria Penerimaan (Acceptance Criteria):**
- **Given** aplikasi POS sedang berjalan
- **When** koneksi internet terputus
- **Then** header aplikasi harus menampilkan peringatan "Mode Offline" berwarna kuning/merah
- **Given** aplikasi POS dalam Mode Offline
- **When** koneksi internet kembali pulih
- **Then** indikator harus kembali berubah menjadi "Online" berwarna hijau

**Konteks Bisnis:**
Story ini adalah bagian dari Epic 1: Offline Retail Operations (MVP). Tujuannya adalah memberikan umpan balik visual kepada kasir mengenai status jaringan sehingga mereka sadar apakah transaksi sedang diantrekan secara lokal.

## Konteks Pengembang & Batasan (Guardrails)

### Persyaratan Teknis (Technical Requirements)
- **Mekanisme Deteksi Offline:** Gunakan `window.addEventListener('online'|'offline')` dipadukan dengan `navigator.onLine`.
- **Manajemen State:** WAJIB menggunakan `networkStore` (berbasis Zustand). **Dilarang** membuat store baru untuk status network/sync.
- **Antarmuka Store (Store Interface):**
  ```typescript
  interface NetworkStore {
    isOnline: boolean
    isSyncing: boolean
    pendingCount: number
    lastSyncAt: number | null
    setOnline: (v: boolean) => void
    setSyncing: (v: boolean) => void
    setPendingCount: (n: number) => void
  }
  ```
- **Pesan Kesalahan (Error Messages):** Semua pesan yang muncul di sisi pengguna (user-facing) wajib dalam Bahasa Indonesia.

### Kepatuhan Arsitektur (Architecture Compliance)
- **Target Frontend:** POS Desktop (Electron 30 + React 18 + Vite 5 + Tailwind CSS 3.4.1).
- **Persyaratan Offline (NFR-R1):** POS harus beroperasi 100% tanpa internet. Indikator ini sangat penting sebagai penanda kesadaran sistem bagi pengguna.
- **Komponen UI:** Indikator harus berada di Header aplikasi POS (kemungkinan di `POSHeader`).
- **Styling:** Tailwind CSS + Radix UI. Mode Offline: peringatan visual kuning/merah, Mode Online: hijau.

### Persyaratan Pustaka & Framework (Library & Framework Requirements)
- **TypeScript:** Gunakan *Strict mode*.
- **React 18:** Gunakan hooks seperti `useEffect` untuk memasang event listeners pada window untuk status `online` dan `offline`.
- **Zustand:** Digunakan khusus untuk `networkStore`.

### Persyaratan Struktur File (File Structure Requirements)
- **Lokasi Store:** Store Zustand harus ditempatkan pada direktori yang tepat, misalnya `apps/pos-desktop/src/stores/network-store.ts` (penamaan menggunakan kebab-case).
- **Lokasi Komponen:** Komponen indikator kemungkinan akan ditempatkan atau diintegrasikan di dalam `apps/pos-desktop/src/components/layout/pos-header.tsx` atau yang serupa.

### Persyaratan Pengujian (Testing Requirements)
- *Unit tests* harus berada di sebelah file yang diuji (`network-store.test.ts`).
- Uji perilaku hook atau store saat event online/offline ditembakkan.

## Referensi Konteks Proyek
- Patuhi aturan penamaan file **kebab-case.ts/tsx**.
- Gunakan **camelCase** untuk fungsi/variabel dan **PascalCase** untuk komponen React.
- Format kode menggunakan Prettier (`pnpm format`).
- Seluruh logika bisnis global, jika ada, ditempatkan di `@petshop/shared` (walaupun untuk store UI ini akan berada spesifik di aplikasi POS).

## Tasks
- [x] Implement `networkStore` using Zustand in `apps/pos-desktop/src/store/network-store.ts`
- [x] Create unit tests for `networkStore` in `apps/pos-desktop/src/store/network-store.test.ts`
- [x] Refactor `POSHeader.tsx` to use `networkStore` for online/offline status
- [x] Update `POSHeader` UI with prominent "Mode Offline" indicator (red/yellow alert)
- [x] Add real-time event listeners for `online` and `offline` events

## File List
- `apps/pos-desktop/src/store/network-store.ts` [NEW]
- `apps/pos-desktop/src/store/network-store.test.ts` [NEW]
- `apps/pos-desktop/src/components/layout/POSHeader.tsx` [MODIFY]

## Change Log
- Created `networkStore` to manage global connection state, syncing status, and pending queue count.
- Integrated `networkStore` into `POSHeader` to replace local state.
- Enhanced `POSHeader` UI with a pulsating "Mode Offline" indicator and sync spinner.
- Added support for displaying pending transaction count in the header.

## Dev Agent Record
### Implementation Plan
- Gunakan Zustand untuk store sederhana yang menangani `isOnline` dan metadata sync.
- Pasang event listeners di `POSHeader` (layout level) untuk memastikan sinkronisasi state global dengan browser events.
- Gunakan Tailwind classes (`animate-pulse`, `bg-red-500/10`) untuk indikator offline yang mencolok sesuai AC.

### Debug Log
- N/A

### Completion Notes
- Store berhasil diimplementasikan dan diuji secara unit (logic check).
- UI `POSHeader` sekarang secara otomatis bereaksi terhadap status jaringan.
- Indikator offline menggunakan warna merah dan teks "Mode Offline" sesuai permintaan.

## Status Penyelesaian Story
Ultimate context engine analysis completed - comprehensive developer guide created. Implementation complete. Ready for review.

### Review Findings
- [x] [Review][Patch] Icon inconsistency — Gunakan `WifiOff` (bukan `CloudOff`) agar konsisten dengan `Wifi` [POSHeader.tsx:~90]
- [x] [Review][Patch] Debounce pada event `online`/`offline` — Rapid flapping tanpa debounce memicu badai re-render [POSHeader.tsx:~25]
- [x] [Review][Patch] Badge `pendingCount` tanpa tooltip — Angka badge tidak informatif tanpa label penjelasan [POSHeader.tsx:~110]
- [x] [Review][Defer] `navigator.onLine` False Positive — Tidak memvalidasi akses internet sesungguhnya ke server. Deferred: akan ditangani di Story 1.4 Auto-Sync saat heartbeat check diimplementasikan. pre-existing
- [x] [Review][Defer] `isSyncing` stuck spinner — Spinner tidak direset di blok `finally` jika sync error. Deferred: Story 1.4 belum ada `setSyncing` call, akan diperbaiki bersamaan dengan implementasinya. pre-existing

