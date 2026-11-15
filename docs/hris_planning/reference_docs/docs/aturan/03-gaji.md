# Buku Aturan: Gaji Bulanan

Status: **ditetapkan 12 Oktober 2026**, kecuali yang tercantum di bagian 6
("Masih terbuka").

Nomor aturan tidak diurutkan ulang, supaya rujukan dari dokumen lain tetap benar.
GAJ-58 (berhenti tanpa pemberitahuan sebulan) ada di bagian 3.6, karena
ditambahkan 13 Oktober 2026 setelah nomor lain ditetapkan.

File ini hanya berisi aturan yang berlaku di v3. Hasil galian sistem lama, hasil
cek database, semua pertanyaan, dan jawaban pemilik disimpan di
`arsip/03-gaji-galian.md` (bagian 3A s.d. 3E). Nomor GAJ-A, GAJ-B, GAJ-C, dan
GAJ-D di arsip itu adalah nomor galian sistem lama, bukan nomor aturan v3.
Asal tiap aturan di bawah tercatat di bagian 3E arsip itu.

Gaji driver dan kenek yang dibayar per ritase, bongkaran, dan kasbon diatur di
Bab 5 (`05-gaji-driver-kasbon.md`). Buku ini hanya menyebut titik sambungnya.
Slip mingguan mengikuti aturan slip di buku ini untuk hal yang tidak diatur
khusus di sana (DRV-22).

Di buku ini, "pemilik" dalam urusan hak akses (GAJ-11, 45, 46, dan lainnya)
mencakup jabatan **GM**, yang haknya setara (KAR-67, 12 Oktober 2026). GAJ-09,
GAJ-45, dan GAJ-46 tentang slip dan gaji jabatan Pemilik berlaku juga untuk
slip dan gaji GM: hanya gaji tetap, tanpa bonus, tidak terlihat HR.

## 1. Modul ini mengurus apa

Modul Gaji bulanan mengubah catatan kerja satu periode menjadi uang. Isinya:
komponen gaji tiap orang, hitungan dari kehadiran (telat, lembur, tidak hadir,
denda, kompensasi libur), potongan di luar kehadiran (kehilangan barang, minus
kas, potongan lain, cicilan kasbon), semua bonus, dua dana (Dana Disiplin dan
Dana Tidak Hadir), dan perjalanan slip dari perkiraan sampai dibayar.

Modul ini membaca hasil modul lain dan tidak mengubahnya. Contohnya, jam telat
milik Kehadiran, cicilan kasbon milik Kasbon (Bab 5), dan bonus ongkir dicatat
modul Logistik (Bab 4) dari nota kasir.

## 2. Data yang dimiliki modul ini

| Data | Isinya |
|---|---|
| Buku Upah | Satu baris per upah dari jenis apa pun: siapa, jenis upah, tanggal, banyaknya, tarif, nominal, asalnya. Barisnya lahir dari modul asal, tidak pernah diketik (PRI-19, DRV-01) |
| Komponen gaji per orang | Daftar komponen (gaji pokok, tunjangan, dan seterusnya) dengan nominal dan tanggal mulai berlaku |
| Gaji Standar | Paket komponen acuan untuk orang baru dan untuk Training yang menjadi Karyawan (KAR-22) |
| Pengaturan gaji | Semua angka di bagian 3.7, masing-masing bertanggal berlaku |
| Tanggungan kehilangan barang | Persen kantor per cabang dan bobot per jabatan, bertanggal berlaku |
| Kehilangan barang | Kejadian per cabang: tanggal, nilai, keterangan |
| Minus kas catat tangan | Hanya kejadian **di luar** Laporan Kasir: cabang, tanggal, nilai, penanggung. Kekurangan dari Laporan Kasir tidak disalin ke sini; slip membacanya langsung dari selisih kasir milik Keuangan (KEU-54, 55; keputusan 3A, 13 Oktober 2026) |
| Potongan Lain | Ganti rugi perorangan: jenis, nominal, cicilan, pengesahan (GAJ-80) |
| Sisa potongan | Bagian potongan yang tidak tertampung slip: jenis asal, periode asal, nominal, ke mana ia berakhir (terpotong, tidak tertagih, Piutang Lain; GAJ-75, 82) |
| Buku Bonus | Satu baris per bonus: siapa, jenis, nominal, tanggal kejadian, cabang, asal, status |
| Jenis bonus | Daftar jenis dengan pengaturannya: sumber dana, jabatan penerima, angka aturan |
| Penilaian bonus bersyarat | Dinilai mesin dan disimpan modul Kinerja sebagai hasil penilaian Bonus Terukur (KIN-13); buku ini hanya menerima barisnya di Buku Bonus |
| Dana Disiplin dan Dana Tidak Hadir | Mutasi masuk dan keluar beserta saldonya |
| Periode gaji | Periode bulanan (26–25) dan minggu upah (Jumat–Kamis): tanggal mulai dan akhir, tahapnya, jadwal gajiannya. Cara menentukannya dirancang di Tahap 3D (PRI-22) |
| Slip | **Satu mesin slip** untuk slip bulanan dan slip mingguan (keputusan 3A, 13 Oktober 2026): satu per orang per periode atau minggu upah: tahap, nomor, cabang dan jabatan saat itu, dan rinciannya baris demi baris. Aturan khas slip mingguan tetap di DRV-20 s.d. 23 |
| Keberatan slip | Isi keberatan, keputusannya, dan baris koreksi yang dihasilkannya (lewat Mesin Pengajuan, PRI-23) |
| Pembayaran slip | Bulanan dan mingguan: tanggal, pembayar, sumber dana, pembatalan |

Yang **bukan** milik modul ini:

| Data | Milik modul |
|---|---|
| Orang, cabang, jabatan, pengaturan jabatan (tanda ya/tidak), Daftar Pengecualian | Karyawan (KAR-62) |
| Jam masuk, jam pulang, telat, lembur yang disahkan, izin, klarifikasi | Kehadiran |
| Kasbon dan cicilannya, tarif ritase, denda driver/kenek, Laporan Bongkaran (isi slip mingguan) | Gaji Driver dan Kasbon (Bab 5) |
| Laporan Kasir, selisih kasir (kekurangan kas dan keberatannya), kas keluar, cara bayar gaji | Keuangan (KEU-24, KEU-38 s.d. 55) |
| Jalur pengajuan (status, penyetuju, lampiran) | Perlengkapan Bersama (PRI-23) |
| Asal bonus ongkir | Logistik (Bab 4, LOG-76), dari nota kasir |
| Data jasa grooming selesai | Tarik Data Kasir (asal bonus grooming, GAJ-61) |
| Asal bonus promo dan Bonus Terukur (aturan, syarat, hasil penilaiannya) | Kinerja (KIN-13 s.d. 26) |

## 3. Aturan

### 3.1 Periode, penerima slip, dan komponen gaji

| No | Aturan |
|---|---|
| GAJ-01 | Periode gaji tanggal **26 sampai 25** bulan berikutnya, dan slip dinamai bulan akhirnya. Periode ditentukan dengan satu cara yang dipakai semua modul (PRI-22). |
| GAJ-02 | Slip bulanan dibuat untuk semua orang yang upahnya bulanan, termasuk Training dan Pemilik (KAR-59). Orang yang dibayar per ritase tidak (Bab 5). Orang yang sudah berhenti tetap dibuatkan slip terakhirnya; menonaktifkan orang tidak menghalangi slip itu. |
| GAJ-03 | Komponen gaji tiap orang berupa **daftar yang bisa ditambah**, tiap komponen bertanggal berlaku. Tidak ada kolom tetap seperti "tunjangan khusus". Gaji Standar adalah paket komponen acuan; mengubahnya tidak mengubah gaji siapa pun. |
| GAJ-04 | Komponen gaji dibaca **menurut tanggal berlakunya**. Perubahan gaji mulai berlaku di awal periode (tanggal 26). Slip periode lama tidak pernah memakai gaji baru. |
| GAJ-05 | **Gaji harian** = jumlah komponen gaji tetap sebulan dibagi **26**, berapa pun panjang periodenya. Angka 26 adalah pengaturan. |
| GAJ-06 | **Masuk atau berhenti di tengah periode**, berlaku untuk semua status kerja: gaji tetap × (hari kalender ia bekerja ÷ jumlah hari periode). Jatah libur periode itu dihitung dengan cara yang sama, lalu dibulatkan ke hari terdekat. Contoh: periode 30 hari, masuk tanggal 11 (bekerja 15 hari): gaji 15/30, jatah libur 4 × 15/30 = 2 hari. Masuk tanggal 16 (10 hari): jatah libur 1,3, dibulatkan menjadi 1 hari. |
| GAJ-07 | **Pembulatan rupiah** (PRI-28): tiap baris di slip dibulatkan ke rupiah terdekat (,5 ke atas), satu kali pada hasil akhir baris itu. Gaji harian tidak dibulatkan lebih dulu. Sisa pembulatan pembagian kehilangan barang ditanggung kantor. |
| GAJ-08 | Perlakuan gaji adalah **pengaturan jabatan**: kena telat, dapat lembur, dapat kompensasi libur (KAR-62), ikut menanggung kehilangan barang, dan menerima jenis bonus apa. Pengecualian per orang hanya lewat Daftar Pengecualian (PRI-26). Istilah dan tanda "gaji flat" tidak ada di v3. |
| GAJ-09 | **Jabatan Pemilik** (KAR-59): slipnya hanya berisi gaji tetap. Tidak kena potongan kehadiran atau denda, tidak ikut menanggung kehilangan barang atau minus kas, dan tidak menerima bonus. **Pengecualian** (12 Oktober 2026, pertentangan G di galian Logistik): jenis bonus bisa diatur "boleh untuk jabatan Pemilik"; saat ini hanya **Bonus Grooming**, karena seorang pemilik juga pelatih grooming dan mengerjakan grooming. Bonus milik seorang pemilik tidak boleh disahkan dirinya sendiri dan hanya terlihat oleh para pemilik (GAJ-46). |

### 3.2 Hitungan dari kehadiran

