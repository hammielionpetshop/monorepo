# F3-5 Menu Panduan: Pedoman Lapor + Panduan Karyawan — rancangan

Status: **konsep, menunggu persetujuan owner** atas keputusan §8. Belum dikoding.

Sumber: PRD Fase 3 `04-panduan-dan-pedoman-lapor.md` (✅ isi awal: Panduan disusun baru dari v3, Pedoman
dari baris `guideLine` di kode); v3 SIS-06, KAR-57, KAR-79, BER-L10, BER-L22, BER-L26, KAR-L34, KAR-L35,
tabel `halaman_panduan` & `pedoman_lapor`; PRI-29 (aturan berubah diumumkan di Papan, bukan di panduan).

## 0. Pembagian F3-5

| Langkah | Isi | Migrasi | Bagian |
|---|---|---|---|
| **F3-5a** | **Pedoman Lapor**: teks pindah dari kode ke data, layar baca (menu Panduan) + layar ubah (Pemilik/GM) | hris `0063` | §2 |
| **F3-5b** | **Panduan Karyawan**: halaman baca + layar ubah (tambah/ubah/urutkan/sembunyikan, gambar, versi & kembalikan); Aturan Potongan masuk daftarnya | hris `0064` | §3 |
| **F3-5c** | **Isi awal Panduan**: agent menulis draf ±17 halaman (tabel PRD 04 §2), dimuat dalam keadaan **tersembunyi**; owner periksa → tampilkan satu per satu | tidak (data lewat layar ubah / skrip muat) | §4 |

Pedoman didahulukan karena kecil dan sudah dipakai di layar pengajuan. Ketiganya web HRIS (alur `dev_hris`),
masing-masing dengan fragment changelog HRIS + tanda Baru.

## 1. Keadaan sekarang (kode `origin/dev_hris` ce989c76)

- `guideLine` tertulis di kode per jenis pengajuan (`modules/requests/rules/types.ts`, 24 jenis). Tampil di
  kepala isian pengajuan (`ui/form-frame.tsx`) dan di layar Jenis Pengajuan (`ui/approvals-screen.tsx`, baris
  "Pedoman lapor"). Isinya kebanyakan "ajukan dari menu X, siapa yang memutuskan" — belum "lapor ke siapa dulu".
- Kelompok menu **Panduan** sudah ada (`lib/nav.ts`): Papan Perubahan Aturan + Aturan Potongan.
- **Aturan Potongan dan Bonus** (`/guides/deduction-rules`) bukan teks tetap: kartunya **dihitung dari
  Pengaturan** (contoh memakai gaji standar).
- Unggah berkas: modul `files` (jpeg/png/webp, maks 10 MB, terlindungi — tiap modul punya rute baca
  sendiri yang memeriksa hak). Kamera di Absen/Logistik sudah mengompres di browser (JPEG 0,75).
- Jejak perubahan umum: tabel `hris.audit_events`.

## 2. F3-5a Pedoman Lapor

### 2.1 Data (migrasi hris `0063`)

Tabel `report_guides`: `id`, `request_type` (kunci jenis pengajuan, boleh kosong), `case_label` (jenis kasus;
wajib bila `request_type` kosong), `report_to` (teks satu–dua kalimat), `sort_order`, `active`, `updated_by`,
`updated_at`. Paling banyak **satu baris aktif per jenis pengajuan** (indeks unik bersyarat).

- Isi awal: 24 baris dari `guideLine` sekarang, `request_type` terisi, urutan = urutan daftar jenis.
- Sesudah migrasi, `guideLine` **dihapus dari kode** (WAJ-05). Kepala isian & layar Jenis Pengajuan membaca
  tabel; jenis tanpa baris aktif → baris pedoman tidak ditampilkan (bukan jatuh ke teks kode).
- Tindakan baru `report_guide.manage` (Ubah Pedoman Lapor) — hanya Pemilik/GM (`full_access`), tidak
  diberikan ke jabatan lain.

### 2.2 Layar

| Layar | Menu | Siapa | Isi |
|---|---|---|---|
| **Pedoman Lapor** (KAR-L34) | Panduan › Pedoman Lapor | Semua | Daftar baris aktif berurutan: **jenis kasus → lapor ke siapa**. Kotak cari. Kosong: "Pedoman belum diisi." |
| **Ubah Pedoman Lapor** (KAR-L35) | Pengaturan › Pedoman Lapor (+ tautan dari Jenis Pengajuan) | Pemilik, GM | Tambah baris (pilih jenis pengajuan **atau** tulis jenis kasus sendiri, mis. "Mobil mogok"), Ubah, Urutkan (naik/turun), Nonaktifkan/Aktifkan. Tidak ada hapus. |

