# Spec HRIS L4f — Bayar Slip, Jadwal Bayar, Daftar Transfer, dan Ringkasan

Tanggal: 2026-11-03 · Status: **disetujui owner 2026-11-03; L4f-1 lolos uji owner di staging 2026-11-03 (deployment `0812b6ad`)** (§9 semua sesuai saran, "ok"; Sumber Uang isi awal "Brankas" tunai dan "Rekening Kantor" transfer)
Cakupan: bagian keenam L4 (Gaji Bulanan), yaitu 4E-5b di [PRD 06](../../hris_planning/PRD/fase_1/06-gaji-bulanan.md) (GAJ-L33 s.d. L38), dengan cara bayar disesuaikan PRD 06 §3.3: **HRIS menyimpan sendiri** tanggal bayar, pembayar, sumber uang, dan foto bukti. Belum ada app Keuangan, jadi belum ada Buku Kas.
Sumber: v3 `03-gaji` GAJ-41, 45, 46, 48, 49, 55, 56, 59, 89, 96, 98 s.d. 106; `gaji-bulanan-spec` §3.6 (Bayar, keputusan Y1 s.d. Y5, 13 Oktober 2026).
Dasar kode: L2f (Mesin Pengajuan, Pemberitahuan, `announceToOwners`, berkas terlindungi `files`), L2e (pengaturan bertanggal), L4a (`salary_owner_only`), L4d (`bonus_entries`, `fund_entries` hanya-tambah), L4e (`payslips`, `payslip_lines`, `payslip_steps`, `other_receivables`, buka kembali, slip terakhir).
Aliran migrasi: **`hris` 0024** (dan 0025 bila tahap 2, §9 butir 1). Modul: `apps/hris/modules/payroll` (lanjutan).

## 1. Batas

**Pokoknya (GAJ-48, 98):** slip yang sudah **Ditutup** menjadi **Dibayar** lewat satu langkah di server yang menyimpan tanggal uang, pembayar, sumber uang, dan nominal sekaligus. Satu slip dibayar **sekali dan penuh** sebesar bersihnya; tidak ada bayar sebagian dan tidak bisa dibayar dua kali. Yang menandai Dibayar hanya **Pemilik atau GM** (GAJ-45). Gaji di lapangan dibayar sesudah ACC lisan, dan menandai Dibayar sering terlupa (GAJ-59), jadi ada **Jadwal Bayar** dan pengingat harian sampai semua sudah ditandai.

**Dikerjakan** (§9 butir 1: dua kali tayang staging):

| Tahap | Isi |
|---|---|
| **L4f-1** | Status slip **Dibayar**, **Sumber Uang** (daftar di Pengaturan), **Bayar Slip** (satu atau banyak, 3 langkah), **tanggal uang**, foto bukti, **Batal bayar** (3 langkah), **slip bersih Rp0** langsung "Dibayar tanpa uang", periode **Lunas**, **Jadwal Bayar** + pengingat belum Dibayar, **Daftar Transfer** untuk Finance (+ unduh), buka kembali ditolak bila sudah Dibayar |
| **L4f-2** | **Bayar di luar slip** (bonus susulan dan koreksi plus untuk orang yang slip terakhirnya sudah Dibayar; dipotongkan ke Piutang Lain lebih dulu), **Ringkasan Gaji** (tab 5 halaman periode + bentuk Finance) |

**Tidak dikerjakan di L4f:**

| Hal | Di mana | Akibat sementara |
|---|---|---|
| Baris Buku Kas, saldo tempat uang, utang toko ke Gudang, tutup bulan (KEU-23, 24, 69, 106, 112) | app Keuangan (belum ada) | Pembayaran disimpan HRIS dengan uraiannya (§2), siap diteruskan kelak tanpa mengubah slip |
| Catatan Cepat "Gaji/Upah" dipasangkan ke slip (GAJ-101) | app Keuangan | Hanya tombol Bayar |
| Slip mingguan, Laporan Bongkaran di Jadwal Bayar | L7 driver & kenek | Jadwal Bayar hanya slip bulanan + bayar di luar slip |
| Pendapatan Saya, status bayar di portal karyawan, keberatan "uang belum saya terima" | 4E-5c | Karyawan hanya menerima pemberitahuan saat dibayar |

