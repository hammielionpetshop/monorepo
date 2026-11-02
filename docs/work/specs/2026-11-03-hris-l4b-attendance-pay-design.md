# Spec HRIS L4b — Hitungan Kehadiran

Tanggal: 2026-11-03 · Status: **disetujui owner 2026-11-03** (§9 semua sesuai saran, kecuali butir 2: Pengaturan Gaji dibuat sebagai layar sendiri **Potongan & Lembur** seperti HRIS lama, dengan angka yang sedang berlaku di HRIS lama)
Cakupan: bagian kedua L4 (Gaji Bulanan), yaitu 4E-2 di [PRD 06](../../hris_planning/PRD/fase_1/06-gaji-bulanan.md) (GAJ-L09, L10), ditambah dua sisa 4E-1 yang memang baru terpakai di sini: **Pengaturan Gaji** (GAJ-L06) dan **Aturan Potongan** (GAJ-L07), sesuai pembagian di spec L4a §1.
Sumber: v3 `03-gaji` GAJ-05 s.d. 16, 23, 39, 67 s.d. 74; `gaji-bulanan-spec` §3.1 (GAJ-L06, L07), §3.2 (rumus R1 s.d. R9, baris denda, GAJ-L09 s.d. L11, isi kartu Aturan Potongan), §8 (angka awal), §13 keputusan K1 s.d. K5 (13 Oktober 2026).
Dasar kode: L2c (tanggal masuk, nonaktif, status kerja Training, penempatan bertanggal), L2e (pengaturan bertanggal, `startDay: 26`), L3c (`effectiveDay`, `dayStatus`, `payPeriodOf`, Rekap), L3e (`day_off_missing_marks`, `day_off_work_requests`), L3f (`absence_days.count_kind`: PERMIT, PERMIT_SUDDEN, SICK, SICK_LETTER, ANNUAL_LEAVE, BEREAVEMENT), L3g (`clarification_events`, `forgotKindOf`, `forgotSequence`, telat yang dijelaskan dan disetujui), L3h (`overtime_claims.approved_hours`), L4a (`monthlyTotal`, `dailyRate`, paket gaji berlaku, `isPeriodLocked`, `salary_owner_only`).
Aliran migrasi: **`hris` 0017**. Modul: `apps/hris/modules/payroll` (lanjutan), pembaca baru di `modules/attendance`.

## 1. Batas

**Pokoknya (v3 4E-2):** Kehadiran menyimpan **apa yang terjadi** (menit, hari, jam, kejadian ke-n), sedangkan Gaji menghitung **berapa rupiahnya**. Semua rupiah dari kehadiran keluar dari **satu fungsi di server**, `attendancePay(orang, periode)`. Fungsi ini nanti dipanggil lagi oleh slip (4E-5a) dan Pendapatan Saya (4E-5c). Tidak ada rumus kedua.

**Dikerjakan:** layar **Potongan & Lembur** (Pengaturan Gaji, satu set angka bertanggal berlaku) dan satu pengaturan jabatan baru (§3.1); fungsi hitungan kehadiran R1 s.d. R8 (§3.2); tab **Hitungan** di Gaji Seseorang (GAJ-L09); layar **Tiadakan Potongan** (GAJ-L10); layar **Aturan Potongan** dengan contoh hitungan dari fungsi yang sama (GAJ-L07).

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

### 3.1 Potongan & Lembur (Pengaturan Gaji, GAJ-L06)

Keputusan owner (2026-11-03): seperti HRIS lama, angka potongan dan lembur diatur di **satu layar khusus** `/pengaturan/potongan-lembur` (menu **Pengaturan › Potongan & Lembur**), bukan tersebar di layar Pengaturan umum. Bentuk isiannya meniru layar HRIS lama (`penggajian/potongan-lembur`) supaya terasa sama: tangga diisi **Hari ke-1 · Naik tiap hari · Mentok di**.

