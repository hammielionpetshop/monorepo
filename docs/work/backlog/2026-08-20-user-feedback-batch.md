# Backlog — Batch Feedback User (2026-08-20)

**Status:** ✅ Selesai dikerjakan & di-merge lokal ke `main` 2026-08-21 (belum di-push/PR ke remote)
**Tanggal:** 2026-08-20
**Sumber:** Daftar 8 poin feedback user, diklarifikasi via tanya-jawab sebelum masuk tracker ini.

Catatan: item 1 dipecah jadi 1a & 1b karena diklarifikasi sebagai dua fitur terpisah yang kebetulan
sama-sama di halaman Transfer Internal (Purchase Order Internal / IBT).

| No | Deskripsi Asli | Kategori | Area / Modul | Prioritas | Branch usulan |
|----|-----------------|----------|---------------|-----------|---------------|
| 5  | Tanggal transaksi tidak tampil di laporan piutang | Fitur | `reports/receivables` | **P1** | `fix/piutang-tanggal-transaksi` |
| 8  | Salin harga ikut menyalin modal | Bug/Fitur | `master-data/prices/copy-branch-modal.tsx` | **P1** | `feat/copy-harga-modal-opsional` |
| 6  | Harga hasil edit balik ke semula di daftar tunggu POS | Bug | `components/pos/open-bills-drawer.tsx` | **P1** | `fix/open-bill-harga-edit` |
| 7  | Hapus produk dari master data | Fitur | `master-data/products` | **P1** | `feat/hapus-produk-master` |
| 1a | Void nota bulk-sale asal IBT tidak reset status IBT | Bug | `lib/services/void-service.ts`, `purchase-orders/internal` | **P2** | `fix/void-reset-ibt` |
| 2  | Bug numbering di surat jalan (2 digit kepotong baris) | Bug | Cetak surat jalan (dot-matrix) | **P2** | dalam `investigate/sj-internal-transfer` |
| 3  | Data surat jalan di halaman internal transfer belum sesuai | Bug | `purchase-orders/internal` — cetak SJ | **P2** | `investigate/sj-internal-transfer` |
| 4  | Item yang qty-nya dikosongkan tetap muncul di PO internal (sisi backoffice/approver) | Bug | `purchase-orders/internal` | **P2** | `investigate/sj-internal-transfer` |
| 1b | Fitur Edit PO di Transfer Internal | Fitur | `purchase-orders/internal` | **P3** | `feat/edit-po-internal` (setelah P2 domain ini merge) |

Detail keputusan scope & urutan pengerjaan ada di bagian **Rencana Eksekusi** di paling bawah.

---

## 1a. Void nota bulk-sale asal IBT tidak reset status IBT
**Kategori:** Bug (bukan fitur baru — ini gap di alur void yang sudah ada)
**Area teknis:** `apps/backoffice/lib/services/void-service.ts`, `apps/backoffice/app/api/bo/void-requests/[id]/approve/route.ts`, `packages/db/src/schema/purchase_orders.ts` (`interBranchTransfers`)

**Klarifikasi user:** alurnya — cabang tujuan request via IBT, cabang asal memenuhi dengan membuat
nota penjualan (bulk sale) yang otomatis: `interBranchTransfers.convertedTransactionId = trx.id`
dan `status = 'APPROVED'` (lihat commit `b21e5a3`). Saat nota itu di-void lewat alur
ajukan-void-yang-sudah-ada, `performVoidWithinTx` di `void-service.ts` membalikkan stok & hutang
customer, **tapi tidak pernah menyentuh `interBranchTransfers`** — IBT tetap `APPROVED` menunjuk ke
transaksi yang sudah VOIDED, jadi request cabang tujuan itu "hilang" tanpa cara memprosesnya ulang.

