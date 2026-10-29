# Daftar Lintas Modul (Tahap 4J)

Tanggal: 14 Oktober 2026
Status: **Bab 1 disetujui penuh 14 Oktober 2026** (Q1 s.d. Q5 "ok", sesuai saran). **Bab 2 disetujui penuh 14 Oktober 2026** (Q1 s.d. Q4 "ok"). **Bab 3 disetujui penuh 14 Oktober 2026** (Q1 s.d. Q4 "ok", sesuai saran). **Bab 4 disetujui penuh 14 Oktober 2026** (Q1 dan Q2 "ok").

Gunanya: satu daftar yang merapikan titipan dari sembilan spec modul, supaya sesi
pembangunan tidak perlu membaca bagian 7, 8, dan 9 sembilan spec satu per satu.
Spec modul tetap sumber isi tiap jenis; daftar ini hanya menggabung dan
memeriksa silang (WAJ-04). Kalau keduanya berbeda, spec modul yang diperbaiki
atau daftar ini; tidak boleh dibiarkan berbeda (WAJ-10).

Pembagian 4J (disetujui pemilik 14 Oktober 2026, "ok"): **4J-1** jenis pengajuan
(bab 1), **4J-2** pemberitahuan dan pengingat (bab 2), **4J-3** pengaturan dan
aturan yang boleh dikecualikan (bab 3), **4J-4** periksa silang titipan antar
spec (bab 4), **4J-5** urutan pembangunan (`plans/`) dan penutup Tahap 4.

---

## Bab 1. Jenis pengajuan (4J-1)

Sumber: bagian 9 sembilan spec modul, PRI-07 s.d. 09, PRI-37, KAR-57 dan 79,
tabel "Hak lihat pengajuan" di `../../aturan/00-peta-modul.md`.

### 1.1 Cara membaca

- **Pemilik/GM** berarti Pemilik dan GM, yang haknya setara (KAR-67). Pengaju
  tidak pernah memutuskan pengajuannya sendiri (PRI-37 butir 3).
- Tanda **\*** = spec modul diam, isinya **usulan 4J-1** (butuh jawaban Q3).
- Total **24 jenis** (Q1 disetujui; akan 25 bila "Minta kasbon dibatalkan"
  tetap jenis sendiri). Logistik, Kinerja, dan Tarik Data Kasir tidak punya
  jenis pengajuan.

### 1.2 Standar penulisan batas waktu (usulan baru, jawaban Q2)

Supaya semua jenis memakai bahasa yang sama:

1. **Satuan hari kalender**, kecuali tertulis "hari kerja" (hanya Usulan pindah
   cabang). Batas selalu berakhir **pukul 23.59** hari terakhir.
2. **Titik awal selalu disebut**: "sejak diberi tahu", "sesudah tanggal
   kejadian", "sebelum tanggal pakai (H-N)", atau "sampai slip ditutup".
3. **Akibat terlewat hanya tiga** (pelapis atas PRI-08 yang hanya menyebut dua):
   - **Hangus**: tidak bisa diajukan lagi lewat sistem. Kalau pengajuannya belum
     ada, tombolnya hilang (tidak ada catatan); kalau sudah ada, statusnya
     Hangus. "Gugur" pada Tunda cicilan kasbon = Hangus.
   - **Pengajuan terlambat**: masih bisa lewat jalur tersendiri dengan alasan
     (hanya Penjelasan untuk lupa absen, KEH-60).
   - **Tidak berbatas**: tidak pernah Hangus; menunggu sampai diputuskan, dengan
     pengingat berantai (PRI-37 butir 4).
4. **Belum diputuskan** bukan akibat terlewat: pengajuan yang menunggu tidak
   pernah disetujui otomatis (PRI-37 butir 4).

### 1.3 Tabel A. Siapa, siapa melihat, apa yang dilampirkan

| No | Jenis | Modul | Pengaju | Penyetuju (Pemeriksa) | Ikut melihat | Lampiran | Tertutup | Minta dibatalkan setelah disetujui |
|---|---|---|---|---|---|---|---|---|
| 1 | Ubah data diri | Karyawan | Karyawan itu | HR, Admin HR, Pemilik/GM | — | Wajib untuk ganti rekening (KAR-80) | Ya | Tidak |
| 2 | Usulan Pengaturan Jabatan dan pengecualian | Karyawan | Pengusul | Pemilik/GM | Pengusul | Tidak | Tidak | Tidak |
| 3 | Usulan berhenti tanpa pemberitahuan | Karyawan | Pengusul | Pemilik/GM | Pengusul | Tidak | Ya | Tidak |
| 4 | Pengumuman yang menyangkut uang | Bersama | Penulis | Pemilik/GM | Penulis | Tidak | Tidak | Tidak |
| 5 | Usulan pengaturan | Bersama | Pengusul | Pemilik/GM | Pengusul | Tidak | Menurut pengaturannya | Tidak |
| 6 | Usulan pindah cabang | Kehadiran | Orang yang bersangkutan (lahir dari jawaban Ya di KEH-L10) | HR, Pemilik/GM | — | Tidak\* | Tidak\* | Tidak\* |
| 7 | Ajakan tukar (libur atau shift) | Kehadiran | Karyawan | **Hanya teman yang diajak**, bukan HR (KEH-43, 136) | Kepala Toko/Gudang: tanggal dan status (KEH-80) | Tidak | Tidak | Ya (KEH-40) |
| 8 | Izin (keperluan, mendadak, duka) | Kehadiran | Karyawan | HR, Pemilik/GM (milik HR diputuskan Pemilik/GM) | Kepala Toko/Gudang: tanggal dan status (KEH-80) | Surat tertutup (KEH-144); duka tidak wajib | Alasan dan lampiran | Ya (KEH-40) |
| 9 | Sakit (tanpa surat maks. 2 hari berturut-turut, dengan surat, surat menyusul) | Kehadiran | Karyawan | Sama dengan Izin | Sama dengan Izin | Surat dokter, tertutup | Alasan dan lampiran | Ya (KEH-40) |
| 10 | Cuti tahunan | Kehadiran | Karyawan | Sama dengan Izin | Sama dengan Izin | Tidak ada | Alasan | Ya (KEH-40) |
| 11 | Penjelasan (alpha, lupa absen, telat, pulang cepat); termasuk jalur Ajukan terlambat untuk lupa absen | Kehadiran | Karyawan | HR, Pemilik/GM | — | Foto surat dokter bila sakit dengan surat (tertutup) | Lampiran | Tidak |
| 12 | Klaim lembur | Kehadiran | Karyawan | HR, Pemilik/GM | — | Foto kertas lembur dan nama penyuruh (tertutup, 60 hari sesudah slip ditutup) | Lampiran | Tidak |
| 13 | Usulan ubah gaji | Gaji Bulanan | HR | Pemilik/GM | Pengaju | Tidak\* | Ya | Tidak |
| 14 | Usulan potongan (kehilangan barang, minus kas catat tangan, Potongan Lain) | Gaji Bulanan | HR (minus kas juga Finance) | Pemilik/GM | Pengaju | Tidak\* | Ya | Tidak |
| 15 | Keberatan potongan (minus kas catat tangan bernama, Potongan Lain, denda driver dan kenek) | Gaji Bulanan dan Gaji Driver | Orang yang dikenai | Pemilik/GM, bukan dirinya | — | Tidak\* | Ya | Tidak |
| 16 | Usulan bonus (Bonus Bebas dan jenis ketik lain) | Gaji Bulanan | HR | Pemilik/GM, bukan untuk dirinya | Pengaju | Tidak\* | Ya | Tidak |
| 17 | Keberatan slip, dua macam: "Ada yang salah" dan "Uang belum saya terima" (slip bulanan dan mingguan) | Gaji Bulanan dan Gaji Driver | Pemilik slip (mantan karyawan dalam akses terbatas) | "Ada yang salah": HR, Pemilik/GM (slip GM: Pemilik; slip Pemilik: GM atau Pemilik lain). "Uang belum saya terima": Pemilik/GM | — | Tidak\* | Ya | Tidak |
| 18 | Usulan denda driver dan kenek | Gaji Driver | Kepala Gudang | Pemilik/GM, bukan untuk dirinya | Pengaju | Tidak\* | Ya\* | Tidak |
| 19 | Laporan Bongkaran terlambat (tanggal kerja lebih dari 3 hari lalu) | Gaji Driver | Kepala Gudang | Pemilik/GM, bukan pembuat dan bukan peserta laporan itu | Pengaju | Foto surat jalan (sudah wajib di laporan) | Tidak\* | Tidak |
| 20 | Upah bongkaran belum diterima | Gaji Driver | Peserta berakun (Pemilik/GM boleh mengisikan untuk pekerja lepas) | Pemilik/GM | — | Tidak\* | Ya\* | Tidak |
| 21 | Kasbon (termasuk **Minta dibatalkan** sebelum uang diberikan, kalau Q1 disetujui) | Gaji Driver | Karyawan; HR, Admin HR, Pemilik/GM boleh mengisikan atas nama | Pemeriksa: Finance (bukan miliknya). Penyetuju: Pemilik/GM (bukan miliknya) | HR (mengisi atas nama) | Tidak\* | Ya\* | Ya, sampai uang diberikan (DRV-72) |
| 22 | Uang kasbon belum diterima | Gaji Driver | Pemilik kasbon | Pemilik/GM | — | Tidak\* | Ya\* | Tidak |
| 23 | Tunda cicilan kasbon | Gaji Driver | Pemilik kasbon; HR, Admin HR atas nama | Pemilik/GM, bukan miliknya | — | Tidak\* | Ya\* | Tidak |
| 24 | Keberatan kekurangan kas (dulu "keberatan selisih kasir") | Keuangan | Penanggung kekurangan (penutup shift, pembawa, penyetor) | Pemilik/GM, bukan miliknya | — | Tidak\* | Ya\* | Tidak |

