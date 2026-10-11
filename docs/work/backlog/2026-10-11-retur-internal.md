# Backlog — Retur Internal, Revisi Harga Beli & Supplier Nonaktif

**Status:** RI0 selesai · RI1 tayang 1.107.59 · RI1b tayang 1.107.60 · RI2 tayang 1.107.61 · RI3–RI9 (termasuk RI3b & RI8b) tayang 1.107.62 (rilis gabungan 2026-10-11, belum diuji di layar sebelum rilis) · perbaikan Mutasi Stok batal retur pelanggan tayang 1.107.63 · **berikutnya: owner mencoba di toko dengan satu dokumen kecil, lalu "Perbaikan terpisah"**
**Tanggal:** 2026-10-11
**Sumber rencana:** [`docs/work/specs/2026-10-11-retur-internal-design.md`](../specs/2026-10-11-retur-internal-design.md)
**Istilah:** [`docs/glosarium-bisnis.md`](../../glosarium-bisnis.md)
**Scope:** `apps/backoffice` (POS web + Back Office) + `packages/db`

Satu item = satu sesi = satu branch/worktree = satu commit fitur (pesan menyebut `RIn`).
Tiap item mengikuti alur baku: `klaim: <branch>` di `main` (+ **kunci migrasi** bila ada
migrasi) → worktree → kode + tes → typecheck/lint/test/`changelog:check`/`migrations:check` →
owner coba di laptop (atau owner memutuskan langsung rilis) → backup DB produksi → rilis →
`klaim: lepas <branch>`. Item berisiko tinggi **tidak digabung** dengan item lain.

**Perubahan alur rilis — keputusan owner 2026-10-11 (berlaku RI3–RI9):**
- Tetap satu item = satu sesi = satu branch = satu commit fitur, tetapi **tidak dirilis per item**.
  Branch tiap item bercabang dari branch item sebelumnya (bertumpuk).
- Setelah RI9 selesai: owner mencoba semuanya sekali di laptop (DB uji disalin ulang dari backup
  produksi terbaru) → backup DB produksi → **satu rilis gabungan** RI3–RI9 → coba satu transaksi
  kecil dulu sebelum dipakai rutin.
- Alasan aman digabung: semuanya fitur baru (efek stok/uang hanya saat dokumen disetujui Owner/GM),
  migrasi hanya menambah tabel, dan tahap-tahapnya saling bergantung sehingga rilis terpisah tidak
  menambah keamanan. Satu-satunya bagian yang menyentuh alur harian: **RI7** (Bayar/Terima Hutang
  Internal) — wajib diuji owner.
- **Setiap pertanyaan bisnis baru atau temuan yang bertentangan dengan spec/keputusan** dilaporkan
  ke owner dan dicatat di spec/glosarium **sebelum** item itu dilanjutkan — tidak diputuskan sendiri.

## Urutan pengerjaan

```
RI0 ✅ → RI1 ✅ → RI1b ✅ → RI2 ✅ → RI3 ✅ → RI3b ✅ → RI4 ✅ → RI5 ✅ → RI6 ✅ → RI7 ✅ → RI8 ✅ → RI8b ✅ → RI9 ✅
         └──────── rendah ─────────────┘   └──────── tinggi (stok/uang/DB) ──────────┘
```

---

## RI0 — Dokumen (glosarium, spec, backlog) ✅

- [x] `docs/glosarium-bisnis.md` + tautan dari `CLAUDE.md`
- [x] Spec retur internal (draf + jawaban owner)
- [x] Keputusan lama "barang kurang terima bukan retur" dicoret & diganti di spec Retur Supplier / Hutang Supplier

## RI1 — Supplier aktif/nonaktif *(migrasi kecil — ambil kunci migrasi)*

### Scope teknis
- Migrasi: kolom `suppliers.is_active boolean NOT NULL DEFAULT true`; nonaktifkan supplier
  **Gudang**, **Repack**, **Return** (dicari per nama di migrasi, tercatat di audit/komentar).
- Pilihan supplier untuk dokumen **baru** (PO baru, Retur Supplier Luar) hanya yang aktif.
  Daftar & detail dokumen lama tetap menampilkan nama supplier nonaktif.
- Master Data → Supplier: tanda & tombol **Aktifkan/Nonaktifkan** (bukan hapus), tercatat di audit.
### Titik rawan
- Semua tempat yang membaca daftar supplier (form PO, filter laporan/Hutang Supplier) — filter
  laporan **tetap** menampilkan supplier nonaktif supaya data lama bisa dicari.
