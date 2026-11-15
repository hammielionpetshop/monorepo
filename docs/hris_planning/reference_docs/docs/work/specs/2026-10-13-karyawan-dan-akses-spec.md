# Spec Siap Bangun: Karyawan dan Akses (Tahap 4A)

Tanggal: 13 Oktober 2026
Status: **disetujui penuh 13 Oktober 2026** (A1 s.d. A10 sesuai saran,
bagian 13). Layar tidak digambar satu per satu (keputusan pemilik 13 Oktober
2026, CHANGELOG 153): dibangun dari komponen baku, pegangannya
`../desain/README.md`. Sepuluh layar (KAR-L01 s.d. L05, L10 s.d. L14) punya
contoh penerapan di `../desain/4A-karyawan-1-masuk-dan-profil.html`.

Bahan: `../../aturan/01-karyawan.md` (KAR), `2026-10-13-hak-akses-desain.md`
(3B), `2026-10-13-menu-desain.md` (3C), `2026-10-13-pengajuan-dan-laporan-desain.md`
(3E), `../../aturan/00-peta-modul.md`, SIS-24, 26, 41; KEH-10, 84, 85, 96;
DRV-04, 45; GAJ-04, 08, 46; KEU-40; PRI-02, 10, 14, 23, 24, 26, 31, 32, 33, 35,
37, 38; TAM-01 s.d. 24.

Spec ini sekaligus **contoh bentuk spec** yang ditiru modul lain (bagian 0).

---

## 0. Bentuk baku spec Tahap 4

Setiap spec modul memakai urutan bagian yang sama, supaya sesi pembangunan di
Tahap 6 selalu tahu harus mencari apa di mana.

| No | Bagian | Isinya | Dipakai saat membangun untuk |
|---|---|---|---|
| 1 | Batas | Apa yang dikerjakan spec ini dan apa yang sengaja tidak | Mencegah fitur diselipkan |
| 2 | Daftar layar | Kode layar, nama, letak di menu, siapa memakai, ukuran utama (HP, PC, atau keduanya) | Peta halaman dan menu |
| 3 | Rincian layar | Per layar: tujuan, isi, langkah, tombol, jalan keluar, beda jabatan, pesan, aturan. Disusun dari komponen baku (`../desain/README.md`); bentuk yang belum ada komponennya disebut | Membuat halaman |
| 4 | Data | Tabel, isi penting, cara mencari, siapa membaca | Migrasi database |
| 5 | Tindakan bernama | Daftar pintu server beserta isi awal hak per jabatan dan lingkupnya | Daftar hak dan mesin pengaman |
| 6 | Mesin otomatis | Yang jalan sendiri: jadwal, apa yang dikerjakan, penjaganya (PRI-33) | Jadwal server |
| 7 | Pemberitahuan | Mana yang masuk antrean berantai, mana yang cukup di Beranda (TAM-24) | Titipan 4J |
| 8 | Pengaturan | Angka dan daftar yang dibaca mesin, angka awal, wajib diumumkan, boleh dikecualikan | Menu Pengaturan, titipan 4J |
| 9 | Jenis pengajuan | Jenis milik modul ini di Mesin Pengajuan: penyetuju, batas waktu, akibat terlewat | Titipan 4J |
| 10 | Kejadian di lapangan | Kejadian dan jawaban sistem; setiap baris menjadi tes (PRI-06) | Tes dan uji pemilik |
| 11 | Jalan keluar | Per tindakan: kembali, ulangi, batalkan; oleh siapa, sampai kapan, akibatnya | Tombol dan aturan batal |
| 12 | Daftar tes | Tes mesin: uang (dengan contoh angka), waktu, hak akses (WAJ-06) | Tes otomatis |
| 13 | Pertanyaan dan jawaban | Diajukan di percakapan, jawabannya dicatat di sini | Riwayat keputusan |
| 14 | Daftar periksa | Daftar periksa peta jalan Tahap 4 | Syarat disetujui |

Kode layar memakai huruf modul dan nomor, misalnya **KAR-L01**, supaya contoh,
spec, dan kode bisa dirujuk dengan satu nama. Nomor aturan (KAR-01) dan kode
layar (KAR-L01) dibedakan dengan huruf L.

---

## 1. Batas

**Dikerjakan:** cabang, departemen, jabatan, status kerja; data orang dan
riwayat penempatan serta riwayat status; pekerja lepas; izin tugas lapangan;
pendaftaran dan persetujuannya; masuk, keluar, lupa password, kode dari GM;
profil dan akun sendiri; pengajuan ubah data diri (isi khasnya); antrean
promosi training; Pengaturan Jabatan; Daftar Pengecualian; Hak Akses Jabatan;
hak tambahan; jabatan tambahan; riwayat masuk; Lihat sebagai di sistem asli;
pedoman lapor (isi dan tampilannya).

**Tidak dikerjakan di spec ini:**

| Hal | Di mana |
|---|---|
| Cara kerja Mesin Pengajuan, kotak Persetujuan, layar Pengajuan Saya | 4B Perlengkapan Bersama (spec ini hanya mengisi jenis "Ubah data diri") |
| Papan Perubahan Aturan, pengingat berantai, riwayat error, tempat uji, akun contoh, mesin pengaman | 4B |
| Jam kerja cabang, radius absen, QR | 4D Kehadiran (spec ini hanya menyimpan titik lokasi cabang, KAR-25) |
| Gaji, Gaji Standar, angka uang per jabatan | 4E Gaji (spec ini hanya memberi tahu Gaji bahwa promosi disetujui) |
| Menambah pekerja lepas dari Laporan Bongkaran | 4G (memakai tindakan "tambah pekerja lepas" milik spec ini) |
| Isi otomatis dari data pelamar | Ditangguhkan bersama Rekrutmen |
| Akun Google, email perusahaan, undangan lewat link | Tidak ada di v3 (KAR-53, 60, 69) |

---

## 2. Daftar layar

Ukuran utama: **HP** = terutama dipakai di handphone, **PC** = terutama di PC,
**HP+PC** = dipakai di keduanya. Semua layar tetap harus rapi di dua ukuran
(TAM-12); kolom ini menyebut ukuran yang dirancang lebih dulu.

