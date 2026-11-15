# Spec HRIS L3c — Tinjau, Koreksi, dan Rekap Kehadiran

Tanggal: 2026-11-02 · Status: **disetujui owner 2026-11-02 (§9 seluruhnya sesuai saran); lolos uji owner di staging 2026-11-02 (deployment `478252d7`)**
Cakupan: bagian ketiga L3, yaitu 4D-2b di [PRD 05](../../hris_planning/PRD/fase_1/05-kehadiran.md) (KEH-L12 s.d. L17). Foto Absen Hari Ini (KEH-L14) sudah ada sejak L3b dan di sini dilengkapi.
Sumber: v3 `02-kehadiran` KEH-14, 19, 20, 22, 28 s.d. 30, 76, 81, 114 s.d. 119; `kehadiran-spec` §3.3, §4 (tinjauan, pola, koreksi, hari kerja), §5, §6.
Dasar kode: L3b (`attendance_days`, `attendance_records`, foto + jejak buka), L3a (shift bertanggal, hari tutup), L2f-1 (`notify()`, Beranda), L2e (pengaturan bertanggal), `can()` dengan `selfForbidden`.
Aliran migrasi: **`hris` 0010**. Modul: `apps/hris/modules/attendance`.

## 1. Batas

**Dikerjakan:** Tinjau Absen (luar titik + pola lokasi), Koreksi Absen (satu orang dan banyak orang, termasuk Tambah absen dan membalik koreksi), Riwayat Koreksi, Catatan Hari Kerja, Rekap Kehadiran, Kehadiran Saya, Foto Absen Hari Ini dilengkapi pilihan tanggal (60 hari), mesin pendeteksi pola lokasi.

**Tidak dikerjakan di L3c:**

| Hal | Di mana | Akibat sementara |
|---|---|---|
| Slip ditutup, slip tertahan, koreksi susulan (KEH-14, 81, 116) | Gaji (L4) | Belum ada slip, jadi semua hari masih bisa dikoreksi dan tidak ada yang terkunci (§9 butir 2) |
| Libur terjadwal, Izin, Sakit, Cuti, "ada izin bentrok" | Bagian Libur dan Izin | Status itu belum muncul di rekap; kolomnya tampil "-" |
| Alpha, Perlu Dijelaskan, "Diisi lewat klarifikasi", "Belum lengkap" | Bagian Perlu Dijelaskan | Hari tanpa absen tampil **Belum ditentukan** (KEH-118) |
| Lembur tiga angka (KEH-77) | Bagian Lembur | Kolom lembur tampil "-" |
| Tidak jalan (per ritase) | Absen lewat trip (L6) | Driver dan Kenek belum masuk rekap |
| Laporan Pulang, Sudah Pindah Cabang? | Bagian Laporan Pulang | Tidak berubah dari L3b |

HRIS belum dipakai sungguhan, jadi urutan bertahap ini tidak menimbulkan celah di data nyata.

## 2. Data (`hris` 0010)

Catatan absen L3b tetap tidak bisa diubah atau dihapus. Semua tabel baru **hanya tambah** (trigger `reject_change`, PRI-02). Keputusan baru dan koreksi baru selalu menambah baris; yang lama tetap terlihat di riwayat.

| Tabel | Isi | Kunci/pagar |
|---|---|---|
| `attendance_reviews` | catatan absen, hasil (`FINE` = Wajar, `NEEDS_CORRECTION` = Perlu dikoreksi), alasan, oleh (akun), kapan | hanya tambah; putusan yang berlaku = baris terbaru per catatan absen |
| `attendance_corrections` | orang, tanggal hari kerja, **nilai baru lengkap** (cabang, shift, versi jam, jam masuk, jam pulang), **nilai lama lengkap**, menit telat dan pulang cepat hasil hitung ulang, alasan baku, keterangan, oleh, kapan, nomor kelompok (banyak orang), membalik koreksi nomor | hanya tambah; keadaan hari yang berlaku = koreksi terbaru, atau catatan absen asli bila belum ada koreksi |
| `attendance_pattern_flags` | jenis (`REPEAT_OUTSIDE`, `SHARED_POINT`), orang terkait, catatan absen terkait, tanggal terdeteksi | hanya tambah; satu tanda per kejadian (kunci jenis + kumpulan absen) |
| `attendance_pattern_seen` | tanda, oleh, kapan, catatan | hanya tambah; menandai "Sudah dilihat" |

