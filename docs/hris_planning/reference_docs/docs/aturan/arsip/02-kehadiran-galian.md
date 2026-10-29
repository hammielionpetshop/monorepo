# Galian Sistem Lama: Kehadiran

Status: **selesai.** Buku aturan v3 (`../02-kehadiran.md`) ditetapkan 12 Oktober
2026. File ini arsip: galian sistem lama dan semua jawaban pemilik.
Digali dari sistem lama pada: 11 Oktober 2026

Bab 2 dipecah menjadi lima bagian (disetujui pemilik, 11 Oktober 2026):

| Bagian | Isi | Status |
|---|---|---|
| 2A | Jadwal dan shift | **Selesai dibahas** (11 Oktober 2026). Tanda hitung lembur ditunda ke 2B; enam hal soal tukar dibawa ke 2C |
| 2B | Absen masuk dan pulang (QR, lokasi, foto, rumus telat dan lembur, koreksi) | **Selesai dibahas** (11 Oktober 2026). Aturan di 2B.10. Tidak ada pertanyaan yang menunggu |
| 2C | Libur dan cuti | **Sudah digali** (11 Oktober 2026), database sudah dicek. KEH-C01 s.d. C33. **Dijawab pemilik** (2C.9), 22 aturan di 2C.10. **Selesai dibahas** (11 Oktober 2026). Terbuka: toko tutup dan hari besar, dan tiga rincian cuti tahunan |
| 2D | Klarifikasi dan lembur, rekap, batas waktu pengajuan | **Sudah digali** (11 Oktober 2026), database sudah dicek. KEH-D01 s.d. D29. **Dijawab pemilik** (12 Oktober 2026): jawaban di 2D.9, 24 aturan di 2D.10. **Selesai dibahas** (K1 dan K2 dijawab). Tidak ada pertanyaan yang menunggu |
| 2E | Penetapan menjadi `02-kehadiran.md` | **Ditetapkan** 12 Oktober 2026 (KEH-01 s.d. 79). Jawaban pemilik di bagian 2E file ini. Terbuka: tiga rincian cuti tahunan dan hari tutup dibayar atau tidak (Bab 3) |

Batas penggalian: kode aplikasi dan struktur database yang berjalan. Isi data
karyawan tidak dibuka. Yang dibaca isinya hanya **tabel pengaturan jam kerja**
(nama shift dan jamnya), karena itu pengaturan, bukan data orang.

Nomor KEH di file ini adalah nomor **galian** (sementara). Nomor aturan v3
ditetapkan di 2E.

---

# Bagian 2A: Jadwal dan shift

## 2A.1 Bagian ini mengurus apa

Jam kerja yang berlaku untuk seseorang pada suatu hari: jam masuk dan jam pulang.
Telat dan lembur dihitung dari jam ini, jadi salah di sini berarti salah di gaji.

## 2A.2 Data di sistem lama (dicek ke database)

| Data | Isinya | Tabel | Jumlah baris |
|---|---|---|---|
| Jadwal departemen | Nama, jam masuk, jam pulang, batas deteksi, hitung lembur ya/tidak | `work_schedules` | 4 (untuk 3 departemen) |
| Jadwal shift cabang | Sama, tetapi per cabang; ada tanda aktif | `branch_shift_schedules` | 8 (untuk 4 dari 7 cabang) |
| Jam khusus per orang | Jam masuk dan pulang khusus | 2 kolom di `employees` | 4 orang aktif memakainya |
| Roster harian | Per orang per tanggal: shift tertentu, atau libur | `employee_roster` | 37; 35 di antaranya libur, hanya 2 berisi shift |
| Shift mingguan | Per orang per minggu | `shift_assignments` | 0 (mati) |

Isi pengaturan jam kerja saat ini:

| Sumber | Milik | Shift | Masuk | Pulang | Batas deteksi | Hitung lembur |
|---|---|---|---|---|---|---|
| Departemen | Office | Kantor | 08.00 | 17.00 | (tidak ada) | ya |
| Departemen | Team Gudang | Gudang | 08.00 | 19.00 | (tidak ada) | ya |
| Departemen | Team Toko | Shift 1 | 07.00 | 17.00 | 09.30 | ya |
| Departemen | Team Toko | Shift 2 | 10.00 | 20.00 | (tidak ada) | **tidak** |
| Cabang | Toko Pusat | Shift 1 | 07.00 | 17.00 | 08.30 | ya |
| Cabang | Toko Pusat | Shift 2 | 10.00 | 20.00 | (tidak ada) | ya |
| Cabang | Toko Depan | Shift 1 | 07.15 | 17.00 | 08.30 | ya |
| Cabang | Toko Depan | Shift 2 | 10.00 | 20.00 | (tidak ada) | ya |
| Cabang | Raja Petshop | Shift 1 | 08.00 | 15.00 | 11.00 | ya |
| Cabang | Raja Petshop | Shift 2 | 14.00 | 21.00 | (tidak ada) | ya |
| Cabang | Markas Petshop | Shift 1 | 08.00 | **21.00** | 11.00 | ya |
| Cabang | Markas Petshop | Shift 2 | 14.00 | 21.00 | (tidak ada) | ya |

Cabang tanpa jadwal sendiri: Back Office (5 orang aktif), Gudang (8), Logistik (0).
Ketiganya jatuh ke jadwal departemen.

## 2A.3 Aturan yang ditemukan

| No | Aturan di sistem lama | Sumber | Keputusan |
|---|---|---|---|
| KEH-A01 | Tiap departemen bisa punya satu atau lebih jadwal kerja. | `absensi/jadwal`, `work_schedules` | |
| KEH-A02 | Tiap cabang bisa punya jadwal shift sendiri. | `absensi/shift-cabang`, `branch_shift_schedules` | |
| KEH-A03 | Tiap orang bisa diberi jam masuk dan pulang khusus. | `employees`, `karyawan/page.tsx` | **Buang** (sudah diputuskan di Bab 1, KAR-14): masuk Daftar Pengecualian |
| KEH-A04 | Urutan yang dipakai: jam khusus orang, lalu shift cabang, lalu jadwal departemen. | `calc_attendance_times`, `lib/attendanceSchedule.ts` | |
| KEH-A05 | **Shift tidak ditentukan lebih dulu, tetapi ditebak dari jam absen masuk.** Kalau jam masuk tidak melewati "batas deteksi" Shift 1, dianggap Shift 1; kalau lewat, dianggap shift terakhir. | sama | |
| KEH-A06 | Akibat KEH-A05: orang Shift 1 yang datang sesudah batas deteksi dianggap Shift 2 dan **tidak tercatat telat sama sekali**. Contoh Toko Pusat: Shift 1 masuk 07.00, batas 08.30. Datang 08.25 = telat 85 menit. Datang 08.35 = dianggap Shift 2 (masuk 10.00) = tidak telat. Jam pulangnya juga ikut Shift 2. | sama | |
| KEH-A07 | Perbantuan: kalau scan QR di cabang lain dan memilih "Perbantuan", jam kerja yang dipakai adalah shift cabang tempat scan. Masuk dan pulang dinilai sendiri-sendiri: telat dari cabang tempat masuk, lembur dari cabang tempat pulang. | `AbsenSekarang.tsx`, `calc_attendance_times` | |
| KEH-A08 | Kalau cabang tujuan perbantuan belum punya shift, orang itu tidak bisa telat dan tidak bisa lembur hari itu. | sama | |
| KEH-A09 | Jam kerja sama untuk semua hari. Tidak ada jam berbeda untuk hari tertentu (akhir pekan, bulan puasa). | struktur tabel | |
| KEH-A10 | "Hitung lembur ya/tidak" menempel di jadwal. Selain itu ada dua aturan yang ditulis dengan nama di database: departemen bernama "Team Gudang" tidak dapat lembur, dan jabatan "Helper" di cabang "Gudang" tidak kena telat dan tidak dapat lembur. | `calc_attendance_times` | Arah sudah diputuskan (KAR-62): jadi pengaturan jabatan. Rinci di 2B |
| KEH-A11 | Yang boleh mengubah jadwal: Owner dan HR. Semua peran bisa melihat. | kebijakan akses (dicek ke database) | |
| KEH-A12 | Jadwal bisa diubah dan dihapus langsung, satu kali konfirmasi. Tidak ada tanggal berlaku dan tidak ada riwayat perubahan. | `absensi/jadwal`, `absensi/shift-cabang` | |
| KEH-A13 | HR bisa merencanakan roster per orang per tanggal (shift atau libur) untuk 7, 14, atau 30 hari. Karyawan melihatnya di "Jadwal Saya" (14 hari ke depan) dan di dashboard. | `absensi/shift`, `portal/jadwal` | |
| KEH-A14 | **Shift di roster tidak dipakai untuk menghitung telat.** Itu hanya rencana untuk dilihat. Yang berpengaruh dari roster hanya tanda libur (dibahas di 2C). | tulisan di `absensi/shift`; `calc_attendance_times` tidak membaca roster | |
| KEH-A15 | Shift mingguan (`shift_assignments`) kosong dan tidak punya halaman, tetapi rumus telat di database masih membacanya. | `calc_attendance_times` | |
| KEH-A16 | Shift tidak bisa melewati tengah malam; semua perbandingan memakai jam pada hari yang sama. | rumus | |

## 2A.4 Menu di sistem lama

| Menu | Dipakai untuk apa | Mirip dengan menu lain? |
|---|---|---|
| Absensi → Jadwal Kerja | Jadwal per departemen | Ya, dengan Jadwal Shift Cabang (isi formulirnya sama persis) |
| Absensi → Jadwal Shift Cabang | Jadwal per cabang | Ya, dengan Jadwal Kerja |
| Absensi → Jadwal & Shift Karyawan | Roster per orang per tanggal | Sebagian, dengan Kalender Libur dan Persetujuan Libur (2C) |
| Karyawan → Jam Kerja Khusus | Jam khusus per orang | Jadwal ketiga yang tersembunyi di formulir karyawan |
| Portal → Jadwal Saya | Karyawan melihat 14 hari ke depan dan sisa cuti | |

## 2A.5 Tumpang tindih

1. **Jam kerja ada di lima sumber** (tabel 2A.2). Dua di antaranya (roster shift dan
   shift mingguan) nyaris tidak dipakai, tetapi masih ada di layar atau di rumus.
2. **Cara "memilih jadwal yang berlaku" ditulis empat kali:** di database
   (`calc_attendance_times`), di `lib/attendanceSchedule.ts` (absen QR/HP), di
   import fingerprint, dan di halaman Rekap. Import fingerprint tidak mengenal
   shift cabang, jadi orang yang sama bisa dinilai dengan jam berbeda tergantung
   cara absennya.
3. **Tanda "hitung lembur" bertentangan:** Team Toko Shift 2 di jadwal departemen
   "tidak", tetapi Shift 2 di keempat cabang toko "ya". Yang menang jadwal cabang,
   jadi tanda di departemen tidak berpengaruh untuk toko.
4. **Markas Petshop Shift 1 pulang 21.00** (13 jam), sedangkan Raja Petshop Shift 1
   pulang 15.00. Kemungkinan salah isi, atau memang satu orang menjaga seharian.
   Ditanyakan ke pemilik.

## 2A.6 Kejadian di lapangan dan jalan keluarnya

| Kejadian | Di sistem lama | Ada jalan keluar? |
|---|---|---|
| Orang Shift 1 datang sangat terlambat | Dianggap Shift 2, tidak telat (KEH-A06) | Tidak ada; HR harus tahu sendiri dan mengoreksi absennya |
| Orang Shift 2 datang lebih awal dari batas deteksi | Dianggap Shift 1, tercatat telat | Sama, koreksi manual |
| Jam toko berubah | Jadwal diubah di tempat, tanpa tanggal berlaku | Tidak ada riwayat. Pengaruhnya ke absen lama diperiksa di 2B (Rekap menghitung ulang di layar) |
| Jadwal terhapus tidak sengaja | Hilang, satu kali konfirmasi | Tidak ada; harus diketik ulang |
| Perbantuan ke cabang yang belum diatur | Tidak telat, tidak lembur | Harus mengatur shift cabang itu lebih dulu |
| Tukar shift antar karyawan | Tidak ada fiturnya; karena shift ditebak dari jam datang, "berjalan sendiri" | Tidak tercatat |

## 2A.7 Pertanyaan untuk pemilik

Diajukan di percakapan pada 11 Oktober 2026. Jawaban dicatat di 2A.9.

Butuh pandangan pemilik:

1. Di toko dengan dua shift, bagaimana ditentukan siapa masuk shift mana?
2. Apakah jam kerja sama setiap hari?
3. Apakah jam di tabel 2A.2 benar, khususnya Markas Petshop Shift 1 (08.00–21.00)?
4. Empat orang punya jam khusus: kasusnya apa?

Cukup setuju atau tidak: usulan U1 s.d. U8 di bawah.

## 2A.8 Usulan untuk v3 (belum disetujui)

| No | Usulan | Turunan dari |
|---|---|---|
| U1 | Jam kerja hanya disimpan di **cabang**. Jadwal departemen dihapus. Back Office dan Gudang diberi jam kerja sendiri sebagai cabang. | PRI-17, WAJ-03 |
| U2 | Shift **tidak lagi ditebak** dari jam datang. Cara penggantinya bergantung jawaban pertanyaan 1. | KEH-A06 |
| U3 | Jam kerja punya **tanggal berlaku**. Mengubah jam tidak mengubah hitungan absen yang sudah lewat. | WAJ-07, PRI-17 |
| U4 | Jam kerja tidak bisa dihapus, hanya dinonaktifkan. Setiap cabang aktif wajib punya jam kerja, sehingga perbantuan ke cabang "tanpa jam" tidak mungkin terjadi. | PRI-02, KEH-A08 |
| U5 | Masuk di cabang A dan pulang di cabang B: **telat dinilai dari jam masuk A, lembur dari jam pulang B.** Ini memperjelas PRI-17. | PRI-17, KEH-A07 |
| U6 | "Hitung lembur ya/tidak" dicabut dari jadwal dan menjadi pengaturan jabatan. | KAR-62 |
| U7 | Shift mingguan dan jam khusus per orang dibuang. Orang yang jamnya memang berbeda dicatat di Daftar Pengecualian. | KAR-14, PRI-26 |
| U8 | Yang boleh mengubah jam kerja: pemilik dan HR. Semua orang bisa melihat jam kerja cabangnya dan jadwalnya sendiri ("Jadwal Saya" dibawa). | KEH-A11, KEH-A13 |