| Kode | Layar | Letak di menu | Dipakai | Ukuran utama |
|---|---|---|---|---|
| KAR-L01 | Masuk | (tanpa masuk) | Semua | HP+PC |
| KAR-L02 | Daftar (4 langkah) | (tanpa masuk) | Calon karyawan | HP |
| KAR-L03 | Menunggu persetujuan | (setelah daftar) | Pendaftar | HP |
| KAR-L04 | Lupa password (2 langkah) | (tanpa masuk) | Semua | HP |
| KAR-L05 | Pakai kode dari GM | (tanpa masuk) | Yang sudah salah 3 kali | HP |
| KAR-L10 | Profil & Akun | Saya | Semua | HP |
| KAR-L11 | Ubah kontak dan foto | Saya › Profil & Akun | Semua | HP |
| KAR-L12 | Ubah data identitas | Saya › Profil & Akun, dan Pengajuan Saya | Semua | HP |
| KAR-L13 | Ganti password | Saya › Profil & Akun | Semua | HP |
| KAR-L14 | Perangkat dan riwayat masuk saya | Saya › Profil & Akun | Semua | HP |
| KAR-L20 | Daftar Karyawan | Kantor › Karyawan | HR, Admin HR, Pemilik, GM; Kepala Gudang (terbatas) | PC |
| KAR-L21 | Halaman orang | dari KAR-L20 | sama | PC |
| KAR-L22 | Catat perubahan penempatan (4 langkah) | dari KAR-L21 | HR, Admin HR, Pemilik, GM | PC |
| KAR-L23 | Nonaktifkan / aktifkan lagi (3 langkah) | dari KAR-L21 | HR, Admin HR, Pemilik, GM | PC |
| KAR-L24 | Izin tugas lapangan | dari KAR-L21 | HR, Admin HR, Kepala Gudang, Pemilik, GM | PC |
| KAR-L25 | Pendaftaran Baru | Kantor › Karyawan | HR, Admin HR, Pemilik, GM | PC |
| KAR-L26 | Periksa pendaftar (3 langkah) | dari KAR-L25 | sama | PC |
| KAR-L27 | Promosi Training | Kantor › Karyawan | HR, Admin HR, Pemilik, GM | PC |
| KAR-L28 | Pekerja Lepas | Kantor › Karyawan | HR, Admin HR, Kepala Gudang, Pemilik, GM | PC |
| KAR-L29 | Hak Tambahan yang Aktif | Kantor › Karyawan | Pemilik, GM; Finance (hanya hak lapor sementara) | PC |
| KAR-L30 | Cabang & Jabatan | Pengaturan › Karyawan | HR, Admin HR, Pemilik, GM (KAR-82) | PC |
| KAR-L31 | Pengaturan Jabatan | Pengaturan › Karyawan | HR, Admin HR mengisi; Pemilik, GM | PC |
| KAR-L32 | Daftar Pengecualian | Pengaturan › Karyawan | sama | PC |
| KAR-L33 | Hak Akses Jabatan | Pengaturan › Karyawan | Pemilik, GM | PC |
| KAR-L34 | Pedoman Lapor (baca) | Panduan | Semua | HP |
| KAR-L35 | Pedoman Lapor (ubah) | Pengaturan › Karyawan | Pemilik, GM | PC |
| KAR-L40 | Riwayat Masuk Semua Orang | Sistem | Pemilik, GM | PC |
| KAR-L41 | Lihat sebagai | Sistem | Pemilik, GM | PC (bilahnya HP+PC) |

Jumlah: 28 layar. Tidak digambar satu per satu; contoh penerapan komponen
untuk KAR-L01 s.d. L05 dan L10 s.d. L14 ada di
`../desain/4A-karyawan-1-masuk-dan-profil.html`.

---

## 3. Rincian layar

Aturan untuk semua layar di bawah, tidak diulang per layar: error di jendela
"OK, paham" (TAM-01 s.d. 06); tombol menyimpan terkunci sampai selesai
(TAM-13); isian tidak hilang kalau sinyal putus (TAM-16); pesan berhasil
menyebut apa yang tersimpan dan siapa bertindak berikutnya (TAM-17); daftar
dibagi per halaman dan bisa dicari (PRI-10); semua jam dari server (PRI-01).

### KAR-L01. Masuk

- **Isi:** email, password (bisa ditampilkan dengan ikon mata), kotak centang
  "Jangan ingat saya (PC bersama)", tombol **Masuk**, tautan "Lupa password"
  dan "Belum punya akun? Daftar".
- **Aturan:** KAR-69. Salah 5 kali berturut-turut: tombol Masuk mati dengan
  hitungan mundur 5 menit; jendela error: "Password salah 5 kali. Coba lagi
  dalam 5 menit. Kalau lupa, tekan Lupa password." Orangnya diberi tahu di
  pemberitahuan dan email.
- **Akun nonaktif:** "Akun ini tidak aktif sejak 12 Oktober 2026. Hubungi HR."
- **Pendaftaran belum disetujui:** langsung ke KAR-L03.
- **Jalan keluar:** tidak ada yang tersimpan; bebas ditinggal.

### KAR-L02. Daftar (4 langkah, TAM-07)

| Langkah | Isi | Wajib |
|---|---|---|
| 1 dari 4. Akun | Email, password, ulangi password | Semua |
| 2 dari 4. Data diri | Nama lengkap, nomor HP, tanggal lahir, jenis kelamin, tanggal mulai bekerja di Hammielion | Semua (KAR-69, SIS-24) |
| 3 dari 4. Data lain | Foto diri (kamera atau galeri), kontak darurat (nama, hubungan, HP), alamat, rekening (bank, nomor, nama pemilik); tempat lahir, agama, status nikah, jumlah tanggungan, pendidikan | Foto dan kontak darurat wajib; sisanya boleh kosong (KAR-80, 81) |
| 4 dari 4. Periksa | Ringkasan semua isian; tombol **Kirim** | — |

- Cabang, jabatan, dan status kerja **tidak** diisi pendaftar; ditetapkan HR
  (KAR-60). Langkah 2 memberi catatan: "Tanggal mulai bekerja akan dicocokkan
  HR."
- Email atau nomor HP yang sudah dipakai orang lain ditolak di langkah 1 atau
  2, dengan pesan yang menyebut kolomnya.
- **Jalan keluar:** Kembali di tiap langkah tanpa kehilangan isian; **Ulangi
  dari awal**; setelah Kirim, tidak bisa diubah sendiri (HR yang membetulkan
  saat menyetujui, atau pendaftar memakai ubah data setelah disetujui).
- **Berhasil:** "Pendaftaran terkirim. Menunggu persetujuan HR."

### KAR-L03. Menunggu persetujuan

- Tampil setiap kali pendaftar masuk sebelum disetujui. Tidak ada menu lain
  (KAR-60).
- Isi: tanggal kirim, status (Menunggu / Ditolak), dan kalau ditolak, alasannya.
- Ditolak: tombol **Daftar ulang** membuka KAR-L02 dengan isian lama terisi
  (meniru "Ajukan ulang", PRI-37).
- Jalan keluar: tombol **Keluar**.

### KAR-L04. Lupa password (2 langkah)

1. **Langkah 1 dari 2. Cocokkan data:** email, nomor HP, tanggal lahir; tombol
   **Periksa**. Yang tidak cocok disebut kolomnya (KAR-70 butir 2). Salah 3
   kali: jeda 5 menit dengan hitungan mundur, pesan "Hubungi GM untuk meminta
   kode", tombol **Saya punya kode dari GM** (ke KAR-L05). GM diberi tahu.
2. **Langkah 2 dari 2. Password baru:** password baru dua kali, peringatan
   "Catat password ini di tempat aman". Tombol **Simpan dan masuk**.
- Setelah berhasil: semua perangkat lain keluar; pemberitahuan ke email orangnya
  dan ke GM (KAR-70 butir 6).
- Jalan keluar: Kembali ke Masuk kapan saja.

### KAR-L05. Pakai kode dari GM

- Isi: email, kode (6 angka), password baru dua kali. Kode berlaku 1 jam, sekali
  pakai. Kode salah atau kedaluwarsa: pesan menyebut yang mana.
- Kode dibuat GM di KAR-L21 (tombol "Buat kode lupa password"), setelah GM
  memastikan orangnya benar lewat telepon atau bertemu.

### KAR-L10. Profil & Akun

Satu layar berisi **daftar kartu**; tiap kartu membuka layarnya sendiri (TAM-07).

| Kartu | Isi yang terlihat | Membuka |
|---|---|---|
| Foto dan nama | Foto, nama, kode karyawan | — |
| Penempatan | Cabang, jabatan, jabatan tambahan (kalau ada), status kerja, tanggal bergabung; tautan "Riwayat" | Daftar riwayat penempatan, hanya baca |
| Kontak dan foto | Nomor HP, alamat, kontak darurat, data diri lain (KAR-81) | KAR-L11 |
| Data identitas | Nama, tanggal lahir, jenis kelamin, rekening (nomor disamarkan kecuali 4 angka terakhir) | KAR-L12 |
| Password | — | KAR-L13 |
| Perangkat dan riwayat masuk | Jumlah perangkat yang sedang masuk | KAR-L14 |
| Tampilan | Mode terang / gelap (TAM-11) | — |

- Kalau ada pengajuan ubah data identitas yang menunggu, kartunya bertanda
  "Menunggu HR".

### KAR-L11. Ubah kontak dan foto

