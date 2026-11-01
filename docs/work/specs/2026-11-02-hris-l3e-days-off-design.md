# Spec HRIS L3e — Libur dan Tukar

Tanggal: 2026-11-02 · Status: **DRAF, menunggu jawaban owner atas §9**
Cakupan: bagian kelima L3, yaitu 4D-4a di [PRD 05](../../hris_planning/PRD/fase_1/05-kehadiran.md): Pilih Libur, Libur Cabang, Tukar Libur dan Shift, Minta Masuk di Hari Libur (KEH-L26 s.d. L29).
Sumber: v3 `02-kehadiran` KEH-31 s.d. 35, 43 s.d. 46, 107, 113, 131 s.d. 140; `03-gaji` GAJ-06; `kehadiran-spec` §3.6, §4 (`libur_pilihan`, `tanda_tidak_memilih_libur`, `ajakan_tukar`, `permintaan_masuk_libur`, `libur_pengganti`), §5, §6, §7, §8, §10 (kejadian 78 s.d. 96), §12 (W29 s.d. W36, H42 s.d. H54); jawaban owner 4D-4a L1 s.d. L9 (13 Oktober 2026).
Dasar kode: L3a (jadwal shift, `shift_day_changes`, Hari Tutup, Jadwal Saya), L3b (Absen, tombol Masuk), L3c (`effectiveDay`, status hari, Rekap, periode 26–25 `payPeriodOf`), L2e (pengaturan bertanggal, termasuk sasaran per jabatan), L2f-1 (`notify()`, Beranda).
Aliran migrasi: **`hris` 0012**. Modul: `apps/hris/modules/attendance`.

## 1. Batas

**Dikerjakan:** Pilih Libur (jendela biasa, jalur terlambat, jatah sebanding, libur pengganti), Libur Cabang (kalender, belum memilih, laporan tukar, ubah langsung, cabut), Tukar Libur dan Shift (ajakan, terima/tolak, batal otomatis), Minta Masuk di Hari Libur (permintaan, Siap masuk, batal, pengganti), status hari **Libur terjadwal**, tombol Masuk tidak aktif di hari libur kecuali diminta masuk, libur tampil di Jadwal & Shift, Jadwal Saya, Lihat teman, dan Rekap, serta mesin harian dan pengingat.

**Tidak dikerjakan di L3e:**

| Hal | Di mana | Akibat sementara |
|---|---|---|
| Izin, sakit, cuti, tab "Tidak masuk" di Libur Cabang | 4D-4b | Tombol "Ajukan izin biasa" di layar tukar menuju Pengajuan Saya dengan pesan "menyusul" |
| Alpha (hari tanpa libur dan tanpa absen) | 4D-5a | Hari itu tetap "Belum ditentukan" |
| Denda tidak memilih libur, kompensasi masuk di hari libur (GAJ-15, 16) | Gaji (L4) | Tandanya sudah dicatat dan siap dibaca Gaji; belum ada rupiah |
| Pengingat berantai (TAM-22) | Menyusul bersama Pemberitahuan lengkap | Pengingat dikirim sekali per tanda lewat Pemberitahuan biasa (§9 butir 8) |
| Libur untuk Driver dan Kenek per ritase (KEH-32) | L6 | Tidak tampil |

## 2. Data (`hris` 0012)

Tidak ada baris yang dihapus (PRI-02). Libur yang dilepas, digeser, atau dicabut **berganti status**; barisnya tetap.

