ALTER TABLE "hris"."advance_handovers" DROP CONSTRAINT "advance_handovers_method";--> statement-breakpoint
ALTER TABLE "hris"."advance_handovers" ALTER COLUMN "source_id" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "advances_one_legacy" ON "hris"."advances" USING btree ("employee_id") WHERE "hris"."advances"."kind" = 'LEGACY' and "hris"."advances"."state" in ('OPEN', 'APPROVED');--> statement-breakpoint
ALTER TABLE "hris"."advance_handovers" ADD CONSTRAINT "advance_handovers_legacy_source" CHECK (("hris"."advance_handovers"."method" = 'LEGACY') = ("hris"."advance_handovers"."source_id" is null));--> statement-breakpoint
ALTER TABLE "hris"."advance_handovers" ADD CONSTRAINT "advance_handovers_method" CHECK ("hris"."advance_handovers"."method" in ('CASH', 'TRANSFER', 'LEGACY'));--> statement-breakpoint
-- Hari pindah (spec L9 §3, SIS-13; keputusan owner 2026-11-04 §9 butir 8): target 26 Desember 2026, bisa diubah di Pengaturan.
INSERT INTO hris.setting_values (key, value, effective_from, status, reason) VALUES
  ('migration.cutover_on', '"2026-12-26"'::jsonb, '2026-01-01', 'ACTIVE', 'Target hari pindah keputusan owner 2026-11-04 (spec L9 §9 butir 8)');
--> statement-breakpoint
-- Hak awal L9a (spec L9 §6): Finance mengetik sisa kasbon bawaan; pengesahan tetap advance.decide (Pemilik/GM).
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, 'advance.legacy_enter', 'ALL'::hris.access_scope
FROM hris.positions p WHERE lower(p.name) = 'finance'
ON CONFLICT DO NOTHING;
