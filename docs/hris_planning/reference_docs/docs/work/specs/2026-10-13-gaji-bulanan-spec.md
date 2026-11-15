# Spec Siap Bangun: Gaji Bulanan (Tahap 4E)

Tanggal: 13 Oktober 2026
Status per bagian:

| Bagian | Isi | Status |
|---|---|---|
| **4E-1** | Komponen dan Pengaturan Gaji | **Disetujui penuh 13 Oktober 2026** (G1 s.d. G6 sesuai saran, GAJ-62 s.d. 67, 8 layar GAJ-L01 s.d. L08) |
| **4E-2** | Hitungan dari Kehadiran | **Disetujui penuh 13 Oktober 2026** (K1 s.d. K5 sesuai saran, GAJ-68 s.d. 74, 3 layar GAJ-L09 s.d. L11) |
| **4E-3** | Potongan di Luar Kehadiran | **Disetujui penuh 13 Oktober 2026** (P1 s.d. P4 sesuai saran, GAJ-75 s.d. 82, 8 layar GAJ-L12 s.d. L19) |
| **4E-4** | Buku Bonus dan Dua Dana | **Disetujui penuh 13 Oktober 2026** (B1 s.d. B6 sesuai saran, GAJ-83 s.d. 90, 8 layar GAJ-L20 s.d. L27) |
| 4E-5 | Perjalanan Slip. Dipecah tiga (**disetujui pemilik 13 Oktober 2026**): **4E-5a** Tutup Slip (halaman satu periode, slip tertahan, langkah tutup, buka kembali, bentuk slip, slip terakhir); **4E-5b** Bayar (bayar dan batal bayar, Jadwal Bayar, pengingat belum Dibayar, ringkasan Finance, bayar bonus di luar slip); **4E-5c** Sisi Karyawan (Pendapatan Saya, peringatan GAJ-44, keberatan slip, unduh dan cetak, Total Diterima per Orang) | **4E-5a disetujui penuh 13 Oktober 2026** (S1 s.d. S4 sesuai saran, GAJ-91 s.d. 97, 5 layar GAJ-L28 s.d. L32); **4E-5b disetujui penuh 13 Oktober 2026** (Y1 s.d. Y5 sesuai saran, GAJ-98 s.d. 106, 6 layar GAJ-L33 s.d. L38); **4E-5c disetujui penuh 14 Oktober 2026** (C1 s.d. C5 sesuai saran, GAJ-107 s.d. 114, 5 layar GAJ-L39 s.d. L43) |

Pembagian lima bagian **disetujui pemilik 13 Oktober 2026**. Spec ini satu
file untuk seluruh 4E. Tiap bagian **menambah baris** ke tabel di bagian 2, 4
s.d. 13 dan memberi tanda bagiannya di kolom "Bagian". Bagian 3 (rincian
layar) ditulis per sub-bagian.

Bahan 4E-1: GAJ-01 s.d. 09, 23, 57; PRI-19 s.d. 22, 24, 26, 28, 29, 32, 34,
35; DRV-01 s.d. 04, 84 (Buku Upah dan Daftar Jenis Upah); KAR-22, 59, 67, 73,
77, 83; KAR-L21, L27, L31 di `2026-10-13-karyawan-dan-akses-spec.md`;
BER-L40, L41, L23 di `2026-10-13-perlengkapan-bersama-spec.md`;
`2026-10-13-waktu-dan-uang-desain.md` (mesin periode); `2026-10-13-menu-desain.md`;
arsip `../../aturan/arsip/03-gaji-galian.md` bagian 3A.

Bentuk spec mengikuti bagian 0 `2026-10-13-karyawan-dan-akses-spec.md`. Kode
layar memakai awalan **GAJ-L**. Tampilan disusun dari komponen baku
(`../desain/README.md`); tidak digambar.

**Satu mesin slip** (keputusan 3A): slip bulanan dan slip mingguan memakai
mesin yang sama. Spec ini menulis mesinnya secara umum; aturan khas slip
mingguan (ritase, denda driver, jadwal Sabtu) ditulis di 4G.

---

## 1. Batas

**Dikerjakan di 4E-1:** daftar jenis komponen gaji; komponen gaji tiap orang
bertanggal berlaku dan riwayatnya; Gaji Standar; semua angka pengaturan gaji
(GAJ-57) didaftarkan ke kerangka Pengaturan 4B; halaman Aturan Potongan;
mesin periode (bulanan dan minggu upah) dan daftar periode; Buku Upah (data
dan cara melihatnya).

**Tidak dikerjakan di 4E-1:**

| Hal | Di mana |
|---|---|
| Rumus gaji harian, prorata, telat, lembur, tidak hadir, kompensasi libur, denda | 4E-2 (bagian ini hanya menyimpan angkanya) |
| Kehilangan barang (persen kantor, bobot jabatan), minus kas, Potongan Lain, kasbon di slip, urutan potongan | 4E-3 |
| Jenis bonus dan pengaturannya, Buku Bonus, Dana Disiplin, Dana Tidak Hadir | 4E-4 |
| Isi halaman satu periode (slip semua orang, tutup, bayar), Jadwal Bayar, Pendapatan Saya, Total Diterima per Orang | 4E-5 |
| Daftar Jenis Upah, tarif ritase, aturan khas slip mingguan | 4G (DRV-02 s.d. 28) |
| Tanda perlakuan gaji per jabatan (kena telat, dapat lembur, ikut menanggung kehilangan, gaji hanya terlihat Pemilik dan GM, slip utama) | Karyawan, KAR-L31 (modul ini hanya membaca) |
| Kerangka layar ubah pengaturan, Papan Perubahan Aturan | 4B (BER-L40, L41, L23) |
| Antrean promosi Training | Karyawan, KAR-L27 (modul ini hanya menerapkan Gaji Standar setelah disetujui) |

**Dikerjakan di 4E-2:** satu fungsi hitungan kehadiran untuk slip (gaji tetap
dan prorata, gaji harian, telat dan peniadaannya, potongan tidak hadir
bertangga, lembur, kompensasi libur, denda kehadiran), baris denda yang
ditulis saat penjelasan disahkan, koreksi periode lalu dari koreksi susulan
Kehadiran, dan isi kartu Aturan Potongan yang menyangkut kehadiran.

**Tidak dikerjakan di 4E-2:**

| Hal | Di mana |
|---|---|
| Kapan dan bagaimana kejadian lahir (telat, alpha, lupa absen, klaim lembur, izin, sakit, libur, hari tutup), menit dan jam yang dihitung | Kehadiran 4D (modul ini hanya membaca hasilnya) |
| Urutan pengambilan potongan dan sisa potongan (GAJ-52) | 4E-3 |
| Dana Disiplin dan Dana Tidak Hadir (ke mana uang potongan dicatat) | 4E-4 |
| Slip tertahan (GAJ-43), menutup, menyimpan baris slip, keberatan | 4E-5 |
| Denda driver dan kenek, slip mingguan | 4G (orang per ritase tidak punya telat, lembur, alpha, atau denda lupa absen: KEH-99, 123, 81) |

**Dikerjakan di 4E-3:** kehilangan barang (catat, pengesahan, pembagian per
bobot jabatan dan sebanding hari, persen kantor dan bobot), minus kas (baca
selisih kasir dari Keuangan, catat tangan bernama dan tanpa nama), Potongan
Lain dan jadwal cicilannya, keberatan potongan, pembacaan cicilan kasbon,
satu fungsi urutan pengambilan dan sisa potongan, sisa potongan slip
terakhir, dan isi kartu Aturan Potongan untuk bagian ini.

**Tidak dikerjakan di 4E-3:**

| Hal | Di mana |
|---|---|
| Laporan Kasir, selisih kasir dan keberatannya, kelebihan kas sebagai uang masuk | Keuangan 4H (KEU-38 s.d. 55); Gaji hanya membaca |
| Pengajuan, pengesahan, pencairan, penundaan, dan pelunasan kasbon; Dana Kasbon | 4G (DRV-56 s.d. 73); Gaji hanya membaca cicilan jatuh tempo dan menandai terpotong saat tutup |
| Buku Piutang Lain dan penghapusannya | Keuangan 4H (KEU-74); Gaji hanya melahirkan barisnya |
| Langkah menutup slip (menyimpan baris, menandai terpotong, menulis sisa potongan dan piutang) | 4E-5; rumusnya di sini |
| Dana Disiplin dan Dana Tidak Hadir | 4E-4 (membaca "benar-benar terpotong" dari fungsi ini) |
| Urutan potongan slip mingguan | 4G memakai fungsi yang sama; kelompok yang tidak ada di slip mingguan dilewati (DRV-24: denda, Potongan Lain, kasbon) |
| Tanda jabatan "ikut menanggung kehilangan barang" | Karyawan, KAR-L31 (juga dipakai untuk minus kas tanpa nama, GAJ-79) |

**Dikerjakan di 4E-4:** daftar jenis bonus dan pengaturannya, Buku Bonus
(satu pintu tulis untuk semua modul), halaman Persetujuan Bonus, Bonus Bebas,
bonus grooming dari data kasir (GAJ-61), perubahan bonus dari kasir, Dana
Disiplin (saldo, terpesan, tersedia, penolakan pengesahan), Dana Tidak Hadir,
pindah dana, saldo awal dan penyesuaian, bonus orang yang berhenti, dan bonus
di halaman gaji seseorang.

**Tidak dikerjakan di 4E-4:**

| Hal | Di mana |
|---|---|
| Laporan promo (isian karyawan, foto struk, pencocokan kasir), target dan tarif promo | Kinerja 4I (KIN-19 s.d. 26). Di sini hanya tab tempat laporan diperiksa dan baris bonusnya |
| Aturan Bonus Terukur dan mesin penilaiannya, rapor | Kinerja 4I (KIN-13 s.d. 18). Di sini hanya menerima hasilnya |
| Menarik baris ongkir dan pengantar dari kasir, tanda ⚠ foto antar sendiri | Logistik 4F dan Tarik Data Kasir 4C (LOG-76). Di sini hanya pintu tulis dan pengesahannya |
| Pemasangan nama groomer dan pengantar ke orang | Tarik Data Kasir 4C (TDK-L, PRI-41) |
| Langkah menutup slip (menulis mutasi dana, menandai bonus masuk slip) | 4E-5; rumusnya di sini |
| Dana Disiplin di laporan keuangan dan sebagai uang titipan | Keuangan 4H (KEU-90, 100, 115); membaca mutasi dari sini |
| Bonus Kinerja, Ranking Disiplin, Tabungan Loyalitas | Ditunda (GAJ-31, 32, KIN-18) |

**Dikerjakan di 4E-5b:** langkah bayar slip (satu atau banyak sekaligus,
satu tempat uang), tanggal uang, Catatan Cepat "Gaji/Upah" yang dipasangkan
ke slip (sisi Gaji), slip bersih Rp0, batal bayar, Jadwal Bayar dan
pengingat belum Dibayar, Daftar Transfer untuk Finance, Ringkasan per
periode dengan sudut pandang per jabatan dan uraian untuk Keuangan, dan
bayar di luar slip untuk mantan karyawan.

**Tidak dikerjakan di 4E-5b:**

| Hal | Di mana |
|---|---|
| Buku Kas, tempat uang dan saldonya, layar memasangkan Catatan Cepat, pembatalan baris di Keuangan, tutup bulan, utang toko ke Gudang, Perkiraan Kas, laba | Keuangan 4H (KEU-01 s.d. 33, 69, 101, 108, 109, 112). Gaji memanggil fungsinya dan mengirim uraian |
| Bayar Laporan Bongkaran, jendela dan hari bayar slip mingguan | 4G (DRV-22, 47). Jadwal Bayar hanya menampilkan barisnya |
| Pendapatan Saya, keberatan slip, status bayar di portal, Total Diterima per Orang | 4E-5c |
| Buku Piutang Lain dan cicilannya | Keuangan 4H (KEU-74); di sini hanya pemotongan tagihan luar slip ke piutang |

**Dikerjakan di 4E-5c:** Pendapatan Saya (satu halaman per periode untuk
semua jalur upah), slip dari sisi karyawan dan status bayarnya, peringatan
"gaji bisa mundur" (GAJ-44), keberatan slip (GAJ-42, 60) termasuk "uang
belum saya terima", pembetulan gaji periode lalu atas keberatan, unduh slip
dari sisi karyawan, akses terbatas mantan karyawan ke uangnya sendiri, dan
laporan Total Diterima per Orang (DRV-80).

**Tidak dikerjakan di 4E-5c:**

| Hal | Di mana |
|---|---|
| Isi khas slip mingguan (ritase, upah belanja, denda driver dan kenek) | 4G (DRV-20 s.d. 28); Pendapatan Saya hanya menampilkannya dengan bentuk slip yang sama |
| Laporan Bongkaran dan pembayarannya | 4G (DRV-40 s.d. 49); di sini hanya baris upah dan status bayarnya |
| Kasbon Saya | 4G (menu sendiri, DRV-56 s.d. 73) |
| Kehadiran Saya, Perlu Dijelaskan, Isi Penjelasan | Kehadiran 4D (KEH-L17, L35, L36); peringatan di sini hanya menunjuk ke sana |
| Kerangka Pengajuan Saya, Persetujuan, Ajukan ulang | 4B (BER-L04 s.d. L07, L20, L21); di sini hanya isi khas jenis "Keberatan slip" |
| Cara akun masuk, keluar, dan nonaktif | Karyawan 4A (KAR-07, 34, 69); di sini hanya fungsi "masih punya urusan uang" yang dibaca saat masuk |
| Perkiraan Bonus Terukur dan rapor | Kinerja 4I (KIN-09, 16) |

---

## 2. Daftar layar

Ukuran utama: **HP** = terutama handphone, **PC** = terutama PC.

| Kode | Layar | Letak di menu | Dipakai | Ukuran utama | Bagian |
|---|---|---|---|---|---|
| GAJ-L01 | Gaji Karyawan | Kantor › Gaji › Gaji Karyawan (**menu baru, G5**) | HR, Pemilik, GM | PC | 4E-1 |
| GAJ-L02 | Gaji Seseorang | dari GAJ-L01, dan tab "Gaji" di KAR-L21 | HR, Pemilik, GM | PC | 4E-1 |
| GAJ-L03 | Ubah Gaji (4 langkah) | dari GAJ-L02 | HR (usulan), Pemilik, GM (G1) | PC | 4E-1 |
| GAJ-L04 | Jenis Komponen Gaji | Pengaturan › Gaji | Pemilik, GM mengubah; HR melihat | PC | 4E-1 |
| GAJ-L05 | Gaji Standar | Pengaturan › Gaji | Pemilik, GM mengubah; HR melihat | PC | 4E-1 |
| GAJ-L06 | Pengaturan Gaji | Pengaturan › Gaji (memakai BER-L40, L41) | Pemilik, GM mengubah; HR mengusulkan dan melihat (G6) | PC | 4E-1 |
| GAJ-L07 | Aturan Potongan | Panduan › Aturan Potongan | Semua | HP | 4E-1 |
| GAJ-L08 | Periode Gaji | Kantor › Gaji › Periode Slip | HR, Pemilik, GM; Admin HR melihat tanggal dan status tanpa nominal; Finance juga membuka Ringkasan bentuk Finance (GAJ-L38, 4E-5b) | PC | 4E-1 |
| GAJ-L09 | Hitungan Kehadiran | tab "Hitungan" di GAJ-L02; bentuk yang sama tampil ke karyawan di Pendapatan Saya (4E-5) | HR, Pemilik, GM; karyawan untuk dirinya | PC (kantor), HP (karyawan) | 4E-2 |
| GAJ-L10 | Tiadakan Potongan | tab di halaman satu periode (4E-5) dan dari Antrean usulan; tanpa menu sendiri | Pemilik, GM memutuskan; HR melihat | PC | 4E-2 |
| GAJ-L11 | Koreksi Periode Lalu | tab di halaman satu periode (4E-5) dan baris di GAJ-L09 | HR, Pemilik, GM; karyawan melihat barisnya di slip | PC | 4E-2 |
| GAJ-L12 | Kehilangan Barang | Kantor › Gaji › Potongan › Kehilangan Barang | HR (usulan), Pemilik, GM | PC | 4E-3 |
| GAJ-L13 | Catat Kehilangan Barang (4 langkah) | dari GAJ-L12 | HR (usulan), Pemilik, GM | PC | 4E-3 |
| GAJ-L14 | Tanggungan Kehilangan Barang | Pengaturan › Gaji (memakai BER-L40, L41) | Pemilik, GM mengubah; HR mengusulkan dan melihat | PC | 4E-3 |
| GAJ-L15 | Minus Kas | Kantor › Gaji › Potongan › Minus Kas | HR dan Finance (catat tangan sebagai usulan), Pemilik, GM | PC | 4E-3 |
| GAJ-L16 | Potongan Lain | Kantor › Gaji › Potongan › Potongan Lain | HR (usulan), Pemilik, GM | PC | 4E-3 |
| GAJ-L17 | Ajukan Potongan Lain (4 langkah) | dari GAJ-L16 | HR (usulan), Pemilik, GM | PC | 4E-3 |
| GAJ-L18 | Keberatan Potongan | dari pemberitahuan dan Pendapatan Saya (4E-5) | Orang yang dikenai; Pemilik, GM memutuskan | HP | 4E-3 |
| GAJ-L19 | Potongan dan Sisa | tab "Potongan" di GAJ-L02; bentuk yang sama di Pendapatan Saya | HR, Pemilik, GM; karyawan untuk dirinya | PC (kantor), HP (karyawan) | 4E-3 |
| GAJ-L20 | Persetujuan Bonus | Kantor › Gaji › Persetujuan Bonus | HR, Pemilik, GM | PC | 4E-4 |
| GAJ-L21 | Buku Bonus | tab "Buku Bonus" di GAJ-L20 | HR, Pemilik, GM; Finance hanya total per periode | PC | 4E-4 |
| GAJ-L22 | Catat Bonus Bebas (4 langkah) | dari GAJ-L20 | HR (usulan), Pemilik, GM (B1) | PC | 4E-4 |
| GAJ-L23 | Jenis Bonus | Pengaturan › Gaji (memakai BER-L40, L41) | Pemilik, GM mengubah; HR mengusulkan dan melihat | PC | 4E-4 |
| GAJ-L24 | Dana Disiplin | Kantor › Gaji › Dana Disiplin & Dana Tidak Hadir, tab 1 | HR, Pemilik, GM; Finance tanpa nama orang | PC | 4E-4 |
| GAJ-L25 | Dana Tidak Hadir | tab 2 halaman yang sama | HR, Pemilik, GM; Finance tanpa nama orang | PC | 4E-4 |
| GAJ-L26 | Pindah dan Sesuaikan Dana (3 langkah) | dari GAJ-L24 dan L25 | Pemilik, GM | PC | 4E-4 |
| GAJ-L27 | Bonus Seseorang | tab "Bonus" di GAJ-L02; bentuk yang sama di Pendapatan Saya | HR, Pemilik, GM; karyawan untuk dirinya | PC (kantor), HP (karyawan) | 4E-4 |
| GAJ-L28 | Periode Slip (halaman satu periode) | dari GAJ-L08 (Kantor › Gaji › Periode Slip) | HR, Pemilik, GM | PC | 4E-5a |
| GAJ-L29 | Slip | dari GAJ-L28, dan tab "Slip" di GAJ-L02 | HR, Pemilik, GM | PC | 4E-5a |
| GAJ-L30 | Tutup Slip (3 langkah) | dari GAJ-L28 dan L29 | HR, Pemilik, GM; Tutup lebih cepat: Pemilik, GM (S1, S4) | PC | 4E-5a |
| GAJ-L31 | Buka Kembali Slip (3 langkah) | dari GAJ-L29 dan dari Antrean "Minta buka kembali" | Pemilik, GM (S3) | PC | 4E-5a |
| GAJ-L32 | Cetakan Slip | dari GAJ-L28 dan L29; sisi karyawan di 4E-5c | HR, Pemilik, GM | PC (A4) | 4E-5a |
| GAJ-L33 | Jadwal Bayar | Kantor › Gaji › Jadwal Bayar | Pemilik, GM; Finance (bongkaran dan jumlah slip tanpa nama) | PC (terbaca di HP) | 4E-5b |
| GAJ-L34 | Bayar Slip (3 langkah) | dari GAJ-L33 dan L29 | Pemilik, GM | PC | 4E-5b |
| GAJ-L35 | Batal Bayar (3 langkah) | dari GAJ-L29 dan tagihan bayar di luar slip | Pemilik, GM | PC | 4E-5b |
| GAJ-L36 | Daftar Transfer | dari GAJ-L33 | Finance, Pemilik, GM (Y2) | PC | 4E-5b |
| GAJ-L37 | Bayar di Luar Slip (3 langkah) | dari GAJ-L33 dan L27 | Pemilik, GM | PC | 4E-5b |
| GAJ-L38 | Ringkasan Gaji | tab 5 GAJ-L28; Finance dari baris periode GAJ-L08 | HR, Pemilik, GM; Finance tanpa nama dan tanpa per cabang | PC | 4E-5b |
| GAJ-L39 | Pendapatan Saya | Saya › Pendapatan Saya | Semua orang berakun yang punya upah (tidak untuk pekerja lepas, DRV-45); mantan karyawan dalam akses terbatas (C4) | HP | 4E-5c |
| GAJ-L40 | Slip Saya | dari GAJ-L39 dan dari pemberitahuan slip | Orangnya sendiri | HP (unduhan PDF A4) | 4E-5c |
| GAJ-L41 | Ajukan Keberatan Slip (3 langkah) | dari GAJ-L40, dan dari Pengajuan Saya (BER-L05) | Orangnya sendiri | HP | 4E-5c |
| GAJ-L42 | Putuskan Keberatan Slip | isi khas di BER-L21, dari Persetujuan (BER-L20) | HR, Pemilik, GM (GAJ-60); macam "Uang belum saya terima": Pemilik, GM (C2) | PC (HP untuk GM) | 4E-5c |
| GAJ-L43 | Total Diterima per Orang | Kantor › Gaji › Total Diterima per Orang | Pemilik, GM; HR tanpa jabatan bertanda (C5) | PC | 4E-5c |

Buku Upah **tidak punya menu sendiri** (G5): dilihat di GAJ-L02 tab "Upah"
dan di Total Diterima per Orang (4E-5).

---

## 3. Rincian layar

Aturan untuk semua layar di bawah, tidak diulang per layar: error di jendela
"OK, paham" (TAM-01 s.d. 06); tombol menyimpan terkunci sampai selesai
(TAM-13); isian tidak hilang kalau sinyal putus (TAM-16); pesan berhasil
menyebut apa yang tersimpan dan siapa bertindak berikutnya (TAM-17); daftar
dibagi per halaman dan bisa dicari (PRI-10); rupiah berpemisah ribuan
(TAM-10); semua jam dari server (PRI-01).

**Hak lihat gaji berlaku di semua layar 4E** (GAJ-46, PRI-24, KAR-77, 83),
dijaga di server, bukan dengan menyembunyikan tombol:

- Orang yang jabatannya bertanda **"Gaji hanya terlihat Pemilik dan GM"**
  (KAR-83) **tidak muncul sama sekali** di layar HR: bukan baris kosong,
  bukan "—", supaya jumlah orang pun tidak membocorkan apa-apa.
- Admin HR dan Finance tidak pernah menerima nominal gaji per orang dari
  server.

### 3.1 Bagian 4E-1: Komponen dan Pengaturan Gaji

#### GAJ-L01. Gaji Karyawan

- **Tujuan:** melihat gaji semua orang bergaji bulanan di satu tempat, dan
  tahu siapa yang gajinya belum diisi atau akan berubah.
- **Isi tabel:** nama, jabatan, status kerja, **jumlah gaji tetap sebulan**,
  gaji harian (jumlah ÷ pembagi, ditampilkan dua angka di belakang koma
  hanya sebagai keterangan; slip tidak membulatkannya lebih dulu, GAJ-07),
  berlaku sejak, dan **perubahan terjadwal** (nominal baru dan tanggalnya)
  kalau ada.
- **Saring:** cabang, jabatan, status kerja, "belum ada gaji", "ada usulan
  menunggu".
- **Tanda kuning "Belum ada gaji":** orang aktif berslip utama bulanan yang
  tidak punya komponen berlaku di periode berjalan. Ikut tampil di "perlu
  perhatian" HR, karena slipnya tidak bisa dihitung.
- Hanya orang yang slip utamanya **bulanan** (DRV-04). Orang berslip utama
  mingguan tidak tampil; upahnya dari tarif (4G).
- Klik baris membuka GAJ-L02.

#### GAJ-L02. Gaji Seseorang

- **Kepala:** nama, jabatan, cabang, status kerja, slip utama.
- **Tab "Gaji sekarang":** daftar komponen yang berlaku hari ini (jenis,
  nominal), jumlahnya, gaji harian. Di bawahnya **perubahan terjadwal**
  (kalau ada) dengan tombol **Batalkan perubahan** (alasan wajib; hanya
  selama belum berlaku).
- **Tab "Riwayat":** tiap perubahan sebagai satu kartu: berlaku dari, isi
  lengkap komponen saat itu, alasan, siapa mengusulkan, siapa menyetujui,
  kapan. Yang paling baru di atas. Tidak ada yang dihapus.
- **Tab "Upah":** baris Buku Upah orang itu per periode (jenis, tanggal,
  banyaknya, tarif, nominal, asal, sudah masuk slip nomor berapa). Periode
  berjalan dimuat lebih dulu; periode lama dimuat saat diminta (PRI-11).
- **Tombol:** **Ubah Gaji** (GAJ-L03); **Terapkan Gaji Standar** (membuka
  GAJ-L03 dengan isian terisi dari paket yang sesuai, G3).
- Usulan yang menunggu tampil sebagai kotak kuning: "Usulan dari HR, menunggu
  Pemilik atau GM", dengan tombol **Tarik usulan** untuk pengusulnya.

#### GAJ-L03. Ubah Gaji (4 langkah, TAM-07)

1. **Mulai berlaku.** Pilihan hanya **tanggal awal periode** (tanggal 26):
   periode berjalan (kalau G2 disetujui dan slipnya belum ditutup) dan
   periode-periode depan. Tidak ada kotak tanggal bebas (GAJ-04).
2. **Isi komponen.** Daftar komponen saat ini terisi; tiap baris bisa diubah
   nominalnya, dihentikan (tombol ×; tidak dihapus dari riwayat), atau
   ditambah dari daftar jenis aktif (GAJ-L04). Satu jenis paling banyak satu
   baris. Nominal rupiah bulat, tidak boleh minus; 0 tidak boleh (hentikan
   saja). Jumlah dan gaji harian baru dihitung server dan tampil langsung.
3. **Alasan.** Wajib, paling sedikit 10 huruf (misalnya "kenaikan tahunan",
   "promosi kepala toko").
4. **Periksa.** Sebelum → sesudah per komponen, jumlah lama → baru,
   selisih, mulai periode apa. Kalau penurunan: kotak merah "Gaji turun.
   Karyawan diberi tahu sebelum berlaku." Tombol **Simpan** ditahan 3 detik
   (TAM-15).
- **Oleh HR:** tersimpan sebagai **usulan**, masuk kotak Persetujuan
  Pemilik dan GM (G1). **Oleh Pemilik atau GM:** langsung terjadwal; pemilik
  lain diberi tahu (KAR-73).
- **Pesan berhasil:** "Gaji Rina mulai 26 November 2026 menjadi
  Rp2.900.000. Rina diberi tahu." atau "Usulan terkirim. Menunggu Pemilik
  atau GM."
- **Ditolak server** (jendela "OK, paham"): periode yang dipilih slipnya
  sudah ditutup; ada usulan lain untuk orang yang sama dan periode yang sama
  (satu usulan menunggu per orang per tanggal); jenis komponen nonaktif;
  pengubah tidak berhak atas orang itu.
- **Pemberitahuan ke orangnya** (antrean berantai, TAM-22) saat perubahan
  terjadwal: "Gaji Anda berubah mulai 26 November 2026. Lihat di Pendapatan
  Saya." Nominal tidak ditulis di pemberitahuan. Perubahan gaji perorangan
  **tidak** diumumkan di Papan (PRI-35 hanya untuk aturan, bukan gaji orang).

#### GAJ-L04. Jenis Komponen Gaji

- Daftar: nama, urutan tampil di slip, aktif, dipakai berapa orang.
- **Isi awal** (Y8 arsip 3A): Gaji Pokok, Tunjangan Jabatan, Tunjangan
  Tetap. Tunjangan Khusus **tidak dibawa** (tidak pernah dipakai, GAJ-A07).
- Tambah: nama dan urutan. Ubah nama: riwayat tetap; slip yang sudah ditutup
  tetap memakai nama saat ditutup (GAJ-39).
- Nonaktifkan: ditolak selama masih ada orang yang memakainya; pesannya
  menyebut siapa saja (sama dengan KAR-27).
- Semua komponen diperlakukan sama: **dijumlah menjadi gaji tetap sebulan**,
  ikut gaji harian dan prorata (G4). Tidak ada tanda per komponen.

#### GAJ-L05. Gaji Standar

- Paket acuan (G3): **Gaji Standar Training** dan **Gaji Standar Karyawan**.
  Tiap paket: daftar komponen dan nominal, bertanggal berlaku, riwayat.
- Mengubah paket **tidak mengubah gaji siapa pun** (GAJ-03). Layar periksa
  menyebut itu terang: "Gaji 18 orang yang sudah ada tidak ikut berubah."
- Dipakai di tiga tempat, selalu sebagai **isian awal yang masih bisa
  diubah** di GAJ-L03, kecuali promosi:
  1. Orang baru disetujui (KAR-L26): Gaji diberi tahu; orang itu muncul di
     GAJ-L01 dengan tanda "Belum ada gaji" dan tombol **Isi dari Gaji
     Standar Training/Karyawan** sesuai status kerjanya.
  2. Promosi Training disetujui (KAR-L27, KAR-22): server langsung
     menjadwalkan perubahan mulai periode berikutnya: komponen yang ada di
     paket Karyawan diganti nominal paket; komponen lain yang sudah ada
     dibawa. Tanpa usulan terpisah, karena keputusan promosi sudah diambil
     yang berhak.
  3. Tombol Terapkan Gaji Standar (GAJ-L02).

#### GAJ-L06. Pengaturan Gaji

- Memakai kerangka BER-L40 dan langkah baku BER-L41. Daftar lengkapnya di
  bagian 8.
- **Angka yang dipakai slip hanya boleh mulai berlaku tanggal 26** (awal
  periode; G6), supaya satu slip memakai satu angka untuk satu aturan.
  Pengaturan jadwal (masa keberatan, batas tutup, tanggal bayar) mengenai
  periode yang belum mulai (PRI-34 butir 2).
- Pengubah: Pemilik dan GM langsung; HR mengusulkan (G6).
- Yang wajib diumumkan (bagian 8) membuka BER-L23 dengan isi terisi.

#### GAJ-L07. Aturan Potongan

- **Tujuan:** karyawan bisa membaca sendiri dari mana tiap potongan dan
  tambahan di slipnya (GAJ-23, PRI-21), tanpa bertanya.
- **Isi:** satu kartu per aturan: telat, tidak hadir, sakit dengan surat,
  denda lupa absen, tidak memilih libur, lembur, kompensasi libur,
  kehilangan barang, minus kas, Potongan Lain, kasbon, urutan potongan dan
  sisa potongan. Tiap kartu: kalimat sehari-hari, angka yang **berlaku hari
  ini** (dibaca dari pengaturan), angka berikutnya kalau sudah terjadwal
  ("mulai 26 Januari 2027 menjadi …"), dan **satu contoh hitungan**.
- **Contoh dihitung oleh rumus slip yang sama** di server, dengan orang
  contoh bergaji Rp2.600.000 (gaji harian Rp100.000), bukan salinan angka
  yang diketik (GAJ-23, WAJ-04). Kalau rumus berubah, contohnya ikut.
- Hanya kartu yang berlaku untuk **jabatan orang itu** yang tampil (misalnya
  kasir tidak melihat kartu denda driver; jabatan tanpa lembur tidak melihat
  kartu lembur), sejalan PRI-29.
- Jabatan bertanda tidak diabsen (Pemilik, GM) melihat semua kartu sebagai
  bacaan.
- Isi kartu diisi bertahap: 4E-1 membuat layar dan kartu kosongnya; rumus
  tiap kartu ditulis di 4E-2 dan 4E-3.

#### GAJ-L08. Periode Gaji

- **Dua tab:** Bulanan (26–25) dan Minggu Upah (Jumat–Kamis).
- **Tiap baris:** nama ("November 2026" atau "Minggu upah 30 Okt – 5 Nov
  2026"), tanggal mulai dan akhir, **status dibaca dari slipnya** (Berjalan,
  Menunggu ditutup, Ditutup, Lunas; PRI-34 butir 3), akhir masa keberatan,
  batas tutup, tanggal bayar. Untuk HR, Pemilik, GM: jumlah slip dan jumlah
  tertahan.
- Yang tampil: periode berjalan, satu periode depan, dan periode lalu; yang
  lebih lama dimuat saat diminta (PRI-11).
- Tidak ada tombol membuat atau mengubah tanggal periode; periode dibuat
  mesin (bagian 6).
- Klik baris membuka halaman satu periode (ditulis di 4E-5).

### 3.2 Bagian 4E-2: Hitungan dari Kehadiran

Bahan: GAJ-05 s.d. 16, 23, 39; KEH-21 s.d. 25, 31, 33, 41, 46, 48, 49,
63, 64, 66, 68, 75, 79, 81, 86, 87, 99, 103, 105, 116, 118, 123, 135,
137, 138, 140, 142, 143, 146, 150, 153 s.d. 155, 158, 159, 162, 165, 166;
KAR-22, 59, 62, 67; PRI-04, 21, 26, 28, 34. Arsip sistem lama:
`hris-app/lib/escalatingDeduction.ts` dan hitungan slip bulanan (hanya
dibaca, WAJ-09).

**Pokoknya:** Kehadiran menyimpan **apa yang terjadi** (menit, hari, jam,
kejadian ke-berapa); Gaji menyimpan **berapa rupiahnya**. Semua rupiah dari
kehadiran keluar dari **satu fungsi di server**, "hitungan kehadiran (orang,
periode)", yang dipanggil oleh perkiraan gaji di portal, oleh penutupan slip
(4E-5), oleh contoh di Aturan Potongan (GAJ-L07), dan oleh koreksi periode
lalu (GAJ-L11). Tidak ada rumus kedua (WAJ-04, GAJ-36).

#### Rumus (dijalankan fungsi itu)

Semua angka aturan dibaca **menurut tanggal kejadiannya** (WAJ-07). Karena
angka slip hanya berubah tanggal 26 (GAJ-67), dalam satu periode hasilnya
selalu satu angka. Perlakuan jabatan (kena telat, dapat lembur, dapat
kompensasi libur) dibaca dari jabatan orang itu **pada tanggal kejadian**
ditambah Daftar Pengecualian (GAJ-08, PRI-26). Jabatan Pemilik tidak punya
satu pun baris di bawah kecuali gaji tetap (GAJ-09).

| No | Baris | Rumus | Dibaca dari |
|---|---|---|---|
| R1 | **Gaji tetap** | Jumlah komponen berlaku (fungsi baca gaji 4E-1). Kalau masuk atau berhenti di tengah periode: × (hari kalender bekerja ÷ jumlah hari periode), dihitung dari tanggal masuk sampai hari terakhir bekerja, keduanya ikut dihitung (GAJ-06) | Gaji (4E-1), Karyawan (tanggal masuk dan nonaktif) |
| R2 | **Gaji harian** (bukan baris; angka pembantu) | Gaji tetap sebulan **penuh** (bukan yang diprorata) ÷ pembagi (26). Tidak dibulatkan (GAJ-05, 07) | Gaji, pengaturan |
| R3 | **Telat** | Untuk tiap hari kerja: menit telat ≤ toleransi → 0; > toleransi → seluruh menit × tarif (GAJ-10). Hari yang ditiadakan (GAJ-L10) bernilai 0 dan tetap tampil. Satu baris per periode = jumlah semua hari; rincian per hari di bawahnya | Kehadiran: menit telat per hari kerja (KEH-21; dihitung dari jam yang diisi bila lewat penjelasan lupa absen, KEH-153); toleransi milik Kehadiran (KEH-22) |
| R4 | **Tidak hadir** | Hari berstatus Izin, Sakit, atau Alpha (KEH-81) diberi **pengali** dari tangganya (GAJ-13), lalu **jumlah pengali × gaji harian**. Satu baris per jenis tangga; rincian per hari menyebut "hari ke-n, pengali x". Cara tangga berjalan: K1. Training: K2 | Kehadiran: status hari kerja dan jenis pengajuannya (izin keperluan, izin mendadak, sakit tanpa surat, sakit dengan surat, duka) |
| R5 | **Hari yang dibayar penuh** (tidak ada baris) | Libur terjadwal, libur pengganti, cuti tahunan, izin duka hari ke-1 dan ke-2, hari tutup (GAJ-14, KEH-48, 49, 79, 146) | Kehadiran |
| R6 | **Lembur** | Jumlah **jam disahkan** dalam periode × tarif (GAJ-12). Jam sudah bilangan bulat 1 sampai 3 dari Kehadiran (KEH-159, 162); fungsi ini tidak membulatkan jam lagi | Kehadiran: klaim lembur berstatus Disahkan |
| R7 | **Kompensasi libur** | Banyaknya hari libur terjadwal yang dipakai bekerja karena **diminta** dan benar-benar absen masuk × gaji harian × pengali kompensasi (1) (GAJ-15, KEH-137). Tetap dibayar walaupun libur penggantinya hangus (KEH-138). Hanya jabatan "dapat kompensasi libur" | Kehadiran: permintaan masuk di hari libur + absen masuk hari itu |
| R8 | **Denda kehadiran** | Jumlah baris `denda_kehadiran` berstatus Berlaku dalam periode, dikelompokkan per jenis. Barisnya ditulis saat keputusan lahir (lihat "Baris denda" di bawah) | Gaji: `denda_kehadiran` |
| R9 | **Koreksi periode lalu** | Selisih hitungan ulang periode yang sudah ditutup (GAJ-L11) | Gaji: `koreksi_periode_lalu` |

**Pembulatan (GAJ-07):** tiap baris R1, R3, R4, R6, R7, R8, R9 dibulatkan
ke rupiah terdekat (,5 ke atas) **satu kali pada jumlah barisnya**. Rincian
per hari ditampilkan apa adanya sebagai keterangan dan tidak dibulatkan
sendiri-sendiri. Contoh: gaji Rp2.900.000, alpha 2 hari (1,5 + 2 = 3,5) =
3,5 × Rp111.538,4615… = Rp390.384,6… → **Rp390.385**.

