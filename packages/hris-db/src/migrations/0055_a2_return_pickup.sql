-- A2 Tugas Jemput Retur (spec docs/work/specs/2026-11-08-jemput-retur-design.md). Tabel ada di aliran `logistics` 0017.
-- Hak awal: Kepala Gudang, Marketing, Finance; Pemilik dan GM lewat full_access.
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('kepala gudang', 'logistics.return_pickup.manage', 'ALL'),
  ('marketing', 'logistics.return_pickup.manage', 'ALL'),
  ('finance', 'logistics.return_pickup.manage', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
