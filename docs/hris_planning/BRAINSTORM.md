# HRIS — Catatan Brainstorm

Tempat mengumpulkan pecahan requirement dan hasil diskusi HRIS sebelum dirakit menjadi PRD.
Ini **bukan** dokumen status (status tetap di `docs/work/WIP.md` & `docs/agents/claims.md`).

**Cara pakai**
- Tiap butir diberi tanda:
  - ✅ **diputuskan owner** (di percakapan ini)
  - 📘 **mengikuti aturan v3**: sudah diputuskan pemilik di dokumen `reference_docs/` dan berlaku tanpa didiskusikan ulang (lihat butir "Prinsip v3" di bagian 1)
  - 💡 **usulan** (belum disetujui)
  - ❓ **terbuka** (perlu jawaban)
- Keputusan baru ditulis dengan tanggal. Butir yang berubah **dicoret dan diberi alasan**, bukan dihapus.
- Kalau sebuah butir sudah ✅ atau 📘, jangan ditanyakan ulang ke owner.
- Nomor aturan (KEH-, GAJ-, KAR-, DRV-, SIS-) merujuk ke buku aturan di `reference_docs/docs/aturan/`.

---

## 1. Tujuan & Prioritas

- ✅ (2026-10-29) Rencana dua app baru: **HRIS** dan **Keuangan**, masing-masing app terpisah di monorepo ini (seperti `backoffice` / `order-web`).
- ✅ (2026-10-29) **HRIS didahulukan.** Yang paling mendesak: **Absensi** dan **Penggajian**, karena krusial untuk operasional saat ini. Keuangan menyusul.
- ✅ (2026-10-29) **Sudah ada app HRIS lama** yang dipakai sekarang (absensi selfie). Dokumentasinya ditaruh owner di `reference_docs/` sebagai referensi untuk diadaptasi ke app baru. Daftar berkas yang relevan ada di `reference_docs/README.md`.
- (2026-10-29) Isi `reference_docs/` ternyata rancangan **HRIS v3**: rancangan ulang sistem lama dengan buku aturan, spec, dan menu yang sudah ditetapkan pemilik 11–14 Oktober 2026. Menurut `WIP.md`-nya (28 Oktober 2026), v3 **sedang dibangun di repo lain** (61 migrasi, 1.188 tes, sudah sampai modul Keuangan).
- ✅ (2026-10-29) **Kode v3 tidak dipindahkan apa adanya.** Rumusnya sudah ada, tetapi tidak konvensional dan sebagian query/logikanya tidak efisien. HRIS monorepo dibangun dari **aturan & spec v3**. Owner bisa memberi path direktori kode v3 bila perlu dijadikan pembanding.
- ✅ (2026-10-29) **Prinsip v3:** aturan v3 yang sudah jelas di dokumen **dipakai langsung tanpa diskusi ulang**. Yang dibahas hanya celah, pertentangan dengan kondisi monorepo, dan hal yang belum diatur v3 (kumpulannya di bagian 8).
- 📘 **Data lama** (SIS-23 s.d. 33): yang dibawa hanya orang (daftar ulang sendiri), pengaturan (diketik dari buku aturan), dan **sisa kasbon** per orang; riwayat absen/slip tetap di sistem lama; cuti mulai jatah penuh; sistem lama ditutup bertahap setelah slip terakhirnya dibayar.
- ❓ Apa yang kurang/bermasalah dari HRIS lama sehingga perlu app baru? (jawabannya menentukan apa yang wajib berbeda di rilis pertama)
- ✅ (2026-10-29) Pindah ke HRIS baru **pada tanggal 26** (awal periode gaji, GAJ-01).
- ✅ (2026-10-29) **Tidak ada tenggat tanggal pindah.** HRIS baru dipakai **setelah benar-benar matang**; selama pengembangan, HRIS lama tetap menjadi penunjang operasional. Pindahnya tetap di awal periode (tanggal 26) begitu sudah siap.
- ✅ (2026-10-29) **Branch:** `dev_hris` menjadi **branch utama pengembangan** seluruh app HRIS. Akan ada juga branch **staging** untuk deployment staging (alurnya diputuskan di baris bawah).
- ✅ (2026-10-29) **Masalah HRIS lama: aplikasinya tumpang tindih** — kode dan modul tercampur. Kebutuhan owner: **iterasi pengembangan cepat dengan struktur yang jelas**. Fitur yang sudah dibahas di dokumen ini dianggap cukup untuk rilis pertama.
  - Akibatnya untuk rancangan: batas modul harus tegas sejak awal — satu schema per domain (`auth`, `hris`, `logistik`), satu folder aturan per modul, modul lain hanya membaca lewat view/fungsi yang jelas (WAJ-03, 04 v3).

## 2. Keputusan Lama yang Sudah Menyentuh HRIS

