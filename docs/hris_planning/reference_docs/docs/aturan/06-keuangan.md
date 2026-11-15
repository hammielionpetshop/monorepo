# Buku Aturan: Keuangan

Status: **ditetapkan 12 Oktober 2026** (perincian 4H-1 disetujui 14 Oktober 2026, bagian 3.19; perincian 4H-2 s.d. 4H-11 disetujui 14 Oktober 2026, bagian 3.20 s.d. 3.29), kecuali yang tercantum di bagian 6 ("Masih terbuka").

Nomor aturan tidak diurutkan ulang, supaya rujukan dari dokumen lain tetap benar.

File ini hanya berisi aturan yang berlaku di v3. Hasil galian sistem lama, hasil
cek database, semua pertanyaan, dan jawaban pemilik disimpan di
`arsip/06-keuangan-galian.md` (bagian 6A s.d. 6E). Nomor KEU-A s.d. KEU-E di
arsip itu adalah nomor galian sistem lama, bukan nomor aturan v3. Asal tiap
aturan di bawah tercatat di bagian 6E.3 arsip itu.

Siapa yang disebut di buku ini:

- **"Pemilik"** dalam urusan hak akses berarti jabatan Pemilik (Owner) dan
  **GM**, yang haknya setara (KAR-67).
- **"Pemilik uang"** atau **"Ibu"** berarti Owner yang memegang Brankas dan
  semua rekening. Beliau tidak terbiasa dengan istilah akuntansi; layar untuk
  beliau memakai bahasa sehari-hari (KEU-29).
- **"Pemegang"** sebuah tempat uang adalah orang yang tercatat memegangnya di
  pengaturan tempat uang (KEU-02).

Yang diatur di buku lain dan tidak diulang di sini: kapan uang pengiriman
diperiksa dan dibagi ke nota (LOG-44 s.d. 66), isi slip dan siapa boleh
membayarnya (GAJ-37 s.d. 56, DRV-19 s.d. 28), bongkaran (DRV-31 s.d. 53),
dan kasbon (DRV-54 s.d. 79). Buku ini mengatur **ke mana uangnya tercatat**.

## 1. Modul ini mengurus apa

Semua catatan uang perusahaan dan laporan yang dibaca darinya. Isinya:

- **Buku Kas**: satu buku untuk uang masuk, uang keluar, dan pindah dana, di
  semua tempat uang (rekening, Laci, Brankas, Kas Pegangan, Setoran di Finance)
- **Catatan Cepat**: cara pemilik uang mencatat sesingkat mungkin, yang lalu
  dilengkapi finance
- **Laporan Kasir** dan uang toko: laporan tutup shift, setoran, kekurangan
  dan kelebihan kas
- **Utang Supplier**: daftar supplier, sisa utang, pembayaran, retur, rebate
- **Buku toko dengan Gudang**: utang belanja dan deposit tiap toko di Gudang
- **Tagihan Rutin**, **Daftar Aset**, dan **Buku Ibu**
- **Cek Modal**: harta, kewajiban, dan penjelasan perubahannya
- **Keuangan Hari Ini** dan laporan: Posisi Kas, Perkiraan Kas, Kemampuan
  Belanja, Uang Habis ke Mana, Untung Rugi, Harta dan Utang, tutup bulan

Modul ini **tidak** mengetik omzet, harga pokok, nota belanja, stok, atau
piutang toko; semuanya milik sistem kasir dan hanya dibaca.

## 2. Data yang dimiliki modul ini

| Data | Isinya |
|---|---|
| Buku Kas | Tiap baris: arah (masuk, keluar, pindah dana), tempat uang, cabang yang dibebani, kejadian dan kategori, tanggal uang, tanggal catat, pencatat, sumber (diketik, atau modul dan kejadian yang melahirkannya), bukti, pemeriksaan, pembatalan, riwayat perubahan |
| Tempat uang | Rekening bank, Laci tiap cabang, Brankas, Kas Pegangan, Setoran di Finance; pemegangnya; saldo awal bertanggal |
| Daftar kejadian dan kategori | Kejadian berbahasa sehari-hari, kategori dan jenisnya, kelompok laporan, isian wajib; bertanggal berlaku |
| Catatan Cepat | Kotak-kotaknya, tanda "belum dilengkapi" dan "perlu ditanyakan", lampiran pesan |
| Hitung Kas | Tiap hitungan fisik: tempat uang, tanggal, penghitung, hasil hitung, selisih |
| Laporan Kasir | Per cabang per tanggal per shift: foto struk, Cash, non-tunai per metode, Piutang (pembanding), uang keluar dari laci, selisih, pemeriksaan; hak lapor dan hak lapor sementara; daftar metode non-tunai per cabang |
| Selisih kasir | Kekurangan dan kelebihan kas per laporan, keberatan, dan keputusannya |
| Daftar supplier | Nama, HP, rekening, jenis, tempo bawaan, nama lain, penggabungan |
| Utang supplier versi HRIS | Pasangan pembayaran dengan nota, retur yang diterima supplier, potongan dari supplier, utang awal, titipan di supplier |
| Buku toko dengan Gudang | Per toko: belanja, pembayaran, biaya yang ditalangi Gudang, deposit |
| Buku Piutang Lain | Orang, asal, jumlah, cicilan, penghapusan |
| Tagihan Rutin | Jenis, cara hitung, tarif bertanggal berlaku, tagihan per bulan, pembayarannya |
| Daftar Aset | Aset kantor (harga, umur pakai, kondisi, Cek Aset) dan aset milik Owner yang disewa kantor (tarif sewa, kontrak ke pihak luar) |
| Buku Ibu | Hak sewa, uang pribadi yang masuk, pengambilan, dan biaya aset Owner yang dibayar uang usaha |
| Cek Modal | Titik awal, tiap hasil cek yang disimpan, dan penjelasan per baris |
| Rencana Pengeluaran Besar, batas aman kas, tutup bulan | Isian GM dan Owner, pengaturan batas, dan tanda bulan tertutup |

Yang **bukan** milik modul ini:

| Data | Milik modul |
|---|---|
| Omzet, harga pokok, nota belanja ke supplier, stok dan nilainya, barang reject, purchase order, sisa utang supplier versi kasir | Sistem kasir, dibaca lewat Tarik Data Kasir |
| Piutang toko, titipan toko, pelunasan toko | Sistem kasir (LOG-65) |
| Pemeriksaan uang pengiriman dan pembagiannya ke nota | Logistik (LOG-62 s.d. 64) |
| Catatan bensin, kendaraan, trip | Logistik (LOG-83) |
| Slip bulanan dan slip mingguan, Buku Upah, Buku Bonus, Dana Disiplin, Dana Tidak Hadir, minus kas catat tangan | Gaji (GAJ-33 s.d. 35, GAJ-37; keputusan 3A) |
| Laporan Bongkaran, Kasbon | Gaji Driver, Bongkaran, Kasbon (Bab 5) |
| Jalur pengajuan keberatan selisih kasir (status, penyetuju, lampiran) | Perlengkapan Bersama (PRI-23); kekurangan kas dan keputusannya tetap milik buku ini dan dibaca slip langsung (keputusan 3A) |
| Cabang, jabatan, orang, daftar hak akses | Karyawan (KAR-58) |
| Shift, hari tutup, jadwal libur (termasuk libur finance) | Kehadiran (KEH-31, KEH-79) |

## 3. Aturan

### 3.1 Buku Kas dan tempat uang

| No | Aturan |
|---|---|
| KEU-01 | **Satu Buku Kas** untuk uang masuk, uang keluar, dan pindah dana. Tiap baris wajib punya tempat uang, cabang yang dibebani, kejadian (yang menentukan kategorinya, KEU-19), tanggal uang, pencatat, dan sumbernya: diketik, atau modul dan kejadian yang melahirkannya. Hanya ada satu cara menandai sumber. |
| KEU-02 | **Tempat uang** adalah daftar pengaturan, bukan tulisan di kode, dan tiap tempat mencatat pemegangnya. Isi awal, lima jenis: **rekening bank**; **Laci** tiap cabang (KEU-48); **Brankas**, milik cabang Gudang, muara semua uang tunai, dipegang Owner; **Kas Pegangan**, uang tunai kantor yang dititipkan kepada finance (KEU-03); dan **Setoran di Finance**, uang setoran toko yang sedang dipegang finance sebelum masuk Brankas atau bank. Setoran di Finance terpisah dari Kas Pegangan dan semestinya **kosong tiap akhir hari kerja finance**; kalau tidak kosong, ditandai. |
| KEU-03 | **Kas Pegangan menggantikan Petty Cash.** Hanya terisi lewat Pindah Dana dari Brankas, dan tidak punya jatah tetap. Tiap pengeluarannya adalah baris Buku Kas biasa: punya kejadian, cabang, bukti (KEU-11), dan diperiksa. Buku pribadi tanpa pemeriksaan tidak ada lagi. |
| KEU-04 | **Pindah Dana** antar tempat uang adalah jenis catatan tersendiri: satu langkah yang mengurangi tempat asal dan menambah tempat tujuan sekaligus. Bukan pemasukan, bukan pengeluaran, dan tidak memengaruhi laba. Termasuk di sini: setor bank, tarik tunai, isi Kas Pegangan, setoran toko, dan **tukar uang tunai dengan transfer** ("barter cash"). |
| KEU-05 | **Tempat uang sumber wajib ada di semua baris**, termasuk baris yang lahir otomatis; diisi pada langkah membayar. Membayar tanpa tempat uang gagal dengan pesan yang jelas, bukan diam-diam tidak tercatat. |
| KEU-06 | **Satu kejadian bayar, satu baris**, bertanggal hari uang dibayar. Tidak ada pasangan "biaya" dan "pembayaran" yang terpisah, dan baris tidak dihitung ulang di tempat. Uraiannya (misalnya isi sebuah slip) dibawa sebagai rincian baris. |
| KEU-07 | **Saldo tiap tempat uang dihitung server di satu tempat** (WAJ-04). Saldo awal bertanggal dan dihitung mulai tanggal itu; setelah ada transaksi tidak diubah. Koreksinya lewat baris **penyesuaian saldo** oleh pemilik, dengan alasan. |
| KEU-08 | **Saldo awal dari hitung fisik.** Dipilih satu "hari mulai". Malam itu, setelah semua toko tutup: uang di Brankas, Kas Pegangan, dan tiap Laci dihitung; saldo tiap rekening bank dibaca dari mutasi. Angka itu menjadi saldo awal; riwayat sebelum hari mulai tidak diperlukan untuk saldo. **Semua aliran hidup sejak hari mulai**; tidak ada sakelar "tanggal mulai" per fitur. |

### 3.2 Mencatat dan memeriksa

| No | Aturan |
|---|---|
| KEU-09 | **Mengisi** Buku Kas: finance dan pemilik. **Memeriksa** baris yang diketik: pemilik. **HR tidak punya menu Keuangan.** Baris yang lahir otomatis tidak diperiksa ulang di Keuangan, karena lahir dari langkah yang sudah diperiksa di modul asalnya (uang pengiriman, LOG-62; Laporan Kasir, KEU-49 dan KEU-52). |
| KEU-10 | **Mencatat dan memeriksa adalah langkah utuh di server**: status awal, urutan status, dan siapa boleh apa ditentukan server. Tidak ada perubahan status yang dikirim langsung dari layar, dan tidak ada isian yang lahir langsung "disetujui". |
| KEU-11 | **Foto bukti uang keluar adalah pengaturan per jenis kejadian: "wajib" atau "dianjurkan"**, bertanggal berlaku. **Isi awal: dianjurkan** untuk semuanya, karena tim dibiasakan dulu. Baris tanpa foto bertanda **"tanpa bukti"** dan jumlahnya dihitung di laporan bulanan, supaya GM tahu kapan tim siap dipindah ke "wajib". Begitu sebuah kejadian diatur "wajib": isian tanpa foto ditolak, kecuali pencatat memilih **"bukti tidak ada"** dengan alasan wajib, yang otomatis ditandai untuk GM dan dihitung di laporan bulanan. "Pribadi" dan Pindah Dana tunai tidak pernah diwajibkan berfoto. **Tidak ikut pengaturan ini dan tetap wajib sejak awal:** foto struk Laporan Kasir (KEU-41), foto bukti setor bank (KEU-50), foto bukti transfer toko (LOG-44), dan foto struk bensin (LOG-83). |
| KEU-12 | **Tanggal catat dari server.** Tanggal uang tidak boleh masa depan dan paling jauh **7 hari** ke belakang; lebih jauh hanya pemilik, dengan alasan. Kalau tanggal uangnya jatuh di bulan yang sudah ditutup: saldo tetap memakai tanggal sebenarnya, dan laporan memasukkannya ke bulan berjalan sebagai baris koreksi (KEU-112). |
| KEU-13 | **Batas memeriksa 3 hari.** Lewat itu baris ditandai untuk pemilik; tidak otomatis disetujui atau ditolak. |
| KEU-14 | **Satu halaman Pemeriksaan**: daftar yang menunggu, umur tiap baris, dan tanda lewat batas. Menyetujui banyak sekaligus memakai tombol tahan 3 detik (TAM-15) dan menampilkan jumlah rupiahnya. Menolak selalu wajib alasan. |
| KEU-15 | Yang ditolak kembali ke pengisinya di daftar **"Perlu Diperbaiki"**, yang tidak dibatasi periode. |
| KEU-16 | **Baris Buku Kas tidak dihapus, dan tidak diubah setelah diperiksa.** Sebelum diperiksa: dikoreksi pengisinya, dengan jejak. Setelah diperiksa: dibatalkan pemilik dengan alasan, lalu dicatat ulang; baris yang batal tetap terlihat. |
| KEU-17 | **Riwayat perubahan bisa dibuka di layar** dari tiap baris: siapa, kapan, sebelum dan sesudah, alasan. Perubahan oleh mesin mencatat modul pemicunya. |
| KEU-18 | **Satu uang keluar, satu baris: pencatat kedua memasangkan, bukan mencatat lagi.** Catatan Cepat berarti "uangnya sudah keluar". Finance **memasangkannya** ke urusan yang sudah ada di sistem: slip, kasbon, Laporan Bongkaran, Tagihan Rutin, nota supplier, Pindah Dana yang menunggu diterima, atau catatan bensin. Hasilnya tetap satu baris. Kalau urusan itu sudah ditandai dibayar orang lain, catatan kedua dibatalkan dengan alasan "dobel catat". Catatan "gaji" tanpa slip yang cocok **tidak boleh menjadi gaji**: pilihannya Pribadi, Bantuan (DRV-77), atau ditanyakan (KEU-32). Sistem memberi peringatan bila ada dua catatan dengan tempat uang, nominal, dan hari yang sama. |

### 3.3 Kejadian, kategori, dan yang bukan biaya

| No | Aturan |
|---|---|
| KEU-19 | **Mesin pos.** Pencatat memilih **kejadian** berbahasa sehari-hari dari daftar (misalnya "bensin atau solar", "bayar listrik"); sistem yang menentukan kategori, kelompok laporan, jenis arus kasnya, dan isian wajibnya (misalnya kendaraan yang mana). Kategori tidak dipilih bebas. Daftar kejadian dan petanya adalah pengaturan pemilik; isi awalnya di KEU-123. |
| KEU-20 | **Kategori** hanya ditambah atau diubah pemilik, dan kodenya dibuat mesin. Tiap kategori punya **jenis**: biaya, pembelian barang, pengambilan pemilik, atau piutang karyawan. Mengubah jenis bertanggal berlaku, sehingga laporan bulan lama tidak ikut berubah. Uang masuk juga berkategori. |
| KEU-21 | **"Pribadi"** (uang yang diambil pemilik untuk keperluan pribadi) hanya dicatat **pemilik**. Uang yang diambil Ibu dari Laci toko dicatat kasir sebagai "Diambil Owner" (KEU-53) dan tercatat sebagai **pindah ke Brankas**: uangnya masih uang usaha dan tertangkap Hitung Brankas mingguan. Uang itu baru menjadi "Pribadi", dan mengurangi Buku Ibu (KEU-82), kalau Ibu atau GM menandainya. Finance boleh mengetik "Pribadi" **atas nama** Ibu hanya dengan lampiran pesannya, dan catatan itu tetap diperiksa GM. **Kasir tidak pernah mencatat "Pribadi".** |
| KEU-22 | **Yang bukan biaya** (tidak mengurangi laba): Pindah Dana dan setoran antar tempat uang; pembayaran supplier; uang kasbon dan cicilannya; "Pribadi"; serta baris pembayaran slip, pembayaran Tagihan Rutin, pembelian aset, bayar di muka, dan kontrak ke pihak luar. Lima yang terakhir bukan biaya **di Buku Kas** karena biayanya sudah dihitung dari slip, tagihan, dan pembagian bulanannya (KEU-108), sehingga tidak terhitung dua kali. Jenis ini ditentukan daftar kejadian (KEU-19), bukan centang per kategori. Tidak ada "Realisasi Kasbon". |

### 3.4 Baris yang lahir dari modul lain

| No | Aturan |
|---|---|
| KEU-23 | **Baris otomatis hanya lahir dari modulnya**: slip, Laporan Bongkaran, kasbon, uang pengiriman, dan Laporan Kasir. Satu baris per kejadian, bertaut ke asalnya. Tidak bisa diketik, diubah, atau dibatalkan dari Keuangan; pembatalannya lewat modul asal. Server menolak kejadian itu kalau diketik tangan. Pembayaran supplier dicatat lewat menu Utang Supplier atau kotak "Supplier" (KEU-62), tidak lewat ketikan uang keluar biasa. |
| KEU-24 | **Gaji.** Pengeluaran gaji hanya lahir saat slip dibayar, bulanan maupun mingguan (GAJ-48, GAJ-56, DRV-26): satu baris per slip sebesar uang yang benar-benar dibayar, dengan uraian yang dikirim slip. **OB berslip** seperti karyawan lain; Kas Pegangan atau Brankas hanya menjadi sumber uangnya. **Cara bayar:** saat menekan "Bayar", pembayar memilih sumber uangnya (Brankas, Kas Pegangan, atau rekening); beberapa slip boleh dibayar sekaligus dari satu sumber, dan tiap slip tetap punya barisnya sendiri. Foto bukti transfer mengikuti pengaturan KEU-11 (isi awal dianjurkan); pembayaran tunai tidak memakai tanda terima kertas. Karyawan melihat "Dibayar tanggal … lewat tunai/transfer" di portal; yang merasa belum menerima mengajukan keberatan (GAJ-42). |
| KEU-25 | **Bongkaran, kasbon, dan bantuan.** Bongkaran: satu baris per Laporan Bongkaran saat dibayar, dan satu baris untuk tiap pembayaran susulan (DRV-47, DRV-49), dibebankan ke cabang di pengaturan (DRV-51). Kasbon diberikan: satu baris uang keluar yang bertaut ke kasbonnya; bukan biaya (DRV-63). Kasbon dilunasi tunai: uang masuk yang bertaut ke kasbonnya; bukan pendapatan (DRV-69). Cicilan kasbon lewat slip tidak menjadi baris tersendiri, karena sudah mengurangi uang slip yang dibayar. Utang kasbon yang dihapus: menjadi biaya di Untung Rugi tanpa ada uang yang bergerak (DRV-70). Bantuan yang tidak perlu dikembalikan: diketik sebagai kejadian "Bantuan untuk karyawan" dengan nama orangnya (DRV-77). |
| KEU-26 | **Bensin, dan uang yang dibawa dulu.** Bensin dicatat di Logistik (LOG-83) dan melahirkan **satu** baris uang keluar; kalau finance sudah mencatat uangnya keluar dari Kas Pegangan, keduanya dipasangkan (KEU-18), bukan dua baris. **Uang yang diberikan sebelum belanja:** (a) dicatat **saat uang diberikan**, sebesar yang diberikan, bertanda **"struk menyusul"** dan nama pembawanya; (b) saat struk dan kembalian datang, nominal baris yang sama dibetulkan menjadi sebesar struk dan fotonya dilampirkan; (c) lewat **3 hari kerja** belum ada struk: ditandai untuk GM. Uang semacam ini bekal yang dipertanggungjawabkan, bukan tambahan upah; upah driver hanya dari ritase dan upah belanja (DRV-09, DRV-11). |