## 2A.9 Jawaban pemilik (11 Oktober 2026)

| Butir | Jawaban pemilik | Akibat untuk v3 |
|---|---|---|
| T1 siapa masuk shift mana | Bergilir. Biasanya shift diganti tiap hari Senin. Kadang situasional. Pemilik belum menetapkan siapa pagi siapa siang, dan bertanya sebaiknya bagaimana. | Claude mengusulkan giliran mingguan (lihat 2A.10). **Menunggu jawaban** |
| T2 jam sama tiap hari | Sama semua. Kalau ada momen tertentu, direncanakan lebih dulu. | Jam kerja tidak dibedakan per hari. Momen tertentu ditangani dengan jam kerja bertanggal mulai dan akhir (U3) |
| T3 jam di tabel 2A.2 | Sudah benar, kecuali **Toko Depan Shift 1 seharusnya 07.00**, bukan 07.15. | Isi awal v3: Toko Depan Shift 1 07.00–17.00. Markas Petshop Shift 1 08.00–21.00 dianggap benar; dipastikan sekali lagi di percakapan |
| T4 jam khusus | Ada tiga kasus yang disebut: seorang groomer masuk 08.00 pulang 18.00 (tidak semua groomer begitu); seorang masuk 08.00 pulang 20.00 dan tidak kena telat; dan seorang lagi dengan kondisi khusus. | Ketiganya masuk Daftar Pengecualian (PRI-26), bukan pengaturan jabatan. Orang keempat diperiksa saat data awal diisi |
| U1 jam kerja hanya di cabang | Setuju | |
| U2 shift tidak ditebak | Pemilik bertanya: sebaiknya ditetapkan siapa pagi siapa siang, atau bagaimana? | Sama dengan T1 |
| U3 tanggal berlaku | Setuju ("itu perlu") | |
| U4 tidak dihapus, wajib ada | Setuju | |
| U5 masuk di A pulang di B | **Diubah pemilik:** jam kerja mengikuti cabang tempat ia **absen masuk**, untuk seluruh hari itu. Kalau ia ditugaskan di cabang lain tetapi absen di cabang yang berbeda, itu tanggungannya sendiri. | Mengganti butir terakhir PRI-17 (yang berbunyi "dipakai jam kerja cabang B"). **Menunggu kepastian** sebelum PRI-17 diubah |
| U6 tanda hitung lembur | Pemilik belum paham; minta dijelaskan rinci. | Dijelaskan ulang di percakapan. **Menunggu jawaban** |
| U7 buang shift mingguan dan jam khusus | Setuju | |
| U8 siapa mengubah jam kerja | Setuju | |

## 2A.10 Giliran shift dan tukar (diputuskan pemilik, 11 Oktober 2026)

Jawaban lanjutan pemilik atas butir yang tadinya menunggu:

| Butir | Keputusan |
|---|---|
| T1 / U2 giliran shift | **Setuju.** Shift dibuat baku dan digilir otomatis tiap Senin |
| Siapa mencatat tukar | Karyawan sendiri yang mengajukan, dengan persetujuan teman yang diajak tukar (rincian di bawah). Ini berbeda dari saran Claude (kepala toko dan HR) |
| U5 | **Setuju.** Jam kerja mengikuti cabang tempat absen masuk, untuk seluruh hari itu. PRI-17 sudah diubah |
| U6 tanda hitung lembur | **Ditunda.** Pemilik membenarkan bahwa soal siapa dapat lembur belum diputuskan dengan benar. Dibahas di 2B |
| Markas Petshop Shift 1 08.00–21.00 | Dianggap benar (pemilik: "jam kerjanya sudah benar"). Dipastikan lagi saat data awal v3 diisi |

Arahan pemilik: cara kerja sistem lama **bukan acuan** kalau bertentangan dengan
keputusan baru. Tujuan penggalian adalah menemukan kelemahannya dan
memperbaikinya di v3.

### Aturan yang dihasilkan (nomor v3 ditetapkan di 2E)

1. Di cabang dengan lebih dari satu shift, tiap orang punya shift untuk satu
   minggu, Senin sampai Minggu.
2. Sistem menggilir sendiri tiap Senin: yang minggu ini pagi, minggu depan siang,
   dan sebaliknya. Giliran awal diisi sekali.
3. Telat dan lembur dinilai dari shift yang tercatat, tidak pernah ditebak dari
   jam datang.
4. Karyawan melihat shiftnya di "Jadwal Saya".
5. **Saat mengajukan izin, karyawan memilih salah satu dari tiga:** izin saja,
   tukar libur, atau tukar shift.
6. **Izin saja:** mengikuti aturan izin yang berlaku dan wajib disetujui.
7. **Tukar libur atau tukar shift:** karyawan memilih teman yang diajak tukar.
   Permintaan muncul di teman itu. Kalau teman menerima, jadwal keduanya langsung
   berubah. Tidak perlu persetujuan atasan dan tidak ada pemberitahuan ke
   atasan; atasan dan HR cukup **bisa melihatnya**, dan ada laporannya.
   (Ditulis ulang 11 Oktober 2026 sebagai pengganti, keputusan pemilik di 2C.9
   butir W12 dan K4. Bunyi lama: "atasan cukup diberi tahu".)
8. **Tukar wajib diajukan paling lambat H-2.** Kurang dari itu tukar tidak bisa
   diajukan, dan yang berlaku adalah aturan biasa (izin yang wajib disetujui).

### Yang masih terbuka, dibawa ke 2C

1. Kalau teman menolak atau tidak menjawab sampai batas waktu, permintaan tukar
   menjadi apa?
2. H-2 dihitung dari saat mengajukan, atau dari saat teman menerima?
3. Perubahan mendadak di bawah H-2 yang bukan kemauan karyawan (teman sakit, toko
   kekurangan orang): bolehkah HR atau kepala toko mengubah shift langsung?
4. Siapa "atasan" yang diberi tahu: kepala toko, HR, atau keduanya?
5. Adakah batas berapa kali tukar dalam satu periode?
6. Cabang dengan jumlah orang ganjil atau hanya satu orang: gilirannya bagaimana?

---

# Bagian 2B: Absen masuk dan pulang

Digali 11 Oktober 2026 dari `components/AbsenSekarang.tsx`,
`app/(dashboard)/absen-qr/[token]/page.tsx`, `app/(dashboard)/absensi/qr/page.tsx`,
`app/(dashboard)/absensi/rekap/page.tsx`, `lib/attendanceSchedule.ts`,
`lib/lateTolerance.ts`, dan database (fungsi `calc_attendance_times`, tabel
`attendances`, `branch_qr_tokens`, `attendance_edit_logs`, serta kebijakan aksesnya).

## 2B.1 Bagian ini mengurus apa

Catatan jam masuk dan jam pulang tiap orang tiap hari, bukti bahwa ia memang
berada di tempat (QR, lokasi, foto), hitungan telat dan lembur dari jam itu, dan
cara membetulkan catatan yang salah. Angka telat dan lembur dari sini langsung
menjadi potongan dan tambahan di gaji.

## 2B.2 Data di sistem lama (dicek ke database)

| Data | Isinya | Tabel | Jumlah baris |
|---|---|---|---|
| Absen harian | Satu baris per orang per tanggal: jam masuk, jam pulang, menit telat, jam lembur, status, catatan, cara absen, foto, lokasi, cabang masuk dan cabang pulang | `attendances` | 2.165 |
| QR cabang | Satu kode tetap per cabang | `branch_qr_tokens` | 7 |
| Riwayat koreksi | Nilai lama, nilai baru, alasan, siapa | `attendance_edit_logs` | 314 (125 dalam 30 hari terakhir) |
| Foto absen | File foto masuk dan pulang | penyimpanan `attendance-photos` (terbuka untuk umum) | dihapus setelah 60 hari |

Cara absen yang benar-benar dipakai:

| Cara absen | Seluruh data | 30 hari terakhir (439 baris) |
|---|---|---|
| QR | 276 | 276 (63%) |
| Diisi tangan oleh kantor | 185 | 108 (25%) |
| Fingerprint (import) | 1.704 | 55 (12%), sebagian mungkin isian massal (KEH-B27) |
| HP dengan titik lokasi | 0 | 0 |

Angka lain dari 30 hari terakhir (hanya dihitung, isinya tidak dibuka):

| Kejadian | Jumlah | Dari 439 baris |
|---|---|---|
| Hadir tetapi tidak ada jam pulang | 53 | 12% |
| Absen masuk di cabang lain (perbantuan) | 42 | 10% |
| Masuk dan pulang di cabang berbeda | 4 | 1% |
| Tercatat telat | 64 | 15% |
| Telat 1–5 menit lewat QR (tidak dipotong) | 18 | |
| Tercatat lembur | 79 | 18% |
| Lembur yang sudah disahkan | 41 | |

**Titik lokasi: 0 dari 7 cabang punya titik lokasi.** Radius bawaan 150 meter
tidak pernah dipakai.

## 2B.3 Aturan yang ditemukan

### Cara absen dan pengamannya

| No | Aturan di sistem lama | Sumber | Keputusan |
|---|---|---|---|
| KEH-B01 | Ada empat cara absen: QR, HP dengan titik lokasi, fingerprint (import), dan diisi tangan oleh kantor. | `attendances.source` | Sudah diputuskan: v3 hanya QR dengan titik lokasi |
| KEH-B02 | QR tiap cabang adalah **satu gambar tetap** yang dicetak dan ditempel. Isinya alamat halaman absen. | `absensi/qr`, `branch_qr_tokens` | |
| KEH-B03 | **Absen QR tidak memeriksa lokasi sama sekali.** Siapa pun yang menyimpan foto QR atau alamat halamannya bisa absen dari mana saja. | `AbsenSekarang.tsx` ("tidak perlu GPS") | |
| KEH-B04 | Pemilik dan HR bisa membuat ulang QR sebuah cabang. QR lama langsung mati dan harus dicetak ulang. | `absensi/qr` | |
| KEH-B05 | Absen HP dengan titik lokasi sudah ada (radius, jarak dicatat), tetapi tidak pernah dipakai karena tidak ada cabang yang diberi titik. Pemeriksaan jaraknya dilakukan di handphone, bukan di server. | `AbsenSekarang.tsx` | |
| KEH-B06 | Foto wajib saat masuk dan saat pulang, diambil dari kamera di halaman itu, diberi tulisan nama, jam, dan cabang. Ada jalan cadangan "kamera bawaan HP". | sama | |
| KEH-B07 | Foto disimpan di tempat yang terbuka untuk umum (siapa pun yang tahu alamatnya bisa melihat), dan dihapus setelah 60 hari. Jam dan angkanya tidak ikut terhapus. | `absensi/qr`, penyimpanan | |
| KEH-B08 | **Jam absen diambil dari jam handphone.** Server hanya memeriksa tanggalnya hari ini. Mengubah jam handphone mengubah jam absen. | `AbsenSekarang.tsx`, kebijakan akses | Bertentangan dengan PRI-01 |
| KEH-B09 | Semua peran bisa absen dengan akunnya sendiri. | `absen-qr/[token]` | |

### Urutan masuk dan pulang

| No | Aturan di sistem lama | Sumber | Keputusan |
|---|---|---|---|
| KEH-B10 | Scan pertama hari itu = masuk, scan kedua = pulang. Sebelum kamera terbuka ada layar konfirmasi "ini absen masuk / pulang". | `AbsenSekarang.tsx` | |
| KEH-B11 | Absen pulang paling cepat 15 menit setelah absen masuk. | sama, kebijakan akses | |
| KEH-B12 | Satu baris per orang per tanggal. Absen pulang hanya bisa pada tanggal yang sama; lewat tengah malam tidak bisa lagi. | `attendances`, kebijakan akses | |
| KEH-B13 | Kalau baris hari itu dibuat lewat cara lain (diisi kantor atau fingerprint), karyawan tidak bisa absen pulang lewat QR. | `AbsenSekarang.tsx` | |
| KEH-B14 | Scan QR cabang lain: ditanya "sedang perbantuan?" atau "salah scan". Jawaban karyawan langsung dipakai, tanpa persetujuan siapa pun. | sama | |
| KEH-B15 | Absen masuk pada hari libur: wajib memilih tanggal libur pengganti lebih dulu. | sama | Dibahas di 2C |

### Rumus telat

| No | Aturan di sistem lama | Sumber | Keputusan |
|---|---|---|---|
| KEH-B16 | Telat = jam masuk dikurangi jam masuk jadwal, dalam menit, detik dibuang. Datang lebih awal tidak dihitung apa-apa. | `calc_attendance_times` | |
| KEH-B17 | Telat 1–5 menit **lewat QR** tetap dicatat tetapi tidak dipotong gaji (alasan: HP lambat saat scan). Angkanya ditulis di kode, dan hanya berlaku untuk QR. | `lib/lateTolerance.ts` | |
| KEH-B18 | Pesan di HP sengaja tidak menyebut telat itu dipotong atau tidak, supaya batas 5 menit tidak dijadikan sasaran. | `AbsenSekarang.tsx` | |
| KEH-B19 | Telat lebih dari 30 menit wajib dijelaskan karyawan. | `lib/lateClarification.ts` | Dibahas di 2D |
| KEH-B20 | **Pulang lebih cepat dari jadwal tidak dihitung dan tidak ditandai.** | rumus | |

### Rumus lembur

| No | Aturan di sistem lama | Sumber | Keputusan |
|---|---|---|---|
| KEH-B21 | Lembur = jam pulang dikurangi jam pulang jadwal. Hanya jam penuh: di bawah 60 menit = 0; 1 jam 50 menit = 1 jam. | `calc_attendance_times`, `lib/attendanceSchedule.ts` | |
| KEH-B22 | Paling banyak 3 jam lembur sehari. | sama | |
| KEH-B23 | Lembur dihitung paling jauh sampai 20.00, kecuali jadwal pulangnya sendiri 20.00 atau lebih. Aturan ini dibuat karena satu orang gudang yang rutin pulang lewat jam 8 malam. | sama (catatan di rumus) | |
| KEH-B24 | Tidak dapat lembur: jadwal yang tandanya "tidak", **departemen bernama "Team Gudang"**, dan **jabatan "Helper" di cabang "Gudang"** (yang ini juga tidak kena telat). Nama-nama itu ditulis di rumus. | sama | Bertentangan dengan WAJ-05. Arah: KAR-62 |
| KEH-B25 | Lembur yang terhitung belum dibayar. Karyawan harus mengklaim dengan foto kertas lembur paling lambat 3 hari, lalu disahkan kantor (jamnya bisa diubah). | `lib/overtimeClaim.ts` | Dibahas di 2D; batas 3 hari sudah PRI-09 |

