# Spec HRIS L4c — Potongan di Luar Kehadiran

Tanggal: 2026-11-03 · Status: **disetujui owner 2026-11-03** (§9 semua sesuai saran, "ok saya setuju"; owner minta L4c-1 lalu langsung L4c-2 tanpa menunggu uji di antaranya)
Cakupan: bagian ketiga L4 (Gaji Bulanan), yaitu 4E-3 di [PRD 06](../../hris_planning/PRD/fase_1/06-gaji-bulanan.md) (GAJ-L12 s.d. L19), dengan penyimpangan Fase 1 yang sudah diputuskan: **minus kas dari shift POS** (PRD 06 §3.1, §3.1a: ditanggung kasir itu sendiri menurut laporan POS **Minus Kasir**) dan **kehilangan barang diisi manual** (§3.4).
Sumber: v3 `03-gaji` GAJ-07, 09, 17 s.d. 21, 38, 50, 52, 75 s.d. 82; `gaji-bulanan-spec` §3.3 (rumus R10 s.d. R15, urutan pengambilan, pembagian kehilangan barang, GAJ-L12 s.d. L19, slip terakhir, isi kartu Aturan Potongan), keputusan P1 s.d. P4 (13 Oktober 2026); PRD 01 §4 (view `v_selisih_kas`).
Dasar kode: L2c (penempatan bertanggal, nonaktif), L2e (pengaturan bertanggal, `startDay: 26`, sasaran `BRANCH`/`POSITION`), L2f (Mesin Pengajuan: `PENDING → REVIEWED → APPROVED`, Pemberitahuan, `announceToOwners`), L3b (absen hadir per cabang per hari), L3c (`payPeriodOf`), L4a (paket gaji, `salary_owner_only`), L4b (`attendancePay`, `isPeriodLocked`, Aturan Potongan, pagar Pemilik/GM). POS: laporan **Minus Kasir** (`apps/backoffice/lib/cashier-variance.ts`, rilis 1.107.105–106).
Aliran migrasi: **`hris` 0018**. Modul: `apps/hris/modules/payroll` (lanjutan).

## 1. Batas

**Pokoknya (v3 4E-3):** tiap potongan dicatat di menunya sendiri (Kehilangan Barang, Minus Kas, Potongan Lain). Slip hanya membaca (GAJ-38). Semua rupiah potongan di luar kehadiran beserta **urutan pengambilan** keluar dari **satu fungsi di server**, `otherDeductions(orang, periode)`, yang nanti dipanggil slip (4E-5a), Pendapatan Saya (4E-5c), dan contoh Aturan Potongan. Tidak ada rumus kedua.

Jabatan **Pemilik dan GM tidak punya satu pun baris** di bagian ini (GAJ-09). Orang ber-`pay_basis = WEEKLY` tidak dihitung di sini (L7).

**Dikerjakan** (dua kali tayang staging, §9 butir 1):

| Tahap | Isi |
|---|---|
| **L4c-1** | Tanggungan Kehilangan Barang (persen kantor per cabang, tanda dan bobot per jabatan), Kehilangan Barang + Catat Kehilangan, Minus Kas (dari POS + catat tangan), Tautan Akun Kasir, kartu Aturan Potongan kehilangan barang dan minus kas |
| **L4c-2** | Potongan Lain + Ajukan Potongan Lain + Jenis Potongan Lain, Keberatan Potongan, tab **Potongan** (urutan pengambilan) di Gaji Seseorang, kartu Aturan Potongan Potongan Lain dan urutan |

**Tidak dikerjakan di L4c:**

| Hal | Di mana | Akibat sementara |
|---|---|---|
| Kasbon (R14, kelompok d) | L5 Kasbon (PRD 07) | Kelompok (d) tampil kosong "menyusul" |
| **Menyimpan** sisa potongan (R15) dan membawanya ke slip berikutnya | 4E-5a (sisa baru lahir saat slip **ditutup**) | Tab Potongan menghitung urutan dan sisa sebagai **perkiraan**; belum ada slip yang ditutup, jadi belum ada sisa dari slip sebelumnya |
| Slip terakhir orang yang berhenti, Piutang Lain, denda berhenti tanpa pemberitahuan (GAJ-82, 58) | 4E-5a (langkah tutup slip) | Dicatat di §10 untuk 4E-5a |
| Keberatan kehilangan barang perorangan | tidak ada (v3 GAJ-81: lewat keberatan slip 4E-5c) | — |

## 2. Data (`hris` 0018)

