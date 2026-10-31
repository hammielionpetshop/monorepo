# Aturan Development Hammielion

File ini adalah sumber utama aturan development untuk semua agent. `CLAUDE.md` mengimpor
file ini; WIP, PRD, plan, dan catatan historis tidak menetapkan alur development lain.
Keputusan owner 2026-10-31 menetapkan integrasi staging secara lokal dan PR untuk main;
larangan update langsung ke `main` tetap berlaku.

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
perubahan aturan, dan persiapan rilis. Pengembangan tetap di branch/worktree terpisah;
jangan mengembangkan fitur langsung di `dev_hris` atau `staging`. Checkout `staging`
lokal hanya dipakai untuk menggabungkan hasil pekerjaan dan menyelesaikan konflik integrasi.

| Pekerjaan | Dasar branch setelah fetch | Integrasi | Berikutnya |
|---|---|---|---|
| HRIS dan langkah fondasi HRIS | `origin/dev_hris` | Merge lokal ke `dev_hris`, alur di [hris-local-integration.md](docs/agents/hris-local-integration.md) | Merge lokal ke `staging` saat integrasi HRIS direncanakan |
| Backoffice, portal, infra umum, dokumentasi | `origin/main` | Merge lokal ke `staging` | Push hasil gabungan, lalu uji/review di staging |
| Klaim dan pelepasan klaim/kunci | `origin/staging` | Merge lokal ke `staging` | Push batch koordinasi; klaim harus terpublikasi sebelum implementasi |
| Rilis | `origin/main` + perubahan terpilih | Kandidat melalui staging, lalu PR ke `main` | Hanya setelah gerbang rilis di bawah |

- Integrasi ke `staging` dilakukan secara lokal, tanpa PR ke staging. Setelah fetch, periksa worktree bersih dan sinkronkan staging lokal dengan `origin/staging` sebelum menggabungkan branch yang termasuk batch integrasi.
- Selesaikan seluruh merge lokal dalam batch, konflik, review diff gabungan, dan pemeriksaan yang relevan sebelum push. Jangan push staging setiap satu branch selesai di-merge. Jika remote staging bergerak selama integrasi, fetch dan periksa kembali hasil gabungannya sebelum push; jangan force-push.
- Setelah seluruh merge lokal dan pemeriksaannya selesai, push `staging` sekali untuk batch tersebut. Push ini men-deploy staging. Batch koordinasi klaim dipublikasikan sebelum pekerjaan implementasinya dimulai.
- Setelah deploy staging berhasil dan perubahan aplikasi lolos uji owner, buat PR rilis ke `main`. Uji owner boleh dilakukan pada kandidat staging lokal atau deployment staging, dengan kode kandidat rilis yang sama; catat commit/tag, lingkungan uji, dan hasilnya. CI wajib hijau sebelum merge PR. Dokumentasi saja cukup review dan CI; gerbang backup dan persetujuan rilis tetap mengikuti bagian rilis di bawah.
- Semua perubahan melewati `staging`; merge PR ke `main` dapat langsung men-deploy produksi sesuai path workflow. Jangan menggabungkan pekerjaan yang belum disetujui ke kandidat produksi.
- Merge lokal ke `staging` bisa membawa commit HRIS yang belum ada di `main` hanya bila memang bagian dari integrasi HRIS yang direncanakan; jangan membawa seluruh fitur staging sebagai dependensi perubahan kecil.
- Catatan lama yang membolehkan fix backoffice langsung ke `main` atau owner hanya mencoba sesudah produksi adalah histori, bukan izin yang masih berlaku.

## Klaim, migrasi, dan worktree

