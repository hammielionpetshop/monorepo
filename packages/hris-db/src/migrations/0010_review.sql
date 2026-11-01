CREATE TYPE "hris"."attendance_correction_reason" AS ENUM('DEVICE', 'MOVED', 'WRONG_RECORD', 'OTHER');--> statement-breakpoint
CREATE TYPE "hris"."attendance_pattern_kind" AS ENUM('REPEAT_OUTSIDE', 'SHARED_POINT');--> statement-breakpoint
CREATE TYPE "hris"."attendance_review_outcome" AS ENUM('FINE', 'NEEDS_CORRECTION');--> statement-breakpoint
CREATE TABLE "hris"."attendance_corrections" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"work_date" date NOT NULL,
	"branch_id" integer,
	"shift_id" integer,
	"shift_version_id" integer,
	"in_at" timestamp with time zone,
	"out_at" timestamp with time zone,
	"prev_branch_id" integer,
	"prev_shift_id" integer,
	"prev_shift_version_id" integer,
	"prev_in_at" timestamp with time zone,
	"prev_out_at" timestamp with time zone,
	"late_minutes" integer,
	"early_leave_minutes" integer,
	"reason_code" "hris"."attendance_correction_reason" NOT NULL,
	"note" text NOT NULL,
	"batch_id" uuid,
	"reverses_id" integer,
	"created_by_account_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_corrections_state" CHECK (("hris"."attendance_corrections"."in_at" is null) = ("hris"."attendance_corrections"."branch_id" is null) and ("hris"."attendance_corrections"."out_at" is null or "hris"."attendance_corrections"."in_at" is not null)),
	CONSTRAINT "attendance_corrections_order" CHECK ("hris"."attendance_corrections"."out_at" is null or "hris"."attendance_corrections"."out_at" > "hris"."attendance_corrections"."in_at"),
	CONSTRAINT "attendance_corrections_note_not_blank" CHECK (btrim("hris"."attendance_corrections"."note") <> '')
);
--> statement-breakpoint
CREATE TABLE "hris"."attendance_pattern_flags" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" "hris"."attendance_pattern_kind" NOT NULL,
	"detected_on" date NOT NULL,
	"fingerprint" text NOT NULL,
	"employee_ids" integer[] NOT NULL,
	"record_ids" integer[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hris"."attendance_pattern_seen" (
	"id" serial PRIMARY KEY NOT NULL,
	"flag_id" integer NOT NULL,
	"seen_by_account_id" integer NOT NULL,
	"note" text NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hris"."attendance_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"record_id" integer NOT NULL,
	"outcome" "hris"."attendance_review_outcome" NOT NULL,
	"reason" text NOT NULL,
	"decided_by_account_id" integer NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_reviews_reason_not_blank" CHECK (btrim("hris"."attendance_reviews"."reason") <> '')
);
--> statement-breakpoint
ALTER TABLE "hris"."attendance_corrections" ADD CONSTRAINT "attendance_corrections_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."attendance_corrections" ADD CONSTRAINT "attendance_corrections_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "hris"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."attendance_corrections" ADD CONSTRAINT "attendance_corrections_shift_id_work_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "hris"."work_shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."attendance_corrections" ADD CONSTRAINT "attendance_corrections_shift_version_id_work_shift_versions_id_fk" FOREIGN KEY ("shift_version_id") REFERENCES "hris"."work_shift_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."attendance_corrections" ADD CONSTRAINT "attendance_corrections_prev_branch_id_branches_id_fk" FOREIGN KEY ("prev_branch_id") REFERENCES "hris"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."attendance_corrections" ADD CONSTRAINT "attendance_corrections_prev_shift_id_work_shifts_id_fk" FOREIGN KEY ("prev_shift_id") REFERENCES "hris"."work_shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."attendance_corrections" ADD CONSTRAINT "attendance_corrections_prev_shift_version_id_work_shift_versions_id_fk" FOREIGN KEY ("prev_shift_version_id") REFERENCES "hris"."work_shift_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."attendance_pattern_seen" ADD CONSTRAINT "attendance_pattern_seen_flag_id_attendance_pattern_flags_id_fk" FOREIGN KEY ("flag_id") REFERENCES "hris"."attendance_pattern_flags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."attendance_reviews" ADD CONSTRAINT "attendance_reviews_record_id_attendance_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "hris"."attendance_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendance_corrections_person_date_idx" ON "hris"."attendance_corrections" USING btree ("employee_id","work_date","id");--> statement-breakpoint
CREATE INDEX "attendance_corrections_date_idx" ON "hris"."attendance_corrections" USING btree ("work_date");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_pattern_flags_fingerprint_unique" ON "hris"."attendance_pattern_flags" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "attendance_pattern_flags_detected_idx" ON "hris"."attendance_pattern_flags" USING btree ("detected_on");--> statement-breakpoint
CREATE INDEX "attendance_pattern_seen_flag_idx" ON "hris"."attendance_pattern_seen" USING btree ("flag_id");--> statement-breakpoint
CREATE INDEX "attendance_reviews_record_idx" ON "hris"."attendance_reviews" USING btree ("record_id","id");--> statement-breakpoint
-- Ditulis tangan (spec L3c §2): semua tabel L3c hanya tambah (PRI-02). Putusan dan koreksi baru selalu baris baru.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['attendance_reviews','attendance_corrections','attendance_pattern_flags','attendance_pattern_seen'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON hris.%I FOR EACH ROW EXECUTE FUNCTION hris.reject_change()', t || '_no_update', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON hris.%I FOR EACH ROW EXECUTE FUNCTION hris.reject_change()', t || '_no_delete', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON hris.%I FOR EACH STATEMENT EXECUTE FUNCTION hris.reject_change()', t || '_no_truncate', t);
  END LOOP;
END $$;
--> statement-breakpoint
-- Isi awal pengaturan (harus ada di registry.ts, H18). Spec L3c §2.
INSERT INTO hris.setting_values (key, value, effective_from, status, reason) VALUES
  ('attendance.late_tolerance_minutes', '5'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-22)'),
  ('attendance.pattern_outside_count', '3'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-115)'),
  ('attendance.pattern_window_workdays', '7'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-115)'),
  ('attendance.pattern_same_point_m', '10'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-115)');
--> statement-breakpoint
-- Hak awal (spec L3c §5). Pemilik dan GM punya semuanya lewat full_access.
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('hr', 'attendance.review.view', 'ALL'), ('hr', 'attendance.review.decide', 'ALL'), ('hr', 'attendance.correction.create', 'ALL'),
  ('hr', 'attendance.correction.view', 'ALL'), ('hr', 'attendance.recap.view', 'ALL'),
  ('admin hr', 'attendance.review.view', 'ALL'), ('admin hr', 'attendance.correction.view', 'ALL'), ('admin hr', 'attendance.recap.view', 'ALL'),
  ('kepala toko', 'attendance.review.view', 'BRANCH'), ('kepala toko', 'attendance.recap.view', 'BRANCH'),
  ('kepala gudang', 'attendance.review.view', 'DEPARTMENT'), ('kepala gudang', 'attendance.recap.view', 'DEPARTMENT'),
  ('finance', 'attendance.correction.view', 'ALL'), ('finance', 'attendance.recap.view', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, 'attendance.my_recap.view', 'SELF'::hris.access_scope
FROM hris.positions p WHERE NOT p.full_access
ON CONFLICT DO NOTHING;
