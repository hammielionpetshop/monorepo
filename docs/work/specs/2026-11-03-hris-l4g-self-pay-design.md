# Spec HRIS L4g — Pendapatan Saya, Slip Saya, Keberatan Slip, dan Total Diterima

Tanggal: 2026-11-03 · Status: **DRAF, menunggu persetujuan owner** (§9)
Cakupan: bagian ketujuh (terakhir) L4 Gaji Bulanan, yaitu **4E-5c** di [PRD 06](../../hris_planning/PRD/fase_1/06-gaji-bulanan.md) (GAJ-L39 s.d. L43, status "Masuk").
Sumber: v3 `03-gaji` GAJ-42, 44, 46, 54, 60, 63, 72, 93, 95, 97, 102, 103, 106, **107 s.d. 114**; `gaji-bulanan-spec` §3.7 (Sisi Karyawan, keputusan C1 s.d. C5, disetujui 14 Oktober 2026).
Dasar kode: L2f (Mesin Pengajuan, Pemberitahuan, Beranda "perlu perhatian"), L3g (Perlu Dijelaskan), L4a (paket gaji, `salary_owner_only`), L4c (Keberatan Potongan), L4e (`computeSlip`, `payslip_lines`, penahan slip, buka kembali, Koreksi Periode Lalu, Piutang Lain), L4f (`payslip_payments`, Batal bayar, bayar di luar slip).
Aliran migrasi: **`hris` 0026** (L4g-1), **0027** (L4g-2), **0028** (L4g-3, hanya hak). Modul: `apps/hris/modules/payroll` (lanjutan).

## 1. Batas

**Pokoknya (GAJ-107):** karyawan melihat semua uangnya di **satu halaman** tanpa bertanya ke HR: berapa perkiraannya, apa yang bisa membuatnya mundur, slip yang sudah ditutup baris demi baris, kapan dan lewat apa dibayar, dan satu jalan bila ada yang salah. **Angka karyawan dan angka kantor tidak pernah berbeda:** Perkiraan dari `computeSlip` yang sama, slip tertutup dari `payslip_lines` tersimpan (GAJ-91).

**Dikerjakan** (§9 butir 1: tiga kali tayang staging):

| Tahap | Isi |
|---|---|
| **L4g-1** Sisi lihat | **Pendapatan Saya** (pemilih periode, kepala tiga angka, tab Ringkasan/Upah/Bonus/Potongan/Hitungan), **Slip Saya** (semua keadaan slip + status bayar), **peringatan "gaji bisa mundur"** (kotak di Pendapatan Saya + kartu Beranda), **Unduh slip** (satu / sampai 12 periode), tautan dari pemberitahuan "Slip ditutup" dan "Gaji dibayar" |
| **L4g-2** Keberatan | Jenis pengajuan **Keberatan slip** dua macam ("Ada yang salah", "Uang belum saya terima"), **Putuskan** (Tolak / Setujui + jalan pembetulan), **Tautkan pembetulan** + pengingat berantai, **Pembetulan gaji periode lalu** (Pemilik/GM), sisa L4f-2: koreksi minus sesudah slip terakhir → Piutang Lain (§9 butir 8) |
| **L4g-3** Mantan & laporan | **Akses terbatas mantan karyawan** selama "masih punya urusan uang", **Total Diterima per Orang** (Pemilik/GM; HR tanpa jabatan bertanda) + unduh |

**Tidak dikerjakan di L4g:**

| Hal | Di mana | Akibat sementara |
|---|---|---|
| Slip mingguan, bongkaran, Buku Upah, ritase (DRV-03, 28, 84) | L7 driver & kenek | Pendapatan Saya dan Total Diterima hanya slip bulanan + bayar di luar slip; kolom mingguan/bongkaran sudah disiapkan bentuknya, isinya "—" (§9 butir 2) |
| Pekerja lepas tanpa akun (DRV-45) | L7 | Belum ada orangnya |
| Buku Kas / app Keuangan | app Keuangan | tetap seperti L4f |

