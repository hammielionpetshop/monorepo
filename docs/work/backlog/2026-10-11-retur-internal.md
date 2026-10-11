# Backlog — Retur Internal, Revisi Harga Beli & Supplier Nonaktif

**Status:** RI0 selesai · RI1 tayang 1.107.59 · RI1b tayang 1.107.60 · RI2 tayang 1.107.61 · **berikutnya: RI3** · RI3b, RI4–RI9 belum
**Tanggal:** 2026-10-11
**Sumber rencana:** [`docs/work/specs/2026-10-11-retur-internal-design.md`](../specs/2026-10-11-retur-internal-design.md)
**Istilah:** [`docs/glosarium-bisnis.md`](../../glosarium-bisnis.md)
**Scope:** `apps/backoffice` (POS web + Back Office) + `packages/db`

Satu item = satu sesi = satu branch/worktree = satu commit fitur (pesan menyebut `RIn`).
Tiap item mengikuti alur baku: `klaim: <branch>` di `main` (+ **kunci migrasi** bila ada
migrasi) → worktree → kode + tes → typecheck/lint/test/`changelog:check`/`migrations:check` →
owner coba di laptop (atau owner memutuskan langsung rilis) → backup DB produksi → rilis →
`klaim: lepas <branch>`. Item berisiko tinggi **tidak digabung** dengan item lain.

## Urutan pengerjaan

```
RI0 ✅ → RI1 ✅ → RI1b ✅ → RI2 ✅ → RI3 → RI3b → RI4 → RI5 → RI6 → RI7 → RI8 → RI9
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
- [ ] Kasir memilih jenis retur sebelum mengisi form; teks mudah dipahami.

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
- [ ] Tes DB: batal retur ber-PO (tagihan kembali), batal retur jadi saldo, ditolak bila saldo terpakai, tarik pengajuan.
- [ ] Mutasi Stok & riwayat pembayaran menampilkan pembalikan.

## RI4 — Fondasi database Retur Internal *(migrasi — ambil kunci migrasi)*

### Scope teknis
- Tabel dokumen retur internal (nomor, jenis `BARANG_DIKEMBALIKAN` / `REVISI_HARGA`, cabang
  pengaju, cabang asal/tujuan, kode transaksi asal: IBT + nota Bulk Sale, status, alasan, nilai,
  pengaju/penyetuju, waktu, **kolom pembatalan & penarikan** sejak awal) + tabel baris barang (qty / harga lama & harga usulan & harga final).
- Tabel **Saldo Internal** (buku saldo per pasangan cabang **penerima → pengirim**, tidak hanya Gudang; + dari dokumen, − saat dipakai,
  menunjuk dokumen & pembayaran).
- Belum ada layar. Schema + migrasi + daftar tabel di `CLAUDE.md` + peta domain di `claims.md`.
### Kriteria selesai
- [ ] `migrations:check` lulus; tabel hanya tambahan (data lama tidak berubah).

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
- Batalkan (Owner/GM) & tarik pengajuan — pola RI3b.
- [ ] Tes DB: ajukan, qty melebihi, setujui (stok 2 cabang, nota, hutang), hutang lunas → saldo, tolak, batalkan, kiriman toko → toko.

## RI6 — Layar "Barang Dikembalikan" + persetujuan + cetak

### Scope teknis
- Form di kotak "Retur Internal" → pilihan **"Barang Dikembalikan"** (POS & Back Office).
- Antrean di **Permintaan Persetujuan** (popup wajib pilih). Cetak dokumen.
### Kriteria selesai
- [ ] Alur ajukan → setujui/tolak bisa dilakukan dari layar; owner mencoba di laptop.

## RI7 — Saldo Internal otomatis *(risiko tinggi — uang)*

### Scope teknis
- Saldo langsung memotong tagihan internal terbuka tertua pasangan cabang yang sama; tagihan baru
  ikut dipotong otomatis bila masih ada saldo.
- Setiap pemakaian = pembayaran hutang internal metode **"SALDO INTERNAL"** + entri saldo
  negatif → tampil di Riwayat pembayaran Hutang Piutang Internal & audit.
- **Bukan uang kas**: tidak membuat catatan Pendapatan & Pengeluaran otomatis.
### Kriteria selesai
- [ ] Tes DB: saldo memotong tagihan lama & baru; jejak lengkap; tidak ada entri kas.

## RI8 — Service "Revisi Harga Beli" *(risiko tinggi)*

### Scope teknis
- Pemohon mengisi harga usulan per barang; penyetuju boleh mengubah sebelum setuju.
- Setujui: stok **tidak** bergerak; nilai nota Bulk Sale Gudang dikoreksi lewat dokumen; modal
  sisa batch toko dari IBT itu dibetulkan; hutang internal dikurangi selisih → saldo bila lunas.
- Bagian kiriman yang sudah terpakai → baris **"Penyesuaian Modal (Revisi Harga Beli)"** di Laba Rugi toko
  (keputusan owner 2026-10-11, lihat spec); wajib tampil di popup penyetuju, dokumen, dan cetakan.
### Kriteria selesai
- Batalkan (Owner/GM) & tarik pengajuan — pola RI3b.
- [ ] Tes DB: harga turun & naik, sebagian stok sudah terjual, hutang lunas → saldo, batalkan.

## RI9 — Layar "Revisi Harga Beli" (pemohon & penyetuju)

### Scope teknis
- Form pemohon (harga lama → harga usulan) dan popup penyetuju (harga lama, usulan, kolom harga
  final yang bisa diubah). Cetak dokumen.
### Kriteria selesai
- [ ] Owner mencoba alur penuh di laptop.
