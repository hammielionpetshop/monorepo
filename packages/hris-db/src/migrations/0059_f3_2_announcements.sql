CREATE TYPE "hris"."announcement_kind" AS ENUM('EMERGENCY');--> statement-breakpoint
CREATE TABLE "hris"."announcement_reads" (
	"id" serial PRIMARY KEY NOT NULL,
	"announcement_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hris"."announcement_targets" (
	"id" serial PRIMARY KEY NOT NULL,
	"announcement_id" integer NOT NULL,
	"branch_id" integer,
	"position_id" integer,
	CONSTRAINT "announcement_targets_one_kind" CHECK (("hris"."announcement_targets"."branch_id" is null) <> ("hris"."announcement_targets"."position_id" is null))
);
--> statement-breakpoint
CREATE TABLE "hris"."announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" "hris"."announcement_kind" NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"target_all" boolean NOT NULL,
	"shows_from" timestamp with time zone DEFAULT now() NOT NULL,
	"shows_until" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"ended_by_account_id" integer,
	"end_reason" text,
	"created_by_account_id" integer NOT NULL,
	"created_by_employee_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "announcements_title_not_blank" CHECK (btrim("hris"."announcements"."title") <> ''),
	CONSTRAINT "announcements_message_not_blank" CHECK (btrim("hris"."announcements"."message") <> ''),
	CONSTRAINT "announcements_shows_range" CHECK ("hris"."announcements"."shows_until" > "hris"."announcements"."shows_from"),
	CONSTRAINT "announcements_end_complete" CHECK (("hris"."announcements"."ended_at" is null) = ("hris"."announcements"."ended_by_account_id" is null))
);
--> statement-breakpoint
ALTER TABLE "hris"."announcement_reads" ADD CONSTRAINT "announcement_reads_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "hris"."announcements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."announcement_targets" ADD CONSTRAINT "announcement_targets_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "hris"."announcements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "announcement_reads_person_uq" ON "hris"."announcement_reads" USING btree ("announcement_id","employee_id");--> statement-breakpoint
CREATE INDEX "announcement_reads_employee_idx" ON "hris"."announcement_reads" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "announcement_targets_announcement_idx" ON "hris"."announcement_targets" USING btree ("announcement_id");--> statement-breakpoint
CREATE INDEX "announcements_kind_until_idx" ON "hris"."announcements" USING btree ("kind","shows_until");--> statement-breakpoint
-- Ditulis tangan: pengumuman tidak diubah, tidak dihapus (PRI-36, spec F3-2 §3.1). Satu-satunya perubahan
-- yang boleh: mengisi ended_* sekali (Akhiri sekarang).
CREATE FUNCTION "hris"."guard_announcement_change"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Pengumuman tidak boleh dihapus.';
  END IF;
  IF OLD.ended_at IS NOT NULL OR NEW.ended_at IS NULL
    OR ROW(NEW.id, NEW.kind, NEW.title, NEW.message, NEW.target_all, NEW.shows_from, NEW.shows_until,
           NEW.created_by_account_id, NEW.created_by_employee_id, NEW.created_at)
       IS DISTINCT FROM
       ROW(OLD.id, OLD.kind, OLD.title, OLD.message, OLD.target_all, OLD.shows_from, OLD.shows_until,
           OLD.created_by_account_id, OLD.created_by_employee_id, OLD.created_at) THEN
    RAISE EXCEPTION 'Pengumuman tidak boleh diubah; yang boleh hanya mengakhirinya sekali.';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER "announcements_guard" BEFORE UPDATE OR DELETE ON "hris"."announcements"
  FOR EACH ROW EXECUTE FUNCTION "hris"."guard_announcement_change"();
--> statement-breakpoint
CREATE FUNCTION "hris"."reject_announcement_row_change"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Sasaran dan catatan baca pengumuman hanya boleh ditambah.';
END $$;
--> statement-breakpoint
CREATE TRIGGER "announcement_targets_append_only" BEFORE UPDATE OR DELETE ON "hris"."announcement_targets"
  FOR EACH ROW EXECUTE FUNCTION "hris"."reject_announcement_row_change"();
--> statement-breakpoint
CREATE TRIGGER "announcement_reads_append_only" BEFORE UPDATE OR DELETE ON "hris"."announcement_reads"
  FOR EACH ROW EXECUTE FUNCTION "hris"."reject_announcement_row_change"();
--> statement-breakpoint
-- Isi awal hak (spec F3-2 §3.2): HR kirim + lihat, Admin HR lihat saja. Pemilik/GM dari full_access.
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('hr', 'announcement.view', 'ALL'),
  ('hr', 'announcement.emergency.send', 'ALL'),
  ('admin hr', 'announcement.view', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
WHERE NOT p.full_access
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Isi awal pengaturan F3-2 (spec F3-2 §6, v3 §8). Harus sama dengan apps/hris/modules/settings/rules/registry.ts.
INSERT INTO "hris"."setting_values" (key, value, effective_from, status, reason)
VALUES
  ('shared.hold_seconds_emergency', '5'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3'),
  ('announcements.emergency_max_chars', '300'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3'),
  ('announcements.emergency_max_days', '7'::jsonb, '2026-01-01', 'ACTIVE', 'Keputusan owner spec F3-2 §9 butir 1');