Sumber: `docs/glosarium-bisnis.md` dan `docs/work/backlog/2026-10-11-daftar-tunda-owner.md` butir 3.

- ✅ (2026-10-11) HRIS dalam bayangan owner = **kepegawaian + laporan milik owner**, terpisah dari aplikasi kasir.
- ✅ (2026-10-11) **Bonus jasa** groomer (10% dari harga jual jasa **sesudah diskon**, per 1 jasa) sudah dihitung & tampil di laporan kasir; **pembayarannya kelak diurus HRIS**. Sejalan dengan GAJ-61 v3.
- ✅ (2026-10-11) **Data penjualan ke HRIS** — status: *disimpan dulu, jangan diangkat sampai owner membukanya*. Keputusan yang sudah ada:
  - diambil **semua yang ada di tab Transaksi**, apa pun asalnya;
  - tarik sekali di awal → otomatis **tiap 1 menit** → tombol **"tarik sekarang"**;
  - transaksi yang belakangan dibatalkan/dikoreksi **diberitahukan otomatis** pada tarikan berikutnya;
  - transaksi tanpa nama pelanggan ditulis **RETAIL**.
- ✅ (2026-10-29) **Semua laporan keuangan pindah ke app Keuangan**, termasuk "laporan milik owner" dan penarikan data penjualan tiap 1 menit di atas. HRIS fokus ke kepegawaian. Bonus jasa tetap **dibayarkan** lewat penggajian HRIS.

## 3. Data dari Sistem Kasir yang Dipakai HRIS

Dibaca langsung dari database kasir (schema `petshop`), menggantikan modul "Tarik Data Kasir" v3.

| Data | Tabel (`petshop`) | Dipakai untuk |
|---|---|---|
| Akun staf: nama, nomor staf, role, cabang utama | `users` | Menautkan karyawan HRIS ke kasir yang menutup shift |
| Cabang | `branches` | Daftar cabang (HRIS tetap punya data cabang sendiri: titik lokasi, radius, QR, jam kerja) |
| **Selisih kas per shift** + kasir yang bertugas | `shifts` (`total_variance`, `closed_by_id`, `closed_at`), `shift_cashier_breakdown` / `shift_cashier_sessions` (daftar kasir) | **Minus kas** di slip (GAJ-20) — ✅ lihat bagian 6. ~~Selisih per kasir~~: kolom `shift_cashier_breakdown.variance` ternyata **selalu kosong** di produksi (dicek 2026-10-29); POS hanya menghitung uang sekali per shift. |
| Groomer & pengantar | `groomers` (`is_groomer`, `is_courier`) | Menautkan nama groomer/pengantar ke karyawan HRIS (daftar ini terpisah dari `users`) |
| Jasa grooming yang sudah diambil + groomernya | baris nota jasa + `grooming_orders` | **Bonus grooming** (GAJ-61) |
| Baris ongkir + pengantarnya | `service_deliveries` | **Bonus ongkir** (LOG-42, 76) |

- 📘 Data karyawan **tidak** disalin dari kasir: semua orang mendaftar ulang di HRIS (KAR-53, SIS-24). Tabel kasir hanya ditautkan.
- 💡 Satu layar **"Pasangkan nama"**: tiap `users` kasir dan tiap `groomers` dipasangkan ke satu karyawan HRIS (v3 sudah punya konsep ini di Tarik Data Kasir).

## 4. Arsitektur & Infrastruktur (hasil diskusi 2026-10-28/29)

- ✅ App terpisah di monorepo, jalan di **VPS yang sama** (2 core, 3.6 GB RAM).
  - Perkiraan beban: +200–250 MB RAM per app Next.js; dengan WAHA dimatikan, total ~1.5–1.7 GB. **Aman.**
  - Image dibangun di GitHub Actions, bukan di VPS.
  - Pengukuran resource baru dilakukan saat jam sepi; 💡 ukur ulang saat jam ramai / pasang `pg_stat_statements`.
  - Foto absen: ±24 karyawan × 3 foto/hari × ±100 KB, dihapus setelah 60 hari (KEH-15) → paling banyak ±0,5 GB. Aman.
- 💡 Pasang batas RAM per container (`mem_limit`) supaya app baru yang bermasalah tidak menjatuhkan POS.
- 💡 Data POS **dibaca langsung dari Postgres**, bukan lewat API backoffice (lebih hemat, backoffice yang melayani kasir tidak terbebani), dengan syarat:
  - user Postgres khusus HRIS, **read-only**, hanya ke tabel `petshop` yang dibutuhkan;
  - memakai `@petshop/db` yang sama supaya perubahan schema ketahuan di typecheck;
  - rumus angka (mis. nilai bersih baris, bonus jasa) dipindah ke **package bersama**, tidak ditulis ulang, supaya angka HRIS = angka backoffice;
  - akses ke data `petshop` lewat beberapa **view** yang jelas, bukan JOIN ke tabel di mana-mana.
