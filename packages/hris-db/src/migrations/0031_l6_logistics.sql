-- Logistik Minimal L6 (spec L6 §3.9, §5). Tabel trip ada di aliran migrasi `logistics` 0001 (dijalankan sebelum hris).
-- Isi awal pengaturan L6 (harus ada di registry.ts, H18).
INSERT INTO hris.setting_values (key, value, effective_from, status, reason) VALUES
  ('logistics.hanging_hour', '12'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (LOG-31)'),
  ('logistics.manual_wage_days', '14'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (LOG-102)');
--> statement-breakpoint
-- Titik garasi bawaan = cabang Gudang (spec L6 §3.9), hanya bila belum diatur. Aliran `logistics` dimigrasi lebih dulu
-- (pnpm db:migrate); DB uji yang hanya memuat migrasi hris dilewati.
DO $$
BEGIN
  IF to_regclass('logistics.config') IS NOT NULL THEN
    UPDATE logistics.config SET garage_branch_id = (SELECT b.id FROM hris.branches b WHERE lower(b.name) = 'gudang' ORDER BY b.id LIMIT 1)
    WHERE id = 1 AND garage_branch_id IS NULL;
  END IF;
END $$;
--> statement-breakpoint
-- Hak awal L6 (spec L6 §5). Pemilik dan GM punya semuanya lewat full_access; ritase tangan, batal ritase, dan pagar uji ownerOnly.
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('kepala gudang', 'logistics.fleet.manage', 'ALL'), ('kepala gudang', 'logistics.trip.view', 'ALL'),
  ('kepala gudang', 'logistics.trip.manage', 'ALL'), ('kepala gudang', 'logistics.wage.view', 'ALL'),
  ('kepala gudang', 'attendance.trip.view', 'ALL'), ('kepala gudang', 'attendance.trip.photo', 'ALL'),
  ('hr', 'logistics.trip.view', 'ALL'), ('hr', 'logistics.wage.view', 'ALL'),
  ('hr', 'attendance.trip.view', 'ALL'), ('hr', 'attendance.trip.photo', 'ALL'),
  ('admin hr', 'attendance.trip.view', 'ALL'),
  ('finance', 'attendance.trip.view', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
