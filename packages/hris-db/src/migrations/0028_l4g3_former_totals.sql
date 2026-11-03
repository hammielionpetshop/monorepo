ALTER TABLE "hris"."payslip_steps" DROP CONSTRAINT "payslip_steps_action";--> statement-breakpoint
ALTER TABLE "hris"."payslip_steps" ADD CONSTRAINT "payslip_steps_action" CHECK ("hris"."payslip_steps"."action" in ('CLOSE', 'PRINT', 'PRINT_MANY', 'REOPEN', 'REOPEN_REQUEST', 'EARLY_CLOSE', 'PAY', 'PAY_CANCEL', 'PAY_ZERO', 'TRANSFER_VIEW', 'TRANSFER_DOWNLOAD', 'SELF_DOWNLOAD', 'SELF_DOWNLOAD_MANY', 'TOTALS_DOWNLOAD'));--> statement-breakpoint
-- Hak awal L4g-3 (spec L4g §5): HR melihat Total Diterima per Orang (tanpa jabatan bertanda). Finance dan Admin HR tidak.
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('hr', 'payroll_totals.view', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