Pola L4b: **bagian tiap orang dihitung saat dibaca** (dari catatan yang Berlaku, penempatan, pengaturan bertanggal), tidak disimpan. Yang disimpan hanya catatan dan keputusan manusia. Baris slip disimpan saat slip ditutup (4E-5a). Semua tabel tanpa hapus (pemicu tolak `DELETE`); kesalahan diperbaiki dengan **Batalkan** beralasan.

| Tabel | Isi |
|---|---|
| `inventory_losses` (kehilangan barang) | cabang, tanggal ditemukan, nilai (rupiah bulat > 0), keterangan, berkas lampiran (wajib, modul files), status `PENDING` / `ACTIVE` / `CANCELLED`, pengajuan (bila usulan HR), dicatat oleh, disahkan oleh/kapan, dibatalkan oleh/kapan/alasan |
| `pos_cashier_links` (tautan akun kasir) | id pengguna POS (`petshop.users.id`, tanpa FK lintas schema) → karyawan; satu akun POS ke satu karyawan, **satu karyawan boleh banyak akun POS** (mis. akun per cabang); dibuat oleh/kapan, dilepas oleh/kapan |
| `cash_shortages` (minus kas dari POS) | id shift POS, id pengguna POS, karyawan (lewat tautan), cabang, tanggal kejadian, kategori shift (`MINUS` / `PLUS` / `ANOMALY`), bagian minus atau plus orang itu, porsi kas tunai, status `NEW` / `INCLUDED` / `WAIVED`, pengajuan pengesahan, alasan peniadaan. Unik per (shift, pengguna POS) |
| `manual_cash_shortages` + `manual_cash_shortage_shares` (minus kas catat tangan) | cabang, tanggal kejadian, nilai, alasan, bernama/tanpa nama, penanggung (bernama) atau daftar penanggung yang dibekukan saat Berlaku (tanpa nama: orang yang hadir hari itu), lampiran (boleh kosong), status `PENDING` / `ACTIVE` / `OBJECTED` / `WAIVED` / `CANCELLED` |
| `other_deduction_types` | jenis Potongan Lain, isi awal **Ganti rugi barang rusak, Ganti rugi peralatan, Lainnya** (L4c-2) |
| `other_deductions` + `other_deduction_installments` | orang, jenis, nominal, alasan, lampiran, kali potong 1–3, status, jadwal cicilan per periode (L4c-2) |

Keberatan memakai Mesin Pengajuan (jenis `deduction_objection`), tidak perlu tabel sendiri selain kaitan ke potongan yang dikeberati.

**View POS** (PRD 01 §4, dimiliki pemilik migrasi; `hris_app` tidak membaca `petshop` langsung):
- `hris.pos_shift_variances` (`v_selisih_kas` di PRD 01): shift POS yang sudah ditutup (`CLOSED` / `FORCE_CLOSED`) **dan diverifikasi Finance**, dengan cabang, tanggal tutup, kas sistem, uang diterima, selisih resmi.
- `hris.pos_shift_cash_shares`: kas tunai per kasir per shift (penjualan tunai bersih kembalian + pelunasan piutang tunai yang belum dibatalkan), persis rumus laporan Minus Kasir.
- `hris.pos_users`: id, nama, username (untuk Tautan Akun Kasir).
- `hris.pos_cashier_variance_settings`: toleransi dan batas tak wajar milik laporan Minus Kasir (`app_settings`).

Isi awal di migrasi: pengaturan baru (§3.1), jenis Potongan Lain, jenis pengajuan baru, tindakan baru dan haknya (§5).

## 3. Aturan

### 3.1 Tanggungan Kehilangan Barang (GAJ-L14)

Tiga pengaturan bertanggal L2e (`module: payroll`, `affectsMoney`, `startDay: 26`, `mustAnnounce`):

| Kunci | Sasaran | Isian | Isi awal |
|---|---|---|---|
| `payroll.loss_office_percent` | `BRANCH` | persen kantor, bilangan bulat 0–100 | **kosong** (diisi owner di layar sebelum mencatat kehilangan, v3 GAJ bagian 6 butir 4); §9 butir 7 |
| `position.loss_sharing` | `POSITION` | "Ikut menanggung kehilangan barang" Ya/Tidak (KAR-L31) | §9 butir 7 |
| `position.loss_weight` | `POSITION` | bobot, bilangan bulat 1–9 | §9 butir 7 |