- 💡 Data milik HRIS sendiri disimpan terpisah dari `petshop`. Dua pilihan:

  | | Schema `hris` di `petshop_db` | Database terpisah |
  |---|---|---|
  | JOIN data POS | langsung | digabung di kode |
  | Backup | otomatis ikut | harus ditambah |
  | Restore per app | rumit (bisa ikut memutar balik POS) | bersih |
  | Pindah server nanti | harus bongkar JOIN | mudah |
  | Isolasi data gaji | hanya GRANT | GRANT + batas database |

  ~~Usulan: HRIS → database terpisah, karena data gaji paling sensitif.~~
  ✅ (2026-10-29) **Owner memilih schema terpisah** (`hris`) di database `petshop_db`, supaya HRIS bisa membaca dan membuat view dari schema `petshop`. Akibatnya, isolasi data gaji bergantung pada **GRANT**: user database backoffice tidak diberi akses ke schema `hris`, dan user HRIS hanya bisa SELECT pada tabel/view `petshop` yang dibutuhkan.
- 💡 Tidak ada foreign key dari tabel HRIS ke `petshop` (simpan id saja), supaya migrasi kedua app tidak saling mengunci.
- 💡 Migrasi HRIS: folder & config Drizzle sendiri, tabel pencatat migrasi terpisah; `pnpm migrations:check` dan kunci migrasi di `claims.md` disesuaikan.
- 📘 Dipakai dari HP sebagai web yang bisa dipasang (PWA), dengan alamat sendiri di bawah domain perusahaan (SIS-40, 45). Semua layar harus bisa dipakai di HP (SIS-03).

## 5. Absensi

- ✅ (2026-10-29) **Cara absen mengikuti v3** (KEH-10 s.d. 20): **scan QR cabang → lokasi GPS diperiksa server dalam radius → foto diri** dari kamera langsung (bukan galeri). Mesin fingerprint tidak dipakai.
  - Absen di luar radius tetap dihitung, bertanda "perlu ditinjau" HR/pemilik (KEH-14). Pola lokasi mencurigakan ditandai (KEH-19).
  - Foto berstempel nama, jam server, cabang, lokasi; dihapus setelah 60 hari (KEH-15). Kepala cabang punya menu "Foto Absen Hari Ini" (KEH-20).
  - Tombol berlabel: Masuk, Istirahat, Masuk Kembali, Pulang (KEH-17, 83). Jam = jam server.
- ✅ (2026-10-29) **Jam kerja mengikuti shift cabang tempat bekerja hari itu**, sejalan dengan v3:
  - 📘 Jam kerja hanya milik cabang; kantor dan gudang dianggap cabang (KEH-01). Bertanggal berlaku (KEH-02).
  - 📘 Jam kerja satu hari mengikuti **cabang tempat absen masuk** (KEH-08). Scan QR cabang lain → ditanya "perbantuan atau salah scan?" (KEH-26, 109). 7 hari berturut-turut di cabang lain → ditanya "sudah pindah cabang?" (KEH-27).
  - 📘 Cabang dengan lebih dari satu shift: tiap orang punya shift per minggu, **digilir otomatis tiap Senin** (KEH-05, 06). Shift **tidak pernah ditebak** dari jam datang (KEH-07).
  - 📘 Istilah: "shift" di HRIS = **jam kerja cabang**, berbeda dari **shift kasir** di POS (buka–tutup kas). 💡 Saat PRD, tulis di glosarium supaya tidak tertukar.
- 📘 **Libur:** 4 hari per periode (26–25), dipilih sendiri sebelum periode mulai; paling banyak 2 orang libur per cabang per hari; paling banyak 1 libur di akhir pekan (KEH-31 s.d. 35). Hari tutup dipasang pemilik/HR dan dibayar (KEH-79).
- 📘 **Telat:** toleransi 5 menit; di atas 30 menit wajib dijelaskan (KEH-21 s.d. 25). **Pulang cepat** dicatat, wajib dijelaskan, tidak dipotong.
- 📘 **Izin, sakit, cuti:** jenis cuti tahunan, sakit tanpa/dengan surat, izin keperluan, izin duka, izin mendadak. Cuti 10 hari/tahun setelah 1 tahun kerja, diajukan H-7, sisa hangus. Izin duka 2 hari dibayar. Surat dokter boleh menyusul 3 hari. Diputuskan HR/pemilik (KEH-36 s.d. 51).
- 📘 **Lembur:** jam penuh, 1–3 jam sehari, sampai jam tutup cabang; wajib diklaim dengan foto kertas lembur + siapa yang menyuruh, paling lambat 3 hari; disahkan sekali oleh HR/pemilik (KEH-70 s.d. 75).
- 📘 **Lupa absen & alpha:** lewat "Perlu Dijelaskan" dalam 3 hari; lewat batas → pengajuan terlambat (lupa absen) atau tetap alpha (KEH-52 s.d. 69). Koreksi absen hanya lewat satu pintu oleh HR/pemilik, catatan asli tidak ditimpa (KEH-28, 29).
- 📘 **Istirahat** dan **Laporan Pulang** (serah terima & laporan masalah) ikut v3 (KEH-82 s.d. 95). Bagian "keadaan mobil" menunggu keputusan Logistik (bagian 8).

