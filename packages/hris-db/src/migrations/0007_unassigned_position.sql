-- Ditulis tangan (spec L2g §3): jabatan pengganti "kosong". Tanpa hak selain atas diri sendiri; diganti lewat Catat Penempatan.
INSERT INTO "hris"."positions" ("name", "department_id", "high_rights", "full_access")
SELECT 'Belum ditentukan', d.id, false, false FROM "hris"."departments" d WHERE lower(d.name) = 'team gudang'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "hris"."position_grants" ("position_id", "action", "scope")
SELECT p.id, g.action, g.scope::"hris"."access_scope"
FROM "hris"."positions" p
CROSS JOIN (VALUES
  ('profile.view', 'SELF'),
  ('contact.update_own', 'SELF'),
  ('identity_change.request', 'SELF'),
  ('own_account.manage', 'SELF'),
  ('extra_rights.view', 'SELF'),
  ('report_guide.view', 'ALL'),
  ('login_history.view_own', 'SELF')
) AS g(action, scope)
WHERE lower(p.name) = 'belum ditentukan'
ON CONFLICT DO NOTHING;