Tanda dan bobot juga dipakai minus kas catat tangan tanpa nama (GAJ-79). Pemilik dan GM selalu dianggap Tidak (GAJ-09), apa pun isinya. Siapa mengubah: §9 butir 8.

### 3.2 Kehilangan barang (R10, GAJ-76, 77)

- **Dicatat** per kejadian oleh HR, Pemilik, atau GM: cabang, **tanggal ditemukan** (tidak di masa depan), nilai, keterangan (≥ 10 huruf), **lampiran hasil opname wajib**. Catatan HR = **usulan** (jenis pengajuan `inventory_loss`) yang disahkan Pemilik/GM; catatan Pemilik/GM langsung Berlaku. Masuk periode tanggal ditemukan (stock opname sebulan sekali, jadi satu opname = satu periode).
- **Pembagian** (GAJ-77): bagian orang = nilai × (100% − persen kantor) × bobot ÷ jumlah bobot × hari ÷ jumlah hari periode.
  - **Yang ikut** = orang yang **ditempatkan** di cabang itu ≥ 1 hari dalam periode, dengan jabatan bertanda. Status Training tidak membedakan.
  - **Bobot** = bobot jabatannya pada hari terakhir ia ditempatkan di cabang itu dalam periode. **Jumlah bobot** = bobot semua yang ikut, dihitung penuh.
  - **Hari** = hari kalender ia ditempatkan di cabang itu dengan jabatan bertanda (libur, izin, sakit, cuti ikut; **perbantuan tidak memindah tanggungan**).
  - **Bagian kantor** = nilai − jumlah bagian orang, tampil tiga angka: persen kantor, sisa sebanding hari, pembulatan. Jumlah semua selalu = nilai.
  - Pembulatan bagian tiap orang ke rupiah terdekat, **sekali per baris** (GAJ-07); selisihnya ke kantor.
  - Contoh v3: Rp1.000.000, kantor 40%, periode 30 hari; Kepala toko (bobot 2) dan Budi (1) penuh, Citra (1) 10 hari, Dodi (1) 20 hari → Rp240.000, Rp120.000, Rp40.000, Rp80.000; kantor Rp400.000 + Rp120.000.
- **Ditolak server:** cabang tanpa persen kantor yang berlaku pada tanggal itu; ada jabatan bertanda tanpa bobot; tanpa lampiran; nilai ≤ 0; tanggal di masa depan. **Tidak ada yang ikut menanggung:** usulan HR ditolak; Pemilik/GM melihat peringatan "Seluruhnya ditanggung kantor" dan boleh tetap menyimpan.
- **Batalkan** (Pemilik/GM, alasan wajib) hanya sebelum masuk slip yang ditutup (`isPeriodLocked`); sesudahnya lewat koreksi slip berikutnya (4E-5a).
- **Disahkan sesudah slip periodenya ditutup** (berlaku sesudah 4E-5a): tetap dibagi menurut orang di periode tanggal ditemukan, masuk slip berikutnya dengan keterangan periode asal.

### 3.3 Minus kas dari POS (R11 Fase 1, PRD 06 §3.1, §3.1a)

