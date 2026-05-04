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

- **Audit Log Data Format Consistency** � Menyelaraskan format JSON 'oldData' dan 'newData' dengan standar project agar mempermudah monitoring/reporting audit trail global. [apps/backoffice/lib/stock-adjustment.ts]
- **Cost Price '0' on New Stock Addition** � Menangani penetapan harga pokok (COGS) saat penambahan stok manual jika tidak ada batch sebelumnya. Saat ini mengikuti spek ('costPrice = '0''), namun perlu solusi jangka panjang agar tidak merusak valuasi FIFO. [apps/backoffice/lib/stock-adjustment.ts]

## Deferred from: code review of 4-4-backoffice-retur-management (2026-05-04)

- **CSRF Vulnerability in API Route** — POST route untuk retur memproses data berdasarkan cookie ccessToken tanpa perlindungan CSRF. Masalah arsitektural global yang perlu ditangani secara sistemik. [apps/backoffice/app/api/bo/retur/route.ts]
