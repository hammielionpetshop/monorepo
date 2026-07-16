CREATE TABLE "petshop"."app_settings" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
ALTER TABLE "petshop"."users" ADD COLUMN "username" varchar(50);--> statement-breakpoint
ALTER TABLE "petshop"."users" ADD COLUMN "must_change_credentials" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "petshop"."users" ADD COLUMN "credentials_set_at" timestamp;--> statement-breakpoint
ALTER TABLE "petshop"."app_settings" ADD CONSTRAINT "app_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");--> statement-breakpoint
-- Backfill: akun eksisting TIDAK dipaksa onboarding (hanya user baru yang wajib ganti kredensial).
UPDATE "petshop"."users" SET "must_change_credentials" = false;--> statement-breakpoint
-- Seed default kredensial staf. Plaintext by design (OWNER perlu melihat untuk disampaikan ke staf);
-- hash argon2 tetap dipakai di users.password_hash/pin_hash. Dapat diubah OWNER via Settings › Keamanan.
INSERT INTO "petshop"."app_settings" ("key", "value") VALUES ('default_password', 'password123'), ('default_pin', '123456') ON CONFLICT ("key") DO NOTHING;