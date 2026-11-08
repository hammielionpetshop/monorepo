# 04 — Pelunasan Otomatis Antar Cabang (Langkah F2-3)

Sumber v3: `06-keuangan.md` bagian 3.10 & 3.25 (toko dan Gudang). Dasar POS: utang antar cabang
dari kiriman/PO Internal (`inter_branch_payables`, `inter_branch_payments` dengan baris otomatis
`RETUR_INTERNAL`/`SALDO_INTERNAL`/`BATAL_RETUR`), Saldo Internal (`internal_credit_entries`).

## 1. Tujuan

Owner 2026-11-08: "setiap uang cash atau transfer dari cabang itu pada akhirnya bermuara di gudang
/ kantor … jadi setiap verifikasi itu seharusnya menjadi pembayaran otomatis dari piutang cabang
yang belanja ke gudang / ke toko pusat" ✅. Pembayaran antar cabang **tidak lagi diinput manual**
untuk kasus biasa; input manual tersisa untuk pengecualian (koreksi, "tidak ditagih" yang sudah
ada).

## 2. Alur ✅

```
Setoran Toko A diverifikasi (tunai + non-tunai, 03)
  ① melunasi utang Toko A — tagihan PALING LAMA dulu, siapa pun pemasoknya (Toko Pusat / Gudang)
  ② uang yang "diterima" Toko Pusat dari ① → melunasi utang Toko Pusat ke Gudang (paling lama dulu)
  ③ sisa di tiap tingkat = SETORAN BEBAS cabang itu
Setoran Toko Pusat sendiri → langsung ke langkah ②
```

- **Berantai** karena Toko Pusat mengambil laba sendiri saat memasok cabang ✅. Barang milik Toko
  Pusat sendiri (langsung dari supplier, tidak lewat Gudang) tidak menimbulkan utang ke Gudang;
  hutangnya ke supplier dibayar seperti biasa (05).
- **Paling lama dulu, siapa pun pemasoknya** 💡→✅ (owner: "ok ikut saran anda"), karena yang paling
  ditakutkan adalah nota lama yang belum lunas.
- Dihitung lunas saat uang sampai di Tempat Uang yang dipegang Finance (02 §3).
- Pelunasan otomatis tercatat sebagai baris pembayaran bersumber **setoran shift** (jenis baru di
  samping `RETUR_INTERNAL` dll.), menunjuk shift & verifikasinya.

## 3. Kelebihan setoran ✅

Setoran berisi **modal dan laba bercampur**. Keputusan:
- Kelebihan sesudah melunasi utang = **"setoran bebas"**, **bukan** deposit/Saldo Internal —
  supaya terlihat apakah setoran toko cukup menutup belanjanya.
- Modal vs laba **tidak dipisah saat verifikasi** (laba baru bisa diketahui di akhir periode).
  Finance menampilkan dua pandangan — **Arus Uang** dan **Laba Rugi** — serta layar penghubung
  "kenapa setoran bebas ≠ laba" (stok naik/turun, utang, piutang, biaya dibayar di tempat lain)
  (07).

## 4. Koreksi verifikasi ✅

- Tombol **"Koreksi verifikasi"** — Owner/GM, wajib alasan.
- Pelunasan otomatis dari verifikasi itu **dibalik** (baris pembalikan, tidak dihapus), termasuk
  rantainya ke Gudang; lalu dihitung ulang dari tagihan paling lama.
- Tercatat di Audit Log.

## 5. Setoran kurang & utang menunggak ✅

Sisa utang tetap terbuka dan tampil dengan **umur** (0–7 hari, 8–30 hari, >30 hari):

| Tempat | Siapa | Isi |
|---|---|---|
| Finance › Utang Antar Cabang | Finance, GM, Owner | Semua cabang: sisa, umur, tren |
| Back Office › Utang Internal (sudah ada) | Kantor/Gudang | + kolom umur, tanda merah lewat batas |
| Kepala Toko (nanti) | Tokonya sendiri | "Utang ke Pusat Rp…, paling lama dari tanggal …" |

## 6. Kriteria selesai

- Satu hari nyata: setoran dua toko diverifikasi → utang ke Toko Pusat & Gudang lunas sesuai urutan,
  sisa tercatat sebagai setoran bebas; owner mencocokkan hasilnya.
- Koreksi verifikasi membalik dan menyusun ulang tanpa menghapus baris apa pun.
- Jumlah laba semua cabang tetap sama dengan laba usaha keseluruhan (laba internal Toko Pusat
  saling menghapus dengan biaya cabang).

## 7. ⚠️ Utang lama — WAJIB dibahas khusus sebelum F2-3 tayang produksi

Owner 2026-11-08: "utang lama yang ada di sistem saat ini dibiarkan saja dulu … bisa jadi ada nota
bulan Oktober belum terlunaskan, dan itu bahaya" — dibahas nanti dengan konsentrasi penuh.

Bahan diskusi (belum keputusan):
- **Usul owner**: setoran yang sudah terverifikasi sebelumnya dipakai melunasi utang lama.
- **Bantahan agent**: (a) sebagian utang lama mungkin sudah dilunasi manual dengan uang dari
  setoran yang sama → risiko uang terhitung dua kali; (b) setoran sebelum verifikasi ketat
  (rilis 24 Okt 2026) tidak punya angka terverifikasi; (c) owner belum melihat keadaan nyatanya.
- **Usul agent**: laporan **pratinjau** di salinan data produksi per cabang (utang terbuka,
  setoran terverifikasi sejak tanggal X, pelunasan manual yang sudah ada, uang yang benar-benar
  tersisa, hasil bila dijalankan) → owner memilih tanggal mulai → dijalankan sekali, bertanda
  "pelunasan susulan"; sisa yang tak tertutup diputuskan satu per satu.

## 8. Pertanyaan terbuka

- ❓ Utang lama (§7).
- ❓ Batas umur "merah" di Back Office (mis. > 30 hari)?
