# Buku Aturan: Karyawan (Data Induk)

Status: **ditetapkan 11 Oktober 2026**, kecuali yang tercantum di bagian 6
("Masih terbuka").

File ini hanya berisi aturan yang berlaku di v3. Hasil galian sistem lama, hasil
cek database, semua pertanyaan, dan jawaban pemilik kata demi kata disimpan di
`arsip/01-karyawan-galian.md`.

Nomor aturan tidak diurutkan ulang, supaya rujukan dari dokumen lain tetap benar.
Nomor yang tidak dipakai lagi ada di bagian 4.

## 1. Modul ini mengurus apa

Modul Karyawan menyimpan siapa saja yang bekerja di perusahaan, di cabang mana,
dengan jabatan apa, dan sejak kapan. Modul ini juga mengurus akun tiap orang dan
daftar hak akses per jabatan, yang menentukan apa yang boleh dilihat dan
dilakukan. Semua modul lain (kehadiran, gaji, logistik) membaca data orang dari
sini.

## 2. Data yang dimiliki modul ini

| Data | Isinya |
|---|---|
| Orang | Identitas, data pribadi, rekening, kontak darurat, foto, kode karyawan |
| Riwayat penempatan | Cabang, jabatan, dan status kerja, masing-masing dengan tanggal mulai berlaku |
| Riwayat status | Tiap kejadian nonaktif dan aktif lagi, dengan tanggal dan alasan |
| Cabang | Nama, alamat, aktif atau tidak, titik lokasi |
| Departemen | Kelompok besar jabatan |
| Jabatan | Nama dan departemennya |
| Daftar status kerja | Training, Karyawan, Freelance |
| Daftar hak akses per jabatan | Jabatan apa boleh melihat dan melakukan apa |
| Izin tugas lapangan | Siapa boleh menyetir dan siapa boleh ikut sebagai kenek |
| Akun | Cara masuk (email asli dan password, KAR-69), terhubung ke satu orang; riwayat masuk |
| Hak tambahan | Hak per orang dari jenis yang bernama, dengan tanggal akhir, pemberi, dan alasan (KAR-75) |
| Jabatan tambahan | Paling banyak satu per orang, bagian dari riwayat penempatan (KAR-76) |
| Pendaftaran | Orang yang sudah mendaftar dan menunggu persetujuan |
| Pengajuan ubah data diri | Perubahan data identitas yang menunggu tinjauan HR |
| Antrean promosi training | Karyawan training yang sudah waktunya dinilai |
| Pedoman lapor | Untuk tiap jenis kasus, harus lapor ke siapa lebih dulu |
| Pengaturan jabatan | Semua tanda ya/tidak per jabatan, satu layar "Pengaturan Jabatan": kena telat, dapat lembur, dapat kompensasi libur, libur tetap atau tidak (KAR-62, PRI-18), wajib absen istirahat dan penjaga cabang saat istirahat (KEH-84, 85), slip utama mingguan atau bulanan (DRV-04), ikut menanggung kehilangan barang (GAJ-08), diabsen, gaji hanya terlihat Pemilik dan GM, terhitung jumlah karyawan (KAR-83), tombol utama handphone (3C). Modul lain hanya membaca (keputusan 3A, 13 Oktober 2026) |
| Daftar Pengecualian | Orang yang perlakuannya berbeda dari jabatannya: aturan mana, nilai pengganti, tanggal berlaku, alasan, penyetuju (PRI-26, KAR-62; keputusan 3A) |
| Pekerja lepas | Orang berstatus kerja Freelance, hanya nama dan nomor HP (DRV-45) |

Yang **bukan** milik modul ini, walaupun di sistem lama ditempel di data karyawan:

| Data | Milik modul |
|---|---|
| Jam kerja | Kehadiran (jam kerja milik cabang, PRI-17) |
| Angka uang per jabatan (bobot tanggungan kehilangan, jabatan penerima tiap jenis bonus) | Gaji (GAJ-08), karena bertanggal berlaku (WAJ-07) |
| Gaji dan tarif | Gaji |
| Aturan bonus dari penilaian (Bonus Terukur) | Kinerja (KIN-13) |
| Pekerjaan hari itu (driver, kenek, bongkaran) | Logistik dan Kehadiran (PRI-16) |

## 3. Aturan

### 3.1 Orang

