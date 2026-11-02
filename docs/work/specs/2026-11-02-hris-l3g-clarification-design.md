# Spec HRIS L3g — Perlu Dijelaskan dan Alpha

Tanggal: 2026-11-02 · Status: **disetujui owner 2026-11-02 (§9 semua sesuai saran)**
Cakupan: bagian ketujuh L3, yaitu 4D-5a di [PRD 05](../../hris_planning/PRD/fase_1/05-kehadiran.md): Perlu Dijelaskan, Isi Penjelasan (termasuk pengajuan terlambat), Perlu Dijelaskan Tim, Keterangan Pembantu Putusan Penjelasan, Laporan Kebiasaan Lupa Absen (KEH-L35 s.d. L39), ditambah mesin penanda alpha dan tanda tidak masuk berturut-turut.
Sumber: v3 `02-kehadiran` KEH-52 s.d. 69, 147, 150 s.d. 158; `kehadiran-spec` §3.8; `03-gaji` GAJ-11 (telat yang sudah dijelaskan: potongan ditiadakan, menit tetap tampil).
Dasar kode: L2f-1 (Mesin Pengajuan, `notify()`, Beranda), L3b (catatan absen `attendance_days` + `attendance_records`, menit telat dan pulang cepat), L3c (`effectiveDay`, Koreksi `attendance_corrections` + pembalik, `dayStatus`, Rekap, `payPeriodOf`), L3d (Pulang dihitung sesudah Laporan Pulang terkirim, KEH-89), L3e (libur `ACTIVE`, Hari tutup), L3f (`absence_requests.origin = CLARIFICATION`, surat dokter menyusul, `revokeRequest`).
Aliran migrasi: **`hris` 0014**. Modul: `apps/hris/modules/attendance` (kejadian, penjelasan, mesin, laporan).

## 1. Batas

**Dikerjakan:** mesin harian yang melahirkan lima jenis kejadian (**Alpha**, **Lupa absen pulang**, **Lupa Masuk Kembali**, **Telat** di atas 30 menit, **Pulang cepat** di atas 30 menit); status hari **Alpha**; satu jenis pengajuan baru **Penjelasan** di Mesin Pengajuan; pengajuan terlambat untuk lupa absen; hitungan "kejadian ke-n" lupa absen per periode; tanda tidak masuk 7 hari berturut-turut; empat layar karyawan/tim dan satu laporan untuk Pemilik/GM.

**Tidak dikerjakan di L3g:**

| Hal | Di mana | Akibat sementara |
|---|---|---|
| Nominal denda lupa absen, potongan alpha, izin mendadak, telat (GAJ-11, 13, 16) | Gaji (L4) | Kehadiran sudah menyediakan jenis, status, dan **kejadian ke-n**; layar menyebut "dikenai denda lupa absen" **tanpa angka** (§9 butir 4) |
| Kunci slip (batas Cabut, slip tak bisa ditutup selama ada penjelasan menunggu, KEH-69) | Gaji (L4) | §9 butir 5 |
| Lembur, "Ini lembur?" (KEH-70 s.d. 75) | 4D-5b | Hari lupa absen yang menunggu disebut "belum lengkap"; belum ada lembur yang terpengaruh |
| Pengingat berantai (TAM-22) | Pemberitahuan lengkap | Pemberitahuan sekali per tanda (§9 butir 8) |
| Kejadian untuk Driver/Kenek per ritase (absen trip) | 4D-2c | Tidak dibuat sama sekali (KEH-81, 123) |

## 2. Data (`hris` 0014)

Tidak ada baris yang dihapus atau ditimpa (PRI-02, KEH-67): catatan absen asli dan menit aslinya tetap tersimpan. Status penjelasan memakai `hris.requests` (L2f-1).

