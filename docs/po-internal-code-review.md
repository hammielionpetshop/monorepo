# PO Internal — Temuan Code Review

> Tanggal inspeksi: 2026-06-12  
> Reviewer: Claude (inspeksi otomatis)  
> Scope: Flow lengkap PO Internal — create → approve → prepare → ship → receive → payable

---

## Ringkasan Eksekutif

Flow sudah bisa dijalankan end-to-end untuk **happy path**. Status lifecycle dan konversi UOM secara struktur ada. Namun ditemukan **2 isu kritis** yang perlu diperbaiki sebelum production karena bisa menyebabkan data corruption diam-diam, dan **beberapa isu tinggi** yang perlu masuk backlog segera.

---

## File yang Diinspeksi

| File | Peran |
|---|---|
| `packages/db/src/schema/inter_branch_transfers.ts` | Schema tabel header & item transfer |
| `packages/db/src/schema/inter_branch_payables.ts` | Schema tabel hutang antar cabang |
| `apps/backoffice/app/api/bo/internal-transfers/route.ts` | Create transfer (POST) |
| `apps/backoffice/app/api/bo/internal-transfers/[id]/route.ts` | Get detail transfer |
| `apps/backoffice/app/api/bo/internal-transfers/[id]/status/route.ts` | Status transitions (approve/prepare/ship/receive/cancel) |
| `apps/backoffice/app/api/bo/internal-transfers/[id]/stock-check/route.ts` | Cek ketersediaan stok sebelum ship |
| `apps/backoffice/app/api/bo/inter-branch-payables/route.ts` | List payables |
| `apps/backoffice/app/api/bo/inter-branch-payables/[id]/pay/route.ts` | Catat pembayaran payable |
| `apps/backoffice/app/(dashboard)/purchase-orders/internal/[id]/_components/internal-transfer-detail-client.tsx` | UI detail & aksi transfer |
| `apps/backoffice/lib/services/stock-service.ts` | Service FIFO deduction & addStock |

---

## Temuan Kritis

### K-1: UOM Conversion Fallback Diam-Diam ke Ratio = 1

**File:** `status/route.ts` line ~261, 279 & `stock-check/route.ts` line ~97, 100  
**Severity:** KRITIS — bisa salah deduct stok tanpa error

Saat konversi antar UOM, jika product tidak punya definisi di `productUomConversions` untuk UOM yang diminta, kode fallback ke ratio = 1 tanpa throw error:

```typescript
const transferRatio = ratioMap.get(item.uomId) ?? 1   // SILENT FALLBACK
const totalAvailableInBase += s.qty * (ratioMap.get(s.uomId) ?? 1)
```

**Dampak konkret:**
- Transfer 1 Dus (seharusnya = 10 Unit, ratio=10) tapi conversion tidak terdefinisi
- Sistem anggap ratio = 1, sehingga dianggap hanya 1 Unit
- Validasi stok lolos (karena qty kecil), tapi deduction salah
- Tidak ada error yang muncul ke user atau log

**Perbaikan:** Jika UOM tidak ada di `ratioMap`, throw error 400 dengan pesan eksplisit. Jangan fallback diam-diam.

---

### K-2: Double Update Status pada Action Receive — Potensi Inconsistent State

**File:** `status/route.ts` line ~213–466  
**Severity:** KRITIS — transfer bisa stuck di state inconsistent

Ada dua blok `UPDATE` terpisah dalam satu transaksi untuk action `receive`. Blok pertama (dijalankan untuk semua action) melewatkan receive:

```typescript
// Blok 1 — ~line 213
status: action === 'receive' ? transfer.status : transition.to,  // receive tidak update status di sini
...(action === 'approve' ? { approvedById: payload.userId } : {}),

// Blok 2 — ~line 462 (hanya dieksekusi untuk receive)
.set(updateData)  // baru update status di sini
```

**Risiko:** Jika blok 1 berhasil tapi blok 2 gagal karena error stock-check item tertentu, sebagian `qtyReceived` mungkin sudah terupdate tapi status transfer tidak berubah. Transaksi DB akan rollback keseluruhan, tapi logic yang terpecah ini sulit di-maintain dan rentan perubahan di masa depan.

