ALTER TABLE "logistics"."report_decisions" DROP CONSTRAINT "report_decisions_cut";--> statement-breakpoint
ALTER TABLE "logistics"."self_trip_events" DROP CONSTRAINT "self_trip_events_kind";--> statement-breakpoint
ALTER TABLE "logistics"."self_trip_events" DROP CONSTRAINT "self_trip_events_stop";--> statement-breakpoint
DROP INDEX "logistics"."self_trip_payments_stop_unique";--> statement-breakpoint
ALTER TABLE "logistics"."visit_reports" ALTER COLUMN "visit_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "logistics"."visit_reports" ALTER COLUMN "trip_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "logistics"."visit_reports" ALTER COLUMN "customer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "logistics"."report_decisions" ADD COLUMN "transaction_id" integer;--> statement-breakpoint
ALTER TABLE "logistics"."self_trip_events" ADD COLUMN "cash_before" integer;--> statement-breakpoint
ALTER TABLE "logistics"."self_trip_events" ADD COLUMN "cash_after" integer;--> statement-breakpoint
ALTER TABLE "logistics"."self_trip_events" ADD COLUMN "cash_received_before" integer;--> statement-breakpoint
ALTER TABLE "logistics"."self_trip_payments" ADD COLUMN "correction_of_id" integer;--> statement-breakpoint
ALTER TABLE "logistics"."self_trip_payments" ADD COLUMN "correction_reason" text;--> statement-breakpoint
ALTER TABLE "logistics"."self_trip_payments" ADD COLUMN "replaced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "logistics"."visit_reports" ADD COLUMN "self_stop_id" integer;--> statement-breakpoint
ALTER TABLE "logistics"."visit_reports" ADD COLUMN "self_trip_id" integer;--> statement-breakpoint
ALTER TABLE "logistics"."visit_reports" ADD CONSTRAINT "visit_reports_self_stop_id_self_trip_stops_id_fk" FOREIGN KEY ("self_stop_id") REFERENCES "logistics"."self_trip_stops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."visit_reports" ADD CONSTRAINT "visit_reports_self_trip_id_self_trips_id_fk" FOREIGN KEY ("self_trip_id") REFERENCES "logistics"."self_trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "self_trip_payments_stop_current" ON "logistics"."self_trip_payments" USING btree ("stop_id") WHERE "logistics"."self_trip_payments"."replaced_at" is null;--> statement-breakpoint
CREATE INDEX "visit_reports_self_stop_idx" ON "logistics"."visit_reports" USING btree ("self_stop_id");--> statement-breakpoint
ALTER TABLE "logistics"."report_decisions" ADD CONSTRAINT "report_decisions_cut" CHECK (("logistics"."report_decisions"."decision" = 'CUT') = ("logistics"."report_decisions"."amount" is not null and "logistics"."report_decisions"."reason" is not null)
      and ("logistics"."report_decisions"."amount" is null or "logistics"."report_decisions"."amount" > 0)
      and ("logistics"."report_decisions"."reason" is null or "logistics"."report_decisions"."reason" in ('WRONG_ITEM', 'SHORT', 'DAMAGED', 'PRICE', 'REJECTED', 'OTHER'))
      and ("logistics"."report_decisions"."decision" = 'NO_CUT' or "logistics"."report_decisions"."note_id" is not null or "logistics"."report_decisions"."transaction_id" is not null)
      and ("logistics"."report_decisions"."note_id" is null or "logistics"."report_decisions"."transaction_id" is null)
      and ("logistics"."report_decisions"."decision" <> 'NO_CUT' or "logistics"."report_decisions"."note" is not null));--> statement-breakpoint
ALTER TABLE "logistics"."self_trip_events" ADD CONSTRAINT "self_trip_events_cash" CHECK (("logistics"."self_trip_events"."kind" = 'PAYMENT_CORRECTED') = ("logistics"."self_trip_events"."cash_before" is not null and "logistics"."self_trip_events"."cash_after" is not null));--> statement-breakpoint
ALTER TABLE "logistics"."self_trip_events" ADD CONSTRAINT "self_trip_events_kind" CHECK ("logistics"."self_trip_events"."kind" in ('CLOSED', 'HANDOVER', 'RESENT', 'DROPPED', 'PAYMENT_CORRECTED'));--> statement-breakpoint
ALTER TABLE "logistics"."self_trip_events" ADD CONSTRAINT "self_trip_events_stop" CHECK (("logistics"."self_trip_events"."kind" in ('RESENT', 'DROPPED', 'PAYMENT_CORRECTED')) = ("logistics"."self_trip_events"."stop_id" is not null));--> statement-breakpoint
ALTER TABLE "logistics"."self_trip_payments" ADD CONSTRAINT "self_trip_payments_correction" CHECK (("logistics"."self_trip_payments"."correction_of_id" is null) = ("logistics"."self_trip_payments"."correction_reason" is null));--> statement-breakpoint
ALTER TABLE "logistics"."visit_reports" ADD CONSTRAINT "visit_reports_source" CHECK (("logistics"."visit_reports"."visit_id" is not null and "logistics"."visit_reports"."trip_id" is not null and "logistics"."visit_reports"."customer_id" is not null and "logistics"."visit_reports"."self_stop_id" is null and "logistics"."visit_reports"."self_trip_id" is null)
      or ("logistics"."visit_reports"."visit_id" is null and "logistics"."visit_reports"."trip_id" is null and "logistics"."visit_reports"."self_stop_id" is not null and "logistics"."visit_reports"."self_trip_id" is not null));