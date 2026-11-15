# Prinsip Rancangan

Berlaku untuk semua modul. Wajib dibaca sebelum menulis spec atau merancang tabel.

Aturan tampilan ada di `00-pola-baku-tampilan.md`. File ini berisi prinsip tentang
data dan alur, yang memengaruhi rancangan database.

Semua prinsip di bawah disetujui pemilik pada 11 Oktober 2026.
Usulan yang belum disetujui tidak ditulis di sini; lihat `docs/work/backlog/`.

## Waktu

**PRI-01. Semua jam diambil dari server, bukan dari jam handphone atau PC pemakai.**
Berlaku untuk absen, foto, pengajuan, dan persetujuan. Satu zona waktu: WIB.
*Kenapa:* jam perangkat bisa salah atau diubah, sehingga jam absen dan jam foto
tidak bisa dipercaya.

## Jejak data

**PRI-02. Data uang dan data kehadiran tidak pernah dihapus.**
Yang tersedia adalah "batalkan", dengan alasan yang wajib diisi. Setiap perubahan
mencatat siapa, kapan, dari nilai apa menjadi nilai apa.
*Kenapa:* supaya setiap angka bisa ditelusuri, dan tidak ada data yang hilang
tanpa jejak.

## Pembatalan

**PRI-03. Setiap pembatalan punya aturan tertulis** di buku aturan modulnya: siapa
yang boleh membatalkan, sampai kapan, dan apa akibatnya pada data lain.

**PRI-04. Setelah periode gaji ditutup atau uang sudah dibayar, yang salah tidak
dibatalkan, tetapi dikoreksi di periode berikutnya.**
*Kenapa:* membatalkan sesuatu yang sudah masuk gaji akan mengubah gaji yang sudah
dibayar, atau meninggalkan turunannya (upah ritase, kas keluar) tanpa induk.

## Pekerjaan yang macet

**PRI-05. Pekerjaan yang macet karena menunggu satu orang bisa diambil alih** oleh
atasannya atau pemilik, dan pengambilalihannya tercatat.
*Kenapa:* alur tidak boleh berhenti total karena satu orang tidak masuk atau
sudah keluar.

## Kejadian di lapangan

**PRI-06. Daftar "kejadian di lapangan" di setiap spec dijadikan daftar tes**, dan
daftar periksa saat pemilik mencoba di tempat uji.
*Kenapa:* kejadian yang sudah dibahas tetapi tidak pernah dicoba sama saja dengan
tidak dibahas.

## Terlambat mengajukan

**PRI-07. Sistem mengingatkan sebelum batas waktu, dan sedapat mungkin menawarkan
sendiri.** Contoh: absen pulang melewati jam kerja, sistem langsung bertanya
"Apakah ini lembur?". Pengingat menyebut batas waktunya dan akibat kalau terlewat.

**PRI-08. Setiap jenis pengajuan punya batas waktu dan akibat terlewat yang (dilapisi PRI-42)
tertulis** di buku aturan modulnya. Akibatnya salah satu dari dua ini, ditentukan
pemilik per jenis pengajuan:

- **Pengajuan terlambat**: masih bisa diajukan lewat jalur tersendiri, wajib
  mengisi alasan, butuh persetujuan, tercatat, dan dibayar di periode berikutnya.
- **Hangus**: tidak bisa diajukan lagi lewat sistem.

Tidak ada jenis pengajuan yang akibatnya tidak tertulis.

**PRI-09. Klaim lembur hangus setelah batas waktunya.** Batasnya 3 hari setelah
tanggal lembur, sama seperti di sistem lama. Setelah hangus, sistem tidak
menyediakan jalur pengajuan terlambat untuk lembur.
*Kenapa (keputusan pemilik, 11 Oktober 2026):* lembur yang terlewat dibicarakan
langsung secara pribadi antara pemilik dan karyawan, di luar sistem.

Karena hangus tidak punya jalan kembali di sistem, pemberitahuannya harus jelas:
karyawan diingatkan sebelum batas waktu (PRI-07), dan saat hangus sistem
memberitahu apa yang hangus dan kepada siapa harus bicara.

Pengecualian batas klaim lembur yang pernah berlaku di sistem lama (Agustus sampai
September 2026) hanya keadaan sementara, menurut pemilik. Tidak dibawa ke v3.

Yang masih digali di Bab 2 (Kehadiran):

- Batas waktu dan akibat terlewat untuk jenis pengajuan selain lembur.
- Hitungan berapa kali seseorang terlambat mengajukan, yang menurut pemilik sudah
  ada di bagian absen sistem lama.

## Kecepatan

Diminta pemilik pada 11 Oktober 2026: sistem tidak boleh terasa lambat saat
memuat data atau berpindah halaman. Kecepatan dirancang sejak awal, bukan
diperbaiki setelah lambat.

**PRI-10. Daftar tidak pernah memuat semua data sekaligus.** Setiap daftar dibagi
per halaman (pagination). Mencari, menyaring, dan mengurutkan dikerjakan di
server, lalu hanya halaman yang diminta yang dikirim ke layar.
*Kenapa:* daftar yang hari ini 200 baris akan menjadi 20.000 baris dua tahun lagi.

**PRI-11. Ambil hanya yang dipakai.** Hanya kolom yang ditampilkan yang diambil.
Data tidak diambil satu per satu di dalam perulangan; ambil sekaligus dalam satu
permintaan.
Yang dimuat otomatis hanya periode yang sedang berjalan. Data periode lama
(contoh: bulan lalu) baru dimuat setelah pemakai memilih periodenya. Foto di dalam daftar memakai ukuran kecil, dan baru dimuat saat
terlihat di layar.

