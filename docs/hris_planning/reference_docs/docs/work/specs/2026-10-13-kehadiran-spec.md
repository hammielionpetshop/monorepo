# Spec Siap Bangun: Kehadiran (Tahap 4D)

Tanggal: 13 Oktober 2026
Status per bagian:

| Bagian | Isi | Status |
|---|---|---|
| **4D-1** | Jam dan Jadwal | **Disetujui penuh 13 Oktober 2026** (J1 s.d. J6 sesuai saran, bagian 13) |
| 4D-2 | Absen Harian (dipecah tiga, disetujui 13 Oktober 2026) | **4D-2a Absen dan Istirahat: disetujui penuh 13 Oktober 2026** (A1 s.d. A6 sesuai saran, KEH-108 s.d. 113, 6 layar KEH-L06 s.d. L11); **4D-2b Tinjau, Koreksi, dan Catatan Hari: disetujui penuh 13 Oktober 2026** (T1, T2, K1, K2, S1, R1 sesuai saran, KEH-114 s.d. 119, 6 layar KEH-L12 s.d. L17); **4D-2c Absen lewat Trip: disetujui penuh 13 Oktober 2026** (E1 s.d. E5 sesuai saran, KEH-120 s.d. 124, 2 layar KEH-L18 dan L19) |
| 4D-3 | Laporan Pulang | **Disetujui penuh 13 Oktober 2026** (L1 s.d. L6 sesuai saran, KEH-125 s.d. 130, 6 layar KEH-L20 s.d. L25) |
| 4D-4 | Tidak Masuk (dipecah dua, disetujui 13 Oktober 2026) | **4D-4a Libur dan Tukar: disetujui penuh 13 Oktober 2026** (L1 s.d. L9 sesuai saran, KEH-131 s.d. 139, 4 layar KEH-L26 s.d. L29); **4D-4b Izin, Sakit, dan Cuti: disetujui penuh 13 Oktober 2026** (M1 s.d. M9 sesuai saran, KEH-140 s.d. 149, 5 layar KEH-L30 s.d. L34 dan satu tab di L27) |
| 4D-5 | Perlu Dijelaskan dan Lembur (dipecah dua, disetujui 13 Oktober 2026) | **4D-5a Perlu Dijelaskan: disetujui penuh 13 Oktober 2026** (P1 s.d. P9 sesuai saran, KEH-150 s.d. 158, 5 layar KEH-L35 s.d. L39); **4D-5b Lembur: disetujui penuh 13 Oktober 2026** (E1 s.d. E8 sesuai saran, KEH-159 s.d. 167, 4 layar KEH-L40 s.d. L43) |

Spec ini satu file untuk seluruh 4D. Tiap bagian (4D-2 s.d. 4D-5) **menambah
baris** ke tabel di bagian 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, dan 13, dan
memberi tanda bagiannya di kolom "Bagian". Bagian 3 (rincian layar) ditulis
per sub-bagian.

Bahan: KEH-01 s.d. 12, 79, 82 (dan pelapis baru KEH-102 s.d. 107); 4D-2a: KEH-10 s.d. 13, 15 s.d. 18, 21, 22, 26, 27, 83 s.d. 88 (dan pelapis baru KEH-108 s.d. 113); 4D-2b: KEH-14, 19 s.d. 25, 28 s.d. 30, 68, 76, 77, 81 (dan pelapis baru KEH-114 s.d. 119); KAR-25, 62,
67, 82; KAR-L30, L31 di `2026-10-13-karyawan-dan-akses-spec.md`; PRI-01, 02,
07, 10, 11, 17, 18, 26, 31 s.d. 35, 41; TAM-01 s.d. 07, 12 s.d. 17, 22 s.d.
25; GAJ-14; BER-L40, L41 di `2026-10-13-perlengkapan-bersama-spec.md`;
`2026-10-13-menu-desain.md`.

Bentuk spec mengikuti bagian 0 `2026-10-13-karyawan-dan-akses-spec.md`. Kode
layar memakai awalan **KEH-L**. Tampilan disusun dari komponen baku
(`../desain/README.md`); tidak digambar.

---

## 1. Batas

**Dikerjakan di 4D-1:** jam kerja cabang (termasuk istirahat per shift dan jam
tutup kantor), shift dan giliran tiap Senin, kelompok giliran, titik absen dan
radius, QR cabang, hari tutup, layar "Jadwal Saya", dan pintu baca jam buka
cabang untuk Tarik Data Kasir.

**Tidak dikerjakan di 4D-1:**

| Hal | Di mana |
|---|---|
| Layar Absen, istirahat, perbantuan (sisi karyawan dan daftar) | **4D-2a** (selesai) |
| Koreksi, tinjau luar titik, pola lokasi mencurigakan, Foto Absen Hari Ini, catatan hari kerja dan statusnya, rekap, tampil telat dan pulang cepat | 4D-2b (sudah ditulis, bagian 3.3) |
| Absen lewat trip (Berangkat, foto awak, Tidak jalan, trip ditutup kantor) | 4D-2c (sudah ditulis, bagian 3.4) |
| Laporan Pulang, serah terima, laporan masalah, keadaan mobil | 4D-3 (sudah ditulis, bagian 3.5) |
| Pilih jadwal libur, tukar libur dan shift, kalender libur, masuk di hari libur | 4D-4a (sudah ditulis, bagian 3.6) |
| Izin, sakit, cuti | 4D-4b (sudah ditulis, bagian 3.7) |
| Alpha otomatis, klarifikasi (Perlu Dijelaskan), denda lupa absen | 4D-5a (sudah ditulis, bagian 3.8) |
| Lembur (deteksi, klaim, pengesahan, tiga angka di rekap) | 4D-5b (sudah ditulis, bagian 3.9) |
| Titik lokasi cabang (data dan layar mengubahnya) | Karyawan, KAR-L30 (modul ini hanya membaca) |
| Pengaturan jabatan (kena telat, wajib istirahat, penjaga) | Karyawan, KAR-L31 |
| Nominal potongan telat, denda, upah | Gaji (4E) |
| Mesin pengajuan (status, penyetuju) | Perlengkapan Bersama (4B) |
| Tarik data kasir | 4C (hanya memakai pintu baca jam buka dari modul ini) |

---

## 2. Daftar layar

| Kode | Layar | Letak di menu | Dipakai | Ukuran utama | Bagian |
|---|---|---|---|---|---|
| KEH-L01 | Jam Kerja Cabang | Pengaturan › Kehadiran | Lihat: HR, Admin HR, Pemilik, GM. Ubah: HR, Pemilik, GM (KEH-04) | PC | 4D-1 |
| KEH-L02 | Jadwal & Shift | Kehadiran › Jadwal & Shift | Kepala Toko (cabangnya), Kepala Gudang (departemennya), HR, Pemilik, GM | PC | 4D-1 |
| KEH-L03 | Lokasi & QR Cabang | Kehadiran › QR Absen | HR, Pemilik, GM | PC | 4D-1 |
| KEH-L04 | Hari Tutup | Kehadiran › Jadwal & Shift | HR, Pemilik, GM | PC | 4D-1 |
| KEH-L05 | Jadwal Saya | Saya › Jadwal & Kehadiran Saya | Semua yang diabsen | HP | 4D-1 |
| KEH-L06 | Absen | Bilah bawah › Absen | Semua yang diabsen dan bukan dibayar per ritase (KEH-96) | HP | 4D-2a |
| KEH-L07 | Langkah Absen (pindai, lokasi, foto, konfirmasi) | Dari KEH-L06 | Sama dengan KEH-L06 | HP | 4D-2a |
| KEH-L08 | Perbantuan atau Salah Scan | Muncul setelah pindai QR cabang lain | Sama dengan KEH-L06 | HP | 4D-2a |
| KEH-L09 | Istirahat dan Masuk Kembali | Dari KEH-L06 | Sama dengan KEH-L06 | HP | 4D-2a |
| KEH-L10 | Sudah Pindah Cabang? | Muncul saat absen pulang hari kerja ke-7 di cabang lain | Orang yang diabsen | HP | 4D-2a |
| KEH-L11 | Daftar Perbantuan | Kehadiran › Perbantuan | Kepala Toko (cabangnya), Kepala Gudang, HR, Admin HR, Pemilik, GM | PC | 4D-2a |
| KEH-L12 | Tinjau Absen | Kehadiran › Tinjau Absen | Memutuskan: HR, Pemilik, GM. Melihat: Admin HR, Kepala Toko (cabangnya), Kepala Gudang | PC | 4D-2b |
| KEH-L13 | Koreksi Absen (satuan dan banyak orang) | Kehadiran › Koreksi Absen | HR, Pemilik, GM. Riwayat: juga Admin HR dan Finance (hanya melihat) | PC | 4D-2b |
| KEH-L14 | Foto Absen Hari Ini | Kehadiran › Foto Absen Hari Ini | Kepala Toko (cabangnya), Kepala Gudang (departemennya), HR, Pemilik, GM | PC dan HP | 4D-2b |
| KEH-L15 | Catatan Hari Kerja | Kehadiran › Catatan Hari | HR, Admin HR, Finance, Pemilik, GM; Kepala Toko dan Kepala Gudang (lingkupnya) | PC | 4D-2b |
| KEH-L16 | Rekap Kehadiran | Kehadiran › Rekap | Sama dengan KEH-L15 | PC | 4D-2b |
| KEH-L17 | Kehadiran Saya | Saya › Jadwal & Kehadiran Saya | Semua yang diabsen | HP | 4D-2b |
| KEH-L18 | Absen Trip Saya | Bilah bawah › Absen (untuk yang dibayar per ritase) | Driver, kenek yang dibayar per ritase | HP | 4D-2c |
| KEH-L19 | Absen Trip Hari Ini | Kehadiran › Absen Trip | Kepala Gudang, HR, Pemilik, GM; Admin HR dan Finance melihat tanpa foto | PC | 4D-2c |
| KEH-L20 | Laporan Pulang (berurutan) | Muncul setelah Kirim di KEH-L07 (Pulang); bisa dilanjutkan dari KEH-L06 dan dari layar trip Logistik (driver) | Semua yang absen pulang dengan QR; driver per trip | HP | 4D-3 |
| KEH-L21 | Serah Terima Saya (daftar dan jendela baca) | Saya › Serah Terima Saya; jendela muncul setelah absen masuk | Semua yang diabsen | HP | 4D-3 |
| KEH-L22 | Serah Terima Tim | Kehadiran › Serah Terima Tim | Kepala Toko (cabangnya), Kepala Gudang (departemennya), HR, GM, Pemilik | PC | 4D-3 |
| KEH-L23 | Lapor Masalah (kirim dan statusnya) | Saya › Lapor Masalah; juga langkah 2 di KEH-L20 | Semua yang diabsen dan driver per ritase | HP | 4D-3 |
| KEH-L24 | Laporan Masalah (rahasia) | Kehadiran › Laporan Masalah | GM, Pemilik (laporan menyangkut GM: hanya Pemilik) | PC | 4D-3 |
| KEH-L25 | Keadaan Mobil | Logistik › Keadaan Mobil | Kepala Gudang, Finance, Pemilik, GM; driver melihat statusnya sendiri di KEH-L18 | PC | 4D-3 |
| KEH-L26 | Pilih Libur (jatah periode, memilih terlambat, libur pengganti) | Saya › Jadwal & Kehadiran Saya › Pilih Libur | Semua yang punya jatah libur (bukan per ritase, bukan jabatan libur tidak tetap, bukan GM) | HP | 4D-4a |
| KEH-L27 | Libur Cabang (kalender, belum memilih, laporan tukar, ubah langsung, cabut) | Kehadiran › Libur Cabang | Ubah langsung: Kepala Toko (cabangnya), Kepala Gudang (departemennya), HR, Pemilik, GM. Cabut: HR, Pemilik, GM. Melihat: Admin HR | PC | 4D-4a |
| KEH-L28 | Tukar Libur dan Shift (ajak teman, ajakan untuk saya) | Pengajuan Saya › Tukar | Semua yang punya jadwal | HP | 4D-4a |
| KEH-L29 | Minta Masuk di Hari Libur | Kehadiran › Libur Cabang › Minta Masuk | Kepala Toko (cabangnya), Kepala Gudang (departemennya), HR, Pemilik, GM | PC | 4D-4a |
| KEH-L30 | Ajukan Izin, Sakit, atau Cuti (isian khas BER-L06) | Pengajuan Saya › Ajukan (BER-L05) | Semua yang diabsen lewat QR; tidak tampil untuk yang dibayar per ritase (KEH-96; hari tidak jalan, KEH-81) dan GM (KAR-67) | HP | 4D-4b |
| KEH-L31 | Sisa Cuti Saya | Saya › Jadwal & Kehadiran Saya › Sisa Cuti | Semua yang punya jatah cuti (bukan per ritase, bukan GM) | HP | 4D-4b |
| KEH-L32 | Susulkan Surat Dokter | Pengajuan Saya › kartu sakit "Surat menyusul" | Pengaju sakit dengan surat menyusul | HP | 4D-4b |
| KEH-L33 | Keterangan Pembantu Putusan (di dalam BER-L21) | Persetujuan › Putuskan pengajuan izin, sakit, atau cuti | Memutuskan: HR, Pemilik, GM. Foto surat: hanya mereka | PC | 4D-4b |
| KEH-L34 | Isikan Pengajuan atas Nama | Kehadiran › Isikan Pengajuan | HR, Pemilik, GM (bukan untuk dirinya) | PC | 4D-4b |
| KEH-L35 | Perlu Dijelaskan (daftar kejadian saya) | Saya › Perlu Dijelaskan | Semua yang diabsen lewat QR; tidak tampil untuk yang dibayar per ritase dan GM | HP | 4D-5a |
| KEH-L36 | Isi Penjelasan (juga pengajuan terlambat untuk lupa absen) | Dari KEH-L35 | Sama dengan KEH-L35 | HP | 4D-5a |
| KEH-L37 | Perlu Dijelaskan Tim (belum dijelaskan, hampir lewat batas, tidak masuk berturut-turut) | Kehadiran › Perlu Dijelaskan | HR, Pemilik, GM; Admin HR melihat; Kepala Toko (cabangnya) dan Kepala Gudang (departemennya) melihat jenis, tanggal, dan sisa waktu | PC | 4D-5a |
| KEH-L38 | Keterangan Pembantu Putusan Penjelasan (di dalam BER-L21) | Persetujuan › Putuskan penjelasan | Memutuskan: HR, Pemilik, GM. Foto surat: hanya mereka | PC | 4D-5a |
| KEH-L39 | Laporan Kebiasaan Lupa Absen | Kehadiran › Laporan Kebiasaan | Pemilik, GM | PC | 4D-5a |
| KEH-L40 | Ini Lembur? (jendela setelah Laporan Pulang) | Muncul sesudah KEH-L20 terkirim; bisa dibuka lagi dari KEH-L41 | Semua yang diabsen QR dan berjabatan "dapat lembur" | HP | 4D-5b |
| KEH-L41 | Lembur Saya (daftar dan langkah klaim) | Saya › Lembur Saya | Sama dengan KEH-L40 | HP | 4D-5b |
| KEH-L42 | Lembur Tim (belum diklaim, hampir hangus, menunggu, hangus) | Kehadiran › Lembur | HR, Pemilik, GM; Admin HR melihat tanpa foto; Kepala Toko (cabangnya) dan Kepala Gudang (departemennya) melihat tanpa foto dan penyuruh | PC | 4D-5b |
| KEH-L43 | Keterangan Pembantu Putusan Klaim Lembur (di dalam BER-L21) | Persetujuan › Putuskan klaim lembur | Memutuskan: HR, Pemilik, GM. Foto dan penyuruh: hanya mereka | PC | 4D-5b |

Jumlah di 4D-1: 5 layar; di 4D-2a: 6 layar (KEH-L06 s.d. L11); di 4D-2b: 6 layar (KEH-L12 s.d. L17); di 4D-2c: 2 layar (KEH-L18, L19); di 4D-3: 6 layar (KEH-L20 s.d. L25); di 4D-4a: 4 layar (KEH-L26 s.d. L29); di 4D-4b: 5 layar (KEH-L30 s.d. L34) dan satu tab baru "Tidak masuk" di KEH-L27; di 4D-5a: 5 layar (KEH-L35 s.d. L39); di 4D-5b: 4 layar (KEH-L40 s.d. L43). Angka seperti radius, toleransi telat, jatah libur
tidak punya layar sendiri: diubah lewat kerangka Pengaturan 4B (BER-L40, L41).

---

## 3. Rincian layar

Berlaku untuk semua layar: error di jendela "OK, paham"; tombol simpan terkunci
sampai selesai; isian tidak hilang kalau sinyal putus; daftar dibagi per
halaman dan bisa dicari (PRI-10); periode lama baru dimuat saat diminta
(PRI-11); jam dari server (PRI-01).

### 3.1 Bagian 4D-1: Jam dan Jadwal

#### KEH-L01. Jam Kerja Cabang

- **Tujuan:** menetapkan jam kerja tiap cabang, per shift, bertanggal berlaku.
- **Isi:** daftar cabang aktif; pilih cabang untuk melihat shift yang berlaku
  sekarang dan yang akan berlaku. Per shift: nama, jam masuk, jam pulang,
  **lama istirahat** dan **rentang jam mulai istirahat** (kosong = istirahat
  tidak berlaku di shift itu, KEH-82), tanggal mulai dan akhir berlaku. Di bawahnya:
  **jam tutup toko** ditampilkan sebagai hasil turunan (jam pulang shift
  terakhir, tidak disimpan terpisah, KEH-71) dan, khusus cabang yang tidak
  punya shift terakhir (kantor), isian **jam tutup kantor** (paling lambat
  20.00).
- **Langkah mengubah (4 langkah, TAM-07):**
  1. Pilih shift yang diubah atau **Tambah shift**.
  2. Isi jam masuk, jam pulang, lama istirahat dan rentang mulainya (boleh
     kosong).
  3. Isi **tanggal berlaku** dan alasan.
  4. Periksa: sistem menyebut berapa orang yang terkena, contoh akibatnya
     ("masuk 08.00 menjadi 09.00; telat dihitung dari 09.05"), dan menyiapkan
     draf pengumuman (PRI-35 butir 2); tanggal berlaku mengikuti jarak
     PRI-35 butir 4, kecuali darurat (PRI-36).
- **Aturan:** jam kerja yang sudah dipakai tidak berubah mundur (KEH-02);
  tidak bisa dihapus, hanya dinonaktifkan (KEH-03); cabang aktif wajib punya
  paling sedikit satu jam kerja; menonaktifkan shift yang masih dipakai
  giliran ditolak dan pesannya menyebut siapa saja yang memakainya (seperti
  KAR-27).
- **Tombol:** Tambah shift, Ubah, Nonaktifkan (konfirmasi biasa), Kembali di
  tiap langkah (TAM-14), Ulangi dari awal.
- **Beda jabatan:** Admin HR hanya melihat; Kepala Toko dan Kepala Gudang tidak
  memakai layar ini (mereka melihat jam kerja cabangnya di KEH-L05).
- **Pesan:** "Jam kerja baru berlaku mulai 1 November. Absen sebelum tanggal
  itu tetap dihitung dengan jam yang lama."

#### KEH-L02. Jadwal & Shift

- **Tujuan:** melihat dan mengatur siapa bekerja di shift apa, per minggu.
- **Isi:** pilih cabang (Kepala Toko dan Kepala Gudang langsung ke cabangnya)
  dan minggu (bawaan: minggu ini; minggu depan dan lalu satu ketukan;
  lebih lama dimuat saat diminta). Tabel: baris = orang, kolom = Senin sampai
  Minggu; sel = nama shift dan jam, atau **Libur** (datang dari 4D-4), atau
  **Hari tutup**. Bagian **Kelompok**: kelompok pagi dan siang beserta
  anggotanya, dan tanda "digilir otomatis Senin depan".
- **Cabang satu shift:** tidak digilir; layar menyebut "satu shift, tidak
  digilir" (KEH-06).
- **Mengisi giliran awal (sekali, KEH-102):** muncul hanya selama kelompok
  belum diisi: pilih anggota tiap kelompok (cabang berjumlah ganjil: kepala
  cabang menentukan sendiri komposisi, KEH-06) lalu **Simpan kelompok**.
  Sesudahnya mesin yang menggilir; tombol ini hilang.
- **Orang baru atau pindah (KEH-103):** orangnya muncul di tabel dengan kelompok
  dan shift minggu berjalan yang dipilih saat ditempatkan (KAR-L22). Kalau
  masih kosong: sel bertanda **Shift belum ditentukan**, dan pilihnya bisa
  diisi dari sel itu oleh kepala cabang atau HR.
- **Ubah langsung (mendadak, KEH-45):** ketuk sel → pilih shift → alasan
  wajib → Simpan. Orangnya diberi tahu, perubahannya tercatat (siapa, kapan,
  alasan, nilai lama). Perubahan libur memakai layar milik 4D-4.
- **Tombol:** Simpan kelompok, Ubah (per sel), Kembali, Ulangi dari awal.
- **Beda jabatan:** Kepala Toko hanya cabangnya; Kepala Gudang hanya
  departemennya; HR, Pemilik, GM semua cabang; karyawan biasa tidak melihat
  layar ini (memakai KEH-L05).

#### KEH-L03. Lokasi & QR Cabang

