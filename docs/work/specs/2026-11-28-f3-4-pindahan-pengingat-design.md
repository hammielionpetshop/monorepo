# F3-4 Pindahan Pengingat Modul ke Antrean — rancangan

Status: **disetujui owner 2026-11-28** ("ok saya setuju"; keempat keputusan §8 sesuai saran). Koding F3-4a di sesi baru.

Sumber: PRD Fase 3 `01-antrean-berantai.md` §5; spec F3-1 (`2026-11-15-f3-1-antrean-berantai-design.md`)
§2–§3 dan §9 butir 4; v3 TAM-22, 24, 25; PRI-43; `daftar-lintas-modul` bab 2 (2.2, Tabel B, Tabel C).

## 0. Pembagian F3-4

F3-4 terlalu besar untuk satu kali uji, jadi dipecah tiga:

| Langkah | Isi | Migrasi | Spec |
|---|---|---|---|
| **F3-4a** | Kartu "Perlu perhatian" yang sudah ada dan lolos TAM-24 ditandai menjadi jendela antrean; satu jenis = satu jendela; naik ke Pemilik/GM bila penerima tidak ada | tidak | §2–§4 |
| **F3-4b** | Kartu baru untuk pengingat yang sekarang **hanya** dikirim ke lonceng (slip belum ditutup / belum Dibayar, Laporan Pulang) | tidak | §5 |
| **F3-4c** | Antrean **sekali baca** (Tabel C): kabar pribadi soal uang, hak, jadwal muncul sekali sebagai jendela | hris `0062` | §6 |

Lonceng **tetap dikirim** seperti sekarang di ketiga langkah (PRD 01 §5 butir terakhir).

## 1. Keadaan sekarang (kode `origin/dev_hris` 925a0c68)

- Mesin antrean F3-1 membaca kartu dari `modules/attention/server/cards.ts`; kartu yang punya `queue`
  menjadi jendela. Jenis yang boleh tercantum di `QUEUE_KINDS` (`rules/queue.ts`); **kunci kartu = jenis**.
- Baru tiga jenis: `rule_unread` (B4), `requests` (B1), `overdue` (B2). Darurat (B5) punya jendela sendiri.
- Sekitar 40 kartu lain hanya tampil di Beranda. Beberapa kuncinya **memakai nomor data**
  (`letter-12`, `trip-hanging-7`, `work-3`, `rep-5`, `day-off-2026-11-01`), sehingga satu urusan bisa menjadi
  banyak kartu — tidak boleh menjadi banyak jendela (TAM-25 butir 4).
- Pengingat mesin harian (`payslip.reminder`, `payslip.pay_reminder`, `logistics.end_report`, dll.) dikirim
  sekali per tanda ke lonceng.

## 2. Perubahan mesin (F3-4a)

1. `queue` ditambah bidang **`kind`** (tidak wajib). Bila diisi, kartu-kartu dengan `kind` sama digabung
   menjadi **satu jendela**: "Ada 3 trip belum Sampai Garasi. Yang paling lama sejak 26 Nov." Bila kosong,
   jenis = kunci kartu seperti sekarang. `QUEUE_KINDS` mencatat jenis, bukan kunci kartu.
2. `queue` boleh diberi syarat waktu oleh fungsi modul (mis. "baru jendela bila sisa ≤ 1 hari"); kartu
   Beranda tetap muncul sejak awal, sama seperti B1 di F3-1.
3. **Naik ke Pemilik/GM (PRI-43, 2.2 butir 6):** untuk jenis yang penerimanya ditentukan dari hak/jabatan
   (Kepala Gudang, Finance, Kepala Toko, HR), bila **tidak ada akun aktif** pemegang hak itu, atau semuanya
   **cuti/izin lebih dari 2 hari** hari ini, kartunya juga muncul ke Pemilik dan GM dengan tanda
   "(penerima tidak ada)". 💡 Satu fungsi bersama `hasLiveHolder(action, branchId?)`.
4. **Beres untuk satu = beres untuk semua** (2.2 butir 4) sudah otomatis: kartu dihitung dari data.
5. `useQueueHold()` dipasang di layar bertahap yang belum: Laporan Pulang driver, langkah trip driver,
   tutup slip, bayar slip.

## 3. Tabel pemetaan kartu yang ada (F3-4a)

Kolom **Jendela mulai** = kapan kartu yang sudah tampil di Beranda juga menjadi jendela (sekali sehari
sampai beres).

