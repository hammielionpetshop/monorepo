# Retur ke Supplier — Design

Tanggal: 2026-10-10 (dokumen ditulis 2026-10-11)
Scope: `apps/backoffice` (Back Office + POS web), `packages/db`
Status: **Tayang di 1.107.58** (commit 59fc197 + 75a8623, rilis e0fef8d; 2026-10-11, owner minta langsung push — **belum diuji di layar**
sebelum rilis; backup DB sebelum rilis). Tahap 2 (retur internal) belum.

## Ringkasan

Barang yang **sudah diterima** dari supplier lalu ketahuan rusak/kadaluarsa/salah kirim
dikembalikan ke supplier. Stok harus keluar dan nilai barangnya kembali ke kita sebagai
**potongan tagihan PO**; kalau tagihan sudah lunas (atau retur tanpa PO), nilainya menjadi
**saldo supplier** yang dipakai membayar tagihan berikutnya.

Fitur ini dokumen baru (`RS-YYYYMMDD-XXXX`), terpisah dari:

- **Barang Rusak** (`damaged_goods`) — kerugian toko, tidak ada uang kembali.
- **Retur pelanggan** (`returns`, `retur-service.ts`) — arah sebaliknya.

## Keputusan owner (2026-10-10)

| # | Keputusan |
|---|---|
| 1 | Supplier biasanya tukar barang, kadang potong tagihan. Yang dipakai: **potong tagihan**; barang pengganti masuk sebagai **PO biasa**. |
| 2 | Saldo lebih → dipakai untuk tagihan berikutnya supplier itu, **dipilih manual** ("Bayar dari Saldo Supplier"). |
| 3 | PO asal **tidak wajib**. Dengan PO: pilih dari dropdown PO supplier itu. Harga = harga faktur (kalau belum, harga PO). Tanpa PO: harga = modal terakhir, **penyetuju boleh ubah**; seluruh nilai jadi saldo supplier. |
| 4 | Semua kasir boleh mengajukan. Persetujuan **Owner/GM saja**, tanpa PIN, di layar Permintaan Persetujuan. Alasan wajib (min. 5 huruf), foto opsional. |
| 5 | Stok keluar **saat disetujui** (bukan saat diajukan). |
| 6 | Barang Rusak tetap terpisah; opsi tindak lanjut `RETUR_SUPPLIER` di Barang Rusak **dihapus** supaya tidak dobel. |
| 7 | **Tanpa batas waktu** retur. |
| 8 | Ada **cetak dokumen retur** (A4) untuk supplier/sopir. |
| ~~—~~ | ~~Kasus "barang kurang terima" **bukan** retur (tanggung jawab kepala gudang).~~ **DIGANTI 2026-10-11** (lihat bawah). |

### Keputusan owner 2026-10-11 (menggantikan baris yang dicoret)

- Kasus **"barang tidak datang / kurang kirim"** — kasir sudah mengonfirmasi lengkap, stok masuk
  sistem, belakangan ketahuan sebagian barang tidak datang — **boleh** lewat Retur ke Supplier
  (stok dianggap kurang, tagihan supplier dipotong). Dulu kasus ini tidak punya jalan keluar;
  inilah alasan utama owner membuat fitur retur. Penanganan Gudang & toko bisa berbeda, tapi
  memakai fitur yang sama.
- Supplier **"Gudang"**, **"Repack"**, **"Return"** (data bawaan sistem lama, lihat
  `docs/glosarium-bisnis.md`) **disembunyikan** dari Retur ke Supplier — pengembalian ke Gudang
  lewat **Retur Internal** (direncanakan, `2026-10-11-retur-internal-design.md`).
- Alasan retur ditambah **"Barang tidak datang / kurang kirim"**.
- Pintu masuk retur di kasir & Back Office jadi **dua kotak pilihan**: "Retur Supplier Luar" dan
  "Retur Internal".
- Status: supplier aktif/nonaktif tayang 1.107.59 (RI1), alasan "Barang tidak datang / kurang
  kirim" (`TIDAK_DATANG`) selesai dikoding, menunggu rilis 1.107.61 (RI2); pintu dua kotak = RI3.

### Keputusan owner 2026-10-11 (lanjutan)

- **Batalkan** retur yang sudah disetujui: Owner/GM, alasan wajib, dokumen jadi Dibatalkan dan
  stok/tagihan/saldo dibalik berjejak; ditolak bila saldo dari retur itu sudah terpakai. Pengaju
  boleh **menarik** pengajuan yang masih menunggu. Direncanakan sebagai **RI3b** (lihat
  `docs/work/backlog/2026-10-11-retur-internal.md`).