**Perbaikan:** Gabungkan semua update menjadi satu blok di akhir setelah semua validasi dan kalkulasi selesai. Pisahkan fase "kalkulasi & validasi" dari fase "tulis DB".

---

## Temuan Tinggi

### T-1: Cost Price Tidak Divalidasi saat Create Transfer

**File:** `apps/backoffice/app/api/bo/internal-transfers/route.ts`  
**Severity:** TINGGI — nilai payable bisa salah permanen

User input cost price saat membuat transfer. Tidak ada pengecekan terhadap harga beli aktual di master data. Setelah transfer dibuat, tidak ada endpoint untuk mengubah `costPriceAtTransfer` — satu-satunya jalan adalah cancel & buat ulang.

**Risiko:** Input salah (misal Rp 100.000 harusnya Rp 10.000) → payable dicatat 10x lipat → tidak bisa dikoreksi tanpa cancel transfer.

**Perbaikan:**
- Auto-populate `costPrice` dari `defaultCostPrice` produk saat item ditambahkan
- Jika user override, tampilkan warning jika deviasi > X%
- Atau tambah endpoint PATCH untuk update cost price selama masih `PENDING_APPROVAL`

---

### T-2: Status `WAIVED` Orphan — Ada di Kode, Tidak Ada di Schema & Endpoint

**File:** `inter_branch_payables.ts` (schema), `pay/route.ts` line ~71, `payables-client.tsx`  
**Severity:** TINGGI — dead code path, potensi masalah data integrity

Schema mendefinisikan kolom status sebagai `varchar` tanpa enum constraint. Kode API mengecek `status === 'WAIVED'` tapi tidak ada endpoint untuk set status tersebut. UI menampilkan filter untuk WAIVED.

```typescript
// pay/route.ts line ~71
if (payable.status === 'PAID' || payable.status === 'WAIVED') { ... }

// Schema — tidak ada constraint:
status: varchar('status', { length: 20 }).default('UNPAID').notNull(),
```

**Perbaikan (pilih salah satu):**
- Buat endpoint PATCH untuk waive payable (jika fitur memang dibutuhkan)
- Atau hapus semua referensi ke `'WAIVED'` dari kode dan UI jika tidak dibutuhkan
- Tambah enum/check constraint di database agar status invalid tidak bisa masuk

---

### T-3: Batch Identity Hilang saat Transfer

**File:** `status/route.ts` (receive action), `inter_branch_transfers.ts` (schema)  
**Severity:** TINGGI — tracibility batch hilang di cabang tujuan

Saat ship, FIFO deduction dari batch sumber sudah benar. Tapi saat receive, dibuat batch baru di cabang tujuan tanpa menyimpan referensi ke batch asal:

```typescript
// status/route.ts ~line 400
await StockService.addStock(tx, transfer.destinationBranchId, item.productId,
  item.uomId, qty.toString(), item.costPriceAtTransfer.toString())
// Tidak ada referensi ke batch asal
```

**Dampak:** Tanggal expired dari batch asal tidak terbawa ke cabang tujuan kecuali diisi manual di form. Audit trail batch putus — tidak bisa tahu "barang ini berasal dari batch mana di cabang asal."

**Perbaikan:** Tambah field opsional `sourceBatchId` di `interBranchTransferItems`, isi saat FIFO deduction, dan teruskan ke `addStock` di cabang tujuan agar batch baru inherit `expiryDate` dari batch asal.

---

### T-4: Race Condition pada Penomoran IBT

**File:** `apps/backoffice/app/api/bo/internal-transfers/route.ts` line ~184  
**Severity:** TINGGI — duplikat nomor IBT, user experience buruk

Nomor IBT digenerate dengan `COUNT(*) + 1` di dalam transaksi:

```typescript
const increment = ((Number(countRow?.count) || 0) + 1).toString().padStart(4, '0')
```

Dua request simultan bisa menghasilkan nomor yang sama. Unique constraint akan menangkap duplikat, tapi user mendapat error 409 tanpa penjelasan.

**Perbaikan:** Gunakan PostgreSQL sequence (`CREATE SEQUENCE ibt_number_seq`) yang di-increment atomic, atau gunakan `SERIAL`/`uuid` + format nomor saat display (bukan saat insert).

---