Koreksi menyimpan keadaan hari utuh, bukan satu kolom. Dengan begitu membalik koreksi cukup menulis keadaan lama sebagai koreksi baru, dan hari tanpa absen (Tambah absen) tidak membutuhkan baris `attendance_days` palsu. Tidak ada angka yang diketik tangan. Menit telat dan pulang cepat dihitung server dengan fungsi L3b yang sama (`lateMinutes`, `earlyLeaveMinutes`, KEH-29).

**Pengaturan baru (bertanggal berlaku, layar Pengaturan yang sudah ada):**

| Kunci | Isi awal | Sumber |
|---|---|---|
| `attendance.late_tolerance_minutes` | 5 | KEH-22 (tanda "dalam toleransi" untuk kantor) |
| `attendance.pattern_outside_count` | 3 | KEH-115 butir 1 |
| `attendance.pattern_window_workdays` | 7 | KEH-115 butir 1 |
| `attendance.pattern_same_point_m` | 10 | KEH-115 butir 2 |

## 3. Aturan

Aturan murni ada di `modules/attendance/rules`, tanpa DB, dan paling banyak dites.

- **Satu fungsi keadaan hari** (`effectiveDay`): menggabungkan catatan absen asli dengan koreksi terbaru. Fungsi ini dipakai Catatan Hari Kerja, Rekap, Kehadiran Saya, dan langkah Periksa di Koreksi. Karyawan dan kantor melihat angka yang sama (KEH-76, WAJ-04).
- **Status hari** dihitung saat dibuka dari keadaan hari, dengan urutan KEH-118 sejauh yang sudah ada: ada jam masuk = **Hadir**; jika tidak ada, hari tutup cabangnya = **Hari tutup**; jika tidak ada juga = **Belum ditentukan**. Hari yang masih berjalan dan hari sebelum tanggal masuk orang itu tidak dihitung. Hari kosong tidak pernah ditebak (§9 butir 1).
- **Periode rekap** 26 sampai 25, sama dengan slip nanti (KEH-119).
- **Putusan tinjauan** (KEH-114): hanya untuk absen bertanda perlu ditinjau. Pilihannya Wajar atau Perlu dikoreksi, dengan alasan wajib (panjang minimum `shared.reason_min_length`). Putusan boleh diganti, dan riwayatnya tetap. Perlu dikoreksi membuka Koreksi dengan orang dan tanggal sudah terisi. Tanda luar titik tetap tersimpan di catatan absen; yang berubah hanya status putusannya.
- **Koreksi** (KEH-116): yang boleh diubah adalah jam masuk, jam pulang, dan cabang hari itu, atau Tambah absen untuk hari tanpa absen. Jam istirahat tidak dikoreksi. Aturan jam yang dipakai sama dengan absen: jam pulang sesudah jam masuk, paling lambat batas 04.00 keesokan hari (KEH-18). Bila cabang diganti, shift dipilih ulang: bawaannya shift bernama sama di cabang itu (§9 butir 3). Untuk banyak orang: satu cabang, satu tanggal, satu alasan; jam diisi sekali lalu boleh diubah per orang; lebih dari 5 orang memakai tombol tahan (`shared.hold_seconds_consequential`).
- **Tidak mengoreksi atau memutuskan absen sendiri** (KEH-117): tindakan baru diberi tanda `selfForbidden`, sehingga `can()` menolak di server. Absen HR dikoreksi Pemilik atau GM. Pemilik dan GM tidak diabsen.
- **Bentrok simpan:** Koreksi dan Tinjau mengirim nomor keadaan yang dilihat layar. Bila orang lain sudah menyimpan lebih dulu, server menolak dengan pesan "Absen ini baru saja diubah orang lain. Muat ulang." Penyimpanan memakai kunci per orang + tanggal.
- **Membalik koreksi:** menulis koreksi baru berisi keadaan sebelum koreksi itu, dengan alasan wajib. Keduanya tampil di riwayat.
- **Pola lokasi** (KEH-115): (1) orang yang absen di luar radius sebanyak `pattern_outside_count` kali atau lebih dalam `pattern_window_workdays` hari kerja terakhirnya; (2) dua orang berbeda yang absen dari titik berjarak kurang dari `pattern_same_point_m` pada hari yang sama, dan keduanya di luar radius. Absen dalam radius tidak pernah ditandai. Tanda pola tidak menahan apa pun dan bukan tugas. Tanda boleh ditandai Sudah dilihat dengan catatan.
- **Telat di layar** (KEH-119): karyawan melihat menit telat apa adanya, tanpa kata "toleransi" dan tanpa nominal. Kantor melihat tambahan tanda "dalam toleransi" bila menitnya tidak lebih dari `late_tolerance_minutes`.
- **Foto** tetap mengikuti L3b: tanpa unduh, dan setiap pembukaan dicatat. Foto yang sudah dibuang menampilkan "Foto sudah dihapus; jam dan jarak tetap tercatat".

