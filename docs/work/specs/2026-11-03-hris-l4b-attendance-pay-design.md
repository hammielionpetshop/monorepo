# Spec HRIS L4b — Hitungan Kehadiran

Tanggal: 2026-11-03 · Status: **DRAF — menunggu jawaban owner atas §9**
Cakupan: bagian kedua L4 (Gaji Bulanan), yaitu 4E-2 di [PRD 06](../../hris_planning/PRD/fase_1/06-gaji-bulanan.md) (GAJ-L09, L10), ditambah dua sisa 4E-1 yang memang baru terpakai di sini: **Pengaturan Gaji** (GAJ-L06) dan **Aturan Potongan** (GAJ-L07), sesuai pembagian di spec L4a §1.
Sumber: v3 `03-gaji` GAJ-05 s.d. 16, 23, 39, 67 s.d. 74; `gaji-bulanan-spec` §3.1 (GAJ-L06, L07), §3.2 (rumus R1 s.d. R9, baris denda, GAJ-L09 s.d. L11, isi kartu Aturan Potongan), §8 (angka awal), §13 keputusan K1 s.d. K5 (13 Oktober 2026).
Dasar kode: L2c (tanggal masuk, nonaktif, status kerja Training, penempatan bertanggal), L2e (pengaturan bertanggal, `startDay: 26`), L3c (`effectiveDay`, `dayStatus`, `payPeriodOf`, Rekap), L3e (`day_off_missing_marks`, `day_off_work_requests`), L3f (`absence_days.count_kind`: PERMIT, PERMIT_SUDDEN, SICK, SICK_LETTER, ANNUAL_LEAVE, BEREAVEMENT), L3g (`clarification_events`, `forgotKindOf`, `forgotSequence`, telat yang dijelaskan dan disetujui), L3h (`overtime_claims.approved_hours`), L4a (`monthlyTotal`, `dailyRate`, paket gaji berlaku, `isPeriodLocked`, `salary_owner_only`).
Aliran migrasi: **`hris` 0017**. Modul: `apps/hris/modules/payroll` (lanjutan), pembaca baru di `modules/attendance`.

## 1. Batas

**Pokoknya (v3 4E-2):** Kehadiran menyimpan **apa yang terjadi** (menit, hari, jam, kejadian ke-n), sedangkan Gaji menghitung **berapa rupiahnya**. Semua rupiah dari kehadiran keluar dari **satu fungsi di server**, `attendancePay(orang, periode)`. Fungsi ini nanti dipanggil lagi oleh slip (4E-5a) dan Pendapatan Saya (4E-5c). Tidak ada rumus kedua.

**Dikerjakan:** 13 angka Pengaturan Gaji dan satu pengaturan jabatan baru (§3.1); fungsi hitungan kehadiran R1 s.d. R8 (§3.2); tab **Hitungan** di Gaji Seseorang (GAJ-L09); layar **Tiadakan Potongan** (GAJ-L10); layar **Aturan Potongan** dengan contoh hitungan dari fungsi yang sama (GAJ-L07).

**Tidak dikerjakan di L4b** (§9 butir 1):

| Hal | Di mana | Akibat sementara |
|---|---|---|
| Koreksi Periode Lalu (R9, GAJ-L11) | 4E-5a (butuh slip yang sudah **ditutup** sebagai pembanding) | Belum ada slip yang ditutup. Hitungan selalu dihitung ulang dari data terbaru, jadi koreksi absen yang mundur ke periode berjalan **langsung terbaca** |
| Halaman periode dan hitungan semua orang sekaligus | 4E-5a (Periode Slip) | Satu orang per layar; daftar Tiadakan Potongan memberi gambaran per periode |
| Karyawan melihat hitungannya sendiri | 4E-5c (Pendapatan Saya) | Karyawan hanya membaca Aturan Potongan |
| Akibat lewat batas istirahat (KEH-86) | — | Tetap **kosong**, hanya dicatat Kehadiran (K5 v3) |
| Usulan HR untuk Pengaturan Gaji | menyusul bersama usulan pengaturan umum | Pemilik/GM mengubah langsung, HR melihat (§9 butir 8) |
| Kehilangan barang, minus kas, Potongan Lain, urutan dan sisa potongan | L4c (4E-3) | Hitungan ini hanya menampilkan jumlah potongan kehadiran, belum dipotongkan ke gaji |

