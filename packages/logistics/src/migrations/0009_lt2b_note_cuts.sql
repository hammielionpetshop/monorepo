-- Logistik LT2b: keputusan potong nota, Perlu dicatat di kasir, koreksi cara bayar, janji bayar sisa (spec docs/work/specs/2026-11-04-hris-logistik-t1-toko-surat-jalan-design.md §14.2).
CREATE TABLE "logistics"."report_decisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"decision" text NOT NULL,
	"note_id" integer,
	"amount" integer,
	"reason" text,
	"note" text,
	"decided_by_account_id" integer NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"change_reason" text,
	"replaced_at" timestamp with time zone,
	"recorded_at" timestamp with time zone,
	"recorded_by_account_id" integer,
	"recorded_ref" text,
	CONSTRAINT "report_decisions_decision" CHECK ("logistics"."report_decisions"."decision" in ('CUT', 'RETURN_BO', 'NO_CUT')),
	CONSTRAINT "report_decisions_cut" CHECK (("logistics"."report_decisions"."decision" = 'CUT') = ("logistics"."report_decisions"."amount" is not null and "logistics"."report_decisions"."reason" is not null)
      and ("logistics"."report_decisions"."amount" is null or "logistics"."report_decisions"."amount" > 0)
      and ("logistics"."report_decisions"."reason" is null or "logistics"."report_decisions"."reason" in ('WRONG_ITEM', 'SHORT', 'DAMAGED', 'PRICE', 'REJECTED', 'OTHER'))
      and ("logistics"."report_decisions"."decision" = 'NO_CUT' or "logistics"."report_decisions"."note_id" is not null)
      and ("logistics"."report_decisions"."decision" <> 'NO_CUT' or "logistics"."report_decisions"."note" is not null)),
	CONSTRAINT "report_decisions_recorded" CHECK (("logistics"."report_decisions"."recorded_at" is null) = ("logistics"."report_decisions"."recorded_by_account_id" is null) and ("logistics"."report_decisions"."recorded_at" is null) = ("logistics"."report_decisions"."recorded_ref" is null)
      and ("logistics"."report_decisions"."recorded_at" is null or "logistics"."report_decisions"."decision" <> 'NO_CUT'))
);
--> statement-breakpoint
ALTER TABLE "logistics"."visit_reports" DROP CONSTRAINT "visit_reports_kind";--> statement-breakpoint
DROP INDEX "logistics"."visit_payments_visit_unique";--> statement-breakpoint
ALTER TABLE "logistics"."visit_payments" ADD COLUMN "promise_date" date;--> statement-breakpoint
ALTER TABLE "logistics"."visit_payments" ADD COLUMN "correction_of_id" integer;--> statement-breakpoint
ALTER TABLE "logistics"."visit_payments" ADD COLUMN "correction_reason" text;--> statement-breakpoint
ALTER TABLE "logistics"."visit_payments" ADD COLUMN "recorded_by_account_id" integer;--> statement-breakpoint
ALTER TABLE "logistics"."visit_payments" ADD COLUMN "replaced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "logistics"."report_decisions" ADD CONSTRAINT "report_decisions_report_id_visit_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "logistics"."visit_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."report_decisions" ADD CONSTRAINT "report_decisions_note_id_delivery_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "logistics"."delivery_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "report_decisions_current" ON "logistics"."report_decisions" USING btree ("report_id") WHERE "logistics"."report_decisions"."replaced_at" is null;--> statement-breakpoint
CREATE INDEX "report_decisions_unrecorded_idx" ON "logistics"."report_decisions" USING btree ("recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "visit_payments_visit_current" ON "logistics"."visit_payments" USING btree ("visit_id") WHERE "logistics"."visit_payments"."replaced_at" is null;--> statement-breakpoint
ALTER TABLE "logistics"."visit_payments" ADD CONSTRAINT "visit_payments_promise" CHECK ("logistics"."visit_payments"."promise_date" is null or "logistics"."visit_payments"."method" in ('PARTIAL', 'TEMPO'));--> statement-breakpoint
ALTER TABLE "logistics"."visit_payments" ADD CONSTRAINT "visit_payments_correction" CHECK (("logistics"."visit_payments"."correction_of_id" is null) = ("logistics"."visit_payments"."correction_reason" is null));--> statement-breakpoint
ALTER TABLE "logistics"."visit_reports" ADD CONSTRAINT "visit_reports_kind" CHECK ("logistics"."visit_reports"."kind" in ('WRONG_ITEM', 'SHORT', 'DAMAGED', 'PRICE', 'RETURN', 'OTHER') and ("logistics"."visit_reports"."kind" not in ('OTHER', 'PRICE') or "logistics"."visit_reports"."note" is not null));--> statement-breakpoint
CREATE TRIGGER report_decisions_no_delete BEFORE DELETE ON logistics.report_decisions FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
