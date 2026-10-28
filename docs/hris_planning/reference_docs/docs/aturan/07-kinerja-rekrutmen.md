# Buku Aturan: Kinerja (Rapor, Bonus Terukur, Penjualan Promo, Tugas, Catatan Rapat)

Status: **ditetapkan 13 Oktober 2026** (perincian 4I disetujui 14 Oktober 2026, KIN-52 s.d. 88, bagian 3.10 s.d. 3.15), kecuali yang tercantum di bagian 6
("Masih terbuka").

Nomor aturan tidak diurutkan ulang, supaya rujukan dari dokumen lain tetap benar.

File ini hanya berisi aturan yang berlaku di v3. Hasil galian sistem lama, hasil
cek database, semua pertanyaan, dan jawaban pemilik disimpan di
`arsip/07-kinerja-rekrutmen-galian.md` (bagian 7A, 7B, dan 7D). Nomor KIN-A dan
KIN-B di arsip itu adalah nomor galian sistem lama, bukan nomor aturan v3. Asal
tiap aturan di bawah tercatat di bagian 7D.3 arsip itu.

**Rekrutmen tidak ada di buku ini.** Pemilik menangguhkannya 12 Oktober 2026;
alur yang diinginkan dicatat di
`../work/backlog/2026-10-12-rekrutmen-ditangguhkan.md`. Nama file ini tetap,
supaya rujukan dari dokumen lain tidak putus.

Di buku ini, "pemilik" dalam urusan hak akses berarti jabatan Pemilik (Owner)
dan **GM**, yang haknya setara (KAR-67).

Uang bonus tidak diatur di sini. Buku Bonus, halaman Persetujuan Bonus, dan
cara bonus masuk slip milik modul Gaji (GAJ-24 s.d. 28, GAJ-50). Buku ini
mengatur **dari mana bonus itu lahir**: ukuran, syarat, dan buktinya.

## 1. Modul ini mengurus apa

Mengukur kerja tiap karyawan dari data yang sudah tercatat, tanpa nilai yang
diketik orang. Isinya:

- **Rapor**: nilai persen tiap orang tiap periode, dari ukuran seperti
  kehadiran, tepat waktu, dan tugas. Rapor tidak membawa uang.
- **Bonus Terukur**: aturan "kalau ukuran X memenuhi syarat dalam rentang
  tertentu, dapat nominal Y", dinilai mesin dari data.
- **Penjualan Promo**: produk dan target promo per cabang, laporan penjualan
  dari karyawan toko, dan bonus per pcs.
- **Tugas**: tugas rutin, tugas sekali jalan, dan kerapian display; laporan
  berfoto yang dihitung dan dijaga mesin.
- **Catatan Rapat**: arsip hasil rapat dan tugas tindak lanjutnya.

Modul ini membaca kehadiran, Laporan Kasir, dan data kasir, dan tidak
mengubahnya. Uang yang lahir dari sini dicatat ke Buku Bonus.

## 2. Data yang dimiliki modul ini

| Data | Isinya |
|---|---|
| Daftar ukuran | Ukuran apa saja yang bisa dipakai, dan dari modul mana angkanya dibaca |
| Kriteria rapor | Per jabatan per cabang: ukuran dan bobotnya; bertanggal berlaku |
| Target omzet cabang | Satu angka per cabang per periode; bertanggal berlaku |
| Rapor | Per orang per periode: tahap (Perkiraan atau Ditetapkan), nilai tiap kriteria, angka mentahnya, nilai keseluruhan, siapa menetapkan dan kapan, catatan koreksi |
| Aturan Bonus Terukur | Ukuran, syarat, rentang, nominal, jabatan dan cabang penerima, sumber dana; bertanggal berlaku |
| Hasil penilaian Bonus Terukur | Per orang per aturan: terpenuhi atau tidak, dan angka buktinya |
| Produk promo | Produk (dari daftar produk kasir), cabang, periode, target, dua tarif per pcs, jabatan yang boleh melapor |
| Laporan penjualan promo | Produk, orang, jumlah, tanggal dan nomor struk, foto struk, status, alasan tolak, jejak koreksi |
| Master Judul dan Tugas | Judul, kebutuhan foto, jenis, mode, sasaran, tenggat, tanda "masuk rapor", tanggal berlaku, versinya |
| Laporan tugas | Orang, tanggal, isi, foto sebelum dan sesudah, jam kirim, tanda janggal, tanda tidak sah, gugur, dibatalkan |
| Daftar rak | Per cabang: rak, penanggung jawab, jadwal dirapikan; bertanggal berlaku |
| Catatan Rapat | Judul, tanggal rapat, isi, sasaran, tahap, versi sebelumnya, tugas tindak lanjut |

Yang **bukan** milik modul ini:

| Data | Milik modul |
|---|---|
| Hari kerja, hadir, telat, izin, sakit, alpha, jadwal libur, hari tutup, titik lokasi cabang, jam kerja | Kehadiran (KEH-22, 31, 79) |
| Orang, jabatan, cabang, riwayat penempatan, daftar hak akses | Karyawan (KAR-56, 58) |
| Buku Bonus, jenis bonus dan sumber dananya, halaman Persetujuan Bonus, Dana Disiplin, slip | Gaji (GAJ-24 s.d. 34) |
| Laporan Kasir dan selisih kasir | Keuangan (KEU-38, 54) |
| Daftar produk, omzet, transaksi kasir | Sistem kasir, dibaca lewat Tarik Data Kasir |
| Bonus grooming dan target grooming | Gaji, dari data kasir (GAJ-61) |
| Papan Perubahan Aturan dan tanda "sudah saya baca" | Aturan umum (PRI-29) |

## 3. Aturan

### 3.1 Rapor