| No | Aturan |
|---|---|
| KAR-01 | Setiap orang wajib punya nama, cabang, jabatan, status kerja, dan tanggal bergabung. Data lain boleh kosong. |
| KAR-02 | Kode karyawan diberi otomatis oleh server, tidak bisa diubah tangan, dan tidak mungkin kembar. |
| KAR-06 | Tiap jabatan milik satu departemen. Saat mengisi data orang, yang dipilih hanya jabatan; departemen mengikuti. |
| KAR-13 | Foto orang mengikuti aturan foto di pola baku tampilan. |
| KAR-59 | Pemilik perusahaan dicatat sebagai orang dengan jabatan **Pemilik**, bukan sebagai karyawan biasa. Jabatan itu diatur: tidak diabsen, tidak punya jadwal, tidak kena telat, denda, atau lembur. Pemilik **tetap menerima gaji** bulanan tetap lewat catatan upah yang sama (PRI-19), dan punya slip. Pemilik tidak terhitung di jumlah karyawan. Gaji pemilik hanya bisa dilihat para pemilik, tidak oleh HRD (PRI-24). Di laporan keuangan, gaji pemilik menjadi baris tersendiri: "Gaji pemilik dan GM" di Untung Rugi Gudang (KEU-114). Saat ini pemilik ada 3 orang. |
| KAR-67 | Jabatan **GM** haknya **setara jabatan Pemilik** di semua modul: melihat semuanya, termasuk gaji para pemilik, dan boleh melakukan semua yang tertulis "hanya pemilik" (menutup dan membayar slip, meniadakan potongan telat, dan seterusnya), termasuk menutup dan membayar slipnya sendiri. GM bukan pemilik usaha dan tidak terhitung dalam jumlah pemilik (KAR-59). Di semua buku aturan, "pemilik" dalam urusan hak akses mencakup GM. Selebihnya GM **diperlakukan sama dengan jabatan Pemilik**: tidak diabsen dan tidak kena telat, denda, atau lembur; gajinya tidak terlihat HR (hanya para pemilik dan GM); slipnya hanya gaji tetap, tanpa bonus dan tanpa tanggungan kehilangan (GAJ-09). Jenis: **pelapis** atas PRI-24, KAR-59, GAJ-11, GAJ-45, dan GAJ-46 (keputusan 12 Oktober 2026). |
| KAR-61 | Status kerja ada tiga: Training, Karyawan, Freelance. Daftarnya disimpan sebagai data, supaya "Kontrak" bisa ditambahkan nanti tanpa mengubah kode. |

### 3.2 Penempatan dan status

| No | Aturan |
|---|---|
| KAR-56 | Pindah cabang, pindah jabatan, dan ganti status kerja **hanya** bisa dilakukan lewat catatan riwayat yang punya tanggal berlaku. Tidak ada cara mengganti cabang atau jabatan tanpa meninggalkan jejak. |
| KAR-55 | Orang yang keluar dinonaktifkan dengan tanggal dan alasan. Tidak ada hapus. |
| KAR-07 | Aktif atau nonaktif diatur di satu tempat, yaitu halaman data orang itu. Akunnya mengikuti. Tiap kejadian nonaktif dan aktif lagi disimpan di riwayat status dengan tanggal dan alasan; catatan lama tidak dihapus. *(Dilapisi GAJ-113, 13 Oktober 2026, disetujui 14 Oktober 2026: akses terbatas mantan karyawan ke halaman uangnya.)* |
| KAR-68 | Saat seseorang dinonaktifkan karena berhenti, dicatat **cara berhentinya**: "dengan pemberitahuan sebulan" atau "tanpa pemberitahuan sebulan". Yang kedua hanya ditetapkan **pemilik**, wajib alasan, dan menjadi dasar denda di GAJ-58. HR boleh mengusulkan. Tidak ada yang ditetapkan mesin. *(Ditambahkan 13 Oktober 2026.)* **Cara mengusulkan** (4A, A3; jenis: pelapis): HR atau Admin HR menonaktifkan seperti biasa dan memilih "usulkan tanpa pemberitahuan"; usulan masuk kotak Persetujuan Pemilik dan GM; selama belum diputuskan, slip terakhir orang itu tidak bisa ditutup. |
| KAR-08 | Orang **tidak** dinonaktifkan otomatis. Kalau seseorang 7 hari berturut-turut berstatus sakit tanpa surat, izin tanpa kejelasan, atau alpha yang belum diklarifikasi, HR dan pemilik diberi tanda pada hari ke-7, lalu mereka yang memutuskan menonaktifkan atau tidak lewat KAR-07. Pemeriksaannya dijadwalkan di server setiap hari (KEH-55). *Ditulis ulang 12 Oktober 2026 sebagai pengganti (WAJ-12), keputusan pemilik. Bunyi lama: dinonaktifkan otomatis setelah lebih dari 7 hari, dengan pemberitahuan sehari sebelumnya.* |

### 3.3 Izin menyetir dan ikut sebagai kenek

