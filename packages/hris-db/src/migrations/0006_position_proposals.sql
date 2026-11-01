CREATE TABLE "hris"."position_setting_proposals" (
	"request_id" integer PRIMARY KEY NOT NULL,
	"setting_value_id" integer NOT NULL,
	"before_value" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hris"."position_setting_proposals" ADD CONSTRAINT "position_setting_proposals_setting_value_id_setting_values_id_fk" FOREIGN KEY ("setting_value_id") REFERENCES "hris"."setting_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "position_setting_proposals_value_unique" ON "hris"."position_setting_proposals" USING btree ("setting_value_id");--> statement-breakpoint
-- Ditulis tangan (spec L2f-2 §2): isi usulan tidak boleh diubah atau dihapus.
CREATE TRIGGER "position_setting_proposals_no_update" BEFORE UPDATE ON "hris"."position_setting_proposals"
  FOR EACH ROW EXECUTE FUNCTION "hris"."reject_change"();
--> statement-breakpoint
CREATE TRIGGER "position_setting_proposals_no_delete" BEFORE DELETE ON "hris"."position_setting_proposals"
  FOR EACH ROW EXECUTE FUNCTION "hris"."reject_change"();
--> statement-breakpoint
CREATE TRIGGER "position_setting_proposals_no_truncate" BEFORE TRUNCATE ON "hris"."position_setting_proposals"
  FOR EACH STATEMENT EXECUTE FUNCTION "hris"."reject_change"();
--> statement-breakpoint
-- Isi awal "Penerima laporan lupa password": jabatan GM (KAR-70 butir 7). Harus ada di registry.ts (H18).
INSERT INTO "hris"."setting_values" (key, value, effective_from, status, reason)
SELECT 'accounts.recovery_contact_position', to_jsonb(id::text), '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3'
FROM "hris"."positions" WHERE full_access ORDER BY (name = 'GM') DESC, id LIMIT 1;
