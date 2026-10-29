# Pola Bersama 1: Waktu dan Uang (Tahap 3D)

Tanggal: 13 Oktober 2026
Status: **ditetapkan 13 Oktober 2026.** D1–D6, D1a, D3a, D5a, dan E1–E4 dijawab pemilik di
percakapan 13 Oktober 2026 (bagian 5). Hasilnya: PRI-34, 35, 36; TAM-22; KEH-81; GAJ-59; DRV-84.

Bahan: PRI-17, 19, 22, 29; GAJ-01, 04, 41, 43, 47 s.d. 51; DRV-01 s.d. 07,
16, 19 s.d. 27, 80; KEH-05, 10, 25, 31, 32, 68, 79; KEU-109, 112; KIN-07, 28;
SIS-05, 06; WAJ-07, 12; `2026-10-13-peta-data-desain.md` (P4).

Gunanya: empat perlengkapan yang dipakai banyak modul ditulis sekali, supaya
tiap modul tidak membuat versinya sendiri (WAJ-04). Aturan bisnisnya sebagian
besar sudah ditetapkan di Tahap 2; bab ini menyusun cara kerjanya dan menutup
celah yang belum dijawab.

## 1. Periode (PRI-22)

### Rancangan (tanpa keputusan baru)

1. **Satu daftar periode** milik Gaji (P4), dibuat **server sendiri** jauh
   sebelum waktunya: periode bulanan 26–25 (GAJ-01) dan minggu upah
   Jumat–Kamis (DRV-19). Tidak ada orang yang mengetik tanggal periode.
2. Tiap periode menyimpan: jenis (bulanan atau mingguan), tanggal mulai dan
   akhir, dan **jadwalnya** (akhir masa keberatan, batas tutup, tanggal
   bayar) yang **disalin dari pengaturan saat periode dibuat**. Mengubah
   pengaturan jadwal hanya mengenai periode yang belum mulai (WAJ-07).
3. **Status periode dibaca dari slipnya**, tidak diubah tangan:
   Berjalan → Menunggu ditutup (sudah berakhir, masih ada slip Perkiraan) →
   Ditutup (semua slip ditutup) → Lunas (semua slip dibayar). Slip yang
   tertahan (GAJ-43) membuat periode tetap "Menunggu ditutup" dan
   ditampilkan siapa penyebabnya.
4. **Semua modul bertanya ke satu tempat:** "tanggal ini masuk periode
   mana?" Dipakai oleh slip, jatah libur (KEH-31), rapor (KIN-07), laporan
   26–25 (LOG-81, DRV-53, DRV-80), selisih kasir (KEU-54).
5. **Baris upah masuk periode menurut tanggal kejadiannya.** Minggu upah
   yang melewati tanggal 26 tidak dipotong: slip mingguannya utuh, tetapi
   di "Pendapatan Saya" (DRV-80) tiap baris ikut periode tanggal
   kejadiannya. Beban di laporan keuangan tetap mengikuti KEU-109.
6. **Tiga nama minggu, tidak boleh tertukar** (dicatat di kamus):
   *minggu upah* Jumat–Kamis (DRV-19); *minggu jadwal* Senin–Minggu untuk
   giliran shift (KEH-05) dan tugas mingguan (KIN-28). Mesinnya satu,
   jenis minggunya disebut jelas.
7. Bulan laporan keuangan (bulan kalender, KEU-109) **bukan** periode; ia
   punya tutup bulannya sendiri (KEU-112).

### Pertanyaan

- **D1.** Tanggal bayar jatuh di hari Minggu, tanggal merah, atau hari tutup.

## 2. Hari kerja (PRI-17)

### Rancangan (tanpa keputusan baru)

1. Satu catatan per orang per tanggal, milik Kehadiran. Dibuat server
   setiap hari untuk semua orang yang punya absen; gaji, slip mingguan
   (DRV-16), dan rapor hanya membaca dari sini.
2. Isinya: cabang (dari QR absen masuk), jam kerja yang berlaku, jam masuk
   dan pulang, telat, pulang cepat, lembur, **status hari itu**, dan asal
   statusnya (absen, pengajuan yang disetujui, hari tutup, mesin).
3. Catatan hari kerja **terkunci saat slip periodenya ditutup**; koreksi
   sesudahnya masuk periode berikutnya (KEH-68, PRI-04).

### Pertanyaan

- **D2.** Daftar status hari kerja, termasuk hari tanpa absen bagi orang
  yang dibayar per ritase.

## 3. Buku Upah (PRI-19)

### Rancangan (tanpa keputusan baru)

1. Aturannya sudah lengkap di DRV-01 s.d. 07. Bab ini hanya menetapkan
   **kapan baris lahir**:
   - Upah dari kejadian lahir saat kejadiannya sah: ritase saat trip
     ditutup, bongkaran saat Laporan Bongkaran disahkan, lembur saat klaim
     disahkan, bonus saat baris Buku Bonus disahkan.
   - Gaji tetap lahir **saat slip ditutup**, sebagai baris per komponen
     (sebelum itu hanya tampil di Perkiraan).
