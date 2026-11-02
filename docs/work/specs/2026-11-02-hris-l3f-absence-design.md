# Spec HRIS L3f — Izin, Sakit, dan Cuti

Tanggal: 2026-11-02 · Status: **disetujui owner 2026-11-02 (§9 semua sesuai saran)**
Cakupan: bagian keenam L3, yaitu 4D-4b di [PRD 05](../../hris_planning/PRD/fase_1/05-kehadiran.md): Ajukan Izin, Sakit, atau Cuti; Sisa Cuti Saya; Susulkan Surat Dokter; Keterangan Pembantu Putusan; Isikan Pengajuan atas Nama (KEH-L30 s.d. L34), ditambah tab "Tidak masuk" di Libur Cabang (KEH-L27).
Sumber: v3 `02-kehadiran` KEH-36 s.d. 42, 47 s.d. 51, 80, 107, 118, 141 s.d. 149; `kehadiran-spec` §3.7, §4 (`pengajuan_tidak_masuk`, `tanggal_tidak_masuk`, `surat_dokter`, `akses_surat_dokter`, `tahun_cuti`, `gerak_cuti`), §6 (Penutup tahun cuti, Penghapus surat dokter); jawaban owner 4D-4b M1 s.d. M9 (13 Oktober 2026).
Dasar kode: L2f-1 (Mesin Pengajuan `submitRequest`/`decideRequest`/`cancelRequest`, lampiran tertutup `modules/files`, `notify()`, Beranda), L2c (`joinedOn`, penempatan), L2e (pengaturan bertanggal, Pengaturan Jabatan), L3c (`dayStatus`, Catatan Hari Kerja, Rekap, `payPeriodOf`), L3e (libur `ACTIVE`, Hari tutup, Libur Cabang, Tukar).
Aliran migrasi: **`hris` 0013**. Modul: `apps/hris/modules/attendance` (isi khas + aturan), `apps/hris/modules/requests` (tambahan Cabut persetujuan).

## 1. Batas

**Dikerjakan:** satu jenis pengajuan baru **Izin, Sakit, atau Cuti** di Mesin Pengajuan dengan lima jenis tidak masuk (izin keperluan, sakit tanpa surat, sakit dengan surat, cuti tahunan, izin duka), label **izin mendadak** dari server, hitungan hari kerja, batas waktu, bentrok, surat dokter menyusul, tahun cuti + pesan jatah + hangus, Isikan atas nama, **Cabut persetujuan** (tindakan baru Mesin Pengajuan), status hari **Izin / Sakit / Cuti**, tab Tidak masuk di Libur Cabang, "tidak masuk" di jadwal teman, dan mesin harian.

**Tidak dikerjakan di L3f:**

| Hal | Di mana | Akibat sementara |
|---|---|---|
| Alpha dan Perlu Dijelaskan (klarifikasi) | 4D-5a | Pengajuan yang lewat batas ditolak dengan pesan "Ajukan klarifikasi (menyusul)"; harinya tetap "Belum ditentukan" |
| Potongan izin, izin mendadak, sakit, dan hari dibayar (GAJ-13, 14) | Gaji (L4) | Jenis dan label mendadak sudah tercatat per tanggal dan siap dibaca Gaji; belum ada rupiah |
| Kunci slip periode (batas Cabut, hapus foto surat 60 hari sesudah slip ditutup) | Gaji (L4) | §9 butir 5 |
| Pengingat berantai (TAM-22) | Pemberitahuan lengkap | Pemberitahuan sekali per tanda (§9 butir 8) |
| Batal sebagian hari dari satu pengajuan | — | Batalkan seluruhnya lalu ajukan ulang tanggal yang benar |
| Cuti setengah hari | Tidak ada (KEH-145) | — |

## 2. Data (`hris` 0013)

Tidak ada baris yang dihapus (PRI-02). Status pengajuan memakai `hris.requests` (L2f-1); tabel di bawah hanya isi khasnya.