| No | Aturan |
|---|---|
| KAR-05 | Driver dan kenek adalah pekerjaan hari itu, bukan jenis orang (PRI-16). Orang yang jabatannya driver otomatis muncul di daftar pilihan driver. Orang lain hanya muncul kalau di datanya diberi izin "boleh menyetir" atau "boleh ikut sebagai kenek". Jabatan orang itu tidak berubah. |
| KAR-64 | Izin itu diberikan oleh jabatan yang punya hak untuk itu di daftar hak akses; saat ini HR dan Kepala Gudang. Tercatat siapa yang memberi dan kapan. |
| KAR-65 | Orang yang belum punya izin tidak bisa dipilih saat menyusun perjalanan, juga dalam keadaan mendadak. Izinnya diberikan dulu. |
| KAR-84 | **Daftar karyawan untuk pemberi izin** (4A, A7): Kepala Gudang melihat daftar semua orang aktif versi terbatas, hanya nama, cabang, jabatan, dan izin menyetir atau kenek, supaya bisa memberi izin tanpa melihat data pribadi (KAR-44). *(13 Oktober 2026.)* |

### 3.4 Data diri

| No | Aturan |
|---|---|
| KAR-12 | Orang boleh mengubah sendiri, dan langsung berlaku: nomor HP, alamat, kontak darurat, dan foto. |
| KAR-66 | Nama, rekening bank, tanggal lahir, dan jenis kelamin boleh diubah sendiri oleh orangnya, tetapi saat disimpan perubahan itu masuk ke tempat HR untuk ditinjau. Data lama tetap berlaku sampai HR menyetujui. HR boleh menolak, dengan alasan. |
| KAR-80 | **Isian wajib saat mendaftar** (4A, A4): nama, nomor HP, tanggal lahir, jenis kelamin, tanggal mulai bekerja (KAR-69, SIS-24), **foto diri** (dipakai mencocokkan foto absen) dan **kontak darurat**. Rekening **boleh kosong**; orangnya mendapat tanda "Belum ada rekening" dan pengingat di Beranda sampai diisi. **Mengganti rekening wajib melampirkan foto buku tabungan atau kartu ATM**, supaya HR bisa memastikan nama pemilik rekening sebelum menyetujui. Foto dan kontak darurat tidak boleh dikosongkan kemudian. *(13 Oktober 2026.)* |
| KAR-81 | **Data diri lain** (4A, A10; menutup bagian 6 butir 2): tempat lahir, agama, status nikah, jumlah tanggungan, dan pendidikan dicatat, **boleh kosong**, dan diubah sendiri oleh orangnya, langsung berlaku seperti KAR-12. Tidak ada aturan gaji v3 yang memakainya; kalau kelak dipakai, cara mengubahnya dipindah ke tinjauan HR (KAR-66) sebagai perubahan aturan. *(13 Oktober 2026.)* |

### 3.5 Training menjadi karyawan

| No | Aturan |
|---|---|
| KAR-20 | Setiap hari server memeriksa orang berstatus Training. Yang sudah **genap 3 bulan sejak tanggal bergabung** masuk antrean promosi (bergabung 10 Januari → masuk antrean 10 April; bulan tanpa tanggal itu memakai tanggal terakhirnya). Statusnya belum berubah. Angka 3 bulan adalah pengaturan. *Ditulis ulang 13 Oktober 2026 sebagai pengganti (WAJ-12), keputusan pemilik di 4A (A1). Bunyi lama: "sudah melewati 3 periode". Alasan: antrean muncul sebelum periode berganti, sehingga yang disetujui tepat waktu naik gaji di tanggal 26 berikutnya.* |
| KAR-21 | Yang memutuskan adalah jabatan yang punya hak untuk itu; saat ini pemilik, HR, dan Admin HR (KAR-77; layarnya tidak menampilkan nominal gaji). Pilihannya **setujui** atau **tunda**. Menunda wajib mengisi alasan dan tanggal "nilai lagi pada". Pada tanggal itu orangnya masuk antrean lagi. |
| KAR-22 | Kalau disetujui, status kerja berubah menjadi Karyawan dan gajinya diganti ke Gaji Standar, mulai awal periode berikutnya (GAJ-04). Komponen tambahan yang sudah ada dibawa. Tarif lembur dan tarif telat tidak ada per orang; keduanya satu tarif untuk semua (GAJ-10, GAJ-12). *Ditulis ulang 12 Oktober 2026 sebagai pengganti (WAJ-12), keputusan pemilik saat 3E. Bunyi lama: tunjangan khusus, tarif lembur, dan tarif telat yang sudah ada dibawa.* |
| KAR-23 | Keputusan yang sudah diambil tidak bisa diubah. Yang ditunda dinilai lagi sebagai keputusan baru pada tanggalnya. |

