# PO Internal Antar Cabang — Arsitektur & Pencatatan Keuangan

> Status: **Diskusi — belum diimplementasi**
> Dibuat: 2026-06-09

---

## Scope

Form Purchase Order internal antar cabang, diisi kasir langsung dari sisi POS. Berbeda dengan PO eksternal (ke supplier), PO internal adalah request stok dari satu cabang ke cabang lain.

---

## Alur Bisnis

```
Kasir POS buat PO internal
  → Admin validasi (cek ketersediaan stok di cabang pengirim)
  → Admin/Owner konfirmasi
  → Print surat jalan
  → Cabang pengirim siapkan & kirim barang
  → Cabang penerima konfirmasi penerimaan
  → Selesai
```

**Status lifecycle:**
`DRAFT → PENDING_APPROVAL → APPROVED → PREPARING → IN_TRANSIT → PENDING_RECEIPT → COMPLETED`
`CANCELLED` bisa dari state manapun sebelum `COMPLETED`.

---

## Gap Analysis (vs Codebase Saat Ini)

| Gap | Keterangan |
|---|---|
| Schema blocker | `supplierId NOT NULL` — tidak bisa null untuk PO internal |
| Tidak ada `po_type` | Tidak bisa bedakan PO eksternal vs internal |
| Tidak ada tier "Harga Modal" | `productPrices` belum punya tier ini; untuk V1 pakai `defaultCostPrice` |
| Form PO di POS belum ada | Kasir hanya bisa terima barang (`/pos/receiving`), belum bisa buat request |
| Tidak ada cashflow antar cabang | `supplierPayables` dan `finance.ts` tidak bisa direpurpose |

---

## Rekomendasi Schema

### Migration PO (non-breaking)

```sql
ALTER TABLE petshop.purchase_orders
  ADD COLUMN po_type varchar(20) NOT NULL DEFAULT 'EXTERNAL',
  ADD COLUMN source_branch_id integer REFERENCES petshop.branches(id);

ALTER TABLE petshop.purchase_orders
  ALTER COLUMN supplier_id DROP NOT NULL;
```

### Tabel Baru

**`inter_branch_transfers`** — header transfer
```
id, ibtNumber, sourceBranchId, destinationBranchId,
requestedById, approvedById,
status, totalTransferValue (integer — nilai HPP saat pengiriman),
notes, createdAt, updatedAt
```

**`inter_branch_transfer_items`** — detail per item
```
id, transferId, productId, uomId,
qtyRequested, qtyShipped, qtyReceived,
costPriceAtTransfer (integer — HPP FIFO cabang pengirim saat kirim),
expiryDate
```

**`inter_branch_payables`** *(opsional — lihat keputusan bisnis di bawah)*
```
id, transferId, debtorBranchId, creditorBranchId,
totalAmount, paidAmount, status (UNPAID/PARTIAL/PAID/WAIVED),
dueAt, createdAt
```

---

## Pencatatan Keuangan

### Model yang Direkomendasikan

- Tidak perlu double-entry penuh
- Transfer stok **tidak boleh masuk tabel `transactions`** — akan menginfeksi laporan laba rugi

### Kapan Pencatatan Terjadi

| Event | Pencatatan |
|---|---|
| Status → `IN_TRANSIT` | Stok dikurangi di cabang pengirim (batch `qtyRemaining` berkurang) |
| Penerimaan dikonfirmasi | Batch baru dibuat di cabang penerima dengan `costPrice = costPriceAtTransfer`; hutang internal terbentuk (jika pakai model desentralisasi) |
| Hutang dilunasi | Status `inter_branch_payables` diupdate |

### HPP Cabang Penerima

**= HPP FIFO batch cabang pengirim pada saat pengiriman** — bukan harga jual, bukan harga PO original. Ini yang diisi ke `productStockBatches.costPrice` batch baru di cabang penerima.

### ⚠️ Keputusan Bisnis yang Belum Diputuskan

Dua model yang perlu dipilih owner:

| Model | Deskripsi | Rekomendasi |
|---|---|---|
| **Sentralisasi** | Cabang tidak bayar-membayar satu sama lain. Pusat rekonsiliasi nilai transfer setiap bulan. `inter_branch_payables` tidak dibutuhkan. | ✅ Lebih simpel untuk skala ini |
| **Desentralisasi** | Setiap cabang punya P&L sendiri. Ada proses settlement dengan bukti transfer bank antar cabang. | Overhead lebih tinggi |

---

## UX Form PO Internal (POS)

- Halaman penuh `/pos/internal-order` (bukan dialog)
- Keyboard-first: Search → Enter pilih produk → fokus auto-pindah ke Qty
- Tab flow: `Qty → UOM → Harga (pre-filled, override-able) → kembali ke Search`
- `onFocus={e => e.target.select()}` di semua input angka
- Harga auto-fill dari `defaultCostPrice * ratio UOM` (pakai `big.js`)

---

## Print Surat Jalan (Dot-matrix)

### Kenapa Selalu Gagal

Browser print driver mengkonversi halaman ke grafis/bitmap — dot-matrix tidak bisa render ini dengan baik.

### Solusi Bertahap

**Tahap 1 — CSS approach:**
- Driver printer: setup "Generic / Text Only" di Windows (sekali saja)
- CSS: `font-family: 'Courier New'; white-space: pre; @page { size: auto; margin: 5mm; }`
- Konten: pure teks, tanpa gambar/icon, gunakan ASCII untuk garis

**Tahap 2 — Local Print Agent (jika Tahap 1 tidak cukup):**
- Node.js HTTP server kecil yang jalan di komputer kasir
- Browser POST plain text → agent kirim raw ESC/P command langsung ke printer
- Paling proper untuk dot-matrix, printer menerima karakter teks murni

---

## Edge Cases

| Skenario | Penanganan |
|---|---|
| PO dibatalkan setelah `IN_TRANSIT` | Buat `stockAdjustment` dengan `reason = 'REVERSE_INTERNAL_TRANSFER_CANCEL'` |
| Partial delivery | Hutang dihitung dari `qtyReceived`, bukan `qtyRequested`. Status `PARTIALLY_RECEIVED` |
| Pembatalan setelah sebagian diterima | Porsi yang sudah diterima tidak bisa di-reverse tanpa `stockAdjustment` |

---

## Prioritas Implementasi

| # | Item | Effort | Blocking? |
|---|------|--------|-----------|
| 1 | Migration schema: `po_type`, `source_branch_id`, `supplier_id` nullable | Rendah | Ya |
| 2 | Tabel `inter_branch_transfers` + `inter_branch_transfer_items` | Rendah | Ya |
| 3 | Form PO internal di `/pos/internal-order` | Tinggi | Tidak |
| 4 | API handler create & lifecycle PO internal | Tinggi | Tidak |
| 5 | Tabel `inter_branch_payables` + cashflow logic | Sedang | Tidak (V2) |
| 6 | Print surat jalan — CSS approach dulu | Rendah | Tidak |
| 7 | Local print agent jika CSS tidak cukup | Sedang | Tidak |