- Nomor HP, alamat, kontak darurat, foto (kamera atau galeri, TAM-08), dan
  data diri lain (tempat lahir, agama, status nikah, jumlah tanggungan,
  pendidikan). Langsung berlaku (KAR-12, 81). Foto dan kontak darurat tidak
  boleh dikosongkan (KAR-80).
- Ganti nomor HP: diberitahukan ke email orangnya (KAR-70), karena nomor HP
  kunci lupa password. Nomor HP yang sudah dipakai orang lain ditolak.
- Jalan keluar: **Kembali** tanpa menyimpan; setelah tersimpan, diubah lagi
  sendiri.

### KAR-L12. Ubah data identitas

- Nama, rekening, tanggal lahir, jenis kelamin (KAR-66). Isian menampilkan
  nilai lama di samping nilai baru. Mengganti rekening **wajib**
  melampirkan foto buku tabungan atau kartu ATM (kamera atau galeri), supaya HR
  bisa memastikan nama pemilik rekening (KAR-80). Kolom lain tanpa lampiran.
- Disimpan sebagai pengajuan jenis **Ubah data diri** di Mesin Pengajuan
  (bagian 9). Data lama tetap berlaku sampai disetujui.
- Pintu yang sama dibuka dari Pengajuan Saya › Ajukan › Ubah Data Diri.
- **Berhasil:** "Perubahan data terkirim. Data lama tetap dipakai sampai HR
  menyetujui."
- Jalan keluar: sebelum diputuskan, pengaju boleh **Batalkan** (status
  Dibatalkan); sesudah disetujui, mengajukan perubahan baru.

### KAR-L13. Ganti password

- Password sekarang, password baru dua kali. Setelah berhasil: perangkat lain
  keluar (KAR-69), perangkat ini tetap masuk.

### KAR-L14. Perangkat dan riwayat masuk saya

- Daftar perangkat yang sedang masuk (jenis perangkat, browser, terakhir dipakai),
  dengan tanda "perangkat ini".
- Tombol **Keluarkan dari semua perangkat lain** (konfirmasi biasa, tidak
  menyangkut uang).
- Riwayat masuk 90 hari terakhir: kapan, perangkat apa, berhasil atau salah
  password. Lebih lama dimuat saat diminta (PRI-11).

### KAR-L20. Daftar Karyawan

- **Pencarian:** nama, kode, nomor HP.
- **Saring:** cabang, jabatan, status kerja, aktif / nonaktif / semua. Bawaan:
  aktif.
- **Kolom:** foto kecil, kode, nama, cabang, jabatan (+ jabatan tambahan),
  status kerja, tanda.
- **Tanda** di baris: "Training: waktunya dinilai", "7 hari tanpa kabar"
  (KAR-08), "Ubah data menunggu", "Belum ada rekening" (KAR-80).
- Tombol **Tambah karyawan** tidak ada: orang masuk lewat pendaftaran (KAR-60).
  Pekerja lepas punya layarnya sendiri (KAR-L28).
- **Beda jabatan:** Kepala Gudang melihat versi terbatas: hanya nama, cabang,
  jabatan, dan kolom izin tugas lapangan, dan hanya bisa membuka KAR-L24
  (KAR-84). Admin HR sama dengan HR; gaji memang tidak ada di layar ini.

### KAR-L21. Halaman orang

Kepala: foto, nama, kode, cabang, jabatan, status kerja, aktif atau tidak.
Di bawahnya kartu-kartu, masing-masing membuka layarnya sendiri:

| Kartu | Tindakan |
|---|---|
| Data diri dan identitas | **Ubah data** (oleh HR langsung berlaku, tercatat sebelum dan sesudah) |
| Penempatan | Riwayat penempatan; **Catat perubahan** (KAR-L22) |
| Status | Riwayat status; **Nonaktifkan** atau **Aktifkan lagi** (KAR-L23) |
| Izin tugas lapangan | Boleh menyetir, boleh ikut sebagai kenek; **Ubah** (KAR-L24) |
| Akun | Email, terakhir masuk, jumlah perangkat; **Keluarkan dari semua perangkat**; **Buat kode lupa password** (hanya penerima laporan "hubungi", isi awal GM; KAR-70); riwayat masuk orang ini (Pemilik dan GM, KAR-69) |
| Pengecualian | Pengecualian yang berlaku untuk orang ini (dari KAR-L32), hanya baca |
| Hak tambahan | Yang aktif untuk orang ini, hanya baca |

- **Batas keras (KAR-72):** di halaman dirinya sendiri, tombol Catat perubahan,
  Nonaktifkan, dan izin tidak tampil; server tetap menolak kalau dipaksa.
- **Lihat sebagai** orang ini: tombol di kepala, hanya Pemilik dan GM (KAR-78).

### KAR-L22. Catat perubahan penempatan (4 langkah)

1. **Pilih jenis:** pindah cabang, ganti jabatan, ganti status kerja, beri atau
   cabut jabatan tambahan. Satu catatan satu jenis.
2. **Isi:** cabang / jabatan / status kerja baru (hanya yang aktif, KAR-24).
   Jabatan bertanda "berhak tinggi" hanya muncul untuk Pemilik dan GM (KAR-74).
   Jabatan tambahan: paling banyak satu; pasangan Finance dan Marketing ditolak
   (KAR-76). **Untuk cabang bershift ganda** (pindah cabang atau penempatan
   baru): shift dan kelompok giliran wajib dipilih di langkah ini; tanpa itu
   ditolak (KEH-103; ditambah 4J-4).
3. **Tanggal berlaku dan alasan:** tanggal berlaku wajib, boleh tanggal lalu
   (membetulkan salah isi, KAR-56) atau tanggal depan. Alasan wajib.
4. **Periksa:** "Rina pindah dari Toko Pusat ke Toko Cikarang mulai 1 November
   2026. Hak aksesnya atas data Toko Pusat berhenti di tanggal itu." Tombol
   **Simpan** ditahan 3 detik (TAM-15), karena ganti jabatan dan status kerja
   mengubah perlakuan gaji.
- **Ganti status kerja Training → Karyawan** lewat layar ini tidak bisa; jalannya
  hanya Promosi Training (KAR-L27), supaya Gaji Standar ikut berubah (KAR-22).
  Pesan: "Training menjadi Karyawan diputuskan lewat Promosi Training."
- Jalan keluar: Kembali dan Ulangi dari awal sebelum Simpan. Setelah tersimpan,
  tidak dihapus; salah isi dibetulkan dengan catatan baru (KAR-56). Catatan
  bertanggal depan yang belum berlaku boleh **Dibatalkan** dengan alasan.

### KAR-L23. Nonaktifkan / aktifkan lagi (3 langkah)

**Nonaktifkan:**

1. **Tanggal dan alasan:** tanggal terakhir bekerja, alasan (pilihan: berhenti,
   diberhentikan, lainnya) dan keterangan.
2. **Cara berhenti** (hanya kalau alasannya berhenti, KAR-68): "dengan
   pemberitahuan sebulan" atau "tanpa pemberitahuan sebulan". Pilihan kedua
   hanya untuk Pemilik dan GM; HR dan Admin HR memakai **usulkan tanpa
   pemberitahuan**, yang masuk kotak Persetujuan Pemilik dan GM. Selama belum
   diputuskan, slip terakhir orang itu tidak bisa ditutup (KAR-68).
3. **Periksa:** akibatnya disebut: "Akun Budi keluar dari semua perangkat saat
   ini juga. Slip terakhirnya dihitung sampai 15 November 2026." Kalau tanpa
   pemberitahuan: "Sisa gaji menjadi denda (GAJ-58)." Tombol ditahan 3 detik.

**Aktifkan lagi:** tanggal mulai dan alasan; riwayat lama tetap (KAR-07).
Penempatan memakai yang terakhir; kalau perlu diubah, dicatat lewat KAR-L22.

