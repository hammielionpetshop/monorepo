# Spec HRIS L7 — Gaji Driver: Tarif Ritase, Slip Mingguan, Denda

Tanggal: 2026-11-03 · Status: **disetujui owner 2026-11-03** (§9: butir 3 dan 8 menurut jawaban owner, sisanya sesuai saran; "lanjutkan") · **L7a lolos uji owner 2026-11-03** (staging 5744158e) · **L7b-1 lolos uji owner 2026-11-03** (staging f6765cbb) · **L7b-2 lolos uji owner 2026-11-04** (staging eeb1b22f; skenario tidak dirinci)
Cakupan: langkah **L7** di [PRD 09](../../hris_planning/PRD/fase_1/09-gaji-driver-dan-bongkaran.md) (4G-1 Tarif dan Ritase, 4G-2 Slip Mingguan dan Denda). Bongkaran (L8) **tidak** di sini.
Sumber: v3 `aturan/05-gaji-driver-kasbon.md` DRV-01 s.d. 30, 82 s.d. 100; spec v3 `2026-10-14-gaji-driver-spec.md` §3.1–3.2 (disetujui penuh 14 Okt 2026, U1–U5, S1–S4). PRD 09 §2: **aturan v3 yang sudah jelas dipakai tanpa diskusi ulang**; spec ini hanya menulis penyesuaiannya ke kode yang ada dan yang perlu diputuskan owner.
Dasar kode: ritase & belanja L6 (`logistics.v_ritase`, tanpa nominal), mesin slip bulanan L4 (`payslips`, `payslip_lines`, sisa potongan, Dana Disiplin `fund_entries`, langkah tutup/buka kembali/bayar, Pendapatan Saya), Potongan Lain + keberatan potongan (L4e), Bonus (L4d), kasbon + `WAITING_WEEKLY` (L5), `position.pay_basis` Bulanan/Mingguan (L2e), Mesin Pengajuan + Pemberitahuan + Beranda (L2f).

Tarif dari owner (2026-11-03). Urutan angka: **driver (ada kenek) / kenek / driver (tanpa kenek)**, dalam ribu rupiah:

| Rute | Engkel Box | L300 | Grand Max Box |
|---|---|---|---|
| Tasik Kota | 110 / 50 / 160 | 90 / 40 / 130 | 80 / 30 / 110 |
| Garut | 135 / 50 / 185 | 110 / 40 / 150 | 90 / 30 / 120 |
| Karang Nunggal | 135 / 50 / 185 | 110 / 40 / 150 | 90 / 30 / 120 |
| Ciamis - Banjar | 135 / 50 / 185 | 110 / 40 / 150 | 90 / 30 / 120 |
| Cirebon | 175 / 50 / 225 | — | — |
| Singaparna | 20 / 0 / 20 | 15 / 0 / 15 | 15 / 0 / 15 |
| Belanja Aina PS | 20 / 0 / 20 | 15 / 0 / 15 | 15 / 0 / 15 |
| Belanja H. Agus | 20 / 0 / 20 | 15 / 0 / 15 | 15 / 0 / 15 |
| Belanja Rajawali / Wiji Dadi | 10 / 0 / 10 | 10 / 0 / 10 | 10 / 0 / 10 |

Tabel owner menulis Aina dan H. Agus dalam satu baris karena upahnya sama; **rute tetap terpisah** seperti L6, masing-masing memakai angka yang sama persis (§9 butir 3). Jumlah: **25 pasangan bertarif** (16 kirim + 9 belanja); L300 dan Grand Max ke Cirebon tanpa tarif (§9 butir 2). Di semua baris, driver tanpa kenek = driver ada kenek + kenek. Ketiga angka tetap disimpan terpisah (DRV-08), supaya kelak bisa berbeda.

---

## 1. Batas

| Dikerjakan | Bagian |
|---|---|
| Daftar Jenis Upah (baca saja, U1) | L7a |
| Tarif ritase & upah belanja per pasangan mobil + rute, bertanggal; tarif baru, batalkan tarif terjadwal, betulkan salah ketik | L7a |
| Menilai tiap ritase/belanja menjadi rupiah (Buku Upah ritase), Rp0 orang bergaji bulanan di hari kerja, Rp0 rute tanpa upah kenek, Belum bertarif | L7a |
| Penilai ulang (status hari berubah, salah ketik tarif, batal ritase, tarif baru untuk baris Belum bertarif) | L7a |
| Syarat "pasangan sudah bertarif" saat **Berangkat**, tambah supplier, dan ritase tangan (LOG-21, 36) | L7a |
| Layar Upah Ritase (Semua, Perlu dilihat, Dinilai ulang, Belum bertarif) | L7a |
| Slip mingguan: minggu upah Jumat–Kamis, kerangka, isi, penahan, tutup Jumat 10.00, bayar Sabtu, buka kembali, keberatan slip, Pendapatan Saya | L7b |
| Kasbon untuk driver & kenek dibuka; cicilan "Menunggu slip mingguan" dipasang ke slip mingguan; Dana Kasbon mingguan terpakai (janji L5 §10) | L7b |
| Potongan Lain, sisa potongan, koreksi upah ritase di slip mingguan | L7b |
| Kartu "Upah Minggu Ini" di Beranda | L7b |
| Denda driver & kenek: jenis denda, ajukan (Kepala Gudang usulan; Pemilik/GM langsung), sahkan/tolak, keberatan, batalkan, tiadakan, Dana Disiplin | L7c |

