# 02 — Rapor (Langkah F4-3)

Sumber v3: KIN-01 s.d. 12, KIN-52 s.d. 58; spec Kinerja §3.1, KIN-L01 s.d. L09.

## 1. Tujuan

Setiap karyawan yang jabatannya punya kriteria mendapat **nilai persen per kriteria dan nilai
keseluruhan** tiap periode 26–25, dihitung mesin dari data. Rapor **tidak membawa uang** (KIN-06).

## 2. Ukuran yang tersedia (KIN-04)

| Ukuran | Angka yang dibaca | Dari mana (monorepo) |
|---|---|---|
| Kehadiran | Hari hadir ÷ hari kerja wajib (cuti & sakit bersurat tidak mengurangi; izin, sakit tanpa surat, alpha mengurangi) (KIN-53) | Kehadiran HRIS |
| Tepat waktu | Hari hadir tanpa telat melewati toleransi 5 menit ÷ hari hadir | Kehadiran HRIS (KEH-22) |
| Tugas rutin dikerjakan | Dikerjakan ÷ jatah (tugas "masuk rapor") | Tugas (01, KIN-42) |
| Kerapian display | Jatah rak dirapikan ÷ seluruh jatah | Tugas (01, KIN-43) |
| Penjualan promo | Pcs disetujui cabang ÷ target (rata-rata per produk) | Penjualan Promo (04) |
| Target omzet | Omzet cabang ÷ target | **POS langsung** (00 §9) |
| Ketelitian kasir | Shift tanpa selisih ÷ seluruh shift yang ia tutup; kekurangan yang ditiadakan dihitung tanpa selisih (KIN-54) | **Minus kas shift POS** di modul Gaji (00 §9) |

Kehilangan barang **tidak** menjadi ukuran (KIN-17). Daftar ukuran ditambah lewat pembangunan (KIN-52).

## 3. Aturan inti

- **Kriteria per jabatan per cabang** (atau semua cabang; yang khusus menang), jumlah bobot **100**;
  bertanggal berlaku; tidak dihapus, hanya dinonaktifkan (KIN-05, 55). Perubahan berlaku **mulai
  periode berikutnya** dan diumumkan lewat Papan (Fase 3).
- **Kriteria tanpa data** ditandai "belum ada data", bobotnya dibagi ulang sebanding (KIN-08, 55).
- **Dua tahap**: **Perkiraan** (dihitung tiap malam) → **Ditetapkan** (KIN-09, 56). Tombol Tetapkan
  aktif mulai tanggal **29 pukul 00.00**; oleh HR/Pemilik/GM, bukan untuk rapornya sendiri.
  "Tetapkan semua yang siap" melewati rapor bertanda (laporan janggal atau klarifikasi absen yang
  belum diputuskan, KIN-81). Saat ditetapkan, rincian dan hitungan tugas/rak disalin dan tidak
  berubah lagi; Bonus Terukur dan promo dinilai dalam satu langkah (03, 04). **Rapor bukan penahan slip.**
- **Koreksi sesudah ditetapkan** (KIN-10, 57): hitung ulang sebagai versi baru dengan catatan
  beralasan; versi lama tetap terlihat; perubahan bonus dikirim ke Gaji sebagai susulan/koreksi.
- **Pindah/masuk/berhenti di tengah periode** (KIN-11, 58): kriteria tempat **paling lama** bekerja;
  rapor bertanda "periode tidak penuh".
- **Karyawan melihat rapornya utuh** (KIN-12): tahap, angka di balik tiap persen, bonus beserta syaratnya.

## 4. Layar

| Layar | Menu | Siapa | Perangkat |
|---|---|---|---|
| Kinerja Saya (KIN-L01) | Saya › Kinerja Saya | Semua yang punya rapor | HP |
| Rapor (KIN-L02) | Kantor › Kinerja › Rapor | HR, Pemilik, GM; kepala cabang (timnya, baca) | PC |
| Rapor Seseorang (KIN-L03) | dari L02 | Sama | PC |
| Tetapkan Rapor (KIN-L04) | dari L02 | HR, Pemilik, GM | PC |
| Catatan Koreksi Rapor (KIN-L05) | dari L03 | HR, Pemilik, GM | PC |
| Kriteria Rapor + Ubah (KIN-L06, L07) | Pengaturan › Kinerja | HR, Pemilik, GM | PC |
| Target Omzet Cabang (KIN-L08) | Pengaturan › Kinerja | HR, Pemilik, GM | PC |
| Daftar Ukuran (KIN-L09) | Pengaturan › Kinerja | HR, Pemilik, GM (baca) | PC |

## 5. Kriteria selesai

- Tes aturan: rumus tiap ukuran (dengan nomor KIN-nya), jumlah bobot 100 ditolak bila tidak, bagi
  ulang bobot tanpa data, tempat paling lama, Tetapkan mengunci salinan, koreksi berversi.
- Uji owner: satu periode staging dengan data absen + tugas + rak; rapor Perkiraan → Tetapkan; tiap
  persen bisa dijelaskan dari angka mentahnya.

## 6. Pertanyaan terbuka

- ❓ **Omzet cabang** untuk Target omzet: omzet bersih (setelah diskon & retur) menurut laporan POS
  yang sudah ada? Saran 💡: ya, memakai angka laporan penjualan POS yang sama (tidak dihitung kedua kali).
- ❓ **Ketelitian kasir per orang**: shift POS bisa punya lebih dari satu kasir. Saran 💡: memakai
  pembagian minus kas per orang yang sudah dipakai slip (L4c), sehingga angkanya sama dengan potongan.
- Kriteria & bobot per jabatan dan target omzet **diisi owner saat menyiapkan tayang** (v3 bagian 6).