## 6. Penggajian

- ✅ (2026-10-29) Komponen yang **dipakai semua**: **gaji pokok, tunjangan, lembur, bonus jasa groomer, kasbon, BPJS, potongan terlambat.**
- 📘 **Periode** 26–25, slip dinamai bulan akhirnya; gaji dibayar **tanggal 1**, tidak digeser hari libur (GAJ-01, 41, 59).
- 📘 **Komponen gaji** berupa daftar yang bisa ditambah per orang, bertanggal berlaku (jadi tunjangan apa pun bisa masuk). Gaji harian = gaji tetap ÷ 26 (GAJ-03 s.d. 06).
- 📘 **Tarif awal:** telat Rp1.000/menit (lewat toleransi 5 menit, dipotong seluruh menitnya); lembur Rp7.500/jam; potongan tidak hadir bertingkat × gaji harian; denda lupa absen masuk Rp15.000, pulang Rp5.000, tidak memilih libur Rp10.000 (GAJ-10 s.d. 16, 57). Semua angka adalah pengaturan bertanggal berlaku.
- 📘 **Potongan lain:** kehilangan barang dibagi per bobot jabatan (GAJ-17 s.d. 19); Potongan Lain untuk ganti rugi perorangan, 1–3 kali potong (GAJ-21).
- ✅ (2026-10-29) **Minus kas** (GAJ-20: ditanggung yang menutup shift) **dibaca langsung dari shift POS**, tidak menunggu app Keuangan. ~~Datanya sudah ada per kasir di `shift_cashier_breakdown.variance`~~ — **keliru** (koreksi 2026-10-29): POS hanya mencatat selisih **per shift**, padahal 37% shift berisi lebih dari satu kasir, dan ada 19 shift minus di atas Rp1 juta yang hampir pasti salah input. Karena itu minus masuk sebagai **usulan potongan yang ditinjau**, dan siapa yang menanggung ❓ masih dipilih owner (PRD `06-gaji-bulanan.md` §3.1a).
- ✅ (2026-10-29) **Semua usulan di PRD Fase 1 disetujui owner.**
- (2026-10-29) Postgres produksi: backoffice & order-web tersambung sebagai `admin` (superuser, satu-satunya role). Role per app dibuat di L0 (PRD `01-arsitektur.md` §3).
- 📘 **Bonus:** satu Buku Bonus; bonus grooming (10% × harga sesudah diskon) dan bonus ongkir dari data kasir; bonus bebas dengan alasan; satu halaman Persetujuan Bonus (GAJ-24 s.d. 31, 61). Dana Disiplin & Dana Tidak Hadir (GAJ-33 s.d. 35).
- 📘 **Kasbon** (DRV bagian 3.9–3.14, 3.21–3.22): diajukan di HP, diperiksa Finance, diputuskan Pemilik/GM, cicilan dibaca slip; tidak diketik di slip (GAJ-22).
- 📘 **Perjalanan slip:** Perkiraan (terlihat karyawan sepanjang periode) → Ditutup (HR/pemilik) → Dibayar (pemilik). Keberatan 26–28 & 3 hari setelah ditutup. Slip tidak bisa ditutup selama ada absen/klarifikasi yang menunggu. Gaji bersih tidak pernah minus; sisa potongan dibawa ke slip berikutnya. Slip tertutup tidak diubah; koreksi lewat baris di periode berikutnya (GAJ-36 s.d. 56).
- 📘 **Slip** dilihat & diunduh karyawan di portal HP; hanya slip tertutup yang bisa dicetak (GAJ-54, 109). Finance mendapat daftar transfer (bank, rekening, nominal bersih) tanpa rincian slip (GAJ-100).
- 📘 **Driver & kenek** ikut HRIS (✅ owner 2026-10-29: "ikut"). Aturannya mengikuti buku DRV v3 (jenis upah, slip mingguan, tarif ritase, denda, bongkaran). Celahnya ada di bagian 8.

## 7. Pengguna & Hak Akses

