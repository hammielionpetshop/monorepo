CREATE TABLE "hris"."trip_wage_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"wage_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"kind" text NOT NULL,
	"wage_date" date NOT NULL,
	"week_start" date NOT NULL,
	"role" text NOT NULL,
	"with_assistant" boolean NOT NULL,
	"vehicle_id" integer NOT NULL,
	"route_id" integer NOT NULL,
	"rate_id" integer,
	"rate_amount" integer,
	"amount" integer NOT NULL,
	"pay_basis" text NOT NULL,
	"day_status" text,
	"zero_reason" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"needs_look" boolean DEFAULT false NOT NULL,
	"looked_at" timestamp with time zone,
	"looked_by_account_id" integer,
	"look_note" text,
	"payslip_id" integer,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"replaced_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_wage_values_kind" CHECK ("hris"."trip_wage_values"."kind" in ('RITASE', 'SHOPPING')),
	CONSTRAINT "trip_wage_values_role" CHECK ("hris"."trip_wage_values"."role" in ('DRIVER', 'ASSISTANT')),
	CONSTRAINT "trip_wage_values_basis" CHECK ("hris"."trip_wage_values"."pay_basis" in ('MONTHLY', 'WEEKLY')),
	CONSTRAINT "trip_wage_values_status" CHECK ("hris"."trip_wage_values"."status" in ('ACTIVE', 'UNRATED', 'CANCELLED')),
	CONSTRAINT "trip_wage_values_zero_reason" CHECK ("hris"."trip_wage_values"."zero_reason" is null or "hris"."trip_wage_values"."zero_reason" in ('WORKDAY', 'NOT_DAY_OFF', 'NO_ASSISTANT_PAY')),
	CONSTRAINT "trip_wage_values_amount" CHECK ("hris"."trip_wage_values"."amount" >= 0 and ("hris"."trip_wage_values"."status" <> 'UNRATED' or "hris"."trip_wage_values"."amount" = 0)),
	CONSTRAINT "trip_wage_values_unrated" CHECK (("hris"."trip_wage_values"."status" <> 'UNRATED' or "hris"."trip_wage_values"."rate_id" is null) and ("hris"."trip_wage_values"."status" <> 'ACTIVE' or "hris"."trip_wage_values"."rate_id" is not null)),
	CONSTRAINT "trip_wage_values_week_friday" CHECK (extract(isodow from "hris"."trip_wage_values"."week_start") = 5),
	CONSTRAINT "trip_wage_values_cancel" CHECK (("hris"."trip_wage_values"."status" = 'CANCELLED') = ("hris"."trip_wage_values"."cancelled_at" is not null and "hris"."trip_wage_values"."cancel_reason" is not null)),
	CONSTRAINT "trip_wage_values_looked" CHECK ("hris"."trip_wage_values"."looked_at" is null or "hris"."trip_wage_values"."needs_look")
);
--> statement-breakpoint
ALTER TABLE "hris"."trip_wage_values" ADD CONSTRAINT "trip_wage_values_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."trip_wage_values" ADD CONSTRAINT "trip_wage_values_payslip_id_payslips_id_fk" FOREIGN KEY ("payslip_id") REFERENCES "hris"."payslips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."trip_wage_values" ADD CONSTRAINT "trip_wage_values_replaced_by_id_trip_wage_values_id_fk" FOREIGN KEY ("replaced_by_id") REFERENCES "hris"."trip_wage_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trip_wage_values_one_live" ON "hris"."trip_wage_values" USING btree ("wage_id") WHERE "hris"."trip_wage_values"."status" <> 'CANCELLED';--> statement-breakpoint
CREATE INDEX "trip_wage_values_week_idx" ON "hris"."trip_wage_values" USING btree ("week_start","employee_id");--> statement-breakpoint
CREATE INDEX "trip_wage_values_wage_idx" ON "hris"."trip_wage_values" USING btree ("wage_id");--> statement-breakpoint
CREATE TRIGGER trip_wage_values_no_delete BEFORE DELETE ON hris.trip_wage_values FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
-- Angka upah tidak pernah diubah (DRV-01): yang boleh berubah hanya tanda batal/pengganti, Sudah dilihat, dan slip pemuat.
CREATE FUNCTION hris.trip_wage_values_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.wage_id, NEW.employee_id, NEW.kind, NEW.wage_date, NEW.week_start, NEW.role, NEW.with_assistant, NEW.vehicle_id, NEW.route_id,
      NEW.rate_id, NEW.rate_amount, NEW.amount, NEW.pay_basis, NEW.day_status, NEW.zero_reason, NEW.needs_look, NEW.created_at)
     IS DISTINCT FROM
     (OLD.wage_id, OLD.employee_id, OLD.kind, OLD.wage_date, OLD.week_start, OLD.role, OLD.with_assistant, OLD.vehicle_id, OLD.route_id,
      OLD.rate_id, OLD.rate_amount, OLD.amount, OLD.pay_basis, OLD.day_status, OLD.zero_reason, OLD.needs_look, OLD.created_at) THEN
    RAISE EXCEPTION 'Angka upah ritase tidak boleh diubah; nilai ulang dengan baris baru.';
  END IF;
  IF OLD.status = 'CANCELLED' AND NEW.status <> 'CANCELLED' THEN
    RAISE EXCEPTION 'Upah ritase yang dibatalkan tidak bisa dihidupkan lagi.';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER trip_wage_values_guard BEFORE UPDATE ON hris.trip_wage_values FOR EACH ROW EXECUTE FUNCTION hris.trip_wage_values_guard();
--> statement-breakpoint
-- Hak awal L7a (spec L7 §5). Pemilik dan GM lewat full_access; ubah tarif ownerOnly.
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('kepala gudang', 'wage.rate.view', 'ALL'),
  ('hr', 'wage.rate.view', 'ALL'), ('hr', 'wage.trip.view', 'ALL'), ('hr', 'wage.trip.review', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
