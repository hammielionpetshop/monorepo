# Galian Sistem Lama: Gaji Bulanan

Status: **selesai.** Buku aturan v3 ditetapkan 12 Oktober 2026: `../03-gaji.md`.
Digali dari sistem lama mulai: 12 Oktober 2026

Bab 3 dipecah menjadi lima bagian (disetujui pemilik, 12 Oktober 2026):

| Bagian | Isi | Status |
|---|---|---|
| 3A | Komponen gaji dan cara slip dihitung dari kehadiran | **Sudah digali** (12 Oktober 2026), database sudah dicek. GAJ-A01 s.d. A34. **Dijawab pemilik** (3A.9), 18 aturan di 3A.10, Y1–Y8 disetujui. **Selesai dibahas**; pembulatan dan tarif lembur (Rp7.500 per jam) dijawab di 3B.9 |
| 3B | Potongan di luar kehadiran: kehilangan barang, selisih kasir, potongan lain, titik sambung kasbon | **Sudah digali** (12 Oktober 2026), database sudah dicek. GAJ-B01 s.d. B29. **Dijawab pemilik** (3B.9), 19 aturan di 3B.10, Z1–Z10 disetujui. **Selesai dibahas** |
| 3C | Semua bonus: bonus biasa, bersyarat, loyalitas, disiplin, promo, grooming | **Sudah digali** (12 Oktober 2026), database sudah dicek. GAJ-C01 s.d. C43. **Dijawab pemilik** (3C.9), 23 aturan di 3C.10, AA1–AA13 disetujui. **Selesai dibahas.** Arahan pemilik: tabel bonus **dipakai**, dan di v3 semua bonus harus **satu pintu**. Catatan: di database kelima tabel `bonus_*` kosong (belum pernah dipakai); maksud "dipakai" ditanyakan di pertanyaan 1 |
| 3D | Perjalanan slip: dibuat, diperiksa, ditutup, dibayar, dikoreksi, portal, ringkasan, aliran ke keuangan | **Sudah digali** (12 Oktober 2026), database sudah dicek. GAJ-D01 s.d. D31. **Dijawab pemilik** (3D.9), 22 aturan di 3D.10, AB1–AB15 disetujui. **Selesai dibahas** |
| 3E | Penetapan menjadi `03-gaji.md` | **Selesai** (12 Oktober 2026): GAJ-01 s.d. 57; pertentangan dan asal aturan di bagian 3E |

Gaji driver, borongan, dan kasbon tidak masuk bab ini (Bab 5).

Batas penggalian: kode aplikasi dan struktur database yang berjalan. Isi data
karyawan (nama, nominal gaji) tidak dibuka; yang dihitung hanya jumlah baris.

Nomor GAJ di file ini adalah nomor **galian** (sementara). Nomor aturan v3
ditetapkan di 3E.

---

# Bagian 3A: Komponen gaji dan cara slip dihitung dari kehadiran

Sumber: `hris-app/app/(dashboard)/penggajian/bulanan/page.tsx` (3.593 baris),
`penggajian/komponen/page.tsx`, `penggajian/komponen/[employee_id]/page.tsx`,
`lib/escalatingDeduction.ts`, `lib/lateTolerance.ts`,
`lib/salaryAccrualEstimate.ts`, dan fungsi database
`review_alpha_clarification`, `review_checkout_clarification`.

## 3A.1 Bagian ini mengurus apa

Angka dasar slip gaji bulanan: gaji pokok dan tunjangan tiap orang, lalu apa
yang ditambah dan dipotong karena kehadirannya (lembur, telat, tidak hadir,
denda, dan kompensasi libur). Potongan lain dan bonus dibahas di 3B dan 3C.

## 3A.2 Data di sistem lama (dicek ke database, 12 Oktober 2026)

| Data | Isinya | Disimpan di | Jumlah |
|---|---|---|---|
| Komponen gaji per orang | Gaji pokok, tunjangan jabatan, tunjangan tetap, tunjangan khusus, tarif lembur per jam, tarif telat per menit (tidak dipakai lagi), tanggal berlaku | `salary_components` | 49 baris untuk 28 orang |
| Gaji standar | Satu set angka acuan, ditambah tarif telat dan tarif lembur "universal" | `salary_defaults` | 1 baris |
| Slip gaji | Satu baris per orang per periode, berisi 20-an kolom angka | `payrolls` (30 kolom) | 75 slip, 5 periode (Mei–September 2026), 14–16 slip per periode |
| Tanda per orang | Gaji flat, tidak kena telat, tidak dapat lembur, tidak dapat kompensasi libur | kolom di `employees` | Dari 24 orang aktif: flat 3, tanpa telat 2, tanpa lembur 1, tanpa kompensasi 1 |

Karyawan aktif: 18 tetap, 2 training, 4 driver. Semua slip berstatus disetujui
(14) atau lunas (61).

## 3A.3 Aturan yang ditemukan

### Periode dan siapa yang mendapat slip

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| GAJ-A01 | Periode gaji tanggal 26 bulan lalu sampai 25 bulan ini, dan slip dinamai bulan akhirnya. | `bulanan/page.tsx` `getFirstLastDay` |
| GAJ-A02 | Slip hanya dibuat untuk karyawan **aktif** berjenis tetap dan training. Driver tidak. Orang yang sudah dinonaktifkan tidak muncul di daftar pembuatan slip. | `openCreateModal`, `fetchAutoPreview` |
| GAJ-A03 | Slip dihitung **di layar pembuatnya** (browser), lalu angkanya disimpan. Server tidak menghitung dan tidak memeriksa ulang. | `buildSlipPreview`, `handleFinalizeSlip` |

### Komponen gaji

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| GAJ-A04 | Tiap orang punya komponen gaji sendiri dengan tanggal berlaku: gaji pokok, tunjangan jabatan, tunjangan tetap, tunjangan khusus, dan tarif lembur per jam. | `salary_components` |
| GAJ-A05 | Slip selalu memakai baris komponen **paling baru**, tanpa mencocokkan tanggal berlakunya dengan periode slip. | `buildSlipPreview` |
| GAJ-A06 | Gaji standar hanya acuan untuk mengisi orang baru dan tombol "Terapkan Gaji Standar". Mengubahnya tidak mengubah gaji siapa pun. | `komponen/page.tsx` |
| GAJ-A07 | Tunjangan khusus ada kolomnya, tetapi tidak satu pun dari 75 slip memakainya. | `payrolls.special_allowance` |
| GAJ-A08 | Gaji harian = (gaji pokok + tiga tunjangan) dibagi **26**, selalu 26 berapa pun panjang periodenya. | `buildSlipPreview` |
| GAJ-A09 | Dihitung sebagian (prorata) hanya untuk **training** yang masuk di tengah periode: hari aktif dibagi jumlah hari periode. Karyawan tetap selalu penuh. Bonus tidak ikut diprorata. | `buildSlipPreview` |
| GAJ-A10 | Orang bertanda "gaji flat" menerima gaji pokok dan tunjangan saja: tanpa lembur, tanpa potongan kehadiran, tanpa bonus. | `employees.flat_salary` |

### Telat

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| GAJ-A11 | Tarif telat satu angka untuk semua orang, rupiah per menit, disimpan di gaji standar. Kolom tarif telat per orang masih ada (3 nilai berbeda) tetapi tidak dibaca. | `salary_defaults.late_penalty_per_minute` |
| GAJ-A12 | Toleransi 5 menit hanya untuk absen QR. Telat 5 menit tidak dipotong; telat 6 menit dipotong **6 menit penuh**. Absen yang diisi tangan tidak punya toleransi. | `lib/lateTolerance.ts` |
| GAJ-A13 | Orang bertanda "tidak kena telat" tidak dipotong. | `employees.late_penalty_applicable` |

### Lembur

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| GAJ-A14 | Tarif lembur disimpan **per orang** (ada 2 nilai berbeda). "Tarif lembur universal" di gaji standar hanya awalan untuk orang baru. | `salary_components.overtime_rate_per_hour` |
| GAJ-A15 | Lembur per hari: kurang dari 60 menit tidak dihitung; sisanya dibulatkan ke bawah per jam. | `roundOvertimeHours` |
| GAJ-A16 | Yang dibayar hanya hari lembur yang **dicentang saat slip dibuat**, dan jamnya bisa diubah tangan saat itu. Dari 227 hari lembur yang dicentang, 96 jamnya diubah tangan. | `handleFinalizeSlip`, `attendances.overtime_hours_adjusted` |
| GAJ-A17 | Orang bertanda "tidak dapat lembur" tidak dibayar lemburnya. Team Gudang dinolkan lewat nama departemen di database. | `employees.overtime_applicable`, `calc_attendance_times` |

### Tidak hadir

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| GAJ-A18 | Jatah 4 hari per periode diisi berurutan oleh: hari cuti, lalu hari izin atau sakit yang paling awal, lalu hari kosong tanpa catatan. Jadwal libur yang dipilih karyawan **tidak dibaca**. | `buildSlipPreview` (sudah dicatat di KEH-C) |
| GAJ-A19 | Izin dan sakit tanpa surat di luar jatah dipotong per hari dengan pengali 1; 1,25; 1,5; 1,75; lalu 2 kali gaji harian. Pengali naik per hari dan berlanjut sepanjang periode. | `lib/escalatingDeduction.ts` |
| GAJ-A20 | Alpha (termasuk hari kosong di luar jatah): 1,5; 2; 2,25; 2,5; 2,75; lalu 3 kali gaji harian. | sama |
| GAJ-A21 | Izin mendadak: 1,25; 1,5; 1,6; 1,7; 1,8; 1,9; lalu 2 kali. Tidak boleh mengisi jatah 4 hari. | sama |
| GAJ-A22 | Sakit dengan surat dokter: hari pertama tidak dipotong, hari ke-2 dan ke-3 dipotong setengah, hari ke-4 dan seterusnya dipotong penuh. | `buildSlipPreview` |
| GAJ-A23 | Training tidak kena pengali naik: selalu 1 kali gaji harian per hari. | `TRAINING_FLAT_MULTIPLIER` |
| GAJ-A24 | Pengali naik hanya berlaku untuk periode yang berakhir sejak 26 September 2026. Tanggal itu ditulis di kode. | `NEW_RULES_CUTOFF_DATE` |
| GAJ-A25 | Cuti tahunan tidak dipotong, tetapi memakan jatah 4 hari. | `buildSlipPreview` |
| GAJ-A26 | Hari yang belum terjadi tidak dihitung. Slip yang dibuat sebelum tanggal 25 tidak menghitung sisa harinya, dan tidak diperbarui sesudahnya. | `buildSlipPreview` |
| GAJ-A27 | Kompensasi libur: jatah 4 hari yang tidak terpakai dibayar, tiap hari sebesar gaji harian. Ada di 9 slip. Orang bertanda "tidak dapat kompensasi" dikecualikan. | `buildSlipPreview` |

### Denda

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| GAJ-A28 | Denda lupa absen masuk Rp15.000 dan lupa absen pulang Rp5.000, nominalnya ditulis di dalam fungsi database, dan disimpan sebagai angka di baris absen. | `review_alpha_clarification`, `review_checkout_clarification` |
| GAJ-A29 | Denda tidak memilih libur dibaca dari pengajuan libur periode itu (5 baris berdenda). | `roster_pick_requests.discipline_fee` |
| GAJ-A30 | Denda periode sebelum 26 September 2026 tidak ditagih. | `buildSlipPreview` |
| GAJ-A31 | Semua potongan tidak hadir dan semua denda dijumlah menjadi **satu angka** di slip. Rinciannya tidak disimpan; tiap kali rincian dibuka, dihitung ulang dari data hari itu. | `payrolls.absent_deduction`, `fetchAbsentBreakdown` |

### Jumlah akhir

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| GAJ-A32 | Kotor = gaji pokok + tunjangan + lembur + semua bonus + kompensasi libur. Bersih = kotor dikurangi telat, kasbon, loyalitas, kehilangan barang, selisih kasir, dan potongan tidak hadir. | `buildSlipPreview`, `calcNet` |
| GAJ-A33 | Gaji bersih tidak boleh minus: berhenti di Rp0, dan kelebihan potongannya hilang (tidak menjadi utang). Belum pernah terjadi di 75 slip. | `calcNet` |
| GAJ-A34 | "Perkiraan gaji berjalan" di portal karyawan memakai rumus sendiri yang berbeda dari slip: tanpa jatah 4 hari dan tanpa izin mendadak. | `lib/salaryAccrualEstimate.ts` |

## 3A.4 Menu di sistem lama

| Menu | Dipakai untuk apa | Mirip dengan menu lain? |
|---|---|---|
| Penggajian → Bulanan | Perkiraan semua orang, buat slip, rincian, ubah kasbon dan bonus, setujui, bayar, cetak | Satu halaman memuat hampir seluruh modul (dibahas di 3D) |
| Penggajian → Komponen Gaji | Daftar orang dan gaji pokoknya, gaji standar, tarif telat dan lembur | Tarif lembur diisi juga di halaman per orang |
| Komponen Gaji → per orang | Isi komponen dan lihat riwayatnya | |
| Portal → dashboard | Perkiraan gaji berjalan | Rumusnya berbeda dari slip |

## 3A.5 Tumpang tindih

1. **Rumus potongan tidak hadir ditulis tiga kali:** saat slip dibuat, saat
   rincian slip dibuka (salinan di halaman yang sama), dan di perkiraan portal
   (versi berbeda). Halaman Potongan, Ringkasan, dan Slip Gaji portal juga
   memuat potongan rumus periode dan gaji harian.
2. **Batas periode 26–25** ditulis ulang di sedikitnya enam file.
3. **Tarif telat** ada di gaji standar dan di tiap orang; **tarif lembur** ada
   di tiap orang dan di gaji standar. Yang dipakai berbeda untuk tiap tarif.
4. **Pengecualian per orang** tersebar di empat centang di data karyawan,
   ditambah satu pengecualian berdasarkan nama departemen di database.
5. **Angka aturan** (pembagi 26, pengali potongan, toleransi 5 menit, tanggal
   mulai aturan baru, nominal denda) ditulis di kode dan di fungsi database,
   bukan di pengaturan.

## 3A.6 Kejadian di lapangan dan jalan keluarnya

