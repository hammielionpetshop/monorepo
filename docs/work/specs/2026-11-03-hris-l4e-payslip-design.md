# Spec HRIS L4e — Periode Slip, Tutup Slip, dan Cetak

Tanggal: 2026-11-03 · Status: **DRAF, menunggu persetujuan owner** (§9)
Cakupan: bagian kelima L4 (Gaji Bulanan), yaitu 4E-5a di [PRD 06](../../hris_planning/PRD/fase_1/06-gaji-bulanan.md) (GAJ-L28 s.d. L32), ditambah pekerjaan yang ditunda ke 4E-5a oleh spec L4b, L4c, dan L4d: Koreksi Periode Lalu (GAJ-L11), penyimpanan sisa potongan, slip terakhir dan Piutang Lain, mutasi dana saat slip ditutup, status bonus **Masuk slip**.
Sumber: v3 `03-gaji` GAJ-36 s.d. 54, 58, 82, 89, 91 s.d. 97; `gaji-bulanan-spec` §3.5 (Tutup Slip, GAJ-L28 s.d. L32) dan §3.2 (Koreksi periode lalu, GAJ-L11), §3.3 (Slip terakhir GAJ-82), keputusan S1 s.d. S4 (13 Oktober 2026).
Dasar kode: L2c (penempatan bertanggal, nonaktif + `WITHOUT_NOTICE`), L2e (pengaturan bertanggal), L2f (Mesin Pengajuan, Pemberitahuan, `announceToOwners`), L3c/L3g/L3h (tinjau absen luar titik, penjelasan, klaim lembur), L4a (`salary_owner_only`, `isPeriodLocked`), L4b (`computeAttendancePay`), L4c (`deductionsOf`, `takeDeductions`, cicilan Potongan Lain, keberatan), L4d (`bonusesOf`, `fund_entries`, Terpesan/Tersedia).
Aliran migrasi: **`hris` 0022** (dan 0023 bila tahap 2, §9 butir 1). Modul: `apps/hris/modules/payroll` (lanjutan).

## 1. Batas

**Pokoknya (GAJ-91):** slip punya tahap **Perkiraan → Ditutup** (Dibayar di 4E-5b). Selama Perkiraan angka **tidak disimpan**: tiap kali diminta, server menjalankan **satu fungsi `computeSlip(orang, periode)`** yang memanggil `computeAttendancePay` (L4b), `bonusesOf` (L4d), dan urutan potongan `takeDeductions` (L4c) beserta sisa potongan dari slip sebelumnya. Fungsi yang sama dipakai halaman periode, layar Slip, tab Potongan, perkiraan dana, dan langkah tutup. **Menutup = menjalankan fungsi itu sekali lagi lalu menyimpan hasilnya baris demi baris**, sehingga angka yang terkunci sama dengan perkiraan terakhir yang dilihat.

Perbaikan sekalian: `deductionsOf` L4c menghitung pendapatan hanya dari kehadiran (bonus belum ikut). Di `computeSlip` pendapatan = gaji tetap + lembur + kompensasi libur + bonus Disahkan; tab Potongan memakai `computeSlip`.

**Dikerjakan** (§9 butir 1: dua kali tayang staging):

| Tahap | Isi |
|---|---|
| **L4e-1** | `computeSlip`, kerangka slip (mesin + saat halaman dibuka), **Periode Slip** (daftar periode + halaman satu periode: tab Slip, Tertahan, Riwayat), **Slip** (bentuk slip + rincian per baris), **penahan slip**, **Tutup** per orang dan **Tutup semua yang siap** (3 langkah), langkah tutup (simpan slip + baris, sisa potongan Dibawa, cicilan terpotong, mutasi Dana Disiplin & Dana Tidak Hadir, bonus **Masuk slip**), kunci per orang (`isPeriodLocked` hidup), sumber yang disahkan terlambat masuk slip berikutnya, **Cetak** (satu dan banyak), pengingat batas tutup, tab Slip di halaman gaji orang |
| **L4e-2** | **Buka kembali** (Pemilik/GM) + **Minta buka kembali** (HR) + riwayat versi, **slip terakhir** (seluruh sisa Potongan Lain, Tidak tertagih, **Piutang Lain**, denda berhenti tanpa pemberitahuan, bonus Hangus, penahan 5 dan 6, **Tutup lebih cepat**), **Koreksi Periode Lalu** (GAJ-L11), koreksi plus untuk potongan yang ditiadakan sesudah terpotong, **Hapuskan sisa** Potongan Lain |

