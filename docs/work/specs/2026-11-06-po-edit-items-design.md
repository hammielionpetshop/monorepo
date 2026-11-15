# Ubah Isi PO Supplier sesudah disimpan

Tanggal: 2026-11-06 · Branch: `feat/po-edit-items` · Tanpa migrasi

## Masalah

Owner: setelah PO disimpan, barang yang lupa dimasukkan, kiriman lebih, atau harga berubah tidak
bisa ditambahkan/diubah — harus membuat PO baru. Sebelumnya hanya Draft dari Laporan Bongkaran HRIS
yang isinya bisa diubah (`PUT /api/bo/purchase-orders/[id]/items`, rilis 1.107.114).

## Keputusan owner (2026-11-06)

1. PO yang sudah disetujui lalu diubah isinya **kembali ke Menunggu Persetujuan**.
2. Hanya **OWNER/GM** yang boleh mengubah (Draft bongkaran tetap seperti rilis 1.107.114: pemegang `po.manage`).
3. Semua kasus dikerjakan: lupa input barang, kiriman lebih, harga berubah.

## Aturan

Stok dan hutang supplier baru dibuat saat **Setujui Penerimaan** (`applyPOReceivingBatches` → `COMPLETED`).
Sebelum itu isi PO masih rencana sehingga boleh diubah dengan jejak audit (aturan AGENTS.md: data
stok/uang tidak diedit — tidak tersentuh di sini).

| Status | Ubah isi | Status sesudah simpan |
|---|---|---|
| Draft | ya (po.manage) | tetap Draft |
| Menunggu Persetujuan | ya (OWNER/GM) | tetap |
| Disetujui, Dalam Pengiriman | ya (OWNER/GM) | **Menunggu Persetujuan**, `approved_by/at` dikosongkan |
| Input Penerimaan (belum disetujui) | ya (OWNER/GM), terbatas | tetap — gerbang "Setujui Penerimaan" tetap ada |
| Selesai | tidak — tombol **Buat PO Tambahan** | — |
| Ditolak, Dibatalkan | tidak | — |

Batas saat penerimaan berjalan: baris yang punya catatan penerimaan/retur tidak bisa dihapus; qty
pesanan tidak boleh kurang dari qty diterima. Barang baru dicatat lewat "Lanjutkan Penerimaan".

Simpan tanpa perubahan tidak mengubah status. Perubahan dicatat di audit log `PO_ITEMS_UPDATED`
(Draft tetap `PO_DRAFT_ITEMS_UPDATED`) berisi status + isi lama dan baru.

## Teknis

- `lib/services/po-item-edit-rules.ts` — aturan murni (layar + server).
- `lib/services/po-item-edit.ts` — `editPoItems`: kunci baris PO, perbarui per baris (bukan hapus-isi-ulang
  seperti sebelumnya, supaya `po_receiving_items`/`supplier_return_items` dan `qty_unloaded` tetap menempel),
  total dihitung ulang dengan `big.js`.
- Route `PUT .../items` memakai service; layar `po-items-editor.tsx` (pengganti `po-draft-editor.tsx`).
- PO Tambahan: `CreatePODialog` menerima isian awal (supplier/cabang sama, catatan "PO Tambahan dari PO-…").
  Tanpa kolom tautan baru (tanpa migrasi); rujukan ada di catatan PO.

## Uji

- Tes integrasi `po-item-edit.integration.test.ts` (DB lokal).
- Uji layar oleh owner di staging.