### 1.4 Tabel B. Batas waktu dan akibat

| No | Jenis | Batas mengajukan (titik awal) | Akibat terlewat | Yang terjadi bila belum diputuskan |
|---|---|---|---|---|
| 1 | Ubah data diri | Tidak ada | Tidak berbatas | Menunggu; data lama tetap |
| 2 | Usulan Pengaturan Jabatan dan pengecualian | Tidak ada | Tidak berbatas | Nilai lama tetap |
| 3 | Usulan berhenti tanpa pemberitahuan | Tidak ada | Tidak berbatas | Slip terakhir tertahan sampai diputuskan |
| 4 | Pengumuman yang menyangkut uang | Tidak ada | Tidak berbatas | Tidak terbit; jadwal yang terlewat digeser, tanggal berlaku ikut digeser (jarak 7 hari terjaga) |
| 5 | Usulan pengaturan | Tidak ada | Tidak berbatas | Nilai lama tetap |
| 6 | Usulan pindah cabang | 3 hari kerja sejak jawaban Ya | Hangus\* (HR masih bisa mencatat perubahan penempatan langsung, KAR-L22) | Menunggu |
| 7 | Ajakan tukar | H-2 dari tanggal yang lebih dekat | Hangus (ditolak server) | Menunggu teman menjawab |
| 8 | Izin | Keperluan: H-2 sebelum harinya. Mendadak dan duka: 3 hari sesudah harinya | Hangus: hari menjadi alpha (KEH-141) | Menunggu; tidak pernah disetujui otomatis |
| 9 | Sakit | 3 hari sesudah hari pertama; surat menyusul 3 hari sesudah masuk kembali | Hangus: alpha; surat terlewat: tetap sakit tanpa surat (KEH-143) | Menunggu |
| 10 | Cuti tahunan | H-7; masa kerja 1 tahun penuh; sisa cukup | Hangus (ditolak server) | Menunggu |
| 11 | Penjelasan | 3 hari sesudah tanggal kejadian (3 hari sesudah penolakan bila lahir dari KEH-62 atau 147) | **Lupa absen: Pengajuan terlambat.** Lainnya: Hangus (potongan telat dan alpha tetap; pulang cepat bertanda "belum dijelaskan", KEH-155) | Menunggu |
| 12 | Klaim lembur | 3 hari sesudah tanggal hari kerja, 23.59 (hari lupa absen yang dijelaskan: 3 hari sejak penjelasan disahkan) | Hangus, **tanpa** jalur terlambat (PRI-09) | Menunggu |
| 13 | Usulan ubah gaji | Sampai batas tutup slip periode yang dipilih | Hangus; pengusul boleh mengusulkan untuk periode berikutnya | Menunggu |
| 14 | Usulan potongan | Tidak ada | Tidak berbatas; kalau disetujui sesudah slip ditutup, masuk slip berikutnya dengan keterangan periode asal (GAJ-50) | Menunggu; pengingat berantai sebelum batas tutup |
| 15 | Keberatan potongan | 3 hari sejak diberi tahu, 23.59 | Hangus (tombol hilang) | Potongan tetap berjalan; slip tidak tertahan |
| 16 | Usulan bonus | Tidak ada | Tidak berbatas; sama seperti no. 14 | Menunggu |
| 17 | Keberatan slip | "Ada yang salah": sejak periode (mingguan: Jumat 00.00) sampai 23.59 hari ke-3 sesudah slip ditutup. "Uang belum saya terima": 7 hari sesudah Dibayar | Hangus (tombol hilang) | Tidak Hangus dan tidak menahan slip; pengingat berantai ke penyetuju |
| 18 | Usulan denda driver dan kenek | 7 hari sesudah kejadian | Hangus (tombol hilang); keputusan tanpa batas | Pengingat harian; bila disahkan sesudah slip minggu itu ditutup, masuk slip berikutnya |
| 19 | Laporan Bongkaran terlambat | Tanpa batas mengajukan dan memutuskan | Tidak berbatas | Pengingat harian; belum ada upah dan belum bisa dibayar |
| 20 | Upah bongkaran belum diterima | 3 hari sejak diberi tahu dibayar, 23.59 | Hangus (tombol hilang, sampaikan langsung ke kantor) | Pengingat harian; tidak ada akibat uang otomatis |
| 21 | Kasbon | Tanpa batas mengajukan; kantor memproses dalam 2 hari | Tidak berbatas (lewat 2 hari: ditandai untuk Finance dan Pemilik/GM) | Pengingat harian; tidak ditolak dan tidak disetujui otomatis |
| 22 | Uang kasbon belum diterima | 3 hari sejak diberi tahu diberikan, 23.59 | Hangus (tombol hilang) | Tidak ada akibat uang otomatis |
| 23 | Tunda cicilan kasbon | Selama slip cicilan terdekat masih Perkiraan; diputuskan sebelum slip itu ditutup | Hangus ("gugur"): cicilan dipotong biasa, jatah tidak terpakai, boleh minta lagi | Bukan penahan slip |
| 24 | Keberatan kekurangan kas | 3 hari sejak diberi tahu, 23.59 | Hangus (tombol hilang) | Belum diputuskan saat slip ditutup: tetap dipotong; bila kemudian Ditiadakan, dikembalikan di slip berikutnya |

### 1.5 Yang sengaja **bukan** pengajuan

Daftar ini mencegah sesi pembangunan membuat jenis baru untuk hal yang sudah
diputuskan memakai jalan lain:

| Hal | Jalannya | Alasan singkat |
|---|---|---|
| Memilih libur, permintaan masuk di hari libur | Langsung berlaku / perintah kantor (KEH-131, 137) | Tidak perlu persetujuan |
| Titik toko, potong nota, Kiriman Gagal, permintaan bensin | Diputuskan di layar sendiri (LOG-L06, L42, L50, bensin) | Bukan permintaan untuk diri sendiri; tidak ada yang Hangus |
| Pemeriksaan Buku Kas, struk tidak datang, pengesahan saldo awal, retur, utang awal, Piutang Lain, tagihan | Daftar kerja Pemilik/GM di layar sendiri (KEU) | Tidak ada pengaju |
| Laporan promo, usulan promo tidak sah, laporan akhir tugas | KIN-L27, KIN-L25, GAJ-L20 | Daftar kerja HR dan Pemilik/GM |
| Tarif driver | Diubah langsung Pemilik/GM (DRV-13) | HR tidak mengusulkan |
| Kasbon Khusus, ubah jadwal, pelunasan tunai, hapus utang | Tindakan langsung yang berhak (DRV-75) | Bukan permintaan |
| Minta buka kembali slip | Pemberitahuan Antrean saja (GAJ) | Tanpa setuju atau tolak |
| Perubahan dari kasir | Perlu Diperiksa (TDK-L06) | Data datang dari mesin |
| Serah terima, Lapor Masalah, Keadaan Mobil | Laporan (KEH-L21 s.d. L25) | Tidak ada keputusan setuju/tolak |
| Pendaftaran dan promosi training | Mesin (KAR) | Pendaftar belum menjadi orang di sistem |

### 1.6 Temuan periksa silang bab 1

1. **Tabel "Hak lihat pengajuan" di `00-peta-modul.md` sudah usang** (melanggar
   WAJ-10): masih menulis "Libur" (kini langsung berlaku), "Klarifikasi" (kini
   Penjelasan), "Keberatan selisih kasir" (kini Keberatan kekurangan kas), dan
   tidak memuat 14 jenis di atas. Setelah bab 1 disetujui, tabel itu diganti
   dengan penunjuk ke daftar ini.
2. **"Minta kasbon dibatalkan" dobel mekanisme** (jenis sendiri di spec 4G,
   padahal BER-L07 sudah punya tombol "Minta dibatalkan" untuk semua jenis
   yang mengizinkan, KEH-40). Q1.
3. **Akibat terlewat di spec lebih banyak dari PRI-08**: "tombol hilang",
   "gugur", dan "tidak hangus, menunggu" tidak ada di PRI-08. Q2.
4. **Kolom Lampiran dan Tertutup kosong di spec Gaji, Driver, dan Keuangan**
   (tanda \* di tabel A). Q3.
5. **Batas "uang belum diterima" tidak sama**: slip 7 hari, bongkaran dan
   kasbon 3 hari. Q4.
6. **Usulan pindah cabang tidak menulis akibat terlewat** (tanda \* tabel B). Q3.
7. **Keberatan potongan dan Keberatan slip dipakai dua modul** (Gaji Bulanan
   dan Gaji Driver): sudah satu jenis, bukan dua. Dicatat supaya tidak
   dibangun dobel (WAJ-04).

### 1.7 Pedoman lapor: isi awal (disetujui sebagai isi awal, Q5; pemilik boleh mengubah di KAR-L35)

