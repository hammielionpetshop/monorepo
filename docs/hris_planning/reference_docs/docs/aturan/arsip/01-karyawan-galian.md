# Buku Aturan: Karyawan (Data Induk)

Status: **draf; database sudah dicek; menunggu jawaban pemilik atas usulan di bagian 5c**
Digali dari sistem lama pada: 11 Oktober 2026

Cara membaca: kolom "Keputusan" di tiap tabel aturan masih kosong. Pemilik
mengisinya dengan **bawa** (masih berlaku), **ubah** (berlaku tetapi ingin
diperbaiki), atau **buang** (tidak dipakai lagi).

Batas penggalian ini: sumbernya kode aplikasi, file migrasi di repo, dan struktur
database yang sedang berjalan. Database **sudah diperiksa pada 11 Oktober 2026**
(hanya strukturnya: kebijakan akses, fungsi, pemicu, jadwal otomatis, dan
hubungan antar tabel; isi data karyawan tidak dibuka). Hasilnya di bagian 5b, dan
aturan yang terpengaruh sudah diperbarui dengan tanda "(dicek ke database)".

## 1. Modul ini mengurus apa

Modul Karyawan menyimpan siapa saja yang bekerja di perusahaan, di cabang mana, dan
dengan jabatan apa. Modul ini juga mengurus akun login tiap orang dan peran yang
menentukan menu apa yang ia lihat. Semua modul lain (absen, gaji, logistik)
membaca data orang dari sini.

## 2. Data yang dimiliki modul ini

| Data | Isinya | Di sistem lama disimpan di |
|---|---|---|
| Karyawan | Identitas, penempatan, data pribadi, rekening, kontak darurat, foto | `employees` (42 kolom) |
| Cabang | Nama, alamat, aktif atau tidak, titik lokasi dan radius absen | `branches` |
| Departemen | Kelompok besar: Office, Team Toko, Team Gudang | `departments` |
| Jabatan | Nama jabatan, departemennya, dan tingkat | `positions` |
| Akun login | Email, peran, aktif atau tidak, terhubung ke satu karyawan | `users` dan layanan login Supabase |
| Undangan karyawan baru | Link sekali pakai berisi penempatan calon karyawan | `employee_invites` |
| Antrean promosi training | Karyawan training yang sudah waktunya dinilai | `training_promotion_candidates` |
| Kelompok mesin fingerprint | Cabang mana saja yang memakai mesin absen yang sama | `fingerprint_device_groups` |

Tabel `employees` juga menyimpan hal yang sebenarnya milik modul lain:

| Kolom di data karyawan | Sebenarnya urusan modul |
|---|---|
| Jam masuk dan jam pulang khusus | Kehadiran |
| Berlaku potongan telat, berlaku lembur, berlaku kompensasi libur | Kehadiran dan Gaji |
| Gaji flat | Gaji |
| Nominal bonus KPI maksimal | Kinerja |
| ID fingerprint | Kehadiran |
| Bisa jadi driver, bisa jadi kenek | Logistik |

## 3. Aturan

### 3.1 Karyawan

| No | Aturan | Sumber di sistem lama | Keputusan |
|---|---|---|---|
| KAR-01 | Setiap karyawan wajib punya nama, kode karyawan, tipe, cabang, departemen, jabatan, dan tanggal bergabung. Data lain boleh kosong. | `karyawan/page.tsx`, migrasi 001 | |
| KAR-02 | Kode karyawan berbentuk `EMP-001`, diisi otomatis dengan nomor berikutnya, dan masih bisa diubah tangan. Kode tidak boleh kembar. | `karyawan/page.tsx`, `api/invite` | |
| KAR-03 | Tipe karyawan ada lima: Karyawan Tetap, Driver, Borongan/Freelance, Training, Kontrak. | `karyawan/page.tsx` | **Ubah.** Status: Training, Karyawan, Freelance. Kontrak ditambahkan nanti |
| KAR-04 | Kalau jabatan yang dipilih bernama "Driver", tipe karyawan otomatis menjadi Driver. | `karyawan/page.tsx` | **Buang.** Driver menjadi jabatan dan pekerjaan hari itu, bukan tipe |
| KAR-05 | Karyawan bisa ditandai "bisa jadi driver" dan "bisa jadi kenek" di luar jabatan pokoknya (merangkap). | `karyawan/page.tsx` | |
| KAR-06 | Jabatan hanya bisa dipilih dari jabatan milik departemen yang dipilih. | `karyawan/page.tsx` | |
| KAR-07 | Karyawan bisa dinonaktifkan dan diaktifkan lagi. Akun loginnya ikut nonaktif atau aktif. | `karyawan/page.tsx` | |
| KAR-08 | Karyawan dinonaktifkan otomatis kalau lebih dari 7 hari berturut-turut berstatus sakit tanpa surat, izin tanpa kejelasan, atau alpha yang belum diklarifikasi. Alasannya dicatat dan tampil sebagai "Nonaktif (otomatis)". Pemeriksaan ini **tidak berjalan sendiri**: baru jalan saat Owner atau HR membuka aplikasi, paling banyak sekali sehari per perangkat. | `lib/longAbsenceDeactivation.ts`, fungsi `auto_deactivate_long_absence` (dicek ke database) | **Bawa**, ditambah pemberitahuan ke HR dan pemilik sehari sebelumnya |
| KAR-09 | Saat karyawan diaktifkan lagi secara manual, catatan alasan nonaktif otomatis dihapus. | `karyawan/page.tsx` | |
| KAR-10 | Karyawan bisa dihapus permanen oleh HR atau Owner, dengan satu kali konfirmasi. | `karyawan/page.tsx` | **Buang.** Tidak ada hapus; karyawan keluar dinonaktifkan dengan tanggal dan alasan |
| KAR-11 | Data karyawan baru bisa diisi otomatis dari data pelamar di modul Rekrutmen (nama, tanggal lahir, alamat, HP, status nikah, pendidikan). | `karyawan/page.tsx` | |
| KAR-12 | Karyawan bisa mengubah sebagian data dirinya sendiri lewat "Profil Saya": nomor HP, tanggal dan tempat lahir, jenis kelamin, agama, status nikah, jumlah tanggungan, pendidikan, alamat, kontak darurat, dan foto. Nama, rekening bank, cabang, dan jabatan tidak bisa diubah sendiri. | `portal/profil/page.tsx`, fungsi `update_own_employee_profile` (dicek ke database) | **Ubah.** HP, alamat, kontak darurat boleh sendiri; rekening bank dan nama lewat persetujuan HR |
| KAR-13 | Foto karyawan diunggah dari berkas, dengan keterangan batas 2 MB. | `karyawan/page.tsx` | |

