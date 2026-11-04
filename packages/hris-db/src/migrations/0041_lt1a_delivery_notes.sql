-- Logistik Tahap 1a: Surat Jalan + Data Toko (spec docs/work/specs/2026-11-04-hris-logistik-t1-toko-surat-jalan-design.md §12).
-- Tabel dan view ada di aliran migrasi `logistics` 0003 (dijalankan sebelum hris).
-- Isi awal pengaturan (harus ada di registry.ts, H18): antrean mulai tanggal tayang cara kirim kasir (§9 butir 3, owner 2026-11-04).
INSERT INTO hris.setting_values (key, value, effective_from, status, reason) VALUES
  ('logistics.delivery_from', '"2026-11-04"'::jsonb, '2026-01-01', 'ACTIVE', 'Tanggal tayang cara kirim kasir 1.107.108 (spec LT1 §9 butir 3, owner 2026-11-04)');
--> statement-breakpoint
-- Hak awal (spec LT1 §12). Pemilik dan GM punya semuanya lewat full_access.
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('kepala gudang', 'logistics.delivery_note.view', 'ALL'), ('kepala gudang', 'logistics.store.view', 'ALL'),
  ('kepala gudang', 'logistics.store.manage', 'ALL'),
  ('marketing', 'logistics.delivery_note.view', 'ALL'), ('marketing', 'logistics.store.view', 'ALL'),
  ('marketing', 'logistics.store.manage', 'ALL'),
  ('finance', 'logistics.delivery_note.view', 'ALL'), ('finance', 'logistics.store.view', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