Tiap branch tetap membawa fragment `apps/hris/changelog.d` dan tanda Baru di `lib/new-features.ts`.

## 2. Data

Pola L4e/L4f: yang disimpan hanya keputusan manusia; tanpa hapus.

| Perubahan | Isi | Tahap |
|---|---|---|
| `payslip_payments.account_tail` | 4 angka terakhir rekening **saat dibayar** (transfer saja), supaya karyawan melihat rekening yang benar walau rekeningnya diganti kemudian. Baris lama diisi dari data karyawan sekarang (§9 butir 4) | 0026 |
| `payslip_steps.action` + `SELF_DOWNLOAD`, `SELF_DOWNLOAD_MANY` | jejak unduhan oleh orangnya (GAJ-113) | 0026 |
| `payslip_objections` (keberatan_slip) | pengajuan (Mesin Pengajuan), slip, versi saat diajukan, macam (`WRONG` / `NOT_RECEIVED`), baris yang dikeberati (jsonb id baris; kosong = Lainnya), pembayaran (macam kedua), jalan pembetulan (`SOURCE` / `REOPEN` / `PAST_CORRECTION` / `SALARY_CORRECTION` / `CANCEL_PAYMENT`), pembetulan tertaut (jenis + id), status pembetulan (`NONE` / `WAITING_FIX` / `FIXED`), ditautkan oleh/kapan. **Unik satu Menunggu per slip per macam** (indeks sebagian dengan status pengajuan) | 0027 |
| jenis pengajuan `payslip_objection` | baris di daftar jenis + handler di `lib/request-handlers.ts` | 0027 |
| `salary_changes.origin` + `CORRECTION`, kolom `objection_id` | Pembetulan gaji periode lalu (GAJ-112); boleh bertanggal periode yang slipnya sudah ditutup hanya untuk asal ini | 0027 |
| `other_receivables.origin` + `PAST_CORRECTION` | koreksi minus sesudah slip terakhir yang tidak punya slip berikutnya (§9 butir 8) | 0027 |
| hak `payroll_totals.view` | Total Diterima per Orang; HR diberi lewat migrasi | 0028 |

Tanpa tabel baru untuk akses mantan karyawan dan Total Diterima: keduanya fungsi baca (GAJ-113, 114).

## 3. Aturan

### 3.1 Pendapatan Saya (GAJ-107; L4g-1)

- **Satu halaman per periode 26–25.** Periode berjalan tampil lebih dulu; periode lama dipilih dari daftar (hanya periode yang punya slip orang itu), dimuat saat diminta.
- **Kepala tiga angka:** **Pendapatan periode ini** (bersih slip + bayar di luar slip periode itu; bertanda "perkiraan" selama slip masih Perkiraan), **Sudah diterima** (slip Dibayar + tagihan luar slip Dibayar), **Belum diterima** (sisanya, dengan jatuh bayar dari L4f).
- **Tab** (selalu tampil semua supaya letaknya tidak berpindah; yang kosong: "Belum ada [isi] di periode ini."):
  1. **Ringkasan:** satu kartu per slip (periode, keadaan, bersih, status bayar) + kartu tagihan bayar di luar slip. Ketuk kartu slip → Slip Saya.
  2. **Upah:** baris per tanggal kejadian yang sudah ada di HRIS: lembur yang disahkan, bonus. Gaji tetap: satu baris "Gaji tetap (perkiraan)" selama Perkiraan, baris tersimpan sesudah ditutup. Ritase/bongkaran menyusul L7 (§9 butir 2).
  3. **Bonus:** tab Bonus L4d bentuk karyawan (hanya miliknya, tanpa nama orang lain).
  4. **Potongan:** tab Potongan L4c bentuk karyawan. Baris minus kas catat tangan dan Potongan Lain membawa tombol **Ajukan keberatan** selama masa keberatannya (tautan ke Keberatan Potongan yang sudah ada).
  5. **Hitungan:** Hitungan Kehadiran L4b bentuk karyawan, **tanpa "dalam toleransi"** (KEH-119). Tidak tampil untuk GM (tidak diabsen, KAR-67).
