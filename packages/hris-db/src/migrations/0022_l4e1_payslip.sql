CREATE TABLE "hris"."deduction_carryovers" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"from_payslip_id" integer NOT NULL,
	"deduction_group" text NOT NULL,
	"line_kind" text NOT NULL,
	"label" text NOT NULL,
	"origin_period" date NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'CARRIED' NOT NULL,
	"taken_in_payslip_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deduction_carryovers_group" CHECK ("hris"."deduction_carryovers"."deduction_group" in ('a', 'b', 'c', 'd')),
	CONSTRAINT "deduction_carryovers_status" CHECK ("hris"."deduction_carryovers"."status" in ('CARRIED', 'TAKEN', 'CANCELLED')),
	CONSTRAINT "deduction_carryovers_amount" CHECK ("hris"."deduction_carryovers"."amount" > 0),
	CONSTRAINT "deduction_carryovers_taken_in" CHECK (("hris"."deduction_carryovers"."status" = 'TAKEN') = ("hris"."deduction_carryovers"."taken_in_payslip_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "hris"."payslip_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"payslip_id" integer NOT NULL,
	"version" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"section" text NOT NULL,
	"deduction_group" text,
	"source_key" text NOT NULL,
	"line_kind" text NOT NULL,
	"label" text NOT NULL,
	"origin_period" date,
	"amount" integer NOT NULL,
	"taken" integer DEFAULT 0 NOT NULL,
	"remaining" integer DEFAULT 0 NOT NULL,
	"details" jsonb,
	"sort_order" integer NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payslip_lines_section" CHECK ("hris"."payslip_lines"."section" in ('INCOME', 'DEDUCTION', 'NOTE')),
	CONSTRAINT "payslip_lines_group" CHECK (("hris"."payslip_lines"."section" = 'DEDUCTION') = ("hris"."payslip_lines"."deduction_group" is not null)),
	CONSTRAINT "payslip_lines_status" CHECK ("hris"."payslip_lines"."status" in ('ACTIVE', 'REPLACED')),
	CONSTRAINT "payslip_lines_amounts" CHECK ("hris"."payslip_lines"."amount" >= 0 and "hris"."payslip_lines"."taken" >= 0 and "hris"."payslip_lines"."remaining" >= 0 and "hris"."payslip_lines"."taken" + "hris"."payslip_lines"."remaining" <= "hris"."payslip_lines"."amount")
);
--> statement-breakpoint
CREATE TABLE "hris"."payslip_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"payslip_id" integer,
	"period_start" date NOT NULL,
	"action" text NOT NULL,
	"reason" text,
	"summary" jsonb,
	"actor_account_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payslip_steps_action" CHECK ("hris"."payslip_steps"."action" in ('CLOSE', 'PRINT', 'PRINT_MANY'))
);
--> statement-breakpoint
CREATE TABLE "hris"."payslips" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"period_start" date NOT NULL,
	"kind" text DEFAULT 'MONTHLY' NOT NULL,
	"status" text DEFAULT 'ESTIMATE' NOT NULL,
	"number" text,
	"version" integer DEFAULT 0 NOT NULL,
	"branch_id" integer,
	"branch_name" text,
	"position_name" text,
	"income" integer,
	"taken" integer,
	"net" integer,
	"carried" integer,
	"last_slip" boolean DEFAULT false NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by_account_id" integer,
	"objection_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payslips_kind" CHECK ("hris"."payslips"."kind" in ('MONTHLY')),
	CONSTRAINT "payslips_status" CHECK ("hris"."payslips"."status" in ('ESTIMATE', 'CLOSED')),
	CONSTRAINT "payslips_period_start" CHECK (extract(day from "hris"."payslips"."period_start") = 26),
	CONSTRAINT "payslips_closed_complete" CHECK ("hris"."payslips"."status" <> 'CLOSED' or ("hris"."payslips"."number" is not null and "hris"."payslips"."net" is not null and "hris"."payslips"."closed_at" is not null and "hris"."payslips"."objection_until" is not null)),
	CONSTRAINT "payslips_net_not_negative" CHECK ("hris"."payslips"."net" is null or "hris"."payslips"."net" >= 0)
);
--> statement-breakpoint
ALTER TABLE "hris"."bonus_entries" DROP CONSTRAINT "bonus_entries_status";--> statement-breakpoint
ALTER TABLE "hris"."fund_entries" DROP CONSTRAINT "fund_entries_kind";--> statement-breakpoint
ALTER TABLE "hris"."bonus_entries" ADD COLUMN "payslip_id" integer;--> statement-breakpoint
ALTER TABLE "hris"."fund_entries" ADD COLUMN "payslip_id" integer;--> statement-breakpoint
ALTER TABLE "hris"."deduction_carryovers" ADD CONSTRAINT "deduction_carryovers_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."deduction_carryovers" ADD CONSTRAINT "deduction_carryovers_from_payslip_id_payslips_id_fk" FOREIGN KEY ("from_payslip_id") REFERENCES "hris"."payslips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."deduction_carryovers" ADD CONSTRAINT "deduction_carryovers_taken_in_payslip_id_payslips_id_fk" FOREIGN KEY ("taken_in_payslip_id") REFERENCES "hris"."payslips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."payslip_lines" ADD CONSTRAINT "payslip_lines_payslip_id_payslips_id_fk" FOREIGN KEY ("payslip_id") REFERENCES "hris"."payslips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."payslip_lines" ADD CONSTRAINT "payslip_lines_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."payslip_steps" ADD CONSTRAINT "payslip_steps_payslip_id_payslips_id_fk" FOREIGN KEY ("payslip_id") REFERENCES "hris"."payslips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."payslips" ADD CONSTRAINT "payslips_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."payslips" ADD CONSTRAINT "payslips_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "hris"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deduction_carryovers_person_idx" ON "hris"."deduction_carryovers" USING btree ("employee_id","status");--> statement-breakpoint
CREATE INDEX "payslip_lines_slip_idx" ON "hris"."payslip_lines" USING btree ("payslip_id","version");--> statement-breakpoint
CREATE INDEX "payslip_lines_source_idx" ON "hris"."payslip_lines" USING btree ("employee_id","source_key");--> statement-breakpoint
CREATE INDEX "payslip_steps_period_idx" ON "hris"."payslip_steps" USING btree ("period_start","created_at");--> statement-breakpoint
CREATE INDEX "payslip_steps_slip_idx" ON "hris"."payslip_steps" USING btree ("payslip_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payslips_person_period_kind" ON "hris"."payslips" USING btree ("employee_id","period_start","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "payslips_number_unique" ON "hris"."payslips" USING btree ("number") WHERE "hris"."payslips"."number" is not null;--> statement-breakpoint
CREATE INDEX "payslips_period_idx" ON "hris"."payslips" USING btree ("period_start","status");--> statement-breakpoint
ALTER TABLE "hris"."bonus_entries" ADD CONSTRAINT "bonus_entries_payslip_id_payslips_id_fk" FOREIGN KEY ("payslip_id") REFERENCES "hris"."payslips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."fund_entries" ADD CONSTRAINT "fund_entries_payslip_id_payslips_id_fk" FOREIGN KEY ("payslip_id") REFERENCES "hris"."payslips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."bonus_entries" ADD CONSTRAINT "bonus_entries_in_slip" CHECK (("hris"."bonus_entries"."status" = 'IN_SLIP') = ("hris"."bonus_entries"."payslip_id" is not null));--> statement-breakpoint
ALTER TABLE "hris"."bonus_entries" ADD CONSTRAINT "bonus_entries_status" CHECK ("hris"."bonus_entries"."status" in ('HELD', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'IN_SLIP'));--> statement-breakpoint
ALTER TABLE "hris"."fund_entries" ADD CONSTRAINT "fund_entries_slip" CHECK (("hris"."fund_entries"."kind" = 'SLIP') = ("hris"."fund_entries"."payslip_id" is not null));--> statement-breakpoint
ALTER TABLE "hris"."fund_entries" ADD CONSTRAINT "fund_entries_kind" CHECK ("hris"."fund_entries"."kind" in ('OPENING', 'ADJUSTMENT', 'TRANSFER', 'SLIP'));--> statement-breakpoint
-- Ditulis tangan (spec L4e §2): baris slip, sisa potongan, dan jejak tidak dihapus; slip tidak dihapus.
CREATE TRIGGER payslips_no_delete BEFORE DELETE ON hris.payslips FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER payslip_lines_no_delete BEFORE DELETE ON hris.payslip_lines FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER deduction_carryovers_no_delete BEFORE DELETE ON hris.deduction_carryovers FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER payslip_steps_append_only BEFORE UPDATE OR DELETE ON hris.payslip_steps FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
-- Jendela tutup slip (spec L4e §3.4, §9 butir 3): Tutup aktif tanggal 29 pukul 00.00 WIB sesudah periode berakhir.
INSERT INTO hris.setting_values (key, value, effective_from, status, reason) VALUES
  ('payroll.slip_close_open_day', '29'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (GAJ-92, S1)');
--> statement-breakpoint
-- Hak awal L4e-1 (spec L4e §5). Pemilik/GM (full_access) memegang semua tindakan tanpa baris.
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('hr', 'payslip.view', 'ALL'), ('hr', 'payslip.close', 'ALL'),
  ('admin hr', 'payslip.view_periods', 'ALL'), ('finance', 'payslip.view_periods', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
