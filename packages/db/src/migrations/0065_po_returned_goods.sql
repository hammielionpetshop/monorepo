-- PO "Barang kembali": harga PO tetap nilai sebenarnya (hutang, PDF), tetapi modal Manajemen Harga
-- tidak disentuh dan HPP batch memakai modal cabang. Hak membuatnya: OWNER, GM.
ALTER TABLE "petshop"."purchase_orders"
  ADD COLUMN IF NOT EXISTS "keep_current_cost" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
INSERT INTO "petshop"."permissions" ("code", "name", "description")
VALUES ('po.returned_goods', 'PO Barang Kembali', 'Membuat PO yang tidak mengubah modal (HPP memakai modal cabang)')
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "petshop"."role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "petshop"."roles" r
CROSS JOIN "petshop"."permissions" p
WHERE p."code" = 'po.returned_goods' AND r."name" IN ('OWNER', 'GM')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Koreksi data: Total PO supplier yang barangnya datang melebihi pesanan (fitur 1.107.124) masih
-- dihitung dari qty pesan. Total PO = jumlah per baris max(qty pesan, qty diterima) × harga
-- berlaku (harga faktur bila > 0, selain itu harga PO). Hanya PO yang punya baris berlebih.
UPDATE "petshop"."purchase_orders" po
SET "total_amount" = t.total
FROM (
  SELECT poi."po_id",
    ROUND(SUM(
      GREATEST(poi."qty_ordered", poi."qty_received")::numeric *
      CASE WHEN COALESCE(poi."invoice_unit_cost", 0) > 0 THEN poi."invoice_unit_cost" ELSE poi."unit_cost" END
    ))::integer AS total
  FROM "petshop"."purchase_order_items" poi
  GROUP BY poi."po_id"
  HAVING bool_or(poi."qty_received" > poi."qty_ordered")
) t
WHERE po."id" = t."po_id" AND po."po_type" = 'EXTERNAL' AND po."total_amount" <> t.total;
