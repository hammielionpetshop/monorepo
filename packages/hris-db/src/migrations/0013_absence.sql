CREATE TYPE "hris"."absence_count" AS ENUM('PERMIT', 'PERMIT_SUDDEN', 'SICK', 'SICK_LETTER', 'ANNUAL_LEAVE', 'BEREAVEMENT');--> statement-breakpoint
CREATE TYPE "hris"."absence_kind" AS ENUM('PERMIT', 'SICK', 'SICK_LETTER', 'ANNUAL_LEAVE', 'BEREAVEMENT');--> statement-breakpoint
CREATE TYPE "hris"."absence_origin" AS ENUM('SELF', 'ON_BEHALF', 'CLARIFICATION');--> statement-breakpoint
CREATE TYPE "hris"."leave_movement_kind" AS ENUM('RESERVE', 'USE', 'RETURN', 'EXPIRE', 'ADJUST');--> statement-breakpoint
CREATE TABLE "hris"."absence_days" (
	"id" serial PRIMARY KEY NOT NULL,
	"absence_request_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"work_date" date NOT NULL,
	"count_kind" "hris"."absence_count" NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hris"."absence_notices" (
	"ref" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hris"."absence_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"kind" "hris"."absence_kind" NOT NULL,
	"sudden" boolean DEFAULT false NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"relation" text,
	"reason" text,
	"letter_pending" boolean DEFAULT false NOT NULL,
	"origin" "hris"."absence_origin" NOT NULL,
	"on_behalf_reason" text,
	"created_by_account_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "absence_requests_range" CHECK ("hris"."absence_requests"."end_date" >= "hris"."absence_requests"."start_date"),
	CONSTRAINT "absence_requests_on_behalf_reason" CHECK (("hris"."absence_requests"."origin" = 'ON_BEHALF') = ("hris"."absence_requests"."on_behalf_reason" is not null)),
	CONSTRAINT "absence_requests_relation" CHECK (("hris"."absence_requests"."kind" = 'BEREAVEMENT') = ("hris"."absence_requests"."relation" is not null)),
	CONSTRAINT "absence_requests_letter_pending" CHECK (not "hris"."absence_requests"."letter_pending" or "hris"."absence_requests"."kind" = 'SICK_LETTER')
);
--> statement-breakpoint
CREATE TABLE "hris"."doctor_letter_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_id" uuid NOT NULL,
	"viewer_account_id" integer NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hris"."doctor_letters" (
	"id" serial PRIMARY KEY NOT NULL,
	"absence_request_id" integer NOT NULL,
	"file_id" uuid NOT NULL,
	"uploaded_by_account_id" integer NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"late" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hris"."leave_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"leave_year_id" integer NOT NULL,
	"kind" "hris"."leave_movement_kind" NOT NULL,
	"days" smallint NOT NULL,
	"absence_request_id" integer,
	"by_account_id" integer,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leave_movements_days" CHECK ("hris"."leave_movements"."kind" = 'ADJUST' or "hris"."leave_movements"."days" >= 0),
	CONSTRAINT "leave_movements_adjust_reason" CHECK ("hris"."leave_movements"."kind" <> 'ADJUST' or ("hris"."leave_movements"."reason" is not null and btrim("hris"."leave_movements"."reason") <> '')),
	CONSTRAINT "leave_movements_request" CHECK ("hris"."leave_movements"."kind" in ('EXPIRE', 'ADJUST') or "hris"."leave_movements"."absence_request_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "hris"."leave_years" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"quota" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leave_years_range" CHECK ("hris"."leave_years"."end_date" > "hris"."leave_years"."start_date"),
	CONSTRAINT "leave_years_quota" CHECK ("hris"."leave_years"."quota" >= 0)
);
--> statement-breakpoint
ALTER TABLE "hris"."absence_days" ADD CONSTRAINT "absence_days_absence_request_id_absence_requests_id_fk" FOREIGN KEY ("absence_request_id") REFERENCES "hris"."absence_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."absence_days" ADD CONSTRAINT "absence_days_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."absence_requests" ADD CONSTRAINT "absence_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."doctor_letter_views" ADD CONSTRAINT "doctor_letter_views_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "hris"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."doctor_letters" ADD CONSTRAINT "doctor_letters_absence_request_id_absence_requests_id_fk" FOREIGN KEY ("absence_request_id") REFERENCES "hris"."absence_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."doctor_letters" ADD CONSTRAINT "doctor_letters_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "hris"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."leave_movements" ADD CONSTRAINT "leave_movements_leave_year_id_leave_years_id_fk" FOREIGN KEY ("leave_year_id") REFERENCES "hris"."leave_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."leave_movements" ADD CONSTRAINT "leave_movements_absence_request_id_absence_requests_id_fk" FOREIGN KEY ("absence_request_id") REFERENCES "hris"."absence_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."leave_years" ADD CONSTRAINT "leave_years_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "absence_days_one_active_per_date" ON "hris"."absence_days" USING btree ("employee_id","work_date") WHERE "hris"."absence_days"."active";--> statement-breakpoint
CREATE INDEX "absence_days_date_idx" ON "hris"."absence_days" USING btree ("work_date");--> statement-breakpoint
CREATE INDEX "absence_days_request_idx" ON "hris"."absence_days" USING btree ("absence_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "absence_requests_request_unique" ON "hris"."absence_requests" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "absence_requests_person_idx" ON "hris"."absence_requests" USING btree ("employee_id","start_date");--> statement-breakpoint
CREATE INDEX "doctor_letter_views_file_idx" ON "hris"."doctor_letter_views" USING btree ("file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "doctor_letters_request_unique" ON "hris"."doctor_letters" USING btree ("absence_request_id");--> statement-breakpoint
CREATE INDEX "leave_movements_year_idx" ON "hris"."leave_movements" USING btree ("leave_year_id");--> statement-breakpoint
CREATE UNIQUE INDEX "leave_movements_one_expire" ON "hris"."leave_movements" USING btree ("leave_year_id") WHERE "hris"."leave_movements"."kind" = 'EXPIRE';--> statement-breakpoint
CREATE UNIQUE INDEX "leave_years_person_start_unique" ON "hris"."leave_years" USING btree ("employee_id","start_date");--> statement-breakpoint
-- Ditulis tangan (spec L3f §2): tidak ada yang dihapus (PRI-02); isi pengajuan tidak bisa diubah; hari hanya bisa
-- dilepas (berlaku → tidak) atau naik dari sakit tanpa surat ke sakit dengan surat; gerak cuti hanya tambah.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['absence_requests','absence_days','doctor_letters','doctor_letter_views','leave_years','leave_movements','absence_notices'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON hris.%I FOR EACH ROW EXECUTE FUNCTION hris.reject_change()', t || '_no_delete', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON hris.%I FOR EACH STATEMENT EXECUTE FUNCTION hris.reject_change()', t || '_no_truncate', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['absence_requests','doctor_letters','doctor_letter_views','leave_years','leave_movements','absence_notices'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON hris.%I FOR EACH ROW EXECUTE FUNCTION hris.reject_change()', t || '_no_update', t);
  END LOOP;
END $$;
--> statement-breakpoint
CREATE FUNCTION hris.guard_absence_day() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT OLD.active
     OR (NEW.absence_request_id, NEW.employee_id, NEW.work_date) IS DISTINCT FROM (OLD.absence_request_id, OLD.employee_id, OLD.work_date)
     OR (NEW.count_kind IS DISTINCT FROM OLD.count_kind AND NOT (OLD.count_kind = 'SICK' AND NEW.count_kind = 'SICK_LETTER' AND NEW.active)) THEN
    RAISE EXCEPTION 'Hari tidak masuk tidak bisa diubah; batalkan atau cabut pengajuannya.';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER absence_days_guard BEFORE UPDATE ON hris.absence_days FOR EACH ROW EXECUTE FUNCTION hris.guard_absence_day();
--> statement-breakpoint
-- Isi awal pengaturan (harus ada di registry.ts, H18). Spec L3f §2.
INSERT INTO hris.setting_values (key, value, effective_from, status, reason) VALUES
  ('attendance.leave_annual_quota', '10'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-48)'),
  ('attendance.leave_annual_notice_days', '7'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-48, 141)'),
  ('attendance.leave_permit_notice_days', '2'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-50, 142)'),
  ('attendance.leave_late_submit_days', '3'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-141)'),
  ('attendance.sick_no_letter_max_days', '2'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-50, 143)'),
  ('attendance.bereavement_days', '2'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-49, 146)'),
  ('attendance.doctor_letter_grace_days', '3'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-51, 143)');
--> statement-breakpoint
-- Hak awal (spec L3f §5). Pemilik dan GM punya semuanya lewat full_access.
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('hr', 'absence.decide', 'ALL'), ('hr', 'absence.submit_for', 'ALL'), ('hr', 'absence.adjust_leave', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