**Tidak dikerjakan di L4e:**

| Hal | Di mana | Akibat sementara |
|---|---|---|
| Bayar, batal bayar, Jadwal Bayar, Daftar Transfer, slip Rp0 "tanpa uang", bayar di luar slip, Ringkasan (tab 5) | 4E-5b | Slip berhenti di Ditutup |
| Pendapatan Saya, Slip Saya, keberatan slip | 4E-5c | Karyawan belum melihat slip; akhir masa keberatan sudah disimpan saat ditutup |
| Kasbon (kelompok d) | L5 | Kelompok (d) kosong |
| Buku Upah (gaji tetap satu baris per komponen, DRV-84) | L7 driver & kenek | Rincian komponen tersimpan di baris slip |
| Slip mingguan (`SM-…`) | L7 | Hanya slip bulanan `SB-…` |
| Usulan tiadakan yang menjadi "Tetap dipotong" (langkah 12 v3) | — | Di HRIS ini peniadaan langsung oleh Pemilik/GM (L4b), tidak ada usulan yang menunggu |
| Penyamaan ke Keuangan (selisih kasir lewat fungsi Keuangan) | app Keuangan | Minus kas POS sudah ada di kelompok (b) (L4c) |

Tiap branch tetap membawa fragment `apps/hris/changelog.d` dan tanda Baru di `lib/new-features.ts`.

## 2. Data (`hris` 0022, 0023)

Pola L4b–L4d: yang disimpan hanya keputusan manusia dan hasil tutup; semua tabel tanpa hapus (pemicu tolak `DELETE`).

| Tabel | Isi | Tahap |
|---|---|---|
| `payslips` | orang, awal periode, jenis (`MONTHLY`), status (`ESTIMATE` / `CLOSED`; `PAID` di 4E-5b), nomor (kosong sampai pertama ditutup), versi, cabang & jabatan pada hari terakhir bekerja di periode itu (GAJ-40), pendapatan, terpotong, bersih, sisa dibawa, ditutup oleh/kapan, **akhir masa keberatan** (23.59 WIB hari ke-3 sesudah ditutup, GAJ-42), slip terakhir ya/tidak. Unik orang + periode + jenis | L4e-1 |
| `payslip_lines` | slip, versi, bagian (`INCOME` / `DEDUCTION` / `NOTE`), kelompok (a–d), **kunci sumber** (mis. `att:LATE`, `bonus:123`, `loss:7`, `pos:2026-10-26`, `manual:4`, `other:55`, `carry:9`), keterangan, periode asal, nominal, terpotong, sisa, rincian (jsonb: tanggal, aturan, angka, hitungan, tautan; PRI-21), status (`ACTIVE` / `REPLACED`) | L4e-1 |
| `deduction_carryovers` (sisa potongan) | orang, slip asal, kelompok, jenis baris asal (mis. `LATE`, `ALPHA`, `other`), keterangan, periode asal, nominal, status (`CARRIED` / `TAKEN` / `CANCELLED`), diambil di slip | L4e-1 |
| `payslip_steps` (jejak) | slip, periode, tindakan (`CLOSE`, `PRINT`; `REOPEN`, `REOPEN_REQUEST`, `EARLY_CLOSE` di L4e-2), oleh/kapan, alasan, ringkasan akibat (jsonb) | L4e-1 |
| `fund_entries` (L4d) + jenis `SLIP` + `payslip_id` + `reversed_at` | mutasi dana dari slip: masuk/keluar per dana, cabang asal = cabang slip | L4e-1 |
| `bonus_entries` (L4d) + status `IN_SLIP` + `payslip_id` (+ `FORFEITED` di L4e-2) | bonus yang masuk slip tertutup | L4e-1 |
| `other_receivables` (Piutang Lain) | orang, slip asal, jenis (kelompok b/c), nominal, status (`OPEN` / `WRITTEN_OFF` / `REVERSED`), alasan hapus | L4e-2 |