| Kejadian | Di sistem lama | Ada jalan keluar? |
|---|---|---|
| Gaji seseorang dinaikkan, lalu slip periode lama dibuat atau rinciannya dibuka | Memakai gaji baru (GAJ-A05) | Tidak |
| Orang berhenti di tengah periode lalu dinonaktifkan | Tidak muncul di daftar pembuatan slip (GAJ-A02) | Tidak; harus diaktifkan lagi dulu |
| Karyawan tetap masuk di tengah periode | Gaji pokok penuh; hari sebelum bergabung diabaikan (GAJ-A09) | Tidak ada prorata |
| Slip dibuat sebelum tanggal 25 | Sisa hari tidak dihitung (GAJ-A26) | Slip harus dihapus dan dibuat ulang |
| Absen dibetulkan setelah slip dibuat | Angka slip tetap; rincian yang dibuka menampilkan hitungan baru, jadi keduanya bisa berbeda (GAJ-A31) | Slip dihapus dan dibuat ulang |
| Klarifikasi lupa absen disetujui dengan denda | 19 dari 24 persetujuan tidak punya denda di baris absennya; 4 dari 5 yang tersisa jatuh di periode yang dendanya tidak ditagih. Sebab pastinya belum terbukti; dugaannya angka di baris absen tertimpa saat baris itu ditulis ulang | Tidak ada tanda bahwa denda hilang |
| Potongan lebih besar dari gaji | Bersih Rp0, kelebihannya hilang (GAJ-A33) | Tidak dicatat |
| Lembur di bawah 1 jam, atau 1 jam 50 menit | Hangus, atau dibayar 1 jam (GAJ-A15) | Jam bisa diubah tangan saat slip dibuat |

## 3A.7 Pertanyaan untuk pemilik (diajukan di percakapan, 12 Oktober 2026)

1. Gaji harian dibagi berapa (sekarang selalu 26).
2. Orang yang masuk atau berhenti di tengah periode: dihitung sebagian untuk
   semua jenis karyawan, dan jatah liburnya ikut.
3. Kompensasi libur masih ada atau tidak, setelah libur wajib terjadwal 4 hari.
4. Tingkat potongan izin, izin mendadak, alpha, dan sakit dengan surat: dibawa
   apa adanya atau diubah; training tetap 1 kali atau disamakan.
5. Telat: lewat dari toleransi 5 menit, dipotong dari menit pertama atau dari
   menit ke-6; dan cara meniadakan potongan per slip.
6. Lembur: satu tarif untuk semua atau per orang; pembulatan dibawa atau tidak.
7. Hari tutup dibayar atau tidak; nominal denda dibawa atau diubah.

## 3A.8 Usulan untuk v3 (belum disetujui)

| No | Usulan | Dasar |
|---|---|---|
| Y1 | Slip dihitung di server dengan satu rumus; perkiraan di portal memakai rumus yang sama. | WAJ-04, GAJ-A03, A34 |
| Y2 | Komponen gaji dibaca menurut tanggal berlakunya; kenaikan gaji mulai berlaku di awal periode (tanggal 26). | WAJ-07, GAJ-A05 |
| Y3 | Slip menyimpan rinciannya baris demi baris (tiap tambahan dan potongan, tanggalnya, dan aturan yang dipakai). Rincian slip tidak dihitung ulang saat dibuka. | GAJ-A31 |
| Y4 | Semua angka aturan (pembagi, tarif, pengali, toleransi, nominal denda) menjadi pengaturan bertanggal berlaku. | WAJ-07, tumpang tindih 5 |
| Y5 | Pengecualian (gaji flat, tanpa telat, tanpa lembur) diatur per jabatan; pengecualian per orang masuk Daftar Pengecualian. | WAJ-05, PRI-26 |
| Y6 | Denda dicatat sebagai baris sendiri begitu keputusannya disahkan, bukan angka di baris absen. | GAJ-A28 |
| Y7 | Slip hanya bisa dibuat setelah periode berakhir dan semua tinjauan selesai; sebelum itu yang ada hanya "perkiraan". | KEH-14, KEH-69, GAJ-A26 |
| Y8 | Komponen gaji berupa daftar yang bisa ditambah, bukan kolom tetap; tunjangan khusus yang tidak pernah dipakai tidak dibawa. | GAJ-A07, PRI-30 |

## 3A.9 Jawaban pemilik (12 Oktober 2026)

| Butir | Jawaban pemilik | Dicatat sebagai |
|---|---|---|
| 1 pembagi gaji harian | "ikut saran" | Tetap dibagi 26 |
| 2 masuk atau berhenti di tengah periode | "ok" | Dihitung sebagian untuk semua jenis karyawan; jatah libur ikut |
| 3 kompensasi libur | "betul, saya setuju saran" | Hanya untuk hari libur yang dipakai bekerja karena diminta |
| 4 tingkat potongan | "ya ikuti saran anda" | Semua angka dibawa; izin duka dikeluarkan karena dibayar (KEH) |
| 5 telat | "jika dia telat menit ke 6, maka langsung 6.000 ... ini hanya untuk mentoleransi, agar lebih fair, tapi tetap tampilkan jika dia telat hanya 2 menit sekalipun" | Tarif Rp1.000 per menit; lewat toleransi dipotong dari menit pertama; telat tetap ditampilkan walau tidak dipotong |
| 6 lembur | "semua angka lembur sama (di sistem lama saya setting angka lembur masing2 orang di 2 tempat berbeda)" | Satu tarif lembur untuk semua, diisi di satu tempat. Pembulatan tidak disebut pemilik; dibaca mengikuti saran (dibawa), **dipastikan lagi** |
| 7 hari tutup dan denda | "ikuti saran anda" | Hari tutup dibayar; denda Rp15.000, Rp5.000, dan Rp10.000 dibawa |
| Y1–Y8 | "ok" untuk semuanya | Disetujui semua |

## 3A.10 Aturan yang dihasilkan (nomor v3 ditetapkan di 3E)

1. **Gaji harian** = jumlah komponen gaji tetap sebulan dibagi 26. Angka 26
   adalah pengaturan bertanggal berlaku. (bawa GAJ-A08; Y4)
2. **Masuk atau berhenti di tengah periode:** gaji tetap dihitung sebagian
   menurut hari sejak bergabung atau sampai hari terakhir bekerja, untuk semua
   jenis karyawan. Jatah libur periode itu ikut dihitung sebagian. Orang yang
   sudah berhenti tetap bisa dibuatkan slip terakhirnya. (pengganti GAJ-A02,
   A09; menjawab titipan 6 Bab 2)
3. **Kompensasi libur** hanya dibayar untuk hari libur terjadwal yang dipakai
   bekerja karena diminta (KEH), sebesar 1 gaji harian per hari. Jatah libur
   yang tidak diambil atas kemauan sendiri tidak dibayar. Jatah 4 hari tidak
   lagi diisi otomatis oleh izin, sakit, atau hari kosong. (pengganti GAJ-A18,
   A25, A27; menjawab titipan 5 Bab 2 dan KAR-62)
4. **Potongan tidak hadir**, dalam kali gaji harian, naik per hari dan berlanjut
   dalam satu periode, kembali ke awal tiap periode: (bawa GAJ-A19 s.d. A23)
   - izin dan sakit tanpa surat: 1; 1,25; 1,5; 1,75; lalu 2
   - izin mendadak: 1,25; 1,5; 1,6; 1,7; 1,8; 1,9; lalu 2
   - alpha: 1,5; 2; 2,25; 2,5; 2,75; lalu 3
   - sakit dengan surat dokter: hari pertama bebas, hari ke-2 dan ke-3
     setengah, hari ke-4 dan seterusnya penuh
   - training: selalu 1 kali, tidak naik
5. **Izin duka** yang dibayar (KEH) tidak masuk hitungan potongan. Cuti tahunan
   tidak dipotong (KEH-48). (pelapis atas aturan 4)
6. **Telat:** Rp1.000 per menit. Telat sampai 5 menit tidak dipotong; telat 6
   menit atau lebih dipotong seluruh menitnya (6 menit = Rp6.000). Menit telat
   selalu ditampilkan, termasuk yang tidak dipotong. Potongan telat bisa
   ditiadakan per slip dengan alasan (KEH-23, KEH-66); caranya dirinci di 3D.
   (bawa GAJ-A11, A12; toleransi berlaku untuk semua cara absen)
7. **Lembur:** satu tarif per jam untuk semua orang, diisi di satu tempat.
   Tarif per orang tidak ada lagi. (pengganti GAJ-A14)
8. **Pembulatan lembur:** di bawah 60 menit tidak dibayar; sisanya dibulatkan
   ke bawah per jam. (bawa GAJ-A15; **menunggu kepastian pemilik**)
9. **Hari tutup** (KEH-79) dibayar: gaji tidak dipotong. (aturan baru)
10. **Denda:** lupa absen masuk Rp15.000, lupa absen pulang Rp5.000, tidak
    memilih libur Rp10.000 (KEH-31, KEH-64). Tambahan Rp5.000 mulai kejadian
    ke-5 mengikuti Bab 2. (bawa GAJ-A28, A29)
11. **Slip dihitung di server** dengan satu rumus; perkiraan gaji di portal
    memakai rumus yang sama. (Y1; pengganti GAJ-A03, A34)
12. **Komponen gaji dibaca menurut tanggal berlakunya,** dan perubahan gaji
    mulai berlaku di awal periode (tanggal 26). (Y2; pengganti GAJ-A05)
13. **Slip menyimpan rinciannya baris demi baris:** tiap tambahan dan potongan,
    tanggalnya, dan aturan yang dipakai. Rincian tidak dihitung ulang saat
    dibuka. (Y3; pengganti GAJ-A31)
14. **Semua angka aturan** (pembagi, tarif, pengali, toleransi, nominal denda)
    adalah pengaturan bertanggal berlaku, bukan angka di kode. (Y4; WAJ-07)
15. **Pengecualian** (gaji flat, tanpa telat, tanpa lembur) diatur per jabatan.
    Pengecualian per orang hanya lewat Daftar Pengecualian. (Y5; pengganti
    GAJ-A10, A13, A17)
16. **Denda dicatat sebagai baris sendiri** begitu keputusannya disahkan, bukan
    angka di baris absen. (Y6)
17. **Slip baru bisa dibuat setelah periode berakhir** dan semua tinjauan absen
    dan klarifikasi selesai (KEH-14, KEH-69). Sebelum itu hanya ada
    "perkiraan". (Y7; pengganti GAJ-A26)
18. **Komponen gaji berupa daftar yang bisa ditambah.** Tunjangan khusus tidak
    dibawa sebagai kolom tetap. (Y8; pengganti GAJ-A04, A07)

### Yang masih terbuka

1. Pembulatan lembur (aturan 8): pemilik belum menyebutnya.
2. Nominal tarif lembur per jam: diisi pemilik; nominal di database tidak dibuka.
3. Sebab pasti hilangnya 19 denda lupa absen di sistem lama: belum terbukti.
   Tidak menghambat v3 karena aturan 16 menutup jalannya.

## Titipan untuk bagian berikutnya

- Untuk 3D: gaji bersih minus (GAJ-A33), kelebihan potongan hilang atau dibawa
  ke periode berikutnya; slip untuk orang yang sudah berhenti (GAJ-A02).
- Untuk 3C: arahan pemilik, semua bonus satu pintu.

---

# Bagian 3B: Potongan di luar kehadiran

Sumber: `hris-app/app/(dashboard)/penggajian/kehilangan/barang/page.tsx` (599
baris), `penggajian/kehilangan/kasir/page.tsx` (526), `potongan/page.tsx` (384),
dan bagian kasbon serta kehilangan di `penggajian/bulanan/page.tsx`
(`buildSlipPreview`, `handleSaveKasbon`, `applyKasbonDeductionFifo`,
`reverseKasbonDeductionForPayroll`, `fetchLossDetail`).

## 3B.1 Bagian ini mengurus apa

Potongan slip yang tidak berasal dari kehadiran: ganti rugi kehilangan barang
cabang, selisih (minus) kas kasir, dan cicilan kasbon. Untuk kasbon, yang
dibahas hanya titik sambungnya ke slip; pengajuan dan pencairannya masuk Bab 5.
Tabungan loyalitas juga memotong slip, tetapi dibahas di 3C.

## 3B.2 Data di sistem lama (dicek ke database, 12 Oktober 2026)

| Data | Isinya | Disimpan di | Jumlah |
|---|---|---|---|
| Persen tanggungan kantor | Per cabang, beriwayat, ada tanggal berlaku | `branch_loss_configs` | 12 baris, 6 cabang |
| Persen tanggungan karyawan | Per orang per cabang, beriwayat | `loss_employee_shares` | 28 baris; 18 aktif milik 16 orang |
| Total kehilangan barang | Satu angka per cabang per bulan | `loss_monthly_inputs` | 17 baris, 5 cabang, 5 periode |
| Jabatan penanggung minus kas | Per cabang, jabatan mana yang ikut menanggung | `cashier_loss_configs` | 7 baris (6 aktif), 6 cabang, 4 jabatan |
| Minus kas | Per kejadian: tanggal, nominal, catatan, orang (boleh kosong) | `cashier_loss_entries` | 8 baris; 1 tanpa orang; 0 otomatis dari Laporan Kasir |
| Cicilan kasbon | Per bulan per pengajuan, status, slip yang memotong | `kasbon_deductions` | 5 baris, semuanya sudah dipotong |
| Angka di slip | Tiga kolom: kehilangan barang, kerugian kasir, kasbon | `payrolls` | Dari 75 slip: barang 14, kasir 9, kasbon 18 |

Jumlah persen (kantor + karyawan aktif) di 7 cabang aktif: empat cabang 100%,
satu 55%, satu 40%, satu 0%. Delapan dari 18 persen karyawan yang aktif adalah
milik orang yang sudah nonaktif atau sudah pindah cabang.

## 3B.3 Aturan yang ditemukan

### Kehilangan barang

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| GAJ-B01 | Tiap cabang punya "persen kantor menanggung". Disimpan beriwayat dengan tanggal berlaku, tetapi yang dipakai selalu baris yang **paling baru dibuat**; tanggal berlakunya tidak dibaca. | `branch_loss_configs`, `handlePreview` |
| GAJ-B02 | Tiap karyawan diberi persen tanggung jawab **per orang**, dihitung dari **total** kehilangan (bukan dari sisa setelah bagian kantor). | `loss_employee_shares` |
| GAJ-B03 | Kantor + semua karyawan tidak boleh lebih dari 100%. Kalau kurang dari 100%, sisanya otomatis ditanggung kantor. | `handleSaveKantor`, `handleSaveShares` |
| GAJ-B04 | Total kehilangan diisi satu angka per cabang per bulan, tanpa rincian barangnya. Bisa diubah dan dihapus kapan saja, termasuk setelah slip dipotong. | `handleSaveLoss`, `handleDeleteHistory` |
| GAJ-B05 | Potongan seseorang = persennya kali total kehilangan cabangnya bulan itu. | `buildSlipPreview` |
| GAJ-B06 | Potongan masuk slip lewat **dua jalan**: dihitung saat slip dibuat, dan tombol "Apply ke Slip Gaji" di halaman Kehilangan yang hanya mengenai slip berstatus draf. | `buildSlipPreview`, `handleApply` |
| GAJ-B07 | Orang bergaji flat bebas dari potongan ini saat slip dibuat, tetapi tombol "Apply" tidak memeriksa tanda itu. | sama |
| GAJ-B08 | Driver dan pekerja lepas bisa diberi persen (daftarnya memuat semua karyawan aktif cabang), padahal mereka tidak punya slip bulanan. Bagian mereka tidak tertagih. | `fetchBranchData`, GAJ-A02 |
| GAJ-B09 | Persen milik orang yang sudah nonaktif atau pindah cabang tetap aktif. Saat dihitung orang itu dilewati; bagiannya tidak ditagih ke siapa pun dan tidak tercatat sebagai tanggungan kantor. | `handlePreview` |
| GAJ-B10 | Rincian kehilangan di slip dihitung ulang tiap dibuka, dengan rumus yang **berbeda** dari rumus saat dipotong, dan memakai persen terbaru. | `fetchLossDetail` |

