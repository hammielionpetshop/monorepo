-- Logistik LT2a: barang kembali, rincian retur, tab Tertunda (spec docs/work/specs/2026-11-04-hris-logistik-t1-toko-surat-jalan-design.md §14.1).
-- Tabel ada di aliran migrasi `logistics` 0008 (dijalankan sebelum hris).
INSERT INTO hris.setting_values (key, value, effective_from, status, reason) VALUES
  ('logistics.returned_goods_from', '"2026-11-05"'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal spec LT1 §14.1 (owner 2026-11-05)'),
  ('logistics.pending_red_days', '3'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal LOG-57 (owner 2026-11-05)');
--> statement-breakpoint
-- Hak awal (§14.1). Pemilik dan GM punya semuanya lewat full_access; cabang pemilik barang lain diberi lewat Hak Akses Jabatan.
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('kepala gudang', 'logistics.returned_goods.receive', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
