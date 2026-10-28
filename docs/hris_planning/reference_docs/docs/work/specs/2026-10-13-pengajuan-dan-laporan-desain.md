# Pola Bersama 2: Pengajuan dan Laporan (Tahap 3E)

Tanggal: 13 Oktober 2026
Status: **ditetapkan 13 Oktober 2026.** F1–F7 dijawab pemilik di percakapan
13 Oktober 2026, semuanya sesuai saran (bagian 5). Hasilnya: PRI-37, 38;
TAM-23, 24; KAR-79; GAJ-60.

Bahan: PRI-07, 09, 23, 26, 33, 35, 36; TAM-01 s.d. 06, 22; KAR-57, 62, 66,
73, 75, 77; KEH-36 s.d. 42, 60 s.d. 69, 80; GAJ-42 s.d. 44; DRV-82; KEU-118;
KIN-48; buku Karyawan bagian 6 butir 5; `00-peta-modul.md` (Hak lihat
pengajuan); `2026-10-13-peta-data-desain.md` (P1, P2);
`2026-10-13-menu-desain.md` (Persetujuan, Pengajuan Saya, Beranda).

Gunanya: satu cara kerja untuk semua pengajuan, satu cara mencatat dan
melaporkan error, dan satu Daftar Pengecualian, supaya tiap modul tidak
membuat versinya sendiri (WAJ-04).

## 1. Mesin Pengajuan (PRI-23)

### Rancangan (tanpa keputusan baru)

1. **Satu catatan per pengajuan**, milik Perlengkapan Bersama (P1): jenis,
   pengaju, untuk siapa (HR boleh mengisi atas nama karyawan, misalnya
   kasbon), tanggal diajukan (jam server, PRI-01), status, penyetuju,
   alasan, lampiran, dan riwayat setiap perubahan status (siapa, kapan,
   alasan). Isi khas tiap jenis (tanggal izin, jam lembur, nominal kasbon)
   dan akibatnya setelah disetujui milik modul jenisnya.
2. **Daftar status yang sama untuk semua jenis:**
   Menunggu → (Diperiksa, hanya untuk jenis yang punya pemeriksa, misalnya
   kasbon: finance memeriksa, pemilik memutuskan) → Disetujui atau Ditolak.
   Ditambah: **Dibatalkan** (ditarik pengaju sebelum diputuskan, atau
   pembatalan yang disahkan, KEH-39, 40), **Dicabut** (persetujuan ditarik
   penyetuju dengan alasan, KEH-40, 68), dan **Hangus** (lewat batas waktu,
   PRI-09). Tidak ada yang dihapus (PRI-02).
3. **Tiap jenis mendaftarkan dirinya** sebagai data, bukan kode: penyetuju,
   pemeriksa (kalau ada), pelihat tambahan (misalnya Kepala Toko untuk
   tanggal dan status, KEH-80), batas waktu dan akibatnya, lampiran wajib
   atau tidak, dan lampiran tertutup atau tidak. Isinya mengikuti tabel
   "Hak lihat pengajuan" di `00-peta-modul.md`.
4. **Satu penyetuju cukup.** Kalau penyetujunya "HR dan pemilik", siapa pun
   yang lebih dulu memutuskan, keputusannya berlaku; yang lain melihat siapa
   yang memutuskan.
5. **Tidak menyetujui pengajuan sendiri.** Kalau pengaju termasuk
   penyetujunya, pengajuan itu hanya bisa diputuskan penyetuju lain; kalau
   tidak ada, naik ke Pemilik atau GM.
6. **Menolak selalu wajib alasan** (KEH-38), dan alasan itu tampil ke
   pengaju dalam bahasa sederhana.
7. **Satu kotak Persetujuan** di kantor dan **satu Pengajuan Saya** untuk
   karyawan (3C). Angka penanda dibaca dari pengajuan yang menunggu
   keputusan atau pemeriksaan orang itu.
8. **Tes per jenis** (PRI-23, WAJ-06): tiap jenis diuji siapa boleh
   mengajukan, melihat, memeriksa, dan memutuskan, termasuk percobaan
   menyetujui milik sendiri.

### Pertanyaan

