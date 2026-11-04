CREATE TABLE "logistics"."visit_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"visit_id" integer NOT NULL,
	"trip_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"method" text NOT NULL,
	"bill_amount" integer NOT NULL,
	"received_amount" integer NOT NULL,
	"proof_photo_file_id" uuid,
	"recorded_by_employee_id" integer NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visit_payments_method" CHECK ("logistics"."visit_payments"."method" in ('NONE', 'CASH', 'TRANSFER', 'PARTIAL', 'TEMPO')),
	CONSTRAINT "visit_payments_amounts" CHECK ("logistics"."visit_payments"."bill_amount" >= 0 and "logistics"."visit_payments"."received_amount" >= 0 and (
      ("logistics"."visit_payments"."method" = 'NONE' and "logistics"."visit_payments"."bill_amount" = 0 and "logistics"."visit_payments"."received_amount" = 0)
      or ("logistics"."visit_payments"."method" in ('CASH', 'TRANSFER') and "logistics"."visit_payments"."bill_amount" > 0 and "logistics"."visit_payments"."received_amount" = "logistics"."visit_payments"."bill_amount")
      or ("logistics"."visit_payments"."method" = 'PARTIAL' and "logistics"."visit_payments"."received_amount" > 0 and "logistics"."visit_payments"."received_amount" < "logistics"."visit_payments"."bill_amount")
      or ("logistics"."visit_payments"."method" = 'TEMPO' and "logistics"."visit_payments"."bill_amount" > 0 and "logistics"."visit_payments"."received_amount" = 0))),
	CONSTRAINT "visit_payments_proof" CHECK (("logistics"."visit_payments"."method" = 'TRANSFER') = ("logistics"."visit_payments"."proof_photo_file_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "logistics"."visit_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"visit_id" integer NOT NULL,
	"trip_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"kind" text NOT NULL,
	"note" text,
	"photo_file_id" uuid NOT NULL,
	"carried_back" boolean DEFAULT false NOT NULL,
	"reported_by_employee_id" integer NOT NULL,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by_account_id" integer,
	"close_note" text,
	CONSTRAINT "visit_reports_kind" CHECK ("logistics"."visit_reports"."kind" in ('WRONG_ITEM', 'SHORT', 'DAMAGED', 'RETURN', 'OTHER') and ("logistics"."visit_reports"."kind" <> 'OTHER' or "logistics"."visit_reports"."note" is not null)),
	CONSTRAINT "visit_reports_carried" CHECK ("logistics"."visit_reports"."carried_back" = ("logistics"."visit_reports"."kind" = 'RETURN')),
	CONSTRAINT "visit_reports_closed" CHECK (("logistics"."visit_reports"."closed_at" is null) = ("logistics"."visit_reports"."close_note" is null) and ("logistics"."visit_reports"."closed_at" is null) = ("logistics"."visit_reports"."closed_by_account_id" is null))
);
--> statement-breakpoint
ALTER TABLE "logistics"."visit_payments" ADD CONSTRAINT "visit_payments_visit_id_trip_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "logistics"."trip_visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."visit_payments" ADD CONSTRAINT "visit_payments_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "logistics"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."visit_reports" ADD CONSTRAINT "visit_reports_visit_id_trip_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "logistics"."trip_visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."visit_reports" ADD CONSTRAINT "visit_reports_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "logistics"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "visit_payments_visit_unique" ON "logistics"."visit_payments" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "visit_payments_trip_idx" ON "logistics"."visit_payments" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "visit_reports_visit_idx" ON "logistics"."visit_reports" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "visit_reports_open_idx" ON "logistics"."visit_reports" USING btree ("closed_at");--> statement-breakpoint
CREATE TRIGGER visit_payments_no_delete BEFORE DELETE ON logistics.visit_payments FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
--> statement-breakpoint
CREATE TRIGGER visit_reports_no_delete BEFORE DELETE ON logistics.visit_reports FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
--> statement-breakpoint
-- Kontrak baca dari kasir (spec LT1 §13.5 butir 1): sisa piutang per nota. Kolom view = kontrak (stub
-- `packages/hris-db/test-stubs/petshop-pos.sql` ikut diubah). Pola sama dengan view LT1a (migrasi 0003).
CREATE VIEW logistics.pos_customer_debts AS
  SELECT d.id, d.customer_id, d.transaction_id, d.total_amount, d.paid_amount, d.remaining_amount, d.status
  FROM petshop.customer_debts d;
--> statement-breakpoint
CREATE TRIGGER pos_customer_debts_read_only INSTEAD OF INSERT OR UPDATE OR DELETE ON logistics.pos_customer_debts
  FOR EACH ROW EXECUTE FUNCTION logistics.reject_pos_view_write();
