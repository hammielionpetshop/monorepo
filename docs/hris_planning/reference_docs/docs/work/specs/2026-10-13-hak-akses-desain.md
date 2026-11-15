# Hak Akses dan Cara Masuk v3 (Tahap 3B)

Tanggal: 13 Oktober 2026
Status: **ditetapkan 13 Oktober 2026** (jawaban di bagian 6; aturan final di buku Karyawan KAR-69 s.d. 78 dan `../../aturan/00-peta-modul.md`)

Bahan: KAR-31 s.d. 34, 44, 49, 52 s.d. 54, 58, 60, 63, 64, 67; LOG-84; DRV-82;
KEU-118 s.d. 120; KIN-48, 49; GAJ-46; KEH-04, 20, bagian "atasan"; PRI-23, 24, 26;
SIS-36; `../backlog/2026-10-11-mesin-pengaman-hak-akses.md`;
`../backlog/2026-10-11-tempat-uji-per-jabatan.md`; buku Karyawan bagian 6 butir 1.

## 1. Jabatan yang ada

Sistem lama (dibaca 13 Oktober 2026): 11 jabatan dalam 3 departemen.

| Departemen | Jabatan (aktif) |
|---|---|
| Office | Owner (3), Finance (1), Marketing (1), Admin Supervisor (0) |
| Team Gudang | Kepala Gudang (1), Driver (4), Helper (3) |
| Team Toko | Kepala Toko (1), Kasir (6), Pramuniaga (2), Groomer (2) |

Di v3: Owner menjadi **Pemilik** (KAR-59), Helper disebut **kenek**, dan
ditambah jabatan **GM** (KAR-67) dan **HR** yang di sistem lama belum ada
sebagai jabatan. Daftar jabatan tetap data; nama jabatan tidak ada di kode (KAR-58).

## 2. Rancangan (tidak butuh keputusan; menjalankan aturan yang sudah ada)

### 2.1 Bentuk daftar hak akses

1. **Tindakan bernama.** Setiap pintu di server adalah satu tindakan bernama,
   misalnya "tutup slip", "lihat slip", "ajukan kasbon", "periksa Laporan
   Kasir". Daftar tindakan ditulis di kode, karena setiap pintu baru wajib
   punya nama tindakan; pintu tanpa nama tindakan = mesin pengaman gagal
   (KAR-63).
2. **Lingkup.** Tiap hak punya lingkup: *diri sendiri*, *cabangnya*,
   *departemennya*, atau *semua*. Contoh: kepala toko "lihat rapor" lingkup
   cabangnya; karyawan "lihat slip" lingkup diri sendiri. Cabang dan
   departemen dibaca dari riwayat penempatan pada tanggal datanya (KAR-56),
   jadi orang yang baru pindah tidak membawa hak ke data cabang lamanya.
3. **Pemberian hak adalah data.** Jabatan mana mendapat tindakan apa dengan
   lingkup apa disimpan sebagai data dan diubah lewat layar "Hak Akses
   Jabatan" (KAR-58). Isi awalnya gabungan LOG-84, DRV-82, KEU-118, KIN-48,
   GAJ-46, dan aturan Kehadiran. Menambah atau mengganti nama jabatan tidak
   mengubah kode (KAR-49).
4. **Menu dibaca dari daftar yang sama** (KAR-49, KIN-48): yang tidak berhak
   tidak melihat menunya. Tombol yang tidak berhak tidak tampil, tetapi
   penjaganya tetap server (SIS-36), bukan tombol.
5. **GM = Pemilik** (KAR-67): jabatan GM mendapat pemberian hak yang sama
   dengan jabatan Pemilik, dari baris yang sama, bukan salinan.
6. **Bawaan tertutup.** Tanpa login tidak ada yang terbuka, kecuali halaman
   masuk, daftar, dan lupa password. Akun yang belum disetujui HR tidak
   melihat apa pun (KAR-60).