| Tabel | Isi | Kunci/pagar |
|---|---|---|
| `absence_requests` | pengajuan (rujukan `requests`), orang, jenis (`PERMIT`, `SICK`, `SICK_LETTER`, `ANNUAL_LEAVE`, `BEREAVEMENT`), label mendadak (ditulis server), tanggal mulai dan selesai, hubungan (duka), alasan, surat menyusul (ya/tidak), asal (`SELF`, `ON_BEHALF`; `CLARIFICATION` disiapkan untuk 4D-5a), alasan diisikan | unik per pengajuan; isi tidak bisa diubah sesudah disimpan, kecuali tanda surat masuk |
| `absence_days` | pengajuan, orang, tanggal, hitungan (`PERMIT`, `PERMIT_SUDDEN`, `SICK`, `SICK_LETTER`, `ANNUAL_LEAVE`, `BEREAVEMENT`), berlaku (ya/tidak) | **satu tanggal berlaku per orang** (indeks unik bersyarat); hanya hari kerja orang itu (KEH-41) |
| `doctor_letters` | pengajuan, berkas (rujukan `files`), diunggah kapan (jam server), masuk kembali pada (dari absen Masuk pertama sesudah sakit), dalam batas (ya/tidak) | satu surat berlaku per pengajuan |
| `doctor_letter_views` | berkas, dibuka oleh, kapan | hanya tambah (KEH-144) |
| `leave_years` | orang, awal, akhir, jatah | unik orang + awal; tahun pertama mulai tepat 1 tahun sesudah `joinedOn` |
| `leave_movements` | tahun cuti, jenis (`RESERVE`, `USE`, `RETURN`, `EXPIRE`, `ADJUST`), jumlah hari (bertanda), pengajuan, oleh, alasan (wajib untuk `ADJUST`), kapan | hanya tambah; **sisa = jatah + jumlah gerak** |

`absence_days.berlaku` menjadi ya saat dikirim (Menunggu juga memblokir tanggal, KEH-149) dan tidak saat ditolak, dibatalkan, atau dicabut. Sakit dengan **surat menyusul** disimpan sebagai `SICK` sampai surat masuk; surat dalam batas menulis ulang hitungannya menjadi `SICK_LETTER` (satu fungsi, WAJ-04).

**Pemeriksaan bersamaan:** Kirim dan Isikan mengunci orang itu di DB (`pg_advisory_xact_lock`) sebelum memeriksa bentrok dan sisa cuti, sehingga dua kirim bersamaan tidak sama-sama lolos.

**Pengaturan baru (bertanggal berlaku, layar Pengaturan L2e):**

| Kunci | Isi awal | Sumber |
|---|---|---|
| `attendance.leave_annual_quota` | 10 hari | KEH-48 |
| `attendance.leave_annual_notice_days` | H-7 | KEH-48, 141 |
| `attendance.leave_permit_notice_days` | H-2 (kurang dari itu = izin mendadak) | KEH-50, 142 |
| `attendance.leave_late_submit_days` | 3 hari sesudah hari pertama (sakit, mendadak, duka) | KEH-141 |
| `attendance.sick_no_letter_max_days` | 2 hari kerja berturut-turut | KEH-50, 143 |
| `attendance.bereavement_days` | 2 hari kerja | KEH-49, 146 |
| `attendance.doctor_letter_grace_days` | 3 hari sesudah masuk kembali | KEH-51, 143 |

## 3. Aturan

Aturan murni di `modules/attendance/rules/absence.ts`, tanpa DB, dan paling banyak dites. Semua diperiksa **server** (WAJ-04); layar hanya menampilkan hasil. Jam dari server (PRI-01).

- **Siapa bisa mengajukan:** karyawan aktif dengan cara absen `QR`. Pemilik, GM (KAR-67), dan Driver/Kenek per ritase tidak melihat jenis ini; server menolak.
- **Hari kerja (KEH-41):** tanggal dalam rentang dikurangi libur `ACTIVE` orang itu dan Hari tutup cabangnya. Layar menulis "3 hari kerja (libur Anda Kamis 12 Nov tidak dihitung)". Rentang tanpa satu pun hari kerja ditolak.
- **Batas waktu (KEH-141):** dihitung dari saat dikirim, tanggal WIB.
  - Izin keperluan: mulai **≥ hari ini + 2** = izin biasa; kurang dari itu = **izin mendadak** (label server, KEH-142), paling lambat 3 hari sesudah hari pertama.
  - Cuti tahunan: mulai **≥ hari ini + 7**; kurang dari itu ditolak.
  - Sakit (dua jenis) dan izin duka: boleh sampai **3 hari sesudah hari pertama**.
  - Lewat batas: ditolak dengan "Batas mengajukan sudah lewat. Ajukan klarifikasi (menyusul)".
