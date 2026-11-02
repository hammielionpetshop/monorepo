# Spec HRIS L3h — Lembur

Tanggal: 2026-11-02 · Status: **draf, menunggu persetujuan owner (§9)**
Cakupan: bagian kedelapan L3, yaitu 4D-5b di [PRD 05](../../hris_planning/PRD/fase_1/05-kehadiran.md): Ini Lembur?, Lembur Saya, Lembur Tim, Keterangan Pembantu Putusan Klaim Lembur (KEH-L40 s.d. L43), ditambah mesin penghangus klaim dan tiga angka lembur di rekap (KEH-77).
Sumber: v3 `02-kehadiran` KEH-25, 70 s.d. 77, 159 s.d. 167; `kehadiran-spec` §3.9, §4 (`lembur_terdeteksi`, `klaim_lembur`, `akses_foto_lembur`), §6 (Penghangus klaim lembur), keputusan pemilik 4D-5b E1 s.d. E8 (13 Oktober 2026); `03-gaji` GAJ-12 (Gaji hanya membaca **jam disahkan**).
Dasar kode: L2e (pengaturan bertanggal, Pengaturan Jabatan), L2f-1 (Mesin Pengajuan, `notify()`, Beranda, lampiran tertutup `modules/files`), L3a (shift, `closingTime` jam tutup toko turunan), L3b (`attendance_days` + `attendance_records`, perbantuan), L3c (`effectiveDay`, Koreksi + pembalik, Rekap, `payPeriodOf`), L3d (jam pulang = jam foto, dihitung sesudah Laporan Pulang terkirim, KEH-89), L3e (Hari tutup, Minta Masuk di Hari Libur), L3f (`revokeRequest`), L3g (lupa absen pulang yang dijelaskan ditulis sebagai koreksi `CLARIFICATION`).
Aliran migrasi: **`hris` 0015**. Modul: `apps/hris/modules/attendance` (lembur terdeteksi, klaim, mesin, layar).

## 1. Batas

**Dikerjakan:** satu fungsi server penghitung jam lembur terdeteksi; baris lembur terdeteksi per orang per hari; jendela "Ini lembur?" sesudah Laporan Pulang; satu jenis pengajuan baru **Klaim lembur** di Mesin Pengajuan (foto kertas lembur + yang menyuruh); pengesahan yang boleh menurunkan jam; mesin penghangus 04.30; tiga angka lembur (terdeteksi / diklaim / disahkan) di Rekap, Catatan Hari Kerja, dan Kehadiran Saya; dua pengaturan jabatan baru dan satu pengaturan cabang.

**Tidak dikerjakan di L3h:**

| Hal | Di mana | Akibat sementara |
|---|---|---|
| Nominal / tarif lembur (GAJ-12) | Gaji (L4) | Semua layar hanya menampilkan **jam**, tanpa Rp (memang begitu di v3) |
| Kunci slip: slip tak bisa ditutup selama ada klaim menunggu (KEH-69), batas Cabut sampai slip ditutup, penghapus foto 60 hari sesudah slip ditutup (KEH-167) | Gaji (L4) | §9 butir 5 |
| Pengingat berantai (TAM-22) | Pemberitahuan lengkap | Pemberitahuan sekali per tanda (§9 butir 7) |
| Lembur Driver/Kenek per ritase (absen trip) | — | Tidak pernah ada lembur (KEH-25, 99) |

## 2. Data (`hris` 0015)

Tidak ada baris yang dihapus atau ditimpa (PRI-02). Status klaim memakai `hris.requests` (L2f-1).

