-- Satu akun, satu perangkat.
--
-- Auth memakai JWT stateless di cookie: sebelum tabel ini ada, token yang sudah terbit
-- TIDAK BISA dibatalkan sama sekali. Ia berlaku sampai kedaluwarsa (1 hari) — termasuk di
-- perangkat yang hilang, dipinjam, atau ditinggal login di rumah orang. Tidak ada satu pun
-- tombol di sistem yang bisa memutusnya.
--
-- Aturannya: satu sesi aktif per user. Login di perangkat baru mencabut sesi lama
-- (`revoked_reason = 'TAKEN_OVER'`); token lama mati seketika karena `verifyAccessToken`
-- memeriksa baris ini di tiap request. Yang berhak merebut adalah pemilik akun sendiri,
-- tanpa persetujuan siapa pun — kasus lazimnya justru perangkat lama sudah tidak di tangannya.
--
-- Kenapa dicek tiap request dan bukan lewat token berumur pendek + refresh: pilihan sadar.
-- Refresh menunda kematian sesi lama sampai token kedaluwarsa, dan untuk akun yang perangkatnya
-- hilang, jeda itu persis hal yang ingin dihilangkan. Ongkosnya satu SELECT ber-index per
-- request, di-dedupe per render, lewat PgBouncer yang sudah terpasang.
--
-- `revoked_at` NULL = sesi masih hidup. Baris TIDAK pernah dihapus: riwayat "kapan akun ini
-- berpindah perangkat" justru sebagian dari gunanya.

CREATE TABLE IF NOT EXISTS "petshop"."user_sessions" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "device_label" varchar(200),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "revoked_at" timestamp,
  "revoked_reason" varchar(20)
);

DO $$ BEGIN
  ALTER TABLE "petshop"."user_sessions"
    ADD CONSTRAINT "user_sessions_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "petshop"."users"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Jalur baca panasnya: "apakah sesi X milik user ini masih hidup", sekali per request.
CREATE INDEX IF NOT EXISTS "idx_user_sessions_user_active"
  ON "petshop"."user_sessions" ("user_id","revoked_at");

-- SENGAJA tidak ada backfill. Sesi hanya lahir saat login, dan token lama memang tidak
-- membawa `sessionId` — token tanpa sessionId diperlakukan sah sampai kedaluwarsa sendiri
-- (lihat `verifyAccessToken`), supaya migrasi ini tidak melempar keluar semua orang yang
-- sedang bekerja pada saat deploy.