## 4. Layar

| Layar | Alamat | Menu | Isi |
|---|---|---|---|
| Tinjau Absen (KEH-L12) | `/kehadiran/tinjau` | Kehadiran | Tab **Luar titik**: menunggu putusan (terlama di atas), sudah diputuskan, dengan saringan "Perlu dikoreksi, belum dikoreksi". Menampilkan nama, cabang, jam, jarak/radius, akurasi, dan foto. Tab **Pola**: jenis pola, orang, tautan ke absennya, dan tombol Sudah dilihat |
| Koreksi Absen (KEH-L13) | `/kehadiran/koreksi` | Kehadiran | 4 langkah: Pilih → Isi nilai baru → Alasan → Periksa (jam lama dan baru berdampingan, telat dan pulang cepat hasil hitung ulang). Tab **Riwayat** dengan cari dan saring cabang/periode, serta tombol Balik |
| Foto Absen Hari Ini (KEH-L14) | `/kehadiran/foto-hari-ini` | Kehadiran | Seperti L3b, ditambah pilihan tanggal sampai 60 hari ke belakang |
| Catatan Hari Kerja (KEH-L15) | `/kehadiran/catatan-hari` | Kehadiran | Kartu satu orang satu hari: cabang, shift, jam kerja berlaku, masuk, istirahat, masuk kembali, pulang, telat, pulang cepat, lewat batas istirahat, status beserta asal, tanda kecil ("Dikoreksi" bertaut ke riwayat, "Tidak istirahat karena sendiri", "Shift belum ditentukan", "Perlu ditinjau"). Tombol Koreksi |
| Rekap Kehadiran (KEH-L16) | `/kehadiran/rekap` | Kehadiran | Pilih periode dan cabang. Baris = orang. Kolom: Hadir, Telat (kali/menit), Pulang cepat, Hari tutup, Belum ditentukan, Perlu ditinjau, dan kolom yang belum dibangun bertanda "-". Angka bisa diklik ke daftar hari → Catatan Hari Kerja. Baris ringkasan cabang |
| Kehadiran Saya (KEH-L17) | `/kehadiran-saya` | Saya | HP: ringkasan periode, lalu daftar hari (tanggal, masuk, pulang, telat menit, status). Ketuk hari untuk melihat rincian, termasuk keterangan "Dikoreksi HR" beserta alasannya |

**Beranda:** bagi yang berhak memutuskan, kartu Perlu perhatian menampilkan "Absen menunggu tinjauan: N" yang bertaut ke Tinjau Absen.