### 3.6 Cabang, departemen, dan jabatan

| No | Aturan |
|---|---|
| KAR-24 | Cabang punya nama, alamat, dan status aktif. Hanya cabang aktif yang bisa dipilih. |
| KAR-25 | Setiap cabang wajib punya titik lokasi. Radius dan cara absen diatur di Bab 2 (Kehadiran). |
| KAR-30 | Departemen adalah pengelompokan jabatan. Saat ini: Office, Team Toko, Team Gudang. |
| KAR-27 | Cabang dan jabatan tidak bisa dihapus, hanya dinonaktifkan. Yang masih dipakai tidak bisa dinonaktifkan, dan pesannya menyebut siapa saja yang masih memakainya. |
| KAR-82 | **Siapa mengubah cabang, departemen, dan jabatan** (4A, A2): HR, Admin HR, Pemilik, dan GM. Tanda "berhak tinggi" (KAR-74) hanya diubah Pemilik dan GM. Perubahan titik lokasi cabang diberitahukan ke GM, karena memengaruhi absen. Jabatan baru lahir **tanpa hak apa pun** dan tanpa Pengaturan Jabatan yang berlaku; orang belum bisa ditempatkan di sana sampai keduanya diatur. *(13 Oktober 2026.)* |
| KAR-83 | **Tanda jabatan pengganti nama jabatan** (4A, A5; menjalankan WAJ-05): Pengaturan Jabatan memuat tanda **Diabsen**, **Gaji hanya terlihat Pemilik dan GM**, dan **Terhitung jumlah karyawan**. Aturan KAR-59, KAR-67, dan batas keras KAR-72 butir 3 dijalankan mesin lewat tanda ini, bukan lewat nama jabatan. Isi awal untuk jabatan Pemilik dan GM: tidak, ya, tidak; jabatan lain: ya, tidak, ya. Mengubah tanda "Gaji hanya terlihat Pemilik dan GM" hanya bisa oleh Pemilik dan GM. *(13 Oktober 2026.)* |
| KAR-62 | Perlakuan kehadiran adalah pengaturan jabatan: kena telat atau tidak, dapat lembur atau tidak, dapat kompensasi libur atau tidak (PRI-18), wajib absen istirahat atau tidak, dan penjaga cabang saat istirahat atau tidak (KEH-84, 85; 13 Oktober 2026). Tidak ada saklar per orang. Orang yang perlakuannya berbeda dari jabatannya dicatat di Daftar Pengecualian, dengan alasan dan tanggal berlaku (PRI-26). Rinciannya di Bab 2. |

### 3.7 Akun dan pendaftaran

| No | Aturan |
|---|---|
| KAR-31 | Satu orang paling banyak punya satu akun. Satu akun selalu terhubung ke satu orang. |
| KAR-53 | Semua orang mendaftar ulang di v3. Akun lama tidak dipindahkan. |
| KAR-60 | Siapa pun boleh mendaftar sendiri. Akun baru belum bisa melihat atau melakukan apa pun sampai disetujui. Semua pendaftaran berujung di persetujuan HR, yang sekaligus menetapkan cabang, jabatan, dan status kerjanya (dibatasi KAR-74). |
| KAR-33 | Password paling sedikit 8 karakter. |
| KAR-34 | Akun tidak dihapus, hanya nonaktif mengikuti orangnya (KAR-07). Tidak ada yang bisa menonaktifkan dirinya sendiri atau mengubah hak aksesnya sendiri. |
| KAR-69 | **Cara masuk:** email asli dan password. Akun Google tidak dipakai; tidak ada email buatan perusahaan. Saat mendaftar, **nomor HP dan tanggal lahir wajib diisi**, karena keduanya kunci lupa password (KAR-70). Salah password 5 kali berturut-turut: jeda 5 menit, orangnya diberi tahu. Akun tetap masuk di perangkat sampai 30 hari tanpa dipakai; di PC bersama ada pilihan "jangan ingat saya" yang keluar saat browser ditutup. Ganti password mengeluarkan akun dari semua perangkat lain. Orang yang dinonaktifkan langsung keluar dari semua perangkat. Riwayat masuk (kapan, perangkat apa) terlihat oleh orangnya sendiri dan oleh Pemilik dan GM. *(Tahap 3B, 13 Oktober 2026; jenis: pengganti KAR-54.)* |
| KAR-70 | **Lupa password** (keputusan pemilik, Tahap 3B): (1) orangnya menekan "Lupa password", lalu mengisi email, nomor HP, dan tanggal lahir. (2) Kalau ada yang tidak cocok, pesan **menyebut data mana yang tidak cocok** (email, nomor HP, atau tanggal lahir). (3) Kalau ketiganya cocok, orangnya menulis password baru (dengan peringatan supaya dicatat dan tidak lupa) dan **langsung masuk**. (4) Salah 3 kali: **jeda 5 menit** (tidak dikunci), layar meminta menghubungi GM, dan GM diberi tahu. (5) GM yang dihubungi memastikan orangnya benar, lalu memberi **kode sekali pakai** yang berlaku 1 jam untuk membuat password baru. (6) Setiap password yang diganti lewat jalur ini diberitahukan ke email orangnya dan ke GM, dan semua perangkat lain keluar. (7) Penerima laporan "hubungi" adalah pengaturan, isi awal jabatan GM (WAJ-05). Perubahan nomor HP (KAR-12) diberitahukan ke email orangnya. Risiko yang sudah disampaikan dan diterima pemilik: orang yang tahu email dan HP seseorang bisa menebak tanggal lahirnya pelan-pelan; penjaganya pemberitahuan ke GM. |