| No | Aturan |
|---|---|
| GAJ-10 | **Telat: Rp1.000 per menit.** Telat sampai 5 menit tidak dipotong. Telat 6 menit atau lebih dipotong seluruh menitnya (6 menit = Rp6.000). Menit telat selalu tampil di slip dan portal, termasuk yang tidak dipotong. |
| GAJ-11 | **Meniadakan potongan telat** dilakukan saat memeriksa perkiraan sebelum slip ditutup, **per kejadian**, oleh **pemilik saja**, dengan alasan wajib dan tercatat siapa (KEH-23). HR tidak bisa meniadakan. Penjelasan telat di atas 30 menit yang disetujui muncul sebagai usulan untuk ditiadakan (KEH-66). Di slip barisnya tetap tampil dengan tanda "ditiadakan" dan alasannya, dan tidak masuk Dana Disiplin. *(Diperinci GAJ-71, 13 Oktober 2026: denda juga boleh ditiadakan.)* |
| GAJ-12 | **Lembur: Rp7.500 per jam,** satu tarif untuk semua orang, diisi di satu tempat. Tidak ada tarif per orang. Jam yang dibayar adalah jam yang disahkan (KEH-75). Di bawah 60 menit tidak dibayar; sisanya dibulatkan ke bawah per jam (sejalan KEH-70). |
| GAJ-13 | **Potongan tidak hadir**, dalam kali gaji harian, naik per hari dan berlanjut dalam satu periode, kembali ke awal tiap periode. Izin dan sakit tanpa surat: 1; 1,25; 1,5; 1,75; lalu 2. Izin mendadak: 1,25; 1,5; 1,6; 1,7; 1,8; 1,9; lalu 2. Alpha: 1,5; 2; 2,25; 2,5; 2,75; lalu 3. Sakit dengan surat dokter: hari pertama bebas, hari ke-2 dan ke-3 setengah, hari ke-4 dan seterusnya penuh. Training: selalu 1 kali, tidak naik. *(Diperinci GAJ-69 dan 70, 13 Oktober 2026.)* |
| GAJ-14 | **Tidak dipotong:** hari libur terjadwal, cuti tahunan (KEH-48), izin duka (KEH-49), dan hari tutup (KEH-79). Hari-hari itu dibayar. |
| GAJ-15 | **Kompensasi libur** hanya dibayar untuk hari libur terjadwal yang dipakai bekerja karena diminta (KEH-46), sebesar 1 gaji harian per hari, bagi jabatan yang mendapatkannya (KAR-62). Jatah libur yang tidak diambil atas kemauan sendiri tidak dibayar. Jatah libur tidak pernah diisi otomatis oleh izin, sakit, atau hari kosong. |
| GAJ-16 | **Denda:** lupa absen masuk Rp15.000, lupa absen pulang Rp5.000, tidak memilih libur Rp10.000 (KEH-31). Mulai kejadian ke-5 dalam satu periode ditambah Rp5.000 per kejadian (KEH-64). Denda dicatat sebagai baris sendiri begitu keputusannya disahkan, bukan sebagai angka di catatan absen. *(Diperinci GAJ-74, 13 Oktober 2026; denda lupa Masuk Kembali Rp5.000.)* |

### 3.3 Potongan di luar kehadiran

| No | Aturan |
|---|---|
| GAJ-17 | **Kehilangan barang dibagi per jabatan.** Tiap cabang punya persen tanggungan kantor. Sisanya (100% dikurangi persen kantor) dibagi menurut **bobot jabatan** orang yang bekerja di cabang itu pada periode itu (misalnya kepala toko 2, pramuniaga 1), sehingga jumlahnya selalu 100%. Bagian kantor ditampilkan terang. Persen dan bobot bertanggal berlaku. Tidak ada persen per orang. *(Diperinci GAJ-76 dan 77, 13 Oktober 2026.)* |
| GAJ-18 | **Sebanding hari:** orang yang masuk, berhenti, atau pindah cabang di tengah periode menanggung sebanding hari ia bekerja di cabang itu; yang pindah menanggung di tiap cabang menurut harinya. Bagiannya berakhir otomatis saat ia pindah atau berhenti. Sisa yang tidak tertagih karena hitungan ini ditanggung kantor, tidak dibebankan ke karyawan lain. *(Rumusnya GAJ-77.)* |
| GAJ-19 | Siapa yang ikut menanggung kehilangan barang adalah pengaturan jabatan. Isi awal: jabatan toko ikut; driver, kenek, dan Pemilik tidak (GAJ-09). |
| GAJ-20 | **Minus kas** ditanggung orang yang menutup shift, bersumber dari Laporan Kasir. Minus tanpa nama dibagi rata ke karyawan berjabatan tertanda di cabang itu; kantor tidak ikut menanggung. Kelebihan kas hanya menutup minus, tidak menjadi tambahan gaji. Catat tangan hanya untuk kejadian di luar Laporan Kasir. **Dilapisi KEU-55** (12 Oktober 2026): kekurangan kas dari Laporan Kasir selalu atas nama penutup shift, ditanggung penuh, tidak dibagi dan tidak dipindah; hanya bisa ditiadakan pemilik dengan alasan. Pembagian rata hanya tersisa untuk catat tangan tanpa nama di luar Laporan Kasir. Rinciannya KEU-54 dan KEU-55. *(Diperinci GAJ-78 dan 79, 13 Oktober 2026.)* |
| GAJ-21 | **Potongan Lain:** satu menu untuk ganti rugi perorangan. Jenisnya daftar yang bisa ditambah, alasan wajib, disahkan HR dan pemilik, dan boleh dicicil. *(Diperinci GAJ-80 dan 81, 13 Oktober 2026: HR mengajukan, Pemilik atau GM mengesahkan; 1–3 kali potong.)* |
| GAJ-22 | **Kasbon tidak diketik di slip.** Slip membaca cicilan yang jatuh tempo di periode itu dari menu Kasbon. Menunda atau mengubah cicilan dilakukan di menu Kasbon, dengan alasan dan pengesahan (Bab 5). |
| GAJ-23 | Halaman **Aturan Potongan** menampilkan pengaturan dan contoh hitungan dari rumus slip yang sama, bukan salinan rumus. |

### 3.4 Bonus

| No | Aturan |
|---|---|
| GAJ-24 | **Satu Buku Bonus.** Bonus jenis apa pun dicatat sebagai satu baris: siapa, jenis, nominal, tanggal kejadian, cabang, asalnya (order, laporan, penilaian), dan status. Modul lain (Logistik, Kinerja) mencatat bonusnya ke buku ini. *(Diperinci GAJ-83, 13 Oktober 2026.)* |
| GAJ-25 | **Jenis bonus adalah daftar yang bisa ditambah** (PRI-20). Tiap jenis punya pengaturan bertanggal berlaku: jabatan penerimanya, sumber dananya (GAJ-34), dan angka aturannya (persen ongkir, persen grooming, potongan telat lapor, dan seterusnya). Bonus bebas adalah salah satu jenis, dengan alasan wajib. |
| GAJ-26 | **Satu halaman Persetujuan Bonus** untuk semua jenis. Yang mengesahkan: HR dan pemilik. Bonus grooming hanya punya satu jalur. Bonus ongkir tercatat otomatis tanpa pengesahan, tetapi bisa dibatalkan dengan alasan. *(Diperinci GAJ-84 dan 85, 13 Oktober 2026.)* |
| GAJ-27 | **Semua bonus dibayar lewat slip.** Bonus bersiklus masuk slip di bulan cairnya. Kalau suatu saat ada pembayaran di luar slip, tetap tercatat di Buku Bonus dan mengalir ke keuangan dalam satu langkah di server. |
| GAJ-28 | **Bonus mengikuti cabang tempat kejadiannya,** bukan cabang orang itu saat dihitung. |
| GAJ-29 | **Bonus bersyarat** dibawa. Kriteria dan nominalnya diatur per jabatan per cabang, bertanggal berlaku. Penilaiannya dilakukan di menu bonus sebelum slip ditutup dan disimpan: kriteria mana, terpenuhi atau tidak, oleh siapa, kapan. **Dilapisi KIN-13** (12 Oktober 2026): bonus bersyarat berbentuk **Bonus Terukur**; syaratnya dinilai mesin dari data, bukan dicentang orang, dan aturannya disimpan modul Kinerja. Pengesahannya tetap di halaman Persetujuan Bonus (GAJ-26). |
| GAJ-30 | Orang yang berhenti menerima bonus yang sudah disahkan di slip terakhirnya; yang belum disahkan diproses seperti biasa. Jabatan Pemilik tidak menerima bonus, kecuali jenis yang diizinkan (GAJ-09). Kecuali yang berhenti tanpa pemberitahuan sebulan dan dikenai GAJ-58: semua bonusnya yang belum dibayar hangus. *(Dilapisi GAJ-89, 13 Oktober 2026: slip terakhir tertahan selama bonus menunggu.)* |
| GAJ-31 | Kesembilan jenis bonus sistem lama dibawa dalam bentuk yang dirapikan. Bonus promo, grooming, ongkir, bonus bebas, dan bonus bersyarat dibangun lebih dulu. **Bonus Kinerja, Bonus KPI, Ranking Disiplin, dan Tabungan Loyalitas ditunda**: dibahas belakangan sebagai jenis baru di Buku Bonus. **Dilapisi KIN-13 dan KIN-18** (12 Oktober 2026): Bonus KPI tidak lagi ditunda; ia menjadi Bonus Terukur dan dibangun bersama v3. Tiga lainnya tetap ditunda. |
| GAJ-32 | **Tabungan loyalitas** (ditunda) ditujukan untuk karyawan kontrak. Saldonya cair di slip terakhir bila orangnya berhenti sesuai prosedur, dan hangus bila berhenti tanpa pemberitahuan; keduanya disahkan HR dan pemilik. Halaman peringkat, kalau kelak dibangun, hanya menampilkan dari hitungan kehadiran yang sama dengan slip. |

### 3.5 Dana Disiplin dan Dana Tidak Hadir

| No | Aturan |
|---|---|
| GAJ-33 | **Dana Disiplin** mengumpulkan potongan telat dan semua denda disiplin (lupa absen, tambahannya, tidak memilih libur, dan denda driver dan kenek, DRV-29 dan 30). Kehilangan barang dan minus kas tidak masuk. Yang dihitung hanya uang yang **benar-benar terpotong** di slip yang sudah ditutup; potongan yang ditiadakan tidak masuk. Dana bertambah saat slip ditutup, bulanan maupun mingguan. **Ditambah 13 Oktober 2026:** denda berhenti tanpa pemberitahuan (GAJ-58) juga masuk dana ini. **Dilapisi SIS-33** (13 Oktober 2026): dana ini dan Dana Tidak Hadir dimulai dengan saldo awal dari data sistem lama. *(Diperinci GAJ-87, 13 Oktober 2026.)* |
| GAJ-34 | Dana Disiplin punya saldo. **Bonus disiplin dan bonus bersyarat** bersumber dari dana ini, dan pengesahan yang melebihi saldo **ditolak** dengan menampilkan kekurangannya. Bonus promo, grooming, dan ongkir dibayar dari uang kantor dan tidak bergantung pada saldo. Sumber dana adalah pengaturan tiap jenis bonus. Dana ini tampil sebagai pos tersendiri di keuangan (KEU-115). Untuk Bonus Terukur, sumber dana dipilih pemilik **per aturan bonus** (KIN-15); "bersumber dari Dana Disiplin" di atas bukan lagi isi tetap untuk bonus bersyarat. *(Diperinci GAJ-87, 13 Oktober 2026: satu dana perusahaan; Tersedia = Saldo − Terpesan.)* |
| GAJ-35 | **Dana Tidak Hadir**, kantong kedua yang terpisah. Masuk: potongan alpha, izin (termasuk izin mendadak), dan sakit yang benar-benar terpotong di slip tertutup. Keluar: lembur dan kompensasi libur yang dibayar pada periode yang sama. Sifatnya **laporan, bukan pagar**: keduanya ditampilkan berdampingan, dan pembayaran lembur tidak pernah ditolak karena saldo. Sisa lebihnya boleh dipindahkan pemilik ke Dana Disiplin dengan catatan, tidak otomatis. *(Diperinci GAJ-88, 13 Oktober 2026.)* |

### 3.6 Perjalanan slip