| Tidak dikerjakan | Di mana |
|---|---|
| Bongkaran | L8 |
| Papan Perubahan Aturan (pengumuman resmi) | belum ada di HRIS; L7 memakai Pemberitahuan biasa (§9 butir 5) |
| Bonus ongkir driver (B3) | tetap lewat Bonus L4d; slip mingguan hanya membacanya bila slip tujuannya minggu upah |
| Bensin, Pemeriksaan Uang trip, kurang serah | Logistik penuh (PRD 08 §4); bila ditagih tetap lewat Potongan Lain |
| Baris "Lewat trip" di Rekap Kehadiran (sisa L6 §11) | backlog, bukan uang |

---

## 2. Data

Uang tetap di schema **`hris`** (modul `payroll`). Modul `payroll` hanya membaca Logistik lewat view (batas modul L6 §11).

| Tabel / view | Isi | Bagian, migrasi |
|---|---|---|
| `logistics.v_vehicles`, `logistics.v_routes` (view baru) | id, nama, plat/jenis rute, aktif | L7a, logistics 0002 |
| `wage_kinds` | 6 jenis isi awal DRV-02 (Gaji tetap, Lembur & kompensasi libur, Bonus, Ritase driver & kenek, Upah belanja, Bongkaran): kode, nama, dihitung per, jalur bayar, modul pencatat | L7a, hris 0032 |
| `trip_rates` | mobil, rute, **berlaku dari**, driver ada kenek, driver tanpa kenek, kenek (bulat, ≥ 0), status `ACTIVE` / `CANCELLED` / `FIXED` (dibetulkan), baris pengganti, alasan, oleh, kapan. Tidak dihapus (DRV-12). Unik: (mobil, rute, berlaku dari) di antara yang `ACTIVE` | L7a, 0032 |
| `trip_wage_values` (Buku Upah ritase) | baris `v_ritase` (asal), orang, jenis `RITASE` / `SHOPPING`, tanggal ritase, **minggu upah** (Jumat), peran, berkenek, tarif dipakai, nominal, sebab Rp0 (`WORKDAY`, `NOT_DAY_OFF`, `NO_ASSISTANT_PAY`), status hari yang dibaca, status `ACTIVE` / `CANCELLED` / `UNRATED`, tanda Perlu dilihat + Sudah dilihat (oleh, catatan), slip yang memuat. **Kunci: asal + `ACTIVE`/`UNRATED`** (satu ritase tak pernah punya dua upah berlaku) | L7a, 0032 |
| `trip_wage_corrections` | baris lama, selisih (+/−), sebab penilaian ulang, slip tujuan (koreksi plus) atau potongan kelompok (a) di slip utama berikutnya (koreksi minus) | L7a, 0032 |
| `payslips` (diperluas) | `kind` + `WEEKLY`; awal periode = **Jumat** untuk WEEKLY (tanggal 26 tetap untuk MONTHLY); `main_slip` (slip utama / di luar slip utama, DRV-05). Nomor `SM-[tanggal Kamis]-[urut]` | L7b, 0033 |
| Potongan Lain, sisa potongan, cicilan kasbon | kolom periode boleh Jumat untuk orang berslip utama mingguan (pemeriksa tanggal 26 dilonggarkan menurut jenis slip) | L7b, 0033 |
| `driver_fine_kinds` | nama, contoh perbuatan, nominal bertanggal, aktif | L7c, 0034 |
| `driver_fines` | orang, jenis, tanggal kejadian, trip, uraian, foto (`files`), nominal (disalin server), pengajuan (Kepala Gudang), status `PENDING` / `ACTIVE` / `REJECTED` / `CANCELLED` / `WAIVED` / `UNCOLLECTIBLE`, slip yang memotong | L7c, 0034 |

---

## 3. Aturan

### 3.1 Tarif (DRV-08, 10 s.d. 13; U3, U4)

- Satu baris tarif = pasangan mobil + rute + **berlaku dari** + tiga angka. Rute belanja memakai bentuk yang sama; angkanya = upah belanja (DRV-11).
- **Tarif pada tanggal T** = baris `ACTIVE` pasangan itu dengan berlaku dari ≤ T yang paling akhir. **Satu fungsi** `rateOn(mobil, rute, tanggal)` dipakai penilai, syarat Berangkat, ritase tangan, dan layar tarif (WAJ-04).
- **Tarif baru:** paling cepat **besok** bila ketiga angka sama atau naik, **7 hari** lagi bila ada yang turun; dihitung server (PRI-35). Pasangan yang **belum pernah** bertarif boleh berlaku **hari ini** (U3). Tidak berlaku mundur.
- **Batalkan** hanya baris yang belum berlaku. **Betulkan salah ketik** (U4): angka baris yang sudah berlaku, alasan wajib, layar menampilkan akibatnya per orang lebih dulu; ditolak bila sudah ada slip mingguan **Dibayar** yang memuat ritase dengan baris itu (jalan keluar: tarif baru + Bonus Bebas / Potongan Lain).
- Hanya **Pemilik dan GM** mengubah tarif (DRV-13). HR dan Kepala Gudang melihat. Finance tidak membuka (DRV-82).