| Tabel | Isi | Kunci/pagar |
|---|---|---|
| `clarification_events` (kejadian perlu jelas) | orang, tanggal kerja, jenis (`ALPHA`, `FORGOT_OUT`, `FORGOT_RETURN`, `LATE`, `EARLY_LEAVE`), menit (telat/pulang cepat), lahir kapan, **batas** (tanggal + 3 hari pukul 23.59 WIB; untuk alpha dari izin yang ditolak: 3 hari dari saat ditolak), keadaan (`OPEN`, `EXPLAINED`, `EXPIRED`, `VOID`) | **unik orang + tanggal + jenis** (mesin diulang tidak dobel) |
| `clarifications` (penjelasan) | pengajuan (rujukan `requests`), orang, sebab (`SICK`, `SICK_LETTER`, `FORGOT`, `SUDDEN_PERMIT`, `REASON`), jam masuk / pulang / Masuk Kembali yang diisi, alasan, alasan keterlambatan, terlambat (ya/tidak), surat menyusul (ya/tidak) | unik per pengajuan; isi tidak berubah sesudah dikirim |
| `clarification_event_links` | penjelasan ↔ kejadian (satu penjelasan bisa untuk rangkaian alpha berturut-turut, KEH-152) | satu penjelasan **berlaku** (Menunggu/Disetujui) per kejadian (indeks unik bersyarat) |
| `clarification_effects` | penjelasan → yang ditulis saat disetujui: koreksi absen (`attendance_corrections`) atau pengajuan tidak masuk (`absence_requests` asal `CLARIFICATION`) | dipakai untuk membalik saat dicabut |
| `absence_streak_flags` (tanda berturut) | orang, tanggal mulai rangkaian, tanggal hari ke-7, sebab per hari, dilihat oleh + kapan + catatan | unik orang + tanggal mulai (tidak berulang di hari ke-8) |
| `clarification_notices` | kejadian, jenis pemberitahuan (`BORN`, `ONE_DAY_LEFT`, `LAST_DAY`) | unik kejadian + jenis (sekali per tanda) |

`attendance_correction_reason` bertambah nilai **`CLARIFICATION`** (koreksi yang lahir dari penjelasan, label "Diisi lewat klarifikasi", KEH-63).

**Pemeriksaan bersamaan:** Kirim mengunci orang itu di DB (`pg_advisory_xact_lock`, kunci yang sama dengan L3f) sebelum memeriksa kejadian, bentrok, dan batas, sehingga dua kirim bersamaan tidak sama-sama lolos dan tidak bentrok dengan Izin/Sakit/Cuti yang dikirim saat itu.

**Pengaturan baru (bertanggal berlaku, layar Pengaturan L2e):**

| Kunci | Isi awal | Sumber |
|---|---|---|
| `attendance.clarify_deadline_days` | 3 hari sesudah tanggal kejadian, pukul 23.59 | KEH-58, 151 |
| `attendance.clarify_late_threshold_minutes` | 30 menit (telat di atasnya wajib dijelaskan) | KEH-56, 61 |
| `attendance.clarify_early_threshold_minutes` | 30 menit (pulang cepat di atasnya wajib dijelaskan) | KEH-151 |
| `attendance.absence_streak_days` | 7 hari kerja | KEH-55, 157 |
| `attendance.forgot_habit_min` | lebih dari 4 kali per periode | KEH-65, 157 |
| `attendance.clarify_marks_from` | tanggal tayang staging L3g (§9 butir 2) | — |

## 3. Aturan

Aturan murni di `modules/attendance/rules/clarification.ts`, tanpa DB, dan paling banyak dites. Semua diperiksa **server** (WAJ-04); layar hanya menampilkan hasil. Jam dari server (PRI-01).

### 3.1 Kapan kejadian lahir (mesin `clarification-daily`, §6)

Untuk **hari kemarin** dan hari-hari yang terlewat, per orang dengan cara absen `QR`, bukan Pemilik/GM (KAR-67), antara tanggal masuk dan tanggal nonaktif:

- **Alpha (KEH-150):** orang punya shift di hari itu (hari kerja, L3a), tanpa absen Masuk (sesudah koreksi, `effectiveDay`), dan status harinya **Belum ditentukan**. **Dilewati:** Hari tutup, Libur terjadwal, Izin/Sakit/Cuti disetujui, dan hari yang masih punya pengajuan Izin/Sakit/Cuti **Menunggu** (KEH-147).
- **Lupa absen pulang (KEH-87, 89, 91):** ada Masuk tetapi tanpa jam pulang yang dihitung: tidak ada foto Pulang sampai batas pulang (04.00), **atau** foto Pulang ada tetapi Laporan Pulang tidak terkirim (L3d). Jam foto Pulang, bila ada, ditampilkan sebagai bukti.
- **Lupa Masuk Kembali (KEH-87):** ada Istirahat tanpa Masuk Kembali.
- **Telat:** menit telat (sesudah koreksi) **lebih dari 30**. Telat dalam toleransi atau di bawah ambang hanya dicatat, tanpa kartu.
- **Pulang cepat (KEH-151):** menit pulang cepat **lebih dari 30**.
- "Lupa absen masuk" tidak punya penanda sendiri: orang yang hadir tetapi tanpa absen mendapat kartu **Alpha** lalu memilih sebab **Lupa absen** (KEH-54, 63).

