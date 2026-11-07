CREATE TABLE "hris"."short_handover_settlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"payment_id" integer NOT NULL,
	"kind" text NOT NULL,
	"amount" integer,
	"proof_file_id" uuid,
	"note" text NOT NULL,
	"recorded_by_account_id" integer NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by_account_id" integer,
	"void_reason" text,
	CONSTRAINT "short_handover_settlements_source" CHECK ("hris"."short_handover_settlements"."source" in ('TRUCK', 'SELF')),
	CONSTRAINT "short_handover_settlements_kind" CHECK (("hris"."short_handover_settlements"."kind" = 'CASH_REPLACED' and "hris"."short_handover_settlements"."amount" > 0) or ("hris"."short_handover_settlements"."kind" = 'WAIVED' and "hris"."short_handover_settlements"."amount" is null)),
	CONSTRAINT "short_handover_settlements_note_not_blank" CHECK (btrim("hris"."short_handover_settlements"."note") <> ''),
	CONSTRAINT "short_handover_settlements_void_complete" CHECK (("hris"."short_handover_settlements"."voided_at" is null) = ("hris"."short_handover_settlements"."void_reason" is null))
);
--> statement-breakpoint
ALTER TABLE "hris"."other_deductions" ADD COLUMN "money_check_source" text;--> statement-breakpoint
ALTER TABLE "hris"."other_deductions" ADD COLUMN "money_check_payment_id" integer;--> statement-breakpoint
ALTER TABLE "hris"."short_handover_settlements" ADD CONSTRAINT "short_handover_settlements_proof_file_id_files_id_fk" FOREIGN KEY ("proof_file_id") REFERENCES "hris"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "short_handover_settlements_payment_idx" ON "hris"."short_handover_settlements" USING btree ("source","payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "short_handover_settlements_waived_current" ON "hris"."short_handover_settlements" USING btree ("source","payment_id") WHERE "hris"."short_handover_settlements"."kind" = 'WAIVED' and "hris"."short_handover_settlements"."voided_at" is null;--> statement-breakpoint
CREATE INDEX "other_deductions_money_check_idx" ON "hris"."other_deductions" USING btree ("money_check_source","money_check_payment_id") WHERE "hris"."other_deductions"."money_check_payment_id" is not null;--> statement-breakpoint
ALTER TABLE "hris"."other_deductions" ADD CONSTRAINT "other_deductions_money_check_pair" CHECK (("hris"."other_deductions"."money_check_source" is null) = ("hris"."other_deductions"."money_check_payment_id" is null) and ("hris"."other_deductions"."money_check_source" is null or "hris"."other_deductions"."money_check_source" in ('TRUCK', 'SELF')));--> statement-breakpoint
-- Ditulis tangan (spec docs/work/specs/2026-11-08-kurang-serah-potongan-lain-design.md): jenis Potongan Lain untuk kurang serah.
INSERT INTO hris.other_deduction_types (name, sort_order)
SELECT 'Kurang serah uang toko', coalesce(max(sort_order), 0) + 1 FROM hris.other_deduction_types
WHERE NOT EXISTS (SELECT 1 FROM hris.other_deduction_types WHERE lower(name) = 'kurang serah uang toko');