### Membetulkan catatan

| No | Aturan di sistem lama | Sumber | Keputusan |
|---|---|---|---|
| KEH-B26 | Pemilik, HR, dan Finance bisa menambah absen dengan tangan. Kalau statusnya hadir, alasan wajib diisi. | `absensi/rekap` | |
| KEH-B27 | Ada **isian massal**: banyak orang dan banyak hari diisi sekaligus. Tanpa alasan, tanpa riwayat, dan **menimpa** catatan yang sudah ada. Baris baru dari sini tercatat sebagai "fingerprint". | sama | |
| KEH-B28 | Tombol "keterangan" (izin, sakit, alpha, resign) juga menimpa catatan yang ada tanpa riwayat. "Resign" disimpan sebagai izin dengan catatan "Resign". | sama | |
| KEH-B29 | Ubah satu catatan: alasan wajib, nilai lama dan baru disimpan di riwayat. | sama, `attendance_edit_logs` | |
| KEH-B30 | Di formulir ubah, menit telat dan jam lembur **diketik tangan**. Kalau jam masuk ikut diubah, database menghitung ulang dan angka ketikan itu hilang; kalau tidak, angka ketikan yang dipakai. | sama, `calc_attendance_times` | |
| KEH-B31 | Saat formulir ubah dibuka, telat dihitung ulang dari jam kerja **yang berlaku sekarang**. Kalau jam kerja cabang sudah berubah, membuka lalu menyimpan absen lama mengubah telatnya. | `absensi/rekap` | Titipan 2A. Terjawab oleh U3 (jam kerja bertanggal) |
| KEH-B32 | Riwayat koreksi hanya boleh dibaca dan ditulis oleh pemilik menurut aturan database, sedangkan halaman tidak memeriksa apakah riwayat berhasil disimpan. Koreksi oleh HR atau Finance mungkin tidak meninggalkan riwayat. | kebijakan akses | (perlu dicek; isi riwayat tidak dibuka) |
| KEH-B33 | Karyawan boleh mengubah baris absennya sendiri pada hari itu, dan database tidak membatasi kolom mana. Angka lembur saat absen pulang dikirim dari handphone dan dipercaya begitu saja. | kebijakan akses, `calc_attendance_times` | Calon celah; tidak diperiksa lebih jauh (keputusan pemilik: sistem lama dibiarkan) |

## 2B.4 Menu di sistem lama

| Menu | Dipakai untuk apa | Mirip dengan menu lain? |
|---|---|---|
| Absen QR (dibuka dari scan) | Absen masuk dan pulang | Ya, dengan Portal → Absensi (komponen yang sama, cara lokasi) |
| Portal → Absensi | Absen HP dengan lokasi, riwayat sendiri | Tombol absennya tidak pernah muncul karena cabang tanpa titik |
| Absensi → QR Absen | Cetak dan buat ulang QR; bersihkan foto lama | Dua urusan berbeda di satu halaman |
| Absensi → Rekap | Lihat, tambah, ubah, isian massal, dan empat panel persetujuan klarifikasi | Halaman paling padat; persetujuan dibahas di 2D |
| Absensi → Import | Import fingerprint | Dibuang di v3 |

## 2B.5 Tumpang tindih

1. **Rumus telat dan lembur ditulis empat kali:** database, `lib/attendanceSchedule.ts`
   (handphone), halaman Rekap, dan import fingerprint. Kodenya sendiri berpesan
   "harus selalu sama persis".
2. **Siapa yang menghitung bergantung jalannya:** absen masuk dihitung database,
   absen pulang dihitung handphone, koreksi diketik tangan.
3. **Toleransi 5 menit tidak ada di catatan absen**, hanya di hitungan gaji. Rekap
   menulis "telat 4 menit", slip gaji tidak memotong.
4. **Tiga pintu untuk membetulkan absen** (ubah, keterangan, isian massal) dengan
   aturan berbeda: hanya satu yang meninggalkan riwayat.
5. **"Tidak dapat lembur" ada di tiga tempat:** tanda di jadwal, nama departemen,
   dan nama jabatan + cabang.

## 2B.6 Kejadian di lapangan dan jalan keluarnya

| Kejadian | Di sistem lama | Ada jalan keluar? |
|---|---|---|
| QR difoto lalu dipindai dari rumah | Berhasil; tidak ada pemeriksaan lokasi | Tidak ada pencegah. Hanya foto diri yang bisa diperiksa kantor satu per satu |
| Jam handphone dimundurkan | Jam absen ikut mundur | Tidak ada pencegah |
| Lupa absen pulang | Baris tanpa jam pulang (12% dari absen) | Klarifikasi lupa absen pulang (2D) |
| Pulang lewat tengah malam | Tidak bisa absen pulang | Sama dengan lupa absen pulang |
| HP rusak, tidak ada sinyal, kamera macet | Tidak bisa absen | Kantor mengisi dengan tangan dan menulis alasan (25% absen diisi tangan) |
| Salah pencet masuk atau pulang | Layar konfirmasi; pulang ditahan 15 menit | Kalau telanjur, minta kantor mengubah |
| Salah scan QR cabang lain | Pilih "salah scan", absen batal | Ada |
| Mengaku perbantuan padahal tidak | Langsung tercatat perbantuan | Tidak ada pemeriksaan |
| Kantor salah mengoreksi | Diubah lagi; riwayat ada hanya untuk jalur "ubah" | Isian massal dan keterangan tidak bisa dilacak |
| Jam kerja cabang berubah | Telat absen lama ikut berubah saat dibuka dan disimpan | Tidak ada |

## 2B.7 Pertanyaan untuk pemilik

Diajukan di percakapan pada 11 Oktober 2026. Jawaban dicatat di 2B.9.

Butuh pandangan pemilik:

1. Bisakah tiap cabang menyediakan satu layar untuk QR yang berganti?
2. Jabatan mana yang tidak dapat lembur, dan mana yang tidak kena telat?
3. Driver, kenek, dan orang gudang absen di mana dan dengan cara apa?
4. Rumus lembur (jam penuh, paling sedikit 1 jam, paling banyak 3 jam, batas
   20.00): dibawa apa adanya?
5. Toleransi telat 5 menit: dibawa, dan untuk siapa?
6. Pulang lebih cepat dari jadwal: ada akibatnya atau tidak?
7. Lokasi ditolak padahal orangnya di toko: jalan keluarnya apa?

Cukup setuju atau tidak: usulan V1 s.d. V10 di bawah.

## 2B.8 Usulan untuk v3 (belum disetujui)

| No | Usulan | Turunan dari |
|---|---|---|
| V1 | Jam absen selalu jam server. Telat dan lembur dihitung server di **satu tempat**; handphone hanya menampilkan hasilnya. | PRI-01, WAJ-04, KEH-B08 |
| V2 | Karyawan tidak bisa mengubah catatan absen. Yang bisa ia lakukan hanya "kirim absen masuk" dan "kirim absen pulang". | KEH-B33 |
| V3 | Lokasi diperiksa server. Setiap percobaan dicatat, termasuk yang ditolak: jarak, ketelitian lokasi, jam. Pemilik bisa melihatnya. | backlog absen QR |
| V4 | Foto hanya dari kamera langsung, tanpa jalan cadangan galeri. Disimpan tertutup (hanya yang berhak bisa melihat) dan dihapus setelah 60 hari. | TAM-08, KEH-B06, KEH-B07 |
| V5 | Angka telat dan lembur dihitung **sekali** saat absen, memakai jam kerja yang berlaku pada tanggal itu, lalu disimpan. Mengubah jam kerja tidak mengubah absen lama. | U3, KEH-B31 |
| V6 | Absen pulang boleh sampai pukul 04.00 hari berikutnya dan tetap masuk ke hari kerja sebelumnya. | KEH-B12 |
| V7 | Perbantuan tetap dipilih sendiri saat scan di cabang lain, tetapi atasan diberi tahu dan daftarnya bisa dilihat. | KEH-B14, keputusan U5 |
| V8 | Membetulkan absen hanya lewat **satu pintu**: alasan wajib, catatan asli tidak pernah ditimpa, siapa dan kapan tercatat. Isian massal tetap ada tetapi lewat pintu yang sama. | PRI-02, WAJ-11, KEH-B27, B28 |
| V9 | Angka telat dan lembur tidak diketik tangan. Yang dikoreksi adalah jam masuk dan jam pulang; angkanya dihitung ulang oleh sistem. | WAJ-04, KEH-B30 |
| V10 | Yang boleh membetulkan absen: pemilik dan HR. Finance hanya melihat. | KEH-B26 |

Jawaban pertanyaan 1 s.d. 7 akan menambah usulan (QR berganti, pengaturan per
jabatan, toleransi telat sebagai pengaturan bertanggal, dan jalan keluar lokasi).

## 2B.9 Jawaban pemilik

Jawaban pertama pemilik, 11 Oktober 2026.

| Butir | Jawaban pemilik | Akibat untuk v3 |
|---|---|---|
| T1 layar QR per cabang | **Tidak memungkinkan**, karena butuh perangkat digital di tiap cabang. | QR tetap dicetak. QR berganti tidak dipakai. Pengaman terhadap QR yang difoto tinggal titik lokasi, foto berstempel, dan jam server |
| T2 siapa kena telat | Semua orang dikenai aturan telat sesuai cabangnya. Saat membuat slip gaji ada **saklar "keterlambatan orang ini tidak dihitung"**. Telat dan potongannya tetap ditampilkan (dashboard, slip) "agar lebih tahu diri". | Telat selalu dicatat untuk semua. Yang bisa ditiadakan hanya **potongannya**. Bersinggungan dengan KAR-62 dan PRI-18 ("tidak ada saklar per orang"): **menunggu kepastian** saklar itu per slip atau menetap. Bagian "siapa dapat lembur" belum dijawab |
| T3 driver, kenek, gudang | Semua driver pasti datang ke gudang untuk mengambil mobil. | Mereka absen di gudang dengan cara yang sama |
| T4 rumus lembur | Pemilik **tidak pernah mau lembur lewat pukul 20.00**. Sisanya mengikuti saran. | Jam penuh, paling sedikit 1 jam, paling banyak 3 jam, dihitung paling jauh sampai 20.00. **Menunggu kepastian:** shift yang jadwal pulangnya 20.00 atau lebih berarti tidak pernah dapat lembur |
| T5 toleransi telat 5 menit | Ok | Berlaku untuk semua, sebagai pengaturan bertanggal berlaku; angkanya tidak diumumkan ke karyawan |
| T6 pulang cepat | Dibuatkan, **tidak dipotong** karena belum ada aturan jelas. | Menit pulang cepat dicatat dan ditandai. Tidak memengaruhi gaji |
| T7 lokasi ditolak | Ya. Fotonya diberi **stempel lokasi**, seperti aplikasi stempel waktu. | Foto absen berstempel nama, jam server, cabang, titik lokasi, dan jarak. **Menunggu kepastian** bahwa absen "di luar titik" tetap perlu disahkan |
| V1 | Ok | |
| V2 | Ok. Pemilik minta dipikirkan: lupa absen pulang, dan lupa absen masuk yang baru ketahuan saat mau pulang (atau sebaliknya). | Usulan Claude diajukan di percakapan; rinciannya di 2D |
| V3 | Ok | |
| V4 | Ok. Ada keluhan foto kamera depan terbalik (mirror). | Foto disimpan tidak terbalik secara otomatis; tombol balik tetap ada sebagai cadangan |
| V5 | Ok | |
| V6 | Pemilik belum paham maksudnya. | Dijelaskan ulang di percakapan. **Menunggu jawaban** |
| V7 | Ok. Tambahan: kalau pemilik lupa memindahkan cabang seseorang, sistem menjaganya. Setelah **7 kali berturut-turut** absen masuk dan pulang di cabang lain, saat absen pulang hari ke-7 karyawan ditanya "apakah kamu sudah pindah cabang?"; kalau ya, dipindahkan langsung. | Bersinggungan dengan KAR-56 (pindah cabang lewat riwayat bertanggal) dan hak akses data induk. **Menunggu kepastian:** langsung pindah, atau disahkan satu ketukan |
| V8 | Ok | |
| V9 | Ok. Semua dihitung sistem, tetapi pemilik bisa meniadakan **potongan** telat; tampilan telatnya tetap ada di slip. | Sama dengan T2 |
| V10 | Ok | |

## 2B.10 Jawaban lanjutan dan aturan yang dihasilkan (11 Oktober 2026)

| Butir | Keputusan pemilik |
|---|---|
| Saklar potongan telat | **Per slip.** Wajib alasan, tercatat siapa. Telat dan nilai potongannya tetap tampil dengan tanda "ditiadakan". Yang selamanya tidak dipotong dicatat di Daftar Pengecualian |
| Batas lembur | **Diubah pemilik:** bukan pukul 20.00, melainkan **tidak boleh ada lembur yang melewati jam tutup toko**. Mengganti KEH-B23 |
| Pindah cabang setelah 7 hari | Ikuti saran: karyawan ditanya, jawabannya menjadi usulan, pemilik atau HR mengesahkan dengan satu ketukan |
| Foto berstempel | Hanya untuk berjaga-jaga. **Pengaman utamanya titik lokasi (GPS)** |
| Radius | Pemilik yang menentukan per cabang; menyebut 50 meter. Absen di luar titik tetap harus disahkan (dicatat Claude sebagai lanjutan T7; pemilik menutup dengan "ok") |
| Siapa dapat lembur | Betul: gudang, driver, dan kenek tidak dapat lembur; toko dan kantor dapat |
| V6 | Ok |
| Lupa absen masuk atau pulang | Ok, sesuai usulan |

### Aturan yang dihasilkan (nomor v3 ditetapkan di 2E)

Cara absen:

1. Satu cara absen untuk semua orang: scan QR cabang, lokasi diperiksa, foto diri.
   Driver, kenek, dan orang gudang absen di gudang.
2. QR dicetak, satu per cabang. Pemilik dan HR bisa membuat ulang.
3. Tiap cabang punya titik lokasi dan radius yang ditentukan pemilik. Lokasi
   diperiksa server. Semua percobaan dicatat, termasuk yang ditolak.
