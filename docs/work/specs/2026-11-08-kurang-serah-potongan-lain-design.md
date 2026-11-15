# B3 — Kurang serah → Potongan Lain (HRIS)

Status: **disetujui owner 2026-11-08** ("ok, saya ikut saran anda untuk point A dan B"; C "ok, sesuai saran").
Antrean: [`backlog/2026-11-08-perbaikan-logistik-hris.md`](../backlog/2026-11-08-perbaikan-logistik-hris.md) butir 2.
Dasar: Terima Uang LT4a (spec LT1 §16.1), Potongan Lain L4c-2 (GAJ-80/81).

## 1. Masalah sekarang

- Terima Uang mencatat **kurang serah** tunai atas nama pembawa (driver trip / PJ antar sendiri,
  `logistics.money_checks.responsible_employee_id`) dan memberi tahu pembawa + Pemilik/GM, dengan
  catatan "bahan Potongan Lain HR". Sesudah itu **tidak ada jalan** dari selisih ke Potongan Lain:
  HR harus menyalin orang, nominal, dan alasan sendiri, dan tidak ada tanda kurang serah mana yang
  sudah diurus.
- HR (`other_deduction.propose`) tidak bisa membuka Terima Uang, dan tidak diberi tahu.
- Form Potongan Lain hanya memuat orang **bergaji bulanan** (`loadPayrollPeople`), padahal driver dan
  kenek bergaji mingguan. Slip mingguan sudah membaca cicilan Potongan Lain (L7b), jadi yang kurang
  hanya pilihan orangnya di form.
- Selisih hanya tampil 60 hari; kurang serah yang belum diurus lewat dari itu hilang dari layar.

## 2. Usulan

1. **Satu kurang serah = satu cara bayar** (satu toko dalam satu kunjungan), nominal = jumlah kurang
   serah semua notanya. Tab Selisih Terima Uang menampilkannya sebagai satu baris berisi nota-notanya.
2. Tombol **Jadikan Potongan Lain** pada baris Kurang serah. Membuka form Ajukan Potongan Lain yang
   sudah terisi:
   - Orang: pembawa uang (driver trip / PJ antar sendiri) penuh sebagai bawaan. Untuk trip truk ada pilihan
     **Bagi dengan kenek**: rata atau diisi sendiri (mis. 70/30), jumlahnya harus sama dengan nominal. Tiap
     orang mendapat Potongan Lain sendiri (pengesahan dan keberatan masing-masing; keberatan satu orang
     tidak membatalkan bagian yang lain). Keputusan LT4a "driver hanya tanggung jawab tunai" tetap bawaan.
   - Jenis: **Kurang serah uang toko** (jenis baru dibuat migrasi; bisa diganti ke jenis aktif lain).
   - Nominal: total kurang serah (boleh diturunkan, tidak boleh dinaikkan).
   - Alasan: "Kurang serah uang toko <toko>, trip <nomor>, <tanggal>: nota <no> lapor Rp…, diterima
     Rp…" (boleh ditambah).
   - Kali potong: 1 (boleh diubah sampai batas pengaturan).
3. **Tetap lewat persetujuan**, sama seperti Potongan Lain biasa: HR mengajukan → Pemilik/GM
   mengesahkan; Pemilik/GM menjalankan langsung. Gaji tidak dipotong otomatis. Hak keberatan 3 hari
   tetap berlaku.
4. **Tanda tindak lanjut** di tab Selisih untuk tiap kurang serah:
   - ⚠️ **Belum ditindaklanjuti** (merah bila lebih dari 3 hari sejak diperiksa).
   - 🕓 **Diajukan, menunggu pengesahan**.
   - ✅ **Potongan Lain berjalan** (tautan ke Potongan Lain).
   - Ditolak / Dibatalkan → kembali ⚠️, boleh diajukan ulang.
   - **Sudah diganti tunai** (Finance, pemegang `logistics.money_check.do`, bukan pembawanya): nominal
     diterima, foto bukti boleh dilewati, catatan. Diganti penuh → selesai ✅; sebagian → sisanya tetap ⚠️
     dan bisa dijadikan Potongan Lain. Uang ini hanya dicatat (bahan modul Keuangan nanti, tanpa Buku Kas).
   - **Tidak dipotong** (hanya Pemilik/GM, alasan wajib): dimaafkan, selesai. Potongan Lain yang
     ditiadakan lewat keberatan juga dihitung selesai.
   - Ganti tunai dan Tidak dipotong tidak dihapus; salah catat dibatalkan beralasan.
   Kurang serah ⚠️ tetap tampil walau lebih dari 60 hari, sampai ditindaklanjuti.
5. **Sisa kurang serah** = total − ganti tunai berlaku − Potongan Lain hidup (Menunggu / Berjalan /
   terpotong). Pengajuan baru tidak boleh melebihi sisa; dijaga di server dalam satu transaksi berkunci.
6. **Batal pemeriksaan** Terima Uang ditolak selama Potongan Lain tertautnya Menunggu / Berjalan:
   batalkan atau tolak potongannya dulu.
7. **HR melihat tab Selisih** (baca saja, tanpa tab lain) dan **diberi tahu** saat ada kurang serah
   baru. Beranda HR menghitung kurang serah ⚠️.
8. **Form Potongan Lain menerima orang bergaji mingguan** (driver, kenek), untuk semua jenis.
   Cicilannya sudah dipotong di slip mingguan (satu cicilan = satu slip mingguan).

## 3. Di luar cakupan

- Lebih serah tetap diputuskan Finance seperti sekarang; transfer kurang tetap piutang toko di kasir.
- Tidak ada potong gaji otomatis dan tidak ada data uang ganda di kasir.

## 4. Teknis

- Migrasi hris `0054`: kolom `other_deductions.money_check_source` (`TRUCK`/`SELF`) +
  `money_check_payment_id` (tautan, boleh lebih dari satu baris untuk bagi driver/kenek); tabel
  `short_handover_settlements` (CASH_REPLACED nominal + foto / WAIVED alasan; siapa, kapan, batal beralasan); jenis Potongan
  Lain "Kurang serah uang toko"; hak lihat tab Selisih untuk HR. Tanpa migrasi logistics.
- Kode: `apps/hris/modules/logistics/{server/money-checks.ts,ui/money-check-screen.tsx}`,
  `apps/hris/modules/payroll/{server/other-deductions.ts,ui/other-deduction-form.tsx}`, halaman
  `potongan/lain/ajukan`, Beranda; fragment `apps/hris/changelog.d` + tanda Baru.
- Tes integrasi: tautan unik, pengajuan dari kurang serah, batal pemeriksaan ditolak, orang mingguan
  bisa dipilih, tanda Tidak dipotong.

## 5. Keputusan owner (2026-11-08)

- A. Orang bergaji mingguan bisa dipilih untuk semua jenis Potongan Lain: **setuju**. Bagi dengan kenek
  sebagai pilihan, bawaan tetap driver penuh: **setuju**.
- B. Dua tombol, **Sudah diganti tunai** (Finance) dan **Tidak dipotong** (Pemilik/GM): **setuju**.
- C. Nominal boleh diturunkan, tidak dinaikkan: **setuju**.
