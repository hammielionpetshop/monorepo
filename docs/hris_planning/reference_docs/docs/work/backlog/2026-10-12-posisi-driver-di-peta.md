# Posisi driver di peta

Tanggal: 12 Oktober 2026

## Masalah

Saat driver sedang di jalan, pemilik tidak tahu driver sedang di mana. Pemilik
harus menelepon atau menunggu laporan.

## Yang diinginkan

Perjalanan driver ditampilkan di peta seperti Google Maps, sehingga pemilik bisa
melihat posisi driver saat itu dan toko mana yang sudah atau belum didatangi.

## Catatan Claude (belum disetujui)

- Posisi hanya direkam selama trip berjalan (dari berangkat sampai pulang), bukan
  sepanjang hari. Ini menyangkut privasi driver dan baterai handphone.
- Web yang dibuka di handphone (PRI-25) hanya bisa mengirim posisi selama
  halamannya terbuka di layar. Kalau layar dikunci atau driver membuka aplikasi
  lain, pengiriman posisi berhenti. Agar tetap berjalan di latar belakang,
  biasanya dibutuhkan aplikasi Android yang dipasang. Alat dan server v3
  sudah ditetapkan tanpa aplikasi Android (SIS-34 s.d. 46); kebutuhan ini
  diputuskan saat fitur ini dibuka, setelah v3 jadi.
- Titik lokasi toko (Bab 4, bagian 4A) menjadi dasarnya: sistem bisa menandai
  toko "sudah didatangi" kalau driver pernah berada di dalam radius toko itu.
- Peta dan rute memakai layanan peta pihak luar; sebagian berbayar sesuai
  pemakaian. Dipilih di Tahap 3.

## Kapan dikerjakan

Keputusan pemilik (12 Oktober 2026): dicatat dulu, dibahas sebagai **fitur
tambahan setelah v3 jadi**. Tidak digali di Bab 4. Rancangan v3 tidak boleh
menutup jalan ke fitur ini (misalnya trip punya waktu berangkat dan pulang yang
jelas, toko punya titik lokasi).