**PRI-12. Hitungan berat dikerjakan di server, bukan di layar pemakai.** Rekap
gaji, rekap absen, dan laporan dihitung di server; layar hanya menampilkan
hasilnya. Hasil periode yang sudah ditutup disimpan, tidak dihitung ulang setiap
kali halaman dibuka.
*Kenapa:* di sistem lama, halaman gaji bulanan mengambil data mentah lalu
menghitungnya di layar. Handphone karyawan jauh lebih lemah daripada server.

**PRI-13. Pindah halaman harus terasa langsung.** Kerangka halaman tampil lebih
dulu, isinya menyusul, dengan tanda sedang memuat di bagian yang belum siap. Layar
tidak boleh kosong atau membeku. Halaman yang baru saja dibuka tidak dimuat ulang
dari nol saat pemakai kembali.

**PRI-14. Setiap tabel dirancang bersama cara mencarinya.** Kolom yang dipakai
untuk mencari, menyaring, atau mengurutkan diberi indeks (daftar isi di database)
sejak tabel dibuat.

**PRI-15. Kecepatan diukur dengan data sebanyak keadaan nyata.** Tempat uji diisi
data contoh setara minimal dua tahun pemakaian, dan diukur dari handphone dengan
sinyal seluler, bukan dari PC dengan wifi.
*Kenapa:* hampir semua halaman cepat saat datanya masih sedikit. Lambatnya baru
terlihat setelah berbulan-bulan dipakai, ketika memperbaikinya sudah mahal.

Sasaran awal (angka dari Claude, boleh diubah pemilik setelah dicoba):

| Yang diukur | Sasaran |
|---|---|
| Pindah halaman sampai kerangka tampil | di bawah 1 detik |
| Isi halaman tampil lengkap | di bawah 2 detik |
| Menyimpan atau mengirim formulir | di bawah 2 detik, di luar unggah foto |

Halaman yang melewati sasaran belum dianggap selesai.

## Orang, tempat, dan hari kerja

**PRI-16. Orang, jabatan, dan pekerjaan hari itu adalah tiga hal terpisah.**
Jabatan menentukan tugas pokok dan hak akses. Pekerjaan hari itu dicatat per
kejadian, dan boleh berbeda dari jabatannya.
Contoh: staff toko ikut bongkaran, atau menjadi kenek saat hari liburnya.

**PRI-17. Satu catatan "hari kerja" per orang per tanggal.** Isinya: bekerja di
mana, jam kerja yang berlaku hari itu, absennya, izin atau sakit, dan lemburnya.
Telat dan lembur dihitung dari jam kerja di catatan ini. Gaji hanya membaca dari
catatan ini.

- Jam kerja adalah milik **tempat** (cabang), bukan milik jabatan atau orang.
  Staff toko di cabang A masuk jam 9, di cabang B masuk jam 8.
- Tempat bekerja hari itu diketahui dari **QR absen**: tiap QR menandakan masuk di
  mana dan keluar di mana.
- Jam kerja hari itu mengikuti cabang tempat ia **absen masuk**, dan berlaku
  untuk seluruh hari itu: telat maupun lembur. Karena itu, orang yang back up ke
  cabang lain otomatis dinilai dengan jam kerja cabang tempat ia absen masuk,
  bukan cabang asalnya.
- Kalau ia ditugaskan di satu cabang tetapi absen masuk di cabang lain, ia tetap
  dinilai dengan jam kerja cabang tempat ia absen. Itu tanggungannya sendiri
  (keputusan pemilik, 11 Oktober 2026).
- Di cabang dengan lebih dari satu shift, shift tiap orang ditetapkan lebih dulu
  dan tidak pernah ditebak dari jam datang. Rinciannya di Bab 2.

*Kenapa:* di sistem lama jadwal disimpan di 5 tempat, dan back up ke cabang dengan
jam operasional berbeda membuat hitungan gaji membingungkan.

**PRI-18. Perlakuan kehadiran adalah pengaturan per jabatan**, bukan pengecualian
di kode: kena denda telat atau tidak, dapat lembur atau tidak, liburnya tetap atau
tidak tetap.
Contoh: kepala gudang punya absen, tidak kena telat, tidak ada lembur, dan
liburnya tidak tetap.

## Upah, bonus, dan periode

**PRI-19. Satu buku catatan upah untuk semua jenis bayaran.** Tiap baris: siapa,
pekerjaan apa, tanggal, banyaknya (hari, trip, kg, jam), tarif yang berlaku, dan
nominal. Jenis pekerjaan menentukan satuannya. Jadwal bayar (mingguan atau
bulanan) terpisah dari jenis pekerjaan.
Rinciannya di `docs/work/backlog/2026-10-11-jenis-upah-dan-jadwal-bayar.md`.

**PRI-20. Bonus adalah daftar komponen.** Tiap komponen punya syarat, nominal, dan
tanggal berlaku, lalu dipasangkan ke jabatan. Komponen yang sama dibuat sekali dan
dipakai beberapa jabatan.

**PRI-21. Setiap angka di slip bisa dijelaskan.** Karyawan bisa membuka rincian
tiap angka, termasuk denda dan potongan: dari kejadian apa, tanggal berapa, dan
aturan mana.
*Kenapa:* supaya karyawan tidak perlu bertanya, dan salah hitung cepat ketahuan.

**PRI-22. Satu cara menentukan periode**, dipakai semua modul: mingguan dan
bulanan, tanggal mulai dan akhir, dan status terbuka atau ditutup.
Minggu gaji driver di sistem lama: Jumat sampai Kamis.