| Tabel | Isi | Kunci/pagar |
|---|---|---|
| `day_off_picks` | orang, awal periode, tanggal, asal (`PICK`, `LATE`, `SWAP`, `DIRECT`, `REPLACEMENT`), status (`ACTIVE`, `REPLACED`, `REVOKED`), dipilih kapan (jam server), oleh, diakhiri (oleh, kapan, alasan, digantikan baris mana) | **satu libur `ACTIVE` per orang per tanggal**; perubahan status hanya dari `ACTIVE`, isi lain tidak bisa diubah |
| `day_off_missing_marks` | orang, awal periode, ditandai kapan, memilih terlambat sesudahnya | **unik orang + periode** (denda sekali, KEH-135) |
| `swap_invitations` | pengaju, teman, jenis (`DAY_OFF`, `SHIFT`), tanggal pengaju, tanggal teman (shift: tanggal sama), libur/shift kedua pihak saat dikirim, batas jawab, status (`PENDING`, `ACCEPTED`, `REJECTED`, `EXPIRED`, `CANCELLED`), dijawab kapan | satu ajakan `PENDING` per tanggal milik pengaju |
| `day_off_work_requests` | orang, libur yang dimaksud, tanggal, diminta oleh, alasan, status (`REQUESTED`, `READY`, `CANCELLED`), siap kapan, dibatalkan (oleh, kapan, alasan) | satu permintaan berlaku per orang per tanggal; peminta ≠ orangnya |
| `replacement_day_offs` | permintaan masuk, orang, batas (tanggal masuk + 14 hari), libur pengganti terpilih, status (`WAITING`, `CHOSEN`, `EXPIRED`) | unik per permintaan; **lahir hanya saat absen Masuk tercatat** di tanggal itu (KEH-138) |
| `day_off_notices` | orang, periode, jenis pengingat (H-7, H-3, H-1, pengganti H-3) | unik, supaya pengingat tidak dobel |

`shift_day_changes` (L3a) mendapat kolom `swap_invitation_id` (boleh kosong): tukar shift dicatat sebagai **dua perubahan harian**, satu per orang, dalam satu transaksi.

**Pemeriksaan bersamaan:** Simpan libur dan Terima tukar mengunci cabang + tanggal di DB (`pg_advisory_xact_lock`) sebelum menghitung KEH-34. Dua orang yang menyimpan tanggal sama pada detik yang sama tidak bisa sama-sama lolos melewati batas.

**Pengaturan baru (bertanggal berlaku, layar Pengaturan L2e):**

| Kunci | Isi awal | Sasaran | Sumber |
|---|---|---|---|
| `attendance.day_off_quota` | 4 hari (0 = jabatan dengan libur tidak tetap) | Semua / per jabatan | KEH-31, 32 |
| `attendance.day_off_max_per_branch` | 2 orang | Semua / per cabang | KEH-34 |
| `attendance.day_off_weekend_max` | 1 | Semua | KEH-35, 134 |
| `attendance.day_off_min_gap_days` | 5 hari | Semua | KEH-134 |
| `attendance.day_off_window_open_day` | tanggal 10 | Semua | KEH-132 |
| `attendance.day_off_window_close_day` | tanggal 25 (pukul 23.59) | Semua | KEH-132 |
| `attendance.day_off_late_min_days` | 2 hari dari hari ini | Semua | KEH-135 |
| `attendance.newcomer_grace_workdays` | 3 hari kerja pertama | Semua | KEH-140 |
| `attendance.swap_deadline_days` | H-2 | Semua | KEH-44 |
| `attendance.replacement_days` | 14 hari | Semua | KEH-138 |

## 3. Aturan

Aturan murni di `modules/attendance/rules/days-off.ts`, tanpa DB, dan paling banyak dites. Semua diperiksa **server** (WAJ-04); layar hanya menampilkan hasil.