### 3.8 Hak akses dan menu

| No | Aturan |
|---|---|
| KAR-58 | Hak akses ditentukan per jabatan dari satu daftar. Tidak ada peran akun yang terpisah. Tidak ada nama jabatan, departemen, atau cabang yang ditulis di kode (WAJ-05). |
| KAR-44 | Dasar daftar hak akses: orang hanya melihat data dirinya sendiri; cabang, departemen, dan jabatan boleh dilihat semua; modul lain hanya melihat nama dan jabatan orang yang terlibat, bukan rekening atau data pribadinya (PRI-24). Isi lengkap daftarnya disusun di Tahap 3. |
| KAR-49 | Menu ditentukan dari daftar hak akses yang sama. Mengganti nama jabatan atau menambah jabatan tidak mengubah menu. |
| KAR-52 | Pengelola memakai "Lihat sebagai" untuk melihat layar tiap jabatan. Di tempat uji, yang dipakai akun contoh per jabatan, bukan orang sungguhan (sistem asli: KAR-78). |
| KAR-71 | **Bentuk daftar hak akses.** Setiap pintu di server adalah satu **tindakan bernama** (misalnya "tutup slip", "ajukan kasbon"); daftar tindakan ada di kode, dan pintu tanpa nama tindakan membuat mesin pengaman gagal. Pemberian tindakan ke jabatan adalah **data**, diubah lewat layar "Hak Akses Jabatan", dan tiap hak punya **lingkup**: diri sendiri, cabangnya, departemennya, atau semua. Cabang dan departemen dibaca dari riwayat penempatan pada tanggal datanya. Jabatan GM memakai baris yang sama dengan jabatan Pemilik (KAR-67). Bawaannya tertutup: tanpa masuk hanya halaman masuk, daftar, dan lupa password yang terbuka. Perubahan jabatan, cabang, atau status aktif langsung mengubah hak. Isi awal dan ringkasan per jabatan: `00-peta-modul.md` bagian Hak akses. *(Tahap 3B.)* |
| KAR-72 | **Batas keras**, tidak bisa diberikan lewat layar mana pun dan selalu dicoba mesin pengaman: (1) mengubah hak, jabatan, atau status aktif dirinya sendiri; (2) menyetujui, memeriksa, atau memutuskan pengajuan dan isiannya sendiri; (3) melihat gaji jabatan Pemilik dan GM, kecuali kedua jabatan itu; (4) mengubah data yang sudah disetujui atau diperiksa (hanya membatalkan dengan alasan); (5) melakukan apa pun tanpa masuk. Perubahan di layar Hak Akses Jabatan yang menabrak batas ini ditolak dengan jendela error (TAM-01). *(Tahap 3B.)* |
| KAR-73 | **Siapa mengubah pengaturan akses dan perlakuan.** Hak Akses Jabatan: hanya Pemilik dan GM; setiap perubahan tercatat (siapa, kapan, sebelum, sesudah) dan pemilik lain diberi tahu. Pengaturan Jabatan dan Daftar Pengecualian: HR atau Admin HR mengisi, Pemilik atau GM menyetujui, bertanggal berlaku. Kalau yang mengisi Pemilik atau GM sendiri, langsung berlaku dan pemilik lain diberi tahu (seperti KEU-119), supaya tidak semua hal menunggu persetujuan Owner. *(Tahap 3B.)* Usulan HR atau Admin HR masuk kotak **Persetujuan** yang sama dengan pengajuan lain dan ikut pengingat 2 hari (PRI-37); tidak ada layar persetujuan tersendiri *(4A, A8; jenis: pelapis)*. |
| KAR-74 | **Jabatan berhak tinggi.** Jabatan bisa diberi tanda "berhak tinggi"; isi awal Pemilik, GM, HR, dan Finance. Hanya Pemilik dan GM yang bisa menempatkan orang di jabatan bertanda itu, termasuk sebagai jabatan tambahan dan gantikan sementara. HR tetap bisa menempatkan orang di jabatan lain. *(Tahap 3B; jenis: pelapis atas KAR-60.)* |
| KAR-75 | **Hak tambahan per orang** hanya dari jenis yang bernama: hak lapor sementara Laporan Kasir (KEU-118) dan gantikan sementara (KAR-76). Tidak ada pemberian hak bebas per orang (PRI-26). **Anti lupa:** tanggal akhir wajib diisi; paling lama 7 hari (hak lapor sementara) dan 14 hari (gantikan sementara); berakhir sendiri pukul 23.59 jam server; pengingat H-1 ke pemberi dan penerima; boleh diperpanjang satu kali dengan alasan; semuanya terlihat di layar "Hak Tambahan yang Aktif" milik Pemilik dan GM. Izin tugas lapangan (KAR-64) bukan hak tambahan dan tidak berakhir sendiri. *(Tahap 3B.)* |
| KAR-76 | **Jabatan tambahan.** Satu orang boleh punya paling banyak satu jabatan tambahan, dicatat di riwayat penempatan; haknya gabungan kedua jabatan, sedangkan perlakuan kehadiran, slip, dan gaji mengikuti jabatan utama. **Finance dan Marketing tidak boleh dipegang tetap oleh satu orang**, supaya yang menagih bukan yang mengesahkan uangnya (LOG-84). Kalau salah satu tidak masuk, yang lain memakai **gantikan sementara** (KAR-75); selama itu batas keras tetap berlaku, jadi ia tidak bisa memeriksa uang yang ia tagih sendiri. *(Tahap 3B; keadaan nyata: 2 orang kantor mengisi Finance, admin HR, dan Marketing.)* |
| KAR-77 | **Jabatan Admin HR**: semua hak HR **kecuali melihat gaji dan slip orang lain**. Jabatan HR yang lengkap (GAJ-46) tetap ada tetapi dibiarkan kosong sampai ada HRD khusus; saat ini GM yang merangkap HRD, dan haknya sudah mencakup HR (KAR-67). Di buku aturan, tugas "HR" yang tidak menyangkut melihat gaji dan slip boleh dikerjakan Admin HR. *(Tahap 3B; jenis: pelapis atas GAJ-46 dan semua "HR" di buku aturan.)* |
| KAR-78 | **"Lihat sebagai" di sistem asli**: hanya Pemilik dan GM, boleh memilih **orang sungguhan**, hanya melihat (semua tombol simpan dan setuju mati), tanda jelas di layar, dan setiap pemakaian tercatat. Tujuannya memastikan tampilan dan pesan yang dilihat karyawan memang jelas. Mencoba tindakan dilakukan di tempat uji: web kedua dengan data contoh, tempat setiap perubahan tampil lebih dulu dan naik ke sistem asli setelah pemilik bilang "rilis" (SIS-41). *(Tahap 3B; jenis: pelapis atas KAR-52.)* |
| KAR-63 | Daftar hak akses dijaga mesin pengaman (WAJ-06): di tempat uji, mesin masuk sebagai akun contoh tiap jabatan dan mencoba **setiap tindakan** pada data milik sendiri, milik orang di cabangnya, dan milik orang di cabang lain, lalu membandingkannya dengan daftar hak dan batas keras (KAR-72). Satu yang lolos padahal tidak boleh, atau ditolak padahal boleh, = gagal. Jalan pada setiap perubahan kode dan setiap migrasi; kalau gagal, perubahan tidak bisa digabung. Pintu atau data baru yang belum punya baris di daftar dianggap gagal. Percobaan tetap: menaikkan hak sendiri, melihat gaji orang lain, mengubah data yang sudah disetujui, memakai sistem tanpa masuk, ditambah daftar wajib tiap buku modul. *(Dirinci Tahap 3B.)* |
| KAR-57 | Ada pedoman lapor yang bisa dibaca semua orang: untuk tiap jenis kasus, tertulis harus lapor ke siapa lebih dulu, supaya tidak langsung ke HR atau pemilik. Isinya ditentukan pemilik. |
| KAR-79 | **Pedoman lapor hanya untuk dibaca** (keputusan pemilik 13 Oktober 2026, Tahap 3E; jenis: pelapis atas KAR-57). Pedoman tidak menambah tahap persetujuan; pengajuan tetap langsung ke penyetuju jenisnya (KEH-37, KEH-80). Di layar Pengajuan Saya, tiap jenis menampilkan satu baris pedoman yang cocok, misalnya "Untuk sakit: kabari Kepala Toko dulu lewat WA". |

