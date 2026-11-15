# Menu v3 (Tahap 3C)

Tanggal: 13 Oktober 2026
Status: **ditetapkan 13 Oktober 2026** (jawaban di bagian 7; ringkasan di `../../aturan/00-peta-modul.md` bagian Menu; gambar diserahkan ke Claude Design lewat `../desain/2026-10-13-brief-claude-design-menu.md`)

Bahan: `../backlog/2026-10-11-susun-ulang-menu.md`; menu sistem lama
(`../../../hris-app/components/sidebar.tsx`, dibaca 13 Oktober 2026); KAR-49,
71, 78; SIS-06; KEH-20, 36, 56; GAJ-26, 55; DRV-80, 81; LOG-57, 80; KEU-09, 14,
98; KIN-48 dan bagian 7 butir 10; PRI-23, 32; TAM-07, 12, 20, 21;
`2026-10-13-hak-akses-desain.md`.

## 1. Keadaan sistem lama

12 menu utama dan sekitar **90 isi menu** (dihitung dari `sidebar.tsx`), dengan
yang tumpang tindih antara lain:

- Empat "dashboard": Dashboard, Dashboard Keuangan, Dashboard Pengiriman,
  Dashboard KPI.
- Lima pintu "tidak masuk": Ajukan Cuti/Izin, Riwayat Cuti & Izin, Ajukan
  Libur, Ganti Hari Libur, Kalender Libur.
- Tiga halaman jadwal: Jadwal Kerja, Penugasan Shift, Jadwal Shift Cabang.
- Keuangan terbelah dua menu (Operasional dan Keuangan) dengan Dashboard,
  Detail per Cabang, Cash Flow, dan Laporan Resmi yang kembar (KEU-98).
- Kasbon di dua menu; Tugas & Laporan di dua menu; Target Penjualan Promo di
  dua menu.
- Pengaturan tersebar di enam tempat ("Setup ..." di tiap menu).

## 2. Rancangan (menjalankan aturan yang sudah ada)

1. **Menu dibaca dari daftar hak akses** (KAR-49, 71). Satu isi menu tampil
   kalau orangnya punya paling sedikit satu tindakan di layar itu. Kelompok
   yang kosong tidak tampil. Tidak ada nama jabatan di kode menu.
2. **Satu layar, satu tempat di menu.** Layar yang sama tidak muncul di dua
   kelompok. Mengisi dan memeriksa adalah dua tugas (TAM-07), jadi boleh dua
   layar: misalnya kasir **mengisi** Laporan Kasir, finance **memeriksanya**.
3. **Urutan tetap**, tidak berpindah menurut seringnya dipakai, supaya tangan
   hafal letaknya.
4. **Angka penanda** di samping isi menu: jumlah yang menunggu orang itu
   (misalnya "Persetujuan 4"). Dibaca dari daftar "perlu perhatian" milik
   Perlengkapan Bersama.
5. **Tanda "Baru"** di isi menu dan di dalam halamannya (TAM-21).
6. **Nomor versi dan changelog** di kaki menu (TAM-20).
7. **"Lihat sebagai"** (KAR-78): selama dipakai, bilah berwarna di atas layar
   menyebut nama orang yang sedang dilihat, dan menu yang tampil adalah menu
   orang itu.
8. **Satu layar periode slip** untuk bulanan dan mingguan (keputusan 3A);
   ringkasan ada di halaman periode, bukan menu sendiri (GAJ-55).
9. **Beranda** menggantikan semua "dashboard" umum: isinya daftar "perlu
   perhatian" milik orang itu. Dua halaman depan modul yang sudah diputuskan
   tetap: Keuangan Hari Ini (KEU-98) dan Dashboard Logistik (LOG-80). Dashboard
   KPI digantikan halaman Rapor.

## 3. Usulan susunan menu

Susunan di bawah ini disetujui pemilik (M1 s.d. M5, bagian 7). Yang tampil untuk tiap orang hanya
yang menjadi haknya.

### Bagian atas: semua orang