| No | Aturan |
|---|---|
| GAJ-36 | **Satu rumus, di server** (WAJ-04, PRI-12). Slip dihitung sistem untuk **semua orang sekaligus** begitu periode berakhir; tidak ada pembuatan satu per satu. Perkiraan gaji di portal memakai rumus yang sama. |
| GAJ-37 | **Tiga tahap slip:** Perkiraan (belum slip, terus diperbarui) → Ditutup (angka terkunci) → Dibayar. |
| GAJ-38 | **Satu jalan masuk ke slip:** slip membaca semua tambahan dan potongan dari menunya masing-masing (Kehadiran, Kehilangan Barang, Minus Kas, Potongan Lain, Kasbon, Buku Bonus). Tidak ada tombol "Apply", tombol sinkron, atau isian nominal di halaman slip. Semuanya masuk periode menurut **tanggal kejadiannya** (26–25). |
| GAJ-39 | **Slip menyimpan rinciannya baris demi baris:** tiap tambahan dan potongan, tanggal kejadiannya, aturan yang dipakai, dan hitungannya (misalnya total kehilangan cabang, persen, dan hasilnya). Rincian tidak dihitung ulang saat dibuka (PRI-21). |
| GAJ-40 | Slip menyimpan **cabang dan jabatan** orangnya pada periode itu; laporan memakai yang tersimpan itu. |
| GAJ-41 | **Jadwal gajian:** tanggal 26 sampai 28 karyawan melihat perkiraan akhir di portal dan boleh menyampaikan keberatan; slip ditutup paling lambat hari ke-4 setelah periode berakhir (tanggal 29; untuk periode yang berakhir 25 Februari jatuh di tanggal 1 juga); gaji dibayar tanggal 1. Tanggal-tanggal ini pengaturan. *(Dilapisi GAJ-92, 13 Oktober 2026: tutup ditekan orang; batas tutup = batas pengingat.)* |
| GAJ-59 | **Tanggal bayar tidak digeser** (keputusan pemilik 13 Oktober 2026, Tahap 3D; jenis: pelapis atas GAJ-41 dan DRV-22): hari Minggu, tanggal merah, atau hari tutup tidak memindah tanggal bayar slip bulanan maupun mingguan. Di lapangan gaji dibayar setelah ACC lisan dan sistem mencatatnya; yang menekan "Bayar" tetap pemilik atau GM (GAJ-45). Karena menandai Dibayar sering terlupa, slip yang lewat tanggal bayarnya dan belum ditandai Dibayar masuk **pengingat berantai** pemilik dan GM setiap hari sampai ditandai (TAM-22; pelapis DRV-27). *(Diperinci GAJ-99 dan 104, 13 Oktober 2026: tanggal uang dan Jadwal Bayar.)* |
| GAJ-60 | **Penyetuju keberatan slip** (keputusan pemilik 13 Oktober 2026, Tahap 3E; jenis: pelapis atas GAJ-42): diputuskan HR (saat ini dirangkap GM) atau Pemilik, lewat Mesin Pengajuan (PRI-37). Admin HR tidak ikut, karena tidak boleh melihat slip orang lain (KAR-77). Keberatan atas slip GM sendiri diputuskan Pemilik. *(Dilapisi GAJ-110, 13 Oktober 2026, disetujui 14 Oktober 2026: "uang belum diterima" diputuskan Pemilik atau GM.)* |
| GAJ-61 | **Bonus grooming dari data kasir** (keputusan pemilik 13 Oktober 2026, Tahap 3F dan 3G; jenis: pengganti LOG-75, 78, 79). Tiap jasa grooming yang **sudah diambil** di kasir menjadi satu baris Buku Bonus jenis Grooming untuk **groomer di nota itu** = persen (pengaturan jenis bonus, GAJ-25; angka awal 10%) × harga jasa sesudah diskon, dibulatkan ke bawah. Rumusnya di HRIS; angka bonus di laporan kasir hanya perkiraan (WAJ-04). Tanggalnya **tanggal kucing diambil**; cabangnya cabang nota. Yang sudah diambil tetapi belum lunas tetap berbonus (tagihannya urusan piutang di kasir). Nama groomer di kasir dipasangkan sekali ke karyawan atau pekerja lepas di HRIS; yang belum dipasangkan ditahan dan tampil di "perlu perhatian" HR. Ganti groomer, batal, atau retur di kasir: sebelum disahkan, bonus diperbarui bertanda (tanda ⚠ ganti groomer tampil di Persetujuan Bonus); sesudah disahkan, masuk daftar periksa HR (PRI-39). Tidak ada lapor manual grooming. **Pemilik yang mengerjakan grooming** menerima bonus ini (pengecualian GAJ-09), tidak disahkan dirinya sendiri, dan nominalnya hanya terlihat para pemilik (GAJ-46). Target cabang grooming, kalau dipakai, dihitung dari jumlah jasa grooming yang sudah diambil. Kucing yang diterima sebelum hari mulai v3 tetapi diambil sesudahnya ikut ditarik dan berbonus di v3, karena yang menentukan adalah tanggal diambil (PRI-39 butir 5). |
| GAJ-42 | **Keberatan karyawan** diajukan lewat tombol di portal. Sebelum slip ditutup, yang benar langsung dibetulkan di sumbernya dan perkiraan ikut berubah. Setelah slip ditutup, keberatan diterima **3 hari**, dan koreksinya masuk slip periode berikutnya sebagai baris "koreksi periode lalu". Tidak ada bayar susulan di luar slip. *(Diperinci GAJ-110, 111, 13 Oktober 2026, disetujui 14 Oktober 2026: dua macam keberatan dan pembetulannya.)* |
| GAJ-43 | **Slip seseorang tidak bisa ditutup** selama masih ada absennya yang belum ditinjau (KEH-14) atau klarifikasi dan klaim yang menunggu (KEH-69). Sistem menampilkan apa yang masih kurang. Slip orang lain tidak ikut tertahan. *(Dilapisi GAJ-89, 13 Oktober 2026: slip terakhir juga tertahan oleh bonus yang menunggu.)* *(Diperinci GAJ-93: daftar penahan, tanpa tutup paksa.)* |
| GAJ-44 | **Peringatan ke karyawan:** selama ada urusannya yang belum beres (hari tanpa keterangan, klarifikasi yang belum diajukan atau belum diputuskan), portal menampilkan peringatan bahwa gajinya bisa mundur atau tertahan, beserta daftar urusannya dan apa yang harus ia lakukan. Urusan yang menunggu HR atau pemilik tampil juga di sisi mereka. *(Diperinci GAJ-108, 13 Oktober 2026; disetujui 14 Oktober 2026.)* |
| GAJ-45 | **Siapa boleh apa,** dijaga di server, bukan di tombol: menutup slip oleh HR atau pemilik; **slip jabatan Pemilik hanya ditutup oleh pemilik**; membayar oleh **pemilik saja**. **Pengecualian** (12 Oktober 2026, pertentangan I di galian Bab 5): upah bongkaran dibayar tunai hari itu oleh finance atau pemilik. *(Dilapisi GAJ-92 dan 95, 13 Oktober 2026: slip jabatan bertanda ditutup Pemilik atau GM; buka kembali hanya Pemilik atau GM.)* |
| GAJ-46 | **Hak lihat** (menetapkan PRI-24 untuk modul ini): karyawan melihat slipnya sendiri, dan hanya yang sudah ditutup; sebelum itu yang tampil "perkiraan". HR melihat slip semua orang kecuali jabatan Pemilik; ringkasan yang dilihat HR tidak memuat gaji pemilik. Finance hanya melihat **jumlah total per periode** beserta uraiannya untuk keuangan, tidak melihat slip per orang. Gaji pemilik hanya dilihat para pemilik. *(Dilapisi GAJ-100, 13 Oktober 2026: Finance melihat Daftar Transfer; diperinci GAJ-105.)* |
| GAJ-47 | **Menutup adalah satu langkah di server:** rincian dikunci, cicilan kasbon dan potongan lain ditandai terpotong, Dana Disiplin dan Dana Tidak Hadir bertambah, bonus ditandai sudah masuk slip. Semua terjadi atau tidak sama sekali. *(Diperinci GAJ-94, 13 Oktober 2026.)* |
| GAJ-48 | **Membayar adalah satu langkah di server:** tanggal bayar, pembayar, sumber dana, dan catatan keuangan tersimpan bersama. Satu slip dibayar **sekali dan penuh**; tidak ada bayar sebagian, dan tidak bisa dibayar dua kali. Cara bayarnya di KEU-24. *(Diperinci GAJ-98, 101, 102, 13 Oktober 2026.)* |
| GAJ-49 | **Jalan keluar** (WAJ-11, PRI-04): slip yang sudah ditutup tetapi belum dibayar bisa **dibuka kembali** dengan alasan, dan semua akibat penutupannya dibalik dalam satu langkah. Pembayaran yang salah bisa dibatalkan dengan alasan lalu dibayar ulang. Slip yang sudah dibayar hanya dikoreksi dengan baris baru di slip berikutnya. Slip tidak pernah dihapus. *(Dilapisi GAJ-95, 13 Oktober 2026: buka kembali hanya Pemilik atau GM, dengan syarat.)* *(Diperinci GAJ-103, 13 Oktober 2026: batal bayar.)* |
| GAJ-50 | **Yang sudah masuk slip tertutup tidak diubah atau dihapus** (kehilangan barang, minus kas, potongan lain, bonus, denda); koreksinya baris baru di periode berikutnya. Sebelum itu baris boleh dibatalkan dengan alasan, tidak dihapus (PRI-02). Bonus yang baru disahkan setelah slip ditutup otomatis masuk slip periode berikutnya, dengan keterangan periode asalnya. |
| GAJ-51 | Slip mencatat **siapa dan kapan** pada tiap langkah: dihitung, ditutup, dibuka kembali, dibayar, pembayaran dibatalkan. |
| GAJ-52 | **Gaji bersih tidak pernah minus, dan kelebihan potongan tidak hangus.** Potongan diambil berurutan sampai gaji habis: (a) telat, tidak hadir, dan denda; (b) kehilangan barang dan minus kas; (c) potongan lain; (d) kasbon. Yang tidak tertampung dibawa ke slip berikutnya dan tampil sebagai baris "sisa potongan". Tidak ada batas minimal yang harus dibawa pulang. *(Diperinci GAJ-75, 13 Oktober 2026.)* |
| GAJ-53 | **Slip terakhir orang yang berhenti** dihitung sampai hari terakhirnya bekerja dan dibuat di jadwal biasa. Pemilik bisa memintanya dibuat lebih cepat (pengecualian atas GAJ-36). Seluruh sisa kasbon dan potongan lain ditagih di slip itu; yang tidak tertutup gajinya tercatat sebagai piutang ke mantan karyawan (Bab 5 dan 6). *(Diperinci GAJ-82, 13 Oktober 2026.)* *(Diperinci GAJ-96, 13 Oktober 2026: tutup lebih cepat.)* |
| GAJ-58 | **Berhenti tanpa pemberitahuan sebulan** (*one month notice*; keputusan pemilik 13 Oktober 2026). Aturannya: orang yang berhenti tanpa mengikuti pemberitahuan sebulan dikenai **denda sebesar gajinya**. Denda ini **tidak otomatis**: tiap kejadian **diputuskan pemilik sendiri**, dengan alasan dan tercatat (KAR-68); HR tidak bisa menetapkannya. Kalau pemilik menetapkan: (a) slip terakhir tetap dibuat dan dihitung seperti biasa (GAJ-53), supaya angkanya jelas; (b) **sisa kasbon dan Potongan Lain dipotong lebih dulu** dari gaji itu, seperti slip terakhir biasa (GAJ-53, DRV-73), supaya uang kantor kembali; (c) **seluruh sisa gaji sesudah itu** menjadi satu baris "denda berhenti tanpa pemberitahuan", yang diterima orang itu Rp0, dan uangnya masuk **Dana Disiplin** saat slip ditutup (GAJ-33); kasbon yang tetap tidak tertutup gajinya menjadi Piutang Lain (KEU-74); (d) **semua bonusnya yang belum dibayar hangus**: dibatalkan dengan alasan dan uangnya tidak keluar; (e) gaji yang sudah dibayar tidak ditarik kembali. Berlaku sama untuk slip mingguan (DRV-22). Kalau pemilik tidak menetapkan, slip terakhir berjalan biasa. Jenis: **pengecualian** atas GAJ-06, GAJ-30, dan GAJ-53. |
| GAJ-54 | **Satu bentuk slip** untuk halaman kantor, portal, dan cetakan, diambil dari rincian yang tersimpan. Karyawan melihat semua baris, dan jumlah barisnya sama dengan gaji bersih. Slip bernomor dan bisa diunduh; hanya slip tertutup yang bisa dicetak. Semua periode bisa dibuka, dimuat saat diminta (PRI-11). *(Diperinci GAJ-97, 13 Oktober 2026.)* |
| GAJ-55 | **Ringkasan dan laporan** membaca rincian slip yang tersimpan, tidak menghitung ulang. Ringkasan menjadi bagian halaman periode gaji, bukan menu terpisah. *(Diperinci GAJ-105, 13 Oktober 2026.)* |
| GAJ-56 | **Pengeluaran gaji di keuangan hanya berasal dari slip** dan tidak bisa diketik tangan. Uraiannya (gaji kotor, kasbon kembali, dana, dan seterusnya) dikirim dari slip; keuangan tidak menghitung sendiri. Rinciannya di KEU-23 dan KEU-24. **Pengecualian** (12 Oktober 2026, pertentangan I di galian Bab 5): pengeluaran upah bongkaran lahir dari Laporan Bongkaran, bukan dari slip; tetap tidak bisa diketik tangan. *(Diperinci GAJ-105, 13 Oktober 2026.)* |