**Tanda "sudah masuk slip"** untuk kehilangan barang, minus kas, dan cicilan Potongan Lain dibaca dari `payslip_lines` (kunci sumber pada baris `ACTIVE` slip `CLOSED` orang itu), bukan kolom baru di tiap tabel (§9 butir 5). Cicilan yang terpotong sebagian: bagian yang tak tertampung menjadi `deduction_carryovers`.

## 3. Aturan

### 3.1 Slip lahir sebagai Perkiraan (GAJ-91)

- Kerangka `payslips` (orang, periode, `ESTIMATE`) dibuat untuk tiap orang ber-`pay_basis = MONTHLY` yang ditempatkan sekurang-kurangnya sehari di periode itu, termasuk Training, Pemilik, GM, dan orang yang sudah berhenti tetapi bekerja di periode itu (GAJ-02). Dibuat mesin harian dan saat halaman periode dibuka (idempoten).
- Slip pertama di HRIS: periode mulai `PAYSLIP_FROM` (§9 butir 7). Periode sebelumnya tidak punya slip dan tidak bisa ditutup.

### 3.2 Isi `computeSlip` (GAJ-54, 75, 86)

1. **Pendapatan:** baris bertanda tambah dari `computeAttendancePay` (gaji tetap per komponen/prorata, lembur, kompensasi libur) + bonus Disahkan per jenis yang belum masuk slip tertutup dengan periode ≤ periode ini (bonus yang disahkan sesudah slip periodenya ditutup ikut slip terbuka berikutnya, bertanda periode asal; GAJ-50, 86).
2. **Potongan** (urutan L4c): (a) baris potongan kehadiran; (b) bagian kehilangan barang, minus kas POS bersih, minus catat tangan; (c) cicilan Potongan Lain periode ini + koreksi bonus minus; (d) kosong. Kehilangan/minus kas yang disahkan sesudah slip periodenya ditutup ikut slip terbuka berikutnya (periode asal). **Sisa potongan** (`deduction_carryovers` berstatus Dibawa) diambil lebih dulu di kelompoknya.
3. **Bersih** = pendapatan − terpotong, tidak pernah minus; jumlah baris selalu sama dengan bersih.
4. Pemilik & GM: hanya kehadiran + bonus yang boleh (GAJ-09, KAR-67), sama seperti L4c/L4d.

### 3.3 Penahan slip (GAJ-93; satu fungsi `slipHolds(orang, periode)`)

| No | Penahan | Penyelesai | Tahap |
|---|---|---|---|
| 1 | Absen di luar titik belum diputus (L3c) | HR, Pemilik, GM | L4e-1 |
| 2 | Penjelasan (Perlu Dijelaskan) Menunggu (L3g) | HR, Pemilik, GM | L4e-1 |
| 3 | Klaim lembur Menunggu (L3h) | HR, Pemilik, GM | L4e-1 |
| 4 | Belum ada gaji berlaku di periode itu (L4a) | Pemilik, GM / usulan HR | L4e-1 |
| 5 | Slip terakhir: bonus Menunggu atau Ditahan | HR, Pemilik, GM | L4e-2 |
| 6 | Slip terakhir: usulan berhenti tanpa pemberitahuan belum diputus | Pemilik, GM | L4e-2 |

Bukan penahan: keberatan potongan, usulan potongan, usulan bonus, bonus menunggu milik orang yang masih bekerja (masuk slip berikutnya). **Tidak ada tutup paksa.** Tiap penahan punya tombol **Buka urusannya** ke layar penyelesainya.

### 3.4 Kapan Tutup aktif (GAJ-92; §9 butir 3)