4. Di luar radius: karyawan tetap bisa absen dengan tanda "di luar titik"; absen
   itu baru dihitung setelah disahkan kepala toko atau HR.
5. Foto hanya dari kamera langsung, disimpan tidak terbalik, berstempel nama, jam
   server, cabang, titik lokasi, dan jarak. Disimpan tertutup, dihapus setelah 60 hari.
6. Jam absen adalah jam server. Karyawan tidak bisa mengubah catatan absen.
7. Scan pertama = masuk, kedua = pulang, dengan layar konfirmasi dan jeda 15 menit.
   Kalau scan pertama terjadi setelah lewat separuh jam kerja, sistem bertanya
   "masuk atau pulang?".
8. Absen pulang sampai pukul 04.00 masuk ke hari kerja sebelumnya.
9. Lupa absen masuk atau pulang: karyawan mengisi jam dan alasan, disahkan HR
   atau pemilik (ditegaskan pemilik 12 Oktober 2026: "atasan" berarti dua pihak
   itu). Jam itu selalu bertanda "diisi lewat klarifikasi". Sebelum disahkan hari
   itu "belum lengkap" dan tanpa lembur. Batas waktunya 3 hari (2D.10 aturan 6
   dan 8).

Telat, pulang cepat, lembur:

10. Semua orang dicatat telatnya menurut jam kerja cabang tempat ia absen masuk.
    Dihitung server, sekali, memakai jam kerja yang berlaku pada tanggal itu.
11. Toleransi telat 5 menit: dicatat tetapi tidak dipotong. Berlaku untuk semua,
    pengaturan bertanggal berlaku, angkanya tidak diumumkan ke karyawan.
12. Potongan telat bisa ditiadakan pemilik **per slip** (aturan 2B.10 baris 1).
    Dirinci di Bab 3 (Gaji).
13. Pulang lebih cepat dari jadwal dicatat dan ditandai, wajib dijelaskan, tidak
    dipotong.
14. Lembur: jam penuh, paling sedikit 1 jam, paling banyak 3 jam sehari, dan
    dihitung paling jauh sampai **jam tutup cabang**. Akibatnya shift terakhir
    tidak pernah dapat lembur.
15. "Dapat lembur" adalah pengaturan jabatan (KAR-62). Isi awal: jabatan gudang,
    driver, dan kenek tidak; jabatan toko dan kantor ya.

Perbantuan dan koreksi:

16. Perbantuan dipilih sendiri saat scan di cabang lain; atasan diberi tahu.
17. Setelah 7 hari kerja berturut-turut absen masuk dan pulang di cabang lain,
    saat absen pulang hari ke-7 karyawan ditanya "sudah pindah cabang?". Jawaban
    "ya" menjadi usulan pindah yang disahkan pemilik atau HR dengan satu ketukan;
    riwayat pindah dibuat otomatis (KAR-56).
18. Membetulkan absen hanya lewat satu pintu, oleh pemilik dan HR: alasan wajib,
    catatan asli tidak ditimpa. Yang dikoreksi jam masuk dan pulang; telat dan
    lembur dihitung ulang sistem, tidak diketik.

### Yang masih terbuka

1. "Kena telat" sebagai pengaturan jabatan (KAR-62, PRI-18) kini isinya "ya"
   untuk semua. Di 2E diputuskan apakah saklar itu masih perlu ada.
2. Pengenalan wajah: rencana pemilik untuk kelak, belum dirancang. Yang perlu
   diputuskan saat itu: foto acuan tiap karyawan, dan foto absen yang sekarang
   dihapus setelah 60 hari.

### Keputusan penutup (11 Oktober 2026)

| Butir | Keputusan pemilik |
|---|---|
| Radius awal | **100 meter** untuk semua cabang, lalu dikecilkan per cabang setelah terlihat datanya |
| Jam tutup toko | **Jam pulang shift terakhir** cabang itu. Tidak disimpan sebagai angka terpisah, diturunkan dari jam kerja (WAJ-03) |
| Jam tutup kantor (Back Office) | **20.00 paling lambat.** Disimpan sebagai pengaturan cabang itu, karena kantor tidak punya shift terakhir yang lebih malam |
| Memasang titik lokasi | Semua cabang wajib dipasang titiknya. Pemilik akan memakai Google Maps lebih dulu; fitur "ambil titik dari sini" dan pilih di peta tetap disediakan |
| Fitur titik lokasi untuk Logistik | Fitur yang sama dipakai untuk titik toko tujuan pengiriman driver. Dibuat **satu kali** dan dipakai dua modul. Dirinci di Bab 4 |
| Urutan absen | Tekan absen, lokasi diperiksa, baru kamera terbuka untuk foto diri |
| Absen di luar titik | **Diubah pemilik (mengganti aturan 4 di atas):** tetap **dihitung** sebagai absen, tetapi bertanda "perlu ditinjau". Bukan lagi "baru dihitung setelah disahkan" |
| Satu akun satu handphone terdaftar | **Tidak dipakai.** Pemilik: titip absen tidak mungkin karena wajib foto diri |
| Tanda pola lokasi mencurigakan | Dipakai. Pergeseran lokasi yang wajar dari hari ke hari tidak boleh ikut ditandai |
| Foto | Ditegaskan lagi: hanya dari kamera langsung, tidak bisa dari galeri (V4, aturan 5) |

Jawaban pemilik atas tiga catatan di bawah (11 Oktober 2026):

| Catatan | Jawaban pemilik |
|---|---|
| 1 Wajib ditinjau sebelum slip ditutup | **Ok** |
| 2 Menu "Foto Absen Hari Ini" (semula ditulis "layar") | Pemilik menilai peluang titip absen kecil, dan **berencana memakai pengenalan wajah (face recognition) kelak**. Setelah dijelaskan ulang, pemilik memilih **B: dibuat.** Yang dimaksud adalah sebuah **menu (halaman) di dalam sistem**, dibuka dari PC atau handphone, bukan perangkat layar di toko. Namanya dicatat sebagai **menu "Foto Absen Hari Ini"**. Menu ini untuk **melihat**, bukan cara absen lain: kepala cabang (kepala toko, kepala gudang) melihat deretan foto absen cabangnya hari itu; HR dan pemilik melihat semua cabang. Cara absen tetap sama untuk semua orang, termasuk HR, kepala toko, dan kepala gudang (aturan 1). Rancangan tidak boleh menutup jalan untuk pengenalan wajah |
| 3 Kamera tidak terbuka dibantu lewat pintu koreksi | **Ok.** Pemilik: sampai sekarang belum ada kasusnya |

Catatan Claude yang diajukan ke pemilik (sudah dijawab, lihat tabel di atas):

1. Absen di luar titik yang "dihitung tetapi ditinjau" perlu batas: slip gaji
   orang itu tidak bisa ditutup selama masih ada absen yang belum ditinjau.
   Tanpa batas ini, absen dari rumah tetap terhitung kalau tidak ada yang meninjau.
2. Foto diri hanya mencegah titip absen kalau fotonya dilihat orang. Usulan:
   kepala toko dan HR punya layar "foto absen hari ini" untuk cabangnya.
3. Tanpa jalan cadangan kamera bawaan, handphone yang kameranya tidak bisa dibuka
   dari halaman web tidak bisa absen. Jalan keluarnya pintu koreksi oleh HR (aturan 18).

---

# Bagian 2C: Libur dan cuti

Digali 11 Oktober 2026 dari `app/(dashboard)/portal/ajukan-libur`,
`portal/ganti-libur`, `absensi/persetujuan-libur`, `absensi/kalender-libur`,
`cuti`, `cuti/ajukan`, `components/AbsenSekarang.tsx` (masuk di hari libur),
`lib/rosterPeriod.ts`, `lib/leaveQuota.ts`, `lib/escalatingDeduction.ts`, bagian
potongan tidak hadir di `penggajian/bulanan`, dan database (fungsi
`approve_leave_request`, `decide_roster_pick_request`, `check_dayoff_pick_rules`,
`request_day_off_change`, `respond_day_off_swap`, `decide_day_off_change`,
`request_day_off_swap`, `enforce_sick_doc_requirement`,
`set_roster_pick_discipline_fee`, serta kebijakan akses tabelnya).

## 2C.1 Bagian ini mengurus apa

Hari ketika seseorang **tidak masuk dan itu sudah diketahui**: libur rutin,
tukar libur, cuti, izin, dan sakit. Bagian ini menentukan siapa boleh tidak
masuk, kapan harus memberi tahu, siapa yang menyetujui, dan status apa yang
tercatat pada hari itu. Nilai potongannya dihitung di Bab 3 (Gaji).

## 2C.2 Data di sistem lama (dicek ke database)

| Data | Isinya | Tabel | Jumlah baris |
|---|---|---|---|
| Pilihan libur | Per orang per tanggal, per periode 26–25; status; denda | `roster_pick_requests` | 67: 35 disetujui, 13 menunggu, 12 ditolak, 7 "draf" peninggalan cara lama. 5 baris kena denda |
| Libur yang berlaku | Tanda libur per orang per tanggal | `employee_roster` | 35 libur |
| Ganti atau tukar libur | Tanggal lama, tanggal baru, teman tukar, status | `roster_change_requests` | 1 (masih menunggu) |
| Masuk di hari libur | Tanggal libur asal dan tanggal pengganti | `roster_swap_logs` | 2 |
| Cuti, izin, sakit | Jenis, tanggal mulai dan selesai, jumlah hari, alasan, surat | `leave_requests` | **8, semuanya sakit** (7 tanpa surat, 1 dengan surat) |
| Libur nasional / toko tutup | Tanggal dan nama | `company_holidays` | **0** |

Status hari tidak masuk pada absen 30 hari terakhir (hanya dihitung): 19 "cuti
atau libur", 23 sakit tanpa surat, 1 sakit dengan surat, 29 alpha. Dibanding 4
pengajuan sakit yang disetujui, berarti **hampir semua status itu tidak datang
dari menu Cuti & Izin**, melainkan dari klarifikasi (2D) dan isian tangan kantor.

Cuti tahunan, izin keperluan, izin duka, dan izin mendadak: **belum pernah
diajukan satu kali pun** lewat sistem.

## 2C.3 Aturan yang ditemukan

### Libur rutin

| No | Aturan di sistem lama | Sumber | Keputusan |
|---|---|---|---|
| KEH-C01 | Jatah libur **4 tanggal per periode** (26 sampai 25), dipilih sendiri oleh karyawan di kalender, untuk periode **berikutnya**. | `ajukan-libur`, `lib/rosterPeriod.ts` | |
| KEH-C02 | Dari 4 tanggal itu paling banyak 1 yang Sabtu atau Minggu. Hanya diperiksa di handphone. | `ajukan-libur` | |
| KEH-C03 | Satu tanggal paling banyak **3 orang libur, dihitung seluruh perusahaan**, bukan per cabang. Diperiksa database. | `check_dayoff_pick_rules` | |
| KEH-C04 | Dua hal hanya berupa peringatan, tetap boleh diajukan: libur bersamaan dengan teman satu cabang, dan jarak antar libur kurang dari 5 hari. | `ajukan-libur`, `get_dayoff_pick_warnings` | |
| KEH-C05 | Memilih tanggal langsung terkirim ke kantor. Yang menyetujui hanya pemilik dan HR; menolak wajib alasan; bisa banyak sekaligus. Kepala toko tidak ikut menyetujui. | `persetujuan-libur`, `decide_roster_pick_request` | |
| KEH-C06 | Kalau jatah periode yang **sedang berjalan** belum lengkap, karyawan harus melengkapinya dulu, dan tiap tanggal yang dipilih saat itu kena **denda Rp10.000**, dipotong dari gaji. | `set_roster_pick_discipline_fee`, `penggajian/bulanan` | Uangnya dirinci di Bab 3 |
| KEH-C07 | Pilihan yang masih menunggu bisa dibatalkan karyawan; barisnya **dihapus**. Yang sudah disetujui terkunci dan hanya bisa diubah lewat Ganti Libur. | `ajukan-libur`, kebijakan akses | |
| KEH-C08 | Pemilik melihat daftar siapa yang belum mengambil jatah untuk periode depan. Driver dan orang bergaji tetap tidak masuk daftar itu. | `kalender-libur`, `get_dayoff_quota_status` | |
| KEH-C09 | **Gaji tidak membaca tanggal libur yang dipilih.** Gaji hanya menghitung berapa hari orang itu tidak hadir dalam periode: 4 hari pertama dianggap libur, sisanya dipotong. Libur di tanggal yang tidak dipilih hasilnya sama saja. | `penggajian/bulanan` (tidak membaca `employee_roster`) | |
| KEH-C10 | Hari izin dan sakit ikut **mengisi jatah 4 hari** itu lebih dulu sebelum dipotong. Jatah yang tidak terpakai dibayar sebagai "kompensasi libur" (satu hari gaji per hari). | `penggajian/bulanan` | Dirinci di Bab 3 |

### Ganti libur, tukar libur, dan masuk di hari libur

| No | Aturan di sistem lama | Sumber | Keputusan |
|---|---|---|---|
| KEH-C11 | Libur yang sudah disetujui bisa dipindah ke tanggal lain. Paling lambat H-2 dari tanggal yang lebih dekat (lama atau baru). | `ganti-libur`, `request_day_off_change` | |
| KEH-C12 | Kalau tanggal baru sudah menjadi libur teman satu cabang, wajib tukar dengan teman itu. Teman menerima dulu, **lalu tetap menunggu keputusan pemilik atau HR**. | sama, `respond_day_off_swap` | Berbeda dari keputusan 2A.10 (cukup teman, atasan diberi tahu) |
| KEH-C13 | Teman menolak: pengajuan batal. Teman tidak menjawab: menggantung tanpa batas waktu. | `respond_day_off_swap` | |
| KEH-C14 | Hanya satu pengajuan ganti libur yang boleh berjalan per orang. Membatalkan = baris dihapus. | `request_day_off_change`, kebijakan akses | |
| KEH-C15 | Saat menyetujui, kantor harus memilih jadwal kerja untuk tanggal yang kembali menjadi hari kerja. Pilihannya dari jadwal departemen. | `decide_day_off_change` | Tidak perlu lagi di v3: shift sudah tercatat per minggu (2A.10) |
| KEH-C16 | **Absen masuk di hari libur:** karyawan memilih tanggal pengganti, dan libur langsung pindah saat itu juga. Tanpa persetujuan, tanpa H-2, dan **tidak diperiksa** batas 3 orang per hari maupun batas 1 akhir pekan. | `AbsenSekarang.tsx`, `request_day_off_swap` | Titipan KEH-B15 |
| KEH-C17 | Karena KEH-C16, semua batas di Ajukan Libur dan Ganti Libur bisa dilewati: cukup datang di hari libur, lalu pilih tanggal mana saja. | sama | |