### 3.5 Catatan Cepat

| No | Aturan |
|---|---|
| KEU-27 | **Catatan Cepat.** Pemilik uang mencatat sesingkat mungkin lewat layar kotak-kotak (KEU-28). Baris itu **langsung masuk hitungan saldo**, karena uangnya sudah bergerak, dan bertanda "belum dilengkapi". Finance juga boleh membuat Catatan Cepat **atas nama** pemilik uang dari pesan WhatsApp atau catatan kertasnya; tercatat siapa yang mengetik, dan tangkapan layar pesan atau foto kertas itu menjadi lampiran. |
| KEU-28 | **Layarnya kotak-kotak**, satu kotak satu jenis. Uang keluar: tiap kotak hanya meminta **angka dan keterangan**, lalu tombol "OK, catat". Uang masuk: **satu kotak**, berisi nominal dan asal uangnya, dengan pilihan "dari uang pribadi" (menambah Buku Ibu, KEU-82). Tidak ada pilihan bertingkat. Satu pilihan tambahan saja: tunai dari Brankas (bawaan) atau transfer; rekeningnya dipilih finance saat melengkapi. Isi awal kotak: **Supplier, Gaji/Upah, Kasbon, Operasional, Isi Kas Finance, Setor Bank, Pribadi, Lainnya, dan Uang Masuk**. Tiap kotak sudah terpaut ke posnya, sehingga jenisnya pasti walaupun keterangannya singkat. Kotak ditambah atau dikurangi lewat pengaturan. Kotak Uang Masuk hanya untuk uang yang belum punya laporan asalnya (KEU-35). |
| KEU-29 | **Layar pemilik uang memakai bahasa sehari-hari**, bukan istilah akuntansi: "Pribadi" (bukan prive), "Setor Bank" dan "Isi Kas Finance" (bukan pindah dana), "Uang Masuk". Istilah akuntansi hanya muncul di unduhan laporan dan di pengaturan. |
| KEU-30 | **Pengecualian TAM-15:** tombol "OK, catat" di Catatan Cepat **tidak ditahan 3 detik**, karena pemilik uang tidak boleh dibuat menunggu dan catatan itu masih bisa dikoreksi sebelum diperiksa. Gantinya nominal ditampilkan besar beserta tulisan terbilangnya. Tombol "Terima" setoran tetap ditahan 3 detik. |
| KEU-31 | **Melengkapi.** Finance melengkapi **baris yang sama** (kejadian, cabang, rekening, foto bukti, pasangannya) paling lambat **hari kerja berikutnya**; tidak ada pengetikan ulang ke buku lain. Layar finance selalu menampilkan jumlah dan total rupiah catatan yang belum dilengkapi, beserta umurnya. Lewat batas: ditandai untuk GM. |
| KEU-32 | **Finance tidak menebak.** Kalau catatannya tidak jelas (misalnya hanya nama orang), finance menandai "perlu ditanyakan"; baris itu muncul di daftar pemilik uang dan GM. Selama belum jelas, di laporan ia tampil di pos **"Belum dipilah"**, sehingga jumlah uang tetap benar dan besarnya yang belum jelas terlihat. |
| KEU-33 | **Setelah lengkap, diperiksa GM atau pemilik lain** (KEU-09, KEU-13). Pemilik uang tidak memeriksa catatannya sendiri. Nominal dan arah (masuk atau keluar) sebuah Catatan Cepat hanya dikoreksi pencatatnya atau lewat pembatalan (KEU-16); finance tidak mengubah nominal. |

### 3.6 Brankas, Kas Pegangan, dan Hitung Kas

| No | Aturan |
|---|---|
| KEU-34 | **Uang keluar dari Brankas dicatat penerimanya** sebagai Pindah Dana (misalnya finance mencatat "Isi Kas Pegangan"). Pemegang Brankas tidak wajib mengonfirmasi dan bisa melihatnya kapan saja. Kalau pemegang Brankas sudah mencatatnya sendiri lewat kotak "Isi Kas Finance" atau "Setor Bank", penerima memasangkannya (KEU-18). |
| KEU-35 | **Uang yang sudah dilaporkan tidak ditulis ulang.** Uang yang datang ke Brankas dan diperiksa pemegangnya sendiri (misalnya uang dari driver) tampil di layarnya sebagai daftar **"menunggu diterima"**; ia cukup menekan **"Terima"**, atau "Tidak cocok" dengan angka yang benar. Untuk setoran toko, pemegang Brankas tidak perlu menekan apa pun, karena finance yang menerima dan menyetorkannya (KEU-49); ia boleh ikut memeriksa. |
| KEU-36 | **Hitung Kas untuk Kas Pegangan** dilakukan pemegangnya tiap akhir hari kerjanya. Pemegang mengetik hasil hitung **tanpa melihat angka sistem lebih dulu**; baru setelah itu sistem menampilkan saldo menurut catatan. Selisih tercatat sebagai baris tersendiri dan ditandai untuk pemilik. |
| KEU-37 | **Brankas dihitung fisik seminggu sekali**, boleh oleh GM atau finance di hadapan pemegangnya. Kalau terlewat hanya ditandai; tidak ada yang terkunci. |

### 3.7 Laporan Kasir

| No | Aturan |
|---|---|
| KEU-38 | **Satu jalan uang penjualan toko masuk Buku Kas: Laporan Kasir.** Tidak ada "Input Kasir Darurat" dan tidak ada uang penjualan yang diketik langsung ke Buku Kas. Omzet untuk hitungan laba tidak diambil dari sini, tetapi dari data kasir (KEU-72). |
| KEU-39 | **Siapa boleh melapor adalah pengaturan** per cabang dan jabatan, bukan nama jabatan atau nama cabang di kode (WAJ-05). Isi awal: karyawan toko untuk tokonya; **Marketing untuk Gudang**. |
| KEU-40 | **Jalan keluar kalau pelapor tidak ada** (sakit semua, keluar kerja): (a) pemilik atau finance memberi **hak lapor sementara** kepada karyawan lain di cabang itu, bertanggal mulai dan selesai, tercatat; (b) kalau tidak ada orangnya, **finance mengisi atas nama** cabang itu (tercatat siapa yang mengetik, foto struk tetap wajib) dan yang memeriksa orang lain; (c) toko yang memang tidak buka dicatat sebagai hari tutup (KEH-79), sehingga tidak ditandai "belum lapor". Pelapor yang berhenti sebelum laporannya diperiksa: laporan tetap diperiksa, dan kekurangannya masuk slip terakhirnya (GAJ-53). |
| KEU-41 | **Isi laporan tetap sederhana:** tanggal, shift, **foto struk (wajib)**, Cash, non-tunai per metode, Piutang, uang keluar dari laci, selisih, keterangan. Total dan uang yang harus disetor dihitung server di satu tempat (WAJ-04). |
| KEU-42 | **Shift mengikuti shift cabang** (buku Kehadiran) dan tidak dikunci dua. Satu laporan per cabang per tanggal per shift. Kelak dicocokkan dengan shift di sistem kasir. |
| KEU-43 | **Metode non-tunai dipilih dari daftar pengaturan per cabang**; tiap metode terpaut satu rekening. Kasir memilih, tidak mengetik. Daftarnya diatur pemilik. |
| KEU-44 | **Batas waktu.** Laporan dikirim pada hari shift itu; belum ada sampai toko buka esok harinya: ditandai untuk finance dan GM. Setoran dan non-tunai diperiksa paling lambat 3 hari; lewat itu ditandai, tidak otomatis disetujui. Tanggal laporan paling jauh 7 hari ke belakang; lebih dari itu hanya kantor, dengan alasan. |
| KEU-45 | **Laporan tidak dihapus.** Sebelum diperiksa: dikoreksi pelapor, dengan jejak. Setelah diperiksa: pemeriksaannya dibatalkan pemilik dengan alasan; baris Buku Kas dibatalkan, tidak dihapus (PRI-02). Yang sudah masuk slip tertutup dikoreksi lewat baris baru di slip berikutnya (GAJ-50). |
| KEU-46 | **Piutang di laporan hanya angka pembanding.** Uang pelunasan pelanggan yang ada di laci dicatat terpisah sebagai **"titipan pelunasan"** (bukan omzet, bukan kelebihan kas) dan diteruskan ke sistem kasir (LOG-65). **Cek Harian** dibawa: toko yang belum lapor, nota yang batal setelah lapor, dan Piutang dibanding nota kiriman. |
| KEU-47 | **Tarik data kasir disiapkan sejak awal.** Tahap awal angka diketik dari struk. Begitu sambungan menyala, angka settlement (termasuk cash yang dicatat kasir saat settle) terisi sendiri, dan kasir tinggal menghitung uang fisik. |

### 3.8 Uang toko: laci, setoran, selisih, dan finance libur

| No | Aturan |
|---|---|
| KEU-48 | **Begitu laporan terkirim, tunainya tercatat di Laci cabang itu.** Tidak ada satu "Kas Tunai" untuk semua. Setiap cabang yang menjual punya Laci dan rekening yang terdaftar. |
| KEU-49 | **Setoran tunai toko.** Kasir menyerahkan uang ke finance saat tutup shift. Finance menghitungnya, paling lambat pagi hari kerja berikutnya, lalu menekan **Terima** atau **Tidak cocok** dengan angka sebenarnya. Itu Pindah Dana dari Laci ke **Setoran di Finance**; tunai tidak diketik ulang. Pagi itu juga finance menyerahkannya ke pemegang Brankas, dan **finance yang mencatat "setor ke Brankas"**. Pencatatan boleh menyusul sampai akhir hari itu; lewat itu ditandai. Selisih di Brankas tertangkap Hitung Brankas mingguan (KEU-37). |
| KEU-50 | **Setoran ke bank** (Raja, Markas, atau toko mana pun yang menyetor sendiri): Pindah Dana dari Laci ke rekening cabang itu, dengan **foto bukti setor (wajib)**, lalu dicocokkan finance dengan mutasi. Kalau uangnya diantar ke kantor, finance yang menyetorkannya ke rekening cabang itu dan mencatatnya. |
| KEU-51 | **Serah terima dan uang tiap shift.** Uang tiap shift dimasukkan **amplop bertanda** tanggal, shift, dan nama penutup sebelum disimpan, supaya tidak bercampur. Kalau finance menerima uang yang sudah bercampur, selisihnya **tidak dibebankan ke siapa pun** dan ditandai untuk GM. Serah terima kepada pembawa uang tidak wajib dicatat; kalau dicatat ("saya terima Rp… dari …"), kekurangan di perjalanan menjadi tanggungan pembawa; kalau tidak dicatat, tetap pada penutup shift. |
| KEU-52 | **Non-tunai diperiksa finance per baris** terhadap mutasi: Cocok, atau Tidak cocok dengan angka di mutasi. Selisih non-tunai **tidak otomatis menjadi beban kasir**; ditandai "perlu ditelusuri" untuk GM. Tolak tetap ada untuk laporan yang salah isi. Begitu tarik data kasir menyala, QRIS dicocokkan per transaksi. |
| KEU-53 | **Uang keluar dari laci** dicatat kasir dengan memilih satu dari tiga jenis: **Belanja toko** (keterangan, nominal, foto struk; menjadi uang keluar cabang itu, kejadiannya dipilih finance; di atas batas ditandai untuk GM, isi awal batas Rp200.000); **Diambil Owner** (nominal saja; tercatat sebagai pindah ke Brankas, KEU-21); **Bayar supplier** (nama supplier, nominal, foto nota; diteruskan ke Utang Supplier, KEU-62). Tidak ada lagi "pengeluaran" yang hanya mengurangi uang masuk. |
| KEU-54 | **Selisih** = kekurangan kas (minus kas) atau kelebihan kas: satu baris per laporan, atas nama penutup shift, masuk periode 26–25 menurut tanggal laporan (GAJ-20, GAJ-38). Tidak ada toleransi. Kelebihan hanya menutup kekurangan orang itu di periode yang sama; kelebihan yang tersisa tercatat sebagai uang masuk "kelebihan kas". Tidak ada baris yang ditimpa. |
| KEU-55 | **Satu kasir, satu tanggung jawab.** Kekurangan kas sebuah shift ditanggung penuh orang yang menutup shift itu; **tidak dibagi rata dan tidak dipindahkan** ke orang lain. Ia boleh mengajukan keberatan paling lambat 3 hari; pemilik memutuskan **tetap** atau **ditiadakan**, wajib alasan dan tercatat. Tanpa keputusan, kekurangan tetap. Jenis: **pelapis** GAJ-20; pembagian rata di GAJ-20 hanya tersisa untuk catat tangan tanpa nama di luar Laporan Kasir. |
| KEU-56 | **Finance juga libur.** Tidak ada aturan Keuangan yang menganggap finance masuk setiap hari. (a) Semua batas waktu yang dikerjakan finance (menerima setoran, mencatat setor ke Brankas, memeriksa non-tunai, melengkapi Catatan Cepat, Hitung Kas Pegangan, struk menyusul) dihitung menurut **hari kerja finance** dari jadwal libur di Kehadiran; yang tertunda karena libur tidak ditandai terlambat. (b) **Bawaan: uang diam di Laci toko** dan tetap tercatat di sana sampai finance masuk; Laporan Kasir tetap dikirim seperti biasa. Tidak ada pengganti yang wajib. (c) **Pemegang Brankas boleh menerima sendiri kalau mau:** setoran yang menunggu tampil di layarnya dan ia cukup menekan "Terima". Kalau ia hanya mencatat di kertas, finance memasukkannya saat masuk kembali **atas nama** pemegang Brankas, dengan tanggal uang yang sebenarnya dan foto kertas itu sebagai lampiran (KEU-27). (d) **Pencatatan menyusul:** apa pun yang terjadi saat finance libur dicatat finance pada hari ia masuk, bertanggal uang sebenarnya. Pembayaran supplier oleh Owner tetap berjalan dan dicatat lewat Catatan Cepat. Uang kasbon menunggu finance atau pemilik (DRV-63). (e) Pengganti finance sementara yang ditunjuk pemilik tetap **tersedia sebagai pilihan**, bertanggal dan tercatat, tidak wajib dipakai. |

### 3.9 Supplier dan utang supplier

| No | Aturan |
|---|---|
| KEU-57 | **Satu daftar supplier, milik Keuangan**, dipakai pembayaran supplier dan Laporan Bongkaran (DRV-41). Isi: nama, HP, rekening, jenis, dan tempo bawaan (pilihan). Ditambah finance dan pemilik; Kepala Gudang boleh menambah supplier baru bertanda "belum diperiksa" supaya bongkaran tidak tertahan. **Cabang sendiri bukan supplier** (KEU-69). **Penjaga nama asal jadi:** (a) saat menambah, sistem menampilkan nama yang mirip dan meminta memilih yang sudah ada atau menegaskan "memang baru"; nama yang persis sama ditolak; (b) tiap supplier punya daftar **nama lain** (misalnya singkatan di catatan Ibu dan nama di kasir), sehingga nama dari kasir dan dari Catatan Cepat dipasangkan ke supplier yang sama; nama yang belum dikenal masuk daftar "belum dipasangkan" untuk finance; (c) dua supplier yang ternyata sama **digabung** oleh finance atau GM: riwayat keduanya menyatu, nama lama menjadi nama lain, dan penggabungannya tercatat. |
| KEU-58 | **Nota belanja ke supplier milik sistem kasir.** HRIS membacanya lewat Tarik Data Kasir (tahap awal file yang diunggah, lalu sambungan) dan selalu diperbarui; **HRIS tidak mengetik nota belanja**. Tiap tarikan tercatat kapan dan oleh siapa. Nota yang berubah atau hilang di antara dua tarikan ditandai dengan nilai sebelum dan sesudahnya; tidak pernah berubah diam-diam. Koreksi nota dilakukan di kasir. |
| KEU-59 | **Nomor nota dan foto nota tidak diwajibkan**; boleh diisi kalau ada. Gantinya, nota dengan supplier, tanggal, dan total yang sama ditandai **"mungkin kembar"** untuk finance. Bukti saat uangnya keluar mengikuti KEU-11 dan KEU-27. |
| KEU-60 | **Sisa utang supplier versi HRIS dihitung server di satu tempat**: nota (dari kasir) dikurangi pembayaran (Buku Kas), retur yang diterima supplier, dan potongan yang memotong nota. Umur utang ikut dihitung; layar hanya menampilkan. **Saling periksa dengan kasir:** kasir memegang catatan utangnya sendiri; HRIS menarik sisa utang versi kasir dan menampilkannya **berdampingan** per supplier. Yang berbeda ditandai "perlu ditelusuri" untuk finance dan GM; tidak ada angka yang otomatis menimpa angka lain. **Siapa mencatat apa:** pembayaran utang di sistem kasir dicatat **Owner** (keadaan sekarang, dipertahankan); di HRIS dicatat finance, atau Owner lewat kotak "Supplier" kalau beliau mau. Supaya Owner tidak mengetik dua kali, HRIS menarik pembayaran yang tercatat di kasir dan menampilkannya kepada finance sebagai daftar **"dibayar menurut kasir, belum ada di Buku Kas"**. Finance mencatatnya di Buku Kas dengan sumber uang yang sebenarnya dan buktinya, tidak sekadar menyalin: transfer dicocokkan dengan mutasi, tunai tertangkap Hitung Brankas. Pembayaran di Buku Kas yang tidak ada di kasir juga ditandai. |
| KEU-61 | **Satu kali bayar = satu baris Buku Kas**, dengan rincian nota yang ditutupnya (nota tertua lebih dulu, bisa diubah) dan cabang yang mengikuti notanya. **Bayar sebagian adalah hal biasa.** |
| KEU-62 | **Semua jalan bayar bermuara ke buku utang yang sama:** kotak "Supplier" di Catatan Cepat, "Bayar supplier" dari laci toko (KEU-53), dan catatan finance; dari Brankas maupun rekening. Finance memasangkannya ke supplier dan nota. Uang yang belum dipasangkan (termasuk karena notanya belum masuk dari kasir) tampil sebagai **"belum dipasangkan"** dengan umurnya, dan tetap mengurangi saldo kas. |
| KEU-63 | **Yang memutuskan membayar adalah Owner.** Tidak ada jatuh tempo wajib dan tidak ada persetujuan sebelum membayar. Sistem hanya membantu: daftar utang per supplier dengan umur tiap nota, untuk pemilik. Tempo bawaan per supplier boleh diisi; kalau diisi, dipakai Perkiraan Kas (KEU-101). |
| KEU-64 | **Uang muka tidak dipakai.** Bayar lebih yang tidak sengaja tidak ditolak: menjadi titipan di supplier itu dan dipakai nota berikutnya. |
| KEU-65 | **Barang yang dikembalikan atau rusak punya dua akhir:** (a) **diterima supplier**: dicatat dengan nilainya dan mengurangi utang supplier itu setelah disahkan; (b) **barang reject**: kerugian perusahaan. Jumlah dan nilainya dicatat di kasir (stok); HRIS membaca nilainya supaya tampil di laporan sebagai kerugian barang, tidak hilang diam-diam. |
| KEU-66 | **Cashback dan rebate dari supplier atau pabrik dicatat**, tidak menguap. Nota tetap senilai nota. Rebate dicatat finance sebagai **"potongan dari supplier"** dengan salah satu bentuk: **uang** (uang masuk berkategori rebate), **potong nota** (mengurangi utang), atau **barang** (masuk stok di kasir). Tampil sebagai pos tersendiri di laporan. |
| KEU-67 | **Utang awal** tiap supplier diisi pada hari mulai (KEU-08) dari tagihan supplier. Pembayaran lama tidak dipasangkan mundur. |
| KEU-68 | **Satu menu Utang Supplier**, satu alamat. Tidak ada halaman ketik HPP dan tidak ada Buku Piutang toko di HRIS. Tidak ada yang memeriksa pembayaran supplier yang ia isi sendiri (KEU-120); pembayaran yang sudah diperiksa hanya dibatalkan dengan alasan (KEU-16). |