Kejadian yang sudah lahir menjadi `VOID` bila harinya berubah sebelum dijelaskan, misalnya HR membuat koreksi yang mengisi jam pulang, atau izin yang menunggu ternyata disetujui. Kartu hilang dari tab pertama dengan keterangan "Sudah dibereskan lewat koreksi/izin".

### 3.2 Batas, lewat batas, dan terlambat

- **Batas (KEH-58, 151):** tanggal kejadian + 3 hari, pukul 23.59 WIB. Alpha yang lahir karena izin/sakit/cuti **ditolak atau dicabut** pada tanggal yang sudah lewat: batas 3 hari dihitung dari saat itu (KEH-62, 147).
- **Lewat batas (KEH-59, 61, 155):** kejadian menjadi `EXPIRED`.
  - **Alpha** tetap alpha; **telat** potongannya tetap berlaku (dibaca Gaji). Tidak ada tombol, hanya "Sudah lewat batas 3 hari. Bicarakan dengan HR".
  - **Lupa absen** (pulang, Masuk Kembali, dan alpha yang sebab sebenarnya lupa absen masuk) bisa **Ajukan terlambat** (KEH-60): wajib alasan keterlambatan terpisah dari alasan lupa, tercatat terlambat, disahkan HR atau Pemilik/GM, denda tetap berlaku.
  - **Pulang cepat** yang tidak dijelaskan hanya bertanda "belum dijelaskan" bagi HR, tanpa akibat uang (KEH-24).
- **Ajukan terlambat dari kartu alpha** hanya boleh dengan sebab **Lupa absen**. Sakit dan izin mendadak lewat batas tetap tidak ada jalan di sistem.

### 3.3 Isi penjelasan per jenis (KEH-L36)

- **Alpha:** sebab **Sakit tanpa surat**, **Sakit dengan surat dokter**, **Lupa absen (saya sebenarnya hadir)**, **Izin mendadak**; tidak ada "pakai jatah libur" (KEH-54).
  - Sakit tanpa surat paling lama **2 hari kerja berturut-turut**, termasuk sakit tanpa surat yang berlaku tepat sebelum/sesudahnya (aturan yang sama dengan L3f, KEH-143). Lebih dari itu: "Pilih sakit dengan surat dokter" + tombol **Ganti ke dengan surat**.
  - Sakit dengan surat: foto surat **atau** **Surat menyusul**, memakai `doctor_letters` dan batas menyusul L3f.
  - Lupa absen: **jam masuk** wajib, **jam pulang** boleh kosong. Bila ada absen masuk asli, jam masuk terisi dan terkunci.
  - Izin mendadak: alasan.
- **Lupa absen pulang** dan **Lupa Masuk Kembali:** jam yang benar + alasan wajib; jam foto yang terkirim tampil sebagai bukti.
- **Telat** dan **Pulang cepat:** alasan wajib, lampiran boleh.
- **Jam yang masuk akal (KEH-18, 111):** jam masuk paling awal 2 jam sebelum jam masuk shift dan sebelum jam pulang; jam pulang sesudah jam masuk dan sebelum 04.00 hari berikutnya; Masuk Kembali sesudah Istirahat dan sebelum Pulang. Di luar itu ditolak server dengan pesan yang menyebut batasnya (pakai `correctionProblem` L3c).

### 3.4 Alpha berturut-turut (KEH-152)

Tiap hari alpha satu kartu. **Jelaskan sama untuk hari berturut-turut** menawarkan rangkaian alpha `OPEN` yang bersambung (libur terjadwal dan hari tutup tidak memutus), hanya yang masih dalam batas. Server membuat **satu** penjelasan dengan beberapa tautan kejadian. Hari yang lewat batas dilepas dari rangkaian dan tetap alpha.

### 3.5 Akibat saat disetujui (satu fungsi, WAJ-04)