Tiap branch tetap membawa fragment `apps/hris/changelog.d` dan tanda Baru di `lib/new-features.ts`.

## 2. Data (`hris` 0024, 0025)

Pola L4e: yang disimpan hanya keputusan manusia; tanpa hapus (pemicu tolak `DELETE`).

| Tabel | Isi | Tahap |
|---|---|---|
| `payment_sources` (Sumber Uang) | nama, cara (`CASH` / `TRANSFER`), aktif, urutan. Tidak dihapus, hanya dinonaktifkan. Isi awal §9 butir 2 | L4f-1 |
| `payslips.status` + `PAID` | cek status diperluas: `ESTIMATE` / `CLOSED` / `PAID` | L4f-1 |
| `pay_batches` (kelompok bayar) | pembayar, sumber uang, tanggal uang, alasan tanggal (bila mundur > 7 hari), foto bukti (`files`, boleh kosong), jam catat (server), jumlah slip, jumlah rupiah | L4f-1 |
| `payslip_payments` | slip, kelompok bayar (kosong untuk "tanpa uang"), jenis (`MONEY` / `NO_MONEY`), nominal = bersih slip, tanggal uang, cara, pembayar, **uraian** (jsonb: cabang slip, kelompok gaji pemilik & GM ya/tidak, pendapatan, terpotong per kelompok, dana; bentuk yang kelak dibaca Keuangan, GAJ-56), status (`ACTIVE` / `CANCELLED`), dibatalkan oleh/kapan/alasan. **Unik satu `ACTIVE` per slip** (indeks sebagian) | L4f-1 |
| `payslip_steps.action` + `PAY`, `PAY_CANCEL`, `PAY_ZERO`, `TRANSFER_VIEW`, `TRANSFER_DOWNLOAD` | jejak bayar dan buka/unduh Daftar Transfer (GAJ-100) | L4f-1 |
| `off_slip_claims` (tagihan bayar di luar slip) | orang, **kunci asal** unik (mis. `bonus:123`, `corr:LATE@2026-10-26`), jenis (`BONUS` / `CORRECTION`), keterangan, cabang, nominal, dipotongkan ke piutang, sisa dibayar uang, status (`WAITING` / `PAID` / `CANCELLED`) | L4f-2 |
| `receivable_settlements` | Piutang Lain, tagihan asal, nominal, status (`ACTIVE` / `REVERSED`): cicilan piutang tanpa uang bergerak (Y5) | L4f-2 |
| `payslip_payments` + `claim_id` | pembayaran tagihan luar slip memakai tabel yang sama; cek: tepat satu dari `payslip_id` / `claim_id` | L4f-2 |

**Status periode** tetap dibaca dari slipnya (tidak disimpan): **Lunas** bila semua slip periode itu Dibayar.

## 3. Aturan

### 3.1 Langkah bayar (GAJ-48, 98; satu transaksi per slip)

1. Kunci slip (`FOR UPDATE`); periksa: penekan Pemilik/GM; **bukan slipnya sendiri, kecuali GM** (para pemilik diberi tahu); status Ditutup; belum ada pembayaran `ACTIVE`; bersih > Rp0; sumber uang aktif. Dua penekan bersamaan: yang kedua menerima "Sudah dibayar oleh [nama] pukul [jam]".
2. **Tanggal uang** (GAJ-99, §9 butir 4): isian awal hari ini; boleh mundur sampai 7 hari, lebih jauh wajib alasan; tidak sebelum tanggal slip ditutup dan tidak masa depan. Jam catat selalu dari server.
3. Simpan `payslip_payments` (nominal = bersih tersimpan, tidak diketik; cara mengikuti sumber uang) dan uraiannya.
4. Slip → `PAID`; jejak `PAY`.
5. Pemberitahuan ke orangnya: "Gaji periode [nama] Rp… dibayar tanggal … lewat tunai/transfer."
- **Banyak slip sekaligus** dari satu sumber uang dan satu tanggal: satu `pay_batches`, lalu **tiap slip satu transaksi tersendiri**; yang gagal tidak membatalkan yang lain. Hasil: berapa dibayar, siapa gagal + sebabnya.
- Tidak ditolak karena saldo (HRIS tidak menyimpan saldo). Boleh dibayar **sebelum** tanggal bayar (mis. slip terakhir yang ditutup lebih cepat).

