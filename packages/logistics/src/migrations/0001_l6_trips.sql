CREATE TABLE "logistics"."config" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"garage_branch_id" integer,
	"updated_by_account_id" integer,
	"updated_at" timestamp with time zone,
	CONSTRAINT "config_single_row" CHECK ("logistics"."config"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "logistics"."fence_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"reason" text NOT NULL,
	"from_at" timestamp with time zone DEFAULT now() NOT NULL,
	"until_at" timestamp with time zone NOT NULL,
	"by_account_id" integer NOT NULL,
	"ended_at" timestamp with time zone,
	"ended_by_account_id" integer,
	CONSTRAINT "fence_overrides_max_24h" CHECK ("logistics"."fence_overrides"."until_at" > "logistics"."fence_overrides"."from_at" and "logistics"."fence_overrides"."until_at" <= "logistics"."fence_overrides"."from_at" + interval '24 hours'),
	CONSTRAINT "fence_overrides_reason" CHECK (btrim("logistics"."fence_overrides"."reason") <> '')
);
--> statement-breakpoint
CREATE TABLE "logistics"."photo_purges" (
	"file_id" uuid PRIMARY KEY NOT NULL,
	"purged_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "logistics"."photo_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"trip_id" integer NOT NULL,
	"file_id" uuid NOT NULL,
	"viewed_by_account_id" integer NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "logistics"."routes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by_account_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_account_id" integer,
	"updated_at" timestamp with time zone,
	CONSTRAINT "routes_kind" CHECK ("logistics"."routes"."kind" in ('DELIVERY', 'SHOPPING')),
	CONSTRAINT "routes_name_not_blank" CHECK (btrim("logistics"."routes"."name") <> '')
);
--> statement-breakpoint
CREATE TABLE "logistics"."trip_crew" (
	"id" serial PRIMARY KEY NOT NULL,
	"trip_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"role" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"added_by_account_id" integer NOT NULL,
	"added_after_departure" boolean DEFAULT false NOT NULL,
	"removed_at" timestamp with time zone,
	"removed_by_account_id" integer,
	"remove_reason" text,
	CONSTRAINT "trip_crew_role" CHECK ("logistics"."trip_crew"."role" in ('DRIVER', 'ASSISTANT')),
	CONSTRAINT "trip_crew_removed" CHECK (("logistics"."trip_crew"."removed_at" is null) = ("logistics"."trip_crew"."removed_by_account_id" is null))
);
--> statement-breakpoint
CREATE TABLE "logistics"."trip_shopping" (
	"id" serial PRIMARY KEY NOT NULL,
	"trip_id" integer NOT NULL,
	"route_id" integer NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"receipt_photo_file_id" uuid,
	"done_at" timestamp with time zone,
	"done_by_employee_id" integer,
	"drop_reason" text,
	"dropped_by_account_id" integer,
	"dropped_at" timestamp with time zone,
	"added_by_account_id" integer NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_shopping_status" CHECK ("logistics"."trip_shopping"."status" in ('OPEN', 'DONE', 'DROPPED')),
	CONSTRAINT "trip_shopping_done" CHECK (("logistics"."trip_shopping"."status" = 'DONE') = ("logistics"."trip_shopping"."done_at" is not null and "logistics"."trip_shopping"."receipt_photo_file_id" is not null)),
	CONSTRAINT "trip_shopping_dropped" CHECK (("logistics"."trip_shopping"."status" = 'DROPPED') = ("logistics"."trip_shopping"."dropped_at" is not null and "logistics"."trip_shopping"."drop_reason" is not null))
);
--> statement-breakpoint
CREATE TABLE "logistics"."trip_wages" (
	"id" serial PRIMARY KEY NOT NULL,
	"trip_id" integer,
	"employee_id" integer NOT NULL,
	"role" text NOT NULL,
	"kind" text NOT NULL,
	"shopping_id" integer,
	"trip_date" date NOT NULL,
	"vehicle_id" integer NOT NULL,
	"route_id" integer NOT NULL,
	"with_assistant" boolean NOT NULL,
	"origin" text DEFAULT 'AUTO' NOT NULL,
	"manual_reason" text,
	"confirmed_twice" boolean DEFAULT false NOT NULL,
	"created_by_account_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_account_id" integer,
	"cancel_reason" text,
	CONSTRAINT "trip_wages_role" CHECK ("logistics"."trip_wages"."role" in ('DRIVER', 'ASSISTANT')),
	CONSTRAINT "trip_wages_kind" CHECK ("logistics"."trip_wages"."kind" in ('RITASE', 'SHOPPING')),
	CONSTRAINT "trip_wages_origin" CHECK ("logistics"."trip_wages"."origin" in ('AUTO', 'MANUAL')),
	CONSTRAINT "trip_wages_auto_has_trip" CHECK (("logistics"."trip_wages"."origin" = 'AUTO') = ("logistics"."trip_wages"."trip_id" is not null)),
	CONSTRAINT "trip_wages_manual_reason" CHECK (("logistics"."trip_wages"."origin" = 'MANUAL') = ("logistics"."trip_wages"."manual_reason" is not null)),
	CONSTRAINT "trip_wages_shopping" CHECK ("logistics"."trip_wages"."kind" <> 'SHOPPING' or "logistics"."trip_wages"."origin" = 'MANUAL' or "logistics"."trip_wages"."shopping_id" is not null),
	CONSTRAINT "trip_wages_cancel" CHECK (("logistics"."trip_wages"."cancelled_at" is null) = ("logistics"."trip_wages"."cancel_reason" is null))
);
--> statement-breakpoint
CREATE TABLE "logistics"."trips" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"vehicle_id" integer NOT NULL,
	"route_id" integer,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"trip_date" date,
	"departed_at" timestamp with time zone,
	"departed_by_employee_id" integer,
	"crew_photo_file_id" uuid,
	"depart_latitude" double precision,
	"depart_longitude" double precision,
	"depart_accuracy_m" integer,
	"finished_at" timestamp with time zone,
	"arrived_by_employee_id" integer,
	"arrive_latitude" double precision,
	"arrive_longitude" double precision,
	"arrive_accuracy_m" integer,
	"arrive_distance_m" integer,
	"fence_off" boolean DEFAULT false NOT NULL,
	"office_closed_by_account_id" integer,
	"office_close_reason" text,
	"office_close_photo_file_id" uuid,
	"cancelled_by_account_id" integer,
	"cancel_reason" text,
	"cancelled_at" timestamp with time zone,
	"hanging_notified_at" timestamp with time zone,
	"created_by_account_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "trips_status" CHECK ("logistics"."trips"."status" in ('DRAFT', 'RUNNING', 'DONE', 'CANCELLED')),
	CONSTRAINT "trips_departed" CHECK (("logistics"."trips"."status" in ('RUNNING', 'DONE')) = ("logistics"."trips"."departed_at" is not null and "logistics"."trips"."trip_date" is not null and "logistics"."trips"."crew_photo_file_id" is not null)),
	CONSTRAINT "trips_finished" CHECK (("logistics"."trips"."status" = 'DONE') = ("logistics"."trips"."finished_at" is not null)),
	CONSTRAINT "trips_cancelled" CHECK (("logistics"."trips"."status" = 'CANCELLED') = ("logistics"."trips"."cancelled_at" is not null and "logistics"."trips"."cancel_reason" is not null)),
	CONSTRAINT "trips_office_close" CHECK (("logistics"."trips"."office_closed_by_account_id" is null) = ("logistics"."trips"."office_close_reason" is null))
);
--> statement-breakpoint
CREATE TABLE "logistics"."vehicles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"plate" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by_account_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_account_id" integer,
	"updated_at" timestamp with time zone,
	CONSTRAINT "vehicles_name_not_blank" CHECK (btrim("logistics"."vehicles"."name") <> ''),
	CONSTRAINT "vehicles_plate_not_blank" CHECK (btrim("logistics"."vehicles"."plate") <> '')
);
--> statement-breakpoint
ALTER TABLE "logistics"."photo_views" ADD CONSTRAINT "photo_views_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "logistics"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."trip_crew" ADD CONSTRAINT "trip_crew_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "logistics"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."trip_shopping" ADD CONSTRAINT "trip_shopping_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "logistics"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."trip_shopping" ADD CONSTRAINT "trip_shopping_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "logistics"."routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."trip_wages" ADD CONSTRAINT "trip_wages_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "logistics"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."trip_wages" ADD CONSTRAINT "trip_wages_shopping_id_trip_shopping_id_fk" FOREIGN KEY ("shopping_id") REFERENCES "logistics"."trip_shopping"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."trip_wages" ADD CONSTRAINT "trip_wages_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "logistics"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."trip_wages" ADD CONSTRAINT "trip_wages_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "logistics"."routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."trips" ADD CONSTRAINT "trips_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "logistics"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."trips" ADD CONSTRAINT "trips_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "logistics"."routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "photo_views_trip_idx" ON "logistics"."photo_views" USING btree ("trip_id");--> statement-breakpoint
CREATE UNIQUE INDEX "routes_name_unique" ON "logistics"."routes" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "trip_crew_person_unique" ON "logistics"."trip_crew" USING btree ("trip_id","employee_id") WHERE "logistics"."trip_crew"."removed_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "trip_crew_one_driver" ON "logistics"."trip_crew" USING btree ("trip_id") WHERE "logistics"."trip_crew"."role" = 'DRIVER' and "logistics"."trip_crew"."removed_at" is null;--> statement-breakpoint
CREATE INDEX "trip_crew_employee_idx" ON "logistics"."trip_crew" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_shopping_route_unique" ON "logistics"."trip_shopping" USING btree ("trip_id","route_id") WHERE "logistics"."trip_shopping"."status" <> 'DROPPED';--> statement-breakpoint
CREATE UNIQUE INDEX "trip_wages_once" ON "logistics"."trip_wages" USING btree ("trip_id","employee_id","kind",coalesce("shopping_id", 0)) WHERE "logistics"."trip_wages"."trip_id" is not null and "logistics"."trip_wages"."cancelled_at" is null;--> statement-breakpoint
CREATE INDEX "trip_wages_person_date_idx" ON "logistics"."trip_wages" USING btree ("employee_id","trip_date");--> statement-breakpoint
CREATE INDEX "trip_wages_date_idx" ON "logistics"."trip_wages" USING btree ("trip_date");--> statement-breakpoint
CREATE UNIQUE INDEX "trips_number_unique" ON "logistics"."trips" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "trips_one_running_per_vehicle" ON "logistics"."trips" USING btree ("vehicle_id") WHERE "logistics"."trips"."status" = 'RUNNING';--> statement-breakpoint
CREATE INDEX "trips_status_idx" ON "logistics"."trips" USING btree ("status");--> statement-breakpoint
CREATE INDEX "trips_date_idx" ON "logistics"."trips" USING btree ("trip_date");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_plate_unique" ON "logistics"."vehicles" USING btree (upper("plate"));--> statement-breakpoint
-- Tidak ada yang dihapus (PRI-02, DRV-15): pembatalan = tanda.
CREATE FUNCTION logistics.forbid_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Data logistik tidak boleh dihapus (%); batalkan dengan tanda.', TG_TABLE_NAME;
END $$;
--> statement-breakpoint
CREATE TRIGGER vehicles_no_delete BEFORE DELETE ON logistics.vehicles FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
--> statement-breakpoint
CREATE TRIGGER routes_no_delete BEFORE DELETE ON logistics.routes FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
--> statement-breakpoint
CREATE TRIGGER trips_no_delete BEFORE DELETE ON logistics.trips FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
--> statement-breakpoint
CREATE TRIGGER trip_crew_no_delete BEFORE DELETE ON logistics.trip_crew FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
--> statement-breakpoint
CREATE TRIGGER trip_shopping_no_delete BEFORE DELETE ON logistics.trip_shopping FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
--> statement-breakpoint
CREATE TRIGGER trip_wages_no_delete BEFORE DELETE ON logistics.trip_wages FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
--> statement-breakpoint
-- Ritase yang sudah tercatat hanya boleh diberi tanda batal (DRV-15); isinya tidak berubah.
CREATE FUNCTION logistics.trip_wages_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Ritase yang sudah dibatalkan tidak bisa diubah.';
  END IF;
  IF (NEW.trip_id, NEW.employee_id, NEW.role, NEW.kind, NEW.shopping_id, NEW.trip_date, NEW.vehicle_id, NEW.route_id, NEW.with_assistant, NEW.origin)
     IS DISTINCT FROM (OLD.trip_id, OLD.employee_id, OLD.role, OLD.kind, OLD.shopping_id, OLD.trip_date, OLD.vehicle_id, OLD.route_id, OLD.with_assistant, OLD.origin) THEN
    RAISE EXCEPTION 'Isi ritase tidak bisa diubah; batalkan lalu catat ritase tangan.';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER trip_wages_guard BEFORE UPDATE ON logistics.trip_wages FOR EACH ROW EXECUTE FUNCTION logistics.trip_wages_guard();