- **Sumber** = angka per kasir laporan POS **Minus Kasir**: selisih resmi shift (uang diterima & diverifikasi Finance − kas sistem) dibagi ke kasir menurut **porsi kas tunai**, pembulatan sisa terbesar. Toleransi dan batas tak wajar **dibaca dari pengaturan laporan Minus Kasir** (awal Rp5.000 dan Rp1.000.000), supaya angka HRIS = angka laporan POS (§9 butir 3). Fungsi murni pembagian (`classifyVariance`, `allocateByCashShare`) **dipindah ke `packages/shared`** dan dipakai backoffice dan HRIS, seperti rumus nilai bersih baris nota (PRD 01 §4).
- Hanya shift yang **sudah ditutup dan diverifikasi Finance**. Shift **dalam toleransi** / cocok tidak menghasilkan baris. Shift **tak wajar** (≥ batas) tidak pernah otomatis menjadi potongan: tampil "periksa dulu, kemungkinan salah input"; setelah angka shift dibetulkan di POS, ia terbaca ulang.
- **Tanggal kejadian = tanggal tutup shift** (WIB), periode mengikuti tanggal itu (PRD 06 §3.1, GAJ-38). (Laporan POS bulanan memakai tanggal buka; untuk shift yang tutup lewat tengah malam pada tanggal 25/26 periodenya bisa beda sehari. §9 butir 4.)
- **Penarikan:** mesin terjadwal `cash-shortage-sync` (tiap malam, idempoten) menyalin bagian tiap kasir dari view ke `cash_shortages`. Akun POS yang **belum ditautkan** ke karyawan tetap tercatat dan tampil "belum ditautkan"; tidak dipotong sampai ditautkan (§9 butir 6). Bila Finance memverifikasi ulang shift sehingga angkanya berubah sebelum disahkan, barisnya diperbarui; sesudah disahkan, perubahan tampil sebagai "angka POS berubah" untuk ditinjau ulang.
- **Pengesahan** (PRD 06 §3.1: minus tidak langsung menjadi potongan): tiap tanggal 26 pagi, mesin yang sama membuat **satu usulan per orang per periode yang baru lewat** (jenis pengajuan `cash_shortage`), berisi rincian per shift. **HR meninjau** (status `REVIEWED`), **Pemilik/GM mengesahkan**; saat mengesahkan, Pemilik/GM boleh **meniadakan shift tertentu** dengan alasan (mis. salah input). Baris shift yang terverifikasi sesudah usulan dibuat masuk usulan **susulan** dengan keterangan periode asal (§9 butir 5).
- **Nilai di slip** (GAJ-20, PRD 06 §3.1): jumlah minus orang itu yang disahkan dalam periode, **dikurangi plus-nya di periode yang sama, paling kecil Rp0**. Kelebihan hanya menutup minus, tidak pernah menjadi tambahan gaji. (Laporan POS tetap menampilkan minus dan plus berdampingan; penjumlahan bersih hanya di HRIS.)
- Pemilik/GM yang tercatat sebagai kasir: barisnya tampil, tidak pernah menjadi potongan (GAJ-09).
- **Keberatan** atas minus kas POS memakai Keberatan Potongan (§3.6; PRD 06 §3.1), karena keberatan Keuangan v3 tidak ada di Fase 1.

### 3.4 Minus kas catat tangan (R12, GAJ-79)

- Hanya untuk kejadian **di luar shift POS**, alasan wajib (≥ 15 huruf, harus menjelaskan kenapa tidak lewat POS). Dicatat HR atau Finance sebagai **usulan** (jenis `manual_cash_shortage`); Pemilik/GM mengesahkan; catatan Pemilik/GM langsung Berlaku.
- **Bernama:** ditanggung penuh orang itu (yang ditempatkan atau hadir di cabang itu hari itu; bukan Pemilik/GM).
- **Tanpa nama:** dibagi rata ke orang yang **hadir** (absen masuk L3b) di cabang itu pada tanggal kejadian dengan jabatan bertanda "ikut menanggung kehilangan barang"; daftar orangnya dibekukan saat Berlaku. Tidak ada yang hadir → ditolak ("Tidak ada yang hadir. Pilih nama penanggung, atau batalkan"). Kantor hanya menanggung selisih pembulatan.
- Uang yang bercampur antarshift tidak dibebankan ke siapa pun (KEU-51).

### 3.5 Potongan Lain (R13, GAJ-80) — L4c-2

- HR mengajukan (jenis `other_deduction`); Pemilik/GM mengesahkan; ajuan Pemilik/GM langsung **Berjalan**. Tidak ada yang mengajukan atau mengesahkan untuk dirinya sendiri; orang Pemilik/GM tidak bisa dipilih.
- Jenis dari daftar (diubah Pemilik/GM; jenis yang dipakai tidak bisa dinonaktifkan). Nominal rupiah bulat > 0, alasan ≥ 15 huruf.
- **Kali potong 1–3** (`payroll.other_deduction_max_installments`, awal 3). Jadwal dibuat server: nominal dibagi rata, dibulatkan ke bawah, sisanya di cicilan terakhir; cicilan pertama di slip periode saat disahkan, atau periode berikutnya bila slip itu sudah ditutup. Sisa tidak disimpan, dihitung dari cicilan.
- **Ubah jadwal** (Pemilik/GM, alasan) hanya cicilan yang belum terpotong. **Batalkan** hanya sebelum cicilan pertama terpotong; sesudahnya hanya **Hapuskan sisa** (Pemilik/GM, dicatat sebagai beban). Sebelum 4E-5a belum ada cicilan yang "terpotong", jadi Batalkan selalu tersedia.

### 3.6 Keberatan Potongan (GAJ-81) — L4c-2