- Salah kirim: barang yang datang tapi tidak dipesan dicatat lewat **PO baru**.

## Alur

```
Kasir/staf ajukan (POS atau BO)
        │  status PENDING — stok & tagihan BELUM berubah
        ▼
Owner/GM di Permintaan Persetujuan
   ├─ Tolak (alasan wajib) → REJECTED, tidak ada yang berubah
   └─ Setujui → APPROVED, dalam SATU transaksi DB:
        1. validasi ulang terhadap PO saat ini (harga faktur diambil ULANG, sisa qty dicek ulang)
        2. stok dipotong FIFO (StockService.deductStock, allowNegative=false)
        3. nilai = Σ qty × harga; HPP (cogs) FIFO disimpan per baris
        4. potong sisa tagihan PO asal → baris supplier_payable_payments metode 'RETUR'
        5. sisanya → supplier_credit_entries (+) sourceType 'RETUR'
```

Pembagian nilai: `splitReturnValue()` di `lib/services/supplier-return-service.ts` — tagihan
yang masih terbuka (bukan PAID/WAIVED) dipotong lebih dulu, kelebihannya jadi saldo.

### Memakai saldo supplier

Di jendela **Catat Pembayaran** (Hutang Supplier / detail PO) muncul centang
"Bayar dari Saldo Supplier" bila saldo > 0. Server (`api/bo/supplier-payables/[id]/pay`):
mengunci baris supplier (`lockSupplier`, FOR UPDATE), menolak bila nominal > saldo, mencatat
pembayaran metode `'SALDO SUPPLIER'` + entri kredit negatif (sourceType `'PAKAI'`).
Metode `RETUR` dan `SALDO SUPPLIER` tidak boleh diketik manual.

## Struktur database (migrasi `0031_supplier_returns.sql` — hanya menambah tabel)

| Tabel | Isi |
|---|---|
| `supplier_returns` | Header: nomor, supplier, cabang, PO asal (nullable), alasan (`EXPIRED`/`RUSAK`/`TIDAK_DATANG`/`SALAH_KIRIM`/`LAINNYA`), catatan, sumber (`POS`/`BO`), status (`PENDING`/`APPROVED`/`REJECTED`), total nilai, total HPP, `payable_deduction`, `credit_amount`, `payable_payment_id`, pengaju/penyetuju & waktunya, alasan tolak. |
| `supplier_return_items` | Baris barang: produk, satuan, `po_item_id` (nullable), qty, harga satuan, nilai baris, HPP FIFO (diisi saat disetujui), foto. |
| `supplier_credit_entries` | **Buku saldo supplier.** Saldo = `SUM(amount)` per supplier. `+` dari retur (`RETUR`), `−` saat dipakai bayar (`PAKAI`). |

Schema Drizzle: `packages/db/src/schema/supplier_returns.ts`.

**Kenapa potong tagihan lewat baris pembayaran, bukan mengubah `total_amount`:**
`update-invoice` dan `po-batch-updater` menghitung ulang `total_amount` dari qty × harga;
perubahan langsung ke total akan tertimpa. Baris pembayaran `RETUR` tetap utuh dan terlihat
di riwayat bayar.

## Peta berkas

| Bagian | Lokasi |
|---|---|
| Logika inti (ajukan, setujui, tolak, saldo) | `lib/services/supplier-return-service.ts` |
| Query daftar/detail/opsi form | `lib/services/supplier-return-queries.ts` |
| Handler bersama POS & BO | `lib/supplier-return-http.ts` |
| API BO | `app/api/bo/supplier-returns/**` (list/create, options, `[id]/approve`, `[id]/reject`) |
| API POS | `app/api/pos/supplier-returns/**` (riwayat cabang, create, options) |
| Halaman BO | `app/(dashboard)/purchase-orders/supplier-returns/` (menu Pembelian → Retur ke Supplier) + `[id]/cetak` |
| Halaman POS | `app/pos/(authenticated)/produk/retur-supplier/` (Produk → Retur ke Supplier) + `[id]/cetak` |
| Komponen bersama | `components/supplier-returns/` (form, daftar, cetak, tipe) |
| Antrean persetujuan | `app/(dashboard)/void-requests/_components/supplier-return-approvals.tsx` (izin `void.approve` = OWNER/GM); angka menu di `api/bo/nav-badges` |
| Saldo di Hutang Supplier | `purchase-orders/supplier-payables/**`, `supplier-payment-dialog.tsx` |
| Mutasi Stok | `lib/services/stock-ledger.ts` — jenis `SUPPLIER_RETURN_OUT` (hanya APPROVED, tanggal disetujui) |

