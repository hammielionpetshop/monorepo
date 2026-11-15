# Backlog — Satukan Manajemen Satuan (Konversi UOM) ke Grid Harga

**Status:** ✅ SELESAI (1.41.0, 2026-07-04) — implementasi awal berupa modal "+ satuan", lalu di rilis yang sama
disempurnakan menjadi manajemen inline penuh di grid (lihat `2026-07-04-uom-inline-grid-management.md`).

**Tanggal:** 2026-07-04
**Halaman utama:** `apps/backoffice/app/(dashboard)/master-data/prices/`
**Terkait:** `apps/backoffice/app/(dashboard)/master-data/products/[id]/_components/` (tab Satuan / Harga / Harga Modal)
**Asal temuan:** friksi saat import G2 (Gudang pricing) — kategori `KONVERSI_HILANG_KOSONG` butuh 2 layar untuk 1 pekerjaan.

---

## Masalah

Manajemen data produk terpecah di **dua pintu** yang tidak konsisten:

**Pintu 1 — Halaman produk `[id]` (per-produk, 3 tab):**
- Tab **Satuan** (`uom-conversion-client.tsx`) → tambah/hapus konversi UOM (ratio, berat)
- Tab **Harga** (`price-tier-client.tsx`) → harga per tier
- Tab **Harga Modal** (`cost-matrix-client.tsx`) → modal per cabang/UOM

**Pintu 2 — Grid massal `master-data/prices` (`prices-client.tsx`):**
- Kolom: Produk · UOM · **Harga Modal** · tier A/B/C
- Sudah menggabungkan **harga + modal** dalam satu grid (edit sekaligus, Ctrl+S, salin antar-cabang).
- **TAPI** kolom UOM read-only — hanya bisa isi harga untuk UOM yang **sudah ada**. Tidak bisa menambah satuan baru dari sini.

Akibatnya: untuk produk yang perlu satuan baru (mis. Gudang jual per SAK/DUS tapi konversi belum ada),
operator harus buka tab **Satuan** di halaman produk untuk bikin konversi dulu → baru balik ke grid
untuk isi harga. Dua layar untuk satu alur kerja.

---

## Ketegangan desain yang WAJIB dijaga

| Aspek | Harga & Modal | Konversi Satuan |
|---|---|---|
| **Scope** | per-**cabang** (branch-scoped) | **global per-produk** (semua cabang) |
| Sumber tabel | `product_prices`, `product_uom_costs` (unik per product/branch/uom) | `product_uom_conversions` (unik per product/uom — **tanpa branch**) |

Grid `prices` difilter **per cabang**. Kalau tombol "tambah satuan + ratio" ditempel begitu saja,
operator yang sedang melihat cabang **Gudang** bisa mengubah ratio yang **diam-diam ikut mengubah
Toko** — persis bug `BERAS MERAH` yang ditemukan di G2 (Gudang ingin ratio 2, DB 50 karena toko
memakai 50). Pemisahan saat ini bukan sekadar kelalaian; ada alasan konsep branch-scoped vs global.

**Aturan kunci:** konversi tetap **satu sumber kebenaran** (`product_uom_conversions`). Grid hanya
menjadi pintu masuk kedua, bukan menyalin/menduplikasi data konversi per cabang.

---

## Solusi yang diusulkan

Gabungkan manajemen satuan ke grid `prices`, **tanpa menghilangkan sinyal global-nya**:

1. **Aksi "+ Tambah satuan"** per produk langsung di grid → buka mini-form ratio (reuse logika
   `uom-conversion-form.tsx`). Setelah simpan, baris UOM baru muncul dan langsung bisa diisi harga.
2. **Badge "GLOBAL — berlaku semua cabang"** yang mencolok pada kolom UOM saat ratio diedit/ditambah.
3. **Konfirmasi bentrok:** bila ratio yang diisi berbeda dari ratio yang sudah dipakai (dan sudah
   ada transaksi/harga di cabang lain), tampilkan ratio existing + minta konfirmasi eksplisit sebelum
   menimpa. Jangan overwrite diam-diam.
4. Konversi tetap ditulis ke `product_uom_conversions` (idempotent, unik per product/uom).

---

## Kriteria selesai
- [x] Operator bisa menambah satuan (UOM + ratio) untuk sebuah produk **tanpa meninggalkan grid** `prices`.
- [x] Menambah/mengubah ratio menampilkan peringatan scope global yang jelas.
- [x] Mengubah ratio yang sudah dipakai cabang lain memicu konfirmasi (menampilkan ratio lama).
- [x] Tidak ada duplikasi data konversi; sumber tunggal tetap `product_uom_conversions`.
- [x] Tab **Satuan** di halaman produk tetap berfungsi (pintu masuk lama tidak dihapus).
- [x] Update `apps/backoffice/CHANGELOG.md`.

## Prioritas & effort
**Prioritas:** Sedang (peningkatan UX, bukan blocker) · **Effort:** M–L (frontend grid + reuse form
konversi + guard bentrok) · **Depends:** — (independen dari G2, tapi lahir darinya)

## Catatan
- Pertimbangkan apakah tab **Harga** & **Harga Modal** yang terpisah di halaman produk masih perlu,
  atau cukup diarahkan ke grid `prices` yang sudah menggabungkan keduanya (potensi konsolidasi lanjutan).