### 3.10 Toko dan Gudang

| No | Aturan |
|---|---|
| KEU-69 | **Toko belanja ke Gudang adalah penjualan Gudang**, bermargin, diperlakukan seperti penjualan ke toko luar: notanya satu, di kasir (LOG-65), dan tidak dicatat sebagai "pembelian supplier" di HRIS. "Gudang" dan "Hammielion" di catatan lama adalah pemasok yang sama. Tiap toko punya **buku dengan Gudang**, dihitung server: **belanja menambah utang** toko. Yang dihitung **pembayaran** hanya uang yang **benar-benar pindah** ke tempat uang Gudang (Brankas atau rekening Gudang), atau dipakai membayar supplier Gudang (KEU-70). Uang yang masih di rekening toko itu sendiri tetap milik toko dan belum dihitung. **Biaya toko yang dibayar dari uang Gudang** (misalnya gaji karyawan toko, sewa, atau listrik yang dibayar dari Brankas) otomatis **menambah utang toko**, atau mengurangi depositnya, menurut cabang yang dibebani di baris Buku Kas. Kelebihan bayar menjadi **deposit toko di Gudang** dan dipakai belanja berikutnya. Jenis: **pelapis** KEU-49 dan KEU-50: setoran tetap Pindah Dana secara uang, dan yang sampai ke tempat uang Gudang sekaligus tercatat di buku ini. Pembayaran itu ikut daftar kiriman ke kasir (LOG-65). |
| KEU-70 | **Uang cabang yang dipakai membayar supplier Gudang** (dari rekening cabang atau dari lacinya): satu baris Buku Kas keluar dari tempat uang cabang itu, dipasangkan ke nota supplier (KEU-62), dan **otomatis tercatat sebagai pembayaran cabang itu kepada Gudang** (KEU-69). Satu kejadian, satu kali dicatat. Contoh: rekening Raja dipakai membayar supplier Gudang Rp100 juta, sedangkan utang Raja ke Gudang Rp60 juta; maka utangnya lunas dan Rp40 juta menjadi deposit Raja di Gudang. |
| KEU-71 | **Uang dari driver seluruhnya milik Gudang:** uang fisiknya masuk Brankas kalau diterima pemegangnya (KEU-35), atau Setoran di Finance kalau diterima finance. **Omzetnya** tetap dicatat untuk cabang pemilik nota (LOG-13, LOG-64), supaya laba per cabang benar; bagian nota cabang tercatat di buku toko dengan Gudang sebagai uang cabang itu yang dipegang Gudang. |

### 3.11 Omzet, harga pokok, dan Piutang Lain

| No | Aturan |
|---|---|
| KEU-72 | **Omzet dan harga pokok tidak diketik**; masuk dari kasir per cabang per hari. Laba dihitung dari omzet dan harga pokok sumber yang sama; uang yang diterima ditampilkan terpisah. Angka omzet di Laporan Kasir menjadi **pembanding**; kalau berbeda dengan data kasir, ditandai. Bulan yang datanya belum masuk ditandai "belum lengkap" (KEU-111). Harga pokok toko untuk barang dari Gudang = harga belinya dari Gudang. |
| KEU-73 | **Laba gabungan perusahaan tidak menghitung dua kali** penjualan Gudang ke cabang sendiri: laba per cabang memakai harga jual-beli antar cabang; laba gabungan menghapus bagian antar cabang. Utang dan deposit antara toko dan Gudang juga saling menghapus di angka gabungan. |
| KEU-74 | **Buku Piutang Lain** (bukan piutang toko): orang, asal, jumlah, dan cicilannya (uang masuk). Sisa kasbon dari slip terakhir orang yang berhenti lahir di sini otomatis (GAJ-53, DRV-73). Dihapuskan hanya oleh pemilik dengan alasan, dan tercatat sebagai biaya. |

### 3.12 Tagihan Rutin

| No | Aturan |
|---|---|
| KEU-75 | **Tagihan Rutin**: mesin membuat **tagihan** (belum dibayar), bukan catatan uang keluar. Uang tercatat keluar hanya saat benar-benar dibayar (lewat Catatan Cepat atau finance) dan dipasangkan ke tagihannya; bayar sebagian boleh. Tagihan yang belum dibayar tampil dengan umurnya. Biaya cabang dihitung dari tagihannya (bulan yang dicakup), bukan dari tanggal bayar. |
| KEU-76 | **Satu mesin** untuk semua tagihan rutin, dengan empat cara hitung: tetap per bulan; per hari kalender; per hari kendaraan berangkat (dari trip Logistik, dihitung server); dan **nominal menyusul** (listrik, internet, pajak: mesin hanya mengingatkan, nominal diisi saat tagihannya datang). Isi awal jenis: sewa, listrik, internet, pajak, cicilan; ditambah lewat pengaturan. **Cicilan aset milik Owner** (saat ini: cicilan mobil box) adalah **tanggungan Ibu**, bukan biaya usaha: mesin hanya mengingatkan jatuh temponya, tagihannya bertanda "tanggungan Ibu" dan **tidak menjadi biaya cabang**; kalau dibayar dengan uang usaha, mengurangi Buku Ibu (KEU-82). |
| KEU-77 | **Tarif bertanggal berlaku dan tidak ditimpa** (WAJ-07). Tarif baru adalah baris baru, dan riwayatnya terlihat. Semua tarif, termasuk tarif kendaraan, punya layar (PRI-32). |
| KEU-78 | **Bulan yang terlewat dikejar**: mesin memeriksa semua bulan sejak tanggal mulai, dan hasilnya tidak dobel walaupun mesin jalan dua kali. Kegagalan mesin tampil di daftar "perlu perhatian" GM (PRI-33). |
| KEU-79 | **Bayar di muka** (kontrak setahun dan sejenisnya): satu kali uang keluar, dibagi rata oleh mesin ke bulan-bulan yang dicakup. |

### 3.13 Aset dan Buku Ibu

| No | Aturan |
|---|---|
| KEU-80 | **Daftar Aset** memuat dua jenis: **aset kantor** dan **aset milik Owner yang disewa kantor**. Aset Owner punya tanda **milik sendiri** atau **dikontrak dari luar**; yang dikontrak punya kontrak (pemilik tempat, mulai, berakhir, nilai). Isi awal: Gudang, Raja, Markas, dan Toko Depan dikontrak dari luar; Toko Pusat, parkir, dua motor, dan tiga mobil milik Owner. Kendaraan di daftar ini adalah kendaraan yang sama dengan di Logistik (satu data, WAJ-03). |
| KEU-81 | **Dua angka per aset Owner**: yang dibayar kantor (tarif sewa) dan biaya aset itu (kontrak ke luar, service, pajak, cicilan). Selisihnya tampil per aset per tahun, hanya untuk pemilik. |
| KEU-82 | **"Logistik" bukan cabang.** Gantinya **Buku Ibu** (nama di layar; satu buku per pemilik usaha), dihitung server. **Bertambah:** hak sewa dari Tagihan Rutin aset Owner; uang pribadi yang dimasukkan ke usaha. **Berkurang:** "Pribadi" (KEU-21); service, pajak, cicilan, dan kontrak ke luar untuk aset Owner yang dibayar dengan uang usaha. Yang dibayar Ibu dengan uang pribadinya sendiri tidak dicatat di Buku Kas. **Boleh minus**: minus tampil sebagai "sudah dipakai melebihi hak" dan tidak menolak pengambilan. **Saldo awalnya nol** pada hari mulai; sisa catatan "Logistik" lama tidak dibawa. Gaji tetap Owner tetap lewat slip (GAJ-09), di luar buku ini. |
| KEU-83 | **Hak sewa adalah catatan hak, bukan uang pindah.** Mesin tidak pernah menulis uang masuk atau keluar rekening. Rekening penampung, kalau dipakai, adalah tempat uang biasa; memindahkan uang ke sana adalah Pindah Dana yang dicatat saat benar-benar dilakukan. |
| KEU-84 | **Kontrak ke pihak luar dibayar dari tempat uang mana pun**: satu baris Buku Kas, yang otomatis mengurangi Buku Ibu. Tidak dihitung lagi sebagai biaya cabang, karena biaya cabang adalah sewa bulanannya (KEU-75); dengan begitu sewa tidak terhitung dua kali. |
| KEU-85 | **Pengingat kontrak** 90, 60, dan 30 hari sebelum berakhir, untuk pemilik, dihitung server. Memuat nilai kontrak, hak sewa aset itu sejak kontrak terakhir, dan sisa Buku Ibu. |
| KEU-86 | **Aset kantor:** barang seharga **Rp1 juta ke atas** (batasnya pengaturan). Barisnya lahir saat pembeliannya dicatat di Buku Kas; biayanya dibagi rata per bulan selama **umur pakai** (umur bawaan per jenis adalah pengaturan, KEU-123). Kondisi: dipakai, rusak, dijual, hilang; menjual mencatat uang masuk yang bertaut. **Rusak, hilang, atau dijual sebelum umur pakainya habis:** sisa nilainya menjadi kerugian di bulan itu; kalau dijual, dikurangi uang hasil penjualannya. **Cek Aset setahun sekali** (jadwalnya pengaturan): sistem menampilkan daftar aset kantor per cabang; kepala cabang atau pemilik mencentang tiap barang: ada, rusak, atau tidak ketemu. Kepala cabang hanya melihat nama barang, **tanpa nilainya**. Yang "tidak ketemu" ditandai untuk pemilik, yang memutuskan: dipindah (catatan dibetulkan) atau hilang. Terlewat hanya memunculkan pengingat; tidak ada yang terkunci. |
| KEU-87 | **Tidak ada hapus** untuk aset, kontrak, tarif, tagihan, dan baris Buku Ibu: dinonaktifkan atau dibatalkan dengan alasan, dan jejaknya bisa dibuka di layar. |

### 3.14 Cek Modal

| No | Aturan |
|---|---|
| KEU-88 | **Cek Modal** jalan tiap **tutup bulan** (KEU-112), dihitung server di satu tempat. Menghitung **harta bersih** = harta (KEU-89) − kewajiban (KEU-90), membandingkannya dengan bulan sebelumnya, dan menjelaskan perubahannya (KEU-91, KEU-92). Sifatnya laporan dan tanda; tidak mengunci apa pun. Hanya untuk pemilik. |
| KEU-89 | **Harta dikelompokkan menurut seberapa cepat bisa menjadi uang**, tiap kelompok dirinci per cabang. (1) **Uang**: Brankas, Kas Pegangan, Setoran di Finance, tiap Laci, tiap rekening (saldo Buku Kas). (2) **Barang dagangan yang bisa dijual**: nilai stok dari sistem kasir, dihitung dengan **harga beli**. Ditampilkan terpisah dan tidak dijumlahkan sebagai "bisa dijual": **barang lama tidak laku** (tidak terjual lebih dari 90 hari; batasnya pengaturan; tetap harta, diberi tanda) dan **barang reject** (bukan harta; kerugian, KEU-65). (3) **Uang yang masih di orang lain**: piutang toko (dari kasir) dengan umurnya, yang lewat jatuh tempo ditandai; Piutang Lain; sisa kasbon karyawan; bayar di muka yang belum terpakai (KEU-79). (4) **Aset kantor**: sisa nilainya (KEU-86), ditandai "dipakai, bukan untuk dijual". **Aset milik Owner tidak dihitung** sebagai harta usaha. |
| KEU-90 | **Kewajiban**: utang supplier (KEU-60); titipan dan deposit toko luar; tagihan rutin yang belum dibayar (KEU-75); slip yang sudah ditutup tetapi belum dibayar; uang karyawan yang dipegang kantor (saldo Dana Disiplin; tabungan loyalitas kalau jenis itu kelak dinyalakan, GAJ-31); dan Buku Ibu kalau positif (hak Owner yang belum diambil). Buku Ibu yang minus tampil di sisi harta sebagai "dipakai Owner melebihi hak". Utang dan deposit antara toko dan Gudang saling menghapus di angka gabungan (KEU-73). |
| KEU-91 | **Tiap baris dijelaskan mesin dengan "jembatan"**: angka awal, apa saja yang menambah dan mengurangi menurut catatan, angka yang **seharusnya**, angka **nyata**, dan selisihnya. Uang: awal + masuk − keluar, dibanding Hitung Kas dan mutasi. Barang dagangan: awal + belanja (nota supplier) − harga pokok barang terjual − reject − retur ke supplier, dibanding nilai stok nyata dari kasir; selisihnya "barang berkurang tanpa catatan". Piutang toko: awal + jual tempo − pelunasan. Utang supplier: awal + nota − bayar − retur − potongan. |
| KEU-92 | **Perubahan harta bersih yang wajar** = laba bulan itu − pengurangan Buku Ibu + uang pribadi yang masuk. Selisihnya dengan perubahan nyata tampil sebagai **"modal bergeser tanpa penjelasan"**, dirinci per baris KEU-91 dan per cabang, dengan kalimat biasa (misalnya "stok Toko Pusat turun Rp12 juta lebih banyak daripada barang yang terjual"). Unsur yang datanya belum masuk dari kasir ditandai **"belum lengkap"** dan tidak dihitung sebagai pergeseran. |
| KEU-93 | **Mesin memberi tahu** pemilik lewat aplikasi (PRI-25): (a) tiap tutup bulan: harta bersih naik atau turun berapa, dan berapa hal yang tanpa penjelasan; (b) **segera**, tanpa menunggu tutup bulan, kalau unsur yang dihitung harian (uang) bergeser tanpa penjelasan di atas batas. Batasnya pengaturan, isi awal Rp1 juta. Tiap pemberitahuan bisa dibuka sampai ke baris asalnya. |
| KEU-94 | **Titik awal.** Cek Modal dimulai dari satu keadaan awal bertanggal (hari mulai, KEU-08): uang tiap tempat dari hitung fisik dan mutasi; nilai stok tiap cabang, piutang toko, dan utang supplier dari sistem kasir dan tagihan supplier (KEU-67). Selama sambungan kasir belum menyala, angka stok, piutang, dan utang **boleh diketik** pemilik dan bertanda "diketik". Titik awal tidak diubah setelah ada transaksi; koreksinya lewat baris penyesuaian beralasan (KEU-07). |
| KEU-95 | **Cek di tanggal pilihan.** Selain tiap tutup bulan, pemilik boleh menjalankan Cek Modal **kapan saja** dengan memilih tanggal awal dan tanggal akhir. Hasilnya memuat: harta bersih di kedua tanggal; **uang ke mana** (kelompoknya sama dengan KEU-107); perubahan tiap baris harta dan kewajiban; dan jumlah **tanpa catatan**. Tiap hasil cek **disimpan** beserta tanggal dan pembuatnya, supaya bisa dibandingkan dan tidak berubah diam-diam. |
| KEU-96 | **Batas kemampuan ditulis di layar.** "Tanpa catatan" hanya bisa dihitung untuk baris yang punya **angka nyata** pada tanggal itu: uang (Hitung Kas dan mutasi bank), barang (nilai stok dari kasir, yang baru benar-benar nyata setelah stok opname), piutang dan utang (kasir). Baris tanpa angka nyata ditandai "belum dihitung nyata sejak tanggal …" dan tidak dinyatakan aman. Mesin menyebut **berapa, di tempat uang atau cabang mana, dan di antara dua hitungan yang mana**; mesin tidak menebak pelaku atau sebabnya. Menjalankan cek di tanggal pilihan menawarkan Hitung Kas saat itu juga. Stok opname barang dagangan tetap urusan sistem kasir; HRIS hanya membaca hasilnya. |
| KEU-97 | **Nilai stok tidak diketik**; ditarik dari sistem kasir per cabang tiap akhir bulan (kecuali titik awal, KEU-94). "Modal cash" yang diketik tidak ada; gantinya saldo awal dari hitung fisik (KEU-08). |