## 2. Data (`hris` 0017)

Hanya satu tabel baru. Hitungan dan denda **dibaca saat diminta**, tidak disimpan (§9 butir 3), mengikuti pola L4a (gaji dibaca menurut tanggal) dan L3c (catatan hari dihitung saat dibaca). Yang disimpan hanya keputusan manusia.

| Tabel | Isi |
|---|---|
| `pay_waivers` (peniadaan potongan) | karyawan, jenis (`LATE` / `FINE`), tanggal kerja, jenis denda (`FORGOT_IN` / `FORGOT_OUT` / `FORGOT_RETURN` / `DAY_OFF_MISSING`; kosong untuk telat), alasan, oleh (akun + karyawan), kapan, dibatalkan oleh/kapan/alasan. Pagar: satu peniadaan berlaku per orang + jenis + tanggal + jenis denda (indeks unik sebagian `WHERE cancelled_at IS NULL`); alasan tidak kosong; pembatalan lengkap |

Isi awal di migrasi: nilai 13 pengaturan Gaji baru (sasaran ALL, berlaku 2026-10-26, §3.1), `position.day_off_compensation` per jabatan, tindakan baru dan haknya (§5).

## 3. Aturan

### 3.1 Pengaturan Gaji (GAJ-L06)

Semuanya `module: 'payroll'`, `affectsMoney`, `startDay: 26` (satu slip memakai satu angka untuk satu aturan, G6 v3), `mustAnnounce`, `review: OWNER_DIRECT`. Diubah di layar Pengaturan yang sudah ada (kelompok **Gaji**). Angka awal mengikuti v3 §8 (§9 butir 2).

| Kunci | Isi | Angka awal |
|---|---|---|
| `payroll.late_rate` | Tarif telat per menit | Rp1.000 |
| `payroll.overtime_rate` | Tarif lembur per jam disahkan | Rp7.500 |
| `payroll.ladder_permit_sick` | Pengali izin dan sakit tanpa surat (hari ke-1, ke-2, …; angka terakhir berulang) | 1; 1,25; 1,5; 1,75; 2 |
| `payroll.ladder_permit_sudden` | Pengali izin mendadak | 1,25; 1,5; 1,6; 1,7; 1,8; 1,9; 2 |
| `payroll.ladder_alpha` | Pengali alpha | 1,5; 2; 2,25; 2,5; 2,75; 3 |
| `payroll.ladder_sick_letter` | Pengali sakit dengan surat dokter | 0; 0,5; 0,5; 1 |
| `payroll.ladder_training` | Pengali Training (izin, sakit tanpa surat, izin mendadak, alpha) | 1 |
| `payroll.day_off_compensation` | Kompensasi masuk di hari libur karena diminta, × gaji harian | 1 |
| `payroll.fine_forgot_in` | Denda lupa absen masuk | Rp15.000 |
| `payroll.fine_forgot_out` | Denda lupa absen pulang | Rp5.000 |
| `payroll.fine_forgot_return` | Denda lupa Masuk Kembali | Rp5.000 |
| `payroll.fine_day_off_missing` | Denda tidak memilih libur (sekali per periode) | Rp10.000 |
| `payroll.fine_forgot_surcharge` | Tambahan denda lupa absen mulai kejadian ke-5 pada jenisnya sendiri | Rp5.000 |

Pengaturan jabatan baru `position.day_off_compensation` ("Dapat kompensasi libur", Ya/Tidak, `PROPOSE_APPROVE` seperti pengaturan jabatan lain). Isi awal: Ya untuk semua jabatan kecuali Pemilik dan GM (§9 butir 5).

**Jenis nilai baru di registry:** `decimal` (pengali tunggal) dan `ladder` (daftar pengali, paling banyak 10 angka, tiap angka 0 s.d. 5 dengan paling banyak 2 angka di belakang koma). Disimpan sebagai JSON di `setting_values.value` yang sudah `jsonb`. Layar ubah pengaturan menampilkan pengali sebagai deret "1 · 1,25 · 1,5 · …" dan kotak isian dengan pemisah titik koma. Angka "kejadian ke-5" tetap konstanta `FORGOT_SURCHARGE_FROM` dari L3g, tidak dijadikan pengaturan.

