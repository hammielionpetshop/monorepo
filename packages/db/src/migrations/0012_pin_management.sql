-- Manajemen PIN: ganti PIN sendiri & reset PIN staf oleh OWNER.
--
-- Sebelumnya PIN hanya bisa diisi sekali lewat gerbang onboarding login pertama. Kalau staf
-- lupa PIN, satu-satunya jalan adalah "reset kredensial" yang ikut menghapus password —
-- padahal password-nya masih dipakai dan masih benar. Dua kolom di bawah memisahkan kedua hal itu.
--
-- must_change_pin: diset TRUE saat OWNER reset PIN staf, memaksa staf memilih PIN sendiri di
-- login berikutnya. Sengaja TERPISAH dari must_change_credentials — gerbang lama memaksa ganti
-- password juga, yang tidak relevan untuk reset PIN.
--
-- pin_set_at: kapan PIN terakhir diubah oleh pemiliknya. NULL berarti PIN sekarang bukan
-- pilihan user (masih PIN default hasil reset, atau warisan data lama). Dipakai halaman
-- Settings › PIN Staf untuk menunjukkan mana PIN yang masih default.
--
-- DEFAULT FALSE untuk must_change_pin: user lama tidak boleh tiba-tiba terkunci di gerbang
-- ganti PIN hanya karena migrasi ini jalan.

ALTER TABLE "petshop"."users" ADD COLUMN IF NOT EXISTS "must_change_pin" boolean DEFAULT false NOT NULL;
ALTER TABLE "petshop"."users" ADD COLUMN IF NOT EXISTS "pin_set_at" timestamp;

-- Backfill: user yang sudah menuntaskan onboarding berarti PIN-nya dipilih sendiri saat itu.
UPDATE "petshop"."users"
SET "pin_set_at" = "credentials_set_at"
WHERE "pin_set_at" IS NULL
  AND "credentials_set_at" IS NOT NULL
  AND "must_change_credentials" = false
  AND "pin_hash" IS NOT NULL;