| Tabel | Isi | Kunci/pagar |
|---|---|---|
| `overtime_days` (lembur terdeteksi) | orang, tanggal kerja, cabang yang dipakai, jam pulang jadwal, jam pulang (jam foto / jam koreksi), jam tutup cabang yang dipakai, **jam terdeteksi** (0 s.d. 3, hanya ditulis server), pilihan orang (`UNANSWERED`, `LATER`, `NOT_OVERTIME`, `CLAIMED`), **batas klaim**, keadaan (`OPEN`, `CLAIMED`, `APPROVED`, `EXPIRED`, `VOID`), tanda "hari lupa absen yang dijelaskan" | **unik orang + tanggal** |
| `overtime_claims` (klaim lembur) | pengajuan (rujukan `requests`), lembur terdeteksi, **jam diklaim** (= jam terdeteksi saat dikirim, tidak diketik), foto kertas (rujukan `files`, tertutup), penyuruh (karyawan), ajukan ulang ke-n, **jam disahkan**, alasan penurunan | unik per pengajuan; satu klaim **berlaku** (Menunggu/Disetujui) per lembur terdeteksi (indeks unik bersyarat) |
| `overtime_photo_access` | foto, dibuka oleh, kapan | catatan saja (KEH-167) |
| `overtime_notices` | lembur terdeteksi, jenis (`ONE_DAY_LEFT`, `LAST_DAY`, `EXPIRED`) | unik lembur + jenis (sekali per tanda) |

Disahkan / dicabut oleh dan kapan memakai catatan keputusan Mesin Pengajuan; tidak disalin.

**Pemeriksaan bersamaan:** Kirim klaim dan Setujui mengunci orang itu di DB (`pg_advisory_xact_lock`, kunci yang sama dengan L3f/L3g), sehingga dua kirim bersamaan tidak sama-sama lolos dan koreksi yang sedang disimpan tidak menyalip pengesahan.

**Pengaturan baru (bertanggal berlaku, layar Pengaturan L2e):**

| Kunci | Isi awal | Sumber |
|---|---|---|
| `position.overtime_applies` (Dapat lembur, jabatan, usul HR → setuju Pemilik) | **ya**: Kepala Toko, Kasir, Pramuniaga, Groomer, HR, Admin HR, Finance, Marketing · **tidak**: Kepala Gudang, Driver, Kenek, Belum ditentukan, Pemilik, GM | KEH-25 |
| `position.overtime_orderer` (Boleh menyuruh lembur, jabatan) | ya: HR, Pemilik, GM | KEH-73, 163 |
| `attendance.office_closing_hour` (Jam tutup kantor, per cabang) | 20 (jam penuh, paling lambat 20) | KEH-71 (§9 butir 4) |
| `attendance.overtime_claim_days` | 3 hari sesudah tanggal, pukul 23.59 | KEH-74, 161 |
| `attendance.overtime_min_hours` / `overtime_max_hours` | 1 / 3 jam | KEH-70 |

## 3. Aturan

Aturan murni di `modules/attendance/rules/overtime.ts`, tanpa DB, dan paling banyak dites. Semua diperiksa **server** (WAJ-04); layar hanya menampilkan hasil. Jam dari server (PRI-01).

### 3.1 Cara menghitung (KEH-159, satu fungsi `detectOvertime`)

`jam terdeteksi = bulat ke bawah per jam penuh (min(jam pulang, jam tutup) − jam pulang jadwal)`; di bawah 1 jam → 0; lebih dari 3 → 3.

- **Jam pulang** = jam foto Pulang yang dihitung (sesudah Laporan Pulang terkirim, KEH-89) atau jam pulang koreksi yang berlaku (`effectiveDay`, termasuk koreksi `CLARIFICATION` L3g). Waktu menulis laporan tidak dihitung.
- **Jam tutup:** toko = jam pulang shift terakhir cabang itu (`closingTime` L3a, turunan, tidak disimpan); orang departemen **Office** = pengaturan jam tutup kantor cabangnya. Akibatnya shift terakhir toko tidak pernah lembur (KEH-71).
- **Perbantuan:** jam kerja dan jam tutup **cabang tujuan** (KEH-165, PRI-17).
- **Tidak ada lembur:** Hari tutup; hari **Diminta Masuk di Hari Libur** (kompensasinya libur pengganti, L3e); absen trip; jabatan yang tidak "dapat lembur" pada tanggal itu; Pemilik dan GM (tidak diabsen); hari tanpa shift.
- Fungsi yang sama dipanggil (1) saat Laporan Pulang terkirim, (2) saat koreksi disimpan atau dibalik, (3) saat penjelasan lupa absen pulang disetujui atau dicabut, (4) oleh mesin 04.30 untuk hari kemarin dan yang terlewat. Tidak ada rumus kedua.