- Tiap perubahan masuk `audit_events` (sebelum/sesudah) dan tampil di "Riwayat" baris itu.
- Pedoman **hanya untuk dibaca** (KAR-79): tidak mengubah siapa penyetuju; tidak wajib diumumkan di Papan.

### 2.3 Tes F3-5a

- Aturan: hanya `full_access` lolos `report_guide.manage`; jenis kasus wajib bila tanpa jenis pengajuan.
- Integrasi DB: baris nonaktif tidak tampil di kepala isian pengajuan; dua baris aktif untuk satu jenis ditolak;
  tidak ada lagi `guideLine` di `REQUEST_TYPES` (tes memeriksa).

## 3. F3-5b Panduan Karyawan

### 3.1 Data (migrasi hris `0064`)

- `guide_pages`: `id`, `sort_order`, `hidden`, `current_version`, `created_at`.
- `guide_page_versions`: `page_id`, `version` (1, 2, 3…), `title`, `audience` (daftar jabatan; kosong = semua),
  `blocks` (JSON), `note` (catatan ubah, opsional), `created_by`, `created_at`. Versi **tidak pernah diubah atau
  dihapus**.
- **Isi berbentuk blok**, bukan HTML (aman dari sisipan skrip): `heading`, `paragraph`, `bullets` (daftar butir),
  `image` (id berkas + keterangan). Ditulis di layar ubah sebagai daftar blok: tambah blok, geser, hapus blok.
- Tindakan baru `guide.manage` — HR, Admin HR (dibenihkan `ALL`), Pemilik/GM (`full_access`).

### 3.2 Layar

| Layar | Menu | Siapa | Isi |
|---|---|---|---|
| **Panduan Karyawan** (BER-L10) | Panduan › Panduan Karyawan | Semua | Daftar judul berurutan + penanda "untuk: Kasir, Driver…"; halaman yang cocok dengan jabatan saya **di atas**, sisanya di bawah judul "Halaman lain". Kotak cari (judul dan isi). Kosong: "Panduan belum diisi." HP. |
| Halaman panduan | dari daftar | Semua | Judul, blok teks & gambar (gambar bisa diperbesar), "Diperbarui tanggal …". |
| **Ubah Panduan Karyawan** (BER-L26) | Kantor › Pengumuman › kartu **Panduan Karyawan** | HR, Admin HR, Pemilik, GM | Daftar semua halaman (termasuk tersembunyi, ditandai): **Tambah**, **Ubah**, **Urutkan**, **Sembunyikan/Tampilkan**. Tidak ada hapus. PC. |
| Riwayat versi | dari Ubah | sama | Daftar versi (kapan, siapa, catatan); lihat isi versi lama; **Kembalikan ke versi ini** = membuat versi baru berisi salinan versi lama (riwayat tidak ditulis ulang). |

- Sembunyikan/Tampilkan dan Urutkan masuk `audit_events`; ubah isi tercatat sebagai versi.
- Halaman tersembunyi hanya terlihat pemegang `guide.manage`.
- **Gambar**: unggah foto/tangkapan layar lewat modul `files`, dikompres di browser (sisi terpanjang ±1600 px,
  JPEG 0,8) sebelum dikirim; tanpa video. Rute baca baru `/api/guides/images/[fileId]`: boleh dibuka akun HRIS
  mana pun **bila** berkas dipakai halaman yang tampil; versi lama/halaman tersembunyi hanya untuk `guide.manage`.
- Layar ubah mengingatkan: "Panduan menjelaskan cara memakai. Aturan yang berubah diumumkan di Papan
  Perubahan Aturan." + tombol ke Tulis perubahan aturan.
- **Aturan Potongan dan Bonus** tetap halaman hitungan dari Pengaturan (angkanya tidak disalin ke teks supaya
  tidak basi), tetapi **dipindah ke dalam daftar Panduan Karyawan** sebagai halaman tetap berlabel "otomatis
  dari Pengaturan" (urutannya bisa diatur, tidak bisa diubah isinya). Menu terpisah "Aturan Potongan" dihapus;
  alamat lamanya tetap terbuka.

Menu Panduan sesudah F3-5: **Panduan Karyawan · Papan Perubahan Aturan · Pedoman Lapor**.

### 3.3 Tes F3-5b

- Aturan: hak `guide.manage`; susunan daftar (cocok jabatan di atas, tersembunyi hanya untuk pengubah);
  pemeriksa blok menolak jenis blok tak dikenal / gambar bukan milik modul.