Semua angka dibaca **menurut tanggal kejadiannya** (WAJ-07). Karena angka gaji hanya berubah tanggal 26, satu periode selalu memakai satu angka.

### 3.2 Rumus (satu fungsi `attendancePay`)

Masukan: orang + awal periode (tanggal 26). Perlakuan jabatan (kena telat, dapat lembur, dapat kompensasi libur) dibaca dari **jabatan orang itu pada tanggal kejadian**. Jabatan Pemilik hanya mendapat R1 (GAJ-09). Orang ber-`pay_basis = WEEKLY` tidak dihitung di sini (L7).

| No | Baris | Rumus | Dibaca dari |
|---|---|---|---|
| R1 | **Gaji tetap** | Jumlah komponen berlaku (L4a). Masuk atau berhenti di tengah periode: × hari kalender bekerja ÷ jumlah hari periode, dari tanggal masuk sampai hari terakhir bekerja, keduanya ikut dihitung (GAJ-06) | Paket gaji L4a, tanggal masuk + tanggal nonaktif L2c |
| R2 | Gaji harian (angka pembantu, bukan baris) | Gaji tetap sebulan **penuh** ÷ `payroll.daily_divisor`, tidak dibulatkan (GAJ-05, 07) | L4a `dailyRate` |
| R3 | **Telat** | Tiap hari kerja: menit telat ≤ toleransi → 0; lebih → **seluruh** menit × tarif (GAJ-10). Hari yang ditiadakan (manual §3.4, atau telat yang **dijelaskan dan disetujui** di L3g) bernilai 0 dan tetap tampil | `effectiveDay` L3c (menit telat sesudah koreksi), `attendance.late_tolerance_minutes`, `position.late_applies` |
| R4 | **Tidak hadir** | Hari Izin, Sakit, atau Alpha diberi pengali dari tangganya, lalu **jumlah pengali × gaji harian**. Satu baris per tangga (§3.3) | `absence_days.count_kind` L3f, status Alpha L3g |
| R5 | Dibayar penuh (keterangan tanpa rupiah) | Libur terjadwal, cuti tahunan, izin duka, hari tutup (GAJ-14) | L3e, L3f, L3a |
| R6 | **Lembur** | Jumlah **jam disahkan** dalam periode × tarif (GAJ-12). Jam sudah bulat dari L3h; tidak dibulatkan lagi | `overtime_claims.approved_hours` berstatus disahkan, menurut tanggal kerja |
| R7 | **Kompensasi libur** | Hari libur terjadwal yang dipakai masuk karena **diminta** (Minta Masuk L3e) **dan** benar-benar absen masuk × gaji harian × `payroll.day_off_compensation` (GAJ-15). Tetap dibayar walau libur penggantinya hangus (KEH-138). Hanya jabatan "Dapat kompensasi libur" | `day_off_work_requests` yang tidak dibatalkan + absen masuk hari itu |
| R8 | **Denda kehadiran** | Lupa absen masuk/pulang/Masuk Kembali yang penjelasannya **disetujui** (sedang berlaku, tidak dicabut): denda dasar jenisnya + tambahan bila kejadian ke-5 atau lebih **pada jenisnya sendiri** di periode itu. Ditambah tanda **tidak memilih libur** periode itu (tanpa tambahan). Denda yang ditiadakan bernilai 0 dan tetap tampil | `clarification_events` + `forgotKindOf` + `forgotSequence` L3g, `day_off_missing_marks` L3e |

**Pembulatan (GAJ-07):** tiap baris R1, R3, R4, R6, R7, R8 dibulatkan ke rupiah terdekat (,5 ke atas) **satu kali pada jumlah barisnya**. Rincian per hari tampil apa adanya sebagai keterangan. Hitungan memakai bilangan bulat pasti: pengali disimpan dalam perseratus, dan pembagian baru dilakukan sekali di akhir. Tidak ada pecahan desimal di tengah hitungan.
Contoh v3: gaji Rp2.900.000, alpha 2 hari = (1,5 + 2) × 2.900.000 ÷ 26 = 390.384,6… → **Rp390.385**.

**Hari belum ditentukan** (tanpa absen, tanpa pengajuan, belum ditandai mesin alpha) tidak dipotong dan tampil kuning "belum ditentukan". Begitu juga hari sebelum data Kehadiran ada di sistem.