### 3.2 Menilai ritase (DRV-09, 10, 11, 14, 16, 17, 84)

Satu fungsi server `valueRitase(baris v_ritase)`, dijalankan saat ritase/belanja lahir (trip Selesai, ritase tangan) dan oleh pemeriksa harian:

1. Tanggal = **tanggal trip**. Pasangan: mobil trip + rute kirim (ritase) atau mobil trip + rute belanja (belanja).
2. Tarif tidak ada → baris **Belum bertarif** (Rp0, `UNRATED`), masuk "perlu perhatian" Pemilik/GM, **menahan slip** (penahan 7). Diisi tarif → dinilai ulang. Tidak ada angka cadangan di kode.
3. Angka per peran: driver di trip berkenek → *driver ada kenek*; driver tanpa kenek → *driver tanpa kenek*; kenek → *kenek*. Berkenek dibaca dari `v_ritase` (ditentukan saat Selesai, L6).
4. **Orang berdasar gaji Bulanan** (`position.pay_basis` pada tanggal itu): status hari dari Kehadiran. Libur terjadwal / libur pengganti / hari tutup cabang → **tarif penuh**. Hari kerja → **Rp0** "hari kerja, sudah dibayar gaji". Izin / sakit / cuti / alpha → **Rp0** "bukan hari libur" + tanda **Perlu dilihat** (tidak menahan slip, U5). Orang **Mingguan** tidak diperiksa status harinya (DRV-18).
5. Angka kenek Rp0 → Rp0 "rute tanpa upah kenek" (DRV-10, 17). Dua sebab Rp0 → sebab hari yang ditulis.
6. Baris Buku Upah masuk slip mingguan orang itu untuk minggu upah tanggalnya; bila slip itu sudah Ditutup → minggu berikutnya dengan keterangan "tanggal asal …" (DRV-22). Ritase **tidak pernah** masuk slip bulanan (DRV-16); bagi orang Bulanan, slip mingguannya slip **di luar slip utama** yang dibayar utuh tanpa potongan (DRV-05).

### 3.3 Penilai ulang (DRV-15, 16; U2, U4)

Pemicu: status hari orang Bulanan berubah, tarif dibetulkan, ritase dibatalkan (tombol L6), tarif diisi untuk baris Belum bertarif. Hasil sama → tidak menulis apa pun. Hasil beda:

- Slip tujuannya **belum Ditutup** → baris lama `CANCELLED` ("dinilai ulang: …"), baris baru ditulis.
- **Sudah Ditutup** → baris lama tetap; **koreksi plus** masuk slip mingguan berikutnya (dibuatkan bila belum ada), **koreksi minus** jadi potongan "koreksi upah ritase" kelompok (a) di **slip utama** berikutnya orang itu (mingguan untuk driver/kenek, bulanan untuk staf bulanan).
- Orangnya diberi tahu dengan kalimat sebabnya. Dipanggil juga **sebelum langkah tutup** slip mingguan (DRV-88). Pemicu status hari ditangkap oleh pemeriksa harian (bukan kait di tiap layar Kehadiran) + saat tutup slip.

### 3.4 Syarat bertarif di Logistik (LOG-21, 36)

- **Berangkat** ditolak bila pasangan trip atau pasangan salah satu supplier belum bertarif hari itu: "L300 ke Cirebon belum punya tarif. Minta Pemilik atau GM mengisinya di Pengaturan › Tarif Ritase." (Di L6 trip boleh dibuat sebagai Draft; pemeriksaan di Berangkat karena di situ tanggal trip lahir.)
- Menambah supplier ke trip Berjalan dan **ritase tangan** ditolak bila pasangannya belum bertarif pada tanggal itu.

### 3.5 Slip mingguan (DRV-19 s.d. 28; S4) — L7b

| Kapan (WIB) | Yang terjadi |
|---|---|
| Jumat 00.15 | Kerangka slip minggu baru: slip **utama** untuk tiap orang **Mingguan** yang aktif ≥ 1 hari di minggu itu, **walau belum punya ritase** (supaya cicilan dan potongan tetap terlihat). Slip **di luar slip utama** lahir saat baris upah pertama orang Bulanan masuk |
| **Jumat 10.00** | Tombol **Tutup** aktif untuk minggu yang berakhir Kamis kemarin (pengaturan) |
| Jumat 15.00 | Bila masih ada slip Perkiraan: pengingat ke HR, Pemilik, GM, diulang tiap hari 07.00 |
| **Sabtu** | Jatuh bayar; tampil "Hari ini" di Jadwal Bayar |
| Senin 23.59 | Akhir masa keberatan slip |

