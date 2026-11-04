CREATE TABLE "logistics"."trip_end_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"trip_id" integer NOT NULL,
	"vehicle_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"condition" text NOT NULL,
	"condition_note" text,
	"condition_photo_file_id" uuid,
	"needs_fuel" boolean NOT NULL,
	"fuel_estimate" integer,
	"problem_note" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fuel_close_kind" text,
	"fuel_closed_at" timestamp with time zone,
	"fuel_closed_by_account_id" integer,
	"condition_closed_at" timestamp with time zone,
	"condition_closed_by_account_id" integer,
	"condition_close_note" text,
	CONSTRAINT "trip_end_reports_condition" CHECK ("logistics"."trip_end_reports"."condition" in ('GOOD', 'ATTENTION') and ("logistics"."trip_end_reports"."condition" = 'ATTENTION') = ("logistics"."trip_end_reports"."condition_note" is not null)),
	CONSTRAINT "trip_end_reports_fuel" CHECK ("logistics"."trip_end_reports"."needs_fuel" = ("logistics"."trip_end_reports"."fuel_estimate" is not null) and ("logistics"."trip_end_reports"."fuel_estimate" is null or "logistics"."trip_end_reports"."fuel_estimate" > 0)),
	CONSTRAINT "trip_end_reports_fuel_close" CHECK (("logistics"."trip_end_reports"."fuel_closed_at" is null) = ("logistics"."trip_end_reports"."fuel_close_kind" is null) and ("logistics"."trip_end_reports"."fuel_closed_at" is null or "logistics"."trip_end_reports"."needs_fuel")),
	CONSTRAINT "trip_end_reports_condition_close" CHECK ("logistics"."trip_end_reports"."condition_closed_at" is null or "logistics"."trip_end_reports"."condition" = 'ATTENTION')
);
--> statement-breakpoint
ALTER TABLE "logistics"."delivery_note_events" DROP CONSTRAINT "delivery_note_events_kind";--> statement-breakpoint
ALTER TABLE "logistics"."trip_visits" ADD COLUMN "reason_code" text;--> statement-breakpoint
ALTER TABLE "logistics"."trips" ADD COLUMN "ready_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "logistics"."trips" ADD COLUMN "ready_by_account_id" integer;--> statement-breakpoint
ALTER TABLE "logistics"."trips" ADD COLUMN "heading_home_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "logistics"."trips" ADD COLUMN "heading_home_by_employee_id" integer;--> statement-breakpoint
ALTER TABLE "logistics"."trips" ADD COLUMN "empty_bed_photo_file_id" uuid;--> statement-breakpoint
ALTER TABLE "logistics"."trips" ADD COLUMN "early_finish_reason" text;--> statement-breakpoint
ALTER TABLE "logistics"."trips" ADD COLUMN "fuel_gauge_photo_file_id" uuid;--> statement-breakpoint
ALTER TABLE "logistics"."trip_end_reports" ADD CONSTRAINT "trip_end_reports_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "logistics"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."trip_end_reports" ADD CONSTRAINT "trip_end_reports_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "logistics"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trip_end_reports_trip_unique" ON "logistics"."trip_end_reports" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trip_end_reports_vehicle_idx" ON "logistics"."trip_end_reports" USING btree ("vehicle_id");--> statement-breakpoint
ALTER TABLE "logistics"."delivery_note_events" ADD CONSTRAINT "delivery_note_events_kind" CHECK ("logistics"."delivery_note_events"."kind" in ('ON_TRIP', 'RELEASED', 'TRIP_CANCELLED', 'TRIP_CLOSED', 'LOADED', 'NOT_READY', 'DELIVERED', 'TOMORROW', 'FAILED', 'RETRY', 'RESENT', 'DROPPED', 'REOPENED'));--> statement-breakpoint
ALTER TABLE "logistics"."trips" ADD CONSTRAINT "trips_ready" CHECK (("logistics"."trips"."ready_at" is null) = ("logistics"."trips"."ready_by_account_id" is null));--> statement-breakpoint
ALTER TABLE "logistics"."trips" ADD CONSTRAINT "trips_heading_home" CHECK (("logistics"."trips"."heading_home_at" is null) = ("logistics"."trips"."empty_bed_photo_file_id" is null) and ("logistics"."trips"."heading_home_at" is null or "logistics"."trips"."status" in ('RUNNING', 'DONE')));--> statement-breakpoint
CREATE TRIGGER trip_end_reports_no_delete BEFORE DELETE ON logistics.trip_end_reports FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
