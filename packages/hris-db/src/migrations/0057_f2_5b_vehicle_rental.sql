-- F2-5b Sewa Mobil per Ritase (spec docs/work/specs/2026-11-11-f2-5-biaya-rutin-sewa-mobil-design.md §3.3). Tabel di aliran logistics 0020.
-- Bayar: Finance (Pemilik dan GM lewat full_access). Lihat: Kepala Gudang dan Finance.
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('finance', 'logistics.vehicle_rental.pay', 'ALL'),
  ('finance', 'logistics.vehicle_rental.view', 'ALL'),
  ('kepala gudang', 'logistics.vehicle_rental.view', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
