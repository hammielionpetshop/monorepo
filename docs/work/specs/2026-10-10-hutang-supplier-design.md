# Hutang Supplier & Hutang Internal — Design

Tanggal: 2026-10-10 (dokumen ditulis susulan 2026-10-11)
Scope: `apps/backoffice`
Status: **Tayang di 1.107.55** (branch `feat/hutang-supplier`: eee4ee3, 1f72eaf, cf22b6c,
a991c0a; rilis b24b123). Tanpa migrasi DB.

## Latar

Keluhan owner: "PO supplier tidak ada tempat utang-piutangnya, semua dianggap cash."
Ternyata backend hutang supplier sudah ada sejak Phase 5 (April 2026) tetapi **tanpa layar**:

- `supplier_payables` (po_id, supplier_id, total_amount, paid_amount, due_at, status
  `UNPAID`/`PARTIAL`/`PAID`/`WAIVED`) dan `supplier_payable_payments`.
- Hutang dibuat **otomatis** saat penerimaan PO disetujui (`lib/po-batch-updater.ts`,
  total = qty bagus × harga faktur/PO), disesuaikan oleh `update-invoice` & `reverse-receiving`.
- API `GET /api/bo/supplier-payables` dan `POST /api/bo/supplier-payables/[id]/pay`
  (izin `payable.pay`, menolak bayar melebihi sisa, mengunci baris).

Akibatnya semua hutang PO di produksi tercatat **belum dibayar** walau di dunia nyata sudah
dibayar di luar sistem. Pekerjaan ini membuat layarnya, bukan sistem baru.

## Keputusan owner

| # | Keputusan |
|---|---|
| 1 | Campur tunai & tempo (pilihan Tunai/Tempo saat terima PO → dikerjakan di Alur PO 1.107.56 sebagai tawaran "Catat Bayar" sesudah Setujui Penerimaan). |
| 2 | Yang boleh catat bayar: izin `payable.pay` (OWNER, GM, MANAGER, FINANCE). |
| 3 | Pembayaran supplier **belum** dicatat ke Pendapatan & Pengeluaran ("nanti dulu"). |
| 4 | PO lama: owner cek satu per satu lewat layar baru (tanggal bayar boleh mundur). |
| 5 | Jatuh tempo memakai termin per supplier yang sudah ada (`suppliers.payment_term_days`). |
| 6 | Hutang internal: popup catat bayar + tanggal + riwayat **dikerjakan**; hapus hutang **wajib alasan**; bayar banyak sekaligus **jangan dulu**; kas otomatis hutang internal **jangan diubah**. |
| — | Kasus "barang kurang terima": dulu diputuskan bukan fitur (tanggung jawab kepala gudang). **Diganti 2026-10-11:** "barang tidak datang / kurang kirim" ditangani lewat Retur ke Supplier — lihat `2026-10-10-retur-supplier-design.md`. |

## Yang dibuat

### Halaman Hutang Supplier — menu Pembelian → Hutang Supplier

`app/(dashboard)/purchase-orders/supplier-payables/` — tampilan meniru Laporan Piutang:
tagihan, sudah bayar, sisa, status, jatuh tempo; filter supplier, cabang, pencarian no. PO /
faktur; tab **Terlambat**; kartu **Lewat Jatuh Tempo** & **Jatuh Tempo ≤ 7 Hari**.

- **Catat Pembayaran** (popup `supplier-payment-dialog.tsx`): penuh/sebagian, tanggal bayar
  (boleh mundur, tidak boleh ke depan — `lib/payment-date.ts`), metode (maks 20 karakter),
  no. bukti, catatan.
- **Riwayat** pembayaran per PO (tanggal, nominal, metode, bukti, pencatat).
- Detail PO menampilkan status bayar, tagihan, sisa, jatuh tempo + tautan ke halaman ini.

### Jatuh tempo — `lib/supplier-due-date.ts`

**Dihitung saat tampil, tidak disimpan:** `due_at` tersimpan (bila ada) ?? tanggal hutang
dibuat (WIB) + termin supplier saat ini. Konsekuensi sadar: mengubah termin supplier langsung
menggeser jatuh tempo semua tagihan supplier itu yang belum lunas. Termin 0 = tunai.

### Hutang Piutang Internal — `purchase-orders/internal/payables/`

- Catat bayar pakai popup + tanggal bayar; catatan kas otomatis kedua cabang ikut tanggal itu.
- Popup Riwayat; pembayaran lama tanpa metode ditandai "tidak tercatat".
- **Hapus Hutang** (`api/bo/inter-branch-payables/[id]/waive`): alasan wajib (min. 5 huruf),
  disimpan di catatan + audit `IBP_WAIVED`; user non-global hanya untuk piutang cabangnya.
  Hapus hutang = status `WAIVED` saja: stok **tidak** kembali, nota & pembayaran lama tetap,
  tidak bisa dibatalkan.
- Tombol mengikuti izin `payable.pay` / `payable.waive`, bukan daftar jabatan.

### Perbaikan

- `update-invoice`: status hutang dihitung ulang saat faktur dikoreksi (dulu tetap Lunas
  walau faktur naik).

## Batasan & catatan

- Pembayaran supplier tidak masuk arus kas / Pendapatan & Pengeluaran (keputusan owner).
- Laba Rugi tidak membaca hutang supplier (memakai HPP) — tidak terpengaruh.
- "Hapus hutang + kembalikan stok" **tidak aman** dibuat otomatis: hutang internal berasal
  dari Bulk Sale (Gudang sudah mencatat PENJUALAN); butuh fitur terpisah "Retur internal"
  (lihat tahap 2 di `2026-10-10-retur-supplier-design.md`).
- Bayar banyak tagihan sekaligus belum ada.

## Tes

`lib/payment-date.test.ts`, `lib/supplier-due-date.test.ts`,
`app/api/bo/inter-branch-payables/[id]/waive/route.test.ts`.
