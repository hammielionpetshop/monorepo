# 04 — Panduan Karyawan & Pedoman Lapor (Langkah F3-5)

Sumber v3: SIS-06; KAR-57, KAR-79; spec Perlengkapan Bersama BER-L10, BER-L26, §4
(`halaman_panduan`), §11; spec Karyawan KAR-L34, KAR-L35, §4 (`pedoman_lapor`).

## 1. Tujuan

Karyawan hanya punya **satu tempat** mencari "aturannya bagaimana": menu **Panduan** berisi
**Panduan Karyawan**, **Papan Perubahan Aturan** (03), dan **Pedoman Lapor** (SIS-06).

## 2. Panduan Karyawan

- **Isi**: halaman baca berjudul, berurutan (misalnya "Cara absen", "Aturan libur", "Cara mengajukan
  izin", "Membaca slip gaji"); teks sederhana dengan butir dan **gambar**. Kotak cari judul. Hanya baca.
- **Ubah (BER-L26)**: HR, Admin HR, Pemilik, GM. **Tambah, Ubah, Urutkan, Sembunyikan** (tidak
  dihapus). Setiap perubahan tercatat sebelum/sesudah dan **bisa dikembalikan ke versi sebelumnya**.
- Panduan menjelaskan **cara memakai**; aturan yang berubah tetap diumumkan di Papan, bukan
  diselipkan di panduan.
- Sebelum diisi: "Panduan belum diisi."
- 💡 Halaman panduan yang sudah ada di HRIS (panduan aturan potongan) **dipindah** menjadi halaman
  pertama Panduan Karyawan, supaya tidak ada dua tempat.

### Isi awal ✅ (owner 2026-11-15)

v3 menulis isi panduan "dibawa dari sistem lama", tetapi owner melarang membuka HRIS lama. Maka
agent **menyusun draf** halaman dari aturan v3 + layar HRIS baru, satu halaman per kebutuhan
karyawan, lalu owner memeriksa dan menyunting sebelum diterbitkan. Usulan daftar halaman awal:

| Untuk | Halaman |
|---|---|
| Semua yang diabsen | Cara absen (QR, lokasi, foto); Istirahat dan Masuk Kembali; Laporan Pulang; Kalau GPS meleset |
| Semua | Memilih libur dan tukar libur; Izin, sakit, cuti; Perlu Dijelaskan; Lembur |
| Semua | Membaca slip gaji; Keberatan slip; Kasbon |
| Driver, kenek | Absen lewat trip; Slip mingguan; Denda |
| Kepala Toko/Gudang | Jadwal & shift; Foto Absen Hari Ini; Libur cabang |

❓ Halaman tampil untuk semua, atau hanya untuk jabatan yang terkait (seperti Papan)?
Saran 💡: **semua halaman terlihat semua orang**, tetapi tiap halaman punya penanda "untuk siapa"
dan daftar menaruh halaman yang cocok dengan jabatannya di atas.

## 3. Pedoman Lapor

- **Isi (KAR-57)**: untuk tiap jenis kasus, tertulis **harus lapor ke siapa lebih dulu**, supaya
  tidak langsung ke HR atau pemilik. Contoh: "Untuk sakit: kabari Kepala Toko dulu lewat WA."
- **Hanya untuk dibaca (KAR-79)**: tidak menambah tahap persetujuan; pengajuan tetap langsung ke
  penyetuju jenisnya.
- **Baca (KAR-L34)**: semua orang, di menu Panduan. Baris yang cocok **juga tampil di layar Pengajuan
  Saya** untuk jenisnya (sudah ada sekarang sebagai baris tetap di kode).
- **Ubah (KAR-L35)**: Pemilik dan GM. Tambah, ubah, urutkan, nonaktifkan baris; perubahan tercatat.
- Baris pedoman boleh **terkait ke jenis pengajuan** (tampil di Pengajuan Saya) atau **berdiri
  sendiri** untuk kasus yang bukan pengajuan (misalnya "Barang rusak di rak: lapor Kepala Toko",
  "Mobil mogok: telepon Kepala Gudang").

### Isi awal ✅ (owner 2026-11-15)

Baris `guideLine` yang sekarang tertulis di kode per jenis pengajuan dipindah menjadi data sebagai
isi awal, lalu owner menyunting dan menambah kasus yang bukan pengajuan. Kode tidak lagi menyimpan
teks pedoman (WAJ-05).

## 4. Layar dan menu

| Layar | Menu | Siapa | Perangkat |
|---|---|---|---|
| Panduan (menu baru) | Bilah menu › **Panduan**: Panduan Karyawan · Papan Perubahan Aturan · Pedoman Lapor | Semua | HP |
| Panduan Karyawan (BER-L10) | Panduan | Semua | HP |
| Ubah Panduan Karyawan (BER-L26) | Kantor › Pengumuman › kartu Panduan Karyawan | HR, Admin HR, Pemilik, GM | PC |
| Pedoman Lapor (KAR-L34) | Panduan | Semua | HP |
| Ubah Pedoman Lapor (KAR-L35) | Pengaturan › Karyawan | Pemilik, GM | PC |

## 5. Kriteria selesai

- Tes: hak ubah per jabatan; versi panduan bisa dikembalikan; baris pedoman nonaktif tidak tampil
  di Pengajuan Saya; isi pedoman tidak lagi dibaca dari kode.
- Uji owner: sunting satu halaman panduan dengan gambar, kembalikan ke versi lama; ubah satu baris
  pedoman dan lihat berubah di Pengajuan Saya.

## 6. Pertanyaan terbuka

- ❓ Gambar di panduan: cukup unggah foto/tangkapan layar (disimpan di penyimpanan berkas HRIS)?
  Saran 💡: ya, dikompres; tanpa video.
- ❓ Siapa yang menyusun isi akhir Pedoman Lapor? v3: **pemilik**. Agent hanya menyiapkan isi awal
  dari baris yang sudah ada.