- **Isi** (fungsi `computeSlip` yang sama, tanpa cabang "kalau driver"): pendapatan = ritase + upah belanja + koreksi plus + bonus bertujuan minggu itu. Potongan (hanya slip utama, urutan GAJ-75, sisa potongan lebih dulu): (a) denda driver & kenek, koreksi upah ritase; (b) kehilangan barang & minus kas hanya bila jabatannya ikut menanggung (driver/kenek tidak); (c) Potongan Lain; (d) cicilan kasbon. Satu kali potong = satu slip mingguan. Bersih tidak pernah minus; sisanya dibawa ke minggu berikutnya. Bersih Rp0 → Dibayar "tanpa uang".
- **Penahan** hanya: (7) ada baris Belum bertarif; (5) slip terakhir dengan bonus menunggu; (6) slip terakhir dengan usulan berhenti belum diputuskan. **Bukan penahan:** usulan denda belum disahkan, keberatan menunggu, trip masih Berjalan, tanda Perlu dilihat.
- **Tutup, buka kembali, bayar, batal bayar, keberatan slip, Pendapatan Saya, Slip Saya**: langkah L4 dipakai apa adanya; perinciannya: Penilai ulang dijalankan dulu; baris Buku Upah dan denda diberi nomor slip; denda + koreksi minus yang benar-benar terpotong masuk **Dana Disiplin**. Cabang dibebani = **Gudang** (cabang orangnya). Tampilan pendapatan dikelompokkan **per hari** (tanggal, peran, mobil, rute, nominal, keterangan).
- **Pindah dasar gaji** (DRV-06, tanggal 26): orang yang berganti Bulanan ↔ Mingguan punya slip utama mingguan sampai minggu yang memuat tanggal 25, sesudahnya slip di luar slip utama (atau sebaliknya). Minggu yang memotong tanggal 26: slip utama mingguan hanya memuat hari-hari sebelum/sesudah pindah sesuai arah.
- **Kasbon** (L5 §10): pengajuan kasbon orang Mingguan dibuka; cicilannya dijadwalkan per minggu upah; `WAITING_WEEKLY` dipasang ke slip mingguan pertama yang belum ditutup; Dana Kasbon mingguan mulai dihitung.

### 3.6 Denda driver & kenek (DRV-29, 30; S1 s.d. S3) — L7c

- **Jenis denda** bertanggal; isi awal **Tidak taat administrasi Rp10.000** per kejadian (S1; §9 butir 7). Jenis baru/naik berlaku paling cepat 7 hari, turun 1 hari. Tidak dihapus, hanya dinonaktifkan mulai tanggal.
- **Ajukan:** Kepala Gudang (jadi **usulan** lewat Mesin Pengajuan, menunggu Pemilik/GM) atau Pemilik/GM (langsung Berlaku). Untuk orang Mingguan atau awak trip pada tanggal itu; tidak untuk diri sendiri, Pemilik, GM. Tanggal kejadian **≤ 7 hari ke belakang** (S3). **Tanpa isian nominal** (disalin dari jenis). Uraian ≥ 15 huruf, foto pilihan.
- **Sahkan / Tolak** (Pemilik/GM, bukan untuk dirinya; tolak beralasan). Orangnya diberi tahu + tombol **Ajukan keberatan** 3 hari (jenis pengajuan "Keberatan potongan" L4e diperluas). Denda masuk **slip utama** periode tanggal kejadian; sudah ditutup → slip utama berikutnya.
- **Tarik** (pengaju, selagi menunggu), **Batalkan** (sebelum terpotong), **Tiadakan** (sesudah terpotong → koreksi plus di slip utama berikutnya + mutasi keluar Dana Disiplin). Orang berhenti → yang tak tertampung **Tidak tertagih**.
- **Bukan denda** (ditulis di layar Ajukan Denda): uang setoran/kembalian kurang dan barang rusak/hilang → **Potongan Lain** sebesar kerugiannya.

### 3.7 Pengaturan (bertanggal, Pemilik/GM)

| Kunci | Bawaan | Bagian |
|---|---|---|
| `payroll.weekly_start` | Jumat minggu tayang L7b (§9 butir 4) | L7b |
| `payroll.weekly_close_open_time` | Jumat 10.00 | L7b |
| `payroll.weekly_close_remind_time` | Jumat 15.00 | L7b |
| `payroll.fine_backdate_days` | 7 | L7c |

---

## 4. Layar

| Layar | Alamat | Dipakai | Bagian |
|---|---|---|---|
| **Jenis Upah** (baca saja) | `/pengaturan/jenis-upah` | Pemilik, GM, HR | L7a |
| **Tarif Ritase** | `/pengaturan/tarif-ritase` | Pemilik, GM mengubah; HR, Kepala Gudang melihat | L7a |
| Tarif Baru (4 langkah) / Betulkan Salah Ketik (3 langkah) | dari Tarif Ritase | Pemilik, GM | L7a |
| **Upah Ritase** (tab Semua, Perlu dilihat, Dinilai ulang, Belum bertarif) | `/gaji/upah-ritase?minggu=…` | HR, Pemilik, GM | L7a |
| Ritase (L6) | `/logistik/ritase` | + tautan "Isi tarif" pada pasangan belum bertarif; tetap **tanpa rupiah** untuk Kepala Gudang | L7a |
| **Periode Slip** (L4) | `/gaji/periode` | + periode **minggu upah**; halaman satu minggu dengan tab Slip dan Upah Ritase | L7b |
| Slip, tutup, bayar, Jadwal Bayar, Daftar Transfer, Slip Saya, Pendapatan Saya (L4) | sama | slip mingguan ikut tampil | L7b |
| Kartu **Upah Minggu Ini** | Beranda | orang yang punya slip mingguan | L7b |
| **Denda Driver & Kenek** (Menunggu, Berlaku, Selesai) + Ajukan Denda (4 langkah, HP & PC) | `/gaji/denda-driver` | Kepala Gudang (usulannya), Pemilik, GM; HR lihat | L7c |
| Putuskan Usulan Denda | isi khas di `/persetujuan/[id]` | Pemilik, GM | L7c |
| **Jenis Denda** | `/pengaturan/jenis-denda` | Pemilik, GM mengubah; HR, Kepala Gudang lihat | L7c |

