# Buku Aturan: Logistik

Status: **ditetapkan 12 Oktober 2026**, kecuali yang tercantum di bagian 6
("Masih terbuka").

Nomor aturan tidak diurutkan ulang, supaya rujukan dari dokumen lain tetap benar.

File ini hanya berisi aturan yang berlaku di v3. Hasil galian sistem lama, hasil
cek database, semua pertanyaan, dan jawaban pemilik disimpan di
`arsip/04-logistik-galian.md` (bagian 4A s.d. 4E). Nomor LOG-A, LOG-B, LOG-C,
dan LOG-D di arsip itu adalah nomor galian sistem lama, bukan nomor aturan v3.
Asal tiap aturan di bawah tercatat di bagian 4E arsip itu.

Kata pemilik: Logistik adalah modul **paling penting**. Modul ini bersambung
dengan sistem kasir lewat modul Tarik Data Kasir
(`../work/backlog/2026-10-11-tarik-data-kasir.md`).

Nominal upah ritase, upah belanja, dan minggu upah diatur di Bab 5. Buku ini
hanya menentukan **kapan** ritase dan upah belanja tercatat.

Di buku ini, "pemilik" dalam urusan hak akses berarti jabatan Pemilik dan
**GM**, yang haknya setara (LOG-84).

## 1. Modul ini mengurus apa

Semua barang yang keluar dari gudang dan cabang menuju toko pelanggan, dan apa
yang terjadi di toko. Isinya:

- data pengiriman toko (alamat, titik lokasi, rute bawaan)
- surat jalan dan nota
- rencana kirim
- trip truk gudang dan ritase
- laporan muat cabang
- perjalanan antar sendiri oleh karyawan cabang
- uang yang diterima di toko dan pemeriksaannya
- potong nota, barang kejadian, Kirim Besok, Gagal, dan retur
- bonus ongkir antar sendiri (ongkir dan pengantar dibaca dari nota kasir)
- Dashboard dan Laporan Logistik

Modul ini **tidak** memegang piutang toko. Piutang milik sistem kasir; Logistik
hanya mengirim bahan yang mengubah tagihan (LOG-65).

## 2. Data yang dimiliki modul ini

| Data | Isinya |
|---|---|
| Data pengiriman toko | Tambahan HRIS atas toko dari kasir: alamat, titik lokasi beserta fotonya dan persetujuannya, nomor HP, rute bawaan, kode kasir |
| Mobil dan rute | Nama, plat, jenis rute (antar atau belanja), aktif |
| Surat jalan dan nota | Toko, nominal, nomor, sumber (manual atau kasir), cabang pemilik nota, status, bagian uangnya, tanda sudah tercatat di kasir |
| Rencana kirim dan trip | Tanggal, mobil, rute, driver, kenek, isi (toko, belanja, retur), status, foto bak dan garasi, bensin |
| Kunjungan toko | Hasil di tiap toko: kirim, Kirim Besok, atau Gagal; foto; cara bayar; uang diterima; kejadian |
| Ritase dan upah belanja | Satu baris per ritase atau tugas belanja yang selesai: siapa, tanggal, mobil, rute (nominalnya Bab 5) |
| Laporan muat cabang | Cabang asal, toko tujuan, jalur, nota cabang (dengan ongkir dan pengantar yang dibaca dari nota kasir, LOG-42), foto, paket |
| Perjalanan antar sendiri | PJ, tujuan, tiga foto, lama, alasan |
| Potong nota dan barang kejadian | Per barang: nama, nominal atau jumlah, alasan, nasib, pemilik, keputusan |
| Retur | Toko, cabang penerima, barang dan jumlahnya, nilai yang disahkan, penerimaan |
| Pemeriksaan uang | Riwayat: siapa, angka, rekening, kapan, pembatalan dan alasannya |
| Kiriman ke kasir | Daftar "Catat di Kasir" untuk semua yang harus diketik tangan di kasir: ringkasan per nota (uang terperiksa, potongan, sisa dan janji bayar), titipan toko, retur, batalkan penjualan, koreksi; ditambah baris dari Keuangan lewat pintu tulis (LOG-134) |
| Catatan tagih | Hasil Marketing menghubungi toko: janji bayar, tidak bisa dihubungi, tagih saat kirim berikutnya, sengketa (LOG-139) |
| Permintaan bensin | Perkiraan dari driver, nominal sebenarnya, foto struk, siapa |
| Tertunda | Satu catatan tunda untuk semua jenis kiriman |

Yang **bukan** milik modul ini:

| Data | Milik modul |
|---|---|
| Nama dan identitas toko, penjualan, piutang, pelunasan, titipan toko | Sistem kasir (dibaca lewat Tarik Data Kasir) |
| Orang, cabang dan titik lokasinya, jabatan, izin tugas lapangan, hak akses | Karyawan (KAR-05, KAR-25, KAR-58) |
| Fitur memasang titik lokasi | Satu fitur bersama Karyawan dan Kehadiran (KEH bagian 7 butir 9) |
| Tarif ritase dan belanja, minggu upah, pembayaran upah driver | Gaji Driver (Bab 5) |
| Buku Bonus, pengesahan bonus, persen bonus sebagai pengaturan jenis bonus | Gaji (GAJ-24, 25, 26) |
| Kas Masuk (Buku Kas), tempat uang, pengeluaran bensin | Keuangan (KEU-01, 02, 26, 71) |

## 3. Aturan

### 3.1 Toko dan titik lokasi

