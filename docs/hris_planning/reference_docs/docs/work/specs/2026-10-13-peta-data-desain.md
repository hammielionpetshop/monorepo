# Peta Data v3 (Tahap 3A)

Status: **ditetapkan 13 Oktober 2026.** P1 s.d. P5 disetujui pemilik (diajukan di
percakapan 13 Oktober 2026).

Gunanya: satu daftar semua data v3, siapa pemiliknya (satu-satunya modul yang
boleh mengubah, WAJ-03), dan modul mana yang membacanya. Sumbernya bagian 2
ketujuh buku aturan. Setelah disetujui, ringkasannya dipindah ke
`../../aturan/00-peta-modul.md`.

Cara membaca: "Pemilik" = modul yang menyimpan dan mengubah. "Dibaca oleh" =
modul lain yang hanya membaca. Data milik sistem kasir tidak pernah diubah
HRIS; dibaca lewat Tarik Data Kasir.

## 1. Perlengkapan Bersama (SIS-05)

Bukan modul bisnis. Dipakai semua modul dengan cara yang sama.

| Data | Isinya | Dibaca oleh |
|---|---|---|
| Papan Perubahan Aturan | Pengumuman, masa berlaku, sasaran, tanda "sudah saya baca" (PRI-29) | Semua (portal) |
| Riwayat error | Error yang tampil ke pemakai (TAM-05) | Pemilik, GM |
| Kesehatan Mesin | Tiap mesin otomatis: jadwal, terakhir jalan, gagal (PRI-33) | Pemilik, GM |
| Daftar "perlu perhatian" | Kumpulan tanda dari semua modul | Sesuai hak tiap tanda |
| Pemberitahuan | Pesan dalam aplikasi ke orang (PRI-25) | Penerimanya |
| Jejak perubahan | Siapa mengubah apa, kapan, nilai lama dan baru | Sesuai hak data asalnya |
| Mesin Pengajuan | Siapa mengajukan, untuk siapa, jenis, status, penyetuju, alasan, lampiran, riwayat keputusan (PRI-23, P1). Isi khas dan akibatnya milik modul jenisnya | Semua (tiap jenis menurut hak lihatnya) |

## 2. Data per modul

### Karyawan

| Data | Dibaca oleh |
|---|---|
| Orang (identitas, data pribadi, rekening, kontak darurat, foto, kode) | Semua (modul lain hanya nama dan jabatan, KAR-44); rekening oleh Gaji dan Keuangan |
| Riwayat penempatan (cabang, jabatan, status kerja, bertanggal) | Semua |
| Riwayat status (nonaktif, aktif lagi) | Kehadiran, Gaji, Gaji Driver |
| Cabang (termasuk titik lokasi) | Semua |
| Departemen, jabatan, daftar status kerja | Semua |
| Daftar hak akses per jabatan | Semua (dipakai mesin hak akses, dirinci di 3B) |
| Izin tugas lapangan (boleh menyetir, boleh jadi kenek) | Logistik |
| Akun, pendaftaran | (hanya Karyawan) |
| Pengajuan ubah data diri | (hanya Karyawan; caranya ikut P1) |
| Antrean promosi training | Kinerja (rapor) |
| Pedoman lapor | Semua (portal) |
| Pekerja lepas = orang berstatus Freelance (DRV-45) | Gaji Driver (bongkaran) |
| Pengaturan jabatan: semua tanda ya/tidak per jabatan (P2) | Kehadiran, Gaji, Gaji Driver |
| Daftar Pengecualian (P5) | Semua modul yang aturannya dikecualikan |

### Kehadiran

| Data | Dibaca oleh |
|---|---|
| Jam kerja cabang, jam tutup kantor, giliran shift | Gaji (telat, lembur), Kinerja |
| Radius dan QR cabang | (hanya Kehadiran) |
| Hari kerja (satu per orang per tanggal, PRI-17) | Gaji, Gaji Driver (DRV-16), Kinerja |
| Percobaan absen, foto absen | (hanya Kehadiran) |
| Jadwal libur, hari tutup | Gaji, Gaji Driver, Logistik (rencana), Keuangan (libur finance), Kinerja |
| Pengajuan tidak masuk, permintaan masuk di hari libur, klarifikasi, klaim lembur, koreksi absen | Gaji (lewat hari kerja) |
| Pengaturan kehadiran (bagian 3.13, bertanggal) | Gaji |

