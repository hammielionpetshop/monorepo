-- Logistik LT5b: Laporan Logistik (spec docs/work/specs/2026-11-04-hris-logistik-t1-toko-surat-jalan-design.md §17.2).
-- Hanya hak baru; laporan membaca tabel logistics yang sudah ada (tanpa migrasi logistics). Pemilik dan GM lewat full_access.
-- Kepala Toko tidak diberi (owner 2026-11-06). Bensin dan kurang serah dibatasi di layanan untuk pemegang hak bensin / uang.
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('kepala gudang', 'logistics.report.view', 'ALL'), ('marketing', 'logistics.report.view', 'ALL'), ('finance', 'logistics.report.view', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
