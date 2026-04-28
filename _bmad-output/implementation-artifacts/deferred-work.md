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