- Untuk **minus kas dari POS**, **minus kas catat tangan bernama**, dan **Potongan Lain**. Kehilangan barang tidak (lewat keberatan slip 4E-5c). Minus tanpa nama juga tidak (ditanggung bersama).
- Lewat Mesin Pengajuan, jenis `deduction_objection`, dari pemberitahuan potongan. Alasan ≥ 20 huruf, foto bila ada. Batas **23.59 hari ke-3 sejak diberi tahu** (jam server); lewat itu tombol hilang.
- Diputuskan Pemilik/GM (bukan dirinya sendiri, bukan pengesah potongan itu bila ia yang dikenai): **Tetap** atau **Ditiadakan**, alasan wajib.
- Selama menunggu, potongan **tetap berjalan** dan slip tidak tertahan. Ditiadakan sesudah terpotong → kembali sebagai koreksi plus di slip berikutnya (4E-5a).

### 3.7 Urutan pengambilan (GAJ-75) — L4c-2

`otherDeductions` menerima pendapatan dan potongan kehadiran dari `attendancePay` (L4b), lalu:

1. **Pendapatan slip** = gaji tetap (R1) + lembur (R6) + kompensasi libur (R7) (+ bonus 4E-4 dan koreksi plus R9 saat sudah ada).
2. Potongan diambil berurutan sampai pendapatan habis: (a) telat, tidak hadir, denda (L4b); (b) kehilangan barang dan minus kas (R10, R11, R12); (c) Potongan Lain (R13); (d) kasbon (L5). Di tiap kelompok, sisa dari slip sebelumnya lebih dulu (mulai 4E-5a), lalu yang baru menurut tanggal kejadian.
3. Yang tertampung sebagian dipotong sebagian; sisanya **sisa potongan** dengan jenis dan periode asal. **Gaji bersih tidak pernah di bawah Rp0.**
4. Contoh v3: pendapatan Rp1.000.000; (a) Rp300.000; (b) Rp200.000; (c) Rp400.000 → semua terpotong, bersih Rp100.000.

### 3.8 Aturan Potongan (GAJ-L07)

Kartu baru, contoh dihitung fungsi yang sama (orang contoh bergaji Rp2.600.000): **Kehilangan barang**, **Minus kas** (contoh minus Rp50.000 dan plus Rp20.000 di periode yang sama → dipotong Rp30.000), **Minus kas tanpa nama**, **Potongan Lain** dan **Urutan potongan** (L4c-2). Kartu kehilangan barang dan minus tanpa nama hanya untuk jabatan bertanda; HR, Pemilik, GM melihat semua.

## 4. Layar

| Layar | Alamat | Menu | Tahap |
|---|---|---|---|
| Kehilangan Barang (GAJ-L12) + Catat Kehilangan (GAJ-L13, 4 langkah) | `/potongan/kehilangan-barang`, `/potongan/kehilangan-barang/catat` | **Kantor › Potongan › Kehilangan Barang** | L4c-1 |
| Minus Kas (GAJ-L15), tab **Dari POS** / **Catat tangan** / **Belum ditautkan**, + Catat Minus Kas (4 langkah) | `/potongan/minus-kas` | **Kantor › Potongan › Minus Kas** | L4c-1 |
| Tautan Akun Kasir | `/potongan/minus-kas/tautan` | dari tab Belum ditautkan | L4c-1 |
| Tanggungan Kehilangan Barang (GAJ-L14), tab Persen kantor per cabang / Tanda & bobot per jabatan | `/pengaturan/tanggungan-kehilangan` | **Pengaturan › Tanggungan Kehilangan** | L4c-1 |
| Potongan Lain (GAJ-L16) + Ajukan (GAJ-L17, 4 langkah) + Jenis Potongan Lain | `/potongan/lain`, `/potongan/lain/ajukan`, `/pengaturan/jenis-potongan-lain` | **Kantor › Potongan › Potongan Lain** | L4c-2 |
| Keberatan Potongan (GAJ-L18, HP) | `/keberatan-potongan/ajukan?potongan=…` | dari pemberitahuan | L4c-2 |
| Potongan dan Sisa (GAJ-L19) | `/gaji/[employeeId]/potongan?periode=…` (tab **Potongan**) | dari Gaji Seseorang | L4c-2 |

