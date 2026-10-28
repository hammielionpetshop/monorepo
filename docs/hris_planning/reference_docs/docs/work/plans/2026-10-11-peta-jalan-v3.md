# Peta Jalan v3: dari nol sampai siap dibangun

Tanggal: 11 Oktober 2026

Posisi terakhir tiap tahap ditulis di `../WIP.md`, bukan di sini (WAJ-08).

## Tujuan

Semua dibahas tuntas di folder ini. Hasilnya dokumen per modul yang matang, dengan
sistem lama sebagai rujukan, karena modul-modul sistem lama pada dasarnya sudah
benar. Setelah matang, dokumen dibawa ke project baru, dan sesi Claude di sana
mengerjakannya satu per satu **tanpa ada yang diubah di tengah jalan**.

Artinya: folder ini menghasilkan dokumen, bukan kode. Kode ditulis di project baru.

## Tahapan

### Tahap 0. Aturan cara bekerja

Aturan wajib, pola baku tampilan, prinsip rancangan, aturan kerja, dan susunan
dokumen.

Hasil: `docs/aturan/00-*.md`, `docs/work/aturan-kerja.md`, `CLAUDE.md`.

### Tahap 1. Aturan sistem

Sistemnya apa, untuk siapa, memakai apa, rencananya bagaimana, dan kapan disebut
selesai. Empat hal yang harus diputuskan pemilik:

1. **Batas sistem**: apa yang termasuk v3 dan apa yang sengaja tidak, termasuk
   apakah disiapkan untuk dijual ke perusahaan lain
   (`../backlog/2026-10-11-bisa-tumbuh-dan-siap-dijual.md`).
2. **Alat dan server**: tetap seperti sistem lama, atau pindah ke server sendiri.
3. **Rencana tayang**: modul mana tayang lebih dulu, dan bagaimana berdampingan
   dengan sistem lama.
4. **Data lama**: apa yang dipindahkan dan apa yang ditinggal.

Hasil: `docs/aturan/00-gambaran-sistem.md`, dan `docs/teknis.md` terisi.

Butir 2 boleh diputuskan paling akhir (di Tahap 4), karena buku aturan modul tidak
bergantung pada alat. Butir 1, 3, dan 4 diputuskan di awal.

### Tahap 2. Gali dan putuskan, modul demi modul

Untuk tiap modul, tiga langkah berurutan sebelum pindah ke modul berikutnya:

1. **Gali**: Claude membaca sistem lama (kode dan database) dan menulis draf buku
   aturan beserta pertanyaan.
2. **Diskusi**: pemilik menjawab pertanyaan dan memutuskan tiap aturan: bawa,
   ubah, atau buang. Kejadian di lapangan dibahas di sini (WAJ-11).
3. **Tetapkan**: Claude menulis ulang buku aturan menjadi versi bersih yang hanya
   berisi aturan yang berlaku di v3.

Urutan modul disusun dari yang tidak bergantung pada modul lain:

| Urutan | Modul | Isinya | Bergantung pada |
|---|---|---|---|
| 1 | Karyawan dan Akses | Cabang, jabatan, karyawan, **login**, hak akses | tidak ada |
| 2 | Kehadiran | Jam kerja cabang, QR absen, hari kerja, libur, izin, sakit, lembur, klarifikasi | 1 |
| 3 | Gaji Bulanan | Komponen gaji, potongan, bonus, slip, periode | 1, 2 |
| 4 | Logistik | Rencana kirim, muat, antar jemput, nota, retur, grooming, toko | 1 |
| 5 | Gaji Driver, Borongan, Kasbon | Ritase, borongan per kg, pembayaran mingguan, kasbon | 1, 3, 4 |
| 6 | Keuangan | Kas, bank, piutang, pembelian, laporan kasir | 3, 4, 5 |
| 7 | Kinerja dan Rekrutmen | KPI, tugas harian, meeting, rekrutmen | 1, 3 |

