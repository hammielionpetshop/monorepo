# Galian Sistem Lama: Keuangan

Status: **selesai**; buku aturannya `../06-keuangan.md` ditetapkan 12 Oktober 2026
Digali dari sistem lama mulai: 12 Oktober 2026

Bab 6 dipecah menjadi lima bagian (disetujui pemilik, 12 Oktober 2026):

| Bagian | Isi | Status |
|---|---|---|
| 6A | Kas harian: Kas Masuk dan Kas Keluar yang diketik, rekening dan kas, kategori, kas kecil, pemeriksaan, riwayat; bentuk catatan keuangan dari gaji, bongkaran, dan kasbon | **Sudah digali** (12 Oktober 2026), database sudah dicek. KEU-A01 s.d. A44. **Dijawab pemilik** (6A.9), aturan di 6A.10, AK1–AK13 disetujui, pertentangan J dan butir K–U dijawab; 35 aturan dengan tambahan pemilik. **SELESAI dibahas** |
| 6B | Laporan Kasir dan uang pengiriman: setoran kasir cabang, verifikasi finance, minus kas, Kas Masuk otomatis, pemeriksaan uang dari driver | **Sudah digali** (12 Oktober 2026), database sudah dicek. KEU-B01 s.d. B27. **Dijawab pemilik** (6B.9), 20 aturan di 6B.10, AL1–AL14 disetujui dengan tiga catatan. Pertentangan V dan butir W–Y dijawab. **SELESAI dibahas** (21 aturan dengan tambahan pemilik) |
| 6C | Pembelian, supplier, HPP, piutang | **Sudah digali** (12 Oktober 2026), ukuran sedang, database sudah dicek. KEU-C01 s.d. C26. **Dijawab pemilik** (6C.9), butir Z, AA, AB dijawab; 18 aturan di 6C.10. **SELESAI dibahas** |
| 6D1 | Modal, aset, biaya tetap, sewa aset milik Owner (6D berukuran besar dan dipecah dua, disetujui pemilik 12 Oktober 2026) | **Sudah digali** (12 Oktober 2026), ukuran sedang, database sudah dicek. KEU-D01 s.d. D29. **Dijawab pemilik** (6D1.9), 18 aturan di 6D1.10, AN1–AN12 disetujui. Butir A–E dan G–K disetujui; Cek Modal dirinci (14a–14h). Butir F (cicilan) dijawab 12 Oktober 2026 (6E.6): cicilan mobil box, tanggungan Ibu. **SELESAI dibahas** (18 aturan; aturan 14 dirinci menjadi 14a–14h) |
| 6D2 | Arus kas, laporan keuangan, dashboard | **Sudah digali** (12 Oktober 2026), ukuran sedang, database sudah dicek. KEU-E01 s.d. E27. **Dijawab pemilik** (6D2.9), AO1–AO18 dan butir A–E disetujui; 23 aturan di 6D2.10. **SELESAI dibahas** |
| 6E | Penetapan menjadi `../06-keuangan.md` (nomor KEU). Ukuran besar, dipecah dua (disetujui pemilik 12 Oktober 2026): 6E1 mencocokkan dan memberi nomor, 6E2 menulis buku aturan | **6E1 SELESAI** (12 Oktober 2026): kerangka dan nomor KEU-01 s.d. 123 di 6E.3; 11 butir penutup dijawab pemilik (6E.2). **6E2 SELESAI** (12 Oktober 2026): `../06-keuangan.md` ditulis, KEU-01 s.d. 123; catatan penulisan di 6E.5 |

Cara menutup tiap bagian: setelah satu bagian selesai dibahas, Claude memberi
pernyataan tegas "6X SELESAI", meminta `/clear`, dan bagian berikutnya
dikerjakan di sesi baru. Pertanyaan tiap bagian diajukan di percakapan.

Batas penggalian: kode aplikasi dan struktur database yang berjalan. Isi data
(nama orang, nomor rekening, uraian transaksi) tidak dibuka; yang dihitung
hanya jumlah baris dan jumlah rupiah per kelompok.

Nomor KEU di file ini adalah nomor **galian** (sementara). Nomor aturan v3
ditetapkan di 6E.

---

# Bagian 6A: Kas harian

Sumber: `hris-app/app/(dashboard)/keuangan/kas-masuk/page.tsx` (878 baris),
`kas-keluar/page.tsx` (707), `approval/page.tsx` (976), `riwayat/page.tsx`
(377), `rekening/page.tsx` (367), `petty-cash/page.tsx` (564),
`kategori/page.tsx` (209), `lib/finCashOut.ts`; bagian saldo di
`cashflow/page.tsx`; tabel `fin_cash_in`, `fin_cash_out`,
`fin_cash_out_categories`, `fin_bank_accounts`, `petty_cash_entries`,
`fin_audit_log`; fungsi `fin_autopost_payroll`,
`fin_recompute_driver_weekly_wage`, `fin_audit_trigger_fn`, `guard_auto_rows`,
`fin_cash_out_guard_supplier_purchase_overpay`; kebijakan akses di database.

Yang sudah diputuskan di bab lain dan tidak ditanyakan lagi:

- Pengeluaran gaji hanya lahir dari slip, tidak diketik tangan; uraiannya
  dikirim slip (GAJ-56). Membayar slip satu langkah utuh di server dengan
  sumber dana (GAJ-48, DRV-26); pembayaran yang salah dibatalkan dengan alasan
  (GAJ-49).
- Bongkaran: satu jalur pengeluaran yang hanya lahir dari Laporan Bongkaran
  (DRV-47, DRV-50).
- Kasbon: menyerahkan uang adalah langkah tersendiri dengan sumber dana wajib
  dan satu catatan keuangan (DRV-63); pelunasan tunai tercatat sebagai uang
  masuk (DRV-69); pemberian dicatat sebagai pengeluaran bantuan (DRV-77).
- Uang pengiriman yang sudah diperiksa mengalir ke Kas Masuk; barisnya
  dibatalkan, tidak dihapus (LOG-64). Pemeriksaan paling lambat 3 hari
  (LOG-62). Bensin dicatat dengan nominal sebenarnya dan foto struk (LOG-83).
- Piutang toko milik sistem kasir (LOG-65).
- Data uang tidak pernah dihapus (PRI-02); jam dari server (PRI-01); nominal
  bilangan bulat rupiah (PRI-28).

## 6A.1 Bagian ini mengurus apa

Buku induk uang perusahaan: setiap uang yang masuk dan keluar, dari rekening
atau kas yang mana, untuk apa, dibebankan ke cabang mana, siapa yang mencatat,
dan siapa yang memeriksa. Semua modul lain (gaji, bongkaran, kasbon,
pengiriman, laporan kasir, pembelian) pada akhirnya menulis ke buku ini.

## 6A.2 Data di sistem lama (dicek ke database, 12 Oktober 2026)

| Data | Isinya | Tabel | Jumlah baris |
|---|---|---|---|
| Kas Masuk | Cabang, tanggal, omzet, pengeluaran dari uang hari itu, selisih kasir, metode, rekening tujuan, status, pemeriksa | `fin_cash_in` | 1.111 (31 Mei s.d. 11 Oktober 2026): 1.077 disetujui, 31 menunggu, 2 ditolak, 1 revisi. **Semuanya diketik tangan** |
| Kas Keluar | Cabang, kategori, nominal, keterangan, tanggal, rekening sumber, sumber otomatis, status, pemeriksa | `fin_cash_out` | 1.688: 819 diketik tangan, 349 otomatis dari modul lain, 520 impor catatan lama (Mei–Juni) |
| Kategori Kas Keluar | Kode, nama, tanda "masuk hitungan laba", aktif | `fin_cash_out_categories` | 30 (28 aktif) |
| Rekening dan kas | Nama, nomor, pemilik rekening, jenis (bank atau tunai), cabang, saldo awal dan tanggalnya, "gabung saldo ke" | `fin_bank_accounts` | 12: 11 bank, **1 kas tunai** |
| Kas kecil | Pemegang, tanggal, masuk atau keluar, nominal, keterangan, kategori bebas | `petty_cash_entries` | 525 (11 Agustus s.d. 12 Oktober 2026), 2 pemegang |
| Jejak perubahan | Tabel, baris, tindakan, isi lama dan baru, pelaku, waktu | `fin_audit_log` | 5.717 sejak 5 Juli 2026 |

Tidak ada tabel untuk **memindahkan uang antar rekening atau kas** (setor tunai
ke bank, tarik tunai, isi kas kecil).

Keadaan data:

**Koreksi (12 Oktober 2026, dicek ulang atas permintaan pemilik):** kata "HR"
di daftar ini adalah **hak akun** (`hr`), bukan jabatan. Akun berhak `hr` yang
mengisi keuangan dipegang orang berjabatan **Finance**; isian berhak `finance`
berasal dari akun finance yang sekarang nonaktif. Jadi semua isian dikerjakan
orang finance, dan pemeriksanya dua akun berjabatan Owner. Temuan "HR mengisi
lebih dari separuh" **ditarik**. Yang tetap benar: hak akun tidak sama dengan
jabatan, sehingga pagar "siapa boleh apa" tidak bisa dibaca dari hak akun.
Dua buku kas kecil juga berbeda sifat: buku akun **Owner** berisi 270 baris,
masuk Rp1.562.098.815 dan keluar Rp1.553.621.855, rata-rata keluar Rp9,8 juta
dan terbesar Rp163,8 juta (buku kerja pemilik uang, lihat 6A.9 butir K); buku
akun **Finance** berisi 255 baris, masuk Rp24.874.500 dan keluar Rp24.852.000,
rata-rata keluar Rp104 ribu (kas kecil yang sebenarnya).

- **"Input Kasir Darurat" sebenarnya jalur utama.** Halaman Kas Masuk disebut
  cadangan, tetapi seluruh 1.111 baris Kas Masuk diketik di sana; belum ada
  satu pun yang lahir otomatis (Laporan Kasir baru dipakai sejak 10 Oktober:
  9 laporan, belum ada yang disetujui). 861 baris diisi HR, 216 finance.
- **Yang memeriksa adalah pemilik, bukan finance.** Layar menulis "menunggu
  verifikasi tim finance pusat", tetapi dari 973 Kas Keluar disetujui yang
  pemeriksanya tercatat sebagai akun, 956 diperiksa pemilik, 17 HR, dan **0
  finance** (650 lainnya baris otomatis dan impor). Finance dan HR yang mengisi
  (finance 302, HR 512, pemilik 5 dari 819 isian tangan).
- **22 pengeluaran disetujui oleh pengisinya sendiri**, dan 22 isian tangan
  lahir langsung berstatus disetujui. 6 Kas Masuk juga disetujui pengisinya.
- **Baris yang sudah disetujui masih berubah.** Jejak mencatat 451 perubahan
  pada Kas Keluar berstatus disetujui (nominal 47 kali, tanggal 72, kategori
  54, cabang 7, keterangan 67, lainnya 204) dan 57 pada Kas Masuk. 351
  dilakukan mesin (hitung ulang gaji driver dan sejenisnya), **157 oleh
  orang** (HR 119, pemilik 37, finance 1). Layar hanya mengizinkan mengubah
  yang menunggu atau ditolak; database mengizinkan semuanya.
- **Baris yang sudah disetujui juga terhapus:** 36 Kas Keluar (16 isian
  tangan, 6 pembayaran supplier, 14 pencairan kasbon) dan 14 Kas Masuk.
  Seluruhnya 145 baris pernah dihapus (62 oleh orang, 83 oleh mesin).
- **Jejak perubahan ada, tetapi tidak ada layar yang membukanya**, dan 1.717
  dari 5.717 catatannya tanpa pelaku.
- **647 Kas Keluar tanpa rekening atau kas sumber:** semua impor lama (520),
  semua gaji driver (44), upah kenek (12), pencairan kasbon (55), dan 16 dari
  62 gaji bulanan otomatis. Saldo rekening tidak memuat baris-baris ini.
- **Satu "Kas Tunai" untuk seluruh perusahaan.** 763 Kas Keluar diambil dari
  kas tunai yang satu itu, 278 dari rekening bank. 126 pengeluaran memakai
  rekening milik cabang lain (layar memang membolehkan).
- **7 pengeluaran bertanggal masa depan dan sudah disetujui** (sampai 25
  Oktober 2026). 136 dari 819 isian tangan bertanggal lebih dari 7 hari
  sebelum hari diketik.
- Jarak isi sampai diperiksa: tengahnya 4 hari, paling lama 30 hari. Sekarang
  63 Kas Keluar menunggu (7 sudah lebih dari seminggu, tertua 7 September)
  dan 32 Kas Masuk menunggu. Ditolak 60 kali (18 Kas Keluar, 42 Kas Masuk).
  3 kali menyetujui 10 baris atau lebih dalam satu detik (centang semua).
- **Pengeluaran menumpang di Kas Masuk:** 115 baris Kas Masuk memuat
  "pengeluaran dari uang hari itu" Rp23.554.700, tanpa kategori dan tanpa
  baris Kas Keluar. Selisih kasir: lebih 151 kali (Rp2.826.146), kurang 45
  kali (Rp1.394.653). Dibahas di 6B.
- Satu cabang satu tanggal rata-rata 2,6 baris Kas Masuk, paling banyak 11.
- **Kas kecil bukan uang kecil.** 525 baris dari 2 pemegang (pemilik 270, HR
  255) dalam dua bulan: masuk Rp1.586.973.315 (127 baris), keluar
  Rp1.578.473.855 (398 baris). 519 baris tanpa kategori. Tidak bertaut ke Kas
  Masuk, Kas Keluar, atau rekening mana pun.
- **Gaji bisa tercatat dua kali.** Kategori "Gaji Karyawan Tetap" punya 62
  baris otomatis dari slip dan 9 baris ketikan tangan (Rp26.040.000, Juli s.d.
  September). Belum dibuktikan dobel; diperiksa saat keputusan data lama.
- Tidak ada akun kepala cabang yang aktif (0), sehingga jalur "cabang mengisi,
  pusat memeriksa" tidak pernah berjalan: semuanya diisi orang kantor.
- Tiga kategori belum pernah dipakai (Restock, Pencairan Tabungan Loyalitas,
  Gaji). Empat kode kategori bentuknya rusak karena dibuat dari ketikan nama
  (`bonus_`, `gaji_`, `return_`, `beban_listrik,_air,_dan_internet`).

Jawaban atas titipan Bab 5 butir 7 (diperiksa di data lama):