| No | Aturan |
|---|---|
| KIN-01 | **Satu rumus, di server.** Nilai rapor dan syarat bonus dihitung di satu tempat; layar hanya menampilkan (WAJ-04). |
| KIN-02 | **Kinerja tidak menghitung ulang milik modul lain** (WAJ-03). Ia membaca angka jadi dari pemiliknya: hadir, tepat waktu, izin, sakit, dan alpha dari Kehadiran dengan aturan yang sama dengan slip (termasuk toleransi 5 menit, KEH-22); omzet dari Tarik Data Kasir; selisih kasir dari Laporan Kasir (KEU-54). |
| KIN-03 | **Semua kriteria terukur dari data. Tidak ada nilai yang diketik orang.** Hal yang belum tercatat di sistem (misalnya sikap ke pelanggan) belum bisa menjadi kriteria sampai ada datanya. |
| KIN-04 | **Ukuran yang tersedia di awal** ada di tabel di bawah. Daftar ukuran bisa ditambah (PRI-20). Kehilangan barang **tidak** menjadi ukuran (KIN-17). |
| KIN-05 | **Kriteria diatur per jabatan per cabang**, bukan per nama orang (WAJ-05); bertanggal berlaku; tidak dihapus, hanya dinonaktifkan. Mengubahnya tidak mengubah periode yang sudah lewat. Target omzet cabang juga bertanggal berlaku. Jabatan yang tidak punya kriteria tidak punya rapor. |
| KIN-06 | **Rapor:** tiap orang punya nilai persen per kriteria dan nilai keseluruhan (rata-rata berbobot), dari 0 sampai 100. Jumlah bobot satu kelompok kriteria harus 100; kalau tidak, pengaturan ditolak disimpan dengan menyebut selisihnya. **Rapor tidak membawa uang**; uang hanya lahir dari Bonus Terukur (KIN-13) dan bonus promo (KIN-20). |
| KIN-07 | **Semua kriteria memakai periode gaji 26–25.** |
| KIN-08 | **Kriteria yang belum ada datanya tidak ikut dihitung** dan ditandai "belum ada data", bukan dihitung 0. |
| KIN-09 | **Rapor punya dua tahap: Perkiraan dan Ditetapkan.** Ditetapkan HR atau pemilik sebelum slip periode itu ditutup. Karena tidak ada nilai yang diketik, menetapkan berarti memeriksa hasil hitungan mesin lalu menguncinya. Saat ditetapkan, rinciannya disimpan (tiap kriteria, angka mentah, waktu, siapa) dan tidak berubah lagi. Rapor yang belum ditetapkan saat masa keberatan slip dimulai ditandai untuk HR dan pemilik. |
| KIN-10 | **Koreksi setelah ditetapkan** berupa catatan koreksi beralasan; selisih uangnya masuk slip berikutnya. Yang belum ditetapkan saat slip ditutup, bonusnya masuk slip berikutnya dengan keterangan periode asal (GAJ-50). |
| KIN-11 | **Orang yang pindah, masuk, atau berhenti di tengah periode.** (a) Rapor dan bonus per periode orang yang pindah cabang atau jabatan memakai kriteria dan aturan **tempat ia paling lama bekerja di periode itu** (kalau sama lama: yang terakhir); angkanya tetap dihitung dari seluruh periode. (b) Bonus per hari memakai jabatan dan cabang **hari itu** (GAJ-28). (c) Hitungan "sekian periode berturut-turut" tidak putus karena pindah, selama di tempat barunya ada aturan bonus yang sama. (d) Orang yang masuk atau berhenti di tengah periode tetap punya rapor dari hari ia bekerja, tetapi bonus per periode dan bonus berturut-turut hanya dihitung untuk periode yang dijalani **penuh**; bonus per hari tetap berlaku. (e) Orang yang berhenti tanpa pemberitahuan sebulan dan dikenai denda oleh pemilik kehilangan semua bonusnya yang belum dibayar (GAJ-58). |
| KIN-12 | **Karyawan melihat rapornya utuh** di portal: Perkiraan atau Ditetapkan, angka di balik tiap persen ("hadir 22 dari 24 hari"), dan bonus yang didapat beserta syaratnya. |

Ukuran yang tersedia di awal (KIN-04):

| Ukuran | Angka yang dibaca | Dari mana |
|---|---|---|
| Kehadiran | Hari hadir, izin, sakit, alpha dalam periode | Kehadiran |
| Tepat waktu | Hari telat (melewati toleransi) dan menit telat | Kehadiran (KEH-22) |
| Tugas rutin dikerjakan | Dikerjakan dibagi jatah | Tugas (KIN-42) |
| Kerapian display | Jatah rak yang dirapikan sesuai jadwal | Tugas (KIN-43) |
| Penjualan promo | Jumlah terjual yang disetujui dibanding target cabang | Penjualan Promo (KIN-19 s.d. 26) |
| Target omzet | Omzet cabang dibanding targetnya; **baru menyala setelah sambungan kasir hidup** | Tarik Data Kasir |
| Ketelitian kasir | Selisih tiap Laporan Kasir orang itu, lebih maupun kurang | Keuangan (KEU-54) |

### 3.2 Bonus Terukur

| No | Aturan |
|---|---|
| KIN-13 | **Bonus Terukur.** Satu aturan bonus berisi: ukuran (dari daftar KIN-04), syarat (batas angka), rentang (per hari, per periode, atau sekian periode berturut-turut), nominal, jabatan dan cabang penerima, dan sumber dana; bertanggal berlaku. Mesin menilai terpenuhi atau tidak dari data dan menyimpan angka buktinya. Hasilnya masuk halaman Persetujuan Bonus, lalu Buku Bonus (GAJ-24, GAJ-26). Pemilik boleh membuat aturan sebanyak yang dibutuhkan. Bonus Terukur menggantikan rumus Bonus KPI lama (nominal maksimal per orang kali nilai) dan **melapisi GAJ-29**: syarat bonus bersyarat dinilai mesin, bukan dicentang orang. |
| KIN-14 | **Bentuk aturan yang dicontohkan pemilik** (angkanya contoh, diisi di pengaturan): selisih kasir satu hari tidak lebih dari batas → bonus per hari; jumlah selisih satu periode, lebih maupun kurang, tidak lebih dari batas → bonus per periode; tiga periode berturut-turut tanpa izin dan sakit → bonus; satu periode tanpa telat → bonus. |
| KIN-15 | **Sumber dana tiap aturan bonus adalah pengaturan** (GAJ-25) dan ditentukan pemilik. Aturan bonus tidak bisa diaktifkan sebelum sumber dananya dipilih. Kalau sumbernya Dana Disiplin, pengesahan yang melebihi saldo ditolak (GAJ-34). |
| KIN-16 | **Kapan dinilai.** Mesin menghitung tiap hari dan menampilkannya ke karyawan sebagai **perkiraan**. Bonus diajukan ke halaman Persetujuan Bonus **sekali per periode**, setelah rapor periode itu ditetapkan (KIN-09), yaitu ketika klarifikasi absen dan keberatan kasir sudah lewat masanya. Bonus per hari dijumlahkan menjadi satu baris per aturan per orang, dengan rincian hari mana saja yang terpenuhi. Bonus masuk slip periode itu. |
| KIN-17 | **Satu kesalahan mengenai dua kali:** telat dan tidak hadir **boleh** (potongan di slip dan syarat bonus). Selisih kasir **boleh** menjadi syarat bonus ketepatan, walaupun kekurangannya juga diganti kasir (KEU-55). **Kehilangan barang tidak** menjadi ukuran atau syarat, karena ditanggung bersama dan sudah dibayar lewat potongan (GAJ-17). |
| KIN-18 | **Bonus Kinerja (bertingkat per siklus), Ranking Disiplin, dan Tabungan Loyalitas tetap ditunda** sebagai fitur tambahan setelah v3 jadi (GAJ-31, GAJ-32). |

### 3.3 Penjualan Promo

