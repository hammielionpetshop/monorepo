CREATE TABLE "logistics"."self_trip_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"trip_id" integer NOT NULL,
	"stop_id" integer,
	"kind" text NOT NULL,
	"reason" text,
	"from_employee_id" integer,
	"to_employee_id" integer,
	"by_employee_id" integer NOT NULL,
	"by_account_id" integer NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "self_trip_events_kind" CHECK ("logistics"."self_trip_events"."kind" in ('CLOSED', 'HANDOVER', 'RESENT', 'DROPPED')),
	CONSTRAINT "self_trip_events_handover" CHECK (("logistics"."self_trip_events"."kind" = 'HANDOVER') = ("logistics"."self_trip_events"."to_employee_id" is not null and "logistics"."self_trip_events"."from_employee_id" is not null)),
	CONSTRAINT "self_trip_events_stop" CHECK (("logistics"."self_trip_events"."kind" in ('RESENT', 'DROPPED')) = ("logistics"."self_trip_events"."stop_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "logistics"."self_trip_stops" DROP CONSTRAINT "self_trip_stops_done";--> statement-breakpoint
ALTER TABLE "logistics"."self_trips" DROP CONSTRAINT "self_trips_status";--> statement-breakpoint
ALTER TABLE "logistics"."self_trips" DROP CONSTRAINT "self_trips_cash";--> statement-breakpoint
DROP INDEX "logistics"."self_trip_stops_live";--> statement-breakpoint
ALTER TABLE "logistics"."self_trip_stops" ADD COLUMN "office_closed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "logistics"."self_trip_stops" ADD COLUMN "decision" text;--> statement-breakpoint
ALTER TABLE "logistics"."self_trip_stops" ADD COLUMN "decision_reason" text;--> statement-breakpoint
ALTER TABLE "logistics"."self_trip_stops" ADD COLUMN "decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "logistics"."self_trip_stops" ADD COLUMN "decided_by_account_id" integer;--> statement-breakpoint
ALTER TABLE "logistics"."self_trips" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "logistics"."self_trips" ADD COLUMN "closed_by_employee_id" integer;--> statement-breakpoint
ALTER TABLE "logistics"."self_trips" ADD COLUMN "closed_by_account_id" integer;--> statement-breakpoint
ALTER TABLE "logistics"."self_trips" ADD COLUMN "close_reason" text;--> statement-breakpoint
ALTER TABLE "logistics"."self_trip_events" ADD CONSTRAINT "self_trip_events_trip_id_self_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "logistics"."self_trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."self_trip_events" ADD CONSTRAINT "self_trip_events_stop_id_self_trip_stops_id_fk" FOREIGN KEY ("stop_id") REFERENCES "logistics"."self_trip_stops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "self_trip_events_trip_idx" ON "logistics"."self_trip_events" USING btree ("trip_id");--> statement-breakpoint
CREATE UNIQUE INDEX "self_trip_stops_live" ON "logistics"."self_trip_stops" USING btree ("transaction_id") WHERE "logistics"."self_trip_stops"."status" in ('OPEN', 'DELIVERED') or ("logistics"."self_trip_stops"."status" = 'FAILED' and "logistics"."self_trip_stops"."decision" is distinct from 'RESEND');--> statement-breakpoint
ALTER TABLE "logistics"."self_trip_stops" ADD CONSTRAINT "self_trip_stops_office" CHECK (not "logistics"."self_trip_stops"."office_closed" or ("logistics"."self_trip_stops"."status" = 'TOMORROW' and "logistics"."self_trip_stops"."photo_file_id" is null));--> statement-breakpoint
ALTER TABLE "logistics"."self_trip_stops" ADD CONSTRAINT "self_trip_stops_decision" CHECK (("logistics"."self_trip_stops"."decision" is null or ("logistics"."self_trip_stops"."decision" in ('RESEND', 'DROP') and "logistics"."self_trip_stops"."status" = 'FAILED'))
      and ("logistics"."self_trip_stops"."decision" is null) = ("logistics"."self_trip_stops"."decided_at" is null) and ("logistics"."self_trip_stops"."decision" is null) = ("logistics"."self_trip_stops"."decided_by_account_id" is null)
      and ("logistics"."self_trip_stops"."decision" is distinct from 'DROP' or "logistics"."self_trip_stops"."decision_reason" is not null));--> statement-breakpoint
ALTER TABLE "logistics"."self_trip_stops" ADD CONSTRAINT "self_trip_stops_done" CHECK (("logistics"."self_trip_stops"."status" = 'OPEN') = ("logistics"."self_trip_stops"."done_at" is null) and ("logistics"."self_trip_stops"."status" <> 'OPEN' or "logistics"."self_trip_stops"."photo_file_id" is null)
      and ("logistics"."self_trip_stops"."status" = 'OPEN' or "logistics"."self_trip_stops"."photo_file_id" is not null or "logistics"."self_trip_stops"."office_closed"));--> statement-breakpoint
ALTER TABLE "logistics"."self_trips" ADD CONSTRAINT "self_trips_closed" CHECK (("logistics"."self_trips"."status" = 'CLOSED') = ("logistics"."self_trips"."closed_at" is not null and "logistics"."self_trips"."closed_by_account_id" is not null and "logistics"."self_trips"."close_reason" is not null));--> statement-breakpoint
ALTER TABLE "logistics"."self_trips" ADD CONSTRAINT "self_trips_status" CHECK ("logistics"."self_trips"."status" in ('RUNNING', 'DONE', 'CLOSED'));--> statement-breakpoint
ALTER TABLE "logistics"."self_trips" ADD CONSTRAINT "self_trips_cash" CHECK ("logistics"."self_trips"."cash_amount" >= 0 and ("logistics"."self_trips"."cash_amount" = 0 or "logistics"."self_trips"."status" in ('DONE', 'CLOSED')));--> statement-breakpoint
CREATE TRIGGER self_trip_events_no_delete BEFORE DELETE ON logistics.self_trip_events FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
