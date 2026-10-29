# Aturan Development Hammielion

File ini adalah sumber utama aturan development untuk semua agent. `CLAUDE.md` mengimpor
file ini; WIP, PRD, plan, dan catatan historis tidak menetapkan alur development lain.
Keputusan owner 2026-10-29 di bawah menggantikan izin lama untuk update langsung ke `main`.

## Mulai sesi

- Baca `docs/work/WIP.md` untuk fokus sekarang, lalu `docs/agents/claims.md` dari `origin/staging` terbaru untuk klaim/kunci bersama. Jalankan fetch sebelum mengandalkan remote-tracking branch; jika fetch gagal, jangan menganggap klaim lokal mutakhir.
- Periksa branch, worktree, dan perubahan yang belum di-commit. Jangan menimpa pekerjaan sesi atau agent lain.
- Baca `docs/glosarium-bisnis.md` sebelum menganalisis istilah atau aturan bisnis owner. Baca `docs/work/backlog/2026-10-11-daftar-tunda-owner.md` untuk keputusan tunda.
- Untuk pekerjaan kode, baca bagian relevan `docs/agents/project-reference.md` dan spec/plan domainnya. Dokumen referensi bukan pengganti pemeriksaan kode aktual.

## Cakupan dan konvensi

- Area utama: `apps/backoffice`; HRIS: `apps/hris` beserta package fondasinya; portal: `apps/order-web`. Kerjakan hanya domain yang diminta.
- `apps/pos-desktop` dibekukan dan dikecualikan dari build/typecheck/lint/test umum. POS aktif ada di `apps/backoffice/app/pos/`. Sentuh desktop hanya atas permintaan owner.
- Nama teknis memakai bahasa Inggris: file, folder, branch, variabel, fungsi, parameter, tipe, tabel/kolom, enum, route, dan env. Pesan error/log, label, komentar, deskripsi tes, dan dokumen memakai Bahasa Indonesia. Pengecualian nama hanya atas permintaan owner.
- Saat menyentuh kode lama bernama Indonesia, perbarui nama lokal beserta pemakainya dalam lingkup pekerjaan. Jangan merapikan massal; nama tersimpan di DB/URL/API publik dan berkas magnet memerlukan pekerjaan tersendiri.
- Kalkulasi harga/uang memakai `big.js`; nilai uang disimpan sebagai integer. Gunakan helper dan pola domain yang sudah ada.
- Tambahkan komentar hanya untuk logika yang tidak jelas. Client component memakai `'use client'`; pengambilan data awal dilakukan di server component bila sesuai pola halaman.
- Data transaksi/stok/uang tidak boleh diedit atau dihapus; kesalahan diperbaiki dengan pembatalan atau dokumen koreksi yang tercatat dan disetujui sesuai aturan bisnis.

## Branch dan staging

**Tidak boleh commit atau push langsung ke `main`**, termasuk hotfix, dokumentasi, klaim,
perubahan aturan, dan persiapan rilis. Kerja di branch terpisah dan gunakan PR untuk
integrasi ke branch bersama; jangan mengembangkan langsung di `dev_hris` atau `staging`.

| Pekerjaan | Dasar branch setelah fetch | Target PR integrasi | Berikutnya |
|---|---|---|---|
| HRIS dan langkah fondasi HRIS | `origin/dev_hris` | `dev_hris` | PR ke `staging` |
| Backoffice, portal, infra umum, dokumentasi | `origin/main` | `staging` | Uji/review di staging |
| Klaim dan pelepasan klaim/kunci | `origin/staging` | `staging` | Koordinasi sebelum implementasi |
| Rilis | `origin/main` + perubahan terpilih | `main` | Hanya setelah gerbang rilis di bawah |

