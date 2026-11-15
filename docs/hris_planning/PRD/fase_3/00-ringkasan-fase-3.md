# 00 — Ringkasan Fase 3

## 1. Latar belakang

- Fase 1 (HRIS L0–L8), Logistik penuh, dan Fase 2 (Susunan Web & Keuangan) sudah dibangun dan
  lolos uji owner di staging. Rilis HRIS ke produksi ditunda sampai owner memutuskan (2026-11-14).
- Di Fase 1, Perlengkapan Bersama sengaja hanya memuat **Mesin Pengajuan, Pengaturan, Beranda dan
  Pemberitahuan dasar** (owner 2026-10-29); fitur pendukung lain ditulis "menyusul"
  (`../fase_1/03-perlengkapan-bersama.md` §1, `../fase_1/00-ringkasan-fase-1.md` §5).
- Akibatnya hari ini:
  - **Pengingat** dari tiap modul dikirim **sekali per tanda** ke lonceng; tidak ada jendela yang
    memaksa dibaca (spec L3e/L3f/L3g/L3h §9 "pengingat berantai menyusul").
  - **Perubahan pengaturan** (tarif, potongan, jam kerja) langsung berlaku tanpa pengumuman ke
    karyawan. Tanda `mustAnnounce` sudah ada di daftar pengaturan HRIS tetapi belum dipakai.
  - **Tidak ada cara** mengirim kabar mendesak ("Toko tutup karena banjir") lewat sistem.
  - **Pedoman lapor** baru berupa satu baris tetap di kode per jenis pengajuan (`guideLine`), tidak
    bisa diubah owner. **Panduan Karyawan** belum ada; yang ada hanya satu halaman panduan aturan
    potongan dan "Apa yang baru".
- ✅ Owner 2026-11-14 meminta Fase 3 berisi: **Papan Perubahan Aturan, Pengumuman Darurat,
  Pengingat Berantai, Panduan Karyawan, dan Pedoman Lapor**.

## 2. Tujuan Fase 3

1. **Tidak ada aturan yang berubah diam-diam** (PRI-29): setiap perubahan yang menyangkut karyawan
   diumumkan sebelum berlaku, hanya ke yang terkena, dan tercatat siapa yang sudah membaca.
2. **Kabar mendesak sampai dalam hitungan menit** ke semua orang yang dituju, di layar mana pun.
3. **Pengingat yang menyangkut uang atau hak tidak terlewat**: muncul satu jendela demi satu jendela
   sampai urusannya beres (TAM-22).
4. **Satu menu "Panduan"** tempat karyawan mencari cara memakai sistem, aturan yang berlaku, dan
   harus lapor ke siapa (SIS-06).

## 3. Ukuran berhasil

- Setiap pengaturan HRIS bertanda wajib diumumkan tidak bisa disimpan tanpa pengumuman (atau alasan
  "tidak perlu diumumkan").
- Pemilik bisa melihat, per pengumuman, siapa yang **belum** membaca.
- Pengumuman darurat tampil di HP penerima yang sedang membuka HRIS paling lambat **1 menit**
  setelah dikirim, tanpa menghapus isian yang sedang diketik.
- Pengingat yang lolos pegangan TAM-24 tidak lagi hanya di lonceng: muncul sebagai jendela sekali
  sehari sampai beres.
- Layar absen tidak pernah terhalang jendela apa pun (TAM-22 butir 2).
- Pedoman lapor dan halaman Panduan bisa diubah Pemilik/GM tanpa mengubah kode.

## 4. Pengguna

Jabatan sama seperti Fase 1. Yang paling terlibat:

- **Pemilik, GM** (HR saat ini dirangkap GM): menulis dan menyetujui pengumuman, mengirim
  pengumuman darurat, mengisi Panduan dan Pedoman Lapor.
- **Admin HR**: membantu menulis pengumuman (yang menyangkut uang tetap disetujui Pemilik/GM) dan
  mengubah Panduan.
- **Semua karyawan**: membaca dan menandai "Sudah saya baca"; membuka menu Panduan dari HP.

## 5. Lingkup

**Masuk Fase 3**

| Bagian | Layar v3 | PRD |
|---|---|---|
| Antrean berantai (jendela satu per satu) | BER-L03; kartu pengumuman di Beranda (BER-L01 butir 1) | [01](01-antrean-berantai.md) |
| Pindahan pengingat modul yang lolos TAM-24 ke antrean | daftar-lintas-modul bab 2 (jenis milik modul yang sudah ada) | [01](01-antrean-berantai.md) §5 |
| Pengumuman darurat | BER-L24, L25; daftar di BER-L22, L08 | [02](02-pengumuman-darurat.md) |
| Papan Perubahan Aturan | BER-L08, L09, L22, L23, L25 | [03](03-papan-perubahan-aturan.md) |
| Wajib umumkan saat pengaturan diubah | pelapis BER-L41 (PRI-35 butir 2) | [03](03-papan-perubahan-aturan.md) §4 |
| Panduan Karyawan | BER-L10, L26 | [04](04-panduan-dan-pedoman-lapor.md) |
| Pedoman Lapor | KAR-L34, L35 | [04](04-panduan-dan-pedoman-lapor.md) |
| Menu **Panduan** dan menu Kantor › **Pengumuman** | `00-peta-modul.md` bagian Menu | 03, 04 |