### 3.2 Slip bersih Rp0 (GAJ-102)

Saat ditutup, slip yang bersihnya Rp0 **langsung Dibayar tanpa uang** (`payslip_payments` jenis `NO_MONEY`, tanpa kelompok, jejak `PAY_ZERO`), tidak masuk Jadwal Bayar dan tidak memicu pengingat. Buka kembali slip itu membatalkan pembayaran tanpa uangnya dalam langkah yang sama. Slip Rp0 yang sudah Ditutup sebelum L4f (data uji staging) dibereskan migrasi 0024 dengan cara yang sama.

### 3.3 Batal bayar (GAJ-49, 103)

- Pemilik/GM, alasan ≥ 15 huruf, tombol ditahan 3 detik; tidak untuk slipnya sendiri kecuali GM; para pemilik diberi tahu. HR dan Finance tidak bisa.
- Kapan pun selama pembayaran `ACTIVE` (tidak mengubah isi slip, jadi tidak terhalang slip berikutnya).
- Satu transaksi: pembayaran → `CANCELLED` (tidak dihapus), slip kembali `CLOSED` dan muncul lagi di Jadwal Bayar, jejak `PAY_CANCEL`, orangnya diberi tahu "Pembayaran gaji periode … dibatalkan: [alasan]". Lalu dibayar ulang, atau dibuka kembali.
- Pembayaran tanpa uang (Rp0) tidak dibatalkan lewat layar ini; ikut buka kembali (§3.2).

### 3.4 Buka kembali sesudah L4f

Buka kembali (L4e-2) **ditolak bila slip Dibayar** dengan uang: "Batalkan pembayarannya dulu." Slip berikutnya yang sudah ditutup tetap menolak buka kembali seperti L4e-2.

### 3.5 Jadwal Bayar dan pengingat (GAJ-59, 104)

- **Jatuh bayar** = tanggal bayar periode (pengaturan bertanggal baru `payroll.pay_day`, isi awal **tanggal 1** bulan sesudah periode berakhir, GAJ-41), atau tanggal slip ditutup bila lebih lambat. Tanggal bayar tidak digeser untuk Minggu atau tanggal merah.
- Daftar: slip Ditutup belum Dibayar (dan tagihan luar slip, L4f-2), berkelompok **Lewat** (berapa hari), **Hari ini**, **7 hari ke depan**, **Belum jatuh**, ditambah keterangan "n slip belum bisa dibayar: masih Perkiraan/tertahan" menuju halaman periode. Slip Rp0 tidak tampil.
- **Pengingat**: mulai **07.00 hari sesudah jatuh bayar**, setiap hari, satu pemberitahuan per periode ke Pemilik dan GM ("Ada 38 slip periode Oktober belum ditandai Dibayar, sejak 1 Desember") sampai semua Dibayar.
- **Uji di staging** (§9 butir 6): mode uji (penanda staging `AUTH_COOKIE_ENV=staging`, sama dengan L4e) menganggap jatuh bayar = tanggal slip ditutup, supaya Jadwal Bayar dan pengingat bisa dicoba esok harinya.

### 3.6 Daftar Transfer (GAJ-100; §9 butir 7)

Per periode, hanya slip **Ditutup belum Dibayar**: nama, bank, nomor rekening lengkap, nama pemilik rekening, bersih; jumlah; diurutkan per bank. Tanpa rincian slip, tanpa slip yang sudah Dibayar, dan **tanpa jabatan bertanda "gaji hanya Pemilik/GM"** (`salary_owner_only`). Orang tanpa rekening bertanda "Belum ada rekening: bayar tunai atau lengkapi rekening". **Unduh CSV** (dibuat server, nama berkas bertanggal, baris pertama menyebut pembuat). Tiap buka dan unduh dicatat. Tidak ada tombol Bayar di layar ini; Finance tidak menandai Dibayar.