- 📘 Hak ditentukan **per jabatan** dari satu daftar, dengan lingkup diri sendiri / cabangnya / departemennya / semua (KAR-58, 71). Jabatan v3: Pemilik, GM, HR, Admin HR, Finance, Marketing, Kepala Gudang, Driver, Kenek, Kepala Toko, Kasir, Pramuniaga, Groomer (lihat `00-peta-modul.md`).
- 📘 **Gaji** hanya dilihat pemiliknya, HR, dan pemilik perusahaan; gaji Pemilik & GM hanya oleh kedua jabatan itu; Finance hanya total per periode; Admin HR tanpa gaji (GAJ-46, KAR-67, 77). Kepala toko hanya melihat tanggal & status pengajuan timnya, tanpa alasan dan lampiran (KEH-80).
- ~~📘 **Akun:** semua karyawan mendaftar sendiri dengan email asli + password, lalu disetujui HR (KAR-31, 53, 60, 69).~~ Diganti keputusan owner 2026-10-29 di bawah.
- ✅ (2026-10-29) **Akun hanya dibuat Owner dan GM**, tidak ada daftar mandiri. *(Pengganti KAR-60 v3.)*
- ✅ (2026-10-29) **Data karyawan dari sistem lama di-import lewat Excel/CSV**, tidak diisi manual satu per satu. *(Pengganti SIS-24 v3, yang meminta karyawan mengisi datanya sendiri saat daftar ulang.)*
- ✅ (2026-10-29) **HRIS menjadi pintu utama pembuatan akun**, termasuk akun kasir dan jabatan lain yang berkaitan dengan kepegawaian. Layar "Akun & Tautan" ada di HRIS.
- ✅ (2026-10-29) **Auth terpusat:** satu akun & satu sesi dipakai bersama oleh semua app (backoffice, HRIS, kelak Keuangan). Akun ditautkan **secara manual** ke data di tiap app (siapa tertaut ke akun mana). Rancangannya di bagian 10. *(Pelapis atas KAR-69 v3, yang memakai akun khusus HRIS.)*

## 8. Celah & Pertanyaan yang Tersisa

Hal yang **tidak** dijawab dokumen v3, atau bertentangan dengan kondisi monorepo.

**A. Belum diatur v3 sama sekali**
- ✅ (2026-10-29) **BPJS, PPh 21, THR: ikut v3**, yang tidak mengaturnya, jadi **tidak ditambahkan**. Kalau suatu saat dibutuhkan, ditambahkan sebagai aturan baru (WAJ-12).

**B. Bergantung pada modul yang tidak ikut HRIS**
- ❓ **Ritase driver & kenek** dihitung dari **trip** di modul **Logistik** v3 (absen masuk = "Berangkat", pulang = lapor sampai garasi; KEH-96, DRV 3.3). Owner condong ke pilihan (a), **Logistik minimal**, dengan syarat Logistik tidak menjadi bagian utama HRIS. Rancangannya di bagian 11.
- ✅ (2026-10-29) **Bonus rilis pertama:** grooming, ongkir, dan bonus bebas. Bonus promo dan Bonus Terukur/bersyarat menyusul bersama modul Kinerja.
- ✅ (2026-10-29) **Membayar gaji:** sampai app Keuangan ada, HRIS menyimpan sendiri tanggal bayar, pembayar, sumber uang, dan foto bukti transfer; kelak diteruskan ke Keuangan.
- 💡 **Kehilangan barang** (GAJ-17): v3 mengisi total kehilangan per cabang secara manual. Di monorepo, hasil stock opname POS bisa dijadikan sumbernya. Dibahas saat PRD.

**C. Penyesuaian ke monorepo**
- ✅ (2026-10-29) Prinsip v3 disetujui (bagian 1).
- ✅ (2026-10-29) **Login:** auth terpusat dengan sesi bersama antar app, akun ditautkan manual (bagian 7 & 10).
- ✅ (2026-10-29) **Database HRIS:** schema `hris` di `petshop_db` (bagian 4).
- ✅ (2026-10-29) **Fitur pendukung v3:** rilis pertama hanya **Mesin Pengajuan** dan **Pengaturan**; Papan Perubahan Aturan, Kesehatan Mesin, tempat uji & "Lihat sebagai", dan pengingat berantai menyusul.

**D. Peralihan**
- ✅ (2026-10-29) Pindah pada tanggal 26, tanpa tenggat; HRIS lama tetap dipakai sampai yang baru matang (bagian 1).
- ✅ (2026-10-29) **Staging:** alur `feat/hris-*` → `dev_hris` → `staging` → `main`; perbaikan backoffice harian tetap boleh langsung ke `main`, yang wajib lewat staging: HRIS, auth terpusat, pindah role DB. Staging di **VPS yang sama** (project compose kedua, database `petshop_staging`), **domain khusus** dibeli owner (❓ namanya), data **salinan produksi**. Rincian: PRD `01-arsitektur.md` §8.

## 9. Di Luar Lingkup Rilis Pertama (sementara)