### Selisih kasir

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| GAJ-B11 | Tiap cabang menandai jabatan mana yang ikut menanggung minus kas. | `cashier_loss_configs` |
| GAJ-B12 | Minus kas dicatat per kejadian: tanggal, nominal, catatan, dan boleh menunjuk satu orang (siapa saja di cabang itu, tidak harus kasir). | `handleAddEntry` |
| GAJ-B13 | Kejadian yang menunjuk orang ditanggung penuh orang itu. Yang tanpa orang dibagi rata ke semua karyawan aktif berjabatan tertanda di cabang itu. Kantor tidak ikut menanggung. | `handlePreview`, `buildSlipPreview` |
| GAJ-B14 | Kejadian masuk ke slip menurut **bulan kalender** tanggalnya, bukan periode gaji 26–25. Minus tanggal 27 September masuk slip September, yang periodenya sudah berakhir 25 September. | `handleAddEntry` |
| GAJ-B15 | Catatan minus kas bisa diubah dan dihapus bebas, termasuk setelah slip dipotong. | `handleEditEntry`, `handleDeleteEntry` |
| GAJ-B16 | Jalur otomatis dari Laporan Kasir (minus dikurangi plus per bulan, terkunci dari ubah tangan) sudah disiapkan, tetapi belum menghasilkan satu baris pun. | `auto_source`, `trg_guard_cashier_loss_auto` |
| GAJ-B17 | Total per orang tidak pernah di bawah nol: kelebihan (plus) hanya menutup minus, tidak menjadi tambahan gaji. | `buildSlipPreview` |
| GAJ-B18 | Sama seperti kehilangan barang: dua jalan masuk ke slip (saat slip dibuat dan tombol "Apply"), dan orang bergaji flat hanya dibebaskan di jalan pertama. | `handleApply` |

### Titik sambung kasbon

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| GAJ-B19 | Kasbon yang disetujui dijadwalkan menjadi cicilan per bulan. | `kasbon_deductions` |
| GAJ-B20 | Saat slip dibuat, kolom kasbon terisi otomatis dengan jumlah cicilan bulan itu, dan **bisa diubah tangan**. Di slip draf angkanya bisa diubah lagi. | `bulanan/page.tsx` |
| GAJ-B21 | Angka ubahan harus pas dengan cicilan utuh, berurutan dari yang tertua. Setengah cicilan tidak bisa. | `handleSaveKasbon` |
| GAJ-B22 | Cicilan baru ditandai "sudah dipotong" saat slip ditandai **lunas**, bukan saat slip dibuat atau disetujui. Penandaannya dijalankan dari layar, bukan dari server. | `applyKasbonDeductionFifo` |
| GAJ-B23 | Slip yang dihapus mengembalikan cicilannya ke "belum dipotong". | `reverseKasbonDeductionForPayroll` |
| GAJ-B24 | Saldo kasbon yang tampil di slip hanya kasbon yang sudah dicairkan. | `fetchPayrolls` |
| GAJ-B25 | Dari 16 slip lunas yang memotong kasbon, 12 tidak punya cicilan yang tertaut. Tabel cicilan hanya berisi 5 baris, padahal 11 kasbon berstatus lunas. Dugaan: slip-slip itu dibuat sebelum cara cicilan ini dipasang. Belum terbukti. | database |
| GAJ-B26 | Kasbon driver dan kenek memakai tabel lain dan dipotong dari upah mingguan (Bab 5). | peta sistem |

### Halaman Potongan dan potongan lain

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| GAJ-B27 | Halaman "Aturan Potongan Gaji" hanya untuk melihat: aturan potongan dan hitungan berjalan periode ini. Karyawan melihat miliknya; pemilik, HR, dan finance melihat semua orang. | `potongan/page.tsx` |
| GAJ-B28 | Hitungan di halaman itu salinan sendiri yang berbeda dari slip: tanpa jatah libur, izin mendadak tidak dipisah, izin duka ditulis ikut dipotong, dan nama "Team Gudang" ditulis di kode. | sama |
| GAJ-B29 | Tidak ada tempat mencatat potongan lain (misalnya ganti rugi perorangan). Di luar telat, tidak hadir, denda, kasbon, loyalitas, kehilangan barang, dan minus kas, slip tidak punya baris potongan. | `calcNet` |

## 3B.4 Menu di sistem lama

| Menu | Dipakai untuk apa | Mirip dengan menu lain? |
|---|---|---|
| Penggajian → Kehilangan → Barang | Atur persen, isi total bulanan, pratinjau, terapkan ke slip | Hitungannya ada juga di pembuatan slip dan di rincian slip |
| Penggajian → Kehilangan → Kasir | Tandai jabatan, catat minus kas, pratinjau, terapkan ke slip | Sama; ditambah Laporan Kasir di Keuangan yang kelak mengisi otomatis |
| Potongan | Melihat aturan potongan dan hitungan berjalan | Rumusnya salinan dari slip |
| Kasbon | Pengajuan dan jadwal cicilan (Bab 5) | Nominal potongannya diketik lagi di slip |

## 3B.5 Tumpang tindih

1. **Rumus kehilangan barang ditulis tiga kali** (halaman Kehilangan, pembuatan
   slip, rincian slip), dan yang ketiga rumusnya berbeda. Rumus minus kas
   ditulis dua kali.
2. **Dua jalan masuk ke slip** untuk potongan yang sama (GAJ-B06, B18). Karena
   tiap jalan menghitung ulang gaji bersih, kodenya harus saling menjaga supaya
   tidak menimpa.
3. **Nominal kasbon ada di dua tempat:** jadwal cicilan dan angka yang diketik
   di slip. Keduanya baru dicocokkan saat slip lunas.
4. **Dua arti "bulan":** gaji memakai periode 26–25, minus kas memakai bulan
   kalender (GAJ-B14).
5. **Tanggal berlaku disimpan tetapi tidak dibaca** (GAJ-B01), sama seperti
   komponen gaji (GAJ-A05).

## 3B.6 Kejadian di lapangan dan jalan keluarnya

| Kejadian | Di sistem lama | Ada jalan keluar? |
|---|---|---|
| Total kehilangan salah isi dan slip sudah disetujui | Angka bisa diubah, slip tidak ikut berubah; rincian slip menampilkan hitungan baru | Tidak; slip dan rinciannya jadi berbeda |
| Persen diubah setelah slip dipotong | Rincian slip lama memakai persen baru | Tidak |
| Karyawan pindah cabang atau berhenti | Persennya tertinggal aktif; bagiannya tidak ditagih siapa pun (GAJ-B09) | Harus dirapikan tangan |
| Karyawan baru masuk | Tidak menanggung sampai seseorang mengisi persennya | Tidak ada pengingat |
| Jumlah persen cabang belum 100% | Sisanya ditanggung kantor, hanya ada peringatan kecil | Tiga cabang sekarang begini (55%, 40%, 0%) |
| Minus kas terjadi tanggal 26 sampai akhir bulan | Masuk slip yang periodenya sudah lewat; kalau slip sudah bukan draf, tidak terpotong | Tidak; hilang diam-diam |
| Minus kas salah orang atau salah nominal setelah dipotong | Catatan bisa diubah atau dihapus; slip tidak berubah | Tidak |
| Kasbon mau ditunda sebulan | Ketik 0 di slip; cicilannya tetap "belum dipotong" dan ikut bulan berikutnya | Ada, tetapi tanpa catatan alasan |
| Slip ditandai lunas lalu sambungan putus di tengah | Slip lunas, cicilan belum ditandai (GAJ-B22) | Tidak ada tanda |

## 3B.7 Pertanyaan untuk pemilik (diajukan di percakapan, 12 Oktober 2026)

1. Kehilangan barang dibagi dengan cara apa: persen per orang (seperti
   sekarang), per jabatan, atau bagi rata.
2. Siapa yang ikut menanggung: orang bergaji flat, driver, karyawan baru, dan
   orang yang pindah atau berhenti di tengah periode.
3. Minus kas tanpa nama: tetap dibagi rata ke jabatan tertanda, dan kantor ikut
   menanggung atau tidak.
4. Perlu tidaknya "potongan lain" (ganti rugi perorangan), dan boleh dicicil
   atau tidak.
5. Kasbon: boleh tidaknya nominal potongan diubah saat slip dibuat.
6. Sisa 3A: pembulatan lembur dan nominal tarif lembur per jam.

## 3B.8 Usulan untuk v3 (belum disetujui)

| No | Usulan | Dasar |
|---|---|---|
| Z1 | Satu jalan masuk ke slip: tiap potongan dicatat di modulnya, slip membacanya saat dibuat. Tombol "Apply ke Slip Gaji" tidak ada. | WAJ-04, GAJ-B06, B18 |
| Z2 | Persen tanggungan dibaca menurut tanggal berlakunya. | WAJ-07, GAJ-B01 |
| Z3 | Pembagian satu cabang selalu berjumlah 100%, dan bagian kantor (termasuk sisa) ditampilkan terang, bukan peringatan kecil. | GAJ-B03 |
| Z4 | Kehilangan atau minus kas yang sudah masuk slip tertutup tidak bisa diubah atau dihapus. Koreksinya dicatat sebagai baris baru di periode berikutnya. | PRI-02, GAJ-B04, B15 |
| Z5 | Semua potongan memakai periode gaji 26–25, menurut tanggal kejadiannya. | GAJ-B14 |
| Z6 | Slip menyimpan rincian potongannya (total cabang, persen, hasil); tidak dihitung ulang saat dibuka. | Y3, GAJ-B10 |
| Z7 | Bagian tanggungan seseorang berakhir otomatis di tanggal ia pindah cabang atau berhenti. | GAJ-B09 |
| Z8 | Halaman "Aturan Potongan" menampilkan pengaturan dan hitungan dari rumus slip yang sama, bukan salinan. | Y1, GAJ-B28 |
| Z9 | Cicilan kasbon ditandai terpotong di server, dalam satu langkah dengan penutupan slip. | GAJ-B22 |
| Z10 | Minus kas bersumber dari Laporan Kasir; catat tangan hanya untuk kejadian di luar laporan itu. Dirinci di Bab 6. | GAJ-B16 |

## 3B.9 Jawaban pemilik (12 Oktober 2026)

| Butir | Jawaban pemilik | Dicatat sebagai |
|---|---|---|
| 1 cara membagi kehilangan barang | "B" | Dibagi per jabatan, bukan per orang |
| 2 siapa ikut menanggung | "apakah bisa ? sebanding hari nya ?" | Pemilik bertanya, belum memutuskan. Dijawab di percakapan: bisa. **Menunggu kepastian** (lihat "Yang masih terbuka") |
| 3 minus kas tanpa nama | "di bawa apa ada nya, karena di sistem kasir ... ada pencatatan minus kasir (biasanya yang tanggung jawab adalah orang yang tutup shift), jadi lebih mudah di bagi nya" | Dibawa. Penanggung utama adalah orang yang menutup shift; bagi rata ke jabatan tertanda hanya untuk minus tanpa nama |
| 4 potongan lain | "ok ini perlu" | Ada menu Potongan Lain |
| 5 kasbon di slip | "ok, tolong buat serapi mungkin, berarti ketika pengajuan kasbon, karyawan mengajukan juga cara pembayaran nya, 1 kali potong, atau 2 kali potong, berarti harus ada plafon nya (jatah kasbon, limit, jadi selama limit nya habis, dia tidak bisa kasbon)" | Nominal tidak diketik di slip. Cara bayar dipilih saat mengajukan. Ada plafon yang **menolak**, bukan sekadar memperingatkan |
| 6 lembur | "ya betul, tarif lembur adalah 7.500" | Pembulatan dibawa; tarif Rp7.500 per jam untuk semua |
| Z1–Z10 | "ok" untuk semuanya | Disetujui semua |

Catatan atas butir 5: di sistem lama limit kasbon per orang sudah ada
(`employees.kasbon_limit`), tetapi hanya memunculkan peringatan merah dan
pengajuan tetap bisa dikirim. Keputusan pemilik menjadikannya penolakan.

## 3B.10 Aturan yang dihasilkan (nomor v3 ditetapkan di 3E)

1. **Kehilangan barang dibagi per jabatan.** Tiap cabang punya persen
   tanggungan kantor; sisanya dibagi ke karyawan cabang itu menurut jabatannya.
   Tidak ada persen yang diisi per orang. (pengganti GAJ-B02; WAJ-05. Cara
   membagi antarjabatan **menunggu jawaban pemilik**)
2. **Pembagian satu cabang selalu berjumlah 100%,** dan bagian kantor
   ditampilkan terang. (Z3; pengganti GAJ-B03)
3. **Persen tanggungan bertanggal berlaku** dan dibaca menurut tanggal itu.
   (Z2; pengganti GAJ-B01)
4. **Minus kas** ditanggung orang yang menutup shift, bersumber dari Laporan
   Kasir. Minus yang tidak punya nama dibagi rata ke karyawan berjabatan
   tertanda di cabang itu. Kantor tidak ikut menanggung. Kelebihan kas hanya
   menutup minus, tidak menjadi tambahan gaji. Catat tangan hanya untuk
   kejadian di luar Laporan Kasir. (bawa GAJ-B11, B13, B17; Z10; dirinci di
   Bab 6)
5. **Potongan Lain:** satu menu untuk ganti rugi perorangan, dengan jenis
   potongan yang bisa ditambah, disahkan HR dan pemilik, dan boleh dicicil.
   (aturan baru; menutup GAJ-B29)
6. **Satu jalan masuk ke slip:** tiap potongan dicatat di menunya sendiri, dan
   slip membacanya saat dibuat. Tidak ada tombol "Apply ke Slip Gaji". (Z1;
   pengganti GAJ-B06, B18)
