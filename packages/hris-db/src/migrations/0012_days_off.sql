CREATE TYPE "hris"."day_off_origin" AS ENUM('PICK', 'LATE', 'SWAP', 'DIRECT', 'REPLACEMENT');--> statement-breakpoint
CREATE TYPE "hris"."day_off_status" AS ENUM('ACTIVE', 'REPLACED', 'REVOKED');--> statement-breakpoint
CREATE TYPE "hris"."replacement_status" AS ENUM('WAITING', 'CHOSEN', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "hris"."swap_kind" AS ENUM('DAY_OFF', 'SHIFT');--> statement-breakpoint
CREATE TYPE "hris"."swap_status" AS ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "hris"."work_request_status" AS ENUM('REQUESTED', 'READY', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "hris"."day_off_missing_marks" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"period_start" date NOT NULL,
	"quota" smallint NOT NULL,
	"picked_count" smallint NOT NULL,
	"marked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hris"."day_off_notices" (
	"employee_id" integer NOT NULL,
	"ref" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "day_off_notices_employee_id_ref_pk" PRIMARY KEY("employee_id","ref")
);
--> statement-breakpoint
CREATE TABLE "hris"."day_off_picks" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"period_start" date NOT NULL,
	"off_date" date NOT NULL,
	"origin" "hris"."day_off_origin" NOT NULL,
	"status" "hris"."day_off_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_by_account_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"swap_invitation_id" integer,
	"replacement_id" integer,
	"note" text,
	"ended_at" timestamp with time zone,
	"ended_by_account_id" integer,
	"end_reason" text,
	"replaced_by_id" integer,
	CONSTRAINT "day_off_picks_period_day" CHECK (extract(day from "hris"."day_off_picks"."period_start") = 26),
	CONSTRAINT "day_off_picks_ended" CHECK (("hris"."day_off_picks"."status" = 'ACTIVE') = ("hris"."day_off_picks"."ended_at" is null))
);
--> statement-breakpoint
CREATE TABLE "hris"."day_off_work_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"pick_id" integer NOT NULL,
	"work_date" date NOT NULL,
	"requested_by_account_id" integer NOT NULL,
	"requested_by_employee_id" integer NOT NULL,
	"reason" text NOT NULL,
	"status" "hris"."work_request_status" DEFAULT 'REQUESTED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ready_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_account_id" integer,
	"cancel_reason" text,
	CONSTRAINT "day_off_work_requests_not_self" CHECK ("hris"."day_off_work_requests"."employee_id" <> "hris"."day_off_work_requests"."requested_by_employee_id"),
	CONSTRAINT "day_off_work_requests_reason_not_blank" CHECK (btrim("hris"."day_off_work_requests"."reason") <> '')
);
--> statement-breakpoint
CREATE TABLE "hris"."replacement_days_off" (
	"id" serial PRIMARY KEY NOT NULL,
	"work_request_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"work_date" date NOT NULL,
	"choose_by" date NOT NULL,
	"pick_id" integer,
	"status" "hris"."replacement_status" DEFAULT 'WAITING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "replacement_days_off_chosen" CHECK (("hris"."replacement_days_off"."status" = 'CHOSEN') = ("hris"."replacement_days_off"."pick_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "hris"."swap_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" "hris"."swap_kind" NOT NULL,
	"branch_id" integer NOT NULL,
	"from_employee_id" integer NOT NULL,
	"to_employee_id" integer NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"from_pick_id" integer,
	"to_pick_id" integer,
	"from_shift_id" integer,
	"to_shift_id" integer,
	"answer_by" date NOT NULL,
	"status" "hris"."swap_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_at" timestamp with time zone,
	CONSTRAINT "swap_invitations_two_people" CHECK ("hris"."swap_invitations"."from_employee_id" <> "hris"."swap_invitations"."to_employee_id"),
	CONSTRAINT "swap_invitations_shape" CHECK (("hris"."swap_invitations"."kind" = 'DAY_OFF' and "hris"."swap_invitations"."from_pick_id" is not null and "hris"."swap_invitations"."to_pick_id" is not null)
      or ("hris"."swap_invitations"."kind" = 'SHIFT' and "hris"."swap_invitations"."from_date" = "hris"."swap_invitations"."to_date" and "hris"."swap_invitations"."from_shift_id" is not null and "hris"."swap_invitations"."to_shift_id" is not null)),
	CONSTRAINT "swap_invitations_answered" CHECK (("hris"."swap_invitations"."status" = 'PENDING') = ("hris"."swap_invitations"."answered_at" is null))
);
--> statement-breakpoint
ALTER TABLE "hris"."shift_day_changes" ADD COLUMN "swap_invitation_id" integer;--> statement-breakpoint
ALTER TABLE "hris"."day_off_missing_marks" ADD CONSTRAINT "day_off_missing_marks_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."day_off_notices" ADD CONSTRAINT "day_off_notices_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."day_off_picks" ADD CONSTRAINT "day_off_picks_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."day_off_work_requests" ADD CONSTRAINT "day_off_work_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."day_off_work_requests" ADD CONSTRAINT "day_off_work_requests_pick_id_day_off_picks_id_fk" FOREIGN KEY ("pick_id") REFERENCES "hris"."day_off_picks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."day_off_work_requests" ADD CONSTRAINT "day_off_work_requests_requested_by_employee_id_employees_id_fk" FOREIGN KEY ("requested_by_employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."replacement_days_off" ADD CONSTRAINT "replacement_days_off_work_request_id_day_off_work_requests_id_fk" FOREIGN KEY ("work_request_id") REFERENCES "hris"."day_off_work_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."replacement_days_off" ADD CONSTRAINT "replacement_days_off_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."replacement_days_off" ADD CONSTRAINT "replacement_days_off_pick_id_day_off_picks_id_fk" FOREIGN KEY ("pick_id") REFERENCES "hris"."day_off_picks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."swap_invitations" ADD CONSTRAINT "swap_invitations_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "hris"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."swap_invitations" ADD CONSTRAINT "swap_invitations_from_employee_id_employees_id_fk" FOREIGN KEY ("from_employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."swap_invitations" ADD CONSTRAINT "swap_invitations_to_employee_id_employees_id_fk" FOREIGN KEY ("to_employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."swap_invitations" ADD CONSTRAINT "swap_invitations_from_pick_id_day_off_picks_id_fk" FOREIGN KEY ("from_pick_id") REFERENCES "hris"."day_off_picks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."swap_invitations" ADD CONSTRAINT "swap_invitations_to_pick_id_day_off_picks_id_fk" FOREIGN KEY ("to_pick_id") REFERENCES "hris"."day_off_picks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."swap_invitations" ADD CONSTRAINT "swap_invitations_from_shift_id_work_shifts_id_fk" FOREIGN KEY ("from_shift_id") REFERENCES "hris"."work_shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."swap_invitations" ADD CONSTRAINT "swap_invitations_to_shift_id_work_shifts_id_fk" FOREIGN KEY ("to_shift_id") REFERENCES "hris"."work_shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "day_off_missing_marks_person_period_unique" ON "hris"."day_off_missing_marks" USING btree ("employee_id","period_start");--> statement-breakpoint
CREATE UNIQUE INDEX "day_off_picks_one_active_per_date" ON "hris"."day_off_picks" USING btree ("employee_id","off_date") WHERE "hris"."day_off_picks"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "day_off_picks_person_period_idx" ON "hris"."day_off_picks" USING btree ("employee_id","period_start");--> statement-breakpoint
CREATE INDEX "day_off_picks_date_idx" ON "hris"."day_off_picks" USING btree ("off_date");--> statement-breakpoint
CREATE UNIQUE INDEX "day_off_work_requests_one_live" ON "hris"."day_off_work_requests" USING btree ("employee_id","work_date") WHERE "hris"."day_off_work_requests"."status" <> 'CANCELLED';--> statement-breakpoint
CREATE INDEX "day_off_work_requests_date_idx" ON "hris"."day_off_work_requests" USING btree ("work_date");--> statement-breakpoint
CREATE UNIQUE INDEX "replacement_days_off_request_unique" ON "hris"."replacement_days_off" USING btree ("work_request_id");--> statement-breakpoint
CREATE INDEX "replacement_days_off_person_idx" ON "hris"."replacement_days_off" USING btree ("employee_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "swap_invitations_one_pending" ON "hris"."swap_invitations" USING btree ("from_employee_id","from_date") WHERE "hris"."swap_invitations"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX "swap_invitations_to_idx" ON "hris"."swap_invitations" USING btree ("to_employee_id","status");--> statement-breakpoint
CREATE INDEX "swap_invitations_branch_idx" ON "hris"."swap_invitations" USING btree ("branch_id","created_at");--> statement-breakpoint
-- Ditulis tangan (spec L3e §2): tidak ada yang dihapus (PRI-02); status hanya bergerak dari keadaan awalnya,
-- dan isi pokok tiap baris tidak bisa diubah.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['day_off_picks','day_off_missing_marks','swap_invitations','day_off_work_requests','replacement_days_off','day_off_notices'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON hris.%I FOR EACH ROW EXECUTE FUNCTION hris.reject_change()', t || '_no_delete', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON hris.%I FOR EACH STATEMENT EXECUTE FUNCTION hris.reject_change()', t || '_no_truncate', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['day_off_missing_marks','day_off_notices'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON hris.%I FOR EACH ROW EXECUTE FUNCTION hris.reject_change()', t || '_no_update', t);
  END LOOP;
END $$;
--> statement-breakpoint
CREATE FUNCTION hris.guard_day_off_pick() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'ACTIVE'
     OR (NEW.employee_id, NEW.period_start, NEW.off_date, NEW.origin, NEW.created_by_account_id, NEW.created_at)
        IS DISTINCT FROM (OLD.employee_id, OLD.period_start, OLD.off_date, OLD.origin, OLD.created_by_account_id, OLD.created_at)
     OR (NEW.swap_invitation_id, NEW.replacement_id, NEW.note) IS DISTINCT FROM (OLD.swap_invitation_id, OLD.replacement_id, OLD.note) THEN
    RAISE EXCEPTION 'Libur tidak bisa diubah; lepas, geser, atau cabut lewat pintunya.';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER day_off_picks_guard BEFORE UPDATE ON hris.day_off_picks FOR EACH ROW EXECUTE FUNCTION hris.guard_day_off_pick();
--> statement-breakpoint
CREATE FUNCTION hris.guard_swap_invitation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'PENDING'
     OR (NEW.kind, NEW.branch_id, NEW.from_employee_id, NEW.to_employee_id, NEW.from_date, NEW.to_date, NEW.answer_by, NEW.created_at)
        IS DISTINCT FROM (OLD.kind, OLD.branch_id, OLD.from_employee_id, OLD.to_employee_id, OLD.from_date, OLD.to_date, OLD.answer_by, OLD.created_at)
     OR (NEW.from_pick_id, NEW.to_pick_id, NEW.from_shift_id, NEW.to_shift_id)
        IS DISTINCT FROM (OLD.from_pick_id, OLD.to_pick_id, OLD.from_shift_id, OLD.to_shift_id) THEN
    RAISE EXCEPTION 'Ajakan tukar yang sudah dijawab tidak bisa diubah.';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER swap_invitations_guard BEFORE UPDATE ON hris.swap_invitations FOR EACH ROW EXECUTE FUNCTION hris.guard_swap_invitation();
--> statement-breakpoint
CREATE FUNCTION hris.guard_day_off_work_request() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'CANCELLED' OR (OLD.status = 'READY' AND NEW.status = 'REQUESTED')
     OR (NEW.employee_id, NEW.pick_id, NEW.work_date, NEW.requested_by_account_id, NEW.requested_by_employee_id, NEW.reason, NEW.created_at)
        IS DISTINCT FROM (OLD.employee_id, OLD.pick_id, OLD.work_date, OLD.requested_by_account_id, OLD.requested_by_employee_id, OLD.reason, OLD.created_at) THEN
    RAISE EXCEPTION 'Permintaan masuk tidak bisa diubah; batalkan lewat pintunya.';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER day_off_work_requests_guard BEFORE UPDATE ON hris.day_off_work_requests FOR EACH ROW EXECUTE FUNCTION hris.guard_day_off_work_request();
--> statement-breakpoint
CREATE FUNCTION hris.guard_replacement_day_off() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'EXPIRED' OR NEW.status = 'WAITING'
     OR (NEW.work_request_id, NEW.employee_id, NEW.work_date, NEW.choose_by, NEW.created_at)
        IS DISTINCT FROM (OLD.work_request_id, OLD.employee_id, OLD.work_date, OLD.choose_by, OLD.created_at) THEN
    RAISE EXCEPTION 'Libur pengganti tidak bisa diubah; pilih lewat pintunya.';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER replacement_days_off_guard BEFORE UPDATE ON hris.replacement_days_off FOR EACH ROW EXECUTE FUNCTION hris.guard_replacement_day_off();
--> statement-breakpoint
-- Isi awal pengaturan (harus ada di registry.ts, H18). Spec L3e §2.
INSERT INTO hris.setting_values (key, value, effective_from, status, reason) VALUES
  ('position.day_off_quota', '4'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-31)'),
  ('attendance.day_off_max_per_branch', '2'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-34)'),
  ('attendance.day_off_weekend_max', '1'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-35, 134)'),
  ('attendance.day_off_min_gap_days', '5'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-134)'),
  ('attendance.day_off_window_open_day', '10'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-132)'),
  ('attendance.day_off_window_close_day', '25'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-132)'),
  ('attendance.day_off_late_min_days', '2'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-135)'),
  ('attendance.newcomer_grace_days', '3'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-140)'),
  ('attendance.swap_deadline_days', '2'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-44)'),
  ('attendance.replacement_days', '14'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-138)');
--> statement-breakpoint
-- Hak awal (spec L3e §5). Pemilik dan GM punya semuanya lewat full_access.
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('hr', 'attendance.dayoff.view', 'ALL'), ('hr', 'attendance.dayoff.change', 'ALL'), ('hr', 'attendance.dayoff.revoke', 'ALL'),
  ('hr', 'attendance.dayoff.request_work', 'ALL'),
  ('admin hr', 'attendance.dayoff.view', 'ALL'),
  ('kepala toko', 'attendance.dayoff.view', 'BRANCH'), ('kepala toko', 'attendance.dayoff.change', 'BRANCH'),
  ('kepala toko', 'attendance.dayoff.request_work', 'BRANCH'),
  ('kepala gudang', 'attendance.dayoff.view', 'DEPARTMENT'), ('kepala gudang', 'attendance.dayoff.change', 'DEPARTMENT'),
  ('kepala gudang', 'attendance.dayoff.request_work', 'DEPARTMENT')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