| Menu | Isi | Mengganti di sistem lama |
|---|---|---|
| Beranda | Perlu perhatian saya, pemberitahuan | Dashboard, Dashboard Saya |
| Absen | Scan QR, lokasi, foto (KEH-10). Tidak tampil untuk yang tidak diabsen | Absen di portal |
| **Saya** | Profil & Akun (data diri, password, riwayat masuk) | Profil Saya, Perbarui Akun |
| | Jadwal & Kehadiran Saya (jadwal, rekap, kalender libur cabang) | Jadwal Saya, Rekap Absensi, Kalender Libur |
| | Pengajuan Saya (semua jenis, lihat M2) | Ajukan Cuti/Izin, Riwayat Cuti & Izin, Ajukan Libur, Ganti Hari Libur, Klaim Lembur |
| | Perlu Dijelaskan (KEH-56) | Klarifikasi Alpha |
| | Pendapatan Saya (slip bulanan dan mingguan, bongkaran, bonus; DRV-80) | Slip Gaji, Pendapatan Ritase |
| | Kasbon Saya | Kasbon (portal) |
| | Rapor & Tugas Saya (KIN-12, 44) | Kinerja Saya, Tugas & Laporan (portal) |
| | Serah Terima Saya (yang dikirim dan diterima, KEH-92; ditambah 13 Oktober 2026) | (baru) |
| | Lapor Masalah (rahasia, KEH-93; ditambah 13 Oktober 2026) | (baru) |
| **Panduan** (SIS-06) | Panduan Karyawan, Papan Perubahan Aturan, Pedoman Lapor | Panduan Karyawan, Aturan Potongan Gaji, Catatan Meeting jenis Aturan/SOP |

### Kerja Harian: pekerjaan lapangan, lintas modul (lihat M1)

| Isi | Untuk (menurut hak) | Modul pemilik layar |
|---|---|---|
| Trip Saya | Driver, kenek | Logistik |
| Laporan Kasir (mengisi) | Yang berhak lapor | Keuangan |
| Laporan Muat | Team Toko | Logistik |
| Antar Sendiri | Team Toko | Logistik |
| Terima Retur | Team Toko | Logistik |
| Laporan Promo | Team Toko | Kinerja |
| Laporan Bongkaran | Kepala Gudang | Gaji Driver |
| Hitung Kas | Pemegang Kas Pegangan | Keuangan |
| Foto Absen Hari Ini | Kepala Toko, Kepala Gudang | Kehadiran |

### Kantor: per modul

| Kelompok | Isi |
|---|---|
| Persetujuan | Satu kotak untuk semua pengajuan yang menunggu keputusan atau pemeriksaan saya (Mesin Pengajuan, PRI-23) |
| Karyawan | Daftar Karyawan (tambah, pindah, nonaktif, training, pekerja lepas, izin menyetir); Pendaftaran Baru; Hak Tambahan yang Aktif |
| Kehadiran | Jadwal & Shift; Rekap Kehadiran; Betulkan Absen; QR Absen; Serah Terima Tim (KEH-92); Laporan Masalah (GM dan pemilik, KEH-93) |
| Gaji | Gaji Karyawan (ditambah 13 Oktober 2026, GAJ-66); Periode Slip (bulanan dan mingguan); Jadwal Bayar; Persetujuan Bonus; Potongan (Kehilangan Barang, Minus Kas, Potongan Lain); Denda Driver & Kenek; Bongkaran; Kasbon; Dana Disiplin & Dana Tidak Hadir; Total Diterima per Orang |
| Logistik | Dashboard Logistik; Surat Jalan; Rencana & Trip; Tertunda; Retur; Pemeriksaan Uang Pengiriman; Catat di Kasir; Daftar Tagih (ditambah 14 Oktober 2026, LOG-133, 138); Data Toko; Bensin; Keadaan Mobil (KEH-94); Laporan Logistik |
| Keuangan | Keuangan Hari Ini; Buku Kas (Catatan Cepat, Pindah Dana); Pemeriksaan; Periksa Laporan Kasir; Utang Supplier; Toko & Gudang; Tagihan Rutin; Piutang Lain; Aset & Buku Ibu; Cek Modal; Laporan & Tutup Bulan |
| Kinerja | Rapor; Tugas; Penjualan Promo; Catatan Rapat |
| Pengaturan | Satu menu, dikelompokkan per modul (PRI-32), termasuk Hak Akses Jabatan, Pengaturan Jabatan, Daftar Pengecualian, Cabang & Jabatan (lihat M4) |
| Sistem | Kesehatan Mesin; Riwayat Error; Jejak Perubahan; Riwayat Masuk Semua Orang; Lihat sebagai (Pemilik dan GM) |