7. **Semua potongan memakai periode gaji 26–25** menurut tanggal kejadiannya.
   (Z5; pengganti GAJ-B14)
8. **Yang sudah masuk slip tertutup tidak bisa diubah atau dihapus.**
   Koreksinya dicatat sebagai baris baru di periode berikutnya. (Z4; PRI-02;
   pengganti GAJ-B04, B15)
9. **Slip menyimpan rincian potongannya** (total cabang, persen, hasil);
   tidak dihitung ulang saat dibuka. (Z6; pengganti GAJ-B10)
10. **Bagian tanggungan berakhir otomatis** saat seseorang pindah cabang atau
    berhenti. (Z7; pengganti GAJ-B09)
11. **Halaman "Aturan Potongan"** menampilkan pengaturan dan hitungan dari
    rumus slip yang sama. (Z8; pengganti GAJ-B28)
12. **Kasbon di slip tidak diketik.** Slip membaca cicilan yang jatuh tempo di
    periode itu. Menunda atau mengubah cicilan dilakukan di menu Kasbon, dengan
    alasan dan pengesahan. (pengganti GAJ-B20, B21)
13. **Cicilan kasbon ditandai terpotong oleh server,** sekaligus saat slip
    ditutup. (Z9; pengganti GAJ-B22)
14. **Pembulatan lembur:** di bawah 60 menit tidak dibayar; sisanya dibulatkan
    ke bawah per jam. (menetapkan aturan 8 di 3A.10)
15. **Tarif lembur Rp7.500 per jam** untuk semua orang, sebagai pengaturan
    bertanggal berlaku. (melengkapi aturan 7 di 3A.10)

16. **Bobot per jabatan:** pemilik menentukan perbandingan antarjabatan
    (misalnya kepala toko 2, pramuniaga 1). Bagian karyawan (100% dikurangi
    persen kantor) dibagi menurut jumlah bobot orang yang bekerja di cabang itu
    pada periode itu, sehingga jumlahnya selalu 100%. (melengkapi aturan 1)
17. **Sebanding hari:** orang yang masuk, berhenti, atau pindah cabang di
    tengah periode menanggung sebanding hari ia bekerja di cabang itu. Yang
    pindah menanggung di tiap cabang menurut harinya. (aturan baru; sejalan
    dengan aturan 2 di 3A.10)
18. **Sisa yang tidak tertagih** karena hitungan sebanding hari ditanggung
    kantor, tidak dibebankan ke karyawan lain. (aturan baru)
19. **Orang bergaji flat ikut menanggung** kehilangan barang. **Driver tidak
    ikut.** Keduanya diatur per jabatan, bukan per orang. (pengganti GAJ-B07,
    B08)

### Jawaban penutup pemilik (12 Oktober 2026)

Atas butir 2a–2d dan soal bobot, pemilik menjawab "ok ikuti saran anda".
Dicatat sebagai: semua saran dipakai (aturan 16 s.d. 19). **3B selesai
dibahas.**

Tambahan pemilik soal kasbon: "karena kasbon itu nanti semua sifatnya
pengajuan, jadi seharusnya jika limit orang itu habis, tolak saja tanpa
beritahukan berapa sisa limitnya, agar lebih mudah". Dicatat di titipan Bab 5.

### Yang masih terbuka

1. Sebab 12 slip lunas berkasbon tidak tertaut ke cicilan (GAJ-B25): belum
   terbukti. Tidak menghambat v3 karena aturan 12 dan 13 menutup jalannya.

## Titipan dari 3B

- Untuk Bab 5 (Kasbon): saat mengajukan, karyawan memilih cara bayar (1 kali
  potong, 2 kali potong, dan seterusnya); ada plafon kasbon, dan pengajuan
  ditolak selama plafon habis. Penolakan itu **tidak menyebut sisa plafon**
  kepada karyawan (keputusan pemilik). Yang perlu diputuskan di sana: plafon per orang
  atau per jabatan, besarnya, paling banyak berapa kali potong, dan kapan
  plafon terisi lagi (saat cicilan terpotong atau saat lunas).
- Untuk Bab 6 (Keuangan): minus kas bersumber dari Laporan Kasir; nama
  penanggungnya adalah orang yang menutup shift.
- Untuk 3D: cicilan Potongan Lain dan kasbon ikut hitungan gaji bersih minus
  (GAJ-A33).
- Untuk 3C: tabungan loyalitas memotong slip tiap bulan.

---

# Bagian 3C: Semua bonus

Sumber: `hris-app/app/(dashboard)/penggajian/bonus/page.tsx` (1.196 baris),
`penggajian/bonus-kondisional/page.tsx` (319), `penggajian/loyalitas/page.tsx`
(525), `ranking/page.tsx` (513), `penjualan-promo/page.tsx`, `kpi/page.tsx`,
`logistik/grooming/page.tsx` (tab Persetujuan Bonus dan Rekap Bonus),
`logistik/kirim-barang/page.tsx`, bagian bonus di `penggajian/bulanan/page.tsx`
(`buildSlipPreview`, `handleSaveBonus`, `handleAddExtraBonus`, perubahan status
slip), `portal/slip-gaji/page.tsx`, dan fungsi database
`get_employee_promo_bonus`, `sync_promo_bonus_to_payroll`,
`submit_promo_sales_report`, `create_grooming_bonus_records`,
`review_grooming_bonus`, `resync_grooming_bonus_payroll`,
`tp_ongkir_bonus_items`, `resync_ongkir_bonus_payroll`.

## 3C.1 Bagian ini mengurus apa

Semua tambahan di luar gaji tetap dan lembur: bonus yang masuk slip, bonus yang
dicairkan di luar slip, dan tabungan loyalitas (potongan bulanan yang kelak
dikembalikan). Cara menghitung skor KPI dan alur order grooming tidak dibahas
di sini (Bab 7 dan Bab 4); yang dibahas hanya uang bonusnya dan jalannya ke
slip.

## 3C.2 Data di sistem lama (dicek ke database, 12 Oktober 2026)

Sistem lama punya **sembilan jenis** bonus. Slip terakhir yang ada: periode
September 2026 (75 slip, semuanya sudah disetujui atau lunas).

| Jenis | Disimpan di | Jumlah baris | Pernah masuk slip? |
|---|---|---|---|
| Bonus Kinerja (bertingkat, per siklus) | `bonus_rules`, `bonus_tiers`, `bonus_monthly_entries`, `bonus_cycles`, `bonus_employee_allocations` | 0 di kelima tabel | Tidak pernah dipakai |
| Bonus KPI | `employees.kpi_bonus_max`, `kpi_evaluations.bonus_cair` | 0 orang punya nominal; 0 penilaian | 0 slip |
| Bonus Kondisional (bersyarat) | `employee_bonus_criteria`, `payroll_bonus_assessments` | 8 kriteria milik 8 orang, **semuanya nonaktif**; 0 penilaian | 16 slip, 9 orang, periode Mei–Juli 2026 |
| Bonus Tambahan | `payroll_extra_bonuses` | 2 | 2 slip |
| Bonus Promo | `promo_products`, `promo_sales_reports` | 6 produk aktif (4 per pcs, 2 persen; 2 khusus orang tertentu); 16 laporan, **semuanya masih menunggu** | 0 slip |
| Bonus Grooming | `grooming_bonus_ledger` | 5, semuanya disetujui, periode Oktober 2026 | 0 slip (slip Oktober belum dibuat) |
| Bonus Ongkir | dihitung dari perjalanan Toko Pusat | 15 perjalanan selesai | 0 slip |
| Ranking Disiplin | `discipline_cycles`, `discipline_payouts` | 1 siklus berjalan; 0 pencairan | Tidak lewat slip |
| Tabungan Loyalitas | `employees.loyalitas_*`, `loyalitas_balances`, `loyalitas_transactions` | 0 orang punya nominal; 0 saldo | 0 slip |

Dari sembilan jenis, **empat belum pernah dipakai** (Kinerja, KPI, Ranking
Disiplin, Loyalitas), dua pernah masuk slip (Kondisional, Tambahan), dan tiga
baru berjalan sejak September–Oktober 2026 dan belum pernah sampai ke slip
(Promo, Grooming, Ongkir).

Ini menjawab keputusan terbuka nomor 4 di WIP: tabel `bonus_rules` dan
sejenisnya **belum pernah dipakai**, bukan sudah ditinggalkan.

## 3C.3 Aturan yang ditemukan

### Bonus Kinerja (belum pernah dipakai)

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| GAJ-C01 | Aturan bonus dibuat per departemen (atau semua departemen), dengan jenis target omset atau jumlah pcs, dan tingkatan: mencapai batas tertentu mendapat nominal tertentu. | `bonus_rules`, `bonus_tiers` |
| GAJ-C02 | Tiap bulan seseorang mengetik angka pencapaian. Sistem memilih tingkatan tertinggi yang tercapai dan mencatat nominalnya. | `TabBulanan.handleSave` |
| GAJ-C03 | Nominal bulanan dikumpulkan per siklus (lamanya diatur, misalnya 6 bulan). Di akhir siklus, totalnya dibagi ke karyawan dengan **mengetik nominal per orang**; tidak ada rumus pembagian. | `TabSiklus.handleSaveAllocations` |
| GAJ-C04 | Pencairan **tidak lewat slip**: langsung dicatat sebagai Kas Keluar per cabang. | `confirmPayBonus` |
| GAJ-C05 | Jatah seseorang bisa ditandai hangus (misalnya berhenti). Aturan dan tingkatan bisa dihapus kapan saja. | `forfeitAllocation`, `handleDeleteRule` |

### Bonus KPI (belum pernah dipakai)

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| GAJ-C06 | Tiap orang punya "nominal bonus maksimal". Bonus cair = nominal maksimal kali persen skor KPI bulan itu. | `kpi/page.tsx` |
| GAJ-C07 | Saat rekap KPI disimpan, angkanya langsung ditulis ke slip draf periode itu. Saat slip dibuat, angkanya dibaca lagi. | `kpi/page.tsx`, `buildSlipPreview` |

### Bonus Kondisional

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| GAJ-C08 | Kriteria dan nominalnya diisi **per orang** (misalnya "tidak ada kehilangan barang", Rp500.000). Hanya untuk karyawan tetap dan training. | `bonus-kondisional/page.tsx` |
| GAJ-C09 | Tiap bulan pembuat slip mencentang kriteria mana yang terpenuhi. Centangnya ada di **dua tempat**: saat slip dibuat, dan tombol "Input Bonus" pada slip yang sudah ada. | `bulanan/page.tsx` |
| GAJ-C10 | Saat slip dibuat massal, bonus ini dikosongkan untuk semua orang dan harus diisi satu per satu sesudahnya. | `buildSlipPreview` |
| GAJ-C11 | Kriteria bisa diubah nominalnya, dinonaktifkan, dan dihapus kapan saja, tanpa tanggal berlaku. | `handleEditSubmit`, `handleDelete` |
| GAJ-C12 | 16 slip memuat bonus ini, tetapi tabel penilaiannya kosong: tidak ada catatan kriteria mana yang dicentang, oleh siapa. Tiga dari 16 slip milik orang yang sekarang tidak punya kriteria sama sekali. Dugaan: penilaian ikut terhapus saat kriterianya dihapus. Belum terbukti. | database |

### Bonus Tambahan

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| GAJ-C13 | Nominal bebas dengan alasan wajib, ditambahkan pada satu slip lewat tombol "+ Bonus". Boleh berkali-kali. | `handleAddExtraBonus` |
| GAJ-C14 | Tidak bisa pada slip lunas. Pada slip yang sudah diajukan atau disetujui, slipnya kembali menjadi draf dan harus disetujui ulang. | sama |
| GAJ-C15 | Tidak ada pengesahan tersendiri untuk bonusnya, dan tidak bisa dibatalkan setelah disimpan. | sama |
| GAJ-C16 | Baris "Bonus Tambahan" tidak ada di rincian slip yang dilihat karyawan di portal; hanya ada di slip cetak. | `portal/slip-gaji/page.tsx` |

### Bonus Promo

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| GAJ-C17 | Target promo dibuat per produk, per cabang, per bulan. Bisa dibatasi untuk karyawan tertentu. | `promo_products` |
| GAJ-C18 | Cara hitung pertama, **per pcs**: tarif per pcs ada dua, satu kalau target cabang tercapai dan satu kalau belum. Bonus seseorang = jumlah pcs miliknya kali tarif yang berlaku. Tercapai atau tidaknya dihitung dari penjualan **satu cabang**, bukan perorangan. | `get_employee_promo_bonus` |
| GAJ-C19 | Cara hitung kedua, **persen**: bonus = jumlah kali harga kali persen, tidak bergantung pada target. Dipakai untuk jasa seperti grooming. | sama |
| GAJ-C20 | Karyawan melapor dengan foto struk. Laporan dihitung hanya setelah disetujui pemilik, HR, atau finance. | `submit_promo_sales_report`, `review_promo_sales_report` |
| GAJ-C21 | Laporan yang lewat batas hari tetap diterima, tetapi bonusnya dipotong 50%. Angka 50% dan satu tanggal kelonggaran (6 Oktober 2026) ditulis di kode. | `submit_promo_sales_report` |
| GAJ-C22 | Bonus promo **tidak dibaca saat slip dibuat**. Jalannya hanya tombol "Sinkron Bonus ke Penggajian", ditekan per orang, dan hanya berhasil kalau slipnya masih draf. | `sync_promo_bonus_to_payroll` |
| GAJ-C23 | Bonus dihitung menurut cabang orang itu **saat ini**. Orang yang pindah cabang kehilangan hitungan di cabang lamanya. | `get_employee_promo_bonus` |

### Bonus Grooming

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| GAJ-C24 | Saat order grooming selesai, sistem membuat catatan bonus per kucing untuk groomer terakhir: persen kali harga (bawaan 10%). Order batal menggugurkan bonusnya. | `create_grooming_bonus_records`, `void_grooming_bonus_records` |
| GAJ-C25 | Ada **dua jalur** untuk bonus yang sama: groomer yang terdaftar di target promo Grooming mendapat laporan promo otomatis (masuk Bonus Promo); groomer lain mendapat catatan di buku grooming (masuk Bonus Grooming). Disahkan di dua halaman yang berbeda. | sama |
| GAJ-C26 | Catatan grooming disahkan pemilik, HR, atau finance. Saat disahkan, slip draf periode itu diperbarui otomatis; saat slip dibuat, angkanya dibaca lagi. | `review_grooming_bonus`, `buildSlipPreview` |