- Satu pekerjaan = satu branch = satu worktree. Bagi pekerjaan per domain vertikal (UI + API + service), sesuai peta di `docs/agents/claims.md`.
- Sebelum membuat branch implementasi, publikasikan klaim path dan kunci yang diperlukan melalui branch koordinasi `docs/claim-<work>` yang digabung lokal ke `staging`. Mulai implementasi setelah batch koordinasi selesai di-push dan klaim tersedia di `origin/staging`. Branch koordinasi boleh dibuat sebelum klaimnya sendiri terpublikasi; isinya terbatas pada klaim/kunci.
- Klaim di branch sendiri atau staging lokal yang belum di-push belum menjadi klaim bersama. Jika path/kunci bertabrakan, selesaikan koordinasi sebelum menggabungkan dan memublikasikan klaim.
- Satu pemegang kunci per aliran migrasi: `petshop`, `auth`, `logistics`, dan `hris`. Catat pemegang per aliran di papan klaim yang sama. Perubahan schema tanpa migrasi baru tetap harus tercakup klaim path; kunci penomoran diperlukan saat menambah migrasi.
- Lepas klaim/kunci melalui branch koordinasi yang digabung lokal ke `staging` dan di-push bersama batch koordinasinya setelah implementasi terintegrasi ke targetnya (`dev_hris` atau `staging`). Menunggu uji owner atau produksi dicatat di WIP, bukan membiarkan klaim mati.
- Migrasi yang sudah diterapkan di staging/produksi tidak boleh diedit atau dinomori ulang; koreksi dengan migrasi baru. Jalankan `pnpm migrations:check` bila mengubah schema/migrasi.
- Tambahkan berkas magnet (`sidebar.tsx`, `lib/authz.ts`, `schema/*.ts`, dan daftar di papan klaim) hanya seperlunya; jangan sekalian mengurutkan atau merapikannya. Perubahan aturan bersama memakai branch dokumentasi tersendiri dan mengikuti alur integrasi staging lokal, lalu PR ke main.
- Buat worktree dengan dasar eksplisit: `pnpm worktree:new feat/<work> --from origin/main` atau `--from origin/dev_hris` untuk HRIS. Untuk pekerjaan dokumentasi tanpa app, `git worktree add -b docs/<work> <path> <base>` cukup.
- Script pembuat worktree menulis ulang URL DB ke Postgres lokal. Jangan menyalin env produksi/staging untuk menjalankan pengembangan lokal. `--no-db` menggunakan DB lokal bersama, sehingga bukan isolasi DB.
- Sebelum cleanup, pastikan path yang benar, worktree bersih, dan commit sudah tersimpan/terintegrasi. Simpan branch/DB kecuali penghapusannya memang diminta. Baca batas script cleanup di `docs/agents/project-reference.md`; jangan memakai `--force` untuk membuang pekerjaan yang belum terintegrasi.

## Efisiensi kerja dan kuota

- Gunakan alur paling singkat yang memenuhi aturan: satu batch integrasi staging dan satu PR ke main untuk satu lingkup pekerjaan. Jangan membuat PR ke staging atau memecah perubahan menjadi PR administratif tambahan tanpa kebutuhan koordinasi nyata. Publikasi klaim sebelum implementasi tetap wajib.
- Baca hanya dokumen dan bagian kode yang relevan; jangan membaca ulang sumber yang belum berubah atau mengulang investigasi yang hasilnya sudah tersedia. Gabungkan pemeriksaan independen dalam satu pemanggilan tool bila memungkinkan.
- Jalankan pemeriksaan lokal yang relevan sekali pada kandidat akhir. Ulangi hanya bila kode terkait berubah, pemeriksaan gagal, atau ada bukti masalah baru; perubahan dokumentasi/status tidak mengharuskan pengulangan tes aplikasi yang sudah lulus.
- Hindari push bertahap yang memicu CI/deploy berulang. Siapkan seluruh perubahan satu batch sebelum push; jangan memicu ulang pipeline yang masih berjalan atau sudah lulus tanpa alasan baru.
- Periksa status CI/deploy hanya pada gerbang keputusan (sebelum merge atau saat memastikan deployment selesai), atau atas permintaan owner. Jika masih berjalan, gunakan notifikasi atau tunggu dengan jeda wajar; jangan melakukan polling rapat atau berulang tanpa kebutuhan tindakan.
- Jangan menambah alat, dependensi, suite tes, dokumen status, atau lapisan koordinasi hanya untuk membuktikan pekerjaan sederhana. Laporkan hasil dan batasan secara ringkas; jangan meminta ulang izin atau hasil uji yang sudah diberikan owner untuk kandidat yang sama.

## Verifikasi

- Minimum perubahan kode: `pnpm typecheck` dari root sekali pada kandidat akhir (semua workspace yang dicakup script root, kecuali desktop POS).
- Verifikasi UI dilakukan langsung oleh owner pada kandidat staging lokal atau deployment staging. Konfirmasi owner cukup sebagai bukti uji UI; catat kandidat, lingkungan, skenario yang dikonfirmasi, dan hasil yang benar-benar diberikan. Jangan mengarang detail uji atau meminta owner mengulang uji kandidat yang sama tanpa perubahan perilaku terkait.
- Agent tidak menambah atau menjalankan automated testing UI, browser automation, E2E, atau tes interaksi komponen sebagai syarat penyelesaian, kecuali owner secara eksplisit memintanya. Berikan langkah uji singkat bila diperlukan, lalu tunggu hasil owner sebelum meluluskan gerbang UI. Typecheck dan CI tidak menggantikan uji owner.
- Untuk logika non-UI (misalnya kalkulasi uang, otorisasi, API, atau migrasi), tambahkan/jalankan tes terarah hanya untuk perilaku non-trivial atau berisiko; lint bagian relevan bila diperlukan. Jangan menjalankan suite luas secara lokal secara default. CI yang sudah dikonfigurasi tetap berlaku; aturan ini tidak menghapus tes atau mengubah workflow CI.
- Perubahan dokumentasi saja tidak memerlukan typecheck atau tes aplikasi; periksa diff, tautan/path, dan konsistensi instruksi.
- Jalankan `pnpm changelog:check` bila mengubah fragment/rilis dan `pnpm migrations:check` bila mengubah schema/migrasi. Persyaratan uji non-UI khusus pada spec tetap berlaku; aturan uji UI di atas mengatasi instruksi automated testing UI pada spec, plan, atau skill.
- Laporkan pemeriksaan yang dijalankan, hasilnya, dan suite luas yang dilewati. Jangan menyatakan aplikasi teruji hanya berdasarkan typecheck.

