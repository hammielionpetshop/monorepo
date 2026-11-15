# Plan: Tempat Uji dan Alur Rilis

Tanggal: 13 Oktober 2026
Status: **disetujui 13 Oktober 2026** (B3, B9, B10 sesuai saran; SIS-47)
(spec `../specs/2026-10-13-perlengkapan-bersama-spec.md` bagian 13).

Permintaan pemilik di Tahap 3B: dibuatkan plan tersendiri untuk tempat uji dan
alur rilis (`../backlog/2026-10-11-tempat-uji-per-jabatan.md`).

Dasar: SIS-10, 14, 38 s.d. 44; KAR-52, 63, 78; WAJ-01, 02, 06, 08; PRI-06, 15,
27, 33; TAM-12, 16, 20, 21; `../../teknis.md` (pagar mesin);
`../backlog/2026-10-11-mesin-pengaman-hak-akses.md`.

Plan ini dijalankan di project baru (Tahap 6). Di folder ini tidak ada kode.

## 1. Tujuan

1. Pemilik bisa mencoba setiap perubahan sendiri, sebagai jabatan apa pun,
   **sebelum** karyawan melihatnya.
2. Tidak ada perubahan yang sampai ke karyawan tanpa lulus pemeriksaan mesin
   dan tanpa kata "rilis" dari pemilik (WAJ-01).
3. Apa pun yang dicoba di tempat uji tidak pernah menyentuh data asli.
4. Kalau rilis ternyata salah, ada jalan mundur (WAJ-11).

## 2. Dua tempat, tiga masa

| Masa | Tempat uji | Tempat asli |
|---|---|---|
| **A. Membangun** (sejak awal Tahap 6) | Web di Vercel, data di Supabase baru (SIS-38). Isinya data contoh | **Belum ada.** "Rilis" belum berarti apa-apa bagi karyawan; pemilik menyatakan "modul ini lulus coba" (SIS-10 syarat 2) |
| **B. Menjelang pindah** (SIS-39) | Pindah ke VPS, dengan database sendiri | Dipasang di VPS, database sendiri, cadangan jalan, gladi bersih |
| **C. Setelah hari pindah** | **Tetap ada** di VPS *(B10)*; Vercel dan Supabase masa uji dihapus (SIS-39) | Dipakai karyawan |

Kedua tempat selalu punya database sendiri dan alamat sendiri (SIS-41).
Contoh alamat: `hris.hammielion.com` (asli) dan `uji-hris.hammielion.com`
(uji); namanya ditentukan saat menyiapkan tayang (SIS-40).

## 3. Isi tempat uji

**Dua isi, tidak pernah dicampur:**

| Isi | Dipakai untuk | Siapa boleh masuk |
|---|---|---|
| **Data contoh** (bawaan) | Mencoba layar dan alur, mesin pengaman, mengukur kecepatan | Pemilik, GM, dan tamu uji *(B3)* |
| **Salinan uji banding** (SIS-14) | Membandingkan hitungan v3 dengan sistem lama | **Hanya Pemilik dan GM** (SIS-41); akun tamu mati selama isi ini terpasang |

Berganti isi berarti mengisi ulang seluruh tempat uji. Uji pulih cadangan
bulanan (SIS-42) **tidak** menimpa tempat uji: cadangan dipulihkan ke database
sementara, diperiksa mesin, lalu dihapus, supaya data asli tidak pernah
tinggal di tempat uji.

**Data contoh:**

1. Perusahaan contoh dengan cabang, jabatan, dan orang bernama jelas-jelas
   contoh ("Toko Contoh 1", "Contoh Kasir A"). Tidak ada nama, nomor HP,
   rekening, atau gaji orang sungguhan.
2. **Akun contoh:** tiap jabatan paling sedikit dua akun di dua cabang berbeda
   (supaya "data cabang lain" bisa diuji), ditambah akun khusus untuk keadaan
   tertentu: pendaftar belum disetujui, orang nonaktif, orang Training,
   pekerja lepas, orang berjabatan tambahan, orang dengan hak tambahan.
3. **Banyaknya setara dua tahun pemakaian** (PRI-15): absen, trip, nota, slip,
   Buku Kas, pengajuan.
4. Dibuat oleh **satu perintah yang bisa diulang** dan hasilnya selalu sama,
   dengan tanggal dihitung mundur dari hari perintah dijalankan (supaya selalu
   ada "periode berjalan").
5. **Tiap modul menambah bagiannya**: akun, data, dan tes alurnya, pada
   pekerjaan yang sama dengan modulnya. Modul belum dianggap selesai kalau
   data contohnya belum ada.

## 4. Alat di tempat uji

Rincian layarnya di spec bagian 3 (BER-L50, L51).