--> statement-breakpoint
-- Kontrak baca HRIS (PRD 08 §2). Kolom view tidak diubah tanpa mengubah tes kontraknya.
CREATE VIEW logistics.v_ritase AS
SELECT w.id, w.employee_id, w.trip_date, w.vehicle_id, v.name AS vehicle_name, v.plate AS vehicle_plate,
       w.route_id, r.name AS route_name, r.kind AS route_kind, w.role, w.with_assistant, w.kind, w.origin,
       w.trip_id, t.number AS trip_number, (w.cancelled_at IS NOT NULL) AS cancelled
FROM logistics.trip_wages w
JOIN logistics.vehicles v ON v.id = w.vehicle_id
JOIN logistics.routes r ON r.id = w.route_id
LEFT JOIN logistics.trips t ON t.id = w.trip_id;
--> statement-breakpoint
-- Absen lewat trip per orang per tanggal trip (KEH-96 s.d. 98, 101, 121, 122): masuk = Berangkat trip pertama
-- (atau jam ditambahkan kantor), pulang = trip terakhir yang sudah Selesai dan orangnya masih awak.
CREATE VIEW logistics.v_absen_trip AS
SELECT c.employee_id, t.trip_date,
       min(CASE WHEN c.added_after_departure THEN c.added_at ELSE t.departed_at END) AS in_at,
       max(t.finished_at) FILTER (WHERE c.removed_at IS NULL) AS out_at,
       count(*) AS trip_count,
       count(*) FILTER (WHERE t.status = 'RUNNING' AND c.removed_at IS NULL) AS running_count,
       bool_or(t.office_closed_by_account_id IS NOT NULL AND c.removed_at IS NULL) AS office_closed,
       bool_or(c.added_after_departure) AS added_by_office,
       bool_or(c.removed_at IS NOT NULL) AS removed_once
FROM logistics.trip_crew c
JOIN logistics.trips t ON t.id = c.trip_id
WHERE t.status IN ('RUNNING', 'DONE')
  AND (c.removed_at IS NULL OR c.removed_at > t.departed_at)
GROUP BY c.employee_id, t.trip_date;
--> statement-breakpoint
-- Isi awal dari owner (2026-11-03): mobil, rute kirim, rute belanja supplier.
INSERT INTO logistics.vehicles (name, plate) VALUES
  ('Engkel Box', 'Z 8829 NO'), ('Grand Max Box', 'D 8209 YR'), ('L300', 'D 8707 FO');
--> statement-breakpoint
INSERT INTO logistics.routes (name, kind) VALUES
  ('Garut', 'DELIVERY'), ('Singaparna', 'DELIVERY'), ('Ciamis - Banjar', 'DELIVERY'), ('Tasik Kota', 'DELIVERY'),
  ('Karang Nunggal', 'DELIVERY'), ('Cirebon', 'DELIVERY'),
  ('Aina PS', 'SHOPPING'), ('H. Agus', 'SHOPPING'), ('Rajawali / Wiji Dadi', 'SHOPPING');
--> statement-breakpoint
INSERT INTO logistics.config (id) VALUES (1);
