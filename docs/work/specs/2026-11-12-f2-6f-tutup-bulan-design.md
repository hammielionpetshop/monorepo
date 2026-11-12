# F2-6f Tutup Bulan — rancangan

Status: **disusun agent 2026-11-12 atas perintah owner** ("lanjutkan task berikutnya, kerjakan sampai selesai, dan
terpush" sesudah F2-6e lolos uji). Owner belum membaca rancangan ini; semua pilihan di bawah adalah **usul agent**
mengikuti aturan v3 KEU-112 / KEU-221 dan prinsip Fase 2. Bagian yang paling mungkin ingin diubah owner ditandai 💡.

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
   - Bila angka hidup sekarang berbeda dari salinan (mis. retur nota lama, slip gaji terlambat), tampil kotak
     **"Perubahan sesudah ditutup"** per baris/kolom, dan Laba Rugi bulan berjalan memberi peringatan bulan mana yang
     berubah. 💡 Perubahan itu **belum** dibukukan otomatis sebagai baris koreksi di bulan berjalan (v3 meminta begitu);
     usul: ditambah sesudah owner melihat contoh nyata, supaya tidak ada hitungan ganda saat bulan berikutnya ditutup.
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
     penjualan/retur kasir, verifikasi setoran yang terlambat, slip gaji/bongkaran/logistik HRIS.
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
5. Retur satu nota November di kasir → Laba Rugi November tetap angka salinan, kotak "Perubahan sesudah ditutup" muncul.
6. Masuk sebagai Finance (bukan Owner/GM): web Finance tidak bisa dibuka.