- **Kehilangan Barang:** daftar per periode, saring cabang dan status (Menunggu pengesahan, Berlaku, Dibatalkan). Klik baris → kartu pembagian (persen kantor, bobot, tiap orang: bobot, hari, bagian; kantor dalam tiga angka). Peringatan merah bila ada cabang tanpa persen kantor atau jabatan bertanda tanpa bobot. Langkah 4 Catat = pratinjau pembagian dari server, tombol Simpan ditahan.
- **Minus Kas › Dari POS:** per periode, kelompok per orang: tiap shift (tanggal tutup, cabang, nomor shift, selisih shift, porsi kas, bagian minus/plus), jumlah bersih, status usulan (Belum diusulkan / Menunggu tinjauan HR / Ditinjau / Disahkan / Ditiadakan sebagian). Shift tak wajar dan akun belum ditautkan tampil terpisah dengan tanda kuning. Tautan "Buka di laporan POS" (nomor shift).
- **Tautan Akun Kasir:** daftar akun POS yang punya kas tunai di shift terverifikasi, karyawan tertautnya, **usulan** otomatis dari tautan login L2d dan kemiripan nama (tidak pernah dipasang otomatis), tombol Tautkan / Lepas (alasan).
- **Pengesahan** usulan (kehilangan barang, minus kas POS, minus catat tangan, Potongan Lain) di **Kotak Persetujuan** (`/persetujuan/[id]`) yang sudah ada, dengan rincian khasnya.
- Semua rupiah memakai pemisah ribuan, pesan error di jendela "OK, paham", menu dan bagian baru diberi tanda **Baru**.

## 5. Hak

| Tindakan | HR | Admin HR | Finance | Karyawan | Pemilik, GM |
|---|---|---|---|---|---|
| Lihat Kehilangan Barang, Minus Kas, Potongan Lain, tab Potongan (`deduction.view`; orang ber-`salary_owner_only` tidak dikirim ke non-Pemilik/GM) | ✓ | — | ✓ minus kas saja | — | ✓ |
| `inventory_loss.record` (catat; HR = usulan) | ✓ | — | — | — | ✓ langsung |
| `cash_shortage.record_manual` (catat tangan; HR/Finance = usulan) | ✓ | — | ✓ | — | ✓ langsung |
| `cash_shortage.review` (tinjau usulan minus POS) | ✓ | — | — | — | ✓ |
| `pos_cashier_link.manage` (Tautan Akun Kasir) | ✓ | — | — | — | ✓ |
| `other_deduction.propose` (HR = usulan) | ✓ | — | — | — | ✓ langsung |
| `deduction.approve` (sahkan usulan, tiadakan shift, Batalkan, Ubah jadwal, Hapuskan sisa, putuskan keberatan) · ownerOnly · selfForbidden | — | — | — | — | ✓ |
| Ajukan keberatan atas potongan sendiri | ✓ | ✓ | ✓ | ✓ | — |
| Tanggungan Kehilangan, Jenis Potongan Lain: lihat / ubah | lihat | — | — | — | ubah (§9 butir 8) |

Penolakan server yang dites: HR mengesahkan; mengesahkan/memutuskan untuk dirinya sendiri; orang Pemilik/GM sebagai penanggung; kehilangan tanpa lampiran / tanpa persen kantor / jabatan bertanda tanpa bobot; minus tanpa nama tanpa orang hadir; satu akun POS ditautkan ke dua karyawan; keberatan lewat batas hari ke-3; keberatan atas kehilangan barang; Potongan Lain > 3 kali; Batalkan sesudah periode terkunci; Admin HR membuka daftar potongan.

## 6. Mesin terjadwal

| Mesin | Kapan | Isi |
|---|---|---|
| `cash-shortage-sync` | tiap hari 04.30 WIB (baris baru di `infra/apps/cron/crontab`) | salin bagian kasir dari view POS (idempoten); tanggal 26: buat usulan per orang untuk periode yang baru lewat, dan usulan susulan untuk baris yang terlambat terverifikasi |

Kehilangan barang, minus catat tangan, dan Potongan Lain tidak butuh mesin (dihitung saat dibaca).

## 7. Pemberitahuan

| Kapan | Ke siapa | Isi |
|---|---|---|
| Kehilangan barang Berlaku | tiap orang yang menanggung | "Ada kehilangan barang Rp1.000.000 di Toko Raja (opname 20 November). Bagian Anda Rp120.000, dipotong di slip periode November." |
| Minus kas POS disahkan | orangnya | jumlah bersih + jumlah shift + tombol **Ajukan keberatan** (3 hari) |
| Minus catat tangan Berlaku | penanggung (bernama: + tombol keberatan) | nominal dan alasan |
| Potongan Lain Berjalan | orangnya | jenis, nominal, alasan, jadwal + tombol keberatan |
| Keberatan diputuskan | orangnya | Tetap / Ditiadakan + alasan |
| Usulan menunggu | Pemilik/GM (kotak Persetujuan, angka di menu) | — |
| Pemilik/GM mencatat langsung, mengesahkan, membatalkan | pemilik lain (`announceToOwners`) | ringkas |