Satu baris per jenis, tampil di kepala isian pengajuan (BER-L06, KAR-79).
Hanya jenis yang diajukan karyawan sendiri yang butuh baris; jenis yang hanya
diajukan kantor (no. 2 s.d. 5, 13, 14, 16, 18, 19) tidak memakai pedoman.
Isi akhir ditentukan pemilik dan bisa diubah di KAR-L35.

| No | Jenis | Baris pedoman (isi awal, disetujui 14 Oktober 2026) |
|---|---|---|
| 1 | Ubah data diri | "Ganti rekening wajib foto buku tabungan. HR memeriksa." |
| 6 | Usulan pindah cabang | "Bicarakan dulu dengan kepala cabang yang lama; HR yang memutuskan." |
| 7 | Ajakan tukar | "Sepakati dulu dengan temanmu, baru ajak lewat sini. Atasan cukup diberi tahu." |
| 8 | Izin | "Kabari Kepala Toko atau Kepala Gudang lebih dulu lewat WA supaya shift bisa diatur, lalu ajukan di sini." |
| 9 | Sakit | "Kabari Kepala Toko atau Kepala Gudang lebih dulu lewat WA. Kirim surat dokter bila ada, paling lambat 3 hari setelah masuk kembali." |
| 10 | Cuti tahunan | "Bicarakan tanggalnya dengan Kepala Toko atau Kepala Gudang dulu, lalu ajukan paling lambat 7 hari sebelumnya." |
| 11 | Penjelasan | "Ceritakan apa yang terjadi dengan jujur dalam 3 hari. Sakit dengan surat: lampirkan foto surat dokter." |
| 12 | Klaim lembur | "Ajukan dalam 3 hari. Lewat itu hangus; bicarakan langsung dengan pemilik." |
| 15 | Keberatan potongan | "Cek dulu rinciannya di slip. Kalau masih salah, ajukan dalam 3 hari sejak diberi tahu." |
| 17 | Keberatan slip | "Cek dulu rincian slip. Ada yang salah: ajukan dalam 3 hari sesudah slip ditutup. Uang belum masuk: dalam 7 hari sesudah Dibayar." |
| 20 | Upah bongkaran belum diterima | "Tanyakan dulu kepada yang menyerahkan uang. Kalau tetap belum, ajukan dalam 3 hari." |
| 21 | Kasbon | "Ajukan di sini. Finance memeriksa, pemilik memutuskan, biasanya 2 hari." |
| 22 | Uang kasbon belum diterima | "Tanyakan dulu kepada yang menyerahkan uang. Kalau tetap belum, ajukan dalam 3 hari." |
| 23 | Tunda cicilan kasbon | "Ajukan sebelum slip cicilan terdekat ditutup; kalau telat, cicilan dipotong seperti biasa." |
| 24 | Keberatan kekurangan kas | "Cek dulu laporan kasir shift itu. Kalau masih keberatan, ajukan dalam 3 hari sejak diberi tahu." |

### 1.8 Pertanyaan bab 1 (diketik di percakapan 14 Oktober 2026)

**Dijawab "ok" 14 Oktober 2026 = setuju saran untuk Q1 s.d. Q5.** Jangan tanyakan ulang. Hasilnya: PRI-42; tabel hak lihat di peta modul diganti penunjuk ke bab ini; spec Gaji Driver (jenis "Minta kasbon dibatalkan") dan spec 4A/4B/4D/4E/4G/4H diperlakukan sesuai bab ini, dan bila berbeda, bab ini yang berlaku sampai spec dirapikan di 4J-4.

- **Q1.** Gabung "Minta kasbon dibatalkan" ke tombol Minta dibatalkan bawaan
  (saran: ya).
- **Q2.** Tiga akibat terlewat resmi (Hangus, Pengajuan terlambat, Tidak
  berbatas) sebagai pelapis PRI-08, dan standar penulisan batas di 1.2 (saran:
  ya).
- **Q3.** Isi kolom yang masih kosong memakai usulan bertanda \* di tabel A
  dan B (saran: ya).
- **Q4.** Batas "uang belum diterima" tetap berbeda: 7 hari untuk slip, 3 hari
  untuk bongkaran dan kasbon (saran: tetap berbeda, alasannya ditulis).
- **Q5.** Memakai baris pedoman isi awal di 1.7 sebagai isi awal (saran: ya, pemilik
  boleh mengubah kapan saja di KAR-L35).

---

## Bab 2. Pemberitahuan dan pengingat (4J-2)

Status: **Disetujui penuh 14 Oktober 2026** (Q1 s.d. Q4 "ok", sesuai saran; PRI-43). Jangan tanyakan ulang.

Sumber: bagian 7 sembilan spec modul (369 baris; kira-kira 160 di antaranya
bertanda Antrean), TAM-22, TAM-24, TAM-25, PRI-33, PRI-35, PRI-36, PRI-37,
KAR-73. Bab ini **tidak menyalin ulang 369 baris**. Ia menetapkan (a) arti tiap
istilah di spec, (b) daftar **jenis urusan** yang masuk antrean berantai,
(c) mesin penjaga yang harus bisa memunculkan tanda, dan (d) temuan periksa
silang. Kabar yang hanya "diketahui" (lonceng, Beranda, layar saja) tetap
dibaca dari bagian 7 spec modulnya; aturannya sudah cukup di 2.2 (WAJ-04).
Kolom Sumber memakai kode yang tertulis di kolom Alasan bagian 7 spec modul.

### 2.1 Peta istilah spec ke tiga pintu baku (TAM-25)

Spec modul memakai kata yang berbeda-beda untuk pintu yang sama. Pembangun
memakai peta ini:

| Kata di spec | Pintu baku | Sifat |
|---|---|---|
| Antrean, antrean berantai, pengingat berantai | **Antrean berantai** (TAM-25 butir 1) | Jendela satu per satu, muncul lagi tiap hari sampai urusan beres; selalu ikut tampil di Perlu perhatian |
| Perlu perhatian, angka penanda, kotak di layar, Dashboard | **Perlu perhatian** (butir 2) | Hilang sendiri saat beres; tanpa tombol tutup |
| Pemberitahuan, Pemberitahuan aplikasi | **Lonceng** (butir 3) | Terbaca saat dibuka; disimpan 90 hari |
| Beranda | **Lonceng** (usulan Q1), dengan kartu "Kabar terbaru" di Beranda | Kabar yang cukup diketahui |
| Pengumuman (Papan) | **Papan Perubahan Aturan** (PRI-35) | Dibaca sekali; belum dibaca masuk antrean |
| Pengumuman darurat | Antrean paling depan (PRI-36) | 5 detik |
| Layar saja | Tidak ada pemberitahuan | Hanya terlihat di layarnya |
| Jendela baca | Khusus KEH-L21 (serah terima), bukan antrean | Muncul sesudah absen masuk |
| Para pemilik | Pemilik dan GM (KAR-73) | Pelaku tidak diberi tahu tindakannya sendiri |

### 2.2 Aturan pelengkap (usulan 4J-2)

1. **"Tiap pagi", "tiap hari", "harian", "sekali sehari"** di spec semuanya
   berarti TAM-22 butir 4: muncul sekali sehari saat orang itu pertama membuka
   aplikasi hari itu. Tidak ada jam kirim tersendiri.
2. **Satu jenis urusan, satu jendela** (TAM-25 butir 4). Jenis urusan
   ditetapkan di tabel 2.3; menambah jenis baru berarti menambah baris di sana.
3. **Antrean ada dua macam** (usulan Q2): *berantai* (berulang sampai beres)
   dan *sekali baca* (muncul sekali, hilang setelah "OK, sudah baca"). Sekali
   baca hanya untuk kabar pribadi yang mengubah uang, hak, atau jadwal orang itu
   dan yang tidak punya batas waktu (2.4).
4. **Beres untuk satu berarti beres untuk semua** penerima peran yang sama:
   kalau Pemilik sudah memutuskan, butir yang sama hilang dari antrean GM.
5. **Pelaku tidak diberi tahu tindakannya sendiri** (contoh: pencatat tidak
   mendapat "catatan Anda disimpan"). Pengecualian: pembawa atau penerima uang
   yang berbeda dari pencatat.
6. **Butir mati tidak ditinggal.** Kalau akun penerima nonaktif, jabatan
   penerima kosong, atau penerima cuti lebih dari 2 hari, butir naik sesuai Q4.
7. **Isi jendela menyebut yang perlu diputuskan**: jumlah, yang paling lama,
   dan akibat bila terlewat (PRI-07), tanpa nominal uang orang lain.

### 2.3 Tabel B. Jenis urusan antrean berantai

Satu baris = satu jenis jendela. "Berhenti" = urusan dianggap beres. Pengingat
untuk pengajuan di Bab 1 (nomor 1 s.d. 24) **tidak diulang di sini**: semuanya
memakai baris B1 s.d. B3. Baris yang menggabung beberapa kabar berarti tetap
satu jenis jendela per kelompok, dengan jumlah dan yang paling lama (TAM-25
butir 4).

**Umum (Mesin Pengajuan dan Papan)**