### Kriteria selesai
- [x] Supplier nonaktif tidak muncul di form PO baru & Retur Supplier Luar (server juga menolak).
- [x] PO/hutang lama dengan supplier nonaktif tetap tampil normal.
- [x] Tes + semua cek lulus (`lib/services/supplier-active.integration.test.ts`).
### Catatan
- Tombol **Hapus** supplier (bawaan developer) masih ada — owner setuju (2026-10-11) diganti "Nonaktifkan" sesuai prinsip tanpa hapus → item **RI1b**.

## RI1b — Ganti tombol Hapus supplier dengan Nonaktifkan

### Scope teknis
- Master Data → Supplier: tombol **Hapus** dihilangkan; API `DELETE` menolak dengan pesan "gunakan Nonaktifkan".
  Tanpa migrasi.
### Kriteria selesai
- [x] Tidak ada jalan menghapus supplier dari aplikasi (tombol dihapus, API `DELETE` → 405); nonaktifkan tetap tercatat di audit.

## RI2 — Alasan "Barang tidak datang / kurang kirim" di Retur Supplier Luar

### Scope teknis
- Tambah alasan `TIDAK_DATANG` (label "Barang tidak datang / kurang kirim") di service, form,
  daftar, cetak. Tanpa migrasi (kolom `reason` varchar(20)).
### Kriteria selesai
- [x] Bisa dipilih di POS & Back Office; tampil di daftar, persetujuan, dan cetak.

## RI3 — Pintu masuk dua kotak pilihan

### Scope teknis
- POS (Produk → Retur) dan Back Office: layar pertama berisi **dua kotak besar** —
  **"Retur Supplier Luar"** (membuka form yang ada) dan **"Retur Internal"** (sementara bertanda
  "segera hadir" sampai RI6).
### Kriteria selesai
- [x] Kasir memilih jenis retur sebelum mengisi form; teks mudah dipahami. (POS `/pos/produk/retur`, Back Office `/purchase-orders/retur`; komponen `components/supplier-returns/return-type-chooser.tsx`)

## RI3b — Batalkan Retur Supplier Luar + tarik pengajuan *(risiko tinggi — stok & uang; kemungkinan migrasi kecil)*

Keputusan owner 2026-10-11 — lihat spec retur internal bagian "Batalkan dokumen yang sudah disetujui".
### Scope teknis
- Tombol **Batalkan** pada Retur Supplier Luar berstatus Disetujui (Owner/GM, alasan wajib,
  popup wajib pilih) → status **Dibatalkan**; dokumen tetap tampil.
- Pembalikan dalam satu transaksi DB: stok masuk lagi (modal = HPP retur), potongan tagihan PO
  (pembayaran metode `RETUR`) dibatalkan, entri saldo supplier dibalik — semuanya berjejak.
- Ditolak bila saldo dari retur itu sudah terpakai ("Bayar dari Saldo Supplier") melebihi sisa saldo.
- Pengaju boleh **menarik** pengajuan yang masih Menunggu (status Ditarik, tanpa efek).
- Kolom pembatalan (pembatal, waktu, alasan) kemungkinan butuh migrasi kecil → ambil kunci migrasi.
### Kriteria selesai
- [x] Tes DB: batal retur ber-PO (tagihan kembali), batal retur jadi saldo, ditolak bila saldo terpakai, tarik pengajuan (`lib/services/supplier-return-cancel.integration.test.ts`).
- [x] Mutasi Stok & riwayat pembayaran menampilkan pembalikan.
### Catatan pelaksanaan (2026-10-11)
- Migrasi 0033: `supplier_returns.cancelled_by_id / cancelled_at / cancellation_reason`; status baru `WITHDRAWN` (Ditarik) & `CANCELLED` (Dibatalkan).
- Pembalikan potongan tagihan = baris pembayaran **negatif** metode `BATAL RETUR` (baris RETUR lama tidak diubah); saldo = entri `BATAL_RETUR`; stok = batch baru dengan modal = HPP retur, Mutasi Stok `SUPPLIER_RETURN_CANCEL_IN`.
- Tombol Batalkan hanya di Back Office (Owner/GM); tombol Tarik di POS & Back Office (hanya pengaju).
- Kunci migrasi dipegang `feat/retur-batalkan` sampai rilis gabungan (RI4 ikut memakai kunci ini).

