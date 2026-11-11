-- Bebaskan Hutang Supplier: hak baru untuk mengubah hutang supplier yang belum dibayar menjadi
-- WAIVED ("Dihapus") dengan alasan wajib. Alasan + pelaku direkam di audit_logs
-- (SUPPLIER_PAYABLE_WAIVED); tidak ada perubahan struktur tabel maupun data lama.
INSERT INTO "petshop"."permissions" ("code", "name", "description")
VALUES ('payable.supplier_waive', 'Bebaskan Hutang Supplier', 'Membebaskan hutang supplier yang belum dibayar (tanpa uang keluar), dengan alasan')
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "petshop"."role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "petshop"."roles" r
CROSS JOIN "petshop"."permissions" p
WHERE p."code" = 'payable.supplier_waive' AND r."name" IN ('OWNER', 'GM')
ON CONFLICT DO NOTHING;