### 3.2 Pengaturan per orang

Empat pengaturan ini ditempel ke masing-masing karyawan. Semuanya menyala atau
mati per orang.

| No | Aturan | Sumber di sistem lama | Keputusan |
|---|---|---|---|
| KAR-14 | Tiap karyawan bisa diberi jam masuk dan jam pulang khusus yang mengalahkan jadwal departemennya. | `karyawan/page.tsx` | **Buang.** Jam kerja milik cabang; yang berbeda masuk Daftar Pengecualian |
| KAR-15 | Tiap karyawan punya saklar "berlaku potongan keterlambatan". Bawaannya menyala. | `karyawan/page.tsx` | |
| KAR-16 | Tiap karyawan punya saklar "berlaku perhitungan lembur". Bawaannya menyala. | `karyawan/page.tsx` | |
| KAR-17 | Tiap karyawan punya saklar "berlaku kompensasi libur". Bawaannya menyala. Kalau mati, jatah libur yang tidak diambil tidak dihitung di slip gaji. | `karyawan/page.tsx`, migrasi 044 | |
| KAR-18 | Tiap karyawan punya saklar "gaji flat". Kalau menyala, slip gajinya selalu gaji pokok saja: lembur, telat, tidak hadir, kehilangan, dan bonus diabaikan. Dimaksudkan untuk orang yang hanya dicatat untuk administrasi dan tidak absen harian. | `karyawan/page.tsx` | **Ubah.** Bukan saklar per orang; menjadi pengaturan jabatan Pemilik (KAR-59) |
| KAR-19 | Tiap karyawan punya nominal "bonus KPI maksimal" sendiri. | `karyawan/page.tsx` | |

### 3.3 Training menjadi karyawan tetap

| No | Aturan | Sumber di sistem lama | Keputusan |
|---|---|---|---|
| KAR-20 | Setiap hari sistem memeriksa karyawan training. Yang masa kerjanya sudah melewati 3 periode (periode tanggal 26 sampai 25) masuk antrean "Promosi Training". Statusnya belum berubah. Pemeriksaan ini berjalan sendiri tiap hari pukul 08.15 WIB. Seorang karyawan hanya bisa masuk antrean **satu kali seumur hidup**. | Changelog 112, `promosi-training/page.tsx`, jadwal `training-promotion-candidates-daily` (dicek ke database) | **Bawa** |
| KAR-21 | Hanya Owner atau HR yang memutuskan: **Setujui** atau **Tunda**. Menunda wajib mengisi alasan. | Migrasi 041 | **Bawa**, ditambah tanggal "nilai lagi pada" saat menunda |
| KAR-22 | Kalau disetujui, tipe karyawan berubah menjadi Karyawan Tetap dan gajinya otomatis diganti ke "Gaji Standar". Tunjangan khusus, tarif lembur, dan tarif telat yang sudah ada dibawa. | Migrasi 041 | **Bawa** |
| KAR-23 | Kandidat yang sudah diputuskan tidak bisa diputuskan ulang. | Migrasi 041 | **Bawa** |

### 3.4 Cabang, departemen, dan jabatan

| No | Aturan | Sumber di sistem lama | Keputusan |
|---|---|---|---|
| KAR-24 | Cabang punya nama, alamat, dan status aktif. Hanya cabang aktif yang muncul saat memilih cabang karyawan. | `cabang/page.tsx`, `karyawan/page.tsx` | |
| KAR-25 | Cabang bisa diberi titik lokasi dan radius untuk absen lewat handphone. Radius bawaan 150 meter, paling kecil 10 meter. Cabang tanpa titik lokasi belum bisa dipakai absen handphone. | `cabang/page.tsx` | **Bawa dan diperkuat.** Titik lokasi wajib; lihat backlog absen QR |
| KAR-26 | Cabang bisa dikelompokkan ke "kelompok mesin fingerprint". ID fingerprint karyawan tidak boleh kembar di dalam satu kelompok. | `cabang/page.tsx`, `karyawan/page.tsx` | **Buang.** Semua absen memakai QR; fingerprint tidak dipakai |
| KAR-27 | Cabang bisa dihapus permanen, dengan pesan "pastikan tidak ada karyawan di cabang ini". | `cabang/page.tsx` | |
| KAR-28 | Jabatan punya nama, departemen, dan tingkat (angka; 1 untuk Owner). | `jabatan/page.tsx`, migrasi 001 | **Buang.** Angka tingkat tidak dipakai. Lihat KAR-57 |
| KAR-29 | Jabatan bisa dihapus permanen, dengan pesan "pastikan tidak ada karyawan yang memakai jabatan ini". | `jabatan/page.tsx` | |
| KAR-30 | Departemen ada tiga: Office, Team Toko, Team Gudang. Tidak ada halaman untuk menambah atau mengubah departemen. | Migrasi 001; tidak ditemukan di kode aplikasi | **Bawa.** Departemen tetap ada sebagai pengelompokan jabatan |

### 3.5 Akun login dan peran