Tiap bagian membawa fragment `apps/hris/changelog.d` + tanda **Baru** di `lib/new-features.ts`.

## 5. Hak

| Hak | Bawaan |
|---|---|
| `wage.rate.view` | Pemilik, GM, HR, Kepala Gudang |
| `wage.rate.manage` (tarif baru, batalkan, betulkan) | Pemilik, GM (ownerOnly) |
| `wage.trip.view` (Upah Ritase) | HR, Pemilik, GM (HR tanpa orang berjabatan "Gaji hanya terlihat Pemilik dan GM") |
| `wage.trip.review` (Sudah dilihat) | HR, Pemilik, GM |
| `fine.propose` | Kepala Gudang, Pemilik, GM |
| `fine.decide`, `fine.cancel`, `fine_kind.manage` | Pemilik, GM (ownerOnly) |
| `fine.view` | + HR |
| Slip mingguan | hak slip L4 yang sudah ada (`payslip.*`) |

## 6. Mesin terjadwal

| Mesin | Jam | Isi | Bagian |
|---|---|---|---|
| `trip-wage-daily` | 04.40 | Nilai ritase yang belum bernilai (cadangan bila penilaian saat Selesai gagal); penilaian ulang orang Bulanan yang status harinya berubah (14 hari ke belakang); pemeriksa: setiap `v_ritase` tak batal punya tepat satu upah berlaku | L7a |
| `payslip-weekly-skeleton` | Jumat 00.15 | Kerangka slip minggu baru | L7b |
| `payslip-weekly-reminder` | Jumat 15.00, lalu harian 07.00 | Pengingat slip belum ditutup | L7b |
| `payslip-pay-reminder` (sudah ada) | — | ikut slip mingguan | L7b |

## 7. Pemberitahuan

| Kejadian | Ke |
|---|---|
| Tarif baru tersimpan (§9 butir 5) | Driver & kenek aktif + orang yang 3 bulan terakhir punya ritase di pasangan itu |
| Ritase dinilai ulang / Belum bertarif | Orangnya; Belum bertarif juga Pemilik, GM |
| Slip mingguan ditutup / dibayar | Orangnya (seperti slip bulanan) |
| Usulan denda masuk | Pemilik, GM |
| Denda berlaku / ditolak / dibatalkan / ditiadakan | Orangnya (+ pengaju) |

## 8. Tes

- **Unit:** `rateOn` (bertanggal, batal, betulan), jarak berlaku (naik/sama/turun/pasangan baru), angka per peran & berkenek, Rp0 (hari kerja, bukan hari libur + tanda, kenek Rp0, dua sebab), minggu upah Jumat–Kamis, tanggal asal sesudah slip ditutup, isi slip mingguan + urutan potongan, penahan, denda ≤ 7 hari & sasaran sah.
- **Integrasi (DB):** trip L6 Selesai → upah tertulis sekali per awak; Belum bertarif → menahan → diisi → dinilai ulang; betulkan salah ketik sebelum & sesudah slip ditutup (koreksi plus/minus); batal ritase sesudah ditutup → potongan koreksi; tutup → bayar slip mingguan + Dana Disiplin; kasbon mingguan terpotong; `WAITING_WEEKLY` terpasang; denda usulan → sah → terpotong → tiadakan.
- **Uji banding (kriteria PRD 09 §4):** dilakukan owner secara manual di luar layar (§9 butir 8).
- **Batas:** `payroll` tidak mengimpor tabel `logistics` (hanya view); `logistics` memanggil `rateOn` lewat index modul `payroll`. Tes integrasi memakai tanggal lampau.

---

## 9. Keputusan owner (2026-11-03: butir 3 dan 8 dijawab owner, sisanya "lanjutkan" = sesuai saran)

