# WIP

Last updated: 2026-10-31
Owner: repo session state

## Current Focus

- Backoffice 1.107.101: filter PO/piutang/kasir dan pagination bersama **kandidat rilis — menunggu uji owner di staging**. PR #55 menyiapkan kandidat staging; PR #56 ke main menunggu hasil uji tersebut. Izin merge main dan backup prarilis sudah tersedia.
- Produk: HRIS L0a–L0e **tayang staging — menunggu uji owner**. Sesudah owner mencoba L0, langkah berikutnya L1 auth terpusat; belum dimulai.
- Backoffice: pagination Riwayat Shift **tayang produksi 1.107.100 — uji staging owner lulus**. Fondasi HRIS ikut main atas izin owner; layanan HRIS/cron produksi tetap nonaktif.
- Aturan/tooling: development rules sudah terintegrasi ke staging (PR #32), main (PR #33), dan branch fix shift. `AGENTS.md` menjadi sumber tunggal; `CLAUDE.md` mengimpornya.

## In Progress

- Rilis 1.107.100 masuk main lewat PR #38 (`df1619f5`), sesudah persiapan staging PR #37 (`d0be34a0`). Tree kandidat identik dengan staging; tiga fragment digabung lewat script.
- CI PR dan main, typecheck root, changelog/migrations check lulus. Owner menyatakan uji shift cocok dan mengizinkan HRIS ikut main. Backup prarilis tervalidasi. Deployment produksi `40863260804` sukses; Backoffice/portal/DB healthy, health publik 200, staging anonim 401 dan job publik 404.
- Tidak ada implementasi HRIS L1–L9 yang dimulai pada sesi ini.
- L0 staging tersedia di `bo.staginghml.my.id`, `hris.staginghml.my.id`, `order.staginghml.my.id`; pipeline 40829443028 hijau, tag `staging-08f81aa589c94e75089c389525aec7899081b730`. Role staging terisolasi, upload terlindungi, job publik 404, heartbeat berhasil; detail di `docs/work/plans/2026-10-29-hris-l0-foundation.md`.
- Layanan HRIS/cron produksi belum diaktifkan. Migrasi fondasi auth/logistics/hris dan role sudah diterapkan migrator; akun koneksi aplikasi produksi tidak diganti dan tidak ada seed/koreksi data tambahan.
- Beberapa fitur produksi lama masih menunggu uji owner; daftar rinci ada di backlog tunda, spec terkait, dan changelog. Jangan menyimpulkan sudah diuji dari status deploy hijau.

## Next Actions

- Owner mencoba fondasi L0 di staging; sesudah itu susun spec/plan L1.
- Pemindahan role DB produksi (order-web lalu backoffice) dikerjakan terpisah setelah persetujuan owner berdasarkan hasil staging.
- Sebelum melanjutkan fitur produk, periksa papan klaim terbaru dan backlog tunda owner; jangan mengambil status lama sebagai klaim aktif.

## Open Decisions

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
- HRIS: `docs/hris_planning/PRD/fase_1/README.md`, `docs/work/plans/2026-10-29-hris-l0-foundation.md`.
- Perubahan produk: `apps/backoffice/CHANGELOG.md` dan fragment `apps/backoffice/changelog.d/`.
- Glosarium: `docs/glosarium-bisnis.md`; staging: `infra/staging/README.md`; perawatan server: `docs/ops/README.md`.

## Notes For New Session

- Rilis 1.107.100 sudah mempertahankan import gerbang dan mount upload staging saat deploy produksi. Konfigurasi opt-in HRIS/cron dan migrasi fondasi ikut scope yang diizinkan owner; aktivasi layanan HRIS produksi adalah pekerjaan terpisah.
- WIP menyimpan status, bukan salinan aturan. Riwayat panjang WIP sebelum perapihan tersedia di Git; aturan dan izin rilis historis tidak berlaku untuk pekerjaan baru.
- Rujukan HRIS pada WIP ini adalah konteks lintas branch: buka dari `origin/dev_hris`/`origin/staging` bila file belum ada pada checkout `main`. Integrasi aturan tidak membawa kode atau aktivasi HRIS ke produksi.
- `docs/progress-tracker.md` dan `docs/outstanding-bo-tasks.md` bertanda BASI; `_bmad-output/` lokal saja.
- Koreksi `docs/koreksi-ibt-20261006-0004.sql` sudah dijalankan 2026-10-08; jangan diulang. Status koreksi shift 344 harus diperiksa sebelum tindakan produksi.
- Pelunasan piutang bukan pendapatan baru di Laba Rugi; penjualan kredit sudah diakui saat transaksi. Perubahan integrasi pelunasan harus mengikuti aturan kas/shift dan backlog terkait.