- Semua perubahan melewati `staging`. Push hasil merge ke `staging` men-deploy staging; push hasil merge ke `main` dapat langsung men-deploy produksi sesuai path workflow.
- CI wajib hijau sebelum merge PR. Dokumentasi saja cukup review dan CI; perubahan aplikasi wajib dicoba di staging oleh owner.
- PR ke `staging` bisa membawa commit HRIS yang belum ada di `main` hanya bila memang bagian dari integrasi HRIS yang direncanakan; jangan membawa seluruh fitur staging sebagai dependensi perubahan kecil.
- Catatan lama yang membolehkan fix backoffice langsung ke `main` atau owner hanya mencoba sesudah produksi adalah histori, bukan izin yang masih berlaku.

## Klaim, migrasi, dan worktree

- Satu pekerjaan = satu branch = satu worktree. Bagi pekerjaan per domain vertikal (UI + API + service), sesuai peta di `docs/agents/claims.md`.
- Sebelum membuat branch implementasi, publikasikan klaim path dan kunci yang diperlukan lewat PR koordinasi `docs/claim-<work>` ke `staging`. Mulai implementasi setelah PR klaim ter-merge. Branch koordinasi boleh dibuat sebelum klaimnya sendiri terpublikasi; isinya terbatas pada klaim/kunci.
- Klaim di branch sendiri belum menjadi klaim bersama. Jika path/kunci bertabrakan, selesaikan koordinasi sebelum merge PR klaim.
- Satu pemegang kunci per aliran migrasi: `petshop`, `auth`, `logistics`, dan `hris`. Catat pemegang per aliran di papan klaim yang sama. Perubahan schema tanpa migrasi baru tetap harus tercakup klaim path; kunci penomoran diperlukan saat menambah migrasi.
- Lepas klaim/kunci lewat PR ke `staging` setelah implementasi terintegrasi ke targetnya (`dev_hris` atau `staging`). Menunggu uji owner atau produksi dicatat di WIP, bukan membiarkan klaim mati.
- Migrasi yang sudah diterapkan di staging/produksi tidak boleh diedit atau dinomori ulang; koreksi dengan migrasi baru. Jalankan `pnpm migrations:check` bila mengubah schema/migrasi.
- Tambahkan berkas magnet (`sidebar.tsx`, `lib/authz.ts`, `schema/*.ts`, dan daftar di papan klaim) hanya seperlunya; jangan sekalian mengurutkan atau merapikannya. Perubahan aturan bersama memakai PR tersendiri.
- Buat worktree dengan dasar eksplisit: `pnpm worktree:new feat/<work> --from origin/main` atau `--from origin/dev_hris` untuk HRIS. Untuk pekerjaan dokumentasi tanpa app, `git worktree add -b docs/<work> <path> <base>` cukup.
- Script pembuat worktree menulis ulang URL DB ke Postgres lokal. Jangan menyalin env produksi/staging untuk menjalankan pengembangan lokal. `--no-db` menggunakan DB lokal bersama, sehingga bukan isolasi DB.
- Sebelum cleanup, pastikan path yang benar, worktree bersih, dan commit sudah tersimpan/terintegrasi. Simpan branch/DB kecuali penghapusannya memang diminta. Baca batas script cleanup di `docs/agents/project-reference.md`; jangan memakai `--force` untuk membuang pekerjaan yang belum terintegrasi.

## Verifikasi

- Minimum perubahan kode: `pnpm typecheck` dari root (semua workspace yang dicakup script root, kecuali desktop POS).
- Jangan menjalankan suite luas secara default. Tambahkan/jalankan tes terarah untuk perilaku non-trivial, perubahan berisiko, atau permintaan eksplisit user; lint bagian relevan bila diperlukan. CI tetap menjalankan pemeriksaan lengkapnya.
- Perubahan dokumentasi saja tidak memerlukan typecheck atau tes aplikasi; periksa diff, tautan/path, dan konsistensi instruksi.
- Jalankan `pnpm changelog:check` bila mengubah fragment/rilis dan `pnpm migrations:check` bila mengubah schema/migrasi. Persyaratan uji khusus pada spec tetap berlaku.
- Laporkan pemeriksaan yang dijalankan, hasilnya, dan suite luas yang dilewati. Jangan menyatakan aplikasi teruji hanya berdasarkan typecheck.

