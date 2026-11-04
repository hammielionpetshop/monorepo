-- Logistik LT1b-2b: titik toko (spec docs/work/specs/2026-11-04-hris-logistik-t1-toko-surat-jalan-design.md §3.8, §13.4).
-- Tabel dan kolom ada di aliran migrasi `logistics` 0006 (dijalankan sebelum hris).
-- Pengaturan (harus ada di registry.ts, H18): akurasi GPS terburuk saat pasang titik, batas "di luar titik" saat Terkirim (§3.10).
INSERT INTO hris.setting_values (key, value, effective_from, status, reason) VALUES
  ('logistics.point_accuracy_m', '50'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal spec LT1 §3.10 (owner 2026-11-04)'),
  ('logistics.store_radius_m', '100'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal spec LT1 §3.10 (owner 2026-11-04)');
--> statement-breakpoint
-- Hak awal (§13.4 butir 2). Pemilik dan GM punya semuanya lewat full_access.
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('kepala gudang', 'logistics.store_point.decide', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