- Ditekan orang, tidak oleh mesin. HR, Pemilik, GM; slip ber-`salary_owner_only` hanya Pemilik/GM (dan tidak tampil di layar HR). GM boleh menutup slipnya sendiri, para pemilik diberi tahu; Pemilik tidak menutup slipnya sendiri.
- Aktif mulai **tanggal 29 pukul 00.00 WIB** sesudah periode berakhir (pengaturan bertanggal `payroll.slip_close_open_day`, isi awal 29). Batas tutup = hari yang sama: mulai 07.00 hari itu pengingat harian sampai semua slip periode itu ditutup. Batas ini pengingat, bukan pagar.
- **Uji di staging:** saklar `HRIS_PAYSLIP_TEST_CLOSE=1` (hanya di `.env` staging) membuat tombol Tutup aktif untuk periode berjalan dan periode yang belum sampai tanggal 29, bertanda "mode uji". Produksi tidak mengisinya.

### 3.5 Langkah tutup (GAJ-94; satu transaksi per slip, semua atau tidak sama sekali)

1. Kunci baris slip (`FOR UPDATE`); periksa ulang hak, status Perkiraan, jendela tutup, penahan kosong. Dua orang menekan bersamaan: yang kedua menerima "Sudah ditutup oleh [nama] pukul [jam]".
2. Jalankan `computeSlip`.
3. Simpan slip: nomor **`SB-[tahun][bulan akhir periode]-[urut 4 angka]`** (diberikan saat pertama ditutup; urut per periode lewat `pg_advisory_xact_lock`), cabang & jabatan, jumlah, versi, siapa/kapan, akhir masa keberatan.
4. Simpan baris slip beserta rinciannya.
5. Sisa potongan lama yang terambil → `TAKEN`; yang tak tertampung → `deduction_carryovers` baru `CARRIED` (jenis + periode asal).
6. **Mutasi dana** (GAJ-87, 88), sebesar yang benar-benar terpotong/dibayar, cabang asal = cabang slip: Dana Disiplin masuk = terpotong telat + denda (termasuk sisa jenis itu), keluar = bonus bersumber Dana Disiplin yang masuk slip; Dana Tidak Hadir masuk = terpotong alpha, izin & sakit, mendadak, sakit dengan surat; keluar = lembur + kompensasi libur. Satu baris per dana per arah per slip. Saldo boleh minus untuk Dana Tidak Hadir (laporan, L4d); keluar bonus sudah dipesan saat disahkan.
7. Bonus yang masuk slip → `IN_SLIP` + `payslip_id` (Terpesan berkurang, mutasi keluar dari langkah 6 menggantikannya).
8. Jejak `payslip_steps` (`CLOSE`, ringkasan: jumlah baris, mutasi, sisa); pemberitahuan ke orangnya ("Slip periode … sudah ditutup. Bersih Rp…").
- Slip bersih Rp0 ditutup biasa; potongannya tetap terkunci dan sisanya dibawa.
- **Tutup semua yang siap**: semua slip yang terlihat penekan, Perkiraan, tanpa penahan; dijalankan satu per satu, yang gagal tidak membatalkan yang lain. Hasil: ditutup / tertahan (siapa, karena apa) / gagal (siapa, sebabnya).

### 3.6 Kunci sesudah ditutup

`isPeriodLocked(periode)` L4a–L4d diganti `isSlipClosed(orang, periode)`. Akibat yang sudah tertulis di kode L4a–L4d mulai berlaku per orang: peniadaan, pembatalan bonus/kehilangan/Potongan Lain, ubah gaji untuk periode itu ditolak dengan "Sudah masuk slip yang ditutup. Koreksinya lewat slip berikutnya." Sumber yang disahkan sesudahnya masuk slip berikutnya (§3.2). Perubahan absen di periode yang slipnya ditutup tidak mengubah slip; selisihnya dihitung Koreksi Periode Lalu (L4e-2).

### 3.7 L4e-2: buka kembali, slip terakhir, koreksi

