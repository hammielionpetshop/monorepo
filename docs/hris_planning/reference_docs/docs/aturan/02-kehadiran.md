# Buku Aturan: Kehadiran

Status: **ditetapkan 12 Oktober 2026**, kecuali yang tercantum di bagian 6
("Masih terbuka").

Nomor aturan tidak diurutkan ulang, supaya rujukan dari dokumen lain tetap benar.

File ini hanya berisi aturan yang berlaku di v3. Hasil galian sistem lama, hasil
cek database, semua pertanyaan, dan jawaban pemilik disimpan di
`arsip/02-kehadiran-galian.md` (bagian 2A s.d. 2D). Nomor KEH-A, KEH-B, KEH-C, dan
KEH-D di arsip itu adalah nomor galian sistem lama, bukan nomor aturan v3.

Kata **atasan** di buku ini berarti HR dan pemilik. Kepala cabang bukan atasan
dalam arti itu; wewenangnya disebut satu per satu (KEH-44, KEH-45).

## 1. Modul ini mengurus apa

Modul Kehadiran mencatat siapa bekerja di mana dan jam berapa setiap hari: jam
kerja dan shift, absen masuk dan pulang, libur, izin, sakit, cuti, dan lembur.
Modul ini juga mengurus cara membetulkan catatan yang salah dan cara karyawan
menjelaskan catatan yang bermasalah. Modul Gaji membaca hasilnya; modul ini
tidak menghitung rupiah.

## 2. Data yang dimiliki modul ini

| Data | Isinya |
|---|---|
| Jam kerja cabang | Nama shift, jam masuk, jam pulang, lama istirahat dan rentang jam mulainya (boleh kosong, KEH-82), tanggal mulai dan akhir berlaku |
| Jam tutup kantor | Batas paling malam untuk cabang yang tidak punya shift terakhir |
| Giliran shift | Shift tiap orang per minggu, dan kelompok gilirannya |
| Titik lokasi dan radius | Per cabang (titiknya milik data cabang, KAR-25) |
| QR cabang | Satu kode per cabang |
| Hari kerja | Satu catatan per orang per tanggal: cabang, jam kerja yang berlaku, jam masuk, jam pulang, jam istirahat dan masuk kembali, lewat batas istirahat (KEH-86), telat, pulang cepat, lembur, status hari itu (PRI-17) |
| Percobaan absen | Semua percobaan, termasuk yang di luar titik: lokasi, jarak, ketelitian, jam |
| Foto absen | Foto masuk, masuk kembali, dan pulang, disimpan tertutup |
| Jadwal libur | Tanggal libur tiap orang per periode |
| Hari tutup | Tanggal sebuah cabang, atau semua cabang, tutup |
| Pengajuan tidak masuk | Libur, tukar libur, tukar shift, izin, sakit, cuti, dengan statusnya |
| Permintaan masuk di hari libur | Siapa meminta, siapa diminta, libur penggantinya |
| Klarifikasi | Alpha, lupa absen masuk, pulang, atau masuk kembali, telat di atas 30 menit, dengan keputusannya |
| Klaim lembur | Jam terdeteksi, foto kertas, siapa yang menyuruh, jam yang disahkan |
| Koreksi absen | Nilai lama, nilai baru, alasan, siapa, kapan |
| Laporan Pulang | Serah terima (isi, penerima, foto, siapa sudah membaca), laporan masalah rahasia dan statusnya, keadaan mobil dan tindak lanjutnya (KEH-89 s.d. 95) |
| Pengaturan kehadiran | Semua angka di bagian 3.13, masing-masing bertanggal berlaku |

Pengajuan tidak masuk, permintaan masuk di hari libur, klarifikasi, dan klaim
lembur berjalan lewat **Mesin Pengajuan** milik Perlengkapan Bersama (PRI-23;
keputusan 3A, 13 Oktober 2026): mesin itu menyimpan siapa mengajukan, status,
penyetuju, alasan, dan lampiran. Modul ini menyimpan isi khas tiap jenis dan
mencatat akibatnya ke hari kerja setelah disetujui.

Yang **bukan** milik modul ini:

| Data | Milik modul |
|---|---|
| Orang, cabang, jabatan, pengaturan jabatan (kena telat, dapat lembur, kompensasi libur, libur tetap, wajib absen istirahat, penjaga cabang), Daftar Pengecualian | Karyawan (KAR-62) |
| Jalur pengajuan (status, penyetuju, lampiran) | Perlengkapan Bersama (PRI-23) |
| Nominal potongan telat, denda, upah lembur, potongan izin dan alpha | Gaji (Bab 3) |
| Hari tidak bisa jalan milik orang yang dibayar per ritase | Tidak dicatat di sistem; cukup lapor ke Kepala Gudang (LOG-15) |

## 3. Aturan

### 3.1 Jam kerja dan shift

| No | Aturan |
|---|---|
| KEH-01 | Jam kerja hanya milik cabang. Kantor (Back Office) dan Gudang punya jam kerja sendiri sebagai cabang. Tidak ada jam kerja per departemen atau per orang. |
| KEH-02 | Jam kerja punya tanggal berlaku. Mengubah jam kerja tidak mengubah hitungan absen yang sudah lewat. Jam kerja sama untuk semua hari dalam seminggu; untuk momen tertentu dibuat jam kerja dengan tanggal mulai dan akhir. |
| KEH-03 | Jam kerja tidak bisa dihapus, hanya dinonaktifkan. Setiap cabang aktif wajib punya jam kerja. |
| KEH-04 | Yang boleh mengubah jam kerja: pemilik dan HR. Setiap orang bisa melihat jam kerja cabangnya dan jadwalnya sendiri di "Jadwal Saya". |
| KEH-05 | Di cabang dengan lebih dari satu shift, tiap orang punya shift untuk satu minggu, Senin sampai Minggu. |
| KEH-06 | Sistem menggilir shift sendiri tiap Senin: yang minggu ini pagi, minggu depan siang, dan sebaliknya. Giliran awal diisi sekali. Cabang satu shift tidak digilir. Di cabang berjumlah orang ganjil, kelompok pagi dan kelompok siang diisi sekali oleh kepala cabang, lalu kedua kelompok bertukar tiap Senin. |
| KEH-07 | Telat dan lembur dinilai dari shift yang tercatat. Shift tidak pernah ditebak dari jam datang. |
| KEH-08 | Jam kerja seseorang pada satu hari mengikuti cabang tempat ia **absen masuk**, untuk seluruh hari itu (PRI-17). |
| KEH-09 | Orang yang jam kerjanya memang berbeda dari cabangnya dicatat di Daftar Pengecualian, dengan alasan dan tanggal berlaku (PRI-26). |

### 3.2 Cara absen

| No | Aturan |
|---|---|
| KEH-10 | Satu cara absen untuk semua orang: scan QR cabang, lokasi diperiksa, lalu foto diri. Orang gudang absen di gudang. **Pengecualian** (13 Oktober 2026): orang yang dibayar per ritase absen lewat trip (KEH-96). HR dan kepala cabang absen dengan cara yang sama. |
| KEH-11 | QR dicetak, satu per cabang. Pemilik dan HR bisa membuat ulang; QR lama langsung mati. |
| KEH-12 | Tiap cabang punya titik lokasi dan radius yang ditentukan pemilik. Lokasi diperiksa server. Semua percobaan dicatat, termasuk yang di luar titik. |
| KEH-13 | Urutannya: tekan absen, lokasi diperiksa, baru kamera terbuka untuk foto diri. |
| KEH-14 | Absen di luar radius **tetap dihitung**, dengan tanda "perlu ditinjau". Yang meninjau: HR dan pemilik. Kepala cabang bisa melihat (KEH-20) tetapi tidak memutuskan. Slip gaji orang itu tidak bisa ditutup selama masih ada absennya yang belum ditinjau. *(Diperinci KEH-114, 13 Oktober 2026.)* |
| KEH-15 | Foto hanya dari kamera langsung, tidak bisa dari galeri. Foto disimpan tidak terbalik, berstempel nama, jam server, cabang, titik lokasi, dan jarak. Disimpan tertutup dan dihapus setelah 60 hari; jam dan angkanya tidak ikut terhapus. |
| KEH-16 | Jam absen adalah jam server (PRI-01). Karyawan tidak bisa mengubah catatan absen; yang bisa ia lakukan hanya mengirim absen masuk, istirahat, masuk kembali, dan pulang (KEH-83). |
| KEH-17 | Layar Absen memakai **tombol berlabel** (Masuk, Istirahat, Masuk Kembali, Pulang), bukan menebak dari urutan scan; tombol yang tampil hanya yang berlaku saat itu (diubah 13 Oktober 2026, KEH-83). Masing-masing dengan layar konfirmasi. Absen pulang paling cepat 15 menit setelah absen masuk. ~~Kalau scan pertama terjadi setelah lewat separuh jam kerja, sistem bertanya "masuk atau pulang?".~~ (Diganti KEH-108, 13 Oktober 2026.) |
| KEH-18 | Absen pulang sampai pukul 04.00 hari berikutnya masuk ke hari kerja sebelumnya. |
| KEH-19 | Pola lokasi yang mencurigakan ditandai untuk pemilik dan HR. Pergeseran lokasi yang wajar dari hari ke hari tidak ikut ditandai. *(Diperinci KEH-115, 13 Oktober 2026.)* |
| KEH-20 | Ada menu "Foto Absen Hari Ini", hanya untuk melihat: kepala cabang melihat deretan foto absen cabangnya hari itu; HR dan pemilik melihat semua cabang. |

### 3.3 Telat dan pulang cepat

| No | Aturan |
|---|---|
| KEH-21 | Telat semua orang dicatat, menurut jam kerja yang berlaku pada tanggal itu (KEH-08). Dihitung server, sekali, lalu disimpan. |
| KEH-22 | Telat sampai 5 menit dicatat tetapi tidak dipotong. Berlaku untuk semua orang. Angkanya tidak diumumkan ke karyawan. |
| KEH-23 | Potongan telat bisa ditiadakan pemilik **per slip**, dengan alasan dan tercatat siapa. Telat dan nilai potongannya tetap tampil dengan tanda "ditiadakan". Rinciannya di Bab 3. |
| KEH-24 | Pulang lebih cepat dari jadwal dicatat dan ditandai, wajib dijelaskan, dan tidak dipotong. |
| KEH-25 | "Kena telat" dan "dapat lembur" adalah pengaturan jabatan (KAR-62). Isi awal: kena telat untuk semua jabatan kecuali Pemilik (KAR-59); dapat lembur untuk jabatan toko dan kantor, tidak untuk jabatan gudang, driver, dan kenek. Orang yang selamanya diperlakukan berbeda dicatat di Daftar Pengecualian. |

### 3.4 Perbantuan dan koreksi

| No | Aturan |
|---|---|
| KEH-26 | Perbantuan dipilih sendiri oleh karyawan saat scan di cabang lain ("sedang perbantuan" atau "salah scan"). Atasan diberi tahu dan daftarnya bisa dilihat. |
| KEH-27 | Setelah 7 hari kerja berturut-turut absen masuk dan pulang di cabang lain, saat absen pulang hari ke-7 karyawan ditanya "sudah pindah cabang?". Jawaban "ya" menjadi usulan pindah yang disahkan pemilik atau HR dengan satu ketukan; riwayat pindahnya dibuat otomatis (KAR-56). |
| KEH-28 | Membetulkan absen hanya lewat **satu pintu**, oleh pemilik dan HR: alasan wajib, catatan asli tidak ditimpa, siapa dan kapan tercatat. Mengisi banyak orang sekaligus memakai pintu yang sama. Finance hanya melihat. |
| KEH-29 | Yang dikoreksi adalah jam masuk dan jam pulang. Telat dan lembur dihitung ulang sistem; tidak ada angka yang diketik tangan. *(Diperinci KEH-116, 13 Oktober 2026.)* |
| KEH-30 | Orang yang tidak bisa absen karena handphone atau kameranya bermasalah dibantu lewat pintu koreksi (KEH-28). |

### 3.5 Libur rutin