### 3.15 Keuangan Hari Ini: posisi, perkiraan, batas aman, dan Kemampuan Belanja

| No | Aturan |
|---|---|
| KEU-98 | **Halaman depan "Keuangan Hari Ini"** untuk pemilik, empat kotak berurutan menurut kepentingannya: (1) Uang kita sekarang; (2) Cukup tidak 4 minggu ke depan; (3) Uang habis ke mana; (4) Untung rugi cabang. Ditambah kotak Buku Ibu dan selisih per aset, Kemampuan Belanja, dan daftar "perlu perhatian". Tiap kotak bisa dibuka sampai baris asalnya. Tidak ada Dashboard, Laporan Resmi, Detail, dan Cash Flow yang terpisah-pisah. |
| KEU-99 | **Posisi Kas**: saldo tiap tempat uang pada tanggal mana pun, dengan "terakhir dihitung nyata kapan" dan selisihnya. Saldo menghitung semua baris yang tercatat dan tidak dibatalkan; jumlah yang belum diperiksa dan yang belum dipilah tampil di sampingnya. Tidak ada "Saldo Proyeksi". |
| KEU-100 | **Uang yang bebas dipakai** = total uang − uang titipan: deposit dan titipan toko, saldo Dana Disiplin, hak Ibu yang belum diambil (Buku Ibu positif), dan tabungan loyalitas kalau kelak dinyalakan. |
| KEU-101 | **Perkiraan Kas 4 minggu**, per minggu, dihitung mesin; pemilik tidak wajib membuat rencana. Masuk: rata-rata uang masuk 4 minggu terakhir per hari, dan piutang toko yang jatuh tempo. Keluar: slip bulanan (tanggal 1), slip mingguan (Sabtu), Tagihan Rutin, kontrak yang jatuh tempo, Rencana Pengeluaran Besar (KEU-103), dan supplier (tempo bawaan kalau diisi; kalau tidak, rata-rata bayar 4 minggu terakhir). Selalu bertulisan "perkiraan"; perkiraan minggu lalu dibandingkan dengan kenyataannya. |
| KEU-102 | **Batas aman kas dua tingkat**, sebagai pengaturan: dihitung ulang mesin tiap bulan dari 3 bulan terakhir dan boleh diganti pemilik. **Merah**: uang bebas di bawah biaya wajib satu bulan (gaji, upah, sewa, tagihan, operasional; isi awal kira-kira Rp120 juta). **Kuning**: di bawah biaya wajib satu bulan ditambah bayar supplier satu minggu (isi awal kira-kira Rp600 juta). Minggu di Perkiraan Kas yang menembus batas ditandai, dan pemilik diberi tahu. |
| KEU-103 | **Rencana Pengeluaran Besar** (pilihan, tidak wajib): pemilik mengisi perkiraan nominal dan tanggalnya; ikut Perkiraan Kas; ditandai selesai saat uangnya benar-benar keluar, atau dibatalkan. Anggaran per pos tidak dibuat. Mesin memberi tanda kalau satu kelompok pengeluaran naik lebih dari **20%** (pengaturan) dibanding rata-rata 3 bulan. |
| KEU-104 | **Kemampuan Belanja**: "hari ini paling banyak bisa belanja tunai Rp…" = jumlah terbesar yang kalau dikeluarkan hari ini, saldo perkiraan tiap minggu selama 4 minggu tetap di atas batas kuning; tidak pernah di bawah nol. Dihitung server; tampil di halaman depan dan di layar bayar supplier, **hanya kalau yang membuka pemilik** (finance tidak melihatnya). Layar menulis batasnya: ini perkiraan, dan menilai uangnya cukup atau tidak, bukan barang apa yang layak dibeli. |
| KEU-105 | **Simulasi belanja**: pemilik mengetik rencana belanja; mesin menjawab aman atau tidak, saldo terendah berapa, dan di minggu ke berapa. Simulasi tidak mencatat apa pun. |
| KEU-106 | **Penjaga kebiasaan menguras saldo.** Sistem **tidak menolak** pembayaran supplier. (a) Di kotak "Supplier" Catatan Cepat dan di layar bayar supplier tampil satu baris sebelum menekan OK: "setelah ini uang tersisa Rp…; gaji tanggal … butuh Rp…"; baris ini hanya tampil kalau yang membuka pemilik. (b) Kalau pembayaran itu membuat uang bebas turun di bawah batas **merah**, muncul satu jendela dengan kalimat biasa dan dua tombol: "Tetap bayar" dan "Kurangi"; menekan "Tetap bayar" tercatat. (c) GM diberi tahu saat itu juga tiap batas kuning atau merah ditembus. (d) Laporan bulanan memuat berapa kali batas merah ditembus dan berapa hari uang berada di bawahnya. |

### 3.16 Laporan dan tutup bulan

| No | Aturan |
|---|---|
| KEU-107 | **Uang Habis ke Mana**: kelompok tetap yang sama dengan Cek Modal (supplier, gaji dan upah, sewa dan tagihan, operasional, diambil Owner, lain-lain, belum dipilah), per cabang, dibanding periode sebelumnya, bisa dibuka sampai baris. "Diambil Owner" tampil di sini, tidak di Untung Rugi. |
| KEU-108 | **Satu hitungan laba, di server** (WAJ-04): omzet (kasir) − harga pokok (kasir) = laba kotor; dikurangi biaya cabang (gaji dan upah dari slip dan bongkaran, Tagihan Rutin menurut bulan yang dicakup, operasional menurut tanggal uangnya, bagian bulanan aset dan bayar di muka, barang reject, kekurangan yang ditanggung kantor, utang kasbon dan Piutang Lain yang dihapus); ditambah rebate dan kelebihan kas. Uang yang diterima tampil terpisah, bukan sebagai penjualan. |
| KEU-109 | **Bulan laporan keuangan = bulan kalender** (tanggal 1 sampai akhir bulan), sama dengan sistem kasir. Gaji periode 26–25 dibebankan ke bulan tempat periodenya **berakhir**; upah mingguan ke bulan tempat minggunya berakhir. Periode gaji dan laporan Logistik tetap 26–25. |
| KEU-110 | **Rentang waktu**: hari ini, 7 hari, bulan ini, 3, 6, dan 12 bulan, serta tanggal pilihan. Pembanding: bulan sebelumnya dan bulan yang sama tahun lalu. |
| KEU-111 | **Data belum lengkap ditandai**: bulan yang omzet atau harga pokoknya belum masuk dari kasir, atau masih ada "belum dipilah" dan "belum diperiksa", tampil bertanda dengan jumlahnya; labanya tidak ditampilkan sebagai angka pasti. |
| KEU-112 | **Tutup bulan** oleh pemilik. Sistem menampilkan daftar yang belum beres; boleh tetap ditutup dengan tanda "ditutup dengan catatan". Angka bulan tertutup tidak berubah; koreksi masuk bulan berjalan sebagai baris koreksi yang menunjuk bulan asalnya. Cek Modal jalan saat tutup bulan (KEU-88). Bulan yang belum ditutup sampai **tanggal 10** bulan berikutnya muncul di daftar "perlu perhatian" GM. |
| KEU-113 | **Tiga laporan bernama sehari-hari**: "Uang", "Untung Rugi", dan "Harta dan Utang" (isinya Cek Modal, tidak dibuat dua kali). Versi beristilah akuntansi hanya sebagai unduhan. Laporan bulanan juga memuat jumlah baris "tanpa bukti" (KEU-11) dan catatan batas merah (KEU-106). |
| KEU-114 | **Cabang di laporan** memakai daftar cabang yang sama (WAJ-03); tidak ada "kelompok laporan" yang terpisah. **Back Office digabung ke Gudang**, dan tidak ada kolom "Kantor": biaya orang kantor (GM, finance, Marketing, HR) menjadi biaya Gudang, dan laba toko tidak dibebani biaya kantor. Gaji para pemilik dan GM tampil sebagai baris tersendiri, **"Gaji pemilik dan GM"**, di Untung Rugi Gudang, terpisah dari gaji karyawan (KAR-59). Penggabungan cabang untuk laporan adalah pengaturan cabang, bukan tulisan di kode. |
| KEU-115 | **Dana Disiplin** tampil sebagai pos tersendiri dengan saldo, masuk, dan keluarnya (GAJ-34), dan termasuk uang titipan (KEU-100). **Dana Tidak Hadir** tampil di Untung Rugi cabang sebagai catatan pembanding (potongan tidak hadir dibanding lembur dan kompensasi pengganti, GAJ-35); tidak mengubah laba. |
| KEU-116 | **Unduh dan cetak dibuat server** (Excel dan PDF), memuat tanggal dibuat dan pembuatnya. Unduhan omzet per cabang per bulan kalender dibawa, dengan omzet dari kasir. Laporan untuk akuntan, bank, dan pajak belum dirancang; ditambah saat ada permintaan nyata. Persiapan laporan pajak dicatat di backlog (bagian 6 butir 2). |
| KEU-117 | **Ringkasan pagi** untuk pemilik lewat aplikasi (PRI-25): kemarin masuk dan keluar berapa, saldo sekarang, Kemampuan Belanja hari ini, dan yang perlu perhatian. Bisa dimatikan tiap orang. |

### 3.17 Hak akses dan aturan umum

KEU-118. **Hak akses isi awal** (diatur di daftar hak akses per jabatan, KAR-58;
dijaga di server dan dicoba mesin pengaman; tidak ada nama jabatan di kode):

| Jabatan | Di modul ini |
|---|---|
| Pemilik dan **GM** (hak setara) | Semua. Khusus mereka: memeriksa baris Buku Kas yang diketik; membatalkan baris yang sudah diperiksa; penyesuaian saldo; tanggal uang lebih dari 7 hari ke belakang; mencatat atau menandai "Pribadi"; Catatan Cepat; memutuskan keberatan kekurangan kas; membatalkan pemeriksaan Laporan Kasir; menghapuskan Piutang Lain; tarif sewa aset Owner; semua pengaturan (tempat uang, kejadian, kategori, metode non-tunai, batas); tutup bulan; semua laporan, Posisi Kas, Perkiraan Kas, Kemampuan Belanja, simulasi, Cek Modal, Buku Ibu, dan selisih per aset |
| Finance | Mengisi Buku Kas dan Pindah Dana; melengkapi dan memasangkan Catatan Cepat, dan mencatat atas nama pemilik uang dengan lampiran; menerima setoran toko dan mencatat setor ke Brankas; memeriksa setoran dan non-tunai Laporan Kasir; memberi hak lapor sementara dan mengisi Laporan Kasir atas nama cabang; menu Utang Supplier (daftar supplier, memasangkan pembayaran, retur, potongan dari supplier, gabung supplier); Tagihan Rutin biasa; Piutang Lain; Hitung Kas Pegangan. Melihat daftar kerjanya dan saldo tempat uang yang ia pegang atau cocokkan saja. **Tidak melihat** laporan, sisa uang perusahaan, Kemampuan Belanja, Buku Ibu, dan selisih per aset |
| Marketing | Mengisi Laporan Kasir untuk Gudang (KEU-39) |
| Karyawan toko yang berhak lapor | Mengisi Laporan Kasir tokonya, mencatat uang keluar dari laci, mengajukan keberatan atas kekurangan kasnya |
| Kepala Gudang | Menambah supplier baru bertanda "belum diperiksa"; mencatat bensin (LOG-83) |
| Kepala cabang | Cek Aset cabangnya, tanpa melihat nilai. Tidak melihat laporan apa pun |
| HR | **Tidak punya menu Keuangan** |
| Karyawan lain | Tidak punya menu Keuangan; melihat status bayar slipnya di portal (KEU-24) |

| No | Aturan |
|---|---|
| KEU-119 | **Hak atas tarif dan tagihan.** Tarif dan Tagihan Rutin biasa diisi finance atau pemilik, dan diperiksa pemilik yang lain. **Tarif sewa aset milik Owner** diisi Owner atau GM dan **tidak butuh persetujuan**; pihak yang tidak mengisi diberi tahu, dan riwayatnya terlihat (PRI-32 butir 4). HR dan kepala cabang tidak melihat tarif. |
| KEU-120 | **Tidak ada yang memeriksa isiannya sendiri**: baris Buku Kas, Catatan Cepat, Laporan Kasir, pembayaran supplier, tarif. Tidak ada yang bisa mengubah baris yang sudah diperiksa. Semuanya dijaga server dari satu daftar hak dan dicoba mesin pengaman, bukan dijaga tombol. |
| KEU-121 | **Setiap angka punya layar, setiap mesin punya penjaga.** Semua batas, tarif, persen, daftar pilihan, dan jadwal di buku ini adalah pengaturan yang punya layar, tanggal berlaku, jejak, dan pemeriksa (PRI-32); tidak ada yang diisi langsung ke database. Semua mesin di buku ini (saldo, Tagihan Rutin, Perkiraan Kas, batas aman, Kemampuan Belanja, tanda kenaikan, Cek Modal, ringkasan pagi, penarik data kasir) tercatat tiap kali jalan, ditandai kalau gagal atau tidak jalan, dan tampil di layar Kesehatan Mesin (PRI-33). |
| KEU-122 | **Tidak ada catatan uang yang dihapus;** semuanya dibatalkan dengan alasan (PRI-02). Semua langkah yang menyangkut uang lewat pintu di server, dan tiap rumus (saldo, uang yang harus disetor, selisih kasir, sisa utang supplier, buku toko dengan Gudang, Buku Ibu, laba, harta bersih, Perkiraan Kas, Kemampuan Belanja) ada di satu tempat (WAJ-04). Semua aturan uang di buku ini masuk daftar tes wajib (WAJ-06). |

### 3.18 Pengaturan dan angka awalnya

KEU-123. Semua yang di bawah adalah pengaturan (PRI-32), disimpan di satu
tempat dan dibaca server; yang menyangkut uang bertanggal berlaku (WAJ-07).
Tidak ada yang ditulis di kode. Hanya pemilik yang mengubahnya.

| Pengaturan | Isi awal | Aturan |
|---|---|---|
| Tempat uang | Rekening bank, Laci tiap cabang, Brankas, Kas Pegangan, Setoran di Finance | KEU-02 |
| Tanggal uang boleh mundur | 7 hari | KEU-12 |
| Batas memeriksa baris Buku Kas | 3 hari | KEU-13 |
| Foto bukti uang keluar, per jenis kejadian | "dianjurkan" untuk semua | KEU-11 |
| Batas struk menyusul | 3 hari kerja | KEU-26 |
| Kotak Catatan Cepat | Supplier, Gaji/Upah, Kasbon, Operasional, Isi Kas Finance, Setor Bank, Pribadi, Lainnya, Uang Masuk | KEU-28 |
| Batas melengkapi Catatan Cepat | hari kerja berikutnya | KEU-31 |
| Hitung Kas Pegangan | tiap akhir hari kerja pemegangnya | KEU-36 |
| Hitung Brankas | seminggu sekali | KEU-37 |
| Pelapor Laporan Kasir | karyawan toko untuk tokonya; Marketing untuk Gudang | KEU-39 |
| Metode non-tunai per cabang dan rekeningnya | diisi pemilik saat menyiapkan tayang | KEU-43 |
| Batas laporan kasir masuk | sampai toko buka esok harinya | KEU-44 |
| Batas memeriksa setoran dan non-tunai | 3 hari | KEU-44 |
| Tanggal laporan kasir boleh mundur | 7 hari | KEU-44 |
| Batas mencatat "setor ke Brankas" | akhir hari itu | KEU-49 |
| Batas belanja toko dari laci yang ditandai | Rp200.000 | KEU-53 |
| Masa keberatan kekurangan kas | 3 hari | KEU-55 |
| Jenis Tagihan Rutin | sewa, listrik, internet, pajak, cicilan (cicilan aset Owner bertanda "tanggungan Ibu") | KEU-76 |
| Isi awal Daftar Aset milik Owner | dikontrak dari luar: Gudang, Raja, Markas, Toko Depan; milik Owner: Toko Pusat, parkir, dua motor, tiga mobil | KEU-80 |
| Saldo awal Buku Ibu | nol | KEU-82 |
| Pengingat kontrak | 90, 60, dan 30 hari | KEU-85 |
| Batas harga aset kantor | Rp1 juta | KEU-86 |
| Jadwal Cek Aset | setahun sekali | KEU-86 |
| Barang lama tidak laku | tidak terjual lebih dari 90 hari | KEU-89 |
| Batas pemberitahuan uang bergeser tanpa penjelasan | Rp1 juta | KEU-93 |
| Panjang Perkiraan Kas dan dasar rata-ratanya | 4 minggu ke depan; rata-rata 4 minggu terakhir | KEU-101 |
| Batas aman kas merah | kira-kira Rp120 juta; dihitung ulang mesin tiap bulan | KEU-102 |
| Batas aman kas kuning | kira-kira Rp600 juta; dihitung ulang mesin tiap bulan | KEU-102 |
| Tanda kenaikan pengeluaran | lebih dari 20% dibanding rata-rata 3 bulan | KEU-103 |
| Bulan laporan keuangan | bulan kalender | KEU-109 |
| Tanda bulan belum ditutup | tanggal 10 bulan berikutnya | KEU-112 |
| Cabang yang digabung di laporan | Back Office ke Gudang | KEU-114 |

**Isi awal daftar kejadian** (KEU-19). Dipilih finance saat mencatat atau
melengkapi; ditambah dan diubah hanya oleh pemilik.

| Kelompok di laporan | Kejadian | Isian wajib tambahan |
|---|---|---|
| Operasional | Konsumsi karyawan (masak, galon) | cabang |
| Operasional | Bensin atau solar | kendaraan |
| Operasional | Ongkos perjalanan (parkir, tol) | cabang |
| Operasional | Perlengkapan toko dan kebersihan | cabang |
| Operasional | Alat tulis dan cetak | cabang |
| Operasional | Kebutuhan hewan dan grooming | cabang |
| Operasional | Biaya bank | rekening |
| Operasional | Bantuan untuk karyawan (DRV-77) | nama orang |
| Operasional | Beli alat atau barang kantor (Rp1 juta ke atas menjadi aset, KEU-86) | cabang, nama barang |
| Sewa dan tagihan | Bayar listrik, internet, pajak, sewa | dipasangkan ke Tagihan Rutin |
| Supplier | Bayar supplier | dipasangkan ke supplier dan nota |
| Gaji dan upah | Bayar slip, bongkaran | dipasangkan ke slip atau Laporan Bongkaran |
| Bukan biaya | Kasbon diberikan | dipasangkan ke kasbon |
| Diambil Owner | Pribadi | hanya pemilik |
| Diambil Owner | Service, pajak, cicilan, atau kontrak aset milik Ibu (mengurangi Buku Ibu) | aset; cicilan dipasangkan ke Tagihan Rutin |
| Lain-lain | Pengeluaran lain | keterangan wajib; ditandai untuk GM |
| Pindah Dana | Isi Kas Pegangan, setor bank, tarik tunai, tukar tunai dengan transfer, setor ke Brankas | tempat asal dan tujuan |
| Uang masuk | Rebate atau cashback supplier | supplier |
| Uang masuk | Cicilan Piutang Lain | nama orang |
| Uang masuk | Jual aset | aset |
| Uang masuk | Uang pribadi Ibu masuk ke usaha (menambah Buku Ibu) | hanya pemilik |
| Uang masuk | Uang masuk lain | keterangan wajib; ditandai untuk GM |