- **Siapa punya jatah:** karyawan aktif dengan cara absen `QR` dan `attendance.day_off_quota` jabatannya lebih dari 0. Pemilik, GM, dan Driver/Kenek per ritase tidak melihat Pilih Libur maupun Tukar; server menolak (H42).
- **Periode** 26 sampai 25, sama dengan Rekap (`payPeriodOf`). **Jendela** periode yang mulai tanggal 26 bulan M dibuka tanggal 10 dan ditutup tanggal 25 pukul 23.59 bulan M (W29).
- **Jatah sebanding (GAJ-06):** orang yang masuk atau berhenti di tengah periode mendapat `bulat(jatah × hari kalender bekerja ÷ hari periode)`. Contoh: periode 31 hari, masuk tanggal 16 Nov (10 hari) → 4 × 10/31 = 1,3 → **1 hari**.
- **Batas cabang (KEH-34):** paling banyak `day_off_max_per_branch` orang libur per tanggal per cabang. Cabang berisi 2 orang: 1. Cabang berisi 1 orang: tetap boleh libur. Rumusnya `min(pengaturan, maks(1, jumlah − 1))`. Jumlah = orang berjatah yang **ditempatkan** di cabang itu pada tanggal itu (yang perbantuan tidak dihitung). Libur pengganti juga diperiksa KEH-34.
- **Akhir pekan dan jarak (KEH-134):** paling banyak 1 Sabtu atau Minggu per periode; jarak antartanggal libur paling sedikit 5 hari (libur Senin → paling cepat Sabtu), **dihitung juga terhadap libur di ujung periode sebelum dan sesudahnya** (W31). Keduanya **ditolak server**, bukan peringatan.
- **Tanggal yang tidak bisa dipilih:** sudah lewat, Hari tutup cabangnya, sudah libur, atau melanggar aturan di atas. Kalender menyebut alasannya: **Penuh**, **Terlalu dekat**, **Jatah akhir pekan terpakai**, **Hari tutup**, **Sudah lewat**.
- **Simpan sebagian:** selama jendela terbuka, orang boleh menyimpan 1–4 tanggal dan menggesernya (**Lepas pilihan** → status `REPLACED`). Bila saat Simpan sebagian tanggal sudah diambil teman, hanya tanggal itu yang ditolak dengan pesan yang menyebut tanggalnya; tanggal lain tetap tersimpan.
- **Sesudah jendela tutup** (KEH-133): pilihan terkunci. Libur hanya bergeser lewat tukar, ubah langsung kepala cabang/HR, atau libur pengganti. Tidak ada tombol geser sendiri (kejadian 81).
- **Terlambat (KEH-135):** jatah yang belum lengkap sesudah jendela tutup boleh dipilih sendiri untuk tanggal **paling cepat 2 hari dari hari ini** (asal `LATE`). Mesin mencatat **satu** tanda tidak memilih libur per orang per periode pada pukul 00.10 tanggal 26, walaupun ia memilih terlambat berkali-kali.
- **Orang baru (KEH-140):** orang yang mulai kerja sesudah jendela periodenya tutup boleh memilih terlambat dalam 3 hari kerja pertamanya **tanpa tanda**. Lewat itu, tanda dicatat (kejadian 96).
- **Ubah langsung (KEH-45):** kepala cabang di lingkupnya, HR, Pemilik, GM. Alasan wajib. Hanya diperiksa KEH-34. Bila orangnya jadi libur di dua akhir pekan, sistem mencatat "dua akhir pekan" sebagai catatan, tidak menolak. Tidak berakibat apa pun bagi orangnya (KEH-139). Ubah atas libur sendiri ditolak (`selfForbidden`).
- **Cabut (KEH-131):** HR, Pemilik, GM saja. Alasan wajib. Status `REVOKED`. Kepala Toko ditolak (H44). Sesudah dicabut, orangnya boleh memilih lagi lewat jalur terlambat, tanpa tanda tambahan.
- **Ajakan tukar (KEH-43, 44, 136):** hanya dengan teman **satu cabang** yang punya jatah, punya tanggal atau shift untuk ditukar, dan belum libur di tanggal tujuan. **Tukar libur** diperiksa KEH-34 saja, tidak KEH-35 (W36). **Tukar shift** berlaku untuk **satu tanggal**, hanya di cabang dengan 2 shift atau lebih, dengan teman yang shiftnya berbeda pada tanggal itu. Batas jawab = **H-2 dari tanggal yang lebih dekat**, sampai pukul 23.59; kurang dari itu, ajakan tidak bisa dikirim dan layar menyarankan izin biasa (kejadian 87). Diterima → jadwal kedua orang langsung berubah dalam satu transaksi; libur lama `REPLACED`, libur baru asal `SWAP`. **Tidak ada pemberitahuan ke atasan** (KEH-43). Pengaju bisa membatalkan selama Menunggu. Bila salah satu libur sudah berubah sebelum dijawab, Terima ditolak dengan pesan "Jadwal sudah berubah, ajakan ini tidak berlaku lagi".
- **Minta masuk di hari libur (KEH-46, 137):** kepala cabang di lingkupnya, HR, Pemilik, GM. Untuk libur `ACTIVE` orang itu yang belum lewat; alasan wajib; satu permintaan berlaku per tanggal. **Tidak ada tombol Tolak**: orangnya hanya menekan **Siap masuk**; yang tidak bisa menghubungi peminta, dan peminta membatalkan dengan alasan selama tanggalnya belum lewat. Selama permintaan `REQUESTED` atau `READY`, tombol Masuk aktif untuk tanggal itu.
- **Libur pengganti (KEH-138):** lahir hanya bila orangnya benar-benar absen Masuk di tanggal yang diminta. Dipilih paling lambat 14 hari sesudah hari masuk, boleh jatuh di periode berikutnya (periode itu boleh berisi 5 libur), diperiksa KEH-34 saja. Lewat batas → **Hangus**, tanpa denda. Libur pengganti tidak dihitung dalam jatah periode.
- **Status hari kerja** bertambah satu: **Libur terjadwal** (KEH-81), dibaca dari libur `ACTIVE`. Urutan: absen Masuk tercatat → Hadir; Hari tutup → Hari tutup; libur berlaku → Libur terjadwal; selain itu Belum ditentukan. Datang sendiri tanpa diminta di hari libur tidak memindah libur (KEH-46).
- **Layar Absen di hari libur** (KEH-113): tombol Masuk tidak aktif dengan pesan "Hari ini jadwal libur Anda", kecuali ada permintaan masuk yang berlaku.
- **Teman melihat libur** (KEH-107): nama dan tanggal libur teman satu cabang, tanpa alasan, tanpa cabang lain.

