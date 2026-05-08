# Deferred Work

## Deferred from: code review of 1-1-offline-status-indicator (2026-04-27)

- **`navigator.onLine` False Positive** — Browser `navigator.onLine` hanya mengecek koneksi LAN/Router, bukan akses internet sesungguhnya ke server API. Perlu heartbeat check ke endpoint `/api/health` atau sejenisnya. Ditargetkan di Story 1.4 (Auto-Sync on Reconnect) saat mekanisme sync loop diimplementasikan.
- **`isSyncing` stuck spinner** — Jika error terjadi saat proses sinkronisasi dan `setSyncing(false)` tidak dipanggil di blok `finally`, spinner berputar selamanya. Akan diperbaiki bersamaan dengan implementasi Story 1.4 yang memanggil `setSyncing`.

## Deferred from: code review of 1-3-local-transaction-queue (2026-04-28)

- **`branchId` hardcoded `1` di `PaymentDialog.tsx`** — Pre-existing bug multi-branch. `const branchId = 1` harus diganti dengan nilai dari profil user yang sudah login. Ditargetkan saat implementasi multi-branch proper.
- **`user as any` cast di `useBootstrap.ts`** — Tipe `User` di auth store tidak punya field `branchId` secara eksplisit. Perlu extend interface `User` di `@petshop/shared`. Pre-existing dari story 1.2.
- **Debounce 300ms di `POSHeader` menciptakan stale window** — Race condition inherent saat network berubah tepat saat pembayaran diproses. Debounce diperlukan untuk mencegah flapping, tapi memberikan 300ms window di mana status bisa stale. Ditargetkan di Story 1.4 dengan heartbeat check.
- **Bootstrap toast muncul di setiap cold start** — `toast.success('Data master berhasil diperbarui')` terlalu agresif; lebih baik hanya tampil saat ada perubahan data. UX polish.
- **Bootstrap fallback hanya validasi `products.length > 0`** — Data korup (misalnya `paymentMethods` kosong) tidak terdeteksi dan kasir bisa masuk ke sesi POS yang rusak. Perlu validasi shape yang lebih lengkap. Pre-existing dari story 1.2.
- **`referenceNumber: null` tidak nullable di `OfflineTransactionPayload`** — Transaksi kartu/transfer yang butuh nomor referensi tidak bisa menyimpannya saat offline. Perlu `referenceNumber: string | null` dan form input di PaymentDialog. Scope ditargetkan ke Story 1.4.
- **Tidak ada unit test untuk `PaymentDialog.tsx`** — Online-path `saveLocalTransaction` wiring tidak tercover test. PaymentDialog secara umum tidak punya test. Scope yang lebih luas — perlu testing setup dengan Vitest + React Testing Library.

## Deferred from: code review of 1-4-auto-sync-queue-to-server.md (2026-04-28)

- **Risiko Kehilangan Key Enkripsi** — Masalah terkait penyimpanan key di `localStorage` saat IPC tidak tersedia (masalah arsitektural yang sudah ada sebelumnya dari Story 1.1/1.3). [db.ts:140-155]
- **Verifikasi Skema Server** — Penambahan field `created_offline` di level service tanpa verifikasi skema tabel (diasumsikan migrasi sudah dijalankan). [transaction-service.ts]

## Deferred from: code review of 2-1-view-local-transaction-history (2026-04-28)

- **Dependency on bootstrap state for payment method names in `HistoryPage`** — Lookup `getPaymentMethodName` sangat bergantung pada `paymentMethods` store yang sudah di-populate. Jika halaman dibuka sebelum bootstrap selesai (misal cold start lambat), nama metode bayar tampil sebagai '—'. Pre-existing pattern dari lookup master data lainnya.

## Deferred from: code review of 2-3-reprint-receipt (2026-04-28)

- **Validasi Payload IPC** — Handler `printer:print` melakukan destructuring payload tanpa validasi tipe atau keberadaan properti, rawan crash jika payload rusak. Pre-existing pattern di handler IPC lainnya. [main.ts]
- **Pengecekan inisialisasi printer** — Mencoba melakukan alignment dan cetak tanpa mengecek apakah objek `printer` berhasil diinisialisasi atau interface valid. Pre-existing dari implementasi print awal. [main.ts]
- **Posisi label "SALINAN STRUK"** — User memilih untuk menunda pemindahan posisi label. Saat ini diletakkan di bawah nama toko. [main.ts]

## Deferred from: code review of 3-1-search-transaction-by-customer-name.md (2026-04-28)

- **Search Bar lack of Focus** — Input pencarian tidak otomatis terfokus saat halaman History dibuka. Dianggap sebagai UX polish yang bisa dikerjakan nanti. [History.tsx:64]