| No | Aturan |
|---|---|
| KEH-31 | Tiap orang punya **4 hari libur per periode** (26 sampai 25), dan tanggalnya wajib dipilih sendiri sebelum periode mulai. Yang tidak memilih kena denda (nominal di Bab 3); liburnya tidak diisikan HR. |
| KEH-32 | Tidak berlaku untuk jabatan yang liburnya tidak tetap (PRI-18) dan orang yang dibayar per ritase. Orang yang dibayar per ritase tidak punya jatah libur; ia memberi tahu hari ia tidak bisa jalan. |
| KEH-33 | **Jadwal libur adalah pegangan.** Tidak hadir pada hari yang bukan libur, tanpa izin, sakit, atau cuti yang disetujui, dicatat alpha. Izin dan sakit tidak mengisi jatah libur. |
| KEH-34 | Di cabang yang sama paling banyak 2 orang libur pada hari yang sama. Cabang berisi 2 orang: paling banyak 1. Cabang berisi 1 orang tetap boleh libur. Diperiksa server. |
| KEH-35 | Dalam satu periode paling banyak 1 hari libur jatuh di akhir pekan, dan antar hari libur berjarak paling sedikit 5 hari. Diperiksa server di tempat yang sama dengan KEH-34. |
| KEH-79 | Pemilik atau HR bisa memasang **hari tutup**, untuk satu cabang atau semua cabang. Pada hari tutup tidak ada yang ditandai alpha di cabang itu, dan jatah 4 hari libur tidak berkurang. Hari tutup **dibayar** (GAJ-14). |

### 3.6 Mengajukan tidak masuk

| No | Aturan |
|---|---|
| KEH-36 | Karyawan punya satu menu "Ajukan Tidak Masuk" untuk libur, tukar libur, tukar shift, izin, sakit, dan cuti. Kantor punya satu menu persetujuan (PRI-23). **Dilapisi 3C** (13 Oktober 2026; jenis: pelapis): "Ajukan Tidak Masuk" menjadi salah satu jenis di menu **Pengajuan Saya**, satu pintu untuk semua jenis pengajuan (tidak masuk, lembur, kasbon, ubah data diri); karyawan memilih jenisnya lalu mengisi (`../work/specs/2026-10-13-menu-desain.md`). **Dilapisi lagi 4D-4a** (13 Oktober 2026; jenis: pelapis): "libur" (memilih jatah 4 hari) **tidak** lewat persetujuan, langsung berlaku (KEH-131); yang lewat pengajuan adalah izin, sakit, cuti, dan ajakan tukar (penyetujunya teman, KEH-43). |
| KEH-37 | Yang memutuskan pengajuan: HR dan pemilik. *(Dilapisi KEH-131 dan 136: tidak berlaku untuk memilih libur dan ajakan tukar.)* |
| KEH-38 | Menolak selalu wajib alasan. |
| KEH-39 | Membatalkan tidak menghapus; pengajuan menjadi "dibatalkan" dan tetap terlihat (PRI-02). |
| KEH-40 | Pengajuan yang sudah disetujui bisa dibatalkan selama tanggalnya belum lewat: karyawan meminta, HR atau pemilik mengesahkan. HR atau pemilik juga bisa mencabut persetujuannya dengan alasan. |
| KEH-41 | Hari izin, sakit, dan cuti dihitung hanya pada hari kerja orang itu. Hari libur terjadwal di tengahnya tetap libur. |
| KEH-42 | Surat dokter disimpan tertutup. Kalender yang dilihat karyawan hanya menulis "tidak masuk"; rinciannya hanya untuk atasan. |
| KEH-80 | Kepala cabang dan Kepala Gudang melihat **tanggal dan status** pengajuan libur, tukar, izin, sakit, dan cuti orang di cabang atau departemennya, supaya bisa mengatur shift. Mereka tidak melihat alasan dan lampiran, dan tidak memutuskan (KEH-37). *(Tahap 3B, 13 Oktober 2026; jenis: pelapis atas KEH-42.)* |

### 3.7 Tukar dan perubahan mendadak

| No | Aturan |
|---|---|
| KEH-43 | Tukar libur atau tukar shift: karyawan memilih teman yang diajak tukar. Kalau teman menerima, jadwal keduanya langsung berubah, tanpa persetujuan dan tanpa pemberitahuan ke atasan. Atasan bisa melihatnya, dan ada laporan jumlah tukar per orang per periode. Jumlah tukar tidak dibatasi. |
| KEH-44 | Tukar harus sudah diterima teman paling lambat H-2. Ajakan yang ditolak, atau tidak dijawab sampai batas itu, batal otomatis; pengaju diberi tahu dan bisa mengajukan izin biasa. |
| KEH-45 | Kepala cabang dan HR boleh mengubah shift atau libur seseorang langsung saat keadaan mendadak: alasan wajib, orangnya diberi tahu, perubahannya tercatat. |
| KEH-46 | **Masuk di hari libur** hanya kalau diminta kepala cabang atau HR, dan permintaannya tercatat. Libur pengganti dipilih karyawan dan tetap diperiksa KEH-34. Datang sendiri tanpa diminta tidak memindah libur. |

### 3.8 Cuti, izin, dan sakit

| No | Aturan |
|---|---|
| KEH-47 | Jenisnya: cuti tahunan, sakit tanpa surat, sakit dengan surat dokter, izin keperluan, izin duka, izin mendadak. |
| KEH-48 | Cuti tahunan **10 hari setahun**, terpisah dari 4 hari libur, diajukan paling lambat **H-7**. Tahun cuti dihitung dari **tanggal bergabung** masing-masing orang (KAR-01), bukan dari Januari. Cuti baru boleh diambil setelah **masa kerja 1 tahun penuh**; sebelum itu jatahnya belum ada. Sisa cuti yang tidak dipakai sampai tahun cutinya habis **hangus**, dan **tidak bisa diganti uang**. Hari cuti tahunan yang diambil **tetap dibayar** (gaji tidak dipotong). |
| KEH-49 | Izin duka karena ayah, ibu, suami, istri, atau anak meninggal: dipilih saat mengajukan, otomatis bebas **2 hari dan tetap dibayar**. Keluarga lain memakai izin biasa. |
| KEH-50 | Izin keperluan diajukan paling lambat H-2. Sakit tanpa surat paling lama 2 hari berturut-turut. Akibat uangnya di Bab 3. *(Dilapisi KEH-141 s.d. 143: batas waktu sakit, label izin mendadak, sakit lebih dari 2 hari.)* |
| KEH-51 | Surat dokter boleh menyusul, paling lambat 3 hari sejak masuk kerja kembali. Lewat itu dicatat sakit tanpa surat. *(Dirinci KEH-143, 144.)* |

### 3.9 Alpha

| No | Aturan |
|---|---|
| KEH-52 | Alpha ditandai server secara otomatis setiap hari, tidak bergantung pada siapa membuka halaman apa. Kalau penandaan gagal, pemilik diberi tahu (mesin pengaman error, WAJ-06). *(Diperinci KEH-150, 13 Oktober 2026.)* |
| KEH-53 | Siapa yang ditandai alpha ditentukan pengaturan jabatan dan jenis upah, bukan nama jabatan atau cabang (WAJ-05). |
| KEH-54 | Alpha hanya punya satu pintu perbaikan, yaitu klarifikasi, dengan pilihan: sakit tanpa surat, sakit dengan surat, lupa absen (sebenarnya hadir), izin mendadak. "Pakai jatah libur" tidak ada. *(Diperinci KEH-153, 13 Oktober 2026.)* |
| KEH-55 | Tidak masuk lebih dari 7 hari berturut-turut karena sakit tanpa surat, izin, atau alpha: HR dan pemilik diberi tanda pada hari ke-7. Tidak ada penonaktifan otomatis; menonaktifkan diputuskan manusia lewat KAR-07. Sama dengan KAR-08. *(Diperinci KEH-157, 13 Oktober 2026.)* |

### 3.10 Klarifikasi

| No | Aturan |
|---|---|
| KEH-56 | Karyawan punya satu menu "Perlu Dijelaskan" untuk alpha, lupa absen masuk, lupa absen pulang, telat di atas 30 menit, dan pulang cepat. Persetujuannya ada di menu persetujuan yang sama dengan KEH-36. *(Diperinci KEH-151, 13 Oktober 2026.)* |
| KEH-57 | Yang mengesahkan semua klarifikasi: HR dan pemilik. |
| KEH-58 | Batas waktu semua klarifikasi: **3 hari** setelah tanggalnya. Sistem mengingatkan sebelum batas itu, dengan menyebut akibatnya (PRI-07). *(Diperinci KEH-151, 13 Oktober 2026.)* |
| KEH-59 | Alpha yang tidak diklarifikasi dalam 3 hari tetap alpha. *(Diperinci KEH-155, 13 Oktober 2026.)* |
| KEH-60 | Lupa absen yang lewat 3 hari masih bisa diajukan lewat **pengajuan terlambat**: wajib alasan, tercatat sebagai terlambat, disahkan HR atau pemilik. *(Diperinci KEH-155, 13 Oktober 2026.)* |
| KEH-61 | Telat di atas 30 menit yang tidak dijelaskan dalam 3 hari: potongannya tetap berlaku. *(Diperinci KEH-155, 13 Oktober 2026.)* |
| KEH-62 | Cuti atau izin yang ditolak setelah tanggalnya lewat: 3 hari dihitung dari saat penolakan. |
| KEH-63 | Lupa absen masuk atau pulang: karyawan mengisi jam dan alasan. Jam itu selalu bertanda "diisi lewat klarifikasi". Sebelum disahkan, hari itu "belum lengkap" dan tanpa lembur. *(Diperinci KEH-154, 13 Oktober 2026.)* |
| KEH-64 | Lupa absen masuk dan lupa absen pulang dikenai denda administrasi per kejadian (nominal dasar di Bab 3). Mulai kejadian ke-5 dalam satu periode, tiap kejadian kena denda dasar ditambah **Rp5.000**; tambahannya tetap, tidak naik lagi. Lupa masuk dan lupa pulang dihitung terpisah. Pengajuan tidak ditolak karena jumlahnya, dan orang yang hadir tetap dicatat hadir. *(Diperinci KEH-154, 13 Oktober 2026.)* |
| KEH-65 | Orang yang lupa absen lebih dari 4 kali dalam satu periode muncul di laporan untuk pemilik. *(Diperinci KEH-157, 13 Oktober 2026.)* |
| KEH-66 | Penjelasan telat di atas 30 menit yang disetujui menjadi usulan "potongan ditiadakan" di slip orang itu (KEH-23). Menit telatnya tetap tercatat dan tampil. |
| KEH-67 | Klarifikasi yang disetujui tidak menimpa catatan asli. Status asal dan angka aslinya tetap tersimpan (PRI-02). |
| KEH-68 | Keputusan atas klarifikasi dan klaim bisa dicabut dengan alasan, selama slip periode itu belum ditutup. Sesudah ditutup, yang salah dikoreksi di periode berikutnya (PRI-04). *(Diperinci KEH-158, 13 Oktober 2026.)* |
| KEH-69 | Slip seseorang tidak bisa ditutup selama masih ada klarifikasi atau klaim miliknya yang menunggu. *(Diperinci KEH-158, 13 Oktober 2026.)* |

### 3.11 Lembur

| No | Aturan |
|---|---|
| KEH-70 | Lembur dihitung dari jam pulang dikurangi jam pulang jadwal: hanya jam penuh, paling sedikit 1 jam, paling banyak 3 jam sehari. *(Diperinci KEH-159 s.d. 167, 13 Oktober 2026.)* |
| KEH-71 | Lembur dihitung paling jauh sampai **jam tutup cabang**. Jam tutup toko adalah jam pulang shift terakhir cabang itu, diturunkan dari jam kerja dan tidak disimpan terpisah. Jam tutup kantor disimpan sebagai pengaturan cabang, paling lambat 20.00. Akibatnya shift terakhir tidak pernah dapat lembur. *(Diperinci KEH-159 s.d. 167, 13 Oktober 2026.)* |
| KEH-72 | Saat absen pulang melewati jam kerja, sistem langsung bertanya "ini lembur?". Sehari sebelum hangus, karyawan diingatkan (PRI-07). *(Diperinci KEH-159 s.d. 167, 13 Oktober 2026.)* |
| KEH-73 | Lembur yang terdeteksi belum dibayar sampai diklaim. Klaim wajib melampirkan **foto kertas lembur** dan mengisi **siapa yang menyuruh**. Yang dipilih nama orangnya, dari daftar yang hanya berisi orang berjabatan "boleh menyuruh lembur". Wewenang itu pengaturan per jabatan; isi awal: HR dan pemilik. *(Diperinci KEH-159 s.d. 167, 13 Oktober 2026.)* |
| KEH-74 | Klaim lembur paling lambat 3 hari setelah tanggalnya. Lewat itu hangus, tanpa pengajuan terlambat (PRI-09). Klaim yang ditolak boleh diajukan lagi selama belum lewat batas. *(Diperinci KEH-159 s.d. 167, 13 Oktober 2026.)* |
| KEH-75 | Lembur disahkan **satu kali**, oleh HR atau pemilik. Yang mengesahkan boleh mengubah jamnya dengan alasan. Saat slip dibuat tidak ada centang ulang; slip hanya membaca hasil pengesahan itu. *(Diperinci KEH-159 s.d. 167, 13 Oktober 2026.)* |

