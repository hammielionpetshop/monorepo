# Spec Siap Bangun: Kinerja (Tahap 4I)

Tanggal: 14 Oktober 2026
Status per bagian:

| Bagian | Isi | Status |
|---|---|---|
| **4I-1** | Rapor: daftar ukuran dan rumus persennya, kriteria dan bobot per jabatan per cabang, target omzet, Perkiraan dan Ditetapkan, koreksi, pindah dan masuk di tengah periode, Kinerja Saya (KIN-01 s.d. 12) | **Disetujui penuh 14 Oktober 2026** (RP1 s.d. RP4 sesuai saran, KIN-52 s.d. 58, 9 layar KIN-L01 s.d. L09) |
| **4I-2** | Bonus Terukur: bentuk aturan, angka syarat, rentang, penerima, sumber dana, mesin penilai, pengiriman ke Buku Bonus, koreksi (KIN-13 s.d. 18) | **Disetujui penuh 14 Oktober 2026** (BT1 s.d. BT3 sesuai saran, KIN-59 s.d. 64, 3 layar KIN-L10 s.d. L12) |
| **4I-3** | Penjualan Promo: produk dan target, tarif, melapor, penjaga dobel, pemeriksaan, tercapai atau belum, bonus ke Buku Bonus (KIN-19 s.d. 26) | **Disetujui penuh 14 Oktober 2026** (PM1 s.d. PM3 sesuai saran, KIN-65 s.d. 71, 7 layar KIN-L13 s.d. L19) |
| **4I-4a** | Tugas, membuat sampai melapor: Master Judul, jenis, sasaran, jatah dari hari kerja, lapor hari ini, penjaga foto, tugas tim, tugas sekali jalan (KIN-27 s.d. 38) | **Disetujui penuh 14 Oktober 2026** (TG1 s.d. TG3 sesuai saran, KIN-72 s.d. 78, 7 layar KIN-L20 s.d. L26) |
| **4I-4b** | Tugas, penjagaan dan hitungan: tanda janggal, tidak sah, hitungan saat rapor ditetapkan, tugas rutin dikerjakan, daftar rak dan kerapian display (KIN-39 s.d. 44) | **Disetujui penuh 14 Oktober 2026** (TJ1 s.d. TJ3 sesuai saran, KIN-79 s.d. 84, 5 layar KIN-L27 s.d. L31) |
| **4I-5** | Catatan Rapat, hak akses, mesin, pengaturan (KIN-45 s.d. 51) | **Disetujui penuh 14 Oktober 2026** (CR1 s.d. CR2 sesuai saran, KIN-85 s.d. 88, 4 layar KIN-L32 s.d. L35) |

**Pembagian enam bagian** dipilih Claude saat pemilik meminta 4H dan 4I
dikerjakan langsung berurutan memakai saran Claude (14 Oktober 2026);
pembagian ini disetujui pemilik 14 Oktober 2026 bersama jawaban pertanyaan ("ok"). 4I ukuran
**besar**: 51 aturan untuk lima urusan (rapor, bonus, promo, tugas, rapat).
Tugas paling banyak aturannya, jadi dibagi dua. Urutannya mengikuti
ketergantungan: ukuran rapor (4I-1) dipakai syarat Bonus Terukur (4I-2) dan
dihitung dari Promo (4I-3) dan Tugas (4I-4); hak akses diperiksa ulang di
4I-5.

Spec ini satu file untuk seluruh 4I. Bentuk mengikuti bagian 0
`2026-10-13-karyawan-dan-akses-spec.md`. Kode layar **KIN-L**. Tampilan
disusun dari komponen baku (`../desain/README.md`); tidak digambar.

**Uang tidak diatur di sini.** Buku Bonus, halaman Persetujuan Bonus
(GAJ-L20), pintu tulis "catat bonus", dan cara bonus masuk slip milik Gaji
(4E-4). Spec ini mengatur dari mana bonus lahir: ukuran, syarat, dan
buktinya (KIN bagian pengantar).

Bahan: `../../aturan/07-kinerja-rekrutmen.md` KIN-01 s.d. 51 (termasuk
bagian 6 butir 9 dan 10, rumus persen dan sambungan kasir); arsip
`../../aturan/arsip/07-kinerja-rekrutmen-galian.md`; spec Gaji 4E-4 (pintu
tulis Buku Bonus, jenis Promo dan Bonus Terukur, GAJ-L20 tab Promo dan
Bonus Terukur, B5, GAJ-90 koreksi bonus); spec Kehadiran (fungsi status
hari KEH-81, telat dan toleransi KEH-22, titik lokasi dan jam shift, hari
tutup); spec Keuangan 4H-5 (selisih kasir per laporan, KEU-169); spec Tarik
Data Kasir (`kasir_produk`, `kasir_transaksi`, `kasir_omzet_harian`);
Perlengkapan Bersama (Papan Perubahan Aturan BER-L23, pengingat, Kesehatan
Mesin); KAR-56, 58, 62, 67; PRI-01, 02, 17, 20, 22, 25, 29, 32 s.d. 35, 37,
40; TAM-07, 08, 15, 22; WAJ-03 s.d. 07, 11.

---

## 1. Batas

**Dikerjakan (4I-1):** daftar ukuran beserta rumus persen dan angka
mentahnya; kriteria dan bobot per jabatan per cabang; target omzet cabang;
satu fungsi rapor; tahap Perkiraan dan Ditetapkan; catatan koreksi; orang
yang pindah, masuk, atau berhenti di tengah periode; Kinerja Saya.

**Dikerjakan (4I-2):** aturan Bonus Terukur (ukuran, angka syarat, rentang,
nominal, penerima, sumber dana, tanggal berlaku); mesin penilai harian
(perkiraan) dan penilaian saat rapor ditetapkan; pengiriman hasil ke pintu
tulis Buku Bonus; berturut-turut; koreksi sesudah ditetapkan.

**Dikerjakan (4I-3):** produk promo dari daftar produk kasir, target per
cabang per periode, dua tarif per pcs; melapor penjualan; batas lapor dan
potongan telat; penjaga dobel dan pencocokan dengan kasir; kartu
pemeriksaan di tab Promo; tercapai atau belum; bonus promo ke Buku Bonus.

**Dikerjakan (4I-4a):** Master Judul; tugas rutin dan sekali jalan;
kebutuhan foto dan mode tim; siapa membuat; sasaran per jabatan per cabang;
jatah dari hari kerja; melapor hari ini; penjaga foto; tugas tim; tugas
sekali jalan bertenggat dan pemeriksaan laporan akhirnya; pengingat.

**Dikerjakan (4I-4b):** tanda janggal; tanda tidak sah (usul dan
penetapan); hitungan yang dikunci saat rapor ditetapkan; ukuran "tugas
rutin dikerjakan"; daftar rak, penanggung jawab, jadwal, dan ukuran
kerapian display.

**Dikerjakan (4I-5):** Catatan Rapat (draf, terbit, versi, tarik, tugas
tindak lanjut); pemeriksaan akhir hak akses, mesin, dan pengaturan seluruh
4I.

**Tidak dikerjakan di spec ini:**

| Hal | Di mana |
|---|---|
| Buku Bonus, pintu tulis "catat bonus", nominal akhir, pengesahan, sumber dana dan saldonya, bonus masuk slip, koreksi bonus di slip | Gaji 4E-4 (GAJ-24 s.d. 35, 83 s.d. 90; GAJ-L20). Spec ini hanya mengirim dasar hitungan |
| Hadir, telat, izin, sakit, alpha, hari kerja, titik lokasi, jam shift, hari tutup | Kehadiran 4D (KEH-22, 81, 102 s.d. 107). Dibaca lewat fungsinya |
| Selisih kasir per laporan dan keberatannya | Keuangan 4H-5 (KEU-169) |
| Daftar produk, transaksi, omzet | Tarik Data Kasir 4C |
| Orang, jabatan, cabang, riwayat penempatan, daftar hak | Karyawan 4A (KAR-56, 58) |
| Papan Perubahan Aturan, Mesin Pengajuan, pengingat berantai, Kesehatan Mesin | Perlengkapan Bersama 4B |
| Bonus grooming dan targetnya | Gaji (GAJ-61) |
| Bonus Kinerja bertingkat, Ranking Disiplin, Tabungan Loyalitas | Ditunda (KIN-18) |
| Rekrutmen | Ditangguhkan (backlog rekrutmen) |
| Isi aturan Bonus Terukur, kriteria dan bobot, target omzet, daftar rak, tugas masuk rapor | Diisi pemilik saat menyiapkan tayang (KIN bagian 6 butir 6 s.d. 8; **tidak ditanyakan**) |

---

## 2. Daftar layar

| Kode | Layar | Letak di menu | Dipakai | Ukuran utama | Bagian |
|---|---|---|---|---|---|
| KIN-L01 | Kinerja Saya | Saya › Kinerja Saya | Semua karyawan yang punya rapor | HP | 4I-1 |
| KIN-L02 | Rapor (daftar kantor) | Kantor › Kinerja › Rapor | HR, Pemilik, GM; kepala cabang dan Kepala Gudang (timnya, baca) | PC | 4I-1 |
| KIN-L03 | Rapor Seseorang | dari KIN-L02 | Sama | PC | 4I-1 |
| KIN-L04 | Tetapkan Rapor (2 langkah) | dari KIN-L02 | HR, Pemilik, GM | PC | 4I-1 |
| KIN-L05 | Catatan Koreksi Rapor (3 langkah) | dari KIN-L03 | HR, Pemilik, GM | PC | 4I-1 |
| KIN-L06 | Kriteria Rapor | Pengaturan › Kinerja | HR, Pemilik, GM | PC | 4I-1 |
| KIN-L07 | Ubah Kriteria (3 langkah) | dari KIN-L06 | HR, Pemilik, GM | PC | 4I-1 |
| KIN-L08 | Target Omzet Cabang | Pengaturan › Kinerja | HR, Pemilik, GM | PC | 4I-1 |
| KIN-L09 | Daftar Ukuran | Pengaturan › Kinerja | HR, Pemilik, GM (baca) | PC | 4I-1 |
| KIN-L10 | Aturan Bonus Terukur | Pengaturan › Kinerja | Pemilik, GM mengubah; HR melihat | PC | 4I-2 |
| KIN-L11 | Aturan Bonus Baru atau Ubah (5 langkah) | dari KIN-L10 | Pemilik, GM | PC | 4I-2 |
| KIN-L12 | Hasil Penilaian Bonus Terukur | Kantor › Kinerja › Rapor, tab "Bonus Terukur" | HR, Pemilik, GM | PC | 4I-2 |
| KIN-L13 | Produk Promo | Kantor › Kinerja › Penjualan Promo | HR, Pemilik, GM; kepala cabang (cabangnya, baca) | PC | 4I-3 |
| KIN-L14 | Produk Promo Baru atau Ubah (4 langkah) | dari KIN-L13 | HR (tanpa tarif), Pemilik, GM | PC | 4I-3 |
| KIN-L15 | Isi Tarif Promo (2 langkah) | dari KIN-L13 | Pemilik, GM | PC | 4I-3 |
| KIN-L16 | Lapor Penjualan Promo (3 langkah) | Kerja Harian › Laporan Promo | Karyawan yang boleh melapor | HP | 4I-3 |
| KIN-L17 | Laporan Promo Saya | Kerja Harian › Laporan Promo | Pelapor | HP | 4I-3 |
| KIN-L18 | Kartu Laporan Promo | isi khas tab Promo GAJ-L20 | HR, Pemilik, GM | PC | 4I-3 |
| KIN-L19 | Capaian Promo per Cabang | tab di KIN-L13; kartu di Kinerja Saya | HR, Pemilik, GM; karyawan (cabangnya) | PC, HP | 4I-3 |
| KIN-L20 | Tugas Saya | Kerja Harian › Tugas | Semua karyawan | HP | 4I-4a |
| KIN-L21 | Lapor Tugas (2 atau 3 langkah) | dari KIN-L20 | Sasaran tugas | HP | 4I-4a |
| KIN-L22 | Tugas (daftar kantor) | Kantor › Kinerja › Tugas | HR, Pemilik, GM; kepala cabang, Kepala Gudang (timnya) | PC | 4I-4a |
| KIN-L23 | Tugas Baru atau Ubah (5 langkah) | dari KIN-L22 | Pembuat menurut KIN-30 | PC; bisa dipakai di HP | 4I-4a |
| KIN-L24 | Master Judul | Pengaturan › Kinerja | HR, Pemilik, GM; kepala cabang (baca, memilih) | PC | 4I-4a |
| KIN-L25 | Periksa Laporan Akhir | dari KIN-L22; Antrean | Pembuat tugas, HR, Pemilik, GM | PC, HP | 4I-4a |
| KIN-L26 | Kemajuan Tim | Kantor › Kinerja › Tugas, tab "Kemajuan" | Kepala cabang, Kepala Gudang (timnya); HR, Pemilik, GM | PC, HP | 4I-4a |
| KIN-L27 | Laporan Bertanda | Kantor › Kinerja › Tugas, tab "Bertanda" | HR, Pemilik, GM; kepala cabang (timnya) | PC | 4I-4b |
| KIN-L28 | Usulkan atau Tetapkan Tidak Sah (2 langkah) | dari KIN-L27 | Kepala cabang mengusulkan; HR, Pemilik, GM menetapkan | PC, HP | 4I-4b |
| KIN-L29 | Daftar Rak | Pengaturan › Kinerja; tab di KIN-L26 | HR, Pemilik, GM mengubah; kepala cabang melihat | PC | 4I-4b |
| KIN-L30 | Lapor Rak | Kerja Harian › Tugas (bagian "Rak saya") | Penanggung jawab rak | HP | 4I-4b |
| KIN-L31 | Kerapian Display | tab di KIN-L26 | Kepala cabang (cabangnya); HR, Pemilik, GM | PC, HP | 4I-4b |
| KIN-L32 | Catatan Rapat | Kantor › Kinerja › Catatan Rapat; Saya › Catatan Rapat | HR, Pemilik, GM; sasaran (yang ditujukan kepadanya) | PC; HP untuk sasaran | 4I-5 |
| KIN-L33 | Tulis Catatan Rapat (3 langkah) | dari KIN-L32 | HR, Pemilik, GM | PC | 4I-5 |
| KIN-L34 | Rincian Catatan Rapat | dari KIN-L32, pemberitahuan | Sasaran; HR, Pemilik, GM | HP, PC | 4I-5 |
| KIN-L35 | Tarik Catatan Rapat (2 langkah) | dari KIN-L34 | HR, Pemilik, GM | PC | 4I-5 |

