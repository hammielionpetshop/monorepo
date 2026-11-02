CREATE TYPE "hris"."clarification_cause" AS ENUM('SICK', 'SICK_LETTER', 'FORGOT', 'SUDDEN_PERMIT', 'REASON');--> statement-breakpoint
CREATE TYPE "hris"."clarification_effect_kind" AS ENUM('APPLY', 'REVERSE');--> statement-breakpoint
CREATE TYPE "hris"."clarification_event_kind" AS ENUM('ALPHA', 'FORGOT_OUT', 'FORGOT_RETURN', 'LATE', 'EARLY_LEAVE');--> statement-breakpoint
CREATE TYPE "hris"."clarification_event_state" AS ENUM('OPEN', 'EXPLAINED', 'EXPIRED', 'VOID');--> statement-breakpoint
ALTER TYPE "hris"."attendance_correction_reason" ADD VALUE 'CLARIFICATION';--> statement-breakpoint
CREATE TABLE "hris"."absence_streak_flags" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"start_date" date NOT NULL,
	"flagged_date" date NOT NULL,
	"causes" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hris"."absence_streak_seen" (
	"id" serial PRIMARY KEY NOT NULL,
	"flag_id" integer NOT NULL,
	"seen" boolean NOT NULL,
	"note" text NOT NULL,
	"by_account_id" integer NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "absence_streak_seen_note_not_blank" CHECK (btrim("hris"."absence_streak_seen"."note") <> '')
);
--> statement-breakpoint
CREATE TABLE "hris"."clarification_effects" (
	"id" serial PRIMARY KEY NOT NULL,
	"clarification_id" integer NOT NULL,
	"kind" "hris"."clarification_effect_kind" NOT NULL,
	"correction_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hris"."clarification_event_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"clarification_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hris"."clarification_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"work_date" date NOT NULL,
	"kind" "hris"."clarification_event_kind" NOT NULL,
	"minutes" integer,
	"born_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deadline_at" timestamp with time zone NOT NULL,
	"state" "hris"."clarification_event_state" DEFAULT 'OPEN' NOT NULL,
	"state_changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hris"."clarifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"cause" "hris"."clarification_cause" NOT NULL,
	"in_at" timestamp with time zone,
	"out_at" timestamp with time zone,
	"return_at" timestamp with time zone,
	"reason" text NOT NULL,
	"late" boolean DEFAULT false NOT NULL,
	"late_reason" text,
	"absence_request_id" integer,
	"created_by_account_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clarifications_reason_not_blank" CHECK (btrim("hris"."clarifications"."reason") <> ''),
	CONSTRAINT "clarifications_late_reason" CHECK ("hris"."clarifications"."late" = ("hris"."clarifications"."late_reason" is not null))
);
--> statement-breakpoint
ALTER TABLE "hris"."absence_streak_flags" ADD CONSTRAINT "absence_streak_flags_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."absence_streak_seen" ADD CONSTRAINT "absence_streak_seen_flag_id_absence_streak_flags_id_fk" FOREIGN KEY ("flag_id") REFERENCES "hris"."absence_streak_flags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."clarification_effects" ADD CONSTRAINT "clarification_effects_clarification_id_clarifications_id_fk" FOREIGN KEY ("clarification_id") REFERENCES "hris"."clarifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."clarification_effects" ADD CONSTRAINT "clarification_effects_correction_id_attendance_corrections_id_fk" FOREIGN KEY ("correction_id") REFERENCES "hris"."attendance_corrections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."clarification_event_links" ADD CONSTRAINT "clarification_event_links_clarification_id_clarifications_id_fk" FOREIGN KEY ("clarification_id") REFERENCES "hris"."clarifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."clarification_event_links" ADD CONSTRAINT "clarification_event_links_event_id_clarification_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "hris"."clarification_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."clarification_events" ADD CONSTRAINT "clarification_events_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."clarifications" ADD CONSTRAINT "clarifications_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."clarifications" ADD CONSTRAINT "clarifications_absence_request_id_absence_requests_id_fk" FOREIGN KEY ("absence_request_id") REFERENCES "hris"."absence_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "absence_streak_flags_person_start_unique" ON "hris"."absence_streak_flags" USING btree ("employee_id","start_date");--> statement-breakpoint
CREATE INDEX "absence_streak_seen_flag_idx" ON "hris"."absence_streak_seen" USING btree ("flag_id","id");--> statement-breakpoint
CREATE INDEX "clarification_effects_clarification_idx" ON "hris"."clarification_effects" USING btree ("clarification_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clarification_event_links_one_active" ON "hris"."clarification_event_links" USING btree ("event_id") WHERE "hris"."clarification_event_links"."active";--> statement-breakpoint
CREATE INDEX "clarification_event_links_clarification_idx" ON "hris"."clarification_event_links" USING btree ("clarification_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clarification_events_person_date_kind_unique" ON "hris"."clarification_events" USING btree ("employee_id","work_date","kind");--> statement-breakpoint
CREATE INDEX "clarification_events_state_idx" ON "hris"."clarification_events" USING btree ("state","deadline_at");--> statement-breakpoint
CREATE INDEX "clarification_events_date_idx" ON "hris"."clarification_events" USING btree ("work_date");--> statement-breakpoint
CREATE UNIQUE INDEX "clarifications_request_unique" ON "hris"."clarifications" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "clarifications_person_idx" ON "hris"."clarifications" USING btree ("employee_id");--> statement-breakpoint
-- Ditulis tangan (spec L3g §2): tidak ada yang dihapus (PRI-02, KEH-67). Kejadian hanya berubah keadaan dan batasnya;
-- tautan hanya dilepas (berlaku → tidak); isi penjelasan, akibat, dan tanda hanya tambah.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clarification_events','clarifications','clarification_event_links','clarification_effects','absence_streak_flags','absence_streak_seen'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON hris.%I FOR EACH ROW EXECUTE FUNCTION hris.reject_change()', t || '_no_delete', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON hris.%I FOR EACH STATEMENT EXECUTE FUNCTION hris.reject_change()', t || '_no_truncate', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['clarifications','clarification_effects','absence_streak_flags','absence_streak_seen'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON hris.%I FOR EACH ROW EXECUTE FUNCTION hris.reject_change()', t || '_no_update', t);
  END LOOP;
END $$;
--> statement-breakpoint
CREATE FUNCTION hris.guard_clarification_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.employee_id, NEW.work_date, NEW.kind, NEW.minutes, NEW.born_at) IS DISTINCT FROM (OLD.employee_id, OLD.work_date, OLD.kind, OLD.minutes, OLD.born_at) THEN
    RAISE EXCEPTION 'Kejadian perlu dijelaskan tidak bisa diubah isinya.';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER clarification_events_guard BEFORE UPDATE ON hris.clarification_events FOR EACH ROW EXECUTE FUNCTION hris.guard_clarification_event();