| No | Jenis urusan | Kepada | Muncul saat | Berhenti | Sumber |
|---|---|---|---|---|---|
| B1 | Pengajuan menunggu keputusan | Penyetuju/pemeriksa jenis itu | Menunggu lebih dari 1 hari | Diputuskan | PRI-37, TAM-24 |
| B2 | Pengajuan menunggu lebih dari 2 hari | Pemilik, GM (juga Perlu perhatian) | Hari ke-3 | Diputuskan | PRI-37 |
| B3 | Hak mengajukan akan hangus | Orang yang berhak | Sebelum batas (kecuali tertulis lain di Tabel A) | Diajukan atau hangus | TAM-24 butir 1 |
| B4 | Pengumuman belum dibaca | Sasaran | Terbit | Dibaca | PRI-35 butir 5 |
| B5 | Pengumuman darurat | Sasaran | Terbit (paling depan) | Dibaca | PRI-36 |

**Karyawan (KAR) dan Tarik Data Kasir (TDK)**

| No | Jenis urusan | Kepada | Muncul saat | Berhenti | Sumber |
|---|---|---|---|---|---|
| B6 | Pendaftar menunggu | HR, Admin HR | Lebih dari 1 hari | Disetujui/ditolak | TAM-24 butir 2 |
| B7 | Training waktunya dinilai | HR, Pemilik, GM | Tanggal penilaian | Dinilai | KAR bagian 7 |
| B8 | 7 hari tanpa kabar | HR, Pemilik, GM | Hari ke-7 | Diputuskan | KAR bagian 7 |
| B9 | Tinjauan pengecualian | Pemilik, GM; pengisi di H-7 | Jadwal tinjau | Ditinjau | PRI-38 |
| B10 | Orang dijeda lupa password minta kode | GM | Permintaan masuk | Kode diberikan | KAR bagian 7 |
| B11 | Nama baru belum dipasangkan (supplier, toko) | Finance | Lebih dari 1 hari | Dipasangkan | TDK bagian 7 |
| B12 | Nama baru belum dipasangkan (groomer, pengantar) | HR | Lebih dari 1 hari | Dipasangkan | GAJ-61 |
| B13 | Cabang kasir belum dipasangkan | GM, Owner | Terdeteksi | Dipasangkan | TDK bagian 7 |
| B14 | Baris Perlu Diperiksa | Pemegang urusannya | Ada baris | Semua diperiksa | TDK-L06 |
| B15 | Tarikan gagal lebih dari 15 menit di jam buka | GM, Owner | 15 menit | Tarikan pulih | TDK bagian 7 |

**Kehadiran (KEH)**

| No | Jenis urusan | Kepada | Muncul saat | Berhenti | Sumber |
|---|---|---|---|---|---|
| B16 | Kelompok giliran atau shift belum diisi | Kepala cabang, HR | Terdeteksi; shift lebih dari 1 hari | Terisi | KEH-103 |
| B17 | QR dibuat ulang | Kepala cabang, HR | QR baru dibuat | Ditandai "sudah ditempel" | KEH bagian 7 |
| B18 | Orang perbantuan tanpa shift cocok | Kepala cabang tujuan | Hari absen | Shift dicek | KEH bagian 7 |
| B19 | Pulang menunggu laporan | Orang itu | Foto pulang terkirim | Laporan dikirim (batas 04.00) | KEH-89, 91 |
| B20 | Trip ditutup kantor, Laporan Pulang menunggu | Driver | Trip ditutup | Laporan dikirim | KEH-101 |
| B21 | Keadaan mobil perlu perhatian | Kepala Gudang, Finance | Laporan masuk | Salah satu menandai Selesai | KEH-94, 130 |
| B22 | Laporan masalah baru | GM, Pemilik (yang menyangkut GM: Pemilik) | Per laporan, sekali | Dibaca | KEH bagian 7 |
| B23 | Jendela memilih libur terbuka, jatah belum lengkap | Orang itu | H-7, H-3, H-1 sebelum tutup | Jatah lengkap | KEH-132, TAM-22 |
| B24 | Ajakan tukar masuk | Teman yang diajak | Ajakan | Dijawab (batas H-2) | KEH-44 |
| B25 | Diminta masuk di hari libur | Orang itu | Permintaan | Siap masuk + pengganti dipilih | KEH-137 |
| B26 | Libur pengganti belum dipilih | Orang itu | Sisa 3 hari | Dipilih atau Hangus | KEH-138 |
| B27 | Izin, sakit, cuti menunggu | HR, Pemilik (milik HR: penyetuju lain) | Tiap hari | Diputuskan | KEH-147 |
| B28 | Surat dokter menyusul, sisa 1 hari | Pengaju | Sisa 1 hari | Surat masuk | KEH-143 |
| B29 | Kejadian perlu dijelaskan; sisa 1 hari; hari terakhir | Orang itu | Kejadian; H-1; hari terakhir | Dijelaskan atau lewat | KEH-58 |
| B30 | Penjelasan menunggu keputusan | HR, Pemilik (milik HR: penyetuju lain) | Tiap hari | Diputuskan | KEH-69 |
| B31 | Tidak masuk berturut-turut (hari ke-7) | HR, Pemilik | Hari ke-7 | Ditandai Sudah dilihat | KEH-55, 157 |
| B32 | Lembur terdeteksi, belum diklaim | Orang itu | Jendela "Ini lembur?", lalu H-1 dan hari terakhir | Diklaim, Bukan lembur, atau hangus | KEH-72, 161 |
| B33 | Klaim lembur menunggu keputusan | HR, Pemilik (milik HR: penyetuju lain) | Tiap hari | Diputuskan | KEH-69 |
| B34 | Absen luar titik menunggu putusan | HR, Pemilik | Absen luar titik | Diputuskan | KEH-14 |

**Gaji bulanan (GAJ)**

| No | Jenis urusan | Kepada | Muncul saat | Berhenti | Sumber |
|---|---|---|---|---|---|
| B35 | Usulan ubah gaji menunggu | Pemilik, GM | Usulan | Diputuskan | PRI-37 butir 4 |
| B36 | Orang belum punya gaji | HR (jabatan bertanda: Pemilik, GM) | Terdeteksi | Gaji diisi | GAJ bagian 7 |
| B37 | Usulan potongan menunggu (kehilangan barang, minus kas catat tangan, Potongan Lain, tiadakan potongan telat) | Pemilik, GM; HR melihat | Usulan; makin dekat batas tutup | Disahkan/ditolak | GAJ-11, KEH-66 |
| B38 | Keberatan potongan menunggu | Pemilik, GM | Keberatan masuk | Diputuskan | GAJ-81 |
| B39 | Bonus menunggu pengesahan (per tab, termasuk Bonus Bebas) | HR, Pemilik, GM | Bonus masuk; makin dekat batas tutup | Disahkan/ditolak | GAJ bagian 7 (B1, B6) |
| B40 | Bonus ditahan (penerima di luar jabatan penerima); pengesahan ditolak karena Dana Disiplin kurang; perubahan dari kasir atas bonus yang sudah disahkan | HR (jabatan bertanda: Pemilik, GM); soal dana: Pemilik, GM | Terdeteksi | Diputuskan | PRI-41 |
| B41 | **Slip tertahan** (satu jenis, lihat 2.6 temuan 3) | Penyelesai tiap penahan; HR, Pemilik, GM untuk daftarnya | Lewat batas tutup, atau slip hendak ditutup | Semua penahan beres | GAJ bagian 7 (S1, S2), KEH-69 |
| B42 | Minta buka kembali slip | Pemilik, GM | Permintaan HR | Diputuskan | GAJ bagian 7 (S3) |
| B43 | Slip atau bayar di luar slip lewat jatuh bayar, belum Dibayar | Pemilik, GM | Lewat jatuh bayar | Ditandai Dibayar | GAJ-59, DRV-27 |
| B44 | Keberatan slip menunggu; disetujui belum tertaut pembetulan | Penyetuju macamnya; Pemilik, GM setelah 2 hari | Keberatan masuk | Diputuskan dan tertaut | GAJ-42, 60 |
| B45 | Dana Disiplin Tersedia minus karena slip dibuka kembali | Pemilik, GM | Terdeteksi | Saldo tidak minus lagi | 4E-5a |

**Logistik (LOG)**

| No | Jenis urusan | Kepada | Muncul saat | Berhenti | Sumber |
|---|---|---|---|---|---|
| B46 | Titik toko menunggu persetujuan (lebih dari 2 hari); laporan titik salah | Kepala Gudang | 2 hari; per laporan | Diputuskan | LOG-80 |
| B47 | Trip belum ditutup | Kepala Gudang, Pemilik, GM | 12.00 hari berikutnya | Trip ditutup | LOG-31 |
| B48 | Uang tunai trip belum diserahkan | Awak trip; Kepala Gudang, Finance, Pemilik, GM | 12.00 hari berikutnya | Diserahkan | LOG bagian 7 (V1) |
| B49 | Uang tunai antar sendiri menunggu diterima | Karyawan cabang asal yang bertugas, Kepala Toko | Tugas selesai | Diterima | LOG bagian 7 (V2) |
| B50 | Kiriman Gagal perlu keputusan | Kepala Gudang (surat jalan); staf cabang asal dan Kepala Toko (laporan muat) | Sesudah 3 hari | Diputuskan | LOG-56 |
| B51 | Potong nota menunggu lebih dari 3 hari; retur menunggu nilai lebih dari 3 hari | Finance | 3 hari | Diputuskan | LOG-52, 60 |
| B52 | Toko mau retur; barang tidak sesuai menunggu tinjau | Kepala Gudang | Per laporan | Ditandai/ditinjau | LOG-61 |
| B53 | Catat di Kasir menunggu lebih dari 2 hari; sengketa tagihan; file piutang lebih tua dari 7 hari | Finance (Catat di Kasir: juga Pemilik, GM) | Sesuai batas | Dicatat/selesai | LOG bagian 7 (D1, D5, D6) |
| B54 | Permintaan bensin belum ditutup | Kepala Gudang, Finance | 12.00 hari berikutnya | Ditutup | LOG-83 |
| B55 | Kirim di luar titik belum ditinjau lebih dari 3 hari | Kepala Gudang | 3 hari | Ditinjau | LOG bagian 7 (B2) |
| B56 | Barang kembali (Diserahkan) untuk cabang; barang dibeli toko perlu koreksi stok | Staf/Kepala Toko cabang pemilik; Kepala Gudang | Dicatat | Diterima/dikoreksi | LOG-54, K6 |

