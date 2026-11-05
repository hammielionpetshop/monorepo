CREATE TABLE "logistics"."money_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"visit_payment_id" integer,
	"self_payment_id" integer,
	"trip_id" integer,
	"self_trip_id" integer,
	"transaction_id" integer NOT NULL,
	"note_number" text NOT NULL,
	"kind" text NOT NULL,
	"reported_amount" integer NOT NULL,
	"actual_amount" integer NOT NULL,
	"pos_expected_amount" integer NOT NULL,
	"bill_amount" integer,
	"responsible_employee_id" integer,
	"note" text,
	"checked_by_account_id" integer NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by_account_id" integer,
	"void_reason" text,
	CONSTRAINT "money_checks_source" CHECK (("logistics"."money_checks"."source" = 'TRUCK' and "logistics"."money_checks"."visit_payment_id" is not null and "logistics"."money_checks"."trip_id" is not null and "logistics"."money_checks"."self_payment_id" is null and "logistics"."money_checks"."self_trip_id" is null)
      or ("logistics"."money_checks"."source" = 'SELF' and "logistics"."money_checks"."self_payment_id" is not null and "logistics"."money_checks"."self_trip_id" is not null and "logistics"."money_checks"."visit_payment_id" is null and "logistics"."money_checks"."trip_id" is null)),
	CONSTRAINT "money_checks_kind" CHECK ("logistics"."money_checks"."kind" in ('CASH', 'TRANSFER')),
	CONSTRAINT "money_checks_amounts" CHECK ("logistics"."money_checks"."reported_amount" >= 0 and "logistics"."money_checks"."actual_amount" >= 0 and "logistics"."money_checks"."pos_expected_amount" >= 0
      and ("logistics"."money_checks"."bill_amount" is null or "logistics"."money_checks"."bill_amount" >= 0)),
	CONSTRAINT "money_checks_note" CHECK ("logistics"."money_checks"."reported_amount" = "logistics"."money_checks"."actual_amount" or "logistics"."money_checks"."note" is not null),
	CONSTRAINT "money_checks_responsible" CHECK ("logistics"."money_checks"."responsible_employee_id" is null or ("logistics"."money_checks"."kind" = 'CASH' and "logistics"."money_checks"."actual_amount" < "logistics"."money_checks"."reported_amount")),
	CONSTRAINT "money_checks_voided" CHECK (("logistics"."money_checks"."voided_at" is null) = ("logistics"."money_checks"."voided_by_account_id" is null) and ("logistics"."money_checks"."voided_at" is null) = ("logistics"."money_checks"."void_reason" is null))
);
--> statement-breakpoint
CREATE TABLE "logistics"."visit_note_bills" (
	"id" serial PRIMARY KEY NOT NULL,
	"visit_id" integer NOT NULL,
	"note_id" integer NOT NULL,
	"transaction_id" integer NOT NULL,
	"bill_amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visit_note_bills_amount" CHECK ("logistics"."visit_note_bills"."bill_amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "logistics"."money_checks" ADD CONSTRAINT "money_checks_visit_payment_id_visit_payments_id_fk" FOREIGN KEY ("visit_payment_id") REFERENCES "logistics"."visit_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."money_checks" ADD CONSTRAINT "money_checks_self_payment_id_self_trip_payments_id_fk" FOREIGN KEY ("self_payment_id") REFERENCES "logistics"."self_trip_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."money_checks" ADD CONSTRAINT "money_checks_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "logistics"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."money_checks" ADD CONSTRAINT "money_checks_self_trip_id_self_trips_id_fk" FOREIGN KEY ("self_trip_id") REFERENCES "logistics"."self_trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."visit_note_bills" ADD CONSTRAINT "visit_note_bills_visit_id_trip_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "logistics"."trip_visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."visit_note_bills" ADD CONSTRAINT "visit_note_bills_note_id_delivery_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "logistics"."delivery_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "money_checks_truck_current" ON "logistics"."money_checks" USING btree ("visit_payment_id","transaction_id") WHERE "logistics"."money_checks"."voided_at" is null and "logistics"."money_checks"."visit_payment_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "money_checks_self_current" ON "logistics"."money_checks" USING btree ("self_payment_id") WHERE "logistics"."money_checks"."voided_at" is null and "logistics"."money_checks"."self_payment_id" is not null;--> statement-breakpoint
CREATE INDEX "money_checks_transaction_idx" ON "logistics"."money_checks" USING btree ("transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "visit_note_bills_unique" ON "logistics"."visit_note_bills" USING btree ("visit_id","note_id");--> statement-breakpoint
CREATE TRIGGER money_checks_no_delete BEFORE DELETE ON logistics.money_checks FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
--> statement-breakpoint
CREATE TRIGGER visit_note_bills_no_delete BEFORE DELETE ON logistics.visit_note_bills FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