- **Siapa:** orang yang **punya slip atau paket gaji** (§9 butir 3). Menu tidak tampil bagi yang tidak punya; server menolak.
- Semua angka dibaca dari server dengan hak "dirinya": orangnya tidak bisa membuka Pendapatan Saya orang lain lewat alamat.

### 3.2 Peringatan "gaji bisa mundur" (GAJ-108; L4g-1)

- Satu fungsi server **`myPayIssues(orang, periode)`** = penahan slip yang sudah ada (`holdsOf`, GAJ-93) + kejadian Perlu Dijelaskan yang belum diisi (L3g). Dipakai Pendapatan Saya, Slip Saya, dan kartu Beranda.
- Satu baris per urusan dengan **siapa yang harus bertindak**: **Anda** (mis. "3 hari belum dijelaskan (12, 14, 18 November)" + tombol **Isi sekarang** ke `/perlu-dijelaskan`) atau **Kantor** (mis. "Penjelasan 12 November menunggu keputusan HR"; tanpa tombol).
- **Kalimat akibat** menurut tanggal: sebelum periode berakhir "Selesaikan sebelum tanggal 25 supaya gaji tidak tertahan"; sesudah periode berakhir dan slip tertahan "Gaji Anda tertahan sampai urusan ini selesai. Slip orang lain tetap dibayar."
- Penahan slip terakhir (bonus Menunggu/Ditahan) tampil hanya **"Menunggu keputusan kantor"**, tanpa isinya.
- Tidak bisa ditutup/disembunyikan; hilang sendiri saat selesai; tidak tampil untuk slip yang sudah ditutup.

### 3.3 Slip Saya dan status bayar (GAJ-109; L4g-1)

| Keadaan | Yang tampil |
|---|---|
| **Perkiraan** | Bentuk slip yang sama (`slip-document`), dihitung saat dibuka, tanpa nomor, tanda besar **"Perkiraan, belum final: angka bisa berubah sampai slip ditutup"**. Tidak bisa diunduh |
| **Tertahan** | Sama + kotak peringatan §3.2 |
| **Ditutup** | Slip dari baris tersimpan, nomor, versi; "Keberatan sampai [tanggal] 23.59" (mulai L4g-2); **Unduh PDF** |
| **Ditutup, lewat jatuh bayar** | "Belum ditandai dibayar. Jatuh bayar [tanggal]." |
| **Dibayar** | "Dibayar [tanggal uang] lewat tunai" atau "lewat transfer ke rekening ****1234". **Sumber uang kantor, nama pembayar, dan foto bukti tidak ditampilkan** (§9 butir 6) |
| **Tanpa uang** (Rp0) | "Tidak ada uang yang dibayarkan: seluruhnya terpakai potongan. Sisa Rp… dibawa ke slip berikutnya." |
| **Pembayaran dibatalkan** | Kembali "Belum dibayar" + riwayat "Pembayaran [tanggal] dibatalkan: [alasan]" |
| **Sedang dibetulkan** (dibuka kembali) | "Slip sedang dibetulkan: [alasan]" + perkiraan baru; **versi lama** bisa dibuka (hanya baca) |

- Tiap baris bisa diketuk untuk rinciannya (mis. baris telat → rincian per hari dari Hitungan).
- Slip jabatan bertanda (Pemilik/GM) tetap terlihat oleh **orangnya sendiri**.

### 3.4 Unduh slip (GAJ-113 bagian unduh; L4g-1)

