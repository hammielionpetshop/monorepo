# Spec HRIS L3a — Jam Kerja & Jadwal

Tanggal: 2026-11-01 · Status: **disetujui owner 2026-11-01 (§9 seluruhnya sesuai saran); lolos uji owner di staging 2026-11-01 (deployment `09d69b3d`)**
Cakupan: bagian pertama L3, yaitu 4D-1 di [PRD 05](../../hris_planning/PRD/fase_1/05-kehadiran.md).
Sumber: v3 `02-kehadiran` KEH-01 s.d. 12, 45, 79, 82, 102 s.d. 107; `kehadiran-spec` §3.1 (KEH-L01 s.d. L05), §4, §5, §6, §12.
Dasar kode: pengaturan bertanggal (L2e), `notify()` (L2f-1), Pengaturan Jabatan, `hris.branches` (L2b), penempatan bertanggal (L2c).
Aliran migrasi: **`hris` 0008**. Modul baru: `apps/hris/modules/attendance`, schema `packages/hris-db/src/schema/attendance.ts`.

## 1. Batas

**Dikerjakan:** Jam Kerja Cabang, Jadwal & Shift, Lokasi & QR Cabang, Hari Tutup, Jadwal Saya, mesin penggilir dan pemeriksa giliran.

**Tidak dikerjakan di L3a:**

| Hal | Di mana |
|---|---|
| Absen, pindai QR, cek lokasi, foto | L3b (4D-2a) |
| Hitungan "sekian absen 30 hari terakhir akan ditandai" saat ubah radius | L3b; belum ada data absen |
| Daftar Pengecualian per orang (KEH-09, KAR-L32) | L3b; baru berakibat saat telat dihitung |
| Libur dan Tidak masuk di tabel jadwal | Bagian Libur dan Izin; kartu hari menampilkan shift dan Hari tutup dulu |
| Alpha berubah jadi Hari tutup, tolak bila slip sudah ditutup (KEH-105) | Bagian Perlu Dijelaskan dan Gaji; alpha dan slip belum ada |
| Jam tutup kantor (KEH-71) | Bagian Lembur, yang pertama memakainya |
| Pintu baca jam buka cabang (KEH-106) | Tarik Data Kasir, yang pertama memakainya |
| Draf pengumuman dan Papan (PRI-35) | Menyusul bersama Papan; lihat §9 butir 6 |

## 2. Data (`hris` 0008)

Tidak ada baris yang dihapus. Tiap tabel mencatat pembuat dan waktu dibuat.

| Tabel | Isi | Kunci/pagar |
|---|---|---|
| `work_shifts` | cabang, nama, urutan, aktif | nama unik per cabang |
| `work_shift_versions` | shift, jam masuk, jam pulang, lama istirahat, rentang awal dan akhir mulai istirahat, berlaku dari, berlaku sampai (boleh kosong), alasan, dibatalkan | satu versi per shift + berlaku dari; isian istirahat terisi semua atau kosong semua (KEH-82) |
| `shift_groups` | cabang, urutan (0/1), nama, minggu acuan (Senin) | satu cabang dua kelompok |
| `shift_group_members` | orang, kelompok, berlaku dari, berlaku sampai | satu kelompok aktif per orang |
| `shift_assignments` | orang, cabang, awal minggu, shift, asal (`MACHINE`, `INITIAL`, `MANUAL`), oleh, alasan | unik orang + awal minggu; aman diulang |
| `shift_day_changes` | orang, cabang, tanggal, shift, shift sebelumnya, alasan, oleh | baris terbaru yang berlaku |
| `branch_qr_codes` | cabang, kode acak 128 bit, dibuat oleh dan kapan, mati pada | satu QR aktif per cabang; kode unik |
| `branch_closures` | tanggal mulai, tanggal akhir, cabang (kosong = semua), alasan, dipasang mundur, oleh, dibatalkan (siapa, kapan, alasan) | tidak boleh bertumpuk dengan hari tutup aktif di cabang yang sama |