- Orang yang dinonaktifkan hari ini langsung keluar dari semua perangkat
  (KAR-69); yang bertanggal depan keluar pada tanggal itu pukul 23.59.

### KAR-L24. Izin tugas lapangan

- Dua sakelar: **Boleh menyetir**, **Boleh ikut sebagai kenek**, masing-masing
  dengan pemberi dan tanggal (KAR-64). Orang berjabatan driver tidak perlu
  izin (KAR-05); sakelarnya tampil "Otomatis (jabatan Driver)".
- Mencabut wajib alasan; tercatat.

### KAR-L25. Pendaftaran Baru

- Daftar pendaftar yang menunggu, terlama di atas, dengan lama menunggu.
- Tab **Ditolak** untuk yang pernah ditolak (hanya baca).

### KAR-L26. Periksa pendaftar (3 langkah)

1. **Data pendaftar:** semua isian, hanya baca. Tombol **Tolak** (wajib alasan)
   tersedia di langkah ini.
2. **Tetapkan:** cabang, jabatan (berhak tinggi hanya Pemilik dan GM, KAR-74),
   status kerja, dan **tanggal bergabung yang dicocokkan** dengan lembar acuan
   sistem lama (SIS-24). Kalau berbeda dari ketikan pendaftar, wajib keterangan.
3. **Periksa dan Setujui:** ringkasan; tombol ditahan 3 detik (penempatan
   menentukan gaji).
- Setelah disetujui: akun terbuka sesuai jabatannya, data orang lahir dengan
  kode karyawan dari server (KAR-02), dan Gaji diberi tahu (gaji diisi di 4E).
- Pendaftar yang ternyata sudah punya data (orang yang sama mendaftar dua kali)
  ditolak dengan alasan "sudah terdaftar".

### KAR-L27. Promosi Training

- Daftar orang Training yang sudah genap 3 bulan sejak tanggal bergabung
  (KAR-20), dan yang tanggal
  "nilai lagi pada"-nya sudah tiba.
- Per orang: tanggal bergabung, lama bekerja, rapor (tautan ke Kinerja kalau
  ada). Tombol **Setujui** atau **Tunda**.
- **Setujui:** konfirmasi 3 detik: "Status Rina menjadi Karyawan dan gajinya
  menjadi Gaji Standar mulai 26 November 2026." (KAR-22, GAJ-04)
- **Tunda:** alasan dan tanggal "nilai lagi pada" wajib (KAR-21).
- Keputusan tidak bisa diubah (KAR-23).

### KAR-L28. Pekerja Lepas

- Daftar orang berstatus Freelance: nama, nomor HP, terakhir ikut bongkaran.
- **Tambah** (nama, HP; HP kembar ditolak, DRV-45), **Ubah**, **Nonaktifkan**.
- Pekerja lepas tidak punya akun (DRV-45).

### KAR-L29. Hak Tambahan yang Aktif

- Daftar hak tambahan yang berlaku: jenis, penerima, pemberi, mulai, berakhir,
  sisa hari, sudah diperpanjang atau belum.
- **Beri hak tambahan** (3 langkah): jenis (hak lapor sementara Laporan Kasir,
  gantikan sementara) → penerima dan isinya (cabang untuk hak lapor; jabatan
  yang digantikan untuk gantikan sementara) → tanggal akhir (paling lama 7 / 14
  hari) dan alasan.
- **Perpanjang** (sekali, wajib alasan), **Cabut** (wajib alasan).
- **Beda jabatan:** Finance hanya melihat dan memberi hak lapor sementara
  (KEU-40). Gantikan sementara ke jabatan berhak tinggi hanya Pemilik dan GM
  (KAR-74).
- Tab **Riwayat** untuk yang sudah berakhir.

### KAR-L30. Cabang & Jabatan

Tiga daftar, masing-masing layarnya sendiri: **Cabang**, **Departemen**,
**Jabatan**.

- **Cabang:** nama, alamat, titik lokasi (dipilih di peta atau dari lokasi HP
  saat berdiri di cabang), aktif.
- **Departemen:** nama, aktif.
- **Jabatan:** nama, departemen, tanda **berhak tinggi** (hanya Pemilik dan GM
  yang mengubah tanda ini), aktif.
- Menonaktifkan yang masih dipakai ditolak, dan pesannya menyebut siapa yang
  masih memakainya (KAR-27).
- Siapa boleh mengubah (KAR-82): HR, Admin HR, Pemilik, GM. Perubahan titik
  lokasi cabang diberitahukan ke GM, karena memengaruhi absen. Jabatan baru lahir
  tanpa hak apa pun dan tanpa tanda Pengaturan Jabatan yang berlaku; orang
  belum bisa ditempatkan di sana sampai keduanya diatur.

### KAR-L31. Pengaturan Jabatan

- Tabel: baris = jabatan, kolom = tanda. Satu layar untuk semua tanda (keputusan
  3A).

| Tanda | Isi | Aturan |
|---|---|---|
| Diabsen | ya / tidak | KAR-59, 67, 83 |
| Cara absen | QR / lewat trip | KEH-10, 96 (dibaca dari slip utama; ditampilkan saja) |
| Kena telat | ya / tidak | KAR-62 |
| Dapat lembur | ya / tidak | KAR-62 |
| Dapat kompensasi libur | ya / tidak | KAR-62, PRI-18 |
| Libur tetap | ya / tidak | KAR-62 |
| Wajib absen istirahat | ya / tidak | KEH-84 |
| Penjaga cabang saat istirahat | ya / tidak | KEH-85 |
| Slip utama | bulanan / mingguan | DRV-04 |
| Ikut menanggung kehilangan barang (juga minus kas tanpa nama, GAJ-75 s.d. 82) | ya / tidak | GAJ-08 |
| Boleh menyuruh lembur (isi awal: HR, Pemilik, GM) | ya / tidak | KEH-163 |
| Gaji hanya terlihat Pemilik dan GM | ya / tidak | KAR-59, 72, 83 |
| Terhitung jumlah karyawan | ya / tidak | KAR-59, 83 |
| Tombol utama di handphone | pilih layar | 3C M3 |