- **Unduh PDF** di Slip Saya untuk slip **tertutup** saja; server menolak Perkiraan.
- **Unduh beberapa slip** dari Pendapatan Saya: pilih periode tertutup, paling banyak 12, satu slip per halaman A4.
- Caranya sama dengan cetak kantor L4e: halaman cetak A4 lalu **"Simpan sebagai PDF"** dari browser HP, tanpa pustaka PDF baru (§9 butir 5). Tanggal unduh dari server tercetak di kaki.
- Tiap unduhan dicatat di `payslip_steps` (`SELF_DOWNLOAD` / `SELF_DOWNLOAD_MANY`).

### 3.5 Keberatan slip (GAJ-110; L4g-2)

| Macam | Kapan bisa diajukan | Penyetuju |
|---|---|---|
| **Ada yang salah di slip** | Sejak periode berakhir (tanggal 26 pukul 00.00) selama slip Perkiraan, sampai **23.59 hari ke-3 sesudah slip ditutup** (ditutup ulang: dari penutupan terakhir) | HR, Pemilik, GM (GAJ-60). Slip GM → Pemilik; slip Pemilik → GM atau Pemilik lain; tidak ada yang memutuskan miliknya sendiri; slip bertanda tidak tampil untuk HR |
| **Uang belum saya terima** | Sejak ditandai Dibayar sampai **23.59 hari ke-7** | **Pemilik, GM** |

- **Sebelum periode berakhir** tidak ada tombol; di tempatnya: "Kalau ada yang salah di absen, jelaskan lewat Perlu Dijelaskan atau minta koreksi ke kepala toko. Potongan bisa dikeberati di tab Potongan."
- **Isi (3 langkah):** (1) macam terisi dari tombol; untuk "Ada yang salah" centang baris slip atau "Lainnya"; (2) alasan paling sedikit 20 huruf + foto bila ada; (3) periksa dan kirim; pesan berhasil menyebut siapa yang memutuskan.
- **Satu Menunggu per macam per slip.** Menambah keterangan = tarik lalu **Ajukan ulang** (isian lama terisi).
- **Tidak menahan slip** dan tidak Hangus. Langkah Periksa di Tutup Slip menampilkan "n keberatan slip menunggu".

### 3.6 Keputusan dan pembetulan (GAJ-111, 112; L4g-2)

- **Tanpa isian nominal** di keputusan (GAJ-38).
- **Ditolak:** alasan ≥ 15 huruf. Selama masa keberatan masih berjalan, boleh mengajukan ulang.
- **Disetujui** = "benar, akan dibetulkan". Penyetuju memilih **jalan pembetulan** yang tersedia untuk keadaan slip (server menyaring):

| Keadaan slip | Jalan | Tombol menuju |
|---|---|---|
| Perkiraan | Betulkan di sumbernya | Koreksi absen, potongan, bonus, gaji periode berjalan |
| Ditutup, belum Dibayar, syarat buka kembali terpenuhi | Buka kembali → betulkan → tutup ulang | `/gaji/slip/[id]/buka` (HR: Minta buka kembali) |
| Dibayar, atau slip berikutnya sudah ditutup | Betulkan di sumber → **Koreksi Periode Lalu** di slip berikutnya; kesalahan gaji tetap → **Pembetulan gaji periode lalu** | layar sumber / `/gaji/[id]` pembetulan |
| Orang tanpa slip berikutnya | koreksi plus → bayar di luar slip (L4f-2); koreksi minus → **Piutang Lain** (§9 butir 8) | — |
| "Uang belum saya terima" disetujui | **Batal bayar** lalu bayar ulang; pembayaran baru **tertaut otomatis** | `/gaji/slip/[id]/batal-bayar` |

