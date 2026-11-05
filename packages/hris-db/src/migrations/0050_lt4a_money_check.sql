-- Logistik LT4a: Terima Uang, pemeriksaan uang trip per nota (spec docs/work/specs/2026-11-04-hris-logistik-t1-toko-surat-jalan-design.md §16.1).
-- Tabel ada di aliran migrasi `logistics` 0015 (dijalankan sebelum hris).
INSERT INTO hris.setting_values (key, value, effective_from, status, reason) VALUES
  ('logistics.money_check_from', '"2026-11-05"'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal spec LT1 §16.1 (owner 2026-11-05)');
--> statement-breakpoint
-- Hak awal (§16.1 butir 3). Pemilik dan GM punya semuanya lewat full_access.
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('finance', 'logistics.money_check.do', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
