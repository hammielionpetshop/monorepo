# Jenis upah dan jadwal bayar

Tanggal: 11 Oktober 2026

## Keadaan di lapangan (dari pemilik)

- Ada tiga jenis karyawan menurut cara digaji: bulanan, mingguan, dan harian.
- Karyawan bulanan kadang ikut pekerjaan yang dibayar harian, misalnya bongkaran.
- Ada pekerjaan yang dihitung harian tetapi uangnya diambil per minggu atau per bulan.
- Menurut pemilik, keadaannya "terlalu fleksibel".

### Rincian dari pemilik (11 Oktober 2026)

**Staff toko**, gaji bulanan. Jenisnya: kasir, helper toko (pramuniaga), groomer.

- Ada yang ikut bongkaran, dan ada yang ikut sebagai kenek saat hari liburnya.
- Tiap jenis punya komponen bonus; sebagian sama, sebagian berbeda.
- Jam kerja biasanya jelas, tetapi berubah saat harus back up ke toko lain yang
  jam operasionalnya berbeda dari cabang asal. Pemilik sering bingung menghitung
  gaji untuk hari-hari seperti ini.

**Staff gudang**: kepala gudang, driver, helper (kenek).

- Kepala gudang: gaji bulanan, punya absen, tidak dikenai keterlambatan, tidak ada
  lembur, jadwal libur tidak bisa diprediksi.
- Driver dan helper: dibayar per ritase, dan per borongan untuk bongkar muat barang
  dari supplier, Rp 20 per kg.
- Driver digaji mingguan dengan batas periode (cut off).

Menurut pemilik, jenis penggajiannya terlalu banyak sehingga membingungkan.

### Yang ditemukan di sistem lama (dilihat sekilas, digali penuh di Bab 5)

- Minggu gaji driver: **Jumat sampai Kamis**
  (`hris-app/app/(dashboard)/penggajian/driver/page.tsx`).
- Hitungan minggu yang sama ditulis ulang di halaman borongan
  (`hris-app/app/(dashboard)/penggajian/borongan/page.tsx`).
- Borongan: total kg dikali tarif per kg, lalu dibagi ke para pesertanya. Peserta
  bisa karyawan atau pekerja lepas.

## Masalah

Kalau sistem mengelompokkan **orang** ke dalam satu jenis gaji, setiap orang yang
keluar dari kelompoknya menjadi pengecualian. Sistem lama menangani ini dengan
pengecualian yang ditulis langsung di kode, termasuk dengan nama orang.

## Usulan Claude (belum disetujui; lihat P4 di `2026-10-11-usulan-pondasi-rancangan.md`)

Pisahkan tiga hal yang sekarang tercampur:

1. **Jenis pekerjaan berbayar**: dari apa uang itu didapat. Contoh: gaji tetap,
   upah ritase, upah bongkaran, lembur. Tiap jenis punya cara hitung sendiri
   (per bulan, per hari, per trip, per jam) dan tanggal berlaku.
2. **Catatan upah**: satu baris setiap kali seseorang mendapat upah.
   Isinya: siapa, pekerjaan apa, tanggal berapa, nominal, dan aturan mana yang
   dipakai. Karyawan bulanan yang ikut bongkaran mendapat satu baris upah
   bongkaran, tanpa mengubah status bulanannya.
3. **Jadwal bayar**: kapan catatan upah itu dibayarkan (mingguan atau bulanan).
   Ditentukan per jenis pekerjaan, dan bisa diatur per orang kalau memang berbeda.

Setiap pembayaran mengumpulkan semua catatan upah orang itu yang belum dibayar
dan sudah jatuh pada jadwalnya.

Dengan susunan ini, "karyawan bulanan ikut bongkaran" dan "kerja harian dibayar
bulanan" bukan pengecualian. Keduanya hanya isi data yang berbeda. Slip gaji dan
gaji driver menjadi satu cara kerja yang sama dengan jadwal berbeda.

## Yang dibutuhkan dari pemilik

Daftar semua jenis pekerjaan berbayar yang ada, dan untuk tiap jenis: dihitung per
apa, dan biasanya dibayar kapan. Claude menyusun daftar awalnya dari sistem lama
di Bab 3 dan Bab 5; pemilik melengkapi.

## Pertanyaan yang belum terjawab

1. Siapa yang mencatat bahwa seseorang ikut pekerjaan harian, dan siapa yang
   menyetujuinya?
2. Kalau karyawan bulanan ikut bongkaran di jam kerjanya sendiri, apakah tetap
   mendapat upah bongkaran?
3. Apakah karyawan boleh memilih sendiri upah hariannya diambil mingguan atau
   bulanan, atau ditentukan perusahaan?
4. Kasbon dipotong dari pembayaran yang mana?

Terjawab untuk bongkaran (12 Oktober 2026, galian Bab 5 bagian 5B.10):
pertanyaan 1, Kepala Gudang mencatat dan finance membayar; pertanyaan 2, tetap
dapat; bongkaran dibayar tunai hari itu, di luar slip, dan kasbon tidak
dipotong darinya. Untuk pekerjaan harian lain masih terbuka (5D).

Terjawab sebagian untuk pertanyaan 4 (12 Oktober 2026, 5C.10): kasbon dipotong
dari slip orangnya (bulanan atau mingguan) dan Dana Kasbon mengikuti jenis
slip. Masih terbuka untuk 5D: orang yang punya slip bulanan dan slip mingguan
sekaligus.

## Kapan dikerjakan

Dirancang setelah Bab 3 (gaji bulanan) dan Bab 5 (gaji driver, borongan, kasbon)
selesai digali. Ini keputusan desain terbesar di modul Gaji.

## Diputuskan (12 Oktober 2026)

Usulan di atas disetujui pemilik dan dirinci menjadi 14 aturan di galian Bab 5
bagian 5D.10 (`../../aturan/arsip/05-gaji-driver-kasbon-galian.md`). Keempat
pertanyaan terjawab: pertanyaan 3, jalur bayar ditentukan perusahaan per jenis
upah, karyawan tidak memilih; pertanyaan 4, kasbon dan semua potongan hanya
dari slip utama. Orang bergaji bulanan yang jadi kenek dapat ritase hanya di
hari liburnya; bongkaran tetap dibayar kapan pun. Tidak ada yang menunggu di
file ini.
