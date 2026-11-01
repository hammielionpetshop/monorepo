-- Ditulis tangan: isi awal pengaturan "Tanda Baru tampil" (BER §8: 7 hari), untuk tanda Baru HRIS
-- (permintaan owner 2026-11-01). Harus sama dengan apps/hris/modules/settings/rules/registry.ts (H18).
INSERT INTO "hris"."setting_values" (key, value, effective_from, status, reason)
VALUES ('shared.new_badge_days', '7'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3');
