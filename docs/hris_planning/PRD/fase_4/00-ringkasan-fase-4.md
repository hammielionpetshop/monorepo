# 00 — Ringkasan Fase 4

## 1. Latar belakang

- Fase 1 sengaja mengeluarkan **Kinerja** ("rapor, Bonus Terukur, bonus promo, tugas, Catatan
  Rapat"). Bonus yang dibangun di Fase 1 hanya **grooming, ongkir, dan bonus bebas** (Buku Bonus
  dan Persetujuan Bonus di modul Gaji, L4d).
- Owner 2026-11-14 menanyakan di mana laporan tugas berfoto, misalnya **kebersihan rak**, yang
  menjadi penilaian kinerja. Jawabannya: modul Kinerja v3, yang belum dibangun.
- ✅ Owner 2026-11-15: modul ini dibangun di **Fase 4**, **sesudah Fase 3 selesai** ("kita kerjakan fase 3 dulu").

## 2. Tujuan Fase 4

1. **Tugas harian tercatat dengan bukti foto** (tugas rutin, tugas sekali jalan, kerapian rak), dijaga
   mesin dari foto palsu atau dipakai ulang.
2. **Rapor tiap orang tiap periode 26–25**, dihitung dari data (kehadiran, tepat waktu, tugas, rak,
   promo, omzet, ketelitian kasir), bukan dari nilai yang diketik atasan.
3. **Bonus yang adil dan bisa dijelaskan**: lahir dari aturan yang ditulis Pemilik/GM dan dinilai
   mesin, masuk Buku Bonus yang sudah ada.
4. **Hasil rapat tidak hilang**: tercatat, sampai ke sasarannya, dan tugas tindak lanjutnya dipantau.

## 3. Ukuran berhasil

- Satu cabang contoh menjalankan tugas rutin + daftar rak selama satu periode penuh; jatah, dikerjakan,
  dan kerapian display per orang terbaca di Kemajuan Tim.
- Rapor periode itu bisa ditetapkan, dan setiap persen bisa dijelaskan sampai angka mentahnya
  ("hadir 22 dari 24 hari", "rak 40 dari 44 jatah").
- Satu aturan Bonus Terukur contoh dinilai mesin dan baris bonusnya masuk Buku Bonus tanpa diketik.
- Tidak ada laporan, tugas, kriteria, atau catatan yang bisa dihapus (PRI-02).

## 4. Pengguna

| Jabatan | Di Fase 4 |
|---|---|
| Pemilik, GM (HR dirangkap GM) | Semua; khusus mereka: aturan Bonus Terukur, tarif promo, sumber dana |
| Admin HR | Mengatur yang tidak menyangkut uang sesuai hak (KIN-48) |
| Kepala Toko, Kepala Gudang | Membuat tugas untuk timnya, melihat kemajuan & rapor timnya, mengusulkan "tidak sah" |
| Semua karyawan | Melapor tugas & rak dari HP, melihat Kinerja Saya, membaca Catatan Rapat untuknya |
| Finance | Tidak punya menu Kinerja (KIN-48) |

## 5. Lingkup

**Masuk Fase 4** (layar v3 KIN-L01 s.d. L35)

| Bagian | Layar v3 | PRD |
|---|---|---|
| Tugas: Master Judul, tugas rutin & sekali jalan, lapor berfoto, periksa laporan akhir, kemajuan tim | KIN-L20 s.d. L26 | [01](01-tugas-dan-rak.md) |
| Tugas: tanda janggal, tidak sah, daftar rak, lapor rak, kerapian display | KIN-L27 s.d. L31 | [01](01-tugas-dan-rak.md) |
| Rapor: Kinerja Saya, daftar & rincian rapor, tetapkan, koreksi, kriteria, target omzet, daftar ukuran | KIN-L01 s.d. L09 | [02](02-rapor.md) |
| Bonus Terukur | KIN-L10 s.d. L12 | [03](03-bonus-terukur.md) |
| Penjualan Promo | KIN-L13 s.d. L19 | [04](04-penjualan-promo.md) |
| Catatan Rapat | KIN-L32 s.d. L35 | [05](05-catatan-rapat.md) |

**Tidak masuk Fase 4**

- **Rekrutmen**: ditangguhkan owner 12 Oktober 2026 (backlog v3 `2026-10-12-rekrutmen-ditangguhkan.md`).
- **Bonus Kinerja bertingkat, Ranking Disiplin, Tabungan Loyalitas**: ditunda owner (KIN-18, GAJ-31, 32).
- **Kesehatan Mesin** (BER-L30): v3 meminta mesin Kinerja tampil di sana (KIN-39, 50). Catatan jalan
  mesin tetap disimpan (`job_runs`); layarnya belum. ✅ Sebagai gantinya, pemberitahuan ke Pemilik/GM (§9).

## 6. Prinsip yang mengikat Fase 4

Semua prinsip Fase 1 (§6) dan Fase 3 (§6) tetap berlaku. Tambahan dari v3:

