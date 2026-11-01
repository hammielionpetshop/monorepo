CREATE TYPE "hris"."attendance_attempt_result" AS ENUM('OK', 'OUTSIDE', 'NO_LOCATION', 'BAD_QR', 'WRONG_BRANCH', 'TOO_EARLY', 'CLOSED', 'TOO_SOON');--> statement-breakpoint
CREATE TYPE "hris"."attendance_kind" AS ENUM('IN', 'BREAK', 'RETURN', 'OUT');--> statement-breakpoint
CREATE TYPE "hris"."branch_assist_answer" AS ENUM('ASSIST', 'WRONG_SCAN');--> statement-breakpoint
CREATE TABLE "hris"."attendance_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"kind" "hris"."attendance_kind" NOT NULL,
	"qr_code_id" integer,
	"branch_id" integer,
	"latitude" double precision,
	"longitude" double precision,
	"accuracy_m" integer,
	"distance_m" integer,
	"result" "hris"."attendance_attempt_result" NOT NULL,
	"is_assist" boolean DEFAULT false NOT NULL,
	"chosen_shift_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hris"."attendance_days" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"work_date" date NOT NULL,
	"branch_id" integer NOT NULL,
	"position_id" integer NOT NULL,
	"shift_id" integer,
	"shift_version_id" integer,
	"shift_source" text NOT NULL,
	"late_minutes" integer,
	"early_leave_minutes" integer,
	"break_over_minutes" integer,
	"alone_no_break" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hris"."attendance_photo_purges" (
	"file_id" uuid PRIMARY KEY NOT NULL,
	"purged_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hris"."attendance_photo_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"record_id" integer NOT NULL,
	"viewed_by_account_id" integer NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hris"."attendance_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"day_id" integer NOT NULL,
	"kind" "hris"."attendance_kind" NOT NULL,
	"branch_id" integer NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"accuracy_m" integer,
	"distance_m" integer,
	"needs_review" boolean DEFAULT false NOT NULL,
	"photo_file_id" uuid,
	"attempt_id" integer,
	CONSTRAINT "attendance_records_proof" CHECK ("hris"."attendance_records"."kind" = 'BREAK' or ("hris"."attendance_records"."latitude" is not null and "hris"."attendance_records"."longitude" is not null and "hris"."attendance_records"."distance_m" is not null and "hris"."attendance_records"."photo_file_id" is not null and "hris"."attendance_records"."attempt_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "hris"."branch_assists" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"work_date" date NOT NULL,
	"home_branch_id" integer NOT NULL,
	"target_branch_id" integer NOT NULL,
	"answer" "hris"."branch_assist_answer" NOT NULL,
	"shift_id" integer,
	"shift_chosen" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hris"."attendance_attempts" ADD CONSTRAINT "attendance_attempts_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."attendance_attempts" ADD CONSTRAINT "attendance_attempts_qr_code_id_branch_qr_codes_id_fk" FOREIGN KEY ("qr_code_id") REFERENCES "hris"."branch_qr_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."attendance_attempts" ADD CONSTRAINT "attendance_attempts_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "hris"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."attendance_attempts" ADD CONSTRAINT "attendance_attempts_chosen_shift_id_work_shifts_id_fk" FOREIGN KEY ("chosen_shift_id") REFERENCES "hris"."work_shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."attendance_days" ADD CONSTRAINT "attendance_days_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."attendance_days" ADD CONSTRAINT "attendance_days_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "hris"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."attendance_days" ADD CONSTRAINT "attendance_days_shift_id_work_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "hris"."work_shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."attendance_days" ADD CONSTRAINT "attendance_days_shift_version_id_work_shift_versions_id_fk" FOREIGN KEY ("shift_version_id") REFERENCES "hris"."work_shift_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."attendance_photo_purges" ADD CONSTRAINT "attendance_photo_purges_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "hris"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."attendance_photo_views" ADD CONSTRAINT "attendance_photo_views_record_id_attendance_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "hris"."attendance_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."attendance_records" ADD CONSTRAINT "attendance_records_day_id_attendance_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "hris"."attendance_days"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."attendance_records" ADD CONSTRAINT "attendance_records_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "hris"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."attendance_records" ADD CONSTRAINT "attendance_records_photo_file_id_files_id_fk" FOREIGN KEY ("photo_file_id") REFERENCES "hris"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."attendance_records" ADD CONSTRAINT "attendance_records_attempt_id_attendance_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "hris"."attendance_attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."branch_assists" ADD CONSTRAINT "branch_assists_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."branch_assists" ADD CONSTRAINT "branch_assists_home_branch_id_branches_id_fk" FOREIGN KEY ("home_branch_id") REFERENCES "hris"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."branch_assists" ADD CONSTRAINT "branch_assists_target_branch_id_branches_id_fk" FOREIGN KEY ("target_branch_id") REFERENCES "hris"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."branch_assists" ADD CONSTRAINT "branch_assists_shift_id_work_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "hris"."work_shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendance_attempts_person_time_idx" ON "hris"."attendance_attempts" USING btree ("employee_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_days_person_date_unique" ON "hris"."attendance_days" USING btree ("employee_id","work_date");--> statement-breakpoint
CREATE INDEX "attendance_days_branch_date_idx" ON "hris"."attendance_days" USING btree ("branch_id","work_date");--> statement-breakpoint
CREATE INDEX "attendance_photo_views_record_idx" ON "hris"."attendance_photo_views" USING btree ("record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_records_day_kind_unique" ON "hris"."attendance_records" USING btree ("day_id","kind");--> statement-breakpoint
CREATE INDEX "attendance_records_time_idx" ON "hris"."attendance_records" USING btree ("recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "branch_assists_one_per_day" ON "hris"."branch_assists" USING btree ("employee_id","work_date") WHERE "hris"."branch_assists"."answer" = 'ASSIST';--> statement-breakpoint
CREATE INDEX "branch_assists_target_date_idx" ON "hris"."branch_assists" USING btree ("target_branch_id","work_date");--> statement-breakpoint
-- Ditulis tangan (spec L3b §2): pagar data. Catatan absen tidak bisa diubah atau dihapus (KEH-16, PRI-02).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['attendance_attempts','attendance_days','attendance_records','branch_assists','attendance_photo_views','attendance_photo_purges'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON hris.%I FOR EACH ROW EXECUTE FUNCTION hris.reject_change()', t || '_no_delete', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON hris.%I FOR EACH STATEMENT EXECUTE FUNCTION hris.reject_change()', t || '_no_truncate', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['attendance_attempts','attendance_records','branch_assists','attendance_photo_views','attendance_photo_purges'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON hris.%I FOR EACH ROW EXECUTE FUNCTION hris.reject_change()', t || '_no_update', t);
  END LOOP;
END $$;
--> statement-breakpoint
-- Hari kerja: identitasnya tetap; angka hitungan hanya bisa diisi sekali (KEH-21, 86).
CREATE FUNCTION hris.guard_attendance_day() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.employee_id, NEW.work_date, NEW.branch_id, NEW.position_id, NEW.shift_source, NEW.created_at)
       IS DISTINCT FROM (OLD.employee_id, OLD.work_date, OLD.branch_id, OLD.position_id, OLD.shift_source, OLD.created_at)
     OR NEW.shift_id IS DISTINCT FROM OLD.shift_id OR NEW.shift_version_id IS DISTINCT FROM OLD.shift_version_id
     OR (OLD.late_minutes IS NOT NULL AND NEW.late_minutes IS DISTINCT FROM OLD.late_minutes)
     OR (OLD.early_leave_minutes IS NOT NULL AND NEW.early_leave_minutes IS DISTINCT FROM OLD.early_leave_minutes)
     OR (OLD.break_over_minutes IS NOT NULL AND NEW.break_over_minutes IS DISTINCT FROM OLD.break_over_minutes)
     OR (OLD.alone_no_break AND NOT NEW.alone_no_break) THEN
    RAISE EXCEPTION 'Hari kerja tidak bisa diubah; koreksi lewat pintu koreksi.';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER attendance_days_guard BEFORE UPDATE ON hris.attendance_days
  FOR EACH ROW EXECUTE FUNCTION hris.guard_attendance_day();
--> statement-breakpoint
-- Isi awal pengaturan (harus ada di registry.ts, H18). Spec L3b §2.
INSERT INTO hris.setting_values (key, value, effective_from, status, reason) VALUES
  ('attendance.earliest_in_minutes', '120'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-111)'),
  ('attendance.min_out_minutes', '15'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-17)'),
  ('attendance.out_cutoff_hour', '4'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-18)'),
  ('attendance.photo_retention_days', '60'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-15)'),
  ('attendance.guard_minimum', '1'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-85)'),
  ('position.late_applies', '"YES"'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-25)'),
  ('position.break_required', '"YES"'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-84)'),
  ('position.is_guard', '"NO"'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-85)');
--> statement-breakpoint
INSERT INTO hris.setting_values (key, target_kind, target_id, value, effective_from, status, reason)
SELECT 'position.break_required', 'POSITION', p.id, '"NO"'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-84)'
FROM hris.positions p JOIN hris.departments d ON d.id = p.department_id WHERE lower(d.name) = 'team gudang';
--> statement-breakpoint
INSERT INTO hris.setting_values (key, target_kind, target_id, value, effective_from, status, reason)
SELECT 'position.is_guard', 'POSITION', p.id, '"YES"'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-85)'
FROM hris.positions p WHERE lower(p.name) = 'kasir';
--> statement-breakpoint
-- Hak awal (spec L3b §5). Pemilik dan GM punya semuanya lewat full_access.
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('hr', 'attendance.assist.view', 'ALL'), ('hr', 'attendance.photo.view', 'ALL'), ('hr', 'attendance.attempts.view', 'ALL'),
  ('admin hr', 'attendance.assist.view', 'ALL'),
  ('kepala toko', 'attendance.assist.view', 'BRANCH'), ('kepala toko', 'attendance.photo.view', 'BRANCH'),
  ('kepala gudang', 'attendance.assist.view', 'DEPARTMENT'), ('kepala gudang', 'attendance.photo.view', 'DEPARTMENT')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, 'attendance.self.check', 'SELF'::hris.access_scope
FROM hris.positions p WHERE NOT p.full_access
ON CONFLICT DO NOTHING;
