-- Staf bertugas di lebih dari satu cabang.
--
-- Sebelum ini `users.branch_id` tunggal: staf yang hari ini di cabang A dan besok di cabang B
-- harus diubah datanya setiap kali pindah, dan riwayatnya hilang begitu diubah.
--
-- `users.branch_id` SENGAJA TIDAK dihapus. Ia tetap cabang utama — cabang aktif saat login, dan
-- cadangan bila penugasan kosong. Menghapusnya berarti membongkar ±470 pemakaian `branchId`
-- yang sudah benar artinya ("cabang yang sedang dikerjakan"), tanpa satu pun jadi lebih benar.
--
-- Yang aktif tetap SATU cabang pada satu waktu (disimpan di cookie, bukan di tabel ini). Tabel
-- ini membatasi cabang mana yang boleh dipilih — ia bukan daftar cabang yang dilihat sekaligus.
--
-- Kenapa ini juga perbaikan otorisasi, bukan cuma fitur: pemilihan cabang POS yang lama
-- (`/api/pos/set-branch`) hanya memeriksa role ∈ (OWNER, GM, MANAGER) lalu menerima cabang
-- aktif MANA PUN. MANAGER cabang A bisa menyetel cookie ke cabang B lalu bertransaksi, opname,
-- dan menerima barang di sana. Setelah tabel ini ada, target pindah wajib berupa cabang yang
-- memang ditugaskan kepadanya.

CREATE TABLE IF NOT EXISTS "petshop"."user_branch_assignments" (
  "user_id" integer NOT NULL,
  "branch_id" integer NOT NULL,
  "assigned_by" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "user_branch_assignments_user_id_branch_id_pk" PRIMARY KEY("user_id","branch_id")
);

DO $$ BEGIN
  ALTER TABLE "petshop"."user_branch_assignments"
    ADD CONSTRAINT "user_branch_assignments_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "petshop"."users"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "petshop"."user_branch_assignments"
    ADD CONSTRAINT "user_branch_assignments_branch_id_branches_id_fk"
    FOREIGN KEY ("branch_id") REFERENCES "petshop"."branches"("id");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "petshop"."user_branch_assignments"
    ADD CONSTRAINT "user_branch_assignments_assigned_by_users_id_fk"
    FOREIGN KEY ("assigned_by") REFERENCES "petshop"."users"("id");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Backfill: setiap user berhak atas cabang utamanya sendiri. Tanpa baris ini, user lama
-- mendadak "tidak ditugaskan ke mana pun" dan pemilihan cabang jadi kosong untuk semua orang.
-- `assigned_by` NULL = warisan migrasi, bukan ditunjuk seseorang.
INSERT INTO "petshop"."user_branch_assignments" ("user_id", "branch_id")
SELECT "id", "branch_id" FROM "petshop"."users"
ON CONFLICT DO NOTHING;

-- Arah baca kedua: siapa saja yang bertugas di cabang ini. PK sudah melayani (user → cabang).
CREATE INDEX IF NOT EXISTS "idx_user_branch_assignments_branch"
  ON "petshop"."user_branch_assignments" ("branch_id");
