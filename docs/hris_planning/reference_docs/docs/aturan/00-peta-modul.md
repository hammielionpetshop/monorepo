# Peta Modul

Modul apa saja yang ada, data apa milik siapa, dan siapa boleh apa.
**Ditetapkan lengkap 13 Oktober 2026 (Tahap 3G)**, setelah 3A s.d. 3F diperiksa
silang. Perubahan berikutnya mengikuti WAJ-08 dan WAJ-12.

## Urutan modul

Sama dengan `../work/plans/2026-10-11-peta-jalan-v3.md`, disusun dari yang tidak
bergantung pada modul lain:

1. **Karyawan dan Akses**: cabang, jabatan, karyawan, login, hak akses.
2. **Kehadiran**: jam kerja cabang, QR absen, istirahat, Laporan Pulang (serah terima, laporan masalah, keadaan mobil), hari kerja, libur, izin, sakit, lembur.
3. **Gaji Bulanan**: komponen gaji, potongan, bonus, slip, periode.
4. **Logistik**: rencana kirim, muat, antar sendiri, nota, retur, data pengiriman toko. Grooming (order, antar-jemput kucing) milik sistem kasir (LOG-74, 89).
5. **Gaji Driver, Bongkaran, Kasbon**: tarif ritase, aturan slip mingguan, Laporan Bongkaran, kasbon, jenis upah dan jalur bayar.
6. **Keuangan**: Buku Kas dan tempat uang, Catatan Cepat, Laporan Kasir, utang supplier, buku toko dengan Gudang, Tagihan Rutin, aset dan Buku Ibu, Cek Modal, laporan.
7. **Kinerja**: rapor dan Bonus Terukur, penjualan promo, Tugas (rutin, sekali jalan, kerapian display), Catatan Rapat. Membaca hari kerja, titik lokasi, dan jam kerja dari Kehadiran, selisih kasir dari Keuangan, dan data kasir dari Tarik Data Kasir; mencatat bonusnya ke Buku Bonus milik Gaji. Rekrutmen ditangguhkan (`../work/backlog/2026-10-12-rekrutmen-ditangguhkan.md`).

Portal karyawan bukan modul; ia tampilan yang membaca modul lain.

**Perlengkapan Bersama** (SIS-05): bukan modul bisnis, tetapi pemilik data
yang dipakai semua modul: Mesin Pengajuan (PRI-23, 37), Papan Perubahan Aturan
dan pengumuman darurat (PRI-29, 35, 36), pengingat berantai (TAM-22, 24),
riwayat error (TAM-05, 23), Kesehatan Mesin (PRI-33), tempat uji dan "Lihat
sebagai" (KAR-52, 78), dan mesin pengaman hak akses (KAR-63).

**Tarik Data Kasir**: satu-satunya modul yang mengambil data dari sistem kasir
   (admin.hammielion.com). Satu arah, hanya mengambil. Modul lain membaca dari
   modul ini. Lihat `../work/backlog/2026-10-11-tarik-data-kasir.md`.

## Data dan pemiliknya

Satu baris per jenis data. Modul lain hanya boleh membaca (WAJ-03).

Rincian per data beserta modul yang membacanya:
`../work/specs/2026-10-13-peta-data-desain.md` (Tahap 3A, ditetapkan
13 Oktober 2026).