### 3.1 Menjadi jendela antrean

| Kartu sekarang | Jenis (`kind`) | Tabel B | Kepada | Jendela mulai |
|---|---|---|---|---|
| `training` | `training-due` | B7 | HR, Pemilik, GM | Tanggal penilaian tiba |
| `attendance-review` | `attendance-review` | B34 | HR, Pemilik | Ada absen luar titik |
| `absence-due` | `absence-due` | B27 | Penyetuju izin/sakit/cuti | Tanggalnya sudah tiba |
| `letter-{id}` | `doctor-letter` | B28 | Pengaju | Sisa 1 hari |
| `clarify-mine` | `clarify-mine` | B29 | Orang itu | Hari kejadian, H-1, hari terakhir |
| `clarify-streak` | `absent-streak` | B31 | HR, Pemilik | Hari ke-7 |
| `overtime-mine` | `overtime-unclaimed` | B32 | Orang itu | H-1 dan hari terakhir |
| `day-off-{periode}` | `day-off-quota` | B23 | Orang itu | H-7, H-3, H-1 sebelum jendela libur tutup |
| `swap` | `swap-invite` | B24 | Teman yang diajak | Ajakan masuk |
| `work-{id}` | `work-request` | B25 | Orang itu | Permintaan masuk |
| `rep-{id}` | `replacement-day` | B26 | Orang itu | Sisa 3 hari |
| `salary-missing` | `salary-missing` | B36 | HR (+ Pemilik, GM) | Terdeteksi |
| `objection-fix`, `objection-late` | `objection` | B44 | Penyetuju; Pemilik/GM sesudah 2 hari | Keberatan masuk |
| `advance-review`, `advance-decide`, `advance-late` | `advance-waiting` | B63 | Finance; Pemilik, GM | Pengajuan masuk |
| `advance-hand-over` | `advance-hand-over` | B64 | Finance, Pemilik, GM | Sesudah disetujui |
| `trip-hanging-{id}` | `trip-hanging` | B47 | Kepala Gudang, Pemilik, GM | Lewat batas yang sudah ada (LOG-31) |
| `self-cash` | `self-cash` | B49 | Karyawan cabang asal, Kepala Toko | Tugas selesai |
| `notes-decide`, `self-failed` | `delivery-failed` | B50 | Kepala Gudang; cabang asal | Sesudah 3 hari |
| `store-reports` | `store-reports` | B51/B52 | Finance / Kepala Gudang | 💡 Sesudah 3 hari |
| `note-cuts-unrecorded` (merah), `money-check-pos` | `cashier-unrecorded` | B53 | Finance (+ Pemilik, GM) | Lewat 2–3 hari (ambang yang sudah ada) |
| `store-points` | `store-points` | B46 | Kepala Gudang | Lebih dari 2 hari |
| `fuel-wait` | `fuel-wait` | B54 | Kepala Gudang, Finance | 12.00 hari berikutnya |
| `vehicle-attention` | `vehicle-attention` | B21 | Kepala Gudang, Finance | Laporan masuk |
| `returned-goods` | `returned-goods` | B56 | Staf/Kepala Toko cabang pemilik | Dicatat |
| `trip-wage-unrated` | `trip-wage-unrated` | B57 | Pemilik, GM | Terdeteksi |
| `unloading-unpaid` | `unloading-unpaid` | B61 | Finance, Pemilik, GM | Lewat harinya |
| `unloading-overpay` | `unloading-overpay` | B62 | Pemilik, GM | Lewat batas |

💡 Penahan slip (B41) **tidak** menjadi jendela sendiri per modul; digabung di F3-4b (2.6 temuan 3).

### 3.2 Tetap di Perlu perhatian saja (tidak lolos TAM-24)

`weekly-pay`, `my-pay` (diperiksa ulang saat koding), `trip-wage-look`, `unloading-look`, `unloading-weights`,
`pending-notes`, `deposit-check`, `deposit-record`, `short-handover`, `kasir-changed`, `self-late`,
`self-cash-late`, `money-check` (belum merah), `advance-weekly`, `fence-off`. Alasannya: tidak ada batas yang
membuat uang/hak hilang dan tidak ada orang yang menunggu lebih dari 1 hari — kalau semua jadi jendela,
orang menekan OK tanpa membaca (TAM-24).

### 3.3 Tabel B yang tidak dikerjakan di F3

