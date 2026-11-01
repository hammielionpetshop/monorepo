CREATE TYPE "hris"."audit_source" AS ENUM('USER', 'JOB');--> statement-breakpoint
CREATE TYPE "hris"."setting_status" AS ENUM('PROPOSED', 'ACTIVE', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "hris"."setting_target_kind" AS ENUM('ALL', 'POSITION', 'BRANCH');--> statement-breakpoint
CREATE TABLE "hris"."setting_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"target_kind" "hris"."setting_target_kind" DEFAULT 'ALL' NOT NULL,
	"target_id" integer,
	"value" jsonb NOT NULL,
	"effective_from" date NOT NULL,
	"status" "hris"."setting_status" NOT NULL,
	"reason" text NOT NULL,
	"created_by_account_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_by_account_id" integer,
	"approved_at" timestamp with time zone,
	"cancelled_by_account_id" integer,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	CONSTRAINT "setting_values_target_pair" CHECK (("hris"."setting_values"."target_kind" = 'ALL') = ("hris"."setting_values"."target_id" is null)),
	CONSTRAINT "setting_values_reason_not_blank" CHECK (btrim("hris"."setting_values"."reason") <> ''),
	CONSTRAINT "setting_values_cancel_complete" CHECK (("hris"."setting_values"."status" = 'CANCELLED') = ("hris"."setting_values"."cancelled_at" is not null)
      and ("hris"."setting_values"."cancelled_at" is null or ("hris"."setting_values"."cancelled_by_account_id" is not null and btrim(coalesce("hris"."setting_values"."cancel_reason", '')) <> '')))
);
--> statement-breakpoint
ALTER TABLE "hris"."audit_events" ALTER COLUMN "actor_account_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "hris"."audit_events" ADD COLUMN "source" "hris"."audit_source" DEFAULT 'USER' NOT NULL;--> statement-breakpoint
ALTER TABLE "hris"."audit_events" ADD COLUMN "job_name" text;--> statement-breakpoint
CREATE UNIQUE INDEX "setting_values_one_active_per_day" ON "hris"."setting_values" USING btree ("key","target_kind",coalesce("target_id", 0),"effective_from") WHERE "hris"."setting_values"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "setting_values_lookup_idx" ON "hris"."setting_values" USING btree ("key","target_kind","target_id","effective_from");--> statement-breakpoint
ALTER TABLE "hris"."audit_events" ADD CONSTRAINT "audit_events_actor_matches_source" CHECK (("hris"."audit_events"."source" = 'USER' and "hris"."audit_events"."actor_account_id" is not null and "hris"."audit_events"."job_name" is null)
      or ("hris"."audit_events"."source" = 'JOB' and "hris"."audit_events"."job_name" is not null));--> statement-breakpoint
-- Ditulis tangan (spec L2e §2): pagar nilai pengaturan dan isi awal.
-- Nilai tidak pernah dihapus atau ditimpa; yang boleh berubah hanya statusnya (PRI-32 butir 2, WAJ-07).
CREATE FUNCTION "hris"."guard_setting_value"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.key, NEW.target_kind, NEW.target_id, NEW.value, NEW.effective_from, NEW.reason, NEW.created_by_account_id, NEW.created_at)
     IS DISTINCT FROM
     (OLD.key, OLD.target_kind, OLD.target_id, OLD.value, OLD.effective_from, OLD.reason, OLD.created_by_account_id, OLD.created_at) THEN
    RAISE EXCEPTION 'Nilai pengaturan tidak boleh diubah; buat nilai baru bertanggal.' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
       (OLD.status = 'PROPOSED' AND NEW.status IN ('ACTIVE', 'CANCELLED'))
    OR (OLD.status = 'ACTIVE' AND NEW.status = 'CANCELLED'
        AND OLD.effective_from > (now() AT TIME ZONE 'Asia/Jakarta')::date)
  ) THEN
    RAISE EXCEPTION 'Perubahan status pengaturan % ke % tidak diizinkan.', OLD.status, NEW.status USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER "setting_values_guard" BEFORE UPDATE ON "hris"."setting_values"
  FOR EACH ROW EXECUTE FUNCTION "hris"."guard_setting_value"();
--> statement-breakpoint
CREATE TRIGGER "setting_values_no_delete" BEFORE DELETE ON "hris"."setting_values"
  FOR EACH ROW EXECUTE FUNCTION "hris"."reject_change"();
--> statement-breakpoint
CREATE TRIGGER "setting_values_no_truncate" BEFORE TRUNCATE ON "hris"."setting_values"
  FOR EACH STATEMENT EXECUTE FUNCTION "hris"."reject_change"();
--> statement-breakpoint
-- Isi awal buku aturan v3 (BER §8, KAR §8, KAR-20). Harus sama dengan daftar di
-- apps/hris/modules/settings/rules/registry.ts (dites, H18).
INSERT INTO "hris"."setting_values" (key, value, effective_from, status, reason)
VALUES
  ('shared.reason_min_length', '15'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3'),
  ('shared.hold_seconds_consequential', '3'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3'),
  ('employees.training_review_months', '3'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3'),
  ('position.backoffice_role_suggestion', '"NONE"'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3'),
  ('position.field_duty_auto', '"NONE"'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3');
