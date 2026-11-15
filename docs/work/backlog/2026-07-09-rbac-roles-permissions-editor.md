# Backlog — Editor Role → Permission (Settings UI)

**Tanggal:** 2026-07-09 · **Diaktifkan:** 2026-07-13
**Status:** 🟢 **SIAP DIKERJAKAN** — prasyarat R6 (M1–M8) sudah **SELESAI** (CHANGELOG `1.49.0`–`1.56.0`).
Sebelumnya ditunda; kini masuk fokus aktif bersama verifikasi manual RBAC & integrasi kas piutang.
**Sumber:** keputusan Owner 2026-07-09 saat membahas anomali A1–A3 di
[[2026-07-09-rbac-domain-migration]]
**Scope:** `apps/backoffice` (`settings/`) + `api/bo/settings/permissions`

## Latar
Setelah R6, otorisasi tiap route memakai `requirePermission(code)`; "siapa boleh apa" hidup di tabel
`role_permissions`. Saat ini peta itu **hanya bisa diubah lewat seed/SQL**. Owner ingin bisa mengatur
akses **tanpa SQL** → butuh UI editor. **Sengaja dipisah dari R6** agar migrasi gate tak melar.

## Prasyarat
- [x] R6 (migrasi domain) **selesai** — perubahan peta kini benar-benar berefek ke seluruh route
      (semua gate `_ROLES` literal sudah hilang dari `app/api/bo/**`).
- [ ] **Urutan yang disarankan: jalankan [`verifikasi manual matriks role`](../plans/2026-07-13-rbac-manual-role-matrix-verification.md) LEBIH DULU.**
      Alasan: editor ini membuat peta permission jadi **bergerak**. Kalau baseline-nya sendiri belum
      pernah diverifikasi di runtime, bug otorisasi akan sulit dibedakan antara "salah seed sejak awal"
      vs "salah diubah lewat editor". Verifikasi dulu = titik nol yang tepercaya.
- [ ] Pertimbangkan menandai permission "sensitif" yang tak boleh dilepas dari OWNER (mis. `user.manage`,
      `branch.manage`) agar Owner tak sengaja mengunci diri.

## Konteks terbaru (audit 2026-07-13)
Katalog seed kini **29 kode / 71 baris `role_permissions`** (M6 menambah `internal_transfer.approve`).
Editor harus membaca katalog dari **DB**, bukan hardcode — `PERMISSION_CATALOG` di
`packages/db/src/seed/permissions.ts` tetap jadi sumber kebenaran untuk *bootstrap*, tapi setelah editor
aktif, **DB yang menang**. Putuskan sadar: apakah seed idempotent tetap boleh menambah baris yang sudah
sengaja dicabut Owner lewat editor? (Risiko: seed "menghidupkan lagi" akses yang dicabut manual.)

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