Jumlah: 4I-1 9 layar, 4I-2 3, 4I-3 7, 4I-4a 7, 4I-4b 5, 4I-5 4; **seluruh
4I: 35 layar**. Persetujuan bonus memakai GAJ-L20 (tab Promo dan Bonus
Terukur); tidak ada halaman persetujuan kedua.

---

## 3. Rincian layar

Aturan untuk semua layar di bawah, tidak diulang per layar: error di jendela
"OK, paham" (TAM-01 s.d. 06); tombol menyimpan terkunci sampai selesai
(TAM-13); isian tidak hilang kalau sinyal putus (TAM-16); pesan berhasil
menyebut apa yang tersimpan dan siapa bertindak berikutnya (TAM-17); daftar
dibagi per halaman dan bisa dicari (PRI-10); semua jam dari server (PRI-01);
konfirmasi yang menyangkut uang atau status orang ditahan 3 detik (TAM-15);
yang tidak berhak tidak melihat menunya (KIN-48).

### 3.1 Bagian 4I-1: Rapor

**Disetujui penuh 14 Oktober 2026** (RP1 s.d. RP4 "ok", sesuai saran; bagian 13; aturan
KIN-52 s.d. 58 di bagian 3.10 `../../aturan/07-kinerja-rekrutmen.md`).

**Pokoknya:** rapor adalah nilai persen tiap orang tiap periode 26–25 dari
angka yang sudah tercatat di modul lain. Tidak ada nilai yang diketik
orang. Rapor tidak membawa uang; ia cermin kerja yang bisa dibaca karyawan
sampai ke angka di baliknya.

Pelajaran sistem lama: rumus nilai ditulis tiga kali; KPI menghitung ulang
kehadiran tanpa toleransi; nilai manual 0–100 diketik; kriteria per nama
orang, bisa dihapus, tanpa tanggal; kriteria tanpa data dihitung 0; rekap
bisa ditimpa kapan saja; karyawan hanya melihat persen.

#### Daftar ukuran dan rumus persennya (KIN-04; bagian 6 butir 9; RP1, RP2)

Satu fungsi server **"ukuran (orang, ukuran, periode)"** (WAJ-04) yang
mengembalikan **persen** (untuk rapor) dan **angka mentah** (untuk ditampilkan
dan untuk syarat Bonus Terukur, 4I-2). Persen dibatasi 0 sampai 100,
disimpan apa adanya, ditampilkan satu angka di belakang koma.

| Ukuran | Persen | Angka mentah yang tersedia | Dibaca dari | Belum ada data bila |
|---|---|---|---|---|
| **Kehadiran** (RP1) | hari hadir ÷ hari kerja wajib. **Hari kerja wajib** = hari kerja menurut jadwal dikurangi cuti dan sakit bersurat dokter. Izin, sakit tanpa surat, dan alpha mengurangi nilai | hadir, izin, sakit (bersurat dan tidak), alpha, cuti, hari kerja wajib | Kehadiran (status hari, KEH-81) | Tidak ada hari kerja wajib |
| **Tepat waktu** | hari hadir tanpa telat ÷ hari hadir. Telat = melewati toleransi 5 menit (KEH-22) | hari telat, menit telat | Kehadiran | Tidak ada hari hadir |
| **Tugas rutin dikerjakan** | dikerjakan ÷ jatah (KIN-42, 4I-4b) | jatah, dikerjakan, tidak sah, gugur | Tugas | Tidak ada jatah tugas bertanda masuk rapor |
| **Kerapian display** | jatah rak yang dirapikan sesuai jadwal ÷ seluruh jatah (KIN-43, 4I-4b) | jatah rak, dirapikan | Tugas | Orang itu tidak menjadi penanggung jawab rak |
| **Penjualan promo** | pcs disetujui cabang ÷ target cabang (rata-rata per produk bila lebih dari satu) | pcs per produk, target per produk | Penjualan Promo | Cabang tidak punya produk promo di periode itu |
| **Target omzet** | omzet cabang ÷ target cabang; **baru menyala setelah sambungan kasir hidup** | omzet, target | Tarik Data Kasir | Sambungan belum menyala atau target kosong |
| **Ketelitian kasir** (RP2) | Laporan Kasir orang itu yang **tanpa selisih** ÷ seluruh Laporan Kasir yang ia tutup. Kekurangan yang **Ditiadakan** lewat keberatan dihitung tanpa selisih; selisih non-tunai yang tidak dibebankan kepadanya tidak dihitung | jumlah laporan, laporan berselisih, selisih per hari (rupiah, lebih dan kurang), jumlah selisih periode | Keuangan (KEU-169) | Orang itu tidak menutup shift di periode itu |

- **Kehilangan barang tidak menjadi ukuran** (KIN-17).
- Daftar ukuran bisa ditambah lewat pembangunan (PRI-20), karena tiap
  ukuran butuh sambungan ke modul asalnya. Layar KIN-L09 hanya untuk dibaca.

#### Kriteria dan bobot (KIN-05, 06, 08; RP3)

- **Kelompok kriteria** per **jabatan per cabang** (boleh "semua cabang"
  untuk satu jabatan; yang lebih khusus menang): daftar ukuran dan bobotnya,
  berlaku dari tanggal. Jumlah bobot harus **100**; kalau tidak, simpan
  ditolak dengan menyebut selisihnya.
- Bertanggal berlaku; tidak dihapus, hanya dinonaktifkan. Perubahan tidak
  mengubah periode yang sudah lewat; perubahan di tengah periode berlaku
  untuk **seluruh periode berikutnya** (bukan sebagian periode), supaya satu
  rapor dihitung dengan satu kelompok kriteria.
- Jabatan yang tidak punya kriteria tidak punya rapor.
- **Nilai keseluruhan (RP3)** = rata-rata berbobot dari kriteria yang **ada
  datanya**. Bobot kriteria yang "belum ada data" **dibagi ulang**
  sebanding ke kriteria lain (contoh: Kehadiran 50, Tepat waktu 30, Promo
  20; promo belum ada data → Kehadiran 62,5 dan Tepat waktu 37,5). Bila semua
  kriteria belum ada data, rapor tertulis "belum ada data", tanpa angka.
- **Target omzet cabang** per periode, bertanggal berlaku (KIN-L08).
- Yang mengatur: HR, Pemilik, GM (KIN-48). Perubahan kriteria yang
  menyangkut karyawan diumumkan lewat Papan (KIN-51, PRI-29; jarak menurut
  PRI-35).

#### Perkiraan dan Ditetapkan (KIN-09, 10, 41; RP4)

- **Perkiraan:** mesin menghitung tiap malam untuk periode berjalan dan
  periode yang belum ditetapkan; karyawan melihatnya bertulisan
  "perkiraan".
- **Ditetapkan (RP4):** tombol **Tetapkan** aktif mulai **tanggal 29 pukul
  00.00** (sesudah masa klarifikasi absen dan keberatan kasir periode itu
  lewat, sejalan dengan tombol tutup slip, GAJ-91), oleh HR, Pemilik, atau
  GM; tidak untuk rapornya sendiri (rapor HR ditetapkan Pemilik atau GM,
  KIN-49). Menetapkan berarti memeriksa hasil hitungan lalu menguncinya:
  rincian tiap kriteria, angka mentah, bobot, jam, dan penetap **disimpan**
  dan tidak berubah lagi. Hitungan tugas (jatah, dikerjakan, tidak sah,
  gugur) ikut dikunci (KIN-41). Boleh **"Tetapkan semua yang siap"** per
  cabang; rapor yang punya tanda (laporan janggal belum diputuskan,
  klarifikasi absen masih menunggu) dikeluarkan dan harus dibuka satu per
  satu.
- Rapor yang belum ditetapkan saat masa keberatan slip dimulai ditandai
  untuk HR dan pemilik. **Rapor bukan penahan slip:** slip tetap ditutup;
  Bonus Terukurnya masuk slip berikutnya dengan keterangan periode asal
  (KIN-10, GAJ-50).
- Saat rapor ditetapkan, mesin penilai Bonus Terukur (4I-2) menilai periode
  itu dan mengirim hasilnya ke Buku Bonus.

#### Koreksi sesudah ditetapkan (KIN-10)

- **Catatan koreksi** (KIN-L05): HR, Pemilik, atau GM; alasan wajib; tidak
  untuk rapornya sendiri. Contoh sebab: absen dibetulkan sesudah ditetapkan,
  keberatan kasir diputuskan Ditiadakan, laporan tidak sah dicabut lewat
  koreksi.
- Mesin menghitung ulang dengan data sekarang dan menyimpan **versi baru**
  bertaut ke catatan koreksi; versi lama tetap bisa dibuka. Bila hasil Bonus
  Terukur berubah, selisihnya dikirim ke Gaji sebagai koreksi bonus (masuk
  slip berikutnya, GAJ-90).

#### Pindah, masuk, berhenti (KIN-11)

- Rapor per periode orang yang pindah cabang atau jabatan memakai kelompok
  kriteria **tempat ia paling lama bekerja** di periode itu (sama lama: yang
  terakhir), dibaca dari riwayat penempatan (KAR-56); angkanya dari seluruh
  periode.
- Orang yang masuk atau berhenti di tengah periode tetap punya rapor dari
  hari ia bekerja; tandanya "periode tidak penuh" (dipakai syarat bonus,
  4I-2).
- Orang yang berhenti tanpa pemberitahuan sebulan dan dikenai denda
  kehilangan bonus yang belum dibayar (GAJ-58); rapornya tetap ada.

#### KIN-L01. Kinerja Saya

- **HP.** Kepala: periode (geser ke periode lalu), tahap (Perkiraan atau
  Ditetapkan), nilai keseluruhan besar.
- Kartu per kriteria: persen, bobot, angka di baliknya dengan kalimat
  ("hadir 22 dari 24 hari kerja wajib; 1 cuti tidak dihitung"), tanda
  "belum ada data".
- Kartu **Bonus**: Bonus Terukur yang sedang terpenuhi atau gagal beserta
  syaratnya dan perkiraan nominalnya (4I-2); bonus promo perkiraan dengan dua
  tarif (4I-3).
- Kartu **Tugas** dan **Rak** ringkas (4I-4).
- Kalimat untuk yang merasa salah: "Kalau angka absen atau laporan Anda
  salah, ajukan klarifikasi di sumbernya sebelum rapor ditetapkan."

#### KIN-L02. Rapor (daftar kantor)

- **PC.** Pilih periode dan cabang. Tabel orang: jabatan, nilai
  keseluruhan, nilai tiap kriteria, tahap, tanda (periode tidak penuh,
  belum ada data, laporan bertanda belum diputuskan).
- **Tombol (HR, Pemilik, GM):** **Tetapkan** (KIN-L04).
- **Beda jabatan:** kepala cabang dan Kepala Gudang melihat timnya tanpa
  tombol (KIN-48). Finance tidak punya menu Kinerja.

#### KIN-L03. Rapor Seseorang

- Isi KIN-L01 versi kantor ditambah: kelompok kriteria yang dipakai (dan
  sebabnya bila pindah), riwayat versi (penetapan dan koreksi), tautan ke
  angka sumber (rekap kehadiran, laporan tugas, Laporan Kasir).
- **Tombol:** **Catatan koreksi** (KIN-L05) bila Ditetapkan.

#### KIN-L04. Tetapkan Rapor (2 langkah)

1. **Daftar:** rapor yang siap (tanpa tanda) dan yang dikeluarkan beserta
   sebabnya.
2. **Tetapkan:** jumlah orang; tombol ditahan 3 detik. Hasil: berapa
   ditetapkan, berapa Bonus Terukur terkirim ke Persetujuan Bonus.

#### KIN-L05. Catatan Koreksi Rapor (3 langkah)

1. Alasan (wajib, 15 huruf) dan sebab (absen dibetulkan, keberatan kasir,
   tidak sah dicabut, lainnya).
2. Hasil hitung ulang: sebelum → sesudah per kriteria dan akibat bonus.
3. Simpan, ditahan 3 detik. Orangnya diberi tahu.