### 3.7 L4f-2: Bayar di luar slip (GAJ-89, 96, 106)

- Hanya untuk orang yang **slip terakhirnya sudah Dibayar** dan tidak punya slip berikutnya. (Bila slip terakhir masih Ditutup belum Dibayar, jalannya tetap buka kembali seperti L4e-2.)
- **Lahir otomatis** (mesin harian + saat bonus disahkan) satu tagihan per asal: (a) bonus Disahkan yang belum masuk slip; (b) koreksi plus: Koreksi Periode Lalu dan pengembalian (L4e-2) dihitung untuk slip terakhir yang sudah Dibayar. Koreksi **minus** menjadi Piutang Lain (L4e-2), bukan tagihan.
- **Dipotongkan ke Piutang Lain lebih dulu** (Y5): bila orang itu punya Piutang Lain `OPEN`, nominal tagihan lebih dulu mengurangi piutang (`receivable_settlements`, tanpa uang bergerak); piutang yang habis tampil Lunas. Bila tagihan habis terpakai, tagihan langsung Dibayar bertanda "dipotongkan ke piutang".
- **Bayar** sisanya: Pemilik/GM, sumber uang, tanggal uang, foto bukti, tahan 3 detik; satu transaksi: tagihan `PAID`, bonus → status baru **Dibayar di luar slip** (`PAID_OUTSIDE`), bonus bersumber Dana Disiplin menulis mutasi keluar dana saat ini (cabang bonus).
- **Batal bayar** membalik semuanya: cicilan piutang `REVERSED`, mutasi dana dibalik dengan baris baru (L4d hanya-tambah), bonus kembali Disahkan, tagihan kembali `WAITING`.
- Orang yang berhenti tanpa pemberitahuan (GAJ-58) tidak pernah punya tagihan bonus (bonusnya sudah Hangus di L4e-2).

### 3.8 L4f-2: Ringkasan Gaji (GAJ-55, 105)

Satu fungsi server `payrollSummary(periode, sudutPandang)` membaca **baris slip tersimpan dan pembayarannya**, tidak menghitung ulang; slip Perkiraan hanya disebut jumlah orangnya.

1. Jumlah slip per status (Perkiraan, Tertahan, Ditutup, Dibayar).
2. Pendapatan per jenis: gaji tetap, lembur, kompensasi libur, bonus per jenis dan sumber dana, koreksi plus.
3. Terpotong per kelompok (a) s.d. (d), ditambah sisa dibawa, Piutang Lain yang lahir, tidak tertagih.
4. Dana: Dana Disiplin dan Dana Tidak Hadir masuk/keluar dari slip periode ini.
5. Bersih: jumlah, sudah dibayar per sumber uang, belum dibayar, tanpa uang. Selalu: pendapatan − terpotong = bersih = dibayar + belum dibayar + Rp0.
6. Per cabang (cabang tersimpan di slip), dengan baris terpisah **"Gaji Pemilik dan GM"**.

| Yang membuka | Isi |
|---|---|
| Pemilik, GM | Semua butir |
| HR | Semua butir; jabatan bertanda tidak ikut dan tidak disebut |
| Finance | Butir 1, 2, 3, 5 **seluruh perusahaan saja** (tanpa per cabang), tanpa jabatan bertanda, dengan keterangan "tidak termasuk gaji Pemilik dan GM"; tanpa butir 4 |
| Admin HR | Tidak ada |

## 4. Layar

