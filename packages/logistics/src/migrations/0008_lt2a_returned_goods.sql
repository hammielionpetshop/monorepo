-- Logistik LT2a: barang kembali, rincian retur, tutup tertunda (spec docs/work/specs/2026-11-04-hris-logistik-t1-toko-surat-jalan-design.md §14.1).
CREATE TABLE "logistics"."goods_receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_kind" text NOT NULL,
	"source_id" integer NOT NULL,
	"trip_id" integer NOT NULL,
	"step" text NOT NULL,
	"result" text NOT NULL,
	"note" text,
	"photo_file_id" uuid NOT NULL,
	"received_by_account_id" integer NOT NULL,
	"received_by_employee_id" integer,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goods_receipts_source" CHECK ("logistics"."goods_receipts"."source_kind" in ('NOTE', 'RETURN')),
	CONSTRAINT "goods_receipts_step" CHECK ("logistics"."goods_receipts"."step" in ('WAREHOUSE', 'OWNER')),
	CONSTRAINT "goods_receipts_result" CHECK ("logistics"."goods_receipts"."result" in ('MATCH', 'MISMATCH') and ("logistics"."goods_receipts"."result" = 'MATCH' or "logistics"."goods_receipts"."note" is not null))
);
--> statement-breakpoint
CREATE TABLE "logistics"."visit_report_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"name" text NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"unit" text NOT NULL,
	CONSTRAINT "visit_report_items_name" CHECK (char_length(btrim("logistics"."visit_report_items"."name")) between 2 and 120),
	CONSTRAINT "visit_report_items_unit" CHECK (char_length(btrim("logistics"."visit_report_items"."unit")) between 1 and 20),
	CONSTRAINT "visit_report_items_quantity" CHECK ("logistics"."visit_report_items"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "logistics"."delivery_note_events" DROP CONSTRAINT "delivery_note_events_kind";--> statement-breakpoint
ALTER TABLE "logistics"."visit_reports" ADD COLUMN "owner_branch_id" integer;--> statement-breakpoint
ALTER TABLE "logistics"."goods_receipts" ADD CONSTRAINT "goods_receipts_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "logistics"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."visit_report_items" ADD CONSTRAINT "visit_report_items_report_id_visit_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "logistics"."visit_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "goods_receipts_once" ON "logistics"."goods_receipts" USING btree ("source_kind","source_id","step");--> statement-breakpoint
CREATE INDEX "goods_receipts_trip_idx" ON "logistics"."goods_receipts" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "visit_report_items_report_idx" ON "logistics"."visit_report_items" USING btree ("report_id");--> statement-breakpoint
ALTER TABLE "logistics"."delivery_note_events" ADD CONSTRAINT "delivery_note_events_kind" CHECK ("logistics"."delivery_note_events"."kind" in ('ON_TRIP', 'RELEASED', 'TRIP_CANCELLED', 'TRIP_CLOSED', 'LOADED', 'NOT_READY', 'DELIVERED', 'TOMORROW', 'FAILED', 'RETRY', 'RESENT', 'DROPPED', 'REOPENED', 'PENDING_CLOSED'));--> statement-breakpoint
CREATE TRIGGER goods_receipts_no_delete BEFORE DELETE ON logistics.goods_receipts FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
--> statement-breakpoint
CREATE TRIGGER visit_report_items_no_delete BEFORE DELETE ON logistics.visit_report_items FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