## RI4 — Fondasi database Retur Internal *(migrasi — ambil kunci migrasi)*

### Scope teknis
- Tabel dokumen retur internal (nomor, jenis `BARANG_DIKEMBALIKAN` / `REVISI_HARGA`, cabang
  pengaju, cabang asal/tujuan, kode transaksi asal: IBT + nota Bulk Sale, status, alasan, nilai,
  pengaju/penyetuju, waktu, **kolom pembatalan & penarikan** sejak awal) + tabel baris barang (qty / harga lama & harga usulan & harga final).
- Tabel **Saldo Internal** (buku saldo per pasangan cabang **penerima → pengirim**, tidak hanya Gudang; + dari dokumen, − saat dipakai,
  menunjuk dokumen & pembayaran).
- Belum ada layar. Schema + migrasi + daftar tabel di `CLAUDE.md` + peta domain di `claims.md`.
### Kriteria selesai
- [x] `migrations:check` lulus; tabel hanya tambahan (data lama tidak berubah). Tes DB `lib/services/internal-return-schema.integration.test.ts`.
### Catatan pelaksanaan (2026-10-11)
- Migrasi 0034, schema `packages/db/src/schema/internal_returns.ts`: `internal_returns` (nomor `RI-YYYYMMDD-XXXX`,
  `kind`, `transfer_id` + `sale_transaction_id` wajib, `payable_id`, cabang pengaju/penerima/pengirim, nilai,
  `payable_deduction` / `credit_amount` / `cogs_adjustment`, `payable_payment_id`, `sale_return_id` → retur nota
  Bulk Sale, kolom persetujuan & pembatalan), `internal_return_items` (`transfer_item_id`, `sale_item_id`, qty,
  harga lama/usulan/final, `cogs`, `qty_consumed`, `cogs_adjustment`), `internal_credit_entries` (Saldo Internal,
  `debtor_branch_id` = penerima, `creditor_branch_id` = pengirim; `RETUR_INTERNAL` / `PAKAI` / `BATAL_RETUR`).
- **Tarik pengajuan** memakai kolom `resolved_*` (status `WITHDRAWN`), sama seperti Retur Supplier Luar (RI3b).
- Metode "SALDO INTERNAL" / potongan retur **tidak** dibuat sebagai baris `payment_methods` (tabel itu tidak punya
  tanda aktif, jadi metode baru bisa ikut muncul di pilihan bayar kasir). Gantinya kolom
  `inter_branch_payments.source_type` (`RETUR_INTERNAL` / `SALDO_INTERNAL` / `BATAL_RETUR`, NULL = pembayaran biasa)
  dan layar menampilkannya sebagai metode "SALDO INTERNAL" / "RETUR INTERNAL" (RI5/RI7).
- Migrasi 0034 sudah dijalankan di DB uji `petshop_wt_uji`.

## RI5 — Service "Barang Dikembalikan" *(risiko tinggi)*

### Scope teknis
- Ajukan: **kode transaksi wajib** (nomor IBT atau nota Bulk Sale) → daftar barang + qty yang
  masih bisa dikembalikan (diterima − sudah diretur). Siapa saja boleh mengajukan.
