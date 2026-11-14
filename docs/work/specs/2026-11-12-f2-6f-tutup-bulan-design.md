# F2-6f Tutup Bulan — rancangan

Status: **disetujui owner 2026-11-14** bersama revisi §5 Koreksi bulan lalu (owner: "ok saya setujui, kerjakan dulu";
sebelumnya "saya akan ikuti saja saran anda, terutama ini harus sesuai dengan standart akutansi"). Rancangan awal
disusun agent 2026-11-12 atas perintah owner ("lanjutkan task berikutnya, kerjakan sampai selesai, dan terpush");
§0–§4 sudah dibangun sebagai F2-6f-1/F2-6f-2, §5 adalah tambahan F2-6f-3/F2-6f-4. Butir 💡 di §0 diputuskan owner
mengikuti usul agent (Owner/GM menutup, tidak ada buka kembali, boleh ditutup dengan catatan beralasan).

Sumber: PRD Fase 2 `07-modul-finance.md` §4 ("angka bulan yang ditutup dikunci; koreksi masuk bulan berjalan"),
`00-ringkasan-fase-2.md` §10 butir 9, aturan v3 `06-keuangan.md` KEU-112 dan KEU-221.

## 0. Keputusan (usul agent)

1. **Yang menutup: Owner atau GM** (KEU-221), di **web Finance › Tutup Bulan**. 💡 Ini satu-satunya tulisan web Finance:
   role `finance_app` mendapat INSERT **hanya** pada `petshop.month_closings` (tanpa UPDATE/DELETE). Alasannya, salinan
   laporan harus dihitung oleh Finance (rumus Laba Rugi & saldo hanya ada di sana) tepat saat ditutup. Mencatat uang
   tetap tidak pernah di Finance.
2. **Berurutan, mulai November 2026, hanya bulan yang sudah lewat** (WIB). Bulan berjalan tidak bisa ditutup.
3. **Tidak ada buka kembali** (KEU-221). Salah tutup tidak bisa dibatalkan; karena itu layar meminta mengetik nama bulan.
4. **Daftar belum beres** ditampilkan sebelum menutup. Kalau ada, boleh tetap ditutup sebagai **"ditutup dengan catatan"**
   dengan alasan wajib (KEU-112).
5. **Saat ditutup Finance menyimpan salinan**: tabel Laba Rugi bulan itu (semua kolom), daftar tanda belum lengkap, dan
   saldo tiap Tempat Uang per akhir bulan.
6. **Sesudah ditutup**:
   - Laba Rugi bulan itu menampilkan **angka salinan** (tidak berubah diam-diam), bertanda "Ditutup <tanggal> oleh <nama>".
   - Bila angka hidup sekarang berbeda dari salinan (mis. koreksi bulan lalu, slip gaji ditutup terlambat, nota bulan itu dibatalkan), tampil kotak
     **"Perubahan sesudah ditutup"** per baris/kolom, dan Laba Rugi bulan berjalan memberi peringatan bulan mana yang
     berubah. **Direvisi 2026-11-14 (§5):** kesalahan bulan tertutup (lupa catat, salah tanggal) dicatat sebagai
     **Koreksi bulan lalu** dan menyajikan kembali bulan asalnya; Laba Rugi bulan berjalan tidak ikut berubah.
   - **Back Office menolak** catatan uang bertanggal di bulan tertutup (kunci database, galat `HM001`, pesan
     "Bulan November 2026 sudah ditutup. Catat di bulan berjalan dan sebut bulan asalnya di catatan."):
     | Catatan | Dikunci menurut |
     |---|---|
     | Arus Kas — catat & batal | tanggal uang; juga "untuk bulan" bila kategorinya bukan kategori sistem |
     | Pindah Dana — catat & batal | tanggal pindah |
     | Hitung Kas — catat, batal, penyesuaian | tanggal hitung |
     | Aset — catat, batal, Rusak/Hilang/Dijual | tanggal beli / tanggal kejadian |
     | Saldo awal Tempat Uang — isi & batal | 1 November 2026 (terkunci begitu November ditutup) |
     Kategori sistem (bayar Biaya Rutin, Beli aset, Selisih kas) boleh "untuk bulan" tertutup selama tanggal uangnya di
     bulan terbuka: membayar sewa Oktober di Desember tidak mengubah Laba Rugi Oktober, yang sudah menghitung tagihannya.
   - Tidak dikunci (berjalan di tempat kejadiannya, tampil sebagai "Perubahan sesudah ditutup" bila mengubah angka):
     pembatalan nota kasir, slip gaji/bongkaran/logistik HRIS. **Retur** dan verifikasi setoran yang terlambat adalah
     kejadian bulan berjalan: retur nota November yang dilakukan Desember masuk Laba Rugi Desember (tanggal retur),
     tidak mengubah November.
7. **Pengingat**: bulan lalu yang belum ditutup sampai tanggal 10 bulan berikutnya tampil di Beranda Finance (KEU-112).