### Gaji (bulanan)

| Data | Dibaca oleh |
|---|---|
| Buku Upah (PRI-19, DRV-01): satu baris per upah, lahir dari modul asal | Gaji Driver (slip mingguan), Keuangan (beban gaji) |
| Komponen gaji per orang, Gaji Standar | (hanya Gaji) |
| Pengaturan gaji (bagian 3.7, bertanggal) | Gaji Driver |
| Tanggungan kehilangan barang, kehilangan barang | (hanya Gaji) |
| Minus kas catat tangan (di luar Laporan Kasir, P3) | (hanya Gaji) |
| Potongan Lain | Gaji Driver (slip mingguan, DRV-23) |
| Buku Bonus, jenis bonus | Logistik (asal ongkir), Kinerja (asal promo, Bonus Terukur), Keuangan |
| Dana Disiplin, Dana Tidak Hadir | Kinerja (sumber Bonus Terukur), Keuangan (pos) |
| Periode bulanan dan minggu upah, slip bulanan dan mingguan (satu mesin slip, P4), keberatan slip, pembayaran slip | Keuangan (total per periode, uang keluar), Gaji Driver (slip mingguan) |

### Logistik

| Data | Dibaca oleh |
|---|---|
| Data pengiriman toko (alamat, titik, HP, rute bawaan, kode kasir) | (hanya Logistik) |
| Mobil dan rute | Gaji Driver (tarif per mobil dan rute) |
| Surat jalan dan nota, rencana kirim dan trip, kunjungan toko, tertunda | Keuangan (uang masuk) |
| Ritase dan upah belanja (siapa, tanggal, mobil, rute) | Gaji Driver (nominal), Gaji (Buku Upah) |
| Laporan muat cabang, perjalanan antar sendiri | Gaji (tanda ⚠ bonus ongkir) |
| Potong nota, barang kejadian, retur | Keuangan |
| Pemeriksaan uang pengiriman | Keuangan (Kas Masuk) |
| Kiriman ke kasir | (hanya Logistik; diteruskan ke sistem kasir oleh orang kantor) |
| Permintaan bensin | Keuangan (pengeluaran bensin) |

### Gaji Driver, Bongkaran, Kasbon

| Data | Dibaca oleh |
|---|---|
| Daftar Jenis Upah | Gaji (Buku Upah) |
| Tarif ritase dan upah belanja | Gaji (Buku Upah) |
| Jenis denda dan denda driver/kenek | Gaji (Dana Disiplin) |
| Laporan Bongkaran, berat per satuan produk, tarif bongkaran | Gaji (Buku Upah), Keuangan (pembayaran bongkaran) |
| Kasbon dan cicilannya, pengaturan kasbon | Gaji (slip, potongan d), Keuangan (uang keluar dan pelunasan) |
| (Slip mingguan disimpan mesin slip Gaji, P4; aturannya tetap DRV-20 s.d. 23) | |

### Keuangan

| Data | Dibaca oleh |
|---|---|
| Buku Kas, tempat uang, daftar kejadian dan kategori | (laporan hanya Pemilik dan GM, KEU-118) |
| Catatan Cepat, Hitung Kas | (hanya Keuangan) |
| Laporan Kasir, daftar metode non-tunai | Kinerja |
| Selisih kasir dan keberatannya: satu-satunya catatan kekurangan kas dari Laporan Kasir (P3) | Gaji (slip membaca langsung), Kinerja |
| Daftar supplier | Gaji Driver (bongkaran) |
| Utang supplier versi HRIS, buku toko dengan Gudang, Piutang Lain, Tagihan Rutin, Daftar Aset, Buku Ibu, Cek Modal, Rencana Pengeluaran Besar, batas aman kas, tutup bulan | (hanya Keuangan) |

