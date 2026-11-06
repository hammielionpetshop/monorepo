ALTER TABLE "hris"."unloading_items" ADD COLUMN "po_item_id" integer;--> statement-breakpoint
ALTER TABLE "hris"."unloading_items" ADD COLUMN "po_qty" numeric(12, 3);--> statement-breakpoint
ALTER TABLE "hris"."unloading_reports" ADD COLUMN "source" text DEFAULT 'ARRIVED_FIRST' NOT NULL;--> statement-breakpoint
ALTER TABLE "hris"."unloading_reports" ADD COLUMN "po_id" integer;--> statement-breakpoint
ALTER TABLE "hris"."unloading_reports" ADD COLUMN "po_number" text;--> statement-breakpoint
ALTER TABLE "hris"."unloading_reports" ADD COLUMN "po_mismatch" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "hris"."unloading_reports" ADD COLUMN "po_sync_status" text DEFAULT 'NONE' NOT NULL;--> statement-breakpoint
ALTER TABLE "hris"."unloading_reports" ADD COLUMN "po_sync_error" text;--> statement-breakpoint
ALTER TABLE "hris"."unloading_reports" ADD COLUMN "po_synced_version" integer;--> statement-breakpoint
ALTER TABLE "hris"."unloading_reports" ADD COLUMN "po_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hris"."unloading_reports" ADD COLUMN "draft_approved_by_account_id" integer;--> statement-breakpoint
ALTER TABLE "hris"."unloading_reports" ADD COLUMN "draft_approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hris"."unloading_reports" ADD CONSTRAINT "unloading_reports_source" CHECK ("hris"."unloading_reports"."source" in ('PO', 'ARRIVED_FIRST'));--> statement-breakpoint
ALTER TABLE "hris"."unloading_reports" ADD CONSTRAINT "unloading_reports_po_sync" CHECK ("hris"."unloading_reports"."po_sync_status" in ('NONE', 'WAITING_APPROVAL', 'PENDING', 'SYNCED', 'FAILED'));--> statement-breakpoint
ALTER TABLE "hris"."unloading_reports" ADD CONSTRAINT "unloading_reports_po_source" CHECK ("hris"."unloading_reports"."source" <> 'PO' or "hris"."unloading_reports"."po_id" is not null);--> statement-breakpoint
-- Ditulis tangan (spec 2026-11-06 bongkaran → Draft PO §4.1): PO supplier kasir yang bisa dicocokkan dengan bongkaran
-- (Disetujui / Dalam perjalanan / Diterima sebagian) + barisnya. Baca saja; kolomnya kontrak, stub di test-stubs/petshop-pos.sql.
CREATE VIEW hris.pos_purchase_orders AS
  SELECT po.id, po.po_number, po.supplier_id, po.status, po.created_at
  FROM petshop.purchase_orders po
  WHERE po.po_type = 'EXTERNAL' AND po.status IN ('APPROVED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED');
--> statement-breakpoint
CREATE VIEW hris.pos_purchase_order_items AS
  SELECT i.id, i.po_id, i.product_id, i.uom_id, i.qty_ordered, i.qty_received
  FROM petshop.purchase_order_items i JOIN hris.pos_purchase_orders po ON po.id = i.po_id;