**Perbaikan:** di `performVoidWithinTx`, tambah reverse-lookup `interBranchTransfers` yang
`convertedTransactionId = txId`. Kalau ada, reset: `convertedTransactionId = null`,
`status = 'PENDING_APPROVAL'`, `approvedById = null` — supaya IBT kembali ke kondisi sebelum
diproses via bulk sale dan bisa diproses ulang. Tidak perlu migrasi baru (kolom sudah ada).

## 1b. Fitur Edit PO di Transfer Internal
**Kategori:** Fitur
**Area teknis:** `apps/backoffice/app/(dashboard)/purchase-orders/internal/[id]/`, `api/bo/internal-transfers/[id]/route.ts` (perlu PATCH baru — saat ini cuma GET)

**Keputusan scope (dikonfirmasi user):** edit qty/item/cabang tujuan diperbolehkan selama status
masih **DRAFT / PENDING_APPROVAL / APPROVED / PREPARING** — batasnya tepat sebelum aksi `ship`
yang mulai memotong stok cabang asal (lihat `VALID_TRANSITIONS` di
`api/bo/internal-transfers/[id]/status/route.ts`). Begitu masuk `IN_TRANSIT`, tidak boleh diedit
lagi — harus batal (cancel) lalu buat baru.

**Kerjakan setelah** item 3 & 4 (bug data/tampilan di halaman yang sama) beres, supaya fitur edit
tidak dibangun di atas tampilan yang datanya sudah diketahui salah.

## 2. Bug numbering di surat jalan
**Kategori:** Bug
**Klarifikasi user:** ketika nomor surat jalan sudah 2 digit (contoh "10"), digit "1" dan "0"
tercetak di baris yang berbeda — bukan soal nomor duplikat/loncat, tapi soal layout/wrapping
cetakan yang salah menangani nomor multi-digit.
**Area teknis diduga:** komponen cetak dot-matrix ESC/P — lihat `bulk-sale-delivery-note-print.tsx`
dan `lib/qz-print.ts` (fungsi `padEnd`/`padStart` baris nomor nota), dan kemungkinan komponen
serupa di `internal-transfer-detail-client.tsx` (lihat juga
`docs/work/specs/2026-07-10-surat-jalan-qz-tray-dotmatrix.md` untuk konteks implementasi QZ Tray).
**Status:** ditahan sebagai **investigate-first** — belum ada contoh cetakan/foto. Digabung satu
sesi investigasi dengan item 3 & 4 karena satu domain (`purchase-orders/internal`), tapi begitu
akar masalahnya ketemu boleh dipecah jadi PR sendiri (kemungkinan besar cuma menyentuh
`qz-print.ts`, terpisah dari fix item 3/4).

## 3. Data surat jalan di halaman internal transfer belum sesuai
**Kategori:** Bug
**Klarifikasi user:** bukan soal layout/template, tapi **data yang tercetak salah atau kurang**
(nama barang, qty, atau cabang tujuan tidak sesuai dengan data transfer sebenarnya).
**Area teknis:** `apps/backoffice/app/(dashboard)/purchase-orders/internal/[id]/_components/internal-transfer-detail-client.tsx`
**Status:** **investigate-first** — perlu contoh kasus (nomor transfer + apa yang seharusnya
tercetak vs yang benar-benar tercetak) sebelum bisa di-fix. Satu sesi dengan item 2 & 4.

## 4. Item qty kosong di PO internal tetap muncul (sisi backoffice/approver)
**Kategori:** Bug
**Klarifikasi user:** dikonfirmasi terjadi di sisi **backoffice (approver)**, bukan di web POS
requester. Sisi requester (`internal-order-form.tsx`) sudah benar — hapus item di situ cuma filter
state lokal sebelum submit, jadi item yang dihapus di sana memang tidak pernah sampai ke DB.
**Area teknis:** `apps/backoffice/app/(dashboard)/purchase-orders/internal/[id]/_components/internal-transfer-detail-client.tsx`,
`api/bo/internal-transfers/[id]/stock-check/route.ts`
**Dugaan awal:** kemungkinan terkait alur qty=0 saat approver mengisi qty kirim untuk item yang
stoknya kosong (`stock-check` route mengembalikan `currentQty` per item, tapi tidak ada aksi
"hapus" — item dengan qty kirim 0 kemungkinan tetap dirender di tabel). Perlu direproduksi dengan
transfer sungguhan untuk konfirmasi. Satu sesi dengan item 2 & 3.