### Cuti, izin, sakit

| No | Aturan di sistem lama | Sumber | Keputusan |
|---|---|---|---|
| KEH-C18 | Enam jenis: cuti tahunan, sakit tanpa surat, sakit dengan surat dokter, izin periksa atau keperluan, izin duka, izin mendadak. | `cuti/ajukan` | |
| KEH-C19 | Cuti tahunan: 12 hari per tahun masa kerja (dihitung dari tanggal masuk, bukan Januari), baru boleh setelah masa kerja 1 tahun. **Hanya diperiksa di handphone**, tidak di database. Belum pernah dipakai. | `lib/leaveQuota.ts` | |
| KEH-C20 | Di gaji, hari cuti tahunan **ikut memakan jatah 4 hari libur** periode itu. Jadi cuti tahunan tidak menambah hari tidak masuk yang dibayar. | `penggajian/bulanan` | |
| KEH-C21 | Cuti tahunan dan izin keperluan wajib diajukan paling lambat H-2. Kalau kurang dan tetap disetujui, hari itu dicatat **alpha**. | `approve_leave_request` | |
| KEH-C22 | Izin mendadak: jenis tersendiri untuk izin tanpa H-2 atau yang diajukan sesudah harinya lewat. Tidak dicatat alpha, tetapi potongannya lebih berat dari izin biasa. | `lib/escalatingDeduction.ts` | Potongan dirinci di Bab 3 |
| KEH-C23 | Sakit tanpa surat paling lama 2 hari berturut-turut. Hari ke-3 tanpa surat dokter otomatis menjadi alpha (berlaku sejak 26 September 2026). | `enforce_sick_doc_requirement`, `cuti/ajukan` | |
| KEH-C24 | Izin duka dicatat dan dipotong **sama persis** dengan izin keperluan. | `approve_leave_request` | |
| KEH-C25 | Jumlah hari dihitung **hari kalender** dari tanggal mulai sampai selesai. Hari libur orang itu di tengahnya ikut terhitung dan ikut ditulis sebagai izin atau cuti. | `cuti/ajukan`, `approve_leave_request` | |
| KEH-C26 | Yang menyetujui hanya pemilik dan HR. Kepala toko bisa melihat pengajuan cabangnya, tidak bisa memutuskan. Pemilik dan HR bisa mengajukan atas nama orang lain. | kebijakan akses, `cuti` | |
| KEH-C27 | Menyetujui langsung menulis status tiap tanggal ke absen. Kalau pada tanggal itu sudah ada jam absen, status tidak ditimpa. | `approve_leave_request` | |
| KEH-C28 | Menolak **tidak wajib alasan** (berbeda dari menolak libur, yang wajib). | `cuti` | |
| KEH-C29 | Karyawan bisa membatalkan selama masih menunggu. **Sesudah disetujui tidak ada jalan membatalkan**; tulisannya "Terkunci" dan status di absen tetap. | `cuti`, kebijakan akses | Bertentangan dengan WAJ-11 |
| KEH-C30 | Surat dokter disimpan di tempat yang terbuka untuk umum (siapa pun yang tahu alamatnya bisa membuka). | `cuti/ajukan` | Bertentangan dengan PRI-23 |
| KEH-C31 | Saat mengisi formulir, karyawan diperingatkan kalau ada orang lain yang juga tidak masuk pada tanggal itu, dan diberi tahu potongan yang akan kena. | `cuti/ajukan` | |

### Kalender dan libur nasional

| No | Aturan di sistem lama | Sumber | Keputusan |
|---|---|---|---|
| KEH-C32 | Kalender Libur bisa dibuka semua orang dan menampilkan **nama semua orang dari semua cabang** yang libur, cuti, izin, atau **sakit**. | `kalender-libur`, `get_universal_dayoff_calendar` | |
| KEH-C33 | Pemilik dan HR bisa menambah dan menghapus "hari libur nasional / toko tutup". Isinya kosong, dan **tidak berpengaruh ke apa pun**: tidak ke absen, tidak ke gaji. Hanya tulisan di kalender. | `kalender-libur`, `company_holidays` | |

## 2C.4 Menu di sistem lama

| Menu | Dipakai untuk apa | Mirip dengan menu lain? |
|---|---|---|
| Portal → Ajukan Libur | Karyawan memilih 4 tanggal libur | Ya: sama-sama "minta tidak masuk" dengan Cuti & Izin |
| Portal → Ganti Libur | Pindah atau tukar libur | Ya, dengan Ajukan Libur dan dengan "masuk di hari libur" di layar absen |
| Layar absen (hari libur) | Pilih tanggal pengganti | Jalur ketiga untuk memindah libur, tanpa aturan |
| Absensi → Persetujuan Libur | Kantor memutuskan libur dan ganti libur (dua tab, kalender dan daftar) | Ya, dengan daftar di Cuti & Izin |
| Absensi → Kalender Libur | Siapa tidak masuk; libur nasional; peringatan jatah belum diambil | Kalender yang sama muncul lagi di Ajukan Libur dan Persetujuan Libur |
| Cuti & Izin | Daftar pengajuan dan tombol setuju atau tolak | Persetujuan kedua, terpisah dari Persetujuan Libur |
| Cuti & Izin → Ajukan | Formulir cuti, izin, sakit | |

## 2C.5 Tumpang tindih

1. **Lima jalan untuk "tidak masuk":** Ajukan Libur, Ganti Libur, masuk di hari
   libur, Cuti & Izin, dan klarifikasi alpha (2D). Tiap jalan punya aturan,
   batas waktu, dan penyetuju sendiri. Jalan yang paling longgar (KEH-C16)
   membuat aturan jalan lain tidak berarti.
2. **Libur dipilih dengan teliti tetapi tidak dipakai gaji** (KEH-C09). Yang
   menentukan gaji hanya jumlah hari kosong. Jadwal libur dan gaji adalah dua
   catatan yang tidak saling tahu.
3. **Angka 4 ditulis di tiga tempat:** halaman Ajukan Libur, aturan akses
   database, dan rumus gaji. Batas 1 akhir pekan dan jarak 5 hari hanya ada di
   halaman.
4. **H-2 ditulis empat kali** dengan arti berbeda: di formulir cuti (dari hari
   ini), di daftar cuti (dari saat diajukan), di database saat menyetujui, dan
   di Ganti Libur (dari tanggal terdekat).
5. **Cuti tahunan dan libur rutin memakai jatah yang sama di gaji** (KEH-C20),
   padahal di layar tampil sebagai dua hak yang berbeda (12 hari setahun dan 4
   hari sebulan).
6. **Status tidak masuk bisa ditulis dari tiga pintu:** persetujuan cuti,
   klarifikasi, dan isian tangan kantor. Dari data, pintu resmi (Cuti & Izin)
   justru yang paling jarang dipakai.
7. **Dua layar persetujuan** (Persetujuan Libur dan Cuti & Izin) dengan aturan
   berbeda: satu wajib alasan saat menolak, satu tidak.

## 2C.6 Kejadian di lapangan dan jalan keluarnya

| Kejadian | Di sistem lama | Ada jalan keluar? |
|---|---|---|
| Salah pilih tanggal libur, belum diputuskan | Klik lagi, baris dihapus | Ada, tetapi tanpa jejak |
| Salah pilih tanggal libur, sudah disetujui | Ganti Libur, paling lambat H-2 | Ada. Di bawah H-2 tidak ada, kecuali datang di hari libur (KEH-C16) |
| Lupa memilih libur sampai periode berjalan | Dipaksa melengkapi, denda Rp10.000 per tanggal | Ada, berbayar |
| Teman tidak menjawab ajakan tukar | Menggantung | Tidak ada batas waktu; pengaju harus membatalkan sendiri |
| Diminta masuk pada hari libur karena toko kekurangan orang | Pilih tanggal pengganti sendiri | Ada, tetapi tidak tercatat siapa yang meminta |
| Cuti atau izin sudah disetujui, lalu batal pergi | Terkunci | **Tidak ada.** Kalau ia datang dan absen, statusnya tertimpa hadir, tetapi pengajuannya tetap "disetujui" |
| Kantor salah menyetujui atau salah menolak | Tidak bisa diubah | **Tidak ada** |
| Sakit mendadak pagi hari | Ajukan sakit (tidak kena H-2) | Ada |
| Sakit 3 hari tanpa surat | Hari ke-3 otomatis alpha | Lampirkan surat lewat klarifikasi alpha (2D) |
| Izin diajukan sesudah harinya lewat | Jenis "izin mendadak" | Ada, potongan lebih berat |
| Toko tutup satu hari (misalnya Lebaran) | Tidak ada pengaruh di sistem | **Tidak ada.** Hari itu terhitung hari kosong tiap orang dan memakan jatah liburnya |
| Karyawan baru masuk di tengah periode | Jatah libur dikecilkan sebanding di gaji; di Ajukan Libur tetap 4 | Angka di layar dan di gaji tidak sama |

## 2C.7 Pertanyaan untuk pemilik

Diajukan di percakapan pada 11 Oktober 2026. Jawaban dicatat di 2C.9.

Butuh pandangan pemilik:

1. Jadwal libur dan jatah 4 hari: mana yang menjadi pegangan? (KEH-C09)
2. Cuti tahunan 12 hari: dibawa, dan kalau dibawa terpisah dari jatah 4 hari atau tidak?
3. Jenis izin mana yang dibawa, dan apakah izin duka diperlakukan sama dengan izin biasa?
4. Toko tutup dan hari besar: pernah terjadi atau tidak, dan hari itu dihitung apa?
5. Masuk di hari libur: siapa yang boleh memutuskan, dan libur penggantinya bagaimana?
6. Siapa yang menyetujui libur dan izin: tetap hanya pemilik dan HR, atau kepala cabang ikut?
7. Libur driver, kenek, dan orang gudang: ikut aturan 4 hari yang sama atau berbeda?

Cukup setuju atau tidak: usulan W1 s.d. W13 di bawah.

## 2C.8 Usulan untuk v3 (belum disetujui)

| No | Usulan | Turunan dari |
|---|---|---|
| W1 | **Satu menu "Ajukan Tidak Masuk"** untuk karyawan (libur, tukar libur, tukar shift, izin, sakit, cuti) dan **satu menu persetujuan** untuk atasan. Menggantikan lima jalan di 2C.5. | PRI-23, 2A.10 aturan 5 |
| W2 | Semua angka (jatah libur, batas akhir pekan, batas orang libur per hari, jarak antar libur, H-2, batas sakit tanpa surat) menjadi **pengaturan bertanggal berlaku**, diperiksa server di satu tempat. | WAJ-04, WAJ-07 |
| W3 | Batas "paling banyak sekian orang libur per hari" dihitung **per cabang**, angkanya diatur per cabang. | KEH-C03 |
| W4 | Membatalkan tidak menghapus: pengajuan menjadi "dibatalkan" dan tetap terlihat. | PRI-02 |
| W5 | Pengajuan yang **sudah disetujui** bisa dibatalkan selama tanggalnya belum lewat: karyawan meminta, atasan mengesahkan. Atasan juga bisa mencabut persetujuannya dengan alasan. | WAJ-11, KEH-C29 |
| W6 | Menolak selalu wajib alasan, untuk semua jenis. | KEH-C28 |
| W7 | Hari izin, sakit, dan cuti dihitung **hanya pada hari kerja** orang itu. Hari libur terjadwal di tengahnya tetap libur. | KEH-C25 |
| W8 | Surat dokter disimpan tertutup. Kalender untuk karyawan hanya menulis "tidak masuk", tanpa menyebut sakit atau izin; rinciannya hanya untuk atasan dan HR. | PRI-23, KEH-C30, KEH-C32 |
| W9 | Ajakan tukar yang ditolak teman, atau tidak dijawab sampai batas H-2, **batal otomatis**; pengaju diberi tahu dan bisa mengajukan izin biasa. | 2A.10 terbuka 1 |
| W10 | H-2 dihitung dari saat **teman menerima**, karena saat itulah jadwal berubah. | 2A.10 terbuka 2 |
| W11 | Kepala cabang dan HR boleh mengubah shift atau libur seseorang **langsung** untuk keadaan mendadak, dengan alasan wajib; orang yang diubah diberi tahu dan perubahannya tercatat. | 2A.10 terbuka 3 |
| W12 | Yang diberi tahu soal tukar: kepala cabang orang itu dan HR. Jumlah tukar tidak dibatasi dulu, tetapi jumlahnya per orang per periode ditampilkan ke atasan. | 2A.10 terbuka 4 dan 5 |
| W13 | Cabang satu shift tidak digilir. Cabang dengan jumlah orang ganjil: kelompok pagi dan kelompok siang diisi sekali oleh kepala cabang, lalu kedua kelompok bertukar tiap Senin. | 2A.10 terbuka 6 |

Titipan untuk Bab 3 (Gaji), tidak ditanyakan sekarang: tingkat potongan izin,
alpha, izin mendadak, dan sakit dengan surat; kompensasi libur yang tidak
diambil; denda Rp10.000 memilih libur terlambat; jatah libur orang yang masuk di
tengah periode.

Titipan untuk 2D: klarifikasi alpha "pakai jatah libur", dan melampirkan surat
dokter sesudah hari sakitnya lewat.

## 2C.9 Jawaban pemilik (11 Oktober 2026)

