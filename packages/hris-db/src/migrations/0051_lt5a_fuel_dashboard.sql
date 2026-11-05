-- Logistik LT5a: bensin (sumber uang keluar), Dashboard Logistik, tinjau kiriman di luar titik toko
-- (spec docs/work/specs/2026-11-04-hris-logistik-t1-toko-surat-jalan-design.md §17.1). Tabel ada di aliran migrasi `logistics` 0016.
INSERT INTO hris.setting_values (key, value, effective_from, status, reason) VALUES
  ('logistics.outside_review_from', '"2026-11-05"'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal spec LT1 §17.1 butir 9 (owner 2026-11-05)');
--> statement-breakpoint
-- Hak awal (§17.1 butir 6, 8, 9). Pemilik dan GM punya semuanya lewat full_access.
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('finance', 'logistics.fuel.record', 'ALL'),
  ('kepala gudang', 'logistics.dashboard.view', 'ALL'), ('marketing', 'logistics.dashboard.view', 'ALL'),
  ('kepala gudang', 'logistics.outside_point.review', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