- App Keuangan (menyusul setelah HRIS), termasuk semua laporan keuangan & penarikan data penjualan tiap 1 menit.
- Pemrosesan data mesin fingerprint (sudah ditinggalkan).
- Rekrutmen (ditangguhkan juga di v3), Kinerja (rapor, tugas, Catatan Rapat), Logistik di luar yang dibutuhkan ritase (lihat bagian 11).
- BPJS, PPh 21, THR (tidak diatur v3).

## 10. Auth Terpusat — Rancangan (💡 usulan 2026-10-29)

**Kondisi sekarang di backoffice** (dicek di kode 2026-10-29):
- Login menerbitkan JWT HS256 di cookie `accessToken` (berlaku 1 hari) berisi `role`, `permissions`, `branchId`, ditambah `refreshToken` (7 hari). Cookie tanpa `Domain`, jadi hanya terkirim ke domain backoffice.
- Sesi dicatat di `petshop.user_sessions`. Berlaku aturan **satu akun satu perangkat** (`TAKEN_OVER`), kecuali OWNER (`lib/services/user-session.ts`).
- PIN dipakai untuk ganti kasir cepat di POS, bukan untuk login utama.
- Portal pelanggan (order-web) punya login OTP sendiri dan **tidak ikut** auth terpusat.

**Rancangan:**
1. **Schema `auth`** berisi tiga tabel: `akun` (username/email, hash password argon2, status), `sesi` (akun, perangkat, dibuat, terakhir aktif, dicabut + alasan), dan `tautan_akun` (akun ↔ id lokal per app; paling banyak satu tautan per app per akun).
2. **Package `@petshop/auth`**: satu tempat untuk cek password, batas salah password, membuat/mencabut sesi, membaca sesi, dan atribut cookie. Semua app memakai package yang sama.
3. **Satu cookie sesi bersama** (mis. `hml_sesi`): berisi id acak (bukan JWT), `Domain=.<domain induk>`, `HttpOnly`, `Secure`, `SameSite=Lax`. Karena dicek ke `auth.sesi`, logout atau cabut sesi berlaku seketika di semua app.
4. **Hak akses tetap milik tiap app.** Begitu melihat `hml_sesi` yang sah, backoffice mencari tautannya ke `users`, lalu menerbitkan `accessToken`-nya sendiri seperti sekarang (role, permissions, cabang). Ratusan pemanggil `verifyAccessToken` tidak perlu diubah; yang berubah hanya asal sesinya (`auth.sesi`, bukan `petshop.user_sessions`). HRIS melakukan hal yang sama dengan jabatan & haknya sendiri.
5. **Halaman login dari package, dipasang di tiap app.** Tidak ada server login terpisah, jadi tidak ada container tambahan, dan HRIS tetap bisa dipakai walau backoffice sedang mati. Login di app mana pun berlaku di semua app.
6. **Tautan manual:** layar "Akun & Tautan" untuk Owner/GM: buat akun, tautkan ke pengguna kasir dan/atau karyawan HRIS, lepas tautan. Semua perubahan tercatat.
7. **Peralihan tanpa terasa:** setiap pengguna backoffice yang ada dibuatkan akun pusat dengan **hash password yang sama** dan langsung ditautkan ke `users`-nya, jadi kasir tetap login dengan cara yang sama. Karyawan HRIS ditautkan manual.
8. **Urutan:** dikerjakan **sebelum** HRIS, sebagai pekerjaan tersendiri di backoffice, karena menyentuh login produksi.

**Keputusan owner (2026-10-29):**
- ✅ **Aturan satu akun satu perangkat hanya untuk backoffice.** Sesi HRIS di HP tidak menendang sesi kasir.
- ✅ **Layar "Akun & Tautan" di HRIS**, dan HRIS menjadi pintu utama pembuatan akun, termasuk akun kasir (bagian 7).
- ✅ **Akun hanya dibuat Owner dan GM**; tidak ada daftar mandiri.
- ✅ **Import Excel/CSV** untuk data dari sistem lama.
- ✅ **Satu domain induk** untuk semua app internal (`admin.<domain>`, `hris.<domain>`). Disadari bahwa cookie juga terkirim ke portal pelanggan (`order.<domain>`), tetapi tetap aman karena `HttpOnly`.

**Akibat "HRIS pintu utama akun kasir" (💡 usulan):**
- Data khusus kasir (role POS, cabang tugas, izin per orang, PIN) tetap disimpan di `petshop.users` dan aturannya tetap milik backoffice. HRIS **tidak** diberi hak menulis ke schema `petshop`.
- Saat Owner/GM membuat akun di HRIS lalu mencentang "punya akses kasir" (pilih role & cabang), HRIS memanggil **pintu internal backoffice** (server ke server, dengan kunci rahasia) untuk membuat atau mengubah `petshop.users`, lalu tautannya tercatat di `auth.tautan_akun`.
- Layar Pengguna di backoffice pelan-pelan menjadi **hanya lihat** + tautan "kelola di HRIS", supaya tidak ada dua pintu yang berbeda isi. Pengaturan khusus POS yang tidak ada padanannya di HRIS (mis. reset PIN) tetap di backoffice.
- ✅ (2026-10-29) Pembagian ini disetujui owner.

