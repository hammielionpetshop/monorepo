# 06 — Biaya Rutin & Sewa Mobil (Langkah F2-5)

Sumber v3: `06-keuangan.md` bagian 3.12 & 3.26 (Tagihan Rutin). Dasar Logistik: Mobil & Rute
(`logistics.vehicles`, `routes`), trip & ritase (`trips`, `trip_rates`).

## 1. Biaya Rutin (Back Office) ✅

Untuk biaya yang **angkanya tetap** tiap bulan: sewa toko, sewa kendaraan, sewa lain ✅.
Listrik **tidak** termasuk (angkanya berubah) — dicatat di Arus Kas (05) ✅.

- **Pengaturan**: nama biaya, cabang yang menanggung, jumlah per bulan, tanggal jatuh tempo,
  berlaku mulai–sampai.
- Setiap bulan muncul **tagihan** ("Sewa Toko C — Rp2.000.000 — jatuh tempo 5 Des") dengan tombol
  **Sudah dibayar** (Tempat Uang + bukti). Yang belum dibayar tampil merah.
- Biaya dicatat **untuk bulannya**, walau dibayar bulan berikutnya ✅ (sewa Oktober dibayar
  1 November → laba rugi Oktober, uang keluar November).
- Sewa dibayar setahun sekaligus tetap dihitung per bulan di laba rugi.

## 2. Sewa mobil per ritase (Logistik) ✅

Gudang membayar sewa mobil logistik dengan **angka tetap × jumlah ritase** mobil itu. Dibuat di
**Logistik** karena jumlah ritase dicatat di sana (pola sama dengan gaji ritase yang dibaca dari
trip).

- Di **Mobil & Rute**, mobil ditandai **milik sendiri / sewa**; mobil sewa punya **tarif sewa per
  ritase** bertanggal berlaku (kenaikan tarif tidak mengubah hitungan lama) dan pemilik sewa.
- Logistik membuat **rekap tagihan sewa BULANAN** ✅ per mobil/pemilik: jumlah ritase × tarif.
  Biasanya sewa Oktober dibayar tanggal 1 November ✅.
- Tombol **Bayar** di Logistik (Tempat Uang + bukti). Finance hanya membaca.
- 💡 Trip yang dibatalkan / tidak dihitung ritase tidak masuk rekap sewa — mengikuti aturan
  hitung ritase yang sudah ada.

## 3. Dibahas sambil jalan 🗣️

- **Pembelian aset** (freezer, rak, mobil) dan penyusutannya — bukan biaya satu bulan.

## 4. Kriteria selesai

- Sewa toko bulanan muncul otomatis sebagai tagihan, bisa ditandai dibayar, masuk laba rugi bulan
  yang benar.
- Rekap sewa mobil Oktober = ritase Oktober × tarif yang berlaku saat trip, bisa dibayar 1 November.

## 5. Pertanyaan terbuka

- ❓ Satu ritase untuk sewa mobil = sama dengan satu ritase untuk gaji driver?
- ❓ Siapa yang menekan Bayar sewa mobil: Finance saja?