2. Buku Upah hanya berisi **upah**. Potongan tetap di menunya masing-masing
   (GAJ-38) dan bertemu dengan upah di slip.
3. Baris yang sudah masuk slip tertutup tidak diubah; koreksi baris baru
   (GAJ-50, DRV-15).

## 4. Papan Perubahan Aturan (PRI-29)

### Rancangan (tanpa keputusan baru)

Milik Perlengkapan Bersama; tampil di menu Panduan (SIS-06). Isi, sasaran,
riwayat, dan tanda "sudah saya baca" sudah ditetapkan PRI-29.

### Pertanyaan

- **D3.** Siapa yang menulis dan menerbitkan pengumuman.
- **D4.** Apakah mengubah pengaturan yang menyangkut karyawan wajib
  disertai pengumuman.
- **D5.** Paling lambat berapa hari sebelum berlaku.
- **D6.** Akibat kalau karyawan belum menandai "sudah saya baca".

## 5. Jawaban pemilik

Jawaban pertama pemilik (13 Oktober 2026), sebagian menunggu penegasan:

- D1: tanggal bayar **tidak digeser** untuk Minggu atau tanggal merah;
  "selama orang finance tidak libur, bisa diproses". Ditanyakan balik:
  GAJ-45 dan DRV-25 menetapkan yang menekan "Bayar" hanya pemilik (GM
  setara pemilik).
- D2: setuju.
- D3: setuju, ditambah permintaan baru **pengumuman darurat** yang tampil
  otomatis 5 detik saat login atau di layar mana pun. Cara kerjanya
  ditanyakan balik.
- D4: setuju; pengumuman hanya dilihat orang terkait (sama dengan PRI-29).
- D5: setuju, ditambah "waktu penentu kapan ini terjadi". Ditanyakan balik
  apakah maksudnya jadwal terbit.
- D6: setuju.

Jawaban kedua (13 Oktober 2026):

- D1: **(a)**, GAJ-45 tetap. Di lapangan gaji dibayar setelah ACC lisan;
  sistem hanya mencatat, dan menandai "dibayar" sering terlupa.
- D3a: setuju dengan arti **(ii)**: tombol baru aktif setelah 5 detik,
  ditutup dengan "Sudah saya baca".
- D5a: setuju (jadwal terbit dan tanggal berlaku, keduanya wajib).
- Permintaan baru: **pengingat berantai**. Pemberitahuan penting muncul
  berurutan seperti pop up di game, tiap jendela wajib ditekan OK, dengan
  jeda 1 detik supaya dibaca. Rancangannya diajukan di percakapan (E1–E4).

Jawaban ketiga (13 Oktober 2026): **E1–E4 sesuai saran** (urutan antrean,
layar absen tidak terhalang, paling banyak 5 jendela, pengingat tugas sekali
sehari sampai beres).

## 6. Dicatat ke

| Keputusan | Aturan |
|---|---|
| Mesin periode (bagian 1) | PRI-34 (pelapis PRI-22) |
| D1: tanggal bayar tidak digeser; pengingat slip belum ditandai Dibayar | GAJ-59 (pelapis GAJ-41, DRV-22, DRV-27); GAJ-45 tetap |
| D2: status hari kerja, termasuk "Tidak jalan"; kunci saat slip ditutup | KEH-81 |
| Kapan baris Buku Upah lahir (bagian 3) | DRV-84 (pelapis DRV-01) |
| D3, D4, D5, D5a, D6: cara kerja Papan | PRI-35 (pelapis PRI-29) |
| D3a: pengumuman darurat | PRI-36 (baru) |
| Pengingat berantai, E1–E4 | TAM-22 (baru) |

Juga diperbarui: `00-kamus-istilah.md` (minggu jadwal, status hari kerja,
Tidak jalan, pengumuman darurat, pengingat berantai), `00-peta-modul.md`
(baris Perlengkapan Bersama), jumlah aturan di `CLAUDE.md`,
`../../aturan/README.md`, dan brief Claude Design menu.

Titipan untuk Tahap 4: daftar pengingat yang masuk antrean berantai
ditetapkan per modul (TAM-22 butir 5); daftar pengaturan yang mewajibkan
pengumuman (PRI-35 butir 2) disusun bersama menu Pengaturan.

Penegasan pemilik (13 Oktober 2026, setelah 3D ditutup): pengingat berantai
**tidak sekaligus**. Jendela muncul satu per satu dan hanya tertutup dengan
"OK, sudah baca". Batas 5 jendela dan jendela ringkasan (E3) **dihapus**;
semua antrean muncul satu per satu sampai habis. TAM-22 diubah.