## 1. Back Office — F2-6f-1 (`feat/month-closings`, migrasi petshop `0070`, bisa rilis produksi)

- Tabel `month_closings`: `month` (tanggal 1, unik, ≥ 2026-11-01), `closed_by`, `closed_at`, `with_notes`, `note`
  (wajib bila dengan catatan), `open_items` (jsonb), `snapshot` (jsonb). Trigger: hanya INSERT; bulan harus sudah lewat
  dan bulan sebelumnya (≥ November 2026) sudah ditutup.
- Fungsi `month_is_closed(date)` dan trigger kunci pada lima tabel di §0 butir 6.
- `lib/db-errors.ts › closedMonthMessage` meneruskan pesan `HM001` (409) di rute Arus Kas, Pindah Dana, Hitung Kas, Aset,
  Saldo awal, Biaya Rutin.
- Tanpa layar baru di Back Office. Di produksi tidak ada yang bisa menutup bulan sampai web Finance rilis, jadi kunci
  belum pernah aktif di sana.

## 2. Finance — F2-6f-2 (`feat/finance-month-close`, dasar `dev_hris`, khusus staging)

- Menu **Tutup Bulan**: daftar bulan sejak November 2026 (Ditutup / Ditutup dengan catatan / Belum ditutup / Bulan
  berjalan). Bulan berikutnya yang boleh ditutup menampilkan:
  - Daftar belum beres: tanda belum lengkap Laba Rugi (Pengeluaran Kasir tanpa kategori, Arus Kas tanpa jenis, slip
    belum ditutup, sewa mobil belum dibayar, dsb.); Tunai/Rekening yang **tidak dihitung pada hari terakhir bulan** atau
    hitungan terakhirnya masih berselisih; catatan uang tanpa Tempat Uang.
  - Ringkasan angka yang akan disimpan (laba bersih Gabungan, jumlah saldo).
  - Isian: ketik nama bulan untuk memastikan; alasan wajib bila ada yang belum beres.
- Penyimpanan memakai transaksi baca-tulis khusus (koneksi Finance tetap baca saja untuk semua halaman lain).
- Laba Rugi: bulan tertutup memakai salinan + kotak perubahan; bulan berjalan memberi peringatan; "Cara membaca" diganti
  dari "Belum ada tutup bulan" menjadi penjelasan salinan.
- Rincian per bulan tertutup: siapa/kapan, catatan, daftar belum beres saat ditutup, saldo akhir bulan per Tempat Uang
  dibanding saldo hidup.

## 3. Tes

- BO (integrasi DB): trigger penutupan (bulan berjalan ditolak, ubah/hapus ditolak) dan kunci kelima tabel, termasuk
  pengecualian kategori sistem dan bulan terbuka tetap bisa dicatat.
- Finance (aturan murni): urutan bulan yang boleh ditutup, daftar belum beres, selisih salinan vs hidup.

## 4. Langkah uji owner (staging)

Di staging tanggal sekarang November 2026, jadi **belum ada bulan yang bisa ditutup** sampai 1 Desember 2026. Uji yang
bisa sekarang:
1. Finance › Tutup Bulan: November tampil "Bulan berjalan — bisa ditutup mulai 1 Desember 2026", beserta daftar belum
   beres sementara (apa yang masih perlu dibereskan sebelum menutup).
2. Laba Rugi November: catatan "Cara membaca" menjelaskan tutup bulan.
Mulai 1 Desember 2026:
3. Tutup November (ketik "November 2026"; bila ada yang belum beres isi alasan) → status Ditutup.
4. BO › Arus Kas: catat pengeluaran bertanggal November → ditolak dengan pesan bulan ditutup. Catat bertanggal Desember
   dengan Untuk bulan November → ditolak. Bayar Biaya Rutin tagihan November → boleh.
5. Retur satu nota November di kasir (Desember) → masuk Laba Rugi Desember; Laba Rugi November tidak berubah.
   (Langkah uji Koreksi bulan lalu ada di §5.6.)
6. Masuk sebagai Finance (bukan Owner/GM): web Finance tidak bisa dibuka.

## 5. Revisi 2026-11-14 — Koreksi bulan lalu (disetujui owner)

Dasar: PSAK 25 / IAS 8 — **kesalahan periode lalu** dikoreksi dengan **menyajikan kembali** periode asalnya, tidak
dibebankan ke laba periode berjalan; **kejadian baru** (retur, setoran cair) masuk periode terjadinya. Batasan: belum ada
Neraca, jadi penyesuaian saldo laba ditahan belum ditampilkan; laporan resmi (pajak/bank) tetap diperiksa akuntan.

### 5.1 Aturan

1. Di **Pendapatan & Pengeluaran** (Arus Kas) ada pilihan **"Koreksi bulan lalu"**: untuk biaya/pendapatan yang lupa
   dicatat atau salah dicatat di bulan yang **sudah ditutup**. Isian: bulan asal (hanya bulan yang sudah ditutup), alasan
   koreksi wajib (≥ 5 huruf), sisanya sama dengan catatan biasa.
