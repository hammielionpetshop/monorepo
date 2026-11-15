# Plan: Urutan Pembangunan (Tahap 6)

Tanggal: 14 Oktober 2026
Status: **disetujui penuh 14 Oktober 2026** (Q1 s.d. Q3 "ok", sesuai saran; 4J-5).
Jangan tanyakan ulang.

Dasar: peta jalan Tahap 2 dan 6 (urutan modul dan pembangunan); SIS-10, 12 s.d. 16,
19, 21, 39; `2026-10-13-tempat-uji-dan-alur-rilis.md` bagian 9; titipan antar spec
di `../specs/2026-10-14-daftar-lintas-modul.md` bab 4; WAJ-01, 02, 06, 08.

Plan ini dijalankan di project baru. Di folder ini tidak ada kode.

## 1. Pegangan urutan

1. **Yang dipakai banyak pihak dibangun dulu.** Pondasi, perlengkapan bersama, dan
   Karyawan dan Akses dipakai semua modul.
2. **Penulis dulu, pemanggil kemudian.** Modul yang punya "pintu tulis" (Keuangan,
   Gaji) dibangun sebelum modul yang memanggilnya. Pemanggil tidak pernah memakai
   pintu bohongan (WAJ-03).
3. **Dua modul yang saling butuh dipecah di titik silangnya** (bagian 3), supaya
   tidak ada langkah yang menunggu langkah sesudahnya.
4. **Satu langkah = satu sesi per bagian spec** (KER-11): 4D-1, 4D-2a, dan seterusnya.
   Daftar bagian tiap langkah ada di tabel bagian 2.
5. **Langkah dianggap selesai** kalau tiga syarat SIS-10 terpenuhi untuk bagiannya:
   tes mesin lulus, dicoba pemilik di tempat uji, diuji banding dengan data lama
   (SIS-14 s.d. 16; Kinerja SIS-21). Langkah berikutnya tidak dimulai sebelum itu.

Jumlah layar yang dibangun: Perlengkapan Bersama 28 + Karyawan 28 + Kehadiran 43 +
Tarik Data Kasir 8 + Keuangan 99 + Gaji 43 + Logistik 77 + Gaji Driver 39 +
Kinerja 35 = **400 layar**, semuanya dari komponen baku.

## 2. Urutan langkah

| No | Langkah | Bagian spec | Bergantung pada | Dibuktikan dengan |
|---|---|---|---|---|
| P | **Pondasi**: repo tertutup, pagar mesin, tempat uji masa A, tayang otomatis, komponen baku, data dan akun contoh, ganti akun, mesin pengaman, jam uji, catatan rilis, ukuran kecepatan | Tempat uji bagian 9 langkah 1 s.d. 10 | tidak ada | Tiap baris "Dibuktikan dengan" di plan tempat uji |
| 1 | **Perlengkapan Bersama** dan **Karyawan dan Akses** | 4B (BER-L01 s.d. L28); 4A (KAR-L01 s.d. L28) | P | Dua jabatan masuk berdampingan; Hak Akses Jabatan dan "Lihat sebagai" jalan; Mesin Pengajuan menerima satu jenis contoh; mesin pengaman menolak pintu yang sengaja dibuka lebar |
| 2 | **Kehadiran inti** | 4D-1, 4D-2a, 4D-2b, 4D-3 (tanpa KEH-L25), 4D-4a, 4D-4b, 4D-5a, 4D-5b | 1 | Absen QR dengan titik lokasi di handphone sungguhan; jam buka cabang bisa dibaca; satu periode 26–25 data lama diuji banding |
| 3 | **Tarik Data Kasir** | 4C (TDK-L01 s.d. L08) | 1, 2 (jam buka cabang) | Satu file contoh asli per jenis data terbaca; tarikan dua kali tidak dobel; kasir mati memunculkan tanda |
| 4 | **Keuangan A**: Buku Kas sampai Toko–Gudang dan Piutang Lain | 4H-1 s.d. 4H-7 (KEU-L01 s.d. L67) | 1, 3 | Semua pintu catat uang dari modul ada dan diuji lewat tes; Laporan Kasir dan selisih kasir terbaca; fungsi tulis Piutang Lain jalan |
| 5 | **Gaji Bulanan** | 4E-1 s.d. 4E-5c (GAJ-L01 s.d. L43) | 1, 2, 4 | Satu periode data lama dihitung, tiap selisih masuk daftar beda; slip ditutup, dibayar lewat Catatan Cepat, dibuka kembali |
| 6 | **Logistik** | 4F-1 s.d. 4F-5c (LOG-L01 s.d. L77) | 1, 3, 4, 5 | Satu trip dari rencana sampai uang diperiksa; bonus ongkir masuk Buku Bonus; bensin masuk Buku Kas |
| 7 | **Kehadiran susulan**: absen lewat trip dan Keadaan Mobil | 4D-2c (KEH-L18, L19); KEH-L25 | 2, 6 | Awak trip tercatat absen; dua trip sehari = dua laporan; Keadaan Mobil membaca mobil dari Logistik |
| 8 | **Gaji Driver, Bongkaran, Kasbon** | 4G-1 s.d. 4G-4b (DRV-L01 s.d. L39) | 5, 6, 7 | Dua minggu upah data lama diuji banding; slip mingguan memakai mesin slip yang sama; kasbon dari pengajuan sampai lunas |
| 9 | **Keuangan B**: Tagihan Rutin sampai Tutup Bulan | 4H-8 s.d. 4H-11 (KEU-L68 s.d. L99) | 4, 5, 6, 8 | Satu bulan data lama diuji banding; Cek Modal, Keuangan Hari Ini, dan tutup bulan berjalan |
| 10 | **Kinerja** | 4I-1 s.d. 4I-5 (KIN-L01 s.d. L35) | 2, 3, 5, 9 | Satu periode percobaan; hasil Bonus Terukur masuk Buku Bonus dan diperiksa pemilik (SIS-21) |
| 11 | **Penutup**: Beranda dan portal diperiksa utuh, Masa B, uji banding semua, gladi bersih, daftar ulang akun, pengumuman, hari pindah | Tempat uji bagian 9 langkah 11 dan 12; SIS-16, 18, 19, 27, 39 | 1 s.d. 10 | Urutan SIS-39 tanpa langkah yang dilompati |