### 3.7 Pengaturan dan angka awalnya

GAJ-57. Semua angka di bawah adalah pengaturan bertanggal berlaku (WAJ-07),
disimpan di satu tempat dan dibaca server. Tidak ada yang ditulis di kode.
Perubahannya diumumkan di papan perubahan aturan sebelum berlaku (PRI-29).

| Pengaturan | Angka awal | Aturan |
|---|---|---|
| Awal dan akhir periode | 26 sampai 25 | GAJ-01 |
| Pembagi gaji harian | 26 | GAJ-05 |
| Pembulatan | rupiah terdekat per baris | GAJ-07 |
| Tarif telat | Rp1.000 per menit | GAJ-10 |
| Toleransi telat | 5 menit (milik Kehadiran, KEH-22) | GAJ-10 |
| Tarif lembur | Rp7.500 per jam | GAJ-12 |
| Lembur paling sedikit dibayar | 60 menit, lalu per jam penuh | GAJ-12 |
| Pengali izin dan sakit tanpa surat | 1; 1,25; 1,5; 1,75; 2 | GAJ-13 |
| Pengali izin mendadak | 1,25; 1,5; 1,6; 1,7; 1,8; 1,9; 2 | GAJ-13 |
| Pengali alpha | 1,5; 2; 2,25; 2,5; 2,75; 3 | GAJ-13 |
| Sakit dengan surat dokter | hari 1: 0; hari 2–3: 0,5; hari 4 dan seterusnya: 1 | GAJ-13 |
| Pengali Training | 1, tidak naik | GAJ-13 |
| Kompensasi libur | 1 gaji harian per hari | GAJ-15 |
| Denda lupa absen masuk | Rp15.000 | GAJ-16 |
| Denda lupa absen pulang | Rp5.000 | GAJ-16 |
| Denda lupa Masuk Kembali | Rp5.000 (KEH-87, 154) | GAJ-74 |
| Akibat lewat batas istirahat | kosong = hanya dicatat (KEH-86) | GAJ-73 |
| Denda tidak memilih libur | Rp10.000 | GAJ-16 |
| Tambahan denda lupa absen | Rp5.000 mulai kejadian ke-5 (milik Kehadiran, KEH-64) | GAJ-16 |
| Persen kantor dan bobot jabatan untuk kehilangan barang | diisi pemilik per cabang (0–100) dan per jabatan (1–9) | GAJ-17, 77 |
| Perkiraan akhir dan masa keberatan | tanggal 26–28 | GAJ-41 |
| Batas menutup slip | hari ke-4 setelah periode berakhir | GAJ-41 |
| Tanggal gajian | tanggal 1 | GAJ-41 |
| Masa keberatan setelah ditutup | 3 hari | GAJ-42 |
| Urutan pengambilan potongan | telat, tidak hadir, denda → kehilangan, minus kas → potongan lain → kasbon; sisa potongan lebih dulu di kelompoknya | GAJ-52, 75 |
| Paling banyak kali potong Potongan Lain | 3 | GAJ-80 |
| Masa keberatan potongan (minus kas catat tangan bernama, Potongan Lain) | 3 hari sejak diberi tahu, sampai 23.59 | GAJ-81 |

### 3.8 Perincian Tahap 4E-1: komponen dan pengaturan gaji

Keputusan pemilik 13 Oktober 2026 (G1 s.d. G6, jawaban "ok" = sesuai saran).
Spec: `../work/specs/2026-10-13-gaji-bulanan-spec.md` bagian 3.1.

| No | Aturan |
|---|---|
| GAJ-62 | **Siapa mengubah gaji** (G1; jenis: pelapis atas GAJ-03): HR hanya **mengusulkan** perubahan gaji seseorang (jenis pengajuan "Usulan ubah gaji", batas waktu = batas tutup slip periode yang dipilih, lewat itu Hangus); **Pemilik atau GM** memutuskan. Perubahan oleh Pemilik atau GM langsung terjadwal dan pemilik lain diberi tahu (KAR-73). Gaji jabatan bertanda "Gaji hanya terlihat Pemilik dan GM" (KAR-83) hanya dilihat dan diubah Pemilik dan GM. GM boleh mengubah gajinya sendiri; para pemilik diberi tahu (KAR-67). Tidak ada yang memutuskan usulan untuk dirinya sendiri. |
| GAJ-63 | **Tanggal berlaku perubahan gaji** (G2; jenis: pelapis atas GAJ-04): selalu tanggal awal periode (26). **Kenaikan** boleh untuk periode berjalan selama slipnya belum ditutup; **penurunan** hanya untuk periode depan. Periode yang slipnya sudah ditutup tidak bisa dipilih (WAJ-07). Orangnya diberi tahu bahwa gajinya berubah, tanpa nominal di pemberitahuan; perubahan gaji perorangan tidak diumumkan di Papan. Satu perubahan menyimpan **paket lengkap** komponen orang itu sejak tanggalnya. *(Pengecualian GAJ-112, 13 Oktober 2026, disetujui 14 Oktober 2026: pembetulan gaji periode lalu atas keberatan.)* |
| GAJ-64 | **Dua paket Gaji Standar** (G3; jenis: pelapis atas GAJ-03 dan KAR-22): **Gaji Standar Training** dan **Gaji Standar Karyawan**, bertanggal berlaku, tidak per jabatan. Dipakai sebagai isian awal yang masih bisa diubah untuk orang baru; saat promosi Training disetujui, paket Karyawan dijadwalkan otomatis mulai periode berikutnya (komponen di luar paket dibawa). Perbedaan antarjabatan dicatat lewat komponen orang itu, misalnya Tunjangan Jabatan. |
| GAJ-65 | **Semua komponen diperlakukan sama** (G4; jenis: pelapis atas GAJ-03 dan 05): dijumlah menjadi gaji tetap sebulan, ikut gaji harian dan prorata; tidak ada tanda per komponen. Daftar jenis komponen hanya diubah Pemilik dan GM; isi awal Gaji Pokok, Tunjangan Jabatan, Tunjangan Tetap (Tunjangan Khusus tidak dibawa). Jenis yang masih dipakai tidak bisa dinonaktifkan. |
| GAJ-66 | **Menu** (G5): ditambah **Kantor › Gaji › Gaji Karyawan** (daftar gaji semua orang bergaji bulanan, tanda "Belum ada gaji", perubahan terjadwal). **Buku Upah tidak punya menu sendiri**; dilihat di tab "Upah" halaman gaji seseorang dan di Total Diterima per Orang. Di layar HR, orang berjabatan bertanda "Gaji hanya terlihat Pemilik dan GM" tidak tampil sama sekali. |
| GAJ-67 | **Mengubah pengaturan gaji** (G6; jenis: pelapis atas GAJ-57): angka yang dipakai slip **hanya mulai berlaku tanggal 26**, supaya satu slip memakai satu angka untuk satu aturan; pengaturan jadwal mengenai periode yang belum mulai (PRI-34). Pemilik dan GM mengubah langsung; HR mengusulkan. Yang menyangkut karyawan diumumkan sebelum berlaku (PRI-35). |

### 3.9 Perincian Tahap 4E-2: hitungan dari kehadiran

Keputusan pemilik 13 Oktober 2026 (K1 s.d. K5, jawaban "ok" = sesuai saran).
Spec: `../work/specs/2026-10-13-gaji-bulanan-spec.md` bagian 3.2.