### Bonus Ongkir

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| GAJ-C27 | Penanggung jawab perjalanan Toko Pusat mendapat 50% ongkir tiap tujuan yang sampai, hanya kalau perjalanannya selesai lengkap. Ditutup paksa berarti tanpa bonus. Angka 50% ditulis di kode, di empat tempat. | `tp_ongkir_bonus_items`, `kirim-barang/page.tsx` |
| GAJ-C28 | Ongkir antar-jemput kucing baru menjadi bonus setelah order groomingnya selesai. | sama |
| GAJ-C29 | Tanpa pengesahan: masuk slip otomatis menurut tanggal perjalanan kembali. | `resync_ongkir_bonus_payroll` |

### Ranking Disiplin (belum pernah dicairkan)

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| GAJ-C30 | "Pool" disiplin = jumlah potongan telat **semua slip** sejak siklus dimulai. | `fetchCycleAndRankings` |
| GAJ-C31 | Skor tiap orang dari lima hal berbobot sama: menit telat, izin, sakit, alpha (makin sedikit makin baik), dan jam lembur (makin banyak makin baik). Semua karyawan aktif ikut, termasuk driver. | `calcScore` |
| GAJ-C32 | Tiga teratas mendapat 50%, 30%, 20% dari pool. Angkanya ditulis di kode. | `handleCairkan` |
| GAJ-C33 | Pencairan hanya mencatat siapa mendapat berapa. **Tidak masuk slip dan tidak masuk Kas Keluar.** Siklus baru dimulai otomatis. | sama |
| GAJ-C34 | Hitungan izin dan alpha di halaman ini salinan sendiri (4 hari libur per bulan kalender), berbeda dari hitungan slip. Halaman ini juga menulis ke database setiap kali dibuka. | sama |

### Tabungan Loyalitas (belum pernah dipakai)

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| GAJ-C35 | Nominal per bulan dan lamanya (bulan) diisi per orang, hanya karyawan tetap. Nominal itu dipotong dari slip tiap bulan. | `loyalitas/page.tsx`, `buildSlipPreview` |
| GAJ-C36 | Di bulan terakhir, seluruh saldo ditambah potongan bulan itu masuk slip sebagai pendapatan, lalu siklus baru dimulai. | `buildSlipPreview` |
| GAJ-C37 | Saldo baru bertambah saat slip ditandai lunas, dan penambahannya dijalankan dari layar, bukan dari server. | perubahan status slip |
| GAJ-C38 | Pemilik atau HR bisa mencairkan lebih awal (dicatat sebagai Kas Keluar, di luar slip) atau menghanguskan saldo, dengan alasan wajib. Menghanguskan tidak bisa dibatalkan. | `handleAction` |

### Berlaku untuk semua bonus

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| GAJ-C39 | Orang bergaji flat tidak mendapat Bonus KPI, Bonus Kondisional, dan tidak dipotong loyalitas, tetapi tetap mendapat Bonus Ongkir dan Grooming. | `buildSlipPreview` |
| GAJ-C40 | Bonus tidak ikut dihitung sebagian untuk orang yang masuk di tengah periode. | sama |
| GAJ-C41 | Slip menyimpan satu angka per jenis bonus (tujuh kolom), tanpa rinciannya. | `payrolls` |
| GAJ-C42 | Semua jalan ke slip hanya mengenai slip **draf**. Bonus yang baru disahkan setelah slip disetujui tidak masuk ke mana pun, dan tidak ada tanda. | `sync_promo_bonus_to_payroll`, `resync_*` |
| GAJ-C43 | Perkiraan gaji di portal karyawan sengaja tidak menampilkan bonus apa pun (permintaan pemilik dulu). | `portal/page.tsx` |

## 3C.4 Menu di sistem lama

| Menu | Dipakai untuk apa | Mirip dengan menu lain? |
|---|---|---|
| Penggajian → Bonus Kinerja | Aturan bertingkat, isi pencapaian, siklus dan pencairan | Sama-sama "bonus dari target" dengan Penjualan Promo dan KPI |
| Penggajian → Setup → Bonus Kondisional | Kriteria per orang | Centangnya ada di halaman slip |
| Penggajian → Tabungan Loyalitas | Atur nominal, lihat saldo, cairkan, hanguskan | Potongannya di slip |
| Ranking Disiplin | Peringkat dan pencairan pool | Hitungan kehadirannya salinan dari slip |
| KPI | Skor dan bonus cair | Menulis ke slip |
| Penjualan Promo | Target, lapor, setujui, sinkron ke slip | Grooming juga lewat sini |
| Logistik → Grooming → Persetujuan Bonus, Rekap Bonus | Sahkan bonus grooming | Sebagian bonus grooming disahkan di Penjualan Promo |
| Logistik → Kirim Barang | Menampilkan bonus ongkir | Hitungannya ada juga di server |
| Slip Gaji → "Input Bonus" dan "+ Bonus" | Centang bonus kondisional, tambah bonus bebas | |

Bonus diurus dari **sembilan tempat** di lima kelompok menu.

## 3C.5 Tumpang tindih

1. **Enam pintu masuk ke slip:** saat slip dibuat (KPI, kondisional, ongkir,
   grooming, loyalitas), simpan rekap KPI, tombol "Input Bonus", tombol
   "+ Bonus", tombol "Sinkron Bonus" promo, dan penyesuaian otomatis dari
   server (ongkir, grooming). Tiap pintu menghitung ulang gaji kotor sendiri;
   rumus gaji kotor ditulis sedikitnya empat kali.
2. **Tiga pintu keluar uang:** slip, Kas Keluar langsung (Bonus Kinerja,
   pencairan loyalitas lebih awal), dan tanpa catatan uang sama sekali
   (Ranking Disiplin).
3. **Bonus grooming lewat dua jalur** dengan dua halaman pengesahan (GAJ-C25).
4. **Tiga cara "bonus dari target"** yang tidak saling kenal: Bonus Kinerja,
   Bonus Promo per pcs, dan Bonus KPI.
5. **Tiga arti "bulan":** promo memakai bulan pada produknya, grooming dan
   ongkir memakai periode gaji 26–25, Bonus Kinerja memakai bulan kalender.
6. **Empat cara mengesahkan:** tanpa pengesahan (ongkir, tambahan), centang
   pembuat slip (kondisional), pemilik-HR-finance (promo, grooming), dan
   pemilik saja di database padahal tombolnya tampil juga untuk HR (ranking).
7. **Angka aturan ditulis di kode:** 50% ongkir, 50% potongan telat lapor,
   50/30/20 ranking, 10% grooming bawaan, tanggal kelonggaran.

## 3C.6 Kejadian di lapangan dan jalan keluarnya

| Kejadian | Di sistem lama | Ada jalan keluar? |
|---|---|---|
| Laporan promo baru disetujui setelah slip periode itu disetujui | Sinkron ditolak; bonusnya tidak masuk slip mana pun | Tidak. Enam laporan September sedang begini: masih menunggu, slip September sudah tutup |
| Lupa menekan "Sinkron Bonus" untuk seseorang | Bonus promonya tidak masuk slip | Tidak ada pengingat |
| Bonus tambahan salah nominal | Tidak bisa dibatalkan; hanya bisa ditambah lagi | Tidak |
| Kriteria bonus kondisional dihapus | Slip lama tetap memuat angkanya, catatannya hilang | Tidak |
| Karyawan pindah cabang di tengah bulan promo | Hitungan di cabang lama hilang (GAJ-C23) | Tidak |
| Karyawan berhenti saat tabungan loyalitas berjalan | Diputuskan tangan: cairkan atau hanguskan | Ada, tetapi tanpa aturan tertulis |
| Tabungan terlanjur dihanguskan | Tidak bisa dibatalkan | Tidak |
| Slip ditandai lunas lalu sambungan putus | Slip lunas, saldo loyalitas tidak bertambah (GAJ-C37) | Tidak ada tanda |
| Pool disiplin dicairkan | Tercatat siapa dapat berapa; uangnya dibayar di luar sistem | Tidak tercatat di keuangan |
| Bonus Kinerja dicairkan, sambungan putus di tengah | Kas Keluar sebagian cabang sudah tercatat, status siklus belum | Tidak |

## 3C.7 Pertanyaan untuk pemilik (diajukan di percakapan, 12 Oktober 2026)

1. Dari sembilan jenis bonus, mana yang dibawa ke v3, terutama empat yang belum
   pernah dipakai (Kinerja, KPI, Ranking Disiplin, Loyalitas).
2. Bonus Kondisional: masih dipakai atau tidak (semua kriterianya sekarang
   nonaktif; slip terakhir yang memuatnya periode Juli 2026), dan kriteria per orang atau per jabatan.
3. Bonus yang baru disahkan setelah slip ditutup: masuk slip berikutnya atau
   hangus.
4. Semua bonus dibayar lewat slip, atau ada yang tetap dibayar terpisah.
5. Orang bergaji flat dan orang yang berhenti: bonus mana yang tetap didapat.
6. Tabungan loyalitas (kalau dibawa): nasib saldo saat orang berhenti.
7. Siapa yang mengesahkan bonus.

## 3C.8 Usulan untuk v3 (belum disetujui)

| No | Usulan | Dasar |
|---|---|---|
| AA1 | **Satu Buku Bonus.** Bonus jenis apa pun menjadi satu baris di satu buku: siapa, jenis, nominal, tanggal kejadian, asalnya (order, laporan, penilaian), dan statusnya. | arahan pemilik "satu pintu"; WAJ-03 |
| AA2 | **Satu jalan masuk ke slip:** slip membaca Buku Bonus saat dibuat. Tidak ada tombol sinkron, dan tidak ada tombol bonus di halaman slip. | WAJ-04; GAJ-C09, C22; sejalan Z1 |
| AA3 | **Jenis bonus adalah daftar yang bisa ditambah,** bukan kolom tetap di slip. Bonus bebas ("Bonus Tambahan") menjadi salah satu jenisnya. | GAJ-C41 |
| AA4 | **Satu halaman "Persetujuan Bonus"** untuk semua jenis yang perlu disahkan. Bonus grooming hanya lewat satu jalur. | GAJ-C25, tumpang tindih 6 |
| AA5 | **Bonus yang disahkan setelah slip ditutup masuk slip periode berikutnya** secara otomatis, dengan keterangan asal periodenya. | GAJ-C42 |
| AA6 | **Baris bonus tidak dihapus,** hanya dibatalkan dengan alasan. Kalau sudah masuk slip tertutup, koreksinya baris baru di periode berikutnya. | PRI-02; sejalan Z4; GAJ-C15 |
| AA7 | **Slip menyimpan rincian bonusnya** baris demi baris, dan karyawan melihat semuanya di portal. | sejalan Y3, Z6; GAJ-C16 |
| AA8 | **Angka aturan bonus menjadi pengaturan bertanggal berlaku** (persen ongkir, potongan telat lapor, pembagian peringkat, persen grooming), tidak ditulis di kode. | WAJ-05, WAJ-07; tumpang tindih 7 |
| AA9 | **Semua bonus memakai periode gaji 26–25** menurut tanggal kejadiannya. | sejalan Z5; tumpang tindih 5 |
| AA10 | **Penilaian bonus bersyarat disimpan:** kriteria mana, terpenuhi atau tidak, oleh siapa, kapan. Penilaian dilakukan di menu bonus sebelum slip dibuat. | GAJ-C12 |
| AA11 | **Bonus mengikuti cabang tempat kejadiannya,** bukan cabang orang itu saat dihitung. | GAJ-C23; sejalan PRI-17 |
| AA12 | **Uang bonus yang dibayar di luar slip (kalau ada) tetap tercatat di Buku Bonus** dan mengalir ke keuangan dalam satu langkah di server. | GAJ-C04, C33, C37 |
| AA13 | **Halaman peringkat hanya menampilkan,** dari hitungan kehadiran yang sama dengan slip. | GAJ-C34; sejalan Y1 |

## 3C.9 Jawaban pemilik (12 Oktober 2026)

| Butir | Jawaban pemilik | Dicatat sebagai |
|---|---|---|
| 1 jenis bonus yang dibawa | "sebenarnya itu semua harus nya di bawa, tapi di rapihkan (tapi ini di tunda dulu saja, karena besar)" | Kesembilan jenis dibawa ke v3 dalam bentuk yang dirapikan. Tafsir Claude: empat yang belum pernah dipakai (Kinerja, KPI, Ranking Disiplin, Loyalitas) **ditunda** perinciannya; yang sudah berjalan dibangun lebih dulu. Ini juga menjawab maksud "tabel bonus dipakai": konsepnya dipakai, datanya belum pernah ada |
| 2 bonus kondisional | "ok setuju saran" | Tetap dipakai; kriteria diatur per jabatan per cabang, bukan per orang |
| 3 tabungan loyalitas | "ini tujuannya untuk karyawan kontrak, saya ikut saran anda" | Tabungan loyalitas ditujukan untuk karyawan kontrak. Berhenti sesuai prosedur: saldo cair di slip terakhir. Berhenti tanpa pemberitahuan: hangus. Keduanya disahkan HR dan pemilik |
| 4 bonus terlambat disahkan | "ok setuju" | Masuk slip periode berikutnya |
| 5 dibayar lewat slip | "ok" | Semua bonus dibayar lewat slip |
| 6 gaji flat dan orang berhenti | "ok" | Sesuai saran |
| 7 pengesah | "ok" | HR dan pemilik; finance hanya melihat |
| AA1–AA13 | "ok setuju" | Disetujui semua |

Permintaan baru pemilik: "saya ingin sistem v3 memiliki mesin yang menghitung
berapa banyak uang terlambat yang dikumpulkan, karena bonus-bonus itu akan
menggunakan uang dari sini". Dicatat sebagai aturan 18 di bawah; rinciannya
ditanyakan di percakapan.

Catatan atas butir 3: status kerja "Kontrak" belum ada di buku aturan Karyawan.
KAR-61 sudah menyiapkan tempatnya (daftar status disimpan sebagai data).
Sistem lama membatasi tabungan ini untuk karyawan tetap (GAJ-C35); keputusan
pemilik menggantinya.

## 3C.10 Aturan yang dihasilkan (nomor v3 ditetapkan di 3E)

1. **Satu Buku Bonus.** Bonus jenis apa pun dicatat sebagai satu baris: siapa,
   jenis, nominal, tanggal kejadian, asalnya, dan status. (AA1; WAJ-03)
2. **Satu jalan masuk ke slip:** slip membaca Buku Bonus saat dibuat. Tidak ada
   tombol sinkron dan tidak ada tombol bonus di halaman slip. (AA2; pengganti
   GAJ-C07, C09, C13, C22, C26, C29)
3. **Jenis bonus adalah daftar yang bisa ditambah.** Bonus bebas menjadi salah
   satu jenisnya, dengan alasan wajib. (AA3; pengganti GAJ-C41)