| Kejadian + sebab | Yang ditulis | Status hari |
|---|---|---|
| Alpha + Sakit / Sakit dengan surat / Izin mendadak | satu `absence_requests` asal **`CLARIFICATION`** (tanpa pemeriksaan H-2 atau 3 hari lagi, KEH-153) + `absence_days` per tanggal; izin mendadak berhitungan `PERMIT_SUDDEN` | **Sakit** / **Izin** |
| Alpha + Lupa absen | koreksi absen alasan `CLARIFICATION` (jam masuk + pulang yang diisi), menit telat dan pulang cepat dihitung ulang dengan fungsi L3c | **Hadir**, bertanda "Diisi lewat klarifikasi" |
| Lupa absen pulang | koreksi alasan `CLARIFICATION` (jam pulang) | Hadir, jam pulang bertanda |
| Lupa Masuk Kembali | jam Masuk Kembali disimpan di penjelasan; lewat batas istirahat dihitung ulang (tanpa akibat, KEH-86) | tetap |
| Telat / Pulang cepat | tidak mengubah menit; kejadian bertanda **"dijelaskan, disetujui"** untuk Gaji (GAJ-11: potongan ditiadakan, menit tetap tampil) | tetap |

Kejadian menjadi `EXPLAINED`. Selama **Menunggu**: kejadian tetap tampil di tab Menunggu keputusan; hari alpha yang dijelaskan sebagai lupa absen tampil "belum lengkap" (KEH-63). Koreksi asal `CLARIFICATION` hanya bisa dibalik lewat Cabut persetujuan, bukan lewat layar Koreksi L3c.

### 3.6 Ditolak, Ajukan ulang, Cabut (KEH-155, 158)

- **Ditolak:** kejadian kembali `OPEN`; **Ajukan ulang** selama masih dalam batas, isian lama terisi, batas tidak mulai dari awal. **Penyetuju tidak mengubah jam yang diisi**: bila salah, Tolak dengan alasan.
- **Batalkan** oleh pengaju selama Menunggu (sudah ada di L2f-1): kejadian kembali `OPEN`.
- **Cabut persetujuan** oleh HR, Pemilik, atau GM dengan alasan wajib (memakai `revokeRequest` L3f): koreksinya dibalik (koreksi pembalik `reversesId`), atau pengajuan tidak masuk asal `CLARIFICATION` ikut dicabut; kejadian kembali `OPEN` bila masih dalam batas, `EXPIRED` bila tidak; urutan kejadian ke-n dihitung ulang.
- **Izin/Sakit/Cuti (L3f) ditolak atau dicabut** untuk tanggal yang sudah lewat → alpha lahir saat itu dengan batas 3 hari dari saat itu (KEH-147).

### 3.7 Kejadian ke-n lupa absen (KEH-64, 154)

Tiga jenis dihitung **terpisah**: lupa masuk (alpha yang dijelaskan sebagai Lupa absen), lupa pulang, lupa Masuk Kembali. Hanya yang **disetujui** yang dihitung. Urutan menurut **tanggal kejadian** di periode 26–25 tempat kejadiannya, bukan tanggal disahkan; dihitung ulang tiap kali dibaca (satu fungsi `forgotSequence`), jadi pencabutan otomatis menggeser urutan. Kehadiran hanya menyediakan "kejadian ke-n"; ke-5 dan seterusnya bertanda **ada tambahan**. Nominalnya milik Gaji (L4).

### 3.8 Siapa memutuskan (KEH-156)

HR, Pemilik, GM; satu cukup, tanpa "Setujui semua" (PRI-40). Penjelasan milik HR diputuskan Pemilik atau GM; milik Pemilik/GM tidak ada (mereka tidak diabsen QR). Server menolak bila yang memutuskan sama dengan pengaju (sudah dijaga `isOwnRequest`).

### 3.9 Tanda tidak masuk berturut-turut (KEH-55, 157)

Hari kerja berturut-turut berstatus **Sakit tanpa surat**, **Izin** (termasuk mendadak), atau **Alpha**; libur terjadwal dan hari tutup tidak memutus dan tidak dihitung; Hadir, Cuti, Sakit dengan surat, dan izin duka memutus. Pada **hari ke-7** satu tanda per rangkaian untuk HR dan Pemilik/GM, tidak berulang di hari ke-8, tanpa penonaktifan otomatis (KAR-07).

### 3.10 Status hari

