CREATE TABLE "logistics"."delivery_note_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"note_id" integer NOT NULL,
	"kind" text NOT NULL,
	"trip_id" integer,
	"reason" text,
	"by_account_id" integer,
	"by_employee_id" integer,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_note_events_kind" CHECK ("logistics"."delivery_note_events"."kind" in ('ON_TRIP', 'RELEASED', 'TRIP_CANCELLED', 'TRIP_CLOSED', 'LOADED', 'NOT_READY', 'DELIVERED', 'TOMORROW', 'FAILED'))
);
--> statement-breakpoint
CREATE TABLE "logistics"."delivery_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"doc_id" integer NOT NULL,
	"number" text NOT NULL,
	"origin_branch_id" integer NOT NULL,
	"customer_id" integer,
	"destination_branch_id" integer,
	"status" text DEFAULT 'WAITING' NOT NULL,
	"tomorrow_count" integer DEFAULT 0 NOT NULL,
	"amount_at_trip" integer,
	"revision_at_trip" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "delivery_notes_kind" CHECK ("logistics"."delivery_notes"."kind" in ('SALE', 'TRANSFER')),
	CONSTRAINT "delivery_notes_status" CHECK ("logistics"."delivery_notes"."status" in ('WAITING', 'ON_TRIP', 'DELIVERED', 'NEEDS_DECISION', 'CANCELLED')),
	CONSTRAINT "delivery_notes_destination" CHECK (("logistics"."delivery_notes"."kind" = 'SALE') = ("logistics"."delivery_notes"."customer_id" is not null) and ("logistics"."delivery_notes"."kind" = 'TRANSFER') = ("logistics"."delivery_notes"."destination_branch_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "logistics"."trip_pickups" (
	"id" serial PRIMARY KEY NOT NULL,
	"trip_id" integer NOT NULL,
	"origin_branch_id" integer NOT NULL,
	"origin_name" text NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"photo_file_id" uuid,
	"done_at" timestamp with time zone,
	"done_by_employee_id" integer,
	"reason" text,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_pickups_status" CHECK ("logistics"."trip_pickups"."status" in ('OPEN', 'DONE', 'NOT_READY', 'DROPPED')),
	CONSTRAINT "trip_pickups_done" CHECK (("logistics"."trip_pickups"."status" = 'DONE') = ("logistics"."trip_pickups"."done_at" is not null and "logistics"."trip_pickups"."photo_file_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "logistics"."trip_visit_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"visit_id" integer NOT NULL,
	"note_id" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"added_by_account_id" integer NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "trip_visit_notes_ended" CHECK ("logistics"."trip_visit_notes"."active" = ("logistics"."trip_visit_notes"."ended_at" is null))
);
--> statement-breakpoint
CREATE TABLE "logistics"."trip_visits" (
	"id" serial PRIMARY KEY NOT NULL,
	"trip_id" integer NOT NULL,
	"customer_id" integer,
	"destination_branch_id" integer,
	"destination_name" text NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"processed_at" timestamp with time zone,
	"processed_by_employee_id" integer,
	"reason" text,
	"photo_file_id" uuid,
	"latitude" double precision,
	"longitude" double precision,
	"accuracy_m" integer,
	"released_by_account_id" integer,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_visits_status" CHECK ("logistics"."trip_visits"."status" in ('OPEN', 'DELIVERED', 'TOMORROW', 'FAILED', 'RELEASED')),
	CONSTRAINT "trip_visits_destination" CHECK (("logistics"."trip_visits"."customer_id" is null) <> ("logistics"."trip_visits"."destination_branch_id" is null)),
	CONSTRAINT "trip_visits_released" CHECK (("logistics"."trip_visits"."status" = 'RELEASED') = ("logistics"."trip_visits"."released_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "logistics"."delivery_note_events" ADD CONSTRAINT "delivery_note_events_note_id_delivery_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "logistics"."delivery_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."delivery_note_events" ADD CONSTRAINT "delivery_note_events_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "logistics"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."trip_pickups" ADD CONSTRAINT "trip_pickups_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "logistics"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."trip_visit_notes" ADD CONSTRAINT "trip_visit_notes_visit_id_trip_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "logistics"."trip_visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."trip_visit_notes" ADD CONSTRAINT "trip_visit_notes_note_id_delivery_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "logistics"."delivery_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."trip_visits" ADD CONSTRAINT "trip_visits_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "logistics"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "delivery_note_events_note_idx" ON "logistics"."delivery_note_events" USING btree ("note_id");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_notes_doc_unique" ON "logistics"."delivery_notes" USING btree ("kind","doc_id");--> statement-breakpoint
CREATE INDEX "delivery_notes_status_idx" ON "logistics"."delivery_notes" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_pickups_origin_unique" ON "logistics"."trip_pickups" USING btree ("trip_id","origin_branch_id") WHERE "logistics"."trip_pickups"."status" in ('OPEN', 'DONE');--> statement-breakpoint
CREATE UNIQUE INDEX "trip_visit_notes_one_open" ON "logistics"."trip_visit_notes" USING btree ("note_id") WHERE "logistics"."trip_visit_notes"."active";--> statement-breakpoint
CREATE INDEX "trip_visit_notes_visit_idx" ON "logistics"."trip_visit_notes" USING btree ("visit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_visits_destination_unique" ON "logistics"."trip_visits" USING btree ("trip_id",coalesce("customer_id", 0),coalesce("destination_branch_id", 0)) WHERE "logistics"."trip_visits"."status" = 'OPEN';--> statement-breakpoint
CREATE INDEX "trip_visits_trip_idx" ON "logistics"."trip_visits" USING btree ("trip_id");--> statement-breakpoint
CREATE TRIGGER delivery_notes_no_delete BEFORE DELETE ON logistics.delivery_notes FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
--> statement-breakpoint
CREATE TRIGGER trip_pickups_no_delete BEFORE DELETE ON logistics.trip_pickups FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
--> statement-breakpoint
CREATE TRIGGER trip_visits_no_delete BEFORE DELETE ON logistics.trip_visits FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
--> statement-breakpoint
CREATE TRIGGER trip_visit_notes_no_delete BEFORE DELETE ON logistics.trip_visit_notes FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
--> statement-breakpoint
CREATE TRIGGER delivery_note_events_no_delete BEFORE DELETE ON logistics.delivery_note_events FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