**Hari yang belum ditentukan** (KEH-118: tanpa absen, tanpa pengajuan, belum
ditandai mesin) tidak dipotong di perkiraan dan tampil dengan tanda kuning
"belum ditentukan". Penutupan slip tidak menunggunya secara khusus, karena
mesin penanda alpha (KEH-150) menyelesaikannya tiap hari; yang masih
menunggu pengajuan menahan slip (GAJ-43, 4E-5).

**Lewat batas istirahat** (KEH-86): fungsi ini sudah punya tempat untuk
membaca pengaturan "akibat lewat batas istirahat". Isinya **kosong** (hanya
dicatat Kehadiran, tanpa rupiah) sampai pemilik memutuskan lain (K5).

#### Baris denda

- **Kapan ditulis** (GAJ-16, KEH-154): satu baris `denda_kehadiran` ditulis
  server **pada saat** penjelasan lupa absen masuk, lupa absen pulang, atau
  lupa Masuk Kembali **disahkan** (termasuk lewat pengajuan terlambat,
  KEH-155), dan pada saat mesin mencatat tanda "tidak memilih libur"
  (KEH-135, pukul 00.10 tanggal 26, satu per orang per periode).
- **Tanggal dan periode** = tanggal kejadian, bukan tanggal disahkan. Denda
  tidak memilih libur bertanggal 26, jadi masuk **periode yang baru mulai**.
  Bila periode tanggal kejadian sudah ditutup (pengajuan terlambat), baris
  masuk slip periode berikutnya dengan keterangan periode asalnya (GAJ-50).
- **Nominal** = denda dasar jenis itu + tambahan bila kejadian itu urutan
  ke-5 atau lebih **pada jenisnya sendiri** dalam periode itu (KEH-64, 154:
  lupa masuk, lupa pulang, dan lupa Masuk Kembali dihitung terpisah; "ke-n"
  diberikan Kehadiran). Denda tidak memilih libur tidak punya tambahan.
- **Dicabut** (KEH-158): baris dibatalkan dengan alasan yang sama, lalu
  server menghitung ulang urutan ke-n jenis itu; baris yang tambahannya
  berubah **dibatalkan dan ditulis ulang** (tidak ditimpa, PRI-02).
- **Orang per ritase** tidak pernah mendapat baris ini (KEH-123); denda
  driver dan kenek di 4G.
- **Peniadaan** denda: GAJ-71 (K3), lewat GAJ-L10.

#### Koreksi periode lalu

- **Sebabnya** (PRI-04, KEH-68, 105, 116, 143, 158, 166): koreksi susulan
  absen, pencabutan keputusan, hari tutup yang dipasang mundur, surat dokter
  yang masuk sesudah slip ditutup, atau denda terlambat, yang mengenai
  periode yang slipnya **sudah ditutup**.
- **Caranya** (K4): server menjalankan fungsi hitungan kehadiran yang sama
  untuk periode lama itu dengan data terbaru, memakai **angka aturan dan gaji
  periode lama**, lalu membandingkannya dengan baris slip yang tersimpan per
  jenis. Selisih tiap jenis menjadi satu baris "Koreksi [jenis] periode
  [nama]" di slip periode yang masih berjalan: plus menjadi tambahan, minus
  menjadi potongan. Satu sebab bisa menggeser tangga hari lain (contoh: alpha
  pertama dibetulkan menjadi hadir, alpha kedua turun dari pengali 2 ke 1,5);
  hitung ulang seluruh periode menangkap itu dengan sendirinya.
- Slip lama **tidak diubah** (GAJ-39, 50). Selisih nol tidak menulis baris.

#### GAJ-L09. Hitungan Kehadiran

- **Tujuan:** memperlihatkan dari mana tiap rupiah kehadiran di slip
  seseorang, sampai ke hari dan aturannya (PRI-21).
- **Kepala:** nama, periode (pilih; periode lama dimuat saat diminta,
  PRI-11), status (Perkiraan, dihitung pukul berapa; atau Ditutup, nomor
  slip), gaji tetap sebulan, gaji harian.