#### KIN-L06. Kriteria Rapor

- Tabel jabatan × cabang: kelompok kriteria yang berlaku, jumlah bobot,
  berlaku dari, terjadwal. Jabatan tanpa kriteria tertulis "tidak punya
  rapor".
- Tombol **Ubah** (KIN-L07).

#### KIN-L07. Ubah Kriteria (3 langkah)

1. Jabatan dan cabang (atau semua cabang).
2. Ukuran dan bobot (jumlah harus 100; selisih tampil langsung).
3. Berlaku mulai periode (paling cepat periode berikutnya) dan pengumuman
   (draf Papan disiapkan); periksa, ditahan 3 detik.

#### KIN-L08. Target Omzet Cabang

- Per cabang per periode: target, berlaku dari, riwayat; tanda "ukuran
  belum menyala" selama sambungan kasir mati.

#### KIN-L09. Daftar Ukuran

- Tabel ukuran: rumus persen dalam kalimat, angka mentah, sumber, keadaan
  (menyala, menunggu sambungan kasir). Baca saja.

### 3.2 Bagian 4I-2: Bonus Terukur

**Disetujui penuh 14 Oktober 2026** (BT1 s.d. BT3 "ok", sesuai saran; bagian 13; aturan
KIN-59 s.d. 64 di bagian 3.11 `../../aturan/07-kinerja-rekrutmen.md`).

**Pokoknya:** satu aturan bonus berbunyi "kalau angka X memenuhi syarat
dalam rentang ini, dapat Rp Y". Mesin menilai dari data; tidak ada yang
mencentang. Hasilnya dikirim ke Persetujuan Bonus milik Gaji, lalu ke slip.

Pelajaran sistem lama: Bonus KPI = nominal maksimal per orang dikali nilai
yang diketik; syarat bonus bersyarat dicentang orang.

#### Bentuk aturan (KIN-13, 14, 15)

| Isian | Keterangan |
|---|---|
| Nama | "Kasir teliti harian", "Sebulan tanpa telat" |
| Ukuran dan angka | Satu **angka mentah** dari daftar ukuran (4I-1), misalnya selisih kasir per hari, jumlah selisih periode, hari telat, izin + sakit |
| Syarat | Pembanding (≤, <, =, ≥) dan batas. Selisih kasir dibaca **lebih maupun kurang** (nilai mutlak) |
| Rentang | **Per hari**, **per periode**, atau **N periode berturut-turut** |
| Nominal | Rupiah per hari terpenuhi, per periode, atau per pencapaian berturut-turut |
| Penerima | Jabatan dan cabang (pengaturan bersasaran, boleh "semua cabang") |
| Sumber dana | Wajib dipilih sebelum aktif (GAJ-25): Uang kantor atau Dana Disiplin |
| Berlaku dari, berhenti mulai | Bertanggal; tidak dihapus |

- Hanya **Pemilik dan GM** yang membuat dan mengubah (KIN-48). Aturan yang
  menyangkut uang karyawan **diumumkan lewat Papan** (PRI-29, 35): aturan
  baru atau nominal naik paling cepat besok; nominal turun, syarat
  diperketat, atau aturan dihentikan paling cepat 7 hari.
- Contoh bentuk (angkanya diisi pemilik saat menyiapkan tayang, **tidak
  ditanyakan**): selisih kasir satu hari ≤ batas → per hari; jumlah selisih
  satu periode ≤ batas → per periode; izin + sakit = 0 selama 3 periode
  berturut-turut; hari telat = 0 dalam satu periode.

#### Hari yang dinilai dan siapa berhak (KIN-11, 16; BT2)

- **Per hari (BT2):** yang dinilai hanya **hari yang punya data ukuran itu
  bagi orang itu** (untuk selisih kasir: hari ia menutup shift; untuk
  telat: hari ia hadir). Hari tanpa data tidak dihitung gagal dan tidak
  dihitung terpenuhi. Penerima dibaca dari **jabatan dan cabang hari itu**
  (GAJ-28).
- **Per periode:** hanya untuk periode yang dijalani **penuh**; penerima
  dibaca dari tempat paling lama bekerja (KIN-11).
- **Berturut-turut (BT1):** dihitung per periode penuh yang memenuhi syarat,
  tidak putus karena pindah selama di tempat barunya berlaku **aturan yang
  sama** (aturan yang sasarannya mencakup tempat baru). Periode tidak penuh
  memutus hitungan. **Sesudah bonus diberikan, hitungan mulai dari nol**:
  aturan "3 periode berturut-turut" memberi bonus di periode ke-3, ke-6,
  ke-9, dan seterusnya, bukan tiap periode sesudah ke-3.
- Jabatan GM tidak menerima bonus; jabatan Pemilik tidak menerima Bonus
  Terukur. Pintu tulis Gaji menolaknya (GAJ-83); layar aturan tidak
  menawarkan jabatan itu sebagai penerima.

#### Mesin penilai (KIN-16)

