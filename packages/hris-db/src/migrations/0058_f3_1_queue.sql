CREATE TABLE "hris"."queue_shown" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"kind" text NOT NULL,
	"shown_on" date NOT NULL,
	"acknowledged_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "queue_shown_account_kind_day_uq" ON "hris"."queue_shown" USING btree ("account_id","kind","shown_on");--> statement-breakpoint
CREATE INDEX "queue_shown_day_idx" ON "hris"."queue_shown" USING btree ("shown_on");--> statement-breakpoint
-- Ditulis tangan: isi awal pengaturan F3-1 (spec F3-1 §6, v3 §8). Harus sama dengan apps/hris/modules/settings/rules/registry.ts.
INSERT INTO "hris"."setting_values" (key, value, effective_from, status, reason)
VALUES
  ('shared.hold_seconds_reminder', '1'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3'),
  ('requests.remind_after_days', '1'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3');