7. **Hak berubah langsung berlaku.** Saat jabatan, cabang, atau status aktif
   seseorang berubah, haknya ikut berubah pada saat itu; orang yang
   dinonaktifkan langsung keluar dari semua perangkat.

### 2.2 Batas keras

Tidak bisa diberikan lewat layar mana pun, oleh siapa pun. Dijaga server dan
selalu dicoba mesin pengaman:

1. Mengubah hak, jabatan, atau status aktif dirinya sendiri (KAR-34).
2. Menyetujui, memeriksa, atau memutuskan pengajuan dan isiannya sendiri
   (PRI-23, KEU-120, KIN-49).
3. Melihat gaji jabatan Pemilik dan GM, kecuali jabatan Pemilik dan GM (PRI-24, KAR-67).
4. Mengubah data yang sudah disetujui atau diperiksa; yang ada hanya
   membatalkan dengan alasan (PRI-02, KEU-120).
5. Melakukan apa pun tanpa login.

### 2.3 Mesin pengaman hak akses (WAJ-06, KAR-63)

1. **Kunci jawaban** = daftar hak akses (2.1) ditambah batas keras (2.2).
2. **Cara menguji:** di tempat uji, mesin masuk sebagai akun contoh tiap
   jabatan dan mencoba **setiap tindakan** pada tiga jenis data: milik
   sendiri, milik orang di cabangnya, milik orang di cabang lain. Hasilnya
   dibandingkan dengan kunci jawaban. Satu saja yang lolos padahal tidak
   boleh, atau ditolak padahal boleh, = gagal.
3. **Percobaan tetap** yang selalu ada: menaikkan hak sendiri; melihat gaji
   orang lain; mengubah data yang sudah disetujui; memakai sistem tanpa login;
   ditambah daftar wajib dari buku modul (GAJ bagian 7 butir 10, DRV bagian 7
   butir 11, KEU-120, KIN-49).
4. **Kapan jalan:** setiap perubahan kode dan setiap migrasi; kalau gagal,
   perubahan tidak bisa digabung.
5. **Perubahan di layar Hak Akses Jabatan** diperiksa server saat disimpan:
   yang menabrak batas keras ditolak dengan jendela error (TAM-01). Setiap
   perubahan tercatat (siapa, kapan, sebelum, sesudah) dan pemilik lain
   diberi tahu.

### 2.4 Tempat uji dan Lihat sebagai (KAR-52)

1. Tempat uji terpisah dari database asli, dengan akun contoh per jabatan dan
   data contoh setara dua tahun (backlog tempat uji, PRI-15).
2. Di tempat uji, "Lihat sebagai" bebas dan boleh melakukan tindakan; bisa
   dibuka beberapa jabatan berdampingan untuk mengikuti satu alur.
3. Di sistem asli: hanya Pemilik dan GM, hanya melihat (semua tombol simpan
   dan setuju mati), tanda jelas di layar, tiap pemakaian tercatat. Siapa
   yang dilihat: lihat H6.

### 2.5 Masuk dan sesi

1. Satu orang satu akun (KAR-31); masuk dengan email asli atau akun Google
   (KAR-54); password paling sedikit 8 karakter (KAR-33).
2. Salah password 5 kali berturut-turut: akun terkunci 15 menit, orangnya
   diberi tahu.
3. Tetap masuk di handphone sendiri sampai 30 hari tanpa dipakai. Di PC
   bersama (misalnya PC toko) tersedia pilihan "jangan ingat saya", yang
   keluar saat browser ditutup.
4. Ganti password mengeluarkan akun dari semua perangkat lain.
5. Riwayat masuk (kapan, perangkat apa) bisa dilihat orangnya sendiri, dan
   oleh Pemilik dan GM.

## 3. Pertanyaan untuk pemilik

Diajukan di percakapan 13 Oktober 2026 (KER-13, 14). Jawaban di bagian 6.

- **H1.** Siapa boleh mengubah Hak Akses Jabatan, Pengaturan Jabatan, dan
  Daftar Pengecualian.
