# Legacy migrations (arsip pra-baseline)

Berisi migrasi lama (SQL bernama-tanggal + `meta/` journal drizzle-kit yang
sudah usang) dari sebelum **baseline 2026-07-03**.

Per 2026-07-03 riwayat migrasi di-**baseline ulang**: schema Drizzle sudah
diverifikasi sinkron 1:1 dengan DB produksi (58 tabel, 491 kolom, 16 index),
lalu di-squash menjadi satu baseline tunggal di
`packages/db/src/migrations/0000_baseline.sql`. Produksi ditandai sudah berada
di baseline itu (row di `drizzle.__drizzle_migrations`) tanpa eksekusi ulang.

File di folder ini **tidak dipakai lagi** oleh `drizzle-kit` (di luar `out` dir)
dan hanya disimpan sebagai catatan historis SQL yang pernah diterapkan manual.
Migrasi baru cukup lewat `pnpm --filter @petshop/db db:generate` + `db:migrate`.