1. **Tidak ada nilai yang diketik orang** (KIN-03): yang belum tercatat di sistem belum bisa jadi kriteria.
2. **Kinerja tidak menghitung ulang milik modul lain** (KIN-02, WAJ-03): hari kerja, hadir, telat dari
   Kehadiran; minus kas dari Gaji (asal shift POS); omzet dan nota dari POS.
3. **Rapor tidak membawa uang** (KIN-06); uang hanya lahir dari Bonus Terukur dan bonus promo, lewat
   pintu tulis Buku Bonus milik Gaji.
4. **Tidak ada yang memutuskan urusannya sendiri** (KIN-49).
5. **Lapor hanya untuk hari ini, foto dari kamera saat itu** (KIN-34, 35, 75).
6. **Semua angka adalah pengaturan bertanggal berlaku**, dan perubahan yang menyangkut karyawan
   diumumkan lewat **Papan Perubahan Aturan** Fase 3 (KIN-51, 55, 59).

## 7. Urutan langkah

| Langkah | Isi | PRD | Bergantung pada |
|---|---|---|---|
| **F4-1** | Tugas: Master Judul, tugas rutin & sekali jalan, fungsi jatah, Lapor Tugas berfoto, Tugas Saya, Kemajuan Tim, periksa laporan akhir | 01 | Fase 3 F3-1 (pengingat) |
| **F4-2** | Rak & penjagaan: Daftar Rak, Lapor Rak, Kerapian Display, tanda janggal, tidak sah | 01 | F4-1 |
| **F4-3** | Rapor: daftar ukuran, kriteria & bobot, target omzet, Kinerja Saya, Tetapkan, koreksi | 02 | F4-1, F4-2; Fase 3 F3-3 (Papan) |
| **F4-4** | Bonus Terukur → Persetujuan Bonus → Buku Bonus | 03 | F4-3 |
| **F4-5** | Penjualan Promo: produk & target, lapor, cocok nota POS, bonus per pcs | 04 | F4-3 |
| **F4-6** | Catatan Rapat + tugas tindak lanjut | 05 | F4-1; Fase 3 F3-3 |

💡 **F4-1 dan F4-2 paling dulu**, karena itu yang owner butuhkan (laporan kebersihan rak) dan
datanya harus terkumpul minimal satu periode sebelum rapor berarti. F4-5 dan F4-6 boleh tukar
urutan menurut kebutuhan owner.

✅ Owner 2026-11-15: Fase 4 dimulai **sesudah Fase 3**, jadi pengingat tugas langsung memakai antrean
berantai dan aturan baru langsung diumumkan lewat Papan.

## 8. Definisi selesai satu langkah

Sama dengan Fase 1 §8. Tambahan: tes wajib KIN-50 (nilai rapor, syarat Bonus Terukur, bonus promo,
hitungan jatah, "dikerjakan", kerapian display), dan uji **Lapor Tugas/Rak di HP sungguhan** (kamera,
jarak foto sebelum–sesudah, lokasi).

## 9. Penyimpangan dari v3 (usulan) dan pertanyaan terbuka

| Hal | v3 | Fase 4 | Alasan |
|---|---|---|---|
| Ukuran Ketelitian kasir | Dari Laporan Kasir (KEU-54) | Dari **minus kas shift POS** yang sudah disalin modul Gaji | Penyimpangan Fase 1 (minus kas dari POS) |
| Target omzet, cocok struk promo | "Menyala setelah sambungan kasir hidup" | **Langsung menyala**: omzet dan nota dibaca dari POS di database yang sama | Penyimpangan Fase 1 (Tarik Data diganti view) |
| Produk promo | Dari daftar produk hasil tarikan | Dari **daftar produk POS** langsung | Sama |
| Bonus yang dibangun | Termasuk promo dan Bonus Terukur | Fase 1 hanya grooming, ongkir, bebas; Fase 4 **menambah** Bonus Terukur dan promo ke Buku Bonus yang sama | Melengkapi |
| Layar Kesehatan Mesin | Wajib menampilkan mesin Kinerja | Pemberitahuan ke Pemilik/GM bila mesin Kinerja gagal | ✅ owner 2026-11-15 |

Pertanyaan terbuka tingkat fase:

- ✅ **Kesehatan Mesin** (owner 2026-11-15): cukup **pemberitahuan ke Pemilik/GM** bila mesin Kinerja gagal.
- ✅ **Cabang uji coba** (owner 2026-11-15): Tugas & Rak dimulai di **satu cabang selama satu periode**,
  lalu semua cabang.
- Data yang **diisi owner saat menyiapkan tayang** (v3 bagian 6, jangan ditanyakan sebelum owner
  menyampaikan): daftar aturan Bonus Terukur & sumber dananya; kriteria & bobot rapor per jabatan per
  cabang; target omzet cabang; daftar rak per cabang, penanggung jawab, jadwalnya; tugas mana yang
  masuk rapor.