- Sesudah Disetujui pengajuan bertanda **"menunggu pembetulan"** sampai penyetuju menekan **Tautkan pembetulan** dan memilih catatan pembetulnya. Pilihan disaring server: hanya catatan milik orang itu yang lahir/berubah **sesudah keputusan** (baris Koreksi Periode Lalu, versi slip baru, koreksi absen, perubahan potongan/bonus/gaji, pembayaran baru).
- Selama belum tertaut: **pengingat harian** ke penyetuju; sesudah **2 hari** juga masuk "perlu perhatian" Pemilik dan GM (GAJ-111).
- Pengaju melihat "Disetujui: akan dibetulkan", lalu "Sudah dibetulkan: [baris] Rp… di slip [periode]".
- **Pembetulan gaji periode lalu** (pengecualian GAJ-63): hanya **Pemilik atau GM**, alasan wajib, **wajib menunjuk keberatan slip yang Disetujui** (atau alasan tertulis bila kesalahan ditemukan kantor sendiri). Perubahan gaji asal `CORRECTION` boleh bertanggal periode yang slipnya sudah ditutup; **slip lama tidak diubah**; Koreksi Periode Lalu (L4e-2) menghitung ulang gaji tetap periode itu dengan paket yang dibetulkan (prorata periode lama) dan menulis selisihnya sebagai **"Koreksi gaji tetap periode [nama]"**, dua arah. Catatan L4e-2 §12 "BASE tidak ikut Koreksi Periode Lalu" dibuka **hanya** untuk asal `CORRECTION`.

### 3.7 Akses terbatas mantan karyawan (GAJ-113; L4g-3)

- Orang yang dinonaktifkan **karena berhenti** (alasan `RESIGNED` atau `DISMISSED`, §9 butir 6) tetap bisa masuk dengan akun lamanya selama fungsi **`hasMoneyMatters(orang)`** = ya: slip terakhir belum Dibayar, atau Dibayar < 7 hari, atau keberatan slip Menunggu / menunggu pembetulan, atau tagihan bayar di luar slip Menunggu bayar.
- Yang terbuka hanya: **Pendapatan Saya, Slip Saya, Pengajuan Saya (Keberatan slip saja), Pemberitahuan, Profil (lihat saja)**. Menu lain tidak tampil; **server menolak semua alamat lain** (penjaga di tata letak + route API, bukan hanya menu). Bilah atas: "Akses terbatas sampai urusan gaji selesai."
- Sesudah urusannya habis: "Akun ini tidak aktif sejak [tanggal]. Hubungi HR." (KAR-07). Tanpa akun kedua.
- Dinonaktifkan alasan **lain** tidak mendapat akses ini.

### 3.8 Total Diterima per Orang (GAJ-114; L4g-3)

- **Letak:** Kantor › Gaji › Total Diterima per Orang (`/gaji/total-diterima`). **PC.**
- **Rentang** 1–12 periode (bawaan: periode terakhir yang sudah ditutup). **Satu baris per orang**, termasuk mantan karyawan: slip bulanan, (slip mingguan, bongkaran: "—" sampai L7), bayar di luar slip, **Diterima**, **Belum dibayar**, jumlah. Slip Perkiraan tidak ikut.
- Dibaca dari satu fungsi **`totalReceived(orang, rentang)`** atas `payslips`, `payslip_payments`, `off_slip_claims`; tidak menghitung ulang.
- **Saring:** cabang (tersimpan di slip), jabatan, aktif/mantan; **cari** nama. Klik baris → rincian per periode (bentuk Pendapatan Saya, hanya baca).
- **Hak:** Pemilik dan GM semua; **HR tanpa jabatan bertanda** (tidak juga dalam jumlah); Finance dan Admin HR tidak.
- **Unduh CSV** (§9 butir 7), tercatat.

## 4. Layar