## 5. Hak

Pemilik dan GM memiliki semuanya (KAR-67), kecuali atas dirinya sendiri. S = semua, C = cabang atau departemennya.

| Tindakan | HR | Admin HR | Kepala Toko | Kepala Gudang | Finance |
|---|---|---|---|---|---|
| `attendance.review.view` (daftar tinjau + pola) | S | S | C | C | — |
| `attendance.review.decide` (Wajar / Perlu dikoreksi, Sudah dilihat) · selfForbidden | S | — | — | — | — |
| `attendance.correction.create` · selfForbidden | S | — | — | — | — |
| `attendance.correction.view` (riwayat koreksi) | S | S | — | — | S |
| `attendance.recap.view` (Catatan Hari + Rekap orang lain) | S | S | C | C | S |
| `attendance.my_recap.view` (Kehadiran Saya) · selfOnly | semua jabatan dengan cara absen `QR` | | | | |

Foto di Tinjau Absen memakai hak `attendance.photo.view` yang sudah ada. Pemegang hak review tanpa hak foto melihat daftar tanpa foto. Alasan izin dan sakit kelak tidak tampil untuk kepala cabang (KEH-80); di L3c belum ada izin.

## 6. Mesin terjadwal

| Pekerjaan | Jadwal (WIB) | Isi |
|---|---|---|
| `attendance-pattern-scan` | Tiap hari 05.00 | Mencari dua pola §3 untuk hari kemarin, dan menulis tanda baru sekali per kejadian. Ambang dibaca dari pengaturan pada tanggal itu. Aman diulang; hari yang terlewat dikejar sampai 7 hari ke belakang |

## 7. Pemberitahuan

| Kejadian | Kepada |
|---|---|
| Koreksi tersimpan (termasuk dibalik) | Orang yang dikoreksi: "Absen Anda 7 Oktober dibetulkan HR: …" |

Putusan Wajar dan tanda pola tidak memberi tahu siapa pun. Tanda pola cukup terlihat di Tinjau Absen, karena sifatnya bukan tugas (KEH-115).

## 8. Tes

**Unit (`rules`):** `effectiveDay` (tanpa koreksi, satu koreksi, koreksi dibalik, Tambah absen); status hari (Hadir, Hari tutup, Belum ditentukan, hari berjalan, sebelum tanggal masuk); hitung ulang telat dan pulang cepat termasuk shift lewat tengah malam; periode 26 sampai 25; dalam toleransi; kedua pola lokasi (ambang tepat, absen dalam radius tidak ditandai, orang yang sama tidak membentuk pola titik bersama).

**Integrasi DB:** tabel baru tidak bisa diubah atau dihapus; tidak bisa mengoreksi atau memutuskan absen sendiri (ditolak server); bentrok simpan ditolak; koreksi banyak orang hanya satu cabang dan satu tanggal; Tambah absen untuk hari tanpa absen; mesin pola aman diulang; hak per lingkup (kepala cabang hanya cabangnya, Finance hanya riwayat dan rekap); Kehadiran Saya hanya diri sendiri.

**Uji owner di staging** memakai karyawan uji. Daftar langkah dikirim saat tayang: putuskan absen luar radius, koreksi satu orang, koreksi banyak orang, balik koreksi, Tambah absen, rekap dan Kehadiran Saya menunjukkan angka yang sama, login sebagai HR lalu coba koreksi absen sendiri (harus ditolak).

**Syarat HRIS:** fragment `apps/hris/changelog.d` + tanda Baru di `lib/new-features.ts` untuk tiap menu baru (Tinjau Absen, Koreksi Absen, Catatan Hari, Rekap, Kehadiran Saya) dan bagian baru (pilihan tanggal Foto Absen, kartu Beranda).

## 9. Keputusan owner (disetujui 2026-11-02)