### 3.2 Baris lembur dan batas (KEH-160, 161, 165)

- Jam terdeteksi > 0 → satu baris `overtime_days` `OPEN`. Dihitung ulang: baris `OPEN` mengikuti angka baru; turun ke 0 → `VOID` ("tidak ada lembur lagi sesudah koreksi").
- **Batas klaim:** tanggal kerja + 3 hari pukul 23.59 WIB. **Hari lupa absen pulang yang dijelaskan:** 3 hari sejak penjelasan disahkan (baris bertanda, KEH-165).
- Lewat batas tanpa klaim berlaku → `EXPIRED` (hangus). Klaim yang ditolak dan lewat batas juga hangus. Tidak ada pengajuan terlambat (PRI-09).
- Jawaban "Bukan lembur" dan "Nanti" bisa diubah sampai batas; "Bukan lembur" tetap hangus di batas (tercatat sebagai tidak diklaim, tanpa pesan "bicarakan dengan pemilik").

### 3.3 Klaim (KEH-73, 163)

- Hanya orangnya sendiri, hanya untuk baris `OPEN` dalam batas, jabatan "dapat lembur" pada tanggal itu.
- **Foto kertas lembur** wajib (kamera atau galeri). **Yang menyuruh** wajib: karyawan aktif berjabatan "boleh menyuruh lembur" pada tanggal itu, **bukan diri sendiri**; hanya dicatat, tanpa persetujuan dan tanpa pemberitahuan ke penyuruh.
- Jam diklaim = jam terdeteksi saat dikirim. Bila sesudahnya koreksi menaikkan jam terdeteksi, klaim yang menunggu **tidak ikut naik** dan tidak membuka klaim kedua (KEH-166); pengesah melihat angka baru di keterangan pembantu.

### 3.4 Pengesahan (KEH-75, 162, 164)

- HR, Pemilik, GM; satu cukup, tanpa "Setujui semua" (PRI-40). Klaim milik HR diputuskan Pemilik atau GM; server menolak bila yang memutuskan = pengaju (`isOwnRequest`).
- **Setujui** boleh **menurunkan** jam: jam penuh, paling kecil 1, alasan wajib, tombol ditahan 3 detik dan menyebut jumlah jam. Tidak bisa menaikkan, tidak melebihi jam diklaim dan 3. Menaikkan hanya lewat koreksi absen.
- **Tolak:** alasan wajib; baris kembali `OPEN`; **Ajukan ulang** dalam batas dengan isian lama terisi, batas tidak mulai dari awal.
- **Batalkan** oleh pengaju selama Menunggu (L2f-1): baris kembali `OPEN`.
- **Cabut persetujuan** (alasan wajib, `revokeRequest`): jam kembali tidak dibayar; baris `OPEN` bila masih dalam batas, `EXPIRED` bila tidak (KEH-166).

### 3.5 Koreksi sesudah disahkan (KEH-166, E7)

Koreksi absen (L3c) atau Cabut penjelasan (L3g) yang membuat jam terdeteksi **lebih kecil dari jam disahkan** ditolak server dengan pesan "Cabut dulu pengesahan lembur tanggal …". Koreksi yang menaikkan diterima, tetapi tidak membuka klaim baru.

### 3.6 Tiga angka di rekap (KEH-77)

Per hari dan per periode: **terdeteksi** (jam terdeteksi baris yang tidak `VOID`), **diklaim** (jam diklaim klaim Menunggu/Disetujui), **disahkan** (jam disahkan klaim Disetujui). Menggantikan tanda "-" di Rekap, Catatan Hari Kerja, dan Kehadiran Saya. Angka yang sama untuk karyawan dan kantor (KEH-76).

## 4. Layar