**Gaji Driver, Bongkaran, Kasbon (DRV)**

| No | Jenis urusan | Kepada | Muncul saat | Berhenti | Sumber |
|---|---|---|---|---|---|
| B57 | Ritase belum bertarif | Pemilik, GM | Terdeteksi | Tarif diisi | DRV bagian 7 |
| B58 | Slip mingguan siap ditutup / masih Perkiraan sesudah Jumat 15.00 | HR, Pemilik, GM | Jumat 15.00 | Ditutup | DRV-22, S4 |
| B59 | Usulan denda menunggu | Pemilik, GM | Usulan | Diputuskan | DRV-29 |
| B60 | Laporan Bongkaran terlambat menunggu persetujuan | Pemilik, GM | Laporan | Diputuskan | DRV-36, L4 |
| B61 | Laporan Bongkaran belum dibayar lewat harinya; susulan menunggu dibayar | Finance, Pemilik, GM | Lewat harinya | Dibayar | DRV-49, 52 |
| B62 | Finance bertanya tentang laporan; peserta melapor uang belum diterima; lebih bayar 30 hari belum tertagih | Pembuat laporan; Pemilik, GM | Per kejadian | Dijawab/diputuskan | DRV-49, B2, B4 |
| B63 | Kasbon baru menunggu diperiksa; sudah diperiksa menunggu keputusan | Finance; Pemilik, GM | Pengajuan | Diputuskan | DRV-61 |
| B64 | Kasbon disetujui, belum diberikan | Finance, Pemilik, GM | Sesudah disetujui | Uang diserahkan | DRV-63, 64 |
| B65 | Minta kasbon dibatalkan; orang melapor uang kasbon belum diterima | Pemilik, GM | Permintaan | Diputuskan | DRV-72, K5 |
| B66 | Permintaan tunda cicilan menunggu | Pemilik, GM | Permintaan; menyebut jam tutup slip terdekat | Diputuskan atau gugur | DRV-68 |

**Keuangan (KEU) dan Kinerja (KIN)**

| No | Jenis urusan | Kepada | Muncul saat | Berhenti | Sumber |
|---|---|---|---|---|---|
| B67 | Saldo awal menunggu disahkan; penyesuaian saldo; catatan menunggu diperiksa; Piutang Lain baru menunggu disahkan; retur supplier menunggu disahkan | Pemilik, GM (bukan pengisi) | Per urusan | Disahkan | KEU-08, 14, T3, V3 |
| B68 | Uang belum berstruk; Catatan Cepat belum dilengkapi; Finance bertanya | Pembawa; Finance; pemilik uang | Per urusan | Struk/lengkap/dijawab | KEU-26, 31, 32 |
| B69 | Selisih hitungan atau Tidak cocok; keberatan kekurangan kas menunggu | Pemilik, GM | Per kejadian | Diputuskan | KEU-55, Q2, Q3 |
| B70 | Hitung Kas terlewat; Laporan Kasir belum dikirim; laporan dikembalikan | Pemegang; pelapor | Per kejadian | Dilakukan | KEU-36, 44, 52 |
| B71 | Laporan diisi finance atas nama cabang; angka kasir salah ditekan | Pemilik, GM (pemeriksa); Finance | Per laporan | Diperiksa | KEU-40, R2 |
| B72 | Supplier baru dari Kepala Gudang; nota berubah, hilang, atau mungkin kembar; pembayaran belum dipasangkan lewat 3 hari | Finance (3 hari: juga GM) | Per kejadian | Diperiksa/dipasangkan | KEU-57 s.d. 62 |
| B73 | Jenis tagihan atau tarif menunggu diperiksa; tagihan jatuh tempo menunggu nominal | Pemilik, GM (bukan pengisi); Finance | Per urusan | Disahkan/diisi | KEU-75, 119 |
| B74 | Aset perlu dilengkapi; Cek Aset dibuka; barang tidak ketemu atau rusak | Finance; Kepala cabang; Pemilik, GM | Per urusan | Dilengkapi/dicek/diputuskan | KEU-86 |
| B75 | Saldo mutasi rekening akhir bulan belum diisi | Finance; GM | Akhir bulan | Diisi | KEU Y2 |
| B76 | Laporan akhir tugas menunggu diperiksa; usulan tidak sah menunggu | Pemeriksa; HR, Pemilik, GM | Per laporan | Diperiksa/diputuskan | KIN-38, 40 |

Jumlah: **76 jenis urusan berantai** (dari kira-kira 160 baris bertanda
Antrean; selebihnya sekali baca, 2.4, atau sudah tergabung di baris di atas).

### 2.4 Tabel C. Antrean sekali baca (usulan Q2)

Kabar pribadi yang muncul **sekali** karena menyangkut uang, hak, atau jadwal
orang itu, tanpa batas waktu yang harus dikejar. Tidak mengulang, tidak masuk
Perlu perhatian.

| Kelompok | Contoh kabar (asli di bagian 7 spec modul) |
|---|---|
| Gaji dan potongan saya berubah | "Gaji saya berubah mulai tanggal …", "Potongan Anda ditiadakan", "Anda dibebani minus kas / Potongan Lain" (dengan tombol keberatan), bagian kehilangan barang, keputusan keberatan, bonus ditolak/dibatalkan, "Slip Anda sedang dibetulkan", pembayaran gaji dibatalkan, usulan ditolak |
| Jadwal saya berubah | Shift diubah langsung, libur diubah/dicabut, awak trip diganti, ditambahkan ke trip, kunjungan dilepas, tugas ditambah sesudah berangkat, persetujuan/pengesahan dicabut, diisikan atas nama, izin ditolak sesudah tanggalnya lewat |
| Hak saya | Hak tambahan berakhir besok, hak mengajukan sudah hangus, ada pengajuan kasbon atas nama Anda |
| Kegagalan penting | Cadangan atau uji pulih gagal (Pemilik, GM) |

### 2.5 Tabel D. Mesin penjaga yang harus memunculkan tanda (PRI-33)

Yang disebut di bagian 7 sembilan spec. Semuanya masuk Perlu perhatian GM
(dan Pemilik untuk BER dan KEH) pada hari kegagalan **atau tidak jalan pada
jadwalnya**, serta baris di Kesehatan Mesin. **Jadwal dan layar pengaturan
tiap mesin ditulis di Bab 3** (PRI-32), bukan di sini.

| No | Mesin | Modul | Tanda bila gagal atau tidak jalan |
|---|---|---|---|
| M1 | Mesin Pengajuan (pengingat, penghangus) | BER | Mesin gagal atau telat |
| M2 | Cadangan dan uji pulih | BER | Antrean sekali baca Pemilik, GM |
| M3 | Pencatat error | BER | Error tanpa sebab; sama oleh 3 orang sehari |
| M4 | Penarik data kasir per jenis data | TDK | Tarikan gagal; penarik tidak jalan |
| M5 | Penggilir shift Senin | KEH | Penggilir tidak jalan |
| M6 | Penanda alpha dan pencatat berturut-turut | KEH | Penanda tidak jalan |
| M7 | Penghangus klaim lembur | KEH | Penghangus tidak jalan |
| M8 | Pembuat periode gaji | GAJ | Pembuat periode gagal |
| M9 | Penulis denda dan penghitung koreksi | GAJ | Penulis atau penghitung gagal |
| M10 | Penilai ritase | DRV | Penilai gagal |
| M11 | Pembuat tagihan rutin | KEU | Pembuat gagal atau tidak jalan |
| M12 | Ringkasan saldo vs hitungan penuh; catatan modul tanpa pasangan | KEU | Perlu perhatian GM |
| M13 | Cek Modal, ringkasan pagi, tutup bulan, nilai stok bulanan | KEU | Bulan lalu belum ditutup (sejak tanggal 10); nilai stok belum masuk |
| M14 | Penghitung rapor | KIN | Rapor periode lalu belum ditetapkan |

Pekerjaan massal yang ditekan orang ("Tutup semua", "Bayar sekaligus" di GAJ)
bukan mesin terjadwal, tapi sebagian yang gagal tetap memberi tahu penekan
dan GM (antrean sekali baca). Spec LOG dan KIN tidak menyebut mesin pembuat
pengingat di bagian 7; Bab 3 memeriksa apakah ada mesin yang belum punya baris
di sini.

### 2.6 Temuan periksa silang bab 2