| Layar | Alamat | Menu | Tahap |
|---|---|---|---|
| Jadwal Bayar (GAJ-L33): kepala tiga angka (Lewat, Hari ini, 7 hari ke depan; jumlah + rupiah), kelompok per periode yang bisa dibuka jadi baris per orang (nama, cabang, bersih, rekening 4 angka terakhir, "Belum ada rekening"), centang per baris/kelompok → **Bayar terpilih (n, Rp…)**. Finance: satu baris jumlah per periode tanpa nama + tombol Daftar Transfer. Terbaca di HP | `/gaji/jadwal-bayar` | **Kantor › Gaji › Jadwal Bayar** | L4f-1 |
| Bayar Slip (GAJ-L34, 3 langkah): yang dibayar (yang tidak ikut terpisah + sebabnya) → sumber uang, tanggal uang, foto bukti → ringkasan kalimat + tahan 3 detik → hasil | `/gaji/bayar?slip=…` | dari Jadwal Bayar / Slip | L4f-1 |
| Batal Bayar (GAJ-L35, 3 langkah): pembayaran → alasan + akibat → tahan 3 detik | `/gaji/slip/[id]/batal-bayar` | dari Slip | L4f-1 |
| Daftar Transfer (GAJ-L36) + Unduh CSV | `/gaji/periode/[awal]/transfer` | dari Jadwal Bayar | L4f-1 |
| Sumber Uang: daftar, tambah, ubah nama/cara, nonaktifkan | `/pengaturan/sumber-uang` | **Pengaturan › Sumber Uang** | L4f-1 |
| Tambahan di Slip (GAJ-L29): kotak **Pembayaran** (tanggal uang, sumber, pembayar, bukti, riwayat batal), tombol **Bayar** / **Batal bayar**; tanda **Dibayar** / **Lunas** di halaman periode dan daftar periode; saring status Dibayar | `/gaji/slip/[id]`, `/gaji/periode…` | — | L4f-1 |
| Bayar di Luar Slip (GAJ-L37, 3 langkah): tagihan + piutang yang dipotongkan + sisa → sumber/tanggal/bukti (dilewati bila sisa Rp0) → tahan 3 detik | `/gaji/luar-slip/[id]/bayar` | dari Jadwal Bayar / Piutang Lain | L4f-2 |
| Ringkasan Gaji (GAJ-L38): tab **Ringkasan** di halaman periode; Finance membuka bentuk Finance dari daftar periode | `/gaji/periode/[awal]?tab=ringkasan`, `/gaji/periode/[awal]/ringkasan` | — | L4f-2 |

## 5. Hak

| Tindakan | HR | Admin HR | Finance | Karyawan | Pemilik, GM |
|---|---|---|---|---|---|
| `payslip.pay` (Bayar, Bayar di luar slip) · ownerOnly | — | — | — | — | ✓ (GM juga slip sendiri) |
| `payslip.cancel_payment` · ownerOnly | — | — | — | — | ✓ |
| `pay_schedule.view` (Jadwal Bayar) | — | — | jumlah per periode tanpa nama | — | ✓ |
| `transfer_list.view` (Daftar Transfer + unduh) | — | — | ✓ | — | ✓ |
| `payment_sources.manage` · ownerOnly | — | — | — | — | ✓ |
| `payroll_summary.view` (L4f-2) | ✓ tanpa jabatan bertanda | — | bentuk Finance | — | ✓ |

Penolakan server yang dites: HR/Finance membayar; Pemilik membayar slipnya sendiri; membayar slip Perkiraan; membayar dua kali (termasuk bersamaan); tanggal uang masa depan / sebelum ditutup / mundur > 7 hari tanpa alasan; batal bayar tanpa alasan; buka kembali slip Dibayar; Finance melihat slip jabatan bertanda di Daftar Transfer; (L4f-2) Finance melihat Ringkasan per cabang.

## 6. Mesin terjadwal

| Mesin | Kapan | Isi |
|---|---|---|
| `payslip-pay-reminder` | tiap hari 07.00 WIB | per periode yang punya slip Ditutup lewat jatuh bayar: pemberitahuan ke Pemilik dan GM |
| `off-slip-claims` (L4f-2) | tiap hari 05.05 WIB | lahirkan tagihan luar slip yang belum ada (idempoten, kunci asal) |

## 7. Pemberitahuan