Error di jendela "OK, paham"; Kirim/Simpan terkunci selama proses dan tidak bisa ditekan dua kali; isian tidak hilang saat sinyal putus (TAM-16). Pengajuan Saya, kartu status, Batalkan, Ajukan ulang, dan kotak Persetujuan memakai layar L2f-1 dan **tidak digambar ulang**. Tanpa nominal di semua layar.

| Layar | Alamat | Menu | Isi |
|---|---|---|---|
| Ini Lembur? (KEH-L40) | jendela di `/absen` | — | HP. Muncul sesudah Laporan Pulang terkirim, **sebelum** pertanyaan "Sudah pindah cabang?" (L3d). "Kamu pulang 18.10, jadwal pulang 17.00. Terdeteksi lembur 1 jam. Ini lembur?" Tombol **Ya, klaim sekarang** (ke langkah klaim), **Nanti**, **Bukan lembur**. Menutup jendela = Nanti |
| Lembur Saya (KEH-L41) | `/lembur` | Saya (angka di menu) | HP. Tab **Belum diklaim** (bawaan), **Menunggu keputusan**, **Selesai** (Disahkan, Ditolak, Hangus; periode lama dimuat saat diminta). Kartu: tanggal, jadwal pulang + jam pulang, jam terdeteksi, sisa waktu ("Tinggal 2 hari"; kuning sisa 1 hari, merah hari terakhir). Disahkan lebih kecil: alasan penurunan. Hangus: "Lembur 2 jam tanggal 3 Nov hangus. Bicarakan langsung dengan pemilik". Tombol **Klaim**, **Bukan lembur** / **Klaim** (ubah jawaban), **Ajukan ulang** |
| Langkah klaim | `/lembur/[id]` | — | HP, 3 langkah: (1) Foto kertas lembur (kamera atau galeri); (2) Yang menyuruh (daftar nama, tanpa diri sendiri); (3) Periksa dan Kirim, `HoldButton` 3 detik, tanpa nominal. Kembali di tiap langkah tanpa kehilangan isian; Ulangi dari awal |
| Lembur Tim (KEH-L42) | `/kehadiran/lembur` | Kehadiran | PC, empat tab: **Terdeteksi, belum diklaim** (saring cabang, orang; urut terdekat batas), **Hampir hangus** (≤ 1 hari), **Menunggu keputusan** (lama menunggu; menekan membuka `/persetujuan/[id]`), **Hangus**. Hanya baca: tanpa Ingatkan, tanpa menghidupkan yang hangus |
| Keterangan Pembantu Putusan (KEH-L43) | di dalam `/persetujuan/[id]` | — | PC. **Angka server:** jadwal pulang, jam foto pulang, jam tutup cabang yang dipakai, jam terdeteksi sekarang, berdampingan dengan jam diklaim. **Foto kertas** dan **nama penyuruh** (hanya HR/Pemilik/GM, pembukaan foto dicatat). **Riwayat:** jumlah jam diklaim dan disahkan orang itu periode ini, "Ajukan ulang ke-n", label "hari lupa absen yang dijelaskan". **Bentrokan:** libur terjadwal, hari tutup, perbantuan, diminta masuk di hari libur. Setujui punya pilihan **jam disahkan** (turun saja) + alasan bila diturunkan |

**Layar lama yang ikut berubah:** Rekap Kehadiran, Catatan Hari Kerja, dan Kehadiran Saya menampilkan tiga angka lembur (§3.6); Beranda karyawan mendapat kartu "**n lembur belum diklaim**, terdekat batas …"; Beranda HR mendapat "klaim lembur menunggu"; Koreksi L3c dan Cabut penjelasan L3g menolak koreksi yang menurunkan di bawah jam disahkan (§3.5); Pengaturan Jabatan menampilkan dua pengaturan baru.

## 5. Hak

Tindakan baru + hak awal di migrasi. Pemilik dan GM memiliki semuanya (KAR-67). S = semua, C = cabang atau departemennya.