- **F1.** Pedoman lapor dan persetujuan (buku Karyawan bagian 6 butir 5).
- **F2.** Pengajuan yang lama tidak diputuskan.
- **F3.** Penyetuju keberatan slip.
- **F4.** Pengajuan yang kurang lengkap: dikembalikan atau ditolak.

## 2. Riwayat error (TAM-05)

### Rancangan (tanpa keputusan baru)

1. Satu tempat penyimpanan, milik Perlengkapan Bersama; isinya sesuai
   TAM-05. Dicatat saat error muncul, dilengkapi saat "OK, paham" ditekan.
2. Dibuka dari menu Sistem → Riwayat Error (3C), dengan ringkasan error
   tersering dan halaman tersering.

### Pertanyaan

- **F5.** Siapa melihat, mana yang masuk "perlu perhatian", dan berapa lama
  disimpan.

## 3. Daftar Pengecualian (PRI-26)

### Rancangan (tanpa keputusan baru)

1. Milik Karyawan (P2). Isinya: siapa, aturan mana, nilai pengganti,
   berlaku dari dan sampai, alasan, penyetuju (PRI-26).
2. Diisi HR atau Admin HR, disetujui Pemilik atau GM (KAR-73).
3. Pengecualian hanya untuk aturan yang ditandai "boleh dikecualikan" di
   daftar pengaturan; aturan lain tidak bisa dipilih.

### Pertanyaan

- **F6.** Peninjauan berkala pengecualian.

## 4. Perlu perhatian dan pengingat berantai

### Pertanyaan

- **F7.** Pegangan untuk memilah: masuk antrean berantai (TAM-22) atau cukup
  di Beranda dan angka penanda.

## 5. Jawaban pemilik

Pertanyaan dan saran yang diajukan di percakapan (13 Oktober 2026):

- F1: pedoman hanya untuk dibaca; layar pengajuan menampilkan satu baris
  pedoman yang cocok. Tidak ada tahap persetujuan Kepala Toko.
- F2: tidak pernah setuju otomatis; pengingat berantai ke penyetuju sekali
  sehari; lewat 2 hari ikut di "perlu perhatian" Pemilik dan GM.
- F3: keberatan slip diputuskan HR (saat ini GM) atau Pemilik, bukan Admin
  HR; slip GM diputuskan Pemilik.
- F4: tidak ada status "dikembalikan"; tolak dengan alasan, lalu "Ajukan
  ulang" dengan isian lama.
- F5: riwayat error dilihat Pemilik dan GM; salah isi hanya disimpan; error
  tanpa sebab dan error sama pada 3 orang atau lebih sehari masuk "perlu
  perhatian" GM; disimpan 12 bulan.
- F6: pengecualian tanpa tanggal akhir ditinjau tiap 3 bulan (Masih perlu /
  Hentikan); yang bertanggal akhir diingatkan H-7.
- F7: masuk antrean berantai hanya kalau uang atau hak bisa hilang, ada
  orang yang menunggu keputusan, atau berupa pengumuman.

Jawaban pemilik (13 Oktober 2026): **F1–F7 sesuai saran.**

## 6. Dicatat ke

| Keputusan | Aturan |
|---|---|
| Rancangan bagian 1, F2, F4 | PRI-37 (pelapis PRI-23) |
| F1 | KAR-79 (pelapis KAR-57); buku Karyawan bagian 6 butir 5 ditutup |
| F3 | GAJ-60 (pelapis GAJ-42); tabel Hak lihat pengajuan di `00-peta-modul.md` |
| F5 | TAM-23 (pelapis TAM-05) |
| F6 | PRI-38 (pelapis PRI-26) |
| F7 | TAM-24 (pelapis TAM-22 butir 5) |

Juga diperbarui: `00-kamus-istilah.md` (status pengajuan, Ajukan ulang),
`00-peta-modul.md` (baris Perlengkapan Bersama dan Mesin Pengajuan), jumlah
aturan di `CLAUDE.md`, `../../aturan/README.md`, dan brief Claude Design menu.

Titipan untuk Tahap 4: daftar jenis pengajuan lengkap dengan batas waktu dan
akibatnya (PRI-37 butir 2); baris pedoman per jenis di Pengajuan Saya
(KAR-79), isinya mengikuti pedoman lapor yang disusun pemilik; daftar aturan
"boleh dikecualikan" (PRI-38 butir 3) disusun bersama menu Pengaturan.