| No | Aturan | Sumber di sistem lama | Keputusan |
|---|---|---|---|
| KAR-31 | Satu karyawan paling banyak punya satu akun. Satu akun selalu terhubung ke satu karyawan. | Migrasi 001, `api/users` | **Bawa.** Pemilik juga tercatat sebagai orang, dengan jabatan Pemilik (KAR-59) |
| KAR-32 | Peran akun ada lima: Owner, HR, Finance, Supervisor, Karyawan. | `users/page.tsx`, migrasi 001 | **Ubah.** Peran diganti hak akses per jabatan, satu daftar |
| KAR-33 | Password paling sedikit 6 karakter. | Semua jalur pendaftaran | |
| KAR-34 | Hanya Owner dan HR yang boleh membuat akun, mengubah peran, mereset password orang lain, dan menonaktifkan akun. | `api/users` | |
| KAR-35 | Hanya Owner yang boleh menghapus akun. Tidak ada yang bisa menghapus atau menonaktifkan akunnya sendiri. | `api/users`, `users/page.tsx` | |
| KAR-36 | Akun yang didaftarkan sendiri oleh karyawan selalu berperan Karyawan. Peran lain hanya bisa diberikan Owner atau HR. | `api/signup`, `api/invite` | |
| KAR-37 | Email login baku berbentuk `nama.lengkap@hammielion.com`, dibentuk dari nama yang tercatat di HR. | `lib/emailFromName.ts` | **Buang.** Login memakai email asli karyawan |
| KAR-38 | Semua peran bisa memperbarui akunnya sendiri: pindah ke email baku dan mengganti password. Hanya akun milik sendiri. | `api/akun/perbarui` | **Buang**, karena email baku tidak dipakai lagi |
| KAR-39 | Ada fitur lupa password dan reset password. | `app/(auth)/forgot-password`, `reset-password` (belum dibaca rinci) | **Ubah.** Lupa password diurus lewat email asli atau akun Google karyawan |

### 3.6 Empat cara membuat akun

| No | Cara | Aturannya | Sumber | Keputusan |
|---|---|---|---|---|
| KAR-40 | Dibuatkan HR atau Owner | Pilih karyawan yang belum punya akun, isi email, password, dan peran. | `users/page.tsx`, `api/users` | **Ubah.** Lihat jawaban nomor 2 |
| KAR-41 | Daftar sendiri dengan kode karyawan | Isi kode karyawan, lalu nomor HP **atau** tanggal lahir yang cocok dengan data HR. Email diisi sendiri. Pesan gagalnya sengaja dibuat umum supaya kode karyawan tidak bisa ditebak-tebak. | `api/signup` | **Buang.** Semua karyawan mendaftar ulang dengan cara baru |
| KAR-42 | Daftar sendiri tanpa kode karyawan | Tanggal lahir **wajib** cocok, ditambah nama lengkap **atau** nomor HP yang cocok. Email dibentuk otomatis dari nama di data HR. Kalau ada lebih dari satu orang yang cocok, ditolak dan diarahkan ke HR. Pesan gagalnya menyebut bagian mana yang tidak cocok. | `api/signup/quick` | **Buang.** Semua karyawan mendaftar ulang dengan cara baru |
| KAR-43 | Lewat link undangan | HR mengisi cabang, jabatan, tipe (bawaan Training), dan tanggal bergabung, lalu mendapat link sekali pakai yang berlaku 1x24 jam. Calon karyawan mengisi data pribadinya sendiri dan membuat password. Sistem membuat data karyawan sekaligus akunnya. Link bisa dibatalkan HR. | `karyawan/undang/page.tsx`, `api/invite` | **Ubah.** Karyawan mendaftar sendiri, lalu disetujui HR (KAR-60) |

Karyawan nonaktif tidak bisa mendaftar lewat cara mana pun.

### 3.7 Siapa boleh melihat dan mengubah

Dari file migrasi awal, dan **masih berlaku di database** (dicek ke database).
Di database ada tambahan yang tidak tercatat di sini sebelumnya; lihat bagian 5b
butir 4 dan 5.

| No | Aturan | Sumber | Keputusan |
|---|---|---|---|
| KAR-44 | Owner, HR, dan Finance bisa melihat data semua karyawan. | Migrasi 002 | |
| KAR-45 | Supervisor hanya bisa melihat karyawan di cabangnya sendiri. | Migrasi 002 | |
| KAR-46 | Karyawan hanya bisa melihat data dirinya sendiri. | Migrasi 002 | |
| KAR-47 | Hanya Owner dan HR yang bisa mengubah data karyawan, cabang, departemen, dan jabatan. | Migrasi 002 | |
| KAR-48 | Cabang, departemen, dan jabatan bisa dilihat semua peran. | Migrasi 002 | |

### 3.8 Menu ditentukan dari apa

| No | Aturan | Sumber | Keputusan |
|---|---|---|---|
| KAR-49 | Owner, HR, dan Finance melihat menu pengelola. Supervisor dan Karyawan melihat menu karyawan. | `components/sidebar.tsx` | |
| KAR-50 | Menu Logistik untuk karyawan tidak ditentukan dari peran, tetapi dari jabatan dan cabangnya: Kepala Gudang mendapat menu lengkap; driver dan kenek mendapat menu lapangan; staf cabang toko mendapat Laporan Muat, Kirim Barang, dan Order Grooming; karyawan Back Office mendapat Surat Jalan; karyawan di cabang tujuan retur mendapat Penerimaan Retur. | `components/sidebar.tsx` | |
| KAR-51 | Seseorang dianggap driver atau kenek kalau tipenya Driver, atau ditandai bisa jadi driver, atau ditandai bisa jadi kenek, atau departemennya Team Gudang. | `components/sidebar.tsx` | |
| KAR-52 | Pengelola bisa memakai "Preview Tampilan Karyawan" untuk melihat menu dan halaman karyawan tanpa keluar akun. Selama preview, tombol kirim dan simpan dimatikan. Data yang tampil adalah data satu karyawan sungguhan yang dipilih Owner. | `lib/previewMode.ts` | |

