CREATE TABLE "logistics"."fuel_fills" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer,
	"vehicle_id" integer NOT NULL,
	"driver_employee_id" integer NOT NULL,
	"filled_on" date NOT NULL,
	"amount" integer NOT NULL,
	"receipt_file_id" uuid NOT NULL,
	"no_request_reason" text,
	"charge_branch_id" integer,
	"correction_of_id" integer,
	"correction_reason" text,
	"recorded_by_account_id" integer NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"replaced_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"voided_by_account_id" integer,
	"void_reason" text,
	CONSTRAINT "fuel_fills_amount" CHECK ("logistics"."fuel_fills"."amount" > 0),
	CONSTRAINT "fuel_fills_request" CHECK (("logistics"."fuel_fills"."request_id" is null) = ("logistics"."fuel_fills"."no_request_reason" is not null)),
	CONSTRAINT "fuel_fills_correction" CHECK (("logistics"."fuel_fills"."correction_of_id" is null) = ("logistics"."fuel_fills"."correction_reason" is null)),
	CONSTRAINT "fuel_fills_voided" CHECK (("logistics"."fuel_fills"."voided_at" is null) = ("logistics"."fuel_fills"."voided_by_account_id" is null) and ("logistics"."fuel_fills"."voided_at" is null) = ("logistics"."fuel_fills"."void_reason" is null)
      and ("logistics"."fuel_fills"."voided_at" is null or "logistics"."fuel_fills"."replaced_at" is null))
);
--> statement-breakpoint
CREATE TABLE "logistics"."outside_point_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"visit_id" integer,
	"self_stop_id" integer,
	"verdict" text NOT NULL,
	"reason" text,
	"reviewed_by_account_id" integer NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outside_point_reviews_target" CHECK (("logistics"."outside_point_reviews"."visit_id" is null) <> ("logistics"."outside_point_reviews"."self_stop_id" is null)),
	CONSTRAINT "outside_point_reviews_verdict" CHECK ("logistics"."outside_point_reviews"."verdict" in ('OK', 'NOT_OK') and ("logistics"."outside_point_reviews"."verdict" = 'OK' or "logistics"."outside_point_reviews"."reason" is not null))
);
--> statement-breakpoint
ALTER TABLE "logistics"."fuel_fills" ADD CONSTRAINT "fuel_fills_request_id_trip_end_reports_id_fk" FOREIGN KEY ("request_id") REFERENCES "logistics"."trip_end_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."fuel_fills" ADD CONSTRAINT "fuel_fills_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "logistics"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."outside_point_reviews" ADD CONSTRAINT "outside_point_reviews_visit_id_trip_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "logistics"."trip_visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."outside_point_reviews" ADD CONSTRAINT "outside_point_reviews_self_stop_id_self_trip_stops_id_fk" FOREIGN KEY ("self_stop_id") REFERENCES "logistics"."self_trip_stops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fuel_fills_request_current" ON "logistics"."fuel_fills" USING btree ("request_id") WHERE "logistics"."fuel_fills"."request_id" is not null and "logistics"."fuel_fills"."replaced_at" is null and "logistics"."fuel_fills"."voided_at" is null;--> statement-breakpoint
CREATE INDEX "fuel_fills_filled_on_idx" ON "logistics"."fuel_fills" USING btree ("filled_on");--> statement-breakpoint
CREATE INDEX "fuel_fills_vehicle_idx" ON "logistics"."fuel_fills" USING btree ("vehicle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "outside_point_reviews_visit" ON "logistics"."outside_point_reviews" USING btree ("visit_id") WHERE "logistics"."outside_point_reviews"."visit_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "outside_point_reviews_self_stop" ON "logistics"."outside_point_reviews" USING btree ("self_stop_id") WHERE "logistics"."outside_point_reviews"."self_stop_id" is not null;--> statement-breakpoint
CREATE TRIGGER fuel_fills_no_delete BEFORE DELETE ON logistics.fuel_fills FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
--> statement-breakpoint
CREATE TRIGGER outside_point_reviews_no_delete BEFORE DELETE ON logistics.outside_point_reviews FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
--> statement-breakpoint
-- Pintu baca sumber uang keluar bensin untuk modul Keuangan (spec LT1 §17.1 butir 5): hanya baris yang berlaku.
-- Kolom view = kontrak; ubah dengan migrasi baru, jangan dihapus/diganti nama. View ber-JOIN, jadi tidak bisa ditulis.
CREATE VIEW logistics.fuel_expenses AS
  SELECT f.id, f.filled_on, f.vehicle_id, v.name AS vehicle_name, v.plate AS vehicle_plate, f.driver_employee_id, f.amount,
    f.receipt_file_id, f.charge_branch_id, (f.request_id IS NOT NULL) AS with_request, f.request_id, f.no_request_reason,
    f.correction_of_id, f.recorded_by_account_id, f.recorded_at
  FROM logistics.fuel_fills f JOIN logistics.vehicles v ON v.id = f.vehicle_id
  WHERE f.replaced_at IS NULL AND f.voided_at IS NULL;