## Changelog, status, dan rilis

- Perubahan fitur/bugfix wajib memiliki fragment Bahasa Indonesia di `apps/backoffice/changelog.d/<branch-dengan-slash-diganti-strip>.md`. Gunakan `### Added`, `### Changed`, `### Fixed`, atau `### Removed`, tanpa heading versi. Dokumentasi aturan saja tidak memerlukan fragment produk.
- Jangan mengedit `apps/backoffice/CHANGELOG.md` secara manual. `pnpm changelog:release <versi|patch|minor|major>` menghasilkan perubahan changelog/versi pada branch rilis, bukan pada `main`. Script mengambil semua fragment yang ada: kandidat rilis harus hanya berisi fragment perubahan yang disetujui.
- PR rilis hanya berisi perubahan yang sudah lolos review/CI dan disetujui owner. Catat commit/tag yang diuji, lingkungan dan hasil uji owner (kandidat staging lokal atau deployment staging), serta persetujuan eksplisit owner untuk rilis itu pada PR. Izin rilis lama tidak berlaku untuk perubahan berikutnya.
- Jangan merge seluruh `staging` ke `main` jika ada pekerjaan yang belum disetujui. Siapkan kandidat dari `main` dengan perubahan terpilih beserta dependensi/migrasinya. Jika susunannya berbeda dari yang telah diuji, integrasikan kandidat lewat alur merge lokal staging, selesaikan seluruh merge dan pemeriksaan batch sebelum push, lalu uji kembali sebelum membuat dan menggabungkan PR rilis ke `main`. Hasil merge biasa yang masih membawa fitur lain belum membuktikan kandidat terisolasi; gunakan lingkungan staging lokal atau deployment staging yang menjalankan kandidat persis sebelum meluluskan rilis terpilih.
- Sebelum merge rilis, siapkan backup DB produksi sesuai runbook. Jangan menjalankan migrasi/seed/koreksi produksi dari laptop sebagai bagian verifikasi lokal; migrasi deploy berjalan lewat migrator. Seed atau koreksi data produksi adalah langkah terpisah yang harus tercantum dalam rilis dan disetujui owner.
- Daftarkan fitur baru bermenu/pilihan di `apps/backoffice/lib/new-features.ts` dan pasang `<NewBadge feature="..." />` tepat pada tambahan dalam halaman. Tanggalnya tanggal rilis produksi WIB; badge tampil 7 hari, bukan dihitung sejak tayang staging.
- WIP berisi fokus dan langkah berikutnya; papan klaim berisi penguasaan path/kunci; changelog/fragment berisi perubahan produk. Jangan membuat dokumen status baru atau mengulang aturan development di WIP. Spec, plan, dan backlog boleh menyimpan detail pekerjaannya.
- Bedakan **terintegrasi di development**, **tayang staging — menunggu uji owner**, **lolos uji owner**, dan **tayang produksi**. Rilis lama yang belum dicoba tetap **tayang produksi — menunggu uji owner**, bukan selesai. Perbarui WIP dan backlog terkait pada branch rilis sebelum PR.

## Lingkungan dan pemuatan aturan

- Staging memakai DB `petshop_staging`, role `stg_*`, rahasia sesi dan volume terpisah; OTP console. Refresh DB staging menimpa data uji dan memerlukan koordinasi serta persetujuan owner. Ikuti `infra/staging/README.md`; refresh tidak otomatis dilakukan saat deploy.
- Aturan ini tidak mengonfigurasi proteksi GitHub atau mengubah workflow. Jangan mengklaim direct push sudah ditolak secara teknis sebelum memeriksa pengaturan server.
- Codex membaca `AGENTS.md`; Claude membaca impor `@AGENTS.md` dari `CLAUDE.md`. Jangan membuat salinan aturan permanen di `AGENTS.override.md` atau `CLAUDE.local.md`, karena dapat menutupi perubahan aturan berikutnya.
- Setelah pindah branch/worktree, pastikan kedua entry point berasal dari versi aturan terbaru. Branch lama/checkout lain belum menerima perubahan sampai PR aturan terintegrasi dan branch itu disinkronkan. Jangan mengatasi aturan usang dengan commit langsung ke `main`.