4. **Satu halaman Persetujuan Bonus** untuk semua jenis. Bonus grooming hanya
   lewat satu jalur. (AA4; pengganti GAJ-C25)
5. **Bonus disahkan HR dan pemilik.** Finance hanya melihat. Bonus ongkir
   tercatat otomatis tanpa pengesahan, tetapi bisa dibatalkan dengan alasan.
   (jawaban 7; pengganti GAJ-C20, C26; bawa GAJ-C29)
6. **Bonus yang disahkan setelah slip ditutup masuk slip periode berikutnya**
   secara otomatis, dengan keterangan periode asalnya. (AA5; pengganti GAJ-C42)
7. **Semua bonus dibayar lewat slip.** Bonus bersiklus masuk slip di bulan
   cairnya. Kalau suatu saat ada pembayaran di luar slip, tetap tercatat di
   Buku Bonus dan mengalir ke keuangan dalam satu langkah di server. (jawaban
   5; AA12; pengganti GAJ-C04, C33, C38)
8. **Baris bonus tidak dihapus,** hanya dibatalkan dengan alasan. Yang sudah
   masuk slip tertutup dikoreksi dengan baris baru di periode berikutnya.
   (AA6; PRI-02; pengganti GAJ-C05, C11, C15)
9. **Slip menyimpan rincian bonusnya** baris demi baris, dan karyawan melihat
   semuanya di portal. (AA7; pengganti GAJ-C16, C41)
10. **Angka aturan bonus adalah pengaturan bertanggal berlaku,** tidak ditulis
    di kode. (AA8; pengganti GAJ-C21, C27, C32)
11. **Semua bonus memakai periode gaji 26–25** menurut tanggal kejadiannya.
    (AA9)
12. **Bonus mengikuti cabang tempat kejadiannya.** (AA11; pengganti GAJ-C23)
13. **Bonus bersyarat (kondisional) dibawa.** Kriteria dan nominalnya diatur
    per jabatan per cabang, bertanggal berlaku. Penilaiannya disimpan (kriteria
    mana, terpenuhi atau tidak, oleh siapa, kapan) dan dilakukan di menu bonus
    sebelum slip dibuat. (jawaban 2; AA10; pengganti GAJ-C08 s.d. C12)
14. **Orang bergaji flat tetap mendapat bonus dari pekerjaan nyata** (promo,
    grooming, ongkir, bonus bebas). Diatur per jenis bonus, bukan per orang.
    (jawaban 6; pengganti GAJ-C39)
15. **Orang yang berhenti** menerima bonus yang sudah disahkan di slip
    terakhirnya; yang belum disahkan diproses seperti biasa. (jawaban 6)
16. **Kesembilan jenis bonus dibawa dalam bentuk yang dirapikan.** Bonus promo,
    grooming, ongkir, bonus bebas, dan bonus bersyarat dibangun lebih dulu.
    Bonus Kinerja, Bonus KPI, Ranking Disiplin, dan Tabungan Loyalitas
    **ditunda**: dirinci belakangan sebagai jenis baru di Buku Bonus. (jawaban
    1)
17. **Tabungan loyalitas (ditunda) untuk karyawan kontrak.** Saldo cair di
    slip terakhir bila berhenti sesuai prosedur, hangus bila berhenti tanpa
    pemberitahuan; keduanya disahkan HR dan pemilik. Halaman peringkat, kalau
    kelak dibangun, hanya menampilkan dari hitungan kehadiran yang sama dengan
    slip. (jawaban 3; AA13; pengganti GAJ-C34, C35, C38)
18. **Mesin Dana Disiplin.** Sistem menghitung jumlah uang potongan telat dan
    denda disiplin yang terkumpul, sebagai sumber dana bonus. (permintaan baru
    pemilik; di sistem lama hanya ada sebagai "pool" di halaman Ranking
    Disiplin, GAJ-C30)
19. **Yang masuk ke dana:** potongan telat dan semua denda disiplin (denda lupa
    absen, tambahan denda Rp5.000, denda tidak memilih libur). Potongan
    kehilangan barang dan minus kas tidak masuk. Potongan alpha, izin, dan
    sakit masuk kantong lain (aturan 23).
20. **Yang dihitung hanya uang yang benar-benar terpotong** di slip yang sudah
    ditutup. Potongan yang ditiadakan dengan alasan tidak masuk. Dana
    bertambah saat slip ditutup, bukan dari perkiraan harian. (sejalan aturan
    5 di 3A.10)
21. **Dana punya saldo, dan bonus yang bersumber darinya tidak boleh melebihi
    saldo.** Pengesahan yang melebihi saldo **ditolak** dengan menampilkan
    kekurangannya. (sejalan plafon kasbon, aturan 12 di 3B.10)
22. **Yang memakai dana ini hanya bonus disiplin dan bonus bersyarat.** Bonus
    promo, grooming, dan ongkir dibayar dari uang kantor, tidak bergantung pada
    saldo dana. Sumber dana tiap jenis bonus adalah pengaturan pada jenis
    bonusnya. (melengkapi aturan 3)

### Jawaban penutup pemilik (12 Oktober 2026)

| Butir | Jawaban pemilik | Dicatat sebagai |
|---|---|---|
| Tafsir jawaban 1 | "di tunda maksudnya, kita bahas nanti, karena itu rumit" | Benar: empat jenis itu dibahas belakangan (aturan 16) |
| Tafsir jawaban 3 (kontrak) | "ok" | Benar (aturan 17) |
| Dana 1, uang yang masuk | "potongan alpha dan izin (kembali ke yang lembur dan back up) coba pertimbangkan ulang" | Telat dan denda masuk. Pemilik meminta alpha dan izin dipertimbangkan ulang, dengan alasan uangnya kembali ke orang yang lembur dan menggantikan. Pertimbangan Claude diajukan di percakapan; **menunggu kepastian** |
| Dana 2, uang yang benar-benar terpotong | "ok" | Aturan 20 |
| Dana 3, saldo dan penolakan | "ya betul" | Aturan 21 dan 22 |

Alasan pemilik atas mesin ini: "karena sistem ini ada fitur keuangannya
nanti". Dicatat sebagai titipan Bab 6.

Atas usul kantong tersendiri untuk alpha dan izin, pemilik menjawab "ok
cukup". Dicatat sebagai aturan 23. **3C selesai dibahas.**

23. **Dana Tidak Hadir,** kantong kedua yang terpisah dari Dana Disiplin.
    Masuk: potongan alpha, izin (termasuk izin mendadak), dan sakit yang
    benar-benar terpotong di slip tertutup. Keluar: lembur dan kompensasi
    masuk di hari libur yang dibayar pada periode yang sama. Sifatnya
    **laporan, bukan pagar**: keduanya ditampilkan berdampingan, dan
    pembayaran lembur tidak pernah ditolak karena saldo. Sisa lebihnya boleh
    dipindahkan pemilik ke Dana Disiplin dengan catatan, tidak otomatis.
    (aturan baru; potongan sakit ikut kantong ini adalah anggapan Claude yang
    disampaikan ke pemilik dan tidak dibantah)

### Yang masih terbuka

1. Sebab hilangnya catatan penilaian bonus kondisional (GAJ-C12): belum
   terbukti. Tidak menghambat v3 karena aturan 8 dan 13 menutup jalannya.

## Titipan dari 3C

- Untuk Bab 1 (Karyawan): status kerja "Kontrak" perlu ditambahkan saat
  tabungan loyalitas dirinci (KAR-61).
- Untuk Bab 4 (Logistik): bonus ongkir dan bonus grooming dicatat ke Buku
  Bonus oleh modul Logistik; persennya pengaturan bertanggal berlaku.
- Untuk Bab 7 (KPI dan penjualan promo): bonus promo dan bonus KPI dicatat ke
  Buku Bonus; pengesahannya di halaman Persetujuan Bonus.
- Untuk 3D: slip membaca Buku Bonus saat dibuat; bonus susulan masuk periode
  berikutnya. Dana Disiplin bertambah pada langkah penutupan slip.
- Untuk Bab 6 (Keuangan): Dana Disiplin tampil sebagai pos tersendiri di
  keuangan (masuk dari slip, keluar saat bonus dibayar), karena v3 punya fitur
  keuangan (keterangan pemilik).
- Sistem lama: enam laporan promo September 2026 masih menunggu persetujuan
  padahal slip September sudah ditutup. Sudah dilaporkan ke pemilik; tidak
  disentuh (WAJ-09).

---

# Bagian 3D: Perjalanan slip

Sumber: `hris-app/app/(dashboard)/penggajian/bulanan/page.tsx` (bagian
`fetchAutoPreview`, `openCreateModal`, `handleFinalizeSlip`, `handleSaveKasbon`,
`applyStatusChange`, `confirmPaySlip`, `handleBulkStatusChange`,
`handleDeletePayroll`, `handleAddExtraBonus`, `printSlip`),
`penggajian/ringkasan/page.tsx` (527 baris), `portal/slip-gaji/page.tsx` (418),
`portal/page.tsx` (bagian slip dan perkiraan), `keuangan/dashboard/page.tsx`,
`keuangan/laporan/page.tsx`, `keuangan/laporan/detail/page.tsx`,
`keuangan/kas-keluar/page.tsx`, `lib/finCashOut.ts`, serta tabel `payrolls`
(kolom, kebijakan akses, trigger) dan fungsi database `fin_autopost_payroll`,
`recalc_payroll_totals`.

## 3D.1 Bagian ini mengurus apa

Perjalanan sebuah slip dari awal sampai akhir: kapan dan oleh siapa dibuat,
diperiksa, disahkan, dibayar, dan dibetulkan kalau salah; apa yang dilihat
karyawan; laporan ringkasnya; dan bagaimana uangnya tercatat di keuangan.
Rumus isi slip sudah dibahas di 3A, 3B, dan 3C.

## 3D.2 Data di sistem lama (dicek ke database, 12 Oktober 2026)

| Data | Isinya | Disimpan di | Jumlah |
|---|---|---|---|
| Slip gaji | Satu baris per orang per periode. Status: draf, menunggu, disetujui, lunas. Yang dicatat hanya **siapa yang menyetujui** dan kapan baris dibuat | `payrolls` | 75 slip: Mei 14 (semuanya masih "disetujui"), Juni 14, Juli 16, Agustus 16, September 15 (semuanya lunas) |
| Bonus tambahan per slip | Nominal, alasan, siapa yang menambah | `payroll_extra_bonuses` | 2 baris |
| Kas keluar dari gaji | Satu baris per slip per sumber dana, tertaut ke slipnya | `fin_cash_out` (`source_table = 'payrolls'`) | 64 baris untuk 61 slip lunas; semua nominalnya cocok dengan gaji bersih |
| Kas keluar "gaji" yang diketik tangan | Tanpa tautan ke slip | `fin_cash_out` (kategori `payroll`, tanpa sumber) | 9 baris |

Yang **tidak** disimpan di slip: siapa yang membuat, siapa dan kapan
mengajukan, kapan disetujui, siapa dan kapan membayar, dari rekening mana
(hanya ada di kas keluar), cabang dan jabatan orangnya saat itu.

Tabel `payrolls` tidak punya trigger sama sekali. Semua slip dibuat tanggal 1
atau 2 bulan berikutnya dan dibayar pada tanggal yang sama (6–7 hari setelah
tanggal 25). 24 slip adalah milik 10 orang yang sekarang nonaktif. 7 karyawan
aktif berjenis tetap atau training tidak punya slip September (sebabnya tidak
diperiksa: bisa gaji flat Rp0, baru masuk, atau terlewat).

## 3D.3 Aturan yang ditemukan

### Slip dibuat

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| GAJ-D01 | Slip dibuat **satu per satu per orang** lewat tiga langkah: pilih orang (centang lembur, isi kasbon, centang bonus bersyarat), lihat pratinjau, lalu simpan sebagai draf. Tidak ada "buat untuk semua". | `openCreateModal`, `handleFinalizeSlip` |
| GAJ-D02 | Di atas daftar slip ada tabel "Perkiraan" untuk orang yang belum punya slip, dihitung otomatis tiap halaman dibuka. Lembur dianggap sah semua dan bonus bersyarat dikosongkan, jadi angkanya bisa berbeda dari slip nantinya. | `fetchAutoPreview` |
| GAJ-D03 | Satu orang hanya boleh punya satu slip per periode. | batasan unik di `payrolls` |
| GAJ-D04 | Slip boleh dibuat kapan saja dan untuk periode mana saja. Pemeriksaan "masih ada hari tanpa keterangan" ada kerangkanya, tetapi selalu lolos. | `openCreateModal`, baris 371–388 |
| GAJ-D05 | Slip tidak mencatat siapa pembuatnya. | `payrolls` |

### Status dan siapa boleh apa

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| GAJ-D06 | Empat status berurutan: Draf → Menunggu Approval → Disetujui → Lunas. Hanya bisa maju. Tidak ada tombol menolak, mengembalikan, atau membatalkan. | `applyStatusChange` |
| GAJ-D07 | Mengajukan: finance, HR, pemilik. Menyetujui: HR, pemilik. Menandai lunas: pemilik saja. | `canAjukan`, `canApprove`, `canPaid` |
| GAJ-D08 | Pembagian di GAJ-D07 **hanya ada di tombol**. Database mengizinkan finance, HR, dan pemilik mengubah kolom apa pun di slip (termasuk status dan nominal) dan menghapus slip, pada status apa pun, termasuk lunas. | kebijakan akses `payrolls` |
| GAJ-D09 | Orang yang sama boleh membuat, mengajukan, dan menyetujui. Di data, tidak ada slip yang disetujui oleh penerimanya sendiri; penyetujunya 3 orang. | `payrolls.approved_by` |
| GAJ-D10 | Beberapa slip bisa dicentang lalu diajukan, disetujui, atau dilunasi sekaligus. Prosesnya satu per satu dari layar; kalau terputus di tengah, sebagian sudah berubah dan sebagian belum. | `handleBulkStatusChange` |

### Mengubah dan menghapus

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| GAJ-D11 | Di slip draf yang bisa diubah: nominal kasbon dan bonus bersyarat. Bonus promo, ongkir, dan grooming mengubah slip draf dari halaman lain (3C). Angka lain tidak bisa diubah; jalan satu-satunya hapus lalu buat ulang. | `handleSaveKasbon`, `handleSaveBonus` |
| GAJ-D12 | Bonus tambahan bisa dimasukkan ke slip berstatus apa pun kecuali lunas. Kalau slipnya sudah diajukan atau disetujui, slip **kembali ke draf** dan persetujuannya hilang. Ini satu-satunya jalan mundur. | `handleAddExtraBonus` |
| GAJ-D13 | Tombol hapus hanya ada di slip draf. Slip dihapus permanen tanpa jejak; cicilan kasbonnya dikembalikan. | `handleDeletePayroll` |
| GAJ-D14 | Slip yang sudah disetujui atau lunas tidak punya jalan koreksi. | (tidak ada kodenya) |