Uang penjualan toko, uang pengiriman, kelebihan kas, dan pelunasan kasbon tidak
ada di daftar ini karena lahir otomatis dari modulnya (KEU-23).

**Isi awal umur pakai aset kantor** (KEU-86):

| Jenis | Umur |
|---|---|
| Elektronik (komputer, printer, handphone, CCTV) | 4 tahun |
| Mesin dan alat (timbangan, alat grooming, AC, kulkas) | 4 tahun |
| Perabot (rak, etalase, meja) | 8 tahun |
| Kendaraan milik kantor (kalau kelak ada) | 8 tahun |
| Perbaikan bangunan sewaan | sampai kontraknya berakhir |

**Tambahan pengaturan dari 4H-1** (disetujui 14 Oktober 2026): hari mulai (satu tanggal,
diisi saat menyiapkan tayang, KEU-127); hari libur finance tidak dihitung
dalam batas mundur 7 hari bila pencatatnya finance (KEU-130); panjang
alasan batal, tolak, dan penyesuaian 15 huruf.

### 3.19 Perincian Tahap 4H-1: tempat uang dan Buku Kas

Keputusan pemilik 14 Oktober 2026 (N1 s.d. N7, jawaban "ok" = sesuai saran). Ditulis
memakai saran Claude. Spec: `../work/specs/2026-10-14-keuangan-spec.md`
bagian 3.1.

| No | Aturan |
|---|---|
| KEU-124 | **Tempat uang** (jenis: perincian KEU-02). Lima **jenis** tetap di kode karena menentukan perilaku mesin; nama dan jumlah tempat uang adalah data. Tiap tempat punya cabang pemilik (Brankas, Kas Pegangan, dan Setoran di Finance milik Gudang; Laci dan rekening milik cabangnya). **Pemegang bertanggal**: tiap pergantian baris baru, tidak menimpa. Pemegang Laci tertulis "penutup shift" dan tanggung jawabnya mengikuti Laporan Kasir (KEU-55). |
| KEU-125 | **Yang dilihat finance** (N1; jenis: perincian KEU-118). Finance melihat saldo Laci, Kas Pegangan, Setoran di Finance, dan rekening. Ia **tidak** melihat saldo Brankas dan jumlah seluruh uang perusahaan. Baris Buku Kas yang menyangkut Brankas tetap terlihat, kecuali "Pribadi" yang bukan catatan atas nama buatannya. Dijaga server, bukan tombol. |
| KEU-126 | **Ganti pemegang dan nonaktif** (N6; jenis: **pelapis** KEU-02). Pergantian pemegang Brankas atau Kas Pegangan yang berisi wajib disertai hitungan serah terima di hadapan pemegang lama dan baru; selisih sebelum serah terima menjadi tanggung jawab pemegang lama. Kalau pemegang lama tidak bisa hadir, Pemilik atau GM menghitung bersama pemegang baru, bertanda. Tempat uang **hanya dinonaktifkan bila saldonya Rp0**; tidak pernah dihapus. |
| KEU-127 | **Saldo awal** (jenis: perincian KEU-07, 08). Hari mulai adalah satu tanggal pengaturan. Saldo awal diisi finance dengan foto hitungan atau mutasi, lalu **disahkan** Pemilik atau GM yang bukan pengisinya. Tempat uang yang dibuat sesudah hari mulai bersaldo awal bertanggal hari dibuatnya. Saldo awal terkunci begitu ada baris sesudah tanggalnya. |
| KEU-128 | **Satu fungsi saldo** (N2; jenis: perincian KEU-07, 99). Saldo (tempat, tanggal) = saldo awal yang disahkan + masuk + Pindah Dana masuk − keluar − Pindah Dana keluar ± penyesuaian, menurut **tanggal uang**, menghitung semua baris **kecuali Dibatalkan**. Saldo tidak disimpan; ringkasan harian hanya percepatan dan diperiksa tiap malam terhadap hitungan penuh. Catatan yang membuat saldo **minus tidak ditolak**; tempat dan barisnya ditandai untuk Pemilik dan GM sampai saldo kembali Rp0 atau lebih. |
| KEU-129 | **Kejadian, kategori, dan delapan jenis** (jenis: perincian KEU-19, 20, 22). Jenis kategori: keluar = biaya, pembelian barang, pengambilan pemilik, piutang karyawan, dibiayakan di tempat lain; masuk = penerimaan penjualan, pendapatan lain, bukan pendapatan. Hanya biaya dan pendapatan lain yang masuk Untung Rugi dari Buku Kas. Jenis baru hanya lewat pembangunan sistem. **Jenis kategori dan peta kejadian ke kategori bertanggal**, dibaca menurut tanggal uang baris, dan tidak boleh mulai di bulan yang sudah ditutup. Kejadian menyimpan siapa boleh mencatatnya: semua yang berhak, hanya pemilik, atau **hanya dari modul**. |
| KEU-130 | **Mencatat** (N4; jenis: perincian KEU-10, 11, 12; **pengecualian** KEU-12 untuk hari libur finance). Baris yang diketik lahir **Menunggu diperiksa**; status berikutnya ditentukan server. Batas mundur 7 hari **tidak menghitung hari libur finance** bila pencatatnya finance (sejalan KEU-56 huruf a). Sebelum menyimpan, server mencari catatan lain dengan tempat uang, nominal, dan tanggal uang yang sama dan menampilkan peringatan dobel (KEU-18); tidak menolak. Baris, foto, dan tanda tersimpan dalam satu langkah utuh. |
| KEU-131 | **Satu catatan, satu cabang** (N7; jenis: perincian KEU-01). Uang masuk dan keluar dibebankan ke satu cabang; tidak dibagi ke beberapa cabang. Biaya bersama dibebankan ke Gudang (sejalan KEU-114). Cabang bawaan diisi sistem menurut kejadian (dari isian tambahan atau tempat uang). **Pindah Dana** tidak memilih cabang: dibaca dari cabang pemilik kedua tempat uang. |
| KEU-132 | **Koreksi, batal, catat ulang** (N5; jenis: perincian KEU-16). Pengisi boleh **mengoreksi atau membatalkan** catatannya sendiri selama Menunggu diperiksa atau Ditolak (batal wajib alasan). Sesudah Diperiksa hanya Pemilik atau GM yang membatalkan, dengan alasan; tombol **Catat ulang** membuka isian terisi dan baris baru menyimpan "catat ulang dari nomor …". Koreksi tidak mengubah pencatat, sumber, dan atas nama. Baris dari modul tidak dikoreksi atau dibatalkan dari Keuangan (KEU-23). |
| KEU-133 | **Penyesuaian saldo dua sebab** (N3; jenis: perincian KEU-07). Pemilik atau GM mengisi saldo yang benar; sistem menulis selisihnya. Sebab **"saldo awal salah"** tidak masuk Untung Rugi (pembetulan titik awal Cek Modal, KEU-94). Sebab **"uang selisih tanpa catatan"** masuk Untung Rugi cabang pemilik tempat uang sebagai "uang kurang atau lebih tanpa catatan"; selisih Hitung Kas (KEU-36) memakai bentuk yang sama. Pemilik atau GM yang lain diberi tahu (KEU-120). |
| KEU-134 | **Bulan laporan sebuah baris** (jenis: perincian KEU-12, 112). Satu fungsi server: bulan tanggal uang bila belum ditutup; bila sudah ditutup, bulan pertama yang belum ditutup, dengan tanda "koreksi untuk bulan …". Saldo tetap memakai tanggal uang sebenarnya. Pembatalan baris yang bulannya sudah ditutup masuk bulan berjalan sebagai koreksi. |
| KEU-135 | **Jadikan Pribadi dan Pribadi atas nama** (jenis: perincian KEU-21). Pada baris "Diambil Owner" (Pindah Dana Laci → Brankas), Pemilik atau GM menekan **Jadikan Pribadi**, seluruh atau sebagian. Hasilnya satu baris baru uang keluar "Pribadi" dari Brankas yang bertaut ke baris asal; baris asal tidak berubah. Finance mencatat "Pribadi" hanya **atas nama** pemilik uang dengan lampiran pesannya, dan barisnya diperiksa Pemilik atau GM yang bukan pemilik uang itu. |

### 3.20 Perincian Tahap 4H-2: pemeriksaan dan pintu dari modul lain

Keputusan pemilik 14 Oktober 2026 (P1 s.d. P4, jawaban "ok" = sesuai saran). Ditulis
memakai saran Claude. Spec: `../work/specs/2026-10-14-keuangan-spec.md`
bagian 3.2.

| No | Aturan |
|---|---|
| KEU-136 | **Satu pintu "catat uang dari modul"** (jenis: perincian KEU-23). Satu-satunya jalan modul lain menulis Buku Kas. Kunci **modul + nomor asal + kejadian** untuk catatan yang tidak Dibatalkan: panggilan kedua mengembalikan catatan yang sama. Status lahirnya ditentukan **kejadian** (diperiksa di Keuangan atau Dari modul), bukan modul pemanggil. Pintu yang sama membatalkan (masuk bulan berjalan sebagai koreksi bila bulannya sudah ditutup) dan membetulkan nominal, tetapi membetulkan hanya untuk catatan yang belum Diperiksa. |
| KEU-137 | **Kejadian milik modul** (jenis: perincian KEU-23). Tiap kejadian "hanya dari modul" menyebut modulnya; modul lain dan jalan ketik ditolak dengan kalimat yang menunjuk tempat yang benar. Isi awal: Bayar gaji, Gaji pemilik dan GM (Gaji); Upah bongkaran, Pengembalian lebih bayar bongkaran, Kasbon diberikan, Pelunasan kasbon (Gaji Driver); Uang pengiriman, Titipan toko, kurang serah, lebih serah, Bensin atau solar dari catatan bensin (Logistik); kejadian Laporan Kasir dan Bayar supplier (Keuangan). Kejadian yang **wajib dipasangkan** (Tagihan Rutin, cicilan aset Ibu) baru bisa diperiksa setelah dipasangkan. |
| KEU-138 | **Catatan Tanpa Uang** (jenis: perincian KEU-25, 74, 86). Biaya yang tidak menggerakkan uang (utang kasbon dihapus, Piutang Lain dihapus, bagian bulanan aset dan bayar di muka, sisa nilai aset, barang reject) dicatat di buku tersendiri lewat pintu yang sama, tanpa tempat uang, tidak masuk saldo, dibaca laporan bersama Buku Kas, dan tidak diperiksa di Keuangan. |
| KEU-139 | **Kurang serah dan lebih serah** (jenis: perincian LOG-62 dan keputusan V3 Logistik). Uang kurang dari pembawa dicatat sebagai uang keluar berjenis biaya; uang lebih sebagai uang masuk berjenis pendapatan lain, di tempat uang penerima. Pemulihan lewat Potongan Lain terbaca di slip, bukan dengan mengubah catatan ini. |
| KEU-140 | **Struk menyusul** (jenis: perincian KEU-26). Dicatat saat uang diberikan dengan pembawa wajib; berstatus **Menunggu struk**, langsung mengurangi saldo, belum diperiksa. Saat struk datang, nominal catatan **yang sama** dibetulkan menjadi sebesar struk (kembalian kembali ke tempat asal, kekurangan dibayar dari tempat yang sama) dan catatan menjadi Menunggu diperiksa. Bensin dilengkapi lewat catatan bensin Logistik. |
| KEU-141 | **Struk yang tidak datang** (P3; jenis: perincian KEU-26). Batas **3 hari kerja finance** (hari libur finance tidak dihitung, KEU-56); lewat itu ditandai GM dan pembawa diingatkan. Struk yang tidak pernah datang diputuskan Pemilik atau GM: **Terima tanpa struk** (alasan wajib, bukti tidak ada) atau **Tagih ke pembawa** (bahan Potongan Lain untuk HR, GAJ-80). |
| KEU-142 | **Siapa memeriksa siapa** (P1; jenis: perincian KEU-09, 33, 120). Catatan finance dan bensin diperiksa Pemilik atau GM; catatan Ibu (atau atas nama Ibu) diperiksa GM atau pemilik lain; catatan **GM diperiksa Pemilik** lewat daftar pendek "Dicatat GM" di Beranda. Tidak ada yang memeriksa catatan yang ia buat, yang ia catat atas nama orang lain, atau yang dicatat atas namanya. |
| KEU-143 | **Batas memeriksa dan Perlu Diperbaiki** (P2; jenis: perincian KEU-13, 15). Batas 3 hari dihitung **hari kalender** sejak catatan dikirim atau dikoreksi; lewat itu ditandai, tidak pernah disetujui atau ditolak otomatis. Tolak wajib alasan; catatan masuk Perlu Diperbaiki pengisinya tanpa batas periode dan tetap dihitung di saldo; 3 hari tidak disentuh ditandai GM. |
| KEU-144 | **Setujui banyak hanya tanpa tanda** (P4; jenis: perincian KEU-14). Menyetujui banyak sekaligus hanya untuk catatan tanpa tanda (tanpa bukti, bukti tidak ada, tanggal mundur, mungkin dobel, saldo minus, ditandai untuk GM, atas nama Ibu), ditahan 3 detik dengan jumlah rupiah; catatan bertanda dibuka satu per satu. |

### 3.21 Perincian Tahap 4H-3: Catatan Cepat, Brankas, Hitung Kas

Keputusan pemilik 14 Oktober 2026 (Q1 s.d. Q5, jawaban "ok" = sesuai saran). Ditulis
memakai saran Claude. Spec: `../work/specs/2026-10-14-keuangan-spec.md`
bagian 3.3.

| No | Aturan |
|---|---|
| KEU-145 | **Pemakai Catatan Cepat** (Q4; jenis: perincian KEU-27, 118). Pemilik (termasuk Ibu) dan GM. Finance hanya mencatat **atas nama** mereka dengan lampiran wajib; pemilik uang diberi tahu dan punya tombol "Bukan catatan saya" yang menandai catatan "perlu ditanyakan". |
| KEU-146 | **Kotak dan isinya** (jenis: perincian KEU-28, 30). Tiap kotak terpaut ke arah, tempat uang bawaan, kejadian yang boleh dipilih saat melengkapi, kelompok laporan sementara, dan jenis pasangan yang dibutuhkan. "OK, catat" tidak ditahan; gantinya nominal besar dengan terbilang dan tombol Batalkan selama 1 menit. Transfer yang rekeningnya belum dipilih dihitung di tempat sementara "rekening belum dipilih". |
| KEU-147 | **Pos sementara** (Q5; jenis: perincian KEU-32). Catatan dari kotak yang jelas jenisnya dihitung di kelompoknya walaupun belum dilengkapi; kotak Lainnya, Uang Masuk, dan catatan "perlu ditanyakan" dihitung di **Belum dipilah** sampai jelas. |
| KEU-148 | **Melengkapi** (jenis: perincian KEU-31, 33). Batas akhir hari kerja finance berikutnya (libur finance tidak dihitung). Finance tidak mengubah nominal dan arah; ia melengkapi kejadian, cabang, rekening, isian tambahan, bukti, dan pasangan pada catatan yang sama. Pertanyaan "perlu ditanyakan" dijawab pemilik uang atau GM; belum dijawab 3 hari diingatkan ulang. |
| KEU-149 | **Memasangkan** (jenis: perincian KEU-18). Pasangan ke slip, Laporan Bongkaran, dan kasbon menjalankan langkah bayar modulnya dengan nominal **sama persis** (satu catatan boleh untuk beberapa slip bila jumlahnya sama); ke Tagihan Rutin dan nota supplier boleh sebagian; ke Pindah Dana dan catatan bensin "dibayar orang lain" sama persis. Urusan yang sudah dibayar orang lain: Catatan Cepat dibatalkan "dobel catat". Saat membuka langkah bayar, sistem lebih dulu menawarkan Catatan Cepat yang cocok. |
| KEU-150 | **Pecah catatan** (Q1; jenis: **pelapis** KEU-33). Finance, Pemilik, atau GM boleh memecah satu Catatan Cepat menjadi beberapa catatan yang jumlahnya tetap sama, bertempat uang, tanggal, dan pencatat sama, menunjuk induknya. Sisa uang yang kembali ke Brankas dipecah lalu dibatalkan dengan alasan "uang kembali ke Brankas"; pemegang Brankas diberi tahu dan bisa menekan "Tidak benar". |
| KEU-151 | **Masuk ke Brankas** (Q2; jenis: perincian KEU-35, 49). Uang masuk ke Brankas yang dicatat orang lain tampil di daftar pemegang Brankas; menekan "Sudah terima" atau "Tidak cocok" boleh, tidak menekan juga sah. "Tidak cocok" menulis catatan selisih atas nama penyerah tanpa mengubah catatan asal; Pemilik atau GM memutuskan ditanggung penyerah (bahan Potongan Lain, GAJ-80) atau ditanggung kantor dengan alasan. |
| KEU-152 | **Hitung buta** (jenis: perincian KEU-36). Server tidak mengirim saldo ke layar hitung sebelum hasil hitung terkirim. Hasil hitung tidak diubah; salah hitung diganti hitungan baru dan yang lama tetap tersimpan. Selisih menjadi penyesuaian "uang selisih" (KEU-133) yang bertaut ke hitungannya. |
| KEU-153 | **Keputusan selisih hitung** (Q3; jenis: perincian KEU-36). Selisih Kas Pegangan dan Setoran di Finance diputuskan Pemilik atau GM: ditanggung pemegang (bahan Potongan Lain) atau ditanggung kantor dengan alasan. Kelebihan tetap uang kantor. Selisih Brankas tidak dibebankan ke orang. Tanpa keputusan tidak ada potongan otomatis; tanda tetap menyala. |
| KEU-154 | **Jadwal hitung** (jenis: perincian KEU-36, 37, 126). Kas Pegangan dan Setoran di Finance tiap akhir hari kerja pemegangnya (terlewat ditandai pagi hari kerja berikutnya); Brankas tiap 7 hari oleh GM atau finance di hadapan pemegang dengan saksi tercatat; serah terima pemegang dan tanggal pilihan Cek Modal memakai layar yang sama. Tidak ada yang terkunci. |

