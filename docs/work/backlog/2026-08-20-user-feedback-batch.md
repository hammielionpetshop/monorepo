# Backlog — Batch Feedback User (2026-08-20)

**Status:** 🆕 Baru, belum ditriage/diprioritaskan
**Tanggal:** 2026-08-20
**Sumber:** Daftar 8 poin feedback user, diklarifikasi via tanya-jawab sebelum masuk tracker ini.

Catatan: item 1 dipecah jadi 1a & 1b karena diklarifikasi sebagai dua fitur terpisah yang kebetulan
sama-sama di halaman Transfer Internal (Purchase Order Internal / IBT).

| No | Deskripsi Asli | Kategori | Area / Modul | Prioritas |
|----|-----------------|----------|---------------|-----------|
| 1a | Fitur Hapus Nota di Transfer Internal | Fitur | `purchase-orders/internal` | TBD |
| 1b | Fitur Edit PO di Transfer Internal | Fitur | `purchase-orders/internal` | TBD |
| 2  | Bug numbering di surat jalan | Bug | Cetak surat jalan (dot-matrix) | TBD |
| 3  | Data surat jalan di halaman internal transfer belum sesuai | Bug | `purchase-orders/internal` — cetak SJ | TBD |
| 4  | Barang kosong yang dihapus di PO internal tetap muncul | Bug | `purchase-orders/internal` | TBD |
| 5  | Tampilan piutang tidak ada tanggal transaksi | Fitur | `reports/receivables` | TBD |
| 6  | Harga hasil edit balik ke semula di daftar tunggu web POS | Bug | `components/pos/open-bills-drawer.tsx` | TBD |
| 7  | Fitur Hapus Produk dari master data | Fitur | `master-data/products` | TBD |
| 8  | Fitur salin harga ikut menyalin modal (seharusnya tidak) | Bug/Fitur | `master-data/prices/copy-branch-modal.tsx` | TBD |

---

## 1a. Fitur Hapus Nota di Transfer Internal
**Kategori:** Fitur
**Area teknis:** `apps/backoffice/app/(dashboard)/purchase-orders/internal/`, `api/bo/internal-transfers/`

Butuh tombol/aksi untuk menghapus nota (transaksi) transfer internal. **Belum jelas:**
- Status apa saja yang boleh dihapus (draft saja, atau juga yang sudah diproses/approved)?
- Kalau sudah ada pergerakan stok (barang sudah diterima), apakah hapus nota juga harus reverse stok, atau hanya boleh dihapus sebelum stok bergerak?
- Siapa yang berhak (role apa) menghapus?

## 1b. Fitur Edit PO di Transfer Internal
**Kategori:** Fitur
**Area teknis:** `apps/backoffice/app/(dashboard)/purchase-orders/internal/[id]/`

Butuh kemampuan mengedit PO internal setelah dibuat. **Belum jelas:**
- Edit field apa saja (qty, item, cabang tujuan) dan sampai status apa PO masih boleh diedit?
- Apakah edit setelah sebagian diterima (partial receiving) diperbolehkan, atau harus dibatalkan & buat baru?

## 2. Bug numbering di surat jalan
**Kategori:** Bug
**Klarifikasi user:** ketika nomor surat jalan sudah 2 digit (contoh "10"), digit "1" dan "0"
tercetak di baris yang berbeda — bukan soal nomor duplikat/loncat, tapi soal layout/wrapping
cetakan yang salah menangani nomor multi-digit.
**Area teknis diduga:** komponen cetak dot-matrix ESC/P — lihat `bulk-sale-delivery-note-print.tsx`
dan kemungkinan komponen serupa di `internal-transfer-detail-client.tsx` (lihat juga
`docs/work/specs/2026-07-10-surat-jalan-qz-tray-dotmatrix.md` untuk konteks implementasi QZ Tray).
**Belum jelas:** apakah ini muncul di semua jenis surat jalan (bulk sale & internal transfer), atau
spesifik salah satu saja — perlu contoh cetakan/foto untuk konfirmasi kolom mana yang kepotong.

## 3. Data surat jalan di halaman internal transfer belum sesuai
**Kategori:** Bug
**Klarifikasi user:** bukan soal layout/template, tapi **data yang tercetak salah atau kurang**
(nama barang, qty, atau cabang tujuan tidak sesuai dengan data transfer sebenarnya).
**Area teknis:** `apps/backoffice/app/(dashboard)/purchase-orders/internal/[id]/_components/internal-transfer-detail-client.tsx`
**Belum jelas:** data spesifik mana yang salah — perlu contoh kasus (nomor transfer + apa yang
seharusnya tercetak vs apa yang benar-benar tercetak).