## 4. Menu dan sub menu di sistem lama

| Menu | Sub menu | Dipakai untuk apa | Mirip dengan menu lain? |
|---|---|---|---|
| SDM/HR | Karyawan | Daftar, tambah, ubah, nonaktifkan, hapus karyawan | |
| SDM/HR | Undang Karyawan Baru | Membuat link undangan | Mirip "Tambah Karyawan": dua cara membuat karyawan |
| SDM/HR | Promosi Training | Menyetujui atau menunda promosi | |
| SDM/HR → Setup Cabang & Jabatan | Cabang | Cabang, lokasi absen, kelompok mesin | |
| SDM/HR → Setup Cabang & Jabatan | Jabatan | Jabatan | |
| Manajemen User | (tanpa sub menu) | Akun, peran, reset password | Mirip "Karyawan": aktif atau nonaktif diatur di dua tempat |
| Tombol kunci di atas | Perbarui Akun | Ganti email baku dan password sendiri | Mirip "Profil Saya" |
| Portal Saya | Profil Saya | Melihat dan mengubah data diri | |
| Halaman luar (tanpa login) | Daftar, Daftar Baru, Lupa Password | Membuat akun dan memulihkan password | Tiga pintu pendaftaran yang berbeda |

## 4b. Tumpang tindih yang ditemukan

1. **Empat cara membuat akun** (KAR-40 sampai KAR-43), masing-masing dengan cara
   verifikasi sendiri. Dua di antaranya meminta email diisi tangan, dua lainnya
   membentuk email otomatis dari nama.
2. **Dua cara membuat karyawan**: form "Tambah Karyawan" dan link undangan. Nomor
   kode karyawan berikutnya dihitung di dua tempat dengan rumus yang sama. Kalau
   dua pendaftaran terjadi bersamaan, keduanya bisa mendapat nomor yang sama.
3. **Aktif atau nonaktif diatur di dua tempat**: di data karyawan (akun ikut
   berubah) dan di Manajemen User (karyawan tidak ikut berubah). Akibatnya bisa ada
   karyawan aktif yang akunnya nonaktif tanpa terlihat di halaman Karyawan.
4. **Tiga hal yang menentukan "orang ini apa"**: peran akun (5 pilihan), tipe
   karyawan (5 pilihan), dan jabatan. Ketiganya dipakai bergantian untuk menentukan
   menu dan hitungan. Contoh: "driver" bisa berarti tipe Driver, jabatan Driver,
   tanda bisa jadi driver, atau departemen Team Gudang (KAR-51).
5. **Nama jabatan, departemen, dan cabang ditulis langsung di kode.** "Kepala
   Gudang" muncul di 13 berkas, "Team Gudang" di 12, "Driver" di 9, "Team Toko" di
   4, "Groomer" di 3, "Back Office" di 2. Kalau nama itu diubah di halaman Jabatan
   atau Cabang, aturan yang bergantung padanya berhenti bekerja tanpa pesan apa pun.
6. **Pengaturan per orang** (KAR-14 sampai KAR-19) adalah pengecualian yang ditempel
   ke nama orang, persis hal yang ingin dihindari pemilik (PRI-18, PRI-26).
7. **Data karyawan menyimpan urusan modul lain** (lihat tabel di bagian 2).
8. **Tingkat jabatan (KAR-28) tidak dipakai di mana pun** selain di halaman Jabatan
   itu sendiri.
9. **Preview Tampilan Karyawan** menulis satu karyawan sungguhan langsung di kode
   sebagai contoh.

## 4c. Kejadian di lapangan dan jalan keluarnya

| Kejadian | Di sistem lama ditangani bagaimana | Ada jalan keluar? |
|---|---|---|
| Karyawan salah dihapus | Karyawan yang sudah punya catatan (absen, slip gaji, akun) ditolak database, dengan pesan teknis. Karyawan yang belum punya catatan itu hilang permanen, **dan catatan kasbonnya ikut terhapus** (dicek ke database) | Tidak ada |
| Cabang atau jabatan dihapus padahal masih dipakai | Database menolak selama masih ada karyawan atau catatan yang memakainya; pesannya teknis, tidak menyebut siapa yang masih memakai (dicek ke database) | Ada, tetapi pesannya tidak membantu |
| Karyawan dinonaktifkan otomatis padahal ada alasan sah | HR atau Owner mengaktifkan lagi dengan tangan | Ada |
| Dua karyawan bernama persis sama | Email otomatis bentrok; pendaftaran ditolak dan diarahkan ke HR | Ada, lewat HR |
| Karyawan lupa password | Lupa password, atau HR mereset | Ada |
| Tanggal lahir belum tercatat di HR | Tidak bisa daftar tanpa kode karyawan; HR harus melengkapi dulu | Ada, lewat HR |
| Link undangan kedaluwarsa, sudah dipakai, atau dibatalkan | Ditolak dengan pesan yang menyebut sebabnya; HR membuat link baru | Ada |
| Pendaftaran lewat undangan gagal di tengah | Data karyawan dan akun yang setengah jadi dihapus kembali | Ada |
| Promosi training terlanjur disetujui | Tidak bisa diputuskan ulang; gaji sudah berubah | Tidak ada |
| Promosi training ditunda | Kandidat yang ditunda **tidak pernah muncul lagi** di antrean. Satu-satunya cara menjadikannya tetap adalah mengganti tipenya dengan tangan di data karyawan, dan saat itu gajinya tidak ikut berubah ke Gaji Standar (dicek ke database) | Tidak ada |
| Karyawan pindah cabang | Cabang di data karyawan diganti; riwayat pindahnya tidak tersimpan (tabel `employee_transfers` kosong) | Tidak ada riwayat |
| Karyawan pindah jabatan atau naik jabatan | Jabatan diganti; riwayat tidak tersimpan | Tidak ada riwayat |
| Karyawan keluar lalu masuk lagi | Diaktifkan lagi; tanggal bergabung dan riwayat lama tidak dibedakan | Tidak jelas |