| Butir | Jawaban pemilik | Akibat untuk v3 |
|---|---|---|
| T1 jadwal atau jumlah | **Jadwal libur yang jadi pegangan.** Libur hanya 4 hari dalam satu periode gaji. Pemilik ingin **memaksa semua orang punya jadwal libur**. Tidak hadir di luar jadwal libur dianggap alpha. | Mengganti KEH-C09 dan KEH-C10: gaji membaca jadwal libur; izin dan sakit tidak lagi "mengisi jatah". Dibaca Claude: alpha kalau tidak ada pengajuan izin, sakit, atau cuti yang disetujui untuk hari itu. **Menunggu kepastian** siapa yang dikecualikan (K1) dan nasib orang yang belum memilih (K2) |
| T2 cuti tahunan | **Ada.** Harus diajukan dulu. **10 hari setahun** (bukan 12). | Mengganti angka KEH-C19. **Menunggu kepastian** (K3): terpisah dari 4 hari libur dan dibayar, syarat masa kerja, dan cara menghitung tahunnya |
| T3 jenis izin | Bawa semua. Izin duka: saat diajukan muncul pilihan **ayah atau ibu meninggal**, dan itu otomatis **bebas 2 hari, tetap dibayar**. | Mengganti KEH-C24. **Menunggu kepastian** (K6): suami, istri, dan anak |
| T4 toko tutup dan hari besar | **Belum ditetapkan.** | Tetap terbuka. Rancangan tidak boleh menutup jalan untuk "hari tutup per cabang" |
| T5 masuk di hari libur | Setuju saran. | Mengganti KEH-C16 dan C17 |
| T6 siapa menyetujui | **HR dan pemilik** yang menentukan. | Sama dengan KEH-C05 dan C26; saran Claude (kepala cabang) tidak dipakai. **Menunggu kepastian** (K5) batasnya dengan W11 dan T5 |
| T7 driver, kenek, gudang | Ikuti saran. | Orang yang dibayar per ritase tidak punya jatah libur; orang gudang bergaji bulanan ikut aturan 4 hari |
| W1 satu menu | Ok | |
| W2 angka jadi pengaturan | Ok | |
| W3 batas orang libur per hari | **Diubah pemilik:** dibuat mesin dengan aturan sederhana. Di cabang yang sama **paling banyak 2 orang** libur pada hari yang sama (3 orang tidak bisa). Kalau cabang itu hanya berisi 2 orang, sehari hanya boleh 1. | Mengganti KEH-C03 (3 orang seluruh perusahaan). Angkanya disimpan sebagai pengaturan (W2, WAJ-05), diperiksa server. **Menunggu kepastian** (K7): cabang berisi 1 orang |
| W4 batal tidak menghapus | Ok | |
| W5 batalkan yang sudah disetujui | Ok | |
| W6 menolak wajib alasan | Ok | |
| W7 hanya hari kerja | Ok | |
| W8 surat tertutup, kalender tanpa rincian | Ok | |
| W9 tukar batal otomatis | Ok. Pemilik: "makanya perlu komunikasi." | |
| W10 H-2 dari saat teman menerima | Ok | |
| W11 perubahan mendadak oleh kepala cabang dan HR | Ok | |
| W12 siapa diberi tahu soal tukar | **Diubah pemilik:** cukup bisa dilihat dan ada laporannya. | Tidak ada pemberitahuan. Bersinggungan dengan 2A.10 aturan 7 ("atasan cukup diberi tahu"). **Menunggu kepastian** (K4) |
| W13 giliran cabang ganjil dan satu shift | Ok | |

Pesan pemilik: jangan lupa aturan dasar saat mencatat.

### Butir yang menunggu kepastian (diajukan di percakapan)

| No | Yang perlu dipastikan | Bertemu dengan | Saran Claude |
|---|---|---|---|
| K1 | "Semua orang wajib punya jadwal libur": apakah dua kelompok ini dikecualikan? Orang yang dibayar per ritase (jawaban T7), dan jabatan yang liburnya tidak tetap, misalnya kepala gudang (PRI-18). | T7, PRI-18 | Dikecualikan. Wajib jadwal berlaku untuk jabatan yang liburnya tetap |
| K2 | Orang yang sampai batas waktu belum memilih libur. | KEH-C06 | Batas memilih 3 hari sebelum periode mulai (tanggal 23). Yang belum memilih, liburnya diisi HR. Denda dibahas di Bab 3 |
| K3 | Cuti tahunan 10 hari: terpisah dari 4 hari libur dan tetap dibayar? Syarat masa kerja 1 tahun dan hitungan per tahun masa kerja dibawa? H-2 berlaku? | KEH-C19, C20, C21 | Terpisah dan dibayar; baru boleh setelah 1 tahun; dihitung dari tanggal masuk; H-2 berlaku |
| K4 | Soal tukar, "cukup lihat dan ada laporan" berarti atasan **tidak** dikirimi pemberitahuan. Ini mengganti 2A.10 aturan 7. | 2A.10 aturan 7 | Jenis: pengganti. Aturan 7 ditulis ulang |
| K5 | "HR dan pemilik yang menentukan" dibaca: semua **pengajuan** diputuskan HR atau pemilik. Kepala cabang hanya boleh dua hal: meminta orang masuk di hari libur (T5) dan mengubah shift atau libur saat mendadak (W11). | T5, W11 | Dibaca begitu. Keduanya tercatat dan terlihat HR |
| K6 | Izin duka bebas 2 hari: hanya ayah dan ibu, atau juga suami, istri, dan anak? | KEH-C24 | Ditambah suami, istri, dan anak. Keluarga lain memakai izin biasa |
| K7 | Cabang yang isinya 1 orang: bolehkah libur, dan siapa menggantikan? | W3 | Boleh libur hanya kalau HR sudah menunjuk pengganti (perbantuan) untuk hari itu |

### Jawaban pemilik atas K1 s.d. K7 (11 Oktober 2026)

| No | Jawaban pemilik | Akibat |
|---|---|---|
| K1 | Ok | Orang yang dibayar per ritase dan jabatan yang liburnya tidak tetap (PRI-18) dikecualikan dari wajib jadwal libur |
| K2 | **Tidak usah diisi HR.** Orang yang tidak memilih libur kena denda. | Saran Claude (diisi HR) tidak dipakai. Batas memilih: sebelum periode mulai. Nominal dan cara denda dirinci di Bab 3. Akibat yang perlu diketahui: selama belum punya jadwal, tiap hari tidak masuk tanpa izin dicatat alpha (aturan 2) |
| K3 | Cuti diajukan paling lambat **H-7**, dan **terpisah dari libur**. | H-7 mengganti H-2 untuk cuti tahunan. Pemilik tidak menyebut tiga hal: dibayar atau tidak, syarat masa kerja 1 tahun, dan tahun dihitung dari tanggal masuk. Ketiganya **belum diputuskan**, ditanyakan lagi |
| K4 | Ok | Jenis: pengganti. 2A.10 aturan 7 sudah ditulis ulang |
| K5 | Ok | Pengajuan diputuskan HR dan pemilik. Kepala cabang hanya meminta orang masuk di hari libur dan mengubah shift atau libur saat mendadak |
| K6 | Ya, tambahkan | Izin duka bebas 2 hari berlaku untuk ayah, ibu, suami, istri, dan anak |
| K7 | Tidak masalah; sudah ada jalan keluarnya, jadi ia tetap bisa libur. | Cabang berisi 1 orang boleh libur tanpa syarat tambahan. Dibaca Claude: jalan keluarnya perbantuan dari cabang lain dan perubahan mendadak oleh kepala cabang atau HR (aturan 16) |

## 2C.10 Aturan yang dihasilkan (nomor v3 ditetapkan di 2E)

Jenis tiap aturan menurut WAJ-12 ditulis di belakangnya.

Libur rutin:

1. Tiap orang punya **4 hari libur per periode** (26 sampai 25), dan tanggalnya
   **wajib dipilih sendiri** sebelum periode mulai. Yang tidak memilih kena
   denda (nominal di Bab 3); liburnya tidak diisikan oleh HR. Tidak berlaku
   untuk jabatan yang liburnya tidak tetap (PRI-18). (pengganti KEH-C01 dan C06)
2. **Jadwal libur adalah pegangan.** Tidak hadir pada hari yang bukan libur dan
   tanpa izin, sakit, atau cuti yang disetujui dicatat alpha. Izin dan sakit
   tidak lagi mengisi jatah libur. (pengganti KEH-C09 dan C10)
3. Di cabang yang sama paling banyak **2 orang** libur pada hari yang sama. Cabang
   berisi 2 orang: paling banyak 1. Cabang berisi 1 orang tetap boleh libur.
   Diperiksa server; angkanya pengaturan bertanggal berlaku. (pengganti KEH-C03)
4. Batas lain dari sistem lama (paling banyak 1 akhir pekan, jarak 5 hari)
   dibawa sebagai pengaturan bertanggal berlaku, diperiksa server di tempat yang
   sama. (W2)
5. Orang yang dibayar per ritase tidak punya jatah libur; ia memberi tahu hari
   tidak bisa jalan. (pengecualian dari aturan 1)

Mengajukan dan memutuskan:

6. Satu menu "Ajukan Tidak Masuk" untuk karyawan: libur, tukar libur, tukar
   shift, izin, sakit, cuti. Satu menu persetujuan. (pengganti lima jalan di 2C.5)
7. Yang memutuskan pengajuan: **HR dan pemilik**. Kepala cabang tidak memutuskan
   pengajuan; wewenangnya hanya aturan 16 dan 18.
8. Menolak selalu wajib alasan.
9. Membatalkan tidak menghapus; pengajuan menjadi "dibatalkan".
10. Pengajuan yang sudah disetujui bisa dibatalkan selama tanggalnya belum lewat:
    karyawan meminta, HR atau pemilik mengesahkan. HR atau pemilik juga bisa
    mencabut persetujuan dengan alasan. (pengganti KEH-C29)
11. Hari izin, sakit, dan cuti dihitung hanya pada hari kerja orang itu.
    (pengganti KEH-C25)
12. Surat dokter disimpan tertutup. Kalender untuk karyawan hanya menulis "tidak
    masuk"; rinciannya hanya untuk atasan dan HR. (pengganti KEH-C30 dan C32)

Tukar dan perubahan mendadak (melengkapi 2A.10):

13. Ajakan tukar yang ditolak teman, atau tidak dijawab sampai batas H-2, batal
    otomatis. Pengaju diberi tahu dan bisa mengajukan izin biasa.
14. H-2 dihitung dari saat teman menerima.
15. Tukar tidak dikirim sebagai pemberitahuan ke atasan. Atasan dan HR bisa
    melihatnya, dan ada laporan jumlah tukar per orang per periode. Jumlah tukar
    tidak dibatasi. (pengganti 2A.10 aturan 7)
16. Kepala cabang dan HR boleh mengubah shift atau libur seseorang langsung saat
    keadaan mendadak: alasan wajib, orangnya diberi tahu, perubahan tercatat.
17. Cabang satu shift tidak digilir. Cabang berjumlah ganjil: dua kelompok diisi
    sekali oleh kepala cabang, lalu bertukar tiap Senin.
18. **Masuk di hari libur** hanya kalau diminta kepala cabang atau HR, dan
    permintaannya tercatat. Libur pengganti dipilih karyawan dan tetap diperiksa
    aturan 3. Datang sendiri tanpa diminta tidak memindah libur. (pengganti
    KEH-C16 dan C17, menjawab KEH-B15)

Cuti, izin, sakit:

19. Jenis yang dibawa: cuti tahunan, sakit tanpa surat, sakit dengan surat
    dokter, izin keperluan, izin duka, izin mendadak.
20. **Cuti tahunan 10 hari setahun**, terpisah dari 4 hari libur, diajukan paling
    lambat **H-7**. (pengganti KEH-C19, C20, dan C21 untuk cuti) Belum
    diputuskan: dibayar atau tidak, syarat masa kerja, dan cara menghitung tahunnya.
21. **Izin duka** karena ayah, ibu, suami, istri, atau anak meninggal: dipilih
    saat mengajukan, otomatis bebas **2 hari dan tetap dibayar**. Keluarga lain
    memakai izin biasa. (pengganti KEH-C24)
22. Sakit tanpa surat paling lama 2 hari berturut-turut dan H-2 untuk izin
    keperluan dibawa sebagai pengaturan bertanggal berlaku (W2). Akibat uangnya
    dirinci di Bab 3.

### Yang masih terbuka

1. Toko tutup dan hari besar: belum ditetapkan pemilik (T4).
2. Cuti tahunan: dibayar atau tidak, syarat masa kerja 1 tahun, dan tahun
   dihitung dari tanggal masuk atau dari Januari (sisa K3).
3. "Kompensasi libur" sebagai pengaturan jabatan (KAR-62): karena libur kini
   wajib terjadwal 4 hari, di Bab 3 diputuskan apakah kompensasi masih ada.
4. PRI-18 menyebut "libur tetap atau tidak tetap" per jabatan: dirapikan di 2E
   setelah K1 dijawab.

---

# Bagian 2D: Klarifikasi, lembur, rekap, dan batas waktu pengajuan

Digali 11 Oktober 2026 dari `lib/alphaDetection.ts`, `lib/checkoutClarification.ts`,
`lib/lateClarification.ts`, `lib/overtimeClaim.ts`, `lib/longAbsenceDeactivation.ts`,
`components/AlphaKlarifikasiPanel.tsx`, `components/OvertimeKlaimPanel.tsx`,
`app/(dashboard)/portal/page.tsx`, `portal/absensi`, `absensi/rekap`,
`penggajian/bulanan`, dan database (sepuluh fungsi `submit_*`, `review_*`,
`detect_unexplained_absences`, `auto_deactivate_long_absence`; empat tabel
klarifikasi dan kebijakan aksesnya; jadwal otomatis `cron`).

## 2D.1 Bagian ini mengurus apa

Cara karyawan menjelaskan catatan absen yang bermasalah (tidak absen sama sekali,
lupa absen pulang, telat lebih dari 30 menit), cara lembur diakui sampai boleh
dibayar, angka ringkasan (rekap) yang dilihat karyawan dan kantor, dan batas waktu
tiap pengajuan itu. Hasil semua keputusan di sini langsung menjadi potongan,
denda, atau tambahan di slip gaji.

## 2D.2 Data di sistem lama (dicek ke database)

| Data | Isinya | Tabel | Jumlah baris |
|---|---|---|---|
| Klarifikasi alpha | Permintaan mengubah alpha menjadi sakit, lupa absen, atau hadir | `alpha_clarifications` | 91, semuanya dalam 30 hari terakhir |
| Klarifikasi lupa absen pulang | Alasan saja, tanpa jam pulang | `checkout_clarifications` | 7 |
| Klarifikasi telat di atas 30 menit | Alasan dan menit telat aslinya | `late_clarifications` | 4 |
| Klaim lembur | Foto kertas lembur dan jam yang terdeteksi | `overtime_claims` | 68 |
| Tanda di absen | "ditandai otomatis", denda administrasi, lembur disahkan, jam lembur yang disesuaikan | kolom di `attendances` | |

