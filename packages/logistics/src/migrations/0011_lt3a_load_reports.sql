CREATE TABLE "logistics"."load_report_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"transaction_id" integer NOT NULL,
	"trx_number" text NOT NULL,
	"amount" integer NOT NULL,
	"added_by_account_id" integer NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"released_at" timestamp with time zone,
	"released_by_account_id" integer,
	CONSTRAINT "load_report_notes_released" CHECK (("logistics"."load_report_notes"."released_at" is null) = ("logistics"."load_report_notes"."released_by_account_id" is null))
);
--> statement-breakpoint
CREATE TABLE "logistics"."load_report_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"kind" text NOT NULL,
	"file_id" uuid NOT NULL,
	"late" boolean DEFAULT false NOT NULL,
	"taken_by_employee_id" integer,
	"taken_by_account_id" integer NOT NULL,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"removed_by_account_id" integer,
	CONSTRAINT "load_report_photos_kind" CHECK ("logistics"."load_report_photos"."kind" in ('NOTE', 'GOODS')),
	CONSTRAINT "load_report_photos_removed" CHECK (("logistics"."load_report_photos"."removed_at" is null) = ("logistics"."load_report_photos"."removed_by_account_id" is null) and ("logistics"."load_report_photos"."removed_at" is null or not "logistics"."load_report_photos"."late"))
);
--> statement-breakpoint
CREATE TABLE "logistics"."load_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer NOT NULL,
	"kasir_branch_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"created_by_employee_id" integer,
	"created_by_account_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"done_at" timestamp with time zone,
	"done_by_account_id" integer,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_account_id" integer,
	"cancel_reason" text,
	CONSTRAINT "load_reports_status" CHECK ("logistics"."load_reports"."status" in ('DRAFT', 'DONE', 'CANCELLED')),
	CONSTRAINT "load_reports_done" CHECK (("logistics"."load_reports"."status" = 'DONE') = ("logistics"."load_reports"."done_at" is not null) and ("logistics"."load_reports"."done_at" is null) = ("logistics"."load_reports"."done_by_account_id" is null)),
	CONSTRAINT "load_reports_cancelled" CHECK (("logistics"."load_reports"."status" = 'CANCELLED') = ("logistics"."load_reports"."cancelled_at" is not null)
      and ("logistics"."load_reports"."cancelled_at" is null) = ("logistics"."load_reports"."cancelled_by_account_id" is null) and ("logistics"."load_reports"."cancelled_at" is null) = ("logistics"."load_reports"."cancel_reason" is null))
);
--> statement-breakpoint
ALTER TABLE "logistics"."load_report_notes" ADD CONSTRAINT "load_report_notes_report_id_load_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "logistics"."load_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."load_report_photos" ADD CONSTRAINT "load_report_photos_report_id_load_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "logistics"."load_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "load_report_notes_once" ON "logistics"."load_report_notes" USING btree ("transaction_id") WHERE "logistics"."load_report_notes"."released_at" is null;--> statement-breakpoint
CREATE INDEX "load_report_notes_report_idx" ON "logistics"."load_report_notes" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "load_report_photos_report_idx" ON "logistics"."load_report_photos" USING btree ("report_id");--> statement-breakpoint
CREATE UNIQUE INDEX "load_report_photos_file_unique" ON "logistics"."load_report_photos" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "load_reports_branch_idx" ON "logistics"."load_reports" USING btree ("branch_id","created_at");--> statement-breakpoint
CREATE INDEX "load_reports_customer_idx" ON "logistics"."load_reports" USING btree ("customer_id");--> statement-breakpoint
CREATE TRIGGER load_reports_no_delete BEFORE DELETE ON logistics.load_reports FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
--> statement-breakpoint
CREATE TRIGGER load_report_notes_no_delete BEFORE DELETE ON logistics.load_report_notes FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
--> statement-breakpoint
CREATE TRIGGER load_report_photos_no_delete BEFORE DELETE ON logistics.load_report_photos FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
--> statement-breakpoint
-- Nota kasir berpelanggan untuk Laporan Muat (spec LT1 §15.1). Kontrak baca seperti pos_truck_sales (0003); stub tes ikut.
CREATE VIEW logistics.pos_branch_sales AS
  SELECT t.id, t.trx_number, t.branch_id, b.name AS branch_name, t.customer_id, t.payable_amount, t.status, t.delivery_method,
    (t.created_at AT TIME ZONE 'UTC') AS created_at,
    (t.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date AS trx_on
  FROM petshop.transactions t
  JOIN petshop.branches b ON b.id = t.branch_id
  WHERE t.customer_id IS NOT NULL;
--> statement-breakpoint
CREATE TRIGGER pos_branch_sales_read_only INSTEAD OF INSERT OR UPDATE OR DELETE ON logistics.pos_branch_sales
  FOR EACH ROW EXECUTE FUNCTION logistics.reject_pos_view_write();