## Changelog, status, dan rilis

- Perubahan fitur/bugfix wajib memiliki fragment Bahasa Indonesia di `apps/backoffice/changelog.d/<branch-dengan-slash-diganti-strip>.md`. Gunakan `### Added`, `### Changed`, `### Fixed`, atau `### Removed`, tanpa heading versi. Dokumentasi aturan saja tidak memerlukan fragment produk.
- Jangan mengedit `apps/backoffice/CHANGELOG.md` secara manual. `pnpm changelog:release <versi|patch|minor|major>` menghasilkan perubahan changelog/versi pada branch rilis, bukan pada `main`. Script mengambil semua fragment yang ada: kandidat rilis harus hanya berisi fragment perubahan yang disetujui.
- PR rilis hanya berisi perubahan yang sudah lolos review/CI dan disetujui owner. Catat commit/tag yang diuji, hasil uji staging, serta persetujuan eksplisit owner untuk rilis itu pada PR. Izin rilis lama tidak berlaku untuk perubahan berikutnya.
- Jangan merge seluruh `staging` ke `main` jika ada pekerjaan yang belum disetujui. Siapkan kandidat dari `main` dengan perubahan terpilih beserta dependensi/migrasinya. Jika susunannya berbeda dari yang telah diuji, uji kandidat tersebut kembali lewat PR ke `staging` sebelum merge PR rilis ke `main`. Hasil merge biasa yang masih membawa fitur lain belum membuktikan kandidat terisolasi; gunakan lingkungan staging yang menjalankan kandidat persis sebelum meluluskan rilis terpilih.
- Sebelum merge rilis, siapkan backup DB produksi sesuai runbook. Jangan menjalankan migrasi/seed/koreksi produksi dari laptop sebagai bagian verifikasi lokal; migrasi deploy berjalan lewat migrator. Seed atau koreksi data produksi adalah langkah terpisah yang harus tercantum dalam rilis dan disetujui owner.
- Daftarkan fitur baru bermenu/pilihan di `apps/backoffice/lib/new-features.ts` dan pasang `<NewBadge feature="..." />` tepat pada tambahan dalam halaman. Tanggalnya tanggal rilis produksi WIB; badge tampil 7 hari, bukan dihitung sejak tayang staging.
- WIP berisi fokus dan langkah berikutnya; papan klaim berisi penguasaan path/kunci; changelog/fragment berisi perubahan produk. Jangan membuat dokumen status baru atau mengulang aturan development di WIP. Spec, plan, dan backlog boleh menyimpan detail pekerjaannya.
- Bedakan **terintegrasi di development**, **tayang staging — menunggu uji owner**, **lolos uji owner**, dan **tayang produksi**. Rilis lama yang belum dicoba tetap **tayang produksi — menunggu uji owner**, bukan selesai. Perbarui WIP dan backlog terkait pada branch rilis sebelum PR.

## Lingkungan dan pemuatan aturan

- Staging memakai DB `petshop_staging`, role `stg_*`, rahasia sesi dan volume terpisah; OTP console. Refresh DB staging menimpa data uji dan memerlukan koordinasi serta persetujuan owner. Ikuti `infra/staging/README.md`; refresh tidak otomatis dilakukan saat deploy.
- Aturan ini tidak mengonfigurasi proteksi GitHub atau mengubah workflow. Jangan mengklaim direct push sudah ditolak secara teknis sebelum memeriksa pengaturan server.
- Codex membaca `AGENTS.md`; Claude membaca impor `@AGENTS.md` dari `CLAUDE.md`. Jangan membuat salinan aturan permanen di `AGENTS.override.md` atau `CLAUDE.local.md`, karena dapat menutupi perubahan aturan berikutnya.
- Setelah pindah branch/worktree, pastikan kedua entry point berasal dari versi aturan terbaru. Branch lama/checkout lain belum menerima perubahan sampai PR aturan terintegrasi dan branch itu disinkronkan. Jangan mengatasi aturan usang dengan commit langsung ke `main`.
