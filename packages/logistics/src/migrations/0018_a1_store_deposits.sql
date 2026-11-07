CREATE TABLE "logistics"."store_deposits" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"kind" text NOT NULL,
	"amount" integer NOT NULL,
	"visit_id" integer,
	"trip_id" integer,
	"transaction_id" integer,
	"trx_number" text,
	"note" text,
	"created_by_employee_id" integer,
	"created_by_account_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actual_amount" integer,
	"check_note" text,
	"checked_by_account_id" integer,
	"checked_at" timestamp with time zone,
	"recorded_at" timestamp with time zone,
	"recorded_by_account_id" integer,
	"recorded_ref" text,
	"voided_at" timestamp with time zone,
	"voided_by_account_id" integer,
	"void_reason" text,
	CONSTRAINT "store_deposits_kind" CHECK ("logistics"."store_deposits"."kind" in ('IN', 'USE', 'REFUND') and "logistics"."store_deposits"."amount" > 0),
	CONSTRAINT "store_deposits_in" CHECK (("logistics"."store_deposits"."kind" = 'IN') = ("logistics"."store_deposits"."visit_id" is not null and "logistics"."store_deposits"."trip_id" is not null)),
	CONSTRAINT "store_deposits_use" CHECK (("logistics"."store_deposits"."kind" = 'USE') = ("logistics"."store_deposits"."transaction_id" is not null and "logistics"."store_deposits"."trx_number" is not null)),
	CONSTRAINT "store_deposits_refund" CHECK ("logistics"."store_deposits"."kind" <> 'REFUND' or "logistics"."store_deposits"."note" is not null),
	CONSTRAINT "store_deposits_checked" CHECK (("logistics"."store_deposits"."checked_at" is null) = ("logistics"."store_deposits"."actual_amount" is null) and ("logistics"."store_deposits"."checked_at" is null) = ("logistics"."store_deposits"."checked_by_account_id" is null)
      and ("logistics"."store_deposits"."checked_at" is null or "logistics"."store_deposits"."kind" = 'IN') and ("logistics"."store_deposits"."actual_amount" is null or "logistics"."store_deposits"."actual_amount" >= 0)
      and ("logistics"."store_deposits"."actual_amount" is null or "logistics"."store_deposits"."actual_amount" = "logistics"."store_deposits"."amount" or "logistics"."store_deposits"."check_note" is not null)),
	CONSTRAINT "store_deposits_recorded" CHECK (("logistics"."store_deposits"."recorded_at" is null) = ("logistics"."store_deposits"."recorded_ref" is null) and ("logistics"."store_deposits"."recorded_at" is null) = ("logistics"."store_deposits"."recorded_by_account_id" is null)
      and ("logistics"."store_deposits"."recorded_at" is null or "logistics"."store_deposits"."kind" = 'USE')),
	CONSTRAINT "store_deposits_voided" CHECK (("logistics"."store_deposits"."voided_at" is null) = ("logistics"."store_deposits"."void_reason" is null) and ("logistics"."store_deposits"."voided_at" is null) = ("logistics"."store_deposits"."voided_by_account_id" is null)
      and ("logistics"."store_deposits"."voided_at" is null or ("logistics"."store_deposits"."kind" <> 'IN' and "logistics"."store_deposits"."recorded_at" is null)))
);
--> statement-breakpoint
ALTER TABLE "logistics"."store_deposits" ADD CONSTRAINT "store_deposits_visit_id_trip_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "logistics"."trip_visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."store_deposits" ADD CONSTRAINT "store_deposits_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "logistics"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "store_deposits_customer_idx" ON "logistics"."store_deposits" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "store_deposits_visit_in" ON "logistics"."store_deposits" USING btree ("visit_id") WHERE "logistics"."store_deposits"."kind" = 'IN';--> statement-breakpoint
CREATE TRIGGER store_deposits_no_delete BEFORE DELETE ON logistics.store_deposits FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
--> statement-breakpoint
-- Piutang kasir terbuka + nomor nota (A1, pemakaian titipan). Baca saja; kolom view = kontrak, ubah dengan migrasi baru.
CREATE VIEW logistics.pos_open_debts AS
  SELECT d.id, d.customer_id, d.transaction_id, t.trx_number, d.remaining_amount, t.created_at
  FROM petshop.customer_debts d JOIN petshop.transactions t ON t.id = d.transaction_id
  WHERE d.status NOT IN ('PAID', 'VOIDED') AND d.remaining_amount > 0;