**Cara simpan:** tiap angka tetap satu kunci pengaturan bertanggal L2e (`module: payroll`, `affectsMoney`, `startDay: 26`, `mustAnnounce`, `review: OWNER_DIRECT`), jadi riwayat, jejak, dan "berlaku mulai" memakai mesin yang sudah ada. Layar Potongan & Lembur menyimpan **semua angka yang diubah sekaligus** dengan satu tanggal berlaku (tanggal 26: periode berjalan atau 3 periode depan) dan satu alasan, dalam satu transaksi. Kunci `payroll.*` tidak ditampilkan lagi di `/pengaturan/umum`; di sana hanya ada tautan ke layar ini. Pembagi gaji harian (`payroll.daily_divisor`, L4a) ikut pindah ke layar ini.

**Isi layar dan angka awal** = set yang **sedang berlaku di HRIS lama** (tabel `payroll_rules`, berlaku sejak 26 September 2026, diubah owner 2 November 2026), ditanam berlaku 2026-10-26:

| Bagian | Kunci | Isian | Angka awal |
|---|---|---|---|
| Lembur | `payroll.overtime_rate` | Rp per jam disahkan | **Rp10.000** |
| Telat | `payroll.late_rate` | Rp per menit | Rp1.000 |
| Izin & sakit tanpa surat | `payroll.ladder_permit_sick` | Hari ke-1 · naik tiap hari · mentok di (× gaji harian) | **1 · 0 · 2** (rata 1×) |
| Izin mendadak | `payroll.ladder_permit_sudden` | idem, hitungan hari sendiri | **1 · 0 · 2** (rata 1×) |
| Alpha | `payroll.ladder_alpha` | idem, hitungan hari sendiri | **1 · 0 · 2** (rata 1×) |
| Sakit dengan surat dokter | `payroll.sick_letter` | hari ke-1 · hari ke-2 & 3 · hari ke-4 dst | 0 · 0,5 · 1 |
| Training | `payroll.training_multiplier` | potongan per hari, tidak naik | 1 |
| Kompensasi libur | `payroll.day_off_compensation` | × gaji harian per hari libur yang diminta masuk | 1 |
| Denda lupa absen | `payroll.fine_forgot_in` · `fine_forgot_out` · `fine_forgot_return` | Rp per kejadian | Rp15.000 · Rp5.000 · Rp5.000 |
| Denda lupa absen | `payroll.fine_forgot_surcharge` | tambahan mulai kejadian ke-5 pada jenisnya sendiri | Rp5.000 |
| Denda tidak memilih libur | `payroll.fine_day_off_missing` | Rp sekali per periode | Rp10.000 |
| Gaji harian | `payroll.daily_divisor` (L4a) | pembagi | 26 |

Denda tidak ada di layar HRIS lama (nilainya tertanam di kode: masuk Rp15.000, pulang Rp5.000, sama dengan v3); di sini ikut diatur di layar yang sama. Batas jam lembur per hari (`attendance.overtime_min_hours`/`max_hours`, L3h) tetap milik Kehadiran; bagian Lembur menampilkannya sebagai keterangan beserta tautan ke Pengaturan.

**Bentuk tangga** = `{ start, step, max }` seperti HRIS lama: pengali hari ke-n = min(start + (n−1) × step, max); step 0 = tidak naik. Jenis nilai baru di registry: `escalation` (`{start, step, max}`, tiap angka 0 s.d. 5, paling banyak 2 angka di belakang koma, start ≤ max), `sickLetter` (tiga angka), dan `decimal`. Disimpan sebagai JSON di `setting_values.value` (sudah `jsonb`). Layar menampilkan deret hasilnya, mis. "1,5× · 1,7× · 1,9× · 2×", di bawah isian. Kejadian ke-5 tetap konstanta `FORGOT_SURCHARGE_FROM` (L3g).

Layar menampilkan **set yang berlaku sekarang** dan **set terjadwal** (bila ada, dengan tombol Batalkan sebelum berlaku), lalu riwayat set sebelumnya. Langkah simpan: isi → berlaku mulai + alasan → periksa (lama → baru per angka yang berubah, tombol ditahan) → simpan.