## 5. Jawaban pemilik (11 Oktober 2026)

Pemilik menyatakan semua temuan di bagian 4b benar.

| No | Pertanyaan | Jawaban pemilik |
|---|---|---|
| 1 | Fingerprint masih dipakai? | Tidak. Semua absen memakai QR, dan titik lokasi wajib dipakai. Karyawan sekarang menyimpan QR lalu memindai dari rumah; ini titik paling krusial. Lihat `../../work/backlog/2026-10-11-absen-qr-dan-titik-lokasi.md`. |
| 2 | Cara membuat akun yang dipakai? | Di v3 semua karyawan mulai dari baru. Semua akun dibuat lewat pendaftaran, memakai email asli karyawan atau masuk dengan akun Google. Reset password juga lewat sana. |
| 3 | Peran Supervisor dan Finance? | Ikuti saran: peran diganti hak akses per jabatan. |
| 4 | Tipe karyawan? | Pemilik lupa gunanya. Menurut pemilik, secara teknis hanya ada Kontrak, Training, dan Freelance (borongan). Meminta pendapat. |
| 5 | Karyawan keluar dihapus atau dinonaktifkan? | Dinonaktifkan. |
| 6 | Riwayat pindah cabang dan jabatan? | Perlu. |
| 7 | Promosi training? | Ikuti saran: dibawa, ditambah tanggal "nilai lagi pada". |
| 8 | Nonaktif otomatis setelah 7 hari? | Boleh, dengan pemberitahuan sehari sebelumnya. |
| 9 | Gaji flat dipakai siapa? | Pemilik lupa maksudnya; meminta dijelaskan. |
| 10 | Jam khusus per orang? | Buang. |
| 11 | Tingkat jabatan? | Buang. Terpisah dari itu, pemilik ingin **pedoman lapor**: tulisan yang bisa dibaca karyawan, "kalau ada kasus A, lapor ke B dulu, jangan langsung ke pemilik". Ini bukan pengganti tingkat jabatan. |
| 12 | Departemen masih perlu? | Perlu. |
| 13 | Data yang boleh diubah sendiri? | Ikuti saran. |
| 14 | Email login? | Diganti email asli karyawan, supaya lebih dekat dengan kehidupan mereka. |

Pemetaan di atas sudah diperiksa pemilik dan dibenarkan, dengan satu koreksi pada
nomor 11 (sudah diperbaiki di tabel).

### Aturan baru dari jawaban pemilik

| No | Aturan | Jenis (WAJ-12) |
|---|---|---|
| KAR-53 | Semua karyawan mendaftar ulang di v3. Akun lama tidak dipindahkan. | Pengganti KAR-40 s.d. 42 |
| KAR-54 | Login memakai email asli karyawan atau akun Google. Tidak ada email buatan perusahaan. | Pengganti KAR-37 |
| KAR-55 | Karyawan yang keluar dinonaktifkan dengan tanggal dan alasan keluar. Tidak ada hapus. | Pengganti KAR-10 |
| KAR-56 | Pindah cabang dan pindah jabatan disimpan sebagai riwayat dengan tanggal berlaku. | Baru |
| KAR-57 | Ada **pedoman lapor** yang bisa dibaca karyawan: untuk tiap jenis kasus, tertulis harus lapor ke siapa lebih dulu. Karyawan tidak langsung ke HR atau pemilik. Isinya ditentukan pemilik. | Baru |
| KAR-59 | Pemilik perusahaan dicatat sebagai orang dengan jabatan **Pemilik**, bukan sebagai karyawan biasa. Jabatan itu diatur: tidak diabsen, tidak punya jadwal, tidak kena telat, denda, atau lembur. Pemilik **tetap menerima gaji** bulanan tetap lewat catatan upah yang sama (PRI-19), dan punya slip. Pemilik tidak terhitung di jumlah karyawan. Gaji pemilik hanya bisa dilihat para pemilik, tidak oleh HRD (PRI-24). Di laporan keuangan, gaji pemilik menjadi baris tersendiri, terpisah dari biaya gaji karyawan; rinciannya di Bab 6. Saat ini pemilik ada 3 orang. | Pengganti KAR-18; mengubah KAR-31 |
| KAR-60 | Siapa pun boleh mendaftar sendiri dengan email asli atau akun Google. Akun baru belum bisa melihat atau melakukan apa pun sampai disetujui. Semua pendaftaran berujung di persetujuan HR, yang sekaligus menetapkan cabang, jabatan, dan statusnya. | Pengganti KAR-43 |
| KAR-61 | Status kerja ada tiga: Training, Karyawan, Freelance. Daftar status disimpan sebagai data, supaya "Kontrak" bisa ditambahkan nanti tanpa mengubah kode. | Pengganti KAR-03 |
| KAR-58 | Hak akses ditentukan per jabatan dari satu daftar. Tidak ada peran akun yang terpisah. | Pengganti KAR-32 |

### Jawaban lanjutan pemilik (11 Oktober 2026)

| No | Pertanyaan | Jawaban pemilik | Menjadi |
|---|---|---|---|
| 1 | Status kerja | Sistem kontrak belum jelas dan masih dibangun. Pakai dulu: Training, Karyawan, Freelance. Kontrak ditambahkan nanti. | KAR-61 |
| 2 | Gaji flat | Pemilik ada 3 orang dan di sistem lama tercatat sebagai karyawan. Seharusnya tidak. Tetapi pemilik juga punya gaji, jadi harus tetap bisa digaji. | KAR-59 |
| 3 | Pendaftaran | Orang boleh mendaftar sendiri. Tetapi semuanya butuh persetujuan, dan ujungnya di HR. | KAR-60 |
| 4 | Rantai komando | Harus dibuat. Bentuknya pedoman yang dibaca karyawan. | KAR-57 |

