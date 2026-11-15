# Susun ulang menu

Tanggal: 11 Oktober 2026

## Masalah

Menu sistem lama terlalu banyak. Menurut pemilik, banyak tab yang seharusnya cukup
satu. Hal ini baru terlihat setelah sistem dipakai bekerja sehari-hari.

## Menu utama sistem lama

Menurut pemilik, secara garis besar (belum termasuk sub menu):

1. Login
2. Portal Saya
3. Kinerja Saya
4. Panduan Karyawan
5. Laporan Kasir
6. SDM/HR
7. Operasional
8. Keuangan
9. Pengiriman Logistik
10. Penggajian
11. Catatan Meeting
12. Management User

## Yang diinginkan

Menu v3 yang lebih sedikit, tanpa tab yang isinya tumpang tindih.

## Catatan pemilik: tab yang seharusnya digabung

Diisi setiap kali pemilik teringat. Tulis apa adanya, tidak perlu rapi.

- (belum ada dari pemilik; 13 Oktober 2026 pemilik memilih "nanti saja".
  Isinya: menu atau tab sistem lama yang dari pengalaman sehari-hari terasa
  dobel atau tidak pernah dibuka. Disebut kapan saja teringat.)

## Status

Menu v3 **ditetapkan di Tahap 3C** (13 Oktober 2026):
`../specs/2026-10-13-menu-desain.md`. File ini tetap dipakai untuk catatan
pemilik di atas; catatan baru dibandingkan dengan susunan di spec itu.

## Temuan dari penggalian

Bab 1 (Karyawan), lihat `docs/aturan/01-karyawan.md` bagian 4:

- "Karyawan" dan "Undang Karyawan Baru": dua cara membuat karyawan.
- "Karyawan" dan "Manajemen User": aktif atau nonaktif diatur di dua tempat.
- "Perbarui Akun" dan "Profil Saya": keduanya mengubah data milik sendiri.
- Tiga pintu pendaftaran di halaman luar.

Bab 7 (Kinerja), lihat `docs/aturan/07-kinerja-rekrutmen.md` bagian 7 butir 10:

- "Tugas & Laporan" dan tugas di dalam "Catatan Meeting": dua mesin tugas,
  menjadi satu menu Tugas (KIN-27).
- "KPI", "Ranking Disiplin", dan "Target Penjualan Promo" di SDM: sama-sama
  bonus dari target; Rapor, Tugas, dan Catatan Rapat menjadi satu kelompok.
- Jenis "Aturan/SOP" di Catatan Meeting pindah ke Papan Perubahan Aturan
  (KIN-46).

Tahap 1 (batas sistem), lihat `docs/aturan/00-gambaran-sistem.md` SIS-06:

- "Panduan Karyawan", Papan Perubahan Aturan, dan Pedoman Lapor menjadi satu
  menu "Panduan".

## Kapan dikerjakan

Di Tahap 3 (rancangan lintas modul), setelah aturan semua modul digali. Setiap bab juga mencatat
sub menu modulnya, supaya daftar di atas menjadi lengkap.

- **14 Oktober 2026 (4F-4b):** menu Kerja Harian "Terima Retur" (menu v1)
  menjadi **"Barang Kembali"** (LOG-L44): satu daftar untuk retur, potong
  nota dibawa kembali, barang kejadian, dan kiriman tidak terkirim. Menu
  Logistik "Tertunda" (LOG-L49) dan "Retur" (LOG-L52) tetap.