## 8. Tes

- **Unit** (`modules/payroll/rules/other-deductions`): pembagian kehilangan barang (contoh v3 Rp240.000/120.000/40.000/80.000 + kantor 520.000; jumlah selalu = nilai; pembulatan ke kantor; bobot hari terakhir; perbantuan tidak memindah); minus POS bersih per periode (minus 50.000, plus 20.000 → 30.000; plus saja → 0); shift tak wajar dan dalam toleransi tidak ikut; pembagian sama dengan laporan Minus Kasir (fungsi bersama); tanpa nama dibagi rata yang hadir; jadwal Potongan Lain (1–3 kali, sisa di cicilan terakhir); urutan pengambilan (contoh v3, bersih tidak < 0, sebagian terpotong); Pemilik/GM tanpa baris.
- **Integrasi DB** (tanggal lampau): catat kehilangan HR → usulan → sahkan → pemberitahuan per orang; view POS dari shift uji terverifikasi → `cash-shortage-sync` idempoten (dua kali jalan = sama) → usulan tanggal 26 → tinjau → sahkan dengan satu shift ditiadakan; akun belum ditautkan tidak dipotong lalu ditautkan; keberatan Tetap/Ditiadakan dan batas 3 hari; pagar hak (§5); pagar tanpa hapus.
- **View**: CI menjalankan semua aliran migrasi berurutan (PRD 01 §4), sehingga perubahan kolom `petshop` yang mematahkan view ketahuan.

## 9. Keputusan owner (2026-11-03: "ok saya setuju", semua sesuai saran)

1. **Dua kali tayang.** L4c berisi 8 layar v3 + Tautan Akun Kasir. **Saran: dua tahap** — L4c-1 (kehilangan barang + minus kas) lalu L4c-2 (Potongan Lain, keberatan, tab Potongan dan urutan), masing-masing diuji terpisah. Kasbon (L5), penyimpanan sisa potongan, dan slip terakhir (4E-5a) di luar L4c (§1).
2. **Ambang "periksa dulu"** (PRD 06 §5 ❓). **Saran: pakai pengaturan laporan POS Minus Kasir apa adanya** (toleransi Rp5.000, tak wajar ≥ Rp1.000.000, diubah Owner/GM di POS), supaya satu angka untuk dua aplikasi, bukan pengaturan HRIS sendiri.
3. **Minus dan plus.** Laporan POS menampilkan minus dan plus berdampingan. **Saran: di slip, plus menutup minus orang itu di periode yang sama, paling kecil Rp0** (PRD 06 §3.1 / GAJ-20); plus tidak pernah menjadi tambahan gaji.
4. **Tanggal kejadian minus POS.** **Saran: tanggal tutup shift** (PRD 06 §3.1). Laporan POS bulanan memakai tanggal buka; bedanya hanya untuk shift yang tutup lewat tengah malam di pergantian periode.
5. **Bentuk pengesahan minus POS.** **Saran: satu usulan per orang per periode** (rincian per shift) dibuat otomatis tanggal 26; HR meninjau, Pemilik/GM mengesahkan dan boleh meniadakan shift tertentu dengan alasan. Shift yang terlambat diverifikasi masuk usulan susulan.
6. **Tautan akun kasir.** Satu orang bisa punya beberapa akun POS (laporan POS menggabung per nama). **Saran: tautan dibuat HR di layar Tautan Akun Kasir** (sistem hanya mengusulkan dari tautan login dan kemiripan nama); minus akun yang belum ditautkan **menunggu** dan tidak hilang.
7. **Isi awal tanggungan.** **Saran:** tanda "ikut menanggung kehilangan barang" **Ya** untuk Kepala Toko, Kasir, Pramuniaga, Groomer, Kepala Gudang; Tidak untuk jabatan lain. Bobot: **Kepala Toko dan Kepala Gudang 2, lainnya 1** (pola contoh v3). **Persen kantor per cabang dikosongkan** dan diisi owner di layar sebelum kehilangan pertama dicatat (v3 GAJ bagian 6 butir 4). Kalau owner sudah punya angkanya, sebutkan per cabang.
8. **Siapa mengubah Tanggungan Kehilangan dan Jenis Potongan Lain.** **Saran: Pemilik/GM langsung, HR hanya melihat** (sama dengan Potongan & Lembur L4b); usulan HR untuk pengaturan umum menyusul.