## 4. Nomor yang tidak dipakai lagi

| Nomor | Dulu tentang | Nasibnya |
|---|---|---|
| KAR-03 | Lima tipe karyawan | Diganti KAR-61 |
| KAR-04 | Jabatan Driver otomatis menjadi tipe Driver | Dibuang |
| KAR-09 | Alasan nonaktif dihapus saat diaktifkan lagi | Diganti KAR-07 |
| KAR-10 | Hapus karyawan | Diganti KAR-55 |
| KAR-11 | Isi otomatis dari data pelamar | Ditunda ke Bab 7 |
| KAR-14 | Jam kerja khusus per orang | Dibuang; jam kerja milik cabang |
| KAR-15, 16, 17 | Saklar telat, lembur, kompensasi libur per orang | Diganti KAR-62 |
| KAR-18 | Gaji flat | Diganti KAR-59 |
| KAR-19 | Bonus KPI maksimal per orang | Tidak dibawa; diganti Bonus Terukur per jabatan per cabang (KIN-13) |
| KAR-26 | Kelompok mesin fingerprint | Dibuang; absen memakai QR |
| KAR-28 | Tingkat jabatan | Dibuang |
| KAR-29 | Hapus jabatan | Digabung ke KAR-27 |
| KAR-32 | Lima peran akun | Diganti KAR-58 |
| KAR-35, 36 | Siapa menghapus akun; peran akun baru | Diganti KAR-34 dan KAR-60 |
| KAR-37, 38 | Email buatan perusahaan | Diganti KAR-54, lalu KAR-69 |
| KAR-54 | Masuk memakai email asli atau akun Google | Diganti KAR-69 (13 Oktober 2026, Tahap 3B): akun Google tidak dipakai |
| KAR-39 | Lupa password | Ditunda; lihat bagian 6 |
| KAR-40 s.d. 43 | Empat cara membuat akun | Diganti KAR-53 dan KAR-60 |
| KAR-45 s.d. 48 | Hak lihat dan ubah per peran | Diganti KAR-44 dan KAR-58 |
| KAR-50, 51 | Menu logistik dari nama jabatan; siapa dianggap driver | Diganti KAR-49 dan KAR-05 |

