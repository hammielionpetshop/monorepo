# Spec Siap Bangun: Logistik (Tahap 4F)

Tanggal: 13 Oktober 2026 (malam)
Status per bagian:

| Bagian | Isi | Status |
|---|---|---|
| **4F-1** | Toko, Mobil dan Rute, Surat Jalan dan Nota | **Disetujui penuh 14 Oktober 2026** (F1 s.d. F6 sesuai saran, LOG-90 s.d. 97, 11 layar LOG-L01 s.d. L11) |
| **4F-2** | Rencana dan Trip Truk | **Disetujui penuh 14 Oktober 2026** (R1 s.d. R5 sesuai saran, LOG-98 s.d. 104, 13 layar LOG-L12 s.d. L24) |
| **4F-3** | Laporan Muat Cabang, Paket, dan Antar Sendiri | **Disetujui penuh 14 Oktober 2026** (M1 s.d. M6 sesuai saran, LOG-105 s.d. 111, 13 layar LOG-L25 s.d. L37) |
| **4F-4a** | Kirim dan Uang: layar Kirim, cara bayar, pembagian ke nota, potong nota, barang kejadian, barang kembali | **Disetujui penuh 14 Oktober 2026** (K1 s.d. K6 sesuai saran, LOG-112 s.d. 118, 9 layar LOG-L38 s.d. L46) |
| **4F-4b** | Tidak Terkirim dan Retur: Kirim Besok, Gagal, Perlu keputusan, tertunda, retur, tinjau barang tidak sesuai | **Disetujui penuh 14 Oktober 2026** (T1 s.d. T7 sesuai saran, LOG-119 s.d. 126, 11 layar LOG-L47 s.d. L57) |
| **4F-5a** | Pemeriksaan Uang: tunai truk, tunai antar sendiri, transfer, deposit, selisih tunai, Kas Masuk, batal pemeriksaan | **Disetujui penuh 14 Oktober 2026** (V1 s.d. V5 sesuai saran, LOG-127 s.d. 132, 6 layar LOG-L58 s.d. L63) |
| **4F-5b** | Kiriman ke Kasir dan Daftar Tagih: Catat di Kasir, tanda tercatat dan kunci nota, koreksi, pencocokan piutang, Daftar Tagih, catatan tagih | **Disetujui penuh 14 Oktober 2026** (D1 s.d. D7 sesuai saran, LOG-133 s.d. 139, 7 layar LOG-L64 s.d. L70) |
| **4F-5c** | Dashboard, Laporan, Bensin: Dashboard Logistik, tinjau kirim di luar titik, permintaan bensin, catatan bensin, Laporan Logistik | **Disetujui penuh 14 Oktober 2026** (B1 s.d. B6 sesuai saran, LOG-140 s.d. 145, 7 layar LOG-L71 s.d. L77) |

**Pembagian lima bagian disetujui pemilik 14 Oktober 2026 (F1).** Logistik
ukuran **besar**: 89 aturan LOG, dua jenis perjalanan, dan sambungan ke
Kehadiran, Gaji, Gaji Driver, Keuangan, dan Tarik Data Kasir. Pembagian di
atas mengikuti urutan kejadian sehari-hari: data yang dipakai (4F-1),
truk berangkat sampai pulang (4F-2), kiriman cabang (4F-3), yang terjadi di
toko (4F-4), lalu uang diperiksa dan dilaporkan (4F-5).

**Ditulis saat pemilik tidur** (13 Oktober 2026 malam) atas permintaannya
("langsung kerjakan 2-3 sesi secara berurutan"), memakai saran Claude;
dijawab pemilik 14 Oktober 2026 "ok" (sesuai saran).

Spec ini satu file untuk seluruh 4F. Tiap bagian **menambah baris** ke tabel
di bagian 2, 4 s.d. 13 dan memberi tanda bagiannya di kolom "Bagian".

Bahan 4F-1: `../../aturan/04-logistik.md` (LOG-01, 03 s.d. 14, 17, 18, 84 s.d.
86, 88), `../../aturan/arsip/04-logistik-galian.md`; PRI-02, 10, 14, 21, 31,
32, 39, 41; KAR-05, 25, 27, 58, 82; KEH-12; DRV-08, 11; KEU-69, 71;
`2026-10-13-tarik-data-kasir-spec.md` (TDK-L04 s.d. L07); KAR-L30 (titik
cabang); `2026-10-13-menu-desain.md`.

Bentuk spec mengikuti bagian 0 `2026-10-13-karyawan-dan-akses-spec.md`. Kode
layar memakai awalan **LOG-L**. Tampilan disusun dari komponen baku
(`../desain/README.md`); tidak digambar.

Di spec ini "pemilik" dalam urusan hak berarti jabatan Pemilik dan **GM**
(LOG-84, KAR-67).

---

## 1. Batas

**Dikerjakan di 4F-1:** data pengiriman toko (tambahan HRIS atas pelanggan
kasir), tambah toko dengan satu aturan, nonaktif dan gabung toko, titik
lokasi toko dan persetujuannya, rute bawaan, mobil dan rute (jenis antar dan
belanja), surat jalan (catat manual, lahir dari kasir, ubah, batal), daftar
nota satu tabel untuk nota gudang dan nota cabang beserta cabang pemilik
nota, dan cara surat jalan manual dicocokkan dengan kasir.

**Tidak dikerjakan di 4F-1:**

| Hal | Di mana |
|---|---|
| Rencana, trip, kunjungan, ritase, upah belanja, lapor garasi | 4F-2 |
| Laporan muat cabang, paket, nota cabang (cara isi), antar sendiri | 4F-3 (spec ini hanya menyediakan tabel nota dan "tambah toko cepat") |
| Uang di toko, bagian uang per nota, potong nota, barang kejadian, Kirim Besok, Gagal, Perlu keputusan, tertunda, retur | 4F-4 |
| Pemeriksaan uang, Kas Masuk, kiriman ke kasir, tanda "tercatat di kasir" dan koreksinya (LOG-14), daftar tagih, Dashboard, Laporan, bensin | 4F-5 (spec ini hanya menyediakan kolomnya) |
| Tarif ritase dan upah belanja per mobil dan rute | 4G (DRV-08, 11); spec ini hanya menyediakan mobil dan rute |
| Menarik pelanggan dan transaksi kasir, memasangkan nama toko kasir, daftar Perlu Diperiksa | Tarik Data Kasir 4C (TDK-L04 s.d. L07); spec ini membaca hasilnya |
| Titik lokasi cabang dan Gudang | Karyawan (KAR-25, KAR-L30); spec ini memakai komponen pemasang titik yang sama |
| Nama, identitas, penjualan, piutang, dan pelunasan toko | Sistem kasir (LOG-01, 65) |

**Dikerjakan di 4F-2:** rencana kirim (buat, isi surat jalan dan tugas,
Siap Kirim, batal, ganti awak, lepas dan tambah isi), trip dari sisi driver
dan kenek (Trip Saya, Berangkat dengan foto awak, sedang menuju, urutan
bebas, kerangka kunjungan toko, tugas belanja, Selesai lebih awal, bak
kosong, Menuju Garasi, lapor sampai garasi), trip ditutup kantor, tanda trip
belum ditutup, satu trip berjalan per mobil dan per orang, pencatatan
ritase dan upah belanja, ritase tangan, pembatalan ritase, dan pagar uji.

**Tidak dikerjakan di 4F-2:**

| Hal | Di mana |
|---|---|
| Isi layar Kirim di toko (uang, cara bayar, potong nota, barang kejadian), Kirim Besok, Gagal, Perlu keputusan, tertunda, tugas retur dan barang yang diantar ke pemiliknya | 4F-4 (spec ini hanya kerangka kunjungan dan tombolnya) |
| Mengambil paket cabang ke trip (LOG-41), peringatan laporan muat belum Selesai saat Berangkat | 4F-3 (spec ini hanya menyediakan tempat peringatannya) |
| Laporan Pulang (serah terima, keadaan mobil, isian bensin) | Kehadiran 4D-3 (KEH-L20); spec ini memanggilnya saat lapor garasi |
| Absen lewat trip (absen masuk, pulang, Tidak jalan, layar absen trip) | Kehadiran 4D-2c (KEH-96 s.d. 101, 120 s.d. 124); spec ini mengirim kejadiannya |
| Bensin "Sudah Diisi" dan permintaan bensin di Dashboard | 4F-5 (LOG-83) |
| Nominal ritase dan upah belanja, tarif, slip mingguan, upah Rp0 orang bergaji bulanan | 4G (DRV-08 s.d. 17, 84); spec ini hanya mencatat baris ritase |
| Posisi driver di peta | Ditunda (backlog `2026-10-12-posisi-driver-di-peta.md`) |

**Dikerjakan di 4F-3:** laporan muat cabang (buat, foto, paket, Tandai
Selesai, jalur, nota cabang, ongkir dan pengantar sebelum dan sesudah
sambungan menyala, ubah, kembalikan ke Proses, batal), paket masuk trip
(ditugaskan kantor atau diambil driver, ambil per laporan sekaligus),
pengingat dan warna menunggu, perjalanan antar sendiri (tiga foto, lama dan
alasan, alihkan PJ, tutup perjalanan), penulis bonus ongkir dari kasir dan
tanda ⚠.

**Tidak dikerjakan di 4F-3:**

| Hal | Di mana |
|---|---|
| Isi layar Kirim (cara bayar, uang, pembagian ke nota, potong nota, barang kejadian), Kirim Besok, Gagal, Perlu keputusan, tertunda | 4F-4 (spec ini memakai komponennya di Foto 2) |
| Ke mana uang tunai antar sendiri dibawa, pemeriksaan uang, Kas Masuk | 4F-5 |
| Pintu tulis Buku Bonus, nominal, pengesahan, pembatalan bonus ongkir | Gaji 4E-4 (GAJ-L20); spec ini hanya memanggilnya |
| Menarik baris ongkir dan memasangkan nama pengantar | Tarik Data Kasir 4C (TDK-L04, tab Pengantar) |
| Absen masuk dan tombol Pulang | Kehadiran 4D-2 (KEH-L06); spec ini hanya menambah satu syarat Pulang (M6) |
| Antar-jemput kucing | Sistem kasir (LOG-74) |

**Dikerjakan di 4F-4a:** layar Kirim untuk dua jalur, cara bayar (cash,
transfer, deposit, tempo, Campuran), uang diterima, kurang bayar dan
tanggal janji bayar sisa, lebih bayar sebagai titipan toko, rumus pembagian
uang ke nota, potong nota dan keputusannya, barang kejadian, barang kembali
ke pemiliknya (serah dan terima), ubah pembayaran dan kapan terkunci.

**Tidak dikerjakan di 4F-4a:**

| Hal | Di mana |
|---|---|
| Kirim Besok, Gagal, Perlu keputusan, tertunda (termasuk penutup tertunda yang dipanggil Kirim), retur, tinjau "barang tidak sesuai" | 4F-4b (memakai daftar dan layar barang kembali dari 4F-4a) |
| Pemeriksaan uang (Cocok, Tidak Cocok, rekening, tanggal deposit masuk), ke mana uang tunai diserahkan, Kas Masuk, kiriman ke kasir, tanda tercatat di kasir dan koreksinya, daftar tagih | 4F-5 (4F-4a hanya menyediakan pembayaran dan bagian per nota) |
| Piutang, titipan toko, pelunasan di kasir | Sistem kasir (LOG-65); HRIS hanya mengirim daftar |

**Dikerjakan di 4F-4b:** Kirim Besok dan Gagal di kedua jalur, ke mana
barang yang tidak terkirim dibawa, coba lagi di hari yang sama, Perlu
keputusan (jadwal ulang atau batal), satu tempat tertunda, toko yang menolak
sebagian, retur (tandai, tugaskan, ambil di toko, nilai), dan tinjau barang
kembali yang "Tidak sesuai".

**Tidak dikerjakan di 4F-4b:**

| Hal | Di mana |
|---|---|
| Isi daftar kiriman ke kasir (batalkan penjualan, kurangi tagihan karena retur), tanda tercatat di kasir dan koreksinya, Dashboard dan Laporan | 4F-5 (4F-4b hanya menulis baris sumbernya) |
| Siapa menanggung barang yang hilang, potongan gajinya | Gaji 4E-3 (GAJ-75, GAJ-L12); 4F-4b hanya meneruskan bahan |
| Retur penjualan yang dibawa toko sendiri ke cabang, piutang dan titipan toko | Sistem kasir (LOG-65) |
| Retur ke supplier | Keuangan (KEU-60, 64 s.d. 66) |

**Dikerjakan di 4F-5a:** pemeriksaan semua uang selain tempo: serah uang
tunai truk per trip, uang tunai antar sendiri lewat laci cabang asal,
transfer, deposit, selisih uang tunai, baris Kas Masuk per nota, dan
pembatalan pemeriksaan.

**Tidak dikerjakan di 4F-5a:**

| Hal | Di mana |
|---|---|
| Daftar kiriman ke kasir (uang terperiksa, potongan, retur, titipan, janji bayar sisa, batalkan penjualan, koreksi), tanda tercatat di kasir, daftar tagih | 4F-5b (4F-5a hanya menulis hasil pemeriksaan) |
| Dashboard, Laporan Logistik, bensin | 4F-5c |
| Setor dari Setoran di Finance ke Brankas, baris selisih serah di Buku Kas, buku toko dengan Gudang, Laporan Kasir yang membaca uang antar sendiri | Keuangan 4H (KEU-35, 49, 69, 71) |
| Potongan gaji atas kurang serah | Gaji 4E-3 (Potongan Lain, GAJ-80); 4F-5a hanya meneruskan bahan ke HR |

**Dikerjakan di 4F-5b:** daftar Catat di Kasir (ringkasan per nota, titipan
toko, kurangi tagihan karena retur, batalkan penjualan, koreksi, dan baris
dari Keuangan), tanda "sudah tercatat di kasir" dan kunci nota, membatalkan
tanda, koreksi sesudah tercatat, pencocokan dengan piutang kasir, Daftar
Tagih, dan catatan tagih Marketing.

**Tidak dikerjakan di 4F-5b:**

| Hal | Di mana |
|---|---|
| Piutang, jatuh tempo resmi, pelunasan, titipan toko, retur penjualan di kasir | Sistem kasir (LOG-65, 66); HRIS hanya membaca dan mengirim daftar |
| Menarik piutang per nota, unggah file piutang, layar Perlu Diperiksa | Tarik Data Kasir 4C (TDK-L03, L06); 4F-5b menambah satu jenis unggahan dan satu tab |
| Isi baris titipan pelunasan (KEU-46) dan pembayaran toko ke Gudang (KEU-69), buku toko dengan Gudang, pintu tulis Kas Masuk | Keuangan 4H; 4F-5b hanya menyediakan pintu tulis ke Catat di Kasir |
| Dashboard (baris Catat di Kasir yang lewat 2 hari), Laporan Logistik | 4F-5c |
| Potongan gaji atas uang yang hilang | Gaji 4E-3 (GAJ-80) |

**Dikerjakan di 4F-5c:** Dashboard Logistik (isi, susunan, siapa melihat
bagian mana, cara membaca), tinjau kiriman di luar titik toko, permintaan
bensin dan penutupnya, catatan bensin "Sudah Diisi" beserta asal uangnya,
pembatalan catatan bensin, dan Laporan Logistik (periode, dasar tanggal,
isi, unduh Excel).

**Tidak dikerjakan di 4F-5c:**

| Hal | Di mana |
|---|---|
| Isian bensin di Laporan Pulang ("Perlu isi bensin besok?" dan perkiraannya) | Kehadiran 4D-3 (KEH-L20); 4F-5c hanya menerima permintaannya |
| Baris uang keluar bensin di Buku Kas, uang yang diberikan dulu ("struk menyusul"), pemasangan dengan Catatan Cepat, pemeriksaan barisnya | Keuangan 4H (KEU-18, 26); 4F-5c hanya memanggil pintu tulisnya |
| Keadaan mobil dan tindak lanjutnya | Kehadiran 4D-3 (KEH-L25); Dashboard hanya menampilkan jumlahnya |
| Piutang toko dan tagihan lewat jatuh tempo | Daftar Tagih 4F-5b (LOG-L68); tidak di Dashboard dan Laporan (LOG-81) |
| Upah ritase dan upah belanja dalam rupiah | 4G; Laporan hanya menghitung banyaknya ritase |
| Omzet resmi, laba per cabang, Kas Masuk per tanggal uang | Keuangan 4H (Keuangan Hari Ini, KEU-98) |

---

## 2. Daftar layar

Ukuran utama: **HP** = terutama handphone, **PC** = terutama PC.

| Kode | Layar | Letak di menu | Dipakai | Ukuran utama | Bagian |
|---|---|---|---|---|---|
| LOG-L01 | Data Toko | Logistik › Data Toko | Marketing, Kepala Gudang, Pemilik, GM; Finance melihat | PC | 4F-1 |
| LOG-L02 | Toko (rincian) | dari LOG-L01 | sama | PC (terbaca di HP) | 4F-1 |
| LOG-L03 | Tambah Toko (3 langkah) | dari LOG-L01; "tambah cepat" dari LOG-L09 dan laporan muat (4F-3) | Marketing, Kepala Gudang, Pemilik, GM; staf cabang lewat tambah cepat (F2) | PC dan HP | 4F-1 |
| LOG-L04 | Gabungkan Toko (3 langkah) | dari LOG-L02 | Kepala Gudang, Marketing, Pemilik, GM (F6) | PC | 4F-1 |
| LOG-L05 | Pasang Titik Toko | dari kunjungan di trip (4F-2), perjalanan antar sendiri (4F-3), dan LOG-L02 | Driver, kenek, pengantar antar sendiri (F3); Kepala Gudang dan pemilik | HP | 4F-1 |
| LOG-L06 | Titik Toko Menunggu | Logistik › Data Toko, tab "Titik menunggu"; dan baris Dashboard (4F-5) | Kepala Gudang, Pemilik, GM | PC dan HP | 4F-1 |
| LOG-L07 | Mobil & Rute | Pengaturan › Logistik | Kepala Gudang, Pemilik, GM mengubah; Finance melihat | PC | 4F-1 |
| LOG-L08 | Surat Jalan | Logistik › Surat Jalan | Marketing, Kepala Gudang, Pemilik, GM; Finance melihat | PC | 4F-1 |
| LOG-L09 | Catat Surat Jalan (3 langkah) | dari LOG-L08 | Marketing, Kepala Gudang, Pemilik, GM | PC | 4F-1 |
| LOG-L10 | Surat Jalan (rincian) | dari LOG-L08 dan LOG-L02 | sama | PC | 4F-1 |
| LOG-L11 | Ubah Surat Jalan (3 langkah) | dari LOG-L10 | Pencatat sebelum berangkat; Pemilik, GM sesudahnya (LOG-11) | PC | 4F-1 |
| LOG-L12 | Rencana & Trip | Logistik › Rencana & Trip | Kepala Gudang, Pemilik, GM; Marketing dan Finance melihat | PC (terbaca di HP) | 4F-2 |
| LOG-L13 | Buat Rencana (4 langkah) | dari LOG-L12 | Kepala Gudang, Pemilik, GM | PC | 4F-2 |
| LOG-L14 | Rencana / Trip (rincian kantor) | dari LOG-L12 | sama dengan LOG-L12 | PC dan HP | 4F-2 |
| LOG-L15 | Ganti Awak (3 langkah) | dari LOG-L14 | Kepala Gudang, Pemilik, GM | PC dan HP | 4F-2 |
| LOG-L16 | Trip Saya | Kerja Harian › Trip Saya; tombol utama bilah bawah driver dan kenek (menu M3) | Driver, kenek di trip itu | HP | 4F-2 |
| LOG-L17 | Berangkat (2 langkah) | dari LOG-L16 | Driver atau kenek di trip itu | HP | 4F-2 |
| LOG-L18 | Kunjungan Toko (kerangka) | dari LOG-L16 | Driver, kenek di trip itu | HP | 4F-2 (isi Kirim, Kirim Besok, Gagal: 4F-4) |
| LOG-L19 | Tugas Belanja | dari LOG-L16 | Driver, kenek di trip itu | HP | 4F-2 |
| LOG-L20 | Selesai Lebih Awal (2 langkah) | dari LOG-L16 | Driver, kenek di trip itu | HP | 4F-2 |
| LOG-L21 | Pulang ke Garasi (bak kosong, lapor garasi) | dari LOG-L16 | Driver, kenek di trip itu | HP | 4F-2 |
| LOG-L22 | Tutup Trip oleh Kantor (3 langkah) | dari LOG-L14 | Kepala Gudang, Pemilik, GM | PC dan HP | 4F-2 |
| LOG-L23 | Ritase Tangan (3 langkah) | dari LOG-L24 | Pemilik, GM | PC | 4F-2 |
| LOG-L24 | Ritase & Upah Belanja | Logistik › Rencana & Trip, tab "Ritase" | Kepala Gudang, Pemilik, GM; HR melihat lewat 4G | PC | 4F-2 |
| LOG-L25 | Laporan Muat | Kerja Harian › Laporan Muat | Staf cabang (cabangnya), Pemilik, GM; Kepala Gudang, Marketing, Finance melihat | HP (terbaca di PC) | 4F-3 |
| LOG-L26 | Buat Laporan Muat (3 langkah) | dari LOG-L25 | Staf cabang, Pemilik, GM | HP | 4F-3 |
| LOG-L27 | Laporan Muat (rincian) | dari LOG-L25, LOG-L14, LOG-L30 | sama dengan LOG-L25 | HP | 4F-3 |
| LOG-L28 | Tandai Selesai (3 langkah) | dari LOG-L27 | Staf cabang asal, Pemilik, GM | HP | 4F-3 |
| LOG-L29 | Ubah Laporan Muat (3 langkah) | dari LOG-L27 | Staf cabang asal sebelum berangkat; Pemilik, GM sesudahnya | HP | 4F-3 |
| LOG-L30 | Jemput Paket Cabang | pengingat dan tombol di LOG-L16 | Driver, kenek trip Siap Kirim atau Berjalan | HP | 4F-3 |
| LOG-L31 | Antar Sendiri | Kerja Harian › Antar Sendiri | Pengantar; staf cabang dan Kepala Toko melihat cabangnya; Pemilik, GM | HP | 4F-3 |
| LOG-L32 | Mulai Antar (Foto 1, 2 langkah) | dari LOG-L31 | Pengantar yang ditunjuk | HP | 4F-3 |
| LOG-L33 | Sampai di Tujuan (Foto 2) | dari LOG-L31 | PJ | HP | 4F-3 (isi Kirim, Kirim Besok, Gagal: 4F-4) |
| LOG-L34 | Kembali (Foto 3, 2 langkah) | dari LOG-L31 | PJ | HP | 4F-3 |
| LOG-L35 | Alihkan PJ (2 langkah) | dari LOG-L31 | Staf cabang asal, Kepala Toko, Pemilik, GM | HP | 4F-3 |
| LOG-L36 | Tutup Perjalanan (3 langkah) | dari LOG-L31, LOG-L37 | Kepala Toko cabang itu, Kepala Gudang, Pemilik, GM | HP dan PC | 4F-3 |
| LOG-L37 | Perjalanan Antar Sendiri (rincian) | dari LOG-L31 dan Dashboard (4F-5) | Staf cabang asal, Kepala Toko, Kepala Gudang, Marketing, Finance, Pemilik, GM | HP dan PC | 4F-3 |
| LOG-L38 | Kirim (4 langkah) | Kirim di LOG-L18; Terkirim di LOG-L33 | Awak pemegang kunjungan; PJ antar sendiri | HP | 4F-4a |
| LOG-L39 | Potong Nota (isian) | langkah 2 LOG-L38; LOG-L41 | sama | HP | 4F-4a |
| LOG-L40 | Barang Kejadian (isian) | langkah 2 LOG-L38; LOG-L41 | sama | HP | 4F-4a |
| LOG-L41 | Ubah Pembayaran (3 langkah) | dari LOG-L14, L18, L37 | Menurut tabel "Mengubah pembayaran" (K4) | HP dan PC | 4F-4a |
| LOG-L42 | Potong Nota Menunggu | Logistik › Potong Nota | Finance, Pemilik, GM memutuskan; Kepala Gudang, Marketing melihat | PC (terbaca di HP) | 4F-4a |
| LOG-L43 | Putuskan Potong Nota (2 langkah) | dari LOG-L42 | Finance, Pemilik, GM | PC dan HP | 4F-4a |
| LOG-L44 | Barang Kembali | Kerja Harian › Barang Kembali; dari LOG-L16, L21 | Awak (barang di trip-nya), staf cabang pemilik, Kepala Gudang, Pemilik, GM | HP (terbaca di PC) | 4F-4a (retur: 4F-4b) |
| LOG-L45 | Serahkan Barang (2 langkah) | dari LOG-L44; langkah lapor garasi LOG-L21 untuk barang Gudang | Awak trip | HP | 4F-4a |
| LOG-L46 | Terima Barang (2 langkah) | dari LOG-L44 | Staf cabang pemilik, Kepala Gudang (barang Gudang), Pemilik, GM | HP | 4F-4a |
| LOG-L47 | Kirim Besok (2 langkah) | Kirim Besok di LOG-L18 dan LOG-L33 | Awak pemegang kunjungan; PJ antar sendiri | HP | 4F-4b |
| LOG-L48 | Gagal (2 langkah) | Gagal di LOG-L18 dan LOG-L33 | sama | HP | 4F-4b |
| LOG-L49 | Tertunda | Logistik › Tertunda; tab "Tertunda" di LOG-L25 untuk cabang | Kepala Gudang, Pemilik, GM; Marketing, Finance melihat; staf cabang melihat laporan muat cabangnya | PC (terbaca di HP) | 4F-4b |
| LOG-L50 | Putuskan Kiriman Gagal (2 langkah) | dari LOG-L49, LOG-L10, LOG-L27 | Surat jalan: Kepala Gudang, Pemilik, GM. Laporan muat: staf cabang asal, Kepala Toko cabang asal, Kepala Gudang, Pemilik, GM | PC dan HP | 4F-4b |
| LOG-L51 | Tutup Tertunda (2 langkah) | dari LOG-L49 | Kepala Gudang, Pemilik, GM | PC dan HP | 4F-4b |
| LOG-L52 | Retur | Logistik › Retur | Kepala Gudang, Marketing, Finance, Pemilik, GM | PC (terbaca di HP) | 4F-4b |
| LOG-L53 | Tandai Retur (2 langkah) | dari LOG-L52, LOG-L02; dari LOG-L14 untuk trip Berjalan | Kepala Gudang, Marketing, Finance, Pemilik, GM | PC dan HP | 4F-4b |
| LOG-L54 | Retur (rincian) | dari LOG-L52, LOG-L44 | sama dengan LOG-L52; cabang penerima dan pemilik barang melihat | PC dan HP | 4F-4b |
| LOG-L55 | Ambil Retur | tugas retur di LOG-L16 | Awak trip itu | HP | 4F-4b |
| LOG-L56 | Nilai Retur (2 langkah) | dari LOG-L52 tab Menunggu nilai | Finance, Pemilik, GM | PC | 4F-4b |
| LOG-L57 | Tinjau Barang Tidak Sesuai (2 langkah) | dari LOG-L44 tab Tidak sesuai | Kepala Gudang, Pemilik, GM (bukan penyerah atau penerima) | PC dan HP | 4F-4b |
| LOG-L58 | Pemeriksaan Uang Pengiriman | Logistik › Pemeriksaan Uang Pengiriman | Finance, Pemilik, GM; Kepala Gudang melihat tab Tunai trip | PC (terbaca di HP) | 4F-5a |
| LOG-L59 | Terima Uang Tunai (3 langkah) | dari LOG-L58; Antrean penerima di cabang (antar sendiri) | Truk: Finance, pemegang Brankas. Antar sendiri: karyawan cabang asal yang bertugas (bukan PJ), Kepala Toko, Pemilik, GM | PC dan HP | 4F-5a |
| LOG-L60 | Periksa Transfer (2 langkah) | dari LOG-L58 | Finance, Pemilik, GM | PC | 4F-5a |
| LOG-L61 | Periksa Deposit (2 langkah) | dari LOG-L58 | Finance, Pemilik, GM | PC | 4F-5a |
| LOG-L62 | Pemeriksaan (rincian) | dari LOG-L58, LOG-L14, LOG-L37 | Finance, Pemilik, GM; Kepala Gudang melihat | PC dan HP | 4F-5a |
| LOG-L63 | Batalkan Pemeriksaan (2 langkah) | dari LOG-L62 | Finance pemeriksanya (7 hari), Pemilik, GM | PC | 4F-5a |
| LOG-L64 | Catat di Kasir | Logistik › Catat di Kasir | Finance, Pemilik, GM; Marketing melihat tab Menunggu dicatat | PC | 4F-5b |
| LOG-L65 | Tandai Tercatat (2 langkah) | dari LOG-L64 | Finance, Pemilik, GM | PC | 4F-5b |
| LOG-L66 | Batalkan Tanda Tercatat (2 langkah) | dari LOG-L64 tab Tercatat | Penanda (24 jam), Pemilik, GM | PC | 4F-5b |
| LOG-L67 | Koreksi Nota (3 langkah) | dari LOG-L64, LOG-L62, LOG-L54 | Finance, Pemilik, GM | PC | 4F-5b |
| LOG-L68 | Daftar Tagih | Logistik › Daftar Tagih | Marketing, Finance, Pemilik, GM | PC (terbaca di HP) | 4F-5b |
| LOG-L69 | Tagihan Toko (rincian) | dari LOG-L68, LOG-L02 | sama dengan LOG-L68 | PC dan HP | 4F-5b |
| LOG-L70 | Catat Hasil Tagih (2 langkah) | dari LOG-L69 | Marketing, Finance, Pemilik, GM | PC dan HP | 4F-5b |
| LOG-L71 | Dashboard Logistik | Logistik › Dashboard Logistik (butir pertama menu Logistik) | Pemilik, GM, Kepala Gudang; Marketing tanpa bagian Mobil dan bensin; Finance bagian Uang serta Mobil dan bensin (B1) | PC dan HP | 4F-5c |
| LOG-L72 | Bensin | Logistik › Bensin; baris Dashboard | Kepala Gudang, Finance, Pemilik, GM | PC dan HP | 4F-5c |
| LOG-L73 | Sudah Diisi (3 langkah) | dari LOG-L72 dan LOG-L71; "Catat bensin" tanpa permintaan dari LOG-L72 | Kepala Gudang, Finance, Pemilik, GM | HP dan PC | 4F-5c |
| LOG-L74 | Tidak Jadi Isi Bensin (2 langkah) | dari LOG-L72 dan LOG-L71 | sama | HP dan PC | 4F-5c |
| LOG-L75 | Batalkan Catatan Bensin (2 langkah) | dari LOG-L72 tab Catatan bensin | Pencatat selama barisnya belum diperiksa; Pemilik, GM | PC | 4F-5c |
| LOG-L76 | Tinjau Kirim di Luar Titik (2 langkah) | dari LOG-L71 | Kepala Gudang, Pemilik, GM (bukan awak atau PJ perjalanan itu) | PC dan HP | 4F-5c |
| LOG-L77 | Laporan Logistik | Logistik › Laporan Logistik | Pemilik, GM, Kepala Gudang, Finance; Marketing tanpa bensin | PC | 4F-5c |

---

## 3. Rincian layar

Aturan untuk semua layar di bawah, tidak diulang per layar: error di jendela
"OK, paham" (TAM-01 s.d. 06); tombol menyimpan terkunci sampai selesai
(TAM-13); isian tidak hilang kalau sinyal putus (TAM-16); pesan berhasil
menyebut apa yang tersimpan dan siapa bertindak berikutnya (TAM-17); daftar
dibagi per halaman dan bisa dicari (PRI-10); rupiah berpemisah ribuan
(TAM-10); semua jam dan tanggal dari server (PRI-01); tidak ada yang dihapus
(PRI-02, LOG-86).

### 3.1 Bagian 4F-1: Toko, Mobil dan Rute, Surat Jalan dan Nota

**Disetujui penuh 14 Oktober 2026** (F1 s.d. F6 "ok", sesuai saran; bagian
13; aturan LOG-90 s.d. 97 di bagian 3.18 `../../aturan/04-logistik.md`).

**Pokoknya:** semua kiriman berangkat dari dua daftar: **toko** (ke mana) dan
**nota** (apa yang dibawa dan berapa nilainya). Toko dan penjualan milik
sistem kasir (LOG-01); HRIS hanya menambahkan yang dibutuhkan untuk
mengantar: alamat, titik, nomor HP, rute bawaan. Sebelum sambungan kasir
menyala, keduanya diketik di HRIS dengan kunci yang sama dengan kasir (kode
pelanggan, nomor struk + cabang), supaya saat menyala tinggal dicocokkan
(PRI-41 butir 3).

#### Dua keadaan: sebelum dan sesudah sambungan menyala (F2, F4)

Sambungan dinyalakan per jenis data (PRI-39, TDK-L01). Untuk 4F-1 yang
menentukan adalah jenis **pelanggan** (toko) dan **transaksi** (surat jalan).

| | Sebelum menyala | Sesudah menyala |
|---|---|---|
| **Toko baru** | Diketik di HRIS (LOG-L03), sumber "diketik", kode kasir boleh kosong | **Lahir dari pelanggan kasir** (tiap 1 menit, PRI-39). Di HRIS hanya ditambah data pengiriman. Tombol "Tambah toko" diganti "Toko baru? Buat pelanggannya di kasir dulu, lalu muncul di sini dalam 1 menit" (F2) |
| **Toko lama yang diketik** | — | Dipasangkan ke pelanggan kasir oleh Finance di TDK-L04 tab Toko; yang belum dipasangkan tampil bertanda "belum ada di kasir" (LOG-01) |
| **Surat jalan** | Diketik di HRIS (LOG-L09), wajib nomor struk kasir + cabang Gudang (PRI-41 butir 3) | **Lahir dari transaksi kasir** cabang berjenis Gudang ke pelanggan yang dipasangkan ke toko (F4). Catat manual tetap ada sebagai cadangan saat kasir mati (TDK kejadian 11) |
| **Nominal surat jalan** | Diketik, lebih dari 0, rupiah bulat | Dari kasir; tidak bisa diketik di HRIS (F5) |

#### Toko dan data pengiriman (LOG-01, 03, 04, 06, 07)

- Satu catatan **toko** per toko pelanggan. Isinya milik dua tempat: nama dan
  kode milik kasir (dibaca); **alamat, nomor HP, rute bawaan, titik, dan
  catatan pengiriman** milik HRIS.
- **Satu aturan tambah toko** (LOG-03) dipakai semua jalan masuk (LOG-L03,
  tambah cepat dari surat jalan, tambah cepat dari laporan muat): nama paling
  sedikit 3 huruf, alamat paling sedikit 5 huruf; nama yang sama dengan toko
  lain, termasuk nonaktif, ditolak dengan menyebut toko yang sudah ada
  ("Toko Sumber Rejeki sudah ada (nonaktif). Aktifkan lagi?"). Pembanding
  nama: huruf besar-kecil, spasi ganda, dan titik diabaikan.
- **Tambah cepat oleh staf cabang** (F2): hanya dari laporan muat (4F-3),
  hanya sebelum sambungan pelanggan menyala; toko yang ditambah staf cabang
  bertanda "ditambah cabang, belum diperiksa" sampai Marketing atau Kepala
  Gudang membuka dan menyimpannya sekali.
- **Rute bawaan** (LOG-06) dipilih dari rute berjenis antar; boleh kosong.
- **Nonaktif** (LOG-04): toko tidak dihapus. Toko nonaktif tidak muncul di
  pilihan surat jalan dan laporan muat; riwayatnya tetap. Toko yang masih
  punya surat jalan berstatus Menunggu dijadwalkan, Dalam perjalanan, atau
  Perlu keputusan tidak bisa dinonaktifkan; pesannya menyebut surat jalan
  mana (sejalan KAR-27). Sesudah sambungan menyala, toko yang pelanggannya
  dinonaktifkan di kasir ikut bertanda "nonaktif di kasir" (tidak dinonaktifkan
  otomatis; Marketing yang memutuskan).
- **Siapa melihat** (LOG-07): menurut hak "lihat data toko" (bagian 5), bukan
  semua orang yang login. Driver, kenek, dan staf cabang hanya melihat toko
  yang ada di trip atau laporannya (nama, alamat, nomor HP, titik).

#### Gabung toko (LOG-04; F6)

Toko yang terlanjur dobel **digabungkan**: satu toko dipilih sebagai yang
tetap, satu lagi menjadi "digabung ke [toko tetap]".

- **Siapa:** Kepala Gudang, Marketing, Pemilik, GM; alasan wajib; tombol
  ditahan 3 detik (berakibat ke riwayat uang).
- **Akibat dalam satu langkah server:** semua surat jalan, nota, kunjungan,
  retur, dan tertunda toko yang digabung dipindah ke toko tetap; data
  pengiriman yang kosong di toko tetap diisi dari toko yang digabung (yang
  sudah terisi tidak ditimpa; perbedaannya ditampilkan di langkah 2 untuk
  dipilih); kode kasir keduanya menunjuk ke toko tetap (pasangan nama kasir
  boleh banyak ke satu toko, PRI-41 butir 2); toko yang digabung menjadi
  nonaktif bertanda "digabung".
- **Tidak boleh:** menggabung toko ke dirinya sendiri; menggabung toko yang
  sudah digabung (pilih toko tetapnya); menggabung dua toko yang sama-sama
  punya surat jalan Dalam perjalanan (tunggu trip selesai).
- **Jalan keluar** (WAJ-11): **Batalkan gabung** oleh Pemilik atau GM,
  alasan wajib, selama belum 30 hari: catatan yang dipindah kembali ke toko
  asal (dicatat di tiap baris, jadi tahu mana yang dipindah), toko asal aktif
  lagi. Catatan yang lahir sesudah gabung tetap di toko tetap. Sesudah 30
  hari, toko yang salah digabung dipisah dengan menambah toko baru.

#### Titik lokasi toko (LOG-05; F3)

- **Komponen yang sama** dengan titik cabang (KAR-L30, KEH bagian 7 butir 9):
  peta kecil, posisi dari GPS handphone, foto, jam server.
- **Siapa memasang** (F3): driver dan kenek saat mengunjungi toko di trip-nya
  (4F-2), **pengantar antar sendiri** saat Foto 2 di toko tujuan (4F-3), dan
  Kepala Gudang atau pemilik dari LOG-L02. Pasang = posisi saat itu + **foto
  depan toko** (wajib, kamera langsung, TAM-08). Akurasi GPS lebih buruk dari
  50 meter ditolak dengan arahan "Keluar dari bangunan dan coba lagi".
- **Status titik:** Belum ada → Menunggu → **Disetujui** atau Ditolak.
  Pasangan dari Kepala Gudang atau pemilik langsung Disetujui.
- **Persetujuan** (LOG-L06): Kepala Gudang atau pemilik melihat peta, foto,
  jarak dari alamat (bila alamat bisa dibaca peta) dan dari titik lama (bila
  ada), lalu **Setujui** atau **Tolak** (alasan). Yang ditolak kembali "Belum
  ada titik"; kunjungan berikutnya memasang lagi.
- **Mengubah titik yang sudah disetujui** hanya Kepala Gudang atau pemilik
  (LOG-05). Driver yang mendapati titiknya salah menekan **Laporkan titik
  salah** di kunjungan (alasan), yang masuk LOG-L06 sebagai usulan baru;
  titik lama tetap dipakai sampai diputuskan.
- Riwayat titik disimpan (pemasang, kapan, foto, keputusan); titik lama
  berstatus Diganti, tidak dihapus.
- Toko tanpa titik bertanda **"belum ada titik"** di daftar toko, pilihan
  surat jalan, dan kunjungan trip.
- **Radius toko** = radius titik cabang (pengaturan, 100 meter, KEH-12;
  LOG-88). Pemakaian radius toko saat Kirim ditetapkan di 4F-2.

#### Mobil dan rute (LOG-17, 18; DRV-08, 11)

- **Mobil:** nama (misalnya "L300 Putih"), nomor plat (unik), aktif.
- **Rute:** nama, **jenis** (antar atau belanja), aktif. Rute belanja
  dikenali dari jenisnya, tidak dari nama (LOG-17). Di layar dipakai kata
  "Rute", tidak pernah "Ritase".
- Diurus Kepala Gudang, Pemilik, GM (LOG-18) di Pengaturan › Logistik
  (keputusan menu M4: data yang jarang berubah ada di Pengaturan).
- **Tidak dihapus**, hanya nonaktif. Mobil atau rute yang dipakai rencana
  berstatus Draft, Siap Kirim, Berjalan, atau Menuju Garasi tidak bisa
  dinonaktifkan; pesannya menyebut rencananya (sejalan KAR-27).
- **Jenis rute tidak bisa diubah** sesudah dipakai sebuah trip, karena tarif
  ritase dan upah belanja dicari menurut pasangan mobil dan rute (DRV-08, 11).
  Rute yang salah jenis dinonaktifkan dan dibuat baru.
- Tarif tiap pasangan mobil dan rute diisi di 4G; LOG-L07 menampilkan tanda
  "belum ada tarif" per pasangan, karena tanpa tarif rencana tidak bisa Siap
  Kirim (LOG-21).

#### Surat jalan (LOG-08 s.d. 12; F4, F5)

- **Satu penjualan grosir Gudang ke toko di kasir = satu surat jalan**
  (LOG-08). **Nomor surat jalan = nomor struk kasir + cabang kasir Gudang**,
  unik (PRI-41 butir 3).
- **Isi:** toko, nomor, nominal nota gudang (lebih dari 0, rupiah bulat),
  catatan, tanggal (server), sumber (diketik atau kasir), pencatat.
- **Status** (LOG-09): Menunggu dijadwalkan → Dalam perjalanan → Terkirim;
  atau Perlu keputusan (dari Gagal, 4F-4); atau Batal. Ditambah satu status
  dari F4: **Diambil toko** (lihat di bawah). Perpindahan status hanya lewat
  pintu server (LOG-21, 24).
- **Satu toko boleh banyak surat jalan** (LOG-10): semuanya menjadi satu
  kunjungan di trip (4F-2); tiap surat jalan tetap satu nota; nota gudang
  sebuah kunjungan = jumlah surat jalannya. Driver tidak mengetik nominal.
- **Catat manual** (LOG-L09): Marketing, Kepala Gudang, Pemilik, GM. Nomor
  struk wajib. Nomor yang sama di cabang yang sama ditolak ("Struk 0451
  Gudang sudah dicatat sebagai surat jalan untuk Toko Maju, oleh Rina, pukul
  08.12").
- **Lahir dari kasir** (F4): sesudah sambungan transaksi menyala, server
  membuat surat jalan **Menunggu dijadwalkan** untuk tiap transaksi cabang
  berjenis Gudang yang pelanggannya dipasangkan ke toko. Transaksi RETAIL dan
  transaksi ke pelanggan yang dipasangkan ke **cabang** (penjualan Gudang ke
  cabang sendiri, KEU-69) tidak menjadi surat jalan. Pelanggan yang belum
  dipasangkan ditahan di TDK-L04 dan surat jalannya lahir sesudah dipasangkan,
  dengan tanggal transaksinya.
- **Bila surat jalan manual sudah ada** untuk nomor struk + cabang itu,
  tarikan tidak membuat baris baru: surat jalan manual **dicocokkan** dan
  bertanda "cocok dengan kasir". Nominal berbeda: nominal kasir dipakai bila
  surat jalan belum berangkat (perubahan tercatat, LOG-11); bila sudah
  berangkat, masuk Perlu Diperiksa milik Kepala Gudang (TDK-L06, PRI-41 butir
  1). Surat jalan manual yang tidak menemukan pasangan setelah 2 hari
  sambungan hidup masuk Perlu Diperiksa tab Tidak cocok (PRI-41 butir 3).
- **Diambil toko** (F4): penjualan grosir yang barangnya diambil sendiri
  oleh toko tidak perlu diantar. Marketing atau Kepala Gudang menandainya
  **Diambil toko** (alasan singkat, tanpa foto) selama Menunggu dijadwalkan.
  Status ini akhir: tidak masuk antrean kiriman, tidak dihitung tertunda,
  tidak punya uang di HRIS (uangnya urusan kasir). Jalan keluar: dibuka lagi
  menjadi Menunggu dijadwalkan oleh penanda atau pemilik selama 7 hari.
- **Tanggal kirim** baru dimulai saat surat jalan masuk rencana (LOG-16,
  4F-2); tanggal surat jalan adalah tanggal dicatat atau tanggal transaksi.

#### Mengubah dan membatalkan surat jalan (LOG-11, 12; F5)

| Keadaan | Yang boleh diubah | Oleh | Akibat |
|---|---|---|---|
| Menunggu dijadwalkan, sumber diketik | Toko, nominal, nomor, catatan | Pencatatnya, Kepala Gudang, Pemilik, GM | Tercatat lama, baru, siapa |
| Menunggu dijadwalkan, sumber kasir | Catatan saja; toko dan nominal ikut kasir | Pencatat, Kepala Gudang, Pemilik, GM | Perubahan di kasir langsung berlaku bertanda "berubah dari kasir" |
| Dalam perjalanan atau Terkirim, sumber diketik | Nominal, catatan | **Pemilik, GM** saja (LOG-11), alasan wajib | Uang kunjungannya dibagi ulang (4F-4); tercatat |
| Dalam perjalanan atau Terkirim, sumber kasir | Tidak ada di HRIS | — | Perubahan di kasir masuk Perlu Diperiksa Kepala Gudang: **Terima perubahan** (baris koreksi, uang dibagi ulang) atau **Biarkan** (PRI-41 butir 1) |
| Sudah tercatat di kasir (LOG-14) | Tidak lewat layar ini | Finance, Pemilik (4F-5) | Koreksi masuk kiriman ke kasir |

- **Batal** (LOG-12): hanya selagi Menunggu dijadwalkan atau Perlu
  keputusan, alasan wajib; surat jalan batal tetap tercatat. Surat jalan
  sumber kasir yang transaksinya **dibatalkan di kasir** ikut menjadi Batal
  bertanda "batal di kasir" bila masih Menunggu dijadwalkan; bila sudah
  dijadwalkan atau berangkat, masuk Perlu Diperiksa Kepala Gudang.
- Surat jalan sumber kasir **tidak bisa dibatalkan di HRIS** selama
  transaksinya masih berlaku di kasir; kalau memang tidak jadi dikirim karena
  diambil sendiri, pakai **Diambil toko**; kalau penjualannya batal, batalkan
  di kasir.

#### Daftar nota (LOG-13)

- **Satu tabel nota** untuk nota gudang (lahir dari surat jalan) dan nota
  cabang (lahir dari laporan muat, 4F-3). Tiap nota menyimpan **cabang pemilik
  nota**, toko, nominal, nomor kasir, dan sumbernya.
- **Cabang Gudang dikenali dari jenis cabang** (KAR), tidak dari namanya.
- Bagian uang tiap nota disimpan **sekali per nota** (4F-4); kunjungan tidak
  menyimpan salinannya.
- Tanda **"tercatat di kasir"** dan kuncinya (LOG-14) diisi di 4F-5; di
  sini hanya kolomnya.
- Nota tidak punya layar sendiri di 4F-1: nota gudang tampil di LOG-L10,
  nota cabang di laporan muat (4F-3), semuanya di pemeriksaan uang (4F-5).

#### LOG-L01. Data Toko

- **Letak:** Logistik › Data Toko. **PC.**
- **Isi:** satu baris per toko: nama, alamat (dipotong), rute bawaan, nomor
  HP, tanda (belum ada titik, titik menunggu, belum ada di kasir, nonaktif di
  kasir, ditambah cabang belum diperiksa, digabung), jumlah surat jalan
  berjalan.
- **Saring:** rute, tanda, aktif / nonaktif / semua (bawaan aktif). **Cari:**
  nama, alamat, nomor HP, kode kasir.
- **Tab:** Toko; **Titik menunggu** (LOG-L06) dengan angka penanda.
- **Tombol:** **Tambah toko** (LOG-L03; sesudah sambungan menyala diganti
  arahan F2).
- **Beda jabatan:** Finance melihat tanpa tombol ubah.
- **Pesan (kosong):** "Belum ada toko. Tambahkan toko pertama atau nyalakan
  sambungan pelanggan kasir."

#### LOG-L02. Toko (rincian)

- **Letak:** klik baris LOG-L01. **PC** (terbaca di HP).
- **Kepala:** nama, kode kasir (atau "belum ada di kasir"), sumber, status.
- **Tab:**
  1. **Data pengiriman:** alamat, nomor HP, rute bawaan, catatan pengiriman
     (misalnya "masuk gang samping masjid"); tombol **Ubah**.
  2. **Titik:** peta kecil, foto, status, riwayat; tombol **Pasang titik**
     (Kepala Gudang, pemilik).
  3. **Kiriman:** surat jalan dan kunjungan toko ini, terbaru di atas,
     periode lama dimuat saat diminta (PRI-11).
  4. **Riwayat:** perubahan data, gabung, nonaktif (Jejak Perubahan, BER-L34).
- **Tombol:** **Nonaktifkan / Aktifkan lagi** (alasan), **Gabungkan dengan
  toko lain** (LOG-L04).

#### LOG-L03. Tambah Toko (3 langkah, TAM-07)

1. **Nama dan alamat:** nama, alamat; pemeriksaan nama dobel langsung saat
   mengetik (daftar toko mirip ditampilkan).
2. **Pengiriman:** nomor HP (boleh kosong), rute bawaan, catatan, kode kasir
   (boleh kosong).
3. **Periksa dan simpan.** Pesan: "Toko … tersimpan. Titik dipasang driver
   saat pertama mengantar."
- **Tambah cepat** (dari LOG-L09 dan laporan muat): satu layar berisi nama dan
  alamat saja, aturan sama; sisanya dilengkapi kemudian.

#### LOG-L04. Gabungkan Toko (3 langkah)

1. **Pilih toko tetap:** toko ini akan digabung ke toko mana (cari).
2. **Bandingkan:** data dua toko berdampingan; pilih isian yang dipakai bila
   berbeda; jumlah catatan yang akan dipindah per jenis.
3. **Alasan dan gabungkan:** alasan wajib, tombol ditahan 3 detik.

#### LOG-L05. Pasang Titik Toko

- **Letak:** dari kunjungan toko (trip 4F-2, perjalanan antar sendiri 4F-3) dan
  LOG-L02. **HP.**
- **Isi:** peta dengan posisi sekarang dan akurasinya, alamat toko, titik lama
  bila ada; **foto depan toko** (kamera langsung).
- **Tombol:** **Simpan titik** (aktif bila akurasi ≤ 50 meter dan foto ada).
  Untuk titik yang sudah disetujui: **Laporkan titik salah** (alasan).
- **Pesan:** "Titik terkirim. Menunggu persetujuan Kepala Gudang."

#### LOG-L06. Titik Toko Menunggu

- **Letak:** tab "Titik menunggu" di LOG-L01. **PC dan HP.**
- **Isi:** satu kartu per usulan: toko, pemasang, kapan, peta (titik baru dan
  lama), foto, jarak dari titik lama.
- **Tombol:** **Setujui**, **Tolak** (alasan). Satu per satu dengan
  **Berikutnya**.

#### LOG-L07. Mobil & Rute

- **Letak:** Pengaturan › Logistik. **PC.**
- **Tab:** **Mobil** (nama, plat, aktif); **Rute** (nama, jenis, aktif);
  **Pasangan** (tabel mobil × rute dengan tanda "ada tarif" atau "belum ada
  tarif", tautan ke layar tarif 4G).
- **Tombol:** Tambah, Ubah nama, Nonaktifkan / Aktifkan lagi.
- **Beda jabatan:** Finance melihat saja.

#### LOG-L08. Surat Jalan

- **Letak:** Logistik › Surat Jalan. **PC.**
- **Tab per status:** Menunggu dijadwalkan (yang pernah tertunda paling atas,
  LOG-20), Dalam perjalanan, Terkirim, Perlu keputusan, Diambil toko, Batal,
  Semua. Angka per tab.
- **Isi baris:** nomor, tanggal, toko (tanda "belum ada titik"), rute bawaan,
  nominal, sumber (diketik / kasir / cocok dengan kasir), pencatat, umur.
- **Saring:** rute, sumber, tanggal. **Cari:** nomor, toko.
- **Tombol:** **Catat surat jalan** (LOG-L09); centang beberapa baris
  Menunggu lalu **Tandai diambil toko**.
- **Beda jabatan:** Finance melihat saja.

#### LOG-L09. Catat Surat Jalan (3 langkah, TAM-07)

1. **Toko:** cari toko aktif; **Tambah cepat** bila belum ada (LOG-L03).
2. **Nota:** nomor struk kasir (wajib), nominal, catatan.
3. **Periksa dan simpan.** Pesan: "Surat jalan 0451 untuk Toko Maju
   Rp2.350.000 tersimpan, menunggu dijadwalkan Kepala Gudang."

#### LOG-L10. Surat Jalan (rincian)

- **Letak:** dari LOG-L08 dan LOG-L02. **PC.**
- **Isi:** nomor, toko, nominal, sumber, status dan riwayatnya, trip dan
  kunjungan (4F-2), nota gudang, perubahan (lama, baru, siapa, alasan).
- **Tombol menurut keadaan:** **Ubah** (LOG-L11), **Batalkan** (alasan,
  ditahan 3 detik), **Tandai diambil toko**, **Buka lagi** (dari Diambil
  toko).

#### LOG-L11. Ubah Surat Jalan (3 langkah)

1. **Yang diubah:** isian menurut tabel "Mengubah dan membatalkan".
2. **Alasan** (wajib bila sudah berangkat) dan **akibat** dalam kalimat
   ("Uang kunjungan Toko Maju dibagi ulang").
3. **Simpan** (ditahan 3 detik bila nominal berubah sesudah berangkat).

### 3.2 Bagian 4F-2: Rencana dan Trip Truk

**Disetujui penuh 14 Oktober 2026** (R1 s.d. R5 "ok", sesuai saran; bagian
13; aturan LOG-98 s.d. 104 di bagian 3.19
`../../aturan/04-logistik.md`).

Bahan: LOG-15 s.d. 36, 41, 80, 83, 84; KEH-96 s.d. 101, 120 s.d. 125, KEH-L18
s.d. L20; DRV-08 s.d. 17, 41, 84; KEU-26, 57; PRI-01, 02, 33; TAM-07, 08, 15.

**Pokoknya:** satu **trip** adalah satu catatan dari rencana sampai lapor
garasi. Kantor menyusunnya (rencana), driver dan kenek menjalankannya (trip),
dan **setiap perubahan status lewat satu pintu di server** yang memeriksa
syaratnya (LOG-21, 24). Kejadian trip mengalir ke modul lain tanpa diketik
ulang: Berangkat menjadi absen masuk (KEH-97), lapor garasi memanggil Laporan
Pulang lalu absen pulang (KEH-98, 100), dan trip yang selesai melahirkan
ritase dan upah belanja satu kali (LOG-35) yang dinilai 4G.

#### Status dan pintunya (LOG-21)

| Status | Masuk lewat | Syarat di server | Oleh |
|---|---|---|---|
| **Draft** | Buat rencana | Mobil, rute berjenis antar atau belanja, driver; kenek boleh kosong; driver ≠ kenek (LOG-15) | Kepala Gudang, pemilik |
| **Siap Kirim** | Tombol Siap Kirim | Minimal satu isi (surat jalan, paket, tugas belanja, atau retur); tarif pasangan mobil dan rute ada untuk hari ini (DRV-12); mobil dan awak tidak sedang di trip lain yang Berjalan atau Menuju Garasi (R2) | Kepala Gudang, pemilik |
| **Berjalan** | Berangkat (LOG-L17) | Status Siap Kirim; penekan adalah awak trip itu; foto awak (kamera langsung); mobil dan awak tidak di trip lain yang berjalan | Driver atau kenek |
| **Menuju Garasi** | Foto bak kosong (LOG-L21) | Semua kunjungan Terkirim, Kirim Besok, Gagal, atau Dilepas; semua tugas belanja dan retur selesai atau dilepas; tidak ada barang yang harus diantar ke pemiliknya belum selesai (LOG-28, 54) | Driver atau kenek |
| **Selesai** | Lapor garasi (LOG-L21) atau Tutup oleh kantor (LOG-L22) | Lapor garasi: di dalam radius titik Gudang (LOG-29); Tutup oleh kantor: alasan dan foto (LOG-30) | Driver; kantor |
| **Dibatalkan** | Batalkan | Hanya Draft atau Siap Kirim, alasan wajib; semua isi kembali ke antrean (LOG-23) | Kepala Gudang, pemilik |

Dua orang menekan tombol yang sama bersamaan: trip dikunci satu per satu di
server; yang kedua menerima "Sudah ditekan oleh [nama] pukul [jam]", bukan
error (sejalan LOG-26).

#### Rencana (LOG-15, 16, 19, 20, 22, 23)

- **Dibuat** Kepala Gudang atau pemilik (LOG-L13). Pilihan driver dan kenek
  hanya orang aktif yang punya **izin tugas lapangan** driver atau kenek
  (KAR-05). Driver atau kenek yang tidak bisa jalan cukup lapor ke Kepala
  Gudang dan tidak dipilih; tidak dicatat (LOG-15, DRV-18).
- **Isi:** surat jalan Menunggu dijadwalkan (yang pernah tertunda paling atas,
  lalu toko di rute bawaan yang dipilih, LOG-06, 20); paket cabang (4F-3);
  tugas belanja (rute berjenis belanja + supplier); tugas retur (4F-4).
  Beberapa surat jalan satu toko menjadi **satu kunjungan** (LOG-10).
- **Tanggal kirim** surat jalan dimulai saat dimasukkan ke rencana (LOG-16);
  **tanggal trip = tanggal Berangkat** menurut jam server (LOG-25). Rencana
  yang disusun malam dan berangkat pagi bertanggal pagi itu.
- **Rencana menggantung:** Draft atau Siap Kirim yang belum Berangkat sampai
  23.59 hari berikutnya sesudah dibuat ditandai di Dashboard (4F-5) dengan
  pilihan **Batalkan** atau **Tetap**; tidak dibatalkan otomatis.
- **Sesudah berangkat** (LOG-22): kantor masih bisa **melepas** kunjungan
  yang belum diproses (surat jalannya kembali Menunggu dijadwalkan), dan
  **menambah** tugas belanja atau retur. Menambah surat jalan sesudah
  berangkat **tidak bisa**: surat jalan yang datang sesudahnya masuk rencana
  berikutnya (LOG-19). Kunjungan Terkirim atau Gagal terkunci.
- **Batal** (LOG-23): hanya Draft atau Siap Kirim, alasan wajib; dalam satu
  langkah semua isi kembali ke antrean: surat jalan Menunggu dijadwalkan,
  paket menunggu dijemput, tugas belanja dan retur Menunggu.

#### Awak dan gantinya (LOG-22; R5)

- Ganti driver atau kenek oleh kantor **sampai Menuju Garasi**; setelah
  Selesai dikunci karena ritase sudah tercatat (LOG-22). Driver dan kenek
  tidak bisa mengganti awak (LOG-24).
- Sesudah Berangkat: orang yang **ditambahkan** tercatat absen masuk pada jam
  ditambahkan (KEH-121); yang **dicopot** absennya tetap dan dibetulkan HR
  lewat Koreksi bila memang tidak ikut (KEH-121).
- **Ritase saat awak berubah (R5):** ritase dicatat untuk **awak yang masih
  tercatat saat trip Selesai**. Orang yang dicopot di tengah jalan tidak
  mendapat ritase otomatis; bila ia sudah bekerja sebagian dan pantas dibayar,
  pemilik memakai **ritase tangan** (LOG-36) dengan alasan. Trip dihitung
  **berkenek** (tarif driver "dengan kenek", DRV-09) bila ada kenek tercatat
  saat Selesai.

#### Trip dari sisi driver dan kenek (LOG-24 s.d. 28)

- **Trip Saya** (LOG-L16) menampilkan trip hari ini yang menugaskan dirinya,
  dan trip Siap Kirim yang belum berangkat. Saat dibuka dan ada paket cabang
  menunggu dijemput: pengingat (LOG-25, isinya 4F-3).
- **Berangkat** (LOG-L17): driver **atau** kenek; satu foto awak di dalam
  mobil (kamera langsung, semua awak terlihat, KEH-97); lokasi dicatat, tidak
  diperiksa (KEH-124). Bila ada laporan muat ke toko di trip itu yang belum
  Selesai: peringatan, tetap boleh berangkat (LOG-25). Satu langkah server:
  status Berjalan, tanggal trip, absen masuk seluruh awak (KEH-97, 120).
- **Urutan toko bebas** (LOG-26). Menekan **Saya menuju ke sini** menyimpan
  toko yang sedang dituju; kantor melihat "sedang menuju Toko Maju". Dua awak
  tidak bisa memproses toko yang sama dua kali: yang membuka kunjungan lebih
  dulu memegangnya sampai selesai atau melepasnya; yang lain melihat "sedang
  diproses Eko".
- **Kunjungan toko** (LOG-L18): kerangka berisi nama, alamat, nomor HP
  (tombol telepon), titik (tombol buka peta), daftar surat jalan dan paket,
  nota gudang kunjungan, dan tiga tombol: **Kirim**, **Kirim Besok**, **Gagal**
  (isinya 4F-4). Bila toko belum punya titik: tombol **Pasang titik**
  (LOG-L05).
- **Kirim di luar titik toko (R1):** saat Kirim disimpan, server mencatat
  lokasi dan **jarak dari titik toko**. Di luar radius (100 meter, LOG-88):
  **tetap tersimpan**, bertanda "di luar titik toko" untuk ditinjau Kepala
  Gudang di Dashboard (4F-5). Toko tanpa titik tidak diperiksa. Tidak ada
  tolakan, karena sinyal GPS di gang sering melenceng dan barang tetap harus
  turun.
- **Tugas belanja** (LOG-L19; R4): pilih **supplier** dari daftar supplier
  (DRV-41, KEU-57; boleh tambah supplier baru bertanda "belum diperiksa"),
  **foto nota supplier** (wajib, kamera langsung), catatan. **Tanpa nominal**:
  nilai belanja dicatat Keuangan dari nota supplier kasir dan uang yang
  dibawa (KEU-26). Tugas yang selesai melahirkan upah belanja (LOG-34).
- **Tombol dikunci 1 detik** setiap tampilan berganti, dan **setiap foto
  langsung tersimpan** begitu diambil (LOG-26), supaya sinyal putus tidak
  menghilangkan foto.
- **Selesai lebih awal** (LOG-L20; LOG-27): alasan dan foto wajib; dalam satu
  langkah semua kunjungan yang belum diproses menjadi **Kirim Besok** dan
  masuk tertunda (LOG-57, 4F-4); tugas belanja yang belum selesai kembali
  Menunggu.
- **Bak kosong lalu Menuju Garasi** (LOG-28): foto bak kosong; server
  memeriksa syarat Menuju Garasi (tabel di atas) dan menyebut yang masih
  kurang ("Retur Toko Sinar belum diantar ke cabang Raja").

#### Lapor sampai garasi (LOG-29; KEH-98, 100)

Satu urutan di LOG-L21, setiap langkah tersimpan begitu selesai:

1. **Di titik Gudang:** server memeriksa lokasi di dalam radius titik cabang
   berjenis Gudang (LOG-29). Di luar: "Anda belum di titik Gudang (jarak 1,2
   km). Lapor saat sudah sampai." Tidak ada jeda waktu.
2. **Foto amper bensin** (kamera langsung).
3. **Laporan Pulang** driver untuk trip ini (KEH-L20: serah terima, ada
   masalah, keadaan mobil, bensin). Kenek tidak wajib mengisi (KEH-100); bagi
   kenek langkah ini dilewati.
4. **Selesai:** satu langkah server: status Selesai, jam lapor garasi, absen
   pulang seluruh awak pada jam itu (pindah ke trip terakhir bila ada trip
   lain hari itu, KEH-98), **ritase dan upah belanja dicatat** (bagian
   berikut), permintaan bensin diteruskan (4F-5).

Lapor garasi ditekan **driver**; kenek tidak melapor terpisah (absennya ikut
trip). Bila driver yang menekan sudah menyelesaikan langkah 1–2 tetapi
handphonenya mati sebelum Laporan Pulang, langkah yang tersimpan tetap ada
dan dilanjutkan dari handphone lain dengan akunnya, atau kantor menutup trip.

#### Trip ditutup kantor (LOG-30, 31; KEH-101)

- **Kapan:** handphone atau GPS driver bermasalah, atau trip belum lapor
  garasi sampai **12.00 hari berikutnya** (LOG-31: ditandai untuk Kepala
  Gudang dan pemilik, tampil di Dashboard dan Absen Trip Hari Ini).
- **Siapa:** Kepala Gudang atau pemilik, alasan dan foto wajib (misalnya foto
  mobil di garasi), tombol ditahan 3 detik. Tidak untuk trip yang dirinya
  sendiri menjadi awak.
- **Akibat dalam satu langkah:** status Selesai bertanda "ditutup kantor";
  absen pulang awak pada jam penutupan (KEH-101); ritase dan upah belanja
  dicatat **sekali** seperti lapor garasi; kunjungan yang belum diproses
  menjadi Kirim Besok (sama dengan Selesai lebih awal); Laporan Pulang
  menyusul dari driver tanpa denda (KEH-101), dan sampai terkirim tampil di
  perlu perhatian Kepala Gudang.
- Trip yang masih **Berjalan** (belum Menuju Garasi) juga boleh ditutup
  kantor; foto bak kosong tidak wajib, tetapi kunjungan sisa menjadi Kirim
  Besok dan barang yang harus diantar ke pemiliknya tetap menjadi tugas
  (4F-4).

#### Ritase dan upah belanja (LOG-33 s.d. 36; DRV-09, 14 s.d. 17)

- **Dicatat server sekali** saat trip Selesai (lapor garasi atau ditutup
  kantor). Kunci: **trip + orang + jenis** (dan tugas belanja untuk upah
  belanja), sehingga tidak bisa dobel (LOG-35).
- **Satu ritase per awak** bila trip membawa minimal satu kunjungan toko
  atau satu tugas retur (LOG-33); ritase tetap penuh walaupun ada toko yang
  tidak terkirim. Trip yang isinya **hanya belanja** tidak punya ritase
  (LOG-34).
- **Satu upah belanja per tugas belanja Selesai**, untuk awak trip itu
  (LOG-34; nominal per peran dari tarif rute belanja, DRV-11, kenek Rp0 pada
  tarif sekarang).
- **Tanggal** = tanggal trip (LOG-35). Baris ritase menyimpan: orang, peran
  (driver, kenek), tanggal, mobil, rute, berkenek, jenis (ritase, upah
  belanja), asal (server, tangan, ditutup kantor). **Nominalnya** diambil 4G
  dari tarif tanggal itu dan disimpan di baris Buku Upah (DRV-09, 84); orang
  bergaji bulanan yang ikut bukan di hari liburnya mendapat baris Rp0
  berketerangan (DRV-16, 17).
- **Ritase tangan** (LOG-36; R3): hanya Pemilik atau GM (LOG-L23), alasan
  wajib; isi tanggal, mobil, rute, orang, peran, berkenek. Server memeriksa
  dobel: bila orang itu sudah punya ritase di **tanggal, mobil, dan rute yang
  sama**, layar menampilkan ritase itu dan meminta konfirmasi kedua "Memang
  dua kali jalan" dengan alasan tambahan; tanpa konfirmasi tidak tersimpan.
- **Batal ritase** (DRV-15): hanya Pemilik atau GM, alasan wajib, tidak
  dihapus. Bila slip minggunya sudah ditutup, koreksinya baris baru di slip
  berikutnya (4G).

#### Pagar uji (LOG-32; bacaan)

Hanya satu pagar trip yang boleh dimatikan untuk uji: **pemeriksaan titik
Gudang saat lapor garasi**. Dimatikan Pemilik atau GM lewat Pengaturan,
dengan alasan dan **batas waktu paling lama 24 jam**; menyala lagi sendiri;
selama mati tampil peringatan di Dashboard pemilik dan setiap lapor garasi
bertanda "pagar titik mati". Foto, satu pintu server, dan kunci dobel ritase
tidak bisa dimatikan. Di tempat uji (4B) pagar diatur terpisah dan tidak
mengenai sistem asli.

#### LOG-L12. Rencana & Trip

- **Letak:** Logistik › Rencana & Trip. **PC** (terbaca di HP).
- **Kepala:** tanggal (bawaan hari ini); angka per status.
- **Tab:** **Hari ini** (kartu per trip: mobil, rute, awak, status, sedang
  menuju, kunjungan selesai dari total, jam berangkat, tanda: belum lapor
  garasi, ditutup kantor, kirim di luar titik); **Draft & Siap Kirim**;
  **Selesai**; **Dibatalkan**; **Ritase** (LOG-L24).
- **Tombol:** **Buat rencana** (LOG-L13).
- **Beda jabatan:** Marketing dan Finance melihat tanpa tombol.

#### LOG-L13. Buat Rencana (4 langkah, TAM-07)

1. **Mobil, rute, awak:** mobil aktif, rute aktif, driver, kenek (boleh
   kosong). Tanda "belum ada tarif" bila pasangan belum bertarif.
2. **Surat jalan dan paket:** daftar Menunggu dijadwalkan (tertunda paling
   atas, lalu rute bawaan), centang; paket cabang menunggu dijemput (4F-3).
3. **Tugas belanja dan retur:** tambah tugas belanja (rute belanja, supplier
   bila sudah diketahui); retur yang ditugaskan (4F-4).
4. **Periksa:** ringkasan (berapa toko, nota gudang jumlah, tugas). Tombol
   **Simpan Draft** dan **Simpan dan Siap Kirim**.

#### LOG-L14. Rencana / Trip (rincian kantor)

- **Letak:** dari LOG-L12. **PC dan HP.**
- **Isi:** kepala (mobil, rute, awak, status dan jamnya, foto awak, tanggal
  trip); daftar kunjungan (toko, surat jalan, status, jam, jarak dari titik),
  tugas belanja dan retur; riwayat langkah (siapa, kapan).
- **Tombol menurut status:** Draft: **Ubah isi**, **Siap Kirim**,
  **Batalkan**; Siap Kirim: **Ubah isi**, **Kembali ke Draft**, **Batalkan**;
  Berjalan dan Menuju Garasi: **Ganti awak** (LOG-L15), **Lepas kunjungan**,
  **Tambah tugas belanja atau retur**, **Tutup trip** (LOG-L22); Selesai:
  hanya baca, tautan ke ritase.

#### LOG-L15. Ganti Awak (3 langkah)

1. **Siapa diganti:** driver atau kenek; orang baru (berizin tugas lapangan,
   tidak di trip lain yang berjalan).
2. **Akibat** dalam kalimat: absen masuk orang baru pada jam sekarang,
   absen orang lama tetap (dibetulkan HR bila perlu), ritase untuk awak saat
   trip Selesai (R5), berkenek atau tidak.
3. **Simpan** (alasan wajib bila sudah berangkat).

#### LOG-L16. Trip Saya

- **Letak:** Kerja Harian › Trip Saya; tombol utama bilah bawah driver dan
  kenek. **HP.**
- **Isi:** satu kartu per trip hari ini; kartu trip yang aktif paling atas:
  status dalam satu kalimat besar ("Siap berangkat", "Berjalan: 4 dari 9 toko
  selesai", "Menuju garasi"), daftar kunjungan dan tugas dengan statusnya
  (yang sedang dituju di atas), pengingat paket (4F-3).
- **Tombol menurut status:** **Berangkat** (LOG-L17); per kunjungan **Buka**
  (LOG-L18); per tugas belanja **Buka** (LOG-L19); **Selesai lebih awal**
  (LOG-L20); **Bak kosong / Lapor garasi** (LOG-L21).
- **Pesan (kosong):** "Belum ada trip untuk Anda hari ini. Tunggu Kepala
  Gudang menyusun rencana."

#### LOG-L17. Berangkat (2 langkah)

1. **Foto awak** di dalam mobil (kamera langsung, semua awak terlihat);
   nama awak tertulis di bawahnya. Peringatan laporan muat belum Selesai bila
   ada (4F-3).
2. **Berangkat:** ringkasan (mobil, rute, berapa toko); tombol **Berangkat**.
   Pesan: "Berangkat 08.10. Absen masuk tercatat untuk Dedi dan Eko."

#### LOG-L18. Kunjungan Toko (kerangka)

- **Letak:** dari LOG-L16. **HP.**
- **Isi:** nama toko besar, alamat, catatan pengiriman, nomor HP (telepon),
  tombol **Buka peta** (titik toko) atau **Pasang titik**; daftar surat jalan
  (nomor, nominal) dan paket; nota gudang kunjungan; tombol **Saya menuju ke
  sini**.
- **Tombol akhir:** **Kirim**, **Kirim Besok**, **Gagal** (isi 4F-4).
- Kunjungan yang sedang diproses awak lain: hanya baca, "sedang diproses
  Eko".

#### LOG-L19. Tugas Belanja

- **Isi:** rute belanja, supplier (pilih; tambah baru bertanda belum
  diperiksa), **foto nota supplier** (wajib), catatan. Tombol **Selesai**.
- Pesan: "Belanja di [supplier] selesai. Upah belanja tercatat saat trip
  selesai."

#### LOG-L20. Selesai Lebih Awal (2 langkah)

1. **Alasan dan foto** (wajib).
2. **Akibat** dalam kalimat ("5 toko menjadi Kirim Besok dan masuk
   tertunda"); tombol ditahan 3 detik.

#### LOG-L21. Pulang ke Garasi

- Bagian 1: **Bak kosong** (foto) → Menuju Garasi; bila syarat kurang,
  daftar yang masih kurang.
- Bagian 2: **Lapor garasi**: pemeriksaan titik Gudang, foto amper, Laporan
  Pulang (KEH-L20, driver), lalu **Selesai**. Pesan: "Trip selesai 17.20.
  Absen pulang tercatat. Ritase tercatat untuk Dedi dan Eko."

#### LOG-L22. Tutup Trip oleh Kantor (3 langkah)

1. **Trip:** awak, status, kunjungan sisa, jam berangkat.
2. **Alasan dan foto** (wajib), akibat dalam kalimat (absen pulang jam
   sekarang, sisa toko Kirim Besok, ritase tercatat, Laporan Pulang menyusul).
3. **Tutup:** tombol ditahan 3 detik.

#### LOG-L23. Ritase Tangan (3 langkah)

1. **Isi:** tanggal (paling jauh pengaturan, isi awal 14 hari ke belakang),
   mobil, rute, orang, peran, berkenek.
2. **Periksa dobel:** ritase orang itu di tanggal, mobil, dan rute yang sama
   ditampilkan; bila ada, konfirmasi "Memang dua kali jalan" dengan alasan.
3. **Simpan:** alasan wajib, tombol ditahan 3 detik.

#### LOG-L24. Ritase & Upah Belanja

- **Letak:** tab "Ritase" di LOG-L12. **PC.**
- **Isi:** satu baris per ritase atau upah belanja: tanggal, orang, peran,
  mobil, rute, berkenek, jenis, asal, trip, status. Nominal tidak tampil di
  sini (milik 4G).
- **Saring:** minggu upah, orang, asal, status. **Tombol:** **Ritase tangan**
  (LOG-L23), per baris **Batalkan** (Pemilik, GM).

### 3.3 Bagian 4F-3: Laporan Muat Cabang, Paket, dan Antar Sendiri

**Disetujui penuh 14 Oktober 2026** (M1 s.d. M6 "ok", sesuai saran; bagian 13; aturan
LOG-105 s.d. 111 di bagian 3.20 `../../aturan/04-logistik.md`).

Bahan: LOG-19, 37 s.d. 43, 50, 74, 76, 77, 84; LOG-90 s.d. 104; GAJ-26,
GAJ-L20, pintu tulis Buku Bonus (spec Gaji bagian 3.4); KEH-10, 96;
TDK-L04 (pasangan nama pengantar); PRI-39, 41; TAM-08, 09; KAR-05;
arsip `../../aturan/arsip/04-logistik-galian.md` LOG-B25 s.d. B42, C10, C23.

**Pokoknya:** cabang toko juga menjual ke toko pelanggan. Barangnya
disiapkan di cabang lewat **laporan muat**: foto isi barang dan foto
**paket**. Saat ditandai Selesai, cabang memilih **jalur**: dijemput driver
gudang (paketnya masuk trip truk, 4F-2) atau **diantar sendiri** oleh
karyawan cabang dengan tiga foto. Satu laporan muat = **satu nota cabang**.
Ongkir dan pengantar milik nota kasir (LOG-42); bonus ongkir lahir dari
baris ongkir kasir lewat pintu tulis Buku Bonus (LOG-76), bukan dari HRIS.

#### Status laporan muat (LOG-37 s.d. 41; M3)

| Status | Masuk lewat | Syarat di server | Oleh |
|---|---|---|---|
| **Proses** | Buat laporan muat | Toko tujuan aktif; cabang asal berjenis toko (bukan Gudang, karena Gudang memakai surat jalan) | Staf cabang asal; pemilik memilih cabang asal |
| **Menunggu dijemput** | Tandai Selesai jalur driver | Minimal satu foto isi barang dan satu paket; nota cabang dipilih atau diketik (LOG-38) | Staf cabang asal, pemilik |
| **Menunggu diantar** | Tandai Selesai jalur antar sendiri | Sama, ditambah pengantar (karyawan aktif cabang asal yang punya akun, LOG-42) | Staf cabang asal, pemilik |
| **Di trip** | Ambil paket (LOG-L30) | Semua paket laporan ini dicentang dan difoto sekaligus (M2); trip Siap Kirim atau Berjalan | Driver atau kenek trip itu |
| **Dalam perjalanan** | Foto 1 antar sendiri (LOG-L32) | Penekan adalah pengantarnya | Pengantar |
| **Terkirim** | Kirim di kunjungan (4F-4) atau Foto 2 hasil Terkirim (LOG-L33) | — | Driver, kenek; pengantar |
| **Perlu keputusan** | Gagal di kedua jalur (LOG-56, 4F-4) | — | — |
| **Batal** | Batalkan | Hanya dari Proses, alasan wajib (LOG-39); riwayat dan foto tetap | Staf cabang asal, pemilik |

- **Kirim Besok** di kedua jalur mengembalikan laporan ke Menunggu dijemput
  atau Menunggu diantar dan mencatat tertunda (LOG-55, 57; isinya 4F-4).
- **Kembalikan ke Proses** (jalan keluar, WAJ-11): laporan Menunggu dijemput
  atau Menunggu diantar yang belum diambil atau belum berangkat boleh
  dikembalikan ke Proses oleh staf cabang asal atau pemilik, alasan wajib.
  Foto terbuka lagi; nota dan pengantar tetap. Dari Proses barulah bisa
  Batal. Ini jalan untuk "toko batal pesan sebelum barang berangkat".
- **Satu laporan muat = satu nota cabang** (M3). Dua nota ke toko yang sama
  = dua laporan muat; kalau keduanya dibawa truk yang sama, keduanya menjadi
  satu kunjungan (sejalan LOG-10).
- Toko tujuan hanya **toko pelanggan**; penjualan cabang ke Gudang atau ke
  cabang lain bukan laporan muat (KEU-69).

#### Membuat laporan muat (LOG-37; F2)

- **Siapa:** staf cabang (Team Toko) untuk cabangnya sendiri; pemilik
  memilih cabang asal. Kepala Toko termasuk staf cabang.
- **Isi:** toko tujuan (cari toko aktif; **tambah cepat** LOG-L03 hanya
  sebelum sambungan pelanggan menyala, bertanda "ditambah cabang, belum
  diperiksa", LOG-91), catatan, **foto isi barang** (satu atau lebih), dan
  **paket**: satu foto per paket, bernomor urut (Paket 1, Paket 2, …).
- **Foto** (TAM-08): **kamera atau galeri**, foto galeri yang lebih tua dari
  2 menit ditolak (pengaturan yang sama dengan LOG-43). Tiap foto langsung
  tersimpan begitu diambil (sejalan LOG-26). Selama Proses foto boleh
  ditambah dan dibatalkan (bukan dihapus; PRI-02); sesudah Selesai terkunci
  (LOG-38).
- **Tanda "segera Tandai Selesai"** (LOG-40): laporan Proses yang tokonya
  sudah ada di trip Draft, Siap Kirim, atau Berjalan. Tampil di LOG-L25 dan
  di Beranda staf cabang asal. Kalau trip itu Berangkat, driver mendapat
  peringatan di LOG-L17 (sudah ada di 4F-2), tetap boleh berangkat.

#### Tandai Selesai: jalur, nota cabang, ongkir, pengantar (LOG-38, 42; M3, M4)

Dua keadaan, sama dengan surat jalan (bagian 3.1):

| | Sebelum sambungan transaksi menyala | Sesudah menyala |
|---|---|---|
| **Nota cabang** | Diketik: **nomor struk kasir cabang asal** (wajib, unik per cabang, PRI-41 butir 3) dan nominal (lebih dari 0, bulat). Sumber "diketik" | **Dipilih** dari transaksi kasir cabang asal ke pelanggan yang dipasangkan ke toko tujuan, 7 hari terakhir, yang belum dipakai laporan lain. Nominal dari kasir, tidak bisa diketik |
| **Ongkir** | Diketik (Rp0 boleh), sumber "diketik"; **tidak melahirkan bonus** (LOG-42) | Dari baris ongkir nota kasir itu (sesudah diskon); tanpa baris = tanpa ongkir |
| **Pengantar** (jalur antar sendiri) | Dipilih dari karyawan aktif cabang asal yang punya akun | Dari nota kasir bila ada dan sah (nama sudah dipasangkan di TDK-L04, karyawan aktif cabang asal, punya akun). Bila tidak ada atau tidak sah: staf memilih di HRIS, bertanda **"pengantar beda dengan kasir"** (M4) |

- Surat jalan manual yang dicocokkan kasir (LOG-97) berlaku juga di sini:
  nota cabang yang diketik dicocokkan lewat nomor struk + cabang begitu
  sambungan menyala; nominal beda sebelum diambil atau berangkat memakai
  nominal kasir (tercatat); sesudahnya masuk Perlu Diperiksa (TDK-L06) milik
  Kepala Toko cabang asal atau Kepala Gudang (sejalan LOG-56: barang cabang
  diputuskan cabang asal atau Kepala Gudang; PRI-41 butir 1). Yang 2 hari
  tidak menemukan pasangan masuk Perlu Diperiksa tab Tidak cocok.
- **Jalur driver** tidak butuh pengantar di HRIS. Kalau nota kasirnya
  menyebut pengantar (misalnya driver), bonus ongkir tetap untuk orang itu
  (GAJ kejadian 76); HRIS tidak memeriksanya.
- Tandai Selesai menulis satu baris **nota** jenis cabang (tabel nota 4F-1)
  dengan cabang pemilik nota = cabang asal.

#### Mengubah sesudah Selesai (LOG-39; M3)

| Keadaan | Yang boleh diubah | Oleh | Akibat |
|---|---|---|---|
| Menunggu dijemput / Menunggu diantar | Jalur, nota (sumber diketik), ongkir dan pengantar (sumber diketik), catatan | Staf cabang asal, pemilik | Tercatat lama, baru, siapa. Ganti pengantar wajib alasan (LOG-39) |
| Menunggu dijemput / diantar, sumber kasir | Jalur, catatan; nota, ongkir, pengantar ikut kasir | sama | Perubahan di kasir langsung berlaku bertanda "berubah dari kasir" |
| Di trip, Dalam perjalanan, Terkirim, sumber diketik | Nominal nota, catatan | **Pemilik, GM** saja, alasan wajib (sejalan LOG-11) | Uang kunjungan atau tujuan dibagi ulang (4F-4) |
| Di trip, Dalam perjalanan, Terkirim, sumber kasir | Tidak ada di HRIS | — | Perubahan di kasir masuk Perlu Diperiksa (TDK-L06) milik Kepala Toko cabang asal atau Kepala Gudang: Terima perubahan atau Biarkan (PRI-41 butir 1) |
| Sudah tercatat di kasir (LOG-14) | Tidak lewat layar ini | Finance, pemilik (4F-5) | Koreksi masuk kiriman ke kasir |

- **Jalur tidak bisa diubah** sesudah paket diambil atau perjalanan
  berangkat; barang sudah di tangan orang lain. Kalau perlu pindah jalur,
  tunggu hasil Kirim Besok atau Gagal.

#### Paket dan trip truk (LOG-19, 40, 41; M1, M2)

- **Paket masuk trip lewat dua jalan** (M1):
  1. **Ditugaskan kantor** saat menyusun rencana (LOG-L13 langkah 2, sudah
     ada di 4F-2): laporan berstatus Menunggu dijemput bertanda
     "dijadwalkan di trip [nomor]"; driver trip lain tidak bisa mengambilnya.
  2. **Diambil driver langsung** ke trip-nya yang Siap Kirim atau Berjalan,
     saat lewat di cabang itu (LOG-41).
- **Ambil paket** (LOG-L30; M2) dilakukan **per laporan muat sekaligus**:
  driver mencentang tiap paket (dibandingkan dengan foto paket dari cabang),
  lalu **satu foto** paket di mobil (kamera atau galeri, umur ≤ 2 menit).
  Server menolak bila ada paket yang tidak dicentang: "Paket 3 tidak
  dicentang. Semua paket satu nota dibawa bersama." Ini cara yang aman untuk
  LOG-41 "semua paket satu nota dibawa driver yang sama": tidak ada paket
  yang tertinggal di cabang.
- **Paket hilang atau kurang** saat dijemput: driver tidak bisa mengambil
  sebagian; ia menekan **Paket tidak lengkap** (catatan), yang memberi tahu
  staf cabang asal. Cabang mengembalikan laporan ke Proses, membetulkan
  paket, lalu Tandai Selesai lagi.
- **Akibat Ambil** dalam satu langkah server: status Di trip; toko tujuan
  masuk trip sebagai kunjungan (bila toko itu sudah ada di trip karena surat
  jalan, paket bergabung ke kunjungan yang sama, LOG-10; bila belum,
  kunjungan baru di urutan terakhir); nota cabang ikut nota kunjungan.
- **Trip yang hanya membawa paket** punya ritase (trip membawa toko,
  LOG-33).
- **Warna menunggu** (LOG-40): dihitung dari jam Tandai Selesai. Kuning,
  **oranye** sesudah 6 jam, **merah** sesudah 24 jam. Berlaku untuk paket
  Menunggu dijemput dan kiriman Menunggu diantar.
- **Pengingat di Trip Saya** (LOG-25): saat trip Siap Kirim atau Berjalan
  dibuka dan ada paket Menunggu dijemput (cabang mana pun, tidak
  dijadwalkan ke trip lain), tampil kotak "Jemput paket cabang: 3 laporan di
  Raja (1 merah), 1 di Markas" dengan tautan ke LOG-L30. Bisa ditutup; muncul
  lagi bila ada laporan baru.
- **Trip dibatalkan** (LOG-23): laporan yang dijadwalkan kembali Menunggu
  dijemput tanpa tanda trip. Bila paketnya sudah sempat diambil secara fisik
  (trip Siap Kirim yang batal), laporan kembali Menunggu dijemput bertanda
  "barang di Gudang", dan trip berikutnya mengambilnya di Gudang dengan
  layar yang sama.

#### Perjalanan antar sendiri (LOG-42, 43, 50; M5, M6)

Satu **perjalanan** = Foto 1 di cabang asal, Foto 2 di tiap tujuan, Foto 3
kembali di cabang asal. Bukan ritase dan bukan trip truk.

- **Isi:** kiriman Menunggu diantar dari cabang yang sama yang
  **pengantarnya orang itu**. Satu perjalanan boleh beberapa kiriman (LOG-43).
  Dua kiriman ke toko yang sama menjadi **satu tujuan** (satu Foto 2), uang
  tetap diketik per nota *(diganti K5, disetujui 14 Oktober 2026: satu angka per tujuan yang dibagi ke nota, LOG-117)*.
- **Syarat mulai** (M6): orang itu sudah **absen masuk** hari ini dan belum
  pulang (KEH-10); tidak punya perjalanan lain yang berjalan (LOG-43).
- **Foto 1 ambil barang** (LOG-L32): hanya pengantar yang ditunjuk; yang
  memotret menjadi **PJ**. Satu langkah server: perjalanan Berjalan, jam
  mulai (TAM-09), kiriman Dalam perjalanan.
- **Foto 2 sampai di tujuan** (LOG-L33): foto sampai, lokasi dicatat dan
  jaraknya dari titik toko (di luar radius ditandai, tidak ditolak, sejalan
  LOG-99); toko tanpa titik: tombol **Pasang titik** (LOG-L05, F3). Lalu
  hasil:
  - **Terkirim:** cara bayar dan uang diterima (satu angka per tujuan, dibagi ke nota, K5 LOG-117; LOG-50: aturan
    cash, transfer dengan foto bukti, deposit, tempo, Campuran sama dengan
    LOG-44, 45); potong nota dan barang kejadian memakai komponen layar Kirim
    yang sama dengan truk (isinya 4F-4). Disimpan dalam satu langkah server
    (LOG-47).
  - **Kirim Besok** atau **Gagal:** alasan dan foto (isinya 4F-4); Gagal
    menjadi Perlu keputusan, bukan langsung batal seperti sistem lama
    (LOG-56).
- **Foto 3 kembali** (LOG-L34): di cabang asal; lokasi dicatat, tidak
  diperiksa (sejalan KEH-124). Setelah semua tujuan punya hasil.
- **Lama dan alasan** (LOG-43): tiap tahap paling sedikit 2 menit (Foto 2
  pertama paling cepat 2 menit sesudah Foto 1, dan seterusnya). **Lama
  berangkat** = Foto 1 sampai Foto 2 pertama; **lama kembali** = Foto 2
  terakhir sampai Foto 3. Bila selisihnya 20 menit atau lebih, Foto 3 wajib
  alasan (macet, isi bensin, istirahat, menunggu di toko, tugas lain,
  lainnya + keterangan).
- **Foto** (TAM-08; LOG-43): kamera atau galeri, galeri yang lebih tua dari
  2 menit ditolak; jam foto dari server saat diterima.
- **Alihkan PJ** (LOG-43; LOG-L35): staf cabang asal, Kepala Toko, atau
  pemilik, alasan wajib; orang baru karyawan aktif cabang asal yang punya
  akun, sudah absen masuk, tidak di perjalanan lain. Bila orang baru berbeda
  dengan pengantar di nota kasir, kiriman bertanda **"pengantar beda dengan
  kasir"** (M4).
- **Pulang selama perjalanan berjalan** (M6): tombol Pulang di layar Absen
  ditolak: "Selesaikan perjalanan antar (Foto 3) dulu." Jalan keluar:
  **Tutup perjalanan** (LOG-L36) oleh Kepala Toko cabang itu, Kepala Gudang,
  atau pemilik, alasan wajib, tombol ditahan 3 detik; tujuan yang belum
  punya hasil menjadi Kirim Besok; perjalanan bertanda "ditutup kantor".
- **Perjalanan yang belum Foto 3 sampai 23.59** hari itu ditandai di
  Dashboard (4F-5) dan di Beranda Kepala Toko.

#### Pengantar dan bonus ongkir (LOG-42, 76, 77; M4, M5)

- **Pengantar di kasir menentukan bonus; pengantar di HRIS menentukan siapa
  yang mengantar** (M4). Biasanya sama. Bila beda (nama kasir belum
  dipasangkan, bukan karyawan cabang itu, atau PJ dialihkan), kiriman
  bertanda **"pengantar beda dengan kasir"**, tampil di LOG-L25 untuk staf
  cabang dan Kepala Toko dengan arahan "Betulkan pengantar di nota kasir
  supaya bonusnya untuk orang yang benar." Begitu kasir dibetulkan, bonus
  pindah sendiri lewat aturan perubahan dari kasir (spec Gaji bagian 3.4)
  dan tanda hilang.
- **Penulis bonus ongkir** (mesin, bagian 6): untuk tiap baris ongkir kasir
  yang bukan gratis ongkir dan pengantarnya sudah dipasangkan, memanggil
  **pintu tulis Buku Bonus** (jenis Ongkir, orang, tanggal nota, cabang nota,
  dasar = ongkir sesudah diskon, asal = nomor nota + cabang + baris ongkir).
  Nominal dihitung pintu tulis (50%, dibulatkan ke bawah, LOG-77). Baris
  lahir Disahkan (GAJ-26). Pengantar yang belum dipasangkan: ditunggu, lalu
  ditulis dengan tanggal nota begitu dipasangkan (PRI-39).
- **Tanda ⚠ foto antar tidak lengkap** (M5): bila nota berongkir itu dipakai
  laporan muat **berjalur antar sendiri**, dan sampai **23.59 hari
  berikutnya** sesudah tanggal nota perjalanannya belum Foto 3 (atau tidak
  pernah Foto 1, atau ditutup kantor), baris bonus diberi tanda ⚠ lewat pintu
  tulis. Bila Foto 3 menyusul, tanda dicabut sendiri. HR melihatnya di
  GAJ-L20 tab Ongkir ("⚠ saja") dan boleh membatalkan dengan alasan
  (GAJ-26). Nota berongkir yang tidak punya laporan muat (misalnya
  antar-jemput kucing, LOG-74) tidak diperiksa.
- Isian ongkir dan pengantar yang **diketik** sebelum sambungan menyala
  **tidak pernah** melahirkan bonus (LOG-42).

#### Uang tunai dari antar sendiri (titipan 4F-5)

Ke mana uang tunai yang dibawa pulang pengantar (laci cabang asal, Brankas,
atau Finance) dan bagaimana diperiksa ditetapkan di **4F-5** bersama
pemeriksaan uang jalur truk (LOG-62, 64, KEU-71). 4F-3 hanya mencatat cara
bayar dan uang diterima per nota.

#### LOG-L25. Laporan Muat

- **Letak:** Kerja Harian › Laporan Muat. **HP** (terbaca di PC).
- **Isi:** satu kartu per laporan cabangnya: toko tujuan, status, jalur,
  nota (nomor, nominal, sumber), jumlah paket, warna menunggu, tanda (segera
  Tandai Selesai, pengantar beda dengan kasir, barang di Gudang, berubah dari
  kasir, dijadwalkan di trip).
- **Tab:** Proses; Menunggu (dijemput dan diantar); Berjalan (di trip dan
  dalam perjalanan); Selesai (Terkirim); Perlu keputusan; Batal. Angka per
  tab.
- **Tombol:** **Buat laporan muat** (LOG-L26).
- **Beda jabatan:** pemilik memilih cabang (bawaan semua); Kepala Gudang,
  Marketing, dan Finance melihat semua cabang tanpa tombol (lewat Logistik ›
  Rencana & Trip dan Dashboard).
- **Pesan (kosong):** "Belum ada laporan muat. Tekan Buat laporan muat saat
  menyiapkan barang untuk toko."

#### LOG-L26. Buat Laporan Muat (3 langkah, TAM-07)

1. **Toko tujuan:** cari toko aktif; **Tambah cepat** bila belum ada (hanya
   sebelum sambungan pelanggan menyala). Pemilik memilih cabang asal dulu.
2. **Foto isi barang:** satu atau lebih; catatan.
3. **Paket:** satu foto per paket, bernomor. Tombol **Simpan** (status
   Proses). Pesan: "Laporan muat untuk Toko Maju tersimpan (3 paket). Tandai
   Selesai setelah nota kasir dibuat."

#### LOG-L27. Laporan Muat (rincian)

- **Letak:** dari LOG-L25. **HP.**
- **Isi:** toko, cabang asal, status dan riwayatnya, foto isi barang, paket
  (foto, nomor), nota dan ongkir dan pengantar (dengan sumber), trip atau
  perjalanan yang membawanya, hasil di toko (4F-4), perubahan (lama, baru,
  siapa, alasan).
- **Tombol menurut status:** Proses: **Tambah foto**, **Tambah paket**,
  **Tandai Selesai** (LOG-L28), **Batalkan** (alasan); Menunggu: **Ubah**
  (LOG-L29), **Kembalikan ke Proses** (alasan); sesudahnya: **Ubah** hanya
  untuk Pemilik dan GM.

#### LOG-L28. Tandai Selesai (3 langkah)

1. **Jalur:** Dijemput driver gudang / Diantar sendiri.
2. **Nota:** sesudah sambungan: pilih nota kasir (daftar transaksi cabang ke
   toko itu); sebelum: nomor struk dan nominal, ongkir. Jalur antar sendiri:
   pengantar (terisi dari kasir bila sah; bila tidak, pilih, dengan tanda
   beda).
3. **Periksa:** ringkasan, tombol **Tandai Selesai**. Pesan jalur driver:
   "Paket menunggu dijemput driver gudang." Jalur antar sendiri: "Tugas antar
   muncul di Antar Sendiri milik Rina."

#### LOG-L29. Ubah Laporan Muat (3 langkah)

1. **Yang diubah:** menurut tabel "Mengubah sesudah Selesai".
2. **Alasan** (wajib untuk ganti pengantar dan sesudah berangkat) dan
   **akibat** dalam kalimat.
3. **Simpan** (ditahan 3 detik bila nominal berubah sesudah berangkat).

#### LOG-L30. Jemput Paket Cabang

- **Letak:** dari pengingat di LOG-L16 dan tombol **Jemput paket** di kartu
  trip. **HP.**
- **Isi:** per cabang: laporan Menunggu dijemput (toko tujuan, jumlah paket,
  warna, tanda dijadwalkan ke trip ini); laporan yang dijadwalkan ke trip
  lain tidak tampil.
- **Ambil** (per laporan): foto paket dari cabang berdampingan dengan kotak
  centang; **Paket tidak lengkap** (catatan); lalu foto paket di mobil dan
  **Ambil**. Pesan: "3 paket Toko Maju masuk trip. Toko Maju ditambahkan ke
  kunjungan."

#### LOG-L31. Antar Sendiri

- **Letak:** Kerja Harian › Antar Sendiri. **HP.**
- **Isi:** kartu perjalanan yang berjalan (paling atas: tahap sekarang dalam
  satu kalimat besar, "Menuju Toko Maju", "Kembali ke cabang"); daftar
  kiriman Menunggu diantar untuk saya (warna menunggu); riwayat 7 hari
  (lebih lama dimuat saat diminta).
- **Tombol:** **Mulai antar** (LOG-L32); per tujuan **Sampai** (LOG-L33);
  **Kembali** (LOG-L34).
- **Beda jabatan:** Kepala Toko dan staf cabang melihat semua perjalanan
  cabangnya dengan tombol **Alihkan PJ**; Kepala Toko juga **Tutup
  perjalanan**.
- **Pesan (kosong):** "Tidak ada kiriman yang harus Anda antar."

#### LOG-L32. Mulai Antar (Foto 1, 2 langkah)

1. **Pilih kiriman** (centang; bawaan semua kiriman saya).
2. **Foto ambil barang**; tombol **Mulai**. Pesan: "Perjalanan dimulai
   10.12. Anda PJ."

#### LOG-L33. Sampai di Tujuan (Foto 2)

- **Isi:** nama toko besar, alamat, nomor HP, **Buka peta** atau **Pasang
  titik**; nota (nomor, nominal) per kiriman; **foto sampai**.
- **Tombol akhir:** **Terkirim** (cara bayar dan satu angka uang per tujuan, LOG-117; komponen
  Kirim 4F-4), **Kirim Besok**, **Gagal** (4F-4).
- Pesan: "Toko Maju terkirim. Uang cash Rp850.000 tercatat."

#### LOG-L34. Kembali (Foto 3, 2 langkah)

1. **Foto kembali** di cabang.
2. **Lama:** berangkat dan kembali dalam menit; bila selisih 20 menit atau
   lebih, pilih alasan. Tombol **Selesai**. Pesan: "Perjalanan selesai 11.05
   (53 menit)."

#### LOG-L35. Alihkan PJ (2 langkah)

1. **Orang baru:** karyawan aktif cabang asal yang punya akun, sudah absen
   masuk, tidak di perjalanan lain; tanda bila beda dengan pengantar kasir.
2. **Alasan** wajib; **Simpan**.

#### LOG-L36. Tutup Perjalanan (3 langkah)

1. **Perjalanan:** PJ, tahap, tujuan yang belum punya hasil.
2. **Alasan** dan **akibat** dalam kalimat ("1 toko menjadi Kirim Besok;
   bonus ongkir Toko Maju bertanda ⚠").
3. **Tutup:** tombol ditahan 3 detik.

#### LOG-L37. Perjalanan Antar Sendiri (rincian)

- **Letak:** dari LOG-L31 dan Dashboard (4F-5). **HP dan PC.**
- **Isi:** PJ (dan riwayat pengalihan), tiga foto dengan jam, peta lokasi
  tiap foto, jarak dari titik toko, lama berangkat dan kembali, alasan,
  hasil tiap tujuan, tanda (ditutup kantor, di luar titik toko, pengantar
  beda dengan kasir).
- Hanya baca.

### 3.4 Bagian 4F-4a: Kirim dan Uang

**Disetujui penuh 14 Oktober 2026** (K1 s.d. K6 "ok", sesuai saran; bagian 13; aturan
LOG-112 s.d. 118 di bagian 3.21 `../../aturan/04-logistik.md`).
4F-4 dipecah dua (disetujui pemilik 14 Oktober 2026): **4F-4a Kirim dan
Uang** (LOG-44 s.d. 54) dan **4F-4b Tidak Terkirim dan Retur** (LOG-55 s.d.
61).

Bahan: LOG-10, 11, 13, 14, 44 s.d. 54, 62 s.d. 65, 84, 86; LOG-99, 103,
107, 110; KEU-11, 69, 71; TAM-07, 08, 15; PRI-02, 28, 39; arsip
`../../aturan/arsip/04-logistik-galian.md` LOG-C01 s.d. C18 dan bagian 4C.9.

**Pokoknya:** di toko, barang diturunkan lalu ditekan **Kirim**. Dalam satu
layar bertahap dicatat: foto, barang yang dipotong dari nota, barang salah
muat atau lebih, cara bayar, dan uang yang diterima. Semua tersimpan dalam
**satu langkah server** (LOG-47). Server lalu membagi uang ke tiap nota
dengan **satu rumus** (LOG-112). Layar Kirim yang sama dipakai truk gudang
(LOG-L18) dan antar sendiri (Foto 2, LOG-L33).

#### Layar Kirim: satu komponen untuk dua jalur (LOG-47, 50; K5)

| | Truk gudang (LOG-L18) | Antar sendiri (LOG-L33) |
|---|---|---|
| Siapa | Awak yang memegang kunjungan (LOG-26) | PJ perjalanan |
| Foto terkirim | Langkah 1: foto barang di toko (kamera langsung) | Dilewati; Foto 2 sudah menjadi fotonya |
| Nota | Semua nota kunjungan: surat jalan dan nota cabang dari paket (LOG-10, 105) | Semua nota tujuan itu (satu atau lebih laporan muat cabang yang sama) |
| Uang | **Satu angka** untuk semua nota, dibagi server (LOG-112) | Sama (K5) |
| Pemilik barang | Gudang atau cabang pemilik nota | Selalu cabang asal |

Langkah layar Kirim (LOG-L38):

1. **Foto terkirim** (truk saja).
2. **Potong nota dan barang kejadian:** dua pertanyaan, masing-masing
   **Tidak ada** / **Ada**. "Ada" membuka daftar barang (LOG-L39, L40).
3. **Cara bayar dan uang:** pilihan dan isiannya menurut tabel di bawah.
   Di atasnya tampil tagihan per nota.
4. **Periksa:** ringkasan dalam kalimat dan angka, tombol **Simpan Kirim**
   ditahan 3 detik (TAM-15), karena menyangkut uang.

#### Cara bayar (LOG-44, 45; K1)

| Cara bayar | Isian wajib | Catatan |
|---|---|---|
| **Cash** | Uang diterima > 0 | Uang fisik dibawa awak (ke mana diserahkan: 4F-5) |
| **Transfer** | Uang diterima > 0, **foto bukti transfer** | Tanpa bukti tidak bisa dipilih; pilih Deposit atau Tempo (LOG-44) |
| **Deposit** | Uang yang dijanjikan toko > 0 | Toko mengaku sudah atau akan transfer tanpa bukti; finance memastikan masuk rekening (4F-5). Kata pemilik: sering hanya cara halus untuk tempo |
| **Tempo** | Tanggal jatuh tempo (besok sampai 60 hari) | Uang diterima Rp0 |
| **Campuran** | Uang cash > 0 **dan** uang transfer > 0, foto bukti untuk bagian transfer | Kasus jarang (LOG-45). Total = cash + transfer |

- Foto bukti transfer: **kamera atau galeri, tanpa batas umur** (TAM-08),
  karena bukti biasanya dikirim toko lewat WhatsApp. Server menolak Transfer
  dan Campuran tanpa foto di **semua** jalan masuk, termasuk ubah
  pembayaran (LOG-44).
- **Kurang bayar** (K1): bila uang lebih kecil dari tagihan, kekurangan
  yang **bukan** karena potong nota menunggu keputusan wajib diberi
  **tanggal janji bayar sisa** (besok sampai 60 hari, bawaan 7 hari).
  Tanggal ini ikut daftar kiriman ke kasir (4F-5) dan daftar tagih
  Marketing (LOG-66). Kurang bayar tidak menghambat Kirim (LOG-46).
- **Lebih bayar**: uang lebih besar dari tagihan memunculkan pertanyaan
  kedua "Uang lebih Rp200.000 dari tagihan. Benar toko menitipkan
  kelebihannya?" (Ya / Betulkan angka). Yang "Ya" menjadi **titipan toko**
  (LOG-49), dicatat untuk cabang pemegang uang (K2).
- Toko yang bayar sebagian cash dan sisanya tempo: pilih **Cash**, ketik
  uangnya, isi tanggal janji bayar sisa. Tidak ada "Tempo dengan uang muka".

#### Rumus pembagian uang ke nota (LOG-46, 112)

Satu fungsi server, **bagi uang kunjungan**, dipakai di semua tempat yang
mengubah angka (WAJ-04): Kirim, ubah pembayaran, ubah nominal nota sesudah
berangkat (LOG-11, 107), keputusan potong nota, dan Tidak Cocok saat
pemeriksaan (4F-5). Hasil lama ditandai **Diganti**, tidak dihapus (PRI-02).

1. **Tagihan nota** = nominal nota − potongan **disetujui** milik nota itu.
   Potongan seorang pemilik barang dikurangkan dari **nota terbesar milik
   pemilik itu** dulu; bila melebihi, sisanya ke nota berikutnya milik
   pemilik yang sama. Potongan menunggu atau ditolak tidak mengurangi
   tagihan; ia dihitung sebagai kurang bayar (LOG-52).
2. **Urutan nota:** tagihan terbesar dulu; tagihan sama: Nota Gudang dulu;
   masih sama: nomor nota lebih kecil dulu.
3. **Uang dibagi** menurut urutan: tiap nota diisi penuh sebelum nota
   berikutnya.
4. **Sisa uang** sesudah semua nota penuh = **lebih bayar** (titipan toko).
5. **Kurang** per nota = tagihan − bagian uang.
6. Campuran: total cash + transfer dibagi sebagai satu angka; bagian cash
   dan transfer per nota mengikuti urutan yang sama, **cash dulu**, supaya
   pemeriksaan finance (4F-5) bisa mencocokkan uang fisik per nota.
7. Semua bilangan bulat rupiah (PRI-28); tidak ada pembulatan karena tidak
   ada pembagian persen.

Contoh: nota Gudang 0451 Rp2.000.000 dan nota cabang Raja 0112 Rp850.000,
potong nota Raja disetujui Rp50.000, uang cash Rp2.500.000. Tagihan: Gudang
Rp2.000.000, Raja Rp800.000. Bagian: Gudang Rp2.000.000 (lunas), Raja
Rp500.000 (kurang Rp300.000, tanggal janji bayar sisa wajib).

#### Potong nota (LOG-51, 52; LOG-L39, L42, L43)

- **Per barang:** nama barang, nominal (bulat, > 0), alasan (salah muat,
  rusak atau kedaluwarsa, kurang jumlah, harga beda, lainnya + keterangan),
  **nasib barang** (dibawa kembali / memang tidak ada), **pemilik barang**
  (terisi sendiri bila kunjungan hanya punya satu pemilik; bila dua, dipilih
  dari pemilik nota di kunjungan). **Satu foto wajib** per kunjungan
  (kamera langsung), boleh lebih.
- **Batas:** jumlah potongan seorang pemilik tidak boleh melebihi jumlah nota
  pemilik itu di kunjungan; server menolak dengan menyebut angkanya.
- **Keputusan** (LOG-L42, L43): **Finance, Pemilik, GM**. HR dan Marketing
  tidak (LOG-52, 84). Setujui, atau Tolak dengan alasan. Setiap keputusan
  menjalankan ulang pembagian (LOG-112). Keputusan bisa diubah sampai nota
  tercatat di kasir (LOG-14); isi potongan terkunci begitu barangnya
  diterima pemilik (LOG-54).
- **Potongan dibawa kembali** melahirkan satu baris **barang kembali**
  (LOG-115).
- **Tidak ada potongan yang dihapus.** Mengubah daftar potongan membatalkan
  baris lama (alasan "diubah") dan menulis baris baru; potongan yang sudah
  diputuskan lalu diubah isinya kembali **Menunggu** (LOG-116).

#### Barang kejadian (LOG-53; K6; LOG-L40)

- **Per barang:** jenis (**salah muat** / **barang lebih**), barang yang
  terkirim, seharusnya barang apa (salah muat), jumlah, pemilik barang,
  keterangan, dan **nasib**: **dibawa pulang** atau **dibeli toko**. Satu
  foto wajib (kamera langsung).
- **Dibawa pulang:** melahirkan satu baris barang kembali (LOG-115).
- **Dibeli toko, salah muat:** toko memakai barang yang salah sebagai ganti.
  Bila harganya lebih murah, selisihnya dicatat lewat **potong nota alasan
  "harga beda"** di langkah yang sama (LOG-53).
- **Dibeli toko, barang lebih** (K6): barang itu belum ada notanya.
  Uang yang dibayar toko untuk barang itu diketik bersama uang lainnya dan
  terbaca sebagai **lebih bayar** (titipan toko). Baris barang kejadian
  masuk daftar **"Perlu nota di kasir"** milik cabang pemilik barang
  (LOG-L44 tab Koreksi), yang membuat penjualan baru di kasir dan memakai
  titipan itu untuk melunasinya, lalu menekan **Sudah dibuat di kasir**
  (nomor struk wajib).
- **Dibeli toko** apa pun jenisnya juga masuk tab Koreksi untuk koreksi stok
  pemilik barang di kasir.

#### Barang kembali ke pemiliknya (LOG-54; K3; LOG-L44 s.d. L46)

Satu daftar **barang kembali** untuk semua sumber: potong nota dibawa
kembali, barang kejadian dibawa pulang, dan **retur** (4F-4b memakai daftar
dan layar yang sama).

| Pemilik barang | Jalur | Diserahkan kapan | Menahan |
|---|---|---|---|
| Cabang selain Gudang | Truk | Awak mengantar ke cabang itu sebelum pulang; **Serahkan** dengan foto (kamera langsung) | Bak kosong / Menuju Garasi (LOG-28, sudah di 4F-2) |
| **Gudang** | Truk | Diserahkan di Gudang **sebagai langkah lapor garasi**, sebelum foto amper; satu foto untuk semua barang milik Gudang | Lapor garasi, **bukan** Menuju Garasi (K3) |
| Cabang asal | Antar sendiri | Diserahkan **saat Foto 3** di cabang asal; Foto 3 sekaligus foto serah | Foto 3 |

- **Diterima** (LOG-L46): staf cabang pemilik (untuk Gudang: Kepala Gudang
  atau staf Gudang yang diberi hak), atau pemilik. Satu foto (kamera atau
  galeri, 2 menit) dan pilihan **Sesuai** / **Tidak sesuai** (kurang atau
  beda, catatan dan foto wajib). "Tidak sesuai" ditinjau Kepala Gudang
  (layar tinjau ditetapkan di 4F-4b bersama retur, LOG-61).
- Sesudah **Diterima**, isi potongan sumbernya terkunci (LOG-54).
- Barang Diserahkan yang belum Diterima lebih dari 3 hari tampil di
  Dashboard (LOG-80, 4F-5) dan Beranda cabang pemilik.
- **Jalan keluar** (WAJ-11): barang yang tidak bisa diantar hari itu
  (cabang tutup) boleh dibawa ke Gudang oleh awak; Kepala Gudang atau
  pemilik menekan **Alihkan ke Gudang** (alasan), lalu Gudang yang
  mengantar ke pemiliknya lewat trip berikutnya sebagai barang kembali yang
  sama. Trip tidak tertahan.

#### Satu langkah server (LOG-47; LOG-99)

**Simpan Kirim** dalam satu transaksi server: kunjungan atau tujuan
Terkirim; foto; lokasi dan jarak dari titik toko (di luar radius ditandai,
LOG-99); pembayaran; potongan dan barang kejadian; baris barang kembali;
pembagian uang (LOG-112); surat jalan dan laporan muat **Terkirim**;
pemanggilan penutup tertunda toko itu (LOG-57, isinya 4F-4b). Satu gagal:
semua batal, isian tetap di layar (TAM-16), pesan "OK, paham" menyebut yang
salah. Dua awak menekan bersamaan: yang kedua menerima "Sudah dikirim oleh
Dedi pukul 10.42", bukan error.

#### Mengubah pembayaran dan potongan (LOG-48; K4; LOG-L41)

| Jalur | Selama | Oleh | Sesudahnya |
|---|---|---|---|
| Truk | Trip belum Selesai | Driver dan kenek trip itu | Kepala Gudang, Pemilik, GM, alasan wajib |
| Antar sendiri | Perjalanan belum Foto 3 | PJ | Kepala Toko cabang asal, Kepala Gudang, Pemilik, GM, alasan wajib |

- Yang bisa diubah: cara bayar, uang, foto bukti, tanggal jatuh tempo atau
  janji bayar sisa; daftar potongan dan barang kejadian.
- **Terkunci** saat pemeriksaan finance Cocok atau Tidak Cocok berlaku
  (dibuka hanya lewat pembatalan pemeriksaan beralasan, LOG-63, 4F-5) dan
  saat nota tercatat di kasir (sesudahnya koreksi oleh finance atau
  pemilik, LOG-14, 4F-5). Potongan juga terkunci sesudah barangnya
  Diterima (LOG-54).
- Setiap perubahan menulis pembayaran baru dan menandai yang lama
  **Diganti** (lama, baru, siapa, kapan, alasan), lalu menjalankan ulang
  pembagian.
- Perubahan oleh kantor sesudah trip Selesai memberi tahu Finance.

#### LOG-L38. Kirim (4 langkah, TAM-07)

- **Letak:** tombol **Kirim** di LOG-L18 dan **Terkirim** di LOG-L33.
  **HP.**
- **Langkah:** (1) foto terkirim (truk); (2) potong nota? barang kejadian?;
  (3) cara bayar dan uang, dengan daftar tagihan per nota (nomor, pemilik,
  nominal, potongan); (4) periksa.
- **Periksa:** "Tagihan Rp2.850.000 (2 nota). Potongan menunggu Rp50.000.
  Cash diterima Rp2.500.000. Kurang Rp300.000, janji bayar 21 Oktober."
  Pembagian per nota tampil di bawahnya (perkiraan; angka akhir dari
  server).
- **Tombol:** **Simpan Kirim** (ditahan 3 detik). Pesan: "Toko Maju
  terkirim. Cash Rp2.500.000 tercatat. Potongan Rp50.000 menunggu
  keputusan Finance."
- Kembali di tiap langkah; isian tidak hilang (TAM-16).

#### LOG-L39. Potong Nota (isian)

- **Letak:** langkah 2 LOG-L38 dan LOG-L41. **HP.**
- **Isi:** daftar barang (nama, nominal, alasan, nasib, pemilik), tombol
  **Tambah barang**, foto; jumlah potongan per pemilik dan batasnya.

#### LOG-L40. Barang Kejadian (isian)

- **Letak:** langkah 2 LOG-L38 dan LOG-L41. **HP.**
- **Isi:** daftar barang (jenis, terkirim, seharusnya, jumlah, pemilik,
  nasib, keterangan), **Tambah barang**, foto. Bila nasib "dibeli toko" dan
  jenis salah muat: tautan "Harga lebih murah? Tambah potong nota harga
  beda".

#### LOG-L41. Ubah Pembayaran (3 langkah)

- **Letak:** rincian kunjungan (LOG-L14, L18) dan perjalanan (LOG-L37).
  **HP dan PC.**
- (1) yang diubah (uang, potongan, kejadian); (2) isian baru dan **akibat**
  dalam kalimat ("Bagian nota Raja berubah dari Rp500.000 menjadi
  Rp800.000; kurang menjadi Rp0"); alasan (wajib untuk kantor); (3)
  **Simpan** ditahan 3 detik.
- Bila terkunci: tombol tidak tampil; keterangan menyebut sebabnya
  ("Sudah diperiksa Finance 15 Oktober. Minta Finance membatalkan
  pemeriksaan.").

#### LOG-L42. Potong Nota Menunggu

- **Letak:** Logistik › Potong Nota. **PC** (terbaca di HP).
- **Isi:** baris potongan (tanggal, toko, nota, pemilik, barang, nominal,
  alasan, nasib, foto, pencatat, umur). Tab: Menunggu, Disetujui, Ditolak,
  Semua. Angka penanda di menu untuk Finance.
- **Dipakai:** Finance, Pemilik, GM memutuskan; Kepala Gudang dan
  Marketing melihat.

#### LOG-L43. Putuskan Potong Nota (2 langkah)

1. **Keputusan:** Setujui / Tolak (alasan wajib); bisa beberapa baris
   sekaligus dari toko yang sama.
2. **Akibat** ("Tagihan Raja 0112 turun Rp50.000; kurang bayar Toko Maju
   menjadi Rp250.000"), tombol ditahan 3 detik.

#### LOG-L44. Barang Kembali

- **Letak:** Kerja Harian › Barang Kembali (staf cabang, Kepala Gudang);
  tautan dari LOG-L16 dan LOG-L21 (awak). **HP** (terbaca di PC).
- **Tab:** **Harus diantar** (awak: barang di trip-nya); **Menunggu
  diterima** (cabang pemilik); **Tidak sesuai**; **Koreksi** (dibeli toko:
  koreksi stok dan "Perlu nota di kasir"); **Selesai**.
- **Isi baris:** sumber (potong nota, kejadian, retur), toko asal, barang,
  jumlah, pemilik, pembawa, umur, foto.
- **Tombol:** **Serahkan** (awak, LOG-L45), **Terima** (cabang, LOG-L46),
  **Sudah dikoreksi di kasir** / **Sudah dibuat di kasir** (nomor struk),
  **Alihkan ke Gudang** (Kepala Gudang, pemilik).

#### LOG-L45. Serahkan Barang (2 langkah)

1. Pilih barang (bawaan: semua untuk cabang ini).
2. Foto serah (kamera langsung), **Serahkan**. Pesan: "3 barang diserahkan
   ke Raja. Menunggu Raja menerima." Barang milik Gudang diserahkan di
   langkah lapor garasi (LOG-L21) dengan isian yang sama.

#### LOG-L46. Terima Barang (2 langkah)

1. Barang yang diserahkan dan fotonya; **Sesuai** / **Tidak sesuai**
   (catatan, foto).
2. Foto terima, **Terima**. Pesan: "Barang diterima. Potongan Toko Maju
   terkunci."

### 3.5 Bagian 4F-4b: Tidak Terkirim dan Retur

**Disetujui penuh 14 Oktober 2026** (T1 s.d. T7 "ok", sesuai saran; bagian 13;
aturan LOG-119 s.d. 126 di bagian 3.22 `../../aturan/04-logistik.md`).

Bahan: LOG-09, 19 s.d. 23, 27, 28, 33, 51, 52, 54 s.d. 61, 65, 80, 84,
86, 88; LOG-96, 99, 101, 103, 107, 110, 111, 115, 116; GAJ-75 (kehilangan
barang); TAM-07, 08, 15; PRI-02, 39, 41; arsip
`../../aturan/arsip/04-logistik-galian.md` LOG-A18, A19, A33 s.d. A36,
LOG-C19 s.d. C31; memory sistem lama "retur ditugaskan kantor".

**Pokoknya:** tidak semua kiriman sampai. Toko tutup → **Kirim Besok**,
kiriman kembali ke antrean. Toko menolak → **Gagal**, kiriman menunggu
**keputusan** (jadwal ulang atau batal). Keduanya dicatat di **satu tempat:
Tertunda**. **Retur** adalah kebalikan kiriman: kantor menugaskan truk
mengambil barang dari toko; barangnya masuk daftar barang kembali (4F-4a),
lalu nilainya disahkan Finance untuk mengurangi tagihan toko di kasir.

#### Kirim Besok dan Gagal (LOG-55, 56; LOG-L47, L48)

| | Kirim Besok | Gagal |
|---|---|---|
| Arti | Toko belum bisa menerima hari ini; kiriman tetap jalan | Toko tidak mau menerima; kiriman perlu diputuskan |
| Alasan (pilih) | Toko tutup; tidak ada yang menerima; toko minta lain hari; lainnya + keterangan | Ditolak toko; batal pesan; toko pindah atau tidak ditemukan; lainnya + keterangan |
| Foto | Wajib, kamera langsung | Wajib, kamera langsung |
| Lokasi | Dicatat dengan jarak dari titik toko; di luar radius ditandai untuk Kepala Gudang, tidak ditolak (sama dengan Kirim, LOG-99) | Sama |
| Kiriman sesudahnya | Surat jalan **Menunggu dijadwalkan**; laporan muat **Menunggu dijemput** (truk) atau **Menunggu diantar** (antar sendiri) | Surat jalan dan laporan muat **Perlu keputusan** |
| Tertunda | Dibuka atau ditambah hitungannya, satu catatan per kiriman (LOG-119) | Sama, berjenis Gagal |
| Uang | Tidak ada | Tidak ada |

- Berlaku untuk **seluruh kunjungan atau tujuan**: semua surat jalan dan
  paket di dalamnya ikut. Toko yang menerima sebagian: lihat "Toko menolak
  sebagian" (LOG-122).
- **Satu langkah server**, sama dengan Simpan Kirim: hasil kunjungan atau
  tujuan, foto, lokasi, status tiap kiriman, dan catatan tertunda. Dua awak
  menekan bersamaan: yang kedua menerima "Sudah dicatat Kirim Besok oleh
  Dedi pukul 10.42".
- Tombol **Simpan** biasa, tidak ditahan 3 detik: tidak menyangkut uang
  (TAM-15).
- **Selesai lebih awal** (LOG-L20), **Tutup trip oleh kantor** (LOG-L22),
  dan **Tutup perjalanan** (LOG-L36) menjadikan sisa kunjungan Kirim Besok
  memakai alasan dan foto dari langkah itu (satu foto untuk semua); asal
  catatannya menyebut langkah tersebut. Tugas retur yang belum dikerjakan
  kembali **Menunggu ditugaskan** (bukan tertunda, karena retur bukan
  kiriman), sama seperti tugas belanja kembali Menunggu.
- **Dilepas kantor** (LOG-22) bukan Kirim Besok: kiriman kembali ke antrean
  tanpa catatan tertunda, karena bukan toko yang menunda.

#### Barang yang tidak terkirim (LOG-120; T2)

| Jalur | Barang | Ke mana | Status kiriman sesudahnya |
|---|---|---|---|
| Truk | Surat jalan (milik Gudang) | Pulang bersama truk, diturunkan di Gudang | Menunggu dijadwalkan / Perlu keputusan |
| Truk | Paket cabang | Pulang bersama truk dan **menunggu di Gudang**; laporan muat bertanda **"barang di Gudang"** (tanda yang sudah ada di 4F-3) | Menunggu dijemput, ditugaskan kantor ke rencana tanpa jemput ke cabang / Perlu keputusan |
| Antar sendiri | Paket cabang | Dibawa kembali ke cabang asal saat Foto 3 | Menunggu diantar / Perlu keputusan |

- Langkah **bak kosong** (LOG-L21) menampilkan "Masih di bak: surat jalan
  0451 Toko Maju (Kirim Besok), paket Raja 0112 Toko Sinar (Gagal), 2
  barang kembali milik Gudang"; fotonya memperlihatkan sisa itu. Nama
  langkahnya tetap; artinya "semua tujuan sudah dikunjungi".
- Di **lapor garasi**, sesudah serah barang kembali milik Gudang (K3), awak
  menekan **Diturunkan di Gudang** untuk semua kiriman yang tidak terkirim
  (satu foto). Sejak itu letak barang di catatan tertunda = Gudang.
- Barang tidak terkirim **bukan barang kembali**: ia tetap kiriman yang
  menunggu jadwal atau keputusan. Ia baru menjadi barang kembali bila
  diputuskan Batal, atau dijadwalkan ulang lewat antar sendiri sementara
  barangnya di Gudang (lihat Perlu keputusan).

#### Coba lagi hari ini (LOG-121; T3)

- Kunjungan atau tujuan **Kirim Besok** boleh dibuka lagi dengan tombol
  **Coba lagi** (LOG-L18, L33) oleh awak trip itu selama trip masih
  **Berjalan**, atau oleh PJ selama perjalanan belum Foto 3. Catatan Kirim
  Besok itu berstatus **Dicoba lagi** (tidak dihapus) dan kiriman kembali
  ke kunjungan. Catatan tertunda ikut mundur: bila Kirim Besok itu yang
  membukanya, catatan berstatus Dicoba lagi; bila bukan, hitungannya
  berkurang satu.
- Supaya barang yang masih di truk tidak dijadwalkan ke trip lain: surat
  jalan dan paket Kirim Besok **tidak bisa dimasukkan rencana lain selama
  trip pembawanya masih Berjalan**; server menolak dengan menyebut trip-nya.
  Sesudah Menuju Garasi, boleh. Antar sendiri: laporan muat baru bisa Mulai
  antar lagi sesudah Foto 3 perjalanan sebelumnya.
- **Gagal tidak bisa Coba lagi**; jalannya Perlu keputusan.

#### Perlu keputusan (LOG-56, 123; T5; LOG-L50)

| Kiriman | Yang memutuskan | Pilihan |
|---|---|---|
| Surat jalan | Kepala Gudang, Pemilik, GM | **Jadwal ulang** → Menunggu dijadwalkan (paling atas, LOG-20); **Batal** (alasan wajib) |
| Laporan muat | Staf cabang asal, Kepala Toko cabang asal, Kepala Gudang, Pemilik, GM | **Jadwal ulang** dengan memilih jalur lagi (driver, atau antar sendiri dengan pengantar); **Batal** (alasan wajib) |

- Jalur boleh diganti di sini: jalur hanya terkunci selama barang di tangan
  orang lain (LOG-107), dan sekarang barang sudah kembali.
- **Laporan muat yang barangnya di Gudang:** jadwal ulang jalur driver →
  Menunggu dijemput bertanda barang di Gudang. Jalur antar sendiri, atau
  Batal → barangnya menjadi **barang kembali** ke cabang asal (sumber
  "tidak terkirim"), diantar trip berikutnya seperti barang yang Dialihkan
  ke Gudang (K3). Laporan berjalur antar sendiri baru bisa Mulai antar
  sesudah barang itu Diterima cabang asal.
- **Batal** (LOG-123; T5): surat jalan atau laporan muat berstatus Batal di
  HRIS (alasan "Gagal: ..."), notanya tidak lagi ditagih lewat HRIS, dan
  satu baris **"Batalkan penjualan di kasir"** per nota masuk daftar
  kiriman ke kasir untuk Finance (isi daftar di 4F-5). Pembatalan yang
  kemudian tertarik dari kasir untuk nota itu **dicocokkan sendiri** dan
  tidak masuk Perlu Diperiksa. Ini pengecualian sempit atas LOG-96 ("surat
  jalan bersumber kasir tidak dibatalkan di HRIS"), hanya untuk kiriman
  yang Gagal.
- Langkah (TAM-07): pilihan + alasan, lalu akibat dalam kalimat. **Batal**
  ditahan 3 detik karena mengubah tagihan toko lewat kasir; Jadwal ulang
  memakai tombol biasa.
- **Jalan keluar** (WAJ-11): keputusan **Batal** dibuka lagi oleh Pemilik
  atau GM dalam 7 hari, selama penjualannya belum dibatalkan di kasir;
  kiriman kembali Perlu keputusan dan baris kiriman ke kasir dibatalkan.
  Keputusan **Jadwal ulang** tidak dibuka lagi; kiriman itu sudah di antrean
  biasa dan dibatalkan lewat jalan biasa (LOG-12 untuk surat jalan manual,
  Diambil toko, atau pembatalan di kasir, LOG-96).

#### Tertunda (LOG-57, 119; T1; LOG-L49, L51)

- **Satu catatan per kiriman** (surat jalan atau laporan muat), bukan per
  kunjungan. Catatan dibuka saat Kirim Besok atau Gagal pertama; Kirim
  Besok berikutnya menambah hitungan ("3 kali") dan mengganti alasan
  terakhir, tidak membuat catatan baru.
- **Isi:** toko, kiriman (nomor, pemilik nota, nominal), jalur, jenis
  terakhir (Kirim Besok, Gagal), alasan dan foto terakhir, berapa kali,
  **sejak** (tanggal Kirim Besok atau Gagal pertama), letak barang (di truk
  trip mana, Gudang, cabang asal), status.
- **Status:** **Menunggu jadwal** (dari Kirim Besok), **Perlu keputusan**
  (dari Gagal), **Selesai** (tertutup sendiri), **Ditutup** (manual),
  **Dicoba lagi** (Kirim Besok pembukanya dibatalkan lewat Coba lagi).
  Kiriman Menunggu jadwal yang kemudian Gagal pindah ke Perlu keputusan di
  catatan yang sama.
- **Merah** bila lebih dari 3 hari sejak tanggal pertama (LOG-57, 88).
  Tampil di Dashboard (LOG-80, 4F-5).
- **Tertutup sendiri** saat kiriman **itu** Terkirim, ditandai Diambil
  toko, atau Batal. Kiriman lain milik toko yang sama **tidak** ikut
  tertutup (T1; pelapis kalimat terakhir LOG-57).
- **Tutup manual** (LOG-L51) oleh Kepala Gudang atau pemilik, keterangan
  wajib, hanya untuk **Menunggu jadwal**: kiriman tetap di antreannya,
  tetapi tidak lagi merah dan tidak lagi di atas daftar pilihan rencana.
  Contoh: "Toko libur sampai 20 Oktober, kirim minggu depan." Perlu
  keputusan tidak bisa ditutup manual; ia harus diputuskan. Catatan yang
  ditutup dibuka lagi oleh penutup atau pemilik; Kirim Besok berikutnya
  sesudah ditutup membuka catatan baru.
- Kolom "pernah tertunda" di surat jalan (LOG-20) diisi dari catatan ini;
  laporan muat memakai urutan yang sama di daftar Jemput Paket Cabang.

#### Toko menolak sebagian (LOG-122; T4)

- Kirim Besok dan Gagal berlaku untuk seluruh kunjungan. Toko yang
  **menerima sebagian nota dan menolak satu nota utuh**: tekan **Kirim**,
  lalu nota yang ditolak dicatat sebagai **potong nota senilai notanya**
  dengan alasan baru **"ditolak toko"**, nasib dibawa kembali (LOG-51).
  Diputuskan Finance seperti potongan lain (LOG-52); barangnya menjadi
  barang kembali (LOG-115).
- Toko menolak **sebagian barang** dalam satu nota: potong nota biasa
  (sudah di 4F-4a).
- Potong nota "ditolak toko" yang disetujui membuat tagihan nota itu Rp0;
  Finance mencatatnya di kasir lewat kiriman ke kasir (LOG-65). Bila kelak
  toko mau barangnya lagi, dibuat penjualan baru.
- Kenapa tidak Gagal per nota: layar Kirim yang sudah disetujui tetap satu
  jalan, dan penolakan yang mengubah tagihan tetap disahkan Finance (yang
  menagih bukan yang mengesahkan, LOG-84).

#### Retur (LOG-58 s.d. 61, 124, 126)

| Status | Masuk lewat | Syarat di server | Oleh |
|---|---|---|---|
| **Menunggu ditugaskan** | Tandai retur (LOG-L53) | Toko aktif; tidak ada retur lain toko itu yang belum Selesai, Tanpa barang, atau Dibatalkan (LOG-58); cabang penerima dipilih | Kepala Gudang, Marketing, Finance, Pemilik, GM |
| **Di trip** | Ditugaskan ke rencana (LOG-L13 langkah 3; LOG-L14 sesudah berangkat) | Rencana Draft, Siap Kirim, atau Berjalan | Kepala Gudang, Pemilik, GM |
| **Diambil** | Selesai di toko (LOG-L55) | Minimal satu barang; foto posisi akhir; keterangan letak | Awak trip itu |
| **Tanpa barang** | Tidak ada barang (LOG-L55) | Foto toko dan alasan | Awak trip itu |
| **Menunggu nilai** | Otomatis saat semua barangnya Diterima dan tinjau "Tidak sesuai" selesai | — | Server |
| **Selesai** | Sahkan nilai (LOG-L56) | Nilai tiap barang terisi | Finance, Pemilik, GM |
| **Dibatalkan** | Batalkan | Hanya Menunggu ditugaskan, alasan wajib (LOG-58) | Penanda, Kepala Gudang, Pemilik, GM |

- **Tandai retur** (LOG-58; LOG-L53): toko, cabang penerima (bawaan
  Gudang), catatan permintaan toko (barang apa, perkiraan jumlah; tidak
  wajib). Kepala Gudang dan pemilik boleh menandai sekaligus menugaskan ke
  trip yang sedang Berjalan dari HP (kejadian 111).
- **Lepas** dari trip selama belum dikerjakan awak → Menunggu ditugaskan.
  Trip dibatalkan → Menunggu ditugaskan (LOG-23). Selesai lebih awal atau
  trip ditutup kantor dengan retur yang belum dikerjakan → Menunggu
  ditugaskan, bertanda "terlewat [tanggal]".
- **Di toko** (LOG-59; LOG-L55): awak mencatat **tiap barang**: foto
  (kamera langsung), nama, **jumlah** (bulat lebih dari 0) dan satuan
  (dus, pcs, sak, lainnya), alasan (rusak, kedaluwarsa, tidak laku, salah
  kirim, lainnya + keterangan), **pemilik barang** (cabang; bawaan cabang
  penerima). Barang yang salah dicatat dibatalkan (tidak dihapus) selama
  retur belum Diambil.
- **Selesai:** foto posisi akhir barang di mobil dan keterangan letak
  ("bak belakang kiri"). Satu langkah server: retur Diambil, tiap barang
  menjadi **barang kembali** (sumber retur) ke pemiliknya, dan aturan serah
  K3 berlaku (milik Gudang diserahkan saat lapor garasi, milik cabang lain
  sebelum Menuju Garasi). Cabang penerima yang bukan pemilik barang hanya
  diberi tahu.
- **Tidak bisa diambil hari ini** (toko tutup, orangnya tidak ada): foto
  dan alasan; retur kembali **Menunggu ditugaskan** bertanda "dicoba
  [tanggal]". **Tidak ada barang** (toko batal retur, barang sudah dibuang):
  foto toko dan alasan; retur berakhir **Tanpa barang**.
- **Ritase:** trip yang membawa tugas retur tetap punya ritase walaupun
  retur tanpa barang atau tidak bisa diambil (LOG-33; tes U11).
- **Penerimaan** (LOG-61): lewat Barang Kembali (LOG-L44, L46) sama dengan
  barang kembali lain, dengan Sesuai atau Tidak sesuai. Menu "Terima Retur"
  di menu v1 adalah layar yang sama; nama menunya menjadi **Barang
  Kembali** (dicatat di backlog susun ulang menu).
- **Nilai retur** (LOG-60, 124; T6; LOG-L56): Finance atau pemilik mengisi
  **nilai rupiah per barang** sesudah semua barang Diterima, berpatokan
  harga jual di nota kasir toko itu. Jumlah yang dinilai = jumlah
  **diterima** (sesudah tinjau). Rp0 boleh dengan alasan (barang tidak
  bernilai, toko tidak minta dikurangi). Disahkan → retur Selesai; nilai
  per cabang pemilik barang masuk **kiriman ke kasir** "kurangi tagihan
  toko" (4F-5). Nilai yang sudah disahkan diubah dengan alasan sampai
  tercatat di kasir (sejalan LOG-52, 14).
- **Retur hanya lewat trip truk.** Antar sendiri tidak mengambil retur.
  Toko yang membawa barang sendiri ke cabang adalah retur penjualan di
  kasir, bukan HRIS.
- **Kabari kantor:** di kunjungan ada tombol **Toko mau retur** yang
  mengirim Antrean ke Kepala Gudang (toko dan catatan). Tombol ini tidak
  membuat retur; driver tetap tidak menandai retur sendiri (LOG-58).

#### Tinjau barang tidak sesuai (LOG-61, 125; T7; LOG-L57)

Berlaku untuk **semua** barang kembali yang diterima **Tidak sesuai**:
retur, potong nota, kejadian, dan tidak terkirim.

- **Oleh** Kepala Gudang atau pemilik; bukan penyerah atau penerima barang
  itu.
- Tampil berdampingan: foto serah, foto terima, catatan, jumlah
  diserahkan.
- Pilihan: **Sesuai setelah dicek** (barang ketemu atau salah hitung;
  catatan wajib) atau **Selisih dicatat** (jumlah yang benar-benar diterima
  diketik; selisih tercatat). Pada Selisih dicatat ada pilihan tambahan
  **Teruskan ke HR sebagai kehilangan barang**: membuka usulan kehilangan
  barang di Gaji (GAJ-75, GAJ-L12) dengan barang, jumlah, foto, dan nama
  pembawa sebagai bahan. HR dan Pemilik atau GM yang memutuskan siapa
  menanggung; Logistik tidak memotong gaji.
- Barang kembali tetap Diterima; tinjau menambah catatan dan jumlah
  sebenarnya. Retur menunggu tinjau selesai sebelum masuk Menunggu nilai.
- "Tidak sesuai" yang belum ditinjau lebih dari 3 hari tampil di Dashboard
  (LOG-80, 4F-5).

#### LOG-L47. Kirim Besok (2 langkah)

- **Letak:** tombol **Kirim Besok** di LOG-L18 dan LOG-L33. **HP.**
- (1) Alasan (pilihan) dan foto (kamera langsung); (2) akibat dalam
  kalimat ("2 surat jalan dan 1 paket Raja kembali ke antrean; tertunda
  sejak hari ini"), **Simpan**.
- Pesan: "Toko Maju Kirim Besok. Kantor sudah diberi tahu."
- Sesudah tersimpan, selama trip Berjalan: tombol **Coba lagi** di kartu
  kunjungan.

#### LOG-L48. Gagal (2 langkah)

- **Letak:** tombol **Gagal** di LOG-L18 dan LOG-L33. **HP.**
- (1) Alasan (pilihan) dan foto; (2) akibat dalam kalimat ("Surat jalan
  0451 menunggu keputusan Kepala Gudang; paket Raja menunggu keputusan
  Raja. Barang dibawa pulang."), **Simpan**.
- Sebelum Simpan, satu pertanyaan: "Toko menerima sebagian nota? Pakai
  Kirim dan catat nota yang ditolak sebagai potong nota." (Ya, ke Kirim /
  Tidak, semua ditolak).

#### LOG-L49. Tertunda

- **Letak:** Logistik › Tertunda. **PC** (terbaca di HP).
- **Tab:** Menunggu jadwal, Perlu keputusan, Ditutup, Selesai. Angka
  penanda di menu: Perlu keputusan dan merah.
- **Isi baris:** toko, kiriman (nomor, pemilik nota, nominal), jalur,
  jenis terakhir, alasan dan foto terakhir, berapa kali, sejak, umur
  (merah lebih dari 3 hari), letak barang.
- **Saring:** jalur, cabang pemilik nota, hanya merah.
- **Tombol:** **Putuskan** (LOG-L50), **Tutup** (LOG-L51), **Buka lagi**
  (tab Ditutup), buka rincian kiriman.
- Staf cabang melihat tertunda laporan muat cabangnya di LOG-L25 tab
  "Tertunda".

#### LOG-L50. Putuskan Kiriman Gagal (2 langkah)

1. **Pilihan:** Jadwal ulang / Batal (alasan wajib). Laporan muat: jalur
   dan pengantar bila jadwal ulang.
2. **Akibat** dalam kalimat ("Surat jalan 0451 dibatalkan. Finance
   diminta membatalkan penjualan 0451 di kasir." / "Paket Raja 0112 diantar
   kembali ke Raja oleh trip berikutnya, lalu menunggu diantar Rina").
   **Simpan**; ditahan 3 detik bila Batal.

#### LOG-L51. Tutup Tertunda (2 langkah)

1. Keterangan wajib.
2. Akibat: "0451 tetap Menunggu dijadwalkan, tidak lagi merah." **Simpan.**

#### LOG-L52. Retur

- **Letak:** Logistik › Retur. **PC** (terbaca di HP).
- **Tab:** Menunggu ditugaskan, Di trip, Diambil (barang dalam perjalanan
  ke pemiliknya), Menunggu nilai, Selesai, Tanpa barang, Dibatalkan.
  Angka penanda di menu Finance: Menunggu nilai.
- **Isi baris:** nomor, toko, cabang penerima, ditandai oleh dan kapan,
  trip, jumlah barang, nilai, umur.
- **Tombol:** **Tandai retur** (LOG-L53), **Tugaskan ke trip** (memilih
  rencana Draft, Siap Kirim, atau Berjalan), **Lepas**, **Batalkan**,
  **Nilai** (LOG-L56).

#### LOG-L53. Tandai Retur (2 langkah)

1. Toko (cari), cabang penerima (bawaan Gudang), catatan permintaan.
   Toko yang masih punya retur terbuka: ditolak, menyebut retur itu.
2. Periksa, **Simpan**. Kepala Gudang dan pemilik: pilihan tambahan
   "Langsung tugaskan ke trip" (daftar trip Draft, Siap Kirim, Berjalan).

#### LOG-L54. Retur (rincian)

- Toko, cabang penerima, catatan permintaan, riwayat (ditandai,
  ditugaskan, dilepas, dicoba, diambil), barang (foto, nama, jumlah,
  alasan, pemilik, status barang kembali, jumlah diterima, nilai), foto
  posisi akhir, nilai total per cabang pemilik, status kiriman ke kasir
  (4F-5).

#### LOG-L55. Ambil Retur

- **Letak:** kartu tugas retur di LOG-L16. **HP.**
- **Isi:** toko, alamat, catatan permintaan, daftar barang yang sudah
  dicatat, **Tambah barang** (foto, nama, jumlah, satuan, alasan,
  pemilik).
- **Tombol akhir:** **Selesai** (foto posisi akhir, keterangan letak),
  **Tidak bisa diambil hari ini** (alasan, foto), **Tidak ada barang**
  (alasan, foto toko). Pesan Selesai: "Retur Toko Sinar diambil: 3 barang.
  2 diserahkan di Gudang saat lapor garasi, 1 diantar ke Raja."

#### LOG-L56. Nilai Retur (2 langkah)

1. Tiap barang: nama, jumlah diterima, foto, **nilai rupiah** (bulat, Rp0
   boleh dengan alasan). Di samping: nota kasir toko itu 60 hari terakhir
   sebagai patokan harga (dibaca dari Tarik Data Kasir bila sudah menyala).
2. **Akibat:** "Tagihan Toko Sinar dikurangi Rp450.000 (Gudang) dan
   Rp80.000 (Raja) di kasir." Tombol **Sahkan** ditahan 3 detik.

#### LOG-L57. Tinjau Barang Tidak Sesuai (2 langkah)

1. Foto serah dan foto terima berdampingan, catatan penerima, jumlah
   diserahkan; pilihan Sesuai setelah dicek / Selisih dicatat (jumlah
   sebenarnya), centang **Teruskan ke HR sebagai kehilangan barang**.
2. Akibat dalam kalimat, **Simpan**. Pesan: "Selisih 1 dus dicatat.
   Diteruskan ke HR sebagai usulan kehilangan barang."

### 3.6 Bagian 4F-5a: Pemeriksaan Uang

**Disetujui penuh 14 Oktober 2026** (V1 s.d. V5 "ok", sesuai saran; bagian 13;
aturan LOG-127 s.d. 132 di bagian 3.23 `../../aturan/04-logistik.md`). 4F-5
dipecah tiga (disetujui pemilik 14 Oktober 2026): **4F-5a Pemeriksaan Uang**
(LOG-62 s.d. 64), **4F-5b Kiriman ke Kasir dan Daftar Tagih** (LOG-14, 65,
66), **4F-5c Dashboard, Laporan, Bensin** (LOG-80 s.d. 83).

Bahan: LOG-13, 14, 44 s.d. 50, 62 s.d. 64, 84, 86, 88; LOG-112 s.d. 117;
KEU-01, 02, 04, 09, 12, 14, 16, 35, 49, 55, 71, 74, 120; GAJ-21, 80;
TAM-07, 15; PRI-02, 28; arsip `../../aturan/arsip/04-logistik-galian.md`
LOG-C32 s.d. C36, C42 s.d. C46, bagian 4C.9 dan 4C.10.

**Pokoknya:** angka yang diketik driver atau pengantar di toko baru
dianggap **benar** setelah diperiksa. Cara memeriksanya mengikuti bentuk
uangnya:

| Bentuk uang | Diperiksa dengan cara | Oleh | Uangnya masuk ke |
|---|---|---|---|
| **Tunai truk** | Uang fisik satu trip diserahkan dan dihitung (V1) | Finance, atau pemegang Brankas | Setoran di Finance, atau Brankas (KEU-71) |
| **Tunai antar sendiri** | Uang diserahkan ke laci cabang asal, lalu ikut setoran Laporan Kasir (V2) | Teman di cabang menerima; Finance memeriksa lewat setoran | Laci cabang asal |
| **Transfer** | Foto bukti dicocokkan dengan mutasi rekening | Finance | Rekening yang dipilih Finance |
| **Deposit** | Ditunggu sampai uangnya tampil di rekening (V4) | Finance | Rekening yang dipilih Finance |
| **Tempo** | Tidak diperiksa (uangnya Rp0) | — | — |

Begitu diperiksa, uangnya masuk **Kas Masuk** cabang pemilik nota (LOG-64),
dan pembayarannya **terkunci** (LOG-116).

#### Yang diperiksa: bagian uang sebuah pembayaran (LOG-62)

- Satu **pembayaran** Berlaku (4F-4a) punya satu atau dua **bagian uang**:
  bagian tunai, bagian transfer, atau bagian deposit. Campuran punya dua
  bagian (tunai dan transfer) yang diperiksa terpisah.
- Pembayaran **terkunci** begitu satu bagiannya diperiksa (LOG-116). Ia
  berstatus **Diperiksa** bila semua bagiannya sudah diperiksa.
- **Cocok:** angka bagian itu benar. **Tidak Cocok:** pemeriksa mengetik
  angka yang benar dan alasannya. Server menulis pembayaran baru (yang lama
  Diganti) dan menjalankan fungsi bagi uang kunjungan (LOG-112). Kekurangan
  yang lahir dari Tidak Cocok mendapat tanggal janji bayar sisa bawaan 7
  hari dari hari pemeriksaan (LOG-113), dan Marketing diberi tahu.
  Kelebihan menjadi titipan toko (LOG-114).
- **Tidak ada yang memeriksa angka yang ia ubah sendiri** (KEU-120): orang
  yang terakhir mengubah pembayaran itu (LOG-L41) tidak bisa memeriksanya.
- Batas: semua bagian selain tempo diperiksa paling lambat **3 hari** sejak
  Kirim. Lewat itu ditandai untuk Pemilik dan GM, tidak otomatis Cocok
  (LOG-62).

#### Tunai truk: serah uang per trip (V1; LOG-62, KEU-35, 49, 71)

- Server menjumlah **uang tunai yang harus diserahkan** per trip: semua
  bagian tunai dari pembayaran Berlaku di trip itu, dirinci per toko dan per
  pembawa (awak yang memegang kunjungan, LOG-26).
- Di **Trip Saya** (LOG-L16) dan langkah lapor garasi (LOG-L21) tampil
  kotak "Uang tunai yang harus diserahkan: Rp3.700.000 (Dedi Rp2.500.000,
  Eko Rp1.200.000)". Kotak ini **tidak menahan** lapor garasi, karena
  Finance belum tentu ada di Gudang saat truk pulang.
- Awak menyerahkan uang kepada **Finance** atau **pemegang Brankas** (dibaca
  dari daftar tempat uang, KEU-02; bukan nama jabatan). Penerima membuka
  Terima Uang Tunai Trip (LOG-L59) dan menghitung:
  - **Cocok**: tombol **Terima** ditahan 3 detik. Semua bagian tunai trip
    itu Cocok sekaligus.
  - **Tidak cocok**: penerima mengetik jumlah hasil hitung, lalu menjelaskan
    selisihnya (V3, di bawah).
- Uang yang diterima Finance masuk **Setoran di Finance**; yang diterima
  pemegang Brankas masuk **Brankas** (KEU-71). Finance yang lalu menyerahkan
  ke Brankas mencatat "setor ke Brankas" sebagai Pindah Dana (KEU-49);
  layar itu milik Keuangan (4H).
- Pembawa tidak bisa menerima uangnya sendiri. Satu trip satu serah;
  tidak ada serah sebagian.
- Belum diserahkan sampai **12.00 hari berikutnya**: ditandai untuk Kepala
  Gudang, Finance, Pemilik, dan GM, dan tampil di Dashboard (4F-5c).

#### Selisih uang tunai (V3)

Bila hasil hitung berbeda dari yang harus diserahkan, penerima menjelaskan
selisihnya dalam dua bagian:

1. **Per toko** (bila pembawa bisa menjelaskan, misalnya "Toko Maju ternyata
   bayar Rp2.400.000, saya salah ketik"): penerima mengetik uang toko yang
   benar. Itu Tidak Cocok untuk toko itu: pembayarannya diganti, dibagi
   ulang, dan kekurangannya menjadi tagihan toko.
2. **Sisanya** yang tidak bisa dijelaskan: dicatat sebagai **kurang serah**
   (atau **lebih serah**) atas nama pembawa. Uang toko **tidak diubah**,
   karena toko memang sudah membayar sebesar laporan.
   - Kurang serah ditandai untuk Pemilik dan GM, dan **diteruskan ke HR
     sebagai bahan Potongan Lain** (GAJ-21, 80). Logistik tidak memotong
     gaji; HR mengajukan, Pemilik atau GM mengesahkan.
   - Dua pembawa dalam satu trip: penerima memilih siapa pembawanya dari
     rincian per pembawa; bila tidak jelas, dibagi sama rata dan diberi
     tanda "pembawa tidak jelas" untuk HR.
   - Lebih serah ditandai untuk Pemilik dan GM; uangnya tetap tercatat
     masuk (titipan 4H: baris selisih di Buku Kas).

Contoh: harus diserahkan Rp3.700.000, dihitung Rp3.550.000. Dedi
menjelaskan Toko Maju sebenarnya bayar Rp2.400.000 (kurang Rp100.000 dari
laporan). Sisa Rp50.000 tidak bisa dijelaskan: kurang serah Rp50.000 atas
nama Dedi, diteruskan ke HR. Kas Masuk: Rp3.600.000 (uang toko yang
benar); baris kurang serah Rp50.000 menunggu Keuangan.

#### Tunai antar sendiri: lewat laci cabang asal (V2; LOG-50, 114)

- Saat **Foto 3** (LOG-L34), bila perjalanan membawa uang tunai, PJ
  diminta menyerahkan uang itu ke laci cabang asal: "Serahkan Rp1.200.000
  ke kasir yang bertugas."
- Karyawan cabang asal yang sedang bertugas, **bukan PJ**, menekan
  **Terima** atau **Tidak cocok** (jumlah hitungan) di Antrean-nya. Kepala
  Toko cabang itu, Pemilik, dan GM juga boleh. Selisih dijelaskan dengan
  cara yang sama dengan tunai truk (V3).
- Sesudah diterima, uang itu bagian dari **Laci cabang asal** dan ikut
  setoran Laporan Kasir shift itu. Laporan Kasir membacanya sebagai baris
  tersendiri "uang antar sendiri" (bukan kelebihan kas, bukan titipan
  pelunasan; titipan 4H), sehingga tidak dihitung dua kali.
- **Pemeriksaan Finance:** saat Finance menerima setoran shift itu dengan
  Cocok (KEU-49), bagian tunai antar sendiri di dalamnya ikut Cocok. Bila
  setoran Tidak cocok, bagian itu tetap menunggu di LOG-L58 tab "Tunai
  antar sendiri" untuk diperiksa sendiri.
- Belum diterima siapa pun sampai 23.59 hari itu: ditandai untuk Kepala Toko
  cabang asal dan tampil di Dashboard (4F-5c). Uangnya tercatat "dipegang
  PJ" sampai diterima.

#### Transfer (LOG-62, 64)

- Finance membandingkan foto bukti dengan mutasi rekening, memilih
  **rekening** penerima dari daftar tempat uang (KEU-02), lalu Cocok atau
  Tidak Cocok.
- **Cocok sekaligus**: transfer yang memakai rekening yang sama boleh
  dicentang beberapa, tombol ditahan 3 detik dengan jumlah rupiahnya
  (sejalan KEU-14).
- Transfer yang sama sekali tidak ada di rekening: Tidak Cocok, angka Rp0.
- Tanggal uang = tanggal Kirim (LOG-64).

#### Deposit (V4; LOG-44, 64)

- Finance menunggu uangnya tampil di rekening, paling lama batas
  pemeriksaan **3 hari** (sama dengan uang lain).
- **Masuk**: rekening, **tanggal masuk rekening** (tidak di masa depan,
  paling jauh 7 hari ke belakang dari hari pemeriksaan; lebih jauh hanya
  Pemilik atau GM dengan alasan, KEU-12), dan angka yang masuk. Angka lebih
  kecil = Tidak Cocok untuk selisihnya.
- **Belum masuk**: bagian deposit menjadi Rp0, dan seluruhnya menjadi
  **sisa tagihan** dengan janji bayar sisa bawaan 7 hari. Ia masuk kiriman
  ke kasir dan daftar tagih (4F-5b), dan Marketing diberi tahu. Uang yang
  masuk sesudahnya adalah **pelunasan biasa** yang dicatat di kasir (LOG-66).
- Alasannya: kata pemilik, deposit sering hanya cara halus untuk tempo.
  Kalau dibiarkan menunggu tanpa batas, tagihannya tidak pernah ditagih.

#### Kas Masuk (LOG-64, KEU-01, 09, 71)

- Setiap bagian yang diperiksa menulis baris **uang masuk** ke Buku Kas
  lewat pintu tulis Keuangan, **satu baris per nota per tempat uang**,
  dibaca dari bagian_nota yang Berlaku:
  - tempat uang: Setoran di Finance, Brankas, Laci cabang asal, atau
    rekening yang dipilih;
  - cabang: **cabang pemilik nota** (omzet tetap untuk cabang itu, KEU-71);
  - kejadian: "uang pengiriman"; sumber: Logistik, nomor pembayaran;
  - tanggal: tanggal Kirim untuk tunai dan transfer, tanggal masuk rekening
    untuk deposit.
- **Lebih bayar** (titipan toko) menulis baris uang masuk berkejadian
  **"titipan toko"**: bukan pendapatan, tidak masuk laba, cabangnya
  pemegang titipan (LOG-114).
- Baris ini tidak diperiksa ulang di Keuangan (KEU-09). Pembatalan
  pemeriksaan membatalkan barisnya dengan alasan yang sama (PRI-02);
  pemeriksaan baru menulis baris baru.
- Bacaan Keuangan tentang buku toko dengan Gudang (uang nota cabang yang
  dipegang Gudang, KEU-71) dihitung 4H dari baris ini; Logistik tidak
  menghitungnya.

Contoh: Toko Maju, nota Gudang Rp2.000.000 dan nota Raja Rp850.000, cash
Rp2.500.000 diterima Finance. Kas Masuk: Rp2.000.000 Setoran di Finance
cabang Gudang, Rp500.000 Setoran di Finance cabang Raja, tanggal Kirim.

#### Membatalkan pemeriksaan (V5; LOG-63)

| Siapa | Sampai kapan | Catatan |
|---|---|---|
| Finance yang memeriksanya | 7 hari sejak pemeriksaan, dan nota belum tercatat di kasir | Alasan wajib |
| Pemilik, GM | Selama nota belum tercatat di kasir | Alasan wajib |
| Siapa pun | Sesudah tercatat di kasir | Tidak dibatalkan; lewat koreksi (LOG-14, 4F-5b) |

- Batal membuka kunci pembayaran (LOG-116), membatalkan baris Kas Masuk,
  dan mengembalikan bagian itu ke Menunggu. Serah tunai yang dibatalkan
  mengembalikan semua bagian tunai trip itu; uang fisiknya tetap di tempat
  penerima, jadi serah ulang mencatat penerima yang sama.
- Setiap pemeriksaan dan pembatalan tersimpan sebagai riwayat (siapa,
  angka, kapan, alasan), dibuka dari rincian (LOG-63).
- Ini **pengecualian sempit KEU-16** (baris Buku Kas yang sudah diperiksa
  hanya dibatalkan pemilik): Finance boleh membatalkan pemeriksaannya
  sendiri dalam 7 hari, sesuai kejadian 105 yang sudah disetujui di 4F-4a.

#### LOG-L58. Pemeriksaan Uang Pengiriman

- **Letak:** Logistik › Pemeriksaan Uang Pengiriman (menu M5: tetap di
  modulnya). **PC** (terbaca di HP).
- **Tab:** Tunai trip (belum diserahkan, menunggu diterima), Tunai antar
  sendiri, Transfer, Deposit, Selisih tunai, Sudah diperiksa. Angka penanda
  di menu Finance: jumlah bagian menunggu; merah bila ada yang lewat 3 hari.
- **Isi baris:** tanggal Kirim, toko, trip atau perjalanan, pembawa, cara
  bayar, angka dilaporkan, umur. Transfer menampilkan foto bukti kecil.
- **Tombol:** **Terima** (LOG-L59), **Periksa** (LOG-L60 atau L61), **Cocok
  sekaligus** (transfer, tahan 3 detik), **Rincian** (LOG-L62).
- Kepala Gudang hanya melihat tab Tunai trip (untuk tahu uang belum
  diserahkan); Marketing tidak melihat layar ini (LOG-84).

#### LOG-L59. Terima Uang Tunai Trip (3 langkah, TAM-07)

1. Pilih trip (atau perjalanan antar sendiri, bagi penerima di cabang).
   Tampil yang harus diserahkan, rincian per toko dan per pembawa.
2. **Hasil hitung:** "Cocok, Rp3.700.000" atau "Tidak cocok" dengan jumlah
   hitungan. Tidak cocok membuka penjelasan selisih (per toko, lalu sisa
   sebagai kurang atau lebih serah dengan pembawanya).
3. **Akibat dalam kalimat:** "Rp3.600.000 masuk Setoran di Finance. Toko
   Maju kurang Rp100.000, janji bayar 21 Oktober. Kurang serah Rp50.000 atas
   nama Dedi diteruskan ke HR." Tombol **Terima** ditahan 3 detik.

#### LOG-L60. Periksa Transfer (2 langkah)

1. Foto bukti besar, toko, angka, tanggal Kirim; pilih **rekening**; Cocok
   / Tidak Cocok (angka benar, alasan).
2. Akibat dalam kalimat, **Simpan** (ditahan 3 detik).

#### LOG-L61. Periksa Deposit (2 langkah)

1. Toko, angka yang dijanjikan, tanggal Kirim; pilihan **Masuk** (rekening,
   tanggal masuk, angka) atau **Belum masuk, jadikan sisa tagihan**.
2. Akibat dalam kalimat ("Rp1.000.000 menjadi sisa tagihan Toko Jaya, janji
   bayar 21 Oktober; Marketing diberi tahu"), **Simpan** (ditahan 3 detik).

#### LOG-L62. Pemeriksaan (rincian)

- Pembayaran dengan semua bagiannya, bagian per nota, riwayat pemeriksaan
  dan pembatalan, baris Kas Masuk yang lahir, serah tunai dan selisihnya.
- **Tombol:** **Batalkan pemeriksaan** (LOG-L63), menurut tabel di atas.

#### LOG-L63. Batalkan Pemeriksaan (2 langkah)

1. Alasan (wajib).
2. Akibat: "Pemeriksaan transfer Toko Jaya Rp800.000 dibatalkan. Baris Kas
   Masuk dibatalkan. Pembayaran bisa diubah lagi." Tombol ditahan 3 detik.

### 3.7 Bagian 4F-5b: Kiriman ke Kasir dan Daftar Tagih

**Disetujui penuh 14 Oktober 2026** (D1 s.d. D7 "ok", sesuai saran; bagian 13; aturan LOG-133 s.d. 139 di
bagian 3.24 `../../aturan/04-logistik.md`).

Bahan: LOG-13, 14, 44, 49, 52, 60, 65, 66, 84, 86, 95, 96, 112 s.d. 116,
122 s.d. 124, 127 s.d. 132; KEU-07, 09, 46, 69, 94, 112, 120; PRI-02, 39,
41; TDK-L03, L06; arsip `../../aturan/arsip/04-logistik-galian.md` LOG-C37
s.d. C41, bagian 4C.9 dan 4C.10.

**Pokoknya:** piutang toko milik **sistem kasir** (LOG-65). HRIS tidak
menulis ke kasir (PRI-39), jadi semua yang mengubah tagihan toko dan lahir
di HRIS harus **diketik Finance di kasir**. Supaya tidak ada yang
terlewat, HRIS menyusun **satu daftar "Catat di Kasir"**: apa yang harus
diketik, di kasir cabang mana, untuk toko dan nota mana. Finance
mengetiknya di kasir, lalu menandai "sudah tercatat di kasir". Sesudah
itu notanya **terkunci** (LOG-14). Sebaliknya, **Daftar Tagih** dibaca
dari kasir (LOG-66) supaya Marketing menagih memakai angka yang sama
dengan kasir.

| Arah | Isinya | Siapa |
|---|---|---|
| HRIS → kasir (diketik tangan) | Ringkasan per nota (uang, potongan, sisa dan janji bayar), titipan toko, retur, batalkan penjualan, koreksi; ditambah baris dari Keuangan (titipan pelunasan, pembayaran toko ke Gudang) | Finance mengetik dan menandai |
| Kasir → HRIS (ditarik tiap 1 jam) | Piutang per nota: sisa, tanggal, jatuh tempo, umur | Mesin Tarik Data Kasir; dibaca Daftar Tagih |

#### Ringkasan per nota (D1; LOG-65, 112, 113)

- Untuk tiap nota yang terkirim, HRIS menulis **satu baris ringkasan**
  begitu nota itu **siap dicatat**, yaitu:
  1. kirimannya Terkirim;
  2. semua bagian uang selain tempo dari pembayaran yang Berlaku sudah
     diperiksa (LOG-131; deposit "Belum masuk" juga dihitung sudah
     diperiksa);
  3. tidak ada potong nota Menunggu pada nota itu (LOG-52);
  4. untuk tempo (tanpa uang): trip Selesai atau perjalanan sudah Foto 3.
- Isi ringkasan dibaca dari bagian_nota yang Berlaku, pemeriksaan_uang,
  dan potong_nota; tidak dihitung ulang (WAJ-04):

  > **Kasir Gudang · Toko Maju · nota 0451 (Rp2.350.000)**
  > 1. Pembayaran: cash Rp2.000.000, tanggal 14 Oktober.
  > 2. Potongan: Rp100.000 (barang rusak), disetujui Finance.
  > 3. Sisa tagihan: Rp250.000, janji bayar 21 Oktober.

- **Tempat mencatat** = kasir cabang yang menerbitkan nota (nomor struk +
  cabang kasir, LOG-97). Nota Gudang di kasir Gudang, nota cabang di kasir
  cabang asal. Daftar dikelompokkan per kasir cabang supaya Finance
  mengetik satu kasir sekaligus.
- **Sebelum ditandai**, ringkasan ikut berubah bila sumbernya berubah
  (misalnya Pemilik membatalkan pemeriksaan, LOG-132): baris lama Diganti
  dan baris baru bertanda **"berubah sejak tampil"**; bila nota tidak lagi
  siap, barisnya Dibatalkan dengan keterangan sumbernya.
- Nota **Diambil toko** (LOG-95) tidak punya ringkasan: uangnya memang
  diurus di kasir. Nota yang **Batal sesudah Gagal** hanya punya baris
  "Batalkan penjualan" (LOG-123).
- Kenapa per nota, bukan per kejadian: Finance mengetik satu nota sekali
  (pelunasan, potongan, dan jatuh tempo sekaligus), kuncinya juga per nota
  (LOG-14), dan angka yang sudah pasti saja yang dikirim, sehingga kasir
  tidak perlu dibetulkan berulang kali.

#### Baris selain ringkasan nota

| Jenis baris | Lahir saat | Isi yang diketik di kasir | Kasir cabang |
|---|---|---|---|
| **Titipan toko** (LOG-114) | Pembayaran yang lebih bayar sudah diperiksa seluruhnya | "Catat titipan Toko Maju Rp200.000" | Pemegang titipan (Gudang untuk truk, cabang asal untuk antar sendiri) |
| **Kurangi tagihan karena retur** (LOG-60, 124) | Nilai retur disahkan | "Kurangi tagihan Toko Sinar Rp450.000 (retur R-0012)", satu baris per cabang pemilik barang | Cabang pemilik barang |
| **Batalkan penjualan** (LOG-123) | Keputusan Batal sesudah Gagal | "Batalkan penjualan 0451" | Cabang kasir nota |
| **Koreksi** (LOG-14; D3) | Koreksi disimpan | Angka sebelum dan sesudah, alasan | Cabang kasir nota |
| **Titipan pelunasan** (KEU-46; D2) | Ditulis Keuangan (4H) lewat pintu tulis | "Catat pelunasan Toko Jaya Rp500.000 yang dititipkan di laci Raja" | Menurut Keuangan |
| **Pembayaran toko ke Gudang** (KEU-69; D2) | Ditulis Keuangan (4H) lewat pintu tulis | "Catat pembayaran Raja kepada Gudang Rp5.000.000" | Gudang |

- Baris "Batalkan penjualan" yang pembatalannya **tertarik dari kasir**
  ditandai tercatat sendiri oleh Pencocok pembatalan kasir (4F-4b).
- Baris lahir hanya dari server; tidak ada layar untuk mengetik baris
  sendiri (sejalan H33, H52).

#### Satu daftar untuk semua yang dicatat tangan di kasir (D2)

- Daftar "Catat di Kasir" adalah **satu tempat** untuk semua yang harus
  diketik tangan di kasir, dari modul mana pun. Tabelnya milik Logistik;
  Keuangan (4H) menulis barisnya lewat **pintu tulis** yang sama
  (WAJ-03: satu pemilik, banyak penulis lewat pintu).
- Menu: **Logistik › Catat di Kasir** (M5: tetap di modulnya), dengan angka
  penanda di menu Finance. Menu v1 bertambah dua butir: Catat di Kasir dan
  Daftar Tagih (dicatat di `../specs/2026-10-13-menu-desain.md` saat
  disetujui).

#### Menandai "sudah tercatat di kasir" dan kuncinya (LOG-14)

- Finance, Pemilik, atau GM membuka baris, membaca isinya, mengetiknya di
  kasir, lalu menekan **Sudah tercatat di kasir** (ditahan 3 detik, karena
  mengunci nota). Nomor bukti di kasir boleh diisi, tidak wajib.
- **Tandai sekaligus** boleh untuk beberapa baris satu kasir cabang yang
  dicentang, tombol ditahan 3 detik dengan jumlah barisnya (sejalan Cocok
  sekaligus, KEU-14).
- Begitu **ringkasan nota** tercatat, nota itu **terkunci**: pembayaran
  yang memuatnya, keputusan potong notanya, dan pemeriksaannya tidak bisa
  diubah atau dibatalkan lagi (LOG-48, 52, 116, 132). Perubahan sesudahnya
  hanya lewat **koreksi**. Nilai retur terkunci saat baris returnya
  tercatat (LOG-124).
- **Jalan keluar** (WAJ-11): salah tandai (belum benar-benar diketik di
  kasir) dibatalkan dengan alasan oleh penandanya dalam 24 jam, atau oleh
  Pemilik dan GM kapan saja, selama belum ada koreksi sesudahnya. Kunci
  nota terbuka lagi; riwayat tersimpan.
- Menunggu dicatat lebih dari **2 hari** sejak siap: ditandai untuk
  Finance, lalu Pemilik dan GM, dan tampil di Dashboard (4F-5c). Kenapa 2
  hari: selama belum tercatat, kasir masih menagih toko yang sebenarnya
  sudah membayar, dan Daftar Tagih ikut salah.

#### Koreksi sesudah tercatat di kasir (D3; LOG-14)

| Yang dikoreksi | Akibat di HRIS | Baris ke kasir |
|---|---|---|
| Uang yang diterima (angka atau cara bayar) | Pembayaran dan pemeriksaan baru (yang lama Diganti), fungsi bagi uang dijalankan (LOG-112); baris Kas Masuk lama dibatalkan dan yang baru ditulis lewat pintu tulis Keuangan | Ya, per nota yang angkanya berubah |
| Tempat uang, rekening, atau tanggal uang | Baris Kas Masuk diganti saja | Tidak, karena kasir tidak berubah |
| Potongan (nominal atau dibatalkan) | Potong nota baru, pembagian dijalankan | Ya |
| Nilai retur | Nilai baru per barang | Ya |

- Oleh **Finance, Pemilik, atau GM**, alasan wajib, tiga langkah dengan
  akibat dalam angka, ditahan 3 detik (TAM-15).
- **Langsung berlaku**, tanpa persetujuan. Koreksi oleh Finance diberitahukan
  ke Pemilik dan GM; yang **mengurangi uang masuk** juga masuk "perlu
  perhatian" Pemilik dan GM. Koreksi oleh Pemilik atau GM diberitahukan ke
  yang lain dan ke Finance.
- Bila Kas Masuk aslinya di **bulan yang sudah ditutup**, pembatalan dan
  baris barunya masuk bulan berjalan sebagai baris koreksi yang menunjuk
  aslinya (KEU-112).
- Koreksi tidak memotong gaji siapa pun. Bila uang yang hilang kesalahan
  pembawa, Finance memberi tahu HR, yang mengajukan Potongan Lain di Gaji
  (GAJ-80).
- Koreksi hanya untuk nota yang sudah tercatat. Nota yang belum tercatat
  dibetulkan lewat jalan biasa (ubah pembayaran, batal pemeriksaan,
  keputusan potong nota).

#### Pencocokan dengan piutang kasir (D4; PRI-39, 41)

- Sesudah sambungan piutang menyala, mesin **Pencocok piutang kasir**
  membandingkan tiap nota yang ringkasannya tercatat: **sisa menurut
  kasir** dengan **sisa menurut HRIS** (tagihan − uang terperiksa −
  potongan disetujui, dari bagian_nota).
- Yang ditandai hanya **kasir menagih lebih besar** daripada sisa menurut
  HRIS, bila masih begitu **1 hari** sesudah ditandai tercatat. Kasir menagih
  lebih kecil itu wajar (toko melunasi langsung di kasir, titipan atau
  retur dipakai), jadi tidak ditandai.
- Yang ditandai masuk **Perlu Diperiksa** Finance (TDK-L06, tab Piutang):
  "Nota 0451: kasir masih menagih Rp450.000, menurut HRIS sisa Rp250.000."
  Finance membetulkan di kasir (tanda hilang sendiri pada tarikan
  berikutnya) atau **Biarkan** dengan alasan (PRI-41).
- Kenapa: catat tangan pasti kadang salah ketik. Tanpa pencocokan, salah
  ketik itu baru ketahuan saat toko marah ditagih uang yang sudah dibayar.

#### Daftar Tagih (D5; LOG-66)

- **Dibaca dari kasir**: piutang per nota (sisa, tanggal nota, jatuh tempo,
  umur) dari tarikan tiap 1 jam (PRI-39). HRIS tidak menghitung piutang
  sendiri (LOG-65; tidak ada Buku Piutang).
- **Ditambah keterangan dari HRIS**, bukan angka piutang:
  - janji bayar sisa (LOG-113) dan janji dari catatan tagih (D6);
  - **"uang sudah di HRIS, belum tercatat di kasir"**: ringkasan yang
    Menunggu dicatat, dan uang yang belum diperiksa, supaya Marketing tidak
    menagih toko yang sudah membayar ke driver;
  - catatan tagih terakhir.
- Urutan: lewat jatuh tempo atau janji paling lama dulu. **Merah** = lewat
  jatuh tempo atau janji; **oranye** = jatuh tempo dalam 3 hari.
- Satu baris per toko (jumlah sisa, nota terlama, umur), dibuka ke rincian
  per nota. Bisa dicari, disaring per kasir cabang, dan diunduh Excel.
- **Sebelum sambungan piutang menyala**: Finance mengunggah **file piutang
  dari laporan kasir** lewat Unggah File (TDK-L03, jenis baru "Piutang
  toko"). Daftar menulis "data kasir per file 14 Oktober 2026"; file yang
  lebih tua dari 7 hari memunculkan peringatan merah di atas daftar dan
  pengingat ke Finance.
- **Pelunasan dicatat langsung di kasir** (LOG-66), tidak di HRIS.

#### Catatan tagih (D6; LOG-66)

- Marketing (juga Finance, Pemilik, GM) mencatat hasil menghubungi toko:
  tanggal, hasil, catatan.

| Hasil | Akibat |
|---|---|
| **Janji bayar** (tanggal, wajib) | Tampil di Daftar Tagih; lewat janji dan masih bersisa: merah lagi dan muncul di Beranda Marketing |
| **Tidak bisa dihubungi** | Hanya tercatat |
| **Tagih saat kirim berikutnya** | Bila toko itu masuk trip atau perjalanan, kotak "Marketing minta ditagih: Rp750.000 (nota 0390, lewat 12 hari)" tampil di Kunjungan Toko (LOG-L18) dan Sampai di Tujuan (LOG-L33) |
| **Sengketa** (alasan, wajib) | Ditandai untuk Finance: mungkin perlu koreksi atau retur |

- Catatan tagih **tidak mengubah apa pun di kasir** dan tidak menyangkut
  uang; jatuh tempo resmi tetap milik kasir.
- **Awak tidak menagih lewat HRIS.** Bila toko membayar tagihan lama ke
  driver, uangnya ikut uang diterima dan terbaca **lebih bayar** (titipan
  toko, LOG-114); Finance mencatat titipan itu di kasir, dan kasir
  memakainya melunasi nota lama. Pertanyaan kedua lebih bayar di layar
  Kirim berbunyi "...menitipkan kelebihannya atau membayar tagihan lama?"

#### Data lama dan titik awal (D7)

- Nota sistem lama yang sudah terkirim dibawa bertanda **"data lama"**
  dan dianggap sudah beres; tidak masuk Catat di Kasir.
- Buku Piutang sistem lama (sejak 10 Oktober 2026, arsip LOG-C37) **tidak
  dibawa**. Titik awal piutang adalah potret piutang kasir pada hari mulai
  (PRI-39 butir 5, KEU-94).
- Bila selama ini pembayaran yang diterima driver **tidak** diketik di
  kasir, piutang kasir pada hari mulai terlalu besar. Pembereskannya sekali
  sebelum hari mulai (titipan Tahap 5, D7).

#### LOG-L64. Catat di Kasir

- **Letak:** Logistik › Catat di Kasir. **PC.**
- **Tab:** Menunggu dicatat (dikelompokkan per kasir cabang, lalu toko),
  Tercatat, Dibatalkan atau Diganti. Angka penanda di menu Finance: jumlah
  baris menunggu; merah bila ada yang lebih dari 2 hari.
- **Isi baris:** kasir cabang, jenis, toko, nota, ringkasan isi, siap sejak,
  tanda "berubah sejak tampil".
- **Tombol:** **Buka** (LOG-L65), **Tandai sekaligus** (centang, tahan 3
  detik), **Koreksi** (LOG-L67) pada baris Tercatat.
- Marketing melihat tab Menunggu dicatat (untuk tahu tagihan mana yang
  belum benar di kasir), tanpa tombol.

#### LOG-L65. Tandai Tercatat (2 langkah)

1. Isi baris dalam kalimat yang bisa langsung diketik di kasir (contoh
   ringkasan di atas), nomor bukti di kasir (pilihan).
2. Akibat: "Nota 0451 terkunci. Perubahan sesudah ini lewat koreksi."
   Tombol **Sudah tercatat di kasir** ditahan 3 detik.

#### LOG-L66. Batalkan Tanda Tercatat (2 langkah)

1. Alasan (wajib).
2. Akibat: "Nota 0451 kembali Menunggu dicatat dan tidak terkunci lagi."
   Ditahan 3 detik. Penanda dalam 24 jam; Pemilik dan GM kapan saja, selama
   belum ada koreksi sesudahnya.

#### LOG-L67. Koreksi Nota (3 langkah, TAM-07)

1. Pilih nota (atau retur) dan yang dikoreksi: uang, tempat uang, potongan,
   nilai retur.
2. Angka yang benar dan alasan (wajib).
3. Akibat dalam angka: "Uang nota 0451 dari Rp2.000.000 menjadi
   Rp1.900.000; sisa tagihan menjadi Rp350.000. Kas Masuk Setoran di
   Finance dikurangi Rp100.000 (baris koreksi bulan Oktober). Satu baris
   koreksi masuk Catat di Kasir. Pemilik dan GM diberi tahu." Ditahan 3
   detik.

#### LOG-L68. Daftar Tagih

- **Letak:** Logistik › Daftar Tagih. **PC** (terbaca di HP).
- **Isi:** satu baris per toko: sisa menurut kasir, nota terlama dan
  umurnya, jatuh tempo atau janji terdekat, warna, "uang di HRIS belum
  tercatat di kasir", catatan tagih terakhir. Di atas: "data kasir terakhir
  masuk: jam …" (PRI-39 butir 3) atau tanggal file.
- **Saring:** kasir cabang, lewat jatuh tempo, ada janji, sengketa.
- **Tombol:** **Rincian** (LOG-L69), **Unduh Excel**.
- Dilihat Marketing, Finance, Pemilik, GM (LOG-66, 84).

#### LOG-L69. Tagihan Toko (rincian)

- Per nota dari kasir: nomor, cabang, tanggal, nominal, sisa, jatuh tempo,
  umur; di sampingnya keterangan HRIS (janji bayar sisa, uang belum
  tercatat di kasir, potong nota atau retur yang sedang diproses).
- Riwayat catatan tagih. Tombol **Catat hasil tagih** (LOG-L70).

#### LOG-L70. Catat Hasil Tagih (2 langkah)

1. Hasil (tabel catatan tagih), tanggal janji bila Janji bayar, alasan bila
   Sengketa, catatan.
2. Akibat dalam kalimat ("Janji bayar Toko Jaya 25 Oktober tercatat. Tidak
   mengubah kasir."), **Simpan** (tombol biasa, karena tidak menyangkut
   uang).

### 3.8 Bagian 4F-5c: Dashboard, Laporan, Bensin

**Disetujui penuh 14 Oktober 2026** (B1 s.d. B6 "ok", sesuai saran; bagian
13; aturan LOG-140 s.d. 145 di bagian 3.25 `../../aturan/04-logistik.md`).

Bahan: LOG-29, 31, 32, 40, 52, 57, 60 s.d. 62, 80 s.d. 86, 88, 93, 99,
127 s.d. 139; KEH-94, 100, 125, 130 (KEH-L20, L25); KEU-09, 11 s.d. 13,
16, 18, 19, 26, 98, 116, 120, 123; PRI-10 s.d. 12, 33, 39; arsip
`../../aturan/arsip/04-logistik-galian.md` LOG-D25 s.d. D32 dan bagian 4D.7.

**Pokoknya:** tiga hal penutup Logistik.

1. **Dashboard Logistik**: satu halaman "apa yang perlu diurus hari ini"
   untuk semua jalur. Halaman ini **tidak menghitung apa pun** (LOG-82):
   tiap baris membaca tanda dan status yang sudah ditulis bagian
   pemiliknya (mesin penanda 4F-1 s.d. 4F-5b), lalu menunjuk ke layar
   tempat urusan itu dikerjakan.
2. **Bensin**: permintaan dari Laporan Pulang driver ditutup dengan **Sudah
   Diisi** (nominal struk sebenarnya, foto struk) atau **Tidak jadi**.
   Sudah Diisi melahirkan satu baris uang keluar di Buku Kas lewat pintu
   tulis Keuangan (KEU-26).
3. **Laporan Logistik**: rekap satu periode untuk semua jalur; angka uang
   dari pemeriksaan Finance; tanpa piutang; bisa diunduh Excel.

Pelajaran sistem lama (arsip LOG-D25, D26, D29, D30): dashboard hanya trip
truk; tombol bensin tidak berbuat apa-apa untuk HR dan Finance, tanpa
nominal dan tanpa catatan siapa; 13 tanda bensin menyala dan tidak pernah
ditutup; laporan memakai bulan kalender dan menghitung piutang di layar.

#### Dashboard: isi dan susunan (B1; LOG-80)

Empat bagian, berurutan dari yang sedang berjalan sampai urusan mobil.
Baris yang jumlahnya 0 tidak tampil.

| Bagian | Baris | Muncul bila | Dibaca dari | Dikerjakan di |
|---|---|---|---|---|
| **1. Berjalan sekarang** | Trip truk | Berjalan atau Menuju Garasi: mobil, awak, rute, toko selesai dari jumlahnya (7/9), jam berangkat, toko yang sedang dituju | trip, kunjungan | LOG-L14 |
| | Perjalanan antar sendiri | Berjalan: PJ, cabang asal, tujuan, sejak | perjalanan | LOG-L37 |
| | Rencana hari ini belum berangkat | Siap Kirim, dibuat untuk hari ini | rencana | LOG-L14 |
| **2. Pengiriman** | Trip belum ditutup | Lewat 12.00 hari berikutnya (LOG-31) | Penanda trip belum ditutup | LOG-L22 |
| | Rencana menggantung | Lewat 23.59 hari berikutnya sesudah dibuat; pilihan Batalkan atau Tetap (4F-2) | Penanda rencana menggantung | LOG-L14 |
| | Perjalanan belum kembali | Belum Foto 3 sampai 23.59 (M6) | Penanda perjalanan belum kembali | LOG-L36 |
| | Paket atau kiriman cabang merah | Menunggu lebih dari 24 jam (LOG-40) | Penanda laporan muat | LOG-L27 |
| | Tertunda merah | Lebih dari 3 hari sejak tanggal pertama (LOG-57) | Penanda tertunda | LOG-L49 |
| | Perlu keputusan | Kiriman Gagal yang belum diputuskan | tertunda | LOG-L50 |
| | Retur menunggu ditugaskan | Lebih dari 3 hari | Penanda retur | LOG-L52 |
| | Barang tidak sesuai belum ditinjau | Lebih dari 3 hari | Penanda retur | LOG-L57 |
| | Barang kembali belum diterima | Lebih dari 3 hari (LOG-80) | Penanda barang kembali | LOG-L44 |
| | Titik toko menunggu | Usulan titik Menunggu (LOG-93) | titik_toko | LOG-L06 |
| | Kirim di luar titik toko | Belum ditinjau (B2; LOG-99) | kunjungan, tujuan_perjalanan, tidak_terkirim | LOG-L76 |
| | Pagar titik Gudang mati | Selama mati; hanya Pemilik dan GM (LOG-32) | pengaturan pagar | Pengaturan |
| **3. Uang** | Uang belum diperiksa | Lebih dari 3 hari sejak Kirim (LOG-62): jumlah bagian dan rupiah **menurut laporan awak** | Penanda uang belum diperiksa | LOG-L58 |
| | Uang tunai trip belum diserahkan | Lewat 12.00 hari berikutnya (LOG-127) | Penanda uang tunai belum diserahkan | LOG-L59 |
| | Uang antar sendiri belum diterima | Lewat 23.59 hari itu (LOG-128) | Penanda uang tunai belum diserahkan | LOG-L59 |
| | Kurang serah bulan ini | Ada kurang serah Berlaku (LOG-129); tidak untuk Marketing | serah_tunai | LOG-L62 |
| | Potong nota menunggu | Lebih dari 3 hari (LOG-52) | Penanda barang kembali | LOG-L42 |
| | Retur menunggu nilai | Lebih dari 3 hari (LOG-60) | Penanda retur | LOG-L56 |
| | Catat di Kasir menunggu | Lebih dari 2 hari sejak siap (LOG-133) | Penanda Catat di Kasir | LOG-L64 |
| **4. Mobil dan bensin** | Permintaan bensin | Menunggu: mobil, perkiraan, foto amper terakhir, sejak; merah lewat 12.00 hari berikutnya (B4) | permintaan_bensin | LOG-L73, L74 |
| | Uang bensin belum ada struknya | Uang bensin "struk menyusul" yang belum dilengkapi (KEU-26) | Keuangan (dibaca) | LOG-L73 |
| | Keadaan mobil perlu perhatian | Laporan Perlu perhatian yang belum Selesai (KEH-94, 130) | Kehadiran (dibaca) | KEH-L25 |

- Tiap baris: nama, **jumlah**, **yang terlama** (umurnya dalam jam atau
  hari), dan tombol **Buka** ke layar pengerjanya dengan saringan yang
  sama. Bagian 1 berupa kartu per trip dan per perjalanan.
- **Siapa melihat apa** (B1):

| Bagian | Pemilik, GM | Kepala Gudang | Marketing | Finance |
|---|---|---|---|---|
| 1. Berjalan sekarang | ya | ya | ya | — |
| 2. Pengiriman | ya | ya, tanpa pagar mati | ya, tanpa pagar mati | — |
| 3. Uang | ya | ya | ya, tanpa kurang serah | ya |
| 4. Mobil dan bensin | ya | ya | — | ya |

  Kenapa Finance melihat bagian bensin: Finance mencatat Sudah Diisi dan
  memberi uangnya (LOG-83, 84), jadi bensin termasuk urusan uang. Kenapa
  kurang serah tidak untuk Marketing: itu urusan uang seseorang yang
  diteruskan ke HR, bukan tagihan toko. Pagar mati hanya untuk Pemilik dan
  GM karena hanya mereka yang mematikannya (LOG-32).
- Kepala Toko dan staf cabang tidak membuka Dashboard; urusan cabangnya
  sudah tampil di Beranda mereka (LOG-40, 80, 128; M6).

#### Dashboard hanya membaca (LOG-82)

- Tiap baris dibaca dari **satu fungsi baca** milik bagian yang menulis
  tandanya (misalnya "tertunda merah" dari tanda yang dipasang Penanda
  tertunda). Batas hari tidak dihitung ulang di halaman, sehingga angka
  Dashboard selalu sama dengan angka penanda menu dan Antrean (WAJ-04).
- Rupiah yang tampil hanya dari tabel pemiliknya: uang belum diperiksa =
  angka yang dilaporkan awak (bertulisan "menurut laporan awak"); kurang
  serah dari serah_tunai. **Tidak ada** jumlah uang masuk, laba, atau
  piutang di Dashboard.
- Tidak ada tombol yang mengubah data di Dashboard sendiri. Tombol yang
  tampil (Batalkan atau Tetap rencana, Sudah Diisi, Tidak jadi, Tinjau)
  membuka layar pemiliknya.
- **Muat ulang otomatis tiap 1 menit** selama halaman terbuka (pengaturan),
  ditambah tombol **Muat ulang**. Di atas: "Dimuat jam 09.41" dan "Data
  kasir terakhir masuk jam 09.40" (PRI-39 butir 3). Hanya jumlah dan 5
  baris terlama per baris yang diambil; rinciannya di layar pengerja
  (PRI-10, 11).
- Bila semuanya 0: "Tidak ada yang perlu perhatian hari ini."

#### Tinjau kiriman di luar titik toko (B2; LOG-99)

- Kirim, Kirim Besok, atau Gagal yang disimpan di luar radius titik toko
  (100 meter) tetap sah dan bertanda "di luar titik toko" (4F-2, 4F-4b);
  begitu juga Foto 2 antar sendiri. Kepala Gudang meninjaunya dari
  Dashboard (LOG-L76): foto yang diambil di toko, titik toko dan fotonya,
  jarak, akurasi GPS saat itu, dan berapa kali toko itu tercatat di luar
  titik dalam 30 hari terakhir.

| Hasil | Akibat |
|---|---|
| **Wajar** (catatan pilihan) | Tanda selesai |
| **Titik toko mungkin salah** | Menjalankan "Laporkan titik salah" (LOG-93) dengan kunjungan ini sebagai bukti; titik lama tetap dipakai sampai diputuskan di LOG-L06 |
| **Tidak wajar** (alasan wajib) | Ditandai untuk Pemilik dan GM (perlu perhatian); awak atau PJ diberi tahu alasannya. **Tidak ada potongan otomatis**: bila barang atau uang ternyata hilang, jalannya lewat Tidak sesuai, kurang serah, atau HR seperti biasa |

- Belum ditinjau lebih dari 3 hari: masuk Antrean Kepala Gudang.
- Peninjau bukan awak trip atau PJ perjalanan itu; Kepala Gudang yang ikut
  menjadi awak tidak meninjau tripnya sendiri (Pemilik atau GM yang
  meninjau).
- Kenapa tidak ditolak di toko: sinyal GPS di gang sering melenceng dan
  barang tetap harus turun (4F-2). Kenapa tetap ditinjau: tanpa
  peninjauan, tanda hanya menumpuk seperti 13 tanda bensin di sistem lama.

#### Permintaan bensin (B4; LOG-83, KEH-100)

- **Lahir** dari Laporan Pulang driver di trip (KEH-L20 langkah 4): "Perlu
  isi bensin besok? Ya, kira-kira Rp300.000." Permintaan memuat mobil,
  trip, driver, perkiraan, foto amper dari lapor garasi (LOG-29), dan jam
  server.
- **Satu permintaan Menunggu per mobil.** Permintaan baru untuk mobil yang
  sama mengganti yang lama (yang lama Diganti), karena yang dipakai adalah
  keadaan tangki terakhir.
- **Ditutup** dengan salah satu:
  - **Sudah Diisi** (LOG-L73): mencatat bensin; permintaan Selesai.
  - **Tidak jadi** (LOG-L74), alasan wajib (misalnya "masih setengah,
    cukup untuk besok"). Driver peminta diberi tahu.
- Masih Menunggu sampai **12.00 hari berikutnya**: merah di Dashboard dan
  masuk Antrean Kepala Gudang dan Finance. Tidak ditutup otomatis.
- Kenapa: di sistem lama 13 tanda bensin menyala dan tidak pernah ditutup,
  karena tidak ada kewajiban menutup dan tombolnya tidak bekerja untuk
  Finance.

#### Mencatat bensin "Sudah Diisi" (B3, B6; LOG-83, KEU-26)

- Oleh **Kepala Gudang, Finance, Pemilik, atau GM**, dari permintaan atau
  tanpa permintaan (**Catat bensin**, misalnya isi di tengah jalan). HR,
  driver, dan kenek tidak mencatat; driver cukup menyerahkan struk dan
  kembaliannya.
- **Isian:** mobil (aktif, dari Mobil & Rute), siapa yang mengisi (bawaan:
  driver peminta), tanggal isi (tidak ke depan; paling jauh 7 hari ke
  belakang, KEU-12), **nominal struk** (bilangan bulat, lebih dari 0),
  **foto struk** (wajib sejak awal, KEU-11; kamera atau galeri, karena
  struk sering difoto di SPBU), catatan.
- **Struk hilang** (B6): pencatat memilih "struk tidak ada" dengan alasan
  wajib; catatan tetap tersimpan, bertanda, dan ditandai untuk Pemilik dan
  GM (sejalan "bukti tidak ada" KEU-11). Kenapa tidak ditolak: bensinnya
  sudah terisi dan uangnya sudah keluar; menolak hanya membuat uang keluar
  tidak tercatat.
- **Asal uang** (B3), satu pilihan:

| Asal uang | Kapan | Akibat di Buku Kas (lewat pintu tulis Keuangan, 4H) |
|---|---|---|
| **Uang bensin yang sudah diberikan** | Finance atau pemegang Brankas sudah memberi uang ke pengisi lebih dulu ("struk menyusul", KEU-26) | Baris yang sama dibetulkan menjadi sebesar struk dan diberi foto; kembalian kembali ke tempat uang asalnya; struk lebih besar: kekurangannya dibayar ke pengisi dari tempat uang yang sama |
| **Dari tempat uang yang saya pegang** | Pencatat membayar sendiri dari Kas Pegangan (Finance) atau Brankas (pemegangnya) | Satu baris uang keluar baru |
| **Dibayar orang lain dulu** | Misalnya Kepala Gudang atau driver memakai uang sendiri | Satu baris uang keluar bertanda **"belum dipasangkan"**; Finance memasangkannya dengan Catatan Cepat atau membayar gantinya ke orang itu (KEU-18) |

  Contoh: Senin sore Dedi minta isi bensin Rp300.000 untuk L300. Selasa
  pagi Finance memberi Rp300.000 dari Kas Pegangan (baris "struk
  menyusul"). Siangnya Dedi menyerahkan struk Rp285.000 dan kembalian
  Rp15.000. Kepala Gudang membuka permintaan itu, memilih "Uang bensin
  yang sudah diberikan", mengetik Rp285.000, dan memotret struk.
  Hasilnya **satu** baris uang keluar Rp285.000, kejadian "Bensin atau
  solar", kendaraan L300; Rp15.000 kembali ke Kas Pegangan.
- Kejadian di Buku Kas selalu **"Bensin atau solar"** dengan kendaraan =
  mobil yang dipilih (KEU-19, 123); cabang yang dibebani = cabang Gudang,
  pemilik mobil. Kenapa satu baris: KEU-18 dan KEU-26 (satu uang keluar,
  satu baris).
- **Diperiksa** (B6): baris bensin diperiksa di Pemeriksaan Keuangan
  seperti baris yang diketik (KEU-09, 13), bukan sah sendiri, karena
  nominalnya diketik orang dan tidak diperiksa di Logistik. Pencatat tidak
  memeriksa catatannya sendiri (KEU-120).
- Simpan ditahan 3 detik (menyangkut uang, TAM-15).

#### Membatalkan catatan bensin (LOG-86)

- Salah nominal, salah mobil, atau dobel: **dibatalkan dengan alasan**,
  lalu dicatat ulang. Pencatat boleh selama baris Buku Kasnya belum
  diperiksa; sesudahnya hanya Pemilik dan GM (KEU-16). Baris Buku Kas ikut
  dibatalkan lewat pintu tulis yang sama; permintaannya kembali Menunggu
  bila catatan itu yang menutupnya.
- Tidak ada yang dihapus; riwayat tersimpan.

#### Laporan Logistik (B5; LOG-81)

- **Periode:** 26–25 (bawaan: periode berjalan; periode lama dimuat saat
  dipilih, PRI-11) atau tanggal bebas paling panjang 3 bulan (pengaturan;
  supaya laporan tetap cepat, PRI-12).
- **Dasar tanggal** (B5): kiriman dan uangnya memakai **tanggal kirim**
  (tanggal trip atau perjalanan; Kirim Besok dan Gagal pada tanggal
  kejadiannya); retur memakai tanggal diambil; bensin memakai tanggal isi.
  Di atas laporan tertulis: "Laporan pengiriman. Uang masuk resmi per
  tanggal uang ada di Keuangan Hari Ini." Kenapa: laporan ini menilai
  pekerjaan pengiriman; Keuangan menilai uang (KEU-98). Dua dasar tanggal
  tidak dicampur dalam satu angka.
- **Saring:** jalur (truk, antar sendiri, semua), cabang pemilik nota,
  mobil, rute, toko.

| Tab | Isi |
|---|---|
| **Ringkasan** | Kiriman: nota dikirim, Terkirim, Kirim Besok, Gagal, Batal, Diambil toko; tertunda dibuka dan ditutup. Uang: **terperiksa** per cara bayar (Cocok, dan angka benar dari Tidak Cocok), deposit Belum masuk, tempo (nominal tagihan, bukan uang), dan terpisah **belum diperiksa (menurut laporan awak)**; potongan disetujui; nilai retur disahkan. Bensin: rupiah dan banyaknya pengisian |
| **Per trip dan perjalanan** | Tanggal, jalur, mobil atau PJ, rute, awak, jumlah tujuan, Terkirim, Kirim Besok, Gagal, uang terperiksa, belum diperiksa, lama (berangkat sampai lapor garasi atau Foto 3), di luar titik |
| **Per toko** | Kunjungan, Terkirim, Kirim Besok, Gagal, retur, potongan, uang terperiksa |
| **Per cabang pemilik nota** | Nota dan nominalnya, uang terperiksa, potongan, nilai retur |
| **Per mobil** | Trip, banyaknya ritase, bensin (rupiah, banyaknya pengisian), laporan keadaan Perlu perhatian |
| **Per awak** | Trip, kunjungan, Kirim Besok, Gagal, kirim di luar titik; perjalanan antar sendiri per PJ. Tanpa rupiah per orang |

- **Angka dibaca dari pemiliknya** (LOG-82): uang dari pemeriksaan_uang,
  potongan dari potong_nota, nilai retur dari retur, ritase dari baris
  ritase (banyaknya, bukan rupiah; rupiahnya di 4G), bensin dari
  catatan_bensin. Laporan hanya menjumlah dan menghitung baris; tidak ada
  rumus uang sendiri. **Tanpa piutang** (piutang di Daftar Tagih, dibaca
  dari kasir).
- **Unduh Excel** dibuat server (KEU-116): satu lembar per tab, memuat
  periode, saringan, tanggal dibuat, dan pembuatnya; unduhan tercatat. Bila
  menyiapkannya lama, server mengerjakannya di belakang dan memberi tahu
  saat siap (PRI-12).
- **Siapa:** Pemilik, GM, Kepala Gudang, dan Finance semua tab; Marketing
  semua tab **tanpa angka bensin** (sejalan Dashboard, LOG-80).
- **Data lama:** periode sebelum hari mulai menampilkan riwayat yang dibawa
  bertanda "data lama", uangnya dari verifikasi lama (4F-5a); retur lama
  tanpa nilai (4F-4b) dan bensin lama tidak ada.

#### LOG-L71. Dashboard Logistik

- **Letak:** Logistik › Dashboard Logistik (butir pertama menu Logistik).
  **PC dan HP** (di HP tiap bagian menjadi kartu yang bisa dilipat).
- **Atas:** tanggal, "Dimuat jam …", "Data kasir terakhir masuk jam …",
  tombol **Muat ulang**.
- **Isi:** empat bagian menurut tabel di atas, hanya yang boleh dilihat
  pembuka (B1). Tiap baris: nama, jumlah, terlama, **Buka**. Merah = lewat
  batas; oranye = mendekati (paket 6 jam, LOG-40).
- **Pesan (kosong):** "Tidak ada yang perlu perhatian hari ini."
- Bentuk yang belum ada komponennya: kartu trip berjalan dengan progres
  toko (7/9), dan baris ringkas "jumlah · terlama · Buka".

#### LOG-L72. Bensin

- **Letak:** Logistik › Bensin; dari baris Dashboard. **PC dan HP.**
- **Tab:** Permintaan (Menunggu; merah lewat 12.00 hari berikutnya),
  Catatan bensin (per periode 26–25; saring mobil), Ditutup (Selesai, Tidak
  jadi, Diganti), Dibatalkan.
- **Isi baris permintaan:** mobil, driver, perkiraan, foto amper (kecil,
  dibuka saat ditekan), sejak.
- **Tombol:** **Sudah Diisi** (LOG-L73), **Tidak jadi** (LOG-L74), **Catat
  bensin** (LOG-L73 tanpa permintaan), **Batalkan** pada catatan
  (LOG-L75).
- Angka penanda di menu Bensin: jumlah permintaan Menunggu.

#### LOG-L73. Sudah Diisi (3 langkah, TAM-07)

1. Mobil (terisi dari permintaan), siapa yang mengisi, tanggal isi.
2. Nominal struk dan foto struk (atau "struk tidak ada" dengan alasan).
   Perkiraan driver tampil sebagai pembanding: "Perkiraan Rp300.000."
3. Asal uang (tabel di atas) dan akibat dalam angka: "Satu baris uang
   keluar Rp285.000 dari Kas Pegangan, Bensin atau solar, L300. Kembalian
   Rp15.000 kembali ke Kas Pegangan. Diperiksa Pemilik di Keuangan."
   **Simpan**, ditahan 3 detik.

#### LOG-L74. Tidak Jadi Isi Bensin (2 langkah)

1. Alasan (wajib).
2. Akibat: "Permintaan bensin L300 ditutup. Dedi diberi tahu." **Simpan**
   (tombol biasa, karena tidak ada uang yang bergerak).

#### LOG-L75. Batalkan Catatan Bensin (2 langkah)

1. Alasan (wajib).
2. Akibat: "Catatan bensin L300 Rp285.000 dibatalkan. Baris uang keluarnya
   ikut dibatalkan; permintaan kembali Menunggu." Ditahan 3 detik.
   Pencatat selama barisnya belum diperiksa; Pemilik dan GM kapan saja.

#### LOG-L76. Tinjau Kirim di Luar Titik (2 langkah)

1. Foto di toko, titik toko dan fotonya, jarak, akurasi GPS, catatan di
   luar titik toko itu 30 hari terakhir.
2. Hasil (Wajar, Titik toko mungkin salah, Tidak wajar), catatan atau
   alasan, akibat dalam kalimat; **Simpan** (tombol biasa).

#### LOG-L77. Laporan Logistik

- **Letak:** Logistik › Laporan Logistik. **PC.**
- **Atas:** pilih periode atau tanggal, saringan, tulisan dasar tanggal.
- **Tab:** menurut tabel di atas; tiap tab berupa tabel per halaman
  (PRI-10).
- **Tombol:** **Unduh Excel**.
- Bentuk yang belum ada komponennya: kotak angka ringkasan di tab
  Ringkasan.

---

## 4. Data

Semua tabel punya kolom perusahaan (PRI-31), jejak dibuat dan diubah, tidak ada
yang dihapus (PRI-02), dan indeks pada kolom pencarian (PRI-14). Cabang, orang,
dan jabatan milik Karyawan; pelanggan dan transaksi kasir milik Tarik Data
Kasir; tabel di bawah hanya menunjuknya. Nominal rupiah bilangan bulat (PRI-28).

| Tabel | Isi penting | Dicari dengan | Dibaca modul lain | Bagian |
|---|---|---|---|---|
| toko | nama, nama pembanding (tanpa huruf besar, spasi ganda, titik), alamat, nomor HP, rute bawaan, catatan pengiriman, sumber (diketik, kasir), tanda belum diperiksa (ditambah cabang), status (Aktif, Nonaktif), digabung ke (toko), alasan nonaktif | nama pembanding (unik termasuk nonaktif); rute; status | Gaji Driver, Keuangan, Kinerja (lewat nota) | 4F-1 |
| gabung_toko | toko digabung, toko tetap, oleh, kapan, alasan, isian yang dipilih, status (Berlaku, Dibatalkan), dibatalkan oleh, kapan, alasan | toko | — | 4F-1 |
| pindah_gabung | gabung, jenis catatan, nomor catatan (untuk membatalkan gabung) | gabung | — | 4F-1 |
| titik_toko | toko, lintang, bujur, akurasi, foto, pemasang, kapan (server), asal (trip, antar sendiri, kantor), status (Menunggu, Disetujui, Ditolak, Diganti), diputus oleh, kapan, alasan | toko + status | Logistik 4F-2, 4F-3 | 4F-1 |
| mobil | nama, plat (unik), status (Aktif, Nonaktif) | status | Gaji Driver (tarif), Kehadiran (Keadaan Mobil KEH-94) | 4F-1 |
| rute | nama, jenis (antar, belanja), status | jenis + status | Gaji Driver (tarif) | 4F-1 |
| surat_jalan | nomor struk, cabang kasir (Gudang), toko, nominal, catatan, tanggal (server atau tanggal transaksi), sumber (diketik, kasir), cocok dengan kasir (ya, belum, tidak cocok), transaksi kasir yang dipasangkan, status (Menunggu dijadwalkan, Dalam perjalanan, Terkirim, Perlu keputusan, Diambil toko, Batal), pernah tertunda (tanggal pertama), pencatat, alasan batal atau diambil toko. **Unik: nomor struk + cabang kasir** | status; toko; nomor | Logistik 4F-2 s.d. 4F-5, Keuangan | 4F-1 |
| perubahan_surat_jalan | surat jalan, kolom, nilai lama, nilai baru, oleh (orang atau kasir), kapan, alasan | surat jalan | — | 4F-1 |
| nota | jenis (gudang, cabang), asal (surat jalan atau laporan muat nomor berapa), cabang pemilik nota, toko, nominal, nomor kasir + cabang kasir, sumber (diketik, kasir), tercatat di kasir (diisi 4F-5), terkunci (diisi 4F-5). **Unik: asal** | toko; cabang pemilik nota; asal | Logistik 4F-4, 4F-5; Keuangan (Kas Masuk, KEU-71) | 4F-1 |
| trip | nomor, dibuat oleh, mobil, rute, status (Draft, Siap Kirim, Berjalan, Menuju Garasi, Selesai, Dibatalkan), tanggal trip (diisi saat Berangkat), jam berangkat, foto awak, lokasi berangkat, penekan Berangkat, kunjungan yang sedang dituju, selesai lebih awal (alasan, foto), foto bak kosong, jam Menuju Garasi, jam lapor garasi, lokasi dan jarak ke titik Gudang, foto amper, ditutup oleh (driver, kantor), alasan dan foto tutup kantor, tanda pagar titik mati, alasan batal | tanggal trip + status; mobil + status | Kehadiran (absen trip, KEH-120), Gaji Driver (4G) | 4F-2 |
| awak_trip | trip, orang, peran (driver, kenek), ditambah kapan, oleh, dicopot kapan, oleh, alasan, status (Berlaku, Dicopot). **Satu orang hanya di satu trip Berjalan atau Menuju Garasi** (diperiksa server) | trip; orang + status | Kehadiran, Gaji Driver | 4F-2 |
| kunjungan | trip, toko, urutan tampil, status (Menunggu, Sedang dituju, Sedang diproses, Terkirim, Kirim Besok, Gagal, Dilepas), dipegang oleh, jam, lokasi, jarak ke titik toko, tanda di luar titik, ditinjau oleh, kapan. Isi Kirim dan uang di 4F-4 | trip; toko + status | Logistik 4F-4, 4F-5 | 4F-2 |
| kunjungan_surat_jalan | kunjungan, surat jalan, status (Berlaku, Dilepas) | kunjungan; surat jalan | — | 4F-2 |
| tugas_belanja | trip, rute belanja, supplier (daftar supplier Keuangan), foto nota, catatan, status (Menunggu, Selesai, Dilepas), oleh, jam | trip; status | Keuangan (nota supplier, KEU-26), Gaji Driver | 4F-2 |
| ritase | orang, peran, trip (kosong untuk tangan), tugas belanja (untuk upah belanja), jenis (ritase, upah belanja), tanggal, mobil, rute, berkenek, asal (lapor garasi, ditutup kantor, tangan), alasan (tangan), konfirmasi dobel, status (Berlaku, Dibatalkan), dibatalkan oleh, alasan. **Unik untuk asal server: trip + orang + jenis + tugas belanja** | orang + tanggal; trip | Gaji Driver (nominal dan Buku Upah, DRV-09, 84), Kehadiran | 4F-2 |
| pagar_dimatikan | pagar (titik Gudang saat lapor garasi), oleh, mulai, sampai (paling lama 24 jam), alasan, menyala lagi kapan | sampai | Kesehatan Mesin (BER-L30) | 4F-2 |
| laporan_muat | nomor, cabang asal, toko tujuan, catatan, status (Proses, Menunggu dijemput, Menunggu diantar, Di trip, Dalam perjalanan, Terkirim, Perlu keputusan, Batal), jalur (driver, antar sendiri), jam Tandai Selesai (dasar warna menunggu), nota (tabel nota), ongkir, sumber ongkir (diketik, kasir), pengantar, sumber pengantar (diketik, kasir, dipilih karena beda), tanda pengantar beda dengan kasir, dijadwalkan di trip, tanda barang di Gudang, pembuat, alasan batal atau kembali ke Proses | cabang asal + status; toko + status | Logistik 4F-2 (rencana), 4F-4, 4F-5 | 4F-3 |
| foto_laporan_muat | laporan muat, jenis (isi barang, paket), nomor paket, foto, jam (server), oleh, status (Berlaku, Dibatalkan) | laporan muat | — | 4F-3 |
| ambil_paket | laporan muat, trip, kunjungan, oleh, jam, foto paket di mobil, paket dicentang, status (Berlaku, Dikembalikan karena trip batal) | laporan muat; trip | Logistik 4F-4 | 4F-3 |
| perubahan_laporan_muat | laporan muat, kolom, nilai lama, nilai baru, oleh (orang atau kasir), kapan, alasan | laporan muat | — | 4F-3 |
| perjalanan_antar | nomor, cabang asal, PJ, status (Berjalan, Selesai, Ditutup kantor), jam dan foto dan lokasi Foto 1, jam dan foto dan lokasi Foto 3, lama berangkat, lama kembali (menit), alasan selisih, ditutup oleh, alasan tutup. **Satu orang hanya satu perjalanan Berjalan** (diperiksa server) | PJ + status; cabang + tanggal | Gaji (tanda ⚠ bonus ongkir), Dashboard 4F-5 | 4F-3 |
| tujuan_perjalanan | perjalanan, toko, urutan, jam dan foto dan lokasi Foto 2, jarak ke titik toko, tanda di luar titik, hasil (Terkirim, Kirim Besok, Gagal; isi 4F-4) | perjalanan | Logistik 4F-4 | 4F-3 |
| kiriman_perjalanan | perjalanan, tujuan, laporan muat | perjalanan; laporan muat | — | 4F-3 |
| pengalihan_pj | perjalanan, PJ lama, PJ baru, oleh, kapan, alasan | perjalanan | — | 4F-3 |
| asal_bonus_ongkir | baris ongkir kasir (nomor nota + cabang + baris), baris Buku Bonus, laporan muat (bila ada), tanda ⚠ dipasang kapan, dicabut kapan | baris ongkir | Gaji (GAJ-L20) | 4F-3 |
| hasil_kirim | kunjungan **atau** tujuan perjalanan (salah satu), foto terkirim, oleh, jam (server), lokasi, jarak ke titik toko | kunjungan; tujuan | Logistik 4F-5 | 4F-4a |
| pembayaran | kunjungan atau tujuan, cara bayar (cash, transfer, deposit, tempo, campuran), uang cash, uang transfer, total (dihitung), foto bukti transfer, tanggal jatuh tempo (tempo), tanggal janji bayar sisa, lebih bayar, pemegang titipan (cabang, K2), oleh, kapan, alasan (ubah), status (Berlaku, Diganti). **Satu yang Berlaku per kunjungan atau tujuan** | kunjungan; tujuan; status | Logistik 4F-5 (pemeriksaan), Keuangan lewat 4F-5 | 4F-4a |
| bagian_nota | pembayaran, nota, tagihan (nominal − potongan disetujui), bagian cash, bagian transfer, kurang, urutan, status (Berlaku, Diganti). Ditulis hanya oleh fungsi bagi uang kunjungan (LOG-112) | nota + status; pembayaran | Logistik 4F-5, Keuangan (Kas Masuk lewat 4F-5) | 4F-4a |
| potong_nota | kunjungan atau tujuan, pemilik barang (cabang), nota yang dipotong (diisi rumus), barang, nominal, alasan, keterangan, nasib (dibawa kembali, tidak ada), foto, pencatat, status (Menunggu, Disetujui, Ditolak, Dibatalkan), diputus oleh, kapan, alasan tolak, alasan batal, terkunci (barang diterima) | kunjungan; status | Logistik 4F-5 (kiriman ke kasir) | 4F-4a |
| barang_kejadian | kunjungan atau tujuan, jenis (salah muat, barang lebih), barang terkirim, seharusnya, jumlah, pemilik barang, keterangan, nasib (dibawa pulang, dibeli toko), foto, pencatat, status (Berlaku, Dibatalkan) | kunjungan | — | 4F-4a |
| barang_kembali | sumber (potong nota, kejadian, retur), nomor sumber, toko asal, pemilik barang (cabang), barang, jumlah, trip atau perjalanan pembawa, status (Dibawa, Diserahkan, Diterima, Dialihkan ke Gudang, Dibatalkan), foto serah, diserahkan oleh, kapan, foto terima, diterima oleh, kapan, sesuai (ya, tidak), catatan tidak sesuai, foto tidak sesuai, alasan alih atau batal | pemilik + status; trip; perjalanan | Logistik 4F-2 (syarat Menuju Garasi, lapor garasi), 4F-4b (retur), 4F-5 (Dashboard) | 4F-4a |
| koreksi_kasir | barang kejadian, cabang pemilik, jenis (koreksi stok, perlu nota di kasir), status (Menunggu, Selesai), nomor struk (perlu nota), oleh, kapan | cabang + status | — | 4F-4a |
| tidak_terkirim | kunjungan **atau** tujuan perjalanan, hasil (Kirim Besok, Gagal), alasan, keterangan, foto, lokasi, jarak ke titik toko, tanda di luar titik, oleh, jam (server), asal (awak, selesai lebih awal, tutup trip kantor, tutup perjalanan), status (Berlaku, Dicoba lagi) | kunjungan; tujuan | Dashboard 4F-5 | 4F-4b |
| tertunda | kiriman (surat jalan **atau** laporan muat), toko, jalur, jenis terakhir, tidak terkirim terakhir, berapa kali, sejak (tanggal pertama), letak barang (trip, Gudang, cabang asal), diturunkan di Gudang kapan dan foto, status (Menunggu jadwal, Perlu keputusan, Selesai, Ditutup, Dicoba lagi), selesai karena (Terkirim, Diambil toko, Batal), ditutup oleh, kapan, keterangan. **Satu yang terbuka per kiriman** (diperiksa server) | status + sejak; toko; kiriman | Dashboard dan Laporan 4F-5 | 4F-4b |
| keputusan_gagal | tertunda, kiriman, keputusan (Jadwal ulang, Batal), jalur dan pengantar baru (laporan muat), alasan, oleh, kapan, status (Berlaku, Dibuka lagi), dibuka oleh, kapan, alasan | kiriman | 4F-5 (baris "batalkan penjualan di kasir") | 4F-4b |
| retur | nomor, toko, cabang penerima, catatan permintaan, ditandai oleh, kapan, status (Menunggu ditugaskan, Di trip, Diambil, Tanpa barang, Menunggu nilai, Selesai, Dibatalkan), trip, riwayat dicoba (tanggal, foto, alasan), tanda terlewat, foto posisi akhir, keterangan letak, foto toko dan alasan (tanpa barang), disahkan oleh, kapan, alasan batal | toko + status; trip | Logistik 4F-2 (isi rencana, syarat Menuju Garasi), 4F-5 (kiriman ke kasir, Dashboard) | 4F-4b |
| barang_retur | retur, foto, nama, jumlah, satuan, alasan, keterangan, pemilik (cabang), barang kembali, nilai (rupiah, diisi Finance), alasan nilai Rp0, status (Berlaku, Dibatalkan) | retur | 4F-5 | 4F-4b |
| perubahan_nilai_retur | barang retur, nilai lama, nilai baru, oleh, kapan, alasan | barang retur | — | 4F-4b |
| pemeriksaan_uang | pembayaran, bagian (tunai, transfer, deposit), angka dilaporkan, hasil (Cocok, Tidak Cocok, Belum masuk), angka benar, alasan, tempat uang, tanggal uang, serah tunai (bila lewat serah), lewat setoran Laporan Kasir (antar sendiri), pembayaran pengganti (bila Tidak Cocok), baris Kas Masuk yang lahir, oleh, kapan, status (Berlaku, Dibatalkan), dibatalkan oleh, kapan, alasan. **Satu yang Berlaku per pembayaran + bagian**; pemeriksa bukan pengubah terakhir pembayaran | pembayaran + bagian + status; oleh + kapan | Keuangan (Kas Masuk), Logistik 4F-5b (kiriman ke kasir), 4F-5c | 4F-5a |
| serah_tunai | trip **atau** perjalanan antar sendiri, harus diserahkan (dihitung), rincian per toko dan pembawa, hasil hitung, penerima, tempat uang (Setoran di Finance, Brankas, Laci cabang asal), kapan (server), status (Berlaku, Dibatalkan), alasan batal. **Satu yang Berlaku per trip atau perjalanan** | trip; perjalanan; penerima + kapan | Dashboard 4F-5c | 4F-5a |
| selisih_serah | serah tunai, jenis (kurang serah, lebih serah), pembawa, jumlah, tanda pembawa tidak jelas, keterangan, diteruskan ke HR (bahan Potongan Lain), status (Berlaku, Dibatalkan) | serah tunai; pembawa | Gaji (bahan Potongan Lain, GAJ-80), Keuangan (baris selisih, 4H) | 4F-5a |
| tinjau_barang | barang kembali, jumlah diserahkan, jumlah sebenarnya diterima, keputusan (Sesuai setelah dicek, Selisih dicatat), diteruskan ke HR (usulan kehilangan barang), catatan, oleh, kapan, status (Berlaku, Ditinjau ulang) | barang kembali | Gaji (bahan usulan kehilangan barang, GAJ-75) | 4F-4b |
| catat_kasir | jenis (ringkasan nota, titipan toko, kurangi tagihan retur, batalkan penjualan, koreksi, titipan pelunasan, pembayaran toko ke Gudang), kasir cabang, toko, nota (bila ada), sumber (modul, tabel, nomor), isi (yang diketik di kasir: uang per cara bayar dan tanggal, potongan, sisa, janji bayar atau jatuh tempo, angka), siap sejak, versi, berubah sejak tampil, status (Menunggu dicatat, Tercatat, Diganti, Dibatalkan), keterangan batal, ditandai oleh, kapan, nomor bukti kasir (pilihan), tercatat otomatis (pencocok pembatalan), tanda dibatalkan oleh, kapan, alasan. **Satu yang Menunggu dicatat atau Tercatat per sumber + jenis** | kasir cabang + status; toko; nota | Keuangan (menulis lewat pintu tulis, membaca status), Dashboard 4F-5c | 4F-5b |
| koreksi_nota | nota atau retur, yang dikoreksi (uang, tempat uang, potongan, nilai retur), nilai sebelum, nilai sesudah, alasan, oleh, kapan, pengganti (pembayaran, pemeriksaan, potong nota, atau nilai retur baru), baris Kas Masuk yang dibatalkan dan yang baru, baris catat_kasir yang lahir | nota; oleh + kapan | Keuangan (Kas Masuk) | 4F-5b |
| cocok_piutang | nota, sisa menurut HRIS, sisa menurut kasir, tarikan atau file, ditandai kapan, hasil (Beda, Sama lagi, Dibiarkan), alasan biarkan, oleh, kapan | nota + hasil | Tarik Data Kasir (TDK-L06 tab Piutang) | 4F-5b |
| catatan_tagih | toko, nota (pilihan), tanggal, hasil (Janji bayar, Tidak bisa dihubungi, Tagih saat kirim berikutnya, Sengketa), tanggal janji, alasan sengketa, catatan, oleh, status (Berlaku, Selesai, Dibatalkan), alasan batal | toko + kapan; hasil + tanggal janji | Logistik 4F-2 dan 4F-3 (kotak minta ditagih di kunjungan) | 4F-5b |
| permintaan_bensin | mobil, trip, laporan pulang (rujukan), driver, perkiraan (bilangan bulat), foto amper (rujukan trip), kapan (server), status (Menunggu, Selesai, Tidak jadi, Diganti), catatan bensin penutup, alasan tidak jadi, ditutup oleh, kapan, diganti oleh (permintaan). **Satu yang Menunggu per mobil** | mobil + status; kapan | Kehadiran (menulis lewat pintu dari KEH-L20), Dashboard | 4F-5c |
| catatan_bensin | mobil, permintaan (pilihan), pengisi, tanggal isi, nominal struk, foto struk, struk tidak ada (alasan), catatan, asal uang (uang yang sudah diberikan, tempat uang pencatat, dibayar orang lain), baris Buku Kas (rujukan), dicatat oleh, kapan (server), status (Berlaku, Dibatalkan), dibatalkan oleh, kapan, alasan | mobil + tanggal isi; status | Keuangan (uang keluar, KEU-26), Laporan Logistik, Dashboard | 4F-5c |
| tinjau_luar_titik | kunjungan, tujuan perjalanan, atau catatan tidak terkirim; jarak; hasil (Wajar, Titik mungkin salah, Tidak wajar); catatan atau alasan; laporan titik salah (rujukan, bila ada); oleh; kapan; status (Berlaku, Diganti). **Satu yang Berlaku per catatan bertanda** | hasil; kapan | Dashboard, Laporan Logistik | 4F-5c |

**Tambahan 4F-4b pada tabel yang ada:** `barang_kembali.sumber` menerima
"tidak terkirim" (paket cabang yang Batal atau pindah ke antar sendiri
sementara barangnya di Gudang) dan mendapat kolom `tinjau` (Tidak perlu,
Menunggu tinjau, Ditinjau). `potong_nota.alasan` menerima "ditolak toko"
(LOG-122). `surat_jalan.pernah tertunda` diisi dari `tertunda`.

**Toko dan kasir:** kode pelanggan kasir tidak disimpan di `toko`; pasangannya
ada di `pasangan_nama_kasir` milik Tarik Data Kasir (satu nama kasir ke satu
toko; satu toko boleh banyak nama kasir sesudah digabung). Nama toko yang
tampil: nama kasir bila sudah dipasangkan, nama HRIS bila belum.

**Data lama (SIS-23 s.d. 33):** toko sistem lama dibawa sebagai toko
berstatus Aktif bersumber "diketik" (264 toko tanpa alamat dibawa dengan
tanda "alamat belum ada", karena aturan alamat 5 huruf berlaku untuk toko
baru); titik tidak ada di sistem lama; mobil dan rute dibawa dengan jenis
rute diisi pemilik saat menyiapkan tayang; surat jalan yang belum terkirim
saat hari pindah dibawa sebagai Menunggu dijadwalkan bersumber "diketik"
tanpa nomor struk dan bertanda "data lama" (pengecualian sempit PRI-41 butir
3, karena sistem lama tidak menyimpan nomor). **4F-3:** laporan muat yang
belum terkirim saat hari pindah (sistem lama: 10 paket belum diambil per 12
Oktober 2026) dibawa dengan status dan fotonya, bertanda "data lama"; yang
tanpa nominal nota (57 dari 81 laporan selesai di sistem lama) dibawa
bernominal kosong dan tidak bisa diambil atau diantar sebelum cabang
mengisi notanya. Perjalanan antar sendiri yang sudah selesai tidak dibawa
sebagai catatan berjalan, hanya sebagai riwayat. **4F-4a:** pembayaran
kunjungan sistem lama dibawa sebagai riwayat bertanda "data lama" dengan
cara bayar aslinya; "deposit" lama tidak diterjemahkan karena artinya tiga
(arsip LOG-C03). Kunjungan yang belum diperiksa finance saat hari pindah
(14 transfer per 12 Oktober 2026) dibawa sebagai pembayaran Berlaku supaya
bisa diperiksa di 4F-5; pembagiannya dihitung ulang dengan LOG-112. Barang
kembali yang belum dikonfirmasi diterima (3 retur) dibawa berstatus
Diserahkan. **4F-4b:** kiriman yang tertunda saat hari pindah (8
kunjungan menunggu per 12 Oktober 2026) dibawa sebagai catatan tertunda
Menunggu jadwal dengan tanggal pertama dari sistem lama; yang Perlu
keputusan dibawa Perlu keputusan. Retur sistem lama tidak punya jumlah dan
nilai (arsip LOG-C27, C31): yang sudah diterima dibawa sebagai riwayat
bertanda "data lama", tidak dinilai, karena tagihan toko di kasir tidak
pernah dikurangi olehnya; 3 retur yang belum diterima mengikuti barang
kembali di atas dan dinilai Finance hanya bila toko memang meminta
tagihannya dikurangi. **4F-5a:** pembayaran sistem lama yang sudah
diverifikasi dibawa bersama keadaan verifikasinya sebagai pemeriksaan
bertanda "data lama", tanpa menulis Kas Masuk baru (baris Kas Masuk lama
dibawa Keuangan, SIS-23 s.d. 33); yang belum diverifikasi (14 transfer per
12 Oktober 2026) diperiksa di LOG-L58 seperti biasa. Verifikasi lama yang
pernah dibatalkan tanpa alasan (arsip LOG-C35) tidak punya jejak, jadi
hanya keadaan terakhirnya yang dibawa. **4F-5b:** nota sistem lama yang
sudah terkirim dibawa bertanda "data lama" dan dianggap sudah beres di
kasir, tanpa baris Catat di Kasir. Buku Piutang sistem lama (sejak 10
Oktober 2026, arsip LOG-C37) tidak dibawa; titik awal piutang adalah potret
piutang kasir pada hari mulai (PRI-39 butir 5, KEU-94). Bila pembayaran yang
diterima driver selama ini tidak diketik di kasir, piutang kasir dibereskan
sekali sebelum hari mulai (titipan Tahap 5, D7). **4F-5c:** 13 tanda "perlu isi bensin" sistem lama
(per 12 Oktober 2026) tidak dibawa, karena tanpa nominal dan tidak pernah
ditutup; permintaan dan catatan bensin mulai pada hari mulai. Laporan
periode sebelum hari mulai hanya menampilkan riwayat bertanda "data lama".

**Tambahan 4F-5b pada tabel yang ada:** `nota.tercatat di kasir` dan
`nota.terkunci` diisi saat ringkasan nota Tercatat dan dikosongkan saat
tandanya dibatalkan. `kasir_piutang` (Tarik Data Kasir) harus berisi
piutang **per nota**: nomor struk + cabang kasir, sisa, tanggal, jatuh tempo
(titipan Tahap 5 ke project kasir). Unggah File (TDK-L03) mendapat jenis
baru "Piutang toko" dengan kolom yang sama.

**Tambahan 4F-5c:** Dashboard dan Laporan Logistik tidak punya tabel
sendiri; keduanya membaca tabel di atas lewat fungsi baca milik bagian
pemiliknya. Unduhan Excel tercatat (siapa, kapan, laporan, periode,
saringan). Tanda "di luar titik toko" di `kunjungan`, `tujuan_perjalanan`,
dan `tidak_terkirim` dianggap selesai bila ada `tinjau_luar_titik` yang
Berlaku.

---

## 5. Tindakan bernama dan isi awal hak

Isi awal dari LOG-84; diatur di Hak Akses Jabatan (KAR-58). Pemilik dan GM
punya semua tindakan.

| Tindakan | Marketing | Kepala Gudang | Finance | Driver, kenek | Staf cabang | Bagian |
|---|---|---|---|---|---|---|
| lihat data toko (semua) | ya | ya | ya | — | — | 4F-1 |
| lihat toko di trip atau laporannya sendiri | — | — | — | ya | ya | 4F-1 |
| tambah toko, ubah data pengiriman | ya | ya | — | — | tambah cepat dari laporan muat, sebelum sambungan menyala (F2) | 4F-1 |
| nonaktifkan / aktifkan toko | ya | ya | — | — | — | 4F-1 |
| gabungkan toko | ya | ya | — | — | — | 4F-1 |
| batalkan gabung | — | — | — | — | — | 4F-1 |
| pasang titik toko (usulan) | — | — | — | ya | pengantar antar sendiri (F3) | 4F-1 |
| pasang titik langsung, setujui atau tolak titik | — | ya | — | — | — | 4F-1 |
| laporkan titik salah | — | — | — | ya | pengantar antar sendiri | 4F-1 |
| ubah mobil dan rute | — | ya | — | — | — | 4F-1 |
| lihat mobil dan rute | ya | ya | ya | — | — | 4F-1 |
| catat surat jalan, ubah sebelum berangkat, batalkan, tandai diambil toko | ya | ya | — | — | — | 4F-1 |
| ubah surat jalan sesudah berangkat | — | — | — | — | — | 4F-1 |
| lihat surat jalan | ya | ya | ya | yang di trip-nya | — | 4F-1 |
| buat, ubah isi, Siap Kirim, batalkan rencana | — | ya | — | — | — | 4F-2 |
| lihat rencana dan trip | ya | ya | ya | trip yang menugaskan dirinya | — | 4F-2 |
| ganti awak, lepas kunjungan, tambah tugas sesudah berangkat | — | ya | — | — | — | 4F-2 |
| Berangkat, Saya menuju ke sini, buka kunjungan, tugas belanja, Selesai lebih awal, bak kosong | — | — | — | trip yang menugaskan dirinya | — | 4F-2 |
| lapor garasi | — | — | — | driver trip itu | — | 4F-2 |
| tutup trip atas nama driver | — | ya (bukan trip yang ia awaki) | — | — | — | 4F-2 |
| lihat ritase dan upah belanja | — | ya | — | miliknya sendiri (lewat Pendapatan Saya) | — | 4F-2 |
| ritase tangan, batalkan ritase | — | — | — | — | — | 4F-2 |
| matikan pagar uji | — | — | — | — | — | 4F-2 |
| lihat laporan muat dan perjalanan antar sendiri (semua cabang) | ya | ya | ya | — | cabangnya sendiri | 4F-3 |
| buat laporan muat, tambah foto dan paket, Tandai Selesai, ubah sebelum berangkat, kembalikan ke Proses, batalkan | — | — | — | — | cabangnya sendiri | 4F-3 |
| ubah nota laporan muat sesudah berangkat | — | — | — | — | — | 4F-3 |
| tugaskan paket ke rencana | — | ya | — | — | — | 4F-3 |
| ambil paket, Paket tidak lengkap | — | — | — | trip yang menugaskan dirinya | — | 4F-3 |
| mulai antar, Foto 2, Foto 3 | — | — | — | — | pengantar yang ditunjuk / PJ | 4F-3 |
| alihkan PJ | — | — | — | — | cabangnya sendiri | 4F-3 |
| tutup perjalanan antar sendiri | — | ya | — | — | Kepala Toko cabangnya (bukan perjalanan yang ia PJ-kan) | 4F-3 |
| putuskan Perlu Diperiksa nota cabang (Terima perubahan, Biarkan) | — | ya | — | — | Kepala Toko cabangnya | 4F-3 |
| Kirim (uang, potong nota, barang kejadian) | — | — | — | awak pemegang kunjungan | PJ antar sendiri | 4F-4a |
| ubah pembayaran dan potongan selama trip atau perjalanan berjalan | — | — | — | awak trip itu | PJ | 4F-4a |
| ubah pembayaran dan potongan sesudahnya | — | ya | — | — | Kepala Toko cabang asal (antar sendiri) | 4F-4a |
| lihat potong nota | ya | ya | ya | — | — | 4F-4a |
| setujui atau tolak potong nota | — | — | ya | — | — | 4F-4a |
| serahkan barang kembali | — | — | — | awak trip itu | PJ (lewat Foto 3) | 4F-4a |
| terima barang kembali | — | ya (milik Gudang) | — | — | cabangnya sendiri | 4F-4a |
| alihkan barang kembali ke Gudang | — | ya | — | — | — | 4F-4a |
| tandai koreksi stok / sudah dibuat di kasir | — | ya (milik Gudang) | — | — | Kepala Toko cabangnya | 4F-4a |
| Kirim Besok, Gagal, Coba lagi, Diturunkan di Gudang | — | — | — | awak pemegang kunjungan | PJ antar sendiri | 4F-4b |
| lihat tertunda | ya | ya | ya | — | laporan muat cabangnya | 4F-4b |
| putuskan kiriman Gagal: surat jalan | — | ya | — | — | — | 4F-4b |
| putuskan kiriman Gagal: laporan muat | — | ya | — | — | cabangnya sendiri | 4F-4b |
| buka lagi keputusan Batal | — | — | — | — | — | 4F-4b |
| tutup dan buka lagi tertunda | — | ya | — | — | — | 4F-4b |
| tandai retur, batalkan retur | ya | ya | ya | — | — | 4F-4b |
| tugaskan dan lepas retur | — | ya | — | — | — | 4F-4b |
| ambil retur (barang, Selesai, tidak bisa diambil, tidak ada barang) | — | — | — | awak trip itu | — | 4F-4b |
| Toko mau retur (kabari kantor) | — | — | — | awak pemegang kunjungan | PJ antar sendiri | 4F-4b |
| lihat retur | ya | ya | ya | retur di trip-nya | retur yang barangnya milik cabangnya | 4F-4b |
| isi dan sahkan nilai retur, ubah nilai sebelum tercatat di kasir | — | — | ya | — | — | 4F-4b |
| tinjau barang tidak sesuai | — | ya | — | — | — | 4F-4b |
| lihat pemeriksaan uang (semua tab) | — | tab Tunai trip | ya | — | — | 4F-5a |
| terima uang tunai trip | — | — | ya; juga pemegang Brankas (dari daftar tempat uang) | — | — | 4F-5a |
| terima uang tunai antar sendiri | — | — | — | — | cabangnya sendiri, bukan PJ perjalanan itu | 4F-5a |
| periksa transfer dan deposit; periksa tunai antar sendiri di luar setoran | — | — | ya | — | — | 4F-5a |
| batalkan pemeriksaan sendiri (7 hari, sebelum tercatat di kasir) | — | — | ya | — | — | 4F-5a |
| batalkan pemeriksaan siapa pun (sebelum tercatat di kasir) | — | — | — | — | — | 4F-5a |
| lihat Catat di Kasir | tab Menunggu dicatat | — | ya | — | — | 4F-5b |
| tandai tercatat di kasir, tandai sekaligus | — | — | ya | — | — | 4F-5b |
| batalkan tanda tercatat sendiri (24 jam) | — | — | ya | — | — | 4F-5b |
| batalkan tanda tercatat siapa pun | — | — | — | — | — | 4F-5b |
| koreksi nota sesudah tercatat | — | — | ya | — | — | 4F-5b |
| putuskan beda piutang (Perlu Diperiksa tab Piutang) | — | — | ya | — | — | 4F-5b |
| lihat Daftar Tagih dan rinciannya, unduh Excel | ya | — | ya | — | — | 4F-5b |
| catat hasil tagih | ya | — | ya | — | — | 4F-5b |
| lihat kotak "minta ditagih" | — | — | — | awak trip yang memuat toko itu | PJ perjalanan ke toko itu | 4F-5b |
| lihat Dashboard Logistik | bagian 1 s.d. 3, tanpa kurang serah dan pagar mati | semua bagian, tanpa pagar mati | bagian 3 dan 4 | — | — | 4F-5c |
| tinjau kirim di luar titik | — | ya, bukan trip yang ia awaki | — | — | — | 4F-5c |
| lihat Bensin | — | ya | ya | — | — | 4F-5c |
| Sudah Diisi, catat bensin, tidak jadi isi bensin | — | ya | ya | — | — | 4F-5c |
| batalkan catatan bensin sendiri (sebelum barisnya diperiksa) | — | ya | ya | — | — | 4F-5c |
| batalkan catatan bensin siapa pun | — | — | — | — | — | 4F-5c |
| lihat Laporan Logistik, unduh Excel | ya, tanpa bensin | ya | ya | — | — | 4F-5c |

**Batas keras 4F-1:** mengubah surat jalan sesudah truk berangkat hanya
Pemilik dan GM (LOG-11) dan tidak bisa diberikan lewat Hak Akses Jabatan;
nominal surat jalan bersumber kasir tidak bisa diketik siapa pun; tidak ada
yang menyetujui titik toko yang dipasangnya sendiri, kecuali Kepala Gudang
dan pemilik yang memasang langsung. HR tidak punya menu Logistik (LOG-84).

**Batas keras 4F-2:** driver dan kenek tidak pernah mengubah baris trip,
kunjungan, atau awak langsung; semua lewat pintu server (LOG-24). Ritase
hanya dicatat server; ritase tangan, batal ritase, dan mematikan pagar hanya
Pemilik dan GM (LOG-36, DRV-15) dan tidak bisa diberikan lewat Hak Akses
Jabatan. Tidak ada yang menutup trip yang ia awaki sendiri atas nama driver.
Lapor garasi di luar titik Gudang ditolak server selama pagar menyala.

**Batas keras 4F-3:** mengubah nota laporan muat sesudah paket diambil atau
perjalanan berangkat hanya Pemilik dan GM (sejalan LOG-11) dan tidak bisa
diberikan lewat Hak Akses Jabatan; nominal nota, ongkir, dan pengantar
bersumber kasir tidak bisa diketik siapa pun; isian ongkir yang diketik
tidak pernah melahirkan bonus; Foto 1 hanya oleh pengantar yang ditunjuk;
staf cabang hanya mengelola laporan cabangnya sendiri; tidak ada yang
menutup perjalanan yang ia PJ-kan sendiri.

**Batas keras 4F-4a:** menyetujui potong nota tidak bisa diberikan lewat
Hak Akses Jabatan kepada HR atau Marketing (LOG-52, 84: yang menagih bukan
yang mengesahkan); tidak ada yang memutuskan potongan yang ia catat
sendiri; bagian uang per nota hanya ditulis fungsi bagi uang kunjungan,
tidak ada layar atau jabatan yang mengetiknya; Transfer dan Campuran tanpa
foto bukti ditolak server di semua jalan masuk; pembayaran yang sudah
diperiksa finance atau tercatat di kasir tidak bisa diubah siapa pun lewat
layar ini; awak tidak menerima barang kembali yang ia serahkan sendiri.

**Batas keras 4F-4b:** mengesahkan nilai retur tidak bisa diberikan lewat
Hak Akses Jabatan kepada HR atau Marketing (sejalan LOG-52, 84); driver
dan kenek tidak menandai retur (LOG-58), tombol "Toko mau retur" hanya
memberi tahu; tidak ada yang meninjau "Tidak sesuai" atas barang yang ia
serahkan atau terima sendiri; Perlu keputusan tidak bisa ditutup manual,
hanya diputuskan; membuka lagi keputusan Batal hanya Pemilik dan GM; Kirim
Besok, Gagal, dan Coba lagi hanya oleh awak pemegang kunjungan atau PJ,
lewat pintu server.

**Batas keras 4F-5a:** memeriksa uang dan menerima uang tunai trip tidak
bisa diberikan lewat Hak Akses Jabatan kepada Marketing atau HR (LOG-84:
yang menagih bukan yang mengesahkan uangnya); tidak ada yang memeriksa
pembayaran yang terakhir ia ubah, dan tidak ada pembawa yang menerima uang
yang ia bawa sendiri (KEU-120); bagian uang dan baris Kas Masuk hanya
ditulis server, tidak ada layar yang mengetiknya; membatalkan pemeriksaan
orang lain hanya Pemilik dan GM; tidak ada pembatalan sesudah nota tercatat
di kasir.

**Batas keras 4F-5b:** menandai tercatat di kasir dan koreksi nota tidak
bisa diberikan lewat Hak Akses Jabatan kepada Marketing atau HR (LOG-84:
yang menagih bukan yang mengesahkan uangnya); baris Catat di Kasir hanya
ditulis server dan pintu tulis Keuangan; nota terkunci hanya berubah lewat
koreksi; membatalkan tanda orang lain hanya Pemilik dan GM; Daftar Tagih
tidak punya tombol yang mengubah angka piutang.

**Batas keras 4F-5c:** Dashboard dan Laporan Logistik tidak punya tombol
yang mengubah data (LOG-82); HR tidak membuka Dashboard, Bensin, dan
Laporan (LOG-84); mencatat bensin tidak bisa diberikan lewat Hak Akses
Jabatan kepada driver, kenek, atau HR; baris Buku Kas bensin hanya lahir
dari catatan bensin lewat pintu tulis Keuangan; tidak ada yang memeriksa
baris bensin yang ia catat sendiri (KEU-120); peninjau kiriman di luar
titik bukan awak atau PJ perjalanan itu.

---

## 6. Mesin otomatis

Semua punya penjaga (PRI-33): tiap jalan tercatat; gagal atau tidak jalan di
jadwalnya muncul di "perlu perhatian" GM; terlewat dikejar tanpa dobel.

| Mesin | Jadwal (pengaturan, PRI-32) | Kerjanya | Bagian |
|---|---|---|---|
| Pembuat surat jalan dari kasir | Setiap tarikan transaksi (tiap 1 menit, PRI-39) | Untuk transaksi cabang Gudang ke pelanggan yang dipasangkan ke toko: membuat surat jalan Menunggu dijadwalkan, atau mencocokkan surat jalan manual bernomor sama. Perubahan dan pembatalan di kasir ditangani menurut tabel "Mengubah dan membatalkan". Kunci nomor struk + cabang mencegah dobel | 4F-1 |
| Penyalin toko dari kasir | Setiap tarikan pelanggan (tiap 1 menit) | Pelanggan baru yang belum dipasangkan masuk TDK-L04 tab Toko; yang sudah dipasangkan memperbarui nama tampil dan tanda "nonaktif di kasir" | 4F-1 |
| Pemeriksa surat jalan manual | Tiap hari 06.00, hanya sesudah sambungan transaksi menyala | Surat jalan manual yang 2 hari belum cocok masuk Perlu Diperiksa tab Tidak cocok (PRI-41 butir 3) | 4F-1 |
| Penanda trip belum ditutup | Tiap hari 12.00 | Trip Berjalan atau Menuju Garasi yang tanggal trip-nya sebelum hari ini ditandai untuk Kepala Gudang dan pemilik (LOG-31) | 4F-2 |
| Penanda rencana menggantung | Tiap hari 00.05 | Rencana Draft atau Siap Kirim yang dibuat sebelum kemarin dan belum Berangkat ditandai di Dashboard | 4F-2 |
| Penyala pagar | Tiap 5 menit | Pagar yang batas waktunya lewat dinyalakan lagi; peringatan di Dashboard hilang | 4F-2 |
| Penulis bonus ongkir | Setiap tarikan transaksi kasir (tiap 1 menit, PRI-39) atau unggah file | Untuk tiap baris ongkir yang bukan gratis ongkir dan pengantarnya sudah dipasangkan: memanggil pintu tulis Buku Bonus. Pengantar baru dipasangkan: menulis baris yang tertunda dengan tanggal nota. Perubahan dan batal di kasir diteruskan ke pintu tulis (aturan "Perubahan dari kasir" spec Gaji). Kunci asal mencegah dobel | 4F-3 |
| Pemasang tanda ⚠ ongkir | Tiap hari 00.05; juga saat Foto 3 atau Tutup perjalanan | Nota berongkir yang dipakai laporan muat jalur antar sendiri dan perjalanannya belum Foto 3 sampai 23.59 hari berikutnya sesudah tanggal nota: tanda ⚠ dipasang lewat pintu tulis; Foto 3 yang menyusul mencabutnya | 4F-3 |
| Penanda laporan muat | Tiap 15 menit | Memperbarui warna menunggu (6 dan 24 jam) dan tanda "segera Tandai Selesai"; menyalakan pemberitahuan merah sekali | 4F-3 |
| Penanda perjalanan belum kembali | Tiap hari 23.59 | Perjalanan Berjalan ditandai di Dashboard dan Beranda Kepala Toko | 4F-3 |
| Pencocok nota cabang | Tiap tarikan transaksi; pemeriksaan 2 hari tiap 06.00 | Sama dengan Pembuat surat jalan dari kasir dan Pemeriksa surat jalan manual, untuk nota cabang yang diketik | 4F-3 |
| Penanda barang kembali | Tiap hari 06.00 | Barang Diserahkan yang belum Diterima lebih dari 3 hari ditandai di Dashboard (4F-5) dan Beranda cabang pemilik (LOG-80); potong nota Menunggu lebih dari 3 hari ditandai untuk Finance | 4F-4a |
| Penanda tertunda | Tiap hari 06.00 | Tertunda lebih dari 3 hari sejak tanggal pertama ditandai merah (LOG-57); Perlu keputusan lebih dari 3 hari menyalakan pengingat berantai ke pemutusnya; memperbarui angka penanda menu | 4F-4b |
| Penanda retur | Tiap hari 06.00 | Retur Menunggu ditugaskan lebih dari 3 hari, Menunggu nilai lebih dari 3 hari, dan barang Tidak sesuai yang belum ditinjau lebih dari 3 hari ditandai di Dashboard (4F-5) dan Antrean pemutusnya | 4F-4b |
| Pencocok pembatalan kasir | Setiap tarikan transaksi (tiap 1 menit, PRI-39) | Pembatalan penjualan di kasir untuk nota yang kirimannya sudah Batal karena Gagal: dicocokkan, baris "Batalkan penjualan di kasir" ditandai tercatat; tidak masuk Perlu Diperiksa (LOG-123). Kunci nomor nota + cabang kasir mencegah dobel | 4F-4b |
| Penanda uang belum diperiksa | Tiap hari 06.00 | Bagian uang selain tempo yang lebih dari 3 hari sejak Kirim belum diperiksa ditandai untuk Pemilik dan GM dan di Dashboard (LOG-62); memperbarui angka penanda menu Finance | 4F-5a |
| Penanda uang tunai belum diserahkan | Tiap hari 12.00 dan 23.59 | Trip yang uang tunainya belum diterima sampai 12.00 hari berikutnya ditandai untuk Kepala Gudang, Finance, Pemilik, GM; perjalanan antar sendiri yang uangnya belum diterima sampai 23.59 hari itu ditandai untuk Kepala Toko cabang asal | 4F-5a |
| Pengikut setoran kasir | Saat Finance menerima setoran Laporan Kasir (4H) | Bagian tunai antar sendiri di setoran yang diterima Cocok ikut Cocok dan menulis Kas Masuk ke Laci cabang asal; setoran Tidak cocok membiarkannya menunggu | 4F-5a |
| Penanda Catat di Kasir | Tiap hari 06.00 | Baris Menunggu dicatat lebih dari 2 hari sejak siap ditandai untuk Finance, Pemilik, dan GM, dan di Dashboard (4F-5c); memperbarui angka penanda menu Finance | 4F-5b |
| Pencocok piutang kasir | Setiap tarikan piutang (tiap 1 jam, PRI-39) atau unggah file piutang | Nota yang ringkasannya tercatat lebih dari 1 hari dan sisanya di kasir lebih besar daripada sisa menurut HRIS masuk Perlu Diperiksa Finance (TDK-L06 tab Piutang); yang sudah sama ditutup sendiri. Kunci nota + tarikan mencegah dobel | 4F-5b |
| Penanda janji tagih | Tiap hari 06.00 | Janji bayar sisa dan janji catatan tagih yang lewat dan masih bersisa di kasir ditandai merah dan dikirim ke Beranda Marketing; sebelum sambungan piutang menyala, file piutang yang lebih tua dari 7 hari memberi pengingat ke Finance | 4F-5b |
| Penanda permintaan bensin | Tiap hari 12.00 | Permintaan Menunggu yang lahir sebelum hari ini ditandai merah, masuk Antrean Kepala Gudang dan Finance, dan memperbarui angka penanda menu Bensin | 4F-5c |
| Penanda kirim di luar titik | Tiap hari 06.00 | Catatan bertanda di luar titik toko yang belum ditinjau lebih dari 3 hari masuk Antrean Kepala Gudang | 4F-5c |

Fungsi **bagi uang kunjungan** (LOG-112) bukan mesin berjadwal: ia
dipanggil oleh langkah yang mengubah angka, di dalam transaksi yang sama.
Begitu juga **penulis Catat di Kasir** (4F-5b): ia dipanggil setiap kali
sumbernya berubah (pemeriksaan dan pembatalannya, keputusan potong nota,
nilai retur, keputusan Batal, trip Selesai, Foto 3, koreksi), memeriksa
apakah nota siap, lalu menulis, mengganti, atau membatalkan barisnya;
kunci sumber + jenis mencegah dobel.

**Dashboard Logistik bukan mesin** (4F-5c): ia tidak menulis tanda sendiri,
hanya membaca tanda yang dipasang mesin di atas saat dibuka dan tiap 1
menit. Unduhan Excel yang besar dikerjakan server di belakang saat diminta;
bila gagal, pengunduh diberi tahu dan kegagalannya tercatat (PRI-33).

---

## 7. Pemberitahuan (titipan 4J)

| Pemberitahuan | Kepada | Antrean, Beranda, atau layar | Alasan |
|---|---|---|---|
| Titik toko menunggu persetujuan | Kepala Gudang | Angka penanda di LOG-L01 dan baris Dashboard (4F-5); Antrean bila lebih dari 2 hari | LOG-80 |
| Titik Anda disetujui / ditolak (alasan) | Pemasang | Beranda | Supaya tahu harus memasang lagi |
| Laporan titik salah | Kepala Gudang | Antrean | Driver tersesat bila dibiarkan |
| Toko ditambah cabang, belum diperiksa | Marketing, Kepala Gudang | Angka penanda di LOG-L01 | F2 |
| Surat jalan diubah sesudah berangkat | Kepala Gudang, Finance | Beranda | Uang kunjungan dibagi ulang |
| Toko digabung / gabung dibatalkan | Marketing, Kepala Gudang, Pemilik dan GM lain | Beranda | Riwayat uang toko berpindah |
| Surat jalan dari kasir berubah atau batal sesudah dijadwalkan | Kepala Gudang | Perlu Diperiksa (TDK-L06) | PRI-41 |
| Mobil atau rute belum punya tarif | Kepala Gudang, Pemilik, GM | Perlu perhatian | Rencana tidak bisa Siap Kirim |
| Trip Siap Kirim untuk Anda | Driver, kenek di trip itu | Beranda | Supaya tahu tanpa bertanya |
| Awak trip Anda diganti / Anda ditambahkan ke trip | Orang itu | Antrean | Absen dan ritase ikut berubah |
| Kunjungan dilepas kantor / tugas ditambah sesudah berangkat | Awak trip | Antrean | Supaya tidak mengantar yang sudah dilepas |
| Trip belum ditutup (12.00 hari berikutnya) | Kepala Gudang, Pemilik, GM | Antrean (pengingat berantai) | LOG-31 |
| Trip ditutup kantor; Laporan Pulang menunggu | Driver | Antrean | KEH-101 |
| Kirim di luar titik toko | Kepala Gudang | Dashboard (4F-5) | R1 |
| Ritase tangan dicatat / ritase dibatalkan | Pemilik dan GM lain; orangnya | Beranda | KAR-73; upah orangnya berubah |
| Pagar titik Gudang dimatikan | Pemilik dan GM | Dashboard selama mati | LOG-32 |
| Laporan muat segera Tandai Selesai (tokonya sudah di trip) | Staf cabang asal | Beranda | LOG-40 |
| Paket atau kiriman menunggu merah (24 jam) | Staf cabang asal, Kepala Gudang | Beranda; Dashboard (4F-5) | LOG-40 |
| Ada paket menunggu dijemput | Driver, kenek trip Siap Kirim atau Berjalan | Kotak di Trip Saya | LOG-25 |
| Paket tidak lengkap saat dijemput | Staf cabang asal | Antrean | M2 |
| Tugas antar untuk Anda (Tandai Selesai jalur antar sendiri, atau PJ dialihkan ke Anda) | Pengantar | Antrean | LOG-42 |
| Pengantar beda dengan kasir | Staf cabang asal, Kepala Toko | Tanda di LOG-L25; Beranda | M4 |
| Perjalanan belum kembali sampai 23.59 / ditutup kantor | Kepala Toko; PJ | Beranda; Dashboard (4F-5) | M6 |
| Nota laporan muat diubah sesudah berangkat | Kepala Gudang, Finance, staf cabang asal | Beranda | Uang dibagi ulang |
| Nota cabang dari kasir berubah atau batal sesudah berangkat | Kepala Toko cabang asal, Kepala Gudang | Perlu Diperiksa (TDK-L06) | PRI-41 |
| Potong nota menunggu keputusan | Finance | Angka penanda di LOG-L42; Antrean bila lebih dari 3 hari | LOG-52 |
| Potong nota Anda disetujui / ditolak (alasan) | Pencatat; Kepala Gudang (truk) atau Kepala Toko cabang asal (antar sendiri) | Beranda | Supaya tahu tagihan berubah |
| Barang kembali untuk cabang Anda (Diserahkan) | Staf cabang pemilik; Kepala Gudang untuk barang Gudang | Antrean | LOG-54 |
| Barang kembali belum diterima lebih dari 3 hari | Kepala Toko cabang pemilik, Kepala Gudang | Beranda; Dashboard (4F-5) | LOG-80 |
| Barang dibeli toko: koreksi stok / perlu nota di kasir | Kepala Toko cabang pemilik; Kepala Gudang untuk barang Gudang | Antrean | K6 |
| Pembayaran diubah kantor sesudah trip Selesai atau sesudah Foto 3 | Finance | Beranda | Angka yang akan diperiksa berubah |
| Kiriman Kirim Besok | Marketing (surat jalan); staf cabang asal (laporan muat) | Beranda | Supaya bisa menghubungi toko |
| Kiriman Gagal, perlu keputusan | Kepala Gudang (surat jalan); staf cabang asal dan Kepala Toko (laporan muat) | Antrean; pengingat berantai sesudah 3 hari | LOG-56 |
| Tertunda merah (lebih dari 3 hari) | Kepala Gudang, Pemilik, GM; staf cabang asal untuk laporan muat | Dashboard (4F-5); angka penanda LOG-L49 | LOG-57 |
| Keputusan Batal: batalkan penjualan di kasir | Finance | Daftar kiriman ke kasir (4F-5) | LOG-123 |
| Toko mau retur (dari awak) | Kepala Gudang | Antrean | Retur hanya ditandai kantor |
| Retur ditugaskan ke trip Anda | Awak trip itu | Antrean (sesudah berangkat) atau kartu trip | LOG-58 |
| Retur tidak bisa diambil / tanpa barang | Penanda retur, Kepala Gudang | Beranda | Perlu ditugaskan ulang atau ditutup |
| Retur menunggu nilai | Finance | Angka penanda LOG-L52; Antrean sesudah 3 hari | LOG-60 |
| Nilai retur disahkan | Penanda retur, Marketing | Beranda | Yang menagih tahu tagihan toko turun |
| Barang tidak sesuai menunggu tinjau | Kepala Gudang | Antrean | LOG-61 |
| Hasil tinjau; diteruskan sebagai kehilangan barang | Penyerah dan penerima; HR bila diteruskan | Beranda; Antrean HR | T7 |
| Uang pengiriman menunggu diperiksa | Finance | Angka penanda LOG-L58 | LOG-62 |
| Uang belum diperiksa lebih dari 3 hari | Pemilik, GM | Perlu perhatian; Dashboard (4F-5c) | LOG-62 |
| Uang tunai trip belum diserahkan sampai 12.00 hari berikutnya | Awak trip; Kepala Gudang, Finance, Pemilik, GM | Antrean awak; Beranda; Dashboard (4F-5c) | V1 |
| Uang tunai antar sendiri menunggu diterima | Karyawan cabang asal yang bertugas (bukan PJ), Kepala Toko | Antrean | V2 |
| Uang Anda sudah diterima (jumlah, penerima) | Pembawa | Beranda | Supaya pembawa punya bukti serah |
| Tidak Cocok atau deposit Belum masuk: tagihan toko bertambah | Marketing; Kepala Gudang (truk) atau Kepala Toko cabang asal (antar sendiri) | Beranda | Yang menagih tahu |
| Kurang serah atas nama Anda | Pembawa; HR (bahan Potongan Lain); Pemilik, GM | Beranda; Antrean HR; Perlu perhatian | V3 |
| Pemeriksaan dibatalkan | Pemeriksa asal; Pemilik dan GM lain | Beranda | Kas Masuk berubah |
| Baris baru di Catat di Kasir | Finance | Angka penanda LOG-L64 | LOG-65 |
| Catat di Kasir menunggu lebih dari 2 hari | Finance, Pemilik, GM | Antrean Finance; Perlu perhatian; Dashboard (4F-5c) | D1 |
| Baris berubah sejak tampil | Finance | Tanda di LOG-L64 | Supaya yang diketik di kasir angka terbaru |
| Koreksi nota | Pemilik, GM (bila oleh Finance); Finance dan pemilik lain (bila oleh Pemilik atau GM); Marketing | Beranda; Perlu perhatian bila uang masuk berkurang | D3 |
| Tanda tercatat dibatalkan | Penanda; Pemilik, GM | Beranda | Kunci nota terbuka lagi |
| Kasir menagih lebih dari seharusnya | Finance | Perlu Diperiksa (TDK-L06 tab Piutang) | D4 |
| Janji bayar lewat, masih bersisa | Marketing | Beranda; merah di LOG-L68 | D6 |
| Sengketa tagihan | Finance | Antrean | D6 |
| Marketing minta ditagih | Awak trip atau PJ yang ke toko itu | Kotak di LOG-L18 dan LOG-L33 | D6 |
| File piutang lebih tua dari 7 hari | Finance | Antrean; peringatan di LOG-L68 | D5 |
| Permintaan bensin baru | Kepala Gudang, Finance | Angka penanda menu Bensin; Dashboard | LOG-83 |
| Permintaan bensin belum ditutup sampai 12.00 hari berikutnya | Kepala Gudang, Finance | Antrean; merah di Dashboard | B4 |
| Permintaan bensin tidak jadi | Driver peminta | Beranda | Supaya tahu mobilnya tidak diisi |
| Catatan bensin tanpa struk | Pemilik, GM | Perlu perhatian | B6 |
| Catatan bensin dibatalkan | Pencatat; Finance; Pemilik, GM | Beranda | Buku Kas berubah |
| Bensin "dibayar orang lain" menunggu dipasangkan | Finance | Antrean (Keuangan 4H) | KEU-18 |
| Kirim di luar titik belum ditinjau lebih dari 3 hari | Kepala Gudang | Antrean | B2 |
| Kirim di luar titik Tidak wajar | Pemilik, GM; awak atau PJ itu | Perlu perhatian; Beranda | B2 |
| Unduhan Laporan Logistik siap atau gagal | Pengunduh | Beranda | PRI-12, 33 |

---

## 8. Pengaturan (titipan 4J)

Semua melalui kerangka Pengaturan 4B (BER-L40, L41), bertanggal berlaku bila
menyangkut uang (WAJ-07). Pengubah: Pemilik dan GM; Kepala Gudang
mengusulkan.

| Pengaturan | Angka awal | Wajib diumumkan | Boleh dikecualikan per orang (PRI-26) | Rumus di |
|---|---|---|---|---|
| Panjang nama dan alamat toko paling sedikit | 3 dan 5 huruf | tidak | tidak | 4F-1 |
| Akurasi GPS paling buruk untuk pasang titik toko | 50 meter | tidak | tidak | 4F-1 |
| Radius titik toko | sama dengan titik cabang (100 meter, KEH-12; dibaca, tidak disimpan dua kali) | tidak | tidak | 4F-1, 4F-2 |
| Batas membatalkan gabung toko | 30 hari | tidak | tidak | 4F-1 |
| Batas membuka lagi "Diambil toko" | 7 hari | tidak | tidak | 4F-1 |
| Titik menunggu masuk Antrean | sesudah 2 hari | tidak | tidak | 4F-1 |
| Jadwal mesin Pemeriksa surat jalan manual | 06.00 | tidak | tidak | 4F-1 |
| Batas trip belum ditutup (LOG-31) | 12.00 hari berikutnya | tidak | tidak | 4F-2 |
| Kunci tombol trip (LOG-26) | 1 detik | tidak | tidak | 4F-2 |
| Radius titik Gudang untuk lapor garasi | sama dengan titik cabang (100 meter, dibaca) | tidak | tidak | 4F-2 |
| Batas pagar boleh dimatikan | 24 jam | tidak | tidak | 4F-2 |
| Ritase tangan paling jauh ke belakang | 14 hari | tidak | tidak | 4F-2 |
| Jadwal mesin Penanda trip belum ditutup, Penanda rencana menggantung, Penyala pagar | 12.00; 00.05; tiap 5 menit | tidak | tidak | 4F-2 |
| Warna paket dan kiriman menunggu (LOG-40) | oranye 6 jam, merah 24 jam | tidak | tidak | 4F-3 |
| Umur foto galeri yang ditolak (laporan muat, ambil paket, antar sendiri; LOG-43) | lebih dari 2 menit | tidak | tidak | 4F-3 |
| Antar sendiri: lama tiap tahap paling sedikit | 2 menit | tidak | tidak | 4F-3 |
| Antar sendiri: selisih berangkat dan kembali yang wajib alasan | 20 menit | tidak | tidak | 4F-3 |
| Nota kasir yang bisa dipilih saat Tandai Selesai | 7 hari terakhir | tidak | tidak | 4F-3 |
| Batas tanda ⚠ foto antar tidak lengkap | 23.59 hari berikutnya sesudah tanggal nota | ya (menyangkut bonus) | tidak | 4F-3 |
| Batas perjalanan belum kembali | 23.59 hari itu | tidak | tidak | 4F-3 |
| Jadwal mesin Pemasang tanda ⚠, Penanda laporan muat, Penanda perjalanan | 00.05; tiap 15 menit; 23.59 | tidak | tidak | 4F-3 |
| Tempo dan janji bayar sisa paling lama | 60 hari | ya (menyangkut uang toko) | tidak | 4F-4a |
| Bawaan tanggal janji bayar sisa | 7 hari | tidak | tidak | 4F-4a |
| Batas barang kembali belum diterima (LOG-80, 88) | 3 hari | tidak | tidak | 4F-4a |
| Batas potong nota menunggu masuk Antrean | 3 hari | tidak | tidak | 4F-4a |
| Jadwal mesin Penanda barang kembali | 06.00 | tidak | tidak | 4F-4a |
| Batas tertunda merah (LOG-57, 88) | lebih dari 3 hari | tidak | tidak | 4F-4b |
| Pengingat berantai Perlu keputusan mulai | 3 hari | tidak | tidak | 4F-4b |
| Batas membuka lagi keputusan Batal | 7 hari | tidak | tidak | 4F-4b |
| Batas retur menunggu ditugaskan, menunggu nilai, dan tidak sesuai belum ditinjau | 3 hari | tidak | tidak | 4F-4b |
| Nota kasir yang tampil sebagai patokan nilai retur | 60 hari terakhir | tidak | tidak | 4F-4b |
| Jadwal mesin Penanda tertunda dan Penanda retur | 06.00 | tidak | tidak | 4F-4b |
| Batas pemeriksaan uang (LOG-62, 88) | 3 hari sejak Kirim | tidak | tidak | 4F-5a |
| Batas serah uang tunai trip | 12.00 hari berikutnya | tidak | tidak | 4F-5a |
| Batas uang tunai antar sendiri diterima di cabang | 23.59 hari itu | tidak | tidak | 4F-5a |
| Bawaan janji bayar sisa sesudah Tidak Cocok atau deposit Belum masuk | 7 hari dari hari pemeriksaan | tidak | tidak | 4F-5a |
| Batas Finance membatalkan pemeriksaannya sendiri | 7 hari | tidak | tidak | 4F-5a |
| Tanggal masuk rekening deposit boleh mundur | 7 hari (KEU-12, dibaca) | tidak | tidak | 4F-5a |
| Jadwal mesin Penanda uang belum diperiksa, Penanda uang tunai belum diserahkan | 06.00; 12.00 dan 23.59 | tidak | tidak | 4F-5a |
| Batas Catat di Kasir menunggu | 2 hari sejak siap | tidak | tidak | 4F-5b |
| Batas penanda membatalkan tanda tercatat | 24 jam | tidak | tidak | 4F-5b |
| Tenggang pencocokan piutang | 1 hari sesudah tercatat | tidak | tidak | 4F-5b |
| Warna oranye Daftar Tagih | jatuh tempo dalam 3 hari | tidak | tidak | 4F-5b |
| Umur file piutang yang diperingatkan | lebih dari 7 hari | tidak | tidak | 4F-5b |
| Jadwal mesin Penanda Catat di Kasir dan Penanda janji tagih | 06.00 | tidak | tidak | 4F-5b |
| Muat ulang otomatis Dashboard | tiap 1 menit | tidak | tidak | 4F-5c |
| Baris terlama yang diambil per baris Dashboard | 5 | tidak | tidak | 4F-5c |
| Batas permintaan bensin merah | 12.00 hari berikutnya | tidak | tidak | 4F-5c |
| Tanggal isi bensin boleh mundur | 7 hari (KEU-12, dibaca) | tidak | tidak | 4F-5c |
| Kirim di luar titik masuk Antrean | sesudah 3 hari belum ditinjau | tidak | tidak | 4F-5c |
| Riwayat di luar titik yang ditampilkan saat tinjau | 30 hari | tidak | tidak | 4F-5c |
| Rentang tanggal bebas Laporan Logistik paling panjang | 3 bulan | tidak | tidak | 4F-5c |
| Jadwal mesin Penanda permintaan bensin dan Penanda kirim di luar titik | 12.00; 06.00 | tidak | tidak | 4F-5c |

---

## 9. Jenis pengajuan (titipan 4J)

**4F-1 tidak menambah jenis pengajuan.** Titik toko adalah usulan khas
Logistik yang diputuskan di LOG-L06, bukan lewat Mesin Pengajuan, karena
bukan permintaan untuk diri sendiri dan tidak punya batas waktu yang
membuatnya Hangus (sejalan tinjau absen luar titik di Kehadiran). Toko yang
ditambah cabang juga bukan pengajuan; ia langsung bisa dipakai dan hanya
bertanda "belum diperiksa".

**4F-2 tidak menambah jenis pengajuan.** Rencana, ganti awak, tutup trip, dan
ritase tangan adalah tindakan langsung kantor yang beralasan dan tercatat.
Driver yang tidak bisa jalan cukup lapor ke Kepala Gudang (LOG-15, DRV-18).

**4F-3 tidak menambah jenis pengajuan.** Laporan muat, alihkan PJ, dan tutup
perjalanan adalah tindakan langsung yang beralasan dan tercatat. Paket tidak
lengkap adalah pemberitahuan ke cabang, bukan permintaan yang diputuskan.

**4F-4a tidak menambah jenis pengajuan.** Potong nota memang diputuskan
orang lain, tetapi ia bukan permintaan untuk diri sendiri dan tidak punya
batas waktu yang membuatnya Hangus (sebelum diputuskan ia dihitung kurang
bayar, LOG-52); karena itu ia diputuskan di LOG-L42, sama seperti titik
toko di 4F-1. Penerimaan barang kembali adalah konfirmasi, bukan
permintaan.

**4F-4b tidak menambah jenis pengajuan.** Kiriman Gagal diputuskan orang
lain, tetapi bukan permintaan untuk diri sendiri dan tidak pernah Hangus
(ia menunggu sampai diputuskan, dengan pengingat berantai), sehingga
diputuskan di LOG-L50. Tandai retur adalah tugas kantor; nilai retur dan
tinjau barang adalah pemeriksaan, bukan persetujuan atas permintaan.

**4F-5a tidak menambah jenis pengajuan.** Pemeriksaan uang dan serah tunai
adalah pemeriksaan atas angka, bukan permintaan untuk diri sendiri, dan
tidak pernah Hangus (yang lewat batas hanya ditandai, LOG-62). Kurang serah
diteruskan ke HR sebagai bahan; pengajuan Potongan Lain dibuat HR di Gaji.

**4F-5b tidak menambah jenis pengajuan.** Menandai tercatat dan koreksi
adalah tindakan langsung Finance yang beralasan dan tercatat; catatan tagih
hanya catatan; beda piutang diputuskan di Perlu Diperiksa (PRI-41), bukan
lewat Mesin Pengajuan.

**4F-5c tidak menambah jenis pengajuan.** Permintaan bensin adalah
permintaan untuk mobil, bukan untuk diri sendiri, dan tidak pernah Hangus
(ia menunggu ditutup, dengan tanda merah); catatan bensin dan tinjau di
luar titik adalah tindakan langsung yang beralasan dan tercatat.

---

## 10. Kejadian di lapangan

| No | Kejadian | Sistem berbuat apa | Aturan |
|---|---|---|---|
| 1 | Marketing mengetik "Toko Sumber  Rejeki." padahal "Toko Sumber Rejeki" sudah ada (nonaktif) | Ditolak; ditawari mengaktifkan yang lama | LOG-03 |
| 2 | Toko yang sama terlanjur ada dua dengan nama berbeda ("TB Maju" dan "Toko Maju") | Kepala Gudang menggabung; surat jalan dan riwayat pindah ke toko tetap | LOG-04, F6 |
| 3 | Gabung salah toko, ketahuan 3 hari kemudian | Pemilik membatalkan gabung; catatan yang dipindah kembali, toko asal aktif lagi | F6 |
| 4 | Driver pertama kali ke Toko Maju | Memasang titik dengan foto depan toko; Kepala Gudang menyetujui sore harinya | LOG-05 |
| 5 | Driver memasang titik dari dalam gudang karena lupa | Kepala Gudang melihat titik berjarak 12 km dari alamat; ditolak dengan alasan; kunjungan berikutnya dipasang lagi | F3 |
| 6 | Titik toko lama ternyata salah gang | Driver menekan Laporkan titik salah; titik lama tetap dipakai sampai Kepala Gudang memutuskan | F3 |
| 7 | Pengantar cabang Raja mengantar ke toko yang belum punya titik | Memasang titik di Foto 2; masuk persetujuan Kepala Gudang | F3 |
| 8 | GPS di dalam toko melenceng 120 meter | Tombol Simpan mati: "Keluar dari bangunan dan coba lagi" | F3 |
| 9 | Sebelum sambungan menyala, Marketing mencatat surat jalan struk 0451 | Tersimpan bersumber diketik; nomor wajib | LOG-08, PRI-41 |
| 10 | Struk 0451 dicatat dua kali oleh dua orang | Yang kedua ditolak dengan menyebut pencatat pertama | PRI-41 |
| 11 | Sambungan menyala; transaksi 0451 tertarik dengan nominal sama | Surat jalan manual bertanda "cocok dengan kasir"; tidak ada baris baru | F4 |
| 12 | Nominal kasir 0451 Rp2.400.000, manual Rp2.350.000, belum berangkat | Nominal kasir dipakai; perubahan tercatat "dari kasir" | F4, F5 |
| 13 | Sama, tetapi truk sudah berangkat | Masuk Perlu Diperiksa Kepala Gudang: Terima perubahan atau Biarkan | F5, PRI-41 |
| 14 | Sesudah menyala, Gudang menjual ke Toko Baru yang belum ada di HRIS | Pelanggan baru masuk TDK-L04; sesudah Finance memasangkan ke toko (atau membuat toko dari pelanggan itu), surat jalan lahir dengan tanggal transaksinya | F2, F4 |
| 15 | Gudang menjual ke cabang Raja lewat kasir | Tidak menjadi surat jalan; urusan Keuangan (KEU-69) | F4 |
| 16 | Toko Maju datang sendiri mengambil barang | Kepala Gudang menandai Diambil toko; tidak masuk antrean kiriman | F4 |
| 17 | Salah tandai Diambil toko | Dibuka lagi menjadi Menunggu dijadwalkan dalam 7 hari | F4 |
| 18 | Penjualan 0460 dibatalkan di kasir sebelum dijadwalkan | Surat jalan ikut Batal bertanda "batal di kasir" | F5 |
| 19 | Penjualan 0461 dibatalkan di kasir saat truk sudah jalan | Perlu Diperiksa Kepala Gudang; driver diberi tahu lewat trip (4F-2) | F5 |
| 20 | Marketing ingin membatalkan surat jalan bersumber kasir karena toko batal pesan | Tidak bisa di HRIS; pesannya "Batalkan penjualannya di kasir" | F5 |
| 21 | Salah ketik nominal surat jalan manual setelah truk berangkat | Hanya pemilik mengubah, alasan wajib; uang kunjungan dibagi ulang | LOG-11 |
| 22 | Kepala Gudang ingin menonaktifkan rute yang dipakai rencana Siap Kirim | Ditolak, menyebut rencananya | LOG-94, KAR-27 |
| 23 | Rute "Belanja Pasar" terlanjur dibuat berjenis antar dan sudah dipakai trip | Jenis tidak bisa diubah; rute dinonaktifkan dan dibuat baru | LOG-17 |
| 24 | Pasangan mobil L300 dan rute Selatan belum punya tarif | Tanda "belum ada tarif" di LOG-L07 dan perlu perhatian | LOG-21 |
| 25 | Toko masih punya surat jalan Dalam perjalanan, Marketing mau menonaktifkan | Ditolak, menyebut surat jalannya | LOG-04 |
| 26 | Staf cabang Raja menambah toko dari laporan muat sebelum sambungan menyala | Toko langsung bisa dipakai, bertanda "ditambah cabang, belum diperiksa" | F2 |
| 27 | Kepala Gudang menyusun rencana pukul 21.00, truk berangkat 07.30 besoknya | Tanggal trip = tanggal besok (jam Berangkat) | LOG-16, 25 |
| 28 | Rencana Siap Kirim ternyata tidak jadi jalan dua hari | Ditandai di Dashboard; Kepala Gudang membatalkan; semua surat jalan kembali Menunggu | LOG-23 |
| 29 | Kepala Gudang memilih mobil L300 yang masih Berjalan di trip lain | Siap Kirim ditolak: "L300 masih di trip 12, belum lapor garasi" | R2 |
| 30 | Driver Dedi dipilih di dua rencana sekaligus | Boleh di Draft; yang kedua tidak bisa Berangkat selama trip pertama belum Selesai | R2 |
| 31 | Kenek Eko menekan Berangkat karena handphone Dedi lowbat | Boleh; satu foto awak; absen masuk Dedi dan Eko tercatat | LOG-25, KEH-97 |
| 32 | Ada laporan muat ke Toko Sinar yang belum Tandai Selesai saat Berangkat | Peringatan, tetap boleh berangkat | LOG-25 |
| 33 | Dedi dan Eko membuka kunjungan Toko Maju bersamaan | Yang pertama memegang; yang kedua melihat "sedang diproses Dedi" | LOG-26 |
| 34 | Dedi menekan Kirim 300 meter dari titik Toko Maju (GPS melenceng) | Tersimpan; bertanda "di luar titik toko" untuk ditinjau Kepala Gudang | R1 |
| 35 | Tugas belanja ke supplier pakan | Pilih supplier, foto nota; tanpa nominal; upah belanja tercatat saat trip selesai | R4, LOG-34 |
| 36 | Supplier baru belum ada di daftar | Driver menambah bertanda "belum diperiksa"; Finance memeriksanya | DRV-41, KEU-57 |
| 37 | Jam 15.00 masih ada 5 toko, waktu habis | Selesai lebih awal dengan alasan dan foto; 5 toko Kirim Besok dan masuk tertunda | LOG-27 |
| 38 | Dedi menekan bak kosong padahal retur Toko Sinar belum diantar ke cabang Raja | Ditolak, menyebut yang kurang | LOG-28, 54 |
| 39 | Dedi lapor garasi dari warung 1,2 km sebelum Gudang | Ditolak: "Anda belum di titik Gudang (jarak 1,2 km)" | LOG-29 |
| 40 | Handphone Dedi mati sesudah foto amper, sebelum Laporan Pulang | Langkah yang tersimpan tetap; dilanjutkan dari handphone lain, atau Kepala Gudang menutup trip | LOG-29, 30 |
| 41 | Trip belum lapor garasi sampai 12.00 besoknya | Ditandai; Kepala Gudang menutup dengan alasan dan foto; ritase tercatat sekali; Laporan Pulang menyusul tanpa denda | LOG-30, 31, KEH-101 |
| 42 | Dedi sakit di tengah jalan, diganti Joko | Joko ditambahkan (absen masuk jam itu); Dedi dicopot; ritase untuk Joko; bila pantas, pemilik memberi Dedi ritase tangan | R5 |
| 43 | Kenek Eko dicopot di tengah jalan | Trip tidak berkenek saat Selesai: Dedi dibayar tarif "tanpa kenek" | R5, DRV-09 |
| 44 | Trip hanya belanja | Upah belanja saja, tanpa ritase | LOG-34 |
| 45 | Trip antar pagi lalu belanja siang, dua trip | Dua lapor garasi, dua Laporan Pulang; absen pulang di trip kedua; satu ritase (trip pagi) dan satu upah belanja (trip siang) | KEH-98, LOG-33, 34 |
| 46 | Driver tidak sempat memakai aplikasi sehari | Pemilik mencatat ritase tangan dengan alasan; server memeriksa dobel | LOG-36 |
| 47 | Pemilik mencatat ritase tangan padahal sudah ada ritase yang sama | Ditampilkan; perlu konfirmasi "Memang dua kali jalan" dan alasan | R3 |
| 48 | Pemilik ingin menguji lapor garasi dari kantor | Mematikan pagar titik Gudang 2 jam; peringatan di Dashboard; menyala lagi sendiri | LOG-32 |
| 49 | Kepala Gudang ikut sebagai kenek lalu ingin menutup trip itu | Ditolak; pemilik yang menutup | Batas keras 4F-2 |
| 50 | Kasir Raja menyiapkan 3 dus pakan untuk Toko Maju | Buat laporan muat: foto isi barang, 3 foto paket; status Proses | LOG-37 |
| 51 | Kasir lupa Tandai Selesai, padahal Toko Maju sudah ada di trip Siap Kirim | Tanda "segera Tandai Selesai" dan Beranda; saat Berangkat driver mendapat peringatan, tetap boleh berangkat | LOG-25, 40 |
| 52 | Sebelum sambungan menyala, kasir Tandai Selesai dengan struk 0112 Rp850.000, ongkir Rp15.000 | Nota cabang bersumber diketik; ongkir tercatat tanpa bonus | LOG-38, 42 |
| 53 | Sambungan sudah menyala, kasir Tandai Selesai | Memilih nota 0112 dari daftar transaksi Raja ke Toko Maju; nominal, ongkir, dan pengantar terisi dari kasir | LOG-42, M3 |
| 54 | Nota 0112 sudah dipakai laporan lain | Tidak muncul di pilihan | M3 |
| 55 | Kepala Gudang menyusun rencana dan menugaskan laporan Toko Maju | Laporan bertanda "dijadwalkan di trip 15"; driver trip lain tidak bisa mengambilnya | M1 |
| 56 | Driver trip 16 lewat Raja dan melihat paket Toko Sinar menunggu | Mengambilnya langsung ke trip-nya; Toko Sinar masuk kunjungan paling akhir | LOG-41, M1 |
| 57 | Driver hanya menemukan 2 dari 3 paket | Tidak bisa mengambil sebagian; menekan Paket tidak lengkap; cabang membetulkan lalu Tandai Selesai lagi | M2 |
| 58 | Toko Maju sudah ada di trip karena surat jalan Gudang | Paket bergabung ke kunjungan yang sama; nota kunjungan = surat jalan + nota cabang | LOG-10 |
| 59 | Trip berisi paket saja | Ritase tetap tercatat (trip membawa toko) | LOG-33 |
| 60 | Trip Siap Kirim yang sudah mengambil paket dibatalkan | Laporan kembali Menunggu dijemput bertanda "barang di Gudang" | LOG-23 |
| 61 | Toko Maju membatalkan pesanan sebelum barang dijemput | Cabang menekan Kembalikan ke Proses (alasan), lalu Batalkan | LOG-39, WAJ-11 |
| 62 | Cabang ingin mengganti jalur dari driver ke antar sendiri setelah paket diambil | Ditolak: jalur terkunci sesudah diambil | M3 |
| 63 | Salah ketik nominal nota cabang setelah paket diambil | Hanya pemilik mengubah, alasan wajib; uang dibagi ulang | M3, LOG-11 |
| 64 | Paket menunggu dijemput sejak kemarin pagi | Merah (lebih dari 24 jam); tampil di Dashboard | LOG-40 |
| 65 | Rina (pengantar di nota kasir) mengantar 2 kiriman | Foto 1 sekali untuk keduanya, Foto 2 di tiap toko, Foto 3 di Raja | LOG-43 |
| 66 | Rina belum absen masuk lalu menekan Mulai antar | Ditolak: "Absen masuk dulu" | M6 |
| 67 | Rina menekan Foto 2 satu menit setelah Foto 1 | Ditolak: tiap tahap paling sedikit 2 menit | LOG-43 |
| 68 | Berangkat 15 menit, kembali 40 menit | Selisih 25 menit: Foto 3 wajib alasan | LOG-43 |
| 69 | Rina memakai foto galeri dari kemarin | Ditolak (lebih tua dari 2 menit) | LOG-43 |
| 70 | Rina sakit, kiriman dialihkan ke Sari | Kepala Toko mengalihkan PJ dengan alasan; tanda "pengantar beda dengan kasir"; kasir membetulkan pengantar, bonus pindah ke Sari, tanda hilang | M4 |
| 71 | Nama pengantar di kasir "Rina R." belum dipasangkan | Kasir tetap bisa Tandai Selesai dengan memilih Rina di HRIS (tanda beda); bonus menunggu sampai HR memasangkan nama | M4, PRI-39 |
| 72 | Rina menekan Pulang padahal belum Foto 3 | Ditolak: "Selesaikan perjalanan antar (Foto 3) dulu" | M6 |
| 73 | Rina pulang lewat pintu belakang tanpa Foto 3 dan tanpa absen pulang | 23.59 ditandai; Kepala Toko menutup perjalanan besok; absennya dihitung lupa absen pulang (KEH-64, 151) | M6 |
| 74 | Toko tujuan antar sendiri tutup | Kirim Besok; laporan kembali Menunggu diantar | LOG-55 |
| 75 | Toko menolak barang antar sendiri | Gagal menjadi Perlu keputusan, tidak langsung batal | LOG-56 |
| 76 | Toko tujuan belum punya titik | Rina memasang titik di Foto 2; menunggu persetujuan Kepala Gudang | F3 |
| 77 | Nota 0112 ongkir Rp15.000, pengantar Rina | Bonus Rp7.500 untuk Rina lahir Disahkan bertanggal nota | LOG-76, 77 |
| 78 | Perjalanan Rina belum Foto 3 sampai 23.59 besoknya | Bonus ongkir bertanda ⚠; HR boleh membatalkan dengan alasan | M5 |
| 79 | Rina Foto 3 lusa (terlambat) | Tanda ⚠ dicabut sendiri | M5 |
| 80 | Nota kasir gratis ongkir | Tidak ada bonus | LOG-76 |
| 81 | Nota 0112 dibatalkan di kasir saat Rina sedang di jalan | Perlu Diperiksa Kepala Toko Raja atau Kepala Gudang; bonus mengikuti aturan perubahan dari kasir | PRI-41, LOG-76 |
| 82 | Kasir mengganti pengantar di nota sesudah slip ditutup | Masuk daftar periksa HR (Terima perubahan atau Biarkan) | Spec Gaji bagian 3.4 |
| 83 | Toko Maju membayar cash penuh untuk dua nota (Gudang Rp2.000.000, Raja Rp850.000) | Cash Rp2.850.000; kedua nota lunas | LOG-112 |
| 84 | Toko bayar cash Rp2.500.000 dari tagihan Rp2.850.000 | Nota Gudang lunas, Raja kurang Rp350.000; tanggal janji bayar sisa wajib | LOG-112, 113 |
| 85 | Toko bilang "sudah transfer" tapi tidak bisa menunjukkan bukti | Transfer tidak bisa dipilih; driver memilih Deposit | LOG-44 |
| 86 | Toko menunjukkan bukti transfer dari WhatsApp kemarin sore | Foto bukti dari galeri diterima (bukti transfer tanpa batas umur) | TAM-08 |
| 87 | Toko bayar Rp1.000.000 cash dan Rp1.850.000 transfer | Campuran, dua angka, foto bukti untuk bagian transfer | LOG-45 |
| 88 | Toko bayar Rp3.000.000 untuk tagihan Rp2.850.000 | Pertanyaan kedua; "Ya": lebih Rp150.000 menjadi titipan toko untuk Gudang (pemegang uang) | LOG-49, 114 |
| 89 | Driver salah ketik Rp28.500.000 | Pertanyaan kedua menyebut lebih Rp25.650.000; driver menekan Betulkan angka | LOG-49 |
| 90 | Toko bayar sebagian cash, sisanya minta tempo | Pilih Cash, ketik uangnya, isi tanggal janji bayar sisa | LOG-113 |
| 91 | Dua dus pakan rusak, toko minta dipotong Rp180.000 | Potong nota alasan rusak, dibawa kembali, pemilik Gudang, foto; Menunggu; dihitung kurang bayar sampai Finance memutuskan | LOG-51, 52 |
| 92 | Potong nota Rp900.000 untuk nota Raja Rp850.000 | Ditolak server: "Potongan Raja Rp900.000 melebihi nota Raja Rp850.000" | LOG-51 |
| 93 | Finance menyetujui potongan Rp180.000 | Tagihan Gudang turun; pembagian dijalankan ulang; kurang bayar berkurang | LOG-52, 112 |
| 94 | Finance menolak potongan dengan alasan "rusak karena toko" | Potongan tetap dihitung kurang bayar; pencatat diberi tahu | LOG-52 |
| 95 | Marketing mencoba menyetujui potongan | Ditolak server | LOG-52, 84 |
| 96 | Toko menerima pasir kucing merek A padahal pesan merek B, mau dipakai saja tapi harga A lebih murah Rp20.000 | Barang kejadian salah muat, dibeli toko + potong nota harga beda Rp20.000 | LOG-53 |
| 97 | Ada 1 dus lebih di bak, toko mau membelinya Rp120.000 | Barang kejadian barang lebih, dibeli toko; uang Rp120.000 ikut terbaca sebagai titipan; Gudang membuat nota di kasir dan memakai titipan itu | LOG-118 |
| 98 | Barang lebih milik Raja dibawa pulang driver truk | Barang kembali: diantar ke Raja sebelum pulang; bak kosong ditolak selama belum Diserahkan | LOG-54, 115 |
| 99 | Barang potongan milik Gudang dibawa pulang | Diserahkan di Gudang saat lapor garasi; tidak menahan Menuju Garasi | LOG-115 |
| 100 | Raja sudah tutup saat truk lewat membawa barang kembali | Kepala Gudang menekan Alihkan ke Gudang; barang diantar trip berikutnya; trip tidak tertahan | LOG-115 |
| 101 | Raja menerima barang kembali tapi kurang 1 | Terima dengan Tidak sesuai, catatan dan foto; ditinjau Kepala Gudang (4F-4b) | LOG-61, 115 |
| 102 | Raja belum menekan Terima 4 hari | Ditandai di Dashboard dan Beranda Kepala Toko Raja | LOG-80 |
| 103 | Driver salah pilih Cash padahal Transfer, trip masih berjalan | Driver mengubah lewat Ubah Pembayaran dengan foto bukti; pembagian dijalankan ulang | LOG-48, 116 |
| 104 | Sama, tetapi trip sudah Selesai | Kepala Gudang mengubah dengan alasan; Finance diberi tahu | LOG-48, 116 |
| 105 | Finance sudah memeriksa Cocok, lalu ternyata salah cara bayar | Ubah ditolak; Finance membatalkan pemeriksaan dengan alasan (4F-5), lalu diubah | LOG-48, 63 |
| 106 | Mengubah cara bayar ke Transfer tanpa foto | Ditolak server | LOG-44 |
| 107 | Sinyal putus saat Simpan Kirim | Tidak ada yang tersimpan setengah; isian tetap di layar; ulangi | LOG-47, TAM-16 |
| 108 | Dedi dan Eko menekan Simpan Kirim hampir bersamaan | Yang kedua menerima "Sudah dikirim oleh Dedi pukul 10.42" | LOG-26, 47 |
| 109 | Rina mengantar dua nota Raja ke Toko Sinar, toko bayar satu angka Rp1.200.000 | Satu angka dibagi ke dua nota dengan rumus yang sama | LOG-117 |
| 110 | Potong nota antar sendiri, barang dibawa kembali | Diserahkan saat Foto 3 di Raja; Kepala Toko Raja menekan Terima | LOG-115 |
| 111 | Toko mengembalikan barang dari pengiriman minggu lalu saat truk datang | Bukan potong nota; driver menghubungi kantor, kantor menambah tugas retur ke trip (LOG-22, 58; isinya 4F-4b) | LOG-58 |
| 112 | GM mengubah nominal surat jalan sesudah Terkirim | Pembagian dijalankan ulang; bagian lama Diganti | LOG-11, 112 |
| 113 | Toko Maju tutup pukul 09.00 | Kirim Besok dengan foto pintu tertutup; 0451 Menunggu dijadwalkan; tertunda sejak hari ini | LOG-55, 119 |
| 114 | Toko Maju buka pukul 11.00 saat truk lewat lagi | Coba lagi, lalu Kirim; catatan tertunda Dicoba lagi | LOG-121 |
| 115 | Kepala Gudang memasukkan 0451 ke rencana sore saat truk pagi masih Berjalan | Ditolak: "0451 masih di truk trip pagi (Dedi)" | LOG-121 |
| 116 | Toko tutup 4 hari berturut-turut | Satu catatan tertunda "4 kali", merah sejak lewat 3 hari dari Kirim Besok pertama | LOG-57, 119 |
| 117 | Toko libur seminggu | Kepala Gudang menutup tertunda dengan keterangan; 0451 tetap di antrean, tidak merah | LOG-57 |
| 118 | Toko Maju punya 0451 dan 0460, keduanya Kirim Besok; besoknya hanya 0451 yang dikirim | Tertunda 0451 Selesai; tertunda 0460 tetap terbuka | LOG-119 |
| 119 | Toko menolak barang karena sudah pesan ke sales lain | Gagal; 0451 Perlu keputusan Kepala Gudang | LOG-56 |
| 120 | Kepala Gudang memutuskan Batal | 0451 Batal; Finance mendapat baris "Batalkan penjualan 0451 di kasir"; pembatalan dari kasir tertarik dan cocok sendiri | LOG-123 |
| 121 | Paket Raja ditolak Toko Sinar di jalur truk | Gagal; paket pulang ke Gudang; Kepala Toko Raja memutuskan jadwal ulang jalur driver; paket ikut trip besok tanpa jemput ke Raja | LOG-120 |
| 122 | Sama, tetapi Raja memutuskan diantar sendiri | Paket menjadi barang kembali ke Raja lewat trip berikutnya; sesudah Diterima, Menunggu diantar | LOG-120 |
| 123 | Toko menerima nota Gudang tetapi menolak nota Raja utuh | Kirim; nota Raja dicatat potong nota senilai nota, alasan ditolak toko; Finance memutuskan | LOG-122 |
| 124 | Driver menekan Kirim Besok dari 3 km | Tersimpan, bertanda di luar titik toko untuk Kepala Gudang | LOG-99 |
| 125 | Selesai lebih awal dengan 5 toko berisi 7 surat jalan | 5 kunjungan Kirim Besok; 7 catatan tertunda | LOG-27, 119 |
| 126 | Kantor melepas kunjungan karena mobil penuh | Bukan Kirim Besok, tidak tertunda | LOG-22 |
| 127 | Marketing menandai retur Toko Sinar yang sudah punya retur terbuka | Ditolak, menyebut retur itu | LOG-58 |
| 128 | Toko minta retur saat truk sedang di sana | Awak menekan Toko mau retur; Kepala Gudang menandai dan menugaskan ke trip Berjalan; awak mengambil | LOG-58, 126 |
| 129 | Retur 3 barang, satu milik Raja | 2 barang diserahkan di Gudang saat lapor garasi; 1 diantar ke Raja sebelum Menuju Garasi | LOG-115, 126 |
| 130 | Toko tutup saat retur akan diambil | Tidak bisa diambil hari ini; retur kembali Menunggu ditugaskan bertanda dicoba; ritase trip tetap | LOG-33, 126 |
| 131 | Toko bilang barang retur sudah dibuang | Tidak ada barang, foto toko dan alasan; retur Tanpa barang, tanpa nilai | LOG-59 |
| 132 | Gudang menerima retur 10 dus, ternyata 9 | Tidak sesuai; Kepala Gudang meninjau: Selisih dicatat 9, diteruskan ke HR; Finance menilai 9 dus | LOG-124, 125 |
| 133 | Finance menilai retur Rp450.000 | Kiriman ke kasir "kurangi tagihan Toko Sinar Rp450.000 (Gudang)" | LOG-60, 124 |
| 134 | Finance salah nilai, belum dicatat di kasir | Diubah dengan alasan; riwayat tersimpan | LOG-124 |
| 135 | Retur salah toko, belum ditugaskan | Dibatalkan dengan alasan | LOG-58 |
| 136 | Rencana berisi retur dibatalkan | Retur kembali Menunggu ditugaskan | LOG-23 |
| 137 | Driver mencoba menandai retur sendiri | Tidak ada tombolnya; server menolak bila dikirim langsung | LOG-58 |
| 138 | Kepala Gudang yang menerima barang Tidak sesuai mencoba meninjaunya sendiri | Ditolak; pemilik meninjau | LOG-125 |
| 139 | Truk pulang 18.30, Finance sudah pulang | Lapor garasi tetap jalan; uang dipegang driver; pagi berikutnya diserahkan ke Finance | LOG-127 |
| 140 | Uang belum diserahkan sampai 12.00 besoknya | Ditandai untuk Kepala Gudang, Finance, Pemilik, GM; tampil di Dashboard | LOG-127 |
| 141 | Finance tidak ada; driver menyerahkan ke pemegang Brankas | Pemegang Brankas menekan Terima; uang masuk Brankas | LOG-127, KEU-35 |
| 142 | Uang dihitung Rp150.000 kurang; driver ingat Toko Maju bayar kurang Rp100.000 | Toko Maju Tidak Cocok (tagihan bertambah, janji bayar 7 hari); sisa Rp50.000 kurang serah atas nama Dedi, diteruskan ke HR | LOG-129 |
| 143 | Uang lebih Rp20.000 tanpa penjelasan | Lebih serah, ditandai untuk Pemilik dan GM; uang tetap tercatat masuk | LOG-129 |
| 144 | Dua awak memegang uang, selisih tidak jelas milik siapa | Dibagi sama rata, bertanda pembawa tidak jelas untuk HR | LOG-129 |
| 145 | Rina pulang antar sendiri membawa Rp1.200.000 | Foto 3; Sari (kasir bertugas) menekan Terima; uang di laci Raja dan ikut setoran shift itu | LOG-128 |
| 146 | Rina mencoba menerima uangnya sendiri | Ditolak; teman lain atau Kepala Toko yang menerima | LOG-128 |
| 147 | Finance menerima setoran Raja Cocok | Uang antar sendiri di dalamnya ikut Cocok; Kas Masuk Laci Raja bertanggal Foto 2 | LOG-128 |
| 148 | Setoran Raja Tidak cocok | Uang antar sendiri tetap menunggu di tab Tunai antar sendiri; Finance memeriksanya sendiri | LOG-128 |
| 149 | Transfer Toko Jaya Rp800.000 ada di mutasi BCA | Finance memilih rekening BCA, Cocok; Kas Masuk rekening BCA bertanggal Kirim | LOG-62, 64 |
| 150 | Bukti transfer palsu, uang tidak ada | Tidak Cocok Rp0; seluruhnya menjadi tagihan, janji bayar 7 hari; Marketing diberi tahu | LOG-62, 113 |
| 151 | Sepuluh transfer ke rekening yang sama | Dicentang, Cocok sekaligus, tombol ditahan 3 detik dengan jumlah rupiahnya | LOG-62 |
| 152 | Deposit Rp1.000.000 masuk 2 hari sesudah Kirim | Masuk, tanggal masuk rekening; Kas Masuk bertanggal itu | LOG-64, 130 |
| 153 | Deposit belum masuk sampai hari ke-3 | Belum masuk: sisa tagihan Rp1.000.000, janji bayar 7 hari; ditagih Marketing | LOG-130 |
| 154 | Uang deposit itu masuk hari ke-5 | Pelunasan biasa yang dicatat di kasir; HRIS tidak memeriksa ulang | LOG-130, 66 |
| 155 | GM mengubah pembayaran sesudah trip, lalu mencoba memeriksanya | Ditolak; Finance atau Pemilik yang memeriksa | LOG-127, KEU-120 |
| 156 | Finance salah pilih rekening kemarin | Finance membatalkan pemeriksaannya dengan alasan, lalu memeriksa ulang | LOG-132 |
| 157 | Salah rekening ketahuan 10 hari kemudian, belum tercatat di kasir | Finance tidak bisa lagi; GM membatalkan dengan alasan | LOG-132 |
| 158 | Salah sesudah tercatat di kasir | Tidak dibatalkan; koreksi (4F-5b) | LOG-14, 132 |
| 159 | Toko bayar lebih Rp200.000 (titipan) | Kas Masuk nota sebesar tagihan; Rp200.000 baris "titipan toko", bukan pendapatan | LOG-114, 131 |
| 160 | Pembayaran Campuran: cash Rp500.000, transfer Rp300.000 | Cash ikut serah trip; transfer diperiksa di tab Transfer; terkunci begitu salah satu diperiksa | LOG-127 |
| 161 | Toko Maju nota 0451 Rp2.350.000: cash Rp2.000.000 diperiksa, potong Rp100.000 disetujui, sisa Rp250.000 janji 21 Oktober | Satu ringkasan di kasir Gudang dengan tiga isian; Finance mengetik di kasir dan menandai; nota terkunci | LOG-133, 135 |
| 162 | Transfer sudah diperiksa, potong nota masih Menunggu | Nota belum siap; ringkasan lahir sesudah potongan diputuskan | LOG-133 |
| 163 | Satu kunjungan berisi nota Gudang dan nota Raja | Dua ringkasan: kasir Gudang dan kasir Raja | LOG-133 |
| 164 | Pemilik membatalkan pemeriksaan sebelum Finance mencatat | Ringkasan Dibatalkan "sumber berubah"; muncul lagi sesudah diperiksa ulang, bertanda berubah sejak tampil | LOG-133, 132 |
| 165 | Finance mencoba membatalkan pemeriksaan nota yang sudah tercatat | Ditolak; arahan memakai Koreksi | LOG-14, 132 |
| 166 | Tempo Rp1.500.000 jatuh tempo 30 Oktober, trip Selesai | Ringkasan "Tempo, jatuh tempo 30 Oktober" langsung siap | LOG-133 |
| 167 | Toko bayar lebih Rp200.000 | Baris titipan toko di kasir Gudang sesudah pembayaran diperiksa seluruhnya | LOG-133, 114 |
| 168 | Nilai retur Rp450.000 disahkan | Baris kurangi tagihan di kasir Gudang; sesudah tercatat, nilai retur terkunci | LOG-133, 124 |
| 169 | Finance menandai tercatat padahal belum mengetik di kasir | Membatalkan tanda dalam 24 jam dengan alasan; sesudahnya Pemilik atau GM | LOG-135 |
| 170 | Ternyata uang nota 0451 Rp1.900.000, sudah tercatat | Koreksi: pembayaran baru, Kas Masuk dikurangi, baris koreksi ke kasir; Pemilik dan GM diberi tahu, masuk perlu perhatian | LOG-136 |
| 171 | Salah rekening ketahuan sesudah tercatat | Koreksi tempat uang: Kas Masuk diganti; tidak ada baris ke kasir | LOG-136 |
| 172 | Koreksi atas Kas Masuk September yang bulannya sudah ditutup | Baris koreksi bertanggal Oktober menunjuk baris September | LOG-136, KEU-112 |
| 173 | Finance salah ketik di kasir (Rp200.000, bukan Rp2.000.000) | Esok harinya kasir masih menagih Rp2.050.000, lebih dari Rp250.000: Perlu Diperiksa Finance; dibetulkan di kasir, tanda hilang sendiri | LOG-137 |
| 174 | Toko melunasi sisa Rp250.000 langsung di kasir | Kasir menagih Rp0, lebih kecil dari sisa HRIS: wajar, tidak ditandai | LOG-137 |
| 175 | Sambungan piutang belum menyala | Finance mengunggah file piutang; Daftar Tagih menulis tanggal file; lebih dari 7 hari: peringatan dan pengingat | LOG-138 |
| 176 | Toko Maju sudah membayar ke driver, belum tercatat di kasir; Marketing membuka Daftar Tagih | Baris toko menampilkan "Rp2.000.000 sudah di HRIS, belum tercatat di kasir" | LOG-138 |
| 177 | Marketing menelepon Toko Jaya, janji bayar 25 Oktober | Catatan tagih Janji bayar; 26 Oktober masih bersisa: merah dan Beranda Marketing | LOG-139 |
| 178 | Marketing minta ditagih saat kirim berikutnya | Kotak tampil di kunjungan toko itu; toko membayar Rp750.000 tagihan lama ke driver: lebih bayar, titipan toko, Finance memakainya di kasir | LOG-139, 114 |
| 179 | Toko bilang sudah bayar, menurut kasir belum | Catatan tagih Sengketa, ditandai untuk Finance; Finance memeriksa dan, bila perlu, koreksi | LOG-139 |
| 180 | Pembatalan penjualan 0451 tertarik dari kasir | Baris Batalkan penjualan ditandai tercatat sendiri | LOG-123 |
| 181 | Laci Raja menerima pelunasan Toko Jaya Rp500.000 (Laporan Kasir) | Keuangan menulis baris titipan pelunasan ke Catat di Kasir; Finance mencatatnya di kasir | LOG-134, KEU-46 |
| 182 | Marketing mencoba menandai tercatat | Tidak ada tombolnya; server menolak bila dikirim langsung | LOG-84 |
| 183 | Senin sore Dedi minta isi bensin Rp300.000 untuk L300; Selasa pagi Finance memberi Rp300.000; struk Rp285.000, kembalian Rp15.000 | Satu baris uang keluar Rp285.000; Rp15.000 kembali ke Kas Pegangan; permintaan Selesai | LOG-143, 144, KEU-26 |
| 184 | Diberi Rp300.000, struk Rp320.000 | Baris Rp320.000; Rp20.000 dibayar ke Dedi dari tempat uang yang sama | LOG-144 |
| 185 | Kepala Gudang membayar bensin dengan uangnya sendiri | Dibayar orang lain dulu: baris belum dipasangkan; Finance membayar gantinya dan memasangkannya | LOG-144, KEU-18 |
| 186 | Dedi minta bensin dua sore berturut-turut, permintaan pertama belum ditutup | Permintaan kedua mengganti yang pertama (Diganti); satu Menunggu | LOG-143 |
| 187 | Kepala Gudang menilai tangki masih cukup | Tidak jadi dengan alasan; Dedi diberi tahu | LOG-143 |
| 188 | Permintaan belum ditutup sampai 12.00 besoknya karena Finance libur | Merah; Antrean Kepala Gudang dan Finance; Kepala Gudang bisa menutupnya | LOG-143 |
| 189 | Truk isi bensin di tengah jalan tanpa permintaan | Catat bensin tanpa permintaan, dengan foto struk | LOG-144 |
| 190 | Struk bensin hilang | "Struk tidak ada" dengan alasan; tersimpan bertanda, Pemilik dan GM diberi tahu | LOG-144 |
| 191 | Kepala Gudang mengetik Rp258.000 padahal Rp285.000 | Dibatalkan dengan alasan sebelum diperiksa, dicatat ulang | LOG-144, 86 |
| 192 | Salah nominal ketahuan sesudah Pemilik memeriksa barisnya | Hanya Pemilik atau GM yang membatalkan (KEU-16) | LOG-144 |
| 193 | Dedi Kirim di Toko Maju 350 meter dari titik (gang sempit) | Tersimpan bertanda; Kepala Gudang meninjau Wajar | LOG-142 |
| 194 | Toko yang sama 4 kali di luar titik dalam sebulan, selalu sekitar 300 meter ke arah yang sama | Titik toko mungkin salah: Laporkan titik salah dengan kunjungan sebagai bukti | LOG-142, 93 |
| 195 | Kirim tercatat 2 km dari toko, toko bilang barang tidak datang | Tidak wajar: Pemilik dan GM diberi tahu; barang dan uang lewat jalan biasa | LOG-142 |
| 196 | Kepala Gudang ikut sebagai kenek dan Kirim-nya di luar titik | Ia tidak meninjau; Pemilik atau GM yang meninjau | LOG-142 |
| 197 | Marketing membuka Dashboard | Bagian Berjalan, Pengiriman, dan Uang tanpa kurang serah; tidak ada bensin | LOG-140 |
| 198 | Finance membuka Dashboard | Bagian Uang serta Mobil dan bensin | LOG-140 |
| 199 | Semua urusan beres | "Tidak ada yang perlu perhatian hari ini." | LOG-141 |
| 200 | Tarik Data Kasir mati dua jam | Dashboard menulis "Data kasir terakhir masuk jam 07.40" (PRI-39); angka lain tetap dari HRIS | LOG-141 |
| 201 | Trip 24 Oktober, uangnya baru diperiksa 27 Oktober | Masuk Laporan periode Oktober (tanggal kirim); sebelum 27 Oktober di "belum diperiksa", sesudahnya di terperiksa | LOG-145 |
| 202 | GM membandingkan uang Laporan Logistik Oktober dengan Keuangan Hari Ini Oktober dan angkanya beda | Wajar: periode 26–25 dan tanggal kirim lawan bulan dan tanggal uang; tulisan di atas laporan menjelaskannya | LOG-145 |
| 203 | Marketing mengunduh Excel | Tanpa angka bensin; unduhan tercatat | LOG-145 |
| 204 | Laporan tanggal bebas setahun | Ditolak: paling panjang 3 bulan; pakai pilihan periode | LOG-145 |

---

## 11. Jalan keluar

| Tindakan | Kembali / ulangi | Batalkan | Oleh siapa, sampai kapan | Akibat ke data lain |
|---|---|---|---|---|
| Tambah toko | Kembali di tiap langkah | Nonaktifkan dengan alasan | Marketing, Kepala Gudang, pemilik | — |
| Ubah data pengiriman | Kembali sebelum Simpan | Diubah lagi; riwayat tersimpan | sama | — |
| Nonaktifkan toko | — | Aktifkan lagi | sama | Muncul lagi di pilihan |
| Gabungkan toko | Kembali di langkah 1–2 | Batalkan gabung, 30 hari | Pemilik, GM | Catatan yang dipindah kembali |
| Pasang titik | Ulangi foto dan posisi | Ditolak Kepala Gudang; pasang lagi | Pemasang; Kepala Gudang, pemilik | — |
| Setujui titik | Kembali sebelum Simpan | Titik baru dipasang Kepala Gudang atau pemilik; yang lama Diganti | Kepala Gudang, pemilik | — |
| Mobil dan rute | Kembali sebelum Simpan | Nonaktifkan (kalau tidak dipakai rencana berjalan) | Kepala Gudang, pemilik | — |
| Catat surat jalan | Kembali di tiap langkah | Batal dengan alasan selagi Menunggu atau Perlu keputusan | Pencatat, Marketing, Kepala Gudang, pemilik | — |
| Ubah surat jalan | Kembali di tiap langkah | Diubah lagi; riwayat tersimpan | Menurut tabel "Mengubah dan membatalkan" | Uang kunjungan dibagi ulang bila sudah berangkat |
| Tandai Diambil toko | — | Buka lagi, 7 hari | Penanda, pemilik | Kembali ke antrean |
| Batal surat jalan | — | Tidak dibuka lagi; catat surat jalan baru | — | — |
| Buat rencana | Kembali di tiap langkah; Simpan Draft | Batalkan (Draft, Siap Kirim), alasan | Kepala Gudang, pemilik | Semua isi kembali ke antrean |
| Siap Kirim | — | Kembali ke Draft sebelum Berangkat | Kepala Gudang, pemilik | — |
| Berangkat | Kembali sebelum tombol | Tidak dibatalkan driver; absen dibetulkan HR lewat Koreksi; trip yang salah berangkat ditutup kantor dengan alasan | Kantor | Absen masuk awak |
| Ganti awak | Kembali di tiap langkah | Diganti lagi sampai Menuju Garasi | Kepala Gudang, pemilik | Absen dan ritase |
| Lepas kunjungan | — | Surat jalan dimasukkan lagi ke rencana berikutnya | Kepala Gudang, pemilik | — |
| Selesai lebih awal | Kembali sebelum tombol ditahan | Tidak dibatalkan; toko tertunda dijadwalkan ulang | Kantor | Kirim Besok |
| Bak kosong / Menuju Garasi | — | Kantor mengembalikan ke Berjalan dengan alasan selama belum lapor garasi | Kepala Gudang, pemilik | — |
| Lapor garasi | Langkah tersimpan; lanjut dari handphone lain | Tidak dibatalkan; jam pulang dibetulkan HR lewat Koreksi | HR (absen) | Absen pulang, ritase |
| Tutup trip oleh kantor | Kembali sebelum tombol ditahan | Tidak dibuka lagi; ritase yang salah dibatalkan pemilik | Pemilik, GM | Ritase |
| Ritase tangan | Kembali di tiap langkah | Batal ritase dengan alasan | Pemilik, GM | Upah (4G) |
| Matikan pagar | — | Nyalakan lebih cepat; menyala sendiri saat batas | Pemilik, GM | — |
| Buat laporan muat | Kembali di tiap langkah; foto dibatalkan selama Proses | Batalkan dari Proses, alasan | Staf cabang asal, pemilik | — |
| Tandai Selesai | Kembali di tiap langkah | Kembalikan ke Proses selama belum diambil atau berangkat, alasan | Staf cabang asal, pemilik | Nota tetap; foto terbuka |
| Ubah laporan muat | Kembali di tiap langkah | Diubah lagi; riwayat tersimpan | Menurut tabel "Mengubah sesudah Selesai" | Uang dibagi ulang bila sudah berangkat |
| Tugaskan paket ke rencana | — | Lepas dari rencana (sebelum Berangkat) atau rencana dibatalkan | Kepala Gudang, pemilik | Kembali Menunggu dijemput |
| Ambil paket | Centang ulang sebelum Ambil | Kantor melepas kunjungannya (LOG-22); laporan kembali Menunggu dijemput bertanda "barang di Gudang" | Kepala Gudang, pemilik | Kunjungan dilepas |
| Mulai antar (Foto 1) | Ulangi foto sebelum Mulai | Tidak dibatalkan; Tutup perjalanan | Kepala Toko, Kepala Gudang, pemilik | Tujuan tanpa hasil menjadi Kirim Besok |
| Foto 2 hasil | Kembali sebelum simpan | Pembayaran diubah menurut LOG-48 (4F-4) | Menurut 4F-4 | — |
| Foto 3 | Ulangi foto | Tidak dibatalkan | — | Tanda ⚠ dicabut |
| Alihkan PJ | Kembali sebelum Simpan | Dialihkan lagi | Staf cabang asal, Kepala Toko, pemilik | Tanda beda dengan kasir |
| Tutup perjalanan | Kembali sebelum tombol ditahan | Tidak dibuka lagi; kiriman Kirim Besok dijadwalkan ulang | Kepala Toko, Kepala Gudang, pemilik | ⚠ bonus ongkir |
| Simpan Kirim | Kembali di tiap langkah sebelum tombol ditahan | Kirim tidak dibatalkan; uang, potongan, dan kejadian diubah lewat Ubah Pembayaran | Menurut tabel "Mengubah pembayaran" (K4) | Pembagian dijalankan ulang |
| Ubah pembayaran | Kembali di tiap langkah | Diubah lagi; riwayat tersimpan | sama; terkunci sesudah diperiksa atau tercatat di kasir | Pembagian; Finance diberi tahu bila kantor |
| Putuskan potong nota | Kembali sebelum tombol ditahan | Keputusan diubah, sampai nota tercatat di kasir | Finance, Pemilik, GM | Pembagian dijalankan ulang |
| Serahkan barang | Ulangi foto sebelum Serahkan | Kepala Gudang atau pemilik mengembalikan ke Dibawa dengan alasan, selama belum Diterima | Kepala Gudang, pemilik | Syarat Menuju Garasi berlaku lagi bila trip belum Menuju Garasi |
| Terima barang | Kembali sebelum Terima | Tidak dibatalkan; "Tidak sesuai" ditinjau Kepala Gudang (4F-4b) | — | Potongan terkunci |
| Alihkan ke Gudang | — | Barang tetap barang kembali yang sama; diantar trip berikutnya | Kepala Gudang, pemilik | Trip tidak tertahan |
| Sudah dikoreksi / dibuat di kasir | — | Dibuka lagi dengan alasan | Penanda, pemilik | — |
| Kirim Besok | Kembali sebelum Simpan | Coba lagi selama trip Berjalan atau perjalanan belum Foto 3 | Awak, PJ | Tertunda mundur |
| Gagal | Kembali sebelum Simpan | Tidak dibatalkan; diputuskan (Jadwal ulang atau Batal) | Pemutus menurut tabel Perlu keputusan | — |
| Putuskan kiriman Gagal | Kembali sebelum Simpan | Batal dibuka lagi dalam 7 hari selama penjualan belum dibatalkan di kasir; Jadwal ulang tidak dibuka lagi, kiriman dibatalkan lewat jalan biasa | Pemilik, GM | Baris kiriman ke kasir dibatalkan |
| Tutup tertunda | Kembali sebelum Simpan | Dibuka lagi | Penutup, pemilik | — |
| Tandai retur | Kembali sebelum Simpan | Batalkan selama Menunggu ditugaskan, alasan | Penanda, Kepala Gudang, pemilik | — |
| Tugaskan retur | — | Lepas sebelum dikerjakan; rencana batal | Kepala Gudang, pemilik | Kembali Menunggu ditugaskan |
| Catat barang retur | Batalkan barang sebelum Selesai | Sesudah Selesai tidak diubah; selisih lewat Tidak sesuai | Awak | — |
| Selesai retur / Tidak ada barang | Kembali sebelum Simpan | Tidak dibatalkan | — | Barang kembali lahir |
| Sahkan nilai retur | Kembali sebelum tombol ditahan | Diubah dengan alasan sampai tercatat di kasir; sesudahnya koreksi (LOG-14, 4F-5) | Finance, pemilik | Kiriman ke kasir |
| Tinjau tidak sesuai | Kembali sebelum Simpan | Ditinjau ulang oleh pemilik dengan alasan; usulan ke HR dibatalkan di Gaji | Pemilik, GM | Usulan kehilangan barang |
| Terima uang tunai (Cocok atau selisih) | Kembali sebelum tombol ditahan | Batalkan pemeriksaan (serah tunai) dengan alasan, lalu terima ulang | Finance penerima 7 hari; Pemilik, GM sampai tercatat di kasir | Kas Masuk dibatalkan; kurang serah dibatalkan, usulan di Gaji dibatalkan HR |
| Periksa transfer atau deposit | Kembali sebelum Simpan | Batalkan pemeriksaan dengan alasan | sama | Kas Masuk dibatalkan; pembayaran terbuka lagi; tagihan dari Tidak Cocok kembali |
| Belum masuk (deposit) | Kembali sebelum Simpan | Batalkan pemeriksaan, lalu Masuk | sama | Sisa tagihan dibatalkan |
| Tandai tercatat di kasir | Kembali sebelum tombol ditahan | Batalkan tanda dengan alasan | Penanda 24 jam; Pemilik, GM selama belum ada koreksi sesudahnya | Kunci nota terbuka lagi |
| Koreksi nota | Kembali di tiap langkah | Koreksi lagi dengan alasan; riwayat tersimpan | Finance, Pemilik, GM | Kas Masuk dan baris ke kasir mengikuti |
| Biarkan beda piutang | Kembali sebelum Simpan | Muncul lagi bila bedanya berubah pada tarikan berikutnya | Finance, Pemilik, GM | — |
| Catat hasil tagih | Kembali sebelum Simpan | Dibatalkan dengan alasan, atau catatan baru | Pencatat, Pemilik, GM | Kotak minta ditagih hilang |
| Sudah Diisi / Catat bensin | Kembali di tiap langkah sebelum tombol ditahan | Batalkan catatan dengan alasan, lalu catat ulang | Pencatat selama barisnya belum diperiksa; Pemilik, GM | Baris Buku Kas dibatalkan; permintaan kembali Menunggu |
| Tidak jadi isi bensin | Kembali sebelum Simpan | Tidak dibuka lagi; bila ternyata perlu, Catat bensin tanpa permintaan | Kepala Gudang, Finance, pemilik | — |
| Tinjau kirim di luar titik | Kembali sebelum Simpan | Ditinjau ulang oleh Pemilik atau GM dengan alasan (yang lama Diganti) | Pemilik, GM | Laporan titik salah tetap berjalan di LOG-L06 |
| Dashboard, Laporan, unduh Excel | — (hanya membaca) | — | — | — |

---

## 12. Daftar tes

**Uang**

| No | Tes | Contoh |
|---|---|---|
| U1 | Nota kunjungan = jumlah surat jalan | Toko Maju: 0451 Rp2.350.000 + 0455 Rp450.000 = nota gudang kunjungan Rp2.800.000; tiap surat jalan tetap satu nota |
| U2 | Nominal wajib bulat dan lebih dari 0 | Rp0 dan Rp1.500,5 ditolak |
| U3 | Ubah nominal sesudah berangkat | 0451 Rp2.350.000 → Rp2.400.000 oleh GM: perubahan tercatat, nota ikut berubah, pembagian uang kunjungan dijalankan ulang (rumusnya di 4F-4) |
| U4 | Gabung toko tidak mengubah angka | Toko A 3 nota Rp5.000.000, toko B 2 nota Rp1.000.000: sesudah gabung toko tetap 5 nota Rp6.000.000; dibatalkan: kembali 3 dan 2 |
| U5 | Penjualan ke cabang bukan surat jalan | Transaksi Gudang ke pelanggan yang dipasangkan ke cabang Raja: tidak ada surat jalan, tidak ada nota |
| U6 | Ritase per awak | Trip berkenek dengan 9 toko (2 Kirim Besok): Dedi 1 ritase berkenek, Eko 1 ritase kenek; tidak berkurang karena toko gagal |
| U7 | Hanya belanja | Trip 1 tugas belanja: 0 ritase, 1 upah belanja untuk Dedi dan 1 untuk Eko (nominal kenek Rp0 dari tarif, DRV-10) |
| U8 | Antar + belanja | Trip 6 toko + 1 belanja: 1 ritase + 1 upah belanja per awak |
| U9 | Tidak dobel | Lapor garasi ditekan dua kali, atau kantor menutup trip yang baru saja dilapor: ritase tetap 1 per awak (kunci trip + orang + jenis) |
| U10 | Berkenek dibaca saat Selesai | Kenek dicopot sebelum Selesai: driver tarif tanpa kenek; kenek ditambahkan sebelum Selesai: driver tarif dengan kenek |
| U11 | Retur saja | Trip berisi 1 tugas retur tanpa toko: 1 ritase per awak (LOG-33) |
| U12 | Nota kunjungan dengan paket | Toko Maju: surat jalan 0451 Rp2.350.000 + nota cabang Raja 0112 Rp850.000 = nota kunjungan Rp3.200.000; dua nota, cabang pemilik berbeda |
| U13 | Bonus ongkir | Ongkir Rp15.000 → Rp7.500; Rp7.001 → Rp3.500; gratis ongkir → tidak ada baris; ongkir diketik sebelum menyala → tidak ada baris |
| U14 | Bonus tidak dobel | Baris ongkir yang sama tertarik dua kali, atau tertarik lalu diunggah lewat file: tetap satu baris Buku Bonus (kunci asal) |
| U15 | Ubah nominal nota cabang sesudah diambil | 0112 Rp850.000 → Rp900.000 oleh GM: nota berubah, pembagian uang kunjungan dijalankan ulang (4F-4) |
| U16 | Nota kasir dipakai sekali | Nota 0112 sudah dipakai laporan A: laporan B tidak bisa memilihnya (server menolak walaupun dikirim langsung) |
| U17 | Paket menambah ritase | Trip berisi 2 laporan muat saja: 1 ritase per awak |
| U18 | Pembagian terbesar dulu | Gudang Rp2.000.000, Raja Rp850.000, cash Rp2.500.000: Gudang 2.000.000, Raja 500.000, kurang Raja 350.000 |
| U19 | Sama besar, Gudang dulu | Gudang Rp1.000.000, Raja Rp1.000.000, cash Rp1.500.000: Gudang 1.000.000, Raja 500.000 |
| U20 | Sama besar, sama jenis | Dua nota Gudang 0451 dan 0455 masing-masing Rp500.000, cash Rp700.000: 0451 Rp500.000, 0455 Rp200.000 |
| U21 | Potongan disetujui mengurangi nota pemiliknya | Contoh U18 + potongan Raja Rp50.000 disetujui: tagihan Raja 800.000; bagian Raja 500.000, kurang 300.000 |
| U22 | Potongan menunggu dan ditolak | Potongan Rp50.000 Menunggu atau Ditolak: tagihan tetap 850.000; kurang Raja 350.000 |
| U23 | Potongan ke nota terbesar pemilik dulu | Gudang 0451 Rp300.000 dan 0455 Rp1.000.000, potongan Gudang Rp1.100.000 disetujui: 0455 tagihan 0, 0451 tagihan 200.000 |
| U24 | Potongan melebihi nota pemilik | Potongan Raja Rp900.000, nota Raja Rp850.000: ditolak server |
| U25 | Lebih bayar | Tagihan Rp2.850.000, cash Rp3.000.000: kedua lunas, titipan Rp150.000 untuk cabang pemegang uang |
| U26 | Campuran cash dulu | Gudang Rp2.000.000, Raja Rp850.000; cash Rp1.000.000 + transfer Rp1.850.000: Gudang cash 1.000.000 + transfer 1.000.000, Raja transfer 850.000 |
| U27 | Tempo | Tempo, uang Rp0: semua nota kurang penuh; tanggal jatuh tempo wajib; Rp0 untuk Cash ditolak |
| U28 | Janji bayar sisa hanya untuk kurang di luar potongan | Kurang Rp50.000 seluruhnya dari potongan menunggu: tanggal janji tidak diminta; kurang Rp350.000 dengan potongan menunggu Rp50.000: diminta untuk Rp300.000 |
| U29 | Ubah pembayaran menjalankan ulang | Cash 2.500.000 → 2.850.000: bagian lama Diganti, bagian baru lunas semua; jumlah baris Berlaku per nota tetap 1 |
| U30 | Ubah nominal nota sesudah Terkirim | Raja 850.000 → 900.000 (GM): kurang Raja dari 350.000 menjadi 400.000 |
| U31 | Satu langkah | Potong nota gagal tersimpan (misalnya melebihi nota): kunjungan tidak Terkirim, pembayaran tidak tertulis |
| U32 | Antar sendiri satu angka | Dua nota Raja Rp700.000 dan Rp500.000, uang Rp1.000.000: Rp700.000 lunas, Rp500.000 kurang Rp200.000 |
| U33 | Kirim Besok dan Gagal tanpa uang | Kunjungan Kirim Besok atau Gagal: tidak ada pembayaran dan bagian nota; dikirim langsung dengan uang: ditolak |
| U34 | Ditolak toko lewat potong nota | Gudang Rp2.000.000, Raja Rp850.000; potong Raja Rp850.000 "ditolak toko" disetujui; cash Rp2.000.000: Gudang lunas, tagihan Raja Rp0, tidak ada kurang bayar |
| U35 | Batal satu baris per nota | Kunjungan Gagal berisi 0451 dan 0460, keduanya Batal: dua baris "batalkan penjualan"; pembatalan kasir tertarik dua kali: tetap cocok sekali |
| U36 | Nilai retur per pemilik | Barang Gudang Rp300.000 + Rp150.000, barang Raja Rp80.000: kiriman ke kasir Gudang Rp450.000, Raja Rp80.000 |
| U37 | Nilai menunggu tinjau | Retur dengan satu barang Tidak sesuai belum ditinjau: tombol Sahkan tidak ada; server menolak |
| U38 | Nilai bulat | Rp12.500,5 ditolak; Rp0 tanpa alasan ditolak |
| U39 | Ritase retur | Trip berisi 1 retur yang tidak bisa diambil: 1 ritase per awak (sejalan U11) |
| U40 | Harus diserahkan per trip | Maju cash Rp2.500.000 (Dedi), Sinar Rp1.200.000 (Eko), Jaya transfer Rp800.000: harus diserahkan Rp3.700.000 |
| U41 | Selisih per toko lalu sisa | Hitung Rp3.550.000, Maju benar Rp2.400.000: Maju Tidak Cocok −Rp100.000; kurang serah Rp50.000 atas nama Dedi; Kas Masuk Rp3.600.000 |
| U42 | Pembawa tidak jelas | Kurang serah Rp50.001, dua pembawa: Rp25.001 dan Rp25.000 (sisa rupiah ke pembawa uang terbesar), bertanda |
| U43 | Kas Masuk per nota | Gudang Rp2.000.000 + Raja Rp500.000 cash ke Finance: dua baris Setoran di Finance, cabang Gudang dan Raja |
| U44 | Titipan bukan pendapatan | Tagihan Rp1.000.000, cash Rp1.200.000: Kas Masuk Rp1.000.000 "uang pengiriman" + Rp200.000 "titipan toko" |
| U45 | Tidak Cocok membagi ulang | Transfer Rp2.850.000 dilaporkan, benar Rp2.500.000: pembagian sama dengan U18; kurang Raja Rp350.000 |
| U46 | Deposit Belum masuk | Deposit Rp1.000.000 Belum masuk: bagian Rp0, kurang Rp1.000.000, tidak ada baris Kas Masuk |
| U47 | Batal tidak dobel | Periksa, batal, periksa lagi: satu baris Kas Masuk Berlaku, satu Dibatalkan |
| U48 | Tempo tidak diperiksa | Tempo: tidak tampil di LOG-L58, tidak ada Kas Masuk |
| U49 | Setoran kasir | Setoran Raja Cocok berisi uang antar sendiri Rp1.200.000: satu baris Kas Masuk Laci Raja, tidak dihitung dua kali di Laporan Kasir |
| U50 | Ringkasan dibaca dari bagian_nota | 0451 Rp2.350.000, cash Rp2.000.000, potong Rp100.000: ringkasan cash Rp2.000.000, potongan Rp100.000, sisa Rp250.000; tidak ada angka yang dihitung di luar fungsi bagi uang |
| U51 | Dua nota, dua kasir | Gudang 0451 dan Raja 0112 dalam satu kunjungan: dua ringkasan, kasir Gudang dan kasir Raja |
| U52 | Tidak siap selama potongan Menunggu | Potong Rp100.000 Menunggu: tidak ada ringkasan; Disetujui: ringkasan lahir sekali |
| U53 | Tidak dobel | Pemeriksaan terkirim dua kali karena sinyal: satu ringkasan (kunci sumber + jenis) |
| U54 | Berganti sebelum tercatat | Batal pemeriksaan, lalu Tidak Cocok Rp1.900.000: ringkasan lama Dibatalkan; yang baru Rp1.900.000, sisa Rp350.000, bertanda berubah sejak tampil |
| U55 | Koreksi uang | Tercatat Rp2.000.000, dikoreksi Rp1.900.000: Kas Masuk lama dibatalkan dan baris Rp1.900.000 ditulis; satu baris koreksi ke kasir "Rp2.000.000 → Rp1.900.000, sisa Rp250.000 → Rp350.000" |
| U56 | Koreksi tempat uang | BCA menjadi BRI: Kas Masuk diganti, tidak ada baris ke kasir, sisa tetap |
| U57 | Pencocokan satu arah | Sisa HRIS Rp250.000: kasir Rp450.000 ditandai; kasir Rp250.000 atau Rp0 tidak |
| U58 | Retur per cabang | Nilai Gudang Rp450.000, Raja Rp80.000: dua baris kurangi tagihan, kasir Gudang dan kasir Raja (sejalan U36) |
| U59 | Titipan sesudah diperiksa | Lebih bayar Rp200.000, transfer belum diperiksa: belum ada baris titipan; sesudah Cocok: satu baris |
| U60 | Satu baris bensin | Diberi Rp300.000, struk Rp285.000: satu baris uang keluar Rp285.000, Rp15.000 kembali ke tempat uang asal; tidak ada baris kedua |
| U61 | Struk lebih besar | Diberi Rp300.000, struk Rp320.000: baris Rp320.000; Rp20.000 dibayar ke pengisi dari tempat uang yang sama |
| U62 | Tanpa uang diberikan | Dari Kas Pegangan Rp250.000: satu baris baru. Dibayar orang lain: satu baris belum dipasangkan; memasangkan Catatan Cepat tidak menambah baris |
| U63 | Batal dan catat ulang | Rp258.000 dibatalkan, dicatat ulang Rp285.000: satu baris Berlaku Rp285.000, saldo Kas Pegangan hanya berkurang Rp285.000 |
| U64 | Laporan memakai uang terperiksa | Awak melaporkan Rp2.400.000, Tidak Cocok angka benar Rp2.300.000: terperiksa Rp2.300.000; sebelum diperiksa Rp2.400.000 hanya di "belum diperiksa" |
| U65 | Tanpa piutang | Toko bersisa tagihan Rp250.000: tidak ada angka piutang di Dashboard dan Laporan |
| U66 | Dashboard sama dengan penanda | Angka penanda LOG-L49 menulis 4 tertunda merah: Dashboard menulis 4 dari fungsi baca yang sama |
| U67 | Jumlah antartab sama | Uang terperiksa di Ringkasan = jumlah tab Per trip dan perjalanan = jumlah tab Per cabang pemilik nota, untuk periode dan saringan yang sama |

**Waktu**

| No | Tes | Contoh |
|---|---|---|
| W1 | Tanggal dari server | Catat surat jalan dengan jam handphone salah: tanggal tetap jam server |
| W2 | Surat jalan dari kasir bertanggal transaksi | Transaksi 13 Oktober 21.00, pelanggan dipasangkan 14 Oktober 09.00: surat jalan bertanggal 13 Oktober |
| W3 | Manual tidak cocok setelah 2 hari | Sambungan hidup 14 Oktober; surat jalan manual tanpa pasangan: 16 Oktober 06.00 masuk Perlu Diperiksa |
| W4 | Batal gabung 30 hari | Gabung 1 November 10.00: batal boleh sampai 1 Desember 10.00; sesudahnya tombol hilang |
| W5 | Buka lagi Diambil toko 7 hari | Ditandai 1 November: boleh dibuka sampai 8 November |
| W6 | Tanggal trip | Rencana dibuat 13 Oktober 21.00, Berangkat 14 Oktober 07.30: tanggal trip, ritase, dan absen masuk 14 Oktober |
| W7 | Lapor garasi lewat tengah malam | Berangkat 14 Oktober 15.00, lapor garasi 15 Oktober 00.40: ritase dan hari kerja 14 Oktober (KEH-122) |
| W8 | Trip belum ditutup | Berangkat 14 Oktober, belum lapor: 15 Oktober 12.00 ditandai; 11.59 belum |
| W9 | Pagar menyala sendiri | Dimatikan 10.00 sampai 12.00: lapor garasi 12.03 di luar titik ditolak |
| W10 | Ritase tangan 14 hari | 28 Oktober boleh untuk 14 Oktober; 13 Oktober ditolak |
| W11 | Warna menunggu | Tandai Selesai 08.00: 13.59 kuning, 14.00 oranye, besok 08.00 merah |
| W12 | Tahap 2 menit | Foto 1 10.00.00: Foto 2 10.01.59 ditolak, 10.02.00 diterima (jam server) |
| W13 | Selisih 20 menit | Berangkat 15 menit, kembali 34 menit: tanpa alasan; kembali 35 menit: wajib alasan |
| W14 | Foto galeri 2 menit | Foto galeri berjam 10.00, diunggah 10.02.30: ditolak |
| W15 | Tanda ⚠ | Nota 14 Oktober, Foto 3 belum: 15 Oktober 23.59 ⚠ dipasang; Foto 3 16 Oktober: dicabut |
| W16 | Bonus bertanggal nota | Nota 25 Oktober, pengantar dipasangkan HR 27 Oktober: bonus bertanggal 25 Oktober, periode 26 September – 25 Oktober (bila slip belum ditutup) |
| W17 | Nota kasir 7 hari | Tandai Selesai 20 Oktober: nota 13 Oktober tampil, 12 Oktober tidak |
| W18 | Tempo 60 hari | Kirim 14 Oktober: jatuh tempo 13 Desember boleh, 14 Desember ditolak; 14 Oktober (hari ini) ditolak |
| W19 | Bawaan janji bayar | Kirim 14 Oktober: bawaan 21 Oktober |
| W20 | Ubah oleh awak sampai trip Selesai | Lapor garasi 17.00: driver mengubah 16.59 boleh, 17.01 ditolak (kantor) |
| W21 | Ubah oleh PJ sampai Foto 3 | Foto 3 11.05: PJ mengubah 11.04 boleh, 11.06 ditolak |
| W22 | Barang kembali 3 hari | Diserahkan 14 Oktober 15.00: 17 Oktober 06.00 belum ditandai; 18 Oktober 06.00 ditandai |
| W23 | Jam dari server | Kirim dengan jam handphone salah: jam Kirim, foto, dan pembayaran dari server |
| W24 | Merah lewat 3 hari | Kirim Besok pertama 14 Oktober 10.00: 17 Oktober 06.00 belum merah; 18 Oktober 06.00 merah |
| W25 | Sejak tidak bergeser | Kirim Besok 14, 15, 16 Oktober: sejak 14 Oktober, 3 kali |
| W26 | Coba lagi hanya selama Berjalan | Menuju Garasi 15.00: Coba lagi 14.59 boleh, 15.01 ditolak |
| W27 | Rencana lain ditolak selama truk Berjalan | 0451 Kirim Besok 09.00: masuk rencana lain 10.00 ditolak; sesudah Menuju Garasi 15.00 boleh |
| W28 | Buka lagi Batal 7 hari | Batal 14 Oktober 10.00: dibuka 21 Oktober 09.59 boleh, 10.01 ditolak |
| W29 | Pengingat Perlu keputusan | Gagal 14 Oktober 10.00: pengingat berantai menyala 18 Oktober 06.00 |
| W30 | Jam dari server | Kirim Besok dengan jam handphone salah: jam catatan dan "sejak" dari server |
| W31 | Batas 3 hari | Kirim 14 Oktober 10.00, belum diperiksa: 17 Oktober 06.00 belum ditandai; 18 Oktober 06.00 ditandai |
| W32 | Batas serah tunai | Trip 14 Oktober: belum diserahkan 15 Oktober 11.59 tidak ditandai; 12.00 ditandai |
| W33 | Tanggal Kas Masuk | Kirim 14 Oktober cash, diterima 15 Oktober: Kas Masuk 14 Oktober |
| W34 | Tanggal deposit | Diperiksa 20 Oktober: masuk 13 Oktober boleh; 12 Oktober hanya Pemilik atau GM dengan alasan; 21 Oktober ditolak |
| W35 | Batal oleh Finance 7 hari | Diperiksa 14 Oktober 10.00: Finance batal 21 Oktober 09.59 boleh, 10.01 ditolak (Pemilik, GM) |
| W36 | Janji bayar dari hari pemeriksaan | Tidak Cocok 17 Oktober: bawaan janji bayar 24 Oktober |
| W37 | Tempo siap saat trip Selesai | Trip Selesai 14 Oktober 17.00: ringkasan tempo siap 17.00, tidak sebelumnya |
| W38 | Batas 2 hari | Siap 14 Oktober 10.00: 16 Oktober 06.00 belum ditandai; 17 Oktober 06.00 ditandai |
| W39 | Batal tanda 24 jam | Ditandai 14 Oktober 10.00: penanda membatalkan 15 Oktober 09.59 boleh, 10.01 ditolak (Pemilik, GM) |
| W40 | Tenggang pencocokan | Tercatat 14 Oktober 10.00; tarikan 14 Oktober 11.00 beda: tidak ditandai; tarikan 15 Oktober 11.00 masih beda: ditandai |
| W41 | Bulan ditutup | Kas Masuk 28 September, September ditutup, koreksi 14 Oktober: baris koreksi bertanggal 14 Oktober menunjuk baris September |
| W42 | Janji lewat | Janji 25 Oktober: 25 Oktober 06.00 belum merah; 26 Oktober 06.00 merah bila masih bersisa |
| W43 | File piutang lama | File 7 Oktober: 14 Oktober belum diperingatkan; 15 Oktober diperingatkan |
| W44 | Permintaan bensin merah | Lahir Senin 17.30: Selasa 11.59 belum merah; Selasa 12.00 merah |
| W45 | Permintaan diganti | Senin 17.30 Rp300.000 Menunggu; Selasa 17.40 Rp350.000: yang Senin Diganti, tinggal satu Menunggu |
| W46 | Tanggal isi mundur | Dicatat 14 Oktober: 7 Oktober boleh; 6 Oktober ditolak kecuali pemilik dengan alasan (KEU-12); 15 Oktober ditolak |
| W47 | Batas periode laporan | Periode Oktober = 26 September s.d. 25 Oktober: kiriman 25 Oktober 23.50 masuk Oktober; 26 Oktober 00.10 masuk November |
| W48 | Tinjau 3 hari | Bertanda 14 Oktober 10.00: 17 Oktober 06.00 belum masuk Antrean; 18 Oktober 06.00 masuk |
| W49 | Muat ulang | Tertunda menjadi merah 06.00: Dashboard yang terbuka sejak 05.58 menampilkannya paling lambat 06.01 |
| W50 | Tanggal bebas | 1 Agustus s.d. 31 Oktober boleh (3 bulan); 1 Juli s.d. 31 Oktober ditolak |

**Hak akses**

| No | Tes | Contoh |
|---|---|---|
| H1 | HR membuka Logistik | Tidak ada menu; ditolak server |
| H2 | Marketing mengubah surat jalan yang sudah berangkat | Ditolak server (LOG-11) |
| H3 | Siapa pun mengetik nominal surat jalan bersumber kasir | Ditolak server |
| H4 | Driver membuka toko yang tidak ada di trip-nya | Ditolak server |
| H5 | Driver menyetujui titik yang dipasangnya | Ditolak server |
| H6 | Kepala Gudang membatalkan gabung | Ditolak server (Pemilik, GM) |
| H7 | Hak Akses Jabatan mencoba memberi Marketing "ubah surat jalan sesudah berangkat" | Ditolak (batas keras) |
| H8 | Staf cabang menambah toko sesudah sambungan pelanggan menyala | Ditolak; arahan buat pelanggan di kasir |
| H9 | Finance mengubah data toko | Ditolak server; hanya melihat |
| H10 | Driver mengubah status kunjungan atau trip lewat alamat langsung | Ditolak server (LOG-24) |
| H11 | Driver yang bukan awak menekan Berangkat | Ditolak server |
| H12 | Kenek menekan lapor garasi | Ditolak server; hanya driver |
| H13 | Kepala Gudang mencatat ritase tangan atau membatalkan ritase | Ditolak server |
| H14 | Hak Akses Jabatan mencoba memberi Kepala Gudang "ritase tangan" | Ditolak (batas keras) |
| H15 | Kepala Gudang menutup trip yang ia awaki | Ditolak server |
| H16 | Marketing membuat rencana | Ditolak server (LOG-84) |
| H17 | Siapa pun mengganti awak trip Selesai | Ditolak server (LOG-22) |
| H18 | Staf cabang Markas membuka atau mengubah laporan muat Raja | Ditolak server |
| H19 | Staf cabang mengubah nominal nota sesudah paket diambil | Ditolak server (Pemilik, GM) |
| H20 | Hak Akses Jabatan mencoba memberi Kepala Toko "ubah nota sesudah berangkat" | Ditolak (batas keras) |
| H21 | Karyawan yang bukan pengantar menekan Mulai antar untuk kiriman Rina | Ditolak server |
| H22 | Driver mengambil paket yang dijadwalkan ke trip lain | Ditolak server |
| H23 | Driver mengambil paket dari laporan berjalur antar sendiri | Ditolak server |
| H24 | Siapa pun mengetik ongkir atau pengantar pada nota bersumber kasir | Ditolak server |
| H25 | Kepala Toko menutup perjalanan yang ia PJ-kan | Ditolak server |
| H26 | Modul Logistik menulis nominal bonus sendiri | Tidak ada jalan; hanya pintu tulis Buku Bonus |
| H27 | Marketing atau HR menyetujui potong nota | Ditolak server |
| H28 | Hak Akses Jabatan mencoba memberi Marketing "setujui potong nota" | Ditolak (batas keras) |
| H29 | Finance memutuskan potongan yang ia catat sendiri | Ditolak server |
| H30 | Awak yang tidak memegang kunjungan menekan Simpan Kirim | Ditolak server |
| H31 | Driver mengubah pembayaran sesudah trip Selesai | Ditolak server |
| H32 | Kepala Toko mengubah pembayaran kunjungan truk | Ditolak server (hanya antar sendiri cabangnya) |
| H33 | Siapa pun mengetik bagian uang per nota | Tidak ada jalan; hanya fungsi bagi uang kunjungan |
| H34 | Siapa pun mengubah pembayaran yang sudah diperiksa Finance | Ditolak server |
| H35 | Awak menekan Terima atas barang yang ia serahkan | Ditolak server |
| H36 | Staf cabang Markas menerima barang milik Raja | Ditolak server |
| H37 | Driver menandai retur | Ditolak server |
| H38 | Marketing atau HR mengesahkan nilai retur; Hak Akses Jabatan mencoba memberinya | Ditolak (batas keras) |
| H39 | Staf cabang Markas memutuskan Gagal laporan muat Raja | Ditolak server |
| H40 | Marketing memutuskan Gagal surat jalan | Ditolak server |
| H41 | Penerima atau penyerah meninjau Tidak sesuai atas barang itu | Ditolak server |
| H42 | Kepala Gudang menutup tertunda Perlu keputusan | Ditolak server (harus diputuskan) |
| H43 | Awak trip lain menekan Kirim Besok di kunjungan bukan trip-nya | Ditolak server |
| H44 | Kepala Gudang membuka lagi keputusan Batal | Ditolak server (Pemilik, GM) |
| H45 | Marketing atau HR memeriksa uang; Hak Akses Jabatan mencoba memberinya | Ditolak (batas keras) |
| H46 | GM mengubah pembayaran sesudah trip Selesai, lalu memeriksanya sendiri | Ditolak server (pemeriksa bukan pengubah terakhir) |
| H47 | Driver menerima uang tunai trip-nya sendiri | Ditolak server |
| H48 | PJ menerima uang antar sendiri-nya sendiri | Ditolak server |
| H49 | Staf cabang Markas menerima uang antar sendiri Raja | Ditolak server |
| H50 | Finance membatalkan pemeriksaan Finance lain | Ditolak server (Pemilik, GM) |
| H51 | Siapa pun membatalkan pemeriksaan sesudah tercatat di kasir | Ditolak server; lewat koreksi |
| H52 | Siapa pun mengetik baris Kas Masuk pengiriman | Tidak ada jalan; hanya server |
| H53 | Marketing atau HR menandai tercatat atau mengoreksi; Hak Akses Jabatan mencoba memberinya | Ditolak (batas keras) |
| H54 | Siapa pun mengubah pembayaran, potongan, atau pemeriksaan nota yang sudah tercatat lewat jalan biasa | Ditolak server; hanya lewat koreksi |
| H55 | Finance membatalkan tanda tercatat Finance lain | Ditolak server (Pemilik, GM) |
| H56 | Siapa pun mengetik baris Catat di Kasir | Tidak ada jalan; hanya server dan pintu tulis Keuangan |
| H57 | Marketing mengubah angka piutang di Daftar Tagih | Tidak ada jalan; daftar hanya membaca kasir |
| H58 | Driver membuka Daftar Tagih | Ditolak; driver hanya melihat kotak minta ditagih di kunjungannya |
| H59 | HR membuka Dashboard, Bensin, atau Laporan Logistik | Ditolak server (LOG-84) |
| H60 | Marketing meminta bagian Mobil dan bensin, kurang serah, atau angka bensin di Excel | Tidak tampil; server menolak bila diminta langsung |
| H61 | Finance meminta bagian Pengiriman | Tidak tampil; server menolak (LOG-80) |
| H62 | Driver mencatat Sudah Diisi; Hak Akses Jabatan mencoba memberinya | Ditolak (batas keras) |
| H63 | Kepala Gudang membatalkan catatan bensin yang barisnya sudah diperiksa | Ditolak server (Pemilik, GM) |
| H64 | Pencatat bensin memeriksa baris Buku Kas bensinnya sendiri | Ditolak server (KEU-120) |
| H65 | Kepala Gudang meninjau kirim di luar titik di trip yang ia awaki | Ditolak server |
| H66 | Siapa pun mengubah data lewat Dashboard atau Laporan dengan alamat langsung | Tidak ada jalan; keduanya hanya membaca |
| H67 | Kepala Gudang meminta baris pagar mati | Tidak tampil (Pemilik, GM) |

---

## 13. Pertanyaan dan jawaban

### 4F-1 (ditulis 13 Oktober 2026 malam saat pemilik tidur; jawaban pemilik 14 Oktober 2026: **"ok"**, dibaca setuju saran untuk F1 s.d. F6)

Diketik ulang di percakapan saat pemilik kembali (KER-13, 14). Spec ditulis
memakai saran Claude.

- **F1.** Logistik dipecah lima bagian: 4F-1 Toko, Mobil–Rute, Surat Jalan
  dan Nota; 4F-2 Rencana dan Trip Truk; 4F-3 Laporan Muat, Paket, Antar
  Sendiri; 4F-4 Di Toko (uang, potong nota, kejadian, Kirim Besok, Gagal,
  tertunda, retur); 4F-5 Pemeriksaan Uang, Kiriman ke Kasir, Daftar Tagih,
  Dashboard, Laporan, Bensin.
- **F2.** Sesudah sambungan pelanggan kasir menyala, toko baru **hanya lahir
  dari kasir**; HRIS hanya menambah data pengiriman. Sebelum menyala, staf
  cabang boleh "tambah cepat" dari laporan muat, bertanda belum diperiksa.
- **F3.** Titik toko boleh dipasang driver, kenek, **dan pengantar antar
  sendiri** (pelapis LOG-05 yang hanya menyebut driver), dengan foto depan
  toko dan akurasi GPS ≤ 50 meter; disetujui Kepala Gudang atau pemilik;
  titik salah dilaporkan, bukan diubah driver.
- **F4.** Sesudah sambungan transaksi menyala, **setiap penjualan cabang
  Gudang ke toko** menjadi surat jalan otomatis; penjualan ke cabang sendiri
  tidak. Barang yang diambil sendiri oleh toko ditandai **"Diambil toko"**
  (status baru) oleh Marketing atau Kepala Gudang. Catat manual tetap ada
  sebagai cadangan, dicocokkan lewat nomor struk.
- **F5.** Nominal surat jalan dari kasir tidak bisa diubah di HRIS.
  Perubahan atau pembatalan di kasir: sebelum dijadwalkan langsung berlaku;
  sesudah dijadwalkan atau berangkat masuk Perlu Diperiksa Kepala Gudang
  (Terima atau Biarkan). Batal surat jalan kasir dilakukan di kasir.
- **F6.** Gabung toko oleh Kepala Gudang, Marketing, Pemilik, GM (alasan,
  ditahan 3 detik); **batal gabung** oleh Pemilik atau GM dalam 30 hari.

Bacaan Claude yang tidak ditanyakan karena mengikuti aturan yang ada: nomor
surat jalan = nomor struk + cabang (PRI-41 butir 3); nama dobel dibandingkan
tanpa huruf besar, spasi ganda, dan titik; mobil dan rute di Pengaturan ›
Logistik (M4), tidak dihapus, tidak bisa dinonaktifkan selama dipakai rencana
berjalan; jenis rute tidak bisa diubah sesudah dipakai; nota tidak punya
layar sendiri di 4F-1; data lama tanpa nomor struk dibawa bertanda.

### 4F-2 (ditulis 13 Oktober 2026 malam saat pemilik tidur; jawaban pemilik 14 Oktober 2026: **"ok"**, dibaca setuju saran untuk R1 s.d. R5)

Ditulis sebelum F1 (pembagian) dijawab. Spec memakai saran Claude.

- **R1.** Kirim di luar titik toko **tetap tersimpan**, bertanda untuk
  ditinjau Kepala Gudang; tidak ditolak (sejalan absen luar titik yang tetap
  dihitung).
- **R2.** Satu mobil dan satu orang hanya boleh di **satu trip yang
  Berjalan atau Menuju Garasi**; boleh dipilih di beberapa rencana Draft.
- **R3.** Ritase tangan yang sama tanggal, mobil, dan rute dengan ritase yang
  sudah ada **tidak diblok**, tetapi butuh konfirmasi kedua "Memang dua kali
  jalan" dengan alasan; paling jauh 14 hari ke belakang.
- **R4.** Tugas belanja diisi **supplier + foto nota, tanpa nominal**; nilai
  belanja dicatat Keuangan (KEU-26).
- **R5.** Ritase untuk **awak yang tercatat saat trip Selesai**; yang dicopot
  di tengah jalan lewat ritase tangan bila pantas; berkenek dibaca saat
  Selesai.

Bacaan Claude yang tidak ditanyakan karena mengikuti aturan yang ada: kenek
boleh menekan Berangkat tetapi lapor garasi hanya driver (Laporan Pulang
diisi driver, KEH-100); surat jalan tidak bisa ditambah sesudah berangkat
(LOG-19), tugas belanja dan retur bisa (LOG-22); rencana menggantung hanya
ditandai, tidak dibatalkan otomatis; trip yang masih Berjalan boleh ditutup
kantor dan sisa tokonya menjadi Kirim Besok; hanya pagar titik Gudang yang
boleh dimatikan, paling lama 24 jam.

### 4F-3 (ditulis 14 Oktober 2026; jawaban pemilik 14 Oktober 2026: **"ok"**, dibaca setuju saran untuk M1 s.d. M6)

Diajukan di percakapan dengan maksud, contoh, dan saran (KER-13, 14). Spec
di atas ditulis memakai saran.

- **M1.** Paket masuk trip lewat **dua jalan**: ditugaskan Kepala Gudang di
  rencana, atau diambil driver langsung (pelapis LOG-19 dan 41).
- **M2.** Ambil paket **per laporan muat sekaligus**: semua paket dicentang
  dan satu foto; tidak bisa sebagian (pelapis LOG-41 "satu per satu").
- **M3.** Satu laporan muat = **satu nota cabang** dengan nomor struk kasir
  wajib; sesudah sambungan menyala nota dipilih dari kasir (7 hari, sekali
  pakai). Sesudah paket diambil atau perjalanan berangkat, nota hanya diubah
  Pemilik atau GM dan jalur terkunci (pelapis LOG-39).
- **M4.** Pengantar di kasir menentukan **bonus**, pengantar di HRIS
  menentukan **siapa mengantar**; bila beda, tanda "pengantar beda dengan
  kasir" dan arahan membetulkan di kasir (pelapis LOG-42).
- **M5.** Tanda ⚠ bonus ongkir dipasang bila Foto 3 belum ada sampai 23.59
  hari berikutnya sesudah tanggal nota, dan dicabut sendiri bila Foto 3
  menyusul (perincian LOG-76).
- **M6.** Mulai antar wajib sudah absen masuk; Pulang ditolak selama
  perjalanan berjalan; jalan keluarnya Tutup perjalanan oleh Kepala Toko,
  Kepala Gudang, atau pemilik (pelapis LOG-43, KEH-10).

Bacaan Claude yang tidak ditanyakan karena mengikuti aturan yang ada:
cabang asal harus cabang berjenis toko; Kembalikan ke Proses sebagai jalan
keluar sebelum Batal (WAJ-11); foto laporan muat dan ambil paket memakai
aturan galeri 2 menit yang sama dengan LOG-43; paket bergabung ke kunjungan
toko yang sudah ada (LOG-10); trip berisi paket saja punya ritase (LOG-33);
Foto 2 mencatat jarak dari titik toko tanpa menolak (LOG-99); dua kiriman ke
toko yang sama satu tujuan, uang per nota; Gagal antar sendiri menjadi Perlu
keputusan (LOG-56); Perlu Diperiksa nota cabang milik Kepala Toko cabang asal
atau Kepala Gudang (sejalan LOG-56); ke mana uang tunai antar sendiri dibawa
ditetapkan di 4F-5.

### 4F-4a (ditulis 14 Oktober 2026; jawaban pemilik 14 Oktober 2026: **"ok"**, dibaca setuju saran untuk K1 s.d. K6)

Diajukan di percakapan dengan maksud, contoh, dan saran (KER-13, 14). Spec
di atas ditulis memakai saran.

- **K1.** Kurang bayar yang bukan karena potong nota menunggu wajib diberi
  **tanggal janji bayar sisa** (bawaan 7 hari, paling lama 60 hari); tidak
  ada "Tempo dengan uang muka" (perincian LOG-44, 46).
- **K2.** Titipan toko (lebih bayar) dicatat untuk **cabang pemegang
  uang**: Gudang untuk truk, cabang asal untuk antar sendiri (perincian
  LOG-49).
- **K3.** Barang kembali milik **Gudang** diserahkan saat lapor garasi dan
  tidak menahan Menuju Garasi; milik cabang lain menahan Menuju Garasi;
  antar sendiri diserahkan saat Foto 3. Satu daftar barang kembali untuk
  potong nota, kejadian, dan retur; diterima dengan foto, Sesuai atau Tidak
  sesuai; jalan keluar **Alihkan ke Gudang** (pelapis LOG-54 dan LOG-28).
- **K4.** Ubah pembayaran antar sendiri: PJ sampai Foto 3; sesudahnya
  Kepala Toko cabang asal, Kepala Gudang, pemilik, beralasan (perincian
  LOG-48).
- **K5.** Antar sendiri memakai **satu angka uang per tujuan** yang dibagi
  rumus yang sama dengan truk (pengganti bacaan 4F-3 "uang diketik per
  nota"; pelapis LOG-50).
- **K6.** Barang lebih yang dibeli toko: uangnya menjadi titipan toko, lalu
  cabang pemilik membuat nota di kasir dan memakai titipan itu (perincian
  LOG-53).

Bacaan Claude yang tidak ditanyakan karena mengikuti aturan yang ada: urutan
pembagian dengan nomor nota sebagai pemutus terakhir; Campuran dibagi cash
dulu; foto terkirim truk wajib (kamera langsung) sebagai pasangan Foto 2
antar sendiri; foto bukti transfer kamera atau galeri tanpa batas umur;
lebih bayar memunculkan pertanyaan kedua; Simpan Kirim ditahan 3 detik
(TAM-15); potongan yang diubah sesudah diputuskan kembali Menunggu; tidak
ada yang memutuskan potongan yang ia catat sendiri; retur spontan dari toko
bukan potong nota, tetap lewat tugas retur dari kantor (LOG-58).

### 4F-4b (ditulis 14 Oktober 2026; jawaban pemilik 14 Oktober 2026: **"ok"**, dibaca setuju saran untuk T1 s.d. T7)

Diajukan di percakapan dengan maksud, contoh, dan saran (KER-13, 14). Spec
di atas ditulis memakai saran.

- **T1.** Tertunda dicatat **per kiriman** (surat jalan atau laporan muat)
  dan tertutup sendiri saat kiriman itu terkirim, diambil toko, atau batal;
  kiriman lain toko yang sama tidak ikut tertutup (pelapis kalimat terakhir
  LOG-57).
- **T2.** Barang yang tidak terkirim di jalur truk pulang ke Gudang; paket
  cabang menunggu di Gudang untuk trip berikutnya, tidak diantar balik ke
  cabang kecuali diputuskan Batal atau pindah ke antar sendiri (perincian
  LOG-55).
- **T3.** **Coba lagi** di hari yang sama selama trip masih Berjalan;
  kiriman Kirim Besok tidak bisa masuk rencana lain selama truk pembawanya
  masih Berjalan (perincian LOG-55).
- **T4.** Toko yang menolak satu nota utuh tetapi menerima nota lain:
  Kirim, nota yang ditolak dicatat potong nota senilai nota dengan alasan
  baru "ditolak toko"; Gagal hanya untuk seluruh kunjungan (perincian
  LOG-51, 56).
- **T5.** Batal sesudah Gagal langsung berlaku di HRIS dan melahirkan baris
  "batalkan penjualan di kasir" untuk Finance; pembatalan dari kasir
  dicocokkan sendiri (pengecualian LOG-96).
- **T6.** Nilai retur diisi Finance **per barang** sesudah barang diterima
  dan ditinjau, memakai jumlah yang benar-benar diterima; Rp0 boleh dengan
  alasan (perincian LOG-60).
- **T7.** Tinjau "Tidak sesuai" oleh Kepala Gudang atau pemilik:
  menetapkan jumlah sebenarnya dan boleh meneruskan selisih ke HR sebagai
  usulan kehilangan barang; Logistik tidak memotong gaji (perincian
  LOG-61).

Bacaan Claude yang tidak ditanyakan karena mengikuti aturan yang ada:
Kirim Besok dan Gagal wajib foto kamera langsung dan mencatat lokasi tanpa
menolak (sejalan LOG-99); tombolnya tidak ditahan 3 detik karena tidak
menyangkut uang; Dilepas kantor bukan tertunda; Selesai lebih awal dan
tutup kantor melepas retur yang belum dikerjakan ke Menunggu ditugaskan;
tutup tertunda manual hanya untuk Menunggu jadwal; retur hanya lewat trip
truk; tombol "Toko mau retur" hanya memberi tahu kantor; trip yang membawa
retur tetap punya ritase walau retur tidak bisa diambil (LOG-33); menu
"Terima Retur" menjadi "Barang Kembali" (layar LOG-L44 yang sama).

### 4F-5a (ditulis 14 Oktober 2026; jawaban pemilik 14 Oktober 2026: **"ok"**, dibaca setuju saran untuk V1 s.d. V5)

Diajukan di percakapan dengan maksud, contoh, dan saran (KER-13, 14). Spec
di atas ditulis memakai saran.

- **V1.** Uang tunai truk diserahkan **per trip** kepada Finance (masuk
  Setoran di Finance) atau pemegang Brankas (masuk Brankas); penerimaan itu
  sekaligus pemeriksaannya. Paling lambat 12.00 hari berikutnya; tidak
  menahan lapor garasi.
- **V2.** Uang tunai antar sendiri diserahkan ke **laci cabang asal**,
  diterima teman yang bertugas (bukan PJ), ikut setoran Laporan Kasir, dan
  ikut Cocok saat Finance menerima setoran itu.
- **V3.** Selisih uang tunai dijelaskan per toko dulu; sisanya menjadi
  **kurang serah** atas nama pembawa, ditandai untuk Pemilik dan GM, dan
  diteruskan ke HR sebagai bahan Potongan Lain. Tagihan toko tidak berubah
  untuk sisa itu.
- **V4.** Deposit ditunggu paling lama batas pemeriksaan 3 hari; yang
  belum masuk menjadi sisa tagihan dengan janji bayar 7 hari, dan uang yang
  datang sesudahnya dicatat sebagai pelunasan di kasir.
- **V5.** Finance boleh membatalkan pemeriksaannya sendiri dalam 7 hari;
  Pemilik dan GM sampai nota tercatat di kasir (pengecualian sempit KEU-16).

Bacaan Claude yang tidak ditanyakan karena mengikuti aturan yang ada:
pembayaran terkunci begitu satu bagian diperiksa (LOG-116); Tidak Cocok
menulis pembayaran baru dan menjalankan LOG-112, kekurangannya diberi
janji bayar 7 hari dari hari pemeriksaan; pemeriksa bukan pengubah terakhir
pembayaran (KEU-120); transfer boleh Cocok sekaligus per rekening dengan
tombol ditahan 3 detik (KEU-14); Kas Masuk satu baris per nota per tempat
uang, cabang pemilik nota; lebih bayar menjadi baris "titipan toko", bukan
pendapatan; tempo tidak diperiksa; Kepala Gudang hanya melihat tab Tunai
trip; menu tetap di Logistik (M5).

### 4F-5b (ditulis 14 Oktober 2026; jawaban pemilik 14 Oktober 2026: **"ok"**, dibaca setuju saran untuk D1 s.d. D7)

Diajukan di percakapan dengan maksud, contoh, dan saran (KER-13, 14). Spec
di atas ditulis memakai saran.

- **D1.** Catat di Kasir berisi **satu ringkasan per nota** yang lahir saat
  nota siap (terkirim, uangnya sudah diperiksa, tidak ada potongan
  menunggu); ditambah baris titipan toko, retur, batalkan penjualan, dan
  koreksi. Menunggu lebih dari 2 hari ditandai (perincian LOG-65).
- **D2.** **Satu daftar** untuk semua yang dicatat tangan di kasir,
  termasuk titipan pelunasan (KEU-46) dan pembayaran toko ke Gudang
  (KEU-69) yang ditulis Keuangan lewat pintu tulis.
- **D3.** Koreksi sesudah tercatat oleh Finance, Pemilik, atau GM,
  beralasan, **langsung berlaku tanpa persetujuan**; Pemilik dan GM diberi
  tahu, dan yang mengurangi uang masuk masuk perlu perhatian (perincian
  LOG-14).
- **D4.** Pencocokan otomatis dengan piutang kasir: hanya **kasir menagih
  lebih besar** daripada sisa menurut HRIS, 1 hari sesudah tercatat, masuk
  Perlu Diperiksa Finance.
- **D5.** Daftar Tagih dibaca dari kasir, ditambah keterangan HRIS (janji
  bayar, uang sudah di HRIS belum tercatat di kasir); **sebelum sambungan
  piutang menyala, Finance mengunggah file piutang** dari laporan kasir.
- **D6.** Marketing mencatat **hasil tagih** (janji bayar, tidak bisa
  dihubungi, tagih saat kirim berikutnya, sengketa); tidak mengubah kasir.
  Tagihan lama yang dibayar ke driver menjadi titipan toko.
- **D7.** Pertanyaan keadaan: apakah sekarang pembayaran yang diterima
  driver juga diketik di kasir? Saran: apa pun jawabannya, Buku Piutang
  sistem lama tidak dibawa; bila belum diketik, piutang kasir dibereskan
  sekali sebelum hari mulai (titipan Tahap 5).

**Jawaban "ok"** dibaca setuju semua saran. D7 adalah pertanyaan keadaan
yang belum terjawab sebagai fakta; sarannya berlaku apa pun jawabannya, dan
keadaannya dipastikan di Tahap 5 sebelum titik awal piutang diambil.

Bacaan Claude yang tidak ditanyakan karena mengikuti aturan yang ada:
tempat mencatat = kasir cabang penerbit nota (LOG-97); ringkasan ikut
berubah selama belum tercatat; nota Diambil toko tidak punya ringkasan;
tanda tercatat ditahan 3 detik dan boleh sekaligus per kasir cabang
(KEU-14); kunci nota mencakup pembayaran, potongan, pemeriksaan, dan nilai
retur (LOG-14, 48, 52, 124, 132); salah tandai dibatalkan penanda dalam 24
jam atau Pemilik dan GM (WAJ-11); koreksi tempat uang tidak mengirim baris
ke kasir; koreksi atas bulan tertutup masuk bulan berjalan (KEU-112);
koreksi tidak memotong gaji (GAJ-80); menu bertambah Catat di Kasir dan
Daftar Tagih di Logistik (M5); pertanyaan kedua lebih bayar di layar Kirim
menyebut "membayar tagihan lama".

### 4F-5c (ditulis 14 Oktober 2026; jawaban pemilik 14 Oktober 2026: **"ok"**, dibaca setuju saran untuk B1 s.d. B6)

Diajukan di percakapan dengan maksud, contoh, dan saran (KER-13, 14). Spec
di atas ditulis memakai saran.

- **B1.** Isi Dashboard empat bagian (Berjalan sekarang, Pengiriman, Uang,
  Mobil dan bensin) memuat semua tanda yang di 4F-1 s.d. 4F-5b diarahkan
  ke Dashboard, ditambah keadaan mobil Perlu perhatian dan uang bensin
  belum berstruk. Finance melihat Uang **serta bensin** (pelapis LOG-80);
  Marketing tanpa bensin dan tanpa kurang serah; pagar mati hanya Pemilik
  dan GM.
- **B2.** Kirim di luar titik toko ditinjau Kepala Gudang: Wajar, Titik
  toko mungkin salah (Laporkan titik salah), atau Tidak wajar (Pemilik dan
  GM diberi tahu; tanpa potongan otomatis). Belum ditinjau 3 hari masuk
  Antrean.
- **B3.** Pertanyaan keadaan: selama ini uang bensin truk dari mana dan
  siapa yang memberi? Saran: Sudah Diisi menyediakan tiga asal uang (uang
  yang sudah diberikan dulu, tempat uang pencatat, dibayar orang lain
  dulu), sehingga cara mana pun tetap menjadi satu baris Buku Kas.
- **B4.** Satu permintaan bensin Menunggu per mobil (yang baru mengganti
  yang lama); wajib ditutup Sudah Diisi atau Tidak jadi; merah lewat 12.00
  hari berikutnya; tidak ditutup otomatis.
- **B5.** Laporan Logistik memakai tanggal kirim (bukan tanggal uang),
  periode 26–25 atau tanggal bebas paling panjang 3 bulan, enam tab;
  Marketing tanpa angka bensin.
- **B6.** Baris bensin diperiksa di Pemeriksaan Keuangan seperti baris
  yang diketik; struk hilang boleh dicatat "struk tidak ada" dengan alasan,
  ditandai untuk Pemilik dan GM.

**Jawaban "ok"** dibaca setuju semua saran.

**B3 dijawab sebagai fakta (14 Oktober 2026):** selama ini uang bensin
dititipkan ke pom bensin dengan batas pemakaian sebulan. Claude menyebut
tabrakannya (LOG-144 menganggap uang keluar tiap kali isi; LOG-83 dan
KEU-26 satu baris per isi; KEU-64 uang muka tidak dipakai) dan menawarkan
saldo titipan di pom bensin. **Keputusan pemilik: tidak usah, biarkan
saja.** Di v3 bensin dianggap dibayar lewat catatan Finance: tiap pengisian
dicatat dengan Sudah Diisi (LOG-144) dan menjadi satu baris uang keluar;
uang yang dititipkan ke pom bensin **tidak** dicatat lagi sebagai uang
keluar terpisah, supaya tidak dobel. Tidak ada saldo titipan pom bensin,
batas bulanan, atau pencocokan rekap pom bensin. Jangan tanyakan ulang.

Bacaan Claude yang tidak ditanyakan karena mengikuti aturan yang ada:
Dashboard hanya membaca tanda dari fungsi baca pemiliknya dan tidak punya
tombol pengubah (LOG-82, WAJ-04); muat ulang tiap 1 menit (sistem lama 20
detik, cukup untuk pantauan); tanpa piutang, laba, dan uang masuk di
Dashboard (LOG-81, KEU-98); Kepala Toko dan staf cabang memakai Beranda;
foto struk wajib sejak awal (KEU-11); tanggal isi paling jauh 7 hari ke
belakang (KEU-12); kejadian Buku Kas "Bensin atau solar" dengan kendaraan
(KEU-19, 123) dibebankan ke cabang Gudang; batal catatan bensin sesudah
diperiksa hanya Pemilik dan GM (KEU-16); peninjau bukan awak (sejalan
KEU-120); unduhan dibuat server dan tercatat (KEU-116); 13 tanda bensin
sistem lama tidak dibawa; laporan menghitung ritase sebagai banyaknya,
rupiahnya di 4G; HR tidak membuka ketiga layar (LOG-84). Liter bensin dan
kilometer tidak dicatat (tidak diminta, dan foto struk sudah menyimpan
liternya).

---

## 14. Daftar periksa (peta jalan Tahap 4)

### Bagian 4F-1

- [x] Tidak melanggar WAJ-01 s.d. 12 (data toko dan penjualan milik kasir,
      HRIS hanya menambah data pengiriman, WAJ-03; tidak ada nama cabang di
      aturan, Gudang dari jenis cabang, WAJ-05; tidak ada yang dihapus;
      setiap tindakan punya jalan keluar, termasuk batal gabung).
- [x] Setiap layar memenuhi TAM-01 s.d. 25 (langkah bertahap, gabung dan ubah
      nominal sesudah berangkat ditahan 3 detik, pesan menyebut siapa
      bertindak berikutnya, foto kamera langsung).
- [x] Data memenuhi PRI-01 s.d. 41 (jam server, kunci nomor struk + cabang,
      pencocokan dan daftar periksa PRI-41, mesin berpenjaga).
- [x] Aturan baru bernomor (LOG-90 s.d. 97, bagian 3.18 `04-logistik.md`,
      disetujui 14 Oktober 2026).
- [x] Kejadian 1 s.d. 26, jalan keluar, tes U1 s.d. U5, W1 s.d. W5, H1 s.d.
      H9.
- [x] Tiap layar menyebut ukuran utamanya, beda jabatan dicatat. Bentuk yang
      belum ada komponennya: pemasang titik dengan peta dan akurasi (dipakai
      bersama titik cabang KAR-L30), tabel dua kolom pembanding saat gabung,
      dan tabel pasangan mobil × rute bertanda tarif.
- [x] Disetujui pemilik 14 Oktober 2026 (F1 s.d. F6 sesuai saran).

### Bagian 4F-2

- [x] Tidak melanggar WAJ-01 s.d. 12 (absen trip dan Laporan Pulang tetap
      milik Kehadiran, nominal ritase milik 4G, WAJ-03; ritase satu kali
      dengan kunci; tidak ada nama rute atau mobil di aturan; setiap langkah
      trip punya jalan keluar, termasuk tutup oleh kantor).
- [x] Setiap layar memenuhi TAM-01 s.d. 25 (satu layar satu tugas di HP,
      foto langsung tersimpan, tombol dikunci 1 detik, tutup trip dan selesai
      lebih awal ditahan 3 detik, pesan menyebut akibat ke absen dan ritase).
- [x] Data memenuhi PRI-01 s.d. 41 (jam server, satu pintu per status,
      tidak ada yang dihapus, mesin berpenjaga, pagar berbatas waktu).
- [x] Aturan baru bernomor (LOG-98 s.d. 104, bagian 3.19 `04-logistik.md`,
      disetujui 14 Oktober 2026).
- [x] Kejadian 27 s.d. 49, jalan keluar, tes U6 s.d. U11, W6 s.d. W10, H10
      s.d. H17.
- [x] Tiap layar menyebut ukuran utamanya. Bentuk yang belum ada
      komponennya: kartu trip dengan kemajuan "4 dari 9 toko" dan daftar
      kunjungan yang bisa dipegang satu awak, langkah lapor garasi bertahap
      dengan pemeriksaan titik, dan tabel pasangan mobil × rute (dari 4F-1).
- [x] Disetujui pemilik 14 Oktober 2026 (F1, R1 s.d. R5 sesuai saran).

### Bagian 4F-3

- [x] Tidak melanggar WAJ-01 s.d. 12 (ongkir dan pengantar milik kasir,
      nominal bonus milik pintu tulis Gaji, absen milik Kehadiran, WAJ-03
      dan 04; cabang asal dari jenis cabang, WAJ-05; tidak ada yang dihapus;
      setiap langkah punya jalan keluar, termasuk Kembalikan ke Proses dan
      Tutup perjalanan).
- [x] Setiap layar memenuhi TAM-01 s.d. 25 (satu layar satu tugas di HP,
      foto langsung tersimpan, jenis foto ditetapkan TAM-08, jam foto dari
      server TAM-09, ubah nominal sesudah berangkat dan tutup perjalanan
      ditahan 3 detik).
- [x] Data memenuhi PRI-01 s.d. 41 (jam server, nomor struk + cabang untuk
      nota cabang, pencocokan dan Perlu Diperiksa PRI-41, kunci asal bonus,
      mesin berpenjaga).
- [x] Aturan baru bernomor (LOG-105 s.d. 111, bagian 3.20 `04-logistik.md`,
      disetujui 14 Oktober 2026).
- [x] Kejadian 50 s.d. 82, jalan keluar, tes U12 s.d. U17, W11 s.d. W17,
      H18 s.d. H26.
- [x] Tiap layar menyebut ukuran utamanya. Bentuk yang belum ada
      komponennya: foto paket berdampingan dengan kotak centang (ambil
      paket), dan kartu perjalanan bertahap Foto 1–2–3 dengan hitungan lama.
- [x] Disetujui pemilik 14 Oktober 2026 (M1 s.d. M6 sesuai saran).

### Bagian 4F-4a

- [x] Tidak melanggar WAJ-01 s.d. 12 (piutang dan titipan milik kasir,
      HRIS hanya mengirim daftar, WAJ-03; satu fungsi pembagian, WAJ-04;
      pemilik barang dari cabang pemilik nota, Gudang dari jenis cabang,
      WAJ-05; tidak ada yang dihapus; tiap langkah punya jalan keluar,
      termasuk Alihkan ke Gudang).
- [x] Setiap layar memenuhi TAM-01 s.d. 25 (Kirim bertahap, Simpan Kirim,
      ubah pembayaran, dan keputusan potong nota ditahan 3 detik dengan
      akibat dalam angka; jenis foto ditetapkan TAM-08).
- [x] Data memenuhi PRI-01 s.d. 41 (jam server, rupiah bulat, satu
      pembayaran Berlaku per kunjungan, bagian lama Diganti, mesin
      berpenjaga).
- [x] Aturan baru bernomor (LOG-112 s.d. 118, bagian 3.21 `04-logistik.md`,
      disetujui 14 Oktober 2026).
- [x] Kejadian 83 s.d. 112, jalan keluar, tes U18 s.d. U32, W18 s.d. W23,
      H27 s.d. H36.
- [x] Tiap layar menyebut ukuran utamanya. Bentuk yang belum ada
      komponennya: daftar tagihan per nota dengan pembagian sementara di
      layar Kirim, dan isian daftar barang berulang (potong nota, kejadian)
      dengan jumlah per pemilik.
- [x] Disetujui pemilik 14 Oktober 2026 (K1 s.d. K6 sesuai saran).

### Bagian 4F-4b

- [x] Tidak melanggar WAJ-01 s.d. 12 (penjualan dan piutang milik kasir,
      HRIS hanya menulis baris kiriman ke kasir, WAJ-03; kehilangan barang
      diputuskan Gaji, WAJ-03; tidak ada nama cabang di aturan, Gudang dari
      jenis cabang, WAJ-05; tidak ada yang dihapus; tiap langkah punya jalan
      keluar, termasuk Coba lagi, buka lagi Batal, dan buka lagi tertunda;
      pengecualian LOG-96 ditandai jenisnya, WAJ-12).
- [x] Setiap layar memenuhi TAM-01 s.d. 25 (dua langkah dengan akibat
      dalam kalimat; Batal dan Sahkan nilai ditahan 3 detik karena
      menyangkut tagihan; Kirim Besok dan Gagal tidak, karena tanpa uang;
      jenis foto ditetapkan TAM-08).
- [x] Data memenuhi PRI-01 s.d. 41 (jam server, satu tertunda terbuka per
      kiriman, nilai rupiah bulat, pembatalan dari kasir dicocokkan dengan
      kunci, mesin berpenjaga).
- [x] Aturan baru bernomor (LOG-119 s.d. 126, bagian 3.22 `04-logistik.md`,
      disetujui 14 Oktober 2026).
- [x] Kejadian 113 s.d. 138, jalan keluar, tes U33 s.d. U39, W24 s.d. W30,
      H37 s.d. H44.
- [x] Tiap layar menyebut ukuran utamanya. Bentuk yang belum ada
      komponennya: dua foto berdampingan untuk tinjau (serah dan terima),
      dan isian daftar barang berulang dengan jumlah dan satuan (memakai
      bentuk daftar barang 4F-4a).
- [x] Disetujui pemilik 14 Oktober 2026 (T1 s.d. T7 sesuai saran).

### Bagian 4F-5a

- [x] Tidak melanggar WAJ-01 s.d. 12 (Buku Kas milik Keuangan, Logistik
      hanya memanggil pintu tulisnya, WAJ-03; satu fungsi pembagian dan
      satu penulis Kas Masuk, WAJ-04; penerima dari daftar tempat uang,
      bukan nama jabatan, WAJ-05; tidak ada yang dihapus; tiap langkah
      punya jalan keluar, termasuk batal pemeriksaan; pengecualian KEU-16
      ditandai jenisnya, WAJ-12).
- [x] Setiap layar memenuhi TAM-01 s.d. 25 (Terima, Periksa, Cocok
      sekaligus, dan Batal ditahan 3 detik dengan akibat dalam angka; satu
      layar satu tugas).
- [x] Data memenuhi PRI-01 s.d. 41 (jam dan tanggal server, rupiah bulat,
      satu pemeriksaan Berlaku per bagian, riwayat tidak dihapus, mesin
      berpenjaga).
- [x] Aturan baru bernomor (LOG-127 s.d. 132, bagian 3.23 `04-logistik.md`,
      disetujui 14 Oktober 2026).
- [x] Kejadian 139 s.d. 160, jalan keluar, tes U40 s.d. U49, W31 s.d. W36,
      H45 s.d. H52.
- [x] Tiap layar menyebut ukuran utamanya. Bentuk yang belum ada
      komponennya: rincian uang per toko dan per pembawa dengan isian
      penjelasan selisih (LOG-L59).
- [x] Disetujui pemilik 14 Oktober 2026 (V1 s.d. V5 sesuai saran).

### Bagian 4F-5b

- [x] Tidak melanggar WAJ-01 s.d. 12 (piutang milik kasir dan hanya dibaca,
      HRIS tidak menulis ke kasir, WAJ-03 dan PRI-39; satu daftar dengan
      pintu tulis untuk Keuangan; ringkasan dibaca dari fungsi bagi uang,
      WAJ-04; kasir cabang dari nota, bukan nama cabang, WAJ-05; tidak ada
      yang dihapus; setiap langkah punya jalan keluar, termasuk batal tanda
      dan koreksi).
- [x] Setiap layar memenuhi TAM-01 s.d. 25 (tanda tercatat, tandai
      sekaligus, batal tanda, dan koreksi ditahan 3 detik dengan akibat
      dalam angka; catatan tagih tombol biasa; satu layar satu tugas).
- [x] Data memenuhi PRI-01 s.d. 41 (jam server, satu baris berlaku per
      sumber + jenis, pencocokan dan Perlu Diperiksa PRI-41, data kasir
      terakhir masuk ditampilkan, mesin berpenjaga).
- [x] Aturan baru bernomor (LOG-133 s.d. 139, bagian 3.24
      `04-logistik.md`, disetujui 14 Oktober 2026).
- [x] Kejadian 161 s.d. 182, jalan keluar, tes U50 s.d. U59, W37 s.d. W43,
      H53 s.d. H58.
- [x] Tiap layar menyebut ukuran utamanya. Bentuk yang belum ada
      komponennya: baris "yang diketik di kasir" bernomor dalam satu kartu
      (LOG-L65), dan daftar per toko dengan keterangan HRIS di samping
      angka kasir (LOG-L68, L69).
- [x] Disetujui pemilik 14 Oktober 2026 (D1 s.d. D7 sesuai saran). D7
      (apakah pembayaran driver selama ini diketik di kasir) terjawab di
      Tahap 5A (14 Oktober 2026): uang driver diterima Finance, dicek, lalu
      diketik ke kasir.

### Bagian 4F-5c

- [x] Tidak melanggar WAJ-01 s.d. 12 (Dashboard dan Laporan hanya
      membaca, WAJ-04 dan LOG-82; satu baris Buku Kas per bensin lewat
      pintu tulis Keuangan, WAJ-03; hak dari daftar hak, bukan nama
      jabatan, WAJ-05; tidak ada yang dihapus; setiap langkah punya jalan
      keluar, termasuk batal catatan bensin dan tinjau ulang).
- [x] Setiap layar memenuhi TAM-01 s.d. 25 (Sudah Diisi dan batal catatan
      ditahan 3 detik dengan akibat dalam angka; Tidak jadi dan tinjau
      tombol biasa; satu layar satu tugas).
- [x] Data memenuhi PRI-01 s.d. 41 (jam server; satu permintaan Menunggu
      per mobil; satu tinjau Berlaku per catatan; daftar per halaman dan
      hanya 5 baris terlama per baris Dashboard; data kasir terakhir masuk
      ditampilkan; mesin berpenjaga; unduhan besar di belakang).
- [x] Aturan baru bernomor (LOG-140 s.d. 145, bagian 3.25
      `04-logistik.md`, disetujui 14 Oktober 2026).
- [x] Kejadian 183 s.d. 204, jalan keluar, tes U60 s.d. U67, W44 s.d. W50,
      H59 s.d. H67.
- [x] Tiap layar menyebut ukuran utamanya. Bentuk yang belum ada
      komponennya: kartu trip berjalan dengan progres toko, baris ringkas
      "jumlah · terlama · Buka" (LOG-L71), dan kotak angka ringkasan
      laporan (LOG-L77).
- [x] Disetujui pemilik 14 Oktober 2026 (B1 s.d. B6 sesuai saran). B3
      dijawab: uang dititipkan ke pom bensin; pemilik memutuskan tetap
      dicatat Finance per pengisian (bagian 13).