Login tidak dijadikan modul tersendiri. Login adalah bagian dari Karyawan dan
Akses, karena akun selalu milik satu karyawan.

Logistik dikerjakan sebelum Gaji Driver, karena upah ritase dihitung dari
perjalanan yang dicatat di Logistik.

Hasil: `docs/aturan/01-*.md` sampai `07-*.md`, masing-masing berstatus "ditetapkan".

### Tahap 3. Rancangan lintas modul

Hal yang dipakai bersama oleh banyak modul dirancang satu kali:

1. Peta data: daftar tabel, pemiliknya, dan hubungannya (WAJ-03).
2. Daftar hak akses per jabatan (satu daftar untuk semua modul).
3. Menu baru, memakai catatan tab yang seharusnya digabung.
4. Pola bersama: pedoman lapor (KAR-57), hari kerja (PRI-17), catatan upah (PRI-19), periode (PRI-22),
   jalur pengajuan (PRI-23), daftar pengecualian (PRI-26), papan perubahan aturan
   (PRI-29), riwayat error (TAM-05).
5. Tarik data kasir.
6. Rencana pindah data dari sistem lama.
7. **Sistem desain**: warna, huruf, mode terang dan gelap, dan komponen baku yang
   diwajibkan TAM (jendela error, jendela konfirmasi 3 detik, layar langkah demi
   langkah, tombol, tanda "Baru"), untuk PC dan handphone. Dibuat dengan Claude
   Design, lalu disetujui pemilik. Semua layar dibangun dari komponennya
   (`docs/work/desain/README.md`).

Hasil: `docs/work/specs/` berisi rancangan lintas modul, dan
`docs/aturan/00-peta-modul.md` terisi lengkap.

Pembagian sesi (disetujui pemilik 13 Oktober 2026): 3A peta data (butir 1),
3B hak akses dan cara masuk (butir 2), 3C menu (butir 3), 3D pola bersama
waktu dan uang, 3E pola bersama pengajuan dan laporan (butir 4), 3F tarik
data kasir (butir 5), 3G periksa silang dan tutup. Butir 6 sudah terjawab di
SIS-23 s.d. 33; butir 7 dikerjakan pemilik sendiri di Claude Design.
Posisinya di `docs/work/WIP.md`.

### Tahap 4. Spec siap bangun, modul demi modul

Untuk tiap modul, urutan sama seperti Tahap 2. Tiap spec berisi: layar dan
langkahnya, data, aturan yang dipakai (dengan nomornya), kejadian di lapangan,
jalan keluar, dan daftar tes.

**Layar tidak digambar satu per satu** (pengganti, keputusan pemilik
13 Oktober 2026, CHANGELOG 153; menggantikan "tiap spec disertai gambar layar"
dan "jumlah gambar" yang ditetapkan sebelumnya). Bentuk tampilan sudah ada
sebagai komponen baku di sistem desain v1.0 dan menu v1. Spec menulis isi tiap
layar (bagian 2 dan 3), dan sesi pembangunan menyusun layar dari komponen yang
sama. Pegangannya: `docs/work/desain/README.md` (urutan sumber, aturan untuk
sesi pembangunan, daftar komponen baku, dan satu file contoh penerapan).
Alasan: menggambar puluhan layar per modul menghabiskan kuota, padahal isinya
komponen yang sama diulang; yang menentukan benar tidaknya layar adalah spec
dan aturan TAM. Pemilik memeriksa tampilan pada layar yang sudah jadi di tempat
uji (Tahap 6).

**Cara kerja tiap bagian modul:** satu sesi per bagian: menulis spec teks dan
pertanyaan di percakapan, jawaban dicatat, lalu spec disetujui. Tidak ada brief
Claude Design dan tidak ada sesi periksa gambar. Bagian yang besar tetap boleh
dipecah menjadi beberapa sesi (KER-11).