- **Buka kembali** (GAJ-95): hanya Pemilik/GM, alasan ≥ 15 huruf, tahan 3 detik; tidak membuka slip sendiri kecuali GM; para pemilik diberi tahu. Ditolak bila slip utama berikutnya orang itu sudah ditutup, atau Piutang Lain dari slip itu sudah berubah. Membalik langkah 3–7 dalam satu transaksi: baris versi itu → `REPLACED`, sisa baru `CANCELLED` dan sisa lama kembali `CARRIED`, mutasi dana `reversed_at`, bonus kembali Disahkan, Piutang Lain `REVERSED`. Nomor tetap, versi bertambah. Boleh membuat Tersedia Dana Disiplin minus (Pemilik/GM diberi tahu). Karyawan diberi tahu "Slip … sedang dibetulkan: [alasan]". HR memakai **Minta buka kembali** (alasan wajib, masuk kotak Persetujuan; jenis pengajuan `payslip_reopen`, diputus Pemilik/GM).
- **Slip terakhir** (GAJ-82, 89, 96): dihitung sampai hari terakhir bekerja; seluruh sisa cicilan Potongan Lain masuk; kelompok (a) yang tak tertampung = **Tidak tertagih** (tidak masuk dana); (b), (c) = **Piutang Lain** satu baris per kelompok. Berhenti tanpa pemberitahuan (GAJ-58): bersih tersisa menjadi baris "Denda berhenti tanpa pemberitahuan" (diterima Rp0) dan bonus yang belum masuk slip menjadi **Hangus** (dana terpesan dilepas). **Tutup lebih cepat**: Pemilik/GM, alasan, mulai 00.00 sesudah hari terakhir bekerja, penahan kosong; masa keberatan 3 hari sejak ditutup.
- **Koreksi Periode Lalu** (GAJ-L11, R9 L4b): untuk tiap orang yang punya slip tertutup, `computeAttendancePay` periode lama dijalankan ulang dengan data terbaru (aturan & gaji periode lama) dan dibandingkan per jenis dengan baris tersimpan; selisih ≠ 0 menjadi baris "Koreksi [jenis] periode [nama]" di slip terbuka berikutnya (plus = pendapatan, minus = potongan kelompok a). Layar daftar tanpa tombol ubah angka.
- **Koreksi plus keberatan**: potongan yang Ditiadakan (keberatan L4c) sesudah terpotong di slip tertutup kembali sebagai pendapatan "Pengembalian [potongan]" di slip berikutnya.
- **Hapuskan sisa** Potongan Lain (Pemilik/GM, alasan) sesudah cicilan pertama terpotong.

## 4. Layar

| Layar | Alamat | Menu | Tahap |
|---|---|---|---|
| Periode Slip (GAJ-L08): satu baris per periode, status dibaca dari slipnya, jumlah Perkiraan/Tertahan/Ditutup | `/gaji/periode` | **Kantor › Gaji › Periode Slip** | L4e-1 |
| Satu periode (GAJ-L28): kepala (tanggal, jendela tutup, empat angka), tab **Slip** (saring status/cabang/jabatan; tanda tertahan, slip terakhir, versi 2+, ada sisa dibawa), **Tertahan**, **Tiadakan Potongan** (tautan `/gaji/tiadakan` periode ini), **Riwayat**; tombol **Tutup semua yang siap (n)** dan **Cetak semua yang ditutup** | `/gaji/periode/[awal]` | dari Periode Slip | L4e-1 (+ tab **Koreksi Periode Lalu** di L4e-2) |
| Slip (GAJ-L29): bentuk slip §3.2 (kepala, pendapatan, potongan per kelompok dengan nominal/terpotong/sisa, bersih, catatan), tiap baris bisa dibuka rinciannya; kotak penahan; tombol menurut keadaan | `/gaji/slip/[id]` | dari periode / tab Slip orang | L4e-1 (Buka kembali, Minta buka kembali, Tutup lebih cepat, riwayat versi di L4e-2) |
| Tutup Slip (GAJ-L30, 3 langkah): yang akan ditutup + tertahan terpisah → periksa (bersih Rp0, ada sisa dibawa) → tutup (tahan 3 detik) → hasil | `/gaji/periode/[awal]/tutup` (`?slip=` untuk satu) | dari periode / slip | L4e-1 |
| Cetakan Slip (GAJ-L32): A4 tegak, satu slip per halaman, nomor, versi, tanggal cetak server; hanya slip Ditutup | `/gaji/slip/[id]/cetak`, `/gaji/periode/[awal]/cetak` | dari slip / periode | L4e-1 |
| Tab **Slip** di halaman gaji orang: daftar slip orang itu per periode | `/gaji/[id]/slip` | tab di Gaji Seseorang | L4e-1 |
| Buka Kembali Slip (GAJ-L31, 3 langkah) | `/gaji/slip/[id]/buka` | dari slip | L4e-2 |
| Koreksi Periode Lalu (GAJ-L11) | tab di periode | — | L4e-2 |
| Piutang Lain (daftar per orang, Hapuskan oleh Pemilik) | `/gaji/piutang` | **Kantor › Gaji › Piutang Lain** | L4e-2 |