**Yang tidak memotong:** penjelasan yang masih **menunggu** keputusan (dihitung sesudah diputuskan); izin/sakit yang masih menunggu dihitung sesuai jenisnya, bertanda "menunggu keputusan" (L3f: hari berlaku = Menunggu atau Disetujui).

### 3.3 Tangga tidak hadir (K1, K2 v3)

- Tiga tangga **terpisah**, masing-masing berlanjut sepanjang periode menurut urutan tanggal: (a) izin + sakit tanpa surat, (b) izin mendadak, (c) alpha. Contoh: izin 1 hari lalu alpha 1 hari = 1 + 1,5.
- Sakit dengan surat dihitung **per periode**: hari sakit-dengan-surat pertama di periode itu bernilai 0, dan seterusnya mengikuti tangga, bukan per rangkaian sakit.
- **Training** (status kerja dibaca per periode, karena promosi berlaku awal periode): izin, sakit tanpa surat, izin mendadak, dan alpha semuanya memakai `payroll.ladder_training` (awal 1, tidak naik). Sakit dengan surat tetap memakai tangga surat (§9 butir 6).
- Hari yang hitungannya berubah (surat dokter menyusul: SICK → SICK_LETTER; penjelasan alpha disetujui menjadi hadir) **menggeser tangga hari sesudahnya** dengan sendirinya, karena seluruh periode selalu dihitung ulang.

### 3.4 Tiadakan Potongan (GAJ-L10, K3 v3)

- **Pemilik atau GM** meniadakan potongan **telat** atau **denda kehadiran**, satu kejadian per keputusan. Alasan wajib (`shared.reason_min_length`). Layar periksa: "Potongan telat Rina 12 November, 40 menit, Rp40.000, ditiadakan." Tombol ditahan (`shared.hold_seconds_consequential`). Tidak ada "Tiadakan semua".
- **Batalkan peniadaan** boleh dengan alasan. Riwayat keduanya tetap.
- **Ditolak server:** bukan Pemilik/GM; kejadian milik dirinya sendiri; potongannya Rp0 (dalam toleransi, sudah dijelaskan, atau sudah ditiadakan); periode terkunci (`isPeriodLocked`, di L4b selalu "tidak", aktif di 4E-5a dengan pesan "Sudah masuk slip yang ditutup. Koreksinya lewat slip berikutnya"); orang ber-`salary_owner_only` oleh yang bukan Pemilik/GM.
- **Telat yang dijelaskan dan disetujui** sudah otomatis ditiadakan sejak L3g (GAJ-11). Karena itu bagian "Usulan untuk ditiadakan" di v3 (telat > 30 menit yang dijelaskan) **tidak dibuat**: semuanya tampil di daftar sebagai "Ditiadakan lewat penjelasan", tanpa tombol (§9 butir 4).
- Peniadaan **tidak mengubah urutan ke-n** denda; kejadiannya tetap terhitung, hanya rupiahnya nol.

### 3.5 Aturan Potongan (GAJ-L07)

- Satu kartu per aturan: gaji harian, masuk di tengah periode, telat, izin dan sakit tanpa surat, izin mendadak, alpha, sakit dengan surat, Training, yang tidak dipotong, lembur, kompensasi libur, denda lupa absen, dan denda tidak memilih libur. Isi tiap kartu: kalimat sehari-hari, angka **yang berlaku hari ini**, angka berikutnya bila sudah terjadwal ("mulai 26 Desember 2026 menjadi …"), dan **satu contoh**.
- Contoh **dihitung oleh fungsi yang sama** dengan orang contoh bergaji Rp2.600.000, bukan diketik. Jadi bila pengaturan berubah, contohnya ikut berubah.
- Kartu yang tampil mengikuti jabatan pembaca: jabatan tanpa telat tidak melihat kartu telat, jabatan tanpa lembur tidak melihat kartu lembur, dan kartu Training hanya untuk orang berstatus Training. HR, Pemilik, dan GM melihat semua kartu. Kartu kehilangan barang, minus kas, dan urutan potongan ditambahkan di L4c.

## 4. Layar

