-- Logistik LT1b-2a: alur trip di HP driver (spec docs/work/specs/2026-11-04-hris-logistik-t1-toko-surat-jalan-design.md §13.3).
-- Tabel dan kolom ada di aliran migrasi `logistics` 0005 (dijalankan sebelum hris).
-- Pengaturan (harus ada di registry.ts, H18): batas buka lagi surat jalan yang dibatalkan logistik (§3.10, §13.3 butir 7).
INSERT INTO hris.setting_values (key, value, effective_from, status, reason) VALUES
  ('logistics.reopen_days', '7'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal spec LT1 §3.10 (owner 2026-11-04)');
--> statement-breakpoint
-- Hak awal (§13.3 butir 6, 7). Pemilik dan GM punya semuanya lewat full_access.
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('kepala gudang', 'logistics.delivery_note.decide', 'ALL'), ('kepala gudang', 'logistics.vehicle_followup.manage', 'ALL'),
  ('finance', 'logistics.vehicle_followup.manage', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
