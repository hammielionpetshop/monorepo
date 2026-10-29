# Bisa tumbuh, dan mungkin dijual

Tanggal: 11 Oktober 2026

## Keinginan pemilik

1. Sistem harus bisa dikembangkan semakin besar.
2. Tidak menutup kemungkinan aplikasi ini dijual ke perusahaan lain. Pemilik
   meminta hal ini ikut dipikirkan.

## Yang sudah menjadi aturan

Butir 1 sudah menjadi PRI-30 di `docs/aturan/00-prinsip-rancangan.md`.

## Keputusan pemilik (11 Oktober 2026)

**Tingkat B dulu.** Sudah menjadi PRI-31. Pembahasan menjual aplikasi ditunda
sampai pemilik menyatakan aplikasinya sudah sangat stabil.

## Usulan Claude untuk butir 2

Menjual aplikasi berarti satu sistem dipakai banyak perusahaan, masing-masing
dengan data dan aturannya sendiri. Ada tiga tingkat kesiapan:

| Tingkat | Artinya | Biaya |
|---|---|---|
| A. Tidak dipikirkan | Sistem hanya untuk Hammielion. Kalau kelak dijual, sebagian besar harus ditulis ulang. | Paling murah sekarang, paling mahal nanti |
| B. Siap dijual, belum dijual | Pintunya dibiarkan terbuka sejak rancangan, tetapi fitur penjualannya belum dibuat. | Sedikit tambahan di rancangan |
| C. Langsung dibuat untuk dijual | Pendaftaran perusahaan, tagihan, paket harga, halaman promosi, layanan pelanggan. | Besar; kira-kira menggandakan pekerjaan |

**Saran Claude: tingkat B.** Isinya empat hal:

1. **Setiap data mencatat milik perusahaan mana**, sejak tabel pertama. Hari ini
   isinya hanya satu perusahaan. Menambahkannya belakangan berarti mengubah semua
   tabel dan semua aturan hak akses.
2. **Tidak ada hal khusus Hammielion di kode.** Semua yang khas perusahaan menjadi
   pengaturan: nama dan logo, periode gaji (tanggal 26 sampai 25), minggu gaji
   (Jumat sampai Kamis), tarif, batas waktu, jenis pekerjaan, komponen bonus.
   Ini perluasan dari WAJ-05.
3. **Modul bisa dinyalakan atau dimatikan per perusahaan.** Grooming dan logistik
   pengiriman khas petshop; perusahaan lain mungkin hanya butuh Karyawan,
   Kehadiran, dan Gaji.
4. **Hak akses dari daftar, bukan dari kode** (sudah direncanakan).

Yang **tidak** dikerjakan di tingkat B: pendaftaran perusahaan baru, tagihan,
paket harga, dan halaman promosi.

## Yang perlu diketahui pemilik sebelum memutuskan

- Tingkat B membuat penggalian tiap modul sedikit lebih lama, karena tiap aturan
  ditanya: "ini aturan Hammielion, atau aturan umum?"
- Menyimpan data karyawan perusahaan lain membawa kewajiban hukum perlindungan
  data pribadi. Itu baru berlaku saat benar-benar dijual, dan perlu ditanyakan ke
  orang yang paham hukumnya.
- Aplikasi yang dijual butuh orang yang melayani pelanggan dan menjaga server.
  Itu keputusan bisnis, bukan rancangan.

## Kapan diputuskan

Di Tahap 1 (aturan sistem), bagian "batas sistem". Harus diputuskan sebelum Tahap
3 (rancangan lintas modul), karena memengaruhi setiap tabel.
