# Absen QR dengan titik lokasi

Tanggal: 11 Oktober 2026

## Keputusan pemilik

Di v3 semua absen memakai QR. Mesin fingerprint tidak dipakai lagi.
Titik lokasi (GPS) **wajib** dipakai bersama QR.

## Masalah di lapangan

Karyawan menyimpan gambar QR, lalu memindainya dari rumah. Menurut pemilik ini
titik paling krusial di absen. Pemilik ingin belajar memasang titik GPS dengan
akurat dan meminta dibantu.

## Yang sudah ada di sistem lama

- Tiap cabang bisa diberi titik lokasi dan radius (bawaan 150 meter, paling kecil
  10 meter). Lihat KAR-25 di `docs/aturan/01-karyawan.md`.
- Ada tabel `branch_qr_tokens`. Cara kerjanya belum digali.

## Catatan Claude untuk Bab 2 (belum disetujui)

QR yang gambarnya tetap selalu bisa difoto. Lokasi dari handphone bisa meleset
puluhan meter di dalam gedung, dan bisa dipalsukan dengan aplikasi tertentu.
Karena itu satu pengaman saja tidak cukup; yang dipakai biasanya berlapis:

| Lapisan | Mencegah apa | Catatan |
|---|---|---|
| QR yang berganti terus (tampil di layar toko, berubah tiap beberapa detik) | QR disimpan lalu dipindai dari rumah | Pengaman paling kuat untuk masalah ini; butuh satu layar di tiap cabang |
| Titik lokasi dan radius | Memindai dari tempat lain | Radius terlalu kecil membuat karyawan jujur ikut tertolak |
| Foto diri saat absen, dari kamera langsung | Absen dititipkan ke orang lain | TAM-08 |
| Jam dari server | Jam handphone diubah | PRI-01 |
| Catatan akurasi lokasi dan percobaan yang ditolak | Menemukan pola curang | Dilihat pemilik di riwayat |

## Pertanyaan untuk Bab 2

1. Bisakah tiap cabang menyediakan satu layar (handphone atau tablet bekas) untuk
   menampilkan QR yang berganti?
2. Driver, kenek, dan kepala gudang absen di mana?
3. Kalau lokasi ditolak padahal karyawan memang di toko, jalan keluarnya apa?
   (WAJ-11)
4. Berapa radius yang wajar untuk tiap cabang?

## Hasil pembahasan 2B (11 Oktober 2026)

Sudah diputuskan pemilik; rinciannya di `docs/aturan/arsip/02-kehadiran-galian.md`
bagian 2B.10. Ringkasnya: QR tetap dicetak (layar per cabang tidak memungkinkan),
pengaman utamanya titik lokasi dengan radius awal 100 meter, foto diri dari
kamera langsung berstempel lokasi, absen di luar titik tetap dihitung tetapi
wajib ditinjau sebelum slip ditutup, dan pola lokasi mencurigakan ditandai.

## Rencana pemilik untuk kelak: pengenalan wajah

Pemilik berencana memakai pengenalan wajah (face recognition) saat absen, untuk
menutup titip absen. Belum dirancang dan belum dijadwalkan. Rancangan absen v3
tidak boleh menutup jalan ke sana. Yang perlu diputuskan saat itu: foto acuan
tiap karyawan, dan lama penyimpanan foto absen (sekarang 60 hari).

Fitur memasang titik lokasi dipakai juga untuk titik toko tujuan pengiriman
driver (Bab 4, Logistik). Dibuat satu kali untuk dua modul.

## Kapan dikerjakan

Bab 2 (Kehadiran). Cara memasang titik lokasi yang akurat dijelaskan ke pemilik
di bab itu.
