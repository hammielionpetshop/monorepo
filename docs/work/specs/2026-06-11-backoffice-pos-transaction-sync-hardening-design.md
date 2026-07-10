<!-- markdownlint-disable MD013 -->

# Backoffice POS Transaction Sync Hardening Design

## Goal

Stage 2 menutup celah POS transaksi dan sync offline yang masih mempercayai `branchId`, `cashierId`, dan sebagian flag kontrol dari payload client. Perubahan harus kecil, mudah direview, dan tidak mengubah flow UI POS yang sudah mengirim data transaksi normal.

## Scope

File utama:

- `apps/backoffice/app/api/pos/transactions/route.ts`
- `apps/backoffice/app/api/pos/sync/batch/route.ts`
- `apps/backoffice/lib/services/transaction-service.ts` hanya disentuh bila perlu untuk kontrak payload yang lebih aman.
- Test route POS di folder endpoint terkait.
- `apps/backoffice/CHANGELOG.md` untuk catatan bug fix.

Di luar scope Stage 2:

- POS open bills.
- POS stock opname.
- Perbaikan FIFO concurrency dan validasi UOM mendalam.
- Device registration penuh untuk `deviceId`.
- Refactor besar helper auth semua endpoint POS.

## Current Risk

`POST /api/pos/transactions` menerima `branchId`, `shiftId`, dan `cashierId` dari payload, lalu langsung memanggil `TransactionService.createTransaction`. Middleware memastikan token valid, tetapi route tidak mengikat transaksi ke branch POS aktif atau user JWT.

`POST /api/pos/sync/batch` memproses transaksi offline satu per satu, tetapi payload setiap item tetap menentukan branch, shift, cashier, dan `authorizedOversell`. Karena service melewati inventory check saat `createdOffline === true` atau `authorizedOversell === true`, route sync harus membatasi sumber identitas dan branch sebelum memanggil service.

## Selected Approach

Gunakan pendekatan minimal dan aman:

1. Ambil session di route dengan `cookies()` dan `verifyAccessToken`.
2. Hitung branch efektif memakai `getPosBranchId(payload, cookieStore)`.
3. Gunakan `payload.userId` sebagai `cashierId` untuk transaksi online.
4. Validasi `shiftId` terhadap tabel `shifts` dengan branch efektif dan status `OPEN`.
5. Validasi cashier aktif di shift lewat `shiftCashierSessions`.
6. Untuk sync offline, setiap item tetap diproses per-item. Item yang branch, shift, atau cashier-nya tidak cocok dengan session ditaruh ke `failed` tanpa menghentikan item lain.
7. Jangan percaya `authorizedOversell` dari payload sync pada Stage 2. Offline tetap diberi `createdOffline: true`, tetapi oversell approval client tidak diteruskan sebagai bukti server-side.

## API Behaviour

### Online Transaction

- Token tidak valid: `401` dengan pesan Indonesia.
- Content-Type bukan JSON: `415`.
- Payload invalid: `400`.
- `branchId` payload berbeda dari branch POS efektif: `403`.
- `cashierId` payload berbeda dari JWT user: `403`.
- Shift tidak `OPEN` di branch efektif: `400`.
- Cashier tidak aktif di shift: `403`.
- Payload yang valid dipanggil ke service dengan `branchId` efektif dan `cashierId` JWT.

### Offline Sync Batch

- Token tidak valid: `401`.
- Content-Type bukan JSON: `415`.
- Payload batch invalid: `400`.
- Setiap item yang tidak cocok branch atau cashier masuk `failed` dengan alasan Indonesia.
- Setiap item dengan shift tidak valid atau cashier tidak aktif masuk `failed`.
- Item valid dipanggil ke service dengan branch dan cashier yang sudah diverifikasi.
- `lastSeenAt` cabang memakai branch efektif jika ada item berhasil.

## Test Strategy

Tambahkan test route Vitest dengan mock `next/headers`, `@/lib/auth`, `@/lib/db`, dan `TransactionService`.

Minimal regression tests:

- Online transaction menolak spoof `cashierId` dari body.
- Online transaction memanggil service dengan `cashierId` dari JWT saat payload valid.
- Sync batch memasukkan item branch spoof ke `failed` tanpa memanggil service.
- Sync batch memanggil service dengan actor terverifikasi untuk item valid dan tidak meneruskan `authorizedOversell` client.

## Acceptance Criteria

- Tidak ada transaksi POS baru yang dapat menentukan actor dari body.
- Tidak ada transaksi POS baru yang dapat menentukan branch di luar session POS aktif.
- Shift harus `OPEN` dan berada di branch efektif.
- Cashier harus aktif di shift.
- Sync offline tetap partial-success.
- Targeted route tests pass.
- Backoffice TypeScript check pass.
- Changelog diperbarui dalam Bahasa Indonesia.