- Integrasi DB: simpan → versi naik; kembalikan ke versi 1 → versi 3 berisi isi versi 1, versi 2 tetap ada;
  akun biasa tidak bisa membuka gambar halaman tersembunyi.

## 4. F3-5c Isi awal Panduan

- Agent menulis draf halaman sesuai tabel PRD 04 §2 (±17 halaman: absen, istirahat, Laporan Pulang, GPS
  meleset, libur & tukar libur, izin/sakit/cuti, Perlu Dijelaskan, lembur, slip, keberatan slip, kasbon, absen
  lewat trip, slip mingguan, denda, jadwal & shift, Foto Absen Hari Ini, libur cabang) dari **aturan v3 + layar
  HRIS baru saja** (tidak membuka HRIS lama). Tanpa gambar; owner/HR menambah tangkapan layar sendiri.
- Draf dimuat dengan akun pembuat "Sistem (isi awal)" dalam keadaan **tersembunyi**. Owner membaca, menyunting
  di layar ubah, lalu menekan **Tampilkan** per halaman. Tidak ada yang terlihat karyawan sebelum owner
  menampilkannya.
- Pedoman Lapor: sesudah F3-5a owner menyunting 24 baris awal (yang sekarang berbunyi "ajukan dari menu …")
  dan menambah kasus bukan pengajuan; agent boleh menyiapkan usulan kalimat bila diminta.

## 5. Klaim & alur

- F3-5a: klaim `apps/hris/modules/requests/rules/types.ts`, `ui/form-frame.tsx`, `ui/approvals-screen.tsx`,
  modul baru `apps/hris/modules/guides/**`, `lib/nav.ts`, `modules/access/rules/actions.ts` + **kunci migrasi `hris`**
  (0063) lewat `docs/claim-f3-5a-report-guide` ke staging; worktree `feat/hris-f3-5a-report-guide` dari
  `origin/dev_hris`.
- F3-5b: sama untuk `modules/guides/**`, `app/(app)/guides/**`, halaman Pengumuman, `lib/nav.ts`, `actions.ts`
  + kunci `hris` (0064); worktree `feat/hris-f3-5b-guide-pages`.
- F3-5c: branch data/dokumen; tanpa migrasi bila dimuat lewat skrip muat ke staging.

## 6. Bukan lingkup

Video; panduan per cabang; tanda "sudah baca" untuk panduan (itu milik Papan); terjemahan; mengubah teks
Panduan BO/POS (web lain).

## 7. Uji owner (staging), per langkah

- **F3-5a**: buka Panduan › Pedoman Lapor (24 baris muncul); ubah baris "Izin, sakit" → buka Pengajuan Saya ›
  ajukan sakit, kalimat baru tampil; nonaktifkan → kalimat hilang dari isian; tambah kasus "Mobil mogok: telepon
  Kepala Gudang" (tampil di Pedoman, tidak di pengajuan).
- **F3-5b**: tambah halaman dengan 1 gambar, untuk jabatan Kasir → akun kasir melihatnya di atas; ubah sekali,
  lalu **Kembalikan** ke versi pertama; sembunyikan → akun kasir tidak melihat; Aturan Potongan ada di daftar.
- **F3-5c**: baca draf tersembunyi, sunting, tampilkan beberapa halaman.

## 8. Keputusan owner (menunggu)

1. **Pecah tiga langkah** F3-5a Pedoman → F3-5b Panduan → F3-5c isi awal. Saran 💡: ya.
2. **Siapa melihat halaman panduan**: semua orang melihat semua halaman; tiap halaman punya penanda "untuk
   siapa" dan yang cocok jabatannya tampil di atas. Saran 💡: ya (sesuai usul PRD 04 §2).
3. **Gambar**: unggah foto/tangkapan layar, dikompres otomatis, tanpa video. Saran 💡: ya.
4. **Aturan Potongan** tetap halaman hitungan otomatis, dipindah ke dalam daftar Panduan Karyawan (bukan disalin
   jadi teks). Saran 💡: ya — kalau disalin, angkanya basi saat Pengaturan berubah.
5. **Letak Ubah Pedoman Lapor**: menu baru Pengaturan › Pedoman Lapor (HRIS belum punya "Pengaturan › Karyawan"
   seperti v3) + tautan dari Jenis Pengajuan. Saran 💡: ya.
6. **Isi awal panduan dimuat tersembunyi**, tampil hanya setelah owner menekan Tampilkan per halaman. Saran 💡: ya.