**PRI-34. Mesin periode** (Tahap 3D, 13 Oktober 2026; jenis: pelapis atas PRI-22).

1. Daftar periode milik Gaji dan **dibuat server sendiri** jauh sebelum
   waktunya: periode bulanan 26–25 (GAJ-01) dan minggu upah Jumat–Kamis
   (DRV-19). Tidak ada yang mengetik tanggal periode.
2. Tiap periode menyimpan jadwalnya (akhir masa keberatan, batas tutup,
   tanggal bayar), **disalin dari pengaturan saat periode dibuat**. Mengubah
   pengaturan jadwal hanya mengenai periode yang belum mulai.
3. **Status periode dibaca dari slipnya**, tidak diubah tangan: Berjalan →
   Menunggu ditutup → Ditutup (semua slip ditutup) → Lunas (semua slip
   dibayar). Slip yang tertahan (GAJ-43) ditampilkan sebagai penyebabnya.
4. Semua modul menanyakan "tanggal ini masuk periode mana" ke satu tempat ini.
5. **Baris upah masuk periode menurut tanggal kejadiannya.** Slip mingguan yang
   melewati tanggal 26 tetap utuh; di "Pendapatan Saya" (DRV-80) tiap barisnya
   ikut periode tanggal kejadiannya.
6. Ada dua jenis minggu dan namanya tidak boleh tertukar: **minggu upah**
   Jumat–Kamis (DRV-19) dan **minggu jadwal** Senin–Minggu (giliran shift
   KEH-05, tugas mingguan KIN-28).
7. Bulan laporan keuangan (bulan kalender, KEU-109) bukan periode; ia punya
   tutup bulannya sendiri (KEU-112).

*Kenapa:* di sistem lama hitungan minggu Jumat–Kamis ditulis lima kali. Satu
mesin berarti satu tempat yang dites.

## Pengajuan

**PRI-23. Satu jalur pengajuan untuk semua jenis** (izin, sakit, lembur, klaim
bonus, pengajuan terlambat): diajukan, diperiksa, disetujui atau ditolak dengan
alasan, lalu tercatat.

Yang disatukan adalah cara kerjanya, bukan hak lihatnya. Supaya aman:

- Tiap jenis pengajuan punya penyetuju sendiri dan daftar siapa yang boleh
  melihatnya. Menyetujui izin tidak berarti boleh melihat klaim bonus.
- Lampiran yang bersifat pribadi, seperti surat sakit, hanya bisa dilihat pengaju,
  penyetujunya, HRD, dan pemilik.
- Tidak ada yang bisa menyetujui pengajuannya sendiri.
- Tiap jenis pengajuan punya tesnya sendiri, karena kesalahan di jalur ini
  mengenai semua jenis sekaligus.

**PRI-37. Cara kerja Mesin Pengajuan** (keputusan pemilik 13 Oktober 2026,
Tahap 3E; jenis: pelapis atas PRI-23). Rancangan lengkap:
`../work/specs/2026-10-13-pengajuan-dan-laporan-desain.md`.

1. **Status sama untuk semua jenis:** Menunggu → (Diperiksa, hanya jenis yang
   punya pemeriksa, misalnya kasbon) → Disetujui atau Ditolak. Ditambah
   Dibatalkan (ditarik pengaju, atau pembatalan yang disahkan), Dicabut
   (persetujuan ditarik dengan alasan), dan Hangus (lewat batas waktu). Tidak
   ada yang dihapus (PRI-02).
2. **Tiap jenis didaftarkan sebagai data:** penyetuju, pemeriksa, pelihat
   tambahan, batas waktu dan akibatnya, lampiran wajib atau tidak, tertutup
   atau tidak (tabel "Hak lihat pengajuan" di `00-peta-modul.md`).
3. **Satu penyetuju cukup;** yang lebih dulu memutuskan, keputusannya berlaku.
   Pengaju yang termasuk penyetuju tidak bisa memutuskan miliknya; diputuskan
   penyetuju lain, atau naik ke Pemilik atau GM.
4. **Tidak pernah disetujui otomatis.** Pengajuan yang menunggu masuk pengingat
   berantai penyetujunya sekali sehari sampai diputuskan (TAM-22). Setelah
   **2 hari** belum diputuskan, ikut tampil di "perlu perhatian" Pemilik dan
   GM. Angka 2 hari adalah pengaturan.
5. **Tidak ada status "dikembalikan".** Pengajuan yang kurang lengkap ditolak
   dengan alasan; pengaju menekan **"Ajukan ulang"** dan isian lamanya terisi
   otomatis. Batas waktu jenisnya tetap berjalan.
6. Karyawan mengajukan lewat satu **Pengajuan Saya**; kantor memutuskan di satu
   kotak **Persetujuan** (3C). Pedoman lapor tidak menambah tahap (KAR-79).

*Kenapa:* satu jalan untuk semua jenis, tanpa pengajuan yang menggantung di
tengah. Setuju otomatis berarti ada izin yang lolos tanpa dibaca; dibiarkan
berarti karyawan menunggu tanpa kepastian.

## Hak lihat dan pengingat

**PRI-24. Data gaji hanya bisa dilihat pemiliknya sendiri, HRD, dan pemilik
perusahaan.** Jabatan lain tidak bisa melihat gaji orang lain, kecuali pemilik
menetapkan lain di buku aturan modul Gaji.

Pengecualian: **gaji pemilik perusahaan hanya bisa dilihat para pemilik**, tidak
oleh HRD (keputusan pemilik, 11 Oktober 2026; lihat KAR-59). Jabatan GM haknya
setara pemilik dan ikut melihatnya (KAR-67).