| # | Pertanyaan | Saran |
|---|---|---|
| 1 | L7 cukup besar (3 urusan). Dipecah jadi **L7a** Tarif & Upah Ritase → **L7b** Slip Mingguan + kasbon driver → **L7c** Denda, tiap bagian diuji owner sebelum lanjut? | **Ya, dipecah 3**, seperti L5a/L5b. L7a bisa diuji dengan trip L6 yang sudah ada di staging |
| 2 | Tarif kirim: Cirebon hanya Engkel Box (PRD menyebut 23 tarif lama). Cirebon hanya Engkel Box; L300 dan Grand Max ke Cirebon tidak punya tarif → trip itu **tidak bisa Berangkat** sampai tarifnya diisi. Benar? | **Ya**; pasangan ke-23 bisa diisi kapan saja lewat layar Tarif Baru (berlaku hari ini karena pasangan baru) |
| 3 | Tabel tarif menulis **"Belanja Aina dan H. Agus"** dalam satu baris, sedangkan L6 punya dua rute belanja terpisah (Aina PS, H. Agus). Maksudnya satu kali upah untuk dua supplier itu (seperti "Rajawali / Wiji Dadi"), atau tarif yang sama untuk masing-masing? Saran: gabung. **Owner: dipisahkan saja, upahnya sama persis.** Dua rute L6 tetap; masing-masing diberi tarif yang sama; belanja ke keduanya dalam satu trip = dua upah belanja (L6 §9 butir 1) |
| 4 | Tarif awal berlaku sejak kapan, dan slip mingguan mulai minggu apa? | Staging: tarif berlaku **30 Okt 2026** (Jumat minggu ini) supaya ritase L6 yang sudah ada langsung bernilai; slip mingguan mulai minggu tayang L7b. Produksi: ditentukan saat cutover |
| 5 | Papan Perubahan Aturan belum ada. Perubahan tarif tetap diberi jarak berlaku (besok bila naik/sama, 7 hari bila turun) dan **diberitahukan** ke driver & kenek lewat Pemberitahuan? | **Ya**; pengumuman resmi di Papan menyusul bila Papan dibangun |
| 6 | Staf bergaji bulanan yang ikut trip: diupah **hanya di hari liburnya**; di hari kerja Rp0 (DRV-16, aturan v3). Tetap? | **Tetap** (aturan v3 disetujui; dicatat supaya owner tahu) |
| 7 | **Jenis denda** yang dipakai sekarang? Bila belum ada daftar: satu jenis **"Tidak taat administrasi" Rp10.000** per kejadian (v3 S1). Uang setoran/kembalian kurang **bukan** denda, tetapi Potongan Lain | **Rp10.000, satu jenis**; jenis lain bisa ditambah Pemilik/GM (berlaku 7 hari kemudian) |
| 8 | Uji banding PRD 09 §4 ("dua minggu dibanding HRIS lama"): HRIS lama tidak dibuka. Pembandingnya hitungan upah driver yang owner/Finance pegang untuk dua minggu yang sama? | **Owner: pembandingan dilakukan manual di luar layar.** Tidak ada layar atau tes pembanding; angka per orang per minggu tersedia di Upah Ritase dan slip |

## 10. Urutan kerja sesudah "ok"

1. Tandai spec disetujui; merge `docs/hris-l6-status` + spec ke `dev_hris` lalu `staging`.
2. Klaim `docs/claim-hris-l7a`: `apps/hris/modules/payroll/**` (bagian tarif & upah ritase), `apps/hris/modules/logistics/**` (syarat bertarif), `packages/logistics/src/**` (view), `packages/hris-db/src/schema/payroll.ts`, `app/(app)/{pengaturan,gaji,logistik,beranda}/**`, nav, new-features, changelog.d, crontab/jobs; kunci **hris 0032** + **logistics 0002**. Push staging sekali.
3. `pnpm worktree:new feat/hris-l7a-trip-rates --from origin/dev_hris` (dari checkout ber-.env) → koding → tes → integrasi → lepas klaim → langkah uji owner.
4. L7b (hris 0033) dan L7c (hris 0034) mengikuti pola yang sama sesudah bagian sebelumnya lolos uji.

## 11. Catatan implementasi L7a (2026-11-03)