| No | Aturan |
|---|---|
| KIN-19 | **Produk promo dipilih dari daftar produk kasir**, tidak diketik. Target dibuat per cabang per periode gaji, boleh dibatasi untuk jabatan tertentu. Target dan tarif yang sudah berjalan tidak diubah; perubahan berlaku periode berikutnya. Produk tidak dihapus, hanya dinonaktifkan. |
| KIN-20 | **Bonus promo hanya per pcs, dengan dua tarif:** target cabang tercapai atau belum. Tercapai dihitung dari penjualan satu cabang; tiap orang dibayar menurut pcs yang ia laporkan sendiri. Cara "persen dari harga" tidak dibawa; grooming punya jalurnya sendiri (GAJ-61). |
| KIN-21 | **Melapor:** jumlah, tanggal struk, nomor struk, dan foto struk. Batas lapor 3 hari sejak tanggal struk; lewat itu laporan tetap diterima dan bonusnya dipotong 50%. Angka 3 hari dan 50% adalah pengaturan bertanggal berlaku. |
| KIN-22 | **Struk hanya bisa dilaporkan ke produk yang berlaku pada tanggal struknya**, di cabang tempat penjualan terjadi (GAJ-28). Struk periode lalu tetap diterima; bonusnya masuk slip berikutnya dengan keterangan periode asal. |
| KIN-23 | **Penjaga dobel:** nomor struk yang sama untuk produk yang sama ditolak. Setelah sambungan kasir hidup, laporan dicocokkan dengan transaksi kasir. |
| KIN-24 | **Laporan promo tidak dihapus dan tidak diubah diam-diam.** Karyawan melihat daftar laporannya dan alasan penolakan, dan boleh membatalkan laporan yang belum diperiksa. Pemeriksa boleh mengoreksi jumlah dengan jejak (klaim awal tetap tersimpan). Keputusan yang sudah masuk slip tertutup tidak dibuka lagi; koreksinya baris baru (GAJ-50). |
| KIN-25 | **Yang memeriksa laporan promo: HR dan pemilik**, di halaman Persetujuan Bonus (GAJ-26). Laporan yang menunggu lebih dari 3 hari kerja ditandai untuk HR dan pemilik. **Finance tidak melihat laporan promo per orang**; ia hanya melihat total bonus per periode di uraian slip (GAJ-46). |
| KIN-26 | **Bonus promo menjadi baris Buku Bonus saat periode berakhir**, ketika tercapai atau tidaknya target sudah pasti. Sebelum itu karyawan melihatnya sebagai perkiraan dengan dua kemungkinan tarif. |

### 3.4 Tugas: membuat

| No | Aturan |
|---|---|
| KIN-27 | **Satu mesin Tugas.** Tugas rutin, tugas sekali jalan, dan tugas tindak lanjut rapat memakai satu daftar, satu jendela lapor, dan satu cara memperluas sasaran menjadi daftar orang, di server. |
| KIN-28 | **Jenis tugas:** rutin (harian, mingguan Senin sampai Minggu, atau per periode 26–25) dan sekali jalan (bertenggat). Tugas tindak lanjut rapat adalah tugas sekali jalan yang bertaut ke catatannya. Kebutuhan foto: tanpa foto, satu foto, atau sebelum dan sesudah. Mode: individu, atau tim dengan satu PIC per cabang. |
| KIN-29 | **Judul dipilih dari Master Judul. Master dan tugas tidak dihapus dan bertanggal berlaku.** Tugas dihentikan "mulai tanggal"; periode sebelum itu tetap terhitung. Judul dan kebutuhan foto yang sudah punya laporan tidak diubah; perubahannya menjadi versi baru yang berlaku ke depan. |
| KIN-30 | **Yang membuat tugas:** kepala cabang dan Kepala Gudang untuk timnya sendiri; HR dan pemilik untuk semua. |
| KIN-31 | **Tugas yang menjadi ukuran rapor ditandai "masuk rapor" oleh HR atau pemilik.** Tugas buatan kepala cabang tidak otomatis masuk rapor, supaya ia tidak bisa memengaruhi syarat bonus timnya lewat tugas yang ia buat sendiri. |
| KIN-32 | **Sasaran tugas rutin per jabatan per cabang**, bukan nama orang. Tugas sekali jalan boleh ditujukan ke orang tertentu. Orang yang pindah cabang atau jabatan terkena tugas barunya **mulai tanggal pindah**, dengan jatah dihitung dari tanggal itu; layar menjelaskan hal ini apa adanya (WAJ-10). |

### 3.5 Tugas: jatah dan melapor

| No | Aturan |
|---|---|
| KIN-33 | **Jatah lapor membaca hari kerja dari Kehadiran**, tidak menghitung sendiri: hari libur terjadwal, cuti, izin, sakit, dan hari tutup tidak dihitung; **alpha tetap dihitung**. Mingguan: minggu yang terpotong pergantian periode dihitung di periode tempat hari Minggunya jatuh. Jatah mulai dihitung sejak tugas berlaku dan sejak orang itu terkena tugas. |
| KIN-34 | **Lapor hanya untuk hari ini, jam dari server; tidak ada lapor susulan** (PRI-01). Lupa lapor berarti jatah itu tidak dikerjakan. Tugas sekali jalan yang lewat tenggat tetap bisa dilaporkan dan ditandai terlambat. |
| KIN-35 | **Penjaga foto (ditolak mesin kalau dilanggar):** foto diambil dari kamera saat itu, bukan dari galeri; jumlah foto sesudah sama dengan foto sebelum; ada jarak minimal dari foto sebelum ke sesudah (pengaturan, isi awal 5 menit); foto sesudah harus di hari yang sama, kalau tidak rangkaian itu **gugur** dan tercatat gugur. |
| KIN-36 | **Tidak ada laporan yang dihapus** (PRI-02). Foto sebelum yang dibatalkan tercatat "dibatalkan". Laporan salah dibatalkan pelapornya sebelum hari itu berakhir, lalu boleh lapor ulang. Baris laporan tidak bisa diubah siapa pun. |
| KIN-37 | **Tugas tim punya jalan keluar:** kalau PIC tidak masuk hari itu, anggota tim cabang itu yang hadir boleh melapor, dan tercatat siapa yang melapor. Laporan tim berlaku untuk anggota yang hari itu hari kerjanya. |
| KIN-38 | **Tugas sekali jalan:** tenggat wajib; lapor progres boleh, lalu satu laporan akhir; laporan akhir diperiksa pembuat tugas, HR, atau pemilik (setuju atau minta revisi dengan catatan); telat dihitung dari laporan akhir pertama, supaya revisi tidak menghapus catatan telat; mengubah tenggat berjejak; yang menunggu diperiksa lebih dari 3 hari kerja ditandai. Tugas sekali jalan belum menjadi ukuran rapor di awal. |

### 3.6 Tugas: penjagaan dan hitungan