Pengaturan jabatan baru `position.day_off_compensation` ("Dapat kompensasi libur", Ya/Tidak, `PROPOSE_APPROVE` di Pengaturan Jabatan). Isi awal: Ya untuk semua jabatan kecuali Pemilik dan GM.

Semua angka dibaca **menurut tanggal kejadiannya** (WAJ-07). Karena hanya berubah tanggal 26, satu periode selalu memakai satu set angka.

### 3.2 Rumus (satu fungsi `attendancePay`)

Masukan: orang + awal periode (tanggal 26). Perlakuan jabatan (kena telat, dapat lembur, dapat kompensasi libur) dibaca dari **jabatan orang itu pada tanggal kejadian**. Jabatan Pemilik hanya mendapat R1 (GAJ-09). Orang ber-`pay_basis = WEEKLY` tidak dihitung di sini (L7).

| No | Baris | Rumus | Dibaca dari |
|---|---|---|---|
| R1 | **Gaji tetap** | Jumlah komponen berlaku (L4a). Masuk atau berhenti di tengah periode: × hari kalender bekerja ÷ jumlah hari periode, dari tanggal masuk sampai hari terakhir bekerja, keduanya ikut dihitung (GAJ-06) | Paket gaji L4a, tanggal masuk + tanggal nonaktif L2c |
| R2 | Gaji harian (angka pembantu, bukan baris) | Gaji tetap sebulan **penuh** ÷ `payroll.daily_divisor`, tidak dibulatkan (GAJ-05, 07) | L4a `dailyRate` |
| R3 | **Telat** | Tiap hari kerja: menit telat ≤ toleransi → 0; lebih → **seluruh** menit × tarif (GAJ-10). Hari yang ditiadakan (manual §3.4, atau telat yang **dijelaskan dan disetujui** di L3g) bernilai 0 dan tetap tampil | `effectiveDay` L3c (menit telat sesudah koreksi), `attendance.late_tolerance_minutes`, `position.late_applies` |
| R4 | **Tidak hadir** | Hari Izin, Sakit, atau Alpha diberi pengali dari tangganya, lalu **jumlah pengali × gaji harian**. Satu baris per tangga (§3.3) | `absence_days.count_kind` L3f, status Alpha L3g |
| R5 | Dibayar penuh (keterangan tanpa rupiah) | Libur terjadwal, cuti tahunan, hari tutup (GAJ-14). **Izin duka tidak termasuk**: ikut tangga izin seperti HRIS lama (keputusan owner 2026-11-03) | L3e, L3f, L3a |
| R6 | **Lembur** | Jumlah **jam disahkan** dalam periode × tarif (GAJ-12). Jam sudah bulat dari L3h; tidak dibulatkan lagi | `overtime_claims.approved_hours` berstatus disahkan, menurut tanggal kerja |
| R7 | **Kompensasi libur** | Hari libur terjadwal yang dipakai masuk karena **diminta** (Minta Masuk L3e) **dan** benar-benar absen masuk × gaji harian × `payroll.day_off_compensation` (GAJ-15). Tetap dibayar walau libur penggantinya hangus (KEH-138). Hanya jabatan "Dapat kompensasi libur" | `day_off_work_requests` yang tidak dibatalkan + absen masuk hari itu |
| R8 | **Denda kehadiran** | Lupa absen masuk/pulang/Masuk Kembali yang penjelasannya **disetujui** (sedang berlaku, tidak dicabut): denda dasar jenisnya + tambahan bila kejadian ke-5 atau lebih **pada jenisnya sendiri** di periode itu. Ditambah tanda **tidak memilih libur** periode itu (tanpa tambahan). Denda yang ditiadakan bernilai 0 dan tetap tampil | `clarification_events` + `forgotKindOf` + `forgotSequence` L3g, `day_off_missing_marks` L3e |

