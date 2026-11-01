CREATE TYPE "hris"."shift_assignment_origin" AS ENUM('MACHINE', 'INITIAL', 'MANUAL');--> statement-breakpoint
CREATE TABLE "hris"."branch_closures" (
	"id" serial PRIMARY KEY NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"branch_id" integer,
	"reason" text NOT NULL,
	"backdated" boolean NOT NULL,
	"created_by_account_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_account_id" integer,
	"cancel_reason" text,
	CONSTRAINT "branch_closures_range" CHECK ("hris"."branch_closures"."end_date" >= "hris"."branch_closures"."start_date"),
	CONSTRAINT "branch_closures_reason_not_blank" CHECK (btrim("hris"."branch_closures"."reason") <> ''),
	CONSTRAINT "branch_closures_cancel_complete" CHECK (("hris"."branch_closures"."cancelled_at" is null) = ("hris"."branch_closures"."cancel_reason" is null))
);
--> statement-breakpoint
CREATE TABLE "hris"."branch_qr_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer NOT NULL,
	"code" text NOT NULL,
	"created_by_account_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dead_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "hris"."shift_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"week_start" date NOT NULL,
	"shift_id" integer NOT NULL,
	"origin" "hris"."shift_assignment_origin" NOT NULL,
	"created_by_account_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shift_assignments_monday" CHECK (extract(isodow from "hris"."shift_assignments"."week_start") = 1)
);
--> statement-breakpoint
CREATE TABLE "hris"."shift_check_notices" (
	"branch_id" integer NOT NULL,
	"week_start" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shift_check_notices_branch_id_week_start_pk" PRIMARY KEY("branch_id","week_start")
);
--> statement-breakpoint
CREATE TABLE "hris"."shift_day_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"work_date" date NOT NULL,
	"shift_id" integer NOT NULL,
	"previous_shift_id" integer,
	"reason" text NOT NULL,
	"created_by_account_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shift_day_changes_reason_not_blank" CHECK (btrim("hris"."shift_day_changes"."reason") <> '')
);
--> statement-breakpoint
CREATE TABLE "hris"."shift_group_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"effective_from" date NOT NULL,
	"effective_until" date,
	"created_by_account_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hris"."shift_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer NOT NULL,
	"position" smallint NOT NULL,
	"name" text NOT NULL,
	"anchor_week" date NOT NULL,
	"created_by_account_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shift_groups_two_per_branch" CHECK ("hris"."shift_groups"."position" in (0, 1))
);
--> statement-breakpoint
CREATE TABLE "hris"."work_shift_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"shift_id" integer NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"break_minutes" smallint,
	"break_start_from" time,
	"break_start_until" time,
	"effective_from" date NOT NULL,
	"effective_until" date,
	"reason" text NOT NULL,
	"created_by_account_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_account_id" integer,
	"cancel_reason" text,
	CONSTRAINT "work_shift_versions_hours_differ" CHECK ("hris"."work_shift_versions"."start_time" <> "hris"."work_shift_versions"."end_time"),
	CONSTRAINT "work_shift_versions_break_complete" CHECK (("hris"."work_shift_versions"."break_minutes" is null) = ("hris"."work_shift_versions"."break_start_from" is null)
      and ("hris"."work_shift_versions"."break_minutes" is null) = ("hris"."work_shift_versions"."break_start_until" is null)),
	CONSTRAINT "work_shift_versions_range" CHECK ("hris"."work_shift_versions"."effective_until" is null or "hris"."work_shift_versions"."effective_until" >= "hris"."work_shift_versions"."effective_from"),
	CONSTRAINT "work_shift_versions_reason_not_blank" CHECK (btrim("hris"."work_shift_versions"."reason") <> '')
);
--> statement-breakpoint
CREATE TABLE "hris"."work_shifts" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer NOT NULL,
	"name" text NOT NULL,
	"position" smallint NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by_account_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_shifts_name_not_blank" CHECK (btrim("hris"."work_shifts"."name") <> '')
);
--> statement-breakpoint
ALTER TABLE "hris"."branch_closures" ADD CONSTRAINT "branch_closures_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "hris"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."branch_qr_codes" ADD CONSTRAINT "branch_qr_codes_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "hris"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."shift_assignments" ADD CONSTRAINT "shift_assignments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."shift_assignments" ADD CONSTRAINT "shift_assignments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "hris"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."shift_assignments" ADD CONSTRAINT "shift_assignments_shift_id_work_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "hris"."work_shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."shift_check_notices" ADD CONSTRAINT "shift_check_notices_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "hris"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."shift_day_changes" ADD CONSTRAINT "shift_day_changes_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."shift_day_changes" ADD CONSTRAINT "shift_day_changes_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "hris"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."shift_day_changes" ADD CONSTRAINT "shift_day_changes_shift_id_work_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "hris"."work_shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."shift_day_changes" ADD CONSTRAINT "shift_day_changes_previous_shift_id_work_shifts_id_fk" FOREIGN KEY ("previous_shift_id") REFERENCES "hris"."work_shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."shift_group_members" ADD CONSTRAINT "shift_group_members_group_id_shift_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "hris"."shift_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."shift_group_members" ADD CONSTRAINT "shift_group_members_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."shift_groups" ADD CONSTRAINT "shift_groups_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "hris"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."work_shift_versions" ADD CONSTRAINT "work_shift_versions_shift_id_work_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "hris"."work_shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."work_shifts" ADD CONSTRAINT "work_shifts_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "hris"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "branch_closures_dates_idx" ON "hris"."branch_closures" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE UNIQUE INDEX "branch_qr_codes_code_unique" ON "hris"."branch_qr_codes" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "branch_qr_codes_one_alive" ON "hris"."branch_qr_codes" USING btree ("branch_id") WHERE "hris"."branch_qr_codes"."dead_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "shift_assignments_person_week_unique" ON "hris"."shift_assignments" USING btree ("employee_id","branch_id","week_start");--> statement-breakpoint
CREATE INDEX "shift_assignments_branch_week_idx" ON "hris"."shift_assignments" USING btree ("branch_id","week_start");--> statement-breakpoint
CREATE INDEX "shift_day_changes_person_date_idx" ON "hris"."shift_day_changes" USING btree ("employee_id","work_date");--> statement-breakpoint
CREATE UNIQUE INDEX "shift_group_members_one_open" ON "hris"."shift_group_members" USING btree ("employee_id") WHERE "hris"."shift_group_members"."effective_until" is null;--> statement-breakpoint
CREATE INDEX "shift_group_members_group_idx" ON "hris"."shift_group_members" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shift_groups_branch_position_unique" ON "hris"."shift_groups" USING btree ("branch_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "work_shift_versions_one_per_day" ON "hris"."work_shift_versions" USING btree ("shift_id","effective_from") WHERE "hris"."work_shift_versions"."cancelled_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "work_shifts_branch_name_unique" ON "hris"."work_shifts" USING btree ("branch_id",lower("name"));--> statement-breakpoint
-- Ditulis tangan (spec L3a §2): pagar data. Tidak ada baris yang dihapus (PRI-02).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['work_shifts','work_shift_versions','shift_groups','shift_group_members','shift_assignments','shift_day_changes','branch_qr_codes','branch_closures','shift_check_notices'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON hris.%I FOR EACH ROW EXECUTE FUNCTION hris.reject_change()', t || '_no_delete', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON hris.%I FOR EACH STATEMENT EXECUTE FUNCTION hris.reject_change()', t || '_no_truncate', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['shift_assignments','shift_day_changes','shift_check_notices'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON hris.%I FOR EACH ROW EXECUTE FUNCTION hris.reject_change()', t || '_no_update', t);
  END LOOP;
END $$;
--> statement-breakpoint
-- Penempatan semua orang pada satu tanggal (bacaan modul Kehadiran, pola current_placements).
CREATE FUNCTION hris.placements_on(on_date date)
RETURNS TABLE (employee_id integer, employee_name text, branch_id integer, position_id integer, department_id integer, active boolean)
LANGUAGE sql STABLE AS $$
  SELECT DISTINCT ON (p.employee_id)
    p.employee_id, e.name, p.branch_id, p.position_id, pos.department_id,
    coalesce((SELECT ev.kind::text FROM hris.employment_events ev
      WHERE ev.employee_id = p.employee_id AND ev.effective_on <= on_date
      ORDER BY ev.effective_on DESC, ev.id DESC LIMIT 1), 'REACTIVATE') = 'REACTIVATE'
  FROM hris.placements p
  JOIN hris.employees e ON e.id = p.employee_id
  JOIN hris.positions pos ON pos.id = p.position_id
  WHERE p.cancelled_at IS NULL AND p.effective_from <= on_date
  ORDER BY p.employee_id, p.effective_from DESC, p.id DESC
$$;
--> statement-breakpoint
-- Isi awal pengaturan (harus ada di registry.ts, H18). Keputusan owner spec L3a §9 butir 2.
INSERT INTO hris.setting_values (key, value, effective_from, status, reason)
VALUES ('attendance.radius_m', '100'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-78)'),
       ('position.attendance_mode', '"QR"'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal keputusan owner L3a');
--> statement-breakpoint
INSERT INTO hris.setting_values (key, target_kind, target_id, value, effective_from, status, reason)
SELECT 'position.attendance_mode', 'POSITION', p.id,
  CASE WHEN lower(p.name) IN ('pemilik', 'gm') THEN '"NONE"'::jsonb ELSE '"TRIP"'::jsonb END,
  '2026-01-01', 'ACTIVE', 'Isi awal keputusan owner L3a'
FROM hris.positions p WHERE lower(p.name) IN ('pemilik', 'gm', 'driver', 'kenek');
--> statement-breakpoint
-- Isi awal titik absen dari Google Maps (owner 2026-11-01); hanya bila masih kosong, nama tak dikenal dilewati.
UPDATE hris.branches b SET latitude = v.lat, longitude = v.lng
FROM (VALUES
  ('toko pusat', -7.350564720030627::double precision, 108.10865608125447::double precision),
  ('gudang', -7.350564720030627, 108.10865608125447),
  ('toko depan', -7.35148882045046, 108.11040975611628),
  ('toko markas', -7.330201639984503, 108.2066281965964),
  ('toko raja', -7.348385400436556, 108.22451225311764)
) AS v(name, lat, lng)
WHERE lower(b.name) = v.name AND b.latitude IS NULL;
--> statement-breakpoint
-- Hak awal (spec L3a §5). Pemilik dan GM punya semuanya lewat full_access.
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('hr', 'attendance.work_hours.view', 'ALL'), ('hr', 'attendance.work_hours.update', 'ALL'),
  ('hr', 'attendance.schedule.view', 'ALL'), ('hr', 'attendance.schedule.update', 'ALL'),
  ('hr', 'attendance.location.view', 'ALL'), ('hr', 'attendance.qr.manage', 'ALL'),
  ('hr', 'attendance.closure.view', 'ALL'), ('hr', 'attendance.closure.manage', 'ALL'),
  ('admin hr', 'attendance.work_hours.view', 'ALL'), ('admin hr', 'attendance.schedule.view', 'ALL'),
  ('admin hr', 'attendance.location.view', 'ALL'), ('admin hr', 'attendance.closure.view', 'ALL'),
  ('kepala toko', 'attendance.schedule.view', 'BRANCH'), ('kepala toko', 'attendance.schedule.update', 'BRANCH'),
  ('kepala toko', 'attendance.closure.view', 'BRANCH'),
  ('kepala gudang', 'attendance.schedule.view', 'DEPARTMENT'), ('kepala gudang', 'attendance.schedule.update', 'DEPARTMENT'),
  ('kepala gudang', 'attendance.closure.view', 'DEPARTMENT'),
  ('finance', 'attendance.closure.view', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, 'attendance.my_schedule.view', 'SELF'::hris.access_scope
FROM hris.positions p WHERE NOT p.full_access
ON CONFLICT DO NOTHING;
