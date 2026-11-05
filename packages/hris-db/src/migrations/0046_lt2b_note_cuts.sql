-- Logistik LT2b: keputusan potong nota, Perlu dicatat di kasir, koreksi cara bayar, janji bayar sisa (spec docs/work/specs/2026-11-04-hris-logistik-t1-toko-surat-jalan-design.md §14.2).
-- Tabel ada di aliran migrasi `logistics` 0009 (dijalankan sebelum hris).
-- Hak awal (§14.2). Pemilik dan GM punya semuanya lewat full_access.
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('finance', 'logistics.note_cut.decide', 'ALL'), ('kepala gudang', 'logistics.store_payment.correct', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