1. **Status hari dihitung saat dibuka, belum ada mesin harian 04.10.** v3 menulis catatan hari kerja tiap malam. Saat ini bagian Libur, Izin, dan Alpha belum ada, jadi catatan malam itu harus ditulis ulang setiap kali bagian baru datang. **Saran: hitung saat dibuka dengan satu fungsi.** Catatan yang terkunci dibuat saat Gaji (L4) butuh kunci slip. Angkanya tetap sama untuk karyawan dan kantor.
2. **Kunci slip, slip tertahan, dan koreksi susulan menunggu Gaji (L4).** Belum ada slip, jadi belum ada hari yang terkunci. **Saran: setuju.** Tinjau Absen tetap menunjukkan "menunggu putusan" tanpa tenggat slip. Aturan tahan slip dipasang di L4.
3. **Koreksi ganti cabang:** jam kerja ikut cabang baru (KEH-08), jadi shift harus dipilih ulang. **Saran: bawaannya shift bernama sama di cabang itu**, seperti perbantuan, dan HR boleh menggantinya.
4. **Tambah absen** (HP atau kamera rusak, KEH-30): tanpa foto dan lokasi. **Saran: tercatat sebagai koreksi bertanda "Ditambahkan HR"** beserta alasannya, dan tidak membuat catatan absen palsu.
5. **Toleransi telat 5 menit** menjadi pengaturan bertanggal baru, hanya untuk tanda "dalam toleransi" di layar kantor. **Saran: setuju.** Potongan uangnya baru di L4.
6. **Pola lokasi** memakai angka v3: 3 kali dalam 7 hari kerja, dan titik berjarak kurang dari 10 m. "7 hari kerja" = 7 hari terakhir orang itu benar-benar absen. **Saran: setuju**, dan angkanya bisa diubah di Pengaturan.
7. **Pemberitahuan:** v3 meminta orangnya diberi tahu saat dikoreksi. **Saran: hanya koreksi yang memberi tahu orangnya.** Putusan Wajar dan tanda pola tidak memberi tahu. HR mendapat angka "Absen menunggu tinjauan" di Beranda.
8. **Perlu dikoreksi tanpa koreksi:** **saran: absen itu dianggap sudah diputuskan**, dan tetap muncul di saringan "Perlu dikoreksi, belum dikoreksi" sampai ada koreksi untuk hari itu. Dengan begitu, tidak ada yang terlupa.

## 10. Catatan implementasi (2026-11-02)

- Kode: `modules/attendance/rules/review.ts` (aturan murni), `server/review.ts` (pemuat hari bersama `loadDayInfos`, layar, simpan), `ui/{review,correction,day-record,recap,my-attendance}-screen.tsx`, route `app/api/attendance/review`. Migrasi `hris` 0010 (empat tabel hanya tambah, empat pengaturan, hak awal).
- Bentrok simpan memakai nomor koreksi/putusan terakhir yang dilihat layar dan kunci per orang + tanggal; yang kalah mendapat 409 "Muat ulang".
- Hanya koreksi terakhir per orang + tanggal yang bisa dibalik, supaya urutan keadaan tidak bercabang.
- Rekap dan status hari memakai penempatan orang pada akhir periode (atau hari ini) untuk saringan cabang dan pemeriksaan hari tutup pada hari tanpa absen. Hari dengan absen memakai cabang tempat ia masuk.
- Daftar Tinjau mengambil absen bertanda 120 hari terakhir; tab Pola 60 hari terakhir. Mesin pola mengejar 7 hari ke belakang. Pola 1 tidak ditandai lagi untuk orang yang sama dalam rentang hari kerja yang sama.
- Langkah Periksa menghitung telat di layar dengan fungsi aturan yang sama; server menghitung ulang lagi saat menyimpan.
- Tes integrasi memakai tanggal lampau. Tes L3b `check.integration.test.ts` memakai jam hari ini, sehingga gagal bila dijalankan sebelum jam ujinya (mis. tengah malam), karena hasil langkah lokasi dicap jam server. Ini rapuh sejak L3b; CI tidak menjalankannya karena butuh DB.