- **Izin mendadak (KEH-142):** tidak ada tombolnya. Bila server melabeli, layar Periksa menulis "Pengajuan ini dicatat sebagai izin mendadak. Potongannya lebih besar dari izin biasa." dan tombol Kirim **ditahan 3 detik** (TAM-15). Label dihitung ulang saat Kirim, bukan dipercaya dari layar.
- **Sakit tanpa surat (KEH-143):** paling lama 2 hari kerja berturut-turut; lebih dari itu ditolak dengan "Pilih sakit dengan surat dokter" dan tombol **Ganti ke dengan surat**. "Berturut-turut" juga menghitung sakit tanpa surat yang berlaku tepat sebelum atau sesudahnya.
- **Sakit dengan surat:** foto surat (kamera atau galeri) **atau** pilihan **Surat menyusul**. Selama surat belum masuk, harinya dihitung sakit tanpa surat. Batas menyusul = **3 hari sesudah absen Masuk pertama sesudah sakit**. Surat yang masuk dalam batas menghitung ulang hari-harinya menjadi sakit dengan surat; lewat batas, tombol mati dan harinya tetap sakit tanpa surat.
- **Izin duka (KEH-49, 146):** hubungan wajib (ayah, ibu, suami, istri, anak); lampiran tidak wajib. Lebih dari 2 hari kerja: tanggal dipotong pada hari kerja ke-2 dengan pesan "Hari ke-3 dan seterusnya diajukan terpisah sebagai izin keperluan atau cuti".
- **Cuti tahunan (KEH-48, 145):** tahun cuti pertama mulai tepat **1 tahun sesudah tanggal bergabung**, berlaku setahun, jatah 10 hari. Sebelum itu jenis cuti tampil redup: "Cuti pertama bisa diajukan mulai 1 Maret 2027". Hari yang diajukan **langsung dipesan** (`RESERVE`); melebihi sisa ditolak. Disetujui → `USE`; ditolak, dibatalkan, atau dicabut → `RETURN`. Rentang yang melewati akhir tahun cuti ditolak dengan "Pecah menjadi dua pengajuan, satu per tahun cuti". Tidak ada uang pengganti.
- **Bentrok (KEH-149):** tanggal yang sudah berisi izin, sakit, atau cuti berlaku (Menunggu atau Disetujui) ditolak dengan pesan yang menyebut tanggal dan pengajuannya. Batas "2 orang libur per cabang" (KEH-34) **tidak** menahan izin, sakit, atau cuti.
- **Ke arah sebaliknya (catatan L3e §10):** Pilih Libur, Ubah langsung, dan ajakan Tukar kini **menolak** tanggal yang berisi izin, sakit, atau cuti berlaku orang itu atau temannya (KEH-136).
- **Selama menunggu (KEH-147):** harinya tetap "Belum ditentukan", dengan keterangan "menunggu keputusan" supaya karyawan tidak cemas. Tidak pernah disetujui otomatis.
- **Batal dan Cabut (KEH-39, 40, 148):** pengaju membatalkan selama Menunggu (sudah ada di L2f-1). Sesudah disetujui, lihat §9 butir 3. HR, Pemilik, atau GM bisa **Cabut persetujuan** dengan alasan wajib; tanggalnya lepas, cuti dikembalikan, orangnya diberi tahu. Yang mencabut tidak boleh pengajuan miliknya sendiri.
- **Isikan atas nama (KEH-148):** HR, Pemilik, GM untuk orang lain (bukan dirinya). Isian dan batas waktu sama, dihitung dari saat diisikan. **Alasan kenapa diisikan** wajib. Kartu bertanda "Diisi oleh [nama]"; yang mengisi tidak bisa memutuskannya (sudah dijaga `isOwnRequest`); orangnya diberi tahu.
- **Status hari kerja (KEH-81, 118):** bertambah **Izin**, **Sakit**, **Cuti** (dibaca dari `absence_days` berlaku milik pengajuan **Disetujui**). Urutan: absen Masuk → Hadir; Hari tutup; Libur terjadwal; Izin/Sakit/Cuti; selain itu Belum ditentukan. Absen nyata di hari izin → **Hadir**, dengan catatan "ada izin disetujui yang bentrok" untuk HR (§9 butir 6). Rincian jenis (mendadak, dengan surat, duka) tampil di Catatan Hari Kerja dan Rekap bagi yang berhak.
- **Siapa melihat apa (KEH-42, 80, 107, 144, 149):** karyawan (teman satu cabang) dan Kepala Toko/Gudang hanya melihat **tanggal, nama, dan "Tidak masuk"** beserta status (Menunggu, Disetujui). Jenis dan alasan hanya HR, Pemilik, GM. **Foto surat dokter** hanya HR, Pemilik, GM, dan pengajunya; tiap pembukaan oleh selain pengaju dicatat di `doctor_letter_views`.

