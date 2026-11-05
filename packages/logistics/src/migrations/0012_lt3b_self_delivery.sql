CREATE TABLE "logistics"."self_trip_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"stop_id" integer NOT NULL,
	"trip_id" integer NOT NULL,
	"transaction_id" integer NOT NULL,
	"customer_id" integer,
	"method" text NOT NULL,
	"bill_amount" integer NOT NULL,
	"received_amount" integer NOT NULL,
	"proof_photo_file_id" uuid,
	"promise_date" date,
	"recorded_by_employee_id" integer NOT NULL,
	"recorded_by_account_id" integer NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "self_trip_payments_method" CHECK ("logistics"."self_trip_payments"."method" in ('NONE', 'CASH', 'TRANSFER', 'PARTIAL', 'TEMPO')),
	CONSTRAINT "self_trip_payments_amounts" CHECK ("logistics"."self_trip_payments"."bill_amount" >= 0 and "logistics"."self_trip_payments"."received_amount" >= 0 and (
      ("logistics"."self_trip_payments"."method" = 'NONE' and "logistics"."self_trip_payments"."bill_amount" = 0 and "logistics"."self_trip_payments"."received_amount" = 0)
      or ("logistics"."self_trip_payments"."method" in ('CASH', 'TRANSFER') and "logistics"."self_trip_payments"."bill_amount" > 0 and "logistics"."self_trip_payments"."received_amount" = "logistics"."self_trip_payments"."bill_amount")
      or ("logistics"."self_trip_payments"."method" = 'PARTIAL' and "logistics"."self_trip_payments"."received_amount" > 0 and "logistics"."self_trip_payments"."received_amount" < "logistics"."self_trip_payments"."bill_amount")
      or ("logistics"."self_trip_payments"."method" = 'TEMPO' and "logistics"."self_trip_payments"."bill_amount" > 0 and "logistics"."self_trip_payments"."received_amount" = 0))),
	CONSTRAINT "self_trip_payments_customer" CHECK ("logistics"."self_trip_payments"."method" = 'NONE' or "logistics"."self_trip_payments"."customer_id" is not null),
	CONSTRAINT "self_trip_payments_proof" CHECK (("logistics"."self_trip_payments"."method" = 'TRANSFER') = ("logistics"."self_trip_payments"."proof_photo_file_id" is not null)),
	CONSTRAINT "self_trip_payments_promise" CHECK (("logistics"."self_trip_payments"."promise_date" is not null) = ("logistics"."self_trip_payments"."method" in ('PARTIAL', 'TEMPO')))
);
--> statement-breakpoint
CREATE TABLE "logistics"."self_trip_stops" (
	"id" serial PRIMARY KEY NOT NULL,
	"trip_id" integer NOT NULL,
	"transaction_id" integer NOT NULL,
	"trx_number" text NOT NULL,
	"customer_id" integer,
	"destination_name" text NOT NULL,
	"amount_at_start" integer NOT NULL,
	"courier_mismatch" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"reason_code" text,
	"reason_text" text,
	"photo_file_id" uuid,
	"done_at" timestamp with time zone,
	"done_by_employee_id" integer,
	"latitude" double precision,
	"longitude" double precision,
	"accuracy_m" integer,
	"distance_m" integer,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "self_trip_stops_status" CHECK ("logistics"."self_trip_stops"."status" in ('OPEN', 'DELIVERED', 'TOMORROW', 'FAILED')),
	CONSTRAINT "self_trip_stops_done" CHECK (("logistics"."self_trip_stops"."status" = 'OPEN') = ("logistics"."self_trip_stops"."done_at" is null) and ("logistics"."self_trip_stops"."status" = 'OPEN') = ("logistics"."self_trip_stops"."photo_file_id" is null)),
	CONSTRAINT "self_trip_stops_reason" CHECK (("logistics"."self_trip_stops"."status" in ('TOMORROW', 'FAILED')) = ("logistics"."self_trip_stops"."reason_code" is not null and "logistics"."self_trip_stops"."reason_text" is not null))
);
--> statement-breakpoint
CREATE TABLE "logistics"."self_trips" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"branch_id" integer NOT NULL,
	"kasir_branch_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"status" text DEFAULT 'RUNNING' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"pickup_photo_file_id" uuid NOT NULL,
	"start_latitude" double precision,
	"start_longitude" double precision,
	"start_accuracy_m" integer,
	"returned_at" timestamp with time zone,
	"return_photo_file_id" uuid,
	"return_latitude" double precision,
	"return_longitude" double precision,
	"return_accuracy_m" integer,
	"gap_reason" text,
	"gap_minutes" integer,
	"cash_amount" integer DEFAULT 0 NOT NULL,
	"cash_received_at" timestamp with time zone,
	"cash_received_by_employee_id" integer,
	"cash_received_by_account_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "self_trips_status" CHECK ("logistics"."self_trips"."status" in ('RUNNING', 'DONE')),
	CONSTRAINT "self_trips_done" CHECK (("logistics"."self_trips"."status" = 'DONE') = ("logistics"."self_trips"."returned_at" is not null and "logistics"."self_trips"."return_photo_file_id" is not null)),
	CONSTRAINT "self_trips_cash" CHECK ("logistics"."self_trips"."cash_amount" >= 0 and ("logistics"."self_trips"."cash_amount" = 0 or "logistics"."self_trips"."status" = 'DONE')),
	CONSTRAINT "self_trips_cash_received" CHECK (("logistics"."self_trips"."cash_received_at" is null) = ("logistics"."self_trips"."cash_received_by_account_id" is null)
      and ("logistics"."self_trips"."cash_received_at" is null or ("logistics"."self_trips"."cash_amount" > 0 and "logistics"."self_trips"."cash_received_by_employee_id" is distinct from "logistics"."self_trips"."employee_id"))),
	CONSTRAINT "self_trips_gap" CHECK (("logistics"."self_trips"."gap_reason" is null) or "logistics"."self_trips"."status" = 'DONE')
);
--> statement-breakpoint
ALTER TABLE "logistics"."store_points" DROP CONSTRAINT "store_points_source";--> statement-breakpoint
ALTER TABLE "logistics"."store_points" ADD COLUMN "self_stop_id" integer;--> statement-breakpoint
ALTER TABLE "logistics"."self_trip_payments" ADD CONSTRAINT "self_trip_payments_stop_id_self_trip_stops_id_fk" FOREIGN KEY ("stop_id") REFERENCES "logistics"."self_trip_stops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."self_trip_payments" ADD CONSTRAINT "self_trip_payments_trip_id_self_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "logistics"."self_trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."self_trip_stops" ADD CONSTRAINT "self_trip_stops_trip_id_self_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "logistics"."self_trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "self_trip_payments_stop_unique" ON "logistics"."self_trip_payments" USING btree ("stop_id");--> statement-breakpoint
CREATE INDEX "self_trip_payments_trip_idx" ON "logistics"."self_trip_payments" USING btree ("trip_id");--> statement-breakpoint
CREATE UNIQUE INDEX "self_trip_stops_live" ON "logistics"."self_trip_stops" USING btree ("transaction_id") WHERE "logistics"."self_trip_stops"."status" in ('OPEN', 'DELIVERED', 'FAILED');--> statement-breakpoint
CREATE INDEX "self_trip_stops_trip_idx" ON "logistics"."self_trip_stops" USING btree ("trip_id");--> statement-breakpoint
CREATE UNIQUE INDEX "self_trips_number_unique" ON "logistics"."self_trips" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "self_trips_one_running" ON "logistics"."self_trips" USING btree ("employee_id") WHERE "logistics"."self_trips"."status" = 'RUNNING';--> statement-breakpoint
CREATE INDEX "self_trips_branch_idx" ON "logistics"."self_trips" USING btree ("branch_id","started_at");--> statement-breakpoint
ALTER TABLE "logistics"."store_points" ADD CONSTRAINT "store_points_self_stop_id_self_trip_stops_id_fk" FOREIGN KEY ("self_stop_id") REFERENCES "logistics"."self_trip_stops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."store_points" ADD CONSTRAINT "store_points_source" CHECK ("logistics"."store_points"."source" in ('VISIT', 'OFFICE') and ("logistics"."store_points"."source" = 'VISIT') = ("logistics"."store_points"."photo_file_id" is not null and ("logistics"."store_points"."trip_id" is not null or "logistics"."store_points"."self_stop_id" is not null)));--> statement-breakpoint
CREATE TRIGGER self_trips_no_delete BEFORE DELETE ON logistics.self_trips FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
--> statement-breakpoint
CREATE TRIGGER self_trip_stops_no_delete BEFORE DELETE ON logistics.self_trip_stops FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
--> statement-breakpoint
CREATE TRIGGER self_trip_payments_no_delete BEFORE DELETE ON logistics.self_trip_payments FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
--> statement-breakpoint
-- Nota kasir "Diantar kurir cabang" untuk Antar sendiri (spec LT1 §15.2). Kontrak baca seperti pos_branch_sales (0011);
-- stub tes `packages/hris-db/test-stubs/petshop-pos.sql` ikut. Pengantar kasir = service_deliveries.courier_id (groomers).
CREATE VIEW logistics.pos_courier_sales AS
  SELECT t.id, t.trx_number, t.branch_id, b.name AS branch_name, t.customer_id, c.name AS customer_name, c.phone AS customer_phone,
    coalesce(d.address, c.address) AS address, t.payable_amount, t.status, d.courier_id, g.name AS courier_name,
    (t.created_at AT TIME ZONE 'UTC') AS created_at,
    (t.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date AS trx_on
  FROM petshop.transactions t
  JOIN petshop.branches b ON b.id = t.branch_id
  LEFT JOIN petshop.customers c ON c.id = t.customer_id
  LEFT JOIN petshop.service_deliveries d ON d.transaction_id = t.id
  LEFT JOIN petshop.groomers g ON g.id = d.courier_id
  WHERE t.delivery_method = 'BRANCH_COURIER';
--> statement-breakpoint
CREATE TRIGGER pos_courier_sales_read_only INSTEAD OF INSERT OR UPDATE OR DELETE ON logistics.pos_courier_sales
  FOR EACH ROW EXECUTE FUNCTION logistics.reject_pos_view_write();
