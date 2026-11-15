# Backlog — Manajemen Satuan Inline di Grid Harga (lanjutan unify-satuan)

**Status:** ✅ SELESAI (1.41.0, 2026-07-04) — kolom Konversi editable + dialog konfirmasi batch,
baris draft "+ satuan", hapus dua-tingkat (cabang vs global cascade), modal salin dari produk lain.

**Tanggal:** 2026-07-04
**Halaman:** `apps/backoffice/app/(dashboard)/master-data/prices/`
**Menggantikan:** modal "+ satuan" dari 1.41.0 (`add-uom-modal.tsx`) — dinilai kurang: konversi tidak
terlihat di grid, tambah satuan lewat modal terpisah dari pengisian harga.

## Masalah
Grid harga tidak menampilkan ratio konversi (operator melihat baris "DUS" tanpa tahu 1 DUS = berapa
satuan dasar), dan menambah satuan lewat modal memutus alur "satuan + harga" jadi dua langkah.
Tidak ada cara menghapus satuan/harga dari grid. Tidak ada cara menyalin struktur satuan + harga
dari produk sejenis.

## Keputusan desain yang sudah dikunci (2026-07-04)
1. **Kolom Konversi editable inline, konfirmasi batch saat simpan** — ratio diedit seperti harga
   (warna beda/ungu = kelas global). Saat Ctrl+S ada perubahan ratio → satu dialog merinci semua
   perubahan global (ratio lama → baru + cabang yang sudah punya harga) yang wajib dikonfirmasi.
   Perubahan harga murni tersimpan tanpa dialog.
2. **Hapus = dua aksi eksplisit** per baris: "Hapus harga cabang ini" (hanya `product_prices` +
   `product_uom_costs` cabang aktif) dan "Hapus satuan GLOBAL" (hapus konversi + semua harga/modal
   di SEMUA cabang; konfirmasi keras menampilkan daftar cabang terdampak).
3. **Copy dari produk lain = satuan + harga + modal** — konversi ditulis global, harga & modal ke
   cabang aktif saja. Ratio bentrok dengan konversi target yang sudah ada → dilaporkan, tidak
   ditimpa diam-diam.

## Scope
- **Kolom "Konversi"** di grid: `= N {UOM dasar}` per baris; baris UOM dasar bertanda "dasar";
  editable inline (kecuali baris dasar), dirty state warna ungu.
- **"+ satuan" memunculkan baris draft inline** di grup produk: dropdown UOM (+ buat UOM baru),
  input ratio, sel harga per tier + modal langsung diisi; tersimpan bersama Ctrl+S.
  UOM yang sudah punya konversi global tapi belum ber-harga di cabang aktif muncul di dropdown
  dengan ratio ter-prefill.
- **Dialog konfirmasi global** saat simpan berisi perubahan/pembuatan ratio.
- **Aksi hapus per baris** (menu): dua aksi sesuai keputusan #2.
- **Modal "Salin dari produk"**: cari produk sumber → preview satuan + ratio + harga tier + modal
  (cabang aktif) dengan checkbox per UOM → salin.
- API: perluas `GET /api/bo/master-data/prices` (ratio, conversion_id, base UOM); `DELETE` harga
  per cabang; `DELETE uom-conversions/[convId]` bertingkat (409 + daftar cabang → `?cascade=1`);
  endpoint copy-product (preview + execute); `PATCH` konversi tidak menyentuh `weightGram` bila
  tidak dikirim.

## Kriteria selesai
- [x] Ratio terlihat di grid untuk semua baris; baris dasar bertanda "dasar".
- [x] Edit ratio inline → dialog konfirmasi batch dengan ratio lama→baru + cabang pemakai; batal = tidak ada yang tersimpan.
- [x] Baris draft: tambah satuan baru + harga + modal dalam satu alur simpan.
- [x] Hapus harga per cabang & hapus satuan global (dengan konfirmasi keras) dari grid.
- [x] Copy satuan + harga + modal dari produk lain dengan preview & laporan konflik ratio.
- [x] Tab Satuan halaman produk tetap berfungsi; hapus dari sana ikut guard cascade baru.
- [x] Unit test endpoint baru/berubah; suite hijau (195 test / 33 file).
- [x] Update `apps/backoffice/CHANGELOG.md` (digabung ke entri 1.41.0 yang belum dirilis).