1. **Kata "Beranda" dipakai untuk dua hal** (kabar yang cukup diketahui, dan
   pekerjaan yang menunggu). TAM-25 membedakan Perlu perhatian dan Lonceng;
   spec modul kadang menulis keduanya "Beranda". Q1.
2. **Banyak butir bertanda Antrean tidak lolos TAM-24**: tidak ada batas yang
   membuat uang atau hak hilang, dan tidak ada orang yang menunggu. Contoh:
   "Gaji saya berubah", "Potongan Anda ditiadakan", "Shift diubah langsung",
   "Pembayaran gaji dibatalkan". Semuanya masuk akal untuk diketahui, tapi
   kalau semuanya jendela berantai, orang menekan OK tanpa membaca (alasan
   TAM-24). Q2.
3. **Penahan slip diumumkan di beberapa tempat** dengan kalimat berbeda: KEH
   (absen/penjelasan/klaim menunggu), GAJ (bonus menunggu, ditahan,
   "Slip terakhir tertahan", "Slip Anda tertahan"), dan DRV (ritase belum
   bertarif untuk slip mingguan). Satu slip dengan tiga penahan bisa
   menghasilkan tiga jendela. Pelanggaran WAJ-04. Q3.
4. **Satu kejadian ditulis di dua modul**: "Trip ditutup kantor, Laporan
   Pulang menunggu" ada di KEH dan LOG; "Pasangan aktif belum ada tarif" di
   DRV dan LOG; "Supplier baru ditambah" di DRV dan KEU. Kabarnya satu, milik
   modul yang punya datanya (KEH, LOG, KEU); spec DRV cukup menunjuk. Tidak
   ditanyakan (penyeragaman).
5. **Penerima bisa kosong**: spec menulis "Kepala Gudang", "Kepala Toko",
   "kepala cabang" tanpa menyebut cabang yang jabatannya kosong atau orangnya
   cuti/nonaktif. Butir bisa menggantung tanpa dibaca. Q4.
6. **Pengingat jam 12.00 hari berikutnya** (B47, B48, B54) butuh mesin
   pembuat, tetapi spec LOG tidak menyebutnya. Ditandai untuk Bab 3.
7. **Ringkasan pagi** (KEU-117) bisa dimatikan penerimanya, sedangkan semua
   kabar lain tidak punya tombol mematikan. Tidak diubah: ringkasan pagi
   bukan tugas, jadi bukan antrean.

### 2.7 Pertanyaan bab 2 (diketik di percakapan 14 Oktober 2026)

- **Q1.** Kata "Beranda" di spec dibaca sebagai **Lonceng** (kabar yang cukup
  diketahui, disimpan 90 hari); kartu "Kabar terbaru" di Beranda hanya
  menampilkan lonceng yang belum dibuka. (Saran: ya.)
- **Q2.** Antrean dibagi dua: *berantai* (Tabel B, 76 jenis) dan *sekali
  baca* (Tabel C). Sekali baca tidak masuk Perlu perhatian. Ini pelapis atas
  TAM-24. (Saran: ya.)
- **Q3.** Semua penahan slip digabung menjadi satu jenis urusan **"Slip
  tertahan"** (B41) yang menyebut daftar penahan dan penyelesainya; modul lain
  hanya menyediakan alasan penahan. (Saran: ya.)
- **Q4.** Butir yang penerimanya kosong, nonaktif, atau cuti lebih dari 2 hari
  **naik ke Pemilik dan GM** (mengikuti pola PRI-37). Butir tidak pernah
  menggantung tanpa penerima. (Saran: ya.)

---

## Bab 3. Pengaturan, jadwal mesin, dan aturan yang boleh dikecualikan (4J-3)

Status: **disetujui penuh 14 Oktober 2026 (Q1 s.d. Q4 "ok", PRI-44)** (bagian 3.7).

Spec modul tetap sumber nilai awal tiap pengaturan (bagian 8) dan jadwal tiap
mesin (bagian 6). **Bab ini tidak menyalin ulang ratusan baris itu** (WAJ-04);
isinya hanya yang tidak terlihat dari satu spec: hitungan, pengaturan yang
dibaca modul lain, peta jam mesin, mesin yang belum punya baris penjaga, daftar
yang boleh dikecualikan, dan temuan periksa silang.

### 3.1 Hitungan dan cara membaca bagian 8 tiap spec

Semua bagian 8 berkolom sama: pengaturan, angka awal, wajib diumumkan, boleh
dikecualikan per orang (PRI-26). Semuanya diubah lewat kerangka Pengaturan 4B
(BER-L40, L41), bertanggal berlaku bila menyangkut uang atau hitungan (WAJ-07),
dan hanya Pemilik atau GM yang memutuskan (HR atau Kepala Gudang mengusulkan
bila spec menyebut).

| Modul | Baris bagian 8 | Letak |
|---|---|---|
| KAR | 15 | `2026-10-13-karyawan-dan-akses-spec.md` |
| BER | 14 | `2026-10-13-perlengkapan-bersama-spec.md` |
| TDK | 6 | `2026-10-13-tarik-data-kasir-spec.md` |
| KEH | 55 | `2026-10-13-kehadiran-spec.md` |
| GAJ | 46 | `2026-10-13-gaji-bulanan-spec.md` |
| LOG | 53 | `2026-10-13-logistik-spec.md` |
| DRV | 38 | `2026-10-14-gaji-driver-spec.md` |
| KEU | 48 | `2026-10-14-keuangan-spec.md` |
| KIN | 19 | `2026-10-14-kinerja-spec.md` |
| **Jumlah** | **294 baris** | (satu baris kadang memuat beberapa angka atau jadwal mesin) |

Pengaturan yang **wajib diumumkan di Papan** (PRI-35) menumpuk di KEH, GAJ,
DRV, dan KIN, karena menyangkut batas waktu, denda, dan tarif yang dirasakan
karyawan. Pengaturan LOG, KEU, dan BER hampir semuanya urusan kantor, jadi
tidak diumumkan. Wajar; tidak diubah.

**Bukan pengaturan kerangka 4B tetapi tabel sendiri** (tetap mengikuti aturan
pengaturan: bertanggal berlaku, hanya Pemilik dan GM, berjejak, lewat Papan
bila wajib diumumkan; layar ubahnya di modul masing-masing memakai langkah baku
BER-L41):

| Tabel sendiri | Modul |
|---|---|
| Pengaturan Jabatan (tanda per jabatan, KAR-L31) | KAR |
| Tarif ritase dan upah belanja | DRV |
| Tarif Mobil–Rute | LOG |
| Tempat uang; daftar kejadian, kategori, jenis (KEU-L11) | KEU |
| Kotak Catatan Cepat; jenis Tagihan Rutin | KEU |
| Daftar ukuran, kelompok kriteria, aturan Bonus Terukur | KIN |
| Jenis bonus dan jenis potongan lain | GAJ |

### 3.2 Pengaturan yang dimiliki satu modul tetapi dibaca modul lain (WAJ-03, WAJ-04)

Modul pembaca hanya **membaca**, tidak menyimpan salinan.

| Pengaturan | Pemilik | Dibaca oleh |
|---|---|---|
| Titik dan radius lokasi cabang (100 meter) | KEH-12 | LOG (titik toko, titik Gudang) |
| Toleransi telat 5 menit | **KEH-22** | GAJ (hitungan telat), rekap KEH |
| Tanggal uang boleh mundur 7 hari | KEU-12 | GAJ (GAJ-99), DRV (bongkaran, kasbon, pelunasan), LOG (deposit, bensin) |
| Masa keberatan potongan 3 hari | GAJ (4E-3) | DRV (denda), KEU (kekurangan kas, KEU-55) |
| Jam buka cabang | KEH (shift paling pagi sampai terakhir) | TDK, KEU (batas laporan masuk, penanda belum lapor) |
| Denda lupa Masuk Kembali Rp5.000 | GAJ | KEH (hanya menyebut) |
| Akibat lewat batas istirahat (kosong) | GAJ (K5) | KEH |
| Cabang penanggung biaya bongkaran (Gudang) | DRV | KEU |

Dua baris perlu dirapikan di spec: temuan 3.6 butir 2 dan 3.

### 3.3 Peta jam mesin (urutan dan kepadatan)

Jadwal lengkap tiap mesin ada di bagian 6 spec modulnya. Peta ini hanya untuk
melihat **urutan yang harus dijaga** dan jam yang padat.

