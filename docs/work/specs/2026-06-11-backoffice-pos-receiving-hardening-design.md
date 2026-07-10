<!-- markdownlint-disable MD013 -->

# Backoffice POS Purchase Order Receiving Hardening Design

**Tanggal:** 2026-06-11
**Status:** Approved by continuation directive
**Stage:** 4

## Tujuan

Stage 4 mengunci endpoint penerimaan Purchase Order dari POS agar data actor,
cabang, item PO, dan kuantitas penerimaan tidak dapat dipalsukan dari payload
request. Fokusnya adalah jalur yang mencatat penerimaan barang sebelum approval
backoffice memperbarui stok.

## Scope

Stage ini menyentuh:

- `apps/backoffice/app/api/pos/purchase-orders/[id]/receive/route.ts`
- `apps/backoffice/app/api/pos/purchase-orders/[id]/receive/route.test.ts`
- `apps/backoffice/CHANGELOG.md`

Stage ini tidak mengubah:

- Backoffice approval receiving yang sudah dikeraskan di Stage 1.
- POS purchase-order list/create route yang saat ini tidak terlihat dipakai oleh
  halaman receiving.
- Logika `applyPOReceivingBatches` atau `StockService`; itu masuk Stage 6 stock
  integrity.
- UI receiving kecuali diperlukan oleh kontrak API. Payload `receivedById` boleh
  tetap dikirim sementara, tetapi server wajib mengabaikannya.

## Risiko Saat Ini

Endpoint `POST /api/pos/purchase-orders/[id]/receive` saat ini:

- Tidak melakukan route-local auth.
- Memakai `receivedById` dari body.
- Tidak mengikat PO ke branch sesi POS.
- Mengupdate `purchaseOrderItems` hanya berdasarkan `poItemId`, tanpa memastikan
  item tersebut milik PO pada path.
- Tidak membatasi status PO yang boleh menerima barang.
- Tidak memvalidasi over-receive terhadap sisa item.
- Mengembalikan error generik berbahasa Inggris dan memakai `catch(error: any)`.

Akibatnya, user yang punya token valid dapat mencoba mencatat penerimaan untuk
PO cabang lain, spoof actor penerima, atau menyisipkan `poItemId` dari PO lain.

## Desain Terpilih

Gunakan pola route-local auth yang sudah dipakai Stage 2 dan Stage 3:

1. Ambil `accessToken` dari cookie dan validasi dengan `verifyAccessToken`.
2. Resolve branch sesi POS dengan `getPosBranchId(payload, cookieStore)`.
3. Validasi `Content-Type: application/json`.
4. Validasi body dengan Zod.
5. Abaikan `receivedById` dari body; gunakan `payload.userId` untuk
   `poReceivingLogs.receivedById`.
6. Query PO memakai `id + branchId`, dan hanya izinkan status `APPROVED`,
   `IN_TRANSIT`, atau `PARTIALLY_RECEIVED`.
7. Untuk setiap item, query `purchaseOrderItems` memakai `id + poId`.
8. Validasi `qtyReceived >= 0`, `qtyDamaged >= 0`, `qtyDamaged <= qtyReceived`,
   dan `qtyReceived <= qtyOrdered - qtyReceivedExisting`.
9. Insert receiving log dan item detail dalam transaksi DB.
10. Update qty item memakai kondisi `id + poId`.
11. Update status PO menjadi `PARTIALLY_RECEIVED` setelah penerimaan valid.

## API Behavior

### Valid Request

- Request valid untuk PO pada branch sesi POS dan status receiving-valid.
- Server mencatat log dengan `receivedById = payload.userId`.
- Server mencatat setiap item dengan `poItemId`, `qtyReceived`, `qtyDamaged`,
  `expiryDate`, dan `note` yang tervalidasi.
- Response tetap kompatibel: `{ success: true, message, log }`.

### Error Handling

- `401`: sesi tidak valid.
- `415`: content-type bukan JSON.
- `400`: payload tidak valid, qty rusak melebihi diterima, atau qty melebihi
  sisa item.
- `404`: PO atau item tidak ditemukan dalam scope branch/PO yang benar.
- `409`: status PO tidak bisa menerima barang.
- `500`: error internal generik berbahasa Indonesia.

Tidak ada raw `error.message` yang dikirim ke client untuk error internal.

## Testing Strategy

Tambahkan Vitest route test dengan mock untuk:

- `next/headers` cookies.
- `@/lib/auth` `verifyAccessToken`.
- `@/lib/db` query/transaction/update/insert chain.

Test minimal:

1. Body `receivedById` spoof ditolak sebagai sumber actor; valid request harus
   insert receiving log dengan `payload.userId`.
2. `poItemId` yang tidak ditemukan sebagai item PO path harus menghasilkan 404
   dan tidak mengupdate qty.
3. `qtyReceived` lebih besar dari sisa item harus menghasilkan 400.

## Acceptance Criteria

- Endpoint receive punya route-local auth.
- Actor penerima selalu dari JWT, bukan body.
- PO selalu branch-scoped ke sesi POS.
- Item update selalu scoped ke PO path.
- Over-receive ditolak sebelum update DB.
- Error response menggunakan Bahasa Indonesia.
- Targeted Vitest Stage 4 pass.
- `pnpm --filter backoffice exec tsc --noEmit` pass.
- `apps/backoffice/CHANGELOG.md` punya entry Stage 4.
