CREATE TYPE "hris"."announcement_draft_status" AS ENUM('DRAFT', 'SUBMITTED', 'PUBLISHED', 'REJECTED', 'DISCARDED');--> statement-breakpoint
CREATE TYPE "hris"."rule_change_kind" AS ENUM('UNFAVORABLE', 'FAVORABLE');--> statement-breakpoint
ALTER TYPE "hris"."announcement_kind" ADD VALUE 'RULE';--> statement-breakpoint
CREATE TABLE "hris"."announcement_drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"before_text" text DEFAULT '' NOT NULL,
	"after_text" text DEFAULT '' NOT NULL,
	"ask_whom" text DEFAULT '' NOT NULL,
	"change_kind" "hris"."rule_change_kind" DEFAULT 'UNFAVORABLE' NOT NULL,
	"affects_money" boolean DEFAULT false NOT NULL,
	"target" jsonb NOT NULL,
	"publishes_at" timestamp with time zone,
	"effective_on" date,
	"corrects_announcement_id" integer,
	"supersedes_announcement_id" integer,
	"status" "hris"."announcement_draft_status" DEFAULT 'DRAFT' NOT NULL,
	"request_id" integer,
	"announcement_id" integer,
	"close_reason" text,
	"created_by_account_id" integer NOT NULL,
	"created_by_employee_id" integer NOT NULL,
	"submitted_by_account_id" integer,
	"submitted_by_employee_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_account_id" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hris"."announcements" ALTER COLUMN "shows_until" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "hris"."announcements" ADD COLUMN "before_text" text;--> statement-breakpoint
ALTER TABLE "hris"."announcements" ADD COLUMN "ask_whom" text;--> statement-breakpoint
ALTER TABLE "hris"."announcements" ADD COLUMN "effective_on" date;--> statement-breakpoint
ALTER TABLE "hris"."announcements" ADD COLUMN "change_kind" "hris"."rule_change_kind";--> statement-breakpoint
ALTER TABLE "hris"."announcements" ADD COLUMN "affects_money" boolean;--> statement-breakpoint
ALTER TABLE "hris"."announcements" ADD COLUMN "corrects_announcement_id" integer;--> statement-breakpoint
ALTER TABLE "hris"."announcements" ADD COLUMN "supersedes_announcement_id" integer;--> statement-breakpoint
ALTER TABLE "hris"."announcements" ADD COLUMN "approved_by_account_id" integer;--> statement-breakpoint
ALTER TABLE "hris"."announcements" ADD COLUMN "request_id" integer;--> statement-breakpoint
CREATE INDEX "announcement_drafts_status_idx" ON "hris"."announcement_drafts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "announcement_drafts_request_uq" ON "hris"."announcement_drafts" USING btree ("request_id") WHERE "hris"."announcement_drafts"."request_id" is not null;--> statement-breakpoint
CREATE INDEX "announcements_corrects_idx" ON "hris"."announcements" USING btree ("corrects_announcement_id");--> statement-breakpoint
CREATE INDEX "announcements_supersedes_idx" ON "hris"."announcements" USING btree ("supersedes_announcement_id");--> statement-breakpoint
ALTER TABLE "hris"."announcements" ADD CONSTRAINT "announcements_emergency_until" CHECK ("hris"."announcements"."kind"::text <> 'EMERGENCY' or "hris"."announcements"."shows_until" is not null);--> statement-breakpoint
ALTER TABLE "hris"."announcements" ADD CONSTRAINT "announcements_rule_complete" CHECK ("hris"."announcements"."kind"::text <> 'RULE' or ("hris"."announcements"."before_text" is not null and "hris"."announcements"."ask_whom" is not null
      and "hris"."announcements"."effective_on" is not null and "hris"."announcements"."change_kind" is not null and "hris"."announcements"."affects_money" is not null));--> statement-breakpoint
-- Ditulis tangan: penjaga "tidak diubah, tidak dihapus" ikut memeriksa kolom aturan (spec F3-3 §3.1).
-- Satu-satunya perubahan yang boleh tetap mengisi ended_* sekali (Akhiri sekarang / Tarik).
CREATE OR REPLACE FUNCTION "hris"."guard_announcement_change"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Pengumuman tidak boleh dihapus.';
  END IF;
  IF OLD.ended_at IS NOT NULL OR NEW.ended_at IS NULL
    OR ROW(NEW.id, NEW.kind, NEW.title, NEW.message, NEW.target_all, NEW.shows_from, NEW.shows_until,
           NEW.created_by_account_id, NEW.created_by_employee_id, NEW.created_at,
           NEW.before_text, NEW.ask_whom, NEW.effective_on, NEW.change_kind, NEW.affects_money,
           NEW.corrects_announcement_id, NEW.supersedes_announcement_id, NEW.approved_by_account_id, NEW.request_id)
       IS DISTINCT FROM
       ROW(OLD.id, OLD.kind, OLD.title, OLD.message, OLD.target_all, OLD.shows_from, OLD.shows_until,
           OLD.created_by_account_id, OLD.created_by_employee_id, OLD.created_at,
           OLD.before_text, OLD.ask_whom, OLD.effective_on, OLD.change_kind, OLD.affects_money,
           OLD.corrects_announcement_id, OLD.supersedes_announcement_id, OLD.approved_by_account_id, OLD.request_id) THEN
    RAISE EXCEPTION 'Pengumuman tidak boleh diubah; yang boleh hanya mengakhiri/menariknya sekali.';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
-- Isi awal hak (spec F3-3 §3.3): HR tulis + terbitkan, Admin HR konsep saja. Pemilik/GM dari full_access
-- (announcement.rule.approve hanya full_access).
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('hr', 'announcement.rule.draft', 'ALL'),
  ('hr', 'announcement.rule.publish', 'ALL'),
  ('admin hr', 'announcement.rule.draft', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
WHERE NOT p.full_access
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Isi awal pengaturan F3-3 (spec F3-3 §3.8). Harus sama dengan apps/hris/modules/settings/rules/registry.ts.
INSERT INTO "hris"."setting_values" (key, value, effective_from, status, reason)
VALUES
  ('announcements.rule_gap_unfavorable_days', '7'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (PRI-35)'),
  ('announcements.rule_gap_favorable_days', '1'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (PRI-35)');
