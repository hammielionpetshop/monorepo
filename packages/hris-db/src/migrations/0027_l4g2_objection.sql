ALTER TYPE "hris"."salary_change_origin" ADD VALUE 'CORRECTION';--> statement-breakpoint
CREATE TABLE "hris"."payslip_objections" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"payslip_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"slip_version" integer NOT NULL,
	"slip_status" text NOT NULL,
	"kind" text NOT NULL,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"payment_id" integer,
	"reason" text NOT NULL,
	"state" text DEFAULT 'PENDING' NOT NULL,
	"fix_path" text,
	"fix_status" text DEFAULT 'NONE' NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by_account_id" integer,
	"fix_kind" text,
	"fix_id" integer,
	"fix_text" text,
	"linked_at" timestamp with time zone,
	"linked_by_account_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payslip_objections_kind" CHECK ("hris"."payslip_objections"."kind" in ('WRONG', 'NOT_RECEIVED')),
	CONSTRAINT "payslip_objections_slip_status" CHECK ("hris"."payslip_objections"."slip_status" in ('ESTIMATE', 'CLOSED')),
	CONSTRAINT "payslip_objections_state" CHECK ("hris"."payslip_objections"."state" in ('PENDING', 'APPROVED', 'REJECTED', 'CLOSED')),
	CONSTRAINT "payslip_objections_fix_path" CHECK ("hris"."payslip_objections"."fix_path" is null or "hris"."payslip_objections"."fix_path" in ('SOURCE', 'REOPEN', 'PAST_CORRECTION', 'SALARY_CORRECTION', 'CANCEL_PAYMENT')),
	CONSTRAINT "payslip_objections_fix_status" CHECK ("hris"."payslip_objections"."fix_status" in ('NONE', 'WAITING_FIX', 'FIXED')),
	CONSTRAINT "payslip_objections_payment" CHECK (("hris"."payslip_objections"."kind" = 'NOT_RECEIVED') = ("hris"."payslip_objections"."payment_id" is not null)),
	CONSTRAINT "payslip_objections_approved" CHECK (("hris"."payslip_objections"."state" = 'APPROVED') = ("hris"."payslip_objections"."approved_at" is not null and "hris"."payslip_objections"."fix_path" is not null)),
	CONSTRAINT "payslip_objections_waiting" CHECK ("hris"."payslip_objections"."fix_status" = 'NONE' or "hris"."payslip_objections"."state" = 'APPROVED'),
	CONSTRAINT "payslip_objections_linked" CHECK (("hris"."payslip_objections"."fix_status" = 'FIXED') = ("hris"."payslip_objections"."linked_at" is not null and "hris"."payslip_objections"."fix_kind" is not null)),
	CONSTRAINT "payslip_objections_reason" CHECK (length(btrim("hris"."payslip_objections"."reason")) >= 20)
);
--> statement-breakpoint
ALTER TABLE "hris"."other_receivables" DROP CONSTRAINT "other_receivables_group";--> statement-breakpoint
ALTER TABLE "hris"."other_receivables" ADD COLUMN "origin" text DEFAULT 'SLIP' NOT NULL;--> statement-breakpoint
ALTER TABLE "hris"."other_receivables" ADD COLUMN "source_key" text;--> statement-breakpoint
ALTER TABLE "hris"."other_receivables" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "hris"."salary_changes" ADD COLUMN "objection_id" integer;--> statement-breakpoint
ALTER TABLE "hris"."payslip_objections" ADD CONSTRAINT "payslip_objections_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "hris"."requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."payslip_objections" ADD CONSTRAINT "payslip_objections_payslip_id_payslips_id_fk" FOREIGN KEY ("payslip_id") REFERENCES "hris"."payslips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."payslip_objections" ADD CONSTRAINT "payslip_objections_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."payslip_objections" ADD CONSTRAINT "payslip_objections_payment_id_payslip_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "hris"."payslip_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payslip_objections_request_unique" ON "hris"."payslip_objections" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payslip_objections_one_pending" ON "hris"."payslip_objections" USING btree ("payslip_id","kind") WHERE "hris"."payslip_objections"."state" = 'PENDING';--> statement-breakpoint
CREATE INDEX "payslip_objections_employee_idx" ON "hris"."payslip_objections" USING btree ("employee_id","state");--> statement-breakpoint
CREATE INDEX "payslip_objections_fix_idx" ON "hris"."payslip_objections" USING btree ("fix_status");--> statement-breakpoint
ALTER TABLE "hris"."salary_changes" ADD CONSTRAINT "salary_changes_objection_id_payslip_objections_id_fk" FOREIGN KEY ("objection_id") REFERENCES "hris"."payslip_objections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."other_receivables" ADD CONSTRAINT "other_receivables_origin" CHECK ("hris"."other_receivables"."origin" in ('SLIP', 'PAST_CORRECTION'));--> statement-breakpoint
ALTER TABLE "hris"."other_receivables" ADD CONSTRAINT "other_receivables_origin_key" CHECK (("hris"."other_receivables"."origin" = 'PAST_CORRECTION') = ("hris"."other_receivables"."source_key" is not null));--> statement-breakpoint
ALTER TABLE "hris"."other_receivables" ADD CONSTRAINT "other_receivables_group" CHECK ("hris"."other_receivables"."deduction_group" in ('b', 'c') or ("hris"."other_receivables"."deduction_group" = 'a' and "hris"."other_receivables"."origin" = 'PAST_CORRECTION'));--> statement-breakpoint
-- Ditulis tangan (spec L4g §2): keberatan slip tidak dihapus.
CREATE TRIGGER payslip_objections_no_delete BEFORE DELETE ON hris.payslip_objections FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
-- Hak awal L4g-2 (spec L4g §5): HR memutuskan keberatan slip "Ada yang salah" (tanpa jabatan bertanda).
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('hr', 'payslip_objection.decide', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