| No | Aturan |
|---|---|
| KIN-39 | **Laporan tugas rutin dihitung otomatis; tidak disetujui satu per satu. Mesin menandai yang janggal** untuk dilihat orang: foto yang sama dipakai ulang, dikirim dari luar titik lokasi cabang, dikirim di luar jam kerja orang itu. Daftar tanda bisa ditambah dan batasnya adalah pengaturan (PRI-32). Tanda janggal tidak menggugurkan laporan; yang memutuskan orang (KIN-40). Mesin ini masuk layar Kesehatan Mesin (PRI-33). |
| KIN-40 | **Tanda "tidak sah":** diusulkan kepala cabang, **ditetapkan HR atau pemilik**; wajib beralasan dan berjejak, pencabutannya juga. Karyawan diberi tahu dan melihat alasannya. Setelah rapor ditetapkan tidak bisa lagi; koreksinya lewat catatan koreksi (KIN-10). Tanda ini memutus sah atau tidaknya satu bukti; ia bukan nilai yang diketik orang (KIN-03). |
| KIN-41 | **Hitungan disimpan saat rapor ditetapkan** (jatah, dikerjakan, tidak sah, gugur) dan tidak berubah lagi; sebelum itu tampil sebagai perkiraan. |
| KIN-42 | **Ukuran "tugas rutin dikerjakan"** = dikerjakan dibagi jatah, per orang per periode, dari tugas rutin bertanda masuk rapor. "Dikerjakan" = jatah yang punya sedikitnya satu laporan selesai yang tidak gugur, tidak dibatalkan, dan tidak ditandai tidak sah. **Satu laporan hanya dihitung di satu ukuran**: laporan kerapian display tidak ikut dihitung di sini. |
| KIN-43 | **Kerapian display: rak didaftar per cabang**, tiap rak punya penanggung jawab dan jadwal (seberapa sering dirapikan), keduanya pengaturan bertanggal berlaku. Lapor per rak, foto sebelum dan sesudah. Ukuran = jatah rak tanggung jawabnya yang dirapikan sesuai jadwal dibagi seluruh jatahnya; jatah mengikuti hari kerja (KIN-33). Rak yang sama dilaporkan dua kali dalam satu jatah dihitung satu. Rak tanpa penanggung jawab ditandai untuk kepala cabang. Daftar rak ini menggantikan "jatah rak cabang" (satu angka per cabang yang dibagi rata menurut abjad). |
| KIN-44 | **Karyawan melihat** tugasnya, kemajuan periode berjalan, riwayat laporannya, dan laporan yang ditandai janggal, tidak sah, atau gugur beserta alasannya. Tugas yang belum dilapor memunculkan pengingat di aplikasi (PRI-25). Kepala cabang melihat kemajuan timnya; HR dan pemilik melihat semua. |

### 3.7 Catatan Rapat

| No | Aturan |
|---|---|
| KIN-45 | **Catatan Rapat dibawa dalam bentuk ringkas:** judul, tanggal rapat, isi, sasaran, dan tugas tindak lanjutnya (KIN-28). Dua tahap: draf dan terbit. Dibuat HR dan pemilik. Catatan khusus HR dan pemilik tetap bisa dibuat (sasarannya hanya mereka). |
| KIN-46 | **Aturan dan SOP tidak ditulis di Catatan Rapat.** Tempatnya Papan Perubahan Aturan (PRI-29), yang punya tanggal berlaku, "sebelumnya bagaimana", riwayat, dan tanda "sudah saya baca". Jenis "Aturan/SOP", tombol "Sudah Saya Baca", dan pilihan "tanpa notifikasi" di Catatan Meeting lama tidak dibawa. |
| KIN-47 | **Catatan Rapat tidak diubah diam-diam dan tidak dihapus:** perubahan setelah terbit berjejak (versi lama bisa dilihat); catatan hanya bisa ditarik, dan menariknya tidak menghapus tugas serta laporannya; disimpan dalam satu langkah di server; yang melihat hanya sasarannya dan yang berhak menurut daftar hak. |

### 3.8 Hak akses dan aturan umum

KIN-48. **Hak akses isi awal** (diatur di daftar hak akses per jabatan, KAR-58;
dijaga di server; tidak ada nama jabatan di kode). Yang tidak berhak tidak
melihat menunya, bukan melihat halaman kosong.

| Jabatan | Di modul ini |
|---|---|
| Pemilik dan **GM** (hak setara) | Semua. Khusus mereka, karena menyangkut uang: membuat dan mengubah aturan Bonus Terukur, tarif bonus promo, potongan telat lapor, dan sumber dana |
| HR | Mengatur yang tidak menyangkut uang: kriteria dan bobot rapor, target omzet, produk dan target promo (tarifnya diisi pemilik), Master Judul, tugas, tanda "masuk rapor", daftar rak, Catatan Rapat. Menetapkan rapor; memeriksa laporan promo dan mengesahkan bonus (GAJ-26); menetapkan tanda tidak sah; melihat rapor dan kemajuan tugas semua orang |
| Kepala cabang dan Kepala Gudang | Melihat rapor dan kemajuan tugas timnya (tidak menilai); membuat tugas untuk timnya dan memeriksa laporan akhir tugas sekali jalan buatannya; mengusulkan tanda tidak sah |
| Finance | Tidak punya menu Kinerja |
| Semua karyawan | Rapornya sendiri; melapor tugas dan penjualan promo; melihat riwayat laporannya; Catatan Rapat yang ditujukan kepadanya |

| No | Aturan |
|---|---|
| KIN-49 | **Tidak ada yang memutuskan urusannya sendiri.** Tidak ada yang menetapkan rapornya sendiri, mengesahkan bonusnya sendiri, memeriksa laporan promo atau laporan tugasnya sendiri, atau menetapkan tanda tidak sah untuk laporannya sendiri. Milik HR diputuskan pemilik. |
| KIN-50 | **Tidak ada kriteria, aturan bonus, produk promo, laporan, tugas, atau catatan yang dihapus;** semuanya dinonaktifkan, dihentikan, ditarik, atau dibatalkan dengan jejak (PRI-02). Semua mesin di buku ini (penghitung rapor, penilai Bonus Terukur, penanda janggal, penghitung jatah, pengingat) tercatat tiap kali jalan dan tampil di layar Kesehatan Mesin (PRI-33). Wajib dites (WAJ-06): nilai rapor, penilaian syarat Bonus Terukur, bonus promo, hitungan jatah, "dikerjakan", dan kerapian display. |

### 3.9 Pengaturan dan angka awalnya

KIN-51. Semua yang di bawah adalah pengaturan yang punya layar, jejak, dan
tanggal berlaku (PRI-32, WAJ-07), disimpan di satu tempat dan dibaca server.
Tidak ada yang ditulis di kode. Perubahan yang menyangkut karyawan diumumkan
dulu di Papan Perubahan Aturan (PRI-29).

| Pengaturan | Isi awal | Aturan |
|---|---|---|
| Periode rapor | 26 sampai 25 | KIN-07 |
| Daftar ukuran | tujuh ukuran di tabel KIN-04 | KIN-04 |
| Kriteria dan bobot per jabatan per cabang | diisi saat menyiapkan tayang | KIN-05 |
| Target omzet cabang | diisi saat menyiapkan tayang | KIN-05 |
| Aturan Bonus Terukur dan sumber dananya | diisi pemilik; contoh bentuknya di KIN-14 | KIN-13, 15 |
| Batas lapor penjualan promo | 3 hari sejak tanggal struk | KIN-21 |
| Potongan bonus promo yang telat lapor | 50% | KIN-21 |
| Tanda laporan promo menunggu diperiksa | 3 hari kerja | KIN-25 |
| Jarak minimal foto sebelum ke sesudah | 5 menit | KIN-35 |
| Daftar tanda janggal | foto dipakai ulang; di luar titik lokasi cabang; di luar jam kerja | KIN-39 |
| Tanda laporan akhir tugas menunggu diperiksa | 3 hari kerja | KIN-38 |
| Daftar rak, penanggung jawab, dan jadwalnya | diisi saat menyiapkan tayang | KIN-43 |
| Tugas yang masuk rapor | diisi saat menyiapkan tayang | KIN-31 |