**Tidak masuk Fase 3**

- **Modul Kinerja & Rekrutmen** (rapor, Bonus Terukur, bonus promo, **Tugas dan laporan berfoto,
  daftar rak**, Catatan Rapat). ✅ Owner 2026-11-15: dibangun di **Fase 4** (`../fase_4/`), karena
  memakai antrean berantai Fase 3 untuk pengingat tugas (KIN-76) dan Papan untuk aturan dari rapat
  (KIN-46).
- **Kesehatan Mesin & Riwayat Error** (BER-L30 s.d. L33), **Jejak Perubahan** (BER-L34),
  **tempat uji & "Lihat sebagai"** (BER-L50, L51, KAR-L41): fitur pendukung lain yang tidak diminta
  owner untuk Fase 3. Catatan jalan mesin sudah disimpan sejak Fase 1.
- **Notifikasi HP (push)** di luar aplikasi ✅ (owner 2026-11-15, [02](02-pengumuman-darurat.md) §6).
- Pengumuman di **web POS/Back Office, Finance, Logistik**: Fase 3 hanya di web HRIS ✅ (owner
  2026-11-15, [02](02-pengumuman-darurat.md) §6).
- "Apa yang baru" (BER-L11) dan tanda Baru: **sudah ada** sejak Fase 1, tidak diubah.

## 6. Prinsip yang mengikat Fase 3

Semua prinsip Fase 1 (`../fase_1/00-ringkasan-fase-1.md` §6) tetap berlaku. Tambahan:

1. **Tiga pintu pemberitahuan, satu mesin** (TAM-25, WAJ-04): antrean berantai, Perlu perhatian,
   dan lonceng. Tidak ada modul yang membuat jendela atau lonceng sendiri.
2. **Pengumuman tidak diubah dan tidak dihapus** (PRI-40 butir 2): salah isi = Ralat; batal sebelum
   berlaku = Tarik dengan alasan.
3. **Tidak pernah menghalangi absen** (TAM-22 butir 2) dan **tidak menghapus isian** (TAM-16).
4. **Panduan menjelaskan cara memakai; aturan yang berubah diumumkan di Papan** (BER-L26).
5. **Pedoman lapor hanya untuk dibaca**: tidak menambah tahap persetujuan (KAR-79).
6. **Tidak menggandakan fitur POS** dan **tidak membuka HRIS lama** (aturan AGENTS.md, memori owner).

## 7. Urutan langkah

| Langkah | Isi | PRD | Bergantung pada |
|---|---|---|---|
| **F3-1** | Mesin antrean berantai + jendela BER-L03 + kartu pengumuman di Beranda | 01 | — |
| **F3-2** | Pengumuman darurat (kirim, jendela 5 detik, akhiri, siapa sudah baca) | 02 | F3-1 |
| **F3-3** | Papan Perubahan Aturan + menu Kantor › Pengumuman + wajib umumkan saat pengaturan diubah | 03 | F3-1 |
| **F3-4** | Pindahkan pengingat modul yang lolos TAM-24 dari "sekali per tanda" ke antrean | 01 §5 | F3-1 |
| **F3-5** | Menu Panduan: Panduan Karyawan + Pedoman Lapor (baca & ubah) | 04 | — (boleh paralel) |

💡 F3-5 tidak bergantung pada antrean dan boleh dikerjakan lebih dulu bila owner ingin isi panduan
segera. F3-2 sebelum F3-3 karena lebih kecil dan langsung berguna.

## 8. Definisi selesai satu langkah

Sama dengan Fase 1 §8: tes mesin + hak akses lulus, typecheck/lint/test hijau, dicoba owner di
staging, WIP + changelog HRIS + tanda Baru diperbarui. Tambahan untuk F3-1 dan F3-2: dicoba di
**HP sungguhan** (jendela muncul di atas isian, layar absen tidak terhalang).

## 9. Penyimpangan dari v3

| Hal | v3 | Fase 3 | Alasan |
|---|---|---|---|
| Letak | Satu app HRIS | Web **HRIS** saja; web lain belum | ✅ owner 2026-11-15; Fase 2 memecah 4 web dan semua karyawan sudah memakai HRIS di HP untuk absen |
| Notifikasi HP | — | Tidak ada push; pengirim melihat siapa yang belum baca | ✅ owner 2026-11-15 |
| Penulis pengumuman | HR, Pemilik, GM | Sama; HR saat ini dirangkap GM | Pengumuman uang oleh GM langsung terbit (GM boleh menyetujui) |
| Isi awal Panduan Karyawan | "Dibawa dari sistem lama" (SIS-06) | **Disusun baru** dari aturan v3 + layar HRIS baru, diperiksa owner | ✅ owner 2026-11-15; owner melarang membuka HRIS lama |
| Isi awal Pedoman Lapor | Disusun pemilik | Baris `guideLine` yang sudah ada di kode dipindah menjadi data sebagai isi awal, lalu disunting owner | ✅ owner 2026-11-15 |
| Pengingat berantai jenis Keuangan/Kinerja | Termasuk di daftar 76 jenis | Hanya jenis milik modul yang sudah ada | Modul Keuangan v3 diganti Finance baca-saja (Fase 2); Kinerja belum dibangun |