Hasil keputusan (hanya dihitung, isinya tidak dibuka):

| Jenis | Disetujui | Ditolak | Menunggu |
|---|---|---|---|
| Klarifikasi alpha | **91** (sakit tanpa surat 47, libur 20, lupa absen masuk 19, sakit dengan surat 2, hadir 2, izin 1) | **0** | 0 |
| Lupa absen pulang | 5 | 1 | 1 |
| Telat di atas 30 menit | 2 | 1 | 1 |
| Klaim lembur | **68** | **0** | 0 |

Angka lain:

| Kejadian | Jumlah |
|---|---|
| Hari yang ditandai alpha otomatis (seluruh data) | 186; masih alpha 33, sudah berubah status 153 |
| Absen dengan lembur terdeteksi, 30 hari terakhir | 79; yang disahkan 41 |
| Absen tanpa jam pulang, 30 hari terakhir (saat dicek) | 18; yang diklarifikasi 7 |
| Telat di atas 30 menit, 30 hari terakhir | 6; yang dijelaskan 4 |
| Rata-rata waktu dari pengajuan sampai diputuskan | kurang dari setengah hari |
| Baris absen yang membawa denda administrasi | **5**, padahal klarifikasi berdenda yang disetujui 24 (19 lupa masuk + 5 lupa pulang). Sebabnya belum diketahui (perlu dicek di Bab 3) |
| Karyawan yang pernah dinonaktifkan otomatis | 0 |
| **Penanda alpha otomatis harian** | **Gagal setiap hari, 13 kali berturut-turut sampai 11 Oktober 2026**: ada dua fungsi bernama sama sehingga database menolak memilih. Pemicu dari halaman Rekap memanggil nama yang sama dan menelan errornya (yang ini tidak bisa dipastikan tanpa menjalankannya) |

## 2D.3 Aturan yang ditemukan

### Alpha dan klarifikasinya

| No | Aturan di sistem lama | Sumber | Keputusan |
|---|---|---|---|
| KEH-D01 | Hari yang sudah lewat, tanpa catatan absen, bukan hari libur terjadwal, bukan libur perusahaan, dan tanpa pengajuan cuti (menunggu atau disetujui) ditandai **alpha otomatis**. | `detect_unexplained_absences` | |
| KEH-D02 | Yang tidak pernah ditandai: gaji tetap (flat), jabatan bernama "Owner", jabatan "Helper" di cabang "Gudang", dan jenis karyawan selain tetap dan training. Nama-nama itu ditulis di rumus. | sama | Bertentangan dengan WAJ-05 |
| KEH-D03 | Penandaan dijalankan dua jalan: jadwal otomatis tiap pagi, dan saat HR atau pemilik membuka Rekap (sekali sehari per browser). Jadwal otomatisnya kini gagal; kegagalan tidak terlihat siapa pun. | `cron`, `lib/alphaDetection.ts` | |
| KEH-D04 | Karyawan boleh mengklarifikasi alpha paling lambat **2 hari** setelah tanggalnya. Lewat itu alpha tetap dan tidak ada jalan lain di menu ini. | `submit_alpha_clarification` | |
| KEH-D05 | Pilihan klarifikasi: sakit tanpa surat, sakit dengan surat (foto wajib), lupa absen masuk. Izin tidak lewat sini, melainkan "Izin Mendadak" di menu cuti yang boleh bertanggal mundur. | sama, `AlphaKlarifikasiPanel` | |
| KEH-D06 | Pilihan "pakai jatah libur" dan "izin" pernah ada (21 kali dipakai) lalu dicabut. | data, panduan | Titipan 2C |
| KEH-D07 | Lupa absen masuk yang disetujui: dianggap hadir, **denda Rp15.000**, paling banyak **4 kali per periode**. Jam masuk dan pulang tetap kosong. Setelah 4 kali, sistem menyuruh mengajukan sebagai sakit atau izin mendadak. | `review_alpha_clarification` | Nominal: Bab 3 |
| KEH-D08 | Pengajuan cuti yang masih menunggu melindungi tanggalnya dari tanda alpha. Kalau kemudian ditolak, tanggal itu baru ditandai belakangan, saat batas 2 hari sudah lewat. | `detect_unexplained_absences` | |
| KEH-D09 | Tanggal 26 Agustus sampai 25 September 2026 bebas batas waktu, dan sampai 17 September ada pilihan "Saya Hadir" tanpa denda. Tanggalnya ditulis di kode **dan** di database, dengan pesan "harus selalu sama persis". | `lib/alphaDetection.ts`, RPC | |
| KEH-D10 | Rangkaian sakit tanpa surat, izin, atau alpha lebih dari 7 hari berturut-turut: karyawan dan akunnya **dinonaktifkan otomatis**. Hanya berjalan kalau HR atau pemilik membuka Rekap. Belum pernah terjadi. | `auto_deactivate_long_absence` | |

### Lupa absen pulang dan telat

| No | Aturan di sistem lama | Sumber | Keputusan |
|---|---|---|---|
| KEH-D11 | Lupa absen pulang diajukan mulai hari berikutnya, dengan alasan saja. Tidak ada batas waktu; yang tampil hanya 14 hari terakhir. | `submit_checkout_clarification`, `lib/checkoutClarification.ts` | |
| KEH-D12 | Disetujui: **denda Rp5.000**, paling banyak 4 kali per periode (terpisah dari kuota lupa masuk). **Jam pulang tetap kosong**, sehingga hari itu tidak pernah punya lembur dan tetap tampil sebagai "belum ada jam pulang". | `review_checkout_clarification` | Sudah diganti 2B.10 aturan 9 |
| KEH-D13 | Telat lebih dari 30 menit "wajib" dijelaskan, tetapi tidak ada batas waktu dan tidak ada akibat kalau tidak dijelaskan. | `lib/lateClarification.ts` | |
| KEH-D14 | Penjelasan telat yang disetujui **menghapus menit telat di catatan absen menjadi 0**. Angka aslinya hanya tersisa di tabel klarifikasi. | `review_late_clarification` | Bertentangan dengan 2B.10 (telat tetap tampil) |
| KEH-D15 | Angka 30 menit, 14 hari, 4 kali, Rp15.000, dan Rp5.000 ditulis di kode dan di rumus database. | beberapa file | Bertentangan dengan WAJ-07 |

### Lembur

| No | Aturan di sistem lama | Sumber | Keputusan |
|---|---|---|---|
| KEH-D16 | Lembur yang terdeteksi tidak dibayar sampai diklaim dengan foto kertas lembur bertanda tangan, paling lambat 3 hari. | `submit_overtime_claim` | Batas 3 hari: PRI-09 |
| KEH-D17 | Hanya **pemilik** yang bisa menyetujui atau menolak klaim. HR hanya melihat. | `review_overtime_claim` | |
| KEH-D18 | Menyetujui klaim tidak bisa mengubah jamnya: yang dipakai jam yang terdeteksi. | sama | |
| KEH-D19 | Saat slip gaji dibuat, HR atau Finance mendapat daftar centang lembur yang sudah disahkan dan bisa **menghapus centang atau mengubah jamnya**. Hasilnya menimpa tanda "disahkan" di absen; klaimnya sendiri tetap tertulis "disetujui". | `penggajian/bulanan` | |
| KEH-D20 | Klaim yang ditolak boleh diajukan lagi selama belum lewat batas. | `OvertimeKlaimPanel` | |
| KEH-D21 | Pengecualian batas klaim untuk 26 Agustus sampai 25 September 2026, ditulis di kode dan di database. | `lib/overtimeClaim.ts`, RPC | Sudah dicatat PRI-09 |

### Memutuskan dan rekap

| No | Aturan di sistem lama | Sumber | Keputusan |
|---|---|---|---|
| KEH-D22 | Klarifikasi alpha, lupa pulang, dan telat diputuskan HR atau pemilik. Kepala cabang tidak terlibat dan tidak bisa melihatnya. | RPC, kebijakan akses | |
| KEH-D23 | Alasan menolak **tidak wajib** ("opsional, untuk arsip"). | `absensi/rekap` | Sudah diganti 2C.10 aturan 8 |
| KEH-D24 | Keputusan yang sudah diambil tidak bisa dicabut. Satu-satunya jalan adalah mengubah catatan absen dengan tangan. | RPC | Bertentangan dengan WAJ-11 |
| KEH-D25 | Menyetujui klarifikasi menimpa status dan catatan absen; status asal tidak disimpan di absen. | RPC | Bertentangan dengan PRI-02 |
| KEH-D26 | Tidak ada pemberitahuan. Karyawan tahu ada yang harus dijelaskan hanya kalau membuka Portal; kantor tahu ada pengajuan baru hanya kalau membuka Rekap dan menekan "Refresh Klarifikasi". | `portal/page.tsx`, `absensi/rekap` | |
| KEH-D27 | Rekap kantor: jumlah hadir, alpha, sakit, izin, libur, total menit telat, total jam lembur per periode 26–25. Hari kosong dihitung sendiri oleh halaman: 4 pertama "libur", sisanya "izin". | `absensi/rekap` | Hari kosong: sudah diganti 2C.10 aturan 2 |
| KEH-D28 | "Total lembur" di rekap kantor dan rekap karyawan adalah lembur **terdeteksi**, bukan yang disahkan. Perkiraan pendapatan di Portal memakai klaim yang disetujui; slip memakai tanda di absen. | `absensi/rekap`, `portal/absensi`, `portal/page.tsx` | |
| KEH-D29 | Rekap dibaca pemilik, HR, dan Finance; supervisor membaca absen cabangnya; karyawan membaca miliknya. | kebijakan akses | |

## 2D.4 Menu di sistem lama

| Menu | Dipakai untuk apa | Mirip dengan menu lain? |
|---|---|---|
| Portal (beranda) | Kartu peringatan alpha, lembur, lupa pulang, telat; formulir lupa pulang dan telat | Ya, dengan dua menu di bawah |
| Portal → Klarifikasi Alpha | Formulir klarifikasi alpha | Komponen yang sama dengan kartu di beranda |
| Portal → Klaim Lembur | Unggah foto kertas lembur | Sama |
| Portal → Absensi | Rekap milik sendiri | Rumusnya ditulis ulang di halaman ini |
| Cuti → Ajukan (Izin Mendadak) | Jalan memperbaiki alpha yang bukan sakit | Jalan kedua untuk urusan yang sama |
| Absensi → Rekap | Empat kotak persetujuan di atas tabel rekap, ditambah daftar "belum ada jam pulang" | Persetujuan libur dan cuti ada di dua menu lain |
| Penggajian → buat slip | Centang ulang lembur | Persetujuan lembur kedua |

## 2D.5 Tumpang tindih

1. **Empat tabel, delapan fungsi, empat kotak persetujuan** untuk satu pola yang
   sama: karyawan menjelaskan, kantor memutuskan.
2. **Lembur disahkan dua kali** (pemilik di Rekap, lalu centang saat slip dibuat),
   dan "lembur yang dibayar" punya tiga sumber: klaim, tanda di absen, dan angka
   terdeteksi.
3. **Alpha bisa diperbaiki lewat dua pintu** (klarifikasi alpha dan Izin Mendadak)
   dengan batas waktu berbeda: yang satu 2 hari, yang lain boleh mundur.
4. **Batas waktu dan pengecualian periode ditulis dua kali**, di kode dan database.
5. **Rekap dihitung di tiga halaman** dengan rumus masing-masing.
6. **Meniadakan potongan telat punya dua cara:** klarifikasi yang menghapus menitnya
   (sistem lama) dan saklar per slip (keputusan 2B.10).

## 2D.6 Kejadian di lapangan dan jalan keluarnya

| Kejadian | Di sistem lama | Ada jalan keluar? |
|---|---|---|
| Penanda alpha tidak berjalan | Tidak ada yang tahu; hari kosong dihitung libur lalu izin oleh gaji | Tidak ada tanda bahaya |
| Baru tahu kena alpha setelah 3 hari | Terkunci | Izin Mendadak bertanggal mundur, potongannya lebih berat |
| Lupa absen masuk kelima kalinya | Ditolak sistem | Disuruh mengaku sakit atau izin, padahal hadir |
| Lupa absen pulang, sebenarnya lembur | Jam pulang tetap kosong | Lemburnya hilang |
| Klarifikasi telanjur disetujui padahal salah | Tidak bisa dicabut | Ubah absen dengan tangan |
| Klaim lembur disetujui lalu centangnya dihapus saat buat slip | Tidak dibayar, klaim tetap "disetujui" | Karyawan tidak diberi tahu |
| Jam lembur terdeteksi salah | Pemilik tidak bisa mengubah saat menyetujui | Diubah nanti saat slip dibuat |
| Surat dokter baru ada setelah masuk kerja | Harus dalam 2 hari sejak tanggal alpha | Tidak ada; menjadi sakit tanpa surat |
| Cuti ditolak setelah tanggalnya lewat | Ditandai alpha, batas klarifikasi sudah lewat | Tidak ada |
| Pemilik sedang tidak bisa membuka sistem | Klaim lembur menumpuk | Tidak ada pengganti |

## 2D.7 Pertanyaan untuk pemilik

Diajukan di percakapan pada 11 Oktober 2026. Jawaban dicatat di 2D.9.

Butuh pandangan pemilik:

1. Siapa yang mengesahkan klarifikasi dan lembur? (2B.10 aturan 9 menulis
   "disahkan atasan", 2C.10 aturan 7 menulis "HR dan pemilik".)
2. Batas waktu dan akibat terlewat untuk tiap jenis: alpha, lupa absen masuk
   atau pulang, telat di atas 30 menit, surat dokter menyusul (PRI-08).
3. Denda lupa absen dan kuota 4 kali per periode: dibawa? Setelah kuota habis,
   apa akibatnya?
4. Kertas lembur bertanda tangan: masih dipakai, atau diganti persetujuan di sistem?
5. Tidak masuk lebih dari 7 hari berturut-turut: dinonaktifkan otomatis, atau
   hanya diberi tanda?

Cukup setuju atau tidak: usulan X1 s.d. X12 di bawah.

## 2D.8 Usulan untuk v3 (belum disetujui)