| Tindakan | HR | Admin HR | Kepala Toko | Kepala Gudang | Finance |
|---|---|---|---|---|---|
| Lembur Saya + Ini lembur? + kirim klaim (diri sendiri) | ikut `attendance.self.check`, cara absen QR, jabatan "dapat lembur" | | | | |
| `overtime.decide` (Setujui/turunkan, Tolak, Cabut) · selfForbidden | S | — | — | — | — |
| `overtime.evidence.view` (foto kertas + nama penyuruh) | S | — | — | — | — |
| `overtime.team.view` (Lembur Tim) | S | S, **tanpa foto** | C, nama/tanggal/jam saja | C, sama | — |

Penolakan server yang dites: jabatan gudang, Driver per ritase, atau GM membuka Lembur Saya / mengirim klaim (H77); klaim lembur orang lain; klaim lewat batas; klaim tanpa foto; penyuruh diri sendiri atau bukan "boleh menyuruh"; dua klaim berlaku untuk satu hari; menaikkan jam saat mengesahkan; turunkan tanpa alasan; pengaju ikut memutuskan (HR mengesahkan lemburnya sendiri); Admin HR membuka foto; Kepala Toko melihat cabang lain atau nama penyuruh; koreksi yang menurunkan di bawah jam disahkan.

## 6. Mesin terjadwal

Satu pekerjaan baru `overtime-daily`, **tiap hari 04.30 WIB** (sesudah `clarification-daily` 04.20), aman diulang:

1. **Hitung ulang** hari kemarin dan yang terlewat sejak tanggal tayang L3h (§9 butir 2), paling jauh 14 hari: lahirkan baris yang belum ada (misalnya koreksi malam hari), perbarui baris `OPEN`. Unik orang + tanggal, jadi tidak dobel.
2. **Hangus:** baris `OPEN` yang batasnya lewat → `EXPIRED`, orangnya diberi tahu jam yang hangus dan "bicarakan dengan pemilik" (kecuali yang dijawab Bukan lembur).
3. **Pemberitahuan** sekali per tanda: sisa 1 hari, hari terakhir.
4. Gagal atau tidak jalan di jadwalnya → Pemilik dan GM diberi tahu (catatan `job_runs` + pemberitahuan, seperti L3e/L3g).

Baris baru di `infra/apps/cron/crontab` (UTC: `30 21 * * *`).

## 7. Pemberitahuan

| Kejadian | Kepada |
|---|---|
| Lembur terdeteksi | Orangnya (jendela Ini lembur?; bila lahir lewat koreksi/penjelasan/mesin: pemberitahuan) |
| Sisa 1 hari; hari terakhir | Orangnya (bila belum diklaim dan bukan "Bukan lembur") |
| Klaim masuk (sudah ada, Mesin Pengajuan) | Penyetuju (`overtime.decide`; klaim HR → Pemilik/GM) |
| Disahkan (dengan jam dan alasan bila diturunkan) / ditolak / dicabut | Orangnya |
| Hangus | Orangnya |
| Klaim menunggu lebih dari 2 hari | Pemilik, GM (perlu perhatian, sudah ada `requests.overdue_days`) |
| Mesin gagal | Pemilik, GM |

Penyuruh, Kepala Toko, dan Kepala Gudang tidak diberi tahu.

## 8. Tes

**Unit (`rules/overtime.test.ts`, menyebut nomor KEH):** jam penuh dibulatkan ke bawah, 59 menit = 0, paling banyak 3 (KEH-70, 159); berhenti di jam tutup toko dan jam tutup kantor, shift terakhir tidak lembur (KEH-71); perbantuan memakai cabang tujuan, hari tutup dan diminta masuk di hari libur tanpa lembur, jabatan tidak dapat lembur (KEH-165, 25); batas klaim 3 hari 23.59 dan batas dari pengesahan penjelasan (KEH-161, 165); turunkan saja, jam penuh, alasan wajib (KEH-162); penyuruh bukan diri sendiri (KEH-163); koreksi di bawah jam disahkan ditolak (KEH-166); tiga angka rekap (KEH-77).

