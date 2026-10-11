# Retur Internal & Revisi Harga Beli — Design (DRAF)

Tanggal: 2026-10-11
Scope: `apps/backoffice` (POS web + Back Office), `packages/db`
Status: **Draf — belum dikoding.** Dikerjakan bertahap; tiap tahap: klaim di `main` → worktree →
tes → owner coba di laptop → backup DB → rilis → lepas klaim. Istilah: `docs/glosarium-bisnis.md`.

## Latar

Barang dari Gudang ke toko diproses sebagai **Bulk Sale** (Gudang mencatat penjualan, toko punya
**hutang internal**) dan harga nota Gudang **otomatis jadi modal terbaru** di toko. Setelah
barang dikirim/diterima, nota itu **tidak punya jalan keluar** di sistem (dicek di kode
2026-10-11):

| Jalur | Status untuk nota Bulk Sale internal yang sudah dikirim |
|---|---|
| Void | diblok (`void-service.ts`, hanya status APPROVED/PREPARING) |
| Retur pelanggan | diblok (`retur-service.ts`, `INTER_BRANCH_SALE`) |
| Koreksi nota | diblok (`transaction-edit-service.ts`, nota `sourceIbtId`) |
| Retur ke Supplier | hanya supplier luar (PO EXTERNAL); tidak menyentuh stok Gudang / hutang internal |
| Transfer balik ke Gudang | memindah stok saja; hutang & omzet Gudang tetap — bila diproses lewat Bulk Sale malah dobel |

Owner sengaja **tidak** memakai fitur edit/koreksi bebas (prinsip "tidak ada edit & hapus" —
lihat glosarium). Jalan keluarnya harus berupa **dokumen** dengan alasan & persetujuan Owner/GM.

## Kasus nyata (owner, 2026-10-11)

1. **Barang tidak datang / kurang kirim** — kasir mengonfirmasi lengkap, stok masuk, belakangan
   ketahuan barang tertentu tidak datang.
2. **Salah kirim** — barang yang datang tidak sesuai. Barang yang tercatat tapi tidak datang (A)
   dibereskan lewat Retur Internal; barang yang datang tapi tidak dipesan (B) dicatat lewat
   **PO baru** (keputusan owner 2026-10-11).
3. **Salah harga** — Gudang memakai harga retail, seharusnya grosir.
4. Barang rusak di toko tetap lewat **Barang Rusak** (bukan retur). Yang dikembalikan ke cabang
   pengirim **hanya stok bagus** (keputusan owner 2026-10-11) — tidak ada barang rusak yang masuk
   lagi ke stok pengirim.

## Keputusan owner

| # | Keputusan |
|---|---|
| 1 | Barang **internal** yang diretur dianggap **kembali** ke stok Gudang; barang **supplier luar** dianggap **stok kurang**. |
| 2 | Hutang internal sudah lunas → kelebihannya jadi **saldo** untuk tagihan berikutnya. |
| 3 | Persetujuan **Owner/GM**. |
| 4 | Pintu masuk retur = **dua kotak pilihan besar**: **"Retur Supplier Luar"** dan **"Retur Internal"** (untuk kasir berpemahaman rendah). |
| 5 | Retur Internal **wajib memakai kode transaksi** (nota/transfer asal) supaya mudah dicari & jelas asalnya. |
| 6 | Di dalam Retur Internal ada dua pilihan: **barang rusak / tidak diterima** (stok kembali) dan **harga salah** (stok **tidak** bergeser, hanya harga). |
| 7 | Supplier "Gudang", "Repack", "Return" disembunyikan dari Retur Supplier Luar. |
| 8 | Alasan retur ditambah "Barang tidak datang / kurang kirim". |
| 9 | (2026-10-11) Yang kembali ke cabang pengirim **hanya stok bagus**; barang rusak tetap lewat Barang Rusak di toko. |
| 10 | (2026-10-11) Salah kirim: barang yang datang tapi tidak dipesan dicatat lewat **PO baru**; Retur Internal hanya untuk barang yang tercatat tapi tidak datang/dikembalikan. |
| 11 | (2026-10-11) Barang kembali ke **cabang pengirim** (Gudang **atau** toko lain), bukan selalu Gudang — lihat "Kiriman toko → toko" di bawah. |
| 12 | (2026-10-11) **Batalkan** dokumen yang sudah disetujui — lihat bagian "Batalkan dokumen yang sudah disetujui". |

## Penamaan (usulan, menunggu konfirmasi)

