# Gali aturan dari sistem lama

Tanggal: 11 Oktober 2026

## Masalah

Aturan bisnis HRIS tidak tertulis di satu tempat. Aturannya tersebar di kode
tampilan, kode import, dan trigger database sistem lama, sering dengan salinan
yang sedikit berbeda. Kalau v3 dibangun tanpa menggali dulu, aturan kecil yang
terkubur akan tertinggal dan hasil hitungannya meleset.

## Yang diinginkan

Satu buku aturan per modul di `docs/aturan/`, ditulis dalam bahasa bisnis, yang
bisa dibaca dan dikoreksi pemilik tanpa membaca kode.

Untuk setiap aturan yang ditemukan, pemilik memutuskan salah satu:

- **Bawa**: aturan masih berlaku, masuk ke v3.
- **Ubah**: aturan berlaku tetapi isinya ingin diperbaiki.
- **Buang**: aturan sudah tidak dipakai.

## Urutan

Mengikuti rencana bab di `../hris-app/docs/sistem/00-PETA-SISTEM.md`:

1. Data induk
2. Kehadiran
3. Gaji bulanan
4. Logistik
5. Gaji driver, borongan, dan kasbon
6. Keuangan
7. KPI, tugas, meeting, rekrutmen
8. Rangkuman buku aturan dan desain v3

## Batasan

Sistem lama dan database-nya hanya dibaca. Tidak ada yang diubah.