Keuangan (B67–B75) dan Kinerja (B76) mengikuti modulnya (PRD 00 §9). Karyawan B6, B8–B15 dan Kehadiran B16–B18,
B22 belum punya kartu/datanya di monorepo; masuk saat fiturnya dibangun.

## 4. Tes F3-4a

- Kartu berkunci nomor dengan `kind` sama → satu jendela, jumlah dan yang terlama benar.
- Tiap jenis: belum mulai → tidak ada jendela tapi kartu ada; sudah mulai → jendela sekali sehari; beres → hilang.
- Naik ke Pemilik/GM: pemegang hak nonaktif, tidak ada, atau cuti > 2 hari.
- Setiap `kind` di `QUEUE_KINDS` dihasilkan perangkai (tes F3-1 diperluas).

## 5. F3-4b — kartu baru dari pengingat lonceng

Pengingat ini sekarang hanya lonceng; dibuatkan kartu Perlu perhatian (dihitung dari data) yang sekaligus jendela:

| Pengingat sekarang | Jenis | Tabel B | Kepada |
|---|---|---|---|
| `payslip.reminder` (slip belum ditutup, ada yang tertahan) | `payslip-held` | B41 + B58 | HR, Pemilik, GM; penyelesai tiap penahan |
| `payslip.pay_reminder` (belum ditandai Dibayar) | `payslip-unpaid` | B43 | Pemilik, GM |
| `logistics.end_report` / pulang menunggu laporan | `end-report` | B19, B20 | Orang itu / driver |

Lonceng lamanya tetap. Rincian kalimat dan ambang diambil dari mesin pengingat yang sudah ada.

## 6. F3-4c — antrean sekali baca (Tabel C)

Kabar pribadi soal uang, hak, atau jadwal yang tidak punya batas: muncul **sekali** sebagai jendela, hilang
sesudah "OK, sudah baca", **tidak** masuk Perlu perhatian.

- Migrasi hris `0062`: kolom `popup_acked_at` di `notifications` (dan penanda jenis yang sekali baca di kode,
  daftar `ONCE_KINDS`). Tidak ada tabel baru.
- Kelompok antrean baru `ONCE`, sesudah `TASK`. Jendela **digabung per kelompok** Tabel C ("Gaji dan potongan
  saya berubah: 2 kabar"), isi tiap kabar terlihat di jendelanya.
- Jenis awal dari kode sekarang: `salary.changed`, `salary.corrected`, `pay_waiver.created`,
  `manual_cash_shortage.active`, `other_deduction.active`, `inventory_loss.active`, `bonus.rejected`,
  `payslip.payment_cancelled`, `attendance.shift`, `attendance.day_off`, `logistics.assigned`,
  `logistics.removed`, `request.revoked`, `request.expired`, `advance.filled_for`.
- Kabar yang sudah lewat 7 hari tanpa dibuka tidak lagi menjadi jendela (tetap di lonceng).

## 7. Uji owner (staging), per langkah

**F3-4a:** (1) buat satu surat dokter tinggal 1 hari → pengaju dapat jendela; (2) dua trip belum Sampai Garasi
→ Kepala Gudang dapat **satu** jendela "2 trip"; (3) nonaktifkan semua Finance uji → kasbon menunggu muncul
ke Pemilik/GM; (4) kartu `pending-notes` tidak menjadi jendela; (5) Laporan Pulang driver sedang diisi →
jendela tidak memotong.
**F3-4b:** slip periode lalu belum ditutup → HR dapat jendela sekali sehari sampai ditutup.
**F3-4c:** ubah gaji karyawan uji → karyawan itu dapat satu jendela; sesudah OK tidak muncul lagi; lonceng tetap ada.

## 8. Keputusan owner (2026-11-28: semua sesuai saran)

1. **Pecah tiga langkah** F3-4a → F3-4b → F3-4c, uji satu per satu. Saran 💡: ya.
2. **Daftar 3.1 dan 3.2** (mana jadi jendela, mana cukup kartu). Saran 💡: sesuai tabel; owner boleh
   memindah baris.
3. **Naik ke Pemilik/GM** bila penerima tidak ada/cuti > 2 hari berlaku untuk semua jenis di 3.1. Saran 💡: ya.
4. **F3-4c sekali baca** tetap dibangun di Fase 3 (bukan ditunda). Saran 💡: ya, sesudah F3-4a/b lolos.
