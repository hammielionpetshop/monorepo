CREATE TYPE "hris"."deduction_objection_target" AS ENUM('CASH_SHORTAGE', 'MANUAL_CASH_SHORTAGE', 'OTHER_DEDUCTION');--> statement-breakpoint
ALTER TYPE "hris"."deduction_record_status" ADD VALUE 'WAIVED';--> statement-breakpoint
CREATE TABLE "hris"."deduction_objections" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"target" "hris"."deduction_objection_target" NOT NULL,
	"target_id" integer NOT NULL,
	"reason" text NOT NULL,
	"state" text DEFAULT 'OPEN' NOT NULL,
	CONSTRAINT "deduction_objections_state" CHECK ("hris"."deduction_objections"."state" in ('OPEN', 'WAIVED', 'KEPT', 'CLOSED'))
);
--> statement-breakpoint
CREATE TABLE "hris"."other_deduction_installments" (
	"id" serial PRIMARY KEY NOT NULL,
	"deduction_id" integer NOT NULL,
	"sequence" integer NOT NULL,
	"period_start" date NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "other_deduction_installments_amount_positive" CHECK ("hris"."other_deduction_installments"."amount" > 0),
	CONSTRAINT "other_deduction_installments_period_start" CHECK (extract(day from "hris"."other_deduction_installments"."period_start") = 26)
);
--> statement-breakpoint
CREATE TABLE "hris"."other_deduction_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "other_deduction_types_name_not_blank" CHECK (btrim("hris"."other_deduction_types"."name") <> '')
);
--> statement-breakpoint
CREATE TABLE "hris"."other_deductions" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"type_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"installments" integer NOT NULL,
	"attachment_file_id" uuid,
	"status" "hris"."deduction_record_status" NOT NULL,
	"request_id" integer,
	"recorded_by_account_id" integer NOT NULL,
	"recorded_by_employee_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_by_account_id" integer,
	"approved_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_account_id" integer,
	"cancel_reason" text,
	CONSTRAINT "other_deductions_amount_positive" CHECK ("hris"."other_deductions"."amount" > 0),
	CONSTRAINT "other_deductions_installments_range" CHECK ("hris"."other_deductions"."installments" between 1 and 3),
	CONSTRAINT "other_deductions_reason_not_blank" CHECK (btrim("hris"."other_deductions"."reason") <> ''),
	CONSTRAINT "other_deductions_not_self" CHECK ("hris"."other_deductions"."employee_id" <> "hris"."other_deductions"."recorded_by_employee_id"),
	CONSTRAINT "other_deductions_active_approved" CHECK ("hris"."other_deductions"."status"::text not in ('ACTIVE', 'WAIVED') or "hris"."other_deductions"."approved_at" is not null),
	CONSTRAINT "other_deductions_cancel_complete" CHECK (("hris"."other_deductions"."status"::text in ('CANCELLED', 'WAIVED')) = ("hris"."other_deductions"."cancel_reason" is not null))
);
--> statement-breakpoint
ALTER TABLE "hris"."deduction_objections" ADD CONSTRAINT "deduction_objections_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "hris"."requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."deduction_objections" ADD CONSTRAINT "deduction_objections_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."other_deduction_installments" ADD CONSTRAINT "other_deduction_installments_deduction_id_other_deductions_id_fk" FOREIGN KEY ("deduction_id") REFERENCES "hris"."other_deductions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."other_deductions" ADD CONSTRAINT "other_deductions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."other_deductions" ADD CONSTRAINT "other_deductions_type_id_other_deduction_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "hris"."other_deduction_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."other_deductions" ADD CONSTRAINT "other_deductions_attachment_file_id_files_id_fk" FOREIGN KEY ("attachment_file_id") REFERENCES "hris"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."other_deductions" ADD CONSTRAINT "other_deductions_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "hris"."requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."other_deductions" ADD CONSTRAINT "other_deductions_recorded_by_employee_id_employees_id_fk" FOREIGN KEY ("recorded_by_employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deduction_objections_request_unique" ON "hris"."deduction_objections" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "deduction_objections_target_idx" ON "hris"."deduction_objections" USING btree ("target","target_id");--> statement-breakpoint
CREATE INDEX "other_deduction_installments_deduction_idx" ON "hris"."other_deduction_installments" USING btree ("deduction_id");--> statement-breakpoint
CREATE INDEX "other_deduction_installments_period_idx" ON "hris"."other_deduction_installments" USING btree ("period_start");--> statement-breakpoint
CREATE UNIQUE INDEX "other_deduction_types_name_unique" ON "hris"."other_deduction_types" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "other_deductions_employee_idx" ON "hris"."other_deductions" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "other_deductions_request_unique" ON "hris"."other_deductions" USING btree ("request_id") WHERE "hris"."other_deductions"."request_id" is not null;--> statement-breakpoint
-- Ditulis tangan (spec L4c §2): tidak ada yang dihapus (PRI-02).
CREATE TRIGGER other_deductions_no_delete BEFORE DELETE ON hris.other_deductions FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER other_deduction_installments_no_delete BEFORE DELETE ON hris.other_deduction_installments FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER deduction_objections_no_delete BEFORE DELETE ON hris.deduction_objections FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER other_deduction_types_no_delete BEFORE DELETE ON hris.other_deduction_types FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
-- Isi awal jenis Potongan Lain (GAJ-80).
INSERT INTO hris.other_deduction_types (name, sort_order) VALUES
  ('Ganti rugi barang rusak', 1), ('Ganti rugi peralatan', 2), ('Lainnya', 3)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Isi awal (harus ada di registry.ts, H18): kali potong paling banyak (GAJ-80, sama dengan kasbon DRV-59).
INSERT INTO hris.setting_values (key, value, effective_from, status, reason) VALUES
  ('payroll.other_deduction_max_installments', '3'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (GAJ-80)');
--> statement-breakpoint
-- Hak awal (spec L4c §5).
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES ('hr', 'other_deduction.view', 'ALL'), ('hr', 'other_deduction.propose', 'ALL')) AS g(position_name, action, scope)
  ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
