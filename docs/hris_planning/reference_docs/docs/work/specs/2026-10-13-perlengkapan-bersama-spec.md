# Spec Siap Bangun: Perlengkapan Bersama (Tahap 4B)

Tanggal: 13 Oktober 2026
Status: **disetujui penuh 13 Oktober 2026** (B1 s.d. B11 sesuai saran,
bagian 13). Tanda *(B…)* menunjuk pertanyaan yang menentukan bagian itu.

Bahan: PRI-01, 02, 05, 07 s.d. 11, 23, 25, 29, 32, 33, 35 s.d. 38; TAM-01 s.d.
07, 13 s.d. 17, 20 s.d. 24; WAJ-06, 07, 11, 12; SIS-05, 38 s.d. 46; KAR-52,
63, 67, 72, 73, 77, 78, 79; KEU-17, 121; `2026-10-13-waktu-dan-uang-desain.md`
(3D), `2026-10-13-pengajuan-dan-laporan-desain.md` (3E),
`2026-10-13-hak-akses-desain.md` (3B), `2026-10-13-menu-desain.md` (3C),
`2026-10-13-peta-data-desain.md` (3A), `../../aturan/00-peta-modul.md`,
`../backlog/2026-10-11-tempat-uji-per-jabatan.md`,
`../backlog/2026-10-11-mesin-pengaman-hak-akses.md`.

Bentuk spec mengikuti bagian 0 `2026-10-13-karyawan-dan-akses-spec.md`. Kode
layar memakai awalan **BER** (Perlengkapan **Ber**sama). Perlengkapan Bersama
tidak punya buku aturan sendiri: aturannya ada di PRI, TAM, dan SIS-47.

Plan tempat uji dan alur rilis: `../plans/2026-10-13-tempat-uji-dan-alur-rilis.md`.

---

## 1. Batas

**Dikerjakan:** Beranda dan daftar "perlu perhatian"; Pemberitahuan; antrean
pengingat berantai; Mesin Pengajuan (Pengajuan Saya, Persetujuan, daftar jenis
pengajuan); Papan Perubahan Aturan dan pengumuman darurat; Panduan Karyawan
dan "Apa yang baru"; tanda "Baru" dan nomor versi; Kesehatan Mesin; Riwayat
Error; Jejak Perubahan; kerangka menu Pengaturan (cara mengubah satu
pengaturan); alat tempat uji (bilah, ganti akun contoh, jam uji, kembalikan
data contoh, tamu uji).

**Tidak dikerjakan di spec ini:**

| Hal | Di mana |
|---|---|
| Isi khas tiap jenis pengajuan (tanggal izin, jam lembur, nominal kasbon) dan akibatnya setelah disetujui | Spec modul jenisnya (4D, 4E, 4G, 4H, 4I); tiap spec mengisi bagian 9 |
| Daftar pengingat, tanda "perlu perhatian", dan pengaturan milik tiap modul | Bagian 7 dan 8 spec modulnya; dirapikan di 4J |
| Masuk, hak akses, Hak Akses Jabatan, Pengaturan Jabatan, Daftar Pengecualian, Pedoman Lapor, "Lihat sebagai" di sistem asli | 4A (selesai) |
| Layar status Tarik Data Kasir dan "belum dipasangkan" | 4C (tampil sebagai baris di Kesehatan Mesin) |
| Lapor Masalah, Serah Terima, Perlu Dijelaskan | 4D Kehadiran |
| Ringkasan pagi keuangan (KEU-117), Keuangan Hari Ini, Dashboard Logistik | 4H dan 4F |
| Notifikasi ke handphone | Disiapkan tempatnya, dinyalakan belakangan (SIS-09, 45) |
| WhatsApp otomatis | Tidak ada di v3 (PRI-25) |
| Langkah memasang tempat uji, alur rilis, mesin pengaman | Plan tempat uji dan alur rilis |

---

## 2. Daftar layar

| Kode | Layar | Letak di menu | Dipakai | Ukuran utama |
|---|---|---|---|---|
| BER-L01 | Beranda | Beranda | Semua | HP+PC |
| BER-L02 | Pemberitahuan | Bilah bawah HP; lonceng di bilah atas PC | Semua | HP |
| BER-L03 | Jendela antrean (pengingat berantai dan pengumuman darurat) | (muncul sendiri) | Semua | HP+PC |
| BER-L04 | Pengajuan Saya | Saya | Semua | HP |
| BER-L05 | Ajukan: pilih jenis | dari BER-L04 | Semua | HP |
| BER-L06 | Isian pengajuan (kerangka) | dari BER-L05 | Semua | HP |
| BER-L07 | Rincian pengajuan saya | dari BER-L04 | Semua | HP |
| BER-L08 | Papan Perubahan Aturan | Panduan | Semua | HP |
| BER-L09 | Rincian pengumuman | dari BER-L08, BER-L01, BER-L03 | Semua | HP |
| BER-L10 | Panduan Karyawan | Panduan | Semua | HP |
| BER-L11 | Apa yang baru | Kaki menu (nomor versi) | Semua | HP |
| BER-L20 | Persetujuan | Kantor | Penyetuju dan pemeriksa | PC (HP untuk GM) |
| BER-L21 | Putuskan pengajuan | dari BER-L20 | sama | HP+PC |
| BER-L22 | Pengumuman | Kantor | HR, Admin HR, Pemilik, GM | PC |
| BER-L23 | Tulis pengumuman perubahan aturan (4 langkah) | dari BER-L22, dan dari layar ubah pengaturan | sama | PC |
| BER-L24 | Kirim pengumuman darurat (3 langkah) | dari BER-L22 | sama | HP+PC |
| BER-L25 | Siapa sudah dan belum baca | dari BER-L22 | sama | PC |
| BER-L26 | Ubah Panduan Karyawan | dari BER-L22 | sama | PC |
| BER-L30 | Kesehatan Mesin | Sistem | Pemilik, GM | PC |
| BER-L31 | Rincian mesin | dari BER-L30 | Pemilik, GM | PC |
| BER-L32 | Riwayat Error | Sistem | Pemilik, GM | PC |
| BER-L33 | Rincian error | dari BER-L32 | Pemilik, GM | PC |
| BER-L34 | Jejak Perubahan | Sistem; dan tombol "Riwayat" di tiap baris data | Pemilik, GM (dari baris: yang berhak melihat barisnya) | PC |
| BER-L40 | Pengaturan (daftar per modul) | Kantor › Pengaturan | Menurut hak tiap pengaturan | PC |
| BER-L41 | Ubah satu pengaturan (langkah baku) | dari BER-L40 | sama | PC |
| BER-L42 | Jenis Pengajuan | Pengaturan › Perlengkapan Bersama | Pemilik, GM | PC |
| BER-L50 | Bilah dan Papan Tempat Uji | (hanya di tempat uji) | Pemilik, GM; tamu uji | HP+PC |
| BER-L51 | Ganti akun contoh | dari BER-L50 | sama | HP+PC |

Jumlah: 28 layar. Tidak digambar satu per satu (`../desain/README.md`).

---

## 3. Rincian layar

Aturan untuk semua layar, tidak diulang: error di jendela "OK, paham" (TAM-01
s.d. 06); tombol menyimpan terkunci sampai selesai (TAM-13); isian tidak hilang
kalau sinyal putus (TAM-16); pesan berhasil menyebut apa yang tersimpan dan
siapa bertindak berikutnya (TAM-17); daftar dibagi per halaman (PRI-10); semua
jam dari server (PRI-01).

### Tiga tingkat pemberitahuan (TAM-25)

Semua modul mengirim lewat tiga pintu yang sama; tidak ada modul yang membuat
jendela atau lonceng sendiri (WAJ-04).

