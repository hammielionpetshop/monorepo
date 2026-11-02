CREATE TYPE "hris"."overtime_choice" AS ENUM('UNANSWERED', 'LATER', 'NOT_OVERTIME', 'CLAIMED');--> statement-breakpoint
CREATE TYPE "hris"."overtime_state" AS ENUM('OPEN', 'CLAIMED', 'APPROVED', 'EXPIRED', 'VOID');--> statement-breakpoint
CREATE TABLE "hris"."overtime_claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"overtime_day_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"claimed_hours" smallint NOT NULL,
	"orderer_employee_id" integer NOT NULL,
	"approved_hours" smallint,
	"reduction_reason" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "overtime_claims_not_self" CHECK ("hris"."overtime_claims"."orderer_employee_id" <> "hris"."overtime_claims"."employee_id"),
	CONSTRAINT "overtime_claims_hours" CHECK ("hris"."overtime_claims"."claimed_hours" between 1 and 24 and ("hris"."overtime_claims"."approved_hours" is null or "hris"."overtime_claims"."approved_hours" between 1 and "hris"."overtime_claims"."claimed_hours")),
	CONSTRAINT "overtime_claims_reduction" CHECK (("hris"."overtime_claims"."approved_hours" is not null and "hris"."overtime_claims"."approved_hours" < "hris"."overtime_claims"."claimed_hours") = ("hris"."overtime_claims"."reduction_reason" is not null))
);
--> statement-breakpoint
CREATE TABLE "hris"."overtime_days" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"work_date" date NOT NULL,
	"branch_id" integer NOT NULL,
	"scheduled_end" text NOT NULL,
	"out_at" timestamp with time zone NOT NULL,
	"closing_time" text,
	"hours" smallint NOT NULL,
	"choice" "hris"."overtime_choice" DEFAULT 'UNANSWERED' NOT NULL,
	"deadline_at" timestamp with time zone NOT NULL,
	"state" "hris"."overtime_state" DEFAULT 'OPEN' NOT NULL,
	"explained_forgot" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "overtime_days_hours_range" CHECK ("hris"."overtime_days"."hours" between 0 and 24)
);
--> statement-breakpoint
CREATE TABLE "hris"."overtime_photo_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_id" uuid NOT NULL,
	"viewer_account_id" integer NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hris"."overtime_claims" ADD CONSTRAINT "overtime_claims_overtime_day_id_overtime_days_id_fk" FOREIGN KEY ("overtime_day_id") REFERENCES "hris"."overtime_days"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."overtime_claims" ADD CONSTRAINT "overtime_claims_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."overtime_claims" ADD CONSTRAINT "overtime_claims_orderer_employee_id_employees_id_fk" FOREIGN KEY ("orderer_employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."overtime_days" ADD CONSTRAINT "overtime_days_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."overtime_days" ADD CONSTRAINT "overtime_days_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "hris"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."overtime_photo_views" ADD CONSTRAINT "overtime_photo_views_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "hris"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "overtime_claims_request_unique" ON "hris"."overtime_claims" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "overtime_claims_one_active" ON "hris"."overtime_claims" USING btree ("overtime_day_id") WHERE "hris"."overtime_claims"."active";--> statement-breakpoint
CREATE INDEX "overtime_claims_person_idx" ON "hris"."overtime_claims" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "overtime_days_person_date_unique" ON "hris"."overtime_days" USING btree ("employee_id","work_date");--> statement-breakpoint
CREATE INDEX "overtime_days_state_idx" ON "hris"."overtime_days" USING btree ("state","deadline_at");--> statement-breakpoint
CREATE INDEX "overtime_days_date_idx" ON "hris"."overtime_days" USING btree ("work_date");--> statement-breakpoint
CREATE INDEX "overtime_photo_views_file_idx" ON "hris"."overtime_photo_views" USING btree ("file_id");--> statement-breakpoint
-- Ditulis tangan (spec L3h §2): tidak ada yang dihapus (PRI-02). Lembur terdeteksi hanya diperbarui server (angka,
-- pilihan, keadaan, batas); isi klaim tidak berubah selain pengesahan sekali dan pelepasan; catatan buka foto hanya tambah.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['overtime_days','overtime_claims','overtime_photo_views'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON hris.%I FOR EACH ROW EXECUTE FUNCTION hris.reject_change()', t || '_no_delete', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON hris.%I FOR EACH STATEMENT EXECUTE FUNCTION hris.reject_change()', t || '_no_truncate', t);
  END LOOP;
END $$;
--> statement-breakpoint
CREATE TRIGGER overtime_photo_views_no_update BEFORE UPDATE ON hris.overtime_photo_views FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE FUNCTION hris.guard_overtime_day() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.employee_id, NEW.work_date, NEW.created_at) IS DISTINCT FROM (OLD.employee_id, OLD.work_date, OLD.created_at) THEN
    RAISE EXCEPTION 'Lembur terdeteksi tidak bisa dipindah ke orang atau tanggal lain.';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER overtime_days_guard BEFORE UPDATE ON hris.overtime_days FOR EACH ROW EXECUTE FUNCTION hris.guard_overtime_day();