| No | Usulan | Turunan dari |
|---|---|---|
| X1 | Satu menu "Perlu Dijelaskan" untuk karyawan dan satu menu persetujuan untuk kantor, digabung dengan menu persetujuan 2C. Satu pola data untuk semua jenis klarifikasi. | 2D.5 butir 1, 2C.10 aturan 6 |
| X2 | Alpha ditandai server secara otomatis tiap hari, tidak bergantung pada siapa membuka halaman apa. Kalau gagal, pemilik diberi tahu (mesin pengaman error). | KEH-D03, WAJ-06 |
| X3 | Siapa yang ditandai alpha ditentukan pengaturan jabatan dan jenis upah, bukan nama jabatan atau cabang. | KEH-D02, WAJ-05, PRI-18 |
| X4 | Batas waktu, kuota, ambang 30 menit, dan nominal denda adalah pengaturan bertanggal berlaku. Pengecualian satu periode dicatat di Daftar Pengecualian, bukan di kode. | KEH-D09, D15, D21, WAJ-07 |
| X5 | Alpha hanya punya satu pintu perbaikan. Pilihannya: sakit tanpa surat, sakit dengan surat, lupa absen (sebenarnya hadir), izin mendadak. "Pakai jatah libur" tidak ada, karena jadwal libur sudah menjadi pegangan. | KEH-D05, D06, 2C.10 aturan 2 |
| X6 | Klarifikasi yang disetujui tidak menimpa catatan asli. Menit telat tetap tercatat; yang berubah adalah tanda "potongan diusulkan ditiadakan", yang muncul di slip dan disahkan sesuai 2B.10 aturan 12. | KEH-D14, D25, PRI-02 |
| X7 | Keputusan bisa dicabut dengan alasan selama slip periode itu belum ditutup. | KEH-D24, WAJ-11 |
| X8 | Slip seseorang tidak bisa ditutup selama masih ada klarifikasi atau klaim miliknya yang menunggu. | sama dengan aturan "di luar titik" di 2B |
| X9 | Lembur disahkan **satu kali**. Yang mengesahkan boleh mengubah jamnya dengan alasan. Saat slip dibuat tidak ada centang ulang; slip membaca hasil pengesahan itu saja. | KEH-D18, D19, WAJ-03 |
| X10 | Saat absen pulang melewati jam kerja, sistem langsung bertanya "ini lembur?". Sehari sebelum hangus, karyawan diingatkan. | PRI-07, KEH-D26 |
| X11 | Rekap dihitung di satu tempat di server; karyawan dan kantor melihat angka yang sama. Lembur ditampilkan tiga angka: terdeteksi, diklaim, disahkan. | KEH-D27, D28, WAJ-04 |
| X12 | Cuti atau izin yang ditolak setelah tanggalnya lewat: batas klarifikasi dihitung dari saat penolakan, bukan dari tanggalnya. | KEH-D08 |

## 2D.9 Jawaban pemilik (12 Oktober 2026)

| Butir | Jawaban pemilik | Akibat untuk v3 |
|---|---|---|
| T1 siapa yang mengesahkan | Semua klarifikasi **dan lembur** disahkan **pemilik dan HR**. "Atasan" di 2B.10 aturan 9 memang berarti dua pihak itu, karena di Hammielion yang bertindak sebagai atasan hanya pemilik dan HR. | Tidak ada tabrakan antara 2B.10 aturan 9 dan 2C.10 aturan 7; aturan 9 ditulis ulang supaya jelas. Lembur tidak lagi hanya pemilik (mengganti KEH-D17) |
| T2 batas waktu | Ok, semuanya **3 hari**, dengan akibat seperti tabel saran. | Lihat 2D.10 aturan 6 s.d. 10 |
| T3 denda dan kuota | Setuju saran. Mulai kejadian **ke-5** dalam satu periode dendanya **ditambah Rp5.000**, masing-masing (lupa masuk dan lupa pulang). | Kuota 4 kali tidak lagi menolak pengajuan. **Menunggu kepastian:** tambahan itu tetap Rp5.000, atau naik terus tiap kejadian |
| T4 kertas lembur | Kertas lampiran **tetap dipakai**. Ditambah: saat mengklaim, karyawan mengisi **siapa yang menyuruh** lembur, dengan memilih jabatan (HR, pemilik, atau jabatan lain yang diberi wewenang). | "Boleh menyuruh lembur" menjadi wewenang per jabatan. **Menunggu kepastian:** yang dipilih jabatannya atau orangnya |
| T5 tidak masuk lebih dari 7 hari | Ikut saran. | Tidak ada penonaktifan otomatis (mengganti KEH-D10) |
| X1 s.d. X12 | Ok semua. | |

## 2D.10 Aturan yang dihasilkan (nomor v3 ditetapkan di 2E)

Jenis tiap aturan menurut WAJ-12 ditulis di belakangnya.

Pola umum:

1. Karyawan punya satu menu "Perlu Dijelaskan"; kantor punya satu menu
   persetujuan, yang sama dengan menu persetujuan libur dan cuti. Semua jenis
   klarifikasi memakai satu pola data. (pengganti empat tabel dan empat kotak di
   2D.5 butir 1; melengkapi 2C.10 aturan 6)
2. Yang mengesahkan semua klarifikasi dan klaim lembur: **HR dan pemilik**. Kata
   "atasan" di buku aturan Kehadiran berarti dua pihak itu. Kepala cabang tidak
   mengesahkan. (pengganti KEH-D17; sejalan dengan 2C.10 aturan 7)
3. Klarifikasi yang disetujui tidak menimpa catatan asli. Status asal dan menit
   telat tetap tersimpan. (pengganti KEH-D14 dan D25)
4. Keputusan bisa dicabut dengan alasan selama slip periode itu belum ditutup.
   Menolak wajib alasan. (pengganti KEH-D23 dan D24)
5. Slip seseorang tidak bisa ditutup selama masih ada klarifikasi atau klaim
   miliknya yang menunggu. (pelapis; sama dengan aturan absen "di luar titik")

Batas waktu (PRI-08). Angka 3 hari adalah pengaturan bertanggal berlaku:

6. **Semua jenis klarifikasi dan klaim: paling lambat 3 hari** setelah
   tanggalnya. (pengganti KEH-D04, D11, D13)
7. Alpha yang tidak diklarifikasi dalam 3 hari **tetap alpha**.
8. Lupa absen masuk atau pulang yang lewat 3 hari masih bisa diajukan lewat
   **pengajuan terlambat**: wajib alasan, tercatat sebagai terlambat, disahkan
   HR atau pemilik.
9. Telat di atas 30 menit yang tidak dijelaskan dalam 3 hari: potongan tetap
   berlaku.
10. Surat dokter menyusul: paling lambat 3 hari **sejak masuk kerja kembali**.
    Lewat itu dicatat sakit tanpa surat. (menjawab titipan 2C)
11. Cuti atau izin yang ditolak setelah tanggalnya lewat: 3 hari dihitung dari
    saat penolakan. (pengganti KEH-D08)
12. Klaim lembur hangus setelah 3 hari, tanpa pengajuan terlambat. (tetap, PRI-09)

Alpha:

13. Alpha ditandai server secara otomatis tiap hari. Kalau penandaan gagal,
    pemilik diberi tahu. (pengganti KEH-D03)
14. Siapa yang ditandai alpha ditentukan pengaturan jabatan dan jenis upah, bukan
    nama jabatan atau cabang. (pengganti KEH-D02)
15. Alpha hanya punya satu pintu perbaikan, dengan pilihan: sakit tanpa surat,
    sakit dengan surat, lupa absen (sebenarnya hadir), izin mendadak. "Pakai
    jatah libur" tidak ada. (pengganti KEH-D05 dan D06; menjawab titipan 2C)
16. Tidak masuk lebih dari 7 hari berturut-turut (sakit tanpa surat, izin, atau
    alpha): HR dan pemilik **diberi tanda** pada hari ke-7. Tidak ada penonaktifan
    otomatis. (pengganti KEH-D10)
    **Catatan 12 Oktober 2026:** saat menyusun 2E ditemukan bahwa aturan ini
    bertabrakan dengan KAR-08 yang sudah ditetapkan (dinonaktifkan otomatis,
    dengan pemberitahuan sehari sebelumnya). Tabrakan ini belum disebut ke
    pemilik saat T5 ditanyakan. Diajukan lagi di percakapan. **Dijawab pemilik
    (2E, P1): aturan ini yang dipakai; KAR-08 ditulis ulang sebagai pengganti.**

---

# Bagian 2E: Penetapan

Buku aturan `../02-kehadiran.md` disusun 12 Oktober 2026 dari 2A.10, 2B.10,
2C.10, dan 2D.10. Empat pertanyaan diajukan di percakapan.

| Butir | Jawaban pemilik (12 Oktober 2026) | Akibat |
|---|---|---|
| P1 KAR-08 lawan 2D.10 aturan 16 | Ikuti saran | Tidak ada penonaktifan otomatis. KAR-08 ditulis ulang (pengganti, WAJ-12). Menjadi KEH-55 |
| P2 peninjau absen di luar titik | Ikuti saran | HR dan pemilik. Kepala cabang hanya melihat. Masuk KEH-14 |
| P3 toko tutup dan hari besar | Ok, ikuti | "Hari tutup" dipasang pemilik atau HR, per cabang atau semua cabang; tidak ada alpha dan jatah libur tidak berkurang. Menjadi KEH-79. Dibayar atau tidak: Bab 3 |
| P4 cuti tahunan | "Dari hari pertama dia terdaftar masuk (saya biasanya menulis kapan bergabungnya)." | Tahun cuti dihitung dari tanggal bergabung. Masuk KEH-48. Pemilik tidak menyebut dibayar atau tidak, syarat masa kerja, dan sisa cuti; ketiganya tetap terbuka (bagian 6 buku aturan) |

Jawaban lanjutan pemilik atas tiga rincian cuti tahunan (12 Oktober 2026):

| Butir | Jawaban pemilik, kata demi kata | Akibat |
|---|---|---|
| 1 dibayar atau tidak | "cuti tahunan tidak bisa di bayar atau di ganti uang ( kalau maksud anda apakah ketika dia ambil cuti , dan sistem detect, maka orang itu tetap di bayar kerja nya jika itu cuti tahunan )" | Pasti: sisa cuti tidak bisa diuangkan (masuk KEH-48). Dibaca Claude, **belum pasti**: hari cuti yang diambil tetap dibayar. Dipastikan di sesi berikutnya |
| 2 syarat masa kerja | "tidak wajib 1 tahun" | Tidak ada syarat masa kerja (masuk KEH-48; mengganti KEH-C20). Muncul pertanyaan baru: jatah orang baru langsung 10 hari atau bertahap |
| 3 sisa cuti | "hangus" | Masuk KEH-48 |

Diselesaikan tanpa pertanyaan: saklar "kena telat" tetap ada karena jabatan
Pemilik memakainya (KAR-59); "libur tetap atau tidak tetap" tetap pengaturan
jabatan (PRI-18, jawaban K1 di 2C).

**Buku aturan Kehadiran ditetapkan 12 Oktober 2026.**

Lupa absen:

17. Lupa absen masuk dan lupa absen pulang dikenai denda administrasi per
    kejadian. Mulai kejadian **ke-5** dalam satu periode, dendanya ditambah
    **Rp5.000**, dihitung terpisah untuk lupa masuk dan lupa pulang. Pengajuan
    tidak lagi ditolak karena kuota, dan orang yang hadir tetap dicatat hadir.
    Nominal dasar dibahas di Bab 3. (pengganti KEH-D07 dan D12)
18. Orang yang melewati 4 kali dalam satu periode muncul di laporan untuk pemilik.
    (pelapis)

Telat:

19. Penjelasan telat di atas 30 menit yang disetujui menjadi **usulan "potongan
    ditiadakan"** di slip orang itu; menit telatnya tetap tercatat dan tampil.
    Peniadaannya mengikuti 2B.10 aturan 12. (pengganti KEH-D14)

Lembur:

20. Saat absen pulang melewati jam kerja, sistem bertanya "ini lembur?". Sehari
    sebelum hangus, karyawan diingatkan. (pelapis, PRI-07)
21. Klaim lembur wajib melampirkan **foto kertas lembur** dan mengisi **siapa yang
    menyuruh**, dipilih dari jabatan yang diberi wewenang menyuruh lembur. Isi
    awal: HR dan pemilik. Wewenang itu pengaturan per jabatan. (pelapis KEH-D16)
22. Lembur disahkan **satu kali**. Yang mengesahkan boleh mengubah jamnya dengan
    alasan. Saat slip dibuat tidak ada centang ulang; slip hanya membaca hasil
    pengesahan itu. (pengganti KEH-D18 dan D19)

Rekap dan pengaturan:

23. Rekap dihitung di satu tempat di server; karyawan dan kantor melihat angka
    yang sama. Lembur tampil tiga angka: terdeteksi, diklaim, disahkan.
    (pengganti KEH-D27 dan D28)
24. Batas waktu, ambang 30 menit, dan nominal denda adalah pengaturan bertanggal
    berlaku. Pengecualian satu periode dicatat di Daftar Pengecualian.
    (pengganti KEH-D09, D15, D21)

### Jawaban pemilik atas dua butir kepastian (12 Oktober 2026)

| Butir | Jawaban pemilik |
|---|---|
| K1 tambahan denda | **Tetap.** Kejadian ke-5 dan seterusnya dalam satu periode masing-masing kena denda dasar ditambah Rp5.000; tidak naik lagi tiap kejadian (melengkapi aturan 17) |
| K2 siapa yang menyuruh lembur | Yang dipilih **nama orangnya**. Daftarnya hanya berisi orang dari jabatan yang diberi wewenang menyuruh lembur; wewenangnya tetap pengaturan per jabatan (melengkapi aturan 21) |

**2D selesai dibahas.**

### Susulan setelah penetapan (12 Oktober 2026, sesi Bab 3)

Pemilik memastikan dua hal tentang cuti tahunan: hari cuti yang diambil **tetap
dibayar**, dan cuti baru boleh setelah **masa kerja 1 tahun penuh** ("harus dia
sudah 1 tahun penuh, itu aturannya"). Yang kedua mengganti jawaban "tidak wajib
1 tahun" di tabel 2E; pertentangannya disampaikan dulu dan pemilik memilih
syarat 1 tahun. KEH-48 sudah ditulis ulang.

### Yang masih terbuka

1. Nominal dasar denda lupa absen, dan selisih 5 baris berdenda dari 24
   persetujuan di sistem lama: Bab 3.