| Kapan | Ke siapa | Isi |
|---|---|---|
| Slip dibayar / tagihan luar slip dibayar | orangnya | periode, nominal, tanggal, tunai/transfer |
| Pembayaran dibatalkan | orangnya + pemilik lain | alasan |
| GM membayar slipnya sendiri | pemilik lain | ringkas |
| Pengingat belum Dibayar | Pemilik, GM | jumlah slip, sejak kapan |
| (L4f-2) Tagihan luar slip lahir | Pemilik, GM | orang, asal, sisa dibayar uang |

## 8. Tes

- **Unit** (`rules/payment`): batas tanggal uang (7 hari, alasan, sebelum ditutup, masa depan); jatuh bayar (tanggal 1 / tanggal ditutup bila lebih lambat / mode uji); pengelompokan Jadwal Bayar; urutan bank Daftar Transfer + isi CSV; (L4f-2) potong piutang lebih dulu (habis, sisa, beberapa piutang); persamaan Ringkasan pendapatan − terpotong = bersih = dibayar + belum + Rp0.
- **Integrasi DB** (tanggal lampau): bayar banyak dengan satu gagal; bayar bersamaan dua kali → satu berhasil; batal bayar → Ditutup lagi dan bisa dibayar ulang; slip Rp0 langsung Dibayar tanpa uang dan buka kembali membaliknya; buka kembali slip Dibayar ditolak; periode Lunas; Daftar Transfer tanpa jabatan bertanda + jejak buka/unduh; pagar hak §5; (L4f-2) tagihan bonus susulan lahir sekali, dipotongkan ke piutang, dibayar, dibatalkan → semua kembali; Ringkasan Finance tanpa cabang dan tanpa jabatan bertanda.

## 9. Keputusan owner (2026-11-03: "ok", semua sesuai saran)

1. **Dua kali tayang.** **Saran: L4f-1** (Bayar, Batal bayar, slip Rp0, Sumber Uang, Jadwal Bayar + pengingat, Daftar Transfer) lalu **L4f-2** (Bayar di luar slip, Ringkasan), masing-masing diuji terpisah.
2. **Daftar Sumber Uang.** PRD §5 masih terbuka. **Saran:** daftar sendiri di **Pengaturan › Sumber Uang** yang diubah Pemilik/GM kapan saja; isi awal **sesuai jawaban owner**, atau bila belum ada: "Brankas" (tunai) dan "Rekening Kantor" (transfer).
3. **Tanpa Buku Kas.** **Saran:** sesuai PRD §3.3, HRIS menyimpan sendiri pembayaran beserta uraiannya (cabang, pendapatan, potongan per kelompok, dana) supaya kelak bisa diteruskan ke app Keuangan; Catatan Cepat (GAJ-101) tidak dibuat.
4. **Tanggal uang.** **Saran: ikuti v3** (Y1): boleh mundur sampai 7 hari, lebih jauh wajib alasan; tidak sebelum slip ditutup, tidak masa depan; jam catat selalu server.
5. **Foto bukti.** **Saran: dianjurkan, tidak wajib**; satu foto boleh untuk satu kelompok bayar (mis. tangkapan layar transfer massal). Pembayaran tanpa bukti bertanda "tanpa bukti" di slip.
6. **Tanggal bayar dan pengingat.** **Saran:** tanggal bayar = **tanggal 1** sesudah periode berakhir (pengaturan bertanggal), pengingat harian 07.00 mulai hari sesudahnya. Di **staging saja**, mode uji menganggap jatuh bayar = hari slip ditutup supaya bisa diuji sebelum 1 Desember.
7. **Unduhan Daftar Transfer.** **Saran: CSV** (bisa dibuka Excel), tanpa menambah pustaka Excel baru ke HRIS.
8. **Siapa melihat apa.** **Saran: ikuti v3:** Bayar dan Batal bayar hanya Pemilik/GM (GM boleh slipnya sendiri, pemilik lain diberi tahu; Pemilik tidak membayar slipnya sendiri); Finance melihat Daftar Transfer dan jumlah per periode di Jadwal Bayar, Ringkasan hanya total perusahaan tanpa per cabang dan tanpa gaji Pemilik/GM; HR melihat Ringkasan tanpa jabatan bertanda tetapi tidak membuka Jadwal Bayar; bayar di luar slip dipotongkan ke Piutang Lain lebih dulu (Y5).

