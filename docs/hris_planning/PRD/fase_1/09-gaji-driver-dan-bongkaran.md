# 09 — Gaji Driver & Bongkaran (Langkah L7, L8)

Sumber v3: buku `05-gaji-driver-kasbon.md` bagian 3.1–3.8, 3.15–3.20 (DRV-01 s.d. 53, 82 s.d. 120),
spec `2026-10-14-gaji-driver-spec.md` bagian 4G-1 s.d. 4G-3b.
✅ Driver & kenek ikut HRIS; aturan v3 yang sudah jelas dipakai tanpa diskusi ulang.

## 1. Tujuan

- **L7**: upah ritase driver & kenek dihitung dari tarif dan ritase, dibayar lewat **slip mingguan**
  (minggu Jumat–Kamis, dibayar Sabtu) dengan mesin slip yang sama dengan Gaji (06).
- **L8**: upah **bongkaran** di gudang dihitung dari berat barang × tarif per kg, dibagi rata ke
  peserta, dibayar tunai hari itu.

## 2. Lingkup per bagian spec v3

| Bagian | Isi | Layar | Langkah |
|---|---|---|---|
| 4G-1 | Jenis upah, tarif ritase (per pasangan mobil & rute), tarif baru, betulkan salah ketik, upah ritase | DRV-L01 s.d. L05 | **L7** |
| 4G-2 | Denda driver & kenek, ajukan & putuskan denda, jenis denda, kartu "Upah Minggu Ini" | DRV-L06 s.d. L10 | **L7** |
| 4G-3a | Laporan Bongkaran (daftar, baru, rincian), berat per satuan, barang lain, laporan terlambat | DRV-L11 s.d. L16 | **L8** |
| 4G-3b | Bayar bongkaran, koreksi, batalkan, batal bayar, lebih bayar, bongkaran per orang | DRV-L17 s.d. L22 | **L8** |
| 4G-4a/b | Kasbon | DRV-L23 s.d. L39 | L5 (07) |

Aturan inti v3 yang berlaku utuh: satu Buku Upah & tiga jalur bayar (DRV-01 s.d. 07), upah ritase
per tarif yang berlaku pada tanggal trip (DRV-08 s.d. 13), orang bergaji bulanan yang ikut trip hanya
diupah di hari liburnya (DRV-16, 17), slip mingguan tanpa potongan yang diketik (DRV-19 s.d. 28),
denda dari daftar jenis (DRV-29, 30), bongkaran dibagi rata dengan sisa rupiah menurut abjad
(DRV-31 s.d. 53).

## 3. Penyimpangan dari v3

- **Ritase dibaca dari `logistik.v_ritase`** (08), bukan dari Logistik v3 penuh. Upah belanja tetap
  ada lewat rute berjenis belanja (DRV-11).
- **Daftar produk untuk bongkaran** dibaca dari `petshop` lewat `v_produk` 💡, bukan file export yang
  diunggah (DRV-38). Berat per satuan tetap disimpan di HRIS per produk per satuan (DRV-32, 33).
- **Daftar supplier** dibaca dari `petshop` lewat `v_supplier` 💡, bukan daftar milik Keuangan
  (DRV-41). Kepala Gudang tidak menambah supplier di HRIS; supplier baru dibuat di backoffice.
- **Sambungan ke purchase order kasir** (DRV-39, "disiapkan, dinyalakan belakangan") tetap menyusul.
  Datanya sudah tersedia di `petshop`, jadi kelak cukup ditambah view.
- **Pembayaran** slip mingguan dan bongkaran tunai dicatat di HRIS, seperti gaji bulanan (06 §3.3) ✅.

## 4. Kriteria selesai

- **L7**: dua minggu upah dari data trip nyata dihitung dan diuji banding dengan HRIS lama; slip
  mingguan ditutup Jumat, dibayar Sabtu, memakai mesin slip yang sama; denda masuk Dana Disiplin;
  cicilan kasbon orang berslip mingguan terpotong.
- **L8**: satu Laporan Bongkaran dari pencarian produk kasir → total kg → upah dibagi rata (jumlah
  bagian = total upah) → dibayar tunai → koreksi & batal bayar berjalan tanpa hapus.

## 5. Pertanyaan terbuka

- ❓ Daftar 23 tarif ritase lama beserta pasangan mobil & rute (DRV-08) dan jenis denda yang dipakai
  sekarang.
- ❓ Berat per satuan yang sudah tercatat di HRIS lama: dibawa sebagai data awal atau diisi ulang
  saat bongkaran pertama (DRV-32)?