Kartu **Slip belum ditutup** di Beranda (HR, Pemilik, GM) mulai batas tutup: jumlah siap + tertahan.

## 5. Hak

| Tindakan | HR | Admin HR | Finance | Karyawan | Pemilik, GM |
|---|---|---|---|---|---|
| `payslip.view` (periode, slip; slip `salary_owner_only` tidak dikirim ke non-Pemilik/GM) | ✓ | daftar periode saja (tanggal, status) | daftar periode saja | — | ✓ |
| `payslip.close` (Tutup, Tutup semua) | ✓ | — | — | — | ✓ (GM juga slip sendiri) |
| `payslip.print` (setiap cetak dicatat) | ✓ | — | — | — | ✓ |
| `payslip.reopen` (L4e-2) · ownerOnly | Minta buka kembali | — | — | — | ✓ |
| `payslip.early_close` (L4e-2) · ownerOnly | — | — | — | — | ✓ |
| `receivable.manage` (L4e-2; Hapuskan Piutang Lain, Hapuskan sisa) · ownerOnly | lihat | — | — | — | ✓ |

Penolakan server yang dites: HR menutup/melihat slip jabatan Pemilik/GM; Pemilik menutup slip sendiri; menutup sebelum jendela (tanpa mode uji); menutup slip tertahan; menutup dua kali; mencetak Perkiraan; mengubah peniadaan/bonus/Potongan Lain periode yang slipnya ditutup; (L4e-2) HR membuka kembali; membuka kembali bila slip berikutnya sudah ditutup.

## 6. Mesin terjadwal

| Mesin | Kapan | Isi |
|---|---|---|
| `payslip-skeleton` | tiap hari 04.55 WIB | kerangka slip periode berjalan dan periode lalu (idempoten) |
| `payslip-reminder` | tiap hari 07.00 WIB, mulai batas tutup | selama periode masih punya slip Perkiraan: pemberitahuan ke HR, Pemilik, GM berisi jumlah siap dan daftar tertahan beserta penyelesainya; penyelesai penahan ikut diingatkan |

## 7. Pemberitahuan

| Kapan | Ke siapa | Isi |
|---|---|---|
| Slip ditutup | orangnya | periode, bersih (karyawan belum bisa membuka slip sampai 4E-5c; kalimat menyebut "ditanyakan ke HR") |
| GM menutup slipnya sendiri | pemilik lain | ringkas |
| Tutup semua: ada yang gagal | GM ("perlu perhatian") | nama + sebab |
| Pengingat batas tutup | HR, Pemilik, GM + penyelesai penahan | jumlah siap, tertahan |
| (L4e-2) Slip dibuka kembali | orangnya + pemilik lain | "Slip … sedang dibetulkan: [alasan]" |
| (L4e-2) Tersedia Dana Disiplin minus karena buka kembali | Pemilik, GM | kekurangannya |

## 8. Tes