| Jam | Mesin (modul) |
|---|---|
| 00.01 | Pemberlaku pengaturan (BER); Pemberlaku penempatan dan nonaktif bertanggal depan (KAR) |
| 00.05 | Penggilir shift, Senin saja (KEH); Pembatal ajakan tukar (KEH); Penghangus (BER); Penanda rencana menggantung (LOG); Pemasang tanda ⚠ ongkir (LOG) |
| 00.10 | Pembuat periode gaji (GAJ); Pembentuk bonus promo, tanggal 26 (GAJ); Pencatat tidak memilih libur (KEH) yang memicu Penulis denda (GAJ) |
| 00.15 | Pembuat slip, tanggal mulai periode (GAJ); Penghangus libur pengganti (KEH); Pembuat slip mingguan, Jumat (DRV, mesin yang sama dengan GAJ) |
| 00.20 s.d. 00.30 | Penutup tahun cuti (KEH 00.20); Penutup keberatan potongan (GAJ 00.30) |
| 01.00 s.d. 01.30 | Pembuat ringkasan saldo, Penghitung perkiraan rapor (01.00); Pembanding utang, Penilai Bonus Terukur perkiraan (01.30) |
| 02.00 s.d. 03.30 | Pembersih, Penghapus foto absen, Pembuat tagihan rutin (02.00); Penghapus surat dokter dan Penulis bagian bulanan (02.30); Penarik nilai stok bulanan, tanggal 1 (03.00); Penghitung batas aman, tanggal 1 (03.30) |
| 04.00 s.d. 04.30 | **Rantai berurutan (KEH):** batas absen pulang 04.00, Penanda tidak absen pulang 04.05, Pembuat catatan hari kerja 04.10, Penanda alpha 04.20, Pencatat tidak masuk berturut-turut 04.25, Penghangus klaim lembur 04.30 |
| 05.00 | Pendeteksi pola lokasi (KEH) |
| 06.00 | Pemeriksa giliran (KEH); Pemeriksa gaji kosong dan Pemeriksa tanggungan (GAJ); sebagian besar Penanda LOG; Penyimpan perkiraan, Senin (KEU); Penjaga batas (KEU); Penanda rak tanpa penanggung jawab (KIN) |
| 06.30 | Ringkasan pagi, Penanda kenaikan pengeluaran (KEU) |
| 07.00 | Paling padat: sebagian besar pengingat KEU, DRV, GAJ, dan KIN |
| 08.00 s.d. 08.15 | Pengingat batas waktu (BER); Pengingat hak tambahan, Peninjau pengecualian (KAR 08.00); Pemeriksa training, Pemeriksa 7 hari tanpa kabar (KAR 08.15) |
| 12.00 | Penanda trip belum ditutup, Penanda permintaan bensin, Penanda uang tunai belum diserahkan (LOG) |
| 15.00 s.d. 16.00 | Pengingat tutup slip mingguan, Jumat (DRV 15.00); Penanda setoran (KEU 16.00) |
| 21.00 | Pengingat foto sesudah tertinggal (KIN) |
| 23.30 s.d. 23.59 | Pengirim pembayaran toko ke kasir (KEU 23.30); Penanda perjalanan belum kembali, Penggugur rangkaian, Pengakhir hak tambahan (23.59) |
| Berkala | Tiap 1 menit (Penarik kasir), 5 menit (Penyala pagar, Penerbit pengumuman, Pemberes, Pengejar kegagalan), 10 menit (pemeriksa susulan DRV, Pemeriksa pintu modul KEU), 15 menit (Penanda laporan muat, Penanda belum lapor, Pengingat tugas), tiap jam (Penarik 1 jam, Pencocok manual, Penanda pengajuan menunggu) |

Hanya satu rantai yang benar-benar bergantung urutan jam, **KEH 04.00 s.d.
04.30**, dan satu pasangan berjarak lima menit, **GAJ 00.10 lalu 00.15**.
Mesin lain berdiri sendiri. Lihat temuan 3.6 butir 4.

### 3.4 Tabel D bab 2 ditambah (mesin yang belum punya baris)

Tabel D (2.5) baru memuat 14 mesin, satu per modul. Bab 2 menjanjikan
pemeriksaan mesin LOG dan KIN; hasilnya, mesin berikut punya jadwal di bagian 6
tetapi tidak ada baris penjaganya. Ditambahkan (penyeragaman, tidak
ditanyakan):

| No | Mesin | Modul | Tanda bila gagal atau tidak jalan |
|---|---|---|---|
| M15 | Penanda LOG (trip, rencana, laporan muat, perjalanan, barang kembali, tertunda, retur, uang, Catat di Kasir, janji tagih, bensin, kirim di luar titik) dan **Penyala pagar** | LOG | Perlu perhatian GM; bila Penyala pagar tidak jalan: juga Pemilik |
| M16 | Pencocok nota, surat jalan, piutang, dan pembatalan kasir; Penulis bonus ongkir | LOG | Perlu perhatian GM (bergantung pada Penarik 4C) |
| M17 | Pemeriksa training, 7 hari tanpa kabar, hak tambahan, penempatan bertanggal depan; Peninjau pengecualian | KAR | Perlu perhatian GM dan HR |
| M18 | **Penghapus foto absen; Penghapus surat dokter** | KEH | Pemilik dan GM (janji hapus data pribadi, KEH-20, KEH-144) |
| M19 | Pembuat slip, Penutup keberatan potongan, Pengingat belum Dibayar, Pengingat bonus menunggu | GAJ | Perlu perhatian GM |
| M20 | Pemeriksa susulan 10 menit (ritase, upah bongkaran, pembayaran bongkaran, kasbon) | DRV | Perlu perhatian GM |
| M21 | Pengirim pembayaran toko ke kasir; Pembanding utang; Penulis bagian bulanan; Penanda saldo minus | KEU | Perlu perhatian GM; Pengirim juga Finance |
| M22 | Penghitung perkiraan rapor, Penilai Bonus Terukur, Penggugur rangkaian, Pengingat tugas, Penanda janggal | KIN | Perlu perhatian GM |