### Pembayaran dan aliran ke keuangan

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| GAJ-D15 | "Tandai Lunas" membuka jendela berisi tanggal bayar (awalnya hari ini) dan satu atau lebih sumber dana (rekening atau kas) beserta nominalnya. Jumlah sumber harus pas dengan total gaji bersih. | `openPayModal`, `confirmPaySlip` |
| GAJ-D16 | Tiap slip lunas otomatis menjadi baris Kas Keluar berkategori gaji, langsung berstatus disetujui, bertanggal **tanggal bayar** (bukan periode gaji), dan memakai cabang orangnya **saat ini**. Kalau sumbernya lebih dari satu, tiap slip dibagi sebanding. | `confirmPaySlip` |
| GAJ-D17 | Melunasi adalah empat langkah terpisah yang dijalankan dari layar: ubah status, tandai cicilan kasbon, catat tabungan loyalitas, catat Kas Keluar. Kalau Kas Keluar gagal, slip tetap lunas dan yang muncul hanya pesan. Tidak ada pemeriksaan bahwa slip itu belum lunas sebelumnya. | `applyStatusChange`, `confirmPaySlip` |
| GAJ-D18 | Baris Kas Keluar dari gaji tidak bisa diubah atau dihapus dari menu keuangan. | `lib/finCashOut.ts` |
| GAJ-D19 | Lunas berarti dibayar penuh. Tidak ada bayar sebagian, tidak ada bukti transfer, dan tidak ada tanda terima dari karyawan. | `confirmPaySlip` |
| GAJ-D20 | Yang tercatat di keuangan hanya gaji bersih. Kasbon yang terpotong tidak punya baris sendiri; tiga halaman keuangan masing-masing menghitung "kasbon kembali" dengan membuka slip yang dibayar bulan itu. | `keuangan/dashboard`, `laporan`, `laporan/detail` |
| GAJ-D21 | Keuangan mengenali "pengeluaran gaji" dari daftar kategori yang ditulis di dua halaman, dan isinya berbeda. | `kas-keluar/page.tsx`, `laporan/detail/page.tsx` |
| GAJ-D22 | Kas Keluar berkategori gaji bisa juga diketik tangan tanpa tautan ke slip (9 baris). | `kas-keluar/page.tsx` |
| GAJ-D23 | Fungsi database `fin_autopost_payroll` (cara lama mencatat kas keluar, bertanggal akhir bulan kalender) masih ada tetapi tidak terpasang ke tabel mana pun. | database |

### Yang dilihat karyawan dan cetak

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| GAJ-D24 | Karyawan melihat semua slipnya, **termasuk yang masih draf dan menunggu**. Database tidak menyaring status. | kebijakan `payrolls_read_self`, `portal/slip-gaji` |
| GAJ-D25 | Slip di portal tidak menampilkan potongan tidak hadir, kompensasi libur, bonus tambahan, dan pencairan loyalitas. Baris yang tampil kalau dijumlah tidak sama dengan gaji bersihnya. | `portal/slip-gaji/page.tsx` |
| GAJ-D26 | Rincian telat dan kehilangan barang di portal dihitung ulang saat dibuka, memakai tarif dan persen yang berlaku sekarang. | `fetchLateDetails`, `fetchLossDetail` |
| GAJ-D27 | Dashboard portal menampilkan slip terbaru apa pun statusnya, dan "perkiraan" untuk periode yang baru lewat (aturan tanggal saja). | `portal/page.tsx` |
| GAJ-D28 | Slip dicetak dari halaman admin (versi lengkap) dan dari portal (versi portal). Tidak ada nomor slip, tidak ada berkas tersimpan, dan slip draf pun bisa dicetak. Pilihan tahun di portal hanya tahun ini dan tahun lalu. | `printSlip`, `portal/slip-gaji` |

### Ringkasan

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| GAJ-D29 | "Ringkasan Gaji, Laporan Owner": per periode dan cabang, tiap orang dengan gaji awal, catatan, total potongan, dan gaji akhir. Rincian sakit, izin, dan alpha **dihitung ulang** dari absen saat ini (tanpa izin mendadak dan denda), dan diberi peringatan kalau hasilnya berbeda dari slip. | `ringkasan/page.tsx` |
| GAJ-D30 | "Total potongan telat sepanjang waktu" dijumlah dari semua slip, termasuk yang masih draf. Tab "Riwayat Telat" di halaman slip menghitung hal yang serupa. | `fetchAllTimeLate`, `fetchLateHistory` |
| GAJ-D31 | Semua laporan memakai cabang orangnya saat ini. Kalau seseorang pindah cabang, slip lamanya ikut pindah di laporan. | `ringkasan`, `confirmPaySlip` |

## 3D.4 Menu di sistem lama

| Menu | Dipakai untuk apa | Mirip dengan menu lain? |
|---|---|---|
| Penggajian → Bulanan | Perkiraan, buat slip, rincian, ubah kasbon dan bonus, ajukan, setujui, bayar, cetak, riwayat telat | Satu halaman 3.593 baris memuat seluruh perjalanan slip |
| Penggajian → Ringkasan | Laporan pemilik per periode | Isinya daftar slip yang sama dengan rincian yang dihitung ulang |
| Portal → Slip Gaji | Karyawan melihat dan mencetak slipnya | Versi slip ketiga, kolomnya berbeda |
| Portal → dashboard | Slip terakhir dan perkiraan | Perkiraan dengan rumus sendiri (GAJ-A34) |
| Keuangan → Kas Keluar, Dashboard, Laporan | Pengeluaran gaji dan "kasbon kembali" | Hitungan yang sama di tiga halaman |

## 3D.5 Tumpang tindih

1. **Tampilan slip ditulis empat kali** (rincian di admin, cetakan admin,
   portal, ringkasan), dan tiap versi memuat baris yang berbeda.
2. **Aturan siapa boleh apa** ada di tombol, tidak di database (GAJ-D08).
3. **Melunasi** adalah empat langkah lepas yang seharusnya satu (GAJ-D17).
4. **"Kasbon kembali"** dihitung di tiga halaman keuangan; **daftar kategori
   gaji** ditulis di dua halaman dengan isi berbeda.
5. **Dua perkiraan:** tabel Perkiraan di admin dan perkiraan di portal,
   rumusnya berbeda.
6. **Dua jalan mencatat pengeluaran gaji:** otomatis dari slip dan ketik tangan
   di Kas Keluar (GAJ-D22).

## 3D.6 Kejadian di lapangan dan jalan keluarnya

| Kejadian | Di sistem lama | Ada jalan keluar? |
|---|---|---|
| Slip sudah disetujui, ternyata ada potongan yang salah | Tidak ada tombol mengembalikan | Jalan memutar: tambah bonus tambahan supaya slip kembali ke draf, lalu hapus dan buat ulang |
| Slip sudah lunas, ternyata salah hitung | Tidak ada | Tidak; dibetulkan di luar sistem |
| Salah pilih rekening atau tanggal saat melunasi | Baris Kas Keluar terkunci (GAJ-D18) | Tidak |
| Melunasi banyak slip lalu sambungan putus | Sebagian lunas; Kas Keluar bisa tidak tercatat | Tidak ada tanda. Belum pernah terjadi (61 dari 61 cocok) |
| Dua orang menekan "Lunas" untuk slip yang sama | Tidak ada pemeriksaan; Kas Keluar bisa tercatat dua kali | Tidak. Belum pernah terjadi |
| Karyawan melihat slip draf, lalu angkanya berubah | Slip draf terlihat di portal (GAJ-D24) | Tidak ada penjelasan untuk karyawan |
| Karyawan merasa slipnya salah | Tidak ada tempat mengajukan keberatan | Lewat percakapan di luar sistem |
| Gaji dibayar di luar sistem | 14 slip Mei berstatus "disetujui" selamanya; ada 9 baris Kas Keluar gaji ketik tangan (dugaan: pembayaran Mei, belum terbukti) | Tidak ada cara menandai "sudah dibayar di luar" |
| Orang berhenti di tengah periode | Tidak bisa dibuatkan slip setelah dinonaktifkan (GAJ-A02) | Harus diaktifkan lagi dulu |
| Potongan lebih besar dari gaji | Bersih Rp0, kelebihannya hilang (GAJ-A33) | Tidak dicatat |
| Seseorang pindah cabang | Slip lamanya tampil di cabang baru (GAJ-D31) | Tidak |

## 3D.7 Pertanyaan untuk pemilik (diajukan di percakapan, 12 Oktober 2026)

1. Siapa yang menutup (mengesahkan) slip dan siapa yang membayar; cukup satu
   kali pengesahan atau tetap bertingkat.
2. Tanggal gajian, dan cara karyawan menyampaikan keberatan: sebelum slip
   ditutup, sesudahnya, dan kapan koreksinya dibayar.
3. Potongan lebih besar dari gaji: kelebihannya hangus atau dibawa ke periode
   berikutnya, dan potongan mana yang didahulukan.
4. Pembayaran: selalu penuh atau boleh sebagian; bukti transfer dan tanda
   terima karyawan perlu atau tidak.
5. Slip terakhir orang yang berhenti: dibuat kapan, dan sisa kasbonnya.

## 3D.8 Usulan untuk v3 (belum disetujui)

| No | Usulan | Dasar |
|---|---|---|
| AB1 | Slip dihitung sistem untuk **semua orang sekaligus** begitu periode berakhir. Tidak ada pembuatan satu per satu. | Y1, Y7, GAJ-D01 |
| AB2 | Tiga tahap: **Perkiraan** (belum slip, terus diperbarui) → **Ditutup** (angka terkunci) → **Dibayar**. | GAJ-D06 |
| AB3 | Sistem menolak menutup slip seseorang selama tinjauan absen atau klarifikasinya belum selesai, dan menampilkan apa yang masih kurang. Slip orang lain tidak ikut tertahan. | Y7, KEH-14, KEH-69 |
| AB4 | **Menutup adalah satu langkah di server:** rincian dikunci, cicilan kasbon dan potongan lain ditandai terpotong, Dana Disiplin dan Dana Tidak Hadir bertambah, bonus ditandai sudah masuk slip. Semua terjadi atau tidak sama sekali. | Z9, aturan 20 di 3C.10, GAJ-D17 |
| AB5 | **Membayar adalah satu langkah di server:** tanggal bayar, pembayar, sumber dana, dan catatan keuangan tersimpan bersama, dan satu slip tidak bisa dibayar dua kali. | GAJ-D17 |
| AB6 | **Jalan keluar:** slip yang sudah ditutup tetapi belum dibayar bisa "dibuka kembali" dengan alasan; semua akibat penutupannya dibalik dalam satu langkah. Pembayaran yang salah rekening atau tanggal bisa dibatalkan dengan alasan lalu dibayar ulang. Slip yang sudah dibayar hanya dikoreksi dengan baris baru di slip berikutnya. | WAJ-11, PRI-02, GAJ-D14 |
| AB7 | Slip mencatat siapa dan kapan pada tiap langkah (dihitung, ditutup, dibuka kembali, dibayar, pembayaran dibatalkan). | GAJ-D05 |
| AB8 | Siapa boleh apa dijaga di server, bukan di tombol. | mesin pengaman, GAJ-D08 |
| AB9 | Slip menyimpan cabang dan jabatan orangnya pada periode itu; laporan memakainya. | GAJ-D31 |
| AB10 | **Satu bentuk slip** untuk admin, portal, dan cetakan, diambil dari rincian yang tersimpan. Karyawan melihat semua baris, dan jumlah baris sama dengan gaji bersih. | Y3, AA7, GAJ-D25 |
| AB11 | Karyawan hanya melihat slip yang sudah ditutup. Sebelum itu yang tampil "perkiraan", dengan rumus yang sama. | Y1, GAJ-D24 |
| AB12 | Slip bernomor dan bisa diunduh sebagai berkas; hanya slip tertutup yang bisa dicetak. Semua periode bisa dibuka (dimuat saat diminta). | GAJ-D28, PRI-11 |
| AB13 | Ringkasan dan semua laporan membaca rincian slip yang tersimpan, tidak menghitung ulang. Ringkasan menjadi bagian dari halaman periode gaji, bukan menu terpisah. | Y3, GAJ-D29, D30 |
| AB14 | Pengeluaran gaji di keuangan hanya berasal dari slip; tidak bisa diketik tangan. Keuangan menerima uraiannya (gaji kotor, kasbon kembali, dana disiplin, dan seterusnya) dari slip, bukan menghitung sendiri. Dirinci di Bab 6. | GAJ-D20, D21, D22 |
| AB15 | **Meniadakan potongan telat** dilakukan saat memeriksa perkiraan sebelum slip ditutup, per kejadian, dengan alasan wajib, oleh pengesah slip. Di slip tampil sebagai "ditiadakan" beserta alasannya, dan tidak masuk Dana Disiplin. | aturan 6 di 3A.10, KEH-23, KEH-66 |

## 3D.9 Jawaban pemilik (12 Oktober 2026)

| Butir | Jawaban pemilik | Dicatat sebagai |
|---|---|---|
| 1 pengesah dan pembayar | "saya setuju saran" | Dua langkah. Menutup: HR atau pemilik. Membayar: pemilik saja. Finance hanya melihat |
| 2 tanggal gajian dan keberatan | "setuju saran" | Perkiraan akhir dan keberatan tanggal 26–28; slip ditutup paling lambat hari ke-4 setelah periode berakhir; gajian tanggal 1. Keberatan setelah ditutup diterima 3 hari dan koreksinya masuk slip berikutnya; tidak ada bayar susulan |
| 3 potongan lebih besar dari gaji | "ok saya ikuti saran anda" | Tidak hangus; diambil berurutan, sisanya dibawa ke slip berikutnya; tanpa batas minimal dibawa pulang |
| 4 cara bayar | "slip di bayar full dengan metode bayar yang di tentukan nanti" | Satu slip dibayar sekali dan penuh. Tafsir Claude: cara bayarnya (rekening atau kas, bukti transfer, tanda terima) **diputuskan belakangan**, di Bab 6 |
| 5 slip terakhir | "ok" | Sesuai saran |
| AB1–AB15 | "ok" untuk semuanya | Disetujui semua |
| Tambahan atas AB3 | "tampilkan juga warning ke karyawan, kalau banyak administrasi nya yang belum jelas, kemungkinan gaji nya tidak akan di bayar atau jadi mundur" | Aturan 10 di bawah |

## 3D.10 Aturan yang dihasilkan (nomor v3 ditetapkan di 3E)

