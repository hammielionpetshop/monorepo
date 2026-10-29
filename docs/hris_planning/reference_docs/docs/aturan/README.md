# Buku Aturan

Satu file per modul. Isinya aturan bisnis yang **berlaku sekarang**, ditulis dalam
bahasa bisnis, bukan bahasa kode.

## Cara menulis

- Satu aturan, satu nomor (contoh: `KEH-03`), supaya bisa dirujuk dari tes dan spec.
- Aturan yang menyangkut uang mencantumkan tanggal mulai berlaku.
- Pengecualian ditulis sebagai aturan tersendiri, lengkap dengan alasannya.
- Kalau aturan berubah: tentukan dulu jenisnya (pengganti, pelapis, atau
  pengecualian), lalu rapikan semua tempat yang menyebutnya. Lihat WAJ-12.
- Istilah yang dipakai harus ada di `00-kamus-istilah.md`.

## Daftar file

### Berlaku untuk semua modul

| File | Isinya | Nomor |
|---|---|---|
| `00-aturan-wajib.md` | Dua belas aturan yang berlaku untuk semua pekerjaan | WAJ-01 s.d. 12 |
| `00-pola-baku-tampilan.md` | Aturan tampilan: error, langkah, foto, tombol, handphone | TAM-01 s.d. 25 |
| `00-prinsip-rancangan.md` | Aturan data dan alur: waktu, jejak, kecepatan, upah, pengajuan | PRI-01 s.d. 44 |
| `00-peta-modul.md` | Modul apa saja, data milik siapa, hak akses | |
| `00-gambaran-sistem.md` | Batas sistem, rencana tayang, data lama, alat dan server. Keempat bagian ditetapkan (13 Oktober 2026) | SIS-01 s.d. 47 |
| `00-kamus-istilah.md` | Satu istilah, satu arti | |

Aturan cara bekerja (branch, klaim) ada di `../work/aturan-kerja.md` (KER-01 s.d. 14).

### Per modul

| File | Modul | Nomor | Status |
|---|---|---|---|
| `01-karyawan.md` | Karyawan (data induk) | KAR-01 s.d. 68 | **Ditetapkan** 11 Oktober 2026; 6 hal terbuka di bagian 6. Galian lama di `arsip/01-karyawan-galian.md` |
| `02-kehadiran.md` | Kehadiran | KEH-01 s.d. 79 | **Ditetapkan** 12 Oktober 2026; 1 hal terbuka di bagian 6 (pengenalan wajah). Galian lama di `arsip/02-kehadiran-galian.md` |
| `03-gaji.md` | Gaji bulanan | GAJ-01 s.d. 67 (62 s.d. 67 dari spec 4E-1) | **Ditetapkan** 12 Oktober 2026; 2 hal terbuka di bagian 6. Galian lama di `arsip/03-gaji-galian.md` |
| `04-logistik.md` | Logistik | LOG-01 s.d. 88 | **Ditetapkan** 12 Oktober 2026; 3 hal terbuka di bagian 6; LOG-87 dicabut 12 Oktober 2026. Galian lama di `arsip/04-logistik-galian.md` |
| `05-gaji-driver-kasbon.md` | Gaji driver, bongkaran, kasbon | DRV-01 s.d. 142 | **Ditetapkan** 12 Oktober 2026 (DRV-86 s.d. 92 dari 4G-1 dan DRV-93 s.d. 100 dari 4G-2, DRV-101 s.d. 110 dari 4G-3a, dan DRV-111 s.d. 120 dari 4G-3b, dan DRV-121 s.d. 130 dari 4G-4a, disetujui 14 Oktober 2026, dan DRV-131 s.d. 142 dari 4G-4b, disetujui 14 Oktober 2026); 1 hal terbuka di bagian 6. Galian lama di `arsip/05-gaji-driver-kasbon-galian.md` |
| `06-keuangan.md` | Keuangan | KEU-01 s.d. 224 | **Ditetapkan** 12 Oktober 2026 (KEU-124 s.d. 135 dari 4H-1, disetujui 14 Oktober 2026; KEU-136 s.d. 224 dari 4H-2 s.d. 4H-11, disetujui 14 Oktober 2026); 5 hal terbuka di bagian 6. Galian lama di `arsip/06-keuangan-galian.md` |
| `07-kinerja-rekrutmen.md` | Kinerja: rapor, Bonus Terukur, penjualan promo, tugas, Catatan Rapat (rekrutmen ditangguhkan) | KIN-01 s.d. 88 | **Ditetapkan** 13 Oktober 2026 (KIN-52 s.d. 88 dari 4I, disetujui 14 Oktober 2026); 5 hal terbuka di bagian 6 (isi pengaturan dan rincian spec). Galian lama di `arsip/07-kinerja-rekrutmen-galian.md` |
