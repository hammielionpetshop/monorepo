# Spec Siap Bangun: Gaji Driver, Bongkaran, dan Kasbon (Tahap 4G)

Tanggal: 14 Oktober 2026
Status per bagian:

| Bagian | Isi | Status |
|---|---|---|
| **4G-1** | Tarif dan Ritase: Daftar Jenis Upah, tarif per mobil dan rute, menilai ritase dan upah belanja menjadi rupiah, ritase Rp0, penilaian ulang, batal ritase | **Disetujui penuh 14 Oktober 2026** (U1 s.d. U5 sesuai saran, DRV-86 s.d. 92, 5 layar DRV-L01 s.d. L05) |
| **4G-2** | Slip Mingguan dan Denda: jadwal minggu upah, isi dan penahan slip mingguan, langkah tutup dan bayar, denda driver dan kenek, kartu Upah Minggu Ini | **Disetujui penuh 14 Oktober 2026** (S1 s.d. S4 sesuai saran, DRV-93 s.d. 100, 5 layar DRV-L06 s.d. L10) |
| **4G-3a** | Laporan Bongkaran: membuat laporan, barang dan berat per satuan, Barang lain, hitungan kg dan upah, peserta dan pekerja lepas, laporan terlambat, purchase order, tarif bongkaran (DRV-31 s.d. 46) | **Disetujui penuh 14 Oktober 2026** (L1 s.d. L7 sesuai saran, DRV-101 s.d. 110, 6 layar DRV-L11 s.d. L16) |
| **4G-3b** | Bayar Bongkaran: langkah bayar, tanggal uang, diserahkan kepada, jatuh bayar dan pengingat, Tanyakan dulu, koreksi dan batal sebelum dan sesudah dibayar, bayar susulan, lebih bayar, batal bayar, laporan per orang (DRV-47 s.d. 53) | **Disetujui penuh 14 Oktober 2026** (B1 s.d. B6 sesuai saran, DRV-111 s.d. 120, 6 layar DRV-L17 s.d. L22) |
| **4G-4a** | Kasbon, mengajukan sampai uang diberikan: syarat dan urutan periksa, mengajukan dan mengisikan atas nama, pemeriksaan Finance, keputusan Pemilik atau GM, menyerahkan uang, "Uang belum saya terima", batal sebelum diberikan, batal serah uang, tanda 2 hari (DRV-54 s.d. 64) | **Disetujui penuh 14 Oktober 2026** (K1 s.d. K7 sesuai saran, DRV-121 s.d. 130, 9 layar DRV-L23 s.d. L31) |
| **4G-4b** | Kasbon, cicilan sampai lunas: sisa kasbon, memasang jadwal, cicilan di slip, tunda, ubah jadwal, pelunasan tunai, hapus utang dan pembatalannya, orang berhenti, ganti slip utama, membuat Kasbon Khusus, kasbon bawaan, Kasbon Berjalan (DRV-65 s.d. 79) | **Disetujui penuh 14 Oktober 2026** (C1 s.d. C7 sesuai saran, DRV-131 s.d. 142, 8 layar DRV-L32 s.d. L39) |

**Pembagian enam bagian disetujui pemilik 14 Oktober 2026** ("ok"). 4G
ukuran **besar**: 84 aturan DRV untuk tiga urusan yang berbeda (upah trip,
upah bongkar, pinjaman). Urutannya mengikuti ketergantungan: rupiah tiap
ritase (4G-1) dipakai slip mingguan (4G-2); penyerahan uang kasbon (4G-4a)
dipakai jadwal cicilan (4G-4b).

Spec ini satu file untuk seluruh 4G. Tiap bagian **menambah baris** ke tabel
di bagian 2, 4 s.d. 13 dan memberi tanda bagiannya di kolom "Bagian".
Bagian 3 (rincian layar) ditulis per sub-bagian.

Bentuk spec mengikuti bagian 0 `2026-10-13-karyawan-dan-akses-spec.md`. Kode
layar memakai awalan **DRV-L**. Tampilan disusun dari komponen baku
(`../desain/README.md`); tidak digambar.

Bahan 4G-1: `../../aturan/05-gaji-driver-kasbon.md` DRV-01 s.d. 18, 82 s.d.
85; LOG-17, 18, 21, 33 s.d. 36 dan spec Logistik (LOG-L07, L13, L23, L24,
tabel `mobil`, `rute`, `ritase`, `tugas_belanja`); spec Gaji (tabel
`buku_upah`, `periode`, `slip`, urutan potongan GAJ-75, halaman periode
GAJ-L28, Bonus Bebas GAJ-L22, Potongan Lain GAJ-L16); KEH-31, 45, 46, 79,
81, 105, 133; KAR-62, 67, 83; PRI-02, 04, 24, 29, 33, 34, 35; WAJ-04, 05, 07;
arsip `../../aturan/arsip/05-gaji-driver-kasbon-galian.md` bagian 5A dan 5E.

Bahan 4G-3a: DRV-31 s.d. 46, 51, 82 s.d. 85; arsip bagian 5B; spec Tarik
Data Kasir (TDK-L01, L03, tabel `kasir_produk`, `kasir_po`, T8); KEU-18, 23,
25, 57; KAR-61 dan KAR-L28 (pekerja lepas); KEH-81 (status hari); PRI-01, 02,
16, 23, 24, 28, 29, 34, 35, 37; WAJ-03, 04, 05, 07.

Bahan 4G-3b: DRV-47 s.d. 53, 82, 83, 85, 101, 102, 108; arsip bagian 5B;
spec Gaji 4E-5b (langkah bayar, Jadwal Bayar GAJ-L33, batal bayar GAJ-L35)
dan 4E-5c (Pendapatan Saya GAJ-L39, Total Diterima per Orang); GAJ-45, 56,
99, 103, 104, 114; KEU-05, 11, 12, 16, 18, 23, 25, 112, 116; PRI-01, 02, 04,
11, 23, 24, 37; TAM-07, 15, 22, 25; WAJ-03, 04, 11.

Bahan 4G-4a: DRV-04, 54 s.d. 64, 72, 75, 76, 78, 79, 82, 83, 85; arsip
bagian 5C (temuan, jawaban pemilik, pertentangan P, butir Q s.d. Y); Mesin
Pengajuan 4B (PRI-23, 37, 40; BER-L04 s.d. L07, L20, L21, L42); langkah
bayar 4E-5b dan 4G-3b sebagai contoh penyerahan uang; GAJ-99, 103; KEU-05,
11, 12, 18, 22, 23, 25, 28, 32, 56, 112; SIS-24, 28; KAR-67, 71, 77; PRI-01,
02, 24, 28; TAM-07, 15, 22, 25; WAJ-03, 04, 05, 07, 11.

Bahan 4G-4b: DRV-04 s.d. 06, 24, 57, 65 s.d. 79, 82, 83, 85, 121, 125,
126, 128; arsip bagian 5C (temuan DRV-C36, kejadian 5C.6, jawaban 5C.9,
butir X) dan 5E.1 butir 8; spec Gaji 4E-3 (urutan potongan GAJ-75, R14,
`sisa_potongan`, slip terakhir GAJ-82) dan 4E-5a (langkah tutup butir 7 s.d.
9, buka kembali GAJ-95, slip terakhir GAJ-96); KEU-22, 25, 74, 112; SIS-28;
PRI-02, 04, 23, 24, 37; TAM-07, 15; WAJ-03, 04, 07, 10, 11.

---

## 1. Batas

**Dikerjakan (4G-1):** Daftar Jenis Upah; tarif ritase dan upah belanja per
pasangan mobil dan rute beserta riwayat dan pengumumannya; fungsi server yang
memberi rupiah pada setiap baris ritase dan upah belanja dan menulisnya ke
Buku Upah; aturan Rp0 (rute tanpa upah kenek, orang berslip utama bulanan);
penilaian ulang saat status hari, tarif, atau ritase berubah; akibat batal
ritase ke upah; daftar Upah Ritase untuk HR, Pemilik, dan GM.

**Dikerjakan (4G-2):** jadwal satu minggu upah (tutup Jumat, bayar Sabtu);
kapan slip mingguan lahir; isi pendapatan dan potongannya lewat fungsi
hitung slip yang sama; penahan khas (Belum bertarif); perincian langkah
tutup dan bayar untuk minggu upah; jenis denda, mengajukan, mengesahkan,
keberatan, membatalkan, dan meniadakan denda driver dan kenek; kartu "Upah
Minggu Ini" di Beranda.

**Dikerjakan (4G-3a):** Laporan Bongkaran dari dibuat sampai **Berlaku**
(siap dibayar): supplier, tanggal kerja, barang dari daftar produk kasir,
berat per satuan dan riwayatnya, Barang lain, hitungan total kg dan total
upah, peserta dan pekerja lepas, pembagian rata, baris Buku Upah per
peserta, foto surat jalan, laporan serupa, laporan terlambat, bentuk
sambungan purchase order, dan tarif bongkaran.

**Dikerjakan (4G-3b):** laporan dari **Berlaku sampai Dibayar** dan
sesudahnya: langkah bayar oleh Finance, tanggal uang, kepada siapa uang
diserahkan, jatuh bayar dan pengingat, "Tanyakan dulu", laporan peserta
"Uang belum saya terima", koreksi dan batal sebelum dibayar, koreksi dan
batal sesudah dibayar, bayar susulan, lebih bayar dan penyelesaiannya, batal
bayar, dan laporan bongkaran per orang.

**Dikerjakan (4G-4a):** kasbon biasa dari **diajukan sampai uangnya
diberikan**: syarat dan urutan periksa (masa kerja, batas orang, Dana
Kasbon), mengajukan sendiri dan diisikan HR atas nama, pemeriksaan Finance
dan usulannya, keputusan Pemilik atau GM (nominal akhir dan kali potong),
menyerahkan uang sebagai langkah tersendiri, laporan "Uang belum saya
terima", menarik pengajuan, membatalkan sebelum uang diberikan, batal serah
uang untuk salah catat, serta tanda 2 hari dan pengingatnya. Langkah serah
uang ditulis umum, sehingga dipakai juga oleh Kasbon Khusus (DRV-76).

**Dikerjakan (4G-4b):** kasbon dari **uang diberikan sampai lunas** (atau
dialihkan ke Piutang Lain): satu fungsi sisa kasbon, memasang slip tujuan
tiap cicilan dan versi jadwal, cicilan dibaca dan ditandai slip, tunda
cicilan, ubah jadwal oleh Pemilik atau GM, pelunasan tunai, hapus utang,
pembatalan keduanya, orang yang berhenti, minggu dan bulan pergantian slip
utama, membuat Kasbon Khusus, bentuk kasbon bawaan sistem lama, daftar
Kasbon Berjalan, dan sisi karyawannya.

**Tidak dikerjakan di spec ini:**

| Hal | Di mana |
|---|---|
| Kapan ritase dan upah belanja tercatat, ritase tangan, tombol batal ritase | Logistik 4F-2 (LOG-33 s.d. 36, LOG-L23, L24). Spec ini hanya memberi rupiahnya |
| Mobil dan rute (nama, jenis, aktif) | Logistik 4F-1 (LOG-L07) |
| Status hari seseorang (libur, hari tutup, izin, sakit, cuti, alpha) | Kehadiran (KEH-81); dibaca lewat fungsinya |
| Tabel `buku_upah`, `slip`, `periode`, mesin slip, urutan potongan | Gaji 4E. Spec ini hanya menulis baris Buku Upah jenis ritase dan upah belanja |
| Slip mingguan (tutup, bayar, keberatan, tampilan portal), denda driver dan kenek | 4G-2 (bagian 3.2) |
| Mesin slip umum: fungsi hitung slip, penahan, langkah tutup, buka kembali, langkah bayar, batal bayar, Jadwal Bayar, Daftar Transfer, Pendapatan Saya, keberatan slip | Gaji 4E-5a/5b/5c. 4G-2 hanya menulis perinciannya untuk minggu upah |
| Fungsi hitung slip, urutan potongan, tabel `sisa_potongan`, langkah tutup dan buka kembali slip yang memanggil "tandai cicilan" dan "balik tanda" | Gaji 4E-3, 4E-5a. 4G-4b hanya menyediakan fungsi kasbonnya |
| Buku Piutang Lain (cicilan dan penghapusan sesudah orangnya berhenti); baris Buku Kas uang masuk "Pelunasan kasbon" dan biaya "Utang kasbon dihapus" | Keuangan 4H (KEU-25, 74). 4G-4b hanya memanggil fungsinya |
| Perubahan jabatan (yang mengganti slip utama) dan tanggal berhenti | Karyawan 4A. 4G-4b hanya membacanya |
| Baris Buku Kas upah bongkaran, layar memasangkan Catatan Cepat ke laporan, penolakan ketikan "Upah bongkaran", bulan tertutup | Keuangan 4H (KEU-18, 23, 25, 112). 4G-3b hanya memanggil fungsinya |
| Jadwal Bayar dan Pendapatan Saya (layarnya) | Gaji 4E-5b, 4E-5c (GAJ-L33, L39). 4G-3b mengisi baris dan status bongkarannya |
| Daftar supplier (isi, gabung, nama lain) | Keuangan 4H (KEU-57). Spec ini hanya memakai tindakan "tambah supplier belum diperiksa" |
| Daftar produk dan purchase order dari kasir (unggah, sambungan) | Tarik Data Kasir 4C (TDK-L01, L03). Spec ini hanya membaca `kasir_produk` dan `kasir_po` |
| Orang berstatus Freelance (daftar, ubah, nonaktif) | Karyawan 4A (KAR-L28). Spec ini memakai tindakan "tambah pekerja lepas" |
| Pengisian sisa kasbon bawaan sistem lama (diketik Finance, disahkan GM atau Owner) | Tahap 5 (SIS-28); 4G-4a menghitungnya di batas dan dana, 4G-4b menetapkan bentuk barisnya |
| Cara kerja Papan Perubahan Aturan | 4B (BER); spec ini hanya memakainya saat tarif berubah |
| 23 tarif sistem lama sebagai tarif awal | Tahap 5 (SIS-23 s.d. 33); bentuk isiannya di bagian 4 |

---

## 2. Daftar layar

| Kode | Layar | Letak di menu | Dipakai | Ukuran utama | Bagian |
|---|---|---|---|---|---|
| DRV-L01 | Jenis Upah | Pengaturan › Gaji Driver | Pemilik, GM, HR (baca) | PC | 4G-1 |
| DRV-L02 | Tarif Ritase | Pengaturan › Gaji Driver; tautan dari tab Pasangan LOG-L07 | Pemilik, GM mengubah; HR, Kepala Gudang melihat | PC | 4G-1 |
| DRV-L03 | Tarif Baru (4 langkah) | dari DRV-L02 | Pemilik, GM | PC | 4G-1 |
| DRV-L04 | Betulkan Salah Ketik Tarif (3 langkah) | dari DRV-L02 | Pemilik, GM | PC | 4G-1 |
| DRV-L05 | Upah Ritase | Kantor › Gaji › Periode Slip, halaman satu minggu upah, tab "Upah Ritase" | HR, Pemilik, GM | PC | 4G-1 |

| DRV-L06 | Denda Driver dan Kenek | Kantor › Gaji › Denda Driver & Kenek | Pemilik, GM; Kepala Gudang (usulannya); HR (lihat) | PC; Kepala Gudang juga HP | 4G-2 |
| DRV-L07 | Ajukan Denda (4 langkah) | dari DRV-L06 | Kepala Gudang, Pemilik, GM | HP dan PC | 4G-2 |
| DRV-L08 | Putuskan Usulan Denda | isi khas BER-L21, dari Persetujuan dan DRV-L06 | Pemilik, GM | PC, HP | 4G-2 |
| DRV-L09 | Jenis Denda | Pengaturan › Gaji Driver | Pemilik, GM mengubah; HR, Kepala Gudang melihat | PC | 4G-2 |
| DRV-L10 | Kartu "Upah Minggu Ini" | Beranda | Orang yang punya slip mingguan | HP | 4G-2 |

| DRV-L11 | Laporan Bongkaran (daftar) | menu tugas Kepala Gudang › Laporan Bongkaran; Kantor › Gaji › Bongkaran | Kepala Gudang, Finance, Pemilik, GM | HP (Kepala Gudang); PC (kantor) | 4G-3a |
| DRV-L12 | Laporan Bongkaran Baru (5 langkah) | dari DRV-L11 | Kepala Gudang, Pemilik, GM | HP | 4G-3a |
| DRV-L13 | Rincian Laporan Bongkaran | dari DRV-L11 | Kepala Gudang, Finance, Pemilik, GM | HP dan PC | 4G-3a |
| DRV-L14 | Berat per Satuan | dari DRV-L11; Pengaturan › Gaji Driver | Kepala Gudang mengubah; Pemilik, GM mengubah dan menandai; Finance melihat | PC (terbaca di HP) | 4G-3a |
| DRV-L15 | Barang Lain | Kantor › Gaji › Bongkaran, tab "Barang lain" | Pemilik, GM; Kepala Gudang (baca) | PC | 4G-3a |
| DRV-L16 | Putuskan Laporan Bongkaran Terlambat | isi khas BER-L21, dari Persetujuan dan DRV-L11 | Pemilik, GM | PC, HP | 4G-3a |

| DRV-L17 | Bayar Bongkaran (3 langkah) | dari DRV-L11, L13, dan Jadwal Bayar GAJ-L33 | Finance, Pemilik, GM | PC; bisa dipakai di HP | 4G-3b |
| DRV-L18 | Koreksi Laporan Bongkaran (3 langkah) | dari DRV-L13 | Kepala Gudang (sebelum dibayar); Pemilik, GM | HP dan PC | 4G-3b |
| DRV-L19 | Batalkan Laporan Bongkaran (2 langkah) | dari DRV-L13 | Kepala Gudang (sebelum dibayar); Pemilik, GM | HP dan PC | 4G-3b |
| DRV-L20 | Batal Bayar Bongkaran (3 langkah) | dari DRV-L13 | Pemilik, GM | PC | 4G-3b |
| DRV-L21 | Lebih Bayar Bongkaran | Kantor › Gaji › Bongkaran, tab "Lebih bayar" | Pemilik, GM; Finance (terima pengembalian); Kepala Gudang (baca) | PC | 4G-3b |
| DRV-L22 | Bongkaran per Orang | Kantor › Gaji › Bongkaran, tab "Per orang" | Pemilik, GM, Finance, Kepala Gudang | PC | 4G-3b |

| DRV-L23 | Kasbon Saya | Saya › Kasbon Saya | Semua karyawan yang punya akun | HP | 4G-4a |
| DRV-L24 | Ajukan Kasbon (3 langkah) | isi khas BER-L06; dari Pengajuan Saya (BER-L05) dan DRV-L23 | Semua karyawan yang punya akun | HP | 4G-4a |
| DRV-L25 | Isikan Kasbon atas Nama (4 langkah) | dari DRV-L26 | HR, Admin HR, Pemilik, GM (bukan untuk dirinya) | PC | 4G-4a |
| DRV-L26 | Kasbon (daftar kantor) | Kantor › Gaji › Kasbon | Finance, Pemilik, GM; HR (lihat) | PC; terbaca di HP | 4G-4a |
| DRV-L27 | Periksa dan Putuskan Kasbon | isi khas BER-L21, dari Persetujuan dan DRV-L26 | Finance (memeriksa); Pemilik, GM (memutuskan) | PC, HP | 4G-4a |
| DRV-L28 | Rincian Kasbon | dari DRV-L26 | Finance, Pemilik, GM; HR (lihat) | PC, HP | 4G-4a |
| DRV-L29 | Serahkan Uang Kasbon (3 langkah) | dari DRV-L26 dan L28 | Finance, Pemilik, GM | PC; bisa dipakai di HP | 4G-4a |
| DRV-L30 | Batalkan Kasbon (2 langkah) | dari DRV-L28 | Pemilik, GM | PC, HP | 4G-4a |
| DRV-L31 | Batal Serah Uang Kasbon (3 langkah) | dari DRV-L28 | Pemilik, GM | PC | 4G-4a |

| DRV-L32 | Minta Tunda Cicilan (2 langkah) | isi khas BER-L06; dari DRV-L23 (HR: dari DRV-L28) | Pemilik kasbon; HR, Admin HR atas nama | HP | 4G-4b |
| DRV-L33 | Putuskan Tunda Cicilan | isi khas BER-L21, dari Persetujuan dan DRV-L38 | Pemilik, GM (bukan miliknya) | PC, HP | 4G-4b |
| DRV-L34 | Terima Pelunasan Kasbon (3 langkah) | dari DRV-L28 dan DRV-L38 | Finance, Pemilik, GM (bukan penerima kasbon itu) | PC; bisa dipakai di HP | 4G-4b |
| DRV-L35 | Hapus Utang Kasbon (3 langkah) | dari DRV-L28 | Pemilik, GM (bukan miliknya) | PC | 4G-4b |
| DRV-L36 | Ubah Jadwal Cicilan (3 langkah) | dari DRV-L28 dan DRV-L38 | Pemilik, GM (bukan miliknya) | PC | 4G-4b |
| DRV-L37 | Buat Kasbon Khusus (4 langkah) | tombol di DRV-L26 | Pemilik, GM (bukan untuk dirinya) | PC; bisa dipakai di HP | 4G-4b |
| DRV-L38 | Kasbon Berjalan | tab Berjalan dan Selesai di DRV-L26 | Pemilik, GM; Finance dan HR (tanpa sisa dana) | PC; terbaca di HP | 4G-4b |
| DRV-L39 | Batalkan Pelunasan atau Hapus Utang (2 langkah) | dari DRV-L28 | Pemilik, GM | PC | 4G-4b |

Jumlah 4G-1: 5 layar. Jumlah 4G-2: 5 layar. Jumlah 4G-3a: 6 layar (tarif
bongkaran tidak punya layar sendiri: satu angka di kerangka Pengaturan 4B,
BER-L41). Slip mingguan sendiri memakai
layar Gaji yang sudah ada (GAJ-L08, L28 s.d. L43); tidak ada layar slip
kedua.

Jumlah 4G-3b: 6 layar. 4G-3b juga menambah tombol dan tab di DRV-L11
dan L13, dan mengisi kartu bongkaran di Pendapatan Saya (GAJ-L39); peserta
tidak mendapat layar baru.

Jumlah 4G-4a: 9 layar. Pengaturan kasbon tidak punya layar
sendiri: angkanya di kerangka Pengaturan 4B (BER-L41). Tab "Berjalan" dan
"Selesai" di DRV-L26 diisi 4G-4b.

Jumlah 4G-4b: 8 layar. 4G-4b juga menambah bagian cicilan, mutasi,
dan tombol di DRV-L23 dan L28. Cicilan di slip tampil di layar slip Gaji
(GAJ-L29, L40); tidak ada layar slip baru.

---

## 3. Rincian layar

Aturan untuk semua layar di bawah, tidak diulang per layar: error di jendela
"OK, paham" (TAM-01 s.d. 06); tombol menyimpan terkunci sampai selesai
(TAM-13); isian tidak hilang kalau sinyal putus (TAM-16); pesan berhasil
menyebut apa yang tersimpan dan siapa bertindak berikutnya (TAM-17); daftar
dibagi per halaman dan bisa dicari (PRI-10); semua jam dari server (PRI-01);
konfirmasi yang menyangkut uang ditahan 3 detik (TAM-15).

### 3.1 Bagian 4G-1: Tarif dan Ritase

**Disetujui penuh 14 Oktober 2026** (U1 s.d. U5 "ok", sesuai saran; bagian 13; aturan
DRV-86 s.d. 92 di bagian 3.17 `../../aturan/05-gaji-driver-kasbon.md`).

**Pokoknya:** Logistik mencatat **siapa** jalan dan **kapan** (baris
`ritase`). Bagian ini memberi **rupiahnya**, sekali, di satu fungsi server,
dan menyimpannya di Buku Upah. Setelah itu angka tidak dihitung ulang,
kecuali salah satu dari empat hal yang mendasarinya berubah (status hari,
salah ketik tarif, batal ritase, tarif yang belum ada); perubahan itu
ditangani satu mesin penilai ulang, bukan diketik orang.

Pelajaran sistem lama (arsip 5A): tarif tanpa tanggal berlaku dan bisa
dihapus; tarif diubah pemilik, HR, dan finance; ritase kenek Rp0 tidak
tampil; 86 ritase dibayarkan ke orang bergaji bulanan di hari ia masuk
kerja; hitungan minggu ditulis lima kali.

#### Daftar Jenis Upah (DRV-01 s.d. 03; U1)

- Enam jenis isi awal DRV-02 disimpan sebagai data: Gaji tetap, Lembur dan
  kompensasi libur, Bonus, Ritase driver dan kenek, Upah belanja, Bongkaran.
  Tiap jenis: satuan, sumber tarif, modul pencatat, jalur bayar (slip
  bulanan, slip mingguan, tunai hari itu), berlaku dari.
- **Layar baca saja (U1).** Tiap jenis upah hanya bermakna kalau ada modul
  yang melahirkan barisnya (DRV-01: tidak ada baris yang diketik bebas).
  Jenis baru berarti pekerjaan pembangunan (modul asal, layar, tes), jadi
  ditambah lewat backlog dan rilis, bukan tombol. Jadwal bayar tetap diubah
  lewat pengaturan (DRV-19, 85), bukan di layar ini.
- Kode jenis dipakai mesin (misalnya `ritase`, `upah_belanja`); nama tampil
  boleh berbeda. Tidak ada nama orang, cabang, atau jabatan di daftar ini
  (WAJ-05).

#### Tarif ritase dan upah belanja (DRV-08, 10 s.d. 13; U3, U4)

- **Satu baris tarif** = pasangan mobil dan rute + berlaku dari + tiga
  angka: **driver dengan kenek**, **driver tanpa kenek**, **kenek**. Rupiah
  bulat, boleh Rp0, tidak boleh minus (PRI-28). Rute jenis belanja memakai
  bentuk yang sama; angka itulah upah belanja (DRV-11).
- **Tarif yang berlaku pada tanggal T** = baris Berlaku pasangan itu dengan
  berlaku dari ≤ T yang paling akhir. Satu fungsi server "tarif (mobil,
  rute, tanggal)" dipakai penilai ritase, pemeriksa Siap Kirim (LOG-21),
  ritase tangan, LOG-L07, dan DRV-L02 (WAJ-04).
- **Tarif tidak dihapus** (DRV-12). Baris yang belum berlaku boleh
  dibatalkan (pengumumannya ikut ditarik). Baris yang sudah berlaku hanya
  digantikan baris baru, atau dibetulkan bila salah ketik (U4).
- **Perubahan tarif mengikuti Papan Perubahan Aturan** (PRI-29, 35; aturan
  yang sudah ada, tidak ditanyakan ulang): tidak berlaku mundur; jarak
  terbit ke berlaku paling sedikit **1 hari** bila ketiga angka sama atau
  naik, dan **7 hari** bila salah satu angka turun. Server menentukan jarak
  itu sendiri dari perbandingan angka lama dan baru. Sasaran pengumuman
  diusulkan sistem: driver dan kenek, ditambah orang yang dalam 3 bulan
  terakhir punya ritase di pasangan itu.
- **Pasangan baru (U3):** pasangan mobil dan rute yang **belum pernah**
  bertarif boleh diberi tarif **berlaku hari ini**. Tidak ada aturan lama
  yang berubah, dan tanpa tarif rencana tidak bisa Siap Kirim (LOG-21).
  Pengumumannya tetap dibuat (terbit hari ini, bisa ditandai "tidak perlu
  diumumkan" dengan alasan, PRI-35 butir 2). Pengecualian atas PRI-35 butir
  4, khusus tarif pertama sebuah pasangan.
- **Hak:** hanya Pemilik dan GM mengubah (DRV-13). HR dan Kepala Gudang
  melihat tarif. Finance tidak membuka layar tarif (DRV-82).

#### Menilai ritase menjadi rupiah (DRV-09, 10, 11, 14, 16, 17, 84)

Satu fungsi server **"nilai ritase (baris ritase)"** (WAJ-04). Dijalankan
oleh mesin **Penilai ritase** (bagian 6) begitu baris `ritase` berstatus
Berlaku lahir, yaitu saat trip Selesai atau ritase tangan disimpan. Langkahnya:

1. **Tanggal** = tanggal ritase (tanggal trip, LOG-35), bukan tanggal trip
   ditutup.
2. **Pasangan:** untuk ritase, mobil dan rute trip. Untuk upah belanja,
   mobil trip dan **rute belanja tugas itu** (LOG-34).
3. **Tarif** = fungsi "tarif (mobil, rute, tanggal)". Tidak ada → langkah
   "belum bertarif" (di bawah).
4. **Angka per peran:** driver di trip berkenek → "dengan kenek"; driver di
   trip tanpa kenek → "tanpa kenek"; kenek → "kenek". Berkenek dibaca dari
   baris ritase (ditentukan saat Selesai, LOG U10).
5. **Orang berslip utama bulanan** (DRV-04, dibaca dari pengaturan
   jabatannya pada tanggal itu, KAR-62): server membaca **status hari** orang
   itu pada tanggal itu dari fungsi Kehadiran (KEH-81).
   - Libur terjadwal, libur pengganti (KEH-46), atau hari tutup cabangnya
     (KEH-79) → angka tarif penuh.
   - Hari kerja (hadir, atau jabatan yang tidak diabsen seperti GM, KAR-67)
     → **Rp0**, keterangan "hari kerja, sudah dibayar gaji".
   - Izin, sakit, cuti, alpha → **Rp0**, keterangan "bukan hari libur", dan
     **tanda Perlu dilihat** (U5).
   Orang berslip utama mingguan (driver, kenek) tidak diperiksa status
   harinya: upahnya per ritase (DRV-18).
6. **Rp0 dari tarif** (angka kenek Rp0) → baris Rp0 berketerangan "rute
   tanpa upah kenek" (DRV-10, 17). Kalau dua sebab Rp0 berlaku bersamaan,
   keterangan hari dipakai (sebab yang lebih penting bagi HR).
7. **Tulis satu baris Buku Upah** (DRV-01, 84): orang, jenis (`ritase` atau
   `upah_belanja`), tanggal kejadian, periode = **minggu upah** tanggal itu
   (fungsi periode, PRI-34), banyaknya 1, satuan trip atau tugas, tarif
   (angka yang dipakai), nominal, cabang (Gudang, dari pengaturan cabang
   pembebanan Logistik), asal (`ritase` + nomor), nomor baris tarif yang
   dipakai, keterangan, status hari yang dibaca (untuk orang berslip utama
   bulanan). **Kunci: asal + status Berlaku**, sehingga satu ritase tidak
   pernah punya dua baris upah yang berlaku.
8. **Slip tujuan:** baris masuk slip mingguan orang itu untuk minggu upah
   tanggalnya. Bila slip itu sudah Ditutup (trip Kamis malam baru Selesai
   Jumat sesudah slip ditutup), baris masuk slip minggu berikutnya dengan
   keterangan "tanggal asal …" (DRV-22). Ritase tidak pernah masuk slip
   bulanan (DRV-16); untuk orang berslip utama bulanan slip mingguannya
   adalah slip di luar slip utama yang dibayar utuh (DRV-05).

**Belum bertarif (pagar terakhir).** Dengan pemeriksaan Siap Kirim dan
ritase tangan (di bawah) keadaan ini seharusnya tidak terjadi. Kalau tetap
terjadi (misalnya tugas belanja ditambahkan sesudah Siap Kirim ke pasangan
yang belum bertarif), server menulis baris Buku Upah **Rp0 berstatus
"Belum bertarif"**, memasukkan "perlu perhatian" Pemilik dan GM (antrean),
dan **slip mingguan orang itu tertahan** sampai tarif diisi (penahan slip
mingguan, dirinci di 4G-2). Begitu tarif pasangan itu diisi, Penilai ulang
menilai baris itu lagi. Tidak ada angka cadangan di kode.

**Pemeriksaan tarif di Logistik (perincian LOG-21, 36):**

- **Siap Kirim** memeriksa tarif untuk **pasangan trip dan pasangan tiap
  tugas belanja** pada hari itu. Pesan menyebut pasangan yang kurang dan
  siapa yang bisa mengisinya.
- **Menambah tugas belanja** ke trip yang sudah Siap Kirim atau Berjalan
  ditolak bila pasangannya belum bertarif hari itu.
- **Ritase tangan** (LOG-L23) ditolak bila pasangan belum bertarif pada
  tanggal yang dipilih: "Mobil L300 Putih dan rute Selatan belum punya tarif
  pada 3 November. Isi tarif dulu di Pengaturan › Gaji Driver."

#### Penilaian ulang (DRV-15, 16; U2, U4)

Empat hal bisa mengubah rupiah ritase yang sudah dinilai. Semuanya
ditangani mesin **Penilai ulang** (bagian 6) dengan satu cara:

| Pemicu | Contoh | Aturan |
|---|---|---|
| Status hari orang berslip utama bulanan berubah | Libur Rina digeser kepala cabang dari Sabtu ke Selasa (KEH-45); hari tutup dipasang mundur (KEH-105); izin sakit disetujui menyusul | U2 |
| Baris tarif dibetulkan karena salah ketik | Kenek tertulis Rp400.000, seharusnya Rp40.000 | U4 |
| Ritase dibatalkan Pemilik atau GM | Ritase dobel atau salah orang | DRV-15 |
| Tarif pasangan baru diisi untuk baris "Belum bertarif" | Lihat di atas | — |

**Caranya:** server menjalankan "nilai ritase" lagi dengan keadaan baru.
Hasil sama → tidak ada yang ditulis. Hasil berbeda:

- **Slip mingguan tujuannya belum Ditutup:** baris Buku Upah lama menjadi
  Dibatalkan ("dinilai ulang: …"), baris baru ditulis. Perkiraan slip
  langsung ikut berubah.
- **Slip mingguan tujuannya sudah Ditutup:** baris lama tetap (sudah
  terkunci di slip). Server menulis **baris koreksi** sebesar selisihnya,
  bertaut ke baris lama ("koreksi atas baris nomor …", tanggal asal):
  - **Selisih plus** → baris Buku Upah koreksi masuk **slip mingguan
    berikutnya** orang itu (jalur bayar ritase, DRV-03). Bila orang itu
    tidak punya ritase minggu itu, slip mingguan dibuat untuknya hanya
    berisi koreksi itu.
  - **Selisih minus** → menjadi **potongan "koreksi upah ritase"**
    kelompok (a) di **slip utama** orang itu yang berikutnya (GAJ-75;
    DRV-04: semua potongan hanya dari slip utama). Untuk driver dan kenek
    itu slip mingguan berikutnya; untuk staf berslip utama bulanan itu slip
    bulanan berikutnya. Yang tidak tertampung menjadi sisa potongan seperti
    potongan lain (GAJ-52, DRV-24); orang yang berhenti mengikuti GAJ-82.
- Orangnya **diberi tahu** dengan kalimat sebabnya ("Ritase 7 November
  dinilai ulang karena hari itu menjadi hari kerja: Rp40.000 → Rp0.
  Dipotong di slip berikutnya."). Pemilik dan GM melihat semua penilaian
  ulang di DRV-L05 tab "Dinilai ulang".
- **Batas:** penilaian ulang karena status hari hanya terjadi selama
  Kehadiran masih menerima perubahan untuk tanggal itu (KEH-105; sesudah
  slip bulanan ditutup, perubahan Kehadiran sendiri sudah menjadi koreksi
  susulan, GAJ-72). Mesin tidak punya batas sendiri; ia mengikuti perubahan
  yang memang terjadi.

#### Salah ketik tarif (U4)

- **Betulkan salah ketik** (DRV-L04): hanya Pemilik dan GM, alasan wajib.
  Membetulkan **angka** baris tarif yang sudah berlaku; berlaku dari dan
  pasangannya tidak berubah. Baris lama berstatus Dibetulkan (tetap
  tersimpan), baris betulan menggantikannya mulai tanggal yang sama.
- **Hanya selama** belum ada slip mingguan yang **Dibayar** dan memuat
  ritase yang dinilai dengan baris itu. Sesudah ada yang dibayar, jalan
  keluarnya: tarif baru ke depan (lewat Papan), dan kekurangan dibayar
  lewat **Bonus Bebas** (GAJ-L22) atau kelebihan ditagih lewat **Potongan
  Lain** (GAJ-L16), masing-masing dengan alasan.
- Layar menampilkan **akibatnya dalam angka** sebelum disimpan: berapa
  ritase dinilai ulang, siapa saja, selisih per orang, dan mana yang masuk
  slip berikutnya sebagai koreksi.
- Pembetulan **bukan perubahan aturan**, jadi tidak lewat Papan; orang yang
  terkena diberi tahu langsung (pemberitahuan penilaian ulang di atas).
  Sejalan dengan asal "pembetulan" pada gaji (4E-5c).

#### Batal ritase (DRV-15)

- Tombolnya di Logistik (LOG-L24; Pemilik, GM, alasan wajib). Begitu baris
  `ritase` menjadi Dibatalkan, Penilai ulang menilai baris upahnya menjadi
  Rp0 dengan cara di atas: sebelum slip ditutup baris upah ikut Dibatalkan;
  sesudah ditutup lahir potongan "koreksi upah ritase" di slip utama
  berikutnya.
- Layar batal di LOG-L24 menampilkan akibat uangnya ("Upah Rp70.000 sudah
  di slip Dedi minggu 30 Okt – 5 Nov yang sudah Ditutup; akan dipotong di
  slip berikutnya").

#### Ritase di hari izin, sakit, cuti, atau alpha (DRV-16; U5)

- Baris Rp0 "bukan hari libur" mendapat **tanda Perlu dilihat**. Tanda ini
  **tidak menyangkut uang** (upahnya sudah Rp0) dan **tidak menahan slip**.
  Gunanya: orang yang tercatat sakit atau izin tetapi ikut trip patut
  ditanya, karena salah satu catatannya mungkin keliru.
- Tampil di tab **Perlu dilihat** DRV-L05 dan di Beranda HR (bukan antrean).
  HR, Pemilik, atau GM menutupnya dengan **Sudah dilihat** dan catatan
  pilihan. Kalau ternyata status harinya salah, pembetulannya di Kehadiran
  (izin dibatalkan, libur dipindah); Penilai ulang mengikuti sendiri.
- Tanda ikut padam sendiri bila penilaian ulang mengubah sebabnya.

#### DRV-L01. Jenis Upah

- **Letak:** Pengaturan › Gaji Driver. **PC.**
- **Isi:** tabel enam jenis: nama, dihitung per, jalur bayar, modul yang
  mencatat, aturan, berlaku dari. Di bawahnya kalimat: "Jenis upah baru
  ditambah lewat pembangunan sistem, bukan dari layar ini."
- **Tombol:** tidak ada (U1). Tautan ke pengaturan jadwal bayar (DRV-85).
- **Beda jabatan:** HR melihat; Pemilik dan GM melihat.

#### DRV-L02. Tarif Ritase

- **Letak:** Pengaturan › Gaji Driver; tautan "Isi tarif" dari tab
  Pasangan LOG-L07 langsung membuka pasangan itu. **PC.**
- **Kepala:** jumlah pasangan aktif, berapa yang **belum ada tarif**
  (merah), berapa yang punya tarif terjadwal.
- **Isi:** tabel satu baris per pasangan mobil × rute yang keduanya aktif:
  mobil, rute, jenis rute, tiga angka yang berlaku hari ini, berlaku dari,
  tanda **"belum ada tarif"** atau **"berubah mulai …"** (tarif terjadwal).
  Pasangan dengan mobil atau rute nonaktif ada di saringan "Nonaktif".
- **Buka satu pasangan:** riwayat semua baris tarifnya (berlaku dari, tiga
  angka, oleh, kapan, alasan, status: Berlaku, Terjadwal, Dibatalkan,
  Dibetulkan) dan tautan ke pengumumannya di Papan.
- **Saring:** mobil, rute, jenis rute, belum ada tarif.
- **Tombol (Pemilik, GM):** **Tarif baru** (DRV-L03); per baris riwayat
  yang Terjadwal **Batalkan** (alasan, pengumuman ikut ditarik); per baris
  yang Berlaku **Betulkan salah ketik** (DRV-L04).
- **Beda jabatan:** HR dan Kepala Gudang melihat tanpa tombol.

#### DRV-L03. Tarif Baru (4 langkah, TAM-07)

1. **Pasangan:** pilih mobil dan rute (aktif). Bila datang dari LOG-L07
   sudah terisi. Tampil tarif yang berlaku sekarang, atau "belum pernah
   bertarif".
2. **Angka:** tiga isian (driver dengan kenek, driver tanpa kenek, kenek),
   bawaan dari tarif sekarang. Di sebelahnya beda dengan tarif sekarang
   (naik, turun, sama). Kenek Rp0 boleh, dengan kalimat "Kenek tidak
   diupah di pasangan ini" (DRV-10).
3. **Berlaku dari dan pengumuman:** tanggal paling cepat dihitung server:
   hari ini untuk pasangan baru (U3); besok bila semua angka sama atau naik;
   7 hari lagi bila ada yang turun (PRI-35). Draf pengumuman disiapkan
   sistem ("sebelumnya, sekarang, mulai berlaku", sasaran diusulkan) dan
   boleh disunting; atau "tidak perlu diumumkan" dengan alasan.
4. **Periksa:** ringkasan dalam kalimat ("Mulai Jumat 13 November, L300
   Putih ke Utara: driver dengan kenek Rp70.000 → Rp75.000; kenek tetap
   Rp40.000. Pengumuman terbit hari ini ke 9 orang."). Tombol ditahan 3
   detik.

#### DRV-L04. Betulkan Salah Ketik Tarif (3 langkah)

1. **Angka betulan:** tiga isian, bawaan angka yang salah.
2. **Akibat:** daftar ritase yang dinilai ulang (orang, tanggal, lama →
   baru), jumlah selisih per orang, mana yang langsung berubah di perkiraan
   dan mana yang menjadi koreksi di slip berikutnya. Bila ada slip mingguan
   Dibayar yang memuat ritase itu, langkah ini berhenti dengan kalimat jalan
   keluarnya (tarif baru, Bonus Bebas, Potongan Lain; U4).
3. **Alasan dan simpan:** alasan wajib; tombol ditahan 3 detik. Pesan:
   "Tarif dibetulkan. 6 ritase dinilai ulang; Dedi dan Eko diberi tahu."

#### DRV-L05. Upah Ritase

- **Letak:** tab "Upah Ritase" di halaman satu minggu upah (GAJ-L28 untuk
  periode jenis minggu upah). **PC.**
- **Tab di dalamnya:**
  - **Semua:** satu baris per baris Buku Upah jenis ritase dan upah
    belanja minggu itu: tanggal, orang, peran, mobil, rute, berkenek, jenis,
    nominal, keterangan (sebab Rp0, tanggal asal), trip, status. Jumlah per
    orang di kepala tiap kelompok.
  - **Perlu dilihat** (U5): baris bertanda "bukan hari libur"; tombol
    **Sudah dilihat** (catatan pilihan).
  - **Dinilai ulang:** baris yang dibatalkan, digantikan, atau dikoreksi
    beserta pemicunya.
  - **Belum bertarif:** baris berstatus Belum bertarif dan tautan ke
    DRV-L02.
- **Saring:** orang, peran, jenis, keterangan, cabang orang.
- **Tombol:** tidak ada pengubah nominal (DRV-01). Tautan ke trip
  (LOG-L14) dan ke tarif yang dipakai (DRV-L02).
- **Beda jabatan:** HR melihat semua orang kecuali jabatan bertanda "Gaji
  hanya terlihat Pemilik dan GM" (KAR-83); Pemilik dan GM melihat semua.
  Kepala Gudang tidak membuka layar ini (DRV-82: ia melihat tarif, bukan
  upah per orang, PRI-24); daftar ritasenya tanpa rupiah tetap di LOG-L24.
  Finance tidak membuka (hanya total per minggu, 4G-2). Driver dan kenek
  melihat barisnya sendiri di slip mingguan dan Pendapatan Saya (4G-2,
  GAJ-L39).

### 3.2 Bagian 4G-2: Slip Mingguan dan Denda

**Disetujui penuh 14 Oktober 2026** (S1 s.d. S4 "ok", sesuai saran; bagian 13). Isi di bawah
ditulis memakai saran Claude; aturannya DRV-93 s.d. 100 (bagian 3.18
`../../aturan/05-gaji-driver-kasbon.md`).

Bahan: DRV-03 s.d. 05, 19 s.d. 30, 84, 88, 92; GAJ-33, 36 s.d. 54, 75, 82,
86, 89, 91 s.d. 114 (mesin slip 4E-5a/5b/5c); KEH-99, 123; LOG-129; KAR-62,
67, 68, 83; PRI-02, 23, 29, 33, 34, 35, 37; data lama `driver_fines` (12
baris, dibaca 14 Oktober 2026).

**Pokoknya:** slip mingguan **bukan mesin kedua**. Ia slip biasa milik Gaji
(4E-5) dengan periode jenis minggu upah: lahir sebagai Perkiraan, dihitung
fungsi "hitung slip" yang sama, ditutup dengan langkah tutup yang sama,
dibayar dengan langkah bayar yang sama, dilihat lewat Pendapatan Saya dan
Slip Saya yang sama. Bagian ini hanya menulis **yang khas**: kapan minggu
itu ditutup dan dibayar, apa isinya, apa yang menahannya, dan denda driver
dan kenek. Semua yang tidak disebut di sini mengikuti 4E-5 (DRV-22).

Pelajaran sistem lama (arsip 5A): slip hanya cetakan sesaat; denda diketik
bebas tanpa pengesahan dan bisa dihapus; driver tidak melihat dendanya;
pembayaran ditolak bila potongan lebih besar; 111 ritase "belum dibayar"
tanpa ada yang tahu. Dari 12 denda lama, 7 sebenarnya **kurang setoran**
dan 1 **kurang kembalian solar**; di v3 keduanya bukan denda (lihat "Yang
bukan denda" di bawah). Sisanya 3 denda "tidak laporan di form" sebesar
Rp5.000 dan Rp10.000.

#### Jadwal satu minggu upah (DRV-19, 22; S4)

| Kapan | Yang terjadi |
|---|---|
| Jumat 00.00 | Minggu upah baru dibuka (dibuat mesin Pembuat periode 4E-1). Untuk minggu yang baru berakhir: tombol **Ada yang salah** (keberatan slip) muncul di portal (GAJ-L40) |
| Jumat 00.15 | Pembuat slip membuat kerangka slip minggu yang baru dibuka (di bawah) |
| **Jumat 10.00** | **Tombol Tutup aktif** untuk minggu yang berakhir Kamis kemarin (S4). Sebelum jam ini tombol mati dengan keterangan "Aktif mulai Jumat 10.00" |
| Jumat 15.00 | Bila masih ada slip Perkiraan minggu itu: **pengingat berantai** (TAM-22) ke HR, Pemilik, GM, berisi jumlah yang siap dan yang tertahan beserta penyelesainya; diulang tiap hari 07.00 sampai habis |
| **Sabtu** | **Jatuh bayar** (DRV-19). Slip Ditutup belum Dibayar tampil "Hari ini" di Jadwal Bayar |
| Minggu 07.00 dst. | Pengingat belum Dibayar (GAJ-104) ke Pemilik dan GM bila masih ada yang belum ditandai |
| Senin 23.59 (hari ke-3 sesudah ditutup Jumat) | Akhir masa keberatan slip (GAJ-42, DRV-22) |

- **Kenapa Jumat 10.00 (S4):** trip Kamis malam biasanya Selesai Jumat dini
  hari. Jam 10.00 memberi waktu trip itu tertutup, Penilai ritase
  menilainya, dan driver memeriksa perkiraannya pagi itu, tetapi slip tetap
  bisa ditutup dan disiapkan hari itu supaya Sabtu dibayar. Trip yang baru
  Selesai sesudah slip ditutup tidak hilang: masuk minggu berikutnya dengan
  keterangan tanggal asal (DRV-22).
- **Jam aktif dan jam pengingat adalah pengaturan** (bagian 8); batas
  pengingat bukan pagar: sesudahnya slip tetap bisa ditutup kapan pun.
- **Tidak ada "masa keberatan perkiraan" bertanggal seperti 26–28** untuk
  slip mingguan: jaraknya terlalu pendek (Jumat pagi ke Sabtu). Keberatan
  yang diajukan Jumat sebelum tutup diperlihatkan di langkah "Periksa"
  GAJ-L30 dan tidak menahan slip (GAJ-93).
- Hari bayar tidak digeser karena Minggu, tanggal merah, atau hari tutup
  (sejalan GAJ-59).

#### Slip mingguan lahir (DRV-04, 05, 20; perincian 4E-5a "Slip lahir sebagai Perkiraan")

Mesin **Pembuat slip** (4E-5a) untuk periode jenis minggu upah membuat
kerangka slip Perkiraan:

1. **Slip utama mingguan:** untuk setiap orang yang slip utamanya mingguan
   (pengaturan jabatan, KAR-62) dan aktif sekurang-kurangnya satu hari di
   minggu itu, **walaupun belum punya ritase**. Gunanya: cicilan kasbon,
   Potongan Lain, dan denda yang jatuh di minggu itu tetap tampil dan, bila
   pendapatannya Rp0, menjadi sisa potongan yang terang, bukan hilang dari
   pandangan.
2. **Slip di luar slip utama** (DRV-05): dibuat **saat baris upah pertama
   orang itu masuk minggu itu** (ritase, upah belanja, atau koreksi plus
   ritase, DRV-88), misalnya staf toko bergaji bulanan yang ikut menjadi
   kenek di hari liburnya. Tanpa baris upah, tidak ada slip.
3. Kunci tetap orang + periode + jenis + slip utama (4E-5a): satu orang
   paling banyak satu slip mingguan per minggu. Orang yang **berganti slip
   utama** (DRV-06, tanggal 26) bisa punya slip mingguan utama sampai minggu
   yang memuat tanggal 25, lalu slip mingguan di luar slip utama sesudahnya
   (atau sebaliknya); minggu yang memuat pergantian itu ditulis di 4G-4b
   bersama perpindahan kasbon (DRV-74).

#### Isi slip mingguan (DRV-20, 23, 24, 28; GAJ-75, 86)

Dihitung fungsi **"hitung slip (orang, periode)"** yang sama (WAJ-04). Untuk
periode jenis minggu upah, fungsi itu membaca:

**Pendapatan**

| Baris | Asal | Aturan |
|---|---|---|
| Ritase sebagai driver dan sebagai kenek | Buku Upah jenis `ritase`, termasuk baris Rp0 berketerangan | DRV-09, 17, 87 |
| Upah belanja | Buku Upah jenis `upah_belanja` | DRV-11 |
| Koreksi plus upah ritase | `penilaian_ulang` bercara "koreksi plus" | DRV-88 |
| Bonus | Buku Bonus yang slip tujuannya minggu itu (misalnya bonus ongkir driver, B3) | GAJ-86 |

Tidak ada gaji tetap, lembur, kompensasi libur, atau hitungan kehadiran:
orang per ritase tidak punya telat, lembur, atau denda lupa absen (KEH-99,
123). Fungsi hitung slip melewati bagian itu bila tidak ada sumbernya;
tidak ada cabang "kalau driver" di kode (WAJ-05).

**Potongan** (hanya di slip utama mingguan; slip di luar slip utama tanpa
potongan, DRV-05), memakai urutan GAJ-75 yang sama, sisa potongan lebih
dulu di tiap kelompok:

| Kelompok | Isi di slip mingguan | Aturan |
|---|---|---|
| (a) | **Denda driver dan kenek** (di bawah); potongan **koreksi upah ritase** | DRV-29, 88 |
| (b) | Kehilangan barang dan minus kas: hanya bila jabatannya bertanda "ikut menanggung kehilangan barang" (isi awal: jabatan driver dan kenek **tidak** bertanda) | GAJ-77 |
| (c) | Potongan Lain (termasuk kurang serah uang pengiriman yang diteruskan HR, LOG-129); koreksi bonus minus | GAJ-80, DRV-23 |
| (d) | Cicilan kasbon yang jatuh di minggu itu (4G-4b) | DRV-23, 66 |

- **Satu kali potong = satu slip mingguan** (DRV-23): Potongan Lain 3 kali
  potong bagi driver berarti tiga minggu berturut-turut (GAJ kejadian 67).
- **Bersih tidak pernah minus**; yang tidak tertampung menjadi sisa potongan
  ke slip mingguan berikutnya (DRV-24, GAJ-52). Slip bersih Rp0 ditutup dan
  langsung Dibayar "tanpa uang" (GAJ-102).
- **Bentuk slip** sama dengan GAJ-97. Kekhasan tampilannya: bagian
  Pendapatan dikelompokkan **per hari** (tanggal, peran, mobil, rute,
  nominal, keterangan Rp0 atau tanggal asal), dengan jumlah ritase dan
  jumlah upah belanja di bawahnya; nomor `SM-[tanggal Kamis]-[urut]`.

#### Penahan slip mingguan (perincian GAJ-93; DRV-92)

Fungsi **"penahan slip"** yang sama. Untuk slip mingguan, penahan yang bisa
muncul **hanya**:

| No | Penahan | Yang menyelesaikan | Aturan |
|---|---|---|---|
| 7 | Ada baris upah **Belum bertarif** di minggu itu | Pemilik, GM mengisi tarif (DRV-L02); Penilai ulang menilai lagi | DRV-92 |
| 5 | Slip terakhir: bonus Menunggu atau Ditahan | HR, Pemilik, GM | GAJ-89 |
| 6 | Slip terakhir: usulan "berhenti tanpa pemberitahuan" belum diputuskan | Pemilik, GM | KAR-68 |

Penahan 1 s.d. 4 tidak pernah muncul untuk orang per ritase (tidak ada
absen QR, penjelasan, lembur, atau gaji tetap). Penahan 7 ditambahkan ke
daftar fungsi penahan sebagai penahan umum (berlaku juga bila suatu hari ada
baris Belum bertarif di slip lain), bukan cabang khusus slip mingguan.

**Bukan penahan:** usulan denda yang belum disahkan (masuk slip berikutnya
bila disahkan sesudah slip ditutup, GAJ-50); keberatan denda dan keberatan
slip yang menunggu; trip bertanggal minggu itu yang masih Berjalan (masuk
minggu berikutnya); tanda "Perlu dilihat" (DRV-91); Pemeriksaan Uang trip
yang belum selesai (kurang serah menjadi Potongan Lain kemudian, LOG-129).

#### Langkah tutup slip mingguan (GAJ-47; perincian DRV-22, 88)

Langkah tutup 4E-5a dipakai apa adanya, dengan tiga perincian:

1. **Sebelum langkah** (bersama Penghitung koreksi 4E-2/4E-3): server
   memanggil **Penilai ulang** untuk orang dan minggu itu (DRV-88), supaya
   status hari dan tarif yang berubah sudah ikut sebelum dikunci.
2. **Langkah 5 dan 6:** baris Buku Upah ritase, upah belanja, dan koreksi
   plus diisi nomor slipnya; baris denda driver dan kenek yang terpotong
   ditandai masuk slip; baris `penilaian_ulang` bercara potongan koreksi
   diisi nomor slipnya.
3. **Langkah 10:** denda driver dan kenek serta potongan koreksi upah
   ritase masuk **Dana Disiplin** sebesar yang benar-benar terpotong
   (DRV-30, GAJ-33, 87). Langkah 13 (kunci catatan hari kerja) tidak
   berlaku untuk orang per ritase karena tidak ada hitungan kehadiran.

Tutup per orang dan "Tutup semua yang siap" sama dengan 4E-5a. **Buka
kembali** sama (Pemilik atau GM, syarat GAJ-95); karena slip berikutnya
datang seminggu kemudian, syarat (b) "belum ada slip utama berikutnya yang
ditutup" berarti buka kembali praktis hanya bisa sebelum Jumat berikutnya.

#### Bayar slip mingguan (DRV-25, 26, 27; 4E-5b)

Langkah bayar 4E-5b dipakai apa adanya: Pemilik atau GM, satu langkah per
slip, tempat uang, tanggal uang boleh mundur 7 hari (GAJ-99), satu baris
Buku Kas per slip berkejadian Bayar gaji, cabang dibebani = cabang
tersimpan di slip (Gudang untuk driver dan kenek). Catatan Cepat "Gaji/Upah"
boleh dipasangkan (Y3). Daftar Transfer untuk Finance (GAJ-L36) memuat slip
mingguan Ditutup belum Dibayar per minggu upah. Finance melihat Ringkasan
per minggu tanpa nama (DRV-25, GAJ-L38).

#### Denda driver dan kenek (DRV-29, 30; S1 s.d. S3)

**Jenis denda** (DRV-29): daftar bernominal dan bertanggal berlaku,
disimpan sebagai pengaturan bersasaran jenis (kerangka 4B, sama seperti
persen bonus per jenis). Isi awal satu jenis:

| Jenis | Contoh perbuatan | Nominal awal (S1) |
|---|---|---|
| **Tidak taat administrasi** | Tidak mengisi laporan di form yang diwajibkan Kepala Gudang, laporan hanya sebagian, surat jalan atau nota tidak diserahkan sesuai prosedur | **Rp10.000 per kejadian**, tetap, tanpa tambahan bertingkat |

- **Kenapa Rp10.000 (S1):** sama dengan angka yang paling sering dipakai di
  sistem lama untuk "tidak laporan di form" (2 dari 3 kejadian), sebanding
  dengan denda kehadiran (lupa absen pulang Rp5.000, tidak memilih libur
  Rp10.000, lupa absen masuk Rp15.000), dan kira-kira seperempat upah kenek
  satu ritase: terasa, tetapi tidak menghabiskan upah sehari.
- **Tanpa tambahan bertingkat** seperti "kejadian ke-5 dst." (GAJ-16): denda
  ini diajukan orang, bukan dihitung mesin, jadi pengulangan cukup terlihat
  di riwayat dan dibicarakan langsung.
- **Jenis baru dan perubahan nominal** hanya Pemilik dan GM, lewat Papan
  (PRI-29, 35). Menambah jenis atau menaikkan nominal **merugikan
  karyawan**, jadi paling cepat berlaku **7 hari** sesudah pengumuman
  terbit; menurunkan nominal 1 hari. Server menentukan jaraknya. Jenis tidak
  dihapus; yang tidak dipakai dinonaktifkan mulai tanggal tertentu.
- **Nominal awal diumumkan sebelum modul tayang** (Tahap 5), karena di
  sistem lama nominalnya diketik bebas; tanpa pengumuman, angka Rp10.000
  terasa sebagai aturan baru yang tiba-tiba.

**Mengajukan denda** (DRV-L07):

- **Siapa:** Kepala Gudang (usulan) atau Pemilik dan GM. Jabatan lain tidak
  (DRV-29). Tidak ada yang mengajukan denda untuk dirinya sendiri.
- **Untuk siapa:** orang yang **slip utamanya mingguan** (driver, kenek)
  dan aktif pada tanggal kejadian, atau orang lain yang **tercatat sebagai
  awak trip** pada tanggal itu (staf bulanan yang ikut trip). Server menolak
  selain itu: "Rina tidak tercatat ikut trip pada 5 November. Denda driver
  dan kenek hanya untuk driver, kenek, dan awak trip hari itu." Jabatan
  Pemilik dan GM tidak bisa dipilih.
- **Isi:** jenis (dari daftar yang berlaku pada tanggal kejadian), tanggal
  kejadian, trip yang berkaitan (pilihan dari trip orang itu hari itu,
  wajib bila ada), uraian paling sedikit 15 huruf, foto bila ada. **Tidak
  ada isian nominal**: nominal disalin server dari jenisnya pada tanggal
  kejadian.
- **Tanggal kejadian paling lama 7 hari ke belakang (S3)**, tidak boleh
  masa depan. Lebih dari itu tidak bisa didenda. Alasannya: denda gunanya
  menegur saat kejadiannya masih diingat; denda untuk kejadian dua minggu
  lalu terasa seperti tumpukan, dan driver sulit membela diri.
- **Oleh Kepala Gudang:** tersimpan sebagai pengajuan jenis **"Usulan denda
  driver/kenek"** di Mesin Pengajuan (PRI-23, 37), menunggu Pemilik atau GM.
  Tidak ada batas keputusan; Pemilik dan GM diingatkan sekali sehari di
  Antrean selama masih menunggu. **Oleh Pemilik atau GM:** langsung
  Berlaku.
- **Disahkan** (Pemilik atau GM, bukan untuk dirinya): nominal tidak bisa
  diubah; yang bisa hanya **Sahkan** atau **Tolak** (alasan wajib). Pengaju
  dan orangnya diberi tahu.

**Saat Berlaku:**

- Orangnya diberi tahu jenis, tanggal, uraian, nominal, dan slip yang akan
  memotongnya, beserta tombol **Ajukan keberatan** selama 3 hari (S2).
- **Masuk slip utama orang itu** (DRV-04, 30), periode **tanggal kejadian**:
  driver dan kenek ke slip mingguan minggu itu; staf berslip utama bulanan
  ke slip bulanannya. Bila slip itu sudah ditutup, ke slip utama
  berikutnya dengan keterangan "kejadian [tanggal]" (GAJ-50). Kelompok (a).
- Slip di luar slip utama tidak pernah dipotong denda (DRV-05).

**Keberatan denda (S2):** memakai jenis pengajuan **"Keberatan potongan"**
dan layar GAJ-L18 yang sudah ada (GAJ-81), diperluas ke denda driver dan
kenek. Batas 23.59 hari ke-3 sejak diberi tahu; diputuskan Pemilik atau GM
yang **bukan** pengesahnya bila memungkinkan (bila hanya ada satu, ia boleh
memutuskan dan tercatat); **Tetap** atau **Ditiadakan**, alasan wajib.
Selama menunggu, denda **tetap berjalan**; bila slip ditutup lebih dulu lalu
Ditiadakan, uangnya kembali sebagai **koreksi plus** di slip utama
berikutnya, dan Dana Disiplin mencatat mutasi keluar (sama dengan Potongan
Lain, GAJ-81).

**Membatalkan dan meniadakan** (PRI-02; tidak ada yang dihapus):

| Keadaan | Tindakan | Oleh | Akibat |
|---|---|---|---|
| Usulan belum diputuskan | **Tarik** | Pengaju | Tidak ada |
| Berlaku, belum masuk slip yang ditutup | **Batalkan** (alasan) | Pemilik, GM | Hilang dari perkiraan; orangnya diberi tahu |
| Sudah terpotong di slip yang ditutup | **Tiadakan** (alasan), atau lewat keberatan Ditiadakan | Pemilik, GM | Koreksi plus di slip utama berikutnya; mutasi keluar Dana Disiplin |
| Orang berhenti, denda belum terpotong | Ikut slip terakhir; yang tidak tertampung **Tidak tertagih** (kelompok a, GAJ-82) | Mesin | Tidak masuk Piutang Lain |

**Yang bukan denda** (supaya tidak kembali seperti sistem lama):

| Kejadian | Jalurnya di v3 | Aturan |
|---|---|---|
| Uang setoran kurang (uang toko yang dibawa driver) | Kurang serah atas nama pembawa di Pemeriksaan Uang → diteruskan ke HR → **Potongan Lain** | LOG-129, GAJ-80 |
| Kembalian bensin atau solar kurang | Bensin 4F-5c: kekurangan uang yang sudah diberikan, lalu Potongan Lain bila ditagih | LOG-140 s.d. 145 |
| Barang rusak atau hilang karena kelalaian | Potongan Lain jenis ganti rugi | GAJ-80 |
| Lupa absen | Tidak ada untuk absen lewat trip | KEH-123 |

Bedanya: **denda** adalah teguran bernominal tetap yang masuk Dana
Disiplin; **ganti rugi** adalah uang yang hilang dan nominalnya sebesar
kerugiannya, lewat Potongan Lain. Layar Ajukan Denda menuliskan kalimat ini
di langkah 1 supaya Kepala Gudang memilih jalan yang benar.

#### Yang dilihat driver dan kenek (DRV-28, 80; 4E-5c)

- **Pendapatan Saya** (GAJ-L39) dan **Slip Saya** (GAJ-L40) apa adanya: slip
  mingguan tampil utuh di periode 26–25 tempat Kamis akhirnya jatuh (C1),
  dengan status bayar, keberatan, dan unduh PDF.
- **Kartu "Upah Minggu Ini"** di Beranda (DRV-L10), karena driver berpikir
  per minggu, bukan per 26–25: perkiraan minggu berjalan dan status slip
  minggu lalu, satu ketukan dari slipnya.
- **Denda** tampil di tab Potongan Pendapatan Saya dengan jenis, tanggal,
  uraian, status (Berlaku, Keberatan menunggu, Ditiadakan, Dibatalkan,
  Terpotong), dan tombol keberatan selama masanya. Usulan yang belum
  disahkan **tidak** tampil ke orangnya (belum ada keputusan; sama dengan
  usulan potongan HR).

#### DRV-L06. Denda Driver dan Kenek

- **Letak:** Kantor › Gaji › Denda Driver & Kenek (menu v1). **PC**; Kepala
  Gudang juga dari **HP**.
- **Kepala:** jumlah usulan menunggu, denda Berlaku minggu ini (jumlah dan
  rupiah), keberatan menunggu.
- **Tab:** **Menunggu pengesahan** (Pemilik, GM; Kepala Gudang melihat
  usulannya sendiri), **Berlaku**, **Selesai** (terpotong, ditiadakan,
  dibatalkan, ditolak, tidak tertagih).
- **Tiap baris:** tanggal kejadian, orang, jabatan, jenis, nominal, trip,
  pengaju, pengesah, status, slip yang memotong.
- **Saring:** orang, jenis, status, minggu. **Cari** nama.
- **Tombol:** **Ajukan denda** (DRV-L07; Kepala Gudang, Pemilik, GM); per
  baris **Sahkan/Tolak** (DRV-L08), **Batalkan**, **Tiadakan** (Pemilik,
  GM); **Tarik** (pengaju, selama menunggu).
- **Beda jabatan:** Kepala Gudang melihat denda yang **ia ajukan** beserta
  statusnya, tanpa slip orang itu; HR melihat semua (lingkup S) tanpa
  tombol ubah; Finance tidak membuka.

#### DRV-L07. Ajukan Denda (4 langkah, TAM-07)

1. **Jenis:** daftar jenis yang berlaku hari ini dengan nominalnya dan
   contoh perbuatannya. Di bawahnya kalimat "Uang setoran atau kembalian
   kurang? Itu bukan denda: catat di Pemeriksaan Uang atau Bensin."
2. **Orang dan tanggal:** tanggal kejadian (hari ini sampai 7 hari ke
   belakang, S3); orang dipilih dari driver, kenek, dan awak trip pada
   tanggal itu; trip terisi bila orang itu hanya punya satu trip hari itu.
3. **Uraian dan foto:** uraian paling sedikit 15 huruf; foto bila ada.
4. **Periksa:** kalimat "Denda Tidak taat administrasi Rp10.000 untuk Eko,
   kejadian Selasa 3 November (trip TR-…), menunggu pengesahan Pemilik atau
   GM." Tombol ditahan 3 detik (TAM-15). Oleh Pemilik atau GM kalimatnya
   "langsung berlaku, dipotong di slip minggu 30 Okt – 5 Nov".

#### DRV-L08. Putuskan Usulan Denda

- **Letak:** isi khas BER-L21, dibuka dari Persetujuan (BER-L20) dan dari
  DRV-L06. **PC**, **HP** untuk Pemilik dan GM.
- **Isi:** usulan (jenis, nominal, tanggal, trip, uraian, foto, pengaju);
  riwayat denda orang itu 3 bulan terakhir (jumlah per jenis); slip yang
  akan memotongnya.
- **Tombol:** **Sahkan** (ditahan 3 detik) atau **Tolak** (alasan paling
  sedikit 15 huruf). Tidak ada isian nominal.

#### DRV-L09. Jenis Denda

- **Letak:** Pengaturan › Gaji Driver. **PC.**
- **Isi:** tiap jenis: nama, contoh perbuatan, nominal berlaku, berlaku
  dari, nominal terjadwal (bila ada), aktif. Riwayat per jenis.
- **Tombol (Pemilik, GM):** **Jenis baru**, **Ubah nominal**, **Nonaktifkan
  mulai** — semuanya lewat kerangka pengaturan 4B (BER-L41) dengan draf
  pengumuman Papan dan jarak berlaku dihitung server (7 hari bila jenis
  baru atau naik; 1 hari bila turun).
- **Beda jabatan:** HR dan Kepala Gudang melihat tanpa tombol.

#### DRV-L10. Kartu "Upah Minggu Ini" (Beranda)

- **Letak:** Beranda (BER-L01), hanya untuk orang yang punya slip mingguan
  di minggu berjalan atau minggu lalu. **HP.**
- **Isi:** dua baris. **Minggu ini** (Jumat–Kamis berjalan): jumlah ritase,
  upah belanja, perkiraan bersih, bertanda "perkiraan". **Minggu lalu:**
  status slip (Perkiraan, Tertahan + sebab dalam bahasa karyawan, Ditutup
  "dibayar Sabtu", Dibayar tanggal …, tanpa uang).
- **Ketuk:** membuka GAJ-L40 slip itu. Tidak ada tombol lain.
- Angka dari fungsi yang sama dengan Slip Saya; tidak ada hitungan kedua.

### 3.3 Bagian 4G-3a: Laporan Bongkaran

**Disetujui penuh 14 Oktober 2026** (L1 s.d. L7 "ok", sesuai saran; bagian
13). Isi di bawah ditulis memakai saran Claude; aturannya DRV-101 s.d. 110
(bagian 3.19 `../../aturan/05-gaji-driver-kasbon.md`).

**Pokoknya:** Kepala Gudang mengisi **apa yang datang dan siapa yang
membongkar**. Mesin yang menghitung: berat, upah, dan bagian tiap orang.
Tidak ada angka kg, tarif, atau rupiah yang diketik orang (kecuali dua jalan
terakhir yang ditandai: Barang lain, dan total kg selama daftar produk belum
ada). Begitu laporan Berlaku, Finance tinggal membayar (4G-3b).

Pelajaran sistem lama (arsip 5B): kg diketik tanpa bukti; tarif bisa diketik
per entri dan ada tarif cadangan Rp20 di kode; yang mencatat pemilik, HR,
atau finance, sampai 13 hari kemudian, padahal yang tahu pesertanya hanya
Kepala Gudang; rumus bagi rata ditulis dua kali dan sisanya jatuh ke "yang
dicentang terakhir"; entri bisa diedit dan dihapus sesudah lunas; peserta
tidak bisa melihat upahnya.

#### Perjalanan satu laporan (DRV-31, 84; L1, L4)

| Status | Artinya | Lahir saat |
|---|---|---|
| **Menunggu persetujuan** | Laporan terlambat (tanggal kerja lebih dari 3 hari lalu) yang dibuat Kepala Gudang; belum ada upah | Disimpan (L4) |
| **Berlaku** | Sah; baris Buku Upah tiap peserta sudah lahir; menunggu dibayar | Disimpan (laporan biasa), atau disetujui (laporan terlambat) |
| **Ditolak** | Laporan terlambat yang tidak disetujui | Ditolak Pemilik atau GM |
| Dibayar, Dikoreksi, Dibatalkan | Lihat 4G-3b | — |

- **Tidak ada pengesahan terpisah (L1).** "Disahkan" di DRV-84 berarti
  **tersimpan dan Berlaku**. Laporan dibuat Kepala Gudang dan langsung sah,
  karena upahnya dibayar tunai hari itu (DRV-47); menunggu orang kedua
  menahan uang orang yang baru selesai mengangkat. Mata kedua tetap ada:
  **Finance melihat rincian dan tanda-tandanya sebelum membayar** (4G-3b),
  dan Pemilik serta GM melihat semua tanda di DRV-L11.
- **Menyimpan adalah satu langkah utuh di server** (DRV-31): laporan, baris
  barang, berat per satuan yang baru atau berubah, peserta, bagian tiap
  peserta, dan baris Buku Upah tersimpan bersama atau tidak sama sekali.
- Nomor laporan `LB-[tanggal kerja]-[urut]`. Laporan tidak pernah dihapus
  (DRV-49).

#### Supplier dan tanggal kerja (DRV-36, 37, 41; L4)

- **Supplier** dipilih dengan mencari di daftar supplier Keuangan (KEU-57).
  Tidak ketemu: **Tambah supplier** (nama, HP pilihan) memakai tindakan
  Keuangan; supplier itu bertanda "belum diperiksa". Penjaga nama mirip
  KEU-57 berlaku di sini juga.
- **Tanggal kerja** bawaannya hari ini menurut server (PRI-01). Boleh
  dipilih sampai **3 hari ke belakang**; tanggal yang akan datang ditolak.
- **Lebih dari 3 hari ke belakang (L4):** Kepala Gudang **tetap yang
  mengisi** (hanya dia yang tahu barang dan pesertanya), dengan **alasan**
  paling sedikit 15 huruf. Laporan tersimpan **Menunggu persetujuan** sebagai
  pengajuan jenis "Laporan Bongkaran terlambat" (Mesin Pengajuan, PRI-23,
  37). Pemilik atau GM menyetujui atau menolak (DRV-L16). Selama menunggu
  **belum ada baris upah dan belum bisa dibayar**. Disetujui: laporan
  Berlaku, upah lahir dengan tarif **tanggal kerja**. Pemilik atau GM yang
  membuat sendiri laporan setua itu: langsung Berlaku, alasan tetap wajib.
- **Laporan serupa (DRV-37):** bila sudah ada laporan (bukan Ditolak atau
  Dibatalkan) dengan tanggal kerja, supplier, dan total kg yang sama, langkah
  Periksa menampilkan laporan itu dan meminta konfirmasi "Ini bongkaran
  lain". Jawabannya tercatat sebagai tanda di laporan.

#### Barang dan berat per satuan (DRV-32, 33, 35, 40; L5)

- **Mencari barang:** ketik paling sedikit 2 huruf nama atau kode; hasil
  dari `kasir_produk` (kode, nama, satuan). Pilih produk, lalu **satuan**
  (dari satuan produk itu di daftar kasir; bila hanya satu, terisi sendiri)
  dan **jumlah**.
- **Berat per satuan** (kg, sampai 3 angka di belakang koma, lebih dari 0)
  disimpan per **produk + satuan**:
  - **Sudah ada:** tampil sebagai tulisan, bukan isian ("25 kg per sak, diisi
    Hadi 3 November"). Baris langsung menunjukkan kg-nya.
  - **Belum ada:** wajib diisi; tersimpan sebagai berat produk itu saat
    laporan disimpan (DRV-32).
  - **Ubah berat:** tombol kecil di baris itu. Wajib **alasan** paling
    sedikit 15 huruf (L5). Berat baru berlaku untuk laporan ini dan
    laporan-laporan sesudahnya; laporan lama memakai salinannya sendiri dan
    tidak ikut berubah (DRV-33).
- **Pagar berat (L5).** Kepala Gudang yang mengisi berat bisa juga ikut
  membongkar, jadi angka berat menentukan uangnya sendiri. Karena itu:
  setiap perubahan tercatat (siapa, kapan, dari berapa ke berapa, alasan,
  di laporan mana); perubahan yang bedanya **lebih dari 10%** dari berat
  sebelumnya masuk daftar **"Berat berubah"** untuk Pemilik dan GM
  (DRV-L14) dan menjadi tanda di laporannya. Tanda itu **tidak menahan**
  laporan maupun pembayaran; ditutup dengan "Sudah dilihat". Berat di atas
  100 kg per satuan meminta konfirmasi sekali ("Betul 250 kg per sak?").
- **Jumlah** boleh pecahan sampai 3 angka di belakang koma (untuk barang
  curah yang satuannya kg), lebih dari 0.
- Satu produk + satuan hanya satu baris per laporan; memilihnya lagi membuka
  baris yang sudah ada.
- **Bukan penerimaan stok** (DRV-40): kalimat ini tampil di kepala langkah
  Barang, supaya tidak ada yang mengira stok kasir ikut bertambah.

#### Barang lain (DRV-34)

- Pilihan **"Barang tidak ada di daftar"** baru muncul **setelah pencarian
  (paling sedikit 3 huruf) tidak menemukan apa pun**. Tidak ada tombol
  Barang lain di tempat lain.
- Isi: nama barang, **kg** (diketik, sampai 3 angka di belakang koma), dan
  **alasan** paling sedikit 15 huruf. Baris bertanda **Barang lain**.
- Pemilik dan GM melihat semuanya di DRV-L15: berapa laporan, berapa kg,
  oleh siapa, dan tombol **Pasangkan ke produk**. Memasangkan hanya memberi
  tahu "barang ini sebenarnya produk X" untuk laporan dan pencarian
  berikutnya; **kg dan upah laporan itu tidak berubah** (uangnya mungkin
  sudah dibayar).

#### Selama daftar produk belum ada (DRV-38)

- Bila `kasir_produk` masih kosong (belum pernah diunggah), langkah Barang
  berganti menjadi **satu isian "Total kg"** dan catatan barang (tulisan
  bebas, wajib). Laporan bertanda **"kg diketik"**.
- Begitu daftar produk terisi, isian Total kg **hilang sendiri**; tidak ada
  saklar. Keadaan ini dibaca dari ada tidaknya isi daftar produk, bukan dari
  pengaturan.

#### Hitungan (DRV-35, 42, 43, 46)

Satu fungsi server **"hitung bongkaran (barang, peserta, tanggal kerja)"**
(WAJ-04), dipakai saat menyimpan, saat menyetujui laporan terlambat, saat
koreksi (4G-3b), dan untuk pratinjau di langkah Periksa. Layar tidak pernah
mengirim kg total, tarif, atau bagian; yang dikirim hanya barang, jumlah,
berat, dan peserta.

| Langkah | Rumus |
|---|---|
| B1. Kg tiap baris | jumlah × berat per satuan, dibulatkan ke 3 angka di belakang koma (setengah ke atas). Barang lain: kg yang diketik |
| B2. Total kg | jumlah semua kg baris (atau Total kg yang diketik, DRV-38). Harus lebih dari 0 |
| B3. Tarif | angka pengaturan "tarif bongkaran" yang berlaku pada **tanggal kerja**. Tidak ada → laporan ditolak: "Tarif bongkaran untuk 3 November belum ada. Hubungi Pemilik atau GM." Tidak ada angka cadangan di kode (DRV-42) |
| B4. Total upah | total kg × tarif, dibulatkan ke rupiah terdekat (setengah ke atas, PRI-28) |
| B5. Bagian tiap peserta | total upah dibagi jumlah peserta, dibulatkan ke bawah. Sisa rupiahnya diberikan Rp1 per orang menurut **urutan abjad nama lengkap** (huruf besar-kecil diabaikan; nama sama persis: yang lebih dulu terdaftar). Jumlah semua bagian = total upah (DRV-43) |

Tarif, berat tiap baris, dan bagian tiap peserta **tersalin di laporan**;
perubahan tarif atau berat sesudahnya tidak mengubah laporan yang sudah ada.

#### Peserta dan pekerja lepas (DRV-44, 45; L2, L7)

- **Memilih peserta:** cari nama. Di atas kotak cari tampil **"Sering
  ikut"**: orang yang ikut bongkaran dalam 30 hari terakhir, supaya cukup
  diketuk. Yang bisa dipilih: karyawan yang **aktif pada tanggal kerja**
  (sudah bergabung dan belum berhenti pada tanggal itu), dari cabang dan
  jabatan mana pun, dan pekerja lepas yang aktif. Paling sedikit 1 orang.
  Satu orang hanya sekali per laporan (dijaga server).
- **Pekerja lepas baru:** tombol **Tambah pekerja lepas** (nama, nomor HP)
  memakai tindakan Karyawan (KAR-L28). Nomor HP yang sama dengan orang lain
  ditolak dan orang pemilik nomor itu ditawarkan untuk dipilih (DRV-45).
- **Semua yang ikut dapat bagian yang sama** (DRV-43, 44): di hari kerja,
  hari libur, bergaji bulanan atau per ritase. Tidak ada pemeriksaan status
  hari yang mengubah uang. DRV-16 (ritase Rp0 di hari kerja) **tidak
  berlaku** di sini.
- **Pembuat boleh menjadi peserta (L2).** Kepala Gudang sering ikut
  mengangkat. Laporannya bertanda **"pembuat ikut jadi peserta"**, tampil ke
  Finance sebelum membayar dan ke Pemilik dan GM di daftar. Tanda ini tidak
  menahan apa pun.
- **Peserta yang hari itu tercatat izin, sakit, cuti, atau alpha (L7):**
  tetap dapat bagian (DRV-44), tetapi baris upahnya bertanda **"Perlu
  dilihat"** untuk HR, sama seperti ritase (DRV-91): salah satu catatannya
  mungkin keliru. HR melihatnya di Beranda **tanpa nominal** ("Andi tercatat
  sakit 5 November, tetapi ikut bongkaran"), dan menutupnya dengan "Sudah
  dilihat". Tidak ada akibat uang; pembetulan status hari di Kehadiran.
  Status hari dibaca saat laporan Berlaku dan tidak dipantau terus (beda
  dengan ritase, karena di sini uangnya tidak bergantung pada status hari).
- **Tercatat sebagai pekerjaan hari itu** (PRI-16): Catatan Hari Kerja orang
  itu (KEH-L15) menampilkan "ikut bongkaran", tanpa rupiah, tanpa mengubah
  jabatan atau absennya.
- **Orang datang separuh jalan:** pembagian selalu rata (DRV-43). Jalan
  keluarnya **dua laporan**: barang yang dibongkar sebelum ia datang dengan
  peserta lama, dan sisanya dengan peserta lengkap.

#### Baris Buku Upah (DRV-46, 84)

Saat laporan Berlaku, server menulis **satu baris Buku Upah per peserta**:
orang, jenis `bongkaran`, tanggal kejadian = tanggal kerja, periode 26–25
tanggal itu (PRI-34), banyaknya = total kg laporan, satuan kg, tarif,
nominal = bagian orang itu, cabang = cabang penanggung biaya bongkaran dari
pengaturan (DRV-51; isi awal Gudang), asal (`laporan_bongkaran` + nomor),
keterangan ("8.960 kg × Rp20, dibagi 4 orang"). Kunci "asal + orang + status
Berlaku" mencegah dobel. Baris ini **tidak pernah masuk slip** (DRV-48);
status bayarnya mengikuti pembayaran laporan (4G-3b). Pekerja lepas juga
mendapat baris, karena ia orang berstatus Freelance.

#### Foto surat jalan supplier (DRV-31, 38; L3)

- **Wajib di setiap laporan (L3):** 1 sampai 5 foto surat jalan supplier,
  diambil dengan kamera atau dipilih dari galeri. Foto inilah yang dicocokkan
  Finance dengan daftar barang sebelum membayar.
- **Supplier tidak memberi surat jalan:** pilih "Tidak ada surat jalan",
  lalu wajib **foto barang yang dibongkar** dan alasan paling sedikit 15
  huruf. Laporan bertanda **"tanpa surat jalan"**.
- Foto dilihat Kepala Gudang, Finance, Pemilik, dan GM; bukan lampiran
  tertutup.

#### Tanda di laporan

Tanda adalah keterangan untuk pembayar dan Pemilik, **bukan penahan**:

| Tanda | Muncul bila | Aturan |
|---|---|---|
| Pembuat ikut jadi peserta | Pembuat tercantum sebagai peserta | L2 |
| Barang lain | Ada baris Barang lain | DRV-34 |
| Kg diketik | Total kg diketik karena daftar produk belum ada | DRV-38 |
| Berat berubah | Ada berat yang diubah lebih dari 10% di laporan ini | L5 |
| Tanpa surat jalan | Foto barang menggantikan surat jalan | L3 |
| Tanggal mundur | Tanggal kerja bukan hari laporan dibuat | DRV-36 |
| Serupa dengan LB-… | Dikonfirmasi "bongkaran lain" | DRV-37 |
| Selisih dengan PO | Jumlah datang berbeda dari purchase order | DRV-39 |
| Supplier belum diperiksa | Supplier baru ditambah Kepala Gudang | KEU-57 |

#### Purchase order (DRV-39; L6)

**Disiapkan, belum dinyalakan.** Bentuknya:

- Di langkah 1, sesudah supplier dipilih, muncul pilihan **"Dari purchase
  order"**: daftar PO supplier itu dari `kasir_po`. Pilihan ini **hanya
  tampil bila jenis data "purchase order" di Data Kasir bercara Sambungan
  dan menyala** (TDK-L01). Tidak ada saklar kedua di modul ini (L6).
- Memilih PO mengisi baris barang (produk, satuan, jumlah dipesan).
  Kepala Gudang **mencocokkan jumlah yang datang** per baris, dan boleh
  menambah atau membuang baris. Baris yang jumlahnya berbeda, bertambah, atau
  tidak datang ditandai **Selisih dengan PO**; hitungan memakai jumlah yang
  **datang**.
- Satu PO boleh dipakai lebih dari satu laporan (barang datang bertahap);
  layar menampilkan "PO ini sudah dipakai di LB-…". HRIS tidak menulis apa
  pun ke kasir (PRI-39 butir 1).
- **Kapan dinyalakan (L6, butir terbuka 12):** tidak ditetapkan tanggalnya
  sekarang. Mengikuti aturan yang sudah ada: GM atau Owner menyalakan
  sambungan PO di Data Kasir, dengan pengumuman 7 hari sebelumnya (T8,
  SIS-09). Saat tayang, laporan dibuat dengan mencari barang.

#### Tarif bongkaran (DRV-42)

- **Satu angka** rupiah bulat per kg (PRI-28), isi awal **Rp20**, disimpan
  sebagai pengaturan bertanggal berlaku di kerangka Pengaturan 4B. Hanya
  Pemilik dan GM yang mengubah; tidak bisa diberikan ke jabatan lain.
- Perubahan mengikuti Papan Perubahan Aturan (PRI-29, 35; aturan yang sudah
  ada, tidak ditanyakan ulang): tidak berlaku mundur; paling cepat berlaku
  **1 hari** sesudah pengumuman bila naik, **7 hari** bila turun. Sasaran
  pengumuman diusulkan sistem: orang yang ikut bongkaran dalam 3 bulan
  terakhir dan Kepala Gudang.
- Tarif Rp20 berlaku mulai tanggal tayang modul; laporan bertanggal kerja
  sebelum itu ditolak (B3).

#### DRV-L11. Laporan Bongkaran (daftar)

- **Letak:** menu tugas Kepala Gudang › Laporan Bongkaran (menu v1), dan
  Kantor › Gaji › Bongkaran untuk Finance, Pemilik, GM. **HP** untuk Kepala
  Gudang, **PC** untuk kantor.
- **Kepala:** jumlah laporan hari ini, total kg dan total upah hari ini,
  berapa yang belum dibayar (semua umur, DRV-52), berapa yang menunggu
  persetujuan.
- **Tab:** **Belum dibayar** (bawaan; selalu tampil berapa pun umurnya),
  **Menunggu persetujuan**, **Semua** (periode bawaan 26–25 berjalan;
  periode lama dimuat saat diminta, PRI-11), **Barang lain** (DRV-L15;
  Pemilik, GM, Kepala Gudang).
- **Tiap baris:** nomor, tanggal kerja, supplier, total kg, jumlah peserta,
  total upah, status, tanda-tanda (label kecil), pembuat.
- **Saring:** tanggal, supplier, peserta, status, bertanda. **Cari** nomor
  atau supplier.
- **Tombol:** **Laporan baru** (DRV-L12; Kepala Gudang, Pemilik, GM); ketuk
  baris membuka DRV-L13; tautan **Berat per satuan** (DRV-L14). Tombol
  Bayar, Koreksi, dan Batalkan ditulis di 4G-3b.
- **Beda jabatan:** Kepala Gudang melihat semua laporan (bukan hanya
  buatannya) beserta bagian peserta (DRV-82); Finance melihat semua tanpa
  tombol Laporan baru; HR tidak membuka layar ini.

#### DRV-L12. Laporan Bongkaran Baru (5 langkah, TAM-07)

1. **Supplier dan tanggal:** cari supplier (atau Tambah supplier); tanggal
   kerja (hari ini; boleh mundur). Lebih dari 3 hari: muncul isian alasan
   dan kalimat "Laporan ini menunggu persetujuan Pemilik atau GM sebelum
   bisa dibayar." Bila sambungan PO menyala: pilihan Dari purchase order.
2. **Barang:** kotak cari besar; daftar baris yang sudah masuk (nama,
   jumlah dan satuan, berat per satuan, kg baris) dengan jumlah kg berjalan
   di bawah. Per baris: ubah jumlah, **Ubah berat**, buang baris. Selama
   daftar produk belum ada: isian Total kg dan catatan barang.
3. **Peserta:** "Sering ikut", kotak cari, Tambah pekerja lepas. Daftar yang
   dipilih dengan jumlah orangnya.
4. **Foto surat jalan:** ambil 1 sampai 5 foto, atau "Tidak ada surat jalan"
   (foto barang dan alasan).
5. **Periksa:** ringkasan dalam kalimat dan angka: "PT Sumber Pakan, Selasa
   3 November. 3 barang, **8.960 kg** × Rp20 = **Rp179.200**. Dibagi 4
   orang: Andi Rp44.800, Budi Rp44.800, Dedi Rp44.800, Eko Rp44.800."
   Tanda yang akan menempel disebut satu per satu. Laporan serupa (bila
   ada) ditampilkan dengan pilihan "Ini bongkaran lain". Tombol **Simpan**
   ditahan 3 detik (TAM-15). Pesan berhasil: "Laporan LB-… tersimpan.
   Finance diberi tahu untuk membayar Rp179.200." (laporan terlambat:
   "menunggu persetujuan Pemilik atau GM").

Isian tersimpan di perangkat selama belum dikirim (TAM-16), karena sinyal
di gudang sering putus. Angka di langkah 2 dan 5 dihitung server (pratinjau
fungsi "hitung bongkaran"); kalau sinyal putus, layar menulis "angka
dihitung saat sinyal kembali" dan tombol Simpan mati.

#### DRV-L13. Rincian Laporan Bongkaran

- **Kepala:** nomor, status, tanggal kerja, supplier, pembuat dan jam
  simpan, semua tanda dengan penjelasannya.
- **Barang:** tabel produk, satuan, jumlah, berat per satuan yang dipakai,
  kg baris; baris Barang lain dengan alasannya; kolom jumlah PO bila dari
  purchase order. Di bawahnya total kg, tarif, total upah.
- **Peserta:** nama, karyawan atau pekerja lepas, bagian; penerima sisa
  rupiah ditandai kecil "+Rp1".
- **Foto surat jalan** (ketuk untuk memperbesar).
- **Riwayat:** dibuat, disetujui atau ditolak (laporan terlambat), dan
  kejadian 4G-3b.
- **Beda jabatan:** Kepala Gudang, Finance, Pemilik, GM melihat semuanya.
  Peserta tidak membuka layar ini; ia melihat bagiannya di Pendapatan Saya
  (GAJ-L39): tanggal, kg, jumlah peserta, bagiannya, sudah dibayar atau
  belum (DRV-53), tanpa nama dan bagian orang lain.

#### DRV-L14. Berat per Satuan

- **Letak:** tautan dari DRV-L11 dan Pengaturan › Gaji Driver. **PC**,
  terbaca di HP.
- **Tab:** **Semua berat** (produk, satuan, berat sekarang, diisi oleh,
  kapan, dipakai di berapa laporan), **Berat berubah** (perubahan lebih dari
  10% yang belum dilihat; Pemilik dan GM), **Belum punya berat** (produk yang
  pernah dicari tetapi belum berberat; hanya keterangan).
- **Buka satu produk:** riwayat berat (dari, ke, beda persen, oleh, kapan,
  alasan, di laporan mana).
- **Tombol:** **Ubah berat** (Kepala Gudang, Pemilik, GM; berat baru dan
  alasan; berlaku untuk laporan sesudahnya); **Sudah dilihat** dengan
  catatan pilihan (Pemilik, GM).
- **Beda jabatan:** Finance melihat tanpa tombol.

#### DRV-L15. Barang Lain

- **Letak:** tab di Kantor › Gaji › Bongkaran. **PC.**
- **Kepala:** dalam periode yang dipilih: berapa laporan memuat Barang
  lain, berapa baris, berapa kg, dan berapa persen dari seluruh kg.
- **Isi:** tiap baris: tanggal, laporan, nama yang diketik, kg, alasan,
  pembuat, status (Belum dipasangkan, Dipasangkan ke …). Ringkasan per
  pembuat di atas tabel.
- **Tombol (Pemilik, GM):** **Pasangkan ke produk** (cari produk; berlaku
  untuk baris itu dan menjadi saran pencarian berikutnya); **Lepas
  pasangan** bila salah. Tidak mengubah kg dan upah.
- **Beda jabatan:** Kepala Gudang membaca tanpa tombol.

#### DRV-L16. Putuskan Laporan Bongkaran Terlambat

- **Letak:** isi khas BER-L21, dibuka dari Persetujuan (BER-L20) dan dari
  tab Menunggu persetujuan DRV-L11. **PC**, **HP**.
- **Isi:** rincian laporan seperti DRV-L13, alasan terlambat, berapa hari
  terlambat, dan **keterangan pembantu**: laporan lain di tanggal kerja itu
  (supaya tidak dobel) dan pratinjau upah dengan tarif tanggal kerja.
- **Tombol:** **Setujui** (ditahan 3 detik; "Rp179.200 untuk 4 orang
  menjadi siap dibayar") atau **Tolak** (alasan paling sedikit 15 huruf).
  Penyetuju bukan pembuat dan bukan peserta laporan itu.

### 3.4 Bagian 4G-3b: Bayar Bongkaran

**Disetujui penuh 14 Oktober 2026** (B1 s.d. B6 "ok", sesuai saran; bagian
13). Isi di bawah ditulis memakai saran Claude; aturannya DRV-111 s.d.
120 (bagian 3.20 `../../aturan/05-gaji-driver-kasbon.md`).

**Pokoknya:** laporan yang Berlaku (4G-3a) **dibayar tunai hari itu oleh
Finance**, satu langkah, sebesar yang dihitung mesin. Tidak ada angka yang
diketik pembayar. Laporan yang salah **dikoreksi, bukan dihapus**: sebelum
dibayar oleh Kepala Gudang, sesudah dibayar hanya oleh Pemilik atau GM. Uang
yang terlanjur kurang disusulkan tunai; yang terlanjur lebih dipotong dari
bongkaran berikutnya orang itu.

Pelajaran sistem lama (arsip 5B): bongkaran dibayar lewat Kas Keluar
"Bongkar" yang diketik tangan, tanpa penghubung ke entrinya, sehingga ada
pengeluaran dobel ("Bongkar" dan "Upah Borongan"); tanggal bayar diketik;
entri yang belum dibayar hilang dari layar sesudah 9 minggu (19 entri
tertinggal); entri lunas bisa diedit dan dihapus; peserta tidak tahu
upahnya sudah dibayar atau belum.

#### Status laporan sesudah Berlaku (DRV-47, 49)

| Status | Artinya | Lahir saat |
|---|---|---|
| **Berlaku** | Sah, belum dibayar (4G-3a) | — |
| **Dibayar** | Uangnya sudah diberikan; ada satu pembayaran Berlaku | Langkah bayar |
| **Dibatalkan** | Laporan dinyatakan tidak ada; semua bagian menjadi Rp0. Tetap tersimpan dan terlihat | Batalkan |

**"Dikoreksi" bukan status**, melainkan **tanda** ("Dikoreksi 1 kali")
beserta **versi**: laporan yang dikoreksi tetap Berlaku (bila belum dibayar)
atau tetap Dibayar (bila sudah). Tiap koreksi menyimpan versi lama utuh
(barang, peserta, bagian, total), siapa, kapan, dan alasannya (PRI-02).

#### Langkah bayar (DRV-47, 48, 50, 51; B1 s.d. B3)

Finance, Pemilik, atau GM memilih satu atau beberapa laporan di tab "Belum
dibayar" DRV-L11, di Jadwal Bayar (GAJ-L33), atau menekan **Bayar** di
DRV-L13, lalu DRV-L17. Beberapa laporan boleh dibayar sekaligus dari **satu
tempat uang**; tiap laporan tetap punya pembayaran dan baris Buku Kasnya
sendiri (KEU-25), dan **tiap laporan satu langkah tersendiri**: yang gagal
tidak membatalkan yang lain.

Dalam satu langkah utuh di server (semua tersimpan atau tidak sama sekali):

1. **Periksa:** penekan punya hak "bayar bongkaran"; laporan Berlaku dan
   belum punya pembayaran Berlaku (tidak bisa dibayar dua kali); tempat
   uang dipilih (KEU-05). **Pembayar bukan peserta dan bukan pembuat
   laporan itu (B3).** Kalau Pemilik atau GM yang menjadi peserta atau
   pembuat, ia tetap boleh membayar; pembayarannya bertanda dan para pemilik
   diberi tahu (sejalan GAJ-95).
2. **Yang diterima tiap peserta** dihitung server: bagian di laporan,
   dikurangi **lebih bayar** orang itu yang belum tertagih (lihat "Lebih
   bayar"). Tidak ada kasbon, denda, atau potongan lain yang diambil dari
   upah bongkaran (DRV-48).
3. **Uang yang keluar** = jumlah yang diterima semua peserta. Tidak ada
   isian nominal; dibayar sekali dan penuh.
4. **Tanggal uang (B1):** isian awal hari ini; boleh dipilih mundur sampai 7
   hari (lebih jauh dengan alasan, KEU-12), tidak sebelum **tanggal kerja**
   dan tidak masa depan. Jam catat selalu dari server (PRI-01). Angka 7 hari
   dibaca dari pengaturan tanggal uang milik Gaji (GAJ-99); tidak disimpan
   dua kali.
5. **Diserahkan kepada (B2):** wajib dipilih: **"Langsung ke tiap peserta"**
   atau **satu nama** (peserta atau pembuat laporan) yang dititipi untuk
   membagikan.
6. **Simpan pembayaran:** laporan, tanggal uang, jam catat, pembayar, tempat
   uang, cara (tunai atau transfer, mengikuti jenis tempat uang), uang yang
   keluar, diserahkan kepada, foto bukti (mengikuti KEU-11; isi awal
   dianjurkan), dan **rincian per peserta** (bagian, diperhitungkan,
   diterima).
7. **Baris Buku Kas** lewat fungsi Keuangan (4H) "tulis uang keluar dari
   modul" (KEU-23, 25): satu baris per laporan sebesar uang yang keluar,
   kejadian **Upah bongkaran**, cabang yang dibebani = cabang penanggung
   yang tersalin di laporan (DRV-51), bertaut ke laporan, uraian dari
   laporan ("LB-…, PT Sumber Pakan, 8.960 kg, 4 orang; diperhitungkan lebih
   bayar Rp2.500"). Bila uang yang keluar Rp0 (semuanya habis
   diperhitungkan), pembayaran bertanda "tanpa uang" dan tidak ada baris
   Buku Kas.
8. Laporan menjadi **Dibayar**. Status bayar baris Buku Upah tiap peserta
   dibaca dari pembayaran ini, tidak disalin (WAJ-03).
9. **Peserta yang punya akun diberi tahu:** "Upah bongkaran 3 November
   Rp44.800 sudah dibayar tanggal 3 November, diserahkan lewat Hadi."

- **Tanda dilihat dulu.** Langkah pertama DRV-L17 menampilkan semua tanda
  laporan (pembuat ikut jadi peserta, Barang lain, kg diketik, berat
  berubah, tanpa surat jalan, dan seterusnya) dan foto surat jalan. Tanda
  tidak menahan pembayaran (DRV-102).
- **Catatan Cepat (KEU-18):** kalau uangnya sudah keluar dan dicatat lewat
  Catatan Cepat milik orang yang berhak membayar bongkaran (Finance,
  Pemilik, GM), Finance **memasangkannya** ke laporan di layar Keuangan
  (4H). Laporan menjadi Dibayar atas nama pencatatnya, dengan tempat dan
  tanggal uang dari catatan itu; baris Buku Kasnya adalah catatan itu
  sendiri. Nominal catatan harus **sama persis** dengan uang yang harus
  keluar untuk laporan itu. "Diserahkan kepada" tetap diisi saat
  memasangkan.
- **Tidak ada jalan lain (DRV-50):** kejadian "Upah bongkaran" tidak bisa
  diketik di Buku Kas; server Keuangan menolaknya (KEU-23). Kategori lama
  "Bongkar", "Upah Borongan", dan "Gaji Freelance" tidak ada lagi.
- **Total upah Rp0** (berat sangat kecil): laporan langsung Dibayar "tanpa
  uang" saat Berlaku; tidak masuk daftar bayar.

#### Jatuh bayar, pengingat, dan "Tanyakan dulu" (DRV-52; B4)

- **Jatuh bayar** = hari laporan menjadi Berlaku (DRV-47). Begitu Berlaku,
  laporan masuk Antrean Finance dan Jadwal Bayar kelompok "Hari ini".
- **Lewat hari itu belum dibayar (DRV-52):** mulai **07.00 keesokan
  harinya**, setiap hari, pengingat berantai (TAM-22) ke Finance, Pemilik,
  dan GM, satu jendela untuk jalur bongkaran (TAM-25): "Ada 3 Laporan
  Bongkaran belum dibayar, Rp412.000, paling lama sejak 3 November."
  Laporan pindah ke kelompok "Lewat" dengan jumlah harinya.
- **Daftar belum dibayar tidak pernah dipotong umur** (DRV-52; pembagian per
  periode PRI-11 tidak dipakai di tab ini): laporan setua apa pun tetap
  tampil sampai dibayar atau dibatalkan.
- **Tanyakan dulu (B4):** Finance (atau Pemilik, GM) yang ragu sebelum
  membayar menekan **Tanyakan dulu** dan menulis pertanyaannya (paling
  sedikit 15 huruf). Laporan bertanda **"Ditanyakan Finance"**; pembuat
  laporan, Pemilik, dan GM diberi tahu. Pembuat menjawab dengan tulisan,
  atau langsung **Koreksi**; tanda padam dan Finance diberi tahu. Tanda ini
  **bukan penahan di server**: Pemilik atau GM tetap bisa membayar, dan
  pengingat belum dibayar tetap berjalan (dengan keterangan "ditanyakan
  sejak …") supaya tidak ada laporan yang diam.

#### Uang belum saya terima (B2)

- Peserta yang punya akun melihat tombol **Uang belum saya terima** di
  kartu bongkaran itu (Pendapatan Saya, GAJ-L39) selama **3 hari** sejak
  diberi tahu dibayar. Isinya tulisan singkat (paling sedikit 15 huruf).
- Tersimpan sebagai pengajuan jenis **"Upah bongkaran belum diterima"**
  (Mesin Pengajuan, PRI-23, 37), diputuskan **Pemilik atau GM**. Pembayar
  dan orang yang dititipi diberi tahu. Keputusan: **Sudah diselesaikan**
  (catatan wajib: uangnya ternyata sudah atau baru saja diberikan) atau
  **Tidak terbukti** (alasan wajib). Tidak ada akibat uang otomatis; bila
  pembayarannya memang salah, jalan keluarnya Batal bayar atau Koreksi.
- **Pekerja lepas** tidak punya akun: ia menyampaikan ke Kepala Gudang, dan
  Pemilik atau GM boleh mengisikan atas namanya (tercatat siapa yang
  mengisi).

#### Koreksi dan batal sebelum dibayar (DRV-49; B6)

- **Koreksi:** oleh pemegang hak "buat Laporan Bongkaran" (Kepala Gudang),
  Pemilik, atau GM; **alasan wajib** paling sedikit 15 huruf. Yang boleh
  diubah: supplier, tanggal kerja, barang, jumlah, berat yang dipakai
  laporan itu, peserta, dan foto. Nomor laporan tetap.
- **Satu langkah utuh:** versi lama disimpan; server menjalankan fungsi
  **"hitung bongkaran"** yang sama (4G-3a) dengan tarif **tanggal kerja**;
  baris Buku Upah lama Dibatalkan ("dikoreksi: …") dan baris baru ditulis;
  tanda-tanda dihitung ulang; laporan bertanda "Dikoreksi". Finance melihat
  angka baru di daftar bayar; peserta yang bagiannya berubah diberi tahu.
- **Tanggal kerja baru** mengikuti batas DRV-36, dihitung dari **hari
  laporan dibuat**: paling jauh 3 hari sebelum hari itu, tidak sesudahnya.
  Di luar itu hanya Pemilik atau GM yang mengoreksi.
- **Berat di koreksi** hanya mengubah salinan berat di laporan itu. Kalau
  berat produknya memang salah untuk seterusnya, layar menawarkan centang
  "pakai berat ini juga untuk laporan berikutnya", yang menjalankan Ubah
  berat (DRV-105) dengan alasan yang sama.
- **Batalkan (B6):** oleh orang yang sama (Kepala Gudang, Pemilik, GM),
  alasan wajib, tombol ditahan 3 detik. Baris Buku Upah semua peserta
  Dibatalkan; laporan menjadi Dibatalkan dan keluar dari daftar bayar;
  peserta diberi tahu. Laporan yang dibatalkan tidak dihidupkan lagi; yang
  benar dibuat sebagai laporan baru.
- Laporan **Menunggu persetujuan** (terlambat) tidak dikoreksi: pembuat
  menariknya lalu membuat yang baru (4G-3a).

#### Koreksi dan batal sesudah dibayar (DRV-49)

- **Hanya Pemilik atau GM**, alasan wajib, tombol ditahan 3 detik. Hak ini
  tidak bisa diberikan ke jabatan lain. Tidak ada batas waktu: uang yang
  disusulkan atau dikembalikan dicatat sebagai baris baru bertanggal hari
  ia benar-benar bergerak, jadi bulan Keuangan yang sudah ditutup tidak
  disentuh (KEU-112).
- **Langkahnya sama dengan koreksi sebelum dibayar** (versi disimpan, fungsi
  "hitung bongkaran", baris Buku Upah ditulis ulang), ditambah **selisih per
  orang**: bagian versi baru dikurangi bagian versi sebelumnya. Orang yang
  dikeluarkan dari laporan: bagian barunya Rp0. Orang yang baru dimasukkan:
  bagian lamanya Rp0. **Batalkan** = semua bagian baru Rp0.
- Satu fungsi server **"selisih bongkaran"** (WAJ-04):
  - **Selisih plus (kurang dibayar):** lebih dulu mengurangi sisa lebih
    bayar orang itu **dari laporan yang sama** (bila ada); sisanya masuk
    **bayar susulan**.
  - **Selisih minus (lebih dibayar):** lebih dulu mengurangi susulan orang
    itu di laporan yang sama yang masih Menunggu bayar (bila ada); sisanya
    menjadi **lebih bayar**.
- Layar menampilkan akibatnya **dalam angka per orang** sebelum disimpan.
  Pembayaran pertama dan baris Buku Kasnya **tidak diubah**: uangnya memang
  sudah keluar sebesar itu.
- Orangnya diberi tahu: "Upah bongkaran 3 November dikoreksi: Rp44.800 →
  Rp42.300 (jumlah sak dibetulkan). Kelebihan Rp2.500 diperhitungkan di
  bongkaran Anda berikutnya."

#### Bayar susulan (DRV-49)

- Lahir otomatis dari koreksi sesudah dibayar: **satu susulan per koreksi
  per laporan**, berisi baris per orang yang kurang dibayar. Status
  **Menunggu bayar → Dibayar** (atau Dibatalkan bila koreksi berikutnya
  menghabiskannya).
- Tampil di tab "Belum dibayar" DRV-L11 dan Jadwal Bayar jalur bongkaran
  dengan label "Susulan LB-…", jatuh bayar hari lahirnya, ikut pengingat
  yang sama.
- Dibayar dengan **langkah bayar yang sama** (DRV-L17): Finance, Pemilik,
  atau GM; tempat uang; tanggal uang; diserahkan kepada; lebih bayar orang
  itu dari laporan lain ikut diperhitungkan. **Satu baris Buku Kas per
  susulan**, bertaut ke laporannya (KEU-25).

#### Lebih bayar (DRV-49; B5)

- Lahir otomatis dari koreksi atau batal sesudah dibayar: satu baris per
  orang per koreksi: nominal, laporan asal, tanggal lahir. **Sisa lebih
  bayar tidak disimpan**: dihitung dari nominal dikurangi yang sudah
  diperhitungkan, dikembalikan tunai, atau dihapus (WAJ-04).
- **Diperhitungkan di pembayaran bongkaran berikutnya orang itu (B5):**
  saat laporan atau susulan berikutnya yang memuat orang itu dibayar,
  server mengambil sisa lebih bayarnya, **yang paling lama lebih dulu**,
  **sampai habis atau sampai bagiannya di pembayaran itu Rp0**. Yang belum
  tertutup menunggu bongkaran berikutnya. Uangnya memang sudah ia terima
  lebih dulu, jadi ini bukan potongan dan bukan hukuman.
- **Tidak diambil dari slip** dan tidak menjadi Potongan Lain (DRV-48, 49).
- **Lewat 30 hari** sejak lahir masih bersisa: ditandai untuk Pemilik dan
  GM (Antrean, sekali; lalu tampil di DRV-L21 sampai diputuskan).
  Keputusannya, yang juga boleh diambil kapan pun sebelum 30 hari:
  - **Tagih tunai:** baris bertanda "Ditagih tunai"; Finance, Pemilik, atau
    GM mencatat **Terima pengembalian** saat uangnya diterima (nominal
    paling banyak sebesar sisa; tempat uang; tanggal uang). Baris Buku Kas
    **uang masuk** kejadian "Pengembalian lebih bayar bongkaran", bertaut ke
    laporan asal. Selama belum diterima, perhitungan otomatis di bongkaran
    berikutnya **tetap berjalan**.
  - **Hapus** dengan alasan: sisa menjadi Rp0, berstatus Dihapus. Tidak ada
    uang yang bergerak dan tidak ada baris Buku Kas baru (uangnya sudah
    tercatat keluar saat laporan asal dibayar).
- Angka 30 hari adalah pengaturan (DRV-85).
- Orangnya melihat sisa lebih bayarnya di Pendapatan Saya, beserta laporan
  asal dan di pembayaran mana ia diperhitungkan.

#### Batal bayar

- Untuk pembayaran yang **salah catat** (salah tempat uang, salah tanggal,
  tertandai padahal uang belum diberikan). **Pemilik atau GM**, alasan
  wajib, tombol ditahan 3 detik, kapan pun selama pembayaran Berlaku
  (sejalan GAJ-103).
- Satu langkah: pembayaran Dibatalkan; baris Buku Kas dibatalkan lewat
  Keuangan (bulan tertutup: koreksi di bulan berjalan, KEU-112); pasangan
  Catatan Cepat dilepas; lebih bayar yang diperhitungkan di pembayaran itu
  **hidup kembali**; laporan kembali Berlaku (atau susulan kembali Menunggu
  bayar) dan masuk daftar bayar; peserta dan para pemilik diberi tahu.
- **Ditolak** bila laporan itu sudah dikoreksi atau dibatalkan sesudah
  dibayar (sudah ada susulan atau lebih bayar yang lahir darinya); jalan
  keluarnya koreksi lagi.

#### Laporan bongkaran per orang dan yang dilihat peserta (DRV-53)

- **Bongkaran per Orang** (DRV-L22): per orang dalam rentang yang dipilih
  (bawaan periode **26–25** berjalan): karyawan atau pekerja lepas, berapa
  kali ikut, kg bagiannya (total kg laporan dibagi jumlah peserta), jumlah
  bagian, sudah diterima, belum dibayar, sisa lebih bayar. Dibuka menjadi
  daftar laporannya. Untuk Pemilik, GM, Finance, dan Kepala Gudang (DRV-82:
  mereka yang mencatat dan membayar); HR tidak membuka.
- **Peserta** tidak mendapat layar baru. Kartu bongkaran di Pendapatan Saya
  (GAJ-L39, DRV-53) menampilkan: tanggal, kg, jumlah peserta, bagiannya,
  status (Belum dibayar; Dibayar tanggal …, diserahkan lewat …; Dikoreksi
  dari … menjadi …; Susulan menunggu; Dibatalkan), yang diperhitungkan ke
  lebih bayar, dan tombol "Uang belum saya terima" selama masanya. Tanpa
  nama dan bagian orang lain.
- **Total Diterima per Orang** (GAJ-114) membaca pembayaran bongkaran dari
  rincian per peserta di sini; tidak menghitung ulang.

#### Tambahan di DRV-L11 dan DRV-L13 (titipan 4G-3a)

- **DRV-L11:** tab "Belum dibayar" memuat laporan Berlaku dan susulan
  Menunggu bayar, dengan centang per baris dan tombol **Bayar terpilih (n,
  Rp…)** (Finance, Pemilik, GM) yang membuka DRV-L17. Kepala tab menampilkan
  jumlah, rupiah, dan yang paling lama. Tab baru **Lebih bayar** (DRV-L21)
  dan **Per orang** (DRV-L22). Label baris bertambah: Dikoreksi, Ditanyakan
  Finance, Susulan, Belum diterima (ada laporan peserta yang menunggu).
- **DRV-L13:** tombol menurut status dan jabatan: **Bayar** dan **Tanyakan
  dulu** (Finance, Pemilik, GM; laporan Berlaku); **Jawab** (pembuat;
  laporan Ditanyakan); **Koreksi** dan **Batalkan** (Kepala Gudang sebelum
  dibayar; Pemilik, GM kapan pun); **Batal bayar** (Pemilik, GM; laporan
  Dibayar). Bagian baru **Pembayaran**: tanggal uang, pembayar, tempat uang
  (hanya untuk Finance, Pemilik, GM), diserahkan kepada, rincian diterima
  per peserta, susulan, dan lebih bayar. Bagian **Riwayat** memuat tiap
  versi dan bisa dibuka untuk melihat isi lamanya.

#### DRV-L17. Bayar Bongkaran (3 langkah, TAM-07)

- **Letak:** dari tab "Belum dibayar" DRV-L11, DRV-L13, dan baris bongkaran
  Jadwal Bayar (GAJ-L33). **PC**; terbaca dan bisa dipakai di **HP**.

1. **Yang dibayar:** tiap laporan atau susulan terpilih: nomor, tanggal
   kerja, supplier, total kg, **tanda-tandanya**, foto surat jalan (ketuk),
   lalu tabel peserta: bagian, diperhitungkan lebih bayar, **diterima**.
   Yang tidak bisa dibayar (sudah Dibayar, penekan peserta atau pembuatnya)
   tampil terpisah "tidak ikut" dengan sebabnya. Jumlah uang yang keluar di
   bawah.
2. **Dari mana, kapan, kepada siapa:** tempat uang (yang boleh dipakai
   penekan; bawaan yang terakhir ia pakai untuk bongkaran), tanggal uang
   (B1), diserahkan kepada (B2; per laporan, boleh "sama untuk semua"),
   foto bukti (dianjurkan).
3. **Bayar:** ringkasan dalam kalimat ("2 laporan, 6 orang, Rp223.700 dari
   Kas Pegangan, tanggal 3 November, diserahkan lewat Hadi"); tombol
   ditahan 3 detik (TAM-15). Hasil: berapa dibayar, berapa gagal dan
   sebabnya.

#### DRV-L18. Koreksi Laporan Bongkaran (3 langkah)

- **Letak:** dari DRV-L13. **HP** (Kepala Gudang) dan **PC.**

1. **Ubah isi:** langkah 1 s.d. 4 DRV-L12 terbuka dengan isi laporan itu;
   yang berubah diberi tanda.
2. **Akibat:** lama → baru untuk total kg, total upah, dan bagian tiap
   orang. Sesudah dibayar: selisih per orang, siapa yang disusulkan dan
   berapa, siapa yang lebih bayar dan berapa.
3. **Alasan dan simpan:** alasan wajib; tombol ditahan 3 detik. Pesan:
   "LB-… dikoreksi. Finance diberi tahu jumlah barunya Rp169.200." atau
   "Susulan Rp10.000 untuk 4 orang menunggu dibayar Finance."

#### DRV-L19. Batalkan Laporan Bongkaran (2 langkah)

1. **Akibat:** sebelum dibayar: "4 baris upah Rp179.200 dibatalkan; laporan
   keluar dari daftar bayar." Sesudah dibayar: "Rp179.200 sudah diterima 4
   orang; menjadi lebih bayar masing-masing dan diperhitungkan di bongkaran
   mereka berikutnya."
2. **Alasan dan batalkan:** alasan wajib; tombol ditahan 3 detik.

#### DRV-L20. Batal Bayar Bongkaran (3 langkah)

1. **Pembayaran:** laporan atau susulan, uang yang keluar, tanggal uang,
   tempat uang, pembayar, diserahkan kepada, asal (tombol Bayar atau Catatan
   Cepat).
2. **Alasan** dan **akibatnya** dalam kalimat (baris Buku Kas dibatalkan,
   lebih bayar yang diperhitungkan hidup kembali, laporan kembali Berlaku).
3. **Batalkan:** tombol ditahan 3 detik. Hanya Pemilik dan GM.

#### DRV-L21. Lebih Bayar Bongkaran

- **Letak:** tab di Kantor › Gaji › Bongkaran. **PC.**
- **Kepala:** jumlah orang dan rupiah yang masih bersisa; berapa yang sudah
  lewat 30 hari.
- **Isi:** tiap baris: orang, karyawan atau pekerja lepas, laporan asal,
  tanggal lahir, nominal, sudah diperhitungkan (di pembayaran mana), sisa,
  umur, status (Berjalan, Ditagih tunai, Lunas, Dihapus). Saring: status,
  lewat 30 hari, orang.
- **Tombol:** **Tagih tunai** dan **Hapus** (Pemilik, GM; alasan wajib,
  Hapus ditahan 3 detik); **Terima pengembalian** (Finance, Pemilik, GM;
  nominal, tempat uang, tanggal uang; ditahan 3 detik).
- **Beda jabatan:** Finance melihat semua dan hanya punya Terima
  pengembalian; Kepala Gudang membaca tanpa tombol.

#### DRV-L22. Bongkaran per Orang

- **Letak:** tab di Kantor › Gaji › Bongkaran. **PC.**
- **Isi:** seperti diuraikan di atas; rentang bawaan periode 26–25
  berjalan, bisa diganti (rentang panjang dimuat saat diminta, PRI-11).
  Saring: karyawan atau pekerja lepas, cabang orang. **Cari** nama.
- **Tombol:** **Unduh** Excel (dibuat server, bertanggal dan bernama
  pembuat, KEU-116). Ketuk orang membuka daftar laporannya.
- **Dipakai:** Pemilik, GM, Finance, Kepala Gudang. HR tidak.

### 3.5 Bagian 4G-4a: Kasbon, mengajukan sampai uang diberikan

**Disetujui penuh 14 Oktober 2026** (K1 s.d. K7 "ok", sesuai saran; bagian
13). Isi di bawah ditulis memakai saran Claude; aturannya DRV-121 s.d. 130 (bagian
3.21 `../../aturan/05-gaji-driver-kasbon.md`).

**Pokoknya:** kasbon adalah **satu jenis pengajuan** di Mesin Pengajuan,
sama untuk semua orang. Server memeriksa tiga syarat sebelum menyimpan.
**Finance memeriksa** dan boleh mengusulkan angka; **Pemilik atau GM
memutuskan** angka akhirnya. Uang baru dianggap keluar saat **langkah
"Serahkan uang"** dikerjakan, dengan tempat uang yang wajib dipilih. Sejak
itu cicilan berjalan (4G-4b).

Pelajaran sistem lama (arsip 5C): dua sistem kasbon dan tiga tabel; plafon
Rp0 untuk semua dan "melebihi limit" hanya tulisan merah; kasbon dianggap
cair begitu disahkan (57 pencairan tanpa sumber dana); mengesahkan dua
langkah lepas sehingga bisa sah tanpa cicilan; karyawan bisa mengajukan atas
nama orang lain dan pengisinya tidak tercatat; pengajuan tidak dijawab
sampai 11 hari; kasbon driver berarti uang diberikan dulu baru dicatat saat
gajian.

#### Perjalanan satu kasbon (DRV-54, 61 s.d. 63, 72)

Status pengajuan milik Mesin Pengajuan (PRI-37); kasbon hanya membacanya
(WAJ-03) dan menambah dua keadaan sesudah Disetujui.

| Yang tampil | Artinya | Lahir saat |
|---|---|---|
| **Menunggu** | Tersimpan, lolos tiga syarat; menunggu diperiksa Finance | Kirim pengajuan |
| **Diperiksa** | Finance sudah memeriksa; menunggu keputusan Pemilik atau GM | Finance menekan Sudah diperiksa |
| **Ditolak** | Diputuskan tidak diberikan; alasan tampil ke pengaju | Pemilik atau GM menolak |
| **Dibatalkan (ditarik)** | Pengaju menarik sebelum diputuskan | Pengaju menekan Batalkan |
| **Disetujui, belum diberikan** | Angka akhir dan pembagian cicilan sudah tersimpan; uangnya belum diserahkan | Pemilik atau GM menyetujui |
| **Sudah diberikan** | Ada satu penyerahan uang yang Berlaku; cicilan berjalan (4G-4b) | Langkah Serahkan uang |
| **Dibatalkan** | Disetujui lalu dibatalkan sebelum uang diberikan | Pemilik atau GM membatalkan |

Kasbon bernomor (KB-…), tidak dihapus (PRI-02, DRV-83), dan punya satu
jenis: **biasa**, **Khusus** (dibuat di 4G-4b), atau **bawaan sistem lama**
(SIS-28).

#### Tiga syarat saat mengajukan (DRV-55 s.d. 58)

Satu fungsi server **"periksa kasbon"** (WAJ-04) dijalankan saat pengajuan
dikirim, untuk pengajuan sendiri maupun atas nama. Urutannya tetap; gagal di
satu langkah berarti **tidak ada yang tersimpan** dan langkah berikutnya
tidak diperiksa:

1. **Masa kerja.** Orangnya aktif, bukan Freelance (DRV-45), dan sudah
   bekerja paling sedikit **6 bulan**: hari ini sama dengan atau sesudah
   tanggal bergabung ditambah 6 bulan kalender (bergabung 20 April → boleh
   mulai 20 Oktober; tanggal yang tidak ada di bulan itu memakai hari
   terakhir bulan itu). Tanggal bergabung dibaca dari Karyawan (SIS-24).
   Gagal: "Kasbon baru bisa diajukan setelah 6 bulan bekerja. Kalau
   mendesak, hubungi GM."
2. **Batas orangnya.** **Terpakai** orang itu ditambah nominal baru tidak
   boleh lebih dari batas per orang (Rp250.000). Gagal: kalau ia punya
   kasbon biasa yang masih bersisa atau pengajuan yang masih menunggu,
   "Pastikan Anda sudah membayar kasbon lama. Ditolak karena kasbon lama
   masih banyak."; kalau tidak punya, kalimat langkah 3. Angka batas tidak
   pernah dikirim ke layar karyawan.
3. **Sisa Dana Kasbon.** Terpakai seluruh dana itu ditambah nominal baru
   tidak boleh lebih dari besar dana (Rp1.000.000). Dananya mengikuti
   **slip utama orang itu pada hari mengajukan** (DRV-04): bulanan atau
   mingguan. Gagal: "Kasbon belum bisa diajukan saat ini. Silakan coba lagi
   setelah gajian."

**"Terpakai"** dihitung satu fungsi (WAJ-04), tidak disimpan:

| Keadaan kasbon biasa | Yang dihitung |
|---|---|
| Menunggu atau Diperiksa | nominal yang **diajukan** |
| Disetujui, belum diberikan | nominal **akhir** |
| Sudah diberikan | **sisa** utangnya (rumus sisa di 4G-4b, DRV-67) |
| Bawaan sistem lama | sisanya (SIS-28) |
| Ditolak, ditarik, dibatalkan, lunas | Rp0 |
| Kasbon Khusus | **tidak dihitung**, di batas orang maupun di dana (DRV-75) |

- Dana "terisi lagi" dengan sendirinya: pengajuan yang ditolak, ditarik,
  atau dibatalkan langsung berhenti dihitung; nominal yang diturunkan saat
  disetujui langsung mengecilkan yang terpakai (DRV-57).
- Batas, besar dana, dan syarat masa kerja dibaca dari pengaturan yang
  berlaku **pada hari mengajukan** (WAJ-07, DRV-85).
- Saat **menyetujui**, batas dan dana **tidak diperiksa ulang**: nominalnya
  sudah terpesan sejak diajukan dan hanya bisa turun.
- **Satu pengajuan kasbon yang menunggu per orang.** Pengajuan kedua
  selagi yang pertama masih Menunggu atau Diperiksa ditolak (BER-L06,
  kembar): "Masih ada pengajuan kasbon yang menunggu. Batalkan dulu kalau
  ingin mengubahnya." Kasbon berjalan lebih dari satu tetap boleh selama di
  dalam batas (DRV-56).

#### Mengajukan (DRV-59, 60; K1)

- **Untuk diri sendiri**, dari Pengajuan Saya (BER-L05) atau Kasbon Saya
  (DRV-L23). Server mengisi "untuk siapa" dari akun yang masuk; isian nama
  dari layar diabaikan (pelajaran DRV-C06).
- **Isi:** nominal, kali potong (1, 2, atau 3), dan alasan paling sedikit
  15 huruf.
- **Nominal (K1):** kelipatan **Rp10.000**, paling sedikit **Rp50.000**
  (dua-duanya pengaturan). Batas atas tidak ditampilkan; yang terlalu besar
  ditolak langkah 2 atau 3 di atas.
- Layar menampilkan perkiraan cicilan dari angka yang diketik ("2 kali
  potong: Rp75.000 tiap gajian") dan kalimat "Angka ini bisa diubah saat
  diperiksa. Yang berlaku adalah yang disetujui."
- **Sesudah tersimpan** (DRV-60): "Kasbon diproses paling cepat 2 hari
  setelah pengajuan, tidak bisa langsung cair." Finance diberi tahu ada
  pengajuan untuk diperiksa.
- **Di BER-L05**, tombol Kasbon tampil redup dengan alasannya bila syarat
  masa kerja belum terpenuhi atau masih ada pengajuan yang menunggu. Batas
  dan dana baru bisa diperiksa sesudah nominal diketik.
- Pengajuan tidak bisa diubah sesudah terkirim; yang salah **ditarik** lalu
  diajukan baru.

#### Diisikan atas nama (DRV-59)

- Oleh pemegang hak "isikan kasbon atas nama": **HR dan Admin HR** (KAR-77;
  kasbon bukan gaji atau slip), juga Pemilik dan GM. **Bukan untuk dirinya
  sendiri**; miliknya sendiri lewat jalan biasa.
- Server menjalankan "periksa kasbon" yang sama atas orang yang diisikan.
- Tercatat **diisi oleh** dan **untuk siapa** (kolom Mesin Pengajuan).
  Orangnya diberi tahu lewat Antrean, melihat kartunya bertanda "diisi oleh
  …" (BER-L04), dan boleh menariknya.
- Pengisi boleh membatalkan pengajuan yang salah orang sebelum diputuskan
  (kejadian 16 spec 4B).

#### Pemeriksaan Finance (DRV-61 huruf a; K2, K3)

- Pemeriksa = pemegang hak "periksa kasbon" (isi awal: Finance). Dibuka dari
  Persetujuan (BER-L20) atau tab "Menunggu diperiksa" DRV-L26, lalu DRV-L27.
- Finance boleh **mengusulkan**: nominal lebih kecil (tetap kelipatan
  Rp10.000 dan paling sedikit Rp50.000) dan kali potong lain (1 s.d. 3).
  Mengubah angka wajib catatan paling sedikit 15 huruf. Lalu menekan
  **Sudah diperiksa**: status menjadi Diperiksa, Pemilik dan GM diberi tahu.
- **Finance tidak menolak dan tidak menyetujui** (DRV-61, 82). Kalau
  menurutnya sebaiknya ditolak, ia menulisnya di catatan pemeriksaan. Tombol
  Tolak pemeriksa di BER-L21 tidak dipakai untuk jenis ini.
- Usulan Finance **tidak tampil ke karyawan**; ia hanya melihat status
  Diperiksa (DRV-61: karyawan melihat yang diajukan dan yang disetujui).
- **Finance tidak memeriksa pengajuannya sendiri (K3).** Diperiksa Finance
  lain bila ada; bila tidak ada, langsung ke Pemilik atau GM.
- **Pemilik atau GM boleh memutuskan tanpa menunggu pemeriksaan (K2)**,
  misalnya Finance libur. Kasbonnya bertanda "tanpa pemeriksaan Finance"
  dan Finance diberi tahu hasilnya.
- **Keterangan pembantu** di DRV-L27 untuk Finance: masa kerja, kasbon biasa
  orang itu yang berjalan dan sisanya, pengajuan dan penolakan 6 bulan
  terakhir, Kasbon Khusus yang berjalan. **Tanpa** gaji dan slip (PRI-24).

#### Keputusan Pemilik atau GM (DRV-61 huruf b, 62)

- Penyetuju = Pemilik atau GM, **bukan untuk kasbonnya sendiri** (kasbon GM
  diputuskan Owner dan sebaliknya; PRI-37 butir 3, DRV-62). Hak ini **tidak
  bisa diberikan** ke jabatan lain.
- **Angka akhir:** isian awalnya usulan Finance (kalau ada), selain itu
  angka yang diajukan. Boleh diubah lagi. Nominal akhir paling banyak
  sebesar **yang diajukan** (boleh kembali ke angka pengaju walau Finance
  mengusulkan lebih kecil), kelipatan Rp10.000, paling sedikit Rp50.000;
  kali potong 1 s.d. 3. Mengubah dari angka pengaju wajib catatan, yang
  dibaca pengaju.
- **Setujui** (ditahan 3 detik, TAM-15; jendela menyebut "Rp150.000, 2 kali
  potong Rp75.000") adalah **satu langkah utuh di server**: status
  pengajuan Disetujui, nominal akhir dan kali potong akhir, dan **baris
  cicilan** tersimpan bersama atau tidak sama sekali.
- **Baris cicilan** dibuat fungsi "bagi cicilan" (DRV-65): nominal akhir
  dibagi rata, dibulatkan ke bawah ke rupiah, sisanya di cicilan terakhir
  (Rp250.000 × 3 = Rp83.333, Rp83.333, Rp83.334). Saat ini cicilan **belum
  punya slip tujuan**; slip tujuannya dipasang saat uang diberikan (4G-4b).
- **Tolak:** alasan wajib, dibaca pengaju. Pengaju boleh **Ajukan ulang**
  (BER-L07); tiga syarat diperiksa lagi dari awal.
- **Keterangan pembantu** untuk Pemilik dan GM: semua yang dilihat Finance,
  ditambah usulan dan catatan Finance, sisa batas orang itu, sisa kedua Dana
  Kasbon, dan perkiraan bersih slip utama berikutnya orang itu (dibaca dari
  fungsi hitung slip Gaji, tidak dihitung ulang).
- Sesudah disetujui: pengaju diberi tahu ("Kasbon Rp150.000 disetujui, 2
  kali potong. Uangnya akan diserahkan Finance."; bila diturunkan, angka
  yang diajukan ikut disebut beserta catatannya) dan Finance diberi tahu
  untuk menyerahkan uang (DRV-63).

#### Menyerahkan uang (DRV-63; K3, K4, K5)

Finance, Pemilik, atau GM, dari tab "Menunggu diberikan" DRV-L26 atau
DRV-L28, lalu DRV-L29. Berlaku sama untuk kasbon biasa dan Kasbon Khusus
(DRV-76). Dalam satu langkah utuh di server:

1. **Periksa:** penekan punya hak "serahkan uang kasbon"; kasbon
   berkeadaan Disetujui, belum diberikan; belum ada penyerahan Berlaku
   (**satu kasbon cair sekali**); tidak ada permintaan batal yang menunggu;
   tempat uang dipilih (KEU-05). **Penyerah bukan penerima kasbon itu
   (K3).** Pemilik dan GM tetap boleh menyerahkan untuk dirinya; tercatat
   dan para pemilik diberi tahu (sejalan DRV-111).
2. **Nominal** = nominal akhir, penuh dan sekali. Tidak ada isian nominal.
3. **Tanggal uang (K4):** isian awal hari ini; boleh mundur sampai 7 hari
   (lebih jauh dengan alasan, KEU-12), **tidak sebelum tanggal kasbon itu
   disetujui** dan tidak masa depan. Jam catat dari server (PRI-01). Angka
   7 hari dibaca dari pengaturan tanggal uang Gaji (GAJ-99).
4. **Diserahkan kepada (K5):** "langsung ke orangnya" atau dititipkan lewat
   **satu nama** karyawan aktif.
5. **Simpan penyerahan:** kasbon, tanggal uang, jam catat, penyerah, tempat
   uang, cara (tunai atau transfer, dari jenis tempat uang), nominal,
   diserahkan kepada, foto bukti (KEU-11, isi awal dianjurkan).
6. **Baris Buku Kas** lewat fungsi Keuangan (4H) "tulis uang keluar dari
   modul" (KEU-23, 25): satu baris, kejadian **Kasbon diberikan** (bukan
   biaya, KEU-22), bertaut ke kasbonnya, cabang = cabang orangnya pada
   tanggal uang, uraian "KB-…, Dedi, Rp150.000, 2 kali potong".
7. **Slip tujuan cicilan dipasang** oleh fungsi "pasang jadwal" milik 4G-4b
   (DRV-65), di dalam langkah yang sama.
8. Kasbon menjadi **Sudah diberikan**. Orangnya diberi tahu: "Kasbon
   Rp150.000 sudah diberikan tanggal 4 November lewat tunai. Dipotong 2
   kali mulai gajian …"

- **Catatan Cepat kotak "Kasbon" (KEU-18, 28):** kalau uangnya sudah keluar
  dan dicatat lewat Catatan Cepat, Finance **memasangkannya** ke kasbon
  yang Disetujui, belum diberikan (layar Keuangan, 4H). Nominal harus
  **sama persis** dengan nominal akhir. Kasbon menjadi Sudah diberikan atas
  nama pencatatnya, dengan tempat dan tanggal uang dari catatan itu. Bila
  tanggal catatan itu **sebelum** kasbonnya disetujui, penyerahan tetap
  diterima (uangnya memang sudah keluar) dan bertanda "uang keluar sebelum
  disetujui" untuk Pemilik dan GM.
- **Catatan Cepat "Kasbon" tanpa kasbon yang cocok** tidak boleh menjadi
  kasbon dengan sendirinya: Finance menandainya "perlu ditanyakan"
  (KEU-32). Jalan keluarnya: kasbonnya diajukan (atau diisikan HR) dan
  disetujui dulu, atau Pemilik atau GM membuat Kasbon Khusus (4G-4b), lalu
  dipasangkan.
- **Tidak ada jalan lain:** kejadian "Kasbon diberikan" tidak bisa diketik
  di Buku Kas (KEU-23). Tidak ada kasbon yang langsung berstatus diberikan
  tanpa lewat pengajuan atau Kasbon Khusus.
- Serah uang tidak ditolak karena saldo tempat uang; penjaga saldo milik
  Keuangan (KEU-106).

#### Uang belum saya terima (K5)

- Sesudah diberi tahu "sudah diberikan", orangnya melihat tombol **Uang
  belum saya terima** di kartu kasbon itu (DRV-L23) selama **3 hari**.
  Isinya tulisan singkat (paling sedikit 15 huruf).
- Tersimpan sebagai pengajuan jenis **"Uang kasbon belum diterima"**
  (PRI-23, 37), diputuskan **Pemilik atau GM**; penyerah dan orang yang
  dititipi diberi tahu. Keputusan: **Sudah diselesaikan** (catatan wajib)
  atau **Tidak terbukti** (alasan wajib).
- Tidak ada akibat uang otomatis dan cicilan tidak tertahan sendiri. Bila
  uangnya memang belum diberikan, jalan keluarnya **Batal serah uang**.

#### Menarik, minta dibatalkan, dan membatalkan sebelum uang diberikan (DRV-72)

- **Menunggu atau Diperiksa:** pengaju (atau pengisinya) menekan
  **Batalkan** di BER-L07 dengan alasan. Yang terpakai langsung lepas.
- **Disetujui, belum diberikan:** pengaju menekan **Minta dibatalkan**
  (BER-L07) dengan alasan, misalnya tidak jadi butuh atau angkanya
  diturunkan terlalu jauh. Selama permintaan itu menunggu, **serah uang
  ditolak server**. Pemilik atau GM memutuskan: Batalkan, atau Tetap
  berjalan.
- **Batalkan (DRV-L30):** hanya Pemilik atau GM, alasan wajib, tombol
  ditahan 3 detik; boleh juga tanpa diminta (DRV-72). Kasbon Dibatalkan,
  baris cicilannya ikut Dibatalkan, yang terpakai lepas; pengaju dan
  Finance diberi tahu. Kasbon batal tidak dihidupkan lagi; yang masih butuh
  mengajukan baru.
- **Sudah diberikan:** kasbon tidak dibatalkan (DRV-72). Yang ada hanya
  Batal serah uang di bawah, untuk **catatan penyerahan yang salah**.

#### Batal serah uang (K6)

- Untuk penyerahan yang **salah catat**: salah tempat uang, salah tanggal,
  atau tertandai padahal uangnya belum diberikan. **Hanya Pemilik atau GM**,
  alasan wajib, tombol ditahan 3 detik (sejalan GAJ-103, DRV-119).
- **Syarat:** belum ada cicilan kasbon itu yang terpotong, dilunasi tunai,
  atau dihapus. Sesudah itu ditolak; jalan keluarnya urusan 4G-4b
  (pelunasan atau hapus utang) dan koreksi di Keuangan.
- Satu langkah: penyerahan Dibatalkan; baris Buku Kas dibatalkan lewat
  Keuangan (bulan tertutup: koreksi di bulan berjalan, KEU-112); pasangan
  Catatan Cepat dilepas; slip tujuan cicilan dilepas; kasbon **kembali
  Disetujui, belum diberikan** dan masuk daftar menunggu diberikan;
  orangnya, Finance, dan para pemilik diberi tahu.
- Ini **bukan membatalkan kasbon**: persetujuannya tetap. Sesudahnya uang
  diserahkan ulang dengan catatan yang benar, atau kasbonnya dibatalkan
  lewat DRV-L30 bila memang tidak jadi.

#### Tanda 2 hari dan pengingat (DRV-64; K7)

- **Selama menunggu:** pengajuan tampil di Persetujuan pemeriksa dan
  penyetujunya dan ikut pengingat berantai sekali sehari (PRI-37 butir 4,
  TAM-22), satu jendela untuk jenis kasbon (TAM-25).
- **Lewat 2 hari sejak diajukan** (48 jam, jam server) belum Disetujui atau
  Ditolak: kasbon bertanda **"Lewat 2 hari"** dan tampil di "perlu
  perhatian" **Finance, Pemilik, dan GM** sampai diputuskan.
- **Disetujui, belum diberikan:** langsung masuk "perlu perhatian" Finance.
  Mulai **07.00 keesokan harinya**, setiap hari, pengingat berantai ke
  Finance, Pemilik, dan GM sampai diberikan atau dibatalkan: "Ada 2 kasbon
  disetujui belum diberikan, Rp300.000, paling lama sejak 3 November."
- **Hari kalender, bukan hari kerja Finance (K7).** Libur Finance tidak
  menunda tanda: tandanya bukan teguran untuk Finance, dan Pemilik atau GM
  bisa memutuskan dan menyerahkan uang sendiri. Di samping tanda tampil
  "Finance libur hari ini" bila begitu jadwalnya.
- **Tidak ada yang ditolak, hangus, atau disetujui otomatis** (DRV-64,
  PRI-37).
- Kasbon menunggu diberikan **tidak masuk Jadwal Bayar** (DRV-81 hanya
  memuat tiga jalur upah); tempatnya tab "Menunggu diberikan" (DRV-79).

#### Yang dilihat tiap orang (DRV-78, 79, 82)

- **Karyawan:** kasbonnya sendiri utuh: status, nominal diajukan dan
  disetujui, kali potong, catatan penyetuju, sudah diberikan atau belum
  (tanggal, cara, lewat siapa). Tidak dikirim server: angka batas, sisa
  dana, usulan dan catatan Finance, nama tempat uang.
- **Finance:** semua kasbon biasa dan Khusus, tanpa gaji dan slip.
- **HR dan Admin HR:** daftar dan rincian kasbon (pelihat tambahan, peta
  modul), tanpa tempat uang; tanpa tombol selain Isikan atas nama.
- **Pemilik dan GM:** semuanya, termasuk sisa kedua Dana Kasbon.
- **Kepala Gudang, kepala cabang:** hanya kasbonnya sendiri.

#### DRV-L23. Kasbon Saya

- **Letak:** Saya › Kasbon Saya. **HP.**
- **Kepala:** tombol besar **Ajukan Kasbon** (redup dengan alasannya bila
  belum 6 bulan atau masih ada pengajuan menunggu).
- **Isi:** kartu per kasbon, terbaru di atas: nomor, nominal (diajukan →
  disetujui bila berbeda), kali potong, label status, tanggal diajukan,
  "diisi oleh …" bila atas nama. Ketuk kartu: alasan, riwayat (siapa
  berbuat apa dan kapan), catatan penyetuju atau alasan penolakan, dan
  keterangan penyerahan. Bagian cicilan dan sisa diisi 4G-4b.
- **Tombol di kartu menurut keadaan:** Batalkan (Menunggu, Diperiksa);
  Ajukan ulang (Ditolak); Minta dibatalkan (Disetujui, belum diberikan);
  Uang belum saya terima (3 hari sesudah diberikan).
- **Kalimat tetap** pada kartu yang menunggu: "Kasbon diproses paling cepat
  2 hari setelah pengajuan, tidak bisa langsung cair."

#### DRV-L24. Ajukan Kasbon (3 langkah, TAM-07)

- **Letak:** isi khas kerangka BER-L06. **HP.**

1. **Berapa dan berapa kali potong:** nominal (papan angka; tombol cepat
   Rp50.000, Rp100.000, Rp150.000, Rp200.000, Rp250.000 diambil dari
   kelipatan, bukan dari angka batas), pilihan 1, 2, atau 3 kali potong,
   perkiraan cicilan.
2. **Alasan:** paling sedikit 15 huruf; penghitung huruf tampil.
3. **Kirim:** ringkasan ("Kasbon Rp150.000, 2 kali potong, dipotong dari
   gaji sesudah uang diberikan"); tombol ditahan 3 detik (TAM-15). Ditolak
   server: jendela "OK, paham" dengan kalimat syaratnya, isian tetap ada.
   Berhasil: kalimat DRV-60 dan "Menunggu diperiksa Finance."

#### DRV-L25. Isikan Kasbon atas Nama (4 langkah)

- **Letak:** tombol di DRV-L26. **PC.**

1. **Untuk siapa:** cari karyawan (lingkup S; dirinya sendiri tidak bisa
   dipilih). Tampil masa kerja; bila belum 6 bulan, berhenti di sini dengan
   kalimat DRV-55.
2. **Berapa dan berapa kali potong.**
3. **Alasan** (dari orangnya, paling sedikit 15 huruf).
4. **Kirim** (ditahan 3 detik). Pesan: "Pengajuan kasbon Dedi terkirim.
   Dedi diberi tahu dan bisa menariknya. Menunggu diperiksa Finance."

#### DRV-L26. Kasbon (daftar kantor)

- **Letak:** Kantor › Gaji › Kasbon. **PC**; terbaca di HP.
- **Kepala (hanya Pemilik dan GM):** sisa Dana Kasbon bulanan dan mingguan
  ("terpakai Rp700.000 dari Rp1.000.000").
- **Tab:** Menunggu diperiksa; Menunggu diputuskan; Menunggu diberikan;
  Berjalan dan Selesai (4G-4b); Ditolak dan dibatalkan. Tiap tab
  menampilkan jumlah dan rupiahnya.
- **Baris:** nomor, orang, cabang, slip utama, nominal diajukan → akhir,
  kali potong, lama menunggu, label (Lewat 2 hari, Diisi oleh …, Tanpa
  pemeriksaan Finance, Diminta dibatalkan, Belum diterima, Khusus).
  Urutan bawaan: terlama di atas. Saring: cabang, slip utama, jenis. Cari
  nama atau nomor.
- **Tombol:** Isikan atas nama (HR, Admin HR, Pemilik, GM); centang dan
  **Serahkan terpilih** tidak ada: tiap kasbon diserahkan sendiri-sendiri
  karena penerimanya berbeda.
- **Beda jabatan:** Finance bawaannya tab Menunggu diperiksa; Pemilik dan
  GM tab Menunggu diputuskan; HR hanya membaca.

#### DRV-L27. Periksa dan Putuskan Kasbon

- **Letak:** isi khas BER-L21; dari Persetujuan dan DRV-L26. **PC, HP.**
- **Isi:** pengaju (dan "diisi oleh"), nominal, kali potong, alasan, lama
  menunggu, riwayat, lalu **keterangan pembantu** menurut jabatan (lihat
  "Pemeriksaan Finance" dan "Keputusan").
- **Finance:** isian Usulan nominal dan Usulan kali potong (terisi angka
  pengaju), catatan, tombol **Sudah diperiksa**. Tidak ada Tolak.
- **Pemilik, GM:** isian Nominal akhir dan Kali potong akhir, perkiraan
  cicilan, catatan; tombol **Setujui** (ditahan 3 detik) dan **Tolak**
  (alasan wajib). Bila belum diperiksa Finance, tampil pita "Belum
  diperiksa Finance" dan tombol tetap aktif (K2).
- **Kasbon milik sendiri:** tampil redup "diputuskan penyetuju lain".

#### DRV-L28. Rincian Kasbon

- **Letak:** dari DRV-L26. **PC, HP.**
- **Bagian:** Pengajuan (angka pengaju, alasan, diisi oleh); Pemeriksaan
  (usulan dan catatan Finance; tidak untuk HR); Keputusan (angka akhir,
  catatan, oleh, kapan); Cicilan (nominal tiap cicilan; slip tujuan dan
  status diisi 4G-4b); Penyerahan (tanggal uang, penyerah, cara, diserahkan
  kepada; tempat uang hanya untuk Finance, Pemilik, GM); Riwayat.
- **Tombol menurut keadaan dan jabatan:** Periksa atau Putuskan (ke
  DRV-L27); **Serahkan uang** (Finance, Pemilik, GM); **Batalkan** (Pemilik,
  GM; Disetujui, belum diberikan); **Batal serah uang** (Pemilik, GM; Sudah
  diberikan dan belum ada cicilan terpotong).

#### DRV-L29. Serahkan Uang Kasbon (3 langkah, TAM-07)

1. **Yang diserahkan:** nomor, orang, nominal akhir (besar), kali potong,
   tanggal disetujui dan oleh siapa, tanda-tandanya. Bila penekan adalah
   penerimanya: berhenti dengan kalimat "Kasbon Anda sendiri diserahkan
   orang lain."
2. **Dari mana, kapan, kepada siapa:** tempat uang (yang boleh dipakai
   penekan), tanggal uang (K4), diserahkan kepada (K5), foto bukti
   (dianjurkan).
3. **Serahkan:** ringkasan dalam kalimat ("Rp150.000 untuk Dedi dari Kas
   Pegangan, tanggal 4 November, langsung ke orangnya; cicilan pertama
   masuk slip minggu 30 Oktober – 5 November"); tombol ditahan 3 detik.
   *(Contoh dibetulkan di 4G-4b: semula tertulis "minggu 6–12 November",
   tidak sesuai DRV-65.)*

#### DRV-L30. Batalkan Kasbon (2 langkah)

1. **Akibat:** "Kasbon KB-… Rp150.000 milik Dedi dibatalkan. Uangnya belum
   diberikan, jadi tidak ada uang yang bergerak. Dana Kasbon mingguan
   bertambah Rp150.000."
2. **Alasan dan batalkan:** alasan wajib; tombol ditahan 3 detik.

#### DRV-L31. Batal Serah Uang Kasbon (3 langkah)

1. **Penyerahan:** kasbon, nominal, tanggal uang, tempat uang, penyerah,
   diserahkan kepada, asal (tombol Serahkan atau Catatan Cepat).
2. **Alasan** dan **akibatnya** dalam kalimat (baris Buku Kas dibatalkan,
   jadwal cicilan dilepas, kasbon kembali menunggu diberikan).
3. **Batalkan:** tombol ditahan 3 detik. Hanya Pemilik dan GM.

### 3.6 Bagian 4G-4b: Kasbon, cicilan sampai lunas

**Disetujui penuh 14 Oktober 2026** (C1 s.d. C7 "ok", sesuai saran; bagian 13). Isi di bawah ditulis
memakai saran Claude; aturannya DRV-131 s.d. 142 (bagian 3.22
`../../aturan/05-gaji-driver-kasbon.md`).

**Pokoknya:** sesudah uang diberikan, sebuah kasbon hanya punya dua hal:
**jadwal cicilan** (rencana: berapa dipotong di slip mana) dan **catatan
berkurang** (mutasi: terpotong di slip, dilunasi tunai, dihapus, dialihkan
ke Piutang Lain). **Sisa = nominal diberikan dikurangi semua catatan
berkurang**, dihitung, tidak disimpan (DRV-67). Slip hanya membaca cicilan
dan menandainya saat ditutup (DRV-66). Jadwal tidak pernah diedit: setiap
perubahan (tunda, ubah jadwal, pindah slip utama, pelunasan sebagian)
menulis **versi jadwal baru**, dan yang lama tetap tersimpan.

Pelajaran sistem lama (arsip 5C): cicilan yang tidak terpotong tidak ikut
slip berikutnya; sisa kasbon disimpan sebagai angka dan rumusnya ditulis di
empat halaman; "Tandai Lunas" dipakai untuk pelunasan maupun pengikhlasan
tanpa jejak; menunda berarti mengetik potongan Rp0 sehingga jadwal tidak
bergeser; tidak ada aturan untuk orang yang berhenti; Rp4.661.529 potongan
kasbon di slip lama tidak bisa ditelusuri ke kasbon mana pun.

#### Keadaan kasbon sesudah diberikan (DRV-71)

Lanjutan tabel "Perjalanan satu kasbon" di bagian 3.5. Keadaan ini
**dihitung dari sisa dan mutasi**, bukan tombol:

| Yang tampil | Artinya | Lahir saat |
|---|---|---|
| **Berjalan** | Sudah diberikan, sisa lebih dari Rp0 | Serah uang (4G-4a) |
| **Lunas** | Sisa Rp0 karena terpotong, dilunasi tunai, atau dihapus | Mutasi terakhir membuat sisa Rp0 |
| **Dialihkan ke Piutang Lain** | Orangnya berhenti; sisa yang tidak tertutup slip terakhir pindah ke Buku Piutang Lain (KEU-74) | Slip terakhir ditutup |

Lunas dan Dialihkan kembali menjadi **Berjalan** bila sebabnya dibalik
(slip dibuka kembali, pelunasan atau hapus dibatalkan). Tanda kecil di
samping keadaan: **Khusus**, **Bawaan**, **Ditunda**, **Jadwal diubah**,
**Ada sisa dibawa**, **Akan berhenti**.

#### Sisa kasbon (DRV-67)

Satu fungsi server **"sisa kasbon"** (WAJ-04):

> sisa = nominal diberikan − jumlah mutasi Berlaku

Mutasi yang mengurangi: **terpotong di slip** (termasuk sisa potongan
kasbon yang baru terpotong di slip berikutnya), **dilunasi tunai**,
**dihapus**, **dialihkan ke Piutang Lain**. Mutasi yang dibalik tidak
dihitung. Untuk kasbon bawaan sistem lama, "nominal diberikan" adalah angka
sisa yang dibawa (SIS-28).

Sisa selalu sama dengan **cicilan yang masih Terjadwal** ditambah **sisa
potongan kasbon yang sedang dibawa** (tabel `sisa_potongan` milik Gaji,
GAJ-75). Kalau tidak sama, Pemeriksa kasbon memasukkannya ke "perlu
perhatian" GM. Fungsi ini dipakai oleh "terpakai" (4G-4a), Kasbon Saya,
Kasbon Berjalan, slip terakhir, dan Dana Kasbon.

#### Memasang jadwal (DRV-65)

Satu fungsi server **"pasang jadwal"** menentukan slip tujuan tiap cicilan
yang belum terpotong. Dipanggil oleh: serah uang (4G-4a langkah 7), tunda,
ubah jadwal, pindah slip utama, pelunasan atau hapus sebagian, dan
pembatalannya.

- **Cicilan pertama** masuk slip utama orang itu untuk periode yang memuat
  **tanggal uang**. Bila slip itu sudah Ditutup, masuk slip utama berikutnya
  yang belum ditutup. Cicilan berikutnya satu per slip utama, berturut-turut.
- **Contoh mingguan:** Dedi menerima Rp150.000 × 2 pada Rabu 4 November.
  Cicilan 1 di slip minggu 30 Oktober – 5 November (ditutup Jumat 6,
  dibayar Sabtu 7), cicilan 2 di minggu 6–12 November.
- **Contoh bulanan:** Rina menerima Rp150.000 × 2 pada 20 November. Cicilan
  1 di slip 26 Oktober – 25 November, cicilan 2 di slip 26 November – 25
  Desember.
- **Pembetulan contoh 4G-4a:** contoh di DRV-L29 menulis cicilan pertama
  "minggu 6–12 November" untuk uang 4 November. Menurut DRV-65 yang benar
  adalah minggu 30 Oktober – 5 November, karena slip itu belum ditutup pada
  4 November. Contohnya sudah dibetulkan (WAJ-10); aturannya tidak berubah.
- Slip tujuan ditunjuk dengan **orang + periode + slip utama**, bukan nomor
  slip, sehingga slip yang belum lahir tetap bisa dituju; Pembuat slip
  membuatnya nanti (4E-5a, DRV-94).
- **Versi jadwal:** setiap pemasangan ulang menandai cicilan Terjadwal yang
  lama **Diganti** dan menulis cicilan baru dengan nomor versi berikutnya,
  beserta sebabnya. Cicilan yang sudah Terpotong atau Sebagian tidak pernah
  disentuh.
- Slip tujuan **tidak pernah** slip yang sudah Ditutup, dan tidak pernah
  melewati slip terakhir orang yang tanggal berhentinya sudah dicatat.

#### Cicilan di slip (DRV-66; GAJ-75 kelompok d)

- Fungsi hitung slip milik Gaji memanggil **"cicilan jatuh tempo (orang,
  slip)"**: cicilan Terjadwal yang slip tujuannya slip itu, dari semua
  kasbon orang itu (biasa, Khusus, bawaan), yang **paling lama diberikan
  lebih dulu**. Sisa potongan kasbon yang dibawa diambil lebih dulu di
  kelompok (d) (GAJ-75, "utang lama dulu").
- Hanya **slip utama** yang membaca cicilan (DRV-04). Slip di luar slip
  utama dibayar utuh (DRV-05).
- Baris di slip: "Kasbon KB-0012, cicilan 2 dari 3: Rp75.000. Sisa sesudah
  ini Rp75.000."
- **Saat slip ditutup** (langkah 7 tutup slip Gaji), fungsi **"tandai
  cicilan"** menulis mutasi "terpotong di slip" sebesar yang benar-benar
  tertampung. Cicilan menjadi **Terpotong** (penuh) atau **Sebagian**.
  Bagian yang tidak tertampung ditulis Gaji sebagai `sisa_potongan` jenis
  kasbon yang menunjuk kasbon dan cicilannya, lalu ikut slip utama
  berikutnya. Saat sisa itu terpotong, "tandai cicilan" menulis mutasinya
  juga.
- **Contoh:** minggu Dedi sakit, pendapatan Rp50.000, cicilan Rp75.000:
  terpotong Rp50.000, sisa Rp25.000 dibawa ke minggu berikutnya; bersih
  Rp0 (DRV-24).
- Dana Kasbon terisi **sebesar yang terpotong, saat itu**, karena yang
  terpakai adalah sisa (DRV-57).
- **Buka kembali slip** (GAJ-95): fungsi **"balik tanda"** membalik
  mutasinya, cicilan kembali Terjadwal, dan sisa potongan yang lahir dari
  slip itu dibatalkan Gaji. Kasbon yang tadinya Lunas kembali Berjalan.
  **Batal bayar slip** tidak menyentuh cicilan (slipnya tetap Ditutup).
- Saat sisa menjadi Rp0: kasbon **Lunas** dengan sendirinya; orangnya
  diberi tahu "Kasbon KB-0012 sudah lunas" (DRV-71).

#### Tunda cicilan (DRV-68; C1)

- Pemilik kasbon menekan **Minta tunda** di kartu kasbon (DRV-L23); HR dan
  Admin HR boleh mengisikan atas namanya (sama dengan DRV-123). Tersimpan
  sebagai pengajuan **"Tunda cicilan kasbon"** (PRI-23, 37), alasan paling
  sedikit 15 huruf.
- **Syarat** (diperiksa server): kasbon Berjalan; jatah tunda kasbon itu
  belum terpakai (**1 kali per kasbon**, pengaturan); ada cicilan Terjadwal
  yang slipnya masih Perkiraan; tidak ada permintaan tunda lain yang
  menunggu untuk kasbon itu; orangnya belum punya tanggal berhenti.
- **Diputuskan Pemilik atau GM**, bukan untuk kasbonnya sendiri (DRV-L33).
- **Disetujui:** **semua** cicilan Terjadwal kasbon itu bergeser satu slip
  utama ("pasang jadwal" mulai slip sesudah slip cicilan terdekat). Sisa
  potongan yang sudah dibawa **tidak ikut** ditunda, karena itu potongan
  yang sudah jatuh tempo. Jatah terpakai.
- **Gugur (C1):** bila slip yang memuat cicilan terdekat ditutup sebelum
  permintaan diputuskan, permintaannya **gugur** ("Slip sudah ditutup
  sebelum diputuskan"), cicilan dipotong biasa, dan **jatah tidak
  terpakai**; orangnya boleh meminta lagi untuk cicilan berikutnya.
  Permintaan yang menunggu **bukan penahan** slip.
- **Ditolak:** alasan wajib; jatah tidak terpakai.
- **Contoh:** Dedi Rp150.000 × 3 (Rp50.000 per minggu), cicilan 1 sudah
  terpotong minggu 30 Oktober – 5 November. Selasa 10 November ia minta
  tunda karena anaknya sakit; GM menyetujui Rabu. Cicilan 2 pindah dari
  minggu 6–12 November ke 13–19 November, cicilan 3 ke 20–26 November.

#### Ubah jadwal oleh Pemilik atau GM (C2)

- Untuk keadaan yang tidak cukup diatasi tunda satu slip: orangnya sakit
  sebulan, atau cicilan terasa berat sesudah pindah slip utama. Pemilik
  atau GM, **bukan kasbonnya sendiri**, alasan wajib, tombol ditahan 3
  detik (DRV-L36). Boleh tanpa diminta.
- **Yang bisa diubah:** banyaknya cicilan sisa dan slip mulainya. **Jumlah
  rupiah tetap** sama dengan cicilan yang masih Terjadwal; sisa potongan
  yang dibawa tidak disentuh. Dibagi lagi dengan fungsi "bagi cicilan"
  (DRV-65).
- **Batas:** kasbon biasa paling banyak 3 kali sisa (pengaturan "paling
  banyak kali potong"); Kasbon Khusus paling banyak 12 (C7). Slip mulai
  belum ditutup dan paling jauh **3 slip utama** sesudah slip terbuka
  terdekat (pengaturan), supaya utang tidak menggantung.
- Tidak memakai jatah tunda karyawan; tercatat sebagai versi jadwal, dan
  orangnya diberi tahu jadwal barunya.

#### Pelunasan tunai (DRV-69; C3)

- Orangnya membayar ke Finance. **Finance, Pemilik, atau GM** mencatatnya
  (DRV-L34). **Penerima bukan pemilik kasbon itu** (sejalan K3); Pemilik
  dan GM tetap boleh untuk dirinya, tercatat dan diberitahukan ke para
  pemilik.
- **Nominal:** rupiah bulat, lebih dari Rp0, **paling banyak sebesar
  sisa**. Tombol "Lunasi semua" mengisi angka sisa. Boleh **sebagian**
  (C3).
- **Urutan pengurangan (C3):** sisa potongan kasbon yang dibawa lebih dulu,
  lalu **cicilan terdekat**, lalu berikutnya. Contoh: sisa Rp150.000 =
  cicilan November Rp75.000 + Desember Rp75.000; dilunasi Rp100.000 →
  November Rp0 (Diganti), Desember Rp50.000.
- **Uang masuk:** tempat uang wajib; tanggal uang boleh mundur sampai 7
  hari (lebih jauh dengan alasan), tidak sebelum tanggal kasbon diberikan
  dan tidak masa depan; jam catat dari server. Satu baris Buku Kas uang
  masuk berkejadian **"Pelunasan kasbon"**, bukan pendapatan (KEU-22, 25),
  lewat fungsi Keuangan (4H) "tulis uang masuk dari modul". Foto bukti
  dianjurkan.
- Satu langkah: pelunasan, mutasi, versi jadwal baru, dan baris Buku Kas
  tersimpan bersama atau tidak sama sekali.
- Ditolak bila slip yang memuat cicilan terdekat **sedang ditutup** (kunci
  tutup slip); coba lagi sesudahnya.
- Pesan: "Kasbon KB-0012 dilunasi Rp100.000. Sisa Rp50.000, dipotong 1 kali
  di gajian 26 November – 25 Desember." atau "Kasbon KB-0012 lunas."
- Kasbon yang sudah **Dialihkan ke Piutang Lain** tidak dilunasi di sini;
  cicilannya diterima di Buku Piutang Lain (KEU-74, 4H).

#### Hapus utang (DRV-70; C4)

- Hanya **Pemilik atau GM**, **bukan kasbonnya sendiri** (kasbon GM dihapus
  Owner dan sebaliknya), alasan wajib, tombol ditahan 3 detik (DRV-L35).
  Hak ini tidak bisa diberikan ke jabatan lain.
- **Seluruh sisa atau sebagian** (C4), dengan urutan pengurangan yang sama
  dengan pelunasan tunai (satu fungsi).
- **Tidak ada uang bergerak.** Keuangan mencatat biaya **"Utang kasbon
  dihapus"** di Untung Rugi pada tanggal dihapus, cabang = cabang orang itu
  pada tanggal itu (KEU-25), lewat fungsi 4H.
- Orangnya dan para pemilik diberi tahu.
- Hapus utang **bukan pemberian**: bantuan yang sejak awal tidak perlu
  dikembalikan dicatat di Keuangan, bukan di sini (DRV-77).

#### Batal pelunasan dan batal hapus

- Untuk catatan yang **salah**: salah nominal, salah tempat uang, salah
  kasbon. Hanya **Pemilik atau GM**, alasan wajib, tombol ditahan 3 detik
  (DRV-L39).
- Satu langkah: mutasi dibalik; baris Buku Kas uang masuk atau biaya
  dibatalkan lewat Keuangan (bulan tertutup: koreksi di bulan berjalan,
  KEU-112); jumlahnya **kembali ke jadwal**, ditambahkan ke cicilan
  Terjadwal terdekat, atau bila tidak ada lagi, menjadi satu cicilan baru di
  slip utama terbuka berikutnya. Kasbon yang Lunas kembali Berjalan.
- Sisa potongan yang sempat dilunasi tidak dihidupkan lagi sebagai sisa
  potongan; jumlahnya ikut jadwal.
- Ditolak bila kasbonnya sudah Dialihkan ke Piutang Lain.

#### Orang berhenti (DRV-73; C6)

- **Slip terakhir** (GAJ-82): "cicilan jatuh tempo" memberi **semua**
  cicilan Terjadwal orang itu (seluruh sisa, termasuk Kasbon Khusus dan
  bawaan), ditambah sisa yang dibawa. Saat slip ditutup: terpotong sebesar
  yang tertampung (kasbon paling lama lebih dulu); sisanya dikirim Gaji ke
  **Buku Piutang Lain** satu baris jenis kasbon (langkah 9 tutup slip,
  KEU-74). Tiap kasbon mendapat mutasi "dialihkan ke Piutang Lain" dan
  menjadi **Dialihkan**. Dana Kasbon lepas.
- Cicilan dan pelunasan sesudahnya diurus di Buku Piutang Lain (4H).
- Slip terakhir dibuka kembali (syarat GAJ-95): mutasi dibalik; kasbon
  kembali Berjalan.
- **Sejak tanggal berhenti dicatat di Karyawan (C6):**
  - pengajuan kasbon baru ditolak dengan kalimat "Kasbon tidak bisa
    diajukan karena tanggal berhenti Anda sudah tercatat. Kalau mendesak,
    hubungi GM." (langkah 1 "periksa kasbon", pelapis DRV-121);
  - pengajuan yang menunggu dan kasbon yang disetujui belum diberikan
    bertanda **"Akan berhenti"** untuk Finance, Pemilik, dan GM, yang
    memutuskan tetap atau batal (tidak batal otomatis);
  - serah uang **sesudah hari terakhir bekerja** ditolak server;
  - tunda ditolak dan ubah jadwal tidak boleh melewati slip terakhir.
  - Bila tanggal berhenti dibatalkan, tanda hilang dengan sendirinya.

#### Berganti slip utama (DRV-74; C5)

- Pindah slip utama terjadi di **tanggal 26** (DRV-06). Mesin **"Pindah
  slip utama kasbon"** berjalan saat perubahan jabatan yang mengganti slip
  utama tersimpan di Karyawan, dan berjalan lagi bila perubahan itu
  dibatalkan atau tanggalnya diubah.
- **Yang dipindah:** cicilan Terjadwal yang slip tujuannya **belum ditutup
  dan periodenya berakhir pada atau sesudah tanggal pindah**.
- **Ke mana (C5):** **banyak dan nominal cicilan tetap**; dipasang satu per
  slip utama baru berturut-turut, mulai slip utama baru pertama yang
  periodenya **dimulai pada atau sesudah tanggal pindah**. Slip utama lama
  yang masih memuat hari sebelum tanggal pindah tetap memotong cicilan yang
  memang jatuh di sana.
- **Contoh bulanan → mingguan:** Rina sisa 2 × Rp75.000 di slip 26 November
  – 25 Desember dan 26 Desember – 25 Januari; menjadi kenek mulai Kamis 26
  November. Cicilannya pindah ke minggu 27 November – 3 Desember dan 4–10
  Desember. Utangnya lunas lebih cepat; kalau terasa berat, Pemilik atau GM
  memakai Ubah jadwal (C2).
- **Contoh mingguan → bulanan:** Eko sisa 3 × Rp50.000 di tiga minggu
  terakhir Desember; menjadi staf gudang bulanan mulai 26 Desember.
  Cicilan yang mingguannya berakhir 26 Desember atau sesudahnya pindah ke
  slip 26 Desember – 25 Januari dan seterusnya.
- **Sisa potongan dibawa** ikut ke slip utama baru (tabel `sisa_potongan`
  per orang, bukan per jenis slip).
- **Dana:** kasbon yang sudah diberikan dihitung di Dana slip utama orang
  itu **pada hari ini**, sehingga sisanya pindah dana di tanggal 26. Tidak
  pernah ditolak walau dana tujuan penuh (DRV-74); kepala DRV-L26 menulis
  "terpakai Rp1.150.000 dari Rp1.000.000, pengajuan baru di dana ini
  tertahan". Pengajuan yang menunggu dan kasbon yang belum diberikan tetap
  di dana saat diajukan (DRV-121), lalu ikut slip utama hari ini begitu
  uangnya diberikan.
- Orangnya diberi tahu jadwal barunya.

#### Kasbon Khusus (DRV-75, 76; C7)

- **Dibuat Pemilik atau GM** dari DRV-L26, tombol **Buat Kasbon Khusus**
  (DRV-L37). Tidak lewat Mesin Pengajuan: pembuatnya sekaligus yang
  menyetujui, jadi kasbon langsung **Disetujui, belum diberikan**, bertanda
  Khusus, dan tercatat "dibuat oleh". Para pemilik diberi tahu.
- **Untuk siapa:** karyawan aktif, bukan Freelance, punya slip utama.
  **Bukan dirinya sendiri**: Kasbon Khusus GM dibuat Owner, dan
  sebaliknya.
- **Isi:** jenis kejadian (daftar pengaturan, isi awal **Kecelakaan, Sakit,
  Duka, Lainnya**), alasan paling sedikit 15 huruf, nominal kelipatan
  Rp10.000 tanpa batas atas, kali potong **1 s.d. 12** (C7; pengaturan).
- **Tidak diperiksa:** masa kerja 6 bulan, batas per orang, Dana Kasbon,
  dan satu pengajuan menunggu (DRV-75). Tidak dihitung di "terpakai".
- **Uangnya** diserahkan lewat DRV-L29 yang sama (DRV-76), boleh oleh
  pembuatnya sendiri. Untuk keadaan mendesak, langkah terakhir DRV-L37
  punya tombol **Buat dan serahkan sekarang** yang langsung membuka DRV-L29.
- Sebelum diberikan, dibatalkan lewat DRV-L30. Sesudahnya mengikuti semua
  aturan di bagian ini (tunda, ubah jadwal, pelunasan, hapus, berhenti,
  pindah slip utama).

#### Kasbon bawaan sistem lama (SIS-28)

Diisi di Tahap 5: satu baris `kasbon` jenis **bawaan** per orang, nominal
= angka sisa pada hari pindah, diketik Finance dan disahkan GM atau Owner,
kali potong paling banyak 3. Dianggap **sudah diberikan** pada tanggal
tayang **tanpa** baris Buku Kas (uangnya keluar di sistem lama). Jadwalnya
dipasang "pasang jadwal" mulai slip utama pertama di v3. Selebihnya sama
dengan kasbon biasa, dan dihitung di "terpakai" (4G-4a).

#### Yang dilihat tiap orang (DRV-78, 79)

- **Karyawan (DRV-L23):** tiap kasbon yang sudah diberikan menampilkan sisa
  (besar), "Rp75.000 dari Rp150.000 sudah dipotong", dan **jadwal**: tiap
  cicilan dengan gajiannya dan statusnya (akan dipotong; terpotong lewat
  slip …; sebagian, sisa Rp… dibawa; ditunda), pelunasan tunai, utang yang
  dihapus beserta alasannya, dan tombol **Minta tunda**. Kalimat tetap:
  "Mau melunasi lebih cepat? Bayar tunai ke Finance." Kasbon Lunas dan
  Dialihkan pindah ke bagian **Selesai**. Tidak dikirim: angka batas, sisa
  dana, nama tempat uang.
- **Finance:** Kasbon Berjalan tanpa sisa Dana Kasbon (untuk menerima
  pelunasan); tanpa gaji dan slip (PRI-24).
- **HR dan Admin HR:** Kasbon Berjalan dan rincian, tanpa tempat uang dan
  tanpa sisa dana; tombol hanya Minta tunda atas nama.
- **Pemilik dan GM:** semuanya (DRV-79), termasuk sisa kedua Dana Kasbon
  dan jumlah Kasbon Khusus berjalan.

#### DRV-L32. Minta Tunda Cicilan (2 langkah)

- **Letak:** isi khas kerangka BER-L06; dari tombol Minta tunda di DRV-L23
  (atau DRV-L28 untuk HR atas nama). **HP.**

1. **Yang ditunda:** kasbon, cicilan terdekat (gajian dan nominal), dan
   jadwal sesudah ditunda dalam kalimat ("Cicilan 2 dan 3 mundur satu
   minggu: 13–19 November dan 20–26 November"). Kalimat: "Jatah tunda
   hanya 1 kali untuk kasbon ini."
2. **Alasan dan kirim:** paling sedikit 15 huruf; tombol ditahan 3 detik.
   Pesan: "Permintaan tunda terkirim. Harus diputuskan sebelum slip minggu
   6–12 November ditutup; kalau tidak sempat, cicilan dipotong biasa dan
   Anda boleh meminta lagi."

#### DRV-L33. Putuskan Tunda Cicilan

- **Letak:** isi khas BER-L21, dari Persetujuan dan DRV-L38. **PC, HP.**
- **Isi:** orang, kasbon, sisa, cicilan terdekat dan slipnya (dengan jam
  tutup slip itu), jadwal lama → baru, alasan, riwayat tunda dan
  pelunasannya. Pemilik dan GM juga melihat perkiraan bersih slip itu
  (dibaca dari fungsi hitung slip).
- **Tombol:** **Setujui** (ditahan 3 detik) dan **Tolak** (alasan wajib).
  Kasbon milik sendiri: redup "diputuskan penyetuju lain".

#### DRV-L34. Terima Pelunasan Kasbon (3 langkah, TAM-07)

- **Letak:** dari DRV-L28 dan baris DRV-L38. **PC**; bisa dipakai di HP.

1. **Kasbon:** orang, nomor, sisa (besar), jadwal yang tersisa. Bila
   penekan adalah pemilik kasbon (bukan Pemilik atau GM): berhenti dengan
   kalimat "Pelunasan kasbon Anda sendiri dicatat orang lain."
2. **Berapa, ke mana, kapan:** nominal (tombol **Lunasi semua**), tempat
   uang (yang boleh dipakai penekan), tanggal uang, foto (dianjurkan).
   Tampil jadwal sesudah dilunasi.
3. **Simpan:** ringkasan ("Rp100.000 dari Dedi masuk Kas Pegangan tanggal
   12 November. Sisa Rp50.000, dipotong 1 kali di minggu 20–26
   November"); tombol ditahan 3 detik.

#### DRV-L35. Hapus Utang Kasbon (3 langkah)

- **Letak:** dari DRV-L28. **PC.** Hanya Pemilik dan GM.

1. **Kasbon:** orang, nomor, sisa, jadwal, riwayat.
2. **Berapa dan kenapa:** seluruh sisa atau sebagian; alasan wajib.
3. **Hapus:** akibat dalam kalimat ("Utang Rp150.000 milik Dedi dihapus.
   Tidak ada uang bergerak; Rp150.000 tercatat sebagai biaya Gudang bulan
   November. Kasbon lunas."); tombol ditahan 3 detik.

#### DRV-L36. Ubah Jadwal Cicilan (3 langkah)

- **Letak:** dari DRV-L28 dan DRV-L38. **PC.** Hanya Pemilik dan GM.

1. **Jadwal sekarang:** cicilan Terjadwal (gajian, nominal), sisa yang
   dibawa (tidak ikut diubah), jumlah yang dijadwal ulang.
2. **Jadwal baru:** banyaknya cicilan, mulai gajian (pilihan hanya slip
   yang boleh), hasil pembagian ditampilkan berjalan; alasan wajib.
3. **Simpan:** jadwal lama → baru dalam satu tabel kecil; tombol ditahan 3
   detik.

#### DRV-L37. Buat Kasbon Khusus (4 langkah)

- **Letak:** tombol di DRV-L26. **PC**; bisa dipakai di HP (mendesak).
  Hanya Pemilik dan GM.

1. **Untuk siapa:** cari karyawan (dirinya tidak bisa dipilih); tampil slip
   utama, kasbon yang berjalan, dan Kasbon Khusus yang berjalan.
2. **Kejadian dan alasan:** jenis kejadian, alasan paling sedikit 15 huruf.
3. **Berapa dan berapa kali potong:** nominal, 1 s.d. 12 kali, perkiraan
   cicilan dan gajian terakhirnya.
4. **Buat:** ringkasan; dua tombol ditahan 3 detik: **Buat** (menunggu
   diserahkan) dan **Buat dan serahkan sekarang** (lanjut ke DRV-L29).

#### DRV-L38. Kasbon Berjalan

- **Letak:** tab **Berjalan** dan **Selesai** di DRV-L26 (Kantor › Gaji ›
  Kasbon). **PC**; terbaca di HP.
- **Kepala (Pemilik, GM):** sisa Dana Kasbon bulanan dan mingguan, jumlah
  sisa semua kasbon biasa, jumlah sisa Kasbon Khusus.
- **Baris tab Berjalan:** orang, cabang, slip utama, nomor, jenis, nominal
  diberikan, sudah berkurang, **sisa**, cicilan berikutnya (gajian,
  nominal), label (Khusus, Bawaan, Ditunda, Jadwal diubah, Ada sisa dibawa,
  Akan berhenti, Minta tunda menunggu). Urutan bawaan: sisa terbesar. Saring:
  cabang, slip utama, jenis, label. Ketuk baris: DRV-L28.
- **Ringkasan per orang:** baris orang yang punya lebih dari satu kasbon
  bisa dibuka menjadi daftar kasbonnya, dengan jumlah sisanya.
- **Tab Selesai:** Lunas dan Dialihkan, dengan tanggal dan sebabnya
  (terpotong, tunai, dihapus, berhenti).
- **Tombol per baris menurut hak:** Terima pelunasan; Ubah jadwal; Hapus
  utang.

#### Tambahan di DRV-L23 dan DRV-L28 (titipan 4G-4a)

- **DRV-L23 (Kasbon Saya):** bagian cicilan dan sisa seperti "Yang dilihat
  tiap orang" di atas; tombol **Minta tunda** (redup dengan alasannya bila
  jatah habis atau tidak ada cicilan yang bisa ditunda).
- **DRV-L28 (Rincian Kasbon):** bagian **Cicilan** menampilkan versi jadwal
  yang berlaku, cicilan Terpotong dan Sebagian beserta slipnya, sisa yang
  dibawa, dan tombol "Lihat jadwal lama" (semua versi beserta sebabnya);
  bagian **Mutasi** (terpotong, tunai, dihapus, dialihkan, dibalik); tombol
  baru: Terima pelunasan, Ubah jadwal, Hapus utang, Batalkan pelunasan atau
  hapus, Minta tunda atas nama (HR).

#### DRV-L39. Batalkan Pelunasan atau Hapus Utang (2 langkah)

- **Letak:** dari baris mutasi di DRV-L28. **PC.** Hanya Pemilik dan GM.

1. **Yang dibatalkan dan akibatnya:** jenis, nominal, tanggal, oleh siapa;
   "Uang masuk Rp100.000 di Kas Pegangan dibatalkan. Rp100.000 kembali ke
   jadwal: cicilan minggu 20–26 November menjadi Rp150.000."
2. **Alasan dan batalkan:** alasan wajib; tombol ditahan 3 detik.

---

## 4. Data

Semua tabel punya kolom perusahaan (PRI-31), jejak dibuat dan diubah, tidak
ada yang dihapus (PRI-02), dan indeks pada kolom pencarian (PRI-14). Orang
milik Karyawan; mobil, rute, ritase, dan tugas belanja milik Logistik; Buku
Upah dan slip milik Gaji. Tabel di bawah hanya menunjuknya. Rupiah bilangan
bulat (PRI-28).

| Tabel | Isi penting | Dicari dengan | Dibaca modul lain | Bagian |
|---|---|---|---|---|
| jenis_upah | kode (dipakai mesin), nama tampil, dihitung per, sumber tarif, modul pencatat, jalur bayar (slip bulanan, slip mingguan, tunai hari itu), berlaku dari, urutan. Diisi lewat migrasi (U1) | kode | Gaji (Buku Upah, Pendapatan Saya), Keuangan | 4G-1 |
| tarif_ritase | mobil, rute, berlaku dari, driver dengan kenek, driver tanpa kenek, kenek, asal (diisi, pasangan baru, pembetulan, data lama), menggantikan baris nomor berapa (untuk pembetulan), pengumuman (nomor di Papan, atau "tidak perlu diumumkan" + alasan), oleh, kapan, alasan, status (Terjadwal, Berlaku, Dibatalkan, Dibetulkan). **Kunci: mobil + rute + berlaku dari untuk status Terjadwal atau Berlaku**. Status Terjadwal/Berlaku dihitung dari tanggal, tidak disimpan dua kali | mobil + rute + berlaku dari | Logistik (Siap Kirim, ritase tangan, LOG-L07) | 4G-1 |
| tinjau_ritase | baris Buku Upah, tanda (bukan hari libur), dilihat oleh, kapan, catatan, status (Perlu dilihat, Sudah dilihat, Padam karena dinilai ulang) | status; orang + minggu upah | — | 4G-1 |
| penilaian_ulang | ritase, pemicu (status hari, pembetulan tarif, batal ritase, tarif diisi), catatan pemicu (jenis + nomor), baris upah lama, baris upah baru atau baris koreksi, nominal lama, nominal baru, selisih, cara (ganti sebelum tutup, koreksi plus, potongan koreksi), kapan (jam server) | ritase; orang + kapan | Gaji (potongan koreksi upah ritase), pemberitahuan | 4G-1 |
| jenis_denda_driver | kode, nama, contoh perbuatan, aktif sejak, nonaktif mulai. **Nominalnya** disimpan sebagai pengaturan bersasaran jenis di kerangka 4B (bertanggal berlaku, lewat Papan), tidak di tabel ini, supaya tidak ada dua tempat angka | kode | — | 4G-2 |
| denda_driver | orang, jenis, tanggal kejadian, trip (boleh kosong), uraian, foto, **nominal** (disalin server dari pengaturan jenis itu pada tanggal kejadian), pengaju, pengajuan (nomor di Mesin Pengajuan, kosong bila langsung oleh Pemilik/GM), pengesah, kapan disahkan, slip tujuan (periode slip utama dari tanggal kejadian; berikutnya bila sudah ditutup), slip yang memotong, terpotong (diisi saat tutup, boleh sebagian), status (Menunggu, Ditolak, Ditarik, Berlaku, Keberatan menunggu, Terpotong, Sebagian, Dibatalkan, Ditiadakan, Tidak tertagih), alasan batal/tiadakan, koreksi plus (nomor baris koreksi bila ditiadakan sesudah terpotong) | orang + slip tujuan; status; tanggal kejadian | Gaji (fungsi hitung slip, kelompok a; Dana Disiplin), Kinerja (catatan disiplin) | 4G-2 |

| laporan_bongkaran | nomor, tanggal kerja, supplier, purchase order (boleh kosong), cara kg (dari barang, diketik), catatan barang (bila diketik), total kg, tarif (salinan angka dan nomor pengaturannya), total upah, jumlah peserta, cabang penanggung (salinan pengaturan DRV-51), foto surat jalan (1 s.d. 5) atau foto barang + alasan, tanda-tanda, alasan terlambat, pengajuan (nomor di Mesin Pengajuan untuk laporan terlambat), pembuat, jam simpan (server), penyetuju dan jam (bila terlambat), status (Menunggu persetujuan, Berlaku, Ditolak; Dibayar, Dikoreksi, Dibatalkan di 4G-3b) | nomor; tanggal kerja + supplier; status | Keuangan (bayar, 4G-3b; KEU-25), Gaji (Jadwal Bayar, Pendapatan Saya), Kehadiran (Catatan Hari Kerja) | 4G-3a |
| barang_bongkaran | laporan, produk (kode kasir) dan satuan, **atau** Barang lain (nama diketik, alasan, dipasangkan ke produk, oleh, kapan), jumlah, berat per satuan yang dipakai (salinan), kg baris, jumlah di purchase order (bila ada), tanda selisih. **Kunci: laporan + produk + satuan** | laporan; produk | — | 4G-3a |
| peserta_bongkaran | laporan, orang, bagian (rupiah), dapat sisa (ya/tidak), baris Buku Upah, status hari yang dibaca (untuk tanda Perlu dilihat). **Kunci: laporan + orang** | laporan; orang + tanggal kerja | Gaji (Pendapatan Saya), Kehadiran (Catatan Hari Kerja, tanpa rupiah) | 4G-3a |
| berat_satuan | produk (kode kasir), satuan, berat (kg, 3 angka di belakang koma), berlaku sejak (jam server), oleh, berat sebelumnya, beda persen, alasan (wajib bila mengubah), laporan asal, dilihat oleh dan kapan (untuk perubahan lebih dari 10%). Baris baru tiap perubahan; berat sekarang = baris terakhir. **Tidak terhapus saat daftar produk diunggah ulang** (DRV-38): tabel ini hanya menunjuk kode produk | produk + satuan | Tarik Data Kasir (tidak menyentuhnya) | 4G-3a |

| pembayaran_bongkaran | laporan, susulan (kosong bila pembayaran laporan), kelompok (bila beberapa dibayar sekaligus), tanggal uang, jam catat (server), pembayar, tempat uang, cara (tunai, transfer; dari jenis tempat uang), jumlah bagian, jumlah diperhitungkan, **uang keluar** (tidak diketik), tanpa uang (ya, tidak), diserahkan kepada (langsung ke tiap peserta, atau satu orang), foto, alasan (bila tanggal uang mundur lebih dari 7 hari), tanda "pembayar juga peserta atau pembuat", asal (tombol Bayar, pasangan Catatan Cepat nomor berapa), baris Buku Kas, status (Berlaku, Dibatalkan), dibatalkan oleh, kapan, alasan. **Kunci: satu pembayaran Berlaku per laporan, dan satu per susulan** | laporan; tanggal uang; tempat uang | Keuangan (uang keluar, 4H), Gaji (Jadwal Bayar, Pendapatan Saya, Total Diterima per Orang) | 4G-3b |
| rincian_bayar_bongkaran | pembayaran, orang, bagian (atau nominal susulannya), diperhitungkan ke lebih bayar, diterima. **Kunci: pembayaran + orang** | orang + tanggal uang | Gaji (Pendapatan Saya, Total Diterima per Orang) | 4G-3b |
| versi_laporan_bongkaran | laporan, nomor versi, salinan isi versi itu (supplier, tanggal kerja, barang, berat, peserta, bagian, total kg, tarif, total upah, tanda), jenis (koreksi, batal), sebelum atau sesudah dibayar, oleh, kapan (server), alasan | laporan + nomor versi | — | 4G-3b |
| susulan_bongkaran | laporan, versi asal, baris per orang (orang, nominal), jumlah, lahir kapan, status (Menunggu bayar, Dibayar, Dibatalkan) | laporan; status | Gaji (Jadwal Bayar) | 4G-3b |
| lebih_bayar_bongkaran | orang, laporan asal, versi asal, nominal, lahir kapan, status (Berjalan, Ditagih tunai, Lunas, Dihapus), ditandai lewat 30 hari kapan, keputusan (oleh, kapan, alasan). **Sisa tidak disimpan**: dihitung dari mutasi | orang + status; lahir kapan | Gaji (Pendapatan Saya) | 4G-3b |
| mutasi_lebih_bayar | lebih bayar, jenis (diperhitungkan di pembayaran nomor berapa, berkurang karena koreksi, dikembalikan tunai beserta baris Buku Kas masuk, dihapus, dibalik), nominal, oleh, kapan | lebih bayar | Keuangan (uang masuk, 4H) | 4G-3b |
| tanya_bongkaran | laporan, penanya, pertanyaan, dijawab oleh, jawaban, kapan, status (Menunggu jawaban, Dijawab, Padam karena dikoreksi, Ditarik) | laporan; status | — | 4G-3b |

| kasbon | nomor (KB-…), orang, jenis (biasa, Khusus, bawaan sistem lama), pengajuan (nomor di Mesin Pengajuan; status menunggu sampai ditolak **dibaca** dari sana), diisi oleh, nominal diajukan, kali potong diajukan, alasan, slip utama dan Dana Kasbon pada hari mengajukan (bulanan, mingguan), usulan Finance (nominal, kali potong, catatan, oleh, kapan), nominal akhir, kali potong akhir, catatan penyetuju, diputuskan oleh dan kapan, tanda-tanda (tanpa pemeriksaan Finance, nominal diturunkan, lewat 2 hari, uang keluar sebelum disetujui, penyerah juga penerima), keadaan sesudah disetujui (Belum diberikan, Sudah diberikan, Dibatalkan; lanjutannya di 4G-4b), dibatalkan oleh, kapan, alasan. **Sisa utang tidak disimpan** (DRV-67) | orang + keadaan; nomor; keadaan + dana | Gaji (cicilan di slip, 4G-4b), Keuangan (uang keluar, 4H) | 4G-4a |
| cicilan_kasbon | kasbon, urutan, nominal (dari fungsi "bagi cicilan"), status (Belum terjadwal, Dibatalkan; Terjadwal, Terpotong, Sebagian dan seterusnya di 4G-4b), slip tujuan (kosong sampai uang diberikan). Lahir di langkah Setujui. **Kunci: kasbon + urutan** | kasbon; slip tujuan | Gaji (fungsi hitung slip, kelompok d) | 4G-4a |
| penyerahan_kasbon | kasbon, tanggal uang, jam catat (server), penyerah, tempat uang, cara (tunai, transfer), nominal (= nominal akhir, tidak diketik), diserahkan kepada (langsung ke orangnya, atau satu nama), foto, alasan (bila tanggal uang mundur lebih dari 7 hari), asal (tombol Serahkan, pasangan Catatan Cepat nomor berapa), baris Buku Kas, status (Berlaku, Dibatalkan), dibatalkan oleh, kapan, alasan. **Kunci: satu penyerahan Berlaku per kasbon** | kasbon; tanggal uang; tempat uang | Keuangan (4H), Gaji (pasang jadwal, 4G-4b) | 4G-4a |
| mutasi_kasbon | kasbon, jenis (terpotong di slip, terpotong dari sisa dibawa, dilunasi tunai, dihapus, dialihkan ke Piutang Lain), nominal, cicilan (bila dari slip), slip, baris `sisa_potongan` (bila dari sisa dibawa), pelunasan atau hapus asal, baris Piutang Lain (bila dialihkan), status (Berlaku, Dibalik), dibalik oleh apa (buka kembali slip nomor, batal pelunasan, batal hapus), oleh, kapan (server). **Sisa kasbon dihitung dari tabel ini** (DRV-67) | kasbon + status; slip | Gaji (tandai cicilan, balik tanda), Keuangan (Piutang Lain) | 4G-4b |
| riwayat_jadwal_kasbon | kasbon, versi lama, versi baru, sebab (serah uang, tunda, ubah jadwal, pindah slip utama, pelunasan, hapus, batal pelunasan atau hapus, batal serah uang), pengajuan tunda (nomor, bila sebab tunda), oleh, kapan, alasan | kasbon | — | 4G-4b |
| pelunasan_kasbon | kasbon, nominal, tanggal uang, jam catat (server), penerima, tempat uang, cara (tunai, transfer), foto, alasan (bila tanggal uang mundur lebih dari 7 hari), tanda "penerima juga pemilik kasbon", baris Buku Kas (uang masuk), status (Berlaku, Dibatalkan), dibatalkan oleh, kapan, alasan | kasbon; tanggal uang; tempat uang | Keuangan (uang masuk, 4H) | 4G-4b |
| hapus_kasbon | kasbon, nominal, alasan, oleh, kapan (server), baris biaya Keuangan, status (Berlaku, Dibatalkan), dibatalkan oleh, kapan, alasan | kasbon; kapan | Keuangan (Untung Rugi, 4H) | 4G-4b |

**Tambahan kolom `buku_upah` dari 4G-1** (tabel milik Gaji 4E-1): **tarif
asal** (nomor baris `tarif_ritase`), **keterangan** (rute tanpa upah kenek;
hari kerja, sudah dibayar gaji; bukan hari libur; tanggal asal …),
**status hari yang dibaca** (untuk orang berslip utama bulanan), dan status
**Belum bertarif** di samping Berlaku dan Dibatalkan. Untuk asal `ritase`,
kunci "asal + status Berlaku" berlaku juga untuk baris Belum bertarif.

**Potongan "koreksi upah ritase":** tidak memakai tabel baru. Slip utama
membaca baris `penilaian_ulang` bercara "potongan koreksi" yang belum masuk
slip, sebagai potongan kelompok (a) (GAJ-75). Saat slip ditutup, baris itu
diisi nomor slipnya; yang tidak tertampung menjadi `sisa_potongan` berjenis
asal "koreksi" (tabel Gaji). Titipan ke 4E: fungsi "hitung slip" membaca
sumber ini (pelapis GAJ-75 butir 2 kelompok a).

**Slip mingguan tidak punya tabel sendiri (4G-2).** Ia baris `slip`
berjenis mingguan, `baris_slip`, `langkah_slip`, `pembayaran_slip` milik
Gaji (4E-5). Tambahan dari 4G-2 ke milik Gaji: penahan nomor 7 "Belum
bertarif" di fungsi penahan slip (GAJ-93); fungsi hitung slip membaca
`denda_driver` (kelompok a) dan `penilaian_ulang` bercara koreksi plus
(pendapatan); Pembuat slip membuat slip mingguan utama untuk orang berslip
utama mingguan yang aktif, dan slip di luar slip utama saat baris upah
pertamanya lahir.

**Bongkaran (4G-3a):** tarif bongkaran **tidak punya tabel**; ia satu
pengaturan bertanggal berlaku di kerangka 4B. Baris `buku_upah` berjenis
`bongkaran` memakai kunci "asal + orang + status Berlaku" (satu laporan
melahirkan banyak baris, satu per peserta). Tanda "Perlu dilihat" untuk
peserta di hari izin, sakit, cuti, atau alpha memakai tabel `tinjau_ritase`
4G-1 (isinya sudah menunjuk baris Buku Upah); saat dibangun tabel itu diberi
nama umum `tinjau_upah`. Laporan bongkaran sistem lama (25 entri) **tidak
dibawa** (SIS-25: tidak ada tunggakan upah yang dibawa); berat per satuan
mulai kosong dan terisi dari laporan pertama.

**Bayar bongkaran (4G-3b):** `laporan_bongkaran` mendapat kolom **versi
sekarang**, **jumlah koreksi**, dan status **Dibayar** dan **Dibatalkan**
(dibatalkan oleh, kapan, alasan). `barang_bongkaran` dan `peserta_bongkaran`
selalu berisi versi yang berlaku; isi lama ada di `versi_laporan_bongkaran`.
Status bayar baris `buku_upah` berjenis `bongkaran` **dibaca** dari
`rincian_bayar_bongkaran`, tidak disalin (WAJ-03). Laporan "Uang belum saya
terima" tidak punya tabel sendiri: ia pengajuan di Mesin Pengajuan (4B) yang
menunjuk baris `rincian_bayar_bongkaran`. Tidak ada angka uang yang diterima
dari layar: uang keluar, perhitungan lebih bayar, susulan, dan selisih
dihitung server.

**Kasbon (4G-4a):** Dana Kasbon **tidak punya tabel**: besar tiap dana,
batas per orang, syarat masa kerja, kelipatan, dan nominal terkecil adalah
pengaturan bertanggal berlaku di kerangka 4B; "terpakai" orang dan
"terpakai" dana dihitung satu fungsi dari tabel `kasbon` (WAJ-04), tidak
disimpan. Status pengajuan (Menunggu, Diperiksa, Ditolak, Dibatalkan)
milik tabel `pengajuan` 4B dan hanya dibaca (WAJ-03). Laporan "Uang belum
saya terima" tidak punya tabel sendiri: ia pengajuan yang menunjuk baris
`penyerahan_kasbon`. Permintaan batal memakai "Minta dibatalkan" Mesin
Pengajuan. Kasbon sistem lama: hanya angka sisa per orang yang dibawa,
sebagai baris `kasbon` berjenis bawaan sistem lama (SIS-28, Tahap 5).

**Kasbon (4G-4b):** `kasbon` mendapat kolom **jenis kejadian** dan **dibuat
oleh** (Kasbon Khusus; pengajuannya kosong). Keadaan Berjalan, Lunas, dan
Dialihkan **tidak disimpan**: dihitung dari "sisa kasbon" dan
`mutasi_kasbon`. `cicilan_kasbon` mendapat kolom **versi** dan **slip tujuan
= orang + periode + slip utama** (bukan nomor slip), dan status Terjadwal,
Terpotong, Sebagian, Diganti (versi baru), Dibatalkan; cicilan tidak pernah
diedit, perubahan menulis versi baru (`riwayat_jadwal_kasbon`). **Kunci:
satu cicilan berstatus Terjadwal per kasbon + urutan**. Tunda tidak punya
tabel sendiri: ia pengajuan di Mesin Pengajuan; jatah tunda dihitung dari
pengajuan tunda yang Disetujui untuk kasbon itu. Sisa kasbon yang dibawa
adalah baris `sisa_potongan` milik Gaji berjenis kasbon yang menunjuk kasbon
dan cicilannya (WAJ-03). Piutang Lain milik Keuangan; kasbon hanya menyimpan
nomor barisnya di mutasi. Kasbon bawaan sistem lama: satu baris `kasbon`
jenis bawaan tanpa `penyerahan_kasbon` dan tanpa baris Buku Kas.

**Denda lama (Tahap 5):** 12 baris `driver_fines` tidak dibawa. Minggu
upahnya sudah lewat dan dibayar (bacaan SIS-25: v3 mulai tanpa tunggakan
upah); nominal denda diketik dari buku aturan, bukan disalin (SIS-26).

**Data lama (Tahap 5):** 23 tarif sistem lama masuk `tarif_ritase` berasal
"data lama", berlaku dari tanggal tayang modul, tanpa pengumuman (bukan
perubahan). Pasangan sistem lama dicocokkan ke mobil dan rute v3 saat data
mobil dan rute dipindah (4F-1). Ritase lama tidak dinilai ulang (SIS-25:
tidak ada tunggakan upah yang dibawa).

---

## 5. Tindakan bernama dan isi awal hak

Pemilik dan GM punya semua tindakan (KAR-67). Lingkup S = semua orang yang
boleh dilihatnya (tanpa jabatan bertanda "Gaji hanya terlihat Pemilik dan
GM" untuk HR).

| Tindakan | HR | Finance | Kepala Gudang | Driver / kenek | Karyawan lain | Bagian |
|---|---|---|---|---|---|---|
| lihat jenis upah (DRV-L01) | ya | — | — | — | — | 4G-1 |
| lihat tarif ritase (DRV-L02) | ya | — | ya | — | — | 4G-1 |
| buat tarif baru / batalkan tarif terjadwal | — | — | — | — | — | 4G-1 |
| betulkan salah ketik tarif | — | — | — | — | — | 4G-1 |
| lihat upah ritase per orang (DRV-L05) | S | — | — | dirinya (lewat slip, 4G-2) | dirinya bila punya ritase (lewat slip) | 4G-1 |
| tandai ritase "Sudah dilihat" | S | — | — | — | — | 4G-1 |
| tutup slip mingguan | S | — | — | — | — | 4G-2 (GAJ-45) |
| bayar dan batal bayar slip mingguan | — | — | — | — | — | 4G-2 (GAJ-45, batas keras) |
| lihat ringkasan slip mingguan tanpa nama; Daftar Transfer | ya (lingkup S) | ya | — | — | — | 4G-2 (DRV-25, GAJ-100) |
| lihat denda (DRV-L06) | S | — | yang ia ajukan | dirinya (Pendapatan Saya) | dirinya bila awak trip | 4G-2 |
| ajukan denda driver/kenek | — | — | ya | — | — | 4G-2 |
| sahkan/tolak, batalkan, tiadakan denda | — | — | — | — | — | 4G-2 |
| ajukan keberatan denda | — | — | — | dirinya | dirinya | 4G-2 |
| ubah jenis dan nominal denda | — | — | — | — | — | 4G-2 |
| buat Laporan Bongkaran (termasuk tambah supplier belum diperiksa dan tambah pekerja lepas dari laporan) | — | — | ya | — | — | 4G-3a |
| lihat Laporan Bongkaran dan rinciannya (peserta dan bagian) | — | ya | ya | bagiannya sendiri (Pendapatan Saya) | bagiannya sendiri (Pendapatan Saya) | 4G-3a (DRV-82) |
| ubah berat per satuan | — | — | ya | — | — | 4G-3a |
| lihat berat per satuan dan riwayatnya | — | ya | ya | — | — | 4G-3a |
| tandai "Berat berubah" Sudah dilihat | — | — | — | — | — | 4G-3a |
| lihat daftar Barang lain | — | — | ya | — | — | 4G-3a |
| pasangkan Barang lain ke produk | — | — | — | — | — | 4G-3a |
| setujui atau tolak Laporan Bongkaran terlambat | — | — | — | — | — | 4G-3a |
| ubah tarif bongkaran | — | — | — | — | — | 4G-3a (DRV-42) |
| tandai peserta bongkaran "Sudah dilihat" (tanpa nominal) | S | — | — | — | — | 4G-3a |
| bayar Laporan Bongkaran dan bayar susulan (DRV-L17) | — | ya | — | — | — | 4G-3b (DRV-47) |
| Tanyakan dulu (sebelum membayar) | — | ya | — | — | — | 4G-3b |
| jawab pertanyaan Finance | — | — | ya (pembuat laporan) | — | — | 4G-3b |
| koreksi atau batalkan laporan **sebelum** dibayar | — | — | ya | — | — | 4G-3b (DRV-49) |
| koreksi atau batalkan laporan **sesudah** dibayar | — | — | — | — | — | 4G-3b (DRV-49, batas keras) |
| batal bayar bongkaran | — | — | — | — | — | 4G-3b (batas keras) |
| lihat Lebih Bayar Bongkaran (DRV-L21) | — | ya | ya (baca) | sisa miliknya (Pendapatan Saya) | sisa miliknya (Pendapatan Saya) | 4G-3b |
| tagih tunai, hapus lebih bayar | — | — | — | — | — | 4G-3b (batas keras) |
| terima pengembalian lebih bayar | — | ya | — | — | — | 4G-3b |
| lihat Bongkaran per Orang (DRV-L22) | — | ya | ya | — | — | 4G-3b (DRV-53, 82) |
| lapor "Uang belum saya terima" | — | — | — | dirinya | dirinya | 4G-3b |
| putuskan "Upah bongkaran belum diterima" | — | — | — | — | — | 4G-3b |
| ajukan kasbon untuk diri sendiri | dirinya | dirinya | dirinya | dirinya | dirinya | 4G-4a (DRV-59) |
| isikan kasbon atas nama (bukan dirinya) | S (juga Admin HR) | — | — | — | — | 4G-4a (DRV-59) |
| lihat daftar dan rincian kasbon (DRV-L26, L28) | S, tanpa usulan Finance dan tempat uang | ya | miliknya | miliknya | miliknya | 4G-4a (DRV-79, 82) |
| periksa kasbon dan usulkan perubahan | — | ya (bukan miliknya) | — | — | — | 4G-4a (DRV-61) |
| setujui atau tolak kasbon | — | — | — | — | — | 4G-4a (DRV-61, 62; batas keras) |
| serahkan uang kasbon | — | ya (bukan miliknya) | — | — | — | 4G-4a (DRV-63) |
| batalkan kasbon yang disetujui dan belum diberikan | — | — | — | — | — | 4G-4a (DRV-72; batas keras) |
| batal serah uang kasbon | — | — | — | — | — | 4G-4a (batas keras) |
| lapor "Uang belum saya terima" (kasbon) | dirinya | dirinya | dirinya | dirinya | dirinya | 4G-4a |
| putuskan "Uang kasbon belum diterima" | — | — | — | — | — | 4G-4a |
| lihat sisa Dana Kasbon | — | — | — | — | — | 4G-4a (DRV-79) |
| ubah pengaturan kasbon | — | — | — | — | — | 4G-4a (DRV-85; batas keras) |
| lihat Kasbon Berjalan (DRV-L38) | S, tanpa sisa dana | ya, tanpa sisa dana | miliknya (DRV-L23) | miliknya | miliknya | 4G-4b (DRV-79) |
| minta tunda cicilan | dirinya; atas nama orang lain (S, juga Admin HR) | dirinya | dirinya | dirinya | dirinya | 4G-4b (DRV-68) |
| putuskan tunda cicilan | — | — | — | — | — | 4G-4b (DRV-68; batas keras) |
| ubah jadwal cicilan | — | — | — | — | — | 4G-4b (C2; batas keras) |
| terima pelunasan tunai | — | ya (bukan miliknya) | — | — | — | 4G-4b (DRV-69) |
| hapus utang kasbon | — | — | — | — | — | 4G-4b (DRV-70; batas keras) |
| batalkan pelunasan atau hapus utang | — | — | — | — | — | 4G-4b (batas keras) |
| buat Kasbon Khusus | — | — | — | — | — | 4G-4b (DRV-75; batas keras) |

Tindakan "batal ritase" dan "ritase tangan" milik Logistik (LOG-L23, L24),
hanya Pemilik dan GM, dan **tidak bisa diberikan lewat Hak Akses Jabatan**
(sama dengan spec Logistik). "Buat tarif baru" dan "betulkan salah ketik
tarif" juga **tidak bisa diberikan** ke jabatan lain (DRV-13). Fungsi "nilai
ritase" dan Penilai ulang tidak punya tombol; hanya mesin yang
menjalankannya.

4G-2: "sahkan denda", "ubah jenis dan nominal denda", dan "bayar slip
mingguan" **tidak bisa diberikan** lewat Hak Akses Jabatan (DRV-29, GAJ-45).
"Ajukan denda" boleh diberikan ke jabatan lain lewat Hak Akses Jabatan
(misalnya wakil Kepala Gudang), tetapi tidak pernah untuk dirinya sendiri.

4G-3a: "ubah tarif bongkaran" dan "setujui Laporan Bongkaran terlambat"
**tidak bisa diberikan** lewat Hak Akses Jabatan (DRV-36, 42). "Buat Laporan
Bongkaran" dan "ubah berat per satuan" boleh diberikan ke jabatan lain
(misalnya wakil Kepala Gudang). HR tidak melihat rincian bongkaran (DRV-82);
yang ia lihat hanya tanda "Perlu dilihat" tanpa nominal dan daftar pekerja
lepas (KAR-L28). Fungsi "hitung bongkaran" tidak punya tombol.

4G-3b: "koreksi atau batalkan laporan sesudah dibayar", "batal bayar
bongkaran", dan "tagih tunai, hapus lebih bayar" **tidak bisa diberikan**
lewat Hak Akses Jabatan (DRV-49). "Bayar Laporan Bongkaran" boleh diberikan
ke jabatan lain, tetapi server selalu menolak pembayar yang menjadi peserta
atau pembuat laporan itu (kecuali Pemilik dan GM, yang dicatat dan
diberitahukan). Finance melihat tempat uang; Kepala Gudang tidak. Fungsi
"selisih bongkaran" tidak punya tombol.

4G-4a: "setujui atau tolak kasbon", "batalkan kasbon", "batal serah uang
kasbon", dan "ubah pengaturan kasbon" **tidak bisa diberikan** lewat Hak
Akses Jabatan (DRV-61, 72, 82). "Periksa kasbon" dan "serahkan uang kasbon"
boleh diberikan ke jabatan lain, tetapi server selalu menolak pemeriksa atau
penyerah yang merupakan pemilik kasbon itu (kecuali Pemilik dan GM saat
menyerahkan, yang dicatat dan diberitahukan). Tidak ada yang menyetujui
kasbonnya sendiri, termasuk Pemilik dan GM. Fungsi "periksa kasbon",
"terpakai", dan "bagi cicilan" tidak punya tombol.

4G-4b: "putuskan tunda cicilan", "ubah jadwal cicilan", "hapus utang
kasbon", "batalkan pelunasan atau hapus utang", dan "buat Kasbon Khusus"
**tidak bisa diberikan** lewat Hak Akses Jabatan (DRV-68, 70, 75, 82).
Tidak ada yang memutuskan tunda, mengubah jadwal, menghapus utang, atau
membuat Kasbon Khusus untuk kasbonnya sendiri, termasuk Pemilik dan GM.
"Terima pelunasan tunai" boleh diberikan ke jabatan lain, tetapi server
selalu menolak penerima yang merupakan pemilik kasbon itu (kecuali Pemilik
dan GM, yang dicatat dan diberitahukan). Fungsi "sisa kasbon", "pasang
jadwal", "cicilan jatuh tempo", "tandai cicilan", dan "balik tanda" tidak
punya tombol.

---

## 6. Mesin otomatis

Semua punya penjaga (PRI-33): tiap jalan tercatat; gagal atau tidak jalan
muncul di "perlu perhatian" GM; terlewat dikejar tanpa dobel.

| Mesin | Jadwal | Kerjanya | Bagian |
|---|---|---|---|
| Penilai ritase | Saat baris `ritase` Berlaku lahir (trip Selesai, ritase tangan) | Menjalankan "nilai ritase" dan menulis satu baris Buku Upah. Kunci "asal + status Berlaku" mencegah dobel. Pemeriksa susulan tiap 10 menit mencari ritase Berlaku tanpa baris upah dan menilainya | 4G-1 |
| Penilai ulang | Saat Kehadiran mengubah status hari orang berslip utama bulanan yang punya ritase di tanggal itu; saat baris tarif dibetulkan; saat ritase dibatalkan; saat tarif pertama sebuah pasangan diisi | Menjalankan "nilai ritase" lagi; bila berbeda, mengganti baris atau menulis koreksi (bagian 3.1); menulis `penilaian_ulang`; memberi tahu orangnya. Sekali lagi sesaat sebelum slip mingguan ditutup (dipanggil langkah tutup 4G-2) | 4G-1 |
| Penerbit tarif terjadwal | Tidak perlu: status Terjadwal/Berlaku dihitung dari tanggal | — | 4G-1 |
| Pembuat slip (minggu upah) | Jumat 00.15 (mesin 4E-5a), dan saat baris upah pertama orang di luar slip utama lahir | Kerangka slip mingguan utama untuk semua orang berslip utama mingguan yang aktif; slip di luar slip utama saat dibutuhkan. Kunci orang + periode + jenis + slip utama mencegah dobel | 4G-2 |
| Pengingat tutup slip mingguan | Jumat 15.00, lalu tiap hari 07.00 | Pengingat berantai ke HR, Pemilik, GM selama minggu yang sudah berakhir masih punya slip Perkiraan | 4G-2 |
| Pengingat usulan denda | Tiap hari 07.00 | Satu baris Antrean Pemilik dan GM berisi jumlah usulan denda yang menunggu; berhenti sendiri saat habis | 4G-2 |
| Pengingat laporan bongkaran terlambat | Tiap hari 07.00 | Satu baris Antrean Pemilik dan GM berisi jumlah Laporan Bongkaran yang menunggu persetujuan; berhenti sendiri saat habis | 4G-3a |
| Penulis upah bongkaran | Bukan mesin berjadwal: bagian dari langkah simpan atau setujui | Menulis baris Buku Upah tiap peserta di dalam langkah utuh yang sama. Pemeriksa susulan tiap 10 menit (bersama Penilai ritase) mencari laporan Berlaku yang jumlah baris upahnya tidak sama dengan jumlah pesertanya dan memasukkannya ke "perlu perhatian" GM | 4G-3a |
| Pengingat bongkaran belum dibayar | Tiap hari 07.00 | Pengingat berantai ke Finance, Pemilik, GM, satu jendela jalur bongkaran, selama ada laporan Berlaku atau susulan Menunggu bayar yang lewat jatuh bayarnya; berhenti sendiri saat habis | 4G-3b |
| Penanda lebih bayar lewat batas | Tiap hari 07.00 | Menandai, sekali per baris, lebih bayar yang masih bersisa lewat 30 hari sejak lahir; satu baris Antrean Pemilik dan GM | 4G-3b |
| Pemeriksa pembayaran bongkaran | Tiap 10 menit (bersama Penilai ritase) | Mencari pembayaran Berlaku tanpa baris Buku Kas (kecuali "tanpa uang"), laporan Dibayar tanpa pembayaran Berlaku, dan koreksi sesudah dibayar yang selisihnya belum menjadi susulan atau lebih bayar; memasukkannya ke "perlu perhatian" GM | 4G-3b |
| Pengingat pengajuan kasbon | Tiap hari 07.00 (mesin pengingat 4B) | Pengingat berantai ke pemeriksa dan penyetuju selama ada pengajuan kasbon Menunggu atau Diperiksa, satu jendela jenis kasbon; menandai "Lewat 2 hari" (48 jam sejak diajukan) dan memasukkannya ke "perlu perhatian" Finance, Pemilik, GM; berhenti sendiri saat diputuskan | 4G-4a |
| Pengingat kasbon belum diberikan | Tiap hari 07.00 | Pengingat berantai ke Finance, Pemilik, GM selama ada kasbon Disetujui, belum diberikan, sejak hari sesudah disetujui; berhenti sendiri saat diberikan atau dibatalkan | 4G-4a |
| Pemeriksa kasbon | Tiap 10 menit (bersama Penilai ritase) | Mencari kasbon Disetujui tanpa baris cicilan atau jumlah cicilannya tidak sama dengan nominal akhir, penyerahan Berlaku tanpa baris Buku Kas, dan kasbon Sudah diberikan tanpa penyerahan Berlaku; memasukkannya ke "perlu perhatian" GM | 4G-4a |
| Pemeriksa kasbon (tambahan 4G-4b) | Tiap 10 menit (sama) | Juga mencari: sisa kasbon yang tidak sama dengan cicilan Terjadwal + sisa dibawa; cicilan Terjadwal yang slip tujuannya sudah Ditutup tanpa ditandai; kasbon Berjalan milik orang yang sudah lewat slip terakhirnya; pelunasan atau hapus Berlaku tanpa baris Keuangan; lebih dari satu versi jadwal Terjadwal | 4G-4b |
| Penggugur tunda | Bagian dari langkah tutup slip (bukan berjadwal) | Saat slip ditutup, permintaan tunda yang menunggu untuk cicilan di slip itu menjadi Gugur; orangnya dan penyetuju diberi tahu; jatah tidak terpakai | 4G-4b |
| Pengingat tunda cicilan | Tiap hari 07.00 (mesin pengingat 4B) | Satu baris Antrean Pemilik dan GM berisi permintaan tunda yang menunggu, dengan jam tutup slip terdekatnya; berhenti sendiri saat habis | 4G-4b |
| Pindah slip utama kasbon | Saat perubahan jabatan yang mengganti slip utama tersimpan, dibatalkan, atau tanggalnya diubah | Menjalankan "pasang jadwal" untuk cicilan yang terkena (bagian 3.6); menulis `riwayat_jadwal_kasbon`; memberi tahu orangnya. Kunci per perubahan jabatan mencegah dobel | 4G-4b |

---

## 7. Pemberitahuan (titipan 4J)

| Pemberitahuan | Kepada | Antrean, Beranda, atau layar | Alasan |
|---|---|---|---|
| Tarif berubah mulai tanggal … | Driver, kenek, dan orang yang pernah jalan di pasangan itu | Pengumuman (Papan, PRI-35) | PRI-29 |
| Ritase dinilai ulang (dengan sebab dan akibatnya) | Orangnya | Antrean | Supaya tidak kaget di slip |
| Ritase ditandai "bukan hari libur" | HR (Pemilik, GM melihat) | Beranda | U5; tidak menahan apa pun |
| Ritase belum bertarif | Pemilik, GM | Antrean (pengingat berantai, TAM-22) | Slip mingguan orang itu tertahan |
| Pasangan aktif belum ada tarif | Kepala Gudang, Pemilik, GM | Perlu perhatian (sudah ada di spec Logistik) | LOG-21 |
| Penilai ritase gagal | GM, Pemilik | Antrean | PRI-33 |
| Slip mingguan siap ditutup / masih ada yang Perkiraan sesudah Jumat 15.00 | HR, Pemilik, GM | Antrean (pengingat berantai) | DRV-22, S4 |
| Slip mingguan Anda sudah ditutup (keberatan sampai …) | Orangnya | Pemberitahuan | GAJ-47 |
| Gaji minggu … dibayar | Orangnya | Pemberitahuan | KEU-24 |
| Usulan denda menunggu | Pemilik, GM | Antrean | DRV-29 |
| Usulan denda disahkan atau ditolak | Pengaju (Kepala Gudang) | Pemberitahuan | — |
| Anda dikenai denda (jenis, tanggal, nominal, slip, tombol keberatan) | Orangnya | Pemberitahuan | S2 |
| Denda dibatalkan atau ditiadakan | Orangnya, pengaju | Pemberitahuan | — |
| Perubahan jenis atau nominal denda | Driver, kenek | Pengumuman (Papan, 7 hari bila naik) | PRI-29, 35 |
| Laporan Bongkaran baru siap dibayar (jumlah, peserta, tanda) | Finance (Pemilik, GM melihat) | Antrean (rinciannya di 4G-3b) | DRV-47 |
| Anda tercatat ikut bongkaran (tanggal, kg, jumlah peserta, bagian) | Peserta yang punya akun | Pemberitahuan | Supaya bisa menyanggah hari itu juga |
| Laporan Bongkaran terlambat menunggu persetujuan | Pemilik, GM | Antrean | DRV-36, L4 |
| Laporan terlambat disetujui atau ditolak | Pembuat (Kepala Gudang) | Pemberitahuan | — |
| Berat per satuan berubah lebih dari 10% | Pemilik, GM | Beranda (bukan antrean) | L5; tidak menahan apa pun |
| Ada Barang lain di laporan | Pemilik, GM | Beranda (jumlah minggu ini) | DRV-34 |
| Peserta bongkaran tercatat izin, sakit, cuti, atau alpha hari itu | HR (Pemilik, GM melihat) | Beranda, tanpa nominal | L7 |
| Supplier baru ditambah Kepala Gudang | Finance | sudah ada di Keuangan (KEU-57) | — |
| Tarif bongkaran berubah mulai tanggal … | Orang yang ikut bongkaran 3 bulan terakhir, Kepala Gudang | Pengumuman (Papan) | PRI-29, 35 |
| Laporan Bongkaran belum dibayar lewat harinya (jumlah, rupiah, paling lama sejak …) | Finance, Pemilik, GM | Antrean (pengingat berantai, TAM-22) | DRV-52 |
| Upah bongkaran Anda sudah dibayar (tanggal, nominal, diserahkan lewat siapa, tombol "Uang belum saya terima") | Peserta yang punya akun | Pemberitahuan | B2 |
| Finance bertanya tentang laporan LB-… | Pembuat laporan (Pemilik, GM melihat) | Antrean | B4 |
| Pertanyaan dijawab atau laporan dikoreksi | Penanya (Finance) | Pemberitahuan | B4 |
| Peserta melapor uang belum diterima | Pemilik, GM (pembayar dan orang yang dititipi diberi tahu) | Antrean | B2 |
| Laporan "belum diterima" diputuskan | Peserta | Pemberitahuan | — |
| Laporan dikoreksi atau dibatalkan (bagian lama → baru; susulan atau lebih bayar) | Peserta yang bagiannya berubah; Finance bila jumlah bayar berubah | Pemberitahuan | DRV-49 |
| Susulan bongkaran menunggu dibayar | Finance (Pemilik, GM melihat) | Antrean | DRV-49 |
| Lebih bayar lewat 30 hari belum tertagih | Pemilik, GM | Antrean (sekali) | DRV-49 |
| Pembayaran bongkaran dibatalkan | Peserta, Finance, para pemilik | Pemberitahuan | GAJ-103 |
| Pemilik atau GM membayar laporan yang ia buat atau ikuti | Para pemilik | Pemberitahuan | B3 |
| Pengajuan kasbon baru menunggu diperiksa | Finance | Antrean | DRV-61 |
| Ada pengajuan kasbon atas nama Anda (diisi oleh …) | Orangnya | Antrean | DRV-59 |
| Kasbon sudah diperiksa, menunggu keputusan | Pemilik, GM | Antrean | DRV-61 |
| Pengajuan kasbon lewat 2 hari belum diputuskan | Finance, Pemilik, GM | Perlu perhatian | DRV-64 |
| Kasbon disetujui (angka akhir, kali potong, catatan) atau ditolak (alasan) | Pengaju; pengisi bila atas nama | Pemberitahuan | DRV-61 |
| Kasbon disetujui, menunggu uang diserahkan | Finance (Pemilik, GM melihat) | Antrean | DRV-63 |
| Kasbon diputuskan tanpa pemeriksaan Finance | Finance | Pemberitahuan | K2 |
| Kasbon disetujui belum diberikan (jumlah, rupiah, paling lama sejak …) | Finance, Pemilik, GM | Antrean (pengingat berantai, TAM-22) | DRV-64 |
| Kasbon Anda sudah diberikan (tanggal, nominal, cara, lewat siapa, tombol "Uang belum saya terima") | Orangnya | Pemberitahuan | DRV-63, K5 |
| Pengaju minta kasbonnya dibatalkan | Pemilik, GM (Finance melihat) | Antrean | DRV-72 |
| Kasbon dibatalkan sebelum diberikan | Pengaju, Finance | Pemberitahuan | DRV-72 |
| Orangnya melapor uang kasbon belum diterima | Pemilik, GM (penyerah dan orang yang dititipi diberi tahu) | Antrean | K5 |
| Penyerahan uang kasbon dibatalkan | Orangnya, Finance, para pemilik | Pemberitahuan | K6 |
| Pemilik atau GM menyerahkan uang kasbonnya sendiri | Para pemilik | Pemberitahuan | K3 |
| Uang kasbon keluar sebelum disetujui (pasangan Catatan Cepat) | Pemilik, GM | Beranda (bukan antrean) | KEU-18 |
| Perubahan batas, besar dana, syarat masa kerja, atau kali potong kasbon | Semua karyawan | Pengumuman (Papan) | PRI-29, 35 |
| Cicilan kasbon terpotong di slip (berapa, sisa, sebagian dibawa) | Orangnya | Tampil di slip dan Kasbon Saya (tanpa pemberitahuan terpisah) | DRV-66, 78 |
| Kasbon Anda lunas | Orangnya | Pemberitahuan | DRV-71 |
| Permintaan tunda cicilan menunggu (dengan jam tutup slip terdekat) | Pemilik, GM | Antrean | DRV-68 |
| Tunda disetujui (jadwal baru), ditolak (alasan), atau gugur | Orangnya; pengisi bila atas nama | Pemberitahuan | C1 |
| Jadwal cicilan Anda diubah (lama → baru, alasan) | Orangnya | Pemberitahuan | C2 |
| Pelunasan tunai tercatat (nominal, sisa, jadwal sesudahnya) | Orangnya | Pemberitahuan | DRV-69 |
| Utang kasbon dihapus (nominal, alasan) | Orangnya, para pemilik | Pemberitahuan | DRV-70 |
| Pelunasan atau hapus dibatalkan | Orangnya, Finance, para pemilik | Pemberitahuan | — |
| Pemilik atau GM mencatat pelunasan kasbonnya sendiri | Para pemilik | Pemberitahuan | C3 |
| Sisa kasbon dialihkan ke Piutang Lain | Orangnya, Finance, para pemilik | Pemberitahuan | DRV-73 |
| Orang dengan kasbon menunggu atau belum diberikan akan berhenti | Finance, Pemilik, GM | Perlu perhatian | C6 |
| Jadwal cicilan menyesuaikan slip utama baru | Orangnya | Pemberitahuan | DRV-74 |
| Dana Kasbon terpakai melebihi besarnya (karena pindah slip utama) | Pemilik, GM | Beranda (bukan antrean) | DRV-74 |
| Kasbon Khusus dibuat untuk Anda (nominal, kali potong) | Orangnya | Pemberitahuan | DRV-76 |
| Kasbon Khusus dibuat | Para pemilik, Finance | Pemberitahuan | DRV-75 |

---

## 8. Pengaturan (titipan 4J)

Tarif ritase **bukan** pengaturan kerangka 4B: ia tabel sendiri karena
bernilai per pasangan, tetapi mengikuti aturan pengaturan (bertanggal
berlaku, hanya Pemilik dan GM, wajib lewat Papan). 4G-1 tidak menambah
pengaturan baru.

| Pengaturan | Angka awal | Wajib diumumkan | Boleh dikecualikan per orang (PRI-26) | Bagian |
|---|---|---|---|---|
| Tarif ritase dan upah belanja (tabel sendiri) | 23 tarif sistem lama | ya, kecuali tarif pertama pasangan baru boleh berlaku hari ini (U3) | tidak | 4G-1 |
| Jarak pengumuman perubahan tarif | 1 hari (naik), 7 hari (turun); pengaturan Papan PRI-35 | — | tidak | 4B |
| Nominal denda per jenis (bersasaran jenis denda) | Tidak taat administrasi: Rp10.000 per kejadian (S1) | ya, 7 hari bila jenis baru atau naik | tidak | 4G-2 |
| Tanggal kejadian denda paling jauh ke belakang | 7 hari (S3) | ya | tidak | 4G-2 |
| Jam tombol Tutup slip mingguan aktif | Jumat 10.00 (S4) | tidak | tidak | 4G-2 |
| Jam mulai pengingat tutup slip mingguan | Jumat 15.00 (S4) | tidak | tidak | 4G-2 |
| Hari bayar, minggu upah, masa keberatan sesudah ditutup | Sabtu; Jumat–Kamis; 3 hari (sudah ada di DRV-85 dan 4E) | ya | tidak | DRV-19, 22 |
| Masa keberatan denda | 3 hari sejak diberi tahu (dibaca dari pengaturan masa keberatan potongan 4E-3, tidak disimpan dua kali) | ya | tidak | 4G-2 (S2) |
| Panjang uraian denda; alasan tolak, batal, tiadakan | 15 huruf | tidak | tidak | 4G-2 |
| Tarif bongkaran | Rp20 per kg (DRV-42) | ya; 1 hari bila naik, 7 hari bila turun | tidak | 4G-3a |
| Tanggal kerja bongkaran boleh mundur tanpa persetujuan | 3 hari (DRV-36) | ya | tidak | 4G-3a |
| Cabang penanggung biaya bongkaran | Gudang (DRV-51) | tidak | tidak | 4G-3a |
| Beda berat per satuan yang ditandai untuk Pemilik dan GM | lebih dari 10% (L5) | tidak | tidak | 4G-3a |
| Berat per satuan yang meminta konfirmasi | di atas 100 kg | tidak | tidak | 4G-3a |
| Jumlah foto surat jalan per laporan | 1 sampai 5 (L3) | tidak | tidak | 4G-3a |
| Panjang alasan (ubah berat, Barang lain, tanpa surat jalan, terlambat, tolak) | 15 huruf | tidak | tidak | 4G-3a |
| Lama "Sering ikut" di pilihan peserta | 30 hari | tidak | tidak | 4G-3a |
| Tanggal uang bongkaran boleh mundur tanpa alasan | 7 hari (dibaca dari pengaturan tanggal uang Gaji, GAJ-99; tidak disimpan dua kali) | tidak | tidak | 4G-3b (B1) |
| Masa "Uang belum saya terima" | 3 hari sejak diberi tahu dibayar | ya | tidak | 4G-3b (B2) |
| Jam pengingat bongkaran belum dibayar | 07.00 hari sesudah jatuh bayar, lalu tiap hari | tidak | tidak | 4G-3b |
| Batas lebih bayar bongkaran belum tertagih sebelum ditandai | 30 hari (sudah ada di DRV-85) | tidak | tidak | DRV-49 |
| Panjang alasan (koreksi, batal, tanyakan, belum terima, hapus lebih bayar, batal bayar) | 15 huruf | tidak | tidak | 4G-3b |
| Syarat masa kerja kasbon | 6 bulan (DRV-55) | ya; 7 hari bila diperketat | tidak (yang mendesak lewat Kasbon Khusus) | 4G-4a |
| Batas kasbon per orang | Rp250.000 (DRV-56); **tidak ditampilkan ke karyawan**, pengumumannya tanpa angka | ya, tanpa angka | tidak | 4G-4a |
| Besar Dana Kasbon slip bulanan; slip mingguan | Rp1.000.000; Rp1.000.000 (DRV-57) | tidak (urusan kantor) | tidak | 4G-4a |
| Paling banyak kali potong | 3 (DRV-59) | ya | tidak (Kasbon Khusus boleh lebih, DRV-75) | 4G-4a |
| Kelipatan nominal kasbon; nominal terkecil | Rp10.000; Rp50.000 (K1) | ya | tidak | 4G-4a |
| Batas waktu memproses kasbon sebelum ditandai | 2 hari kalender sejak diajukan (DRV-64, K7) | tidak | tidak | 4G-4a |
| Tanggal uang kasbon boleh mundur tanpa alasan | 7 hari (dibaca dari pengaturan tanggal uang Gaji, GAJ-99; tidak disimpan dua kali) | tidak | tidak | 4G-4a (K4) |
| Masa "Uang belum saya terima" (kasbon) | 3 hari sejak diberi tahu diberikan | ya | tidak | 4G-4a (K5) |
| Jam pengingat kasbon belum diberikan | 07.00 hari sesudah disetujui, lalu tiap hari | tidak | tidak | 4G-4a |
| Panjang alasan kasbon; catatan ubah angka, tolak, batal, belum terima | 15 huruf (DRV-59) | tidak | tidak | 4G-4a |
| Jatah tunda cicilan per kasbon | 1 kali (DRV-68) | ya | tidak | 4G-4b (C1) |
| Slip mulai Ubah jadwal paling jauh | 3 slip utama sesudah slip terbuka terdekat | tidak | tidak | 4G-4b (C2) |
| Tanggal uang pelunasan tunai boleh mundur tanpa alasan | 7 hari (dibaca dari pengaturan tanggal uang Gaji, GAJ-99; tidak disimpan dua kali) | tidak | tidak | 4G-4b (C3) |
| Kali potong Kasbon Khusus paling banyak | 12 (C7) | tidak (urusan Pemilik dan GM) | tidak | 4G-4b |
| Jenis kejadian Kasbon Khusus | Kecelakaan, Sakit, Duka, Lainnya (C7) | tidak | tidak | 4G-4b |
| Panjang alasan tunda, ubah jadwal, hapus, batal pelunasan atau hapus, Kasbon Khusus | 15 huruf | tidak | tidak | 4G-4b |

---

## 9. Jenis pengajuan (titipan 4J)

**4G-1 tidak menambah jenis pengajuan.** Tarif diubah langsung oleh Pemilik
atau GM (DRV-13); HR tidak mengusulkan tarif.

| Jenis pengajuan | Pengaju | Penyetuju | Batas waktu | Akibat bila terlewat | Bagian |
|---|---|---|---|---|---|
| Usulan denda driver/kenek | Kepala Gudang | Pemilik, GM (bukan untuk dirinya) | Diajukan paling lama 7 hari sesudah kejadian (S3); keputusan tanpa batas | Lewat 7 hari: tidak bisa diajukan. Belum diputuskan: pengingat harian; bila disahkan sesudah slip minggu itu ditutup, masuk slip berikutnya | 4G-2 |
| Keberatan potongan (diperluas ke denda driver dan kenek) | Orang yang didenda | Pemilik, GM | 23.59 hari ke-3 sejak diberi tahu | Tombol hilang; denda tetap | 4G-2 (S2; GAJ-81) |
| Keberatan slip (slip mingguan) | Driver, kenek | HR, Pemilik, GM | Sejak Jumat 00.00 sampai 23.59 hari ke-3 sesudah ditutup | Lewat: koreksi hanya lewat kantor sendiri | 4E-5c, DRV-22 |
| Laporan Bongkaran terlambat (tanggal kerja lebih dari 3 hari lalu) | Kepala Gudang | Pemilik, GM (bukan pembuat dan bukan peserta laporan itu) | Tanpa batas mengajukan dan memutuskan | Belum diputuskan: pengingat harian; selama menunggu belum ada upah dan belum bisa dibayar | 4G-3a (L4) |
| Upah bongkaran belum diterima | Peserta yang punya akun (Pemilik, GM boleh mengisikan untuk pekerja lepas) | Pemilik, GM | Diajukan paling lama 23.59 hari ke-3 sejak diberi tahu dibayar; keputusan tanpa batas | Lewat 3 hari: tombol hilang, sampaikan langsung ke kantor. Belum diputuskan: pengingat harian. Tidak ada akibat uang otomatis | 4G-3b (B2) |
| Kasbon | Karyawan untuk dirinya; HR, Admin HR, Pemilik, GM boleh mengisikan atas nama | Pemeriksa: Finance (bukan miliknya). Penyetuju: Pemilik, GM (bukan miliknya) | Tanpa batas mengajukan; diproses 2 hari | Lewat 2 hari: ditandai untuk Finance, Pemilik, GM; pengingat harian. Tidak ada yang ditolak atau disetujui otomatis | 4G-4a (DRV-59 s.d. 64) |
| Minta kasbon dibatalkan (sesudah disetujui, sebelum uang diberikan) | Pengaju | Pemilik, GM | Sampai uang diberikan | Selama menunggu, serah uang ditolak server; pengingat harian | 4G-4a (DRV-72) |
| Uang kasbon belum diterima | Pemilik kasbon | Pemilik, GM | Diajukan paling lama 23.59 hari ke-3 sejak diberi tahu diberikan; keputusan tanpa batas | Lewat 3 hari: tombol hilang, sampaikan langsung ke kantor. Tidak ada akibat uang otomatis | 4G-4a (K5) |
| Tunda cicilan kasbon | Pemilik kasbon; HR, Admin HR atas nama | Pemilik, GM (bukan miliknya) | Diajukan selama slip cicilan terdekat masih Perkiraan; diputuskan sebelum slip itu ditutup | Slip ditutup sebelum diputuskan: **gugur**, cicilan dipotong biasa, jatah tidak terpakai, boleh minta lagi. Bukan penahan slip | 4G-4b (DRV-68, C1) |

Kasbon Khusus **bukan** jenis pengajuan: ia dibuat langsung oleh Pemilik
atau GM (DRV-75). Ubah jadwal, pelunasan tunai, dan hapus utang juga bukan
pengajuan; ketiganya tindakan langsung orang yang berhak.

---

## 10. Kejadian di lapangan

| No | Kejadian | Sistem berbuat apa | Aturan |
|---|---|---|---|
| 1 | Trip L300 Putih ke Utara berkenek Selesai | Dedi (driver) Rp70.000 "dengan kenek", Eko (kenek) Rp40.000; dua baris Buku Upah | DRV-09 |
| 2 | Kenek dicopot sebelum Selesai | Dedi dibayar "tanpa kenek" Rp80.000; Eko tidak punya ritase | DRV-09, LOG U10 |
| 3 | Eko ikut ke Singaparna | Baris Rp0 "rute tanpa upah kenek" tetap tampil di slipnya | DRV-10, 17 |
| 4 | Trip ke Utara membawa satu tugas belanja | Dedi ritase + upah belanja; Eko ritase + upah belanja Rp0 | DRV-11 |
| 5 | Trip hanya belanja | Tanpa ritase; satu upah belanja per awak | LOG-34, DRV-11 |
| 6 | Rina (staf toko, bulanan) ikut jadi kenek di hari liburnya | Rp40.000, masuk slip mingguan di luar slip utama, dibayar utuh | DRV-05, 16 |
| 7 | Rina ikut di hari kerjanya | Rp0 "hari kerja, sudah dibayar gaji" | DRV-16 |
| 8 | Rina tercatat sakit tetapi ikut trip | Rp0 "bukan hari libur"; tanda Perlu dilihat untuk HR | DRV-16, U5 |
| 9 | Toko Rina tutup hari itu (hari tutup) dan ia ikut trip | Rp40.000 | DRV-16 |
| 10 | GM ikut menyetir | Rp0 "hari kerja, sudah dibayar gaji" (jabatan tidak diabsen) | DRV-16, KAR-67 |
| 11 | Libur Rina dipindah dari Sabtu (hari ia ikut trip) ke Selasa, slip mingguan belum ditutup | Baris Rp40.000 dibatalkan, baris Rp0 baru; Rina diberi tahu | U2 |
| 12 | Sama seperti 11, tetapi slip mingguan sudah ditutup dan dibayar | Potongan "koreksi upah ritase" Rp40.000 di slip bulanan Rina berikutnya | U2, DRV-04 |
| 13 | Hari tutup dipasang mundur untuk hari Rina ikut trip di hari kerjanya; slip mingguan sudah ditutup | Koreksi +Rp40.000 di slip mingguan berikutnya Rina (dibuat khusus bila tidak ada ritase) | U2, KEH-105 |
| 14 | Pemilik menaikkan tarif Utara | Paling cepat berlaku besok; pengumuman ke driver dan kenek | PRI-35 |
| 15 | Pemilik menurunkan tarif kenek Utara | Paling cepat berlaku 7 hari lagi | PRI-35 |
| 16 | Pemilik ingin tarif naik berlaku sejak Senin lalu | Tidak bisa (tidak berlaku mundur); kekurangannya boleh diberikan lewat Bonus Bebas dengan alasan | PRI-29 |
| 17 | Mobil baru dipakai ke rute lama hari ini | Tarif pertama pasangan itu boleh berlaku hari ini | U3 |
| 18 | Tarif kenek salah ketik Rp400.000, 3 ritase sudah dinilai, slip belum dibayar | Dibetulkan; 3 ritase dinilai ulang; yang slipnya sudah ditutup dikoreksi di slip berikutnya | U4 |
| 19 | Salah ketik baru ketahuan sesudah slipnya dibayar | Pembetulan ditolak; tarif baru ke depan, kelebihan lewat Potongan Lain | U4 |
| 20 | Ritase dobel dibatalkan Pemilik, slip belum ditutup | Baris upah ikut Dibatalkan | DRV-15 |
| 21 | Ritase dibatalkan sesudah slipnya ditutup | Potongan "koreksi upah ritase" di slip utama berikutnya | DRV-15 |
| 22 | Trip Kamis malam baru Selesai Jumat sesudah slip ditutup | Upah masuk slip minggu berikutnya dengan keterangan tanggal asal; tarif hari Kamis | DRV-22, 09 |
| 23 | Tarif naik berlaku Jumat; trip Kamis ditutup Jumat | Tarif lama (tanggal trip) | DRV-09 |
| 24 | Ritase tangan untuk pasangan yang belum bertarif di tanggal itu | Ditolak dengan kalimat cara mengisi tarif | DRV-92 |
| 25 | Tugas belanja ditambahkan ke trip Berjalan, rute belanjanya belum bertarif | Ditolak | DRV-92 |
| 26 | Entah bagaimana ritase tetap tanpa tarif | Baris Rp0 Belum bertarif; antrean Pemilik dan GM; slip mingguan orangnya tertahan | DRV-92 |
| 27 | Mobil dinonaktifkan | Tarifnya tetap tersimpan; pasangan pindah ke saringan Nonaktif | DRV-12 |
| 28 | Kepala Gudang ingin melihat upah Dedi minggu ini | Tidak bisa; ia melihat tarif dan daftar ritase tanpa rupiah | DRV-82, PRI-24 |
| 29 | Penilai ritase gagal saat trip Selesai | Pemeriksa susulan menilai dalam 10 menit; gagal lagi masuk antrean GM | PRI-33 |
| 30 | Jumat 08.00 HR ingin menutup slip minggu lalu | Tombol mati: "Aktif mulai Jumat 10.00" | S4 |
| 31 | Jumat 11.00 HR menekan "Tutup semua yang siap" | Semua slip mingguan tanpa penahan ditutup; Penilai ulang dijalankan dulu per orang; hasil: berapa ditutup, tertahan, gagal | DRV-22, 4E-5a |
| 32 | Trip Kamis malam baru Selesai Jumat 13.00, slip Dedi sudah ditutup | Ritase masuk slip minggu berikutnya, keterangan tanggal asal | DRV-22 |
| 33 | Jumat 15.00 masih ada 2 slip Perkiraan | Pengingat berantai ke HR, Pemilik, GM, menyebut yang tertahan dan penyelesainya | S4 |
| 34 | Ada ritase Belum bertarif di slip Eko | Slip Eko tertahan (penahan 7); slip orang lain tetap ditutup; tarif diisi → dinilai ulang → bisa ditutup | DRV-92 |
| 35 | Dedi tidak jalan sama sekali minggu ini, punya cicilan kasbon Rp50.000 | Slip mingguan tetap lahir; pendapatan Rp0; sisa potongan kasbon Rp50.000 ke minggu berikutnya; slip Rp0 Dibayar "tanpa uang" | DRV-24, GAJ-102 |
| 36 | Upah Eko Rp120.000, denda Rp10.000, Potongan Lain Rp50.000, cicilan kasbon Rp100.000 | Denda dan Potongan Lain penuh, kasbon Rp60.000; bersih Rp0; sisa kasbon Rp40.000 dibawa | DRV-24, GAJ-75 |
| 37 | Sabtu slip Ditutup belum dibayar | Tampil "Hari ini" di Jadwal Bayar; Minggu 07.00 pengingat belum Dibayar | DRV-27, GAJ-104 |
| 38 | Pemilik membayar slip mingguan Senin, uangnya diberikan Sabtu | Tanggal uang dipilih Sabtu (mundur ≤ 7 hari) | GAJ-99 |
| 39 | Driver bilang uangnya kurang | Keberatan slip "Uang belum saya terima" atau "Ada yang salah" dari Slip Saya | 4E-5c |
| 40 | Rina (staf bulanan) jadi kenek di hari liburnya, punya kasbon | Slip mingguan di luar slip utama, dibayar utuh; kasbon tetap di slip bulanan | DRV-05 |
| 41 | Driver tidak mengisi laporan di form | Kepala Gudang mengajukan denda Tidak taat administrasi; Pemilik mengesahkan; Rp10.000 di slip minggu kejadian | DRV-29, S1 |
| 42 | Uang setoran toko yang dibawa driver kurang Rp22.000 | **Bukan denda**: kurang serah di Pemeriksaan Uang → HR → Potongan Lain Rp22.000 | LOG-129 |
| 43 | Kepala Gudang mengetik nominal denda sendiri | Tidak bisa: tidak ada isian nominal | DRV-29 |
| 44 | Kepala Gudang mengajukan denda kejadian 10 hari lalu | Ditolak: paling lama 7 hari | S3 |
| 45 | Usulan denda disahkan Senin minggu berikutnya, slip minggu kejadian sudah ditutup | Masuk slip mingguan berikutnya, keterangan "kejadian [tanggal]" | GAJ-50 |
| 46 | Eko merasa denda tidak adil | Keberatan dalam 3 hari; denda tetap berjalan; bila Ditiadakan sesudah terpotong: koreksi plus di slip berikutnya | S2 |
| 47 | Denda salah orang, belum masuk slip | Pemilik membatalkan dengan alasan | PRI-02 |
| 48 | Denda salah orang, sudah terpotong | Pemilik meniadakan; koreksi plus di slip berikutnya; Dana Disiplin keluar | PRI-04 |
| 49 | Staf bulanan yang ikut trip didenda | Dipotong dari slip bulanannya (kelompok a), bukan slip mingguannya | DRV-30 |
| 50 | Kepala Gudang mencoba mendenda dirinya sendiri atau GM | Ditolak server | DRV-29 |
| 51 | Pemilik ingin menaikkan denda menjadi Rp20.000 | Lewat Papan; paling cepat berlaku 7 hari sesudah pengumuman terbit | PRI-35 |
| 52 | Driver berhenti, denda belum terpotong habis | Ikut slip terakhir; yang tidak tertampung Tidak tertagih | GAJ-82 |
| 53 | Slip minggu lalu salah, belum dibayar, slip minggu ini belum ditutup | Pemilik atau GM membuka kembali, membetulkan sumber, menutup ulang | GAJ-49, 95 |
| 54 | Truk supplier datang, 3 jenis barang, 4 orang membongkar | Kepala Gudang membuat laporan dari HP: 8.960 kg × Rp20 = Rp179.200, masing-masing Rp44.800; Finance diberi tahu | DRV-31, 35, 43 |
| 55 | Produk ini baru pertama kali dibongkar | Berat per sak wajib diisi; tersimpan dan terisi sendiri di bongkaran berikutnya | DRV-32 |
| 56 | Kemasan berubah dari 25 kg menjadi 20 kg per sak | Kepala Gudang menekan Ubah berat dengan alasan; beda 20% masuk daftar "Berat berubah" Pemilik dan GM; laporan lama tetap 25 kg | DRV-33, L5 |
| 57 | Kepala Gudang salah ketik berat 250 kg per sak | Konfirmasi "Betul 250 kg per sak?"; bila diteruskan, masuk "Berat berubah" | L5 |
| 58 | Barang tidak ketemu di pencarian | Sesudah pencarian kosong muncul "Barang tidak ada di daftar": nama, kg, alasan; laporan bertanda Barang lain | DRV-34 |
| 59 | Kepala Gudang ingin langsung mengetik kg tanpa mencari | Tidak bisa: pilihan Barang lain hanya muncul sesudah pencarian kosong | DRV-34 |
| 60 | Pemilik melihat banyak Barang lain bulan ini | DRV-L15: berapa laporan, kg, oleh siapa; dipasangkan ke produk yang benar; upah laporan tidak berubah | DRV-34 |
| 61 | Daftar produk kasir belum pernah diunggah | Langkah Barang menjadi isian Total kg + catatan barang; foto surat jalan wajib; laporan bertanda "kg diketik" | DRV-38 |
| 62 | Daftar produk diunggah ulang dari kasir | Berat per satuan yang sudah tersimpan tidak hilang | DRV-38 |
| 63 | Upah Rp186.750 dibagi 4 orang | Rp46.687 tiap orang, sisa Rp2: Andi dan Budi (abjad) mendapat Rp46.688 | DRV-43 |
| 64 | Kepala Gudang ikut membongkar | Boleh; laporan bertanda "pembuat ikut jadi peserta", terlihat Finance dan Pemilik | L2 |
| 65 | Rina (staf toko, bulanan) ikut membongkar di jam kerjanya | Dapat bagian penuh; tercatat "ikut bongkaran" di Catatan Hari Kerja | DRV-44 |
| 66 | Andi tercatat sakit hari itu tetapi ikut membongkar | Tetap dapat bagian; tanda "Perlu dilihat" untuk HR tanpa nominal | L7 |
| 67 | Tetangga gudang ikut membantu | Tambah pekerja lepas (nama, HP) dari langkah Peserta; dapat bagian yang sama | DRV-45 |
| 68 | Nomor HP pekerja lepas baru sama dengan orang yang sudah ada | Ditolak; orang pemilik nomor itu ditawarkan untuk dipilih | DRV-45 |
| 69 | Eko datang setelah separuh barang turun | Dua laporan: separuh pertama tanpa Eko, separuh kedua dengan Eko | DRV-43 |
| 70 | Dua truk dari supplier yang sama, muatan sama, hari yang sama | Laporan kedua meminta konfirmasi "Ini bongkaran lain"; tercatat sebagai tanda | DRV-37 |
| 71 | Bongkaran kemarin lusa belum dicatat | Tanggal kerja dimundurkan 2 hari; langsung Berlaku, bertanda "tanggal mundur" | DRV-36 |
| 72 | Bongkaran 6 hari lalu baru dicatat | Kepala Gudang mengisi dengan alasan; Menunggu persetujuan Pemilik atau GM; belum ada upah | L4 |
| 73 | Pemilik menolak laporan terlambat | Status Ditolak dengan alasan; tidak ada upah; Kepala Gudang boleh membuat laporan baru yang benar | L4 |
| 74 | Supplier tidak membawa surat jalan | "Tidak ada surat jalan": foto barang dan alasan; laporan bertanda | L3 |
| 75 | Supplier baru, belum ada di daftar | Kepala Gudang menambahkannya, bertanda "belum diperiksa"; Finance melihatnya di Keuangan | DRV-41, KEU-57 |
| 76 | Sinyal putus di tengah mengisi laporan | Isian tersimpan di HP; Simpan mati sampai sinyal kembali; tidak ada laporan setengah jadi | TAM-16, DRV-31 |
| 77 | Tarif bongkaran naik menjadi Rp25 mulai 16 November; laporan untuk tanggal kerja 15 November dibuat 17 November | Dihitung Rp20 (tarif tanggal kerja) | DRV-42 |
| 78 | Pemilik lupa mengisi tarif pengganti dan tarif lama diakhiri | Laporan ditolak dengan kalimat "tarif belum ada"; tidak ada angka cadangan | DRV-42 |
| 79 | Sambungan PO kasir sudah menyala; barang datang kurang 10 sak dari PO | Kepala Gudang memilih PO, mengubah jumlah yang datang; baris bertanda "Selisih dengan PO"; upah memakai jumlah datang | DRV-39, L6 |
| 80 | Peserta membuka portal sesudah bongkaran | Pendapatan Saya menampilkan tanggal, kg, jumlah peserta, bagiannya, "belum dibayar" | DRV-53 |
| 81 | Sore itu Finance mendapat kabar ada Laporan Bongkaran baru | Membuka laporan, melihat tanda dan foto surat jalan, membayar Rp179.200 dari Kas Pegangan, "diserahkan lewat Hadi"; 4 peserta diberi tahu | DRV-47, B2 |
| 82 | Dua bongkaran hari itu | Dicentang keduanya, dibayar sekaligus dari satu tempat uang; tetap dua pembayaran dan dua baris Buku Kas | DRV-47, KEU-25 |
| 83 | Finance melihat jumlah sak di laporan tidak cocok dengan foto surat jalan | **Tanyakan dulu**; Hadi mengoreksi jumlah; Finance membayar angka baru | B4, DRV-49 |
| 84 | Finance libur; laporan belum dibayar sampai besok | 07.00 pengingat ke Finance, Pemilik, GM; GM membayar | DRV-52 |
| 85 | Uang sudah diberikan kemarin sore, baru ditandai pagi ini | Tanggal uang dipilih kemarin | B1 |
| 86 | Pemilik sudah memberi uang bongkaran dan mencatatnya lewat Catatan Cepat | Finance memasangkan catatan itu ke laporan; laporan Dibayar; tetap satu baris | KEU-18 |
| 87 | Finance mengetik "upah bongkar" di Buku Kas | Ditolak; diarahkan ke Laporan Bongkaran | DRV-50, KEU-23 |
| 88 | Sari (Finance) ikut membongkar hari itu | Sari tidak bisa membayar laporan itu; dibayar Pemilik, GM, atau Finance lain | B3 |
| 89 | Budi bilang belum menerima uang dari Hadi | Tombol "Uang belum saya terima"; Pemilik atau GM menanyakan Hadi dan menutupnya dengan catatan | B2 |
| 90 | Pekerja lepas bilang belum menerima | Menyampaikan ke Kepala Gudang; Pemilik atau GM mengisikan atas namanya | B2 |
| 91 | Jumlah sak salah ketik, laporan belum dibayar | Kepala Gudang mengoreksi dengan alasan; upah dihitung ulang; Finance melihat angka baru | DRV-49 |
| 92 | Laporan terisi dua kali, belum dibayar | Kepala Gudang membatalkan satu dengan alasan; upahnya ikut batal | B6 |
| 93 | Sesudah dibayar ketahuan ada 20 sak belum terhitung | Pemilik atau GM mengoreksi; susulan Rp10.000 (Rp2.500 per orang) menunggu dibayar Finance | DRV-49 |
| 94 | Sesudah dibayar ketahuan kelebihan 20 sak | Dikoreksi; tiap orang lebih bayar Rp2.500, dipotong di bongkaran mereka berikutnya | DRV-49 |
| 95 | Ternyata Eko tidak ikut; yang ikut Fajar | Dikoreksi: Eko lebih bayar Rp44.800, Fajar disusulkan Rp44.800 | DRV-49 |
| 96 | Laporan yang sudah dibayar ternyata dobel | Pemilik atau GM membatalkan; semua pesertanya lebih bayar sebesar yang diterima | DRV-49 |
| 97 | Eko lebih bayar Rp44.800; bagian bongkaran berikutnya Rp30.000 | Eko menerima Rp0; sisa Rp14.800 menunggu bongkaran berikutnya | B5 |
| 98 | Pekerja lepas yang lebih bayar tidak pernah datang lagi | Sesudah 30 hari ditandai untuk Pemilik dan GM; dihapus dengan alasan | DRV-49 |
| 99 | Karyawan memilih mengembalikan kelebihan secara tunai | Pemilik menekan Tagih tunai; Finance mencatat Terima pengembalian (uang masuk) | DRV-49 |
| 100 | Finance salah pilih tempat uang (Brankas, seharusnya Kas Pegangan) | Pemilik atau GM membatalkan pembayaran dengan alasan; laporan kembali Berlaku; dibayar ulang | GAJ-103 |
| 101 | Peserta punya kasbon dan denda yang jatuh tempo | Tidak dipotong dari upah bongkaran; ia menerima bagiannya utuh | DRV-48 |
| 102 | Berat per sak di laporan yang sudah dibayar ternyata salah | Pemilik atau GM mengoreksi berat di laporan itu; centang "pakai untuk laporan berikutnya" sekaligus mengubah berat produknya | DRV-49, 105 |
| 103 | Pemilik ingin tahu siapa paling sering membongkar bulan ini | Bongkaran per Orang: berapa kali, kg, diterima, belum dibayar | DRV-53 |
| 104 | Dedi (driver, 2 tahun bekerja, tanpa kasbon) mengajukan Rp150.000, 2 kali potong | Lolos tiga syarat; tersimpan Menunggu; "diproses paling cepat 2 hari"; Finance diberi tahu | DRV-58, 60 |
| 105 | Karyawan baru 3 bulan mengajukan | Ditolak dengan kalimat 6 bulan; tidak ada yang tersimpan; tombol di Pengajuan Saya redup dengan alasannya | DRV-55 |
| 106 | Budi masih bersisa Rp150.000, mengajukan Rp150.000 lagi | Ditolak: "Pastikan Anda sudah membayar kasbon lama…"; angka batas tidak disebut | DRV-56 |
| 107 | Citra tanpa kasbon mengajukan Rp300.000 | Ditolak dengan kalimat "coba lagi setelah gajian" (angka batas tetap tidak disebut) | DRV-56 |
| 108 | Dana Kasbon mingguan sudah terpakai Rp900.000; Eko mengajukan Rp150.000 | Ditolak dengan kalimat "coba lagi setelah gajian"; Dana bulanan tidak terpengaruh | DRV-57 |
| 109 | Karyawan salah ketik nominal | Menarik pengajuannya, lalu mengajukan yang benar | DRV-72 |
| 110 | Karyawan mengajukan lagi saat pengajuan pertamanya belum diputuskan | Ditolak: "Masih ada pengajuan kasbon yang menunggu" | BER-L06 |
| 111 | Kenek tanpa handphone butuh kasbon | HR mengisikan atas namanya; tercatat diisi oleh HR; kenek melihatnya saat masuk | DRV-59 |
| 112 | HR mengisikan untuk orang yang salah | HR membatalkannya sebelum diputuskan; orang itu melihat pengajuan dan pembatalannya | DRV-59 |
| 113 | Sari (Finance) menilai Rp250.000 terlalu besar untuk Dedi | Mengusulkan Rp150.000 × 2 dengan catatan, menekan Sudah diperiksa; Dedi hanya melihat "Diperiksa" | DRV-61 |
| 114 | Finance merasa pengajuan sebaiknya ditolak | Menulisnya di catatan; yang menolak Pemilik atau GM | DRV-61 |
| 115 | GM menyetujui Rp150.000 walau diajukan Rp250.000 | Satu langkah: Disetujui, cicilan Rp75.000 dan Rp75.000; Dedi melihat "diajukan Rp250.000, disetujui Rp150.000" beserta catatan; Finance diberi tahu | DRV-61, 62 |
| 116 | GM ingin menyetujui lebih besar dari yang diajukan | Tidak bisa; nominal hanya turun. Karyawan mengajukan baru | DRV-61 |
| 117 | Finance libur dua hari, karyawan menunggu | GM memutuskan langsung; kasbon bertanda "tanpa pemeriksaan Finance" | K2 |
| 118 | Sari (Finance) mengajukan kasbon | Tidak bisa ia periksa atau ia serahkan sendiri; diputuskan dan diserahkan Pemilik atau GM | K3 |
| 119 | GM mengajukan kasbon | Diputuskan Owner; GM tidak bisa menyetujui miliknya | DRV-62 |
| 120 | Pengajuan ditolak dengan alasan "alasan kurang jelas" | Karyawan menekan Ajukan ulang, isian lama terisi, tiga syarat diperiksa lagi | PRI-37 |
| 121 | Rabu, pengajuan hari Senin belum diputuskan | Bertanda "Lewat 2 hari"; tampil di perlu perhatian Finance, Pemilik, GM; tidak ditolak otomatis | DRV-64 |
| 122 | Kasbon disetujui Selasa sore, Finance menyerahkan Rp150.000 tunai dari Kas Pegangan Rabu pagi | Satu penyerahan, satu baris Buku Kas "Kasbon diberikan"; Dedi diberi tahu; cicilan terjadwal | DRV-63 |
| 123 | Uang diberikan kemarin sore, baru ditandai pagi ini | Tanggal uang dipilih kemarin | K4 |
| 124 | Finance mencoba menandai diberikan untuk kasbon yang belum disetujui | Tidak ada tombolnya; server menolak | DRV-63 |
| 125 | Kasbon disetujui, tiga hari belum diserahkan | Tiap pagi pengingat ke Finance, Pemilik, GM sampai diberikan atau dibatalkan | DRV-64 |
| 126 | Dedi tidak jadi mengambil kasbon yang sudah disetujui | Minta dibatalkan; serah uang tertahan; GM membatalkan dengan alasan; dana kembali | DRV-72 |
| 127 | Uang kasbon dititipkan lewat Kepala Gudang, Dedi belum menerimanya | "Uang belum saya terima" dalam 3 hari; GM menanyakan dan menutupnya dengan catatan | K5 |
| 128 | Finance salah pilih tempat uang saat menyerahkan | GM menekan Batal serah uang; kasbon kembali menunggu diberikan; diserahkan ulang dari tempat yang benar | K6 |
| 129 | Tertandai diberikan padahal uangnya belum diserahkan, ketahuan sesudah cicilan pertama terpotong | Batal serah uang ditolak; diselesaikan lewat 4G-4b dan Keuangan | K6 |
| 130 | Owner sudah memberi uang ke Dedi dan mencatatnya di Catatan Cepat "Kasbon", kasbonnya sudah disetujui | Finance memasangkannya; kasbon Sudah diberikan; tetap satu baris Buku Kas | KEU-18 |
| 131 | Owner memberi uang dulu, belum ada pengajuan apa pun | Catatan ditandai "perlu ditanyakan"; kasbonnya diajukan dan disetujui (atau dibuat Kasbon Khusus), lalu dipasangkan; bertanda "uang keluar sebelum disetujui" | KEU-18, 32 |
| 132 | Finance mengetik "kasbon Dedi" di Buku Kas | Ditolak; diarahkan ke menu Kasbon | KEU-23 |
| 133 | Karyawan kecelakaan, butuh Rp2.000.000 hari ini, baru 4 bulan bekerja | Bukan kasbon biasa: Pemilik atau GM membuat Kasbon Khusus (4G-4b); uangnya diserahkan dengan langkah yang sama | DRV-75, 76 |
| 134 | Pekerja lepas minta kasbon | Tidak bisa: tanpa akun dan tanpa slip | DRV-45 |
| 135 | Batas per orang dinaikkan mulai 1 Desember | Pengajuan 30 November masih memakai batas lama | WAJ-07 |
| 136 | Staf toko pindah menjadi driver saat pengajuannya masih menunggu | Pengajuannya tetap di dana saat diajukan sampai diputuskan; perpindahan dana diurus 4G-4b | DRV-74 |
| 137 | Dedi diberi Rp150.000 × 2 Rabu 4 November | Cicilan 1 di minggu 30 Oktober – 5 November, cicilan 2 di minggu 6–12 November | DRV-65 |
| 138 | Uang diberikan Kamis 5 November, ditandai Jumat siang sesudah slip minggu itu ditutup, tanggal uang dipilih Kamis | Cicilan 1 masuk minggu 6–12 November (slip minggu tanggal uang sudah ditutup) | DRV-65 |
| 139 | Minggu Dedi sakit, pendapatan Rp50.000, cicilan Rp75.000 | Terpotong Rp50.000; sisa Rp25.000 dibawa ke minggu berikutnya, diambil lebih dulu di kelompok kasbon | DRV-66, GAJ-75 |
| 140 | Cicilan terakhir terpotong penuh | Sisa Rp0; kasbon Lunas sendiri; Dedi diberi tahu; Dana Kasbon terisi | DRV-71 |
| 141 | Slip yang memotong cicilan terakhir dibuka kembali | Mutasi dibalik; kasbon kembali Berjalan; ditutup ulang memotong lagi | GAJ-95 |
| 142 | Dedi punya dua kasbon berjalan, slip hanya cukup untuk satu | Kasbon yang lebih dulu diberikan dipotong dulu; sisanya dibawa | DRV-66 |
| 143 | Dedi minta cicilan minggu depan ditunda karena anaknya sakit | Minta tunda; GM menyetujui; semua cicilan bergeser satu minggu; jatah habis | DRV-68 |
| 144 | Permintaan tunda belum diputuskan saat slip ditutup Jumat | Gugur; cicilan dipotong biasa; jatah tidak terpakai; boleh minta untuk minggu berikutnya | C1 |
| 145 | Dedi minta tunda kedua kalinya untuk kasbon yang sama | Tombol redup "jatah tunda sudah dipakai"; bila perlu, GM memakai Ubah jadwal | DRV-68, C2 |
| 146 | Rina sakit sebulan, gaji kecil; cicilan Rp125.000 terasa berat | GM Ubah jadwal: sisa Rp250.000 menjadi 3 × Rp83.333/83.333/83.334 mulai bulan depan | C2 |
| 147 | Dedi membayar tunai Rp100.000 ke Finance | Pelunasan tercatat, uang masuk "Pelunasan kasbon" bukan pendapatan; cicilan terdekat berkurang dulu | DRV-69, C3 |
| 148 | Dedi melunasi semua sisa | Tombol Lunasi semua; kasbon Lunas; cicilan Terjadwal Diganti; Dana terisi | DRV-69, 71 |
| 149 | Finance mencoba mencatat pelunasan lebih dari sisa | Ditolak server | C3 |
| 150 | Finance salah mencatat pelunasan untuk kasbon orang lain | GM membatalkan pelunasan dengan alasan; jumlahnya kembali ke jadwal; Buku Kas dibatalkan; dicatat ulang di kasbon yang benar | — |
| 151 | Owner mengikhlaskan sisa kasbon karyawan yang keluarganya berduka | Hapus utang dengan alasan; tanpa uang bergerak; biaya "Utang kasbon dihapus"; kasbon Lunas | DRV-70 |
| 152 | Owner mengikhlaskan setengahnya saja | Hapus sebagian; cicilan terdekat berkurang; sisanya tetap dipotong | C4 |
| 153 | GM ingin menghapus kasbonnya sendiri | Tidak bisa; Owner yang memutuskan | DRV-70 |
| 154 | Andi berhenti 10 November dengan sisa kasbon Rp200.000 dan slip terakhir Rp150.000 | Seluruh sisa masuk slip terakhir; terpotong Rp150.000; Rp50.000 dialihkan ke Piutang Lain; kasbon Dialihkan | DRV-73, GAJ-82 |
| 155 | Tanggal berhenti Andi dicatat, ia masih punya pengajuan menunggu | Pengajuan bertanda "Akan berhenti"; Pemilik atau GM memutuskan; pengajuan baru ditolak | C6 |
| 156 | Kasbon Andi disetujui, uangnya belum diserahkan sampai sesudah hari terakhirnya | Serah uang ditolak server; Pemilik atau GM membatalkan kasbonnya | C6 |
| 157 | Mantan karyawan mencicil sisa utangnya | Lewat Buku Piutang Lain di Keuangan, bukan di kasbon | KEU-74 |
| 158 | Rina (bulanan) menjadi kenek mulai 26 November dengan sisa 2 cicilan bulanan | Dua cicilan pindah ke dua slip mingguan pertama yang mulai sesudah 26 November; sisanya pindah ke Dana mingguan | DRV-74, C5 |
| 159 | Dana mingguan sudah Rp950.000 terpakai saat Rina pindah membawa Rp150.000 | Perpindahan tetap jalan; dana tertulis melebihi; pengajuan baru di dana mingguan tertahan sampai turun | DRV-74 |
| 160 | Perubahan jabatan Rina dibatalkan sebelum 26 November | Mesin berjalan lagi; jadwal kembali ke slip bulanan | DRV-74 |
| 161 | Karyawan 4 bulan bekerja kecelakaan, butuh Rp2.000.000 hari ini | GM membuat Kasbon Khusus 10 kali potong, menekan Buat dan serahkan sekarang | DRV-75, 76 |
| 162 | GM butuh Kasbon Khusus | Dibuat Owner; GM tidak bisa membuat untuk dirinya | DRV-75 |
| 163 | Kasbon Khusus berjalan, karyawan mengajukan kasbon biasa | Kasbon Khusus tidak dihitung di batas dan dana | DRV-75 |
| 164 | Orang bersisa bawaan sistem lama Rp300.000 di hari tayang | Baris bawaan, 3 kali potong mulai slip utama pertama v3; tanpa baris Buku Kas | SIS-28 |
| 165 | Cicilan terpotong di slip yang kemudian dibatalkan pembayarannya | Cicilan tetap terpotong (slip masih Ditutup); bayar ulang slipnya | GAJ-103 |

---

## 11. Jalan keluar

| Tindakan | Kembali / ulangi | Batalkan | Oleh siapa, sampai kapan | Akibat ke data lain |
|---|---|---|---|---|
| Tarif baru | Kembali di tiap langkah | Baris Terjadwal dibatalkan dengan alasan sebelum berlaku; pengumuman ikut ditarik | Pemilik, GM | Tidak ada ke ritase lama |
| Tarif yang sudah berlaku | — | Digantikan tarif baru ke depan (lewat Papan); salah ketik dibetulkan (DRV-L04) | Pemilik, GM | Pembetulan: ritase dinilai ulang |
| Betulkan salah ketik | Kembali sebelum tombol ditahan | Dibetulkan lagi bila masih salah (syarat sama) | Pemilik, GM; sampai ada slip Dibayar yang memuatnya | Penilaian ulang; koreksi di slip berikutnya |
| Penilaian ulang (mesin) | — | Tidak dibatalkan sendiri; berbalik bila pemicunya dibalik (izin dibatalkan, libur dipindah lagi) | Mesin | Baris baru atau koreksi balik |
| Sudah dilihat (tanda) | — | Dibuka lagi menjadi Perlu dilihat dengan catatan | HR, Pemilik, GM | Tidak ada |
| Batal ritase | Milik Logistik | Ritase yang dibatalkan tidak dihidupkan lagi; yang benar dibuat sebagai ritase tangan | Pemilik, GM | Upah dinilai Rp0 atau dipotong lewat koreksi |
| Tutup slip mingguan | — | Buka kembali (syarat GAJ-95) | Pemilik, GM; sebelum dibayar dan sebelum slip berikutnya ditutup | Pembalikan 4E-5a |
| Bayar slip mingguan | — | Batal bayar (alasan) | Pemilik, GM; tanpa batas waktu | Buku Kas dibatalkan; slip kembali Ditutup |
| Ajukan denda | Kembali di tiap langkah | Tarik selama menunggu | Pengaju | Tidak ada |
| Sahkan denda | — | Batalkan (sebelum terpotong) atau Tiadakan (sesudah) | Pemilik, GM | Hilang dari perkiraan, atau koreksi plus + Dana Disiplin keluar |
| Tolak usulan denda | — | Ajukan baru selama masih ≤ 7 hari dari kejadian | Pengaju | Tidak ada |
| Jenis atau nominal denda | — | Perubahan terjadwal dibatalkan sebelum berlaku; sesudahnya diganti lewat Papan | Pemilik, GM | Denda yang sudah lahir tetap nominal lamanya |
| Laporan Bongkaran baru | Kembali di tiap langkah; isian tersimpan di perangkat | Sesudah tersimpan: Koreksi (sebelum dibayar) atau Batalkan (4G-3b); tidak dihapus | Kepala Gudang sebelum dibayar; Pemilik, GM sesudahnya (DRV-49) | Baris Buku Upah lama dibatalkan dan ditulis ulang (4G-3b) |
| Laporan terlambat | Tarik selama menunggu | Ditolak; sesudah disetujui mengikuti laporan biasa | Pembuat menarik; Pemilik, GM memutuskan | Tidak ada upah sampai disetujui |
| Ubah berat per satuan | — | Diubah lagi ke angka yang benar (alasan); riwayat tetap | Kepala Gudang, Pemilik, GM | Hanya laporan sesudahnya; laporan yang sudah memakai berat salah dikoreksi lewat 4G-3b |
| Barang lain | Buang baris sebelum Simpan | Pasangkan ke produk, atau Lepas pasangan | Pemilik, GM | Tidak mengubah kg dan upah |
| Tambah pekerja lepas dari laporan | — | Nonaktifkan di KAR-L28 bila salah orang | HR, Kepala Gudang, Pemilik, GM | Tidak ada |
| Tambah supplier dari laporan | — | Digabung atau dibetulkan Finance (KEU-57) | Finance, GM | Laporan ikut menunjuk supplier hasil gabungan |
| Tanda "Berat berubah" atau "Perlu dilihat" ditutup | — | Dibuka lagi dengan catatan | Pemilik, GM (berat); HR, Pemilik, GM (peserta) | Tidak ada |
| Tarif bongkaran | — | Perubahan terjadwal dibatalkan sebelum berlaku; sesudahnya diganti lewat Papan | Pemilik, GM | Laporan yang sudah ada tetap tarif lamanya |
| Bayar bongkaran atau susulan | Kembali di langkah 1–2 | Batal bayar (alasan), lalu bayar ulang | Pemilik, GM; selama belum ada koreksi sesudah dibayar | Baris Buku Kas dibatalkan; lebih bayar yang diperhitungkan hidup kembali; laporan kembali Berlaku |
| Tanyakan dulu | — | Ditarik penanya; padam sendiri saat dijawab atau dikoreksi | Penanya | Tidak ada |
| Uang belum saya terima | — | Ditarik selama menunggu | Peserta | Tidak ada |
| Koreksi sebelum dibayar | Kembali di tiap langkah | Koreksi lagi; versi lama tetap tersimpan | Kepala Gudang, Pemilik, GM; sampai dibayar | Baris Buku Upah ditulis ulang |
| Batalkan laporan (sebelum atau sesudah dibayar) | Kembali sebelum tombol ditahan | Tidak dihidupkan lagi; yang benar dibuat sebagai laporan baru (lebih bayar diperhitungkan saat laporan baru dibayar) | Kepala Gudang sebelum dibayar; Pemilik, GM sesudahnya | Baris Buku Upah dibatalkan; sesudah dibayar: lebih bayar |
| Koreksi sesudah dibayar | Kembali di tiap langkah | Koreksi lagi; selisihnya dijaring dengan susulan atau lebih bayar yang belum selesai | Pemilik, GM; tanpa batas waktu | Susulan atau lebih bayar; pembayaran pertama tidak berubah |
| Tagih tunai (lebih bayar) | — | Dikembalikan menjadi Berjalan (alasan) | Pemilik, GM | Tidak ada |
| Terima pengembalian | — | Dibatalkan (alasan) | Pemilik, GM | Uang masuk dibatalkan lewat Keuangan; sisa hidup kembali |
| Hapus lebih bayar | — | Penghapusan dibatalkan (alasan); sisa hidup kembali | Pemilik, GM | Tidak ada uang bergerak |
| Ajukan kasbon | Kembali di tiap langkah | Batalkan (tarik) selama Menunggu atau Diperiksa | Pengaju atau pengisinya | Yang terpakai di batas dan dana lepas |
| Isikan kasbon atas nama | Kembali di tiap langkah | Dibatalkan pengisi atau orangnya sebelum diputuskan | HR, Admin HR, Pemilik, GM; orangnya | Kartu "diisi oleh" tetap terlihat |
| Sudah diperiksa (Finance) | — | Usulan diubah lagi selama belum diputuskan; Pemilik atau GM bebas memakai angka lain | Finance | Tidak ada |
| Setujui kasbon | Kembali sebelum tombol ditahan | Batalkan (DRV-L30) selama uang belum diberikan | Pemilik, GM | Cicilan dibatalkan; dana lepas |
| Tolak kasbon | — | Pengaju Ajukan ulang | Pengaju | Tiga syarat diperiksa lagi |
| Minta dibatalkan | — | Ditarik pengaju selama belum diputuskan | Pengaju | Serah uang terbuka lagi |
| Batalkan kasbon | Kembali sebelum tombol ditahan | Tidak dihidupkan lagi; ajukan baru | Pemilik, GM; sampai uang diberikan | Tidak ada uang bergerak |
| Serahkan uang kasbon | Kembali di langkah 1–2 | Batal serah uang (alasan), lalu serahkan ulang atau batalkan kasbon | Pemilik, GM; sampai ada cicilan terpotong, dilunasi, atau dihapus | Baris Buku Kas dibatalkan; jadwal cicilan dilepas |
| Uang belum saya terima (kasbon) | — | Ditarik selama menunggu | Pemilik kasbon | Tidak ada |
| Pengaturan kasbon | — | Perubahan terjadwal dibatalkan sebelum berlaku; sesudahnya diganti lewat Papan | Pemilik, GM | Pengajuan yang sudah tersimpan tidak diperiksa ulang |
| Cicilan ditandai terpotong (tutup slip) | — | Buka kembali slip (GAJ-95) | Pemilik, GM; syarat GAJ-95 | Mutasi dibalik; kasbon bisa kembali Berjalan |
| Minta tunda | Kembali di langkah 1 | Ditarik selama menunggu; gugur sendiri bila slipnya ditutup | Pemilik kasbon atau pengisinya | Tidak ada |
| Setujui tunda | Kembali sebelum tombol ditahan | Ubah jadwal (C2) bila ternyata salah | Pemilik, GM | Versi jadwal baru |
| Ubah jadwal | Kembali di tiap langkah | Ubah jadwal lagi | Pemilik, GM; selama masih ada cicilan Terjadwal | Versi jadwal baru |
| Terima pelunasan | Kembali di langkah 1–2 | Batalkan pelunasan (DRV-L39) | Pemilik, GM; selama kasbon belum Dialihkan | Uang masuk dibatalkan; jumlahnya kembali ke jadwal |
| Hapus utang | Kembali di tiap langkah | Batalkan hapus (DRV-L39) | Pemilik, GM; selama kasbon belum Dialihkan | Biaya dibatalkan; jumlahnya kembali ke jadwal |
| Dialihkan ke Piutang Lain (slip terakhir) | — | Buka kembali slip terakhir (syarat GAJ-95: piutang belum dicicil) | Pemilik, GM | Piutang dibalik; kasbon Berjalan |
| Pindah slip utama | — | Batalkan perubahan jabatan di Karyawan; jadwal dipasang ulang | HR, Pemilik, GM (4A) | Versi jadwal baru |
| Buat Kasbon Khusus | Kembali di tiap langkah | Batalkan (DRV-L30) selama uang belum diberikan | Pemilik, GM | Tidak ada uang bergerak |

---

## 12. Daftar tes

Angka tarif contoh: **L300 Putih × Utara** driver dengan kenek Rp70.000,
tanpa kenek Rp80.000, kenek Rp40.000. **L300 Putih × Singaparna** Rp90.000 /
Rp100.000 / Rp0. **L300 Putih × Belanja Pasar Induk** Rp25.000 / Rp25.000 /
Rp0.

**Uang**

| No | Tes | Contoh |
|---|---|---|
| U1 | Angka per peran | Trip Utara berkenek: Dedi Rp70.000, Eko Rp40.000. Tanpa kenek: Dedi Rp80.000 |
| U2 | Kenek Rp0 tetap tercatat | Singaparna berkenek: Eko satu baris Rp0 "rute tanpa upah kenek"; jumlah slip Eko tidak berubah, barisnya tampil |
| U3 | Upah belanja | Trip Utara berkenek + 1 tugas Pasar Induk: Dedi 70.000 + 25.000 = Rp95.000; Eko 40.000 + 0 = Rp40.000 |
| U4 | Tarif menurut tanggal trip | Tarif Utara naik menjadi 75.000 / 85.000 / 45.000 berlaku Jumat 13 November. Trip Kamis 12 November Selesai Jumat 01.00: Dedi Rp70.000 |
| U5 | Staf bulanan di hari libur | Rina kenek Utara di hari liburnya: Rp40.000, slip mingguan di luar slip utama |
| U6 | Staf bulanan di hari kerja dan hari sakit | Hari kerja: Rp0 "hari kerja, sudah dibayar gaji". Sakit: Rp0 "bukan hari libur" + satu tanda Perlu dilihat |
| U7 | Hari tutup | Hari tutup cabang Rina: Rp40.000 |
| U8 | Dua sebab Rp0 | Rina kenek Singaparna di hari kerjanya: Rp0 berketerangan "hari kerja, sudah dibayar gaji" |
| U9 | Penilaian ulang sebelum tutup | Rina Rp40.000 (Sabtu libur); libur dipindah, slip belum ditutup: baris 40.000 Dibatalkan, baris Rp0 Berlaku; perkiraan slip mingguan Rina Rp0 |
| U10 | Koreksi minus ke slip utama | Sama dengan U9 tetapi slip mingguan sudah Ditutup: slip bulanan Rina berikutnya memuat potongan (a) "koreksi upah ritase" Rp40.000; slip mingguannya tidak berubah |
| U11 | Koreksi plus ke slip mingguan | Rina Rp0 (hari kerja), slip mingguan Ditutup; hari tutup dipasang mundur: baris koreksi +Rp40.000 di slip mingguan berikutnya; bila Rina tidak punya ritase minggu itu, slip mingguan dibuat hanya berisi koreksi |
| U12 | Koreksi minus tidak tertampung | Dedi (mingguan) koreksi −Rp70.000; pendapatan minggu berikutnya Rp50.000: terpotong Rp50.000, sisa potongan "koreksi" Rp20.000 ke minggu berikutnya; bersih Rp0 |
| U13 | Pembetulan salah ketik | Kenek tertulis Rp400.000; Eko 2 ritase (minggu berjalan) dan 1 ritase (minggu lalu, Ditutup, belum Dibayar). Dibetulkan Rp40.000: 2 baris diganti (perkiraan −Rp720.000); 1 koreksi minus −Rp360.000 di slip mingguan berikutnya |
| U14 | Pembetulan ditolak sesudah dibayar | Slip Eko minggu lalu sudah Dibayar: DRV-L04 berhenti di langkah 2 dengan kalimat jalan keluar |
| U15 | Batal ritase | Batal sebelum tutup: baris upah Dibatalkan, perkiraan turun Rp70.000. Sesudah tutup: potongan (a) Rp70.000 di slip utama berikutnya |
| U16 | Tidak dobel | Penilai ritase dijalankan dua kali untuk ritase yang sama: tetap satu baris Berlaku |
| U17 | Rupiah bulat | Tarif Rp70.000,50 atau minus ditolak server |
| U18 | Belum bertarif | Ritase tanpa tarif: baris Rp0 Belum bertarif, slip mingguan tertahan; tarif diisi: baris dinilai Rp70.000, tahanan hilang |
| U19 | Isi slip mingguan | Dedi minggu 30 Okt – 5 Nov: 4 ritase Utara berkenek (4 × 70.000) + 1 upah belanja 25.000 + bonus ongkir 15.000 = pendapatan Rp320.000 |
| U20 | Urutan potongan mingguan | Eko pendapatan Rp120.000; denda 10.000, Potongan Lain 50.000, kasbon 100.000: terpotong 10.000 / 50.000 / 60.000; bersih Rp0; sisa kasbon Rp40.000 dibawa |
| U21 | Sisa dulu di kelompoknya | Minggu berikutnya Eko pendapatan Rp200.000, cicilan kasbon baru 100.000 + sisa 40.000: sisa 40.000 terpotong lebih dulu, lalu 100.000; bersih Rp60.000 |
| U22 | Slip tanpa ritase | Dedi tanpa ritase, cicilan kasbon Rp50.000: slip lahir, bersih Rp0, sisa Rp50.000; ditutup langsung Dibayar "tanpa uang", tanpa baris Buku Kas |
| U23 | Slip di luar slip utama | Rina (bulanan) Rp40.000 ritase di hari liburnya, punya Potongan Lain dan denda driver: slip mingguan bersih Rp40.000; denda dan Potongan Lain di slip bulanannya |
| U24 | Nominal denda disalin | Nominal Tidak taat administrasi naik ke Rp20.000 berlaku 16 November; denda kejadian 13 November disahkan 17 November: Rp10.000 |
| U25 | Denda ke Dana Disiplin sebesar terpotong | Denda 10.000, pendapatan Rp6.000: terpotong 6.000, Dana Disiplin +6.000; sisa 4.000 masuk Dana Disiplin saat terpotong minggu berikutnya |
| U26 | Tiadakan sesudah terpotong | Denda 10.000 terpotong di slip yang Dibayar; ditiadakan: koreksi plus +10.000 di slip mingguan berikutnya, Dana Disiplin −10.000 |
| U27 | Bayar satu langkah | Bayar slip Dedi Rp320.000 dari Kas Pegangan: satu pembayaran, satu baris Buku Kas Bayar gaji cabang Gudang; dibayar kedua kali ditolak |
| U28 | Penilai ulang sebelum tutup | Status hari Rina diubah Jumat 09.00 sebelum tutup: langkah tutup Jumat 11.00 memakai nilai baru, bukan koreksi |
| U29 | Total kg dari barang | 200 sak × 25 kg + 150 dus × 20 kg + 100 dus × 9,6 kg = 8.960 kg; × Rp20 = Rp179.200; 4 peserta masing-masing Rp44.800 |
| U30 | Sisa rupiah menurut abjad | 9.337,5 kg × Rp20 = Rp186.750; peserta Eko, Dedi, Budi, Andi (urutan pilih): Andi Rp46.688, Budi Rp46.688, Dedi Rp46.687, Eko Rp46.687; jumlah Rp186.750 |
| U31 | Pembulatan upah | Tarif contoh Rp25: 100,1 kg → 2.502,5 → Rp2.503; 100,05 kg → 2.501,25 → Rp2.501 |
| U32 | Pembulatan kg baris | 7 dus × 0,333 kg = 2,331 kg; 1,5 × 0,333 = 0,4995 → 0,500 kg |
| U33 | Tarif menurut tanggal kerja | Tarif menjadi Rp25 berlaku 16 November; laporan dibuat 17 November untuk tanggal kerja 15 November, 1.000 kg: Rp20.000 |
| U34 | Tarif tidak ada | Tanggal kerja tanpa tarif berlaku: laporan ditolak, tidak ada yang tersimpan |
| U35 | Berat tersalin | Laporan A: 200 sak × 25 kg = 5.000 kg. Berat diubah menjadi 20 kg. Laporan A tetap 5.000 kg dan Rp100.000; laporan B 200 sak = 4.000 kg |
| U36 | Satu langkah utuh | Penulisan peserta dibuat gagal: tidak ada laporan, barang, berat baru, maupun baris Buku Upah yang tersimpan |
| U37 | Satu baris upah per peserta | 4 peserta: 4 baris Buku Upah jenis bongkaran, jumlahnya = total upah; tidak satu pun masuk slip; disimpan ulang (ketuk dua kali) tidak membuat laporan kedua |
| U38 | Peserta dobel | Orang yang sama dikirim dua kali di satu laporan: ditolak server |
| U39 | Bulanan di hari kerja tetap dapat | Rina hadir di tokonya hari itu dan ikut bongkaran: bagian penuh (beda dengan ritase, U6) |
| U40 | Barang lain | 8.460 kg dari produk + Barang lain 500 kg = 8.960 kg. Dipasangkan ke produk belakangan: kg dan upah tetap |
| U41 | Total kg diketik | Daftar produk kosong: Total kg 7.250 → Rp145.000, laporan bertanda "kg diketik". Daftar produk terisi: permintaan berisi Total kg diketik ditolak server |
| U42 | Angka tidak diterima dari layar | Permintaan simpan yang menyertakan total kg, tarif, atau bagian buatan sendiri: diabaikan, server menghitung sendiri |
| U43 | Laporan terlambat belum berupah | Menunggu persetujuan: 0 baris Buku Upah, tidak tampil di daftar bayar. Disetujui: baris lahir dengan tarif tanggal kerja. Ditolak: tetap 0 |
| U44 | Pekerja lepas | Pekerja lepas di antara 4 peserta: bagian sama, baris Buku Upah atas namanya |
| U45 | Bagian lebih kecil dari jumlah orang | 0,1 kg × Rp20 = Rp2, 3 peserta (Andi, Budi, Dedi): Rp1, Rp1, Rp0; jumlah Rp2 |
| U46 | Bayar satu langkah | LB Rp179.200 dibayar dari Kas Pegangan: satu pembayaran, 4 rincian Rp44.800, satu baris Buku Kas "Upah bongkaran" Rp179.200 cabang Gudang bertaut ke laporan; dibayar kedua kali ditolak |
| U47 | Nominal tidak dari layar | Permintaan bayar yang menyertakan nominal atau rincian buatan sendiri: diabaikan; server menghitung sendiri |
| U48 | Tanpa potongan | Dedi punya denda dan cicilan kasbon jatuh tempo: tetap menerima Rp44.800; tidak ada baris bongkaran di slipnya |
| U49 | Koreksi sebelum dibayar | 200 sak dikoreksi menjadi 180: 8.460 kg, Rp169.200, masing-masing Rp42.300; 4 baris Buku Upah lama Dibatalkan, 4 baru; versi 1 tersimpan; yang dibayar Rp169.200 |
| U50 | Kurang bayar | Sesudah dibayar Rp179.200, dikoreksi menjadi 220 sak: 9.460 kg, Rp189.200, masing-masing Rp47.300; susulan 4 × Rp2.500 = Rp10.000 Menunggu bayar; pembayaran pertama dan baris Buku Kasnya tidak berubah; susulan dibayar: baris Buku Kas kedua Rp10.000 bertaut ke laporan |
| U51 | Lebih bayar | Sesudah dibayar, dikoreksi menjadi 180 sak: lebih bayar Rp2.500 per orang (4 baris); tidak ada baris Buku Kas baru |
| U52 | Peserta diganti | Eko keluar, Fajar masuk: bagian tetap Rp44.800; Eko lebih bayar Rp44.800; susulan Fajar Rp44.800; Andi, Budi, Dedi tanpa selisih |
| U53 | Peserta berkurang | Eko keluar (tinggal 3): Andi Rp59.734, Budi Rp59.733, Dedi Rp59.733; susulan 14.934 + 14.933 + 14.933 = Rp44.800; Eko lebih bayar Rp44.800 |
| U54 | Diperhitungkan | Andi bersisa lebih bayar Rp2.500; laporan berikutnya Rp120.000 untuk 4 orang: Andi menerima Rp27.500, yang lain Rp30.000; uang keluar dan baris Buku Kas Rp117.500; lebih bayar Andi Lunas |
| U55 | Lebih bayar melebihi bagian | Eko bersisa Rp44.800; bagian berikutnya Rp30.000: diterima Rp0, sisa Rp14.800; bongkaran sesudahnya bagian Rp20.000: diterima Rp5.200, Lunas |
| U56 | Paling lama lebih dulu | Andi punya lebih bayar 5 November Rp2.500 dan 9 November Rp4.000; bagian Rp5.000: yang pertama Lunas, yang kedua bersisa Rp1.500; diterima Rp0 |
| U57 | Jaring di laporan yang sama | Lanjutan U51 (lebih bayar Rp2.500 per orang, belum tertagih); koreksi kedua menjadi 190 sak: 8.710 kg, Rp174.200, bagian Rp43.550; selisih +Rp1.250 mengurangi lebih bayar menjadi Rp1.250; tidak ada susulan |
| U58 | Batal sesudah dibayar | Laporan Rp179.200 dibatalkan: 4 baris Buku Upah Dibatalkan, 4 lebih bayar Rp44.800; baris Buku Kas pembayaran tetap |
| U59 | Batal bayar | Pembayaran U54 dibatalkan: baris Buku Kas Rp117.500 dibatalkan; lebih bayar Andi Rp2.500 hidup kembali; laporan Berlaku. Batal bayar atas laporan U50 (sudah dikoreksi sesudah dibayar): ditolak |
| U60 | Terima pengembalian dan hapus | Eko bersisa Rp14.800: terima pengembalian Rp10.000 (satu baris uang masuk bertaut ke laporan asal), sisa Rp4.800 dihapus dengan alasan: status Dihapus, tanpa baris Buku Kas. Terima Rp20.000: ditolak (melebihi sisa) |
| U61 | Tanpa uang | Eko satu-satunya peserta, bagian Rp10.000, sisa lebih bayar Rp14.800: uang keluar Rp0, pembayaran "tanpa uang", tidak ada baris Buku Kas, laporan Dibayar |
| U62 | Catatan Cepat | Catatan Cepat Finance Rp179.200 dipasangkan ke laporan: Dibayar, satu baris (catatan itu sendiri). Catatan Rp179.000: ditolak karena tidak sama persis |
| U63 | Per orang seimbang | Untuk satu orang satu rentang di DRV-L22: jumlah bagian = diterima + diperhitungkan ke lebih bayar + belum dibayar |
| U64 | Bayar sekaligus tidak dobel | Dua laporan dicentang; satu sudah dibayar orang lain sesaat sebelumnya: yang satu Dibayar, yang lain dilaporkan gagal "sudah dibayar"; tidak ada pembayaran kedua |
| U65 | Batas orang | Budi sisa kasbon Rp150.000: mengajukan Rp100.000 diterima (Rp250.000); mengajukan Rp110.000 ditolak dengan kalimat "kasbon lama masih banyak" |
| U66 | Tanpa kasbon, melewati batas | Citra tanpa kasbon mengajukan Rp260.000: ditolak dengan kalimat "coba lagi setelah gajian"; angka Rp250.000 tidak ada di jawaban server |
| U67 | Dana | Dana mingguan: sisa utang berjalan Rp700.000 + pengajuan menunggu Rp200.000 = terpakai Rp900.000. Eko mengajukan Rp150.000: ditolak; Rp100.000: diterima. Dana bulanan tidak berubah |
| U68 | Urutan periksa | Orang 3 bulan bekerja, dana penuh: kalimat 6 bulan (bukan kalimat dana). Orang 2 tahun, melewati batas dan dana penuh: kalimat batas. Tidak ada baris `pengajuan` maupun `kasbon` yang tersimpan |
| U69 | Kasbon Khusus tidak dihitung | Dedi punya Kasbon Khusus bersisa Rp2.000.000: mengajukan kasbon biasa Rp250.000 diterima; terpakai dana hanya bertambah Rp250.000 |
| U70 | Dana lepas | Pengajuan Rp200.000 ditarik atau ditolak: terpakai dana turun Rp200.000 saat itu juga |
| U71 | Nominal diturunkan | Diajukan Rp250.000 × 3; disetujui Rp150.000 × 2: cicilan Rp75.000 dan Rp75.000; terpakai dana turun dari Rp250.000 menjadi Rp150.000 |
| U72 | Bagi cicilan | Rp250.000 × 3: Rp83.333, Rp83.333, Rp83.334; Rp100.000 × 3: Rp33.333, Rp33.333, Rp33.334; jumlah selalu sama dengan nominal akhir |
| U73 | Hanya turun | Penyetuju mengirim nominal akhir Rp300.000 untuk pengajuan Rp250.000: ditolak server; kali potong 4: ditolak. Usulan Finance Rp150.000, penyetuju memilih Rp250.000 (angka pengaju): diterima |
| U74 | Kelipatan dan terkecil | Rp125.000 ditolak (bukan kelipatan Rp10.000); Rp40.000 ditolak; Rp50.000 diterima |
| U75 | Setujui satu langkah | Penulisan cicilan dibuat gagal: status tetap Diperiksa, tidak ada nominal akhir yang tersimpan |
| U76 | Serah uang satu langkah | Kasbon Rp150.000 diserahkan dari Kas Pegangan: satu penyerahan, satu baris Buku Kas "Kasbon diberikan" Rp150.000 bukan biaya bertaut ke kasbon; diserahkan kedua kali ditolak; nominal dari layar diabaikan |
| U77 | Catatan Cepat | Catatan Cepat "Kasbon" Rp150.000 dipasangkan: Sudah diberikan, satu baris (catatan itu sendiri). Catatan Rp200.000: ditolak karena tidak sama persis |
| U78 | Batal serah uang | Penyerahan U76 dibatalkan: baris Buku Kas dibatalkan, slip tujuan cicilan kosong lagi, kasbon Disetujui belum diberikan, terpakai tetap Rp150.000. Sesudah satu cicilan terpotong: ditolak |
| U79 | Batalkan sebelum diberikan | Kasbon Rp150.000 Disetujui dibatalkan: 2 cicilan Dibatalkan, terpakai turun Rp150.000, tidak ada baris Buku Kas |
| U80 | Sisa bawaan sistem lama | Orang bersisa bawaan Rp300.000 (di atas batas): tercatat tanpa ditolak; pengajuan barunya ditolak dengan kalimat "kasbon lama masih banyak"; dana berkurang Rp300.000 |
| U81 | Kembar | Pengajuan kedua selagi yang pertama Menunggu: ditolak; sesudah yang pertama Disetujui dan sisa batas cukup: diterima |
| U82 | Sisa kasbon | Diberikan Rp150.000; terpotong Rp50.000 (slip) + Rp25.000 (sisa dibawa) + tunai Rp30.000 + hapus Rp20.000: sisa Rp25.000 = cicilan Terjadwal + dibawa. Tidak ada kolom sisa yang tersimpan |
| U83 | Terpotong sebagian | Pendapatan Rp50.000, cicilan Rp75.000: mutasi Rp50.000, cicilan Sebagian, `sisa_potongan` kasbon Rp25.000; minggu berikutnya Rp25.000 diambil sebelum cicilan baru |
| U84 | Dua kasbon | KB-1 diberikan 1 Oktober cicilan Rp50.000, KB-2 diberikan 1 November Rp50.000; kelompok (d) tertampung Rp70.000: KB-1 Rp50.000, KB-2 Rp20.000, sisa KB-2 Rp30.000 dibawa |
| U85 | Lunas sendiri | Cicilan terakhir terpotong: keadaan Lunas tanpa tombol; buka kembali slip: Berjalan lagi, cicilan Terjadwal |
| U86 | Tunda | Rp150.000 × 3, cicilan 1 terpotong; tunda disetujui: cicilan 2 dan 3 pindah satu slip; versi lama Diganti; jumlah Terjadwal tetap Rp100.000; sisa dibawa tidak bergeser |
| U87 | Ubah jadwal | Sisa Terjadwal Rp250.000 × 2 cicilan diubah menjadi 3: Rp83.333, Rp83.333, Rp83.334. Kasbon biasa 4 kali: ditolak; Kasbon Khusus 12 kali: diterima, 13: ditolak |
| U88 | Pelunasan sebagian | Dibawa Rp25.000 + cicilan Rp75.000 + Rp75.000; dilunasi Rp100.000: dibawa lunas, cicilan pertama Rp0 (Diganti), kedua tetap Rp75.000; uang masuk Rp100.000 bukan pendapatan |
| U89 | Pelunasan melebihi sisa | Sisa Rp75.000, dikirim Rp80.000: ditolak; nominal dari layar diperiksa terhadap sisa hasil hitungan server |
| U90 | Hapus utang | Sisa Rp150.000 dihapus Rp50.000: tidak ada baris Buku Kas; satu biaya Rp50.000; cicilan terdekat berkurang |
| U91 | Batal pelunasan | Pelunasan U88 dibatalkan sesudah cicilan kedua terpotong: uang masuk dibatalkan; Rp100.000 menjadi satu cicilan di slip utama terbuka berikutnya; kasbon Berjalan |
| U92 | Slip terakhir | Sisa dua kasbon Rp200.000 (KB-1 Rp120.000, KB-2 Rp80.000), pendapatan sesudah kelompok (a)–(c) Rp150.000: KB-1 terpotong Rp120.000, KB-2 Rp30.000; Piutang Lain kasbon Rp50.000; KB-1 Lunas, KB-2 Dialihkan |
| U93 | Pindah slip utama | Rina sisa 2 × Rp75.000 bulanan, pindah mingguan Kamis 26 November: cicilan di minggu 27 November – 3 Desember dan 4–10 Desember; nominal tetap; terpakai Dana bulanan turun Rp150.000, Dana mingguan naik Rp150.000 mulai 26 November |
| U94 | Dana melebihi | Dana mingguan Rp950.000 + pindahan Rp150.000 = Rp1.100.000: tersimpan tanpa ditolak; pengajuan baru Rp50.000 di dana mingguan ditolak dengan kalimat dana |
| U95 | Kasbon Khusus | Rp2.000.000 × 10: Rp200.000 tiap slip; tidak mengubah terpakai orang dan dana; nominal Rp2.005.000 ditolak (kelipatan) |
| U96 | Bawaan | Bawaan Rp300.000 × 3: Rp100.000 di tiga slip utama pertama; tanpa penyerahan dan tanpa Buku Kas; ikut di terpakai |

**Waktu**

| No | Tes | Contoh |
|---|---|---|
| W1 | Tanggal ritase = tanggal trip | Trip berangkat Kamis 23.00, Selesai Jumat 01.30: tanggal Kamis, minggu upah yang berakhir Kamis itu |
| W2 | Masuk minggu berikutnya | Sama dengan W1, slip minggu itu sudah Ditutup Jumat 08.00, trip baru Selesai Jumat 09.00: baris masuk slip minggu berikutnya, keterangan "tanggal asal Kamis 12 November" |
| W3 | Jarak berlaku | Tarif naik disimpan Senin 10.00: paling cepat Selasa. Ada angka turun: paling cepat Senin berikutnya. Pasangan baru: Senin itu juga |
| W4 | Tidak mundur | Berlaku dari kemarin ditolak server (kecuali tidak ada; pembetulan tidak mengubah tanggal) |
| W5 | Tarif berlaku pukul 00.00 jam server | Tarif berlaku Jumat; trip yang tanggalnya Jumat memakai tarif baru, trip Kamis memakai tarif lama |
| W6 | Status hari dibaca pada tanggal ritase | Libur Rina Sabtu; ia diubah menjadi pengganti Senin sesudah trip: penilaian ulang memakai status Sabtu yang baru |
| W7 | Jendela tutup | Minggu berakhir Kamis 5 November: Tutup ditolak server Jumat 6 November 09.59, diterima 10.00 |
| W8 | Pengingat tutup | Jumat 6 November 15.00 ada slip Perkiraan: satu pengingat; habis sebelum 15.00: tidak ada pengingat |
| W9 | Jatuh bayar | Slip ditutup Jumat 6 November: jatuh bayar Sabtu 7 November; ditutup Senin 9 November (tertahan): jatuh bayar Senin 9 November |
| W10 | Masa keberatan | Ditutup Jumat 6 November 11.00: keberatan diterima sampai Senin 9 November 23.59 |
| W11 | Denda 7 hari | Hari ini Kamis 12 November: tanggal kejadian 5 November diterima, 4 November ditolak, 13 November ditolak |
| W12 | Denda ke slip menurut tanggal kejadian | Kejadian Kamis 5 November disahkan Jumat 6 November 09.00 (slip belum ditutup): masuk minggu 30 Okt – 5 Nov; disahkan 11.00 sesudah slip ditutup: minggu 6 – 12 November |
| W13 | Keberatan denda 3 hari | Diberi tahu Selasa 10 November 14.00: diterima sampai Jumat 13 November 23.59; Sabtu 14 November 00.00 ditolak (sama dengan GAJ W20) |
| W14 | Slip di luar slip utama lahir | Rina tanpa ritase minggu itu: tidak ada slip; ritase Rabu lahir: slip lahir saat itu |
| W15 | Mundur 3 hari | Hari ini Kamis 12 November: tanggal kerja 9 November langsung Berlaku; 8 November menjadi Menunggu persetujuan; 13 November ditolak |
| W16 | Tanggal dari server | Jam HP dimajukan sehari: tanggal kerja bawaan dan batas mundur tetap menurut server |
| W17 | Peserta aktif pada tanggal kerja | Orang yang hari terakhirnya 10 November: bisa dipilih untuk tanggal kerja 9 November, ditolak untuk 11 November. Orang bergabung 12 November: ditolak untuk 11 November |
| W18 | Berat baru untuk laporan sesudahnya | Berat diubah 10.00; laporan yang tersimpan 09.55 memakai berat lama, yang tersimpan 10.05 memakai berat baru |
| W19 | Laporan serupa | Tanggal kerja, supplier, dan total kg sama dengan laporan Berlaku: minta konfirmasi. Beda 1 kg, atau laporan pembandingnya Ditolak: tidak |
| W20 | Periode menurut tanggal kerja | Tanggal kerja 25 November dibuat 27 November: baris Buku Upah di periode 26 Oktober – 25 November |
| W21 | Jarak tarif | Tarif naik disimpan Senin: paling cepat berlaku Selasa. Turun: paling cepat Senin berikutnya. Berlaku kemarin: ditolak |
| W22 | Tanda Perlu dilihat dibaca saat Berlaku | Andi sakit pada tanggal kerja: satu tanda saat laporan Berlaku. Izin sakitnya dibatalkan esok hari: tanda tidak berubah sendiri, ditutup HR |
| W23 | Tanggal uang | Hari ini Kamis 12 November. Tanggal kerja 10 November: tanggal uang 10, 11, 12 diterima; 9 November ditolak (sebelum tanggal kerja); 13 November ditolak. Tanggal kerja 2 November: 5 November diterima tanpa alasan; 4 November meminta alasan |
| W24 | Jatuh bayar dan pengingat | Laporan Berlaku Selasa 3 November 15.00: kelompok "Hari ini". Rabu 07.00 masih belum dibayar: satu pengingat ke Finance, Pemilik, GM, kelompok "Lewat 1 hari". Dibayar Selasa: tidak ada pengingat |
| W25 | Tanpa batas umur | Laporan Berlaku 70 hari lalu tetap tampil di tab Belum dibayar tanpa memilih periode |
| W26 | Batas 30 hari | Lebih bayar lahir 5 November, masih bersisa: 5 Desember belum ditandai; 6 Desember 07.00 ditandai, sekali |
| W27 | Masa belum terima | Diberi tahu dibayar Selasa 3 November 16.00: tombol ada sampai Jumat 6 November 23.59; Sabtu 00.00 ditolak server |
| W28 | Koreksi tanggal kerja | Laporan dibuat 12 November: Kepala Gudang mengoreksi tanggal kerja ke 9 November diterima; ke 8 November ditolak (hanya Pemilik, GM); ke 13 November ditolak |
| W29 | Tarif saat koreksi | Tarif Rp25 berlaku 16 November. Laporan tanggal kerja 15 November dikoreksi 20 November: tetap Rp20. Tanggal kerjanya dikoreksi menjadi 16 November: Rp25 |
| W30 | Periode dan tanggal uang | Susulan untuk laporan tanggal kerja 25 November dibayar 3 Desember: baris Buku Upah tetap di periode 26 Oktober – 25 November; baris Buku Kas bertanggal 3 Desember |
| W31 | Masa kerja 6 bulan | Bergabung 20 April 2026: 19 Oktober ditolak, 20 Oktober diterima. Bergabung 31 Agustus 2026: 27 Februari 2027 ditolak, 28 Februari diterima |
| W32 | Tanda 2 hari | Diajukan Senin 2 November 10.00: Rabu 4 November 09.59 belum bertanda; 10.00 lebih bertanda "Lewat 2 hari" di perlu perhatian Finance, Pemilik, GM. Diputuskan Selasa: tidak pernah bertanda |
| W33 | Tanggal uang | Disetujui 3 November; hari ini Kamis 12 November: tanggal uang 5 s.d. 12 diterima tanpa alasan; 3 dan 4 November meminta alasan; 2 November ditolak (sebelum disetujui); 13 November ditolak |
| W34 | Pengingat belum diberikan | Disetujui Selasa 3 November 15.00: Rabu 07.00 belum diberikan, satu pengingat ke Finance, Pemilik, GM. Diberikan Selasa: tidak ada pengingat |
| W35 | Masa belum terima | Diberi tahu diberikan Rabu 4 November 09.00: tombol ada sampai Sabtu 7 November 23.59; Minggu 00.00 ditolak server |
| W36 | Dana menurut slip utama hari mengajukan | Rina berslip utama bulanan sampai 25 November, mingguan mulai 26 November: pengajuan 24 November memakai Dana bulanan, pengajuan 26 November memakai Dana mingguan |
| W37 | Pengaturan bertanggal | Batas menjadi Rp300.000 berlaku 1 Desember: pengajuan Rp300.000 tanggal 30 November ditolak, 1 Desember diterima |
| W38 | Hari kalender | Diajukan Sabtu 10.00, Finance libur Minggu: Senin 10.00 tetap bertanda "Lewat 2 hari", dengan keterangan Finance libur |
| W39 | Cicilan pertama menurut tanggal uang | Tanggal uang Rabu 4 November: minggu 30 Oktober – 5 November. Tanggal uang Kamis 5 November dicatat Jumat 6 November 11.00 sesudah slip itu Ditutup: minggu 6–12 November. Bulanan, tanggal uang 25 November: slip 26 Oktober – 25 November |
| W40 | Tunda gugur | Diminta Kamis, slip ditutup Jumat 10.30 sebelum diputuskan: status Gugur, cicilan terpotong, jatah 0 terpakai; disetujui Jumat 10.29 sebelum tutup: cicilan bergeser |
| W41 | Tanggal uang pelunasan | Kasbon diberikan 3 November, hari ini 12 November: tanggal 5 s.d. 12 tanpa alasan; 3 dan 4 dengan alasan; 2 ditolak; 13 ditolak |
| W42 | Pindah slip utama | Rina bulanan → mingguan mulai Kamis 26 November: cicilan di slip 26 Oktober – 25 November tetap; cicilan 26 November – 25 Desember pindah; slip mulai baru = minggu yang dimulai Jumat 27 November. Eko mingguan → bulanan mulai Sabtu 26 Desember: cicilan minggu 18–24 Desember tetap; cicilan minggu 25–31 Desember (berakhir sesudah tanggal pindah) pindah ke slip 26 Desember – 25 Januari |
| W43 | Berhenti | Tanggal berhenti 10 November dicatat 1 November: pengajuan 2 November ditolak; serah uang 10 November diterima, 11 November ditolak; ubah jadwal ke slip sesudah slip terakhir ditolak |
| W44 | Ubah jadwal paling jauh | Slip terbuka terdekat November: mulai Februari (3 slip sesudahnya) diterima, Maret ditolak |

**Hak akses**

| No | Tes | Contoh |
|---|---|---|
| H1 | Kepala Gudang tidak mengubah tarif | Pintu "buat tarif baru" dipanggil Kepala Gudang: ditolak server; tombol tidak tampil |
| H2 | Tarif tidak bisa diberikan | Pemilik mencoba memberi hak "buat tarif baru" ke HR lewat Hak Akses Jabatan: pilihan tidak ada |
| H3 | Upah per orang tertutup | Finance dan Kepala Gudang membuka DRV-L05: ditolak; HR membuka: tampil tanpa jabatan bertanda |
| H4 | Driver hanya dirinya | Dedi membaca baris upah Eko lewat pintu server: ditolak |
| H5 | Pembetulan hanya Pemilik dan GM | HR memanggil "betulkan salah ketik tarif": ditolak |
| H6 | Bayar slip mingguan hanya Pemilik dan GM | HR dan Finance memanggil pintu bayar: ditolak; hak itu tidak ada di pilihan Hak Akses Jabatan |
| H7 | Finance tanpa slip per orang | Finance membuka slip mingguan Dedi: ditolak; Ringkasan minggu tanpa nama dan Daftar Transfer: tampil |
| H8 | Kepala Gudang hanya mengajukan | Kepala Gudang memanggil "sahkan denda": ditolak; melihat denda yang ia ajukan saja, tanpa slip orangnya |
| H9 | Tidak ada denda untuk diri sendiri | Kepala Gudang mengajukan denda untuk dirinya: ditolak; Pemilik mengesahkan usulan atas dirinya: tidak mungkin (jabatan Pemilik dan GM tidak bisa didenda) |
| H10 | Orang hanya melihat dendanya sendiri | Eko membaca denda Dedi lewat pintu server: ditolak |
| H11 | Usulan belum disahkan tidak tampil ke orangnya | Eko membuka Pendapatan Saya saat usulan dendanya menunggu: tidak tampil |
| H12 | Hanya Kepala Gudang yang membuat | Finance, HR, dan driver memanggil pintu "buat Laporan Bongkaran": ditolak; tombol tidak tampil |
| H13 | Rincian untuk yang mencatat dan membayar | Kepala Gudang dan Finance membuka DRV-L13: peserta dan bagiannya tampil. HR dan karyawan lain: ditolak |
| H14 | Peserta hanya bagiannya | Andi membaca bagian Budi lewat pintu server: ditolak; di Pendapatan Saya hanya bagiannya dan jumlah peserta |
| H15 | Tarif bongkaran hanya Pemilik dan GM | Kepala Gudang dan Finance memanggil "ubah tarif bongkaran": ditolak; hak itu tidak ada di pilihan Hak Akses Jabatan |
| H16 | Laporan terlambat | Kepala Gudang mengirim tanggal kerja 6 hari lalu dengan status Berlaku: server menyimpannya Menunggu persetujuan. GM yang tercantum sebagai peserta mencoba menyetujui: ditolak |
| H17 | Berat dan Barang lain | Finance memanggil "ubah berat per satuan": ditolak. Kepala Gudang memanggil "pasangkan Barang lain": ditolak |
| H18 | HR tanpa nominal | HR membuka tanda Perlu dilihat peserta bongkaran: nama, tanggal, status hari tampil; bagian dan total upah tidak ikut terkirim dari server |
| H19 | Pekerja lepas | Kepala Gudang menambah pekerja lepas dari laporan: diterima; nomor HP kembar: ditolak; pekerja lepas tidak punya akun untuk masuk |
| H20 | Hanya Finance, Pemilik, GM membayar | Kepala Gudang dan HR memanggil pintu bayar bongkaran: ditolak; tombol tidak tampil |
| H21 | Pembayar bukan peserta atau pembuat | Sari (Finance) tercantum sebagai peserta: pintu bayar menolak. GM yang membuat laporan membayarnya: diterima, bertanda, para pemilik diberi tahu |
| H22 | Koreksi sesudah dibayar | Kepala Gudang memanggil koreksi atau batal atas laporan Dibayar: ditolak; atas laporan Berlaku: diterima |
| H23 | Batas keras | Finance memanggil "batal bayar bongkaran" atau "hapus lebih bayar": ditolak; keduanya tidak ada di pilihan Hak Akses Jabatan |
| H24 | Terima pengembalian | Finance: diterima. Kepala Gudang: ditolak |
| H25 | Peserta hanya miliknya | Andi membaca rincian pembayaran Budi lewat pintu server: ditolak. Andi melapor "belum terima" atas laporan yang tidak ia ikuti: ditolak |
| H26 | Bongkaran per Orang | HR membuka DRV-L22: ditolak. Kepala Gudang: tampil, dan nama tempat uang tidak ikut terkirim dari server |
| H27 | Buku Kas tidak diketik | Finance mengetik uang keluar berkejadian "Upah bongkaran": ditolak server Keuangan |
| H28 | Hanya untuk diri sendiri | Dedi mengirim pengajuan dengan "untuk siapa" Eko lewat pintu server: ditolak (atau tersimpan atas nama Dedi; isian nama diabaikan) |
| H29 | Atas nama bukan untuk diri sendiri | HR memilih dirinya di DRV-L25: tidak bisa; lewat pintu server: ditolak. HR mengajukan miliknya lewat jalan biasa: diterima |
| H30 | Finance tidak memutuskan | Finance memanggil "setujui kasbon" atau "tolak kasbon": ditolak; hak itu tidak ada di pilihan Hak Akses Jabatan |
| H31 | Tidak menyetujui milik sendiri | GM menyetujui kasbon GM: ditolak; Owner menyetujuinya: diterima |
| H32 | Finance bukan untuk miliknya | Sari memeriksa atau menyerahkan uang kasbon Sari: ditolak. GM menyerahkan uang kasbon GM yang disetujui Owner: diterima, bertanda, para pemilik diberi tahu |
| H33 | Yang tidak dikirim ke karyawan | Dedi membuka kasbonnya: angka batas, sisa dana, usulan dan catatan Finance, dan nama tempat uang tidak ada di jawaban server |
| H34 | Finance tanpa gaji | Finance membuka DRV-L27: perkiraan bersih slip tidak ikut terkirim; Pemilik dan GM: tampil |
| H35 | Hanya miliknya | Dedi membaca kasbon Eko lewat pintu server: ditolak. Kepala Gudang membuka DRV-L26: ditolak |
| H36 | HR hanya melihat dan mengisikan | HR memanggil "periksa kasbon" atau "serahkan uang kasbon": ditolak; rincian yang ia terima tanpa usulan Finance dan tempat uang |
| H37 | Batas keras | Finance memanggil "batalkan kasbon" atau "batal serah uang kasbon": ditolak; keduanya tidak ada di pilihan Hak Akses Jabatan |
| H38 | Buku Kas tidak diketik | Finance mengetik uang keluar berkejadian "Kasbon diberikan": ditolak server Keuangan |
| H39 | Pekerja lepas | HR mengisikan kasbon untuk orang berstatus Freelance: ditolak |
| H40 | Serah uang tertahan | Finance menyerahkan uang kasbon yang sedang "Diminta dibatalkan": ditolak server |
| H41 | Tunda hanya miliknya | Dedi meminta tunda kasbon Eko lewat pintu server: ditolak; HR atas nama Eko: diterima |
| H42 | Tidak memutuskan milik sendiri | GM menyetujui tunda, mengubah jadwal, atau menghapus utang kasbon GM: ditolak; Owner: diterima |
| H43 | Batas keras | Pemilik mencoba memberi hak "hapus utang kasbon", "ubah jadwal cicilan", "putuskan tunda", "buat Kasbon Khusus", atau "batalkan pelunasan" ke Finance lewat Hak Akses Jabatan: pilihan tidak ada |
| H44 | Penerima pelunasan | Sari (Finance) mencatat pelunasan kasbon Sari: ditolak. GM mencatat pelunasan kasbon GM: diterima, bertanda, para pemilik diberi tahu |
| H45 | Kasbon Khusus untuk diri sendiri | GM membuat Kasbon Khusus untuk GM: ditolak; Owner membuatnya: diterima |
| H46 | Yang tidak dikirim | Finance dan HR membuka DRV-L38: sisa Dana Kasbon tidak ada di jawaban server; HR tanpa tempat uang. Karyawan membuka kasbonnya: tanpa batas dan sisa dana |
| H47 | Kepala Gudang dan karyawan | Kepala Gudang membuka DRV-L38 atau mencatat pelunasan: ditolak |

---

## 13. Pertanyaan dan jawaban

### 4G-1 (diajukan 14 Oktober 2026; jawaban pemilik 14 Oktober 2026: **"ok"**, dibaca setuju saran untuk U1 s.d. U5)

Diajukan di percakapan dengan maksud, contoh, dan saran (KER-13, 14). Spec
di atas ditulis memakai saran.

- **U1.** Daftar Jenis Upah hanya untuk dibaca; jenis baru lewat
  pembangunan sistem. Saran: ya.
- **U2.** Status hari staf bergaji bulanan berubah sesudah ritasenya
  dinilai: dinilai ulang otomatis; sesudah slip mingguan ditutup, selisih
  plus masuk slip mingguan berikutnya dan selisih minus dipotong di slip
  utamanya. Saran: ya.
- **U3.** Tarif pertama sebuah pasangan baru boleh berlaku hari itu juga
  (pengecualian jarak pengumuman PRI-35). Saran: ya.
- **U4.** Salah ketik tarif boleh dibetulkan Pemilik atau GM selama belum
  ada slip yang dibayar dengan angka itu; ritasenya dinilai ulang. Saran: ya.
- **U5.** Ritase staf bergaji bulanan di hari izin, sakit, cuti, atau alpha
  ditandai "Perlu dilihat" untuk HR, tanpa akibat uang dan tanpa menahan
  slip. Saran: ya.

Bacaan Claude yang tidak ditanyakan karena mengikuti aturan yang ada:
perubahan tarif tidak berlaku mundur dan lewat Papan dengan jarak 1 atau 7
hari (PRI-29, 35); tanggal ritase = tanggal trip (LOG-35, DRV-09); Siap
Kirim memeriksa juga pasangan tugas belanja, ritase tangan ditolak tanpa
tarif (perincian LOG-21, 36, DRV-12); jabatan yang tidak diabsen (GM)
dianggap hari kerja sehingga ritasenya Rp0 (DRV-16, KAR-67); Kepala Gudang
melihat tarif tetapi tidak upah per orang (DRV-82, PRI-24); koreksi minus
diambil dari slip utama karena semua potongan hanya dari slip utama
(DRV-04); dua sebab Rp0 memakai keterangan hari; nomor DRV-84 ganda
dirapikan: paragraf pengaturan bagian 3.16 menjadi **DRV-85** (DRV-84 tetap
aturan Buku Upah karena itu yang dirujuk spec Gaji dan Logistik).

### 4G-2 (diajukan 14 Oktober 2026; jawaban pemilik 14 Oktober 2026: **"ok"**, dibaca setuju saran untuk S1 s.d. S4)

Diajukan di percakapan dengan maksud, contoh, dan saran (KER-13, 14). Spec
bagian 3.2 ditulis memakai saran.

- **S1.** Nominal denda "tidak taat administrasi" Rp10.000 per kejadian,
  tetap, tanpa tambahan bertingkat. Saran: ya.
- **S2.** Driver dan kenek boleh mengajukan keberatan atas denda dalam 3
  hari, sama seperti Potongan Lain; denda tetap berjalan selama menunggu.
  Saran: ya.
- **S3.** Denda hanya bisa diajukan paling lama 7 hari sesudah kejadian.
  Saran: ya.
- **S4.** Tombol Tutup slip mingguan aktif Jumat 10.00, pengingat mulai
  Jumat 15.00, dibayar Sabtu. Saran: ya.

Bacaan Claude yang tidak ditanyakan karena mengikuti aturan yang ada: slip
mingguan memakai mesin slip 4E-5 tanpa layar kedua (DRV-22, keputusan 3A);
denda diajukan Kepala Gudang dan disahkan Pemilik/GM, oleh Pemilik/GM
langsung berlaku (DRV-29, sama dengan Potongan Lain GAJ-80); nominal tidak
bisa diketik (DRV-29); jenis baru atau nominal naik lewat Papan 7 hari
(PRI-35: merugikan karyawan); kurang setoran dan kembalian bensin bukan
denda melainkan Potongan Lain (LOG-129, 4F-5c); denda staf bulanan dari
slip bulanannya (DRV-30); slip mingguan utama lahir walau tanpa ritase supaya
cicilan tampil (DRV-24); penahan khas hanya Belum bertarif (DRV-92);
Penilai ulang dijalankan sebelum tutup (DRV-88); kartu "Upah Minggu Ini" di
Beranda sebagai jalan pintas ke slip (DRV-28; tanpa hitungan kedua).

### 4G-3a (diajukan 14 Oktober 2026; jawaban pemilik 14 Oktober 2026: **"ok"**, dibaca setuju saran untuk L1 s.d. L7)

Diajukan di percakapan dengan maksud, contoh, dan saran (KER-13, 14). Spec
bagian 3.3 ditulis memakai saran.

- **L1.** Laporan Bongkaran langsung berlaku begitu disimpan Kepala Gudang,
  tanpa pengesahan terpisah; Finance memeriksa rinciannya saat membayar.
  Saran: ya.
- **L2.** Kepala Gudang boleh mencantumkan dirinya sebagai peserta;
  laporannya bertanda "pembuat ikut jadi peserta". Saran: ya.
- **L3.** Foto surat jalan supplier wajib di setiap laporan; kalau supplier
  tidak memberi surat jalan, diganti foto barang dan alasan. Saran: ya.
- **L4.** Bongkaran yang lebih dari 3 hari lalu tetap diisi Kepala Gudang,
  tetapi menunggu persetujuan Pemilik atau GM sebelum ada upah dan bisa
  dibayar. Saran: ya.
- **L5.** Mengubah berat per satuan wajib alasan; perubahan lebih dari 10%
  tampil di daftar "Berat berubah" untuk Pemilik dan GM, tanpa menahan
  laporan. Saran: ya.
- **L6.** Pilihan purchase order di Laporan Bongkaran muncul sendiri saat
  sambungan PO di Data Kasir dinyalakan GM atau Owner; tanggalnya tidak
  ditetapkan sekarang (menutup butir terbuka 12). Saran: ya.
- **L7.** Peserta yang hari itu tercatat izin, sakit, cuti, atau alpha tetap
  dapat bagian, dan ditandai "Perlu dilihat" untuk HR tanpa nominal.
  Saran: ya.

Bacaan Claude yang tidak ditanyakan karena mengikuti aturan yang ada: kg dan
upah dihitung satu fungsi server, layar tidak mengirim angkanya (DRV-35,
WAJ-04); berat sampai 3 angka di belakang koma dan jumlah boleh pecahan
(data lama memuat kg pecahan); upah dibulatkan setengah ke atas dan sisa
menurut abjad nama lengkap (DRV-35, 43); tarif bongkaran rupiah bulat, lewat
Papan dengan jarak 1 atau 7 hari, tidak mundur (DRV-42, PRI-28, 29, 35);
Barang lain hanya muncul sesudah pencarian kosong, dan memasangkannya tidak
mengubah upah (DRV-34); isian Total kg hilang sendiri begitu daftar produk
ada (DRV-38); peserta harus aktif pada tanggal kerja dan tidak dobel
(DRV-44); orang datang separuh jalan diselesaikan dengan dua laporan
(DRV-43); HR tidak melihat rincian bongkaran (DRV-82); peserta melihat
bagiannya di Pendapatan Saya (DRV-53, GAJ-L39); 25 entri bongkaran lama
tidak dibawa (SIS-25). Butir terbuka 10 (bentuk file export produk) tidak
ditanyakan: spec hanya memakai kode, nama, dan satuan (DRV-38).

### 4G-3b (diajukan 14 Oktober 2026; jawaban pemilik 14 Oktober 2026: **"ok"**, dibaca setuju saran untuk B1 s.d. B6)

Diajukan di percakapan dengan maksud, contoh, dan saran (KER-13, 14). Spec
bagian 3.4 ditulis memakai saran.

- **B1.** Saat menandai dibayar, tanggal uang boleh dipilih mundur sampai 7
  hari (tidak sebelum tanggal kerja), sama seperti pembayaran slip (GAJ-99).
  Ini melapisi kalimat "tanggal bayar dari server" di DRV-47; jam catat tetap
  dari server. Saran: ya.
- **B2.** Pembayar wajib mencatat uang diserahkan kepada siapa (langsung ke
  tiap peserta, atau dititipkan ke satu nama), dan peserta punya tombol
  "Uang belum saya terima" selama 3 hari, diputuskan Pemilik atau GM.
  Saran: ya.
- **B3.** Orang yang menjadi peserta atau pembuat laporan tidak boleh
  membayar laporan itu; Pemilik dan GM tetap boleh, tercatat dan
  diberitahukan ke para pemilik. Saran: ya.
- **B4.** Finance yang ragu boleh menekan "Tanyakan dulu" dengan
  pertanyaannya; laporan bertanda, pembuat menjawab atau mengoreksi; bukan
  penahan untuk Pemilik dan GM. Saran: ya.
- **B5.** Lebih bayar dipotong dari bagian bongkaran berikutnya orang itu
  sampai habis, walaupun bagiannya hari itu menjadi Rp0 (bukan dibatasi
  separuh). Saran: ya.
- **B6.** Kepala Gudang boleh membatalkan (bukan hanya mengoreksi) laporan
  yang belum dibayar, dengan alasan; sesudah dibayar hanya Pemilik atau GM.
  Saran: ya.

Bacaan Claude yang tidak ditanyakan karena mengikuti aturan yang ada:
dibayar Finance, Pemilik, atau GM dalam satu langkah, sekali dan penuh, satu
baris Buku Kas per laporan dan per susulan (DRV-47, KEU-25); beberapa
laporan boleh dibayar sekaligus dari satu tempat uang (sama dengan slip,
KEU-24); kasbon dan denda tidak dipotong (DRV-48); tidak bisa diketik di
Buku Kas, Catatan Cepat dipasangkan (DRV-50, KEU-18, 23); cabang penanggung
dari salinan di laporan (DRV-51); belum dibayar lewat harinya diingatkan
mulai 07.00 esoknya dan daftar tanpa batas umur (DRV-52, sejalan GAJ-104);
koreksi sebelum dibayar oleh Kepala Gudang dan sesudahnya hanya Pemilik atau
GM (DRV-49); kurang bayar disusulkan tunai, lebih bayar diperhitungkan,
lewat 30 hari diputuskan pemilik: tagih tunai atau hapus (DRV-49); lebih
bayar tidak diambil dari slip (DRV-48); pembayaran pertama tidak diubah
oleh koreksi, sehingga bulan Keuangan yang tertutup tidak tersentuh
(KEU-112); batal bayar untuk salah catat hanya Pemilik atau GM (sejalan
GAJ-103); "Dikoreksi" dicatat sebagai tanda dan versi, bukan status; laporan
per orang untuk Pemilik, GM, Finance, dan Kepala Gudang, bukan HR (DRV-53,
82); peserta melihat semuanya di Pendapatan Saya tanpa layar baru (DRV-53).

### 4G-4a (diajukan 14 Oktober 2026; jawaban pemilik 14 Oktober 2026: **"ok"**, dibaca setuju saran untuk K1 s.d. K7)

Diajukan di percakapan dengan maksud, contoh, dan saran (KER-13, 14). Spec
bagian 3.5 ditulis memakai saran.

- **K1.** Nominal kasbon kelipatan Rp10.000 dan paling sedikit Rp50.000.
  Saran: ya.
- **K2.** Pemilik atau GM boleh memutuskan kasbon tanpa menunggu pemeriksaan
  Finance (misalnya Finance libur); kasbonnya bertanda. Saran: ya.
- **K3.** Finance tidak memeriksa dan tidak menyerahkan uang untuk kasbonnya
  sendiri; Pemilik dan GM tetap boleh menyerahkan untuk dirinya, tercatat
  dan diberitahukan ke para pemilik. Saran: ya.
- **K4.** Tanggal uang saat menyerahkan boleh dipilih mundur sampai 7 hari,
  tidak sebelum tanggal disetujui, sama seperti slip dan bongkaran. Ini
  melapisi kalimat "tanggal dari server" di DRV-63. Saran: ya.
- **K5.** Penyerah mencatat uang diserahkan langsung atau dititipkan lewat
  siapa, dan orangnya punya tombol "Uang belum saya terima" selama 3 hari,
  diputuskan Pemilik atau GM. Saran: ya.
- **K6.** Catatan penyerahan yang salah boleh dibatalkan Pemilik atau GM
  ("Batal serah uang") selama belum ada cicilan yang terpotong; kasbonnya
  kembali "disetujui, belum diberikan". Ini memperjelas DRV-72 ("setelah
  diberikan tidak dibatalkan"): yang dibatalkan catatan penyerahannya, bukan
  kasbonnya. Saran: ya.
- **K7.** "2 hari" dihitung hari kalender; libur Finance tidak menunda
  tanda. Ini berbeda dari KEU-56 (batas waktu Finance dihitung hari kerja
  Finance), karena tandanya juga untuk Pemilik dan GM yang bisa bertindak
  sendiri. Saran: ya.

Bacaan Claude yang tidak ditanyakan karena mengikuti aturan yang ada: satu
jenis pengajuan untuk semua orang (DRV-54); urutan periksa dan ketiga
kalimat penolakan (DRV-55 s.d. 58); 6 bulan dihitung bulan kalender dari
tanggal bergabung (DRV-55, SIS-24); yang dihitung di batas dan dana adalah
nominal diajukan selama menunggu, nominal akhir sesudah disetujui, dan sisa
sesudah diberikan (DRV-56, 57); Kasbon Khusus tidak dihitung (DRV-75); sisa
bawaan sistem lama dihitung (SIS-28); dana mengikuti slip utama pada hari
mengajukan (DRV-04, 57); satu pengajuan menunggu per orang (BER-L06,
kembar); HR dan Admin HR mengisikan atas nama, bukan untuk dirinya (DRV-59,
KAR-77); Finance mengusulkan dan tidak menolak (DRV-61, 82); usulan Finance
tidak tampil ke karyawan (DRV-61); nominal akhir paling banyak sebesar yang
diajukan (DRV-61); tidak ada yang menyetujui kasbonnya sendiri, kasbon GM
diputuskan Owner (DRV-62, PRI-37); cicilan dibagi rata dan sisanya di
cicilan terakhir (DRV-65); satu kasbon cair sekali dengan tempat uang wajib
dan satu baris Buku Kas bukan biaya (DRV-63, KEU-05, 22, 25); Catatan Cepat
dipasangkan, tidak dicatat dua kali (KEU-18); "Kasbon diberikan" tidak bisa
diketik di Buku Kas (KEU-23); pengaju menarik sebelum diputuskan, sesudah
disetujui dibatalkan Pemilik atau GM (DRV-72); tidak ada yang ditolak atau
disetujui otomatis (DRV-64, PRI-37); karyawan tidak melihat angka batas dan
sisa dana (DRV-56, 78); Finance tidak melihat gaji (PRI-24); kasbon menunggu
diberikan tidak masuk Jadwal Bayar (DRV-81). Menarik dan membatalkan sebelum
uang diberikan (DRV-72) ditulis di bagian ini, walau nomornya masuk rentang
4G-4b, supaya tiap langkah 4G-4a punya jalan keluar (WAJ-11).

### 4G-4b (diajukan 14 Oktober 2026; jawaban pemilik 14 Oktober 2026: **"ok"**, dibaca setuju saran untuk C1 s.d. C7)

Diajukan di percakapan dengan maksud, contoh, dan saran (KER-13, 14). Spec
bagian 3.6 ditulis memakai saran.

- **C1.** Tunda menggeser **semua** cicilan yang belum terpotong satu slip.
  Diminta selama slip cicilan terdekat belum ditutup; bila slip itu
  ditutup sebelum diputuskan, permintaannya gugur, cicilan dipotong biasa,
  dan jatah 1 kali tidak terpakai. Permintaan yang menunggu tidak menahan
  slip. Saran: ya.
- **C2.** Pemilik atau GM boleh **mengubah jadwal** cicilan sisa tanpa
  diminta, dengan alasan (jumlah rupiah tetap; kasbon biasa paling banyak 3
  kali sisa, Kasbon Khusus 12; mulai paling jauh 3 slip ke depan). Ini
  jalan kantor, tidak memakai jatah tunda karyawan (pelapis DRV-68).
  Saran: ya.
- **C3.** Pelunasan tunai boleh **sebagian**; mengurangi sisa yang dibawa
  lalu cicilan terdekat; tidak boleh lebih dari sisa; tanggal uang mundur
  7 hari seperti penyerahan; penerima bukan pemilik kasbon itu. Saran: ya.
- **C4.** Hapus utang boleh **seluruh atau sebagian**, dengan urutan yang
  sama dengan pelunasan; tidak untuk kasbonnya sendiri. Saran: ya.
- **C5.** Saat berganti slip utama, **banyak dan nominal cicilan tetap**,
  hanya gajiannya yang disusun ulang mulai slip baru pertama (bulanan ke
  mingguan menjadi lebih cepat lunas; kalau berat, pakai C2). Saran: ya.
- **C6.** Sejak tanggal berhenti dicatat: pengajuan baru ditolak; yang
  menunggu atau belum diberikan ditandai "Akan berhenti" dan diputuskan
  Pemilik atau GM (tidak batal otomatis); serah uang sesudah hari terakhir
  bekerja ditolak. Saran: ya.
- **C7.** Kasbon Khusus: kali potong paling banyak **12**; nominal
  kelipatan Rp10.000 tanpa batas atas; jenis kejadian awal Kecelakaan,
  Sakit, Duka, Lainnya; dibuat langsung tanpa pengajuan, dengan tombol
  "Buat dan serahkan sekarang". Saran: ya.

Bacaan Claude yang tidak ditanyakan karena mengikuti aturan yang ada: sisa
dihitung dari mutasi, tidak disimpan (DRV-67); jadwal dibagi rata, sisa di
cicilan terakhir, cicilan pertama di slip periode tanggal uang (DRV-65,
jawaban 5C.9 butir 7); cicilan hanya dari slip utama dan ditandai saat slip
ditutup, boleh sebagian, sisanya dibawa (DRV-04, 66, GAJ-75); kasbon paling
lama dipotong lebih dulu (GAJ-75 "paling lama lebih dulu"); Lunas lahir
sendiri (DRV-71); tunda 1 kali, disahkan Pemilik atau GM (DRV-68); pelunasan
tunai uang masuk bukan pendapatan, hapus utang menjadi biaya tanpa uang
bergerak (DRV-69, 70, KEU-22, 25); slip terakhir menagih seluruh sisa dan
sisanya menjadi Piutang Lain (DRV-73, GAJ-82, KEU-74); pindah slip utama di
tanggal 26, tidak pernah ditolak walau dana penuh (DRV-06, 74, 5E.1 butir
8); Kasbon Khusus tidak mengurangi dana dan tidak dibuat untuk diri sendiri
(DRV-75); kasbon bawaan tanpa baris Buku Kas, paling banyak 3 kali potong
(SIS-28). Contoh di DRV-L29 (cicilan pertama "minggu 6–12 November") tidak
sesuai DRV-65 dan dibetulkan menjadi 30 Oktober – 5 November (WAJ-10);
aturannya tidak berubah.

---

## 14. Daftar periksa (peta jalan Tahap 4)

### Bagian 4G-1

- [x] Tidak melanggar WAJ-01 s.d. 12 (satu fungsi "nilai ritase" dan satu
      fungsi "tarif", WAJ-04; Buku Upah milik Gaji dan ritase milik
      Logistik hanya ditunjuk, WAJ-03; tanpa nama rute di kode, Rp0 hidup
      di tarif, WAJ-05; tarif bertanggal, tidak mundur, WAJ-07; tidak ada
      yang dihapus; setiap langkah punya jalan keluar, WAJ-11; aturan baru
      diberi jenis, WAJ-12).
- [x] Setiap layar memenuhi TAM-01 s.d. 25 (tarif baru dan pembetulan
      ditahan 3 detik dengan akibat dalam angka; satu layar satu tugas).
- [x] Data memenuhi PRI-01 s.d. 41 (jam server; rupiah bulat; kunci
      "asal + status Berlaku"; mesin berpenjaga dan pemeriksa susulan;
      koreksi susulan ke periode berikutnya, PRI-04).
- [x] Aturan baru bernomor (DRV-86 s.d. 92, bagian 3.17
      `05-gaji-driver-kasbon.md`, disetujui 14 Oktober 2026).
- [x] Kejadian 1 s.d. 29, jalan keluar, tes U1 s.d. U18, W1 s.d. W6, H1
      s.d. H5.
- [x] Tiap layar menyebut ukuran utamanya. Bentuk yang belum ada
      komponennya: tabel pasangan mobil × rute dengan tanda berwarna
      (DRV-L02) dan daftar akibat "lama → baru" per orang (DRV-L04).
- [x] Disetujui pemilik 14 Oktober 2026 (U1 s.d. U5 sesuai saran).

### Bagian 4G-2

- [x] Tidak melanggar WAJ-01 s.d. 12 (satu mesin slip dan satu fungsi
      hitung slip, WAJ-04; slip milik Gaji, ritase milik Logistik hanya
      dibaca, WAJ-03; tidak ada cabang "kalau driver" di kode, WAJ-05;
      nominal denda bertanggal dan lewat Papan, WAJ-07; denda tidak dihapus,
      dibatalkan atau ditiadakan; setiap langkah punya jalan keluar, WAJ-11;
      aturan baru diberi jenis, WAJ-12).
- [x] Setiap layar memenuhi TAM-01 s.d. 25 (ajukan dan sahkan denda ditahan
      3 detik; satu layar satu tugas; kalimat "bukan denda" di langkah 1).
- [x] Data memenuhi PRI-01 s.d. 41 (jam server; rupiah bulat; nominal
      disalin saat lahir; koreksi ke periode berikutnya, PRI-04; mesin
      berpenjaga).
- [x] Aturan baru bernomor (DRV-93 s.d. 100, bagian 3.18
      `05-gaji-driver-kasbon.md`, disetujui 14 Oktober 2026).
- [x] Kejadian 30 s.d. 53, jalan keluar, tes U19 s.d. U28, W7 s.d. W14, H6
      s.d. H11.
- [x] Tiap layar menyebut ukuran utamanya. Bentuk yang belum ada
      komponennya: pendapatan slip dikelompokkan per hari (GAJ-L40 bentuk
      mingguan) dan kartu dua baris "Upah Minggu Ini".
- [x] Disetujui pemilik 14 Oktober 2026 (S1 s.d. S4 sesuai saran).

### Bagian 4G-3a

- [x] Tidak melanggar WAJ-01 s.d. 12 (satu fungsi "hitung bongkaran",
      WAJ-04; supplier milik Keuangan, produk milik kasir, orang milik
      Karyawan hanya ditunjuk, WAJ-03; cabang penanggung dari pengaturan,
      tanpa angka tarif cadangan, WAJ-05; tarif bertanggal dan tidak
      mundur, WAJ-07; laporan tidak dihapus; setiap langkah punya jalan
      keluar, WAJ-11; aturan baru diberi jenis, WAJ-12).
- [x] Setiap layar memenuhi TAM-01 s.d. 25 (lima langkah berurutan; Simpan
      dan Setujui ditahan 3 detik dengan angka; isian tidak hilang saat
      sinyal putus).
- [x] Data memenuhi PRI-01 s.d. 41 (tanggal dari server; rupiah bulat;
      salinan tarif dan berat di laporan; kunci laporan + orang; daftar
      belum dibayar tanpa batas umur, PRI-10, 11).
- [x] Aturan baru bernomor (DRV-101 s.d. 110, bagian 3.19
      `05-gaji-driver-kasbon.md`, disetujui 14 Oktober 2026).
- [x] Kejadian 54 s.d. 80, jalan keluar, tes U29 s.d. U45, W15 s.d. W22,
      H12 s.d. H19.
- [x] Tiap layar menyebut ukuran utamanya. Bentuk yang belum ada
      komponennya: kotak cari barang dengan baris berat dan kg berjalan
      (DRV-L12 langkah 2), pilihan cepat "Sering ikut" (langkah 3), dan
      label tanda kecil di baris daftar (DRV-L11).
- [x] Disetujui pemilik 14 Oktober 2026 (L1 s.d. L7 sesuai saran).

### Bagian 4G-3b

- [x] Tidak melanggar WAJ-01 s.d. 12 (satu fungsi "hitung bongkaran" dan
      satu fungsi "selisih bongkaran", WAJ-04; status bayar dibaca dari
      pembayaran dan Buku Kas milik Keuangan hanya dipanggil, WAJ-03; cabang
      penanggung dari pengaturan, WAJ-05; laporan dan pembayaran tidak
      dihapus; setiap langkah punya jalan keluar, WAJ-11; aturan baru diberi
      jenis, WAJ-12).
- [x] Setiap layar memenuhi TAM-01 s.d. 25 (bayar, koreksi, batal, dan
      hapus ditahan 3 detik dengan akibat dalam angka; satu layar satu
      tugas; pengingat satu jendela per jalur).
- [x] Data memenuhi PRI-01 s.d. 41 (jam catat dari server; rupiah bulat;
      sisa lebih bayar dihitung, tidak disimpan; koreksi sesudah dibayar
      tidak mengubah pembayaran lama, PRI-04; mesin berpenjaga).
- [x] Aturan baru bernomor (DRV-111 s.d. 120, bagian 3.20
      `05-gaji-driver-kasbon.md`, disetujui 14 Oktober 2026).
- [x] Kejadian 81 s.d. 103, jalan keluar, tes U46 s.d. U64, W23 s.d. W30,
      H20 s.d. H27.
- [x] Tiap layar menyebut ukuran utamanya. Bentuk yang belum ada
      komponennya: tabel peserta tiga kolom "bagian, diperhitungkan,
      diterima" (DRV-L17) dan daftar akibat "lama → baru" per orang
      (DRV-L18; sama dengan DRV-L04).
- [x] Disetujui pemilik 14 Oktober 2026 (B1 s.d. B6 sesuai saran).

### Bagian 4G-4a

- [x] Tidak melanggar WAJ-01 s.d. 12 (satu fungsi "periksa kasbon", satu
      fungsi "terpakai", satu fungsi "bagi cicilan", WAJ-04; status
      pengajuan milik Mesin Pengajuan dan Buku Kas milik Keuangan hanya
      dibaca atau dipanggil, WAJ-03; tanpa nama jabatan atau departemen,
      dana mengikuti slip utama, WAJ-05; batas, dana, dan syarat bertanggal
      berlaku, WAJ-07; kasbon tidak dihapus; setiap langkah punya jalan
      keluar, WAJ-11; aturan baru diberi jenis, WAJ-12).
- [x] Setiap layar memenuhi TAM-01 s.d. 25 (kirim, setujui, serahkan,
      batalkan ditahan 3 detik dengan angka; satu layar satu tugas;
      kalimat penolakan terus terang; pengingat satu jendela per jenis).
- [x] Data memenuhi PRI-01 s.d. 41 (jam catat dari server; rupiah bulat;
      sisa dana dan sisa batas dihitung, tidak disimpan; satu penyerahan
      Berlaku per kasbon; mesin berpenjaga).
- [x] Aturan baru bernomor (DRV-121 s.d. 130, bagian 3.21
      `05-gaji-driver-kasbon.md`, disetujui 14 Oktober 2026).
- [x] Kejadian 104 s.d. 136, jalan keluar, tes U65 s.d. U81, W31 s.d. W38,
      H28 s.d. H40.
- [x] Tiap layar menyebut ukuran utamanya. Bentuk yang belum ada
      komponennya: papan angka dengan tombol cepat nominal (DRV-L24) dan
      pasangan angka "diajukan → disetujui" di kartu dan baris daftar
      (DRV-L23, L26).
- [x] Disetujui pemilik 14 Oktober 2026 (K1 s.d. K7 sesuai saran).

### Bagian 4G-4b

- [x] Tidak melanggar WAJ-01 s.d. 12 (satu fungsi "sisa kasbon", "pasang
      jadwal", "cicilan jatuh tempo", "tandai cicilan", WAJ-04; slip,
      `sisa_potongan`, Buku Kas, dan Piutang Lain milik Gaji dan Keuangan
      hanya dipanggil atau dibaca, WAJ-03; tanpa nama jabatan, slip utama
      dari pengaturan jabatan, WAJ-05; pengaturan bertanggal, WAJ-07; contoh
      DRV-L29 dibetulkan, WAJ-10; kasbon, cicilan, dan mutasi tidak dihapus;
      setiap langkah punya jalan keluar, WAJ-11; aturan baru diberi jenis,
      WAJ-12).
- [x] Setiap layar memenuhi TAM-01 s.d. 25 (tunda, pelunasan, hapus, ubah
      jadwal, Kasbon Khusus, dan pembatalan ditahan 3 detik dengan akibat
      dalam angka; satu layar satu tugas).
- [x] Data memenuhi PRI-01 s.d. 41 (jam catat dari server; rupiah bulat;
      sisa dihitung dari mutasi; jadwal berversi, tidak diedit; koreksi
      atas slip tertutup lewat buka kembali, PRI-04; mesin berpenjaga).
- [x] Aturan baru bernomor (DRV-131 s.d. 142, bagian 3.22
      `05-gaji-driver-kasbon.md`, disetujui 14 Oktober 2026).
- [x] Kejadian 137 s.d. 165, jalan keluar, tes U82 s.d. U96, W39 s.d. W44,
      H41 s.d. H47.
- [x] Tiap layar menyebut ukuran utamanya. Bentuk yang belum ada
      komponennya: daftar jadwal cicilan dengan status per gajian dan
      pasangan "lama → baru" (DRV-L23, L28, L32, L36), baris orang yang bisa
      dibuka menjadi daftar kasbonnya (DRV-L38).
- [x] Disetujui pemilik 14 Oktober 2026 (C1 s.d. C7 sesuai saran).