### 3.12 Rekap

| No | Aturan |
|---|---|
| KEH-76 | Rekap dihitung di satu tempat di server (PRI-12, WAJ-04). Karyawan dan kantor melihat angka yang sama. Hari kosong tidak pernah ditebak sebagai libur atau izin. *(Diperinci KEH-118 dan 119, 13 Oktober 2026.)* |
| KEH-77 | Lembur di rekap tampil tiga angka: terdeteksi, diklaim, disahkan. *(Diperinci KEH-167, 13 Oktober 2026.)* |
| KEH-81 | **Status hari kerja** (PRI-17; keputusan pemilik 13 Oktober 2026, Tahap 3D; jenis: pelapis): tiap catatan hari kerja punya satu status dari daftar **Hadir, Libur terjadwal, Hari tutup, Izin, Sakit, Cuti, Alpha, Tidak jalan**, beserta asalnya (absen, pengajuan yang disetujui, hari tutup, mesin). **Tidak jalan** hanya untuk orang yang dibayar per ritase: hari tanpa absen tercatat Tidak jalan, bukan Alpha, tanpa akibat apa pun (KEH-32, DRV-18). Catatan hari kerja dibuat server tiap hari dan **terkunci saat slip periodenya ditutup**; koreksi sesudahnya masuk periode berikutnya (KEH-68). *(Diperinci KEH-118, 13 Oktober 2026.)* |

### 3.13 Pengaturan dan angka awalnya

KEH-78. Semua angka di bawah adalah pengaturan bertanggal berlaku (WAJ-07),
disimpan di satu tempat dan diperiksa server. Tidak ada yang ditulis di kode.
Pengecualian untuk satu periode atau satu orang dicatat di Daftar Pengecualian.

| Pengaturan | Angka awal | Aturan |
|---|---|---|
| Radius titik lokasi | 100 meter, semua cabang; dikecilkan per cabang setelah terlihat datanya | KEH-12 |
| Jeda paling cepat absen pulang | 15 menit | KEH-17 |
| Batas absen pulang masuk ke hari sebelumnya | 04.00 | KEH-18 |
| Foto absen dihapus setelah | 60 hari | KEH-15 |
| Toleransi telat | 5 menit | KEH-22 |
| Ambang telat yang wajib dijelaskan | 30 menit | KEH-61 |
| Hari berturut-turut di cabang lain sebelum ditanya pindah | 7 hari kerja | KEH-27 |
| Jatah libur per periode | 4 hari | KEH-31 |
| Paling banyak orang libur per cabang per hari | 2 (cabang berisi 2 orang: 1) | KEH-34 |
| Paling banyak libur di akhir pekan per periode | 1 | KEH-35 |
| Jarak antar hari libur | 5 hari | KEH-35 |
| Batas tukar | H-2 | KEH-44 |
| Cuti tahunan | 10 hari setahun, baru boleh setelah masa kerja 1 tahun penuh, diajukan H-7, tetap dibayar, sisa hangus | KEH-48 |
| Izin duka | 2 hari | KEH-49 |
| Batas izin keperluan | H-2 | KEH-50 |
| Sakit tanpa surat berturut-turut | 2 hari | KEH-50 |
| Batas klarifikasi dan klaim | 3 hari | KEH-58, KEH-74 |
| Kejadian lupa absen sebelum denda bertambah | 4 per periode, per jenis | KEH-64 |
| Tambahan denda lupa absen | Rp5.000 | KEH-64 |
| Lembur | paling sedikit 1 jam, paling banyak 3 jam sehari | KEH-70 |
| Jam tutup kantor | 20.00 | KEH-71 |
| Tanda tidak masuk berturut-turut | hari ke-7 | KEH-55 |
| Lama istirahat dan rentang jam mulai, per shift | kosong (istirahat tidak berlaku sampai diisi pemilik) | KEH-82 |
| Akibat lewat batas istirahat | kosong (hanya dicatat) | KEH-86 |
| Jabatan penjaga cabang saat istirahat | Kasir (pengaturan jabatan) | KEH-85 |
| Penjaga paling sedikit yang tersisa | 1 orang | KEH-85 |
| Panjang paling sedikit laporan serah terima | 20 huruf | KEH-90 |
| Absen masuk paling awal sebelum jam masuk | 2 jam | KEH-111 |
| Jendela memilih libur dibuka | tanggal 10 sebelum periode mulai | KEH-132 |
| Jendela memilih libur ditutup | tanggal 25 pukul 23.59 (jam server) | KEH-132 |
| Pengingat memilih libur | H-7, H-3, dan H-1 dari penutupan | KEH-132 |
| Terlambat memilih libur: paling cepat | 2 hari dari hari ini | KEH-135 |
| Batas memilih libur pengganti | 14 hari sesudah hari masuk | KEH-138 |

### 3.14 Nomor yang letaknya tidak berurutan

KEH-79 (hari tutup) ada di bagian 3.5, KEH-80 (hak lihat kepala cabang) di bagian 3.6, dan KEH-81 (status hari kerja) di bagian 3.12, karena ditambahkan setelah nomor lain
dipakai. KEH-82 s.d. 88 (istirahat) ada di bagian 3.15, KEH-89 s.d. 95 (Laporan Pulang) di bagian 3.16, KEH-96 s.d. 101 (absen lewat trip) di bagian 3.17, KEH-102 s.d. 107 (jam dan jadwal, 4D-1) di bagian 3.18, KEH-108 s.d. 113 (absen harian, 4D-2a) di bagian 3.19, KEH-114 s.d. 119 (4D-2b) di bagian 3.20, KEH-120 s.d. 124 (absen lewat trip, 4D-2c) di bagian 3.21, KEH-125 s.d. 130 (Laporan Pulang, 4D-3) di bagian 3.22, KEH-131 s.d. 139 (4D-4a) di bagian 3.23, KEH-140 s.d. 149 (4D-4b) di bagian 3.24, KEH-150 s.d. 158 (Perlu Dijelaskan, 4D-5a) di bagian 3.25.

### 3.15 Istirahat

Ditambahkan atas permintaan pemilik, 13 Oktober 2026 (setelah Tahap 3), "agar
lebih adil". Jenis: **pelapis** atas jam kerja (KEH-01, 02) dan **pengganti**
sebagian KEH-16 dan KEH-17 (urutan scan). Sistem lama tidak punya aturan ini.

| No | Aturan |
|---|---|
| KEH-82 | **Lama istirahat dan rentang jam mulainya adalah bagian jam kerja cabang, per shift**, bertanggal berlaku (KEH-02), diisi pemilik. Contoh: lama 60 menit, boleh mulai antara 11.00 dan 15.00. **Kalau kosong, istirahat tidak berlaku di shift itu**: tombol Istirahat tidak tampil, tidak ada yang dicatat atau diberi tanda. Isi awal: kosong; pemilik mengisinya nanti. Satu kali istirahat per hari kerja. |
| KEH-83 | **Cara absen istirahat.** Layar Absen memakai tombol berlabel: Masuk, Istirahat, Masuk Kembali, Pulang (KEH-17). **Istirahat**: cukup tekan; jam server dan lokasi dicatat, tetapi lokasi tidak harus di titik cabang, karena orang boleh keluar untuk makan. Tombol hanya aktif di dalam rentang jam mulai (KEH-82). **Masuk Kembali**: sama seperti absen masuk, yaitu scan QR, lokasi diperiksa, lalu foto diri (KEH-10, 13, 15). |
| KEH-84 | **Wajib absen istirahat adalah pengaturan jabatan** (KAR-62). Isi awal: ya untuk jabatan toko dan kantor; tidak untuk jabatan gudang, driver, dan kenek. GM tidak diabsen sama sekali (KAR-67). |
| KEH-85 | **Cabang tidak boleh kosong penjaga.** Saat Istirahat ditekan, mesin membaca siapa yang sedang bertugas di cabang itu: sudah absen masuk di sana hari itu (termasuk perbantuan, KEH-08), belum pulang, dan tidak sedang istirahat. Istirahat **ditolak** kalau sesudahnya tidak tersisa paling sedikit **1 orang berjabatan penjaga**. Siapa penjaga adalah pengaturan jabatan (isi awal: **Kasir**; WAJ-05) dan jumlah minimumnya pengaturan (isi awal: 1). Jumlah orang tidak ditulis per cabang; mesin selalu membaca keadaan saat itu, jadi cabang ramai seperti toko pusat otomatis lebih longgar. Pesan penolakan menyebut siapa yang sedang istirahat dan sampai jam berapa (TAM-03). **Kalau penjaga hari itu memang hanya satu orang**, ia tidak istirahat (keputusan pemilik: tidak ada izin khusus). (Pemeriksaan ini hanya untuk yang berjabatan penjaga, KEH-112.) Saat ia menekan Istirahat, sistem menjelaskan bahwa ia tidak bisa istirahat karena penjaga tinggal dirinya sendiri, dan hari kerjanya diberi catatan "tidak istirahat karena sendiri" supaya terlihat HR dan pemilik. Tidak ada akibat apa pun ke dirinya. |
| KEH-86 | **Lewat batas istirahat selalu dihitung mesin**: menit Masuk Kembali dikurangi mulai istirahat dikurangi lama istirahat, disimpan di hari kerja, sekali, oleh server (seperti telat, KEH-21). **Akibatnya adalah pengaturan bertanggal berlaku** "akibat lewat batas istirahat", yang ditentukan pemilik nanti; mesin hanya membacanya. Isi awal: **kosong = hanya dicatat**, tanpa tanda dan tanpa potongan. Kalau kelak akibatnya berupa uang, nominalnya di Gaji (Bab 3), dan perubahannya diumumkan lewat Papan Perubahan Aturan (PRI-35). |
| KEH-87 | **Lupa menekan.** Lupa **Masuk Kembali** (termasuk menekan Pulang saat masih istirahat) dihitung satu kejadian **lupa absen** jenis ketiga, dihitung terpisah dari lupa masuk dan lupa pulang: diklarifikasi dengan jam dan alasan (KEH-63) dan kena denda lupa absen (KEH-64). Lupa menekan **Istirahat** dianggap tidak istirahat, tanpa akibat. |
| KEH-88 | Telat masuk, pulang cepat, dan lembur tetap dihitung seperti KEH-21 s.d. 24 dan KEH-70 s.d. 75. Istirahat **tidak mengurangi** jam kerja dan tidak mengubah hitungan itu. |

### 3.16 Laporan Pulang

Ditambahkan atas permintaan pemilik, 13 Oktober 2026 (setelah Tahap 3):
serah terima kerja supaya tidak ada miskomunikasi, laporan masalah yang tidak
enak disampaikan langsung, dan keadaan mobil dari driver. Jenis: **pelapis**
atas absen pulang (KEH-17). Datanya milik Kehadiran karena menjadi bagian
absen pulang (pengganti saran awal "milik Kinerja"; Kinerja dibangun sesudah
Kehadiran dan tidak boleh menjadi syarat absen).

