-- Logistik LT3b: Antar sendiri di HP pengantar (spec docs/work/specs/2026-11-04-hris-logistik-t1-toko-surat-jalan-design.md §15.2).
-- Tabel ada di aliran migrasi `logistics` 0012 (dijalankan sebelum hris). Pengaturan harus ada di registry.ts (H18).
INSERT INTO hris.setting_values (key, value, effective_from, status, reason) VALUES
  ('logistics.self_delivery_from', '"2026-11-05"'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal spec LT1 §15.2 (owner 2026-11-05): nota kurir cabang sejak tanggal ini menjadi tugas antar'),
  ('logistics.self_stage_min_minutes', '2'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal LOG-43: tiap tahap antar sendiri paling sedikit 2 menit'),
  ('logistics.self_gap_minutes', '20'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal LOG-43: selisih lama berangkat dan kembali 20 menit atau lebih wajib alasan');
--> statement-breakpoint
-- Hak awal (§15.2). Pemilik dan GM punya semuanya lewat full_access.
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('kepala toko', 'logistics.self_delivery.run', 'BRANCH'), ('kasir', 'logistics.self_delivery.run', 'BRANCH'),
  ('pramuniaga', 'logistics.self_delivery.run', 'BRANCH'),
  ('kepala toko', 'logistics.self_delivery.cash_receive', 'BRANCH'), ('kasir', 'logistics.self_delivery.cash_receive', 'BRANCH'),
  ('kepala toko', 'logistics.self_delivery.view', 'BRANCH'), ('kepala gudang', 'logistics.self_delivery.view', 'ALL'),
  ('marketing', 'logistics.self_delivery.view', 'ALL'), ('finance', 'logistics.self_delivery.view', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