- **Tarif di schema `logistics`** (`logistics.trip_rates`, migrasi logistics `0002`), bukan `hris` (§2). Pasangan mobil + rute dan syarat Berangkat (LOG-21) ada di modul logistics; menaruh tarif di Gaji membuat modul logistics dan payroll saling mengimpor. Modul logistics memegang tabel, `rateOn`, layar Tarif Ritase, Tarif Baru, Batalkan, Betulkan; modul payroll membaca tarif dan ritase lewat `@/modules/logistics`. View `v_vehicles`/`v_routes` tidak dibuat (tidak dibutuhkan).
- **Buku Upah ritase** = `hris.trip_wage_values` (migrasi hris `0032`), satu baris rupiah per `logistics.trip_wages`. Angka dijaga trigger (tidak bisa diubah/dihapus); dinilai ulang = baris lama `CANCELLED` + baris baru (`replaced_by_id`). Tabel `trip_wage_corrections` belum dibuat: koreksi untuk slip yang sudah ditutup ikut L7b.
- **Jenis Upah** disimpan sebagai daftar di kode (`WAGE_KINDS`), bukan tabel `wage_kinds`: layarnya baca saja (U1) dan jenis baru memang lewat pembangunan.
- **Kapan dinilai:** route API sesudah Sampai Garasi, Tutup atas nama driver, ritase tangan, batal ritase, tarif baru (pasangan itu sejak tanggal berlakunya), dan betulkan salah ketik; gagal di sana tidak menggagalkan tindakan trip. Mesin `trip-wage-daily` 04.40 WIB: 14 hari ke belakang (status hari berubah), ritase 15–60 hari lalu yang belum bernilai, dan semua yang masih Belum bertarif.
- **Status hari** dibaca lewat `dayStatusesOf` (modul attendance, kartu hari periode 26–25). Hari "Belum ditentukan" (tanpa absen, belum ditandai alpha) diperlakukan seperti izin/alpha: Rp0 + Perlu dilihat; jabatan yang tidak diabsen QR (mis. GM) = hari kerja Rp0.
- **Betulkan salah ketik** ditolak bila ada upah dengan tarif itu yang sudah **masuk slip** (L7a: belum ada slip mingguan, jadi selalu boleh); L7b menyempitkannya ke slip **Dibayar** sesuai U4.
- **Pemberitahuan:** tarif baru → driver/kenek aktif + orang yang 3 bulan terakhir punya ritase di pasangan itu; nilai ulang yang mengubah rupiah → orangnya; upah Belum bertarif baru → pemegang `wage.rate.manage`. Kartu Beranda: Belum bertarif (Pemilik/GM) dan Perlu dilihat (HR, Pemilik, GM).
- **Tes:** unit 14 (tarif, jarak berlaku, keadaan riwayat, angka per peran, Rp0, minggu upah) + integrasi 8 (isi awal 25 tarif, Berangkat ditolak tanpa tarif, upah per awak termasuk staf bulanan, angka terkunci, Belum bertarif → tarif pasangan baru, aturan tanggal + batal terjadwal, betulkan salah ketik + pemberitahuan, batal ritase). Tes L6 tetap lulus.

## 12. Catatan implementasi L7b-1 Slip Mingguan (2026-11-03)

- **L7b dipecah dua** (keputusan pengerjaan, dilaporkan ke owner): **L7b-1** slip mingguan (bagian ini, migrasi hris `0033`) lalu **L7b-2** kasbon driver & kenek (buka pengajuan untuk berdasar gaji Mingguan, jadwal cicilan per minggu upah, `WAITING_WEEKLY` dipasang, Dana Kasbon mingguan). Modul kasbon seluruhnya berbasis periode 26–25, jadi dipisah seperti L5a/L5b. L7c (denda) bergeser ke migrasi hris `0035`.
- **Hari cut-off bisa diganti (permintaan owner 2026-11-03):** pengaturan bertanggal `payroll.weekly_start_day` (bawaan Jumat), `payroll.weekly_close_open_hour` (10), `payroll.weekly_close_remind_hour` (15). Hari baru berlaku mulai hari bersangkutan pertama pada/sesudah tanggal berlakunya; minggu berjalan dipotong sehari sebelumnya (minggu peralihan lebih pendek, tidak pernah lebih dari 7 hari). Kalender minggunya ada di modul **logistics** (`rules/week.ts`, `loadWeekRegimes`) karena dipakai Ritase dan Trip Saya; Gaji membacanya lewat `@/modules/logistics`. Pilihan hari di registry pengaturan disalin (Pengaturan tidak boleh mengimpor modul lain). Pemeriksa `trip_wage_values_week_friday` dibuang.
- **Slip mingguan = baris `payslips`** dengan `kind` `WEEKLY` (slip utama orang Mingguan) atau `WEEKLY_EXTRA` (slip di luar slip utama, upah ritase orang Bulanan), `period_start` = awal minggu, kolom baru `period_end` (disegarkan selama Perkiraan bila hari awal diganti). Semua kueri slip bulanan kini menyaring `kind = 'MONTHLY'`. Kunci periode di alamat: `W` + awal minggu (`/gaji/periode/W2026-10-30`) supaya tidak tertukar dengan tanggal 26.
- **Penghitung** `computeWeeklySlip` (server/weekly-slip.ts): pendapatan = satu baris per upah ritase/belanja (`trip:<id>`, label per hari) + bonus Disahkan s.d. akhir minggu (slip utama); potongan = koreksi upah (`tripcorr:<id>`, kelompok a, untuk upah yang sudah masuk slip tertutup lalu dibatalkan/dinilai ulang; upah penggantinya masuk sebagai baris baru) + cicilan Potongan Lain yang periodenya s.d. akhir minggu (satu cicilan per slip) + sisa potongan slip mingguan sebelumnya. Upah bertanggal sebelum minggu itu dan koreksi hanya masuk slip Perkiraan paling awal orang itu. Kehilangan barang & minus kas **tidak** dihitung di slip mingguan (driver/kenek tidak menanggung). Penahan: upah Belum bertarif; slip terakhir dengan bonus Menunggu/Ditahan.
- **Langkah slip dipakai bersama:** tutup (nomor `SM-[akhir minggu]-[urut]`, upah ritase diberi slip pemuat `trip_wage_values.payslip_id`), cetak, bayar, batal bayar, buka kembali (slip pemuat dikosongkan), keberatan, Jadwal Bayar (jatuh bayar = akhir minggu + 2 hari), Daftar Transfer (kunci `W…`), Pendapatan Saya / Slip Saya (tab Upah per hari; tanpa tab Hitungan). Koreksi minus terpotong masuk Dana Disiplin.
- **Betulkan salah ketik** (U4) kini hanya ditolak bila upahnya ada di slip yang punya pembayaran berlaku; slip yang baru ditutup menerima koreksi di slip berikutnya.
- **Mesin:** `payslip-weekly-skeleton` tiap hari 00.15 WIB (bukan hanya Jumat, karena hari awal bisa diganti), `payslip-weekly-reminder` tiap jam lewat 5 menit (hari Tutup aktif di jam pengingat, lalu 07.00). `payslip-pay-reminder` ikut slip mingguan lewat Jadwal Bayar.
- **Batasan yang dicatat:** pindah dasar gaji di tengah minggu dibaca dari jabatan pada awal minggu (seperti slip bulanan membaca awal periode); Total Diterima per Orang dan Piutang Lain masih memberi label periode bulanan untuk slip mingguan; sisa potongan mingguan dari Potongan Lain yang lalu ditiadakan belum dibatalkan otomatis (bulanan sudah). Kasbon orang Mingguan menunggu L7b-2.
- **Tes:** unit kalender minggu 4 + slip mingguan 3; integrasi 5 (kerangka, isi + penahan + tutup, koreksi + sisa + Dana Disiplin + Rp0 Dibayar tanpa uang, Periode Slip + Jadwal Bayar, ganti hari awal). Suite Gaji, Kasbon, Logistik, Pengaturan, mesin tetap lulus.