## 10. Catatan untuk tahap berikutnya

- **4E-5c:** Pendapatan Saya / Slip Saya menampilkan status Dibayar, tanggal uang, dan cara bayar dari `payslip_payments`; keberatan "uang belum saya terima".
- **App Keuangan (kelak):** membaca `payslip_payments.uraian` dan `payrollSummary`; tidak menghitung sendiri (GAJ-56).
- **Sebelum produksi:** mode uji jatuh bayar (penanda staging) tidak diisi; `PAYSLIP_FROM`, `CASH_SHORTAGE_FROM`, `BONUS_FROM` diganti ke periode gaji HRIS pertama (catatan L4e).

## 11. Catatan implementasi L4f-1 (2026-11-03)

- **Status Dibayar tidak disimpan di `payslips.status`** (beda dari §2): status slip tetap `CLOSED`; "Dibayar" = ada `payslip_payments` berstatus `ACTIVE` (indeks unik sebagian satu per slip). Dengan begitu semua pagar "slip sudah ditutup" L4e (kunci per orang, sumber yang sudah masuk slip, Koreksi Periode Lalu) tetap berlaku tanpa diubah. Status periode **Lunas** dibaca dari pembayaran.
- **Kelompok bayar** (`pay_batches`) dibuat saat slip pertama dari satu kali tekan berhasil dibayar, dalam transaksi slip itu; tiap slip tetap satu transaksi tersendiri. Dua penekan bersamaan: yang kedua menunggu kunci slip lalu menerima "Sudah dibayar oleh … pukul …"; indeks unik menjadi pengaman terakhir.
- **Uraian** per pembayaran (`breakdown`): nomor, versi, cabang dan jabatan tersimpan, tanda gaji Pemilik/GM, pendapatan per jenis baris, terpotong per kelompok, mutasi dana slip. Dibaca dari baris slip tersimpan.
- **Slip Rp0**: langkah tutup menulis pembayaran `NO_MONEY` + jejak `PAY_ZERO`; buka kembali membatalkannya dalam transaksi yang sama. Migrasi 0024 membereskan slip Rp0 yang sudah Ditutup sebelumnya (tanpa jejak `PAY_ZERO`).
- **Buka kembali** ditolak selama ada pembayaran uang yang berlaku ("Batalkan pembayarannya dulu").
- **Jadwal Bayar**: jatuh bayar = `payroll.pay_day` (pengaturan bertanggal baru, isi awal 1) sesudah periode berakhir, atau tanggal slip ditutup bila lebih lambat; mode uji staging (`AUTH_COOKIE_ENV=staging`) = tanggal ditutup. Finance melihat jumlah per periode tanpa nama dan tanpa jabatan bertanda; HR tidak membuka layar ini. Baris slip sendiri (Pemilik) tidak bisa dicentang.
- **Daftar Transfer**: tanpa jabatan bertanda untuk siapa pun (termasuk Pemilik/GM), urut per bank; CSV bertitik koma dengan baris `sep=;` dan BOM, nomor rekening ditulis `="…"`. Buka (`TRANSFER_VIEW`) dan unduh (`TRANSFER_DOWNLOAD`) dicatat di Riwayat periode. Rekening dibaca lewat `bankAccountsOf` modul employees.
- **Hak awal** (migrasi 0024): Finance `pay_schedule.view` + `transfer_list.view`. `payslip.pay`, `payslip.cancel_payment`, `payment_sources.manage` ownerOnly (Pemilik/GM).
- **Mesin** `payslip-pay-reminder` 07.00 WIB (crontab `0 0 * * *`), ke semua jabatan full access; satu pemberitahuan per periode.
- **Tes**: unit 10 (`rules/payment.test.ts`), integrasi DB 7 (`payment.integration.test.ts`: hak, tanggal uang, bayar banyak + bersamaan, batal + bayar ulang, buka kembali ditolak, Rp0, Jadwal Bayar/Daftar Transfer Finance, Lunas); Gaji, akses, pengaturan, shared, lib 218 lulus berurutan; `check:candidate` lulus.
- Lolos uji owner di staging 2026-11-03 (deployment `0812b6ad`, run `41604116879`; owner: "sudah saya test dan aman").