## 4. Layar

Error di jendela "OK, paham"; tombol Kirim/Simpan terkunci selama proses; isian tidak hilang saat sinyal putus (TAM-16). Daftar Pengajuan Saya, kartu status, Batalkan, Ajukan ulang, dan kotak Persetujuan memakai layar L2f-1 dan **tidak digambar ulang**.

| Layar | Alamat | Menu | Isi |
|---|---|---|---|
| Ajukan Izin, Sakit, atau Cuti (KEH-L30) | `/tidak-masuk/ajukan` (dari Pengajuan Saya › Ajukan) | Saya | HP, 4 langkah: **Jenis** (tombol besar per jenis, batas waktu satu kalimat di bawahnya, redup + alasan bila belum berhak) → **Tanggal** (dari–sampai, hitungan hari kerja langsung, bentrok ditolak) → **Isian khas** (alasan / foto surat atau Surat menyusul / sisa "10 → 7 hari" / hubungan duka) → **Periksa dan Kirim** (label mendadak + tahan 3 detik). Kembali tanpa kehilangan isian; Ulangi dari awal |
| Sisa Cuti Saya (KEH-L31) | `/cuti` | Saya | HP. Kepala tahun cuti, angka besar **Sisa**, lalu Jatah, Dipesan, Dipakai, Hangus pada. Riwayat gerak terbaru di atas; tahun lama dimuat saat diminta. Sebelum 1 tahun: tanggal cuti pertama + jatah, tanpa angka sisa. Tombol **Ajukan cuti** |
| Susulkan Surat Dokter (KEH-L32) | `/tidak-masuk/surat-dokter` | Saya (dan kartu "Surat menyusul" di Pengajuan Saya + Beranda) | HP. Daftar sakit "Surat menyusul" dengan "Tinggal 2 hari lagi"; 2 langkah: foto (kamera/galeri) → periksa dan Kirim. Lewat batas: tombol mati + penjelasan |
| Keterangan Pembantu Putusan (KEH-L33) | di dalam `/persetujuan/[id]` | — | PC. Cuti: sisa sebelum/sesudah, tahun cuti, hangus pada. Orang lain di cabangnya yang tidak masuk pada tanggal itu (nama saja; "3 orang lain tidak masuk Kamis", tidak memblokir). Tanda "ada absen; bentrok". Kebiasaan: jumlah izin dan sakit periode berjalan dan sebelumnya. Foto surat (hanya HR/Pemilik/GM, dicatat). Label "Izin mendadak", "Diisi oleh …". Tombol Setujui, Tolak, **Cabut persetujuan** |
| Isikan Pengajuan atas Nama (KEH-L34) | `/kehadiran/isikan` | Kehadiran | PC, 4 langkah: pilih orang (semua cabang, bukan diri sendiri) → jenis dan tanggal (isian sama dengan KEH-L30) → alasan kenapa diisikan + lampiran → periksa dan Kirim |
| Tab **Tidak masuk** di Libur Cabang (KEH-L27) | `/kehadiran/libur` | Kehadiran | PC. Kalender cabang per tanggal: nama + Tidak masuk + status. Kepala Toko/Gudang tanpa jenis dan alasan; HR, Pemilik, GM melihat jenis dan membuka pengajuannya |

