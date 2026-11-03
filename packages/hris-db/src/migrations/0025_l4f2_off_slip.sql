CREATE TABLE "hris"."off_slip_claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"last_payslip_id" integer NOT NULL,
	"origin_key" text NOT NULL,
	"source_key" text NOT NULL,
	"kind" text NOT NULL,
	"line_kind" text NOT NULL,
	"label" text NOT NULL,
	"bonus_entry_id" integer,
	"fund" text,
	"branch_id" integer,
	"branch_name" text,
	"origin_period" date,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'WAITING' NOT NULL,
	"cancel_reason" text,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "off_slip_claims_kind" CHECK ("hris"."off_slip_claims"."kind" in ('BONUS', 'CORRECTION')),
	CONSTRAINT "off_slip_claims_status" CHECK ("hris"."off_slip_claims"."status" in ('WAITING', 'PAID', 'CANCELLED')),
	CONSTRAINT "off_slip_claims_amount" CHECK ("hris"."off_slip_claims"."amount" > 0),
	CONSTRAINT "off_slip_claims_bonus" CHECK (("hris"."off_slip_claims"."kind" = 'BONUS') = ("hris"."off_slip_claims"."bonus_entry_id" is not null)),
	CONSTRAINT "off_slip_claims_cancelled" CHECK (("hris"."off_slip_claims"."status" = 'CANCELLED') = ("hris"."off_slip_claims"."cancelled_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "hris"."receivable_settlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"receivable_id" integer NOT NULL,
	"claim_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_by_account_id" integer NOT NULL,
	"reversed_at" timestamp with time zone,
	"reversed_by_account_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receivable_settlements_amount" CHECK ("hris"."receivable_settlements"."amount" > 0),
	CONSTRAINT "receivable_settlements_status" CHECK ("hris"."receivable_settlements"."status" in ('ACTIVE', 'REVERSED')),
	CONSTRAINT "receivable_settlements_reversed" CHECK (("hris"."receivable_settlements"."status" = 'REVERSED') = ("hris"."receivable_settlements"."reversed_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "hris"."bonus_entries" DROP CONSTRAINT "bonus_entries_status";--> statement-breakpoint
ALTER TABLE "hris"."fund_entries" DROP CONSTRAINT "fund_entries_kind";--> statement-breakpoint
ALTER TABLE "hris"."other_receivables" DROP CONSTRAINT "other_receivables_status";--> statement-breakpoint
ALTER TABLE "hris"."payslip_payments" ALTER COLUMN "payslip_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "hris"."fund_entries" ADD COLUMN "claim_id" integer;--> statement-breakpoint
ALTER TABLE "hris"."payslip_payments" ADD COLUMN "claim_id" integer;--> statement-breakpoint
ALTER TABLE "hris"."off_slip_claims" ADD CONSTRAINT "off_slip_claims_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."off_slip_claims" ADD CONSTRAINT "off_slip_claims_last_payslip_id_payslips_id_fk" FOREIGN KEY ("last_payslip_id") REFERENCES "hris"."payslips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."off_slip_claims" ADD CONSTRAINT "off_slip_claims_bonus_entry_id_bonus_entries_id_fk" FOREIGN KEY ("bonus_entry_id") REFERENCES "hris"."bonus_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."off_slip_claims" ADD CONSTRAINT "off_slip_claims_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "hris"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."receivable_settlements" ADD CONSTRAINT "receivable_settlements_receivable_id_other_receivables_id_fk" FOREIGN KEY ("receivable_id") REFERENCES "hris"."other_receivables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."receivable_settlements" ADD CONSTRAINT "receivable_settlements_claim_id_off_slip_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "hris"."off_slip_claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "off_slip_claims_origin_live" ON "hris"."off_slip_claims" USING btree ("origin_key") WHERE "hris"."off_slip_claims"."status" <> 'CANCELLED';--> statement-breakpoint
CREATE INDEX "off_slip_claims_employee_idx" ON "hris"."off_slip_claims" USING btree ("employee_id","status");--> statement-breakpoint
CREATE INDEX "receivable_settlements_receivable_idx" ON "hris"."receivable_settlements" USING btree ("receivable_id","status");--> statement-breakpoint
CREATE INDEX "receivable_settlements_claim_idx" ON "hris"."receivable_settlements" USING btree ("claim_id");--> statement-breakpoint
ALTER TABLE "hris"."fund_entries" ADD CONSTRAINT "fund_entries_claim_id_off_slip_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "hris"."off_slip_claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."payslip_payments" ADD CONSTRAINT "payslip_payments_claim_id_off_slip_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "hris"."off_slip_claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payslip_payments_one_active_claim" ON "hris"."payslip_payments" USING btree ("claim_id") WHERE "hris"."payslip_payments"."status" = 'ACTIVE';--> statement-breakpoint
ALTER TABLE "hris"."bonus_entries" ADD CONSTRAINT "bonus_entries_status" CHECK ("hris"."bonus_entries"."status" in ('HELD', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'IN_SLIP', 'FORFEITED', 'PAID_OUTSIDE'));--> statement-breakpoint
ALTER TABLE "hris"."fund_entries" ADD CONSTRAINT "fund_entries_off_slip" CHECK (("hris"."fund_entries"."kind" = 'OFF_SLIP') = ("hris"."fund_entries"."claim_id" is not null));--> statement-breakpoint
ALTER TABLE "hris"."fund_entries" ADD CONSTRAINT "fund_entries_kind" CHECK ("hris"."fund_entries"."kind" in ('OPENING', 'ADJUSTMENT', 'TRANSFER', 'SLIP', 'OFF_SLIP'));--> statement-breakpoint
ALTER TABLE "hris"."other_receivables" ADD CONSTRAINT "other_receivables_status" CHECK ("hris"."other_receivables"."status" in ('OPEN', 'WRITTEN_OFF', 'REVERSED', 'SETTLED'));--> statement-breakpoint
ALTER TABLE "hris"."payslip_payments" ADD CONSTRAINT "payslip_payments_target" CHECK (("hris"."payslip_payments"."payslip_id" is null) <> ("hris"."payslip_payments"."claim_id" is null));--> statement-breakpoint
-- Ditulis tangan (spec L4f §2): tagihan luar slip dan cicilan piutang tidak dihapus.
CREATE TRIGGER off_slip_claims_no_delete BEFORE DELETE ON hris.off_slip_claims FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER receivable_settlements_no_delete BEFORE DELETE ON hris.receivable_settlements FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
-- Hak awal L4f-2 (spec L4f §5): Ringkasan Gaji untuk HR (tanpa jabatan bertanda) dan Finance (bentuk Finance).
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('hr', 'payroll_summary.view', 'ALL'), ('finance', 'payroll_summary.view', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
