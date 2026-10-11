-- Jasa grooming J2 (docs/work/specs/2026-10-11-jasa-grooming-design.md): daftar groomer dan
-- data kucing milik pelanggan. Hanya menambah tabel & izin; tidak mengubah data yang ada.
CREATE TABLE IF NOT EXISTS "petshop"."groomers" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(100) NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by_id" integer REFERENCES "petshop"."users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "petshop"."pets" (
  "id" serial PRIMARY KEY NOT NULL,
  "customer_id" integer NOT NULL REFERENCES "petshop"."customers"("id"),
  "name" varchar(100) NOT NULL,
  "species" varchar(60) NOT NULL,
  "color" varchar(60) NOT NULL,
  "birth_date" date,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by_id" integer REFERENCES "petshop"."users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pets_customer" ON "petshop"."pets" ("customer_id");
--> statement-breakpoint

-- Izin disisipkan lewat migrasi (bukan seed) karena pipeline deploy hanya menjalankan migrasi.
INSERT INTO "petshop"."permissions" ("code", "name", "description")
VALUES
  ('grooming.groomer.manage', 'Kelola Groomer', 'Tambah, ubah nama, dan nonaktifkan groomer'),
  ('grooming.pet.manage', 'Kelola Data Kucing', 'Lihat, tambah, dan ubah data kucing serta pemiliknya')
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "petshop"."role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "petshop"."roles" r
CROSS JOIN "petshop"."permissions" p
WHERE r."name" IN ('OWNER', 'GM')
  AND p."code" = 'grooming.groomer.manage'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "petshop"."role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "petshop"."roles" r
CROSS JOIN "petshop"."permissions" p
WHERE r."name" IN ('OWNER', 'GM', 'MANAGER', 'KASIR')
  AND p."code" = 'grooming.pet.manage'
ON CONFLICT DO NOTHING;
