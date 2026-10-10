# Alur PO Baru — Design

Tanggal: 2026-10-10 (dokumen ditulis susulan 2026-10-11)
Scope: `apps/backoffice` (Purchase Orders, Hutang Supplier)
Status: **Tayang di 1.107.56** (branch `feat/alur-po-baru`: 6ee1b3f, 8877233, c75edc9;
rilis 2c3c3f6). Diuji owner di laptop dengan DB salinan prod sebelum rilis. Tanpa migrasi DB.

## Latar

- Data menunjukkan qty terima **tidak pernah dihitung**: semua item PO tercatat qty terima =
  qty pesan, karena form terima otomatis terisi qty pesan.
- Fitur "harga menyusul" (sejak 6 Okt, kanban #49) belum pernah dipakai: harga 0 membuat
  batch memakai modal lama sebagai perkiraan, tetapi hutang menghitung barang itu Rp 0.
- Tab Transit tidak pernah dipakai.

## Keputusan owner

| # | Keputusan |
|---|---|
| 1 | Tab tahap: **Rencana · Disetujui · Diterima · Belum Ada Harga · Selesai · Semua**; Transit digabung ke Disetujui. |
| 2 | Form terima: **qty & harga mulai kosong**; pengingat "rencana Rp X · terakhir Rp Y" di **samping** kolom. |
| 3 | Semua peringatan = **popup wajib klik** (`components/ui/required-choice-dialog.tsx`). |
| 4 | "Terima" dan "Setujui Penerimaan" **tetap dipisah**; yang menerima tetap Owner/GM (`po.approve`). |
| 5 | PO lama = Selesai. |
| 6 | PO menunggu faktur: tampilkan **perkiraan** hutang (harga rencana, atau modal terakhir), tanpa DP, tanpa Catat Bayar; jatuh tempo tetap dari tanggal barang datang. |
| 7 | Tambahan dari uji owner: tombol **Isi Harga Beli** di pita kuning tepat di bawah kotak judul + form popup; sisa tagihan menunggu faktur ditampilkan "≈". |
| — | Info selisih HPP penjualan sebelum faktur: dilewati ("kalau rumit biarkan"). |

## Tahap PO (dihitung, bukan status DB baru)

`lib/po-stage.ts` + `lib/po-stage-sql.ts`. Status DB tidak ditambah karena `COMPLETED`
dipakai `reverse-receiving` dan `po-batch-updater`.

| Status DB | Tahap |
|---|---|
| `DRAFT`, `PENDING_APPROVAL` | Rencana |
| `APPROVED`, `IN_TRANSIT` | Disetujui |
| `PARTIALLY_RECEIVED`, `FULLY_RECEIVED` | Diterima |
| `COMPLETED` + ada item harga menunggu | **Belum Ada Harga** |
| `COMPLETED` lainnya | Selesai |
| `REJECTED` | Ditolak; lainnya Dibatalkan |

**Penanda harga menyusul:** form terima menyimpan harga ke `purchase_order_items.invoice_unit_cost`;
**0 = menunggu faktur**; `null` (PO lama) = memakai harga PO → Selesai.

**Jebakan teknis:** Drizzle membuang nama tabel pada query satu tabel, sehingga subquery
korelasi salah sasaran — subquery di `po-stage-sql.ts` wajib memakai nama tabel lengkap/alias
(ketahuan saat uji DB, diperbaiki di 8877233).

## Yang dibuat

- Daftar PO: tab tahap + kolom **Status Bayar** (`lib/po-payment-status.ts`): Belum Bayar /
  Sebagian / Lunas / Terlambat N hari / Menunggu Faktur.
- Form Terima Barang (`purchase-orders/[id]/receive/`): qty & harga kosong; tombol "Samakan harga
  kosong dengan harga rencana"; peringatan wajib klik (`receiving-warnings.ts`): barang 0
  (tidak datang), barang tanpa harga, harga beda ≥ 30% dari terakhir (`lib/po-last-cost.ts`).
- **Batalkan Input Penerimaan** (`api/bo/purchase-orders/[id]/cancel-receiving`): sebelum
  Setujui Penerimaan, alasan wajib, audit `PO_RECEIVING_CANCELLED`; qty input dihapus, PO kembali
  Disetujui. Stok belum berubah, jadi tidak ada yang dibalik.
- Sesudah Setujui Penerimaan / sesudah harga faktur diisi: popup "Dibayar sekarang?"
  [Nanti (Tempo)] / [Catat Bayar] (form sama dengan Hutang Supplier); bila masih ada harga
  menyusul → tagihan sementara (perkiraan) + [Mengerti].
- Hutang Supplier: tab **Menunggu Faktur** (`lib/po-pending-estimate.ts`), tanpa tombol bayar.
- Isi Harga Beli / Cocokkan Faktur (`po-invoice-match.tsx`): popup; barang menunggu faktur
  mulai kosong. Modal di Manajemen Harga **tidak** ditimpa harga rencana saat penerimaan
  disetujui; baru diperbarui setelah harga faktur diisi (`po-batch-updater.ts`).

## Batasan

- Penjualan yang terjadi sebelum faktur diisi tetap memakai HPP perkiraan
  (`transaction_items.cogs` disimpan saat jual; tidak ada jejak batch per penjualan).
- `cancel-remaining` membuat PO sebagian-terima menjadi `FULLY_RECEIVED`; PO tes yang macet
  di `PARTIALLY_RECEIVED` tanpa tombol pembatal pernah perlu SQL manual (dengan izin owner).

## Tes

`lib/po-stage.test.ts`, `lib/po-payment-status.test.ts`, `po-item-defaults.test.ts`,
`po-list-client.test.ts`, `receiving-warnings.test.ts`, `cancel-receiving/route.test.ts`,
`receive/route.test.ts`, dan tes DB `lib/services/po-alur-baru.integration.test.ts`
(jalankan dengan `STOCK_TEST_DATABASE_URL` ke DB lokal `petshop_wt_*`).