- **Unit** (`rules/payslip`): susunan slip dari hasil kehadiran + bonus + potongan + sisa; bersih tidak minus dan jumlah baris = bersih; nomor slip; akhir masa keberatan; jendela tutup tanggal 29 + mode uji; pembagian mutasi dana dari baris terpotong (termasuk sisa jenis telat yang terambil belakangan); (L4e-2) slip terakhir: Tidak tertagih vs Piutang Lain, denda GAJ-58; koreksi periode lalu per jenis.
- **Integrasi DB** (tanggal lampau): kerangka slip dua kali = sama; tutup → baris, sisa, mutasi dana, bonus Masuk slip tersimpan dan angka = perkiraan terakhir; tutup bersamaan dua kali → satu berhasil; penahan 1–4 menahan; tutup semua dengan satu gagal; bonus disahkan sesudah ditutup → masuk slip berikutnya bertanda periode asal; sisa dibawa diambil lebih dulu di slip berikutnya; pagar hak §5; peniadaan pada periode tertutup ditolak; (L4e-2) buka kembali membalik semuanya dan nomor tetap.

## 9. Keputusan owner (menunggu)

1. **Dua kali tayang.** **Saran: L4e-1** (hitung slip, Periode Slip, Slip, penahan, Tutup, sisa dibawa, mutasi dana, Masuk slip, Cetak, pengingat) lalu **L4e-2** (Buka kembali, slip terakhir + Piutang Lain + Tutup lebih cepat, Koreksi Periode Lalu, koreksi plus, Hapuskan sisa), masing-masing diuji terpisah.
2. **Kunci per orang.** v3 mengunci data seseorang begitu slipnya ditutup. **Saran: kunci per orang per periode** (`isSlipClosed`), bukan seluruh periode, supaya slip yang tertahan tidak menghalangi orang lain.
3. **Jendela tutup.** **Saran: ikuti v3: Tutup aktif tanggal 29 pukul 00.00, pengingat mulai 07.00 hari yang sama** (pengaturan bertanggal). Supaya bisa diuji sebelum 29 November, **staging saja** diberi saklar mode uji yang membuka Tutup untuk periode berjalan.
4. **Cetak.** **Saran: cetak dari browser** (tampilan A4 khusus cetak; "Simpan sebagai PDF" dari jendela cetak), tanpa pustaka PDF baru. Cetak banyak = satu halaman berisi semua slip tertutup periode itu, satu slip per lembar. Tiap buka cetakan dicatat.
5. **Tanda "sudah masuk slip".** **Saran: dibaca dari baris slip** (kunci sumber), tidak menambah kolom di tabel kehilangan, minus kas, dan cicilan. Bonus mendapat status **Masuk slip** karena statusnya tampil di Buku Bonus.
6. **Slip Pemilik & GM.** **Saran: ikut dibuat dan ditutup** (GAJ-02), hanya terlihat dan ditutup Pemilik/GM. GM boleh menutup slipnya sendiri (pemilik lain diberi tahu), Pemilik tidak menutup slipnya sendiri.
7. **Periode slip pertama.** Periode sebelum HRIS dipakai sudah dibayar di HRIS lama. **Saran: `PAYSLIP_FROM` = periode 26 Oktober 2026 untuk staging** (periode berjalan, berisi data uji L3/L4), **diganti sebelum produksi** ke periode gaji HRIS pertama bersama `CASH_SHORTAGE_FROM` dan `BONUS_FROM`.
8. **Siapa melihat.** **Saran:** HR, Pemilik, GM membuka periode dan slip (HR tanpa jabatan Pemilik/GM); **Admin HR dan Finance hanya daftar periode** (tanggal dan status, tanpa nominal), sesuai GAJ-46; Ringkasan untuk Finance menyusul di 4E-5b.

## 10. Catatan untuk tahap berikutnya

- **4E-5b:** status `PAID`, slip bersih Rp0 langsung "Dibayar tanpa uang", bayar di luar slip (bonus susulan untuk slip terakhir yang sudah dibayar; dipotongkan ke Piutang Lain dulu), Daftar Transfer, Ringkasan; buka kembali ditolak bila sudah Dibayar.
- **4E-5c:** Slip Saya / Pendapatan Saya memakai `computeSlip` dan bentuk slip yang sama; keberatan slip sampai `akhir masa keberatan`.
- **Sebelum produksi:** `PAYSLIP_FROM`, `CASH_SHORTAGE_FROM`, `BONUS_FROM` diganti ke periode gaji HRIS pertama; saklar `HRIS_PAYSLIP_TEST_CLOSE` tidak diisi.