## 5. Kejadian di lapangan dan jalan keluarnya

| Kejadian | Jalan keluar di v3 | Aturan |
|---|---|---|
| Orang salah dinonaktifkan | Diaktifkan lagi; dua kejadiannya tercatat di riwayat status | KAR-07 |
| Orang tidak masuk 7 hari berturut-turut tanpa kabar | HR dan pemilik diberi tanda; tidak ada yang dinonaktifkan tanpa keputusan mereka | KAR-08 |
| Orang keluar lalu masuk lagi | Diaktifkan lagi; riwayat keluar dan masuknya tetap terlihat | KAR-07, KAR-55 |
| Orang berhenti tanpa pamit dan tanpa pemberitahuan sebulan | Pemilik menetapkan cara berhentinya; dendanya di buku Gaji | KAR-68, GAJ-58 |
| Salah mengisi cabang atau jabatan | Dibuat catatan riwayat baru yang membetulkan; catatan yang salah tidak dihapus | KAR-56, PRI-02 |
| Cabang tutup atau jabatan tidak dipakai lagi | Dinonaktifkan; kalau masih dipakai, pesan menyebut siapa yang masih memakainya | KAR-27 |
| Orang salah mengubah data dirinya | HP, alamat, kontak darurat: diubah lagi sendiri. Data identitas: HR menolak pengajuannya | KAR-12, KAR-66 |
| HR terlanjur menyetujui perubahan data identitas yang salah | Orangnya atau HR mengajukan perubahan baru | KAR-66 |
| Promosi training ditunda | Masuk antrean lagi pada tanggal "nilai lagi pada" | KAR-21 |
| Promosi training terlanjur disetujui | Keputusan tidak bisa diubah; status dan gaji dibetulkan lewat catatan riwayat dan catatan gaji baru | KAR-23, KAR-56 |
| Mendadak butuh kenek yang belum punya izin | Izin diberikan dulu oleh yang berhak, lalu orangnya bisa dipilih | KAR-65 |
| Izin menyetir salah diberikan | Dicabut oleh yang berhak; pencabutannya tercatat | KAR-64 |
| Orang asing mendaftar | Tidak bisa melihat apa pun; HR menolak pendaftarannya | KAR-60 |
| Lupa password | Isi email, nomor HP, dan tanggal lahir; kalau cocok, tulis password baru dan langsung masuk | KAR-70 |
| Lupa password dan salah 3 kali | Jeda 5 menit, diminta menghubungi GM; GM memberi kode sekali pakai | KAR-70 |
| HP hilang | Orangnya (dari perangkat lain) atau HR menekan "keluarkan dari semua perangkat", lalu ganti password | KAR-69 |
| Orang dinonaktifkan saat sedang masuk | Langsung keluar dari semua perangkat | KAR-69 |
| Pemilik salah mencabut hak sebuah jabatan | Diubah lagi di layar Hak Akses Jabatan; perubahan dan pembetulannya tercatat | KAR-73 |
| Pemilik mencoba memberi hak yang menabrak batas keras | Ditolak dengan jendela error yang menyebut batas mana | KAR-72 |
| Finance tidak masuk beberapa hari | Marketing diberi gantikan sementara, paling lama 14 hari, berakhir sendiri | KAR-75, KAR-76 |
| Hak tambahan lupa dicabut | Tidak mungkin: berakhir sendiri di tanggal akhirnya, dengan pengingat H-1 | KAR-75 |
| HR mencoba menjadikan seseorang Finance | Ditolak; jabatan berhak tinggi hanya diisi Pemilik dan GM | KAR-74 |
| Karyawan mengeluh menunya tidak muncul | Pemilik atau GM memakai "Lihat sebagai" orang itu di sistem asli, hanya melihat | KAR-78 |
| HR salah menetapkan cabang atau jabatan saat menyetujui pendaftaran | Dibetulkan lewat catatan riwayat | KAR-56 |