**PRI-25. Pengingat disampaikan lewat aplikasi.** WhatsApp otomatis tidak dipakai
pada tahap awal.
Rencana pemilik: v3 dibuat berbasis web yang bisa dipasang di handphone seperti
aplikasi, sehingga bisa mengirim notifikasi. Notifikasi dikerjakan di tahap akhir,
tetapi sejak awal web dibuat supaya bisa dipasang.

## Pengecualian

**PRI-26. Aturan dicari dari yang paling khusus:** orang, lalu jabatan, lalu
cabang, lalu aturan umum. Yang paling khusus yang dipakai.

Pengecualian per orang boleh ada, tetapi **sebagai pilihan terakhir**. Pemilik
sebisa mungkin tidak mengecualikan orang secara khusus; coba dulu apakah
kebutuhannya bisa dijawab dengan pengaturan cabang atau jabatan.

Kalau memang perlu:

- Pengecualian disimpan sebagai data, bukan di kode. Tiap pengecualian mencatat:
  siapa, aturan mana, nilai penggantinya, berlaku dari tanggal berapa sampai
  kapan, alasannya, dan siapa yang menyetujui.
- Ada satu halaman "Daftar Pengecualian" yang menampilkan semua pengecualian yang
  sedang berlaku.
- Pengecualian tanpa tanggal akhir ditinjau berkala; sistem mengingatkan pemilik.

*Kenapa:* kejadian khusus memang ada, tetapi pengecualian yang tersembunyi membuat
tidak ada yang ingat siapa dikecualikan dari apa.

**PRI-38. Peninjauan Daftar Pengecualian** (keputusan pemilik 13 Oktober 2026,
Tahap 3E; jenis: pelapis atas PRI-26).

1. Pengecualian **tanpa tanggal akhir** ditinjau **setiap 3 bulan**: Pemilik dan
   GM mendapat pengingat berantai (TAM-22) "Pengecualian ini masih perlu?"
   dengan dua tombol, **Masih perlu** (tercatat, ditanya lagi 3 bulan
   kemudian) atau **Hentikan** (berakhir hari itu, tercatat).
2. Pengecualian **bertanggal akhir** diingatkan **H-7** ke Pemilik, GM, dan
   pengisinya, supaya diperpanjang atau dibiarkan berakhir dengan sadar.
3. Hanya aturan yang ditandai "boleh dikecualikan" di daftar pengaturan yang
   bisa dipilih. Pengisi dan penyetuju mengikuti KAR-73.
4. Angka 3 bulan dan 7 hari adalah pengaturan.

*Kenapa:* supaya tidak ada pengecualian yang terlupa bertahun-tahun.

## Cadangan data

**PRI-27. Sistem tidak boleh dipakai untuk data asli sebelum punya cadangan
otomatis.** Salinan seluruh database dibuat otomatis setiap hari dan disimpan di
tempat yang terpisah dari servernya. Secara berkala salinan itu dicoba dipulihkan
ke tempat uji, untuk memastikan benar-benar bisa dipakai.
Cara memasangnya ditetapkan di SIS-42 (`00-gambaran-sistem.md`).
*Kenapa:* data gaji dan absen tidak bisa dibuat ulang kalau hilang.

## Uang

**PRI-28. Semua nominal rupiah disimpan sebagai bilangan bulat rupiah, tanpa
pecahan.** Perhitungan uang tidak boleh memakai angka pecahan biasa yang bisa
meleset satu atau dua rupiah. Kalau sebuah hitungan menghasilkan pecahan (contoh:
upah borongan dibagi beberapa orang), cara membulatkannya dan ke mana sisa
pembagiannya ditulis di buku aturan modulnya.
*Kenapa:* selisih satu rupiah per baris menjadi selisih yang tidak bisa dijelaskan
di laporan, dan setiap angka harus bisa dijelaskan (PRI-21).
Sumber: aturan yang sama di project kasir.

## Papan perubahan aturan

**PRI-29. Setiap perubahan aturan yang menyangkut karyawan diumumkan di satu papan
yang bisa dibaca karyawan.**

- Papan berisi: aturan apa yang berubah, sebelumnya bagaimana, sekarang bagaimana,
  mulai berlaku tanggal berapa, dan harus bertanya ke siapa. Ditulis dalam bahasa
  sehari-hari, bukan bahasa sistem.
- Perubahan yang menyangkut uang atau akibat bagi karyawan diumumkan **sebelum**
  berlaku, tidak pada hari yang sama dan tidak berlaku mundur (WAJ-07).
- Hanya tampil untuk karyawan yang terkena. Aturan khusus driver tidak ditampilkan
  ke kasir.
- Karyawan menandai "sudah saya baca". Pemilik bisa melihat siapa yang belum
  membaca.
- Papan menyimpan riwayat: aturan lama tetap bisa dilihat beserta masa berlakunya.

Papan ini berbeda dari changelog (TAM-20). Changelog mencatat perubahan pada
sistem. Papan ini mencatat perubahan pada aturan perusahaan.

Aturan dan SOP yang lahir dari rapat diumumkan di papan ini, bukan di Catatan
Rapat (KIN-46).

*Kenapa (permintaan pemilik, 11 Oktober 2026):* sistem ini menyangkut orang
banyak. Aturan yang berubah tanpa diumumkan terasa tidak adil, walaupun isinya benar.

**PRI-35. Cara kerja Papan Perubahan Aturan** (keputusan pemilik 13 Oktober 2026,
Tahap 3D; jenis: pelapis atas PRI-29).