Beranda dan portal karyawan bukan modul (peta modul): tiap langkah menambahkan
kartu dan menu miliknya, langkah 11 memeriksa semuanya utuh.

## 3. Titik silang yang dipecah

| Silang | Dipecah di | Alasan |
|---|---|---|
| Keuangan ↔ Gaji, Logistik, Gaji Driver | Keuangan A (langkah 4) sebelum ketiganya; Keuangan B (langkah 9) sesudah semuanya | Gaji, Logistik, dan Gaji Driver menulis uang lewat pintu Keuangan, jadi pintu harus ada lebih dulu. Cek Modal dan Tutup Bulan membaca beban gaji, ritase, dan bongkaran, jadi harus sesudah |
| Kehadiran ↔ Logistik | Kehadiran inti (langkah 2) dan susulan (langkah 7) | Absen lewat trip dan Keadaan Mobil membaca trip dan mobil milik Logistik; sisa Kehadiran tidak butuh Logistik |
| Gaji ↔ Gaji Driver | Mesin slip umum selesai di langkah 5, slip mingguan memakainya di langkah 8 | Satu mesin slip (GAJ, DRV-26); koreksi upah ritase dari Gaji Driver masuk lewat pintu yang sudah disiapkan |
| Gaji ↔ Logistik, Kinerja | Pintu tulis Buku Bonus selesai di langkah 5 | Ongkir (langkah 6) dan Bonus Terukur (langkah 10) hanya memanggilnya |
| Tarik Data Kasir ↔ Kehadiran | Jam buka cabang (langkah 2) sebelum Tarik Data Kasir (langkah 3) | Penarik membaca jam buka dari Kehadiran (KEH-106) |

## 4. Bahan dari pemilik yang harus ada sebelum langkahnya

Tahap 5 mengumpulkan semuanya; tabel ini menyebut siapa butuh apa dan kapan.

| Sebelum langkah | Bahan | Dari titipan |
|---|---|---|
| 3 | Satu file contoh asli per jenis data kasir; pintu baca di project kasir (dikerjakan terpisah) | 4C, bab 4.4 |
| 4 | Daftar tempat uang, rekening, tanggal hari mulai, saldo awal | 4H-1, WIP |
| 6 | ~~Jawaban D7~~ Terjawab 14 Oktober 2026: Finance mengecek lalu mengetik ke kasir; uang yang menunggu dicek harus selesai sebelum hari pindah | 4F-5b |
| 8 | 23 tarif lama beserta pasangan mobil dan rute; bentuk kasbon yang sedang berjalan | 4G-1, 4G-4b |
| 11 | Pengumuman 7 hari sebelum sambungan kasir dinyalakan dan 7 hari sebelum hari pindah; tanggal 26 yang dipilih | SIS-18, 4C |

Tidak ditanyakan lagi: bentuk file export produk (butir terbuka 10) dan laporan pajak.

## 5. Jalan keluar

- Langkah yang gagal uji banding diperbaiki dan diulang paling banyak sekali; lalu
  pemilik memutuskan (SIS-16). Langkah berikutnya menunggu.
- Aturan yang ternyata kurang ditulis di spec **tidak diubah di tengah jalan**
  (peta jalan Tahap 5 butir 2): dicatat di backlog, dikerjakan sesudah modul tayang.
  Kalau spec bertabrakan sehingga tidak bisa dibangun, sesi pembangunan berhenti
  dan melapor ke pemilik.
- Kalau sebuah langkah tertunda lama, langkah yang tidak bergantung padanya boleh
  maju (lihat kolom "Bergantung pada"), tetapi hari pindah tetap menunggu semua
  langkah (SIS-12).

## 6. Bentuk komponen baru: kapan dibangun

Daftar lengkapnya di `../desain/README.md` bagian "Bentuk baru dari 4D sampai 4I".
Komponen dibangun pada langkah pertama yang memakainya (aturan 3 di README itu).