**Pakai yang sudah ada, tanpa tabel baru:**
- **Radius** = pengaturan `attendance.radius_m` (sasaran ALL atau BRANCH, isi awal 100, 10–1000 meter). Tanggal berlaku, alasan, jejak, dan pemberitahuan ke pemilik lain sudah tersedia dari L2e dan L2f-2. Ini menggantikan `radius_absen_cabang` di spec v3.
- **Cara absen per jabatan** = Pengaturan Jabatan `position.attendance_mode`: `QR`, `TRIP`, atau `NONE` (§9 butir 2).
- **Titik lokasi** = `hris.branches.latitude/longitude`, layar Cabang & Jabatan yang sudah ada.

### Isi awal titik lokasi

Migrasi mengisi titik berdasarkan nama cabang, hanya bila titiknya masih kosong. Nama yang tidak ditemukan dilewati, dan cabangnya tampil "belum punya titik".

| Cabang | Lintang | Bujur |
|---|---|---|
| Toko Pusat | -7.350564720030627 | 108.10865608125447 |
| Gudang (termasuk Back Office) | -7.350564720030627 | 108.10865608125447 |
| Toko Depan | -7.35148882045046 | 108.11040975611628 |
| Toko Markas | -7.330201639984503 | 108.2066281965964 |
| Toko Raja | -7.348385400436556 | 108.22451225311764 |

Jarak terukur: Toko Pusat ke Toko Depan 219 m, Toko Markas ke Toko Raja 2,8 km, Toko Pusat ke Toko Markas 11 km. Dengan radius 100 m, lingkaran Toko Pusat dan Toko Depan tidak bersentuhan, tetapi radius 110 m ke atas mulai bersentuhan.

## 3. Aturan

Aturan murni ada di `modules/attendance/rules`, tanpa DB, dan paling banyak dites.

- **Versi jam kerja pada tanggal X:** versi tak dibatalkan dengan `berlaku dari <= X` dan `berlaku sampai` kosong atau `>= X`; bila beberapa cocok, `berlaku dari` terbaru yang menang. Versi momen tertentu (KEH-02) menang selama masanya, lalu versi tetap berlaku lagi.
- **Mengubah jam kerja:** berlaku paling cepat besok; absen lampau tidak berubah (KEH-02). Versi yang belum berlaku boleh dibatalkan.
- **Jam pulang lebih kecil dari jam masuk** berarti pulang keesokan hari. Jam masuk sama dengan jam pulang ditolak.
- **Shift tidak bisa dihapus**, hanya dinonaktifkan (KEH-03). Ditolak bila masih dipakai jadwal minggu ini atau sesudahnya, dan pesannya menyebut nama orangnya. Shift aktif terakhir di satu cabang juga tidak bisa dinonaktifkan.
- **Shift seseorang pada tanggal X** dibaca berurutan, dan tidak pernah ditebak dari jam datang (KEH-07):
  1. perubahan harian terbaru;
  2. jadwal mingguan untuk cabang penempatannya pada tanggal itu;
  3. satu-satunya shift aktif, bila cabangnya satu shift;
  4. bila semua kosong, **Shift belum ditentukan**.
- **Giliran:** hanya cabang dengan tepat dua shift aktif. Kelompok urutan `i` pada minggu `w` memakai shift ke-`(i + selisih minggu dari acuan) mod 2`. Dihitung dari minggu acuan, sehingga minggu yang terlewat tidak membuat giliran terbalik.
- **Orang yang masuk jadwal:** karyawan aktif dengan `position.attendance_mode = QR`, menurut penempatan pada tanggal itu.
- **Hari tutup:** tanggal yang sudah lewat wajib bertanda Dipasang mundur. Pembatalan butuh alasan dan menyimpan barisnya.
- **QR:** isinya tautan `<alamat HRIS>/absen?c=<kode>`. Buat ulang langsung mematikan kode lama (KEH-11), dalam satu transaksi.

## 4. Layar

Semua layar memakai komponen baku HRIS. Tabel minggu dan strip tujuh hari ditambahkan ke komponen dan halaman `/komponen`.