## 4. Layar

Komponen baru **kalender periode 26–25** (tanda per tanggal + nama di bawah tanggal) ditambahkan ke komponen baku dan halaman `/komponen`. Error tampil di jendela "OK, paham"; tombol Simpan/Kirim terkunci selama proses; isian tidak hilang saat sinyal putus (TAM-16).

| Layar | Alamat | Menu | Isi |
|---|---|---|---|
| Pilih Libur (KEH-L26) | `/libur` | Saya | HP. Kepala periode, sisa waktu jendela, "Terisi 2 dari 4", kalender dengan tanda dan nama teman libur. 3 langkah: Pilih tanggal → Periksa ("Akhir pekan: 1 dari 1", "Jarak: cukup") → Simpan. Jalur terlambat, jatah sebanding, langkah "Pilih libur pengganti" bila ada yang menunggu. Periode depan selalu bisa dibuka |
| Libur Cabang (KEH-L27) | `/kehadiran/libur` | Kehadiran | PC. Pilih cabang + periode. Tab **Kalender** (jumlah dan nama per tanggal, Penuh, Hari tutup, permintaan masuk), **Belum memilih** (terisi x dari y, tanda tidak memilih), **Tukar** (daftar tukar + jumlah per orang). Ubah langsung 3 langkah, Cabut, Minta masuk |
| Tukar Libur dan Shift (KEH-L28) | `/tukar` | Saya | HP. Tab **Ajakan untuk saya** (Terima, Tolak, batas jawab) dan **Ajakan saya** (status, Batalkan). Ajak teman 4 langkah: jenis → tanggal saya → teman (dengan tanggal atau shift tukarannya) → periksa jadwal sesudah tukar → Kirim |
| Minta Masuk di Hari Libur (KEH-L29) | `/kehadiran/minta-masuk` | Kehadiran | Buat permintaan 3 langkah (orang + tanggal libur → alasan → periksa), daftar permintaan dan status pengganti, Batalkan |
| Kartu "Anda diminta masuk" | Beranda + `/absen` | — | Tombol **Siap masuk**; sesudah masuk, tombol Pilih libur pengganti |