### 3.22 Perincian Tahap 4H-4: Laporan Kasir

Keputusan pemilik 14 Oktober 2026 (R1 s.d. R3, jawaban "ok" = sesuai saran). Ditulis
memakai saran Claude. Spec: `../work/specs/2026-10-14-keuangan-spec.md`
bagian 3.4.

| No | Aturan |
|---|---|
| KEU-155 | **Penutup shift dan kunci laporan** (jenis: perincian KEU-39, 42). Pelapor = orang yang menekan Kirim, dan selisih atas namanya. Satu laporan per cabang + tanggal + shift yang tidak Dibatalkan; pilihan shift dibaca dari shift cabang pada tanggal itu. |
| KEU-156 | **Isi dan rumus** (jenis: perincian KEU-41, 46, 53). Laporan memuat foto struk wajib, Cash, non-tunai per metode, Piutang (pembanding), titipan pelunasan, uang antar sendiri (dibaca dari Logistik), uang keluar dari laci (belanja toko, Diambil Owner, bayar supplier), dan hitungan uang fisik. Satu fungsi server: **harus diserahkan** = Cash + titipan pelunasan + uang antar sendiri − ketiga uang keluar laci; **selisih** = hitungan − harus diserahkan; **total laporan** = Cash + non-tunai, hanya pembanding omzet. |
| KEU-157 | **Hitung buta di laporan** (R1; jenis: perincian KEU-41). Hitungan uang fisik diisi sebelum "harus diserahkan" dan selisih tampil; server tidak mengirim keduanya sebelum hitungan terkirim. |
| KEU-158 | **Angka dari kasir** (R2; jenis: perincian KEU-47). Setelah sambungan settlement menyala, angka terisi sendiri dan terkunci. Kasir yang melihat beda dengan struk menekan "Angka kasir salah"; finance boleh mengganti dengan angka struk, alasan wajib, bertanda. Settlement yang belum tertarik boleh diketik dari struk bertanda "diketik", lalu dibandingkan saat tarikan masuk. |
| KEU-159 | **Koreksi dan pengembalian** (jenis: perincian KEU-45, 52). Pelapor mengoreksi selama belum ada bagian yang diperiksa; sesudahnya finance **mengembalikan** laporan dengan alasan (pemeriksaan bagian itu dibatalkan); sesudah diperiksa penuh hanya Pemilik atau GM yang membatalkan pemeriksaan. Tiap koreksi menulis versi baru dan menulis ulang catatan Buku Kas lewat pintu dalam satu langkah. |
| KEU-160 | **Atas nama cabang** (R3; jenis: perincian KEU-40). Finance mengisi atas nama dengan alasan dan memilih penutup shift yang menanggung selisih, atau "tidak ada" (selisih ditandai GM, tidak dibebankan sampai diputuskan). Setoran dan non-tunai laporan itu diperiksa Pemilik atau GM. Laporan lebih dari 7 hari ke belakang hanya lewat jalan ini. |
| KEU-161 | **Batas kirim** (jenis: perincian KEU-44). Belum terkirim sampai jam buka cabang esok hari (dibaca dari Kehadiran, KEH-106; hari tutup dilewati): ditandai finance dan GM, pelapor shift itu diingatkan. |
| KEU-162 | **Cek Harian** (jenis: perincian KEU-46, 72). Lima kelompok: belum lapor, nota batal sesudah lapor, Piutang beda dengan nota kiriman, total laporan beda dengan omzet kasir, laporan bertanda. Tiap baris ditandai "Sudah dilihat"; 3 hari belum dilihat ditandai GM. |

### 3.23 Perincian Tahap 4H-5: setoran, non-tunai, selisih kasir, finance libur

Keputusan pemilik 14 Oktober 2026 (S1 s.d. S4, jawaban "ok" = sesuai saran). Ditulis
memakai saran Claude. Spec: `../work/specs/2026-10-14-keuangan-spec.md`
bagian 3.5.

| No | Aturan |
|---|---|
| KEU-163 | **Catatan saat laporan terkirim** (jenis: perincian KEU-48). Cash, titipan pelunasan, uang keluar laci, dan selisih dicatat di Laci cabang; non-tunai di rekening metodenya; Diambil Owner sebagai Pindah Dana Laci → Brankas. Saldo Laci sesudah laporan sama dengan hitungan kasir. |
| KEU-164 | **Terima setoran** (jenis: perincian KEU-49, 51). Finance menekan Terima atau Tidak cocok dengan angka sebenarnya; hasilnya Pindah Dana Laci → Setoran di Finance sebesar uang yang diterima. Tidak cocok menjadi selisih tambahan atas nama penutup shift, atau pembawa bila serah terimanya tercatat; "uang bercampur" tidak dibebankan ke siapa pun dan ditandai GM. Penerima tidak menerima setoran laporan yang ia isi atau amplop yang ia bawa. |
| KEU-165 | **Setor ke Brankas dan Setoran di Finance kosong** (S4; jenis: perincian KEU-02, 49). Finance mencatat setor ke Brankas pada hari kerja yang sama. Bila pemegang Brankas tidak ada, finance menekan "Belum bisa disetor" dengan alasan; uang tetap di Setoran di Finance, ikut Hitung Kas, dan ditandai GM. Setoran di Finance yang tidak Rp0 di akhir hari kerja tanpa alasan itu ditandai GM. |
| KEU-166 | **Setor bank toko** (S3; jenis: perincian KEU-50). Dicatat toko dengan foto bukti wajib sebagai Pindah Dana Laci → rekening cabang, dicocokkan finance dengan mutasi. Tidak cocok: Pindah Dana dibetulkan menjadi angka mutasi dan selisihnya menjadi kekurangan atas nama penyetor, dengan hak keberatan. |
| KEU-167 | **Non-tunai dan penelusurannya** (S2; jenis: perincian KEU-52). Dicocokkan per metode terhadap mutasi; Tidak cocok membetulkan uang masuk menjadi angka mutasi dan menandai selisih "perlu ditelusuri". Pemilik atau GM menutupnya: salah ketik di laporan (laporan dikembalikan), uang menyusul, ditanggung kantor, atau ditanggung penutup shift dengan alasan (menjadi kekurangan biasa). Tidak pernah otomatis menjadi beban kasir. |
| KEU-168 | **Laporan Diperiksa** (jenis: perincian KEU-09, 52, 53). Laporan menjadi Diperiksa bila setoran atau setor bank sudah diputuskan, tiap metode non-tunai sudah dicocokkan, dan tiap belanja toko sudah diberi kejadian oleh finance. Batas 3 hari kerja finance; lewat itu ditandai. |
| KEU-169 | **Fungsi selisih kasir** (jenis: perincian KEU-54; dipakai GAJ-78). Satu fungsi server: selisih (orang, periode 26–25 menurut tanggal laporan) = kekurangan Tetap + Keberatan menunggu − kelebihan, paling kecil Rp0, dengan rincian per laporan. Selisih tambahan adalah baris baru yang menunjuk laporan yang sama; tidak ada yang ditimpa. Langkah tutup slip memanggil "tandai selisih masuk slip", buka kembali memanggil "balik tanda". Selisih kasir adalah **jenis kategori kesembilan** (pelapis KEU-129) yang dibaca laba lewat fungsi ini. |
| KEU-170 | **Kelebihan kas** (S1; jenis: perincian KEU-54). Kelebihan hanya menutup kekurangan orang yang sama di periode yang sama; sisanya menjadi uang masuk "kelebihan kas" (pendapatan lain) saat slip periode itu ditutup. |
| KEU-171 | **Selisih di laba** (jenis: perincian KEU-108). Biaya = kekurangan Ditiadakan + selisih yang ditanggung kantor + yang tidak tertagih; pendapatan lain = sisa kelebihan. Kekurangan Tetap tidak menjadi biaya karena kembali lewat potongan slip. |
| KEU-172 | **Keberatan dan finance libur** (jenis: perincian KEU-55, 56). Keberatan kekurangan kas memakai masa keberatan potongan Gaji (3 hari sejak diberi tahu, sampai 23.59), diputuskan Pemilik atau GM yang bukan pemiliknya; tanpa keputusan tetap dipotong. Saat finance libur, pemegang Brankas yang menekan Terima memindah uang langsung Laci → Brankas; catatan kertasnya dimasukkan finance atas nama dengan tanggal sebenarnya; pengganti sementara memakai hak tambahan "gantikan sementara" (KAR-L29). |

### 3.24 Perincian Tahap 4H-6: supplier dan utang supplier

Keputusan pemilik 14 Oktober 2026 (T1 s.d. T5, jawaban "ok" = sesuai saran). Ditulis
memakai saran Claude. Spec: `../work/specs/2026-10-14-keuangan-spec.md`
bagian 3.6.

| No | Aturan |
|---|---|
| KEU-173 | **Status supplier** (jenis: perincian KEU-57). Aktif, Belum diperiksa (dari Kepala Gudang, nama dan HP saja), Digabung ke induk, Nonaktif (hanya bila sisa Rp0 dan tanpa titipan). Nama dan nama lain yang sama dengan nama cabang ditolak. |
| KEU-174 | **Nama mirip, persis sama, dan belum dipasangkan** (jenis: perincian KEU-57). Pencarian mengabaikan huruf besar-kecil, spasi, titik, dan kata di pengaturan (PT, CV, UD, Tk, Toko). Nama persis sama ditolak; nama mirip wajib ditegaskan "memang baru". Nama dari kasir dan Catatan Cepat yang belum dikenal masuk daftar finance untuk dipasangkan sebagai nama lain. |
| KEU-175 | **Gabung dan batal gabung** (T5; jenis: perincian KEU-57). Catatan supplier yang digabung dibaca sebagai milik induk tanpa ditulis ulang. Batalkan gabung hanya Pemilik atau GM, alasan wajib; catatan sesudah gabung tetap di induk dan bisa dipindah satu per satu. |
| KEU-176 | **Nota dari kasir** (jenis: perincian KEU-58, 59). Nota berubah atau hilang ditandai dengan nilai sebelum dan sesudah; pasangan yang melebihi nilai nota baru, atau pasangan ke nota hilang, menjadi titipan. Nota "mungkin kembar" ditutup finance dengan alasan. Nota yang suppliernya cabang sendiri dibaca di Toko & Gudang, bukan utang supplier. |
| KEU-177 | **Fungsi sisa utang** (jenis: perincian KEU-60, 64, 67). Sisa = utang awal + nota − pasangan pembayaran − retur disahkan − potongan potong nota; minus tampil sebagai titipan dan dipakai otomatis untuk nota berikutnya (nota tertua dulu) sebagai pasangan tanpa uang. Umur per nota dihitung sampai lunas. Sisa versi kasir tampil berdampingan; beda ditandai, tidak menimpa. |
| KEU-178 | **Cabang pembayaran supplier** (T1; jenis: **pengecualian** KEU-61 butir "cabang mengikuti notanya", dan perincian KEU-131). Catatan Buku Kas pembayaran supplier dibebankan ke cabang pemilik tempat uang yang membayar; cabang tiap nota disimpan di rincian pasangan dan dibaca buku toko dengan Gudang (KEU-70). |
| KEU-179 | **Pembayaran diperiksa** (T2; jenis: perincian KEU-68, 142). Pembayaran lewat menu Utang Supplier diperiksa seperti catatan ketik; dari laci diperiksa bersama Laporan Kasir; dari Catatan Cepat sesudah dilengkapi. Pembagian bawaan nota tertua dulu, bisa diubah; sisa yang tidak terbagi menjadi titipan. |
| KEU-180 | **Dibayar menurut kasir** (jenis: perincian KEU-60). Pembayaran supplier yang tercatat di kasir tanpa padanan di Buku Kas tampil untuk finance, ditutup dengan memasangkan atau mencatat dengan sumber uang dan bukti sebenarnya; pembayaran Buku Kas tanpa padanan di kasir juga ditandai. |
| KEU-181 | **Retur dan potongan** (T3, T4; jenis: perincian KEU-65, 66). Retur diterima supplier dicatat finance dan **disahkan Pemilik atau GM** sebelum mengurangi utang. Potongan uang = uang masuk pendapatan lain; potong nota = pasangan tanpa uang + pendapatan lain di Catatan Tanpa Uang; potongan barang = keterangan nilai saja, tidak masuk laba HRIS. Ketiganya tampil sebagai pos "Potongan dari supplier". |
| KEU-182 | **Utang awal** (jenis: perincian KEU-67). Diisi finance dari tagihan supplier (foto wajib), per nota atau satu angka, disahkan Pemilik atau GM yang bukan pengisinya; terkunci sesudah ada pembayaran yang dipasangkan; koreksinya penyesuaian utang beralasan oleh Pemilik atau GM. |

### 3.25 Perincian Tahap 4H-7: toko dan Gudang, Piutang Lain

Keputusan pemilik 14 Oktober 2026 (V1 s.d. V4, jawaban "ok" = sesuai saran). Ditulis
memakai saran Claude. Spec: `../work/specs/2026-10-14-keuangan-spec.md`
bagian 3.7.

| No | Aturan |
|---|---|
| KEU-183 | **Fungsi buku toko** (jenis: perincian KEU-69, 70, 71). Dihitung dari catatan yang sudah ada, tanpa saldo tersimpan dan tanpa isian ketik. Menambah utang: nota penjualan Gudang ke toko (kasir), catatan uang keluar bercabang toko dari tempat uang Gudang, nota bercabang toko yang dibayar uang Gudang. Mengurangi: Pindah Dana dari tempat uang toko ke tempat uang Gudang, uang toko yang membayar nota Gudang, uang masuk bercabang toko yang diterima tempat uang Gudang (termasuk uang driver). Minus = deposit toko di Gudang. |
| KEU-184 | **Kapan setoran dihitung** (jenis: perincian KEU-69). Setoran toko dihitung pembayaran saat diterima finance atau pemegang Brankas; perpindahan antar tempat uang Gudang tidak dihitung lagi; uang di rekening toko sendiri belum dihitung. |
| KEU-185 | **Antar toko lewat Gudang** (V1; jenis: perincian KEU-69). Uang atau biaya yang berpindah antara dua toko dibaca sebagai toko pembayar membayar Gudang dan toko penerima berutang ke Gudang; ditandai untuk GM. Tidak ada buku toko-dengan-toko. |
| KEU-186 | **Kirim pembayaran ke kasir** (V2; jenis: perincian KEU-69, LOG-65). Satu baris "pembayaran toko ke Gudang" per toko per hari ke Catat di Kasir lewat pintu Logistik; perubahan sesudahnya menjadi baris koreksi. |
| KEU-187 | **Omzet dan penjualan antar cabang** (jenis: perincian KEU-72, 73). Omzet, harga pokok, dan penjualan Gudang ke cabang sendiri dibaca terpisah per cabang per hari dari kasir; tidak diketik kecuali titik awal Cek Modal. |
| KEU-188 | **Piutang Lain: lahir dan berkurang** (jenis: perincian KEU-74). Lahir otomatis dari slip terakhir (satu baris per jenis, kasbon menunjuk kasbon asal) dan koreksi minus sesudah slip terakhir dibayar; berkurang lewat cicilan uang (uang masuk bukan pendapatan), cicilan tanpa uang dari bayar di luar slip, penghapusan, atau pembalikan saat slip terakhir dibuka kembali (ditolak bila sudah ada cicilan uang). Sisa dihitung dari mutasi. |
| KEU-189 | **Piutang Lain diketik** (V3; jenis: **pelapis** KEU-74). Finance boleh mengajukan Piutang Lain di luar slip (orang atau pihak luar) dengan alasan dan bukti; berlaku setelah disahkan Pemilik atau GM yang bukan pengajunya. |
| KEU-190 | **Tinjau dan hapus** (V4; jenis: perincian KEU-74). Piutang 90 hari tanpa cicilan masuk daftar tinjau Pemilik dan GM: Tagih lagi, Hapus, atau Biarkan dengan alasan. Hapus hanya Pemilik atau GM, seluruh atau sebagian, menjadi biaya cabang penanggung di Catatan Tanpa Uang. Tidak ada penghapusan otomatis. |

### 3.26 Perincian Tahap 4H-8: Tagihan Rutin, aset, Buku Ibu

Keputusan pemilik 14 Oktober 2026 (X1 s.d. X5, jawaban "ok" = sesuai saran). Ditulis
memakai saran Claude. Spec: `../work/specs/2026-10-14-keuangan-spec.md`
bagian 3.8.

| No | Aturan |
|---|---|
| KEU-191 | **Jenis tagihan dan cara hitung** (jenis: perincian KEU-75, 76). Tiap jenis menyimpan cara hitung, cabang, penerima, jatuh tempo, aset, tanggungan (usaha atau Ibu), mulai, berakhir. Per hari kendaraan berangkat = banyak tanggal kendaraan itu punya trip berangkat (dua trip satu hari dihitung satu), dikunci tanggal 1 bulan berikutnya. |
| KEU-192 | **Pembuat tagihan** (jenis: perincian KEU-75, 78). Satu mesin harian membuat tagihan semua bulan yang belum ada sejak mulai, berkunci jenis + bulan. Status: Menunggu nominal, Belum dibayar, Sebagian, Lunas, Tercatat sebagai hak, Dibatalkan. Dibayar dan sisa dihitung dari pasangan. |
| KEU-193 | **Nominal menyusul** (X5; jenis: perincian KEU-76). Finance mengisi nominal dan foto tagihan; belum diisi 7 hari sesudah jatuh tempo ditandai GM. |
| KEU-194 | **Hak tarif** (jenis: perincian KEU-77, 119). Jenis tagihan dan tarif biasa diperiksa Pemilik atau GM yang bukan pengisinya sebelum dipakai mesin; tarif sewa aset Owner diisi Owner atau GM tanpa persetujuan dan diberitahukan. Tarif baru tidak boleh mulai di bulan yang tagihannya sudah lunas atau di bulan tertutup. |
| KEU-195 | **Hak sewa** (X1; jenis: perincian KEU-82, 83). Tagihan sewa aset Owner berstatus "Tercatat sebagai hak": menjadi biaya cabang pemakai dan menambah Buku Ibu tanpa catatan uang. Uang yang diambil Ibu sebagai bagian sewa dicatat Pribadi. |
| KEU-196 | **Bayar di muka** (X2; jenis: perincian KEU-79). Untuk tagihan rutin: tagihan bulan yang dicakup dibuat lebih awal dan pembayaran dibagi ke tagihan-tagihan itu. Untuk yang lain: catatan "Bayar di muka" dengan banyak bulan dan bulan mulai; mesin menulis bagian bulanan di Catatan Tanpa Uang; dapat dihentikan dengan sisa kembali (uang masuk) atau hangus (biaya). |
| KEU-197 | **Aset kantor** (X3; jenis: perincian KEU-86). Lahir dari catatan "Beli alat atau barang kantor" di atas batas sebagai Perlu dilengkapi. Bagian bulanan = harga ÷ umur, mulai bulan pembelian, sisa pembulatan di bulan terakhir, ditulis mesin berkunci aset + bulan. Rusak, hilang, dijual: sisa nilai menjadi kerugian bulan itu (dikurangi uang jual); keadaan diubah Pemilik atau GM; dipindah cabang boleh finance. |
| KEU-198 | **Cek Aset** (X4; jenis: perincian KEU-86). Dibuka mesin setahun sekali (bawaan Januari) per cabang; kepala cabang mencentang ada, rusak, tidak ketemu tanpa melihat nilai; Pemilik atau GM memutuskan tidak ketemu (dipindah atau hilang) dan rusak. |
| KEU-199 | **Aset Owner dan kontrak** (jenis: perincian KEU-80, 81, 84, 85). Kendaraan menunjuk `mobil` Logistik. Pembayaran kontrak ke luar, service, pajak, dan cicilan aset Owner dengan uang usaha berkejadian pengambilan pemilik dan mengurangi Buku Ibu, tidak menjadi biaya cabang. Selisih hak sewa dan biaya aset per aset per tahun hanya untuk Pemilik dan GM. |
| KEU-200 | **Fungsi Buku Ibu** (jenis: perincian KEU-82). Dihitung per pemilik usaha dari hak sewa, uang pribadi masuk, Pribadi, dan biaya aset Owner yang dibayar uang usaha; saldo awal nol pada hari mulai; boleh minus ("sudah dipakai melebihi hak"); tidak menolak pengambilan. |