| No | Aturan |
|---|---|
| KEH-89 | **Alur absen pulang:** scan QR, lokasi, foto, kirim, lalu muncul jendela **Laporan Pulang** yang wajib diisi. **Absen pulang baru tercatat setelah laporan terkirim**; sebelum itu statusnya "menunggu laporan". Jam pulang tetap **jam server saat foto dikirim** (PRI-01), supaya waktu menulis laporan tidak dihitung kerja atau lembur. Isian yang sedang ditulis tidak hilang kalau sinyal putus (TAM-16). Pertanyaan "ini lembur?" (KEH-72) muncul sesudah laporan terkirim. |
| KEH-90 | **Isi wajib: laporan selesai tugas dan serah terima**, dengan tulisan pengarah "Wajib isi laporan selesai tugas. Sampaikan apa saja tugas yang perlu dilanjutkan besok, supaya tidak ada miskomunikasi." Panjang paling sedikit adalah pengaturan (isi awal: 20 huruf), supaya tidak diisi "-". Penerima dipilih: **"Tim saya"** (semua orang aktif di cabang tempat ia absen hari itu; untuk kantor, departemennya) atau **orang tertentu** (satu orang atau lebih). Foto boleh dilampirkan, dari kamera atau galeri (TAM-08). |
| KEH-91 | **Laporan yang tidak terkirim** sampai batas absen pulang (04.00, KEH-18) membuat absen pulang tidak tercatat, sehingga dihitung **lupa absen pulang** (KEH-63, 64): diklarifikasi dengan jam dan alasan, dan kena denda lupa absen. Jam foto yang sudah terkirim ikut tampil di klarifikasi sebagai bukti. |
| KEH-92 | **Serah terima tampil saat absen masuk.** Setelah absen masuk berhasil, penerima melihat semua serah terima untuk dirinya atau timnya sejak masuk terakhirnya, satu jendela per laporan (TAM-22), dan menekan **"Sudah saya baca"**. Pengirim melihat siapa yang sudah membaca. Orang yang libur atau cuti melihatnya di masuk berikutnya. Serah terima bukan rahasia: kepala cabang, Kepala Gudang, HR, GM, dan pemilik bisa melihat serah terima timnya atau semua. *(Dilapisi KEH-126, 127.)* |
| KEH-93 | **Laporan masalah (rahasia)**: bagian pilihan di jendela Laporan Pulang, dan juga bisa dikirim kapan saja dari menu Saya. **Hanya GM dan pemilik yang membaca**, termasuk nama pelapor; HR, kepala cabang, dan orang yang dilaporkan tidak bisa melihatnya. Statusnya Diterima → Sedang ditindaklanjuti → Selesai, dan pelapor bisa melihat statusnya. Foto boleh dilampirkan. *(Dilapisi KEH-128, 129.)* |
| KEH-94 | **Keadaan mobil dari driver.** Kalau hari itu ia menjadi driver di sebuah trip (LOG; cara absennya KEH-96 s.d. 101), jendela Laporan Pulang memuat bagian wajib "Keadaan mobil": **Baik** atau **Perlu perhatian** (isi apa masalahnya, foto boleh). "Perlu perhatian" masuk daftar tindak lanjut **finance dan Kepala Gudang**, tampil di Beranda mereka pagi berikutnya sebagai pengingat berantai sampai ditandai selesai (TAM-22), beserta statusnya. Biaya servis tetap dicatat di Buku Kas seperti biasa (KEU); bensin tetap lewat permintaan bensin (LOG-83). *(Dilapisi KEH-130.)* |
| KEH-95 | Laporan Pulang, laporan masalah, dan keadaan mobil **tidak bisa diubah atau dihapus** setelah terkirim, hanya ditambah keterangan (PRI-02). Laporan masalah tidak masuk rapor dan tidak membawa akibat apa pun bagi pelapornya. |

### 3.17 Absen lewat trip

