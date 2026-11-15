# Brief Claude Design: Menu dan Navigasi HRIS Hammielion v3

Tanggal: 13 Oktober 2026
Dipakai: ditempel atau dilampirkan di web Claude Design oleh pemilik.
Sumber keputusan: `../specs/2026-10-13-menu-desain.md` (Tahap 3C).
Lampirkan juga: `../../aturan/00-pola-baku-tampilan.md` (aturan tampilan TAM-01 s.d. 24).

---

## Teks yang ditempel ke Claude Design

Salin mulai dari garis ini sampai akhir file.

---

Tolong buatkan desain **menu dan navigasi** untuk aplikasi web HRIS
"Hammielion" (usaha petshop dengan beberapa cabang toko, satu gudang, dan
truk pengiriman). Semua tulisan di layar dalam **Bahasa Indonesia**.

### Siapa pemakainya

- Sekitar 25 karyawan: kasir, pramuniaga, groomer, kepala toko, driver,
  kenek, kepala gudang, dan orang kantor (finance, marketing, admin HR, GM).
- Kebanyakan **memakai handphone**, sering dengan sinyal lemah. Orang kantor
  memakai PC.
- Bukan orang teknis. Tulisan harus jelas dan tombol harus besar untuk jari.

### Aturan yang wajib diikuti

1. **Menu berbeda per orang.** Setiap orang hanya melihat menu yang menjadi
   haknya. Kelompok yang isinya kosong tidak tampil sama sekali.
2. **Urutan menu tetap.** Menu tidak berpindah menurut seringnya dipakai.
3. **Angka penanda** di samping menu: jumlah yang menunggu orang itu,
   misalnya "Persetujuan 4".
4. **Tanda "Baru"** kecil di menu yang baru ditambahkan.
5. **Nomor versi** (misalnya "v3.0.0 · Apa yang baru") di kaki menu.
6. **Mode terang dan mode gelap.** Tolong gambar keduanya.
7. **Rapi di PC dan handphone.** Di handphone tidak ada tulisan atau tombol
   yang terpotong, dan tidak ada geser ke samping.
8. **Satu layar, satu tugas.** Pekerjaan bertahap dibagi menjadi beberapa
   layar berurutan dengan tombol "Kembali" yang terlihat.
9. **Error** selalu tampil di jendela di tengah layar, yang hanya tertutup
   dengan tombol "OK, paham" (lihat lampiran aturan tampilan).

### Susunan menu lengkap

Kelompok dan isinya, berurutan dari atas:

```
BERANDA                     (semua orang)
ABSEN                       (yang diabsen; GM tidak)
SAYA                        (semua orang)
  Profil & Akun
  Jadwal & Kehadiran Saya
  Pengajuan Saya
  Perlu Dijelaskan
  Pendapatan Saya
  Kasbon Saya
  Rapor & Tugas Saya
  Serah Terima Saya
  Lapor Masalah
PANDUAN                     (semua orang)
  Panduan Karyawan
  Papan Perubahan Aturan
  Pedoman Lapor
KERJA HARIAN                (pekerjaan lapangan, menurut hak)
  Trip Saya
  Laporan Kasir
  Laporan Muat
  Antar Sendiri
  Terima Retur
  Laporan Promo
  Laporan Bongkaran
  Hitung Kas
  Foto Absen Hari Ini
KANTOR                      (orang kantor, menurut hak)
  Persetujuan
  Karyawan        > Daftar Karyawan, Pendaftaran Baru, Hak Tambahan yang Aktif
  Kehadiran       > Jadwal & Shift, Rekap Kehadiran, Betulkan Absen, QR Absen,
                    Serah Terima Tim, Laporan Masalah (hanya GM dan pemilik)
  Gaji            > Periode Slip, Jadwal Bayar, Persetujuan Bonus, Potongan,
                    Denda Driver & Kenek, Bongkaran, Kasbon,
                    Dana Disiplin & Dana Tidak Hadir, Total Diterima per Orang
  Logistik        > Dashboard Logistik, Surat Jalan, Rencana & Trip, Tertunda,
                    Retur, Pemeriksaan Uang Pengiriman, Data Toko, Bensin,
                    Keadaan Mobil, Laporan Logistik
  Keuangan        > Keuangan Hari Ini, Buku Kas, Pemeriksaan,
                    Periksa Laporan Kasir, Utang Supplier, Toko & Gudang,
                    Tagihan Rutin, Piutang Lain, Aset & Buku Ibu, Cek Modal,
                    Laporan & Tutup Bulan
  Kinerja         > Rapor, Tugas, Penjualan Promo, Catatan Rapat
  Pengaturan      > dikelompokkan per modul
  Sistem          > Kesehatan Mesin, Riwayat Error, Jejak Perubahan,
                    Riwayat Masuk, Lihat sebagai
```

