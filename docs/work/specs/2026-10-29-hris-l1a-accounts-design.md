---
title: 'Fondasi akun pusat HRIS L1a'
type: feature
created: '2026-10-29'
status: done
baseline_commit: d33d76d5
context:
  - docs/hris_planning/PRD/fase_1/02-auth-terpusat.md
  - docs/work/specs/2026-10-29-hris-l1-auth-design.md
---

<frozen-after-approval reason="intent owner dari plan L1 dan izin mulai implementasi">

## Intent

**Masalah:** package auth belum menyimpan akun dan tautan. Pengguna backoffice lama perlu
dipindahkan tanpa kehilangan kredensial, status, atau akses PIN.

**Pendekatan:** tambahkan model akun/tautan dan alat preflight/backfill eksplisit yang
menyalin data lama satu kali secara atomik. Tahap ini tidak mengganti login runtime.

## Batas dan kendala

**Selalu:** nama teknis Inggris, pesan/tes/dokumen Indonesia; FK hanya di schema auth;
hash password disalin persis; satu tautan per akun/app dan per id lokal/app.
Kunci migrasi auth dipublikasikan sebelum implementasi.
PIN khusus backoffice/POS; sesi HRIS idle 30 hari tetap keputusan L1 menyeluruh.

**Perlu persetujuan owner:** cutover sesi, backfill produksi, aktivasi HRIS produksi,
dan perubahan data lama untuk membereskan konflik. Tidak dilakukan pada tahap ini.

**Dilarang:** menimpa password/status pusat saat retry, membuat identifier/password palsu,
menulis petshop dari HRIS, menjalankan migrasi produksi dari laptop atau mengedit migrasi 0000.

## Matriks masukan dan tepi

| Keadaan | Hasil |
|---|---|
| Pengguna password, nonaktif, onboarding | Salin hash dan status persis; tautan backoffice |
| PIN-only tanpa email/username/password | Akun nullable dengan tautan; tetap PIN-only |
| Case/whitespace/lintas username-email bentrok | Preflight melaporkan ID; apply menolak seluruh muatan |
| Username sama email milik orang yang sama | Sah, tidak dihitung konflik |
| Akun pusat memakai identifier calon pengguna | Tolak sebelum menulis |
| Retry setelah password/status pusat berubah | Akun tertaut dilewati tanpa overwrite |
| Dua apply bersamaan | Diserialkan, tidak menduplikasi |
| Gagal insert tautan | Seluruh transaksi rollback |
| Perintah tanpa flag apply | Hanya preflight, tanpa tulis akun |

</frozen-after-approval>

## Peta kode

- packages/auth/src/schema/index.ts — ekspor schema.
- packages/auth/src/schema/accounts.ts — akun dan tautan, constraint lokal.
- packages/auth/src/migrations/ — migrasi auth 0001 dan metadata.
- packages/auth/src/backfill.mjs — fungsi preflight dan apply dari koneksi eksplisit.
- packages/auth/scripts/backfill.mjs — CLI default readonly, --apply eksplisit.
- packages/auth/package.json — perintah backfill dan dependensi postgres yang sudah dipakai repo.
- packages/db-roles/tests/auth-accounts.integration.test.mjs — tes PG nyata pada job CI yang sudah ada.

## Task dan penerimaan

- [x] Definisikan accounts dan account_links; generate SQL/snapshot/journal berurutan.
- [x] Implementasikan preflight union identifier trim/lower; keluaran hanya ID/jumlah/alasan.
- [x] Backfill dalam satu transaksi; lock sumber/tujuan agar snapshot tidak berubah,
      lalu baca ulang preflight, insert akun + tautan dan audit impor.
- [x] Jadikan backfill aman diulang, skip akun tertaut dan jangan overwrite pusat.
- [x] CLI memerlukan DATABASE_URL eksplisit tanpa otomatis membaca env repo; default readonly.
- [x] Tes DB nyata mencakup matriks, constraint, rollback dan grant auth.
- [x] Perbarui fragment, spec/plan L1 dan WIP dengan status faktual.

**Kriteria penerimaan:**
- Jika DB fondasi tersedia, ketika migrasi diterapkan, maka tabel akun/tautan muncul
  tanpa memodifikasi sesi atau pengguna petshop.