- **Isi:** satu kartu per baris R1, R3, R4, R6, R7, R8, R9 yang ada isinya.
  Tiap kartu: nama baris, jumlah rupiah, kalimat aturannya ("Telat lebih dari
  5 menit dipotong seluruh menitnya, Rp1.000 per menit"), lalu rincian yang
  bisa dibuka: tanggal, angka dari Kehadiran (menit, jam, status, kejadian
  ke-n), pengali atau tarif, hasil. Tanda yang tampil di rincian:
  "ditiadakan" beserta alasannya (GAJ-11), "dalam toleransi" (hanya untuk
  kantor, KEH-119), "diisi lewat klarifikasi" (KEH-63), "belum ditentukan".
- **Hari yang dibayar penuh** (R5) tampil sebagai satu baris keterangan
  tanpa rupiah: "Libur 4, cuti 1, hari tutup 1: dibayar penuh".
- **Perkiraan** dihitung ulang setiap kali dibuka atau setiap ada perubahan
  sumber, oleh fungsi yang sama. **Slip ditutup** membaca rincian yang
  tersimpan dan tidak menghitung ulang (GAJ-39).
- **Untuk karyawan** (lewat Pendapatan Saya, 4E-5): bentuk yang sama, ukuran
  HP, tanpa tanda "dalam toleransi" dan tanpa nominal pada telat yang tidak
  dipotong (KEH-119); semua baris tetap tampil (GAJ-54).
- Tidak ada isian dan tidak ada tombol ubah (GAJ-38). Satu-satunya tombol:
  **Lihat aturan** (membuka kartu yang sesuai di GAJ-L07) dan, untuk Pemilik
  dan GM, **Tiadakan** di rincian telat dan denda (membuka GAJ-L10 langsung
  pada kejadian itu).

#### GAJ-L10. Tiadakan Potongan

- **Tujuan:** Pemilik atau GM meniadakan potongan telat (GAJ-11) dan denda kehadiran (K3,
  GAJ-71), **satu kejadian per keputusan**, sebelum slip
  ditutup.
- **Dua bagian:**
  1. **Usulan untuk ditiadakan** (di atas): telat di atas 30 menit yang
     penjelasannya disetujui (KEH-66), bertanda "Usulan dari penjelasan",
     dengan alasan karyawan dan putusan penyetujunya. Usulan ini juga masuk
     Antrean Pemilik dan GM.
  2. **Semua potongan telat dan denda periode ini** yang bernilai lebih dari
     Rp0, bisa disaring per cabang dan per orang.
- **Tombol per kejadian:** **Tiadakan** → alasan wajib (paling sedikit 10
  huruf) → layar periksa ("Potongan telat Rina 12 November, 40 menit,
  Rp40.000, ditiadakan.") → tombol ditahan 3 detik (TAM-15). Untuk usulan
  ada juga **Tetap dipotong** (alasan wajib; usulan selesai, potongan
  berjalan).
- Setelah semua usulan diputuskan, tombol **Berikutnya** membuka usulan
  berikutnya (PRI-40 butir 1). Tidak ada "Tiadakan semua".
- **Membatalkan peniadaan:** boleh dengan alasan selama slip belum ditutup;
  riwayat keduanya tetap.
- **Ditolak server** (jendela "OK, paham"): pengubah bukan Pemilik atau GM;
  slip periode itu sudah ditutup ("Sudah masuk slip yang ditutup. Koreksinya
  lewat slip berikutnya"); kejadian milik pengubah sendiri (PRI-37 butir 3).
- **HR** melihat bagian 1 dan 2 tanpa tombol, supaya bisa mengingatkan
  pemilik sebelum menutup slip.
- Hasilnya terbaca di GAJ-L09 dan slip sebagai "ditiadakan" beserta
  alasannya; potongan yang ditiadakan tidak masuk Dana Disiplin (GAJ-11, 33).

#### GAJ-L11. Koreksi Periode Lalu

- **Tujuan:** HR, Pemilik, dan GM melihat koreksi dari periode yang sudah
  ditutup yang akan masuk slip periode ini, sebelum menutupnya.
- **Isi tabel:** orang, periode asal, sebab (dengan tautan ke catatan asalnya
  di Kehadiran), jenis, hitungan lama, hitungan baru, selisih, masuk slip
  periode apa.
- Tidak ada tombol mengubah angka; angka berasal dari fungsi yang sama. Kalau
  sebabnya salah, jalan keluarnya di sumbernya (Kehadiran) dan selisih ikut
  dihitung ulang selama slip periode ini belum ditutup.
- Untuk karyawan, baris ini tampil di GAJ-L09 dan slip sebagai "Koreksi
  [jenis] periode [nama]" beserta sebabnya.

#### Isi kartu Aturan Potongan (GAJ-L07) dari 4E-2

Semua contoh dihitung fungsi yang sama dengan orang contoh bergaji
Rp2.600.000 (gaji harian Rp100.000), bukan diketik:

| Kartu | Contoh yang ditampilkan |
|---|---|
| Gaji harian | Rp2.600.000 ÷ 26 = Rp100.000 |
| Masuk di tengah periode | Periode 30 hari, masuk tanggal 11: Rp2.600.000 × 15/30 = Rp1.300.000; jatah libur 2 hari |
| Telat | Telat 5 menit: Rp0. Telat 6 menit: Rp6.000 |
| Izin dan sakit tanpa surat | 3 hari dalam satu periode: 1 + 1,25 + 1,5 = 3,75 × Rp100.000 = Rp375.000 |
| Izin mendadak | 2 hari: 1,25 + 1,5 = 2,75 × Rp100.000 = Rp275.000 |
| Alpha | 2 hari: 1,5 + 2 = 3,5 × Rp100.000 = Rp350.000 |
| Sakit dengan surat dokter | 4 hari: 0 + 0,5 + 0,5 + 1 = Rp200.000 |
| Yang tidak dipotong | Libur, cuti tahunan, izin duka 2 hari, hari tutup |
| Lembur | 2 jam disahkan: 2 × Rp7.500 = Rp15.000 |
| Kompensasi libur | Diminta masuk di 1 hari libur: Rp100.000 (jabatan yang mendapatkannya) |
| Denda lupa absen | Lupa absen pulang ke-1 sampai ke-4: Rp5.000; ke-5: Rp10.000 |
| Denda tidak memilih libur | Rp10.000 sekali per periode |

Kartu Training (pengali 1) hanya tampil untuk orang berstatus Training dan
untuk kantor.

### 3.3 Bagian 4E-3: Potongan di Luar Kehadiran

Bahan: GAJ-07, 09, 17 s.d. 23, 33, 38, 39, 50, 52, 53, 58, 72; KEU-51, 54,
55, 74; DRV-04, 05, 23, 24, 56 s.d. 73; KAR-62, 68; KIN-17; PRI-02, 04, 21,
26, 28, 37. Arsip `../../aturan/arsip/03-gaji-galian.md` bagian 3B.

**Pokoknya:** tiap potongan dicatat di menunya sendiri (Kehilangan Barang,
Minus Kas, Potongan Lain; kasbon di menu Kasbon milik 4G; selisih kasir di
Laporan Kasir milik Keuangan). Slip hanya membaca (GAJ-38). Semua rupiah
potongan di luar kehadiran, beserta **urutan pengambilan dan sisa potongan**
untuk seluruh slip, keluar dari **satu fungsi di server**, "hitungan potongan
(orang, periode)", yang dipanggil perkiraan, penutupan slip (4E-5), contoh di
Aturan Potongan, dan slip mingguan (4G). Tidak ada rumus kedua (WAJ-04).

Jabatan Pemilik dan GM tidak punya satu pun baris di bagian ini (GAJ-09).
Potongan Lain dan kasbon hanya diambil dari **slip utama** orang itu; slip
lain dibayar utuh (DRV-04, 05).

#### Rumus (dijalankan fungsi itu)

| No | Baris | Rumus | Dibaca dari |
|---|---|---|---|
| R10 | **Kehilangan barang** | Untuk tiap kejadian Berlaku yang tanggal ditemukannya di periode itu, di tiap cabang tempat orang itu ditempatkan: nilai × (100% − persen kantor) × bobot orang itu ÷ jumlah bobot × hari orang itu di cabang itu ÷ jumlah hari periode. Satu baris per cabang per periode; rincian per kejadian di bawahnya. Rincian lengkapnya di "Pembagian kehilangan barang" | Gaji: `kehilangan_barang`; pengaturan persen kantor dan bobot; Karyawan: riwayat penempatan, jabatan, tanda "ikut menanggung kehilangan barang" |
| R11 | **Minus kas dari Laporan Kasir** | Jumlah kekurangan atas nama orang itu di periode itu yang berstatus **Tetap** atau **Keberatan menunggu**, dikurangi jumlah kelebihan kasnya di periode yang sama, paling kecil Rp0 (KEU-54). Kekurangan yang **Ditiadakan** bernilai 0 dan tetap tampil. Satu baris per periode; rincian per laporan | Keuangan: selisih kasir per laporan (lewat satu fungsi baca milik 4H) |
| R12 | **Minus kas catat tangan** | Bernama: nilainya. Tanpa nama: nilai ÷ banyaknya orang yang dibagi (GAJ-79). Satu baris per periode; rincian per kejadian | Gaji: `minus_kas_catat` dan `bagian_minus_kas` |
| R13 | **Potongan Lain** | Cicilan yang jatuh tempo di slip itu (jadwal dari GAJ-80) | Gaji: `cicilan_potongan_lain` |
| R14 | **Kasbon** | Cicilan yang jatuh tempo di slip itu (DRV-65, 68) | Gaji Driver dan Kasbon (4G): jadwal cicilan |
| R15 | **Sisa potongan** | Bagian potongan slip sebelumnya yang tidak tertampung (GAJ-75), satu baris per jenis asal, dengan keterangan periode asalnya | Gaji: `sisa_potongan` |

**Pembulatan (GAJ-07):** bagian tiap orang dibulatkan ke rupiah terdekat
satu kali per baris. Selisih pembulatan pembagian kehilangan barang dan minus
kas tanpa nama ditanggung kantor dan tampil di bagian kantor.

#### Urutan pengambilan dan sisa potongan (GAJ-75)

1. **Pendapatan slip** = gaji tetap (R1) + lembur (R6) + kompensasi libur
   (R7) + bonus (4E-4) + koreksi periode lalu yang bertanda plus (R9).
2. Potongan diambil **berurutan** sampai pendapatan habis. Di tiap kelompok,
   **sisa potongan dari slip sebelumnya diambil lebih dulu** ("utang lama
   dulu"), lalu potongan baru:
   - (a) telat, tidak hadir, denda kehadiran, dan koreksi periode lalu yang
     bertanda minus dari jenis itu;
   - (b) kehilangan barang dan minus kas (R10, R11, R12);
   - (c) Potongan Lain (R13);
   - (d) kasbon (R14).
   Di dalam satu kelompok, urutannya mengikuti tanggal kejadian, yang paling
   lama lebih dulu.
3. Potongan yang hanya tertampung sebagian **dipotong sebagian**. Yang tidak
   tertampung menjadi baris `sisa_potongan` dengan **jenis asal** dan periode
   asalnya, dan ikut slip utama berikutnya. Tidak ada yang hangus selama
   orangnya masih punya slip berikutnya (GAJ-52, DRV-24).
4. **Gaji bersih tidak pernah di bawah Rp0.** Slip yang bersihnya Rp0 tetap
   ditutup (DRV-26).
5. Yang dihitung "benar-benar terpotong" untuk Dana Disiplin, Dana Tidak
   Hadir, Dana Kasbon, dan tanda cicilan terpotong adalah bagian yang
   tertampung saja. Sisa yang baru terpotong di slip berikutnya dihitung
   **saat itu** (GAJ-33, 35; DRV-57, 66).

Contoh: pendapatan Rp1.000.000; (a) Rp300.000; (b) Rp200.000; (c)
Rp400.000; (d) Rp250.000. Terpotong: (a) penuh, (b) penuh, (c) penuh, (d)
Rp100.000. Bersih Rp0. Sisa potongan kasbon Rp150.000 ke slip berikutnya.

#### Pembagian kehilangan barang (GAJ-77)

- **Yang ikut menanggung:** orang yang **ditempatkan** di cabang itu
  sekurang-kurangnya satu hari dalam periode tanggal ditemukan, dengan jabatan
  bertanda "ikut menanggung kehilangan barang" (KAR-L31). Status Training
  tidak membedakan, karena tandanya milik jabatan.
- **Bobot orang itu:** bobot jabatannya pada hari terakhir ia ditempatkan di
  cabang itu dalam periode tersebut.
- **Hari orang itu:** banyaknya hari kalender ia ditempatkan di cabang itu
  dalam periode tersebut, dengan jabatan bertanda. Hari libur, izin, sakit,
  dan cuti ikut terhitung. **Perbantuan** ke cabang lain tidak memindahkan
  tanggungan, karena penempatannya tidak berubah.
- **Jumlah bobot** = bobot semua orang yang ikut menanggung di cabang itu
  dalam periode tersebut, masing-masing dihitung penuh.
- **Bagian kantor** = nilai dikurangi jumlah bagian semua orang. Isinya:
  persen kantor, ditambah sisa karena sebanding hari (GAJ-18), ditambah
  selisih pembulatan. Ketiganya tampil terang dan terpisah.
- **Contoh:** kehilangan Rp1.000.000, kantor 40%, periode 30 hari. Kepala
  toko (bobot 2) dan Budi (1) penuh; Citra (1) berhenti setelah 10 hari; Dodi
  (1) masuk dan bekerja 20 hari. Jumlah bobot 5. Kepala toko Rp240.000, Budi
  Rp120.000, Citra Rp40.000, Dodi Rp80.000. Kantor Rp400.000 + sisa sebanding
  hari Rp120.000 = Rp520.000.
- **Kejadian yang disahkan sesudah slip periodenya ditutup** tetap dibagi
  menurut orang di periode tanggal ditemukan. Bagian tiap orang masuk slip
  utama berikutnya dengan keterangan periode asal (GAJ-50). Bagian orang yang
  sudah tidak punya slip berikutnya ditanggung kantor.

#### GAJ-L12. Kehilangan Barang

- **Tujuan:** mencatat kehilangan barang tiap cabang dan melihat
  pembagiannya.
- **Letak:** Kantor › Gaji › Potongan › Kehilangan Barang. **PC.**
- **Isi:** daftar kejadian per periode, bisa disaring per cabang dan status
  (Menunggu pengesahan, Berlaku, Dibatalkan, Sudah masuk slip). Tiap baris:
  cabang, tanggal ditemukan, nilai, keterangan, lampiran, pencatat,
  pengesah, status.
- **Klik baris:** kartu pembagian: persen kantor dan bobot yang dipakai, tiap
  orang (bobot, hari, bagian), bagian kantor dalam tiga angka (persen kantor,
  sisa sebanding hari, pembulatan). Jumlah selalu sama dengan nilai.
- **Tombol:** **Catat Kehilangan** (GAJ-L13); **Batalkan** (alasan wajib;
  hanya sebelum masuk slip yang ditutup; sesudahnya lewat baris koreksi,
  GAJ-50).
- Peringatan merah di atas daftar bila ada cabang yang belum punya persen
  kantor atau jabatan bertanda yang belum punya bobot (GAJ-L14).

#### GAJ-L13. Catat Kehilangan Barang (4 langkah, TAM-07)

1. **Cabang dan tanggal ditemukan.** Tanggal tidak boleh di masa depan.
2. **Nilai dan keterangan.** Rupiah bulat lebih dari 0; keterangan paling
   sedikit 10 huruf (misalnya "hasil opname November: makanan kucing").
3. **Lampiran** foto atau berkas hasil opname, **wajib** (GAJ-76).
4. **Periksa.** Pratinjau pembagian dihitung server dengan fungsi yang sama:
   orang, bagian, bagian kantor. Tombol **Simpan** ditahan 3 detik (TAM-15).
- **Oleh HR:** tersimpan sebagai **usulan** (jenis "Usulan potongan"),
  menunggu Pemilik atau GM. **Oleh Pemilik atau GM:** langsung Berlaku.
- **Saat Berlaku:** tiap orang yang menanggung diberi tahu: "Ada kehilangan
  barang Rp1.000.000 di Toko Raja (opname 20 November). Bagian Anda
  Rp120.000, dipotong di slip November."
- **Ditolak server:** cabang tanpa persen kantor yang berlaku pada tanggal
  itu; ada jabatan bertanda tanpa bobot; tanpa lampiran.
- **Tidak ada satu pun orang yang ikut menanggung:** usulan HR ditolak;
  Pemilik dan GM melihat peringatan "Tidak ada yang ikut menanggung di cabang
  ini pada periode itu. Seluruhnya ditanggung kantor." dan boleh tetap
  menyimpan.

#### GAJ-L14. Tanggungan Kehilangan Barang

- **Letak:** Pengaturan › Gaji. Memakai kerangka BER-L40 dan langkah baku
  BER-L41. **PC.**
- **Dua tab:** **Persen kantor per cabang** dan **Bobot per jabatan**. Hanya
  jabatan bertanda "ikut menanggung kehilangan barang" yang tampil di tab
  bobot.
- Bertanggal berlaku, **hanya mulai tanggal 26** (GAJ-67). Pengubah: Pemilik
  dan GM langsung; HR mengusulkan.
- Contoh tetap di bawahnya: "Dengan angka ini, kehilangan Rp1.000.000 di
  cabang ini dibagi: …", dihitung server dari orang yang ditempatkan hari
  ini.
- Bobot berupa bilangan bulat 1 sampai 9 (isi awal diisi pemilik saat tayang,
  GAJ bagian 6 butir 4). Persen kantor 0 sampai 100, bilangan bulat.

#### GAJ-L15. Minus Kas

- **Tujuan:** melihat semua minus kas yang akan masuk slip, dari dua asal,
  dan mencatat yang di luar Laporan Kasir.
- **Letak:** Kantor › Gaji › Potongan › Minus Kas. **PC.**
- **Dua tab:**
  1. **Dari Laporan Kasir** (hanya baca; milik Keuangan, KEU-54, 55):
     tanggal, cabang, penutup shift, kekurangan atau kelebihan, status
     (Tetap, Keberatan menunggu, Ditiadakan), tautan ke laporannya. Tidak ada
     tombol ubah; keberatan diputuskan di Keuangan.
  2. **Catat tangan:** tanggal, cabang, nilai, alasan, bernama atau tanpa
     nama, penanggung (atau daftar pembagian), status (Menunggu pengesahan,
     Berlaku, Keberatan menunggu, Ditiadakan, Dibatalkan, Sudah masuk
     slip). Tombol **Catat Minus Kas**.
- **Catat Minus Kas (4 langkah):** (1) cabang dan tanggal kejadian; (2) nilai
  dan alasan (paling sedikit 15 huruf; harus menjelaskan kenapa tidak lewat
  Laporan Kasir); (3) **bernama** (pilih satu orang yang ditempatkan atau
  hadir di cabang itu hari itu) atau **tanpa nama** (server menampilkan siapa
  saja yang akan menanggung, GAJ-79); foto bila ada; (4) periksa, tombol
  ditahan 3 detik.
- **Pencatat:** HR atau finance; tersimpan sebagai usulan yang disahkan
  Pemilik atau GM. Oleh Pemilik atau GM langsung Berlaku.
- **Ditolak server:** tanpa nama tetapi tidak ada orang berjabatan bertanda
  yang hadir di cabang itu hari itu (pesan: "Tidak ada yang hadir. Pilih
  nama penanggung, atau batalkan"); orang bernama tidak ditempatkan dan tidak
  hadir di cabang itu hari itu; jabatan orangnya Pemilik atau GM.
- **Saat Berlaku:** penanggung diberi tahu nominal dan alasannya, beserta
  tombol **Ajukan keberatan** (GAJ-L18) selama 3 hari.

#### GAJ-L16. Potongan Lain

- **Tujuan:** mencatat ganti rugi perorangan yang dicicil lewat slip.
- **Letak:** Kantor › Gaji › Potongan › Potongan Lain. **PC.**
- **Isi:** daftar per orang: jenis, nominal, alasan, kali potong, sisa
  (dihitung server dari cicilan terpotong), status (Menunggu pengesahan,
  Berjalan, Keberatan menunggu, Lunas, Ditiadakan, Dibatalkan, Piutang).
  Saring: cabang, jenis, status.
- **Klik baris:** jadwal cicilan (slip mana, nominal, terpotong berapa) dan
  riwayatnya.
- **Tombol:** **Ajukan Potongan Lain** (GAJ-L17); **Ubah jadwal** (Pemilik
  atau GM, alasan wajib; hanya cicilan yang belum terpotong; kali potong
  tetap 1 sampai 3 dihitung dari cicilan yang tersisa); **Batalkan** (alasan
  wajib; hanya sebelum cicilan pertama terpotong; sesudahnya hanya
  **Hapuskan sisa** oleh Pemilik atau GM, tercatat sebagai beban).
- **Jenis Potongan Lain** diatur di Pengaturan › Gaji sebagai daftar yang
  bisa ditambah (PRI-20). Isi awal: Ganti rugi barang rusak, Ganti rugi
  peralatan, Lainnya. Hanya Pemilik dan GM yang mengubah daftarnya; jenis
  yang masih dipakai tidak bisa dinonaktifkan.

#### GAJ-L17. Ajukan Potongan Lain (4 langkah, TAM-07)

1. **Orang.** Hanya orang aktif atau yang slip terakhirnya belum ditutup;
   jabatan Pemilik dan GM tidak bisa dipilih.
2. **Jenis, nominal, alasan.** Nominal rupiah bulat lebih dari 0; alasan
   paling sedikit 15 huruf; foto bila ada.
3. **Kali potong** 1, 2, atau 3 (GAJ-80). Server menampilkan jadwalnya:
   nominal dibagi rata, dibulatkan ke bawah ke rupiah, sisanya masuk cicilan
   terakhir; cicilan pertama di slip utama periode saat disahkan, atau slip
   berikutnya bila slip itu sudah ditutup (sama dengan DRV-65).
4. **Periksa.** Tombol ditahan 3 detik.
- **Oleh HR:** usulan (jenis "Usulan potongan"), menunggu Pemilik atau GM.
  **Oleh Pemilik atau GM:** langsung Berjalan. Tidak ada yang mengajukan atau
  mengesahkan Potongan Lain untuk dirinya sendiri.
- **Saat Berjalan:** orangnya diberi tahu jenis, nominal, alasan, dan
  jadwalnya, beserta tombol **Ajukan keberatan** (GAJ-L18) selama 3 hari.

#### GAJ-L18. Keberatan Potongan

- **Tujuan:** orang yang dibebani minus kas catat tangan bernama atau
  Potongan Lain bisa menyatakan tidak setuju, dengan satu cara (GAJ-81).
- **Letak:** dari pemberitahuan dan dari baris potongan di Pendapatan Saya
  (4E-5). **HP.** Memakai Mesin Pengajuan (PRI-23), jenis "Keberatan
  potongan".
- **Langkah:** (1) potongan yang dikeberati (terisi); (2) alasan, paling
  sedikit 20 huruf, foto bila ada; (3) periksa dan kirim.
- **Batas:** sampai pukul 23.59 hari ke-3 sejak orangnya diberi tahu (jam
  server). Lewat itu tombol hilang.
- **Diputuskan** Pemilik atau GM (bukan pencatat atau pengesahnya bila
  orang itu sendiri yang dikenai): **Tetap** atau **Ditiadakan**, alasan
  wajib. Hasilnya dikirim ke orangnya.
- Selama menunggu, potongan **tetap berjalan**. Bila slip ditutup sebelum
  diputuskan, potongan tetap terpotong; bila kemudian Ditiadakan, uangnya
  kembali sebagai baris koreksi plus di slip berikutnya (GAJ-50, 72).
- Kehilangan barang **tidak** punya keberatan perorangan, karena
  ditanggung bersama; keberatan atas bagiannya lewat keberatan slip (GAJ-42,
  4E-5). Selisih kasir dari Laporan Kasir memakai keberatan milik Keuangan
  (KEU-55).

#### GAJ-L19. Potongan dan Sisa

- **Tujuan:** memperlihatkan urutan pengambilan dan sisa potongan seseorang
  per periode (PRI-21).
- **Letak:** tab "Potongan" di GAJ-L02; bentuk yang sama untuk karyawan di
  Pendapatan Saya (4E-5). **PC** (kantor), **HP** (karyawan).
- **Isi:** pendapatan slip; lalu kelompok (a) s.d. (d) berurutan, tiap
  baris: jenis, periode asal (untuk sisa), nominal, **terpotong**, **sisa**.
  Garis bawah: gaji bersih, jumlah sisa potongan yang dibawa ke slip
  berikutnya.
- **Perkiraan** dihitung ulang tiap dibuka; **slip ditutup** membaca yang
  tersimpan (GAJ-39).
- Tidak ada isian dan tidak ada tombol ubah (GAJ-38). Tombol **Lihat aturan**
  membuka kartu urutan potongan di GAJ-L07.

#### Slip terakhir orang yang berhenti (GAJ-82)

Dijalankan fungsi yang sama saat slip terakhir ditutup (langkah tutupnya di
4E-5):

- Seluruh **sisa kasbon** dan **sisa Potongan Lain** (bukan hanya cicilan
  yang jatuh tempo) masuk slip itu (GAJ-53, DRV-73).
- Yang tetap tidak tertampung:
  - kelompok (a) telat, tidak hadir, denda: **tidak ditagih**. Dicatat
    "tidak tertagih" di slip, tidak masuk Dana Disiplin atau Dana Tidak
    Hadir;
  - kelompok (b), (c), (d): menjadi **Piutang Lain** atas nama orang itu,
    satu baris per jenis, lahir otomatis saat slip ditutup (KEU-74).
    Penghapusan hanya oleh pemilik dengan alasan.
- **Berhenti tanpa pemberitahuan sebulan** (GAJ-58): slip dihitung seperti
  di atas dengan urutan yang sama; seluruh **gaji bersih** yang tersisa
  sesudah semua potongan menjadi satu baris "denda berhenti tanpa
  pemberitahuan", sehingga diterima Rp0. Kalau bersihnya sudah Rp0, dendanya
  Rp0.

#### Isi kartu Aturan Potongan (GAJ-L07) dari 4E-3

Dihitung fungsi yang sama dengan orang contoh bergaji Rp2.600.000:

| Kartu | Contoh yang ditampilkan |
|---|---|
| Kehilangan barang | Kehilangan Rp1.000.000, kantor 40%, empat orang (bobot 2, 1, 1, 1) bekerja penuh: bagian bobot 1 = Rp120.000; bobot 2 = Rp240.000; kantor Rp400.000. Kalau Anda masuk di tengah periode, bagian Anda sebanding hari Anda; sisanya ditanggung kantor |
| Minus kas | Kekurangan saat Anda menutup shift ditanggung penuh. Kekurangan Rp50.000 dan kelebihan Rp20.000 di periode yang sama: dipotong Rp30.000 |
| Minus kas tanpa nama | Rp90.000, tiga orang hadir: masing-masing Rp30.000 |
| Potongan Lain | Ganti rugi Rp600.000 dicicil 3 kali: Rp200.000 per slip. Keberatan paling lambat 3 hari |
| Kasbon | Kasbon Rp250.000 dicicil 2 kali: Rp125.000 dan Rp125.000 |
| Urutan potongan dan sisa potongan | Contoh di "Urutan pengambilan" di atas: bersih Rp0, sisa kasbon Rp150.000 dibawa ke slip berikutnya |

Kartu kehilangan barang dan minus kas tanpa nama hanya tampil untuk jabatan
bertanda "ikut menanggung kehilangan barang"; kartu lain untuk semua orang
berslip bulanan, kecuali Pemilik dan GM yang melihatnya sebagai bacaan.

### 3.4 Bagian 4E-4: Buku Bonus dan Dua Dana

Disetujui pemilik 13 Oktober 2026 (B1 s.d. B6 sesuai saran); aturannya
GAJ-83 s.d. 90.

Bahan: GAJ-08, 09, 24 s.d. 35, 38, 46, 50, 58, 61, 71, 75, 82; KIN-11, 13
s.d. 17, 19 s.d. 26; LOG-76, 77; KEU-90, 100, 115; SIS-33; DRV-02 s.d. 05,
30, 84; KAR-67; PRI-20, 37, 39, 40, 41. Arsip `../../aturan/arsip/03-gaji-galian.md`
bagian 3C.

**Pokoknya:** semua bonus, dari modul mana pun, masuk **satu Buku Bonus**
lewat **satu pintu tulis di server**, "catat bonus (jenis, orang, tanggal
kejadian, cabang, dasar hitungan, asal)". Pintu itu yang menghitung nominal
dari pengaturan yang berlaku pada tanggal kejadian, menolak penerima yang
tidak berhak, dan mencegah dobel lewat kunci asal. Modul lain tidak pernah
menulis nominal sendiri (WAJ-04). Slip hanya membaca baris yang Disahkan
(GAJ-38).

#### Jenis bonus dan isi awalnya (GAJ-25, PRI-20)

| Jenis | Lahir dari | Penerima | Sumber dana | Cara disahkan | Angka aturan (isi awal) |
|---|---|---|---|---|---|
| **Grooming** | Gaji, dari jasa grooming yang sudah diambil di kasir (GAJ-61) | groomer di nota yang sudah dipasangkan; **boleh jabatan Pemilik** (GAJ-09) | Uang kantor | per groomer per periode (B2) | 10% harga jasa sesudah diskon, dibulatkan ke bawah |
| **Ongkir** | Logistik, dari baris ongkir nota kasir yang bukan gratis ongkir (LOG-76) | pengantar di nota yang sudah dipasangkan | Uang kantor | **tanpa pengesahan**; bisa dibatalkan dengan alasan (GAJ-26) | 50% ongkir sesudah diskon, dibulatkan ke bawah (LOG-77) |
| **Promo** | Kinerja, dari laporan promo yang disetujui (KIN-20, 26) | jabatan yang dibatasi target promo (KIN-19) | Uang kantor | per laporan, di tab Promo (KIN-25) | tarif per pcs dari target (milik Kinerja); lapor lewat 3 hari dipotong 50% (KIN-21) |
| **Bonus Terukur** | Kinerja, dari hasil penilaian setelah rapor ditetapkan (KIN-13, 16) | jabatan dan cabang di aturannya | dipilih per aturan (KIN-15) | per aturan per periode (B5) | nominal di aturannya (milik Kinerja) |
| **Bonus Bebas** | diketik HR, Pemilik, atau GM (GAJ-25) | semua jabatan kecuali Pemilik dan GM | dipilih per baris: Uang kantor atau Dana Disiplin (B1) | per baris oleh Pemilik atau GM (B1) | — (alasan wajib) |

- **Jenis baru** yang ditambah Pemilik atau GM selalu **jenis ketik**,
  bekerja seperti Bonus Bebas (misalnya "Bonus Lebaran" kalau kelak ada).
  Jenis yang lahir otomatis dari data hanya bisa ditambah lewat pembangunan,
  karena butuh sambungan ke modul asalnya.
- **Jabatan GM tidak menerima bonus apa pun** (KAR-67). **Jabatan Pemilik**
  hanya menerima jenis bertanda "boleh untuk jabatan Pemilik", isi awal
  hanya Grooming (GAJ-09).
- **Penerima di luar jabatan penerima** (misalnya kasir dipasangkan sebagai
  groomer padahal jabatannya tidak termasuk penerima Grooming): baris lahir
  berstatus **Ditahan**, tampil di "perlu perhatian" HR, dan baru masuk
  Persetujuan setelah jabatan penerimanya diubah atau barisnya ditolak
  dengan alasan. Uang tidak hilang diam-diam dan tidak keluar diam-diam.

#### Perjalanan satu baris bonus

```
Ditahan ─┐
         ▼
      Menunggu ──► Disahkan ──► Masuk slip (saat slip ditutup)
         │            │
         ▼            ▼
      Ditolak     Dibatalkan (alasan, sebelum slip ditutup)

Hangus: semua baris yang belum dibayar, saat pemilik menetapkan GAJ-58
```

- **Ongkir** lahir langsung **Disahkan** (tanpa pengesahan). **Promo**
  lahir **Disahkan**, karena tiap laporannya sudah diperiksa satu per satu
  (KIN-25). Grooming, Bonus Terukur, dan Bonus Bebas lahir **Menunggu**.
- **Tanggal kejadian dan periode** (GAJ-38, 28): Grooming = tanggal kucing
  diambil; Ongkir = tanggal nota; Promo = tanggal akhir periode (satu baris
  per orang per produk per periode, rincian per laporan); Bonus Terukur =
  tanggal akhir periode (satu baris per aturan per orang, rincian hari yang
  terpenuhi, KIN-16); Bonus Bebas = tanggal yang diisi. Cabang = cabang
  tempat kejadian (nota, struk, atau KIN-11).
- **Disahkan sesudah slip periodenya ditutup** (GAJ-50): masuk slip utama
  berikutnya dengan keterangan "periode [asal]".
- **Buku Upah** (DRV-84): saat baris menjadi Disahkan, server menulis satu
  baris Buku Upah jenis "Bonus" yang menunjuk baris ini; saat Dibatalkan,
  baris Buku Upah ikut dibatalkan.
- **Masuk slip mana** (B3): slip **utama** orang itu. Orang berslip utama
  bulanan: periode bulanan tanggal kejadiannya. Orang berslip utama mingguan
  (driver, kenek): minggu upah tanggal kejadiannya; bila slip minggu itu
  sudah ditutup, minggu berikutnya.

#### Perubahan dari kasir (GAJ-61, LOG-76, PRI-39, PRI-41)

- **Sebelum Disahkan** (Grooming) atau sebelum slip ditutup (Ongkir): ganti
  groomer atau pengantar, ubah harga, batal, atau retur di kasir membuat
  pintu tulis **membatalkan baris lama dan menulis baris baru** bertanda
  "berubah dari … menjadi …" (ganti groomer bertanda ⚠). Tidak ditimpa
  (PRI-02).
- **Sesudah Disahkan** (Grooming) atau sesudah masuk slip: masuk **daftar
  periksa HR** (tab "Perubahan dari kasir" di GAJ-L20) dengan nilai sebelum
  dan sesudah. HR memilih **Terima perubahan** (lahir baris koreksi bonus di
  slip berikutnya, plus atau minus) atau **Biarkan** (PRI-41 butir 1).
  Bonus milik jabatan Pemilik diputuskan Pemilik atau GM.
- **Koreksi bonus minus** (uang bonus yang harus kembali) diambil di
  kelompok (c) bersama Potongan Lain (GAJ-75), karena sifatnya uang yang
  dikembalikan, bukan disiplin. Di slip terakhir yang tidak tertampung
  menjadi Piutang Lain (GAJ-82).

#### Bonus orang yang berhenti (GAJ-30, GAJ-58; B6)

- Bonus yang sudah Disahkan masuk slip terakhirnya.
- **Slip terakhir tertahan** selama masih ada baris bonus orang itu yang
  Menunggu atau Ditahan, seperti klarifikasi absen (GAJ-43). Peringatan
  tampil di halaman periode dan di "perlu perhatian" HR.
- Bonus yang baru lahir **sesudah slip terakhir ditutup** (misalnya laporan
  promo yang disetujui terlambat): bila slip belum dibayar, Pemilik atau GM
  membuka kembali slip terakhir (GAJ-49); bila sudah dibayar, bonus dibayar
  **di luar slip** oleh Pemilik atau GM dalam satu langkah server yang
  menulis Buku Bonus, Buku Upah, dan keuangan sekaligus (GAJ-27).
- **GAJ-58** (pemilik menetapkan denda berhenti tanpa pemberitahuan): semua
  baris bonus orang itu yang belum masuk slip yang sudah dibayar menjadi
  **Hangus** dalam satu langkah, alasan tercatat; dana yang terpesan
  dilepas.

#### Dana Disiplin (GAJ-33, 34; KEU-115; SIS-33)

**Mutasi** ditulis server; tidak ada yang diketik kecuali saldo awal,
penyesuaian, dan pindah dana.

| Arah | Mutasi | Kapan |
|---|---|---|
| Masuk | Potongan telat, denda kehadiran (GAJ-74), denda driver dan kenek (DRV-30), denda berhenti tanpa pemberitahuan (GAJ-58), beserta sisa potongan dan koreksi minus jenis itu, **sebesar yang benar-benar terpotong** (GAJ-75) | Saat slip ditutup, bulanan maupun mingguan |
| Masuk | Koreksi bonus minus atas bonus yang bersumber Dana Disiplin, sebesar yang terpotong | Saat slip ditutup |
| Masuk | Pindah dari Dana Tidak Hadir (GAJ-35) | Saat Pemilik atau GM menyimpan |
| Keluar | Bonus bersumber Dana Disiplin yang masuk slip | Saat slip ditutup |
| Keluar | Koreksi plus telat atau denda (uang yang dikembalikan ke karyawan) | Saat slip ditutup |
| Masuk/keluar | Saldo awal "bawaan sistem lama" (SIS-33), sekali; penyesuaian beralasan | Saat Pemilik atau GM menyimpan |
| Dibalik | Semua mutasi sebuah slip | Saat slip itu dibuka kembali (GAJ-49) |

Potongan yang **ditiadakan** (GAJ-11, 71) dan yang **tidak tertagih** di
slip terakhir (GAJ-82) tidak pernah masuk.

**Tiga angka** di kepala GAJ-L24:

- **Saldo** = jumlah semua mutasi.
- **Terpesan** = jumlah bonus bersumber Dana Disiplin yang sudah Disahkan
  tetapi belum masuk slip yang ditutup.
- **Tersedia** = Saldo − Terpesan.

**Pengesahan bonus bersumber Dana Disiplin ditolak** bila nominalnya lebih
besar dari Tersedia, dengan pesan menyebut kekurangannya ("Dana Disiplin
tersedia Rp300.000; bonus ini Rp500.000; kurang Rp200.000"). Barisnya
**tetap Menunggu**, tidak gugur: bisa disahkan kemudian setelah dana
bertambah (slip berikutnya ditutup, atau pindah dari Dana Tidak Hadir), atau
ditolak dengan alasan. Yang disahkan terlambat masuk slip berikutnya dengan
keterangan periode asal (GAJ-50). Mutasi keluar ditulis saat slip ditutup,
sehingga Saldo tidak pernah dihitung dari perkiraan.

**Satu dana untuk perusahaan** (B4), bukan per cabang. Rincian **asal per
cabang** tetap tampil (cabang slip, GAJ-40), supaya terlihat cabang mana yang
paling banyak menyumbang.

#### Dana Tidak Hadir (GAJ-35; KEU-115)

- **Masuk:** potongan alpha, izin (termasuk izin mendadak), dan sakit,
  beserta sisa potongan dan koreksi minus jenis itu, sebesar yang terpotong,
  saat slip ditutup. **Keluar:** lembur dan kompensasi libur di slip yang
  ditutup, termasuk koreksi plus jenis itu.
- Ditampilkan **per periode per cabang** (masuk, keluar, selisih) dan
  **saldo berjalan** perusahaan sejak saldo awal (SIS-33).
- **Laporan, bukan pagar:** lembur tidak pernah ditolak karena saldo, dan
  tidak ada angka "tersedia".
- **Pindah ke Dana Disiplin:** hanya Pemilik atau GM, alasan wajib,
  nominal paling banyak saldo berjalan bila positif; satu langkah server
  menulis mutasi keluar di sini dan mutasi masuk di Dana Disiplin. Tidak
  otomatis.

#### GAJ-L20. Persetujuan Bonus

- **Tujuan:** satu tempat memutuskan semua bonus sebelum slip ditutup
  (GAJ-26).
- **Letak:** Kantor › Gaji › Persetujuan Bonus. **PC.**
- **Kepala:** pilih periode (berjalan lebih dulu; lama dimuat saat diminta),
  jumlah menunggu per tab, dan batas tutup slip periode itu.
- **Tab dan cara memutuskan** (tidak ada "Setujui semua" lintas orang,
  PRI-40 butir 1; setelah satu keputusan, tombol **Berikutnya**):
  1. **Grooming** (B2): dikelompokkan **per groomer per periode**. Tiap
     kelompok: daftar jasa (tanggal diambil, nomor nota, jasa, harga sesudah
     diskon, bonus, tanda ⚠ ganti groomer atau "berubah dari kasir"). Baris
     bertanda ⚠ diputuskan **satu per satu** dulu (**Sahkan** atau
     **Tolak**, alasan wajib untuk Tolak). Lalu satu tombol **Sahkan bonus
     grooming Rina, periode November: 23 jasa, Rp196.500**, ditahan 3 detik
     (TAM-15). Jasa yang masuk sesudah itu menjadi kelompok menunggu baru.
     Satu baris boleh dikeluarkan dari kelompok dengan **Tolak** beralasan.
  2. **Promo** (KIN-25): laporan promo **per laporan** (Setujui, Koreksi
     jumlah, Tolak). Isi kartunya ditulis di 4I. Laporan yang menunggu lebih
     dari 3 hari kerja bertanda merah.
  3. **Bonus Terukur** (B5): **per aturan per periode**. Tiap kartu: nama
     aturan, syarat, sumber dana, daftar orang yang memenuhi beserta angka
     buktinya (dari Kinerja), jumlah. Orang tertentu boleh **dikeluarkan**
     dengan alasan. Satu tombol **Sahkan aturan ini: 6 orang, Rp600.000**,
     ditahan 3 detik. Bila sumbernya Dana Disiplin, kartu menampilkan
     Tersedia; bila kurang, tombol menolak dengan menyebut kekurangannya dan
     **semua orang di aturan itu tetap menunggu bersama** (tidak ada yang
     disahkan sebagian karena siapa cepat).
  4. **Bonus Bebas**: usulan HR satu per satu (Sahkan, Tolak); hanya Pemilik
     dan GM yang punya tombol (B1).
  5. **Ongkir**: semua baris periode itu, bisa disaring "bertanda ⚠ saja".
     Satu-satunya tombol **Batalkan** (alasan wajib, sebelum slip ditutup).
  6. **Perubahan dari kasir**: daftar periksa HR (PRI-41), tombol **Terima
     perubahan** atau **Biarkan**, alasan wajib.
  7. **Ditahan**: baris yang penerimanya di luar jabatan penerima; tombol
     **Tolak** (alasan) atau tautan ke Jenis Bonus.
- **Siapa:** HR, Pemilik, GM untuk tab 1, 2, 3, 5, 6 (GAJ-26); hanya Pemilik
  dan GM untuk tab 4 (B1). Tidak ada yang memutuskan bonusnya sendiri
  (PRI-37 butir 3). Bonus jabatan Pemilik **tidak tampil** di layar HR dan
  diputuskan Pemilik atau GM yang lain (GAJ-46, 61).
- **Ditolak server** (jendela "OK, paham"): pemutus tidak berhak; bonus milik
  pemutus sendiri; Dana Disiplin tidak cukup (menyebut kekurangan); periode
  yang slipnya sudah ditutup tetap boleh disahkan (masuk slip berikutnya)
  dan pesan berhasil menyebutnya.
- **Pesan berhasil:** "Bonus grooming Rina periode November disahkan:
  Rp196.500. Masuk slip November."

#### GAJ-L21. Buku Bonus

- **Tujuan:** melihat semua baris bonus dari semua jenis di satu daftar.
- **Isi:** orang, jenis, tanggal kejadian, cabang, dasar hitungan, nominal,
  sumber dana, status, tanda, asal (tautan ke nota, laporan, atau aturan),
  pemutus, slip. Saring: periode, jenis, cabang, status, orang.
- **Tombol:** **Batalkan** (alasan wajib; baris Disahkan yang belum masuk
  slip tertutup; HR, Pemilik, GM; bonus jabatan Pemilik hanya Pemilik dan
  GM). Sesudah masuk slip tertutup hanya lewat koreksi (GAJ-50).
- **Finance** melihat **jumlah per jenis per periode** saja, tanpa nama orang
  (GAJ-46, KIN-25).
- **Unduh** Excel dibuat server (KEU-116).

#### GAJ-L22. Catat Bonus Bebas (4 langkah, TAM-07)

1. **Orang.** Hanya orang aktif atau yang slip terakhirnya belum ditutup;
   jabatan Pemilik dan GM tidak bisa dipilih.
2. **Jenis, nominal, tanggal kejadian, alasan.** Jenis ketik yang aktif
   (isi awal hanya Bonus Bebas). Nominal rupiah bulat lebih dari 0. Tanggal
   tidak boleh di masa depan. Cabang terisi penempatan orang itu pada
   tanggal itu, bisa diganti. Alasan paling sedikit 15 huruf.
3. **Sumber dana** (B1): Uang kantor atau Dana Disiplin. Untuk Dana Disiplin
   tampil Tersedia saat ini.
4. **Periksa.** Ringkasan dan masuk slip mana. Tombol **Simpan** ditahan 3
   detik.
- **Oleh HR:** usulan (jenis pengajuan "Usulan bonus"), menunggu Pemilik
  atau GM. **Oleh Pemilik atau GM:** langsung Disahkan (Dana Disiplin tetap
  diperiksa). Tidak ada yang mencatat Bonus Bebas untuk dirinya sendiri.
- **Saat Disahkan:** orangnya diberi tahu jenis, nominal, dan alasannya.

#### GAJ-L23. Jenis Bonus

- **Letak:** Pengaturan › Gaji. Memakai kerangka BER-L40 dan langkah baku
  BER-L41. **PC.**
- **Daftar:** nama, lahir dari, cara disahkan, aktif, dipakai di periode
  berjalan. Klik membuka pengaturannya (bertanggal berlaku, **hanya mulai
  tanggal 26**, GAJ-67): jabatan penerima, sumber dana (kecuali Bonus
  Terukur, yang dipilih per aturan), boleh untuk jabatan Pemilik, dan angka
  aturannya (persen grooming, persen ongkir).
- **Tambah jenis ketik:** nama, jabatan penerima, sumber dana bawaan.
- **Nonaktifkan:** ditolak selama ada baris Menunggu atau Ditahan; jenis
  otomatis (Grooming, Ongkir, Promo, Bonus Terukur) tidak bisa
  dinonaktifkan dari sini (sambungannya dimatikan di modul asal).
- Pengubah: Pemilik dan GM langsung; HR mengusulkan. Perubahan persen atau
  penerima wajib diumumkan (PRI-35).
- Contoh di bawah tiap angka dihitung server: "Jasa Rp85.000 → bonus
  Rp8.500".

#### GAJ-L24. Dana Disiplin

- **Letak:** Kantor › Gaji › Dana Disiplin & Dana Tidak Hadir, tab 1. **PC.**
- **Kepala:** Saldo, Terpesan, Tersedia (tiga angka besar).
- **Isi:** mutasi per periode (tanggal, arah, jenis mutasi, cabang asal,
  slip atau asal, nominal, saldo sesudahnya). Rincian per orang hanya untuk
  HR, Pemilik, GM; Finance melihat per jenis per cabang tanpa nama.
- **Grafik kecil** masuk dan keluar per periode, 12 periode terakhir.
- **Daftar Terpesan:** bonus yang memesan dana (orang, jenis, nominal,
  periode) — hanya HR, Pemilik, GM.
- **Tombol** (Pemilik, GM): **Sesuaikan** (GAJ-L26); **Isi saldo awal**
  hanya tampil sebelum ada mutasi lain (SIS-33).

#### GAJ-L25. Dana Tidak Hadir

- **Letak:** tab 2 halaman yang sama. **PC.**
- **Isi:** tabel per periode × cabang: masuk (alpha, izin, sakit), keluar
  (lembur, kompensasi libur), selisih; baris jumlah perusahaan; saldo
  berjalan sejak saldo awal.
- Kalimat tetap di atas tabel: "Ini laporan. Lembur dan kompensasi libur
  tetap dibayar berapa pun saldonya."
- **Tombol** (Pemilik, GM): **Pindah ke Dana Disiplin** (GAJ-L26), hanya
  bila saldo berjalan positif.

#### GAJ-L26. Pindah dan Sesuaikan Dana (3 langkah)

1. **Jenis:** Pindah Dana Tidak Hadir → Dana Disiplin; Penyesuaian Dana
   Disiplin (tambah atau kurang); Penyesuaian Dana Tidak Hadir; Saldo awal
   (sekali per dana, SIS-33).
2. **Nominal dan alasan** (paling sedikit 15 huruf). Pindah paling banyak
   saldo berjalan Dana Tidak Hadir. Penyesuaian kurang tidak boleh membuat
   Saldo Dana Disiplin di bawah Terpesan.
3. **Periksa:** saldo sebelum → sesudah. Tombol ditahan 3 detik.
- Hanya Pemilik dan GM; pemilik lain diberi tahu (KAR-73). Tidak dihapus;
  salah isi dibetulkan dengan penyesuaian baru.

#### GAJ-L27. Bonus Seseorang

- **Letak:** tab "Bonus" di GAJ-L02; bentuk yang sama di Pendapatan Saya
  (4E-5). **PC** (kantor), **HP** (karyawan).
- **Isi per periode:** baris bonus per jenis (status, nominal, tanggal,
  asal, alasan bila ditolak atau dibatalkan), jumlah yang masuk slip, dan
  **perkiraan** dari Kinerja (Bonus Terukur dan promo dengan dua
  kemungkinan tarif, KIN-16, 26) bertanda "perkiraan, belum pasti".
- Karyawan melihat semua barisnya sendiri, termasuk yang ditolak beserta
  alasannya (PRI-21). Bonus jabatan Pemilik tidak tampil untuk HR.
- Tidak ada isian; tombol **Lihat aturan** membuka kartu bonus di GAJ-L07.

#### Isi kartu Aturan Potongan (GAJ-L07) dari 4E-4

Halaman yang sama memuat kartu bonus (judulnya menjadi "Aturan Potongan dan
Bonus" di isi, menu tetap). Dihitung server dari pengaturan yang berlaku:

| Kartu | Contoh |
|---|---|
| Bonus grooming | Jasa Rp85.000 sesudah diskon: bonus 10% = Rp8.500, masuk periode tanggal kucing diambil |
| Bonus ongkir | Ongkir Rp15.000: bonus 50% = Rp7.500; gratis ongkir tidak berbonus |
| Bonus promo | Isi dari Kinerja (4I): tarif per pcs, tercapai atau belum; lapor lewat 3 hari dipotong 50% |
| Bonus Terukur | Daftar aturan yang berlaku untuk jabatan dan cabang orang itu (dari Kinerja) |
| Dana Disiplin | Uang telat dan denda yang terpotong dikumpulkan di sini dan dipakai untuk bonus, bukan untuk kantor. Saldonya tidak ditampilkan ke karyawan |

Kartu grooming dan ongkir hanya tampil untuk jabatan penerimanya.

### 3.5 Bagian 4E-5a: Tutup Slip

Bahan: GAJ-02, 36 s.d. 41, 43, 45, 47, 49 s.d. 54, 58, 82, 89; KEH-14, 69,
114, 158, 166; KAR-67, 68, 73; DRV-04, 05, 20, 22, 26, 73, 84; KEU-23, 74;
PRI-02, 04, 21, 34; `2026-10-13-waktu-dan-uang-desain.md` butir 3.
Keputusan S1 s.d. S4 (bagian 13).

**Pokoknya:** slip punya tiga tahap: **Perkiraan → Ditutup → Dibayar**
(GAJ-37). Selama Perkiraan, angka **tidak disimpan**: tiap kali diminta,
server menjalankan **satu fungsi "hitung slip (orang, periode)"** yang
memanggil hitungan kehadiran (GAJ-68), fungsi potongan dan urutan (GAJ-75),
dan baris Buku Bonus yang masuk slip itu (GAJ-86). Fungsi yang sama dipakai
halaman periode, Pendapatan Saya (4E-5c), dan langkah tutup. **Menutup =
menjalankan fungsi itu sekali lagi lalu menyimpan hasilnya baris demi
baris**, sehingga angka yang terkunci selalu sama dengan perkiraan terakhir
yang dilihat (GAJ-36, 39). Tahap Dibayar ditulis di 4E-5b.

#### Slip lahir sebagai Perkiraan

Mesin **Pembuat slip** (bagian 6) membuat satu catatan slip berstatus
Perkiraan untuk tiap orang yang slip utamanya bulanan (DRV-04) dan
ditempatkan sekurang-kurangnya sehari di periode itu, termasuk Training,
jabatan Pemilik, GM, dan orang yang sudah berhenti tetapi bekerja di periode
itu (GAJ-02). Catatan ini hanya kerangka (orang, periode, status) supaya
halaman periode tahu siapa saja yang harus ditutup; angkanya tetap dihitung
saat diminta. Satu orang satu slip bulanan per periode (kunci orang +
periode + jenis). Slip di luar slip utama (DRV-05) dan slip mingguan
memakai mesin yang sama; aturan khasnya di 4G.

#### Penahan slip (GAJ-43, 89; KAR-68; S2)

Satu fungsi server **"penahan slip (orang, periode)"** mengembalikan daftar
urusan yang menahan; dipakai halaman periode, tombol Tutup, pengingat, dan
peringatan ke karyawan (GAJ-44, 4E-5c). Penahannya **hanya** ini:

| No | Penahan | Yang menyelesaikan | Aturan |
|---|---|---|---|
| 1 | Absen di luar titik belum diputus | HR, Pemilik, GM (KEH-L tinjau) | KEH-14, 114 |
| 2 | Penjelasan (klarifikasi) Menunggu | HR, Pemilik, GM | KEH-69, 158 |
| 3 | Klaim lembur Menunggu | HR, Pemilik, GM | KEH-166 |
| 4 | Belum ada gaji berlaku di periode itu | Pemilik, GM (atau usulan HR) lewat GAJ-L03 | GAJ-04, 4E-1 |
| 5 | Slip terakhir: bonus Menunggu atau Ditahan | HR, Pemilik, GM di GAJ-L20 | GAJ-89 |
| 6 | Slip terakhir: usulan "berhenti tanpa pemberitahuan" belum diputuskan | Pemilik, GM | KAR-68 |

**Bukan penahan** (slip tetap bisa ditutup): usulan tiadakan potongan yang
belum diputuskan (menjadi "tetap dipotong", GAJ-71); keberatan potongan dan
keberatan selisih kasir yang menunggu (GAJ-78, 81); usulan potongan atau
usulan bonus yang menunggu (masuk slip berikutnya, GAJ-50); bonus menunggu
milik orang yang masih bekerja (GAJ-86). Dengan begitu setiap penahan adalah
**keputusan kantor sendiri**, dan jalan keluarnya adalah memutuskannya
(WAJ-11). **Tidak ada tutup paksa (S2).** Slip yang tertahan ditutup begitu
penahannya habis, kapan pun, lalu dibayar menyusul (4E-5b).

#### Kapan tombol Tutup aktif (S1)

- **Ditekan orang, tidak ditutup mesin.** Yang boleh: HR, Pemilik, GM
  (GAJ-45). Slip orang berjabatan bertanda "Gaji hanya terlihat Pemilik dan
  GM" (jabatan Pemilik dan GM, KAR-83) hanya ditutup Pemilik atau GM; di
  layar HR slip itu tidak ada sama sekali (bagian 3 pembuka). GM boleh
  menutup slipnya sendiri; para pemilik diberi tahu (KAR-67, 73).
- **Slip bulanan:** tombol aktif **sesudah akhir masa keberatan perkiraan**
  (pengaturan GAJ-41, isi awal tanggal 28; jadi aktif 29 pukul 00.00). Batas
  tutup (isi awal hari ke-4, tanggal 29) adalah batas pengingat, bukan pagar:
  sesudah batas, slip tetap bisa ditutup.
- **Sebelum jendela itu** hanya ada **Tutup lebih cepat** untuk slip terakhir
  (S4, di bawah).
- **Slip mingguan:** jendela dan harinya di 4G (DRV-22).
- **Pengingat:** mulai pukul 07.00 pada hari batas tutup dan setiap hari
  sesudahnya, selama periode itu masih punya slip Perkiraan, pengingat
  berantai (TAM-22) ke HR, Pemilik, GM, berisi jumlah slip yang siap dan
  daftar yang tertahan beserta penahan dan penyelesainya.

#### Tutup per orang dan "Tutup semua yang siap"

- **Per orang** dari GAJ-L29, atau **"Tutup semua yang siap"** dari GAJ-L28.
  "Semua" berarti semua slip yang terlihat oleh penekan, berstatus Perkiraan,
  tanpa penahan.
- **Tiap slip adalah satu langkah tersendiri di server** (GAJ-47): "Tutup
  semua" menjalankan langkah itu satu per satu; yang gagal tidak membatalkan
  yang lain. Hasilnya dilaporkan: berapa ditutup, berapa tertahan (siapa,
  karena apa), berapa gagal (siapa, alasannya). Yang gagal masuk "perlu
  perhatian" GM (PRI-33).
- **Dua orang menekan bersamaan:** slip dikunci satu per satu; yang kedua
  menerima "Sudah ditutup oleh [nama] pukul [jam]", bukan error.
- Slip yang **bersihnya Rp0** ditutup seperti biasa; potongannya tetap
  terkunci dan sisanya dibawa (DRV-26, GAJ-52).

#### Langkah tutup (GAJ-47; satu langkah, semua terjadi atau tidak sama sekali)

Sesaat sebelumnya server menjalankan Penghitung koreksi periode lalu dan
Penghitung pembagian untuk orang itu (bagian 6, 4E-2 dan 4E-3). Lalu, dalam
satu langkah:

1. **Periksa ulang** hak penekan, status Perkiraan, dan penahan kosong.
2. **Hitung** dengan fungsi "hitung slip".
3. **Simpan slip:** nomor (diberikan saat pertama kali ditutup), cabang dan
   jabatan orang itu pada hari terakhirnya bekerja di periode itu (GAJ-40),
   jumlah pendapatan, jumlah terpotong, bersih, versi 1, siapa dan kapan
   (GAJ-51), dan **akhir masa keberatan** (23.59 hari ke-3 sesudah tanggal
   ditutup, GAJ-42).
4. **Simpan baris slip** satu per satu (pendapatan, potongan kelompok (a)
   s.d. (d), catatan), masing-masing dengan rinciannya: tanggal kejadian
   atau periode asal, aturan dan angka yang dipakai, hitungannya, dan tautan
   ke catatan asal (GAJ-39, PRI-21).
5. **Buku Upah:** gaji tetap lahir sebagai satu baris per komponen (DRV-84);
   baris upah lain (lembur, bonus) yang masuk slip diisi nomor slipnya.
6. **Tandai sumber yang masuk slip** (diisi nomor slip): baris denda,
   peniadaan, koreksi periode lalu, bagian kehilangan, bagian minus kas,
   selisih kasir yang dibaca (lewat fungsi Keuangan 4H).
7. **Cicilan:** cicilan Potongan Lain dan cicilan kasbon (lewat fungsi
   Kasbon 4G) ditandai Terpotong atau Sebagian sebesar yang benar-benar
   terpotong.
8. **Sisa potongan:** sisa lama yang terpotong ditandai Terpotong; yang
   tidak tertampung ditulis sebagai sisa baru berstatus Dibawa, dengan jenis
   dan periode asal (GAJ-75).
9. **Slip terakhir:** yang tetap tidak tertampung ditulis Tidak tertagih
   (kelompok a) atau dikirim ke Buku Piutang Lain satu baris per jenis
   (kelompok b, c, d; KEU-74, GAJ-82). Untuk GAJ-58: baris denda berhenti
   tanpa pemberitahuan.
10. **Mutasi dana:** Dana Disiplin dan Dana Tidak Hadir ditulis sebesar yang
    benar-benar terpotong dan dibayar (GAJ-87, 88).
11. **Bonus:** baris Buku Bonus yang masuk slip menjadi "Masuk slip"; dana
    terpesan berubah menjadi mutasi keluar (langkah 10).
12. **Usulan tiadakan yang belum diputuskan** untuk orang dan periode itu
    menjadi "Tetap dipotong" (GAJ-71).
13. **Kehadiran:** catatan hari kerja orang itu di periode itu dikunci;
    perubahan sesudahnya menjadi koreksi susulan (PRI-04, GAJ-72).
14. **Jejak dan pemberitahuan:** satu baris `langkah_slip` dengan ringkasan
    akibatnya (berapa baris, mutasi, cicilan); orangnya diberi tahu bahwa
    slipnya ditutup dan sampai kapan boleh keberatan.

#### Buka kembali (GAJ-49; S3)

- **Siapa:** **Pemilik atau GM saja**, dengan alasan wajib (paling sedikit
  15 huruf), tombol ditahan 3 detik. Tidak ada yang membuka kembali slipnya
  sendiri kecuali GM (sejalan GAJ-62); para pemilik diberi tahu (KAR-73).
  HR **tidak** bisa membuka kembali, dan ini batas keras (bagian 5); HR
  memakai tombol **Minta buka kembali** (alasan wajib) yang masuk Antrean
  Pemilik dan GM.
- **Syarat** (ditolak server bila tidak terpenuhi, dengan menyebut sebabnya):
  (a) slip berstatus Ditutup, belum Dibayar; (b) **belum ada slip utama
  berikutnya milik orang yang sama yang sudah ditutup**, karena sisa
  potongan dan koreksinya sudah terbawa ke sana; (c) untuk slip terakhir,
  **Piutang Lain yang lahir darinya belum punya cicilan masuk**. Yang tidak
  memenuhi syarat dikoreksi di slip berikutnya (GAJ-49, PRI-04), atau untuk
  mantan karyawan lewat Piutang Lain (KEU-74).
- **Pembalikan dalam satu langkah**, kebalikan langkah 3 s.d. 13: baris slip
  versi itu berstatus Diganti versi (tidak dihapus); baris gaji tetap di Buku
  Upah Dibatalkan, tautan slip lain dikosongkan; cicilan kembali Terjadwal;
  sisa baru dari slip ini Dibatalkan dan sisa lama kembali Dibawa; Piutang
  Lain dan Tidak tertagih dibalik; mutasi dana slip ini berstatus Dibalik
  (GAJ-87); bonus kembali Disahkan (dan memesan dana lagi); usulan "Tetap
  dipotong" dari langkah 12 kembali Menunggu; kunci catatan hari kerja
  dibuka. Slip kembali Perkiraan dengan **nomor yang sama** dan versi
  berikutnya.
- **Akibat ke Dana Disiplin:** pembalikan boleh membuat Saldo di bawah
  Terpesan. Langkah tidak ditolak karena itu (membetulkan slip lebih penting);
  Tersedia tampil minus di GAJ-L24, pengesahan bonus baru bersumber dana
  ditolak sampai cukup, dan keadaan ini masuk "perlu perhatian" Pemilik dan
  GM.
- **Ke karyawan:** pemberitahuan "Slip [periode] sedang dibetulkan:
  [alasan]". Di portal yang tampil kembali perkiraan, bertanda "sedang
  dibetulkan"; versi lama hanya terlihat kantor (riwayat di GAJ-L29).
- **Ditutup ulang:** langkah tutup biasa; versi baru; masa keberatan dihitung
  ulang dari tanggal tutup yang baru.

#### Slip terakhir (GAJ-53, 58, 82, 89; S4)

- **Dihitung sampai hari terakhir bekerja** (tanggal berhenti dari Karyawan),
  prorata menurut GAJ-06. Penahan 5 dan 6 hanya berlaku untuk slip ini.
- **Jadwal biasa:** ditutup bersama periode itu.
- **Tutup lebih cepat** (S4): **Pemilik atau GM** menekan tombol ini di
  GAJ-L29, alasan wajib, ditahan 3 detik. Boleh **mulai pukul 00.00 sesudah
  hari terakhir bekerja**, dan hanya bila penahan kosong. Langkahnya sama
  dengan langkah tutup. Masa keberatan 3 hari sejak ditutup. Seluruh sisa
  kasbon dan Potongan Lain ditagih di slip ini (GAJ-82, DRV-73).
- **Yang muncul sesudah ditutup:** kehilangan barang yang ditemukan
  belakangan di periode itu tetap dibagi menurut orang periode itu, dan
  bagian orang yang sudah tidak punya slip berikutnya ditanggung kantor
  (GAJ-77); koreksi absen dan bonus susulan: bila slip belum dibayar, slip
  dibuka kembali; bila sudah dibayar, koreksi plus atau bonus dibayar di luar
  slip (GAJ-89, 4E-5b), koreksi minus menjadi Piutang Lain.
- **GAJ-58:** penetapan "tanpa pemberitahuan" diputuskan sebelum slip
  ditutup (penahan 6). Bila ditetapkan, fungsi hitung slip menulis baris
  denda (GAJ-82) dan bonus yang belum dibayar menjadi Hangus (GAJ-89).

#### Bentuk slip dan nomor (GAJ-54, 39, 21)

Satu bentuk dipakai GAJ-L29 (kantor), Pendapatan Saya (4E-5c), dan cetakan
(GAJ-L32). Isinya diambil dari baris tersimpan; selama Perkiraan dari fungsi
hitung slip, bertanda "Perkiraan, belum final".

1. **Kepala:** nomor, nama, jabatan dan cabang (yang tersimpan), periode,
   status dan tanggalnya, versi bila lebih dari 1.
2. **Pendapatan:** gaji tetap per komponen (dan prorata bila ada), lembur,
   kompensasi libur, bonus per jenis, koreksi plus; tiap baris dengan
   periode asal bila bukan periode ini.
3. **Potongan** menurut urutan kelompok (a) s.d. (d), tiap baris dengan tiga
   angka: **nominal, terpotong, sisa dibawa**. Baris yang ditiadakan tetap
   tampil bertanda "ditiadakan" dan alasannya (GAJ-11).
4. **Bersih** = jumlah pendapatan − jumlah terpotong; tidak pernah minus.
   Jumlah baris selalu sama dengan bersih (GAJ-54).
5. **Catatan:** sisa potongan yang dibawa ke slip berikutnya, keberatan
   sampai kapan, dan (4E-5b) dibayar tanggal berapa lewat apa.
- Tiap baris bisa dibuka untuk melihat rinciannya (PRI-21).
- **Nomor:** `SB-[tahun][bulan]-[urut 4 angka]` untuk bulanan (bulan = bulan
  akhir periode, GAJ-01) dan `SM-[tanggal Kamis akhir minggu upah]-[urut]`
  untuk mingguan; diberikan saat pertama kali ditutup, urut per periode,
  tidak berubah saat dibuka dan ditutup ulang.

#### GAJ-L28. Periode Slip (halaman satu periode)

- **Letak:** klik baris di GAJ-L08 (Kantor › Gaji › Periode Slip). Satu
  layar untuk bulanan dan mingguan (menu butir 8). **PC.**
- **Kepala:** nama periode, tanggal, status periode (dibaca dari slipnya,
  PRI-34), akhir masa keberatan, batas tutup, tanggal bayar; empat angka:
  Perkiraan, Tertahan, Ditutup, Dibayar.
- **Tab:**
  1. **Slip:** satu baris per orang: nama, jabatan, cabang, status slip,
     pendapatan, terpotong, bersih, tanda (tertahan, slip terakhir, versi 2+,
     ada sisa dibawa). Saring menurut status, cabang, jabatan. Klik membuka
     GAJ-L29.
  2. **Tertahan:** satu baris per orang per penahan: penahan, sejak kapan,
     penyelesai, tombol **Buka urusannya** (langsung ke layar penyelesai).
  3. **Tiadakan Potongan:** GAJ-L10 untuk periode ini.
  4. **Koreksi Periode Lalu:** GAJ-L11 untuk periode ini.
  5. **Ringkasan:** GAJ-L38 (4E-5b).
  6. **Riwayat:** semua `langkah_slip` periode ini (siapa, kapan, apa,
     alasan).
- **Tombol:** **Tutup semua yang siap (n)** membuka GAJ-L30. Sebelum jendela
  tutup tombolnya mati dengan keterangan "Aktif mulai [tanggal] 00.00".
- Admin HR dan Finance tidak membuka halaman ini; mereka hanya melihat baris
  periode di GAJ-L08 (tanggal dan status). Finance membuka Ringkasan bentuk
  Finance dari baris itu (GAJ-L38, 4E-5b).

#### GAJ-L29. Slip

- **Letak:** dari GAJ-L28 tab Slip, dan tab "Slip" di GAJ-L02 (daftar slip
  orang itu per periode, periode lama dimuat saat diminta, PRI-11). **PC.**
- **Isi:** bentuk slip di atas. Bila tertahan: kotak penahan di atas slip
  (sama dengan tab Tertahan, hanya orang ini).
- **Tombol menurut keadaan:** **Tutup** (GAJ-L30 untuk satu slip); **Tutup
  lebih cepat** (slip terakhir, Pemilik dan GM); **Buka kembali** (GAJ-L31,
  Pemilik dan GM); **Minta buka kembali** (HR); **Cetak** (GAJ-L32, hanya
  slip tertutup); **Bayar** (GAJ-L34) dan **Batal bayar** (GAJ-L35), Pemilik
  dan GM (4E-5b). Slip Dibayar menampilkan tanggal uang, tempat uang,
  pembayar, dan asal pembayarannya.
- **Riwayat versi:** versi lama bisa dibuka (hanya baca), lengkap dengan
  alasan pembukaannya.

#### GAJ-L30. Tutup Slip (3 langkah, TAM-07)

1. **Yang akan ditutup:** daftar slip siap (atau satu slip), jumlah orang,
   jumlah bersih; daftar yang tertahan ditampilkan terpisah dengan
   keterangan "tidak ikut ditutup".
2. **Periksa:** hal yang perlu diketahui sebelum mengunci: usulan tiadakan
   yang akan menjadi "tetap dipotong", orang yang bersihnya Rp0, orang yang
   punya sisa dibawa, slip terakhir yang melahirkan Piutang Lain.
3. **Tutup:** tombol ditahan 3 detik (TAM-15). Hasil: berapa ditutup,
   tertahan, gagal (dengan nama dan sebab).
- Untuk **Tutup lebih cepat** langkah 1 menampilkan juga tanggal terakhir
  bekerja dan isian alasan.

#### GAJ-L31. Buka Kembali Slip (3 langkah)

1. **Slip:** nomor, orang, periode, versi; bila syarat tidak terpenuhi,
   berhenti di sini dengan menyebut sebabnya dan jalan keluarnya (koreksi di
   slip berikutnya atau Piutang Lain).
2. **Alasan** (paling sedikit 15 huruf) dan **akibatnya**, dalam kalimat:
   berapa cicilan kembali terjadwal, mutasi dana yang dibalik dan saldo
   sesudahnya, bonus yang kembali Disahkan, Piutang Lain yang dibalik.
3. **Buka kembali:** tombol ditahan 3 detik.
- Hanya Pemilik dan GM. Bila datang dari "Minta buka kembali", alasan HR
  terisi lebih dulu dan boleh diubah.

#### GAJ-L32. Cetakan Slip

- Bentuk slip yang sama, ukuran A4 tegak, satu slip satu halaman (lebih
  bila barisnya banyak), dengan nomor, versi, dan tanggal cetak dari server.
- **Hanya slip tertutup** (GAJ-54); server menolak mencetak Perkiraan.
- Unduh sebagai PDF. Tiap cetak dan unduh dicatat (siapa, kapan).
- Cetak beberapa slip sekaligus dari GAJ-L28 (satu PDF, satu slip per
  halaman) untuk HR, Pemilik, GM.
- Dari sisi karyawan: 4E-5c.

### 3.6 Bagian 4E-5b: Bayar

**Disetujui penuh 13 Oktober 2026** (Y1 s.d. Y5 "ok", sesuai saran). Isi di bawah
ditulis memakai saran itu; aturannya GAJ-98 s.d. 106 (bagian 3.13 `../../aturan/03-gaji.md`).

Bahan: GAJ-27, 37, 45, 46, 48, 49, 51, 55, 56, 59, 89, 96; DRV-22, 25, 26,
27, 47, 81; KEU-02, 05, 06, 11, 12, 16, 18, 23, 24, 27, 33, 69, 74, 90, 101,
109, 112, 114, 118; KAR-66, 67, 73, 77, 80, 83; TAM-15, 22, 24, 25;
`2026-10-13-waktu-dan-uang-desain.md` butir 3 dan jawaban D1.

**Pokoknya:** slip yang sudah **Ditutup** menjadi **Dibayar** lewat satu
langkah di server yang menyimpan tanggal uang, pembayar, tempat uang, dan
satu baris Buku Kas sekaligus (GAJ-48, KEU-24). Yang menandai Dibayar hanya
**Pemilik atau GM** (GAJ-45, D1). Di lapangan gaji dibayar sesudah ACC lisan
dan menandainya sering terlupa (GAJ-59), jadi bagian ini juga menyediakan
**Jadwal Bayar** dan pengingat berantai sampai semua ditandai.

#### Langkah bayar (GAJ-48, KEU-24, DRV-26; satu langkah per slip)

Pemilik atau GM memilih satu atau beberapa slip di Jadwal Bayar (GAJ-L33)
atau satu slip di GAJ-L29, lalu GAJ-L34. Beberapa slip boleh dibayar
sekaligus dari **satu tempat uang**; tiap slip tetap punya pembayaran dan
baris Buku Kasnya sendiri (KEU-24). Seperti "Tutup semua", **tiap slip satu
langkah tersendiri**: yang gagal tidak membatalkan yang lain, dan hasilnya
menyebut berapa dibayar dan siapa yang gagal beserta sebabnya.

Dalam satu langkah:

1. **Periksa:** penekan Pemilik atau GM; bukan slipnya sendiri, kecuali GM
   (para pemilik diberi tahu; sejalan GAJ-95); slip berstatus Ditutup; belum
   ada pembayaran Berlaku (tidak bisa dibayar dua kali); bersih lebih dari
   Rp0 (slip Rp0: GAJ-102 di bawah); tempat uang dipilih (KEU-05).
2. **Tanggal uang** (Y1): isian awal hari ini; boleh dipilih mundur sampai
   7 hari (lebih jauh dengan alasan, sejalan KEU-12), tidak boleh sebelum
   tanggal slip ditutup dan tidak boleh masa depan. Jam catat selalu dari
   server (PRI-01).
3. **Simpan pembayaran:** slip, kelompok bayar, tanggal uang, jam catat,
   pembayar, tempat uang, cara (tunai bila tempat uangnya Brankas atau Kas
   Pegangan, transfer bila rekening), nominal = **bersih slip** (sekali dan
   penuh; tidak ada isian nominal), foto bukti (KEU-11, isi awal dianjurkan;
   satu foto boleh dipakai untuk satu kelompok, misalnya tangkapan layar
   transfer massal).
4. **Baris Buku Kas** lewat fungsi Keuangan (4H) "tulis uang keluar dari
   modul" (KEU-23): satu baris per slip, sebesar bersih, kejadian **Bayar
   gaji** (slip jabatan bertanda "Gaji hanya terlihat Pemilik dan GM":
   kejadian **Gaji pemilik dan GM**, KEU-114), cabang yang dibebani =
   **cabang tersimpan di slip** (GAJ-40), uraian dari slip (bagian
   "Ringkasan" di bawah). Akibat lanjutannya milik Keuangan, misalnya gaji
   karyawan toko yang dibayar dari Brankas menambah utang toko itu ke Gudang
   (KEU-69).
5. **Slip** menjadi Dibayar; `langkah_slip` "dibayar" (GAJ-51). Bila semua
   slip periode itu Dibayar, status periode menjadi Lunas (dibaca dari slip,
   PRI-34).
6. **Pemberitahuan** ke orangnya: "Gaji [periode] dibayar tanggal … lewat
   tunai/transfer" (KEU-24); yang merasa belum menerima memakai keberatan
   slip (4E-5c). GM membayar slipnya sendiri: para pemilik diberi tahu.

Dua penekan bersamaan: slip dikunci satu per satu; yang kedua menerima
"Sudah dibayar oleh [nama] pukul [jam]", bukan error. Bayar **tidak
ditolak karena saldo** tempat uang; penjaga saldo milik Keuangan (KEU-106).
Membayar **sebelum** tanggal bayar periode boleh (misalnya slip terakhir yang
ditutup lebih cepat, GAJ-96).

#### Catatan Cepat "Gaji/Upah" yang dipasangkan ke slip (Y3; KEU-18, 27)

Kalau uangnya dicatat dulu lewat kotak **Gaji/Upah** di Catatan Cepat
(misalnya Ibu mengambil uang tunai dari Brankas untuk gajian), finance
**memasangkannya** ke slip yang dibayar dengan uang itu, bukan mencatat
lagi (KEU-18). Pemasangan ini menjalankan **langkah bayar yang sama**
dengan pembayar = **pencatat Catatan Cepat** (yang harus Pemilik atau GM,
atau finance atas nama mereka dengan lampiran pesannya, KEU-27), tempat uang
dan tanggal uang dari catatan itu, dan baris Buku Kas **adalah catatan itu
sendiri** (tetap satu baris per kejadian uang; uraian slip ditautkan).
Syarat: jumlah bersih slip yang dipasangkan **sama persis** dengan nominal
catatan; bila tidak sama, pencatat membetulkan nominalnya (KEU-33) atau
sisanya dicatat kembali sebagai uang masuk. Catatan Cepat yang pencatatnya
bukan Pemilik atau GM tidak bisa menjadi pembayaran gaji (KEU-18: menjadi
Pribadi, Bantuan, atau ditanyakan). Layar memasangkan milik Keuangan (4H).

#### Slip bersih Rp0 (GAJ-102; Y4)

Slip yang bersihnya Rp0 (seluruh pendapatan terpakai potongan) **langsung
menjadi Dibayar saat ditutup**, bertanda "tanpa uang", tanpa baris Buku Kas
dan tanpa masuk Jadwal Bayar. Tidak ada uang yang bergerak, jadi tidak ada
yang perlu ditandai orang; tanpa ini periode tidak pernah Lunas dan
pengingat tidak berhenti. Di portal tampil "Tidak ada uang yang dibayarkan:
seluruhnya terpakai potongan" beserta sisa yang dibawa.

#### Batal bayar (GAJ-49, KEU-16, 23)

- **Siapa:** Pemilik atau GM, alasan wajib (paling sedikit 15 huruf),
  tombol ditahan 3 detik; tidak untuk slipnya sendiri kecuali GM; para
  pemilik diberi tahu (KAR-73). HR dan Finance tidak bisa (batas keras).
- **Kapan:** selama pembayaran Berlaku, tanpa batas waktu. Batal bayar tidak
  mengubah isi slip, jadi tidak terhalang slip berikutnya yang sudah ditutup.
- **Akibat dalam satu langkah:** pembayaran Dibatalkan (tidak dihapus);
  baris Buku Kas dibatalkan lewat fungsi Keuangan (KEU-23; bila bulan
  keuangannya sudah ditutup, pembatalan tampil sebagai baris koreksi di bulan
  berjalan, KEU-112); bila asalnya Catatan Cepat yang dipasangkan,
  **pasangannya dilepas** dan catatan itu kembali "belum dipasangkan" di
  daftar finance (uangnya tetap sudah keluar); slip kembali **Ditutup** dan
  muncul lagi di Jadwal Bayar sebagai "lewat"; periode kembali dari Lunas ke
  Ditutup; `langkah_slip` "pembayaran dibatalkan"; orangnya diberi tahu
  "Pembayaran gaji [periode] dibatalkan: [alasan]".
- **Sesudahnya:** dibayar ulang dengan langkah bayar biasa; atau, bila isi
  slip yang salah dan syarat GAJ-95 terpenuhi, dibuka kembali.

#### Jadwal Bayar (DRV-81, GAJ-59, DRV-27)

Satu daftar untuk semua yang harus dibayar, dari semua jalur:

| Jalur | Jatuh bayar | Pembayar | Bagian |
|---|---|---|---|
| Slip bulanan Ditutup belum Dibayar | tanggal bayar periode, atau **tanggal slip ditutup** bila lebih lambat (slip tertahan yang ditutup menyusul) | Pemilik, GM | 4E-5b |
| Slip mingguan Ditutup belum Dibayar | Sabtu (DRV-22), atau tanggal ditutup bila lebih lambat | Pemilik, GM | 4G |
| Laporan Bongkaran disahkan belum dibayar | hari itu (DRV-47) | Finance, Pemilik, GM | 4G |
| Bayar di luar slip (bonus susulan, koreksi plus mantan karyawan) | hari lahirnya | Pemilik, GM | 4E-5b |

Kelompok tampilan: **Lewat** (dengan berapa hari), **Hari ini**, **7 hari
ke depan**, dan baris keterangan "**n slip belum bisa dibayar: masih
tertahan**" (menuju tab Tertahan GAJ-L28). Slip Rp0 tidak tampil (Y4).

#### Pengingat belum Dibayar (GAJ-59, DRV-27; TAM-22, 24, 25)

Mulai **pukul 07.00 hari sesudah jatuh bayar**, setiap hari, selama masih
ada yang lewat jatuh bayar dan belum ditandai Dibayar: pengingat berantai
ke Pemilik dan GM, satu jendela per jalur (TAM-25 butir 4), misalnya "Ada 38
slip November belum ditandai Dibayar, paling lama sejak 1 Desember". Tanggal
bayar tidak digeser untuk Minggu, tanggal merah, atau hari tutup (GAJ-59).
Lolos TAM-24 butir 1: slip yang tidak ditandai membuat portal karyawan tetap
"belum dibayar" dan Keuangan tetap mencatatnya sebagai kewajiban (KEU-90).
Bongkaran yang belum dibayar diingatkan ke Finance juga (4G).

#### Daftar Transfer untuk Finance (Y2; pelapis GAJ-46)

Di lapangan gaji diproses selama finance tidak libur (jawaban D1). Supaya
finance bisa mentransfer **tanpa melihat slip**, finance mendapat **Daftar
Transfer** (GAJ-L36): untuk slip yang **Ditutup dan belum Dibayar** saja,
satu baris per orang berisi nama, bank, nomor rekening lengkap, nama pemilik
rekening, dan **bersih**. Tidak ada rincian slip, pendapatan, potongan, atau
slip yang sudah Dibayar; orang berjabatan bertanda "Gaji hanya terlihat
Pemilik dan GM" tidak tampil sama sekali (dibayar Pemilik atau GM sendiri).
Tiap pembukaan dan unduhan dicatat. Finance **tidak** menandai Dibayar;
yang menandai Pemilik atau GM (GAJ-45), atau lewat Catatan Cepat yang
dipasangkan (Y3). Orang tanpa rekening (KAR-80) bertanda "Belum ada
rekening: bayar tunai atau lengkapi rekening".

#### Ringkasan (GAJ-46, 55, 56; tab 5 GAJ-L28)

Dibaca dari `baris_slip` yang tersimpan, **tidak dihitung ulang** (GAJ-55);
slip Perkiraan tidak ikut (yang tampil hanya jumlah orangnya). Satu fungsi
server **"ringkasan gaji (periode, sudut pandang)"** dipakai GAJ-L38 dan
Keuangan (WAJ-04). Isinya:

1. Jumlah slip per status (Perkiraan, Tertahan, Ditutup, Dibayar).
2. **Pendapatan** per jenis: gaji tetap, lembur, kompensasi libur, bonus per
   jenis (dan per sumber dana), koreksi plus.
3. **Terpotong** per kelompok: (a) telat, tidak hadir, denda; (b) kehilangan
   barang, minus kas; (c) Potongan Lain, koreksi bonus minus; (d) kasbon
   kembali. Ditambah: sisa dibawa ke periode berikutnya, Piutang Lain yang
   lahir, tidak tertagih.
4. **Dana:** Dana Disiplin masuk dan keluar dari slip periode ini; Dana Tidak
   Hadir masuk dan keluar.
5. **Bersih:** jumlah, sudah dibayar per tempat uang, belum dibayar, tanpa
   uang (slip Rp0). Selalu: pendapatan − terpotong = bersih = dibayar +
   belum dibayar + Rp0.
6. Per cabang (cabang tersimpan, GAJ-40), dengan baris terpisah **"Gaji
   pemilik dan GM"** (KEU-114).

**Sudut pandang:**

| Yang membuka | Isi |
|---|---|
| Pemilik, GM | Semua butir, termasuk per cabang dan baris "Gaji pemilik dan GM" |
| HR | Semua butir untuk lingkupnya; jabatan bertanda tidak ikut dan tidak disebut (GAJ-46) |
| Finance | Butir 1, 2, 3, 5 untuk **seluruh perusahaan saja** (tanpa per cabang, karena cabang kecil membocorkan gaji perorangan), **tanpa** jabatan bertanda, dengan keterangan "tidak termasuk gaji Pemilik dan GM"; tanpa butir 4 (dana dilihat di GAJ-L24, L25 tanpa nama) |
| Admin HR | Tidak ada (KAR-77) |

**Uraian ke Keuangan (GAJ-56):** Keuangan membaca fungsi yang sama per slip
dan per periode: saat slip **ditutup** (beban gaji dibebankan ke bulan akhir
periode, KEU-109; slip tertutup belum dibayar sebagai kewajiban, KEU-90;
Perkiraan Kas memakai bersih yang belum dibayar, KEU-101) dan saat slip
**dibayar** (uraian di baris Buku Kas, KEU-06). Keuangan tidak menghitung
sendiri. Cara Keuangan memakainya ditulis di 4H.

**Isi uraian (ditambah 4J-4, memenuhi KEU AA1):** fungsi uraian per slip
memisahkan empat kelompok, masing-masing satu angka: (1) pendapatan slip;
(2) potongan tidak hadir dan telat (tidak masuk dana mana pun); (3) denda yang
masuk Dana Disiplin atau Dana Tidak Hadir; (4) pelunasan (kasbon, Piutang
Lain, sisa potongan) dipisah dari ganti rugi (Potongan Lain jenis ganti rugi
dan bagian kehilangan barang yang terpotong). Keuangan hanya membaca keempat
kelompok ini; tidak menebak dari nama komponen.

#### Bayar di luar slip (GAJ-89, 96; Y5)

Hanya untuk orang yang **slip terakhirnya sudah Dibayar** dan tidak punya
slip berikutnya: bonus yang disahkan sesudahnya (GAJ-89) dan koreksi plus
(koreksi periode lalu, keberatan potongan yang Ditiadakan, keberatan slip;
GAJ-96). Koreksi minus untuk orang itu menjadi Piutang Lain (GAJ-96).

- **Lahir otomatis** sebagai satu tagihan "bayar di luar slip" berstatus
  Menunggu bayar, tampil di Jadwal Bayar dan GAJ-L27; satu tagihan per asal
  (kunci asal mencegah dobel).
- **Dipotongkan ke Piutang Lain lebih dulu** (Y5): bila orang itu masih
  punya Piutang Lain yang belum lunas, nominal tagihan lebih dulu
  **mengurangi piutang itu** (dicatat sebagai cicilan Piutang Lain tanpa uang
  bergerak, lewat fungsi Keuangan 4H); hanya sisanya yang dibayar dengan uang.
  Bila habis terpakai, tagihan langsung Dibayar bertanda "dipotongkan ke
  piutang".
- **Bayar** (GAJ-L37): Pemilik atau GM, tempat uang, tanggal uang (Y1),
  tombol ditahan 3 detik. Satu langkah: tagihan Dibayar; baris Buku Bonus
  menjadi **Dibayar di luar slip** (baris Buku Upah yang lahir saat disahkan
  diisi tautan pembayarannya, DRV-84); bonus bersumber Dana Disiplin menulis
  mutasi keluar saat ini, bukan saat tutup (GAJ-87); baris Buku Kas kejadian
  Bayar gaji, cabang = cabang bonus atau cabang slip asal koreksi.
- **Batal bayar:** seperti batal bayar slip; cicilan Piutang Lain tanpa uang
  dibalik; mutasi dana Dibalik; tagihan kembali Menunggu bayar.
- **GAJ-58:** orang yang dikenai denda berhenti tanpa pemberitahuan tidak
  pernah punya tagihan bonus di sini (bonusnya Hangus, GAJ-89).

#### GAJ-L33. Jadwal Bayar

- **Letak:** Kantor › Gaji › Jadwal Bayar. **PC** (Pemilik dan GM sering
  dari HP: daftar tetap terbaca di HP, tombol Bayar ada di keduanya).
- **Kepala:** tiga angka: Lewat (jumlah dan rupiah), Hari ini, 7 hari ke
  depan.
- **Daftar** dikelompokkan per jalur dan per periode atau minggu upah: satu
  baris kelompok (misalnya "Slip November: 38 slip, Rp…, jatuh 1 Desember,
  lewat 2 hari") yang bisa dibuka menjadi baris per orang (nama, cabang,
  bersih, rekening empat angka terakhir, tanda "Belum ada rekening").
  Saring menurut jalur, cabang, status.
- **Tombol:** centang per baris atau per kelompok, lalu **Bayar terpilih
  (n, Rp…)** membuka GAJ-L34. Baris bongkaran membuka layar bayar bongkaran
  milik 4G.
- **Finance:** hanya jalur bongkaran (dengan tombol bayarnya, 4G) dan satu
  baris jumlah per periode slip ("Slip November: 38 slip, Rp…, belum
  ditandai Dibayar") tanpa nama, dengan tombol ke Daftar Transfer (GAJ-L36).
- HR dan Admin HR tidak membuka layar ini.

#### GAJ-L34. Bayar Slip (3 langkah, TAM-07)

1. **Yang dibayar:** daftar slip terpilih (nama, periode, bersih), jumlah
   orang dan jumlah rupiah; slip yang tidak bisa dibayar (sudah Dibayar,
   bukan Ditutup, slipnya sendiri) tampil terpisah "tidak ikut".
2. **Dari mana dan kapan:** tempat uang (daftar KEU-02 yang boleh dipakai
   penekan), tanggal uang (isian awal hari ini; Y1), foto bukti (dianjurkan,
   satu untuk kelompok atau per slip).
3. **Bayar:** ringkasan dalam kalimat ("38 slip, Rp…, dari Brankas, tanggal
   1 Desember"), tombol ditahan 3 detik (TAM-15). Hasil: berapa dibayar,
   berapa gagal (nama dan sebab).

#### GAJ-L35. Batal Bayar (3 langkah)

1. **Pembayaran:** slip, orang, nominal, tanggal uang, tempat uang,
   pembayar, asal (tombol Bayar atau Catatan Cepat).
2. **Alasan** (paling sedikit 15 huruf) dan **akibatnya** dalam kalimat:
   baris Buku Kas dibatalkan, pasangan Catatan Cepat dilepas (bila ada),
   slip kembali Ditutup dan masuk Jadwal Bayar.
3. **Batalkan:** tombol ditahan 3 detik.
- Dari GAJ-L29 (tombol **Batal bayar**, slip Dibayar) dan dari tagihan bayar
  di luar slip. Hanya Pemilik dan GM.

#### GAJ-L36. Daftar Transfer (Y2)

- **Letak:** dari GAJ-L33 (baris jumlah per periode). **PC.**
- **Isi:** per periode atau minggu upah, slip Ditutup belum Dibayar: nama,
  bank, nomor rekening lengkap, nama pemilik rekening, bersih; jumlah.
  Tanpa jabatan bertanda. Diurutkan per bank supaya mudah ditransfer.
- **Unduh** Excel untuk transfer massal (dibuat server, bertanggal dan
  bernama pembuat, KEU-116). Tiap buka dan unduh dicatat.
- **Dipakai:** Finance, Pemilik, GM. Tanpa tombol Bayar.

#### GAJ-L37. Bayar di Luar Slip (3 langkah)

1. **Tagihan:** orang (mantan karyawan), asal (bonus jenis apa, periode
   asal; atau koreksi apa), nominal, Piutang Lain yang masih ada dan berapa
   yang dipotongkan (Y5), **sisa yang dibayar dengan uang**.
2. **Dari mana dan kapan:** tempat uang, tanggal uang, foto bukti. Bila sisa
   Rp0, langkah ini dilewati.
3. **Bayar:** tombol ditahan 3 detik.
- Dari GAJ-L33 dan GAJ-L27. Hanya Pemilik dan GM.

#### GAJ-L38. Ringkasan Gaji

- **Letak:** tab 5 "Ringkasan" di GAJ-L28 (HR, Pemilik, GM); untuk Finance,
  klik baris periode di GAJ-L08 membuka bentuk Finance (tanpa nama, tanpa
  per cabang). **PC.**
- **Isi:** butir 1 s.d. 6 di atas menurut sudut pandang; tiap angka bisa
  dibuka sampai daftar slip (Pemilik, GM, HR) atau tidak bisa dibuka
  (Finance).
- **Unduh** Excel dan PDF (KEU-116), memuat sudut pandang pembuatnya.

### 3.7 Bagian 4E-5c: Sisi Karyawan

**Disetujui penuh 14 Oktober 2026** (C1 s.d. C5 "ok", sesuai saran). Ditulis saat pemilik
tidur atas permintaannya ("langsung kerjakan 2-3 sesi"), memakai saran
Claude untuk C1 s.d. C5 (bagian 13). Aturannya GAJ-107 s.d. 114 (bagian 3.14
`../../aturan/03-gaji.md`).


Bahan: GAJ-02, 36, 37, 41, 42, 44, 46, 54, 60, 63, 72, 91, 93, 96, 97, 102,
106; DRV-03, 05, 20, 22, 28, 45, 48, 80, 84; KEU-24, 116; KAR-07, 34, 67, 68,
69, 77, 83; KEH-119, L17, L35, L36; PRI-11, 21, 24, 34 butir 5, 37; BER-L01,
L04 s.d. L07, L20, L21.

**Pokoknya:** karyawan melihat semua uangnya di **satu halaman** tanpa
bertanya ke HR: berapa perkiraannya, apa yang bisa membuatnya mundur, slip
yang sudah ditutup baris demi baris, kapan dan lewat apa dibayar, dan satu
jalan bila ada yang salah. Semua angka datang dari tempat yang sama dengan
layar kantor: Perkiraan dari fungsi "hitung slip (orang, periode)", slip
tertutup dari `baris_slip` tersimpan (GAJ-91). Angka karyawan dan angka HR
tidak pernah berbeda.

#### Pendapatan Saya: satu halaman per periode (C1; DRV-80, PRI-34 butir 5)

- Satu halaman per **periode 26–25**. Periode berjalan tampil lebih dulu;
  periode lama dipilih dari daftar dan dimuat saat diminta (PRI-11).
- **Semua jalur dalam satu halaman** (DRV-03): slip bulanan, slip mingguan,
  bongkaran (tunai hari itu), dan bayar di luar slip (GAJ-106) bila ada.
- **Tempat slip mingguan** (C1): satu slip mingguan tampil **utuh di
  periode tempat Kamis akhir minggu upahnya jatuh**, karena uangnya diterima
  Sabtu sesudah Kamis itu. Di tab Upah, tiap baris ritasenya tetap tampil di
  periode **tanggal kejadiannya** (PRI-34 butir 5) dengan keterangan "masuk
  slip minggu [tanggal Kamis]". Contoh: minggu upah Jumat 22 – Kamis 28
  November; slipnya tampil di periode 26 November – 25 Desember; ritase 23
  November tampil di tab Upah periode 26 Oktober – 25 November bertanda
  "masuk slip minggu 28 November".
- **Kepala halaman, tiga angka:**
  1. **Pendapatan periode ini:** jumlah bersih semua slip periode ini
     ditambah bongkaran. Selama ada slip Perkiraan, angka ini bertanda
     "perkiraan".
  2. **Sudah diterima:** yang sudah Dibayar (slip Dibayar, bongkaran
     dibayar, bayar di luar slip Dibayar).
  3. **Belum diterima:** sisanya, dengan jatuh bayarnya.
- **Tab:**
  1. **Ringkasan:** satu kartu per slip (jenis, periode atau minggu,
     status Perkiraan, Ditutup, atau Dibayar, bersih, status bayar) dan satu
     kartu per hari bongkaran. Ketuk kartu slip membuka GAJ-L40.
  2. **Upah:** baris Buku Upah orang itu per tanggal kejadian (ritase,
     bongkaran, lembur, bonus). Gaji tetap baru menjadi baris Buku Upah saat
     slip ditutup (DRV-84); sebelum itu tampil satu baris "Gaji tetap
     (perkiraan)".
  3. **Bonus:** GAJ-L27 bentuk karyawan.
  4. **Potongan:** GAJ-L19 bentuk karyawan. Baris minus kas catat tangan
     bernama dan Potongan Lain membawa tombol **Ajukan keberatan** selama
     masa keberatannya (GAJ-L18, GAJ-81).
  5. **Hitungan:** GAJ-L09 bentuk karyawan (tanpa "dalam toleransi",
     KEH-119). Tidak tampil bagi yang dibayar per ritase (tidak punya
     hitungan kehadiran, KEH-99) dan bagi GM (tidak diabsen, KAR-67).
- Semua tab lain selalu tampil supaya letaknya tidak berpindah; yang kosong
  berisi "Belum ada [isi tab] di periode ini."
- Pekerja lepas tidak punya akun (DRV-45), jadi tidak punya halaman ini;
  upahnya terlihat di Total Diterima per Orang (GAJ-L43).

#### Peringatan "gaji bisa mundur" (GAJ-44)

- Satu fungsi server **"urusan gaji saya (orang, periode)"** (WAJ-04)
  mengembalikan: semua penahan dari fungsi penahan slip (GAJ-93), ditambah
  urusan yang **belum diajukan orang itu sendiri**, yaitu kejadian Perlu
  Dijelaskan yang belum diisi (KEH-L35). Dipakai Pendapatan Saya, GAJ-L40,
  dan Beranda.
- Tampil sebagai **kotak peringatan** di atas Pendapatan Saya dan sebagai
  kartu "perlu perhatian saya" di Beranda (BER-L01), satu baris per urusan,
  dengan **siapa yang harus bertindak**:
  - **Anda:** misalnya "3 hari belum dijelaskan (12, 14, 18 November)",
    tombol **Isi sekarang** (KEH-L36).
  - **Kantor:** misalnya "Penjelasan 12 November menunggu keputusan HR",
    "Absen 5 November di luar titik sedang ditinjau". Tanpa tombol, karena
    bukan tugas karyawan; urusan yang sama sudah ada di sisi HR (pengingat
    tutup slip dan Persetujuan).
- **Kalimat akibat** mengikuti tanggal: sebelum periode berakhir "Selesaikan
  sebelum tanggal 25 supaya gaji tidak tertahan"; sesudah periode berakhir
  dan slip tertahan "Gaji Anda tertahan sampai urusan ini selesai. Slip
  orang lain tetap dibayar".
- Penahan 5 dan 6 slip terakhir tampil hanya sebagai "Menunggu keputusan
  kantor", tanpa menyebut isinya (usulan berhenti tanpa pemberitahuan
  belum diputuskan, KAR-68).
- Kotak hilang sendiri saat urusannya selesai; tidak bisa ditutup atau
  disembunyikan. Tidak tampil untuk slip yang sudah ditutup.

#### Slip dari sisi karyawan dan status bayar (GAJ-46, 54, 97, 102; KEU-24)

| Keadaan | Yang tampil di GAJ-L40 |
|---|---|
| **Perkiraan** | Bentuk slip yang sama, dihitung saat dibuka, tanpa nomor, dengan tanda besar "Perkiraan, belum final: angka bisa berubah sampai slip ditutup". Tampil sepanjang periode (GAJ-36). Tidak bisa diunduh |
| **Tertahan** (Perkiraan sesudah batas tutup) | Sama, ditambah kotak peringatan GAJ-44 |
| **Ditutup** | Bentuk slip GAJ-97 dari baris tersimpan, nomor, versi; catatan "Keberatan sampai [tanggal] 23.59"; tombol **Unduh PDF** |
| **Ditutup, lewat jatuh bayar** | "Belum ditandai dibayar. Jatuh bayar [tanggal]." Pengingat sudah berjalan ke Pemilik dan GM (GAJ-104) |
| **Dibayar** | Kartu status bayar: "Dibayar [tanggal uang] lewat tunai" atau "lewat transfer ke rekening ****1234" (KEU-24). Tempat uang kantor (Brankas, Kas Pegangan) dan nama pembayar tidak ditampilkan |
| **Tanpa uang** (slip Rp0, GAJ-102) | "Tidak ada uang yang dibayarkan: seluruhnya terpakai potongan. Sisa Rp… dibawa ke slip berikutnya." |
| **Pembayaran dibatalkan** | Kembali "Belum dibayar", dengan baris riwayat "Pembayaran [tanggal] dibatalkan: [alasan]" |
| **Sedang dibetulkan** (dibuka kembali) | "Slip sedang dibetulkan: [alasan]" dan perkiraan baru; versi lama tetap bisa dibuka (hanya baca) untuk dibandingkan |

- **GAJ-46 dibaca begini:** slip resmi yang bisa diunduh dan dikeberati
  hanya slip tertutup; sebelum itu karyawan tetap melihat perkiraannya
  (GAJ-36), bertanda.
- Slip mingguan memakai bentuk yang sama (DRV-28); isi khasnya di 4G. Slip
  di luar slip utama (DRV-05) tampil sebagai slip tersendiri bertanda "tanpa
  potongan".

#### Keberatan slip (GAJ-42, 60; C2, C3)

Jenis pengajuan **"Keberatan slip"** di Mesin Pengajuan (PRI-37), dengan
dua macam:

| Macam | Kapan bisa diajukan | Penyetuju |
|---|---|---|
| **Ada yang salah di slip** | Sejak periode berakhir (bulanan: tanggal 26 pukul 00.00; mingguan: Jumat 00.00) selama slip masih Perkiraan, dan sampai 23.59 hari ke-3 sesudah slip ditutup (GAJ-42). Bila slip ditutup ulang, tiga hari dihitung dari penutupan terakhir (GAJ-95) | HR, Pemilik, GM (GAJ-60). Slip GM diputuskan Pemilik; slip jabatan Pemilik diputuskan GM atau Pemilik lain. Tidak ada yang memutuskan miliknya sendiri |
| **Uang belum saya terima** (C2) | Sejak slip ditandai Dibayar sampai 23.59 hari ke-7 | **Pemilik, GM**, karena hanya mereka yang menandai Dibayar dan membatalkannya (GAJ-45, 103) |

- **Sebelum periode berakhir** tombolnya belum ada; di tempatnya tertulis
  "Kalau ada yang salah di absen, jelaskan lewat Perlu Dijelaskan atau minta
  koreksi ke kepala toko. Potongan bisa dikeberati di tab Potongan."
  Alasannya: selama periode berjalan, jalan yang benar adalah sumbernya
  sendiri (GAJ-42), dan slip masih bisa berubah.
- **Isi (GAJ-L41):** macam; baris slip yang dikeberati (boleh lebih dari
  satu, atau "Lainnya"); alasan paling sedikit 20 huruf; foto bila ada
  (misalnya tangkapan layar mutasi rekening).
- **Satu Menunggu per macam per slip.** Yang ingin menambah keterangan
  menarik pengajuannya lalu menekan **Ajukan ulang** (isian lama terisi,
  PRI-37 butir 5).
- **Tidak menahan slip** (GAJ-93): keberatan yang diajukan selama Perkiraan
  tidak menghalangi tutup; langkah "Periksa" di GAJ-L30 menampilkan "1
  keberatan slip menunggu" supaya HR memutuskannya dulu bila sempat. Satu
  keberatan tidak boleh menahan gaji orang itu sendiri; bila benar, ia
  dibetulkan lewat koreksi.

**Keputusan (GAJ-L42; C3).** Tidak ada isian nominal di keputusan, karena
slip hanya membaca dari sumbernya (GAJ-38).

- **Ditolak:** alasan wajib (paling sedikit 15 huruf), dikirim ke pengaju.
  Selama masa keberatan masih berjalan, ia boleh mengajukan ulang.
- **Disetujui** berarti "benar, akan dibetulkan". Penyetuju memilih **jalan
  pembetulan** menurut keadaan slip:

| Keadaan slip | Jalan pembetulan | Hasil |
|---|---|---|
| Perkiraan | Betulkan di sumbernya (koreksi absen, batalkan potongan, sahkan bonus, ubah gaji periode berjalan) | Perkiraan berubah sendiri |
| Ditutup, belum Dibayar, syarat GAJ-95 terpenuhi | Buka kembali (Pemilik, GM; HR menekan Minta buka kembali), betulkan sumber, tutup ulang | Versi baru slip |
| Dibayar, atau slip berikutnya sudah ditutup | Betulkan di sumbernya; perubahan atas periode tertutup menjadi **koreksi periode lalu** di slip berikutnya (GAJ-72). Kesalahan gaji tetap memakai **Pembetulan gaji periode lalu** (di bawah) | Baris koreksi di slip berikutnya; orang yang sudah tidak punya slip berikutnya: bayar di luar slip atau Piutang Lain (GAJ-106) |

- Sesudah Disetujui, pengajuan bertanda **"menunggu pembetulan"** sampai
  penyetuju menekan **Tautkan pembetulan** dan memilih catatan yang
  membetulkannya (baris koreksi periode lalu, versi slip baru, atau catatan
  sumber yang diubah sesudah keputusan). Daftar pilihannya disaring server:
  hanya catatan milik orang itu yang lahir atau berubah sesudah keputusan.
  Selama belum tertaut, tanda ini masuk **pengingat berantai** penyetuju
  sekali sehari (TAM-22). Pengaju melihat "Disetujui: akan dibetulkan",
  lalu "Sudah dibetulkan: [baris] Rp… di slip [periode]".
- **Pembetulan gaji periode lalu** (C3; pengecualian atas GAJ-63): bila yang
  salah adalah komponen gaji di slip yang sudah ditutup (misalnya tunjangan
  salah ketik), **Pemilik atau GM** mencatat perubahan gaji asal
  **"pembetulan"** bertanggal periode lama, alasan wajib, dan **wajib
  menunjuk satu keberatan slip yang Disetujui** (atau, untuk GM, alasan
  tertulis bila kesalahan ditemukan kantor sendiri). Mesin Penghitung koreksi
  periode lalu menghitung ulang R1 periode itu dengan paket yang dibetulkan
  dan menulis selisihnya sebagai baris "Koreksi gaji tetap periode [nama]",
  dua arah (GAJ-72). Slip lama tidak diubah. Tanpa jalan ini, kesalahan
  gaji tetap di slip yang sudah dibayar tidak punya jalan keluar (WAJ-11),
  karena GAJ-63 melarang perubahan gaji memilih periode yang sudah ditutup.
- **Uang belum saya terima:** Pemilik atau GM memeriksa bukti pembayaran
  (foto bukti, mutasi rekening). **Ditolak** bila memang sudah dibayar
  (alasan, boleh melampirkan bukti). **Disetujui** bila memang belum
  diterima: jalan pembetulannya **Batal bayar** (GAJ-103) lalu bayar ulang;
  pembayaran baru tertaut otomatis.
- **Belum diputuskan saat slip ditutup:** keberatan tetap Menunggu dan
  diputuskan seperti biasa; tidak Hangus.

#### Unduh slip dari sisi karyawan (C4; GAJ-54, 97)

- Tombol **Unduh PDF** di GAJ-L40 untuk slip **tertutup** saja; bentuk sama
  dengan GAJ-L32 (A4 tegak, nomor, versi, tanggal unduh dari server). Server
  menolak mengunduh Perkiraan.
- **Unduh beberapa slip sekaligus** dari GAJ-L39 (pilih periode, paling
  banyak 12), satu PDF satu slip per halaman, misalnya untuk pengajuan
  kredit ke bank.
- Tiap unduhan dicatat di `langkah_slip` (langkah "diunduh orangnya").
- Mencetak dari HP lewat PDF itu; tidak ada tombol cetak terpisah.

#### Akses terbatas mantan karyawan (C4; pelapis KAR-07, 34)

- Orang yang dinonaktifkan karena berhenti **tetap bisa masuk dengan akun
  lamanya dalam akses terbatas**: hanya Pendapatan Saya, Slip Saya,
  Pengajuan Saya untuk Keberatan slip, Pemberitahuan, dan Profil (lihat
  saja). Menu lain tidak ada; server menolak semua alamat lain.
- **Selama** fungsi server **"masih punya urusan uang (orang)"** bernilai
  ya: slip terakhir belum Dibayar, atau Dibayar kurang dari 7 hari, atau ada
  keberatan slip yang Menunggu atau menunggu pembetulan, atau ada tagihan
  bayar di luar slip yang Menunggu bayar. Sesudahnya akun kembali tertutup
  penuh (KAR-07): "Akun ini tidak aktif sejak [tanggal]. Hubungi HR."
- Halaman masuk tetap sama; tidak ada akun kedua. Akses terbatas tampil
  dengan bilah "Akses terbatas sampai urusan gaji selesai".
- Orang yang dinonaktifkan **bukan** karena berhenti (misalnya salah
  dinonaktifkan) tidak mendapat akses ini; ia diaktifkan lagi (KAR-07).

#### Total Diterima per Orang (C5; DRV-80, GAJ-46)

- **Letak:** Kantor › Gaji › Total Diterima per Orang. **PC.**
- **Rentang:** satu periode (bawaan periode terakhir yang sudah ditutup)
  sampai 12 periode.
- **Satu baris per orang**, termasuk mantan karyawan dan pekerja lepas
  bongkaran: slip bulanan, slip mingguan, bongkaran, bayar di luar slip,
  **Diterima** (yang sudah Dibayar), **Belum dibayar** (Ditutup belum
  Dibayar), dan jumlah. Slip Perkiraan tidak ikut. Periode mengikuti aturan
  yang sama dengan Pendapatan Saya (slip mingguan di periode Kamis
  akhirnya; bongkaran di periode tanggal kerja).
- Dibaca dari satu fungsi server **"total diterima (orang, rentang)"** yang
  membaca `slip`, `pembayaran_slip`, `bayar_luar_slip`, dan pembayaran
  bongkaran (4G); tidak menghitung ulang (GAJ-55).
- **Saring:** cabang (tersimpan di slip, GAJ-40), jabatan, jalur, aktif atau
  mantan. **Cari** nama.
- Klik baris: rincian orang itu per periode (bentuk Pendapatan Saya,
  hanya baca) dan tab Upah (Buku Upah, GAJ-66).
- **Hak lihat:** Pemilik dan GM semua; HR tanpa jabatan bertanda "Gaji hanya
  terlihat Pemilik dan GM", tidak juga dalam jumlah (GAJ-46). Finance dan
  Admin HR tidak membuka layar ini (Finance tidak menerima angka per orang
  kecuali Daftar Transfer, GAJ-100).
- **Unduh** Excel (KEU-116), memuat sudut pandang pembuatnya; tercatat.

#### GAJ-L39. Pendapatan Saya

- **Letak:** Saya › Pendapatan Saya (menu v1). **HP.**
- **Isi:** pemilih periode; kotak peringatan GAJ-44 (bila ada); kepala tiga
  angka; tab Ringkasan, Upah, Bonus, Potongan, Hitungan (lihat di atas).
- **Tombol:** **Unduh beberapa slip** (hanya slip tertutup).
- **Beda jabatan:** yang dibayar per ritase tidak punya tab Hitungan; GM
  tidak punya tab Hitungan. Mantan karyawan: bilah akses terbatas.
- **Pesan (kosong):** "Belum ada pendapatan di periode ini."

#### GAJ-L40. Slip Saya

- **Letak:** dari kartu slip di GAJ-L39 dan dari pemberitahuan "Slip Anda
  sudah ditutup" atau "Gaji dibayar". **HP**; unduhan PDF A4.
- **Isi:** bentuk slip GAJ-97 dengan keadaan dan status bayar di atas; tiap
  baris bisa diketuk untuk rinciannya (PRI-21), misalnya baris telat
  membuka rincian per hari dari GAJ-L09.
- **Tombol menurut keadaan:** **Ada yang salah** (macam pertama, selama masa
  keberatan); **Uang belum saya terima** (macam kedua, 7 hari sesudah
  Dibayar); **Unduh PDF** (tertutup); **Lihat versi lama** (bila ada).
  Keberatan yang sudah diajukan tampil sebagai kartu status di bawah slip.

#### GAJ-L41. Ajukan Keberatan Slip (3 langkah, TAM-07)

1. **Apa yang salah:** macam terisi dari tombol yang ditekan; untuk "Ada
   yang salah" pilih baris slip (centang, boleh lebih dari satu) atau
   "Lainnya".
2. **Ceritakan:** alasan paling sedikit 20 huruf, foto bila ada. Tanda
   simpan otomatis (TAM-16).
3. **Periksa dan kirim:** ringkasan; batas keputusan tidak ada, tetapi
   "Penyetuju diingatkan setiap hari sampai memutuskan". Pesan berhasil
   menyebut siapa yang memutuskan (TAM-17).
- Memakai kerangka BER-L05 s.d. L07; rinciannya tampil di Pengajuan Saya.

#### GAJ-L42. Putuskan Keberatan Slip

- **Letak:** isi khas di BER-L21, dibuka dari Persetujuan (BER-L20). **PC**
  (HP untuk GM).
- **Isi:** slip yang dikeberati (bentuk GAJ-97, baris yang dikeberati
  ditandai), alasan dan foto pengaju, keadaan slip, dan jalan pembetulan
  yang tersedia untuk keadaan itu. Untuk macam kedua: pembayaran (tanggal
  uang, tempat uang, foto bukti, pembayar).
- **Tombol:** **Tolak** (alasan) atau **Setujui** (pilih jalan pembetulan;
  tombol langsung ke layarnya: koreksi absen, GAJ-L31, GAJ-L03 pembetulan,
  GAJ-L35); sesudahnya **Tautkan pembetulan**.
- Pengaju tidak bisa membuka layar ini untuk miliknya; slip jabatan bertanda
  tidak tampil untuk HR.

#### GAJ-L43. Total Diterima per Orang

- **Letak:** Kantor › Gaji › Total Diterima per Orang. **PC.**
- **Isi:** pemilih rentang; tabel per orang (lihat di atas) dengan baris
  jumlah; saring dan cari; klik untuk rincian.
- **Tombol:** **Unduh Excel**.
- **Beda jabatan:** HR tanpa jabatan bertanda; Finance dan Admin HR ditolak
  server.

---

## 4. Data

Semua tabel punya kolom perusahaan (PRI-31), jejak dibuat dan diubah, tidak ada
yang dihapus (PRI-02), dan indeks pada kolom pencarian (PRI-14). Orang,
jabatan, dan cabang milik Karyawan; tabel di bawah hanya menunjuknya. Nominal
rupiah bilangan bulat (PRI-28).

| Tabel | Isi penting | Dicari dengan | Dibaca modul lain | Bagian |
|---|---|---|---|---|
| jenis_komponen_gaji | nama, urutan, aktif | aktif | — | 4E-1 |
| perubahan_gaji | orang, berlaku dari (selalu tanggal awal periode), alasan, asal (ubah biasa, gaji standar, promosi, data lama), status (Menunggu, Berlaku, Ditolak, Ditarik, Dibatalkan), pengusul, penyetuju, kapan, alasan batal | orang + berlaku dari; status | Gaji saja | 4E-1 |
| isi_perubahan_gaji | perubahan, jenis komponen, nominal. **Satu perubahan menyimpan paket lengkap** komponen orang itu sejak tanggalnya, bukan hanya yang berubah | perubahan | Gaji saja | 4E-1 |
| gaji_standar | paket (Training, Karyawan), jenis komponen, nominal, berlaku dari, oleh, alasan | paket + tanggal | Gaji saja | 4E-1 |
| periode | jenis (bulanan, minggu upah), nama, tanggal mulai, tanggal akhir, akhir masa keberatan, batas tutup, tanggal bayar (ketiganya disalin dari pengaturan saat dibuat), jadwal disalin kapan; satu baris per jenis + tanggal mulai | jenis + tanggal | **semua modul** (lewat satu fungsi "periode untuk tanggal ini", PRI-34 butir 4) | 4E-1 |
| buku_upah | orang, jenis upah (Daftar Jenis Upah, DRV-02), tanggal kejadian, periode (dari tanggal kejadian, PRI-34 butir 5), banyaknya, satuan, tarif, nominal, cabang, asal (jenis + nomor catatan asal), slip (diisi saat slip ditutup), status (Berlaku, Dibatalkan), alasan batal, koreksi atas baris nomor berapa | orang + periode; asal; slip | Gaji Driver (4G), Keuangan (beban), Kinerja | 4E-1 |
| denda_kehadiran | orang, jenis (lupa absen masuk, lupa absen pulang, lupa Masuk Kembali, tidak memilih libur; kelak lewat batas istirahat), tanggal kejadian, periode (dari tanggal kejadian), periode masuk slip (berbeda bila periode asal sudah ditutup), asal (penjelasan nomor berapa, atau tanda tidak memilih libur), kejadian ke-n (dari Kehadiran), denda dasar, tambahan, nominal, status (Berlaku, Dibatalkan), alasan batal, menggantikan baris nomor berapa, slip (diisi saat slip ditutup) | orang + periode; asal | Dana Disiplin (4E-4) | 4E-2 |
| peniadaan_potongan | jenis (telat, denda), hari kerja atau baris denda yang ditiadakan, asal (usulan dari penjelasan KEH-66, atau langsung), alasan, oleh, kapan, status (Berlaku, Dibatalkan, Tetap dipotong), dibatalkan (oleh, kapan, alasan) | orang + periode; status | Dana Disiplin (4E-4, yang ditiadakan tidak masuk) | 4E-2 |
| koreksi_periode_lalu | orang, periode asal, periode masuk slip, sebab (jenis + nomor catatan asal di Kehadiran atau Gaji), jenis baris (R3, R4, R6, R7, R8), hitungan lama (dari slip tersimpan), hitungan baru, selisih, status (Menunggu slip, Masuk slip, Dihitung ulang), slip | orang + periode masuk; sebab | Dana Disiplin dan Dana Tidak Hadir (4E-4) | 4E-2 |
| kehilangan_barang | cabang, tanggal ditemukan, periode (dari tanggal ditemukan), periode masuk slip (berbeda bila disahkan sesudah slip periodenya ditutup), nilai, keterangan, lampiran, pencatat, pengesah, status (Menunggu, Berlaku, Ditolak, Dibatalkan), alasan batal | cabang + periode; status | Keuangan (beban kehilangan barang per cabang, 4H) | 4E-3 |
| bagian_kehilangan | kehilangan, orang (kosong = kantor), jenis bagian (orang, persen kantor, sisa sebanding hari, pembulatan), bobot, hari, jumlah bobot, persen kantor, nominal; **ditulis saat kejadian Berlaku dan dihitung ulang** selama slip periodenya belum ditutup (penempatan bisa berubah); dikunci saat slip ditutup | kehilangan; orang + periode | Gaji saja | 4E-3 |
| minus_kas_catat | cabang, tanggal kejadian, periode, periode masuk slip, nilai, alasan, foto, bernama atau tanpa nama, penanggung (bila bernama), pencatat, pengesah, status (Menunggu, Berlaku, Keberatan menunggu, Ditiadakan, Ditolak, Dibatalkan), alasan | cabang + periode; penanggung | Keuangan (4H, sebagai uang yang hilang) | 4E-3 |
| bagian_minus_kas | catatan minus kas, orang, nominal (bagi rata; pembulatan ke kantor) | catatan; orang + periode | Gaji saja | 4E-3 |
| jenis_potongan_lain | nama, aktif | aktif | — | 4E-3 |
| potongan_lain | orang, jenis, nominal, alasan, foto, kali potong (1–3), pencatat, pengesah, status (Menunggu, Berjalan, Keberatan menunggu, Lunas, Ditiadakan, Dibatalkan, Piutang), alasan; **sisa tidak disimpan**, dihitung dari cicilan | orang; status | Gaji Driver (slip mingguan, DRV-23) | 4E-3 |
| cicilan_potongan_lain | potongan lain, urutan, slip tujuan (periode slip utama), nominal, terpotong (diisi saat slip ditutup, boleh sebagian), slip yang memotong, status (Terjadwal, Terpotong, Sebagian, Dibatalkan) | potongan lain; orang + periode | Gaji Driver (4G) | 4E-3 |
| sisa_potongan | orang, jenis asal (telat, tidak hadir, denda, koreksi, kehilangan, minus kas, Potongan Lain, kasbon), catatan asal, periode asal, slip asal, nominal sisa, slip yang melunasi, status (Dibawa, Terpotong, Tidak tertagih, Menjadi piutang) | orang + status | Dana Disiplin, Dana Tidak Hadir (4E-4), Kasbon (4G), Keuangan (Piutang Lain) | 4E-3 |
| jenis_bonus | nama, lahir dari (grooming, ongkir, promo, terukur, ketik), cara disahkan (tanpa, per laporan, per orang per periode, per aturan per periode, per baris), boleh untuk jabatan Pemilik, aktif. Jabatan penerima, sumber dana, dan angka aturannya disimpan di pengaturan kerangka 4B **bersasaran jenis bonus**, bertanggal berlaku | aktif | Kinerja, Logistik (lewat pintu tulis) | 4E-4 |
| buku_bonus | orang, jenis, tanggal kejadian, periode (dari tanggal kejadian), slip tujuan (periode atau minggu upah slip utama, B3), cabang, dasar hitungan (harga jasa, ongkir, pcs, aturan), angka aturan yang dipakai, nominal, sumber dana (disalin saat lahir), asal (jenis + nomor catatan asal; **unik** untuk baris Berlaku, mencegah dobel), tanda (⚠ ganti groomer, ⚠ foto antar tidak lengkap, berubah dari kasir, periode asal), status (Ditahan, Menunggu, Disahkan, Ditolak, Dibatalkan, Masuk slip, Hangus), keputusan, alasan, menggantikan baris nomor berapa, koreksi atas baris nomor berapa, slip | orang + periode; jenis + status; asal | Buku Upah (DRV-84), Kinerja (bonus yang didapat, KIN-12), Keuangan (total per periode) | 4E-4 |
| keputusan_bonus | jenis keputusan (per baris, per groomer per periode, per aturan per periode, keluarkan, batalkan, hangus), periode, orang atau aturan, banyaknya baris, jumlah, sumber dana, Tersedia saat diputuskan (bila Dana Disiplin), oleh, kapan, alasan | periode; oleh | Gaji saja | 4E-4 |
| mutasi_dana | dana (Disiplin, Tidak Hadir), tanggal (jam server), periode, arah, nominal, jenis mutasi (telat, denda kehadiran, denda driver, denda berhenti, tidak hadir per jenis, lembur, kompensasi, koreksi, bonus, pindah, saldo awal, penyesuaian), cabang asal, slip atau catatan asal, orang (kosong untuk saldo awal, pindah, penyesuaian), status (Berlaku, Dibalik), dibalik oleh slip dibuka nomor berapa, alasan, oleh | dana + periode; slip | Keuangan (KEU-90, 100, 115) | 4E-4 |
| slip | jenis (bulanan, mingguan), orang, periode, slip utama (ya, tidak; DRV-05), nomor (kosong sampai pertama ditutup; unik), status (Perkiraan, Ditutup, Dibayar), versi, slip terakhir (ya, tidak), ditutup lebih cepat (ya, tidak), cabang dan jabatan tersimpan (diisi saat ditutup, GAJ-40), jumlah pendapatan, jumlah terpotong, bersih, ditutup oleh, kapan, akhir masa keberatan; **jatuh bayar** (tanggal bayar periode atau tanggal ditutup, mana yang lebih lambat; 4E-5b), tanpa uang (ya, tidak; slip Rp0, Y4). Pembayarannya di `pembayaran_slip`. **Kunci: orang + periode + jenis + slip utama** | periode + status; orang; nomor | Keuangan (4E-5b), Gaji Driver (4G), Kinerja (laporan per cabang dan jabatan memakai yang tersimpan) | 4E-5a |
| baris_slip | slip, versi, bagian (pendapatan, potongan a, b, c, d, catatan), jenis baris, urutan, label, tanggal kejadian atau periode asal, nominal, terpotong, sisa dibawa, rincian (aturan dan angka yang dipakai, hitungan, tautan ke catatan asal), tanda ditiadakan dan alasannya, status (Berlaku, Diganti versi). **Ditulis hanya oleh langkah tutup**; tidak dihitung ulang saat dibuka (GAJ-39) | slip + versi | Keuangan (uraian, 4E-5b), Pendapatan Saya, Total Diterima per Orang (4E-5c) | 4E-5a |
| langkah_slip | slip, langkah (ditutup, ditutup lebih cepat, diminta buka, dibuka kembali; 4E-5b: dibayar, dibayar tanpa uang, pembayaran dibatalkan; dicetak), versi, oleh, kapan (jam server), alasan, ringkasan akibat (banyaknya baris, cicilan, mutasi, piutang) | slip; periode + kapan | Gaji saja | 4E-5a |
| kelompok_bayar | pembayar, tempat uang, tanggal uang, jam catat, banyaknya slip, jumlah, foto bukti (boleh satu untuk kelompok), hasil (dibayar, gagal beserta sebab) | pembayar + tanggal | Gaji saja | 4E-5b |
| pembayaran_slip | slip, kelompok bayar, tanggal uang, jam catat (server), pembayar, tempat uang, cara (tunai, transfer; dari jenis tempat uang), nominal (= bersih slip, tidak diketik), foto, asal (tombol Bayar, pasangan Catatan Cepat nomor berapa, tanpa uang), baris Buku Kas, status (Berlaku, Dibatalkan), dibatalkan oleh, kapan, alasan. **Satu pembayaran Berlaku per slip** (kunci slip + status Berlaku) | slip; tanggal uang; tempat uang | Keuangan (uang keluar, 4H), Pendapatan Saya (4E-5c) | 4E-5b |
| bayar_luar_slip | orang, asal (baris Buku Bonus atau koreksi nomor berapa; **unik**), periode asal, nominal, dipotongkan ke Piutang Lain (nominal, nomor piutang), dibayar dengan uang (nominal), tempat uang, tanggal uang, pembayar, baris Buku Kas, status (Menunggu bayar, Dibayar, Dibatalkan), alasan | orang; status | Keuangan (uang keluar, cicilan Piutang Lain tanpa uang), Buku Bonus | 4E-5b |
| keberatan_slip | pengajuan (Mesin Pengajuan, PRI-23), slip, versi slip saat diajukan, macam (ada yang salah, uang belum diterima), baris slip yang dikeberati (boleh banyak; kosong = Lainnya), pembayaran (untuk macam kedua), jalan pembetulan (sumber, buka kembali, koreksi periode lalu, pembetulan gaji, batal bayar), pembetulan tertaut (jenis + nomor catatan), status pembetulan (—, Menunggu pembetulan, Sudah dibetulkan), ditautkan oleh, kapan. Status pengajuan sendiri (Menunggu, Disetujui, Ditolak, Dibatalkan) disimpan Mesin Pengajuan. **Satu Menunggu per slip per macam** | slip; orang + status pembetulan | Gaji saja | 4E-5c |

**Tambahan kolom dari 4E-5c:** `perubahan_gaji.asal` mendapat nilai
**"pembetulan"** dengan kolom keberatan slip yang ditunjuk (boleh kosong
hanya bila dicatat GM atau Pemilik dengan alasan); hanya asal ini yang boleh
bertanggal periode yang slipnya sudah ditutup (pengecualian GAJ-63).
`koreksi_periode_lalu.jenis baris` mendapat **R1 (gaji tetap)**.
`langkah_slip.langkah` mendapat "diunduh orangnya".

**Tanpa tabel baru untuk akses mantan karyawan dan Total Diterima** (4E-5c):
keduanya fungsi server yang membaca tabel yang ada ("masih punya urusan uang
(orang)" dan "total diterima (orang, rentang)"). Akun tetap milik Karyawan
(WAJ-03); pemeriksa masuk Karyawan memanggil fungsi pertama.

Keberatan potongan disimpan di Mesin Pengajuan (PRI-23), bertaut ke catatan
yang dikeberati; tabel di sini hanya menyimpan statusnya.

**Persen kantor dan bobot jabatan** memakai tabel pengaturan kerangka 4B
dengan **sasaran** (cabang atau jabatan) di samping kunci. Titipan 4J:
kerangka 4B harus menerima pengaturan bersasaran.

**Data lama (4E-3):** persen kantor tidak dibawa (persen per orang lama tidak
cocok dengan cara v3); pemilik mengisinya saat menyiapkan tayang bersama
bobot. Kehilangan, minus kas, dan cicilan yang sudah masuk slip sistem lama
tetap di sana. Kasbon berjalan dibawa oleh 4G. Potongan Lain tidak punya data
lama (GAJ-B29).

**Cara membaca gaji seseorang pada tanggal T:** ambil `perubahan_gaji`
berstatus Berlaku milik orang itu dengan berlaku dari ≤ T yang paling akhir;
isinya adalah paket lengkap. Satu fungsi di server dipakai slip, perkiraan,
GAJ-L01, dan GAJ-L07 (WAJ-04).

**Buku Upah dan pengaturan:** jenis upah milik 4G (DRV-02). Pengaturan
memakai tabel kerangka 4B; tabel di sini tidak menyimpan angka pengaturan.

**Data lama (SIS-23 s.d. 33):** komponen tiap orang dibawa sebagai satu
`perubahan_gaji` asal "data lama" berlaku dari awal periode pertama v3,
memakai baris **terbaru** sistem lama yang berlaku sebelum tanggal itu. Tarif
lembur per orang lama tidak dibawa (GAJ-12).

**Hitungan kehadiran tidak disimpan sebagai tabel** selama perkiraan: ia
dihitung fungsi yang sama tiap diminta (4E-2). Yang disimpan hanya denda,
peniadaan, dan koreksi periode lalu (keputusan dan kejadian), lalu rincian
baris demi baris saat slip ditutup (4E-5, GAJ-39).

**Data lama (4E-2):** denda, peniadaan, dan koreksi sistem lama tidak dibawa
sebagai baris; slip sistem lama yang sudah ditutup tetap di sistem lama
(SIS-23 s.d. 33). Periode pertama v3 dihitung seluruhnya oleh fungsi v3.

**Saldo dana dihitung dari mutasi, tidak disimpan** (4E-4): Saldo = jumlah
mutasi Berlaku; Terpesan dihitung dari `buku_bonus`. Satu fungsi di server
"keadaan dana (dana, tanggal)" dipakai GAJ-L20, L22, L24, L25, L26 dan
Keuangan (WAJ-04). Pengesahan yang memakai Dana Disiplin dikunci satu per
satu di server (dua pengesahan bersamaan tidak boleh sama-sama lolos dari
Tersedia yang sama).

**Data lama (4E-4):** bonus sistem lama yang sudah masuk slip tetap di
sana. Bonus sistem lama yang belum masuk slip saat hari pindah dibawa
sebagai baris Bonus Bebas bertanda "bawaan sistem lama" berstatus Menunggu,
supaya diputuskan sekali lagi di v3 (termasuk enam laporan promo September
2026 yang tertunda, bila masih ada). Kucing yang diterima sebelum hari mulai
tetapi diambil sesudahnya berbonus di v3 (GAJ-61). Saldo awal kedua dana:
SIS-33.

**Satu fungsi hitung slip, satu fungsi penahan** (4E-5a): "hitung slip
(orang, periode)" dan "penahan slip (orang, periode)" dipakai halaman
periode, langkah tutup, Pendapatan Saya, dan pengingat (WAJ-04). Slip
Perkiraan tidak menyimpan angka; `baris_slip` hanya lahir saat ditutup.
Penutupan dan pembukaan kembali dikunci per slip di server (dua penekan
bersamaan tidak boleh sama-sama jalan).

**Satu pembayaran per slip, satu fungsi ringkasan** (4E-5b): pembayaran
dikunci per slip di server (dua penekan bersamaan tidak boleh sama-sama
lolos); baris Buku Kas hanya ditulis lewat fungsi Keuangan, tidak pernah dari
layar Gaji langsung (KEU-23). "Ringkasan gaji (periode, sudut pandang)"
membaca `baris_slip` dan `pembayaran_slip`; sudut pandang ditentukan server
dari jabatan penanya, bukan dikirim layar.

**Data lama (4E-5b):** pembayaran slip sistem lama tidak dibawa; slip lama
yang belum dibayar saat hari pindah dibayar di sistem lama (SIS-23 s.d. 33).

**Data lama (4E-5a):** slip sistem lama tidak dibawa sebagai `slip` v3;
tetap dibaca di sistem lama (SIS-23 s.d. 33). Sisa potongan dan cicilan
yang masih berjalan dibawa oleh 4E-3 dan 4G. Nomor slip v3 dimulai dari
0001 di periode pertama v3.

---

## 5. Tindakan bernama dan isi awal hak

Lingkup S = semua orang yang boleh dilihatnya (tanpa jabatan bertanda "Gaji
hanya terlihat Pemilik dan GM" untuk HR). Pemilik dan GM punya semua tindakan
(KAR-67).

| Tindakan | HR | Admin HR | Finance | Kepala Toko / Gudang | Karyawan lain | Bagian |
|---|---|---|---|---|---|---|
| lihat gaji karyawan (GAJ-L01, L02) | S | — | — | — | dirinya (Pendapatan Saya, 4E-5) | 4E-1 |
| usulkan ubah gaji | S | — | — | — | — | 4E-1 |
| putuskan usulan ubah gaji | — | — | — | — | — | 4E-1 |
| ubah gaji langsung | — | — | — | — | — | 4E-1 |
| batalkan perubahan gaji terjadwal | usulannya sendiri (tarik) | — | — | — | — | 4E-1 |
| ubah jenis komponen gaji | — | — | — | — | — | 4E-1 |
| ubah Gaji Standar | — | — | — | — | — | 4E-1 |
| lihat Gaji Standar dan jenis komponen | S | — | — | — | — | 4E-1 |
| usulkan pengaturan gaji | S | — | — | — | — | 4E-1 |
| lihat pengaturan gaji | S | S | S | — | lewat Aturan Potongan | 4E-1 |
| lihat Aturan Potongan | ya | ya | ya | ya | ya | 4E-1 |
| lihat daftar periode | S (dengan jumlah slip) | tanggal dan status | tanggal dan status | — | — | 4E-1 |
| lihat Buku Upah orang lain | S | — | — | — | — | 4E-1 |
| lihat Hitungan Kehadiran (GAJ-L09) | S | — | — | — | dirinya (Pendapatan Saya) | 4E-2 |
| tiadakan potongan telat dan denda (GAJ-71) | — | — | — | — | — | 4E-2 |
| lihat daftar Tiadakan Potongan dan usulannya | S | — | — | — | — | 4E-2 |
| lihat Koreksi Periode Lalu | S | — | — | — | barisnya sendiri di slip | 4E-2 |
| catat kehilangan barang (usulan) | S | — | — | — | — | 4E-3 |
| sahkan kehilangan barang, minus kas catat tangan, Potongan Lain | — | — | — | — | — | 4E-3 |
| lihat Kehilangan Barang dan pembagiannya | S | — | — | — | bagiannya sendiri | 4E-3 |
| usulkan persen kantor dan bobot | S | — | — | — | — | 4E-3 |
| catat minus kas catat tangan (usulan) | S | — | ya (tanpa melihat gaji) | — | — | 4E-3 |
| lihat Minus Kas | S | — | ya | — | miliknya sendiri | 4E-3 |
| ajukan Potongan Lain (usulan) | S | — | — | — | — | 4E-3 |
| ubah jadwal, batalkan, hapuskan sisa Potongan Lain | — | — | — | — | — | 4E-3 |
| ubah daftar jenis Potongan Lain | — | — | — | — | — | 4E-3 |
| ajukan keberatan potongan | — | — | — | — | atas potongannya sendiri | 4E-3 |
| putuskan keberatan potongan | — | — | — | — | — | 4E-3 |
| lihat Potongan dan Sisa (GAJ-L19) | S | — | — | — | dirinya (Pendapatan Saya) | 4E-3 |
| sahkan, tolak, keluarkan bonus Grooming, Promo, Bonus Terukur; putuskan perubahan dari kasir | S | — | — | — | — | 4E-4 |
| batalkan bonus Ongkir atau bonus yang sudah Disahkan | S | — | — | — | — | 4E-4 |
| ajukan Bonus Bebas (usulan) | S | — | — | — | — | 4E-4 |
| sahkan Bonus Bebas | — | — | — | — | — | 4E-4 |
| lihat Persetujuan Bonus dan Buku Bonus | S | — | total per jenis per periode | — | bonusnya sendiri (GAJ-L27) | 4E-4 |
| ubah atau usulkan Jenis Bonus | usulkan | — | — | — | — | 4E-4 |
| lihat Dana Disiplin dan Dana Tidak Hadir | S (dengan nama) | — | tanpa nama orang | — | — | 4E-4 |
| pindah dana, penyesuaian, saldo awal | — | — | — | — | — | 4E-4 |
| tetapkan bonus Hangus (GAJ-58) | — | — | — | — | — | 4E-4 |
| bayar bonus di luar slip (B6) | — | — | — | — | — | 4E-4 |
| lihat halaman satu periode dan slip semua orang (GAJ-L28, L29) | S | — | — (ringkasan, 4E-5b) | — | slipnya sendiri (4E-5c) | 4E-5a |
| tutup slip (per orang, semua yang siap) | S (tanpa jabatan bertanda) | — | — | — | — | 4E-5a |
| tutup slip jabatan bertanda (Pemilik, GM) | — | — | — | — | — | 4E-5a |
| tutup lebih cepat slip terakhir (S4) | — | — | — | — | — | 4E-5a |
| buka kembali slip (S3) | — | — | — | — | — | 4E-5a |
| minta buka kembali | S | — | — | — | — | 4E-5a |
| cetak dan unduh slip tertutup (GAJ-L32) | S | — | — | — | slipnya sendiri (4E-5c) | 4E-5a |
| lihat Jadwal Bayar (GAJ-L33) | — | — | bongkaran dan jumlah slip tanpa nama | — | — | 4E-5b |
| bayar slip, batal bayar (GAJ-L34, L35) | — | — | — | — | — | 4E-5b |
| lihat Daftar Transfer (GAJ-L36, Y2) | — | — | ya (tanpa jabatan bertanda) | — | — | 4E-5b |
| pasangkan Catatan Cepat "Gaji/Upah" ke slip (Y3) | — | — | ya (layar 4H; catatan milik Pemilik atau GM) | — | — | 4E-5b |
| bayar di luar slip, batalkan (GAJ-L37) | — | — | — | — | — | 4E-5b |
| lihat Ringkasan Gaji (GAJ-L38) | S | — | seluruh perusahaan, tanpa nama dan per cabang | — | — | 4E-5b |
| lihat Pendapatan Saya dan slip sendiri, unduh slip tertutup sendiri (GAJ-L39, L40) | dirinya | dirinya | dirinya | dirinya | dirinya (juga mantan karyawan dalam akses terbatas) | 4E-5c |
| ajukan keberatan slip (GAJ-L41) | slipnya sendiri | slipnya sendiri | slipnya sendiri | slipnya sendiri | slipnya sendiri | 4E-5c |
| putuskan keberatan slip "ada yang salah" (GAJ-L42) | S (bukan miliknya) | — | — | — | — | 4E-5c |
| putuskan keberatan slip "uang belum diterima" | — | — | — | — | — | 4E-5c |
| catat pembetulan gaji periode lalu | — | — | — | — | — | 4E-5c |
| lihat Total Diterima per Orang (GAJ-L43) | S | — | — | — | — | 4E-5c |

**Batas keras** (KAR-72, tidak bisa diberikan lewat Hak Akses Jabatan):
melihat atau mengubah gaji jabatan bertanda "Gaji hanya terlihat Pemilik dan
GM" selain oleh Pemilik dan GM; memutuskan usulan gaji milik diri sendiri.
GM boleh mengubah gajinya sendiri secara langsung; para pemilik diberi tahu
(KAR-67, 73).

**Batas keras 4E-2:** meniadakan potongan hanya Pemilik dan GM (GAJ-11),
tidak bisa diberikan ke HR lewat Hak Akses Jabatan; tidak ada yang
meniadakan potongan miliknya sendiri.

**Batas keras 4E-3:** mengesahkan kehilangan barang, minus kas catat tangan,
dan Potongan Lain, serta memutuskan keberatan potongan, hanya Pemilik dan GM;
tidak ada yang mengesahkan atau memutuskan potongan yang mengenai dirinya
sendiri. Finance mencatat minus kas tanpa pernah menerima nominal gaji dari
server.

**Batas keras 4E-4:** tidak ada yang mengesahkan, menolak, membatalkan, atau
mencatat bonus untuk dirinya sendiri; bonus jabatan Pemilik hanya terlihat
dan diputuskan Pemilik atau GM yang lain; jabatan GM tidak bisa menerima
bonus; mengesahkan Bonus Bebas, pindah dana, penyesuaian dana, saldo awal,
Hangus, dan bayar di luar slip hanya Pemilik dan GM, tidak bisa diberikan ke
HR lewat Hak Akses Jabatan. Finance tidak pernah menerima bonus per orang
dari server.

**Batas keras 4E-5a:** membuka kembali slip dan tutup lebih cepat hanya
Pemilik dan GM (S3, S4); menutup slip jabatan bertanda "Gaji hanya terlihat
Pemilik dan GM" hanya Pemilik dan GM (GAJ-45). Ketiganya tidak bisa
diberikan ke HR lewat Hak Akses Jabatan. Tidak ada yang membuka kembali
slipnya sendiri, kecuali GM (sejalan GAJ-62; para pemilik diberi tahu).
Server menolak mencetak slip Perkiraan.

**Batas keras 4E-5b:** menandai Dibayar, batal bayar, dan bayar di luar slip
hanya Pemilik dan GM (GAJ-45), tidak bisa diberikan ke HR atau Finance lewat
Hak Akses Jabatan; tidak ada yang menandai Dibayar atau membatalkan
pembayaran slipnya sendiri, kecuali GM (para pemilik diberi tahu). Finance
tidak pernah menerima rincian slip atau slip jabatan bertanda dari server;
Daftar Transfer hanya berisi slip Ditutup belum Dibayar (Y2). Pemasangan
Catatan Cepat menjadi pembayaran hanya bila pencatatnya Pemilik atau GM
(atau atas nama mereka dengan lampiran, KEU-27).

**Batas keras 4E-5c:** tidak ada yang melihat, mengunduh, atau mengeberati
slip orang lain lewat Pendapatan Saya; tidak ada yang memutuskan keberatan
slipnya sendiri; keberatan "uang belum diterima" dan pembetulan gaji periode
lalu hanya Pemilik dan GM, tidak bisa diberikan ke HR lewat Hak Akses
Jabatan. Mantan karyawan dalam akses terbatas hanya mencapai halaman uangnya
sendiri; server menolak alamat lain. Finance dan Admin HR tidak menerima
Total Diterima per Orang dari server.

---

## 6. Mesin otomatis

Semua punya penjaga (PRI-33): tiap jalan tercatat; gagal atau tidak jalan di
jadwalnya muncul di "perlu perhatian" GM; terlewat dikejar tanpa dobel.

| Mesin | Jadwal (pengaturan, PRI-32) | Kerjanya | Bagian |
|---|---|---|---|
| Pembuat periode | Tiap hari 00.10 | Memastikan selalu ada **3 periode bulanan dan 13 minggu upah ke depan**. Membuat yang kurang dengan tanggal dari pengaturan (26–25; Jumat–Kamis) dan menyalin jadwalnya. Kunci "jenis + tanggal mulai" mencegah dobel | 4E-1 |
| Penyalin ulang jadwal | Saat pengaturan jadwal berubah (bukan terjadwal) | Menyalin ulang akhir masa keberatan, batas tutup, dan tanggal bayar ke periode yang **belum mulai** dan tanggal berlaku pengaturannya sudah tiba bagi periode itu. Periode yang sudah mulai tidak disentuh (PRI-34 butir 2) | 4E-1 |
| Pemeriksa gaji kosong | Tiap hari 06.00 | Mencari orang aktif berslip utama bulanan tanpa komponen berlaku di periode berjalan; masuk "perlu perhatian" HR (atau Pemilik dan GM untuk jabatan bertanda) | 4E-1 |
| Penulis denda | Saat penjelasan lupa absen disahkan atau dicabut, dan saat tanda "tidak memilih libur" dicatat (00.10 tanggal 26) | Menulis, membatalkan, dan menulis ulang baris `denda_kehadiran` (urutan ke-n dihitung ulang). Kunci "asal + status Berlaku" mencegah dobel | 4E-2 |
| Penghitung koreksi periode lalu | Saat Kehadiran mencatat koreksi susulan atau perubahan apa pun pada periode yang sudah ditutup; dan sekali lagi sesaat sebelum slip periode berjalan ditutup | Menjalankan fungsi hitungan kehadiran untuk periode lama dengan angka periode lama, membandingkan dengan slip tersimpan, menulis atau memperbarui `koreksi_periode_lalu`. Selisih nol tidak ditulis | 4E-2 |
| Penghitung pembagian | Saat kehilangan barang atau minus kas tanpa nama Berlaku; saat penempatan, jabatan, atau tanggal berhenti seseorang berubah di periode yang belum ditutup; sekali lagi sesaat sebelum slip ditutup | Menulis ulang `bagian_kehilangan` dan `bagian_minus_kas` periode yang belum ditutup (baris lama dibatalkan, tidak ditimpa). Jumlah bagian selalu sama dengan nilai | 4E-3 |
| Pemeriksa tanggungan | Tiap hari 06.00 | Mencari cabang aktif tanpa persen kantor berlaku dan jabatan bertanda tanpa bobot; masuk "perlu perhatian" Pemilik dan GM | 4E-3 |
| Penutup keberatan potongan | Tiap hari 00.30 | Menghilangkan tombol keberatan yang sudah lewat 3 hari; keberatan yang menunggu tetap menunggu (potongan berjalan) | 4E-3 |
| Penulis bonus grooming | Setiap tarikan transaksi kasir (tiap 1 menit, PRI-39) | Memanggil pintu tulis untuk tiap jasa grooming yang sudah diambil dan groomernya sudah dipasangkan; perubahan di kasir ditangani seperti "Perubahan dari kasir". Kunci asal (nomor nota + baris jasa) mencegah dobel | 4E-4 |
| Pembentuk bonus promo | 00.10 tanggal 26 (akhir periode); dan saat laporan periode lalu diputuskan | Menjumlah laporan promo yang disetujui per orang per produk per periode menjadi baris Disahkan, memakai tarif tercapai atau belum dari Kinerja (KIN-20, 26) | 4E-4 |
| Penerima Bonus Terukur | Saat rapor periode ditetapkan (KIN-09, 16) | Menerima hasil penilaian dari Kinerja lewat pintu tulis: satu baris Menunggu per aturan per orang | 4E-4 |
| Pemeriksa penerima | Saat jabatan penerima jenis bonus berubah; tiap hari 06.00 | Memindah baris Ditahan menjadi Menunggu bila jabatannya kini termasuk penerima; sisanya tetap di "perlu perhatian" HR | 4E-4 |
| Pengingat bonus menunggu | 2 hari sebelum batas tutup slip, lalu tiap hari | Pengingat berantai (TAM-22) ke HR, Pemilik, GM bila masih ada bonus Menunggu periode itu; slip **tidak** tertahan karenanya, kecuali slip terakhir (B6) | 4E-4 |
| Pembuat slip | 00.15 tanggal mulai periode; dan saat orang diaktifkan, dipindah slip utamanya, atau tanggal berhentinya diubah | Membuat catatan `slip` Perkiraan untuk tiap orang berslip utama bulanan yang ditempatkan sekurang-kurangnya sehari di periode itu (GAJ-02). Kunci orang + periode + jenis mencegah dobel. Slip Perkiraan yang orangnya ternyata tidak bekerja sehari pun di periode itu dibatalkan, tidak dihapus | 4E-5a |
| Pengingat tutup slip | 07.00 pada hari batas tutup dan tiap hari sesudahnya | Pengingat berantai (TAM-22) ke HR, Pemilik, GM selama periode yang sudah berakhir masih punya slip Perkiraan: jumlah yang siap, daftar tertahan beserta penahan dan penyelesainya. Slip jabatan bertanda hanya disebut ke Pemilik dan GM | 4E-5a |
| Pengingat belum Dibayar | Tiap hari 07.00 | Pengingat berantai (TAM-22, 25) ke Pemilik dan GM, satu jendela per jalur (slip bulanan, slip mingguan, bayar di luar slip), untuk yang jatuh bayarnya sudah lewat dan belum Dibayar: jumlah, rupiah, paling lama sejak kapan. Berhenti sendiri saat semuanya Dibayar | 4E-5b |
| Pembuat tagihan luar slip | Saat bonus disahkan atau koreksi plus lahir untuk orang yang slip terakhirnya sudah Dibayar | Menulis `bayar_luar_slip` Menunggu bayar dan langsung memotongkannya ke Piutang Lain orang itu bila ada (Y5). Kunci asal mencegah dobel | 4E-5b |
| Pengingat pembetulan keberatan | Tiap hari 07.00 | Pengingat berantai (TAM-22) ke penyetuju untuk keberatan slip Disetujui yang belum tertaut pembetulannya, dengan umur dan nama orangnya; ikut "perlu perhatian" Pemilik dan GM setelah 2 hari (PRI-37 butir 4) | 4E-5c |
| Penghitung koreksi periode lalu (tambahan) | Saat pembetulan gaji periode lalu Berlaku | Menjalankan R1 periode lama dengan paket yang dibetulkan dan menulis selisihnya; sama dengan mesin 4E-2 | 4E-5c |

---

## 7. Pemberitahuan (titipan 4J)

| Pemberitahuan | Kepada | Antrean, Beranda, atau layar | Alasan |
|---|---|---|---|
| Usulan ubah gaji menunggu | Pemilik, GM | Antrean (PRI-37 butir 4) | Perlu diputuskan sebelum periodenya ditutup |
| Gaji saya berubah mulai tanggal … (tanpa nominal) | Orangnya | Antrean | Supaya tidak kaget di slip |
| Gaji diubah langsung oleh Pemilik atau GM | Pemilik dan GM lain | Beranda | KAR-73 |
| Orang belum punya gaji | HR (Pemilik dan GM untuk jabatan bertanda) | Antrean | Slipnya tidak bisa dihitung |
| Usulan ditolak | Pengusul | Antrean | Supaya tahu alasannya |
| Pengaturan gaji akan berubah | Orang yang terkena | Pengumuman (Papan, PRI-35) | GAJ-57 |
| Pembuat periode gagal | GM, Pemilik | Antrean | PRI-33 butir 2 |
| Usulan tiadakan potongan telat (dari penjelasan disetujui) | Pemilik, GM | Antrean | Harus diputuskan sebelum slip ditutup (GAJ-11, KEH-66) |
| Masih ada usulan tiadakan yang belum diputuskan saat batas tutup mendekat | Pemilik, GM; HR melihat | Antrean (pengingat berantai, TAM-22) | Supaya tidak terlewat; slip **tidak** tertahan karenanya |
| Potongan Anda ditiadakan | Orangnya | Antrean | Supaya tahu, tanpa harus membuka slip |
| Ada koreksi periode lalu di slip Anda | Orangnya | Beranda | Baris baru di slip yang mungkin mengejutkan |
| Penulis denda atau penghitung koreksi gagal | GM, Pemilik | Antrean | PRI-33 |
| Usulan potongan (kehilangan barang, minus kas catat tangan, Potongan Lain) menunggu | Pemilik, GM | Antrean | Harus disahkan sebelum slip ditutup supaya masuk periodenya |
| Bagian kehilangan barang Anda | Tiap orang yang menanggung | Antrean | Supaya tidak kaget di slip; menyebut nilai, cabang, tanggal opname, bagiannya |
| Anda dibebani minus kas / Potongan Lain | Orangnya | Antrean, dengan tombol Ajukan keberatan | GAJ-81 |
| Keberatan potongan menunggu | Pemilik, GM | Antrean | GAJ-81 |
| Keputusan keberatan potongan | Orangnya | Antrean | Supaya tahu hasilnya dan alasannya |
| Cabang tanpa persen kantor, jabatan tanpa bobot | Pemilik, GM | Antrean | Kehilangan barang tidak bisa dicatat |
| Ada sisa potongan dibawa ke slip berikutnya | Orangnya | Beranda | Supaya tahu gaji berikutnya ikut terpotong |
| Sisa potongan menjadi Piutang Lain (slip terakhir) | Pemilik, GM, Finance | Antrean | KEU-74 |
| Bonus menunggu pengesahan (per tab) | HR, Pemilik, GM (Bonus Bebas: Pemilik, GM) | Antrean | Harus diputuskan sebelum slip ditutup supaya masuk periodenya |
| Bonus menunggu saat batas tutup mendekat | HR, Pemilik, GM | Antrean (pengingat berantai, TAM-22) | Supaya tidak terlewat |
| Bonus Anda disahkan / ditolak / dibatalkan (dengan alasan) | Orangnya | Beranda (ditolak dan dibatalkan: Antrean) | Supaya tahu tanpa membuka slip |
| Bonus ditahan: penerima di luar jabatan penerima | HR (Pemilik, GM untuk jabatan bertanda) | Antrean | Uang tidak boleh tertahan diam-diam |
| Perubahan dari kasir atas bonus yang sudah disahkan | HR (bonus jabatan Pemilik: Pemilik, GM) | Antrean | PRI-41 |
| Pengesahan ditolak karena Dana Disiplin kurang | Pemilik, GM | Antrean | Supaya bisa memutuskan pindah dana atau menolak |
| Slip terakhir tertahan karena bonus menunggu | HR, Pemilik, GM | Antrean | B6 |
| Dana dipindah atau disesuaikan | Pemilik dan GM lain | Beranda | KAR-73 |
| Usulan Bonus Bebas menunggu | Pemilik, GM | Antrean | B1 |
| Slip periode … belum ditutup, lewat batas (dengan daftar tertahan) | HR, Pemilik, GM | Antrean (pengingat berantai, TAM-22) | S1 |
| Slip Anda tertahan karena … (penahan dan penyelesainya) | Penyelesai penahan itu | Antrean | S2; supaya penahan cepat diputuskan |
| Slip Anda sudah ditutup; keberatan sampai … | Orangnya | Beranda | GAJ-42; isi slip dibuka di Pendapatan Saya (4E-5c) |
| Minta buka kembali slip … (alasan HR) | Pemilik, GM | Antrean | S3 |
| Slip Anda sedang dibetulkan: [alasan] | Orangnya | Antrean | S3; supaya tidak kaget angkanya berubah |
| Slip dibuka kembali / ditutup lebih cepat / GM menutup slipnya sendiri | Pemilik dan GM lain | Beranda | KAR-73 |
| Tutup semua: sebagian slip gagal | Penekan; GM | Antrean | PRI-33 |
| Dana Disiplin: Tersedia minus karena slip dibuka kembali | Pemilik, GM | Antrean | 4E-5a |
| Ada slip / bayar di luar slip lewat jatuh bayar, belum ditandai Dibayar (per jalur, jumlah, paling lama) | Pemilik, GM | Antrean (pengingat berantai, TAM-22, 25) | GAJ-59, DRV-27 |
| Gaji [periode] dibayar tanggal … lewat tunai/transfer | Orangnya | Beranda | KEU-24 |
| Tidak ada uang yang dibayarkan: seluruhnya terpakai potongan (slip Rp0) | Orangnya | Beranda | Y4 |
| Pembayaran gaji [periode] dibatalkan: [alasan] | Orangnya | Antrean | Supaya tidak bingung soal uang yang belum diterima |
| Pembayaran dibatalkan / GM menandai slipnya sendiri Dibayar | Pemilik dan GM lain | Beranda | KAR-73 |
| Bayar sekaligus: sebagian gagal | Penekan; GM | Antrean | PRI-33 |
| Slip siap ditransfer (jumlah per periode, tanpa nama) | Finance | Perlu perhatian | Y2 |
| Gaji bisa mundur: urusan yang belum beres (GAJ-44) | Orangnya | Beranda (perlu perhatian saya) | Pengingat isi penjelasan sudah dikirim Kehadiran (4D); di sini tidak ada jendela tambahan supaya tidak dobel |
| Keberatan slip menunggu | Penyetuju macamnya | Antrean (pengingat berantai, PRI-37 butir 4) | GAJ-42, 60 |
| Keberatan slip diputuskan (alasan bila ditolak) | Pengaju | Antrean | Supaya tahu hasilnya |
| Keberatan disetujui, belum tertaut pembetulan | Penyetuju; Pemilik dan GM setelah 2 hari | Antrean (pengingat berantai) | C3; yang sudah disetujui tidak boleh terlupa |
| Keberatan Anda sudah dibetulkan: [baris] Rp… di slip [periode] | Pengaju | Beranda | C3 |
| Pembetulan gaji periode lalu dicatat | Pemilik dan GM lain; orangnya (tanpa nominal) | Beranda | KAR-73; seperti GAJ-63 |
| Akses Anda terbatas sampai urusan gaji selesai / berakhir | Mantan karyawan | Beranda (bilah) | C4 |

---

## 8. Pengaturan (titipan 4J)

Semua melalui kerangka Pengaturan 4B (BER-L40, L41), bertanggal berlaku
(WAJ-07). Angka yang dipakai slip **hanya mulai berlaku tanggal 26** (G6).
Pengubah: Pemilik dan GM langsung; HR mengusulkan (G6). Angka aturan yang
rumusnya ditulis di 4E-2 s.d. 4E-4 didaftarkan di sini sekarang supaya ada
satu daftar.

| Pengaturan | Angka awal | Wajib diumumkan | Boleh dikecualikan per orang (PRI-26) | Rumus di |
|---|---|---|---|---|
| Awal dan akhir periode bulanan | 26 sampai 25 | ya | tidak | 4E-1 |
| Awal minggu upah | Jumat (sampai Kamis) | ya (ke slip mingguan) | tidak | 4E-1, 4G |
| Pembagi gaji harian | 26 | ya | tidak | 4E-2 |
| Tarif telat | Rp1.000 per menit | ya | tidak | 4E-2 |
| Tarif lembur | Rp7.500 per jam | ya | tidak | 4E-2 |
| Lembur paling sedikit dibayar | 60 menit, lalu per jam penuh | ya | tidak | 4E-2 |
| Pengali izin dan sakit tanpa surat | 1; 1,25; 1,5; 1,75; 2 | ya | tidak | 4E-2 |
| Pengali izin mendadak | 1,25; 1,5; 1,6; 1,7; 1,8; 1,9; 2 | ya | tidak | 4E-2 |
| Pengali alpha | 1,5; 2; 2,25; 2,5; 2,75; 3 | ya | tidak | 4E-2 |
| Sakit dengan surat dokter | hari 1: 0; hari 2–3: 0,5; hari 4 dst: 1 | ya | tidak | 4E-2 |
| Pengali Training | 1, tidak naik | ya | tidak | 4E-2 |
| Kompensasi libur | 1 gaji harian per hari | ya | tidak | 4E-2 |
| Denda lupa absen masuk | Rp15.000 | ya | tidak | 4E-2 |
| Denda lupa absen pulang | Rp5.000 | ya | tidak | 4E-2 |
| Denda lupa Masuk Kembali | Rp5.000 (KEH-154; dibahas di 4E-2) | ya | tidak | 4E-2 |
| Denda tidak memilih libur | Rp10.000 | ya | tidak | 4E-2 |
| Tambahan denda lupa absen mulai kejadian ke-5 | Rp5.000 | ya | tidak | 4E-2 |
| Persen kantor per cabang, bobot per jabatan (kehilangan barang) | diisi pemilik saat tayang; persen 0–100, bobot 1–9, bilangan bulat; bersasaran cabang atau jabatan | ya (ke cabang atau jabatan itu) | tidak | 4E-3 |
| Urutan pengambilan potongan | telat, tidak hadir, denda → kehilangan, minus kas → potongan lain → kasbon; sisa potongan lebih dulu di kelompoknya | ya | tidak | 4E-3 |
| Paling banyak kali potong Potongan Lain | 3 | ya | tidak | 4E-3 |
| Masa keberatan potongan | 3 hari sejak diberi tahu | ya | tidak | 4E-3 |
| Jadwal mesin Pemeriksa tanggungan, Penutup keberatan potongan | 06.00, 00.30 | tidak | tidak | 4E-3 |
| Perkiraan akhir dan masa keberatan | tanggal 26–28 | ya | tidak | 4E-5 |
| Batas menutup slip | hari ke-4 setelah periode berakhir | tidak | tidak | 4E-5 |
| Tanggal gajian | tanggal 1 | ya | tidak | 4E-5 |
| Masa keberatan setelah ditutup | 3 hari | ya | tidak | 4E-5 |
| Jumlah periode dibuat ke depan | 3 bulanan, 13 minggu upah | tidak | tidak | 4E-1 |
| Jadwal mesin Pembuat periode, Pemeriksa gaji kosong | 00.10, 06.00 | tidak | tidak | 4E-1 |
| Akibat lewat batas istirahat (KEH-86) | **kosong** = hanya dicatat, tanpa rupiah (K5) | ya | tidak | 4E-2 |
| Persen bonus grooming (bersasaran jenis bonus) | 10% dari harga jasa sesudah diskon, dibulatkan ke bawah | ya (ke jabatan penerima) | tidak | 4E-4 |
| Persen bonus ongkir (bersasaran jenis bonus) | 50% dari ongkir sesudah diskon, dibulatkan ke bawah (LOG-77) | ya | tidak | 4E-4 |
| Jabatan penerima tiap jenis bonus | Grooming dan Ongkir: semua jabatan kecuali GM (Grooming juga Pemilik); Bonus Bebas: semua kecuali Pemilik dan GM; Promo dan Bonus Terukur: menurut target atau aturannya di Kinerja | ya | tidak | 4E-4 |
| Sumber dana tiap jenis bonus | Grooming, Ongkir, Promo: Uang kantor; Bonus Bebas: dipilih per baris (B1); Bonus Terukur: per aturan (KIN-15) | tidak | tidak | 4E-4 |
| Boleh untuk jabatan Pemilik | hanya Grooming | tidak | tidak | 4E-4 |
| Jadwal mesin Pembentuk bonus promo, Pemeriksa penerima, Pengingat bonus menunggu | 00.10 tanggal 26; 06.00; 2 hari sebelum batas tutup | tidak | tidak | 4E-4 |
| Jadwal mesin Pembuat slip, Pengingat tutup slip | 00.15 tanggal mulai periode; 07.00 sejak batas tutup | tidak | tidak | 4E-5a |
| Panjang alasan paling sedikit (buka kembali, tutup lebih cepat, minta buka kembali) | 15 huruf | tidak | tidak | 4E-5a |
| Panjang alasan paling sedikit (batal bayar) | 15 huruf | tidak | tidak | 4E-5b |
| Tanggal uang paling jauh ke belakang tanpa alasan (Y1) | 7 hari (dibaca dari pengaturan KEU-12, tidak disimpan dua kali) | tidak | tidak | 4E-5b |
| Foto bukti bayar gaji (pengaturan KEU-11, milik Keuangan) | dianjurkan | tidak | tidak | 4E-5b |
| Jadwal mesin Pengingat belum Dibayar | 07.00 | tidak | tidak | 4E-5b |
| Masa keberatan "uang belum saya terima" (C2) | 7 hari sejak ditandai Dibayar | ya | tidak | 4E-5c |
| Lama akses terbatas mantan karyawan sesudah slip terakhir Dibayar (C4) | 7 hari (lebih lama bila masih ada keberatan atau tagihan) | ya | tidak | 4E-5c |
| Panjang alasan paling sedikit (keberatan slip; penolakannya) | 20 huruf; 15 huruf | tidak | tidak | 4E-5c |
| Paling banyak periode dalam satu unduhan atau satu rentang Total Diterima | 12 | tidak | tidak | 4E-5c |
| Jadwal mesin Pengingat pembetulan keberatan | 07.00 | tidak | tidak | 4E-5c |

Toleransi telat 5 menit milik Kehadiran (KEH-22); di sini hanya dibaca.

---

## 9. Jenis pengajuan (titipan 4J)

**Satu**, "Usulan ubah gaji" (G1): pengaju HR; penyetuju Pemilik atau GM;
tertutup (hanya pengaju, penyetuju, dan para pemilik melihat); batas waktu:
**batas tutup slip periode yang dipilih**. Akibat disetujui: perubahan
terjadwal berlaku. Akibat ditolak: tidak ada perubahan, pengusul diberi tahu
alasannya. **Akibat terlewat** (periodenya keburu ditutup): Hangus; pengusul
diberi tahu dan boleh mengusulkan lagi untuk periode berikutnya. Usulan
pengaturan gaji memakai jenis baku kerangka 4B (BER-L41), bukan jenis baru.

**4E-2 tidak menambah jenis pengajuan.** Usulan meniadakan potongan telat
(KEH-66) lahir otomatis dari penjelasan yang disetujui di Kehadiran dan
diputuskan di GAJ-L10; tidak ada batas waktu yang membuatnya Hangus, karena
usulan yang belum diputuskan saat slip ditutup berarti **tetap dipotong**
(slip tidak ditahan, GAJ-43 tidak menyebutnya). Pemilik dan GM diingatkan
sebelum batas tutup (bagian 7).

**4E-3 menambah dua jenis:**

1. **"Usulan potongan"** (kehilangan barang, minus kas catat tangan, Potongan
   Lain): pengaju HR (minus kas juga Finance); penyetuju Pemilik atau GM;
   tertutup (pengaju, penyetuju, para pemilik). Batas waktu: **tidak hangus**,
   karena kerugiannya nyata. Akibat disetujui: catatan Berlaku atau Berjalan.
   Akibat ditolak: tidak ada potongan, pengaju diberi tahu alasannya.
   **Akibat terlewat** (slip periodenya keburu ditutup): tetap menunggu;
   kalau disetujui kemudian, masuk slip berikutnya dengan keterangan periode
   asal (GAJ-50). Pengingat berantai sebelum batas tutup (TAM-22).
2. **"Keberatan potongan"** (GAJ-81): pengaju orang yang dikenai minus kas
   catat tangan bernama atau Potongan Lain; penyetuju Pemilik atau GM, bukan
   dirinya sendiri; tertutup. Batas mengajukan 3 hari sejak diberi tahu,
   lewat itu tidak bisa diajukan. Akibat Tetap: potongan berjalan. Akibat
   Ditiadakan: potongan berhenti; yang sudah terpotong di slip tertutup
   kembali lewat baris koreksi plus di slip berikutnya. **Akibat belum
   diputuskan:** potongan tetap berjalan; slip tidak tertahan.

**4E-4 menambah satu jenis:** **"Usulan bonus"** (Bonus Bebas dan jenis
ketik lain, B1): pengaju HR; penyetuju Pemilik atau GM, bukan untuk dirinya
sendiri; tertutup (pengaju, penyetuju, para pemilik). Batas waktu: **tidak
hangus**. Akibat disetujui: baris Disahkan (Dana Disiplin diperiksa). Akibat
ditolak: tidak ada bonus, pengaju diberi tahu alasannya. **Akibat terlewat**
(slip periodenya keburu ditutup): tetap menunggu; bila disetujui kemudian
masuk slip berikutnya dengan keterangan periode asal (GAJ-50). Bonus
Grooming, Promo, dan Terukur **bukan** pengajuan: barisnya lahir dari data
dan diputuskan di GAJ-L20.

**4E-5a tidak menambah jenis pengajuan.** Menutup, tutup lebih cepat, dan
membuka kembali adalah tindakan langsung yang beralasan dan tercatat di
`langkah_slip`. "Minta buka kembali" dari HR hanya pemberitahuan Antrean ke
Pemilik dan GM (tanpa status setuju atau tolak dan tanpa batas waktu);
Pemilik atau GM menjawabnya dengan membuka kembali atau tidak. Keberatan
slip (GAJ-42, 60) ditulis di 4E-5c.

**4E-5b tidak menambah jenis pengajuan.** Bayar, batal bayar, dan bayar di
luar slip adalah tindakan langsung Pemilik atau GM yang tercatat di
`langkah_slip` dan `bayar_luar_slip`. Daftar Transfer tidak meminta
persetujuan: finance mentransfer sesudah ACC lisan seperti sekarang, dan
yang menandai Dibayar tetap Pemilik atau GM.

**4E-5c menambah satu jenis:** **"Keberatan slip"** (GAJ-42, 60; C2, C3),
dua macam. Pengaju: orang pemilik slip (termasuk mantan karyawan dalam akses
terbatas). Penyetuju: "Ada yang salah" HR, Pemilik, GM (slip GM: Pemilik;
slip jabatan Pemilik: GM atau Pemilik lain); "Uang belum saya terima"
Pemilik, GM. Tertutup (pengaju, penyetuju, para pemilik). Batas
**mengajukan**: macam pertama sejak periode berakhir sampai 23.59 hari ke-3
sesudah slip ditutup; macam kedua 7 hari sesudah Dibayar; lewat itu tombol
hilang. Akibat disetujui: penyetuju memilih jalan pembetulan, lalu
menautkan pembetulannya (pengingat berantai sampai tertaut). Akibat ditolak:
pengaju diberi tahu alasannya, boleh mengajukan ulang selama masa keberatan.
**Akibat belum diputuskan:** tidak Hangus dan tidak menahan slip; pengingat
berantai ke penyetuju (PRI-37 butir 4).

---

## 10. Kejadian di lapangan

| No | Kejadian | Sistem berbuat apa | Aturan |
|---|---|---|---|
| 1 | Gaji Rina naik mulai 26 November; slip Oktober dibuka lagi | Tetap memakai gaji lama; rincian slip tersimpan | GAJ-04, 39 |
| 2 | Kenaikan disepakati tanggal 10 November untuk periode berjalan (26 Okt – 25 Nov) | Boleh dipilih berlaku 26 Oktober selama slip November belum ditutup | G2 |
| 3 | Pemilik ingin menurunkan gaji di periode berjalan | Ditolak; penurunan hanya untuk periode depan | G2 |
| 4 | HR mengusulkan kenaikan tanggal 27 November untuk periode November yang slipnya sudah ditutup | Pilihan periode itu tidak ada; hanya periode berjalan dan depan | GAJ-04 |
| 5 | Usulan HR belum diputuskan sampai slip periodenya ditutup | Usulan Hangus; HR diberi tahu dan boleh mengusulkan untuk periode berikutnya | bagian 9 |
| 6 | Pemilik mengubah Gaji Standar Karyawan | Gaji orang yang sudah ada tidak berubah; layar periksa menyebutnya | GAJ-03 |
| 7 | Training dipromosikan tanggal 10 November | Gaji Standar Karyawan terjadwal mulai 26 November; tunjangan lain yang sudah ada dibawa | KAR-22 |
| 8 | Orang baru disetujui tanpa gaji | Tanda "Belum ada gaji" di GAJ-L01 dan "perlu perhatian" HR; tombol isi dari Gaji Standar | bagian 6 |
| 9 | HR membuka Gaji Karyawan | Pemilik dan GM tidak tampil sama sekali | GAJ-46, KAR-83 |
| 10 | Admin HR membuka tab Gaji di halaman orang | Tab tidak tampil; dicoba lewat alamat langsung, server menolak | KAR-77 |
| 11 | GM menaikkan gajinya sendiri | Boleh, langsung terjadwal; para pemilik diberi tahu | KAR-67, 73 |
| 12 | HR (merangkap jabatan lain) mengusulkan kenaikan gajinya sendiri | Boleh mengusulkan; tidak boleh memutuskan | PRI-37 b3 |
| 13 | Jenis "Tunjangan Jabatan" dinonaktifkan padahal masih dipakai 5 orang | Ditolak; pesan menyebut kelima nama | GAJ-L04 |
| 14 | Tarif lembur diubah tanggal 10 November | Tanggal berlaku hanya bisa 26 November atau sesudahnya | G6 |
| 15 | Tanggal bayar diubah menjadi tanggal 2 mulai Januari | Periode yang belum mulai disalin ulang; periode berjalan tetap tanggal 1 | PRI-34 b2 |
| 16 | Mesin Pembuat periode mati seminggu | Saat hidup, periode yang kurang dibuat berurutan tanpa dobel; GM diberi tahu | PRI-33 |
| 17 | Karyawan bertanya kenapa dipotong Rp6.000 karena telat 6 menit | Buka Aturan Potongan: kartu telat dengan contoh dari rumus yang sama | GAJ-23 |
| 18 | Kasir membuka Aturan Potongan | Kartu denda driver tidak tampil | PRI-29 |
| 19 | Upah ritase seorang kenek bertanggal 25 November masuk minggu upah 21–27 November | Slip mingguan utuh; di Pendapatan Saya barisnya ikut periode November | PRI-34 b5 |
| 20 | Rina telat 6 menit | Dipotong Rp6.000; di rekap ia hanya melihat "6 menit" | GAJ-10, KEH-119 |
| 21 | Rina telat 40 menit karena ban bocor, penjelasannya disetujui HR | Muncul sebagai usulan di GAJ-L10; pemilik menekan Tiadakan; slip menampilkan Rp40.000 bertanda "ditiadakan: ban bocor" | GAJ-11, KEH-66 |
| 22 | Usulan tiadakan belum diputuskan sampai slip ditutup | Potongan tetap berjalan; slip tidak tertahan; pemilik sudah diingatkan | bagian 9 |
| 23 | HR mencoba meniadakan potongan telat | Ditolak server | GAJ-11 |
| 24 | Budi alpha 12 dan 14 November | Alpha pertama × 1,5, kedua × 2 | GAJ-13 |
| 25 | Budi izin 3 November, alpha 12 November | Izin hari ke-1 (× 1), alpha hari ke-1 (× 1,5): tangganya terpisah (K1) | K1 |
| 26 | Sari sakit dengan surat 3 November (1 hari) dan 20–21 November (2 hari) | Dihitung per periode (K1): 0 + 0,5 + 0,5 | K1 |
| 27 | Training alpha 2 hari | 1 + 1 (K2) | GAJ-13, K2 |
| 28 | Dedi lupa absen pulang 5 kali dalam November, penjelasannya disahkan tidak berurutan | Yang tanggalnya ke-5 kena Rp10.000, berapa pun urutan pengesahannya | KEH-154 |
| 29 | Penjelasan lupa absen ke-3 dicabut | Baris denda ke-3 dibatalkan; urutan dihitung ulang; yang tadinya ke-5 menjadi ke-4 (Rp5.000), ditulis ulang | KEH-158 |
| 30 | Dedi lupa Masuk Kembali 5 kali | Ke-5 kena Rp10.000; dihitung terpisah dari lupa pulang | KEH-87, 154 |
| 31 | Lupa absen pulang 20 November, pengajuan terlambat disahkan 2 Desember setelah slip November ditutup | Baris denda bertanggal 20 November masuk slip Desember dengan keterangan periode asal | GAJ-50, KEH-155 |
| 32 | Lia tidak memilih libur sampai 25 November 23.59 | Denda Rp10.000 bertanggal 26 November, masuk periode Desember, sekali saja | KEH-135 |
| 33 | Andi diminta masuk di hari liburnya, absen masuk | Kompensasi 1 gaji harian; libur pengganti dipilih dalam 14 hari | GAJ-15, KEH-138 |
| 34 | Andi diminta masuk tetapi tidak datang | Tidak ada kompensasi; hari itu tetap libur | KEH-138 |
| 35 | Andi datang sendiri di hari liburnya tanpa diminta | Tidak ada kompensasi | GAJ-15, KEH-46 |
| 36 | Lembur 2 jam diklaim, disahkan 1 jam | Dibayar 1 × Rp7.500 | GAJ-12, KEH-162 |
| 37 | Koreksi absen 12 November dicatat 3 Desember (slip November sudah ditutup): alpha menjadi hadir | Koreksi periode lalu di slip Desember, dihitung dengan angka November; alpha 14 November turun dari × 2 ke × 1,5 | K4, PRI-04 |
| 38 | Surat dokter masuk sesudah slip ditutup, masih dalam batas 3 hari | Hari itu dihitung ulang sebagai sakit dengan surat; selisihnya tambahan di slip berikutnya | KEH-143, K4 |
| 39 | Hari tutup dipasang mundur untuk 15 November sebelum slip ditutup | Alpha hari itu menjadi Hari tutup; perkiraan langsung berubah | KEH-105 |
| 40 | Orang masuk 16 November (periode 31 hari) | Gaji tetap × 10/31 | GAJ-06 |
| 41 | Masih ada hari "belum ditentukan" saat perkiraan dibuka | Tidak dipotong; tanda kuning | KEH-118 |
| 42 | Pemilik membuka slipnya sendiri | Hanya gaji tetap, tanpa baris kehadiran | GAJ-09 |
| 43 | Opname Toko Raja 20 November menemukan kehilangan Rp1.000.000; HR mencatat | Usulan menunggu Pemilik atau GM; setelah disahkan dibagi dan tiap orang diberi tahu bagiannya | GAJ-76 |
| 44 | HR mencatat kehilangan tanpa foto hasil opname | Ditolak; lampiran wajib | GAJ-76 |
| 45 | Citra berhenti tanggal 10, Dodi masuk tanggal 11 | Keduanya menanggung sebanding hari; sisanya ke kantor, tidak ke kepala toko dan Budi | GAJ-18, 77 |
| 46 | Budi perbantuan 3 hari di Toko Markas | Tetap menanggung penuh di Toko Raja; tidak ikut di Markas | GAJ-77 |
| 47 | Budi pindah ke Markas tanggal 16 | Menanggung di Raja menurut hari sebelum pindah (26 Oktober s.d. 15 November, 21 hari) dan di Markas menurut sisanya (10 hari), bila ada kehilangan di keduanya | GAJ-18 |
| 48 | Usulan kehilangan November baru disahkan 3 Desember, setelah slip November ditutup | Dibagi menurut orang periode November; bagiannya masuk slip Desember dengan keterangan "periode November"; bagian Citra yang sudah berhenti ditanggung kantor | GAJ-50, 77 |
| 49 | Persen kantor Toko Raja belum diisi | Kehilangan tidak bisa dicatat; "perlu perhatian" Pemilik dan GM | GAJ-L14 |
| 50 | Penempatan Dodi ternyata salah cabang dan dibetulkan sebelum slip ditutup | Pembagian dihitung ulang otomatis | bagian 6 |
| 51 | Kasir kurang Rp50.000 di Laporan Kasir, lebih Rp20.000 di laporan lain periode yang sama | Dipotong Rp30.000 | KEU-54, GAJ-78 |
| 52 | Kasir mengajukan keberatan selisih, belum diputuskan sampai slip ditutup | Tetap terpotong; bila kemudian ditiadakan, kembali di slip berikutnya | KEU-55, GAJ-78 |
| 53 | Uang laci kurang Rp90.000 di luar Laporan Kasir, tidak tahu siapa | Finance mencatat tanpa nama; setelah disahkan dibagi rata ke tiga orang bertanda yang hadir hari itu: Rp30.000 | GAJ-79 |
| 54 | Minus kas tanpa nama di hari tidak ada yang hadir | Ditolak; harus memilih nama atau dibatalkan | GAJ-79 |
| 55 | Uang beberapa shift bercampur di laci | Tidak dicatat sebagai minus kas siapa pun; ditandai untuk GM (Keuangan) | KEU-51 |
| 56 | Groomer merusak hair dryer, ganti rugi Rp600.000, dicicil 3 kali | Potongan Lain Rp200.000 per slip mulai periode disahkan | GAJ-80 |
| 57 | Groomer itu merasa bukan salahnya | Keberatan dalam 3 hari; Pemilik atau GM memutuskan Tetap atau Ditiadakan; selama menunggu cicilan berjalan | GAJ-81 |
| 58 | Keberatan dikirim hari ke-4 | Tombol sudah tidak ada; jalur yang tersisa keberatan slip (GAJ-42) | GAJ-81 |
| 59 | Keberatan diterima setelah satu cicilan terpotong di slip tertutup | Cicilan berikutnya berhenti; Rp200.000 kembali di slip berikutnya | GAJ-81 |
| 60 | Pendapatan Rp1.000.000, potongan Rp1.150.000 | Bersih Rp0; kasbon terpotong Rp100.000; sisa Rp150.000 dibawa | GAJ-75 |
| 61 | Bulan berikutnya ada sisa kasbon Rp150.000 dan cicilan baru Rp125.000 | Sisa diambil lebih dulu di kelompok kasbon | GAJ-75 |
| 62 | Denda lupa absen tidak tertampung lalu terpotong bulan depan | Masuk Dana Disiplin bulan depan, saat benar-benar terpotong | GAJ-75, 33 |
| 63 | Rina berhenti; slip terakhir tidak cukup untuk alpha Rp150.000 dan kehilangan Rp80.000 | Alpha "tidak tertagih"; kehilangan menjadi Piutang Lain | GAJ-82 |
| 64 | Andi berhenti dengan sisa kasbon Rp200.000 yang belum jatuh tempo | Seluruhnya ditagih di slip terakhir; yang tidak tertampung menjadi Piutang Lain | GAJ-53, 82 |
| 65 | Andi berhenti tanpa pemberitahuan; bersih sesudah semua potongan Rp900.000 | Baris denda Rp900.000; diterima Rp0; denda masuk Dana Disiplin | GAJ-58, 82 |
| 66 | Kenek berslip bulanan (gudang) punya Potongan Lain; ia juga punya slip mingguan sebagai kenek | Dipotong dari slip bulanan saja; slip mingguannya utuh | DRV-04, 05 |
| 67 | Driver berslip mingguan punya Potongan Lain Rp300.000 dicicil 3 kali | Rp100.000 per slip mingguan | DRV-23 |
| 68 | HR mengajukan Potongan Lain untuk GM | Tidak bisa dipilih; jabatan Pemilik dan GM tidak kena potongan | GAJ-09 |
| 69 | Rina mengerjakan 23 jasa grooming dalam November | 23 baris Menunggu; HR mengesahkan sekaligus per Rina per periode, ditahan 3 detik | B2 |
| 70 | Satu kucing ganti groomer di kasir sebelum disahkan | Baris lama dibatalkan, baris baru untuk groomer kedua bertanda ⚠; diputuskan satu per satu | GAJ-61 |
| 71 | Nota grooming diretur di kasir setelah bonus masuk slip | Masuk tab Perubahan dari kasir; HR Terima perubahan: koreksi bonus minus di slip berikutnya | PRI-41 |
| 72 | Pemilik yang juga groomer mengerjakan grooming | Bonus tercatat, tidak tampil di layar HR, disahkan Pemilik atau GM yang lain | GAJ-09, 61 |
| 73 | Kasir dipasangkan sebagai groomer, padahal jabatan kasir bukan penerima Grooming | Baris Ditahan dan masuk "perlu perhatian" HR; tidak dibayar sampai diputuskan | 4E-4 |
| 74 | Pengantar antar barang tanpa foto lengkap | Bonus ongkir tercatat Disahkan bertanda ⚠; HR boleh membatalkan dengan alasan | LOG-76 |
| 75 | Nota gratis ongkir | Tidak ada baris bonus | LOG-76 |
| 76 | Driver menjadi pengantar di nota kasir | Bonus ongkir masuk slip mingguannya, minggu upah tanggal nota | B3 |
| 77 | Aturan "sebulan tanpa telat" Rp100.000 dari Dana Disiplin; 6 orang memenuhi; Tersedia Rp450.000 | Pengesahan ditolak, kurang Rp150.000; keenamnya tetap menunggu bersama | B5, GAJ-34 |
| 78 | Pemilik memindah Rp200.000 dari Dana Tidak Hadir, lalu mengesahkan aturan itu | Diterima; Terpesan naik Rp600.000; saldo turun saat slip ditutup | GAJ-35, 34 |
| 79 | HR ingin memberi bonus Rp100.000 karena membantu stock opname sampai malam | HR mengajukan Bonus Bebas; Pemilik atau GM mengesahkan | B1 |
| 80 | Laporan promo struk 24 November dilaporkan 27 November | Bonus dipotong 50%, menjadi baris susulan periode November, masuk slip November bila belum ditutup | KIN-21, 22 |
| 81 | Andi berhenti 10 November; masih ada bonus grooming menunggu | Slip terakhir tertahan sampai bonus diputuskan; HR diingatkan | B6 |
| 82 | Laporan promo Andi baru disetujui setelah slip terakhirnya dibayar | Pemilik atau GM membayar bonus di luar slip dalam satu langkah; tercatat di Buku Bonus, Buku Upah, dan keuangan | B6, GAJ-27 |
| 83 | Andi berhenti tanpa pemberitahuan dan pemilik menetapkan GAJ-58 | Semua bonusnya yang belum dibayar Hangus; dana terpesan dilepas | GAJ-58 |
| 84 | Slip November dibuka kembali setelah ditutup | Mutasi Dana Disiplin dan Dana Tidak Hadir slip itu dibalik; ditulis ulang saat ditutup lagi | GAJ-49 |
| 85 | Telat 40 menit ditiadakan | Tidak masuk Dana Disiplin | GAJ-11 |
| 86 | Denda lupa absen Rp15.000 tidak tertampung slip November, terpotong di Desember | Masuk Dana Disiplin saat slip Desember ditutup | GAJ-75 |
| 87 | Hari pertama v3 | Pemilik mengisi saldo awal kedua dana dari hitungan periode terakhir sistem lama | SIS-33 |
| 88 | Persen bonus grooming diubah 12% mulai 26 Januari | Jasa yang diambil 25 Januari tetap 10%; 26 Januari 12%; diumumkan lebih dulu | GAJ-25, 67 |
| 89 | Tanggal 29 November, 40 slip; klaim lembur Andi belum diputuskan | "Tutup semua yang siap": 39 ditutup; Andi tertahan, tampil di tab Tertahan dengan penahan "klaim lembur menunggu" dan tombol ke layarnya | S1, S2 |
| 90 | Klaim Andi diputuskan 2 Desember | HR menutup slip Andi hari itu; dibayar menyusul (4E-5b) | S2 |
| 91 | HR mencoba menutup tanggal 27 | Tombol mati: "Aktif mulai 29 November 00.00" | S1 |
| 92 | Tanggal 29 tidak ada yang menutup | 30 November 07.00 pengingat berantai ke HR, Pemilik, GM, berulang tiap hari | S1 |
| 93 | Tanggal 29 sore HR sadar kenaikan gaji Rina lupa dicatat; slip belum dibayar | HR menekan Minta buka kembali; GM membuka kembali beralasan; Rina diberi tahu "sedang dibetulkan"; gaji dicatat; ditutup ulang, nomor sama, versi 2, keberatan dihitung ulang | S3 |
| 94 | Slip Rina sudah dibayar lalu ketahuan salah | Tidak bisa dibuka kembali; koreksi di slip berikutnya | GAJ-49 |
| 95 | Slip November Andi ingin dibuka kembali, padahal slip Desembernya sudah ditutup | Ditolak dengan sebab "slip berikutnya sudah ditutup"; koreksi di slip Januari | 4E-5a |
| 96 | Budi berhenti 10 November, minta dibayar tanggal 12 | 11 November GM menekan Tutup lebih cepat; dihitung 26 Okt – 10 Nov; sisa kasbon ditagih; keberatan 3 hari | S4 |
| 97 | Opname 25 November menemukan kehilangan di cabang Budi | Dibagi menurut orang periode itu; bagian Budi ditanggung kantor | GAJ-77, S4 |
| 98 | Budi masih punya bonus grooming Menunggu saat GM ingin menutup cepat | Tombol ditolak dengan penahan "bonus menunggu"; HR memutuskan dulu | GAJ-89 |
| 99 | HR mengusulkan Budi berhenti tanpa pemberitahuan, belum diputuskan | Slip terakhir tertahan sampai Pemilik atau GM memutuskan | KAR-68 |
| 100 | HR dan GM menekan Tutup bersamaan untuk slip yang sama | Satu jalan; yang lain menerima "Sudah ditutup oleh … pukul …" | 4E-5a |
| 101 | "Tutup semua" 40 slip, 1 gagal karena gangguan server | 39 ditutup, 1 tetap Perkiraan; hasil menyebut nama dan sebabnya; GM diberi tahu | GAJ-47, PRI-33 |
| 102 | Usulan tiadakan telat Sinta belum diputuskan saat slipnya ditutup | Tetap dipotong; usulan berstatus Tetap dipotong | GAJ-71 |
| 103 | Absen 20 November dikoreksi tanggal 5 Desember | Catatan hari terkunci; masuk sebagai koreksi susulan di slip Desember | GAJ-72, PRI-04 |
| 104 | Slip yang memasukkan denda Rp300.000 ke Dana Disiplin dibuka kembali, padahal Saldo hanya Rp50.000 di atas Terpesan | Tetap dibuka; Tersedia −Rp250.000 tampil; pengesahan bonus bersumber dana ditolak sampai cukup; Pemilik dan GM diberi tahu | 4E-5a |
| 105 | Slip Wati bersih Rp0 karena kasbon | Ditutup biasa; sisa dibawa ke Desember | DRV-26, GAJ-52 |
| 106 | HR menekan Tutup semua | Slip Pemilik dan GM tidak ikut, tidak juga dihitung; Pemilik atau GM menutupnya sendiri | GAJ-45 |
| 107 | 1 Desember finance mentransfer 38 gaji sesudah ACC lisan; GM lupa menandai | 2 Desember 07.00 pengingat berantai ke Pemilik dan GM: "38 slip November belum ditandai Dibayar, sejak 1 Desember"; 3 Desember GM menandai sekaligus dengan tanggal uang 1 Desember | GAJ-59, Y1 |
| 108 | Finance perlu nomor rekening dan bersih untuk transfer | Membuka Daftar Transfer: nama, rekening, bersih, tanpa rincian slip, tanpa Pemilik dan GM; unduh Excel tercatat | Y2 |
| 109 | Ibu mengambil Rp40.000.000 tunai dari Brankas dan mencatat kotak Gaji/Upah | Finance memasangkannya ke slip yang dibayar tunai, jumlah bersihnya harus Rp40.000.000 persis; slip-slip itu Dibayar atas nama Ibu, satu baris uang keluar | Y3, KEU-18 |
| 110 | Jumlah slip yang dipasangkan Rp39.850.000, catatan Rp40.000.000 | Ditolak dengan menyebut selisih Rp150.000; Ibu membetulkan nominal atau sisanya dicatat kembali sebagai uang masuk | Y3 |
| 111 | Gaji Rina ditransfer ke rekening lama yang salah | GM menekan Batal bayar beralasan; baris uang keluar dibatalkan; slip kembali Ditutup di Jadwal Bayar; dibayar ulang ke rekening benar | GAJ-49 |
| 112 | Pembayaran dibatalkan 5 Januari padahal bulan Desember sudah ditutup Keuangan | Boleh; pembatalan tampil sebagai baris koreksi di bulan Januari | KEU-112 |
| 113 | Slip Wati bersih Rp0 | Langsung Dibayar "tanpa uang" saat ditutup; tidak masuk Jadwal Bayar; portal menjelaskan seluruhnya terpakai potongan | Y4 |
| 114 | Slip Andi tertahan, baru ditutup 2 Desember | Jatuh bayar 2 Desember; tampil di Jadwal Bayar "Hari ini"; diingatkan mulai 3 Desember 07.00 bila belum ditandai | Jadwal Bayar |
| 115 | Budi ditutup lebih cepat 11 November, minta dibayar 12 November | Boleh dibayar 12 November, sebelum tanggal bayar periode | GAJ-96 |
| 116 | GM membayar 38 slip sekaligus; satu slip baru saja dibuka kembali oleh Pemilik | 37 Dibayar; 1 gagal "slip tidak berstatus Ditutup"; GM diberi tahu | PRI-33 |
| 117 | Pemilik dan GM menekan Bayar untuk slip yang sama bersamaan | Satu jalan; yang lain menerima "Sudah dibayar oleh … pukul …" | 4E-5b |
| 118 | Ibu (jabatan Pemilik) ingin menandai slipnya sendiri Dibayar | Ditolak; GM yang menandai | 4E-5b |
| 119 | Gaji kasir Toko Raja dibayar dari Brankas | Baris uang keluar berbeban Toko Raja; utang Raja ke Gudang bertambah otomatis | KEU-69 |
| 120 | Andi sudah keluar dan slip terakhirnya dibayar; laporan promonya disetujui; ia masih punya Piutang Lain Rp158.065 | Bonus Rp50.000 dipotongkan ke piutang (sisa Rp108.065), tidak ada uang keluar; tagihan Dibayar "dipotongkan ke piutang" | Y5 |
| 121 | Mantan karyawan tanpa piutang mendapat koreksi plus Rp200.000 | Tagihan bayar di luar slip di Jadwal Bayar; Pemilik atau GM membayar dari Kas Pegangan | GAJ-96 |
| 122 | Finance ingin tahu total gaji November untuk persiapan uang | Ringkasan bentuk Finance: total perusahaan, sudah dan belum dibayar, tanpa nama, tanpa per cabang, tanpa gaji Pemilik dan GM | GAJ-46 |
| 123 | Karyawan bilang belum menerima, padahal slip tertanda Dibayar | Mengajukan keberatan slip (4E-5c); GM memeriksa bukti; bila memang belum, Batal bayar lalu bayar | KEU-24 |
| 124 | Tanggal 20 November Sinta membuka Pendapatan Saya | Perkiraan periode berjalan bertanda "perkiraan"; tombol keberatan belum ada, diganti arahan ke Perlu Dijelaskan dan tab Potongan | GAJ-36, C2 |
| 125 | Sinta punya 2 hari belum dijelaskan dan 1 penjelasan menunggu HR | Kotak peringatan: "Anda: 2 hari belum dijelaskan [Isi sekarang]"; "Kantor: penjelasan 12 November menunggu HR" | GAJ-44 |
| 126 | 29 November slip Sinta tertahan karena penjelasan menunggu HR | Kotak: "Gaji Anda tertahan sampai urusan ini selesai"; slip lain tetap ditutup | GAJ-44, 93 |
| 127 | Joko (driver) membuka Pendapatan Saya periode 26 Nov – 25 Des | Slip minggu Kamis 28 November tampil utuh di periode ini; ritase 23 November tampil di tab Upah periode sebelumnya bertanda "masuk slip minggu 28 November"; tidak ada tab Hitungan | C1, PRI-34 |
| 128 | Andi (pramuniaga) ikut bongkaran tanggal 10 di hari liburnya | Upah bongkaran tampil di tab Upah dan kartu Ringkasan "dibayar tunai 10 November"; tidak masuk slipnya | DRV-44, 48 |
| 129 | Tanggal 27 November Rina melihat tunjangan jabatannya di perkiraan salah | Ajukan "Ada yang salah"; HR menyetujui dengan jalan "betulkan di sumber"; Pemilik mengubah gaji periode berjalan (kenaikan boleh, GAJ-63); perkiraan berubah; HR menautkan perubahan itu | C3 |
| 130 | Slip November Rina sudah Dibayar, 2 Desember ia sadar tunjangannya kurang Rp100.000 | Keberatan dalam 3 hari sesudah ditutup; disetujui; GM mencatat pembetulan gaji periode November menunjuk keberatan itu; slip Desember memuat "Koreksi gaji tetap periode November +Rp100.000" | C3, GAJ-72 |
| 131 | HR menyetujui keberatan tetapi lupa membetulkan | Setiap hari 07.00 pengingat berantai ke HR; hari ke-3 tampil di perlu perhatian Pemilik dan GM | C3 |
| 132 | Budi mengajukan keberatan 4 hari sesudah slipnya ditutup | Tombol sudah hilang; arahan "Hubungi HR"; HR boleh menemukan kesalahan sendiri lewat jalan sumbernya | GAJ-42 |
| 133 | Wati menekan "Uang belum saya terima" 3 hari sesudah ditandai Dibayar | Masuk Persetujuan Pemilik dan GM; GM melihat foto bukti transfer ke rekening lama; disetujui, Batal bayar, bayar ulang; tertaut otomatis | C2, GAJ-103 |
| 134 | HR membuka keberatan "uang belum diterima" lewat alamat langsung | Ditolak server | C2 |
| 135 | Budi berhenti 10 November, slip terakhir dibayar 12 November | Budi masih bisa masuk dalam akses terbatas sampai 19 November 23.59 (7 hari), hanya halaman uangnya; mengajukan keberatan 13 November; akses diperpanjang sampai keberatannya selesai dibetulkan | C4 |
| 136 | 20 November Budi mencoba masuk lagi, tanpa urusan tersisa | "Akun ini tidak aktif sejak 10 November 2026. Hubungi HR." | C4, KAR-07 |
| 137 | Rina mengunduh slip Agustus s.d. Oktober untuk kredit motor | Satu PDF tiga halaman; unduhan tercatat | C4 |
| 138 | Rina mencoba mengunduh perkiraan November lewat alamat langsung | Ditolak server | GAJ-54 |
| 139 | Pemilik ingin tahu total uang yang diterima Joko selama 2026 | Total Diterima per Orang, rentang 12 periode: slip mingguan, bongkaran, jumlah Diterima dan Belum dibayar | C5, DRV-80 |
| 140 | HR membuka Total Diterima per Orang | Jabatan Pemilik dan GM tidak ada di daftar dan tidak ikut jumlah | C5, GAJ-46 |
| 141 | Keberatan Sinta diajukan 28 November, belum diputuskan saat HR menekan Tutup semua 29 November | Slip Sinta tetap ditutup; langkah Periksa menyebut "1 keberatan slip menunggu"; bila kemudian benar, koreksi di slip Desember | GAJ-93, C3 |

---

## 11. Jalan keluar

| Tindakan | Kembali / ulangi | Batalkan | Oleh siapa, sampai kapan | Akibat ke data lain |
|---|---|---|---|---|
| Ubah gaji (langsung) | Kembali di tiap langkah; Ulangi dari awal | Perubahan terjadwal dibatalkan dengan alasan selama belum berlaku; yang sudah berlaku diubah dengan perubahan baru | Pemilik, GM | Perkiraan slip ikut berubah |
| Usulan ubah gaji | Kembali di tiap langkah | Ditarik pengusul selama Menunggu; ditolak dengan alasan, lalu boleh diusulkan ulang | HR menarik; Pemilik, GM memutuskan | — |
| Perubahan yang sudah berlaku tetapi salah, slip belum ditutup | — | Perubahan baru bertanggal sama menggantikannya (riwayat tetap dua-duanya, yang lama berstatus Dibatalkan) | Pemilik, GM | Perkiraan dihitung ulang |
| Perubahan yang salah, slip sudah ditutup | — | Slip dibuka kembali (GAJ-49, 4E-5) atau koreksi di periode berikutnya | Pemilik, GM | Lihat 4E-5 |
| Ubah Gaji Standar | Kembali sebelum Simpan | Nilai belum berlaku dibatalkan; yang sudah berlaku diganti nilai baru | Pemilik, GM | Tidak ada ke gaji orang |
| Jenis komponen | Kembali sebelum Simpan | Nonaktifkan (kalau tidak dipakai); aktifkan lagi | Pemilik, GM | — |
| Pengaturan gaji | Langkah baku BER-L41 | Nilai belum berlaku dibatalkan (pengumuman ikut ditarik) | Pemilik, GM | Slip periode tanggal berlaku ke depan |
| Tiadakan potongan | Kembali sebelum tombol ditahan | Batalkan peniadaan dengan alasan selama slip belum ditutup; sesudahnya tidak bisa (yang ditiadakan sudah dibayar) | Pemilik, GM | Perkiraan berubah; Dana Disiplin dihitung saat tutup |
| Tetap dipotong (atas usulan) | Kembali sebelum Simpan | Diganti dengan Tiadakan selama slip belum ditutup | Pemilik, GM | Perkiraan berubah |
| Baris denda | — (ditulis mesin) | Lewat sumbernya: pencabutan penjelasan (KEH-158) atau peniadaan (K3) | HR, Pemilik, GM (cabut); Pemilik, GM (tiadakan) | Urutan ke-n dihitung ulang |
| Koreksi periode lalu | — (ditulis mesin) | Lewat sumbernya di Kehadiran; selisih dihitung ulang selama slip periode berjalan belum ditutup | Pemegang sumbernya | Slip periode berjalan |
| Catat kehilangan barang | Kembali di tiap langkah; Ulangi dari awal | Usulan ditarik pengusul selama Menunggu; yang Berlaku dibatalkan dengan alasan sebelum masuk slip tertutup; sesudahnya koreksi di slip berikutnya (GAJ-50) | HR menarik; Pemilik, GM membatalkan | Pembagian dibatalkan; perkiraan berubah |
| Persen kantor dan bobot | Langkah baku BER-L41 | Nilai belum berlaku dibatalkan | Pemilik, GM | Pembagian periode tanggal berlaku ke depan |
| Catat minus kas | Kembali di tiap langkah | Sama dengan kehilangan barang; bernama boleh juga Ditiadakan lewat keberatan | Pengusul, Pemilik, GM | Perkiraan berubah |
| Potongan Lain | Kembali di tiap langkah | Ditarik selama Menunggu; Dibatalkan sebelum cicilan pertama terpotong; sesudahnya Ubah jadwal atau Hapuskan sisa (beban, alasan) | HR menarik; Pemilik, GM | Cicilan berikutnya berubah |
| Keberatan potongan | Kembali sebelum kirim | Ditarik pengaju selama menunggu | Pengaju; Pemilik, GM memutuskan | Ditiadakan: koreksi plus bila sudah terpotong |
| Sisa potongan | — (ditulis fungsi) | Lewat sumbernya; sisa yang sumbernya dibatalkan ikut dibatalkan | Pemegang sumbernya | Slip berikutnya |
| Piutang Lain dari slip terakhir | — | Dihapuskan pemilik dengan alasan (KEU-74), atau dibalik bila slip terakhir dibuka kembali (GAJ-49) | Pemilik | Keuangan |
| Sahkan bonus (baris, kelompok, atau aturan) | Kembali sebelum tombol ditahan | Batalkan baris dengan alasan selama belum masuk slip tertutup; sesudahnya koreksi di slip berikutnya | HR, Pemilik, GM (Bonus Bebas: Pemilik, GM) | Buku Upah ikut dibatalkan; Terpesan dilepas |
| Tolak atau keluarkan bonus | Kembali sebelum Simpan | Tidak dicabut; bila salah, Pemilik atau GM mencatat Bonus Bebas pengganti dengan alasan | Pemutusnya | — |
| Batalkan bonus Ongkir | Kembali sebelum Simpan | Tidak dicabut; pengganti lewat Bonus Bebas | HR, Pemilik, GM | Buku Upah ikut dibatalkan |
| Perubahan dari kasir (Terima atau Biarkan) | Kembali sebelum Simpan | Keputusan tidak dicabut (PRI-41) | HR; Pemilik, GM untuk bonus jabatan Pemilik | Koreksi bonus di slip berikutnya |
| Usulan Bonus Bebas | Kembali di tiap langkah | Ditarik pengusul selama Menunggu | HR menarik; Pemilik, GM memutuskan | — |
| Jenis Bonus dan pengaturannya | Langkah baku BER-L41 | Nilai belum berlaku dibatalkan (pengumuman ikut ditarik) | Pemilik, GM | Baris yang lahir sejak tanggal berlaku |
| Pindah dana, penyesuaian, saldo awal | Kembali di tiap langkah | Tidak dihapus; dibetulkan dengan penyesuaian baru beralasan | Pemilik, GM | Saldo dan Tersedia |
| Hangus (GAJ-58) | — | Ikut dibalik bila pemilik membatalkan penetapan GAJ-58 sebelum slip terakhir dibayar | Pemilik, GM | Baris kembali ke status sebelumnya |
| Bayar bonus di luar slip | Kembali sebelum tombol ditahan | Pembayaran dibatalkan dengan alasan lalu dibayar ulang (seperti GAJ-49) | Pemilik, GM | Keuangan |
| Tutup slip (per orang atau semua) | Kembali di langkah 1–2 | Buka kembali selama belum Dibayar dan slip berikutnya belum ditutup (GAJ-L31); sesudahnya koreksi di slip berikutnya | Pemilik, GM membuka; HR meminta | Semua akibat penutupan dibalik dalam satu langkah |
| Tutup lebih cepat | Kembali sebelum tombol ditahan | Sama dengan tutup slip | Pemilik, GM | Sama; Piutang Lain dibalik bila belum ada cicilan masuk |
| Buka kembali | Kembali sebelum tombol ditahan | Ditutup lagi dengan langkah tutup biasa (versi baru) | HR, Pemilik, GM menutup | Masa keberatan dihitung ulang |
| Minta buka kembali | — | Tidak perlu dibatalkan; hilang dari Antrean saat slip dibuka atau dibayar | HR | — |
| Cetak slip | — | Tidak ada yang dibatalkan; cetakan lama tetap bernomor dan berversi | — | — |
| Bayar slip (satu atau sekaligus) | Kembali di langkah 1–2 | Batal bayar dengan alasan, kapan pun, lalu bayar ulang (GAJ-L35) | Pemilik, GM | Baris uang keluar dibatalkan; slip kembali Ditutup; periode kembali dari Lunas |
| Pemasangan Catatan Cepat ke slip | Kembali sebelum Simpan (4H) | Batal bayar melepas pasangan; catatan kembali "belum dipasangkan" | Pemilik, GM membatalkan; finance memasangkan ulang | Uang tetap tercatat keluar |
| Slip Rp0 "tanpa uang" | — (ditulis langkah tutup) | Ikut dibalik bila slip dibuka kembali | Pemilik, GM | — |
| Daftar Transfer (unduh) | — | Tidak ada yang dibatalkan; unduhan tercatat | — | — |
| Bayar di luar slip | Kembali sebelum tombol ditahan | Batal bayar seperti slip; pemotongan ke Piutang Lain dibalik | Pemilik, GM | Mutasi Dana Disiplin dibalik bila bonus bersumber dana |
| Ajukan keberatan slip | Kembali di tiap langkah | Ditarik pengaju selama Menunggu; Ajukan ulang selama masa keberatan | Pengaju | — |
| Putuskan keberatan slip | Kembali sebelum Simpan | Keputusan Disetujui yang belum tertaut boleh diubah menjadi Ditolak dengan alasan oleh Pemilik atau GM; yang sudah tertaut tidak dicabut (pembetulannya punya jalan keluarnya sendiri) | Penyetuju; Pemilik, GM | — |
| Tautkan pembetulan | Kembali sebelum Simpan | Tautan salah dilepas dan ditautkan ulang dengan alasan, selama slip tujuan pembetulan belum ditutup | Penyetuju, Pemilik, GM | — |
| Pembetulan gaji periode lalu | Kembali di tiap langkah | Dibatalkan dengan alasan selama slip berjalan belum ditutup (baris koreksinya ikut hilang); sesudahnya pembetulan baru ke arah sebaliknya | Pemilik, GM | Koreksi periode lalu dihitung ulang |
| Unduh slip | — | Tidak ada yang dibatalkan; unduhan tercatat | — | — |
| Akses terbatas mantan karyawan | — | Berakhir sendiri; diaktifkan lagi lewat KAR-07 bila orangnya kembali bekerja | HR, Pemilik, GM (KAR-07) | — |

---

## 12. Daftar tes

**Uang**

| No | Tes | Contoh |
|---|---|---|
| U1 | Gaji dibaca menurut tanggal berlaku | Pokok Rp2.000.000 + Tunj. Tetap Rp600.000 sejak 26 Agustus; perubahan pokok Rp2.300.000 mulai 26 November. Gaji pada 25 November = Rp2.600.000; pada 26 November = Rp2.900.000 |
| U2 | Paket lengkap | Perubahan 26 November hanya menaikkan pokok; tunjangan tetap ikut tersimpan di paketnya. Gaji pada 1 Desember = Rp2.900.000, bukan Rp2.300.000 |
| U3 | Komponen dihentikan | Tunjangan Jabatan Rp300.000 dihentikan mulai 26 Desember: gaji Desember tanpa tunjangan itu; riwayat November tetap memuatnya |
| U4 | Gaji harian tidak dibulatkan dulu | Gaji Rp2.900.000 ÷ 26 = Rp111.538,46…; nilai yang disimpan untuk hitungan tetap pecahan, pembulatan hanya di hasil akhir baris (GAJ-07; rumusnya dites di 4E-2) |
| U5 | Promosi | Training Pokok Rp1.800.000 + Tunj. Tetap Rp200.000 + Tunj. Jabatan Rp100.000; paket Karyawan Pokok Rp2.300.000 + Tunj. Tetap Rp600.000. Hasil = Pokok Rp2.300.000 + Tunj. Tetap Rp600.000 + Tunj. Jabatan Rp100.000 (dibawa) = Rp3.000.000 |
| U6 | Gaji Standar tidak mengubah orang | Paket Karyawan naik Rp100.000 mulai 26 Januari: gaji 18 orang pada 26 Januari sama dengan sebelumnya |
| U7 | Nominal bulat | Isian Rp2.500.000,50 atau negatif ditolak server |
| U8 | Contoh Aturan Potongan dari rumus yang sama | Tarif telat diubah Rp1.500 mulai 26 Januari: kartu telat pada 26 Januari menampilkan contoh 6 menit = Rp9.000 tanpa ada yang mengetik contoh baru |
| U9 | Gaji harian dan pembulatan sekali per baris | Gaji Rp2.900.000, alpha 3 hari: 5,75 × 111.538,4615… = 641.346,15… → **Rp641.346**. Salah bila dibulatkan per hari (167.308 + 223.077 + 250.962 = Rp641.347) |
| U10 | Prorata | Gaji Rp2.600.000, periode 26 Okt – 25 Nov (31 hari), masuk 16 November: × 10/31 = 838.709,67… → Rp838.710 |
| U11 | Prorata tidak mengubah gaji harian | Orang U10 alpha 1 hari: 1,5 × Rp100.000 = Rp150.000 (bukan dari Rp838.710) |
| U12 | Telat dan toleransi | Telat 5, 6, dan 30 menit dalam satu periode: 0 + 6.000 + 30.000 = Rp36.000 |
| U13 | Peniadaan | Telat 40 menit ditiadakan: baris telat Rp0 untuk hari itu, menit tetap 40, tanda "ditiadakan" |
| U14 | Tangga izin dan sakit tanpa surat | 6 hari: 1 + 1,25 + 1,5 + 1,75 + 2 + 2 = 9,5 × Rp100.000 = Rp950.000 |
| U15 | Tangga izin mendadak | 8 hari: 1,25 + 1,5 + 1,6 + 1,7 + 1,8 + 1,9 + 2 + 2 = 13,75 → Rp1.375.000 |
| U16 | Tangga alpha | 7 hari: 1,5 + 2 + 2,25 + 2,5 + 2,75 + 3 + 3 = 17 → Rp1.700.000 |
| U17 | Tangga terpisah (K1) | Izin 1 hari lalu alpha 1 hari: 1 + 1,5 = Rp250.000 |
| U18 | Sakit dengan surat per periode (K1) | 1 hari + 2 hari terpisah: 0 + 0,5 + 0,5 = Rp100.000 |
| U19 | Training (K2) | Alpha 3 hari: 3 × Rp100.000 = Rp300.000; sakit dengan surat 2 hari: 0 + 0,5 = Rp50.000 |
| U20 | Tidak dipotong | Libur 4, cuti 2, duka 2, hari tutup 1: tidak ada baris tidak hadir |
| U21 | Duka hari ke-3 | Diajukan sebagai izin keperluan: × 1 (hari ke-1 tangga izin) |
| U22 | Lembur | Jam disahkan 2 + 3 + 1 = 6 × Rp7.500 = Rp45.000 |
| U23 | Lembur jabatan tanpa lembur | Jabatan gudang: tidak ada baris lembur walaupun ada jam terdeteksi |
| U24 | Kompensasi | Diminta masuk 2 hari libur, hadir keduanya: 2 × Rp100.000 = Rp200.000; jabatan tanpa kompensasi: Rp0 |
| U25 | Denda dan kejadian ke-5 | Lupa pulang 6 kali: 4 × 5.000 + 2 × 10.000 = Rp40.000; lupa masuk 1 kali: Rp15.000 |
| U26 | Denda ke-n dicabut | Dari 5 lupa pulang, ke-2 dicabut: tersisa 4 kali, total Rp20.000; baris lama ke-5 dibatalkan dan ditulis ulang sebagai ke-4 |
| U27 | Koreksi periode lalu (K4) | Slip November: alpha 12 dan 14 (1,5 + 2 = Rp350.000). Koreksi 12 → hadir: hitungan baru Rp150.000; baris "Koreksi alpha periode November" +Rp200.000 di slip Desember |
| U28 | Koreksi memakai angka periode lama | Tarif telat naik Rp1.500 mulai Desember; koreksi telat November dihitung Rp1.000 per menit |
| U29 | Koreksi minus | Koreksi menambah alpha di November yang sudah ditutup: selisih menjadi potongan di slip Desember |
| U30 | Pemilik | Jabatan Pemilik: hanya baris gaji tetap, walaupun ada data telat |
| U31 | Pembagian penuh | Rp1.000.000, kantor 40%, bobot 2, 1, 1, 1 penuh: Rp240.000, 120.000, 120.000, 120.000; kantor Rp400.000 |
| U32 | Sebanding hari | Seperti U31, satu bobot 1 hanya 10 dari 30 hari dan penggantinya 20 hari (jumlah bobot 5): Rp240.000, 120.000, 40.000, 80.000; kantor 400.000 + sisa 120.000 |
| U33 | Jumlah selalu sama dengan nilai | Rp1.000.000, kantor 0%, tiga orang bobot 1: Rp333.333 × 3 = Rp999.999; pembulatan Rp1 ke kantor; jumlah Rp1.000.000 |
| U34 | Pindah cabang | Periode 31 hari, pindah tanggal 16 November: hari Raja 21, hari Markas 10 |
| U35 | Persen dan bobot menurut tanggal | Bobot kepala toko diubah 3 mulai 26 Desember: kehilangan 20 Desember memakai bobot lama 2 (periode Desember mulai 26 November); kehilangan 27 Desember memakai 3 |
| U36 | Selisih kasir | Kekurangan 50.000 dan 10.000, kelebihan 20.000: Rp40.000. Kelebihan 70.000: Rp0 (tidak menjadi tambahan) |
| U37 | Selisih ditiadakan | Kekurangan 50.000 ditiadakan: Rp0, baris tetap tampil |
| U38 | Minus kas tanpa nama | Rp100.000, tiga orang hadir: Rp33.333 × 3; pembulatan Rp1 ke kantor |
| U39 | Jadwal Potongan Lain | Rp500.000 × 3 kali: 166.666, 166.666, 166.668 |
| U40 | Urutan pengambilan | Pendapatan 1.000.000; (a) 300.000, (b) 200.000, (c) 400.000, (d) 250.000: terpotong (d) 100.000, sisa kasbon 150.000, bersih 0 |
| U41 | Potongan sebagian di tengah kelompok | Pendapatan 400.000; (a) 300.000, (b) 200.000: (b) terpotong 100.000, sisa (b) 100.000; (c) dan (d) seluruhnya menjadi sisa |
| U42 | Sisa diambil lebih dulu | Sisa kasbon 150.000 + cicilan baru 125.000, kelompok (d) hanya tertampung 200.000: sisa lama lunas 150.000, cicilan baru terpotong 50.000, sisa baru 75.000 |
| U43 | Dana Disiplin dari yang terpotong | Denda 15.000 tidak tertampung: Dana Disiplin +0 periode ini, +15.000 saat terpotong di periode berikutnya |
| U44 | Koreksi minus masuk kelompok (a) | Koreksi alpha −200.000 diambil bersama kelompok (a), sebelum kehilangan barang |
| U45 | Slip terakhir | Pendapatan 500.000; (a) 650.000, (b) 80.000, sisa kasbon 200.000: terpotong (a) 500.000; tidak tertagih (a) 150.000; Piutang Lain kehilangan 80.000 dan kasbon 200.000 |
| U46 | Berhenti tanpa pemberitahuan | Pendapatan 2.000.000; potongan 1.100.000 termasuk seluruh sisa kasbon: denda 900.000, bersih 0 |
| U47 | Slip utama | Orang bulanan dengan slip mingguan kenek: Potongan Lain dan kasbon hanya di slip bulanan; slip mingguan utuh |
| U48 | Keberatan diterima setelah terpotong | Cicilan 200.000 sudah terpotong di slip November, keberatan Ditiadakan 3 Desember: baris koreksi +200.000 di slip Desember; cicilan berikutnya Dibatalkan |
| U49 | Bonus grooming dibulatkan ke bawah | 10% × 85.000 = 8.500; 10% × 87.555 = 8.755,5 → **8.755** |
| U50 | Bonus ongkir | 50% × 15.000 = 7.500; 50% × 7.001 = 3.500,5 → 3.500; gratis ongkir: tidak ada baris |
| U51 | Promo telat lapor | 3 pcs × 1.500 = 4.500; dilaporkan hari ke-4: 2.250 |
| U52 | Dana Disiplin dari yang terpotong | Telat 36.000 dan denda 20.000 terpotong, telat 40.000 ditiadakan: masuk 56.000 |
| U53 | Tersedia | Saldo 500.000, Terpesan 200.000: Tersedia 300.000; bonus 400.000 ditolak, kurang 100.000 |
| U54 | Satu aturan bersama (B5) | 6 × 100.000, Tersedia 450.000: tidak ada satu pun yang disahkan; Tersedia tetap 450.000 |
| U55 | Keluar saat tutup | Bonus 300.000 disahkan: Saldo tetap, Terpesan +300.000; slip ditutup: Saldo −300.000, Terpesan −300.000 |
| U56 | Slip dibuka kembali | Mutasi slip itu bertanda Dibalik; Saldo kembali seperti sebelum ditutup |
| U57 | Dana Tidak Hadir | Alpha 350.000 + izin 375.000 masuk; lembur 45.000 + kompensasi 100.000 keluar: selisih +580.000 |
| U58 | Pindah dana | Saldo berjalan Dana Tidak Hadir 580.000: pindah 200.000 diterima; 600.000 ditolak |
| U59 | Hangus melepas pesanan | Bonus Bebas 100.000 dari Dana Disiplin Disahkan, lalu GAJ-58: status Hangus, Terpesan −100.000 |
| U60 | Koreksi bonus minus | Bonus grooming 8.500 sudah dibayar, retur diterima HR: baris −8.500 di kelompok (c) slip berikutnya |
| U61 | Penyesuaian tidak boleh di bawah Terpesan | Saldo 500.000, Terpesan 300.000: penyesuaian −250.000 ditolak; −200.000 diterima |
| U62 | Pengesahan bersamaan | Dua pengesahan 200.000 pada Tersedia 300.000 terjadi bersamaan: satu diterima, satu ditolak |
| U63 | Dua sumber dana dalam satu slip | Bonus grooming 50.000 (kantor) dan Bonus Terukur 100.000 (Dana Disiplin): slip menampilkan keduanya; hanya 100.000 menjadi mutasi keluar |
| U64 | Angka terkunci = perkiraan terakhir | Perkiraan Rina pukul 09.59 bersih Rp2.731.500; ditutup 10.00 tanpa perubahan sumber: bersih tersimpan Rp2.731.500, baris demi baris sama |
| U65 | Jumlah baris = bersih | Pendapatan 2.600.000 + 15.000 lembur; terpotong 6.000 + 150.000 + 100.000: bersih Rp2.359.000, sama dengan jumlah baris |
| U66 | Buka kembali membalik dana | Slip menulis Dana Disiplin +21.000 dan Dana Tidak Hadir +150.000 / −15.000; sesudah dibuka kembali saldo kedua dana kembali ke angka sebelum ditutup |
| U67 | Tutup ulang tanpa dobel | Dibuka lalu ditutup ulang tanpa perubahan: mutasi Berlaku tetap satu set (yang lama Dibalik), Buku Upah gaji tetap satu set Berlaku, cicilan tidak terpotong dua kali |
| U68 | Sisa potongan dan buka kembali | Pendapatan 2.600.000, potongan 2.800.000: bersih 0, sisa 200.000 Dibawa; dibuka kembali: sisa 200.000 Dibatalkan, sisa lama yang tadi terpotong kembali Dibawa |
| U69 | Slip terakhir dan Piutang Lain | Pendapatan 1.341.935, sisa kasbon 1.500.000: terpotong 1.341.935, Piutang Lain 158.065, bersih 0; dibuka kembali sebelum ada cicilan: piutang dibalik |
| U70 | Cicilan kasbon | Cicilan 250.000 jatuh tempo November: saat tutup ditandai Terpotong 250.000; dibuka kembali: Terjadwal lagi |
| U71 | Gaji tetap ke Buku Upah | Pokok 2.000.000 + Tunj. Tetap 600.000: dua baris Buku Upah lahir saat tutup, tidak ada sebelumnya |
| U72 | Prorata tutup lebih cepat | Gaji 2.600.000, periode 26 Okt – 25 Nov (31 hari), berhenti 10 November (16 hari): 2.600.000 × 16/31 = 1.341.935,48… → Rp1.341.935 |
| U73 | Usulan tiadakan saat tutup | Telat 40 menit (Rp40.000) dengan usulan tiadakan Menunggu: terpotong Rp40.000, masuk Dana Disiplin, usulan Tetap dipotong; dibuka kembali: usulan Menunggu lagi |
| U74 | Bayar sekaligus | Tiga slip bersih Rp2.359.000, Rp2.731.500, Rp1.000.000 dari Brankas: tiga pembayaran dan tiga baris uang keluar, satu kelompok bayar Rp6.090.500; saldo Brankas turun Rp6.090.500 |
| U75 | Nominal = bersih | Pembayaran slip bersih Rp2.359.000 tersimpan Rp2.359.000; isian nominal dari layar diabaikan server |
| U76 | Tidak dua kali | Slip yang sudah Dibayar dibayar lagi: ditolak; batal bayar lalu bayar ulang dari rekening: satu pembayaran Berlaku, satu Dibatalkan, saldo Brankas kembali Rp2.359.000 |
| U77 | Slip Rp0 | Pendapatan Rp1.000.000, terpotong Rp1.000.000: saat ditutup langsung Dibayar tanpa uang, tidak ada baris uang keluar |
| U78 | Ringkasan berimbang | Periode 3 slip (U74): pendapatan − terpotong = Rp6.090.500 = dibayar Rp3.731.500 + belum Rp2.359.000 + Rp0 |
| U79 | Ringkasan Finance tanpa gaji Pemilik dan GM | Periode dengan 38 slip karyawan Rp90.000.000 dan 2 slip jabatan bertanda Rp20.000.000: Finance melihat 38 slip Rp90.000.000 dengan keterangan "tidak termasuk gaji Pemilik dan GM"; Pemilik dan GM melihat Rp110.000.000 |
| U80 | Dipotongkan ke piutang | Piutang Lain Rp158.065, bonus susulan Rp50.000: piutang sisa Rp108.065, uang keluar Rp0. Bonus Rp200.000: piutang lunas, uang keluar Rp41.935 |
| U81 | Bonus luar slip dari Dana Disiplin | Bonus Rp100.000 bersumber Dana Disiplin dibayar di luar slip: mutasi keluar Rp100.000 saat dibayar; dibatalkan: mutasi Dibalik |
| U82 | Cabang dibebani | Slip tersimpan cabang Toko Raja dibayar dari Brankas: baris uang keluar berbeban Toko Raja; slip jabatan bertanda: kejadian "Gaji pemilik dan GM" |
| U83 | Pemasangan harus persis | Catatan Gaji/Upah Rp40.000.000 dipasangkan ke slip berjumlah Rp39.850.000: ditolak, selisih Rp150.000 disebut |
| U84 | Angka karyawan sama dengan angka kantor | Perkiraan Sinta di Pendapatan Saya dan di GAJ-L29 pada saat yang sama: semua baris dan bersih sama persis; sesudah ditutup keduanya membaca `baris_slip` yang sama |
| U85 | Tiga angka kepala | Slip bulanan Ditutup Rp3.200.000 belum Dibayar, bongkaran dibayar Rp45.000: Pendapatan Rp3.245.000, Sudah diterima Rp45.000, Belum diterima Rp3.200.000 |
| U86 | Pembetulan gaji periode lalu (C3) | Tunjangan November tercatat Rp200.000, seharusnya Rp300.000; dibetulkan: slip Desember "Koreksi gaji tetap periode November" +Rp100.000; ke arah sebaliknya −Rp100.000 ikut urutan dan sisa potongan |
| U87 | Pembetulan memakai prorata periode lama | Rina masuk 10 November; periode 26 Okt – 25 Nov 31 hari, bekerja 16 hari; gaji tercatat Rp3.000.000, seharusnya Rp3.150.000. R1 lama 3.000.000 × 16 ÷ 31 = Rp1.548.387; R1 baru 3.150.000 × 16 ÷ 31 = Rp1.625.806; koreksi +Rp77.419 (tiap R1 dibulatkan sekali, GAJ-07) |
| U88 | Total Diterima seimbang | Untuk satu orang satu rentang: Diterima + Belum dibayar = jumlah bersih slip tertutup + bongkaran + bayar di luar slip; slip Perkiraan tidak ikut |
| U89 | Slip mingguan tidak dihitung dua kali | Minggu 22–28 November: slip hanya di periode 26 Nov – 25 Des; jumlah Total Diterima dua periode berurutan sama dengan jumlah semua slip, tidak ada yang dobel |

**Waktu**

| No | Tes | Contoh |
|---|---|---|
| W1 | Periode untuk tanggal | 25 November 2026 → periode November (26 Okt – 25 Nov); 26 November → periode Desember |
| W2 | Periode Februari | Periode Maret 2027: 26 Februari – 25 Maret (28 hari); periode Maret 2028: 26 Februari – 25 Maret (29 hari) |
| W3 | Minggu upah | Jumat 30 Oktober 2026 – Kamis 5 November 2026 satu minggu upah; Kamis 29 Oktober masuk minggu sebelumnya |
| W4 | Mesin periode tanpa dobel | Dijalankan dua kali sehari: tetap 3 bulanan dan 13 minggu upah ke depan, tidak ada yang dobel |
| W5 | Terlewat dikejar | Mesin mati 40 hari: saat hidup, periode yang kurang dibuat berurutan |
| W6 | Jadwal disalin saat dibuat | Tanggal bayar diubah 2 mulai periode Januari, diubah tanggal 5 Desember: periode Desember tetap tanggal 1; Januari dan sesudahnya tanggal 2 |
| W7 | Tanggal berlaku pengaturan | Tarif lembur bertanggal 10 November ditolak; 26 November diterima |
| W8 | Perubahan gaji periode berjalan | Tanggal 10 November memilih berlaku 26 Oktober: diterima kalau slip November belum ditutup; ditolak kalau sudah |
| W9 | Penurunan hanya ke depan | Penurunan bertanggal 26 Oktober (periode berjalan) ditolak; 26 November diterima |
| W10 | Usulan hangus | Usulan untuk periode November belum diputuskan saat slip November ditutup: status Hangus |
| W11 | Denda menurut tanggal kejadian | Lupa pulang 25 November disahkan 27 November: masuk periode November |
| W12 | Denda tidak memilih libur | Tanda 00.10 tanggal 26 November: masuk periode Desember |
| W13 | Denda terlambat | Kejadian November disahkan setelah slip November ditutup: masuk slip Desember, keterangan "periode November" |
| W14 | Tangga kembali ke awal | Alpha 25 November × 1,5 lalu alpha 26 November × 1,5 (periode baru) |
| W15 | Peniadaan setelah tutup | Tiadakan atas periode yang slipnya sudah ditutup: ditolak |
| W16 | Perkiraan mengikuti sumber | Klaim lembur disahkan pukul 10.00: perkiraan yang dibuka 10.01 sudah memuatnya |
| W17 | Kehilangan menurut tanggal ditemukan | Opname 25 November → periode November; 26 November → periode Desember |
| W18 | Disahkan sesudah tutup | Kehilangan 20 November disahkan 3 Desember: dibagi menurut orang November, masuk slip Desember dengan keterangan periode asal |
| W19 | Minus kas menurut tanggal laporan | Laporan Kasir 27 November masuk periode Desember, bukan bulan kalender November |
| W20 | Masa keberatan | Diberi tahu 10 November 14.00: keberatan diterima sampai 13 November 23.59 (jam server); 14 November 00.00 ditolak |
| W21 | Cicilan pertama | Potongan Lain disahkan 24 November: cicilan pertama di slip November. Disahkan 28 November (periode Desember sudah berjalan): slip Desember. Disahkan 27 November untuk kejadian Oktober: tetap slip Desember, tidak mundur |
| W22 | Pembagian dihitung ulang | Tanggal berhenti Citra dimundurkan sebelum slip ditutup: bagiannya dan bagian kantor dihitung ulang; sesudah tutup tidak berubah |
| W23 | Bonus grooming menurut tanggal diambil | Diambil 25 November → periode November; 26 November → Desember |
| W24 | Persen menurut tanggal kejadian | Persen 12% mulai 26 Januari: diambil 25 Januari 10%, 26 Januari 12%; perubahan bertanggal 10 Januari ditolak |
| W25 | Dana tidak bergerak dari perkiraan | Telat terjadi 5 November: Saldo Dana Disiplin tidak berubah sampai slip November ditutup |
| W26 | Bonus disahkan sesudah tutup | Grooming diambil 24 November disahkan 30 November (slip November sudah ditutup): masuk slip Desember, keterangan "periode November" |
| W27 | Bonus Terukur menunggu rapor | Belum ada baris sebelum rapor periode ditetapkan; muncul saat ditetapkan |
| W28 | Bonus promo lahir di akhir periode | Baris promo periode November lahir 26 November 00.10; laporan yang disetujui 28 November menjadi baris susulan |
| W29 | Bonus Bebas tanggal masa depan | Ditolak server |
| W30 | Slip mingguan (B3) | Ongkir nota Rabu 25 November untuk driver: minggu upah Jumat 20 – Kamis 26 November; bila sudah ditutup, minggu berikutnya |
| W31 | Jendela tutup | Masa keberatan perkiraan sampai 28 November: Tutup ditolak 28 November 23.59; diterima 29 November 00.00 |
| W32 | Pengingat lewat batas | Batas tutup 29 November; 30 November 07.00 masih ada slip Perkiraan: pengingat terkirim; berhenti setelah slip terakhir periode itu ditutup |
| W33 | Tutup lebih cepat | Hari terakhir Budi 10 November: ditolak 10 November 15.00; diterima 11 November 00.00 |
| W34 | Masa keberatan sesudah tutup ulang | Ditutup 29 November (keberatan sampai 2 Desember 23.59), dibuka 30 November, ditutup ulang 1 Desember: keberatan sampai 4 Desember 23.59 |
| W35 | Kunci catatan hari | Slip November ditutup 29 November; koreksi absen 20 November tanggal 5 Desember menjadi koreksi susulan (slip Desember), bukan perubahan slip November |
| W36 | Slip lahir | Orang masuk 10 Desember (periode 26 Nov – 25 Des): slip Perkiraan lahir saat ia diaktifkan; orang yang berhenti 20 November tidak punya slip periode Desember |
| W37 | Tanggal uang (Y1) | Slip ditutup 29 November, dicatat 3 Desember: tanggal uang 1 Desember diterima; 28 November ditolak (sebelum ditutup); 4 Desember ditolak (masa depan); lebih dari 7 hari ke belakang hanya dengan alasan; jam catat tetap jam server 3 Desember |
| W38 | Jatuh bayar slip tertahan | Tanggal bayar 1 Desember, slip ditutup 2 Desember: jatuh bayar 2 Desember; pengingat paling cepat 3 Desember 07.00 |
| W39 | Pengingat belum Dibayar | Jatuh bayar 1 Desember, belum Dibayar: 2 Desember 07.00 pengingat terkirim (hari Minggu pun tetap); berhenti setelah slip terakhir yang lewat ditandai Dibayar |
| W40 | Bayar sebelum tanggal bayar | Slip terakhir ditutup lebih cepat 11 November, dibayar 12 November: diterima |
| W41 | Status periode | Slip terakhir periode Dibayar: periode Lunas; satu pembayaran dibatalkan: periode kembali Ditutup |
| W42 | Batal bayar di bulan keuangan tertutup | Bayar 1 Desember, bulan Desember ditutup 10 Januari, batal bayar 12 Januari: pembatalan tampil di bulan Januari sebagai koreksi |
| W43 | Jendela keberatan slip | Periode berakhir 25 November: tombol muncul 26 November 00.00; slip ditutup 29 November 10.00: tombol hilang 2 Desember 23.59:59 (jam server); dibuka kembali 1 Desember dan ditutup ulang 3 Desember: tombol sampai 6 Desember 23.59 |
| W44 | Jendela "uang belum diterima" | Ditandai Dibayar dengan tanggal uang 1 Desember, dicatat 3 Desember: tombol sampai 10 Desember 23.59 (dihitung dari jam catat, bukan tanggal uang) |
| W45 | Slip mingguan | Minggu berakhir Kamis 28 November: tombol keberatan muncul Jumat 29 November 00.00 |
| W46 | Akses terbatas | Slip terakhir dicatat Dibayar 12 November 14.00, tanpa urusan lain: masih bisa masuk sampai 19 November 23.59; 20 November ditolak; batal bayar 15 November membuka lagi akses sampai dibayar ulang + 7 hari |
| W47 | Peringatan berganti kalimat | 24 November: "Selesaikan sebelum tanggal 25"; 29 November dengan slip tertahan: "Gaji Anda tertahan" |
| W48 | Pengingat pembetulan | Disetujui 2 Desember 10.00 tanpa tautan: pengingat 3 Desember 07.00; tampil di perlu perhatian Pemilik dan GM 4 Desember |

**Hak akses**

| No | Tes | Hasil |
|---|---|---|
| H1 | HR meminta daftar Gaji Karyawan | Tidak ada baris orang berjabatan bertanda "Gaji hanya terlihat Pemilik dan GM" |
| H2 | HR membuka gaji GM lewat alamat langsung | Ditolak server |
| H3 | Admin HR meminta gaji siapa pun | Ditolak server; tab tidak tampil |
| H4 | Finance meminta gaji per orang | Ditolak server |
| H5 | HR mengubah gaji | Tersimpan sebagai usulan, tidak berlaku |
| H6 | HR memutuskan usulannya sendiri | Ditolak |
| H7 | GM mengubah gajinya sendiri | Berlaku; para pemilik diberi tahu |
| H8 | HR mengubah pengaturan gaji | Tersimpan sebagai usulan |
| H9 | Karyawan membuka Aturan Potongan | Hanya kartu yang berlaku untuk jabatannya; tanpa gaji orang lain |
| H10 | Hak Akses Jabatan mencoba memberi HR "lihat gaji Pemilik" | Ditolak (batas keras) |
| H11 | HR meniadakan potongan telat lewat alamat langsung | Ditolak server |
| H12 | Hak Akses Jabatan mencoba memberi HR "tiadakan potongan" | Ditolak (batas keras) |
| H13 | Karyawan membuka Hitungan Kehadiran orang lain | Ditolak server |
| H14 | Karyawan melihat hitungannya sendiri | Tanpa tanda "dalam toleransi" dan tanpa nominal pada telat yang tidak dipotong |
| H15 | Finance atau Admin HR meminta Hitungan Kehadiran | Ditolak server |
| H16 | HR mencatat kehilangan, minus kas, atau Potongan Lain | Tersimpan sebagai usulan, tidak memotong |
| H17 | HR atau Finance mengesahkan usulan potongan lewat alamat langsung | Ditolak server |
| H18 | Hak Akses Jabatan mencoba memberi HR "sahkan potongan" | Ditolak (batas keras) |
| H19 | GM mengesahkan Potongan Lain atau memutuskan keberatan yang mengenai dirinya | Ditolak |
| H20 | Finance membuka Minus Kas | Melihat nominal minus kas, tanpa gaji siapa pun |
| H21 | Karyawan membuka pembagian kehilangan cabangnya | Hanya bagiannya sendiri dan bagian kantor; bagian teman tidak tampil |
| H22 | Karyawan mengajukan keberatan atas Potongan Lain orang lain | Ditolak server |
| H23 | HR membuka Potongan dan Sisa milik GM | Ditolak server (jabatan bertanda, KAR-83) |
| H24 | HR membuka Persetujuan Bonus | Bonus grooming jabatan Pemilik tidak tampil, tidak juga dalam jumlah |
| H25 | HR mengesahkan bonusnya sendiri | Ditolak server |
| H26 | HR mengesahkan Bonus Bebas lewat alamat langsung | Ditolak server (B1) |
| H27 | Pemilik yang groomer mengesahkan bonus grooming miliknya | Ditolak server |
| H28 | Pintu tulis menerima bonus untuk jabatan GM | Ditolak server |
| H29 | Finance membuka Buku Bonus atau Dana Disiplin | Hanya jumlah per jenis dan per cabang, tanpa nama |
| H30 | Karyawan membuka bonus orang lain | Ditolak server |
| H31 | HR memindah atau menyesuaikan dana | Ditolak server; Hak Akses Jabatan tidak bisa memberikannya |
| H32 | Modul lain menulis nominal bonus sendiri | Tidak ada jalan; pintu tulis hanya menerima dasar hitungan |
| H33 | HR menutup slip GM atau Pemilik lewat alamat langsung | Ditolak server |
| H34 | HR membuka kembali slip atau menekan Tutup lebih cepat lewat alamat langsung | Ditolak server |
| H35 | Hak Akses Jabatan mencoba memberi HR "buka kembali slip" | Ditolak (batas keras) |
| H36 | HR menekan Tutup semua | Slip jabatan bertanda tidak ikut dan tidak muncul di jumlah hasil |
| H37 | Admin HR atau Finance membuka GAJ-L28 atau L29 | Ditolak server; hanya baris periode di GAJ-L08 |
| H38 | Siapa pun mencetak slip Perkiraan lewat alamat langsung | Ditolak server |
| H39 | Pemilik membuka kembali slipnya sendiri | Ditolak server; GM yang membuka (GM boleh untuk slipnya sendiri, para pemilik diberi tahu) |
| H40 | HR atau Finance menandai Dibayar lewat alamat langsung | Ditolak server |
| H41 | Hak Akses Jabatan mencoba memberi HR atau Finance "bayar slip" | Ditolak (batas keras) |
| H42 | Pemilik menandai Dibayar slipnya sendiri | Ditolak server; GM boleh untuk slipnya sendiri, para pemilik diberi tahu |
| H43 | Finance membuka Daftar Transfer | Hanya slip Ditutup belum Dibayar: nama, rekening, bersih; tanpa rincian; tanpa jabatan bertanda |
| H44 | Finance meminta rincian slip lewat Daftar Transfer atau Ringkasan | Ditolak server |
| H45 | Finance membuka Ringkasan | Total seluruh perusahaan saja, tanpa per cabang, tanpa gaji Pemilik dan GM |
| H46 | HR membuka Ringkasan | Tanpa jabatan bertanda, tidak juga dalam jumlah |
| H47 | Admin HR membuka Jadwal Bayar, Daftar Transfer, atau Ringkasan | Ditolak server |
| H48 | Finance memasangkan Catatan Cepat Gaji/Upah yang dicatat Finance sendiri tanpa lampiran atas nama Pemilik atau GM | Ditolak; pilihannya Pribadi, Bantuan, atau ditanyakan (KEU-18) |
| H49 | Karyawan meminta Pendapatan Saya atau slip orang lain lewat alamat langsung | Ditolak server |
| H50 | Karyawan mengunduh slip Perkiraan miliknya lewat alamat langsung | Ditolak server |
| H51 | HR memutuskan keberatan slipnya sendiri | Ditolak; diputuskan Pemilik atau GM |
| H52 | HR membuka atau memutuskan keberatan slip GM atau Pemilik | Tidak tampil; ditolak server |
| H53 | HR memutuskan keberatan "uang belum diterima" lewat alamat langsung | Ditolak server; Hak Akses Jabatan tidak bisa memberikannya |
| H54 | HR mencatat pembetulan gaji periode lalu | Ditolak server (hanya Pemilik, GM) |
| H55 | Perubahan gaji asal biasa memilih periode yang sudah ditutup | Ditolak server (GAJ-63); hanya asal "pembetulan" |
| H56 | Mantan karyawan dalam akses terbatas membuka Absen, Kehadiran Saya, atau menu kantor | Ditolak server |
| H57 | Orang yang dinonaktifkan bukan karena berhenti mencoba masuk | Ditolak penuh; tidak ada akses terbatas |
| H58 | Finance atau Admin HR membuka Total Diterima per Orang | Ditolak server |
| H59 | HR membuka Total Diterima per Orang | Jabatan bertanda tidak ada, tidak juga dalam jumlah |

---

## 13. Pertanyaan dan jawaban

### 4E-1 (diajukan 13 Oktober 2026; jawaban pemilik: **"ok"**, dibaca setuju saran untuk G1 s.d. G6)

- **G1.** Siapa boleh mengubah gaji orang. Saran: HR mengusulkan, Pemilik
  atau GM memutuskan; Pemilik atau GM langsung berlaku dan pemilik lain
  diberi tahu; gaji jabatan bertanda hanya oleh Pemilik dan GM; GM boleh
  mengubah gajinya sendiri.
- **G2.** Tanggal berlaku perubahan gaji. Saran: selalu tanggal 26; kenaikan
  boleh untuk periode berjalan selama slipnya belum ditutup; penurunan hanya
  periode depan; orangnya diberi tahu tanpa nominal.
- **G3.** Gaji Standar. Saran: dua paket, Training dan Karyawan.
- **G4.** Semua komponen dijumlah sama (gaji harian, prorata). Saran: ya;
  isi awal Gaji Pokok, Tunjangan Jabatan, Tunjangan Tetap.
- **G5.** Menu. Saran: tambah "Gaji Karyawan" di Kantor › Gaji; Buku Upah
  tanpa menu sendiri.
- **G6.** Pengaturan gaji. Saran: angka yang dipakai slip hanya berlaku mulai
  tanggal 26; Pemilik dan GM mengubah langsung, HR mengusulkan.

Dicatat sebagai GAJ-62 s.d. 67 (bagian 3.8) di `../../aturan/03-gaji.md`.
Bacaan Claude yang tidak dibantah pemilik: orang berjabatan bertanda tidak
tampil sama sekali di layar HR; Aturan Potongan hanya menampilkan aturan
jabatan orang itu, contohnya dihitung rumus slip yang sama dengan gaji contoh
Rp2.600.000; periode dibuat mesin 3 bulanan dan 13 minggu upah ke depan.

### 4E-2 (diajukan 13 Oktober 2026; jawaban pemilik: **"ok"**, dibaca setuju saran untuk K1 s.d. K5)

Diajukan di percakapan (KER-13, 14). Saran Claude:

- **K1.** Tangga potongan tidak hadir. Saran: tiga tangga **terpisah**
  (izin dan sakit tanpa surat; izin mendadak; alpha), masing-masing berlanjut
  sepanjang periode; sakit dengan surat dihitung **per periode** (hari ke-1
  di periode itu bebas), bukan per rangkaian sakit. Sama dengan sistem lama.
- **K2.** Training. Saran: pengali 1 untuk izin, sakit tanpa surat, izin
  mendadak, **dan alpha**; sakit dengan surat tetap memakai aturan surat
  (lebih ringan). Status Training dibaca per periode (promosi berlaku awal
  periode, KAR-22).
- **K3.** Denda kehadiran boleh ditiadakan? Saran: **ya**, sama seperti
  telat: Pemilik atau GM saja, per kejadian, alasan wajib, tidak masuk Dana
  Disiplin. Untuk kejadian yang bukan salah karyawan (QR rusak, server
  bermasalah).
- **K4.** Koreksi periode lalu. Saran: hitung ulang periode lama dengan angka
  dan gaji periode lama; selisihnya baris di slip berikutnya, **dua arah**
  (kurang bayar menjadi tambahan, lebih bayar menjadi potongan yang ikut
  urutan dan sisa potongan 4E-3).
- **K5.** Akibat lewat batas istirahat. Saran: tetap **kosong** (hanya
  dicatat); ditinjau setelah ada data dua periode.

Bacaan Claude yang tidak ditanyakan karena sudah ditetapkan: denda lupa
Masuk Kembali ikut tambahan kejadian ke-5, dihitung terpisah per jenis
(KEH-154, KEH-64); denda tidak memilih libur masuk periode yang mulai
tanggal 26 itu (KEH-135); kompensasi libur tetap dibayar walaupun libur
pengganti hangus (KEH-138); "pemilik saja" pada GAJ-11 mencakup GM (KAR-67).
Bacaan teknis: pembulatan sekali per jumlah baris, bukan per hari (GAJ-07);
usulan tiadakan yang belum diputuskan saat tutup berarti tetap dipotong.

Dicatat sebagai GAJ-68 s.d. 74 (bagian 3.9) di `../../aturan/03-gaji.md`.

### 4E-3 (diajukan 13 Oktober 2026; jawaban pemilik: **"ok"**, dibaca setuju saran untuk P1 s.d. P4; ditambah "stock opname itu sebulan sekali")

Diajukan di percakapan (KER-13, 14). Saran Claude:

- **P1.** Kehilangan barang: HR, Pemilik, atau GM mencatat per kejadian
  (cabang, tanggal ditemukan, nilai, keterangan, foto atau berkas hasil
  opname wajib); catatan HR menjadi usulan yang disahkan Pemilik atau GM;
  masuk periode tanggal ditemukan; tiap orang diberi tahu bagiannya.
  Pemilik menegaskan opname **sebulan sekali**, jadi kehilangan satu opname
  sama dengan kehilangan satu periode.
- **P2.** Minus kas catat tangan: HR atau finance mencatat, Pemilik atau GM
  mengesahkan; bernama ditanggung penuh dan boleh keberatan 3 hari; tanpa
  nama dibagi rata ke orang yang hadir di cabang itu hari itu dengan jabatan
  bertanda "ikut menanggung kehilangan barang" (tanda yang sama, tidak
  ditambah tanda baru).
- **P3.** Potongan Lain: HR mengajukan, Pemilik atau GM mengesahkan; jenis
  awal Ganti rugi barang rusak, Ganti rugi peralatan, Lainnya; 1 sampai 3
  kali potong; orangnya diberi tahu dan boleh keberatan 3 hari.
- **P4.** Sisa potongan orang yang berhenti: telat, tidak hadir, dan denda
  tidak ditagih; kehilangan barang, minus kas, Potongan Lain, dan kasbon
  menjadi Piutang Lain.

Bacaan Claude yang diajukan bersama dan tidak dibantah: rumus sebanding hari
dengan contoh pergantian orang (kantor menanggung sisanya, GAJ-18); hari
bekerja = hari ditempatkan, perbantuan tidak memindah tanggungan; keberatan
selisih kasir yang belum diputuskan tetap dipotong; sisa potongan diambil
lebih dulu dengan jenis asal tercatat; koreksi minus masuk kelompok jenis
asalnya; GAJ-58 memakai urutan yang sama lalu seluruh bersih menjadi denda;
Potongan Lain dan kasbon hanya dari slip utama; Pemilik dan GM tidak kena
potongan bagian ini.

Bacaan teknis: kehilangan yang disahkan sesudah slip periodenya ditutup
tetap dibagi menurut orang periode itu, bagian orang yang sudah tidak punya
slip berikutnya ditanggung kantor; kelebihan kas hanya menutup kekurangan
dari Laporan Kasir (KEU-54), tidak menutup catat tangan; satu jenis
pengajuan "Usulan potongan" untuk tiga catatan, tidak hangus.

Dicatat sebagai GAJ-75 s.d. 82 (bagian 3.10) di `../../aturan/03-gaji.md`.

### 4E-4 (diajukan 13 Oktober 2026; jawaban pemilik: **"ok"**, dibaca setuju saran untuk B1 s.d. B6)

Diajukan di percakapan (KER-13, 14). Saran Claude:

- **B1.** Bonus Bebas: HR mengajukan, Pemilik atau GM mengesahkan; sumber
  dana dipilih per baris (Uang kantor atau Dana Disiplin).
- **B2.** Bonus grooming disahkan sekaligus **per groomer per periode**;
  baris bertanda ⚠ satu per satu dulu. (Menyentuh PRI-40 butir 1.)
- **B3.** Bonus orang berslip utama mingguan masuk **slip mingguannya**.
  (Menyentuh tabel DRV-02 dan DRV-03.)
- **B4.** Dana Disiplin **satu untuk perusahaan**, rincian asal per cabang
  tampil.
- **B5.** Bonus Terukur disahkan **per aturan per periode**; bila Dana
  Disiplin kurang, semua orang di aturan itu menunggu bersama.
- **B6.** Slip terakhir **tertahan** selama ada bonus orang itu yang
  menunggu; bonus yang lahir sesudah slip terakhir dibayar dibayar di luar
  slip oleh Pemilik atau GM.

Bacaan Claude yang tidak ditanyakan karena mengikuti aturan yang ada: satu
pintu tulis; ongkir dan promo lahir Disahkan; Tersedia = Saldo − Terpesan,
mutasi keluar saat slip ditutup; baris yang ditolak karena dana kurang tetap
menunggu; koreksi bonus minus di kelompok (c); penerima di luar jabatan
penerima Ditahan; Dana Tidak Hadir per periode per cabang dengan saldo
berjalan perusahaan; GM tidak menerima bonus; saldo dana tidak ditampilkan
ke karyawan; bonus sistem lama yang belum masuk slip dibawa sebagai Bonus
Bebas Menunggu.

Dicatat sebagai GAJ-83 s.d. 90 (bagian 3.11) di `../../aturan/03-gaji.md`;
PRI-40 butir 1 diberi tanda pengecualian, DRV-03 dan tabel DRV-02 diberi
tanda pelapis.

### 4E-5a (diajukan 13 Oktober 2026; jawaban pemilik: **"ok"**, dibaca setuju saran untuk S1 s.d. S4)

Pecahan 4E-5 menjadi 4E-5a, 5b, 5c disetujui lebih dulu ("ok"). Diajukan di
percakapan (KER-13, 14). Saran Claude:

- **S1.** Menutup slip ditekan orang (HR, Pemilik, GM), tidak oleh mesin;
  satu tombol "Tutup semua yang siap"; aktif sesudah masa keberatan 26–28;
  pengingat berantai mulai batas tutup.
- **S2.** Tidak ada tutup paksa: semua penahan adalah keputusan kantor
  sendiri; slip tertahan ditutup dan dibayar menyusul begitu diputuskan;
  pengingat harian menyebut orang dan penyebabnya.
- **S3.** Membuka kembali hanya Pemilik atau GM, alasan wajib; HR boleh
  menutup tetapi hanya bisa meminta buka kembali; karyawan diberi tahu;
  masa keberatan dihitung ulang dari penutupan baru.
- **S4.** Slip terakhir lebih cepat: Pemilik atau GM, sesudah hari terakhir
  lewat dan tanpa penahan; keberatan 3 hari; kehilangan yang ditemukan
  sesudahnya bagian orang itu ditanggung kantor (GAJ-77); bonus sesudah
  dibayar dibayar di luar slip (GAJ-89).

Bacaan Claude yang diajukan bersama dan tidak dibantah: slip jabatan
bertanda ditutup Pemilik atau GM ("pemilik" di buku Gaji mencakup GM,
KAR-67), "Tutup semua" milik HR otomatis melewatinya; tutup per orang
selain tutup semua; slip bersih Rp0 ditutup biasa; isi satu langkah tutup
(rincian, Buku Upah, cicilan, sisa potongan, Piutang Lain, mutasi dana,
bonus Masuk slip, usulan tiadakan menjadi Tetap dipotong, absen terkunci);
buka kembali ditolak bila slip berikutnya sudah ditutup atau Piutang Lain
dari slip terakhir sudah dicicil; nomor tetap saat dibuka dan ditutup ulang,
versi lama disimpan; hanya slip tertutup yang dicetak.

Bacaan teknis: "Belum ada gaji berlaku" ikut menjadi penahan (slip tidak
bisa dihitung); pembukaan kembali boleh membuat Tersedia Dana Disiplin
minus, dan pengesahan bonus bersumber dana ditolak sampai cukup; "Minta
buka kembali" hanya pemberitahuan, bukan jenis pengajuan.

Dicatat sebagai GAJ-91 s.d. 97 (bagian 3.12) di `../../aturan/03-gaji.md`.

### 4E-5b (diajukan 13 Oktober 2026; jawaban pemilik: **"ok"**, dibaca setuju saran untuk Y1 s.d. Y5)

Diajukan di percakapan (KER-13, 14). Saran Claude:

- **Y1.** Tanggal uang saat menandai Dibayar boleh dipilih mundur sampai
  7 hari (lebih jauh dengan alasan), tidak sebelum slip ditutup; jam catat
  tetap dari server. Menyentuh DRV-26 ("tanggal bayar dari server"):
  menjadi pelapis yang mengikuti KEU-12.
- **Y2.** Finance mendapat Daftar Transfer (nama, rekening, bersih) untuk
  slip Ditutup belum Dibayar, tanpa rincian slip dan tanpa Pemilik dan GM;
  Finance tetap tidak menandai Dibayar. Menyentuh GAJ-46 (Finance hanya
  melihat total): menjadi pelapis.
- **Y3.** Catatan Cepat "Gaji/Upah" milik Pemilik atau GM yang dipasangkan
  finance ke slip langsung menjadikan slip itu Dibayar atas nama pencatatnya;
  jumlah harus persis.
- **Y4.** Slip bersih Rp0 langsung Dibayar "tanpa uang" saat ditutup.
- **Y5.** Uang untuk mantan karyawan (bonus susulan, koreksi plus)
  dipotongkan lebih dulu ke Piutang Lain orang itu; hanya sisanya dibayar.

Bacaan Claude yang tidak ditanyakan karena mengikuti aturan yang ada: satu
langkah per slip, bayar sekaligus dari satu tempat uang, yang gagal tidak
membatalkan yang lain; nominal = bersih, tanpa isian; tidak ditolak karena
saldo (KEU-106); cabang dibebani = cabang tersimpan, gaji jabatan bertanda
berkejadian "Gaji pemilik dan GM" (KEU-114); tidak menandai slipnya sendiri
kecuali GM (sejalan GAJ-95); batal bayar Pemilik atau GM kapan pun dengan
alasan, slip kembali Ditutup; jatuh bayar slip yang ditutup menyusul = tanggal
ditutup; pengingat mulai 07.00 hari sesudah jatuh bayar, satu jendela per
jalur; Ringkasan Finance tanpa per cabang dan tanpa gaji Pemilik dan GM.

Dicatat sebagai GAJ-98 s.d. 106 (bagian 3.13) di `../../aturan/03-gaji.md`;
DRV-26 diberi tanda pelapis (Y1), GAJ-46 diberi tanda pelapis (Y2); GAJ-48,
49, 55, 56, 59, 89, 96, DRV-27 dan 81 diberi tanda perincian.

### 4E-5c (ditulis 13 Oktober 2026 saat pemilik tidur; jawaban pemilik 14 Oktober 2026: **"ok"**, dibaca setuju saran untuk C1 s.d. C5)

Pemilik meminta 2–3 sesi dikerjakan berurutan tanpa menunggu. Pertanyaan di
bawah diketik ulang di percakapan saat pemilik kembali (KER-13, 14); spec
ditulis memakai saran Claude supaya tidak ada yang tertunda. Bila jawaban
berbeda, bagian 3.7 dan GAJ-107 s.d. 114 diubah.

- **C1.** Slip mingguan tampil utuh di periode tempat Kamis akhirnya jatuh;
  baris ritasenya di tab Upah tetap di periode tanggal kejadian (PRI-34
  butir 5). Kepala Pendapatan Saya tiga angka: Pendapatan, Sudah diterima,
  Belum diterima.
- **C2.** Keberatan slip dua macam: "Ada yang salah" (sejak periode
  berakhir sampai 3 hari sesudah ditutup, GAJ-42) dan "Uang belum saya
  terima" (7 hari sesudah ditandai Dibayar, diputuskan Pemilik atau GM).
  Keberatan tidak menahan slip.
- **C3.** Keberatan yang disetujui dibetulkan lewat sumbernya, tanpa isian
  nominal (GAJ-38); penyetuju wajib menautkan pembetulannya, diingatkan
  setiap hari sampai tertaut. Kesalahan gaji tetap di slip yang sudah
  ditutup memakai **Pembetulan gaji periode lalu** oleh Pemilik atau GM,
  menunjuk keberatan, menghasilkan baris koreksi di slip berikutnya.
  **Bertabrakan dengan GAJ-63** ("periode yang slipnya sudah ditutup tidak
  bisa dipilih"): diusulkan sebagai pengecualian sempit, hanya asal
  "pembetulan".
- **C4.** Unduh PDF hanya slip tertutup, boleh sampai 12 periode sekaligus.
  Mantan karyawan tetap bisa masuk dalam **akses terbatas** (hanya halaman
  uangnya) sampai 7 hari sesudah slip terakhir Dibayar, lebih lama bila
  masih ada keberatan atau tagihan. **Bertabrakan dengan KAR-07** ("akunnya
  mengikuti" nonaktif): diusulkan sebagai pelapis, karena tanpa ini GAJ-42
  dan GAJ-96 (keberatan 3 hari atas slip terakhir) tidak bisa dipakai orang
  yang sudah keluar.
- **C5.** Total Diterima per Orang: Pemilik dan GM semua; HR tanpa jabatan
  bertanda; Finance dan Admin HR tidak. Rentang 1–12 periode, termasuk
  mantan karyawan dan pekerja lepas bongkaran; menurut periode, bukan
  tanggal uang.

Bacaan Claude yang tidak ditanyakan karena mengikuti aturan yang ada:
peringatan GAJ-44 dibaca dari fungsi penahan ditambah Perlu Dijelaskan yang
belum diisi, tanpa jendela tambahan; status bayar di portal hanya tanggal
dan cara (KEU-24), tanpa tempat uang kantor; perkiraan tampil sepanjang
periode (GAJ-36), slip resmi hanya yang tertutup (GAJ-46); satu keberatan
Menunggu per macam per slip; keberatan yang belum diputuskan tidak Hangus.

Dicatat sebagai GAJ-107 s.d. 114 (bagian 3.14) di `../../aturan/03-gaji.md`,
disetujui 14 Oktober 2026.

---

## 14. Daftar periksa (peta jalan Tahap 4)

### Bagian 4E-1

- [x] Tidak melanggar WAJ-01 s.d. 12 (gaji bertanggal berlaku, satu fungsi
      baca gaji, tidak ada nama orang atau jabatan di aturan; hak lihat lewat
      tanda jabatan, tidak ada yang dihapus).
- [x] Setiap layar memenuhi TAM-01 s.d. 25 (langkah bertahap, Kembali,
      jendela error, simpan gaji ditahan 3 detik, jalan keluar terlihat).
- [x] Data memenuhi PRI-01 s.d. 41 (perusahaan, tanpa hapus, rupiah bulat,
      mesin berpenjaga, pengaturan bertanggal berlaku).
- [x] Aturan baru bernomor (GAJ-62 s.d. 67, bagian 3.8 `03-gaji.md`).
- [x] Kejadian (1 s.d. 19), jalan keluar, tes U1 s.d. U8, W1 s.d. W10,
      H1 s.d. H10.
- [x] Tiap layar menyebut ukuran utamanya, beda jabatan dicatat. Bentuk yang
      belum ada komponennya: kartu riwayat perubahan (sebelum → sesudah per
      komponen) dan kartu aturan dengan contoh hitungan.
- [x] Disetujui pemilik 13 Oktober 2026 (G1 s.d. G6 sesuai saran).

### Bagian 4E-2

- [x] Tidak melanggar WAJ-01 s.d. 12 (satu fungsi hitungan untuk perkiraan,
      slip, contoh, dan koreksi; angka dibaca menurut tanggal kejadian;
      perlakuan lewat pengaturan jabatan; tidak ada yang dihapus).
- [x] Setiap layar memenuhi TAM-01 s.d. 25 (peniadaan ditahan 3 detik, satu
      per satu dengan Berikutnya, jalan keluar terlihat).
- [x] Data memenuhi PRI-01 s.d. 41 (denda dibatalkan dan ditulis ulang, tidak
      ditimpa; koreksi di periode berikutnya, PRI-04; rincian bisa dijelaskan,
      PRI-21).
- [x] Aturan baru bernomor (GAJ-68 s.d. 74, bagian 3.9 `03-gaji.md`).
- [x] Kejadian 20 s.d. 42, jalan keluar, tes U9 s.d. U30, W11 s.d. W16,
      H11 s.d. H15.
- [x] Tiap layar menyebut ukuran utamanya. Bentuk yang belum ada
      komponennya: kartu baris hitungan dengan rincian per hari yang bisa
      dibuka (GAJ-L09).
- [x] Disetujui pemilik 13 Oktober 2026 (K1 s.d. K5 sesuai saran).

### Bagian 4E-3

- [x] Tidak melanggar WAJ-01 s.d. 12 (satu fungsi potongan untuk perkiraan,
      slip bulanan dan mingguan, contoh; persen dan bobot bertanggal
      berlaku; tanggungan lewat tanda jabatan, bukan nama orang; tidak ada
      yang dihapus).
- [x] Setiap layar memenuhi TAM-01 s.d. 25 (catat bertahap dengan pratinjau
      pembagian, tombol ditahan 3 detik, keberatan dari HP, jalan keluar
      terlihat).
- [x] Data memenuhi PRI-01 s.d. 41 (sisa kasbon dan Potongan Lain dihitung,
      tidak disimpan; pembagian dibatalkan dan ditulis ulang; koreksi di
      periode berikutnya; rincian bisa dijelaskan).
- [x] Aturan baru bernomor (GAJ-75 s.d. 82, bagian 3.10 `03-gaji.md`).
- [x] Kejadian 43 s.d. 68, jalan keluar, tes U31 s.d. U48, W17 s.d. W22,
      H16 s.d. H23.
- [x] Tiap layar menyebut ukuran utamanya. Bentuk yang belum ada
      komponennya: kartu pembagian (orang, bobot, hari, bagian, dan bagian
      kantor tiga angka) dan tabel urutan potongan (nominal, terpotong,
      sisa).
- [x] Disetujui pemilik 13 Oktober 2026 (P1 s.d. P4 sesuai saran).

### Bagian 4E-4

- [x] Tidak melanggar WAJ-01 s.d. 12 (satu pintu tulis dan satu fungsi
      keadaan dana; angka bonus bertanggal berlaku dan dibaca menurut
      tanggal kejadian; penerima lewat jabatan, bukan nama; tidak ada yang
      dihapus; dana dihitung dari mutasi).
- [x] Setiap layar memenuhi TAM-01 s.d. 25 (pengesahan berkelompok ditahan
      3 detik, Berikutnya, alasan wajib untuk tolak dan batal, jalan keluar
      terlihat).
- [x] Data memenuhi PRI-01 s.d. 41 (kunci asal mencegah dobel; perubahan
      dari kasir dibatalkan dan ditulis ulang atau lewat daftar periksa,
      PRI-41; bonus bisa dijelaskan sampai nota atau laporan, PRI-21).
- [x] Aturan baru bernomor (GAJ-83 s.d. 90, bagian 3.11 `03-gaji.md`).
- [x] Kejadian 69 s.d. 88, jalan keluar, tes U49 s.d. U63, W23 s.d. W30,
      H24 s.d. H32.
- [x] Tiap layar menyebut ukuran utamanya. Bentuk yang belum ada
      komponennya: kartu kelompok pengesahan (daftar baris + satu tombol
      ditahan) dan kepala tiga angka dana (Saldo, Terpesan, Tersedia).
- [x] Disetujui pemilik 13 Oktober 2026 (B1 s.d. B6 sesuai saran).

### Bagian 4E-5a

- [x] Tidak melanggar WAJ-01 s.d. 12 (satu fungsi hitung slip dan satu
      fungsi penahan; angka terkunci sama dengan perkiraan; tidak ada yang
      dihapus, versi lama disimpan; setiap tutup punya jalan keluar buka
      kembali atau koreksi berikutnya).
- [x] Setiap layar memenuhi TAM-01 s.d. 25 (tutup dan buka kembali bertahap,
      tombol ditahan 3 detik, tombol mati menyebut kapan aktif, hasil tutup
      semua menyebut yang gagal dan sebabnya).
- [x] Data memenuhi PRI-01 s.d. 41 (jam server, rincian tersimpan baris demi
      baris dan bisa dijelaskan, koreksi sesudah tutup di periode berikutnya,
      mesin berpenjaga).
- [x] Aturan baru bernomor (GAJ-91 s.d. 97, bagian 3.12 `03-gaji.md`).
- [x] Kejadian 89 s.d. 106, jalan keluar, tes U64 s.d. U73, W31 s.d. W36,
      H33 s.d. H39.
- [x] Tiap layar menyebut ukuran utamanya. Bentuk yang belum ada
      komponennya: kartu slip (pendapatan, potongan berkelompok dengan tiga
      angka nominal–terpotong–sisa, bersih, catatan), daftar penahan dengan
      tombol ke layar penyelesai, dan cetakan A4.
- [x] Disetujui pemilik 13 Oktober 2026 (S1 s.d. S4 sesuai saran).

### Bagian 4E-5b

- [x] Tidak melanggar WAJ-01 s.d. 12 (satu langkah bayar per slip, satu
      fungsi ringkasan; pengeluaran gaji hanya dari slip; tidak ada yang
      dihapus, pembayaran dibatalkan; setiap bayar punya jalan keluar batal
      bayar).
- [x] Setiap layar memenuhi TAM-01 s.d. 25 (bayar dan batal bayar bertahap,
      tombol ditahan 3 detik, hasil bayar sekaligus menyebut yang gagal,
      pengingat lolos TAM-24 dan dikelompokkan TAM-25).
- [x] Data memenuhi PRI-01 s.d. 41 (jam catat server, satu pembayaran
      Berlaku per slip, mesin berpenjaga, kunci asal tagihan luar slip).
- [x] Aturan baru bernomor (GAJ-98 s.d. 106, bagian 3.13 `03-gaji.md`).
- [x] Kejadian 107 s.d. 123, jalan keluar, tes U74 s.d. U83, W37 s.d. W42,
      H40 s.d. H48.
- [x] Tiap layar menyebut ukuran utamanya. Bentuk yang belum ada
      komponennya: daftar berkelompok yang bisa dibuka per orang dengan
      centang per kelompok (Jadwal Bayar) dan tabel ringkasan berimbang
      dengan sudut pandang.
- [x] Disetujui pemilik 13 Oktober 2026 (Y1 s.d. Y5 sesuai saran).

### Bagian 4E-5c

- [x] Tidak melanggar WAJ-01 s.d. 12 (angka karyawan dari fungsi dan baris
      yang sama dengan kantor; tidak ada nominal diketik di keberatan;
      setiap keberatan yang disetujui punya jalan pembetulan dan tautan;
      pengecualian GAJ-63 dan pelapis KAR-07 ditandai jenisnya, WAJ-12).
- [x] Setiap layar memenuhi TAM-01 s.d. 25 (keberatan bertahap dari HP,
      tombol hilang saat lewat batas dengan arahan, peringatan menyebut
      siapa bertindak, jalan keluar terlihat).
- [x] Data memenuhi PRI-01 s.d. 41 (jam server untuk semua batas, tidak ada
      yang dihapus, koreksi di periode berikutnya, rincian bisa dibuka,
      PRI-21; slip mingguan tidak dihitung dua kali, PRI-34).
- [x] Aturan baru bernomor (GAJ-107 s.d. 114, bagian 3.14 `03-gaji.md`,
      disetujui 14 Oktober 2026).
- [x] Kejadian 124 s.d. 141, jalan keluar, tes U84 s.d. U89, W43 s.d. W48,
      H49 s.d. H59.
- [x] Tiap layar menyebut ukuran utamanya. Bentuk yang belum ada
      komponennya: kotak peringatan berdaftar "Anda / Kantor" dengan tombol
      per baris, kepala tiga angka uang, dan bilah "Akses terbatas" (varian
      bilah Lihat sebagai).
- [x] Disetujui pemilik 14 Oktober 2026 (C1 s.d. C5 sesuai saran).
