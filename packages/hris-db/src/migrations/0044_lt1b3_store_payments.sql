-- Logistik LT1b-3: uang dan laporan di toko (spec docs/work/specs/2026-11-04-hris-logistik-t1-toko-surat-jalan-design.md §13.2, §13.5).
-- Tabel dan view ada di aliran migrasi `logistics` 0007 (dijalankan sebelum hris).
-- Hak awal (§13.5 butir 6). Pemilik dan GM punya semuanya lewat full_access.
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('finance', 'logistics.store_payment.view', 'ALL'), ('kepala gudang', 'logistics.store_payment.view', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
