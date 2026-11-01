# changelog.d HRIS — potongan changelog

Sama dengan `apps/backoffice/changelog.d/` (baca README di sana untuk format), tetapi untuk HRIS.
Setiap branch yang mengubah HRIS menulis **satu file** `changelog.d/<branch-dengan-slash-diganti-strip>.md`
berisi `### Added|Changed|Fixed|Removed` dan butir berbahasa pengguna. `pnpm changelog:check` gagal bila
branch HRIS belum punya potongannya. Isinya tampil di halaman HRIS **Apa yang baru** (bagian "Sedang diuji")
sampai dirilis dengan `pnpm changelog:release <versi> --app hris`.

Menu atau bagian halaman baru juga didaftarkan di `lib/new-features.ts` supaya bertanda **Baru**.