**Pembulatan (ikut HRIS lama, keputusan owner 2026-11-03; beda dari GAJ-07):** rupiah **tiap hari** dibulatkan ke rupiah terdekat (,5 ke atas) = pembulatan(gaji harian × pengali), lalu dijumlah per baris, sama dengan `calcEscalatingDeduction` HRIS lama, supaya uji banding tidak selisih. Prorata R1 dibulatkan sekali. Hitungan memakai bilangan bulat pasti (pengali dalam perseratus), tanpa pecahan desimal di tengah.
Contoh (dengan tangga alpha 1,5 · 2): gaji Rp2.900.000, gaji harian 111.538,46…; hari ke-1 1,5× = Rp167.308, hari ke-2 2× = Rp223.077, jumlah **Rp390.385**.

**Hari belum ditentukan** (tanpa absen, tanpa pengajuan, belum ditandai mesin alpha) tidak dipotong dan tampil kuning "belum ditentukan". Begitu juga hari sebelum data Kehadiran ada di sistem.

**Yang tidak memotong:** penjelasan yang masih **menunggu** keputusan (dihitung sesudah diputuskan); izin/sakit yang masih menunggu dihitung sesuai jenisnya, bertanda "menunggu keputusan" (L3f: hari berlaku = Menunggu atau Disetujui).

### 3.3 Tangga tidak hadir (K1, K2 v3)

- Tiga tangga **terpisah**, masing-masing berlanjut sepanjang periode menurut urutan tanggal: (a) izin + sakit tanpa surat + **izin duka** (ikut HRIS lama), (b) izin mendadak, (c) alpha. Contoh: izin 1 hari lalu alpha 1 hari = 1 + 1,5.
- Sakit dengan surat dihitung **per periode**: hari sakit-dengan-surat pertama di periode itu bernilai 0, dan seterusnya mengikuti tangga, bukan per rangkaian sakit.
- **Training** (status kerja dibaca per periode, karena promosi berlaku awal periode): izin, sakit tanpa surat, izin mendadak, dan alpha semuanya memakai `payroll.training_multiplier` (awal 1, tidak naik). Sakit dengan surat tetap memakai tangga surat (§9 butir 6).
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
| Potongan & Lembur (GAJ-L06) | `/pengaturan/potongan-lembur` | **Pengaturan › Potongan & Lembur** (baru) |

- **Hitungan Kehadiran:** kepala berisi nama, periode (pilihan periode berjalan dan periode lalu; yang lebih lama dimuat saat diminta), "Perkiraan, dihitung pukul 14.05", gaji tetap sebulan, dan gaji harian. Isinya satu kartu per baris R1, R3, R4, R6, R7, R8 yang berisi. Tiap kartu memuat jumlah rupiah, kalimat aturan, dan rincian yang bisa dibuka (tanggal, angka dari Kehadiran, pengali atau tarif, hasil). Tanda yang mungkin muncul: "ditiadakan" + alasan, "ditiadakan lewat penjelasan", "dalam toleransi", "diisi lewat klarifikasi", "menunggu keputusan", "belum ditentukan". Baris keterangan R5: "Libur 4, cuti 1, hari tutup 1: dibayar penuh". Di bawahnya ringkasan: **Gaji tetap + tambahan − potongan kehadiran = perkiraan** dengan catatan "belum termasuk potongan lain dan bonus". Tombol yang ada: **Lihat aturan** (ke kartu Aturan Potongan) dan, untuk Pemilik/GM, **Tiadakan** di rincian telat dan denda.
- **Tiadakan Potongan:** semua potongan telat dan denda periode itu yang tercatat, termasuk yang sudah ditiadakan. Bisa disaring per cabang, orang, jenis, dan status (Dipotong / Ditiadakan / Ditiadakan lewat penjelasan). Per baris: orang, tanggal, jenis, menit atau kejadian ke-n, rupiah, status, dan tombol **Tiadakan** atau **Batalkan peniadaan** (Pemilik/GM). HR melihat tanpa tombol.
- Semua rupiah memakai pemisah ribuan, pesan error muncul di jendela "OK, paham", dan keempat menu baru diberi tanda **Baru**.

## 5. Hak