`DayStatus` bertambah **`ALPHA`**. Urutan (KEH-118): absen Masuk → Hadir; Hari tutup; Libur terjadwal; Izin/Sakit/Cuti; **kejadian Alpha yang belum `VOID`/`EXPLAINED` → Alpha**; selain itu Belum ditentukan. Rekap Kehadiran, Catatan Hari Kerja, Kehadiran Saya, dan Rekap per orang menghitung Alpha. Hari ini dan hari yang belum diproses mesin tetap Belum ditentukan.

## 4. Layar

Error di jendela "OK, paham"; Kirim/Simpan terkunci selama proses dan tidak bisa ditekan dua kali; isian tidak hilang saat sinyal putus (TAM-16). Pengajuan Saya, kartu status, Batalkan, Ajukan ulang, dan kotak Persetujuan memakai layar L2f-1 dan **tidak digambar ulang**.

| Layar | Alamat | Menu | Isi |
|---|---|---|---|
| Perlu Dijelaskan (KEH-L35) | `/perlu-dijelaskan` | Saya (angka di menu) | HP. Tab **Perlu dijelaskan** (bawaan), **Menunggu keputusan**, **Selesai** (Disetujui, Ditolak, Lewat batas; periode lama dimuat saat diminta). Kartu: jenis ("Telat 42 menit"), tanggal, sisa waktu ("Tinggal 2 hari"; kuning sisa 1 hari, merah hari terakhir), akibat **satu kalimat tanpa nominal**. Terdekat batasnya di atas. Tombol **Jelaskan**, **Jelaskan sama untuk hari berturut-turut** (alpha), **Ajukan ulang** (ditolak, dalam batas), **Ajukan terlambat** (lupa absen lewat batas) |
| Isi Penjelasan (KEH-L36) | `/perlu-dijelaskan/[id]` | — | HP, langkah sesuai jenis (§3.3): Alpha 4 langkah (Sebab → Hari → Isian khas → Periksa dan Kirim); lupa pulang / Masuk Kembali 3 langkah; telat / pulang cepat 2 langkah. Lupa absen: Kirim **ditahan** (`HoldButton`) dengan "Ini dikenai denda lupa absen" + "Kejadian ke-5, ada tambahan denda" bila berlaku. Pengajuan terlambat: banner kuning + alasan keterlambatan. Kembali di tiap langkah tanpa kehilangan isian; Ulangi dari awal |
| Perlu Dijelaskan Tim (KEH-L37) | `/kehadiran/perlu-dijelaskan` | Kehadiran | PC, empat tab: **Belum dijelaskan** (saring cabang, jenis, orang; urut terdekat batas), **Hampir lewat batas** (≤ 1 hari), **Menunggu keputusan** (lama menunggu; menekan membuka `/persetujuan/[id]`), **Tidak masuk berturut-turut** (tanda §3.9 + **Sudah dilihat** dengan catatan, bisa dibuka kembali). Tanpa tombol Ingatkan dan tanpa menonaktifkan |
| Keterangan Pembantu Putusan (KEH-L38) | di dalam `/persetujuan/[id]` | — | PC. **Kejadian asli** (jam foto, menit telat, status alpha) berdampingan dengan **yang diisi**, selisih janggal ditandai ("jam pulang diisi 03.50, foto terakhir 17.05"); foto absen hari itu dan foto surat (HR/Pemilik/GM, pembukaan dicatat); "Kejadian ke-4 jenis lupa pulang" / "Kejadian ke-5: kena tambahan" tanpa nominal; jumlah penjelasan periode ini dan lalu; bentrokan (pengajuan lain, libur, hari tutup); label **Terlambat**, **Diisi lewat klarifikasi**, **Ajukan ulang ke-n**. Tombol milik kotak Persetujuan: Setujui, Tolak, Cabut persetujuan |
| Laporan Kebiasaan Lupa Absen (KEH-L39) | `/kehadiran/kebiasaan-lupa-absen` | Kehadiran | PC. Pilih periode (bawaan berjalan). Orang yang lupa absen **lebih dari 4 kali**: nama, cabang, jumlah lupa masuk, lupa pulang, lupa Masuk Kembali, jumlah penjelasan ditolak; angka di ambang ditandai; menekan nama membuka kejadiannya. Tanpa nominal. Hanya baca |