| Layar | Alamat | Menu | Tahap |
|---|---|---|---|
| Pendapatan Saya (GAJ-L39): pemilih periode, kotak peringatan, tiga angka, 5 tab, **Unduh beberapa slip** | `/pendapatan` | **Saya › Pendapatan Saya** (HP, bilah bawah tetap) | L4g-1 |
| Slip Saya (GAJ-L40): keadaan + status bayar, rincian baris, **Unduh PDF**, **Lihat versi lama**; (L4g-2) tombol keberatan + kartu status keberatan | `/pendapatan/slip/[id]` | dari Pendapatan Saya / pemberitahuan | L4g-1 |
| Cetak slip sendiri (satu / banyak) | `/pendapatan/slip/[id]/cetak`, `/pendapatan/cetak?periode=…` | — | L4g-1 |
| Kartu Beranda "Urusan gaji saya" | `/` | — | L4g-1 |
| Ajukan Keberatan Slip (GAJ-L41, 3 langkah) | `/pendapatan/slip/[id]/keberatan?macam=…` | dari Slip Saya; rincian di Pengajuan Saya | L4g-2 |
| Putuskan Keberatan Slip (GAJ-L42): slip dengan baris ditandai, alasan + foto, keadaan slip, jalan pembetulan; macam kedua: pembayaran (tanggal, sumber, bukti, pembayar) | isi khas di `/persetujuan/[id]` | Persetujuan | L4g-2 |
| Tautkan pembetulan | `/persetujuan/[id]/tautkan` | dari keputusan | L4g-2 |
| Pembetulan gaji periode lalu (Pemilik/GM) | `/gaji/[id]/pembetulan` | dari Gaji Karyawan / keputusan | L4g-2 |
| Total Diterima per Orang (GAJ-L43) + rincian + CSV | `/gaji/total-diterima` | **Kantor › Gaji › Total Diterima per Orang** | L4g-3 |

## 5. Hak

| Tindakan | HR | Admin HR | Finance | Karyawan | Pemilik, GM |
|---|---|---|---|---|---|
| Pendapatan Saya, Slip Saya, unduh slip sendiri | dirinya | dirinya | dirinya | dirinya (+ mantan dalam akses terbatas) | dirinya |
| Ajukan keberatan slip | slipnya | slipnya | slipnya | slipnya | slipnya |
| Putuskan "Ada yang salah" (`payslip_objection.decide`) | ✓ tanpa jabatan bertanda, bukan miliknya | — | — | — | ✓ bukan miliknya |
| Putuskan "Uang belum saya terima" · ownerOnly | — | — | — | — | ✓ bukan miliknya |
| Pembetulan gaji periode lalu · ownerOnly | — | — | — | — | ✓ |
| `payroll_totals.view` | ✓ tanpa jabatan bertanda | — | — | — | ✓ |

"Dirinya" tidak memakai tindakan bernama: server membandingkan orang di sesi dengan pemilik slip. Penolakan server yang dites: membuka slip/Pendapatan orang lain; mengunduh Perkiraan; keberatan sebelum periode berakhir / sesudah batas / dua Menunggu satu macam; HR memutuskan macam kedua atau slip bertanda; memutuskan miliknya sendiri; menautkan catatan orang lain atau yang lahir sebelum keputusan; pembetulan gaji tanpa keberatan Disetujui/alasan; mantan karyawan membuka alamat lain; Finance membuka Total Diterima.

## 6. Mesin terjadwal

| Mesin | Kapan | Isi | Tahap |
|---|---|---|---|
| `payslip-objection-reminder` | tiap hari 07.10 WIB | keberatan Menunggu dan "menunggu pembetulan" → pengingat ke penyetuju; > 2 hari → perlu perhatian Pemilik/GM | L4g-2 |

## 7. Pemberitahuan

| Kapan | Ke siapa | Isi | Tahap |
|---|---|---|---|
| Slip ditutup / gaji dibayar (sudah ada) | orangnya | kini menaut ke **Slip Saya** | L4g-1 |
| Keberatan diajukan | penyetuju yang berhak | slip, macam | L4g-2 |
| Ditolak / Disetujui / Sudah dibetulkan | pengaju | alasan atau baris pembetul | L4g-2 |
| Pembetulan gaji periode lalu | orangnya + pemilik lain | periode, alasan | L4g-2 |

## 8. Tes