| Data | Modul pemilik |
|---|---|
| Papan Perubahan Aturan (PRI-29, 35), pengumuman darurat (PRI-36), antrean pengingat berantai (TAM-22, 24), riwayat error (TAM-05, 23), Kesehatan Mesin, daftar "perlu perhatian", pemberitahuan, jejak perubahan | Perlengkapan Bersama (SIS-05) |
| Mesin Pengajuan: siapa mengajukan, untuk siapa, status, penyetuju, alasan, lampiran, riwayat keputusan, untuk semua jenis pengajuan (PRI-23) | Perlengkapan Bersama. Isi khas tiap jenis dan akibatnya setelah disetujui milik modul jenisnya (izin dan lembur: Kehadiran; keberatan slip: Gaji; kasbon dan denda: Gaji Driver; keberatan selisih kasir: Keuangan; laporan promo: Kinerja; ubah data diri: Karyawan). Cara kerjanya: PRI-37 (Tahap 3E) |
| Karyawan, cabang, jabatan, departemen, pekerja lepas | Karyawan |
| Pengaturan jabatan (semua tanda ya/tidak per jabatan) dan Daftar Pengecualian | Karyawan. Angka uang per jabatan tetap di Gaji |
| Akun login dan hak akses | Karyawan |
| Jam kerja tiap cabang, catatan hari kerja, absen, Laporan Pulang (serah terima, laporan masalah rahasia, keadaan mobil; KEH-89 s.d. 95) | Kehadiran |
| Catatan upah (Buku Upah), periode bulanan dan minggu upah, slip bulanan dan slip mingguan (satu mesin slip) dan pembayarannya, minus kas catat tangan | Gaji |
| Data pengiriman toko, surat jalan, nota, rencana, trip, catatan ritase dan upah belanja, laporan muat, antar sendiri, potong nota, retur, pemeriksaan uang pengiriman | Logistik (`04-logistik.md` bagian 2) |
| Identitas toko, penjualan, piutang toko, pelunasan, titipan toko | Sistem kasir, bukan HRIS (LOG-65) |
| Data hasil tarikan dari sistem kasir, termasuk daftar produk (kode, nama, satuan) dari file export, jasa grooming yang sudah diambil (GAJ-61), dan baris ongkir beserta pengantarnya (LOG-42, 76); pemasangan nama groomer dan pengantar ke karyawan | Tarik Data Kasir |
| Order grooming, data kucing dan pemiliknya, delivery kucing, daftar groomer dan pengantar | Sistem kasir, bukan HRIS (LOG-89) |
| Daftar Jenis Upah, tarif ritase dan upah belanja, aturan slip mingguan (slipnya disimpan Gaji), jenis denda dan denda driver/kenek, Laporan Bongkaran, berat per satuan produk, tarif bongkaran, Kasbon dan cicilannya, pengaturan kasbon | Gaji Driver, Bongkaran, Kasbon (`05-gaji-driver-kasbon.md` bagian 2) |
| Buku Kas, tempat uang dan saldonya, daftar kejadian dan kategori, Catatan Cepat, Hitung Kas, Laporan Kasir dan selisih kasir (satu-satunya catatan kekurangan kas dari Laporan Kasir; slip membacanya langsung), daftar supplier dan utang supplier versi HRIS, buku toko dengan Gudang, Piutang Lain, Tagihan Rutin, Daftar Aset, Buku Ibu, Cek Modal, batas aman kas, tutup bulan | Keuangan (`06-keuangan.md` bagian 2) |
| Daftar ukuran, kriteria rapor, target omzet cabang, rapor, aturan Bonus Terukur dan hasil penilaiannya, produk promo dan laporan penjualan promo, Master Judul, tugas dan laporannya, daftar rak, Catatan Rapat | Kinerja (`07-kinerja-rekrutmen.md` bagian 2) |
| Stok dan nilainya, purchase order, omzet, harga pokok, nota belanja ke supplier, barang reject, sisa utang supplier versi kasir | Sistem kasir, bukan HRIS (KEU-58, 72, 97) |

## Hak akses

**Ditetapkan 13 Oktober 2026 (Tahap 3B).** Rancangan dan jawaban pemilik:
`../work/specs/2026-10-13-hak-akses-desain.md`. Aturannya di buku Karyawan
KAR-58, 63, 69 s.d. 78.

Cara kerja:

- Hak ditentukan di **satu tempat**: daftar tindakan bernama di kode,
  pemberiannya per jabatan sebagai data di layar "Hak Akses Jabatan", tiap hak
  dengan lingkup diri sendiri, cabangnya, departemennya, atau semua (KAR-71).
  Hanya Pemilik dan GM yang mengubahnya (KAR-73).
- **Batas keras** yang tidak bisa dibuka siapa pun: mengubah hak sendiri,
  memutuskan urusan sendiri, melihat gaji Pemilik dan GM, mengubah data yang
  sudah disetujui, memakai sistem tanpa masuk (KAR-72).
