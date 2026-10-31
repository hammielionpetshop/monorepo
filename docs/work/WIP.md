# WIP

Last updated: 2026-11-01
Owner: repo session state

## Current Focus

- Backoffice 1.107.101: filter PO/piutang/kasir dan pagination bersama **tayang produksi — uji owner lokal lulus**. PR #56 ter-merge ke main (`a60e0e60`); deploy `41173534906` sukses dan layanan sehat. Backup prarilis tervalidasi.
- Temuan pasca-uji (2026-11-01): `bo.staginghml.my.id` 500 saat cookie sesi pusat ada tanpa JWT (middleware memakai Location relatif). Diperbaiki di `middleware.ts` + tes regresi, satu deploy bersama pembaruan lain; setelah tayang, minta owner menguji ulang alur login HRIS lalu buka backoffice.
- HRIS L1 (L1c–L1f) **tayang staging dalam mode `central` — lolos uji owner**. Kandidat staging `426bea3d` (tag `staging-426bea3de3e3de…`), lingkungan staging (`bo.`/`hris.staginghml.my.id`), akun `sundus` dan `fauzan` ditautkan ke HRIS lewat fixture. Owner menyatakan hasil uji sesuai (2026-11-01) untuk langkah yang diberikan: login password HRIS, penolakan akun tanpa tautan, kelanjutan sesi backoffice lewat jembatan token, dan matriks spec L1e; rincian hasil per baris tidak dilaporkan. Jembatan staging berakhir 2026-11-02 17:50 UTC. **Produksi belum disentuh.** Backfill staging: 27 akun/27 tautan; cadangan pra-central ada di folder backups server staging.
- Produk: owner menyatakan uji L0, L1a, dan L1b lulus (2026-10-31). HRIS L1c (adapter backoffice mode legacy/central, bawaan legacy) **terintegrasi di dev_hris — belum staging, belum diuji owner**; 16 tes adapter DB lokal dan typecheck lulus. Mode `central` belum aktif di lingkungan mana pun; login lama tetap berjalan.
- Backoffice: pagination Riwayat Shift **tayang produksi 1.107.100 — uji staging owner lulus**. Fondasi HRIS ikut main atas izin owner; layanan HRIS/cron produksi tetap nonaktif.
- Aturan/tooling: development rules sudah terintegrasi ke staging (PR #32), main (PR #33), branch fix shift, dan dev_hris (PR #44). `AGENTS.md` menjadi sumber tunggal; `CLAUDE.md` mengimpornya.

## In Progress

- L1b: layanan sesi/kredensial dan migrasi auth 0002 terintegrasi ke dev_hris dan staging lewat merge lokal; typecheck, migrations/changelog check, dan 25 tes sesi lolos. 1 tes grant di `auth-accounts` tidak bisa jalan di DB lokal tanpa role aplikasi (jalur CI `db-migrations`). Klaim/kunci auth dilepas.
- Rilis 1.107.100 masuk main lewat PR #38 (`df1619f5`), sesudah persiapan staging PR #37 (`d0be34a0`). Tree kandidat identik dengan staging; tiga fragment digabung lewat script.
- CI PR dan main, typecheck root, changelog/migrations check lulus. Owner menyatakan uji shift cocok dan mengizinkan HRIS ikut main. Backup prarilis tervalidasi. Deployment produksi `40863260804` sukses; Backoffice/portal/DB healthy, health publik 200, staging anonim 401 dan job publik 404.
- Planning L1 terintegrasi ke dev_hris melalui PR #42. L1a masuk dev_hris melalui PR #45; 22 tes integrasi akun/role, typecheck dan pemeriksaan migrasi/changelog lulus. Klaim/kunci auth awal melalui PR #43.
- L0 staging tersedia di `bo.staginghml.my.id`, `hris.staginghml.my.id`, `order.staginghml.my.id`; pipeline 40829443028 hijau, tag `staging-08f81aa589c94e75089c389525aec7899081b730`. Role staging terisolasi, upload terlindungi, job publik 404, heartbeat berhasil; detail di `docs/work/plans/2026-10-29-hris-l0-foundation.md`.
- Layanan HRIS/cron produksi belum diaktifkan. Migrasi fondasi auth/logistics/hris dan role sudah diterapkan migrator; akun koneksi aplikasi produksi tidak diganti dan tidak ada seed/koreksi data tambahan.
- Beberapa fitur produksi lama masih menunggu uji owner; daftar rinci ada di backlog tunda, spec terkait, dan changelog. Jangan menyimpulkan sudah diuji dari status deploy hijau.

## Next Actions

- L1e siap di dev_hris: env auth staging (bawaan legacy), `check-env`, runbook `docs/ops/auth-pusat.md`, langkah uji owner di `docs/work/specs/2026-11-01-hris-l1e-rollout-design.md`. Sisa: integrasi dev_hris ke staging (satu push), aktifkan central di staging, uji owner matriks, dan keputusan cutover. L1d sudah terintegrasi di dev_hris (login HRIS, ganti password awal, pintu provisioning, migrasi auth 0003) — belum staging, belum diuji owner. Variabel baru: `HRIS_INTERNAL_KEY`, `INTERNAL_ALLOWED_HOSTS`; env auth juga dibutuhkan HRIS. Cutover `central` menunggu persetujuan owner; usulan: login ulang sekali, akses backoffice 30 hari, ganti password mencabut sesi lain.
- Pemindahan role DB produksi (order-web lalu backoffice) dikerjakan terpisah setelah persetujuan owner berdasarkan hasil staging.
- Sebelum melanjutkan fitur produk, periksa papan klaim terbaru dan backlog tunda owner; jangan mengambil status lama sebagai klaim aktif.

## Open Decisions

- L1 sebelum cutover: owner memutuskan (2026-11-01) jembatan token lama bertenggat (L1f, terintegrasi di dev_hris, belum staging), domain HRIS produksi `hris.hammielion.com`, sesi lain dicabut saat ganti password, dan masa stabil 30 hari. Masih terbuka: umur sesi BO sesudah JWT habis. PIN hanya BO/POS serta HRIS idle 30 hari sudah diputuskan.
- Penanggung minus kas per shift POS sebelum HRIS L4; kolom per kasir bukan sumber yang sudah tersedia.
- Proteksi GitHub dan penguncian gerbang CI/deploy belum dikonfigurasi/diverifikasi dalam pekerjaan aturan ini.

## Deferred / Parked

- Promo P5 (grooming gratis makanan pilihan) belum dimulai; `docs/work/backlog/2026-10-12-promo-otomatis.md`.
- Rekonsiliasi stok/batch lama dan tindak lanjut hitung fisik: `docs/work/backlog/2026-10-03-hasil-rekonsiliasi-stok.md`.
- Keputusan tunda/bahas owner, termasuk kebijakan kas pembayaran hutang internal: `docs/work/backlog/2026-10-11-daftar-tunda-owner.md`. Jangan mengangkat kembali hal yang sengaja ditunda sebelum owner membukanya.
- Validasi cetak pada perangkat asli, konfigurasi OTP sungguhan/WAHA, dan pemeriksaan data produk oleh admin masih memerlukan pihak terkait; cek ulang status sebelum bertindak.
- Temuan Juli (seed permission/RBAC, integrasi kas pelunasan, audit pembayaran supplier, dan polish portal) belum diaudit ulang pada sesi ini; jangan menganggapnya pekerjaan baru atau fakta produksi saat ini. Rujukan: `docs/work/plans/2026-07-13-rbac-manual-role-matrix-verification.md` dan backlog terkait.

## Source Of Truth

- Aturan development: `AGENTS.md`; entry point Claude: `CLAUDE.md`; referensi teknis: `docs/agents/project-reference.md`.
- Klaim/kunci/peta domain: `docs/agents/claims.md` dari staging terbaru.
- Dokumen kerja: `docs/work/README.md`, `docs/work/{specs,plans,backlog}/`.
- HRIS: `docs/hris_planning/PRD/fase_1/README.md`, `docs/work/plans/2026-10-29-hris-l1-auth.md`, `docs/work/specs/2026-10-29-hris-l1a-accounts-design.md`.
- Perubahan produk: `apps/backoffice/CHANGELOG.md` dan fragment `apps/backoffice/changelog.d/`.
- Glosarium: `docs/glosarium-bisnis.md`; staging: `infra/staging/README.md`; perawatan server: `docs/ops/README.md`.

## Notes For New Session

- Rilis 1.107.100 sudah mempertahankan import gerbang dan mount upload staging saat deploy produksi. Konfigurasi opt-in HRIS/cron dan migrasi fondasi ikut scope yang diizinkan owner; aktivasi layanan HRIS produksi adalah pekerjaan terpisah.
- WIP menyimpan status, bukan salinan aturan. Riwayat panjang WIP sebelum perapihan tersedia di Git; aturan dan izin rilis historis tidak berlaku untuk pekerjaan baru.
- Rujukan HRIS pada WIP ini adalah konteks lintas branch: buka dari `origin/dev_hris`/`origin/staging` bila file belum ada pada checkout `main`. Integrasi aturan tidak membawa kode atau aktivasi HRIS ke produksi.
- `docs/progress-tracker.md` dan `docs/outstanding-bo-tasks.md` bertanda BASI; `_bmad-output/` lokal saja.
- Koreksi `docs/koreksi-ibt-20261006-0004.sql` sudah dijalankan 2026-10-08; jangan diulang. Status koreksi shift 344 harus diperiksa sebelum tindakan produksi.
- Pelunasan piutang bukan pendapatan baru di Laba Rugi; penjualan kredit sudah diakui saat transaksi. Perubahan integrasi pelunasan harus mengikuti aturan kas/shift dan backlog terkait.