| No | Aturan |
|---|---|
| GAJ-68 | **Satu fungsi hitungan kehadiran** (jenis: pelapis atas GAJ-05 s.d. 16 dan 36): semua rupiah dari kehadiran (gaji tetap dan prorata, telat, tidak hadir, lembur, kompensasi libur, denda, koreksi periode lalu) keluar dari satu fungsi di server, dipakai perkiraan, penutupan slip, contoh Aturan Potongan, dan koreksi periode lalu. Angka aturan dan perlakuan jabatan dibaca **menurut tanggal kejadian**. Gaji harian selalu dari gaji tetap sebulan penuh, bukan yang diprorata. Pembulatan sekali pada **jumlah tiap baris** (satu baris per jenis per periode), bukan per hari (GAJ-07). |
| GAJ-69 | **Tangga potongan tidak hadir** (K1; jenis: pelapis atas GAJ-13): tiga tangga **terpisah**, masing-masing berlanjut sepanjang periode dan kembali ke awal tiap periode: (a) izin keperluan dan sakit tanpa surat, (b) izin mendadak, (c) alpha. Sakit dengan surat dokter dihitung **per periode**: hari sakit-dengan-surat pertama di periode itu bebas, ke-2 dan ke-3 setengah, ke-4 dan seterusnya penuh, walaupun sakitnya terpisah-pisah. Izin duka hari ke-3 dan seterusnya mengikuti jenis yang diajukan (KEH-146). |
| GAJ-70 | **Training** (K2; jenis: pelapis atas GAJ-13): pengali **1** untuk izin, sakit tanpa surat, izin mendadak, **dan alpha**, tidak naik. Sakit dengan surat dokter tetap memakai aturan surat (GAJ-69), karena lebih ringan. Status Training dibaca per periode (promosi berlaku awal periode, KAR-22). |
| GAJ-71 | **Denda kehadiran boleh ditiadakan** (K3; jenis: pelapis atas GAJ-11 dan 16): denda lupa absen masuk, lupa absen pulang, lupa Masuk Kembali, dan tidak memilih libur dapat ditiadakan seperti potongan telat: hanya **Pemilik atau GM**, satu kejadian per keputusan, alasan wajib, sebelum slip ditutup, tidak untuk miliknya sendiri. Barisnya tetap tampil bertanda "ditiadakan" dan tidak masuk Dana Disiplin. HR tidak bisa meniadakan (batas keras). Usulan tiadakan telat dari penjelasan (KEH-66) yang belum diputuskan saat slip ditutup berarti **tetap dipotong**; slip tidak tertahan karenanya. |
| GAJ-72 | **Koreksi periode lalu** (K4; jenis: pelapis atas GAJ-49, 50 dan PRI-04): perubahan yang mengenai periode yang slipnya sudah ditutup (koreksi susulan absen, pencabutan, hari tutup mundur, surat dokter susulan, denda terlambat) dihitung dengan menjalankan ulang fungsi GAJ-68 untuk periode lama memakai **angka aturan dan gaji periode lama**. Selisih tiap jenis menjadi satu baris "Koreksi [jenis] periode [nama]" di slip periode berjalan, **dua arah**: kurang bayar menjadi tambahan, lebih bayar menjadi potongan yang ikut urutan dan sisa potongan (GAJ-52). Slip lama tidak diubah. |
| GAJ-73 | **Akibat lewat batas istirahat** (K5; menjawab KEH-86): pengaturan bertanggal berlaku ini **kosong** (hanya dicatat Kehadiran, tanpa rupiah). Fungsi GAJ-68 sudah membacanya; bila kelak diisi, menjadi jenis baris denda kehadiran dan diumumkan lewat Papan (PRI-35). Ditinjau setelah ada data dua periode. |
| GAJ-74 | **Baris denda** (jenis: perincian GAJ-16, KEH-154, 158): ditulis server saat penjelasan lupa absen disahkan (termasuk pengajuan terlambat) dan saat tanda "tidak memilih libur" dicatat; bertanggal kejadian (denda tidak memilih libur bertanggal 26, masuk periode yang baru mulai). Tambahan kejadian ke-5 berlaku per jenis lupa absen, termasuk lupa Masuk Kembali (Rp5.000 dasar). Bila dicabut, baris dibatalkan, urutan ke-n dihitung ulang, dan baris yang berubah dibatalkan lalu ditulis ulang, tidak ditimpa. Kejadian yang periodenya sudah ditutup masuk slip berikutnya dengan keterangan periode asal (GAJ-50). |

### 3.10 Perincian Tahap 4E-3: potongan di luar kehadiran

Keputusan pemilik 13 Oktober 2026 (P1 s.d. P4, jawaban "ok" = sesuai saran;
ditambah "stock opname itu sebulan sekali"). Spec:
`../work/specs/2026-10-13-gaji-bulanan-spec.md` bagian 3.3.

| No | Aturan |
|---|---|
| GAJ-75 | **Satu fungsi potongan, urutan, dan sisa potongan** (jenis: perincian GAJ-52, DRV-24): semua rupiah potongan di luar kehadiran dan urutan pengambilan keluar dari satu fungsi di server, dipakai perkiraan, penutupan slip bulanan dan mingguan, dan contoh Aturan Potongan. Pendapatan slip = gaji tetap + lembur + kompensasi libur + bonus + koreksi plus. Potongan diambil per kelompok (a) telat, tidak hadir, denda, dan koreksi minus jenis itu; (b) kehilangan barang dan minus kas; (c) Potongan Lain; (d) kasbon. Di tiap kelompok **sisa potongan dari slip sebelumnya diambil lebih dulu**, lalu yang baru menurut tanggal kejadian. Yang tertampung sebagian dipotong sebagian; sisanya dibawa ke slip utama berikutnya dengan **jenis asal dan periode asal** tercatat. Dana Disiplin, Dana Tidak Hadir, Dana Kasbon, dan tanda cicilan terpotong hanya menghitung bagian yang benar-benar terpotong, pada slip tempat ia terpotong. Potongan Lain dan kasbon hanya dari slip utama (DRV-04, 05). Jabatan Pemilik dan GM tidak kena satu pun potongan bagian ini (GAJ-09). |
| GAJ-76 | **Mencatat kehilangan barang** (P1; jenis: perincian GAJ-17): HR, Pemilik, atau GM mencatat per kejadian: cabang, **tanggal ditemukan**, nilai, keterangan, dan **foto atau berkas hasil opname (wajib)**. Catatan HR adalah usulan yang disahkan Pemilik atau GM; catatan Pemilik atau GM langsung berlaku. Kehilangan masuk periode tanggal ditemukan; stock opname dilakukan **sebulan sekali** (ditegaskan pemilik), jadi satu opname = satu periode. Tiap orang yang menanggung diberi tahu bagiannya. Usulan yang belum disahkan saat slip ditutup tidak hangus; bila disahkan kemudian, bagiannya masuk slip berikutnya dengan keterangan periode asal (GAJ-50). |
| GAJ-77 | **Rumus pembagian kehilangan barang** (jenis: perincian GAJ-17, 18): bagian seseorang = nilai × (100% − persen kantor) × bobot ÷ jumlah bobot × hari ÷ jumlah hari periode. **Yang ikut** = orang yang ditempatkan di cabang itu sekurang-kurangnya sehari dalam periode itu dengan jabatan bertanda "ikut menanggung kehilangan barang"; **jumlah bobot** = bobot mereka semua, dihitung penuh; **bobot** = bobot jabatannya pada hari terakhir ia di cabang itu dalam periode; **hari** = hari kalender ia ditempatkan di cabang itu (libur, izin, sakit, cuti ikut; perbantuan tidak memindah tanggungan). Bagian kantor = nilai − jumlah bagian orang, tampil sebagai tiga angka: persen kantor, sisa sebanding hari, pembulatan. Akibatnya pergantian orang di tengah periode menambah bagian kantor, tidak menambah bagian teman. Kehilangan yang disahkan sesudah slip periodenya ditutup tetap dibagi menurut orang periode itu; bagian orang yang sudah tidak punya slip berikutnya ditanggung kantor. Persen kantor (0–100) dan bobot (1–9) bilangan bulat, bertanggal berlaku mulai tanggal 26 (GAJ-67). |
| GAJ-78 | **Minus kas dari Laporan Kasir di slip** (jenis: perincian GAJ-20, KEU-54, 55): slip membaca selisih kasir milik Keuangan per orang per periode: kekurangan berstatus Tetap atau Keberatan menunggu, dikurangi kelebihan orang itu di periode yang sama, paling kecil Rp0. Kelebihan hanya menutup kekurangan dari Laporan Kasir. Keberatan yang belum diputuskan saat slip ditutup berarti tetap terpotong; bila kemudian ditiadakan, uangnya kembali sebagai baris koreksi plus di slip berikutnya. |
| GAJ-79 | **Minus kas catat tangan** (P2; jenis: perincian GAJ-20): hanya untuk kejadian di luar Laporan Kasir, dengan alasan wajib yang menjelaskannya. HR atau finance mencatat sebagai usulan; Pemilik atau GM mengesahkan (catatan mereka langsung berlaku). **Bernama:** ditanggung penuh orang itu, dengan keberatan GAJ-81. **Tanpa nama:** dibagi rata ke orang yang **hadir** di cabang itu pada tanggal kejadian dan jabatannya bertanda "ikut menanggung kehilangan barang" (tanda yang sama; tidak ada tanda baru); bila tidak ada, catatan ditolak dan harus diberi nama. Kantor tidak ikut menanggung, kecuali selisih pembulatan. Uang yang bercampur antarshift tetap tidak dibebankan ke siapa pun (KEU-51). |
| GAJ-80 | **Potongan Lain** (P3; jenis: perincian GAJ-21): HR mengajukan; Pemilik atau GM mengesahkan (ajuan mereka langsung berjalan); tidak ada yang mengajukan atau mengesahkan untuk dirinya sendiri. Jenisnya daftar yang bisa ditambah, isi awal **Ganti rugi barang rusak, Ganti rugi peralatan, Lainnya**, diubah Pemilik dan GM. Alasan wajib. **1 sampai 3 kali potong** (pengaturan, sama dengan kasbon DRV-59); jadwal dibuat server seperti DRV-65; cicilan pertama di slip utama periode saat disahkan, atau berikutnya bila slip itu sudah ditutup. Sisa tidak disimpan, dihitung dari cicilan. Jadwal yang belum terpotong boleh diubah Pemilik atau GM dengan alasan; sesudah cicilan pertama terpotong tidak bisa dibatalkan, hanya dihapuskan sisanya oleh Pemilik atau GM sebagai beban. |
| GAJ-81 | **Keberatan potongan** (P2, P3; jenis: pelapis): orang yang dibebani minus kas catat tangan bernama atau Potongan Lain boleh mengajukan keberatan sampai 23.59 hari ke-3 sejak diberi tahu, lewat Mesin Pengajuan. Diputuskan Pemilik atau GM (bukan dirinya sendiri): **Tetap** atau **Ditiadakan**, alasan wajib. Selama menunggu potongan berjalan dan slip tidak tertahan; bila Ditiadakan sesudah terpotong, uangnya kembali sebagai koreksi plus di slip berikutnya. Kehilangan barang tidak punya keberatan perorangan (lewat keberatan slip, GAJ-42); selisih kasir memakai keberatan Keuangan (KEU-55). |
| GAJ-82 | **Sisa potongan di slip terakhir** (P4; jenis: perincian GAJ-53 dan pelapis atas GAJ-52): seluruh sisa kasbon dan Potongan Lain masuk slip terakhir. Yang tetap tidak tertampung: kelompok (a) telat, tidak hadir, denda **tidak ditagih** (tercatat "tidak tertagih", tidak masuk dana mana pun); kelompok (b), (c), (d) menjadi **Piutang Lain** satu baris per jenis, lahir otomatis saat slip ditutup (KEU-74). Untuk GAJ-58: slip dihitung dengan urutan yang sama, lalu seluruh gaji bersih yang tersisa menjadi baris denda berhenti tanpa pemberitahuan. |

### 3.11 Perincian Tahap 4E-4: Buku Bonus dan dua dana

Keputusan pemilik 13 Oktober 2026 (B1 s.d. B6, jawaban "ok" = sesuai saran).
Spec: `../work/specs/2026-10-13-gaji-bulanan-spec.md` bagian 3.4.

