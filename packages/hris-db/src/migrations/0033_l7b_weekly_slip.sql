ALTER TABLE "hris"."payslips" DROP CONSTRAINT "payslips_kind";--> statement-breakpoint
ALTER TABLE "hris"."payslips" DROP CONSTRAINT "payslips_period_start";--> statement-breakpoint
ALTER TABLE "hris"."trip_wage_values" DROP CONSTRAINT "trip_wage_values_week_friday";--> statement-breakpoint
ALTER TABLE "hris"."payslips" ADD COLUMN "period_end" date;--> statement-breakpoint
ALTER TABLE "hris"."payslips" ADD CONSTRAINT "payslips_period_end" CHECK (("hris"."payslips"."kind" = 'MONTHLY') = ("hris"."payslips"."period_end" is null) and ("hris"."payslips"."period_end" is null or "hris"."payslips"."period_end" between "hris"."payslips"."period_start" and "hris"."payslips"."period_start" + 6));--> statement-breakpoint
ALTER TABLE "hris"."payslips" ADD CONSTRAINT "payslips_kind" CHECK ("hris"."payslips"."kind" in ('MONTHLY', 'WEEKLY', 'WEEKLY_EXTRA'));--> statement-breakpoint
ALTER TABLE "hris"."payslips" ADD CONSTRAINT "payslips_period_start" CHECK ("hris"."payslips"."kind" <> 'MONTHLY' or extract(day from "hris"."payslips"."period_start") = 26);--> statement-breakpoint
-- Slip Mingguan L7b (spec L7 §3.5, §3.7). Hari awal minggu upah bertanggal; isi awal Jumat (DRV-19).
INSERT INTO hris.setting_values (key, value, effective_from, status, reason) VALUES
  ('payroll.weekly_start_day', '"FRI"'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (DRV-19)'),
  ('payroll.weekly_close_open_hour', '10'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (DRV-20)'),
  ('payroll.weekly_close_remind_hour', '15'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (DRV-20)');
