# Integrasi Lokal HRIS

Aturan ini **hanya** berlaku untuk pekerjaan `apps/hris` dan package fondasinya
(`packages/auth`, `packages/db-roles`, dan sejenisnya). Pekerjaan di luar HRIS
(backoffice, portal, infra umum, dokumentasi) tetap mengikuti tabel di
[AGENTS.md](../../AGENTS.md#branch-dan-staging). Aturan lain di `AGENTS.md`
(klaim, migrasi, verifikasi, changelog, larangan commit/push ke `main`) tetap berlaku.

## Alur

1. Fetch, lalu pastikan `dev_hris` lokal sinkron dengan `origin/dev_hris` dan sudah
   menarik `origin/main` terbaru (isinya hanya yang sudah rilis). Aturan dan papan klaim
   dibaca dari `origin/staging`, tidak perlu di-merge. Merge `staging` ke `dev_hris` hanya
   bila memang butuh perubahan yang belum ada di `main`; jangan membawa fitur non-HRIS
   yang belum disetujui rilis ke `dev_hris`.
2. Kerjakan di worktree sendiri dari `origin/dev_hris`:
   `pnpm worktree:new feat/<work> --from origin/dev_hris`.
3. Selesaikan pekerjaan dan jalankan pemeriksaan sesuai bagian Verifikasi `AGENTS.md`
   sekali pada kandidat akhir. Commit di branch pekerjaan.
4. Merge lokal ke `dev_hris` tanpa PR. Worktree `dev_hris` harus bersih.
5. Merge lokal `dev_hris` ke `staging` saat integrasi HRIS direncanakan.
6. Selesaikan seluruh merge dalam batch, periksa diff gabungan, lalu push `dev_hris`
   dan `staging` sekali untuk batch itu. Jangan force-push. Jika remote bergerak,
   fetch dan periksa ulang hasil gabungannya sebelum push.

## Klaim dan kunci

- Publikasikan klaim path/kunci lebih dulu lewat branch `docs/claim-<work>` yang digabung
  lokal ke `staging` dan di-push sebelum implementasi dimulai.
- Lepas klaim/kunci lewat batch koordinasi setelah pekerjaan terintegrasi ke `dev_hris`.

## Batas

- Jangan commit atau push langsung ke `main`. Rilis ke `main` tetap lewat PR dan
  gerbang rilis di `AGENTS.md`, dan kode HRIS hanya ikut atas izin owner.
- Jangan mengembangkan fitur langsung di `dev_hris` atau `staging`; checkout keduanya
  hanya untuk menggabungkan hasil dan menyelesaikan konflik.
- Pekerjaan yang menyentuh HRIS dan non-HRIS sekaligus dipisah per branch; bagian
  non-HRIS mengikuti jalurnya sendiri.
- Push `staging` men-deploy staging, jadi satu batch koordinasi atau integrasi = satu push.