## Penjaga data

- Qty per baris PO ≤ `qty_received − qty_damaged − (retur lain yang PENDING/APPROVED)`.
- PO asal harus milik supplier & cabang yang sama, `EXTERNAL`, status `COMPLETED`.
- Baris PO "menunggu faktur" (`invoice_unit_cost = 0`) tidak bisa diretur sampai harga diisi.
- Stok tidak boleh minus; kalau stok kurang, persetujuan gagal dan tidak ada yang berubah.
- Persetujuan & penolakan mengunci baris retur (`FOR UPDATE`) — tidak bisa diproses dua kali.
- Saldo supplier dijaga satu kunci (baris `suppliers` FOR UPDATE) untuk tambah & pakai.
- Semua aksi tercatat di `audit_logs` (`SUPPLIER_RETURN_REQUEST/APPROVE/REJECT`).

## Ikut diperbaiki di branch ini

- **Mutasi Stok** dulu menampilkan Barang Rusak yang menunggu/ditolak sebagai stok keluar.
  Sekarang hanya yang APPROVED, pada jam disetujui.
- **Laba Rugi** dulu mengurangi laba dengan Barang Rusak yang ditolak/menunggu (prod: 11 laporan
  ditolak). Sekarang hanya APPROVED → angka Agu–Okt 2026 berubah saat rilis.

## Batasan yang diketahui

- Harga retur **tidak ikut berubah** kalau faktur PO dicocokkan ulang setelah retur disetujui.
- Setelah ada retur disetujui pada PO, **Batal Penerimaan** PO itu terkunci (tagihan sudah
  "terbayar" sebagian).
- HPP retur diambil FIFO dari batch tertua cabang itu, belum tentu batch dari PO asal.
- Selisih nilai klaim vs HPP FIFO tidak dibukukan ke Laba Rugi.
- Belum ada **Batalkan** untuk retur yang sudah disetujui, dan pengaju belum bisa menarik
  pengajuan — direncanakan RI3b.

## Temuan tinjauan ulang 2026-10-11 — sudah diperbaiki (ikut tayang 1.107.58)

1. **Sedang → diperbaiki.** Back Office dulu membuat retur atas nama cabang akun login. Kini akun
   `branchScope = ALL` memilih **Cabang retur** di atas form (`supplier-returns-client.tsx`);
   server memeriksa ulang lewat `resolveBoBranch` (`lib/supplier-return-http.ts`): cabang
   sendiri selalu boleh, cabang lain hanya untuk akun ALL dan harus cabang aktif (403/404).
   POS tidak berubah (selalu cabang aktif POS).
2. **Kecil → diperbaiki.** Laba Rugi & laporan rincian barang rusak memakai **tanggal disetujui**
   (`COALESCE(resolved_at, reported_at)`), sama dengan Mutasi Stok.
3. **Kecil → diperbaiki.** Daftar pengajuan PENDING ber-PO membawa `currentUnitPrice` (harga
   faktur PO saat ini, `supplier-return-queries.ts`); popup Setujui memakai harga itu dan
   menampilkan perubahan harga, serta memperingatkan bila harga faktur masih kosong.

## Cara uji

- Tes DB: `lib/services/supplier-return.integration.test.ts` (11 skenario: ajukan, qty
  melebihi sisa, setujui potong tagihan, PO lunas → saldo, tanpa PO, tolak, bayar dari
  saldo, Mutasi Stok barang rusak, harga popup terbaru, pilihan cabang BO,
  tanggal barang rusak di Laba Rugi). Jalankan dengan `STOCK_TEST_DATABASE_URL` ke DB lokal
  `petshop_wt_*` dan `vitest.stock-integration.config.ts`.
- Uji layar oleh owner di laptop (`next build` + `next start`, port 7272, DB salinan prod)
  sebelum push. Backup DB produksi sebelum rilis (ada migrasi).

## Tahap 2 (belum) — retur ke cabang internal

Usulan owner: barang dari Gudang dikembalikan ke cabang asal, hutang internal dikurangi,
tetap wajib persetujuan. Catatan: hutang internal berasal dari Bulk Sale (Gudang mencatat
PENJUALAN), jadi retur internal harus membalik nota Bulk Sale + potong stok penerima dengan
dokumen yang tampil di Mutasi Stok + kurangi `inter_branch_payables`. Risiko lebih tinggi.