- Hanya **stok bagus** yang dikembalikan; barang rusak tetap lewat Barang Rusak.
- Setujui (Owner/GM, satu transaksi DB): stok cabang penerima keluar FIFO → stok **cabang
  pengirim** (Gudang atau toko) masuk (modal asli nota); nota Bulk Sale dikurangi (pola `ReturService.applyReturInTx` pada
  `converted_transaction_id`, seperti selisih terima IBT kanban #56); hutang internal dikurangi;
  kelebihan → Saldo Internal (dipakai otomatis di RI7). Tolak: tidak ada yang berubah.
- Mutasi Stok: dokumen sendiri di kedua cabang. Audit log.
### Titik rawan
- Kunci baris (retur, stok, hutang) supaya tidak bisa disetujui dua kali / melebihi qty.
- Hutang internal yang sudah dibayar sebagian/lunas.
### Kriteria selesai
- [x] Batalkan (Owner/GM) & tarik pengajuan — pola RI3b.
- [x] Tes DB: ajukan, qty melebihi, setujui (stok 2 cabang, nota, hutang), hutang lunas → saldo, tolak, batalkan, kiriman toko → toko (`lib/services/internal-return-goods.integration.test.ts`).
### Catatan pelaksanaan (2026-10-11)
- Service `lib/services/internal-return-service.ts`: `findReturnableTransfer` (kode IBT / nota), `createReturnedGoodsRequest`, `approveReturnedGoods`, `rejectInternalReturn`, `withdrawInternalReturn`, `cancelReturnedGoods`. Belum ada rute API/layar (RI6).
- Pengaju (bukan Owner/GM) hanya boleh untuk kiriman dari / ke cabangnya sendiri. Kiriman yang hutangnya **diputihkan** (WAIVED) ditolak — tidak ada hutang untuk dipotong (dikonfirmasi owner 2026-10-11, spec keputusan #13).
- Nilai = qty × harga baris IBT (sama dengan dasar hutang internal). Potongan hutang = baris pembayaran `source_type` RETUR_INTERNAL; kelebihan = entri Saldo Internal RETUR_INTERNAL (dipakai otomatis di RI7). Saldo dikunci per pasangan cabang (advisory lock).
- Stok pengirim masuk lewat retur nota Bulk Sale (`ReturService.applyReturInTx`, modal = HPP nota); pembatalan memakai `ReturService.cancelReturnInTx` (dipecah dari `cancelReturn`, perilaku lama tidak berubah).
- Mutasi Stok: `INTERNAL_RETURN_OUT` / `INTERNAL_RETURN_IN` / `INTERNAL_RETURN_CANCEL_IN` / `INTERNAL_RETURN_CANCEL_OUT`; retur nota milik Retur Internal disaring dari `RETURN_IN` supaya tidak dobel.

## Perbaikan terpisah (setelah rilis gabungan RI3–RI9)

- [x] **Mutasi Stok tidak mencatat pembatalan retur pelanggan biasa** *(dikerjakan 2026-10-11, branch `fix/mutasi-stok-batal-retur`: baris `RETURN_CANCEL_OUT` di `stock-ledger.ts` pada jam batal, retur nota milik Retur Internal disaring; tes `retur-cancel-ledger.integration.test.ts`; tanpa migrasi — **tayang 1.107.63**)* (bawaan lama, ditemukan saat RI5): `ReturService.cancelReturn` memotong stok lagi, tetapi `stock-ledger.ts` hanya punya baris `RETURN_IN` tanpa baris pembaliknya → saldo Mutasi Stok tidak cocok dengan stok. Owner setuju (2026-10-11) diperbaiki **terpisah**, satu rilis sendiri. Saat memperbaiki: retur nota milik Retur Internal sudah punya `INTERNAL_RETURN_CANCEL_OUT` — jangan dihitung dua kali.

- [ ] **Foto bukti transfer di pembayaran manual** — menggantikan rencana "nomor referensi wajib" (keputusan owner 2026-10-11, dibahas ulang): nomor referensi/bukti **tetap boleh kosong, tidak ada yang diwajibkan dulu**. Sebagai gantinya ditambah **foto bukti transfer (opsional, tidak ada pun tidak apa-apa)** yang muncul **khusus metode transfer / non-tunai**, supaya owner mudah memeriksa belakangan. Berlaku untuk semua pembayaran transfer yang dicatat manual — **bukan** pembayaran penjualan di kasir (POS). Urutan kebutuhan menurut owner: (1) pelunasan piutang pelanggan ke toko, (2) pembayaran hutang ke supplier, (3) pembayaran hutang internal antar cabang. Butuh migrasi kecil (kolom foto di tiga tabel pembayaran — ambil kunci migrasi). **Status setelah tayang ditulis "tayang — menunggu uji coba owner", bukan "selesai"** (permintaan owner: sistem masih baru).

## RI6 — Layar "Barang Dikembalikan" + persetujuan + cetak

### Scope teknis
- Form di kotak "Retur Internal" → pilihan **"Barang Dikembalikan"** (POS & Back Office).
- Antrean di **Permintaan Persetujuan** (popup wajib pilih). Cetak dokumen.
### Kriteria selesai
- [x] Alur ajukan → setujui/tolak bisa dilakukan dari layar (tes rute `lib/services/internal-return-screen.integration.test.ts`).
- [ ] Owner mencoba di laptop (dilakukan sekali untuk RI3–RI9 sebelum rilis gabungan).
### Catatan pelaksanaan (2026-10-11)
- Rute: `api/bo/internal-returns` (daftar, ajukan, `lookup?code=`, `[id]/approve|reject|cancel|withdraw`) dan `api/pos/internal-returns` (daftar, ajukan, `lookup`, `[id]/withdraw`). Setujui/tolak/batalkan = izin `void.approve` (Owner/GM), hanya dari Back Office.
- Layar: `/pos/produk/retur-internal` dan `/purchase-orders/internal-returns` (satu komponen `components/internal-returns/internal-returns-panel.tsx`): dua kotak jenis di atas — **Barang Dikembalikan** (aktif) dan **Revisi Harga Beli** ("Segera hadir" sampai RI9) — lalu form & riwayat. Cetak: `.../[id]/cetak`.
- POS selalu atas nama **cabang aktif** (hanya kiriman dari / ke cabang itu, juga untuk Owner); Back Office akun lintas cabang boleh kiriman cabang mana pun.
- Riwayat & cetak terlihat oleh cabang pengaju, penerima, dan pengirim; penyetuju melihat semua.
- Antrean **Retur Internal** di Permintaan Persetujuan (`void-requests/_components/internal-return-approvals.tsx`); angka penanda menu ikut menghitungnya. Popup penyetuju memperkirakan potongan hutang vs Saldo Internal dari sisa hutang saat itu — angka pasti dihitung server saat disetujui.
- Belum ada tautan dari layar Transfer Internal / Hutang Piutang Internal ke form retur (kode diketik manual) — bisa ditambahkan belakangan bila owner mau.

## RI7 — Saldo Internal otomatis *(risiko tinggi — uang)*

### Scope teknis
- Saldo langsung memotong tagihan internal terbuka tertua pasangan cabang yang sama; tagihan baru
  ikut dipotong otomatis bila masih ada saldo.
- Setiap pemakaian = pembayaran hutang internal metode **"SALDO INTERNAL"** + entri saldo
  negatif → tampil di Riwayat pembayaran Hutang Piutang Internal & audit.
- **Bukan uang kas**: tidak membuat catatan Pendapatan & Pengeluaran otomatis.
### Kriteria selesai
- [x] Tes DB: saldo memotong tagihan lama & baru; jejak lengkap; tidak ada entri kas (`lib/services/internal-credit-auto.integration.test.ts`).
- [ ] Owner mencoba di laptop (wajib — satu-satunya tahap yang menyentuh alur harian terima transfer; dilakukan sekali sebelum rilis gabungan).
### Catatan pelaksanaan (2026-10-11)
- Service `lib/services/internal-credit-service.ts`: `applyInternalCredit` (dipanggil di dalam transaksi), `internalCreditBalance`, `internalCreditRemainingOfReturn`, `listInternalCreditBalances`, `lockInternalCreditPair`. Tanpa migrasi.
- Dipanggil di tiga titik: **setujui** Barang Dikembalikan (saldo baru langsung dipakai), **terima transfer** (`api/bo/internal-transfers/[id]/status`, tagihan baru / bertambah), dan **batalkan** Barang Dikembalikan (hutang yang terbuka lagi dipotong saldo lain yang masih ada).
- Urutan pemakaian: tagihan terbuka tertua lebih dulu (tanggal dibuat), saldo dari dokumen retur tertua lebih dulu. Satu pemakaian = baris pembayaran `source_type` SALDO_INTERNAL (nomor referensi = nomor Retur Internal asal; keterangan menyebut nomor IBT + nomor nota Bulk Sale yang diretur — permintaan owner 2026-10-11 supaya asal saldo tidak membingungkan) + entri saldo `PAKAI` negatif (menunjuk retur, tagihan, dan baris pembayaran) + audit `INTERNAL_CREDIT_APPLY`. Tidak ada baris Pendapatan & Pengeluaran.
- Akibatnya saldo hanya tersisa bila pasangan cabang itu sedang tidak punya tagihan terbuka; sisanya tampil di kotak "Saldo Internal yang belum terpakai" di Hutang Piutang Internal.
- Batalkan: penjaga saldo kini per dokumen (sisa saldo milik retur itu), bukan hanya saldo pasangan cabang.
- Urutan kunci di ketiga titik sama (kiriman → stok → saldo pasangan cabang → hutang); tes menyetujui dua retur bersamaan lulus.
- Selama belum ada Retur Internal yang menghasilkan saldo, terima transfer berjalan persis seperti sebelumnya (hanya tambahan satu pengecekan saldo).

## RI8 — Service "Revisi Harga Beli" *(risiko tinggi)*

### Scope teknis
- Pemohon mengisi harga usulan per barang; penyetuju boleh mengubah sebelum setuju.
- Setujui: stok **tidak** bergerak; nilai nota Bulk Sale Gudang dikoreksi lewat dokumen; modal
  sisa batch toko dari IBT itu dibetulkan; hutang internal dikurangi selisih → saldo bila lunas.
- Bagian kiriman yang sudah terpakai → baris **"Penyesuaian Modal (Revisi Harga Beli)"** di Laba Rugi toko
  (keputusan owner 2026-10-11, lihat spec); wajib tampil di popup penyetuju, dokumen, dan cetakan.
### Kriteria selesai
- [x] Batalkan (Owner/GM) & tarik pengajuan — pola RI3b.
- [x] Tes DB: harga turun & naik, sebagian stok sudah terjual, hutang lunas → saldo, batalkan (`lib/services/internal-price-revision.integration.test.ts`, 7 tes).
### Catatan pelaksanaan (2026-10-11)
- Service `lib/services/internal-price-revision-service.ts`: `loadRevisableTransferItems`, `createPriceRevisionRequest`, `approvePriceRevision` (harga final per baris opsional), `cancelPriceRevision`; tolak & tarik memakai `rejectInternalReturn` / `withdrawInternalReturn` yang sudah ada. Belum ada rute API/layar (RI9) — rute setujui/batalkan yang ada masih khusus Barang Dikembalikan.
- **Migrasi 0035**: kolom `product_stock_batches.transfer_item_id` (batch → baris kiriman, diisi saat terima transfer mulai sekarang, data lama kosong) dan tabel `internal_return_batch_adjustments` (jejak modal batch sebelum/sesudah revisi, dipakai pembatalan). Kiriman lama yang batch-nya belum tertaut dicocokkan lewat cabang + produk + satuan + modal + waktu terima; batch yang tidak ditemukan dianggap sudah terpakai.
- Qty revisi = qty diterima − Barang Dikembalikan yang sudah disetujui (bukan input pemohon). Satu barang hanya boleh punya satu revisi yang menunggu. Harga lama = harga yang berlaku saat itu (harga nota, atau harga final revisi sebelumnya) — revisi boleh berantai.
- Penyesuaian Modal = nilai baris (qty × selisih) − koreksi nilai sisa batch, sehingga koreksi stok + penyesuaian modal selalu sama persis dengan perubahan hutang.
- Hutang: harga turun → baris pembayaran `RETUR_INTERNAL` + Saldo Internal (sama dengan Barang Dikembalikan, lalu `applyInternalCredit`). Harga **naik** → `total_amount` tagihan kiriman itu bertambah (tercatat di dokumen & audit; `payable_deduction` negatif).
- Laba Rugi (`lib/services/internal-return-report.ts`): pada tanggal disetujui — omzet cabang pengirim dikoreksi, Penyesuaian Modal di cabang penerima (kolom baru, masuk Laba Bersih). Dokumen yang dibatalkan tidak ikut. Penjualan per Produk & Dashboard menyusul di RI8b.
- Modal terbaru cabang penerima (Manajemen Harga) ikut dibetulkan lewat `syncCostFromInbound` — hanya bila kiriman itu masih barang masuk terbaru produk tersebut; lompatan ≥ 30% tetap masuk Tinjauan Modal.
- Aturan pembatalan (turunan dari "ditolak bila tidak bisa dibalik bersih"): ditolak bila batch kiriman sudah berubah sejak revisi (terjual / modal diganti), ada revisi atau Barang Dikembalikan lain sesudahnya untuk barang yang sama, saldonya sudah terpakai, atau kenaikan tagihannya sudah dibayar. Jalan keluar: Revisi Harga Beli baru yang mengembalikan harga (bagian terpakai dihitung ulang).
- Barang Dikembalikan setelah revisi memakai harga hasil revisi; Laba Rugi mengembalikan selisihnya ke omzet pengirim supaya tidak terpotong dua kali. Batalkan Barang Dikembalikan ditolak bila harga kiriman direvisi sesudahnya.

## RI8b — Koreksi Revisi Harga Beli di Penjualan per Produk & Dashboard

Keputusan owner 2026-10-11 (setelah laporan RI8): laporan lain ikut dikoreksi "agar lebih jelas"; bentuknya
disetujui owner. Lima aturan turunan RI8 (pencocokan batch kiriman lama, revisi seluruh qty, harga naik
dilayani, aturan Batalkan, Barang Dikembalikan memakai harga revisi) juga **disetujui** owner.
### Scope teknis
- Penjualan per Produk: pendapatan produk di cabang pengirim dikurangi koreksi (tulisan kecil "revisi
  harga −…", kolom CSV). Qty & HPP tidak berubah. Filter laporan (cabang, pelanggan, produk, kategori,
  brand, tier) ikut berlaku. Produk yang hanya direvisi dalam periode tetap muncul sebagai baris koreksi.
- Dashboard: omzet hari ini dikurangi koreksi cabang pengirim; perkiraan laba kotor ditambah Penyesuaian
  Modal cabang penerima.
### Kriteria selesai
- [x] Angka Penjualan per Produk & Dashboard sama dengan Laba Rugi (tes di `lib/services/internal-price-revision.integration.test.ts` + `sales-by-product-uom.test.ts`).
### Catatan pelaksanaan (2026-10-11)
- `lib/services/internal-return-report.ts` → `getInternalReturnProductAdjustments`; `sales-by-product-uom.ts` → `applyPriceRevisionsToSalesRows`; `dashboard-service.ts` memakai `getInternalReturnPLAdjustments` untuk hari ini. Tanpa migrasi.

## RI9 — Layar "Revisi Harga Beli" (pemohon & penyetuju)

### Scope teknis
- Form pemohon (harga lama → harga usulan) dan popup penyetuju (harga lama, usulan, kolom harga
  final yang bisa diubah). Cetak dokumen.
### Kriteria selesai
- [x] Alur ajukan → pratinjau → setujui (harga final diubah / tidak) → batalkan, tolak, tarik bisa dilakukan lewat rute layar (tes 4–5 di `lib/services/internal-return-screen.integration.test.ts`, hitungan popup di `lib/internal-price-revision-math.test.ts`).
- [ ] Owner mencoba alur penuh di laptop (dilakukan sekali untuk RI3–RI9 sebelum rilis gabungan).
### Catatan pelaksanaan (2026-10-11)
- Tanpa migrasi. Kotak **Revisi Harga Beli** di `components/internal-returns/internal-returns-panel.tsx` aktif; form pemohon `price-revision-form.tsx`: semua barang kiriman tampil dengan harga yang berlaku sekarang, pemohon mengisi **harga yang benar** hanya pada barang yang salah (qty tidak diisi — selalu seluruh qty kiriman dikurangi yang sudah dikembalikan).
- Rute tidak bertambah kecuali satu: `api/bo|pos/internal-returns` (POST) dan `lookup` membedakan jenis lewat `kind=REVISI_HARGA`; `[id]/approve` & `[id]/cancel` memilih service dari jenis dokumen (`lib/internal-return-http.ts`); baru: `api/bo/internal-returns/[id]/preview` (izin penyetuju) untuk pratinjau popup.
- Popup penyetuju `price-revision-approve-dialog.tsx`: harga lama (harga yang berlaku **saat ini**, bukan saat diajukan), usulan pemohon, kolom harga final; per barang tertulis "x dari y sudah terjual / terpakai — modal dikoreksi turun/naik Rp …" + sisa stok yang modalnya diganti. Angkanya dari `previewPriceRevision` (baca saja, tanpa mengunci) + `lib/internal-price-revision-math.ts` — rumus yang sama dengan saat disetujui; angka pasti tetap dihitung ulang server.
- "Sudah terjual / terpakai" = bagian kiriman yang tidak lagi ditemukan di stok cabang penerima (terjual, dipindah, rusak, atau batch kiriman lama yang tidak bisa dicocokkan — sesuai aturan RI8).
- Riwayat, antrean Permintaan Persetujuan, dan cetak: Revisi Harga Beli tampil sebagai "harga lama → harga baru" dan "Tagihan turun/naik Rp …" (bukan nilai retur); setelah disetujui juga Penyesuaian Modal. Judul cetak: SURAT REVISI HARGA BELI.
- Batalkan / tarik / tolak memakai tombol & rute yang sama dengan Barang Dikembalikan, dengan teks peringatan khusus revisi.