| Tindakan | HR | Admin HR | Finance | Karyawan | Pemilik, GM |
|---|---|---|---|---|---|
| Lihat Hitungan Kehadiran dan daftar Tiadakan (memakai `salary.view` yang sudah ada; orang ber-`salary_owner_only` tidak dikirim) | ✓ | — | — | — | ✓ |
| `pay_waiver.manage` (Tiadakan, Batalkan peniadaan) · ownerOnly · selfForbidden | — | — | — | — | ✓ |
| Aturan Potongan (tanpa tindakan khusus; semua orang yang masuk HRIS) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Potongan & Lembur: lihat (`salary.view` atau `settings.view`) · ubah dan batalkan terjadwal (`settings.manage`) | lihat | — | — | — | ✓ |

Penolakan server yang dites: HR meniadakan; Pemilik/GM meniadakan potongannya sendiri; meniadakan potongan Rp0; dua peniadaan berlaku untuk kejadian yang sama; HR membuka hitungan orang ber-`salary_owner_only`; Admin HR/Finance membuka hitungan; tangga dengan start > max, angka di luar 0–5 atau lebih dari 2 angka desimal, set yang tidak dimulai tanggal 26, set yang tidak mengubah apa pun, HR menyimpan Potongan & Lembur.

## 6. Mesin terjadwal

Tidak ada mesin baru. Hitungan dan denda dihitung saat dibaca, sehingga penjelasan yang dicabut, surat dokter yang menyusul, koreksi absen, dan peniadaan langsung terbaca tanpa penulis atau penyelaras.

## 7. Pemberitahuan

| Kapan | Ke siapa | Isi (tanpa nominal) |
|---|---|---|
| Potongan ditiadakan | orangnya | "Potongan telat 12 November ditiadakan." / "Denda lupa absen pulang 12 November ditiadakan." |
| Peniadaan dibatalkan | orangnya | "Peniadaan potongan telat 12 November dibatalkan." |
| Pemilik/GM meniadakan | pemilik lain (`announceToOwners`) | "Elan meniadakan potongan telat Rina 12 November." |

## 8. Tes

- **Unit** (`modules/payroll/rules/attendance-pay`): prorata masuk dan berhenti; telat (dalam toleransi, lebih, ditiadakan, dijelaskan, jabatan tanpa telat); tiga tangga terpisah, start/step/max dan mentok (U17 v3); sakit dengan surat per periode (U18); Training (U19); izin duka ikut tangga izin, cuti tidak dipotong; lembur; kompensasi libur (diminta + masuk; diminta tetapi tidak masuk = 0); denda ke-5 per jenis, dicabut menggeser urutan, ditiadakan tetap terhitung; tidak memilih libur; pembulatan per hari seperti HRIS lama (contoh Rp390.385); Pemilik hanya R1; contoh Aturan Potongan dihitung dengan set yang berlaku (Rp100.000 per hari, telat 6 menit Rp6.000, sakit dengan surat 4 hari = 0 + 0,5 + 0,5 + 1 = Rp200.000, dan lainnya) dan ikut berubah bila set berubah.
- **Integrasi DB** (tanggal lampau): hitungan satu orang dari data absen, izin, alpha, lembur, dan penjelasan nyata; surat dokter menyusul menggeser tangga; Tiadakan dan Batalkan beserta pemberitahuannya; pagar hak (§5); pagar unik peniadaan; pengaturan bertanggal 26 dibaca menurut tanggal kejadian.
- **Registry**: 13 pengaturan Gaji baru + 1 pengaturan jabatan baru terdaftar dengan jenis nilai yang benar; jenis `escalation`/`sickLetter`/`decimal` tervalidasi; `buildMultipliers` sama dengan HRIS lama (1,5/0,2/2 → 1,5 · 1,7 · 1,9 · 2); simpan satu set = satu transaksi, semua kunci bertanggal sama; `pay_waiver.manage` ada di daftar tindakan dan hak awal.

## 9. Keputusan owner (2026-11-03: "selebihnya ok"; butir 2 diganti jawaban owner)