**Layar lama yang ikut berubah:** pesan L3f "Ajukan klarifikasi (menyusul)" (lewat batas izin/sakit, surat menyusul lewat batas) diganti tautan **Buka Perlu Dijelaskan**; Rekap, Catatan Hari Kerja, Kehadiran Saya, dan Tinjau Absen mengenal status **Alpha** dan label "Diisi lewat klarifikasi"; Koreksi L3c menolak membalik koreksi asal `CLARIFICATION` (arahkan ke Cabut persetujuan); Beranda karyawan mendapat kartu "**n hal perlu dijelaskan**, terdekat batas …", Beranda HR mendapat "tidak masuk berturut-turut" dan "penjelasan menunggu".

## 5. Hak

Tindakan baru + hak awal di migrasi. Pemilik dan GM memiliki semuanya (KAR-67). S = semua, C = cabang atau departemennya.

| Tindakan | HR | Admin HR | Kepala Toko | Kepala Gudang | Finance |
|---|---|---|---|---|---|
| Perlu Dijelaskan + Isi Penjelasan (diri sendiri) | ikut `attendance.self.check`, cara absen QR, bukan Pemilik/GM | | | | |
| `clarification.decide` (Setujui, Tolak, Cabut, alasan, foto) · selfForbidden | S | — | — | — | — |
| `clarification.team.view` (Perlu Dijelaskan Tim) | S, dengan alasan | S, **tanpa alasan** | C, hanya jenis, tanggal, sisa waktu | C, sama | — |
| `clarification.streak.seen` (Sudah dilihat) | S | — | — | — | — |
| `clarification.habit.view` (Laporan Kebiasaan) | — | — | — | — | — (hanya Pemilik dan GM) |

Penolakan server yang dites: GM atau Driver per ritase menjelaskan; menjelaskan kejadian orang lain; kejadian lewat batas kecuali Ajukan terlambat lupa absen; Ajukan terlambat dengan sebab sakit/izin; sakit tanpa surat 3 hari; jam di luar batas; dua penjelasan berlaku untuk satu kejadian; yang mengajukan ikut memutuskan; Admin HR membaca alasan; Kepala Toko membuka kejadian di luar cabangnya; HR membuka Laporan Kebiasaan.

## 6. Mesin terjadwal

Satu pekerjaan baru `clarification-daily`, **tiap hari 04.20 WIB**, aman diulang (§9 butir 3):

1. **Lahirkan kejadian** untuk hari kemarin dan yang terlewat sejak `clarify_marks_from`, urut: lupa pulang dan lupa Masuk Kembali, telat dan pulang cepat, alpha (§3.1). Unik orang + tanggal + jenis, jadi diulang tidak dobel.
2. **Lewat batas:** kejadian `OPEN` yang batasnya lewat → `EXPIRED`.
3. **Pemberitahuan** sekali per tanda: kejadian lahir, sisa 1 hari, hari terakhir (menyebut akibat tanpa nominal, PRI-07).
4. **Tanda berturut-turut** hari ke-7 (§3.9).
5. Gagal atau tidak jalan di jadwalnya → Pemilik dan GM diberi tahu (catatan `job_runs` + pemberitahuan, seperti L3e).

Baris baru di `infra/apps/cron/crontab` (UTC: `20 21 * * *`).

## 7. Pemberitahuan

| Kejadian | Kepada |
|---|---|
| Kejadian lahir; sisa 1 hari; hari terakhir | Orangnya |
| Penjelasan masuk (sudah ada, Mesin Pengajuan) | Penyetuju (`clarification.decide`) |
| Disetujui / ditolak / dicabut | Orangnya |
| Alpha lahir karena izin ditolak/dicabut | Orangnya |
| Tidak masuk 7 hari berturut-turut | HR, Pemilik, GM |
| Orang melewati ambang lupa absen periode ini | Pemilik, GM (ke Laporan Kebiasaan) |
| Mesin gagal | Pemilik, GM |

Kepala Toko dan Kepala Gudang tidak diberi tahu; mereka melihat di Perlu Dijelaskan Tim.

## 8. Tes

**Unit (`rules/clarification.test.ts`, menyebut nomor KEH):** lahirnya lima jenis dan yang dilewati (KEH-150, 151); ambang 30 menit telat dan pulang cepat; Pulang tanpa Laporan Pulang = lupa pulang (KEH-89); batas 3 hari pukul 23.59 dan batas dari saat ditolak (KEH-62); rangkaian berturut-turut melewati libur dan melepas yang lewat batas (KEH-152); sakit tanpa surat 2 hari (KEH-153); jam yang masuk akal; kejadian ke-n per jenis menurut tanggal kejadian + hitung ulang sesudah dicabut (KEH-154); Ajukan terlambat hanya lupa absen (KEH-155); tanda hari ke-7 tidak berulang (KEH-157); urutan status hari dengan Alpha.