**Layar lama yang ikut berubah:** Jadwal Saya, Pilih Libur, dan Lihat teman menampilkan teman satu cabang yang tidak masuk sebagai "Tidak masuk" (tanpa jenis); Catatan Hari Kerja, Rekap Kehadiran, Kehadiran Saya, dan Tinjau Absen mengenal status Izin, Sakit, Cuti dan catatan bentrok; Absen menampilkan "Hari ini Anda tercatat izin/sakit/cuti" (tombol Masuk tetap aktif, KEH-118); Halaman orang mendapat ringkas Sisa Cuti + **Sesuaikan sisa** (§9 butir 4); Beranda mendapat kartu "Surat dokter belum disusulkan" dan "Pengajuan menunggu pada hari H" untuk penyetuju.

## 5. Hak

Tindakan baru + hak awal di migrasi. Pemilik dan GM memiliki semuanya (KAR-67). S = semua, C = cabang atau departemennya.

| Tindakan | HR | Admin HR | Kepala Toko | Kepala Gudang | Finance |
|---|---|---|---|---|---|
| Ajukan, Sisa Cuti, Susulkan surat (diri sendiri) | ikut `attendance.self.check`, cara absen QR, bukan Pemilik/GM (§3) | | | | |
| `absence.decide` (Setujui, Tolak, Cabut, lihat jenis/alasan/surat) · selfForbidden | S | — | — | — | — |
| `absence.submit_for` (Isikan atas nama) · selfForbidden | S | — | — | — | — |
| `absence.adjust_leave` (Sesuaikan sisa cuti) · selfForbidden | S | — | — | — | — |
| Tab Tidak masuk (tanggal + status saja) | ikut `attendance.dayoff.view` (S/C seperti L3e) | | | | |

Penolakan server yang dites: GM atau Driver per ritase mengajukan; mengajukan atas nama orang lain tanpa `absence.submit_for`; Isikan untuk diri sendiri; yang mengisi ikut memutuskan; Kepala Toko membuka jenis, alasan, atau foto surat; Admin HR atau Finance membuka foto surat; cuti melebihi sisa; cuti kurang dari H-7; sakit tanpa surat 3 hari; tanggal bentrok; surat menyusul lewat batas; Cabut oleh yang tidak berhak.

## 6. Mesin terjadwal

Satu pekerjaan baru `absence-daily`, **tiap hari 00.20 WIB**, aman diulang:

1. **Penutup tahun cuti:** tahun cuti yang berakhir kemarin → satu gerak `EXPIRE` sebesar sisa (kunci tahun cuti, tanpa dobel); buka tahun berikutnya bila orangnya masih aktif. Yang terlewat dikejar.
2. **Surat menyusul:** catat tanggal masuk kembali dari absen Masuk pertama sesudah sakit; pengingat "tinggal 1 hari" sekali.
3. **Menunggu pada hari H (KEH-147):** pengajuan yang masih Menunggu saat tanggal mulainya tiba → satu pemberitahuan ke penyetuju.
4. **Sisa cuti mau hangus:** 30 hari sebelum akhir tahun cuti dengan sisa > 0 → satu pemberitahuan ke orangnya (§9 butir 8).

Penghapus foto surat dokter **belum** dibuat (§9 butir 5). Baris baru di `infra/apps/cron/crontab` (UTC, seperti pekerjaan lain).

## 7. Pemberitahuan

| Kejadian | Kepada |
|---|---|
| Pengajuan masuk (sudah ada, Mesin Pengajuan) | Penyetuju (`absence.decide`) |
| Disetujui / ditolak (sudah ada) | Pengaju dan orangnya |
| Dicabut / dibatalkan sesudah disetujui | Orangnya; penyetuju yang menyetujui |
| Diisikan atas nama | Orangnya |
| Surat dokter tinggal 1 hari | Pengaju |
| Masih menunggu saat hari H | Penyetuju |
| Sisa cuti hangus 30 hari lagi | Orangnya |

Kepala Toko dan Kepala Gudang tidak diberi tahu; mereka melihat di tab Tidak masuk (KEH-80).

## 8. Tes

**Unit (`rules/absence.test.ts`, menyebut nomor KEH):** hari kerja melewati libur dan Hari tutup (KEH-41); izin H-2 biasa vs mendadak (KEH-142); cuti H-7 (KEH-48); batas 3 hari sesudah hari pertama (KEH-141); sakit tanpa surat 2 hari termasuk berturut-turut dengan pengajuan sebelumnya (KEH-143); duka dipotong di hari ke-2 (KEH-146); tahun cuti dari tanggal bergabung + tahun pertama (KEH-145); rentang lewat akhir tahun cuti; batas surat menyusul dari masuk kembali (KEH-51); urutan status hari (KEH-118).