## 12. Catatan implementasi L4f-2 (2026-11-03)

- **Tagihan** (`off_slip_claims`) lahir untuk orang yang slip **terakhirnya** (`last_slip`) adalah slip terbarunya, Ditutup, dan punya pembayaran berlaku (uang atau Rp0 tanpa uang). Asal (a): bonus Disahkan bernilai positif, kunci `bonus:<id>`. Asal (b): baris pendapatan `pastAdjustments` untuk periode sesudah slip terakhir (Koreksi Periode Lalu plus dan pengembalian), kunci `<sumber>#<urut>`; nominal = selisih yang belum tertagih, tagihan Menunggu yang tidak cocok lagi dibatalkan lalu dibuat ulang (`correctionPlan`). Koreksi **minus** dan koreksi bonus minus sesudah slip terakhir belum dibuat menjadi Piutang Lain (belum ada slip untuk menampungnya); dicatat untuk tahap berikutnya.
- **Kapan lahir:** sesudah Sahkan grooming dan Bonus Bebas langsung, saat Pemilik/GM membuka Jadwal Bayar, dan mesin `off-slip-claims` 05.05 WIB (crontab `5 22 * * *`). Usulan HR Bonus Bebas yang disahkan lewat Persetujuan tertangkap saat Jadwal Bayar dibuka atau mesin harian. Satu kunci per orang (`pg_advisory_xact_lock`).
- **Potong Piutang Lain lebih dulu dikerjakan saat Bayar** (bukan saat lahir), dalam transaksi bayar: `receivable_settlements` per piutang, paling lama lebih dulu; piutang yang habis → status baru `SETTLED` (Lunas). Bila sisa uang Rp0, pembayaran dicatat `NO_MONEY` (langkah sumber uang dilewati). Tagihan tetap menunggu Pemilik/GM menekan Bayar supaya ada penanggung jawab.
- **Pembayaran** memakai `payslip_payments` dengan `claim_id` (tepat satu dari `payslip_id`/`claim_id`), uraian `breakdown` berisi tagihan, potong piutang, uang, dana. Tanggal uang tidak sebelum tanggal tagihan lahir.
- **Dana:** mutasi dihitung `fundMovements` dari baris semu tagihan (bonus Dana Disiplin keluar; koreksi telat/denda/alpha/lembur mengikuti dananya), jenis buku dana baru `OFF_SLIP` + `claim_id`. Batal bayar menulis baris lawan.
- **Bonus** status baru `PAID_OUTSIDE` (Dibayar di luar slip); final untuk sinkron kasir, tidak bisa dibatalkan.
- **Buka kembali slip terakhir** ditolak bila ada tagihan `PAID`; tagihan Menunggu dibatalkan dalam transaksi buka kembali. Bila pembayaran slip terakhir dibatalkan, tagihan Menunggu dibatalkan otomatis saat sinkron berikutnya.
- **Ringkasan** `payrollSummary` membaca baris slip versi berlaku + pembayaran + mutasi dana slip; tertahan hanya dihitung di tab halaman periode (Finance melihat "Perkiraan atau tertahan"). Hak `payroll_summary.view` (migrasi 0025: HR, Finance). Finance: tanpa per cabang, tanpa dana, tanpa jabatan bertanda.
- **Layar:** `/gaji/luar-slip/[id]/bayar`, `/gaji/luar-slip/[id]/batal-bayar`, kartu "Bayar di luar slip" di `/gaji/jadwal-bayar`, tab Ringkasan `/gaji/periode/[awal]?tab=ringkasan`, `/gaji/periode/[awal]/ringkasan` (Finance), kolom potong di `/gaji/piutang`.
- **Tes:** unit 11 (`rules/off-slip.test.ts`), integrasi DB 3 (`off-slip.integration.test.ts`); Gaji, akses, lib 200 lulus berurutan.
