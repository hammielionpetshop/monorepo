CREATE TYPE "hris"."handover_recipient_mode" AS ENUM('TEAM', 'PEOPLE');--> statement-breakpoint
CREATE TYPE "hris"."problem_report_origin" AS ENUM('END_OF_DAY', 'MENU');--> statement-breakpoint
CREATE TYPE "hris"."problem_report_status" AS ENUM('RECEIVED', 'IN_PROGRESS', 'DONE');--> statement-breakpoint
CREATE TYPE "hris"."relocation_answer" AS ENUM('YES', 'NOT_YET');--> statement-breakpoint
CREATE TYPE "hris"."report_note_kind" AS ENUM('HANDOVER', 'PROBLEM');--> statement-breakpoint
CREATE TABLE "hris"."end_of_day_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"day_id" integer NOT NULL,
	"out_record_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"handover" text NOT NULL,
	"recipient_mode" "hris"."handover_recipient_mode" NOT NULL,
	"photo_file_id" uuid,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "end_of_day_reports_handover_not_blank" CHECK (btrim("hris"."end_of_day_reports"."handover") <> '')
);
--> statement-breakpoint
CREATE TABLE "hris"."handover_reads" (
	"report_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "handover_reads_report_id_employee_id_pk" PRIMARY KEY("report_id","employee_id")
);
--> statement-breakpoint
CREATE TABLE "hris"."handover_recipients" (
	"report_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	CONSTRAINT "handover_recipients_report_id_employee_id_pk" PRIMARY KEY("report_id","employee_id")
);
--> statement-breakpoint
CREATE TABLE "hris"."problem_report_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"status" "hris"."problem_report_status" NOT NULL,
	"response" text,
	"by_account_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hris"."problem_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"reporter_employee_id" integer NOT NULL,
	"body" text NOT NULL,
	"photo_file_id" uuid,
	"concerns_gm" boolean DEFAULT false NOT NULL,
	"origin" "hris"."problem_report_origin" NOT NULL,
	"end_of_day_report_id" integer,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "problem_reports_body_not_blank" CHECK (btrim("hris"."problem_reports"."body") <> ''),
	CONSTRAINT "problem_reports_origin_link" CHECK (("hris"."problem_reports"."origin" = 'END_OF_DAY') = ("hris"."problem_reports"."end_of_day_report_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "hris"."relocation_prompts" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"work_date" date NOT NULL,
	"from_branch_id" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"answer" "hris"."relocation_answer" NOT NULL,
	"request_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "relocation_prompts_request_when_yes" CHECK (("hris"."relocation_prompts"."answer" = 'YES') = ("hris"."relocation_prompts"."request_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "hris"."report_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" "hris"."report_note_kind" NOT NULL,
	"report_id" integer NOT NULL,
	"body" text NOT NULL,
	"by_employee_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_notes_body_not_blank" CHECK (btrim("hris"."report_notes"."body") <> '')
);
--> statement-breakpoint
ALTER TABLE "hris"."end_of_day_reports" ADD CONSTRAINT "end_of_day_reports_day_id_attendance_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "hris"."attendance_days"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."end_of_day_reports" ADD CONSTRAINT "end_of_day_reports_out_record_id_attendance_records_id_fk" FOREIGN KEY ("out_record_id") REFERENCES "hris"."attendance_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."end_of_day_reports" ADD CONSTRAINT "end_of_day_reports_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."end_of_day_reports" ADD CONSTRAINT "end_of_day_reports_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "hris"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."end_of_day_reports" ADD CONSTRAINT "end_of_day_reports_photo_file_id_files_id_fk" FOREIGN KEY ("photo_file_id") REFERENCES "hris"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."handover_reads" ADD CONSTRAINT "handover_reads_report_id_end_of_day_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "hris"."end_of_day_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."handover_reads" ADD CONSTRAINT "handover_reads_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."handover_recipients" ADD CONSTRAINT "handover_recipients_report_id_end_of_day_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "hris"."end_of_day_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."handover_recipients" ADD CONSTRAINT "handover_recipients_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."problem_report_events" ADD CONSTRAINT "problem_report_events_report_id_problem_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "hris"."problem_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."problem_reports" ADD CONSTRAINT "problem_reports_reporter_employee_id_employees_id_fk" FOREIGN KEY ("reporter_employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."problem_reports" ADD CONSTRAINT "problem_reports_photo_file_id_files_id_fk" FOREIGN KEY ("photo_file_id") REFERENCES "hris"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."problem_reports" ADD CONSTRAINT "problem_reports_end_of_day_report_id_end_of_day_reports_id_fk" FOREIGN KEY ("end_of_day_report_id") REFERENCES "hris"."end_of_day_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."relocation_prompts" ADD CONSTRAINT "relocation_prompts_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."relocation_prompts" ADD CONSTRAINT "relocation_prompts_from_branch_id_branches_id_fk" FOREIGN KEY ("from_branch_id") REFERENCES "hris"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."relocation_prompts" ADD CONSTRAINT "relocation_prompts_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "hris"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."report_notes" ADD CONSTRAINT "report_notes_by_employee_id_employees_id_fk" FOREIGN KEY ("by_employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "end_of_day_reports_day_unique" ON "hris"."end_of_day_reports" USING btree ("day_id");--> statement-breakpoint
CREATE INDEX "end_of_day_reports_branch_time_idx" ON "hris"."end_of_day_reports" USING btree ("branch_id","submitted_at");--> statement-breakpoint
CREATE INDEX "end_of_day_reports_person_idx" ON "hris"."end_of_day_reports" USING btree ("employee_id","submitted_at");--> statement-breakpoint
CREATE INDEX "handover_recipients_person_idx" ON "hris"."handover_recipients" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "problem_report_events_report_idx" ON "hris"."problem_report_events" USING btree ("report_id","id");--> statement-breakpoint
CREATE INDEX "problem_reports_time_idx" ON "hris"."problem_reports" USING btree ("submitted_at");--> statement-breakpoint
CREATE INDEX "problem_reports_reporter_idx" ON "hris"."problem_reports" USING btree ("reporter_employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "problem_reports_one_per_end_of_day" ON "hris"."problem_reports" USING btree ("end_of_day_report_id") WHERE "hris"."problem_reports"."end_of_day_report_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "relocation_prompts_person_date_unique" ON "hris"."relocation_prompts" USING btree ("employee_id","work_date");--> statement-breakpoint
CREATE UNIQUE INDEX "relocation_prompts_request_unique" ON "hris"."relocation_prompts" USING btree ("request_id") WHERE "hris"."relocation_prompts"."request_id" is not null;--> statement-breakpoint
CREATE INDEX "report_notes_report_idx" ON "hris"."report_notes" USING btree ("kind","report_id");--> statement-breakpoint
-- Ditulis tangan (spec L3d §2): semua tabel L3d hanya tambah (KEH-95, PRI-02).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['end_of_day_reports','handover_recipients','handover_reads','problem_reports','problem_report_events','report_notes','relocation_prompts'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON hris.%I FOR EACH ROW EXECUTE FUNCTION hris.reject_change()', t || '_no_update', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON hris.%I FOR EACH ROW EXECUTE FUNCTION hris.reject_change()', t || '_no_delete', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON hris.%I FOR EACH STATEMENT EXECUTE FUNCTION hris.reject_change()', t || '_no_truncate', t);
  END LOOP;
END $$;
--> statement-breakpoint
-- Isi awal pengaturan (harus ada di registry.ts, H18). Spec L3d §2.
INSERT INTO hris.setting_values (key, value, effective_from, status, reason) VALUES
  ('attendance.handover_min_length', '20'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-90)'),
  ('attendance.handover_popup_days', '7'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-126)'),
  ('attendance.relocation_prompt_workdays', '7'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-27)');
--> statement-breakpoint
-- Hak awal (spec L3d §5). Laporan Masalah hanya Pemilik/GM lewat full_access (ownerOnly).
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('hr', 'attendance.handover.view', 'ALL'), ('hr', 'relocation.decide', 'ALL'),
  ('kepala toko', 'attendance.handover.view', 'BRANCH'), ('kepala gudang', 'attendance.handover.view', 'DEPARTMENT')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