1. **Penulis:** HR, Pemilik, dan GM. Pengumuman yang menyangkut **uang** (tarif,
   denda, potongan, gaji) baru tampil ke karyawan setelah disetujui Pemilik
   atau GM; yang lain boleh langsung diterbitkan HR.
2. **Wajib saat pengaturan diubah.** Setiap kali pengaturan yang menyangkut
   karyawan disimpan, layar langsung menyiapkan draf pengumuman ("sebelumnya,
   sekarang, mulai berlaku"). Perubahan baru tersimpan kalau pengumumannya
   diisi, atau ditandai "tidak perlu diumumkan" dengan alasan.
3. **Sasaran diusulkan sistem** dari pengaturan yang diubah (tarif rute: driver
   dan kenek; jam kerja cabang: orang di cabang itu); penulis boleh
   menyesuaikan. Hanya orang terkait yang melihatnya.
4. **Dua tanggal wajib:** jadwal terbit (boleh disiapkan sekarang dan terbit
   otomatis nanti) dan tanggal berlaku. Jarak paling sedikit **7 hari** untuk
   perubahan yang merugikan karyawan atau mengubah cara hitung, dan **1 hari**
   untuk perubahan yang murni menguntungkan karyawan. Tidak pernah berlaku di
   hari terbitnya. Kedua angka adalah pengaturan.
5. **Belum dibaca:** pengumuman masuk pengingat berantai (TAM-22) dan tetap di
   paling atas Beranda sampai ditekan "Sudah saya baca". Absen dan pekerjaan
   lain tidak dikunci. Pemilik dan HR melihat siapa yang belum membaca.

Hari tutup karena kejadian (KEH-79) bukan perubahan aturan; pemberitahuannya
lewat pengumuman darurat (PRI-36).

**PRI-36. Pengumuman darurat** (permintaan pemilik 13 Oktober 2026, Tahap 3D).
Untuk kejadian mendesak, bukan perubahan aturan. Contohnya "Toko Singaparna tutup
hari ini karena banjir" atau "Sistem kasir mati, catat di kertas".

1. Dikirim Pemilik, GM, atau HR, ke semua orang atau cabang dan jabatan tertentu.
2. Jendelanya langsung muncul saat login **dan** di layar mana pun yang sedang
   dibuka, tanpa menghapus isian yang sedang diketik (TAM-16). Tombol "Sudah
   saya baca" baru aktif setelah **5 detik**.
3. Muncul sekali per orang, lalu tersimpan di daftar pengumuman. Ada masa
   tayang, bawaannya hari itu saja. Pengirim melihat siapa yang sudah membaca.
4. Tidak terikat jarak 7 hari PRI-35, karena isinya kejadian, bukan aturan.

## Bisa tumbuh

**PRI-30. Sistem dirancang supaya bisa membesar tanpa ditulis ulang.**

- Tidak ada jumlah yang dianggap tetap: jumlah cabang, karyawan, jabatan, jenis
  pekerjaan, dan modul boleh bertambah tanpa mengubah kode.
- Modul berdiri sendiri dan saling berhubungan hanya lewat data pemiliknya
  (WAJ-03), sehingga modul baru bisa ditambahkan tanpa membongkar modul lama.
- Kecepatan dijaga dengan data yang banyak sejak awal (PRI-10 s.d. 15).
- Hal yang khas perusahaan ditulis sebagai pengaturan, bukan di kode (WAJ-05).

Kemungkinan aplikasi dijual ke perusahaan lain diatur di PRI-31.

*Kenapa (permintaan pemilik, 11 Oktober 2026):* sistem lama tumbuh dengan cara
ditambal. V3 harus bisa tumbuh dengan cara ditambah.

**PRI-31. Sistem dibuat "siap dijual, belum dijual".**

1. Setiap data mencatat milik perusahaan mana, sejak tabel pertama. Saat ini
   isinya satu perusahaan.
2. Tidak ada hal khusus Hammielion di kode. Yang khas perusahaan menjadi
   pengaturan: nama dan logo, periode gaji, minggu gaji, tarif, batas waktu, jenis
   pekerjaan, komponen bonus.
3. Modul bisa dinyalakan atau dimatikan per perusahaan.
4. Hak akses dari daftar, bukan dari kode.

Yang **tidak** dikerjakan: pendaftaran perusahaan baru, tagihan, paket harga, dan
halaman promosi. Pembahasan menjual aplikasi ditunda sampai pemilik menyatakan
aplikasinya sudah sangat stabil.

Akibatnya pada penggalian: tiap aturan sistem lama ditanya, "ini aturan Hammielion
atau aturan umum?". Aturan Hammielion ditulis sebagai pengaturan.

*Kenapa (keputusan pemilik, 11 Oktober 2026):* menambahkan butir 1 sekarang hampir
tanpa biaya; menambahkannya setelah sistem jadi berarti mengubah semua tabel.

## Angka yang menentukan uang

**PRI-32. Setiap angka yang menentukan uang wajib punya layar pengaturan.** Tarif,
batas, persen, dan nominal yang dipakai mesin untuk menghitung uang harus:

1. bisa dilihat dan diubah dari layar oleh jabatan yang berhak, bukan diisi
   langsung ke database;
2. bertanggal berlaku, dan angka lama tidak ditimpa (WAJ-07);
3. meninggalkan jejak: siapa mengubah, kapan, dari berapa ke berapa;
4. punya pemeriksa atau, kalau memang tidak butuh persetujuan, pihak lain yang
   diberi tahu;
5. hanya terbaca oleh jabatan yang berhak.

Mesin pengaman menguji bahwa tidak ada tabel tarif tanpa layar.

**Diperluas (perintah pemilik, 12 Oktober 2026; jenis: pelapis):** kewajiban
punya layar pengaturan berlaku untuk **setiap hal yang dibaca mesin**, bukan hanya
angka uang: batas waktu, jadwal mesin, daftar pilihan (jenis, kategori, kejadian),
siapa boleh apa, dan batas tanda peringatan. Tidak ada pengaturan yang hanya bisa
diubah lewat programmer atau langsung di database. Untuk pengaturan yang tidak
menyangkut uang, butir 1, 3, dan 5 tetap wajib; butir 2 dan 4 wajib kalau
perubahannya memengaruhi hitungan yang sudah lewat. Semua pengaturan terkumpul di
satu menu Pengaturan, dikelompokkan per modul.

*Kenapa (disetujui pemilik, 12 Oktober 2026):* di sistem lama tarif sewa tiga
mobil, yang menentukan sekitar Rp16,6 juta sebulan, diisi langsung ke database:
tanpa layar, tanpa tanggal berlaku, tanpa jejak, dan terbaca semua orang yang
login. Pemilik project tidak tahu angka itu ada. Angka yang tidak terlihat tidak
bisa diawasi.

## Mesin otomatis

**PRI-33. Setiap mesin otomatis punya penjaga.** Mesin otomatis adalah pekerjaan
yang jalan sendiri tanpa ditekan orang: pembuat tagihan, penanda alpha, penggilir
shift, penghitung saldo dan laporan, Cek Modal, penarik data kasir, pengirim
pemberitahuan. Untuk tiap mesin:

1. setiap kali jalan tercatat: kapan, berhasil atau gagal, dan berapa yang
   dikerjakan;
2. kalau gagal **atau tidak jalan pada jadwalnya**, muncul di daftar "perlu
   perhatian" GM pada hari itu juga; tidak ada mesin yang gagal diam-diam;
3. yang terlewat dikejar saat mesin jalan lagi, dan hasilnya tidak dobel walaupun
   mesin dijalankan dua kali;
4. jadwalnya adalah pengaturan yang punya layar (PRI-32);
5. hasil mesin yang menyangkut uang bisa dibuka sampai asal hitungannya, dan
   tidak pernah langsung menjadi uang keluar atau masuk tanpa kejadian nyata;
6. ada satu layar **Kesehatan Mesin** untuk GM dan Owner: daftar semua mesin,
   kapan terakhir jalan, dan hasilnya.

Mesin pengaman (WAJ-06) menguji tiap mesin otomatis: jalan dua kali tidak dobel,
dan kegagalan memunculkan tanda.

*Kenapa (perintah pemilik, 12 Oktober 2026):* di sistem lama penanda alpha harian
gagal 13 hari berturut-turut tanpa ada yang tahu, mesin biaya tetap tidak mengejar
bulan yang terlewat, dan layar berkata "tiap tanggal 1" padahal mesinnya jalan
tanggal 28. Mesin yang tidak dijaga lebih berbahaya daripada tidak ada mesin,
karena orang mengira pekerjaannya sudah dikerjakan.

**PRI-39. Cara kerja Tarik Data Kasir** (keputusan pemilik 13 Oktober 2026,
Tahap 3F; jenis: pelapis atas SIS-05, SIS-07, SIS-09, dan PRI-33). Rancangan
lengkap dan daftar jenis data: `../work/specs/2026-10-13-tarik-data-kasir-desain.md`.

1. **Satu arah saja: dari kasir ke HRIS.** Tidak ada sambungan dari HRIS ke
   kasir, sekarang maupun kelak. Data yang lahir di HRIS tetapi harus masuk
   kasir (LOG-65, KEU-46, KEU-69) dicatat tangan oleh finance di kasir dari
   daftar di HRIS, lalu ditandai "sudah tercatat di kasir".
2. **Tiap jenis data punya jadwal sendiri**, berupa pengaturan (PRI-32). Isi
   awal: transaksi (termasuk jasa grooming dan baris ongkir beserta
   pengantarnya), settlement per shift, uraian QRIS, dan pelanggan **tiap
   1 menit**; nota supplier, sisa utang supplier versi kasir, piutang toko,
   dan purchase order **tiap 1 jam**; omzet dan harga pokok per hari **tiap
   malam**; nilai stok, barang tidak laku, dan reject **akhir bulan dan
   setelah stok opname**. Ditambah tombol **"Tarik sekarang"**.
3. **Kalau kasir mati atau sambungan putus**, HRIS tetap jalan dengan data
   terakhir dan menulis "data kasir terakhir masuk: jam …". Pekerjaan
   mendesak boleh diketik manual bertanda "manual"; setelah sambungan hidup
   dicocokkan otomatis, dan yang tidak cocok masuk daftar periksa. Gagal
   **lebih dari 15 menit selama jam buka toko** masuk "perlu perhatian" GM
   (15 menit adalah pengaturan). Data yang terlewat dikejar tanpa dobel.
4. **Perubahan di kasir setelah data dipakai HRIS:** data yang sudah
   terkunci (sudah diperiksa finance, sudah tercatat di kasir, atau bulannya
   sudah ditutup) **tidak diubah sendiri**; perubahannya masuk daftar periksa
   pemegang datanya (Kepala Gudang untuk surat jalan, finance untuk nota dan
   omzet, HR untuk bonus grooming dan ongkir yang sudah disahkan atau dibayar) dengan nilai sebelum dan sesudah. Data yang belum terkunci ikut
   diperbarui dengan tanda "berubah dari … menjadi …". Transaksi batal
   ditandai batal, tidak dihapus (PRI-02).
5. **Ditarik sejak hari mulai v3** (KEU-08), ditambah potret keadaan awal
   hari itu (stok, piutang toko, utang supplier) untuk titik awal Cek Modal
   (KEU-94). Selama masa uji berdampingan, ditarik sejak awal masa uji.
   Riwayat sebelum itu tidak ditarik (SIS-29).
6. **Hak:** "Tarik sekarang" untuk Kepala Gudang, finance, GM, dan Owner.
   Unggah file (daftar produk, nota supplier) untuk finance, GM, dan Owner.
   Layar status (terakhir tarik, gagal, "belum dipasangkan") untuk GM dan
   Owner lewat Kesehatan Mesin; finance juga melihat "belum dipasangkan"
   untuk supplier dan toko, HR untuk nama groomer dan pengantar (3G).

*Kenapa:* supaya angka dari kasir tidak diketik dua kali, HRIS tidak ikut
macet saat kasir mati, dan tidak ada angka yang berubah diam-diam. Arah
sebaliknya ditiadakan atas permintaan pemilik ("biar tak pusing"): satu arah
lebih mudah dijaga dan kasir tidak pernah bergantung pada HRIS.

**PRI-40. Pelapis Perlengkapan Bersama** (keputusan pemilik 13 Oktober 2026,
Tahap 4B; jenis: pelapis atas PRI-35, PRI-37, dan PRI-02). Rancangan lengkap:
`../work/specs/2026-10-13-perlengkapan-bersama-spec.md`.

1. **Tidak ada "Setujui semua".** Pengajuan diputuskan satu per satu. Setelah
   memutuskan satu, tombol **Berikutnya** langsung membuka pengajuan
   menunggu berikutnya (pelapis PRI-37).
   *Pengecualian GAJ-85 (13 Oktober 2026):* baris bonus yang lahir dari
   data disahkan per groomer per periode atau per aturan per periode.
2. **Pengumuman yang sudah terbit tidak diubah.** Salah isi: **Ralat**
   (pengumuman baru yang menggantikan; yang lama bertanda "Diralat"; semua
   sasaran membaca lagi). Batal sebelum berlaku: **Tarik** dengan alasan;
   kalau pengumuman lahir dari perubahan pengaturan, menariknya ikut
   membatalkan perubahan itu. Sudah berlaku: dibuat perubahan aturan baru
   (pelapis PRI-35).
3. **Pengajuan milik orang yang dinonaktifkan** tidak dibatalkan mesin;
   tetap menunggu dengan tanda "orangnya nonaktif sejak …" dan diputuskan
   orang, karena hak yang sudah lahir (misalnya lembur) masih bisa masuk slip
   terakhir (pelapis PRI-37).
4. **Masa simpan.** Jejak perubahan tidak pernah dibuang (pelapis PRI-02).
   Pemberitahuan biasa 90 hari; riwayat jalan mesin 12 bulan (ringkasan
   tetap). Angka 90 hari dan 12 bulan adalah pengaturan.

*Kenapa:* satu per satu menjaga keputusan benar-benar dibaca; ralat dan tarik
menjaga setiap aturan yang berlaku pernah diumumkan.

**PRI-41. Pelapis Tarik Data Kasir** (keputusan pemilik 13 Oktober 2026,
Tahap 4C; jenis: pelapis atas PRI-39 dan PRI-04). Rancangan lengkap:
`../work/specs/2026-10-13-tarik-data-kasir-spec.md`.

1. **Perubahan atas data terkunci** (PRI-39 butir 4) diputuskan pemegang datanya
   dengan dua pilihan beralasan: **Terima perubahan** (dibuat baris koreksi
   bertanggal di modul pemakainya, yang lama tetap utuh) atau **Biarkan**
   (angka lama tetap dipakai). Keputusan tidak dicabut.
2. **Satu nama kasir dipasangkan ke satu orang** (atau supplier, toko, cabang).
   Baris yang namanya belum dipasangkan ditahan dan tidak dihitung; sesudah
   dipasangkan dihitung dengan tanggal aslinya. Pembetulan pasangan
   memperbarui baris yang belum terkunci dan memasukkan yang terkunci ke
   daftar periksa.
3. **Ketikan manual wajib memuat nomor struk atau nota kasir** beserta
   cabangnya, sebagai kunci pencocok. Yang tidak cocok setelah 2 hari (angka
   pengaturan) masuk daftar periksa.
4. **Jam buka** untuk batas gagal 15 menit dibaca dari jam kerja cabang di
   Kehadiran; hari tutup tidak dihitung. Gagal di luar jam buka dikejar
   tanpa membangunkan GM, dan hitungan dimulai dari jam buka pertama berikutnya.
5. **Menyalakan atau mematikan sambungan** satu jenis data hanya oleh Owner
   dan GM, dengan alasan, dan **wajib diumumkan paling lambat 7 hari sebelum
   berlaku** (pelapis PRI-35). Mematikan boleh kapan saja; data yang sudah
   masuk tetap.
6. **Potret keadaan awal** diambil sekali, dengan tombol ditahan 3 detik, saat
   tarikan terakhir tidak lebih tua dari 15 menit; kesalahan dibetulkan lewat
   baris penyesuaian di Keuangan (KEU-94).
7. Isi data kasir mentah hanya dilihat Finance, GM, dan Owner; Kepala Gudang
   hanya status dan Tarik sekarang; HR hanya nama groomer dan pengantar.

*Kenapa:* supaya data dari kasir yang berubah tidak mengubah uang yang sudah
diperiksa diam-diam, dan supaya perpindahan dari ketik ke sambungan tidak
mengejutkan orang yang selama ini mengetik.

**PRI-42. Tiga akibat terlewat dan cara menulis batas waktu** (keputusan pemilik
14 Oktober 2026, Tahap 4J-1; jenis: pelapis atas PRI-08). Daftar lengkap 24 jenis:
`../work/specs/2026-10-14-daftar-lintas-modul.md` bab 1.

1. Akibat terlewat hanya tiga: **Hangus** (tidak bisa diajukan lagi; bila
   pengajuannya belum ada, tombolnya hilang tanpa catatan; bila sudah ada,
   statusnya Hangus; "gugur" sama dengan Hangus), **Pengajuan terlambat**
   (hanya Penjelasan untuk lupa absen, KEH-60), dan **Tidak berbatas** (tidak
   pernah Hangus, menunggu sampai diputuskan dengan pengingat berantai).
2. Batas ditulis dalam **hari kalender**, kecuali tertulis "hari kerja"; selalu
   berakhir pukul 23.59; **titik awalnya selalu disebut** (sejak diberi tahu,
   sesudah tanggal kejadian, H-N, atau sampai slip ditutup).
3. Belum diputuskan bukan akibat terlewat; tidak pernah disetujui otomatis
   (PRI-37 butir 4).
4. "Minta kasbon dibatalkan" bukan jenis sendiri: memakai tombol **Minta
   dibatalkan** bawaan Mesin Pengajuan (DRV-72).
5. Batas "uang belum saya terima" sengaja berbeda: slip 7 hari (transfer bisa
   tertunda bank), upah bongkaran dan uang kasbon 3 hari (tunai diserahkan
   langsung).

*Kenapa:* spec modul memakai istilah akibat yang berbeda-beda ("tombol hilang",
"gugur", "tetap menunggu"); satu kosakata mencegah pembangun membuat
mekanisme ganda.

**PRI-43. Pemberitahuan: peta istilah, dua macam antrean, satu jendela per jenis urusan** (keputusan pemilik 14 Oktober 2026, Tahap 4J-2, jawaban "ok" = setuju saran Q1 s.d. Q4; jenis: pelapis atas TAM-24 dan TAM-25). Daftar lengkap: `../work/specs/2026-10-14-daftar-lintas-modul.md` bab 2.

1. Kata "Beranda" di spec modul dibaca **lonceng** (disimpan 90 hari); Beranda hanya menampilkan kartu "Kabar terbaru" dari lonceng yang belum dibuka. Pekerjaan yang menunggu tetap di "Perlu perhatian".
2. Antrean ada dua: **berantai** (berulang sampai urusan beres; 76 jenis di bab 2) dan **sekali baca** (kabar pribadi yang mengubah uang, hak, atau jadwal tanpa batas waktu; tidak masuk Perlu perhatian). Sekali baca adalah pelapis atas TAM-24.
3. Semua penahan slip digabung menjadi satu jenis urusan **"Slip tertahan"**; modul lain hanya menyediakan alasan penahan.
4. Butir yang penerimanya kosong, nonaktif, atau cuti lebih dari 2 hari **naik ke Pemilik dan GM** (pola PRI-37).
5. "Tiap pagi/harian" berarti TAM-22 butir 4; beres untuk satu penerima berarti beres untuk semua penerima peran yang sama; pelaku tidak diberi tahu tindakannya sendiri.

*Kenapa:* spec modul memakai istilah berbeda untuk pintu yang sama, dan kabar yang tidak mendesak ikut menjadi jendela berulang sehingga orang menekan OK tanpa membaca.

**PRI-44. Pengaturan: bersasaran, berlaku di tanggal tertentu, satu panjang alasan, mesin berurutan, pengecualian terbatas** (keputusan pemilik 14 Oktober 2026, Tahap 4J-3, jawaban "ok" = setuju saran Q1 s.d. Q4; jenis: pelapis atas PRI-32 dan PRI-26). Daftar lengkap: `../work/specs/2026-10-14-daftar-lintas-modul.md` bab 3.

1. Kerangka Pengaturan (BER-L40, L41) menerima **sasaran** (cabang, jabatan, atau jenis): satu pengaturan boleh punya banyak nilai, tiap sasaran dengan tanggal berlaku dan riwayat sendiri. Pengaturan juga boleh **hanya berlaku mulai tanggal tertentu** (misalnya tanggal 26 untuk angka gaji).
2. Ada satu pengaturan **"Panjang alasan paling sedikit"** (awal 15 huruf) untuk semua layar yang meminta alasan. Yang lebih panjang (keberatan slip, serah terima: 20) tetap pengaturan sendiri dan disebut pengecualiannya.
3. Mesin yang bergantung hasil mesin lain **memeriksa dulu catatan jalan pendahulunya**. Bila belum selesai hari itu, mesin menunggu dan memunculkan tanda di Perlu perhatian GM, tidak jalan dengan data kurang (rantai Kehadiran 04.00–04.30, Gaji 00.10/00.15).
4. Yang boleh dikecualikan per orang hanya tujuh (G1–G7): jam kerja per shift, ambang telat dan pulang cepat, dan lima tanda jabatan (kena telat, dapat lembur, kompensasi libur, libur tetap, wajib absen istirahat). Tanda kehilangan barang, jenis bonus, dan ringkasan pagi tidak.
5. Tiap pengaturan punya satu pemilik; modul lain hanya membaca (toleransi telat milik Kehadiran, masa keberatan potongan milik Gaji, tanggal uang mundur milik Keuangan).

*Kenapa:* angka yang sama ditulis di banyak tempat akan menyimpang suatu hari, dan mesin yang jalan dengan data setengah jadi menandai orang yang sebenarnya masuk sebagai alpha.