- Data gaji hanya bisa dilihat pemiliknya sendiri, HR, dan pemilik perusahaan;
  gaji Pemilik dan GM hanya oleh kedua jabatan itu (PRI-24, GAJ-46, KAR-67).
- Jabatan **GM** haknya setara Pemilik di semua modul (KAR-67).
- Jabatan berhak tinggi (Pemilik, GM, HR, Finance) hanya diisi Pemilik dan GM
  (KAR-74). Hak tambahan per orang hanya jenis bernama dan berakhir sendiri
  (KAR-75). Satu orang paling banyak satu jabatan tambahan; Finance dan
  Marketing tidak dirangkap tetap (KAR-76).
- Mesin pengaman mencoba setiap tindakan sebagai tiap jabatan (KAR-63).
- "Lihat sebagai": akun contoh di tempat uji; orang sungguhan, hanya melihat,
  di sistem asli untuk Pemilik dan GM (KAR-52, KAR-78).

### Jabatan v3 dan isi awal haknya

Ringkasan; rincian tindakan per modul ada di LOG-84, DRV-82, KEU-118, KIN-48,
GAJ-46, dan aturan Kehadiran (KEH-04, 14, 20, 37, 80). Nama jabatan adalah
data, bukan kode (KAR-58).

| Jabatan (departemen) | Ringkasan hak |
|---|---|
| Pemilik, GM (Office) | Semua, termasuk semua yang tertulis "hanya pemilik"; Hak Akses Jabatan; laporan keuangan; laporan masalah rahasia (hanya kedua jabatan ini, KEH-93) |
| HR (Office) | Data karyawan, jadwal, pengajuan kehadiran, rapor dan tugas, slip semua orang kecuali Pemilik dan GM, menutup slip. **Dibiarkan kosong** saat ini; GM merangkap HRD |
| Admin HR (Office) | Hak HR **tanpa melihat gaji dan slip** orang lain (KAR-77) |
| Finance (Office) | Buku Kas dan pekerjaan uang (KEU-118), pemeriksaan uang pengiriman (LOG-84), total slip per periode tanpa slip per orang (GAJ-46), kasbon dan bongkaran (DRV-82), tindak lanjut keadaan mobil (KEH-94). Tidak melihat laporan keuangan |
| Marketing (Office) | Surat jalan, toko, retur, daftar tagih (LOG-84); Laporan Kasir Gudang (KEU-39). Tidak memeriksa uang |
| Kepala Gudang (Team Gudang) | Rencana, trip, retur, bensin (LOG-84); denda dan Laporan Bongkaran (DRV-82); supplier baru (KEU-118); rapor dan tugas timnya (KIN-48); tanggal dan status pengajuan timnya (KEH-80); tindak lanjut keadaan mobil (KEH-94) |
| Driver, Kenek (Team Gudang) | Trip yang menugaskan dirinya, pasang titik toko (LOG-84); slip mingguannya sendiri (DRV-82) |
| Kepala Toko (Team Toko) | Foto absen cabangnya (KEH-20); ubah shift atau libur mendadak (KEH); rapor dan tugas timnya (KIN-48); tanggal dan status pengajuan timnya (KEH-80); Cek Aset tanpa nilai (KEU-118) |
| Kasir, Pramuniaga, Groomer (Team Toko) | Laporan muat, antar sendiri, penerimaan retur (LOG-84); Laporan Kasir kalau berhak lapor (KEU-118) |
| Semua karyawan | Data dirinya, slip dan kasbonnya sendiri, mengajukan, rapor dan tugasnya |

Dari sistem lama: Owner menjadi Pemilik, Helper menjadi Kenek, Admin
Supervisor tidak dibawa (tidak ada orangnya); GM, HR, dan Admin HR ditambah.

### Hak lihat pengajuan

Penyetuju dan pelihat tiap jenis pengajuan di Mesin Pengajuan (cara kerjanya:
PRI-37, Tahap 3E). Lampiran pribadi hanya untuk pengaju, penyetuju, HR, dan
pemilik (PRI-23).

