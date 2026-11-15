# 01 — Antrean Berantai (Langkah F3-1 dan F3-4)

Sumber v3: TAM-22, 24, 25; PRI-43; spec Perlengkapan Bersama BER-L01, BER-L03, §6, §10 (kejadian
26, 27); `daftar-lintas-modul` bab 2 (Tabel B, C).

## 1. Tujuan

Pemberitahuan penting (pengumuman, batas waktu yang membuat uang atau hak hilang, orang lain yang
menunggu keputusan) tampil sebagai **jendela satu per satu** yang harus ditutup dengan "OK, sudah
baca", seperti pop up di game, supaya tidak terlewat.

## 2. Keadaan sekarang

- Lonceng (`notifications`, BER-L02) dan kartu "Perlu perhatian" di Beranda sudah ada (Fase 1).
- Pengingat modul dikirim **sekali per tanda** ke lonceng (spec L3e–L3h, L4, L5, L7, L8 §9:
  "pengingat berantai menyusul").
- Belum ada jendela antrean, belum ada tingkat "berantai" atau "sekali baca".

## 3. Aturan inti (rincian di v3)

- **Satu jendela di layar pada satu waktu**; tutup hanya dengan tombol. "OK, sudah baca" aktif
  sesudah **1 detik**; pengumuman darurat **5 detik**; perubahan aturan memakai "Sudah saya baca"
  (TAM-22, PRI-36).
- **Urutan**: pengumuman darurat → perubahan aturan → pengingat tugas; di dalam kelompok, yang
  terlama dulu (BER-L03).
- **Kapan muncul**: saat HRIS dibuka pertama kali hari itu, dan saat ada pengumuman baru terbit
  ketika HRIS sedang terbuka. Darurat paling lambat 1 menit, di layar mana pun.
- **Pengingat tugas muncul lagi sekali sehari sampai urusannya beres**, lalu hilang sendiri;
  pengumuman cukup dibaca sekali (TAM-22 butir 4).
- **Pengingat tugas dikelompokkan per jenis urusan**: "Ada 6 klaim lembur menunggu keputusan Anda.
  Yang paling lama sudah 2 hari." Pengumuman dan pengingat pribadi tidak digabung (TAM-25 butir 4).
- **Tidak ada jendela ringkasan** seluruh antrean (TAM-22 butir 3).
- **Tidak menghalangi**: layar Absen menunda antrean sampai absen selesai; isian yang sedang diketik
  tidak hilang; selain darurat, jendela menunggu sampai langkah bertahap selesai atau ditinggalkan.
- Butir antrean **selalu** juga tampil di "Perlu perhatian", supaya bisa ditemukan sesudah OK.
- **Yang boleh masuk antrean** hanya yang lolos pegangan TAM-24: (1) batas waktu yang membuat uang
  atau hak hilang, (2) orang lain menunggu keputusannya lebih dari 1 hari, (3) pengumuman.
  Selebihnya tetap di Perlu perhatian dan lonceng.
- Penerima kosong, nonaktif, atau cuti lebih dari 2 hari: butir **naik ke Pemilik dan GM** (PRI-43
  butir 4).

## 4. Penyesuaian monorepo

- **Satu pintu** untuk semua modul, menggantikan pemanggilan `notify()` untuk jenis yang lolos
  TAM-24: modul mendaftarkan **jenis urusan** (kode, judul pengelompokan, layar tujuan, cara
  mengetahui "sudah beres") dan mesin antrean yang menyusun jendela. Modul tidak membuat jendela
  sendiri (WAJ-04).
- 💡 "Sudah beres" **dibaca dari data modulnya** saat antrean disusun (misalnya klaim lembur sudah
  diputuskan), bukan disimpan ganda, supaya jendela hilang sendiri tanpa langkah tambahan.
- 💡 Jendela memeriksa antrean baru tiap **1 menit** selama HRIS terbuka (cukup untuk syarat darurat
  1 menit), tanpa push HP.
- Jejak "sudah baca" untuk pengumuman disimpan per orang (dipakai BER-L25). Untuk pengingat tugas,
  yang disimpan cukup "sudah tampil hari ini" agar tidak muncul dua kali sehari.

## 5. Pindahan pengingat modul (F3-4)

- Sumber daftar: `daftar-lintas-modul` bab 2 Tabel B, **hanya jenis milik modul yang sudah ada**
  (Pengajuan, Karyawan, Kehadiran, Gaji, Kasbon, Gaji Driver, Bongkaran, Logistik). Jenis Keuangan v3
  dan Kinerja tidak dipindah (00 §9).
- Spec F3-4 membuat **tabel pemetaan**: tiap pengingat "sekali per tanda" yang ada di kode sekarang
  → jenis urusan Tabel B (berantai), Tabel C (sekali baca), atau tetap lonceng.
- Contoh yang menjadi berantai: pengajuan menunggu keputusan lebih dari 1 hari (B1), lebih dari
  2 hari ke Pemilik/GM (B2), lembur hampir hangus, surat dokter tinggal 1 hari, penjelasan hampir
  lewat batas, slip belum ditutup / belum ditandai Dibayar.
- Pemberitahuan lonceng yang sudah ada **tetap dikirim** seperti sekarang; antrean adalah tambahan.

## 6. Layar

| Layar | Tempat | Catatan |
|---|---|---|
| Jendela antrean (BER-L03) | Muncul sendiri di semua layar HRIS | HP dan PC; satu jendela; tombol aktif setelah jeda |
| Kartu "Pengumuman belum dibaca" di Beranda (BER-L01 butir 1) | Paling atas Beranda | Tetap sampai "Sudah saya baca" |

## 7. Kriteria selesai

- Tes aturan: urutan antrean, jeda tombol, pengelompokan per jenis, sekali sehari sampai beres,
  naik ke Pemilik/GM, tidak muncul di layar Absen.
- Uji di HP: jendela muncul saat membuka HRIS; layar Absen tidak terhalang dan antrean muncul
  sesudah absen selesai; isian yang sedang diketik tidak hilang; HRIS ditutup di tengah antrean →
  sisanya muncul saat dibuka lagi.

## 8. Pertanyaan terbuka

- ❓ Pengingat tugas muncul "saat pertama membuka HRIS hari itu". Untuk karyawan toko, pembukaan
  pertama biasanya untuk **absen masuk**. Saran 💡: antrean langsung muncul **sesudah absen masuk
  terkirim** (sesuai TAM-22 butir 2).
- ❓ Apakah GM/Pemilik ingin pengingat B1/B2 (pengajuan menunggu) sebagai jendela juga di **HP**,
  atau cukup di PC? Saran 💡: keduanya, sesuai v3.
