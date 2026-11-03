CREATE TABLE "logistics"."trip_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"vehicle_id" integer NOT NULL,
	"route_id" integer NOT NULL,
	"effective_from" date NOT NULL,
	"driver_with_assistant" integer NOT NULL,
	"driver_alone" integer NOT NULL,
	"assistant" integer NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"fixes_id" integer,
	"reason" text,
	"created_by_account_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_by_account_id" integer,
	"ended_at" timestamp with time zone,
	"end_reason" text,
	CONSTRAINT "trip_rates_status" CHECK ("logistics"."trip_rates"."status" in ('ACTIVE', 'CANCELLED', 'FIXED')),
	CONSTRAINT "trip_rates_amounts" CHECK ("logistics"."trip_rates"."driver_with_assistant" >= 0 and "logistics"."trip_rates"."driver_alone" >= 0 and "logistics"."trip_rates"."assistant" >= 0),
	CONSTRAINT "trip_rates_fix_reason" CHECK (("logistics"."trip_rates"."fixes_id" is null) = ("logistics"."trip_rates"."reason" is null)),
	CONSTRAINT "trip_rates_ended" CHECK (("logistics"."trip_rates"."status" = 'ACTIVE') = ("logistics"."trip_rates"."ended_at" is null))
);
--> statement-breakpoint
ALTER TABLE "logistics"."trip_rates" ADD CONSTRAINT "trip_rates_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "logistics"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."trip_rates" ADD CONSTRAINT "trip_rates_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "logistics"."routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trip_rates_active_unique" ON "logistics"."trip_rates" USING btree ("vehicle_id","route_id","effective_from") WHERE "logistics"."trip_rates"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "trip_rates_pair_idx" ON "logistics"."trip_rates" USING btree ("vehicle_id","route_id");--> statement-breakpoint
CREATE TRIGGER trip_rates_no_delete BEFORE DELETE ON logistics.trip_rates FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
--> statement-breakpoint
-- Tarif awal dari owner 2026-11-03 (spec L7 §0, §9 butir 2-4): 25 pasangan, berlaku 30 Okt 2026 (Jumat minggu upah
-- pertama sesudah L6 tayang). L300 dan Grand Max ke Cirebon tidak bertarif. Aina PS dan H. Agus: rute terpisah, angka sama.
INSERT INTO logistics.trip_rates (vehicle_id, route_id, effective_from, driver_with_assistant, assistant, driver_alone)
SELECT v.id, r.id, DATE '2026-10-30', x.dw, x.a, x.d
FROM (VALUES
  ('Tasik Kota', 'Engkel Box', 110000, 50000, 160000), ('Tasik Kota', 'L300', 90000, 40000, 130000), ('Tasik Kota', 'Grand Max Box', 80000, 30000, 110000),
  ('Garut', 'Engkel Box', 135000, 50000, 185000), ('Garut', 'L300', 110000, 40000, 150000), ('Garut', 'Grand Max Box', 90000, 30000, 120000),
  ('Karang Nunggal', 'Engkel Box', 135000, 50000, 185000), ('Karang Nunggal', 'L300', 110000, 40000, 150000), ('Karang Nunggal', 'Grand Max Box', 90000, 30000, 120000),
  ('Ciamis - Banjar', 'Engkel Box', 135000, 50000, 185000), ('Ciamis - Banjar', 'L300', 110000, 40000, 150000), ('Ciamis - Banjar', 'Grand Max Box', 90000, 30000, 120000),
  ('Cirebon', 'Engkel Box', 175000, 50000, 225000),
  ('Singaparna', 'Engkel Box', 20000, 0, 20000), ('Singaparna', 'L300', 15000, 0, 15000), ('Singaparna', 'Grand Max Box', 15000, 0, 15000),
  ('Aina PS', 'Engkel Box', 20000, 0, 20000), ('Aina PS', 'L300', 15000, 0, 15000), ('Aina PS', 'Grand Max Box', 15000, 0, 15000),
  ('H. Agus', 'Engkel Box', 20000, 0, 20000), ('H. Agus', 'L300', 15000, 0, 15000), ('H. Agus', 'Grand Max Box', 15000, 0, 15000),
  ('Rajawali / Wiji Dadi', 'Engkel Box', 10000, 0, 10000), ('Rajawali / Wiji Dadi', 'L300', 10000, 0, 10000), ('Rajawali / Wiji Dadi', 'Grand Max Box', 10000, 0, 10000)
) AS x(route_name, vehicle_name, dw, a, d)
JOIN logistics.routes r ON lower(r.name) = lower(x.route_name)
JOIN logistics.vehicles v ON lower(v.name) = lower(x.vehicle_name)
ON CONFLICT DO NOTHING;