**Layar lama yang ikut berubah:** Jadwal & Shift dan Jadwal Saya menampilkan **Libur** di sel/kartu hari; Lihat teman menampilkan teman yang libur; Catatan Hari Kerja, Rekap Kehadiran, dan Kehadiran Saya mengenal status Libur terjadwal; Beranda menampilkan kartu "Jatah libur belum lengkap" selama jendela terbuka.

## 5. Hak

Tindakan baru + hak awal di migrasi. Pemilik dan GM memiliki semuanya (KAR-67). S = semua, C = cabang atau departemennya.

| Tindakan | HR | Admin HR | Kepala Toko | Kepala Gudang | Finance |
|---|---|---|---|---|---|
| Pilih Libur, Tukar, Siap masuk, pilih pengganti (diri sendiri) | ikut `attendance.self.check` dan punya jatah (§3) | | | | |
| `attendance.dayoff.view` (Libur Cabang: kalender, belum memilih, tukar) | S | S | C | C | — |
| `attendance.dayoff.change` (ubah langsung) · selfForbidden | S | — | C | C | — |
| `attendance.dayoff.revoke` (cabut) · selfForbidden | S | — | — | — | — |
| `attendance.dayoff.request_work` (minta masuk + batalkan) · selfForbidden | S | — | C | C | — |

Penolakan server yang dites: menyimpan libur atas nama orang lain (H43), Kepala Toko mencabut (H44), Kepala Toko cabang A mengubah atau meminta masuk orang cabang B (H45, H51), mengajak tukar teman cabang lain (H47), atasan menjawab ajakan atas nama teman (H49), karyawan membuat permintaan masuk (H50), karyawan membaca Belum memilih atau laporan Tukar (H52), memilih lewat jalur biasa sesudah jendela tutup (H53), memilih yang melanggar KEH-34/35 lewat permintaan paksa (H54).

## 6. Mesin terjadwal

Satu pekerjaan baru `days-off-daily`, **tiap hari 00.10 WIB**, aman diulang, dengan langkah berurutan:

1. Ajakan tukar `PENDING` yang batas jawabnya lewat → `EXPIRED`; pengaju diberi tahu (W32).
2. Pada tanggal 26: satu tanda tidak memilih libur untuk tiap orang berjatah yang belum lengkap, kecuali orang baru KEH-140 dan periode transisi (§9 butir 2). Kunci unik orang + periode.
3. Libur pengganti `WAITING` yang batasnya lewat → `EXPIRED` (W33).
4. Pengingat: H-7, H-3, H-1 sebelum jendela tutup bagi yang jatahnya belum lengkap; pengganti tinggal 3 hari. Satu kali per tanda (`day_off_notices`).

Baris baru di `infra/apps/cron/crontab` (UTC, seperti pekerjaan lain).

## 7. Pemberitahuan

| Kejadian | Kepada |
|---|---|
| Jendela terbuka, jatah belum lengkap (H-7, H-3, H-1) | Orang itu |
| Libur diubah langsung atau dicabut | Orang itu |
| Ajakan tukar masuk | Teman yang diajak |
| Ajakan diterima | Pengaju |
| Ajakan ditolak atau batal otomatis | Pengaju, dengan saran izin biasa |
| Diminta masuk di hari libur / permintaan dibatalkan | Orang itu |
| Libur pengganti belum dipilih, tinggal 3 hari | Orang itu |
| Hari tutup dipasang di atas libur berlaku | Orang itu dan kepala cabangnya (§9 butir 6) |

Tidak ada pemberitahuan ke atasan saat tukar (KEH-43). Jatah belum lengkap sesudah jendela tutup hanya tampil di tab Belum memilih, bukan tugas.

## 8. Tes

**Unit (`rules/days-off.test.ts`):** jendela W29 (25 Okt 23.59 diterima biasa, 26 Okt 00.01 hanya jalur terlambat); jarak W31 termasuk lintas periode; akhir pekan 1; batas cabang 1/2/3 orang; jatah sebanding GAJ-06; jalur terlambat paling cepat 2 hari; orang baru 3 hari kerja (kejadian 96); batas tukar H-2 W32; tukar tanpa KEH-35 W36; pengganti 14 hari W33; urutan status hari.