| Layar | Alamat | Menu |
|---|---|---|
| Hitungan Kehadiran (GAJ-L09) | `/gaji/[employeeId]/hitungan?periode=2026-10-26` (tab **Hitungan** di Gaji Seseorang) | dari Gaji Karyawan |
| Tiadakan Potongan (GAJ-L10) | `/gaji/tiadakan?periode=…` | **Kantor › Tiadakan Potongan** (baru) |
| Aturan Potongan (GAJ-L07) | `/panduan/aturan-potongan` | **Panduan › Aturan Potongan** (kelompok menu baru) |
| Pengaturan Gaji (GAJ-L06) | kelompok **Gaji** di `/pengaturan/umum` yang sudah ada | Pengaturan |

- **Hitungan Kehadiran:** kepala berisi nama, periode (pilihan periode berjalan dan periode lalu; yang lebih lama dimuat saat diminta), "Perkiraan, dihitung pukul 14.05", gaji tetap sebulan, dan gaji harian. Isinya satu kartu per baris R1, R3, R4, R6, R7, R8 yang berisi. Tiap kartu memuat jumlah rupiah, kalimat aturan, dan rincian yang bisa dibuka (tanggal, angka dari Kehadiran, pengali atau tarif, hasil). Tanda yang mungkin muncul: "ditiadakan" + alasan, "ditiadakan lewat penjelasan", "dalam toleransi", "diisi lewat klarifikasi", "menunggu keputusan", "belum ditentukan". Baris keterangan R5: "Libur 4, cuti 1, hari tutup 1: dibayar penuh". Di bawahnya ringkasan: **Gaji tetap + tambahan − potongan kehadiran = perkiraan** dengan catatan "belum termasuk potongan lain dan bonus". Tombol yang ada: **Lihat aturan** (ke kartu Aturan Potongan) dan, untuk Pemilik/GM, **Tiadakan** di rincian telat dan denda.
- **Tiadakan Potongan:** semua potongan telat dan denda periode itu yang tercatat, termasuk yang sudah ditiadakan. Bisa disaring per cabang, orang, jenis, dan status (Dipotong / Ditiadakan / Ditiadakan lewat penjelasan). Per baris: orang, tanggal, jenis, menit atau kejadian ke-n, rupiah, status, dan tombol **Tiadakan** atau **Batalkan peniadaan** (Pemilik/GM). HR melihat tanpa tombol.
- Semua rupiah memakai pemisah ribuan, pesan error muncul di jendela "OK, paham", dan ketiga menu baru diberi tanda **Baru**.

## 5. Hak

| Tindakan | HR | Admin HR | Finance | Karyawan | Pemilik, GM |
|---|---|---|---|---|---|
| Lihat Hitungan Kehadiran dan daftar Tiadakan (memakai `salary.view` yang sudah ada; orang ber-`salary_owner_only` tidak dikirim) | ✓ | — | — | — | ✓ |
| `pay_waiver.manage` (Tiadakan, Batalkan peniadaan) · ownerOnly · selfForbidden | — | — | — | — | ✓ |
| Aturan Potongan (tanpa tindakan khusus; semua orang yang masuk HRIS) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Ubah Pengaturan Gaji (`settings.manage` yang sudah ada) | lihat | — | — | — | ✓ |

Penolakan server yang dites: HR meniadakan; Pemilik/GM meniadakan potongannya sendiri; meniadakan potongan Rp0; dua peniadaan berlaku untuk kejadian yang sama; HR membuka hitungan orang ber-`salary_owner_only`; Admin HR/Finance membuka hitungan; pengaturan pengali di luar batas, dengan lebih dari 2 angka desimal, atau tidak dimulai tanggal 26.

## 6. Mesin terjadwal

Tidak ada mesin baru. Hitungan dan denda dihitung saat dibaca, sehingga penjelasan yang dicabut, surat dokter yang menyusul, koreksi absen, dan peniadaan langsung terbaca tanpa penulis atau penyelaras.

## 7. Pemberitahuan

| Kapan | Ke siapa | Isi (tanpa nominal) |
|---|---|---|
| Potongan ditiadakan | orangnya | "Potongan telat 12 November ditiadakan." / "Denda lupa absen pulang 12 November ditiadakan." |
| Peniadaan dibatalkan | orangnya | "Peniadaan potongan telat 12 November dibatalkan." |
| Pemilik/GM meniadakan | pemilik lain (`announceToOwners`) | "Elan meniadakan potongan telat Rina 12 November." |

## 8. Tes

