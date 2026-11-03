ALTER TABLE "hris"."payslip_steps" DROP CONSTRAINT "payslip_steps_action";--> statement-breakpoint
ALTER TABLE "hris"."payslip_payments" ADD COLUMN "account_tail" text;--> statement-breakpoint
ALTER TABLE "hris"."payslip_steps" ADD CONSTRAINT "payslip_steps_action" CHECK ("hris"."payslip_steps"."action" in ('CLOSE', 'PRINT', 'PRINT_MANY', 'REOPEN', 'REOPEN_REQUEST', 'EARLY_CLOSE', 'PAY', 'PAY_CANCEL', 'PAY_ZERO', 'TRANSFER_VIEW', 'TRANSFER_DOWNLOAD', 'SELF_DOWNLOAD', 'SELF_DOWNLOAD_MANY'));--> statement-breakpoint
-- Pembayaran transfer lama (L4f): 4 angka terakhir rekening yang tercatat sekarang (spec L4g §9 butir 4).
UPDATE hris.payslip_payments pp
SET account_tail = right(regexp_replace(e.bank_account_number, '\D', '', 'g'), 4)
FROM hris.payslips s
JOIN hris.employees e ON e.id = s.employee_id
WHERE pp.payslip_id = s.id AND pp.method = 'TRANSFER' AND pp.account_tail IS NULL
  AND regexp_replace(coalesce(e.bank_account_number, ''), '\D', '', 'g') <> '';--> statement-breakpoint
UPDATE hris.payslip_payments pp
SET account_tail = right(regexp_replace(e.bank_account_number, '\D', '', 'g'), 4)
FROM hris.off_slip_claims c
JOIN hris.employees e ON e.id = c.employee_id
WHERE pp.claim_id = c.id AND pp.method = 'TRANSFER' AND pp.account_tail IS NULL
  AND regexp_replace(coalesce(e.bank_account_number, ''), '\D', '', 'g') <> '';
