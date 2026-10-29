# 02 — Auth Terpusat (Langkah L1)

Bukan bagian v3. Keputusan owner 2026-10-29: satu akun dan satu sesi dipakai bersama oleh semua app
internal, dan akun ditautkan **secara manual** ke data tiap app.

## 1. Tujuan

- Karyawan login sekali dan bisa memakai backoffice dan HRIS (kelak Keuangan) tanpa login ulang.
- Logout atau pencabutan sesi berlaku seketika di semua app.
- Pembuatan akun terpusat di HRIS (04), termasuk akun kasir.
- Kasir **tidak merasakan perubahan** saat auth terpusat tayang.

## 2. Kondisi sekarang (dicek di kode 2026-10-29)

- Backoffice: JWT HS256 di cookie `accessToken` (1 hari) berisi `role`, `permissions`, `branchId`,
  ditambah `refreshToken` (7 hari); cookie tanpa `Domain`.
- Sesi di `petshop.user_sessions`; aturan **satu akun satu perangkat** (`TAKEN_OVER`), kecuali OWNER
  (`apps/backoffice/lib/services/user-session.ts`).
- `verifyAccessToken` memeriksa sesi dan dipanggil di sangat banyak berkas; middleware (Edge) hanya
  memeriksa tanda tangan.
- PIN dipakai untuk ganti kasir cepat di POS dan ganti PIN sendiri.
- order-web (portal pelanggan) memakai OTP sendiri → **tidak ikut**.

## 3. Kebutuhan

| No | Kebutuhan |
|---|---|
| AUT-01 | Schema `auth` berisi `akun` (username dan/atau email, hash password argon2, status aktif, wajib ganti password), `sesi` (akun, perangkat, dibuat, terakhir aktif, dicabut + alasan), dan `tautan_akun` (akun ↔ app ↔ id lokal). |
| AUT-02 | Satu akun paling banyak **satu tautan per app** (mis. satu `petshop.users`, satu karyawan HRIS). Satu id lokal hanya tertaut ke satu akun. |
| AUT-03 | Cookie sesi bersama berisi **id acak** (bukan JWT), `Domain=.<domain induk>`, `HttpOnly`, `Secure`, `SameSite=Lax`. Keabsahannya selalu dicek ke `auth.sesi`. |
| AUT-04 | **Hak akses tetap milik tiap app.** Backoffice yang melihat sesi sah mencari tautannya ke `petshop.users`, lalu menerbitkan `accessToken` miliknya seperti sekarang. HRIS melakukan hal yang sama dengan jabatan & haknya. Akun tanpa tautan ke sebuah app ditolak masuk app itu dengan pesan jelas. |
| AUT-05 | Pemeriksaan sesi di `verifyAccessToken` pindah dari `petshop.user_sessions` ke `auth.sesi`, **tanpa mengubah pemanggilnya**. |
| AUT-06 | Halaman login adalah komponen dari package `auth`, dipasang di tiap app. Login di app mana pun berlaku di semua app. Tidak ada server login terpisah. |
| AUT-07 | Login dengan username atau email + password. Password minimal 8 karakter (KAR-33). Salah 5 kali berturut-turut → jeda 5 menit (KAR-69). |
| AUT-08 | ✅ **Aturan satu perangkat hanya untuk backoffice.** Masuk backoffice dari perangkat baru mencabut **akses backoffice** sesi lain milik akun itu (kecuali OWNER, seperti sekarang). Sesi HRIS di HP tidak ikut tercabut. |
| AUT-09 | Logout di app mana pun mencabut sesi itu di semua app. |
| AUT-10 | Akun **hanya dibuat Owner/GM** dari HRIS (04). Akun baru wajib ganti password saat pertama masuk. |
| AUT-11 | ✅ Akses kasir dibuat dari HRIS: HRIS memanggil **pintu internal backoffice** (server ke server, dengan kunci rahasia) untuk membuat/mengubah `petshop.users` (role, cabang tugas), lalu tautannya dicatat. HRIS tidak pernah menulis `petshop` langsung. |
| AUT-12 | PIN kasir tetap milik backoffice (`petshop.users.pin_hash`), dipakai seperti sekarang. Reset PIN tetap di backoffice. |
| AUT-13 | Lupa password: untuk akun yang tertaut ke karyawan HRIS mengikuti KAR-70 (email/username + nomor HP + tanggal lahir dari data karyawan). Akun lain direset Owner/GM. |
| AUT-14 | Riwayat masuk tersimpan per akun (dasar layar KAR-L14 & KAR-L40). Setiap pembuatan akun, perubahan tautan, reset, dan pencabutan tercatat (siapa, kapan, sebelum, sesudah). |

## 4. Peralihan backoffice

1. Migrasi `auth` dibuat; setiap `petshop.users` dibuatkan `auth.akun` dengan **hash password yang
   sama** dan `tautan_akun` ke dirinya. Username/email ikut disalin, termasuk aturan unik tanpa beda
   huruf besar-kecil yang sudah ada.
2. Backoffice berpindah ke sesi `auth`; sesi lama `petshop.user_sessions` dibiarkan mati sendiri
   (token lama habis dalam 1 hari, seperti saat fitur sesi diperkenalkan).
3. Halaman Pengguna di backoffice menjadi **hanya lihat** + tautan "kelola di HRIS" begitu L2 tayang.
   Sampai L2 tayang, pembuatan pengguna backoffice tetap berjalan seperti sekarang lewat pintu yang
   sama dengan AUT-11.

## 5. Kriteria selesai

- Kasir login di POS dengan username & password lama, tanpa langkah baru.
- Login di backoffice lalu membuka HRIS di tab lain → langsung masuk (dan sebaliknya).
- Logout di HRIS → backoffice di tab lain meminta login pada permintaan berikutnya.
- Kasir login POS di PC lalu membuka HRIS di HP → **tidak ada** yang tertendang (AUT-08).
- Kasir login backoffice di PC kedua → backoffice di PC pertama tertendang (perilaku lama tetap).
- Tes: semua pemanggil `verifyAccessToken` tetap lulus; tes hak & sesi untuk AUT-03 s.d. AUT-09.

## 6. Jalan kembali

Selama masa peralihan, backoffice menyimpan saklar konfigurasi untuk kembali ke sesi lama
(`petshop.user_sessions`). Saklar dihapus setelah auth terpusat stabil satu periode.

## 7. Pertanyaan terbuka

- ❓ Lama hidup sesi di HP untuk HRIS: karyawan absen tiap hari; v3 membiarkan akun tetap masuk di
  perangkat (KAR-69). Usulan: sesi HRIS bergeser (diperpanjang tiap dipakai), dengan batas tidak
  dipakai 30 hari.
- ❓ Nama domain induk & subdomain HRIS.