- **Unit** (`modules/payroll/rules/attendance-pay`): prorata masuk dan berhenti; telat (dalam toleransi, lebih, ditiadakan, dijelaskan, jabatan tanpa telat); tiga tangga terpisah dan angka terakhir berulang (U17 v3); sakit dengan surat per periode (U18); Training (U19); izin duka dan cuti tidak dipotong; lembur; kompensasi libur (diminta + masuk; diminta tetapi tidak masuk = 0); denda ke-5 per jenis, dicabut menggeser urutan, ditiadakan tetap terhitung; tidak memilih libur; pembulatan sekali per baris (contoh Rp390.385); Pemilik hanya R1; contoh Aturan Potongan sama dengan tabel kartu v3 (Rp100.000 per hari, telat 6 menit Rp6.000, alpha 2 hari Rp350.000, sakit dengan surat 4 hari Rp200.000, dan lainnya).
- **Integrasi DB** (tanggal lampau): hitungan satu orang dari data absen, izin, alpha, lembur, dan penjelasan nyata; surat dokter menyusul menggeser tangga; Tiadakan dan Batalkan beserta pemberitahuannya; pagar hak (§5); pagar unik peniadaan; pengaturan bertanggal 26 dibaca menurut tanggal kejadian.
- **Registry**: 13 pengaturan Gaji + 1 pengaturan jabatan baru terdaftar dengan jenis nilai yang benar; jenis `ladder`/`decimal` tervalidasi; `pay_waiver.manage` ada di daftar tindakan dan hak awal.

## 9. Keputusan owner (menunggu jawaban)

1. **Lingkup L4b.** **Saran: Pengaturan Gaji + Hitungan Kehadiran + Tiadakan Potongan + Aturan Potongan.** Koreksi Periode Lalu ditunda ke 4E-5a karena baru berguna sesudah ada slip yang ditutup. Sampai saat itu hitungan selalu memakai data terbaru, jadi koreksi tetap terbaca.
2. **Angka awal pengaturan** (§3.1). **Saran: pakai angka v3** (telat Rp1.000/menit, lembur Rp7.500/jam, tangga izin 1–2, izin mendadak 1,25–2, alpha 1,5–3, sakit dengan surat 0/0,5/0,5/1, Training 1, kompensasi 1× gaji harian, denda lupa masuk Rp15.000, lupa pulang Rp5.000, lupa Masuk Kembali Rp5.000, tidak memilih libur Rp10.000, tambahan ke-5 Rp5.000). Kalau angka yang dipakai di HRIS lama sekarang berbeda, sebutkan, nanti saya tanam di migrasi.
3. **Denda dihitung saat dibaca, tidak disimpan sebagai baris tersendiri.** v3 menulis baris denda saat penjelasan disetujui, lalu membatalkan dan menulis ulang bila dicabut. **Saran: dihitung langsung dari penjelasan yang berlaku**, supaya pencabutan dan urutan ke-n tidak pernah selisih. Baris tetap baru disimpan saat slip ditutup (4E-5a).
4. **Telat yang dijelaskan.** Sejak L3g, telat yang penjelasannya disetujui **otomatis tidak dipotong**. **Saran: tetap begitu.** Bagian "usulan untuk ditiadakan" di v3 tidak dibuat; Pemilik/GM bisa meniadakan telat dan denda lain secara manual, satu per satu.
5. **Kompensasi libur.** **Saran: pengaturan jabatan baru "Dapat kompensasi libur", Ya untuk semua jabatan kecuali Pemilik dan GM.**
6. **Training.** **Saran: ikut v3** — izin, sakit tanpa surat, izin mendadak, dan **alpha** semuanya pengali 1 (tidak naik); sakit dengan surat tetap memakai aturan surat yang lebih ringan.
7. **Siapa melihat.** **Saran: hitungan per orang hanya HR, Pemilik, dan GM** (karyawan melihat miliknya sendiri di 4E-5c Pendapatan Saya). **Aturan Potongan dibuka untuk semua karyawan** karena tidak memuat gaji siapa pun.
8. **Siapa mengubah Pengaturan Gaji.** v3: HR mengusulkan, Pemilik/GM menyetujui. Mekanisme usulan baru ada untuk Pengaturan Jabatan. **Saran: di L4b Pemilik/GM mengubah langsung dan HR hanya melihat** (sama dengan pembagi gaji harian di L4a); usulan HR untuk pengaturan umum dibuat menyusul.