| Pilihan di layar | Arti | Catatan |
|---|---|---|
| **Retur Supplier Luar** | fitur yang sudah tayang (1.107.58) | nama menu sekarang "Retur ke Supplier" |
| **Retur Internal → "Barang Dikembalikan"** | barang tidak datang / salah kirim (stok bagus) → kembali ke cabang pengirim | |
| **Retur Internal → "Revisi Harga Beli"** | salah harga, stok tidak bergeser | Nama owner sudah tepat dari sisi toko (harga **beli** dari Gudang; bagi Gudang itu harga jual). Kata "revisi" dipilih karena hasilnya **dokumen baru yang tercatat**, bukan edit nota. Alternatif: "Selisih Harga". |

## Rancangan alur

### A. Barang Dikembalikan

```
Toko ajukan → masukkan kode nota/transfer asal → pilih barang + qty + alasan (+ foto opsional)
   │  PENDING — stok & tagihan belum berubah
   ▼
Owner/GM setujui (satu transaksi DB):
   1. stok cabang penerima keluar (FIFO), stok cabang pengirim masuk lagi (modal asli nota)
   2. nota Bulk Sale cabang pengirim dikurangi (omzet & HPP pengirim turun) — pola sama dengan
      "selisih terima IBT" (kanban #56, ReturService.applyReturInTx pada converted_transaction_id)
   3. hutang internal dikurangi; bila sudah lunas → Saldo Internal
   4. tampil di Mutasi Stok kedua cabang (dokumen sendiri)
```

### B. Revisi Harga Beli

```
Ajukan → kode nota asal → barang + harga yang benar + alasan
   ▼
Owner/GM setujui:
   1. stok TIDAK bergerak
   2. nilai nota Bulk Sale Gudang dikoreksi lewat dokumen (omzet Gudang turun sebesar selisih)
   3. modal barang di toko dibetulkan untuk sisa stok batch dari IBT itu
   4. hutang internal dikurangi selisih; bila sudah lunas → Saldo Internal
```

Penjualan toko yang terjadi sebelum revisi tetap memakai HPP lama (HPP disimpan saat jual) —
perlu diputuskan apakah selisihnya ditampilkan di laporan.

## Tahapan

| Tahap | Isi | Risiko | Migrasi |
|---|---|---|---|
| 0 | Dokumen: glosarium, spec ini, keputusan baru di spec Retur Supplier | — | tidak |
| 1 | Retur Supplier Luar: supplier aktif/nonaktif (Gudang/Repack/Return nonaktif), alasan "Barang tidak datang / kurang kirim" | rendah–sedang | ya (kolom kecil) |
| 2 | Pintu masuk 2 kotak pilihan (kotak Retur Internal tampil "segera hadir" sampai tahap 3) | rendah | tidak |
| 3 | Retur Internal — Barang Dikembalikan + Saldo Internal | **tinggi** | ya (dokumen retur internal, saldo internal) |
| 4 | Revisi Harga Beli | **tinggi** | kemungkinan ya |

## Jawaban owner atas pertanyaan desain (2026-10-11)

| # | Topik | Keputusan |
|---|---|---|
| 1 | Menyembunyikan supplier lama | **Tanda aktif/nonaktif** di master supplier (migrasi kecil). Yang dinonaktifkan: **Repack**, **Return**, dan **Gudang**. |
| 2 | Supplier "Gudang" di pembuatan PO | Usulan Claude (owner minta pendapat): **ikut nonaktif** — pasokan Gudang sudah otomatis lewat PO Internal/IBT. Supplier nonaktif disembunyikan dari pilihan **baru** (PO baru, Retur Supplier Luar); PO & dokumen lama tetap menampilkan namanya. |
| 3 | Siapa boleh mengajukan Retur Internal | **Siapa saja** (toko penerima maupun admin Gudang) — keputusan final ada di **Owner/GM** yang menyetujui. |
| 4 | Harga di Revisi Harga Beli | **Diisi pemohon**, dan **penyetuju boleh mengubah** → dua tampilan: form pemohon (harga usulan) dan popup penyetuju (harga lama vs usulan, bisa diubah sebelum setuju). |
| 5 | Saldo Internal | **Otomatis** memotong tagihan internal (agar tidak pusing), **dengan jejak lengkap**: setiap pemakaian tercatat (dokumen sumber, tagihan yang dipotong, nominal, waktu, penyetuju). Pemakaian saldo **bukan** uang kas — tidak boleh membuat catatan Pendapatan & Pengeluaran otomatis. |

### Rancangan Saldo Internal otomatis