**Integrasi DB:** tidak ada hapus, perubahan hanya dari `ACTIVE`; satu libur aktif per orang per tanggal; dua orang Simpan tanggal sama bersamaan → hanya yang muat lolos; simpan sebagian dengan satu tanggal ditolak; tanda tidak memilih sekali per periode walau mesin diulang; Terima tukar mengubah dua jadwal sekaligus dan ditolak bila jadwal sudah berubah; tukar shift jadi dua `shift_day_changes`; permintaan masuk → tombol Masuk aktif → absen → pengganti lahir; tanpa absen → tidak ada pengganti (kejadian 91); pengganti hangus oleh mesin; pagar hak H42 s.d. H54. Tes memakai tanggal lampau (pola L3c), supaya tidak rapuh jam.

**Uji owner di staging** dengan karyawan uji di HP: daftar langkah dikirim saat tayang.

**Syarat HRIS:** fragment `apps/hris/changelog.d` + tanda Baru untuk `/libur`, `/tukar`, `/kehadiran/libur`, `/kehadiran/minta-masuk`.

## 9. Keputusan owner (menunggu jawaban)

1. **Satu paket atau dipecah?** Empat layar ini memakai kalender dan aturan libur yang sama. **Saran: satu paket** (satu kali uji), seukuran L3d.
2. **Periode berjalan saat tayang (26 Okt – 25 Nov):** jendelanya sudah tutup sebelum fitur ada, jadi semua orang "terlambat". **Saran: periode ini tanpa tanda tidak memilih libur**; semua boleh memilih lewat jalur terlambat (paling cepat 2 hari dari hari ini). Tanda baru berlaku mulai periode **26 Nov – 25 Des** (jendela 10–25 Nov). Di staging, jendela bisa dicoba lebih cepat dengan mengubah pengaturan tanggal buka.
3. **Ajakan tukar tidak lewat kotak Persetujuan.** Mesin Pengajuan memilih penyetuju menurut jabatan, sedangkan ajakan tukar dijawab satu teman tertentu dan tidak boleh terlihat atasan (KEH-43). **Saran: ajakan tukar punya daftar sendiri di layar Tukar**, dengan status setara Mesin Pengajuan (Menunggu, Diterima, Ditolak, Hangus, Dibatalkan).
4. **Jabatan yang liburnya tidak tetap (PRI-18):** **saran: pengaturan jatah libur per jabatan** (`attendance.day_off_quota`, isi awal 4 untuk semua jabatan QR; 0 = tidak punya jatah). Mohon sebutkan bila ada jabatan yang harus 0 sejak awal.
5. **Hitungan "jumlah orang di cabang" untuk KEH-34:** **saran: orang berjatah yang ditempatkan di cabang itu pada tanggal itu**, tidak termasuk yang sedang perbantuan. Kantor dan Gudang dihitung sebagai cabang masing-masing.
6. **Hari tutup dan libur:** tanggal Hari tutup tidak bisa dipilih sebagai libur. **Saran: bila Hari tutup dipasang belakangan di atas libur yang sudah berlaku,** liburnya tetap tercatat, status hari = Hari tutup, dan orang itu serta kepala cabangnya diberi tahu. Jatahnya tidak dikembalikan otomatis; kepala cabang atau HR bisa menggesernya lewat Ubah langsung.
7. **Tukar shift:** **saran: hanya di cabang dengan 2 shift atau lebih, untuk satu tanggal**, dengan teman satu cabang yang shiftnya berbeda pada tanggal itu. Dicatat sebagai perubahan shift harian kedua orang, sehingga tampil di Jadwal & Shift seperti ubah sel biasa.
8. **Pengingat:** pengingat berantai belum ada. **Saran: kirim lewat Pemberitahuan sekali per tanda** (H-7, H-3, H-1 sebelum jendela tutup; pengganti tinggal 3 hari). Pengingat berantai menyusul bersama Pemberitahuan lengkap.