2. **Tanggal uang** = tanggal sebenarnya di bulan terbuka (biasanya hari ini). Uangnya tercatat masuk/keluar di bulan
   terbuka itu (saldo Tempat Uang dan Arus Uang benar ke depan). **Untuk bulan** = bulan asal yang sudah ditutup.
3. Catatan biasa (bukan koreksi) dengan "Untuk bulan" tertutup tetap ditolak (`HM001`), dan pesannya mengarahkan ke
   "Koreksi bulan lalu". Koreksi untuk bulan yang **belum** ditutup ditolak (`HM002`): catat biasa dengan Untuk bulan itu.
4. Koreksi tetap bisa dibatalkan (alasan wajib, aturan batal Arus Kas biasa) selama tanggal uangnya di bulan terbuka.
   Pembatalan koreksi juga tampil di penyajian kembali.
5. **Laba Rugi bulan berjalan tidak berubah** oleh koreksi (Laba Rugi membaca "Untuk bulan").
6. Yang tidak memakai Koreksi bulan lalu: Pindah Dana dan Hitung Kas yang terlambat dicatat dengan tanggal hari ini (tidak
   mengubah laba); aset yang lupa dicatat dicatat bertanggal hari ini dengan catatan bulan asal (penyusutan mulai bulan
   dicatat — selisih penyusutan beberapa hari dianggap tidak material).

### 5.2 Laba Rugi bulan tertutup (web Finance)

- Di atas tabel salinan tampil ringkasan laba bersih Gabungan: **Saat ditutup → Koreksi bulan lalu → Perubahan lain →
  Disajikan kembali** (= angka hidup sekarang).
- Daftar koreksi: tanggal dicatat, cabang, kategori, jumlah, alasan, pencatat; koreksi yang dibatalkan tidak dihitung.
- "Perubahan lain" = perubahan sesudah ditutup yang bukan koreksi Arus Kas (nota dibatalkan, slip HRIS ditutup terlambat,
  dsb.); rincian per baris & kolom tetap di kotak "Perubahan sesudah ditutup".
- Rincian Laba Rugi menandai baris koreksi "(Koreksi, dicatat <tanggal>)".
- Bulan berjalan: peringatan bulan tertutup yang disajikan kembali tetap tampil.

### 5.3 Back Office — F2-6f-3 (`feat/month-close-corrections`, di atas `feat/month-closings`, migrasi petshop `0071`)

- Kolom `cash_flow_entries.correction_reason` (kosong = catatan biasa). CHECK: bila diisi, alasan ≥ 5 huruf dan "Untuk
  bulan" sebelum bulan tanggal uang.
- Trigger Arus Kas: "Untuk bulan" tertutup boleh bila koreksi; koreksi ke bulan belum tertutup → `HM002`; pesan `HM001`
  menyebut Koreksi bulan lalu. Tanggal uang di bulan tertutup tetap selalu ditolak.
- Form Arus Kas: centang "Koreksi bulan lalu" → pilihan bulan tertutup + alasan; daftar Arus Kas menandai baris koreksi.

### 5.4 Finance — F2-6f-4 (`feat/finance-month-corrections`, dasar `dev_hris` + `feat/month-close-corrections`, khusus staging)

- Pembaca koreksi per bulan; ringkasan & daftar §5.2 di Laba Rugi; tanda koreksi di Rincian; "Cara membaca" diperbarui.
- Tanpa tulisan baru (koneksi tetap baca saja); SELECT `cash_flow_entries` sudah dimiliki `finance_app`.

### 5.5 Tes

- BO integrasi DB: koreksi ke bulan tertutup diterima, koreksi ke bulan terbuka `HM002`, catatan biasa ke bulan tertutup
  `HM001`, batal koreksi diterima; aturan murni form/API.
- Finance: rumus ringkasan (koreksi vs perubahan lain) murni + pembaca koreksi (integrasi DB).

### 5.6 Langkah uji owner (mulai 1 Desember 2026, sesudah November ditutup)

1. BO › Pendapatan & Pengeluaran: catat biaya biasa Untuk bulan November → ditolak, pesan menyarankan Koreksi bulan lalu.
2. Centang **Koreksi bulan lalu**, bulan asal November, alasan "listrik November lupa dicatat", tanggal uang hari ini →
   tersimpan, baris bertanda Koreksi November 2026.
3. Finance › Laba Rugi November: Saat ditutup → Koreksi (−jumlah tadi) → Disajikan kembali; koreksi tercantum di daftar.
4. Finance › Laba Rugi Desember: laba tidak berkurang oleh koreksi itu; Arus Uang Desember memuat uang keluarnya.
5. Batalkan koreksi tadi → Laba Rugi November kembali sama dengan angka saat ditutup.

