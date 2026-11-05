-- Logistik LT3c: Antar sendiri sisi kantor (spec docs/work/specs/2026-11-04-hris-logistik-t1-toko-surat-jalan-design.md §15.3).
-- Tabel/kolom ada di aliran migrasi `logistics` 0013. Hak baru: tutup perjalanan, alihkan PJ, keputusan Gagal.
-- Pemilik dan GM punya semuanya lewat full_access.
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('kepala toko', 'logistics.self_delivery.manage', 'BRANCH'), ('kepala gudang', 'logistics.self_delivery.manage', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