| Alat | Gunanya |
|---|---|
| Bilah "TEMPAT UJI" yang selalu tampil; ikon dan warna aplikasi berbeda | Tidak tertukar dengan sistem asli |
| Ganti akun contoh, berlaku per jendela browser | Melihat dan **bertindak** sebagai jabatan apa pun; beberapa jabatan berdampingan untuk mengikuti satu alur |
| Daftar "Yang perlu dicoba" | Kejadian di lapangan dari spec menjadi daftar periksa pemilik (PRI-06) |
| Jam uji *(B9)* | Memajukan tanggal supaya hal yang menunggu waktu bisa dicoba hari ini (tutup slip tanggal 26, pengajuan lewat 2 hari, hak tambahan berakhir) |
| Kembalikan data contoh *(B9)* | Mulai lagi dari keadaan awal |
| Versi dan daftar "belum dirilis" | Tahu apa yang berbeda dari sistem asli |

Tempat uji tidak mengirim email atau notifikasi ke orang sungguhan, dan tidak
tersambung ke sistem kasir asli; data kasir di tempat uji adalah data contoh.

## 5. Alur rilis (masa C; masa A dan B memakai langkah 1 s.d. 5)

| Langkah | Yang terjadi | Oleh | Buktinya |
|---|---|---|---|
| 1. Kerjakan | Satu pekerjaan, satu branch; klaim ditulis (KER-01, 03) | Claude | Baris di `claims.md` |
| 2. Pemeriksaan mesin | Semua pagar mesin di `teknis.md` jalan: tes aturan, tes skenario, tes jalan keluar, mesin pengaman hak akses, pemeriksaan lebar handphone, ukuran kecepatan, database terbangun dari migrasi, ada entri changelog | Mesin | Semua hijau; satu saja merah = berhenti di sini |
| 3. Tayang di tempat uji | Otomatis setelah langkah 2 lulus. Perubahan database dijalankan di database tempat uji | Mesin | Versi di Papan uji berubah |
| 4. Serah ke pemilik | Claude mengetik di percakapan: apa yang berubah, daftar yang perlu dicoba sebagai jabatan apa, dan catatan "Apa yang baru" untuk karyawan *(B10)* | Claude | Daftar di Papan uji |
| 5. Pemilik mencoba | Di tempat uji, dari handphone sungguhan untuk layar lapangan. Tiap baris ditandai Sesuai atau Belum sesuai | Pemilik | Daftar periksa terisi. Ada "Belum sesuai" = kembali ke langkah 1 |
| 6. "Rilis" | Pemilik mengetik **rilis** untuk perubahan itu. Izin berlaku untuk satu perubahan itu saja (WAJ-01) | Pemilik | Tercatat di percakapan dan di catatan rilis |
| 7. Cadangan | Database asli dicadangkan tepat sebelum rilis | Mesin | Tercatat di Kesehatan Mesin |
| 8. Naik ke sistem asli | Branch digabung ke main; perubahan database dijalankan di database asli; web asli berganti versi | Mesin | Nomor versi di kaki menu naik (TAM-20) |
| 9. Periksa setelah rilis | Mesin membuka halaman utama tiap jabatan di sistem asli (hanya membuka, tidak mengisi) dan memeriksa Kesehatan Mesin | Mesin, lalu Claude melapor | Laporan singkat di percakapan |
| 10. Catat | Changelog, WIP, buku aturan (WAJ-08); "Apa yang baru" dan tanda "Baru" tampil 7 hari (TAM-21) | Claude | Tiga tempat status diperbarui |

Statusnya setelah langkah 10 adalah **selesai**, karena pemilik sudah mencoba
di langkah 5. Kalau pemilik memilih merilis tanpa mencoba, statusnya "tayang,
menunggu uji coba pemilik" (WAJ-08).

**Kapan rilis** *(B10)*: di luar jam ramai, bawaannya malam setelah toko tutup
atau pagi sebelum buka. Perbaikan mendesak boleh kapan saja atas perintah
pemilik.

**Karyawan yang sedang membuka aplikasi saat rilis:** isiannya tidak hilang
(TAM-16). Muncul pemberitahuan "Ada versi baru"; versi baru dimuat saat ia
pindah layar, tidak di tengah isian.

**Nomor versi:** `v3.<fitur>.<perbaikan>`. Rilis yang menambah atau mengubah
fitur menaikkan angka tengah; perbaikan menaikkan angka akhir.

## 6. Perubahan database

1. Hanya lewat file migrasi bernomor di repo (WAJ-02); tidak ada yang mengubah
   database dengan tangan, di tempat uji maupun asli.
2. Setiap migrasi jalan di tempat uji lebih dulu (langkah 3), dengan data
   contoh sebanyak dua tahun, sehingga migrasi yang lambat ketahuan di sana.
3. **Migrasi hanya menambah.** Kolom atau tabel lama tidak dibuang pada rilis
   yang sama; dibuang di rilis tersendiri setelah versi baru terbukti jalan.
   Gunanya supaya jalan mundur (bagian 7) selalu mungkin.
4. Hanya satu pekerjaan yang mengubah database pada satu waktu (KER-05).

## 7. Jalan mundur