Ditambahkan atas permintaan pemilik, 13 Oktober 2026 ("driver itu sering
tidak absen"). Jenis: **pengecualian** atas KEH-10 (absen QR di gudang) untuk
orang yang dibayar per ritase, dan **pelapis** atas LOG-25 dan LOG-29.

| No | Aturan |
|---|---|
| KEH-96 | **Orang yang dibayar per ritase** (slip utamanya mingguan, DRV-04) **tidak absen dengan QR.** Absennya lahir dari trip: **absen masuk = "Berangkat"** (LOG-25) dan **absen pulang = lapor sampai garasi trip terakhirnya hari itu** (LOG-29); setiap trip ditutup dengan laporannya sendiri (KEH-98). Orang gudang yang bergaji bulanan tetap absen QR seperti biasa (KEH-10). Aturan ini membaca slip utama, bukan nama atau jabatan (WAJ-05). |
| KEH-97 | **Satu tekanan Berangkat untuk seluruh awak trip:** driver dan kenek di trip itu tercatat absen masuk pada jam server yang sama, dengan **satu foto awak di dalam mobil** (kamera langsung, semua awak terlihat). Kenek yang tidak membawa handphone tetap tercatat. Karena ada beberapa mobil (saat ini 3), tiap trip mencatat awaknya sendiri; orang yang tidak ada di trip mana pun hari itu tercatat **Tidak jalan**, tanpa akibat (KEH-81). |
| KEH-98 | **Setiap trip ditutup dengan laporannya sendiri** (keputusan pemilik 13 Oktober 2026). Setiap lapor garasi diikuti Laporan Pulang (KEH-100), lalu absen pulang tercatat pada jam lapor garasi itu. Kalau hari itu ia berangkat lagi di trip lain (misalnya trip antar pagi, lalu belanja siang), trip kedua juga ditutup dengan laporannya sendiri, dan **absen pulangnya pindah ke trip yang terakhir**. Absen masuk tetap Berangkat trip pertama. Jadi dua trip sehari berarti dua laporan, tanpa pertanyaan "trip terakhir?". Tiap driver dan kenek mengikuti trip yang ia awaki. |
| KEH-99 | **Telat dan pulang cepat tidak dihitung** untuk absen lewat trip, karena jam berangkat bergantung muatan. Istirahat tidak berlaku (KEH-84) dan lembur tidak berlaku (KEH-25). |
| KEH-100 | **Laporan Pulang untuk trip diisi driver**, satu per trip: serah terima (KEH-90), keadaan mobil (KEH-94), dan **bensin**: "perlu isi bensin besok?" beserta perkiraan nominalnya (dipindah dari LOG-29 supaya tidak ditanya dua kali; foto amper tetap di lapor garasi). Kenek tidak wajib mengisi, tetapi boleh mengirim serah terima sendiri. Laporan masalah (KEH-93) tetap terbuka untuk keduanya. |
| KEH-101 | **Trip ditutup kantor** (LOG-30, handphone atau GPS driver bermasalah): absen pulang awaknya tercatat pada jam penutupan. Laporan Pulang diisi driver setelah handphonenya bisa dipakai, **tanpa denda lupa absen** (pengecualian KEH-91), karena bukan kesalahannya. Sampai diisi, ia muncul di "perlu perhatian" Kepala Gudang. |

### 3.18 Pelapis jam dan jadwal (Tahap 4D-1)

Ditambahkan 13 Oktober 2026 saat spec 4D-1 ditulis
(`../work/specs/2026-10-13-kehadiran-spec.md`; J1 s.d. J6 disetujui pemilik,
sesuai saran). Jenis: **pelapis**, kecuali dinyatakan lain. Letak nomor: lihat 3.14.

| No | Aturan |
|---|---|
| KEH-102 | **Giliran awal** diisi kepala cabang untuk cabangnya, untuk cabang berjumlah ganjil maupun genap (pelapis KEH-06). HR, Pemilik, dan GM juga boleh. Sesudah terisi, mesin yang menggilir tiap Senin; kepala cabang tidak mengisi lagi. Kalau belum terisi, mesin tidak menggilir dan kepala cabang serta HR diberi tahu. |
| KEH-103 | **Orang baru atau pindah ke cabang bershift ganda** dipilihkan shift dan kelompoknya saat ditempatkan (KAR-L22), untuk minggu berjalan; giliran mengikuti kelompoknya mulai Senin berikutnya. Sampai terisi, hari kerjanya bertanda "shift belum ditentukan" dan **tidak dihitung telat** (KEH-07); HR diberi tahu. |
| KEH-104 | **Radius absen** hanya diubah Pemilik dan GM, bertanggal berlaku, dengan alasan; GM diberi tahu tiap berubah. **QR** boleh dicetak dan dibuat ulang oleh HR, Pemilik, dan GM (KEH-11, 12). Membuat ulang QR memerlukan tombol ditahan 3 detik karena QR lama langsung mati. |
| KEH-105 | **Hari tutup boleh dipasang mundur** selama slip periodenya belum ditutup, dengan alasan, tercatat siapa dan kapan (pola KEH-68). Alpha pada hari itu di cabang itu menjadi "Hari tutup" tanpa denda. Hari tutup yang dibatalkan membuat mesin menghitung ulang; yang tidak hadir kembali alpha. Untuk periode yang slipnya sudah ditutup, koreksi masuk periode berikutnya (PRI-04). (Pelapis KEH-79.) |
| KEH-106 | **Jam buka cabang** adalah jam masuk shift paling pagi sampai jam pulang shift terakhir (kantor: sampai jam tutup kantor), diturunkan dari jam kerja dan tidak disimpan terpisah (KEH-71). Kosong pada hari tutup dan untuk cabang tanpa kasir. Kehadiran menyediakan **satu pintu baca** "jam buka cabang X tanggal Y" untuk Tarik Data Kasir (PRI-41 butir 4). |
| KEH-107 | **Karyawan melihat jadwal teman satu cabang**: nama, shift, dan tanggal libur atau tidak masuk, **tanpa alasan dan lampiran**, tanpa cabang lain. Tujuannya memilih teman untuk tukar (KEH-43) dan mengatur sendiri. (Pelapis KEH-42 dan KEH-80: kepala cabang tetap satu-satunya yang melihat tanggal dan status pengajuan dalam daftar persetujuan.) |

### 3.19 Pelapis absen harian (Tahap 4D-2a)

Ditambahkan 13 Oktober 2026 saat spec 4D-2a ditulis
(`../work/specs/2026-10-13-kehadiran-spec.md`; A1 s.d. A6 disetujui pemilik,
sesuai saran). Letak nomor: lihat 3.14.

| No | Aturan |
|---|---|
| KEH-108 | **Tidak ada pertanyaan "masuk atau pulang?"** (pengganti kalimat terakhir KEH-17). Layar Absen hanya menampilkan tombol yang berlaku; sebelum ada absen masuk hanya Masuk yang tampil, seberapa pun terlambatnya. Orang yang sebenarnya sudah datang tetapi lupa absen memakai jalur lupa absen (KEH-63). |
| KEH-109 | **Perbantuan** (pelapis KEH-26 dan KEH-08): kalau QR yang dipindai milik cabang lain, pertanyaan "sedang perbantuan atau salah scan?" muncul **sebelum** lokasi dan foto; salah scan langsung membatalkan. Shift yang dipakai adalah shift cabang tujuan yang **namanya sama** dengan shift orang itu minggu ini; kalau tidak ada, orang memilih sendiri satu shift cabang tujuan dan kepala cabang tujuan diberi tahu. |
| KEH-110 | **Masuk Kembali dan Pulang harus memakai QR cabang tempat Masuk** hari itu. Yang berbeda ditolak dengan pesan menyebut cabangnya. Pindah tempat di tengah hari dibetulkan HR lewat pintu koreksi (KEH-28). |
| KEH-111 | **Absen masuk paling awal 2 jam** sebelum jam masuk shift (pengaturan bertanggal berlaku). Lebih awal dari itu tombol Masuk tidak tampil dan pesannya menyebut jam dibukanya. |
| KEH-112 | **Pemeriksaan penjaga cabang** (pelapis KEH-85) hanya dijalankan kalau yang menekan Istirahat berjabatan penjaga. Orang berjabatan lain, dan cabang yang tidak punya jabatan penjaga (kantor, gudang), tidak diperiksa dan bebas istirahat sesuai rentang jam. |
| KEH-113 | **Hari tutup dan libur terjadwal**: tombol Masuk tidak aktif dengan pesan "Hari ini cabang tutup" atau "Hari ini jadwal libur Anda". Orang yang memang diminta masuk memakai permintaan masuk di hari libur (KEH-46; 4D-4). |

### 3.20 Pelapis tinjau, koreksi, dan catatan hari (Tahap 4D-2b)

Ditambahkan 13 Oktober 2026 saat spec 4D-2b ditulis
(`../work/specs/2026-10-13-kehadiran-spec.md`; T1, T2, K1, K2, S1, R1
disetujui pemilik, sesuai saran). Letak nomor: lihat 3.14.

| No | Aturan |
|---|---|
| KEH-114 | **Putusan atas absen luar titik** (perincian KEH-14): peninjau (HR, Pemilik, GM) memilih **Wajar** (tanda dicabut, alasan wajib) atau **Perlu dikoreksi** (dibawa ke pintu koreksi KEH-28, alasan wajib). Tidak ada pilihan "tolak" karena catatan tidak dihapus (PRI-02). Putusan boleh diganti selama slip periodenya belum ditutup; riwayat putusan tetap. Slip tertahan selama belum ada putusan. |
| KEH-115 | **Pola lokasi mencurigakan** (perincian KEH-19) ada dua: (1) orang yang absen di luar radius **3 kali atau lebih dalam 7 hari kerja**; (2) **dua orang berbeda** absen dari titik yang nyaris sama (selisih kurang dari 10 meter) padahal keduanya di luar radius. Angkanya pengaturan bertanggal berlaku. Tandanya tampil untuk HR, Pemilik, GM; tidak menahan slip dan bukan tugas Antrean; boleh ditandai "Sudah dilihat" dengan catatan. Pergeseran wajar dalam radius tidak pernah ditandai. |
| KEH-116 | **Yang boleh dikoreksi** (perincian KEH-29 dan KEH-110): jam masuk, jam pulang, cabang hari itu, dan **menambah absen** pada hari yang tanpa absen (KEH-30). Jam istirahat dan masuk kembali tidak dikoreksi karena tidak berakibat uang (KEH-86). Telat dan lembur dihitung ulang sistem dengan fungsi yang sama dengan mesin harian. Koreksi banyak orang dibatasi satu cabang, satu tanggal, satu alasan. Hari yang slipnya sudah ditutup tidak diubah: dicatat sebagai **koreksi susulan** yang dihitung Gaji di periode berikutnya (KEH-68, 81; PRI-04). |
| KEH-117 | **Tidak ada yang memutuskan atau mengoreksi absennya sendiri.** Absen HR dikoreksi Pemilik atau GM; absen Pemilik atau GM dikoreksi GM atau Pemilik yang lain. Kalau tidak ada orang lain yang berhak, jalannya Perlu Dijelaskan (4D-5). Ditolak server, bukan hanya tombol disembunyikan. |
| KEH-118 | **Urutan status hari kerja** (pelapis KEH-81): Hari tutup, lalu Libur terjadwal, lalu Izin, Sakit, Cuti, kecuali **absen yang nyata menang**: kalau ada absen masuk, status Hadir dan hari itu diberi catatan "ada izin disetujui yang bentrok" untuk HR (bukan tugas; izinnya tidak hilang, hanya tidak terpakai). Hari tanpa absen dan tanpa pengajuan **tidak ditebak**: tampil "Belum ditentukan" sampai mesin penanda alpha (KEH-52, 4D-5) menandainya. Orang yang dibayar per ritase tanpa absen langsung Tidak jalan. |
| KEH-119 | **Telat di rekap** (pelapis KEH-22 dan KEH-76): karyawan melihat menit telatnya apa adanya, **tanpa kata "toleransi" dan tanpa nominal potongan**; kantor (HR, Admin HR, Finance, Pemilik, GM) melihat tambahan tanda "dalam toleransi". Rekap per periode **26 sampai 25**, sama dengan slip, dan angkanya sama untuk karyawan dan kantor (KEH-76). Foto absen tidak bisa diunduh dan setiap pembukaannya dicatat (KEH-20). |

### 3.21 Pelapis absen lewat trip (Tahap 4D-2c)

Ditambahkan 13 Oktober 2026 saat spec 4D-2c ditulis
(`../work/specs/2026-10-13-kehadiran-spec.md`; E1 s.d. E5 disetujui pemilik,
sesuai saran). Letak nomor: lihat 3.14.

| No | Aturan |
|---|---|
| KEH-120 | **Tombol Berangkat dan lapor garasi hanya di layar trip Logistik** (pelapis KEH-96 dan LOG-25, 29). Kehadiran tidak punya tombol absen untuk orang yang dibayar per ritase; ia hanya **menerima hasilnya** dan menampilkannya: untuk orangnya di Absen Trip Saya (KEH-L18), untuk kantor di Absen Trip Hari Ini (KEH-L19). Satu pintu, satu pencatat (WAJ-03). |
| KEH-121 | **Awak trip berubah setelah Berangkat** (perincian KEH-97): orang yang **ditambahkan** kantor tercatat absen masuk pada jam server saat ditambahkan, tanpa foto awak ulang, dengan tanda "ditambahkan kantor". Orang yang **dicopot** tidak dihapus absennya (PRI-02); HR membatalkannya lewat Koreksi (KEH-28, 116) bila memang tidak ikut. Awak hanya diubah kantor (LOG-24). |
| KEH-122 | **Hari kerja absen trip mengikuti tanggal trip**, yaitu tanggal berangkat menurut jam server (LOG-25), bukan jam lapor garasi. Lapor garasi lewat tengah malam tetap masuk hari trip; batas 04.00 (KEH-18) hanya untuk absen QR. Absen pulang mengikuti trip terakhir hari itu (KEH-98). |
| KEH-123 | **Tidak ada denda lupa absen untuk absen lewat trip** (pengecualian KEH-91 dan KEH-63, 64), termasuk trip yang ditutup kantor. Trip yang menggantung ditandai lewat LOG-31 untuk Kepala Gudang dan pemilik; tanda itu tidak berakibat uang di Kehadiran. KEH-91 hanya berlaku untuk orang yang absen dengan QR. |
| KEH-124 | **Lokasi saat Berangkat dicatat, tidak diperiksa** (pengecualian KEH-14 dan KEH-19): absen trip tidak pernah bertanda "perlu ditinjau" dan tidak masuk pola lokasi mencurigakan (KEH-115). Pagarnya di tempat lain: lapor garasi wajib di titik gudang (LOG-29) dan ritase dihitung dari kunjungan toko berfoto. |

### 3.22 Pelapis Laporan Pulang (Tahap 4D-3)

Ditambahkan 13 Oktober 2026 saat spec 4D-3 ditulis
(`../work/specs/2026-10-13-kehadiran-spec.md`; L1 s.d. L6 disetujui pemilik,
sesuai saran). Letak nomor: lihat 3.14. KEH-89 s.d. 95 dan 100, 101 tetap
berlaku; aturan di bawah mengisi celahnya.

| No | Aturan |
|---|---|
| KEH-125 | **Laporan Pulang berurutan, satu layar satu tugas** (perincian KEH-89, TAM-07): 1 Serah terima, 2 Ada masalah? (boleh dilewati), 3 Keadaan mobil dan 4 Bensin (hanya untuk driver, KEH-94 dan 100), lalu Kirim. Karyawan biasa melihat layar 1, 2, dan Kirim saja. Tidak ada tombol cepat "tidak ada serah terima": panjang paling sedikit tetap berlaku (KEH-90) dan tulisan pengarah memberi contoh kalimat. |
| KEH-126 | **Hanya serah terima 7 hari terakhir yang muncul sebagai jendela saat absen masuk** (pelapis KEH-92; TAM-22 butir 3 tetap: tanpa jendela ringkasan, semua yang muncul satu per satu). Yang lebih lama tidak hilang: tinggal di menu "Serah Terima Saya" dan tidak wajib dibaca. Angka 7 hari adalah pengaturan. |
| KEH-127 | **Serah terima tanpa penerima yang bisa membaca** (pelapis KEH-90 dan 92): bila "Tim saya" kosong (pengirim sendirian) atau semua penerima yang dipilih sudah berhenti atau pindah, laporan tetap terkirim dan tercatat, berstatus **"Tidak ada penerima"** (bukan "belum dibaca"), dan tampil di Serah Terima Tim milik kepala cabang atau Kepala Gudang dan HR. Tidak menjadi tugas dan tidak masuk pengingat. |
| KEH-128 | **Laporan masalah yang menyangkut GM hanya dibaca pemilik** (pelapis KEH-93): formulir punya pilihan "Masalah ini menyangkut GM". Bila dipilih, GM tidak melihat laporannya sama sekali, termasuk nama pelapor dan statusnya; dipaksa oleh server, bukan hanya tombol disembunyikan. Tidak ada pengecualian serupa untuk pemilik. Laporan yang menyangkut orang lain tetap dibaca GM dan pemilik. |
| KEH-129 | **Pelapor melihat status dan tanggapan** (pelapis KEH-93): status Diterima → Sedang ditindaklanjuti → Selesai, ditambah **satu kalimat tanggapan, opsional**, ditulis GM atau pemilik. Tanggapan tidak boleh menyebut nama orang yang dilaporkan; sistem memperingatkan bila nama orang aktif muncul di dalamnya. Pelapor hanya bisa menambah keterangan (KEH-95), tidak mengubah isi. |
| KEH-130 | **Keadaan mobil "Perlu perhatian"** (perincian KEH-94): statusnya Baru → Sedang ditangani → Selesai. Yang boleh mengubah: Kepala Gudang, Finance, Pemilik, GM; "Selesai" wajib dengan catatan singkat. Pengingat berantai ke Kepala Gudang dan Finance berhenti begitu **salah satu** menandai Selesai. Laporan "Baik" dari driver lain **tidak** menutupnya otomatis. Driver pelapor melihat statusnya. Biaya servis tetap dicatat di Buku Kas lewat Keuangan, tidak dari layar ini. |

### 3.23 Pelapis libur, tukar, dan masuk di hari libur (Tahap 4D-4a)

Ditambahkan 13 Oktober 2026 saat spec 4D-4a ditulis
(`../work/specs/2026-10-13-kehadiran-spec.md`; L1 s.d. L9 disetujui pemilik,
sesuai saran). Letak nomor: lihat 3.14. KEH-31 s.d. 35, 43 s.d. 46 tetap
berlaku; aturan di bawah mengisi celahnya.

| No | Aturan |
|---|---|
| KEH-131 | **Memilih libur langsung berlaku** (pelapis KEH-31, 36, 37; jenis: pelapis). Empat tanggal yang dipilih karyawan berlaku begitu server memeriksa KEH-34 dan 35 lalu menyimpannya; tidak menunggu persetujuan siapa pun. HR atau pemilik dapat **mencabutnya dengan alasan wajib**, dan orangnya diberi tahu (KEH-40, 45). Status libur: Berlaku, Dicabut, Diganti. Kepala cabang dan Kepala Gudang melihat tanggal dan statusnya (KEH-80). Alasannya: semua pagarnya sudah dijaga mesin, sedangkan menunggu HR hanya menunda dan bisa membuat orang tanpa jadwal pada tanggal 26. |
| KEH-132 | **Jendela memilih libur** (perincian KEH-31): terbuka tanggal 10 dan tertutup tanggal 25 pukul 23.59 (jam server) untuk periode yang mulai tanggal 26. Angkanya pengaturan bertanggal berlaku. Pengingat berantai (TAM-22) ke yang jatahnya belum lengkap pada H-7, H-3, dan H-1 dari penutupan. Jatah orang yang masuk di tengah periode sebanding (GAJ-06). |
| KEH-133 | **Mengubah libur sendiri** (perincian KEH-31, 43): sampai jendela tertutup karyawan bebas menggeser pilihannya (diperiksa lagi KEH-34 dan 35). Setelah periode mulai, libur yang berlaku hanya bergeser lewat ajakan tukar (KEH-43), perubahan langsung oleh kepala cabang atau HR (KEH-45), atau libur pengganti (KEH-46). Tidak ada "ganti libur" sendiri tanpa teman. |
| KEH-134 | **Arti pasti aturan akhir pekan dan jarak** (perincian KEH-35). Akhir pekan = **Sabtu atau Minggu**; paling banyak 1 tanggal Sabtu atau Minggu per periode. Jarak = selisih tanggal paling sedikit **5 hari** (libur Senin, paling cepat libur lagi Sabtu), dihitung juga terhadap libur di ujung periode sebelumnya dan sesudahnya. Keduanya **ditolak server**; sistem lama hanya memperingatkan jarak (KEH-C04, arsip). Yang terpaksa melanggar memakai izin biasa, diputuskan HR. |
| KEH-135 | **Terlambat memilih** (perincian KEH-31, GAJ-16): setelah jendela tertutup, orang yang jatahnya belum lengkap boleh memilih sendiri untuk hari yang paling cepat 2 hari dari hari ini (diperiksa KEH-34 dan 35). Mesin mencatat **satu tanda "tidak memilih libur" per orang per periode** pada pukul 00.10 tanggal 26; Gaji membacanya sebagai denda (GAJ-16), sekali saja walaupun ia memilih terlambat berkali-kali. Sampai ia memilih, hari tidak masuk tanpa izin dicatat alpha (KEH-33). HR tidak mengisikan. Orang yang mulai bekerja sesudah jendela tertutup diatur **KEH-140** (pelapis: 3 hari kerja pertama tanpa tanda). |
| KEH-136 | **Ajakan tukar** (perincian KEH-43, 44): hanya dengan teman satu cabang yang punya tanggal atau shift untuk ditukar dan tidak sedang izin, sakit, atau cuti pada tanggal itu. Tukar libur diperiksa KEH-34 saja, tidak KEH-35 (satu cabang menjaga KEH-34 dengan sendirinya). Tukar shift berlaku untuk **satu tanggal** (bacaan atas KEH-43). Batas H-2 dihitung dari tanggal yang lebih dekat; ajakan yang melewatinya batal otomatis (status Hangus, PRI-37). Pengaju bisa membatalkan selama Menunggu. Tidak ada pemberitahuan ke atasan; laporan jumlah tukar ada di Libur Cabang. |
| KEH-137 | **Diminta masuk di hari libur** (perincian KEH-46): kepala cabang, HR, Pemilik, atau GM membuat permintaan untuk orang di lingkupnya, dengan alasan wajib, untuk tanggal yang memang libur berlaku orang itu dan belum lewat. Orangnya menekan **"Siap masuk"**. **Tidak ada tombol Tolak**: yang tidak bisa menghubungi peminta, dan peminta membatalkan permintaan selama tanggalnya belum lewat. Selama permintaan berlaku, tombol Masuk aktif untuk tanggal itu (pelapis KEH-113). |
| KEH-138 | **Libur pengganti** (perincian KEH-46): dipilih paling lambat **14 hari** sesudah hari masuk, boleh jatuh di periode berikutnya (periode itu boleh memuat 5 libur; tidak melanggar KEH-31), dan diperiksa KEH-34. Lewat 14 hari: status **Hangus** (PRI-09), tanpa denda, dan kompensasi uangnya tetap dibayar (GAJ-15). Pengganti hanya lahir bila orangnya benar-benar absen masuk pada tanggal yang diminta. Angka 14 hari adalah pengaturan. |
| KEH-139 | **Tidak ada libur mendadak atas kemauan sendiri** (penegasan KEH-33, 47, 50; GAJ-13). Orang yang tidak masuk tanpa memenuhi H-2 dicatat **izin mendadak** (bila mengabari) atau **alpha**, dengan potongan naik menurut GAJ-13, **tanpa denda tersendiri** tambahan. Perubahan mendadak oleh kepala cabang atau HR (KEH-45) bukan kemauan karyawan dan tidak berakibat apa pun baginya. |

### 3.24 Pelapis izin, sakit, dan cuti (Tahap 4D-4b)

Ditambahkan 13 Oktober 2026 saat spec 4D-4b ditulis
(`../work/specs/2026-10-13-kehadiran-spec.md`; M1 s.d. M9 disetujui pemilik,
sesuai saran). KEH-36 s.d. 42, 47 s.d. 51, dan 80 tetap berlaku; aturan di
bawah mengisi celahnya. Nominal potongan dan hitungan hari ada di GAJ-13 dan
14, bukan di sini.

| No | Aturan |
|---|---|
| KEH-140 | **Orang yang mulai kerja sesudah jendela memilih libur tertutup** (pelapis KEH-135; menutup bagian 6 butir 5). Ia boleh memilih libur lewat jalur "terlambat" dalam **3 hari kerja pertamanya, tanpa tanda "tidak memilih libur"**. Lewat 3 hari tanpa memilih, tanda itu dicatat seperti orang lain dan dendanya satu kali. Hari tidak masuk tanpa izin sebelum ia memilih tetap alpha (KEH-33). Angka 3 hari adalah pengaturan. |
| KEH-141 | **Batas waktu mengajukan** (perincian KEH-50): izin keperluan **H-2**; cuti tahunan **H-7** (KEH-48); sakit dan izin mendadak serta izin duka boleh diajukan **sampai 3 hari sesudah hari pertamanya**. Lewat batas itu hari tersebut tetap alpha (KEH-33); yang keberatan memakai klarifikasi (4D-5), bukan pengajuan baru. |
| KEH-142 | **Izin mendadak dilabeli server** (perincian KEH-139). Karyawan hanya memilih "Izin keperluan". Bila tanggalnya kurang dari H-2 dari saat dikirim, server melabelinya **izin mendadak**; karyawan melihat labelnya dan kalimat bahwa potongannya lebih besar dari izin biasa sebelum menekan Kirim (angka dan nominal mengikuti Gaji, GAJ-13; jendela konfirmasi ditahan 3 detik karena menyangkut uang, TAM-15). Karyawan tidak bisa memilih label itu sendiri maupun menghindarinya. |
| KEH-143 | **Sakit lebih dari 2 hari dan surat menyusul** (perincian KEH-50, 51). Sakit tanpa surat paling lama 2 hari berturut-turut; 3 hari atau lebih **ditolak server** dengan pesan "pilih sakit dengan surat dokter". Pada jenis dengan surat tersedia pilihan **"Surat menyusul"**: selama surat belum masuk hari itu dicatat sakit tanpa surat; begitu surat masuk, hari tersebut **dihitung ulang** sebagai sakit dengan surat. Sampai 3 hari sesudah masuk kerja kembali tanpa surat, tetap sakit tanpa surat dan tidak dihitung ulang. |
| KEH-144 | **Surat dokter tertutup** (perincian KEH-42; PRI-23). Fotonya hanya dibuka **HR, Pemilik, dan GM**; tiap pembukaan dicatat (siapa, kapan). Admin HR, Finance, kepala cabang, dan Kepala Gudang tidak membukanya; mereka melihat tanggal dan status (KEH-80). Foto **dihapus 60 hari sesudah slip periodenya ditutup**; catatan "sakit dengan surat" dan hari yang sudah dihitung tetap. Angka 60 hari adalah pengaturan. |
| KEH-145 | **Cuti tahunan: pesan jatah** (perincian KEH-48). Hari yang diajukan **langsung dipesan** dan mengurangi sisa yang bisa diajukan; pengajuan yang melebihi sisa ditolak server. Ditolak, dibatalkan, atau dicabut mengembalikan jatahnya. Hanya hari kerja orang itu yang dihitung (KEH-41). **Tidak ada cuti setengah hari.** Tahun cuti pertama mulai tepat saat masa kerja 1 tahun penuh dan berlaku setahun (dihitung dari tanggal bergabung); sisanya hangus di akhir tahun cuti itu dan tidak diuangkan. |
| KEH-146 | **Izin duka lebih dari 2 hari** (perincian KEH-49). Dua hari pertama bebas dan dibayar. Hari ke-3 dan seterusnya diajukan **terpisah** sebagai izin keperluan atau cuti tahunan, pilihan karyawan. Hubungan dengan yang meninggal **wajib dipilih** (ayah, ibu, suami, istri, anak); lampiran tidak wajib, tetapi HR boleh menanyakannya. Izin duka tidak terkena H-2 (KEH-141). |
| KEH-147 | **Pengajuan yang menunggu saat harinya tiba** (perincian PRI-37 butir 4; menyambung KEH-52). Selama pengajuan masih Menunggu atau Diperiksa, hari itu tetap **"belum ditentukan"** dan **tidak ditandai alpha** oleh mesin; HR dan Pemilik terus diingatkan (pengingat berantai, TAM-22). Bila akhirnya **ditolak**, hari itu menjadi alpha pada saat penolakan dan 3 hari klarifikasi dihitung dari saat itu (KEH-62). Tidak pernah disetujui otomatis. |
| KEH-148 | **Diisikan atas nama orang lain dan pencabutan** (perincian KEH-30, 40). HR, Pemilik, dan GM boleh mengisikan izin, sakit, atau cuti atas nama orang lain (misalnya yang tidak punya handphone); alasan wajib, kartunya bertanda **"diisi oleh …"**, tidak boleh untuk dirinya sendiri, dan keputusannya tetap oleh penyetuju lain (PRI-37 butir 3). Karyawan meminta batal hanya **sebelum tanggalnya** (KEH-40). HR, Pemilik, atau GM mencabut persetujuan dengan alasan **sampai slip periodenya ditutup**; sesudahnya lewat koreksi susulan yang dihitung periode berikutnya (KEH-68). |
| KEH-149 | **Bentrokan dan kalender "tidak masuk"** (perincian KEH-34, 41, 42, 80, 107). Server menolak pengajuan yang tanggalnya **bentrok** dengan izin, sakit, atau cuti yang masih berlaku untuk orang yang sama. Batas "paling banyak 2 orang libur" (KEH-34) **tidak** menahan izin, sakit, atau cuti; HR yang memutuskan melihat peringatan berapa orang lain di cabangnya tidak masuk pada tanggal itu. Kalender "tidak masuk" menulis **hanya tanggal, nama, dan "tidak masuk"**, tanpa jenis dan alasan, bagi karyawan (teman satu cabang) dan kepala cabang; jenis dan alasan hanya HR, Pemilik, dan GM (KEH-37, 42, 80). |

### 3.25 Pelapis Perlu Dijelaskan (Tahap 4D-5a)

Ditambahkan 13 Oktober 2026 saat spec 4D-5a ditulis
(`../work/specs/2026-10-13-kehadiran-spec.md`; P1 s.d. P9 disetujui pemilik,
sesuai saran). KEH-52 s.d. 69 tetap berlaku; aturan di bawah mengisi
celahnya. Nominal denda dan potongan ada di GAJ-13 dan 16, bukan di sini.
Lembur (KEH-70 s.d. 78) diperinci di 4D-5b (bagian 3.26).

| No | Aturan |
|---|---|
| KEH-150 | **Mesin penanda alpha** (perincian KEH-52, 53, 147). Tiap hari pukul **04.20**, sesudah catatan hari kerja dibuat (04.10), mesin menandai **Alpha** untuk hari kemarin pada tiap orang yang diabsen lewat QR dan hari kerjanya masih "belum ditentukan" (KEH-118). **Dilewati:** hari yang masih punya pengajuan Menunggu atau Diperiksa (KEH-147), hari Libur terjadwal, Hari tutup, Izin, Sakit, Cuti, orang yang dibayar per ritase (Tidak jalan), GM (KAR-67), orang sebelum tanggal masuk atau sesudah tanggal nonaktif, dan jabatan yang menurut pengaturan jabatan tidak diabsen. Yang terlewat dikejar berurutan tanpa dobel; gagal atau tidak jalan di jadwalnya memberi tahu Pemilik dan GM. Jam 04.20 adalah pengaturan. |
| KEH-151 | **Lima jenis kejadian dan kapan lahir** (perincian KEH-56). Alpha (04.20, KEH-150); lupa absen pulang dan lupa Masuk Kembali (04.05, KEH-87, 91); telat dan pulang cepat di atas ambang (04.10). **Ambang pulang cepat yang wajib dijelaskan 30 menit**, sama dengan telat (KEH-61), pengaturan bertanggal berlaku; di bawahnya hanya dicatat dan tidak ada kartu. "Lupa absen masuk" tidak punya penanda sendiri: orang yang hadir tetapi hari itu tanpa absen memilih sebab "Lupa absen" di kartu alpha (KEH-54). Batas penjelasan **3 hari setelah tanggal kejadian pukul 23.59** (KEH-58); bila alpha lahir dari izin yang ditolak, 3 hari dari saat penolakan (KEH-62, 147). Orang diberi tahu saat kejadian lahir, sisa 1 hari, dan hari terakhir, dengan menyebut akibatnya tanpa nominal (PRI-07). |
| KEH-152 | **Alpha berturut-turut.** Tiap hari alpha adalah satu kartu. Orang boleh menjelaskan beberapa hari berturut-turut sekaligus dengan tombol "Jelaskan sama untuk hari berturut-turut"; server membuat satu penjelasan untuk rangkaiannya. Hari yang sudah lewat batas 3 hari dilepas dari rangkaian dan tetap alpha (KEH-59); hari lain di rangkaian itu tetap diproses. |
| KEH-153 | **Sebab dan akibatnya pada alpha** (perincian KEH-54). Empat sebab: sakit tanpa surat, sakit dengan surat, lupa absen, izin mendadak; "pakai jatah libur" tidak ada. **Batas sakit sama dengan KEH-143:** sakit tanpa surat paling lama 2 hari kerja berturut-turut; lebih dari itu dengan surat dokter, dan surat boleh menyusul 3 hari sesudah masuk kembali (dihitung ulang setelah surat masuk). Penjelasan sakit atau izin mendadak yang disetujui menulis satu baris pengajuan tidak masuk bertanda **"lewat penjelasan"**, tanpa pemeriksaan batas H-2 atau 3 hari lagi (batas 3 hari klarifikasi sudah dipakai); potongannya mengikuti GAJ-13 menurut sebab. Lupa absen yang disetujui menjadikan hari itu **Hadir** dengan jam yang diisi, bertanda "diisi lewat klarifikasi" (KEH-63). |
| KEH-154 | **Denda lupa absen dan kejadian ke-5** (perincian KEH-64). Ada **tiga jenis** yang dihitung terpisah: lupa absen masuk, lupa absen pulang, lupa Masuk Kembali (KEH-87). Denda lupa Masuk Kembali **Rp5.000**, sama dengan lupa pulang (nominal milik Gaji, titipan 4E). "Kejadian ke-5" dihitung **menurut tanggal kejadian** di periode (26 sampai 25) tempat kejadiannya, bukan tanggal disahkan: yang tanggalnya urutan ke-5 dan seterusnya kena tambahan Rp5.000 (KEH-64), berapa pun urutan HR mengesahkan. Bila ada yang dicabut (KEH-158) urutan dihitung ulang oleh server. Kehadiran hanya menyediakan "kejadian ke-n"; Gaji menulis baris denda begitu penjelasan disahkan (GAJ-16) dan membaliknya bila dicabut. Konfirmasi Kirim lupa absen ditahan 3 detik dan menyebut nominalnya (TAM-15). |
| KEH-155 | **Ditolak, ajukan ulang, dan lewat batas.** Penjelasan yang ditolak boleh **Ajukan ulang** selama masih dalam batas 3 hari (PRI-37 butir 5); isian lama terisi dan batas tidak mulai dari awal. **Penyetuju tidak mengubah jam yang diisi:** bila jamnya salah, Tolak dengan alasan lalu orangnya mengajukan ulang. Lewat batas: **alpha** dan **telat** tidak punya jalan lagi di sistem (KEH-59, 61; dibicarakan dengan HR); **lupa absen** (masuk, pulang, Masuk Kembali) memakai **pengajuan terlambat** (KEH-60, PRI-08): wajib alasan, tercatat terlambat, disahkan HR atau Pemilik, denda tetap berlaku, dan dibayar di periode berikutnya bila slip periodenya sudah ditutup. **Pulang cepat yang tidak dijelaskan** hanya bertanda "belum dijelaskan" untuk HR; tidak ada akibat uang (KEH-24). |
| KEH-156 | **Siapa yang memutuskan.** HR, Pemilik, dan GM (KEH-57); satu cukup, tidak ada "Setujui semua" (PRI-40). Penjelasan kejadian milik HR, Pemilik, atau GM sendiri diputuskan penyetuju lain: HR oleh Pemilik atau GM, Pemilik oleh GM dan sebaliknya (PRI-37 butir 3, KEH-117). Server menolak bila pengesah sama dengan pengaju. |
| KEH-157 | **Tanda tidak masuk berturut-turut dan laporan kebiasaan** (perincian KEH-55, 65). Mesin harian pukul 04.25 menghitung hari kerja berturut-turut berstatus Sakit tanpa surat, Izin, atau Alpha; libur terjadwal dan hari tutup tidak memutus dan tidak dihitung, absen Hadir memutus. Pada **hari ke-7** satu tanda ditulis per rangkaian untuk HR dan Pemilik (tidak berulang di hari ke-8), tanpa penonaktifan otomatis (KAR-07, 08). **Laporan Kebiasaan Lupa Absen** untuk Pemilik dan GM memuat orang yang lupa absen lebih dari 4 kali dalam satu periode, dengan jumlah per tiga jenis, tanpa nominal; HR tidak melihatnya. |
| KEH-158 | **Pencabutan dan slip** (perincian KEH-67, 68, 69). Persetujuan penjelasan bisa dicabut HR, Pemilik, atau GM dengan alasan sampai slip periodenya ditutup; hari kembali dihitung, denda dibalik oleh Gaji, urutan KEH-154 dihitung ulang, dan orangnya boleh mengajukan ulang bila masih dalam batas. Sesudah slip ditutup, yang salah dikoreksi sebagai **koreksi susulan** di periode berikutnya (PRI-04). Slip tidak bisa ditutup selama masih ada penjelasan miliknya yang Menunggu (KEH-69); HR dan Pemilik diberi tahu sebelum menutup. |

### 3.26 Pelapis Lembur (Tahap 4D-5b)

Ditambahkan 13 Oktober 2026 saat spec 4D-5b ditulis
(`../work/specs/2026-10-13-kehadiran-spec.md`; E1 s.d. E8 disetujui pemilik,
sesuai saran). KEH-25, 63, 68, 69, 70 s.d. 75, dan 77 tetap berlaku; aturan
di bawah mengisi celahnya. Tarif dan nominal lembur ada di GAJ-12, bukan di
sini.

| No | Aturan |
|---|---|
| KEH-159 | **Cara menghitung** (perincian KEH-70, 71). Satu fungsi di server menghitung jam lembur terdeteksi: jam foto pulang dikurangi jam pulang jadwal, dibulatkan ke bawah per jam penuh, dihentikan di jam tutup cabang, paling sedikit 1 dan paling banyak 3 jam. Fungsi yang sama dipanggil saat Laporan Pulang terkirim, oleh pembuat catatan hari kerja, dan saat hitung ulang setelah koreksi atau penjelasan (WAJ-04). Hanya orang yang diabsen lewat QR dan berjabatan "dapat lembur" (KEH-25, 99). Orang tidak mengetik angka lembur. |
| KEH-160 | **Pertanyaan "Ini lembur?"** (perincian KEH-72). Muncul sesudah Laporan Pulang terkirim, dengan tiga tombol: **Ya, klaim sekarang**, **Nanti**, **Bukan lembur**. Semua jawaban boleh diubah dari Lembur Saya sampai batas klaim; "Bukan lembur" tidak menghapus baris. |
| KEH-161 | **Batas klaim dan hangus** (perincian KEH-74; PRI-09). Batas klaim: tanggal hari kerja + 3 hari pukul 23.59. Pengingat berantai H-1 dan hari terakhir (PRI-07). Lewat batas, baris menjadi **Hangus** oleh mesin harian 04.30, tanpa pengajuan terlambat; orangnya diberi tahu jam yang hangus dan disuruh membicarakannya langsung dengan pemilik. Klaim ditolak boleh **Ajukan ulang** selama masih dalam batas; batas tidak mulai dari awal. |
| KEH-162 | **Pengesahan satu kali dan penurunan jam** (perincian KEH-75). Klaim dikirim dengan foto kertas lembur dan nama penyuruh. Pengesah (HR, Pemilik, GM) boleh **menurunkan** jam dalam jam penuh, dengan alasan wajib; tidak boleh melebihi jam terdeteksi dan tidak boleh melebihi 3 jam. Jam terdeteksi yang dianggap terlalu kecil dibetulkan lewat koreksi absen, bukan lewat lembur. Orangnya diberi tahu alasan penurunan tanpa harus mengajukan ulang. Gaji hanya membaca jam disahkan. |
| KEH-163 | **Penyuruh** (perincian KEH-73). Dipilih dari orang berjabatan "boleh menyuruh lembur" (pengaturan jabatan, isi awal HR, Pemilik, GM). **Bukan diri sendiri**; server menolak. Penyuruh hanya dicatat: tanpa persetujuan dan tanpa pemberitahuan. |
| KEH-164 | **Siapa yang memutuskan.** HR, Pemilik, dan GM; satu cukup, tidak ada "Setujui semua" (PRI-40). Lembur milik HR, Pemilik, atau GM sendiri diputuskan penyetuju lain (PRI-37 butir 3, KEH-156); server menolak bila pengesah sama dengan pengaju. |
| KEH-165 | **Hari yang tidak biasa.** (a) Hari lupa absen pulang yang dijelaskan (pelapis KEH-63): lembur dihitung dari jam yang diisi, bertanda "diisi lewat klarifikasi", dan batas klaimnya **3 hari sejak penjelasan disahkan**. (b) Perbantuan memakai jam kerja dan jam tutup cabang tujuan (PRI-17). (c) Hari diminta masuk di hari libur tidak punya lembur; itu kompensasi libur (GAJ-15). (d) Hari tutup tidak punya lembur. Shift terakhir cabang tidak pernah dapat lembur (KEH-71). |
| KEH-166 | **Koreksi absen dan pencabutan** (perincian KEH-68, 69). Koreksi yang membuat jam terdeteksi **lebih kecil dari jam yang sudah disahkan** ditolak server sampai pengesahan dicabut. Koreksi yang menaikkan jam terdeteksi tidak membuka klaim baru dan tidak menggeser batas; jam klaim tetap. Pengesahan dicabut dengan alasan sampai slip periodenya ditutup; sesudahnya koreksi susulan di periode berikutnya (PRI-04). Slip tidak bisa ditutup selama masih ada klaim lembur milik orang itu yang Menunggu. |
| KEH-167 | **Siapa melihat apa** (perincian KEH-77, 80). Rekap tetap tiga angka: terdeteksi, diklaim, disahkan; jam hangus hanya tampil di Catatan Hari dan Lembur Tim. Lembur Tim: HR, Pemilik, GM semuanya; Admin HR tanpa foto; Kepala Toko dan Kepala Gudang lingkupnya, hanya nama, tanggal, dan jam, tanpa foto dan tanpa penyuruh. **Foto kertas lembur** tertutup seperti surat dokter (KEH-144): dibuka hanya HR, Pemilik, GM, tiap pembukaan dicatat, dihapus 60 hari sesudah slip ditutup (pengaturan). |

## 4. Yang diganti dari sistem lama

Daftar lengkap aturan sistem lama dan nasibnya ada di arsip. Yang paling mengubah
cara kerja sehari-hari:

| Di sistem lama | Di v3 | Aturan |
|---|---|---|
| Empat cara absen; QR tanpa periksa lokasi; jam dari handphone | Satu cara: QR, lokasi, foto; jam server | KEH-10, 12, 16 |
| Shift ditebak dari jam datang | Shift tercatat dan digilir tiap Senin | KEH-05 s.d. 07 |
| Jam kerja per departemen dan per orang | Hanya per cabang, bertanggal berlaku | KEH-01, 02 |
| Tiga pintu membetulkan absen, satu saja yang berjejak | Satu pintu, selalu berjejak | KEH-28 |
| Telat dan lembur diketik tangan saat koreksi | Dihitung ulang sistem | KEH-29 |
| Lembur sampai 20.00; nama departemen di rumus | Sampai jam tutup cabang; pengaturan jabatan | KEH-25, 71 |
| Gaji menghitung jumlah hari kosong | Jadwal libur menjadi pegangan | KEH-33 |
| Paling banyak 3 orang libur se-perusahaan | 2 orang per cabang | KEH-34 |
| Datang di hari libur memindah libur sendiri | Hanya kalau diminta | KEH-46 |
| Jarak 5 hari antar libur hanya peringatan | Ditolak server, sama kerasnya dengan aturan akhir pekan | KEH-134 |
| Pilihan libur menunggu persetujuan pemilik atau HR | Langsung berlaku; HR mencabut dengan alasan | KEH-131 |
| Libur diganti lewat pengajuan yang diputuskan kantor | Bergeser lewat tukar teman atau perubahan kepala cabang atau HR | KEH-133 |
| Tukar libur diterima teman, lalu menunggu keputusan pemilik | Cukup teman; tidak ada persetujuan atasan | KEH-43, 136 |
| Lima jalan untuk "tidak masuk", empat kotak klarifikasi | Satu menu pengajuan, satu menu "Perlu Dijelaskan", satu menu persetujuan | KEH-36, 56 |
| Cuti tahunan 12 hari, H-2 | 10 hari, H-7 | KEH-48 |
| Alpha 2 hari, lupa pulang dan telat tanpa batas | Semua 3 hari | KEH-58 |
| Kuota 4 kali lupa absen, kali kelima ditolak | Tidak ditolak; denda bertambah | KEH-64 |
| Klarifikasi telat menghapus menit telat | Menit tetap; potongan diusulkan ditiadakan | KEH-66 |
| Lembur hanya disahkan pemilik, lalu dicentang ulang saat slip | Disahkan sekali oleh HR atau pemilik | KEH-75 |
| Keputusan tidak bisa dicabut | Bisa dicabut selama slip belum ditutup | KEH-68 |
| Penanda alpha bergantung pada halaman yang dibuka | Otomatis di server, gagal diberitahukan | KEH-52 |

## 5. Kejadian di lapangan dan jalan keluarnya

| Kejadian | Jalan keluar di v3 | Aturan |
|---|---|---|
| QR difoto lalu dipindai dari rumah | Lokasi diperiksa server; absennya bertanda "perlu ditinjau" dan slip tertahan sampai ditinjau | KEH-12, 14 |
| Lokasi meleset padahal orangnya di toko | Tetap dihitung; ditinjau dengan melihat foto berstempel dan jaraknya | KEH-14, 15 |
| Dua orang mau istirahat bersamaan, kasir tinggal satu | Yang kedua ditolak dengan pesan siapa yang sedang istirahat sampai jam berapa | KEH-85 |
| Kasir satu-satunya hari itu mau istirahat | Tidak istirahat; diberi penjelasan, hari kerjanya dicatat "tidak istirahat karena sendiri" | KEH-85 |
| Lupa menekan Masuk Kembali | Lupa absen, klarifikasi, denda lupa absen | KEH-87 |
| Istirahat lewat dari jatahnya | Menit lewat dicatat; akibatnya menurut pengaturan pemilik | KEH-86 |
| Shift pagi tidak memberi tahu shift siang ada pesanan pelanggan | Serah terima wajib saat pulang, tampil saat teman absen masuk | KEH-90, 92 |
| Sudah foto pulang tetapi laporan tidak dikirim | Absen pulang tidak tercatat; lupa absen pulang | KEH-91 |
| Karyawan tidak enak melapor masalah ke atasannya langsung | Laporan masalah rahasia, hanya GM dan pemilik | KEH-93 |
| Driver sering tidak absen QR | Absen lahir dari Berangkat dan lapor garasi trip terakhir | KEH-96, 98 |
| Kenek tidak membawa handphone | Ikut tercatat lewat Berangkat dan foto awak | KEH-97 |
| Driver jalan dua trip sehari | Tiap trip ditutup dengan laporannya sendiri; absen pulang pindah ke trip terakhir | KEH-98 |
| Mobil bermasalah, finance baru tahu saat mobil mogok | Keadaan mobil wajib dilaporkan driver saat pulang, muncul di Beranda finance pagi | KEH-94 |
| Handphone rusak atau kamera tidak terbuka | Dibantu lewat pintu koreksi | KEH-30 |
| Lupa absen masuk atau pulang | Mengisi jam dan alasan di "Perlu Dijelaskan", disahkan atasan | KEH-63 |
| Baru ingat lupa absen setelah 3 hari | Pengajuan terlambat | KEH-60 |
| Pulang lewat tengah malam | Absen pulang sampai 04.00 masuk ke hari sebelumnya | KEH-18 |
| Salah scan QR cabang lain | Pilih "salah scan"; absen batal | KEH-26 |
| Lupa memindahkan cabang seseorang | Setelah 7 hari kerja ditanya, menjadi usulan pindah | KEH-27 |
| Kantor salah mengoreksi absen | Dikoreksi lagi; catatan asli dan koreksi pertama tetap ada | KEH-28 |
| Jam kerja cabang berubah | Absen lama tidak berubah | KEH-02 |
| Tidak memilih libur sampai periode mulai | Kena denda; hari tidak masuk tanpa izin dicatat alpha | KEH-31, 33 |
| Hari yang dipilih sudah penuh | Ditolak server saat memilih; pilih tanggal lain | KEH-34 |
| Teman tidak menjawab ajakan tukar | Batal otomatis di batas H-2; ajukan izin biasa | KEH-44 |
| Teman sakit mendadak, toko kekurangan orang | Kepala cabang atau HR mengubah shift atau libur langsung, dengan alasan | KEH-45 |
| Memilih Sabtu atau Minggu kedua dalam satu periode | Ditolak server | KEH-134 |
| Memilih libur kurang dari 5 hari dari libur lain, termasuk di periode tetangga | Ditolak server | KEH-134 |
| Ingin menggeser libur sesudah periode mulai | Tidak ada tombol sendiri; tukar dengan teman atau minta kepala cabang | KEH-133 |
| Belum memilih sampai tanggal 25 | Satu denda; boleh memilih terlambat untuk hari paling cepat 2 hari dari hari ini | KEH-135 |
| Diminta masuk di hari libur tetapi tidak bisa | Menghubungi peminta; peminta membatalkan; tidak ada tombol tolak | KEH-137 |
| Libur pengganti tidak dipilih sampai 14 hari | Hangus; kompensasi tetap dibayar | KEH-138 |
| Tidak masuk pagi hari tanpa H-2 | Izin mendadak atau alpha; potongan GAJ-13; tanpa denda tambahan | KEH-139 |
| Diminta masuk di hari libur | Permintaan tercatat; karyawan memilih libur pengganti | KEH-46 |
| Pengajuan telanjur disetujui padahal batal | Dibatalkan selama tanggalnya belum lewat | KEH-40 |
| Surat dokter baru ada setelah masuk kerja | Disusulkan paling lambat 3 hari sejak masuk kembali; hari dihitung ulang sebagai sakit dengan surat | KEH-51, 143 |
| Izin keperluan diajukan untuk besok | Server melabeli izin mendadak; karyawan melihat labelnya sebelum Kirim | KEH-142 |
| Sakit 4 hari tanpa surat | Ditolak server; pilih sakit dengan surat, boleh "surat menyusul" | KEH-143 |
| Sakit baru diajukan setelah 3 hari | Hari itu tetap alpha; klarifikasi 4D-5 | KEH-141 |
| Pengajuan belum diputuskan padahal harinya tiba | Hari "belum ditentukan", tidak alpha; HR diingatkan; bila ditolak jadi alpha saat itu | KEH-147 |
| Cuti diajukan melebihi sisa | Ditolak server; hari yang menunggu sudah dipesan | KEH-145 |
| Duka 4 hari | 2 hari bebas dibayar; sisanya izin keperluan atau cuti, diajukan terpisah | KEH-146 |
| Karyawan tanpa handphone sakit | HR mengisikan atas namanya; diputuskan penyetuju lain | KEH-148 |
| Persetujuan salah ditemukan setelah tanggal lewat | Dicabut dengan alasan sampai slip ditutup; sesudahnya koreksi susulan | KEH-148 |
| Kena alpha padahal sakit | Klarifikasi dalam 3 hari | KEH-54, 58 |
| Cuti ditolak setelah tanggalnya lewat | 3 hari dihitung dari saat penolakan | KEH-62 |
| Klarifikasi telanjur disetujui padahal salah | Dicabut dengan alasan selama slip belum ditutup | KEH-68 |
| Jam lembur terdeteksi tidak sesuai kenyataan | Yang mengesahkan mengubah jamnya dengan alasan | KEH-75 |
| Lupa mengklaim lembur lebih dari 3 hari | Hangus; dibicarakan langsung di luar sistem | KEH-74 |
| Pemilik sedang tidak bisa membuka sistem | HR juga bisa mengesahkan | KEH-57, 75 |
| Penanda alpha gagal berjalan | Pemilik diberi tahu | KEH-52 |
| Toko tutup pada satu hari | Pemilik atau HR memasang hari tutup; tidak ada yang ditandai alpha | KEH-79 |
| Orang tidak masuk 7 hari berturut-turut tanpa kabar | HR dan pemilik diberi tanda; mereka yang memutuskan menonaktifkan atau tidak | KEH-55, KAR-08 |
| Slip hendak ditutup, masih ada yang menunggu | Tidak bisa ditutup sampai diputuskan | KEH-14, 69 |

## 6. Masih terbuka

Tidak menghambat bab berikutnya, tetapi harus diputuskan sebelum spec modul ini
ditulis (Tahap 4).

1. **Hari cuti tahunan yang diambil tetap dibayar atau tidak** (KEH-48).
   Jawaban pemilik (12 Oktober 2026): "cuti tahunan tidak bisa dibayar atau
   diganti uang (kalau maksud anda apakah ketika dia ambil cuti, dan sistem
   detect, maka orang itu tetap dibayar kerjanya jika itu cuti tahunan)".
   Dibaca Claude: sisa cuti tidak bisa diuangkan (sudah masuk KEH-48), dan hari
   cuti yang diambil **tetap dibayar**. **Dipastikan pemilik 12 Oktober 2026:
   "ya tetap bayar".** Sudah masuk KEH-48; butir ini selesai.
2. **Jatah cuti orang baru dan syarat masa kerja.** KEH-48 mencatat "tidak ada
   syarat masa kerja 1 tahun" dari jawaban pemilik 12 Oktober 2026 ("tidak
   wajib 1 tahun"). Saat ditanya soal jatah orang baru pada hari yang sama,
   pemilik menjawab: "tidak, ini harus dia sudah 1 tahun penuh, itu aturannya".
   Dua jawaban itu bertabrakan, dan pertentangannya disampaikan ke pemilik.
   **Diputuskan pemilik 12 Oktober 2026: wajib masa kerja 1 tahun penuh.**
   KEH-48 ditulis ulang (jenis: pengganti, WAJ-12); butir "tidak ada syarat
   masa kerja" tidak berlaku lagi. Contoh: bergabung 1 Maret 2026, cuti
   tahunan baru bisa diajukan mulai 1 Maret 2027, lalu 10 hari per tahun
   cuti. Butir ini selesai.
3. **Hari tutup dibayar atau tidak** (KEH-79): **dibayar**, diputuskan di Bab 3
   (GAJ-14). Butir ini selesai.
4. **Pengenalan wajah saat absen.** Rencana pemilik untuk kelak, belum
   dirancang. Rancangan foto absen tidak boleh menutup jalannya
   (`../work/backlog/2026-10-11-absen-qr-dan-titik-lokasi.md`).

5. **Orang yang mulai bekerja sesudah jendela memilih libur tertutup**
   (ditambahkan 4D-4a, 13 Oktober 2026). **Diputuskan pemilik 13 Oktober
   2026 (M1 sesuai saran):** boleh memilih sendiri dalam 3 hari kerja pertama
   tanpa denda; lewat itu tanda tidak memilih libur berlaku. Dicatat sebagai
   KEH-140 (pelapis KEH-135). Butir ini selesai.

## 7. Titipan dan catatan

Untuk Bab 3 (Gaji). **Semua sudah dijawab di `03-gaji.md`** (12 Oktober 2026):
butir 1 di GAJ-10, 11; butir 2 di GAJ-13; butir 3 dan 4 di GAJ-16; butir 5 di
GAJ-15; butir 6 di GAJ-06; butir 7 di GAJ-43; butir 8 ditutup GAJ-16.

1. Nominal potongan telat, dan cara meniadakannya per slip (KEH-23, KEH-66).
2. Tingkat potongan izin, izin mendadak, alpha, dan sakit.
3. Denda tidak memilih libur (KEH-31); di sistem lama Rp10.000.
4. Nominal dasar denda lupa absen (KEH-64); di sistem lama Rp15.000 untuk lupa
   masuk dan Rp5.000 untuk lupa pulang.
5. Kompensasi libur: karena libur kini wajib terjadwal 4 hari, diputuskan apakah
   kompensasi masih ada (KAR-62).
6. Jatah libur orang yang masuk di tengah periode.
7. Slip tidak bisa ditutup selama ada absen yang belum ditinjau atau klarifikasi
   yang menunggu (KEH-14, KEH-69).
8. Di sistem lama denda administrasi hanya tercatat di 5 baris absen, padahal 24
   klarifikasi berdenda disetujui. Sebabnya dicari saat Bab 3 digali.

Untuk Bab 4 (Logistik):

9. Fitur memasang titik lokasi dibuat satu kali dan dipakai juga untuk titik toko
   tujuan pengiriman driver.

Untuk Tahap 3 dan 4:

10. Semua daftar dibagi per halaman; periode lama baru dimuat saat diminta
    (PRI-10, PRI-11).
11. Jalur pengajuan terlambat dirancang sebagai pola umum
    (`../work/backlog/2026-10-11-pengajuan-terlambat.md`).
12. Bagian 5 dijadikan daftar tes (PRI-06).
13. Satu akun satu handphone terdaftar **tidak dipakai** (keputusan pemilik).

## 8. Istilah

Sudah dimasukkan ke `00-kamus-istilah.md`: alpha, atasan, klarifikasi, pengajuan
terlambat, libur rutin, tukar libur, H-2, hari kerja, perbantuan, jam tutup
cabang, hari tutup.