### Contoh menu per orang

| Orang | Yang tampil |
|---|---|
| Kasir | Beranda, Absen, Saya, Panduan, Kerja Harian (Laporan Kasir, Laporan Muat, Antar Sendiri, Terima Retur, Laporan Promo) |
| Driver | Beranda, Absen, Saya, Panduan, Kerja Harian (Trip Saya) |
| Kepala Toko | Seperti kasir, ditambah Foto Absen Hari Ini; Kantor: Kehadiran (Jadwal & Shift cabangnya), Kinerja (Rapor, Tugas timnya) |
| Finance | Beranda, Absen, Saya, Panduan; Kantor: Persetujuan, Gaji (sebagian), Logistik (Pemeriksaan Uang Pengiriman), Keuangan (tanpa Keuangan Hari Ini dan laporan) |
| GM | Semua menu, tanpa Absen |

### Handphone

- **Bilah bawah tetap, 5 tombol:** Beranda · Absen · [tombol utama
  jabatan] · Pemberitahuan · Menu.
- Tombol utama berbeda per jabatan: driver "Trip Saya", kasir "Laporan
  Kasir", finance "Persetujuan". Kalau tidak diatur: "Pengajuan Saya".
- Untuk yang tidak diabsen (GM), tombol Absen tidak ada; bilahnya 4 tombol.
- "Menu" membuka susunan lengkap (lembar dari bawah atau layar penuh) dengan
  kelompok yang bisa dibuka-tutup.

### PC

- Menu samping di kiri, kelompok bisa dibuka-tutup, menu yang sedang dibuka
  disorot.
- Di atas: nama orang, jabatan, dan cabang; tombol mode terang/gelap; tombol
  keluar.

### "Lihat sebagai"

GM bisa melihat aplikasi seperti yang dilihat karyawan tertentu (hanya
melihat, semua tombol simpan mati). Selama dipakai ada **bilah berwarna
mencolok di atas layar**: "Sedang melihat sebagai: Rina (Kasir, Toko Pusat) ·
Hanya melihat · [Keluar]". Menu yang tampil adalah menu orang itu.

### Alur Pengajuan Saya (3 layar)

1. **Daftar pengajuan saya**: kartu per pengajuan dengan status (Menunggu,
   Disetujui, Ditolak) dan tombol besar "Ajukan".
2. **Pilih jenis**: tombol besar per jenis (Libur, Tukar Libur, Izin, Sakit,
   Cuti, Klaim Lembur, Kasbon, Ubah Data Diri). Hanya jenis yang menjadi hak
   orang itu yang tampil.
3. **Isian** khas jenis itu, lalu tombol "Kirim".

### Yang tolong digambar

1. PC, mode terang: menu samping lengkap milik **GM**, dengan layar Beranda
   berisi daftar "perlu perhatian" (misalnya 4 pengajuan menunggu, 2 laporan
   kasir belum diperiksa, 1 trip belum ditutup).
2. Handphone, mode terang: **Kasir**. Beranda dengan bilah bawah, lalu layar
   Menu terbuka.
3. Handphone, mode gelap: **Driver**. Beranda dengan bilah bawah (tombol
   utama "Trip Saya").
4. Handphone: tiga layar alur **Pengajuan Saya**.
5. Handphone: bilah **"Lihat sebagai"** di atas layar.

Gambar kasar sebagai pegangan (bukan desain akhir):