| Layar | Alamat | Menu | Isi |
|---|---|---|---|
| Jam Kerja Cabang (KEH-L01) | `/pengaturan/jam-kerja` | Pengaturan | Pilih cabang, shift berlaku dan akan berlaku, jam tutup toko sebagai turunan. Ubah 4 langkah: pilih shift, isi jam, tanggal + alasan, periksa (jumlah orang terkena + contoh akibat) |
| Jadwal & Shift (KEH-L02) | `/kehadiran/jadwal` | Kehadiran | Cabang + minggu, tabel orang × tujuh hari, bagian Kelompok, isi giliran awal sekali, ubah sel dengan alasan |
| Lokasi & QR Cabang (KEH-L03) | `/kehadiran/qr` | Kehadiran | Titik + tautan buka di Google Maps, radius + riwayat, QR aktif, Cetak, Buat ulang (ditahan 3 detik) |
| Hari Tutup (KEH-L04) | `/kehadiran/hari-tutup` | Kehadiran | Daftar, pasang 3 langkah, batalkan dengan alasan |
| Jadwal Saya (KEH-L05) | `/jadwal` | Saya | Untuk HP: tujuh kartu hari, Minggu depan, jam kerja cabang, Lihat teman (nama dan shift teman satu cabang, KEH-107) |
| Halaman QR | `/absen` | — | Sekadar penampung sampai L3b: QR aktif → "Absen dibuka menyusul"; QR lama → "QR ini sudah tidak berlaku, minta yang baru ke kepala cabang" |

Peta kecil di v3 diganti tautan Google Maps supaya tidak menambah pustaka peta.

## 5. Hak

Tindakan baru + hak awal di migrasi. Pemilik dan GM memiliki semuanya (KAR-67). S = semua, C = cabang atau departemennya.

| Tindakan | HR | Admin HR | Kepala Toko | Kepala Gudang | Finance |
|---|---|---|---|---|---|
| `attendance.work_hours.view` | S | S | — | — | — |
| `attendance.work_hours.update` | S | — | — | — | — |
| `attendance.schedule.view` | S | S | C | C | — |
| `attendance.schedule.update` (kelompok awal + ubah sel) | S | — | C | C | — |
| `attendance.location.view` | S | S | — | — | — |
| `attendance.qr.manage` (cetak + buat ulang) | S | — | — | — | — |
| `attendance.radius.update` (hanya pemilik) | — | — | — | — | — |
| `attendance.closure.view` | S | S | C | C | S |
| `attendance.closure.manage` | S | — | — | — | — |
| `attendance.my_schedule.view` (diri sendiri + teman satu cabang) | semua jabatan dengan cara absen `QR` atau `TRIP`; `TRIP` hanya melihat hari tutup, tanpa shift (KEH-96) |

Ubah sel atas jadwal sendiri ditolak (`selfForbidden`).

## 6. Mesin terjadwal

| Pekerjaan | Jadwal (WIB) | Isi |
|---|---|---|
| `shift-rotate` | Tiap hari 00.05 | Mengisi jadwal minggu berjalan bagi anggota kelompok yang belum punya. Berjalan harian, bukan hanya Senin, supaya mesin yang mati hari Senin mengejar saat hidup lagi (W3). Aman diulang karena kunci unik orang + minggu |
| `shift-check` | Tiap hari 06.00 | Mencari cabang dua shift yang kelompoknya kosong dan orang tanpa shift minggu ini. Memberi tahu kepala cabang dan HR, paling banyak sekali per cabang per minggu supaya tidak mengganggu |

Baris baru di `infra/apps/cron/crontab`, memakai UTC seperti pekerjaan yang sudah ada.

## 7. Pemberitahuan

| Kejadian | Kepada |
|---|---|
| Shift seseorang diubah langsung | Orang itu |
| Jam kerja cabang berubah | Orang di cabang itu |
| Hari tutup dipasang atau dibatalkan | Orang di cabang itu |
| Radius berubah | Pemilik dan GM lain (jalur L2f-2) |
| Kelompok kosong atau orang tanpa shift | Kepala cabang dan HR |

## 8. Tes