## 13. Catatan implementasi L7b-2 Kasbon driver & kenek (2026-11-03)

- **Jalur slip cicilan:** kolom baru `advance_installments.slip_kind` (`MONTHLY` / `WEEKLY`, migrasi hris `0034`); pemeriksa tanggal 26 kini hanya untuk `MONTHLY`; sebab versi baru `MAIN_SLIP`. Aturan jadwal (`placeSchedule`, `placeFrom`, `nextOpenPeriod`, `postponePeriods`, `rescheduleProblem`) menerima `SlipTrack` (bulanan 26–25 atau minggu upah dari kalender Logistik); bawaannya bulanan, jadi perilaku L5 tidak berubah. Label cicilan mingguan: "minggu 30 Oktober 2026". Cicilan mingguan tidak dipasang sebelum minggu slip mingguan pertama (30 Okt 2026).
- **Pengajuan:** dasar gaji Mingguan tidak lagi ditolak; paket gaji hanya disyaratkan untuk Bulanan (driver/kenek tidak punya paket gaji bulanan). Masa kerja, batas orang, satu-menunggu tetap; dana = Dana Kasbon mingguan (`advances.fund = 'WEEKLY'`). Kasbon Khusus juga dibuka untuk orang Mingguan.
- **Serah uang:** jalur = dasar gaji orang itu pada tanggal uang; lalu `syncMainSlip` (pindah slip utama sesudahnya).
- **Slip mingguan:** `computeWeeklySlip` memuat cicilan `WEEKLY` yang awal periodenya di rentang minggu itu (kelompok d, satu cicilan per slip); slip Perkiraan paling awal juga memuat cicilan minggu sebelumnya yang belum terpotong. Langkah tutup/buka kembali sama dengan slip bulanan (`markAdvanceLines` / `unmarkAdvanceLines`). Slip bulanan hanya memuat cicilan `MONTHLY`.
- **Ganti slip utama (DRV-140)** menggantikan status "Menunggu slip mingguan" L5b: cicilan menunggu yang dasar gaji pada **akhir** periodenya berbeda dari jalurnya dipasang ulang (versi baru), banyak dan nominal tetap, mulai periode jalur baru pertama yang dimulai pada/sesudah tanggal pindah (hari pertama di periode itu yang dasar gajinya sudah jalur baru). Bila awal periode yang memuat tanggal pindah juga sudah jalur baru (mis. perubahan jabatan dibatalkan), periode itu dipakai. Cicilan `WAITING_WEEKLY` lama dipasang ke slip mingguan oleh mesin harian `advance-daily`, atau kembali Terjadwal bila dasar gajinya Bulanan lagi. Status `WAITING_WEEKLY` tidak dibuat lagi.
- **Sisa dibawa ikut slip baru:** slip utama mingguan (Perkiraan paling awal) membaca sisa potongan dari slip bulanan sebelumnya; slip bulanan membaca sisa dari slip mingguan sebelumnya.
- **Batasan yang dicatat:** minggu upah yang berakhir tepat pada tanggal pindah ikut dipasang ulang (bunyi DRV-140 "berakhir pada atau sesudah"); kalimat "gajian" di layar kasbon tetap dipakai untuk minggu upah.
- **Tes:** unit 4 baru (jadwal mingguan, tunda/ubah jadwal, periode pertama sesudah pindah, syarat Mingguan); integrasi 4 baru (`weekly-advances`: ajukan → serah → slip mingguan memotong → tutup; ubah jadwal mingguan; pindah ke Bulanan; `WAITING_WEEKLY` lama) + tes L5b pindah slip utama ditulis ulang. Suite Kasbon, Gaji, Logistik lulus (38 berkas, 300 tes).
