# Teknis

Alat yang dipakai, pagar mesin, dan pola baku kode.
Keputusannya ada di `aturan/00-gambaran-sistem.md` bab 9 (SIS-34 s.d. 46);
file ini memuat rincian teknisnya. Bagian yang butuh kode masih kosong karena
belum ada kode.

## Alat dan server

Ditetapkan 13 Oktober 2026.

| Hal | Yang dipakai | Aturan |
|---|---|---|
| Kerangka web | Next.js + TypeScript (versi stabil terbaru saat project baru dibuat, lalu dikunci) | SIS-34 |
| Database | PostgreSQL | SIS-34 |
| Tempat masa membangun dan menguji | Data: Supabase baru milik pemilik. Web: satu project Vercel baru | SIS-38 |
| Tempat asli | VPS sewaan: web, PostgreSQL, penyimpanan foto, dan mesin terjadwal di sana | SIS-38, 39 |
| Kode | GitHub, repo baru tertutup | SIS-44 |
| Alamat | Satu nama di bawah domain perusahaan, https | SIS-40 |
| Bentuk di handphone | Web yang bisa dipasang (PWA); notifikasi dinyalakan belakangan | SIS-45 |

### Susunan kode (pegangan untuk Tahap 6)

- **Satu pintu ke database.** Peramban tidak pernah memegang kunci database dan
  tidak pernah memanggil database langsung. Semua baca dan tulis lewat fungsi
  server. Selama di Supabase, yang dipakai hanya PostgreSQL-nya lewat server;
  akses langsung dari peramban dimatikan (SIS-36).
- **Sambungan database terenkripsi dan terverifikasi (verify-full).** Database
  jarak jauh (Supabase/VPS) disambung dengan SSL yang memeriksa sertifikat
  server terhadap CA di `db/supabase-ca.crt` (sertifikat publik Supabase, bukan
  rahasia); **tidak** memakai `sslmode=no-verify`. Database lokal (Docker, CI)
  tanpa SSL. Aturannya terpusat di `scripts/koneksi.mts` (dipakai migrasi &
  benih; dipakai juga oleh server saat dibangun).
- **Satu tempat rumus.** Rumus tiap modul ada di satu folder rumus modul itu,
  berupa fungsi murni (masukan → hasil, tanpa membaca layar atau database
  sendiri), dan tiap fungsi punya tes yang merujuk nomor aturannya (SIS-35,
  WAJ-04, WAJ-06). Tidak ada trigger atau fungsi database yang menghitung.
- **Database menjaga, tidak menghitung:** kunci unik, tautan induk, larangan
  nominal minus, larangan hapus untuk data uang dan kehadiran (PRI-02).
- **Satu daftar hak.** Tiap fungsi server memeriksa hak lewat satu pemeriksa
  yang membaca daftar hak dari data (SIS-36, PRI-31).
- **Tiga pintu yang bisa diganti** (SIS-37): login, penyimpanan foto, mesin
  terjadwal. Kode modul hanya memanggil pintunya, tidak pernah memanggil
  layanan penyedianya langsung.
- **Tiap baris mencatat perusahaannya** sejak tabel pertama (PRI-31).

### Pindah dari masa uji ke VPS (SIS-39)

Urutannya: sewa dan pasang VPS → arahkan alamat → cadangan jalan dan sekali
dicoba pulih → gladi bersih → daftar ulang akun → hari pindah. Langkah
pemasangan VPS ditulis di sini saat dikerjakan bersama pemilik; penyedia dan
ukuran VPS ditentukan saat itu.

### Alamat web (SIS-40)

Tidak perlu membeli domain baru: cukup menambah satu nama (contoh `hris`) di
panel pengelola domain `hammielion.com`. Selama masa uji nama itu diarahkan ke
Vercel; saat pindah, arahnya diganti ke VPS. Alamat yang dilihat karyawan
tidak berubah.

Hasil cek 13 Oktober 2026 (dibaca dari catatan publik, tidak ada yang diubah):
pengatur arah domain `hammielion.com` adalah **Biznet Gio** (`satu.neodns.id`,
`dua.neodns.id`). Jadi baris untuk `hris` ditambah di portal Biznet Gio, menu
pengaturan DNS domain itu, oleh pemegang akunnya.

### Cadangan (SIS-42)

Salinan seluruh database tiap malam ke tempat di luar server, disimpan 30 hari,
foto ikut. Uji pulih sebulan sekali ke tempat uji. Keduanya mesin otomatis yang
punya penjaga (PRI-33) dan tampil di Kesehatan Mesin.

### Yang diisi setelah ada kode

Versi alat, struktur folder, pola baku halaman beserta contoh kodenya, bentuk
baku jawaban error dari server (selalu dengan pesan Bahasa Indonesia, pasangan
TAM-03 dan TAM-04), perintah penting, dan cara tayang ke karyawan (apa yang
terjadi saat main berubah).

Yang sudah pasti dari prinsip rancangan:

- Nominal rupiah disimpan sebagai bilangan bulat (PRI-28).
- Semua jam dari server, zona waktu WIB (PRI-01).
- Cadangan database otomatis yang teruji sebelum ada data asli (PRI-27).

### Pola baku yang sudah ada (diisi sejak 1-b-i, 14 Oktober 2026)

- **Satu pintu database:** `src/server/db.ts` memegang kolam `pg.Pool` tunggal.
  Semua baca/tulis server lewat `kueri(teks, nilai)` dengan parameter (`$1, $2`),
  jangan menyambung teks (aman dari suntikan SQL). Aturan sambungan aman ada di
  `src/lib/koneksi.ts` (satu tempat, WAJ-04; dipakai juga alat migrasi & benih).
- **Penyandian kata sandi/kode:** `src/lib/sandi.ts` — `sandiBaru`/`cocokSandi`
  (scrypt bawaan Node, tanpa pustaka native). Yang disimpan hanya bentuk tersandi.
- **Sesi:** logika murni di `src/lib/sesi.ts` (token, hash, cookie, kedaluwarsa),
  penyambung cookie+DB di `src/server/pintu/sesi.ts`. Peramban memegang token
  acak; database menyimpan hash-nya saja.
- **Tampilan:** semua layar disusun dari kit komponen baku `src/komponen/` (impor
  `@/komponen`); warna/huruf/sudut dari token di `src/app/globals.css`, tidak
  diketik ulang di halaman (desain/README, TAM-11).
- **Logika yang bisa salah diuji:** rumus & aturan ditaruh sebagai fungsi murni
  di `src/lib/` dengan tes `*.test.ts` (WAJ-06), bukan di dalam komponen/kueri.

Masih menyusul (saat layar pertama dibangun, 1-b-ii): bentuk baku jawaban error
dari server (pasangan TAM-03/04), pola baku halaman + server action, dan cara
tayang ke karyawan.

Kalau sebuah modul punya aturan teknis khusus, tulis di `CLAUDE.md` kecil di dalam
folder modul itu.

## Pagar mesin

Aturan tertulis bisa terlupa; pengecekan otomatis tidak. Di project baru, hal
berikut harus dicek otomatis pada setiap push, dan push ke main ditolak kalau ada
yang gagal:

| Yang dicek | Menjaga aturan |
|---|---|
| Semua tes lulus | WAJ-06, WAJ-07 |
| Pemeriksaan tipe dan gaya kode lulus | mutu kode |
| Database bisa dibangun dari file migrasi, dan nomor migrasi tidak kembar | WAJ-02 |
| Ada entri changelog untuk perubahan itu | WAJ-08 |
| Main tidak bisa di-push langsung, hanya lewat penggabungan branch | WAJ-01 |
| Tiap halaman diperiksa di lebar layar handphone | TAM-12 |
| Kecepatan tiap halaman diukur terhadap sasaran | PRI-10 s.d. PRI-15 |
| Tidak ada kode layar yang memanggil database langsung | SIS-36 |
| Tidak ada trigger atau fungsi database yang berisi rumus | SIS-35 |

Status sekarang (14 Oktober 2026, Pondasi bagian 1 utuh):

| Yang dicek | Terpasang? |
|---|---|
| Semua tes lulus | Ya — `npm run cek` (Vitest) di komputer dan di CI |
| Pemeriksaan tipe dan gaya kode lulus | Ya — `tsc`, ESLint, Prettier di `npm run cek` dan CI |
| Database bisa dibangun dari migrasi, nomor tidak kembar | Ya — `scripts/migrasi.mts` + `cek-migrasi.mts`; CI membangun DB di PostgreSQL sementara |
| Ada entri changelog untuk perubahan itu | Ya — `scripts/cek-changelog.mts` di CI (tiap PR) |
| Main tidak bisa di-push langsung | Sebagian — pagar lokal `.githooks/pre-push` (WAJ-01); kunci server-side belum (GitHub gratis, lihat WIP) |
| Tiap halaman diperiksa di lebar handphone (TAM-12) | Belum — dipasang di Pondasi bagian 10 |
| Kecepatan tiap halaman diukur (PRI-10 s.d. 15) | Belum — Pondasi bagian 10 |
| Tidak ada kode layar memanggil database langsung (SIS-36) | Sebagian — satu pintu `src/server/db.ts` ada sejak 1-b-i; pagar otomatis (larangan impor dari kode klien) dipasang bersama layar pertama (1-b-ii) |
| Tidak ada trigger/fungsi database berisi rumus (SIS-35) | Ya — migrasi tabel pertama (`0001`) hanya memakai kunci unik, tautan induk, dan CHECK; tanpa trigger/fungsi |

Kerangka migrasi berupa berkas `.sql` polos bernomor di `db/migrasi/` (portabel
Supabase→VPS, SIS-37); aturan nama/urutan ada di `src/lib/migrasi.ts` (+ tes) dan
penjalannya di `scripts/migrasi.mts`. CI ada di `.github/workflows/ci.yml`.