### 3.10 Perincian Tahap 4I-1: rapor

Keputusan pemilik 14 Oktober 2026 (RP1 s.d. RP4, jawaban "ok" = sesuai saran).
Ditulis memakai saran Claude. Spec: `../work/specs/2026-10-14-kinerja-spec.md`
bagian 3.1.

| No | Aturan |
|---|---|
| KIN-52 | **Fungsi ukuran** (jenis: perincian KIN-01, 04). Satu fungsi server mengembalikan persen (0 s.d. 100) dan angka mentah tiap ukuran per orang per periode; angka mentah dipakai tampilan dan syarat Bonus Terukur. Daftar ukuran ditambah lewat pembangunan. |
| KIN-53 | **Rumus Kehadiran** (RP1; jenis: perincian KIN-04, bagian 6 butir 9). Hari hadir ÷ hari kerja wajib; hari kerja wajib = hari kerja menurut jadwal dikurangi cuti dan sakit bersurat dokter. Izin, sakit tanpa surat, dan alpha mengurangi nilai. Tepat waktu = hari hadir tanpa telat melewati toleransi ÷ hari hadir. |
| KIN-54 | **Rumus Ketelitian kasir** (RP2; jenis: perincian KIN-04, bagian 6 butir 9). Laporan Kasir tanpa selisih ÷ seluruh laporan yang orang itu tutup; kekurangan yang Ditiadakan dihitung tanpa selisih; selisih non-tunai yang tidak dibebankan kepadanya tidak dihitung. Ukuran lain: tugas dan rak menurut KIN-42, 43; promo = pcs disetujui cabang ÷ target (rata-rata per produk); target omzet = omzet ÷ target, menyala setelah sambungan kasir. |
| KIN-55 | **Bobot dan kriteria** (RP3; jenis: perincian KIN-05, 06, 08). Kelompok kriteria per jabatan per cabang (atau semua cabang; yang khusus menang), jumlah bobot 100. Bobot kriteria yang belum ada data dibagi ulang sebanding; semua belum ada data = rapor tanpa angka. Perubahan berlaku mulai periode berikutnya dan diumumkan lewat Papan. |
| KIN-56 | **Menetapkan** (RP4; jenis: perincian KIN-09, 41). Tombol Tetapkan aktif mulai tanggal 29 pukul 00.00; oleh HR, Pemilik, atau GM, bukan untuk rapornya sendiri. "Tetapkan semua yang siap" mengeluarkan rapor bertanda (laporan janggal atau klarifikasi absen yang belum diputuskan). Saat ditetapkan, rincian, hitungan tugas dan rak disalin, lalu Bonus Terukur dan promo dinilai dalam satu langkah. Rapor bukan penahan slip. |
| KIN-57 | **Catatan koreksi** (jenis: perincian KIN-10). Hitung ulang dengan data sekarang, disimpan sebagai versi baru bertaut ke catatan beralasan; versi lama tetap terlihat; perubahan hasil bonus dikirim ke Gaji sebagai bonus susulan atau koreksi bonus. |
| KIN-58 | **Tempat paling lama** (jenis: perincian KIN-11). Kelompok kriteria dibaca dari riwayat penempatan; rapor orang yang masuk atau berhenti di tengah periode bertanda "periode tidak penuh". |

### 3.11 Perincian Tahap 4I-2: Bonus Terukur

Keputusan pemilik 14 Oktober 2026 (BT1 s.d. BT3, jawaban "ok" = sesuai saran).
Spec bagian 3.2.

| No | Aturan |
|---|---|
| KIN-59 | **Bentuk aturan** (jenis: perincian KIN-13, 15). Ukuran dan angka mentah, pembanding dan batas (selisih kasir dibaca lebih maupun kurang), rentang (per hari, per periode, N periode berturut-turut), nominal, penerima (jabatan dan cabang), sumber dana wajib sebelum aktif, berlaku dari. Hanya Pemilik dan GM; diumumkan lewat Papan menurut PRI-35. Jabatan GM dan Pemilik tidak ditawarkan sebagai penerima. |
| KIN-60 | **Hari yang dinilai** (BT2; jenis: perincian KIN-16). Per hari hanya menilai hari yang punya data ukuran itu bagi orang itu; hari tanpa data tidak gagal dan tidak terpenuhi. Penerima per hari dari jabatan dan cabang hari itu. |
| KIN-61 | **Berturut-turut** (BT1; jenis: perincian KIN-11, 13). Dihitung per periode penuh yang memenuhi; periode tidak penuh memutus; pindah tidak memutus selama aturan yang sama berlaku di tempat baru. Sesudah bonus diberikan, hitungan mulai dari nol. |
| KIN-62 | **Penilai** (jenis: perincian KIN-16). Tiap malam sebagai perkiraan di Kinerja Saya; resmi saat rapor ditetapkan, disimpan dengan angka bukti dan rincian hari, lalu dikirim ke pintu tulis Buku Bonus satu baris per aturan per orang per periode (kunci yang sama mencegah dobel). Nominal resmi dihitung pintu tulis Gaji. |
| KIN-63 | **Koreksi bonus** (BT3; jenis: perincian KIN-10, GAJ-90). Menjadi terpenuhi lewat catatan koreksi: bonus susulan ke slip berikutnya. Menjadi tidak terpenuhi: belum disahkan ditolak; disahkan dan slip belum ditutup dibatalkan; sudah masuk slip tertutup dipotong sebagai koreksi bonus di slip berikutnya. |
| KIN-64 | **Pengesahan** (jenis: perincian KIN-13, 15, GAJ-26). Di Persetujuan Bonus Gaji per aturan per periode; sumber Dana Disiplin yang kurang menolak pengesahan. Tiga jenis bonus yang ditunda (KIN-18) tidak dibangun. |

### 3.12 Perincian Tahap 4I-3: penjualan promo

Keputusan pemilik 14 Oktober 2026 (PM1 s.d. PM3, jawaban "ok" = sesuai saran).
Spec bagian 3.3.