### Yang masih terbuka

1. **Isi pedoman lapor (KAR-57).** Pemilik menyusun daftarnya: untuk kasus apa,
   lapor ke siapa. Dikerjakan saat pemilik siap; tidak menghambat bab berikutnya.
2. **Freelance (KAR-61).** Apakah freelance punya akun dan absen seperti karyawan,
   atau hanya dicatat namanya untuk pembayaran? Di sistem lama ada dua-duanya:
   tipe karyawan "Freelance", dan daftar "Pekerja Lepas" tanpa akun untuk
   borongan. Dibahas di Bab 5 (gaji driver, borongan).
3. **Pedoman lapor dan persetujuan.** Apakah persetujuan di sistem (izin, lembur)
   juga mengikuti urutan lapor itu, atau pedoman ini hanya untuk dibaca?
   Dibahas di Tahap 3 bersama jalur pengajuan (PRI-23).

### Yang masih harus dikerjakan Claude

- ~~Memeriksa aturan bertanda "(perlu dicek ke database)".~~ Selesai 11 Oktober
  2026; hasilnya di bagian 5b.
- Setelah pemilik menjawab usulan di bagian 5c: menulis ulang bab ini menjadi
  versi bersih yang hanya berisi aturan v3 (langkah "tetapkan").

## 5b. Hasil pengecekan database (11 Oktober 2026)

Yang dibuka hanya struktur. Isi data karyawan tidak dibuka; yang dihitung hanya
jumlah baris.

| No | Yang dicek | Hasil | Akibat untuk v3 |
|---|---|---|---|
| 1 | Nonaktif otomatis 7 hari (KAR-08) | Aturannya ada di database, tetapi tidak dijadwalkan. Baru jalan saat Owner atau HR membuka aplikasi. Kalau keduanya tidak membuka aplikasi, tidak ada yang dinonaktifkan. Alasan nonaktif disimpan sebagai satu kalimat, tanpa tanggal tersendiri. | Di v3 dijadwalkan di server (PRI-01), dan pemberitahuan sehari sebelumnya ikut dijadwalkan. Tanggal dan alasan nonaktif disimpan terpisah (KAR-55). |
| 2 | Data yang bisa diubah sendiri (KAR-12) | Daftarnya pasti: HP, tanggal dan tempat lahir, jenis kelamin, agama, status nikah, tanggungan, pendidikan, alamat, kontak darurat, foto. Nama dan rekening tidak bisa. | Sudah sejalan dengan keputusan pemilik. Yang perlu diputuskan: tanggal lahir (lihat 5c nomor 12). |
| 3 | Antrean promosi training (KAR-20 s.d. 23) | Dijadwalkan tiap hari 08.15 WIB. Seorang karyawan hanya bisa masuk antrean satu kali. Yang ditunda tidak pernah muncul lagi. Saat ini ada 6 kandidat, semuanya sudah diputuskan. | Menguatkan keputusan pemilik pada KAR-21: menunda wajib mengisi tanggal "nilai lagi pada", dan pada tanggal itu kandidat masuk antrean lagi. |
| 4 | Siapa boleh melihat data karyawan (KAR-44 s.d. 46) | Tiga aturan itu masih berlaku. Ada **empat tambahan** yang tidak tercatat di migrasi awal: Kepala Gudang melihat semua karyawan; orang logistik dan staf toko melihat karyawan yang terlibat di pengiriman; staf toko melihat karyawan yang terlibat di order grooming; driver dan kenek melihat pasangan trip-nya. Semuanya melihat **seluruh kolom** karyawan itu, termasuk data pribadi dan rekening. | Di v3, modul lain hanya boleh melihat nama dan jabatan orang yang terlibat, bukan seluruh datanya (PRI-24). Masuk daftar hak akses per jabatan (KAR-58). |
| 5 | Siapa boleh mengubah akun (KAR-34, KAR-36) | **Celah keamanan.** Setiap akun diizinkan mengubah baris akunnya sendiri, dan izin itu tidak dibatasi per kolom. Artinya seorang karyawan yang paham teknis bisa mengganti perannya sendiri menjadi Owner lewat permintaan buatan, tanpa lewat layar. Tidak ada pemicu yang mencegahnya. Celah ini tidak dicoba, hanya dibaca dari strukturnya. | Untuk sistem lama: **sudah ditutup 11 Oktober 2026** atas perintah pemilik (migrasi 103; diuji, akun karyawan ditolak). Untuk v3: mesin pengaman hak akses wajib ada (WAJ-06), termasuk percobaan "karyawan menaikkan haknya sendiri". |
| 6 | Hapus cabang dan jabatan (KAR-27, KAR-29) | Database menolak selama masih dipakai. Tetapi menghapus cabang yang tidak punya karyawan ikut menghapus rak, target penjualan, dan jadwal shift cabang itu tanpa pemberitahuan. | Menguatkan usulan: tidak ada hapus, hanya nonaktif (PRI-02). |
| 7 | Hapus karyawan (KAR-10) | Ditolak kalau sudah punya absen, slip gaji, atau akun. Kalau belum, karyawan terhapus dan catatan kasbon, kasbon driver, dan denda driver miliknya ikut terhapus. | Menguatkan keputusan pemilik: tidak ada hapus (KAR-55). |
| 8 | Riwayat pindah cabang dan jabatan | Tabel `employee_transfers` ada dan lengkap kolomnya, tetapi kosong dan tidak ada yang mengisinya. | Bukan fitur yang hilang, tetapi fitur yang tidak pernah disambungkan. Di v3 pindah cabang atau jabatan **hanya** bisa lewat catatan riwayat (KAR-56). |
| 9 | Fingerprint (KAR-26) | Masih ada dua pemicu di database yang menyamakan kelompok mesin, dan 2 kelompok mesin terdaftar. | Tidak dibawa ke v3 (keputusan pemilik: buang). |
| 10 | Jumlah data induk | 7 cabang, 3 departemen, 11 jabatan. | Data induk sedikit; dipindahkan dengan tangan saat tayang sudah cukup. |