| Keadaan | Yang dilakukan |
|---|---|
| Rilis membuat layar rusak atau hitungan salah | **Kembali ke versi sebelumnya** (web saja). Karena migrasi hanya menambah, versi lama tetap jalan di database yang baru. Data yang sudah diisi karyawan tidak hilang |
| Data sudah terlanjur salah karena hitungan salah | Tidak dihapus; dibetulkan lewat jalan resmi modulnya (batalkan, koreksi periode berikutnya; PRI-02, 04), dan dicatat di changelog |
| Database rusak | Pulihkan dari cadangan langkah 7. Ini jalan terakhir, karena isian sesudah cadangan hilang; diputuskan pemilik |

Kembali ke versi sebelumnya juga butuh kata dari pemilik, kecuali sistem asli
tidak bisa dibuka sama sekali; saat itu Claude mengembalikan dulu lalu melapor.

## 8. Mesin pengaman di tempat uji

Dijalankan pada langkah 2, terhadap database sekali pakai berisi data contoh
(bukan database tempat uji yang sedang dipakai pemilik, supaya percobaannya
tidak mengotori).

1. **Hak akses** (KAR-63): masuk sebagai akun contoh tiap jabatan, mencoba
   setiap tindakan bernama pada data milik sendiri, milik orang di cabangnya,
   dan milik orang di cabang lain; hasilnya dibandingkan dengan daftar hak dan
   batas keras. Ditambah percobaan tetap dan bagian 12 tiap spec.
2. **Kelengkapan daftar:** tiap pintu punya nama tindakan; tiap layar punya
   tempat di menu; tiap mesin otomatis, pengaturan, jenis pengajuan, dan jenis
   tanda terdaftar; tiap pengaturan punya layar (PRI-32).
3. **Tes aturan, skenario, dan jalan keluar** (WAJ-06).
4. **Mesin otomatis** (PRI-33): tiap mesin dijalankan dua kali, hasilnya tidak
   dobel; kegagalan memunculkan tanda.

Hasil terakhirnya tampil di Kesehatan Mesin.

## 9. Urutan membangun

Semuanya dikerjakan di awal Tahap 6, sebelum modul pertama, karena semua modul
bergantung padanya. Urutan pastinya ada di `2026-10-14-urutan-pembangunan.md` (langkah P).

| No | Langkah | Dibuktikan dengan |
|---|---|---|
| 1 | Repo baru tertutup, main terkunci, pagar mesin dasar (tes, tipe, migrasi, changelog) | Push langsung ke main ditolak; perubahan tanpa entri changelog ditolak |
| 2 | Tempat uji masa A: project Vercel dan Supabase baru, alamat uji, bilah "TEMPAT UJI" | Dibuka dari handphone pemilik; bilah tampil |
| 3 | Tayang otomatis ke tempat uji setelah pemeriksaan lulus | Satu perubahan kecil tampil sendiri di tempat uji |
| 4 | Komponen baku tampilan (`../desain/README.md`) | Halaman contoh komponen di tempat uji, terang dan gelap, 360 px dan PC |
| 5 | Kerangka data contoh dan akun contoh (bersama modul Karyawan dan Akses) | Perintah isi ulang dijalankan dua kali, hasil sama |
| 6 | Ganti akun contoh per jendela, Kembalikan data contoh | Dua jabatan dibuka berdampingan dan satu alur diikuti |
| 7 | Mesin pengaman hak akses dan kelengkapan daftar | Satu pintu sengaja dibuka terlalu lebar: mesin menolak perubahan itu |
| 8 | Jam uji | Dimajukan ke tanggal 26: mesin harian yang dilompati jalan berurutan, tidak dobel |
| 9 | Daftar "Yang perlu dicoba" dan catatan rilis ("Apa yang baru", tanda "Baru") | Daftar terisi dari spec; tanda "Baru" hilang setelah 7 hari jam uji |
| 10 | Ukuran kecepatan dan pemeriksaan lebar handphone masuk pagar mesin | Halaman yang sengaja dilambatkan ditolak |
| 11 | Masa B: tempat asli dan tempat uji di VPS, cadangan, uji pulih, kembali ke versi sebelumnya | Urutan SIS-39; sekali latihan "kembali ke versi sebelumnya" dan sekali pulih dari cadangan sebelum hari pindah |
| 12 | Uji banding (SIS-14): mengisi tempat uji dengan salinan satu periode sistem lama | Akun tamu mati; hanya Pemilik dan GM bisa masuk; daftar beda terisi |

## 10. Siapa berbuat apa

| Peran | Yang dikerjakan |
|---|---|
| Pemilik (GM) | Mencoba di tempat uji; mengetik "rilis"; memutuskan jalan mundur; mengundang tamu uji |
| Owner | Boleh masuk tempat uji dan mencoba; setara GM (KAR-67) |
| Claude | Mengerjakan, menyerahkan daftar yang perlu dicoba, menggabung setelah "rilis", melapor setelah rilis, mencatat |
| Mesin | Pemeriksaan, tayang ke tempat uji, cadangan, naik ke asli, periksa setelah rilis |
| Tamu uji *(B3)* | Mencoba layar jabatannya di handphone sendiri, di tempat uji saja |

## 11. Ditentukan saat menyiapkan tayang

Tidak ditanyakan sekarang: nama alamat tempat uji, ukuran VPS (harus memuat
dua database), jam rilis yang pasti, dan periode yang dipakai uji banding.