- **H2.** Hak titipan per orang: hanya jenis yang bernama, atau umum.
- **H3.** Siapa boleh menempatkan orang di jabatan berhak tinggi.
- **H4.** Hak lihat tiap jenis pengajuan, termasuk kepala toko dan Kepala Gudang.
- **H5.** Cara masuk dan lupa password (buku Karyawan bagian 6 butir 1).
- **H6.** Lihat sebagai di sistem asli: akun contoh atau orang sungguhan (KAR-52).
- **H7.** Jabatan HR dan GM ditambahkan; Admin Supervisor dinonaktifkan.

## 4. Kejadian di lapangan

| Kejadian | Sistem berbuat apa |
|---|---|
| Karyawan dipromosikan menjadi kepala toko | Riwayat penempatan baru bertanggal berlaku; hak kepala toko berlaku sejak tanggal itu, untuk data cabangnya sejak tanggal itu |
| Kepala toko pindah cabang | Hak atas cabang lama berhenti di tanggal pindah; data cabang lama tidak terlihat lagi |
| Orang dinonaktifkan saat sedang masuk di handphone | Langsung keluar dari semua perangkat; percobaan berikutnya ditolak |
| Pemilik salah mencabut hak sebuah jabatan | Diubah lagi di layar yang sama; perubahan dan pembetulannya tercatat |
| Pemilik mencoba memberi hak yang menabrak batas keras | Ditolak dengan jendela error yang menyebut batas mana |
| Karyawan lupa password dan tidak bisa membuka email | Lihat H5 |
| HPnya hilang | Orangnya (dari perangkat lain) atau HR menekan "keluarkan dari semua perangkat"; ganti password |
| Orang asing mendaftar | Tidak melihat apa pun; HR menolak (KAR-60) |
| Developer menambah pintu baru tanpa baris hak | Mesin pengaman gagal; perubahan tidak bisa digabung |
| Akun contoh tempat uji dipakai di sistem asli | Tidak bisa: akun contoh hanya ada di tempat uji |

## 5. Jalan keluar

| Tindakan | Bisa dibalik? | Oleh siapa |
|---|---|---|
| Mengubah Hak Akses Jabatan | Ya, diubah lagi; riwayatnya tetap | Lihat H1 |
| Memberi hak titipan | Dicabut kapan saja, atau berakhir sendiri di tanggal akhirnya | Yang memberi, atau Pemilik dan GM |
| Menyetujui pendaftaran | Penempatan dibetulkan lewat riwayat (KAR-56); akun dinonaktifkan kalau salah orang | HR, Pemilik, GM |
| Kunci karena salah password | Terbuka sendiri setelah 15 menit, atau dibuka HR | HR |
| Lihat sebagai | Keluar kapan saja; tidak ada yang tersimpan | Pemilik dan GM |

## 6. Jawaban pemilik

Putaran 1, 13 Oktober 2026:

1. **H1: sesuai saran.** Hak Akses Jabatan hanya Pemilik dan GM, pemilik lain
   diberi tahu. Pengaturan Jabatan dan Daftar Pengecualian: HR mengisi,
   Pemilik atau GM menyetujui, bertanggal berlaku.
2. **H2: setuju jenis bernama saja**, dan pemilik minta **fitur anti lupa**
   (hak titipan berlaku terbatas). Usulan rinciannya diajukan di putaran 2.
3. **H3: sesuai saran.** Jabatan bertanda "berhak tinggi" (isi awal Pemilik,
   GM, HR, Finance) hanya bisa diisi oleh Pemilik dan GM.
4. **H4: sesuai saran.** Kepala toko dan Kepala Gudang melihat tanggal dan
   status izin, sakit, cuti, dan tukar libur timnya; tanpa alasan dan lampiran;
   tidak memutuskan.
5. **H5: pemilik memilih caranya sendiri.** Tidak memakai Google. Lupa
   password: isi email, nomor HP, dan tanggal lahir; kalau ketiganya benar,
   tulis password baru dan langsung masuk. Salah 3 kali: wajib menghubungi
   GM. Bertabrakan dengan KAR-54 ("email asli atau akun Google"); dikonfirmasi
   di putaran 2 bersama pengamannya.