1. **Lingkup L4b.** **Saran: Pengaturan Gaji + Hitungan Kehadiran + Tiadakan Potongan + Aturan Potongan.** Koreksi Periode Lalu ditunda ke 4E-5a karena baru berguna sesudah ada slip yang ditutup. Sampai saat itu hitungan selalu memakai data terbaru, jadi koreksi tetap terbaca.
2. **Angka awal pengaturan** (§3.1). ~~Saran: pakai angka v3~~ → **Jawaban owner:** di HRIS lama ada tab khusus yang mengatur potongan izin, sakit, alpha, dan sejenisnya, serta lembur, dan bisa diatur. **Dipakai: layar sendiri Potongan & Lembur meniru HRIS lama, angka awal = set yang berlaku di HRIS lama** (lembur Rp10.000, izin/mendadak/alpha rata 1×). Draf awal: (telat Rp1.000/menit, lembur Rp7.500/jam, tangga izin 1–2, izin mendadak 1,25–2, alpha 1,5–3, sakit dengan surat 0/0,5/0,5/1, Training 1, kompensasi 1× gaji harian, denda lupa masuk Rp15.000, lupa pulang Rp5.000, lupa Masuk Kembali Rp5.000, tidak memilih libur Rp10.000, tambahan ke-5 Rp5.000). Kalau angka yang dipakai di HRIS lama sekarang berbeda, sebutkan, nanti saya tanam di migrasi.
3. **Denda dihitung saat dibaca, tidak disimpan sebagai baris tersendiri.** v3 menulis baris denda saat penjelasan disetujui, lalu membatalkan dan menulis ulang bila dicabut. **Saran: dihitung langsung dari penjelasan yang berlaku**, supaya pencabutan dan urutan ke-n tidak pernah selisih. Baris tetap baru disimpan saat slip ditutup (4E-5a).
4. **Telat yang dijelaskan.** Sejak L3g, telat yang penjelasannya disetujui **otomatis tidak dipotong**. **Saran: tetap begitu.** Bagian "usulan untuk ditiadakan" di v3 tidak dibuat; Pemilik/GM bisa meniadakan telat dan denda lain secara manual, satu per satu.
5. **Kompensasi libur.** **Saran: pengaturan jabatan baru "Dapat kompensasi libur", Ya untuk semua jabatan kecuali Pemilik dan GM.**
6. **Training.** **Saran: ikut v3** — izin, sakit tanpa surat, izin mendadak, dan **alpha** semuanya pengali 1 (tidak naik); sakit dengan surat tetap memakai aturan surat yang lebih ringan.
7. **Siapa melihat.** **Saran: hitungan per orang hanya HR, Pemilik, dan GM** (karyawan melihat miliknya sendiri di 4E-5c Pendapatan Saya). **Aturan Potongan dibuka untuk semua karyawan** karena tidak memuat gaji siapa pun.
8. **Siapa mengubah Pengaturan Gaji.** v3: HR mengusulkan, Pemilik/GM menyetujui. Mekanisme usulan baru ada untuk Pengaturan Jabatan. **Saran: di L4b Pemilik/GM mengubah langsung dan HR hanya melihat** (sama dengan pembagi gaji harian di L4a); usulan HR untuk pengaturan umum dibuat menyusul.

## 10. Catatan dari HRIS lama (dibaca 2026-11-03, kode `Hris Hammielion/lib/payrollRules.ts`, `escalatingDeduction.ts`, `payrollAbsence.ts`, tabel `payroll_rules`)

- **Tangga** HRIS lama: kursor hari berjalan terus lintas kejadian dalam satu periode, reset tiap periode; sama dengan K1 v3, jadi rumus §3.3 tidak berubah.
- **Pembulatan**: ikut HRIS lama, **per hari** (`Math.round(gajiHarian × pengali)`), bukan sekali per baris seperti GAJ-07 v3 (owner: "ikuti hris lama", 2026-11-03).
- ✅ **Izin duka**: ikut HRIS lama (owner 2026-11-03: "ikuti hris lama") — **dipotong** di tangga izin bersama izin dan sakit tanpa surat. Beda dari v3 GAJ-14.
- Denda lupa absen di HRIS lama tertanam di kode (masuk Rp15.000, pulang Rp5.000); di L4b ikut diatur di layar Potongan & Lembur.
