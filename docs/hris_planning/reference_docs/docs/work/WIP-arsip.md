# Arsip Status Pekerjaan (riwayat lengkap sampai 19 Oktober 2026)

Berkas ini menyimpan **riwayat lengkap per sesi** yang dulu ada di `WIP.md`, supaya
`WIP.md` bisa ramping (hemat token dibaca tiap sesi). Status terbaru & langkah
berikutnya ADA DI `WIP.md`, bukan di sini. Berkas ini hanya untuk menelusuri detail
cara sebuah bagian dikerjakan. Arsipkan ke sini saat WIP.md mulai gemuk lagi.

---

Diperbarui: 19 Oktober 2026 (**paket BEKU**; Tahap 6 — Pondasi utuh; **Langkah 1 jalan**: **1-a** s.d. **1-i SELESAI** (lihat tabel); **1-j dipecah 2 sesi**: **1-j-i SELESAI** (Pengamatan Sistem) + **1-j-ii dipecah 2 sub-sesi**: **1-j-ii-a SELESAI** (infra mesin terjadwal + penerbit pengumuman + akhiri darurat + tombol "Jalankan sekarang"), **1-j-ii-b dipecah 2 sub-sub-sesi**: **1-j-ii-b1 SELESAI** (4 mesin terjadwal sisanya + pemasangan `tambahJejak()` ke 5 pintu tulis lama) + **1-j-ii-b2 dipecah 2 sub-sub-sub-sesi**: **1-j-ii-b2-i SELESAI** (kerangka Pengaturan 4B BER-L40/L41 + 18 pengaturan BER & Umum) + **1-j-ii-b2-ii dipecah 2 sesi (18 Okt 2026)**: **1-j-ii-b2-ii-a SELESAI** (layar BER-L42 Jenis Pengajuan: ubah penyetuju/pemeriksa/pelihat); **1-j-ii-b2-ii-b dipecah 2 sub-sesi (18 Okt 2026)**: **1-j-ii-b2-ii-b1 SELESAI** (batas waktu per jenis bisa diubah bertanggal + mesin pemindah otomatis + layar); **1-j-ii-b2-ii-b2 SELESAI (19 Okt 2026)** (integrasi BER-L23 Papan Perubahan Aturan: langkah Pengumuman menyala + pre-fill + pengumuman_lahir dua arah + tarik saling membatalkan). **Dengan ini seluruh 1-j SELESAI secara kode. Sisa 1-j (b2-ii-a + b2-ii-b1 + b2-ii-b2) **sudah di-push & digabung ke `main` lewat PR #16** (19 Okt 2026, merge commit `66a44b5`). **Dengan ini seluruh 1-j SELESAI dan sudah di `main`.** **1-k (Alat tempat uji) dipecah 4 sesi, disetujui pemilik 19 Okt 2026**, bagian terakhir Langkah 1. **1-k-i SELESAI (19 Okt 2026)** (Ganti akun contoh BER-L51 + bilah TEMPAT UJI lengkap + pagar lingkungan `tempatUjiAktif`; CHANGELOG 248). **1-k-ii dipecah 2 sub-sesi (disetujui pemilik 19 Okt 2026): 1-k-ii-a SELESAI (19 Okt 2026)** (Papan uji: Kembalikan data contoh + Versi + rumus benih dipindah ke `src/server/benih-inti.ts`, WAJ-04; CHANGELOG 249); **1-k-ii-b SELESAI (19 Okt 2026)** ("Yang perlu dicoba": daftar periksa 79 kejadian kedua spec Langkah 1, dikelompokkan, ditandai Sesuai/Belum sesuai + catatan; tabel baru `daftar_periksa_uji` migrasi 0018; CHANGELOG 250). **Dengan ini seluruh 1-k-ii SELESAI.** **1-k-iii SELESAI (19 Okt 2026)** (Jam uji: jam server terpusat `src/server/jam.ts` + tabel `jam_uji` migrasi 0019 + mesin terjadwal & tanda "Baru" ikut jam uji + majukan menjalankan mesin terlewati + bilah "jam uji: …" + pemilih hanya-maju + "Kembali ke jam sekarang"; pilihan "ringkas" disetujui pemilik; CHANGELOG 251). **1-k-iv SELESAI (19 Okt 2026)** (Tamu uji: akun tamu berjangka 7 hari dibuat Pemilik/GM, email+sandi dibuatkan otomatis ditampilkan sekali, tamu = pengunjung tanpa jabatan; berakhir sendiri = login ditolak lewat masa; mesin Pembersih diperluas membuang tamu kedaluwarsa; cabut lebih awal; tabel baru `akun_tamu_uji` migrasi 0020; CHANGELOG 252). **Dengan ini seluruh 1-k SELESAI dan Langkah 1 (1-a s.d. 1-k) UTUH secara kode.** **Sudah di-push & digabung ke `main` lewat PR #17** (19 Okt 2026, cabang `alat-tempat-uji-1k`, satu PR berisi seluruh 1-k, merge commit `b74ab52`; CI gate hijau: Pagar mutu + Database dari migrasi + Cek CHANGELOG; `npm run cek` 234 tes + build lulus). Vercel Preview merah = akun GitHub commit belum tertaut (tidak menghalangi, seperti PR sebelumnya). **Langkah manual Supabase tempat uji SUDAH DIJALANKAN (19 Okt 2026):** migrasi 0017 + 0018 + 0019 + 0020 terpasang (0017 dari PR #16 ikut nyangkut sekarang) + benih mengisi 79 baris daftar periksa & mendaftarkan mesin ke-8 `terapkan_batas_jenis_terjadwal` (8 mesin total). Skrip `migrasi`/`benih` kini memuat `.env.local` sendiri lewat `--env-file-if-exists` (CHANGELOG 253, diperbaiki sesudah beku; WAJ-10 beres) — jadi cukup `npm run migrasi` / `BENIH_TEMPAT_UJI=ya npm run benih`. Tabel jam_uji & akun_tamu_uji sengaja kosong. **BERIKUTNYA: Langkah 2 = modul Kehadiran (4D) — mulai bahas/rancang.** CATATAN: 1-d…1-i **sudah di-push & digabung ke `main`** (PR #13 untuk 1-d…1-g, 15 Okt 2026; **PR #14** untuk 1-h + 1-i, 15 Okt 2026); **1-j-i + 1-j-ii-a + 1-j-ii-b1 + 1-j-ii-b2-i sudah digabung ke `main` lewat PR #15** (16 Okt 2026, merge commit `08dffb3`); **1-j-ii-b2-ii-a + 1-j-ii-b2-ii-b1 + 1-j-ii-b2-ii-b2 sudah digabung ke `main` lewat PR #16** (19 Okt 2026, merge `66a44b5`; satu cabang, satu PR seluruh sisa 1-j). Migrasi 0005–0013 + benih **sudah terpasang di Supabase tempat uji**; **0014 + 0015 + 0016 + 0017 + benih mesin/tanda/pengaturan = langkah manual pemilik ke Supabase (sesudah PR #16: terapkan 0017 + `BENIH_TEMPAT_UJI=ya npm run benih` untuk mesin ke-8 `terapkan_batas_jenis_terjadwal`; 0014–0016 + benih sebelumnya langkah pasca-PR #15)**. 1-j-ii-b2-ii-a tanpa migrasi/benih baru; 1-j-ii-b2-ii-b1 menambah migrasi 0017 + mesin ke-8 di benih.)

## Lokasi project

**`D:\Applikasi NaurArkhAzzam\Hris v3\`** (repo privat GitHub `Naurakhazzam/hris-v3`).
Project berupa repo kode (sejak 14 Oktober 2026) — dokumen di `docs/`, kode di `src/`,
migrasi di `db/migrasi/`. (Catatan lama "rumah pindah ke `D:\HRIS Hammielion\hris-app-v3\`"
tidak terjadi; sudah dibetulkan 15 Okt 2026 di sesi 1-j-i.)

## Posisi di peta jalan

| Tahap | Posisi |
|---|---|
| 0 sampai 4 | Selesai (aturan, 7 modul, rancangan lintas modul, 16 spec, 400 layar) |
| 5 | Selesai seluruhnya (5A–5D) |
| 6 | **Sedang jalan.** Langkah **P (Pondasi) utuh** (bagian 1A/1B-i/1B-ii + bagian 2: tempat uji masa A — Supabase + Vercel + bilah "TEMPAT UJI"). **Langkah 1 (Karyawan + Perlengkapan Bersama) jalan**: dipecah 11 bagian 1-a s.d. 1-k; **1-a s.d. 1-i SELESAI** (lihat tabel di bawah); **1-j SELESAI & digabung ke `main` lewat PR #16** (19 Okt 2026): 1-j-i + 1-j-ii-a + 1-j-ii-b1 + 1-j-ii-b2-i + 1-j-ii-b2-ii-a + 1-j-ii-b2-ii-b1 + 1-j-ii-b2-ii-b2 (integrasi BER-L23). **1-k** (Alat tempat uji) — **dipecah 4 sesi**; **1-k-i SELESAI** (Ganti akun contoh + bilah lengkap + pagar lingkungan); **1-k-ii SELESAI** (Papan uji inti: Kembalikan data contoh + Versi + "Yang perlu dicoba"); **1-k-iii SELESAI** (Jam uji: jam server terpusat + migrasi 0019 + mesin & tanda "Baru" ikut jam uji); **1-k-iv SELESAI** (Tamu uji: `akun_tamu_uji` migrasi 0020 + berakhir sendiri + Pembersih buang kedaluwarsa + cabut). **Dengan ini seluruh 1-k SELESAI dan Langkah 1 (1-a s.d. 1-k) UTUH secara kode; sudah di-push lewat PR #17, digabung ke `main` lewat PR #17 (merge `b74ab52`).** |

## Aturan sesudah beku

- Aturan dan spec tidak diubah lagi. Ide baru dicatat di `docs/work/backlog/`.
- Kesalahan atau pertentangan yang ketahuan saat membangun boleh diperbaiki kalau pemilik setuju, dicatat di CHANGELOG, bertanda "diperbaiki sesudah beku".
- Sistem lama (`../hris-app/`) dan database-nya hanya dibaca (WAJ-09).

## Langkah 1 — pembagian (disetujui pemilik 14 Oktober 2026)

Langkah 1 = modul **Karyawan dan Akses** (4A, 28 layar) + **Perlengkapan Bersama** (4B, 28 layar).
Besar; dipecah 11 bagian, **satu bagian satu sesi** (KER-11), urut dari yang dipakai paling banyak:

| Bagian | Isi | Status |
|---|---|---|
| **1-a** | Data inti: tabel cabang, departemen, jabatan, status kerja, orang, penempatan, akun + data contoh | **SELESAI** |
| 1-b | Masuk & akun (dipecah 2 sesi). **1-b-i** fondasi: migrasi 0002, penyandian sandi (scrypt), satu pintu DB, mesin sesi, kit komponen baku — **SELESAI**. **1-b-ii** layar Masuk/Daftar/Menunggu/Lupa password/Kode GM + migrasi 0003 (pendaftaran) + seed akun & kata sandi + terapkan 0002/0003 ke Supabase — **SELESAI** | SELESAI |
| 1-c | Hak akses: mesin hak akses, Hak Akses Jabatan, "Lihat sebagai", mesin pengaman | **SELESAI** |
| 1-d | Mesin Pengajuan + Beranda + Pemberitahuan (3 tingkat). Dipecah 2 sesi: **1-d-i** pondasi (migrasi 0005 + mesin murni) + **1-d-ii** layar + pintu | **SELESAI** |
| 1-e | Profil & akun sendiri (termasuk Ubah data diri lewat pengajuan) | **SELESAI** |
| 1-f | Kelola karyawan: Daftar, Halaman orang, penempatan, nonaktif/aktif, izin tugas lapangan | **SELESAI** |
| 1-g | Pendaftaran + periksa (**SELESAI**), Promosi Training (**SELESAI**), Pekerja Lepas (**SELESAI**); Hak Tambahan (**DITUNDA** → setelah 1-j + Keuangan) | selesai sejauh bisa |
| 1-h | Pengaturan Karyawan (dipecah 2 sesi). **1-h-i** Cabang & Jabatan + Pedoman Lapor + Riwayat Masuk — **SELESAI**. **1-h-ii** Pengaturan Jabatan + Pengecualian (bertanggal + lewat usulan) — **SELESAI**. KAR-L33 Hak Akses Jabatan sudah di 1-c | **UTUH** |
| 1-i | Pengumuman (dipecah 2 sesi, disetujui pemilik 15 Okt 2026). **1-i-i** Papan Perubahan Aturan (BER-L08/L09) + Pengumuman kelola/tulis/darurat/siapa-baca (BER-L22–L25) + kartu belum-dibaca Beranda — **SELESAI**. **1-i-ii** Panduan Karyawan (BER-L10/L26) + "Apa yang baru" (BER-L11) + tanda "Baru" — **SELESAI** | **UTUH** |
| 1-j | Sistem (dipecah 2 sesi, 15 Okt 2026; 1-j-ii dipecah 2 sub-sesi 16 Okt 2026; 1-j-ii-b dipecah 2 sub-sub-sesi 16 Okt 2026; 1-j-ii-b2 dipecah 2 sub-sub-sub-sesi 16 Okt 2026). **1-j-i** Pengamatan BER-L30 s.d. L34 — **SELESAI**. **1-j-ii-a** Infra mesin terjadwal + Penerbit pengumuman + Akhiri darurat + tombol "Jalankan sekarang" + kerangka Penghangus — **SELESAI**. **1-j-ii-b1** 4 mesin terjadwal sisanya (pengingat tinjauan + pembersih error isi utuh; cadangan + uji pulih kerangka) + pemasangan `tambahJejak()` ke 5 pintu tulis lama — **SELESAI**. **1-j-ii-b2-i** Kerangka Pengaturan 4B BER-L40/L41 (migrasi `pengaturan_umum` + registri 18 pengaturan BER & Umum + pintu + hak + layar + benih) — **SELESAI**. **1-j-ii-b2-ii** dipecah 2 sesi (18 Okt 2026): **1-j-ii-b2-ii-a** layar BER-L42 Jenis Pengajuan (ubah penyetuju/pemeriksa/pelihat, langsung + jejak) — **SELESAI**; **1-j-ii-b2-ii-b dipecah 2 sub-sesi (18 Okt 2026)**: **1-j-ii-b2-ii-b1** batas waktu per jenis bertanggal (migrasi 0017 + mesin pemindah + layar; Pengumuman dimatikan sementara) — **SELESAI**; **1-j-ii-b2-ii-b2** integrasi BER-L23 Papan Perubahan Aturan (langkah Pengumuman menyala + pre-fill + pengumuman_lahir dua arah + tarik saling membatalkan) — **SELESAI (19 Okt 2026)** | **1-j SELESAI (kode)** |
| 1-k | Alat tempat uji (BER-L50 Papan Uji + BER-L51 Ganti akun contoh). **Dipecah 4 sesi (disetujui pemilik 19 Okt 2026):** **1-k-i SELESAI** Ganti akun contoh (BER-L51) + bilah lengkap ("sedang sebagai" + tombol [Ganti akun]/[Papan uji]) + pagar lingkungan; **1-k-ii dipecah 2 sub-sesi (19 Okt 2026): 1-k-ii-a SELESAI** Papan uji: Kembalikan data contoh (ketik KEMBALIKAN) + Versi (sebagian, Masa A) + rumus benih dipindah ke satu tempat; **1-k-ii-b SELESAI** "Yang perlu dicoba" (daftar periksa 79 kejadian + tabel `daftar_periksa_uji`, migrasi 0018); **1-k-iii SELESAI** Jam uji (jam server terpusat + tabel `jam_uji` migrasi 0019 + mesin terjadwal & tanda "Baru" ikut jam uji + majukan menjalankan mesin terlewati; pilihan "ringkas"); **1-k-iv SELESAI** Tamu uji (akun `akun_tamu_uji` migrasi 0020 + berakhir 7 hari dari jam server + login ditolak lewat masa + mesin Pembersih buang kedaluwarsa + cabut; Pemilik/GM; tamu = pengunjung tanpa jabatan, email+sandi otomatis sekali-tampil) | **SELESAI (1-k UTUH, Langkah 1 UTUH)** |

### Sudah selesai di bagian 1-a (14 Oktober 2026)

- **Migrasi pertama** `db/migrasi/0001_organisasi-orang-dan-akun.sql`: 8 tabel inti (perusahaan,
  departemen, status_kerja, cabang, jabatan, orang, riwayat_penempatan, akun). Aturan dijaga DB,
  bukan dihitung: PRI-31 (kolom perusahaan), WAJ-03 (cabang/jabatan dari riwayat_penempatan),
  PRI-02 (aktif/dibatalkan, tanpa hapus), kunci unik/FK/CHECK, indeks (PRI-14). Tanpa trigger.
- **Data contoh tempat uji** `npm run benih` (perlu `BENIH_TEMPAT_UJI=ya`): Hammielion Petshop,
  4 cabang, 3 departemen, 8 jabatan, 8 orang contoh + penempatan. Bukan migrasi (SIS-26). Seed
  akun/kata sandi menyusul di 1-b; kembalikan-data penuh di 1-k.
- Diuji lokal (PostgreSQL 16 Docker): migrasi + idempoten + pengaman benih benar. `npm run cek`
  (20 tes) & `npm run build` lulus. Lihat CHANGELOG entri 223.

## Sudah selesai di bagian 1-b-i (14 Oktober 2026) — fondasi masuk + kit komponen

Spec acuan: `../specs/2026-10-13-karyawan-dan-akses-spec.md` bagian 4 (tabel) dan TAM-01 s.d. 25.
CHANGELOG entri 225.

- **Migrasi `db/migrasi/0002_akun-sesi-dan-masuk.sql`**: `sesi_perangkat`, `riwayat_masuk`,
  `jeda_masuk`, `kode_lupa_password` (PRI-31/02/14, CHECK, indeks; tanpa trigger). `akun` sudah ada
  dari 0001.
- **`src/lib/sandi.ts`** (+ tes): penyandian kata sandi & kode GM dengan **scrypt** bawaan Node
  (tanpa pustaka native), garam acak, cocok tahan-waktu.
- **`src/server/db.ts`**: satu pintu database (kolam `pg.Pool`), memakai `src/lib/koneksi.ts`
  (aturan sambungan aman kini satu tempat, WAJ-04; `scripts/koneksi.mts` jadi penerus).
- **Mesin sesi**: `src/lib/sesi.ts` (murni, teruji: token/hash/cookie/kedaluwarsa 30 hari) +
  `src/server/pintu/sesi.ts` (penyambung cookie + DB; akun nonaktif ditolak).
- **Kit komponen baku `src/komponen/`**: Tombol/TombolTahan, Isian, KotakSandi, Centang, Kode6,
  KotakCatatan, PenandaLangkah, BilahBawah, PesanBerhasil, JendelaError, JendelaKonfirmasi,
  KepalaLayar, Layar (barrel `@/komponen`). Komponen lain menyusul saat dipakai.
- Diuji lokal (PostgreSQL 16 Docker sekali-pakai): migrasi + idempoten + UNIQUE/CHECK benar.
  `npm run cek` (34 tes) & `npm run build` lulus.

## Sudah selesai di bagian 1-b-ii (14 Oktober 2026) — lima layar masuk + seed akun

Spec acuan: bagian 3 (KAR-L01 s.d. L05) & bagian 4. CHANGELOG entri 226.

- **5 layar** KAR-L01 s.d. L05 (Masuk, Daftar 4 langkah, Menunggu, Lupa password, Kode GM) dari
  kit komponen baku + mesin sesi/sandi 1-b-i. Server actions tipis per layar di `src/app/*/aksi.ts`.
- **Migrasi `0003_pendaftaran.sql`** (tabel pendaftaran calon karyawan).
- **`src/lib/masuk.ts`** (+ tes): angka awal pengaturan masuk + validasi + hitungan jeda (fungsi
  murni). **Pintu** `src/server/pintu/masuk.ts` (masuk/daftar/lupa/kode) & `pendaftar.ts` (sesi
  terbatas pendaftar untuk layar Menunggu).
- **Komponen baru**: `Pilih`, `Foto` (kamera/galeri → data URL), `Memuat` (fallback `<Suspense>`).
- **Beranda sementara** (`/`): setelah masuk tampil nama + penempatan; sebelum masuk ke Masuk.
  Beranda sesungguhnya di 1-d. (Halaman dinamis dibungkus `<Suspense>`, bukan `export const
  dynamic`, karena Cache Components Next 16.)
- **Seed akun**: 8 akun contoh aktif, sandi **`coba12345`** (disetujui pemilik). Benih idempoten,
  mengisi akun terpisah dari data dasar.
- **Terapkan ke Supabase**: migrasi 0002 + 0003 + 8 akun contoh. Terverifikasi (`_migrasi` 1,2,3;
  8 akun aktif; login cocok). `hris-v3-blue.vercel.app` menampilkan layar Masuk setelah deploy.
- **Titipan 4J** (belum ada mesinnya): email/pemberitahuan belum dikirim (tercatat di
  `riwayat_masuk`, komentar TITIPAN). Pembuat kode GM (KAR-L21) di 1-f; menyetujui/menolak
  pendaftar (KAR-L25/26) di 1-g — sampai itu pendaftar baru berhenti di layar Menunggu.
- Diuji: Docker PG (migrasi + idempoten + query + hash), `npm run cek` (46 tes) & `npm run build`
  lulus, uji-asap `next start` semua route 200.

## Sudah selesai di bagian 1-c (14 Oktober 2026) — hak akses

Spec acuan: bagian 5 (tindakan bernama + isi awal hak per jabatan) & KAR-58/63/67/71/72/73/78.
CHANGELOG entri 228.

- **Migrasi `0004_hak-akses.sql`**: `hak_jabatan`, `riwayat_hak_jabatan`, `riwayat_lihat_sebagai`,
  + kolom data `jabatan.akses_penuh` (Pemilik) & `jabatan.mengikuti_jabatan` (GM→Pemilik). Nama
  jabatan tidak di kode (WAJ-05): penanda itu adalah data.
- **Mesin murni `src/lib/hak.ts`** (+ 18 tes): 29 tindakan bernama modul Karyawan (KAR-71),
  lingkup diri/cabang/departemen/semua, lantai dasar "Semua karyawan" (KAR-44), batas keras KAR-72.
- **Pemeriksa `src/server/hak/periksa.ts`**: satu pintu `periksa`/`wajibBoleh`/`lingkupSekarang`;
  resolusi GM→Pemilik + akses penuh + cabang/dep hari ini + mode Lihat sebagai. Pintu `transaksi`
  ditambah di `src/server/db.ts`.
- **Layar `/pengaturan/hak-akses-jabatan` (KAR-L33)** 3 langkah + **`/sistem/lihat-sebagai`
  (KAR-L41)** dengan bilah kuning "Lihat sebagai" global (tulis dimatikan, pemakaian tercatat).
- **Isi awal hak** di `scripts/benih.mts` (idempoten): Pemilik akses penuh, GM mengikuti Pemilik,
  HR/Admin HR 14 tindakan, Finance 2, Kepala Gudang 3; Kepala Toko/Kasir cukup lantai dasar.
- **Terapkan ke Supabase**: migrasi 0004 + 33 baris hak + penanda jabatan; terverifikasi.
- Diuji: Docker PG (migrasi + idempoten + resolusi), `npm run cek` (64 tes) & `npm run build` lulus,
  uji-asap `next start` (route L33/L41 → 200; pagar "hanya Pemilik/GM" tanpa sesi).
- **Titipan 4J**: pemberitahuan "Hak Akses Jabatan diubah" (KAR-73) belum dikirim; "buat kode lupa
  password" dibaca dari Pengaturan (penerima "hubungi", isi awal GM) di 1-f/1-j; batas keras #3
  (gaji Pemilik/GM) & #4 (ubah data tersetujui) menanti modulnya (Gaji/persetujuan).

## Sudah selesai di bagian 1-d-i (15 Oktober 2026) — pondasi Mesin Pengajuan

Spec acuan: Perlengkapan Bersama (4B) bagian 1, 3, 4; desain Pengajuan & Laporan (3E).
CHANGELOG entri 229. 1-d dipecah 2 sesi seperti 1-b (besar).

- **Migrasi `0005_mesin-pengajuan-dan-beranda.sql`**: 8 tabel — `jenis_pengajuan`, `pengajuan`
  (7 status), `riwayat_pengajuan`, `lampiran_pengajuan`, `jenis_tanda`, `perlu_perhatian`,
  `pengingat`, `pemberitahuan`. Jenis = data (penyetuju/pemeriksa/pelihat = jabatan). CHECK
  status/lingkup/pemeriksa≠penyetuju/orang-atau-tindakan, FK, indeks; tanpa trigger. Hanya menambah.
- **Mesin murni `src/lib/pengajuan.ts`** (+ 25 tes): `langkah()` (perpindahan 7 status + batas
  keras KAR-72 tak-putuskan-sendiri + peran + alasan wajib), `lewatBatas()` (jam server, PRI-01/
  07/08/09), `tingkatUntukTanda()` (3 tingkat TAM-24/25). Tanpa DB/cookie → teruji penuh.
- Diuji: Docker PG 16 (migrasi 0001–0005 + idempoten + semua CHECK + self-FK), `npm run cek`
  (89 tes) & `npm run build` lulus.

## Sudah selesai di bagian 1-d-ii (15 Oktober 2026) — layar Mesin Pengajuan + Beranda

CHANGELOG entri 230. Dengan ini **1-d utuh**: masuk disambut Beranda sesungguhnya + menu.

- **Pintu `src/server/pintu/pengajuan.ts`**: Beranda (perlu perhatian dihitung langsung dari
  pengajuan menunggu), Pemberitahuan (+tandai terbaca), Pengajuan Saya + Rincian, Ajukan (kerangka
  + batas waktu), kotak Persetujuan (3 tab), Putuskan dengan resolusi PERAN dari data jenis
  (jabatan penyetuju/pemeriksa + akses penuh Pemilik/GM) + `jalankanAksi` (mesin murni + `transaksi`
  + riwayat + pemberitahuan ke pengaju). Lihat sebagai menolak semua tulis; batas keras KAR-72.
- **Layar**: Beranda BER-L01 (`src/app/page.tsx`, ganti beranda sementara), Pemberitahuan BER-L02,
  Pengajuan Saya BER-L04 + Ajukan BER-L05/06 + Rincian BER-L07, Persetujuan BER-L20 + Putuskan
  BER-L21. Komponen `LabelStatus` (7 status). Seed 2 jenis contoh + jenis tanda (idempoten).
- Diuji: Docker PG 16 + `next start` uji-asap (semua route 200; HR melihat & boleh putuskan izin
  Kasir; izin milik HR sendiri ditolak — batas keras lewat seluruh tumpukan). `npm run cek` (89 tes)
  & `npm run build` lulus.
- **Belum di-push** (push oleh pemilik): cabang lokal `mesin-pengajuan-1d-i` lalu `mesin-pengajuan-1d-ii`
  (1d-ii memuat 1d-i; bisa di-push satu PR, atau 1d-i dulu baru 1d-ii).

### TITIPAN 1-d yang pindah ke bagian lain

- ~~Terapkan migrasi 0005 + seed ke Supabase~~ **SELESAI** (15 Okt 2026): migrasi 0005–0009 + benih terpasang di Supabase tempat uji.
- **Menu lengkap per hak** (bilah bawah HP / samping PC, menu-desain.md): kini masih ringkas di
  Beranda. Dirapikan saat modul lain menambah layarnya.
- **Jendela antrean BER-L03** + pengisian `pengingat`/`perlu_perhatian` oleh mesin terjadwal →
  bagian 1-j (mesin). "Pengumuman belum dibaca" di Beranda → bagian 1-i (Pengumuman).
- **Minta dibatalkan** (BER-L07, permintaan ke penyetuju) & **unggah lampiran** (BER-L06) menyusul.
- Isi KHAS tiap jenis (tanggal izin, nominal kasbon): spec modulnya (Kehadiran 4D, Gaji 4G).

## Sudah selesai di bagian 1-e (15 Oktober 2026) — Profil & Akun sendiri

CHANGELOG entri 231. Membuktikan Mesin Pengajuan (1-d) dipakai ulang.

- **Migrasi `0006_ubah-data-diri.sql`**: tabel isi-khas `ubah_data_diri`.
- **Hook efek `src/server/pintu/efek-pengajuan.ts`**: `efekDisetujui` jalan dalam transaksi keputusan
  saat status → disetujui; efek "ubah_data_diri" menyalin nilai tidak-NULL ke `orang` (COALESCE).
  `ajukan()` diperluas terima `isiKhas` + `lampiran`.
- **Pintu `src/server/pintu/profil.ts`** + **layar menu Saya**: `/saya` (L10), `/saya/kontak` (L11,
  langsung berlaku), `/saya/identitas` (L12, lewat pengajuan ubah data diri; rekening wajib lampiran),
  `/saya/sandi` (L13), `/saya/perangkat` (L14). Beranda dapat tautan Profil & Akun.
- Diuji: Docker PG 16 (migrasi 0001–0006; SQL efek benar), `next start` (route `/saya` 200, sesi
  Kasir melihat profilnya), `npm run cek` (89 tes) & `npm run build` lulus.
- **Belum di-push** (push oleh pemilik): cabang lokal `profil-akun-1e` (memuat 1-d juga).

## Sudah selesai di bagian 1-f (15 Oktober 2026) — Kelola Karyawan

CHANGELOG entri 232.

- **Migrasi `0007_status-dan-izin-lapangan.sql`**: `riwayat_status` + `izin_tugas_lapangan` (indeks
  unik parsial: 1 izin aktif per orang+jenis). Penempatan pakai `riwayat_penempatan` (0001).
- **Pintu `src/server/pintu/kelola-karyawan.ts`**: daftarKaryawan (disaring lingkup hak),
  halamanOrang, catatPenempatan (tutup+buka riwayat; Training→Karyawan diblok; berhak-tinggi hanya
  akses penuh), nonaktifkan/aktifkan (+ keluar perangkat KAR-69), ubahIzin. Batas keras KAR-72.
- **Layar** (menu Daftar Karyawan per hak): `/karyawan` (L20), `/karyawan/[id]` (L21),
  `/karyawan/[id]/penempatan` (L22), `/karyawan/[id]/status` (L23), izin toggle (L24).
- Diuji: Docker PG 16 + `next start` (HR lihat Daftar + aksi; halaman diri sendiri batas keras;
  Kasir ditolak). `npm run cek` (89 tes) & `npm run build` lulus.
- **Belum di-push** (push oleh pemilik): cabang lokal `kelola-karyawan-1f` (memuat 1-d, 1-e juga).

## Sudah selesai di bagian 1-g — Pendaftaran (15 Oktober 2026)

CHANGELOG entri 233. Menutup titipan registrasi dari 1-b-ii.

- **Pintu `src/server/pintu/pendaftaran.ts`** + layar `/pendaftaran` (KAR-L25) & `/pendaftaran/[id]`
  (KAR-L26, 3 langkah). Setujui = satu transaksi: kode `K####` server (KAR-02), lahir
  orang+penempatan+akun aktif (sandi tersandi disalin apa adanya → calon langsung bisa masuk).
  Tanpa migrasi (tabel `pendaftaran` dari 0003). Beranda tampilkan "Pendaftaran Baru" per hak.
- Diuji: Docker PG 16 (urutan SQL persetujuan melahirkan K0001 + akun aktif + sandi lolos cocokSandi;
  kode naik K0002) + `next start` (layar 200). `npm run cek` (89 tes) & `npm run build` lulus.
- **Belum di-push** (push oleh pemilik): cabang lokal `pendaftaran-1g` (memuat 1-d, 1-e, 1-f juga).

### Sudah selesai: Promosi Training (KAR-L27, 15 Oktober 2026)

CHANGELOG entri 234. Migrasi `0008_penilaian-training.sql` + pintu `promosi-training.ts` + layar
`/promosi-training`. Setujui: status Training→Karyawan (tutup+buka penempatan) + catat; Tunda:
nilai_lagi_pada + alasan. Gaji Standar = titipan Gaji (4E). Cabang branch `pendaftaran-1g` (lanjutan).

### Sudah selesai: Pekerja Lepas (KAR-L28, 15 Oktober 2026)

CHANGELOG entri 235. **Keputusan pemilik 15 Oktober 2026**: pekerja lepas = satu daftar bebas
se-perusahaan (bukan per cabang), sesuai DRV-45 (hanya nama + HP). Migrasi `0009_pekerja-lepas.sql`
(tabel `pekerja_lepas` menandai orang + status Freelance; tanpa penempatan). Pintu `pekerja-lepas.ts`
(hak `kar.kelola_pekerja_lepas`): daftar+cari, tambah (kode `L####`), ubah, nonaktif/aktif; HP kembar
ditolak. Layar `/pekerja-lepas`; Beranda tampilkan "Pekerja Lepas" per hak. 2 contoh di benih.
Diuji: Docker PG 16 + `next start` (route 200); `npm run cek` (89 tes) & build lulus. Cabang branch
`pendaftaran-1g` (lanjutan). "Terakhir ikut bongkaran" = titipan Logistik/Gaji Driver.

### DITUNDA: Hak Tambahan (KAR-L29) — keputusan pemilik 15 Oktober 2026

Dikerjakan **utuh nanti** (bukan sebagian), setelah gantungannya ada, supaya janji aturan bisa
ditepati:

- **Butuh mesin terjadwal (bagian 1-j)** untuk "berakhir sendiri pukul 23.59 jam server" dan
  "pengingat H-1 ke pemberi & penerima" (KAR-75). Tanpa itu, hak harus dicabut manual — melanggar
  janji "anti lupa".
- **Separuhnya ("hak lapor sementara Laporan Kasir") menunjuk modul Keuangan** (KEU-40/KEU-118) yang
  belum ada kodenya, jadi haknya belum punya sasaran.
- Juga butuh tabel `hak_tambahan` (migrasi baru) + perluasan mesin hak (`periksa.ts`/`hak.ts`) untuk
  hibah tindakan pada CABANG TERTENTU, dan "gantikan sementara" = jabatan tambahan bertanggal akhir
  (riwayat_penempatan jenis 'tambahan') dengan batas KAR-74 (berhak tinggi hanya Pemilik/GM).

## Sudah selesai di bagian 1-h-i (15 Oktober 2026) — Cabang & Jabatan + Pedoman Lapor + Riwayat Masuk

CHANGELOG entri 236. 1-h dipecah 2 sesi (disetujui pemilik 15 Okt 2026): 1-h-i (tiga layar tanpa
rumus uang, sesi ini) + 1-h-ii (Pengaturan Jabatan + Pengecualian, bertanggal + lewat usulan).
KAR-L33 Hak Akses Jabatan sudah di 1-c.

- **Cabang & Jabatan (KAR-L30)** `src/server/pintu/cabang-jabatan.ts` + `/pengaturan/cabang-jabatan`:
  tiga daftar (Cabang/Departemen/Jabatan) tambah/ubah/nonaktif-aktif. **Tanpa migrasi** (tabel sudah
  ada sejak 0001, lengkap titik lokasi & `berhak_tinggi`). Pagar **KAR-27** (nonaktif yang masih
  dipakai ditolak + sebut pemakai) & **KAR-74** (tanda "berhak tinggi" hanya akses penuh). Hak
  `kar.ubah_cabang_departemen_jabatan` (sudah terdaftar sejak 1-c).
- **Pedoman Lapor (KAR-L34/L35)** migrasi **`0010_pedoman-lapor.sql`** (tabel `pedoman_lapor`) +
  `src/server/pintu/pedoman-lapor.ts` + `/pedoman-lapor`: dibaca SEMUA (`kar.baca_pedoman_lapor`),
  dikelola Pemilik/GM (`kar.ubah_pedoman_lapor`): tambah/ubah/**urut naik-turun**/nonaktif. Kosong →
  "Pedoman belum diisi" (isi disusun pemilik, tidak dibenihi).
- **Riwayat Masuk Semua Orang (KAR-L40)** `src/server/pintu/riwayat-masuk.ts` + `/sistem/riwayat-masuk`:
  baca `riwayat_masuk` (0002, tanpa migrasi), saring cari/jenis/tanggal, bawaan 7 hari (jam server).
  Hak `kar.lihat_riwayat_masuk_semua` (akses penuh → Pemilik/GM).
- Beranda menautkan ketiganya sesuai hak. Diuji: Docker PG 16 (migrasi 0001–0010 + idempoten + benih;
  kueri KAR-27, urut pedoman, join riwayat masuk) + `next start` lewat **sesi sungguhan** (HR:
  Cabang&Jabatan+Pedoman ya, Riwayat Masuk "tidak punya hak"; Kasir hanya Pedoman; GM ketiganya).
  `npm run cek` (89 tes) & `npm run build` lulus.
- **Sudah di-push & digabung ke `main` lewat PR #14** (15 Okt 2026): cabang `pengaturan-karyawan-1h`
  (memuat 1-h + 1-i utuh). Migrasi 0010–0013 + benih diterapkan ke Supabase tempat uji saat merge.

## Sudah di-push & digabung ke `main` (15 Okt 2026)

Cabang `pendaftaran-1g` (memuat semua 1-d…1-g) di-push dan digabung lewat **PR #13**
(`gh pr merge 13 --merge`). CI hijau (pagar mutu, database dari migrasi, cek CHANGELOG);
Vercel Preview merah karena akun GitHub commit belum tertaut (tidak menghalangi deploy dari `main`).
Cabang lokal 1-d-i…1-g sudah menyatu di `main`; boleh dihapus kalau mau rapi.

| Cabang (menyatu di PR #13) | Isi | CHANGELOG |
|---|---|---|
| `mesin-pengajuan-1d-i` | 1-d-i pondasi Mesin Pengajuan | 229 |
| `mesin-pengajuan-1d-ii` | 1-d-ii layar + pintu (memuat 1-d-i) | 230 |
| `profil-akun-1e` | 1-e Profil & Akun (memuat 1-d) | 231 |
| `kelola-karyawan-1f` | 1-f Kelola Karyawan (memuat 1-d, 1-e) | 232 |
| `pendaftaran-1g` | 1-g Pendaftaran + Promosi Training + Pekerja Lepas (memuat 1-d…1-f) | 233, 234, 235 |

**Mencoba di tempat uji:** terapkan migrasi 0005–0009 + benih ke database, lalu masuk sebagai
`hr@contoh.test` / `coba12345` (atau akun contoh lain) → Beranda memunculkan menu sesuai hak.

## Sudah selesai di bagian 1-h-ii (15 Oktober 2026) — Pengaturan Jabatan + Pengecualian

CHANGELOG entri 237. Dengan ini **1-h utuh**.

- **Migrasi `0011`**: `pengaturan_jabatan` (append-only bertanggal, WAJ-07), `usul_pengaturan_jabatan`
  + `usul_pengecualian`, `pengecualian` (PRI-26/38), kolom `jenis_pengajuan.lewat_layar_khusus`.
- **Mesin murni `src/lib/pengaturan-jabatan.ts`** (+17 tes): 14 tanda, `nilaiBerlaku`,
  `periksaTanggalBerlaku` (PRI-29), `tinjauanBerikutnya` (PRI-38). Penulis bersama
  `terapkan-pengaturan.ts` (WAJ-04) untuk jalur LANGSUNG (Pemilik/GM) & efek usulan disetujui.
- **Pintu** `pengaturan-jabatan.ts` + `pengecualian.ts`; **layar** `/pengaturan/pengaturan-jabatan`
  & `/pengaturan/pengecualian` (Tambah 4 langkah, Hentikan, "Masih perlu"); Beranda per hak.
- **Benih**: 3 tanda jati-diri KAR-83; tanda lain kosong (diisi pemilik). 2 jenis usulan.
- **Titipan**: konsep pengumuman (PRI-35) → 1-i; pengingat tinjauan (PRI-38) + pemberitahuan pemilik
  lain (KAR-73) → mesin terjadwal 1-j; tanda "Tombol utama HP" ditunda (menunggu menu).
- Diuji: Docker PG 16 (migrasi 0001–0011 + idempoten + benih; nilai berlaku bertanggal, efek
  usulan→terapkan, lateral "nilai biasa") + `next start` sesi sungguhan (GM/HR ya; Kasir "tidak punya
  hak"). `npm run cek` (106 tes) & `npm run build` lulus.
- **Sudah di-push lewat PR #14** (15 Okt 2026): cabang `pengaturan-karyawan-1h` menyatu di `main`.

## Sudah selesai di bagian 1-i-i (15 Oktober 2026) — Pengumuman (Papan Perubahan Aturan + darurat)

CHANGELOG entri 239. 1-i dipecah 2 sesi (disetujui pemilik 15 Okt 2026): 1-i-i (Pengumuman inti,
sesi ini) + 1-i-ii (Panduan Karyawan + "Apa yang baru"). Memecah lebih kecil tidak menghemat token
(konteks dibaca ulang tiap sesi); 2 sesi = titik seimbang.

- **Migrasi `0012_pengumuman.sql`**: `pengumuman` (aturan/darurat; dua tanggal untuk aturan, pesan +
  masa tayang untuk darurat; 6 status; tautan pengajuan/meralat/lahir_dari_pengaturan),
  `sasaran_pengumuman` (semua/cabang/jabatan, PRI-29), `baca_pengumuman`. CHECK dua-tanggal/pesan/
  sasaran; tanpa trigger.
- **Mesin murni `src/lib/pengumuman.ts`** (+20 tes): `periksaDuaTanggal` (7/1 hari, PRI-35 butir 4),
  `statusEfektif` ("terjadwal→terbit" & "darurat berakhir" dihitung saat DIBACA — tepat waktu tanpa
  mesin Penerbit 1-j), `geserSaatDisetujui` (uang disetujui telat → jadwal digeser, jarak tetap),
  `orangSasaran`.
- **Pintu `pengumuman.ts`** + 4 tindakan hak baru (`ber.tulis_pengumuman_aturan`,
  `ber.kirim_pengumuman_darurat`, `ber.lihat_baca_pengumuman`, `ber.tandai_pengumuman_dibaca`).
  Uang ditulis HR/Admin HR → Mesin Pengajuan (jenis `pengumuman_uang`), terbit saat disetujui
  Pemilik/GM (efek `pengumuman_uang`); non-uang / Pemilik-GM langsung (KAR-73). Darurat terbit
  seketika; "Akhiri sekarang". "Tarik" (belum berlaku) + "Ralat" (pengumuman baru menggantikan).
- **Layar**: `/papan-perubahan-aturan` (+`[id]`) BER-L08/L09; `/pengumuman` BER-L22 (5 tab + Tulis 4
  langkah + Darurat 3 langkah + Siapa sudah/belum baca). Beranda: **kartu "pengumuman belum dibaca"**
  paling atas (PRI-35 butir 5) + tautan menu. Benih: jenis `pengumuman_uang` + 3 hak HR/Admin HR.
- Diuji: Docker PG 16 (migrasi 0001–0012 + idempoten + benih; CHECK ditolak; belum-dibaca 1→0;
  sasaran cabang cocok) + `next start` (route 200, pagar "belum masuk"). `npm run cek` (126 tes) &
  `npm run build` lulus.
- **Sudah di-push lewat PR #14** (15 Okt 2026): cabang `pengaturan-karyawan-1h` menyatu di `main`.
- **Titipan 1-j**: mesin Penerbit (antrean/pemberitahuan saat terbit + akhiri darurat tepat waktu);
  beri tahu pemilik lain saat uang langsung Pemilik/GM (KAR-73); pembatalan perubahan pengaturan saat
  pengumuman yang lahir darinya ditarik. **BER-L03 jendela antrean** tetap titipan 1-j.

## Sudah selesai di bagian 1-i-ii (15 Oktober 2026) — Panduan Karyawan + "Apa yang baru"

CHANGELOG entri 240. Dengan ini **1-i utuh** (dan Langkah 1 bagian 1-a s.d. 1-i semuanya selesai).

- **Keputusan pemilik 15 Oktober 2026** (ditanya sebelum mulai, lihat KER-13/14): `catatan_rilis`
  ("Apa yang baru") diisi lewat **skrip benih** oleh sesi pembangunan — draf AI, disetujui/diedit
  pemilik sebelum sesi ditutup (seperti CHANGELOG) — BUKAN lewat layar Tulis di aplikasi, karena spec
  bagian 5 tidak memberi tindakan untuk itu. Data lama (1-a s.d. 1-h) **tidak diisi mundur**.
- **Migrasi `0013_panduan-dan-rilis.sql`**: `halaman_panduan` + `riwayat_halaman_panduan` (potret
  SEBELUM tiap perubahan, dipakai tombol "Kembali" BER-L26 — bukan `jejak_perubahan` umum, masih
  titipan 1-j) untuk Panduan Karyawan; `catatan_rilis` + `sasaran_catatan_rilis` (semua/jabatan,
  bentuk sama `sasaran_pengumuman`) + `tanda_baru_rilis` (kunci menu/bagian) untuk "Apa yang baru".
- **Mesin murni `src/lib/rilis.ts`** (+4 tes): `masihBaru` (tanda "Baru" 7 hari, jam server PRI-01).
- **2 tindakan baru di `hak.ts`**: `ber.baca_panduan_dan_rilis` (lantai dasar semua) dan
  `ber.ubah_panduan_karyawan` (HR, Admin HR, Pemilik, GM).
- **Pintu** `src/server/pintu/panduan.ts` (baca + tambah/ubah/urutkan/sembunyikan/riwayat/kembalikan)
  dan `src/server/pintu/rilis.ts` (hanya baca, saring PRI-29 seperti Papan Perubahan Aturan).
- **Layar**: `/panduan` (BER-L10) + `/panduan/[id]`; `/panduan/kelola` (BER-L26, dari kartu di
  `/pengumuman`); `/apa-yang-baru` (BER-L11). Beranda: menu "Panduan Karyawan" + kaki menu "Versi N ·
  Apa yang baru" (TAM-20), keduanya bisa bertanda "Baru" (TAM-21).
- **2 komponen baku baru**: `IsianPanjang` + `IsiPanduan` (`docs/work/desain/README.md` diperbarui).
- **Diperbaiki sesudah beku** (di luar 1-i-ii, ditemukan saat `npm run cek`): 2 galat lint pra-ada di
  `src/app/pengumuman/` — perbaikan mekanis, tanpa mengubah perilaku.
- Diuji: Docker PG 16 (migrasi 0001–0013 + idempoten + benih) + `next start` lewat sesi sungguhan
  (HR: kelola & baca ya; Kasir: baca ya, kelola "tidak punya hak"). `npm run cek` (130 tes) &
  `npm run build` lulus.
- **Sudah di-push lewat PR #14** (15 Okt 2026): cabang `pengaturan-karyawan-1h` menyatu di `main`.

## Sudah selesai di bagian 1-j-i (15 Oktober 2026) — Pengamatan Sistem

CHANGELOG entri 241. 1-j dipecah 2 sesi (disetujui pemilik 15 Okt 2026): 1-j-i (sesi ini) = baca
pencatatan sistem (BER-L30 s.d. L34) + tabelnya + hak; 1-j-ii = mesin terjadwal + Pengaturan umum.

- **Migrasi `0014_sistem-kesehatan-error-jejak.sql`**: 5 tabel. `mesin_otomatis` (pendaftaran:
  interval_detik + toleransi_detik + jadwal_label, aktif), `riwayat_jalan_mesin` (satu per sekali
  jalan; CHECK selesai↔berhasil), `error_tercatat` (TAM-05: siapa/halaman/pesan/jenis/kode rujukan/
  isi teknis), `tanggapan_error` (UNIQUE kode+tanggal: tandai perlu-perhatian ditangani),
  `jejak_perubahan` (append-only, PRI-40 butir 4; CHECK oleh IS NOT NULL OR modul_pemicu IS NOT NULL).
  Semua PRI-31/14/02; tanpa trigger (SIS-35/37).
- **Mesin murni** `src/lib/kesehatan-mesin.ts` (+10 tes) & `src/lib/error-rangkum.ts` (+6 tes):
  status Sehat/Gagal/Telat/Dimatikan dihitung saat BER-L30 dibuka (bukan oleh mesin lain, PRI-33);
  ringkasan 10 teratas; "perlu perhatian" = tanpa_sebab atau 3+ orang sehari.
- **5 tindakan baru** di `hak.ts` modul "Sistem": `sis.lihat_kesehatan_mesin`,
  `sis.jalankan_mesin_sekarang` (dipakai 1-j-ii), `sis.lihat_riwayat_error`,
  `sis.tandai_error_ditangani`, `sis.lihat_jejak_perubahan`. Lingkup "semua" saja (H10); Pemilik/GM
  dapat lewat akses penuh.
- **Pintu**: `src/server/pintu/kesehatan-mesin.ts`, `riwayat-error.ts` (daftar/ringkasan/rincian/
  tandai), `jejak-perubahan.ts` (`daftarJejak`/`jejakBaris`/`tambahJejak` untuk dipanggil pintu
  tulis lain dalam transaksinya), `catat-error.ts` (penulis `error_tercatat` dari klien saat TAM-05).
- **Layar**: `/sistem/kesehatan-mesin` (BER-L30) + `/sistem/kesehatan-mesin/[kode]` (BER-L31);
  `/sistem/riwayat-error` (BER-L32) + `/sistem/riwayat-error/[id]` (BER-L33 + form "Sudah
  ditangani"); `/sistem/jejak-perubahan` (BER-L34). Beranda: 3 menu Sistem untuk Pemilik/GM.
- **Benih**: 7 mesin otomatis didaftarkan (tutup pengajuan lewat batas, penerbit pengumuman,
  akhiri darurat, pengingat tinjauan, cadangan harian, uji pulih bulanan, pembersih error) supaya
  BER-L30 ada isinya dan "Telat" terlihat ketika mesinnya belum ada — sesuai spec.
- **Keluar lingkup 1-j-i → 1-j-ii**: tombol "Jalankan sekarang" (BER-L31); menu Pengaturan umum
  (BER-L40/L41/L42); pemasangan `tambahJejak()` ke pintu-pintu tulis yang sudah ada; mesin
  terjadwal yang mengisi `riwayat_jalan_mesin`; pembersih error > 12 bulan.
- Diuji: `npm run cek` (151 tes) & `npm run build` lulus (5 route baru). Docker PG + sesi sungguhan
  belum di sesi ini (Docker tidak tersedia di perangkat); migrasi 0014 + benih mesin dijalankan ke
  Supabase saat 1-j-i di-push.
- **Belum di-push** (push oleh pemilik): cabang baru untuk 1-j-i (lahir dari `main` sesudah PR #14).

## Sudah selesai di bagian 1-j-ii-a (16 Oktober 2026) — Infra mesin terjadwal + 3 mesin + "Jalankan sekarang"

CHANGELOG entri 242. 1-j-ii dipecah 2 sub-sesi (disetujui pemilik 16 Okt 2026): sesi ini infra +
3 mesin terdekat ke sasaran; 1-j-ii-b menyusul (4 mesin sisanya + Pengaturan umum + pemasangan
`tambahJejak()` ke pintu lama).

- **Migrasi `0015_mesin-terjadwal.sql`**: `pengumuman.diberitahukan_pada` (kunci idempotensi mesin
  Penerbit) + indeks UNIQUE parsial `perlu_perhatian_pengumuman_unik` di `perlu_perhatian`. Hanya
  menambah; tanpa trigger.
- **Mesin murni `src/lib/mesin-terjadwal.ts`** (+5 tes): tipe `KerjaMesin` (jalankan menerima
  `kueriT`, perusahaan, jam server) + registri + `HasilJalan`/`AlasanTidakJalan`/`PESAN_TIDAK_JALAN`.
- **Penulis `src/server/mesin/jalankan.ts`**: `jalanMesin(kode)` → advisory xact lock + INSERT
  baris `riwayat_jalan_mesin` + SAVEPOINT + panggil `KerjaMesin.jalankan` + UPDATE baris (berhasil
  atau pesan_gagal). Kerja yang gagal: rollback savepoint, catat pesan, tetap commit baris riwayat.
- **Kerja mesin**:
  - `penerbit-pengumuman.ts`: aturan 'terjadwal' → 'terbit' + pemberitahuan + perlu_perhatian
    (ON CONFLICT idempoten). Juga menyapu yang sudah 'terbit' tapi `diberitahukan_pada IS NULL`.
  - `akhiri-darurat.ts`: darurat 'terbit' dengan `masa_tayang_sampai < now()` → 'berakhir'.
  - `tutup-pengajuan.ts`: **kerangka kosong** (keputusan pemilik 16 Okt 2026). Spec "atas permintaan
    modul jenisnya" (PRI-09, modul Kehadiran) → isi utuh menunggu modul Kehadiran. Mesin didaftarkan
    supaya tombol "Jalankan sekarang" bisa dicoba (lapor jumlahDikerjakan=0, selalu berhasil).
- **Pintu `src/server/pintu/jalankan-mesin.ts`** (hak `sis.jalankan_mesin_sekarang`; mode Lihat
  sebagai ditolak) + jejak_perubahan untuk audit (mesin_otomatis, kolom `jalankan_sekarang`).
- **Pintu `kesehatan-mesin.ts` BER-L31** kini melaporkan `bolehJalankan`; layar menampilkan tombol
  `JalankanForm` + aksi server + `revalidatePath` BER-L30/L31. Konfirmasi 3 detik TIDAK dipakai
  (TAM-15 untuk uang).
- **Benih**: 1 jenis tanda baru `pengumuman_terbit` (`masuk_antrean=true`, layar
  `/papan-perubahan-aturan`); sesuai spec bagian 7. Diisi di benihJenisPengajuan (idempoten).
- Diuji: `npm run cek` (156 tes) & `npm run build` lulus. `next start` uji-asap: route 200. Docker
  PG + sesi sungguhan belum (Docker tidak tersedia). Migrasi 0015 + benih tanda baru diterapkan ke
  Supabase saat cabang di-push.
- **Belum di-push** (push oleh pemilik): cabang `pengamatan-sistem-1j-i` memuat 1-j-i + 1-j-ii-a;
  1-j-ii-b menyusul di cabang yang sama. Satu PR berisi seluruh 1-j.

## Sudah selesai di bagian 1-j-ii-b1 (16 Oktober 2026) — 4 mesin terjadwal sisanya + `tambahJejak()` ke pintu lama

CHANGELOG entri 243. 1-j-ii-b dipecah 2 sub-sub-sesi (disetujui pemilik 16 Okt 2026): sesi ini
4 mesin sisa + jejak; 1-j-ii-b2 menyusul = Pengaturan umum BER-L40/L41/L42 utuh.

- **4 kerja mesin baru** di `src/server/mesin/kerja/`:
  - `pengingat-tinjauan-pengaturan.ts` **(isi utuh, PRI-38)**: pengecualian tanpa tanggal akhir
    yang `tinjauan_berikutnya <= hari ini` → `perlu_perhatian` kode `tinjauan_pengecualian` ke
    Pemilik/GM (akses_penuh atau mengikuti). Pengecualian bertanggal akhir yang `berlaku_sampai =
    hari ini + 7` → `pemberitahuan` + `perlu_perhatian` kode `tinjauan_pengecualian_h7` ke
    Pemilik/GM/`dibuat_oleh`. Idempoten via indeks UNIQUE parsial dari 0015.
  - `pembersih-error.ts` **(isi utuh)**: DELETE `error_tercatat` yang `jam < now() - 12 bulan`.
    `tanggapan_error` tetap (ringkasan BER-L32 per bulan tidak hilang).
  - `cadangan-harian.ts` **(KERANGKA)**: menunggu VPS Masa B (SIS-42). Supabase sudah menyediakan
    cadangan harian sendiri di Masa A.
  - `uji-pulih.ts` **(KERANGKA)**: menunggu VPS Masa B (SIS-42).
- **Registri** `src/server/mesin/registri.ts`: 4 kerja mesin didaftar (jadi 7 total, cocok benih).
- **Tes** `src/server/mesin/kerja/mesin-baru.test.ts` (+6 tes): konstruksi + fallback.
- **Benih 2 jenis_tanda baru**: `tinjauan_pengecualian` + `tinjauan_pengecualian_h7` (keduanya
  masuk antrean, modul "Karyawan dan Akses", layar `/pengaturan/pengecualian`). Format tabel
  benih diperluas kolom `modul` (sebelumnya hard-coded).
- **Pemasangan `tambahJejak()` ke 5 pintu tulis lama** (BER-L34):
  - `cabang-jabatan.ts`: CRUD Cabang + Departemen + Jabatan (SELECT lama → UPDATE → jejak per kolom
    yang berubah). Return pattern diubah ke discriminated union `{ ok: true } | { ok: false as
    const; galat }` supaya narrowing TypeScript bersih.
  - `kelola-karyawan.ts`: `nonaktifkan`/`aktifkan` catat kolom `orang.aktif` (dengan alasan dari
    riwayat_status). `ubahIzin` catat `izin_tugas_lapangan` lahir/dicabut. `catatPenempatan` tidak
    dibungkus (append-only `riwayat_penempatan` sudah jadi jejak intrinsik).
  - `pedoman-lapor.ts`: `tambahPedoman`/`ubahPedoman`/`setAktifPedoman`. `pindahUrutan` tidak
    (perubahan massal; audit urutan ada di `diubah_oleh/pada`).
  - `pekerja-lepas.ts`: `tambahPekerjaLepas` (lahir orang) + `ubahPekerjaLepas` (nama/HP) +
    `setAktifPekerjaLepas` (orang.aktif).
  - `pengecualian.ts`: `hentikanPengecualian` + `masihPerlu`. Keduanya **juga** membereskan kartu
    `perlu_perhatian` tinjauan (SET `beres=true`) supaya kartu Beranda langsung hilang tanpa
    menunggu mesin berikut jalan. `tambahPengecualian` jalur langsung tidak dibungkus (`pengecualian`
    sudah dicatat utuh di tabel + `dibuat_oleh`).
- **Pintu TIDAK dipasangi jejak** (sudah ada jejak intrinsik, WAJ-04): `pengaturan_jabatan`
  (append-only); `hak_jabatan` (ada `riwayat_hak_jabatan` dari 0004); `halaman_panduan` (ada
  `riwayat_halaman_panduan` dari 0013); `riwayat_penempatan`/`riwayat_status`/`pengumuman`
  (append-only); profil (lewat pengajuan + efek); akun (`riwayat_masuk` dari 0002).
- Diuji: `npm run cek` (162 tes, +6 dari 1-j-ii-a) & `npm run build` lulus. Docker PG + sesi
  sungguhan belum di sesi ini (Docker tidak tersedia di perangkat); isi mesin yang menyentuh DB
  dicek di tempat uji saat cabang di-push.
- **Belum di-push** (push oleh pemilik): cabang `pengamatan-sistem-1j-i` tetap, memuat
  1-j-i + 1-j-ii-a + 1-j-ii-b1. 1-j-ii-b2 (Pengaturan umum) menyusul di cabang yang sama.

## Sudah selesai di bagian 1-j-ii-b2-i (16 Oktober 2026) — Kerangka Pengaturan 4B + 18 pengaturan

CHANGELOG entri 244. 1-j-ii-b2 dipecah 2 sub-sub-sub-sesi (disetujui pemilik 16 Okt 2026): sesi ini
kerangka + 18 pengaturan BER & Umum; 1-j-ii-b2-ii menyusul = BER-L42 Jenis Pengajuan + "batas waktu
per jenis" lewat BER-L41 dengan integrasi BER-L23 (Papan Perubahan Aturan).

- **Migrasi `0016_pengaturan-umum.sql`**: `pengaturan_umum` (append-only, bertanggal, bersasaran
  cabang/jabatan; `pengumuman_lahir` + tarik belum berlaku; indeks UNIQUE parsial di
  `(kode, sasaran_jenis, COALESCE(sasaran_cabang,0), COALESCE(sasaran_jabatan,0), berlaku_dari)`
  WHERE ditarik=false) + `usul_pengaturan_umum` (isi khas usulan lewat Mesin Pengajuan).
- **Mesin murni `src/lib/pengaturan-umum.ts`** (+22 tes): `PengaturanDef`, `Sasaran` discriminated
  union, `nilaiBerlaku`/`nilaiBerlakuDenganGantung`/`nilaiBerikutnya`/`periksaTanggalBerlaku`
  (wajibDiumumkan+berubah → tanggal depan; setelan pertama boleh hari ini)/`periksaSasaran`/
  `periksaNilai`/`labelNilai`/`labelSasaran`.
- **Registri `src/lib/pengaturan-registri.ts`**: 18 pengaturan (17 modul "Perlengkapan Bersama"
  dari spec bagian 8 + 1 modul "Umum" PRI-44 butir 2 `panjang_alasan_minimal`). Semuanya jalur
  "langsung" & tidak wajib diumumkan (spec baris 613–614); `sasaranDidukung=["semua"]` saja —
  kerangka tetap bisa menerima bentuk lain dari modul yang membutuhkannya nanti.
- **Penulis bersama `terapkanPengaturanUmum()`** di `src/server/pintu/terapkan-pengaturan.ts`
  (WAJ-04): tulisan dua tahap — UPDATE baris lama di (kode, sasaran, tanggal) menjadi `ditarik=true`
  "ditimpa oleh baris baru di tanggal yang sama" (audit trail jujur) + INSERT baris baru.
- **Hook efek `usul_pengaturan_umum`** di `efek-pengajuan.ts`: salin isi khas ke
  `pengaturan_umum` saat pengajuan disetujui (pola sejajar `usul_atur_jabatan` + `usul_pengecualian`).
- **Pintu `src/server/pintu/pengaturan-umum.ts`**: `daftarPengaturan` (BER-L40, saring per hak,
  kelompokkan per modul), `rincianPengaturan`/`riwayatPengaturan` (BER-L41 langkah 1 + tab Riwayat),
  `nilaiBaru` (validasi nilai/sasaran/alasan sesuai `panjang_alasan_minimal`/tanggal/kecocokan
  perusahaan; jalur `langsung` lewat `transaksi()` + `terapkanPengaturanUmum` + `tambahJejak`;
  jalur `usul_lalu_setujui` + `wajibDiumumkan` ditolak dulu — tersambung di b2-ii), `tarikBelumBerlaku`
  (hanya nilai `berlaku_dari > hari ini`, set `ditarik=true` + jejak).
- **2 tindakan hak baru** di `hak.ts`: `ber.lihat_pengaturan` + `ber.ubah_pengaturan` (keduanya
  lingkup "semua"; Pemilik/GM lewat akses penuh, tanpa benih baris hak_jabatan).
- **Layar**: `/pengaturan` (BER-L40, `PengaturanDaftar.tsx` klien + cari + kartu per pengaturan,
  dikelompokkan per modul) + `/pengaturan/[kode]` (BER-L41, `page.tsx` + `aksi.ts` server actions
  + `PengaturanUbah.tsx` klien dengan mode lihat/ubah/riwayat/tarik; 3 langkah ubah + Jendela-
  Konfirmasi; TombolTahan 3 detik untuk Tarik; `PenandaLangkah` + `PesanBerhasil`). Beranda:
  tautan "Pengaturan" untuk pemegang `ber.lihat_pengaturan`.
- **Benih `benihPengaturanUmum`**: 18 pengaturan diisi dengan `nilaiAwal` masing-masing, sasaran
  "semua", `berlaku_dari = 2026-01-01`, alasan "isi awal (benih tempat uji)"; idempoten lewat
  SELECT sebelum INSERT.
- **Keluar lingkup 1-j-ii-b2-i → 1-j-ii-b2-ii**: BER-L42 Jenis Pengajuan (layar + pintu + ubah
  penyetuju/pemeriksa/pelihat/batas waktu); "batas waktu per jenis pengajuan" sebagai pengaturan
  ber-tanda `wajibDiumumkan=true` → menyalakan integrasi BER-L23 (membuka pengumuman dengan
  "sebelumnya"/"sekarang" terisi) + "pengumuman yang lahir dari pengaturan ikut ditarik".
- Diuji: `npm run cek` (184 tes, +22 dari 1-j-ii-b1) & `npm run build` lulus (2 route baru:
  `/pengaturan`, `/pengaturan/[kode]`). Docker PG + sesi sungguhan belum di sesi ini (Docker tidak
  tersedia di perangkat); migrasi 0016 + benih 18 pengaturan diterapkan ke Supabase saat cabang
  di-push.
- **Sudah di-push & digabung ke `main` lewat PR #15** (16 Okt 2026, merge commit `08dffb3`):
  cabang `pengamatan-sistem-1j-i` menyatu di `main`. 1-j-ii-b2-ii (BER-L42 Jenis Pengajuan)
  dibangun di cabang baru dari `main`.

## Sudah selesai di bagian 1-j-ii-b2-ii-a (18 Oktober 2026) — Layar Jenis Pengajuan (BER-L42)

CHANGELOG entri 245. 1-j-ii-b2-ii dipecah 2 sesi (disetujui pemilik 18 Okt 2026): **Bagian A**
(sesi ini) layar BER-L42 + ubah PERAN; **Bagian B** menyusul = "batas waktu per jenis" sebagai
pengaturan wajib-diumumkan + integrasi BER-L23. Alasan pecah: Bagian B menyentuh aturan uang
(PRI-35) dan jalur yang sengaja setengah di `pengaturan-umum.ts` — lebih aman terfokus.

- **Mesin murni `src/lib/jenis-pengajuan.ts`** (+9 tes, WAJ-06): `periksaPeranJenis` (penyetuju
  wajib; pemeriksa ≠ penyetuju; pelihat tambahan boleh sama), `labelAkibatTerlewat`, `labelBatasHari`.
- **Pintu `src/server/pintu/jenis-pengajuan.ts`**: `daftarJenisPengajuan` (semua jenis + nama
  jabatan peran + batas/lampiran/lencana), `jabatanUntukPeran`, `ubahPeranJenis` (langsung +
  `tambahJejak` per kolom; cek jabatan milik perusahaan & aktif; Lihat sebagai ditolak),
  `konteksJenisPengajuan`. **Tanpa migrasi** (tabel `jenis_pengajuan` sudah ada sejak 0005).
- **2 tindakan hak baru** di `hak.ts` (modul Perlengkapan Bersama): `ber.lihat_jenis_pengajuan` +
  `ber.ubah_jenis_pengajuan` (lingkup "semua"; Pemilik/GM lewat akses penuh, tanpa benih baris hak).
- **Layar** `/pengaturan/jenis-pengajuan` (BER-L42): `page.tsx` + `JenisPengajuanKelola.tsx` (kartu
  per jenis + form "Ubah peran" `Pilih` penyetuju/pemeriksa/pelihat) + `aksi.ts`. Beranda: tautan
  "Jenis Pengajuan" untuk pemegang `ber.lihat_jenis_pengajuan`, di bawah "Pengaturan".
- **TITIPAN**: larangan "penyetuju = satu-satunya pengaju" menanti model "siapa boleh mengajukan
  jenis X" (per-jenis hak `ajukan`) di modul jenisnya. Batas waktu → Bagian B.
- Diuji: `npm run cek` (193 tes, +9) & `npm run build` lulus (1 route baru). Docker PG + sesi
  sungguhan belum (Docker tidak tersedia); perubahan hanya tabel yang sudah ada — tanpa migrasi/benih.
- **Belum di-push** (push oleh pemilik): cabang baru untuk 1-j (lahir dari `main` sesudah PR #15).
  Bagian B (1-j-ii-b2-ii-b) menyusul di cabang yang sama; satu PR berisi seluruh 1-j.

## Sudah selesai di bagian 1-j-ii-b2-ii-b1 (18 Oktober 2026) — Batas waktu per jenis bertanggal

CHANGELOG entri 246. 1-j-ii-b2-ii-b dipecah 2 sub-sesi (disetujui pemilik 18 Okt 2026): **B-1**
(sesi ini) = penyimpanan + mesin + layar; **B-2** menyusul = integrasi Papan Perubahan Aturan.

- **Migrasi `0017_jadwal-batas-jenis.sql`**: tabel `jadwal_batas_jenis` (append-only, bertanggal, per
  jenis; nilai majemuk `batas_hari`+`akibat_terlewat`; `pengumuman_lahir` untuk B-2; tarik; CHECK
  "tidak ada batas → akibat tidak_ada"; indeks UNIQUE parsial `(jenis, berlaku_dari) WHERE
  ditarik=false`). Nilai SEDANG berlaku tetap di `jenis_pengajuan` (0005) — cara modul jenisnya
  membaca batas tidak berubah (WAJ-13).
- **Mesin murni `src/lib/batas-jenis.ts`** (+12 tes): `batasBerlaku`, `batasBerikutnya`, `batasSama`,
  `periksaNilaiBatas`.
- **Penulis bersama `terapkanBatasJenis`** di `terapkan-pengaturan.ts` (WAJ-04): pindahkan jadwal
  jatuh tempo ke `jenis_pengajuan` + jejak per kolom, hanya kalau beda (idempoten). Dipakai pintu
  (langsung) & mesin.
- **Mesin terjadwal `terapkan_batas_jenis_terjadwal`** (`kerja/terapkan-batas-jenis.ts`, di registri →
  8 mesin; benih `mesin_otomatis` harian 00.05).
- **Pintu `jenis-pengajuan.ts`**: `ubahBatasJenis` (bertanggal, wajib-diumumkan → tanggal depan; nilai
  sama ditolak; jalur "tidak perlu diumumkan dengan alasan" PRI-35 butir 2 untuk sementara),
  `riwayatBatasJenis`, `tarikBatasBelumBerlaku` (WAJ-11), + `batasBerikutnya` di `daftarJenisPengajuan`.
  Pakai hak `ber.ubah_jenis_pengajuan` yang sudah ada. `panjangAlasanMinimal` diekspor dari pintu
  `pengaturan-umum.ts` (WAJ-04).
- **Layar** `/pengaturan/jenis-pengajuan`: tombol "Ubah batas waktu" + "batas berikutnya" per kartu;
  form langkah baku (nilai → tanggal+alasan → periksa) + Riwayat + Tarik (TombolTahan 3 detik).
- **Keluar lingkup → B-2**: langkah "Pengumuman" membuka BER-L23 terisi + `pengumuman_lahir` dua
  arah + "tarik pengaturan ↔ tarik pengumuman saling membatalkan" (PRI-40 butir 2).
- Diuji: `npm run cek` (205 tes, +12) & `npm run build` lulus. Docker PG + sesi sungguhan belum
  (Docker tidak tersedia di perangkat); migrasi 0017 + mesin ke-8 di benih diterapkan ke Supabase
  saat cabang di-push.
- **Belum di-push** (push oleh pemilik): cabang 1-j yang sama (memuat 1-j-ii-b2-ii-a + b2-ii-b1).
  B-2 menyusul di cabang yang sama; satu PR berisi seluruh 1-j.

## Sudah selesai di bagian 1-k-i (19 Oktober 2026) — Ganti akun contoh + bilah TEMPAT UJI lengkap + pagar lingkungan

CHANGELOG entri 248. Mulai bagian terakhir Langkah 1 (1-k Alat tempat uji; dipecah 4 sesi, disetujui
pemilik 19 Okt 2026). **Keputusan pemilik 19 Okt 2026 (penyesuaian sesudah beku):** spec menulis
"Ganti akun contoh berlaku per jendela browser"; karena sesi memakai cookie (dipakai bersama semua
jendela satu profil), itu diganti cara sederhana — untuk dua jabatan berdampingan buka jendela
Penyamaran/Incognito (cookie sendiri). Ganti akun = seperti **Lihat sebagai** tetapi **boleh
menulis** (KAR-52); akun asli tetap di bawah supaya [Ganti akun] selalu bisa dipakai lagi.

- **Pagar lingkungan `src/server/lingkungan.ts`** (`tempatUjiAktif()`): satu tempat (WAJ-04), rumus
  murni sama dengan bilah (`perluBilahTempatUji`). Pagar "asli" bersifat **build-time** (setel
  `NEXT_PUBLIC_LINGKUNGAN=asli` saat build — sama seperti bilah TEMPAT UJI yang sudah ada).
- **Tindakan hak `ber.tempat_uji`** (`src/lib/hak.ts`; Pemilik/GM lewat akses penuh, tanpa benih).
- **Persona di `src/server/hak/periksa.ts`**: cookie `akun_contoh` (id orang). Keadaan AKUN ASLI
  selalu dihitung → `bolehTempatUji` (ganti akun tetap bisa walau jadi persona rendah spt Kasir).
  Saat persona aktif: orang efektif = persona, `lihatSaja=false` (boleh bertindak), `orangAsli`/
  `akun` tetap asli. Field baru `Pemakai`: `akunContohUji`, `bolehTempatUji`.
- **Murni `src/lib/akun-contoh.ts`** (+3 tes) `kelompokkanAkunContoh`; **pintu
  `src/server/pintu/akun-contoh.ts`** (daftar + ganti + kembali, dijaga `bolehTempatUji`). TANPA
  migrasi/benih (pakai tabel orang/akun/riwayat_penempatan/jabatan/cabang).
- **Layar** `/tempat-uji/ganti-akun` (BER-L51) + stub `/tempat-uji` (BER-L50 Papan uji, WAJ-11).
  **Bilah lengkap**: `src/komponen/BilahTempatUji.tsx` presentasional + `src/app/BilahTempatUjiAktif.tsx`
  (server) + layout memasang di `<Suspense>` hanya kalau di tempat uji.
- Diuji: `npm run cek` (212 tes, +4) & `npm run build` lulus (2 route baru); `next start` uji-asap
  (`/`, `/tempat-uji`, `/tempat-uji/ganti-akun` → 200). Docker PG + sesi sungguhan tidak dijalankan
  (perubahan hanya tabel yang sudah ada; tanpa migrasi/benih baru ke Supabase).
- **Sudah di-push lewat PR #17** (19 Okt 2026): cabang `alat-tempat-uji-1k` (memuat seluruh 1-k:
  1-k-i s.d. 1-k-iv), digabung ke `main` lewat PR #17 (merge `b74ab52`).

## Sudah selesai di bagian 1-k-ii-a (19 Oktober 2026) — Papan uji: Kembalikan data contoh + Versi + benih satu tempat

CHANGELOG entri 249. 1-k-ii dipecah 2 sub-sesi (disetujui pemilik 19 Okt 2026): **a** (sesi ini) =
Kembalikan data contoh + Versi + pindah rumus benih; **b** menyusul = "Yang perlu dicoba". Keputusan
pemilik 19 Okt 2026: "Yang perlu dicoba" nanti diisi daftar awal dari Kejadian di lapangan Langkah 1;
"Versi" ditampilkan sebagian sekarang (sistem asli belum ada, Masa A).

- **Rumus benih dipindah ke `src/server/benih-inti.ts` (WAJ-04)**: seluruh isi benih (dasar, akun,
  hak, jenis, pengaturan jabatan, pekerja lepas, catatan rilis, mesin, pengaturan umum) jadi SATU
  sumber, dipakai bersama skrip baris perintah DAN "Kembalikan data contoh". Fungsi menerima
  `PenjalanKueri` (bentuk sama `kueriT`/`pg.Client.query`); tak mengurus transaksi sendiri.
  `scripts/benih.mts` jadi tipis (sambung DB + `isiSemuaBenih` dalam satu transaksi). Hasil benih tak
  berubah (diuji identik + idempoten).
- **Pintu `src/server/pintu/tempat-uji.ts`**: `kembalikanDataContoh(ketikan)` — pagar berlapis
  (`tempatUjiAktif` build-time + `bolehTempatUji` akun asli + kata KEMBALIKAN persis), lalu satu
  transaksi: enumerasi `pg_tables` publik kecuali `_migrasi` → `TRUNCATE ... RESTART IDENTITY CASCADE`
  → `isiSemuaBenih`. Sesi/persona ikut terhapus → pemakai keluar otomatis; cookie sesi/persona/lihat
  dibersihkan. `infoVersi()` — versi data = catatan rilis terbaru; sistem asli "belum ada (Masa B)".
- **Layar** `/tempat-uji` (BER-L50): stub 1-k-i diganti Papan uji — Versi + Kembalikan data contoh
  (`KembalikanForm.tsx` klien: Isian KEMBALIKAN → tombol bahaya saat cocok → JendelaKonfirmasi →
  PesanBerhasil "Masuk lagi") + tautan Ganti akun contoh + catatan "menyusul" (WAJ-11). `aksi.ts`
  server action tipis. **Tanpa migrasi/benih baru** (tabel yang sudah ada).
- Diuji: `npm run cek` (212 tes) & `npm run build` lulus. **Docker PG 16** — 17 migrasi + benih
  refactor identik + idempoten; inti "kembalikan" dibuktikan (3 sesi kotor + data uji → sesudah
  TRUNCATE + isiSemuaBenih kembali ke baseline: sesi/error 0; akun 8, hak 41, jenis 6, mesin 8,
  orang 10, pengaturan 18) dalam satu transaksi. **Tanpa langkah manual Supabase** (tak ada
  migrasi/benih baru).
- **Sudah di-push lewat PR #17** (19 Okt 2026): cabang `alat-tempat-uji-1k`, digabung ke `main` lewat PR #17
  (merge `b74ab52`).

## Sudah selesai di bagian 1-k-ii-b (19 Oktober 2026) — Papan uji: "Yang perlu dicoba"

CHANGELOG entri 250. Sub-sesi terakhir 1-k-ii. **Keputusan pemilik 19 Okt 2026:** daftar diisi
SEMUA kejadian kedua spec Langkah 1 (38 Karyawan dan Akses + 41 Perlengkapan Bersama = 79),
dikelompokkan per sumber, tiap baris berlabel "sumber #nomor · aturan". Kejadian yang modulnya
belum dibangun (Kehadiran/Gaji/Laporan Kasir) tetap tercantum — dilewati/ditandai belum sesuai
sampai modulnya ada; daftar tak perlu diubah saat modul baru jadi.

- **Migrasi `0018_daftar-periksa-uji.sql`**: tabel `daftar_periksa_uji` (bentuk sesuai spec bagian 4:
  rilis, sumber, nomor, kejadian, sistem_berbuat, aturan, hasil, catatan, oleh, ditandai_pada).
  **Hanya dipakai di tempat uji** — struktur dibuat migrasi tetapi di sistem asli tabel tetap kosong
  (tak ada alat pengisinya; layarnya dipagari `tempatUjiAktif`). PRI-31/14, SIS-37, hanya menambah.
- **Data `src/lib/daftar-periksa-uji.ts` (murni, WAJ-04)**: 79 kejadian ditranskrip verbatim dari
  tabel "Kejadian di lapangan" kedua spec + helper `ringkasPeriksaUji`. Tes (+6).
- **Benih**: `benihDaftarPeriksaUji` ikut `isiSemuaBenih` (`benih-inti.ts`), idempoten lewat
  ON CONFLICT `(perusahaan, rilis, sumber, nomor)` — hasil/catatan yang sudah ditandai tak ditimpa.
  Karena ikut `isiSemuaBenih`, "Kembalikan data contoh" otomatis mengisi ulang (progres uji ikut nol).
- **Pintu `tempat-uji.ts`**: `daftarPeriksaUji()` (baca + kelompokkan + ringkasan) &
  `tandaiPeriksaUji(id, hasil, catatan)` (dipagari tempat uji + akun asli berhak; "oleh" dari
  `orangAsli`; `ditandai_pada` dikosongkan saat kembali belum_dicoba).
- **Layar**: sub-layar `/tempat-uji/yang-perlu-dicoba` (komponen klien `YangPerluDicoba`: ringkasan +
  saring + kartu per baris Sesuai/Belum sesuai/Hapus tanda + catatan; optimistis → server +
  `revalidatePath`). Papan uji `/tempat-uji` dapat bagian "Yang perlu dicoba" (ringkasan + tombol
  "Buka daftar periksa"). `aksi.ts` server action tipis.
- Diuji: `npm run cek` (218 tes, +6) & `npm run build` lulus (route baru). **Docker PG 16** — 18
  migrasi bersih + benih mengisi 79 baris + idempoten; UPDATE tandai (hasil/catatan/oleh/jam); CHECK
  menolak hasil ngawur; siklus kembalikan (TRUNCATE CASCADE + isiSemuaBenih) → 79 baris semua
  belum_dicoba tanpa catatan.
- **Sudah di-push lewat PR #17** (19 Okt 2026): cabang `alat-tempat-uji-1k`, digabung ke `main` lewat PR #17
  (merge `b74ab52`). **Langkah manual pemilik di Supabase sesudah gabung:** terapkan
  `0018_daftar-periksa-uji.sql` lalu `BENIH_TEMPAT_UJI=ya npm run benih`.

## Sudah selesai di bagian 1-k-iii (19 Oktober 2026) — Jam uji

CHANGELOG entri 251. Sesi ke-3 dari 4 di 1-k. **Keputusan pemilik 19 Okt 2026 (pilihan "ringkas",
disarankan):** jam uji menjangkau lewat **mesin terjadwal** (yang sudah menerima "jam server"
sebagai bahan) dan tanda **"Baru"** — keduanya ikut maju; layar baca yang menghitung "hari ini"
langsung di SQL tetap pakai tanggal server sungguhan untuk sekarang (jangkauan penuh ke semua SQL
menyusul bila modul Kehadiran/Gaji membutuhkannya). Memenuhi kedua uji jam uji di peta jalan.

- **Migrasi `0019_jam-uji.sql`**: tabel `jam_uji` (PK `perusahaan`, `offset_detik bigint` = selisih
  jam uji dalam detik, `diubah_oleh`/`diubah_pada`). "Hanya maju" dijaga DB: `CHECK (offset_detik >=
  0)`. HANYA tempat uji; di sistem asli tetap kosong (tak pernah dibaca). Hanya menambah, tanpa trigger.
- **Jam server terpusat `src/server/jam.ts` (WAJ-04)**: `offsetJamUjiDetik()`, `jamServer()` (=
  jam sungguhan + selisih), `labelJamUjiBilah()`. Di sistem asli selalu jam sungguhan tanpa menyentuh
  DB; gagal baca → jatuh ke 0 (jam uji kemudahan uji, tak boleh menjatuhkan halaman biasa).
- **Bagian murni `src/lib/jam-uji.ts` (+8 tes)**: `offsetDariTarget`, `jamUjiBerjalan`, `bolehMaju`
  (hanya maju), `labelJamUji` ("26 November 2026 08.00", WIB).
- **Mesin terjadwal ikut jam uji**: `src/server/mesin/jalankan.ts` memberi KERJA mesin `jamServer()`
  sebagai "sekarang"; baris `riwayat_jalan_mesin` (mulai/selesai) tetap jam SUNGGUHAN (catatan jujur
  untuk Kesehatan Mesin). Tanda "Baru" (`src/server/pintu/rilis.ts`) memakai `jamServer()`.
- **Pintu `tempat-uji.ts`**: `infoJamUji()`, `majukanJamUji(targetISO)` (pagar tempat uji + akun asli
  berhak + validasi hanya-maju + upsert satu-baris + `susulMesinTerlewati` menjalankan semua mesin
  sekali berurutan, idempoten tak dobel), `kembaliJamSekarang()` (offset 0). "Kembalikan data contoh"
  mengosongkan `jam_uji` → jam otomatis normal.
- **Layar** `/tempat-uji` dapat bagian Jam uji (`JamUjiForm.tsx` klien: pemilih `datetime-local`
  hanya-maju → konfirmasi → jumlah disusul; "Kembali ke jam sekarang"). Bilah menampilkan "jam uji:
  …" untuk semua pemakai saat dimajukan. `aksi.ts` tipis (`revalidatePath("/", "layout")`).
- Diuji: `npm run cek` (226 tes, +8) & `npm run build` lulus. **Docker PG 16** — 19 migrasi bersih;
  upsert jam uji terbukti satu-baris (maju → maju lagi → kembali 0, tak dobel); CHECK menolak offset
  negatif. Logika tanggal mesin sudah teruji satuan dengan jam palsu.
- **Sudah di-push lewat PR #17** (19 Okt 2026): cabang `alat-tempat-uji-1k`, digabung ke `main` lewat PR #17
  (merge `b74ab52`). **Langkah manual pemilik di Supabase sesudah gabung:** (selain 0018 + benih)
  terapkan `0019_jam-uji.sql` — tanpa benih baru (tabel sengaja kosong).

## Sudah selesai di bagian 1-k-iv (19 Oktober 2026) — Tamu uji (bagian terakhir 1-k & Langkah 1)

CHANGELOG entri 252. Sesi ke-4 (terakhir) dari 1-k. **Dengan ini seluruh 1-k SELESAI secara kode,
dan Langkah 1 (bagian 1-a s.d. 1-k) UTUH.** **Keputusan pemilik 19 Okt 2026 (ditanya sebelum mulai,
KER-13/14; kedua saran dipilih):** (1) tamu = **pengunjung biasa tanpa jabatan** (hanya melihat yang
terbuka untuk semua; tak bisa mengelola / tak bisa alat tempat uji); (2) email & sandi **dibuatkan
otomatis, ditampilkan sekali**.

- **Migrasi `0020_akun-tamu-uji.sql`**: tabel `akun_tamu_uji` (akun, dibuat_oleh, berakhir). HANYA
  dipakai di tempat uji — di sistem asli pintu pembuatnya dipagari `tempatUjiAktif` palsu, jadi
  tabel tetap KOSONG. PRI-31/14, SIS-37; hanya menambah.
- **Bagian murni `src/lib/tamu-uji.ts` (+8 tes)**: `hitungBerakhir` (jam server + N hari; nilai tak
  masuk akal jatuh ke 7), `sudahBerakhir`, `emailTamu` (domain contoh `uji.test`), `labelBerakhir`.
- **Pembuangan terpusat `src/server/tamu-uji.ts` (WAJ-04)**: `hapusTamuBerakhir` (mesin Pembersih) +
  `hapusTamuSatu` (Cabut) berbagi `hapusSet` yang menghapus TERURUT (kunci asing tabel lama bukan
  CASCADE): sesi + kredensial → akun → orang + baris anak (pemberitahuan/perlu-perhatian/pengingat/
  baca pengumuman, yang bisa menempel karena pengumuman "semua" menyasar tiap orang aktif).
  `riwayat_masuk` tak dihapus, hanya dilepas (akun → NULL).
- **Mesin Pembersih diperluas** (`pembersih-error.ts`; kode tetap `pembersih_error_lewat_12_bulan`,
  nama benih jadi "Pembersih (error > 12 bulan + tamu uji kedaluwarsa)"): ikut memanggil
  `hapusTamuBerakhir` memakai `sekarang` yang ikut jam uji. Tanpa mesin baru (spec: satu "Pembersih").
- **"Berakhir sendiri" (kejadian #39)**: `cobaMasuk` (`masuk.ts`) menolak login akun tamu yang
  `berakhir <= jamServer()` — sebelum Pembersih menghapus; dicatat di `riwayat_masuk`.
- **Pintu `tempat-uji.ts`**: `daftarTamuUji`, `buatTamuUji` (satu transaksi: orang tanpa penempatan
  + akun aktif + baris tamu; masa dari pengaturan `masa_akun_tamu_uji` isi awal 7, bertanggal jam
  uji; email token acak + sandi acak scrypt, sandi mentah hanya dikembalikan sekali), `cabutTamuUji`.
  Dijaga `pakaiAlatUji` (tempat uji + akun asli Pemilik/GM). Tamu bukan Pemilik/GM → `bolehTempatUji`
  palsu → H17 otomatis terjaga. **Ganti akun contoh (BER-L51) mengecualikan akun tamu**.
- **Layar** `/tempat-uji` dapat bagian **Tamu uji** (`TamuUjiForm.tsx` klien: Buat tamu → kotak
  kredensial sekali-tampil + Salin; daftar tamu + status berakhir + Cabut berkonfirmasi). `aksi.ts`
  tipis (`revalidatePath("/tempat-uji")`).
- Diuji: `npm run cek` (234 tes, +8) & `npm run build` lulus. **Docker PG 16** — 20 migrasi bersih +
  benih penuh; siklus tamu dibuktikan di PostgreSQL sungguhan: tamu berakhir dibuang UTUH tanpa
  pelanggaran kunci asing (orang + akun + anak hilang), tamu belum-berakhir tak tersentuh,
  `riwayat_masuk` tetap dengan akun dilepas (NULL).
- **Sudah di-push lewat PR #17** (19 Okt 2026): cabang `alat-tempat-uji-1k` (satu PR seluruh 1-k),
  digabung ke `main` lewat PR #17 (merge `b74ab52`). **Langkah manual pemilik di Supabase sesudah gabung:**
  (selain 0018 + 0019 + benih) terapkan `0020_akun-tamu-uji.sql` — tanpa benih baru (tabel sengaja kosong).

## Sudah selesai di bagian 1-j-ii-b2-ii-b2 (19 Oktober 2026) — Integrasi BER-L23 (langkah terakhir B)

CHANGELOG entri 247. Menyalakan langkah "Pengumuman" yang di B-1 sengaja dimatikan. **Dengan ini
seluruh 1-j SELESAI secara kode.** TANPA migrasi (kedua kolom tautan sudah ada: `pengumuman_lahir`
di 0017, `lahir_dari_pengaturan` di 0012).

- **Penolong murni `src/lib/pengumuman.ts`** (+3 tes): `tautanPengaturan`/`uraiTautanPengaturan`
  (+ `TABEL_BATAS_JENIS`) merakit/mengurai tautan "<nama_tabel>:<id>"; bentuk salah → null.
- **Penyisip bersama `sisipPengumumanAturan`** di pintu `pengumuman.ts` (WAJ-04): satu tempat
  INSERT pengumuman aturan langsung + sasaran; dipakai `tulisPerubahanAturan` (di-refaktor) & pintu
  Jenis Pengajuan. Mengisi `lahir_dari_pengaturan`.
- **`ubahBatasJenis` (jenis-pengajuan.ts)** diperluas parameter `pengumuman`:
  `{ umumkan:false }` (jalur B-1, tercatat beralasan) atau `{ umumkan:true, … }` (buka BER-L23).
  Diumumkan: validasi judul/isi/sasaran + `periksaDuaTanggal` (tanggal berlaku pengumuman DIKUNCI =
  `berlakuDari` batas, jarak 7/1 hari); satu transaksi tulis jadwal → sisip pengumuman → set
  `pengumuman_lahir`. Selalu jalur langsung (pengubah batas selalu Pemilik/GM).
- **Tarik dua arah (PRI-40 butir 2)**: `tarikBatasBelumBerlaku` ikut menarik pengumumannya;
  `tarikPengumuman` (dibungkus transaksi) mengurai `lahir_dari_pengaturan` + ikut menarik perubahan
  batasnya + `tambahJejak`. Tiap arah UPDATE langsung ke tabel lawan (tanpa panggil balik) → tak
  melingkar.
- **Layar** `/pengaturan/jenis-pengajuan`: form "Ubah batas waktu" jadi **4 langkah** (langkah 3
  Pengumuman: umumkan/tidak; kalau umumkan: judul + sebelumnya/sekarang terisi + tanya-ke-siapa +
  sifat + menyangkut-uang + tanggal terbit + sasaran semua/cabang/jabatan; langkah 4 Periksa memuat
  ringkasan pengumuman).
- Diuji: `npm run cek` (208 tes, +3) & `npm run build` lulus. **Docker PG 16 tersedia kali ini** —
  17 migrasi bersih + tiga skenario tautan diuji di PostgreSQL sungguhan: (S1) tautan dua arah
  terpasang; (S2) tarik batas → pengumuman "ditarik"; (S3) tarik pengumuman → batas "ditarik".
  Tanpa migrasi/benih baru ke Supabase.
- **Sudah di-push & digabung ke `main` lewat PR #16** (19 Okt 2026, merge commit `66a44b5`):
  cabang **`jenis-pengajuan-1j-ii-b2-ii`** (lahir dari `main` sesudah PR #15) menyatu di `main`.
  Memuat b2-ii-a + b2-ii-b1 + b2-ii-b2 saja (1-j-i s.d. b2-i sudah masuk `main` lewat PR #15).
  CI hijau (Pagar mutu, Database dari migrasi, Cek CHANGELOG); Vercel merah = akun GitHub commit
  belum tertaut (tidak menghalangi, penyebab lama). **Dengan ini seluruh 1-j SELESAI dan di `main`.**
  **Langkah manual pemilik di Supabase tempat uji sesudah PR #16:** terapkan migrasi
  `0017_jadwal-batas-jenis.sql` lalu `BENIH_TEMPAT_UJI=ya npm run benih` (idempoten; menambah mesin
  ke-8 `terapkan_batas_jenis_terjadwal`). Berikutnya: **1-k** (Alat tempat uji), bagian terakhir Langkah 1.

## Sudah di-push & digabung ke `main` (16 Okt 2026)

Cabang `pengamatan-sistem-1j-i` (memuat semua 1-j-i + 1-j-ii-a + 1-j-ii-b1 + 1-j-ii-b2-i)
di-push dan digabung lewat **PR #15** (`gh pr merge 15 --merge`). CI hijau (pagar mutu,
database dari migrasi, cek CHANGELOG); Vercel Preview merah karena akun GitHub commit belum
tertaut (tidak menghalangi deploy dari `main`). Cabang lokal `pengamatan-sistem-1j-i` sudah
menyatu di `main`; boleh dihapus kalau mau rapi.

| Cabang (menyatu di PR #15) | Isi | CHANGELOG |
|---|---|---|
| `pengamatan-sistem-1j-i` (potret 1-j-i) | 1-j-i Pengamatan: Kesehatan Mesin + Riwayat Error + Jejak Perubahan | 241 |
| (lanjutan di cabang yang sama) | 1-j-ii-a Infra mesin terjadwal + 3 kerja mesin + "Jalankan sekarang" | 242 |
| (lanjutan di cabang yang sama) | 1-j-ii-b1 4 mesin terjadwal sisa + `tambahJejak()` ke 5 pintu | 243 |
| (lanjutan di cabang yang sama) | 1-j-ii-b2-i Kerangka Pengaturan 4B BER-L40/L41 + 18 pengaturan | 244 |

**Langkah manual pemilik di Supabase tempat uji sesudah PR ini digabung:**
1. Terapkan migrasi `0014_sistem-kesehatan-error-jejak.sql`, `0015_mesin-terjadwal.sql`, dan
   `0016_pengaturan-umum.sql` (urut).
2. Jalankan `BENIH_TEMPAT_UJI=ya npm run benih` — idempoten; menambah 7 mesin otomatis + 3
   jenis_tanda baru (`pengumuman_terbit`, `tinjauan_pengecualian`, `tinjauan_pengecualian_h7`)
   + 18 pengaturan isi awal. Tidak mengubah data lama.

**Sudah beres (14 Oktober 2026, sesudah 1-a, atas permintaan pemilik — CHANGELOG 224):**
- ✅ **Sambungan DB aman (verify-full):** CA Supabase diperoleh dari rantai TLS + dibuktikan sah,
  disimpan di `db/supabase-ca.crt` (sertifikat publik). Penolong `scripts/koneksi.mts` dipakai
  migrasi & benih: verify-full untuk Supabase, tanpa SSL untuk lokal/CI. `.env.local` tidak lagi
  memakai `sslmode=no-verify`.
- ✅ **Migrasi 0001 + data contoh terpasang di Supabase tempat uji** (9 tabel, 8 orang contoh;
  uji negatif CA salah ditolak).

**Masih terbuka:**
- ✅ **`DATABASE_URL` di Vercel SUDAH terpasang** (dibuktikan 15 Okt 2026: masuk sebagai akun GM
  contoh di `hris-v3-blue.vercel.app` berhasil setelah PR #13 digabung + migrasi/benih ke Supabase).
- ⏳ **TODO keamanan pemilik:** reset sandi database Supabase (ditunda pemilik; `.env.local` sudah
  berfungsi, jadi tidak menghalangi). Setelah direset, perbarui `.env.local` DAN env Vercel.
- ⏳ **Preview deploy Vercel "Blocked":** akun GitHub commit belum tertaut ke Vercel ("Fix Git
  Configuration"). Hanya memblok Preview per-PR; deploy Production (dari `main`) tetap jalan.

Catatan: sejak 1-b-ii, `hris-v3-blue.vercel.app` menampilkan layar Masuk (bukan kerangka lagi)
setelah deploy. Masuk dengan salah satu akun contoh (sandi `coba12345`) untuk mencoba tiap peran.

### Sudah selesai di bagian 1B-ii (14 Oktober 2026) — Pondasi bagian 1 utuh

- **Kerangka migrasi database** (WAJ-02): berkas `.sql` bernomor di `db/migrasi/`, aturan
  nama/urutan/nomor-kembar sebagai fungsi murni `src/lib/migrasi.ts` + tes, penjalan
  `scripts/migrasi.mts` (driver `pg`, polos & portabel SIS-37; tabel catatan `_migrasi`,
  idempoten, menolak migrasi yang isinya berubah). Belum ada tabel bisnis (milik Langkah 1).
- **Cek CHANGELOG** otomatis (WAJ-08): `scripts/cek-changelog.mts`.
- **CI GitHub Actions** (`.github/workflows/ci.yml`): `npm run cek` + cek CHANGELOG + bangun
  database dari migrasi di PostgreSQL sementara, jalan di tiap PR ke `main`.
- Perintah baru: `npm run migrasi`, `migrasi:cek` (ikut `npm run cek`), `changelog:cek`.
- Diuji lokal di PostgreSQL Docker; `npm run cek` (16 tes) & `npm run build` lulus.
- Lihat CHANGELOG entri 221. **Catatan:** CI belum bisa jadi *required check* yang memaksa
  sampai kunci `main` server-side ada (di bawah).

### Sudah selesai di bagian 1B-i (14 Oktober 2026)

Kerangka **Next.js 16.4 + React 19.3 + TypeScript 5.9** (versi dikunci di `package.json`),
struktur folder `src/` sesuai `docs/teknis.md` (`server/pintu`, `server/hak`, `modul`,
`komponen`, `lib`), contoh rumus `src/lib/uang.ts` (PRI-28) + tes (WAJ-06), dan pagar mutu
di komputer: `npm run cek` (typecheck + ESLint + Prettier + Vitest) serta `npm run build`
semua lulus. Lihat CHANGELOG entri 220.

## Kunci `main` (WAJ-01) — keputusan: Pilihan C (pagar lokal)

GitHub gratis tidak mengizinkan kunci cabang di repo privat (repo lain pemilik "bisa" karena
**publik**). Pemilik memilih lanjut tanpa biaya: pagar lokal `.githooks/pre-push` menolak push
langsung ke `main`; aktif setelah `git config core.hooksPath .githooks` (sudah dijalankan di
komputer ini). **Batas:** bisa dilewati sengaja, hanya di komputer ini.

**Belum tuntas — pasang kunci server-side yang sesungguhnya begitu bisa:**
- Jalur gratis: pindah repo ke organisasi `hammielionpetshop` **kalau** paketnya GitHub Team
  (tanya dev — belum dijawab). Lalu aktifkan ruleset "require pull request" + required-checks.
- Jalur berbayar: GitHub Pro ~US$4/bulan di akun pribadi.
- Paling lambat: dipasang di VPS saat Masa B.
Sampai itu, CI required-checks (bagian 1B) belum bisa dipaksakan di `main`.

Sesudah bagian 1 utuh, lanjut bagian 2 (tempat uji: Supabase + Vercel + bilah "TEMPAT UJI")
di `docs/work/plans/2026-10-13-tempat-uji-dan-alur-rilis.md` bagian 9.

Catatan: akun **Supabase** dan **Vercel** sudah dimiliki pemilik (dipakai mulai bagian 2).
Arsip riwayat lengkap Tahap 0 sampai 5B: `../bangun-ulang-sistem-hris/docs/work/WIP.md`.

## Titipan terbuka (tidak menghalangi)

- Bentuk file export produk dan laporan pajak: jangan ditanyakan.
- File contoh kasir, daftar tempat uang, saldo awal: dikumpulkan pemilik nanti.
- Tanggal 26 untuk pindah: dipilih di Tahap 6.
