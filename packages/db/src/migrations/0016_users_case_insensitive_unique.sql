-- Username & email unik tanpa peduli huruf besar/kecil.
--
-- Login sekarang mencari akun secara case-insensitive (`lower(kolom) = lower(input)` di
-- `app/api/auth/login/route.ts`), sementara UNIQUE yang ada hanya berlaku pada nilai persis.
-- Artinya "Budi" dan "budi" masih boleh hidup berdampingan di tabel, dan begitu keduanya ada,
-- login jadi ambigu: `limit(1)` memilih salah satunya tanpa aturan, jadi orang bisa terbawa ke
-- akun yang bukan miliknya. Route pembuat/pengubah user sudah menolak duplikat beda-huruf,
-- tapi cek di aplikasi punya celah balapan — dua request bersamaan bisa lolos berdua karena
-- UNIQUE lama tidak menganggapnya bentrok.
--
-- Indeks fungsional inilah palang yang sebenarnya: dua nilai yang hanya beda huruf besar/kecil
-- kini ditolak oleh Postgres sendiri.
--
-- UNIQUE lama (`users_username_unique`, `users_email_unique`) SENGAJA dibiarkan. Ia memang jadi
-- berlebihan — unik pada `lower(x)` sudah mencakup unik pada `x` — tetapi keduanya dideklarasikan
-- lewat `.unique()` di `schema/users.ts`; menghapusnya di sini akan membuat schema dan DB
-- berbeda, dan `drizzle-kit` akan mencoba membuatnya lagi.
--
-- NULL tidak terpengaruh: `username` dan `email` boleh kosong, dan indeks unik Postgres tetap
-- mengizinkan banyak baris NULL. Staf POS-only yang hanya punya `staff_number` tidak terganggu.
--
-- Tanpa CONCURRENTLY: drizzle-kit menjalankan migrasi di dalam transaksi (CONCURRENTLY tidak
-- boleh di sana), dan tabel ini berisi 13 baris di produksi — pembuatan indeksnya seketika.
--
-- Sudah diperiksa ke produksi sebelum migrasi ini ditulis: 0 bentrokan beda-huruf pada kedua
-- kolom, jadi indeks ini bisa dibuat tanpa membersihkan data lebih dulu. Ada 2 username dan
-- 3 email yang mengandung huruf besar; itu tetap sah dan tetap bisa login, dan akan ikut
-- ternormalkan saat barisnya disunting lewat Settings > Pengguna.

CREATE UNIQUE INDEX IF NOT EXISTS "users_username_lower_unique"
  ON "petshop"."users" (lower("username"));

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_lower_unique"
  ON "petshop"."users" (lower("email"));