- **Tujuan:** mengatur radius absen dan mengelola QR cabang.
- **Isi per cabang:** peta kecil titik lokasi (dibaca dari KAR-L30; tombol
  **Ubah titik** membawa ke KAR-L30 bagi yang berhak), **radius** dalam meter
  (awal 100, KEH-78), riwayat radius, QR aktif (nama cabang, kapan dibuat, oleh
  siapa), dan tanda kalau cabang belum punya titik ("absen di cabang ini
  belum bisa dipakai").
- **Mengubah radius:** hanya Pemilik dan GM (KEH-104); tanggal berlaku;
  alasan; periksa menyebut "di titik dan radius baru, sekian absen 30 hari terakhir
  akan ditandai perlu ditinjau"; GM diberi tahu.
- **Cetak QR:** pratinjau dengan nama cabang; tombol **Cetak**. Hanya QR aktif.
- **Buat ulang QR:** tombol **ditahan 3 detik** (TAM-15, karena QR lama
  langsung mati, KEH-11); jendela konfirmasi menyebut "QR lama tidak bisa
  dipakai lagi; cetak dan tempel yang baru sekarang". Siapa pun yang memindai
  QR lama mendapat pesan "QR ini sudah tidak berlaku, minta yang baru ke
  kepala cabang" (TAM-03).
- **Beda jabatan:** HR bisa melihat, mencetak, dan membuat ulang QR tetapi
  tidak mengubah radius. Kepala cabang tidak memakai layar ini.

#### KEH-L04. Hari Tutup

- **Tujuan:** menandai tanggal sebuah cabang, atau semua cabang, tutup.
- **Isi:** daftar hari tutup (mendatang di atas, lalu yang sudah lewat):
  tanggal, cabang atau "semua cabang", alasan, siapa memasang dan kapan,
  tanda **Dipasang mundur**.
- **Memasang (3 langkah):** (1) pilih cabang atau semua, satu tanggal atau
  rentang; (2) alasan; (3) periksa: berapa orang terkena; **kalau tanggalnya
  sudah lewat**, sistem menyebut berapa orang yang tadinya alpha lalu menjadi
  Hari tutup, dan menolak kalau slip periodenya sudah ditutup (KEH-105).
- **Akibat:** tidak ada yang ditandai alpha di cabang itu pada hari itu, jatah
  4 hari libur tidak berkurang, hari itu dibayar (KEH-79, GAJ-14). Orang di
  cabang itu diberi tahu lewat Papan (pengumuman otomatis, bisa disunting).
- **Membatalkan:** hari tutup yang tanggalnya belum lewat, atau yang slipnya
  belum ditutup; alasan wajib; tidak dihapus, berstatus **Dibatalkan**
  (PRI-02). Alpha yang sempat dihapus kembali dihitung ulang oleh mesin.
- **Beda jabatan:** HR, Pemilik, GM. Finance dan kepala cabang hanya melihat.

#### KEH-L05. Jadwal Saya

- **Tujuan:** setiap orang melihat jam kerjanya sendiri tanpa bertanya.
- **Isi (HP, TAM-12):** kepala "Minggu ini" dengan tujuh kartu hari: shift dan
  jam, **Libur**, **Hari tutup**, atau **Tidak masuk** (izin, sakit, cuti; rincian
  hanya untuk dirinya sendiri, KEH-42). Tombol **Minggu depan**. Di bawahnya:
  jam kerja cabang dan, kalau ada, lama istirahat.
- **Teman satu cabang (KEH-107):** tombol **Lihat teman**: daftar nama teman
  **satu cabang** dengan shift dan hari libur atau tidak masuk per hari; tanpa
  alasan, tanpa lampiran, tanpa cabang lain. Dipakai untuk memilih teman
  tukar (4D-4).
- **Beda jabatan:** tidak tampil untuk yang tidak diabsen (GM, KAR-67). Orang
  yang dibayar per ritase hanya melihat hari tutup (KEH-96, tidak punya shift).
- **Bentuk yang belum ada komponennya:** **tabel minggu** (orang × tujuh hari,
  KEH-L02) dan **strip tujuh hari** untuk handphone (KEH-L05). Keduanya
  ditambahkan ke komponen baku saat dibangun (`../desain/README.md`).

### 3.2 Bagian 4D-2a: Absen dan Istirahat

Berlaku untuk KEH-L06 s.d. L10: semua di HP (360 px, tombol 48 px, TAM-12);
jam selalu jam server (PRI-01); tidak ada yang bisa mengubah catatan absen
setelah terkirim (KEH-16); kalau sinyal putus sebelum terkirim, tidak ada yang
tercatat dan layar berkata "Belum terkirim. Coba lagi" (jam tidak bisa
dikirim dari handphone, jadi absen tanpa sinyal tidak ada).

#### KEH-L06. Absen

- **Tujuan:** satu layar untuk semua absen hari ini.
- **Isi:** nama cabang dan shift hari ini (dari KEH-L05), keadaan sekarang
  ("Belum masuk", "Sudah masuk 08.02", "Sedang istirahat sejak 12.10", "Sudah
  pulang 17.05"), dan **tombol berlabel** yang berlaku saat ini saja (KEH-17,
  83):

| Keadaan | Tombol yang tampil |
|---|---|
| Belum masuk, dalam waktu absen (KEH-111) | **Masuk** |
| Terlalu pagi (lebih dari 2 jam sebelum jam masuk) | Tidak ada; pesan "Absen baru bisa dibuka mulai 06.00" |
| Sudah masuk, shift punya istirahat, orangnya wajib istirahat, belum istirahat, dalam rentang mulai | **Istirahat** dan **Pulang** |
| Sudah masuk, di luar rentang istirahat atau tidak wajib istirahat | **Pulang** |
| Sedang istirahat | **Masuk Kembali** (Pulang tidak tampil; lupa Masuk Kembali dihitung lupa absen, KEH-87) |
| Sudah masuk kurang dari 15 menit | Pulang tampil abu-abu dengan tulisan "Bisa mulai 08.17" (KEH-17) |
| Sudah pulang | Tidak ada; pesan "Sampai besok" |
| Hari tutup atau libur terjadwal (KEH-113) | Tidak ada; pesan "Hari ini cabang tutup" atau "Hari ini jadwal libur Anda" |
| Cabang belum punya titik lokasi (KAR-25) | Tidak ada; pesan "Absen di cabang ini belum bisa dipakai. Hubungi HR" |

- **Aturan:** pertanyaan "masuk atau pulang?" tidak ada (KEH-108). Tombol Pulang
  tidak tampil sebelum ada absen masuk. Tombol tidak pernah menebak dari
  urutan scan.
- **Beda jabatan:** tidak tampil untuk GM (KAR-67) dan orang yang dibayar per
  ritase (KEH-96; mereka mendapat layar di 4D-2c). Kalau lupa absen, jalannya
  lewat "Perlu Dijelaskan" (4D-5), bukan layar ini.
- **Pesan:** "Absen masuk Anda tercatat pukul 08.02 di Hammielion Pusat."

#### KEH-L07. Langkah Absen

- **Tujuan:** mengambil absen Masuk, Masuk Kembali, dan Pulang dengan urutan
  yang tidak bisa diacak (KEH-13).
- **Langkah (4 langkah, TAM-07):**
  1. **Pindai QR** cabang. QR yang sudah mati: "QR ini sudah tidak berlaku,
     minta yang baru ke kepala cabang" (KEH-11). QR cabang lain: lanjut ke
     KEH-L08 sebelum langkah berikutnya (KEH-109).
  2. **Lokasi** diperiksa server. Izin lokasi ditolak atau layanan lokasi
     mati: pesan "Nyalakan lokasi lalu coba lagi" dan jalan keluar
     "Handphone bermasalah? Hubungi HR" (KEH-30). Di dalam radius: lanjut.
     **Di luar radius: tetap lanjut**, dengan peringatan "Anda di luar titik
     absen. Absen tetap dicatat dan akan ditinjau HR" (KEH-14); percobaan
     dicatat apa pun hasilnya (KEH-12).
  3. **Foto** diri: kamera langsung saja, tanpa galeri (KEH-15). Foto
     berstempel nama, jam server, cabang, titik, jarak.
  4. **Konfirmasi:** ringkasan (jenis absen, jam, cabang) dan tombol
     **Kirim** (TAM-04). Setelah terkirim, jendela hasil memakai kalimat
     sukses; angka telat tidak ditampilkan di sini (tampil di rekap, 4D-2b).
- **Khusus Pulang:** sesudah Kirim, jendela Laporan Pulang menyusul
  (4D-3, KEH-89). Absen pulang tercatat setelah laporan terkirim, tetapi
  jamnya jam foto.
- **Tombol:** Kembali di tiap langkah (TAM-14), Ulangi dari awal, Foto ulang
  sebelum Kirim.
- **Aturan:** Pulang paling cepat 15 menit setelah Masuk; di bawah itu
  ditolak server walau tombol dibuka paksa. Pulang sampai 04.00 hari
  berikutnya masuk ke hari kerja sebelumnya (KEH-18). Masuk Kembali dan Pulang
  harus memakai QR cabang tempat Masuk (KEH-110). Tekan dua kali: server hanya
  mencatat sekali (satu absen sejenis per hari kerja per orang).
- **Pesan:** "QR ini milik Cabang B, tetapi Anda masuk tadi di Cabang A.
  Pindai QR Cabang A." (KEH-110).

#### KEH-L08. Perbantuan atau Salah Scan

- **Tujuan:** memastikan orang yang memindai QR cabang lain tidak salah catat.
- **Isi:** muncul **sebelum lokasi dan foto** (KEH-109). Dua tombol besar:
  **Sedang perbantuan** dan **Salah scan**. Salah scan membatalkan dan kembali
  ke KEH-L06.
- **Perbantuan:** shift yang dipakai adalah shift di cabang tujuan yang
  **namanya sama** dengan shift orang itu minggu ini. Kalau cabang tujuan
  tidak punya nama itu, orang memilih salah satu shift cabang tujuan, dan
  kepala cabang tujuan diberi tahu lewat KEH-L11.
- **Aturan:** jam kerja hari itu mengikuti cabang tempat absen masuk, seluruh
  hari (KEH-08). Jawaban tercatat.
- **Beda jabatan:** hanya muncul untuk yang memindai QR cabang yang bukan
  cabang asalnya.

#### KEH-L09. Istirahat dan Masuk Kembali

- **Tujuan:** mencatat istirahat tanpa mengganggu penjagaan cabang (KEH-82
  s.d. 88).
- **Istirahat:** cukup tekan, tanpa foto dan tanpa pemeriksaan titik; jam
  server dan lokasi dicatat (KEH-83). Tombol hanya aktif dalam rentang jam
  mulai istirahat.
- **Penolakan penjaga:** hanya dijalankan kalau yang menekan berjabatan
  penjaga (KEH-112). Pesan menyebut siapa yang sedang istirahat dan sampai jam
  berapa (TAM-03): "Teman Anda, Ani, sedang istirahat sampai 13.00. Coba
  lagi nanti."
- **Penjaga satu-satunya:** pesan "Hari ini hanya Anda yang berjaga, jadi
  tidak bisa istirahat." Hari kerjanya diberi catatan "tidak istirahat karena
  sendiri" (KEH-85); tanpa akibat apa pun.
- **Masuk Kembali:** langkah KEH-L07 penuh (pindai, lokasi, foto, kirim).
  Layar menampilkan sisa waktu istirahat. Lewat batas dihitung server
  (KEH-86); orang tidak diberi tahu akibatnya di layar ini (isi awal kosong:
  hanya dicatat).
- **Beda jabatan:** tidak tampil bagi yang tidak wajib istirahat (isi awal:
  jabatan gudang, driver, kenek, KEH-84) dan di shift yang lama istirahatnya
  kosong (KEH-82).

#### KEH-L10. Sudah Pindah Cabang?

- **Tujuan:** menangkap orang yang sebenarnya sudah dipindah tetapi datanya
  belum (KEH-27).
- **Isi:** muncul **sekali** saat absen pulang hari kerja ke-7 berturut-turut
  di cabang yang bukan cabang asalnya: "Anda sudah 7 hari kerja di Cabang B.
  Apakah Anda sudah pindah ke sana?" dengan **Ya** dan **Belum**.
- **Akibat Ya:** menjadi usulan pindah yang disahkan HR atau Pemilik dengan
  satu ketukan lewat Mesin Pengajuan (jenis "Usulan pindah cabang"); riwayat
  pindah dibuat otomatis (KAR-56). **Belum:** ditanya lagi hari kerja
  berikutnya sampai ada jawaban "Ya" atau perbantuan selesai.
- **Aturan:** muncul sesudah Laporan Pulang terkirim, supaya tidak mendahului
  laporan.

#### KEH-L11. Daftar Perbantuan

- **Tujuan:** kepala cabang melihat siapa membantu di cabangnya dan yang
  perlu dicek shiftnya.
- **Isi:** daftar hari ini dan 7 hari terakhir (lebih lama dimuat saat
  diminta, PRI-11): nama, cabang asal, cabang tujuan, tanggal, shift yang
  dipakai, dan tanda **Shift dipilih sendiri** (KEH-109). Dapat dicari dan
  disaring per cabang.
- **Tombol:** Lihat rincian (hanya melihat).
- **Beda jabatan:** Kepala Toko hanya cabangnya, Kepala Gudang hanya
  departemennya; HR, Admin HR, Pemilik, GM semua. Karyawan lain tidak
  melihat.

### 3.3 Bagian 4D-2b: Tinjau, Koreksi, dan Catatan Hari

Berlaku untuk KEH-L12 s.d. L17: error di jendela "OK, paham"; tidak ada
catatan yang dihapus atau ditimpa (PRI-02), setiap keputusan dan koreksi
menyimpan nilai lama, siapa, kapan, dan alasan; jam dari server (PRI-01).
**Tidak ada yang bisa memutuskan atau mengoreksi absennya sendiri** (KEH-117).

#### KEH-L12. Tinjau Absen

- **Tujuan:** memutuskan absen yang ditandai "perlu ditinjau" dan melihat tanda
  pola lokasi yang mencurigakan, di satu layar.
- **Isi:** dua tab.
  - **Luar titik** (KEH-14): daftar absen berstatus *perlu ditinjau*, terlama
    di atas: nama, cabang, tanggal dan jam, jarak dari titik, foto berstempel
    (bisa diperbesar), dan sisa hari sebelum slip orang itu ditutup.
  - **Pola** (KEH-115): daftar tanda dari mesin pendeteksi: jenis pola
    ("3 kali luar titik dalam 7 hari kerja" atau "dua orang absen dari titik
    yang nyaris sama"), orang yang terkait, dan tautan ke absen-absennya.
- **Memutuskan (satu absen, dua tombol, KEH-114):**
  - **Wajar**: tanda dicabut; alasan singkat wajib.
  - **Perlu dikoreksi**: alasan wajib; membuka KEH-L13 dengan orang dan
    tanggal sudah terisi.
- **Tanda pola:** tidak menahan slip dan bukan tugas Antrean. HR, Pemilik, GM
  menandainya **Sudah dilihat** dengan catatan; tanda yang sudah dilihat tetap
  tersimpan dan bisa dibuka kembali.
- **Keputusan bisa diganti:** Wajar menjadi Perlu dikoreksi atau sebaliknya,
  selama slip periodenya belum ditutup; riwayat keputusan tetap (KEH-68).
- **Aturan:** slip orang itu tidak bisa ditutup selama masih ada absennya yang
  menunggu putusan (KEH-14, 69).
- **Beda jabatan:** Admin HR, Kepala Toko (cabangnya), dan Kepala Gudang
  (departemennya) melihat daftarnya tanpa tombol putusan (KEH-14). Finance
  tidak memakai layar ini.
- **Pesan:** "Absen Ani 08.02 di Cabang A berjarak 120 m dari titik (radius
  100 m). Putuskan sebelum slip ditutup 25 Oktober."

#### KEH-L13. Koreksi Absen

- **Tujuan:** satu-satunya pintu membetulkan absen (KEH-28), untuk satu orang
  atau banyak orang sekaligus.
- **Langkah (4 langkah, TAM-07):**
  1. **Pilih**: satu orang dan satu tanggal; atau, untuk **banyak orang**, satu
     cabang dan satu tanggal lalu centang orangnya (tombol "Semua yang absen
     hari itu" tersedia). Dari KEH-L12 langkah ini sudah terisi.
  2. **Isi nilai baru**: yang boleh dikoreksi **jam masuk**, **jam pulang**, dan
     **cabang hari itu** (KEH-116); atau **Tambah absen** untuk hari tanpa
     absen sama sekali (handphone atau kamera rusak, KEH-30). Untuk banyak
     orang, jam diisi sekali lalu boleh disesuaikan per orang.
  3. **Alasan** wajib: pilihan baku (Handphone atau kamera bermasalah, Pindah
     tempat di tengah hari, Salah catat, Lainnya) ditambah keterangan singkat.
  4. **Periksa**: tiap orang menampilkan jam lama dan jam baru berdampingan
     serta hasil hitung ulang sistem (telat menjadi sekian menit, lembur
     terdeteksi menjadi sekian jam); tombol **Simpan koreksi** (TAM-04). Untuk
     lebih dari 5 orang tombol ditahan 3 detik (TAM-15).
- **Hasil:** catatan asli tidak ditimpa; koreksi tersimpan sebagai baris
  tersendiri dengan jam lama, jam baru, alasan, siapa, kapan, dan nomor
  kelompok bila banyak orang. Telat dan lembur dihitung ulang sistem; tidak
  ada kolom angka yang diketik tangan (KEH-29). Orangnya diberi tahu.
- **Hari yang slipnya sudah ditutup:** catatan hari kerja terkunci (KEH-81).
  Layar menolak mengubahnya dengan pesan "Hari ini sudah masuk slip yang
  ditutup. Koreksi dicatat sebagai koreksi susulan dan dihitung di periode
  berikutnya", lalu menawarkan **Catat koreksi susulan**. Nilai hari kerja
  yang terkunci tidak berubah; Gaji (4E) membaca koreksi susulan sebagai
  penyesuaian periode berikutnya (PRI-04).
- **Membatalkan koreksi:** dibalik dengan koreksi baru (nilai kembali ke
  sebelumnya, alasan wajib); keduanya tetap tampil di riwayat. Boleh selama
  slip periodenya belum ditutup (KEH-68).
- **Riwayat koreksi:** tab kedua: siapa, kapan, orang, tanggal, nilai lama dan
  baru, alasan; dicari dan disaring per cabang atau periode.
- **Beda jabatan:** HR, Pemilik, GM mengoreksi, **kecuali absennya sendiri**
  (KEH-117). Admin HR dan Finance hanya melihat riwayat; kepala cabang tidak
  memakai layar ini (KEH-14).
- **Pesan:** "Koreksi Dedi tersimpan. Telat 7 Oktober dihitung ulang: 0
  menit."

#### KEH-L14. Foto Absen Hari Ini

- **Tujuan:** melihat deretan foto absen untuk memastikan orangnya sendiri
  yang absen (KEH-20); hanya melihat.
- **Isi:** pilih tanggal (bawaan hari ini; paling jauh 60 hari ke belakang,
  KEH-15) dan cabang (kepala cabang langsung ke cabangnya). Deretan kartu:
  foto berstempel, nama, jenis absen (Masuk, Masuk Kembali, Pulang; Istirahat
  tidak berfoto, KEH-83), jam, jarak, dan tanda **Perlu ditinjau** bila ada.
  Ketuk kartu: foto besar.
- **Aturan:** foto tertutup (hanya lewat layar ini dan KEH-L12), tanpa tombol
  unduh, dan **setiap pembukaan foto dicatat** (siapa, kapan, foto mana).
  Foto yang sudah lewat 60 hari diganti keterangan "Foto sudah dihapus; jam
  dan jarak tetap tercatat".
- **Beda jabatan:** Kepala Toko cabangnya, Kepala Gudang departemennya, HR,
  Pemilik, GM semua cabang. Admin HR dan Finance tidak melihat foto.
- **Pesan (kosong):** "Belum ada yang absen di cabang ini hari ini."

#### KEH-L15. Catatan Hari Kerja

- **Tujuan:** melihat catatan satu orang pada satu hari, lengkap dengan
  asalnya (PRI-17, KEH-81).
- **Isi:** pilih orang dan tanggal (atau tekan sebuah sel di KEH-L16). Kartu
  catatan: cabang dan shift, jam kerja yang berlaku, jam masuk, jam istirahat
  dan masuk kembali, jam pulang, **telat** (menit; tanda *dalam toleransi*
  untuk yang berhak melihatnya, KEH-119), **pulang cepat** (menit), lewat
  batas istirahat, lembur (tiga angka, KEH-77; terisi sesudah 4D-5), serta
  **status hari** beserta **asalnya** (absen, pengajuan yang disetujui, hari
  tutup, mesin).
- **Catatan hari** (tanda kecil): "Diisi lewat klarifikasi" (4D-5), "Tidak
  istirahat karena sendiri" (KEH-85), "Shift belum ditentukan" (KEH-07), "Ada
  izin disetujui yang bentrok" (KEH-118), "Belum lengkap" (KEH-63),
  "Dikoreksi" dengan tautan ke riwayat KEH-L13, dan "Terkunci (slip ditutup)".
- **Tombol:** Koreksi (membuka KEH-L13; hanya yang berhak dan bukan untuk
  dirinya sendiri), Kembali.
- **Beda jabatan:** HR, Admin HR, Finance, Pemilik, GM semua cabang; kepala
  cabang hanya lingkupnya. **Alasan izin dan sakit tidak tampil** untuk kepala
  cabang (KEH-80).

#### KEH-L16. Rekap Kehadiran

- **Tujuan:** satu rekap yang sama untuk kantor dan karyawan (KEH-76).
- **Isi:** pilih periode (bawaan periode berjalan **26 sampai 25**, sama dengan
  slip; periode lama dimuat saat diminta, PRI-11) dan cabang. Tabel: baris =
  orang; kolom = Hadir, Telat (kali dan menit), Pulang cepat (kali), Libur
  terjadwal, Hari tutup, Izin, Sakit, Cuti, Alpha, Tidak jalan, Belum
  ditentukan, Absen perlu ditinjau, dan Lembur (terdeteksi / diklaim /
  disahkan, KEH-77; "-" sebelum 4D-5 dibangun). Menekan angka membuka daftar
  harinya (KEH-L15). Baris ringkasan cabang di bawah tabel.
- **Aturan:** semua angka dihitung server dari catatan hari kerja di satu
  tempat (KEH-76, WAJ-04); hari kosong tidak pernah ditebak sebagai libur atau
  izin: hari yang belum bisa ditentukan tampil **Belum ditentukan** (KEH-118).
  Hari yang masih berjalan belum masuk hitungan.
- **Periode yang slipnya sudah ditutup:** angkanya terkunci dan diberi tanda;
  koreksi susulan tampil sebagai baris tersendiri "Koreksi susulan".
- **Beda jabatan:** HR, Admin HR, Finance, Pemilik, GM semua cabang; Kepala
  Toko cabangnya; Kepala Gudang departemennya. Orang biasa memakai KEH-L17.
- **Bentuk yang belum ada komponennya:** tabel rekap banyak kolom dengan baris
  ringkasan; ditambahkan ke komponen baku saat dibangun (`../desain/README.md`).

#### KEH-L17. Kehadiran Saya

- **Tujuan:** karyawan melihat kehadirannya sendiri tanpa bertanya (KEH-76).
- **Isi (HP, TAM-12):** kepala periode (26 sampai 25): ringkasan angka (Hadir,
  Telat, Libur, Izin, Sakit, Cuti, Alpha, Hari tutup) dan Lembur tiga angka.
  Di bawahnya daftar hari: tanggal, jam masuk dan pulang, telat dalam menit,
  status. Ketuk hari: rincian dan alasan bila ada.
- **Telat (KEH-119):** menit telat ditampilkan apa adanya, **tanpa kata
  "toleransi" dan tanpa nominal potongan** (nominal ada di slip, Gaji).
- **Beda jabatan:** tidak tampil bagi yang tidak diabsen (GM, KAR-67); orang
  yang dibayar per ritase melihat hari Tidak jalan dan trip-nya, bukan telat.
- **Pesan (kosong):** "Belum ada catatan kehadiran di periode ini."

### 3.4 Bagian 4D-2c: Absen lewat Trip

Berlaku untuk KEH-L18 dan L19. Yang dibahas hanya **orang yang dibayar per
ritase** (KEH-96). Tombol Berangkat dan lapor garasi ada di layar trip
Logistik (4F), bukan di sini (KEH-120); bagian ini menetapkan **akibatnya ke
absen** dan layar yang menampilkannya. Jam dari server (PRI-01); tidak ada
catatan yang dihapus (PRI-02).

**Cara absen lahir dari trip (urutan kejadian):**

| Kejadian di trip (Logistik) | Yang tercatat di Kehadiran | Aturan |
|---|---|---|
| Berangkat ditekan driver atau kenek, dengan satu foto awak | Absen masuk **seluruh awak** pada jam server yang sama; satu foto dipakai bersama; lokasi dicatat, tidak diperiksa | KEH-97, 124 |
| Kantor menambah orang ke trip yang sudah berangkat | Absen masuk orang itu pada jam server saat ditambahkan, tanda "ditambahkan kantor", tanpa foto ulang | KEH-121 |
| Lapor sampai garasi (setelah Laporan Pulang, 4D-3) | Absen pulang seluruh awak trip itu pada jam lapor garasi; kalau ada trip lain sesudahnya, absen pulang **pindah** ke trip terakhir (baris lama tetap, bertanda "diganti trip berikutnya") | KEH-98 |
| Trip ditutup kantor (LOG-30) | Absen pulang awak pada jam penutupan; tanda "ditutup kantor"; Laporan Pulang menyusul tanpa denda | KEH-101, 123 |
| Hari itu tidak ada di trip mana pun | Status **Tidak jalan**, tanpa akibat (ditulis Pembuat catatan hari kerja, bagian 6) | KEH-81, 97 |

Hari kerja ikut **tanggal berangkat** (KEH-122). Telat, pulang cepat, istirahat,
dan lembur tidak dihitung (KEH-99).

#### KEH-L18. Absen Trip Saya

- **Tujuan:** driver dan kenek melihat absennya tanpa bertanya ke kantor.
- **Isi (HP, TAM-12):** keadaan hari ini dalam satu kalimat besar: "Belum
  berangkat", "Berangkat 08.10 bersama Dedi dan Eko (trip 1)", "Pulang
  tercatat 17.20 (trip 2)". Di bawahnya daftar trip hari ini: nomor trip,
  awak, jam berangkat, jam lapor garasi, dan tanda "ditutup kantor" atau
  "Laporan Pulang menunggu" bila ada. Satu tombol **Buka trip** menuju layar
  trip Logistik.
- **Aturan:** hanya membaca. Tidak ada tombol absen di layar ini (KEH-120).
  Menit telat tidak tampil, karena tidak dihitung (KEH-99).
- **Beda jabatan:** hanya untuk yang dibayar per ritase; yang lain memakai
  KEH-L06.
- **Pesan (kosong):** "Belum ada trip hari ini. Hari ini tercatat Tidak jalan
  bila tidak ada trip sampai malam."

#### KEH-L19. Absen Trip Hari Ini

- **Tujuan:** kantor melihat siapa jalan, siapa tidak, dan trip yang belum
  tuntas absennya, di satu layar.
- **Isi (PC):** pilih tanggal (bawaan hari ini). Tiga bagian:
  1. **Trip:** satu kartu per trip: mobil, awak, jam berangkat, foto awak
     (diperbesar bila diketuk), jam lapor garasi, dan tanda ("ditambahkan
     kantor", "ditutup kantor", "diganti trip berikutnya").
  2. **Perlu perhatian:** trip yang belum lapor garasi, dan Laporan Pulang
     yang menunggu setelah trip ditutup kantor (KEH-101); yang melewati
     12.00 hari berikutnya bertanda LOG-31.
  3. **Tidak jalan:** daftar orang yang hari itu tidak ada di trip mana pun
     (muncul setelah mesin harian jalan).
- **Aturan:** foto awak tertutup, tanpa tombol unduh, dan setiap pembukaan
  dicatat di akses_foto_absen (KEH-20); dihapus setelah 60 hari (KEH-15).
  Memperbaiki awak atau jam lewat Koreksi (KEH-L13), dan **tidak untuk
  dirinya sendiri** (KEH-117).
- **Beda jabatan:** Kepala Gudang, HR, Pemilik, GM. Admin HR dan Finance
  hanya melihat tanpa foto; kepala toko tidak memakai layar ini.
- **Pesan (kosong):** "Belum ada trip berangkat hari ini."

Dua tambahan di layar yang sudah ada: KEH-L16 (Rekap) dan KEH-L17 sudah
memuat kolom **Tidak jalan**; KEH-L15 menampilkan baris **sumber absen**
("Lewat trip 2") untuk orang per ritase (tanpa telat dan pulang cepat).

### 3.5 Bagian 4D-3: Laporan Pulang

Berlaku untuk KEH-L20 s.d. L25: error di jendela "OK, paham"; tombol Kirim
terkunci sampai selesai dan tidak bisa ditekan dua kali (satu laporan per
absen pulang atau per trip); isian disimpan di handphone dan tidak hilang kalau
sinyal putus (TAM-16); jam dari server (PRI-01); laporan yang sudah terkirim
tidak bisa diubah atau dihapus, hanya ditambah keterangan (KEH-95, PRI-02).
Pemilik data: `laporan_pulang` dan turunannya milik Kehadiran; permintaan
bensin milik Logistik (LOG-83) dan hanya **diterima** dari sini lewat satu
pintu (WAJ-03).

#### KEH-L20. Laporan Pulang

- **Tujuan:** menutup hari kerja dengan serah terima yang jelas, sebelum absen
  pulang tercatat (KEH-89).
- **Langkah (berurutan, TAM-07, KEH-125):**
  1. **Serah terima:** tulisan pengarah "Wajib isi laporan selesai tugas.
     Sampaikan apa saja tugas yang perlu dilanjutkan besok, supaya tidak ada
     miskomunikasi." Isian teks (paling sedikit 20 huruf, pengaturan, dihitung
     di server, KEH-90); contoh kalimat sebagai bayangan isian ("Semua tugas
     sudah selesai, tidak ada yang perlu dilanjutkan"); penerima: **Tim saya**
     (bawaan) atau **Orang tertentu** (pilih satu atau lebih dari cabang atau
     departemennya); foto boleh dari kamera atau galeri (TAM-08).
  2. **Ada masalah?** Tombol **Lewati** dan **Isi laporan masalah**. Bila diisi:
     bentuknya KEH-L23, termasuk pilihan "menyangkut GM" (KEH-128).
  3. **Keadaan mobil** (hanya driver di trip): **Baik** atau **Perlu
     perhatian**; yang kedua mewajibkan isian masalah, foto boleh (kamera atau
     galeri) (KEH-94).
  4. **Bensin** (hanya driver di trip): "Perlu isi bensin besok?" **Ya** atau
     **Tidak**; Ya mewajibkan perkiraan nominal (bilangan bulat, PRI-28).
  5. **Kirim:** ringkasan semua isian dan tombol **Kirim** (TAM-04).
- **Setelah Kirim:** absen pulang tercatat dengan **jam foto** (KEH-89),
  pertanyaan "ini lembur?" menyusul bila melewati jam kerja (KEH-72, 4D-5),
  lalu pertanyaan KEH-L10 bila berlaku. Untuk trip: absen pulang mengikuti trip
  terakhir (KEH-98); bensin diteruskan sebagai permintaan bensin ke Logistik.
- **Belum terkirim:** absen pulang berstatus "menunggu laporan"; KEH-L06
  menampilkan "Laporan Pulang menunggu" dengan tombol **Lanjutkan laporan**, dan
  laporan muncul lagi tiap membuka aplikasi sampai terkirim atau sampai batas
  04.00 (KEH-91). Sampai batas itu isian yang tersimpan di handphone dipulihkan.
- **Trip ditutup kantor:** laporan tampil di layar trip Logistik dan sebagai
  jendela saat driver membuka aplikasi; tanpa batas 04.00 dan tanpa denda
  (KEH-101, 123). Sampai terkirim, muncul di perlu perhatian Kepala Gudang.
- **Kenek:** langkah 3 dan 4 tidak ada; langkah 1 boleh dikirim sendiri tetapi
  tidak wajib (KEH-100). Driver dan kenek sama-sama bisa memakai langkah 2.
- **Beda jabatan:** tidak tampil untuk GM (KAR-67). Orang yang wajib absen
  pulang dengan QR tetapi tidak berjabatan driver hanya mendapat langkah 1, 2,
  dan 5.
- **Pesan:** "Laporan Anda terkirim. Absen pulang tercatat pukul 17.05."

#### KEH-L21. Serah Terima Saya

- **Tujuan:** penerima membaca serah terima untuk dirinya atau timnya, dan
  pengirim melihat siapa sudah membaca (KEH-92).
- **Jendela baca:** muncul setelah absen masuk berhasil (layar absen tidak
  terhalang, TAM-22 butir 2). **Satu jendela per laporan**, berurutan dari
  yang paling lama, hanya serah terima **7 hari terakhir** yang belum dibaca
  (KEH-126); tombolnya **"Sudah saya baca"** (aktif setelah 1 detik, TAM-22).
  Tidak ada jendela ringkasan. Yang libur atau cuti melihatnya di masuk
  berikutnya.
- **Daftar (menu):** dua tab, **Diterima** dan **Dikirim**. Diterima memuat
  semua serah terima (yang sudah dan belum dibaca, termasuk yang lebih dari 7
  hari); Dikirim memuat laporan sendiri dengan daftar penerima dan jam bacanya
  ("Dibaca: Ani 08.05, Budi belum") atau status **Tidak ada penerima**
  (KEH-127). Dibagi per halaman (PRI-10); yang lama dimuat saat diminta
  (PRI-11).
- **Tombol:** Buka, Tambah keterangan pada laporan sendiri (KEH-95). Tidak ada
  Ubah atau Hapus.
- **Beda jabatan:** semua yang diabsen; orang per ritase memakai layar yang
  sama untuk serah terima dari trip.

#### KEH-L22. Serah Terima Tim

- **Tujuan:** atasan melihat serah terima timnya tanpa menanyai satu per satu
  (KEH-92).
- **Isi (PC):** daftar per tanggal: pengirim, penerima, ringkasan isi, foto,
  jumlah yang sudah membaca, dan tanda **Tidak ada penerima** (KEH-127). Dapat
  dicari dan disaring (cabang, tanggal, belum dibaca, ada foto).
- **Aturan:** hanya melihat. Bukan rahasia; foto boleh dibuka tanpa dicatat
  pembukaannya (berbeda dari foto absen, KEH-20).
- **Beda jabatan:** Kepala Toko hanya cabangnya, Kepala Gudang hanya
  departemennya, HR, GM, Pemilik semua. Admin HR dan Finance tidak memakai
  layar ini.
- **Pesan (kosong):** "Belum ada serah terima pada rentang ini."

#### KEH-L23. Lapor Masalah

- **Tujuan:** satu tempat melapor masalah secara rahasia, dari jendela
  Laporan Pulang atau kapan saja (KEH-93).
- **Isi (HP):** isian teks, foto boleh (kamera atau galeri), pilihan
  **"Masalah ini menyangkut GM"** (KEH-128), dan tombol Kirim. Di bawahnya
  daftar laporan sendiri dengan **status** (Diterima, Sedang ditindaklanjuti,
  Selesai) dan **tanggapan** satu kalimat bila ada (KEH-129).
- **Aturan:** setelah terkirim tidak bisa diubah; hanya Tambah keterangan
  (KEH-95). Tidak masuk rapor dan tidak berakibat apa pun bagi pelapor.
  Pelapor tidak melihat siapa yang membaca.
- **Pesan:** "Laporan Anda diterima. Hanya GM dan pemilik yang membacanya."
  (untuk "menyangkut GM": "Hanya pemilik yang membacanya.")
- **Beda jabatan:** semua yang diabsen, termasuk driver dan kenek per ritase.
  GM tidak punya layar ini (KAR-67), tetapi membaca laporan lewat KEH-L24.

#### KEH-L24. Laporan Masalah

- **Tujuan:** GM dan pemilik membaca dan menindaklanjuti laporan masalah.
- **Isi (PC):** daftar laporan dengan nama pelapor, isi, foto, tanggal, dan
  status; saring per status. Rincian laporan memuat riwayat status dan
  keterangan tambahan pelapor.
- **Tombol:** ubah status (Diterima → Sedang ditindaklanjuti → Selesai) dan
  tulis **tanggapan** satu kalimat yang tampil ke pelapor (KEH-129). Peringatan
  muncul bila tanggapan memuat nama orang aktif.
- **Aturan:** laporan "menyangkut GM" **tidak ada di daftar GM**, tidak muncul
  di pencarian, hitungan, atau pengingatnya, dan ditolak server bila GM
  membuka langsung (KEH-128). Tidak ada hapus (PRI-02). HR, Admin HR, kepala
  cabang, dan orang yang dilaporkan tidak punya layar ini.
- **Pesan (kosong):** "Belum ada laporan masalah."

#### KEH-L25. Keadaan Mobil

- **Tujuan:** mobil bermasalah tidak baru diketahui saat mogok (KEH-94).
- **Isi (PC):** daftar laporan keadaan mobil: tanggal, mobil, driver pelapor,
  Baik atau Perlu perhatian, masalah, foto, dan status tindak lanjut (Baru,
  Sedang ditangani, Selesai, KEH-130). Bawaan: yang belum Selesai di atas.
- **Tombol:** ubah status; **Selesai** wajib dengan catatan singkat (KEH-130).
- **Aturan:** laporan tidak bisa diubah (KEH-95); status dan catatan hanya
  ditambah. Laporan "Baik" tidak menutup laporan lain. Biaya servis dicatat di
  Buku Kas lewat Keuangan, bukan dari sini. Yang belum Selesai tampil di
  Beranda Kepala Gudang dan Finance tiap pagi sebagai pengingat berantai
  (TAM-22, KEH-94) sampai salah satu menandai Selesai.
- **Beda jabatan:** Kepala Gudang, Finance, Pemilik, GM mengubah status.
  Driver pelapor hanya melihat statusnya di KEH-L18 dan layar trip Logistik.

### 3.6 Bagian 4D-4a: Libur dan Tukar

Berlaku untuk KEH-L26 s.d. L29: error di jendela "OK, paham"; tombol Simpan
dan Kirim terkunci sampai selesai dan tidak bisa ditekan dua kali; isian tidak
hilang kalau sinyal putus (TAM-16); jam dari server (PRI-01); semua
pemeriksaan aturan dijalankan **server** (WAJ-04), layar hanya menampilkan
hasilnya. Tidak ada yang dihapus (PRI-02): libur yang dilepas atau dicabut
berstatus Diganti atau Dicabut. Pemilik data: libur_pilihan, ajakan_tukar,
permintaan_masuk_libur, dan libur_pengganti milik Kehadiran; jalur status
ajakan tukar dipinjam dari Mesin Pengajuan (PRI-23, 37). Sisi kantor dan sisi
karyawan melihat kalender libur yang sama (KEH-L26 dan L27).

#### KEH-L26. Pilih Libur

- **Tujuan:** memilih sendiri 4 tanggal libur satu periode, tanpa menunggu
  persetujuan siapa pun (KEH-131), dan memilih libur pengganti (KEH-138).
- **Isi (HP, TAM-12):** kepala "Libur periode 26 Okt – 25 Nov", sisa waktu
  ("Ditutup 25 Okt pukul 23.59") dan hitungan "Terisi 2 dari 4". Kalender
  periode: tiap tanggal berstatus **Bisa dipilih**, **Penuh** (KEH-34),
  **Terlalu dekat** (jarak, KEH-134), **Jatah akhir pekan terpakai**, atau
  **Sudah lewat**. Di bawah tanggal tampil nama teman satu cabang yang libur
  (KEH-107, tanpa alasan). Libur di ujung periode tetangga ikut tampil
  keabuan karena dihitung untuk jarak.
- **Langkah (3 langkah, TAM-07):**
  1. **Pilih tanggal:** ketuk tanggal (sampai 4). Boleh disimpan sebagian
     selama jendela terbuka.
  2. **Periksa:** ringkasan tanggal terpilih, "Akhir pekan: 1 dari 1",
     "Jarak antar libur: cukup".
  3. **Simpan:** pesan "Libur Anda tersimpan. Berlaku mulai sekarang." Kalau
     saat Simpan tanggalnya sudah diambil teman, tanggal itu ditolak dengan
     pesan yang menyebutnya; tanggal lain tetap tersimpan.
- **Jendela (KEH-132, 133):** dibuka tanggal 10, ditutup tanggal 25 pukul
  23.59. Selama terbuka tanggal bebas digeser (**Lepas pilihan** tercatat
  sebagai Diganti). Sesudah tutup tanggal terkunci; layar hanya melihat dan
  menyediakan tombol **Tukar dengan teman** (ke KEH-L28).
- **Terlambat (KEH-135):** bila jatah belum lengkap sesudah tutup, layar
  menyebut "Jatah libur Anda belum lengkap. Denda sekali sudah dicatat.
  Pilih tanggal paling cepat 2 hari dari sekarang." Langkahnya sama; tanggal
  yang lebih dekat tidak bisa dipilih.
- **Pengganti (KEH-138):** bila ada permintaan masuk yang menunggu pilihan
  pengganti, layar langsung ke langkah "Pilih libur pengganti": satu tanggal,
  tampil "paling lambat 22 Nov", boleh di periode berikutnya.
- **Jatah orang baru:** tampil sebanding ("Jatah Anda periode ini: 1 hari",
  GAJ-06).
- **Beda jabatan:** tidak tampil untuk orang yang dibayar per ritase, jabatan
  yang liburnya tidak tetap (KEH-32, PRI-18), dan GM (KAR-67).
- **Bentuk yang belum ada komponennya:** **kalender periode 26–25** dengan
  tanda per tanggal; ditambahkan ke komponen baku saat dibangun
  (`../desain/README.md`).

#### KEH-L27. Libur Cabang

- **Tujuan:** kantor melihat siapa libur kapan di cabangnya, mengubah saat
  mendadak, dan melihat yang belum memilih. Ini sisi kantor dari kalender
  yang dilihat karyawan di KEH-L26.
- **Isi (PC):** pilih cabang (Kepala Toko dan Kepala Gudang langsung ke
  lingkupnya) dan periode (bawaan: berjalan; periode depan satu ketukan;
  yang lama dimuat saat diminta, PRI-11). Tiga tab:
  - **Kalender:** per tanggal jumlah dan nama yang libur, tanda Penuh, Hari
    tutup (KEH-L04), dan permintaan masuk yang berlaku.
  - **Belum memilih:** nama, "terisi x dari y", dan tanda bila sudah kena
    tanda tidak memilih libur (KEH-135). Hanya melihat; HR tidak mengisikan
    (KEH-31).
  - **Tukar:** tukar yang terjadi dan jumlah tukar per orang per periode
    (KEH-43). Hanya melihat.
- **Ubah langsung (mendadak, KEH-45), 3 langkah:** (1) ketuk libur seseorang
  dan pilih tanggal baru; (2) alasan wajib; (3) periksa: diperiksa KEH-34
  saja, dan bila orangnya jadi libur di dua akhir pekan sistem hanya
  mencatat "dua akhir pekan" sebagai catatan, tidak menolak; lalu Simpan.
  Orangnya diberi tahu dan perubahannya tercatat (siapa, kapan, alasan,
  nilai lama).
- **Cabut libur (KEH-131):** HR, Pemilik, GM; alasan wajib; status Dicabut;
  orangnya diberi tahu; tidak dihapus.
- **Minta masuk:** tombol di baris libur membuka KEH-L29.
- **Beda jabatan:** Kepala Toko dan Kepala Gudang mengubah langsung di
  lingkupnya (tidak mencabut); HR, Pemilik, GM semua cabang dan mencabut;
  Admin HR hanya melihat; Finance tidak memakai layar ini.
- **Pesan (kosong):** "Belum ada libur yang dipilih pada periode ini."

#### KEH-L28. Tukar Libur dan Shift

- **Tujuan:** menukar libur atau shift dengan teman satu cabang tanpa
  persetujuan atasan (KEH-43, 136).
- **Isi (HP):** dua tab. **Ajakan untuk saya:** kartu "Ani mengajak tukar:
  libur Anda Kamis 12 Nov ↔ libur Ani Sabtu 14 Nov", batas jawab ("Jawab
  sebelum 10 Nov"), tombol **Terima** dan **Tolak**. **Ajakan saya:** status
  tiap ajakan (Menunggu, Diterima, Ditolak, Batal otomatis, Dibatalkan) dan
  tombol **Batalkan** selama Menunggu, serta tombol **Ajak teman**.
- **Ajak teman (4 langkah, TAM-07):** (1) jenis: Tukar libur atau Tukar
  shift; (2) tanggal milik saya (libur berlaku yang belum lewat, atau satu
  tanggal untuk shift); (3) teman: daftar teman satu cabang yang bisa
  ditukar pada tanggal itu, beserta tanggal atau shift tukarannya; (4)
  periksa dan Kirim: tampil jadwal kedua orang sesudah tukar dan batas jawab.
- **Aturan:** batas H-2 dari tanggal yang lebih dekat (KEH-44); bila kurang
  dari itu, ajakan tidak bisa dikirim dan layar menyebut "Anda bisa
  mengajukan izin biasa" dengan tombol ke Pengajuan Saya (4D-4b). Teman yang
  sedang izin, sakit, atau cuti pada tanggal itu tidak muncul di daftar.
  Setelah Terima, jadwal kedua orang langsung berubah; tidak ada
  pemberitahuan ke atasan (KEH-43).
- **Tombol:** Ajak teman, Terima (konfirmasi biasa), Tolak, Batalkan, Kembali
  di tiap langkah (TAM-14), Ulangi dari awal.
- **Pesan:** "Ajakan batal karena tidak dijawab sampai batas. Anda bisa
  mengajukan izin biasa."
- **Beda jabatan:** semua yang punya jadwal; tidak tampil untuk yang dibayar
  per ritase (KEH-96) dan GM.

#### KEH-L29. Minta Masuk di Hari Libur

- **Tujuan:** meminta orang masuk di hari libur dengan permintaan tercatat
  (KEH-46, 137).
- **Langkah (3 langkah, TAM-07):** (1) pilih orang dari lingkupnya dan tanggal
  liburnya yang berlaku dan belum lewat; (2) alasan wajib; (3) periksa: sistem
  menyebut "Dedi diberi tahu; bila jabatannya berhak, dibayar 1 gaji harian
  (GAJ-15); ia memilih libur pengganti dalam 14 hari; tombol Masuk aktif pada
  tanggal itu", lalu **Kirim**.
- **Daftar permintaan:** tanggal, orang, peminta, alasan, status (Diminta,
  Siap masuk, Dibatalkan), dan status pengganti (Menunggu dipilih, Dipilih
  pada tanggal ..., Hangus).
- **Sisi orangnya:** kartu "Anda diminta masuk Minggu 9 Nov oleh [nama]"
  dengan tombol **Siap masuk** yang membuka langkah pengganti di KEH-L26.
  Tidak ada tombol Tolak (KEH-137).
- **Membatalkan:** peminta, HR, Pemilik, GM, alasan wajib, selama tanggalnya
  belum lewat; orangnya diberi tahu.
- **Aturan:** orang di luar lingkupnya ditolak; satu tanggal satu permintaan
  yang berlaku; tidak ada pengganti bila orangnya tidak absen masuk
  (KEH-138).
- **Beda jabatan:** Kepala Toko dan Kepala Gudang di lingkupnya; HR, Pemilik,
  GM semua cabang; Admin HR dan Finance tidak memakai layar ini.

### 3.7 Bagian 4D-4b: Izin, Sakit, dan Cuti

Berlaku untuk KEH-L30 s.d. L34: error di jendela "OK, paham"; tombol Kirim
dan Simpan terkunci sampai selesai dan tidak bisa ditekan dua kali; isian
tidak hilang kalau sinyal putus (TAM-16); jam dari server (PRI-01); semua
pemeriksaan (batas waktu, bentrok, sisa cuti, label mendadak, hitungan hari
kerja) dijalankan **server** (WAJ-04), layar hanya menampilkan hasilnya.
Tidak ada yang dihapus (PRI-02). Pemilik data: pengajuan_tidak_masuk,
surat_dokter, tahun_cuti, dan gerak_cuti milik Kehadiran; status dan
keputusannya memakai **Mesin Pengajuan** (PRI-23, 37; BER-L04 s.d. L07, L20,
L21): daftar Pengajuan Saya, kartu status, Batalkan, Ajukan ulang, dan kotak
Persetujuan **tidak digambar ulang di sini**; bagian ini hanya mengisi
"isi khas" dan "keterangan pembantu" jenisnya. Hasil keputusan menulis
`hari_kerja` berstatus Izin, Sakit, atau Cuti (KEH-118); Gaji (4E) membaca
hari itu dan membayarnya menurut GAJ-13 dan 14.

#### KEH-L30. Ajukan Izin, Sakit, atau Cuti

- **Tujuan:** mengajukan tidak masuk selain libur, dengan batas waktu yang
  jelas dan tanpa menebak akibatnya.
- **Isi (HP, TAM-12), 4 langkah (TAM-07):**
  1. **Jenis:** satu tombol besar per jenis: **Izin keperluan**, **Sakit**
     (lalu: **Tanpa surat** atau **Dengan surat dokter**), **Cuti tahunan**,
     **Izin duka**. **Tidak ada tombol "Izin mendadak"** (KEH-142). Jenis
     yang haknya ada tetapi syaratnya belum terpenuhi tampil redup dengan
     alasannya (BER-L05), misalnya "Cuti tahunan: masa kerja belum 1 tahun,
     bisa mulai 1 Maret 2027" atau "Sisa cuti 0 hari". Di bawah tiap jenis
     tampil batas waktunya dalam satu kalimat (KEH-141).
  2. **Tanggal:** dari dan sampai. Layar langsung menghitung "3 hari kerja
     (libur Anda Kamis 12 Nov tidak dihitung)" (KEH-41). Tanggal yang
     bentrok dengan izin, sakit, atau cuti yang masih berlaku ditolak dengan
     pesan yang menyebutnya (KEH-149).
  3. **Isian khas:**
     - *Izin keperluan:* alasan (wajib).
     - *Sakit tanpa surat:* alasan; bila lebih dari 2 hari kerja, pesan
       "Sakit tanpa surat paling lama 2 hari. Pilih sakit dengan surat
       dokter." dan tombol **Ganti ke dengan surat** (KEH-143).
     - *Sakit dengan surat:* foto surat (kamera atau galeri, TAM-08) **atau**
       pilihan **Surat menyusul** (KEH-143); sisa waktu menyusul dijelaskan
       "paling lambat 3 hari sesudah Anda masuk kembali".
     - *Cuti tahunan:* tampil sisa sebelum dan sesudah ("Sisa 10 → 7 hari");
       tanggal harus H-7 atau lebih (KEH-141).
     - *Izin duka:* hubungan wajib dipilih (ayah, ibu, suami, istri, anak;
       KEH-49); lampiran tidak wajib. Lebih dari 2 hari kerja: pesan "Dua hari
       pertama bebas dan dibayar. Hari ke-3 dan seterusnya diajukan terpisah
       sebagai izin keperluan atau cuti" dan tanggal dipotong pada hari ke-2
       (KEH-146).
  4. **Periksa dan Kirim:** ringkasan jenis, tanggal, hitungan hari, dan
     akibat umumnya. **Kalau server menandainya izin mendadak** (tanggal
     kurang dari H-2), layar menyebut "Pengajuan ini dicatat sebagai izin
     mendadak. Potongannya lebih besar dari izin biasa." dan tombol Kirim
     **ditahan 3 detik** (TAM-15); jenis lain konfirmasi biasa.
- **Setelah Kirim:** "Pengajuan terkirim. Menunggu keputusan HR atau
  pemilik." Selama menunggu, hari itu tetap "belum ditentukan" dan tidak
  ditandai alpha (KEH-147); layar menyebut ini supaya karyawan tidak cemas.
  Sisa cuti langsung terpesan (KEH-145).
- **Terlambat:** bila batas waktu sudah lewat, tombol Kirim mati dengan
  penjelasan "Hari ini sudah menjadi alpha. Jika Anda berhak, ajukan
  klarifikasi" dan tautan ke Perlu Dijelaskan (4D-5).
- **Jalan keluar:** Kembali di tiap langkah tanpa kehilangan isian; Ulangi
  dari awal; sesudah terkirim Batalkan di BER-L07 (KEH-39, 40).
- **Beda jabatan:** tidak tampil untuk yang dibayar per ritase dan GM;
  jenis cuti tampil redup untuk yang masa kerjanya belum 1 tahun.

#### KEH-L31. Sisa Cuti Saya

- **Tujuan:** karyawan tahu sisa cutinya tanpa bertanya ke HR, dan kapan
  hangus.
- **Isi (HP):** kepala "Tahun cuti 1 Maret 2027 – 29 Februari 2028"; angka
  besar **Sisa**, dan di bawahnya Jatah, Dipesan (menunggu keputusan), Dipakai,
  Hangus pada tanggalnya. Riwayat gerak, terbaru di atas: "Dipesan 3 hari",
  "Dipakai 3 hari", "Dikembalikan 2 hari (ditolak)". Tahun cuti lama dimuat
  saat diminta (PRI-11).
- **Sebelum 1 tahun:** "Cuti pertama bisa diajukan mulai 1 Maret 2027. Jatah
  Anda 10 hari." Tidak ada angka sisa (KEH-145).
- **Tombol:** **Ajukan cuti** (ke KEH-L30, jenis cuti sudah terpilih).
- **Jalan keluar:** Kembali. Hanya baca.
- **Beda jabatan:** semua yang punya jatah cuti; tidak tampil untuk per
  ritase dan GM.

#### KEH-L32. Susulkan Surat Dokter

- **Tujuan:** menyusulkan surat dokter yang dijanjikan di KEH-L30 (KEH-143).
- **Isi (HP):** daftar sakit yang berstatus "Surat menyusul": tanggal sakit,
  "Tinggal 2 hari lagi" (dihitung dari masuk kerja kembali, jam server),
  tombol **Ambil foto** dan **Pilih dari galeri**.
- **Langkah (2 langkah):** (1) foto; (2) periksa dan Kirim. Setelah Kirim:
  "Surat terkirim. Hari sakit Anda dihitung sebagai sakit dengan surat."
  Server menghitung ulang hari-harinya (satu fungsi yang sama, WAJ-04).
- **Lewat batas:** tombol mati dengan "Batas menyusulkan sudah lewat; hari itu
  dicatat sakit tanpa surat." Yang keberatan memakai klarifikasi (4D-5),
  bukan jalur ini (KEH-143).
- **Jalan keluar:** Kembali; Foto ulang sebelum Kirim; sesudah Kirim tidak
  diubah orangnya, dibetulkan HR lewat Cabut persetujuan.
- **Beda jabatan:** hanya pengaju.

#### KEH-L33. Keterangan Pembantu Putusan Tidak Masuk

- **Tujuan:** penyetuju tahu cukup untuk memutuskan tanpa membuka layar lain
  (BER-L21 "keterangan pembantu").
- **Isi (PC), di dalam BER-L21:** kotak di samping isi pengajuan:
  - **Cuti:** sisa sebelum dan sesudah, tahun cuti, hangus pada.
  - **Orang lain di cabangnya yang tidak masuk pada tanggal itu:** nama,
    tanpa jenis dan alasan; peringatan "3 orang lain tidak masuk Kamis"
    (KEH-149, tidak memblokir).
  - **Absen hari itu:** bila sudah ada absen pada tanggal itu, tanda
    "ada absen; bentrok" (KEH-118, status akan menjadi Hadir).
  - **Kebiasaan:** jumlah izin dan sakit orang itu pada periode berjalan
    dan sebelumnya (tanpa nominal).
  - **Foto surat dokter:** hanya HR, Pemilik, GM; membukanya tercatat
    (KEH-144).
  - **Label:** "Izin mendadak" dan "Diisi oleh …" bila berlaku.
- **Tombol:** milik BER-L21: Setujui, Tolak (alasan wajib, KEH-38), Cabut
  persetujuan (alasan wajib, KEH-148).
- **Jalan keluar:** milik BER-L21.
- **Beda jabatan:** Kepala Toko dan Kepala Gudang tidak melihat layar ini,
  hanya tanggal dan status di Libur Cabang (KEH-80).

#### KEH-L34. Isikan Pengajuan atas Nama

- **Tujuan:** orang yang tidak punya handphone atau lupa tidak jadi alpha
  karena tidak sempat mengajukan (KEH-148).
- **Langkah (4 langkah, TAM-07):** (1) pilih orang (HR, Pemilik, GM semua
  cabang; tidak termasuk dirinya); (2) jenis dan tanggal (isian sama dengan
  KEH-L30; batas waktu tetap diperiksa server, dihitung dari saat
  diisikan; yang sudah lewat batas ditempuh lewat klarifikasi 4D-5, bukan
  jalur ini); (3) alasan **kenapa diisikan** wajib dan lampiran bila ada;
  (4) periksa dan Kirim.
- **Hasil:** kartu di Pengajuan Saya orang itu bertanda "diisi oleh [nama]";
  keputusannya oleh penyetuju lain, bukan yang mengisi (PRI-37 butir 3). Orang
  itu diberi tahu.
- **Jalan keluar:** Kembali, Ulangi dari awal; sesudah Kirim dibatalkan
  seperti pengajuan biasa (KEH-39, 40).
- **Beda jabatan:** HR, Pemilik, GM saja; Admin HR dan Finance tidak.

#### Tab baru di KEH-L27 (Libur Cabang): "Tidak masuk"

- **Tujuan:** kantor mengatur shift dengan melihat siapa tidak masuk kapan
  (KEH-80, 149).
- **Isi (PC):** kalender cabang per tanggal: nama dan tanda **Tidak masuk**
  dengan status pengajuan (Menunggu, Disetujui). Kepala Toko dan Kepala
  Gudang hanya melihat ini (tanpa jenis dan alasan). HR, Pemilik, GM
  melihat jenisnya (izin, sakit, cuti, duka) dan membuka pengajuannya.
- **Karyawan (HP):** di KEH-L05 dan KEH-L26 teman satu cabang yang tidak
  masuk tampil hanya sebagai "tidak masuk" (KEH-107, 149).

### 3.8 Bagian 4D-5a: Perlu Dijelaskan

Berlaku untuk KEH-L35 s.d. L39: error di jendela "OK, paham"; tombol Kirim
dan Simpan terkunci sampai selesai dan tidak bisa ditekan dua kali; isian
tidak hilang kalau sinyal putus (TAM-16); jam dari server (PRI-01); semua
pemeriksaan (batas 3 hari, urutan kejadian ke-5, bentrok, jam yang masuk akal,
siapa boleh memutuskan) dijalankan **server** (WAJ-04), layar hanya
menampilkan hasilnya. Tidak ada yang dihapus atau ditimpa (PRI-02, KEH-67):
catatan asli dan angka aslinya tetap tersimpan. Pemilik data: kejadian_perlu_jelas,
penjelasan, tanda_berturut milik Kehadiran; status dan keputusannya memakai
**Mesin Pengajuan** (PRI-23, 37; BER-L04 s.d. L07, L20, L21): Pengajuan Saya,
kartu status, Batalkan, Ajukan ulang, dan kotak Persetujuan **tidak digambar
ulang di sini**. Yang ditulis bagian ini hanya daftar kejadian, isian khas
jenis "Penjelasan", dan keterangan pembantu. Nominal denda dan potongan milik
Gaji (4E, GAJ-13 dan 16): Kehadiran hanya menyediakan **kejadian ke-berapa**
dan Gaji menulis barisnya.

**Cara kejadian lahir (urutan harian):** 04.05 Penanda "tidak absen pulang"
menulis lupa pulang dan lupa Masuk Kembali; 04.10 Pembuat catatan hari kerja
menulis telat dan pulang cepat di atas ambang 30 menit (KEH-151); 04.20
Penanda alpha menulis alpha (KEH-150). Masing-masing menulis satu baris
`kejadian_perlu_jelas` berstatus Terbuka beserta batasnya, lalu orangnya
diberi tahu. "Lupa absen masuk" tidak punya penanda sendiri: hari tanpa
absen menjadi kartu Alpha, dan orang yang sebenarnya hadir memilih sebab
"Lupa absen" (KEH-54, 63).

#### KEH-L35. Perlu Dijelaskan

- **Tujuan:** karyawan melihat semua hal yang harus ia jelaskan, batas
  waktunya, dan akibatnya kalau dibiarkan, tanpa bertanya ke HR (PRI-07).
- **Isi (HP, TAM-12):** tiga tab. **Perlu dijelaskan** (default), **Menunggu
  keputusan**, **Selesai** (Disetujui, Ditolak, Lewat batas; periode lama
  dimuat saat diminta, PRI-11).
  - Kartu: jenis (**Alpha**, **Lupa absen pulang**, **Lupa Masuk Kembali**,
    **Telat 42 menit**, **Pulang cepat 35 menit**), tanggal, sisa waktu
    ("Tinggal 2 hari", kuning bila tinggal 1 hari, merah di hari terakhir),
    dan **akibatnya dalam satu kalimat tanpa nominal** ("Kalau tidak dijelaskan
    hari ini tetap dihitung alpha", "dikenai denda lupa absen"; angka rupiah
    ada di Pendapatan Saya).
  - Terbaru atau terdekat batasnya di atas; yang sudah lewat batas tidak
    tampil di tab pertama.
  - Alpha yang berturut-turut tampil sebagai kartu terpisah per hari, dengan
    tombol **Jelaskan sama untuk hari berturut-turut** (KEH-152).
- **Tombol:** **Jelaskan** pada tiap kartu (ke KEH-L36). Kartu Ditolak yang
  masih dalam batas: **Ajukan ulang** (isian lama terisi, PRI-37 butir 5).
  Kartu Lewat batas: untuk **lupa absen** tombol **Ajukan terlambat**
  (KEH-155); untuk alpha dan telat tidak ada tombol, dengan penjelasan "Sudah
  lewat batas 3 hari. Bicarakan dengan HR" (KEH-59, 61).
- **Jalan keluar:** Kembali; kartu tidak hilang bila ditutup. Penjelasan yang
  sudah terkirim dibatalkan lewat BER-L07 selama Menunggu (KEH-155).
- **Beda jabatan:** semua yang diabsen lewat QR. Tidak tampil untuk yang
  dibayar per ritase (hari tanpa absen = Tidak jalan, KEH-81; absen trip tanpa
  denda, KEH-123) dan GM (KAR-67). HR, Pemilik: kejadian miliknya diputuskan
  penyetuju lain (KEH-156).

#### KEH-L36. Isi Penjelasan

- **Tujuan:** menjawab satu kejadian dengan jalur yang benar, supaya HR bisa
  memutuskan tanpa menanyakan ulang.
- **Isi (HP), langkah sesuai jenis (TAM-07):**
  - **Alpha**, 4 langkah: (1) **Sebab**, empat tombol: **Sakit tanpa surat**,
    **Sakit dengan surat dokter**, **Lupa absen (saya sebenarnya hadir)**,
    **Izin mendadak**; tidak ada "pakai jatah libur" (KEH-54). (2) **Hari**:
    hari ini saja, atau rangkaian hari berturut-turut yang masih dalam batas
    (KEH-152). (3) **Isian khas:** *sakit tanpa surat* alasan; lebih dari 2
    hari kerja muncul pesan "Sakit tanpa surat paling lama 2 hari. Pilih sakit
    dengan surat dokter" dan tombol **Ganti ke dengan surat** (KEH-153);
    *sakit dengan surat* foto surat (kamera atau galeri, TAM-08) **atau**
    **Surat menyusul** (aturan sama KEH-143); *lupa absen* **jam masuk** dan
    **jam pulang** (jam pulang boleh kosong bila memang belum pulang; bila
    ada absen masuk, jam masuk sudah terisi dan terkunci) serta alasan;
    *izin mendadak* alasan. (4) **Periksa dan Kirim.**
  - **Lupa absen pulang** dan **Lupa Masuk Kembali**, 3 langkah: (1) jam yang
    benar, dengan jam foto absen yang sudah terkirim ditampilkan sebagai bukti
    (KEH-91); (2) alasan (wajib); (3) periksa dan Kirim.
  - **Telat** dan **Pulang cepat**, 2 langkah: alasan (wajib, lampiran
    boleh); periksa dan Kirim.
- **Jam yang masuk akal:** jam masuk paling awal 2 jam sebelum jam masuk
  jadwal (KEH-111) dan sebelum jam pulang; jam pulang sesudah jam masuk dan
  sebelum 04.00 hari berikutnya (KEH-18). Di luar itu ditolak server dengan
  pesan yang menyebut batasnya.
- **Konfirmasi uang:** untuk lupa absen (masuk, pulang, Masuk Kembali) tombol
  Kirim **ditahan 3 detik** (TAM-15) dan menyebut "Ini dikenai denda lupa
  absen" beserta nominal yang dibaca dari pengaturan Gaji; kalau ini kejadian
  ke-5 atau lebih dalam periode, ditambah kalimat "Kejadian ke-5, ada tambahan
  denda" (KEH-154). Sebab lain konfirmasi biasa.
- **Pengajuan terlambat (hanya lupa absen yang lewat 3 hari, KEH-155):** banner
  kuning "Terlambat: wajib alasan, disahkan HR atau pemilik, dan tercatat
  terlambat"; isian sama; alasan keterlambatan dipisah dari alasan lupa.
- **Setelah Kirim:** "Terkirim. Menunggu keputusan HR atau pemilik." Untuk
  alpha yang dijelaskan sebagai lupa absen, hari itu "belum lengkap" dan tanpa
  lembur sampai disahkan (KEH-63).
- **Jalan keluar:** Kembali di tiap langkah tanpa kehilangan isian; Ulangi
  dari awal; sesudah terkirim Batalkan di BER-L07 selama Menunggu.
- **Beda jabatan:** sama dengan KEH-L35.

#### KEH-L37. Perlu Dijelaskan Tim

- **Tujuan:** HR dan pemilik melihat siapa yang belum menjelaskan sebelum batas
  habis, dan siapa yang tidak masuk berturut-turut, di satu layar.
- **Isi (PC), empat tab:**
  - **Belum dijelaskan:** kejadian berstatus Terbuka; nama, cabang, jenis,
    tanggal, sisa waktu; urut paling dekat batas. Saring: cabang, jenis, orang.
  - **Hampir lewat batas:** yang tinggal 1 hari atau kurang, sebagai
    jalan pintas.
  - **Menunggu keputusan:** daftar penjelasan Menunggu dengan lama menunggu;
    menekan membuka BER-L21 (keputusan tetap di kotak Persetujuan, tidak ada
    jalan kedua).
  - **Tidak masuk berturut-turut:** tanda KEH-55 (KEH-157): nama, hari ke-7
    jatuh pada tanggal berapa, sebab hari-harinya (sakit tanpa surat, izin,
    alpha), dan tombol **Sudah dilihat** dengan catatan.
- **Tombol:** hanya baca di tiga tab pertama; Sudah dilihat di tab keempat.
  Tidak ada tombol "Ingatkan" (pengingat berantai berjalan sendiri, TAM-22)
  dan tidak ada tombol menonaktifkan (diputuskan manusia lewat KAR-07).
- **Jalan keluar:** Kembali; Sudah dilihat bisa dibuka kembali dengan catatan.
- **Beda jabatan:** HR, Pemilik, GM semua cabang dan alasan; Admin HR melihat
  tanpa alasan; Kepala Toko dan Kepala Gudang hanya lingkupnya, hanya jenis,
  tanggal, dan sisa waktu (KEH-80); Finance dan karyawan lain tidak melihat.

#### KEH-L38. Keterangan Pembantu Putusan Penjelasan

- **Tujuan:** penyetuju tahu cukup untuk memutuskan tanpa membuka layar lain
  (BER-L21 "keterangan pembantu").
- **Isi (PC), di dalam BER-L21:**
  - **Kejadian asli:** angka dan jam yang tercatat server (jam foto absen, menit
    telat, status alpha), berdampingan dengan **yang diisi orangnya**; selisih
    yang janggal ditandai ("jam pulang diisi 03.50, jam foto terakhir 17.05").
  - **Foto absen hari itu:** hanya HR, Pemilik, GM; pembukaannya tercatat
    (KEH-20).
  - **Foto surat dokter:** hanya HR, Pemilik, GM; tercatat (KEH-144).
  - **Hitungan lupa absen periode ini:** "Kejadian ke-4 jenis lupa pulang"
    atau "Kejadian ke-5: kena tambahan" tanpa nominal (KEH-154), dan jumlah
    penjelasan sebelumnya di periode ini dan yang lalu (tanpa nominal).
  - **Bentrokan:** pengajuan lain pada tanggal itu, libur terjadwal, hari
    tutup.
  - **Label:** "Terlambat" (KEH-155), "Diisi lewat klarifikasi" (KEH-63), dan
    "Ajukan ulang ke-n".
- **Tombol:** milik BER-L21: Setujui, Tolak (alasan wajib), Cabut persetujuan
  (alasan wajib, KEH-158). **Penyetuju tidak mengubah jam yang diisi**: bila
  jamnya salah, Tolak dengan alasan dan orangnya Ajukan ulang (KEH-155).
- **Jalan keluar:** milik BER-L21.
- **Beda jabatan:** HR, Pemilik, GM (bukan untuk miliknya sendiri, KEH-156).

#### KEH-L39. Laporan Kebiasaan Lupa Absen

- **Tujuan:** pemilik melihat siapa yang sering lupa absen tanpa menunggu
  diberi tahu (KEH-65).
- **Isi (PC):** pilih periode (26 sampai 25, bawaan periode berjalan). Daftar
  orang yang lupa absen **lebih dari 4 kali** dalam periode itu: nama, cabang,
  jumlah **lupa masuk**, **lupa pulang**, dan **lupa Masuk Kembali** (tiga
  jenis terpisah, KEH-64, 87), dan jumlah penjelasan yang ditolak. Angka
  yang menyentuh ambang ditandai. Menekan nama membuka kejadiannya. **Tanpa
  nominal** (nominal milik Gaji).
- **Tombol:** hanya baca. Tanda baru muncul sebagai pemberitahuan ke layar ini
  (bagian 7).
- **Jalan keluar:** Kembali; periode lama dimuat saat diminta.
- **Beda jabatan:** Pemilik dan GM saja (KEH-65: laporan untuk pemilik; GM
  setara, KAR-67). HR tidak (data kebiasaan orang untuk pemilik).

### 3.9 Bagian 4D-5b: Lembur

Berlaku untuk KEH-L40 s.d. L43: error di jendela "OK, paham"; tombol Kirim dan Simpan terkunci sampai selesai dan tidak bisa ditekan dua kali; isian tidak hilang kalau sinyal putus (TAM-16); jam dari server (PRI-01); jam lembur, batas klaim, siapa boleh menyuruh, dan siapa boleh mengesahkan dijalankan **server** (WAJ-04), layar hanya menampilkan hasilnya. Tidak ada yang dihapus atau ditimpa (PRI-02). Pemilik data: lembur_terdeteksi, klaim_lembur, akses_foto_lembur milik Kehadiran; status dan keputusan klaim memakai **Mesin Pengajuan** (PRI-23, 37; BER-L04 s.d. L07, L20, L21): Pengajuan Saya, kartu status, Batalkan, Ajukan ulang, dan kotak Persetujuan **tidak digambar ulang di sini**. Nominal lembur milik Gaji (GAJ-12): Kehadiran hanya menyediakan **jam disahkan**.

**Cara lembur lahir:** saat Laporan Pulang terkirim, server menghitung jam terdeteksi (KEH-159). Bila lebih dari 0, satu baris `lembur_terdeteksi` berstatus Terbuka ditulis dan KEH-L40 muncul. Hitungan yang sama ditulis ke `hari_kerja` oleh Pembuat catatan hari kerja 04.10 dan dihitung ulang tiap koreksi. Tidak ada mesin yang mengklaim sendiri: klaim hanya dikirim orangnya.

#### KEH-L40. Ini Lembur?

- **Tujuan:** orang langsung menjawab selagi ingatannya segar, tanpa kehilangan lemburnya bila ia ragu (KEH-72).
- **Isi (HP, jendela):** "Kamu pulang 18.10, jadwal pulang 17.00. Terdeteksi lembur 1 jam. Ini lembur?" Tiga tombol: **Ya, klaim sekarang** (membuka langkah klaim di KEH-L41), **Nanti** (baris tetap Terbuka di Lembur Saya), **Bukan lembur** (ditandai tidak diklaim; baris tetap terlihat sampai batas supaya bisa dibuka lagi).
- **Tampil hanya bila** jam terdeteksi lebih dari 0 dan jabatan "dapat lembur" (KEH-25). Muncul sesudah Laporan Pulang terkirim, sebelum pertanyaan KEH-L10 bila berlaku (KEH-89).
- **Jalan keluar:** menutup jendela sama dengan Nanti; semua jawaban bisa diubah dari KEH-L41 sampai batas klaim.
- **Beda jabatan:** semua yang diabsen QR dan berjabatan "dapat lembur". Tidak tampil untuk jabatan gudang, driver, kenek, dan GM (KEH-25, 99, KAR-67).

#### KEH-L41. Lembur Saya

- **Tujuan:** orang melihat semua lemburnya, batas, dan statusnya tanpa bertanya ke HR (PRI-07).
- **Isi (HP, TAM-12):** tiga tab. **Belum diklaim** (default), **Menunggu keputusan**, **Selesai** (Disahkan, Ditolak, Hangus; periode lama dimuat saat diminta, PRI-11).
  - Kartu: tanggal, jadwal pulang dan jam pulang, jam terdeteksi, sisa waktu ("Tinggal 2 hari", kuning bila tinggal 1 hari, merah di hari terakhir), dan status. Hanya jam; **tanpa nominal** (nominal di slip).
  - Kartu Disahkan menampilkan jam disahkan; bila lebih kecil dari terdeteksi, alasan penurunan satu kalimat.
  - Kartu Hangus menulis "Lembur sekian jam tanggal sekian hangus. Bicarakan langsung dengan pemilik" (PRI-09).
- **Langkah klaim (TAM-07), dari tombol Klaim:** (1) **Foto kertas lembur** (kamera atau galeri, TAM-08; kertasnya bisa difoto kapan saja dalam batas); (2) **Yang menyuruh**: pilih nama dari daftar jabatan yang boleh menyuruh, tidak termasuk diri sendiri (KEH-163); (3) **Periksa dan Kirim**, tombol ditahan 3 detik karena menyangkut uang (TAM-15), tanpa nominal.
- **Tombol:** **Klaim** (kartu Belum diklaim); **Ajukan ulang** (kartu Ditolak dalam batas, isian lama terisi, PRI-37 butir 5); **Bukan lembur** atau **Klaim** untuk mengubah jawaban; pembatalan klaim lewat BER-L07 selama Menunggu.
- **Jalan keluar:** Kembali di tiap langkah tanpa kehilangan isian; Ulangi dari awal; kartu tidak hilang bila ditutup.
- **Beda jabatan:** semua yang diabsen QR dan berjabatan "dapat lembur". HR, Pemilik: lembur miliknya diputuskan penyetuju lain (KEH-164).

#### KEH-L42. Lembur Tim

- **Tujuan:** HR dan pemilik melihat siapa yang lembur dan klaim mana yang hampir hangus di satu layar.
- **Isi (PC), empat tab:**
  - **Terdeteksi, belum diklaim:** nama, cabang, tanggal, jam terdeteksi, sisa waktu; urut paling dekat batas. Saring: cabang, orang.
  - **Hampir hangus:** tinggal 1 hari atau kurang, sebagai jalan pintas.
  - **Menunggu keputusan:** klaim Menunggu dengan lama menunggu; menekan membuka BER-L21 (keputusan tetap di kotak Persetujuan, tidak ada jalan kedua).
  - **Hangus:** daftar jam yang hangus, agar pemilik tahu siapa yang perlu dibicarakan di luar sistem (PRI-09).
- **Tombol:** hanya baca. Tidak ada tombol "Ingatkan" (pengingat berantai berjalan sendiri, TAM-22) dan tidak ada tombol menghidupkan lembur yang hangus.
- **Jalan keluar:** Kembali; periode lama dimuat saat diminta.
- **Beda jabatan:** HR, Pemilik, GM semua cabang. Admin HR melihat tanpa foto. Kepala Toko (cabangnya) dan Kepala Gudang (departemennya) melihat nama, tanggal, dan jam (terdeteksi / diklaim / disahkan), tanpa foto dan tanpa nama penyuruh (KEH-80, 167). Finance dan karyawan lain tidak melihat.

#### KEH-L43. Keterangan Pembantu Putusan Klaim Lembur

- **Tujuan:** pengesah tahu cukup untuk memutuskan tanpa membuka layar lain (BER-L21 "keterangan pembantu").
- **Isi (PC), di dalam BER-L21:**
  - **Angka server:** jadwal pulang, jam foto pulang, jam tutup cabang yang dipakai, dan jam terdeteksi, berdampingan dengan jam diklaim.
  - **Foto kertas lembur** dan **nama penyuruh**: hanya HR, Pemilik, GM; pembukaannya tercatat (KEH-167).
  - **Riwayat:** jumlah lembur diklaim dan disahkan orang itu di periode ini; "Ajukan ulang ke-n"; label "hari lupa absen yang dijelaskan" (KEH-165).
  - **Bentrokan:** libur terjadwal, hari tutup, perbantuan, hari diminta masuk di hari libur.
- **Tombol:** milik BER-L21: Setujui, Tolak (alasan wajib), Cabut persetujuan (alasan wajib). **Setujui dapat menurunkan jam** (jam penuh, paling kecil 1, alasan wajib, tombol ditahan 3 detik dan menyebut jumlah jam); tidak dapat menaikkan (KEH-162).
- **Jalan keluar:** milik BER-L21.
- **Beda jabatan:** HR, Pemilik, GM (bukan untuk miliknya sendiri, KEH-164).

---

## 4. Data

Semua tabel punya kolom perusahaan (PRI-31), jejak dibuat dan diubah, tidak ada
yang dihapus (PRI-02), dan indeks pada kolom pencarian (PRI-14). Cabang dan
orang milik Karyawan; tabel di bawah hanya menunjuknya.

| Tabel | Isi penting | Dicari dengan | Dibaca modul lain | Bagian |
|---|---|---|---|---|
| jam_kerja_cabang | cabang, nama shift, urutan, jam masuk, jam pulang, lama istirahat, rentang mulai istirahat (awal dan akhir, kosong = tidak berlaku), berlaku dari, berlaku sampai, aktif | cabang + tanggal | Gaji, Tarik Data Kasir, Kinerja | 4D-1 |
| jam_tutup_kantor | cabang, jam, berlaku dari | cabang + tanggal | Kehadiran saja | 4D-1 |
| kelompok_giliran | cabang, nama kelompok, urutan | cabang | Kehadiran saja | 4D-1 |
| anggota_kelompok | orang, kelompok, berlaku dari, berlaku sampai | orang + tanggal | Kehadiran saja | 4D-1 |
| giliran_shift | orang, cabang, awal minggu (Senin), shift, asal (mesin, giliran awal, penempatan, ubah mendadak), alasan, oleh, kapan | orang + awal minggu | Kehadiran (hari kerja), Gaji | 4D-1 |
| radius_absen_cabang | cabang, meter, berlaku dari, alasan, oleh | cabang + tanggal | Kehadiran (absen) | 4D-1 |
| qr_cabang | cabang, kode, dibuat kapan dan oleh, mati pada (kosong = aktif) | kode | Kehadiran (absen) | 4D-1 |
| hari_tutup | tanggal, cabang (kosong = semua), alasan, dipasang oleh dan kapan, dipasang mundur, dibatalkan (siapa, kapan, alasan) | tanggal + cabang | Gaji, Tarik Data Kasir | 4D-1 |
| pengaturan_kehadiran | kunci, nilai, berlaku dari, oleh | kunci + tanggal | semua | 4D-1 |
| percobaan_absen | orang, waktu server, cabang QR, jenis yang dicoba, hasil (ditolak di langkah mana), titik dan jarak, QR yang dipakai | orang + tanggal | Kehadiran (peninjauan, KEH-19) | 4D-2a |
| catatan_absen | orang, hari kerja, jenis (masuk, istirahat, masuk kembali, pulang), cabang, waktu server, titik, jarak, foto (rujukan; tertutup; dihapus 60 hari), tanda perlu ditinjau, tanda menunggu laporan | orang + hari kerja | Gaji, Kinerja, Kehadiran (rekap) | 4D-2a |
| perbantuan | orang, tanggal, cabang asal, cabang tujuan, jawaban (perbantuan atau salah scan), shift yang dipakai, dipilih sendiri | cabang tujuan + tanggal | Kehadiran saja | 4D-2a |
| tanya_pindah | orang, cabang, tanggal ditanya, jawaban, pengajuan yang lahir | orang | Karyawan (KAR-56) | 4D-2a |
| catatan_istirahat | orang, hari kerja, mulai, selesai, menit lewat batas (dihitung server sekali), tanda "tidak istirahat karena sendiri" | orang + hari kerja | Gaji (akibat lewat batas, kelak) | 4D-2a |
| hari_kerja | orang, tanggal (satu per orang per tanggal, PRI-17), cabang, shift, jam kerja yang berlaku, jam masuk, jam pulang, jam istirahat dan masuk kembali, telat (menit) dan tanda dalam toleransi, pulang cepat (menit), lewat batas istirahat, status (Hadir, Libur terjadwal, Hari tutup, Izin, Sakit, Cuti, Alpha, Tidak jalan, atau belum ditentukan), asal status, catatan hari (daftar tanda), terkunci pada (kosong = belum) | orang + tanggal; cabang + tanggal | Gaji, Kinerja, Tarik Data Kasir (kelak) | 4D-2b |
| tinjauan_absen | catatan absen, hasil (Wajar, Perlu dikoreksi), alasan, oleh, kapan; keputusan baru menambah baris, yang lama tetap | catatan absen | Gaji (slip tertahan selama belum ada keputusan) | 4D-2b |
| tanda_pola_lokasi | jenis pola (3 luar titik dalam 7 hari kerja; dua orang titik nyaris sama), orang terkait, absen terkait, tanggal terdeteksi, sudah dilihat (oleh, kapan, catatan) | tanggal + orang | Kehadiran saja | 4D-2b |
| koreksi_absen | orang, hari kerja, jenis (jam masuk, jam pulang, cabang, tambah absen), nilai lama, nilai baru, alasan baku dan keterangan, oleh, kapan, nomor kelompok (banyak orang), susulan (ya bila slip sudah ditutup), membalik koreksi nomor berapa | orang + hari kerja | Gaji (koreksi susulan), Kehadiran (hitung ulang) | 4D-2b |
| akses_foto_absen | foto, dibuka oleh, kapan | foto; orang + tanggal | Kehadiran saja | 4D-2b |
| absen_trip | catatan absen, trip (rujukan Logistik), sumber (berangkat, ditambahkan kantor, lapor garasi, ditutup kantor), foto awak (satu rujukan dipakai bersama; tertutup; dihapus 60 hari), tanda diganti trip berikutnya | trip; orang + hari kerja | Gaji Driver (hanya hari ada trip), Kehadiran (rekap) | 4D-2c |
| laporan_pulang | orang, hari kerja, catatan absen pulang (rujukan), trip (kosong untuk absen QR), status (menunggu, terkirim), dikirim kapan (jam server), jam foto, jenis (biasa, susulan karena trip ditutup kantor), bensin perlu atau tidak, perkiraan nominal (bilangan bulat), rujukan permintaan bensin di Logistik | orang + hari kerja; trip | Kehadiran (rekap, klarifikasi 4D-5), Logistik (bensin) | 4D-3 |
| serah_terima | laporan pulang, pengirim, cabang atau departemen, isi, panjang huruf, jenis penerima (tim saya, orang tertentu), foto (rujukan, boleh dari galeri), dikirim kapan | pengirim + tanggal; cabang + tanggal | Kinerja (kelak, hanya baca) | 4D-3 |
| penerima_serah_terima | serah terima, orang penerima, status (belum dibaca, dibaca, tidak ada penerima), dibaca kapan (jam server) | orang + status; serah terima | Kehadiran saja | 4D-3 |
| keterangan_laporan | jenis induk (serah terima, laporan masalah, keadaan mobil), rujukan induk, isi, oleh, kapan; hanya ditambah | induk | Kehadiran saja | 4D-3 |
| laporan_masalah | pelapor, isi, foto (boleh dari galeri), menyangkut GM (ya atau tidak), asal (jendela Laporan Pulang atau menu), status (Diterima, Sedang ditindaklanjuti, Selesai), dikirim kapan | status + tanggal; pelapor | Kehadiran saja | 4D-3 |
| tindakan_laporan_masalah | laporan masalah, status baru, tanggapan (satu kalimat, opsional, tampil ke pelapor), oleh, kapan; tiap perubahan menambah baris | laporan masalah | Kehadiran saja | 4D-3 |
| keadaan_mobil | laporan pulang, trip, mobil (rujukan Logistik), driver pelapor, kondisi (Baik, Perlu perhatian), masalah, foto (rujukan, kamera atau galeri), status tindak lanjut (Baru, Sedang ditangani, Selesai; hanya bermakna untuk Perlu perhatian), dikirim kapan | status + tanggal; mobil | Logistik (servis, kelak), Keuangan (hanya rujukan biaya) | 4D-3 |
| tindak_lanjut_mobil | keadaan mobil, status baru, catatan (wajib untuk Selesai), oleh, kapan; tiap perubahan menambah baris | keadaan mobil | Kehadiran saja | 4D-3 |
| libur_pilihan | orang, periode (tanggal awal), tanggal, asal (pilih sendiri, terlambat, tukar, ubah langsung, pengganti), status (Berlaku, Dicabut, Diganti), dipilih kapan (jam server), dicabut (oleh, kapan, alasan) | orang + periode; cabang + tanggal | Gaji (hari libur dibayar, GAJ-14; kompensasi, GAJ-15), Kehadiran (hari_kerja), Kinerja (hanya baca) | 4D-4a |
| tanda_tidak_memilih_libur | orang, periode, ditandai kapan (jam server), memilih terlambat sesudahnya (ya atau tidak); satu per orang per periode | orang + periode | Gaji (denda, GAJ-16) | 4D-4a |
| ajakan_tukar | pengaju, teman, jenis (libur, shift), tanggal pengaju, tanggal teman (untuk shift: satu tanggal yang sama), batas jawab (dua hari sebelum tanggal yang lebih dekat), status baku Mesin Pengajuan (Menunggu, Disetujui = diterima, Ditolak, Dibatalkan, Hangus = batal otomatis), dijawab kapan | teman + status; pengaju + tanggal | Kehadiran (jadwal berubah, laporan tukar) | 4D-4a |
| permintaan_masuk_libur | orang, tanggal libur, diminta oleh, alasan, status (Diminta, Siap masuk, Dibatalkan), siap kapan, dibatalkan (oleh, kapan, alasan) | orang + tanggal; peminta | Gaji (kompensasi libur, GAJ-15, hanya bila absen masuk tercatat) | 4D-4a |
| libur_pengganti | permintaan masuk, orang, batas (tanggal masuk + 14 hari), tanggal dipilih (kosong sampai dipilih), status (Menunggu dipilih, Dipilih, Hangus) | orang + status; batas | Kehadiran saja | 4D-4a |
| pengajuan_tidak_masuk | orang, jenis (izin keperluan, izin duka, sakit tanpa surat, sakit dengan surat, cuti tahunan), label mendadak (ya atau tidak; ditulis server, KEH-142), tanggal mulai dan selesai, hubungan (duka), alasan, surat menyusul (ya atau tidak), status baku Mesin Pengajuan, diajukan kapan (jam server), diisi oleh (kosong bila sendiri), alasan diisikan | orang + tanggal; status + tanggal | Gaji (potongan GAJ-13, hari dibayar GAJ-14), Kehadiran (hari_kerja) | 4D-4b |
| tanggal_tidak_masuk | pengajuan, tanggal (hanya hari kerja orang itu, KEH-41), jenis hitungan (izin, izin mendadak, sakit tanpa surat, sakit dengan surat, cuti, duka), status mengikuti pengajuan; satu orang paling banyak satu baris berlaku per tanggal | orang + tanggal | Gaji, Kehadiran (hari_kerja, kalender "tidak masuk") | 4D-4b |
| surat_dokter | pengajuan, foto (rujukan; tertutup; dihapus 60 hari sesudah slip ditutup), diunggah kapan (jam server), masuk kembali pada (dari absen), dalam batas menyusul (ya atau tidak) | pengajuan | Kehadiran saja | 4D-4b |
| akses_surat_dokter | foto, dibuka oleh, kapan | foto; orang | Kehadiran saja | 4D-4b |
| tahun_cuti | orang, awal, akhir (satu tahun dari tanggal bergabung, mulai setelah masa kerja 1 tahun penuh), jatah (10) | orang + tanggal | Kehadiran saja | 4D-4b |
| gerak_cuti | tahun cuti, jenis gerak (pesan, pakai, kembali, hangus), jumlah hari, pengajuan, kapan; hanya ditambah, sisa = jumlah gerak | tahun cuti; pengajuan | Gaji (hanya baca; tidak ada uang, KEH-48) | 4D-4b |
| kejadian_perlu_jelas | orang, tanggal hari kerja, jenis (alpha, lupa absen pulang, lupa Masuk Kembali, telat, pulang cepat), asal (mesin yang menulis), angka asli (menit atau jam foto yang dipakai sebagai bukti), batas (tanggal kejadian + 3 hari pukul 23.59; atau 3 hari dari penolakan, KEH-62 dan 147), status (Terbuka, Menunggu keputusan, Selesai, Lewat batas), dibuat kapan (jam server); satu baris per orang + tanggal + jenis | orang + tanggal; status + batas | Gaji (hanya baca) | 4D-5a |
| penjelasan | satu atau lebih kejadian (rangkaian alpha berturut-turut, KEH-152), sebab (sakit tanpa surat, sakit dengan surat, lupa absen masuk, lupa absen pulang, lupa Masuk Kembali, izin mendadak, telat, pulang cepat), jam masuk dan jam pulang yang diisi, alasan, surat menyusul (ya atau tidak), terlambat (ya atau tidak), ajukan ulang ke-n, status baku Mesin Pengajuan, diajukan kapan (jam server), kejadian ke-n lupa absen dalam periode (ditulis server, KEH-154), pengajuan_tidak_masuk hasilnya (kosong bila bukan sakit atau izin) | orang + tanggal; status + diajukan kapan | Gaji (denda dan potongan, GAJ-13 dan 16), Kehadiran (hari_kerja) | 4D-5a |
| tanda_berturut | orang, tanggal hari ke-7, tanggal awal rangkaian, sebab per hari, sudah dilihat (oleh, kapan, catatan); satu baris per orang + rangkaian | orang; tanggal | Karyawan (KAR-08, hanya baca) | 4D-5a |
| lembur_terdeteksi | orang, hari kerja, cabang, jam pulang jadwal, jam pulang (jam foto), jam tutup cabang yang dipakai, jam terdeteksi (bilangan bulat 0 sampai 3; dihitung ulang server), pilihan orang (belum dijawab, klaim, nanti, bukan lembur), batas klaim (tanggal + 3 hari pukul 23.59; atau 3 hari sejak penjelasan disahkan, KEH-165), status (Terbuka, Diklaim, Disahkan, Hangus), tanda hari lupa absen yang dijelaskan | orang + hari kerja; status + batas | Gaji (hanya baca, lewat klaim), Kehadiran (rekap, catatan hari) | 4D-5b |
| klaim_lembur | lembur terdeteksi, jam diklaim (= jam terdeteksi saat dikirim; tidak diketik), foto kertas (rujukan; tertutup; dihapus 60 hari sesudah slip ditutup), penyuruh (orang), ajukan ulang ke-n, status baku Mesin Pengajuan, diajukan kapan (jam server), jam disahkan (sama atau lebih kecil), alasan penurunan, disahkan oleh dan kapan, dicabut (oleh, kapan, alasan) | orang + hari kerja; status + diajukan kapan | Gaji (jam disahkan, GAJ-12) | 4D-5b |
| akses_foto_lembur | foto, dibuka oleh, kapan | foto; orang | Kehadiran saja | 4D-5b |

`pengajuan_tidak_masuk` (4D-4b) mendapat satu kolom **asal** (diajukan biasa, diisikan atas nama, lewat penjelasan): penjelasan sakit atau izin mendadak yang disetujui menulis satu baris di tabel itu, tanpa pemeriksaan batas H-2 atau 3 hari (batasnya sudah dipakai KEH-58), dengan label "lewat penjelasan" (KEH-153). `hari_kerja.catatan_hari` memuat "Diisi lewat klarifikasi" (KEH-63).

`hari_kerja` hanya ditulis server (mesin dan hitung ulang setelah koreksi); tidak ada layar yang mengetik angka telat atau lembur. Satu orang hanya punya satu `giliran_shift` per awal minggu; satu cabang
hanya punya satu QR aktif; titik lokasi **tidak** disimpan di sini (milik
Karyawan, KAR-25). Untuk libur: hari_kerja berstatus Libur terjadwal dibaca dari libur_pilihan yang Berlaku (hanya ditulis server); satu orang paling banyak satu libur Berlaku per tanggal, dan libur pengganti tidak ikut menghitung jatah periodenya (KEH-138). Satu orang paling banyak satu catatan absen sejenis per hari kerja
(untuk 4D-2a: satu masuk, satu istirahat, satu masuk kembali, satu pulang). Untuk absen trip: satu masuk (Berangkat trip pertama) dan satu pulang yang berlaku (trip terakhir); baris pulang trip sebelumnya tetap tersimpan bertanda diganti. Absen trip memakai tabel `catatan_absen` yang sama dengan absen QR; `absen_trip` hanya menyimpan asalnya.

---

## 5. Tindakan bernama dan isi awal hak

Lingkup S = semua cabang; C = cabang atau departemennya sendiri. Pemilik dan GM
punya semua tindakan (KAR-67).

| Tindakan | HR | Admin HR | Kepala Toko | Kepala Gudang | Finance | Karyawan lain |
|---|---|---|---|---|---|---|
| lihat jam kerja cabang | S | S | — | — | — | cabangnya (di Jadwal Saya) |
| ubah jam kerja cabang | S | — | — | — | — | — |
| lihat giliran shift | S | S | C | C | — | — |
| isi kelompok giliran awal | S | — | C | C | — | — |
| ubah shift langsung (mendadak) | S | — | C | C | — | — |
| lihat lokasi dan QR cabang | S | S | — | — | — | — |
| ubah radius absen | — | — | — | — | — | — |
| cetak QR | S | — | — | — | — | — |
| buat ulang QR | S | — | — | — | — | — |
| pasang atau batalkan hari tutup | S | — | — | — | — | — |
| lihat hari tutup | S | S | C | C | S | cabangnya |
| lihat Jadwal Saya (diri sendiri) | S | S | S | S | S | ya (yang diabsen) |
| lihat jadwal teman satu cabang | C | C | C | C | C | ya, cabang sendiri (KEH-107) |
| absen sendiri (masuk, istirahat, masuk kembali, pulang) | S | S | S | S | S | ya (yang diabsen, bukan per ritase) |
| lihat daftar perbantuan | S | S | C | C | — | — |
| menjawab "sudah pindah cabang?" | S | S | S | S | S | ya (diri sendiri) |
| lihat percobaan absen yang ditolak | S | — | — | — | — | — |
| lihat daftar tinjau absen dan tanda pola | S | S | C | C | — | — |
| putuskan absen luar titik (Wajar, Perlu dikoreksi) | S | — | — | — | — | — |
| koreksi absen (satuan dan banyak orang), tidak untuk dirinya sendiri | S | — | — | — | — | — |
| lihat riwayat koreksi | S | S | — | — | S | — |
| lihat Foto Absen Hari Ini | S | — | C | C | — | — |
| lihat catatan hari kerja dan rekap orang lain | S | S | C | C | S | — |
| lihat kehadiran sendiri | S | S | S | S | S | ya (yang diabsen) |
| lihat Absen Trip Saya | — | — | — | — | — | ya (yang dibayar per ritase) |
| lihat Absen Trip Hari Ini dan foto awak | S | S (tanpa foto) | — | S | S (tanpa foto) | — |
| kirim Laporan Pulang (sendiri) | S | S | S | S | S | ya (yang diabsen; driver per trip) |
| lihat serah terima untuk dirinya (Serah Terima Saya) | S | S | S | S | S | ya |
| lihat Serah Terima Tim | S | — | C | C | — | — |
| kirim laporan masalah | S | S | S | S | S | ya (termasuk per ritase) |
| baca laporan masalah dan ubah statusnya | — | — | — | — | — | — |
| lihat statusnya laporan masalah sendiri | S | S | S | S | S | ya |
| lihat dan ubah status Keadaan Mobil | — | — | — | S | S | — |
| lihat status keadaan mobil sendiri | — | — | — | — | — | ya (driver) |
| pilih dan ubah libur sendiri (jatah periode) | S | S | S | S | S | ya (yang punya jatah) |
| lihat libur cabang (kalender, nama) | S | S | C | C | — | teman satu cabang saja, di KEH-L26 (KEH-107) |
| lihat daftar belum memilih libur | S | S | C | C | — | — |
| ubah libur langsung (mendadak, KEH-45) | S | — | C | C | — | — |
| cabut libur seseorang | S | — | — | — | — | — |
| ajak tukar libur atau shift | S | S | S | S | S | ya (teman satu cabang) |
| jawab ajakan tukar | S | S | S | S | S | ya (hanya ajakan untuk dirinya) |
| lihat laporan tukar per orang | S | S | C | C | — | — |
| minta masuk di hari libur | S | — | C | C | — | — |
| menjawab Siap masuk dan memilih libur pengganti | S | S | S | S | S | ya (hanya untuk dirinya) |
| ajukan izin, sakit, atau cuti (diri sendiri) | S | S | S | S | S | ya (yang diabsen QR) |
| susulkan surat dokter (diri sendiri) | S | S | S | S | S | ya |
| lihat sisa cuti sendiri | S | S | S | S | S | ya |
| putuskan izin, sakit, cuti (bukan miliknya sendiri) | S | — | — | — | — | — |
| cabut persetujuan izin, sakit, cuti | S | — | — | — | — | — |
| buka foto surat dokter | S | — | — | — | — | — |
| isikan pengajuan atas nama orang lain (bukan dirinya) | S | — | — | — | — | — |
| lihat kalender tidak masuk (tanggal dan status) | S | S | C | C | — | teman satu cabang, tanpa status (KEH-107) |
| lihat jenis dan alasan pengajuan orang lain | S | — | — | — | — | — |
| lihat dan jelaskan kejadian sendiri (Perlu Dijelaskan) | S | S | S | S | S | ya (yang diabsen QR) |
| putuskan penjelasan (bukan miliknya sendiri) | S | — | — | — | — | — |
| cabut persetujuan penjelasan | S | — | — | — | — | — |
| lihat Perlu Dijelaskan Tim | S | S (tanpa alasan) | C (jenis, tanggal, sisa waktu) | C (jenis, tanggal, sisa waktu) | — | — |
| lihat alasan dan foto penjelasan orang lain | S | — | — | — | — | — |
| tandai "sudah dilihat" tidak masuk berturut-turut | S | — | — | — | — | — |
| lihat Laporan Kebiasaan Lupa Absen | — | — | — | — | — | — |
| lihat dan jawab lembur sendiri (Lembur Saya, Ini lembur?) | S | S | S | — | S | ya (jabatan "dapat lembur", diabsen QR) |
| kirim klaim lembur sendiri | S | S | S | — | S | ya (jabatan "dapat lembur") |
| sahkan, turunkan jam, atau tolak klaim lembur (bukan miliknya sendiri) | S | — | — | — | — | — |
| cabut pengesahan lembur | S | — | — | — | — | — |
| buka foto kertas lembur dan nama penyuruh | S | — | — | — | — | — |
| lihat Lembur Tim | S | S (tanpa foto) | C (nama, tanggal, jam; tanpa foto dan penyuruh) | C (sama) | — | — |

Yang kosong di semua kolom hanya dimiliki Pemilik dan GM (Laporan Kebiasaan Lupa Absen, KEH-157; radius, KEH-104;
baca dan ubah laporan masalah, KEH-93). Pengecualian GM di laporan masalah:
yang menyangkut GM hanya Pemilik (KEH-128).

---

## 6. Mesin otomatis

Semua punya penjaga (PRI-33): tiap jalan tercatat; gagal atau tidak jalan di
jadwalnya muncul di "perlu perhatian" GM; terlewat dikejar tanpa dobel.

| Mesin | Jadwal (pengaturan, PRI-32) | Kerjanya | Bagian |
|---|---|---|---|
| Penggilir shift | Tiap Senin 00.05 | Untuk tiap cabang bershift lebih dari satu: menukar shift kelompok untuk minggu itu (yang pagi menjadi siang dan sebaliknya) dan menulis `giliran_shift`. Kunci "cabang + awal minggu" mencegah dobel kalau dijalankan dua kali | 4D-1 |
| Pemeriksa giliran | Tiap hari 06.00 | Mencari cabang bershift ganda yang kelompoknya belum diisi, dan orang tanpa shift minggu itu | 4D-1 |

Mesin yang tidak jalan di Senin dikejar saat jalan lagi, menulis minggu yang
terlewat berurutan tanpa dobel (PRI-33 butir 3). Selama belum dikejar, hari
kerja orang yang shiftnya belum tertulis berstatus "shift belum ditentukan"
dan tidak dihitung telat (KEH-07).

| Penghapus foto absen | Tiap hari 02.00 | Menghapus foto yang lebih dari 60 hari (KEH-15); jam dan angka tetap; satu baris per jalan ke Riwayat Mesin | 4D-2a |
| Penanda "tidak absen pulang" | Tiap hari 04.05 | Absen masuk tanpa pulang sampai batas 04.00 ditandai untuk "Perlu Dijelaskan" (dikerjakan 4D-5; di sini hanya pemicunya) | 4D-2a |
| Pembuat catatan hari kerja | Tiap hari 04.10 (sesudah batas pulang 04.00) | Menulis `hari_kerja` kemarin untuk semua orang: jam masuk dan pulang dari absen, telat dan pulang cepat dihitung sekali dengan jam kerja yang berlaku (KEH-21), status menurut urutan KEH-118. Hari tanpa absen dan tanpa pengajuan dibiarkan "belum ditentukan" sampai mesin penanda alpha (4D-5) menandainya; orang per ritase tanpa absen langsung Tidak jalan (KEH-81). Kunci "orang + tanggal" mencegah dobel; hari yang terlewat dikejar berurutan | 4D-2b |
| Pendeteksi pola lokasi | Tiap hari 05.00 | Mencari dua pola KEH-115 dan menulis `tanda_pola_lokasi` baru (sekali per kejadian); ambangnya dibaca dari pengaturan | 4D-2b |

Absen trip **tidak punya mesin sendiri**: ditulis langsung oleh pintu trip Logistik (KEH-120), dan Pembuat catatan hari kerja memperlakukannya sebagai absen biasa tanpa telat dan pulang cepat (KEH-99). Tanda trip menggantung memakai mesin LOG-31 (milik Logistik, 4F).

| Mesin | Jadwal (pengaturan, PRI-32) | Kerjanya | Bagian |
|---|---|---|---|
| Pembatal ajakan tukar | Tiap hari 00.05 | Ajakan Menunggu yang batas jawabnya sudah lewat diubah menjadi Hangus (batal otomatis); pengaju diberi tahu. Kunci "ajakan" mencegah dobel | 4D-4a |
| Pencatat tidak memilih libur | Tiap hari 00.10 | Pada tanggal 26 menulis satu tanda_tidak_memilih_libur untuk tiap orang yang punya jatah dan belum lengkap pada penutupan; tidak untuk yang mulai kerja sesudah jendela tertutup (KEH-135). Kunci "orang + periode"; hari yang terlewat dikejar tanpa dobel | 4D-4a |
| Penghangus libur pengganti | Tiap hari 00.15 | libur_pengganti Menunggu dipilih yang batasnya sudah lewat menjadi Hangus (KEH-138) | 4D-4a |

Pengingat memilih libur dan libur pengganti memakai pengingat berantai biasa
(TAM-22, KEH-132), bukan mesin sendiri.

| Mesin | Jadwal (pengaturan, PRI-32) | Kerjanya | Bagian |
|---|---|---|---|
| Penutup tahun cuti | Tiap hari 00.20 | Untuk tahun cuti yang berakhir kemarin: menulis satu gerak "hangus" sebesar sisa dan membuka tahun cuti berikutnya bila orangnya masih aktif. Kunci "tahun cuti" mencegah dobel; yang terlewat dikejar tanpa dobel | 4D-4b |
| Penghapus surat dokter | Tiap hari 02.30 | Menghapus foto surat 60 hari sesudah slip periodenya ditutup (KEH-144); catatan dan hari tetap; satu baris per jalan ke Riwayat Mesin | 4D-4b |

**4D-4b tidak punya mesin pemutus.** Pengajuan tidak pernah diputuskan mesin
(PRI-37 butir 4). Batas menyusulkan surat (3 hari sesudah masuk kembali)
dihitung server saat surat diunggah dan saat hari kerja dihitung ulang,
bukan oleh mesin sendiri. Penanda alpha (4D-5) wajib melewati hari yang
masih punya pengajuan Menunggu atau Diperiksa (KEH-147). Hitung ulang hari
kerja setelah surat masuk, persetujuan, penolakan, atau pencabutan memakai
fungsi yang sama dengan koreksi (WAJ-04).

**4D-3 tidak punya mesin baru.** Laporan menunggu dibaca oleh Penanda "tidak
absen pulang" (04.05): absen pulang yang masih menunggu laporan pada batas
04.00 ditandai sebagai lupa absen pulang (KEH-91), kecuali laporan trip
(KEH-101, 123). Pengingat Keadaan Mobil dan Laporan Pulang trip memakai
pengingat berantai biasa (TAM-22), bukan mesin sendiri.

**4D-5a: dua mesin baru, tiga mesin lama menulis kejadian.**

| Mesin | Jadwal (pengaturan, PRI-32) | Kerjanya | Bagian |
|---|---|---|---|
| Penanda alpha | Tiap hari 04.20 (sesudah Pembuat catatan hari kerja 04.10) | Untuk hari kemarin: tiap orang yang diabsen lewat QR dan hari kerjanya masih **belum ditentukan** (KEH-118) ditandai **Alpha** dan ditulis satu `kejadian_perlu_jelas` berstatus Terbuka. **Dilewati:** hari yang masih punya pengajuan Menunggu atau Diperiksa (KEH-147); hari Libur terjadwal, Hari tutup, Izin, Sakit, Cuti; orang per ritase (Tidak jalan); GM; orang sebelum tanggal masuk atau sesudah tanggal nonaktif; orang yang jabatannya tidak diabsen menurut pengaturan jabatan (KEH-53). Kunci "orang + tanggal" mencegah dobel; hari yang terlewat dikejar berurutan; gagal atau tidak jalan di jadwalnya memberi tahu Pemilik (KEH-52, PRI-33) | 4D-5a |
| Pencatat tidak masuk berturut-turut | Tiap hari 04.25 | Menghitung hari kerja berturut-turut berstatus Sakit tanpa surat, Izin, atau Alpha (libur terjadwal dan hari tutup tidak memutus dan tidak menambah; absen Hadir memutus). Pada hari ke-7 menulis satu `tanda_berturut` per rangkaian dan memberi tahu HR dan Pemilik (KEH-157). Kunci "orang + rangkaian" | 4D-5a |

Mesin lama menulis kejadian: **Penanda "tidak absen pulang" (04.05)** juga
menulis lupa pulang dan lupa Masuk Kembali (KEH-87, 91); **Pembuat catatan hari
kerja (04.10)** juga menulis telat dan pulang cepat di atas ambang 30 menit
(KEH-151). Pengingat batas dan pengingat penjelasan menunggu memakai pengingat
berantai biasa (TAM-22), bukan mesin sendiri. Batas 3 hari dinilai server saat
layar dibuka atau Kirim ditekan (jam server), bukan oleh mesin; baris
kejadian berubah menjadi Lewat batas saat dibaca pertama kali sesudah batas.
Hasil penjelasan yang disetujui, ditolak, atau dicabut memicu **hitung ulang
satu hari kerja** dengan fungsi yang sama dengan koreksi (WAJ-04).

**4D-5b: satu mesin baru, dua mesin lama menulis lembur.**

| Mesin | Jadwal (pengaturan, PRI-32) | Kerjanya | Bagian |
|---|---|---|---|
| Penghangus klaim lembur | Tiap hari 04.30 (sesudah Penanda alpha 04.20) | Tiap `lembur_terdeteksi` berstatus Terbuka yang batas klaimnya sudah lewat diubah menjadi **Hangus**, lalu orangnya diberi tahu apa yang hangus dan kepada siapa bicara (PRI-09, KEH-161). Klaim yang ditolak dan lewat batas juga menjadi Hangus. Kunci "lembur terdeteksi" mencegah dobel; yang terlewat dikejar berurutan; gagal atau tidak jalan memberi tahu Pemilik dan GM (PRI-33) | 4D-5b |

Jam lembur terdeteksi dihitung oleh **satu fungsi server** yang dipanggil tiga kali: saat Laporan Pulang terkirim (untuk pertanyaan "Ini lembur?", KEH-160), oleh **Pembuat catatan hari kerja (04.10)** yang menuliskannya ke `hari_kerja`, dan saat hitung ulang setelah koreksi atau penjelasan (WAJ-04). Tidak ada rumus kedua.

Setiap koreksi (KEH-L13) memicu **hitung ulang satu hari kerja** di server
dengan fungsi yang sama dengan mesin di atas (WAJ-04); tidak ada rumus kedua.


**Pintu baca jam buka** (bukan mesin; fungsi baca): `jam_buka_cabang(cabang,
tanggal)` mengembalikan jam masuk shift paling pagi sampai jam pulang shift
terakhir (kantor: sampai jam tutup kantor), atau kosong pada hari tutup dan
untuk cabang tanpa kasir (KEH-106). Dipakai Tarik Data Kasir (PRI-41 butir 4).

---

## 7. Pemberitahuan (titipan 4J)

| Pemberitahuan | Kepada | Antrean, Beranda, atau layar | Alasan |
|---|---|---|---|
| Kelompok giliran belum diisi (cabang bershift ganda) | Kepala cabang, HR | Antrean | Mesin tidak bisa menggilir |
| Penggilir shift tidak jalan Senin | GM, Pemilik | Antrean | PRI-33 butir 2 |
| Orang belum punya shift minggu ini | HR | Antrean bila lebih dari 1 hari | Telat tidak bisa dihitung |
| Shift diubah langsung (KEH-45) | Orang yang diubah | Antrean | Ia harus datang pada jam lain |
| Jam kerja cabang akan berubah | Orang di cabang itu | Pengumuman (Papan, PRI-35) | Menyangkut telat |
| Radius diubah | GM | Beranda | Memengaruhi tanda "perlu ditinjau" |
| QR dibuat ulang | Kepala cabang, HR | Antrean (sampai ditandai "sudah ditempel") | QR lama mati; cabang tidak bisa absen sampai yang baru dipasang |
| Hari tutup dipasang | Orang di cabang itu | Pengumuman (Papan) | Mereka harus tahu tidak perlu masuk |
| Hari tutup dipasang mundur | HR | Layar saja (hasil periksa) | Bukan tugas |
| Hari tutup dibatalkan | Orang di cabang itu | Beranda | Perlu masuk lagi |
| Orang perbantuan tanpa shift yang cocok | Kepala cabang tujuan | Antrean | Shift hari itu dipilih sendiri; perlu dicek |
| Penolakan istirahat karena penjaga | Orang yang menekan | Layar saja | Menyebut siapa istirahat sampai jam berapa |
| Penjaga satu-satunya tidak istirahat | HR, Pemilik | Layar saja (catatan hari kerja) | Terlihat tanpa menjadi tugas |
| Usulan pindah cabang (jawaban Ya) | HR, Pemilik | Antrean (Mesin Pengajuan) | KEH-27 |
| Pulang menunggu laporan | Orang itu | Antrean | Absen pulang belum tercatat; diteruskan ke 4D-3 |
| Ada absen luar titik menunggu putusan | HR, Pemilik | Antrean | Slip orang itu tidak bisa ditutup (KEH-14) |
| Slip hendak ditutup, masih ada absen menunggu putusan | HR, Pemilik | Antrean | PRI-07; menyebut nama dan tanggalnya |
| Tanda pola lokasi baru | HR, Pemilik | Layar saja (KEH-L12) | Bukan tugas; hanya terlihat |
| Absen dikoreksi | Orang yang dikoreksi | Beranda | Ia berhak tahu jamnya berubah dan kenapa |
| Koreksi susulan dicatat | HR, Finance | Layar saja (riwayat koreksi) | Dihitung Gaji di periode berikutnya |
| Orang ditambahkan ke trip yang sudah berangkat | Orang itu | Layar saja (KEH-L18) | Absen masuknya tercatat saat itu |
| Trip ditutup kantor, Laporan Pulang menunggu | Driver; Kepala Gudang | Antrean (driver); perlu perhatian (Kepala Gudang) | KEH-101; tanpa denda |
| Serah terima baru untuk saya atau tim saya | Penerima | Jendela baca setelah absen masuk (KEH-L21); 7 hari terakhir | KEH-92, 126 |
| Serah terima tanpa penerima | Kepala cabang atau Kepala Gudang, HR | Layar saja (KEH-L22) | Bukan tugas (KEH-127) |
| Laporan masalah baru | GM, Pemilik (yang menyangkut GM: Pemilik saja) | Antrean (satu butir per laporan) | Ia harus dibaca; penting dan berbatas waktu |
| Status laporan masalah berubah atau ada tanggapan | Pelapor | Beranda | Ia berhak tahu tanpa bertanya |
| Keadaan mobil Perlu perhatian | Kepala Gudang, Finance | Antrean berantai tiap pagi sampai Selesai | KEH-94, 130; berhenti begitu salah satu menandai Selesai |
| Status keadaan mobil berubah | Driver pelapor | Layar saja (KEH-L18) | KEH-130 |
| Laporan Pulang menunggu setelah foto terkirim | Orang itu | Antrean (sudah ada, "Pulang menunggu laporan") | KEH-89, 91; kejar sebelum 04.00 |
| Jendela memilih libur terbuka, jatah belum lengkap | Orang itu | Antrean berantai H-7, H-3, H-1 sebelum penutupan (TAM-22) | Tanpa jadwal, hari tidak masuk menjadi alpha (KEH-132) |
| Jatah libur belum lengkap sesudah jendela tertutup | HR, kepala cabang | Layar saja (tab Belum memilih, KEH-L27) | Bukan tugas; denda otomatis, HR tidak mengisikan |
| Libur diubah langsung atau dicabut | Orang itu | Antrean | Ia harus tahu tanggal liburnya berpindah (KEH-45, 131) |
| Ajakan tukar masuk | Teman yang diajak | Antrean | Harus dijawab sebelum batas H-2 (KEH-44) |
| Ajakan tukar diterima | Pengaju | Beranda | Jadwalnya sudah berubah (KEH-43) |
| Ajakan tukar ditolak atau batal otomatis | Pengaju | Beranda, dengan tombol ke izin biasa | KEH-44 |
| Diminta masuk di hari libur | Orang itu | Antrean | Ia menekan Siap masuk dan memilih pengganti (KEH-137) |
| Permintaan masuk dibatalkan | Orang itu | Beranda | Ia tidak perlu masuk |
| Libur pengganti belum dipilih, tinggal 3 hari | Orang itu | Antrean | Hangus bila terlewat (KEH-138) |
| Pengajuan izin, sakit, atau cuti menunggu | HR, Pemilik (penyetuju lain bila milik HR) | Antrean berantai tiap hari sampai diputuskan (TAM-22); lebih dari 2 hari ikut perlu perhatian Pemilik dan GM (PRI-37) | Hari itu tidak bisa ditentukan sebelum diputuskan (KEH-147) |
| Pengajuan diputuskan (disetujui atau ditolak) | Pengaju | Beranda; yang ditolak dengan alasan dan tombol Ajukan ulang | Ia berhak tahu (KEH-38) |
| Izin ditolak sesudah tanggalnya lewat | Pengaju | Antrean, dengan "hari itu menjadi alpha; klarifikasi dalam 3 hari" | KEH-62, 147 |
| Persetujuan dicabut | Pengaju | Antrean | Ia harus tahu hari itu kembali dihitung (KEH-148) |
| Diisikan atas nama | Orang itu | Antrean | Ia harus tahu ada pengajuan atas namanya (KEH-148) |
| Surat menyusul, tinggal 1 hari | Pengaju | Antrean | Lewat itu tetap sakit tanpa surat (KEH-143) |
| Sisa cuti akan hangus dalam 30 hari | Orang itu | Beranda | Tidak diuangkan (KEH-48) |
| Sakit dengan surat, surat belum menyusul sampai masuk kembali | HR | Layar saja (KEH-L33) | Bukan tugas |
| Kejadian baru perlu dijelaskan (alpha, lupa pulang, lupa Masuk Kembali, telat, pulang cepat) | Orang itu | Antrean, menyebut tanggal, batas, dan akibat tanpa nominal | PRI-07; KEH-58 |
| Sisa 1 hari dan hari terakhir batas penjelasan | Orang itu | Antrean (pengingat berantai); Beranda di hari terakhir | PRI-07; KEH-58 |
| Batas penjelasan terlewat | Orang itu | Beranda: "sudah lewat batas; bicarakan dengan HR" (lupa absen: tombol Ajukan terlambat) | KEH-59, 60, 61 |
| Penjelasan menunggu keputusan | HR, Pemilik (penyetuju lain bila milik HR) | Antrean berantai tiap hari sampai diputuskan (TAM-22); lebih dari 2 hari ikut perlu perhatian Pemilik dan GM (PRI-37) | Slip orang itu tidak bisa ditutup (KEH-69) |
| Penjelasan diputuskan | Pengaju | Beranda; ditolak dengan alasan dan tombol Ajukan ulang bila masih dalam batas | KEH-155 |
| Slip hendak ditutup, masih ada penjelasan menunggu | HR, Pemilik | Antrean, menyebut nama dan tanggal | KEH-69; PRI-07 |
| Persetujuan penjelasan dicabut | Pengaju | Antrean | Hari itu kembali dihitung (KEH-158) |
| Tanda tidak masuk berturut-turut (hari ke-7) | HR, Pemilik | Antrean sampai ditandai Sudah dilihat | KEH-55, 157; KAR-08 |
| Orang lupa absen lebih dari 4 kali dalam periode | Pemilik, GM | Layar saja (KEH-L39) | Bukan tugas; KEH-65 |
| Penanda alpha atau pencatat berturut-turut tidak jalan | Pemilik, GM | Perlu perhatian | KEH-52; PRI-33 butir 2 |
| Lembur terdeteksi, belum diklaim | Orang itu | Jendela "Ini lembur?" (KEH-L40); lalu antrean berantai H-1 dan hari terakhir (TAM-22) | PRI-07; KEH-72, 161 |
| Klaim lembur menunggu keputusan | HR, Pemilik (penyetuju lain bila milik HR) | Antrean berantai tiap hari sampai diputuskan (TAM-22); lebih dari 2 hari ikut perlu perhatian Pemilik dan GM (PRI-37) | Slip orang itu tidak bisa ditutup (KEH-69) |
| Klaim lembur diputuskan | Pengaju | Beranda; ditolak dengan alasan dan tombol Ajukan ulang bila masih dalam batas; disahkan lebih kecil dengan alasan penurunan | KEH-162 |
| Lembur hangus | Orang itu | Beranda: jam yang hangus dan "bicarakan dengan pemilik" | PRI-09; KEH-161 |
| Pengesahan lembur dicabut | Pengaju | Antrean | Jamnya kembali tidak dibayar (KEH-166) |
| Slip hendak ditutup, masih ada klaim lembur menunggu | HR, Pemilik | Antrean, menyebut nama dan tanggal | KEH-69; PRI-07 |
| Penghangus klaim lembur tidak jalan | Pemilik, GM | Perlu perhatian | PRI-33 butir 2 |

---

## 8. Pengaturan (titipan 4J)

Semua melalui kerangka Pengaturan 4B (BER-L40, L41), bertanggal berlaku
(WAJ-07), dengan draf pengumuman (PRI-35 butir 2).

| Pengaturan | Angka awal | Wajib diumumkan | Boleh dikecualikan per orang (PRI-26) |
|---|---|---|---|
| Jam kerja per shift per cabang | diisi pemilik saat tayang | **ya** | ya, lewat Daftar Pengecualian (KEH-09) |
| Lama istirahat dan rentang mulai, per shift | kosong | **ya** | tidak |
| Jam tutup kantor | 20.00 | **ya** | tidak |
| Radius titik lokasi | 100 meter | ya (ke orang di cabang itu; boleh "tidak perlu diumumkan" dengan alasan) | tidak |
| Jadwal mesin Penggilir shift | Senin 00.05 | tidak | tidak |
| Jadwal Pemeriksa giliran | 06.00 | tidak | tidak |
| Absen masuk paling awal sebelum jam masuk (KEH-111) | 2 jam | ya | tidak |
| Jeda paling cepat absen pulang | 15 menit | ya | tidak |
| Batas absen pulang masuk hari sebelumnya | 04.00 | ya | tidak |
| Foto absen dihapus setelah | 60 hari | ya | tidak |
| Hari berturut-turut di cabang lain sebelum ditanya pindah | 7 hari kerja | tidak | tidak |
| Jabatan penjaga cabang dan jumlah minimum | Kasir; 1 orang | ya | tidak |
| Jadwal Penghapus foto absen | 02.00 | tidak | tidak |
| Absen luar titik: jumlah dan jendela untuk pola 1 | 3 kali dalam 7 hari kerja | tidak | tidak |
| Pola titip absen: selisih titik antar orang | kurang dari 10 meter | tidak | tidak |
| Jadwal Pembuat catatan hari kerja | 04.10 | tidak | tidak |
| Jadwal Pendeteksi pola lokasi | 05.00 | tidak | tidak |
| Toleransi telat (KEH-22; milik Kehadiran, dibaca Gaji) | 5 menit | tidak (angkanya tidak diumumkan, KEH-22) | tidak |
| Panjang paling sedikit serah terima (KEH-90) | 20 huruf | ya | tidak |
| Serah terima yang muncul sebagai jendela (KEH-126) | 7 hari terakhir | tidak | tidak |
| Jatah libur per periode (KEH-31) | 4 hari | ya | tidak |
| Paling banyak orang libur per cabang per hari (KEH-34) | 2 (cabang berisi 2 orang: 1) | ya | tidak |
| Paling banyak libur di akhir pekan per periode (KEH-35, 134) | 1 | ya | tidak |
| Jarak antar hari libur (KEH-35, 134) | 5 hari | ya | tidak |
| Batas tukar (KEH-44) | H-2 | ya | tidak |
| Jendela memilih libur dibuka (KEH-132) | tanggal 10 | ya | tidak |
| Jendela memilih libur ditutup (KEH-132) | tanggal 25, pukul 23.59 | ya | tidak |
| Pengingat memilih libur (KEH-132) | H-7, H-3, H-1 | tidak | tidak |
| Terlambat memilih libur: paling cepat (KEH-135) | 2 hari dari hari ini | ya | tidak |
| Batas memilih libur pengganti (KEH-138) | 14 hari | ya | tidak |
| Jadwal Pembatal ajakan tukar | 00.05 | tidak | tidak |
| Jadwal Pencatat tidak memilih libur | 00.10 | tidak | tidak |
| Jadwal Penghangus libur pengganti | 00.15 | tidak | tidak |
| Orang baru: memilih libur terlambat tanpa tanda (KEH-140) | 3 hari kerja pertama | ya | tidak |
| Batas mengajukan izin keperluan (KEH-141) | H-2 | ya | tidak |
| Batas mengajukan cuti tahunan (KEH-48, 141) | H-7 | ya | tidak |
| Batas mengajukan sakit, izin duka, dan izin mendadak sesudah harinya (KEH-141) | 3 hari | ya | tidak |
| Sakit tanpa surat paling lama (KEH-50, 143) | 2 hari berturut-turut | ya | tidak |
| Menyusulkan surat dokter (KEH-51, 143) | 3 hari sesudah masuk kembali | ya | tidak |
| Foto surat dokter dihapus setelah slip ditutup (KEH-144) | 60 hari | ya | tidak |
| Jatah cuti tahunan dan masa kerja pertama (KEH-48, 145) | 10 hari; 1 tahun | ya | tidak |
| Izin duka bebas dibayar (KEH-49, 146) | 2 hari | ya | tidak |
| Jadwal Penutup tahun cuti | 00.20 | tidak | tidak |
| Jadwal Penghapus surat dokter | 02.30 | tidak | tidak |
| Ambang telat dan pulang cepat yang wajib dijelaskan (KEH-151, 61) | 30 menit untuk keduanya | ya | ya, lewat Daftar Pengecualian |
| Batas penjelasan (KEH-58) | 3 hari setelah tanggal | ya | tidak |
| Kejadian lupa absen sebelum denda bertambah (KEH-64) | 4 per periode per jenis | ya | tidak |
| Jadwal Penanda alpha | 04.20 | tidak | tidak |
| Jadwal Pencatat tidak masuk berturut-turut | 04.25 | tidak | tidak |
| Denda lupa Masuk Kembali (KEH-154) | Rp5.000 (nominal milik Gaji, 4E; dicatat sebagai titipan) | ya | tidak |
| Batas klaim lembur (KEH-74, 161) | 3 hari setelah tanggal pukul 23.59 | ya | tidak |
| Lembur paling sedikit dan paling banyak per hari (KEH-70) | 1 jam penuh; 3 jam | ya | tidak |
| Foto kertas lembur dihapus setelah slip ditutup (KEH-167) | 60 hari | ya | tidak |
| Jabatan yang boleh menyuruh lembur (KEH-163; titipan ke KAR-L31) | HR, Pemilik, GM | ya | tidak |
| Jadwal Penghangus klaim lembur | 04.30 | tidak | tidak |

---

## 9. Jenis pengajuan milik 4D-1 (titipan 4J)

**4D-1: tidak ada.** **4D-3: tidak ada** (serah terima, laporan masalah, dan keadaan mobil adalah laporan, bukan permintaan yang perlu disetujui; status tindak lanjutnya diubah langsung oleh yang berwenang). **4D-2c: tidak ada** (absen trip dicatat langsung oleh trip; pembetulan lewat Koreksi KEH-L13). **4D-2b: tidak ada** (tinjauan dan koreksi diputuskan langsung oleh yang berwenang, tanpa orang yang meminta; orang yang tidak bisa absen dibantu langsung lewat KEH-30). **4D-2a: satu**, "Usulan pindah cabang" (lahir dari jawaban Ya di KEH-L10; penyetuju HR atau Pemilik; batas waktu 3 hari kerja; akibat: riwayat pindah dibuat, KAR-56). Alasan 4D-1 tidak ada: jam kerja, kelompok, radius, QR, dan hari tutup ditetapkan
langsung oleh yang berwenang, tanpa orang yang "meminta". Jenis pengajuan
Kehadiran: **4D-4a: satu**, "Ajakan tukar" (libur atau shift; penyetuju hanya teman yang diajak, bukan HR, KEH-43 dan 136; batas waktu H-2 dari tanggal yang lebih dekat; akibat: jadwal kedua orang berubah langsung, tanpa pemberitahuan ke atasan). **Memilih libur** (KEH-131) dan **permintaan masuk di hari libur** (KEH-137) bukan pengajuan: yang pertama langsung berlaku, yang kedua perintah kantor yang tercatat. **4D-4b: tiga jenis**, semua dengan penyetuju HR atau Pemilik (milik HR diputuskan Pemilik atau GM, PRI-37 butir 3), tidak pernah disetujui otomatis, lampiran surat tertutup (KEH-144), dan akibat yang ditulis server ke `hari_kerja` lalu dibaca Gaji:

| Jenis | Batas waktu | Akibat disetujui | Akibat ditolak atau terlewat | Lampiran |
|---|---|---|---|---|
| **Izin** (keperluan; dilabeli mendadak oleh server bila kurang dari H-2; atau duka) | Keperluan H-2; mendadak dan duka sampai 3 hari sesudah harinya | Hari berstatus Izin (potongan GAJ-13; duka dibayar 2 hari, GAJ-14) | Ditolak: alpha saat ditolak, klarifikasi 3 hari (KEH-62). Terlewat batas: alpha (KEH-141) | Duka: tidak wajib |
| **Sakit** (tanpa surat maksimal 2 hari berturut-turut; dengan surat; surat menyusul) | Sampai 3 hari sesudah hari pertama; surat 3 hari sesudah masuk kembali | Hari berstatus Sakit (GAJ-13); surat masuk menghitung ulang | Ditolak: alpha; terlewat: alpha; surat terlewat: tetap sakit tanpa surat (KEH-143) | Surat dokter, tertutup |
| **Cuti tahunan** | H-7; masa kerja 1 tahun penuh; sisa cukup | Hari berstatus Cuti (dibayar, GAJ-14); jatah terpakai | Ditolak: jatah kembali, hari itu alpha bila tidak hadir; terlewat: ditolak server | Tidak ada |
| **Penjelasan** (alpha, lupa absen, telat, pulang cepat; sebab sakit atau izin mendadak) | 3 hari setelah tanggal kejadian (3 hari dari penolakan bila lahir dari KEH-62 atau 147). Lupa absen yang lewat: jalur **pengajuan terlambat** dengan alasan | Hari diubah sesuai sebab (Hadir dengan jam diisi, Sakit, Sakit dengan surat, Izin mendadak); denda lupa absen ditulis Gaji; potongan telat diusulkan ditiadakan (KEH-66) | Ditolak: kejadian tetap, Ajukan ulang dalam batas. Terlewat: alpha dan potongan telat tetap, lupa absen lewat pengajuan terlambat; pulang cepat hanya bertanda "belum dijelaskan" (KEH-155) | Foto surat dokter (tertutup, KEH-144) bila sakit dengan surat |
| **Klaim lembur** | 3 hari setelah tanggal hari kerja pukul 23.59 (hari lupa absen yang dijelaskan: 3 hari sejak penjelasan disahkan). Lewat itu **hangus**, tanpa pengajuan terlambat | Jam disahkan (sama atau lebih kecil dari terdeteksi, paling banyak 3) dibaca Gaji (GAJ-12); tarif milik Gaji | Ditolak: Ajukan ulang dalam batas. Terlewat: hangus, dibicarakan langsung dengan pemilik (PRI-09) | Foto kertas lembur (tertutup, 60 hari sesudah slip ditutup) dan nama penyuruh |

Ajakan tukar dan jenis lain Kehadiran: bagian ini hanya menambah tiga jenis di atas. **4D-5a** menambah satu jenis, "Penjelasan" (tabel di bawah); **4D-5b** menambah satu jenis, "Klaim lembur" (baris di atas): penyetuju HR, Pemilik, atau GM; milik mereka diputuskan penyetuju lain (PRI-37 butir 3); tidak pernah disetujui otomatis.

---

## 10. Kejadian di lapangan

| No | Kejadian | Sistem berbuat apa | Aturan |
|---|---|---|---|
| 1 | Jam kerja cabang diubah mulai 1 November | Absen sampai 31 Oktober tetap pakai jam lama | KEH-02 |
| 2 | Pemilik mengubah jam kerja tanpa mengisi pengumuman | Tidak tersimpan; diminta isi pengumuman atau tandai "tidak perlu diumumkan" dengan alasan | PRI-35 b2 |
| 3 | Cabang berisi 3 orang, kelompok belum diisi | Mesin tidak menggilir; kepala cabang dan HR diberi tahu | KEH-06, 102 |
| 4 | Senin tiba, mesin penggilir mati | Terlewat dikejar tanpa dobel; GM diberi tahu; orang tanpa shift tidak dihitung telat | PRI-33, KEH-07 |
| 5 | Eka mulai kerja Rabu di cabang dua shift | Shift dan kelompok dipilih saat penempatan; digilir mulai Senin berikutnya | KEH-103 |
| 6 | Penempatan dibuat tanpa memilih shift | Ditolak oleh KAR-L22: shift wajib diisi untuk cabang bershift ganda | KEH-103 |
| 7 | Teman sakit mendadak, shift siang kurang orang | Kepala cabang atau HR mengubah shift langsung dengan alasan; orangnya diberi tahu | KEH-45 |
| 8 | Kepala Toko mengubah radius | Tombol tidak tampil; dipaksa ditolak server | KEH-104 |
| 9 | QR hilang atau rusak | HR membuat ulang (tombol ditahan 3 detik); QR lama mati; cabang diberi tugas mencetak | KEH-11 |
| 10 | Orang memindai QR lama | Pesan "QR ini sudah tidak berlaku"; tidak ada absen | KEH-11 |
| 11 | Toko tutup Selasa, HR baru ingat Rabu | Hari tutup dipasang mundur; alpha Selasa menjadi Hari tutup tanpa denda | KEH-105 |
| 12 | Hari tutup mundur untuk periode yang slipnya sudah ditutup | Ditolak; dikoreksi di periode berikutnya | KEH-68, 105 |
| 13 | Hari tutup dibatalkan padahal alpha sudah dihapus | Mesin menghitung ulang; yang tidak hadir kembali alpha | KEH-105 |
| 14 | Cabang tanpa titik lokasi | Tanda peringatan; absen cabang itu tidak bisa dipakai sampai titik diisi | KAR-25 |
| 15 | Karyawan membuka jadwal teman | Hanya nama, shift, libur atau tidak masuk, satu cabang, tanpa alasan | KEH-107, 42 |
| 16 | Karyawan membuka jadwal cabang lain | Ditolak | KEH-107 |
| 17 | Tarik Data Kasir bertanya jam buka pada hari tutup | Kosong; hari itu tidak dihitung | KEH-106 |
| 18 | Menonaktifkan shift yang masih dipakai giliran | Ditolak; pesan menyebut nama yang memakainya | KEH-03 |
| 19 | Rina baru membuka Absen pukul 15.00 untuk shift 08.00 | Hanya tombol Masuk; telat 7 jam; tidak ada pertanyaan "masuk atau pulang" | KEH-108 |
| 20 | Dedi (shift Pagi Cabang A) membantu di Cabang B yang punya shift Pagi | Pertanyaan perbantuan dulu; memakai shift Pagi Cabang B | KEH-109 |
| 21 | Dedi membantu di Cabang B yang tidak punya nama shift yang sama | Memilih shift sendiri; kepala Cabang B diberi tahu | KEH-109 |
| 22 | Salah memindai QR cabang lain | Pilih "Salah scan"; batal sebelum foto | KEH-26, 109 |
| 23 | Masuk di Cabang A, Masuk Kembali memindai QR Cabang B | Ditolak dengan pesan; pindah tempat dibetulkan HR | KEH-110 |
| 24 | Sari absen pukul 06.00 untuk shift 08.00 | Tombol Masuk tampil (tepat 2 jam); pukul 05.59 tidak tampil, "Absen baru bisa dibuka mulai 06.00" | KEH-111 |
| 25 | Staf kantor menekan Istirahat; di kantor tidak ada Kasir | Boleh istirahat; pemeriksaan penjaga tidak berlaku | KEH-112 |
| 26 | Dua Kasir mau istirahat bersamaan, tinggal satu | Yang kedua ditolak dengan nama dan jam teman yang istirahat | KEH-85 |
| 27 | Satu-satunya Kasir menekan Istirahat | Penjelasan; hari kerja diberi catatan | KEH-85 |
| 28 | Absen di luar radius | Tetap tercatat; tanda "perlu ditinjau"; slip tertahan | KEH-14 |
| 29 | Izin lokasi ditolak | Tidak bisa lanjut; pesan dan jalan ke HR | KEH-30 |
| 30 | Tono datang di hari tutup | Tombol Masuk tidak aktif; pekerjaan diminta lewat KEH-46 (4D-4) | KEH-113 |
| 31 | Lia membuka Absen di hari libur terjadwalnya | Tombol tidak aktif; "Hari ini jadwal libur Anda" | KEH-113 |
| 32 | Menekan Pulang dua kali | Tercatat sekali | KEH-16 |
| 33 | Jam handphone dimundurkan | Tidak berpengaruh; jam server | PRI-01 |
| 34 | Hari ke-7 di cabang lain | Ditanya "sudah pindah?" saat pulang, sesudah laporan | KEH-27 |
| 35 | Ani absen 120 m dari titik (radius 100) | Tercatat; tanda perlu ditinjau; slip tertahan; HR memutuskan Wajar atau Perlu dikoreksi | KEH-14, 114 |
| 36 | HR memutuskan Wajar, lalu menemukan bukti bohong | Keputusan diganti menjadi Perlu dikoreksi; keduanya tersimpan | KEH-114, 68 |
| 37 | Budi tiga kali luar titik dalam 7 hari kerja | Tanda pola muncul di KEH-L12; tidak menahan slip | KEH-115 |
| 38 | Dua orang absen di luar radius dari titik yang nyaris sama | Tanda pola "titip absen"; HR melihat foto keduanya | KEH-115 |
| 39 | Handphone Sari rusak seharian | HR menambah absen lewat KEH-L13 dengan alasan; telat dihitung ulang sistem | KEH-30, 116 |
| 40 | Listrik cabang mati, delapan orang tidak bisa absen | Satu koreksi banyak orang: satu cabang, satu tanggal, satu alasan | KEH-28, 116 |
| 41 | HR hendak membetulkan jam pulangnya sendiri | Tombol tidak tampil; dipaksa ditolak server; Pemilik atau GM yang mengoreksi | KEH-117 |
| 42 | Koreksi untuk hari yang slipnya sudah ditutup | Catatan hari terkunci; hanya "koreksi susulan" yang dihitung periode berikutnya | KEH-81, 68 |
| 43 | Lia izin sakit disetujui tetapi tetap absen masuk | Status Hadir; catatan "ada izin disetujui yang bentrok" untuk HR | KEH-118 |
| 44 | Rina telat 4 menit | Karyawan melihat "telat 4 menit"; kantor melihat tanda dalam toleransi; tidak dipotong | KEH-22, 119 |
| 45 | Kepala Toko membuka foto absen cabang lain | Ditolak; tidak ada di daftar cabangnya | KEH-20 |
| 46 | Foto lebih dari 60 hari dibuka | "Foto sudah dihapus; jam dan jarak tetap tercatat" | KEH-15 |
| 47 | Mesin pembuat catatan hari kerja mati semalam | Dikejar berurutan tanpa dobel; GM diberi tahu | PRI-33 |
| 48 | Dedi menekan Berangkat bersama Eko dan Fajar (kenek tanpa handphone) | Ketiganya tercatat absen masuk jam yang sama; satu foto awak | KEH-97 |
| 49 | Kantor menukar Eko dengan Fajar pukul 09.30 setelah berangkat 08.00 | Fajar masuk 09.30, bertanda ditambahkan kantor; absen Eko tetap, HR bisa membatalkan lewat koreksi | KEH-121 |
| 50 | Dua trip sehari: antar pagi, belanja siang | Masuk = Berangkat trip 1; pulang pindah ke lapor garasi trip 2; dua Laporan Pulang | KEH-98 |
| 51 | Berangkat Selasa 15.00, sampai garasi Rabu 00.40 | Seluruhnya hari Selasa | KEH-122 |
| 52 | Handphone Dedi mati, Kepala Gudang menutup trip | Absen pulang jam penutupan; Laporan Pulang menyusul tanpa denda | KEH-101, 123 |
| 53 | Dedi lupa lapor garasi sampai 12.00 besok | Tanda LOG-31 untuk Kepala Gudang dan pemilik; tanpa denda lupa absen | KEH-123 |
| 54 | Berangkat ditekan dari tempat muat 800 m dari gudang | Tercatat; tidak bertanda perlu ditinjau | KEH-124 |
| 55 | Orang per ritase tidak ada di trip mana pun | Tidak jalan; tanpa akibat | KEH-81 |
| 56 | Sari foto pulang pukul 17.05, menulis laporan sampai 17.20 | Jam pulang 17.05; lembur dan kerja tidak bertambah | KEH-89 |
| 57 | Sinyal Sari putus saat mengetik laporan | Isian tersimpan di handphone; pulih saat dibuka lagi | TAM-16 |
| 58 | Sari menutup aplikasi sebelum Kirim | Pulang "menunggu laporan"; tombol Lanjutkan laporan di Absen | KEH-89 |
| 59 | Laporan Sari belum terkirim sampai 04.00 | Absen pulang tidak tercatat; lupa absen pulang; jam foto tampil sebagai bukti | KEH-91 |
| 60 | Dedi sendirian di gudang Bogor, memilih "Tim saya" | Terkirim; status Tidak ada penerima; tampil di Serah Terima Tim, tanpa tugas | KEH-127 |
| 61 | Penerima orang tertentu sudah berhenti sebelum membaca | Status Tidak ada penerima bila tidak ada penerima lain; kepala cabang dan HR melihatnya | KEH-127 |
| 62 | Rina cuti 14 hari, ada serah terima setiap hari | Hanya 7 hari terakhir muncul sebagai jendela, satu per satu; sisanya di menu | KEH-126 |
| 63 | Karyawan menulis "-" sebagai serah terima | Ditolak; kurang dari 20 huruf | KEH-90 |
| 64 | Kasir melapor masalah menyangkut kepala tokonya | GM dan Pemilik membaca; kepala toko tidak melihat | KEH-93 |
| 65 | Karyawan melapor masalah menyangkut GM dan memilih "menyangkut GM" | Hanya Pemilik membaca; GM tidak melihat laporan, nama, atau statusnya | KEH-128 |
| 66 | GM membuka langsung alamat laporan yang menyangkut GM | Ditolak server | KEH-128 |
| 67 | Pelapor melihat statusnya | Status dan tanggapan satu kalimat; tanpa nama orang yang dilaporkan | KEH-129 |
| 68 | Tanggapan memuat nama karyawan aktif | Peringatan sebelum Kirim; boleh dilanjutkan oleh penulis | KEH-129 |
| 69 | Dedi melapor rem berbunyi; Eko melapor "Baik" besoknya untuk mobil yang sama | Laporan Dedi tetap Perlu perhatian; pengingat tetap tampil | KEH-130 |
| 70 | Kepala Gudang menandai Selesai, Finance belum | Pengingat berhenti untuk keduanya | KEH-130 |
| 71 | Kepala Gudang menandai Selesai tanpa catatan | Ditolak; catatan wajib | KEH-130 |
| 72 | Trip ditutup kantor, driver mengisi laporan keesokan harinya | Diterima tanpa denda; hilang dari perlu perhatian Kepala Gudang | KEH-101, 123 |
| 73 | Driver dua trip sehari | Dua Laporan Pulang; masing-masing dengan keadaan mobil dan bensinnya | KEH-98, 100 |
| 74 | Kenek tidak mengirim serah terima | Tidak ada akibat; laporan driver cukup | KEH-100 |
| 75 | Tekan Kirim dua kali | Tercatat sekali | KEH-95 |
| 76 | Rina memilih 4 tanggal pada 12 Oktober | Berlaku langsung; Kepala Toko melihat tanggal dan statusnya | KEH-131 |
| 77 | Rina memilih Sabtu 7 Nov, lalu Minggu 15 Nov | Yang kedua ditolak: jatah akhir pekan terpakai | KEH-134 |
| 78 | Rina libur Senin 9 Nov, lalu memilih Kamis 12 Nov | Ditolak: kurang dari 5 hari | KEH-134 |
| 79 | Libur Sabtu 24 Okt (periode lalu), memilih Selasa 27 Okt | Ditolak: jarak dihitung lintas periode | KEH-134 |
| 80 | Tanggal yang dipilih diambil teman tepat sebelum Simpan | Tanggal itu ditolak dengan pesan; tanggal lain tersimpan | KEH-34 |
| 81 | Rina ingin menggeser libur setelah periode mulai | Tidak ada tombol sendiri; tukar dengan teman atau minta kepala cabang | KEH-133 |
| 82 | Budi belum memilih sampai 25 Okt 23.59 | Satu tanda tidak memilih libur (denda Gaji); boleh memilih terlambat paling cepat 2 hari dari hari ini | KEH-135 |
| 83 | Budi memilih terlambat empat kali | Dendanya tetap satu | KEH-135 |
| 84 | Ajakan tukar tidak dijawab sampai batas H-2 | Batal otomatis; pengaju diberi tahu dan bisa mengajukan izin biasa | KEH-44 |
| 85 | Ani menukar libur Kamis 12 Nov dengan Sabtu 14 Nov milik Eka, padahal sudah libur Sabtu 7 Nov | Diterima; tukar tidak diperiksa KEH-35 | KEH-136 |
| 86 | Teman yang diajak sedang izin pada tanggal itu | Tidak muncul di daftar teman | KEH-136 |
| 87 | Ajakan tukar dikirim kurang dari H-2 | Tidak bisa dikirim; layar menyebut izin biasa | KEH-44 |
| 88 | Kepala Toko meminta Dedi masuk Minggu 9 Nov | Dedi diberi tahu; tombol Masuk aktif pada tanggal itu; ia memilih pengganti | KEH-137 |
| 89 | Dedi tidak bisa masuk | Tidak ada tombol tolak; Dedi menghubungi peminta, peminta membatalkan | KEH-137 |
| 90 | Dedi tidak memilih pengganti sampai 14 hari | Hangus; tanpa denda; kompensasi tetap dibayar | KEH-138 |
| 91 | Dedi diminta masuk tetapi tidak hadir | Tidak ada kompensasi dan tidak ada pengganti | KEH-138 |
| 92 | Rina tidak masuk Selasa pagi tanpa H-2 | Izin mendadak atau alpha, potongan GAJ-13, tanpa denda tambahan | KEH-139 |
| 93 | Teman sakit, Kepala Toko menggeser libur Eka langsung | Eka diberi tahu; tanpa akibat uang baginya | KEH-45, 139 |
| 94 | Orang masuk tanggal 16 pada periode 30 hari | Jatah libur 1 hari | GAJ-06 |
| 95 | Driver per ritase membuka Pilih Libur | Tidak tampil; ia memberi tahu hari tidak bisa jalan | KEH-32 |
| 96 | Eka mulai kerja 10 November, jendela periode itu tutup 25 Oktober | Boleh memilih libur terlambat dalam 3 hari kerja pertama, tanpa tanda; lewat itu tanda dicatat | KEH-140 |
| 97 | Budi mengajukan izin keperluan untuk besok | Server melabeli izin mendadak; Budi melihat labelnya; Kirim ditahan 3 detik | KEH-142 |
| 98 | Rina demam Selasa, baru mengajukan sakit Kamis | Diterima (dalam 3 hari sejak hari pertama); status Menunggu | KEH-141 |
| 99 | Rina baru mengajukan sakit Jumat (hari ke-4) | Tombol Kirim mati; hari Selasa menjadi alpha; jalan ke klarifikasi | KEH-141 |
| 100 | Dedi sakit 4 hari tanpa surat | Ditolak server; diminta memilih sakit dengan surat | KEH-143 |
| 101 | Dedi memilih "Surat menyusul", masuk kembali Senin, surat Rabu | Dihitung sakit dengan surat setelah Rabu; sebelumnya sakit tanpa surat | KEH-143 |
| 102 | Surat Dedi baru ada Jumat (lewat 3 hari) | Tetap sakit tanpa surat; tombol susulan mati | KEH-143 |
| 103 | Kepala Toko membuka alasan atau surat sakit Rina | Hanya tanggal dan status; foto tidak tampil | KEH-144, 80 |
| 104 | Admin HR membuka foto surat | Ditolak | KEH-144 |
| 105 | Ani mengajukan cuti 2 hari dengan sisa 3, lalu 2 hari lagi sebelum diputuskan | Yang kedua ditolak; sisa sudah terpesan 2 | KEH-145 |
| 106 | Cuti Ani ditolak | Sisa 3 kembali | KEH-145 |
| 107 | Orang masuk 1 Maret 2026, mengajukan cuti 10 November 2026 | Ditolak: masa kerja belum 1 tahun; layar menyebut "mulai 1 Maret 2027" | KEH-48, 145 |
| 108 | Sisa cuti 4 hari di akhir tahun cuti | Hangus 00.20 hari berikutnya; tidak diuangkan | KEH-48, 145 |
| 109 | Sari duka karena ibu, butuh 4 hari | 2 hari pertama bebas dibayar; hari ke-3 dan 4 diajukan terpisah | KEH-146 |
| 110 | Izin Kamis diajukan Rabu malam, HR baru buka Jumat | Kamis tetap belum ditentukan, tidak alpha; HR diingatkan tiap hari | KEH-147 |
| 111 | Izin itu ditolak Jumat | Kamis menjadi alpha pada saat itu; klarifikasi 3 hari dihitung dari Jumat | KEH-147, 62 |
| 112 | HR mengajukan izin untuk dirinya | Diputuskan Pemilik atau GM; tidak bisa disetujuinya sendiri | PRI-37 b3 |
| 113 | Kenek tanpa handphone sakit | HR mengisikan atas namanya; kartu "diisi oleh"; diputuskan Pemilik, GM, atau HR lain | KEH-148 |
| 114 | Persetujuan salah ditemukan setelah tanggal lewat, slip belum ditutup | Dicabut dengan alasan; hari kembali dihitung | KEH-148 |
| 115 | Sama, tetapi slip sudah ditutup | Koreksi susulan, dihitung periode berikutnya | KEH-148, 68 |
| 116 | Izin bentrok dengan cuti yang masih berlaku | Ditolak; pesan menyebut tanggalnya | KEH-149 |
| 117 | Tiga orang di cabang yang sama izin pada hari yang sama | Diterima; HR melihat peringatan jumlah | KEH-149 |
| 118 | Cuti diambil yang melewati hari libur terjadwal | Libur tidak dihitung sebagai hari cuti | KEH-41 |
| 119 | Orang izin disetujui, tetap absen masuk | Status Hadir; catatan "ada izin disetujui yang bentrok" untuk HR; jatah cuti dikembalikan | KEH-118, 145 |
| 120 | Karyawan membuka kalender teman | "Tidak masuk" tanpa jenis dan alasan | KEH-107, 149 |
| 121 | Budi tidak absen sama sekali Selasa | Rabu 04.20 Selasa ditandai Alpha; Budi diberi tahu batasnya (Jumat 23.59) | KEH-150, 151 |
| 122 | Budi mengajukan izin Selasa, HR belum memutuskan saat 04.20 | Selasa tetap belum ditentukan, bukan alpha | KEH-147, 150 |
| 123 | Mesin penanda alpha mati Rabu | Dikejar berurutan tanpa dobel; Pemilik dan GM diberi tahu | KEH-52, PRI-33 |
| 124 | Dewi tidak masuk Senin sampai Rabu | Tiga kartu alpha; ada tombol "Jelaskan sama untuk hari berturut-turut"; satu penjelasan untuk tiga hari | KEH-152 |
| 125 | Senin sudah lewat 3 hari, Selasa dan Rabu belum | Senin dilepas dan tetap alpha; Selasa dan Rabu tetap dijelaskan | KEH-152, 59 |
| 126 | Dewi menjelaskan alpha 3 hari sebagai "sakit tanpa surat" | Ditolak server; diminta memilih sakit dengan surat (boleh menyusul) | KEH-153 |
| 127 | Rina lupa menekan Masuk Kembali sesudah istirahat | Kartu "Lupa Masuk Kembali"; jam dan alasan; denda jenis ketiga, dihitung terpisah | KEH-87, 154 |
| 128 | Anto lupa absen tanggal 3, 8, 12, 20, 24; HR mengesahkan semuanya tanggal 28 | Yang tanggal 24 kejadian ke-5 dan kena tambahan, walau disahkan terakhir; menurut tanggal kejadian | KEH-154 |
| 129 | HR mencabut persetujuan lupa absen tanggal 8 | Urutan dihitung ulang server; tambahan pindah ke kejadian ke-5 yang baru | KEH-154, 158 |
| 130 | Tono menjelaskan lupa absen, HR menolak karena jamnya aneh, sisa 2 hari | Ajukan ulang boleh dalam batas; jam diisi ulang orangnya | KEH-155 |
| 131 | Lupa absen pulang baru ingat setelah 5 hari | Tombol Ajukan terlambat; alasan wajib; tercatat Terlambat; disahkan HR atau Pemilik | KEH-60, 155 |
| 132 | Telat 40 menit tidak dijelaskan 3 hari | Potongan tetap; tidak ada jalur terlambat | KEH-61, 155 |
| 133 | Telat 40 menit dijelaskan dan disetujui | Menit tetap tampil; potongan diusulkan ditiadakan di slip | KEH-66 |
| 134 | Sari pulang cepat 20 menit | Hanya dicatat, tidak ada kartu | KEH-151 |
| 135 | Sari pulang cepat 35 menit, tidak dijelaskan | Kartu tampil, lewat batas bertanda "belum dijelaskan" untuk HR; tidak ada uang | KEH-151, 155 |
| 136 | HR lupa absen pulang | Diputuskan Pemilik atau GM; HR tidak melihat tombol Setujui | KEH-156 |
| 137 | Karyawan sakit tanpa kabar 7 hari kerja berturut-turut | Hari ke-7 HR dan Pemilik diberi tanda; tidak ada penonaktifan otomatis | KEH-55, 157 |
| 138 | Libur terjadwal di tengah rangkaian tidak masuk | Libur tidak memutus dan tidak dihitung; hari ke-7 dihitung dari hari kerja | KEH-157 |
| 139 | Penjelasan sakit dengan surat disetujui, slip belum ditutup | Hari Sakit dengan surat; potongan dihitung ulang | KEH-153, 158 |
| 140 | Persetujuan salah ditemukan, slip sudah ditutup | Koreksi susulan dihitung periode berikutnya | KEH-158, 68 |
| 141 | Slip hendak ditutup, satu penjelasan masih menunggu | Slip tertahan; HR dan Pemilik diberi tahu nama dan tanggal | KEH-69 |
| 142 | Driver per ritase tidak absen Senin | Tidak jalan; tidak ada kartu alpha | KEH-81 |
| 143 | Karyawan dinonaktifkan Jumat, Rabu sebelumnya tanpa absen | Rabu tetap bisa ditandai alpha; sesudah Jumat tidak | KEH-150 |
| 144 | Sari pulang 18.10, jadwal 17.00, menjawab "Bukan lembur" lalu berubah pikiran Selasa | Dari Lembur Saya klaim dibuka selama belum lewat batas | KEH-160 |
| 145 | Sari tidak menjawab "Ini lembur?" | Baris tetap Terbuka di Lembur Saya; pengingat H-1 dan hari terakhir | KEH-160, 161 |
| 146 | Lembur Senin, Sari baru ingat Jumat | Hangus; pesan menyebut jam yang hangus dan "bicarakan dengan pemilik"; tanpa tombol terlambat | KEH-161, PRI-09 |
| 147 | Klaim ditolak Selasa karena foto kertas tidak terbaca | Ajukan ulang dengan foto baru selama masih dalam batas | KEH-161 |
| 148 | Pengesah menilai kertas lembur hanya 2 jam padahal terdeteksi 3 jam | Mengesahkan 2 jam dengan alasan; orang diberi tahu alasannya | KEH-162 |
| 149 | Pengesah menilai jam foto terlalu kecil | Tidak bisa dinaikkan; HR memakai koreksi absen (KEH-L13) | KEH-162 |
| 150 | HR mengklaim lembur dan memilih dirinya sebagai penyuruh | Ditolak server | KEH-163 |
| 151 | Lembur milik HR | Hanya Pemilik atau GM yang mengesahkan | KEH-164 |
| 152 | Dewi lupa absen pulang Senin, penjelasan disahkan Kamis | Lembur Senin terdeteksi dari jam yang diisi; batas klaim sampai Minggu 23.59 | KEH-165, 63 |
| 153 | Budi diminta masuk di hari libur dan pulang larut | Tidak ada lembur; kompensasi libur oleh Gaji | KEH-165 |
| 154 | Dedi membantu di Cabang B yang tutup lebih awal dari Cabang A | Lembur dihitung dengan jam kerja dan jam tutup Cabang B | KEH-165, PRI-17 |
| 155 | HR mengoreksi jam pulang menjadi lebih awal padahal lembur sudah disahkan | Ditolak dengan pesan "cabut dulu pengesahan lembur tanggal sekian" | KEH-166, 68 |
| 156 | Jam pulang dikoreksi menjadi lebih larut sesudah klaim dikirim | Jam terdeteksi naik; klaim tidak berubah; tidak ada klaim baru | KEH-166 |
| 157 | Slip hendak ditutup, satu klaim lembur masih menunggu | Slip tertahan; HR dan Pemilik diberi tahu nama dan tanggal | KEH-69 |

---

## 11. Jalan keluar

| Tindakan | Kembali / ulangi | Batalkan | Oleh siapa, sampai kapan | Akibat ke data lain |
|---|---|---|---|---|
| Ubah jam kerja | Kembali di tiap langkah; Ulangi dari awal | Dibatalkan dengan perubahan baru bertanggal berlaku; yang sudah berlaku tidak ditimpa | HR, Pemilik, GM | Hitungan telat tanggal baru ke depan |
| Isi kelompok awal | Kembali sebelum Simpan | Diubah kepala cabang, HR, selama belum digilir pertama kali; sesudahnya lewat ubah langsung | Kepala cabang, HR | Giliran minggu berikutnya |
| Ubah shift langsung | Kembali sebelum Simpan | Diubah lagi; riwayat tetap | Kepala cabang, HR | Hari kerja minggu itu |
| Ubah radius | Kembali sebelum Simpan | Diubah lagi; riwayat tetap | Pemilik, GM | Tanda "perlu ditinjau" ke depan |
| Buat ulang QR | — | QR lama tidak bisa dihidupkan; buat ulang lagi | HR, Pemilik, GM | Cabang tidak bisa absen sampai QR baru ditempel |
| Pasang hari tutup | Kembali sebelum Simpan | Dibatalkan (status Dibatalkan) | HR, Pemilik, GM, sampai slip belum ditutup | Alpha dihitung ulang |
| Batalkan hari tutup | — | Dipasang lagi | HR, Pemilik, GM | Alpha dihitung ulang |
| Absen (masuk, istirahat, masuk kembali, pulang) | Kembali di tiap langkah sebelum Kirim; Foto ulang | Setelah terkirim tidak bisa dibatalkan orangnya (KEH-16); dibetulkan HR lewat pintu koreksi (KEH-28, 4D-2b) | Orang itu sampai Kirim; HR dan Pemilik sesudahnya | Telat dan lembur dihitung ulang server (KEH-29) |
| Perbantuan atau salah scan | Pilih lagi sebelum lokasi | Salah scan membatalkan sebelum foto | Orang itu | Jam kerja hari itu mengikuti cabang absen masuk |
| Usulan pindah cabang | — | Ditolak atau disahkan HR atau Pemilik; ditanya lagi hari kerja berikutnya | HR, Pemilik | Riwayat pindah (KAR-56) |
| Putuskan absen luar titik | Kembali sebelum Simpan | Keputusan diganti (riwayat tetap) | HR, Pemilik, GM, sampai slip belum ditutup | Slip tertahan atau lepas |
| Koreksi absen | Kembali di tiap langkah; Ulangi dari awal | Dibalik dengan koreksi baru; riwayat tetap | HR, Pemilik, GM (bukan untuk dirinya sendiri), sampai slip belum ditutup; sesudahnya koreksi susulan | Telat dan lembur dihitung ulang; Gaji periode berikutnya |
| Tandai tanda pola "Sudah dilihat" | — | Dibuka kembali dengan catatan | HR, Pemilik, GM | Tidak ada akibat uang |
| Berangkat dan lapor garasi (di Logistik) | Kembali sebelum kirim, diatur di 4F | Setelah terkirim tidak dibatalkan orangnya; dibetulkan lewat Koreksi | HR, Pemilik, GM (bukan untuk dirinya sendiri); trip ditutup kantor oleh Kepala Gudang atau Pemilik (LOG-30) | Absen masuk dan pulang awak; Gaji Driver tidak berubah (ritase dari trip) |
| Tambah atau copot awak setelah berangkat | Kembali sebelum Simpan (4F) | Dibalik dengan perubahan awak baru; absen yang sudah tercatat dibatalkan lewat Koreksi | Kantor | Absen masuk orang itu |
| Kirim Laporan Pulang | Kembali di tiap langkah sebelum Kirim; isian tersimpan | Setelah terkirim tidak dibatalkan dan tidak diubah; hanya Tambah keterangan (KEH-95) | Orang itu sampai Kirim | Absen pulang tercatat (jam foto); bensin diteruskan ke Logistik |
| Kirim laporan masalah | Kembali sebelum Kirim | Tidak dibatalkan; hanya Tambah keterangan | Pelapor sampai Kirim | Tidak ada akibat uang atau rapor |
| Ubah status laporan masalah | Kembali sebelum Simpan | Status bisa diubah lagi; riwayat tetap | GM, Pemilik (menyangkut GM: Pemilik) | Pelapor melihat status |
| Ubah status keadaan mobil | Kembali sebelum Simpan | Status bisa diubah lagi (Selesai dibuka kembali dengan catatan) | Kepala Gudang, Finance, Pemilik, GM | Pengingat berantai berhenti atau muncul lagi |
| Pilih libur | Kembali di tiap langkah sebelum Simpan | Digeser sendiri sampai jendela tutup (Lepas pilihan = Diganti); sesudahnya lewat tukar, ubah langsung, atau pengganti | Orang itu, sampai tanggal 25 pukul 23.59 | hari_kerja berstatus Libur terjadwal; Gaji membaca |
| Cabut libur | Kembali sebelum Simpan | Orang memilih lagi (terlambat) atau kepala cabang menggeser; riwayat tetap | HR, Pemilik, GM | Tanpa libur lain, hari tidak masuk menjadi alpha |
| Ubah libur langsung | Kembali sebelum Simpan | Diubah lagi; riwayat tetap | Kepala cabang, HR, Pemilik, GM | Jadwal orangnya; ia diberi tahu |
| Ajak tukar | Kembali di tiap langkah sebelum Kirim | Dibatalkan pengaju selama Menunggu; ditolak teman; batal otomatis di batas H-2 | Pengaju; teman sampai batas H-2 | Jadwal kedua orang berubah langsung setelah diterima |
| Terima ajakan tukar | — | Tidak dibalik sendiri; dibalik dengan tukar baru (H-2) atau ubah langsung | Teman yang diajak | Jadwal kedua orang |
| Minta masuk di hari libur | Kembali di tiap langkah sebelum Kirim | Dibatalkan dengan alasan, selama tanggalnya belum lewat | Peminta, HR, Pemilik, GM | Tombol Masuk; kompensasi bila hadir; pengganti lahir saat hadir |
| Siap masuk dan pilih pengganti | Kembali sebelum Simpan | Pengganti digeser sampai batas 14 hari | Orang itu | libur_pengganti; periode berikutnya boleh memuat 5 libur |
| Ajukan izin, sakit, atau cuti | Kembali di tiap langkah sebelum Kirim; Ulangi dari awal | Dibatalkan pengaju selama Menunggu; setelah disetujui "Minta dibatalkan" sebelum tanggalnya (KEH-40) | Pengaju; HR, Pemilik, GM mengesahkan | Jatah cuti kembali; hari dihitung ulang |
| Ajukan ulang (setelah ditolak) | Isian lama terisi | Dikirim ulang, batas waktu jenis tetap berjalan | Pengaju | Ditolak sebelumnya tetap terlihat |
| Susulkan surat dokter | Kembali; Foto ulang sebelum Kirim | Tidak dibatalkan; dibetulkan lewat Cabut persetujuan | Pengaju sampai batas 3 hari | Hari sakit dihitung ulang sebagai dengan surat |
| Putuskan izin, sakit, cuti | Kembali tanpa memutuskan | Cabut persetujuan dengan alasan; Ajukan ulang oleh pengaju bila ditolak | HR, Pemilik, GM, sampai slip belum ditutup; sesudahnya koreksi susulan | hari_kerja; jatah cuti; potongan Gaji |
| Isikan atas nama | Kembali di tiap langkah sebelum Kirim | Dibatalkan seperti pengajuan biasa | HR, Pemilik, GM | Kartu "diisi oleh" |
| Buka foto surat dokter | — | Tidak bisa ditarik; tercatat siapa dan kapan | HR, Pemilik, GM | Tidak ada |
| Isi penjelasan | Kembali di tiap langkah sebelum Kirim; Ulangi dari awal | Dibatalkan pengaju selama Menunggu; ditolak lalu Ajukan ulang dalam batas | Pengaju; HR, Pemilik, GM memutuskan (bukan miliknya sendiri) | Hari kerja dihitung ulang; denda dicatat Gaji saat disahkan |
| Ajukan terlambat (lupa absen) | Kembali di tiap langkah sebelum Kirim | Dibatalkan selama Menunggu | Pengaju; HR, Pemilik | Sama dengan Isi penjelasan; dibayar periode berikutnya bila slip sudah ditutup |
| Cabut persetujuan penjelasan | Kembali sebelum Simpan | Orang mengajukan ulang bila masih dalam batas | HR, Pemilik, GM, sampai slip belum ditutup; sesudahnya koreksi susulan | Hari kembali dihitung; denda dibalik oleh Gaji |
| Tandai tidak masuk berturut-turut "sudah dilihat" | — | Dibuka kembali dengan catatan | HR | Tidak ada akibat uang; tidak menonaktifkan |
| Jawab "Ini lembur?" | Satu pertanyaan; jawaban diubah dari Lembur Saya | Diubah sampai batas klaim | Orang itu | Tidak ada akibat uang sampai klaim dikirim |
| Kirim klaim lembur | Kembali di tiap langkah sebelum Kirim; Ulangi dari awal | Dibatalkan pengaju selama Menunggu; ditolak lalu Ajukan ulang dalam batas | Pengaju; HR, Pemilik, GM memutuskan (bukan miliknya sendiri) | Jam disahkan dibaca Gaji (GAJ-12) |
| Sahkan atau turunkan jam lembur | Kembali sebelum Simpan | Dicabut dengan alasan sampai slip periodenya ditutup | HR, Pemilik, GM | Jam disahkan berubah; sesudah slip ditutup koreksi susulan |
| Cabut pengesahan lembur | Kembali sebelum Simpan | Orang mengajukan ulang bila masih dalam batas | HR, Pemilik, GM, sampai slip belum ditutup | Jam disahkan nol; Gaji membaca ulang |
| Buka foto kertas lembur | — | Tidak bisa ditarik; tercatat siapa dan kapan | HR, Pemilik, GM | Tidak ada |

---

## 12. Daftar tes

Modul ini **tidak menghitung uang**; ia menyediakan waktu dan jadwal yang
dipakai Gaji. Diuji: waktu yang memengaruhi uang dan hak akses (WAJ-06).

**Waktu**

| No | Tes | Contoh |
|---|---|---|
| W1 | Jam kerja bertanggal berlaku | Jam masuk 08.00 diganti 09.00 mulai 1 November: absen 31 Oktober dinilai 08.00; absen 1 November dinilai 09.00 |
| W2 | Giliran Senin | Minggu ini Ani pagi, Budi siang: Senin depan Ani siang, Budi pagi |
| W3 | Giliran terlewat dikejar | Mesin mati Senin, hidup Rabu: giliran minggu itu tertulis sekali, tidak dobel |
| W4 | Cabang berjumlah ganjil | 3 orang, kelompok A (2 orang) dan B (1 orang): minggu ini A pagi dan B siang (2 pagi, 1 siang); Senin depan A siang dan B pagi (1 pagi, 2 siang) |
| W5 | Jam tutup toko turunan | Shift siang pulang 21.00: jam tutup toko 21.00; shift siang diubah 20.00: jam tutup ikut 20.00 tanpa mengisi lagi |
| W6 | Jam buka | Shift pagi masuk 08.00, siang pulang 21.00: jam buka 08.00 sampai 21.00; hari tutup: kosong; cabang tanpa kasir: kosong |
| W7 | Hari tutup mundur | Alpha Selasa; hari tutup dipasang Rabu: Selasa menjadi Hari tutup; slip ditutup Kamis, hari tutup dipasang Jumat untuk Selasa: ditolak |
| W8 | Radius bertanggal berlaku | Radius 100 mulai 1 November diubah 50 mulai 15 November: absen 10 November dinilai 100, 20 November dinilai 50 |
| W9 | Tombol berlabel | Belum masuk: hanya Masuk. Sudah masuk, dalam rentang istirahat: Istirahat dan Pulang. Sedang istirahat: hanya Masuk Kembali. Sudah pulang: tidak ada |
| W10 | Pulang paling cepat 15 menit | Masuk 08.00, Pulang 08.10 ditolak; 08.16 diterima |
| W11 | Pulang melewati tengah malam | Pulang 01.30 hari berikutnya masuk ke hari kerja kemarin; pulang 04.10 tidak (lupa absen) |
| W12 | Absen paling awal | Shift 08.00, awal 2 jam: absen 05.59 ditolak, 06.00 diterima; awal diganti 3 jam berlaku 1 November: absen 31 Oktober tetap dinilai 2 jam |
| W13 | Shift perbantuan | Shift Pagi Cabang A 08.00; Cabang B Pagi 09.00: telat dihitung dari 09.00; Cabang B tanpa Pagi: shift dipilih sendiri |
| W14 | Lewat batas istirahat | Mulai 12.00, lama 60 menit, Masuk Kembali 13.20: lewat 20 menit; dihitung sekali |
| W15 | Jam server | Handphone dimajukan 1 jam: jam absen tetap jam server |
| W16 | Telat dihitung ulang setelah koreksi | Masuk 08.40, jadwal 08.00 (telat 40); dikoreksi 08.03: telat 3 menit, dalam toleransi |
| W17 | Hari terkunci | Slip ditutup 25 Oktober; koreksi untuk 20 Oktober: tercatat sebagai koreksi susulan, hari kerja tidak berubah |
| W18 | Tiga luar titik dalam 7 hari kerja | Senin, Rabu, Jumat luar titik: tanda pola; hanya dua kali: tidak ada tanda |
| W19 | Urutan status | Izin disetujui dan ada absen: Hadir; hari tutup tanpa absen: Hari tutup; ritase tanpa absen: Tidak jalan; kosong tanpa pengajuan: belum ditentukan, bukan Alpha sebelum mesin 4D-5 |
| W20 | Periode rekap | Absen 25 Oktober masuk periode yang berakhir 25 Oktober; 26 Oktober masuk periode berikutnya |
| W21 | Absen trip satu tekanan | Berangkat 08.10 untuk tiga awak: tiga absen masuk 08.10 |
| W22 | Absen pulang trip terakhir | Trip 1 lapor 12.00, trip 2 lapor 17.20: pulang berlaku 17.20; baris 12.00 bertanda diganti |
| W23 | Hari ikut tanggal berangkat | Berangkat Selasa 15.00, lapor Rabu 00.40: hari kerja Selasa |
| W24 | Tanpa telat dan pulang cepat | Berangkat 10.30 (muatan lama): telat 0 menit |
| W25 | Awak ditambah | Ditambahkan 09.30: absen masuk 09.30, bukan 08.00 |
| W26 | Jam pulang = jam foto | Foto 17.05, laporan terkirim 17.20: pulang 17.05; lembur dihitung dari 17.05 |
| W27 | Batas 04.00 | Foto 23.50, laporan terkirim 03.55: tercatat; terkirim 04.10: lupa absen pulang |
| W28 | Jendela 7 hari | Serah terima berumur 6 hari dan 8 hari belum dibaca: yang 6 hari muncul sebagai jendela, yang 8 hari hanya di menu |
| W29 | Jendela memilih libur | Periode 26 Okt–25 Nov: memilih 25 Okt 23.59 diterima biasa; 26 Okt 00.01 hanya lewat jalur terlambat |
| W30 | Satu akhir pekan | Sabtu 7 Nov dipilih: Minggu 15 Nov ditolak, Selasa 10 Nov diterima |
| W31 | Jarak 5 hari | Libur Senin 9 Nov: Kamis 12 Nov (3) dan Jumat 13 Nov (4) ditolak, Sabtu 14 Nov (5) diterima bila jatah akhir pekan belum terpakai. Lintas periode: Sabtu 24 Okt dan Selasa 27 Okt (3) ditolak |
| W32 | Batas tukar H-2 | Tukar libur Kamis 12 Nov: diterima paling lambat Selasa 10 Nov 23.59; pukul 00.05 Rabu 11 Nov: Hangus |
| W33 | Libur pengganti 14 hari | Masuk Minggu 8 Nov: batas 22 Nov; dipilih 20 Nov diterima; 23 Nov 00.15 Hangus, kompensasi tetap dibayar |
| W34 | Terlambat memilih | Belum memilih pada 26 Okt: satu tanda; hari ini 28 Okt: 30 Okt diterima, 29 Okt ditolak; memilih terlambat empat kali tetap satu tanda |
| W35 | Jatah sebanding | Periode 30 hari, masuk tanggal 16: jatah 1 hari |
| W36 | Tukar tanpa KEH-35 | Libur Sabtu 7 Nov; menukar Kamis 12 Nov dengan Sabtu 14 Nov milik teman: diterima |
| W37 | Batas H-2 izin | Izin Kamis 12 Nov: dikirim Selasa 10 Nov 23.59 izin biasa; Rabu 11 Nov 00.05 berlabel mendadak |
| W38 | Batas H-7 cuti | Cuti Kamis 12 Nov: dikirim Kamis 5 Nov 23.59 diterima; Jumat 6 Nov ditolak |
| W39 | Batas sakit 3 hari | Sakit mulai Selasa 10 Nov: diajukan Jumat 13 Nov 23.59 diterima; Sabtu 14 Nov 00.01 ditolak, hari itu alpha |
| W40 | Hitungan hari kerja | Cuti Senin 9 sampai Jumat 13 Nov, libur Kamis 12 Nov: 4 hari kerja terhitung |
| W41 | Pesan cuti | Sisa 3, pengajuan 2 hari: sisa terpesan 1; ditolak: sisa 3; disetujui lalu dicabut sebelum tanggalnya: sisa 3 |
| W42 | Tahun cuti | Bergabung 1 Maret 2026: tahun cuti pertama 1 Maret 2027 sampai 29 Februari 2028; sisa hangus 1 Maret 2028 00.20 |
| W43 | Sakit surat menyusul | Sakit Selasa dan Rabu, masuk kembali Kamis 12 Nov; surat diunggah Minggu 15 Nov 23.59: sakit dengan surat; Senin 16 Nov 00.01: tetap tanpa surat |
| W44 | Tanpa alpha selama menunggu | Izin Kamis menunggu; penanda alpha 04.20 Jumat: Kamis belum ditentukan; ditolak Jumat 10.00: alpha mulai 10.00 |
| W45 | Orang baru | Mulai Selasa 10 Nov, belum memilih: sampai hari kerja ke-3 (Kamis 12 Nov) memilih tanpa tanda; masih kosong Jumat 13 Nov: satu tanda dicatat |
| W46 | Penanda alpha | Selasa tanpa absen dan tanpa pengajuan: Rabu 04.20 Alpha dengan batas Jumat 23.59; Selasa libur terjadwal atau hari tutup: tidak ditandai |
| W47 | Alpha dikejar | Mesin mati Rabu, jalan Kamis: Selasa dan Rabu ditandai berurutan tanpa dobel |
| W48 | Batas 3 hari | Alpha Senin dijelaskan Kamis 23.59: diterima; Jumat 00.01: ditolak server |
| W49 | Batas dari penolakan | Izin Kamis ditolak Jumat 10.00: batas klarifikasi Senin 10.00 |
| W50 | Kejadian ke-5 | Lima lupa absen pulang di tanggal 3, 8, 12, 20, 24: tanggal 24 kena tambahan Rp5.000; lupa masuk dan lupa Masuk Kembali dihitung sendiri-sendiri |
| W51 | Urutan menurut tanggal | Disahkan terbalik: tetap tanggal 24 yang kena tambahan |
| W52 | Pencabutan | Tanggal 8 dicabut: tanggal 24 menjadi kejadian ke-4, tambahan pindah ke kejadian berikutnya bila ada |
| W53 | Ambang pulang cepat | Pulang cepat 29 menit: tidak ada kartu; 30 menit: ada kartu |
| W54 | Tanda 7 hari | Sakit tanpa surat 2 hari, alpha 3 hari, izin 2 hari berturut-turut (libur di tengah tidak dihitung): satu tanda pada hari ke-7; hari ke-8 tidak menambah tanda |
| W55 | Laporan kebiasaan | Orang dengan 5 lupa absen (3 pulang, 1 masuk, 1 Masuk Kembali): tampil; 4 kejadian: tidak tampil |
| W56 | Jam penuh | Jadwal pulang 17.00, foto 18.50: 1 jam; foto 19.10: 2 jam; foto 17.59: 0 |
| W57 | Batas atas dan jam tutup | Foto 22.30 untuk jadwal 17.00 di cabang tutup 20.00: dihitung sampai 20.00 (3 jam); kantor jam tutup 20.00 dengan foto 21.30: dihitung sampai 20.00 |
| W58 | Shift terakhir | Jadwal pulang = jam tutup cabang: tidak pernah ada lembur |
| W59 | Batas klaim | Lembur Senin: klaim Kamis 23.58 diterima, Jumat 00.01 ditolak dan baris menjadi Hangus; pesan hangus menyebut jamnya dan "bicarakan dengan pemilik" |
| W60 | Lupa absen pulang lalu dijelaskan | Penjelasan disahkan Kamis: batas klaim lembur menjadi Minggu 23.59 (3 hari sejak pengesahan) |
| W61 | Pengesahan menurunkan jam | Terdeteksi 3 jam, disahkan 2 jam dengan alasan: Gaji membaca 2 jam; rekap tampil 3 / 3 / 2 |
| W62 | Koreksi absen sesudah pengesahan | Disahkan 2 jam, koreksi membuat terdeteksi 1 jam: ditolak sampai pengesahan dicabut; koreksi membuat terdeteksi naik: klaim tidak berubah dan tidak ada klaim baru |
| W63 | Hari diminta masuk di hari libur dan hari perbantuan | Hari libur: tidak ada lembur; perbantuan: jam kerja dan tutup cabang tujuan |
| W64 | Ditolak lalu Ajukan ulang | Ditolak Selasa, diajukan ulang Rabu (dalam batas): isian lama terisi, batas tidak mulai dari awal |
| W65 | Pencabutan | Pengesahan dicabut sebelum slip ditutup: jam disahkan nol, Ajukan ulang boleh bila masih dalam batas; sesudah slip ditutup: koreksi susulan |

**Hak akses**

| No | Percobaan | Hasil yang benar |
|---|---|---|
| H1 | Karyawan biasa mengubah jam kerja cabang | Ditolak |
| H2 | Kepala Toko cabang A membuka Jadwal & Shift cabang B | Ditolak |
| H3 | Kepala Toko mengubah radius | Ditolak |
| H4 | HR mengubah radius | Ditolak |
| H5 | HR membuat ulang QR | Berhasil |
| H6 | Karyawan membaca alasan izin temannya lewat Jadwal Saya | Tidak tampil; dipaksa ditolak server |
| H7 | Karyawan membaca jadwal teman cabang lain | Ditolak |
| H8 | Memindai QR lama setelah dibuat ulang | Ditolak dengan pesan |
| H9 | Admin HR mengubah jam kerja atau memasang hari tutup | Ditolak |
| H10 | Finance memasang hari tutup | Ditolak |
| H11 | Karyawan menekan Masuk memakai QR yang sudah mati | Ditolak dengan pesan |
| H12 | Kasir kedua menekan Istirahat saat hanya ada satu Kasir | Ditolak dengan nama teman yang istirahat |
| H13 | Staf kantor non-penjaga menekan Istirahat tanpa Kasir | Berhasil |
| H14 | Mengirim absen dengan foto dari galeri (permintaan dibuat paksa) | Ditolak server |
| H15 | Karyawan membaca daftar perbantuan | Tidak tampil; ditolak server |
| H16 | Kepala Toko cabang A membuka daftar perbantuan cabang B | Ditolak |
| H17 | GM atau driver per ritase membuka layar Absen | Tidak tampil (KAR-67, KEH-96) |
| H18 | Memalsukan jam absen dari handphone | Ditolak; jam server |
| H19 | HR mengoreksi absennya sendiri (dipaksa lewat permintaan) | Ditolak server |
| H20 | Kepala Toko memutuskan "Wajar" | Ditolak; hanya melihat |
| H21 | Admin HR atau Finance menyimpan koreksi | Ditolak; hanya melihat riwayat |
| H22 | Admin HR atau Finance membuka foto absen | Ditolak |
| H23 | Kepala Toko cabang A membuka rekap atau foto cabang B | Ditolak |
| H24 | Karyawan membaca rekap atau catatan hari orang lain | Ditolak |
| H25 | Karyawan melihat kata "toleransi" atau nominal potongan di KEH-L17 | Tidak tampil |
| H26 | Mengunduh foto absen | Tidak ada tombol; permintaan paksa ditolak |
| H27 | Menyimpan koreksi tanpa alasan | Ditolak server |
| H28 | Driver per ritase mengirim absen QR (dipaksa lewat permintaan) | Ditolak server (KEH-96) |
| H29 | Karyawan biasa membuka Absen Trip Hari Ini atau foto awak | Tidak ada layarnya; ditolak server |
| H30 | Admin HR atau Finance membuka foto awak | Ditolak |
| H31 | Kepala Toko membuka Absen Trip Hari Ini | Ditolak |
| H32 | HR mengoreksi absen tripnya sendiri (dipaksa) | Ditolak server (KEH-117) |
| H33 | HR, Kepala Toko, atau Admin HR membuka laporan masalah | Tidak ada layarnya; ditolak server |
| H34 | Orang yang dilaporkan membuka laporan masalah itu | Ditolak server |
| H35 | GM membuka laporan yang bertanda "menyangkut GM" | Tidak ada di daftar; ditolak bila dibuka langsung (KEH-128) |
| H36 | GM menghitung laporan masalah (jumlah, pengingat) | Laporan "menyangkut GM" tidak ikut |
| H37 | Pelapor mengubah atau menghapus laporan terkirim | Ditolak; hanya Tambah keterangan |
| H38 | Kepala Toko cabang A membuka Serah Terima Tim cabang B | Ditolak |
| H39 | Karyawan membaca serah terima yang bukan untuknya atau timnya | Ditolak |
| H40 | Karyawan biasa atau driver mengubah status keadaan mobil | Ditolak |
| H41 | Karyawan memangkas panjang serah terima di bawah 20 huruf (dipaksa lewat permintaan) | Ditolak server |
| H42 | Driver per ritase atau GM membuka Pilih Libur | Tidak tampil; ditolak server |
| H43 | Karyawan menyimpan libur atas nama orang lain | Ditolak server |
| H44 | Kepala Toko mencabut libur seseorang | Ditolak; hanya HR, Pemilik, GM |
| H45 | Kepala Toko cabang A mengubah libur langsung orang cabang B | Ditolak |
| H46 | Mencabut atau mengubah langsung tanpa alasan | Ditolak server |
| H47 | Karyawan mengajak tukar teman cabang lain | Ditolak |
| H48 | Karyawan menjawab ajakan yang bukan untuknya | Ditolak |
| H49 | Atasan menyetujui atau menolak ajakan tukar atas nama teman | Tidak ada tombolnya; ditolak server |
| H50 | Karyawan membuat permintaan masuk di hari libur untuk dirinya atau temannya | Ditolak |
| H51 | Kepala Toko cabang A meminta masuk orang cabang B | Ditolak |
| H52 | Karyawan membaca daftar belum memilih atau laporan tukar | Tidak tampil; ditolak server |
| H53 | Mengirim pilihan libur sesudah jendela tutup lewat jalur biasa (dipaksa) | Ditolak; hanya jalur terlambat dengan batas 2 hari |
| H54 | Memilih libur yang melanggar KEH-34 atau KEH-35 lewat permintaan paksa | Ditolak server |
| H55 | Karyawan memilih label "izin mendadak" atau menghindarinya lewat permintaan paksa | Ditolak; label hanya ditulis server |
| H56 | HR menyetujui pengajuannya sendiri (dipaksa) | Ditolak server; hanya penyetuju lain |
| H57 | HR mengisikan pengajuan atas nama dirinya (dipaksa) | Ditolak server |
| H58 | Karyawan atau kepala cabang membuka foto surat dokter | Ditolak server |
| H59 | Admin HR atau Finance membuka foto surat | Ditolak |
| H60 | Kepala Toko membaca alasan atau jenis izin orang cabangnya | Tidak tampil; ditolak server |
| H61 | Mengajukan cuti lewat sisa (dipaksa) | Ditolak server |
| H62 | Mengajukan cuti sebelum masa kerja 1 tahun (dipaksa) | Ditolak server |
| H63 | Karyawan meminta batal untuk tanggal yang sudah lewat | Tidak ada tombol; ditolak server |
| H64 | Kepala Toko memutuskan izin atau mencabut persetujuan | Tidak ada tombolnya; ditolak server |
| H65 | Driver per ritase atau GM membuka layar ajukan izin atau Sisa Cuti | Tidak tampil; ditolak server |
| H66 | Mengunggah surat untuk pengajuan orang lain | Ditolak server |
| H67 | Karyawan menjelaskan kejadian orang lain | Ditolak server |
| H68 | HR memutuskan penjelasannya sendiri (dipaksa) | Ditolak; hanya Pemilik atau GM |
| H69 | Kepala Toko memutuskan atau mencabut penjelasan | Tidak ada tombolnya; ditolak server |
| H70 | Kepala Toko membuka alasan atau foto penjelasan | Hanya jenis, tanggal, sisa waktu; ditolak server |
| H71 | Admin HR atau Finance membuka foto surat penjelasan | Ditolak |
| H72 | HR membuka Laporan Kebiasaan Lupa Absen | Tidak tampil; ditolak server |
| H73 | Penyetuju mengubah jam yang diisi lewat permintaan paksa | Ditolak; hanya Tolak lalu Ajukan ulang |
| H74 | Mengirim penjelasan alpha lewat batas 3 hari lewat jalur biasa (dipaksa) | Ditolak; hanya lupa absen lewat pengajuan terlambat |
| H75 | Mengirim jam masuk di luar jam yang masuk akal (dipaksa) | Ditolak server dengan batasnya |
| H76 | Driver per ritase atau GM membuka Perlu Dijelaskan | Tidak tampil; ditolak server |
| H77 | Karyawan Gudang, driver per ritase, atau GM membuka Lembur Saya atau menjawab "Ini lembur?" (dipaksa) | Tidak tampil; ditolak server (KEH-25, 99) |
| H78 | Mengirim klaim lembur sesudah batas 3 hari (dipaksa) | Ditolak; hangus, tanpa jalur terlambat (PRI-09) |
| H79 | Mengirim klaim tanpa foto kertas atau tanpa penyuruh (dipaksa) | Ditolak server |
| H80 | Memilih diri sendiri sebagai penyuruh, atau orang yang jabatannya tidak boleh menyuruh (dipaksa) | Ditolak server |
| H81 | Pengesah menaikkan jam melebihi terdeteksi atau di atas 3 jam, atau menurunkan tanpa alasan (dipaksa) | Ditolak server |
| H82 | HR mengesahkan lemburnya sendiri (dipaksa) | Ditolak; hanya Pemilik atau GM |
| H83 | Kepala Toko membuka foto kertas atau nama penyuruh | Tidak tampil; ditolak server |
| H84 | Admin HR atau Finance membuka foto kertas lembur | Ditolak |

---

## 13. Pertanyaan dan jawaban

Diajukan di percakapan 13 Oktober 2026 (KER-13, 14). Jawaban pemilik: **"ok"**,
dibaca sebagai setuju saran untuk J1 s.d. J6.

1. **J1 (KEH-102):** giliran awal diisi kepala cabang untuk cabangnya (ganjil
   maupun genap); HR, Pemilik, GM boleh; sesudahnya mesin yang menggilir.
2. **J2 (KEH-103):** shift dan kelompok wajib dipilih saat penempatan; giliran
   mengikuti kelompok mulai Senin berikutnya; sebelum terisi, "shift belum
   ditentukan" dan tidak dihitung telat.
3. **J3 (KEH-104):** radius hanya Pemilik dan GM, GM diberi tahu; QR boleh HR,
   Pemilik, GM.
4. **J4 (KEH-105):** hari tutup boleh dipasang mundur selama slip periodenya
   belum ditutup, dengan alasan; alpha hari itu menjadi Hari tutup tanpa
   denda.
5. **J5 (KEH-106):** jam buka = jam masuk shift paling pagi sampai jam pulang
   shift terakhir (kantor: jam tutup kantor); hari tutup dan cabang tanpa
   kasir tidak dihitung; satu pintu baca untuk 4C.
6. **J6 (KEH-107):** karyawan melihat nama, shift, dan tanggal libur atau tidak
   masuk teman satu cabang, tanpa alasan dan lampiran.

Dicatat sebagai KEH-102 s.d. 107 (bagian 3.18) di
`../../aturan/02-kehadiran.md`.

### 4D-2a (diajukan 13 Oktober 2026; jawaban pemilik: **"ok"** untuk semua, dibaca setuju saran)

1. **A1 (KEH-108):** pertanyaan "masuk atau pulang?" dihapus; hanya tombol
   yang berlaku; lupa absen lewat "Perlu Dijelaskan".
2. **A2 (KEH-109):** pertanyaan perbantuan muncul sebelum lokasi dan foto;
   shift cabang tujuan yang namanya sama, atau dipilih sendiri dan kepala
   cabang tujuan diberi tahu.
3. **A3 (KEH-110):** Masuk Kembali dan Pulang harus memakai QR cabang tempat
   Masuk; pindah tengah hari dibetulkan HR.
4. **A4 (KEH-111):** absen masuk paling awal 2 jam sebelum jam masuk
   (pengaturan).
5. **A5 (KEH-112):** pemeriksaan penjaga hanya untuk yang berjabatan penjaga.
6. **A6 (KEH-113):** tombol Masuk tidak aktif di hari tutup dan hari libur
   terjadwal; masuk di hari libur lewat permintaan (KEH-46, 4D-4).

Dicatat sebagai KEH-108 s.d. 113 (bagian 3.19) di
`../../aturan/02-kehadiran.md`.

Catatan tidak ditanyakan karena sudah diputuskan: izin Admin HR hanya
melihat jam kerja (KEH-04 hanya menyebut pemilik dan HR); radius, jarak
pengumuman, dan darurat mengikuti PRI-35 dan PRI-36.

### 4D-2b (diajukan 13 Oktober 2026; jawaban pemilik: **"ok"** untuk semua, dibaca setuju saran)

1. **T1 (KEH-114):** dua putusan atas absen luar titik: Wajar (tanda dicabut,
   alasan wajib) atau Perlu dikoreksi (ke pintu koreksi); tidak ada "tolak".
2. **T2 (KEH-115):** dua pola mencurigakan: 3 kali luar titik dalam 7 hari kerja,
   dan dua orang absen dari titik nyaris sama (kurang dari 10 m); angkanya
   pengaturan.
3. **K1 (KEH-116):** koreksi untuk jam masuk, jam pulang, cabang hari itu, dan
   menambah absen; istirahat tidak dikoreksi.
4. **K2 (KEH-117):** tidak boleh mengoreksi absen sendiri; dikoreksi
   Pemilik atau GM.
5. **S1 (KEH-118):** absen yang nyata menang atas libur, izin, sakit, cuti;
   diberi catatan "izin bentrok" untuk HR; Hari tutup tidak bisa bentrok
   karena tombol Masuk tidak aktif.
6. **R1 (KEH-119):** karyawan melihat menit telatnya apa adanya, tanpa kata
   toleransi dan nominal; kantor melihat tanda dalam toleransi; rekap per
   periode 26 sampai 25.

Dicatat sebagai KEH-114 s.d. 119 (bagian 3.20) di
`../../aturan/02-kehadiran.md`.

Catatan tidak ditanyakan (mengikuti aturan yang ada): Admin HR dan Finance
hanya melihat (KEH-28); kepala cabang melihat tetapi tidak memutuskan
(KEH-14); foto tidak bisa diunduh (KEH-15). Usulan Claude yang belum
ditanyakan terpisah dan ikut disetujui bersama spec ini: pencatatan siapa
membuka foto absen (KEH-L14); angka "lebih dari 5 orang, tombol ditahan 3
detik" di KEH-L13; ambang "pulang cepat ditandai" ditunda ke 4D-5 (di sana
"wajib dijelaskan" ditetapkan).

### 4D-2c (diajukan 13 Oktober 2026; jawaban pemilik: **"ok"** untuk semua, dibaca setuju saran)

1. **E1 (KEH-120):** tombol Berangkat dan lapor garasi hanya di layar trip
   Logistik; Kehadiran menerima dan menampilkan hasilnya.
2. **E2 (KEH-121):** orang yang ditambahkan setelah berangkat tercatat jam
   penambahan, tanpa foto ulang; yang dicopot dibatalkan HR lewat koreksi.
3. **E3 (KEH-122):** hari kerja absen trip = tanggal berangkat, bukan jam
   lapor garasi.
4. **E4 (KEH-123):** tanpa denda lupa absen untuk absen lewat trip; trip
   menggantung memakai tanda LOG-31.
5. **E5 (KEH-124):** lokasi saat Berangkat dicatat, tidak diperiksa dan tidak
   masuk pola mencurigakan.

Dicatat sebagai KEH-120 s.d. 124 (bagian 3.21) di
`../../aturan/02-kehadiran.md`.

Catatan tidak ditanyakan (sudah diputuskan): satu tekanan untuk seluruh awak
dan "Tidak jalan" tanpa akibat (KEH-97, 81); telat, pulang cepat, istirahat,
lembur tidak berlaku (KEH-99); foto tertutup, 60 hari, pembukaan dicatat
(KEH-15, 20).

### 4D-3 (diajukan 13 Oktober 2026; jawaban pemilik: **"ok"** untuk semua, dibaca setuju saran)

1. **L1 (KEH-125):** Laporan Pulang berurutan: serah terima, ada masalah?,
   keadaan mobil dan bensin (driver), Kirim; karyawan biasa tiga layar.
2. **L2 (KEH-126):** satu jendela per laporan, tanpa ringkasan (TAM-22 butir 3
   tetap); hanya 7 hari terakhir yang muncul, yang lebih lama di menu.
3. **L3 (KEH-127):** serah terima tanpa penerima yang bisa membaca tetap
   terkirim, berstatus Tidak ada penerima, tampil di Serah Terima Tim.
4. **L4 (KEH-128):** laporan masalah bertanda "menyangkut GM" hanya dibaca
   Pemilik; tidak ada pengecualian untuk pemilik.
5. **L5 (KEH-129):** pelapor melihat status dan satu kalimat tanggapan
   opsional, tanpa menyebut nama yang dilaporkan.
6. **L6 (KEH-130):** keadaan mobil Baru → Sedang ditangani → Selesai; Kepala
   Gudang, Finance, Pemilik, GM yang mengubah; Selesai wajib catatan; satu yang
   menandai cukup; laporan "Baik" tidak menutup otomatis.

Dicatat sebagai KEH-125 s.d. 130 (bagian 3.22) di
`../../aturan/02-kehadiran.md`.

Catatan tidak ditanyakan (sudah diputuskan atau penanganan celah): foto
serah terima kamera atau galeri (KEH-90, TAM-08); pengisi bensin satu pintu ke
Logistik (LOG-83); tanpa batas waktu untuk laporan trip yang ditutup kantor
(KEH-101); Admin HR dan Finance tidak membaca serah terima tim (hanya jenis
yang disebut KEH-92).

### 4D-4a (diajukan 13 Oktober 2026; jawaban pemilik: **"ok saya setuju semua"**, dibaca setuju saran untuk L1 s.d. L9)

1. **L1 (KEH-131):** memilih libur langsung berlaku setelah server memeriksa;
   HR atau pemilik mencabut dengan alasan. Pelapis KEH-36 dan 37 (libur tidak
   lagi lewat persetujuan; pertentangan KEH-31 dengan KEH-36 dan 37 disebut
   dulu ke pemilik).
2. **L2 (KEH-132):** jendela dibuka tanggal 10, ditutup tanggal 25 pukul
   23.59; pengingat H-7, H-3, H-1.
3. **L3 (KEH-133):** digeser sendiri sampai jendela tutup; sesudahnya hanya
   tukar, ubah langsung kepala cabang atau HR, atau pengganti.
4. **L4 (KEH-135):** terlambat memilih: boleh memilih sendiri paling cepat 2
   hari dari hari ini; denda sekali.
5. **L5 (KEH-136):** tukar libur diperiksa KEH-34 saja, tidak KEH-35.
6. **L6 (KEH-137):** diminta masuk di hari libur: tidak ada tombol Tolak;
   peminta membatalkan bila orangnya tidak bisa.
7. **L7 (KEH-138):** libur pengganti paling lambat 14 hari, boleh di periode
   berikutnya; lewat itu Hangus, kompensasi tetap dibayar.
8. **L8 (KEH-134):** jarak 5 hari tetap keras (ditolak server), bukan
   peringatan seperti sistem lama; akhir pekan = Sabtu atau Minggu. Muncul
   dari aturan lama pemilik ("satu libur weekend per bulan, jarak minimal 5
   hari"), yang dicocokkan dengan KEH-35 dan kode sistem lama.
9. **L9 (KEH-139):** tidak ada libur mendadak atas kemauan sendiri; yang
   mendadak dicatat izin mendadak atau alpha (GAJ-13), tanpa denda tersendiri
   tambahan.

Dicatat sebagai KEH-131 s.d. 139 (bagian 3.23) di
`../../aturan/02-kehadiran.md`.

Catatan tidak ditanyakan (sudah diputuskan atau bacaan Claude): tukar shift
berlaku untuk satu tanggal (bacaan atas KEH-43; dibatalkan bila pemilik
menghendaki lain); jatah sebanding untuk orang baru (GAJ-06); teman yang
terlihat hanya satu cabang (KEH-107); perubahan langsung kepala cabang tidak
kena denda (KEH-45). **Belum diputuskan:** orang yang mulai kerja sesudah
jendela memilih libur tertutup (aturan 02-kehadiran bagian 6 butir 5);
sementara tidak diberi tanda tidak memilih libur. *(Diputuskan di 4D-4b, M1.)*

### 4D-4b (diajukan 13 Oktober 2026; jawaban pemilik: **"ok"**, dibaca setuju saran untuk M1 s.d. M9)

1. **M1 (KEH-140):** orang yang mulai kerja sesudah jendela tertutup boleh
   memilih libur dalam 3 hari kerja pertama tanpa tanda; lewat itu tanda
   dicatat.
2. **M2 (KEH-141):** sakit diajukan paling lambat 3 hari sesudah hari
   pertama; lewat itu alpha.
3. **M3 (KEH-142):** server yang melabeli izin mendadak (kurang dari H-2);
   karyawan hanya memilih "Izin keperluan".
4. **M4 (KEH-143):** sakit tanpa surat paling lama 2 hari; lebih dari itu
   dengan surat, boleh "surat menyusul", dihitung ulang setelah masuk.
5. **M5 (KEH-144):** foto surat hanya dibuka HR, Pemilik, GM; dihapus 60
   hari sesudah slip ditutup.
6. **M6 (KEH-145):** hari cuti yang diajukan langsung dipesan; tanpa cuti
   setengah hari; tahun cuti pertama mulai tepat 1 tahun masa kerja.
7. **M7 (KEH-146):** duka 2 hari bebas dibayar; hari berikutnya diajukan
   terpisah sebagai izin atau cuti.
8. **M8 (KEH-147):** pengajuan yang menunggu menahan penanda alpha; ditolak
   menjadi alpha pada saat penolakan.
9. **M9 (KEH-148):** HR, Pemilik, GM boleh mengisikan atas nama orang lain;
   persetujuan dicabut sampai slip ditutup, sesudahnya koreksi susulan.

Dicatat sebagai KEH-140 s.d. 149 (bagian 3.24) di
`../../aturan/02-kehadiran.md`. KEH-149 (bentrokan dan kalender "tidak
masuk") adalah **keputusan Claude yang diumumkan di percakapan** dan tidak
dibantah pemilik.

Bacaan Claude yang tidak ditanyakan (dibatalkan bila pemilik menghendaki
lain): izin mendadak memakai jendela konfirmasi ditahan 3 detik karena
menyangkut uang (TAM-15), sedangkan angka potongan mengikuti Gaji (GAJ-13);
orang per ritase tidak punya layar ini (hari tidak jalan, KEH-81); foto surat
yang sudah dihapus tidak menghalangi hari yang sudah dihitung.

### 4D-5a (diajukan 13 Oktober 2026; jawaban pemilik: **"ok"**, dibaca setuju saran untuk P1 s.d. P9)

1. **P1 (KEH-150):** penanda alpha jalan tiap hari 04.20 untuk hari kemarin;
   dilewati bila ada pengajuan menunggu, libur, hari tutup, izin, sakit, cuti,
   per ritase, atau GM.
2. **P2 (KEH-151):** ambang pulang cepat yang wajib dijelaskan 30 menit, sama
   dengan telat (pengaturan); di bawahnya hanya dicatat.
3. **P3 (KEH-152):** satu kartu per hari alpha, tombol "Jelaskan sama untuk
   hari berturut-turut"; hari yang sudah lewat batas dilepas.
4. **P4 (KEH-153):** batas sakit tanpa surat 2 hari juga berlaku di
   penjelasan alpha; lebih dari itu dengan surat (boleh menyusul).
5. **P5 (KEH-154):** denda lupa Masuk Kembali Rp5.000, sama dengan lupa
   pulang (nominal milik Gaji).
6. **P6 (KEH-154):** kejadian ke-5 dihitung menurut tanggal kejadian di
   periode kejadiannya, bukan tanggal disahkan; dihitung ulang bila ada yang
   dicabut.
7. **P7 (KEH-155):** penjelasan ditolak boleh Ajukan ulang selama dalam batas;
   lupa absen yang lewat batas lewat pengajuan terlambat, alpha dan telat tidak.
8. **P8 (KEH-155):** pulang cepat yang tidak dijelaskan hanya bertanda
   "belum dijelaskan", tanpa akibat uang.
9. **P9 (KEH-156):** penjelasan orang kantor diputuskan penyetuju lain
   (Pemilik atau GM untuk HR); server menolak bila pengesah sama dengan pengaju.

Dicatat sebagai KEH-150 s.d. 158 (bagian 3.25) di
`../../aturan/02-kehadiran.md`. Hal yang dianggap beres dan tidak dibantah
pemilik (keputusan Claude yang diumumkan): tanda 7 hari ditulis sekali per
rangkaian untuk HR dan Pemilik (KEH-157); laporan lupa absen lebih dari 4 kali
untuk Pemilik dan GM tanpa nominal (KEH-157); lupa absen yang dijelaskan
mengisi jam bertanda "diisi lewat klarifikasi" dan hari "belum lengkap" sampai
disahkan (KEH-63); slip tertahan selama ada penjelasan menunggu (KEH-69).

Bacaan Claude yang tidak ditanyakan (dibatalkan bila pemilik menghendaki
lain): penyetuju tidak mengubah jam yang diisi (Tolak lalu Ajukan ulang);
konfirmasi lupa absen ditahan 3 detik dan menyebut nominal dari Gaji;
Laporan Kebiasaan untuk Pemilik dan GM saja; alpha sesudah tanggal nonaktif
tidak ditandai.

### 4D-5b (diajukan 13 Oktober 2026; jawaban pemilik: **"ok"**, dibaca setuju saran untuk E1 s.d. E8)

1. **E1 (KEH-160):** "Ini lembur?" punya tiga tombol: Ya klaim sekarang, Nanti, Bukan lembur; semuanya boleh diubah sampai batas.
2. **E2 (KEH-161):** batas klaim = tanggal hari kerja + 3 hari pukul 23.59; pengingat H-1 dan hari terakhir; pesan hangus menyebut apa yang hangus dan bicara dengan pemilik (PRI-09); ditolak boleh Ajukan ulang dalam batas.
3. **E3 (KEH-162):** pengesah hanya boleh menurunkan jam (jam penuh, alasan wajib), tidak melebihi yang terdeteksi dan 3 jam; menaikkan lewat koreksi absen.
4. **E4 (KEH-163):** penyuruh bukan diri sendiri, hanya dicatat, tanpa persetujuan dan tanpa pemberitahuan; daftarnya pengaturan jabatan (isi awal HR, Pemilik, GM).
5. **E5 (KEH-164):** lembur milik HR, Pemilik, atau GM disahkan penyetuju lain; server menolak bila pengesah sama dengan pengaju.
6. **E6 (KEH-165):** hari lupa absen pulang yang dijelaskan: batas klaim 3 hari sejak penjelasan disahkan; perbantuan memakai jam dan jam tutup cabang tujuan; hari diminta masuk di hari libur tanpa lembur (kompensasi libur); hari tutup tanpa lembur.
7. **E7 (KEH-166):** koreksi yang membuat jam terdeteksi lebih kecil dari yang sudah disahkan ditolak sampai pengesahan dicabut; koreksi yang menaikkan tidak membuka klaim baru.
8. **E8 (KEH-167):** Lembur Tim untuk HR, Pemilik, GM (semuanya); Admin HR tanpa foto; kepala cabang lingkupnya tanpa foto dan tanpa penyuruh; foto kertas tertutup, 60 hari sesudah slip ditutup, pembukaan dicatat.

Dicatat sebagai KEH-159 s.d. 167 (bagian 3.26) di `../../aturan/02-kehadiran.md`. Hal yang dianggap beres dan tidak dibantah pemilik (keputusan Claude yang diumumkan): jam diklaim sama dengan jam terdeteksi (orang tidak mengetik angka); rekap tetap tiga angka, jam hangus hanya tampil di Catatan Hari dan Lembur Tim (KEH-77); satu mesin baru, Penghangus klaim lembur 04.30, supaya pemberitahuan hangus (PRI-09) terkirim tepat waktu.

Bacaan Claude yang tidak ditanyakan (dibatalkan bila pemilik menghendaki lain): tombol Kirim klaim ditahan 3 detik karena menyangkut uang (tanpa nominal, TAM-15); tombol Setujui lembur ditahan 3 detik dan menyebut jumlah jam; hanya orang yang diabsen lewat QR dan berjabatan "dapat lembur" yang punya lembur (KEH-25, 99); lembur kantor dihitung sampai jam tutup kantor (KEH-71).

---

## 14. Daftar periksa (peta jalan Tahap 4), bagian 4D-1

- [x] Tidak melanggar WAJ-01 s.d. 12 (jam kerja milik cabang tanpa nama orang,
      tidak ada yang dihapus, perubahan bertanggal berlaku, satu pintu baca
      jam buka).
- [x] Setiap layar memenuhi TAM-01 s.d. 25 (jendela error, langkah bertahap,
      QR dan perubahan besar ditahan 3 detik, jalan keluar terlihat).
- [x] Rancangan data memenuhi PRI-01 s.d. 41 (perusahaan, tanpa hapus, indeks,
      mesin berpenjaga, pengaturan bertanggal berlaku).
- [x] Setiap aturan bisnis ada di buku aturan dengan nomor (KEH-102 s.d. 107
      ditambah).
- [x] Kejadian di lapangan dan jalan keluar terisi.
- [x] Tiap layar menyebut ukuran utamanya, beda jabatan dicatat. Bentuk yang
      belum ada komponennya: tabel minggu dan strip tujuh hari.
- [x] Perhitungan uang punya contoh angka: modul ini tidak menghitung uang;
      waktu yang memengaruhi uang punya contoh (bagian 12).

### Bagian 4D-2a

- [x] Tidak melanggar WAJ-01 s.d. 12 (jam server, tidak ada yang dihapus,
      penjagaan dibaca dari pengaturan jabatan, bukan nama).
- [x] Setiap layar memenuhi TAM-01 s.d. 25 (langkah bertahap, Kembali,
      jendela error, konfirmasi sebelum kirim).
- [x] Data memenuhi PRI-01 s.d. 41 (perusahaan, tanpa hapus, foto dihapus
      60 hari tanpa menghapus jam, mesin berpenjaga).
- [x] Aturan baru bernomor (KEH-108 s.d. 113) dan KEH-17, 85 diberi tanda
      pelapis.
- [x] Kejadian di lapangan (no 19 s.d. 34) dan jalan keluar terisi.
- [x] Perhitungan telat: angka tidak ditampilkan di layar absen; contoh
      angka di bagian 12 (W9 s.d. W15).
- [x] Disetujui pemilik 13 Oktober 2026 (A1 s.d. A6 sesuai saran).


### Bagian 4D-2b

- [x] Tidak melanggar WAJ-01 s.d. 12 (satu pintu koreksi, tidak ada yang
      dihapus, hitung ulang dengan fungsi yang sama, tanpa nama orang di aturan).
- [x] Setiap layar memenuhi TAM-01 s.d. 25 (jendela error, langkah bertahap,
      konfirmasi ditahan untuk koreksi banyak orang, jalan keluar terlihat).
- [x] Rancangan data memenuhi PRI-01 s.d. 41 (satu catatan hari kerja per orang
      per tanggal, tanpa hapus, mesin berpenjaga, pengaturan bertanggal berlaku).
- [x] Setiap aturan bisnis ada di buku aturan (KEH-114 s.d. 119).
- [x] Kejadian di lapangan (no 35 s.d. 47) dan jalan keluar terisi; tes W16 s.d.
      W20 dan H19 s.d. H27.
- [x] Disetujui pemilik 13 Oktober 2026 (T1, T2, K1, K2, S1, R1 sesuai saran).

### Bagian 4D-2c

- [x] Tidak melanggar WAJ-01 s.d. 12 (satu pencatat absen trip di Logistik,
      tanpa nama orang atau jabatan; membaca slip utama, bukan jabatan).
- [x] Setiap layar memenuhi TAM-01 s.d. 25 (hanya membaca di HP, jendela error,
      jalan keluar lewat koreksi dan LOG-30).
- [x] Data memenuhi PRI-01 s.d. 41 (memakai catatan_absen, tanpa hapus,
      foto 60 hari, akses foto dicatat).
- [x] Aturan baru bernomor (KEH-120 s.d. 124); KEH-91, 96, 97, 101 diberi
      tanda.
- [x] Kejadian (48 s.d. 55), jalan keluar, tes W21 s.d. W25 dan H28 s.d. H32.
- [x] Disetujui pemilik 13 Oktober 2026 (E1 s.d. E5 sesuai saran).

### Bagian 4D-3

- [x] Tidak melanggar WAJ-01 s.d. 12 (satu pemilik tiap data, bensin satu
      pintu ke Logistik, tanpa nama orang atau jabatan di aturan, tidak ada
      yang dihapus).
- [x] Setiap layar memenuhi TAM-01 s.d. 25 (berurutan, jendela error, jendela
      baca satu per satu dengan jeda 1 detik, jalan keluar terlihat).
- [x] Data memenuhi PRI-01 s.d. 41 (perusahaan, tanpa hapus, hanya ditambah,
      jam server, nominal bilangan bulat).
- [x] Aturan baru bernomor (KEH-125 s.d. 130); KEH-92 diberi tanda pelapis
      (126), KEH-93 (128, 129), KEH-94 (130).
- [x] Kejadian (56 s.d. 75), jalan keluar, tes W26 s.d. W28 dan H33 s.d. H41.
- [x] Disetujui pemilik 13 Oktober 2026 (L1 s.d. L6 sesuai saran).

### Bagian 4D-4a

- [x] Tidak melanggar WAJ-01 s.d. 12 (satu pemilik tiap data, pemeriksaan
      satu tempat di server, tanpa nama orang atau jabatan di aturan, tidak
      ada yang dihapus).
- [x] Setiap layar memenuhi TAM-01 s.d. 25 (langkah bertahap, Kembali,
      jendela error, jalan keluar terlihat).
- [x] Data memenuhi PRI-01 s.d. 41 (perusahaan, tanpa hapus, jam server,
      mesin berpenjaga, pengaturan bertanggal berlaku).
- [x] Aturan baru bernomor (KEH-131 s.d. 139); KEH-36 dan 37 diberi tanda
      pelapis.
- [x] Kejadian (76 s.d. 95), jalan keluar, tes W29 s.d. W36 dan H42 s.d. H54.
- [x] Nominal denda dan kompensasi tidak ditulis di sini (milik Gaji, GAJ-15
      dan 16); contoh waktu ada di bagian 12.
- [x] Disetujui pemilik 13 Oktober 2026 (L1 s.d. L9 sesuai saran).

### Bagian 4D-4b

- [x] Tidak melanggar WAJ-01 s.d. 12 (satu pemilik tiap data, label dan
      hitungan satu tempat di server, tanpa nama orang atau jabatan di aturan,
      tidak ada yang dihapus kecuali foto surat 60 hari sesudah slip ditutup).
- [x] Setiap layar memenuhi TAM-01 s.d. 25 (langkah bertahap, Kembali,
      jendela error, konfirmasi ditahan untuk izin mendadak, jalan keluar
      terlihat).
- [x] Data memenuhi PRI-01 s.d. 41 (perusahaan, tanpa hapus, gerak cuti hanya
      ditambah, mesin berpenjaga, pengaturan bertanggal berlaku).
- [x] Aturan baru bernomor (KEH-140 s.d. 149); KEH-135 dan KEH-50, 51 diberi
      tanda pelapis; bagian 6 butir 5 buku aturan ditutup.
- [x] Kejadian (96 s.d. 120), jalan keluar, tes W37 s.d. W45 dan H55 s.d. H66.
- [x] Nominal potongan tidak ditulis di sini (milik Gaji, GAJ-13 dan 14).
- [x] Disetujui pemilik 13 Oktober 2026 (M1 s.d. M9 sesuai saran).

### Bagian 4D-5a

- [x] Tidak melanggar WAJ-01 s.d. 12 (satu pemilik tiap data, kejadian ke-n dan
      hitung ulang satu tempat di server, penanda tanpa nama orang atau jabatan
      di aturan, tidak ada yang dihapus).
- [x] Setiap layar memenuhi TAM-01 s.d. 25 (langkah bertahap, Kembali,
      jendela error, konfirmasi ditahan untuk lupa absen, jalan keluar
      terlihat).
- [x] Data memenuhi PRI-01 s.d. 41 (perusahaan, tanpa hapus, catatan asli
      tidak ditimpa, mesin berpenjaga, pengaturan bertanggal berlaku).
- [x] Aturan baru bernomor (KEH-150 s.d. 158); KEH-54, 55, 56, 58 s.d. 69
      diberi tanda pelapis.
- [x] Kejadian (121 s.d. 143), jalan keluar, tes W46 s.d. W55 dan H67 s.d. H76.
- [x] Nominal denda dan potongan tidak ditulis di sini (milik Gaji, GAJ-13 dan 16).
- [x] Disetujui pemilik 13 Oktober 2026 (P1 s.d. P9 sesuai saran).

### Bagian 4D-5b

- [x] Tidak melanggar WAJ-01 s.d. 12 (satu pemilik tiap data, jam lembur dihitung satu fungsi di server, tidak ada nama orang atau jabatan di aturan, tidak ada yang dihapus).
- [x] Setiap layar memenuhi TAM-01 s.d. 25 (langkah bertahap, Kembali, jendela error, konfirmasi uang ditahan 3 detik, jalan keluar terlihat).
- [x] Data memenuhi PRI-01 s.d. 41 (perusahaan, tanpa hapus, jam server, foto tertutup, mesin berpenjaga, pengaturan bertanggal berlaku).
- [x] Aturan baru bernomor (KEH-159 s.d. 167); KEH-25, 63, 68, 69, 70 s.d. 75, 77 diberi tanda perincian.
- [x] Kejadian (144 s.d. 157), jalan keluar, tes W56 s.d. W65 dan H77 s.d. H84.
- [x] Nominal lembur tidak ditulis di sini (milik Gaji, GAJ-12).
- [x] Disetujui pemilik 13 Oktober 2026 (E1 s.d. E8 sesuai saran).