**Import Excel/CSV (💡 usulan):**
- Alurnya: unduh **templat** → isi/tempel data dari sistem lama → unggah → **pratinjau** (baris salah ditandai beserta sebabnya, tidak ada yang tersimpan) → simpan semua atau tidak sama sekali. Setiap baris bertanda "bawaan sistem lama".
- Akun hasil import mendapat password awal dan **wajib ganti password saat pertama masuk** (backoffice sudah punya pola `must_change_credentials`).
- Akun backoffice yang sudah ada **tidak** di-import, karena sudah otomatis punya akun pusat (rancangan butir 7). Yang perlu dicocokkan hanya tautannya ke karyawan hasil import.
- ✅ (2026-10-29) **Fitur import menyusul**, tidak masuk rilis pertama. Data awal diekspor owner **langsung dari database sistem lama**, lalu dimuat sekali (💡 lewat skrip muat satu kali yang memakai aturan validasi yang sama dengan fitur import kelak, supaya tidak ada dua aturan).
- ✅ (2026-10-29) **Data yang dibawa** disetujui sesuai usulan di bawah:
  - (1) **karyawan**: nama, NIK/nomor karyawan, cabang, jabatan, status kerja, tanggal bergabung, nomor HP, email, rekening bank
  - (2) **komponen gaji** per orang
  - (3) **sisa kasbon** per orang (SIS-28)
  - (4) saldo awal **Dana Disiplin & Dana Tidak Hadir** (SIS-33)

  Riwayat absen dan slip tetap tidak dibawa (SIS-23).

## 11. Logistik Minimal untuk Ritase — Rancangan (💡 usulan 2026-10-29)

Supaya driver & kenek bisa digaji dan absen lewat trip (KEH-96, DRV-14) tanpa membangun Logistik v3 utuh, dan tanpa menjadikan Logistik bagian dari HRIS:

- **Schema sendiri: `logistik`**, bukan tabel di `hris`. Inilah yang menjaga Logistik tetap modul terpisah: kelak Logistik penuh tinggal melanjutkan schema yang sama, tanpa memindah data.
- **Isi minimal:**
  - `mobil`, `rute`
  - `trip`: mobil, rute, tanggal berangkat, status (Berjalan / Selesai / Dibatalkan), jam & foto awak saat Berangkat, jam lapor sampai garasi (wajib di titik gudang, LOG-29), ditutup kantor + alasan (LOG-30)
  - `trip_awak`: siapa saja, sebagai driver atau kenek
  - `ritase`: dicatat server sekali per trip (DRV-14), termasuk jenis belanja
- **Tidak dibuat sekarang:** rencana kirim, surat jalan, toko, laporan muat, nota, retur, bensin, keadaan mobil.
- **Pemilik data tetap seperti v3:** mobil, rute, trip, dan ritase milik Logistik. Tarif ritase, denda driver/kenek, dan slip mingguan milik Gaji Driver (schema `hris`).
- **Kontrak satu arah:** HRIS hanya **membaca** lewat dua view: `logistik.v_ritase` (siapa, tanggal trip, mobil, rute, peran, berkenek atau tidak) dan `logistik.v_absen_trip` (jam berangkat & jam garasi per orang per hari). HRIS tidak pernah menulis ke `logistik`. Id karyawan disimpan tanpa foreign key lintas schema.
- **Kode & layar:** aturan Logistik di folder/package sendiri. Layarnya sementara menumpang di app HRIS dalam kelompok menu "Logistik":
  - **Trip Saya** (driver/kenek di HP): Berangkat, Sampai Garasi
  - **Trip** (Kepala Gudang): buat trip (mobil, rute, awak), tutup atas nama driver

  Kelak layar ini bisa dipindah ke app Logistik sendiri.
- ✅ (2026-10-29) Trip dibuat langsung oleh Kepala Gudang tanpa rencana kirim — **cukup untuk kebutuhan data awal** (owner). Rencana kirim dan lainnya menyusul bersama Logistik penuh.
- ✅ (2026-10-29) Rancangan Logistik minimal di schema `logistik` disetujui.

## 12. Log Diskusi