## 5c. Usulan keputusan untuk aturan yang kolomnya masih kosong

Ini **usulan Claude, menunggu jawaban pemilik**. Semuanya diturunkan dari
keputusan dan prinsip yang sudah disetujui; tidak ada aturan bisnis baru.
Pemilik cukup menjawab "setuju semua" atau menyebut nomor yang ingin diubah.

| No | Aturan lama | Usulan | Alasan |
|---|---|---|---|
| 1 | KAR-01 data wajib | **Bawa**, dengan dua perubahan: departemen tidak diisi terpisah karena mengikuti jabatan; "tipe" diganti status kerja (KAR-61). | Departemen sudah melekat di jabatan (KAR-06); mengisinya dua kali membuka peluang tidak cocok (WAJ-03). |
| 2 | KAR-02 kode karyawan | **Ubah.** Kode diberi otomatis oleh server dan tidak bisa diubah tangan. | Mencegah kode kembar saat dua pendaftaran bersamaan (WAJ-04). |
| 3 | KAR-05, KAR-51 tanda bisa jadi driver atau kenek | **Ubah.** Driver dan kenek menjadi pekerjaan hari itu. Yang disimpan di karyawan hanya izin "boleh ditugaskan sebagai driver" dan "boleh ditugaskan sebagai kenek". | PRI-16. Tanda itu tetap perlu supaya daftar pilihan saat menyusun perjalanan tidak berisi semua karyawan. |
| 4 | KAR-06 jabatan mengikuti departemen | **Bawa.** | Masih benar. |
| 5 | KAR-07, KAR-09 nonaktif dan aktif lagi | **Ubah.** Diatur di satu tempat (data karyawan); akun mengikuti. Tiap nonaktif dan tiap aktif lagi disimpan sebagai riwayat dengan tanggal dan alasan; alasan lama tidak dihapus. | KAR-55, PRI-02. Sekaligus menjawab kejadian "keluar lalu masuk lagi". |
| 6 | KAR-11 isi otomatis dari pelamar | **Tunda ke Bab 7.** | Di v3 calon karyawan mengisi datanya sendiri (KAR-60); perlu tidaknya sambungan ke Rekrutmen dibahas di sana. |
| 7 | KAR-13 foto | **Bawa**, mengikuti aturan foto di pola baku tampilan. | Sudah diatur di TAM. |
| 8 | KAR-15, 16, 17 saklar telat, lembur, kompensasi libur per orang | **Buang** sebagai saklar per orang. Ketiganya menjadi pengaturan jabatan; orang yang berbeda dari jabatannya masuk Daftar Pengecualian. | PRI-18, PRI-26. Sama dengan keputusan pemilik pada KAR-14. |
| 9 | KAR-19 bonus KPI maksimal per orang | **Pindah ke Bab 7 (Kinerja).** Bukan data milik Karyawan. | WAJ-03. |
| 10 | KAR-24 cabang aktif | **Bawa.** | Masih benar. |
| 11 | KAR-27, KAR-29 hapus cabang dan jabatan | **Buang.** Cabang dan jabatan hanya dinonaktifkan. Yang masih dipakai tidak bisa dinonaktifkan, dan pesannya menyebut siapa yang masih memakai. | PRI-02, TAM-03; lihat 5b butir 6. |
| 12 | KAR-12 tanggal lahir | Tanggal lahir dan jenis kelamin diisi sekali saat mendaftar; setelah disetujui HR, mengubahnya lewat persetujuan HR (sama seperti nama dan rekening). Sisanya boleh diubah sendiri. | Tanggal lahir adalah data identitas, bukan data yang berubah. |
| 13 | KAR-33 panjang password | **Ubah.** Paling sedikit 8 karakter. Tidak berlaku bagi yang masuk dengan akun Google. | 6 karakter terlalu mudah ditebak. |
| 14 | KAR-34, 35, 36 siapa mengurus akun | **Ubah.** Akun lahir dari pendaftaran dan belum punya hak apa pun sampai disetujui (KAR-60). Menyetujui dan menonaktifkan adalah hak akses di daftar per jabatan (KAR-58). Akun tidak dihapus. Tidak ada yang bisa menonaktifkan dirinya sendiri atau mengubah hak aksesnya sendiri. | KAR-58, KAR-60; lihat celah di 5b butir 5. |
| 15 | KAR-44 s.d. 48 siapa melihat dan mengubah | **Ubah.** Diganti daftar hak akses per jabatan (KAR-58). Dua hal dibawa sebagai dasar: karyawan hanya melihat data dirinya sendiri; cabang, departemen, dan jabatan boleh dilihat semua. Modul lain hanya melihat nama dan jabatan. Isi lengkap daftarnya disusun di Tahap 3. | KAR-58, PRI-24; lihat 5b butir 4. |
| 16 | KAR-49, KAR-50 menu | **Ubah.** Menu ditentukan dari daftar hak akses per jabatan yang sama, bukan dari peran dan bukan dari nama jabatan di kode. | KAR-58, WAJ-05. |
| 17 | KAR-52 Preview Tampilan Karyawan | **Ubah.** Diganti "Lihat sebagai" dengan akun contoh per jabatan, bukan karyawan sungguhan. | Backlog tempat uji per jabatan. |

### Jawaban pemilik atas bagian 5c (11 Oktober 2026)