- Saldo milik pasangan cabang **(cabang penerima → cabang pengirim)**, mis. Toko Depan → Gudang
  atau Toko Depan → Toko Pusat.
- Saat saldo bertambah: langsung dipakai untuk tagihan internal **terbuka tertua** pasangan cabang itu.
- Saat tagihan internal baru muncul: sisa saldo langsung dipakai.
- Setiap pemakaian = baris pembayaran hutang internal bermetode **"SALDO INTERNAL"** + entri saldo
  negatif yang menunjuk dokumen sumbernya → tampil di Riwayat pembayaran & audit.

## Keputusan owner: modal barang yang sudah terjual (2026-10-11)

Owner: "harga jual tidak pernah salah, yang sering salah itu modal" — modal **wajib** dibetulkan
dan **wajib diberitahukan**. Disetujui owner:

- Nota penjualan lama **tidak diubah** (prinsip tanpa edit).
- Saat Revisi Harga Beli disetujui:
  1. **Sisa stok** dari kiriman itu: modal batch dibetulkan ke harga baru.
  2. **Bagian yang sudah terpakai** (qty kiriman − sisa batch): dicatat sebagai
     **"Penyesuaian Modal (Revisi Harga Beli)"** = qty terpakai × (harga lama − harga baru), masuk
     **Laba Rugi toko sebagai baris terpisah** pada tanggal revisi disetujui.
  3. Hutang internal turun = qty kiriman × selisih harga (sisa jadi Saldo Internal bila lunas).
- **Diberitahukan** di popup penyetuju ("7 dari 10 SAK sudah terjual — modal dikoreksi Rp X"),
  di dokumen revisi, cetakan, dan baris Laba Rugi.
- Batasan: tidak ada jejak penjualan per batch, jadi "terpakai" = semua yang keluar dari batch itu
  (termasuk barang rusak/opname). Cukup akurat untuk laporan.

## Kiriman toko → toko (dianalisa 2026-10-11)

Dicek di kode & data produksi (read-only): sejak **18 Agustus 2026** semua kiriman antar cabang —
termasuk toko → toko (mis. Toko Pusat → Toko Depan / Toko Markas) — memakai alur yang sama:
**PO Internal → Bulk Sale cabang pengirim → kirim → terima**. Transfer polos tanpa Bulk Sale
(Juni–18 Agustus) tidak dipakai lagi dan hutangnya sudah lunas semua; Retur Internal **tidak**
melayani transfer polos lama itu. Kurang terima yang ketahuan **saat menerima** sudah ditangani
(kanban #56: selisih balik ke pengirim lewat retur nota). Jadi Retur Internal cukup satu alur
untuk semua pasangan cabang, dengan "Gudang" di rancangan dibaca sebagai **cabang pengirim**
(`inter_branch_transfers.source_branch_id`).

## Batalkan dokumen yang sudah disetujui (keputusan owner 2026-10-11)

Dokumen yang sudah disetujui tidak boleh buntu kalau ternyata salah. Berlaku untuk **Retur
Supplier Luar** (yang sudah tayang), **Barang Dikembalikan**, dan **Revisi Harga Beli**:

- Tombol **"Batalkan"** pada dokumen berstatus Disetujui — hanya **Owner/GM**, **alasan wajib**,
  popup wajib pilih.
- Dokumen **tidak dihapus**: status menjadi **Dibatalkan** (pembatal, waktu, alasan tercatat) dan
  tetap tampil.
- Semua efek dibalik dalam satu transaksi DB: stok kembali, potongan tagihan dibatalkan, saldo
  dikurangi — pembalikan tampil sebagai baris tersendiri di Mutasi Stok & riwayat pembayaran.
- **Ditolak** (dengan penjelasan) bila efeknya tidak bisa dibalik bersih, mis. saldo dari dokumen
  itu sudah terpakai untuk tagihan lain, atau barang di cabang tujuan pembalikan sudah tidak
  cukup. Perbaikannya lewat dokumen baru.
- Selama masih **Menunggu Persetujuan**, pengaju boleh **menarik** pengajuannya sendiri (status
  Ditarik; tidak ada efek stok/uang).

## Pertanyaan terbuka

Tidak ada — semua pertanyaan desain sudah dijawab owner (2026-10-11).

## Pecahan kerja

Dipecah menjadi item kecil **RI0–RI9** di
[`../backlog/2026-10-11-retur-internal.md`](../backlog/2026-10-11-retur-internal.md) — satu item per sesi,
satu commit per item, mengikuti pola developer (lihat backlog staff-dashboard S1–S8).