Daftar lengkap 24 jenis (pengaju, penyetuju, pemeriksa, pelihat, lampiran, tertutup,
batas waktu, akibat terlewat) ada di `../work/specs/2026-10-14-daftar-lintas-modul.md` bab 1
(disetujui 14 Oktober 2026). Satu tempat saja, supaya tidak berbeda dengan spec (WAJ-10).
Perubahan nama: Klarifikasi menjadi Penjelasan, Keberatan selisih kasir menjadi
Keberatan kekurangan kas; Libur tidak lagi pengajuan (langsung berlaku, KEH-131).

## Menu

**Ditetapkan 13 Oktober 2026 (Tahap 3C).** Rancangan lengkap, contoh per
jabatan, dan jawaban pemilik: `../work/specs/2026-10-13-menu-desain.md`.
Gambarnya dibuat pemilik di Claude Design dari
`../work/desain/2026-10-13-brief-claude-design-menu.md`.

Cara kerja:

- Menu dibaca dari daftar hak akses (KAR-49, 71); isi menu tampil kalau
  orangnya punya paling sedikit satu tindakan di layar itu; kelompok kosong
  tidak tampil.
- Satu layar satu tempat di menu; mengisi dan memeriksa boleh dua layar
  (TAM-07). Urutan tetap. Angka penanda jumlah yang menunggu; tanda "Baru"
  (TAM-21); nomor versi di kaki menu (TAM-20).
- Layar baru tanpa tempat di menu = mesin pengaman gagal (KAR-63).

Susunan:

| Bagian | Isi |
|---|---|
| Semua orang | Beranda (perlu perhatian saya, pemberitahuan); Absen (yang diabsen); **Saya**: Profil & Akun, Jadwal & Kehadiran Saya, Pengajuan Saya (semua jenis, pilih jenis lalu isi; pelapis KEH-36), Perlu Dijelaskan, Pendapatan Saya, Kasbon Saya, Rapor & Tugas Saya, Serah Terima Saya, Lapor Masalah; **Panduan** (SIS-06) |
| Kerja Harian (lintas modul, pekerjaan lapangan) | Trip Saya, Laporan Kasir (mengisi), Laporan Muat, Antar Sendiri, Terima Retur, Laporan Promo, Laporan Bongkaran, Hitung Kas, Foto Absen Hari Ini |
| Kantor (per modul) | Persetujuan (semua pengajuan, Mesin Pengajuan); Karyawan; Kehadiran; Gaji; Logistik; Keuangan; Kinerja; Pengaturan; Sistem |
| Handphone | Bilah bawah: Beranda · Absen · tombol utama jabatan · Pemberitahuan · Menu. Tombol utama jabatan adalah pengaturan per jabatan; kalau kosong, Pengajuan Saya |

- Persetujuan Bonus, Pemeriksaan Buku Kas, dan Pemeriksaan Uang Pengiriman
  tetap di modulnya, dan ikut muncul di Beranda dengan angka penanda (M5).
- Menu **Pengumuman** di kelompok Kantor (HR, Admin HR, Pemilik, GM; 4B):
  konsep, menunggu persetujuan, terjadwal, terbit; tulis perubahan aturan
  (PRI-35); kirim pengumuman darurat (PRI-36); siapa sudah dan belum baca;
  ubah Panduan Karyawan. Panduan Karyawan dan "Apa yang baru" (dari nomor
  versi di kaki menu) milik Perlengkapan Bersama.
- Menu **Pengaturan** berisi angka dan aturan yang dibaca mesin (tarif, batas
  waktu, kategori, Pengaturan Jabatan, Daftar Pengecualian, Hak Akses Jabatan,
  Cabang & Jabatan). Daftar kerja harian (karyawan, data toko, supplier, produk
  promo, daftar rak) tetap di menu modulnya (M4; tafsiran PRI-32).
- Catatan pemilik tentang tab yang dobel tetap diisi di
  `../work/backlog/2026-10-11-susun-ulang-menu.md`.