6. **H6: pemilik ingin melihat tampilan karyawan dan mencoba sendiri, tanpa
   Docker, lebih suka langsung rilis lalu mencoba.** Bersinggungan dengan
   SIS-41 (dua tempat terpisah); dijelaskan dan ditanyakan ulang di putaran 2.
7. **H7: GM dan HR ditambah, Owner menjadi Pemilik, Helper menjadi Kenek,
   Admin Supervisor tidak dibawa.** Keterangan pemilik: di kantor hanya
   **2 orang** yang mengisi 3 tugas (Finance, admin HR, Marketing) dan saling
   menggantikan; **GM merangkap HRD**. Akibatnya ke pemisahan tugas
   (LOG-84, KEU-120, GAJ-46, H1) ditanyakan di putaran 2.

Putaran 2, 13 Oktober 2026 (H2a, H5a, H6a, H7a diajukan di percakapan):

8. **H2a: sesuai saran.** Hak tambahan wajib bertanggal akhir; paling lama
   7 hari (hak lapor sementara) dan 14 hari (gantikan sementara); berakhir
   sendiri 23.59 jam server; pengingat H-1 ke pemberi dan penerima; boleh
   diperpanjang sekali dengan alasan; layar "Hak Tambahan yang Aktif". Izin
   tugas lapangan tidak berakhir sendiri.
9. **H5a: tanpa Google, dengan dua koreksi pemilik.** (a) Pesan salah
   **menyebut data mana yang tidak cocok** (email, nomor HP, atau tanggal
   lahir), bukan pesan umum. (b) Salah 3 kali **tidak mengunci**, tetapi
   **jeda 5 menit** dan diminta menghubungi GM. Pengaman lain sesuai saran:
   GM diberi tahu, kode sekali pakai dari GM berlaku 1 jam, pemberitahuan
   setelah password diganti, semua perangkat lain keluar, penerima laporan
   adalah pengaturan. Claude menyampaikan risikonya: dengan pesan yang
   menyebut data yang salah dan jeda yang hanya 5 menit, orang yang tahu
   email dan HP seseorang bisa menebak tanggal lahirnya pelan-pelan;
   penjaganya adalah pemberitahuan ke GM tiap kali jeda terjadi. Jenis:
   **pengganti** atas KAR-54 (Google tidak dipakai) dan atas butir 2.5
   nomor 2 spec ini (salah password masuk biasa juga jeda 5 menit, bukan
   kunci 15 menit, supaya satu cara untuk keduanya).
10. **H6a: setuju.** Tempat uji = web kedua dengan data contoh; setiap
    perubahan tampil dulu di sana, naik ke sistem asli setelah pemilik
    bilang "rilis". Di sistem asli, Pemilik dan GM boleh "Lihat sebagai"
    orang sungguhan, hanya melihat. Pemilik minta **dibuatkan plan
    tersendiri nanti** (dicatat di `../backlog/2026-10-11-tempat-uji-per-jabatan.md`).
    Jenis: **pelapis** atas KAR-52.
11. **H7a: sesuai saran.** Satu jabatan tambahan per orang; jabatan baru
    **Admin HR** (hak HR tanpa melihat gaji dan slip orang lain); jabatan HR
    lengkap dibiarkan kosong; Finance dan Marketing tidak dirangkap tetap,
    saling menggantikan lewat "gantikan sementara"; tugas yang dikerjakan
    Pemilik atau GM sendiri langsung berlaku dan pemilik lain diberi tahu
    (pelapis H1, mengikuti contoh KEU-119). Siapa memegang Admin HR
    adalah data penempatan, diisi saat daftar ulang (KAR-53), bukan aturan.

Tambahan Claude tanpa keputusan baru (menjalankan H5): karena nomor HP kini
menjadi kunci lupa password, nomor HP dan tanggal lahir wajib diisi saat
mendaftar, dan perubahan nomor HP (KAR-12) diberitahukan ke email orangnya.