| Tingkat | Untuk apa | Tampil di | Hilang kapan |
|---|---|---|---|
| **Antrean berantai** | Yang lolos pegangan TAM-24: uang atau hak bisa hilang, orang lain menunggu, pengumuman | BER-L03, satu jendela pada satu waktu | Pengumuman: setelah "Sudah saya baca". Pengingat tugas: muncul lagi sekali sehari sampai urusannya beres |
| **Perlu perhatian** | Pekerjaan yang menunggu orang itu | BER-L01 dan angka penanda menu | **Hilang sendiri** saat urusannya beres; tidak bisa ditutup tangan |
| **Pemberitahuan** | Kabar yang cukup diketahui: pengajuan disetujui atau ditolak, hak diubah, password diganti | BER-L02 | Ditandai terbaca saat dibuka; disimpan 90 hari |

Butir di antrean berantai **selalu** juga tampil di "perlu perhatian", supaya
orang yang sudah menekan OK tetap bisa menemukannya lagi.

### BER-L01. Beranda

Urutan dari atas, tetap:

1. **Pengumuman belum dibaca** (PRI-35 butir 5): kartu bertanda, tombol **Baca**.
   Tetap di paling atas sampai ditekan "Sudah saya baca".
2. **Perlu perhatian saya:** satu kartu per jenis urusan dengan jumlahnya dan
   yang paling lama menunggu. Contoh: "4 pengajuan menunggu keputusan · paling
   lama 2 hari", "Laporan Kasir shift pagi belum diisi", "Lembur 12 Oktober
   belum diklaim · hangus 15 Oktober". Menekan kartu membuka layar urusannya.
   Urutan: yang punya batas waktu terdekat di atas.
3. **Pemberitahuan terbaru:** tiga terakhir, tautan "Lihat semua" ke BER-L02.

- **Kosong:** "Tidak ada yang menunggu Anda."
- **Beda jabatan:** isi dibaca dari hak. Pemilik dan GM mendapat kelompok
  tambahan **Perlu perhatian sistem**: mesin gagal atau tidak jalan (PRI-33),
  error tanpa sebab dan error berulang (TAM-23), pengajuan lewat 2 hari
  (PRI-37), sambungan kasir putus (PRI-39).
- Halaman depan modul (Keuangan Hari Ini, Dashboard Logistik) bukan bagian
  layar ini; Beranda hanya memuat kartu yang menuju ke sana.

### BER-L02. Pemberitahuan

- Daftar kabar, terbaru di atas; yang belum dibuka bertanda titik.
- Menekan satu kabar membuka layar urusannya dan menandainya terbaca. Tombol
  **Tandai semua terbaca**.
- Tidak ada tombol hapus. Yang lebih dari 90 hari dibuang mesin.

### BER-L03. Jendela antrean

Komponen "Pengingat berantai, pengumuman darurat" di sistem desain.

- **Kapan muncul:** saat aplikasi dibuka pertama kali hari itu, dan saat ada
  pengumuman baru terbit ketika aplikasi sedang terbuka. Pengumuman darurat
  muncul paling lambat 1 menit setelah dikirim, di layar mana pun.
- **Urutan (TAM-22):** pengumuman darurat → perubahan aturan → pengingat tugas.
  Di dalam satu kelompok: yang terlama lebih dulu.
- **Tombol:** "OK, sudah baca" aktif setelah 1 detik; pengumuman darurat dan
  perubahan aturan memakai "Sudah saya baca" (darurat: aktif setelah 5 detik,
  PRI-36). Tinjauan pengecualian punya dua tombol (PRI-38).
- **Pengingat tugas dikelompokkan per jenis urusan** (B2, TAM-25 butir 4):
  satu jendela menyebut jumlah dan yang paling lama, misalnya "Ada 6 klaim
  lembur menunggu keputusan Anda. Yang paling lama sudah 2 hari." Pengumuman
  dan pengingat pribadi karyawan tidak pernah digabung.
- **Tidak menghalangi:** layar Absen (antrean ditunda sampai absen selesai,
  TAM-22); isian yang sedang diketik tidak hilang (TAM-16). Selain pengumuman
  darurat, jendela tidak muncul di tengah langkah pekerjaan bertahap; ia
  menunggu sampai langkah itu selesai atau ditinggalkan.
- **Lihat sebagai:** antrean orang yang dilihat tidak ditampilkan sebagai
  jendela dan tidak bisa ditandai terbaca atas namanya (KAR-78).
- **Jalan keluar:** hanya tombolnya (TAM-02). Aplikasi tertutup di tengah
  antrean: sisanya muncul saat dibuka lagi.

### BER-L04. Pengajuan Saya

- Daftar kartu pengajuan milik orang itu, terbaru di atas: jenis, ringkasan
  (misalnya "Izin 14 Oktober", "Kasbon Rp 500.000"), label status (7 status,
  PRI-37), tanggal diajukan.
- Saring: status, jenis. Bawaan: periode berjalan; yang lama dimuat saat
  diminta (PRI-11).
- Tombol besar **Ajukan** (ke BER-L05).
- Pengajuan yang diisikan orang lain atas namanya (misalnya kasbon oleh HR)
  ikut tampil, bertanda "diisi oleh …".

### BER-L05. Ajukan: pilih jenis

- Satu tombol besar per jenis. Hanya jenis yang menjadi haknya dan memenuhi
  syaratnya yang bisa ditekan. Jenis yang haknya ada tetapi syaratnya belum
  terpenuhi tampil redup dengan alasannya, misalnya "Kasbon: masih ada kasbon
  yang belum lunas", supaya orang tidak mengira menunya hilang.