**Unit (`rules`):** W1 jam kerja bertanggal; W2 giliran Senin; W3 giliran terlewat tidak dobel dan tidak terbalik; W4 cabang berjumlah ganjil; W5 jam tutup turunan; W8 radius bertanggal; urutan baca shift (§3); pulang lewat tengah malam; versi momen tertentu.

**Integrasi DB:** pagar tanpa hapus, satu QR aktif, kunci orang + minggu, tolak nonaktifkan shift yang dipakai dengan nama orang, `shift-rotate` diulang tetap satu baris, lingkup cabang Kepala Toko, isi awal titik hanya mengisi yang kosong.

**Uji owner di staging**, memakai karyawan uji: daftar langkah dikirim saat tayang. Pemindaian QR dengan HP ikut diuji sebatas halaman penampung.

**Syarat HRIS:** fragment `apps/hris/changelog.d` + tanda Baru di `lib/new-features.ts` untuk tiap menu baru.

## 9. Keputusan owner (disetujui 2026-11-01)

**Tambahan owner untuk L3b:** absen lewat QR **wajib dengan GPS**. Absen tanpa data lokasi (izin lokasi ditolak atau GPS mati) tidak diterima. Absen di luar radius tetap mengikuti KEH-12: dicatat dan ditandai perlu ditinjau.

1. **Ubah shift mendadak per hari atau per minggu?** Spec v3 mencatat jadwal per minggu, padahal selnya per hari. **Saran: per hari**, dengan tabel `shift_day_changes`. Keadaan mendadak biasanya hanya sehari, dan tukar shift nanti bisa memakai jalur yang sama.
2. **Siapa yang diabsen?** **Saran:** Pemilik dan GM tidak diabsen; Driver dan Kenek absen lewat trip (L6), jadi tidak punya shift; semua jabatan lain lewat QR. Bisa diubah per jabatan di Pengaturan Jabatan. Spec v3 hanya menyebut GM tidak diabsen, jadi Pemilik di sini adalah usulan baru.
3. **QR Toko Pusat dan Gudang:** titiknya sama, tetapi **saran: QR tetap terpisah per cabang**, sesuai KEH-11, karena jam kerjanya mengikuti cabang tempat absen masuk (KEH-08). Akibatnya dua lembar QR ditempel di satu lokasi, dan karyawan harus memindai yang benar.
4. **Orang baru atau pindah cabang:** v3 mewajibkan pilih shift di formulir penempatan (KEH-103). **Saran: pilih dari sel "Shift belum ditentukan" di Jadwal & Shift**, tanpa mengubah formulir penempatan. Kepala cabang yang tahu shiftnya, dan pemeriksa harian mengingatkan bila masih kosong. Selama kosong, tidak dihitung telat.
5. **Cabang dengan tiga shift atau lebih:** aturan giliran v3 hanya mengenal tukar pagi dan siang. **Saran: mesin hanya menggilir cabang dua shift**; cabang tiga shift ke atas diisi tangan tiap minggu.
6. **Pengumuman perubahan jam kerja:** Papan belum ada. **Saran: pakai Pemberitahuan dulu**, dan jam kerja berlaku paling cepat besok. Batas jarak hari pengumuman (PRI-35) ikut saat Papan dibangun.
7. **Pustaka baru `qrcode`** untuk menggambar QR, karena repo belum punya. **Saran: setuju.** Pustaka ini hanya dipakai di server HRIS.
8. **Jam kerja tiap cabang** (pertanyaan terbuka PRD): **saran: tidak ditanam di migrasi.** Diisi lewat layar Jam Kerja Cabang saat uji, sekaligus menguji layarnya.

## 10. Catatan implementasi

- Tabel tambahan `shift_check_notices` menjaga peringatan pemeriksa giliran paling banyak sekali per cabang per minggu.
- Fungsi baca `hris.placements_on(date)` memberi penempatan semua orang pada satu tanggal.
- Minggu depan ditampilkan dari perhitungan kelompok; mesin baru menuliskannya saat minggu itu berjalan.
- Halaman tes hak jabatan di `packages/db-roles` ikut diperbarui, termasuk jabatan "Belum ditentukan" dari L2g yang belum tercakup.