- **Mengubah:** pilih tanda → nilai baru → tanggal berlaku → alasan → periksa
  (menyebut berapa orang terkena: "8 orang berjabatan Kasir tidak lagi dapat
  lembur mulai 26 November 2026"). Oleh HR atau Admin HR menjadi **usulan** yang
  menunggu Pemilik atau GM; oleh Pemilik atau GM langsung berlaku dan pemilik
  lain diberi tahu (KAR-73). Usulan masuk kotak **Persetujuan** yang sama
  dengan pengajuan lain dan ikut pengingat 2 hari (PRI-37); tidak ada layar
  persetujuan tersendiri.
- Tanda yang menyangkut karyawan otomatis membuat konsep pengumuman di Papan
  Perubahan Aturan (PRI-35); lihat bagian 8.
- Riwayat per tanda: nilai lama, nilai baru, tanggal berlaku, siapa.

### KAR-L32. Daftar Pengecualian

- Daftar yang berlaku: orang, aturan, nilai biasa (dari jabatan), nilai
  pengganti, mulai, sampai (atau "tanpa tanggal akhir"), alasan, penyetuju,
  tinjauan berikutnya.
- **Tambah** (4 langkah): orang → aturan (hanya yang bertanda "boleh
  dikecualikan", PRI-38) → nilai pengganti dan tanggal → alasan dan periksa.
  Persetujuan sama dengan KAR-L31.
- **Hentikan** (wajib alasan; berakhir hari itu). Tinjauan 3 bulanan dan H-7
  datang lewat pengingat (PRI-38) dengan tombol **Masih perlu** / **Hentikan**.
- Tab **Riwayat** untuk yang sudah berakhir.

### KAR-L33. Hak Akses Jabatan

- **Langkah 1:** pilih jabatan. Jabatan GM tampil "mengikuti Pemilik" dan tidak
  bisa diubah sendiri (KAR-71).
- **Langkah 2:** daftar tindakan dikelompokkan per modul; tiap tindakan punya
  pilihan lingkup: **tidak ada · diri sendiri · cabangnya · departemennya ·
  semua**. Yang berubah disorot.
- **Langkah 3:** periksa: daftar perubahan sebelum → sesudah dan jumlah orang di
  jabatan itu. Tombol **Simpan** ditahan 3 detik.
- Perubahan yang menabrak batas keras ditolak dengan jendela error yang menyebut
  batasnya (KAR-72). Tercatat siapa, kapan, sebelum, sesudah; pemilik lain
  diberi tahu (KAR-73).
- Tambahan: tombol **Bandingkan dengan jabatan lain** (hanya baca) untuk
  memeriksa dua jabatan berdampingan.

### KAR-L34 dan L35. Pedoman Lapor

- **L34 (baca, semua orang):** daftar jenis kasus, masing-masing satu kalimat
  "lapor ke siapa lebih dulu" (KAR-57, 79). Baris yang sama tampil di layar
  Pengajuan Saya untuk jenis yang cocok.
- **L35 (ubah, Pemilik dan GM):** tambah, ubah, urutkan, nonaktifkan baris.
  Perubahan tercatat. Isinya disusun pemilik (buku Karyawan bagian 6 butir 3);
  sebelum diisi, L34 menampilkan "Pedoman belum diisi".

### KAR-L40. Riwayat Masuk Semua Orang

- Daftar masuk dan gagal masuk semua orang: kapan, siapa, perangkat, berhasil /
  salah password / jeda / lupa password / kode GM. Saring per orang, per jenis,
  per tanggal. Bawaan 7 hari terakhir.

### KAR-L41. Lihat sebagai

- Pilih orang (cari nama) → aplikasi tampil persis seperti yang dilihat orang
  itu, termasuk menunya.
- **Bilah berwarna mencolok** di atas layar selama dipakai: "Sedang melihat
  sebagai: Rina (Kasir, Toko Pusat) · Hanya melihat · [Keluar]".
- Semua tombol simpan, kirim, dan setuju mati; kalau tetap ditekan: jendela
  "Mode Lihat sebagai hanya untuk melihat."
- Setiap pemakaian tercatat: siapa, melihat siapa, kapan mulai dan selesai
  (KAR-78). Data gaji tetap mengikuti hak orang yang dilihat, bukan pemakainya.

---

## 4. Data

Semua tabel punya kolom **perusahaan** (PRI-31), jejak dibuat dan diubah (siapa,
kapan), dan tidak ada yang dihapus (PRI-02). Kolom pencarian diberi indeks
(PRI-14).

| Tabel | Isi penting | Dicari dengan | Dibaca modul lain |
|---|---|---|---|
| perusahaan | nama, logo, pengaturan umum | — | semua |
| cabang | nama, alamat, titik lokasi, aktif; "digabung ke" (cabang lain, hanya untuk laporan keuangan; isi awal Back Office → Gudang, KEU-114) | nama, aktif | semua |
| departemen | nama, aktif | — | semua |
| jabatan | nama, departemen, berhak tinggi, aktif | departemen | semua |
| status_kerja | nama (Training, Karyawan, Freelance), aktif | — | semua |
| orang | kode, nama, HP, tanggal lahir, jenis kelamin, alamat, kontak darurat, rekening, foto, tanggal bergabung, aktif; tempat lahir, agama, status nikah, jumlah tanggungan, pendidikan (boleh kosong) | kode, nama, HP | nama dan jabatan saja (KAR-44); rekening oleh Gaji dan Keuangan |
| riwayat_penempatan | orang, jenis (utama / tambahan), cabang, jabatan, status kerja, berlaku dari, berlaku sampai, alasan, dibatalkan | orang + tanggal; cabang + tanggal | semua (cabang dan jabatan pada sebuah tanggal) |
| riwayat_status | orang, aktif / nonaktif, tanggal, alasan, cara berhenti, usulan cara berhenti | orang | Gaji (GAJ-58) |
| izin_tugas_lapangan | orang, jenis (menyetir / kenek), diberi oleh, kapan, dicabut | orang | Logistik |
| akun | orang, email, password (tersandi), status (menunggu / aktif / ditolak / nonaktif) | email | — |
| pendaftaran | isian pendaftar, status, alasan tolak, diputuskan oleh | status | — |
| sesi_perangkat | akun, perangkat, ingat saya, terakhir dipakai, dikeluarkan | akun | — |
| riwayat_masuk | akun / email, kapan, perangkat, hasil | kapan, akun | — |
| jeda_masuk | email, jenis (masuk / lupa password), hitungan salah, jeda sampai | email | — |
| kode_lupa_password | akun, kode (tersandi), dibuat oleh, berlaku sampai, dipakai | akun | — |
| pengaturan_jabatan | jabatan, tanda, nilai, berlaku dari, alasan, status (usulan / berlaku / ditolak), penyetuju | jabatan + tanda + tanggal | Kehadiran, Gaji, Gaji Driver, menu |
| pengecualian | orang, aturan, nilai pengganti, dari, sampai, alasan, penyetuju, tinjauan berikutnya, dihentikan | orang; tinjauan berikutnya | semua (PRI-26) |
| daftar_aturan_bisa_dikecualikan | kode aturan, nama, modul, jenis nilai | — | — |
| hak_jabatan | jabatan, tindakan, lingkup | jabatan | mesin hak akses, menu |
| riwayat_hak_jabatan | siapa, kapan, jabatan, tindakan, sebelum, sesudah | jabatan | — |
| hak_tambahan | jenis, penerima, isi (cabang / jabatan digantikan), pemberi, mulai, berakhir, diperpanjang, dicabut | penerima; berakhir | mesin hak akses |
| antrean_promosi | orang, masuk antrean, keputusan (setujui / tunda), nilai lagi pada, alasan, oleh | keputusan kosong | Gaji (setujui) |
| pengajuan_ubah_data | (isi khas Mesin Pengajuan) kolom, nilai lama, nilai baru, lampiran | — | — |
| pedoman_lapor | jenis kasus, lapor ke, urutan, aktif | — | Pengajuan Saya |
| riwayat_lihat_sebagai | pemakai, orang yang dilihat, mulai, selesai | pemakai | — |

**Daftar tindakan** (bagian 5) ditulis di kode (KAR-71), bukan tabel.

---

## 5. Tindakan bernama dan isi awal hak

Lingkup: **D** = diri sendiri, **C** = cabangnya, **S** = semua. Pemilik dan GM
punya semua tindakan dengan lingkup S (KAR-67). Yang tidak disebut = tidak ada.

| Tindakan | HR | Admin HR | Finance | Kepala Gudang | Semua karyawan |
|---|---|---|---|---|---|
| lihat profil | S | S | — | — (lihat daftar terbatas) | D |
| ubah kontak sendiri | — | — | — | — | D |
| ajukan ubah data diri | — | — | — | — | D |
| putuskan ubah data diri | S | S | — | — | — |
| ganti password, keluarkan perangkat sendiri | — | — | — | — | D |
| lihat daftar karyawan | S | S | — | S (terbatas: nama, cabang, jabatan, izin) | — |
| ubah data orang | S | S | — | — | — |
| catat perubahan penempatan | S | S | — | — | — |
| nonaktifkan / aktifkan orang | S | S | — | — | — |
| tetapkan berhenti tanpa pemberitahuan | — | — | — | — | — |
| usulkan berhenti tanpa pemberitahuan | S | S | — | — | — |
| ubah izin tugas lapangan | S | S | — | S | — |
| putuskan pendaftaran | S | S | — | — | — |
| putuskan promosi training | S | S | — | — | — |
| kelola pekerja lepas | S | S | — | S | — |
| beri hak lapor sementara | — | — | S | — | — |
| beri gantikan sementara | — | — | — | — | — |
| lihat hak tambahan aktif | — | — | S (hak lapor saja) | — | D |
| keluarkan orang dari semua perangkat | S | S | — | — | — |
| buat kode lupa password | — | — | — | — | — |
| usulkan Pengaturan Jabatan / pengecualian | S | S | — | — | — |
| setujui Pengaturan Jabatan / pengecualian | — | — | — | — | — |
| ubah Hak Akses Jabatan | — | — | — | — | — |
| ubah cabang, departemen, jabatan (tanpa tanda berhak tinggi) | S | S | — | — | — |
| ubah pedoman lapor | — | — | — | — | — |
| baca pedoman lapor | — | — | — | — | S |
| lihat riwayat masuk sendiri | — | — | — | — | D |
| lihat riwayat masuk semua orang | — | — | — | — | — |
| lihat sebagai | — | — | — | — | — |

Yang kosong di semua kolom hanya dimiliki Pemilik dan GM. "Buat kode lupa
password" dibaca dari pengaturan penerima laporan "hubungi" (isi awal jabatan
GM), bukan dari baris hak.

---

## 6. Mesin otomatis

Semua punya penjaga (PRI-33): tiap jalan tercatat; gagal atau tidak jalan
muncul di "perlu perhatian" GM hari itu.

| Mesin | Jadwal | Kerjanya | Aturan |
|---|---|---|---|
| Pemeriksa training | Tiap hari 08.15 | Orang Training yang sudah genap 3 bulan sejak tanggal bergabung, atau yang tanggal nilai-lagi-nya tiba, masuk antrean promosi | KAR-20, 21 |
| Pemeriksa 7 hari tanpa kabar | Tiap hari 08.15 | Membaca hari kerja (Kehadiran); orang dengan 7 hari berturut-turut sakit tanpa surat, izin tanpa kejelasan, atau alpha belum diklarifikasi diberi tanda | KAR-08 |
| Pengakhir hak tambahan | Tiap hari 23.59 | Mengakhiri yang tanggal akhirnya hari ini | KAR-75 |
| Pengingat hak tambahan | Tiap hari 08.00 | H-1 ke pemberi dan penerima | KAR-75 |
| Peninjau pengecualian | Tiap hari 08.00 | Tinjauan 3 bulanan dan H-7 | PRI-38 |
| Pemberlaku penempatan dan nonaktif bertanggal depan | Tiap hari 00.01 | Hak dan status berubah di tanggal berlakunya; yang nonaktif keluar dari semua perangkat | KAR-56, 69 |
| Pembersih sesi | Tiap hari | Sesi yang 30 hari tidak dipakai berakhir | KAR-69 |

---

## 7. Pemberitahuan (titipan 4J)

Dipilah dengan pegangan TAM-24.

| Pemberitahuan | Kepada | Antrean berantai atau Beranda | Alasan |
|---|---|---|---|
| Pendaftar menunggu lebih dari 1 hari | HR, Admin HR | Antrean | Orang lain menunggu (TAM-24 butir 2) |
| Ubah data diri menunggu lebih dari 1 hari | penyetuju | Antrean (lewat Mesin Pengajuan) | Sama |
| Training waktunya dinilai | HR, Pemilik, GM | Antrean | Gaji orang itu menunggu keputusan |
| 7 hari tanpa kabar | HR, Pemilik, GM | Antrean | Keputusan nonaktif; slip bisa salah |
| Usulan Pengaturan Jabatan / pengecualian menunggu | Pemilik, GM | Antrean (lewat Mesin Pengajuan) | Orang lain menunggu |
| Hak tambahan berakhir besok | pemberi, penerima | Antrean | Hak hilang |
| Tinjauan pengecualian | Pemilik, GM (dan pengisi untuk H-7) | Antrean | PRI-38 |
| Orang dijeda lupa password, minta kode | GM | Antrean | Orang lain menunggu |
| Salah password 5 kali | orangnya | Pemberitahuan + email | Keamanan, bukan tugas |
| Password diganti lewat lupa password atau kode | orangnya, GM | Pemberitahuan + email | KAR-70 |
| Nomor HP diganti | orangnya | Email | KAR-70 |
| Hak Akses Jabatan diubah | pemilik lain | Beranda | KAR-73 |
| Pengaturan Jabatan diubah langsung oleh Pemilik / GM | pemilik lain | Beranda | KAR-73 |
| Pendaftaran disetujui / ditolak | pendaftar | Layar KAR-L03 dan email | — |

---

## 8. Pengaturan (titipan 4J)

| Pengaturan | Angka awal | Wajib diumumkan di Papan | Boleh dikecualikan per orang |
|---|---|---|---|
| Panjang password paling sedikit | 8 | tidak | tidak |
| Salah password sebelum jeda | 5 kali | tidak | tidak |
| Salah lupa password sebelum jeda | 3 kali | tidak | tidak |
| Lama jeda | 5 menit | tidak | tidak |
| Masa berlaku kode dari GM | 1 jam | tidak | tidak |
| Tetap masuk tanpa dipakai | 30 hari | tidak | tidak |
| Penerima laporan "hubungi" lupa password | jabatan GM | tidak | tidak |
| Masa training sebelum dinilai | 3 bulan sejak tanggal bergabung | ya | tidak |
| Hari berturut-turut tanpa kabar | 7 | ya | tidak |
| Batas hak lapor sementara / gantikan sementara | 7 / 14 hari | tidak | tidak |
| Tinjauan pengecualian tanpa tanggal akhir / pengingat sebelum berakhir | 3 bulan / 7 hari | tidak | tidak |
| Tanda-tanda Pengaturan Jabatan (KAR-L31) | lihat buku aturan masing-masing | ya, kecuali tombol utama handphone | kena telat, dapat lembur, kompensasi libur, libur tetap, wajib absen istirahat: ya; lainnya tidak |
| Jabatan berhak tinggi | Pemilik, GM, HR, Finance | tidak | tidak |
| Daftar status kerja | Training, Karyawan, Freelance | tidak | tidak |
| Pedoman lapor | belum diisi | ya | tidak |

Isi awal cabang, departemen, dan jabatan diketik tangan saat tayang (SIS-26).

---

## 9. Jenis pengajuan milik modul ini (titipan 4J)

| Jenis | Penyetuju | Ikut melihat | Batas waktu mengajukan | Akibat terlewat | Lampiran | Tertutup |
|---|---|---|---|---|---|---|
| Ubah data diri | HR, Admin HR, Pemilik, GM | — | tidak ada | tidak ada (tidak hangus) | wajib untuk ganti rekening (KAR-80) | ya (data pribadi) |
| Usulan Pengaturan Jabatan dan pengecualian | Pemilik, GM | pengusul | tidak ada | tidak ada | tidak | tidak |
| Usulan berhenti tanpa pemberitahuan | Pemilik, GM | pengusul | tidak ada | slip terakhir tertahan sampai diputuskan | tidak | ya |

Pendaftaran dan promosi training **bukan** pengajuan: pendaftar belum menjadi
orang di sistem, dan promosi datang dari mesin, bukan dari permintaan.

---

## 10. Kejadian di lapangan

Setiap baris menjadi tes (PRI-06). Gabungan bagian 5 buku Karyawan dan bagian 4
spec 3B, ditambah kejadian khusus layar.

| No | Kejadian | Sistem berbuat apa | Aturan |
|---|---|---|---|
| 1 | Orang mendaftar dua kali dengan email berbeda | HR melihat nama dan HP sama; yang kedua ditolak "sudah terdaftar". HP kembar ditolak sejak langkah 2 | KAR-31, L02 |
| 2 | Pendaftar salah ketik tanggal mulai bekerja | HR mencocokkan dengan lembar acuan dan membetulkannya saat menyetujui, dengan keterangan | SIS-24 |
| 3 | Orang asing mendaftar | Tidak melihat apa pun; HR menolak | KAR-60 |
| 4 | Pendaftar ditolak karena data kurang | Melihat alasannya, menekan Daftar ulang dengan isian lama terisi | L03 |
| 5 | HR salah menetapkan cabang saat menyetujui | Dibetulkan lewat catatan penempatan bertanggal sama | KAR-56 |
| 6 | Admin HR mencoba menjadikan seseorang Finance | Jabatan itu tidak muncul; dipaksa lewat server ditolak | KAR-74 |
| 7 | Karyawan pindah cabang mulai bulan depan | Catatan bertanggal depan; hak atas cabang lama tetap sampai tanggal itu | KAR-56, 71 |
| 8 | Pindah cabang dicatat dengan tanggal salah | Dibuat catatan baru yang membetulkan; kalau belum berlaku, dibatalkan dengan alasan | KAR-56 |
| 9 | HR mencoba mengubah status Training menjadi Karyawan lewat Catat perubahan | Ditolak; diarahkan ke Promosi Training | KAR-22 |
| 10 | Promosi ditunda | Masuk antrean lagi pada tanggal nilai lagi | KAR-21 |
| 11 | Promosi terlanjur disetujui | Tidak bisa diubah; status dan gaji dibetulkan lewat catatan baru | KAR-23 |
| 12 | Orang salah dinonaktifkan | Diaktifkan lagi; dua kejadian tercatat | KAR-07 |
| 13 | Orang dinonaktifkan saat sedang memakai HP | Langsung keluar; percobaan berikutnya ditolak dengan pesan akun tidak aktif | KAR-69 |
| 14 | Orang berhenti tanpa pamit | HR mengusulkan "tanpa pemberitahuan"; pemilik menetapkan | KAR-68 |
| 15 | Orang 7 hari tidak masuk tanpa kabar | Tanda dan pengingat ke HR dan pemilik; tidak ada yang nonaktif otomatis | KAR-08 |
| 16 | Cabang tutup | Dinonaktifkan; kalau masih ada orang di sana, pesan menyebut namanya | KAR-27 |
| 17 | Karyawan mengganti nomor HP ke nomor orang lain | Ditolak: nomor sudah dipakai | L11 |
| 18 | Karyawan mengganti rekening ke rekening salah | HR menolak pengajuannya; kalau terlanjur disetujui, diajukan perubahan baru | KAR-66 |
| 19 | Karyawan lupa password | Isi email, HP, tanggal lahir; cocok → password baru → masuk | KAR-70 |
| 20 | Lupa password, salah 3 kali | Jeda 5 menit, diminta hubungi GM; GM diberi tahu; GM membuat kode 1 jam | KAR-70 |
| 21 | Kode dari GM sudah lewat 1 jam | Ditolak dengan pesan kedaluwarsa; minta kode baru | KAR-70 |
| 22 | Orang lain mencoba menebak tanggal lahir | Tiap 3 kali salah: jeda 5 menit dan GM diberi tahu | KAR-70 |
| 23 | Salah password 5 kali | Jeda 5 menit; orangnya diberi tahu | KAR-69 |
| 24 | HP hilang | Dari perangkat lain atau oleh HR: Keluarkan dari semua perangkat; lalu ganti password | KAR-69 |
| 25 | Kasir masuk di PC toko lalu lupa keluar | Kalau "Jangan ingat saya" dicentang, keluar saat browser ditutup | KAR-69 |
| 26 | Mendadak butuh kenek yang belum punya izin | Kepala Gudang memberi izin dulu di KAR-L24, lalu orangnya bisa dipilih | KAR-65 |
| 27 | Izin menyetir salah diberikan | Dicabut dengan alasan; tercatat | KAR-64 |
| 28 | Finance tidak masuk 3 hari | GM memberi Marketing gantikan sementara Finance, berakhir sendiri | KAR-75, 76 |
| 29 | Marketing yang menggantikan Finance mencoba memeriksa uang yang ia tagih | Ditolak (batas keras: memeriksa isiannya sendiri) | KAR-72, 76 |
| 30 | Hak tambahan lupa dicabut | Berakhir sendiri 23.59; pengingat H-1 | KAR-75 |
| 31 | Pemilik salah mencabut hak sebuah jabatan | Diubah lagi; perubahan dan pembetulannya tercatat | KAR-73 |
| 32 | Pemilik mencoba memberi hak yang menabrak batas keras | Ditolak dengan jendela yang menyebut batasnya | KAR-72 |
| 33 | HR mencoba mengubah jabatannya sendiri | Tombol tidak tampil; dipaksa ditolak server | KAR-72 |
| 34 | HR mengusulkan Kasir tidak dapat lembur, pemilik belum memutuskan | Nilai lama tetap berlaku; usulan menunggu di Persetujuan dan antrean | KAR-73 |
| 35 | Pengecualian tanpa tanggal akhir terlupa | Tinjauan tiap 3 bulan | PRI-38 |
| 36 | Karyawan mengeluh menunya tidak muncul | Pemilik atau GM memakai Lihat sebagai orang itu | KAR-78 |
| 37 | GM memakai Lihat sebagai lalu menekan Setujui | Ditolak; jendela "hanya untuk melihat" | KAR-78 |
| 38 | Orang yang sama keluar lalu masuk kerja lagi | Diaktifkan lagi, akun lama dipakai lagi; riwayatnya utuh | KAR-07, 55 |

---

## 11. Jalan keluar

| Tindakan | Kembali / ulangi | Batalkan | Oleh siapa, sampai kapan | Akibat ke data lain |
|---|---|---|---|---|
| Daftar | Kembali, Ulangi dari awal sebelum Kirim | Tidak; HR membetulkan saat menyetujui | — | — |
| Menyetujui pendaftaran | — | Tidak dibatalkan; penempatan dibetulkan lewat catatan, orang salah dinonaktifkan | HR, Pemilik, GM | Gaji membaca penempatan pada tanggalnya |
| Menolak pendaftaran | — | Pendaftar Daftar ulang | Pendaftar | — |
| Ubah kontak | Diubah lagi sendiri | — | Orangnya, kapan saja | — |
| Ubah data identitas | — | Dibatalkan pengaju selama Menunggu | Pengaju | Data lama tetap |
| Catat penempatan | Kembali sebelum Simpan | Bertanggal depan dan belum berlaku: dibatalkan dengan alasan; sudah berlaku: catatan baru | HR, Admin HR, Pemilik, GM | Hak berubah di tanggal berlaku; Gaji membaca perlakuan jabatan baru |
| Nonaktifkan | Kembali sebelum Simpan | Aktifkan lagi; dua kejadian tercatat | HR, Admin HR, Pemilik, GM | Akun keluar; slip terakhir oleh Gaji |
| Cara berhenti tanpa pemberitahuan | — | Hanya Pemilik atau GM mengganti, sebelum slip terakhir ditutup | Pemilik, GM | Denda GAJ-58 |
| Izin tugas lapangan | — | Dicabut dengan alasan | HR, Admin HR, Kepala Gudang | Trip yang sudah lewat tidak berubah |
| Promosi training | — | Tidak bisa diubah (KAR-23); tunda dinilai lagi | — | Gaji Standar mulai periode berikutnya |
| Hak tambahan | — | Dicabut kapan saja; berakhir sendiri | Pemberi, Pemilik, GM | Hak hilang saat itu |
| Pengaturan Jabatan, pengecualian | — | Usulan ditarik pengusul selama menunggu; yang berlaku diubah dengan nilai baru bertanggal | Pengusul; Pemilik, GM | Tidak mengubah hitungan yang sudah lewat (WAJ-07) |
| Hak Akses Jabatan | Kembali sebelum Simpan | Diubah lagi | Pemilik, GM | Menu dan hak berubah saat itu |
| Lihat sebagai | Keluar kapan saja | — | — | Tidak ada yang tersimpan selain catatan pemakaian |

---

## 12. Daftar tes

Modul ini **tidak menghitung uang**. Yang diuji: waktu yang memengaruhi uang dan
hak akses (WAJ-06). Semua kejadian di bagian 10 juga menjadi tes.

**Waktu yang memengaruhi uang**

| No | Tes | Contoh |
|---|---|---|
| W1 | Masa training 3 bulan | Bergabung 10 Januari → masuk antrean 10 April 08.15 (9 April belum); disetujui 15 April → Gaji Standar mulai 26 April. Bergabung 31 Januari → masuk antrean 30 April (bulan tanpa tanggal 31 memakai tanggal terakhirnya) |
| W2 | Promosi disetujui di tengah periode | Disetujui 10 November 2026 → Gaji Standar mulai 26 November 2026; slip periode 26 Oktober s.d. 25 November tetap gaji training |
| W3 | Penempatan bertanggal depan | Pindah ke Toko Cikarang mulai 1 November: 31 Oktober 23.59 masih Toko Pusat; 1 November 00.01 sudah Toko Cikarang |
| W4 | Penempatan dibetulkan mundur | Pindah dicatat 1 November padahal sebenarnya 25 Oktober: catatan baru bertanggal 25 Oktober; hari kerja 25–31 Oktober dibaca Toko Cikarang (selama slip belum ditutup) |
| W5 | Hak tambahan berakhir | Berakhir 20 Oktober: 20 Oktober 23.58 masih bisa; 23.59 jam server sudah tidak |
| W6 | Pengaturan Jabatan bertanggal | Kasir tidak dapat lembur mulai 26 November: lembur 25 November tetap dihitung |

**Hak akses** (dijalankan mesin pengaman, KAR-63; tambahan atas percobaan tetap)

| No | Percobaan | Hasil yang benar |
|---|---|---|
| H1 | Tiap jabatan mengubah penempatan, status, dan hak dirinya sendiri | Ditolak |
| H2 | HR dan Admin HR menempatkan orang di jabatan berhak tinggi | Ditolak |
| H3 | Admin HR, HR, Finance memberi gantikan sementara | Ditolak |
| H4 | Finance memberi hak lapor sementara | Boleh; gantikan sementara ditolak |
| H5 | Kepala Gudang membaca rekening, alamat, tanggal lahir dari daftar karyawan | Ditolak; hanya nama, cabang, jabatan, izin |
| H6 | Karyawan membaca profil orang lain | Ditolak |
| H7 | HR mengubah Hak Akses Jabatan | Ditolak |
| H8 | HR menyetujui usulan Pengaturan Jabatan miliknya sendiri | Ditolak |
| H9 | HR menetapkan berhenti tanpa pemberitahuan | Ditolak; hanya usulkan |
| H10 | Kepala toko pindah cabang membaca data cabang lama sesudah tanggal pindah | Ditolak |
| H11 | Lihat sebagai menekan simpan | Ditolak |
| H12 | Akun pendaftar yang belum disetujui memanggil tindakan apa pun | Ditolak |
| H13 | Akun nonaktif memakai sesi lama | Ditolak |
| H14 | Hak tambahan sesudah berakhir | Ditolak |
| H15 | Orang selain penerima laporan "hubungi" membuat kode lupa password | Ditolak |
| H16 | Mengubah jabatan GM di Hak Akses Jabatan secara terpisah dari Pemilik | Ditolak |

---

## 13. Pertanyaan dan jawaban

Diajukan di percakapan 13 Oktober 2026 (KER-13, 14). Jawaban dicatat di sini.

- **A1.** Cara menghitung "melewati 3 periode" untuk training.
- **A2.** Siapa boleh mengubah Cabang & Jabatan.
- **A3.** Cara HR mengusulkan "berhenti tanpa pemberitahuan".
- **A4.** Isian yang wajib saat mendaftar dan lampiran ubah data diri.
- **A5.** Tanda baru di Pengaturan Jabatan supaya aturan Pemilik dan GM tidak
  ditulis dengan nama jabatan.
- **A6.** Admin HR boleh memutuskan promosi training atau tidak.
- **A7.** Kepala Gudang melihat daftar karyawan versi terbatas.
- **A8.** Usulan Pengaturan Jabatan dan pengecualian lewat kotak Persetujuan.
- **A9.** Bentuk baku spec (bagian 0) dan daftar pemberitahuan (bagian 7).
- **A10.** Data diri lain (buku Karyawan bagian 6 butir 2).

Jawaban pemilik 13 Oktober 2026: **"ok semua ok"**, semua sesuai saran.

1. **A1:** genap 3 bulan sejak tanggal bergabung (pilihan b). KAR-20 ditulis
   ulang; jenis **pengganti** ("3 periode" menjadi "3 bulan").
2. **A2:** HR dan Admin HR mengubah cabang, departemen, jabatan; tanda berhak
   tinggi hanya Pemilik dan GM; titik lokasi diberitahukan ke GM; jabatan baru
   tanpa hak. KAR-82 baru.
3. **A3:** HR mengusulkan, masuk Persetujuan Pemilik dan GM, slip terakhir
   tertahan. KAR-68 ditambah (pelapis).
4. **A4:** foto diri dan kontak darurat wajib saat daftar; rekening boleh kosong
   dengan tanda dan pengingat; ganti rekening wajib lampiran buku tabungan atau
   ATM. KAR-80 baru.
5. **A5:** tanda Diabsen, Gaji hanya terlihat Pemilik dan GM, Terhitung jumlah
   karyawan di Pengaturan Jabatan. KAR-83 baru.
6. **A6:** Admin HR boleh memutuskan promosi training (KAR-77; KAR-21 disesuaikan).
7. **A7:** Kepala Gudang melihat daftar terbatas. KAR-84 baru.
8. **A8:** usulan lewat kotak Persetujuan. KAR-73 ditambah (pelapis).
9. **A9:** bentuk baku spec dan daftar pemberitahuan disetujui.
10. **A10:** dicatat, boleh kosong, diubah sendiri langsung berlaku. KAR-81 baru;
    buku Karyawan bagian 6 butir 2 ditutup.

---

## 14. Daftar periksa (peta jalan Tahap 4)

- [x] Tidak melanggar WAJ-01 s.d. 12 (tidak ada nama jabatan di aturan mesin
      setelah A5; semua tindakan tercatat; data tidak dihapus).
- [x] Setiap layar memenuhi TAM-01 s.d. 24 (jendela error, langkah bertahap,
      tombol 3 detik untuk yang berakibat, jalan keluar terlihat).
- [x] Rancangan data memenuhi PRI-01 s.d. 39 (perusahaan, tanggal berlaku,
      tanpa hapus, indeks pencarian, mesin berpenjaga).
- [x] Setiap aturan bisnis di spec ada di buku aturan dengan nomor (KAR-80
      s.d. 84 ditambah, KAR-20, 21, 68, 73 disesuaikan, 13 Oktober 2026).
- [x] Kejadian di lapangan dan jalan keluar terisi.
- [x] Tiap layar menyebut ukuran utamanya, beda jabatan dicatat, dan isinya
      bisa disusun dari komponen baku (`../desain/README.md`). Bentuk yang
      belum ada komponennya: peta kecil titik lokasi cabang (KAR-L30) dan tabel
      jabatan × tanda (KAR-L31); keduanya ditambahkan sebagai komponen saat
      dibangun. (Pengganti butir "gambar layar", CHANGELOG 153.)
- [x] Perhitungan uang punya contoh angka: modul ini tidak menghitung uang;
      waktu yang memengaruhi uang punya contoh (bagian 12).
