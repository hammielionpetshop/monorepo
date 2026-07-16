# Backlog — Editor Role → Permission (Settings UI) · DITUNDA

**Tanggal:** 2026-07-09
**Status:** 🅿️ **DITUNDA** (dicatat agar niat tak hilang; dikerjakan setelah R6 mapan)
**Sumber:** keputusan Owner 2026-07-09 saat membahas anomali A1–A3 di
[[2026-07-09-rbac-domain-migration]]
**Scope:** `apps/backoffice` (`settings/`) + mungkin `api/bo/settings/permissions`

## Latar
Setelah R6, otorisasi tiap route memakai `requirePermission(code)`; "siapa boleh apa" hidup di tabel
`role_permissions`. Saat ini peta itu **hanya bisa diubah lewat seed/SQL**. Owner ingin bisa mengatur
akses **tanpa SQL** → butuh UI editor. **Sengaja dipisah dari R6** agar migrasi gate tak melar.

## Prasyarat
- R6 (migrasi domain) **selesai** — supaya perubahan peta benar-benar berefek ke seluruh route.
- Pertimbangkan menandai permission "sensitif" yang tak boleh dilepas dari OWNER (mis. `user.manage`,
  `branch.manage`) agar Owner tak sengaja mengunci diri.

## Sketsa item (belum dipecah final)
- **E1** — API `GET/PUT /api/bo/settings/permissions`: baca matriks `role_permissions`; PUT meng-set
  peta per role (transaksional; guard `user.manage`/OWNER). Audit log tiap perubahan.
- **E2** — Page `settings/permissions`: grid role × permission (checkbox), grouped per domain.
  Tampilkan deskripsi permission (kolom `permissions.name/description`).
- **E3** — Guard pengaman: cegah menghapus permission kritis dari OWNER; konfirmasi perubahan berisiko.
- **E4** — Invalidasi sesi: perubahan peta hanya berlaku di **login berikutnya** (JWT membawa snapshot
  permissions). Putuskan: cukup tampilkan peringatan, atau paksa re-login/refresh token.

## Catatan
- Pesan/label **Bahasa Indonesia**.
- Titik rawan E4: karena `permissions` disematkan di JWT saat login (R4), perubahan tak langsung terasa
  ke user yang sedang aktif. Ini keputusan UX yang harus dijelaskan ke Owner.
- Terkait: [[2026-07-08-rbac-permission-plumbing]], [[2026-07-09-rbac-domain-migration]].
