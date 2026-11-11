-- F2-5b Sewa Mobil per Ritase (spec docs/work/specs/2026-11-11-f2-5-biaya-rutin-sewa-mobil-design.md §3.4).
-- Semua mobil lama = Milik sendiri. Hak `logistics.vehicle_rental.*` ada di aliran hris 0057.
CREATE TABLE "logistics"."vehicle_rental_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"vehicle_id" integer NOT NULL,
	"for_month" date NOT NULL,
	"kind" text NOT NULL,
	"trip_count" integer NOT NULL,
	"billed_amount" integer NOT NULL,
	"amount" integer NOT NULL,
	"difference_reason" text,
	"money_place_id" integer NOT NULL,
	"occurred_on" date NOT NULL,
	"proof_file_id" uuid,
	"paid_by_account_id" integer NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_account_id" integer,
	"cancel_reason" text,
	CONSTRAINT "vehicle_rental_payments_kind" CHECK ("logistics"."vehicle_rental_payments"."kind" in ('PAYMENT', 'TOP_UP')),
	CONSTRAINT "vehicle_rental_payments_month" CHECK (extract(day from "logistics"."vehicle_rental_payments"."for_month") = 1),
	CONSTRAINT "vehicle_rental_payments_amount" CHECK ("logistics"."vehicle_rental_payments"."amount" > 0 and "logistics"."vehicle_rental_payments"."trip_count" >= 0 and "logistics"."vehicle_rental_payments"."billed_amount" >= 0),
	CONSTRAINT "vehicle_rental_payments_cancel" CHECK (("logistics"."vehicle_rental_payments"."cancelled_at" is null) = ("logistics"."vehicle_rental_payments"."cancel_reason" is null))
);
--> statement-breakpoint
CREATE TABLE "logistics"."vehicle_rental_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"vehicle_id" integer NOT NULL,
	"effective_from" date NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"fixes_id" integer,
	"reason" text,
	"created_by_account_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_by_account_id" integer,
	"ended_at" timestamp with time zone,
	"end_reason" text,
	CONSTRAINT "vehicle_rental_rates_status" CHECK ("logistics"."vehicle_rental_rates"."status" in ('ACTIVE', 'CANCELLED', 'FIXED')),
	CONSTRAINT "vehicle_rental_rates_amount" CHECK ("logistics"."vehicle_rental_rates"."amount" >= 0),
	CONSTRAINT "vehicle_rental_rates_fix_reason" CHECK (("logistics"."vehicle_rental_rates"."fixes_id" is null) = ("logistics"."vehicle_rental_rates"."reason" is null)),
	CONSTRAINT "vehicle_rental_rates_ended" CHECK (("logistics"."vehicle_rental_rates"."status" = 'ACTIVE') = ("logistics"."vehicle_rental_rates"."ended_at" is null))
);
--> statement-breakpoint
ALTER TABLE "logistics"."vehicles" ADD COLUMN "ownership" text DEFAULT 'OWNED' NOT NULL;--> statement-breakpoint
ALTER TABLE "logistics"."vehicles" ADD COLUMN "rental_owner_name" text;--> statement-breakpoint
ALTER TABLE "logistics"."vehicles" ADD COLUMN "rental_owner_note" text;--> statement-breakpoint
ALTER TABLE "logistics"."vehicle_rental_payments" ADD CONSTRAINT "vehicle_rental_payments_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "logistics"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."vehicle_rental_rates" ADD CONSTRAINT "vehicle_rental_rates_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "logistics"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_rental_payments_one_payment" ON "logistics"."vehicle_rental_payments" USING btree ("vehicle_id","for_month") WHERE "logistics"."vehicle_rental_payments"."kind" = 'PAYMENT' and "logistics"."vehicle_rental_payments"."cancelled_at" is null;--> statement-breakpoint
CREATE INDEX "vehicle_rental_payments_month_idx" ON "logistics"."vehicle_rental_payments" USING btree ("for_month");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_rental_rates_active_unique" ON "logistics"."vehicle_rental_rates" USING btree ("vehicle_id","effective_from") WHERE "logistics"."vehicle_rental_rates"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "vehicle_rental_rates_vehicle_idx" ON "logistics"."vehicle_rental_rates" USING btree ("vehicle_id");--> statement-breakpoint
ALTER TABLE "logistics"."vehicles" ADD CONSTRAINT "vehicles_ownership" CHECK ("logistics"."vehicles"."ownership" in ('OWNED', 'RENTED'));--> statement-breakpoint
ALTER TABLE "logistics"."vehicles" ADD CONSTRAINT "vehicles_rental_owner" CHECK ("logistics"."vehicles"."ownership" <> 'RENTED' or "logistics"."vehicles"."rental_owner_name" is not null);--> statement-breakpoint
CREATE TRIGGER vehicle_rental_rates_no_delete BEFORE DELETE ON logistics.vehicle_rental_rates FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
--> statement-breakpoint
CREATE TRIGGER vehicle_rental_payments_no_delete BEFORE DELETE ON logistics.vehicle_rental_payments FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
