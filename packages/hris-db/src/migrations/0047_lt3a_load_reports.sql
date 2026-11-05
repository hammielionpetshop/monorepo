-- Logistik LT3a: Laporan Muat (spec docs/work/specs/2026-11-04-hris-logistik-t1-toko-surat-jalan-design.md §15.1).
-- Tabel ada di aliran migrasi `logistics` 0011 (dijalankan sebelum hris).
-- Saklar per cabang (harus ada di registry.ts, H18): Semua = Tidak, Toko Pusat = Ya (keputusan owner 2026-11-05).
INSERT INTO hris.setting_values (key, value, effective_from, status, reason) VALUES
  ('logistics.load_report_on', '"NO"'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal spec LT1 §15.1: laporan muat hanya cabang yang dinyalakan');
--> statement-breakpoint
INSERT INTO hris.setting_values (key, target_kind, target_id, value, effective_from, status, reason)
SELECT 'logistics.load_report_on', 'BRANCH', b.id, '"YES"'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal spec LT1 §15.1 (owner 2026-11-05): Toko Pusat memakai laporan muat'
FROM hris.branches b
WHERE lower(b.name) = 'toko pusat';
--> statement-breakpoint
-- Hak awal (§15.1 butir 2, 7). Pemilik dan GM punya semuanya lewat full_access.
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('kepala toko', 'logistics.load_report.create', 'BRANCH'), ('kasir', 'logistics.load_report.create', 'BRANCH'),
  ('pramuniaga', 'logistics.load_report.create', 'BRANCH'),
  ('kepala toko', 'logistics.load_report.view', 'BRANCH'), ('kepala gudang', 'logistics.load_report.view', 'ALL'),
  ('marketing', 'logistics.load_report.view', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
