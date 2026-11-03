CREATE TABLE "hris"."advance_followups" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"advance_id" integer NOT NULL,
	"kind" text NOT NULL,
	"handover_id" integer,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "advance_followups_kind" CHECK ("hris"."advance_followups"."kind" in ('CANCEL', 'NOT_RECEIVED', 'POSTPONE'))
);
--> statement-breakpoint
CREATE TABLE "hris"."advance_handovers" (
	"id" serial PRIMARY KEY NOT NULL,
	"advance_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"money_date" date NOT NULL,
	"source_id" integer NOT NULL,
	"method" text NOT NULL,
	"handed_by_account_id" integer NOT NULL,
	"via_employee_id" integer,
	"proof_file_id" uuid,
	"date_reason" text,
	"before_approval" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"cancel_reason" text,
	"cancelled_by_account_id" integer,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "advance_handovers_amount" CHECK ("hris"."advance_handovers"."amount" > 0),
	CONSTRAINT "advance_handovers_method" CHECK ("hris"."advance_handovers"."method" in ('CASH', 'TRANSFER')),
	CONSTRAINT "advance_handovers_status" CHECK ("hris"."advance_handovers"."status" in ('ACTIVE', 'CANCELLED')),
	CONSTRAINT "advance_handovers_cancelled" CHECK (("hris"."advance_handovers"."status" = 'CANCELLED') = ("hris"."advance_handovers"."cancelled_at" is not null and "hris"."advance_handovers"."cancel_reason" is not null))
);
--> statement-breakpoint
CREATE TABLE "hris"."advance_installments" (
	"id" serial PRIMARY KEY NOT NULL,
	"advance_id" integer NOT NULL,
	"version" integer NOT NULL,
	"sequence" integer NOT NULL,
	"total" integer NOT NULL,
	"amount" integer NOT NULL,
	"period_start" date,
	"status" text DEFAULT 'SCHEDULED' NOT NULL,
	"cause" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "advance_installments_amount" CHECK ("hris"."advance_installments"."amount" > 0 and "hris"."advance_installments"."sequence" between 1 and "hris"."advance_installments"."total"),
	CONSTRAINT "advance_installments_period" CHECK ("hris"."advance_installments"."period_start" is null or extract(day from "hris"."advance_installments"."period_start") = 26),
	CONSTRAINT "advance_installments_status" CHECK ("hris"."advance_installments"."status" in ('SCHEDULED', 'TAKEN', 'PARTIAL', 'REPLACED', 'CANCELLED', 'WAITING_WEEKLY')),
	CONSTRAINT "advance_installments_cause" CHECK ("hris"."advance_installments"."cause" in ('APPROVE', 'HANDOVER', 'HANDOVER_UNDO', 'POSTPONE', 'RESCHEDULE', 'PAY_TRACK', 'REPAY', 'WRITE_OFF', 'UNDO'))
);
--> statement-breakpoint
CREATE TABLE "hris"."advance_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"advance_id" integer NOT NULL,
	"kind" text NOT NULL,
	"amount" integer NOT NULL,
	"payslip_id" integer,
	"installment_id" integer,
	"money_date" date,
	"source_id" integer,
	"proof_file_id" uuid,
	"reason" text,
	"recorded_by_account_id" integer NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"reversed_reason" text,
	"reversed_by_account_id" integer,
	"reversed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "advance_movements_kind" CHECK ("hris"."advance_movements"."kind" in ('SLIP', 'CASH', 'WRITE_OFF', 'TO_RECEIVABLE')),
	CONSTRAINT "advance_movements_amount" CHECK ("hris"."advance_movements"."amount" > 0),
	CONSTRAINT "advance_movements_status" CHECK ("hris"."advance_movements"."status" in ('ACTIVE', 'REVERSED')),
	CONSTRAINT "advance_movements_slip" CHECK ("hris"."advance_movements"."kind" not in ('SLIP', 'TO_RECEIVABLE') or "hris"."advance_movements"."payslip_id" is not null),
	CONSTRAINT "advance_movements_reversed" CHECK (("hris"."advance_movements"."status" = 'REVERSED') = ("hris"."advance_movements"."reversed_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "hris"."advances" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"employee_id" integer NOT NULL,
	"kind" text DEFAULT 'REGULAR' NOT NULL,
	"request_id" integer,
	"filled_by_account_id" integer NOT NULL,
	"filled_by_employee_id" integer NOT NULL,
	"requested_amount" integer NOT NULL,
	"requested_installments" integer NOT NULL,
	"reason" text NOT NULL,
	"fund" text NOT NULL,
	"review_amount" integer,
	"review_installments" integer,
	"review_note" text,
	"reviewed_by_account_id" integer,
	"reviewed_at" timestamp with time zone,
	"final_amount" integer,
	"final_installments" integer,
	"decision_note" text,
	"decided_by_account_id" integer,
	"decided_at" timestamp with time zone,
	"without_review" boolean DEFAULT false NOT NULL,
	"state" text DEFAULT 'OPEN' NOT NULL,
	"close_reason" text,
	"closed_by_account_id" integer,
	"closed_at" timestamp with time zone,
	"event_kind" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "advances_kind" CHECK ("hris"."advances"."kind" in ('REGULAR', 'SPECIAL', 'LEGACY')),
	CONSTRAINT "advances_fund" CHECK ("hris"."advances"."fund" in ('MONTHLY', 'WEEKLY')),
	CONSTRAINT "advances_state" CHECK ("hris"."advances"."state" in ('OPEN', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'CANCELLED')),
	CONSTRAINT "advances_amounts" CHECK ("hris"."advances"."requested_amount" > 0 and "hris"."advances"."requested_installments" >= 1
      and ("hris"."advances"."final_amount" is null or ("hris"."advances"."final_amount" > 0 and "hris"."advances"."final_amount" <= "hris"."advances"."requested_amount"))
      and ("hris"."advances"."review_amount" is null or ("hris"."advances"."review_amount" > 0 and "hris"."advances"."review_amount" <= "hris"."advances"."requested_amount"))),
	CONSTRAINT "advances_regular_request" CHECK ("hris"."advances"."kind" <> 'REGULAR' or "hris"."advances"."request_id" is not null),
	CONSTRAINT "advances_approved_final" CHECK ("hris"."advances"."state" <> 'APPROVED' or ("hris"."advances"."final_amount" is not null and "hris"."advances"."final_installments" is not null and "hris"."advances"."decided_at" is not null)),
	CONSTRAINT "advances_closed_reason" CHECK ("hris"."advances"."state" not in ('CANCELLED') or ("hris"."advances"."close_reason" is not null and "hris"."advances"."closed_at" is not null)),
	CONSTRAINT "advances_reason_not_blank" CHECK (btrim("hris"."advances"."reason") <> '')
);
--> statement-breakpoint
ALTER TABLE "hris"."other_receivables" DROP CONSTRAINT "other_receivables_group";--> statement-breakpoint
ALTER TABLE "hris"."advance_followups" ADD CONSTRAINT "advance_followups_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "hris"."requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."advance_followups" ADD CONSTRAINT "advance_followups_advance_id_advances_id_fk" FOREIGN KEY ("advance_id") REFERENCES "hris"."advances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."advance_followups" ADD CONSTRAINT "advance_followups_handover_id_advance_handovers_id_fk" FOREIGN KEY ("handover_id") REFERENCES "hris"."advance_handovers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."advance_handovers" ADD CONSTRAINT "advance_handovers_advance_id_advances_id_fk" FOREIGN KEY ("advance_id") REFERENCES "hris"."advances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."advance_handovers" ADD CONSTRAINT "advance_handovers_source_id_payment_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "hris"."payment_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."advance_handovers" ADD CONSTRAINT "advance_handovers_via_employee_id_employees_id_fk" FOREIGN KEY ("via_employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."advance_handovers" ADD CONSTRAINT "advance_handovers_proof_file_id_files_id_fk" FOREIGN KEY ("proof_file_id") REFERENCES "hris"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."advance_installments" ADD CONSTRAINT "advance_installments_advance_id_advances_id_fk" FOREIGN KEY ("advance_id") REFERENCES "hris"."advances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."advance_movements" ADD CONSTRAINT "advance_movements_advance_id_advances_id_fk" FOREIGN KEY ("advance_id") REFERENCES "hris"."advances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."advance_movements" ADD CONSTRAINT "advance_movements_payslip_id_payslips_id_fk" FOREIGN KEY ("payslip_id") REFERENCES "hris"."payslips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."advance_movements" ADD CONSTRAINT "advance_movements_installment_id_advance_installments_id_fk" FOREIGN KEY ("installment_id") REFERENCES "hris"."advance_installments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."advance_movements" ADD CONSTRAINT "advance_movements_source_id_payment_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "hris"."payment_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."advance_movements" ADD CONSTRAINT "advance_movements_proof_file_id_files_id_fk" FOREIGN KEY ("proof_file_id") REFERENCES "hris"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."advances" ADD CONSTRAINT "advances_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."advances" ADD CONSTRAINT "advances_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "hris"."requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."advances" ADD CONSTRAINT "advances_filled_by_employee_id_employees_id_fk" FOREIGN KEY ("filled_by_employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "advance_followups_request_unique" ON "hris"."advance_followups" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "advance_followups_advance_idx" ON "hris"."advance_followups" USING btree ("advance_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "advance_handovers_one_active" ON "hris"."advance_handovers" USING btree ("advance_id") WHERE "hris"."advance_handovers"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "advance_installments_advance_idx" ON "hris"."advance_installments" USING btree ("advance_id","status");--> statement-breakpoint
CREATE INDEX "advance_installments_period_idx" ON "hris"."advance_installments" USING btree ("period_start");--> statement-breakpoint
CREATE INDEX "advance_movements_advance_idx" ON "hris"."advance_movements" USING btree ("advance_id","status");--> statement-breakpoint
CREATE INDEX "advance_movements_payslip_idx" ON "hris"."advance_movements" USING btree ("payslip_id");--> statement-breakpoint
CREATE UNIQUE INDEX "advances_number_unique" ON "hris"."advances" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "advances_request_unique" ON "hris"."advances" USING btree ("request_id") WHERE "hris"."advances"."request_id" is not null;--> statement-breakpoint
CREATE INDEX "advances_employee_idx" ON "hris"."advances" USING btree ("employee_id","state");--> statement-breakpoint
ALTER TABLE "hris"."other_receivables" ADD CONSTRAINT "other_receivables_group" CHECK ("hris"."other_receivables"."deduction_group" in ('b', 'c', 'd') or ("hris"."other_receivables"."deduction_group" = 'a' and "hris"."other_receivables"."origin" = 'PAST_CORRECTION'));--> statement-breakpoint
-- Ditulis tangan (spec L5 §2): kasbon, serah uang, jadwal, dan catatan berkurang tidak dihapus (PRI-02, DRV-83).
CREATE TRIGGER advances_no_delete BEFORE DELETE ON hris.advances FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER advance_handovers_no_delete BEFORE DELETE ON hris.advance_handovers FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER advance_installments_no_delete BEFORE DELETE ON hris.advance_installments FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER advance_movements_no_delete BEFORE DELETE ON hris.advance_movements FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
-- Isi awal pengaturan kasbon (harus ada di registry.ts, H18; DRV-85).
INSERT INTO hris.setting_values (key, value, effective_from, status, reason) VALUES
  ('advance.min_tenure_months', '6'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (DRV-55)'),
  ('advance.person_limit', '250000'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (DRV-56)'),
  ('advance.fund_monthly', '1000000'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (DRV-57)'),
  ('advance.fund_weekly', '1000000'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (DRV-57)'),
  ('advance.max_installments', '3'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (DRV-59)'),
  ('advance.reason_min_chars', '15'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (DRV-59)'),
  ('advance.amount_step', '10000'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (DRV-122, K1)'),
  ('advance.amount_min', '50000'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (DRV-122, K1)'),
  ('advance.process_days', '2'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (DRV-64)'),
  ('advance.not_received_days', '3'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (DRV-127, K5)');
--> statement-breakpoint
-- Hak awal L5a (spec L5 §5): HR dan Admin HR melihat + mengisikan atas nama; Finance melihat, memeriksa, menyerahkan uang.
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('hr', 'advance.view', 'ALL'), ('hr', 'advance.fill_for', 'ALL'),
  ('admin hr', 'advance.view', 'ALL'), ('admin hr', 'advance.fill_for', 'ALL'),
  ('finance', 'advance.view', 'ALL'), ('finance', 'advance.review', 'ALL'), ('finance', 'advance.hand_over', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
--> statement-breakpoint
CREATE TRIGGER advance_followups_no_delete BEFORE DELETE ON hris.advance_followups FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