## 5. Tampilan piutang tidak ada tanggal transaksi
**Kategori:** Fitur (penambahan kolom)
**Keputusan (dikonfirmasi user):** yang dimaksud adalah **tanggal transaksi penjualan** yang jadi
utang, bukan tanggal piutang dicatat.
**Area teknis:** `apps/backoffice/app/(dashboard)/reports/receivables/page.tsx` — query di sini
**sudah** `leftJoin(transactions, ...)` tapi belum men-select tanggalnya. Tinggal tambah
`transactions.createdAt` ke `select()`, teruskan lewat `types.ts` (`ReceivableRow`), tampilkan
kolom baru di `receivables-client.tsx`. Tidak perlu migrasi, tidak perlu query baru — perubahan
kecil, murni tambah field.

## 6. Harga hasil edit balik ke semula di daftar tunggu web POS
**Kategori:** Bug
**Deskripsi:** kasir mengedit harga di keranjang, menyimpan sebagai "daftar tunggu" (hold/open
bill), lalu saat dibuka kembali harga sudah kembali ke harga asal (perubahan tidak tersimpan).
**Area teknis:** `apps/backoffice/components/pos/open-bills-drawer.tsx`, `components/pos/pos-client.tsx`
**Dugaan akar masalah:** kemungkinan snapshot open bill menyimpan `productId` + referensi harga
asli, bukan harga hasil edit — perlu dicek skema `openBills` di `packages/db/src/schema/transactions.ts`
(kolom `items` bertipe `jsonb`, jadi kemungkinan besar cukup pastikan harga hasil edit ikut masuk
ke snapshot JSON itu saat hold, bukan di-refetch ulang saat restore). Domain POS, berdiri sendiri,
tidak menyentuh domain lain.

## 7. Fitur Hapus Produk dari master data
**Kategori:** Fitur
**Klarifikasi user:** ini fitur hapus **produk sepenuhnya** dari master data, bukan sekadar
mengosongkan field nama.
**Area teknis:** `apps/backoffice/app/(dashboard)/master-data/products/`, `api/bo/master-data/products/[id]/route.ts`
**Catatan penting:** produk **sudah** punya toggle "Nonaktifkan/Aktifkan" (`isActive`) yang jalan —
tapi itu cuma menyembunyikan status, barisnya tetap ada di daftar. Ini permintaan yang berbeda:
produk benar-benar hilang dari daftar master.
**Keputusan desain (default, konsisten aturan proyek soal histori transaksi kritis):**
- Guard-based hard delete: tolak hapus (409) kalau produk masih punya stok > 0 di cabang manapun,
  atau punya baris di `transactionItems` / `purchaseOrderItems` / `interBranchTransferItems`.
- Kalau lolos guard (produk memang belum pernah dipakai), baru boleh hard delete beneran.
- Kalau produk sudah pernah dipakai tapi user tetap mau "membuang" dari daftar → arahkan ke
  `isActive = false` (fitur yang sudah ada) lewat pesan error yang jelas, bukan tambah state baru.
- Perlu cek FK constraint `ON DELETE` di migrasi terkait sebelum implementasi, supaya tidak
  mengandalkan guard aplikasi doang kalau DB-nya sendiri sudah `RESTRICT`.