| No | Aturan |
|---|---|
| GAJ-83 | **Satu pintu tulis Buku Bonus** (jenis: perincian GAJ-24, 25, 29, 31): semua bonus masuk lewat satu fungsi di server yang menerima dasar hitungan (bukan nominal), menghitung nominal dari pengaturan yang berlaku pada tanggal kejadian, dan mencegah dobel lewat kunci asal. Jenis awal: **Grooming** (GAJ-61, lahir Menunggu), **Ongkir** (LOG-76, lahir Disahkan tanpa pengesahan, bisa dibatalkan), **Promo** (KIN-26, lahir Disahkan karena laporannya sudah diperiksa), **Bonus Terukur** (KIN-13, lahir Menunggu saat rapor ditetapkan), **Bonus Bebas** (diketik). Jenis baru tambahan Pemilik atau GM selalu jenis ketik. Jabatan GM tidak menerima bonus apa pun (KAR-67); jabatan Pemilik hanya jenis bertanda boleh (isi awal Grooming). Penerima di luar jabatan penerima: baris **Ditahan** dan masuk "perlu perhatian" HR. Saat Disahkan lahir satu baris Buku Upah (DRV-84). |
| GAJ-84 | **Bonus Bebas** (B1; jenis: perincian GAJ-25, pelapis GAJ-26): HR mengajukan (pengajuan "Usulan bonus", tidak hangus); Pemilik atau GM mengesahkan, catatan mereka langsung berlaku; tidak untuk diri sendiri; alasan wajib. Sumber dana dipilih **per baris**: Uang kantor atau Dana Disiplin. |
| GAJ-85 | **Pengesahan berkelompok** (B2, B5; jenis: **pengecualian PRI-40 butir 1** untuk baris bonus yang lahir dari data; pelapis GAJ-26): bonus Grooming disahkan sekaligus **per groomer per periode** (baris bertanda ⚠ diputuskan satu per satu dulu); Bonus Terukur disahkan **per aturan per periode**, semua orang yang memenuhi sekaligus, orang tertentu boleh dikeluarkan dengan alasan. Tombol ditahan 3 detik. Tidak ada pengesahan lintas orang atau lintas aturan. |
| GAJ-86 | **Bonus masuk slip utama** (B3; jenis: pelapis tabel DRV-02 dan DRV-03 untuk bonus): orang berslip utama bulanan di periode tanggal kejadian; berslip utama mingguan di minggu upah tanggal kejadian, atau minggu berikutnya bila sudah ditutup. Disahkan sesudah slip tujuannya ditutup: slip utama berikutnya dengan keterangan periode asal (GAJ-50). |
| GAJ-87 | **Dana Disiplin** (B4, B5; jenis: perincian GAJ-33, 34): **satu dana untuk perusahaan**, rincian asal per cabang tampil. Saldo dihitung dari mutasi yang ditulis server saat slip ditutup (masuk: telat, denda kehadiran, denda driver dan kenek, denda GAJ-58, koreksi bonus minus bersumber dana, sebesar yang terpotong; keluar: bonus bersumber dana yang masuk slip, koreksi plus telat atau denda); dibalik bila slip dibuka kembali. **Tersedia = Saldo − Terpesan** (bonus bersumber dana yang Disahkan tetapi belum masuk slip tertutup). Pengesahan melebihi Tersedia ditolak dengan menyebut kekurangannya; barisnya **tetap Menunggu**. Saldo awal sekali (SIS-33); penyesuaian dan pindah hanya Pemilik atau GM, beralasan; penyesuaian tidak boleh membuat Saldo di bawah Terpesan. Saldo tidak ditampilkan ke karyawan; Finance melihat tanpa nama orang. |
| GAJ-88 | **Dana Tidak Hadir** (jenis: perincian GAJ-35): mutasi ditulis saat slip ditutup (masuk alpha, izin, sakit; keluar lembur dan kompensasi libur; termasuk sisa potongan dan koreksi jenis itu), ditampilkan per periode per cabang dengan saldo berjalan perusahaan sejak saldo awal. Pindah ke Dana Disiplin hanya Pemilik atau GM, alasan wajib, paling banyak saldo berjalan yang positif. |
| GAJ-89 | **Bonus orang yang berhenti** (B6; jenis: pelapis GAJ-30 dan GAJ-43): slip terakhir **tertahan** selama ada bonus orang itu yang Menunggu atau Ditahan. Bonus yang lahir sesudah slip terakhir ditutup: bila belum dibayar, slip dibuka kembali (GAJ-49); bila sudah dibayar, Pemilik atau GM membayarnya **di luar slip** dalam satu langkah server (Buku Bonus, Buku Upah, keuangan; GAJ-27). GAJ-58: semua bonus yang belum dibayar menjadi Hangus dalam satu langkah, dana terpesan dilepas. *(Diperinci GAJ-106, 13 Oktober 2026: bayar di luar slip dipotongkan ke Piutang Lain lebih dulu.)* |
| GAJ-90 | **Perubahan dari kasir dan koreksi bonus** (jenis: perincian GAJ-61, LOG-76, PRI-41; pelapis GAJ-75): sebelum disahkan (Ongkir: sebelum slip ditutup) baris lama dibatalkan dan ditulis ulang bertanda; sesudahnya masuk daftar periksa HR (bonus jabatan Pemilik: Pemilik atau GM), **Terima perubahan** atau **Biarkan**. Koreksi bonus minus diambil di **kelompok (c)** bersama Potongan Lain; di slip terakhir sisanya menjadi Piutang Lain. |

### 3.12 Perincian Tahap 4E-5a: tutup slip

Keputusan pemilik 13 Oktober 2026 (S1 s.d. S4, jawaban "ok" = sesuai saran).
Spec: `../work/specs/2026-10-13-gaji-bulanan-spec.md` bagian 3.5.

| No | Aturan |
|---|---|
| GAJ-91 | **Satu fungsi hitung slip dan slip lahir sebagai Perkiraan** (jenis: perincian GAJ-36, 37, 39): satu fungsi server "hitung slip (orang, periode)" memanggil hitungan kehadiran (GAJ-68), fungsi potongan (GAJ-75), dan Buku Bonus (GAJ-86), dan dipakai perkiraan, halaman periode, Pendapatan Saya, dan langkah tutup. Selama Perkiraan angka tidak disimpan; menutup = menjalankan fungsi itu sekali lagi dan menyimpan hasilnya baris demi baris, sehingga angka terkunci sama dengan perkiraan terakhir. Kerangka slip Perkiraan dibuat mesin untuk tiap orang berslip utama bulanan yang ditempatkan sekurang-kurangnya sehari di periode itu (GAJ-02). |
| GAJ-92 | **Menutup ditekan orang** (S1; jenis: pelapis atas GAJ-41 dan 45): slip ditutup HR, Pemilik, atau GM, tidak oleh mesin; slip jabatan bertanda "Gaji hanya terlihat Pemilik dan GM" hanya oleh Pemilik atau GM, dan GM boleh menutup slipnya sendiri (para pemilik diberi tahu). Bisa per orang atau "Tutup semua yang siap"; tiap slip satu langkah tersendiri, yang gagal tidak membatalkan yang lain. Tombol aktif sesudah akhir masa keberatan perkiraan (isi awal tanggal 29 pukul 00.00). Batas tutup adalah batas pengingat, bukan pagar: mulai batas itu pengingat berantai (TAM-22) ke HR, Pemilik, GM setiap hari sampai semua slip periode itu ditutup. |
| GAJ-93 | **Penahan slip tanpa tutup paksa** (S2; jenis: perincian dan pelapis atas GAJ-43, 89, KAR-68): penahannya hanya (1) absen luar titik belum diputus, (2) penjelasan menunggu, (3) klaim lembur menunggu, (4) belum ada gaji berlaku, (5) slip terakhir: bonus Menunggu atau Ditahan, (6) slip terakhir: usulan berhenti tanpa pemberitahuan belum diputuskan. Dibaca dari satu fungsi server. Usulan tiadakan, keberatan potongan, keberatan selisih kasir, usulan potongan, dan usulan bonus tidak menahan. Tidak ada tutup paksa: slip tertahan ditutup begitu penahannya diputuskan, lalu dibayar menyusul; penyelesai penahan diingatkan setiap hari. |
| GAJ-94 | **Isi langkah tutup** (jenis: perincian GAJ-39, 40, 47, 51, DRV-84): dalam satu langkah server: periksa hak dan penahan; hitung; simpan slip (nomor, cabang dan jabatan pada hari terakhir bekerja di periode itu, jumlah, siapa, kapan, akhir masa keberatan) dan baris slip dengan rinciannya; gaji tetap lahir di Buku Upah satu baris per komponen; sumber yang masuk slip ditandai; cicilan Potongan Lain dan kasbon ditandai terpotong sebesar yang terpotong; sisa potongan lama ditandai dan yang baru ditulis Dibawa; slip terakhir menulis Tidak tertagih dan Piutang Lain (GAJ-82); mutasi kedua dana ditulis; bonus menjadi Masuk slip; usulan tiadakan yang belum diputuskan menjadi Tetap dipotong; catatan hari kerja orang itu terkunci. Semua terjadi atau tidak sama sekali. Slip bersih Rp0 ditutup biasa. |
| GAJ-95 | **Buka kembali** (S3; jenis: pelapis atas GAJ-49): hanya **Pemilik atau GM**, alasan wajib, tombol ditahan 3 detik; tidak membuka slipnya sendiri kecuali GM; para pemilik diberi tahu. HR tidak bisa membuka kembali (batas keras), hanya **Minta buka kembali**. Ditolak bila slip sudah Dibayar, bila slip utama berikutnya milik orang itu sudah ditutup, atau bila Piutang Lain dari slip terakhir itu sudah ada cicilannya; yang ditolak dikoreksi di slip berikutnya atau lewat Piutang Lain. Semua akibat GAJ-94 dibalik dalam satu langkah; baris lama disimpan sebagai versi lama; nomor tetap, versi bertambah. Boleh membuat Tersedia Dana Disiplin minus (pengesahan bonus bersumber dana ditolak sampai cukup; Pemilik dan GM diberi tahu). Karyawan diberi tahu "sedang dibetulkan" beserta alasannya; masa keberatan dihitung ulang dari penutupan baru. |
| GAJ-96 | **Slip terakhir lebih cepat** (S4; jenis: perincian GAJ-53): **Pemilik atau GM** menekan Tutup lebih cepat, alasan wajib, mulai pukul 00.00 sesudah hari terakhir bekerja dan hanya bila penahan kosong. Dihitung sampai hari terakhir bekerja (GAJ-06); seluruh sisa kasbon dan Potongan Lain ditagih (GAJ-82); keberatan 3 hari sejak ditutup. Kehilangan barang periode itu yang ditemukan sesudahnya: bagian orang itu ditanggung kantor (GAJ-77). Koreksi dan bonus susulan: buka kembali bila belum dibayar; sesudah dibayar, plus dibayar di luar slip (GAJ-89), minus menjadi Piutang Lain. *(Diperinci GAJ-106, 13 Oktober 2026.)* |
| GAJ-97 | **Bentuk dan nomor slip** (jenis: perincian GAJ-54, 21): satu bentuk untuk kantor, portal, dan cetakan: kepala, pendapatan, potongan menurut kelompok (a) s.d. (d) dengan tiga angka (nominal, terpotong, sisa dibawa), bersih, catatan; tiap baris bisa dibuka rinciannya. Nomor `SB-[tahun][bulan]-[urut]` untuk bulanan dan `SM-[tanggal Kamis akhir minggu upah]-[urut]` untuk mingguan, diberikan saat pertama ditutup dan tidak berubah saat ditutup ulang. Hanya slip tertutup yang dicetak (A4, PDF); tiap cetak dan unduh dicatat. |