| No | Jawaban pemilik | Status |
|---|---|---|
| 1 | Ikut saran kalau itu yang paling mudah dan efisien. | **Disetujui** |
| 2 | "Iya, lebih baik begitu." | **Disetujui** |
| 3 | Bingung: kalau ada 24 karyawan, apakah semuanya bisa dipilih jadi driver atau kenek? Padahal sudah ada yang jabatannya driver dari awal, dan yang lain hanya ikut sesekali. Minta dianalisa ulang. | **Terbuka.** Dijelaskan ulang di percakapan; menunggu jawaban |
| 4 | Kurang paham soal departemen; minta saran terbaik, akan dicek ulang. | **Ikut saran** (HR hanya memilih jabatan; departemen mengikuti). Menunggu cek ulang pemilik |
| 5 | Setuju; bertanya "di mana?" | **Disetujui.** Tempatnya: halaman detail karyawan (tombol nonaktifkan dan bagian riwayat status); dijelaskan di percakapan |
| 6 | Bahas nanti. | **Ditunda ke Bab 7** |
| 7 s.d. 11 | Ok. | **Disetujui** |
| 12 | Ok, dengan cara kerja: karyawan boleh mengubah; saat disimpan, perubahannya muncul di tempat HR untuk ditinjau dan disetujui. | **Disetujui dengan cara kerja dari pemilik.** Data lama tetap berlaku sampai HR menyetujui |
| 13 | Pemilik meminta fitur lupa password: karyawan mengisi email, tanggal lahir, dan nomor HP yang terdaftar; kalau ketiganya cocok, tampil isian password baru dengan peringatan supaya tidak lupa, lalu otomatis masuk. Panjang password belum dijawab. | **Terbuka.** Bertentangan sebagian dengan KAR-39 dan KAR-54 dan punya risiko keamanan; dibahas di percakapan |
| 14 s.d. 16 | Ok. | **Disetujui** |
| 17 | "Saya setuju sekali." | **Disetujui** |

## 6. Usulan untuk v3

Ini usulan, bukan keputusan. Dirancang penuh di Tahap 3 dan Tahap 4.

1. **Karyawan hanya berisi data orangnya.** Kolom milik modul lain (jam khusus,
   saklar telat dan lembur, gaji flat, bonus KPI, ID fingerprint) dikeluarkan dari
   data karyawan (WAJ-03).
2. **Penempatan menjadi riwayat bertanggal.** Cabang asal, jabatan, dan status
   kerja disimpan dengan tanggal mulai berlaku, sehingga pindah cabang dan naik
   jabatan meninggalkan jejak (WAJ-07).
3. **Satu sumber untuk "orang ini apa".** Jabatan menentukan hak akses dan
   perlakuan kehadiran (PRI-18). Peran akun yang terpisah dihapus. Driver dan
   kenek menjadi pekerjaan hari itu (PRI-16), bukan tipe orang.
4. **Hak akses dan menu dari satu daftar** per jabatan. Tidak ada nama jabatan,
   departemen, atau cabang di kode (WAJ-05). "Lihat sebagai" menggantikan Preview
   Tampilan Karyawan dan memakai akun contoh, bukan karyawan sungguhan.
5. **Tidak ada hapus.** Karyawan, cabang, dan jabatan dinonaktifkan. Cabang atau
   jabatan yang masih dipakai tidak bisa dinonaktifkan, dan pesannya menyebut siapa
   saja yang masih memakainya (PRI-02, TAM-03).
6. **Aktif atau nonaktif diatur di satu tempat**, yaitu data karyawan. Akun
   mengikuti.
7. **Satu cara menomori kode karyawan**, dikerjakan di server, sehingga tidak bisa
   kembar walaupun dua pendaftaran terjadi bersamaan (WAJ-04).
8. **Daftar karyawan dibagi per halaman dan bisa dicari** (PRI-10). Sistem lama
   memuat semua karyawan beserta semua kolomnya sekaligus.

## 7. Istilah baru untuk kamus

Ditambahkan ke `00-kamus-istilah.md` setelah pemilik mengonfirmasi artinya.

| Istilah | Arti di sistem lama |
|---|---|
| Tipe karyawan | Tetap, Driver, Freelance, Training, Kontrak |
| Peran | Owner, HR, Finance, Supervisor, Karyawan; menentukan menu dan hak akses |
| Departemen | Office, Team Toko, Team Gudang |
| Training | Karyawan baru yang belum tetap; dinilai setelah 3 periode |
| Periode | Tanggal 26 sampai tanggal 25 bulan berikutnya |
| Merangkap | Bisa mengerjakan pekerjaan driver atau kenek di luar jabatan pokoknya |
| Back up | Bekerja sementara di cabang lain (dari keterangan pemilik) |
| Gaji flat | Slip gaji hanya gaji pokok, semua data absen diabaikan |
| Gaji Standar | Paket gaji yang otomatis dipakai saat training menjadi tetap |
| Kelompok mesin | Beberapa cabang yang memakai mesin fingerprint yang sama |

## Lampiran: jawaban terakhir pemilik dan penetapan (11 Oktober 2026)

File ini adalah arsip galian. Aturan yang berlaku ada di `../01-karyawan.md`.

| Hal | Jawaban pemilik | Menjadi |
|---|---|---|
| Nomor 3: siapa memberi izin menyetir dan ikut kenek; boleh atau tidak memilih yang belum diberi izin | "Ikuti saran anda." | KAR-05, KAR-64, KAR-65 |
| Nomor 13: lupa password dengan email, tanggal lahir, dan nomor HP | "Untuk login ini, kita urus nanti (tapi ini bisa berubah sewaktu-waktu ketika sudah menuju final)." | Terbuka; bagian 6 buku aturan |
| Nomor 13: panjang password | "Ya, 8 karakter lebih baik." | KAR-33 |
| Mesin pengaman error | "Ok." | WAJ-06 |
| Nomor 4 dan 5 (penjelasan departemen dan tempat nonaktif) | "Setuju." | KAR-06, KAR-07 |
