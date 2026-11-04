CREATE TABLE "logistics"."stores" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"default_route_id" integer,
	"delivery_note" text,
	"created_by_account_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_account_id" integer,
	"updated_at" timestamp with time zone,
	CONSTRAINT "stores_note_length" CHECK ("logistics"."stores"."delivery_note" is null or char_length("logistics"."stores"."delivery_note") <= 500)
);
--> statement-breakpoint
ALTER TABLE "logistics"."stores" ADD CONSTRAINT "stores_default_route_id_routes_id_fk" FOREIGN KEY ("default_route_id") REFERENCES "logistics"."routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "stores_customer_unique" ON "logistics"."stores" USING btree ("customer_id");--> statement-breakpoint
CREATE TRIGGER stores_no_delete BEFORE DELETE ON logistics.stores FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
--> statement-breakpoint
-- Kontrak baca dari kasir (spec LT1 §2.2, §12). Pola `hris.pos_*`: view dimiliki pemilik migrasi, hris_app tidak menyentuh
-- schema petshop. Kolom view = kontrak (stub `packages/hris-db/test-stubs/petshop-pos.sql` dan tesnya ikut diubah).
-- Jam kasir disimpan `timestamp` UTC tanpa zona; di sini dijadikan timestamptz dan tanggal WIB.
CREATE VIEW logistics.pos_customers AS
  SELECT c.id, c.code, c.name, c.phone, c.address, c.is_active AS active, c.is_internal_branch, c.linked_branch_id
  FROM petshop.customers c;
--> statement-breakpoint
CREATE VIEW logistics.pos_truck_sales AS
  SELECT t.id, t.trx_number, t.branch_id, b.name AS branch_name, t.customer_id, t.payable_amount, t.status, t.revision,
    (t.created_at AT TIME ZONE 'UTC') AS created_at,
    (t.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date AS trx_on
  FROM petshop.transactions t
  JOIN petshop.branches b ON b.id = t.branch_id
  WHERE t.delivery_method = 'TRUCK';
--> statement-breakpoint
CREATE VIEW logistics.pos_truck_transfers AS
  SELECT i.id, i.ibt_number, i.source_branch_id, s.name AS source_branch_name, i.destination_branch_id, d.name AS destination_branch_name,
    i.status, (i.created_at AT TIME ZONE 'UTC') AS created_at,
    (i.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date AS created_on
  FROM petshop.inter_branch_transfers i
  JOIN petshop.branches s ON s.id = i.source_branch_id
  JOIN petshop.branches d ON d.id = i.destination_branch_id
  WHERE i.delivery_method = 'TRUCK';
--> statement-breakpoint
-- hris_app mendapat INSERT/UPDATE/DELETE atas semua relasi schema logistics (roles.sql), dan view satu tabel bisa
-- ditulis tembus ke petshop. Penulisan lewat view kasir selalu ditolak: HRIS hanya membaca kasir (spec LT1 §5).
CREATE FUNCTION logistics.reject_pos_view_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Data kasir hanya bisa dibaca dari HRIS (%).', TG_TABLE_NAME;
END $$;
--> statement-breakpoint
CREATE TRIGGER pos_customers_read_only INSTEAD OF INSERT OR UPDATE OR DELETE ON logistics.pos_customers
  FOR EACH ROW EXECUTE FUNCTION logistics.reject_pos_view_write();
--> statement-breakpoint
CREATE TRIGGER pos_truck_sales_read_only INSTEAD OF INSERT OR UPDATE OR DELETE ON logistics.pos_truck_sales
  FOR EACH ROW EXECUTE FUNCTION logistics.reject_pos_view_write();
--> statement-breakpoint
CREATE TRIGGER pos_truck_transfers_read_only INSTEAD OF INSERT OR UPDATE OR DELETE ON logistics.pos_truck_transfers
  FOR EACH ROW EXECUTE FUNCTION logistics.reject_pos_view_write();