- **Gaji driver dan "Pembayaran Gaji Driver":** laporan laba tidak
  menjumlahkan keduanya. Gaji driver dicatat sebagai biaya (tanpa rekening),
  pembayarannya dicatat terpisah sebagai uang keluar (bertanda "tidak masuk
  hitungan laba"). Tetapi pasangannya tidak lengkap: 44 baris biaya
  (Rp19.328.000) berbanding 23 baris pembayaran (Rp7.234.925).
- **"Bongkar" dan "Upah Borongan":** keduanya dihitung sebagai biaya. Tidak
  ditemukan pasangan bertanggal dan bernominal sama, jadi dobel **tidak
  terbukti**, tetapi juga tidak bisa dipastikan tidak ada.
- **4 pencairan kasbon ganda:** tercatat dua kali sebagai uang keluar.
  Kategorinya tidak masuk hitungan laba, jadi laba tidak terpengaruh; jumlah
  uang keluar yang terpengaruh.

## 6A.3 Aturan yang ditemukan

### Kas Masuk yang diketik

| No | Aturan | Sumber |
|---|---|---|
| KEU-A01 | Kas Masuk diisi per cabang per tanggal: **total omzet**, metode (tunai, transfer, campuran), rekening atau kas tujuan (wajib), keterangan. Selain transfer boleh ditambah "pengeluaran dari uang hari itu" dan selisih kasir (lebih atau kurang). | `kas-masuk/page.tsx` `handleSubmit` |
| KEU-A02 | **Uang diterima** = omzet − pengeluaran + selisih; tidak boleh kurang dari nol. Rumusnya ditulis ulang di Kas Masuk, Dashboard, Laporan, dan Detail Laporan. | sama; `laporan/page.tsx`, `dashboard/page.tsx` |
| KEU-A03 | Tanggal diketik bebas (maju atau mundur). Isian baru berstatus "menunggu". | sama |
| KEU-A04 | Yang mengisi: pemilik, HR, finance untuk cabang mana pun; kepala cabang hanya cabangnya. Karyawan biasa tidak. | kebijakan `fin_cash_in_insert_*` |
| KEU-A05 | Kalau cabang dan tanggal itu sudah punya Laporan Kasir, layar memperingatkan "bisa dobel" tetapi **tetap boleh disimpan**. | `dupReports` |
| KEU-A06 | Rekening tujuan boleh milik cabang mana pun. | teks layar |
| KEU-A07 | Baris yang lahir otomatis (Laporan Kasir, uang pengiriman, Buku Piutang) tidak bisa diubah atau dihapus dari halaman ini; dijaga database. | `guard_auto_rows` |

### Kas Keluar yang diketik

| No | Aturan | Sumber |
|---|---|---|
| KEU-A08 | Kas Keluar diisi: cabang yang dibebani, kategori, tanggal (diketik bebas), rekening atau kas sumber (wajib), nominal, keterangan (tidak wajib). Status awal "menunggu". **Tidak ada tempat melampirkan bukti** (struk atau nota). | `kas-keluar/page.tsx` `handleSubmit` |
| KEU-A09 | Kategori gaji (gaji, upah driver, upah kenek, borongan, bonus) memunculkan pertanyaan "karyawan ini terdaftar?". Kalau dijawab "tidak, pekerja lepas", isian tangan diteruskan. **Hanya layar yang menahan**; database menerima kategori apa pun. | `PAYROLL_CATEGORIES`, kebijakan `fin_cash_out_insert_central` |
| KEU-A10 | Kategori "Pembayaran Supplier" dan "Pencairan Kasbon" disembunyikan dari pilihan karena punya jalurnya sendiri; lagi-lagi hanya di layar. | `CATEGORIES_WITH_OWN_FLOW` |
| KEU-A11 | Yang mengisi: pemilik, HR, finance; kepala cabang untuk cabangnya. Database **tidak mewajibkan status awal "menunggu"** bagi pemilik, HR, dan finance: isian bisa langsung berstatus disetujui. | kebijakan `fin_cash_out_insert_central` |
| KEU-A12 | Halaman hanya menampilkan "10 isian terakhir saya" dan daftar "Perlu Direvisi" milik sendiri. Daftar lengkap ada di halaman lain (Riwayat Kas Keluar). | `fetchRecent`, `riwayat/page.tsx` |

### Memeriksa (Verifikasi Keuangan)

| No | Aturan | Sumber |
|---|---|---|
| KEU-A13 | Satu halaman berisi sembilan tab pemeriksaan: Kas Keluar, Kas Masuk, HPP, Modal Cabang, Aset, Kasbon, Kasbon Driver/Kenek, Uang Pengiriman, Laporan Kasir. | `approval/page.tsx` |
| KEU-A14 | Yang boleh membuka dan memeriksa Kas Masuk dan Kas Keluar: pemilik, HR, dan finance. **Tidak ada larangan memeriksa isian sendiri**; layar hanya menulis catatan kecil bahwa isian tetap "menunggu". | `ADMIN_ROLES`, `processEntries` |
| KEU-A15 | Menyetujui atau menolak bisa satu per satu atau **banyak sekaligus** (centang semua). Menolak Kas Masuk dan Kas Keluar wajib alasan; menolak HPP, modal, dan aset tanpa alasan. | `handleRejectClick` |
| KEU-A16 | Memeriksa adalah perubahan status yang dikirim **dari layar** langsung ke tabel; tidak ada fungsi server yang memastikan urutannya (misalnya status sebelumnya memang "menunggu"). | `processEntries` |
| KEU-A17 | Yang ditolak kembali ke pengisinya dengan alasan, diperbaiki, lalu berstatus "revisi" dan diperiksa lagi. Daftar "Perlu Direvisi" tidak dibatasi bulan. | `saveCashOutEdit`, `fetchNeedsRevision` |
| KEU-A18 | Tidak ada batas waktu memeriksa dan tidak ada tanda untuk yang lama menunggu. | tidak ada |
| KEU-A19 | Hanya baris berstatus disetujui yang masuk saldo dan laporan. Yang menunggu ditampilkan terpisah sebagai "saldo proyeksi". | `cashflow/page.tsx` |

### Mengubah dan menghapus

| No | Aturan | Sumber |
|---|---|---|
| KEU-A20 | Di layar, isian hanya bisa diubah atau dihapus selama berstatus menunggu atau ditolak. Baris otomatis tidak bisa diubah, **kecuali pembayaran supplier** (boleh diubah nominalnya, tidak boleh dihapus). | `lib/finCashOut.ts` |
| KEU-A21 | Di database, pemilik, HR, dan finance boleh **mengubah baris berstatus apa pun**, termasuk yang sudah disetujui dan yang otomatis. Menghapus dibatasi ke yang menunggu atau ditolak dan bukan otomatis. | kebijakan `fin_cash_out_update_central`, `fin_cash_out_delete_admin` |
| KEU-A22 | Menghapus benar-benar menghilangkan baris ("tidak bisa dibatalkan"); tidak ada status "dibatalkan" dan tidak ada alasan. | `handleDeleteRow` |
| KEU-A23 | Aturan ubah dan hapus Kas Keluar dipakai bersama dua halaman lewat satu berkas; untuk Kas Masuk ditulis sendiri di halamannya, dengan isi yang berbeda (kepala cabang boleh mengubah Kas Masuk, tidak boleh Kas Keluar). | `lib/finCashOut.ts`, `kas-masuk/page.tsx` |
| KEU-A24 | Setiap tambah, ubah, dan hapus di tabel keuangan dicatat otomatis ke jejak perubahan (isi lama dan baru). Yang boleh membacanya pemilik, HR, finance; **tidak ada halamannya**. Perubahan oleh mesin tercatat tanpa pelaku. | `fin_audit_trigger_fn` |

### Catatan otomatis dari modul lain

| No | Aturan | Sumber |
|---|---|---|
| KEU-A25 | Begitu slip bulanan ditandai lunas, database menulis satu Kas Keluar "Gaji Karyawan Tetap" sebesar gaji bersih, langsung disetujui, **bertanggal hari terakhir bulan periode** (bukan tanggal uang dibayar), dibebankan ke cabang orangnya **saat itu**, **tanpa rekening sumber**. Kalau orangnya tidak punya cabang, catatan diam-diam tidak dibuat. | `fin_autopost_payroll` |
| KEU-A26 | Gaji driver dan upah kenek dicatat per orang per minggu, **dihitung ulang** tiap ada perubahan trip, denda, atau potongan kasbon: barisnya diubah di tempat, atau dihapus kalau jumlahnya nol. Bertanggal awal minggu + 8 hari, tanpa rekening. Nominal bersih yang nol atau minus ditulis Rp0,01. | `fin_recompute_driver_weekly_wage` |
| KEU-A27 | Uang yang benar-benar keluar untuk gaji driver dan kenek dicatat **baris kedua** yang diketik tangan ("Pembayaran Gaji Driver (Kas)"), bertanda tidak masuk hitungan laba. Tidak ada penghubung antara baris biaya dan baris pembayarannya. | kategori `driver_payout`, `helper_payout` |
| KEU-A28 | Pencairan kasbon tercatat otomatis saat kasbon disahkan, tanpa rekening (sudah dicatat di 5C). | 5C, DRV-C18 |
| KEU-A29 | Pembayaran supplier, biaya tetap berkala, dan sewa kendaraan juga menulis Kas Keluar bertaut ke sumbernya. Total pembayaran satu pembelian dijaga database supaya tidak melebihi utangnya. Rinciannya di 6C dan 6D. | `fin_cash_out_guard_supplier_purchase_overpay`, `fin_generate_*` |
| KEU-A30 | Penanda sumber di Kas Keluar (`source_table`) dan di Kas Masuk (`source_type`) memakai dua nama kolom dan dua cara penjagaan yang berbeda. | struktur tabel |

### Kategori

| No | Aturan | Sumber |
|---|---|---|
| KEU-A31 | Kategori Kas Keluar ditambah, diubah namanya, dan dinonaktifkan oleh pemilik, HR, atau finance. Kodenya dibuat dari ketikan dan tidak bisa diubah lagi. | `kategori/page.tsx` |
| KEU-A32 | Tiap kategori punya satu tanda: **masuk hitungan laba atau tidak**. Yang tidak masuk: pembayaran supplier, restock, prive, pencairan kasbon, pembayaran gaji driver dan kenek. Tanda ini bisa diubah kapan saja dan **langsung mengubah laporan bulan-bulan lalu**. | `saveEdit`, `laporan/page.tsx` |
| KEU-A33 | Kas Masuk tidak punya kategori: semua baris dianggap omzet. Uang masuk yang bukan omzet (pengembalian, setoran modal, pelunasan kasbon) tidak punya tempat. | struktur tabel |

### Rekening dan kas

| No | Aturan | Sumber |
|---|---|---|
| KEU-A34 | Rekening atau kas diisi: jenis (bank atau tunai), nama, nomor (wajib untuk bank), nama pemilik rekening, cabang (boleh kosong), saldo awal dan tanggalnya. Dikelola pemilik, HR, atau finance. | `rekening/page.tsx` |
| KEU-A35 | **Saldo awal dan tanggalnya bisa diubah kapan saja**, juga setelah ada transaksi. | `saveEdit` |
| KEU-A36 | Saldo berjalan = saldo awal + semua Kas Masuk disetujui − semua Kas Keluar disetujui di rekening itu. **Tanggal saldo awal tidak dipakai** dalam hitungan. Dihitung di database, dijumlahkan lagi di layar. | `get_account_cashflow_summary`, `cashflow/page.tsx` |
| KEU-A37 | Satu rekening bisa "gabung saldo ke" rekening lain (misalnya mesin EDC yang muaranya ke rekening utama); hanya untuk tampilan jumlah gabungan. | `settlement_account_id` |
| KEU-A38 | Rekening dinonaktifkan, tidak dihapus. | `toggleActive` |
| KEU-A39 | **Tidak ada cara mencatat pindah uang** antar rekening atau kas. Setor tunai ke bank dan tarik tunai tidak tercatat, sehingga saldo kas tunai dan saldo bank menjauh dari kenyataan. | tidak ada |

### Kas kecil

| No | Aturan | Sumber |
|---|---|---|
| KEU-A40 | Kas kecil adalah **buku pribadi per akun**: tiap pemilik, HR, dan finance punya bukunya sendiri. Isinya tanggal, masuk atau keluar, nominal, keterangan, kategori ketikan bebas. | `petty-cash/page.tsx`, kebijakan `petty_cash_own_rows` |
| KEU-A41 | Hanya pemegangnya yang menulis, mengubah, dan menghapus; pemilik bisa membaca buku semua orang. **Tidak ada pemeriksaan, tidak ada jejak perubahan, tidak ada status.** | sama |
| KEU-A42 | Saldo dihitung **di layar** dari seluruh baris sejak awal. Bisa dicetak per bulan atau per rentang tanggal. | `rowsWithBalance` |
| KEU-A43 | Kas kecil **tidak bertaut ke apa pun**: uang "masuk" tidak mengurangi rekening mana pun, dan uang "keluar" tidak menjadi Kas Keluar, tidak punya cabang, dan tidak masuk laporan. | struktur tabel |

### Hak akses

| No | Aturan | Sumber |
|---|---|---|
| KEU-A44 | Seluruh menu Keuangan dibuka untuk pemilik, **HR**, dan finance dengan hak yang sama: mengisi, memeriksa, mengubah rekening, mengubah kategori. Daftarnya ditulis ulang di tiap halaman. | `ADMIN_ROLES` (tujuh salinan) |

## 6A.4 Menu di sistem lama

| Menu | Sub menu | Dipakai untuk apa | Mirip dengan menu lain? |
|---|---|---|---|
| Keuangan › Kas Masuk | Input Kasir Darurat | Mengetik omzet harian; tab Riwayat, Perlu Direvisi, Selisih Kasir | Laporan Kasir (penggantinya) |
| Keuangan › Kas Keluar | Input Kas Keluar | Mengetik pengeluaran; mode "Cairkan Kasbon" | Riwayat Kas Keluar; Petty Cash |
| Keuangan › Kas Keluar | Kategori Kas Keluar | Daftar kategori | — |
| Keuangan | Petty Cash | Buku kas pribadi | Kas Keluar |
| Keuangan | Verifikasi Keuangan | Sembilan tab pemeriksaan | Menu Kasbon; Keuangan › Logistik |
| Keuangan › Setup | Setup Kas & Rekening | Daftar rekening dan saldo awal | — |
| Laporan Keuangan | Riwayat Kas Keluar | Daftar lengkap Kas Keluar per bulan, bisa ubah dan hapus | Input Kas Keluar |
| Laporan Keuangan | Cash Flow per Rekening | Saldo tiap rekening (dibahas di 6D) | — |

## 6A.5 Tumpang tindih

1. **Tiga buku uang keluar:** Kas Keluar, "pengeluaran" yang menumpang di Kas
   Masuk, dan kas kecil. Hanya yang pertama punya kategori, cabang, rekening,
   dan pemeriksaan.
2. **Dua jalan Kas Masuk:** ketikan "darurat" dan Laporan Kasir; yang darurat
   masih jalur utama.
3. **Gaji dicatat dengan tiga cara:** slip bulanan satu baris (biaya sekaligus
   uang keluar, tanpa rekening); gaji driver dan kenek dua baris (biaya
   otomatis, uang keluar ketikan); pekerja lepas ketikan tangan.
4. **Dua halaman Kas Keluar** (Input dan Riwayat) dengan tombol ubah dan hapus
   yang sama.
5. **Rumus "uang diterima"** ditulis di empat halaman; daftar siapa yang boleh
   masuk ditulis di tujuh halaman.
6. **Dua nama dan dua cara menandai baris otomatis** (Kas Masuk dan Kas
   Keluar).
7. **Pemeriksaan kasbon** ada di Verifikasi Keuangan dan di menu Kasbon (sudah
   dicatat di 5C).

## 6A.6 Kejadian di lapangan dan jalan keluarnya

| Kejadian | Di sistem lama | Ada jalan keluar? |
|---|---|---|
| Salah ketik nominal, belum diperiksa | Diubah atau dihapus pengisinya | Ya (hapus tanpa jejak di layar) |
| Salah ketik, sudah disetujui | Layar tidak memberi tombol; kenyataannya 157 kali diubah orang lewat jalan lain | **Tidak resmi**; tanpa alasan |
| Pengeluaran ternyata tidak jadi | Dihapus kalau belum disetujui; kalau sudah, tidak ada pembatalan | **Tidak** |
| Pemeriksa menolak | Alasan wajib, kembali ke pengisi, daftar "Perlu Direvisi" | Ya |
| Pengisi memeriksa isiannya sendiri | Boleh | Tanpa pagar (22 kali) |
| Isian menunggu berminggu-minggu | Tidak ada tanda | **Tidak** |
| Uang tunai disetor ke bank | Tidak bisa dicatat | **Tidak** |
| Salah pilih rekening | Diubah selama belum disetujui | Sebagian |
| Tanggal diketik keliru ke masa depan | Diterima dan bisa disetujui | **Tidak** (7 baris) |
| Omzet sudah dilaporkan kasir, diketik lagi di Kas Masuk | Peringatan saja | Tanpa pagar |
| Gaji karyawan terdaftar diketik tangan | Pertanyaan di layar; bisa dijawab "pekerja lepas" | Tanpa pagar |
| Slip lunas milik orang tanpa cabang | Catatan keuangan tidak dibuat, tanpa pesan | **Tidak** |
| Tanda "masuk hitungan laba" sebuah kategori diubah | Laporan semua bulan ikut berubah | **Tidak** |
| Saldo awal rekening diubah setelah berjalan | Saldo semua bulan ikut berubah, tercatat di jejak yang tidak punya layar | **Tidak** |
| Pemegang kas kecil mengubah atau menghapus catatan lama | Bebas, tanpa jejak | **Tidak** |
| Ingin tahu siapa mengubah sebuah baris | Jejaknya ada di database, tidak ada layarnya | **Tidak** |
| Pengeluaran tanpa bukti | Tidak ada tempat melampirkan bukti | **Tidak** |

## 6A.7 Pertanyaan untuk pemilik (diajukan di percakapan, 12 Oktober 2026)

Butuh pandangan pemilik:

1. **Kas kecil dipakai untuk apa sebenarnya?** Isinya Rp1,58 miliar masuk dan
   keluar dalam dua bulan dari dua pemegang, tanpa pemeriksaan. Saran: di v3
   diganti **Kas Pegangan** (uang kantor yang dipegang seseorang): terisi
   lewat Pindah Dana dari rekening, dan pengeluarannya dicatat sebagai Kas
   Keluar biasa (berkategori, bercabang, diperiksa).
2. **Siapa mengisi dan siapa memeriksa?** Kenyataan: HR dan finance mengisi,
   pemilik memeriksa. Saran: mengisi oleh finance (pemilik dan GM juga boleh);
   memeriksa oleh pemilik atau GM; **HR tidak lagi punya menu Keuangan**; tidak
   ada yang memeriksa isiannya sendiri.
3. **Berapa tempat uang tunai?** Sekarang satu "Kas Tunai" untuk semua. Saran:
   satu kas per tempat uang disimpan (kas kantor, kas gudang), ditambah Kas
   Pegangan per orang; laci toko diurus Laporan Kasir (6B).
4. **Bukti pengeluaran.** Sekarang tidak ada. Saran: foto struk atau nota
   **wajib** untuk semua Kas Keluar yang diketik; kalau memang tidak ada
   struk, wajib menulis alasannya.

Cukup setuju atau tidak:

5. **Pindah Dana** antar rekening dan kas dicatat sebagai jenis catatan
   tersendiri (bukan pemasukan, bukan pengeluaran, tidak memengaruhi laba).
6. **Batas memeriksa 3 hari** (sama dengan uang pengiriman, LOG-62); lewat itu
   ditandai untuk pemilik dan GM, tidak otomatis disetujui atau ditolak.
7. **Tanggal uang keluar** tidak boleh masa depan dan paling jauh 7 hari ke
   belakang; lebih dari itu hanya pemilik atau GM, dengan alasan.
8. **Prive** hanya dicatat pemilik atau GM.
9. **Kategori** hanya ditambah atau diubah pemilik atau GM; daftar kategori
   dirapikan bersama saat 6E.

## 6A.8 Usulan untuk v3 (belum disetujui)

| No | Usulan |
|---|---|
| AK1 | **Satu Buku Kas** untuk uang masuk, uang keluar, dan pindah dana. Tiap baris wajib punya: rekening atau kas, cabang yang dibebani, jenis atau kategori, tanggal uang, pencatat, dan sumbernya (diketik, atau modul dan kejadian yang melahirkannya). Satu cara menandai sumber. |
| AK2 | **Mencatat dan memeriksa adalah langkah utuh di server.** Server yang menjaga status awal, urutan status, siapa boleh apa, dan bahwa pemeriksa bukan pengisinya (WAJ-06). Tidak ada perubahan status yang dikirim langsung dari layar. |
| AK3 | **Baris Buku Kas tidak dihapus dan tidak diubah setelah diperiksa** (PRI-02). Sebelum diperiksa: dikoreksi pengisinya, dengan jejak. Setelah diperiksa: **dibatalkan** dengan alasan oleh pemilik atau GM, lalu dicatat ulang; baris batal tetap terlihat. |
| AK4 | **Baris otomatis hanya lahir dari modulnya** (slip, Laporan Bongkaran, kasbon, uang pengiriman, Laporan Kasir, pembelian), satu baris per kejadian, bertaut, dan tidak bisa diketik, diubah, atau dibatalkan dari Keuangan; pembatalannya lewat modul asalnya. Kategori-kategori itu ditolak server kalau diketik tangan, bukan sekadar disembunyikan. |
| AK5 | **Rekening atau kas sumber wajib di semua baris**, termasuk yang otomatis: diisi pada langkah membayar (GAJ-48, DRV-26, DRV-47, DRV-63). Tidak ada lagi uang keluar "tanpa rekening". |
| AK6 | **Satu kejadian bayar, satu baris.** Tidak ada pasangan "biaya" dan "pembayaran" yang ditulis terpisah; baris gaji tidak dihitung ulang di tempat. Tanggalnya tanggal uang dibayar (dari server). Uraian (gaji kotor, kasbon kembali, denda ke Dana Disiplin) dibawa sebagai rincian baris itu (GAJ-56). |
| AK7 | **Saldo tiap rekening dan kas dihitung server di satu tempat** (WAJ-04). Saldo awal bertanggal dan dihitung mulai tanggal itu; setelah ada transaksi tidak diubah, koreksinya lewat baris **penyesuaian saldo** oleh pemilik atau GM dengan alasan. |
| AK8 | **Tanggal catat dari server** (PRI-01); tanggal uang diisi dengan batas pertanyaan 7. |
| AK9 | **Riwayat perubahan bisa dibuka di layar** dari tiap baris: siapa, kapan, isi sebelum dan sesudah, alasan. Perubahan oleh mesin mencatat modul pemicunya, bukan "kosong". |
| AK10 | **Satu halaman Pemeriksaan** dengan daftar yang menunggu, umur tiap baris, dan tanda lewat batas. Menyetujui banyak sekaligus tetap ada, dengan tombol tahan 3 detik dan jumlah rupiah yang akan disetujui ditampilkan (TAM-15). Menolak selalu wajib alasan. |
| AK11 | Yang ditolak kembali ke pengisinya di daftar **"Perlu Diperbaiki"** yang tidak dibatasi periode (dibawa dari sistem lama). |
| AK12 | **Kategori:** kode dibuat mesin; tanda "masuk hitungan laba" diganti **jenis** (biaya, pembelian barang, pengambilan pemilik, piutang karyawan, pindah dana). Mengubah jenis sebuah kategori **bertanggal berlaku** (WAJ-07) supaya laporan periode lama tidak berubah. Uang masuk juga berkategori (omzet, pelunasan kasbon, setoran modal, lain-lain). |
| AK13 | **Hak akses dijaga server dari satu daftar** (mesin pengaman hak akses), tidak ditulis ulang per halaman. Yang wajib dicoba mesin: karyawan dan HR tidak bisa membuka Buku Kas; finance tidak bisa memeriksa isiannya sendiri; tidak ada yang bisa mengubah baris yang sudah diperiksa. |

## 6A.9 Jawaban pemilik (12 Oktober 2026)

Arahan umum: semua temuan 6A diperbaiki di sistem baru dan tidak boleh
terulang (tabel "Temuan dan aturan yang mengatasinya" di 6A.10). Sistem lama
tidak disentuh (WAJ-09).

Keterangan pemilik tentang dirinya: tidak menguasai keuangan secara rinci dan
**tidak tahu arus kas perusahaan**; meminta dibantu sepenuhnya, meminta ditanya
balik tentang laporan yang diinginkan supaya hasilnya sesuai aturan akuntansi,
dan meminta **mesin yang otomatis mengisi ke pos yang tepat**. Isian uang
masuk dan uang keluar boleh panjang asal alurnya jelas. Kendala yang disebut:
cara menentukan saldo awal, karena uang keluar masuk sangat cepat.

| No | Jawaban |
|---|---|
| 1 | Petty cash = **uang tunai yang dititipkan kantor kepada finance**. Dipakai untuk: kasbon, konsumsi, gaji OB, uang bongkar, kebutuhan toko, kebutuhan grooming, operasional kantor, kebutuhan mobil, dan lain-lain. |
| 2 | Ok, ikuti saran: mengisi oleh finance (pemilik dan GM boleh); memeriksa oleh pemilik atau GM; HR tidak punya menu Keuangan; tidak ada yang memeriksa isiannya sendiri. |
| 3 | Alur tunai: toko cabang menyetor tunai → **brankas** → brankas memberi ke finance untuk petty cash. Uang brankas juga ditransfer ke supplier dan dipakai gajian. Brankas adalah **muara semua uang** dan **milik cabang Gudang**. |
| 4 | Bukti fisik selalu ada; di sistem baru **foto wajib**. |
| 5–9 | Ok semua: Pindah Dana; batas memeriksa 3 hari; tanggal uang tidak boleh masa depan dan paling jauh 7 hari ke belakang; Prive hanya pemilik atau GM; kategori hanya pemilik atau GM. |
| AK1–AK13 | Ok semua. |

### Pertentangan dan butir penutup (diajukan di percakapan, 12 Oktober 2026)

- **Pertentangan J (gaji OB dari petty cash).** GAJ-45 dan GAJ-56: gaji
  karyawan hanya dibayar pemilik dan hanya lahir dari slip; pengecualiannya
  hanya bongkaran. Kalau OB karyawan terdaftar, gajinya tidak bisa dibayar
  finance dari kas pegangan sebagai ketikan. Saran: OB dijadikan karyawan
  berslip; uangnya tetap boleh diambil dari Kas Pegangan atau Brankas sebagai
  sumber dana saat pemilik membayar slip.
- **Butir K.** Buku Petty Cash di sistem lama dipegang akun pemilik (270
  baris) dan akun HR (255 baris), bukan finance, dan nilainya Rp1,58 miliar
  dalam dua bulan. Ditanyakan: apakah buku akun pemilik itu sebenarnya buku
  **brankas**.
- **Butir L.** Siapa pemegang brankas, dan apakah petty cash punya jatah tetap
  atau diminta saat perlu.
- **Butir M (saldo awal).** Usulan: saldo awal diambil dari **hitung fisik
  pada satu malam "hari mulai"**, bukan dari riwayat.
- **Butir N (Hitung Kas).** Usulan: Brankas dan Kas Pegangan dihitung fisik
  tiap hari tutup; selisihnya dicatat.
- **Butir O (mesin pos).** Usulan: pencatat memilih **kejadian**, sistem yang
  menentukan pos, jenis arus kas, dan isian wajibnya.
- **Butir P.** Tiga pertanyaan tentang laporan yang diinginkan (dirinci lagi
  di 6D setelah laporan sistem lama dibaca).

### Jawaban atas pertentangan J dan butir K–P (12 Oktober 2026)

| Butir | Jawaban |
|---|---|
| J | Ok: OB berslip. |
| K | Petty Cash dipegang siapa pun yang berakun finance; pemilik meminta dicek ulang (hasilnya di koreksi 6A.2). Cara kerja sebenarnya: **Owner (Ibu, yang mengurus uang) hanya mencatat di Petty Cash**, di catatan khusus yang ia minta dibuatkan; semua uang keluar dan masuk dicatat di sana. Setelah itu **finance memisah-misahkannya dengan tangan** ke Kas Keluar dan pos-posnya, dan **ini sering terlewat**. Jadi pekerjaan sebenarnya terjadi di Petty Cash. |
| L | Pemegang brankas adalah **Owner**. Petty cash diberikan Owner ke finance, tetapi finance kadang disuruh mengambil sendiri dari brankas. Kenyataannya masih tumpang tindih dan belum disiplin; Owner tidak mau repot, dan itu haknya sebagai pemilik uang. Tidak ada jatah tetap. |
| P | Butuh ketiga laporan (arus kas, laba rugi, neraca) tetapi tidak tahu cara mengisi yang benar; meminta mesin penjaga dan aturan yang jelas. Urutan kepentingan: **(a)** uang ada berapa dan di mana, **(b)** cukup atau tidak 2–4 minggu ke depan, **(d)** uang habis ke mana, **(c)** cabang untung atau rugi. Dilihat harian, mingguan, bulanan, ditambah **3 bulan, 6 bulan, dan 1 tahun**. Yang melihat hanya **GM dan Owner**. |
| M | Ok. |
| N | Ok; pemilik memastikan "berarti ada hitungan kas setiap hari". |
| O | Belum dipahami; dijelaskan ulang di percakapan. |

### Butir Q, R, S dan penjelasan ulang O (diajukan di percakapan, 12 Oktober 2026)

- **Q (Catatan Cepat).** Pemilik uang cukup mencatat masuk atau keluar,
  nominal, dan keterangan singkat. Baris yang **sama** lalu dilengkapi finance
  (kejadian, cabang, foto bukti) dan diperiksa GM. Tidak ada pengetikan ulang
  ke buku lain; baris yang belum dilengkapi tampil dengan jumlah dan total
  rupiahnya.
- **R (uang keluar dari Brankas).** Siapa pun yang menerima uang dari Brankas
  mencatat Pindah Dana-nya; Owner tidak wajib mengonfirmasi. Tidak ada jatah
  tetap Kas Pegangan.
- **S (Hitung Kas Brankas).** Kas Pegangan dihitung finance tiap hari. Brankas
  dihitung **seminggu sekali**, boleh oleh GM atau finance di hadapan Owner;
  kalau terlewat hanya ditandai, tidak ada yang terkunci.
- **O**: daftar kejadian adalah menu pilihan finance; "peta" adalah tabel
  kejadian → pos. Hanya pemilik atau GM yang boleh menambah atau mengubah
  pilihannya; isi awalnya disusun Claude dan disetujui GM.

### Jawaban atas butir Q, R, S, dan O (12 Oktober 2026)

| Butir | Jawaban |
|---|---|
| Q | Catatan Owner memang singkat dan kadang tidak jelas. Finance yang melengkapi, **tetapi harus ada SOP yang jelas**; GM memeriksa: ok. Pengingat pemilik: Owner memegang **semua uang** (brankas dan semua rekening); finance hanya melengkapi; sebagian pengeluaran dikirim Owner lewat **grup WhatsApp**. |
| R | Ok (sebaiknya begitu): penerima uang dari Brankas yang mencatat Pindah Dana. |
| S | Ok: Kas Pegangan dihitung tiap hari, Brankas seminggu sekali. |
| O | Pemilik meminta Claude memeriksa istilah yang dipakai finance dan Owner di Petty Cash sistem lama, lalu menafsirkannya (boleh kira-kira). |

Keterangan tambahan pemilik: Laporan Kasir dibuat supaya uang tunai dari toko
**tidak perlu diketik ulang oleh finance** (dirinci di 6B).

### Istilah di Petty Cash sistem lama (dibuka atas permintaan pemilik, 12 Oktober 2026)

Yang dihitung adalah kata pembuka dan kata yang berulang, bukan isi tiap baris.
Nama orang tidak disalin ke sini.

Buku Owner (270 baris):

| Tulisan | Berapa kali | Jumlah | Tafsiran Claude |
|---|---|---|---|
| Masuk: "gudang" | 34 | Rp1.062.536.115 | Setoran uang dari cabang Gudang |
| Masuk: "tokpus" | 34 | Rp304.102.400 | Setoran dari Toko Pusat |
| Masuk: "tokdep" | 33 | Rp93.167.800 | Setoran dari satu toko lain (ditanyakan, butir U) |
| Keluar: nama supplier saja ("kenzi", "aina", "frontera", "ziolit", "jagung") | 20 lebih | lebih dari Rp1 miliar | Bayar supplier |
| Keluar: "rek bri" | 3 | Rp54.360.500 | Setor ke rekening bank (pindah dana, bukan pengeluaran) |
| Keluar: "peticase gd" | 3 | Rp3.500.000 | Isi kas kecil (pindah dana) |
| Keluar: "aku" | 6 sampai 8 | Rp22.000.000 | Diambil Owner sendiri (ditanyakan, butir U) |
| Keluar: "gji" atau "gaji" + nama | 12 | kecil | Gaji atau upah orang itu |
| Keluar: **nama orang saja** | puluhan | Rp900 ribu s.d. Rp2,8 juta per nama | **Tidak bisa ditafsirkan**: bisa gaji, kasbon, atau uang jalan |
| Keluar: "uj" | 4 | Rp660.000 | Uang jalan |
| Keluar: "shopee" | 2 sampai 3 | Rp4.000.000 | Belanja online (barangnya tidak disebut) |

Semua uang masuk di buku Owner hanya dari tiga sumber itu. Buku ini tidak
membedakan tunai dari brankas dan transfer dari rekening.

Buku Finance (255 baris), kata yang paling sering:

| Tulisan | Berapa kali | Tafsiran Claude |
|---|---|---|
| "masak", "masak belanja", "galon kantor", "galon gudang" | 41 | Konsumsi (makan dan minum karyawan) |
| "bensin" + kendaraan ("beat", "revo", "ninja", "grandmax"), "solar", "pengisian solar" | 48 | Bahan bakar, per kendaraan |
| "kasbon" + nama | 30 | Kasbon karyawan |
| "bongkar" + nama supplier, "bongkar muat", "upah" | 33 | Upah bongkaran |
| "isi angin", "tambal ban", "service" | 14 | Perawatan kendaraan |
| "gaji teh…", "gaji ceu…" | 9 | Gaji orang yang dipanggil "teh" dan "ceu" (OB atau pekerja rumah tangga) |
| "kebutuhan pet" | 7 | Kebutuhan hewan |
| "sunlight", "wipoll", "kresek toko", "kabel" | 12 lebih | Perlengkapan toko dan kebersihan |
| "fotocopy form" | 3 sampai 5 | Alat tulis dan cetak |
| "barter cash", "bt cash" | 5 | Tukar uang (ditanyakan, butir U) |
| "raja", "box", "markas" | 14, 9, 5 | Belum bisa ditafsirkan (ditanyakan, butir U) |
| Masuk: "isi saldo" | 5 sampai 7 | Kas kecil diisi dari Owner (pindah dana) |
| Masuk: "ganti kasbon" | 3 sampai 4 | Kasbon dikembalikan tunai |
| Masuk: "kembalian solar" | 2 sampai 3 | Sisa uang belanja dikembalikan |

Kolom kategori Petty Cash kosong di 519 dari 525 baris; enam sisanya berisi
nama orang atau nama barang.

### Butir T dan U (diajukan di percakapan, 12 Oktober 2026)

- **T (SOP Catatan Cepat).** Enam langkah tertulis; lihat aturan 25 s.d. 28
  di 6A.10.
- **U (istilah).** Arti "tokdep", "aku", "barter cash", dan "raja", "box",
  "markas"; dan apa yang ditulis Owner kalau hanya menyebut nama orang.

### Jawaban atas butir T dan U (12 Oktober 2026)

| Butir | Jawaban |
|---|---|
| T | SOP ok. Tetapi layar Owner harus **lebih sederhana**: memilih bertingkat akan memusingkan. Usulan pemilik: layar berisi **kotak-kotak**; Owner mengisi kotak yang sesuai (misalnya kotak Gaji) dengan **angka dan keterangan**, lalu menekan "OK, catat". Untuk uang masuk cukup **satu kotak**: nominal dan asal uangnya. |
| U1 | "tokdep" = Toko Depan. |
| U2 | "Ya betul" (dibaca Claude: setoran cabang lain tercatat bersama "gudang"; dipastikan di 6B dari Laporan Kasir). |
| U3 | "aku" = diambil untuk keperluan pribadi. **Jangan memakai istilah akuntansi** di layar Owner; beliau tidak terbiasa. |
| U4 | "barter cash" = tukar uang tunai dengan transfer. |
| U5 | Pemilik menduga "raja" dan "markas" setoran cabang dan "box" cicilan. **Hasil cek data:** "raja" dan "markas" adalah nama cabang (Raja Petshop, Markas Petshop) dan muncul sebagai "bensin ke raja", "ke markas" (ongkos perjalanan ke cabang itu); "box" adalah **mobil box** ("solar box", "ban box", "angin box"), bukan cicilan. |

Keterangan pemilik tentang Laporan Kasir: Owner menulis sendiri "tokdep" dan
"tokpus" tiap ada setoran; Gudang tidak punya admin khusus. Niat pemilik:
**Owner cukup memverifikasi**, tidak menulis.

Sudah diputuskan (lihat "Tambahan pemilik" di bawah); semula dibawa ke 6E: TAM-15 mewajibkan tombol konfirmasi uang ditahan 3
detik. Saran Claude: tombol "OK, catat" di layar Catatan Cepat dikecualikan
(catatan itu belum berakibat ke siapa pun dan masih bisa dikoreksi), diganti
nominal yang ditampilkan besar beserta tulisan terbilangnya; tombol "Terima"
setoran tetap ditahan 3 detik. Sampai diputuskan, TAM-15 berlaku apa adanya.

### Tambahan pemilik setelah 6A ditutup (12 Oktober 2026)

- Owner kadang juga mencatat **pengeluaran operasional** (bensin dan
  sejenisnya): kotak **Operasional** ditambahkan ke Catatan Cepat (aturan 31).
- **Uang Gudang kadang ditulis Owner sendiri**: kotak Uang Masuk tetap dipakai
  untuk itu sampai Gudang punya pelapornya (dibahas di 6B).
- Pengecualian TAM-15 **disetujui**: Owner tidak boleh dibuat menunggu
  (aturan 35; TAM-15 sudah diberi catatan pengecualian).

## 6A.10 Aturan yang dihasilkan (nomor v3 ditetapkan di 6E)

Sudah diputuskan:

| No | Aturan | Asal |
|---|---|---|
| 1 | **Satu Buku Kas** untuk uang masuk, uang keluar, dan pindah dana. Tiap baris wajib punya rekening atau kas, cabang yang dibebani, kategori, tanggal uang, pencatat, dan sumbernya (diketik, atau modul dan kejadian yang melahirkannya). Satu cara menandai sumber. | AK1 |
| 2 | **Tempat uang** adalah daftar pengaturan, bukan tulisan di kode: rekening bank; **laci toko** tiap cabang (dirinci di 6B); **Brankas**, milik cabang Gudang, muara semua uang tunai; **Kas Pegangan**, uang tunai kantor yang dititipkan kepada finance. | jawaban 3 |
| 3 | **Kas Pegangan menggantikan Petty Cash.** Hanya terisi lewat Pindah Dana (dari Brankas), dan tiap pengeluarannya adalah baris Kas Keluar biasa: berkategori, bercabang, berbukti, dan diperiksa. Buku pribadi tanpa pemeriksaan tidak ada lagi. | jawaban 1 dan 3 |
| 4 | **Pindah Dana** antar rekening dan kas adalah jenis catatan tersendiri: satu langkah yang mengurangi tempat asal dan menambah tempat tujuan sekaligus. Bukan pemasukan, bukan pengeluaran, tidak memengaruhi laba. | pertanyaan 5 |
| 5 | **Mengisi** Buku Kas: finance, pemilik, GM. **Memeriksa:** pemilik atau GM. **HR tidak punya menu Keuangan.** Tidak ada yang memeriksa isiannya sendiri. Semuanya dijaga server. | jawaban 2 |
| 6 | **Foto bukti wajib** untuk setiap Kas Keluar yang diketik; tanpa foto, isian ditolak. | jawaban 4 |
| 7 | **Batas memeriksa 3 hari.** Lewat itu baris ditandai untuk pemilik dan GM; tidak otomatis disetujui atau ditolak. | pertanyaan 6 |
| 8 | **Tanggal catat dari server.** Tanggal uang tidak boleh masa depan dan paling jauh 7 hari ke belakang; lebih jauh hanya pemilik atau GM, dengan alasan. | pertanyaan 7, AK8 |
| 9 | **Prive** hanya dicatat pemilik atau GM. | pertanyaan 8 |
| 10 | **Kategori** hanya ditambah atau diubah pemilik atau GM. Kodenya dibuat mesin. Tiap kategori punya **jenis** (biaya, pembelian barang, pengambilan pemilik, piutang karyawan); mengubah jenis bertanggal berlaku, sehingga laporan periode lama tidak berubah. Uang masuk juga berkategori. | pertanyaan 9, AK12 |
| 11 | **Mencatat dan memeriksa adalah langkah utuh di server**: status awal, urutan status, siapa boleh apa. Tidak ada perubahan status yang dikirim langsung dari layar. | AK2 |
| 12 | **Baris Buku Kas tidak dihapus dan tidak diubah setelah diperiksa.** Sebelum diperiksa: dikoreksi pengisinya, dengan jejak. Setelah diperiksa: dibatalkan pemilik atau GM dengan alasan, lalu dicatat ulang; baris batal tetap terlihat. | AK3 |
| 13 | **Baris otomatis hanya lahir dari modulnya** (slip, Laporan Bongkaran, kasbon, uang pengiriman, Laporan Kasir, pembelian), satu baris per kejadian, bertaut. Tidak bisa diketik, diubah, atau dibatalkan dari Keuangan; pembatalannya lewat modul asal. Server menolak kategori itu kalau diketik tangan. | AK4 |
| 14 | **Rekening atau kas sumber wajib di semua baris**, termasuk yang otomatis; diisi pada langkah membayar. | AK5 |
| 15 | **Satu kejadian bayar, satu baris**, bertanggal hari uang dibayar. Tidak ada pasangan "biaya" dan "pembayaran" terpisah; baris tidak dihitung ulang di tempat. Uraiannya dibawa sebagai rincian baris. | AK6 |
| 16 | **Saldo tiap rekening dan kas dihitung server di satu tempat.** Saldo awal bertanggal dan dihitung mulai tanggal itu; setelah ada transaksi tidak diubah. Koreksinya lewat baris penyesuaian saldo oleh pemilik atau GM dengan alasan. | AK7 |
| 17 | **Riwayat perubahan bisa dibuka di layar** dari tiap baris: siapa, kapan, sebelum dan sesudah, alasan. Perubahan oleh mesin mencatat modul pemicunya. | AK9 |
| 18 | **Satu halaman Pemeriksaan**: daftar yang menunggu, umur tiap baris, tanda lewat batas. Menyetujui banyak sekaligus memakai tombol tahan 3 detik dan menampilkan jumlah rupiahnya. Menolak selalu wajib alasan. | AK10 |
| 19 | Yang ditolak kembali ke pengisinya di daftar **"Perlu Diperbaiki"** yang tidak dibatasi periode. | AK11 |
| 20 | **Hak akses dijaga server dari satu daftar** dan dicoba mesin pengaman: karyawan dan HR tidak bisa membuka Buku Kas; pengisi tidak bisa memeriksa isiannya sendiri; tidak ada yang bisa mengubah baris yang sudah diperiksa. | AK13 |

Aturan dari butir penutup J–U (semuanya sudah dijawab pemilik):

| No | Usulan | Butir |
|---|---|---|
| 21 | **Saldo awal dari hitung fisik** (disetujui, butir M). Dipilih satu "hari mulai". Malam itu, setelah semua toko tutup: uang di Brankas, Kas Pegangan, dan tiap laci dihitung; saldo tiap rekening bank dibaca dari mutasi. Angka-angka itu menjadi saldo awal. Riwayat sebelum hari mulai tidak diperlukan untuk saldo. | M |
| 22 | **Hitung Kas** (disetujui, butir N; jadwal Brankas di aturan 30). Kas Pegangan dihitung fisik tiap hari tutup oleh pemegangnya. Sistem menampilkan saldo menurut catatan; pemegang mengetik hasil hitung tanpa melihat angka sistem lebih dulu. Selisih tercatat sebagai baris tersendiri dan ditandai untuk pemilik dan GM. | N |
| 23 | **Mesin pos** (disetujui, butir O; isi awal daftar kejadian disusun dari istilah Petty Cash lama dan diajukan di 6E). Pencatat memilih **kejadian** dari daftar (misalnya "beli bensin mobil", "bayar listrik toko"); sistem menentukan kategori, jenis arus kas (operasional, investasi, pendanaan), dan isian wajibnya (misalnya mobil yang mana). Daftar kejadian dan petanya adalah pengaturan pemilik atau GM. Kategori tidak dipilih bebas. | O |
| 24 | **OB berslip** (disetujui, butir J). Gaji OB dibayar lewat slip seperti karyawan lain (GAJ-45, GAJ-56); Kas Pegangan atau Brankas hanya menjadi sumber dananya. | J |
| 25 | **Catatan Cepat** (disetujui, butir T). Pemilik uang mencatat sesingkat mungkin lewat layar kotak-kotak (aturan 31). Baris itu **langsung masuk hitungan saldo** karena uangnya sudah bergerak, dan bertanda "belum dilengkapi". Finance juga boleh membuat Catatan Cepat **atas nama** pemilik uang dari pesan WhatsApp; tercatat siapa yang mengetik dan tangkapan layar pesannya menjadi lampiran. | Q, T |
| 26 | **Melengkapi** (disetujui, butir T). Finance melengkapi baris yang sama (kejadian, cabang, foto bukti) paling lambat **hari kerja berikutnya**; tidak ada pengetikan ulang ke buku lain. Layar finance selalu menampilkan jumlah dan total rupiah catatan yang belum dilengkapi, dengan umurnya. Lewat batas: ditandai untuk GM. | Q, T |
| 27 | **Finance tidak menebak** (disetujui, butir T). Kalau catatannya tidak jelas, finance menandai "perlu ditanyakan"; baris itu muncul di daftar pemilik uang dan GM. Selama belum jelas, di laporan ia tampil di pos **"Belum dipilah"**, sehingga jumlah uang tetap benar dan yang belum jelas terlihat besarnya. | Q, T |
| 28 | **Setelah lengkap, diperiksa GM atau pemilik lain** (disetujui, butir T) (aturan 5 dan 7). Pemilik uang tidak memeriksa catatannya sendiri. Nominal dan arah (masuk atau keluar) Catatan Cepat hanya dikoreksi pencatatnya atau lewat pembatalan (aturan 12); finance tidak mengubah nominal. | Q, T |
| 29 | **Uang keluar dari Brankas dicatat penerimanya** sebagai Pindah Dana; pemegang Brankas tidak wajib mengonfirmasi dan bisa melihatnya kapan saja. Kas Pegangan tidak punya jatah tetap. | R |
| 30 | **Brankas dihitung fisik seminggu sekali**, boleh oleh GM atau finance di hadapan pemegangnya. Kalau terlewat hanya ditandai; tidak ada yang terkunci. | S |
| 31 | **Layar Catatan Cepat berupa kotak-kotak**, satu kotak satu jenis. Uang keluar: tiap kotak hanya meminta **angka dan keterangan**, lalu tombol "OK, catat". Uang masuk: **satu kotak**, berisi nominal dan asal uangnya. Tidak ada pilihan bertingkat. Satu pilihan tambahan saja: tunai dari Brankas (bawaan) atau transfer; rekeningnya dipilih finance saat melengkapi. Isi awal kotak (ditetapkan di 6E): Supplier, Gaji/Upah, Kasbon, Uang Jalan, **Operasional** (bensin dan sejenisnya), Isi Kas Finance, Setor Bank, Pribadi, Lainnya, dan Uang Masuk. Tiap kotak sudah terpaut ke posnya, sehingga jenisnya pasti walaupun keterangannya singkat. | T |
| 32 | **Layar pemilik uang memakai bahasa sehari-hari**, bukan istilah akuntansi: "Pribadi" (bukan prive), "Setor Bank" dan "Isi Kas Finance" (bukan pindah dana), "Uang Masuk". Istilah akuntansi hanya muncul di laporan dan pengaturan. | U3 |
| 33 | (Dilapisi 6B.10 aturan 8 dan 20, 12 Oktober 2026: setoran toko diterima dan disetorkan ke Brankas oleh finance; pemegang Brankas hanya menekan "Terima" untuk uang yang ia periksa sendiri, misalnya dari driver.) **Setoran yang sudah dilaporkan tidak ditulis ulang.** Uang yang datang ke Brankas dari Laporan Kasir atau dari uang pengiriman tampil di layar pemegang Brankas sebagai daftar "menunggu diterima"; ia cukup menekan **"Terima"** (atau "Tidak cocok" dengan angka yang benar). Kotak Uang Masuk hanya untuk uang yang belum punya laporan asalnya. Rinciannya di 6B. | keterangan pemilik |
| 34 | Tukar uang tunai dengan transfer ("barter cash") dicatat sebagai Pindah Dana. | U4 |
| 35 | **Pengecualian TAM-15:** tombol "OK, catat" di Catatan Cepat **tidak ditahan 3 detik**; gantinya nominal ditampilkan besar beserta tulisan terbilangnya. Tombol "Terima" setoran tetap ditahan 3 detik. | tambahan pemilik |

### Temuan dan aturan yang mengatasinya

| Temuan | Aturan |
|---|---|
| Petty Cash Rp1,58 miliar di luar pemeriksaan, tanpa jejak, tidak bertaut | 3, 4, 22, 25–28, 30 |
| Catatan pemilik uang diketik ulang finance ke pos-pos dan sering terlewat; catatan hanya nama orang | 25–27, 31 |
| Setor bank dan isi kas kecil tercatat sebagai "keluar" | 4, 31, 34 |
| Baris disetujui masih diubah (157 kali oleh orang) | 11, 12, 20 |
| Baris disetujui terhapus (50 baris) | 12 (PRI-02) |
| Pengisi memeriksa isiannya sendiri (22 kali); isian lahir langsung disetujui | 5, 11 |
| Yang memeriksa bukan yang tertulis di layar; hak akun tidak sama dengan jabatan (akun `hr` dipegang orang Finance) | 5, 20 |
| 647 pengeluaran tanpa rekening sumber | 14 |
| Satu "Kas Tunai" untuk semua; pindah uang tidak bisa dicatat | 2, 4 |
| Tanggal masa depan disetujui; ketikan mundur berminggu-minggu | 8 |
| Tidak ada bukti | 6 |
| Jejak perubahan tanpa layar dan tanpa pelaku | 17 |
| Menunggu diperiksa sampai 30 hari tanpa tanda | 7, 18 |
| Gaji dicatat tiga cara; biaya dan pembayaran gaji driver tidak berpasangan | 13, 15 |
| Kategori gaji, supplier, dan kasbon hanya ditahan layar | 13 |
| Tanda "masuk hitungan laba" mengubah laporan bulan lalu | 10 |
| Saldo awal bisa diubah kapan saja; tanggalnya tidak dipakai | 16, 21 |
| Kode kategori rusak; kategori tak terpakai | 10 |
| Daftar hak akses ditulis di tujuh halaman | 20 |
| Catatan gaji tidak dibuat diam-diam kalau orangnya tanpa cabang | 13, 14 (membayar gagal dengan pesan, bukan diam) |
| Uang masuk bukan omzet tidak punya tempat | 10 |

### Titipan dari 6A

- Untuk 6B: Owner cukup menekan "Terima" untuk setoran (aturan 33); Gudang tidak punya admin khusus, jadi siapa yang melaporkan uang Gudang; apakah setoran Raja Petshop dan Markas Petshop memang tercatat bersama "gudang". Kas Masuk omzet toko yang diketik ("Input Kasir Darurat") dan
  jalan cadangannya; "pengeluaran dari uang hari itu" (Rp23,55 juta tanpa
  kategori); selisih kasir; setoran laci toko ke Brankas sebagai Pindah Dana;
  **arti setoran toko ke Brankas milik Gudang** (membayar nota cabang, atau
  sekadar mengumpulkan uang).
- Untuk 6C: pembayaran supplier dari Brankas (tunai) dan dari bank.
- Untuk 6E: isi awal daftar kejadian (aturan 23) dan kotak Catatan Cepat (aturan 31); istilah baru untuk kamus.
- Untuk 6D: laporan arus kas, posisi kas harian, perkiraan kas; jawaban butir
  P; laporan yang sekarang dibuat pemilik dibaca dulu.
- Untuk keputusan data lama: 9 baris gaji ketikan (Rp26.040.000) yang mungkin
  dobel; saldo awal tidak dipindah dari sistem lama (aturan 21).

---

# Bagian 6B: Laporan Kasir dan uang pengiriman

Sumber: `hris-app/app/(dashboard)/laporan-kasir/page.tsx` (549 baris),
`components/VerifikasiLaporanKasir.tsx` (566), `components/SelisihKasirCard.tsx`
(79), `lib/cashierReport.ts`, tab Selisih Kasir dan peringatan dobel di
`keuangan/kas-masuk/page.tsx`, `penggajian/kehilangan/kasir/page.tsx` (526),
`keuangan/logistik/page.tsx` (266), `docs/RENCANA-LAPORAN-KASIR.md`; tabel
`cashier_reports`, `cashier_report_payments`, `cashier_report_expenses`,
`cashier_report_settings`, `cashier_method_accounts`, `cashier_loss_entries`,
`cashier_loss_configs`; fungsi `save_cashier_report`, `delete_cashier_report`,
`approve_cashier_report`, `reject_cashier_report`, `unapprove_cashier_report`,
`recompute_cashier_report_loss`, `get_my_cashier_report_branches`,
`set_cashier_report_start_date`, `sync_visit_cash_in`, `sync_loading_cash_in`,
`guard_auto_rows`.

Yang sudah diputuskan di bab lain dan tidak ditanyakan lagi:

- Pemeriksaan uang pengiriman (Cocok atau Tidak Cocok, 3 hari, riwayat,
  pembatalan beralasan), alirannya ke Kas Masuk cabang pemilik nota, dan
  tanggalnya: LOG-62 s.d. 64. Galiannya di 4C (LOG-C32 s.d. C46); **tidak
  digali ulang di sini**.
- Piutang toko, titipan toko, dan pelunasan dipegang sistem kasir; HRIS tidak
  punya Buku Piutang (LOG-65, LOG-66). Lebih bayar adalah titipan toko, bukan
  pemasukan (LOG-49).
- Minus kas ditanggung orang yang menutup shift; tanpa nama dibagi rata ke
  jabatan tertanda; kelebihan hanya menutup minus; masuk periode 26–25 menurut
  tanggal kejadian (GAJ-20, GAJ-38, GAJ-50).
- Tempat uang (laci toko, Brankas, Kas Pegangan), Pindah Dana, tombol "Terima"
  untuk setoran, foto bukti wajib untuk uang keluar yang diketik (6A.10 aturan
  2, 4, 6, 33).

## 6B.1 Bagian ini mengurus apa

Jalan uang penjualan toko sampai tercatat di Buku Kas: kasir menutup shift dan
melapor, uang tunai disetor, uang non-tunai dicocokkan dengan mutasi rekening,
dan selisihnya menjadi minus kas atau kelebihan kas. Termasuk cara cadangan
kalau kasir tidak melapor, dan penjualan Gudang yang tidak punya kasir.

## 6B.2 Data di sistem lama (dicek ke database, 12 Oktober 2026)

| Data | Isinya | Tabel | Jumlah baris |
|---|---|---|---|
| Laporan Kasir | Cabang, tanggal, shift, pelapor, foto struk, cash, piutang, selisih kasir, keterangan, status; hasil periksa (cash diterima, titipan, selisih final, tanda "sudah masuk Kas Masuk") | `cashier_reports` | 9 (10 s.d. 12 Oktober 2026), **semuanya menunggu** |
| Rincian non-tunai | Nama metode (diketik bebas), nominal, rekening (diisi saat periksa) | `cashier_report_payments` | 11: "qris" 9, "trf bca" 1, "trf bri" 1 |
| Rincian pengeluaran | Keterangan bebas, nominal | `cashier_report_expenses` | 8 (Rp392.169) |
| Pengaturan | Satu tanggal mulai | `cashier_report_settings` | 1, **tanggal mulai kosong** |
| Rekening per metode | Cabang, nama metode, rekening | `cashier_method_accounts` | **0** |
| Minus kas | Cabang, tanggal, bulan dan tahun, nominal, karyawan, sumber otomatis | `cashier_loss_entries` | 8, semuanya ketikan tangan (Mei s.d. September), 1 tanpa nama |
| Jabatan penanggung | Cabang, jabatan, aktif | `cashier_loss_configs` | 7 |

Keadaan data:

- **Laporan Kasir baru berumur tiga hari dan belum pernah diperiksa.** 9
  laporan dari tiga toko (Toko Pusat 5, Toko Depan 3, Raja Petshop 1); yang
  tertua sudah menunggu lebih dari 2 hari. Tanggal mulai kosong dan rekening
  per metode belum diisi, jadi kalaupun disetujui hari ini, tidak ada satu
  rupiah pun yang masuk Kas Masuk atau potongan.
- **Dua tempat belum pernah melapor:** Markas Petshop (1 karyawan, Kepala
  Toko) dan **Gudang**. Untuk 10 s.d. 12 Oktober keduanya masih diketik
  finance di Kas Masuk (Gudang 6 baris Rp223.648.464 dalam 2 hari; Markas 4
  baris). Untuk tiga toko yang sudah melapor, belum ada baris ketikan pada
  tanggal yang sama (belum dobel, tetapi omzet tiga toko itu sejak 10 Oktober
  **belum tercatat di mana pun** di Kas Masuk).
- **Gudang adalah uang terbesar dan tidak punya pelapor.** Dari Rp11,25 miliar
  Kas Masuk disetujui, Rp8,12 miliar milik Gudang (146 baris); Toko Pusat
  Rp2,18 miliar, Toko Depan Rp539 juta, Raja Rp422 juta, Markas Rp149 juta.
- **Pelapor bukan selalu kasir:** dari 9 laporan, 7 oleh Kasir, 1 Pramuniaga
  (Toko Pusat), 1 Groomer (Raja Petshop). Raja Petshop hanya punya 2 karyawan.
- **Kelebihan kas jauh lebih sering daripada kekurangan.** Di Kas Masuk lama:
  lebih 151 kali (Rp2.826.146), kurang 45 kali (Rp1.394.653). Toko Pusat lebih
  56 kali Rp1,92 juta; Toko Depan lebih 55 kali Rp767 ribu.
- **Kekurangan yang tercatat hampir tidak pernah sampai ke potongan gaji.**
  Agustus s.d. Oktober tercatat kurang 45 kali (Rp1.394.653) di Kas Masuk;
  pada bulan yang sama halaman Minus Kas hanya berisi 2 baris (Rp192.128).
  Kedua catatan tidak bertaut, jadi tidak bisa dipastikan mana yang sengaja
  tidak dipotong dan mana yang terlewat.
- **Pengeluaran dari laci bukan uang receh di Toko Pusat:** 47 kali
  Rp20.025.300 (rata-rata Rp426 ribu); toko lain 18 s.d. 28 kali, rata-rata
  Rp33 ribu s.d. Rp62 ribu. Semuanya hanya mengurangi Kas Masuk: tanpa
  kategori, tanpa bukti, tidak muncul sebagai biaya.
- **Uang transfer toko sering masuk rekening milik cabang lain:** Toko Depan
  94 dari 106 baris bank; Toko Pusat 135 dari 302; Markas semua (tidak punya
  rekening sendiri). Uang tunai semua toko masuk satu "Kas Tunai".
- **Ketikan Kas Masuk terlambat:** sejak Agustus, tengahnya 2 hari setelah
  tanggal uangnya, paling lama 23 hari; 264 dari 871 baris diketik 3 hari
  atau lebih sesudahnya.
- 4 dari 9 laporan memuat lebih dari satu foto struk (dua sistem kasir masih
  berjalan bersamaan).
- **"Logistik" di menu Keuangan bukan uang pengiriman.** Halaman
  `keuangan/logistik` menampilkan cabang bernama Logistik (0 karyawan, 2
  rekening): 30 baris Kas Masuk Rp96.195.000 berupa **sewa yang dibayar
  cabang lain** (toko, kendaraan, parkir). Itu uang berpindah di dalam
  perusahaan sendiri tetapi tercatat sebagai pemasukan. Cabangnya dicari
  dengan nomor pengenal yang ditulis di kode. Dititipkan ke 6D.
- 10 baris Kas Masuk tanpa rekening bernilai Rp5,6 miliar (2 baris per
  cabang; kemungkinan rekap bulanan saat impor awal). Dititipkan ke keputusan
  data lama.

## 6B.3 Aturan yang ditemukan

### Mengisi Laporan Kasir

| No | Aturan | Sumber |
|---|---|---|
| KEU-B01 | Laporan diisi orang yang menutup kasir, satu per cabang per tanggal per shift, **paling banyak 2 shift** (dijaga database). Pelapor = akun yang sedang masuk. | `save_cashier_report`, `UNIQUE (branch_id, report_date, shift)` |
| KEU-B02 | Yang boleh mengisi: karyawan aktif cabang toko **kecuali jabatan bernama "Driver", "Kepala Gudang", "Helper"**; pemilik, HR, finance untuk cabang mana pun termasuk Gudang. "Cabang toko" = cabang yang terdaftar sebagai asal nota, atau cabang **bernama "Gudang"**. Nama jabatan dan nama cabang ditulis di kode. | `get_my_cashier_report_branches` |
| KEU-B03 | Isi: tanggal, shift, foto struk (wajib, paling banyak 6, boleh dari galeri), Cash, non-tunai per metode (**nama metode diketik bebas**), Piutang, daftar pengeluaran (keterangan bebas dan nominal, **tanpa foto**), selisih kasir (tidak ada, lebih, kurang), keterangan. | `laporan-kasir/page.tsx` |
| KEU-B04 | Total omzet = Cash + non-tunai + Piutang; **uang cash yang disetor** = Cash − pengeluaran ± selisih kasir. Dihitung di layar kasir, di layar finance, dan lagi di database. | `lib/cashierReport.ts`, `approve_cashier_report` |
| KEU-B05 | Tanggal dipilih pelapor: tidak boleh masa depan; karyawan paling jauh 7 hari ke belakang, kantor bebas. Shift dipilih tangan. Hari ini dihitung server. | `save_cashier_report` |
| KEU-B06 | Selama belum disetujui, pelapor (atau kantor) boleh **mengubah** dan **menghapus** laporannya. Mengubah = rincian lama dihapus lalu ditulis ulang; menghapus benar-benar hilang. Tidak ada jejak perubahan (tabel ini tidak ikut jejak keuangan). | `save_cashier_report`, `delete_cashier_report` |
| KEU-B07 | Kasir tidak mengisi nama konsumen tempo, nota kiriman, atau pelunasan; "Piutang" ditulis apa adanya dari struk. | `RENCANA-LAPORAN-KASIR.md` aturan 10, 11 |

### Memeriksa

| No | Aturan | Sumber |
|---|---|---|
| KEU-B08 | Yang memeriksa: pemilik, **HR**, finance. **Tidak ada larangan memeriksa laporan sendiri** (kantor yang mengisi laporan Gudang bisa menyetujuinya sendiri). | `is_cashier_report_admin` |
| KEU-B09 | Tunai: finance mengetik **cash yang diterima**. Selisih kasir final = (cash diterima − titipan) − (Cash − pengeluaran), dibebankan ke **pelapor**, siapa pun yang membawa uangnya ke kantor. | `approve_cashier_report` |
| KEU-B10 | Non-tunai: finance hanya memilih rekening per metode. Kalau tidak cocok dengan mutasi, satu-satunya jalan **Tolak** (kasir memperbaiki); tidak ada tempat mengetik angka yang benar. | sama; teks layar |
| KEU-B11 | Menolak wajib alasan; laporan kembali ke pelapor, diperbaiki, berstatus "sudah diperbaiki", diperiksa lagi. | `reject_cashier_report` |
| KEU-B12 | "Titipan pelunasan": bagian dari cash diterima yang bukan omzet hari itu. Kalau konsumennya dipilih, dicatat sebagai pelunasan di Buku Piutang; kalau tidak, menjadi Kas Masuk "titipan pelunasan". | `approve_cashier_report` |
| KEU-B13 | Rekening per metode per cabang diingat dari pilihan terakhir; kuncinya **nama metode huruf kecil**, jadi "QRIS" dan "Qris BCA" dua metode berbeda. | `set_cashier_method_account` |
| KEU-B14 | Persetujuan bisa **dibatalkan kapan saja, tanpa alasan**: baris Kas Masuk otomatisnya **dihapus**, potongan dihitung ulang, laporan kembali menunggu. | `unapprove_cashier_report` |
| KEU-B15 | Tidak ada batas waktu memeriksa dan tidak ada tanda untuk laporan yang lama menunggu. | tidak ada |

### Aliran ke Kas Masuk

| No | Aturan | Sumber |
|---|---|---|
| KEU-B16 | Laporan yang disetujui menulis Kas Masuk berstatus disetujui: satu baris tunai (omzet = Cash, "pengeluaran" = total pengeluaran, selisih = selisih final) dan satu baris per metode non-tunai; bertanggal **tanggal laporan**. Piutang tidak menjadi baris. | `approve_cashier_report` |
| KEU-B17 | Semua itu **hanya berjalan kalau tanggal mulai diisi** dan tanggal laporan tidak lebih awal darinya. Kalau tidak, laporan hanya ditandai disetujui "tanpa Kas Masuk". Satu sakelar yang sama menghidupkan Kas Masuk dari uang pengiriman dan pelunasan piutang. | `cashier_report_settings`, `set_cashier_report_start_date` |
| KEU-B18 | Pengeluaran dari laci **tidak menjadi Kas Keluar**: hanya mengurangi uang diterima, tanpa kategori, tanpa bukti. | struktur `fin_cash_in` |
| KEU-B19 | Tunai dicatat ke satu "Kas Tunai" perusahaan. Tidak ada catatan uang berpindah dari toko ke kantor atau ke pemegang uang. | `kasTunai`, tidak ada tabel |
| KEU-B20 | Baris otomatis tidak bisa diubah dari halaman Kas Masuk (dijaga database lewat satu sakelar sesi). | `guard_auto_rows` |

### Selisih kasir dan potongan

| No | Aturan | Sumber |
|---|---|---|
| KEU-B21 | Per pelapor per cabang per **bulan kalender**: satu baris minus kas otomatis = minus − plus, yang **ditimpa** tiap ada laporan disetujui atau dibatalkan. Plus hanya menutup minus (termasuk minus ketikan tangan bulan itu). | `recompute_cashier_report_loss` |
| KEU-B22 | Halaman Minus Kas (ketikan tangan) tetap ada di samping yang otomatis; baris tanpa nama dibagi ke jabatan tertanda per cabang. | `kehilangan/kasir/page.tsx`, galian 3B |
| KEU-B23 | Karyawan melihat kartu "Selisih Kasir" bulan berjalan di dashboard: minus, plus, potongan. Hitungannya diulang di layar. | `SelisihKasirCard.tsx` |
| KEU-B24 | Jabatan tertanda penanggung berisi jabatan yang tidak memegang kasir (Kepala Gudang di Gudang, Admin Supervisor di Back Office). | `cashier_loss_configs` |

### Jalan cadangan dan tanda bantu

| No | Aturan | Sumber |
|---|---|---|
| KEU-B25 | "Input Kasir Darurat" (Kas Masuk ketikan) tetap terbuka; kalau cabang dan tanggal itu sudah punya laporan, hanya ada peringatan. | KEU-A05 |
| KEU-B26 | "Cek Harian" 14 hari: Piutang yang dilaporkan dibanding nota kiriman hari itu, nota yang batal setelah kasir lapor, dan hari tanpa laporan. Hanya tanda; tidak mengubah apa pun. Hari tanpa laporan baru ditandai setelah tanggal mulai diisi atau setelah laporan pertama. | `get_cashier_day_checks` |
| KEU-B27 | Gudang: laporan diisi kantor; uang nota yang diantar driver masuk lewat uang pengiriman, sisanya lewat Laporan Kasir Gudang. | `RENCANA-LAPORAN-KASIR.md` bagian 4 |

## 6B.4 Menu di sistem lama

| Menu | Dipakai untuk apa | Mirip dengan menu lain? |
|---|---|---|
| Laporan Kasir | Kasir melapor tiap tutup shift | Input Kasir Darurat |
| Verifikasi Keuangan › Laporan Kasir | Memeriksa, pengaturan, Cek Harian | Verifikasi Kas Masuk |
| Verifikasi Keuangan › Uang Pengiriman | Memeriksa uang dari driver (4C) | Laporan Pengiriman (tombol lama) |
| Kas Masuk › Selisih Kasir | Daftar lebih dan kurang dari ketikan | Minus Kas; kartu Selisih Kasir |
| Penggajian › Kehilangan › Minus Kas | Mencatat minus untuk dipotong | Selisih Kasir |
| Keuangan › Logistik | Sewa antar cabang untuk cabang "Logistik" | bukan uang pengiriman (6D) |

## 6B.5 Tumpang tindih

1. **Selisih kasir dicatat di tiga tempat:** kolom selisih di Kas Masuk
   ketikan, selisih final di Laporan Kasir, dan halaman Minus Kas. Hanya yang
   terakhir memotong gaji.
2. **Dua jalan omzet toko** (Laporan Kasir dan ketikan darurat) yang hanya
   dipisah peringatan.
3. **Rumus "uang disetor"** di tiga tempat (layar kasir, layar finance,
   database); rumus potongan di database dan di kartu dashboard.
4. **Dua pemeriksaan untuk satu uang:** Laporan Kasir diperiksa finance, lalu
   uang yang sama dicatat Owner di bukunya sendiri ("tokpus", "tokdep").
5. **Satu sakelar tanggal mulai** untuk tiga aliran berbeda (laporan kasir,
   uang pengiriman, pelunasan piutang).
6. **"Piutang"** berarti tiga hal: angka di struk kasir, nota kiriman di HRIS,
   dan Buku Piutang.

## 6B.6 Kejadian di lapangan dan jalan keluarnya

| Kejadian | Di sistem lama | Ada jalan keluar? |
|---|---|---|
| Kasir salah ketik, belum diperiksa | Diubah atau dihapus pelapor | Ya, tanpa jejak |
| Kasir salah ketik, sudah disetujui | Kantor membatalkan persetujuan, kasir memperbaiki | Ya, tanpa alasan; baris Kas Masuk dihapus |
| Uang tunai yang sampai kurang dari laporan | Dibebankan ke pelapor | Ya, tetapi tidak melihat siapa yang membawa uangnya |
| QRIS di mutasi berbeda dari laporan | Tolak | Sebagian: kasir disuruh mengubah angka, padahal uangnya memang belum masuk |
| Kasir tidak melapor | Tanda di Cek Harian; finance mengetik di Kas Masuk | Ya, lewat jalan kedua |
| Toko tutup atau libur | Ditandai "belum ada laporan" | **Tidak** (tidak tahu hari tutup) |
| Shift ketiga, atau satu orang jaga sehari penuh | Paling banyak 2 shift | Sebagian |
| Pengeluaran dari laci tanpa struk | Diterima | Tanpa pagar |
| Ada uang pelunasan konsumen di laci | Finance memisahkan sebagai titipan | Ya |
| Nota kiriman batal setelah kasir lapor | Tanda | Sebagian (omzet tidak dikoreksi) |
| Laporan menunggu berhari-hari | Tidak ada tanda | **Tidak** |
| Pelapor berhenti sebelum laporannya diperiksa | Tidak diatur | **Tidak** |
| Gudang menjual tunai | Kantor mengetik | Tidak ada pelapor di tempat |

## 6B.7 Pertanyaan untuk pemilik (diajukan di percakapan, 12 Oktober 2026)

Butuh pandangan pemilik:

1. **Perjalanan uang tunai toko.** Siapa yang membawa uang tiap toko, kepada
   siapa, dan kapan; terutama Raja Petshop dan Markas Petshop yang tidak
   muncul di buku Owner.
2. **Penjualan Gudang.** Siapa yang menutup kasir Gudang dan memegang uangnya
   sebelum sampai ke Owner; siapa yang sebaiknya melapor.
3. **Pengeluaran dari laci.** Untuk apa saja, dan batas wajarnya.
4. **Kekurangan lama yang tidak dipotong** (Rp1,39 juta tercatat, Rp192 ribu
   di Minus Kas): sengaja atau terlewat.

Cukup setuju atau tidak: usulan AL1–AL14 di 6B.8.

## 6B.8 Usulan untuk v3 (belum disetujui)

| No | Usulan |
|---|---|
| AL1 | **Satu jalan omzet toko: Laporan Kasir.** "Input Kasir Darurat" tidak ada. Kalau kasir tidak bisa melapor, finance mengisi Laporan Kasir **atas nama** cabang itu (tercatat siapa yang mengetik, foto struk tetap wajib) dan yang memeriksa orang lain. |
| AL2 | **Laporan memakai tempat uang** (6A.10 aturan 2): begitu laporan terkirim, tunainya tercatat berada di **Laci** cabang itu. Tidak ada lagi satu "Kas Tunai". |
| AL3 | **Setoran adalah Pindah Dana Laci → penerimanya**, dan penerima yang mengesahkan: tampil di layarnya sebagai "menunggu diterima", ia menekan **Terima** atau **Tidak cocok** dengan angka sebenarnya (6A.10 aturan 33). Tunai tidak diketik ulang finance. |
| AL4 | **Non-tunai diperiksa finance per baris** terhadap mutasi: Cocok, atau **Tidak cocok dengan angka di mutasi**. Selisih non-tunai tidak otomatis menjadi beban kasir; ditandai "perlu ditelusuri" untuk GM. Tolak tetap ada untuk laporan yang memang salah isi. |
| AL5 | **Metode non-tunai dari daftar pengaturan per cabang**, tiap metode terpaut satu rekening; kasir memilih, tidak mengetik. Daftar diatur pemilik atau GM. |
| AL6 | **Pengeluaran dari laci menjadi baris uang keluar** cabang itu dari Laci: kasir mengisi keterangan, nominal, dan **foto struk**; jenisnya dipilih finance saat memeriksa. Di atas batas (pertanyaan 3) ditandai untuk GM. |
| AL7 | **Selisih = minus kas atau kelebihan kas** atas nama penutup shift, satu baris per laporan (tidak ditimpa), masuk periode 26–25 menurut tanggal laporan (GAJ-20, GAJ-38). Tidak ada toleransi: semua tercatat, kelebihan menutup kekurangan dalam periode yang sama. Kelebihan yang tersisa tercatat sebagai uang masuk "kelebihan kas". |
| AL8 | **Batas waktu:** laporan dikirim pada hari shift itu; belum ada laporan sampai toko buka esok harinya → ditandai untuk finance dan GM (hari tutup cabang tidak ditandai, KEH-79). Setoran dan non-tunai diperiksa paling lambat 3 hari (sama dengan LOG-62). Tanggal laporan paling jauh 7 hari ke belakang; lebih dari itu hanya kantor dengan alasan. |
| AL9 | **Shift mengikuti shift cabang** (buku Kehadiran), tidak dikunci dua. Satu laporan per cabang per tanggal per shift. |
| AL10 | **Siapa boleh melapor adalah pengaturan** per cabang dan jabatan, bukan nama jabatan atau nama cabang di kode (WAJ-05). |
| AL11 | **Laporan tidak dihapus.** Sebelum diperiksa: dikoreksi pelapor, dengan jejak. Setelah diperiksa: pemeriksaan dibatalkan pemilik atau GM dengan alasan; baris Buku Kas dibatalkan, tidak dihapus (PRI-02). Yang sudah masuk slip tertutup dikoreksi lewat baris baru (GAJ-50). |
| AL12 | **Tidak ada yang memeriksa laporannya sendiri**; HR tidak ikut memeriksa (6A.10 aturan 5). |
| AL13 | **Piutang di laporan hanya angka pembanding.** Uang pelunasan konsumen yang ada di laci dicatat terpisah sebagai "titipan pelunasan" (bukan omzet, bukan kelebihan kas) dan diteruskan ke sistem kasir (LOG-65). Cek Harian dibawa: belum lapor, nota batal setelah lapor, Piutang dibanding nota kiriman. |
| AL14 | **Tarik data kasir disiapkan sejak awal:** tahap awal angka diketik dari struk; begitu sambungan menyala, angka settlement terisi sendiri dan kasir tinggal menghitung uang fisik. Tidak ada sakelar "tanggal mulai" bersama; tiap aliran hidup sejak hari mulai sistem (6A.10 aturan 21). |

## 6B.9 Jawaban pemilik (12 Oktober 2026)

Arahan umum: semua temuan 6B diperbaiki di sistem baru dan tidak boleh
terulang (tabel "Temuan dan aturan yang mengatasinya" di 6B.10). Sistem lama
tidak disentuh (WAJ-09).

| No | Jawaban |
|---|---|
| 1 | Yang membawa uang tunai toko adalah **kasir**, diserahkan ke **finance** pada jam tutup shift; finance menghitungnya **pagi**. Ibu (Owner) kadang ikut memeriksa dan mencatat sendiri di catatannya, tetapi lebih sering memeriksa uang dari driver. Sistem kasir sudah mencatat uang cash saat settle, tetapi tetap harus diperiksa. **Raja dan Markas** lebih sering **setor tunai ke rekening masing-masing**; kalau disuruh mengantar, uangnya diantar tetapi tetap disetorkan finance ke rekening cabang itu. Catatan serah terima pembawa uang: ada, tetapi **tidak wajib**. |
| 2 | Laporan penjualan Gudang seharusnya ditulis **Marketing**, karena Marketing yang bertanggung jawab atas penjualan Gudang. |
| 3 | Batas pengeluaran laci **belum diketahui**. Owner kadang mengambil uang dari laci toko. Pengeluaran besar (sekitar Rp2 juta) kadang untuk **membayar supplier karena uang Gudang kurang**. Saran Claude (keterangan, nominal, foto struk; jenis dipilih finance; di atas batas ditandai) dinilai menarik. |
| 4 | Sebaiknya semua kekurangan masuk potongan, **tetapi tidak semuanya kesalahan orang yang menutup kasir**. |
| AL1–AL14 | Dibaca Claude: disetujui, dengan tiga catatan. **AL4:** di sistem kasir QRIS sudah terurai per transaksi; kelak ditarik dan dicocokkan satu per satu. **AL8:** harus ada jalan keluar kalau semua orang yang bisa melapor sakit atau keluar kerja. **AL9:** jumlah shift kelak dicocokkan dengan sistem kasir. |

Keterangan pemilik:

- **Uang dari driver semuanya milik Gudang, termasuk nota piutangnya**;
  pemilik mengingat "sumbernya" sudah pernah dibuat. Bertabrakan dengan
  LOG-13 dan LOG-64 (lihat butir V).
- **Cabang "Logistik" (sewa):** Owner ingin semua asetnya (mobil, gedung,
  motor) **disewa kantor** dan ingin tahu hasil sewanya; uang itu sering ia
  ambil untuk keperluan pribadi. GM khawatir pengambilan dan harga sewanya
  (ada markup) merusak arus kas. Koreksi atas bacaan Claude di 6B.2: ini
  **bukan uang berpindah di dalam perusahaan**, melainkan biaya sewa yang
  dibayar perusahaan kepada pemilik aset. Dibahas di 6D.
- 10 baris Kas Masuk tanpa rekening (Rp5,6 miliar): pemilik tidak ingat
  asalnya. Tetap di keputusan data lama.

### Pertentangan dan butir penutup (diajukan di percakapan, 12 Oktober 2026)

- **Pertentangan V (uang dari driver milik siapa).** LOG-13: tiap nota punya
  cabang pemilik nota (nota gudang atau nota cabang). LOG-64: uang terperiksa
  masuk Kas Masuk **cabang pemilik nota**. Keterangan baru: semuanya milik
  Gudang. Saran Claude: keduanya dipisah. **Uang fisik** dari driver seluruhnya
  masuk Brankas (milik Gudang); **penjualannya** tetap dihitung untuk cabang
  pemilik nota, supaya laba per cabang benar; bagian nota cabang tercatat
  sebagai uang cabang itu yang dipegang Gudang.
- **Butir W (setelah finance menghitung).** Uang tunai toko yang sudah
  dihitung finance pagi hari lalu ke mana: langsung ke Brankas (dipegang
  Owner), atau dipegang finance dulu. Menentukan siapa yang menekan "Terima"
  dan mengubah 6A.10 aturan 33.
- **Butir X (uang keluar dari laci, tiga jenis).** Kasir memilih satu dari
  tiga: Belanja toko (foto struk wajib), Diambil Owner (tanpa struk; menjadi
  Catatan Cepat atas nama Owner yang dilengkapi finance), Bayar supplier
  (foto nota wajib; diteruskan ke 6C). Batas tanda Rp200.000 untuk belanja
  toko sebagai pengaturan yang bisa diubah.
- **Butir Y (kekurangan yang bukan salah penutup kasir).** Kekurangan
  tercatat atas nama penutup shift; ia boleh mengajukan keberatan dalam 3
  hari; pemilik atau GM memutuskan: tetap, ditiadakan, atau dipindahkan atau
  dibagi ke orang lain di shift itu, wajib alasan.

### Jawaban atas pertentangan V dan butir W–Y (12 Oktober 2026)

| Butir | Jawaban |
|---|---|
| V | Betul: pada akhirnya **semua uang dari driver milik Gudang**; yang diperjelas hanya **pencatatan omzetnya**. Saran Claude dipakai (aturan 20). LOG-13 dan LOG-64 tidak berubah. |
| W | Uang yang dihitung finance **pagi itu juga diserahkan ke Ibu**. Pencatatannya kadang baru sore, karena finance mengerjakan yang lain. |
| X | Ok: tiga jenis uang keluar dari laci. |
| Y | Dulu kekurangan dibagi rata. Sekarang ditegakkan **satu kasir satu tanggung jawab**: tiap orang menanggung shiftnya sendiri. Dibaca Claude: tidak ada pilihan memindahkan atau membagi ke orang lain; yang tersisa hanya meniadakan dengan alasan oleh pemilik atau GM (jawaban 4). |

Keterangan tambahan tentang sewa aset (untuk 6D): beberapa cabang memang
mengontrak tempat kepada orang lain. Contoh dari pemilik: harga kontraknya
Rp20 juta per tahun, sedangkan kantor membayar ke Owner Rp25 juta per tahun.

## 6B.10 Aturan yang dihasilkan (nomor v3 ditetapkan di 6E)

Semua butir sudah dijawab pemilik; tidak ada aturan yang menunggu.

| No | Aturan | Asal |
|---|---|---|
| 1 | **Satu jalan omzet toko: Laporan Kasir.** Tidak ada "Input Kasir Darurat" dan tidak ada omzet yang diketik langsung ke Buku Kas. | AL1 |
| 2 | **Siapa boleh melapor adalah pengaturan** per cabang dan jabatan, bukan nama jabatan atau nama cabang di kode (WAJ-05). Isi awal: karyawan toko untuk tokonya; **Marketing untuk Gudang**. | AL10, jawaban 2 |
| 3 | **Jalan keluar kalau pelapor tidak ada** (sakit semua, keluar kerja): (a) pemilik, GM, atau finance memberi **hak lapor sementara** kepada karyawan lain di cabang itu, bertanggal mulai dan selesai, tercatat; (b) kalau tidak ada orangnya, **finance mengisi atas nama** cabang itu (tercatat siapa yang mengetik, foto struk tetap wajib) dan yang memeriksa orang lain; (c) toko yang memang tidak buka dicatat sebagai hari tutup (KEH-79), sehingga tidak ditandai "belum lapor". Pelapor yang berhenti sebelum laporannya diperiksa: laporan tetap diperiksa, dan kekurangannya masuk slip terakhirnya (GAJ-53). | AL1, catatan AL8 |
| 4 | **Isi laporan tetap sesederhana sekarang:** tanggal, shift, foto struk (wajib), Cash, non-tunai per metode, Piutang, uang keluar dari laci, selisih, keterangan. Total omzet dan uang yang harus disetor dihitung server di satu tempat (WAJ-04). | KEU-B03, B04 |
| 5 | **Shift mengikuti shift cabang** (buku Kehadiran), tidak dikunci dua; satu laporan per cabang per tanggal per shift. Kelak dicocokkan dengan shift di sistem kasir. | AL9 |
| 6 | **Metode non-tunai dari daftar pengaturan per cabang**, tiap metode terpaut satu rekening; kasir memilih, tidak mengetik. Daftar diatur pemilik atau GM. | AL5 |
| 7 | **Begitu laporan terkirim, tunainya tercatat di Laci cabang itu.** Tidak ada satu "Kas Tunai" untuk semua. Setiap cabang yang menjual punya Laci dan rekening terdaftar (Markas di sistem lama tidak punya). | AL2 |
| 8 | **Setoran tunai toko:** kasir menyerahkan uang ke finance saat tutup shift; finance menghitung (paling lambat pagi berikutnya) dan menekan **Terima** atau **Tidak cocok** dengan angka sebenarnya. Itu Pindah Dana Laci → uang yang dipegang finance; tunai tidak diketik ulang. Pagi itu juga finance menyerahkannya ke pemegang Brankas dan **finance yang mencatat "setor ke Brankas"**; pencatatan boleh menyusul sampai akhir hari itu, lewat itu ditandai. Owner tidak perlu menekan apa pun dan boleh ikut memeriksa; selisih di Brankas tertangkap Hitung Kas mingguan (6A.10 aturan 30). Jenis: **pelapis** 6A.10 aturan 33 untuk setoran toko. | jawaban 1, AL3, butir W |
| 9 | **Setoran ke bank** (Raja, Markas, atau toko mana pun): Pindah Dana Laci → rekening cabang itu, dengan foto bukti setor, lalu dicocokkan finance dengan mutasi. Kalau uangnya diantar ke kantor, finance yang menyetorkannya ke rekening cabang itu dan mencatatnya. | jawaban 1 |
| 10 | **Serah terima pembawa uang tidak wajib.** Kalau dicatat ("saya terima Rp… dari …"), kekurangan di perjalanan menjadi tanggungan pembawa; kalau tidak dicatat, tetap pada penutup shift. | jawaban 1 |
| 11 | **Non-tunai diperiksa finance per baris** terhadap mutasi: Cocok, atau Tidak cocok dengan angka di mutasi. Selisih non-tunai tidak otomatis menjadi beban kasir; ditandai "perlu ditelusuri" untuk GM. Tolak tetap ada untuk laporan yang salah isi. Begitu tarik data kasir menyala, QRIS dicocokkan **per transaksi** dari uraian sistem kasir. | AL4 dan catatannya |
| 12 | **Uang keluar dari laci** dicatat kasir dengan memilih satu dari tiga jenis: **Belanja toko** (keterangan, nominal, foto struk; menjadi uang keluar cabang itu, jenisnya dipilih finance; di atas batas ditandai untuk GM, batasnya pengaturan dengan isi awal Rp200.000); **Diambil Owner** (nominal; menjadi Catatan Cepat atas nama Owner, dilengkapi finance, 6A.10 aturan 25); **Bayar supplier** (nama supplier, nominal, foto nota; diteruskan ke pembayaran supplier, 6C). Tidak ada lagi "pengeluaran" yang hanya mengurangi uang masuk. | jawaban 3, AL6, butir X |
| 13 | **Selisih** = kekurangan kas (minus kas) atau kelebihan kas, satu baris per laporan, atas nama penutup shift, masuk periode 26–25 menurut tanggal laporan (GAJ-20, GAJ-38). Tidak ada toleransi; kelebihan hanya menutup kekurangan di periode yang sama; kelebihan yang tersisa tercatat sebagai uang masuk "kelebihan kas". Tidak ada baris yang ditimpa. | AL7 |
| 14 | **Satu kasir, satu tanggung jawab.** Kekurangan kas sebuah shift ditanggung penuh orang yang menutup shift itu; **tidak dibagi rata dan tidak dipindahkan** ke orang lain. Ia boleh mengajukan keberatan paling lambat 3 hari; pemilik atau GM memutuskan **tetap** atau **ditiadakan**, wajib alasan dan tercatat. Tanpa keputusan, kekurangan tetap. Menegaskan GAJ-20; pembagian rata hanya tersisa untuk catat tangan tanpa nama di luar Laporan Kasir. | jawaban 4, butir Y |
| 15 | **Batas waktu:** laporan dikirim pada hari shift itu; belum ada sampai toko buka esok harinya → ditandai untuk finance dan GM. Setoran dan non-tunai diperiksa paling lambat 3 hari; lewat itu ditandai, tidak otomatis disetujui. Tanggal laporan paling jauh 7 hari ke belakang; lebih dari itu hanya kantor, dengan alasan. | AL8 |
| 16 | **Laporan tidak dihapus.** Sebelum diperiksa: dikoreksi pelapor, dengan jejak. Setelah diperiksa: pemeriksaan dibatalkan pemilik atau GM dengan alasan; baris Buku Kas dibatalkan, tidak dihapus (PRI-02). Yang sudah masuk slip tertutup dikoreksi lewat baris baru (GAJ-50). | AL11 |
| 17 | **Tidak ada yang memeriksa laporannya sendiri**; HR tidak ikut memeriksa. Dijaga server dan dicoba mesin pengaman. | AL12 |
| 18 | **Piutang di laporan hanya angka pembanding.** Uang pelunasan pelanggan yang ada di laci dicatat terpisah sebagai "titipan pelunasan" (bukan omzet, bukan kelebihan kas) dan diteruskan ke sistem kasir (LOG-65). **Cek Harian** dibawa: belum lapor, nota batal setelah lapor, Piutang dibanding nota kiriman. | AL13 |
| 19 | **Tarik data kasir disiapkan sejak awal:** tahap awal angka diketik dari struk; begitu sambungan menyala, angka settlement (termasuk cash yang dicatat kasir saat settle) terisi sendiri dan kasir tinggal menghitung uang fisik. Tidak ada sakelar "tanggal mulai" bersama; semua aliran hidup sejak hari mulai sistem (6A.10 aturan 21). | AL14, jawaban 1 |
| 20 | **Uang dari driver seluruhnya milik Gudang:** uang fisiknya masuk Brankas. **Omzetnya** tetap dicatat untuk cabang pemilik nota (LOG-13, LOG-64), supaya laba per cabang benar; bagian nota cabang tercatat sebagai uang cabang itu yang dipegang Gudang. Uang dari driver yang diperiksa pemegang Brankas sendiri cukup ditekan "Terima" (6A.10 aturan 33, LOG-62). | keterangan pemilik, butir V |
| 21 | **Finance juga libur.** Tidak ada aturan Keuangan yang menganggap finance masuk setiap hari. (a) Semua batas waktu yang dikerjakan finance (menerima setoran, mencatat setor ke Brankas, memeriksa non-tunai, melengkapi Catatan Cepat, Hitung Kas Pegangan) dihitung menurut **hari kerja finance** dari jadwal libur di Kehadiran; yang tertunda karena libur tidak ditandai terlambat. (b) **Bawaan: uang diam di Laci toko** dan tetap tercatat di sana sampai finance masuk; laporan kasir tetap dikirim seperti biasa. Tidak ada pengganti yang wajib. (c) **Pemegang Brankas boleh menerima sendiri kalau mau:** setoran yang menunggu tampil di layarnya dan ia cukup menekan "Terima"; kalau ia hanya mencatat di kertas, finance memasukkannya saat masuk kembali **atas nama** pemegang Brankas, dengan tanggal uang yang sebenarnya dan foto kertas itu sebagai lampiran (sama dengan Catatan Cepat dari pesan WhatsApp, 6A.10 aturan 25). (d) **Pencatatan menyusul:** apa pun yang terjadi saat finance libur dicatat finance pada hari ia masuk, bertanggal uang sebenarnya. Pembayaran supplier oleh Owner tetap berjalan dan dicatat lewat Catatan Cepat (atau menyusul dari catatannya). Kasbon menunggu finance masuk (DRV-63: uang kasbon diserahkan finance). (e) Pengganti finance sementara yang ditunjuk pemilik atau GM tetap **tersedia sebagai pilihan**, bertanggal dan tercatat, tidak wajib dipakai. Berlaku juga untuk aturan 6A; ditegaskan di 6E. | tambahan pemilik setelah 6B ditutup |

### Tambahan pemilik setelah 6B ditutup (12 Oktober 2026)

- "Jangan lupakan, finance juga butuh libur": aturan 21 ditambahkan.
- Keadaan saat finance libur (jawaban pemilik): uang toko biasanya **diam
  saja** dan tidak dihitung; kadang Owner menghitungnya, kadang ia tulis di
  kertas, kadang langsung ia masukkan, tergantung suasana hati. Kasbon
  biasanya ditunda ke besok, atau semuanya dicatat di kertas lalu dimasukkan
  finance esok harinya. Biasanya tidak ada pengeluaran saat finance libur,
  kecuali **bayar supplier** yang tetap jalan karena dibayar Owner. Aturan 21
  ditulis ulang mengikuti keadaan ini.

### Temuan dan aturan yang mengatasinya

| Temuan | Aturan |
|---|---|
| Laporan menunggu berhari-hari tanpa tanda; belum pernah diperiksa | 8, 11, 15 |
| Omzet toko tidak tercatat karena "tanggal mulai" kosong | 7, 19 |
| Gudang tidak punya pelapor | 2 |
| Markas tidak melapor; pelapor sakit atau keluar | 2, 3 |
| Dua jalan omzet (laporan dan ketikan darurat) | 1 |
| Kekurangan tercatat tetapi tidak sampai ke potongan gaji | 13, 14 |
| Selisih dicatat di tiga tempat; baris potongan ditimpa; memakai bulan kalender | 13 |
| Pengeluaran laci tanpa jenis, tanpa bukti, tidak muncul sebagai biaya | 12 |
| Uang diambil Owner atau dipakai bayar supplier tercatat sebagai "pengeluaran" toko | 12 |
| Satu "Kas Tunai"; perpindahan uang toko ke kantor tidak tercatat | 7, 8, 9 |
| Uang yang sama dicatat ulang Owner di bukunya | 8 (6A.10 aturan 33) |
| Transfer toko masuk rekening cabang lain | 6, 9 |
| Nama metode diketik bebas | 6 |
| Non-tunai tidak cocok hanya bisa ditolak | 11 |
| Memeriksa laporan sendiri; HR ikut memeriksa | 17 |
| Persetujuan dibatalkan tanpa alasan; baris Kas Masuk dihapus; laporan dihapus tanpa jejak | 16 |
| Nama jabatan dan nama cabang di kode | 2 |
| Paling banyak 2 shift | 5 |
| Hari tutup ditandai "belum lapor" | 3 |
| Rumus "uang disetor" di tiga tempat | 4 |
| Ketikan uang masuk terlambat (sampai 23 hari) | 1, 15 |

### Titipan dari 6B

- Untuk 6C: pembayaran supplier dari laci toko (aturan 12) dan keterangan
  "uang Gudang kurang"; pembayaran supplier dari Brankas dan bank (titipan 6A).
- Untuk 6D: **sewa aset milik Owner** (cabang "Logistik" di sistem lama,
  Rp96,2 juta): daftar aset dan tarif sewanya, hasil sewa per aset, berapa
  yang sudah diambil, dan pengaruhnya ke kas; kekhawatiran GM soal markup
  dan pengambilan. Contoh pemilik: tempat yang dikontrak dari orang lain
  Rp20 juta per tahun dibayar kantor ke Owner Rp25 juta per tahun; jadi
  perlu dua angka per aset (biaya ke pihak luar dan yang dibayar kantor). Tarif sewa menyangkut uang, jadi bertanggal berlaku
  (WAJ-07).
- Untuk modul Tarik Data Kasir: settlement per shift (cash, non-tunai,
  piutang), uraian QRIS per transaksi, dan shift.
- Untuk keputusan data lama: 10 baris Kas Masuk tanpa rekening (Rp5,6
  miliar), asalnya tidak diingat pemilik; kekurangan kas lama yang tidak
  dipotong (Rp1,39 juta) tidak dikejar di v3 kecuali diminta.
- Untuk 6E: kamus istilah (Laci, setoran, kelebihan kas, titipan pelunasan,
  hak lapor sementara); pelapis GAJ-20 (aturan 14).

---

# Bagian 6C: Pembelian, supplier, HPP, piutang

Ukuran: **sedang**.

Sumber: `hris-app/app/(dashboard)/keuangan/pembelian/PembelianPageContent.tsx`
(854 baris; dipakai dua alamat, `pembelian` dan `pembelian/input`),
`pembelian/supplier/page.tsx` (266), `hpp/page.tsx` (359), `piutang/page.tsx`
(417), `lib/supplierPurchases.ts`, `lib/finCashOut.ts`, bagian HPP dan supplier
di `laporan/page.tsx` dan `approval/page.tsx`; tabel `suppliers`,
`supplier_purchases`, `fin_hpp_entries`, baris `fin_cash_out` bertaut
`supplier_purchases`; fungsi `fin_cash_out_guard_supplier_purchase_overpay`;
kebijakan akses di database.

Yang sudah diputuskan di bab lain dan tidak ditanyakan lagi:

- **Piutang toko, titipan toko, dan pelunasan dipegang sistem kasir**; HRIS
  tidak punya Buku Piutang (LOG-65, LOG-66). Halaman `piutang/page.tsx`
  seluruhnya tentang piutang toko, galiannya di 4C; **tidak digali ulang**.
  Piutang di 6C hanya yang bukan piutang toko.
- Kasbon karyawan (piutang ke karyawan yang masih bekerja) diatur di DRV-51
  s.d. 79. Sisa yang tidak tertutup slip terakhir menjadi piutang ke mantan
  karyawan (GAJ-53, DRV-73).
- Supplier di Laporan Bongkaran dipilih dari satu daftar (DRV-41); sambungan
  purchase order kasir disiapkan (DRV-39); daftar produk milik kasir (DRV-38).
- Tugas belanja driver ke supplier dan upahnya: LOG-34, DRV-11.
- Buku Kas: baris otomatis hanya lahir dari modulnya, termasuk pembelian
  (6A.10 aturan 13); satu kejadian bayar satu baris (15); rekening sumber
  wajib (14); foto bukti (6); kotak "Supplier" di Catatan Cepat (31); bayar
  supplier dari laci toko (6B.10 aturan 12); bayar supplier oleh Owner tetap
  jalan saat finance libur (6B.10 aturan 21).

## 6C.1 Bagian ini mengurus apa

Barang yang dibeli dari supplier: nota belanjanya, utang yang timbul, dan
pembayarannya. Lalu **harga pokok** barang yang terjual (HPP), yang dipakai
menghitung laba. Terakhir, uang perusahaan yang masih dipegang orang lain
selain toko pelanggan (piutang mantan karyawan dan sejenisnya).

## 6C.2 Data di sistem lama (dicek ke database, 12 Oktober 2026)

| Data | Isinya | Tabel | Jumlah |
|---|---|---|---|
| Daftar supplier | Nama, nomor HP, aktif atau tidak | `suppliers` | 35, semuanya aktif; 26 tanpa nomor HP; 2 belum pernah dipakai; tidak ada nama kembar |
| Nota belanja | Supplier, cabang, tanggal, total, nomor invoice, nomor surat jalan, keterangan, pengisi | `supplier_purchases` | 196 nota, Rp5,63 miliar, 8 Agustus s.d. 10 Oktober 2026 |
| Pembayaran supplier | Baris Kas Keluar kategori `pembayaran_supplier` yang bertaut ke satu nota | `fin_cash_out` | 152 baris: 133 disetujui (Rp3,17 miliar), 17 menunggu (Rp304 juta), 2 ditolak (Rp57 juta) |
| HPP dan omzet sistem kasir | Cabang, tanggal, nominal, jenis (HPP atau omzet), status | `fin_hpp_entries` | 30 baris: 20 HPP (Rp10,6 miliar, Mei s.d. September) dan 10 omzet (Rp5,59 miliar, Agustus dan September) |
| Piutang selain toko | (tidak ada) | (tidak ada tabel) | 0 |

Rincian nota belanja:

| Kelompok | Nota | Total | Sudah dibayar (disetujui) | Sisa utang |
|---|---|---|---|---|
| Supplier luar | 94 | Rp5,23 miliar | Rp3,12 miliar | **Rp2,11 miliar** (31 nota; 14 belum dibayar sama sekali) |
| "Gudang" dan "Hammielion" (pemasok dalam) | 102 | Rp395 juta | Rp43,8 juta | **Rp352 juta** (79 nota; 76 belum dibayar sama sekali) |

- Per cabang pembeli: Gudang 68 nota (Rp5,16 miliar, semuanya supplier luar);
  Toko Pusat 69 (43 dari pemasok dalam); Raja 26, Markas 25, dan Toko Depan 8
  (semuanya dari pemasok dalam).
- **191 dari 196 nota tanpa nomor invoice dan tanpa nomor surat jalan**; 120
  di antaranya juga tanpa keterangan apa pun. Tidak ada kolom foto nota.
- Pengisi: 187 nota oleh akun berhak `hr` (dipegang orang Finance, lihat
  6A.2), 9 nota (Rp1,53 miliar) oleh akun Owner. Tidak ada yang diisi cabang.
- 15 nota diketik lebih dari 7 hari setelah tanggal belinya (paling lama 20
  hari); 5 nota bertanggal beli **sesudah** hari diketik.
- 2 pasang nota kembar (supplier, tanggal, dan total sama).
- 2 nota pemasok dalam terbayar melebihi totalnya.
- Sisa utang supplier luar yang notanya lebih tua dari 30 hari: Rp336 juta.
  Tidak ada jatuh tempo di sistem, jadi tidak diketahui mana yang terlambat.

Rincian pembayaran:

- Dari rekening bank 64 baris (Rp1,84 miliar), dari "Kas Tunai" 69 baris
  (Rp1,32 miliar). 19 pembayaran tunai **disetujui oleh pengisinya sendiri**.
- 1 pembayaran (Rp50 juta) dibebankan ke cabang yang berbeda dari notanya.
- **260 baris Kas Keluar "Pembayaran Supplier" senilai Rp6,99 miliar (Mei
  s.d. Agustus) tidak bertaut ke nota apa pun**: 153 baris impor lama (Mei
  dan Juni, tanpa rekening) dan 107 baris ketikan (Juli dan Agustus). Nota
  baru mulai dicatat 8 Agustus. Jadi "Sisa Utang" di layar hanya menghitung
  nota sejak tanggal itu; utang yang lebih lama tidak pernah masuk.
- Kategori "Restock / Modal Barang" tidak pernah dipakai; "Return/Barang
  Rusak" 7 baris (Rp760 ribu).

Rincian HPP:

- Diisi **satu angka per cabang per bulan**, bertanggal akhir bulan, diketik
  dari laporan sistem kasir. Juli tidak diisi sama sekali.
- Semua 30 baris berstatus disetujui; **15 disetujui oleh pengisinya
  sendiri**. Riwayat: 32 kali isi, 19 kali ubah, 2 kali hapus.
- HPP Agustus Rp2,64 miliar terhadap omzet kasir Rp2,80 miliar; September
  Rp2,64 miliar terhadap Rp2,79 miliar (selisihnya sekitar 5–6%).
- Kas Masuk disetujui pada bulan yang sama: Agustus Rp1,93 miliar, September
  Rp2,35 miliar. Laporan lama menghitung **Laba Kotor = Kas Masuk − HPP**,
  jadi Agustus dan September tampil **rugi** (uang yang masuk dibandingkan
  dengan harga pokok barang yang terjual, padahal sebagian penjualan belum
  dibayar), dan Juli tampil untung besar karena HPP-nya kosong.

## 6C.3 Aturan yang ditemukan

### Supplier

| No | Aturan | Sumber |
|---|---|---|
| KEU-C01 | Supplier hanya punya nama dan nomor HP. Tidak ada alamat, rekening, tempo, atau jenis (luar atau dalam). | `suppliers` |
| KEU-C02 | Supplier ditambah oleh owner, hr, finance, dan kepala cabang (database); diubah atau dinonaktifkan oleh owner, hr, finance. Tidak dihapus. Halamannya tidak memeriksa hak; hanya menu yang menyembunyikan. | kebijakan `suppliers_*`, `supplier/page.tsx` |
| KEU-C03 | "Gudang" dan "Hammielion" terdaftar sebagai supplier: toko mencatat "belanja" kepada keduanya saat mengambil stok dari dalam. | data, keterangan pemilik (Agustus 2026) |
| KEU-C04 | Nama supplier boleh kembar; tidak ada penjaga. | `suppliers` |

### Nota belanja

| No | Aturan | Sumber |
|---|---|---|
| KEU-C05 | Satu pintu: pilih supplier → Detail → "Tambah Belanja" atau "Bayar Hutang". | `PembelianPageContent.tsx` |
| KEU-C06 | Nota berisi cabang, tanggal, total, nomor invoice (pilihan), nomor surat jalan (pilihan), keterangan barang (pilihan). Tidak ada rincian barang, foto, atau jatuh tempo. | `handleSubmit` |
| KEU-C07 | Tanggal beli diketik bebas, boleh mundur atau maju. | `handleSubmit` |
| KEU-C08 | Kepala cabang hanya untuk cabangnya; owner, hr, finance untuk cabang mana pun. | kebijakan `supplier_purchases_*` |
| KEU-C09 | Nota **tidak diperiksa siapa pun**: begitu disimpan langsung menjadi utang. | tidak ada kolom status |
| KEU-C10 | Nota boleh diubah kapan saja (cabang, tanggal, total), termasuk setelah dibayar; layar hanya memberi peringatan supaya total tidak lebih kecil dari yang sudah dibayar, tidak menolak. | `handleEditSubmit` |
| KEU-C11 | Nota boleh dihapus selama belum punya pembayaran; penjaganya hanya di layar. **Tidak ada jejak** perubahan atau penghapusan nota (tabel ini tidak punya pencatat riwayat). | `handleDeletePurchase`, tidak ada trigger |
| KEU-C12 | "Sudah dibayar sekarang" saat menambah nota: dua langkah lepas (nota dulu, lalu pembayaran). Kalau langkah kedua gagal, nota tersimpan tanpa pembayaran. | `handleSubmit` |

### Pembayaran supplier

| No | Aturan | Sumber |
|---|---|---|
| KEU-C13 | Pembayaran = baris Kas Keluar berstatus menunggu, bertaut ke **satu** nota, wajib memilih rekening atau kas. | `handlePaySubmit` |
| KEU-C14 | Satu kali bayar untuk beberapa nota dipecah menjadi beberapa baris Kas Keluar; isi cepat membagi nominal ke nota tertua lebih dulu, bisa diubah tangan. Di mutasi bank tampil satu transfer, di sistem beberapa baris. | `applyQuickAmount` |
| KEU-C15 | Sisa utang = total nota − pembayaran yang **disetujui**. Yang masih menunggu ditampilkan terpisah dan menahan nota supaya tidak diajukan dua kali. | `lib/supplierPurchases.ts` |
| KEU-C16 | Database menolak pembayaran yang membuat total bayar satu nota melebihi totalnya (yang ditolak tidak dihitung). | `fin_cash_out_guard_supplier_purchase_overpay` |
| KEU-C17 | Tidak ada tempat untuk **uang muka** atau bayar lebih ke supplier; tidak ada retur ke supplier yang mengurangi utang. | tidak ada |
| KEU-C18 | Nominal pembayaran yang menunggu atau ditolak boleh diubah pengisinya; pembayaran supplier tidak bisa dihapus. | `lib/finCashOut.ts` |
| KEU-C19 | Kategori "Pembayaran Supplier" hanya disembunyikan dari ketikan biasa; database tidak menolaknya. | KEU-A10 |
| KEU-C20 | Pembayaran supplier tidak masuk hitungan laba (dianggap sudah terhitung di HPP). | KEU-A32 |

### HPP dan omzet sistem kasir

| No | Aturan | Sumber |
|---|---|---|
| KEU-C21 | HPP dan omzet "sistem kasir" diketik tangan sebagai satu angka per cabang per tanggal; biasanya sebulan sekali. | `hpp/page.tsx` |
| KEU-C22 | Kolom nominalnya satu (`hpp_amount`) untuk dua arti; jenisnya dibedakan kolom lain. | `fin_hpp_entries` |
| KEU-C23 | Isian menunggu diperiksa; yang dihitung laporan hanya yang disetujui. Diperiksa di halaman yang sama dengan Kas (owner, hr, finance). | `approval/page.tsx` |
| KEU-C24 | Layar hanya mengizinkan ubah selama menunggu; database mengizinkan owner, hr, finance mengubah yang sudah disetujui. Hapus hanya owner. | kebijakan `fin_hpp_*` |
| KEU-C25 | Laporan memakai dua hitungan laba: **Laba Kotor = Kas Masuk − HPP** (uang diterima melawan harga pokok) dan "Laba Kotor (Sistem)" = omzet kasir − HPP. Rinciannya di 6D. | `laporan/page.tsx` |

### Piutang selain toko

| No | Aturan | Sumber |
|---|---|---|
| KEU-C26 | Tidak ada tempat mencatat piutang ke mantan karyawan, uang muka ke supplier, atau pinjaman kepada pihak lain. | tidak ada tabel |

## 6C.4 Menu di sistem lama

| Menu | Dipakai untuk apa | Mirip dengan menu lain? |
|---|---|---|
| Pembelian & Utang Supplier (`/keuangan/pembelian/input`) | Nota dan bayar utang | Sama persis dengan "Ringkasan Supplier" |
| Ringkasan Supplier (`/keuangan/pembelian`) | Halaman yang sama, alamat lain | Ya |
| Master Supplier | Daftar supplier | Tidak |
| HPP & Omset (Sistem) | Ketik HPP dan omzet kasir | Omzet juga ada di Kas Masuk dan Laporan Kasir |
| Buku Piutang | Piutang toko | Pindah ke kasir (LOG-65) |

## 6C.5 Tumpang tindih

1. Satu halaman pembelian dipasang di dua menu.
2. Omzet tercatat di tiga tempat: Kas Masuk, Laporan Kasir, dan "omzet sistem"
   yang diketik bulanan.
3. Dua hitungan laba kotor dari dua dasar yang berbeda (KEU-C25).
4. Pembayaran supplier ada yang bertaut ke nota (Rp3,17 miliar) dan ada yang
   tidak (Rp6,99 miliar); hanya yang pertama mengurangi utang.
5. Mengambil stok dari Gudang dicatat sebagai "belanja ke supplier" di
   Keuangan, sementara Logistik mencatat kiriman ke toko sendiri sebagai nota
   cabang (LOG-13). Dua catatan untuk perpindahan barang yang sama.
6. Rumus sisa utang ada di satu file (`supplierPurchases.ts`) tetapi
   dijalankan di layar; penjaga database menghitungnya lagi dengan cara
   sendiri (yang menunggu ikut dihitung).
7. Supplier di Bongkaran diketik bebas, di Pembelian dari daftar (DRV-41
   sudah menyatukannya).

## 6C.6 Kejadian di lapangan dan jalan keluarnya

| Kejadian | Di sistem lama | Ada jalan keluar? |
|---|---|---|
| Nota salah total | Diubah langsung, tanpa jejak | Ada, tetapi tak terlacak |
| Nota diketik dua kali | Tidak dicegah (2 pasang kembar); hapus kalau belum dibayar | Sebagian |
| Pembayaran salah nominal | Diubah selama menunggu; setelah disetujui tidak ada jalan | Tidak |
| Bayar satu transfer untuk banyak nota | Dipecah jadi banyak baris | Ada, tetapi tidak cocok dengan mutasi bank |
| Bayar di muka, atau bayar lebih | Ditolak database | Tidak |
| Barang dikembalikan ke supplier | Tidak ada | Tidak |
| Supplier memberi potongan harga saat dibayar | Nota harus diubah totalnya | Tanpa jejak |
| Utang lama sebelum 8 Agustus | Tidak tercatat | Tidak |
| Bayar supplier dari laci toko | Ditulis sebagai "pengeluaran" di Laporan Kasir, tidak mengurangi utang | Tidak (6B.10 aturan 12 menyiapkannya) |
| Owner membayar supplier dari Brankas | Ditulis di Petty Cash sebagai nama supplier saja (lebih dari Rp1 miliar), tidak mengurangi utang kecuali finance mengetik ulang | Bergantung finance |
| HPP bulan itu lupa diisi | Laba bulan itu tampil terlalu besar, tanpa tanda | Tidak |
| Mantan karyawan masih punya utang | Tidak tercatat di mana pun | Tidak |

## 6C.7 Pertanyaan untuk pemilik (diajukan di percakapan, 12 Oktober 2026)

Butuh pandangan:

1. **Nota belanja ke supplier paling lengkap dicatat di mana: sistem kasir
   (saat barang masuk stok) atau hanya di HRIS?** Saran: Buku Utang Supplier
   dipegang HRIS (karena uangnya keluar dari Brankas dan bank yang dicatat
   HRIS); nota diketik dengan foto dulu, dan sambungan purchase order kasir
   disiapkan supaya kelak terisi sendiri.
2. **Toko mengambil barang dari Gudang: apakah toko benar-benar membayar
   Gudang?** Dan apa beda "Gudang" dengan "Hammielion" sebagai pemasok? Saran:
   di v3 ini bukan belanja dan bukan utang, melainkan "barang pindah antar
   cabang" yang hanya dipakai menghitung laba tiap cabang; tidak ada uang yang
   dicatat keluar.
3. **Tempo supplier:** apakah supplier memberi waktu bayar (misalnya 14 atau
   30 hari), dan siapa yang memutuskan nota mana dibayar hari ini? Saran: tiap
   nota punya jatuh tempo (bawaan per supplier), dan ada daftar "utang yang
   jatuh tempo 7 hari ke depan" untuk Owner dan GM.
4. **Barang dikembalikan ke supplier, uang muka, potongan harga:** mana yang
   benar-benar terjadi, dan bagaimana biasanya diselesaikan?
5. **Piutang selain toko:** selain mantan karyawan, adakah uang perusahaan
   yang dipinjam orang lain? Mantan karyawan yang tidak membayar: ditagih atau
   diikhlaskan, siapa yang memutuskan?

Cukup ok atau tidak: usulan AM1–AM12 di 6C.8.

## 6C.8 Usulan untuk v3 (belum disetujui)

| No | Usulan |
|---|---|
| AM1 | **Satu daftar supplier**, milik Keuangan, dipakai Pembelian dan Laporan Bongkaran (DRV-41). Isinya: nama, HP, rekening, tempo bawaan, jenis. Nama kembar ditolak. Ditambah finance, GM, Owner; **Kepala Gudang boleh menambah supplier baru bertanda "belum diperiksa"** supaya bongkaran tidak tertahan. |
| AM2 | **Nota belanja wajib punya nomor nota dan foto nota.** Nomor nota yang sama untuk supplier yang sama ditolak (mencegah kembar). |
| AM3 | **Nota tidak dihapus dan tidak ditimpa.** Sebelum ada pembayaran: dikoreksi pengisinya dengan jejak. Sesudahnya: dikoreksi lewat baris koreksi beralasan (potongan harga, salah hitung) atau dibatalkan pemilik atau GM. |
| AM4 | **Tanggal nota** tidak boleh masa depan dan paling jauh 7 hari ke belakang; lebih jauh hanya pemilik atau GM dengan alasan (sama dengan 6A.10 aturan 8). |
| AM5 | **Satu kali bayar = satu baris Buku Kas**, dengan rincian nota mana saja yang ditutup (nota tertua lebih dulu, bisa diubah). Cocok dengan satu baris di mutasi bank. |
| AM6 | **Semua jalan bayar bermuara ke Buku Utang yang sama:** kotak "Supplier" di Catatan Cepat Owner, "Bayar supplier" dari laci toko, dan pembayaran yang dicatat finance. Finance melengkapinya dengan memilih supplier dan notanya. Uang yang belum dipasangkan ke nota tampil sebagai "belum dipasangkan", tetap mengurangi saldo kas. |
| AM7 | **Uang muka dan bayar lebih** menjadi titipan di supplier itu, dipakai untuk nota berikutnya; tidak ditolak. |
| AM8 | **Retur ke supplier** dicatat dengan foto dan nilai; mengurangi utang supplier itu setelah disahkan. |
| AM9 | **Sisa utang, jatuh tempo, dan umur utang dihitung server di satu tempat.** Layar hanya menampilkan. |
| AM10 | **Utang awal** tiap supplier diisi pada hari mulai sistem dari tagihan supplier (sejalan dengan 6A.10 aturan 21); pembayaran lama Rp6,99 miliar tidak dipasangkan mundur. |
| AM11 | **HPP dan omzet tidak diketik.** Keduanya masuk dari sistem kasir lewat Tarik Data Kasir (tahap awal: file export yang diunggah), per cabang per hari. Laba dihitung dari omzet dan HPP **sumber yang sama**; uang yang diterima ditampilkan terpisah sebagai arus kas. Bulan yang datanya belum masuk ditandai "belum lengkap", tidak ditampilkan sebagai laba. |
| AM12 | **Buku Piutang Lain** (bukan piutang toko): tiap baris punya orang, asal (misalnya sisa kasbon dari slip terakhir, lahir otomatis), jumlah, dan cicilan yang masuk sebagai uang masuk. **Dihapuskan** hanya oleh pemilik atau GM dengan alasan; tercatat sebagai biaya, tidak hilang diam-diam. |

## 6C.9 Jawaban pemilik (12 Oktober 2026)

Arahan umum: **semua temuan 6C harus teratasi di sistem baru** supaya tidak
terulang (tabel pemetaan di akhir 6C.10).

| No | Jawaban |
|---|---|
| 1 | **Nota belanja ada di sistem kasir**; datanya akan ditarik dan selalu diperbarui. |
| 2 | Toko belanja ke Gudang **benar-benar jual beli**: tercatat utang, lalu toko menyetor cash dan transfer tiap hari dan semuanya masuk ke Gudang. Gudang mengambil margin, toko juga mengambil margin. Perlakuan Gudang kepada cabang sendiri **sama dengan kepada toko luar**; bedanya paling harga (misalnya ke toko lain Rp100.000, ke toko sendiri Rp98.000). Jadi bukan murni pindah barang. Saran Claude ("barang pindah antar cabang") **tidak dipakai**. Beda "Gudang" dan "Hammielion" sebagai pemasok belum dijawab. |
| 3 | Semua pembayaran supplier **ditentukan Ibu** (Owner). |
| 4 | Barang dikembalikan: tergantung supplier; **kebanyakan hanya menjadi barang reject**. Uang muka: **tidak pernah**; pembayaran "tunai" dan **dibayar sebagian setelah barang datang**. Potongan: dicatat sesuai nota; kalau ada cashback atau **rebate dari pabrik** karena mencapai target (contoh: beli Rp10 juta, cashback Rp500 ribu), yang dihitung hanya nilai nota dan Rp500 ribu itu **"menguap"** (tidak tercatat). |
| 5 | Ok (Buku Piutang Lain; penghapusan hanya pemilik atau GM dengan alasan). |
| AM1–AM12 | Ok, dengan satu catatan: **AM2 (nomor nota dan foto nota wajib) hanya pilihan**, karena budaya yang sudah mendarah daging tidak bisa diubah dalam semalam. |

Catatan bacaan Claude:

- Kata "tunai" di jawaban 4 dibaca sebagai "tanpa uang muka dan tanpa
  tempo resmi", bukan "selalu uang fisik": data lama memuat 64 pembayaran
  supplier lewat rekening bank (Rp1,84 miliar) di samping 69 lewat kas tunai.
  V3 tetap melayani keduanya. Dikonfirmasi lewat butir AB.
- Jawaban 1 membuat AM2, AM3, dan AM4 berubah arti: nota tidak diketik di
  HRIS, jadi tidak ada nota yang diubah atau dihapus di HRIS.

### Butir penutup (diajukan di percakapan, 12 Oktober 2026)

| Butir | Isi | Saran Claude |
|---|---|---|
| Z | Setoran harian toko ke Gudang: apakah itu **pembayaran utang belanja** toko ke Gudang? Bagaimana kalau setoran lebih besar dari utangnya? Raja dan Markas (yang setor ke rekening sendiri, 6B.10 aturan 9) membayar Gudang dengan cara apa? Apa beda pemasok "Gudang" dan "Hammielion"? | Tiap toko punya satu **buku dengan Gudang**: belanja ke Gudang menambah utang, setoran dan transfer mengurangi; kalau lebih, tercatat sebagai uang toko yang dipegang Gudang (6B.10 aturan 20). Nota belanjanya tetap satu, di kasir. |
| AA | Sisa utang ke supplier luar dihitung di mana, dan apakah pembayaran supplier juga dicatat di kasir? | Dihitung HRIS: nota dari kasir dikurangi pembayaran dari Buku Kas. Pembayaran supplier tidak diketik di kasir, supaya tidak dua kali. |
| AB | Bacaan kata "tunai" (lihat di atas). | Tunai dan transfer dua-duanya dilayani. |

### Jawaban atas butir Z, AA, AB (12 Oktober 2026)

| Butir | Jawaban |
|---|---|
| Z1 | Setoran harian toko **dihitung sebagai pembayaran** utang belanjanya ke Gudang. |
| Z2 | Kelebihan setoran selama ini belum jelas; **seharusnya menjadi deposit** toko itu di Gudang. |
| Z3 | Raja dan Markas: dari rekening mereka **kadang dibayarkan langsung ke supplier Gudang**. |
| Z4 | "Gudang" dan "Hammielion" **sama**. |
| AA | Kasir punya catatan utang supplier sendiri, HRIS juga punya; **sengaja dibuat dua supaya bisa saling periksa**. Saran Claude (pembayaran tidak diketik di kasir) tidak dipakai. |
| AA (penjelasan) | Ditanyakan ulang karena pemilik khawatir salah paham. Jawaban: pembayaran supplier **memang dicatat di dua sistem**, dan yang mencatat pembayaran utang di sistem kasir adalah **Ibu (Owner)**. Aturan 4 dilengkapi dengan "siapa mencatat apa". |
| AB | Betul: "tunai" berarti tanpa uang muka dan tanpa tempo resmi; tunai dan transfer dua-duanya dilayani. |

Keterangan pemilik: pemberian nama di perusahaan ini sering asal jadi. Orang
A mengisi nama supplier, orang B mengisi lagi dengan nama lain, padahal
supplier-nya sama; catatan Owner pun begitu (lihat tabel istilah Petty Cash
di 6A.9). Aturan 1 ditulis ulang untuk ini.

Pemeriksaan terhadap WAJ-03 (satu data, satu pemilik) untuk butir AA: tidak
dilanggar, karena tiap sistem memegang catatannya sendiri (nota milik kasir,
pembayaran milik Buku Kas HRIS) dan HRIS hanya **membandingkan** angka sisa
utang kedua sistem; HRIS tidak menyalin catatan kasir menjadi catatannya.
Akibat yang disadari: finance mencatat pembayaran di dua tempat.

## 6C.10 Aturan yang dihasilkan (nomor v3 ditetapkan di 6E)

Semua butir sudah dijawab pemilik; tidak ada aturan yang menunggu.

| No | Aturan | Asal |
|---|---|---|
| 1 | **Satu daftar supplier**, milik Keuangan, dipakai pembayaran supplier dan Laporan Bongkaran (DRV-41). Isi: nama, HP, rekening, jenis, dan tempo bawaan (pilihan). Ditambah finance, GM, Owner; Kepala Gudang boleh menambah supplier baru bertanda "belum diperiksa" supaya bongkaran tidak tertahan. **Cabang sendiri bukan supplier** (aturan 12). **Penjaga nama asal jadi:** (a) saat menambah, sistem menampilkan nama yang mirip dan meminta memilih yang sudah ada atau menegaskan "memang baru"; nama yang persis sama ditolak; (b) tiap supplier punya daftar **nama lain** (misalnya singkatan di catatan Owner dan nama di kasir), sehingga nama dari kasir dan dari Catatan Cepat dipasangkan ke supplier yang sama; nama yang belum dikenal masuk daftar "belum dipasangkan" untuk finance; (c) dua supplier yang ternyata sama **digabung** oleh finance atau GM: riwayat keduanya menyatu, nama lama menjadi nama lain, dan penggabungan tercatat. | AM1, keterangan pemilik |
| 2 | **Nota belanja ke supplier milik sistem kasir.** HRIS membacanya lewat Tarik Data Kasir (tahap awal file yang diunggah, lalu sambungan) dan selalu diperbarui; **HRIS tidak mengetik nota belanja**. Tiap tarikan tercatat kapan dan oleh siapa. Nota yang berubah atau hilang di antara dua tarikan ditandai dengan nilai sebelum dan sesudah; tidak pernah berubah diam-diam. Koreksi nota dilakukan di kasir. | jawaban 1; menggantikan AM3 dan AM4 |
| 3 | **Nomor nota dan foto nota tidak diwajibkan**; boleh diisi kalau ada. Gantinya, nota dengan supplier, tanggal, dan total yang sama ditandai "mungkin kembar" untuk finance. Bukti saat uang keluar tetap mengikuti 6A.10 aturan 6 dan 25. | catatan pemilik atas AM2 |
| 4 | **Sisa utang supplier versi HRIS dihitung server di satu tempat**: nota (dari kasir) dikurangi pembayaran (Buku Kas), retur yang diterima supplier, dan potongan yang memotong nota. Umur utang ikut dihitung. Layar hanya menampilkan. **Saling periksa dengan kasir:** kasir memegang catatan utangnya sendiri; HRIS menarik angka sisa utang versi kasir dan menampilkannya **berdampingan** per supplier. Yang berbeda ditandai "perlu ditelusuri" untuk finance dan GM; tidak ada angka yang otomatis menimpa angka lain. **Siapa mencatat apa:** pembayaran utang di sistem kasir dicatat **Owner** (keadaan sekarang, dipertahankan); di HRIS dicatat finance (atau Owner lewat kotak "Supplier" kalau ia mau, tidak wajib). Supaya Owner tidak mengetik dua kali, HRIS menarik pembayaran yang tercatat di kasir dan menampilkannya kepada finance sebagai daftar **"dibayar menurut kasir, belum ada di Buku Kas"**; finance mencatatnya di Buku Kas dengan sumber uang yang sebenarnya (Brankas atau rekening) dan buktinya, tidak sekadar menyalin: transfer dicocokkan dengan mutasi, tunai tertangkap Hitung Kas Brankas (6A.10 aturan 30). Pembayaran di Buku Kas yang tidak ada di kasir juga ditandai. | AM9, butir AA, penjelasan pemilik |
| 5 | **Satu kali bayar = satu baris Buku Kas**, dengan rincian nota yang ditutup (nota tertua lebih dulu, bisa diubah). **Bayar sebagian adalah hal biasa.** | AM5, jawaban 4 |
| 6 | **Semua jalan bayar bermuara ke buku utang yang sama**: kotak "Supplier" di Catatan Cepat Owner, "Bayar supplier" dari laci toko (6B.10 aturan 12), dan catatan finance; dari Brankas maupun rekening bank. Finance memasangkannya ke supplier dan nota. Uang yang belum dipasangkan (termasuk karena notanya belum masuk dari kasir) tampil sebagai **"belum dipasangkan"** dengan umurnya dan tetap mengurangi saldo kas. | AM6 |
| 7 | **Yang memutuskan membayar adalah Owner.** Tidak ada jatuh tempo wajib dan tidak ada persetujuan sebelum membayar. Sistem hanya membantu: daftar utang per supplier dengan umur tiap nota, untuk Owner dan GM. Tempo bawaan per supplier boleh diisi; kalau diisi, dipakai perkiraan kas (6D). | jawaban 3 dan 4 |
| 8 | **Uang muka tidak dipakai.** Bayar lebih yang tidak sengaja tidak ditolak: menjadi titipan di supplier itu dan dipakai nota berikutnya. | jawaban 4, AM7 |
| 9 | **Barang yang dikembalikan atau rusak punya dua akhir:** (a) **diterima supplier**: dicatat dengan nilai, mengurangi utang supplier itu setelah disahkan; (b) **barang reject**: kerugian perusahaan; jumlah dan nilainya dicatat di kasir (stok), HRIS membaca nilainya supaya tampil di laporan sebagai kerugian barang, tidak hilang diam-diam. | jawaban 4, AM8 |
| 10 | **Cashback dan rebate dari supplier atau pabrik dicatat**, tidak menguap. Nota tetap senilai nota. Rebate dicatat finance sebagai "potongan dari supplier" dengan salah satu bentuk: **uang** (uang masuk berkategori rebate), **potong nota** (mengurangi utang), atau **barang** (masuk stok di kasir). Tampil sebagai pos tersendiri di laporan (6D). | jawaban 4 |
| 11 | **Utang awal** tiap supplier diisi pada hari mulai sistem dari tagihan supplier (sejalan 6A.10 aturan 21). Pembayaran lama tidak dipasangkan mundur. | AM10 |
| 12 | **Toko belanja ke Gudang adalah penjualan Gudang**, bermargin, diperlakukan seperti penjualan ke toko luar: notanya satu, di kasir (LOG-65); tidak dicatat sebagai "pembelian supplier" di HRIS. "Gudang" dan "Hammielion" di catatan lama adalah pemasok yang sama. Tiap toko punya **buku dengan Gudang**, dihitung server: belanja menambah utang; **setoran tunai dan transfer toko dihitung sebagai pembayaran**; kelebihannya menjadi **deposit toko di Gudang** dan dipakai belanja berikutnya (sejalan LOG-49 dan 6B.10 aturan 20). Jenis: **pelapis** 6B.10 aturan 8 dan 9: setoran tetap Pindah Dana secara uang, dan sekaligus tercatat di buku ini. Pembayaran itu ikut daftar kiriman ke kasir (LOG-65). | jawaban 2, butir Z1, Z2, Z4 |
| 12a | **Uang cabang yang dipakai membayar supplier Gudang** (dari rekening cabang atau dari laci, 6B.10 aturan 12): satu baris Buku Kas keluar dari tempat uang cabang itu, dipasangkan ke nota supplier (aturan 6), dan **otomatis tercatat sebagai pembayaran cabang itu kepada Gudang** di buku aturan 12. Satu kejadian, satu kali dicatat. | butir Z3 |
| 13 | **Harga pokok dan omzet tidak diketik**; masuk dari kasir per cabang per hari. Laba dihitung dari omzet dan harga pokok sumber yang sama; uang yang diterima ditampilkan terpisah. Bulan yang datanya belum masuk ditandai "belum lengkap". Harga pokok toko untuk barang dari Gudang = harga beli dari Gudang. | AM11, jawaban 2 |
| 14 | **Laba gabungan perusahaan tidak menghitung dua kali** penjualan Gudang ke cabang sendiri: laba per cabang memakai harga jual-beli antar cabang, laba gabungan menghapus bagian antar cabang. Rinciannya di 6D. | akibat jawaban 2 |
| 15 | **Buku Piutang Lain** (bukan piutang toko): orang, asal, jumlah, cicilan (uang masuk). Sisa kasbon dari slip terakhir lahir otomatis (GAJ-53, DRV-73). Dihapuskan hanya oleh pemilik atau GM dengan alasan; tercatat sebagai biaya. | AM12, jawaban 5 |
| 16 | **Tidak ada yang memeriksa pembayaran supplier yang ia isi sendiri**; berlaku 6A.10 aturan 5, 11, 12, 20. Pembayaran yang sudah diperiksa hanya dibatalkan dengan alasan. | temuan |
| 17 | **Satu menu Utang Supplier**, satu alamat. Tidak ada halaman ketik HPP, dan tidak ada Buku Piutang toko di HRIS. | temuan |

### Temuan dan aturan yang mengatasinya

| Temuan | Aturan |
|---|---|
| 191 dari 196 nota tanpa nomor, tanpa foto; nota kembar | 2, 3 |
| Nota tidak diperiksa; diubah dan dihapus tanpa jejak; tanggal bebas | 2 |
| "Sudah dibayar sekarang" dua langkah lepas | 5 (PRI: langkah utuh di server) |
| Sisa utang hanya sejak 8 Agustus; Rp6,99 miliar pembayaran tak bertaut | 6, 11 |
| Rumus sisa utang di layar dan di database berbeda | 4 |
| Satu transfer dipecah jadi banyak baris | 5 |
| Pembayaran dibebankan ke cabang lain dari notanya | 5 (cabang mengikuti nota) |
| Bayar lebih ditolak; uang muka tidak ada tempat | 8 |
| Retur ke supplier dan barang reject tidak tercatat | 9 |
| Cashback dan rebate menguap | 10 |
| Tidak ada jatuh tempo dan umur utang | 4, 7 |
| Toko "berutang" Rp352 juta ke Gudang dan Hammielion, hampir tak pernah "dibayar"; dua catatan untuk barang yang sama | 12 |
| Bayar supplier dari laci atau oleh Owner tidak mengurangi utang | 6 |
| 19 pembayaran dan 15 isian HPP disetujui pengisinya | 13, 16 |
| HPP diketik bulanan, Juli kosong; satu kolom dua arti; yang disetujui masih bisa diubah | 13 |
| Laba kotor = Kas Masuk − HPP (tampil rugi) | 13, 14 |
| Omzet di tiga tempat | 13 (6B.10 aturan 1) |
| Supplier tanpa data; kepala cabang boleh menambah; halaman tanpa penjaga hak | 1, 16 |
| Nama supplier asal jadi: satu supplier ditulis dengan beberapa nama | 1 |
| Setoran toko tidak pernah mengurangi utangnya ke Gudang; kelebihan setoran tidak jelas | 12 |
| Cabang membayar supplier Gudang dari uangnya sendiri tanpa tercatat sebagai bayar ke Gudang | 12a |
| Catatan utang kasir dan HRIS tidak pernah dibandingkan | 4 |
| Satu halaman di dua menu | 17 |
| Piutang mantan karyawan tidak punya tempat | 15 |
| Kategori supplier hanya disembunyikan layar | 6A.10 aturan 13 |

### Titipan dari 6C

- Untuk 6D: laba per cabang dan laba gabungan (aturan 14); pos rebate (10);
  kerugian barang reject (9); perkiraan kas dari umur utang (7); dua hitungan
  laba lama (KEU-C25).
- Untuk modul Tarik Data Kasir: nota belanja per supplier (tanggal, total,
  cabang), nilai barang reject, HPP dan omzet per cabang per hari, penjualan
  Gudang ke cabang sendiri.
- Untuk modul Tarik Data Kasir (tambahan): sisa utang supplier versi kasir
  dan pembayaran supplier yang tercatat di kasir (pembanding, aturan 4);
  nama supplier di kasir (dipasangkan lewat nama
  lain, aturan 1).
- Untuk 6D (tambahan): deposit toko di Gudang dan utang toko ke Gudang
  dalam laporan per cabang.
- Untuk 6E: kamus (Utang supplier, Belum dipasangkan, Potongan dari
  supplier, Barang reject, Buku dengan Gudang, Deposit toko di Gudang, Nama
  lain supplier, Piutang Lain); aturan 12a diberi nomor sendiri.
- Untuk keputusan data lama: nota "Gudang" dan "Hammielion" (Rp395 juta)
  tidak dipindahkan sebagai utang supplier.

---

# Bagian 6D1: Modal, aset, biaya tetap, dan sewa aset milik Owner

6D berukuran **besar** dan dipecah dua (disetujui pemilik, 12 Oktober 2026):
**6D1** modal, aset, biaya tetap, sewa aset milik Owner; **6D2** arus kas,
laporan keuangan, dashboard. Ukuran 6D1: **sedang**.

Sumber: `hris-app/app/(dashboard)/keuangan/modal/page.tsx` (449 baris),
`aset/page.tsx` (640), `biaya-tetap/page.tsx` (320), tab Modal Cabang dan
Aset di `approval/page.tsx`, bagian "Total Aset Barang" di
`laporan/detail/page.tsx`; tabel `fin_branch_capital_baseline`,
`fin_branch_capital_snapshot`, `fin_assets`, `fin_asset_contracts`,
`fin_recurring_costs`, `fin_vehicle_rental_rates`; fungsi
`fin_generate_recurring_costs`, `fin_generate_vehicle_rental_costs`; dua
jadwal otomatis (cron); kebijakan akses di database.

Yang sudah diputuskan di bab lain dan tidak ditanyakan lagi:

- Saldo awal kas dari hitung fisik pada hari mulai (6A.10 aturan 21); saldo
  dihitung server di satu tempat (16).
- Baris otomatis hanya lahir dari modulnya dan bertaut (6A.10 aturan 13);
  satu kejadian bayar satu baris, bertanggal hari uang dibayar, tanpa
  pasangan "biaya" dan "pembayaran" (15); rekening sumber wajib (14).
- Mengisi: finance, pemilik, GM; memeriksa: pemilik atau GM; HR tanpa menu
  Keuangan; tidak ada yang memeriksa isiannya sendiri (6A.10 aturan 5, 20).
- Prive hanya dicatat pemilik atau GM (6A.10 aturan 9); di layar Owner
  namanya "Pribadi" (32).
- Kategori punya jenis, termasuk "pengambilan pemilik" (6A.10 aturan 10).
- Harga pokok dan omzet masuk dari kasir, tidak diketik (6C.10 aturan 13).
- Cabang "Logistik" adalah sewa aset milik Owner yang dibayar kantor, bukan
  uang berpindah di dalam perusahaan (koreksi pemilik, 6B.9).
- Aturan uang bertanggal berlaku (WAJ-07); data uang tidak dihapus (PRI-02).

## 6D1.1 Bagian ini mengurus apa

Tiga hal yang umurnya panjang: **modal** (berapa harta yang ditanam di tiap
cabang), **aset** (barang besar milik usaha dan kontrak sewanya), dan
**biaya tetap** (tagihan yang datang tiap bulan). Di dalamnya ada satu urusan
khusus: **sewa aset milik Owner**, yaitu tempat dan kendaraan milik Owner
yang dipakai usaha dan dibayar kantor tiap bulan.

## 6D1.2 Data di sistem lama (dicek ke database, 12 Oktober 2026)

| Data | Isinya | Tabel | Jumlah |
|---|---|---|---|
| Modal awal | Per cabang, sekali saja: cash, nilai barang, nilai aset | `fin_branch_capital_baseline` | 5 baris (5 cabang penjual), semuanya bertanggal 1 September 2026 |
| Modal bulanan | Per cabang per bulan: nilai barang, nilai aset | `fin_branch_capital_snapshot` | **0** |
| Daftar aset | Cabang, nama, tipe, nilai beli, tanggal beli, kondisi | `fin_assets` | **0** |
| Kontrak sewa | Aset, jenis, mulai, berakhir, nilai sewa, siklus bayar, pengingat | `fin_asset_contracts` | **0** |
| Biaya tetap berkala | Cabang, kategori, uraian, nominal, cara hitung, rekening, "sewa internal" | `fin_recurring_costs` | 8 baris, semuanya aktif, semuanya kategori Sewa, semuanya dibayarkan ke cabang "Logistik" |
| Tarif sewa kendaraan | Kendaraan, tarif per hari, cabang pembayar, cabang penerima | `fin_vehicle_rental_rates` | 3 baris (3 mobil), semuanya dari Gudang ke "Logistik" |

Rincian modal:

- Kelima baris hanya berisi **nilai barang**: Gudang Rp1,46 miliar, Toko
  Pusat Rp240 juta, Toko Depan Rp120 juta, Raja Rp103 juta, Markas Rp52
  juta; jumlah **Rp1,97 miliar**. Kolom cash dan nilai aset **Rp0 di semua
  cabang**.
- Kelimanya **disetujui oleh pengisinya sendiri**.
- Dipakai di satu tempat saja: kotak "Total Aset Barang" di Detail Laba Rugi,
  berketerangan "per 1 September". Angkanya tidak pernah berubah sejak itu,
  padahal stok bergerak tiap hari.
- Tidak ada catatan uang yang ditanam Owner ke usaha. Yang ada hanya
  kategori Kas Keluar "Prive": 7 baris, Rp1,49 juta (September dan Oktober),
  semuanya dibebankan ke cabang "Logistik".

Rincian sewa yang dibayar kantor ke "Logistik":

| Yang disewa | Pembayar | Tarif | Cara hitung |
|---|---|---|---|
| Sewa Gudang | Gudang | Rp5.250.000 | per bulan |
| Sewa Toko Pusat | Toko Pusat | Rp5.000.000 | per bulan |
| Sewa Raja Petshop | Raja | Rp2.700.000 | per bulan |
| Sewa Markas Petshop | Markas | Rp2.200.000 | per bulan |
| Sewa Toko Depan | Toko Depan | Rp2.200.000 | per bulan |
| Sewa Parkir | Gudang | Rp15.000 | per hari kalender |
| Sewa Motor Raja | Raja | Rp10.000 | per hari kalender |
| Sewa Motor Pusat | Toko Pusat | Rp10.000 | per hari kalender |
| Engkel Box | Gudang | Rp350.000 | per **hari mobil berangkat** |
| L300 | Gudang | Rp250.000 | per hari mobil berangkat |
| Grand Max Box | Gudang | Rp150.000 | per hari mobil berangkat |

- Tercatat otomatis: Agustus Rp33,0 juta, September Rp35,0 juta (tempat dan
  harian Rp18,4 juta; kendaraan Rp16,6 juta). Setahun kira-kira **Rp420
  juta**. Juli Rp28,2 juta diketik tangan. Total uang masuk "Logistik"
  **Rp96,2 juta** (30 baris).
- Semua tarif berlaku mulai 1 Agustus, dan diketik 2 September.
- **Oktober belum tercatat**: mesin baru jalan tanggal 28.
- Yang keluar dari cabang "Logistik" (disetujui): service Rp19,4 juta (31
  baris), **sewa Rp19,0 juta** (2 baris diketik, Agustus), Prive Rp1,2 juta,
  lain-lain Rp0,6 juta; jumlah Rp40,2 juta. Menurut catatan, sisanya
  **Rp56 juta** masih di rekening "Mandiri Logistik".
- Cabang "Logistik" tidak punya karyawan.
- Kategori Sewa seluruhnya: 46 baris, Rp205,8 juta sejak Mei (impor lama,
  ketikan Juli Rp57,2 juta, lalu mesin).

## 6D1.3 Aturan yang ditemukan

### Modal cabang

| No | Aturan | Sumber |
|---|---|---|
| KEU-D01 | Modal awal diisi **sekali per cabang**: tanggal, cash, nilai barang, nilai aset tetap. Tiga angka itu diketik bebas, tidak dihitung dari data mana pun. | `modal/page.tsx`, kunci unik per cabang |
| KEU-D02 | Modal bulanan (nilai barang dan nilai aset per cabang per bulan) punya layar tetapi belum pernah diisi. | data |
| KEU-D03 | Diisi owner, hr, finance; menunggu diperiksa di halaman Verifikasi oleh tiga jabatan yang sama. Memeriksa isian sendiri tidak dilarang. | `approval/page.tsx`, kebijakan `fin_capital_*` |
| KEU-D04 | Layar hanya mengizinkan ubah selama menunggu; database mengizinkan owner, hr, finance mengubah yang sudah disetujui. | kebijakan `*_update_central` |
| KEU-D05 | Owner boleh **menghapus** modal awal dan modal bulanan, termasuk yang sudah disetujui; setelah dihapus cabang itu bisa diisi angka baru. | `handleDeleteBaseline` |
| KEU-D06 | Kepala cabang bisa melihat modal cabangnya. | kebijakan `*_select` |
| KEU-D07 | Laporan hanya membaca **nilai barang** dari modal awal; cash dan nilai aset tidak dipakai di mana pun. | `laporan/detail/page.tsx` |
| KEU-D08 | Tidak ada tempat mencatat uang yang ditanam atau ditarik pemilik sebagai modal; pengambilan hanya lewat kategori Kas Keluar "Prive". | tidak ada tabel |

### Aset dan kontrak sewa

| No | Aturan | Sumber |
|---|---|---|
| KEU-D09 | Aset: cabang, nama, tipe (diketik bebas), nilai beli, tanggal beli, kondisi (aktif, nonaktif, dijual, rusak). Tidak ada foto, nomor, pemegang, atau lokasi. | `aset/page.tsx` |
| KEU-D10 | Aset tidak bertaut ke Kas Keluar pembeliannya; membeli barang besar tercatat sebagai biaya biasa bulan itu. Tidak ada penyusutan. | tidak ada kolom taut |
| KEU-D11 | Kontrak sewa menempel pada satu aset: jenis, mulai, berakhir, nilai sewa, siklus (bulanan, tahunan, sekali bayar), pengingat (bawaan 30 hari). | `fin_asset_contracts` |
| KEU-D12 | Pengingat "mendekati jatuh tempo" hanya tampil di halaman Aset, dihitung di layar dari jam perangkat. Tidak ada pemberitahuan. | `dueSoon` |
| KEU-D13 | Kontrak tidak menimbulkan tagihan apa pun. Kolom penghubung kontrak ke biaya tetap ada, tetapi tidak pernah diisi dan tidak punya layar. | `asset_contract_id` |
| KEU-D14 | Diisi dan diperiksa seperti modal (KEU-D03, D04). Owner boleh menghapus aset; kontraknya ikut terhapus. | `handleDeleteAsset` |

### Biaya tetap berkala

| No | Aturan | Sumber |
|---|---|---|
| KEU-D15 | Satu item: cabang pembayar, kategori, uraian, nominal, cara hitung (**tetap per bulan**, atau **tarif harian × jumlah hari kalender**), rekening sumber (pilihan), mulai berlaku, berakhir (pilihan). | `biaya-tetap/page.tsx` |
| KEU-D16 | Item **tidak diperiksa siapa pun**: begitu disimpan langsung berlaku. Diisi owner, hr, finance. | tidak ada kolom status |
| KEU-D17 | Tiap bulan mesin membuat baris **Kas Keluar yang langsung berstatus disetujui**, bertanggal hari terakhir bulan itu, untuk tiap item aktif. Tidak ada orang yang memeriksa, dan tidak ada pengecekan apakah uangnya benar-benar keluar. | `fin_generate_recurring_costs` |
| KEU-D18 | Layar berkata "tiap tanggal 1"; mesinnya dijadwalkan **tanggal 28**. | cron `5 1 28 * *` |
| KEU-D19 | **"Sewa internal"**: kalau dicentang, mesin juga membuat **Kas Masuk** sejumlah sama untuk cabang penerima, langsung disetujui, metode "transfer", ke rekening penerima. Baris pemasukan ini tidak bertaut ke itemnya. | `fin_generate_recurring_costs` |
| KEU-D20 | Satu item satu baris per bulan (dijaga database). Bulan yang terlewat tidak dikejar: mesin hanya membuat untuk bulan berjalan. | indeks unik, `last_generated_period` |
| KEU-D21 | Nominal tidak punya riwayat. Layar hanya bisa menyalakan dan mematikan item; database mengizinkan nominalnya ditimpa. | `toggleActive`, kebijakan update |
| KEU-D22 | Item tidak bisa dihapus (database tidak mengizinkan). Mematikan item tidak mengubah baris yang sudah dibuat. | kebijakan |

### Sewa kendaraan

| No | Aturan | Sumber |
|---|---|---|
| KEU-D23 | Tiap kendaraan punya tarif per hari; sewa bulan itu = tarif × **jumlah hari kendaraan itu punya trip** di Logistik. Kendaraan yang tidak jalan tidak kena sewa. | `fin_generate_vehicle_rental_costs` |
| KEU-D24 | Mesinnya terpisah dari biaya tetap, jalan di hari terakhir bulan, dan membuat Kas Keluar serta Kas Masuk langsung disetujui seperti KEU-D17 dan D19. | cron `1 17 28-31 * *` |
| KEU-D25 | **Tarif kendaraan tidak punya layar sama sekali**: diisi langsung ke database. Tidak bertanggal berlaku, tidak punya jejak perubahan. | tidak ada halaman, tidak ada trigger |
| KEU-D26 | Penjaga dobelnya hanya satu kolom "terakhir dibuat"; tidak ada kunci unik seperti di biaya tetap. | fungsi |
| KEU-D27 | Tarif kendaraan bisa dibaca **semua orang yang login**. | kebijakan `read_all` |

### Cabang "Logistik"

| No | Aturan | Sumber |
|---|---|---|
| KEU-D28 | "Logistik" terdaftar sebagai cabang, punya rekening sendiri, tanpa karyawan. Sewa yang dibayar kantor tercatat sebagai **pemasukan** cabang ini; biaya service, sewa ke pihak luar, dan Prive tercatat sebagai **pengeluaran**-nya. | data |
| KEU-D29 | Tidak ada daftar "aset milik Owner" dan tidak ada penghubung antara sewa yang dibayar kantor dengan biaya aset itu ke pihak luar. Dua angka per aset (contoh pemilik: kontrak Rp20 juta, dibayar kantor Rp25 juta) tidak bisa dilihat. | tidak ada |

## 6D1.4 Menu di sistem lama

| Menu | Dipakai untuk apa | Mirip dengan menu lain? |
|---|---|---|
| Modal & Aset → Modal Cabang | Modal awal dan modal bulanan | Nilai barang juga ada di sistem kasir |
| Modal & Aset → Aset & Kontrak Sewa | Daftar aset dan kontrak (kosong) | Kontrak sewa bertumpuk dengan Biaya Tetap Berkala |
| Kas Keluar → Biaya Tetap Berkala | Tagihan sewa bulanan | Ya, lihat di atas |
| (tidak ada menu) | Tarif sewa kendaraan | Kendaraan juga ada di Logistik |
| Verifikasi Keuangan → tab Modal Cabang, tab Aset | Memeriksa | Satu halaman dengan pemeriksaan Kas |

## 6D1.5 Tumpang tindih

1. **Sewa tercatat di tiga tempat yang tidak saling kenal:** kontrak sewa
   (kosong), biaya tetap berkala (dipakai), dan tarif sewa kendaraan (tanpa
   layar). Ditambah sewa yang diketik tangan di Kas Keluar.
2. **Dua mesin** untuk pekerjaan yang sama (membuat tagihan sewa bulanan),
   dengan jadwal, penjaga dobel, dan sumber tarif yang berbeda.
3. "Nilai aset" ada di modal awal (diketik) dan di daftar aset (dijumlah);
   keduanya tidak dicocokkan.
4. "Cash" di modal awal dan saldo rekening di Buku Kas: dua angka untuk uang
   yang sama; yang pertama Rp0 semua.
5. Nilai barang diketik di HRIS, padahal sumbernya stok di sistem kasir.
6. Kendaraan terdaftar di Logistik (`vehicles`) dan tarif sewanya di
   Keuangan; kalau kelak ada daftar aset, kendaraan yang sama muncul lagi.
7. Uang untuk Owner keluar lewat dua jalan: "sewa" ke cabang Logistik, dan
   "Prive".

## 6D1.6 Kejadian di lapangan dan jalan keluarnya

| Kejadian | Di sistem lama | Ada jalan keluar? |
|---|---|---|
| Tarif sewa naik | Item dimatikan lalu dibuat baru, atau ditimpa di database; riwayat tarif hilang | Tanpa jejak |
| Sewa bulan itu ternyata tidak dibayar, atau dibayar sebagian | Tetap tercatat lunas dan disetujui | Tidak |
| Sewa dibayar setahun sekaligus | Tidak ada tempat; diketik sebagai biaya satu bulan (Juli: Raja Rp32 juta) | Tidak |
| Item salah nominal dan mesin sudah jalan | Baris otomatis sudah disetujui; item tidak bisa dihapus | Tidak |
| Mesin tidak jalan satu bulan | Bulan itu hilang, tanpa tanda | Tidak |
| Mobil rusak sebulan penuh | Sewa Rp0 (benar), tetapi biaya service tetap masuk ke "Logistik" | Sebagian |
| Kontrak tempat hampir habis | Tidak ada yang mengingatkan (daftar kontrak kosong) | Tidak |
| Modal awal salah ketik | Owner menghapus lalu mengisi lagi; jejaknya hanya di tabel riwayat tanpa layar | Tak terlihat |
| Beli barang besar (kulkas, motor) | Jadi biaya penuh bulan itu; tidak masuk daftar aset | Tidak |
| Aset dijual, hilang, atau rusak | Ganti kondisi di daftar; uang hasil jual tidak bertaut | Sebagian |
| Owner mengambil hasil sewa | Diketik sebagai "Prive" di cabang Logistik (Rp1,2 juta dari Rp96 juta) | Tidak lengkap |

## 6D1.7 Pertanyaan untuk pemilik (diajukan di percakapan, 12 Oktober 2026)

Butuh pandangan:

1. **Daftar aset milik Owner yang disewa kantor**: sebelas baris di 6D1.2
   itu sudah lengkap dan benar? Mana yang milik Owner sendiri, dan mana yang
   Owner kontrak dari orang lain lalu disewakan ke kantor?
2. **Siapa yang menetapkan tarif sewa**, dan apa yang Bapak harapkan dari
   sistem soal kekhawatiran markup?
3. **Rekening "Mandiri Logistik"**: rekening pribadi Owner atau rekening
   usaha? Apakah sewa benar-benar ditransfer tiap bulan? **Service mobil**
   ditanggung Owner (pemilik mobil) atau kantor?
4. **Modal**: perlukah sistem mencatat uang pribadi Owner yang masuk ke
   usaha dan yang diambil, supaya terlihat "ditanam berapa, sudah diambil
   berapa"?
5. **Daftar aset kantor** (kulkas, komputer, rak, motor): perlu atau tidak,
   dan barang semahal apa yang layak dicatat?
6. **Tagihan rutin selain sewa** (listrik, internet, pajak kendaraan,
   cicilan, iuran): mana yang ada dan ingin diingatkan?

Cukup ok atau tidak: usulan AN1–AN12 di 6D1.8.

## 6D1.8 Usulan untuk v3 (belum disetujui)

| No | Usulan |
|---|---|
| AN1 | **Mesin membuat tagihan, bukan catatan uang keluar.** Tiap bulan lahir "tagihan rutin" (belum dibayar). Uang baru tercatat keluar saat benar-benar dibayar (Catatan Cepat Owner atau finance), lalu dipasangkan ke tagihannya. Tagihan yang belum dibayar terlihat dengan umurnya. Sejalan 6A.10 aturan 15. |
| AN2 | **Satu mesin tagihan rutin** untuk semua: tetap per bulan, per hari kalender, dan per hari kendaraan berangkat. Tarif kendaraan punya layar. |
| AN3 | **Tarif bertanggal berlaku dan tidak ditimpa** (WAJ-07): tarif baru = baris baru dengan tanggal mulai; riwayat tarif terlihat. |
| AN4 | **Tarif dan tagihan rutin diisi finance, GM, atau Owner dan diperiksa GM atau Owner lain**; tidak ada yang memeriksa isiannya sendiri. HR dan kepala cabang tidak melihat. |
| AN5 | **Sewa kendaraan dihitung dari hari kendaraan berangkat** menurut trip Logistik (dibawa dari KEU-D23); hitungannya di server, satu tempat. |
| AN6 | **Bulan yang terlewat dikejar dan ditandai**: mesin memeriksa semua bulan sejak tanggal mulai, bukan hanya bulan berjalan; kegagalan mesin tampil di daftar "perlu perhatian" GM. |
| AN7 | **Bayar di muka** (misalnya sewa setahun): satu kali uang keluar, dibagi rata ke bulan-bulan yang dicakup untuk hitungan laba. |
| AN8 | **Kontrak tempat** dicatat di aset atau tempatnya: mulai, berakhir, nilai, pihak pemilik. **Pengingat 30 hari sebelum habis** tampil di dashboard GM dan Owner (dibawa dari KEU-D12, dihitung server). |
| AN9 | **"Logistik" bukan cabang.** Gantinya **Buku Sewa Owner**: hak sewa bertambah dari tagihan rutin, berkurang saat Owner mengambil atau saat kantor membayari biaya aset itu; sisanya terlihat. Rinciannya menunggu jawaban 1–3. |
| AN10 | **Nilai barang (stok) tidak diketik**; ditarik dari sistem kasir per cabang tiap akhir bulan lewat Tarik Data Kasir. |
| AN11 | **"Modal cash" yang diketik dihapus**; gantinya saldo awal dari hitung fisik (6A.10 aturan 21). |
| AN12 | **Tidak ada hapus** untuk modal, aset, kontrak, tarif, dan tagihan: hanya dinonaktifkan atau dibatalkan dengan alasan; jejaknya bisa dibuka di layar (6A.10 aturan 12 dan 17). |

## 6D1.9 Jawaban pemilik (12 Oktober 2026)

| No | Jawaban |
|---|---|
| 1 | **Gudang, Raja, Markas, dan Toko Depan dikontrak dari orang lain**; selebihnya (Toko Pusat, parkir, dua motor, tiga mobil) **milik Ibu**. |
| Temuan 8 | Rp32 juta di Raja pada Juli adalah **pembayaran kontrak tahunan** ke pemilik tempat. |
| 2 | Ok, ikuti saran: tarif diisi Owner atau GM, bertanggal mulai; riwayat kenaikan dan selisih per aset tampil untuk GM dan Owner saja. |
| 3 | Rekening "Logistik" **seharusnya menampung** uang sewa itu; kenyataannya masih membingungkan. **Service ditanggung Ibu.** Usul pemilik: tiap Ibu mengambil uang pribadi, **berkurang dari sini**, sehingga **bisa minus**. |
| 4 | Catatan uang pribadi Owner belum ada: **uang pribadi dan uang usaha masih bercampur** karena Owner tidak disiplin, dan GM masih bingung menatanya. |
| 5 | Daftar aset kantor: sebaiknya ada (ikuti saran: Rp1 juta ke atas, lahir dari pembeliannya, biaya dibagi rata per bulan oleh mesin). |
| 6 | Tagihan rutin lain: **listrik, internet, pajak, cicilan**; bisa ditambah nanti. |
| AN1–AN12 | Ok, dengan dua catatan di bawah. |
| Catatan AN2 | Sewa kadang **dicatat masuk "Logistik" tetapi uangnya belum diambil** (contoh Raja Rp32 juta): pencatatannya sudah berkurang, uangnya belum dipisahkan; saat kontrak jatuh tempo malah **diambil dari uang Gudang**. Bagi GM ini tumpang tindih dan mudah terlupa; minta **ditangani mesin**. |
| Catatan AN10 | Minta **mesin pemeriksa pergeseran modal**: mengukur belanja, laba rugi, dan lain-lain, apakah modal menyusut, adakah tumpang tindih atau masalah lain. |

Pertanyaan pemilik: kenapa "tarif tidak punya layar dan diisi langsung ke
database" selalu dicatat sebagai temuan, apakah itu salah, dan bagaimana
supaya tidak terulang. Jawaban Claude di percakapan: bukan kecurangan,
melainkan jalan pintas saat membangun; bahayanya, angka yang menentukan uang
(Rp16,6 juta sebulan) hanya bisa dilihat dan diubah lewat programmer, tanpa
tanggal berlaku, tanpa jejak, tanpa pemeriksa, dan pemilik tidak tahu angka
itu ada. Pencegahnya diusulkan sebagai prinsip baru (butir G di bawah).

Catatan bacaan Claude:

- Temuan tambahan dari jawaban "temuan 8": di laporan lama **sewa Raja
  terhitung dua kali**: Rp32 juta (kontrak tahunan, Juli) sebagai biaya
  Raja, lalu Rp2,7 juta per bulan mulai Agustus juga sebagai biaya Raja.
  Sewa bulanan Raja setahun Rp32,4 juta, hampir sama dengan kontraknya.
- Jawaban 3 dan 4 dibaca sebagai satu kebutuhan: **satu buku untuk semua
  urusan uang antara Ibu dan usaha**, yang boleh minus.

### Butir penutup (diajukan di percakapan, 12 Oktober 2026)

| Butir | Isi | Saran Claude |
|---|---|---|
| A | Uang sewa: dipindahkan sungguhan tiap bulan ke rekening penampung, atau cukup **dicatat sebagai hak**? | Cukup dicatat sebagai hak di **Buku Ibu**; tidak ada "uang pindah" yang ditulis mesin. Uang baru tercatat bergerak saat benar-benar bergerak. Kontrak ke pihak luar dibayar dari tempat uang mana pun dan **mengurangi Buku Ibu**. |
| B | Satu **Buku Ibu** gabungan (hak sewa, uang pribadi masuk, ambil pribadi, service dan kontrak aset Ibu), boleh minus. | Ya. Minus berarti Ibu memakai uang usaha melebihi haknya; tampil apa adanya untuk GM dan Owner, tanpa menolak pengambilan. |
| C | **Pengingat kontrak**: 90, 60, dan 30 hari sebelum jatuh tempo, dengan angka "hak sewa aset itu yang terkumpul sejak kontrak terakhir" dan "sisa Buku Ibu". | Ya. Ini jawaban atas "faktor lupa". |
| D | Saldo awal Buku Ibu pada hari mulai. | **Mulai dari nol**; sisa Rp56 juta di catatan lama tidak dibawa, karena uangnya tidak pernah benar-benar dipisahkan. |
| E | **Cek Modal** tiap akhir periode (rumus di aturan 14). | Ya; rincian tampilannya di 6D2. |
| F | **Cicilan** yang dimaksud: cicilan apa, atas nama siapa, dan ditanggung usaha atau Ibu? | Belum bisa disarankan; butuh keterangan. |
| G | Prinsip baru (calon PRI-32): **setiap angka yang menentukan uang wajib punya layar pengaturan**, tanggal berlaku, jejak, dan pemeriksa; tidak ada yang diisi langsung ke database. | Ya. |

### Jawaban atas butir penutup (12 Oktober 2026)

| Butir | Jawaban |
|---|---|
| A, B, C, D, E, G | **Ok** (satu jawaban "ok" untuk semuanya). |
| F | Belum dijawab (cicilan apa, atas nama siapa, tanggungan siapa). Dicatat terbuka; aturan 2 tetap menyediakan jenis tagihan "cicilan". |

Permintaan pemilik atas butir E: contoh Cek Modal dinilai sangat baik;
**mesin harus memberi tahu perubahannya**, dan rinciannya harus lebih jelas,
terutama **harta berupa barang yang bisa dijual** dan sejenisnya. Rinciannya
ditulis di aturan 14 dan 14a–14e dan diajukan di percakapan (butir H–K).

| Butir | Isi | Saran Claude |
|---|---|---|
| H | Nilai stok dihitung dengan **harga beli**, bukan harga jual. | Ya. |
| I | Barang reject dan barang yang lama tidak laku ditampilkan terpisah dari stok yang bisa dijual. | Ya; batas "lama tidak laku" 90 hari, pengaturan. |
| J | Aset milik Ibu (Toko Pusat, parkir, motor, mobil) **tidak dihitung** sebagai harta usaha. | Ya. |
| K | Pemberitahuan: tiap tutup periode, dan segera kalau ada pergeseran tanpa penjelasan di atas batas (isi awal Rp1 juta). | Ya. |

### Jawaban atas butir H–K dan pertanyaan pemilik (12 Oktober 2026)

Butir H, I, J, K: **ok semua**.

Pertanyaan pemilik ("pertanyaan penting"): bisakah ia memasukkan keadaan awal
pada satu tanggal (uang tunai, isi rekening A, B, C, nilai barang tiap cabang,
piutang, utang), lalu mesin menghitung sendiri pada tanggal 1 bulan depan
**atau tanggal yang ia tentukan**, memberi tahu pergeserannya, uangnya ke
mana, dan berapa yang **menguap tanpa catatan**? Jawaban Claude: bisa; itulah
Cek Modal dengan titik awal dan tanggal pilihan (aturan 14f, 14g). Batasnya
disampaikan terus terang (aturan 14h): mesin hanya bisa menemukan yang
menguap kalau ada **angka nyata** untuk dibandingkan (hitung fisik, mutasi
bank, stok opname di kasir), dan mesin menyebut **berapa, di tempat mana, dan
di antara dua hitungan yang mana**, bukan siapa pelakunya.

## 6D1.10 Aturan yang dihasilkan (nomor v3 ditetapkan di 6E)

Semua butir sudah dijawab pemilik kecuali butir F (cicilan), yang dicatat
terbuka; tidak ada aturan yang menunggu.

| No | Aturan | Asal |
|---|---|---|
| 1 | **Tagihan Rutin**: mesin membuat **tagihan** (belum dibayar), bukan catatan uang keluar. Uang tercatat keluar hanya saat benar-benar dibayar (Catatan Cepat atau finance) dan dipasangkan ke tagihannya; bayar sebagian boleh. Tagihan yang belum dibayar tampil dengan umurnya. Biaya cabang dihitung dari tagihannya (bulan yang dicakup), bukan dari tanggal bayar. | AN1 |
| 2 | **Satu mesin** untuk semua tagihan rutin, dengan cara hitung: tetap per bulan, per hari kalender, per hari kendaraan berangkat (dari trip Logistik, dihitung server), dan **nominal menyusul** (listrik, internet, pajak: mesin hanya mengingatkan, nominal diisi saat tagihannya datang). Isi awal jenis: sewa, listrik, internet, pajak, cicilan; ditambah lewat pengaturan. | AN2, AN5, jawaban 6 |
| 3 | **Tarif bertanggal berlaku dan tidak ditimpa** (WAJ-07). Tarif baru adalah baris baru; riwayatnya terlihat. Semua tarif, termasuk tarif kendaraan, punya layar. | AN3 |
| 4 | **Hak:** tarif dan tagihan rutin biasa diisi finance, GM, atau Owner dan diperiksa GM atau Owner lain. **Tarif sewa aset milik Owner** diisi Owner atau GM dan **tidak butuh persetujuan**; pihak yang tidak mengisi diberi tahu, dan riwayatnya terlihat. HR dan kepala cabang tidak melihat. Dijaga server. | AN4, jawaban 2 |
| 5 | **Bulan yang terlewat dikejar**: mesin memeriksa semua bulan sejak tanggal mulai. Kegagalan mesin tampil di daftar "perlu perhatian" GM. | AN6 |
| 6 | **Bayar di muka** (kontrak setahun dan sejenisnya): satu kali uang keluar, dibagi rata oleh mesin ke bulan-bulan yang dicakup. | AN7 |
| 7 | **Daftar Aset** memuat dua jenis: **aset kantor** dan **aset milik Owner yang disewa kantor**. Aset Owner punya tanda **milik sendiri** atau **dikontrak dari luar**; yang dikontrak punya kontrak (pemilik tempat, mulai, berakhir, nilai). Isi awal: Gudang, Raja, Markas, Toko Depan dikontrak dari luar; Toko Pusat, parkir, dua motor, tiga mobil milik Owner. Kendaraan di daftar ini adalah kendaraan yang sama dengan di Logistik (satu data, WAJ-03). | jawaban 1, AN8 |
| 8 | **Dua angka per aset Owner**: yang dibayar kantor (tarif sewa) dan biaya aset itu (kontrak ke luar, service, pajak). Selisihnya tampil per aset per tahun, hanya untuk GM dan Owner. | jawaban 1 dan 2 |
| 9 | **"Logistik" bukan cabang.** Gantinya **Buku Ibu** (nama di layar; satu buku per pemilik usaha), dihitung server. **Bertambah:** hak sewa dari Tagihan Rutin aset Owner; uang pribadi yang dimasukkan ke usaha. **Berkurang:** "Pribadi" (ambil); service, pajak, dan kontrak ke luar untuk aset Owner yang dibayar dengan uang usaha. **Boleh minus**; minus tampil sebagai "sudah dipakai melebihi hak" dan tidak menolak pengambilan. Gaji tetap Owner tetap lewat slip (GAJ-09), di luar buku ini. | jawaban 3 dan 4, butir A, B |
| 10 | **Hak sewa adalah catatan hak, bukan uang pindah.** Mesin tidak pernah menulis uang masuk atau keluar rekening. Rekening penampung, kalau dipakai, adalah tempat uang biasa; memindahkan uang ke sana adalah Pindah Dana yang dicatat saat benar-benar dilakukan. | butir A, catatan AN2 |
| 11 | **Kontrak ke pihak luar dibayar dari tempat uang mana pun**, satu baris Buku Kas, dan otomatis mengurangi Buku Ibu. Tidak dihitung lagi sebagai biaya cabang (biaya cabang adalah sewa bulanannya, aturan 1), sehingga sewa tidak terhitung dua kali. | catatan AN2, temuan 8 |
| 12 | **Pengingat kontrak** 90, 60, dan 30 hari sebelum berakhir di dashboard GM dan Owner, dihitung server, memuat nilai kontrak, hak sewa aset itu sejak kontrak terakhir, dan sisa Buku Ibu. | AN8, butir C |
| 13 | **Aset kantor:** barang seharga Rp1 juta ke atas (batas adalah pengaturan). Barisnya lahir saat pembeliannya dicatat di Buku Kas; biayanya dibagi rata per bulan selama umur pakai (umur bawaan per jenis adalah pengaturan, isi awal diajukan di 6E). Kondisi: dipakai, rusak, dijual, hilang; menjual mencatat uang masuk yang bertaut. | jawaban 5 |
| 14 | **Cek Modal** tiap tutup periode laporan (periodenya ditetapkan di 6D2), dihitung server di satu tempat. Menghitung **harta bersih** = harta (14a) − kewajiban (14b), membandingkannya dengan periode sebelumnya, dan menjelaskan perubahannya (14c, 14d). Sifatnya laporan dan tanda; tidak mengunci apa pun. Hanya untuk GM dan Owner. | catatan AN10, butir E |
| 14a | **Harta dikelompokkan menurut seberapa cepat bisa menjadi uang**, tiap kelompok dirinci per cabang: (1) **Uang**: Brankas, Kas Pegangan, tiap Laci, tiap rekening bank (saldo Buku Kas). (2) **Barang dagangan yang bisa dijual**: nilai stok dari sistem kasir, dihitung dengan **harga beli**. Ditampilkan terpisah dan tidak dijumlahkan sebagai "bisa dijual": **barang lama tidak laku** (tidak terjual lebih dari 90 hari; batasnya pengaturan; tetap harta, diberi tanda) dan **barang reject** (bukan harta; tercatat sebagai kerugian, 6C.10 aturan 9). (3) **Uang yang masih di orang lain**: piutang toko (dari kasir) dengan umurnya, yang lewat jatuh tempo ditandai; Piutang Lain; sisa kasbon karyawan; bayar di muka yang belum terpakai (aturan 6). (4) **Aset kantor**: sisa nilainya (aturan 13); ditandai "dipakai, bukan untuk dijual". **Aset milik Owner tidak dihitung** sebagai harta usaha. | permintaan pemilik, butir H, I, J |
| 14b | **Kewajiban**: utang supplier (6C.10 aturan 4); titipan dan deposit toko luar; tagihan rutin belum dibayar (aturan 1); slip yang sudah ditutup tetapi belum dibayar; uang karyawan yang dipegang kantor (tabungan loyalitas) dan saldo Dana Disiplin; Buku Ibu kalau positif (hak Owner yang belum diambil). Buku Ibu yang minus tampil di sisi harta sebagai "dipakai Owner melebihi hak". Utang dan deposit antara toko dan Gudang saling menghapus di angka gabungan (6C.10 aturan 14). | butir E |
| 14c | **Tiap baris dijelaskan mesin dengan "jembatan"**: angka awal, apa saja yang menambah dan mengurangi menurut catatan, angka yang **seharusnya**, angka **nyata**, dan selisihnya. Uang: awal + masuk − keluar, dibanding Hitung Kas dan mutasi. Barang dagangan: awal + belanja (nota supplier) − harga pokok barang terjual − reject − retur ke supplier, dibanding nilai stok nyata dari kasir; selisihnya "barang berkurang tanpa catatan". Piutang toko: awal + jual tempo − pelunasan. Utang supplier: awal + nota − bayar − retur − potongan. | permintaan pemilik |
| 14d | **Perubahan harta bersih yang wajar** = laba periode itu − pengurangan Buku Ibu + uang pribadi yang masuk. Selisihnya dengan perubahan nyata tampil sebagai **"modal bergeser tanpa penjelasan"**, dirinci per baris 14c dan per cabang, dengan kalimat biasa (misalnya "stok Toko Pusat turun Rp12 juta lebih banyak daripada barang yang terjual"). Unsur yang datanya belum masuk dari kasir ditandai **"belum lengkap"** dan tidak dihitung sebagai pergeseran. | permintaan pemilik |
| 14e | **Mesin memberi tahu** GM dan Owner lewat aplikasi (PRI-25): (a) tiap tutup periode: harta bersih naik atau turun berapa, dan berapa hal yang tanpa penjelasan; (b) **segera**, tanpa menunggu tutup periode, kalau unsur yang dihitung harian (uang) bergeser tanpa penjelasan di atas batas. Batasnya pengaturan, isi awal Rp1 juta. Tiap pemberitahuan bisa dibuka sampai ke baris asalnya. | permintaan pemilik, butir K |
| 14f | **Titik awal.** Cek Modal dimulai dari satu keadaan awal bertanggal (hari mulai, 6A.10 aturan 21): uang tiap tempat dari hitung fisik dan mutasi; nilai stok tiap cabang, piutang toko, dan utang supplier dari sistem kasir dan tagihan supplier (6C.10 aturan 11). Selama sambungan kasir belum menyala, angka stok, piutang, dan utang **boleh diketik** GM atau Owner dan bertanda "diketik". Titik awal tidak diubah setelah ada transaksi; koreksinya lewat baris penyesuaian beralasan (6A.10 aturan 16). | pertanyaan pemilik |
| 14g | **Cek di tanggal pilihan.** Selain tiap tutup periode, GM atau Owner boleh menjalankan Cek Modal **kapan saja** dengan memilih tanggal awal dan tanggal akhir. Hasilnya memuat: harta bersih di kedua tanggal, **uang ke mana** (dikelompokkan: supplier, gaji dan upah, sewa dan tagihan, operasional, diambil Owner, lain-lain), perubahan tiap baris harta dan kewajiban, dan jumlah **tanpa catatan**. Tiap hasil cek **disimpan** beserta tanggal dan pembuatnya, supaya bisa dibandingkan dan tidak berubah diam-diam. | pertanyaan pemilik |
| 14h | **Batas kemampuan ditulis di layar.** "Tanpa catatan" hanya bisa dihitung untuk baris yang punya **angka nyata** pada tanggal itu: uang (Hitung Kas dan mutasi bank), barang (nilai stok dari kasir, yang baru benar-benar nyata setelah stok opname), piutang dan utang (kasir). Baris tanpa angka nyata ditandai "belum dihitung nyata sejak tanggal …" dan tidak dinyatakan aman. Mesin menyebut **berapa, di tempat uang atau cabang mana, dan di antara dua hitungan yang mana**; mesin tidak menebak pelaku atau sebabnya. Menjalankan cek di tanggal pilihan menawarkan Hitung Kas saat itu juga. | pertanyaan pemilik |
| 15 | **Nilai stok tidak diketik**; ditarik dari sistem kasir per cabang tiap akhir periode. "Modal cash" yang diketik tidak ada; gantinya saldo awal dari hitung fisik (6A.10 aturan 21). | AN10, AN11 |
| 16 | **Tidak ada hapus** untuk aset, kontrak, tarif, tagihan, dan baris Buku Ibu: dinonaktifkan atau dibatalkan dengan alasan; jejaknya bisa dibuka di layar. | AN12 |
| 17 | **Saldo awal Buku Ibu nol** pada hari mulai; sisa catatan "Logistik" lama tidak dibawa. | butir D |
| 18 | **Setiap angka yang menentukan uang punya layar pengaturan**, tanggal berlaku, jejak, dan pemeriksa; tidak ada yang diisi langsung ke database (**PRI-32**, ditulis 12 Oktober 2026). | butir G |

### Temuan dan aturan yang mengatasinya

| Temuan | Aturan |
|---|---|
| Aset, kontrak, modal bulanan kosong | 7, 13, 15 |
| Modal awal diketik sekali, tidak diperbarui, disetujui pengisinya | 14, 15 |
| Modal dan aset bisa dihapus Owner; yang disetujui bisa diubah | 16 |
| Tidak ada catatan uang Owner masuk dan keluar; uang pribadi dan usaha bercampur | 9 |
| Mesin menulis uang keluar dan masuk yang langsung disetujui | 1, 10 |
| Sewa dicatat pindah padahal uangnya belum dipisahkan; kontrak jatuh tempo dibayar dari uang Gudang | 10, 11, 12 |
| Sewa Raja terhitung dua kali | 11 |
| Dua mesin, jadwal berbeda, layar berkata tanggal 1 | 2 |
| Tarif kendaraan tanpa layar, tanpa tanggal, tanpa jejak, terbaca semua orang | 3, 4, 18 |
| Nominal biaya tetap bisa ditimpa; item tidak diperiksa | 3, 4 |
| Bulan terlewat tidak dikejar | 5 |
| Bayar setahun jadi biaya satu bulan | 6, 11 |
| Sewa tercatat di tiga tempat | 2, 7 |
| "Logistik" sebagai cabang; pemasukan semu | 9, 10 |
| Dua angka per aset tidak terlihat | 8 |
| Pengingat kontrak hanya di satu halaman, dari jam perangkat | 12 |
| Beli barang besar jadi biaya penuh | 13 |
| Kepala cabang dan HR melihat modal | 4 |

### Titipan dari 6D1

- Untuk modul Tarik Data Kasir: nilai stok per cabang dengan harga beli,
  barang yang tidak terjual lebih dari 90 hari, nilai barang reject, piutang
  toko beserta umurnya; semuanya **per tanggal** (untuk cek di tanggal
  pilihan), dan tanggal stok opname terakhir tiap cabang.
- Terbuka: cicilan apa dan tanggungan siapa (butir F).
- Untuk 6D2: tampilan Cek Modal (aturan 14, 14a–14h), kelompok "uang ke
  mana", dan periode laporan; Buku Ibu dan selisih per aset
  di laporan; tagihan rutin belum dibayar dan kontrak jatuh tempo di
  perkiraan kas; biaya cabang dari tagihan (aturan 1) di laba per cabang.
- Untuk 6E: kamus (Tagihan Rutin, Buku Ibu, hak sewa, aset Owner, Cek
  Modal, harta bersih); isi awal umur pakai aset; kotak "Uang Masuk" di
  Catatan Cepat mendapat pilihan "dari uang pribadi" (melapisi 6A.10 aturan
  31).
- Untuk keputusan data lama: cabang "Logistik" dan baris sewa otomatisnya
  tidak dipindahkan; sewa Raja yang terhitung dua kali.

---

# Bagian 6D2: Arus kas, laporan keuangan, dan dashboard

Ukuran: **sedang**. Lebih banyak merancang daripada menggali, karena hampir
semua bahan laporan sudah diputuskan di 6A, 6B, 6C, dan 6D1.

Sumber: `hris-app/app/(dashboard)/keuangan/cashflow/page.tsx` (325 baris),
`dashboard/page.tsx` (327), `laporan/page.tsx` (850),
`laporan/detail/page.tsx` (1.073); fungsi `get_account_cashflow_summary`,
`get_unlinked_cashflow_summary`, `get_pending_cashflow_summary`; tabel
`fin_branch_report_groups`; kebijakan baca `fin_cash_in`, `fin_cash_out`,
`fin_hpp_entries`.

Yang sudah diputuskan di bab lain dan tidak ditanyakan lagi:

- Yang melihat laporan keuangan **hanya GM dan Owner**. Urutan kepentingan:
  (a) uang ada berapa dan di mana, (b) cukup atau tidak 2–4 minggu ke depan,
  (d) uang habis ke mana, (c) cabang untung atau rugi. Rentang: harian,
  mingguan, bulanan, 3 bulan, 6 bulan, 1 tahun (6A.9 butir P).
- Saldo tiap tempat uang dihitung server di satu tempat (6A.10 aturan 16);
  saldo awal dari hitung fisik (21); Hitung Kas (22, 30); Pindah Dana tidak
  memengaruhi laba (4); pos "Belum dipilah" (27); mesin pos menentukan
  kategori dan jenis arus kas (23).
- Omzet dan harga pokok dari sistem kasir; laba dari sumber yang sama; bulan
  yang datanya belum masuk bertanda "belum lengkap" (6C.10 aturan 13). Laba
  gabungan tidak menghitung dua kali penjualan Gudang ke cabang sendiri (14).
  Pos rebate (10); kerugian barang reject (9).
- Biaya cabang dihitung dari Tagihan Rutin, bukan tanggal bayar (6D1.10
  aturan 1); bayar di muka dan aset kantor dibagi rata per bulan (6, 13);
  Buku Ibu (9); Cek Modal (14, 14a–14h).
- Dana Disiplin dan Dana Tidak Hadir tampil sebagai pos di keuangan (GAJ
  bagian 7).

## 6D2.1 Bagian ini mengurus apa

Semua layar yang **hanya menampilkan**: uang ada berapa, uang masuk dan
keluar, untung atau rugi, dan ringkasan di halaman depan Keuangan. Tidak ada
data baru yang diketik di sini.

## 6D2.2 Data di sistem lama (dicek ke database, 12 Oktober 2026)

Empat halaman, semuanya per **bulan kalender**:

| Halaman | Isinya |
|---|---|
| Cash Flow per Rekening/Kas | Saldo tiap rekening: saldo awal + masuk − keluar yang disetujui; "Saldo Proyeksi" kalau yang menunggu ikut disetujui |
| Dashboard Keuangan | Kas Masuk, HPP, Laba Kotor, Biaya Operasional, Realisasi Kasbon, Laba Bersih; per kelompok cabang dan gabungan; dibanding bulan lalu |
| Laporan Resmi | Angka yang sama ditambah "Data Sistem Kasir", "Kas Real", "Nota & Utang Supplier", "Laba Campuran", "Cek Kecukupan Kas", pengeluaran per kategori per cabang; cetak; unduh omzet per cabang (CSV) |
| Detail Laporan per Cabang | Rincian baris pemasukan dan pengeluaran, penggajian, kehilangan, utang supplier, "Total Aset Barang", ritase per kendaraan |

Angka per bulan (yang disetujui, juta rupiah):

| Bulan | Kas Masuk | HPP diketik | Omzet kasir diketik | "Laba Kotor" (Kas Masuk − HPP) | Laba kotor versi kasir | Biaya operasional | Semua Kas Keluar |
|---|---|---|---|---|---|---|---|
| Mei | 2.634,5 | 2.489,9 | kosong | 144,6 | tidak ada | 71,2 | 1.789,4 |
| Juni | 2.981,1 | 2.828,1 | kosong | 153,1 | tidak ada | 87,1 | 2.180,4 |
| Juli | 600,9 | **kosong** | kosong | **600,9** | tidak ada | 114,3 | 2.267,3 |
| Agustus | 1.917,3 | 2.641,3 | 2.801,9 | **−724,0** | 160,5 | 120,0 | 2.570,6 |
| September | 2.339,3 | 2.636,3 | 2.786,9 | **−297,0** | 150,7 | 106,2 | 1.860,2 |
| Oktober (berjalan) | 754,3 | kosong | kosong | 754,3 | tidak ada | 19,9 | 24,4 |

Yang terbaca dari tabel itu:

- **Laba bulanan versi layar utama tidak bisa dipercaya**: Juli tampil untung
  Rp600 juta (HPP belum diketik), Agustus rugi Rp724 juta, September rugi
  Rp297 juta. Versi kasir untuk Agustus dan September: laba kotor Rp160,5 juta
  dan Rp150,7 juta, laba setelah biaya kira-kira Rp40 juta dan Rp44 juta
  (belum dikurangi kasbon).
- Juli: Kas Masuk hanya Rp600,9 juta, sedangkan Kas Keluar Rp2,27 miliar.
  Kas Masuk bulan itu jelas tidak lengkap, dan tidak ada tanda apa pun.
- Oktober: 36 Kas Masuk dan 52 Kas Keluar masih menunggu diperiksa.

Lain-lain:

- 12 tempat uang: 11 rekening bank dan **1 "Kas Tunai"**; semua bersaldo
  awal 1 September 2026; 2 rekening "digabung" ke rekening lain.
- Kelompok laporan: Toko Pusat, Toko Depan, Raja, Markas, dan **"Gudang &
  Back Office"** (dua cabang dijadikan satu). Cabang **"Logistik" tidak
  masuk kelompok mana pun**: Rp96,2 juta masuk dan Rp40,2 juta keluar (service
  mobil, sewa ke luar, Prive) **tidak tampil di laporan mana pun**.
- 31 kategori pengeluaran; 6 ditandai "tidak dihitung ke laba": Pembayaran
  Supplier (Rp10,15 miliar), Pencairan Kasbon, Pembayaran Gaji Driver (Kas),
  Pembayaran Gaji Kenek (Kas), Prive, Restock.
- Kategori "Sewa" Rp205,8 juta masuk biaya operasional; sebagian besar adalah
  sewa ke "Logistik" yang ditulis mesin (6D1).

## 6D2.3 Aturan yang ditemukan

### Posisi kas (Cash Flow per Rekening)

| No | Aturan | Sumber |
|---|---|---|
| KEU-E01 | Saldo rekening = saldo awal + Kas Masuk bersih − Kas Keluar, hanya baris **disetujui**, sejak tanggal saldo awal sampai akhir bulan yang dipilih. Dihitung di database (satu fungsi). | `get_account_cashflow_summary` |
| KEU-E02 | Kas Masuk bersih = omzet − pengeluaran dari omzet + selisih kasir. Rumus ini ditulis lagi di Dashboard, Laporan, dan Detail. | fungsi dan tiga halaman |
| KEU-E03 | "Saldo Proyeksi" = saldo + semua yang masih menunggu diperiksa. Artinya "kalau semua disetujui", **bukan perkiraan ke depan**. | `cashflow/page.tsx` |
| KEU-E04 | Baris tanpa rekening tidak masuk saldo mana pun; hanya ada peringatan untuk bulan yang dipilih. 647 pengeluaran tanpa rekening (6A) tidak pernah mengurangi saldo. | `get_unlinked_cashflow_summary` |
| KEU-E05 | Rekening bisa "digabung saldo ke" rekening lain (misalnya QRIS ke bank); jumlahnya ditampilkan sebagai satu kantong. | `settlement_account_id` |
| KEU-E06 | Tidak ada saldo per hari, tidak ada riwayat saldo, tidak ada pembanding dengan hitung fisik atau mutasi bank. | tidak ada |
| KEU-E07 | Halaman dibuka owner, hr, finance. | `ADMIN_ROLES` |

### Laba (Dashboard, Laporan Resmi, Detail)

| No | Aturan | Sumber |
|---|---|---|
| KEU-E08 | **Laba Kotor = Kas Masuk − HPP**; **Laba Bersih = Laba Kotor − Biaya Operasional − Realisasi Kasbon**. Uang yang diterima dipakai sebagai "penjualan". | tiga halaman |
| KEU-E09 | Hitungan kedua, "versi Sistem": omzet kasir − HPP − biaya operasional − kasbon. Hanya tampil kalau omzet kasir bulan itu diketik. Layar sendiri menulis versi ini "lebih dipercaya". | `laporan/page.tsx` |
| KEU-E10 | Biaya operasional = semua Kas Keluar disetujui kecuali kategori bertanda "tidak dihitung ke laba". Tanda itu satu-satunya pemisah biaya dan bukan biaya. | `affects_net_profit` |
| KEU-E11 | "Realisasi Kasbon": potongan kasbon di slip yang dibayar bulan itu ditambahkan sebagai biaya, supaya gaji terhitung penuh (uang kasbonnya sendiri tidak dihitung biaya saat cair). | tiga halaman |
| KEU-E12 | Di Detail, laba bulan lalu untuk pembanding **tidak** dikurangi kasbon, sedangkan laba bulan ini dikurangi. | `prevLabaBersihSistem` |
| KEU-E13 | Semua laba dihitung **di layar**: baris ditarik ke browser lalu dijumlah. Rumusnya ditulis di tiga halaman. Tarikan dibatasi 1.000 baris; bulan terbanyak sekarang 381, jadi belum terpotong, tetapi tidak ada penjaganya. | tiga halaman |
| KEU-E14 | Biaya dihitung pada **tanggal uang keluar**: sewa setahun jadi biaya satu bulan; gaji periode 26–25 jatuh ke bulan pembayarannya. | tanggal transaksi |
| KEU-E15 | Cabang dijumlah per "kelompok laporan"; Gudang dan Back Office satu kelompok. Cabang tanpa kelompok dilewati diam-diam. | `fin_branch_report_groups` |
| KEU-E16 | Gabungan = jumlah semua kelompok. Penjualan Gudang ke toko sendiri tidak dihapus. | `reduce` |
| KEU-E17 | Bulan tanpa HPP tetap dihitung, sehingga seluruh Kas Masuk tampil sebagai laba. | data Juli dan Oktober |
| KEU-E18 | Pembanding hanya bulan lalu. Tidak ada mingguan, 3 bulan, 6 bulan, atau setahun. | tiga halaman |

### Hitungan kas di dalam laporan laba

| No | Aturan | Sumber |
|---|---|---|
| KEU-E19 | "Kas Sesungguhnya (Real)" = Kas Masuk − semua Kas Keluar bulan itu, per cabang. Layar menyebutnya "paling dekat dengan uang di tangan cabang", padahal bukan saldo dan cabang tidak punya kas sendiri. | `laporan/page.tsx` |
| KEU-E20 | "Cek Kecukupan Kas" = Kas Masuk − pembayaran supplier − biaya operasional. Pencairan kasbon, Prive, dan pembayaran gaji driver tidak ikut. | `selisihKecukupanKas` |
| KEU-E21 | "Saldo Akhir Seharusnya" = saldo awal + angka KEU-E20; hanya tampil kalau ada rekening bersaldo awal **tepat tanggal 1** bulan itu (jadi hanya September). | `saldoAwalReal` |
| KEU-E22 | "Sisa Utang Bulan Ini" = nota bulan itu − pembayaran bulan itu; "Sisa Utang Supplier" dihitung lagi di Detail dengan rumus lain. | 6C |

### Hak dan keluaran

| No | Aturan | Sumber |
|---|---|---|
| KEU-E23 | Dashboard dan Laporan Resmi **bisa dibuka kepala cabang** (untuk cabangnya); owner, hr, finance melihat semuanya. Detail hanya owner, hr, finance. | kebijakan baca, tidak ada penjaga halaman |
| KEU-E24 | Cetak memakai cetak browser; unduhan hanya satu: omzet per cabang per bulan (CSV), disebut untuk pajak, dan memakai **Kas Masuk** sebagai omzet. | `handleExportOmzetPerCabang` |
| KEU-E25 | Tidak ada tutup bulan: laporan bulan lama berubah kalau ada baris yang baru disetujui, diubah, dihapus, atau tanda kategori diganti. | tidak ada |
| KEU-E26 | Di kode tertulis ID cabang Gudang, awalan nama rute "Belanja", dan daftar kategori gaji. | `laporan/detail/page.tsx` |
| KEU-E27 | Tidak ada perkiraan kas ke depan, tidak ada daftar harta dan utang (neraca), tidak ada arus kas menurut jenis. | tidak ada |

## 6D2.4 Menu di sistem lama

| Menu | Dipakai untuk apa | Mirip dengan menu lain? |
|---|---|---|
| Dashboard Keuangan | Laba bulan ini sekilas | Ya: isinya bagian atas Laporan Resmi |
| Laporan Resmi | Laba per kelompok, cetak, CSV | Ya |
| Detail Laporan per Cabang | Rincian baris | Mengulang Riwayat Kas, Utang Supplier, Kehilangan, dan ritase Logistik |
| Cash Flow per Rekening/Kas | Saldo | Hitungan kas lain ada di Laporan Resmi |

## 6D2.5 Tumpang tindih

1. **Dua hitungan laba** (Kas Masuk − HPP, dan omzet kasir − HPP) berdampingan
   dengan hasil yang berlawanan (rugi Rp724 juta dan untung Rp160 juta untuk
   bulan yang sama).
2. Rumus laba ditulis di tiga halaman, semuanya di layar.
3. **Empat angka "kas"** yang berbeda arti: Saldo Real, Saldo Proyeksi, Kas
   Sesungguhnya, Saldo Akhir Seharusnya.
4. Utang supplier dihitung di Laporan Resmi, Detail, dan halaman Pembelian.
5. Dashboard dan Laporan Resmi menampilkan angka yang sama.
6. Ritase per kendaraan tampil di laporan keuangan dan di Logistik.
7. "Kelompok laporan" adalah daftar cabang kedua di samping daftar cabang.

## 6D2.6 Kejadian di lapangan dan jalan keluarnya

| Kejadian | Di sistem lama | Ada jalan keluar? |
|---|---|---|
| HPP bulan itu belum diketik | Semua uang masuk tampil sebagai laba | Tidak ada tanda |
| Kas Masuk sebulan belum lengkap (Juli) | Laporan tampil seperti biasa | Tidak ada tanda |
| Baris bulan lalu baru disetujui hari ini | Laporan bulan lalu berubah | Tidak ada jejak |
| Ingin tahu saldo pada satu tanggal | Hanya akhir bulan | Tidak |
| Saldo di layar beda dengan uang nyata | Tidak ada tempat membandingkan | Tidak |
| Ingin tahu cukup atau tidak untuk gajian | Tidak ada | Tidak |
| Pengeluaran tanpa rekening | Tidak mengurangi saldo; peringatan hanya di bulan itu | Diisi tangan satu per satu |
| Cabang baru belum diberi kelompok | Hilang dari laporan tanpa pesan | Tidak |
| Sewa dibayar setahun | Laba bulan itu anjlok | Tidak |
| Laporan untuk pajak atau bank | CSV omzet dari Kas Masuk | Sebagian |

## 6D2.7 Pertanyaan untuk pemilik (diajukan di percakapan, 12 Oktober 2026)

Butuh pandangan:

1. **Bulan laporan**: tanggal 1 sampai akhir bulan, atau 26–25 seperti gaji?
2. **Batas aman kas**: berapa uang paling sedikit yang membuat tenang, atau
   dihitung mesin?
3. **Biaya kantor** (gaji GM, finance, Marketing, Back Office): dibagi ke
   cabang, atau kolom "Kantor" sendiri? Gudang dan Back Office dipisah?
4. **Laporan untuk pihak luar** (pajak, bank, akuntan): ada atau tidak, dan
   bentuknya apa?

Cukup ok atau tidak: usulan AO1–AO18 di 6D2.8.

## 6D2.8 Usulan untuk v3 (belum disetujui)

| No | Usulan |
|---|---|
| AO1 | **Satu halaman depan "Keuangan Hari Ini"** untuk GM dan Owner, empat kotak menurut urutan kepentingan pemilik: (1) Uang kita sekarang, (2) Cukup tidak 4 minggu ke depan, (3) Uang habis ke mana, (4) Untung rugi cabang; ditambah daftar "Perlu perhatian". Tiap kotak bisa dibuka sampai baris asalnya. Menggantikan Dashboard, Laporan Resmi, Detail, dan Cash Flow lama. |
| AO2 | **Posisi Kas**: saldo tiap tempat uang (Brankas, Kas Pegangan, tiap Laci, tiap rekening) pada **tanggal mana pun**, dengan "terakhir dihitung nyata kapan" dan selisihnya. Saldo menghitung **semua baris yang tercatat dan tidak dibatalkan**, karena uangnya sudah bergerak; yang belum diperiksa dan yang belum dipilah ditampilkan jumlahnya di samping. Tidak ada "Saldo Proyeksi". |
| AO3 | **Uang titipan dipisah.** Di Posisi Kas: total uang − uang yang bukan milik usaha (deposit dan titipan toko, tabungan loyalitas karyawan, Dana Disiplin, hak Ibu yang belum diambil) = **"uang yang bebas dipakai"**. |
| AO4 | **Perkiraan Kas 4 minggu**, per minggu. Mulai dari saldo hari ini. Masuk: rata-rata uang masuk 4 minggu terakhir per hari, dan piutang toko yang jatuh tempo (kasir). Keluar: slip bulanan (tanggal 1), slip mingguan (Sabtu), Tagihan Rutin, kontrak yang jatuh tempo, dan supplier (menurut tempo bawaan kalau diisi; kalau tidak, rata-rata bayar supplier 4 minggu terakhir). Minggu yang saldonya di bawah batas aman ditandai. Selalu bertulisan "perkiraan"; perkiraan minggu lalu dibandingkan dengan kenyataannya. |
| AO5 | **Uang Habis ke Mana**: kelompok tetap yang sama dengan Cek Modal (supplier, gaji dan upah, sewa dan tagihan, operasional, diambil Owner, lain-lain, belum dipilah), per cabang, dibanding periode sebelumnya, bisa dibuka sampai baris. |
| AO6 | **Satu hitungan laba, di server**: omzet (kasir) − harga pokok (kasir) = laba kotor; dikurangi biaya cabang (gaji menurut periode slip, Tagihan Rutin menurut bulan yang dicakup, operasional menurut tanggal, bagian bulanan aset dan bayar di muka, barang reject, kekurangan yang ditanggung kantor); ditambah rebate dan kelebihan kas. "Laba Kotor = Kas Masuk − HPP" dibuang. Uang yang diterima tampil terpisah, bukan sebagai penjualan. |
| AO7 | **Bukan biaya, jadi tidak mengurangi laba**: Pindah Dana, pembayaran supplier (sudah terhitung di harga pokok), uang kasbon yang diserahkan dan cicilannya, "Pribadi"/diambil Owner, setoran antar tempat uang. Jenisnya ditentukan daftar kejadian (6A.10 aturan 23), bukan centang per kategori. "Realisasi Kasbon" tidak diperlukan lagi karena gaji dihitung dari slip, bukan dari uang yang keluar. |
| AO8 | **Data belum lengkap ditandai, tidak dihitung diam-diam**: periode yang omzet atau harga pokoknya belum masuk dari kasir, atau masih ada "belum dipilah" dan "belum diperiksa", tampil bertanda dengan jumlahnya. Laba periode itu tidak ditampilkan sebagai angka pasti. |
| AO9 | **Rentang waktu**: hari ini, 7 hari, periode ini, 3, 6, dan 12 periode, serta tanggal pilihan. Pembanding: periode sebelumnya dan periode yang sama tahun lalu. |
| AO10 | **Tutup periode** oleh GM atau Owner. Sebelum menutup, sistem menampilkan daftar yang belum beres (belum dipilah, belum diperiksa, data kasir belum lengkap, Hitung Kas terlewat). Boleh tetap ditutup; kalau begitu bertanda "ditutup dengan catatan". Angka periode tertutup **tidak berubah lagi**; koreksi sesudahnya masuk periode berjalan sebagai baris koreksi yang menunjuk periode asalnya (sejalan GAJ-50). Cek Modal jalan saat tutup periode. |
| AO11 | **Tiga laporan dengan nama sehari-hari**: "Uang" (arus kas), "Untung Rugi" (laba rugi), "Harta dan Utang" (neraca; isinya sama dengan Cek Modal, tidak dibuat dua kali). Versi beristilah akuntansi (arus kas operasional, investasi, pendanaan) hanya ada sebagai unduhan. |
| AO12 | **Hak**: semua laporan hanya GM dan Owner. Finance hanya melihat **daftar kerjanya** (belum dilengkapi, belum dipasangkan, menunggu diterima) dan saldo tempat uang yang ia pegang atau cocokkan; tidak melihat laba. HR dan kepala cabang tidak melihat apa pun. Dijaga server dan dicoba mesin pengaman. |
| AO13 | **Semua angka laporan dihitung server di satu tempat**; layar hanya menampilkan (WAJ-04). Tidak ada penjumlahan di browser. Tiap angka bisa dibuka sampai baris asalnya. |
| AO14 | **Cabang tidak punya "kelompok laporan" terpisah.** Laporan memakai daftar cabang yang sama (WAJ-03). Baris tanpa cabang ditolak saat dicatat (6A.10 aturan 1), jadi tidak ada yang hilang dari laporan. |
| AO15 | **Dana Disiplin** tampil di Posisi Kas sebagai uang titipan dan di "Harta dan Utang" sebagai kewajiban, dengan saldo, masuk, dan keluarnya. **Dana Tidak Hadir** tampil di Untung Rugi cabang sebagai catatan pembanding (potongan tidak hadir dibanding lembur dan kompensasi pengganti); tidak mengubah laba. |
| AO16 | **Buku Ibu dan selisih per aset** punya kotak sendiri di halaman depan GM dan Owner. "Diambil Owner" tampil di Uang Habis ke Mana, tidak di Untung Rugi. |
| AO17 | **Unduh dan cetak dibuat server** (Excel dan PDF) untuk tiap laporan, memuat tanggal dibuat dan pembuatnya. Unduhan omzet per cabang per **bulan kalender** dibawa, dengan omzet dari kasir. |
| AO18 | **Ringkasan pagi** untuk GM dan Owner lewat aplikasi (PRI-25): uang kemarin masuk dan keluar berapa, saldo sekarang, dan hal yang perlu perhatian. Bisa dimatikan tiap orang. |

## 6D2.9 Jawaban pemilik (12 Oktober 2026)

| No | Jawaban |
|---|---|
| 1 | Gaji tetap dibayar tanggal 1; 26–25 **hanya cutoff** supaya mudah. Sistem kasir menghitung semuanya **tanggal 1 sampai akhir bulan**. Pemilik menyerahkan pilihannya ("gimana baiknya saja"). **Diputuskan: bulan laporan keuangan = bulan kalender**, mengikuti kasir, karena omzet dan harga pokok (angka terbesar) datang dari sana. Saran awal Claude (26–25) ditarik. Gaji periode 26–25 dibebankan ke bulan kalender tempat periode itu **berakhir** (slip 26 September–25 Oktober = biaya Oktober, dibayar 1 November). Laporan Logistik dan gaji tetap 26–25 (LOG, GAJ tidak berubah). |
| 2 | Pemilik meminta Claude yang menilai berapa kas yang harus selalu ada. Penilaian dari catatan lama: biaya wajib sebulan (gaji, upah, sewa, tagihan, operasional) kira-kira **Rp110–120 juta**; bayar supplier rata-rata **Rp2,03 miliar per bulan**, kira-kira **Rp470 juta per minggu**. Usulan dua tingkat ada di butir D. |
| 3 | "Back Office" **hanya sebutan**: tempatnya di lantai dua Toko Pusat, dan pekerjaannya lebih banyak membantu Gudang; karena itu pemilik menyebutnya "Gudang dan Back Office". Usulan Claude memisahkannya ditarik (butir A). |
| 4 | Laporan untuk pihak luar **belum ada**; kelak pasti butuh untuk akuntan, bank, dan pajak. |
| AO1–AO18 | **Ok semua.** |

Permintaan baru pemilik:

- Bertanya apakah berarti perlu **perencanaan pengeluaran** (forecasting).
- Meminta mesin menghitung **kemampuan belanja**: bisakah belanja tunai, dan
  kalau bisa berapa paling banyak, supaya jelas.

### Butir penutup (diajukan di percakapan, 12 Oktober 2026)

| Butir | Isi | Saran Claude |
|---|---|---|
| A | Back Office di laporan. | Tetap **digabung ke Gudang** seperti kebiasaan pemilik; tidak ada kolom "Kantor" tersendiri. Biaya orang kantor (GM, finance, Marketing, HR) menjadi biaya Gudang; laba toko tidak dibebani biaya kantor. |
| B | Rencana pengeluaran. | Perkiraan Kas (AO4) dibuat mesin; pemilik **tidak wajib** membuat rencana. Tambahan satu hal saja: **Rencana Pengeluaran Besar** (misalnya renovasi, beli kendaraan), diisi GM atau Owner dengan perkiraan nominal dan tanggal, lalu ikut tampil di Perkiraan Kas. Anggaran per pos tidak dibuat; gantinya mesin memberi tanda kalau satu kelompok pengeluaran naik lebih dari 20% dibanding rata-rata 3 bulan. |
| C | **Kemampuan Belanja.** | Mesin menghitung "paling banyak bisa belanja tunai hari ini" = jumlah terbesar yang kalau dikeluarkan hari ini, saldo perkiraan di tiap minggu selama 4 minggu ke depan tetap di atas batas aman. Ditambah **simulasi**: ketik rencana belanja, mesin menjawab aman atau tidak dan di minggu ke berapa uang paling tipis. |
| D | **Batas aman kas dua tingkat**, dihitung ulang mesin tiap bulan dari 3 bulan terakhir, boleh diganti GM atau Owner. | **Merah**: di bawah biaya wajib satu bulan (isi awal kira-kira Rp120 juta). **Kuning**: di bawah biaya wajib satu bulan + bayar supplier satu minggu (isi awal kira-kira Rp600 juta). |

### Jawaban atas butir penutup A–D (12 Oktober 2026)

Butir A, B, C, D: **ok** (satu jawaban "ok").

Perintah pemilik untuk aturan dasar: setiap hal apa pun harus punya tempat
pengaturannya, dan mesin-mesin harus selalu dijaga supaya aman. Hasil
pemeriksaan: sebagian sudah ada (PRI-32 untuk angka uang, WAJ-05, mesin
pengaman hak akses dan error di WAJ-06). Yang belum ada ditambahkan: **PRI-32
diperluas** ke setiap hal yang dibaca mesin, dan **PRI-33** (setiap mesin
otomatis punya penjaga, dengan layar Kesehatan Mesin).

Keterangan pemilik: Owner punya kebiasaan **menguras semua saldo untuk
membayar supplier**, dengan anggapan besok ada uang lagi. Diajukan butir E.

| Butir | Isi | Saran Claude |
|---|---|---|
| E | Penjaga kebiasaan menguras saldo. | Sistem **tidak menolak** (yang memutuskan membayar tetap Owner, 6C.10 aturan 7), tetapi **memperlihatkan akibatnya sebelum uang keluar**, memberi tahu GM, dan mencatatnya (aturan 9 di 6D2.10). |

## 6D2.10 Aturan yang dihasilkan (nomor v3 ditetapkan di 6E)

Semua butir sudah dijawab pemilik, termasuk butir E ("ok", keempat bagiannya);
tidak ada aturan yang menunggu.

| No | Aturan | Asal |
|---|---|---|
| 1 | **Halaman depan "Keuangan Hari Ini"** untuk GM dan Owner, empat kotak berurutan: Uang kita sekarang; Cukup tidak 4 minggu ke depan; Uang habis ke mana; Untung rugi cabang. Ditambah kotak Buku Ibu dan selisih per aset, Kemampuan Belanja, dan daftar "perlu perhatian". Tiap kotak bisa dibuka sampai baris asalnya. Tidak ada Dashboard, Laporan Resmi, Detail, dan Cash Flow yang terpisah-pisah. | AO1, AO16 |
| 2 | **Posisi Kas**: saldo tiap tempat uang pada tanggal mana pun, dengan "terakhir dihitung nyata kapan" dan selisihnya. Saldo menghitung semua baris yang tercatat dan tidak dibatalkan; jumlah yang belum diperiksa dan yang belum dipilah tampil di samping. Tidak ada "Saldo Proyeksi". | AO2 |
| 3 | **Uang yang bebas dipakai** = total uang − uang titipan (deposit dan titipan toko, tabungan loyalitas, Dana Disiplin, hak Ibu yang belum diambil). Dana Disiplin tampil dengan saldo, masuk, dan keluarnya. | AO3, AO15 |
| 4 | **Perkiraan Kas 4 minggu**, per minggu, dihitung mesin; pemilik tidak wajib membuat rencana. Masuk: rata-rata uang masuk 4 minggu terakhir per hari, piutang toko jatuh tempo. Keluar: slip bulanan (tanggal 1), slip mingguan (Sabtu), Tagihan Rutin, kontrak jatuh tempo, Rencana Pengeluaran Besar (aturan 6), supplier (tempo bawaan kalau diisi; kalau tidak, rata-rata bayar 4 minggu terakhir). Selalu bertulisan "perkiraan"; perkiraan minggu lalu dibandingkan dengan kenyataannya. | AO4, butir B |
| 5 | **Batas aman kas dua tingkat**, pengaturan, dihitung ulang mesin tiap bulan dari 3 bulan terakhir dan boleh diganti GM atau Owner. **Merah**: uang bebas di bawah biaya wajib satu bulan (gaji, upah, sewa, tagihan, operasional; isi awal kira-kira Rp120 juta). **Kuning**: di bawah biaya wajib satu bulan + bayar supplier satu minggu (isi awal kira-kira Rp600 juta). Minggu di Perkiraan Kas yang menembus batas ditandai, dan GM serta Owner diberi tahu. | jawaban 2, butir D |
| 6 | **Rencana Pengeluaran Besar** (pilihan): GM atau Owner mengisi perkiraan nominal dan tanggal; ikut Perkiraan Kas; ditandai selesai saat uangnya benar-benar keluar, atau dibatalkan. Anggaran per pos tidak dibuat. Mesin memberi tanda kalau satu kelompok pengeluaran naik lebih dari 20% (pengaturan) dibanding rata-rata 3 bulan. | butir B |
| 7 | **Kemampuan Belanja**: "hari ini paling banyak bisa belanja tunai Rp…" = jumlah terbesar yang kalau dikeluarkan hari ini, saldo perkiraan tiap minggu selama 4 minggu tetap di atas batas kuning; tidak pernah di bawah nol. Dihitung server, tampil di halaman depan dan di layar bayar supplier. Layar menulis batasnya: ini perkiraan, dan menilai uang cukup atau tidak, bukan barang apa yang layak dibeli. | permintaan pemilik, butir C |
| 8 | **Simulasi belanja**: GM atau Owner mengetik rencana belanja; mesin menjawab aman atau tidak, saldo terendah berapa, dan di minggu ke berapa. Simulasi tidak mencatat apa pun. | butir C |
| 9 | **Penjaga kebiasaan menguras saldo.** Sistem tidak menolak pembayaran supplier. (a) Di kotak "Supplier" Catatan Cepat dan di layar bayar supplier tampil satu baris sebelum menekan OK: "setelah ini uang tersisa Rp…; gaji tanggal … butuh Rp…". (b) Kalau pembayaran itu membuat uang bebas turun di bawah batas **merah**, muncul satu jendela dengan kalimat biasa dan dua tombol: "Tetap bayar" dan "Kurangi"; menekan "Tetap bayar" tercatat. (c) GM diberi tahu saat itu juga tiap batas kuning atau merah ditembus. (d) Laporan bulanan memuat berapa kali batas merah ditembus dan berapa hari uang berada di bawahnya. | keterangan pemilik, butir E |
| 10 | **Uang Habis ke Mana**: kelompok tetap yang sama dengan Cek Modal (supplier, gaji dan upah, sewa dan tagihan, operasional, diambil Owner, lain-lain, belum dipilah), per cabang, dibanding periode sebelumnya, bisa dibuka sampai baris. "Diambil Owner" tampil di sini, tidak di Untung Rugi. | AO5, AO16 |
| 11 | **Satu hitungan laba, di server**: omzet (kasir) − harga pokok (kasir) = laba kotor; − biaya cabang (gaji dari slip, Tagihan Rutin menurut bulan yang dicakup, operasional menurut tanggal, bagian bulanan aset dan bayar di muka, barang reject, kekurangan yang ditanggung kantor) + rebate dan kelebihan kas. Uang diterima tampil terpisah, bukan sebagai penjualan. | AO6, AO13 |
| 12 | **Bukan biaya**: Pindah Dana, pembayaran supplier, uang kasbon dan cicilannya, "Pribadi", setoran antar tempat uang. Jenisnya ditentukan daftar kejadian (6A.10 aturan 23), bukan centang per kategori. Tidak ada "Realisasi Kasbon". | AO7 |
| 13 | **Bulan laporan keuangan = bulan kalender** (tanggal 1 sampai akhir bulan), sama dengan sistem kasir. Gaji periode 26–25 dibebankan ke bulan tempat periodenya **berakhir**; upah mingguan ke bulan tempat minggunya berakhir. Periode gaji dan laporan Logistik tetap 26–25. | jawaban 1 |
| 14 | **Rentang waktu**: hari ini, 7 hari, bulan ini, 3, 6, dan 12 bulan, serta tanggal pilihan. Pembanding: bulan sebelumnya dan bulan yang sama tahun lalu. | AO9 |
| 15 | **Data belum lengkap ditandai**: bulan yang omzet atau harga pokoknya belum masuk dari kasir, atau masih ada "belum dipilah" dan "belum diperiksa", tampil bertanda dengan jumlahnya; labanya tidak ditampilkan sebagai angka pasti. | AO8 |
| 16 | **Tutup bulan** oleh GM atau Owner. Sistem menampilkan daftar yang belum beres; boleh tetap ditutup dengan tanda "ditutup dengan catatan". Angka bulan tertutup tidak berubah; koreksi masuk bulan berjalan sebagai baris koreksi yang menunjuk bulan asalnya. Cek Modal jalan saat tutup bulan (6D1.10 aturan 14). | AO10 |
| 17 | **Tiga laporan bernama sehari-hari**: "Uang", "Untung Rugi", "Harta dan Utang" (isinya Cek Modal, tidak dibuat dua kali). Versi beristilah akuntansi hanya sebagai unduhan. | AO11 |
| 18 | **Cabang di laporan** memakai daftar cabang yang sama (WAJ-03); tidak ada "kelompok laporan" terpisah. **Back Office digabung ke Gudang**; tidak ada kolom "Kantor". Biaya orang kantor menjadi biaya Gudang; laba toko tidak dibebani biaya kantor. Penggabungan cabang untuk laporan adalah pengaturan cabang, bukan tulisan di kode. | AO14, jawaban 3, butir A |
| 19 | **Dana Tidak Hadir** tampil di Untung Rugi cabang sebagai catatan pembanding (potongan tidak hadir dibanding lembur dan kompensasi pengganti); tidak mengubah laba. | AO15 |
| 20 | **Hak**: semua laporan, Kemampuan Belanja, dan simulasi hanya GM dan Owner. Finance hanya melihat daftar kerjanya dan saldo tempat uang yang ia pegang atau cocokkan. HR dan kepala cabang tidak melihat apa pun. Dijaga server dan dicoba mesin pengaman. | AO12 |
| 21 | **Unduh dan cetak dibuat server** (Excel dan PDF), memuat tanggal dibuat dan pembuatnya. Unduhan omzet per cabang per bulan kalender dibawa, dengan omzet dari kasir. Laporan untuk akuntan, bank, dan pajak belum dirancang; ditambah saat ada permintaan nyata. | AO17, jawaban 4 |
| 22 | **Ringkasan pagi** untuk GM dan Owner lewat aplikasi (PRI-25): kemarin masuk dan keluar berapa, saldo sekarang, Kemampuan Belanja hari ini, dan yang perlu perhatian. Bisa dimatikan tiap orang. | AO18 |
| 23 | Semua mesin di bagian ini (saldo, perkiraan, batas aman, Kemampuan Belanja, tanda kenaikan, ringkasan pagi) mengikuti **PRI-33**; semua batas dan persennya punya layar pengaturan (**PRI-32**). | perintah pemilik |

### Temuan dan aturan yang mengatasinya

| Temuan | Aturan |
|---|---|
| Laba = Kas Masuk − HPP; hasil berlawanan dengan versi kasir | 11 |
| Dua hitungan laba berdampingan | 11 |
| Rumus laba di tiga halaman, dihitung di layar; batas 1.000 baris | 11 (AO13) |
| Pembanding bulan lalu tidak dikurangi kasbon | 11, 12 |
| Bulan tanpa HPP tampil untung; Kas Masuk tidak lengkap tanpa tanda | 15 |
| Biaya dihitung pada tanggal uang keluar | 11, 13 |
| Empat angka "kas" berbeda arti; "Saldo Proyeksi" bukan perkiraan | 2, 3, 4 |
| Baris tanpa rekening tidak mengurangi saldo | 2 (6A.10 aturan 14) |
| Tidak ada saldo per tanggal dan pembanding uang nyata | 2 |
| Tidak ada perkiraan kas | 4, 5, 7, 8 |
| Tidak ada daftar harta dan utang | 17 |
| Cabang "Logistik" hilang dari laporan; kelompok laporan terpisah | 18 (6D1.10 aturan 9) |
| Penjualan Gudang ke toko sendiri tidak dihapus di gabungan | 11 (6C.10 aturan 14) |
| Tidak ada tutup bulan; laporan lama berubah | 16 |
| Kepala cabang dan HR melihat laba | 20 |
| Hanya pembanding bulan lalu | 14 |
| Unduhan omzet memakai Kas Masuk; cetak dari browser | 21 |
| ID cabang, nama rute, dan daftar kategori di kode | 12, 18 (WAJ-05) |
| Dashboard dan Laporan Resmi kembar; ritase di laporan keuangan | 1 |
| Saldo dikuras untuk supplier | 5, 7, 9 |

### Titipan dari 6D2

- Untuk modul Tarik Data Kasir: omzet dan harga pokok per cabang **per hari**
  (untuk bulan kalender dan rentang pilihan); piutang toko dengan tanggal
  jatuh tempo (untuk Perkiraan Kas).
- Untuk 6E: kamus (Posisi Kas, uang bebas dipakai, Perkiraan Kas, batas aman,
  Kemampuan Belanja, Rencana Pengeluaran Besar, tutup bulan, Kesehatan
  Mesin); 6D1.10 aturan 14 "tutup periode" dibaca "tutup bulan"; gaji GM,
  finance, Marketing, HR dibebankan ke Gudang (aturan 18) dicocokkan dengan
  buku Karyawan.
- Untuk Tahap 3: layar Kesehatan Mesin dan menu Pengaturan lintas modul
  (PRI-32, PRI-33).
- Terbuka: bentuk laporan untuk akuntan, bank, dan pajak.

---

# Bagian 6E: Penetapan

Dimulai 12 Oktober 2026. Ukuran **besar**, dipecah dua (disetujui pemilik 12
Oktober 2026): **6E1** mencocokkan aturan, menyusun kerangka, memberi nomor,
dan mengajukan butir penutup; **6E2** menulis `../06-keuangan.md` setelah
butir penutup dijawab, lalu menyesuaikan kamus, peta modul, README aturan,
dan buku lain yang tersangkut.

## 6E.1 Pertentangan dan hal yang belum diatur (diajukan di percakapan, 12 Oktober 2026)

Ke-115 aturan dari 6A.10 (35), 6B.10 (21), 6C.10 (18), 6D1.10 (18, dengan
14a–14h), dan 6D2.10 (23) dicocokkan satu sama lain dan dengan KAR, KEH, GAJ,
LOG, DRV, PRI, dan TAM. Tidak ditemukan dua keputusan pemilik yang saling
membatalkan. Yang ditemukan: sebelas hal yang baru terlihat saat aturan dari
bagian yang berbeda dipertemukan. Kebanyakan berupa **uang yang sama bisa
tercatat dua kali** lewat dua pintu yang sama-sama sah.

Butuh pandangan pemilik:

1. **Buku toko dengan Gudang: uang mana yang dihitung "sudah dibayar ke
   Gudang".** 6C.10 aturan 12 menyebut "setoran tunai dan transfer toko
   dihitung sebagai pembayaran" dan menyebut dirinya pelapis 6B.10 aturan 8
   **dan 9**. Aturan 8 (tunai ke finance lalu Brankas) jelas: uangnya pindah
   ke Gudang. Aturan 9 tidak jelas: Raja dan Markas menyetor ke **rekening
   mereka sendiri**, dan QRIS atau transfer pembeli juga masuk rekening toko
   itu. Uang itu belum berpindah ke Gudang. Sebaliknya, belum ada aturan
   untuk **biaya toko yang dibayar dari uang Gudang** (gaji karyawan toko,
   sewa, listrik dibayar dari Brankas): tanpa itu "deposit toko di Gudang"
   membesar terus dan tidak berarti apa-apa.
   Saran: yang dihitung pembayaran hanya uang yang **benar-benar pindah** ke
   tempat uang Gudang (Brankas atau rekening Gudang) atau dipakai membayar
   supplier Gudang (aturan 12a). Uang di rekening toko sendiri tetap milik
   toko. Biaya toko yang dibayar dari uang Gudang **menambah utang toko**
   (atau mengurangi depositnya), otomatis, dari cabang yang dibebani di baris
   Buku Kas. Sejalan dengan 6D1.10 aturan 10 (uang tercatat bergerak saat
   benar-benar bergerak).
2. **Uang yang dibawa dulu, struknya menyusul; dan arti "Uang Jalan".**
   Catatan lama memuat "kembalian solar" dan "uj" (uang jalan), dan kotak
   "Uang Jalan" ada di Catatan Cepat (6A.10 aturan 31), tetapi tidak ada buku
   aturan yang menjelaskan uang jalan itu apa. Belum ada aturan juga untuk
   uang yang diberikan sebelum belanja. Tanpa aturan, Hitung Kas harian
   (6A.10 aturan 22) selalu selisih setiap ada orang yang sedang membawa
   uang.
   Saran: (a) dicatat **saat uang diberikan**, sebesar yang diberikan,
   bertanda **"struk menyusul"** dan nama pembawanya; (b) saat struk dan
   kembalian datang, nominal baris yang sama dibetulkan menjadi sebesar struk
   dan fotonya dilampirkan; (c) lewat 3 hari kerja belum ada struk: ditandai
   untuk GM. Uang jalan driver diperlakukan sama (bekal bensin, tol, parkir
   yang dipertanggungjawabkan), bukan tambahan upah; upah driver hanya dari
   ritase (DRV). Yang ditanyakan: benarkah uang jalan itu bekal yang harus
   dipertanggungjawabkan.

Cukup ok atau tidak:

3. **Satu uang keluar, satu baris: pencatat kedua memasangkan, bukan
   mencatat lagi.** Tiga tabrakan yang sama bentuknya: (a) kotak "Gaji/Upah"
   dan "Kasbon" di Catatan Cepat (6A.10 aturan 31) berhadapan dengan aturan
   bahwa pengeluaran gaji, bongkaran, dan kasbon **hanya lahir dari modulnya**
   dan ditolak kalau diketik (6A.10 aturan 13, GAJ-56, DRV-50, DRV-63); (b)
   kotak "Isi Kas Finance" dan "Setor Bank" milik Owner berhadapan dengan
   6A.10 aturan 29 (penerima yang mencatat Pindah Dana); (c) bensin dicatat
   Kepala Gudang di Logistik (LOG-83) dan juga keluar dari Kas Pegangan
   finance. Saran: Catatan Cepat berarti "uangnya sudah keluar"; finance
   **memasangkannya** ke urusan yang sudah ada di sistem (slip, kasbon,
   Laporan Bongkaran, tagihan rutin, nota supplier, Pindah Dana yang menunggu
   diterima, catatan bensin), sehingga tetap satu baris. Kalau urusannya
   sudah ditandai dibayar orang lain, catatan kedua dibatalkan dengan alasan
   "dobel catat". Catatan "gaji" tanpa slip yang cocok tidak boleh menjadi
   gaji: pilihannya Pribadi, Bantuan (DRV-77), atau ditanyakan. Sistem
   memberi peringatan bila ada dua catatan dengan tempat uang, nominal, dan
   hari yang sama.
4. **Tempat uang kelima: "Setoran di Finance".** 6B.10 aturan 8 menyebut
   "uang yang dipegang finance" sebelum disetor ke Brankas, tetapi 6A.10
   aturan 2 hanya mengenal empat tempat, dan 6A.10 aturan 3 melarang Kas
   Pegangan terisi selain dari Brankas. Saran: tempat uang tersendiri,
   terpisah dari Kas Pegangan, yang semestinya kosong tiap akhir hari kerja
   finance; kalau tidak kosong, ditandai.
5. **Uang yang diambil Ibu dari laci toko, dan siapa yang boleh mencatat
   "Pribadi".** 6A.10 aturan 9: Pribadi hanya dicatat pemilik atau GM.
   Tetapi 6B.10 aturan 12 membuat kasir mencatat "Diambil Owner", dan 6A.10
   aturan 25 membolehkan finance mencatat atas nama Owner dari pesan
   WhatsApp. Saran: "Diambil Owner" dari laci dicatat sebagai **pindah ke
   Brankas** (uangnya masih uang usaha, tertangkap hitung Brankas mingguan);
   baru menjadi "Pribadi" (mengurangi Buku Ibu) kalau Ibu atau GM
   menandainya. Finance boleh mengetik "Pribadi" atas nama Ibu hanya dengan
   lampiran pesannya, dan tetap diperiksa GM. Kasir tidak pernah mencatat
   "Pribadi".
6. **Foto bukti: kapan tidak wajib, dan jalan keluarnya.** 6A.10 aturan 6
   mewajibkan foto untuk setiap uang keluar yang diketik. Belum diatur:
   "Pribadi" dan pindah uang tunai antar kas tidak punya struk; dan bukti
   yang hilang membuat baris tertahan selamanya (WAJ-11). Saran: foto tidak
   wajib untuk Pribadi dan Pindah Dana tunai (setor bank tetap wajib foto
   slip setor); untuk yang lain ada pilihan **"bukti tidak ada"** dengan
   alasan wajib, yang otomatis ditandai untuk GM dan dihitung jumlahnya di
   laporan bulanan.
7. **Uang tiap shift disimpan terpisah sampai dihitung.** "Satu kasir satu
   tanggung jawab" (6B.10 aturan 14) hanya bisa ditegakkan kalau uang tiap
   shift tidak bercampur, padahal uang bisa diam di laci berhari-hari saat
   finance libur (6B.10 aturan 21). Saran: uang tiap shift dimasukkan amplop
   bertanda tanggal, shift, dan nama penutup sebelum disimpan; kalau finance
   menerima uang yang sudah bercampur, selisihnya **tidak dibebankan ke
   siapa pun** dan ditandai untuk GM.
8. **Finance tidak melihat sisa uang perusahaan.** 6D2.10 aturan 7 dan 9
   menampilkan Kemampuan Belanja dan "setelah ini uang tersisa Rp…" di layar
   bayar supplier, padahal layar itu dipakai finance (6C.10 aturan 4) dan
   6D2.10 aturan 20 berkata finance hanya melihat tempat uang yang ia
   pegang. Saran: kedua baris itu hanya tampil kalau yang membuka GM atau
   Owner.
9. **Gaji pemilik dan GM di laporan.** KAR-59 menitipkan ke Bab 6: gaji
   pemilik menjadi baris tersendiri. 6D2.10 aturan 18 menaruh biaya orang
   kantor di Gudang. Saran: gaji para pemilik dan GM tampil sebagai baris
   **"Gaji pemilik dan GM"** di Untung Rugi Gudang, terpisah dari gaji
   karyawan.
10. **Cara bayar gaji** (GAJ bagian 6 butir 2, dititipkan ke Bab 6). Saran:
    saat menekan "Bayar", pembayar memilih sumber uangnya (Brankas, Kas
    Pegangan, atau rekening); boleh beberapa slip sekaligus dari satu sumber.
    Transfer wajib foto bukti; tunai tanpa tanda terima kertas. Karyawan
    melihat "Dibayar tanggal … lewat tunai/transfer" di portal; yang merasa
    belum menerima mengajukan keberatan (GAJ-42).
11. **Isi awal** yang dititipkan ke 6E (6E.4): daftar kejadian, umur pakai
    aset, dan tanda "bulan belum ditutup" pada tanggal 10.

## 6E.2 Jawaban pemilik (12 Oktober 2026)

| No | Jawaban |
|---|---|
| 1 | "Ok paham." Saran dipakai. Pertanyaan pemilik: kalau uang di rekening Raja sudah Rp100 juta lalu dipakai Gudang membayar supplier, bagaimana? Dijawab di percakapan: itu KEU-70 (6C.10 aturan 12a). Satu baris: uang keluar dari rekening Raja, dipasangkan ke nota supplier, dan otomatis tercatat "Raja membayar Gudang Rp100 juta". Kalau utang Raja ke Gudang hanya Rp60 juta, sisanya Rp40 juta menjadi deposit Raja di Gudang. |
| 2 | "uj" di catatan lama **mungkin nama orang (Ujang)**, bukan uang jalan; catatan Ibu memang membingungkan. Dibaca Claude: (a) tafsiran "uang jalan" di 6A.9 ditarik, dan **kotak "Uang Jalan" dihapus** dari isi awal Catatan Cepat (6A.10 aturan 31; kotak bisa ditambah lewat pengaturan kalau kelak ternyata ada); (b) catatan yang hanya nama orang masuk "Lainnya" dan ditanyakan finance (KEU-32); (c) aturan "uang dibawa dulu, struk menyusul" tetap dipakai sesuai saran, karena "kembalian solar" memang terjadi. Jenis: **pengganti** sebagian 6A.10 aturan 31. |
| 3 | "Boleh." |
| 4, 5, 7, 8, 9 | Ok. |
| 6 | **Foto opsional dulu**; tim harus dibiasakan. Ini mengubah jawaban 6A.9 butir 4 ("di sistem baru foto wajib") dan 6A.10 aturan 6; disampaikan ke pemilik di percakapan. Dibaca Claude: foto bukti uang keluar menjadi **pengaturan** per jenis kejadian, "wajib" atau "dianjurkan", bertanggal berlaku (PRI-32), isi awal **dianjurkan**. Baris tanpa foto bertanda "tanpa bukti" dan dihitung jumlahnya di laporan bulanan, supaya GM tahu kapan tim siap dipindah ke "wajib". Pilihan "bukti tidak ada" beralasan baru berlaku saat pengaturannya "wajib". Tidak ikut berubah: foto struk Laporan Kasir (6B.10 aturan 4), foto bukti setor bank (6B.10 aturan 9), dan foto bukti transfer toko di Logistik (LOG-44), karena sudah berjalan dan tidak disebut pemilik. Jenis: **pelapis** 6A.10 aturan 6. |
| 10 | Ok, dengan **foto bukti transfer gaji opsional dulu** (pengaturan yang sama dengan butir 6). |
| 11 | Ok. Pemilik belum paham gunanya; dijelaskan di percakapan: daftar kejadian adalah menu pilihan finance supaya tiap pengeluaran otomatis masuk kelompok laporan yang benar; umur pakai membagi harga barang mahal ke beberapa tahun supaya laba bulan pembelian tidak tampak jatuh; tanda tanggal 10 adalah pengingat tutup bulan. Semuanya bisa diubah di pengaturan. |

Tambahan setelah 6E1 ditutup (12 Oktober 2026), dari pertanyaan pemilik
tentang umur pakai dan stock opname; keduanya masuk **KEU-86**:

- **Cek Aset setahun sekali** (disetujui pemilik, "ok"). Sistem menampilkan
  daftar aset kantor per cabang; kepala cabang, GM, atau Owner mencentang
  tiap barang: ada, rusak, atau tidak ketemu. Kepala cabang hanya melihat
  nama barang, **tanpa nilainya** (6D2.10 aturan 20 tidak berubah). Yang
  "tidak ketemu" ditandai untuk GM dan Owner, yang memutuskan: dipindah
  (catatan dibetulkan) atau hilang. Terlewat hanya memunculkan pengingat;
  tidak ada yang terkunci. Jadwalnya pengaturan (PRI-32), isi awal setahun
  sekali.
- **Barang rusak, hilang, atau dijual sebelum umur pakainya habis:** sisa
  nilainya menjadi kerugian di bulan itu; kalau dijual, dikurangi uang hasil
  penjualannya. Dicatat tanpa ditanyakan (melengkapi 6D1.10 aturan 13;
  rumusnya sudah dijelaskan ke pemilik di percakapan).
- Stock opname **barang dagangan** tetap di sistem kasir; HRIS hanya membaca
  hasilnya (6D1.10 aturan 14h). Seberapa sering di-opname adalah aturan
  sistem kasir.

Kedua bacaan (butir 2 dan 6) disampaikan ke pemilik di percakapan saat
menutup 6E1; kalau keliru, KEU-11, KEU-26, atau KEU-28 diubah di 6E2.

Dicatat tanpa ditanyakan, karena hanya melengkapi atau merapikan kalimat:

- 6A.10 aturan 13 menyebut "pembelian" sebagai modul yang melahirkan baris
  otomatis. Setelah 6C, HRIS tidak punya modul pembelian; pembayaran supplier
  dicatat lewat menu Utang Supplier atau kotak "Supplier", tidak lewat
  ketikan Kas Keluar biasa. Kata "pembelian" dihapus dari daftar itu.
- 6A.10 aturan 5 ("memeriksa: pemilik atau GM") berlaku untuk baris yang
  diketik. Baris otomatis lahir dari langkah yang sudah diperiksa di modul
  asalnya (uang pengiriman oleh finance atau pemilik, LOG-62; Laporan Kasir
  oleh finance, 6B.10 aturan 8 dan 11) dan tidak diperiksa ulang di Keuangan.
- 6B.10 aturan 1 ("satu jalan omzet toko") dan 6C.10 aturan 13 ("omzet dari
  kasir") disatukan: Laporan Kasir adalah satu-satunya jalan **uang
  penjualan toko** masuk Buku Kas; **omzet untuk hitungan laba** berasal
  dari data kasir. Angka omzet di Laporan Kasir menjadi pembanding; kalau
  berbeda, ditandai.
- 6D2.10 aturan 12 (daftar "bukan biaya") dilengkapi supaya tidak terhitung
  dua kali dengan 6D2.10 aturan 11: baris pembayaran slip, pembayaran
  tagihan rutin, pembelian aset, bayar di muka, dan kontrak ke pihak luar
  juga bukan biaya di Buku Kas, karena biayanya dihitung dari slip, tagihan,
  dan pembagian bulanannya.
- "Tutup periode" di 6D1.10 aturan 14 dibaca "tutup bulan" (6D2.10 aturan
  13 dan 16).
- Catatan yang tanggal uangnya jatuh di bulan yang sudah ditutup: saldo
  memakai tanggal sebenarnya, laporan memasukkannya ke bulan berjalan
  sebagai baris koreksi (6A.10 aturan 8, 6D2.10 aturan 16).
- 6B.10 aturan 21 (finance libur) berlaku untuk semua batas waktu finance
  di 6A. Butir (d) "kasbon menunggu finance" dibaca "finance atau pemilik"
  (DRV-63).
- Tabungan loyalitas di 6D2.10 aturan 3 dan 6D1.10 aturan 14b baru dihitung
  kalau jenis itu kelak dinyalakan (GAJ-31).
- 6D1.10 aturan 4 (tarif sewa aset Owner tanpa persetujuan) sesuai PRI-32
  butir 4: pihak lain diberi tahu.
- "Cash masuk kas tunai" di LOG-62 dibaca: masuk Brankas kalau diterima
  pemegangnya, atau Setoran di Finance kalau diterima finance (butir 4).
- Tetap terbuka dan tidak ditanyakan: cicilan apa dan tanggungan siapa
  (6D1 butir F); bentuk laporan untuk akuntan, bank, dan pajak.

## 6E.3 Kerangka bab dan asal aturan

Nomor di bawah dipakai `../06-keuangan.md`. Semua butir 6E.1 sudah dijawab
(6E.2); tidak ada nomor yang menunggu.

| Bab di buku aturan | Nomor |
|---|---|
| 3.1 Buku Kas dan tempat uang | KEU-01 s.d. 08 |
| 3.2 Mencatat dan memeriksa | KEU-09 s.d. 18 |
| 3.3 Kejadian, kategori, dan yang bukan biaya | KEU-19 s.d. 22 |
| 3.4 Baris yang lahir dari modul lain | KEU-23 s.d. 26 |
| 3.5 Catatan Cepat | KEU-27 s.d. 33 |
| 3.6 Brankas, Kas Pegangan, dan Hitung Kas | KEU-34 s.d. 37 |
| 3.7 Laporan Kasir | KEU-38 s.d. 47 |
| 3.8 Uang toko: laci, setoran, selisih, finance libur | KEU-48 s.d. 56 |
| 3.9 Supplier dan utang supplier | KEU-57 s.d. 68 |
| 3.10 Toko dan Gudang | KEU-69 s.d. 71 |
| 3.11 Omzet, harga pokok, dan Piutang Lain | KEU-72 s.d. 74 |
| 3.12 Tagihan Rutin | KEU-75 s.d. 79 |
| 3.13 Aset dan Buku Ibu | KEU-80 s.d. 87 |
| 3.14 Cek Modal | KEU-88 s.d. 97 |
| 3.15 Keuangan Hari Ini: posisi, perkiraan, batas aman, Kemampuan Belanja | KEU-98 s.d. 106 |
| 3.16 Laporan dan tutup bulan | KEU-107 s.d. 117 |
| 3.17 Hak akses dan aturan umum | KEU-118 s.d. 122 |
| 3.18 Pengaturan dan angka awalnya | KEU-123 |

| Nomor v3 | Isi singkat | Asal |
|---|---|---|
| KEU-01 | Satu Buku Kas | 6A.10 aturan 1 |
| KEU-02 | Tempat uang sebagai pengaturan | 6A.10 aturan 2; 6E.1 butir 4 |
| KEU-03 | Kas Pegangan menggantikan Petty Cash | 6A.10 aturan 3 |
| KEU-04 | Pindah Dana | 6A.10 aturan 4, 34 |
| KEU-05 | Tempat uang sumber wajib di semua baris | 6A.10 aturan 14 |
| KEU-06 | Satu kejadian bayar, satu baris | 6A.10 aturan 15 |
| KEU-07 | Saldo dihitung server; saldo awal bertanggal | 6A.10 aturan 16 |
| KEU-08 | Saldo awal dari hitung fisik pada hari mulai | 6A.10 aturan 21; 6B.10 aturan 19 |
| KEU-09 | Siapa mengisi dan siapa memeriksa | 6A.10 aturan 5; catatan 6E.2 |
| KEU-10 | Mencatat dan memeriksa adalah langkah utuh di server | 6A.10 aturan 11 |
| KEU-11 | Foto bukti: pengaturan wajib atau dianjurkan | 6A.10 aturan 6; 6C.10 aturan 3; 6E.1 butir 6 |
| KEU-12 | Tanggal catat dan tanggal uang | 6A.10 aturan 8; 6D2.10 aturan 16 |
| KEU-13 | Batas memeriksa 3 hari | 6A.10 aturan 7 |
| KEU-14 | Satu halaman Pemeriksaan | 6A.10 aturan 18 |
| KEU-15 | Daftar "Perlu Diperbaiki" | 6A.10 aturan 19 |
| KEU-16 | Tidak dihapus; dibatalkan dengan alasan | 6A.10 aturan 12 |
| KEU-17 | Riwayat perubahan di layar | 6A.10 aturan 17 |
| KEU-18 | Satu uang keluar, satu baris: memasangkan dan penjaga dobel | 6E.1 butir 3 |
| KEU-19 | Mesin pos: daftar kejadian | 6A.10 aturan 23 |
| KEU-20 | Kategori dan jenisnya | 6A.10 aturan 10 |
| KEU-21 | "Pribadi" hanya dicatat pemilik atau GM | 6A.10 aturan 9; 6E.1 butir 5 |
| KEU-22 | Yang bukan biaya | 6D2.10 aturan 12; catatan 6E.2 |
| KEU-23 | Baris otomatis hanya lahir dari modulnya | 6A.10 aturan 13 |
| KEU-24 | Gaji: dari slip bulanan dan mingguan; OB berslip; cara bayar | 6A.10 aturan 24; GAJ-48, 56; DRV-26; 6E.1 butir 10 |
| KEU-25 | Bongkaran, kasbon (diberikan, dilunasi tunai, dihapus), bantuan | DRV-47, 63, 69, 70, 77; titipan Bab 5 butir 5–6 |
| KEU-26 | Bensin dan uang yang dibawa dulu (struk menyusul) | LOG-83; 6E.1 butir 2 |
| KEU-27 | Catatan Cepat | 6A.10 aturan 25 |
| KEU-28 | Layar kotak-kotak dan isi awal kotaknya (tanpa kotak "Uang Jalan") | 6A.10 aturan 31; titipan 6D1; 6E.2 butir 2 |
| KEU-29 | Bahasa sehari-hari di layar pemilik uang | 6A.10 aturan 32 |
| KEU-30 | Pengecualian TAM-15 untuk "OK, catat" | 6A.10 aturan 35 |
| KEU-31 | Melengkapi | 6A.10 aturan 26 |
| KEU-32 | Finance tidak menebak; pos "Belum dipilah" | 6A.10 aturan 27 |
| KEU-33 | Diperiksa GM atau pemilik lain | 6A.10 aturan 28 |
| KEU-34 | Uang keluar dari Brankas dicatat penerimanya | 6A.10 aturan 29 |
| KEU-35 | Daftar "menunggu diterima" dan tombol "Terima" | 6A.10 aturan 33 (dilapisi 6B.10 aturan 8, 20) |
| KEU-36 | Hitung Kas untuk Kas Pegangan, harian | 6A.10 aturan 22 |
| KEU-37 | Hitung Brankas, mingguan | 6A.10 aturan 30 |
| KEU-38 | Satu jalan uang penjualan toko: Laporan Kasir | 6B.10 aturan 1; catatan 6E.2 |
| KEU-39 | Siapa boleh melapor adalah pengaturan | 6B.10 aturan 2 |
| KEU-40 | Jalan keluar kalau pelapor tidak ada | 6B.10 aturan 3 |
| KEU-41 | Isi laporan | 6B.10 aturan 4 |
| KEU-42 | Shift mengikuti shift cabang | 6B.10 aturan 5 |
| KEU-43 | Metode non-tunai dari daftar pengaturan | 6B.10 aturan 6 |
| KEU-44 | Batas waktu laporan dan pemeriksaannya | 6B.10 aturan 15 |
| KEU-45 | Laporan tidak dihapus | 6B.10 aturan 16 |
| KEU-46 | Piutang sebagai pembanding, titipan pelunasan, Cek Harian | 6B.10 aturan 18 |
| KEU-47 | Tarik data kasir disiapkan sejak awal | 6B.10 aturan 19 |
| KEU-48 | Laci tiap cabang | 6B.10 aturan 7 |
| KEU-49 | Setoran tunai toko | 6B.10 aturan 8 |
| KEU-50 | Setoran ke bank | 6B.10 aturan 9 |
| KEU-51 | Serah terima pembawa uang; uang tiap shift terpisah | 6B.10 aturan 10; 6E.1 butir 7 |
| KEU-52 | Non-tunai diperiksa per baris | 6B.10 aturan 11 |
| KEU-53 | Uang keluar dari laci, tiga jenis | 6B.10 aturan 12; 6E.1 butir 5 |
| KEU-54 | Selisih: kekurangan dan kelebihan kas | 6B.10 aturan 13 |
| KEU-55 | Satu kasir, satu tanggung jawab | 6B.10 aturan 14 (pelapis GAJ-20) |
| KEU-56 | Finance juga libur | 6B.10 aturan 21 |
| KEU-57 | Satu daftar supplier dan penjaga namanya | 6C.10 aturan 1 |
| KEU-58 | Nota belanja milik sistem kasir | 6C.10 aturan 2 |
| KEU-59 | Nomor dan foto nota tidak wajib; tanda "mungkin kembar" | 6C.10 aturan 3 |
| KEU-60 | Sisa utang supplier dan saling periksa dengan kasir | 6C.10 aturan 4 |
| KEU-61 | Satu kali bayar, satu baris; bayar sebagian | 6C.10 aturan 5 |
| KEU-62 | Semua jalan bayar bermuara ke buku utang yang sama | 6C.10 aturan 6 |
| KEU-63 | Yang memutuskan membayar adalah Owner | 6C.10 aturan 7 |
| KEU-64 | Uang muka tidak dipakai; bayar lebih menjadi titipan | 6C.10 aturan 8 |
| KEU-65 | Barang dikembalikan dan barang reject | 6C.10 aturan 9 |
| KEU-66 | Cashback dan rebate dicatat | 6C.10 aturan 10 |
| KEU-67 | Utang awal | 6C.10 aturan 11 |
| KEU-68 | Satu menu Utang Supplier; tidak memeriksa isian sendiri | 6C.10 aturan 16, 17 |
| KEU-69 | Buku toko dengan Gudang dan deposit toko | 6C.10 aturan 12; 6E.1 butir 1 |
| KEU-70 | Uang cabang yang dipakai membayar supplier Gudang | 6C.10 aturan 12a |
| KEU-71 | Uang dari driver seluruhnya milik Gudang | 6B.10 aturan 20; LOG-62, 64 |
| KEU-72 | Omzet dan harga pokok dari kasir | 6C.10 aturan 13; catatan 6E.2 |
| KEU-73 | Laba gabungan tidak menghitung dua kali | 6C.10 aturan 14 |
| KEU-74 | Buku Piutang Lain | 6C.10 aturan 15; GAJ-53; DRV-73 |
| KEU-75 | Tagihan Rutin: tagihan, bukan uang keluar | 6D1.10 aturan 1 |
| KEU-76 | Satu mesin, empat cara hitung | 6D1.10 aturan 2 |
| KEU-77 | Tarif bertanggal berlaku dan punya layar | 6D1.10 aturan 3 |
| KEU-78 | Bulan yang terlewat dikejar | 6D1.10 aturan 5 |
| KEU-79 | Bayar di muka dibagi ke bulan yang dicakup | 6D1.10 aturan 6 |
| KEU-80 | Daftar Aset: aset kantor dan aset milik Owner | 6D1.10 aturan 7 |
| KEU-81 | Dua angka per aset Owner | 6D1.10 aturan 8 |
| KEU-82 | Buku Ibu; saldo awal nol | 6D1.10 aturan 9, 17 |
| KEU-83 | Hak sewa adalah catatan hak, bukan uang pindah | 6D1.10 aturan 10 |
| KEU-84 | Kontrak ke pihak luar | 6D1.10 aturan 11 |
| KEU-85 | Pengingat kontrak 90, 60, 30 hari | 6D1.10 aturan 12 |
| KEU-86 | Aset kantor, pembagian biayanya, sisa nilai saat rusak, hilang, atau dijual, dan Cek Aset setahun sekali | 6D1.10 aturan 13; tambahan 6E.2 |
| KEU-87 | Tidak ada hapus untuk aset, kontrak, tarif, tagihan, Buku Ibu | 6D1.10 aturan 16 |
| KEU-88 | Cek Modal tiap tutup bulan | 6D1.10 aturan 14; 6D2.10 aturan 16 |
| KEU-89 | Harta menurut seberapa cepat menjadi uang | 6D1.10 aturan 14a |
| KEU-90 | Kewajiban | 6D1.10 aturan 14b |
| KEU-91 | "Jembatan" tiap baris | 6D1.10 aturan 14c |
| KEU-92 | Modal bergeser tanpa penjelasan | 6D1.10 aturan 14d |
| KEU-93 | Mesin memberi tahu | 6D1.10 aturan 14e |
| KEU-94 | Titik awal | 6D1.10 aturan 14f |
| KEU-95 | Cek di tanggal pilihan | 6D1.10 aturan 14g |
| KEU-96 | Batas kemampuan ditulis di layar | 6D1.10 aturan 14h |
| KEU-97 | Nilai stok tidak diketik | 6D1.10 aturan 15 |
| KEU-98 | Halaman depan "Keuangan Hari Ini" | 6D2.10 aturan 1 |
| KEU-99 | Posisi Kas | 6D2.10 aturan 2 |
| KEU-100 | Uang yang bebas dipakai | 6D2.10 aturan 3 |
| KEU-101 | Perkiraan Kas 4 minggu | 6D2.10 aturan 4 |
| KEU-102 | Batas aman kas dua tingkat | 6D2.10 aturan 5 |
| KEU-103 | Rencana Pengeluaran Besar dan tanda kenaikan | 6D2.10 aturan 6 |
| KEU-104 | Kemampuan Belanja | 6D2.10 aturan 7; 6E.1 butir 8 |
| KEU-105 | Simulasi belanja | 6D2.10 aturan 8 |
| KEU-106 | Penjaga kebiasaan menguras saldo | 6D2.10 aturan 9; 6E.1 butir 8 |
| KEU-107 | Uang Habis ke Mana | 6D2.10 aturan 10 |
| KEU-108 | Satu hitungan laba, di server | 6D2.10 aturan 11 |
| KEU-109 | Bulan laporan = bulan kalender | 6D2.10 aturan 13 |
| KEU-110 | Rentang waktu dan pembanding | 6D2.10 aturan 14 |
| KEU-111 | Data belum lengkap ditandai | 6D2.10 aturan 15 |
| KEU-112 | Tutup bulan | 6D2.10 aturan 16 |
| KEU-113 | Tiga laporan bernama sehari-hari | 6D2.10 aturan 17 |
| KEU-114 | Cabang di laporan; Back Office ke Gudang; gaji pemilik dan GM | 6D2.10 aturan 18; KAR-59; 6E.1 butir 9 |
| KEU-115 | Dana Disiplin dan Dana Tidak Hadir di laporan | 6D2.10 aturan 3, 19; GAJ-34, 35 |
| KEU-116 | Unduh dan cetak dibuat server | 6D2.10 aturan 21 |
| KEU-117 | Ringkasan pagi | 6D2.10 aturan 22 |
| KEU-118 | Hak isi awal per jabatan | 6A.10 aturan 5, 20; 6B.10 aturan 2; 6C.10 aturan 1; 6D2.10 aturan 20; 6E.1 butir 8 |
| KEU-119 | Hak atas tarif, tagihan rutin, dan tarif sewa aset Owner | 6D1.10 aturan 4 |
| KEU-120 | Tidak ada yang memeriksa isiannya sendiri; dijaga server | 6A.10 aturan 20; 6B.10 aturan 17; 6C.10 aturan 16 |
| KEU-121 | Setiap angka punya layar; setiap mesin punya penjaga | 6D1.10 aturan 18; 6D2.10 aturan 23; PRI-32, 33 |
| KEU-122 | Tidak ada catatan uang yang dihapus; satu rumus satu tempat; wajib tes | PRI-02, WAJ-04, WAJ-06 |
| KEU-123 | Pengaturan dan angka awalnya | angka dari aturan di atas; 6E.4 |

Semua butir 6A.10 (1–35), 6B.10 (1–21), 6C.10 (1–17 dan 12a), 6D1.10 (1–18
dan 14a–14h), dan 6D2.10 (1–23) punya nomor v3.

## 6E.4 Isi awal yang diusulkan (6E.1 butir 11)

**Daftar kejadian** (KEU-19; dipilih finance saat mencatat atau melengkapi;
disusun dari istilah Petty Cash lama di 6A.9). Ditambah dan diubah hanya
oleh pemilik atau GM.

| Kelompok di laporan | Kejadian | Isian wajib tambahan |
|---|---|---|
| Operasional | Konsumsi karyawan (masak, galon) | cabang |
| Operasional | Bensin atau solar | kendaraan |
| Operasional | Ongkos perjalanan (parkir, tol) | cabang |
| Operasional | Perlengkapan toko dan kebersihan | cabang |
| Operasional | Alat tulis dan cetak | cabang |
| Operasional | Kebutuhan hewan dan grooming | cabang |
| Operasional | Biaya bank | rekening |
| Operasional | Bantuan untuk karyawan (DRV-77) | nama orang |
| Operasional | Beli alat atau barang kantor (Rp1 juta ke atas menjadi aset, KEU-86) | cabang, nama barang |
| Sewa dan tagihan | Bayar listrik, internet, pajak, sewa, cicilan | dipasangkan ke Tagihan Rutin |
| Supplier | Bayar supplier | dipasangkan ke supplier dan nota |
| Gaji dan upah | Bayar slip, bongkaran | dipasangkan ke slip atau Laporan Bongkaran |
| Bukan biaya | Kasbon diberikan | dipasangkan ke kasbon |
| Diambil Owner | Pribadi | hanya pemilik atau GM |
| Diambil Owner | Service, pajak, atau kontrak aset milik Ibu (mengurangi Buku Ibu) | aset |
| Lain-lain | Pengeluaran lain | keterangan wajib; ditandai untuk GM |
| Pindah Dana | Isi Kas Pegangan, setor bank, tarik tunai, tukar tunai dengan transfer, setor ke Brankas | tempat asal dan tujuan |
| Uang masuk | Rebate atau cashback supplier | supplier |
| Uang masuk | Cicilan Piutang Lain | nama orang |
| Uang masuk | Jual aset | aset |
| Uang masuk | Uang pribadi Ibu masuk ke usaha (menambah Buku Ibu) | hanya pemilik atau GM |
| Uang masuk | Uang masuk lain | keterangan wajib; ditandai untuk GM |

Uang penjualan toko, uang pengiriman, kelebihan kas, dan pelunasan kasbon
tidak ada di daftar ini karena lahir otomatis dari modulnya (KEU-23).

**Umur pakai aset kantor** (KEU-86; bisa diubah di pengaturan):

| Jenis | Umur |
|---|---|
| Elektronik (komputer, printer, handphone, CCTV) | 4 tahun |
| Mesin dan alat (timbangan, alat grooming, AC, kulkas) | 4 tahun |
| Perabot (rak, etalase, meja) | 8 tahun |
| Kendaraan milik kantor (kalau kelak ada) | 8 tahun |
| Perbaikan bangunan sewaan | sampai kontraknya berakhir |

**Tanda bulan belum ditutup:** kalau sampai tanggal 10 bulan berikutnya
belum ditutup, muncul di daftar "perlu perhatian" GM (KEU-112).

## 6E.5 Catatan penulisan buku aturan (6E2, 12 Oktober 2026)

`../06-keuangan.md` ditulis mengikuti kerangka 6E.3; ke-123 nomor terisi.
Tidak ada butir baru yang ditanyakan. Yang ditulis menurut bacaan Claude,
karena hanya menyambung keputusan yang sudah ada, dan sudah disampaikan ke
pemilik di percakapan saat menutup 6E2:

- **KEU-11:** foto struk bensin (LOG-83) dimasukkan ke daftar yang tetap
  wajib, bersama tiga yang sudah disebut di 6E.2 butir 6, karena LOG-83
  sudah menetapkannya dan tidak disebut pemilik saat memutuskan "foto
  opsional dulu".
- **KEU-24:** beberapa slip boleh dibayar sekaligus dari satu sumber, tetapi
  tiap slip tetap punya barisnya sendiri di Buku Kas (supaya sejalan dengan
  GAJ-48 dan DRV-26: satu slip, satu catatan keuangan).
- **KEU-25:** cicilan kasbon lewat slip tidak menjadi baris Buku Kas
  tersendiri (sudah mengurangi uang slip yang dibayar); utang kasbon dan
  Piutang Lain yang dihapus menjadi biaya di Untung Rugi tanpa uang bergerak
  (DRV-70, KEU-74, KEU-108).
- **KEU-69:** setoran tunai toko dihitung sebagai pembayaran ke Gudang saat
  uangnya masuk Brankas atau rekening Gudang, bukan saat masih di Setoran di
  Finance (penerapan jawaban 6E.2 butir 1: "yang benar-benar pindah").
- **KEU-36:** "tiap hari tutup" dibaca "tiap akhir hari kerja pemegangnya",
  sejalan dengan KEU-56 (finance libur).

Yang ikut disesuaikan: kamus istilah (rujukan ke nomor KEU dan istilah
baru), peta modul, README aturan, TAM-15, KAR-59, GAJ-20 (pelapis), GAJ-34,
GAJ-48, GAJ-56, GAJ bagian 6 butir 2 dan bagian 7, LOG-62, LOG-64, LOG-83,
LOG bagian 7, DRV-41, DRV-77, DRV bagian 2, 6 (butir 11 dan 13), dan 7.

## 6E.6 Jawaban pemilik setelah 6E2 ditutup (12 Oktober 2026)

Menjawab daftar "yang masih terbuka" di penutup 6E2:

| Butir | Jawaban pemilik | Dicatat sebagai |
|---|---|---|
| Cicilan apa dan tanggungan siapa (6D1 butir F) | "Cicilan mobil box, yang menanggung adalah Ibu." | Cicilan aset Owner bukan biaya usaha: mesin hanya mengingatkan, tagihannya bertanda "tanggungan Ibu" dan tidak menjadi biaya cabang; kalau dibayar dengan uang usaha mengurangi Buku Ibu; kalau dibayar Ibu dengan uang pribadi tidak dicatat di Buku Kas. Jenis: **pelengkap** KEU-76, KEU-81, KEU-82 (mobil box memang sudah tercatat sebagai aset milik Owner, KEU-80). Tidak ada keputusan lama yang bertabrakan: 6D1.9 hanya menyebut "cicilan" sebagai tagihan rutin tanpa penanggungnya. |
| Laporan untuk akuntan, bank, dan pajak | "Belum ada, simpan dulu saja untuk dibahas nanti (masukkan khusus pajak, sebagai persiapan)." | Backlog `../../work/backlog/2026-10-12-laporan-pajak.md`. Tidak dirancang sekarang. |
| Hari mulai, kapan sambungan kasir dinyalakan, angka awal | "Belum tahu." | Tetap terbuka (bagian 6 buku aturan, butir 3–5). |

Bacaan Claude yang disampaikan ke pemilik di percakapan: tagihan cicilan
tetap ikut Perkiraan Kas (KEU-101) selama biasanya dibayar dari uang usaha,
karena uangnya memang keluar dari kas walaupun bukan biaya usaha.