--> statement-breakpoint
CREATE FUNCTION hris.guard_overtime_claim() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.request_id, NEW.overtime_day_id, NEW.employee_id, NEW.claimed_hours, NEW.orderer_employee_id, NEW.created_at)
     IS DISTINCT FROM (OLD.request_id, OLD.overtime_day_id, OLD.employee_id, OLD.claimed_hours, OLD.orderer_employee_id, OLD.created_at) THEN
    RAISE EXCEPTION 'Isi klaim lembur tidak bisa diubah.';
  END IF;
  IF OLD.approved_hours IS NOT NULL AND (NEW.approved_hours, NEW.reduction_reason) IS DISTINCT FROM (OLD.approved_hours, OLD.reduction_reason) THEN
    RAISE EXCEPTION 'Jam disahkan hanya ditulis sekali.';
  END IF;
  IF NOT OLD.active AND NEW.active THEN
    RAISE EXCEPTION 'Klaim lembur yang sudah dilepas tidak bisa dihidupkan lagi.';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER overtime_claims_guard BEFORE UPDATE ON hris.overtime_claims FOR EACH ROW EXECUTE FUNCTION hris.guard_overtime_claim();
--> statement-breakpoint
-- Isi awal pengaturan (harus ada di registry.ts, H18). Spec L3h §2 dan §9 butir 3, 4.
INSERT INTO hris.setting_values (key, value, effective_from, status, reason) VALUES
  ('attendance.overtime_claim_days', '3'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-74, 161)'),
  ('attendance.overtime_min_hours', '1'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-70)'),
  ('attendance.overtime_max_hours', '3'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-70)'),
  ('attendance.office_closing_hour', '20'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-71)'),
  ('position.overtime_applies', '"NO"'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-25)'),
  ('position.overtime_orderer', '"NO"'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-73, 163)');
--> statement-breakpoint
INSERT INTO hris.setting_values (key, target_kind, target_id, value, effective_from, status, reason)
SELECT 'position.overtime_applies', 'POSITION', p.id, '"YES"'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-25): jabatan toko dan kantor'
FROM hris.positions p
WHERE lower(p.name) IN ('kepala toko', 'kasir', 'pramuniaga', 'groomer', 'hr', 'admin hr', 'finance', 'marketing');
--> statement-breakpoint
INSERT INTO hris.setting_values (key, target_kind, target_id, value, effective_from, status, reason)
SELECT 'position.overtime_orderer', 'POSITION', p.id, '"YES"'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-73): HR dan pemilik'
FROM hris.positions p
WHERE lower(p.name) IN ('hr', 'pemilik', 'gm');
--> statement-breakpoint
-- Hak awal (spec L3h §5). Pemilik dan GM punya semuanya lewat full_access.
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('hr', 'overtime.decide', 'ALL'), ('hr', 'overtime.team.view', 'ALL'),
  ('admin hr', 'overtime.team.view', 'ALL'),
  ('kepala toko', 'overtime.team.view', 'BRANCH'),
  ('kepala gudang', 'overtime.team.view', 'DEPARTMENT')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
