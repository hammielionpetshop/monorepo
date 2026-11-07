CREATE TABLE "logistics"."return_pickup_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"pickup_id" integer NOT NULL,
	"kind" text NOT NULL,
	"trip_id" integer,
	"note" text,
	"photo_file_id" uuid,
	"latitude" double precision,
	"longitude" double precision,
	"by_account_id" integer,
	"by_employee_id" integer,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "return_pickup_events_kind" CHECK ("logistics"."return_pickup_events"."kind" in ('CREATED', 'ON_TRIP', 'RELEASED', 'TOMORROW', 'MISSED', 'PICKED', 'NO_GOODS', 'CANCELLED')),
	CONSTRAINT "return_pickup_events_photo" CHECK ("logistics"."return_pickup_events"."kind" not in ('TOMORROW', 'PICKED', 'NO_GOODS') or "logistics"."return_pickup_events"."photo_file_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "logistics"."return_pickups" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"owner_branch_id" integer NOT NULL,
	"reason" text NOT NULL,
	"estimate" text,
	"status" text DEFAULT 'WAITING' NOT NULL,
	"trip_id" integer,
	"tries" integer DEFAULT 0 NOT NULL,
	"report_id" integer,
	"done_at" timestamp with time zone,
	"created_by_account_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_account_id" integer,
	"cancel_reason" text,
	"updated_at" timestamp with time zone,
	CONSTRAINT "return_pickups_status" CHECK ("logistics"."return_pickups"."status" in ('WAITING', 'ON_TRIP', 'PICKED', 'NO_GOODS', 'CANCELLED')),
	CONSTRAINT "return_pickups_reason" CHECK (char_length(btrim("logistics"."return_pickups"."reason")) between 5 and 300 and ("logistics"."return_pickups"."estimate" is null or char_length("logistics"."return_pickups"."estimate") <= 300)),
	CONSTRAINT "return_pickups_on_trip" CHECK ("logistics"."return_pickups"."status" <> 'ON_TRIP' or "logistics"."return_pickups"."trip_id" is not null),
	CONSTRAINT "return_pickups_picked" CHECK (("logistics"."return_pickups"."status" = 'PICKED') = ("logistics"."return_pickups"."report_id" is not null)),
	CONSTRAINT "return_pickups_done" CHECK (("logistics"."return_pickups"."status" in ('PICKED', 'NO_GOODS')) = ("logistics"."return_pickups"."done_at" is not null)),
	CONSTRAINT "return_pickups_cancelled" CHECK (("logistics"."return_pickups"."status" = 'CANCELLED') = ("logistics"."return_pickups"."cancelled_at" is not null and "logistics"."return_pickups"."cancel_reason" is not null and "logistics"."return_pickups"."cancelled_by_account_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "logistics"."report_decisions" DROP CONSTRAINT "report_decisions_cut";--> statement-breakpoint
ALTER TABLE "logistics"."visit_reports" DROP CONSTRAINT "visit_reports_source";--> statement-breakpoint
ALTER TABLE "logistics"."visit_reports" ADD COLUMN "return_pickup_id" integer;--> statement-breakpoint
ALTER TABLE "logistics"."return_pickup_events" ADD CONSTRAINT "return_pickup_events_pickup_id_return_pickups_id_fk" FOREIGN KEY ("pickup_id") REFERENCES "logistics"."return_pickups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."return_pickup_events" ADD CONSTRAINT "return_pickup_events_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "logistics"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."return_pickups" ADD CONSTRAINT "return_pickups_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "logistics"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."return_pickups" ADD CONSTRAINT "return_pickups_report_id_visit_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "logistics"."visit_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "return_pickup_events_pickup_idx" ON "logistics"."return_pickup_events" USING btree ("pickup_id");--> statement-breakpoint
CREATE INDEX "return_pickup_events_trip_idx" ON "logistics"."return_pickup_events" USING btree ("trip_id");--> statement-breakpoint
CREATE UNIQUE INDEX "return_pickups_one_open" ON "logistics"."return_pickups" USING btree ("customer_id") WHERE "logistics"."return_pickups"."status" in ('WAITING', 'ON_TRIP');--> statement-breakpoint
CREATE INDEX "return_pickups_status_idx" ON "logistics"."return_pickups" USING btree ("status");--> statement-breakpoint
CREATE INDEX "return_pickups_trip_idx" ON "logistics"."return_pickups" USING btree ("trip_id");--> statement-breakpoint
ALTER TABLE "logistics"."visit_reports" ADD CONSTRAINT "visit_reports_return_pickup_id_return_pickups_id_fk" FOREIGN KEY ("return_pickup_id") REFERENCES "logistics"."return_pickups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "visit_reports_return_pickup_idx" ON "logistics"."visit_reports" USING btree ("return_pickup_id");--> statement-breakpoint
ALTER TABLE "logistics"."report_decisions" ADD CONSTRAINT "report_decisions_cut" CHECK (("logistics"."report_decisions"."decision" = 'CUT') = ("logistics"."report_decisions"."amount" is not null and "logistics"."report_decisions"."reason" is not null)
      and ("logistics"."report_decisions"."amount" is null or "logistics"."report_decisions"."amount" > 0)
      and ("logistics"."report_decisions"."reason" is null or "logistics"."report_decisions"."reason" in ('WRONG_ITEM', 'SHORT', 'DAMAGED', 'PRICE', 'REJECTED', 'OTHER'))
      and ("logistics"."report_decisions"."decision" <> 'CUT' or "logistics"."report_decisions"."note_id" is not null or "logistics"."report_decisions"."transaction_id" is not null)
      and ("logistics"."report_decisions"."note_id" is null or "logistics"."report_decisions"."transaction_id" is null)
      and ("logistics"."report_decisions"."decision" <> 'NO_CUT' or "logistics"."report_decisions"."note" is not null));--> statement-breakpoint
ALTER TABLE "logistics"."visit_reports" ADD CONSTRAINT "visit_reports_source" CHECK (("logistics"."visit_reports"."visit_id" is not null and "logistics"."visit_reports"."trip_id" is not null and "logistics"."visit_reports"."customer_id" is not null and "logistics"."visit_reports"."self_stop_id" is null and "logistics"."visit_reports"."self_trip_id" is null and "logistics"."visit_reports"."return_pickup_id" is null)
      or ("logistics"."visit_reports"."visit_id" is null and "logistics"."visit_reports"."trip_id" is null and "logistics"."visit_reports"."self_stop_id" is not null and "logistics"."visit_reports"."self_trip_id" is not null and "logistics"."visit_reports"."return_pickup_id" is null)
      or ("logistics"."visit_reports"."visit_id" is null and "logistics"."visit_reports"."trip_id" is not null and "logistics"."visit_reports"."customer_id" is not null and "logistics"."visit_reports"."self_stop_id" is null and "logistics"."visit_reports"."self_trip_id" is null
        and "logistics"."visit_reports"."return_pickup_id" is not null and "logistics"."visit_reports"."kind" = 'RETURN'));--> statement-breakpoint
CREATE TRIGGER return_pickups_no_delete BEFORE DELETE ON logistics.return_pickups FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
--> statement-breakpoint
CREATE TRIGGER return_pickup_events_no_delete BEFORE DELETE ON logistics.return_pickup_events FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