### 3.27 Perincian Tahap 4H-9: Cek Modal

Keputusan pemilik 14 Oktober 2026 (Y1 s.d. Y4, jawaban "ok" = sesuai saran). Ditulis
memakai saran Claude. Spec: `../work/specs/2026-10-14-keuangan-spec.md`
bagian 3.9.

| No | Aturan |
|---|---|
| KEU-201 | **Fungsi posisi modal** (jenis: perincian KEU-89, 90). Satu fungsi menjumlah harta (uang, barang dagangan dengan harga beli, uang di orang lain, sisa nilai aset kantor) dan kewajiban per cabang dan gabungan, memanggil fungsi tiap modul tanpa menghitung ulang. Barang lama tidak laku tetap harta bertanda; reject bukan harta; aset Owner tidak dihitung; Buku Ibu positif di kewajiban, minus di harta; antar cabang saling menghapus di gabungan. |
| KEU-202 | **Jembatan** (jenis: perincian KEU-91, 96). Tiap baris menyimpan awal, penambah, pengurang, seharusnya, nyata, selisih, dan dua hitungan yang mengapitnya. Baris tanpa angka nyata ditandai "belum dihitung nyata sejak …" dan tidak dinyatakan aman. |
| KEU-203 | **Perubahan wajar** (Y1; jenis: **pengganti** rumus KEU-92). Perubahan wajar harta bersih = laba bulan itu + pembetulan titik awal (penyesuaian "saldo awal salah"). Pengambilan Ibu, uang pribadi masuk, dan hak sewa tidak ditambahkan lagi karena sudah tercermin di Buku Ibu yang berada di kewajiban (KEU-90). Selisih dengan perubahan nyata = "modal bergeser tanpa penjelasan". |
| KEU-204 | **Saldo mutasi rekening** (Y2; jenis: perincian KEU-91, 96). Finance mengisi saldo menurut mutasi tiap rekening tiap akhir bulan dan saat cek di tanggal pilihan, dengan foto atau file; itu angka nyata rekening. Selisihnya ditandai seperti selisih Hitung Kas. |
| KEU-205 | **Titik awal** (Y3; jenis: perincian KEU-94, 97). Uang dari saldo awal yang disahkan; stok, piutang toko, dan utang supplier dari kasir dan tagihan, atau diketik Pemilik/GM bertanda selama sambungan belum menyala; sisa kasbon bawaan, Dana Disiplin, dan titipan toko dari modulnya. Aset kantor sebelum hari mulai tidak dicatat. Sesudah titik awal, nilai stok hanya ditarik dari kasir tiap akhir bulan. |
| KEU-206 | **Hasil tersimpan** (jenis: perincian KEU-88, 95). Tiap cek (tutup bulan atau tanggal pilihan) disimpan sebagai salinan beserta pembuat dan waktunya dan tidak berubah oleh catatan yang masuk belakangan; keadaan terbaru dilihat dengan cek baru. Cek di tanggal pilihan menawarkan Hitung Kas untuk tempat yang belum nyata. |
| KEU-207 | **Pemberitahuan segera** (Y4; jenis: perincian KEU-93). Dipicu selisih Hitung Kas, "Tidak cocok" di Brankas, atau selisih saldo mutasi di atas batas (isi awal Rp1.000.000); dikirim ke Pemilik dan GM dengan tautan ke baris asal. |
| KEU-208 | **Belum lengkap** (jenis: perincian KEU-92, 111). Unsur yang datanya belum masuk dari kasir ditandai dan tidak dihitung sebagai pergeseran; Cek Modal hanya untuk Pemilik dan GM. |

### 3.28 Perincian Tahap 4H-10: Keuangan Hari Ini

Keputusan pemilik 14 Oktober 2026 (Z1 s.d. Z4, jawaban "ok" = sesuai saran). Ditulis
memakai saran Claude. Spec: `../work/specs/2026-10-14-keuangan-spec.md`
bagian 3.10.

| No | Aturan |
|---|---|
| KEU-209 | **Fungsi uang bebas** (jenis: perincian KEU-100). Jumlah uang semua tempat − titipan dan deposit toko luar − saldo Dana Disiplin − Buku Ibu bila positif − tabungan loyalitas (bila dinyalakan). Titipan di supplier dan deposit toko sendiri tidak dikurangkan. |
| KEU-210 | **Perkiraan Kas** (Z1; jenis: perincian KEU-101). Mulai dari uang bebas hari ini, dihitung per hari selama 28 hari, ditampilkan per minggu Senin–Minggu (minggu ke-1 dari hari ini). Masuk: rata-rata uang penjualan dan pengiriman menurut hari dalam minggu, piutang toko jatuh tempo. Keluar: slip bulanan dan mingguan dari perkiraan bersihnya, slip tertutup belum dibayar, tagihan, kontrak, Rencana Pengeluaran Besar, supplier (jatuh tempo nota bertempo; rata-rata untuk yang lain). Salinan tiap Senin disimpan untuk dibandingkan dengan kenyataan. |
| KEU-211 | **Operasional di perkiraan** (Z2; jenis: **pelapis** KEU-101). Sisi keluar ditambah rata-rata kelompok operasional 4 minggu terakhir, dibagi rata per hari. |
| KEU-212 | **Batas aman pengganti** (Z4; jenis: perincian KEU-102). Mesin menghitung merah dan kuning saran tiap tanggal 1; angka pengganti Pemilik atau GM berlaku sampai dicabut, dan angka saran tetap tampil berdampingan. Tembus batas diberitahukan sekali per kejadian. |
| KEU-213 | **Kemampuan Belanja** (Z3; jenis: perincian KEU-104). = maks(0, titik terendah saldo perkiraan harian 28 hari − batas kuning); hanya untuk Pemilik dan GM. |
| KEU-214 | **Rencana Pengeluaran Besar** (jenis: perincian KEU-103). Selesai saat dipasangkan ke catatan Buku Kas; lewat tanggal tanpa pasangan tetap ikut perkiraan pada hari ini, bertanda "lewat". Tanda kenaikan 20% dibanding rata-rata 3 bulan, disetarakan dengan hari yang sudah lewat. |
| KEU-215 | **Penjaga menguras saldo** (jenis: perincian KEU-106). Baris sisa uang dan jendela "Tetap bayar"/"Kurangi" hanya tampil bagi Pemilik dan GM; pembayaran oleh finance yang menembus batas tidak memunculkan jendela tetapi tetap tercatat sebagai tembus batas dan diberitahukan ke GM. "Tetap bayar" ditahan 3 detik dan tercatat. |
| KEU-216 | **Halaman depan** (jenis: perincian KEU-98, 99). Empat kotak berurutan, Kemampuan Belanja, Buku Ibu, perlu perhatian; Posisi Kas pada tanggal mana pun dengan terakhir dihitung nyata dan jumlah yang belum diperiksa atau belum dipilah; tidak ada saldo proyeksi. |

### 3.29 Perincian Tahap 4H-11: laporan dan tutup bulan

Keputusan pemilik 14 Oktober 2026 (AA1 s.d. AA3, jawaban "ok" = sesuai saran).
Ditulis memakai saran Claude. Spec: `../work/specs/2026-10-14-keuangan-spec.md`
bagian 3.11.

| No | Aturan |
|---|---|
| KEU-217 | **Fungsi laba** (jenis: perincian KEU-108). Laba (cabang, bulan) = omzet − harga pokok (kasir) − gaji dan upah − gaji pemilik dan GM (Gudang) − sewa dan tagihan (bulan dicakup, tanpa tanggungan Ibu) − operasional − bagian bulanan aset dan bayar di muka − kerugian (reject, sisa nilai aset, kekurangan ditanggung kantor, selisih non-tunai dan uang tanpa catatan, kurang serah, utang kasbon dan Piutang Lain dihapus) + pendapatan lain (rebate, sisa kelebihan kas, lebih serah, ganti rugi dari karyawan). Uang diterima tampil terpisah. Gabungan menghapus penjualan antar cabang. |
| KEU-218 | **Beban gaji** (AA1; jenis: perincian KEU-108, GAJ-56). Beban = pendapatan slip − potongan tidak hadir dan telat yang tidak masuk dana; denda yang masuk Dana Disiplin tetap beban; potongan pelunasan (kasbon, kekurangan kas, sisa potongan) tidak mengurangi beban; potongan ganti rugi menjadi pendapatan lain. Angkanya dibaca dari fungsi uraian slip Gaji (GAJ-105), tidak dihitung ulang. |
| KEU-219 | **Bulan beban** (AA3; jenis: perincian KEU-109). Slip bulanan ke bulan akhir periode; upah mingguan ke bulan minggu upah berakhir; upah bongkaran ke bulan tanggal kerja. |
| KEU-220 | **Uang Habis ke Mana** (jenis: perincian KEU-107). Dibaca dari catatan uang keluar menurut bulan laporan, kelompok tetap sama dengan Cek Modal, per cabang dengan pembanding; uang masuk per jenis; Pindah Dana tidak tampil; Diambil Owner di sini, tidak di Untung Rugi. |
| KEU-221 | **Tutup bulan** (AA2; jenis: perincian KEU-112). Pemilik atau GM menutup bulan secara berurutan setelah melihat daftar belum beres; boleh "ditutup dengan catatan" dengan alasan. Saat ditutup laporan bulan disimpan sebagai salinan dan Cek Modal dijalankan. **Tidak ada buka kembali**; catatan terlambat masuk bulan berjalan sebagai koreksi yang menunjuk bulan asal. |
| KEU-222 | **Belum lengkap dan rentang** (jenis: perincian KEU-110, 111). Bulan dengan data kasir belum masuk, Belum dipilah, atau catatan belum diperiksa menampilkan "perkiraan laba (belum lengkap)". Rentang tidak penuh sebulan membagi tagihan dan bagian bulanan menurut hari. |
| KEU-223 | **Laporan bulanan dan unduhan** (jenis: perincian KEU-11, 106, 113, 116). Laporan bulanan memuat jumlah "tanpa bukti" dan "bukti tidak ada" per kejadian, tembus batas merah, dan "Tetap bayar". Unduhan dibuat server dengan tanggal dan pembuat; versi akuntansi hanya unduhan. |
| KEU-224 | **Ringkasan pagi** (jenis: perincian KEU-117). Pukul 06.30 ke Pemilik dan GM: kemarin masuk dan keluar, uang bebas, Kemampuan Belanja, perlu perhatian; bisa dimatikan per orang. |

## 4. Yang diganti dari sistem lama

Daftar lengkap aturan sistem lama dan nasibnya ada di arsip. Yang paling mengubah
cara kerja:

| Di sistem lama | Di v3 | Aturan |
|---|---|---|
| Kas Masuk, Kas Keluar, dan Petty Cash tiga buku terpisah | Satu Buku Kas | KEU-01 |
| Petty Cash Rp1,58 miliar dalam dua bulan, tanpa pemeriksaan, tanpa jejak, tidak bertaut | Kas Pegangan dan Brankas di dalam Buku Kas; Hitung Kas | KEU-03, 36, 37 |
| Catatan pemilik uang diketik ulang finance ke pos-pos dan sering terlewat | Catatan Cepat dilengkapi di baris yang sama | KEU-27, 31 |
| Setor bank dan isi kas kecil tercatat sebagai "keluar"; pindah uang tidak bisa dicatat | Pindah Dana | KEU-04 |
| Satu "Kas Tunai" untuk seluruh perusahaan | Laci tiap cabang, Brankas, Kas Pegangan, Setoran di Finance | KEU-02, 48 |
| 647 pengeluaran tanpa rekening sumber | Tempat uang sumber wajib | KEU-05 |
| Baris disetujui masih diubah (157 kali) dan terhapus (50 baris) | Tidak dihapus; setelah diperiksa hanya dibatalkan | KEU-16 |
| Pengisi memeriksa isiannya sendiri (22 kali); isian lahir langsung disetujui | Dijaga server | KEU-10, 120 |
| Akun berhak "hr" dipakai orang Finance; hak ditulis di tujuh halaman | Hak per jabatan dari satu daftar; HR tanpa menu Keuangan | KEU-09, 118 |
| Tanggal masa depan disetujui; ketikan mundur berminggu-minggu | Tanggal catat dari server; mundur paling jauh 7 hari | KEU-12 |
| Tidak ada tempat melampirkan bukti | Foto bukti, dianjurkan dulu lalu wajib; "tanpa bukti" dihitung | KEU-11 |
| Jejak perubahan ada tetapi tidak punya layar | Riwayat dibuka dari tiap baris | KEU-17 |
| Menunggu diperiksa sampai 30 hari tanpa tanda | Batas 3 hari; satu halaman Pemeriksaan | KEU-13, 14 |
| Gaji dicatat tiga cara; biaya dan pembayaran gaji driver tidak berpasangan | Satu baris per slip yang dibayar | KEU-06, 24 |
| Kategori gaji, supplier, dan kasbon hanya ditahan layar | Server menolak kalau diketik | KEU-23 |
| Tanda "masuk hitungan laba" mengubah laporan bulan lalu | Jenis kategori bertanggal berlaku; yang bukan biaya ditentukan daftar kejadian | KEU-20, 22 |
| Saldo awal bisa diubah kapan saja | Bertanggal, dari hitung fisik; koreksi lewat penyesuaian | KEU-07, 08 |
| "Input Kasir Darurat" menjadi jalur utama (1.111 baris ketikan) | Hanya Laporan Kasir | KEU-38 |
| Omzet toko tidak tercatat karena "tanggal mulai" kosong | Semua aliran hidup sejak hari mulai | KEU-08 |
| Gudang dan Markas tidak pernah melapor | Pelapor per cabang sebagai pengaturan; jalan keluar kalau pelapor tidak ada | KEU-39, 40 |
| Kekurangan kas tercatat 45 kali, tetapi hanya 2 yang sampai ke potongan | Satu baris per laporan atas nama penutup shift | KEU-54, 55 |
| Selisih dicatat di tiga tempat, baris ditimpa, memakai bulan kalender | Satu tempat, periode 26–25, tidak ditimpa | KEU-54 |
| Pengeluaran dari laci tanpa jenis dan bukti (Rp20 juta di Toko Pusat) | Tiga jenis uang keluar dari laci | KEU-53 |
| Non-tunai yang tidak cocok hanya bisa ditolak | Cocok atau Tidak cocok per baris; ditelusuri GM | KEU-52 |
| Memeriksa laporan sendiri; persetujuan dibatalkan tanpa alasan; baris Kas Masuk dihapus | Dijaga server; batal beralasan | KEU-45, 120 |
| Paling banyak 2 shift; hari tutup ditandai "belum lapor" | Shift mengikuti cabang; hari tutup dikenali | KEU-40, 42 |
| Nota belanja diketik di HRIS: 191 dari 196 tanpa nomor dan foto, bisa diubah dan dihapus tanpa jejak | Nota milik kasir; HRIS hanya membaca | KEU-58, 59 |
| "Sisa Utang" hanya sejak 8 Agustus; Rp6,99 miliar pembayaran tidak bertaut ke nota | Utang awal; semua jalan bayar ke satu buku utang | KEU-62, 67 |
| Bayar supplier dari laci atau oleh Owner tidak mengurangi utang | Dipasangkan ke supplier dan nota | KEU-62 |
| Bayar lebih ditolak; retur ke supplier dan rebate tidak punya tempat | Titipan di supplier; retur dan potongan dari supplier dicatat | KEU-64, 65, 66 |
| Satu supplier ditulis dengan beberapa nama | Nama mirip, nama lain, gabung supplier | KEU-57 |
| Catatan utang kasir dan HRIS tidak pernah dibandingkan | Dua angka berdampingan | KEU-60 |
| Toko "berutang" Rp352 juta ke Gudang dan Hammielion sebagai "supplier" | Buku toko dengan Gudang; deposit toko | KEU-69, 70 |
| HPP diketik sebulan sekali, Juli kosong | Omzet dan harga pokok dari kasir | KEU-72 |
| Laba = Kas Masuk − HPP, sehingga Agustus dan September tampil rugi | Satu hitungan laba dari sumber yang sama | KEU-108 |
| Piutang mantan karyawan tidak punya tempat | Buku Piutang Lain | KEU-74 |
| Mesin biaya tetap menulis uang keluar dan uang masuk yang langsung disetujui | Tagihan, bukan uang keluar | KEU-75, 83 |
| Dua mesin biaya tetap; bulan terlewat tidak dikejar | Satu mesin yang mengejar | KEU-76, 78 |
| Tarif mobil tanpa layar, tanpa tanggal, terbaca semua orang | Punya layar, bertanggal, hanya yang berhak | KEU-77, 119, 121 |
| Bayar sewa setahun menjadi biaya satu bulan | Dibagi ke bulan yang dicakup | KEU-79 |
| "Logistik" sebagai cabang dengan pemasukan semu Rp96,2 juta | Buku Ibu; hak sewa hanya catatan hak | KEU-82, 83 |
| Sewa Raja terhitung dua kali | Kontrak ke luar mengurangi Buku Ibu, bukan biaya cabang lagi | KEU-84 |
| Daftar aset, kontrak, dan modal bulanan kosong | Daftar Aset, pengingat kontrak, Cek Aset | KEU-80, 85, 86 |
| Modal awal diketik sekali dan tidak diperbarui | Cek Modal tiap tutup bulan dan di tanggal pilihan | KEU-88, 95 |
| Beli barang besar menjadi biaya penuh bulan itu | Dibagi selama umur pakai | KEU-86 |
| Empat angka "kas" berbeda arti; "Saldo Proyeksi" bukan perkiraan | Posisi Kas, uang bebas dipakai, Perkiraan Kas | KEU-99, 100, 101 |
| Tidak ada perkiraan kas; saldo dikuras untuk supplier | Batas aman, Kemampuan Belanja, penjaga menguras saldo | KEU-102, 104, 106 |
| Rumus laba di tiga halaman, dihitung di layar | Satu hitungan di server | KEU-108 |
| Laporan bulan lama bisa berubah; tidak ada tutup bulan | Tutup bulan; koreksi di bulan berjalan | KEU-112 |
| Bulan tanpa HPP tampil untung besar tanpa tanda | "Belum lengkap" ditandai | KEU-111 |
| Kepala cabang membuka laba cabangnya; HR melihat semuanya | Laporan hanya untuk pemilik | KEU-118 |
| Dashboard dan Laporan Resmi kembar | Satu halaman Keuangan Hari Ini | KEU-98 |
| ID cabang, nama rute, dan daftar kategori ditulis di kode | Pengaturan | KEU-114, 121 |

