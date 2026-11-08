# 07 — Modul Finance (Langkah F2-6)

Sumber v3: `06-keuangan.md` bagian 3.11 (omzet, harga pokok), 3.14 (Cek Modal), 3.15 (Keuangan Hari
Ini), 3.16 (laporan dan tutup bulan). Dibangun sebagai **modul sendiri**, bukan di HRIS (01 §5).

## 1. Tujuan

Finance adalah **tempat analisa data** ✅ (owner: "finance itu tempatnya untuk analisa data,
misalnya laba rugi bersih dan sejenisnya"). Ia **hanya membaca** dari POS/Back Office, HRIS, dan
Logistik; tidak ada tombol bayar atau catat di Finance ✅.

## 2. Isi

| Bagian | Isi | Dibaca dari |
|---|---|---|
| **Arus Uang** per cabang & gabungan | Masuk dari mana, keluar ke mana, per periode | Setoran terverifikasi (03), bayar supplier & Arus Kas (05), Biaya Rutin & sewa mobil (06), bayar gaji/kasbon/bongkaran (HRIS), uang toko & bensin (Logistik) |
| **Saldo Tempat Uang** | Saldo tiap rekening, brankas, kas | Semua perpindahan yang menyebut Tempat Uang (02) |
| **Laba Rugi bersih** per cabang & gabungan | Penjualan − harga pokok − biaya (gaji, bensin, sewa, listrik, biaya bank, …) | POS (penjualan, HPP batch), HRIS, Logistik, Back Office; biaya menurut "untuk bulan apa" |
| **Setoran bebas vs laba** | Kenapa uang bebas ≠ laba: stok, utang, piutang, biaya di tempat lain | 04 §3 |
| **Utang Antar Cabang** | Sisa, umur, tren per cabang | 04 §5 |
| **Dana non-tunai belum cair** | Per rekening | 03 |

## 3. "Cara membaca" — wajib di setiap angka ✅

Owner 2026-11-08: "buat saja tulisan 'cara membaca', ketika diklik nanti akan muncul penjelasan …
dibuat mudah dibaca, sertakan dari mana asal angka ini, dan kenapa bisa begini angkanya, agar
orang-orang bisa memahami".

Setiap kotak angka punya tombol **Cara membaca** dengan susunan tetap:

```
┌ Cara membaca: Setoran bebas Toko A — Oktober ─────────────┐
│ Artinya   : uang setoran yang tersisa sesudah melunasi     │
│             utang belanja Toko A.                          │
│ Asal angka: Riwayat Shift (setoran terverifikasi)          │
│             − Utang Internal yang dilunasi otomatis        │
│ Hitungan  : Rp10.000.000 − Rp7.000.000 = Rp3.000.000       │
│ Kenapa bukan laba? Karena stok naik Rp1,2 jt dan ...       │
│ [Lihat rincian →]  (ke daftar nota/shift asalnya)          │
└────────────────────────────────────────────────────────────┘
```

- Bahasa sehari-hari, tanpa istilah akuntansi yang tidak dijelaskan.
- **Hitungan memakai angka yang sedang tampil**, bukan contoh umum.
- Rincian selalu bisa diklik sampai ke nota/shift/catatan asalnya.
- Bila sumber belum lengkap (mis. HRIS belum produksi, pembayaran lama tanpa "dibayar dari"),
  "Cara membaca" mengatakannya terus terang.

## 4. Dibahas sambil jalan 🗣️

- **Biaya bersama** (gaji kantor, Finance, Owner, kantor/gudang): dibagi ke cabang atau berdiri
  sendiri sebagai "Kantor".
- **Tutup bulan**: angka bulan yang ditutup dikunci; koreksi masuk bulan berjalan.
- **Hitung fisik kas** (brankas, uang pegangan) untuk mencocokkan saldo.
- Bagian v3 lain (Cek Modal, Perkiraan Kas, Kemampuan Belanja): dibahas setelah bagian utama jalan.

## 5. Kriteria selesai

- Laba rugi bersih satu cabang satu bulan bisa ditelusuri lewat "Cara membaca" sampai ke sumber
  setiap angka, dan owner menilainya masuk akal.
- Saldo satu rekening toko di Finance cocok dengan mutasi bank untuk satu periode contoh.
- Tidak ada satu pun tulisan dari modul Finance ke data modul lain (diperiksa lint & tes, seperti
  batas modul Fase 1).

## 6. Pertanyaan terbuka

- ❓ Web Finance khusus staging untuk uji (01 §5).
- 🗣️ Hal-hal §4.