Mesin yang hanya pengingat harian (misalnya "Pengingat saldo awal belum
disahkan") tidak diberi baris: pengingat yang tidak muncul berarti tidak ada
kabar, bukan data salah. Kesehatan Mesin tetap menampilkan jam jalan terakhir
tiap mesin (PRI-33), jadi mesin yang diam tetap kelihatan.

### 3.5 Tabel G. Aturan yang boleh dikecualikan per orang (PRI-26)

Dari 294 baris, hanya ini yang bertanda "boleh dikecualikan". Semuanya lewat
**Daftar Pengecualian** (KAR-62): siapa, aturan mana, nilai pengganti, berlaku
dari-sampai, alasan, penyetuju (KAR-73); yang tanpa tanggal akhir ditinjau tiap
3 bulan, yang bertanggal akhir diingatkan H-7 (PRI-26 butir 1 dan 2).

| No | Aturan | Asal | Contoh nilai pengganti |
|---|---|---|---|
| G1 | Jam kerja per shift | KEH-09 | Seorang groomer masuk 08.00 pulang 18.00 |
| G2 | Ambang telat dan pulang cepat yang wajib dijelaskan (30 menit) | KEH-61, 151 | 60 menit untuk satu orang |
| G3 | Tanda jabatan **kena telat** | KAR-62, KEH-25 | Orang ini tidak kena telat walau jabatannya kena |
| G4 | Tanda jabatan **dapat lembur** | KAR-62, KEH-25 | Orang gudang yang boleh lembur |
| G5 | Tanda jabatan **dapat kompensasi libur** | KAR-62 | idem |
| G6 | Tanda jabatan **libur tetap** | KAR-62 | idem |
| G7 | Tanda jabatan **wajib absen istirahat** | KAR-62, KEH-84 | idem |

Yang **sengaja bukan** pengecualian (Q4):

- **Tanda GAJ-08 "ikut menanggung kehilangan barang" dan "jenis bonus yang
  diterima"**: ditandai "tidak" di KAR-L31. Orangnya cukup dipindah jabatan;
  bonus mengikuti jabatan.
- **Ringkasan pagi KEU-117 dimatikan per orang**: pilihan pribadi tentang
  kabar, bukan perlakuan aturan; tidak masuk Daftar Pengecualian.
- **Komponen gaji berbeda per orang** (GAJ-01 s.d. 09): isi paket gaji
  orangnya, bukan pengecualian aturan.
- **Hak tambahan dan gantikan sementara** (KAR-75, 76): jalur sendiri.

### 3.6 Temuan periksa silang bab 3

1. **Kerangka Pengaturan 4B belum menerima pengaturan bersasaran** dan
   "hanya berlaku mulai tanggal tertentu". BER-L41 punya satu nilai dan satu
   tanggal berlaku, padahal banyak pengaturan butuh sasaran (cabang, jabatan,
   atau jenis): jam kerja per cabang (KEH), persen kantor per cabang dan bobot
   per jabatan (GAJ), persen bonus grooming dan ongkir per jenis bonus (GAJ),
   nominal denda per jenis (DRV), metode non-tunai per cabang (KEU), jabatan
   penjaga cabang (KEH); dan angka gaji yang **hanya mulai berlaku tanggal
   26** (GAJ G6). Titipan 4E-3 ini dijawab di 4J-3 (Q1 "ok", PRI-44).
2. **Toleransi telat dipasang pemilik ganda.** KEH bagian 8 menulis "milik
   Gaji, dibaca di sini"; GAJ bagian 8 menulis "milik Kehadiran, di sini hanya
   dibaca". Buku aturan (KEH-22, GAJ-10, `03-gaji.md` baris Toleransi telat)
   menyebut **Kehadiran**. Teks bagian 8 KEH diperbaiki (WAJ-10). Tidak
   ditanyakan.
3. **Masa keberatan kekurangan kas (KEU-55) ditulis sebagai angka sendiri**
   ("3 hari, sama dengan GAJ-81"), padahal pemiliknya masa keberatan potongan
   GAJ. Dua angka yang "sama" hari ini bisa berbeda besok (WAJ-04). Bagian 8
   KEU diubah menjadi "dibaca dari pengaturan GAJ"; nilainya tidak berubah.
   Tidak ditanyakan.
4. **Mesin yang bergantung hasil mesin lain hanya dijamin jam jalannya.**
   Pada rantai KEH 04.00–04.30 dan pasangan GAJ 00.10/00.15, bila satu mesin
   telat, mesin berikutnya membaca data setengah jadi (contoh: Penanda alpha
   jalan sebelum Pembuat catatan hari kerja selesai, sehingga hari yang
   catatannya belum ada dibaca seolah tidak masuk). Belum ada aturan
   umumnya. **Q3.**
5. **Panjang alasan paling sedikit** ditulis sebagai angka sendiri di banyak
   baris (GAJ, DRV, KEU, KEH: 15 huruf di hampir semuanya, 20 huruf untuk
   keberatan slip dan serah terima). Banyak baris dengan angka sama yang bisa
   menyimpang suatu hari. **Q2.**
6. **Waktu penarikan bulanan**: TDK menulis Penarik bulanan "akhir bulan dan
   setelah stok opname"; KEU menulis Penarik nilai stok "tiap tanggal 1,
   03.00 (dan saat tarikan kasir masuk)". Mungkin hal yang sama; bila beda,
   nilai stok bulan berjalan bisa tak sinkron dengan Cek Modal. Dibawa ke
   **4J-4**. Tidak ditanyakan.
7. **Batas "uang belum saya terima" 7 hari (slip) dan 3 hari (bongkaran,
   kasbon)** terlihat tidak seragam tetapi **sudah diputuskan sengaja berbeda
   di PRI-42**. Tidak ditanyakan.
8. **Radius titik lokasi boleh "tidak perlu diumumkan"** (KEH) mengikuti
   PRI-35 butir 2 (pengumuman bisa dilewati dengan alasan), bukan
   pengecualian baru. Dibiarkan. Tidak ditanyakan.

### 3.7 Pertanyaan bab 3 (diketik di percakapan 14 Oktober 2026)

- **Q1.** Kerangka Pengaturan 4B ditambah dua hal: (a) **sasaran** (cabang,
  jabatan, atau jenis) sehingga satu pengaturan punya banyak nilai, tiap
  sasaran dengan tanggal berlaku dan riwayat sendiri; (b) **"hanya berlaku
  mulai tanggal tertentu"** (misalnya tanggal 26) bagi pengaturan yang
  memerlukannya. (Saran: ya.)
- **Q2.** **Satu pengaturan "Panjang alasan paling sedikit"** bernilai 15 huruf
  dipakai semua layar yang meminta alasan. Yang memang lebih panjang
  (keberatan slip 20, serah terima 20) tetap pengaturan sendiri dan disebut
  sebagai pengecualiannya. (Saran: ya.)
- **Q3.** **Mesin berurutan:** mesin yang bergantung hasil mesin lain membaca
  catatan jalan pendahulunya dulu. Bila pendahulu belum selesai hari itu,
  mesin menunggu dan memunculkan tanda di Perlu perhatian GM, **bukan jalan
  dengan data kurang**. Berlaku untuk rantai KEH 04.00–04.30 dan GAJ
  00.10/00.15. (Saran: ya.)
- **Q4.** Daftar boleh dikecualikan (Tabel G) **hanya tujuh baris** G1–G7. Tanda
  GAJ-08 (kehilangan barang, jenis bonus) dan ringkasan pagi tidak boleh
  dikecualikan per orang. (Saran: ya.)

---

## Bab 4. Periksa silang titipan antar spec (4J-4)

Status: **disetujui penuh 14 Oktober 2026** (Q1 dan Q2 "ok", sesuai saran; TDK dan KEU diubah mengikuti). Cara kerja:
tiap titipan yang tertulis di WIP dan bagian "Titipan" spec dicari sisi
penerimanya di spec modul tujuan. Yang ada ditandai Cocok; yang tidak ada
ditambahkan atau ditanyakan.

### 4.1 Titipan yang sudah cocok (diperiksa, tidak diubah)

| Titipan | Dari → ke | Dasar |
|---|---|---|
| Klaim lembur dan penjelasan menunggu menahan slip | 4D → 4E | GAJ penahan slip (bagian "Penahan slip") dan tes 89 |
| Pintu tulis bonus ongkir | 4F → 4E-4 | LOG baris 102 dan GAJ pintu tulis bonus |
| Tab Promo dan hasil Bonus Terukur ke Buku Bonus | 4I → 4E-4 | GAJ jenis bonus Promo dan Bonus Terukur, KIN pintu tulis |
| Fungsi baca selisih kasir per orang, tanda masuk slip, tanda balik | 4E → 4H-5 | KEU "tandai selisih masuk slip" |
| Layar memasangkan Catatan Cepat ke slip; cicilan Piutang Lain tanpa uang; Piutang Lain dari slip terakhir | 4E-5 → 4H | KEU bagian Catatan Cepat dan Piutang Lain |
| Fungsi tutup, bayar, urutan potongan, tandai/balik cicilan kasbon dipakai slip mingguan | 4E → 4G | DRV baris "mesin slip umum" dan "tandai cicilan" |
| Gaji Driver membaca status hari | 4D → 4G | DRV: orang per ritase tanpa hitungan kehadiran; hari ada trip sama dengan ada ritase. **Tidak perlu fungsi baca tambahan.** |
| Usulan pindah cabang | 4D-2a → bab 1 | Tabel A dan B baris 6 |
| Pengaturan bersasaran dan berlaku tanggal tertentu | 4E-3 → 4B | Bab 3 Q1 (disetujui) |

### 4.2 Titipan yang tidak punya sisi penerima, sudah ditambahkan (WAJ-10)

Perbaikan teks murni dari keputusan yang sudah disetujui; tidak ditanyakan.

1. **KAR-L22 tidak punya isian shift dan kelompok** padahal KEH-103 dan tes
   KEH menyebut "ditolak oleh KAR-L22". Langkah 2 KAR-L22 ditambah: untuk
   cabang bershift ganda, shift dan kelompok wajib.
2. **KAR-L31 tidak punya tanda "boleh menyuruh lembur"** (KEH-163). Baris
   ditambah, isi awal HR, Pemilik, GM. Label "ikut menanggung kehilangan
   barang" kini menyebut juga minus kas tanpa nama.
3. **Tabel `cabang` di spec Karyawan tidak punya kolom "digabung ke"**
   (KEU-114, titipan 4H-11). Kolom ditambah, milik Karyawan.
4. **Fungsi uraian slip Gaji (GAJ-105) tidak merinci kelompoknya**, padahal
   Keuangan AA1 membedakan potongan tidak hadir/telat, denda ke dana,
   pelunasan, dan ganti rugi. Spec Gaji ditambah empat kelompok uraian.

### 4.3 Yang masih perlu jawaban

5. **Waktu penarikan bulanan nilai stok (temuan 3.6 butir 6).** TDK menulis
   Penarik bulanan "akhir bulan dan setelah stok opname"; KEU menulis Penarik
   nilai stok "tiap tanggal 1, 03.00 (dan saat tarikan kasir masuk)". Ini
   dua mesin dengan tugas bertumpuk (WAJ-03: satu data, satu pemilik). Nilai
   stok baru benar setelah opname di kasir, dan opname sebulan sekali.
   **Q1.**
6. **Penjualan antar cabang (Gudang ke toko sendiri) belum jelas dikenali.**
   KEU-73 memisahkannya dari omzet luar, tetapi tarikan kasir (TDK) hanya
   punya transaksi per pelanggan. Tanpa penanda, KEU tidak bisa tahu mana
   yang antar cabang. **Q2.**

### 4.4 Titipan yang tetap menunggu tahap lain (dicatat, bukan temuan)

| Titipan | Menunggu |
|---|---|
| File contoh asli per jenis data dari pemilik; pintu baca di project kasir | Tahap 5 |
| Pengumuman 7 hari sebelum sambungan kasir dinyalakan | Tahap 5 (jadwal rilis) |
| D7 (terjawab 14 Oktober 2026, CHANGELOG 213) | Selesai |
| Tarikan pembayaran supplier dari kasir | Sudah bagian `kasir_utang_supplier` (KEU baris "tarikan pembayaran"); tinggal diuji dengan file contoh di Tahap 5 |
| Bentuk baru yang belum ada di komponen baku: tabel minggu dan strip tujuh hari, tabel rekap banyak kolom, kalender periode 26–25 (juga "tidak masuk"), peta titik lokasi, pemasang titik, bilah tempat uji, kartu trip berjalan, kotak angka ringkasan, pratinjau impor, kartu kriteria, grafik batang, petak cabang, kelompok lipat, centang banyak | Dikumpulkan di 4J-5 sebagai satu daftar tambahan ke `desain/README.md` |

### 4.5 Pertanyaan bab 4 (diketik di percakapan 14 Oktober 2026)

- **Q1.** Satu mesin saja yang menarik nilai stok: mesin TDK menarik tanggal 1
  pukul 02.00 dan ulang otomatis begitu opname terakhir di kasir berubah;
  mesin KEU hanya **menyimpan hasil tarikan** per akhir bulan dan menandai
  "belum lengkap" bila opname bulan itu belum masuk. (Saran: ya.)
- **Q2.** Penjualan antar cabang dikenali dari **daftar pelanggan kasir yang
  ditandai "toko sendiri"** (per cabang, diisi Finance di Pengaturan TDK);
  transaksi ke pelanggan itu otomatis dipisah dari omzet luar. (Saran: ya.)