### Kinerja

| Data | Dibaca oleh |
|---|---|
| Daftar ukuran, kriteria rapor, target omzet cabang, rapor | (hanya Kinerja; Karyawan untuk promosi training) |
| Aturan Bonus Terukur dan hasil penilaiannya | Gaji (baris Buku Bonus) |
| Produk promo, laporan penjualan promo | Gaji (baris Buku Bonus) |
| Master Judul, tugas, laporan tugas, daftar rak, Catatan Rapat | (hanya Kinerja) |

### Tarik Data Kasir

| Data | Dibaca oleh |
|---|---|
| Hasil tarikan: toko, penjualan, piutang, daftar produk, omzet, harga pokok, stok, PO, nota supplier | Logistik, Gaji Driver, Keuangan, Kinerja |

## 3. Temuan yang perlu diputuskan

Diajukan di percakapan 13 Oktober 2026. Jawaban di bagian 4.

- **P1. Pemilik Pengajuan.** `00-peta-modul.md` masih "belum ditentukan".
- **P2. Pengaturan jabatan saling lempar.** KAR bagian 2 menyebutnya milik
  Kehadiran; KEH, GAJ, dan DRV bagian 2 menyebutnya milik Karyawan.
- **P3. Minus kas dicatat dua buku.** GAJ memiliki "Minus kas" (sumber Laporan
  Kasir), KEU memiliki "Selisih kasir" untuk kekurangan yang sama.
- **P4. Slip mingguan.** DRV bagian 7 butir 9 meminta satu mesin slip,
  tetapi slip bulanan milik Gaji dan slip mingguan milik Gaji Driver.
- **P5. Daftar Pengecualian.** GAJ menyebutnya milik Karyawan, tetapi KAR
  bagian 2 tidak mencantumkannya.

Dirapikan tanpa perlu keputusan (WAJ-12): Buku Upah belum tercantum di GAJ
bagian 2 padahal `00-peta-modul.md` dan DRV menyebutnya milik Gaji.

## 4. Jawaban pemilik

Dijawab pemilik 13 Oktober 2026: **P1–P5 sesuai saran Claude.**

1. **P1:** Mesin Pengajuan milik Perlengkapan Bersama (status, penyetuju,
   alasan, lampiran, riwayat). Isi khas tiap jenis dan akibat setelah
   disetujui milik modul jenisnya. Rincian cara kerja di 3E.
2. **P2:** semua tanda ya/tidak per jabatan disimpan di Karyawan, satu layar
   "Pengaturan Jabatan". Angka uang per jabatan (bobot tanggungan
   kehilangan, jabatan penerima jenis bonus) tetap di Gaji.
3. **P3:** kekurangan kas dari Laporan Kasir hanya dicatat di Keuangan
   (selisih kasir dan keberatannya); slip membacanya langsung. "Minus kas"
   di Gaji tinggal untuk catat tangan di luar Laporan Kasir. Aturan uangnya
   tidak berubah (GAJ-20 dilapisi KEU-55).
4. **P4:** satu mesin slip milik Gaji untuk slip bulanan dan mingguan,
   beserta pembayaran dan periodenya. Pemilik bertanya apakah ini yang
   terbaik; Claude menjawab ya (pilihan lain, dua buku slip dengan cara
   kerja sama, berarti menutup, membayar, dan membatalkan slip ditulis dan
   dites dua kali dan bisa berbeda diam-diam). Pemilik setuju. Jenis:
   **pengganti** atas baris "Slip mingguan" dan "Pembayaran slip mingguan" di
   bagian 2 buku Gaji Driver. DRV-20 s.d. 23 tidak berubah.
5. **P5:** Daftar Pengecualian milik Karyawan.

Dicatat ke: bagian 2 buku Karyawan, Kehadiran, Gaji, Gaji Driver, dan
Keuangan; bagian 1 buku Gaji Driver; `00-peta-modul.md`; `00-kamus-istilah.md`
(Pengaturan Jabatan, Perlengkapan Bersama, Mesin Pengajuan, Minus kas).