## Deferred from: code review of 3-2-filter-history-by-date-range.md (2026-04-29)

- **Input "max" Stale if app left open** — Atribut `max` pada date picker menggunakan `new Date()` yang dievaluasi saat render. Jika aplikasi dibiarkan terbuka melewati tengah malam, batas tanggal maksimum tidak akan terupdate secara otomatis tanpa re-render atau reload halaman. [History.tsx:80]

## Deferred from: code review of 3-3-filter-history-by-shift.md (2026-04-30)

- **Konsistensi Locale** — Label shift dan tanggal menggunakan hardcoded locale 'id-ID'. Konsisten dengan pola halaman History saat ini, perlu direfaktorisasi jika aplikasi mendukung multi-bahasa. [History.tsx:80]

## Deferred from: code review of 5-1-daily-summary-dashboard.md (2026-05-02)

- **JWT Token stored in non-HttpOnly cookie** — The token is returned in JSON body and stored in `document.cookie`. This makes it vulnerable to XSS. Namun spesifikasi sudah mencatat discrepancy ini dan menerimanya untuk saat ini. [apps/backoffice/app/(auth)/login/page.tsx]

## Deferred from: code review of 5-2-offline-branch-notification.md (2026-05-03)

- Revalidate API dashboard mungkin terlalu lambat: revalidate = 60 konsisten dengan Story 5.1 namun mungkin perlu ditingkatkan untuk real-time feel.

## Deferred from: code review of 5-3-profit-and-loss-report.md (2026-05-03)

- **Tidak ada batas maksimum rentang tanggal** — Query tak terbatas dapat menyebabkan full table scan pada data besar. Pertimbangkan batas maksimum (misal 1 tahun). [apps/backoffice/lib/services/report-service.ts]
- **Content-Disposition filename tidak RFC 5987-encoded** — Saat ini aman (filename hanya ASCII), tapi pattern fragile jika suatu saat mengandung karakter non-ASCII. [apps/backoffice/app/api/bo/reports/profit-loss/export/route.ts:49]
- **new Big() dapat throw pada string non-numerik dari driver** — Hipotesis edge case jika driver DB mengembalikan string tak terduga meski ada COALESCE di SQL. [apps/backoffice/lib/services/report-service.ts:88-89]
- **Missing aria-label pada link Export CSV** — Aksesibilitas WCAG AA. [apps/backoffice/app/(dashboard)/reports/profit-loss/page.tsx:94-99]
- **_journal.json tidak memiliki trailing newline** — Pre-existing issue. [packages/db/src/migrations/meta/_journal.json]
- **Nav link tidak memiliki active-state indicator** — UX polish: link aktif sebaiknya punya visual indicator (aria-current="page" + active class). [apps/backoffice/app/(dashboard)/layout.tsx:41-47]

## Deferred from: code review of 6-1-manual-stock-adjustment.md (2026-05-03)

- **Audit Log Data Format Consistency** — Menyelaraskan format JSON 'oldData' dan 'newData' dengan standar project agar mempermudah monitoring/reporting audit trail global. [apps/backoffice/lib/stock-adjustment.ts]
- **Cost Price '0' on New Stock Addition** — Menangani penetapan harga pokok (COGS) saat penambahan stok manual jika tidak ada batch sebelumnya. Saat ini mengikuti spek ('costPrice = '0''), namun perlu solusi jangka panjang agar tidak merusak valuasi FIFO. [apps/backoffice/lib/stock-adjustment.ts]

## Deferred from: code review of 4-4-backoffice-retur-management (2026-05-04)

- **CSRF Vulnerability in API Route** — POST route untuk retur memproses data berdasarkan cookie accessToken tanpa perlindungan CSRF. Masalah arsitektural global yang perlu ditangani secara sistemik. [apps/backoffice/app/api/bo/retur/route.ts]

## Deferred from: code review of bug-uat-1-2-offline-fixes (2026-05-06)

- **Hardcoded branchId=1 queries wrong branch for multi-branch users** — Pre-existing bug. `branchId=1` hardcoded di `ShiftGateScreen.tsx` dan `shift-store.ts`. [ShiftGateScreen.tsx:22, shift-store.ts:27]
- **uoms data is silently dropped from offline persistence** — `bootstrap-service.ts` tidak menulis uoms ke Dexie, `loadFromLocal` selalu return `uoms: []`. Pre-existing limitation. [bootstrap-service.ts:96]
- **Network errors silently swallowed in shift store** — Catch block hanya set `activeShift: null` tanpa expose error. Pre-existing behavior. [shift-store.ts catch block]
- **localStorage quota exceeded crashes success path** — `localStorage.setItem` di dalam try block bisa throw QuotaExceededException. Edge case arsitektural. [shift-store.ts:30, ShiftGateScreen.tsx:25]
- **Missing unmount cleanup for async checkActiveShift** — useEffect tanpa cancellation/cleanup saat komponen unmount. Pre-existing structure. [ShiftGateScreen.tsx:64-66]
- **Shift cache is not cleared on logout or clearShift** — `clearShift` dan `logout` tidak menghapus `hammielion_cached_shift`. Relates to logout flow. [shift-store.ts:23, auth-store.ts, POSHeader.tsx]