- Jika ada satu konflik, ketika apply dipanggil, maka tidak ada akun/tautan yang dibuat.
- Jika backfill pernah sukses, ketika retry setelah perubahan akun pusat, maka kredensial
  dan status pusat tetap sama.
- Jika dua proses apply berjalan, maka hasil akhirnya tepat satu akun per pengguna.
- Jika berjalan sebagai hris_app, maka petshop tetap ditolak; bo_app/hris_app dapat
  mengakses auth, order_app ditolak.

## Catatan desain

Tabel sesi, token, lockout, dan app access baru di L1b; belum diperlukan untuk backfill.
Preflight boleh memperingatkan identifier kosong pada PIN-only, tetapi tidak menghalangi impor.
Akun tanpa password belum bisa login HRIS sampai jalur resmi menetapkan password.
Akun tertaut yang identifier pusatnya berubah tetap dilewati; perubahan sah pusat bukan konflik.
Impor mendapat jejak asal (legacy backoffice user id + waktu); audit aksi akun menyeluruh di L1b.
Sampai integrasi provisioning L1c/L1d, login dan edit password lama tetap memakai petshop;
cutover wajib menjalankan rekonsiliasi terkontrol atau membangun ulang data auth percobaan,
bukan menganggap backfill awal sebagai sinkronisasi dua arah.

## Verifikasi

- pnpm typecheck — semua workspace aktif.
- pnpm migrations:check dan pnpm changelog:check.
- Tes auth terarah lewat package db-roles, DB Docker sintetis terisolasi;
  job db-migrations CI menjalankan tes yang sama.
- Uji migrasi dari fondasi 0000 dan database kosong; jalankan ulang aliran auth.
- Tidak ada perubahan UI; verifikasi runtime Next.js belum diperlukan.
- Suite luas lokal dilewati; CI wajib hijau sebelum merge.

## Riwayat perubahan spec

Diturunkan dari plan L1a sesudah owner mengizinkan mulai implementasi. Penerimaan
backfill PIN-only dirinci berdasarkan schema users aktual, tanpa mengubah keputusan owner.

Review menemukan normalisasi btrim yang hanya memangkas spasi biasa dan ringkasan status
preflight yang kurang lengkap. Patch menyamakan trim identifier dengan input login dan
melengkapi hitungan status; perilaku retry, lock, rollback dan PIN-only tetap dipertahankan.

## Penggunaan alat

Tetapkan DATABASE_URL secara eksplisit pada shell menuju database lokal terisolasi.
CLI tidak membaca berkas env repo. Jalankan:

- pnpm --filter @petshop/auth db:backfill — hanya preflight, tanpa menulis akun.
- pnpm --filter @petshop/auth db:backfill --apply — periksa ulang dalam transaksi, lalu impor.

Keluaran berisi jumlah dan ID konflik tanpa identifier pribadi/hash/token.
Kode keluar bukan nol berarti pemeriksaan atau impor ditolak. Jangan lanjutkan cutover
sebelum konflik diselesaikan melalui prosedur yang disetujui owner. Tidak ada backfill
otomatis dalam migrasi/deploy; eksekusi produksi memerlukan persetujuan terpisah.

## Hasil verifikasi dan urutan review

Typecheck root, migrations:check dan changelog:check lulus. Tes integrasi akun dan role
pada PostgreSQL 14 lokal lulus. Migrasi diuji dari DB kosong, upgrade fondasi dan pemanggilan
ulang. Suite luas lokal dilewati; CI PR tetap menjadi gerbang integrasi. Review tiga peran
selesai, dua temuan normalisasi/laporan diperbaiki dan diperiksa kembali.

- Mulai dari transaksi dan preflight agar batas mutasi terlihat.
  [backfill.mjs:1](../../../packages/auth/src/backfill.mjs#L1)
- Lihat batas unik akun/tautan dan format identifier.
  [accounts.ts:1](../../../packages/auth/src/schema/accounts.ts#L1)
- Periksa mode bawaan baca saja dan penanganan keluaran.
  [backfill.mjs:1](../../../packages/auth/scripts/backfill.mjs#L1)
- Cocokkan regresi konflik, konkurensi, rollback dan hak akses.
  [auth-accounts.integration.test.mjs:1](../../../packages/db-roles/tests/auth-accounts.integration.test.mjs#L1)