**Integrasi DB:** tidak ada hapus; satu tanggal berlaku per orang (dua kirim bersamaan → satu lolos); pesan → pakai → kembali pada tolak, batal, dan cabut; sisa tidak bisa minus; hangus sekali walau mesin diulang; surat dalam batas menghitung ulang hari, lewat batas ditolak; Isikan atas nama + yang mengisi tidak bisa memutuskan; Pilih Libur dan Tukar menolak tanggal izin; status hari Izin/Sakit/Cuti di Rekap; absen di hari izin → Hadir + catatan bentrok; pembukaan foto surat tercatat; pagar hak §5. Tes memakai tanggal lampau (pola L3c), supaya tidak rapuh jam.

**Uji owner di staging** dengan karyawan uji di HP: daftar langkah dikirim saat tayang. Karena cuti baru ada sesudah 1 tahun masa kerja, karyawan uji dipakai dengan tanggal bergabung lebih dari setahun lalu.

**Syarat HRIS:** fragment `apps/hris/changelog.d` + tanda Baru untuk `/tidak-masuk/ajukan`, `/cuti`, `/tidak-masuk/surat-dokter`, `/kehadiran/isikan`, dan tab Tidak masuk.

## 9. Keputusan owner (disetujui 2026-11-02: semua sesuai saran)

1. **Satu paket atau dipecah?** Lima layar ini memakai aturan hari kerja dan tabel yang sama. **Saran: satu paket** (satu kali uji), seukuran L3e.
2. **Satu tombol di Pengajuan Saya.** **Saran: satu jenis pengajuan "Izin, Sakit, atau Cuti"**, lalu jenisnya dipilih di langkah 1 (sesuai KEH-L30), supaya daftar Ajukan tidak bertambah lima tombol.
3. **Batal sesudah disetujui (KEH-40: "karyawan meminta, HR mengesahkan").** Batal hanya mengembalikan orangnya bekerja, jadi tidak merugikan perusahaan. **Saran: pengaju membatalkan sendiri sebelum tanggal mulai, tanpa menunggu HR**; penyetuju diberi tahu, cuti dikembalikan. Sesudah tanggal mulai, hanya **Cabut persetujuan** oleh HR, Pemilik, atau GM dengan alasan.
4. **Sisa cuti awal.** Data karyawan dan pemakaian cuti dari HRIS lama belum dimuat (L2g ditunda). **Saran: tahun cuti dihitung dari tanggal bergabung, sisa awal penuh 10 hari**, dan HR, Pemilik, atau GM bisa **Sesuaikan sisa** dengan alasan wajib (gerak `ADJUST`, tercatat) untuk memasukkan cuti yang sudah dipakai di sistem lama.
5. **Batas yang bergantung pada slip gaji.** Slip belum ada sampai L4. **Saran: Cabut persetujuan sementara tanpa batas slip, dan foto surat dokter disimpan dulu**; penghapus 60 hari sesudah slip ditutup dan kunci slip dibuat bersama penutupan slip di L4. Foto tetap tertutup dan pembukaannya dicatat.
6. **Absen nyata di hari izin atau cuti.** Sesuai KEH-118, status jadi **Hadir** dan HR melihat catatan bentrok. **Saran: jatah cuti hari itu tidak dikembalikan otomatis**; HR memutuskan lewat Cabut persetujuan atau Sesuaikan sisa. Dengan begitu tidak ada angka cuti yang berubah diam-diam.
7. **Siapa tidak bisa mengajukan.** **Saran: Pemilik, GM, dan jabatan yang tidak diabsen lewat QR** (Driver/Kenek per ritase, cara absen `NONE`) tidak melihat menu ini. Orang dalam masa Training tetap bisa izin dan sakit; cuti baru tersedia sesudah 1 tahun.
8. **Pengingat.** Pengingat berantai belum ada. **Saran: pemberitahuan sekali per tanda**: surat dokter tinggal 1 hari, pengajuan masih menunggu pada hari H (ke penyetuju), dan **sisa cuti hangus 30 hari lagi** (tambahan, tidak ada di v3). Pengingat berantai menyusul bersama Pemberitahuan lengkap.