## Deferred from: code review of bug-uat-printer-error-handling (2026-05-06)

- **Zero payload validation on any-typed IPC payloads** — `items`, `summary`, dan `summary.breakdowns` di-destructure tanpa null-check; data bug bisa ter-catch sebagai "Printer tidak merespons." Pre-existing dari handler IPC printer. [electron/main.ts:120,196]
- **NaN variance dan "Invalid Date" pada settlement summary yang malformed** — `new Date(summary.openedAt)` dan `summary.totalRealCash - summary.totalExpectedCash` bisa menghasilkan nilai invalid. Pre-existing dari logika settlement print. [electron/main.ts:231,282]
- **Concurrent print jobs race pada interface `printer:Generic` yang sama** — `ipcMain.handle` bersifat async; pemanggilan bersamaan masing-masing instantiate `ThermalPrinter` terpisah tanpa mutex/queue. Pre-existing dari arsitektur print handler. [electron/main.ts:124-128]

## Deferred from: code review of bug-uat-audit-log-ui (2026-05-06)

- **`total` selalu = `rows.length` (max 100)** — Teks "Menampilkan X dari Y entri" di UI selalu X===Y karena limit 100. Menyesatkan jika ada >100 record. Pagination explicitly out of scope per spec. [audit-log-table.tsx:207-209]
- **URL filter params hanya dibaca on mount** — Back navigation tidak restore filter state ke URL params. UX enhancement beyond spec scope. [audit-log-table.tsx:46-48]
- **Empty state muncul saat initial load** — "Tidak ada data audit untuk periode yang dipilih" tampil juga saat pertama load sebelum ada filter aktif. UX polish. [audit-log-table.tsx:157-160]

## Deferred from: code review of bug-uat-dashboard-sync (2026-05-06)

- **Shift OPEN dari hari sebelumnya bisa ikut masuk JOIN expenses** — Jika ada shift OPEN dari hari sebelumnya, `shiftExpenses` milik shift tersebut ikut ter-join dan bisa memengaruhi aggregasi. Pre-existing dari query structure. [apps/backoffice/lib/services/dashboard-service.ts:84]
- **Tanggal header dirender server-side tanpa timezone safety** — `new Date()` di server component menggunakan timezone server, bukan client. Pre-existing — kode date ini sudah ada sebelum diff. [apps/backoffice/app/(dashboard)/dashboard/page.tsx]

## Deferred from: code review of 7-1-product-master-crud (2026-05-06)

- **Fetch requests lack timeout/AbortController** [product-form.tsx, product-client.tsx] — Submit/toggle buttons could stay disabled forever if fetch hangs. UX enhancement, not a blocking bug for internal backoffice app.

## Deferred from: code review of 7-2-brand-category-uom-management (2026-05-07)

- **Missing authorization checks beyond authentication** — Setiap route hanya cek token (autentikasi) tanpa cek role/otorisasi. Pola yang sama dengan Story 7.1 dan seluruh backoffice. [apps/backoffice/app/api/bo/master-data/brands/route.ts]
- **Modal dialogs lack focus management and backdrop click handler** — Fokus tidak dimasukkan ke modal, tidak ada focus trap, dan overlay tidak bisa di-klik untuk menutup. Pola yang sama dengan template Story 7.1. [apps/backoffice/app/(dashboard)/master-data/brands/_components/brand-client.tsx]
- **Global document.body.style.overflow mutation dapat conflict antar komponen** — Jika komponen lain juga mengatur body overflow, bisa saling overwrite. Pola yang sama dengan template Story 7.1. [apps/backoffice/app/(dashboard)/master-data/brands/_components/brand-client.tsx]

## Deferred from: code review of 7-2-brand-category-uom-management (2026-05-08)

- **Tidak ada rate limiting pada endpoint master-data** — API surface untuk master data (brand, category, UOM) tidak memiliki rate limiting. Ini adalah system-wide infrastructure gap, bukan bug spesifik story ini. Perlu middleware rate limiter global (misal: `lru-cache` + IP-based throttling atau WAF layer).
- **Error database di server-page hanya di-log ke console** — Production DB failures di server page (page.tsx) di-reduced ke generic UI message dan `console.error` saja. Tidak ada integration dengan error tracking service (Sentry, LogRocket, dsb). Project-wide observability concern.