## 10. Catatan untuk tahap berikutnya

- **4E-5a** wajib: menyimpan sisa potongan (R15) beserta jenis dan periode asal; slip terakhir (seluruh sisa Potongan Lain masuk; kelompok (a) tak tertampung "tidak tertagih"; (b), (c) menjadi Piutang Lain); denda berhenti tanpa pemberitahuan (GAJ-58); kehilangan/minus yang disahkan sesudah slip ditutup masuk slip berikutnya; keberatan Ditiadakan sesudah terpotong → koreksi plus.
- **Persiapan kode:** `origin/dev_hris` belum memuat laporan Minus Kasir (4 commit `origin/main` 1.107.104–107). Sebelum branch implementasi, `origin/main` digabung ke `dev_hris`. Pemindahan fungsi pembagian ke `packages/shared` menyentuh `apps/backoffice/lib/cashier-variance.ts` (impor saja, perilaku tetap; tesnya ikut pindah) dan perlu fragment backoffice.

## 11. Catatan implementasi L4c-1 (2026-11-03)

- **Pengesahan minus kas POS tidak lewat Mesin Pengajuan.** Mesin terjadwal tidak punya pengaju, padahal tiap pengajuan wajib punya pengaju manusia. Alurnya dibuat sendiri di layar Minus Kas (`cash_shortage_approvals`: Menunggu tinjauan HR → Ditinjau → Disahkan), dengan pemberitahuan ke orangnya dan ke pemilik lain. Pemilik/GM boleh mengesahkan tanpa menunggu tinjauan HR. Usulan kehilangan barang dan minus catat tangan oleh HR/Finance tetap lewat Mesin Pengajuan (jenis `inventory_loss`, `manual_cash_shortage`, diputuskan `deduction.approve`).
- **Usulkan sekarang**: HR bisa membuat usulan minus POS untuk periode berjalan satu orang (mis. berhenti di tengah periode). Baris yang datang sesudahnya masuk usulan susulan.
- **Shift POS mulai ditarik dari periode 26 September 2026** (`CASH_SHORTAGE_FROM`) supaya alur bisa diuji di staging dengan data nyata. **Sebelum produksi diganti** ke periode gaji HRIS pertama, supaya periode yang sudah dibayar di HRIS lama tidak ikut terusulkan.
- **Persen kantor isi pertama** boleh berlaku mulai awal periode berjalan (tidak ada nilai lama yang tertimpa); perubahan berikutnya tetap mulai tanggal 26 depan (`FIRST_FILL_KEYS` di modul settings).
- **Tanda dan bobot jabatan** tampil di Pengaturan Jabatan dan diubah Pemilik/GM langsung (`review: OWNER_DIRECT`, §9 butir 8); layar Tanggungan Kehilangan menampilkannya dan menautkan ke sana.
- **Fungsi pembagian Minus Kasir** disalin ke `packages/shared/src/utils/cashier-variance.ts` (BigInt, tanpa big.js) dengan kasus tes yang sama dengan POS (shift 212: Rp149.069 + Rp68.731). Backoffice belum dialihkan memakainya karena perubahan backoffice harus lewat branch dari `main` (aturan integrasi HRIS); sampai itu ada dua salinan yang dijaga tes kasus yang sama.
- **Angka POS berubah sesudah disahkan** tidak menimpa angka yang disahkan; barisnya diberi catatan untuk ditinjau ulang. Sebelum disahkan, baris diperbarui; shift yang kini dalam toleransi bertanda `TOLERATED` dan tidak dihitung.
- **Pembagian kehilangan barang dihitung saat dibaca** (pola L4b), dibekukan saat slip ditutup (4E-5a). Pemberitahuan kepada yang menanggung memakai angka saat berlaku.
- **Tes integrasi** yang membuat schema `petshop` palsu kini memuat `packages/hris-db/test-stubs/petshop-pos.sql` (tabel POS minimal untuk view 0018), termasuk satu baris di tes `modules/accounts` (di luar klaim, hanya penyiapan tes).
- **Tes**: unit 10 (`rules/losses.test.ts`) + 8 (`packages/shared`), integrasi DB 8 (`losses.integration.test.ts`); seluruh HRIS 398 lulus berurutan. Tes db-roles: 3 kegagalan lama (H18, dua kunci jawaban `hris-access`) tetap, tidak bertambah.
- Belum diuji orang di layar.
