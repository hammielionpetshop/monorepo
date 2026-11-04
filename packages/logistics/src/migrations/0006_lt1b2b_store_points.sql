CREATE TABLE "logistics"."store_points" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"status" text NOT NULL,
	"source" text NOT NULL,
	"kind" text NOT NULL,
	"reason" text,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"accuracy_m" integer,
	"photo_file_id" uuid,
	"trip_id" integer,
	"visit_id" integer,
	"proposed_by_employee_id" integer,
	"proposed_by_account_id" integer NOT NULL,
	"proposed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by_account_id" integer,
	"decided_at" timestamp with time zone,
	"reject_reason" text,
	"replaced_at" timestamp with time zone,
	CONSTRAINT "store_points_status" CHECK ("logistics"."store_points"."status" in ('PENDING', 'APPROVED', 'REJECTED', 'REPLACED')),
	CONSTRAINT "store_points_source" CHECK ("logistics"."store_points"."source" in ('VISIT', 'OFFICE') and ("logistics"."store_points"."source" = 'VISIT') = ("logistics"."store_points"."photo_file_id" is not null and "logistics"."store_points"."trip_id" is not null)),
	CONSTRAINT "store_points_kind" CHECK ("logistics"."store_points"."kind" in ('NEW', 'CORRECTION') and ("logistics"."store_points"."kind" = 'NEW' or "logistics"."store_points"."reason" is not null)),
	CONSTRAINT "store_points_decided" CHECK (("logistics"."store_points"."status" = 'PENDING') = ("logistics"."store_points"."decided_at" is null) and ("logistics"."store_points"."status" = 'REJECTED') = ("logistics"."store_points"."reject_reason" is not null)),
	CONSTRAINT "store_points_replaced" CHECK (("logistics"."store_points"."status" = 'REPLACED') = ("logistics"."store_points"."replaced_at" is not null)),
	CONSTRAINT "store_points_coordinates" CHECK (abs("logistics"."store_points"."latitude") <= 90 and abs("logistics"."store_points"."longitude") <= 180 and not ("logistics"."store_points"."latitude" = 0 and "logistics"."store_points"."longitude" = 0))
);
--> statement-breakpoint
ALTER TABLE "logistics"."trip_visits" ADD COLUMN "distance_m" integer;--> statement-breakpoint
ALTER TABLE "logistics"."store_points" ADD CONSTRAINT "store_points_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "logistics"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."store_points" ADD CONSTRAINT "store_points_visit_id_trip_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "logistics"."trip_visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "store_points_one_approved" ON "logistics"."store_points" USING btree ("customer_id") WHERE "logistics"."store_points"."status" = 'APPROVED';--> statement-breakpoint
CREATE UNIQUE INDEX "store_points_one_pending" ON "logistics"."store_points" USING btree ("customer_id") WHERE "logistics"."store_points"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX "store_points_customer_idx" ON "logistics"."store_points" USING btree ("customer_id");--> statement-breakpoint
CREATE TRIGGER store_points_no_delete BEFORE DELETE ON logistics.store_points FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