**Integrasi DB:** Laporan Pulang 18.10 jadwal 17.00 → baris 1 jam + jendela; jawaban Bukan lembur lalu Klaim (contoh 144); tidak dijawab → hangus di batas + pemberitahuan (145, 146); klaim → setujui 2 dari 3 jam dengan alasan (148); HR memilih diri sendiri sebagai penyuruh ditolak (150); klaim HR hanya Pemilik/GM (151); lupa pulang dijelaskan Kamis → batas Minggu 23.59 (152); diminta masuk di hari libur tanpa lembur (153); perbantuan cabang tutup lebih awal (154); koreksi pulang lebih awal sesudah disahkan ditolak (155); ditolak → Ajukan ulang dengan batas lama; cabut → `OPEN`/`EXPIRED`; dua kirim bersamaan → satu lolos; mesin diulang tidak dobel; pagar hak §5. Tes memakai tanggal lampau (pola L3c), supaya tidak rapuh jam.

**Uji owner di staging** dengan karyawan uji di HP: daftar langkah dikirim saat tayang. Supaya tidak menunggu sampai malam, karyawan uji bisa diberi shift yang berakhir lebih awal hari itu.

**Syarat HRIS:** fragment `apps/hris/changelog.d` + tanda Baru untuk `/lembur`, `/kehadiran/lembur`, dan fitur "Ini lembur?".

## 9. Keputusan owner (menunggu jawaban)

Aturan pokok lembur sudah disetujui pemilik 13 Oktober 2026 (E1 s.d. E8). Yang ditanyakan di sini hanya cara menerapkannya di sistem yang sekarang.

1. **Satu paket atau dipecah?** Empat layar ini memakai satu fungsi hitung dan dua tabel yang sama. **Saran: satu paket** (satu kali uji), lebih kecil dari L3g.
2. **Mulai menghitung lembur sejak kapan.** Kalau dihitung mundur, karyawan uji di staging langsung punya lembur dari hari-hari lalu yang langsung hangus. **Saran: hanya hari sejak L3h tayang**, tanpa menghitung mundur.
3. **Siapa yang "dapat lembur" dan "boleh menyuruh".** **Saran (isi awal, bisa diubah lewat Pengaturan Jabatan):** dapat lembur = Kepala Toko, Kasir, Pramuniaga, Groomer, HR, Admin HR, Finance, Marketing; tidak = Kepala Gudang, Driver, Kenek, Belum ditentukan (Pemilik/GM tidak diabsen). Boleh menyuruh = HR, Pemilik, GM.
4. **Jam tutup kantor.** Layar Pengaturan saat ini baru mendukung angka. **Saran: jam penuh per cabang, isi awal 20 (20.00)**, paling lambat 20. Hanya untuk karyawan departemen Office; toko tetap memakai jam pulang shift terakhir.
5. **Batas yang bergantung pada slip.** Sama seperti L3f dan L3g. **Saran: Cabut pengesahan sementara tanpa batas slip; foto kertas lembur disimpan tertutup dan belum dihapus**; "slip tak bisa ditutup selama ada klaim menunggu" dan penghapus foto 60 hari dibuat bersama penutupan slip di L4.
6. **Pilih penyuruh.** v3: daftar nama berjabatan "boleh menyuruh". **Saran: semua orang berjabatan itu di semua cabang** (HR dan pemilik memang tidak terikat cabang), tanpa diri sendiri.
7. **Pengingat.** **Saran: pemberitahuan sekali per tanda**: sisa 1 hari, hari terakhir, hangus; klaim menunggu lebih dari 2 hari ke Pemilik/GM. Pengingat berantai menyusul bersama Pemberitahuan lengkap.
8. **Koreksi sesudah klaim dikirim.** Bila HR mengoreksi jam pulang sehingga jam terdeteksi naik saat klaim masih menunggu. **Saran: klaim tidak ikut naik**; pengesah melihat angka baru di keterangan pembantu. Bila lemburnya memang lebih, orangnya membatalkan klaim lalu mengklaim ulang dengan angka baru (selama dalam batas).