**Pembagian** (disetujui pemilik 13 Oktober 2026): 4A Karyawan dan Akses
(sekalian contoh bentuk spec), 4B Perlengkapan Bersama (dan plan tempat uji
serta alur rilis), 4C Tarik Data Kasir, 4D Kehadiran, 4E Gaji Bulanan, 4F
Logistik, 4G Gaji Driver–Bongkaran–Kasbon, 4H Keuangan (semula H1 dan H2; dipecah sebelas bagian 4H-1 s.d. 4H-11, disetujui 14 Oktober 2026), 4I Kinerja (dipecah enam bagian 4I-1 s.d. 4I-5 dengan 4I-4a dan 4I-4b, disetujui 14 Oktober 2026),
4J periksa silang, daftar titipan lengkap, dan urutan pembangunan. 4B dan 4C
didahulukan karena dipakai hampir semua modul. Posisinya di `docs/work/WIP.md`.

Setiap spec diperiksa terhadap aturan sebelum disetujui:

- [ ] Tidak melanggar WAJ-01 sampai WAJ-12.
- [ ] Setiap layar memenuhi TAM-01 sampai TAM-24.
- [ ] Rancangan data memenuhi PRI-01 sampai PRI-39.
- [ ] Setiap aturan bisnis di spec ada di buku aturan modulnya, dengan nomor.
- [ ] Bagian "Kejadian di lapangan" dan "Jalan keluar" terisi.
- [ ] Tiap layar menyebut ukuran utamanya (HP, PC, atau keduanya), beda
      jabatan dicatat, dan isinya bisa disusun dari komponen baku di
      `docs/work/desain/README.md`; bentuk yang belum ada komponennya disebut
      terang-terangan di spec.
- [ ] Setiap perhitungan uang punya contoh angka yang menjadi tes.

Alat dan server sudah diputuskan 13 Oktober 2026 (SIS-34 s.d. 46).

Hasil: `docs/work/specs/` berisi satu spec per modul, dan `docs/work/plans/`
berisi urutan pengerjaannya (`2026-10-14-urutan-pembangunan.md`).

### Tahap 5. Pembekuan dan serah terima

1. Pemilik membaca ulang dan menyetujui seluruh paket.
2. Paket **dibekukan**. Setelah ini, ide atau perubahan baru tidak mengubah
   paket; dicatat di backlog untuk dikerjakan setelah modul itu tayang.
3. Paket disalin ke project baru: `CLAUDE.md`, `docs/aturan/`, `docs/work/`.

Hasil: project baru yang berisi dokumen lengkap dan belum berisi kode.

### Tahap 6. Pembangunan (di project baru)

1. Pondasi teknis dan pagar mesin (`docs/teknis.md`), sebelum fitur pertama.
2. Modul dibangun satu per satu menurut urutan di Tahap 2.
3. Tiap modul diuji pemilik di tempat uji, lalu diuji banding dengan data
   sistem lama sampai hasilnya cocok (SIS-14, 15). Tidak ada kerja dobel.
4. Pindah resmi satu kali untuk semua modul, pada sebuah tanggal 26
   (SIS-12, 13). "Pindah per modul" dibatalkan pemilik 13 Oktober 2026.

Hasil akhir: v3 dipakai; sistem lama ditutup dan hanya menerima lamaran sampai
Rekrutmen dibangun (SIS-22).

## Kenapa urutannya begini

- **Aturan dulu, baru modul**: supaya setiap dokumen modul ditulis dengan cara
  yang sama.
- **Gali dan putuskan per modul, bukan gali semua dulu**: jawaban pemilik di satu
  modul mengubah cara membaca modul berikutnya.
- **Rancangan lintas modul setelah semua modul digali**: pola bersama baru
  terlihat setelah semua kebutuhan diketahui.
- **Dibekukan sebelum dibangun**: perubahan di tengah pembangunan adalah sumber
  tumpang tindih di sistem lama.