| Tanggal | Ringkasan |
|---|---|
| 2026-10-28 | Cek resource VPS: aman (load ~0, RAM 1.8/3.6 GB, disk 29%). WAHA (~950 MB) dimatikan karena belum dipakai; akan menyala lagi saat deploy kecuali compose diberi `profiles`. |
| 2026-10-28 | Bahas app HRIS + Keuangan di VPS yang sama: aman dari sisi resource. Baca langsung ke DB lebih hemat daripada lewat API backoffice; risiko utamanya angka berbeda → rumus dipakai bersama. |
| 2026-10-29 | Bahas schema terpisah vs database terpisah beserta tradeoff-nya (bagian 4). |
| 2026-10-29 | Owner: **HRIS didahulukan**, fokus Absensi & Penggajian. Dokumen ini dibuat. |
| 2026-10-29 | Owner: absen **selfie** (fingerprint ditinggalkan); jam kerja **fleksibel mengikuti shift cabang** tempat bekerja hari itu; komponen gaji **semua dipakai**; **semua laporan keuangan → app Keuangan**. Ada HRIS lama, dokumennya akan ditaruh di folder ini sebagai referensi. |
| 2026-10-29 | Dokumen referensi (71 berkas, rancangan HRIS v3) dipilah di `reference_docs/README.md`: inti, baca sebagian, dan lewati (Keuangan/Logistik/Kinerja serta dokumen kerja repo v3). Muncul pertanyaan baru: nasib repo v3, QR vs selfie, driver/kenek, dan sumber minus kas. |
| 2026-10-29 | Owner: kode v3 tidak dipindah (tidak efisien), dibangun dari aturan v3; cara absen **ikut v3** (QR + GPS + foto); **driver & kenek ikut**, cukup ikut dokumen kalau sudah jelas; **minus kas dibaca dari shift POS**. Pertanyaan bagian 5–7 dicocokkan ke buku aturan v3: sebagian besar terjawab (📘). Sisa celah dikumpulkan di bagian 8 — terbesar: BPJS/PPh 21/THR tidak ada di v3, dan ritase driver bergantung pada Logistik. |
| 2026-10-29 | Owner: **prinsip v3 disetujui** (termasuk BPJS/PPh 21/THR tidak diatur); bonus rilis pertama grooming/ongkir/bebas; pembayaran gaji disimpan di HRIS dulu; **schema `hris`** di `petshop_db`; fitur pendukung cukup Mesin Pengajuan & Pengaturan; pindah tanggal 26; **auth terpusat dengan sesi bersama + tautan manual**. Rancangan auth (bagian 10) dan Logistik minimal di schema `logistik` (bagian 11) diajukan. |
| 2026-10-29 | Owner: aturan satu perangkat **hanya untuk backoffice**; **HRIS pintu utama pembuatan akun** (termasuk akun kasir), layar Akun & Tautan di HRIS; akun **hanya dibuat Owner/GM** (tanpa daftar mandiri); data lama di-**import Excel/CSV**; satu domain induk. Diajukan: pembagian HRIS ↔ backoffice untuk akun kasir, dan alur import. |
| 2026-10-29 | Owner: pembagian akun kasir & data yang dibawa **disetujui**; data awal diekspor dari DB lama, **fitur import menyusul**; **BPJS tidak ditambahkan**; trip oleh Kepala Gudang cukup untuk awal; target **Oktober**; masalah HRIS lama = **kode & modul tumpang tindih** → butuh iterasi cepat dengan struktur jelas. Pekerjaan pindah ke branch `dev_hris`. WAHA dipindah ke profil compose `whatsapp`. |
| 2026-10-29 | Rilis **1.107.99** di `main` (fix promo "beli X gratis Y" #31 + WAHA ke profil `whatsapp`). Owner: **tidak ada tenggat pindah**, HRIS lama tetap dipakai sampai yang baru matang; `dev_hris` = branch utama pengembangan HRIS; branch **staging** dibahas nanti. |
| 2026-10-29 | **PRD Fase 1 disusun** di `PRD/fase_1/` (README + 00–09: ringkasan, arsitektur, auth, perlengkapan bersama, karyawan, kehadiran, gaji, kasbon, logistik minimal, gaji driver & bongkaran), urutan langkah L0–L9. Status: draf, menunggu review owner. Pengembangan nanti memakai `docs/work/` (spec & plan per langkah). |
| 2026-10-29 | Owner **menyetujui semua usulan PRD**. Koreksi: selisih kas POS hanya per shift (kolom per kasir selalu kosong) → pilihan penanggung minus diajukan (PRD 06 §3.1a). Dicek: Postgres produksi hanya punya role `admin` (superuser) yang dipakai backoffice & order-web → role per app di L0. Pembahasan staging dijadwalkan sebelum L0. |
| 2026-10-29 | Owner: penanggung minus kas dijadikan **pertanyaan pending** (dicatat juga di `docs/work/backlog/2026-10-11-daftar-tunda-owner.md`); role DB per app **disetujui**. Dokumen di-commit ke `dev_hris`, lalu lanjut bahas staging. |
| 2026-10-29 | Owner: **staging disetujui** — alur branch `feat/hris-*` → `dev_hris` → `staging` → `main` (fix backoffice harian tetap boleh langsung ke `main`); di VPS yang sama dengan database `petshop_staging`; domain khusus staging dibeli owner; data salinan produksi. |