| No | Aturan |
|---|---|
| KIN-65 | **Produk promo dan tarif** (jenis: perincian KIN-19, 48). HR membuat produk (dari daftar produk kasir), cabang, target per cabang, dan jabatan boleh melapor; Pemilik atau GM mengisi dua tarif. Tanpa tarif berstatus Menunggu tarif dan belum bisa dilapori. Perubahan berlaku periode berikutnya. |
| KIN-66 | **Produk yang bisa dipilih** (jenis: perincian KIN-22). Produk yang berlaku pada tanggal struk di cabang tempat pelapor bekerja pada tanggal itu, untuk jabatan yang boleh melapor. |
| KIN-67 | **Batas lapor** (PM1; jenis: perincian KIN-21, 22). 3 hari kalender sampai 23.59; lewat itu telat dan dipotong 50%; paling lambat akhir periode berikutnya sesudah periode tanggal struk, lewat itu ditolak. |
| KIN-68 | **Cocok dengan kasir** (PM2; jenis: perincian KIN-23). Nomor struk + produk unik untuk semua pelapor. Setelah sambungan transaksi hidup, struk tidak ada, produk tidak ada di struk, atau jumlah semua laporan melebihi jumlah di struk menandai laporan untuk pemeriksa; tidak ditolak otomatis. |
| KIN-69 | **Pemeriksaan** (jenis: perincian KIN-24, 25). Di tab Promo Persetujuan Bonus: Setujui, Koreksi jumlah (klaim awal tersimpan), Tolak beralasan; tidak untuk laporannya sendiri; menunggu lebih dari 3 hari kerja ditandai; pelapor boleh membatalkan sebelum diperiksa. |
| KIN-70 | **Tercapai dipastikan** (PM3; jenis: perincian KIN-20, 26). Per cabang per produk dari pcs disetujui bertanggal struk di periode itu, dipastikan saat rapor periode ditetapkan dan tidak berubah sesudahnya. Laporan yang disetujui sesudahnya memakai hasil itu. |
| KIN-71 | **Bonus promo ke Buku Bonus** (jenis: perincian KIN-26). Saat dipastikan, satu baris per laporan disetujui (pcs × tarif, × 50% bila telat) lewat pintu tulis Gaji, lahir sudah disahkan; laporan susulan langsung ditulis ke slip berikutnya dengan keterangan periode asal. |

### 3.13 Perincian Tahap 4I-4a: tugas, membuat sampai melapor

Keputusan pemilik 14 Oktober 2026 (TG1 s.d. TG3, jawaban "ok" = sesuai saran).
Spec bagian 3.4.

| No | Aturan |
|---|---|
| KIN-72 | **Master Judul dan versi** (jenis: perincian KIN-29). Judul dan kebutuhan foto bawaan diisi HR, Pemilik, GM; kepala cabang memilih, tidak mengetik bebas. Perubahan pada judul yang sudah punya laporan menjadi versi baru ke depan. |
| KIN-73 | **Sasaran per hari** (jenis: perincian KIN-32). Server memperluas sasaran menjadi daftar orang per hari dari penempatan hari itu; orang pindah terkena tugas baru mulai tanggal pindah. Kepala cabang dan Kepala Gudang hanya membuat tugas untuk tim yang ia kepalai. |
| KIN-74 | **Fungsi jatah** (TG2; jenis: perincian KIN-33). Harian: satu per hari kerja (alpha tetap jatah). Mingguan dan per periode: satu jatah bila ada sedikitnya satu hari kerja sejak terkena tugas; minggu terpotong pergantian periode ikut hari Minggunya. Satu fungsi dipakai Tugas Saya, Kemajuan Tim, dan rapor. |
| KIN-75 | **Foto dari kamera** (jenis: perincian KIN-35). Layar lapor tugas hanya membuka kamera aplikasi; server menolak foto yang dicap lebih dari 2 menit sebelum dikirim. Jarak minimal sebelum ke sesudah 5 menit; jumlah foto sama; sesudah di hari yang sama. |
| KIN-76 | **Gugur dan pengingat** (TG1, TG3; jenis: perincian KIN-35, 44). Rangkaian tanpa foto sesudah diingatkan pukul 21.00 dan gugur pukul 23.59. Tugas harian yang belum dilapor diingatkan 2 jam sebelum jam pulang shift; tugas tim ke PIC atau anggota yang hadir; mingguan dan periode di hari kerja terakhir; sekali jalan H-1 dan hari tenggat. |
| KIN-77 | **Membatalkan laporan** (jenis: perincian KIN-36). Pelapor membatalkan laporan selesai sampai 23.59 hari itu lalu boleh lapor ulang; foto sebelum yang dibatalkan tercatat; tidak ada yang mengubah baris laporan. |
| KIN-78 | **Sekali jalan** (jenis: perincian KIN-38). Pemeriksa laporan akhir: pembuat tugas, HR, Pemilik, GM, bukan pelapornya; Setuju atau Minta revisi dengan catatan; terlambat dari laporan akhir pertama; ubah tenggat berjejak. |

### 3.14 Perincian Tahap 4I-4b: tugas, penjagaan dan hitungan

Keputusan pemilik 14 Oktober 2026 (TJ1 s.d. TJ3, jawaban "ok" = sesuai saran).
Spec bagian 3.5.

| No | Aturan |
|---|---|
| KIN-79 | **Tanda janggal** (TJ2; jenis: perincian KIN-39). Foto sama atau sangat mirip dengan foto laporan di cabang yang sama 30 hari terakhir; dikirim di luar radius cabang; lebih dari 30 menit di luar jam shift. Batasnya pengaturan; tanda tidak menggugurkan; keputusannya Biarkan sah atau Tidak sah. |
| KIN-80 | **Tidak sah** (jenis: perincian KIN-40, 49). Diusulkan kepala cabang untuk timnya, ditetapkan HR, Pemilik, atau GM (bukan untuk laporannya sendiri), beralasan dan berjejak termasuk pencabutan; tertutup sesudah rapor ditetapkan. |
| KIN-81 | **Rapor bertanda** (jenis: perincian KIN-39, 56). Rapor yang punya laporan bertanda belum diputuskan tidak ikut "Tetapkan semua yang siap". |
| KIN-82 | **Jadwal rak** (TJ1; jenis: perincian KIN-43). Tiap hari kerja, atau N kali seminggu (1 s.d. 6); jatah mingguan tidak lebih dari hari kerja penanggung jawab minggu itu. |
| KIN-83 | **Lapor rak** (TJ3; jenis: perincian KIN-43). Hanya penanggung jawab rak itu; hari ia tidak bekerja bukan jatah; dua laporan dalam satu jatah dihitung satu; rak tanpa penanggung jawab ditandai untuk kepala cabang dan HR. |
| KIN-84 | **Hitungan disalin** (jenis: perincian KIN-41, 42, 43). Saat rapor ditetapkan, jatah, dikerjakan, tidak sah, gugur, dan jatah rak serta dirapikan disalin per orang per tugas atau rak dan tidak berubah lagi. |

### 3.15 Perincian Tahap 4I-5: Catatan Rapat dan aturan umum

Keputusan pemilik 14 Oktober 2026 (CR1, CR2, jawaban "ok" = sesuai saran). Spec
bagian 3.6.

| No | Aturan |
|---|---|
| KIN-85 | **Perubahan sesudah terbit** (CR1; jenis: perincian KIN-47). Versi baru berjejak; sasaran diberi tahu dengan tanda "diubah" dan ringkasan perubahan. |
| KIN-86 | **Lampiran** (CR2; jenis: perincian KIN-45). Foto atau PDF, paling banyak 5. |
| KIN-87 | **Aturan dari rapat** (jenis: perincian KIN-46). Layar menulis catatan punya tombol yang membuka Papan Perubahan Aturan; catatan menaut pengumumannya. |
| KIN-88 | **Tarik** (jenis: perincian KIN-47). Ditarik dengan alasan; tugas tindak lanjut tetap berjalan sampai dihentikan sendiri. |

## 4. Yang diganti dari sistem lama

Daftar lengkap aturan sistem lama dan nasibnya ada di arsip. Yang paling mengubah
cara kerja:

| Di sistem lama | Di v3 | Aturan |
|---|---|---|
| Rumus nilai ditulis tiga kali | Satu rumus di server | KIN-01 |
| KPI menghitung ulang kehadiran dengan rumus sendiri, tanpa toleransi | Membaca angka jadi dari Kehadiran | KIN-02 |
| Nilai manual 0–100 diketik pemilik atau HR | Tidak ada nilai yang diketik | KIN-03 |
| Kriteria per nama orang; bisa dihapus; tanpa tanggal berlaku | Per jabatan per cabang; bertanggal berlaku | KIN-05 |
| Kriteria tanpa data dihitung 0 | Tidak dihitung, ditandai | KIN-08 |
| Rekap bisa ditimpa kapan saja; rincian tidak disimpan | Perkiraan lalu Ditetapkan; rincian dikunci | KIN-09, 10 |
| Pindah cabang: seluruh periode dihitung dengan cabang baru | Tempat paling lama bekerja; bonus harian per hari | KIN-11 |
| Karyawan hanya melihat persen | Angka di baliknya dan bonusnya | KIN-12 |
| Bonus KPI = nominal maksimal per orang kali nilai | Bonus Terukur: syarat terukur → nominal | KIN-13 |
| Akurasi Stok dan Selisih Kas menurunkan nilai KPI | Kehilangan barang tidak jadi ukuran; kasir lewat bonus ketepatan | KIN-17 |
| Kepala cabang dan finance membuka halaman berisi 0% | Hak di satu daftar; yang tidak berhak tidak melihat menu | KIN-48 |
| Nama produk promo diketik; target dan tarif diubah di tengah jalan | Dari daftar produk kasir; berubah mulai periode berikutnya | KIN-19 |
| Promo "persen dari harga" untuk grooming | Hanya per pcs | KIN-20 |
| Angka 3 hari, 50%, dan tanggal kelonggaran di kode | Pengaturan bertanggal berlaku | KIN-21 |
| Struk bulan lalu masuk produk bulan ini | Ke produk yang berlaku pada tanggal struk | KIN-22 |
| Struk yang sama bisa dilaporkan dua kali | Nomor struk dijaga | KIN-23 |
| Laporan disetujui bisa dikembalikan kapan saja; karyawan tidak melihat laporannya | Tidak diubah diam-diam; daftar dan alasan terlihat | KIN-24 |
| 18 laporan promo menunggu tanpa pengingat | Ditandai setelah 3 hari kerja | KIN-25 |
| Dua mesin tugas (harian dan dari meeting) | Satu mesin Tugas | KIN-27 |
| Menghapus tugas menghapus laporannya; menonaktifkan mengubah periode lalu | Dihentikan "mulai tanggal"; tidak dihapus | KIN-29 |
| Hanya pemilik dan HR yang membuat tugas; kepala cabang tidak melihat timnya | Kepala cabang membuat dan melihat untuk timnya | KIN-30, 44 |
| Orang pindah cabang mendapat jatah sejak tugas dibuat | Jatah sejak tanggal pindah | KIN-32 |
| "Hari kerja" dihitung sendiri (hitungan keempat) | Dibaca dari Kehadiran | KIN-33 |
| Foto boleh dari galeri; 24 dari 43 rangkaian berjarak kurang dari 2 menit; foto sesudah di hari lain tetap dihitung | Penjaga foto | KIN-35 |
| Foto sebelum yang dibatalkan dihapus | Tercatat "dibatalkan" | KIN-36 |
| PIC tim tidak masuk, tidak ada yang bisa melapor | Anggota yang hadir boleh melapor | KIN-37 |
| Laporan dihitung tanpa dilihat siapa pun; tanda tidak valid tanpa jejak | Mesin menandai yang janggal; tidak sah berjejak | KIN-39, 40 |
| Hitungan tidak disimpan; angka periode lalu berubah sendiri | Disimpan saat rapor ditetapkan | KIN-41 |
| Satu laporan terhitung di dua kriteria | Satu laporan satu ukuran | KIN-42 |
| Rak tidak didaftar; jatah dibagi rata menurut abjad | Daftar rak dengan penanggung jawab | KIN-43 |
| Catatan jenis Aturan/SOP dan "Sudah Saya Baca" yang tidak pernah terpakai | Pindah ke Papan Perubahan Aturan | KIN-46 |
| Catatan terbit diubah tanpa jejak; menghapusnya menghapus tugas; finance melihat semua | Berjejak; hanya ditarik; menurut daftar hak | KIN-47 |

## 5. Kejadian di lapangan dan jalan keluarnya

| Kejadian | Jalan keluar di v3 | Aturan |
|---|---|---|
| Kriteria atau bobot diubah di tengah periode | Berlaku mulai tanggalnya; periode yang lewat tidak berubah | KIN-05 |
| Cabang belum punya target atau datanya belum masuk | Kriteria itu tidak dihitung dan ditandai "belum ada data" | KIN-08 |
| Rapor terlanjur ditetapkan, ternyata salah | Catatan koreksi beralasan; selisih uang di slip berikutnya | KIN-10 |
| Rapor belum ditetapkan saat slip ditutup | Ditandai; bonusnya masuk slip berikutnya | KIN-09, 10 |
| Karyawan pindah cabang di tengah periode | Rapor ikut tempat paling lama; bonus harian ikut hari itu | KIN-11 |
| Karyawan baru masuk tanggal 20 | Punya rapor; bonus per periode mulai periode penuh pertamanya | KIN-11 |
| Karyawan merasa nilainya salah | Melihat angka di balik tiap persen; yang salah dibetulkan di sumbernya (absen, laporan) sebelum ditetapkan | KIN-02, 12 |
| Saldo Dana Disiplin tidak cukup untuk bonus | Pengesahan ditolak dengan menampilkan kekurangannya | KIN-15 |
| Kasir minus, sudah mengganti, lalu tidak dapat bonus ketepatan | Memang begitu; keduanya boleh | KIN-17 |
| Karyawan salah ketik jumlah di laporan promo | Membatalkan sendiri selama belum diperiksa, lalu lapor ulang | KIN-24 |
| Laporan promo ditolak | Karyawan melihat alasannya di daftar laporannya | KIN-24 |
| Laporan promo tidak kunjung diperiksa | Ditandai untuk HR dan pemilik setelah 3 hari kerja | KIN-25 |
| Struk yang sama dilaporkan dua kali | Ditolak | KIN-23 |
| Struk bulan lalu baru dilaporkan | Masuk produk bulan lalu; bonus dipotong karena telat dan masuk slip berikutnya | KIN-21, 22 |
| Target promo ternyata terlalu tinggi | Tidak diubah di tengah jalan; dibetulkan mulai periode berikutnya | KIN-19 |
| Lupa melapor tugas kemarin | Tidak ada lapor susulan; jatah itu tidak dikerjakan | KIN-34 |
| Sakit atau izin di hari tugas | Hari itu bukan jatah | KIN-33 |
| Alpha di hari tugas | Tetap dihitung jatah | KIN-33 |
| Salah kirim foto sebelum | Dibatalkan; tercatat "dibatalkan" | KIN-36 |
| Salah kirim laporan yang sudah selesai | Dibatalkan pelapor sebelum hari berakhir, lalu lapor ulang | KIN-36 |
| Foto sesudah baru mau dikirim besoknya | Rangkaian gugur; hari ini mulai rangkaian baru | KIN-35 |
| Laporan ditandai janggal | Tetap dihitung sampai HR atau pemilik memutuskan | KIN-39, 40 |
| Laporan ditetapkan tidak sah | Karyawan diberi tahu dan melihat alasannya; bisa dicabut dengan jejak sebelum rapor ditetapkan | KIN-40 |
| PIC tim libur atau sakit | Anggota tim yang hadir melapor | KIN-37 |
| Tugas tidak lagi diperlukan | Dihentikan "mulai tanggal" | KIN-29 |
| Kebutuhan foto sebuah tugas perlu diganti | Versi baru yang berlaku ke depan | KIN-29 |
| Rak belum punya penanggung jawab, atau penanggung jawabnya pindah | Ditandai untuk kepala cabang | KIN-43 |
| Laporan akhir tugas sekali jalan tidak kunjung diperiksa | Ditandai setelah 3 hari kerja | KIN-38 |
| Tenggat tugas dimundurkan | Berjejak; catatan telat dari laporan akhir pertama tetap | KIN-38 |
| Catatan Rapat salah setelah terbit | Diubah; versi lama tetap bisa dilihat | KIN-47 |
| Catatan Rapat salah terbit | Ditarik; tugas dan laporannya tidak ikut hilang | KIN-47 |
| Hasil rapat berupa aturan baru | Diumumkan di Papan Perubahan Aturan | KIN-46 |