### T-5: Stock Check Tampilkan Qty yang Bisa Berbeda dari Actual

**File:** `apps/backoffice/app/api/bo/internal-transfers/[id]/stock-check/route.ts` line ~103  
**Severity:** TINGGI — user input qty berdasarkan angka yang mungkin tidak bisa diproses

```typescript
totalQty += Math.floor((stock.qty * stockRatio) / transferRatio)
```

`Math.floor()` di stock-check menggunakan algoritma berbeda dari deduction di `status/route.ts`. User melihat "7 Dus tersedia", input 7, tapi ship bisa gagal karena algoritma deduction memiliki pembulatan berbeda.

**Perbaikan:** Unifikasi fungsi kalkulasi available qty ke satu utility yang digunakan di kedua tempat.

---

## Temuan Medium

### M-1: Rounding Error Cascade — Error `STOK_PERLU_PECAH`

**File:** `status/route.ts` line ~302  
**Severity:** MEDIUM — UX buruk, pesan error tidak membantu

Multiple `Math.floor()` dalam konversi antar UOM bisa menyebabkan `remainingInBase > 0` meskipun stok logikanya cukup. Error yang muncul ke user (`STOK_PERLU_PECAH`) tidak menjelaskan apa yang harus dilakukan.

**Perbaikan:** Tambahkan pesan error yang lebih informatif, misalnya "Stok perlu dipecah ke satuan lebih kecil sebelum transfer. Sisa X unit tidak dapat dikurangi dalam satuan Dus."

---

### M-2: Validasi Client-Side untuk Notes Partial Receive Tidak Ketat

**File:** `internal-transfer-detail-client.tsx` line ~781  
**Severity:** MEDIUM — UX minor, sudah aman di server

Form receive menampilkan input notes hanya jika qty < qty shipped, tapi tidak ada validasi real-time yang prevent submit jika notes kosong. Server sudah validasi (aman), tapi user bisa klik submit berkali-kali sebelum error muncul.

---

### M-3: Parallel Query N+1 di Stock Check

**File:** `apps/backoffice/app/api/bo/internal-transfers/[id]/stock-check/route.ts` line ~77  
**Severity:** MEDIUM — performa

Setiap item transfer memicu set query tersendiri via `Promise.all`. Transfer dengan 50 item → 50+ query paralel. Untuk transfer besar, ini bisa jadi bottleneck.

**Perbaikan:** Batch query dengan `inArray(productId, allProductIds)` lalu group hasil di memory.

---

## Catatan Positif

- Status machine sudah terdefinisi dengan jelas (PENDING_APPROVAL → APPROVED → PREPARING → IN_TRANSIT → RECEIVED/CANCELLED)
- FIFO deduction di `StockService` sudah benar dan terpusat
- Authorization per role sudah ada dan konsisten
- Partial receive sudah di-handle (qtyReceived bisa < qtyShipped)
- Payable otomatis terbentuk saat receive — bukan manual
- Validasi Zod di semua endpoint sudah ada

---

## Prioritas Perbaikan

| # | Isu | Severity | Effort | Aksi |
|---|---|---|---|---|
| 1 | UOM fallback diam-diam ke ratio=1 | KRITIS | Kecil | Throw error jika UOM tidak terdefinisi |
| 2 | Double update status di receive | KRITIS | Sedang | Refactor jadi single update di akhir |
| 3 | Cost price tidak divalidasi | TINGGI | Sedang | Auto-fill dari master, warn jika override |
| 4 | Status WAIVED orphan | TINGGI | Kecil | Putuskan: buat endpoint atau hapus referensi |
| 5 | Batch identity hilang | TINGGI | Sedang | Tambah `sourceBatchId` di transfer items |
| 6 | Race condition nomor IBT | TINGGI | Kecil | Ganti ke PostgreSQL sequence |
| 7 | Stock check ≠ actual deduction | TINGGI | Kecil | Unifikasi ke satu utility function |
| 8 | Error STOK_PERLU_PECAH tidak informatif | MEDIUM | Kecil | Perbaiki pesan error |
| 9 | N+1 query di stock check | MEDIUM | Sedang | Batch query |
| 10 | Notes partial receive tidak validate di client | MEDIUM | Kecil | Tambah validasi sebelum submit |