### 3.13 Perincian Tahap 4E-5b: bayar

Keputusan pemilik 13 Oktober 2026 (Y1 s.d. Y5, jawaban "ok" = sesuai saran).
Spec: `../work/specs/2026-10-13-gaji-bulanan-spec.md` bagian 3.6.

| No | Aturan |
|---|---|
| GAJ-98 | **Langkah bayar** (jenis: perincian GAJ-48, KEU-24, DRV-26): hanya **Pemilik atau GM**; tidak untuk slipnya sendiri kecuali GM (para pemilik diberi tahu). Beberapa slip boleh dibayar sekaligus dari **satu tempat uang**; tiap slip satu langkah tersendiri di server, yang gagal tidak membatalkan yang lain. Satu langkah: periksa status Ditutup dan belum ada pembayaran Berlaku; simpan pembayaran sebesar **bersih slip** (tidak diketik); tulis satu baris Buku Kas lewat fungsi Keuangan (kejadian Bayar gaji, atau "Gaji pemilik dan GM" untuk jabatan bertanda, KEU-114; cabang dibebani = cabang tersimpan di slip, GAJ-40); slip menjadi Dibayar; orangnya diberi tahu tanggal dan cara bayarnya. Tidak ditolak karena saldo (KEU-106). Boleh sebelum tanggal bayar periode. Periode menjadi Lunas bila semua slipnya Dibayar. |
| GAJ-99 | **Tanggal uang** (Y1; jenis: pelapis atas DRV-26, mengikuti KEU-12): saat menandai Dibayar, tanggal uang boleh dipilih mundur sampai 7 hari (lebih jauh dengan alasan), tidak sebelum slip ditutup dan tidak masa depan; jam catat selalu dari server. Alasannya: gaji sering ditandai belakangan (GAJ-59), sedangkan saldo tempat uang harus mengikuti hari uangnya keluar. |
| GAJ-100 | **Daftar Transfer untuk Finance** (Y2; jenis: pelapis atas GAJ-46): Finance melihat, hanya untuk slip **Ditutup belum Dibayar**, nama, bank, nomor rekening, nama pemilik rekening, dan bersih; tanpa rincian slip, tanpa slip yang sudah dibayar, dan tanpa jabatan bertanda "Gaji hanya terlihat Pemilik dan GM". Tiap buka dan unduh dicatat. Finance tidak menandai Dibayar. |
| GAJ-101 | **Catatan Cepat "Gaji/Upah" dipasangkan ke slip** (Y3; jenis: perincian KEU-18, 27; pelapis GAJ-45): catatan milik Pemilik atau GM (atau dicatat finance atas nama mereka dengan lampiran) yang dipasangkan finance ke slip menjadikan slip itu Dibayar atas nama pencatatnya, dengan tempat dan tanggal uang dari catatan itu; baris Buku Kasnya adalah catatan itu sendiri. Jumlah bersih slip yang dipasangkan harus **sama persis** dengan nominal catatan. Catatan orang lain tidak bisa menjadi pembayaran gaji. |
| GAJ-102 | **Slip bersih Rp0** (Y4; jenis: pelapis atas GAJ-37 dan KEU-24): langsung Dibayar bertanda "tanpa uang" saat ditutup, tanpa baris Buku Kas dan tanpa masuk Jadwal Bayar; dibalik bila slip dibuka kembali. |
| GAJ-103 | **Batal bayar** (jenis: perincian GAJ-49): Pemilik atau GM, alasan wajib, tombol ditahan 3 detik, tidak untuk slipnya sendiri kecuali GM, kapan pun selama pembayaran Berlaku. Satu langkah: pembayaran Dibatalkan, baris Buku Kas dibatalkan lewat Keuangan (bulan tertutup: koreksi di bulan berjalan, KEU-112), pasangan Catatan Cepat dilepas, slip kembali Ditutup dan masuk Jadwal Bayar, orangnya dan para pemilik diberi tahu. Lalu dibayar ulang, atau dibuka kembali bila syarat GAJ-95 terpenuhi. |
| GAJ-104 | **Jadwal Bayar dan pengingat** (jenis: perincian DRV-81, GAJ-59, DRV-27): satu daftar untuk slip bulanan, slip mingguan, bongkaran, dan bayar di luar slip, berkelompok Lewat, Hari ini, 7 hari ke depan. **Jatuh bayar** = tanggal bayar periode, atau tanggal slip ditutup bila lebih lambat. Mulai 07.00 hari sesudah jatuh bayar, setiap hari, pengingat berantai ke Pemilik dan GM satu jendela per jalur (TAM-25) sampai semua ditandai Dibayar. Finance hanya melihat jalur bongkaran dan jumlah slip tanpa nama. |
| GAJ-105 | **Ringkasan dan uraian ke Keuangan** (jenis: perincian GAJ-46, 55, 56): satu fungsi server membaca baris slip tersimpan dan pembayarannya: jumlah slip per status, pendapatan per jenis, terpotong per kelompok, sisa dibawa, Piutang Lain, dana, bersih (dibayar per tempat uang, belum dibayar, tanpa uang), per cabang dengan baris "Gaji pemilik dan GM". Pemilik dan GM melihat semua; HR tanpa jabatan bertanda; **Finance hanya total seluruh perusahaan, tanpa per cabang dan tanpa gaji Pemilik dan GM**; Admin HR tidak. Keuangan membaca fungsi yang sama saat slip ditutup dan dibayar, tidak menghitung sendiri. |
| GAJ-106 | **Bayar di luar slip** (Y5; jenis: perincian GAJ-89, 96): bonus susulan dan koreksi plus untuk orang yang slip terakhirnya sudah Dibayar lahir otomatis sebagai tagihan di Jadwal Bayar. Bila orang itu masih punya Piutang Lain, tagihan **dipotongkan ke piutang lebih dulu** (tanpa uang bergerak); hanya sisanya dibayar Pemilik atau GM dengan uang, dalam satu langkah (Buku Bonus Dibayar di luar slip, Buku Kas, mutasi Dana Disiplin bila bersumber dana). Batal bayar membalik semuanya. |

### 3.14 Perincian Tahap 4E-5c: sisi karyawan

Keputusan pemilik 14 Oktober 2026 (C1 s.d. C5, jawaban "ok" = sesuai saran;
ditulis 13 Oktober 2026 malam sebagai draf). Spec:
`../work/specs/2026-10-13-gaji-bulanan-spec.md` bagian 3.7.

| No | Aturan |
|---|---|
| GAJ-107 | **Pendapatan Saya** (C1; jenis: perincian DRV-80 dan PRI-34 butir 5): satu halaman per periode 26–25 untuk semua jalur (slip bulanan, slip mingguan, bongkaran, bayar di luar slip). Slip mingguan tampil utuh di periode tempat Kamis akhir minggu upahnya jatuh; baris upahnya tetap di periode tanggal kejadian. Kepala tiga angka: Pendapatan periode ini, Sudah diterima, Belum diterima. Angkanya dari fungsi hitung slip (Perkiraan) dan baris slip tersimpan (tertutup), sama dengan layar kantor. |
| GAJ-108 | **Peringatan gaji bisa mundur** (jenis: perincian GAJ-44): satu fungsi server "urusan gaji saya" = penahan slip (GAJ-93) + kejadian Perlu Dijelaskan yang belum diisi. Tampil di Pendapatan Saya, slip, dan Beranda, satu baris per urusan dengan siapa yang harus bertindak ("Anda" dengan tombol, "Kantor" tanpa tombol); tidak bisa disembunyikan; hilang sendiri saat selesai. Penahan slip terakhir tampil hanya sebagai "Menunggu keputusan kantor". |
| GAJ-109 | **Slip dan status bayar di portal** (jenis: perincian GAJ-46, 54, 102, KEU-24): perkiraan tampil sepanjang periode bertanda "belum final"; slip resmi (bisa diunduh dan dikeberati) hanya yang tertutup. Status bayar menyebut tanggal uang dan cara (tunai, atau transfer ke rekening empat angka terakhir), tanpa tempat uang kantor dan nama pembayar. Slip Rp0, pembayaran dibatalkan, dan slip yang sedang dibetulkan masing-masing punya kalimatnya; versi lama tetap bisa dibuka. |
| GAJ-110 | **Dua macam keberatan slip** (C2; jenis: perincian GAJ-42, pelapis GAJ-60): **"Ada yang salah"** sejak periode berakhir sampai 23.59 hari ke-3 sesudah slip ditutup (ditutup ulang: dari penutupan terakhir), diputuskan HR, Pemilik, atau GM (GAJ-60); **"Uang belum saya terima"** sampai 23.59 hari ke-7 sesudah ditandai Dibayar, diputuskan **Pemilik atau GM**. Sebelum periode berakhir tidak ada tombol; arahannya ke sumber (Perlu Dijelaskan, koreksi absen, keberatan potongan). Satu Menunggu per macam per slip. Keberatan **tidak menahan slip** dan tidak Hangus; langkah Periksa tutup slip menyebutnya. |
| GAJ-111 | **Keputusan keberatan dan pembetulannya** (C3; jenis: perincian GAJ-42): tanpa isian nominal (GAJ-38). Ditolak dengan alasan. Disetujui = penyetuju memilih jalan pembetulan menurut keadaan slip (sumber; buka kembali; koreksi periode lalu; pembetulan gaji; batal bayar) lalu **menautkan** catatan pembetulnya. Selama belum tertaut, pengingat berantai ke penyetuju setiap hari dan, sesudah 2 hari, perlu perhatian Pemilik dan GM. Pengaju melihat sampai "Sudah dibetulkan: [baris] Rp…". |
| GAJ-112 | **Pembetulan gaji periode lalu** (C3; jenis: **pengecualian** atas GAJ-63, pelapis GAJ-72): hanya Pemilik atau GM, alasan wajib, menunjuk keberatan slip yang Disetujui (atau, bila kesalahan ditemukan kantor sendiri, alasan tertulis). Perubahan gaji asal "pembetulan" boleh bertanggal periode yang slipnya sudah ditutup; slip lama tidak diubah; selisih R1 dihitung dengan prorata periode lama dan masuk slip berjalan sebagai "Koreksi gaji tetap periode [nama]", dua arah. |
| GAJ-113 | **Unduh slip dan akses terbatas mantan karyawan** (C4; jenis: perincian GAJ-54, pelapis KAR-07 dan KAR-34): karyawan mengunduh PDF slip tertutupnya sendiri, satu atau sampai 12 periode sekaligus, tercatat; perkiraan tidak bisa diunduh. Orang yang dinonaktifkan **karena berhenti** tetap bisa masuk dengan akunnya dalam **akses terbatas** (Pendapatan Saya, slip, keberatan slip, pemberitahuan, profil) selama fungsi "masih punya urusan uang" bernilai ya: slip terakhir belum Dibayar atau Dibayar kurang dari 7 hari, keberatan menunggu atau menunggu pembetulan, atau tagihan bayar di luar slip menunggu. Sesudahnya akun tertutup penuh. |
| GAJ-114 | **Total Diterima per Orang** (C5; jenis: perincian DRV-80, GAJ-46): laporan per orang untuk 1–12 periode, termasuk mantan karyawan dan pekerja lepas bongkaran: slip bulanan, slip mingguan, bongkaran, bayar di luar slip, Diterima, Belum dibayar; slip Perkiraan tidak ikut; dibaca dari data tersimpan, tidak dihitung ulang. Pemilik dan GM semua; HR tanpa jabatan bertanda (tidak juga dalam jumlah); Finance dan Admin HR tidak. |

