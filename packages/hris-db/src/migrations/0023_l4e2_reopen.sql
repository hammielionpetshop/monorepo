CREATE TABLE "hris"."other_receivables" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"payslip_id" integer NOT NULL,
	"deduction_group" text NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"reason" text,
	"decided_by_account_id" integer,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "other_receivables_group" CHECK ("hris"."other_receivables"."deduction_group" in ('b', 'c')),
	CONSTRAINT "other_receivables_status" CHECK ("hris"."other_receivables"."status" in ('OPEN', 'WRITTEN_OFF', 'REVERSED')),
	CONSTRAINT "other_receivables_amount" CHECK ("hris"."other_receivables"."amount" > 0),
	CONSTRAINT "other_receivables_written_off" CHECK ("hris"."other_receivables"."status" <> 'WRITTEN_OFF' or ("hris"."other_receivables"."reason" is not null and "hris"."other_receivables"."decided_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "hris"."bonus_entries" DROP CONSTRAINT "bonus_entries_status";--> statement-breakpoint
ALTER TABLE "hris"."bonus_entries" DROP CONSTRAINT "bonus_entries_in_slip";--> statement-breakpoint
ALTER TABLE "hris"."payslip_steps" DROP CONSTRAINT "payslip_steps_action";--> statement-breakpoint
ALTER TABLE "hris"."deduction_carryovers" ADD COLUMN "source_key" text;--> statement-breakpoint
ALTER TABLE "hris"."other_deductions" ADD COLUMN "written_off_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hris"."other_deductions" ADD COLUMN "written_off_by_account_id" integer;--> statement-breakpoint
ALTER TABLE "hris"."other_deductions" ADD COLUMN "write_off_reason" text;--> statement-breakpoint
ALTER TABLE "hris"."other_receivables" ADD CONSTRAINT "other_receivables_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."other_receivables" ADD CONSTRAINT "other_receivables_payslip_id_payslips_id_fk" FOREIGN KEY ("payslip_id") REFERENCES "hris"."payslips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "other_receivables_employee_idx" ON "hris"."other_receivables" USING btree ("employee_id","status");--> statement-breakpoint
CREATE INDEX "other_receivables_payslip_idx" ON "hris"."other_receivables" USING btree ("payslip_id");--> statement-breakpoint
ALTER TABLE "hris"."bonus_entries" ADD CONSTRAINT "bonus_entries_status" CHECK ("hris"."bonus_entries"."status" in ('HELD', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'IN_SLIP', 'FORFEITED'));--> statement-breakpoint
ALTER TABLE "hris"."bonus_entries" ADD CONSTRAINT "bonus_entries_in_slip" CHECK (("hris"."bonus_entries"."status" in ('IN_SLIP', 'FORFEITED')) = ("hris"."bonus_entries"."payslip_id" is not null));--> statement-breakpoint
ALTER TABLE "hris"."other_deductions" ADD CONSTRAINT "other_deductions_write_off_complete" CHECK (("hris"."other_deductions"."written_off_at" is null) = ("hris"."other_deductions"."write_off_reason" is null));--> statement-breakpoint
ALTER TABLE "hris"."payslip_steps" ADD CONSTRAINT "payslip_steps_action" CHECK ("hris"."payslip_steps"."action" in ('CLOSE', 'PRINT', 'PRINT_MANY', 'REOPEN', 'REOPEN_REQUEST', 'EARLY_CLOSE'));--> statement-breakpoint
-- Ditulis tangan (spec L4e §2): Piutang Lain tidak dihapus.
CREATE TRIGGER other_receivables_no_delete BEFORE DELETE ON hris.other_receivables FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
-- Hak awal L4e-2 (spec L4e §5). Buka kembali, Tutup lebih cepat, dan Hapuskan hanya Pemilik/GM (full_access, tanpa baris).
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('hr', 'payslip.request_reopen', 'ALL'), ('hr', 'receivable.view', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