- **Unit:** tiga angka kepala; pilihan keadaan Slip Saya (8 keadaan); `myPayIssues` siapa-bertindak + kalimat akibat menurut tanggal; masa keberatan (26 00.00, hari ke-3 23.59, ditutup ulang, hari ke-7 sesudah Dibayar); penyaring jalan pembetulan per keadaan; `hasMoneyMatters`; Total Diterima (Diterima + Belum = jumlah).
- **Integrasi DB** (tanggal lampau, pola L4e/L4f): Pendapatan Saya = angka kantor (Perkiraan dan tertutup); unduh mencatat langkah, Perkiraan ditolak; keberatan → tolak → ajukan ulang; setujui → buka kembali → tutup ulang → tautkan; "uang belum diterima" → batal bayar → bayar ulang tertaut otomatis; pembetulan gaji asal CORRECTION → baris "Koreksi gaji tetap" dua arah; koreksi minus tanpa slip berikutnya → Piutang Lain; mantan karyawan masuk/tertolak; pagar hak §5.

## 9. Keputusan owner (menunggu jawaban)

1. **Tiga kali tayang.** **Saran: L4g-1** (lihat: Pendapatan Saya, Slip Saya, peringatan, unduh) → **L4g-2** (keberatan + pembetulan) → **L4g-3** (akses mantan karyawan + Total Diterima), masing-masing diuji terpisah. Klaim + kunci hris 0026–0028 dipegang sampai L4g-3 selesai, seperti L4e/L4f.
2. **Jalur yang belum ada.** Slip mingguan, bongkaran, dan Buku Upah baru dibangun di L7. **Saran:** tab Upah sekarang berisi lembur + bonus per tanggal + gaji tetap; kolom mingguan/bongkaran di Total Diterima tampil "—" sampai L7, supaya bentuk layar tidak berubah nanti.
3. **Siapa punya Pendapatan Saya.** **Saran:** semua orang berakun yang **punya slip atau paket gaji**, termasuk Pemilik dan GM (slipnya hanya terlihat dirinya sendiri dan pemilik lain); GM tanpa tab Hitungan.
4. **Rekening di status bayar.** **Saran:** simpan **4 angka terakhir rekening saat dibayar** di pembayaran (kolom baru), supaya tidak berubah bila karyawan mengganti rekening; pembayaran lama diisi dari rekening yang tercatat sekarang.
5. **Bentuk unduhan.** **Saran:** sama dengan cetak kantor: halaman A4 lalu "Simpan sebagai PDF" dari browser HP, tanpa pustaka PDF baru. Unduh banyak = satu halaman cetak berisi sampai 12 slip.
6. **Yang dilihat karyawan, dan siapa "mantan karyawan".** **Saran: ikuti v3:** karyawan melihat tanggal uang + tunai/transfer + 4 angka rekening, **tanpa** sumber uang kantor, nama pembayar, dan foto bukti. Akses terbatas untuk yang dinonaktifkan dengan alasan **Mengundurkan diri** atau **Diberhentikan**; alasan **Lainnya** tidak.
7. **Total Diterima per Orang.** **Saran: ikuti v3:** Pemilik/GM semua, HR tanpa jabatan bertanda, Finance dan Admin HR tidak; unduhan **CSV** (seperti Daftar Transfer L4f).
8. **Sisa L4f-2: koreksi minus sesudah slip terakhir.** Sekarang belum menjadi Piutang Lain. **Saran:** dibereskan di **L4g-2**, karena jalan pembetulan keberatan untuk orang tanpa slip berikutnya membutuhkannya (koreksi minus → Piutang Lain asal "Koreksi Periode Lalu", koreksi plus → bayar di luar slip seperti sekarang).

## 10. Catatan untuk tahap berikutnya

- **L7 driver & kenek:** mengisi slip mingguan, bongkaran, dan Buku Upah ke Pendapatan Saya dan Total Diterima tanpa mengubah bentuk layar.
- Sesudah L4g selesai, **seluruh L4 Gaji Bulanan selesai**; urutan berikutnya menurut PRD fase 1.