## 4. Yang diganti dari sistem lama

Daftar lengkap aturan sistem lama dan nasibnya ada di arsip. Yang paling mengubah
cara kerja:

| Di sistem lama | Di v3 | Aturan |
|---|---|---|
| Slip dihitung di layar pembuatnya; rumus potongan ditulis tiga kali | Satu rumus di server, untuk semua orang sekaligus | GAJ-36 |
| Slip memakai gaji terbaru tanpa melihat tanggal berlaku | Dibaca menurut tanggal berlaku | GAJ-04 |
| Prorata hanya untuk training | Untuk semua orang, gaji dan jatah libur | GAJ-06 |
| Saklar gaji flat, telat, lembur, kompensasi per orang | Pengaturan jabatan; Pemilik jabatan tersendiri | GAJ-08, 09 |
| Tarif lembur per orang, di dua tempat | Satu tarif Rp7.500 | GAJ-12 |
| Toleransi telat hanya untuk absen QR | Satu cara absen, toleransi untuk semua | GAJ-10 |
| Jatah 4 hari diisi izin, sakit, atau hari kosong; sisanya dibayar | Libur terjadwal; kompensasi hanya kalau diminta masuk | GAJ-15 |
| Denda sebagai angka di baris absen (19 dari 24 hilang) | Baris sendiri begitu disahkan | GAJ-16 |
| Potongan kehilangan persen per orang; jumlah cabang bisa bukan 100% | Bobot per jabatan, selalu 100%, sisa ke kantor | GAJ-17, 18 |
| Minus kas memakai bulan kalender | Periode 26–25 menurut tanggal kejadian | GAJ-38 |
| Kasbon dan bonus diketik di slip; tombol "Apply" | Satu jalan masuk; slip hanya membaca | GAJ-22, 38 |
| Sembilan jenis bonus di sembilan tempat, enam pintu ke slip | Satu Buku Bonus, satu jalan masuk | GAJ-24, 38 |
| Bonus yang disahkan terlambat hilang | Masuk slip periode berikutnya | GAJ-50 |
| Potongan semua dijumlah satu angka; rincian dihitung ulang | Rincian baris demi baris tersimpan | GAJ-39 |
| Status draf, disetujui, lunas; melunasi empat langkah lepas | Perkiraan, Ditutup, Dibayar; tiap langkah satu langkah di server | GAJ-37, 47, 48 |
| Slip disetujui atau lunas tidak bisa dikoreksi; bisa dihapus | Buka kembali, batal bayar, koreksi di slip berikutnya; tidak dihapus | GAJ-49 |
| Gaji bersih berhenti di Rp0, kelebihan hilang | Sisa potongan dibawa ke slip berikutnya | GAJ-52 |
| Karyawan melihat slip draf; portal tidak menampilkan semua baris | Hanya slip tertutup; semua baris tampil | GAJ-46, 54 |
| Siapa boleh apa dijaga tombol | Dijaga server | GAJ-45 |
| Kas keluar gaji bisa diketik tangan | Hanya dari slip | GAJ-56 |

## 5. Kejadian di lapangan dan jalan keluarnya

| Kejadian | Jalan keluar di v3 | Aturan |
|---|---|---|
| Gaji seseorang naik, lalu slip periode lama dibuka | Tetap memakai gaji lama; rincian tersimpan | GAJ-04, 39 |
| Karyawan masuk tanggal 11 | Gaji dan jatah libur dihitung sebagian | GAJ-06 |
| Orang berhenti lalu dinonaktifkan | Slip terakhirnya tetap dibuat | GAJ-02, 53 |
| Potongan lebih besar dari gaji | Bersih Rp0; sisanya dibawa sebagai "sisa potongan" | GAJ-52 |
| Orang berhenti masih punya sisa kasbon | Ditagih di slip terakhir; sisanya piutang | GAJ-53 |
| Orang berhenti tanpa pamit dan tanpa pemberitahuan sebulan | Pemilik memutuskan: kasbon dipotong dulu, seluruh sisa gaji menjadi denda dan masuk Dana Disiplin; bonus hangus | GAJ-58 |
| Absen dibetulkan setelah slip ditutup | Koreksi di slip berikutnya | GAJ-49, 50, PRI-04 |
| Karyawan merasa slipnya salah sebelum ditutup | Keberatan di portal tanggal 26–28; dibetulkan di sumbernya | GAJ-42 |
| Karyawan merasa slipnya salah setelah ditutup | Keberatan dalam 3 hari; koreksi di slip berikutnya | GAJ-42 |
| Telat 40 menit karena ban bocor, sudah dijelaskan | Potongan ditiadakan dengan alasan; menit tetap tampil | GAJ-11 |
| Masih ada absen di luar titik yang belum ditinjau di tanggal 29 | Slip orang itu tertahan; slip lain tetap ditutup; karyawan diberi peringatan | GAJ-43, 44 |
| Slip telanjur ditutup padahal ada yang salah, belum dibayar | Dibuka kembali dengan alasan | GAJ-49 |
| Gaji ditransfer ke rekening yang salah | Pembayaran dibatalkan dengan alasan, lalu dibayar ulang | GAJ-49 |
| Laporan promo baru disahkan setelah slip ditutup | Bonusnya masuk slip berikutnya dengan keterangan asal periode | GAJ-50 |
| Bonus disiplin melebihi saldo Dana Disiplin | Pengesahan ditolak dengan menampilkan kekurangannya | GAJ-34 |
| Saldo Dana Tidak Hadir kurang dari biaya lembur | Lembur tetap dibayar; keduanya hanya ditampilkan berdampingan | GAJ-35 |
| Pramuniaga pindah cabang tanggal 10 | Menanggung kehilangan di dua cabang sebanding hari | GAJ-18 |
| Minus kas tanpa nama penutup shift | Dibagi rata ke jabatan tertanda di cabang itu | GAJ-20 |
| Karyawan memecahkan barang dan harus mengganti | Potongan Lain, boleh dicicil | GAJ-21 |
| HR menutup slip semua orang | Slip Pemilik tidak ikut; ditutup pemilik sendiri | GAJ-45 |
| Kehilangan barang dibagi menghasilkan pecahan rupiah | Dibulatkan per baris; sisanya ditanggung kantor | GAJ-07 |

## 6. Masih terbuka

Tidak menghambat bab berikutnya, tetapi harus diputuskan sebelum spec modul ini
ditulis (Tahap 4).

1. ~~Siapa yang boleh meniadakan potongan telat~~: **pemilik saja**,
   diputuskan 12 Oktober 2026 (GAJ-11, sejalan KEH-23). Butir ini selesai.
2. ~~Cara bayar gaji~~: **diputuskan 12 Oktober 2026** di Bab 6 (KEU-24).
   Pembayar memilih sumber uangnya; foto bukti transfer dianjurkan dulu;
   tunai tanpa tanda terima kertas. Butir ini selesai.
3. **Tiga jenis bonus yang ditunda** (GAJ-31, GAJ-32, KIN-18): Bonus Kinerja,
   Ranking Disiplin, Tabungan Loyalitas. Bonus KPI sudah diputuskan 12
   Oktober 2026: menjadi Bonus Terukur (KIN-13).
4. **Isi awal bobot jabatan dan persen kantor** (GAJ-17): diisi pemilik saat
   menyiapkan tayang.

## 7. Titipan dan catatan

Untuk Bab 1 (Karyawan):

1. Status kerja "Kontrak" ditambahkan saat tabungan loyalitas dirinci (KAR-61,
   GAJ-32).

Untuk Bab 4 (Logistik):

2. Bonus ongkir dicatat ke Buku Bonus oleh modul Logistik dari nota kasir
   (LOG-76); bonus grooming dicatat modul ini dari data kasir (GAJ-61).
   Persennya pengaturan jenis bonus (GAJ-25). **Terjawab 13 Oktober 2026 (3G).**

Untuk Bab 5 (Gaji Driver dan Kasbon):

3. Saat mengajukan kasbon, karyawan memilih cara bayar (1 kali potong, 2 kali
   potong, dan seterusnya). Ada plafon, dan pengajuan **ditolak** selama plafon
   habis, tanpa menyebut sisa plafon. Yang diputuskan di sana: plafon per orang
   atau per jabatan, besarnya, paling banyak berapa kali potong, dan kapan
   plafon terisi lagi. **Terjawab** (12 Oktober 2026, galian Bab 5 bagian
   5C.10): batas per orang Rp250.000, dua Dana Kasbon Rp1.000.000, paling
   banyak 3 kali potong; kali potong yang dipilih karyawan boleh diubah
   finance (usulan) dan pemilik (keputusan). Nomor aturannya DRV-56, 57, 59,
   dan 61.
4. Cicilan yang tidak tertampung gaji tetap "belum terpotong" dan ikut slip
   berikutnya (GAJ-52); sisa kasbon orang berhenti ditagih di slip terakhir dan
   sisanya menjadi piutang (GAJ-53). Di buku Bab 5: DRV-66 dan DRV-73.

Untuk Bab 6 (Keuangan):

5. Cara bayar gaji; uraian slip yang dikirim ke keuangan; pembatalan
   pembayaran; piutang mantan karyawan (GAJ-48, 49, 53, 56).
6. Minus kas bersumber dari Laporan Kasir; penanggungnya orang yang menutup
   shift (GAJ-20).
7. Dana Disiplin tampil sebagai pos tersendiri (GAJ-34).

   Butir 5–7 **terjawab** (12 Oktober 2026) di buku Keuangan: KEU-24 (cara
   bayar dan uraian slip), KEU-16 dan KEU-23 (pembatalan), KEU-74 (Piutang
   Lain), KEU-54 dan KEU-55 (minus kas), KEU-115 (Dana Disiplin dan Dana
   Tidak Hadir).

Untuk Bab 7 (Kinerja):

8. Bonus promo dan bonus KPI dicatat ke Buku Bonus; pengesahannya di halaman
   Persetujuan Bonus (GAJ-26).

   **Terjawab** (12 Oktober 2026) di buku Kinerja: KIN-13 (Bonus Terukur),
   KIN-25 dan KIN-26 (bonus promo).

Untuk Tahap 3 dan 4:

9. Bagian 5 dijadikan daftar tes (PRI-06). Semua hitungan uang di buku ini
   wajib dites (WAJ-06), termasuk pembulatan (GAJ-07) dan urutan potongan
   (GAJ-52).
10. Mesin pengaman hak akses wajib mencoba hak lihat GAJ-46: HR tidak bisa
    membuka slip Pemilik, finance tidak bisa membuka slip per orang.

Sistem lama (tidak disentuh, WAJ-09): enam laporan promo September 2026 masih
menunggu persetujuan padahal slip September sudah ditutup. Sudah dilaporkan ke
pemilik.

## 8. Istilah

Dimasukkan ke `00-kamus-istilah.md`: gaji harian, perkiraan gaji, slip ditutup,
Buku Bonus, bonus bersyarat, Dana Disiplin, Dana Tidak Hadir, Potongan Lain,
minus kas, bobot jabatan, sisa potongan, keberatan slip.