## 4. Barang kosong yang dihapus di PO internal tetap muncul
**Kategori:** Bug
**Deskripsi:** ketika item yang direquest di PO internal kosong/habis lalu dihapus dari PO, item
tersebut tetap muncul di tampilan (kemungkinan state UI tidak sinkron dengan hasil hapus, atau
soft-delete di DB tidak difilter saat query ulang).
**Area teknis:** `apps/backoffice/app/(dashboard)/purchase-orders/internal/`, kemungkinan juga
`app/pos/(authenticated)/internal-order/_components/internal-order-form.tsx` (sisi requester).
**Belum jelas:** ini terjadi di halaman backoffice (approver) atau di web POS (requester), atau
keduanya?

## 5. Tampilan piutang tidak ada tanggal transaksi
**Kategori:** Fitur (penambahan kolom/info)
**Deskripsi:** halaman/laporan piutang perlu menampilkan tanggal transaksi terkait, bukan cuma
info piutang itu sendiri.
**Area teknis:** `apps/backoffice/app/(dashboard)/reports/receivables/` (`receivables-client.tsx`),
kemungkinan juga `master-data/customers/[id]/_components/customer-detail-client.tsx` (riwayat
piutang per pelanggan).
**Belum jelas:** "tanggal transaksi" di sini maksudnya tanggal transaksi penjualan yang jadi utang,
atau tanggal piutang itu dicatat/jatuh tempo? Perlu konfirmasi kolom mana yang dimaksud.

## 6. Harga hasil edit balik ke semula di daftar tunggu web POS
**Kategori:** Bug
**Deskripsi:** kasir mengedit harga di keranjang, menyimpan sebagai "daftar tunggu" (hold/open
bill), lalu saat dibuka kembali harga sudah kembali ke harga asal (perubahan tidak tersimpan).
**Area teknis:** `apps/backoffice/components/pos/open-bills-drawer.tsx`, `components/pos/pos-client.tsx`
**Dugaan akar masalah:** kemungkinan snapshot open bill menyimpan `productId` + referensi harga
asli, bukan harga hasil edit — perlu dicek skema `openBills` di `packages/db/src/schema/transactions.ts`.

## 7. Fitur Hapus Produk dari master data
**Kategori:** Fitur
**Klarifikasi user:** ini fitur hapus **produk sepenuhnya** dari master data, bukan sekadar
mengosongkan field nama.
**Area teknis:** `apps/backoffice/app/(dashboard)/master-data/products/`
**Belum jelas:**
- Hard delete atau soft delete (mengingat aturan proyek: histori transaksi kritis tidak boleh
  di-wipe demi merapikan master — biasanya dipakai pola snapshot + `SET NULL`, bukan cascade
  delete)?
- Bagaimana kalau produk sudah pernah punya transaksi/stok — apakah tetap boleh dihapus (dengan
  guard), atau hanya boleh untuk produk yang belum pernah dipakai sama sekali?
- Perlu soft-guard: tolak hapus kalau masih ada stok > 0 atau ada PO/transaksi terkait?

## 8. Fitur salin harga ikut menyalin modal (seharusnya tidak)
**Kategori:** Bug/Fitur (perubahan perilaku)
**Deskripsi:** fitur "salin dari produk lain" di halaman harga saat ini ikut menyalin modal
(HPP) selain harga jual — user minta modal **tidak** ikut disalin.
**Area teknis:** `apps/backoffice/app/(dashboard)/master-data/prices/_components/copy-branch-modal.tsx`
**Catatan konteks:** perilaku "copy = satuan + harga + modal" ini adalah keputusan desain yang
sudah dikunci sebelumnya (lihat `docs/work/backlog/2026-07-04-uom-inline-grid-management.md`,
poin 3). Ini permintaan untuk **mengubah** keputusan itu — perlu konfirmasi apakah modal dihapus
total dari alur copy, atau dijadikan opsional (checkbox) seperti pemilihan UOM yang sudah ada.

---

## Belum terjawab (perlu klarifikasi lanjutan sebelum eksekusi)
- 1a: batasan status/role untuk hapus nota transfer internal.
- 1b: field & status PO yang boleh diedit.
- 2: apakah bug numbering muncul di SJ bulk sale, SJ internal transfer, atau keduanya.
- 3: contoh kasus konkret data yang salah tercetak.
- 4: lokasi bug — sisi backoffice, web POS requester, atau keduanya.
- 5: "tanggal transaksi" = tanggal transaksi penjualan atau tanggal piutang dicatat.
- 8: modal dihilangkan total dari copy, atau jadi opsional.