--> statement-breakpoint
CREATE FUNCTION hris.guard_clarification_link() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT OLD.active OR NEW.active OR (NEW.clarification_id, NEW.event_id) IS DISTINCT FROM (OLD.clarification_id, OLD.event_id) THEN
    RAISE EXCEPTION 'Tautan penjelasan hanya bisa dilepas.';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER clarification_event_links_guard BEFORE UPDATE ON hris.clarification_event_links FOR EACH ROW EXECUTE FUNCTION hris.guard_clarification_link();
--> statement-breakpoint
-- Isi awal pengaturan (harus ada di registry.ts, H18). Spec L3g §2.
INSERT INTO hris.setting_values (key, value, effective_from, status, reason) VALUES
  ('attendance.clarify_deadline_days', '3'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-58, 151)'),
  ('attendance.clarify_late_threshold_minutes', '30'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-56, 61)'),
  ('attendance.clarify_early_threshold_minutes', '30'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-151)'),
  ('attendance.absence_streak_days', '7'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-55, 157)'),
  ('attendance.forgot_habit_min', '4'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-65, 157)');
--> statement-breakpoint
-- Hak awal (spec L3g §5). Pemilik dan GM punya semuanya lewat full_access; Laporan Kebiasaan hanya mereka (ownerOnly).
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('hr', 'clarification.decide', 'ALL'), ('hr', 'clarification.team.view', 'ALL'), ('hr', 'clarification.streak.seen', 'ALL'),
  ('admin hr', 'clarification.team.view', 'ALL'),
  ('kepala toko', 'clarification.team.view', 'BRANCH'),
  ('kepala gudang', 'clarification.team.view', 'DEPARTMENT')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