### Handphone (lihat M3)

Bilah bawah tetap: **Beranda · Absen · [tombol utama jabatan] · Pemberitahuan ·
Menu**. "Menu" membuka susunan lengkap di atas. Di PC, susunan lengkap tampil
sebagai menu samping.

## 4. Pertanyaan untuk pemilik

Diajukan di percakapan 13 Oktober 2026 (KER-13, 14). Jawaban di bagian 7.

- **M1.** Kelompok "Kerja Harian" lintas modul untuk pekerjaan lapangan.
- **M2.** Satu menu "Pengajuan Saya" untuk semua jenis (pelapis KEH-36).
- **M3.** Bilah bawah handphone dengan tombol utama per jabatan.
- **M4.** Batas antara Pengaturan dan daftar kerja harian (PRI-32).
- **M5.** Persetujuan Bonus, Pemeriksaan Keuangan, dan Pemeriksaan Uang
  Pengiriman: tetap di modulnya atau ikut kotak Persetujuan.
- **M6.** Tab lain yang menurut pemilik masih perlu digabung atau dibuang.

## 5. Contoh menu per orang

| Jabatan | Yang tampil (di luar Beranda, Absen, Saya, Panduan) |
|---|---|
| Kasir | Kerja Harian: Laporan Kasir, Laporan Muat, Antar Sendiri, Terima Retur, Laporan Promo |
| Driver | Kerja Harian: Trip Saya |
| Kepala Toko | Kerja Harian (seperti kasir, ditambah Foto Absen Hari Ini); Kehadiran: Jadwal & Shift cabangnya; Kinerja: Rapor dan Tugas timnya |
| Finance | Persetujuan; Gaji: Jadwal Bayar, Kasbon, Bongkaran; Logistik: Pemeriksaan Uang Pengiriman; Keuangan (tanpa Keuangan Hari Ini dan laporan) |
| Pemilik, GM | Semua; Absen tidak tampil untuk GM (KAR-67) |

## 6. Jalan keluar

| Kejadian | Sistem berbuat apa |
|---|---|
| Karyawan bilang menunya tidak muncul | Pemilik atau GM memakai Lihat sebagai (KAR-78), lalu memeriksa haknya di Hak Akses Jabatan |
| Hak sebuah jabatan dicabut | Menunya hilang saat itu juga (rancangan 3B butir 2.1 nomor 7) |
| Tombol utama jabatan belum diisi | Bilah bawah menampilkan Pengajuan Saya |
| Layar baru ditambah di kode tanpa tempat di menu | Mesin pengaman gagal, sama seperti pintu tanpa nama tindakan (KAR-63) |

## 7. Jawaban pemilik

Putaran 1, 13 Oktober 2026:

1. **M1: ya.** Kelompok Kerja Harian lintas modul untuk pekerjaan lapangan;
   kelompok per modul hanya untuk kantor.
2. **M2: ya.** Satu menu Pengajuan Saya. Pemilik bertanya apakah karyawan
   memilih jenisnya: **ya**. Alurnya tiga layar (TAM-07): (1) daftar
   pengajuan saya dengan tombol "Ajukan"; (2) pilih jenis, tombol besar per
   jenis, hanya jenis yang menjadi haknya (misalnya Kasbon hanya kalau
   memenuhi syarat); (3) isian khas jenis itu. Jenis: **pelapis** atas KEH-36.
3. **M3: ya**, dan pemilik minta bentuknya **dibuat desainnya** di Claude
   Design. Bahannya: `../desain/2026-10-13-brief-claude-design-menu.md`.
4. **M4: sesuai saran.**
5. **M5: sesuai saran.**
6. **M6: ditunda.** Pemilik belum punya catatan; catatan tab yang dobel diisi
   kapan saja di `../backlog/2026-10-11-susun-ulang-menu.md`. Tidak menahan
   penutupan 3C.