## 6. Masih terbuka

Tidak menghambat bab berikutnya, tetapi harus diputuskan sebelum spec modul ini
ditulis (Tahap 4).

1. ~~Lupa password (dulu KAR-39)~~: **diputuskan 13 Oktober 2026** (Tahap 3B,
   `../work/specs/2026-10-13-hak-akses-desain.md`): cara pilihan pemilik
   dipakai, tanpa akun Google, dengan jeda 5 menit setelah salah 3 kali dan
   bantuan GM (KAR-69, KAR-70). Butir ini selesai.
2. ~~Data diri lainnya~~: **diputuskan 13 Oktober 2026** (4A, A10): dicatat,
   boleh kosong, diubah sendiri langsung berlaku (KAR-81). Butir ini selesai.
3. **Isi pedoman lapor (KAR-57).** Disusun pemilik saat siap.
4. ~~Freelance (KAR-61): punya akun dan absen, atau hanya dicatat namanya~~:
   **diputuskan 12 Oktober 2026** (galian Bab 5, bagian 5B.10 aturan 9): orang
   berstatus Freelance hanya dicatat nama dan nomor HP, tanpa akun, tanpa
   absen, tanpa slip, di satu tempat (DRV-45).
5. ~~Pedoman lapor dan persetujuan~~: **diputuskan 13 Oktober 2026** (Tahap 3E):
   pedoman hanya untuk dibaca, dengan satu baris pengingat di layar pengajuan
   (KAR-79). Butir ini selesai.
6. **Isi otomatis dari data pelamar (dulu KAR-11).** Ikut tertunda bersama Rekrutmen, yang ditangguhkan pemilik 12 Oktober 2026 (`../work/backlog/2026-10-12-rekrutmen-ditangguhkan.md`).
7. ~~Perlakuan jabatan GM di luar hak akses~~: **diputuskan 12 Oktober 2026**,
   sama dengan jabatan Pemilik: tidak diabsen, gaji tidak terlihat HR, tanpa
   bonus (KAR-67). Butir ini selesai.

## 7. Catatan untuk Tahap 3 dan 4

1. Daftar orang dibagi per halaman dan bisa dicari (PRI-10).
2. Tempat uji dengan akun contoh per jabatan dikerjakan bersama modul ini
   (`../work/backlog/2026-10-11-tempat-uji-per-jabatan.md`).
3. Pelajaran dari database sistem lama, yang menjadi dasar mesin pengaman, ada di
   `../work/backlog/2026-10-11-mesin-pengaman-hak-akses.md`.
4. Data induk sistem lama sedikit (7 cabang, 3 departemen, 11 jabatan);
   dipindahkan dengan tangan saat tayang sudah cukup.

## 8. Istilah

Sudah dimasukkan ke `00-kamus-istilah.md`: status kerja, departemen, jabatan,
periode, Gaji Standar, izin tugas lapangan, Daftar Pengecualian, riwayat
penempatan, riwayat status, pedoman lapor, Lihat sebagai.
