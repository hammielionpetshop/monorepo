-- Kasbon L5b (spec L5 §3.9–3.12, §5). Tanpa perubahan tabel: kolom dan status L5b sudah disiapkan migrasi 0029.
-- Isi awal pengaturan kasbon L5b (harus ada di registry.ts, H18; DRV-85).
INSERT INTO hris.setting_values (key, value, effective_from, status, reason) VALUES
  ('advance.postpone_quota', '1'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (DRV-68)'),
  ('advance.reschedule_max_ahead', '3'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (DRV-69)'),
  ('advance.special_max_installments', '12'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (DRV-76)'),
  ('advance.special_event_kinds', '["Kecelakaan", "Sakit", "Duka", "Lainnya"]'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (DRV-76)');
--> statement-breakpoint
-- Hak awal L5b (spec L5 §5): Finance menerima pelunasan tunai. Ubah jadwal, hapus utang, dan Kasbon Khusus hanya Pemilik/GM.
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('finance', 'advance.repay', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