**Integrasi DB:** mesin diulang tidak dobel; izin menunggu → tidak alpha; izin ditolak sesudah tanggalnya → alpha lahir dengan batas baru; setujui alpha+sakit → status Sakit + `absence_requests` asal `CLARIFICATION`; setujui alpha+lupa absen → koreksi `CLARIFICATION` + status Hadir; cabut → koreksi pembalik + kejadian `OPEN`/`EXPIRED`; ditolak → Ajukan ulang dengan batas lama; dua kirim bersamaan untuk satu kejadian → satu lolos; koreksi HR sebelum dijelaskan → kejadian `VOID`; pagar hak §5. Tes memakai tanggal lampau (pola L3c), supaya tidak rapuh jam.

**Uji owner di staging** dengan karyawan uji di HP: daftar langkah dikirim saat tayang. Karena kejadian lahir esok paginya, saya siapkan cara memicu mesin untuk tanggal tertentu di staging (§9 butir 2).

**Syarat HRIS:** fragment `apps/hris/changelog.d` + tanda Baru untuk `/perlu-dijelaskan`, `/kehadiran/perlu-dijelaskan`, `/kehadiran/kebiasaan-lupa-absen`, dan fitur "Ajukan terlambat".

## 9. Keputusan owner (disetujui 2026-11-02: semua sesuai saran)

1. **Satu paket atau dipecah?** Lima layar ini memakai mesin dan tabel yang sama. **Saran: satu paket** (satu kali uji), seukuran L3f.
2. **Mulai menandai sejak kapan.** Kalau mesin menandai mundur, semua karyawan uji di staging langsung punya puluhan alpha dari hari-hari lalu. **Saran: hanya hari sejak L3g tayang** (pengaturan `clarify_marks_from`), tanpa menandai mundur. Untuk uji, mesin bisa dijalankan sekali untuk tanggal kemarin di staging.
3. **Satu mesin pukul 04.20.** v3 menyebut tiga jam (04.05, 04.10, 04.20) karena memisahkan pembuat catatan hari kerja. Di sistem ini catatan hari kerja dihitung saat dibaca, jadi **saran: satu mesin pukul 04.20** yang menjalankan ketiganya berurutan; hasilnya sama untuk karyawan.
4. **Nominal denda belum ada.** Gaji baru di L4. **Saran: layar menyebut "dikenai denda lupa absen" dan "kejadian ke-5, ada tambahan denda" tanpa angka**; nominal Rp muncul di L4 dari pengaturan Gaji. Hitungan kejadian ke-n sudah benar sejak L3g.
5. **Batas yang bergantung pada slip.** Sama seperti L3f. **Saran: Cabut persetujuan sementara tanpa batas slip**; "slip tidak bisa ditutup selama ada penjelasan menunggu" (KEH-69) dibuat bersama penutupan slip di L4.
6. **Lupa absen yang disetujui ditulis sebagai koreksi absen.** **Saran: ya**, sebagai koreksi L3c alasan baru "Lewat klarifikasi", supaya jam kerja hanya punya satu sumber (Rekap, Catatan Hari Kerja, nanti Gaji dan lembur membaca satu tempat). Koreksi ini hanya bisa dibalik lewat Cabut persetujuan, bukan layar Koreksi.
7. **Hari tanpa shift.** Orang yang hari itu tidak punya shift (jadwal kosong) tidak bisa dinilai alpha. **Saran: dilewati** (tidak alpha), karena pemeriksaan shift kosong pukul 06.00 (L3a) sudah memberi tahu HR. Hari itu tetap Belum ditentukan.
8. **Pengingat.** **Saran: pemberitahuan sekali per tanda** sesuai v3: saat lahir, sisa 1 hari, dan hari terakhir; tanda 7 hari berturut-turut ke HR dan Pemilik/GM; dan pemberitahuan ke Pemilik/GM saat seseorang melewati ambang lupa absen (tambahan, supaya Laporan Kebiasaan tidak harus dibuka tiap hari). Pengingat berantai menyusul bersama Pemberitahuan lengkap.