## 6. Masih terbuka

Kelima butir penutup penetapan (7D.1 arsip) sudah dijawab pemilik 12 dan 13
Oktober 2026; jawabannya di 7D.2 arsip. Tidak ada tanda ⏳ yang tersisa.
Nomor di bawah tidak diurutkan ulang.

Tidak menghambat tahap berikutnya, tetapi harus diputuskan sebelum spec modul
ini ditulis (Tahap 4) atau saat menyiapkan tayang. **Jangan ditanyakan lagi
sampai pemilik menyampaikannya:**

6. **Daftar aturan Bonus Terukur, angkanya, dan sumber dana tiap aturan**
   (KIN-13, 15).
7. **Kriteria dan bobot rapor** per jabatan per cabang, dan **target omzet**
   tiap cabang (KIN-05).
8. **Daftar rak** tiap cabang, penanggung jawabnya, dan seberapa sering tiap
   rak dirapikan (KIN-43); **tugas mana yang masuk rapor** (KIN-31).

Dirinci di spec (Tahap 4):

9. **Rumus persen tiap ukuran** di tabel KIN-04 (misalnya sakit bersurat
   dokter dihitung hadir atau tidak untuk nilai Kehadiran; kekurangan kas
   yang ditiadakan pemilik dihitung atau tidak untuk Ketelitian kasir).
   Rapor tidak membawa uang; yang membawa uang adalah syarat Bonus Terukur,
   yang angkanya ditentukan pemilik per aturan (butir 6).
10. **Kapan sambungan kasir dinyalakan** untuk ukuran Target omzet dan
    pencocokan laporan promo (KIN-04, KIN-23).

Ditangguhkan atau ditunda pemilik:

11. **Rekrutmen** (`../work/backlog/2026-10-12-rekrutmen-ditangguhkan.md`).
12. **Bonus Kinerja bertingkat, Ranking Disiplin, Tabungan Loyalitas**
    (KIN-18).

## 7. Titipan dan catatan

Untuk Bab 1 (Karyawan):

1. Nominal Bonus KPI maksimal per orang (dulu KAR-19) **tidak dibawa**;
   diganti aturan Bonus Terukur per jabatan per cabang (KIN-13).
2. Daftar hak akses (KAR-58) memuat KIN-48.
3. Riwayat penempatan (KAR-56) dibaca untuk KIN-11 dan KIN-32.

Untuk Bab 2 (Kehadiran):

4. Kehadiran menyediakan angka jadi per orang per hari untuk dibaca Kinerja
   dan Tugas: hari kerja atau bukan, hadir, telat melewati toleransi, izin,
   sakit, alpha (KIN-02, KIN-33); juga titik lokasi cabang dan jam kerja
   orang itu untuk tanda janggal (KIN-39).

Untuk Bab 3 (Gaji):

5. GAJ-29 dilapisi KIN-13 (syarat dinilai mesin). Di GAJ-31, "Bonus KPI"
   tidak lagi ditunda: ia menjadi Bonus Terukur dan dibangun bersama v3;
   tiga lainnya tetap ditunda (KIN-18). Titipan GAJ bagian 7 butir 8
   terjawab: bonus promo dan Bonus Terukur dicatat ke Buku Bonus dan
   disahkan di halaman Persetujuan Bonus (KIN-13, 25, 26).
6. Data "penilaian bonus bersyarat" di buku Gaji menjadi "hasil penilaian
   Bonus Terukur" milik modul ini; Buku Bonus tetap milik Gaji.

Untuk Bab 6 (Keuangan):

7. Selisih tiap Laporan Kasir per orang per hari dibaca Kinerja untuk ukuran
   Ketelitian kasir (KEU-54). Keuangan tidak berubah.

Untuk modul Tarik Data Kasir:

8. Yang dibaca Kinerja: daftar produk (untuk produk promo, sama dengan
   DRV-38), omzet per cabang per hari (Target omzet), dan transaksi per
   struk (pencocokan laporan promo, KIN-23).

Untuk aturan umum:

9. Aturan dan SOP hasil rapat diumumkan di Papan Perubahan Aturan (PRI-29),
   bukan di Catatan Rapat (KIN-46).

Untuk Tahap 3 dan 4:

10. Menu: Rapor, Tugas, dan Catatan Rapat menjadi satu kelompok; "Kinerja
    Saya" dan "Tugas" di portal karyawan
    (`../work/backlog/2026-10-11-susun-ulang-menu.md`).
11. Bagian 5 dijadikan daftar tes (PRI-06). Wajib dites (WAJ-06): lihat
    KIN-50.
12. Mesin pengaman hak akses wajib mencoba KIN-48 dan KIN-49: finance tidak
    bisa membuka menu Kinerja, kepala cabang tidak bisa menetapkan rapor
    atau tanda tidak sah, HR tidak bisa mengubah aturan bonus, tidak ada
    yang memeriksa laporannya sendiri.
13. Pengingat dan tanda lewat aplikasi (PRI-25); semua tanda di buku ini
    masuk daftar "perlu perhatian" yang sama dengan modul lain.

Untuk keputusan data lama (WIP, keputusan terbuka 3):

14. Tidak ada saldo yang perlu dipindah: KPI lama belum pernah menghasilkan
    rekap atau bonus. 18 laporan promo yang menunggu dan tugas kerapian
    display di sistem lama tetap berjalan apa adanya (WAJ-09).

## 8. Istilah

Dimasukkan ke `00-kamus-istilah.md`: rapor, ukuran, kriteria, Bonus Terukur,
syarat, rentang, produk promo, Tugas, Master Judul, jatah lapor, rangkaian,
gugur, janggal, tidak sah, masuk rapor, daftar rak, Catatan Rapat.