- **Tiap malam:** menilai periode berjalan sebagai **perkiraan** dan
  menampilkannya di Kinerja Saya ("Sejauh ini 18 dari 20 hari terpenuhi:
  perkiraan Rp180.000").
- **Saat rapor ditetapkan** (KIN-09): menilai periode itu dengan data saat
  itu, menyimpan hasil per orang per aturan (terpenuhi atau tidak, angka
  bukti, rincian hari), lalu memanggil **pintu tulis Buku Bonus** milik Gaji
  satu kali per aturan per orang (jenis Bonus Terukur, dasar hitungan =
  banyak hari atau pencapaian, asal = hasil penilaian). Bonus per hari
  dijumlahkan menjadi satu baris dengan rincian hari. Nominal dihitung pintu
  tulis dari aturan yang berlaku pada tanggal kejadian (WAJ-04).
- Kunci **aturan + orang + periode** mencegah dobel.
- Pengesahan di **GAJ-L20 tab Bonus Terukur** per aturan per periode (B5);
  sumber Dana Disiplin yang kurang menolak pengesahan (GAJ-34).

#### Koreksi (KIN-10; BT3)

- Penilaian memakai data **saat rapor ditetapkan**. Perubahan sesudahnya
  hanya lewat catatan koreksi rapor (KIN-L05), yang menilai ulang aturan
  terkait.
- **BT3:** hasil berubah menjadi **terpenuhi** → baris bonus susulan ke Buku
  Bonus (slip berikutnya, keterangan periode asal). Berubah menjadi **tidak
  terpenuhi** sesudah bonusnya disahkan → Gaji membatalkan baris itu bila
  slip belum ditutup, atau memotongnya sebagai **koreksi bonus** di slip
  berikutnya bila sudah (GAJ-90); bila belum disahkan, barisnya ditolak
  dengan alasan koreksi.

#### KIN-L10. Aturan Bonus Terukur

- Daftar aturan: nama, ukuran dan syarat dalam kalimat ("selisih kasir satu
  hari tidak lebih dari Rp0 → Rp10.000 per hari"), rentang, penerima, sumber
  dana, berlaku dari, status (Terjadwal, Berlaku, Dihentikan), jumlah
  penerima bulan lalu. Tombol (Pemilik, GM): **Baru**, **Ubah**,
  **Hentikan**. HR melihat tanpa tombol.

#### KIN-L11. Aturan Bonus Baru atau Ubah (5 langkah)

1. Nama, ukuran, angka mentah.
2. Syarat dan rentang (untuk berturut-turut: N).
3. Nominal, penerima (jabatan, cabang), sumber dana.
4. Berlaku dari dan pengumuman (jarak dihitung server; draf Papan).
5. Periksa: kalimat aturan dan **perkiraan biaya** ("bila berlaku periode
   lalu, 6 orang memenuhi: Rp600.000"). Ditahan 3 detik.

#### KIN-L12. Hasil Penilaian Bonus Terukur

- Per periode per aturan: orang, terpenuhi atau tidak, angka bukti, rincian
  hari, tahap (perkiraan, terkirim ke Persetujuan, disahkan, dibayar),
  koreksi. Tautan ke GAJ-L20.

### 3.3 Bagian 4I-3: Penjualan Promo

**Disetujui penuh 14 Oktober 2026** (PM1 s.d. PM3 "ok", sesuai saran; bagian 13; aturan
KIN-65 s.d. 71 di bagian 3.12 `../../aturan/07-kinerja-rekrutmen.md`).

**Pokoknya:** kantor memilih produk promo dari daftar produk kasir, memberi
target per cabang dan dua tarif per pcs (tercapai atau belum). Karyawan
melaporkan penjualannya dengan foto struk. HR atau pemilik memeriksa. Di
akhir periode, tercapai atau tidaknya target menentukan tarif, dan bonus
masuk Buku Bonus.

Pelajaran sistem lama: nama produk diketik; target dan tarif diubah di
tengah jalan; struk bulan lalu masuk produk bulan ini; struk sama dilaporkan
dua kali; 18 laporan menunggu tanpa pengingat; karyawan tidak melihat
laporannya.

#### Produk promo (KIN-19, 20)

- **Isian:** produk (dari `kasir_produk`, tidak diketik), cabang (satu atau
  beberapa), periode gaji, target pcs **per cabang**, jabatan yang boleh
  melapor (pilihan; kosong = semua karyawan toko), **dua tarif per pcs**
  (target tercapai, belum tercapai).
- **HR** membuat produk, cabang, target, dan jabatan; **Pemilik atau GM**
  mengisi tarif (KIN-48). Produk tanpa tarif berstatus **Menunggu tarif** dan
  belum bisa dilapori.
- Perubahan target atau tarif yang sudah berjalan **berlaku periode
  berikutnya** (KIN-19); produk tidak dihapus, hanya dinonaktifkan mulai
  periode berikutnya. Tarif diumumkan lewat Papan (PRI-35).
- Cara "persen dari harga" tidak ada; grooming lewat jalurnya sendiri
  (GAJ-61).

#### Melapor (KIN-21, 22, 23; PM1, PM2)

- Isian: produk, jumlah pcs, tanggal struk, nomor struk, foto struk
  (kamera atau galeri; struk boleh difoto belakangan).
- **Produk yang bisa dipilih** = produk yang berlaku **pada tanggal struk**
  di **cabang tempat pelapor bekerja pada tanggal itu** (dibaca dari
  penempatan dan absen hari itu; GAJ-28). Jabatan pelapor pada tanggal itu
  harus termasuk jabatan yang boleh melapor.
- **Batas lapor:** 3 hari kalender sejak tanggal struk, sampai 23.59 hari
  ke-3. Lewat itu laporan tetap diterima, bertanda **telat**, dan bonusnya
  dipotong 50% (pengaturan bertanggal). **Paling lambat (PM1):** sampai
  akhir **periode berikutnya** sesudah periode tanggal struk; lewat itu
  laporan ditolak dengan kalimat "Struk 20 September sudah terlalu lama
  (paling lambat 25 Oktober)."
- **Penjaga dobel:** nomor struk yang sama untuk produk yang sama ditolak,
  siapa pun pelapornya (KIN-23).
- **Dicocokkan dengan kasir (PM2):** setelah sambungan transaksi kasir
  hidup, server mencari struk itu di `kasir_transaksi`: struk tidak ada,
  produk tidak ada di struk, atau jumlah pcs yang dilaporkan (semua pelapor)
  melebihi jumlah di struk → laporan **bertanda** untuk pemeriksa. Tidak
  ditolak otomatis, karena data kasir bisa terlambat masuk.

#### Pemeriksaan (KIN-24, 25)

- Di **GAJ-L20 tab Promo**, kartu per laporan (KIN-L18): **Setujui**,
  **Koreksi jumlah** (jejak; klaim awal tetap tersimpan), **Tolak** (alasan
  wajib). Pemeriksa: HR, Pemilik, GM; tidak untuk laporannya sendiri
  (KIN-49).
- Menunggu lebih dari 3 hari kerja (hari kerja pemeriksa, PRI-17) ditandai
  untuk HR dan pemilik.
- Karyawan melihat daftar laporannya, statusnya, dan alasan penolakan; boleh
  **membatalkan** laporan yang belum diperiksa, lalu melapor ulang.
- Keputusan yang sudah masuk slip tertutup tidak dibuka lagi; koreksinya
  baris baru (GAJ-50).
- **Finance tidak melihat laporan promo per orang** (KIN-25).

#### Tercapai atau belum dan bonus (KIN-20, 26; PM3)

- **Tercapai** dihitung per cabang per produk: jumlah pcs **disetujui** yang
  tanggal struknya di periode itu, dari semua pelapor di cabang itu,
  dibanding target cabang.
- **Kapan dipastikan (PM3):** saat **rapor periode itu ditetapkan** (sudah
  lewat batas lapor 3 hari dan laporan sudah diperiksa), sama dengan Bonus
  Terukur. Saat itu mesin memanggil pintu tulis Buku Bonus satu kali per
  laporan disetujui: jenis Promo, dasar = pcs × tarif tercapai atau belum,
  dikali 50% bila telat. Laporan yang disetujui sesudahnya memakai hasil
  tercapai yang sudah dipastikan dan langsung ditulis (slip berikutnya,
  keterangan periode asal). Laporan susulan tidak mengubah tercapai yang
  sudah dipastikan.
- Sebelum dipastikan, karyawan melihat bonus sebagai **perkiraan dengan dua
  kemungkinan tarif** dan kemajuan cabang ("Cabang Raja 140 dari 200 pcs").
- Baris bonus promo lahir sudah disahkan, karena laporannya sudah diperiksa
  satu per satu (cara disahkan "per laporan", spec Gaji 4E-4).

#### KIN-L13. Produk Promo

- Per periode: produk, cabang, target, tarif (atau "menunggu tarif"),
  terjual disetujui, capaian, status. Saring periode, cabang, status.
- Tombol: **Baru** (KIN-L14), **Isi tarif** (KIN-L15, Pemilik/GM),
  **Nonaktifkan mulai periode berikutnya**.
- Kepala cabang melihat cabangnya tanpa tombol.

#### KIN-L14. Produk Promo Baru atau Ubah (4 langkah)

1. Produk dari daftar produk kasir (cari nama atau kode).
2. Cabang dan target per cabang; jabatan yang boleh melapor.
3. Periode mulai (paling cepat periode berjalan bila baru; periode
   berikutnya bila mengubah).
4. Periksa; simpan. Status Menunggu tarif sampai Pemilik atau GM mengisi.

#### KIN-L15. Isi Tarif Promo (2 langkah)

1. Tarif tercapai dan tarif belum tercapai (rupiah per pcs), dan perkiraan
   biaya bila target tercapai.
2. Pengumuman (draf Papan) dan simpan, ditahan 3 detik.

#### KIN-L16. Lapor Penjualan Promo (3 langkah)

1. Tanggal struk (bawaan hari ini) lalu produk (hanya yang berlaku untuk
   tanggal itu di cabang saya).
2. Jumlah pcs, nomor struk, foto struk.
3. Periksa: kalimat ("2 pcs Royal Canin 2 kg, struk 1234 tanggal 14
   Oktober. Perkiraan bonus Rp10.000 bila target tercapai, Rp5.000 bila
   belum."). Bila telat: "Lewat 3 hari: bonus dipotong 50%." Kirim.

#### KIN-L17. Laporan Promo Saya

- Daftar laporan: tanggal struk, produk, jumlah (dan koreksinya), status,
  alasan tolak, tanda telat, perkiraan atau nominal bonus. Tombol
  **Batalkan** untuk yang belum diperiksa.

#### KIN-L18. Kartu Laporan Promo

- Isi kartu di GAJ-L20 tab Promo: pelapor, cabang, produk, jumlah, tanggal
  dan nomor struk, foto besar, tanda (telat, tidak cocok kasir, dan apa yang
  tidak cocok), laporan lain dengan struk yang sama. Tombol Setujui, Koreksi
  jumlah, Tolak; **Berikutnya**.

#### KIN-L19. Capaian Promo per Cabang

- Per cabang per produk: target, disetujui, menunggu, persen, tarif yang
  akan berlaku. Karyawan melihat cabangnya di Kinerja Saya.

### 3.4 Bagian 4I-4a: Tugas, membuat sampai melapor

**Disetujui penuh 14 Oktober 2026** (TG1 s.d. TG3 "ok", sesuai saran; bagian 13; aturan
KIN-72 s.d. 78 di bagian 3.13 `../../aturan/07-kinerja-rekrutmen.md`).

**Pokoknya:** satu mesin untuk semua tugas: rutin, sekali jalan, dan
tindak lanjut rapat. Tugas ditujukan ke jabatan per cabang, bukan nama
orang. Jatah lapor membaca hari kerja dari Kehadiran. Laporan hanya untuk
hari ini, dengan foto dari kamera saat itu.

Pelajaran sistem lama: dua mesin tugas; menghapus tugas menghapus
laporannya; kepala cabang tidak bisa membuat dan melihat tugas timnya;
orang pindah mendapat jatah sejak tugas dibuat; hari kerja dihitung sendiri;
foto dari galeri dan foto sesudah di hari lain tetap dihitung.

#### Master Judul dan tugas (KIN-27, 28, 29, 30, 31)

- **Master Judul:** judul, kebutuhan foto bawaan (tanpa, satu, sebelum dan
  sesudah), keterangan cara mengerjakan, berlaku dari, versi. Diisi HR,
  Pemilik, GM; kepala cabang memilih dari daftar (tidak mengetik judul
  bebas).
- **Tugas:** judul (dari Master), **jenis** (rutin harian, rutin mingguan
  Senin–Minggu, rutin per periode 26–25; sekali jalan bertenggat; tindak
  lanjut rapat = sekali jalan yang bertaut ke catatannya), kebutuhan foto,
  **mode** (individu, atau tim dengan satu PIC per cabang), sasaran, mulai,
  dihentikan mulai, **masuk rapor** (hanya HR, Pemilik, GM, KIN-31),
  pembuat.
- **Pembuat (KIN-30):** kepala cabang dan Kepala Gudang untuk **timnya
  sendiri** (cabang atau tim yang ia kepalai); HR, Pemilik, GM untuk semua.
- **Tidak dihapus:** tugas dihentikan "mulai tanggal"; periode sebelumnya
  tetap terhitung. Judul dan kebutuhan foto yang sudah punya laporan tidak
  diubah; perubahannya menjadi **versi baru** yang berlaku ke depan.

#### Sasaran dan jatah (KIN-32, 33; TG2)

- **Sasaran rutin:** jabatan per cabang. **Sekali jalan:** boleh orang
  tertentu. Server memperluas sasaran menjadi daftar orang **per hari**
  menurut penempatan hari itu (KAR-56): orang yang pindah terkena tugas
  barunya **mulai tanggal pindah**, dengan jatah dari tanggal itu; layar
  menjelaskannya apa adanya.
- **Jatah** membaca status hari dari Kehadiran (KEH-81): hari kerja = jatah;
  libur terjadwal, cuti, izin, sakit, dan hari tutup **bukan** jatah;
  **alpha tetap jatah** (KIN-33).
  - Harian: satu jatah per hari kerja.
  - **Mingguan dan per periode (TG2):** satu jatah bila orang itu punya
    **sedikitnya satu hari kerja** di minggu atau periode itu sejak terkena
    tugas. Minggu yang terpotong pergantian periode dihitung di periode
    tempat hari Minggunya jatuh.
  - Jatah dimulai sejak tugas berlaku dan sejak orang itu terkena tugas.
- **Satu fungsi jatah** (WAJ-04) dipakai Tugas Saya, Kemajuan Tim, dan
  rapor.

#### Melapor (KIN-34, 35, 36, 37)

- **Hanya untuk hari ini**, jam dari server; tidak ada lapor susulan. Lupa
  lapor = jatah itu tidak dikerjakan. Untuk mingguan dan per periode,
  laporan bisa dikirim di hari kerja mana pun dalam minggu atau periode itu.
- **Penjaga foto (ditolak mesin bila dilanggar):**
  - Foto **dari kamera saat itu**: layar lapor hanya membuka kamera aplikasi;
    tombol galeri tidak ada. Server menolak foto yang waktu ambilnya (dicap
    aplikasi saat memotret) lebih dari 2 menit sebelum dikirim.
  - Jumlah foto sesudah = jumlah foto sebelum.
  - Jarak minimal sebelum ke sesudah: 5 menit (pengaturan).
  - Foto sesudah harus di **hari yang sama**; kalau tidak, rangkaian
    **gugur** dan tercatat gugur.
- **Tidak ada laporan yang dihapus.** Foto sebelum yang dibatalkan tercatat
  "dibatalkan". Laporan selesai yang salah dibatalkan pelapornya **sebelum
  hari itu berakhir** (23.59), lalu boleh lapor ulang. Baris laporan tidak
  bisa diubah siapa pun.
- **Tugas tim:** PIC melapor untuk cabangnya; kalau PIC tidak masuk hari
  itu, **anggota tim yang hadir** boleh melapor, tercatat siapa yang
  melapor. Laporan tim berlaku untuk anggota yang hari itu hari kerjanya.

#### Tugas sekali jalan (KIN-38)

- Tenggat wajib. **Lapor progres** boleh beberapa kali; satu **laporan
  akhir**. Laporan akhir diperiksa **pembuat tugas, HR, Pemilik, atau GM**
  (tidak untuk laporannya sendiri): **Setuju** atau **Minta revisi** dengan
  catatan.
- **Terlambat** dihitung dari laporan akhir **pertama**, supaya revisi tidak
  menghapus catatan telat. Lewat tenggat tetap bisa dilaporkan, bertanda
  terlambat.
- Mengubah tenggat berjejak (lama, baru, oleh, alasan). Laporan akhir yang
  menunggu diperiksa lebih dari 3 hari kerja ditandai.
- Belum menjadi ukuran rapor di awal.

#### Pengingat (KIN-44; TG1)

- **TG1:** tugas harian yang belum dilaporkan memunculkan pengingat di
  aplikasi **2 jam sebelum jam pulang shift** orang itu hari itu (dibaca dari
  Kehadiran); tugas tim: ke PIC, atau ke anggota yang hadir bila PIC tidak
  masuk. Tugas mingguan dan per periode: pengingat di hari kerja terakhir
  orang itu dalam minggu atau periode tersebut. Tugas sekali jalan: H-1 dan
  hari tenggat.

#### Foto rangkaian yang tertinggal (TG3)

- **TG3:** rangkaian yang sudah punya foto sebelum tetapi belum punya foto
  sesudah tampil di Tugas Saya dengan hitung mundur sampai 23.59. Pukul
  21.00 diingatkan sekali. Pukul 23.59 rangkaian gugur otomatis dan pelapor
  diberi tahu esok paginya.

#### KIN-L20. Tugas Saya

- **HP.** Tab **Hari ini** (tugas harian, mingguan, dan periode yang masih
  terbuka; tanda selesai, menunggu foto sesudah, gugur), **Sekali jalan**
  (tenggat, progres, status pemeriksaan), **Riwayat** (laporan saya per
  periode, tanda janggal, tidak sah, gugur, dibatalkan beserta alasan),
  **Rak saya** (4I-4b).
- Kepala: kemajuan periode berjalan untuk tugas masuk rapor ("23 dari 25
  jatah").

#### KIN-L21. Lapor Tugas (2 atau 3 langkah)

1. **Foto sebelum** (kamera) bila diminta; tombol **Kirim foto sebelum**.
   Untuk "satu foto" dan "tanpa foto" langsung ke langkah 2.
2. **Foto sesudah** (kamera; jumlah sama) dan catatan pilihan; tombol aktif
   setelah jarak minimal lewat (hitung mundur tampil).
3. **Selesai**: pesan "Tugas Rapikan Gudang tercatat selesai 14 Oktober
   16.20." Tombol **Batalkan laporan ini** sampai 23.59.

#### KIN-L22. Tugas (daftar kantor)

- Daftar tugas: judul, jenis, mode, sasaran, mulai, berhenti, masuk rapor,
  pembuat, versi. Saring jenis, cabang, pembuat, status.
- Tombol: **Tugas baru** (KIN-L23), **Hentikan mulai tanggal**, **Versi
  baru**, **Tandai masuk rapor** (HR, Pemilik, GM).
- Kepala cabang dan Kepala Gudang melihat tugas timnya dan tugas dari
  kantor untuk timnya.

#### KIN-L23. Tugas Baru atau Ubah (5 langkah)

1. Judul dari Master (kebutuhan foto terisi bawaan).
2. Jenis (dan tenggat bila sekali jalan), mode (PIC per cabang bila tim).
3. Sasaran: jabatan per cabang (rutin) atau orang (sekali jalan); jumlah
   orang terkena hari ini tampil.
4. Mulai (paling cepat hari ini), masuk rapor (HR, Pemilik, GM).
5. Periksa: kalimat dan perkiraan jatah per orang per periode. Simpan.

#### KIN-L24. Master Judul

- Daftar judul: kebutuhan foto, keterangan, versi, aktif. Tombol (HR,
  Pemilik, GM): Baru, Versi baru, Nonaktifkan.

#### KIN-L25. Periksa Laporan Akhir

- Tugas, tenggat, progres, laporan akhir (foto, catatan, jam), riwayat
  revisi, tanda terlambat. Tombol **Setuju** atau **Minta revisi**
  (catatan wajib).

#### KIN-L26. Kemajuan Tim

- Per orang per tugas: jatah, dikerjakan, gugur, tidak sah, belum lapor hari
  ini; tab **Rak** dan **Kerapian Display** (4I-4b). Kepala cabang melihat
  timnya; HR, Pemilik, GM semua.

### 3.5 Bagian 4I-4b: Tugas, penjagaan dan hitungan

**Disetujui penuh 14 Oktober 2026** (TJ1 s.d. TJ3 "ok", sesuai saran; bagian 13; aturan
KIN-79 s.d. 84 di bagian 3.14 `../../aturan/07-kinerja-rekrutmen.md`).

**Pokoknya:** laporan tugas rutin dihitung mesin, tidak disetujui satu per
satu. Supaya tetap jujur, mesin menandai yang janggal untuk dilihat orang,
dan HR atau pemilik bisa menetapkan sebuah laporan tidak sah dengan alasan.
Rak toko didaftar dengan penanggung jawab dan jadwalnya, sehingga kerapian
display terukur per orang.

Pelajaran sistem lama: laporan dihitung tanpa dilihat siapa pun; tanda
tidak valid tanpa jejak; hitungan tidak disimpan dan angka periode lalu
berubah sendiri; satu laporan terhitung di dua kriteria; rak tidak didaftar
dan jatahnya dibagi rata menurut abjad.

#### Tanda janggal (KIN-39; TJ2)

Mesin menandai laporan saat diterima (tidak menggugurkannya):

| Tanda | Kapan menyala (TJ2) | Pengaturan |
|---|---|---|
| **Foto dipakai ulang** | Foto yang sama persis, atau sangat mirip (sidik gambar), dengan foto laporan di cabang yang sama dalam 30 hari terakhir | Lama pembanding 30 hari; tingkat kemiripan |
| **Di luar titik lokasi** | Dikirim di luar radius titik lokasi cabang (KEH-104) | Memakai radius cabang |
| **Di luar jam kerja** | Dikirim lebih dari 30 menit sebelum jam masuk atau sesudah jam pulang shift orang itu hari itu | 30 menit |

- Daftar tanda bisa ditambah lewat pembangunan; batasnya pengaturan
  (PRI-32). Mesin penanda masuk Kesehatan Mesin (PRI-33).
- Laporan bertanda **tetap dihitung** sampai HR atau pemilik memutuskan.
  Rapor yang punya laporan bertanda belum diputuskan dikeluarkan dari
  "Tetapkan semua yang siap" (4I-1).
- Keputusan atas tanda: **Biarkan sah** (catatan pilihan) atau **Tetapkan
  tidak sah** (di bawah).

#### Tidak sah (KIN-40)

- **Diusulkan** kepala cabang (timnya) dengan alasan; **ditetapkan** HR,
  Pemilik, atau GM (tidak untuk laporannya sendiri; laporan HR oleh Pemilik
  atau GM). HR, Pemilik, dan GM juga boleh menetapkan langsung.
- Wajib alasan dan berjejak; **pencabutan** juga beralasan dan berjejak.
- Karyawan diberi tahu dan melihat alasannya di Riwayat Tugas Saya.
- Sesudah rapor periode itu ditetapkan, tanda tidak bisa ditetapkan atau
  dicabut lagi; koreksinya lewat catatan koreksi rapor (KIN-10).
- Tanda ini memutus sah atau tidaknya satu bukti; ia bukan nilai yang
  diketik orang (KIN-03).

#### Hitungan dan ukuran (KIN-41, 42)

- **Dikerjakan** = jatah yang punya sedikitnya satu laporan **selesai** yang
  tidak gugur, tidak dibatalkan, dan tidak tidak sah.
- **Ukuran "tugas rutin dikerjakan"** = dikerjakan ÷ jatah, per orang per
  periode, dari tugas rutin bertanda masuk rapor. Laporan kerapian display
  tidak ikut di sini (satu laporan satu ukuran).
- Sebelum rapor ditetapkan semua hitungan tampil sebagai perkiraan; saat
  ditetapkan, **jatah, dikerjakan, tidak sah, gugur** disimpan dan tidak
  berubah lagi (KIN-41).

#### Daftar rak dan kerapian display (KIN-43; TJ1, TJ3)

- **Daftar rak** per cabang (KIN-L29): nama rak, foto rak (pilihan),
  **penanggung jawab** (orang), **jadwal**, berlaku dari; bertanggal
  berlaku, tidak dihapus. Diatur HR, Pemilik, GM; kepala cabang melihat.
- **Jadwal (TJ1):** dua pilihan: **tiap hari kerja**, atau **N kali per
  minggu** (1 sampai 6). Jatah per minggu untuk N kali = paling banyak N,
  tetapi **tidak lebih dari banyak hari kerja penanggung jawab** di minggu
  itu (orang yang libur 4 hari tidak dituntut 5 kali). Minggu Senin–Minggu;
  minggu yang terpotong pergantian periode mengikuti hari Minggunya.
- **Lapor rak (TJ3):** hanya **penanggung jawab rak itu** yang melapor,
  per rak, foto sebelum dan sesudah, dengan penjaga foto yang sama
  (KIN-35). Rak yang sama dilaporkan dua kali dalam satu jatah dihitung
  satu. Bila penanggung jawab tidak bekerja hari itu, hari itu bukan
  jatahnya; orang lain tidak melaporkan rak yang bukan tanggung jawabnya.
- **Ukuran kerapian display** = jatah rak yang dirapikan sesuai jadwal ÷
  seluruh jatah rak tanggung jawabnya, per orang per periode.
- **Rak tanpa penanggung jawab** (atau penanggung jawabnya pindah atau
  berhenti) ditandai untuk kepala cabang dan HR mulai hari itu.

#### KIN-L27. Laporan Bertanda

- Daftar laporan bertanda janggal dan usulan tidak sah: orang, tugas atau
  rak, tanggal, tanda dan buktinya (foto berdampingan untuk foto dipakai
  ulang; peta titik untuk luar lokasi; jam shift untuk luar jam kerja),
  status. Tombol: **Biarkan sah**, **Usulkan tidak sah** (kepala cabang),
  **Tetapkan tidak sah**, **Cabut** (HR, Pemilik, GM).

#### KIN-L28. Usulkan atau Tetapkan Tidak Sah (2 langkah)

1. Alasan wajib (15 huruf), bukti tambahan pilihan.
2. Periksa: akibatnya pada perkiraan rapor ("Dikerjakan Rina turun dari
   23 menjadi 22 dari 25"). Ditahan 3 detik untuk menetapkan.

#### KIN-L29. Daftar Rak

- Per cabang: rak, penanggung jawab, jadwal, berlaku dari, tanda tanpa
  penanggung jawab. Tombol (HR, Pemilik, GM): **Rak baru**, **Ganti
  penanggung jawab**, **Ubah jadwal** (berlaku mulai tanggal), **Nonaktifkan
  mulai**.

#### KIN-L30. Lapor Rak

- **HP.** Daftar "Rak saya" dengan jatah minggu ini (misalnya "Rak Makanan
  Kucing: 2 dari 3 minggu ini"); tiap rak membuka langkah KIN-L21.

#### KIN-L31. Kerapian Display

- Per cabang per rak: penanggung jawab, jatah, dirapikan, persen periode
  berjalan, laporan terakhir. Kepala cabang melihat cabangnya.

### 3.6 Bagian 4I-5: Catatan Rapat, hak akses, mesin, pengaturan

**Disetujui penuh 14 Oktober 2026** (CR1 s.d. CR2 "ok", sesuai saran; bagian 13; aturan
KIN-85 s.d. 88 di bagian 3.15 `../../aturan/07-kinerja-rekrutmen.md`).

**Pokoknya:** Catatan Rapat adalah arsip ringkas hasil rapat dan tugas
tindak lanjutnya. Aturan dan SOP tidak ditulis di sini, tetapi di Papan
Perubahan Aturan.

#### Catatan Rapat (KIN-45, 46, 47; CR1, CR2)

- **Isian:** judul, tanggal rapat, isi (teks), **lampiran (CR2)**: foto atau
  PDF paling banyak 5 (misalnya foto papan tulis), sasaran (orang, jabatan,
  cabang, atau "khusus HR dan pemilik"), tugas tindak lanjut (tugas sekali
  jalan bertaut, KIN-28).
- **Dua tahap:** **draf** (hanya pembuat dan HR, Pemilik, GM melihat) dan
  **terbit** (sasaran diberi tahu). Dibuat HR, Pemilik, GM. Disimpan dalam
  satu langkah di server bersama tugasnya.
- **Perubahan sesudah terbit (CR1):** berjejak; versi lama bisa dilihat.
  Sasaran **diberi tahu** dengan tanda "diubah" dan ringkasan bagian yang
  berubah, supaya tidak ada yang bekerja dengan isi lama.
- **Tarik:** catatan hanya ditarik dengan alasan, tidak dihapus; menarik
  tidak menghapus tugas dan laporannya (tugas tetap berjalan sampai
  dihentikan sendiri).
- **Aturan dan SOP:** saat menulis, layar punya tombol **"Ini aturan baru?
  Tulis di Papan Perubahan Aturan"** yang membuka BER-L23 dengan judul
  terisi; Catatan Rapat cukup menautnya. Tidak ada jenis "Aturan/SOP" dan
  tombol "Sudah Saya Baca" di Catatan Rapat (KIN-46).
- Yang melihat hanya sasarannya dan yang berhak menurut daftar hak.

#### Pemeriksaan akhir hak akses seluruh 4I (KIN-48, 49)

| Jabatan | Di Kinerja |
|---|---|
| Pemilik dan GM | Semua. Khusus mereka (menyangkut uang, batas keras): aturan Bonus Terukur, tarif promo, potongan telat lapor, sumber dana |
| HR | Kriteria dan bobot, target omzet, produk dan target promo (tanpa tarif), Master Judul, tugas, tanda masuk rapor, daftar rak, Catatan Rapat; menetapkan rapor dan catatan koreksi; memeriksa laporan promo (tab Promo GAJ-L20); menetapkan dan mencabut tidak sah; memeriksa laporan akhir; melihat rapor dan kemajuan tugas semua orang. Tidak menetapkan, memeriksa, atau memutuskan yang menyangkut dirinya |
| Kepala cabang, Kepala Gudang | Melihat rapor, kemajuan tugas, rak, dan capaian promo timnya (tidak menilai); membuat tugas untuk timnya dan memeriksa laporan akhir tugas buatannya; mengusulkan tidak sah |
| Finance | **Tidak punya menu Kinerja**; total bonus per periode dilihat di uraian slip (GAJ-46) |
| Semua karyawan | Kinerja Saya; melapor tugas, rak, dan penjualan promo; riwayat laporannya; Catatan Rapat yang ditujukan kepadanya |

**Tes mesin pengaman wajib** (KIN bagian 7 butir 12): finance tidak bisa
membuka menu Kinerja; kepala cabang tidak bisa menetapkan rapor atau tanda
tidak sah; HR tidak bisa mengubah aturan bonus dan tarif promo; tidak ada
yang memeriksa laporannya sendiri, menetapkan rapornya sendiri, atau
memutuskan tanda tidak sah untuk laporannya sendiri.

#### KIN-L32. Catatan Rapat

- **PC** (kantor): daftar catatan: judul, tanggal rapat, sasaran, tahap,
  versi, jumlah tugas tindak lanjut dan kemajuannya. **HP** (sasaran):
  catatan yang ditujukan kepada saya, tanda baru dan diubah.
- Tombol (HR, Pemilik, GM): **Tulis catatan** (KIN-L33).

#### KIN-L33. Tulis Catatan Rapat (3 langkah)

1. Judul, tanggal rapat, isi, lampiran; tombol "Ini aturan baru?".
2. Sasaran.
3. Tugas tindak lanjut (tambah baris: judul dari Master, orang, tenggat),
   lalu **Simpan draf** atau **Terbitkan** (ditahan 3 detik saat terbit).

#### KIN-L34. Rincian Catatan Rapat

- Isi, lampiran, sasaran, tugas tindak lanjut dan statusnya, riwayat versi,
  tautan ke Papan bila ada. Tombol (HR, Pemilik, GM): **Ubah** (versi
  baru), **Tarik** (KIN-L35).

#### KIN-L35. Tarik Catatan Rapat (2 langkah)

1. Alasan wajib; daftar tugas tindak lanjut yang tetap berjalan (dengan
   tombol menghentikannya satu per satu bila perlu).
2. Tarik, ditahan 3 detik. Sasaran diberi tahu.

---

## 4. Data

Semua tabel punya kolom perusahaan (PRI-31), jejak dibuat dan diubah, tidak
ada yang dihapus (PRI-02), dan indeks pada kolom pencarian (PRI-14). Orang,
jabatan, cabang milik Karyawan; status hari milik Kehadiran; selisih kasir
milik Keuangan; Buku Bonus milik Gaji; produk dan transaksi milik kasir.

**4I-1**

| Tabel | Isi penting | Dicari dengan | Dibaca modul lain | Bagian |
|---|---|---|---|---|
| ukuran | kode (dipakai mesin), nama, rumus dalam kalimat, angka mentah yang tersedia, sumber, menyala (ya, menunggu sambungan kasir). Diisi lewat migrasi | kode | — | 4I-1 |
| kelompok_kriteria | jabatan, cabang (atau semua), berlaku dari, status (Terjadwal, Berlaku, Nonaktif), pengumuman (nomor Papan), oleh | jabatan + cabang + berlaku dari | — | 4I-1 |
| kriteria | kelompok, ukuran, bobot. Jumlah bobot satu kelompok = 100 (dijaga server) | kelompok | — | 4I-1 |
| target_omzet | cabang, periode, target, berlaku dari, oleh | cabang + periode | — | 4I-1 |
| rapor | orang, periode, versi, tahap (Perkiraan, Ditetapkan, Dikoreksi), kelompok kriteria dipakai + sebab (tempat paling lama), periode penuh (ya, tidak), nilai keseluruhan, penetap, kapan, catatan koreksi (untuk versi koreksi). **Kunci: orang + periode + versi**; satu versi Berlaku | orang + periode; periode + tahap | Gaji (tahap ditetapkan sebagai pemicu bonus) | 4I-1 |
| rincian_rapor | rapor (versi), kriteria, bobot (sesudah dibagi ulang), persen, angka mentah (salinan), belum ada data (ya, tidak) | rapor | — | 4I-1 |
| koreksi_rapor | rapor, sebab, alasan, oleh, kapan, versi lama, versi baru | rapor | — | 4I-1 |

Perkiraan tidak disimpan sebagai rapor; ia dihitung fungsi tiap kali
dibaca (boleh diringkas mesin malam hari untuk kecepatan). Yang disimpan
hanya rapor Ditetapkan dan koreksinya.

**4I-2**

| Tabel | Isi penting | Dicari dengan | Dibaca modul lain | Bagian |
|---|---|---|---|---|
| aturan_bonus | nama, ukuran, angka mentah, pembanding, batas, rentang (per hari, per periode, berturut-turut + N), nominal (salinan untuk tampilan; nominal resmi dihitung pintu tulis Gaji dari pengaturan jenis Bonus Terukur bersasaran aturan), penerima (jabatan, cabang), sumber dana, berlaku dari, berhenti mulai, status, pengumuman | status; ukuran | Gaji (jenis bonus Bonus Terukur bersasaran aturan) | 4I-2 |
| hasil_bonus_terukur | aturan, orang, periode, rapor versi, terpenuhi (ya, tidak), angka bukti, rincian hari (tanggal, angka, terpenuhi), hitungan berturut-turut, baris Buku Bonus, status (Terkirim, Dikoreksi), koreksi atas hasil nomor. **Kunci: aturan + orang + periode** untuk yang tidak Dikoreksi | orang + periode; aturan + periode | Gaji (GAJ-L20 tab Bonus Terukur: angka bukti) | 4I-2 |

**4I-3**

| Tabel | Isi penting | Dicari dengan | Dibaca modul lain | Bagian |
|---|---|---|---|---|
| produk_promo | produk (kode kasir), periode mulai, periode berhenti, jabatan boleh melapor, tarif tercapai, tarif belum, tarif diisi oleh, status (Menunggu tarif, Berlaku, Nonaktif), pengumuman | status; produk | Gaji (jenis Promo) | 4I-3 |
| target_promo | produk promo, cabang, periode, target pcs | produk + cabang + periode | — | 4I-3 |
| laporan_promo | pelapor, cabang (dibaca dari tanggal struk), produk promo, jumlah dilaporkan, jumlah disetujui, tanggal struk, nomor struk, foto, jam kirim (server), telat (ya, tidak), tanda tidak cocok kasir + rincian, status (Menunggu, Disetujui, Ditolak, Dibatalkan), pemeriksa, alasan, koreksi jumlah (jejak), baris Buku Bonus. **Kunci: nomor struk + produk** untuk yang tidak Ditolak atau Dibatalkan | pelapor + status; produk + cabang + periode; nomor struk | Gaji (tab Promo), Kinerja (ukuran promo) | 4I-3 |
| capaian_promo | produk promo, cabang, periode, pcs disetujui saat dipastikan, target, tercapai (ya, tidak), dipastikan kapan (saat rapor ditetapkan). Tidak berubah sesudah dipastikan | produk + cabang + periode | — | 4I-3 |

**4I-4a**

| Tabel | Isi penting | Dicari dengan | Dibaca modul lain | Bagian |
|---|---|---|---|---|
| master_judul | judul, kebutuhan foto bawaan, keterangan, versi, berlaku dari, aktif | judul | — | 4I-4a |
| tugas | judul (versi master), jenis, tenggat (sekali jalan), kebutuhan foto, mode (individu, tim), PIC per cabang (tim), sasaran (jabatan + cabang, atau orang), catatan rapat (tindak lanjut), mulai, dihentikan mulai, masuk rapor + oleh, pembuat, versi | jenis + status; sasaran | Catatan Rapat | 4I-4a |
| laporan_tugas | tugas (versi), orang, pelapor (beda bila tim), tanggal (server), jatah (hari, minggu, periode), foto sebelum + jam, foto sesudah + jam, catatan, jenis laporan (selesai, progres, akhir), status (Menunggu foto sesudah, Selesai, Gugur, Dibatalkan), tanda janggal, tidak sah (4I-4b), pemeriksaan laporan akhir (Setuju, Minta revisi + catatan + oleh), terlambat (sekali jalan) | orang + tanggal; tugas + tanggal | — | 4I-4a |
| ubah_tenggat | tugas, lama, baru, oleh, kapan, alasan | tugas | — | 4I-4a |

Jatah tidak disimpan sampai rapor ditetapkan; ia dihitung fungsi jatah dari
status hari Kehadiran (WAJ-03, 04).

**4I-4b**

| Tabel | Isi penting | Dicari dengan | Dibaca modul lain | Bagian |
|---|---|---|---|---|
| tanda_laporan | laporan (tugas atau rak), jenis (foto dipakai ulang + laporan pembanding, luar lokasi + jarak, luar jam + selisih menit), keputusan (Biarkan sah, Tidak sah), oleh, kapan, catatan | laporan; status | — | 4I-4b |
| tidak_sah | laporan, diusulkan oleh + alasan, ditetapkan oleh + alasan, kapan, dicabut oleh + alasan + kapan, status (Diusulkan, Berlaku, Dicabut, Ditolak) | laporan; status | — | 4I-4b |
| hitungan_tugas | rapor (versi), tugas, orang, periode, jatah, dikerjakan, tidak sah, gugur (salinan saat ditetapkan) | rapor | — | 4I-4b |
| rak | cabang, nama, foto, penanggung jawab, jadwal (tiap hari kerja, N kali seminggu), berlaku dari, versi, aktif | cabang | — | 4I-4b |
| laporan_rak | rak (versi), orang, tanggal, minggu, foto sebelum dan sesudah + jam, status (seperti laporan_tugas), tanda, tidak sah | rak + minggu; orang + tanggal | — | 4I-4b |
| hitungan_rak | rapor (versi), rak, orang, periode, jatah, dirapikan (salinan) | rapor | — | 4I-4b |

**4I-5**

| Tabel | Isi penting | Dicari dengan | Dibaca modul lain | Bagian |
|---|---|---|---|---|
| catatan_rapat | judul, tanggal rapat, isi, lampiran (0 s.d. 5), sasaran (orang, jabatan, cabang, khusus HR dan pemilik), tahap (Draf, Terbit, Ditarik), versi, pembuat, terbit kapan, ditarik oleh + alasan, pengumuman Papan yang ditaut | tahap; tanggal rapat | — | 4I-5 |
| versi_catatan_rapat | catatan, nomor versi, salinan isi dan sasaran, oleh, kapan, ringkasan perubahan | catatan | — | 4I-5 |

---

## 5. Tindakan bernama dan isi awal hak

Pemilik dan GM punya semua tindakan (KAR-67), kecuali yang menyangkut
dirinya sendiri (KIN-49). Finance tidak punya tindakan di Kinerja.

| Tindakan | HR | Kepala cabang / Kepala Gudang | Karyawan | Bagian |
|---|---|---|---|---|
| lihat Kinerja Saya | dirinya | dirinya | dirinya | 4I-1 (KIN-12) |
| lihat rapor orang lain | semua | timnya | — | 4I-1 (KIN-48) |
| tetapkan rapor; catatan koreksi | ya, bukan miliknya | — | — | 4I-1 (KIN-09, 49) |
| ubah kriteria, bobot, target omzet | ya | — | — | 4I-1 |
| buat dan ubah aturan Bonus Terukur | — | — | — | 4I-2 (batas keras) |
| lihat aturan dan hasil Bonus Terukur | ya | — | miliknya (Kinerja Saya) | 4I-2 |
| buat produk promo dan target | ya | — | — | 4I-3 |
| isi tarif promo; ubah potongan telat lapor | — | — | — | 4I-3 (batas keras) |
| lapor penjualan promo; batalkan laporannya sebelum diperiksa | dirinya bila boleh | dirinya bila boleh | ya | 4I-3 |
| periksa laporan promo (tab Promo) | ya, bukan miliknya | — | — | 4I-3 (KIN-25) |
| lihat capaian promo | semua | cabangnya | cabangnya | 4I-3 |
| ubah Master Judul | ya | — | — | 4I-4a |
| buat dan hentikan tugas | semua | timnya | — | 4I-4a (KIN-30) |
| tandai tugas masuk rapor | ya | — | — | 4I-4a (KIN-31) |
| lapor tugas dan rak; batalkan laporannya hari itu | dirinya | dirinya | ya | 4I-4a, 4I-4b |
| periksa laporan akhir tugas sekali jalan | ya | tugas buatannya | — | 4I-4a (KIN-38) |
| ubah tenggat | ya | tugas buatannya | — | 4I-4a |
| lihat kemajuan tugas dan rak | semua | timnya | dirinya | 4I-4a, 4I-4b |
| biarkan sah laporan bertanda | ya | — | — | 4I-4b |
| usulkan tidak sah | ya | timnya | — | 4I-4b (KIN-40) |
| tetapkan dan cabut tidak sah | ya, bukan miliknya | — | — | 4I-4b (KIN-40, 49) |
| ubah daftar rak | ya | — | — | 4I-4b |
| tulis, ubah, terbitkan, tarik Catatan Rapat | ya | — | — | 4I-5 (KIN-45) |
| baca Catatan Rapat | semua | yang ditujukan | yang ditujukan | 4I-5 |

"Batas keras" berarti tidak bisa diberikan ke jabatan lain lewat Hak Akses
Jabatan (KAR-58).

---

## 6. Mesin otomatis

Semua punya penjaga (PRI-33): tiap jalan tercatat; gagal atau tidak jalan
muncul di "perlu perhatian" GM; terlewat dikejar tanpa dobel.

| Mesin | Jadwal | Kerjanya | Bagian |
|---|---|---|---|
| Penghitung perkiraan rapor | Tiap malam 01.00 | Menghitung perkiraan rapor periode berjalan dan periode yang belum ditetapkan untuk ringkasan cepat; tidak menyimpan rapor | 4I-1 |
| Penanda rapor belum ditetapkan | Tiap hari 07.00 mulai masa keberatan slip | Rapor periode lalu yang belum ditetapkan: perlu perhatian HR, Pemilik, GM | 4I-1 |
| Penetap (langkah) | Bagian langkah Tetapkan | Menyimpan rincian rapor, hitungan tugas dan rak, lalu menjalankan Penilai Bonus Terukur dan Pemasti promo untuk orang dan periode itu dalam satu langkah utuh | 4I-1 |
| Penilai Bonus Terukur (perkiraan) | Tiap malam 01.30 | Menilai aturan untuk periode berjalan sebagai perkiraan di Kinerja Saya | 4I-2 |
| Penilai Bonus Terukur (resmi) | Saat rapor ditetapkan atau dikoreksi | Menyimpan hasil dan memanggil pintu tulis Buku Bonus (kunci aturan + orang + periode) | 4I-2 |
| Pemasti promo | Saat rapor periode ditetapkan (pertama kali per cabang) | Memastikan tercapai per cabang per produk; memanggil pintu tulis Buku Bonus untuk laporan disetujui; sesudahnya menulis laporan yang disetujui belakangan | 4I-3 |
| Pencocok promo dengan kasir | Saat transaksi kasir tertarik (4C) | Menandai laporan yang struk, produk, atau jumlahnya tidak cocok | 4I-3 |
| Penanda promo menunggu | Tiap hari 07.00 | Laporan menunggu lebih dari 3 hari kerja: tanda untuk HR dan pemilik | 4I-3 |
| Penanda janggal | Saat laporan tugas atau rak diterima | Memeriksa foto dipakai ulang, luar lokasi, luar jam kerja; menulis tanda | 4I-4b |
| Penggugur rangkaian | Tiap hari 23.59 | Rangkaian yang belum punya foto sesudah menjadi Gugur; pemberitahuan esok pagi | 4I-4a |
| Pengingat tugas | Tiap 15 menit | Tugas harian belum dilapor 2 jam sebelum jam pulang shift; foto sesudah tertinggal pukul 21.00; mingguan dan periode di hari kerja terakhir; sekali jalan H-1 dan hari tenggat | 4I-4a |
| Penanda laporan akhir menunggu | Tiap hari 07.00 | Laporan akhir sekali jalan menunggu lebih dari 3 hari kerja | 4I-4a |
| Penanda rak tanpa penanggung jawab | Tiap hari 06.00 dan saat penempatan berubah | Rak yang penanggung jawabnya pindah, berhenti, atau kosong | 4I-4b |
| Pengirim pemberitahuan Catatan Rapat | Saat terbit dan diubah | Memberi tahu sasaran | 4I-5 |

---

## 7. Pemberitahuan (titipan 4J)

| Pemberitahuan | Kepada | Antrean, Beranda, atau layar | Alasan |
|---|---|---|---|
| Kriteria rapor atau target berubah mulai periode … | Karyawan jabatan dan cabang itu | Pengumuman (Papan) | KIN-51 |
| Rapor Anda ditetapkan / dikoreksi | Orangnya | Pemberitahuan | KIN-09, 10 |
| Rapor periode lalu belum ditetapkan | HR, Pemilik, GM | Perlu perhatian | KIN-09 |
| Aturan Bonus Terukur baru, naik, turun, dihentikan | Penerima aturan itu | Pengumuman (Papan; 1 atau 7 hari) | PRI-35 |
| Bonus Terukur Anda terkirim ke persetujuan | Orangnya | Pemberitahuan | KIN-16 |
| Produk promo baru atau tarif berubah | Karyawan cabang dan jabatan itu | Pengumuman (Papan) | KIN-19 |
| Laporan promo Anda disetujui, dikoreksi, ditolak | Pelapor | Pemberitahuan | KIN-24 |
| Laporan promo menunggu lebih dari 3 hari kerja | HR, Pemilik | Perlu perhatian | KIN-25 |
| Target promo cabang tercapai | Karyawan cabang itu | Pemberitahuan | KIN-20 |
| Tugas baru untuk Anda | Sasaran | Pemberitahuan | KIN-44 |
| Tugas belum dilapor; foto sesudah tertinggal | Orangnya (PIC atau anggota hadir) | Pemberitahuan | TG1, TG3 |
| Rangkaian Anda gugur | Orangnya | Pemberitahuan pagi | KIN-35 |
| Laporan akhir menunggu diperiksa; minta revisi; disetujui | Pemeriksa; pelapor | Antrean; Pemberitahuan | KIN-38 |
| Laporan bertanda janggal | Kepala cabang (timnya), HR | Beranda | KIN-39 |
| Laporan Anda ditetapkan tidak sah / dicabut | Orangnya | Pemberitahuan (dengan alasan) | KIN-40 |
| Usulan tidak sah menunggu | HR, Pemilik, GM | Antrean | KIN-40 |
| Rak tanpa penanggung jawab | Kepala cabang, HR | Perlu perhatian | KIN-43 |
| Catatan Rapat terbit / diubah / ditarik | Sasaran | Pemberitahuan | KIN-45, 47, CR1 |

---

## 8. Pengaturan (titipan 4J)

| Pengaturan | Angka awal | Wajib diumumkan | Boleh dikecualikan per orang (PRI-26) | Bagian |
|---|---|---|---|---|
| Daftar ukuran (tabel sendiri, lewat pembangunan) | tujuh ukuran KIN-04 | — | tidak | 4I-1 |
| Kelompok kriteria dan bobot | diisi saat menyiapkan tayang | ya | tidak | 4I-1 |
| Target omzet cabang | diisi saat menyiapkan tayang | ya | tidak | 4I-1 |
| Jam tombol Tetapkan rapor aktif | tanggal 29 pukul 00.00 (RP4) | tidak | tidak | 4I-1 |
| Aturan Bonus Terukur (tabel sendiri) | diisi pemilik | ya (1 atau 7 hari) | tidak | 4I-2 |
| Produk promo, target, tarif | diisi per periode | ya | tidak | 4I-3 |
| Batas lapor promo | 3 hari kalender sejak tanggal struk | ya | tidak | 4I-3 |
| Potongan bonus promo telat | 50% | ya | tidak | 4I-3 |
| Batas paling lambat lapor promo | akhir periode berikutnya (PM1) | ya | tidak | 4I-3 |
| Tanda laporan promo menunggu | 3 hari kerja | tidak | tidak | 4I-3 |
| Jarak minimal foto sebelum ke sesudah | 5 menit | tidak | tidak | 4I-4a |
| Batas umur foto dari kamera | 2 menit | tidak | tidak | 4I-4a |
| Pengingat tugas harian | 2 jam sebelum jam pulang (TG1) | tidak | tidak | 4I-4a |
| Pengingat foto sesudah tertinggal | 21.00 (TG3) | tidak | tidak | 4I-4a |
| Tanda laporan akhir menunggu | 3 hari kerja | tidak | tidak | 4I-4a |
| Tanda janggal: lama pembanding foto, kemiripan, menit luar jam kerja | 30 hari; tingkat mirip; 30 menit (TJ2) | tidak | tidak | 4I-4b |
| Daftar rak, penanggung jawab, jadwal | diisi saat menyiapkan tayang | ya (karyawan cabang) | tidak | 4I-4b |
| Tugas masuk rapor | diisi saat menyiapkan tayang | ya | tidak | 4I-4a |
| Lampiran Catatan Rapat | paling banyak 5 (CR2) | tidak | tidak | 4I-5 |

---

## 9. Jenis pengajuan (titipan 4J)

**4I tidak menambah jenis pengajuan.** Laporan promo diperiksa di tab
Promo GAJ-L20 (bukan Mesin Pengajuan; daftar kerja HR dan pemilik), usulan
tidak sah diputuskan di KIN-L27, dan laporan akhir tugas diperiksa di
KIN-L25. Keberatan atas rapor tidak ada: yang salah dibetulkan di sumbernya
(klarifikasi absen, keberatan kasir) sebelum rapor ditetapkan, atau lewat
catatan koreksi sesudahnya (KIN-10, 12).

---

## 10. Kejadian di lapangan

| No | Kejadian | Sistem berbuat apa | Aturan |
|---|---|---|---|
| 1 | Rina hadir 22 dari 24 hari kerja, 1 cuti, 1 alpha | Hari kerja wajib 23 (cuti tidak dihitung); Kehadiran 22/23 = 95,7% | RP1 |
| 2 | Rina sakit bersurat dokter 2 hari | Tidak mengurangi nilai Kehadiran | RP1 |
| 3 | Rina sakit tanpa surat 1 hari | Mengurangi nilai | RP1 |
| 4 | Rina telat 3 kali melewati toleransi dari 22 hari hadir | Tepat waktu 19/22 = 86,4% | KIN-04 |
| 5 | Rina menutup 20 laporan kasir, 2 berselisih, satu kekurangan Ditiadakan | Ketelitian 19/20 = 95% | RP2 |
| 6 | Cabang belum punya produk promo | Kriteria promo "belum ada data"; bobotnya dibagi ulang | RP3, KIN-08 |
| 7 | Sambungan kasir belum menyala | Target omzet "menunggu sambungan kasir"; tidak dihitung | KIN-04 |
| 8 | HR mengubah bobot di tengah periode | Berlaku periode berikutnya; periode berjalan tetap | KIN-05 |
| 9 | HR menekan Tetapkan tanggal 27 | Tombol mati sampai tanggal 29 pukul 00.00 | RP4 |
| 10 | Rapor Dedi punya laporan bertanda belum diputuskan | Dikeluarkan dari Tetapkan semua; dibuka satu per satu | KIN-39, 4I-1 |
| 11 | Rapor belum ditetapkan saat slip ditutup | Slip tetap ditutup; Bonus Terukur masuk slip berikutnya | KIN-10 |
| 12 | Absen Rina dibetulkan sesudah rapor ditetapkan | Catatan koreksi; versi baru; bonus berubah lewat koreksi bonus | KIN-10 |
| 13 | Rina pindah dari Raja ke Markas tanggal 10 | Rapor memakai kriteria Markas (lebih lama); angka seluruh periode | KIN-11 |
| 14 | Karyawan baru masuk tanggal 20 | Punya rapor bertanda periode tidak penuh; bonus per periode tidak | KIN-11 |
| 15 | HR ingin menetapkan rapornya sendiri | Ditolak; ditetapkan Pemilik atau GM | KIN-49 |
| 16 | Aturan "kasir teliti harian" Rp10.000; Rina 18 hari menutup shift tanpa selisih dari 20 | Satu baris bonus Rp180.000 dengan rincian hari | KIN-16, BT2 |
| 17 | Rina libur 5 hari | Hari libur tidak dinilai, tidak gagal | BT2 |
| 18 | Aturan "3 periode tanpa izin dan sakit" | Bonus di periode ke-3, lalu hitungan mulai nol; bonus berikutnya di periode ke-6 | BT1 |
| 19 | Dedi pindah cabang; aturan yang sama berlaku di cabang baru | Hitungan berturut-turut tidak putus | KIN-11 |
| 20 | Pemilik menurunkan nominal aturan | Paling cepat berlaku 7 hari lagi; diumumkan | PRI-35 |
| 21 | Keberatan kasir Rina Ditiadakan sesudah bonusnya ditolak mesin | Koreksi rapor; bonus susulan di slip berikutnya | BT3 |
| 22 | Selisih ternyata ada sesudah bonus Rina dibayar | Koreksi bonus dipotong di slip berikutnya | BT3, GAJ-90 |
| 23 | HR membuat produk promo tanpa tarif | Menunggu tarif; belum bisa dilapori | KIN-48 |
| 24 | Rina melapor struk 4 hari lalu | Diterima, telat, bonus dipotong 50% | KIN-21 |
| 25 | Rina melapor struk 2 periode lalu | Ditolak (lewat akhir periode berikutnya) | PM1 |
| 26 | Dua orang melapor struk dan produk yang sama | Yang kedua ditolak | KIN-23 |
| 27 | Struk tidak ada di data kasir | Bertanda untuk pemeriksa; tidak ditolak otomatis | PM2 |
| 28 | Rina salah ketik jumlah | Membatalkan sendiri lalu lapor ulang; atau pemeriksa mengoreksi dengan jejak | KIN-24 |
| 29 | Laporan promo menunggu 4 hari kerja | Bertanda untuk HR dan pemilik | KIN-25 |
| 30 | Target Raja 200 pcs; disetujui 210 saat rapor ditetapkan | Tercapai; semua laporan Raja memakai tarif tercapai | PM3 |
| 31 | Laporan susulan disetujui sesudah tercapai dipastikan | Memakai tarif yang sudah dipastikan; slip berikutnya | PM3 |
| 32 | Finance ingin melihat laporan promo per orang | Tidak punya menu | KIN-25 |
| 33 | Kepala Toko membuat tugas "Lap etalase" harian untuk Kasir Raja | Tugas lahir; tidak masuk rapor sampai HR menandai | KIN-30, 31 |
| 34 | Rina pindah ke Markas tanggal 10 | Terkena tugas Markas mulai tanggal 10, jatah dari tanggal itu | KIN-32 |
| 35 | Rina izin pada hari tugas | Bukan jatah | KIN-33 |
| 36 | Rina alpha pada hari tugas | Tetap jatah, tidak dikerjakan | KIN-33 |
| 37 | Rina lupa lapor kemarin | Tidak ada lapor susulan | KIN-34 |
| 38 | Rina mencoba memilih foto dari galeri | Tidak ada tombol galeri; kiriman foto lama ditolak server | KIN-35 |
| 39 | Foto sesudah dikirim 3 menit setelah foto sebelum | Ditolak; hitung mundur 2 menit lagi | KIN-35 |
| 40 | Foto sesudah belum ada sampai 23.59 | Rangkaian gugur; diberi tahu pagi | KIN-35, TG3 |
| 41 | PIC tim Gudang sakit | Anggota yang hadir melapor; tercatat siapa | KIN-37 |
| 42 | Tugas sekali jalan direvisi dua kali | Telat dihitung dari laporan akhir pertama | KIN-38 |
| 43 | Rina libur 4 hari minggu ini; tugas mingguan | Satu jatah bila ada sedikitnya satu hari kerja | TG2 |
| 44 | Foto rak sama dengan foto 2 minggu lalu | Bertanda foto dipakai ulang; tetap dihitung sampai diputuskan | KIN-39, TJ2 |
| 45 | Laporan dikirim dari rumah | Bertanda di luar titik lokasi | KIN-39 |
| 46 | Kepala Toko mengusulkan laporan tidak sah | HR menetapkan dengan alasan; Rina diberi tahu | KIN-40 |
| 47 | Tidak sah ternyata keliru, rapor belum ditetapkan | Dicabut dengan alasan | KIN-40 |
| 48 | Tidak sah keliru, rapor sudah ditetapkan | Lewat catatan koreksi rapor | KIN-40, 10 |
| 49 | Rak "Makanan Kucing" 3 kali seminggu; penanggung jawab kerja 2 hari minggu itu | Jatah minggu itu 2 | TJ1 |
| 50 | Rak dilaporkan dua kali di hari yang sama | Dihitung satu | KIN-43 |
| 51 | Teman ingin melaporkan rak milik Rina yang libur | Tidak bisa; hari itu bukan jatah Rina | TJ3 |
| 52 | Penanggung jawab rak pindah cabang | Rak ditandai tanpa penanggung jawab untuk kepala cabang dan HR | KIN-43 |
| 53 | Catatan Rapat diubah sesudah terbit | Versi baru; sasaran diberi tahu "diubah" | CR1 |
| 54 | Catatan Rapat salah terbit | Ditarik; tugas tindak lanjut tetap berjalan | KIN-47 |
| 55 | Hasil rapat berupa aturan baru | Tombol "Ini aturan baru?" membuka Papan | KIN-46 |
| 56 | Penghitung perkiraan rapor gagal | Kesehatan Mesin; GM diberi tahu | PRI-33 |

---

## 11. Jalan keluar

| Tindakan | Kembali / ulangi | Batalkan | Oleh siapa, sampai kapan | Akibat ke data lain |
|---|---|---|---|---|
| Ubah kriteria, target | Kembali di tiap langkah | Versi Terjadwal dibatalkan sebelum berlaku | HR, Pemilik, GM | Periode berikutnya |
| Tetapkan rapor | — | Catatan koreksi (tidak ada "batal tetapkan") | HR, Pemilik, GM | Versi baru; koreksi bonus |
| Aturan Bonus Terukur | Kembali di tiap langkah | Terjadwal dibatalkan; Berlaku dihentikan mulai tanggal (lewat Papan) | Pemilik, GM | Penilaian berikutnya |
| Produk promo, tarif | Kembali di tiap langkah | Nonaktif mulai periode berikutnya | HR (produk), Pemilik, GM (tarif) | — |
| Lapor promo | Kembali di tiap langkah | Batalkan sebelum diperiksa | Pelapor | — |
| Keputusan laporan promo | — | Sebelum masuk slip tertutup: diputuskan ulang dengan alasan; sesudahnya baris baru (GAJ-50) | HR, Pemilik, GM | Buku Bonus |
| Tugas | Kembali di tiap langkah | Hentikan mulai tanggal; versi baru | Pembuat, HR, Pemilik, GM | Jatah ke depan |
| Lapor tugas atau rak | Foto sebelum dibatalkan | Laporan selesai dibatalkan sebelum 23.59 | Pelapor | Jatah |
| Laporan akhir | — | Minta revisi | Pemeriksa | Telat tetap dari laporan akhir pertama |
| Tidak sah | — | Dicabut dengan alasan sebelum rapor ditetapkan; sesudahnya catatan koreksi | HR, Pemilik, GM | Dikerjakan |
| Daftar rak | — | Ganti penanggung jawab, ubah jadwal, nonaktif mulai tanggal | HR, Pemilik, GM | Jatah ke depan |
| Catatan Rapat | Draf diubah bebas | Terbit: ubah (versi) atau tarik | HR, Pemilik, GM | Tugas tetap |

---

## 12. Daftar tes

**Uang** (bonus) dan **ukuran**

| No | Tes | Contoh |
|---|---|---|
| U1 | Kehadiran | Hari kerja 24, cuti 1, sakit bersurat 1, hadir 21, izin 1: wajib 22; 21/22 = 95,5% |
| U2 | Tepat waktu | Hadir 22, telat melewati toleransi 3 (telat 4 menit tidak dihitung): 86,4% |
| U3 | Ketelitian | 20 laporan, berselisih 2, satu Ditiadakan: 95% |
| U4 | Bobot dibagi ulang | Kehadiran 50 (95%), Tepat waktu 30 (90%), Promo 20 (belum ada data): (95×50 + 90×30) ÷ 80 = 93,1% |
| U5 | Bobot harus 100 | Bobot 50 + 30 + 15: simpan ditolak "kurang 5" |
| U6 | Bonus per hari | Aturan selisih ≤ Rp0 → Rp10.000; 20 hari menutup shift, 18 tanpa selisih: satu baris dasar 18 hari |
| U7 | Hari tanpa data | Hari libur tidak dinilai: 18 dari 20, bukan 18 dari 26 |
| U8 | Berturut-turut | Periode 1, 2, 3 memenuhi: bonus di 3; periode 4, 5 memenuhi, 6 gagal: tidak ada bonus di 6; 7, 8, 9: bonus di 9 |
| U9 | Periode tidak penuh | Masuk tanggal 20: tidak dinilai aturan per periode; per hari tetap |
| U10 | Tidak dobel | Penilai resmi jalan dua kali untuk aturan, orang, periode yang sama: satu baris Buku Bonus |
| U11 | Koreksi plus dan minus | Koreksi membuat terpenuhi: baris susulan; tidak terpenuhi sesudah dibayar: koreksi bonus di slip berikutnya |
| U12 | Promo tercapai | Target 200, disetujui 210; tarif 5.000 / 2.500; Rina 12 pcs (2 telat): (10 × 5.000) + (2 × 5.000 × 50%) = 55.000 |
| U13 | Promo belum tercapai | Disetujui 180: Rina 12 pcs: (10 × 2.500) + (2 × 1.250) = 27.500 |
| U14 | Susulan memakai hasil pasti | Sesudah dipastikan belum tercapai, laporan susulan 30 pcs disetujui: tetap tarif belum tercapai; tercapai tidak berubah |
| U15 | Jatah harian | 26 hari periode, 4 libur, 1 cuti, 1 alpha: jatah 21 (alpha tetap jatah) |
| U16 | Jatah mingguan | Minggu dengan 1 hari kerja: 1 jatah; minggu seluruhnya cuti: 0 |
| U17 | Dikerjakan | Jatah 21: 20 hari punya laporan selesai (satu di antaranya ditetapkan tidak sah), satu hari hanya rangkaian gugur: dikerjakan 19 dari 21 |
| U18 | Kerapian display | Rak 3 kali seminggu, 4 minggu, hari kerja per minggu 6/6/2/6: jatah 3+3+2+3 = 11; dirapikan 10: 90,9% |
| U19 | Satu laporan satu ukuran | Laporan rak tidak ikut "tugas rutin dikerjakan" |
| U20 | Hitungan terkunci | Sesudah rapor ditetapkan, laporan dibatalkan: hitungan tersimpan tidak berubah |

**Waktu**

| No | Tes | Contoh |
|---|---|---|
| W1 | Tetapkan aktif | 28 Oktober 23.59: tombol mati; 29 Oktober 00.00: aktif |
| W2 | Batas lapor promo | Struk 14 Oktober: 17 Oktober 23.59 belum telat; 18 Oktober telat; 26 November ditolak (lewat akhir periode berikutnya 25 November) |
| W3 | Lapor hanya hari ini | Lapor tugas untuk kemarin: tidak ada pilihan tanggal; jam server |
| W4 | Gugur 23.59 | Foto sebelum 22.00, sesudah 00.05: rangkaian gugur |
| W5 | Minggu terpotong periode | Minggu 21–27 September 2026 (Minggu jatuh 27): jatah di periode 26 Sep – 25 Okt |
| W6 | Kriteria tidak mundur | Ubah kriteria berlaku mulai periode berjalan: ditolak |
| W7 | Pengingat | Shift pulang 17.00: pengingat 15.00 bila belum lapor |

**Hak akses**

| No | Tes | Contoh |
|---|---|---|
| H1 | Finance tanpa menu | Finance memanggil rapor atau laporan promo: ditolak |
| H2 | Kepala cabang tidak menetapkan | Kepala Toko memanggil Tetapkan rapor atau Tetapkan tidak sah: ditolak; usul: diterima |
| H3 | HR tidak mengubah uang | HR mengubah aturan bonus, tarif promo, potongan telat: ditolak |
| H4 | Tidak memutuskan sendiri | HR menetapkan rapornya, memeriksa laporan promonya, atau menetapkan tidak sah laporannya: ditolak |
| H5 | Kepala cabang hanya timnya | Kepala Toko Raja membuat tugas untuk Markas atau melihat rapor Markas: ditolak |
| H6 | Tugas masuk rapor | Kepala Toko menandai tugas masuk rapor: ditolak |
| H7 | Lapor rak hanya penanggung jawab | Orang lain melaporkan rak itu: ditolak |
| H8 | Produk promo cabang lain | Kasir Raja melapor produk yang hanya berlaku di Markas: ditolak |
| H9 | GM tidak menerima bonus | Aturan dengan penerima jabatan GM: tidak ditawarkan; panggilan langsung ke pintu tulis: ditolak (Gaji) |
| H10 | Catatan Rapat khusus | Karyawan biasa membuka catatan "khusus HR dan pemilik": ditolak |

---

## 13. Pertanyaan dan jawaban

### 4I (diajukan 14 Oktober 2026; jawaban pemilik 14 Oktober 2026: **"ok"**, dibaca setuju saran untuk semua butir)

Ditulis memakai saran Claude atas permintaan pemilik mengerjakan 4H dan 4I
berurutan; pertanyaan diketik di percakapan di akhir. Butir terbuka 6 s.d. 8
buku Kinerja (isi aturan bonus, kriteria dan bobot, target, daftar rak,
tugas masuk rapor) **tidak ditanyakan**; diisi saat menyiapkan tayang.

**4I-1 Rapor**

- **RP1.** Nilai Kehadiran = hari hadir ÷ hari kerja wajib; cuti dan sakit
  bersurat dokter tidak mengurangi nilai; izin, sakit tanpa surat, dan alpha
  mengurangi. Saran: ya.
- **RP2.** Ketelitian kasir = laporan tanpa selisih ÷ seluruh laporan yang ia
  tutup; kekurangan yang Ditiadakan dihitung tanpa selisih; selisih
  non-tunai yang tidak dibebankan kepadanya tidak dihitung. Saran: ya.
- **RP3.** Bobot kriteria yang "belum ada data" dibagi ulang sebanding ke
  kriteria lain; perubahan kriteria berlaku mulai periode berikutnya. Saran:
  ya.
- **RP4.** Tombol Tetapkan rapor aktif mulai tanggal 29 pukul 00.00 (sama
  dengan tombol tutup slip); rapor bukan penahan slip. Saran: ya.

**4I-2 Bonus Terukur**

- **BT1.** Bonus berturut-turut: sesudah diberikan, hitungan mulai dari nol
  (bonus di periode ke-3, ke-6, dan seterusnya). Saran: ya.
- **BT2.** Bonus per hari hanya menilai hari yang punya data bagi orang itu
  (misalnya hari ia menutup shift); hari libur tidak dihitung gagal. Saran:
  ya.
- **BT3.** Koreksi sesudah ditetapkan: menjadi terpenuhi → bonus susulan;
  menjadi tidak terpenuhi sesudah disahkan → dibatalkan bila slip belum
  ditutup, atau dipotong sebagai koreksi bonus di slip berikutnya. Saran:
  ya.

**4I-3 Penjualan Promo**

- **PM1.** Laporan promo paling lambat sampai akhir periode berikutnya
  sesudah periode tanggal struk; lewat itu ditolak. Saran: ya.
- **PM2.** Laporan yang tidak cocok dengan data kasir ditandai untuk
  pemeriksa, tidak ditolak otomatis. Saran: ya.
- **PM3.** Tercapai atau belum dipastikan saat rapor periode ditetapkan;
  laporan susulan memakai hasil itu dan tidak mengubahnya. Saran: ya.

**4I-4a Tugas, membuat sampai melapor**

- **TG1.** Pengingat tugas harian 2 jam sebelum jam pulang shift; tugas tim
  ke PIC atau anggota yang hadir. Saran: ya.
- **TG2.** Tugas mingguan dan per periode: satu jatah bila orang itu punya
  sedikitnya satu hari kerja di minggu atau periode itu. Saran: ya.
- **TG3.** Rangkaian foto yang belum lengkap diingatkan pukul 21.00 dan gugur
  otomatis pukul 23.59. Saran: ya.

**4I-4b Tugas, penjagaan dan hitungan**

- **TJ1.** Jadwal rak: "tiap hari kerja" atau "N kali seminggu"; jatah
  mingguan tidak lebih dari hari kerja penanggung jawab minggu itu. Saran:
  ya.
- **TJ2.** Tanda janggal: foto sama atau sangat mirip dengan foto 30 hari
  terakhir di cabang itu; di luar radius cabang; lebih dari 30 menit di luar
  jam shift. Saran: ya.
- **TJ3.** Hanya penanggung jawab rak yang melapor rak itu; hari ia tidak
  bekerja bukan jatahnya. Saran: ya.

**4I-5 Catatan Rapat**

- **CR1.** Catatan Rapat yang diubah sesudah terbit memberi tahu sasaran
  dengan tanda "diubah". Saran: ya.
- **CR2.** Catatan Rapat boleh berlampiran foto atau PDF, paling banyak 5.
  Saran: ya.

Bacaan Claude yang tidak ditanyakan: penilaian memakai data saat rapor
ditetapkan (KIN-16); nominal Bonus Terukur dihitung pintu tulis Gaji dari
pengaturan jenis bonus bersasaran aturan (WAJ-04, GAJ-83); bonus promo lahir
sudah disahkan karena laporannya diperiksa satu per satu (spec Gaji 4E-4);
kehilangan barang tidak menjadi ukuran (KIN-17); foto lapor tugas hanya dari
kamera aplikasi, struk promo boleh dari galeri (struk difoto belakangan);
keberatan atas rapor tidak ada sebagai jenis pengajuan (dibetulkan di
sumbernya); pembagian enam bagian dipilih Claude.

---

## 14. Daftar periksa (peta jalan Tahap 4)

### Bagian 4I-1 s.d. 4I-5

- [x] Tidak melanggar WAJ-01 s.d. 12 (satu fungsi ukuran, rapor, jatah,
      WAJ-04; angka dibaca dari pemiliknya, WAJ-03; kriteria per jabatan
      per cabang, WAJ-05; bertanggal, WAJ-07; tidak ada yang dihapus;
      jalan keluar per tindakan, WAJ-11).
- [x] Setiap layar memenuhi TAM-01 s.d. 25 (yang menyangkut uang atau status
      orang ditahan 3 detik; foto dari kamera, TAM-08; satu layar satu
      tugas).
- [x] Data memenuhi PRI-01 s.d. 41 (jam server; perkiraan dihitung, yang
      ditetapkan disalin; kunci aturan + orang + periode dan nomor struk +
      produk; mesin berpenjaga).
- [x] Aturan baru bernomor (KIN-52 s.d. 88, disetujui, bagian 3.10 s.d. 3.15
      `07-kinerja-rekrutmen.md`).
- [x] Kejadian 1 s.d. 56, jalan keluar, tes U1 s.d. U20, W1 s.d. W7, H1 s.d.
      H10.
- [x] Tiap layar menyebut ukuran utamanya. Bentuk baru: kartu kriteria
      dengan angka di baliknya (KIN-L01), foto berdampingan untuk tanda
      dipakai ulang (KIN-L27), hitung mundur jarak foto (KIN-L21).
- [x] Disetujui pemilik 14 Oktober 2026 (RP1 s.d. CR2 sesuai saran).