## 8. Fitur salin harga ikut menyalin modal (seharusnya tidak)
**Kategori:** Bug/Fitur (perubahan perilaku)
**Deskripsi:** fitur "salin dari produk lain" di halaman harga saat ini ikut menyalin modal
(HPP) selain harga jual — user minta modal **tidak** ikut disalin.
**Area teknis:** `apps/backoffice/app/(dashboard)/master-data/prices/_components/copy-branch-modal.tsx`
**Keputusan (dikonfirmasi user):** modal jadi **checkbox opsional, default OFF** — konsisten
dengan pola pemilihan UOM yang sudah ada di modal yang sama. Tidak menghapus total kemampuan
menyalin modal, cuma diubah jadi eksplisit (harus dicentang).
**Catatan konteks:** perilaku lama ("copy = satuan + harga + modal" tanpa opsi) adalah keputusan
desain yang sudah dikunci sebelumnya (lihat `docs/work/backlog/2026-07-04-uom-inline-grid-management.md`,
poin 3) — ini secara sadar mengubah keputusan itu.
**Catatan klaim:** sempat terlihat bentrok dengan klaim `feat/export-import-harga` di
`docs/agents/claims.md` yang menyentuh domain harga yang sama — dicek ulang, branch itu **sudah
merge ke main** (PR #16). Baris klaimnya di `claims.md` basi dan perlu dihapus (lihat Rencana
Eksekusi).

---

## Rencana Eksekusi

**Cek klaim dulu:** `docs/agents/claims.md` masih mencantumkan `chore/pindah-postgres-ke-vps` dan
`feat/export-import-harga` sebagai klaim aktif, tapi keduanya sudah merge ke `main` (PR #15, #16).
Hapus dua baris itu di `main` sebelum mulai — supaya papan klaim tidak menyesatkan orang lain.

**Tidak ada kunci migrasi yang perlu diambil** — semua 8 item di batch ini tidak butuh migrasi
DB baru (item 1a & 5 pakai kolom yang sudah ada; item 7 hard delete tidak butuh kolom baru).

### Gelombang 1 — P1, jalan paralel (4 worktree, tidak beririsan file)
Tidak ada dependency antar item ini maupun dengan Gelombang 2 — boleh dikerjakan dalam urutan
apa pun atau bersamaan:
1. `fix/piutang-tanggal-transaksi` (item 5) — paling kecil, cocok jadi pemanasan.
2. `feat/copy-harga-modal-opsional` (item 8) — domain master-data/harga.
3. `fix/open-bill-harga-edit` (item 6) — domain POS, berdiri sendiri.
4. `feat/hapus-produk-master` (item 7) — domain master-data/produk.

### Gelombang 2 — domain `purchase-orders/internal`, sekuensial (satu domain, satu alur)
Ketiganya menyentuh file yang sama (`internal-transfer-detail-client.tsx` dkk), jadi dikerjakan
berurutan dalam domain yang sama supaya tidak tabrakan sendiri dan supaya fitur edit (1b) dibangun
di atas data yang sudah benar:
1. `fix/void-reset-ibt` (item 1a) — bug data-integrity, paling kecil & paling mendesak di gelombang
   ini, sentuhannya minim ke halaman detail IBT. Kerjakan & merge duluan.
2. `investigate/sj-internal-transfer` (item 2 + 3 + 4) — reproduksi dulu pakai transfer & cetakan
   sungguhan, baru fix. Boleh dipecah jadi PR terpisah per akar masalah begitu ketemu.
3. `feat/edit-po-internal` (item 1b) — setelah #2 di atas merge, supaya UI yang diedit sudah
   menampilkan data yang benar.

### Yang butuh dari user sebelum Gelombang 2 langkah 2 bisa mulai
- Contoh/foto cetakan surat jalan yang nomornya kepotong (item 2).
- Nomor transfer internal spesifik + apa yang seharusnya vs benar-benar tercetak (item 3).
- Transfer internal spesifik yang menunjukkan item qty-kosong masih muncul, kalau sempat kejadian
  lagi (item 4) — kalau tidak ada, mulai dari dugaan awal di atas (qty kirim 0 tetap dirender).