1. **Tiga tahap slip:** Perkiraan (belum slip, terus diperbarui) → Ditutup
   (angka terkunci) → Dibayar. (AB2; pengganti GAJ-D06)
2. **Menutup slip:** HR atau pemilik. **Membayar:** pemilik saja. Finance hanya
   melihat. (jawaban 1; pengganti GAJ-D07, D09)
3. **Siapa boleh apa dijaga di server,** bukan di tombol. (AB8; pengganti
   GAJ-D08)
4. **Slip dihitung sistem untuk semua orang sekaligus** begitu periode
   berakhir. Tidak ada pembuatan satu per satu. (AB1; pengganti GAJ-D01, D02,
   D04)
5. **Jadwal gajian:** tanggal 26 sampai 28 karyawan melihat perkiraan akhir di
   portal; slip ditutup paling lambat hari ke-4 setelah periode berakhir
   (tanggal 29; untuk periode yang berakhir 25 Februari jatuh di hari gajian
   itu juga); gaji dibayar tanggal 1. Tanggal-tanggal ini pengaturan bertanggal
   berlaku. (jawaban 2; WAJ-07)
6. **Keberatan karyawan:** diajukan lewat tombol di portal. Sebelum slip
   ditutup, yang benar langsung dibetulkan di perkiraan. Setelah slip ditutup,
   keberatan diterima 3 hari, dan koreksinya masuk slip periode berikutnya
   sebagai baris "koreksi periode lalu". Tidak ada bayar susulan di luar slip.
   (jawaban 2; aturan baru; sejalan aturan 8 di 3B.10 dan 3C.10)
7. **Karyawan hanya melihat slip yang sudah ditutup.** Sebelum itu yang tampil
   "perkiraan" dengan rumus yang sama. (AB11; pengganti GAJ-D24, D27)
8. **Slip seseorang tidak bisa ditutup** selama tinjauan absen atau
   klarifikasinya belum selesai. Sistem menampilkan apa yang masih kurang, dan
   slip orang lain tidak ikut tertahan. (AB3; Y7; KEH-14, KEH-69)
9. **Meniadakan potongan telat** dilakukan saat memeriksa perkiraan sebelum
   slip ditutup, per kejadian, dengan alasan wajib, oleh pengesah slip. Di slip
   tertulis "ditiadakan" beserta alasannya, dan tidak masuk Dana Disiplin.
   (AB15; melengkapi aturan 6 di 3A.10)
10. **Peringatan ke karyawan:** selama masih ada urusannya yang belum beres
    (hari tanpa keterangan, klarifikasi yang belum diajukan atau belum
    diputuskan), portal menampilkan peringatan bahwa gajinya bisa mundur atau
    tertahan, beserta daftar urusannya dan apa yang harus dilakukan. Urusan
    yang menunggu keputusan HR atau pemilik tampil juga di sisi pengesah.
    (tambahan pemilik atas AB3)
11. **Menutup adalah satu langkah di server:** rincian dikunci, cicilan kasbon
    dan potongan lain ditandai terpotong, Dana Disiplin dan Dana Tidak Hadir
    bertambah, bonus ditandai sudah masuk slip. Semua terjadi atau tidak sama
    sekali. (AB4; menetapkan aturan 13 di 3B.10 dan aturan 20 di 3C.10)
12. **Membayar adalah satu langkah di server:** tanggal bayar, pembayar, sumber
    dana, dan catatan keuangan tersimpan bersama. Satu slip tidak bisa dibayar
    dua kali. (AB5; pengganti GAJ-D17)
13. **Satu slip dibayar sekali dan penuh.** Tidak ada bayar sebagian. Cara
    bayarnya ditentukan belakangan (Bab 6). (jawaban 4; bawa GAJ-D19)
14. **Jalan keluar:** slip yang sudah ditutup tetapi belum dibayar bisa
    "dibuka kembali" dengan alasan, dan semua akibat penutupannya dibalik
    dalam satu langkah. Pembayaran yang salah bisa dibatalkan dengan alasan
    lalu dibayar ulang. Slip yang sudah dibayar hanya dikoreksi dengan baris
    baru di slip berikutnya. Slip tidak pernah dihapus. (AB6; WAJ-11; PRI-02;
    pengganti GAJ-D12, D13, D14)
15. **Slip mencatat siapa dan kapan** pada tiap langkah: dihitung, ditutup,
    dibuka kembali, dibayar, pembayaran dibatalkan. (AB7; pengganti GAJ-D05)
16. **Gaji bersih tidak pernah minus, dan kelebihan potongan tidak hangus.**
    Potongan diambil berurutan sampai gaji habis: (a) telat, tidak hadir, dan
    denda; (b) kehilangan barang dan minus kas; (c) potongan lain; (d) kasbon.
    Yang tidak tertampung dibawa ke slip berikutnya dan tampil sebagai baris
    sisa potongan. Tidak ada batas minimal yang harus dibawa pulang. (jawaban
    3; pengganti GAJ-A33)
17. **Slip terakhir orang yang berhenti** dihitung sampai hari terakhir
    bekerja dan dibuat di jadwal biasa; pemilik bisa memintanya dibuat lebih
    cepat. Seluruh sisa kasbon dan potongan lain ditagih di slip itu. Yang
    tidak tertutup gajinya tercatat sebagai piutang ke mantan karyawan.
    (jawaban 5; melengkapi aturan 2 di 3A.10 dan aturan 15 di 3C.10)
18. **Slip menyimpan cabang dan jabatan** orangnya pada periode itu; laporan
    memakainya. (AB9; pengganti GAJ-D31)
19. **Satu bentuk slip** untuk admin, portal, dan cetakan, diambil dari
    rincian yang tersimpan. Karyawan melihat semua baris, dan jumlah baris
    sama dengan gaji bersih. (AB10; pengganti GAJ-D25, D26)
20. **Slip bernomor dan bisa diunduh.** Hanya slip tertutup yang bisa dicetak.
    Semua periode bisa dibuka. (AB12; pengganti GAJ-D28)
21. **Ringkasan dan laporan membaca rincian slip yang tersimpan,** tidak
    menghitung ulang. Ringkasan menjadi bagian halaman periode gaji. (AB13;
    pengganti GAJ-D29, D30)
22. **Pengeluaran gaji di keuangan hanya berasal dari slip** dan tidak bisa
    diketik tangan. Uraiannya dikirim dari slip. (AB14; pengganti GAJ-D20,
    D21, D22; dirinci di Bab 6)

### Yang masih terbuka

1. Cara bayar gaji (aturan 13): ditentukan pemilik belakangan.
2. Asal 9 baris Kas Keluar gaji ketik tangan dan 14 slip Mei yang masih
   "disetujui": belum terbukti. Menyangkut data lama (keputusan terbuka 3 di
   WIP), tidak menghambat v3.

## Titipan dari 3D

- Untuk Bab 5 (Kasbon): cicilan yang tidak tertampung gaji tetap "belum
  terpotong" dan ikut slip berikutnya; sisa kasbon orang berhenti ditagih di
  slip terakhir dan sisanya menjadi piutang.
- Untuk Bab 6 (Keuangan): cara bayar gaji; uraian slip yang dikirim ke
  keuangan; pembatalan pembayaran; piutang mantan karyawan.
- Untuk Bab 1 (Karyawan): menonaktifkan orang tidak boleh menghalangi slip
  terakhirnya.

---

# Bagian 3E: Penetapan

Dikerjakan 12 Oktober 2026. Hasilnya `../03-gaji.md` (GAJ-01 s.d. 57).

## 3E.1 Pertentangan yang ditemukan dan jawaban pemilik

Ke-82 aturan dari 3A.10, 3B.10, 3C.10, dan 3D.10 dicocokkan satu sama lain dan
dengan KAR, KEH, dan PRI. Ditemukan tiga pertentangan dan dua hal yang belum
diatur. Semuanya diajukan di percakapan.

| No | Temuan | Jawaban pemilik | Dicatat sebagai |
|---|---|---|---|
| 1 | "Gaji flat" di sistem lama dipakai 3 pemilik dan di Bab 1 sudah diganti jabatan Pemilik (KAR-18, KAR-59). Aturan 19 di 3B.10 (flat ikut menanggung kehilangan) dan aturan 14 di 3C.10 (flat tetap dapat bonus) tanpa sadar memberlakukannya ke pemilik | "ikuti saran" | Istilah gaji flat dihapus. Jabatan Pemilik: hanya gaji tetap, tidak ikut menanggung kehilangan atau minus kas, tidak menerima bonus (GAJ-08, 09, 19, 30). Jenis: **pengganti** atas aturan 19 di 3B.10 (bagian flat) dan aturan 14 di 3C.10 |
| 2 | PRI-24: gaji pemilik tidak boleh dilihat HR, padahal HR menutup slip; data gaji tidak boleh dilihat jabatan lain, padahal tertulis "finance hanya melihat" | "ok" | Slip Pemilik hanya ditutup pemilik; ringkasan HR tanpa gaji pemilik; finance hanya melihat total per periode dan uraiannya (GAJ-45, 46). Jenis: **pelapis** atas aturan 2 di 3D.10 dan aturan 5 di 3C.10 |
| 3 | KAR-22 membawa tarif lembur dan tarif telat per orang, padahal Bab 3 memakai satu tarif | "ok" | KAR-22 ditulis ulang (pengganti) |
| 4 | Pembulatan rupiah belum diatur (PRI-28) | "ok" | Per baris ke rupiah terdekat, sekali di hasil akhir; sisa pembagian kehilangan ke kantor (GAJ-07) |
| 5 | Rumus "dihitung sebagian" belum ditulis | "ok" | Hari kalender bekerja ÷ hari periode, untuk gaji dan jatah libur; jatah libur dibulatkan ke hari terdekat (GAJ-06) |

Dicatat tanpa ditanyakan, karena hanya melengkapi:

- KEH-79 (hari tutup) kini menyebut hari tutup dibayar, sesuai jawaban 3A.
- Slip terakhir yang dibuat lebih cepat atas permintaan pemilik (aturan 17 di
  3D.10) ditulis sebagai pengecualian atas GAJ-36.

Ditemukan saat menulis, **ditanyakan ke pemilik**: KEH-23 menyebut potongan
telat ditiadakan oleh "pemilik", sedangkan AB15 (3D) menyebut "pengesah slip"
(HR atau pemilik). Saran Claude: pemilik saja, karena meniadakan berarti
melepas uang yang seharusnya masuk Dana Disiplin, dan kejadiannya jarang.
Jawaban pemilik (12 Oktober 2026): "ok". Dicatat di GAJ-11. Jenis:
**pengganti** atas bagian "oleh pengesah slip" di aturan 9 3D.10 (AB15);
KEH-23 tetap.

## 3E.2 Asal aturan

| Nomor v3 | Asal |
|---|---|
| GAJ-01 | GAJ-A01 (bawa), aturan 7 di 3B.10 |
| GAJ-02 | 3A.10 aturan 2; titipan 3D untuk Bab 1 |
| GAJ-03 | 3A.10 aturan 18; GAJ-A06 |
| GAJ-04 | 3A.10 aturan 12 |
| GAJ-05 | 3A.10 aturan 1 |
| GAJ-06 | 3A.10 aturan 2; 3E.1 butir 5 |
| GAJ-07 | 3E.1 butir 4; 3B.10 aturan 18 |
| GAJ-08 | 3A.10 aturan 15; 3E.1 butir 1 |
| GAJ-09 | 3E.1 butir 1; KAR-59 |
| GAJ-10 | 3A.10 aturan 6 |
| GAJ-11 | 3D.10 aturan 9; KEH-23, KEH-66 |
| GAJ-12 | 3A.10 aturan 7, 8; 3B.10 aturan 14, 15 |
| GAJ-13 | 3A.10 aturan 4 |
| GAJ-14 | 3A.10 aturan 5, 9 |
| GAJ-15 | 3A.10 aturan 3 |
| GAJ-16 | 3A.10 aturan 10, 16 |
| GAJ-17 | 3B.10 aturan 1, 2, 3, 16 |
| GAJ-18 | 3B.10 aturan 10, 17, 18 |
| GAJ-19 | 3B.10 aturan 19; 3E.1 butir 1 |
| GAJ-20 | 3B.10 aturan 4 |
| GAJ-21 | 3B.10 aturan 5 |
| GAJ-22 | 3B.10 aturan 12 |
| GAJ-23 | 3B.10 aturan 11 |
| GAJ-24 | 3C.10 aturan 1 |
| GAJ-25 | 3C.10 aturan 3, 10, 22 |
| GAJ-26 | 3C.10 aturan 4, 5 |
| GAJ-27 | 3C.10 aturan 7 |
| GAJ-28 | 3C.10 aturan 12 |
| GAJ-29 | 3C.10 aturan 13 |
| GAJ-30 | 3C.10 aturan 14, 15; 3E.1 butir 1 |
| GAJ-31 | 3C.10 aturan 16 |
| GAJ-32 | 3C.10 aturan 17 |
| GAJ-33 | 3C.10 aturan 18, 19, 20 |
| GAJ-34 | 3C.10 aturan 21, 22 |
| GAJ-35 | 3C.10 aturan 23 |
| GAJ-36 | 3A.10 aturan 11; 3D.10 aturan 4 |
| GAJ-37 | 3D.10 aturan 1 |
| GAJ-38 | 3B.10 aturan 6, 7; 3C.10 aturan 2, 11 |
| GAJ-39 | 3A.10 aturan 13; 3B.10 aturan 9; 3C.10 aturan 9 |
| GAJ-40 | 3D.10 aturan 18 |
| GAJ-41 | 3D.10 aturan 5 |
| GAJ-42 | 3D.10 aturan 6 |
| GAJ-43 | 3A.10 aturan 17; 3D.10 aturan 8 |
| GAJ-44 | 3D.10 aturan 10 |
| GAJ-45 | 3D.10 aturan 2, 3; 3E.1 butir 2 |
| GAJ-46 | 3D.10 aturan 7; 3E.1 butir 2 |
| GAJ-47 | 3B.10 aturan 13; 3D.10 aturan 11 |
| GAJ-48 | 3D.10 aturan 12, 13 |
| GAJ-49 | 3D.10 aturan 14 |
| GAJ-50 | 3B.10 aturan 8; 3C.10 aturan 6, 8 |
| GAJ-51 | 3D.10 aturan 15 |
| GAJ-52 | 3D.10 aturan 16 |
| GAJ-53 | 3D.10 aturan 17 |
| GAJ-54 | 3D.10 aturan 19, 20 |
| GAJ-55 | 3D.10 aturan 21 |
| GAJ-56 | 3D.10 aturan 22 |
| GAJ-57 | 3A.10 aturan 14 |