| No | Aturan |
|---|---|
| LOG-01 | **Data toko milik sistem kasir.** HRIS hanya menambahkan data pengiriman: alamat, titik lokasi, nomor HP, dan rute bawaan. Selama tarik data kasir belum menyala, toko diketik di HRIS dengan kolom kode kasir yang sudah disiapkan; setelah menyala, toko dicocokkan dengan kasir dan yang tidak cocok ditampilkan untuk diperbaiki. *(Diperinci atau dilapisi LOG-90, 13 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-02 | **Dicabut 13 Oktober 2026** (LOG-89). Pelanggan grooming dan kucingnya dicatat di sistem kasir. |
| LOG-03 | **Satu aturan tambah toko** untuk semua jalan masuk (Master Toko, tambah cepat dari laporan muat atau order): nama minimal 3 huruf, alamat minimal 5 huruf, nama yang sama dengan toko lain (termasuk nonaktif) ditolak. *(Diperinci atau dilapisi LOG-90, 91, 13 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-04 | Toko **tidak pernah dihapus**, hanya dinonaktifkan. Toko yang terlanjur dobel **digabungkan**, dan riwayatnya ikut pindah. *(Diperinci atau dilapisi LOG-92, 13 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-05 | **Titik lokasi toko** dipasang driver saat pertama kali mengantar, dengan foto depan toko, lalu disetujui Kepala Gudang. Titik yang sudah disetujui hanya diubah Kepala Gudang atau pemilik. Fiturnya sama dengan titik cabang. Toko tanpa titik ditandai "belum ada titik". *(Diperinci atau dilapisi LOG-93, 13 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-06 | Tiap toko boleh punya **rute bawaan**. Saat rute dipilih di rencana, surat jalan toko di rute itu tampil paling atas. |
| LOG-07 | Daftar toko dibaca jabatan yang memerlukannya menurut daftar hak akses, bukan semua orang yang login. |

### 3.2 Surat jalan dan nota

| No | Aturan |
|---|---|
| LOG-08 | **Satu penjualan grosir Gudang ke toko di kasir = satu surat jalan.** Tahap awal surat jalan diketik manual dan bertanda "manual". Nomor surat jalan, kode kasir toko, dan tanda sumber disiapkan sejak awal, sehingga tarik otomatis tinggal dinyalakan. Setelah menyala, surat jalan manual dicocokkan dengan kasir dan yang tidak cocok masuk daftar periksa. *(Diperinci atau dilapisi LOG-95, 97, 13 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-09 | Surat jalan berisi toko, nominal nota gudang (lebih dari 0, rupiah bulat), nomor, dan catatan; tanggalnya dari server. Dicatat oleh Marketing, Kepala Gudang, atau pemilik. Status: Menunggu dijadwalkan, Dalam perjalanan, Terkirim, Perlu keputusan, Batal. *(Diperinci atau dilapisi LOG-95, 13 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-10 | Satu toko boleh punya beberapa surat jalan (pesanan pagi dan tambahan). Semuanya menjadi **satu kunjungan**, tetapi tiap surat jalan tetap satu nota. Nota gudang sebuah kunjungan = jumlah surat jalannya; driver tidak mengetik nominal nota. |
| LOG-11 | Mengubah surat jalan: sebelum truk berangkat oleh pencatatnya (LOG-09); setelah berangkat atau terkirim **hanya pemilik**. Perubahan nominal tercatat (lama, baru, siapa), dan uang kunjungannya dibagi ulang. *(Diperinci atau dilapisi LOG-96, 13 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-12 | Membatalkan surat jalan hanya selagi belum dijadwalkan (Menunggu atau Perlu keputusan), wajib alasan. Surat jalan batal tetap tercatat. *(Diperinci atau dilapisi LOG-96, 13 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-13 | **Satu daftar nota** untuk nota gudang (surat jalan) dan nota cabang (laporan muat), masing-masing dengan cabang pemilik nota. Bagian uang disimpan **sekali per nota**; kunjungan tidak menyimpan salinannya. Cabang Gudang dikenali dari **jenis cabang**, bukan dari namanya. |
| LOG-14 | **Nota terkunci begitu tercatat di kasir.** Sesudah itu uang, potongan, dan retur nota itu hanya dikoreksi oleh finance atau pemilik, dengan alasan, dan koreksinya otomatis masuk daftar kiriman ke kasir sebagai baris "koreksi". *(Diperinci LOG-135, 136, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |

### 3.3 Rencana kirim

| No | Aturan |
|---|---|
| LOG-15 | Rencana dibuat Kepala Gudang atau pemilik: mobil, rute, driver, dan kenek (tidak wajib). Pilihan driver dan kenek mengikuti izin tugas lapangan (KAR-05). Driver dan kenek tidak boleh orang yang sama. Driver atau kenek yang tidak bisa jalan cukup **lapor ke Kepala Gudang**, lalu tidak dipilih; tidak ada pencatatan di sistem (KEH-32). |
| LOG-16 | **Tanggal kirim dimulai saat surat jalan dimasukkan ke rencana**, memakai jam server. Tidak ada rencana untuk tanggal mendatang, karena kiriman tidak bisa direncanakan jauh hari. |
| LOG-17 | Di layar dipakai kata **"Rute"** untuk wilayah. "Ritase" hanya berarti satu perjalanan (LOG-33). Rute punya **jenis**: antar atau belanja; rute belanja tidak dikenali dari namanya. *(Diperinci atau dilapisi LOG-94, 13 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-18 | Mobil dan rute diurus Kepala Gudang dan pemilik. Tarifnya diatur di Bab 5. *(Diperinci atau dilapisi LOG-94, 13 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-19 | **Toko masuk trip lewat dua pintu:** (a) surat jalan yang dimasukkan kantor sebelum truk berangkat (surat jalan yang datang setelah berangkat masuk rencana berikutnya), dan (b) paket cabang yang diambil driver (LOG-41). *(Diperinci atau dilapisi LOG-105, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-20 | Surat jalan yang pernah tertunda tampil paling atas di daftar pilihan, dari yang tertunda paling lama. |
| LOG-21 | Rencana boleh berisi toko, tugas belanja, dan tugas retur, termasuk belanja saja atau retur saja. Status: Draft, Siap Kirim, Berjalan, Menuju Garasi, Selesai, Dibatalkan. Setiap perubahan status lewat **pintu di server** yang memeriksa syaratnya. Syarat Siap Kirim: minimal satu isi, dan tarif untuk pasangan mobil dan rute sudah ada. *(Diperinci atau dilapisi LOG-98, 13 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-22 | Ganti driver atau kenek oleh kantor sampai Menuju Garasi; setelah Selesai dikunci di server karena upah sudah tercatat. Setelah berangkat, kantor masih bisa melepas toko yang belum diproses dan menambah tugas belanja atau retur. Toko yang sudah Terkirim atau Gagal terkunci. *(Diperinci atau dilapisi LOG-98, 101, 13 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-23 | Rencana hanya dibatalkan selagi Draft atau Siap Kirim, wajib alasan. **Semua isinya kembali ke antrean** (surat jalan, kunjungan, tugas belanja, retur); tidak ada yang tertinggal. |

### 3.4 Trip truk gudang

| No | Aturan |
|---|---|
| LOG-24 | Driver dan kenek melihat trip yang menugaskan dirinya. **Semua langkah trip lewat pintu server**; driver dan kenek tidak pernah mengubah baris trip atau kunjungan secara langsung. Mobil, rute, dan kenek hanya diganti kantor. |
| LOG-25 | "Berangkat" boleh ditekan driver atau kenek, dengan satu foto awak di dalam mobil, dan sekaligus menjadi **absen masuk** seluruh awak trip yang dibayar per ritase (KEH-96, 97; 13 Oktober 2026). **Tanggal trip = tanggal truk berangkat** menurut jam server. Kalau ada laporan muat ke toko di trip itu yang belum Selesai, muncul peringatan, tetapi tetap boleh berangkat. Saat trip Siap Kirim dibuka dan ada paket cabang yang menunggu dijemput, muncul pengingat. |
| LOG-26 | Urutan toko bebas; toko yang sedang dituju disimpan supaya kantor melihat "sedang menuju ...". Dua orang di satu trip tidak bisa memproses toko yang sama dua kali. Tombol dikunci 1 detik tiap tampilan berganti, dan setiap foto langsung tersimpan saat diambil. |
| LOG-27 | Tiap toko diselesaikan dengan **Kirim** atau **Gagal kirim** (LOG-55). **Selesai lebih awal** wajib alasan dan foto; toko sisanya menjadi Kirim Besok dan masuk satu tempat tertunda (LOG-57). |
| LOG-28 | Setelah semua toko dan tugas beres: foto bak kosong, lalu status Menuju Garasi. Trip tidak bisa selesai selama masih ada retur atau barang yang harus diantar ke pemiliknya belum selesai. *(Diperinci atau dilapisi LOG-103, 13 Oktober 2026; disetujui 14 Oktober 2026.)* *(Dilapisi LOG-115, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-29 | **Lapor sampai garasi wajib berada di titik lokasi gudang.** Tidak ada jeda waktu. Saat lapor: foto amper bensin, lalu Laporan Pulang driver untuk trip itu (serah terima, keadaan mobil, dan "perlu isi bensin besok?" beserta perkiraan nominalnya), lalu absen pulang tercatat. Dua trip sehari = dua laporan; absen pulang mengikuti trip terakhir (KEH-98, 100; 13 Oktober 2026). *(Diperinci atau dilapisi LOG-103, 13 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-30 | **Jalan keluar:** kalau lapor garasi tidak bisa dilakukan (GPS atau handphone bermasalah), Kepala Gudang atau pemilik menutup trip atas nama driver, wajib alasan dan foto. Ritase tetap dicatat server satu kali. *(Diperinci atau dilapisi LOG-103, 13 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-31 | Mobil seharusnya kembali di hari yang sama. Trip yang belum lapor garasi sampai **jam 12.00 hari berikutnya** ditandai untuk Kepala Gudang dan pemilik. |
| LOG-32 | Pengaturan uji yang mematikan pagar punya batas waktu, menyala lagi sendiri, dan selama mati tampil peringatan di dashboard pemilik. *(Diperinci atau dilapisi LOG-104, 13 Oktober 2026; disetujui 14 Oktober 2026.)* |

### 3.5 Ritase dan upah belanja

| No | Aturan |
|---|---|
| LOG-33 | **Satu ritase = satu trip yang membawa toko atau retur,** dari berangkat sampai lapor sampai garasi (atau ditutup kantor, LOG-30). Ritase tetap penuh walaupun ada toko yang tidak terkirim. Ambil retur tidak punya ritase sendiri. *(Diperinci atau dilapisi LOG-101, 13 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-34 | **Tugas belanja ke supplier bukan ritase.** Tugas yang selesai (foto nota supplier) dibayar sebagai **upah belanja**, di atas ritase trip-nya. Trip yang isinya **hanya belanja** dibayar upah belanja saja, tanpa ritase. Tarif per mobil dan rute belanja; nominalnya di Bab 5. *(Diperinci atau dilapisi LOG-100, 13 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-35 | Ritase dan upah belanja **hanya dicatat server**, sekali per trip atau tugas, tidak bisa dobel. Tanggalnya = tanggal trip (LOG-25), juga untuk belanja. Tarif dicari menurut tanggal itu (WAJ-07). |
| LOG-36 | **Ritase tangan** hanya untuk darurat: hanya pemilik, wajib alasan, dicek dobel di server. *(Diperinci atau dilapisi LOG-102, 13 Oktober 2026; disetujui 14 Oktober 2026.)* |

### 3.6 Laporan muat cabang dan paket

| No | Aturan |
|---|---|
| LOG-37 | Staf cabang membuat laporan muat: toko tujuan dan cabang asal (pemilik memilih cabang asal). Isinya foto isi barang dan foto paket, minimal satu paket. *(Diperinci atau dilapisi LOG-111, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-38 | **Tandai Selesai** wajib memilih jalur (diantar driver gudang atau diantar sendiri) dan nota cabang. Setelah itu foto terkunci. Selama tarik data kasir belum menyala, nominal nota cabang diketik; kolom pencocokan dengan kasir disiapkan. *(Diperinci atau dilapisi LOG-107, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-39 | Setelah Selesai, jalur dan nota masih bisa diubah; semua perubahan tercatat (lama, baru, siapa). Ongkir dan pengantar diubah di kasir (LOG-42); selama masih diketik di HRIS, ganti pengantar wajib alasan. Laporan yang masih Proses bisa dibatalkan dengan alasan; riwayat dan fotonya tetap tersimpan. Pengelolanya staf cabang asal atau pemilik. *(Diperinci atau dilapisi LOG-107, 111, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-40 | Paket yang lama menunggu berganti warna: kuning, oranye setelah 6 jam, merah setelah 24 jam. Laporan Proses yang tokonya sudah ada di trip driver ditandai "segera Tandai Selesai". *(Diperinci atau dilapisi LOG-111, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-41 | Driver atau kenek mengambil paket satu per satu ke trip-nya yang Siap Kirim atau Berjalan, hanya dari laporan Selesai berjalur driver. Mengambil paket otomatis memasukkan toko tujuannya ke trip. Semua paket satu nota wajib dibawa driver yang sama. *(Diperinci atau dilapisi LOG-105, 106, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |

### 3.7 Perjalanan antar sendiri

| No | Aturan |
|---|---|
| LOG-42 | Ada **dua jenis perjalanan**: trip truk gudang (ritase) dan **antar sendiri** oleh karyawan cabang (bukan ritase; pengantar mendapat bonus ongkir, LOG-76). **Ongkir dan pengantar milik nota kasir** (keputusan pemilik 13 Oktober 2026, Tahap 3G; jenis: pengganti cara isi lama): kasir wajib mengisi pengantar di setiap nota berongkir. Saat Tandai Selesai, staf memilih nota kasirnya; ongkir dan pengantar terisi dari nota itu, dan tugas antar muncul di HRIS untuk pengantar tersebut. Selama tarik data kasir belum menyala, ongkir dan pengantar diketik di HRIS bertanda sumber "diketik", lalu dicocokkan setelah menyala (PRI-39). Isian ketikan ini tidak melahirkan bonus; bonus ongkir hanya lahir dari baris ongkir kasir (LOG-76), supaya tidak dobel. Pengantar harus karyawan aktif cabang itu yang punya akun. *(Diperinci atau dilapisi LOG-108, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-43 | Tiga foto berjam server: **Foto 1** ambil barang (hanya pengantar yang ditunjuk; yang memotret menjadi PJ), **Foto 2** sampai di tiap tujuan, **Foto 3** kembali di cabang asal. Satu perjalanan boleh berisi beberapa kiriman. Jemput dan antar kucing tidak lewat perjalanan ini (LOG-74). Satu orang hanya satu perjalanan berjalan. Tiap tahap minimal 2 menit; selisih lama berangkat dan kembali 20 menit atau lebih wajib alasan. Foto galeri yang lebih tua dari 2 menit ditolak. PJ bisa dialihkan dengan alasan. *(Diperinci atau dilapisi LOG-110, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |

### 3.8 Uang di toko

| No | Aturan |
|---|---|
| LOG-44 | **Cara bayar: cash, transfer, deposit, tempo.** Transfer wajib foto bukti dari toko, dipaksa server di semua jalur, termasuk saat cara bayar diubah. Tanpa bukti, driver memilih deposit atau tempo. **Deposit** = toko mengaku sudah atau akan transfer tanpa bukti; finance memastikan uangnya masuk rekening, dan yang tidak masuk menjadi sisa tagihan. Tempo wajib tanggal jatuh tempo. *(Diperinci atau dilapisi LOG-113, 117, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-45 | **Campuran** untuk kasus jarang: dua angka, cash dan transfer, dengan foto bukti untuk bagian transfer. Ini pengecualian atas "satu cara bayar per kunjungan". |
| LOG-46 | Driver mengetik **uang diterima** (wajib lebih dari 0 kecuali tempo). Kurang bayar tidak menghambat driver. Server membagi uang ke **nota terbesar dulu**, sama besar Nota Gudang dulu. Potongan yang disetujui dikurangkan dulu dari nota pemilik barangnya. *(Diperinci atau dilapisi LOG-112, 113, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-47 | Kirim, uang, potong nota, dan kejadian disimpan dalam **satu langkah di server**: berhasil semua atau gagal semua. |
| LOG-48 | Mengubah pembayaran: driver dan kenek selama trip belum selesai, Kepala Gudang dan pemilik sesudahnya, semuanya lewat pintu server. Terkunci setelah diperiksa finance (pembatalan pemeriksaan, LOG-63) dan setelah tercatat di kasir (LOG-14). *(Diperinci atau dilapisi LOG-116, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-49 | **Lebih bayar adalah titipan toko**, bukan pemasukan cabang. Titipan dicatat di kasir (LOG-65). *(Diperinci atau dilapisi LOG-114, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-50 | Antar sendiri: pengantar memilih cara bayar dan mengetik uang diterima di Foto 2, untuk satu nota. Aturan cara bayar dan foto bukti sama dengan LOG-44 dan 45. *(Diperinci atau dilapisi LOG-117, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |

### 3.9 Potong nota dan barang kejadian

| No | Aturan |
|---|---|
| LOG-51 | **Potong nota** per barang: nama, nominal, alasan (salah muat, rusak atau kedaluwarsa, kurang jumlah, harga beda, lainnya), nasib barang (dibawa kembali atau memang tidak ada), dan pemilik barang (otomatis kalau hanya satu pemilik). Satu foto wajib. Potongan tidak boleh melebihi nota pemilik barang dan hanya mengurangi nota itu. *(Diperinci LOG-122, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-52 | Potong nota **disetujui finance atau pemilik**; HR dan Marketing tidak. Sebelum diputuskan, atau kalau ditolak (wajib alasan), potongan dihitung sebagai kurang bayar. Keputusan bisa diubah sampai nota tercatat di kasir (LOG-14). |
| LOG-53 | **Barang kejadian** (salah muat, barang lebih): per barang, barang terkirim, seharusnya barang apa, jumlah, pemilik, dan nasibnya: **dibawa pulang** (menjadi tugas antar ke pemilik) atau **dibeli toko** (catatan koreksi stok pemilik). Dibeli toko dengan harga lebih murah dicatat lewat potong nota alasan "harga beda". Kejadian selain "tidak ada" wajib foto dan keterangan. *(Diperinci atau dilapisi LOG-118, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-54 | **Barang yang kembali wajib diantar ke pemiliknya** dengan foto saat diserahkan, dan menahan trip sampai selesai. Setelah barang diterima, potongannya terkunci. *(Diperinci atau dilapisi LOG-115, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |

### 3.10 Kirim Besok, Gagal, dan tertunda

| No | Aturan |
|---|---|
| LOG-55 | Driver memilih **Kirim Besok** (toko tutup, tidak ada orang) atau **Gagal** (ditolak, batal pesan), wajib alasan dan foto. Kirim Besok: surat jalan kembali Menunggu, paket cabang kembali menunggu dijemput. *(Diperinci LOG-120, 121, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-56 | **Gagal di kedua jalur** (truk gudang dan antar sendiri) menjadi **Perlu keputusan**: kantor memutuskan surat jalan, cabang asal atau Kepala Gudang memutuskan barang cabang. Pilihannya jadwal ulang atau batal; batal wajib alasan. *(Diperinci LOG-122, 123, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-57 | **Tertunda dicatat di satu tempat** untuk semua jenis kiriman. Lebih dari 3 hari ditandai merah. Kepala Gudang atau pemilik bisa menutup tertunda dengan keterangan; kalau toko itu akhirnya terkirim, tertunda lain untuk toko yang sama tertutup sendiri. *(Dilapisi LOG-119, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |

### 3.11 Retur

| No | Aturan |
|---|---|
| LOG-58 | Retur ditandai Kepala Gudang, Marketing, finance, atau pemilik, dengan memilih cabang penerima. Satu toko hanya punya satu retur yang belum selesai. Retur masuk trip **hanya karena ditugaskan kantor**; bisa dilepas kembali, dan trip batal mengembalikannya ke menunggu. Retur yang salah ditandai dibatalkan dengan alasan, tidak dihapus. *(Diperinci LOG-126, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-59 | Driver mencatat tiap barang: foto, nama, **jumlah**, alasan, pemilik. Selesai: foto posisi akhir dan keterangan lokasi; barang milik cabang lain menjadi tugas antar ke pemiliknya. Kalau tidak ada barang: foto toko dan alasan. *(Diperinci LOG-126, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-60 | **Nilai retur** diisi dan disahkan finance, lalu **mengurangi tagihan toko** di kasir (LOG-65). *(Diperinci LOG-124, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-61 | Penerimaan retur oleh karyawan cabang penerima atau pemilik, dengan foto. Cabang bisa melaporkan **"barang tidak sesuai"** (kurang atau beda) dengan foto dan catatan, lalu ditinjau Kepala Gudang. *(Diperinci LOG-125, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |

### 3.12 Pemeriksaan uang, Kas Masuk, dan kasir

| No | Aturan |
|---|---|
| LOG-62 | **Semua uang selain tempo diperiksa finance atau pemilik paling lambat 3 hari**; lewat itu ditandai untuk pemilik. Pemeriksaan: **Cocok** atau **Tidak Cocok** (ketik angka yang benar, lalu dibagi ulang). Rekening dipilih finance untuk transfer dan deposit; cash masuk Brankas kalau diterima pemegangnya, atau Setoran di Finance kalau diterima finance (KEU-71). Satu halaman pemeriksaan untuk kedua jalur (truk dan antar sendiri). *(Diperinci LOG-127 s.d. 131, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-63 | Setiap pemeriksaan tersimpan sebagai riwayat (siapa, angka, kapan). Membatalkan pemeriksaan wajib alasan. *(Diperinci LOG-132, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-64 | Uang terperiksa mengalir ke **Kas Masuk** cabang pemilik nota. Tanggalnya: cash dan transfer = tanggal uang diterima di toko; **deposit = tanggal uang masuk rekening**, diisi finance saat memeriksa. Baris Kas Masuk dibatalkan, tidak dihapus. Uang fisiknya milik Gudang, omzetnya tetap untuk cabang pemilik nota (KEU-71). *(Dilapisi LOG-128 untuk tunai antar sendiri dan diperinci LOG-131, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-65 | **Piutang toko milik sistem kasir**; HRIS tidak punya Buku Piutang. HRIS mengirim ke kasir: uang terperiksa per nota, potong nota yang disetujui, retur yang disahkan beserta nilainya, titipan toko, dan koreksi (LOG-14). Tidak ada sambungan dari HRIS ke kasir (PRI-39): finance mencatatnya di kasir dengan tangan dari daftar di HRIS, lalu menandai "sudah tercatat di kasir". *(Diperinci LOG-133, 134, 137, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-66 | **Yang menagih adalah Marketing.** Daftar tagih (termasuk tempo lewat jatuh tempo) dibaca dari kasir dan ditampilkan untuk Marketing, finance, dan pemilik. Pelunasan dicatat langsung di sistem kasir. *(Diperinci LOG-138, 139, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |

### 3.13 Grooming

**Order grooming milik sistem kasir** (LOG-89). LOG-67 s.d. 73 dicabut
13 Oktober 2026 dan isinya tidak dibawa ke HRIS: pengaturan grooming, order,
groomer, foto tiap tahap, ganti groomer, dan batal semuanya diurus di kasir.

| No | Aturan |
|---|---|
| LOG-67 s.d. 73 | **Dicabut 13 Oktober 2026** (LOG-89). |
| LOG-74 | **Jemput dan antar kucing diurus sepenuhnya di kasir** (keputusan pemilik 13 Oktober 2026, Tahap 3G; jenis: pengganti LOG-74 lama). Kasir mencatat Delivery: alamat, pengantar, dan statusnya. HRIS tidak membuat perjalanan untuk kucing; bonus pengantarnya lewat LOG-76. Alasannya: uang grooming dibayar di kasir, bukan dipegang pengantar, jadi foto di HRIS tidak menjaga uang apa pun. |
| LOG-89 | **Order grooming milik sistem kasir** (keputusan pemilik 13 Oktober 2026, Tahap 3F; jenis: pengganti LOG-67 s.d. 73). Tab Grooming di kasir (terima kucing, groomer, data kucing dan pemiliknya, harga, delivery) sudah tayang. HRIS **menarik jasa yang selesai** lewat Tarik Data Kasir; bonus grooming dicatat modul Gaji (GAJ-61). Di Logistik tidak ada lagi data grooming. |

### 3.14 Bonus dari Logistik

Bonus dicatat ke Buku Bonus milik modul Gaji (GAJ-24); pengesahan dan masuk
slip mengikuti Bab 3.

| No | Aturan |
|---|---|
| LOG-75 | **Pindah ke GAJ-61** (13 Oktober 2026): bonus grooming dicatat modul Gaji langsung dari data kasir. |
| LOG-76 | **Bonus ongkir dari nota kasir** (ditulis ulang 13 Oktober 2026, Tahap 3G): tiap baris ongkir yang ditarik dari kasir dan **bukan gratis ongkir** menjadi satu baris Buku Bonus untuk **pengantar di nota itu** = persen × nilai ongkir sesudah diskon, dibulatkan ke bawah; berlaku untuk antar barang maupun antar-jemput kucing. Tanggalnya tanggal nota; cabangnya cabang nota. Nama pengantar di kasir dipasangkan sekali ke karyawan HRIS; yang belum dipasangkan ditahan di daftar "belum dipasangkan" (PRI-39). Kalau antar barangnya punya perjalanan antar sendiri di HRIS yang fotonya tidak lengkap, bonus tetap tercatat dengan tanda ⚠ dan bisa dibatalkan dengan alasan (GAJ-26). Nota yang dibatalkan atau diretur di kasir mengikuti PRI-39: sebelum terkunci bonus diperbarui bertanda; sesudah terkunci masuk daftar periksa. *(Diperinci atau dilapisi LOG-109, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-77 | Persen bonus ongkir adalah **pengaturan jenis bonus** (GAJ-25) dan dihitung di HRIS. Angka bonus di laporan kasir hanya perkiraan; yang masuk slip angka HRIS (WAJ-04). |
| LOG-78 | **Pindah ke GAJ-61** (13 Oktober 2026). |
| LOG-79 | **Pindah ke GAJ-61** (13 Oktober 2026). |

### 3.15 Dashboard, laporan, dan bensin

| No | Aturan |
|---|---|
| LOG-80 | Satu **Dashboard Logistik "perlu perhatian hari ini"**: trip truk dan perjalanan antar sendiri yang berjalan, tertunda lebih dari 3 hari, uang belum diperiksa lebih dari 3 hari, trip belum ditutup (LOG-31), permintaan bensin, barang kembali yang belum dikonfirmasi diterima lebih dari 3 hari, dan titik toko yang menunggu persetujuan. Pemilik dan Kepala Gudang melihat semua; Marketing melihat semua tanpa bagian bensin; finance melihat bagian uang. *(Diperinci LOG-140, 141, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-81 | **Laporan Logistik**: periode 26–25 atau tanggal bebas; semua jalur (truk dan antar sendiri); angka uang dibaca dari hasil pemeriksaan finance; tanpa piutang; bisa diunduh Excel. Dilihat pemilik, Kepala Gudang, Marketing, dan finance. *(Diperinci LOG-145, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-82 | Dashboard dan laporan **hanya membaca** angka dari pemiliknya, tidak menghitung sendiri (WAJ-04). *(Diperinci LOG-141, 145, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-83 | **Bensin "Sudah Diisi"** dicatat lewat server dengan nominal sebenarnya, foto struk, dan siapa; oleh Kepala Gudang, finance, atau pemilik. Melahirkan satu baris uang keluar di Buku Kas (KEU-26). *(Diperinci LOG-143, 144, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |

### 3.16 Hak akses dan aturan umum

LOG-84. **Hak akses isi awal** (diatur di daftar hak akses per jabatan, KAR-58;
tidak ada nama jabatan di kode):

| Jabatan | Di Logistik |
|---|---|
| Pemilik dan **GM** (hak setara) | Semua. Yang tertulis "hanya pemilik" di buku ini juga berlaku untuk GM |
| Kepala Gudang | Rencana, trip, mobil dan rute, titik toko, tertunda, keputusan Gagal, tinjau retur tidak sesuai, bensin, Dashboard, Laporan |
| Marketing | Surat jalan, toko, menandai retur, melihat semua pengiriman dan tertunda, daftar tagih, Dashboard (tanpa bensin), Laporan. **Tidak** memeriksa uang dan tidak menyetujui potong nota, supaya yang menagih bukan yang mengesahkan uangnya |
| Finance | Pemeriksaan uang, potong nota, nilai retur, kiriman ke kasir, daftar tagih, bensin, bagian uang di Dashboard, Laporan |
| HR | Tidak punya menu Logistik. Data ritase untuk upah dibaca lewat Bab 5; izin tugas lapangan diberi di modul Karyawan (KAR-64) |
| Driver dan kenek | Trip yang menugaskan dirinya, paket cabang, pasang titik toko |
| Staf cabang | Laporan muat cabangnya, antar sendiri, penerimaan retur |

| No | Aturan |
|---|---|
| LOG-85 | **Satu pintu, satu fungsi.** Tidak boleh ada dua fungsi bernama sama (pelajaran dari penanda alpha dan fungsi garasi di sistem lama). |
| LOG-86 | **Tidak ada catatan uang atau barang yang dihapus**: potongan, retur, pemeriksaan, kiriman ke kasir, Kas Masuk, dan order dibatalkan dengan alasan (PRI-02). |
| LOG-87 | **Dicabut 12 Oktober 2026** (Bab 5, pertentangan H). Hari tidak bisa jalan tidak dicatat di sistem: orangnya lapor ke Kepala Gudang, lalu tidak dipilih di rencana (LOG-15). Tidak ada akibat ke upah, karena upah dihitung per ritase. |

### 3.17 Pengaturan dan angka awalnya

LOG-88. Semua angka di bawah adalah pengaturan, disimpan di satu tempat dan
dibaca server. Yang menyangkut uang bertanggal berlaku (WAJ-07).

| Pengaturan | Angka awal | Aturan |
|---|---|---|
| Radius titik lokasi gudang dan toko | sama dengan titik cabang (100 meter, KEH-12) | LOG-05, 29 |
| Batas trip belum ditutup | jam 12.00 hari berikutnya | LOG-31 |
| Batas tertunda merah | 3 hari | LOG-57 |
| Batas pemeriksaan uang | 3 hari | LOG-62 |
| Batas barang kembali belum diterima | 3 hari | LOG-80 |
| Warna paket menunggu | oranye 6 jam, merah 24 jam | LOG-40 |
| Antar sendiri: lama tiap tahap paling sedikit | 2 menit | LOG-43 |
| Antar sendiri: selisih yang wajib alasan | 20 menit | LOG-43 |
| Umur foto galeri yang ditolak | lebih dari 2 menit | LOG-43 |
| Kunci tombol | 1 detik | LOG-26 |
| Persen bonus ongkir | 50% (pengaturan jenis bonus) | LOG-76, 77 |

Persen bonus grooming (10%) pindah ke GAJ-61.
| Tarif ritase dan upah belanja | Bab 5 (DRV-08, 11) | LOG-34, 35 |

### 3.18 Perincian Tahap 4F-1: toko, mobil dan rute, surat jalan dan nota

Keputusan pemilik 14 Oktober 2026 (F1 s.d. F6, jawaban "ok" = sesuai saran;
ditulis 13 Oktober 2026 malam sebagai draf). Spec:
`../work/specs/2026-10-13-logistik-spec.md` bagian 3.1.

| No | Aturan |
|---|---|
| LOG-90 | **Toko sesudah sambungan pelanggan kasir menyala** (F2; jenis: pelapis LOG-01 dan 03): toko baru hanya lahir dari pelanggan kasir; HRIS hanya menambah data pengiriman (alamat, nomor HP, rute bawaan, titik, catatan). Toko yang diketik sebelumnya dipasangkan ke pelanggan kasir oleh Finance (TDK-L04); yang belum dipasangkan bertanda "belum ada di kasir". Pelanggan yang dinonaktifkan di kasir hanya ditandai; Marketing yang menonaktifkan tokonya. |
| LOG-91 | **Tambah toko cepat oleh cabang** (F2; jenis: perincian LOG-03): sebelum sambungan pelanggan menyala, staf cabang boleh menambah toko dari laporan muat dengan aturan LOG-03 yang sama; toko itu langsung bisa dipakai, bertanda "ditambah cabang, belum diperiksa" sampai Marketing atau Kepala Gudang menyimpannya sekali. Nama dibandingkan tanpa huruf besar-kecil, spasi ganda, dan titik. |
| LOG-92 | **Gabung toko** (F6; jenis: perincian LOG-04): Kepala Gudang, Marketing, Pemilik, atau GM, alasan wajib, tombol ditahan 3 detik. Satu langkah server memindah surat jalan, nota, kunjungan, retur, dan tertunda ke toko tetap, mengisi data pengiriman yang kosong, menunjuk semua nama kasir ke toko tetap, dan menonaktifkan toko yang digabung. Tidak boleh bila keduanya punya surat jalan Dalam perjalanan. **Batal gabung** oleh Pemilik atau GM dalam 30 hari mengembalikan catatan yang dipindah. |
| LOG-93 | **Titik toko** (F3; jenis: pelapis LOG-05): dipasang driver, kenek, atau pengantar antar sendiri saat di toko, dengan foto depan toko dari kamera dan akurasi GPS paling buruk 50 meter; usulan itu disetujui atau ditolak (alasan) oleh Kepala Gudang atau pemilik, yang juga boleh memasang langsung. Titik yang sudah disetujui tidak diubah pemasang; ia menekan "Laporkan titik salah" dan titik lama tetap dipakai sampai diputuskan. Riwayat titik disimpan. |
| LOG-94 | **Mobil dan rute** (jenis: perincian LOG-17, 18): diurus di Pengaturan › Logistik oleh Kepala Gudang dan pemilik; tidak dihapus; tidak bisa dinonaktifkan selama dipakai rencana Draft, Siap Kirim, Berjalan, atau Menuju Garasi; plat mobil unik; **jenis rute tidak bisa diubah sesudah dipakai trip**, karena tarif dicari menurut pasangan mobil dan rute. Pasangan tanpa tarif ditandai. |
| LOG-95 | **Surat jalan dari kasir dan "Diambil toko"** (F4; jenis: pelapis LOG-08 dan 09): sesudah sambungan transaksi menyala, setiap transaksi cabang berjenis Gudang ke pelanggan yang dipasangkan ke toko menjadi surat jalan Menunggu dijadwalkan bertanggal transaksi; RETAIL dan penjualan ke cabang sendiri (KEU-69) tidak. Status baru **Diambil toko** (akhir, tanpa uang di HRIS) ditandai Marketing atau Kepala Gudang selama Menunggu dijadwalkan, bisa dibuka lagi dalam 7 hari. |
| LOG-96 | **Mengubah dan membatalkan surat jalan bersumber kasir** (F5; jenis: pelapis LOG-11 dan 12): nominal dan toko tidak bisa diubah di HRIS. Perubahan atau pembatalan di kasir langsung berlaku selama Menunggu dijadwalkan; sesudah dijadwalkan atau berangkat masuk Perlu Diperiksa Kepala Gudang (Terima perubahan atau Biarkan, PRI-41). Surat jalan bersumber kasir tidak dibatalkan di HRIS; penjualannya dibatalkan di kasir, atau ditandai Diambil toko. *(Dikecualikan sempit oleh LOG-123 untuk kiriman Gagal, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| LOG-97 | **Nomor dan pencocokan surat jalan** (jenis: perincian LOG-08 dan PRI-41 butir 3): nomor surat jalan = nomor struk kasir + cabang kasir Gudang, unik, wajib juga untuk catat manual. Catat manual tetap tersedia sesudah sambungan menyala sebagai cadangan; tarikan dengan nomor yang sama mencocokkannya tanpa baris baru (nominal beda sebelum berangkat: nominal kasir dipakai dan tercatat; sesudah berangkat: Perlu Diperiksa). Yang tidak cocok setelah 2 hari masuk Perlu Diperiksa. Surat jalan sistem lama tanpa nomor dibawa bertanda "data lama". |

### 3.19 Perincian Tahap 4F-2: rencana dan trip truk

Keputusan pemilik 14 Oktober 2026 (R1 s.d. R5, jawaban "ok" = sesuai saran;
ditulis 13 Oktober 2026 malam sebagai draf). Spec:
`../work/specs/2026-10-13-logistik-spec.md` bagian 3.2.

| No | Aturan |
|---|---|
| LOG-98 | **Satu trip berjalan per mobil dan per orang** (R2; jenis: perincian LOG-21, 22): mobil dan orang boleh dipilih di beberapa rencana Draft, tetapi Siap Kirim, Berangkat, dan ganti awak ditolak server bila mobil atau orang itu masih di trip lain yang Berjalan atau Menuju Garasi; pesannya menyebut trip tersebut. |
| LOG-99 | **Kirim di luar titik toko** (R1; jenis: pelapis LOG-05 dan LOG-47): saat Kirim disimpan, server mencatat lokasi dan jarak dari titik toko. Di luar radius tetap tersimpan, bertanda "di luar titik toko" untuk ditinjau Kepala Gudang di Dashboard; toko tanpa titik tidak diperiksa. Tidak ada tolakan. |
| LOG-100 | **Tugas belanja** (R4; jenis: perincian LOG-34): diisi supplier dari daftar supplier (supplier baru bertanda belum diperiksa, KEU-57) dan foto nota supplier wajib, tanpa nominal; nilai belanja dicatat Keuangan (KEU-26). Tugas yang Selesai melahirkan upah belanja saat trip Selesai. |
| LOG-101 | **Ritase saat awak berubah** (R5; jenis: perincian LOG-22, 33 dan DRV-09): ritase dan upah belanja dicatat untuk awak yang masih tercatat saat trip Selesai; orang yang dicopot di tengah jalan tidak mendapat ritase otomatis dan, bila pantas, diberi ritase tangan oleh pemilik. Trip dihitung berkenek bila ada kenek tercatat saat Selesai. Kunci trip + orang + jenis mencegah dobel. |
| LOG-102 | **Ritase tangan** (R3; jenis: perincian LOG-36): hanya Pemilik atau GM, alasan wajib, paling jauh 14 hari ke belakang. Bila orang itu sudah punya ritase di tanggal, mobil, dan rute yang sama, ritase itu ditampilkan dan penyimpanan butuh konfirmasi kedua "Memang dua kali jalan" dengan alasan. |
| LOG-103 | **Lapor garasi dan tutup oleh kantor** (jenis: perincian LOG-28 s.d. 31, KEH-98, 100, 101): lapor garasi ditekan driver: titik Gudang, foto amper, Laporan Pulang, lalu Selesai dalam satu langkah (absen pulang, ritase, permintaan bensin); tiap langkah tersimpan begitu selesai. Kepala Gudang atau pemilik boleh menutup trip yang Berjalan atau Menuju Garasi dengan alasan dan foto, bukan trip yang ia awaki; kunjungan sisa menjadi Kirim Besok; ritase dicatat sekali. Surat jalan tidak bisa ditambah sesudah Berangkat; tugas belanja dan retur bisa. Rencana Draft atau Siap Kirim yang tidak berangkat sampai hari berikutnya hanya ditandai. |
| LOG-104 | **Pagar uji trip** (jenis: perincian LOG-32): hanya pemeriksaan titik Gudang saat lapor garasi yang boleh dimatikan, oleh Pemilik atau GM, beralasan, paling lama 24 jam, menyala lagi sendiri; selama mati ada peringatan di Dashboard dan tiap lapor garasi bertanda. Foto, satu pintu server, dan kunci dobel ritase tidak bisa dimatikan. |

### 3.20 Perincian Tahap 4F-3: laporan muat cabang, paket, dan antar sendiri

Keputusan pemilik 14 Oktober 2026 (M1 s.d. M6, jawaban "ok" = sesuai saran). Spec:
`../work/specs/2026-10-13-logistik-spec.md` bagian 3.3.

| No | Aturan |
|---|---|
| LOG-105 | **Paket masuk trip lewat dua jalan** (M1; jenis: pelapis LOG-19 dan 41): Kepala Gudang atau pemilik boleh menugaskan laporan muat Menunggu dijemput ke rencana (bertanda "dijadwalkan di trip", tidak bisa diambil trip lain), atau driver dan kenek mengambilnya langsung ke trip-nya yang Siap Kirim atau Berjalan. Mengambil paket memasukkan toko tujuan ke trip; bila toko sudah ada, paket bergabung ke kunjungan yang sama. Trip yang membawa paket saja punya ritase. |
| LOG-106 | **Ambil paket per laporan sekaligus** (M2; jenis: pelapis LOG-41): semua paket satu laporan muat dicentang dan difoto sekali; server menolak pengambilan sebagian. Paket yang kurang dilaporkan lewat "Paket tidak lengkap" ke cabang asal, yang membetulkannya lewat Kembalikan ke Proses. |
| LOG-107 | **Nota cabang dan perubahan sesudah Selesai** (M3; jenis: perincian LOG-38, pelapis LOG-39): satu laporan muat = satu nota cabang, dengan nomor struk kasir cabang asal (unik per cabang). Sesudah sambungan transaksi menyala, nota dipilih dari transaksi kasir cabang asal ke toko itu dalam 7 hari terakhir dan hanya bisa dipakai sekali; nominal, ongkir, dan pengantar mengikuti kasir. Sesudah paket diambil atau perjalanan berangkat, jalur terkunci dan nominal nota yang diketik hanya diubah Pemilik atau GM dengan alasan; perubahan nota bersumber kasir masuk Perlu Diperiksa Kepala Toko cabang asal atau Kepala Gudang. |
| LOG-108 | **Pengantar di kasir dan di HRIS** (M4; jenis: pelapis LOG-42): pengantar di nota kasir menentukan bonus ongkir; pengantar di HRIS menentukan siapa yang mengantar. Bila nama kasir belum dipasangkan, bukan karyawan aktif cabang asal yang punya akun, atau PJ dialihkan, staf memilih pengantar di HRIS dan kiriman bertanda "pengantar beda dengan kasir" sampai kasir dibetulkan. |
| LOG-109 | **Tanda ⚠ foto antar tidak lengkap** (M5; jenis: perincian LOG-76): untuk nota berongkir yang dipakai laporan muat berjalur antar sendiri, bila perjalanannya belum Foto 3 sampai 23.59 hari berikutnya sesudah tanggal nota (termasuk belum mulai atau ditutup kantor), baris bonus ongkirnya diberi tanda ⚠ lewat pintu tulis Buku Bonus; Foto 3 yang menyusul mencabut tanda. Nota berongkir tanpa laporan muat tidak diperiksa. |
| LOG-110 | **Antar sendiri dan absen** (M6; jenis: pelapis LOG-43 dan KEH-10): Mulai antar hanya bagi yang sudah absen masuk dan belum pulang; Pulang ditolak selama perjalanannya masih berjalan. Jalan keluar: Kepala Toko cabang itu, Kepala Gudang, atau pemilik menutup perjalanan dengan alasan (bukan perjalanan yang ia PJ-kan); tujuan tanpa hasil menjadi Kirim Besok. Perjalanan yang belum kembali sampai 23.59 ditandai. |
| LOG-111 | **Status laporan muat dan jalan keluarnya** (jenis: perincian LOG-37 s.d. 41): Proses, Menunggu dijemput, Menunggu diantar, Di trip, Dalam perjalanan, Terkirim, Perlu keputusan, Batal. Cabang asal berjenis toko. Laporan Menunggu yang belum diambil atau berangkat boleh dikembalikan ke Proses dengan alasan, lalu dibatalkan. Foto laporan muat, ambil paket, dan antar sendiri: kamera atau galeri berumur paling lama 2 menit (TAM-08, LOG-43). Warna menunggu dihitung dari jam Tandai Selesai, untuk kedua jalur. |

### 3.21 Perincian Tahap 4F-4a: kirim dan uang

Keputusan pemilik 14 Oktober 2026 (K1 s.d. K6, jawaban "ok" = sesuai saran). Spec:
`../work/specs/2026-10-13-logistik-spec.md` bagian 3.4.

| No | Aturan |
|---|---|
| LOG-112 | **Rumus pembagian uang ke nota** (jenis: perincian LOG-46 dan 13): satu fungsi server dipakai setiap kali angka berubah (Kirim, ubah pembayaran, ubah nominal nota, keputusan potong nota, Tidak Cocok). Tagihan nota = nominal − potongan disetujui; potongan seorang pemilik dikurangkan dari nota terbesar pemilik itu dulu. Uang dibagi ke tagihan terbesar dulu; sama besar: Nota Gudang dulu, lalu nomor nota lebih kecil. Campuran dibagi cash dulu. Sisa sesudah semua lunas = lebih bayar. Hasil lama ditandai Diganti, tidak dihapus. |
| LOG-113 | **Kurang bayar dan janji bayar sisa** (K1; jenis: perincian LOG-44, 46): kekurangan yang bukan karena potong nota menunggu wajib diberi tanggal janji bayar sisa (bawaan 7 hari, paling lama 60 hari, sama dengan batas tempo). Tempo berarti uang Rp0; tidak ada tempo dengan uang muka. Tanggal ini ikut kiriman ke kasir dan daftar tagih. |
| LOG-114 | **Titipan toko dicatat untuk pemegang uang** (K2; jenis: perincian LOG-49): Gudang untuk jalur truk (KEU-71), cabang asal untuk antar sendiri. Lebih bayar selalu dikonfirmasi pertanyaan kedua sebelum Kirim tersimpan. |
| LOG-115 | **Barang kembali** (K3; jenis: pelapis LOG-54 dan LOG-28): satu daftar untuk potong nota dibawa kembali, barang kejadian dibawa pulang, dan retur. Milik cabang selain Gudang diserahkan sebelum Menuju Garasi; milik Gudang diserahkan sebagai langkah lapor garasi dan tidak menahan Menuju Garasi; antar sendiri diserahkan saat Foto 3. Diterima oleh cabang pemilik (Kepala Gudang untuk Gudang) atau pemilik, dengan foto dan pilihan Sesuai atau Tidak sesuai; bukan oleh yang menyerahkan. Jalan keluar: Kepala Gudang atau pemilik mengalihkan ke Gudang dengan alasan, lalu diantar trip berikutnya. |
| LOG-116 | **Siapa mengubah pembayaran dan potongan** (K4; jenis: perincian LOG-48): truk: awak sampai trip Selesai, lalu Kepala Gudang dan pemilik; antar sendiri: PJ sampai Foto 3, lalu Kepala Toko cabang asal, Kepala Gudang, dan pemilik. Kantor wajib alasan dan Finance diberi tahu. Terkunci saat pemeriksaan finance berlaku dan saat tercatat di kasir. Potongan yang diubah sesudah diputuskan kembali Menunggu; tidak ada yang memutuskan potongan yang ia catat sendiri. |
| LOG-117 | **Satu layar Kirim untuk dua jalur** (K5; jenis: pelapis LOG-50, pengganti bacaan 4F-3 "uang per nota"): antar sendiri memakai satu angka uang per tujuan yang dibagi dengan LOG-112, sama dengan truk. Truk menambah foto terkirim (kamera langsung); antar sendiri memakai Foto 2. Foto bukti transfer kamera atau galeri tanpa batas umur. |
| LOG-118 | **Barang lebih dibeli toko** (K6; jenis: perincian LOG-53): uang yang dibayar toko untuk barang itu terbaca sebagai lebih bayar (titipan toko); cabang pemilik barang membuat penjualan baru di kasir, memakai titipan itu, dan menandai "Sudah dibuat di kasir" dengan nomor struk. Setiap barang dibeli toko juga masuk daftar koreksi stok pemilik barang. |

### 3.22 Perincian Tahap 4F-4b: tidak terkirim dan retur

Keputusan pemilik 14 Oktober 2026 (T1 s.d. T7, jawaban "ok" = sesuai saran). Spec:
`../work/specs/2026-10-13-logistik-spec.md` bagian 3.5.

| No | Aturan |
|---|---|
| LOG-119 | **Tertunda per kiriman** (T1; jenis: pelapis LOG-57): satu catatan tertunda per surat jalan atau laporan muat, dibuka saat Kirim Besok atau Gagal pertama; Kirim Besok berikutnya menambah hitungan. Catatan tertutup sendiri saat kiriman **itu** Terkirim, Diambil toko, atau Batal; kiriman lain toko yang sama tidak ikut tertutup. Tutup manual hanya untuk Kirim Besok (bukan Perlu keputusan), keterangan wajib, kiriman tetap di antrean. Merah lebih dari 3 hari sejak tanggal pertama. Dilepas kantor bukan tertunda. |
| LOG-120 | **Barang tidak terkirim** (T2; jenis: perincian LOG-55 dan LOG-28): di jalur truk, surat jalan dan paket cabang yang Kirim Besok atau Gagal pulang bersama truk dan diturunkan di Gudang sebagai langkah lapor garasi (satu foto); paket cabang menunggu di Gudang bertanda "barang di Gudang" untuk trip berikutnya. Langkah bak kosong menampilkan dan memotret sisa di bak. Barang itu baru menjadi barang kembali ke cabang asal bila diputuskan Batal atau dijadwalkan ulang lewat antar sendiri. |
| LOG-121 | **Coba lagi hari ini** (T3; jenis: perincian LOG-55): Kirim Besok boleh dibuka lagi oleh awak selama trip Berjalan, atau PJ sebelum Foto 3; catatannya menjadi Dicoba lagi, tidak dihapus. Kiriman Kirim Besok tidak bisa dimasukkan rencana lain selama truk pembawanya masih Berjalan. Gagal tidak bisa dicoba lagi. |
| LOG-122 | **Toko menolak sebagian** (T4; jenis: perincian LOG-51 dan 56): Kirim Besok dan Gagal berlaku untuk seluruh kunjungan. Nota yang ditolak utuh sementara nota lain diterima dicatat lewat Kirim sebagai potong nota senilai nota, alasan baru **"ditolak toko"**, dibawa kembali, diputuskan Finance. |
| LOG-123 | **Batal sesudah Gagal** (T5; jenis: pengecualian sempit LOG-96, perincian LOG-56): keputusan Batal langsung berlaku di HRIS dan menulis satu baris "Batalkan penjualan di kasir" per nota untuk Finance; pembatalan yang tertarik dari kasir dicocokkan sendiri tanpa Perlu Diperiksa. Pemutus: surat jalan oleh Kepala Gudang atau pemilik; laporan muat oleh staf cabang asal, Kepala Toko cabang asal, Kepala Gudang, atau pemilik, yang boleh memilih jalur lagi. Batal dibuka lagi hanya oleh Pemilik atau GM dalam 7 hari selama penjualan belum dibatalkan di kasir. |
| LOG-124 | **Nilai retur** (T6; jenis: perincian LOG-60): diisi Finance atau pemilik per barang, sesudah semua barang Diterima dan tinjau "Tidak sesuai" selesai, untuk jumlah yang benar-benar diterima; Rp0 boleh dengan alasan. Nilai disahkan per cabang pemilik barang masuk kiriman ke kasir; diubah dengan alasan sampai tercatat di kasir. |
| LOG-125 | **Tinjau barang tidak sesuai** (T7; jenis: perincian LOG-61): untuk semua barang kembali yang diterima Tidak sesuai. Kepala Gudang atau pemilik (bukan penyerah atau penerimanya) memilih Sesuai setelah dicek atau Selisih dicatat dengan jumlah sebenarnya, dan boleh meneruskan selisih ke HR sebagai usulan kehilangan barang (GAJ-75). Logistik tidak memotong gaji. |
| LOG-126 | **Alur retur** (jenis: perincian LOG-58 dan 59): status Menunggu ditugaskan, Di trip, Diambil, Tanpa barang, Menunggu nilai, Selesai, Dibatalkan. Retur hanya lewat trip truk. Barang dicatat dengan jumlah dan satuan; tiap barang menjadi barang kembali ke pemiliknya (LOG-115). Toko tutup: "Tidak bisa diambil hari ini", retur kembali Menunggu ditugaskan; toko tidak punya barang: Tanpa barang. Selesai lebih awal, tutup kantor, dan rencana batal mengembalikan retur yang belum dikerjakan ke Menunggu ditugaskan. Awak hanya bisa mengabari kantor "Toko mau retur"; menandai retur tetap tugas kantor. |

### 3.23 Perincian Tahap 4F-5a: pemeriksaan uang

Keputusan pemilik 14 Oktober 2026 (V1 s.d. V5, jawaban "ok" = sesuai saran). Spec:
`../work/specs/2026-10-13-logistik-spec.md` bagian 3.6.

| No | Aturan |
|---|---|
| LOG-127 | **Serah uang tunai truk per trip** (V1; jenis: perincian LOG-62 dan KEU-71): server menjumlah uang tunai yang harus diserahkan per trip, dirinci per toko dan per pembawa. Awak menyerahkannya kepada Finance (masuk Setoran di Finance) atau pemegang Brankas (masuk Brankas); penerimaan itu sekaligus pemeriksaan bagian tunai. Satu trip satu serah; pembawa tidak menerima uangnya sendiri. Tidak menahan lapor garasi; belum diserahkan sampai 12.00 hari berikutnya ditandai untuk Kepala Gudang, Finance, Pemilik, dan GM. |
| LOG-128 | **Tunai antar sendiri lewat laci cabang asal** (V2; jenis: pelapis LOG-64 untuk jalur ini, perincian LOG-62): saat Foto 3, uang tunai diserahkan ke laci cabang asal dan diterima karyawan cabang itu yang bertugas, bukan PJ (Kepala Toko, Pemilik, GM juga boleh). Uang itu ikut setoran Laporan Kasir sebagai baris tersendiri, dan ikut Cocok saat Finance menerima setoran itu Cocok; bila setoran Tidak cocok, Finance memeriksanya sendiri. Kas Masuk ke Laci cabang asal. Belum diterima sampai 23.59 ditandai untuk Kepala Toko. |
| LOG-129 | **Selisih uang tunai** (V3; jenis: perincian LOG-62): selisih dijelaskan per toko dulu (Tidak Cocok untuk toko itu, kekurangannya menjadi tagihan). Sisanya menjadi **kurang serah** atau **lebih serah** atas nama pembawa; uang toko tidak diubah. Kurang serah ditandai untuk Pemilik dan GM dan diteruskan ke HR sebagai bahan Potongan Lain (GAJ-80); Logistik tidak memotong gaji. Dua pembawa yang tidak jelas: dibagi sama rata, bertanda. |
| LOG-130 | **Deposit yang belum masuk** (V4; jenis: perincian LOG-44 dan 62): ditunggu paling lama batas pemeriksaan 3 hari. Masuk: rekening, tanggal masuk rekening (paling jauh 7 hari ke belakang, KEU-12), angka. Belum masuk: bagian deposit menjadi Rp0 dan seluruhnya sisa tagihan dengan janji bayar 7 hari; uang yang datang sesudahnya pelunasan biasa di kasir (LOG-66). |
| LOG-131 | **Bagian uang dan Kas Masuk** (jenis: perincian LOG-62 dan 64): yang diperiksa adalah bagian uang (tunai, transfer, deposit) sebuah pembayaran; pembayaran terkunci begitu satu bagian diperiksa (LOG-116). Tidak Cocok menulis pembayaran baru dan menjalankan LOG-112; kekurangannya diberi janji bayar 7 hari dari hari pemeriksaan. Tidak ada yang memeriksa pembayaran yang terakhir ia ubah (KEU-120). Transfer boleh Cocok sekaligus per rekening (KEU-14). Kas Masuk satu baris per nota per tempat uang, cabang pemilik nota; lebih bayar ditulis sebagai baris "titipan toko", bukan pendapatan. Tempo tidak diperiksa. |
| LOG-132 | **Membatalkan pemeriksaan** (V5; jenis: perincian LOG-63, pengecualian sempit KEU-16): Finance membatalkan pemeriksaannya sendiri dalam 7 hari; Pemilik dan GM selama nota belum tercatat di kasir; sesudahnya hanya koreksi (LOG-14). Batal membuka kunci pembayaran dan membatalkan baris Kas Masuk; riwayat tersimpan. |

### 3.24 Perincian Tahap 4F-5b: kiriman ke kasir dan daftar tagih

Keputusan pemilik 14 Oktober 2026 (D1 s.d. D7, jawaban "ok" = sesuai saran). Spec:
`../work/specs/2026-10-13-logistik-spec.md` bagian 3.7.

| No | Aturan |
|---|---|
| LOG-133 | **Ringkasan per nota** (D1; jenis: perincian LOG-65): daftar Catat di Kasir berisi satu ringkasan per nota yang lahir saat nota siap: kiriman Terkirim, semua bagian uang selain tempo diperiksa, tidak ada potong nota Menunggu, dan untuk tempo trip Selesai atau Foto 3. Isinya dibaca dari pembagian uang (LOG-112): uang per cara bayar dan tanggal, potongan, sisa, janji bayar atau jatuh tempo; dicatat di kasir cabang penerbit nota. Baris lain: titipan toko (sesudah pembayarannya diperiksa), kurangi tagihan karena retur per cabang pemilik barang, batalkan penjualan, koreksi. Selama belum tercatat, baris mengikuti sumbernya dan bertanda berubah. Menunggu lebih dari 2 hari ditandai untuk Finance, Pemilik, dan GM. |
| LOG-134 | **Satu daftar untuk semua catatan tangan ke kasir** (D2; jenis: perincian LOG-65, KEU-46, KEU-69): titipan pelunasan dan pembayaran toko ke Gudang ditulis Keuangan ke daftar yang sama lewat pintu tulis. Tabelnya milik Logistik; baris hanya ditulis server. |
| LOG-135 | **Tanda tercatat dan kunci nota** (jenis: perincian LOG-14): ditandai Finance, Pemilik, atau GM, tombol ditahan 3 detik, boleh sekaligus per kasir cabang. Ringkasan yang tercatat mengunci pembayaran, keputusan potong nota, dan pemeriksaan nota itu; baris retur yang tercatat mengunci nilai retur. Salah tandai dibatalkan dengan alasan oleh penandanya dalam 24 jam, atau Pemilik dan GM, selama belum ada koreksi sesudahnya. |
| LOG-136 | **Koreksi sesudah tercatat** (D3; jenis: perincian LOG-14): oleh Finance, Pemilik, atau GM, alasan wajib, langsung berlaku tanpa persetujuan. Uang, potongan, dan nilai retur yang dikoreksi menulis pengganti, menjalankan LOG-112, mengganti baris Kas Masuk, dan menulis baris koreksi ke kasir; tempat uang dan tanggal hanya mengganti Kas Masuk. Kas Masuk di bulan tertutup dikoreksi di bulan berjalan (KEU-112). Koreksi oleh Finance diberitahukan ke Pemilik dan GM; yang mengurangi uang masuk masuk perlu perhatian. Koreksi tidak memotong gaji. |
| LOG-137 | **Pencocokan dengan piutang kasir** (D4; jenis: perincian LOG-65, PRI-41): sesudah sambungan piutang menyala, nota yang ringkasannya tercatat lebih dari 1 hari dan sisanya di kasir lebih besar daripada sisa menurut HRIS masuk Perlu Diperiksa Finance; dibetulkan di kasir atau Biarkan dengan alasan. Kasir menagih lebih kecil tidak ditandai. |
| LOG-138 | **Daftar Tagih** (D5; jenis: perincian LOG-66): piutang per nota dibaca dari kasir, ditambah keterangan HRIS (janji bayar, uang yang sudah di HRIS tetapi belum tercatat di kasir, catatan tagih); merah lewat jatuh tempo atau janji, oranye jatuh tempo dalam 3 hari; bisa diunduh Excel. Sebelum sambungan piutang menyala, Finance mengunggah file piutang dari laporan kasir; file lebih tua dari 7 hari diperingatkan. HRIS tidak menghitung piutang sendiri. |
| LOG-139 | **Catatan tagih** (D6; jenis: perincian LOG-66): Marketing, Finance, Pemilik, atau GM mencatat hasil menghubungi toko: Janji bayar (tanggal), Tidak bisa dihubungi, Tagih saat kirim berikutnya (kotak di kunjungan toko itu), Sengketa (alasan, ditandai untuk Finance). Tidak mengubah kasir. Awak tidak menagih lewat HRIS; tagihan lama yang dibayar ke driver menjadi lebih bayar (titipan toko, LOG-114). |

### 3.25 Perincian Tahap 4F-5c: dashboard, laporan, dan bensin

Keputusan pemilik 14 Oktober 2026 (B1 s.d. B6, jawaban "ok" = sesuai saran). Spec:
`../work/specs/2026-10-13-logistik-spec.md` bagian 3.8.

| No | Aturan |
|---|---|
| LOG-140 | **Isi Dashboard Logistik** (B1; jenis: perincian LOG-80, pelapis LOG-80 untuk bagian Finance): empat bagian berurutan, yaitu Berjalan sekarang, Pengiriman, Uang, serta Mobil dan bensin. Barisnya semua tanda yang diarahkan ke Dashboard di LOG-90 s.d. 139, ditambah keadaan mobil Perlu perhatian (KEH-94) dan uang bensin yang belum berstruk (KEU-26). Pemilik dan GM melihat semua; Kepala Gudang semua kecuali pagar mati (LOG-32); Marketing tanpa Mobil dan bensin dan tanpa kurang serah; Finance bagian Uang serta Mobil dan bensin. Kepala Toko dan staf cabang memakai Beranda. |
| LOG-141 | **Dashboard hanya membaca** (jenis: perincian LOG-82): tiap baris dibaca dari fungsi baca bagian pemilik tandanya; batas waktu tidak dihitung di halaman; rupiah hanya dari tabel pemiliknya (uang belum diperiksa bertulisan "menurut laporan awak"); tanpa uang masuk, laba, dan piutang; tidak ada tombol pengubah data, hanya Buka ke layar pemiliknya. Muat ulang otomatis tiap 1 menit; jam data kasir terakhir masuk ditampilkan. |
| LOG-142 | **Tinjau kiriman di luar titik toko** (B2; jenis: perincian LOG-99): Kepala Gudang, Pemilik, atau GM, bukan awak atau PJ perjalanan itu, memilih Wajar, Titik toko mungkin salah (menjalankan Laporkan titik salah, LOG-93), atau Tidak wajar (alasan wajib; ditandai untuk Pemilik dan GM, awak diberi tahu). Tidak ada potongan otomatis. Belum ditinjau lebih dari 3 hari masuk Antrean Kepala Gudang. |
| LOG-143 | **Permintaan bensin** (B4; jenis: perincian LOG-83 dan KEH-100): lahir dari Laporan Pulang driver di trip, memuat mobil, perkiraan, dan foto amper. Satu yang Menunggu per mobil; yang baru mengganti yang lama. Ditutup dengan Sudah Diisi atau Tidak jadi (alasan wajib, driver diberi tahu); tidak ditutup otomatis. Menunggu lewat 12.00 hari berikutnya menjadi merah dan masuk Antrean Kepala Gudang dan Finance. |
| LOG-144 | **Catatan bensin dan asal uangnya** (B3, B6; jenis: perincian LOG-83 dan KEU-26): Sudah Diisi atau Catat bensin oleh Kepala Gudang, Finance, Pemilik, atau GM: mobil, pengisi, tanggal isi (paling jauh 7 hari ke belakang), nominal struk, foto struk ("struk tidak ada" boleh dengan alasan, ditandai untuk Pemilik dan GM). Asal uang: uang bensin yang sudah diberikan (baris "struk menyusul" dibetulkan, kembalian kembali), tempat uang yang dipegang pencatat (baris baru), atau dibayar orang lain dulu (baris belum dipasangkan; Finance memasangkan, KEU-18). Hasilnya selalu satu baris uang keluar "Bensin atau solar" untuk mobil itu, dibebankan ke cabang Gudang, dan diperiksa di Pemeriksaan Keuangan seperti baris yang diketik (KEU-09). Batal dengan alasan oleh pencatat sebelum diperiksa; sesudahnya hanya Pemilik dan GM. |
| LOG-145 | **Laporan Logistik** (B5; jenis: perincian LOG-81): periode 26–25 atau tanggal bebas paling panjang 3 bulan; dasar tanggal = tanggal kirim (retur: tanggal diambil; bensin: tanggal isi); enam tab (Ringkasan, Per trip dan perjalanan, Per toko, Per cabang pemilik nota, Per mobil, Per awak); uang terperiksa terpisah dari yang belum diperiksa; ritase sebagai banyaknya, tanpa rupiah; tanpa piutang; unduh Excel dibuat server dan tercatat. Marketing tanpa angka bensin. |

## 4. Yang diganti dari sistem lama

Daftar lengkap aturan sistem lama dan nasibnya ada di arsip. Yang paling mengubah
cara kerja:

| Di sistem lama | Di v3 | Aturan |
|---|---|---|
| Toko diketik terpisah dari kasir; 264 tanpa alamat; tanpa titik | Data toko dari kasir; satu aturan tambah toko; titik dipasang driver | LOG-01, 03, 05 |
| Toko dihapus kalau belum dipakai; dobel tidak bisa digabung | Tidak dihapus; gabungkan dobel | LOG-04 |
| Surat jalan tanpa nomor, tidak dicocokkan kasir | Manual bertanda, siap dicocokkan | LOG-08 |
| "Ritase" di layar berarti rute | "Rute" untuk wilayah | LOG-17 |
| Tanggal rencana dari jam handphone | Jam server; tanggal trip = tanggal berangkat | LOG-16, 25 |
| Syarat Siap Kirim dan kunci awak hanya di layar | Pintu server | LOG-21, 22 |
| Rencana batal meninggalkan kunjungan "menunggu" | Semua isi kembali ke antrean | LOG-23 |
| Tertunda di tiga tempat | Satu tempat | LOG-57 |
| Driver dan kenek mengubah baris trip dan kunjungan langsung | Semua lewat pintu server | LOG-24, 47 |
| Jeda garasi 30 menit (sedang mati) | Lapor garasi di titik gudang; ada jalan keluar | LOG-29, 30 |
| Tugas belanja = satu ritase tambahan; trip belanja saja dibayar dua kali | Upah belanja di atas ritase; belanja saja tanpa ritase | LOG-33, 34 |
| Ritase tangan oleh HR dan finance, cek dobel di layar | Hanya pemilik, alasan, cek di server | LOG-36 |
| Dua fungsi tutup trip bernama sama | Satu pintu, satu fungsi | LOG-85 |
| "Deposit" tiga arti; campur pakai deposit | Empat cara bayar dengan arti tetap, ditambah Campuran | LOG-44, 45 |
| Ganti ke transfer tanpa foto bukti lolos | Foto bukti dipaksa server di semua jalur | LOG-44 |
| Uang satu kunjungan di tiga tempat | Sekali per nota | LOG-13 |
| Cabang Gudang dicari dari nama di empat tempat | Jenis cabang | LOG-13 |
| Potong nota, kejadian, dan kunjungan tiga langkah terpisah | Satu langkah | LOG-47 |
| Potongan, retur, pelunasan, Kas Masuk dihapus lalu ditulis ulang | Dibatalkan dengan alasan | LOG-86 |
| Lebih bayar menjadi pemasukan cabang Gudang | Titipan toko di kasir | LOG-49 |
| Gagal antar sendiri langsung batal | Perlu keputusan, sama dengan jalur driver | LOG-56 |
| Retur tanpa jumlah dan nilai, tidak mengurangi tagihan | Jumlah wajib; nilai disahkan finance mengurangi tagihan | LOG-59, 60 |
| Penerimaan retur tanpa "tidak sesuai" | Bisa dilaporkan dan ditinjau | LOG-61 |
| Verifikasi tanpa batas waktu; dibatalkan tanpa alasan dan jejak | 3 hari; riwayat; batal beralasan | LOG-62, 63 |
| Tiga aturan tanggal Kas Masuk | Tanggal uang diterima | LOG-64 |
| Buku Piutang di HRIS; pelunasan di HRIS | Piutang dan pelunasan di kasir | LOG-65, 66 |
| Order grooming, pengaturan grooming, dan bonus grooming dua jalur di HRIS | Order grooming di kasir; bonus grooming satu jalur dari data kasir | LOG-89, GAJ-61 |
| Ongkir dan pengantar diketik di HRIS | Dibaca dari nota kasir | LOG-42, 76 |
| Dashboard hanya trip truk; laporan bulan kalender, menghitung piutang di layar | Satu dashboard semua jalur; laporan 26–25 hanya membaca | LOG-80, 81, 82 |
| Tombol bensin tidak berbuat apa-apa untuk HR dan finance | Lewat server, nominal sebenarnya | LOG-83 |
| Hak dari nama jabatan, cabang, dan departemen | Daftar hak akses per jabatan | LOG-84 |

## 5. Kejadian di lapangan dan jalan keluarnya

| Kejadian | Jalan keluar di v3 | Aturan |
|---|---|---|
| Salah ketik nominal surat jalan setelah truk berangkat | Diubah pemilik, tercatat, uang dibagi ulang | LOG-11 |
| Surat jalan dobel diketik | Nomor unik; dicocokkan dengan kasir | LOG-08 |
| Toko dibuat dobel | Digabungkan, riwayat ikut | LOG-04 |
| Driver tidak tahu letak toko baru | Titik dipasang saat pertama mengantar, disetujui Kepala Gudang | LOG-05 |
| Rencana dibatalkan | Semua isi kembali ke antrean | LOG-23 |
| Rencana disusun malam, truk berangkat pagi | Tanggal trip = tanggal berangkat | LOG-25 |
| Waktu habis, masih ada toko | Selesai lebih awal dengan alasan dan foto; sisanya tertunda | LOG-27 |
| Driver lapor garasi padahal belum sampai | Ditolak di luar titik gudang | LOG-29 |
| GPS atau handphone driver bermasalah saat di garasi | Kantor menutup trip dengan alasan dan foto | LOG-30 |
| Trip lupa ditutup sampai besok | Ditandai jam 12.00; kantor menutup | LOG-31, 30 |
| Trip hanya untuk belanja ke supplier | Upah belanja saja, tanpa ritase | LOG-34 |
| Driver tidak sempat memakai aplikasi | Ritase tangan oleh pemilik, alasan, cek dobel | LOG-36 |
| Driver tidak bisa jalan besok | Lapor ke Kepala Gudang; tidak dipilih di rencana. Tidak dicatat di sistem | LOG-15 |
| Toko tutup | Kirim Besok; kembali ke antrean; merah setelah 3 hari | LOG-55, 57 |
| Toko menolak barang (truk atau antar sendiri) | Gagal, perlu keputusan | LOG-56 |
| Toko bayar sebagian cash, sebagian transfer | Campuran, dua angka | LOG-45 |
| Toko bilang "sudah transfer" tanpa bukti | Deposit; finance memastikan | LOG-44 |
| Toko bayar lebih | Titipan toko, dicatat di kasir | LOG-49 |
| Ganti cara bayar ke transfer tanpa bukti | Ditolak server | LOG-44 |
| Uang dari driver beda dengan laporannya | Tidak Cocok, angka benar, tercatat | LOG-62, 63 |
| Finance salah memeriksa | Batal dengan alasan, riwayat tersimpan | LOG-63 |
| Salah setelah tercatat di kasir | Koreksi oleh finance atau pemilik, masuk kiriman ke kasir | LOG-14 |
| Transfer belum dicek berhari-hari | Ditandai setelah 3 hari, tampil di Dashboard | LOG-62, 80 |
| Barang rusak, toko minta potong | Potong nota, disetujui finance atau pemilik | LOG-51, 52 |
| Toko mengembalikan barang yang sudah dibayar | Retur dengan jumlah, nilai disahkan, mengurangi tagihan | LOG-59, 60 |
| Barang retur yang diterima cabang kurang atau beda | "Barang tidak sesuai", ditinjau Kepala Gudang | LOG-61 |
| Cabang tidak pernah mengonfirmasi barang kembali | Tampil di Dashboard setelah 3 hari | LOG-80 |
| Retur salah ditandai | Dibatalkan dengan alasan | LOG-58 |
| Pengantar di nota kasir belum terdaftar sebagai karyawan HRIS | Bonus ditahan di daftar "belum dipasangkan" sampai dipasangkan | LOG-76, PRI-39 |
| Antar barang dengan foto perjalanan tidak lengkap | Bonus ongkir tercatat bertanda ⚠, bisa dibatalkan beralasan | LOG-76 |
| Nota berongkir dibatalkan di kasir setelah bonusnya terkunci | Masuk daftar periksa, tidak berubah diam-diam | LOG-76, PRI-39 |
| HR atau finance mengurus bensin | Finance bisa, lewat server; HR tidak punya menu | LOG-83, 84 |

## 6. Masih terbuka

Tidak menghambat bab berikutnya, tetapi harus diputuskan sebelum spec modul ini
ditulis (Tahap 4).

1. ~~Hari tidak bisa jalan~~: **diputuskan 12 Oktober 2026** di Bab 5. Cukup lapor
   ke Kepala Gudang, tidak dicatat di sistem; LOG-87 dicabut.
2. ~~Nominal tarif ritase dan upah belanja, minggu upah~~: **diputuskan 12 Oktober 2026** di bagian 5A Bab 5 (tarif yang berjalan dibawa dan diberi tanggal berlaku; minggu Jumat–Kamis, dibayar Sabtu). Nomor aturannya DRV-08 s.d. 13 dan DRV-19.
3. **Posisi driver di peta**: fitur tambahan setelah v3 jadi
   (`../work/backlog/2026-10-12-posisi-driver-di-peta.md`).
4. **Kapan tarik data kasir dinyalakan** untuk toko, surat jalan, nota cabang,
   serta ongkir dan pengantar (LOG-01, 08, 38, 42).
5. ~~Jabatan GM dalam urusan gaji~~: **diputuskan 12 Oktober 2026**, GM setara
   pemilik di semua modul, termasuk melihat semua gaji dan membayar gajinya
   sendiri; tidak diabsen, gaji tidak terlihat HR, tanpa bonus (KAR-67).

## 7. Titipan dan catatan

Untuk Bab 1 (Karyawan):

1. Jabatan **GM** (hak setara pemilik, bukan pemilik usaha) dan **Marketing**
   masuk daftar jabatan dan daftar hak akses (KAR-58).

Untuk Bab 5 (Gaji Driver dan Kasbon):

2. Ritase dan upah belanja tercatat menurut LOG-33 s.d. 36, bertanggal tanggal
   berangkat. Yang diputuskan di sana: nominal tarif dan minggu upah.

Untuk Bab 6 (Keuangan):

3. Kas Masuk dari pengiriman (LOG-64), rekening untuk transfer dan deposit
   (LOG-62), pengeluaran bensin (LOG-83).
4. Titipan toko, retur, dan potong nota dicatat di kasir (LOG-65); HRIS tidak
   punya Buku Piutang.

   Butir 3–4 **terjawab** (12 Oktober 2026) di buku Keuangan: KEU-71 (uang
   dari driver), KEU-02 dan KEU-43 (tempat uang dan rekening), KEU-26
   (bensin), KEU-68 dan KEU-74 (tidak ada Buku Piutang toko; Piutang Lain).

Untuk modul Tarik Data Kasir:

5. Disiapkan sejak awal: kode kasir di toko, nomor surat jalan, nominal nota
   cabang, nomor nota grooming, dan tanda sumber. ~~Arah sebaliknya (HRIS
   mengirim ke kasir, LOG-65) dicatat sebagai kebutuhan baru di backlog itu.~~
   Ditiadakan 13 Oktober 2026 (PRI-39 butir 1). Nomor nota grooming kini
   ditarik dari kasir (LOG-89); ongkir dan pengantar juga (LOG-42, 76).

Untuk Tahap 3 dan 4:

6. Bagian 5 dijadikan daftar tes (PRI-06). Pembagian uang ke nota (LOG-46),
   potong nota (LOG-51), ritase dan upah belanja (LOG-33 s.d. 35), dan bonus
   (LOG-76) wajib dites (WAJ-06).
7. Mesin pengaman hak akses wajib mencoba LOG-84: Marketing tidak bisa
   memeriksa uang, HR tidak bisa membuka Logistik, driver tidak bisa mengubah
   baris trip.

Sistem lama (tidak disentuh, WAJ-09): jeda garasi 30 menit masih mati; 14
transfer belum diverifikasi; 3 retur belum dikonfirmasi diterima; lapor manual
grooming masih terbuka; 13 tanda bensin menyala. Sudah dilaporkan ke pemilik.

## 8. Istilah

Dimasukkan ke `00-kamus-istilah.md`: rute, surat jalan, nota, kunjungan, trip,
lapor garasi, upah belanja, laporan muat, paket cabang, antar sendiri, Kirim
Besok, Gagal, tertunda, potong nota, barang kejadian, retur, deposit, Campuran,
tempo, titipan toko, daftar tagih, titik toko, hari tidak bisa jalan, GM,
Marketing.