```
PC (GM)
+----------------------+------------------------------------------+
| HAMMIELION           |  Nadia · GM · Office      [☀/☾] [Keluar] |
|----------------------|------------------------------------------|
| ⌂ Beranda        7   |  Perlu perhatian saya                    |
|                      |  ┌────────────────────────────────────┐  |
| SAYA            ▸    |  │ 4 pengajuan menunggu      [Buka]   │  |
| PANDUAN         ▸    |  │ 2 Laporan Kasir belum diperiksa    │  |
|                      |  │ 1 trip belum ditutup               │  |
| KANTOR               |  └────────────────────────────────────┘  |
|  ✓ Persetujuan   4   |                                          |
|  Karyawan       ▸    |                                          |
|  Kehadiran      ▸    |                                          |
|  Gaji           ▾    |                                          |
|    Periode Slip      |                                          |
|    Jadwal Bayar  2   |                                          |
|    Persetujuan Bonus |                                          |
|    ...               |                                          |
|  Logistik       ▸    |                                          |
|  Keuangan       ▸    |                                          |
|  Kinerja        ▸    |                                          |
|  Pengaturan     ▸    |                                          |
|  Sistem         ▸    |                                          |
|----------------------|                                          |
| v3.0.0 · Apa yg baru |                                          |
+----------------------+------------------------------------------+

Handphone (Kasir)            Menu dibuka
+------------------------+   +------------------------+
| Hammielion     Rina ☰  |   | Menu               ✕   |
|------------------------|   |------------------------|
| Perlu perhatian        |   | SAYA                ▾  |
| ┌────────────────────┐ |   |  Profil & Akun         |
| │ Laporan Kasir shift│ |   |  Jadwal & Kehadiran    |
| │ pagi belum diisi   │ |   |  Pengajuan Saya        |
| └────────────────────┘ |   |  Perlu Dijelaskan   1  |
| ┌────────────────────┐ |   |  Pendapatan Saya       |
| │ 1 perlu dijelaskan │ |   |  ...                   |
| └────────────────────┘ |   | KERJA HARIAN        ▾  |
|                        |   |  Laporan Kasir         |
|                        |   |  Laporan Muat          |
|------------------------|   |  Laporan Promo   Baru  |
| ⌂    ◎    ▤    🔔   ☰  |   | PANDUAN             ▸  |
|Beranda Absen Lap.Kasir |   |------------------------|
|      Pemberitahuan Menu|   | v3.0.0 · Apa yg baru   |
+------------------------+   +------------------------+

Pengajuan Saya (3 layar)
+------------------+  +------------------+  +------------------+
| ← Pengajuan Saya |  | ← Pilih jenis    |  | ← Izin           |
|------------------|  |------------------|  |------------------|
| Izin 14 Okt      |  | [ Libur        ] |  | Tanggal  [____]  |
|   Menunggu       |  | [ Tukar Libur  ] |  | Alasan   [____]  |
| Kasbon Rp500.000 |  | [ Izin         ] |  | Lampiran [Foto]  |
|   Disetujui      |  | [ Sakit        ] |  |                  |
|                  |  | [ Cuti         ] |  |                  |
|                  |  | [ Klaim Lembur ] |  |                  |
| [   + Ajukan   ] |  | [ Kasbon       ] |  | [     Kirim    ] |
+------------------+  +------------------+  +------------------+
```

Nama dan angka di gambar hanya contoh.

---

## Catatan untuk pemilik (tidak perlu ditempel)

- Saran urutan dari sesi sebelumnya: buat **sistem desain** dulu (warna,
  huruf, tombol, jendela error) dengan melampirkan `00-pola-baku-tampilan.md`,
  baru menu ini. Kalau sistem desain sudah ada, pilih sistem desain itu saat
  membuat desain menu.
- Setelah jadi, kirim **tautan hasilnya** ke Claude di sesi v3 supaya dicatat
  dan dicocokkan dengan aturan menu.
- Layar isi tiap modul (slip, Buku Kas, trip, dan seterusnya) belum digambar.
  Itu menunggu spec modulnya di Tahap 4.