- Di bawah tiap jenis: batas waktu mengajukan dalam satu kalimat ("paling
  lambat 3 hari setelah tanggal lembur").

### BER-L06. Isian pengajuan (kerangka)

Kerangka milik Mesin Pengajuan; isinya milik modul jenisnya.

- **Kepala:** nama jenis, satu baris pedoman lapor yang cocok (KAR-79), batas
  waktu dan akibat terlewat (PRI-07).
- **Isi khas:** disediakan modul jenisnya (bagian 9 spec modul itu).
- **Lampiran:** wajib atau tidak, kamera langsung atau kamera dan galeri,
  menurut daftar jenis (TAM-08).
- **Kirim:** jenis yang berakibat ke uang memakai jendela konfirmasi yang
  ditahan 3 detik dan menyebut angkanya (TAM-15).
- **Ditolak server** kalau: lewat batas waktu, kembar dengan pengajuan yang
  masih menunggu atau sudah disetujui untuk urusan yang sama, atau syarat
  jenisnya tidak terpenuhi. Pesannya menyebut sebab dan jalan berikutnya.
- **Berhasil:** "Pengajuan izin terkirim. Menunggu keputusan HR atau pemilik."
- **Jalan keluar:** Kembali tanpa kehilangan isian; Ulangi dari awal; setelah
  terkirim, Batalkan dari BER-L07.

### BER-L07. Rincian pengajuan saya

- Isi pengajuan, lampiran, label status, dan **riwayat**: siapa berbuat apa,
  kapan, dengan alasan apa.
- **Menunggu / Diperiksa:** tombol **Batalkan** (wajib alasan; status
  Dibatalkan).
- **Ditolak:** alasan penolakan tampil besar; tombol **Ajukan ulang** membuka
  BER-L06 dengan isian lama terisi. Batas waktu jenisnya tetap berjalan; kalau
  sudah lewat, tombolnya mati dengan penjelasan.
- **Disetujui:** kalau jenisnya mengizinkan (aturan modulnya, misalnya
  KEH-40), tombol **Minta dibatalkan**, yang menjadi permintaan ke penyetuju.
- **Dicabut / Hangus:** alasan dan "harus bicara ke siapa" (PRI-09).

### BER-L08 dan L09. Papan Perubahan Aturan

- **L08:** daftar pengumuman yang mengenai orang itu saja (PRI-29), dua tab:
  **Berlaku** dan **Riwayat** (aturan lama beserta masa berlakunya). Yang belum
  dibaca di atas, bertanda. Pengumuman darurat yang masih tayang ikut tampil
  di tab Berlaku dengan tanda "Darurat"; sesudah masa tayangnya, di Riwayat.
- **L09:** judul, **sebelumnya**, **sekarang**, **mulai berlaku**, **harus
  bertanya ke siapa**. Tombol **Sudah saya baca** (sekali; tercatat kapan).
  Pengumuman yang diralat menampilkan tanda "Diralat" dan tautan ke ralatnya.
- Jalan keluar: Kembali. Menandai terbaca tidak bisa ditarik.

### BER-L10. Panduan Karyawan

- Daftar halaman baca berjudul (misalnya "Cara absen", "Aturan libur"),
  berurutan; tiap halaman teks sederhana dengan butir dan gambar.
- Kotak cari judul. Hanya baca.
- Sebelum diisi: "Panduan belum diisi."

### BER-L11. Apa yang baru

- Dibuka dari nomor versi di kaki menu (TAM-20). Daftar rilis, terbaru di
  atas: nomor versi, tanggal, dan satu sampai tiga kalimat sederhana tentang
  apa yang berubah **bagi orang itu** (rilis yang tidak mengenai jabatannya
  tidak tampil).
- Tanda "Baru" di menu dan di dalam halaman (TAM-21) dibaca dari daftar yang
  sama dan hilang sendiri setelah 7 hari.

### BER-L20. Persetujuan

- Satu kotak untuk semua pengajuan yang menunggu **keputusan atau pemeriksaan
  orang itu** (PRI-37 butir 6). Tab: **Menunggu saya**, **Sudah saya
  putuskan**, **Semua** (yang berhak ia lihat).
- Kartu: jenis, pengaju (dan "diisi oleh" kalau atas nama), ringkasan, lama
  menunggu. Yang lebih dari 1 hari bertanda kuning; lebih dari 2 hari bertanda
  merah dan ikut tampil di "perlu perhatian" Pemilik dan GM.
- Urutan bawaan: terlama di atas. Saring: jenis, cabang, pengaju.
- Pengajuan milik sendiri tampil redup di tab Semua dengan tulisan "diputuskan
  penyetuju lain" (batas keras KAR-72).
- Pengaju yang sudah nonaktif: kartunya bertanda "orangnya nonaktif sejak …";
  tetap diputuskan orang, tidak dibatalkan mesin (PRI-40 butir 3).
- **Tidak ada "Setujui semua"** (PRI-40 butir 1).
- Usulan Pengaturan Jabatan, pengecualian, pengaturan, dan pengumuman uang
  masuk kotak yang sama (KAR-73).

### BER-L21. Putuskan pengajuan

- Isi lengkap pengajuan, lampiran (lampiran tertutup hanya untuk yang berhak,
  PRI-23), riwayat, dan **keterangan pembantu** yang disediakan modul jenisnya
  (misalnya sisa cuti, jam absen hari itu, sisa plafon kasbon).
- Tombol menurut tahap:
  - Pemeriksa (jenis yang punya pemeriksa): **Sudah diperiksa** dengan catatan,
    atau **Tolak**.
  - Penyetuju: **Setujui** (ditahan 3 detik; jendelanya menyebut akibat dengan
    angka, TAM-15) atau **Tolak** (wajib alasan, yang akan dibaca pengaju).
  - Sudah disetujui: **Cabut persetujuan** (wajib alasan), selama aturan
    jenisnya masih mengizinkan (misalnya KEH-68: sebelum slip ditutup).
- Setelah memutuskan: pesan berhasil dengan dua jalan, **Berikutnya** (langsung
  ke pengajuan menunggu berikutnya) dan **Kembali ke Persetujuan** (PRI-40
  butir 1).
- Dua penyetuju membuka pengajuan yang sama: yang lebih dulu menyimpan
  berlaku; yang kedua mendapat jendela "Sudah diputuskan Nadia pukul 10.42:
  disetujui."
- Jalan keluar: Kembali tanpa memutuskan; keputusan salah dibetulkan dengan
  Cabut persetujuan, atau pengaju Ajukan ulang setelah ditolak.

### BER-L22. Pengumuman

- Tab: **Konsep**, **Menunggu persetujuan**, **Terjadwal**, **Terbit**,
  **Ditarik**.
- Tombol **Tulis perubahan aturan** (BER-L23) dan **Kirim pengumuman darurat**
  (BER-L24, tombol berwarna bahaya supaya tidak tertukar).
- Per pengumuman terbit: jumlah sudah baca dari jumlah sasaran, tautan ke
  BER-L25.
- Kartu **Panduan Karyawan** menuju BER-L26.

### BER-L23. Tulis pengumuman perubahan aturan (4 langkah)

1. **Isi:** judul, sebelumnya, sekarang, harus bertanya ke siapa. Kalau dibuka
   dari layar ubah pengaturan (BER-L41, KAR-L31), "sebelumnya" dan "sekarang"
   sudah terisi dari nilai lama dan baru (PRI-35 butir 2); penulis merapikan
   bahasanya.
2. **Sasaran:** diusulkan sistem dari pengaturan yang diubah; penulis boleh
   menyesuaikan: semua orang, cabang, jabatan, atau gabungannya. Layar
   menyebut jumlah orangnya.
3. **Dua tanggal:** jadwal terbit dan tanggal berlaku, serta pilihan
   **menyangkut uang** (ya/tidak) dan **sifat** (merugikan atau mengubah cara
   hitung · murni menguntungkan). Server menolak jarak yang kurang dari 7 hari
   atau 1 hari menurut sifatnya, dan tidak pernah menerima berlaku di hari
   terbit (PRI-35 butir 4). Kalau pengumuman lahir dari perubahan pengaturan,
   tanggal berlakunya dikunci sama dengan tanggal berlaku pengaturan itu.
4. **Periksa:** tampil persis seperti yang akan dilihat karyawan. Tombol
   **Terbitkan** (atau **Jadwalkan**); untuk yang menyangkut uang dan ditulis
   HR atau Admin HR tombolnya **Kirim untuk disetujui**, masuk kotak
   Persetujuan Pemilik dan GM.

- **Jalan keluar:** Kembali, Ulangi dari awal, Simpan sebagai konsep. Yang
  terjadwal dan belum terbit: **Ubah** atau **Batalkan**. Yang sudah terbit
  tidak diubah: **Ralat** atau **Tarik** (PRI-40 butir 2).
  - **Ralat:** pengumuman baru yang menggantikan; yang lama bertanda
    "Diralat"; semua sasaran diminta membaca lagi.
  - **Tarik:** hanya selama belum berlaku, wajib alasan; sasaran diberi tahu
    "pengumuman ini ditarik". Kalau pengumuman lahir dari perubahan
    pengaturan, menariknya **ikut membatalkan perubahan itu**.
  - Sudah berlaku: tidak ditarik; dibuat perubahan aturan baru (WAJ-07).

### BER-L24. Kirim pengumuman darurat (3 langkah)

1. **Isi:** judul dan pesan pendek (paling banyak 300 huruf, supaya terbaca
   dalam 5 detik).
2. **Sasaran dan masa tayang:** semua orang, atau cabang dan jabatan tertentu;
   masa tayang bawaan sampai akhir hari ini.
3. **Periksa dan Kirim:** menyebut jumlah penerima. Tombol ditahan 3 detik,
   karena langsung muncul di layar semua penerima.

- Jalan keluar: sebelum kirim, Kembali. Sesudah kirim: **Akhiri sekarang**
  (yang belum membaca tidak lagi mendapat jendelanya) dan, kalau isinya salah,
  kirim pengumuman darurat baru. Tidak diubah, tidak dihapus (PRI-36).

### BER-L25. Siapa sudah dan belum baca

- Daftar sasaran satu pengumuman: nama, cabang, jabatan, sudah baca (kapan)
  atau belum. Saring: belum baca. Dilihat penulis, HR, Admin HR, Pemilik, GM
  (PRI-35 butir 5).
- Orang yang masuk sasaran setelah pengumuman terbit (baru pindah cabang atau
  jabatan) ikut menjadi sasaran selama pengumuman masih berlaku.

### BER-L26. Ubah Panduan Karyawan

- Daftar halaman: **Tambah**, **Ubah**, **Urutkan**, **Sembunyikan**. Isian:
  judul dan isi teks panjang dengan butir dan gambar. Perubahan tercatat
  (sebelum dan sesudah) dan bisa dikembalikan ke versi sebelumnya.
- Panduan menjelaskan **cara memakai**; aturan yang berubah tetap diumumkan di
  Papan (PRI-29), bukan diselipkan di panduan.

### BER-L30 dan L31. Kesehatan Mesin

- **L30:** satu baris per mesin otomatis dari semua modul (PRI-33 butir 6):
  nama, modul, jadwal, terakhir jalan, hasilnya (label: **Sehat**, **Gagal**,
  **Telat**, **Dimatikan**), dan berapa yang dikerjakan. Yang gagal dan telat
  di atas. Termasuk cadangan harian, uji pulih bulanan (SIS-42), dan hasil
  terakhir mesin pengaman.
- **Telat dihitung saat layar dan Beranda dibuka**, dengan membandingkan jam
  sekarang dengan jadwalnya, bukan oleh mesin lain. Jadi kalau penjadwalnya
  sendiri mati, tandanya tetap muncul (tidak ada mesin yang gagal diam-diam).
- **L31:** riwayat jalan mesin itu (kapan, berapa lama, berhasil atau gagal,
  berapa yang dikerjakan, pesan gagal dalam bahasa sederhana dan kode
  rujukannya). Tombol **Jalankan sekarang** (konfirmasi biasa; hasilnya tidak
  dobel, PRI-33 butir 3). Tautan ke pengaturan jadwalnya (BER-L41).
- Mesin tidak punya tombol "matikan" di layar ini. Mematikan mesin adalah
  mengubah pengaturannya, dengan alasan dan jejak.

### BER-L32 dan L33. Riwayat Error

- **L32:** dua bagian. **Ringkasan** (bulan berjalan; bulan lain dipilih):
  sepuluh pesan error tersering dan sepuluh halaman tersering, berupa tabel
  peringkat dengan jumlah kejadian dan jumlah orang. **Daftar:** kapan, siapa,
  jabatan, halaman, pesan, perangkat, jenis (**salah isi**, **ditolak
  aturan**, **tanpa sebab**). Saring: jenis, halaman, orang, tanggal, "belum
  ditangani". Bawaan: 7 hari terakhir.
- **L33:** semua isi TAM-05 (termasuk sedang melakukan apa, kapan "OK, paham"
  ditekan, rincian teknis, kode rujukan), dan error yang sama pada orang lain
  di hari itu.
- **Tindak lanjut** (TAM-23 butir 6): error yang masuk "perlu perhatian"
  (tanpa sebab, atau sama pada 3 orang atau lebih sehari) punya tombol
  **Sudah ditangani** dengan catatan; setelah itu keluar dari "perlu
  perhatian". Error sama yang muncul lagi di hari lain masuk lagi.
- Tidak ada yang bisa diubah atau dihapus dari layar ini. Yang lebih dari 12
  bulan dibuang mesin; ringkasan per bulan tetap.

### BER-L34. Jejak Perubahan

- **Dari menu Sistem** (Pemilik, GM): cari menurut orang yang mengubah, jenis
  data, tanggal. Tiap baris: siapa, kapan, data apa, nilai sebelum dan sesudah,
  alasan, dan kalau diubah mesin: modul pemicunya (KEU-17).
- **Dari tiap baris data** (tombol "Riwayat"): jejak baris itu saja, terlihat
  oleh siapa pun yang berhak melihat barisnya.
- Jejak tidak bisa diubah dan tidak pernah dibuang (PRI-40 butir 4). Nilai
  yang tertutup (gaji, rekening) tetap tertutup di jejak bagi yang tidak
  berhak.

### BER-L40 dan L41. Pengaturan

Satu cara mengubah untuk semua pengaturan yang berupa angka, pilihan, jadwal,
atau daftar (PRI-32). Pengaturan berbentuk tabel besar punya layarnya sendiri
di modulnya (misalnya KAR-L31, tarif rute) tetapi memakai langkah yang sama.

- **L40:** dikelompokkan per modul. Tiap baris: nama dalam bahasa sederhana,
  nilai sekarang, berlaku sejak, dan kalau ada: nilai berikutnya dan tanggal
  berlakunya. Orang hanya melihat pengaturan yang menjadi haknya (PRI-32
  butir 5). Kotak cari.
- **L41. Langkah baku:**
  1. **Nilai baru.** Layar menampilkan nilai sekarang, satuannya, dan
     penjelasan satu kalimat tentang apa yang dipengaruhi.
  2. **Tanggal berlaku dan alasan.** Pengaturan yang menyangkut uang atau
     hitungan: tanggal berlaku wajib dan tidak boleh mundur (WAJ-07).
  3. **Pengumuman** (hanya pengaturan bertanda "wajib diumumkan"): membuka
     BER-L23 dengan isi terisi, atau memilih "tidak perlu diumumkan" dengan
     alasan (PRI-35 butir 2).
  4. **Periksa:** sebelum → sesudah, mulai kapan, siapa yang terkena. Tombol
     ditahan 3 detik untuk yang menyangkut uang.
- **Pemeriksa (PRI-32 butir 4):** tiap pengaturan terdaftar dengan salah satu
  dari dua cara: **diusulkan lalu disetujui** (masuk kotak Persetujuan) atau
  **langsung berlaku dan pihak lain diberi tahu**. Yang diubah Pemilik atau GM
  sendiri langsung berlaku dan pemilik lain diberi tahu (KAR-73, KEU-119).
- **Riwayat** tiap pengaturan: semua nilai yang pernah berlaku, dari kapan
  sampai kapan, siapa, alasan.
- **Jalan keluar:** Kembali dan Ulangi dari awal sebelum simpan. Nilai yang
  belum berlaku boleh **Dibatalkan** dengan alasan (pengumumannya ikut
  ditarik). Yang sudah berlaku tidak dibatalkan; diubah dengan nilai baru
  bertanggal.

### BER-L42. Jenis Pengajuan

- Daftar semua jenis yang terdaftar di Mesin Pengajuan (PRI-37 butir 2): nama,
  modul, penyetuju, pemeriksa, pelihat tambahan, batas waktu mengajukan, akibat
  terlewat (pengajuan terlambat atau hangus, PRI-08), lampiran, tertutup, boleh
  diisi atas nama oleh siapa.
- Yang bisa diubah dari layar: penyetuju, pemeriksa, pelihat tambahan (dipilih
  dari **jabatan**, bukan nama orang), dan batas waktu (bertanggal berlaku,
  lewat BER-L41). Menambah jenis baru adalah pekerjaan pembangunan, bukan dari
  layar.
- Server menolak jenis tanpa penyetuju, dan penyetuju yang sama dengan
  satu-satunya orang yang boleh mengajukan.

### BER-L50 dan L51. Tempat uji

Hanya ada di tempat uji; di sistem asli kodenya tidak aktif.

- **Bilah tempat uji** selalu tampil di atas layar, warnanya berbeda dari bilah
  "Lihat sebagai": "TEMPAT UJI · data contoh · sedang sebagai: Contoh Kasir A
  (Toko Contoh 1) · [Ganti akun] [Papan uji]". Kalau jam uji dimajukan, ikut
  tertulis: "jam uji: 26 November 2026 08.00".
- **L51. Ganti akun contoh:** daftar akun contoh per jabatan dan cabang; pilih
  satu, tampilan langsung berganti tanpa keluar akun, dan **boleh bertindak**
  (KAR-52). Berlaku **per jendela browser**, jadi beberapa jabatan bisa dibuka
  berdampingan untuk mengikuti satu alur.
- **L50. Papan uji:**
  - **Yang perlu dicoba:** daftar periksa dari "Kejadian di lapangan" spec
    yang sedang dirilis (PRI-06); tiap baris ditandai pemilik **Sesuai** atau
    **Belum sesuai** dengan catatan.
  - **Jam uji** (SIS-47): memajukan tanggal dan jam tempat uji (misalnya ke
    tanggal 26 untuk mencoba tutup slip), dan **Kembali ke jam sekarang**.
    Hanya maju. Mesin terjadwal yang seharusnya jalan di rentang yang dilompati
    ikut dijalankan berurutan.
  - **Kembalikan data contoh** (SIS-47): mengisi ulang tempat uji ke keadaan
    awal. Konfirmasi dengan mengetik kata KEMBALIKAN.
  - **Versi:** versi di tempat uji, versi di sistem asli, dan daftar perubahan
    yang belum dirilis.
  - **Tamu uji** (SIS-47): buat akun tamu yang berakhir sendiri setelah 7
    hari, dan cabut. Hanya Pemilik dan GM.
- Tempat uji tidak pernah mengirim email atau notifikasi ke orang sungguhan.

**Bentuk yang belum ada komponennya:** (1) bilah tempat uji (varian bilah
"Lihat sebagai" dengan warna lain); (2) isian teks panjang berjudul dengan
butir dan gambar (Panduan Karyawan); (3) tabel peringkat ringkasan error;
(4) pemilih tanggal dan jam untuk jam uji. Ditambahkan sebagai komponen saat
dibangun (dicatat di `../desain/README.md`).

---

## 4. Data

Semua tabel punya kolom perusahaan (PRI-31) dan jejak dibuat dan diubah. Tidak
ada yang dihapus kecuali yang disebut punya masa simpan.

| Tabel | Isi penting | Dicari dengan | Dibaca modul lain |
|---|---|---|---|
| jenis_pengajuan | kode, nama, modul, penyetuju, pemeriksa, pelihat tambahan (semuanya jabatan), batas waktu, akibat terlewat, lampiran wajib, tertutup, boleh atas nama, aktif | kode | semua |
| pengajuan | jenis, pengaju, untuk siapa, diisi oleh, tanggal diajukan, status, diputuskan oleh, kapan, alasan, rujukan ke isi khas, rujukan ke pengajuan asal (Ajukan ulang) | untuk siapa + status; status + jenis; tanggal | modul jenisnya |
| riwayat_pengajuan | pengajuan, dari status, ke status, siapa, kapan, alasan | pengajuan | — |
| lampiran_pengajuan | pengajuan, foto atau berkas, waktu diambil (TAM-09) | pengajuan | — |
| pengumuman | jenis (aturan / darurat), judul, sebelumnya, sekarang, tanya ke siapa, menyangkut uang, sifat, jadwal terbit, tanggal berlaku, masa tayang, status (konsep / menunggu / terjadwal / terbit / ditarik / berakhir), penulis, penyetuju, meralat pengumuman mana, lahir dari pengaturan mana | status; tanggal berlaku | semua |
| sasaran_pengumuman | pengumuman, semua / cabang / jabatan | pengumuman | — |
| baca_pengumuman | pengumuman, orang, kapan | pengumuman; orang | — |
| pengingat | orang, jenis urusan, rujukan, lahir, terakhir ditampilkan, beres | orang + beres | — |
| perlu_perhatian | jenis tanda, rujukan, untuk siapa (orang, atau hak dan lingkupnya), batas waktu, lahir, beres, cara beres | untuk siapa + beres | Beranda, angka penanda menu |
| jenis_tanda | kode, modul, nama, layar tujuan, masuk antrean atau tidak (TAM-24) | kode | — |
| pemberitahuan | orang, isi, layar tujuan, lahir, dibaca | orang + lahir | — (dibuang setelah 90 hari) |
| riwayat_error | isi TAM-05, jenis, kode rujukan, ditangani oleh, kapan, catatan | kapan; halaman; pesan; orang | — (dibuang setelah 12 bulan) |
| ringkasan_error_bulanan | bulan, pesan, halaman, jumlah kejadian, jumlah orang | bulan | — |
| riwayat_jalan_mesin | mesin, mulai, selesai, hasil, jumlah dikerjakan, pesan, kode rujukan, dijalankan oleh (jadwal / orang) | mesin + mulai | — |
| jejak_perubahan | tabel, baris, siapa atau mesin mana, kapan, sebelum, sesudah, alasan | tabel + baris; siapa; kapan | semua (tombol Riwayat) |
| pengaturan | kunci, nilai, berlaku dari, alasan, status (usulan / berlaku / dibatalkan), pengubah, penyetuju | kunci + berlaku dari | semua |
| halaman_panduan | judul, isi, urutan, disembunyikan, versi | urutan | — |
| catatan_rilis | versi, tanggal rilis, isi untuk karyawan, sasaran (jabatan), tanda "Baru" untuk layar atau bagian mana | tanggal | menu (tanda "Baru") |
| daftar_periksa_uji (tempat uji) | rilis, kejadian, hasil, catatan, oleh | rilis | — |
| akun_tamu_uji (tempat uji) | akun, dibuat oleh, berakhir | akun | — |

Ditulis di kode, bukan tabel: **daftar mesin** (nama, modul, kunci pengaturan
jadwalnya) dan **daftar pengaturan** (kunci, nama, modul, jenis nilai, satuan,
menyangkut uang, wajib diumumkan, boleh dikecualikan, cara periksa, hak
mengubah). Alasannya sama dengan daftar tindakan (KAR-71): mesin atau
pengaturan baru yang belum terdaftar = mesin pengaman gagal.

Riwayat jalan mesin yang berjadwal lebih sering dari sekali sejam (penarik
data kasir) disimpan per kali jalan selama 7 hari, lalu diringkas per jam;
kegagalan selalu disimpan utuh. Semuanya disimpan 12 bulan (PRI-40 butir 4).

---

## 5. Tindakan bernama dan isi awal hak

Lingkup: **D** = diri sendiri, **S** = semua. Pemilik dan GM punya semua
tindakan (KAR-67). Admin HR sama dengan HR (KAR-77). Yang tidak disebut = tidak
ada.

| Tindakan | HR, Admin HR | Finance | Kepala Toko, Kepala Gudang | Semua karyawan |
|---|---|---|---|---|
| lihat Beranda, pemberitahuan, pengumuman untuk dirinya | — | — | — | D |
| tandai pengumuman sudah dibaca | — | — | — | D |
| baca Panduan Karyawan dan Apa yang baru | — | — | — | S |
| ajukan (per jenis) | menurut daftar jenis | sama | sama | D, menurut daftar jenis |
| ajukan atas nama orang lain (per jenis) | menurut daftar jenis | sama | — | — |
| batalkan pengajuan sendiri | — | — | — | D |
| lihat pengajuan (per jenis) | menurut daftar jenis | sama | tanggal dan status timnya (KEH-80) | D |
| periksa, putuskan, cabut (per jenis) | menurut daftar jenis | sama | — | — |
| tulis pengumuman perubahan aturan | S | — | — | — |
| terbitkan pengumuman yang tidak menyangkut uang | S | — | — | — |
| setujui pengumuman yang menyangkut uang | — | — | — | — |
| ralat, tarik pengumuman | S (miliknya) | — | — | — |
| kirim dan akhiri pengumuman darurat | S | — | — | — |
| lihat siapa sudah dan belum baca | S | — | — | — |
| ubah Panduan Karyawan | S | — | — | — |
| lihat dan ubah pengaturan (per pengaturan) | menurut daftar pengaturan | sama | — | — |
| ubah daftar Jenis Pengajuan | — | — | — | — |
| lihat Kesehatan Mesin, jalankan mesin sekarang | — | — | — | — |
| lihat Riwayat Error, tandai sudah ditangani | — | — | — | — |
| lihat Jejak Perubahan dari menu Sistem | — | — | — | — |
| lihat riwayat satu baris data | mengikuti hak lihat barisnya | sama | sama | sama |
| tempat uji: ganti akun contoh, jam uji, kembalikan data, tamu uji | — | — | — | — |

Batas keras yang dijaga di sini (KAR-72): tidak memutuskan pengajuan sendiri;
tidak menyetujui pengumuman atau usulan pengaturan tulisan sendiri (kecuali
Pemilik dan GM, yang langsung berlaku dan pemilik lain diberi tahu).

---

## 6. Mesin otomatis

Semua tercatat di Kesehatan Mesin dan punya penjaga (PRI-33). Jadwalnya
pengaturan.

| Mesin | Jadwal awal | Kerjanya | Aturan |
|---|---|---|---|
| Penerbit pengumuman | Tiap 5 menit | Menerbitkan yang jadwal terbitnya tiba; mengakhiri pengumuman darurat yang masa tayangnya habis | PRI-35, 36 |
| Penanda pengajuan menunggu | Tiap jam | Lebih dari 1 hari: masuk pengingat penyetujunya. Lebih dari 2 hari: masuk "perlu perhatian" Pemilik dan GM | PRI-37 |
| Penghangus | Tiap hari 00.05 | Mencatat hak mengajukan yang lewat batas sebagai Hangus atas permintaan modul jenisnya, dan memberi tahu orangnya apa yang hangus dan harus bicara ke siapa | PRI-08, 09 |
| Pengingat batas waktu | Tiap hari 08.00 | Mengingatkan sebelum batas waktu tiap jenis, menyebut batas dan akibatnya | PRI-07 |
| Pemberes | Tiap 5 menit | Menandai beres tanda "perlu perhatian" dan pengingat yang urusannya sudah selesai (cadangan; modul juga menandai langsung saat urusannya selesai) | TAM-25 |
| Pembersih | Tiap hari 02.00 | Membuang pemberitahuan lebih dari 90 hari; riwayat error dan riwayat jalan mesin lebih dari 12 bulan setelah ringkasannya dibuat; akun tamu uji yang berakhir | TAM-23, PRI-40 |
| Pemberlaku pengaturan | Tiap hari 00.01 | Tidak mengubah apa pun (nilai dibaca menurut tanggal); hanya mencatat pengaturan yang mulai berlaku hari itu dan memberi tahu pengubahnya | WAJ-07 |
| Cadangan harian | Tiap malam | Menyalin database dan foto ke luar server | SIS-42 |
| Uji pulih | Tiap bulan | Memulihkan cadangan ke database sementara, memeriksa, lalu menghapusnya | SIS-42 |

Error berulang (3 orang atau lebih sehari) dan error tanpa sebab ditandai
**saat error tercatat**, bukan oleh mesin terjadwal.

---

## 7. Pemberitahuan (titipan 4J)

| Pemberitahuan | Kepada | Tingkat | Alasan |
|---|---|---|---|
| Pengumuman darurat | sasarannya | Antrean (paling depan) | PRI-36 |
| Perubahan aturan terbit | sasarannya | Antrean, dan paling atas Beranda sampai dibaca | PRI-35 |
| Pengumuman diralat atau ditarik | sasarannya | Antrean | Sama |
| Pengajuan menunggu lebih dari 1 hari | penyetuju atau pemeriksanya | Antrean, sekali sehari, per jenis urusan | TAM-24 butir 2, TAM-25 |
| Pengajuan menunggu lebih dari 2 hari | Pemilik, GM | Perlu perhatian | PRI-37 |
| Pengumuman uang atau usulan pengaturan menunggu persetujuan | Pemilik, GM | Antrean (lewat Mesin Pengajuan) | Orang lain menunggu |
| Pengajuan saya disetujui, ditolak, dicabut | pengaju (dan yang diatasnamakan) | Pemberitahuan; **ditolak dan dicabut masuk antrean** kalau jenisnya menyangkut uang atau punya batas waktu | TAM-24 butir 1 |
| Hak mengajukan akan hangus | orangnya | Antrean | TAM-24 butir 1 |
| Sudah hangus | orangnya | Antrean, sekali | PRI-09 |
| Mesin gagal atau telat | Pemilik, GM | Perlu perhatian sistem | PRI-33 |
| Error tanpa sebab; error sama 3 orang sehari | Pemilik, GM | Perlu perhatian sistem | TAM-23 |
| Cadangan atau uji pulih gagal | Pemilik, GM | **Antrean** | Data bisa hilang |
| Pengaturan diubah langsung oleh Pemilik atau GM | pemilik lain | Pemberitahuan | KAR-73 |
| Pengaturan mulai berlaku hari ini | pengubahnya | Pemberitahuan | — |
| Versi baru dirilis | yang terkena | Tanda "Baru" dan Apa yang baru; bukan jendela | TAM-21 |

---

## 8. Pengaturan (titipan 4J)

| Pengaturan | Angka awal | Wajib diumumkan | Boleh dikecualikan |
|---|---|---|---|
| Pengajuan mulai diingatkan ke penyetuju | 1 hari | tidak | tidak |
| Pengajuan naik ke Pemilik dan GM | 2 hari | tidak | tidak |
| Jarak terbit ke berlaku: merugikan atau mengubah cara hitung / murni menguntungkan | 7 hari / 1 hari | tidak | tidak |
| Jeda tombol: error dan pengingat / konfirmasi berakibat / pengumuman darurat | 1 / 3 / 5 detik | tidak | tidak |
| Masa tayang bawaan pengumuman darurat | sampai akhir hari itu | tidak | tidak |
| Panjang pesan pengumuman darurat | 300 huruf | tidak | tidak |
| Error sama dianggap berulang | 3 orang sehari | tidak | tidak |
| Masa simpan riwayat error / riwayat jalan mesin | 12 bulan / 12 bulan | tidak | tidak |
| Masa simpan pemberitahuan | 90 hari | tidak | tidak |
| Tanda "Baru" tampil | 7 hari | tidak | tidak |
| Mesin dianggap telat | 15 menit setelah jadwalnya (mesin per menit: 5 menit) | tidak | tidak |
| Jadwal tiap mesin (bagian 6) | lihat bagian 6 | tidak | tidak |
| Daftar jenis pengajuan: penyetuju, pemeriksa, pelihat, batas waktu | lihat bagian 9 tiap spec | batas waktu: ya | tidak |
| Masa berlaku akun tamu uji (tempat uji) | 7 hari | tidak | tidak |

Semua hanya diubah Pemilik dan GM, langsung berlaku dan pemilik lain diberi
tahu.

---

## 9. Jenis pengajuan milik bagian ini (titipan 4J)

| Jenis | Penyetuju | Ikut melihat | Batas waktu | Akibat terlewat | Lampiran | Tertutup |
|---|---|---|---|---|---|---|
| Pengumuman yang menyangkut uang | Pemilik, GM | penulis | tidak ada | tidak terbit sampai disetujui; jadwal terbit yang terlewat digeser, dan tanggal berlakunya ikut digeser supaya jarak 7 hari terjaga | tidak | tidak |
| Usulan pengaturan (yang terdaftar "diusulkan lalu disetujui") | Pemilik, GM | pengusul | tidak ada | nilai lama tetap berlaku | tidak | menurut pengaturannya |

Daftar lengkap semua jenis dari semua modul disusun di 4J.

---

## 10. Kejadian di lapangan

Setiap baris menjadi tes (PRI-06).

| No | Kejadian | Sistem berbuat apa | Aturan |
|---|---|---|---|
| 1 | Karyawan salah pilih jenis pengajuan | Kembali ke pilih jenis; isian jenis lama dibuang setelah ditanya | L05, TAM-14 |
| 2 | Sinyal putus saat mengisi pengajuan | Isian tersimpan di handphone; tanda "belum terkirim"; dikirim ulang saat tersambung | TAM-16 |
| 3 | Tombol Kirim ditekan dua kali | Hanya satu pengajuan lahir | TAM-13 |
| 4 | Mengajukan hal yang sama dua kali | Yang kedua ditolak, pesannya menunjuk pengajuan pertama | L06 |
| 5 | Mengajukan setelah batas waktu | Ditolak; pesannya menyebut batas dan jalan berikutnya (pengajuan terlambat, atau "sudah hangus, bicarakan dengan …") | PRI-08, 09 |
| 6 | Berubah pikiran setelah mengirim | Batalkan selama belum diputuskan | L07 |
| 7 | Berubah pikiran setelah disetujui | Minta dibatalkan, kalau aturan jenisnya mengizinkan | KEH-40 |
| 8 | Ditolak karena kurang lampiran | Alasan terlihat; Ajukan ulang dengan isian lama; batas waktu tetap berjalan | PRI-37 |
| 9 | Penyetuju tidak masuk seminggu | Penyetuju lain memutuskan; lewat 2 hari naik ke Pemilik dan GM; tidak ada setuju otomatis | PRI-05, 37 |
| 10 | Penyetuju mengajukan untuk dirinya sendiri | Tidak bisa memutuskan miliknya; diputuskan penyetuju lain, atau Pemilik atau GM | KAR-72 |
| 11 | GM mengajukan untuk dirinya | Diputuskan Pemilik; kebalikannya juga | PRI-37 butir 3 |
| 12 | Dua penyetuju memutuskan bersamaan | Yang lebih dulu berlaku; yang kedua diberi tahu siapa yang sudah memutuskan | L21 |
| 13 | Penyetuju salah menyetujui | Cabut persetujuan dengan alasan, selama aturan jenisnya mengizinkan; sesudah itu koreksi periode berikutnya | KEH-68, PRI-04 |
| 14 | Penyetuju salah menolak | Pengaju Ajukan ulang; penolakan pertama tetap tercatat | PRI-37 |
| 15 | Pengaju dinonaktifkan saat pengajuannya menunggu | Tetap menunggu dengan tanda; diputuskan orang | PRI-40 butir 3 |
| 16 | HR mengisi kasbon atas nama karyawan yang salah | HR membatalkannya sebelum diputuskan; karyawan yang salah itu melihat pengajuan dan pembatalannya | L04 |
| 17 | Kepala Toko mencoba membuka alasan izin timnya | Hanya tanggal dan status; alasan dan lampiran ditolak server | KEH-80 |
| 18 | HR menulis pengumuman tarif yang berlaku besok | Ditolak: jarak paling sedikit 7 hari | PRI-35 |
| 19 | Pengumuman uang ditulis HR, pemilik belum menyetujui sampai jadwal terbit lewat | Tidak terbit; jadwal dan tanggal berlaku bergeser; pengaturannya belum berubah | bagian 9 |
| 20 | Pengumuman terbit dengan angka salah | Ralat; semua sasaran diminta membaca lagi | PRI-40 butir 2 |
| 21 | Pemilik batal mengubah aturan yang sudah diumumkan tetapi belum berlaku | Tarik; perubahan pengaturannya ikut batal; sasaran diberi tahu | PRI-40 butir 2 |
| 22 | Karyawan tidak pernah menekan "Sudah saya baca" | Muncul tiap hari dan tetap di atas Beranda; pekerjaan tidak dikunci; namanya terlihat di daftar belum baca | PRI-35 butir 5 |
| 23 | Karyawan pindah ke cabang yang punya pengumuman berlaku | Ikut menjadi sasaran sejak tanggal pindah | L25 |
| 24 | Pengumuman darurat salah kirim ke semua orang | Akhiri sekarang; kirim yang benar; keduanya tercatat | PRI-36 |
| 25 | Pengumuman darurat dikirim saat kasir sedang mengisi Laporan Kasir | Jendela muncul di atas isian; isian tidak hilang | PRI-36 butir 2 |
| 26 | Karyawan membuka aplikasi untuk absen, antrean panjang | Antrean ditunda sampai absen selesai | TAM-22 butir 2 |
| 27 | Aplikasi tertutup di tengah antrean | Sisa antrean muncul saat dibuka lagi | L03 |
| 28 | Pengingat tugas sudah di-OK tetapi urusannya belum dikerjakan | Tetap di "perlu perhatian"; jendelanya muncul lagi besok | TAM-22 butir 4 |
| 29 | Mesin harian tidak jalan karena server mati semalam | Tanda Telat di Beranda GM saat dibuka; setelah server hidup, yang terlewat dikejar tanpa dobel | PRI-33 |
| 30 | GM menekan Jalankan sekarang dua kali | Hasil tidak dobel | PRI-33 butir 3 |
| 31 | Cadangan malam gagal | Antrean GM dan Pemilik pagi itu; tanda Gagal sampai cadangan berikutnya berhasil | SIS-42 |
| 32 | Lima kasir mendapat error yang sama pagi ini | Masuk "perlu perhatian" GM setelah orang ketiga; GM membuka rinciannya | TAM-23 |
| 33 | Karyawan menutup aplikasi sebelum menekan "OK, paham" | Error tetap tercatat, jam "OK" kosong | TAM-05 |
| 34 | GM salah mengisi angka pengaturan | Belum berlaku: batalkan. Sudah berlaku: nilai baru bertanggal; yang sudah dihitung tidak berubah | WAJ-07 |
| 35 | HR mengubah pengaturan yang wajib diumumkan tanpa mengisi pengumuman | Tidak tersimpan sampai pengumuman diisi atau "tidak perlu diumumkan" beralasan | PRI-35 butir 2 |
| 36 | Seseorang mencoba mengubah pengaturan langsung di database | Tidak ada jalannya dari aplikasi; mesin pengaman memeriksa tiap pengaturan punya layar | PRI-32 |
| 37 | Pemilik mencoba di tempat uji lalu mengira itu sistem asli | Bilah tempat uji selalu tampil; alamat dan ikon berbeda | L50 |
| 38 | Jam uji lupa dikembalikan | Tertulis di bilah; Kembali ke jam sekarang; atau Kembalikan data contoh | L50 |
| 39 | Tamu uji lupa dicabut | Akunnya berakhir sendiri | SIS-47 |
| 40 | Akun contoh dicoba di sistem asli | Tidak ada di sana | 3B |
| 41 | Penyetuju menekan "Berikutnya" padahal tidak ada lagi yang menunggu | Kembali ke Persetujuan dengan tulisan "Tidak ada lagi yang menunggu Anda" | L21 |

---

## 11. Jalan keluar

| Tindakan | Kembali / ulangi | Batalkan | Oleh siapa, sampai kapan | Akibat ke data lain |
|---|---|---|---|---|
| Mengajukan | Kembali, Ulangi dari awal sebelum Kirim | Batalkan | Pengaju (atau pengisinya), sampai diputuskan | Tidak ada; isi khas ikut batal |
| Menolak | — | Pengaju Ajukan ulang | Pengaju, selama batas waktu jenisnya | Pengajuan baru merujuk yang lama |
| Menyetujui | — | Cabut persetujuan dengan alasan | Penyetuju jenisnya, Pemilik, GM; sampai batas di aturan jenisnya | Akibatnya dibalik oleh modul jenisnya; sesudah slip ditutup: koreksi periode berikutnya (PRI-04) |
| Menandai "Sudah diperiksa" | — | Pemeriksa menarik tandanya | Pemeriksa, sampai diputuskan | Kembali ke Menunggu |
| Menulis pengumuman | Kembali, konsep | Belum terbit: ubah atau batalkan. Terbit belum berlaku: ralat atau tarik. Sudah berlaku: perubahan aturan baru | Penulis, Pemilik, GM | Menarik ikut membatalkan perubahan pengaturannya |
| Pengumuman darurat | Kembali sebelum kirim | Akhiri sekarang; kirim yang baru | Pengirim, Pemilik, GM | — |
| Menandai sudah dibaca | — | Tidak ada | — | — |
| Mengubah pengaturan | Kembali sebelum simpan | Belum berlaku: batalkan. Sudah berlaku: nilai baru bertanggal | Pengubah, Pemilik, GM | Hitungan yang sudah lewat tidak berubah (WAJ-07) |
| Menjalankan mesin sekarang | — | Tidak perlu: hasilnya tidak dobel | — | — |
| Menandai error ditangani | — | Tidak ada; error yang muncul lagi masuk lagi | — | — |
| Mengubah Panduan Karyawan | Kembali | Kembalikan ke versi sebelumnya | HR, Admin HR, Pemilik, GM | — |
| Tempat uji: jam uji, data contoh | — | Kembali ke jam sekarang; Kembalikan data contoh | Pemilik, GM | Hanya tempat uji |

---

## 12. Daftar tes

Bagian ini **tidak menghitung uang**. Yang diuji: waktu yang memengaruhi uang
dan hak akses (WAJ-06). Semua kejadian di bagian 10 juga menjadi tes.

**Waktu**

| No | Tes | Contoh |
|---|---|---|
| W1 | Pengajuan naik setelah 2 hari | Diajukan 10 Oktober 09.00: masuk pengingat penyetuju 11 Oktober 09.00; masuk "perlu perhatian" Pemilik dan GM 12 Oktober 09.00, tidak sebelumnya; tidak pernah disetujui sendiri |
| W2 | Batas waktu mengajukan memakai jam server | Lembur 10 Oktober, batas 3 hari: 13 Oktober 23.59 diterima; 14 Oktober 00.00 ditolak, walau jam handphone dimundurkan |
| W3 | Ajukan ulang tidak memperpanjang batas | Ditolak 13 Oktober 22.00; Ajukan ulang 14 Oktober 00.05 ditolak |
| W4 | Jarak pengumuman 7 hari | Terbit 1 November: berlaku paling cepat 8 November; 7 November ditolak. Menguntungkan: terbit 1 November, berlaku 2 November diterima, 1 November ditolak |
| W5 | Pengumuman uang telat disetujui | Jadwal terbit 1 November, berlaku 8 November; disetujui 3 November → terbit 3 November, berlaku 10 November; pengaturannya juga baru berlaku 10 November |
| W6 | Pengaturan bertanggal | Batas "naik ke Pemilik" diubah menjadi 3 hari mulai 1 November: pengajuan 30 Oktober tetap naik menurut aturan saat dihitung, dan hitungan yang sudah lewat tidak berubah |
| W7 | Menarik pengumuman membatalkan pengaturannya | Tarif baru berlaku 10 November, ditarik 5 November: pada 10 November tarif lama masih dipakai |
| W8 | Pengingat sekali sehari | Dibuka 3 kali di hari yang sama: jendela pengingat tugas hanya pada pembukaan pertama |
| W9 | Masa tayang pengumuman darurat | Dikirim 14.00 dengan masa tayang hari itu: orang yang membuka 23.58 mendapat jendela; 00.01 esoknya tidak, tetapi ada di Riwayat |
| W10 | Mesin telat | Mesin harian 08.00 belum jalan: 08.14 belum bertanda; 08.16 bertanda Telat walau penjadwal mati |
| W11 | Mesin mengejar tanpa dobel | Tiga hari terlewat lalu dijalankan dua kali: hasil tiga hari itu masing-masing satu |
| W12 | Masa simpan | Error 13 bulan lalu sudah dibuang, ringkasan bulannya masih ada; jejak perubahan 3 tahun lalu masih ada |
| W13 | Pengingat per jenis urusan | 6 klaim lembur menunggu penyetuju: satu jendela "6 klaim lembur"; ditambah 2 kasbon menunggu: jendela kedua "2 kasbon"; bukan 8 jendela |

**Hak akses** (dijalankan mesin pengaman, KAR-63)

| No | Percobaan | Hasil yang benar |
|---|---|---|
| H1 | Tiap jabatan memutuskan pengajuannya sendiri, untuk tiap jenis | Ditolak |
| H2 | Tiap jabatan memutuskan jenis yang bukan haknya | Ditolak |
| H3 | Karyawan membaca pengajuan orang lain | Ditolak |
| H4 | Kepala Toko membaca alasan dan lampiran pengajuan timnya | Ditolak; tanggal dan status boleh |
| H5 | Orang di luar daftar membuka lampiran tertutup lewat alamat fotonya | Ditolak |
| H6 | Karyawan membaca pengumuman yang bukan sasarannya | Ditolak |
| H7 | HR menerbitkan sendiri pengumuman yang menyangkut uang | Ditolak; hanya kirim untuk disetujui |
| H8 | HR menyetujui pengumuman tulisannya sendiri | Ditolak |
| H9 | Finance, Kepala Toko, karyawan mengirim pengumuman darurat | Ditolak |
| H10 | Selain Pemilik dan GM membuka Kesehatan Mesin, Riwayat Error, Jejak Perubahan dari menu | Ditolak |
| H11 | Orang membuka riwayat baris yang barisnya tidak berhak ia lihat | Ditolak |
| H12 | Jejak perubahan gaji dibuka oleh yang tidak berhak melihat gaji | Nilai tetap tertutup |
| H13 | Mengubah atau menghapus riwayat error, jejak, riwayat pengajuan | Ditolak untuk semua, termasuk Pemilik |
| H14 | Mengubah pengaturan yang bukan haknya; menyetujui usulannya sendiri | Ditolak |
| H15 | Lihat sebagai menandai pengumuman terbaca atau memutuskan pengajuan | Ditolak |
| H16 | Memanggil alat tempat uji (jam uji, ganti akun contoh) di sistem asli | Ditolak; pintunya tidak ada |
| H17 | Tamu uji memakai jam uji, mengembalikan data, atau membuat tamu lain | Ditolak |
| H18 | Mesin, pengaturan, atau jenis tanda baru tanpa baris di daftarnya | Mesin pengaman gagal |
| H19 | Satu permintaan yang menyetujui banyak pengajuan sekaligus | Ditolak; hanya satu pengajuan per keputusan |

---

## 13. Pertanyaan dan jawaban

Diajukan di percakapan 13 Oktober 2026 (KER-13, 14).

Jawaban pemilik 13 Oktober 2026: **B1 "ok", B2 "ikuti saran", B3 "ok", B4
s.d. B11 "ok"**: semuanya sesuai saran.

1. **B1:** satu per satu, tanpa "Setujui semua", dengan tombol Berikutnya.
   PRI-40 butir 1.
2. **B2:** pengingat tugas satu jendela per jenis urusan; pengumuman dan
   pengingat pribadi tetap per butir. TAM-25 butir 4 (pelapis TAM-22 butir 4;
   TAM-22 butir 3 "tidak ada jendela ringkasan seluruh antrean" tetap).
3. **B3:** akun tamu uji, berakhir sendiri 7 hari, hanya data contoh. SIS-47.
4. **B4:** menu Kantor › Pengumuman; Panduan Karyawan dan Apa yang baru di
   4B. `00-peta-modul.md`.
5. **B5:** ralat dan tarik pengumuman. PRI-40 butir 2.
6. **B6:** perlu perhatian hilang sendiri, pemberitahuan 90 hari. TAM-25
   butir 2 dan 3, PRI-40 butir 4.
7. **B7:** "Sudah ditangani". TAM-23 butir 6.
8. **B8:** pengajuan orang nonaktif tetap diputuskan orang. PRI-40 butir 3.
9. **B9:** jam uji dan Kembalikan data contoh. SIS-47 butir 3.
10. **B10:** tempat uji tetap ada, rilis di luar jam ramai, "Apa yang baru"
    ditulis saat rilis. SIS-47 butir 1 dan 4.
11. **B11:** jejak tidak dibuang, riwayat mesin 12 bulan. PRI-40 butir 4.

---

## 14. Daftar periksa (peta jalan Tahap 4)

- [x] Tidak melanggar WAJ-01 s.d. 12 (tidak ada nama jabatan di aturan mesin;
      semua tindakan tercatat; jejak tidak dihapus).
- [x] Setiap layar memenuhi TAM-01 s.d. 25 (jendela error, langkah bertahap,
      tombol 3 detik untuk yang berakibat, jalan keluar terlihat).
- [x] Rancangan data memenuhi PRI-01 s.d. 40 (perusahaan, tanggal berlaku,
      tanpa hapus, indeks pencarian, mesin berpenjaga).
- [x] Setiap aturan bisnis di spec ada di buku aturan dengan nomor (PRI-40,
      TAM-25, TAM-23 butir 6, SIS-47 ditambah 13 Oktober 2026).
- [x] Kejadian di lapangan dan jalan keluar terisi.
- [x] Tiap layar menyebut ukuran utamanya, beda jabatan dicatat, dan bentuk
      yang belum ada komponennya disebut (akhir bagian 3).
- [x] Perhitungan uang punya contoh angka: bagian ini tidak menghitung uang;
      waktu punya contoh (bagian 12).