## 5. Kejadian di lapangan dan jalan keluarnya

| Kejadian | Jalan keluar di v3 | Aturan |
|---|---|---|
| Salah ketik nominal, belum diperiksa | Dikoreksi pengisinya, dengan jejak | KEU-16 |
| Salah ketik, sudah diperiksa | Dibatalkan pemilik dengan alasan, lalu dicatat ulang | KEU-16 |
| Pengeluaran ternyata tidak jadi | Dibatalkan dengan alasan; barisnya tetap terlihat | KEU-16 |
| Pemeriksa menolak | Alasan wajib; kembali ke daftar "Perlu Diperbaiki" | KEU-14, 15 |
| Isian menunggu diperiksa berhari-hari | Ditandai setelah 3 hari | KEU-13 |
| Uang tunai disetor ke bank, atau ditukar dengan transfer | Pindah Dana | KEU-04 |
| Uang baru dicatat dua minggu kemudian | Hanya pemilik, dengan alasan | KEU-12 |
| Uangnya keluar di bulan yang sudah ditutup | Saldo memakai tanggal sebenarnya; laporan memasukkannya sebagai koreksi bulan berjalan | KEU-12, 112 |
| Struk hilang | Baris bertanda "tanpa bukti"; kalau kejadiannya sudah "wajib", pilih "bukti tidak ada" dengan alasan | KEU-11 |
| Uang diberikan dulu untuk belanja, struk belum ada | Dicatat saat diberikan, bertanda "struk menyusul"; dibetulkan saat struk datang | KEU-26 |
| Ibu dan finance mencatat uang yang sama | Finance memasangkan; yang dobel dibatalkan dengan alasan "dobel catat" | KEU-18 |
| Ibu mencatat "gaji" untuk orang yang slipnya tidak ada | Tidak menjadi gaji: Pribadi, Bantuan, atau ditanyakan | KEU-18 |
| Catatan Ibu hanya nama orang | Finance menandai "perlu ditanyakan"; masuk pos "Belum dipilah" | KEU-32 |
| Ibu mengirim pengeluaran lewat WhatsApp | Finance mencatat atas nama Ibu, dengan tangkapan layar | KEU-27 |
| Ibu mengambil uang dari laci toko | Kasir mencatat "Diambil Owner"; tercatat pindah ke Brankas | KEU-21, 53 |
| Ibu mengambil uang untuk keperluan pribadi | "Pribadi"; mengurangi Buku Ibu | KEU-21, 82 |
| Uang Kas Pegangan tidak cocok dengan catatan | Selisih tercatat sebagai baris sendiri, ditandai untuk pemilik | KEU-36 |
| Hitung Brankas terlewat seminggu | Ditandai; tidak ada yang terkunci | KEU-37 |
| Kasir salah isi laporan, belum diperiksa | Dikoreksi pelapor, dengan jejak | KEU-45 |
| Kasir salah isi laporan, sudah diperiksa | Pemeriksaan dibatalkan pemilik dengan alasan | KEU-45 |
| Uang tunai yang sampai kurang dari laporan | "Tidak cocok" dengan angka sebenarnya; menjadi kekurangan kas penutup shift | KEU-49, 54 |
| Uang beberapa shift bercampur di laci | Selisih tidak dibebankan ke siapa pun; ditandai untuk GM | KEU-51 |
| Kasir merasa kekurangannya bukan salahnya | Keberatan 3 hari; pemilik memutuskan tetap atau ditiadakan | KEU-55 |
| QRIS di mutasi berbeda dari laporan | Tidak cocok dengan angka mutasi; ditelusuri GM, bukan beban kasir | KEU-52 |
| Kasir tidak melapor | Ditandai saat toko buka esok harinya | KEU-44 |
| Semua pelapor sakit atau keluar | Hak lapor sementara; kalau tidak ada orang, finance mengisi atas nama | KEU-40 |
| Toko tutup | Hari tutup; tidak ditandai "belum lapor" | KEU-40 |
| Pelapor berhenti sebelum laporannya diperiksa | Tetap diperiksa; kekurangannya masuk slip terakhir | KEU-40 |
| Ada uang pelunasan pelanggan di laci | Titipan pelunasan; diteruskan ke kasir | KEU-46 |
| Toko membayar supplier dari laci | "Bayar supplier"; masuk Utang Supplier | KEU-53, 62 |
| Finance libur | Uang diam di Laci; batas waktu menurut hari kerja finance; dicatat menyusul | KEU-56 |
| Finance libur, Ibu menerima setoran sendiri | Menekan "Terima", atau kertasnya dimasukkan finance saat masuk | KEU-56 |
| Supplier baru datang saat bongkaran | Kepala Gudang menambahkannya, bertanda "belum diperiksa" | KEU-57 |
| Nama supplier yang sama ditulis dua kali | Nama mirip ditampilkan; dua supplier digabung | KEU-57 |
| Nota dari kasir berubah atau hilang | Ditandai dengan nilai sebelum dan sesudah | KEU-58 |
| Nota masuk dua kali | Tanda "mungkin kembar" | KEU-59 |
| Sisa utang versi kasir dan HRIS berbeda | Ditandai "perlu ditelusuri"; tidak ada yang menimpa | KEU-60 |
| Ibu membayar supplier dan hanya mencatat di kasir | Muncul di daftar "dibayar menurut kasir, belum ada di Buku Kas" | KEU-60 |
| Bayar satu transfer untuk banyak nota | Satu baris dengan rincian nota | KEU-61 |
| Sudah bayar, notanya belum masuk dari kasir | "Belum dipasangkan" dengan umurnya | KEU-62 |
| Bayar supplier kelebihan | Titipan di supplier, dipakai nota berikutnya | KEU-64 |
| Barang dikembalikan ke supplier | Dicatat dengan nilai; mengurangi utang setelah disahkan | KEU-65 |
| Barang rusak tidak bisa dikembalikan | Barang reject; tampil sebagai kerugian | KEU-65 |
| Supplier memberi cashback | Potongan dari supplier: uang, potong nota, atau barang | KEU-66 |
| Rekening Raja dipakai membayar supplier Gudang | Satu baris; otomatis tercatat Raja membayar Gudang | KEU-70 |
| Toko menyetor lebih besar dari utangnya ke Gudang | Kelebihannya deposit toko di Gudang | KEU-69 |
| Gaji karyawan toko dibayar dari Brankas | Menambah utang toko itu ke Gudang | KEU-69 |
| Mantan karyawan mencicil utangnya | Uang masuk di Buku Piutang Lain | KEU-74 |
| Tarif sewa naik | Baris tarif baru bertanggal; riwayatnya terlihat | KEU-77 |
| Tagihan bulan ini belum dibayar, atau baru dibayar sebagian | Tampil sebagai tagihan belum dibayar dengan umurnya | KEU-75 |
| Sewa dibayar setahun sekaligus | Satu uang keluar, dibagi ke 12 bulan | KEU-79 |
| Mesin tagihan tidak jalan satu bulan | Dikejar saat jalan lagi; ditandai untuk GM | KEU-78 |
| Kontrak tempat hampir habis | Pengingat 90, 60, dan 30 hari | KEU-85 |
| Cicilan mobil box dibayar dari uang usaha | Bukan biaya cabang; mengurangi Buku Ibu | KEU-76, 82 |
| Beli kulkas untuk toko | Menjadi aset; biayanya dibagi selama umur pakai | KEU-86 |
| Aset rusak, hilang, atau dijual | Sisa nilainya menjadi kerugian bulan itu, dikurangi hasil jual | KEU-86 |
| Barang tidak ketemu saat Cek Aset | Ditandai; pemilik memutuskan dipindah atau hilang | KEU-86 |
| Data kasir bulan ini belum masuk | Laba bertanda "belum lengkap" | KEU-111 |
| Baris bulan lalu baru dibetulkan sekarang | Bulan tertutup tidak berubah; koreksi di bulan berjalan | KEU-112 |
| Lupa menutup bulan | Muncul di "perlu perhatian" tanggal 10 | KEU-112 |
| Ingin tahu cukup tidak untuk gajian | Perkiraan Kas 4 minggu dan batas aman | KEU-101, 102 |
| Ingin belanja besar ke supplier | Kemampuan Belanja dan simulasi | KEU-104, 105 |
| Pembayaran supplier akan menembus batas merah | Jendela "Tetap bayar" atau "Kurangi"; GM diberi tahu | KEU-106 |
| Harta turun tanpa sebab yang jelas | Cek Modal menyebut berapa, di mana, dan di antara dua hitungan yang mana | KEU-92, 96 |
| Ingin tahu saldo pada satu tanggal | Posisi Kas pada tanggal mana pun | KEU-99 |

## 6. Masih terbuka

Sebelas butir penetapan (6E.1 arsip) sudah dijawab pemilik 12 Oktober 2026;
jawabannya di 6E.2 arsip.

Tidak menghambat bab berikutnya, tetapi harus diputuskan sebelum spec modul ini
ditulis (Tahap 4):

1. ~~Cicilan apa saja dan tanggungan siapa~~: **dijawab pemilik 12 Oktober
   2026**. Cicilan yang ada adalah cicilan mobil box, dan yang menanggung
   Ibu (KEU-76, KEU-82). Butir ini selesai.
2. **Laporan pajak, dan laporan untuk akuntan dan bank** (KEU-116): belum
   ada. Keputusan pemilik (12 Oktober 2026): disimpan untuk dibahas nanti,
   dengan pajak dicatat khusus sebagai persiapan, di
   `../work/backlog/2026-10-12-laporan-pajak.md`. Jangan ditanyakan lagi
   sampai pemilik membukanya.
3. **Tanggal "hari mulai"** (KEU-08): pemilik belum tahu (12 Oktober 2026);
   ditentukan saat menyiapkan tayang.
4. **Kapan sambungan ke sistem kasir dinyalakan** dan bentuk file tarikannya
   untuk: Laporan Kasir (KEU-47), nota belanja dan utang supplier (KEU-58,
   60), omzet dan harga pokok (KEU-72), nilai stok dan barang reject (KEU-65,
   97). Bersama keputusan Tarik Data Kasir di buku lain (LOG bagian 6 butir
   4, DRV bagian 6 butir 10 dan 12).
5. **Isi awal yang diisi saat menyiapkan tayang**: daftar rekening dan metode
   non-tunai tiap cabang (KEU-43), tarif sewa tiap aset Owner dan nilai
   kontraknya (KEU-80, 81), utang awal tiap supplier (KEU-67).
6. **Tabungan loyalitas** di laporan (KEU-90, KEU-100): baru dihitung kalau
   jenis itu dinyalakan (GAJ-31).

## 7. Titipan dan catatan

Untuk Bab 1 (Karyawan):

1. Orang kantor (GM, finance, Marketing, HR) dibebankan ke Gudang di laporan
   (KEU-114); cabang "Back Office" hanya sebutan. Penggabungan cabang untuk
   laporan menjadi satu isian di pengaturan cabang.
2. "Logistik" tidak dibuat sebagai cabang di v3 (KEU-82).
3. Daftar hak akses (KAR-58) memuat KEU-118; kepala cabang mendapat Cek Aset
   tanpa nilai.

Untuk Bab 2 (Kehadiran):

4. Jadwal libur finance dibaca untuk menghitung batas waktu (KEU-56); shift
   cabang dan hari tutup dibaca Laporan Kasir (KEU-40, KEU-42).

Untuk Bab 3 (Gaji):

5. GAJ-20 dilapisi KEU-55 (satu kasir satu tanggung jawab). Cara bayar gaji
   (GAJ bagian 6 butir 2) terjawab di KEU-24. Baris "Gaji pemilik dan GM"
   (KAR-59) di KEU-114.

Untuk Bab 4 (Logistik):

6. "Cash masuk kas tunai" di LOG-62 berarti masuk Brankas atau Setoran di
   Finance (KEU-71). Bensin (LOG-83) melahirkan satu baris uang keluar
   (KEU-26). Kendaraan di Daftar Aset adalah kendaraan Logistik (KEU-80), dan
   hari kendaraan berangkat dibaca Tagihan Rutin (KEU-76).

Untuk Bab 5 (Gaji Driver, Bongkaran, Kasbon):

7. Daftar supplier milik Keuangan (KEU-57); DRV-41 dan butir terbuka nomor 11
   buku itu terjawab. Cara bayar slip mingguan (butir terbuka nomor 13)
   mengikuti KEU-24. Bentuk catatan keuangan bongkaran, kasbon, dan bantuan
   (titipan butir 5 dan 6) di KEU-25.

Untuk modul Tarik Data Kasir:

8. Yang harus bisa ditarik, semuanya per cabang dan **per tanggal**: omzet
   dan harga pokok per hari; settlement per shift (cash, non-tunai, piutang)
   dan uraian QRIS per transaksi; nota belanja per supplier (tanggal, total,
   cabang) dan nama supplier di kasir; sisa utang supplier versi kasir dan
   pembayaran supplier yang tercatat di kasir; penjualan Gudang ke cabang
   sendiri; nilai stok dengan harga beli, barang yang tidak terjual lebih
   dari 90 hari, nilai barang reject, dan tanggal stok opname terakhir;
   piutang toko beserta umur dan tanggal jatuh temponya.
9. ~~Arah sebaliknya (HRIS mengirim ke kasir): pembayaran toko kepada Gudang
   (KEU-69) dan titipan pelunasan (KEU-46), bersama daftar di LOG-65.~~
   Ditiadakan 13 Oktober 2026 (PRI-39 butir 1): dicatat tangan di kasir.

Untuk Tahap 3 dan 4:

10. Layar Kesehatan Mesin dan satu menu Pengaturan lintas modul (PRI-32,
    PRI-33, KEU-121). Satu daftar "perlu perhatian" untuk GM yang mengumpulkan
    semua tanda di buku ini.
11. Bagian 5 dijadikan daftar tes (PRI-06). Wajib dites (WAJ-06): saldo tiap
    tempat uang dan Pindah Dana (KEU-04, 07), penjaga dobel catat (KEU-18),
    uang yang harus disetor dan selisih kasir (KEU-41, 54), sisa utang
    supplier (KEU-60), buku toko dengan Gudang (KEU-69, 70), Tagihan Rutin
    yang dikejar tanpa dobel (KEU-78), pembagian bayar di muka dan aset
    (KEU-79, 86), Buku Ibu (KEU-82), hitungan laba dan yang bukan biaya
    (KEU-22, 108), pembebanan gaji ke bulan kalender (KEU-109), harta bersih
    (KEU-88 s.d. 92), Perkiraan Kas dan Kemampuan Belanja (KEU-101, 104).
12. Mesin pengaman hak akses wajib mencoba KEU-118 dan KEU-120: HR dan
    kepala cabang tidak bisa membuka laporan, finance tidak bisa melihat
    Kemampuan Belanja dan Buku Ibu, kasir tidak bisa mencatat "Pribadi",
    tidak ada yang memeriksa isiannya sendiri, tidak ada yang mengubah baris
    yang sudah diperiksa.
13. Pemberitahuan dan ringkasan pagi lewat aplikasi (PRI-25).
14. Layar Catatan Cepat dan Keuangan Hari Ini dirancang paling dulu dan diuji
    langsung dengan pemilik uang: bahasa sehari-hari, angka besar, tanpa
    pilihan bertingkat (KEU-28, 29).

Untuk keputusan data lama (WIP, keputusan terbuka 3):

15. Saldo tidak dipindah dari sistem lama; dimulai dari hitung fisik (KEU-08).
16. Tidak dipindahkan: cabang "Logistik" dan baris sewa otomatisnya; nota
    "Gudang" dan "Hammielion" (Rp395 juta) sebagai utang supplier.
17. Dipastikan dulu sebelum dipakai sebagai pembanding: 9 baris gaji ketikan
    tangan (Rp26.040.000) yang mungkin dobel; 10 baris Kas Masuk tanpa
    rekening (Rp5,6 miliar); sewa Raja yang terhitung dua kali. Kekurangan
    kas lama yang tidak terpotong (Rp1,39 juta) tidak dikejar kecuali diminta.

    Butir 15–17 **terjawab** (13 Oktober 2026) di `00-gambaran-sistem.md`:
    SIS-29 dan SIS-30.

## 8. Istilah

Dimasukkan ke `00-kamus-istilah.md`: Buku Kas, tempat uang, Brankas, Kas
Pegangan, Setoran di Finance, Laci, Pindah Dana, Catatan Cepat, kejadian,
Belum dipilah, Pribadi, struk menyusul, Hitung Kas, Laporan Kasir, setoran,
kelebihan kas, titipan pelunasan, hak lapor sementara, utang supplier, belum
dipasangkan, nama lain supplier, potongan dari supplier, barang reject, buku
toko dengan Gudang, deposit toko di Gudang, Piutang Lain, Tagihan Rutin, aset
Owner, hak sewa, Buku Ibu, Cek Aset, Cek Modal, harta bersih, Posisi Kas, uang
bebas dipakai, Perkiraan Kas, batas aman kas, Kemampuan Belanja, Rencana
Pengeluaran Besar, tutup bulan, Kesehatan Mesin.
