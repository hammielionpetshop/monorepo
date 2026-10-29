# WIP

Last updated: 2026-10-29
Owner: repo session state

## Current Focus

- Produk: HRIS L0a–L0e **tayang staging — menunggu uji owner**. Sesudah owner mencoba L0, langkah berikutnya L1 auth terpusat; belum dimulai.
- Backoffice: pagination Riwayat Shift **lolos uji owner — rilis 1.107.100 disetujui**. Owner juga mengizinkan fondasi HRIS ikut main pada 2026-10-29; layanan HRIS produksi tetap opt-in.
- Aturan/tooling: development rules sudah terintegrasi ke staging (PR #32), main (PR #33), dan branch fix shift. `AGENTS.md` menjadi sumber tunggal; `CLAUDE.md` mengimpornya.

## In Progress

- Kandidat `release/staging-2026-10-29` mengambil snapshot staging `bb8fdca2` beserta fix shift yang diuji owner (`686399fd`, setelah integrasi produk `d45bb2d2`). Runtime aplikasi sama dengan staging; perubahan persiapan rilis hanya changelog/status. Tiga fragment digabung lewat script menjadi 1.107.100.
- Typecheck, review, uji browser komponen fix shift dengan API simulasi, dan CI staging lulus. Persetujuan owner: uji shift sudah cocok, minta merge main, dan mengizinkan HRIS ikut main. Backup produksi dibuat dan diverifikasi; periksa hasil CI kandidat dan deployment sebelum menyatakan tayang produksi.
- Tidak ada implementasi HRIS L1–L9 yang dimulai pada sesi ini.
- L0 staging tersedia di `bo.staginghml.my.id`, `hris.staginghml.my.id`, `order.staginghml.my.id`; pipeline 40829443028 hijau, tag `staging-08f81aa589c94e75089c389525aec7899081b730`. Role staging terisolasi, upload terlindungi, job publik 404, heartbeat berhasil; detail di `docs/work/plans/2026-10-29-hris-l0-foundation.md`.
- HRIS produksi belum diaktifkan. Migrasi fondasi auth/logistics/hris dan role yang sudah diuji staging akan diterapkan migrator saat deploy rilis ini; akun koneksi aplikasi produksi tidak diganti dan tidak ada seed/koreksi data tambahan.
- Beberapa fitur produksi lama masih menunggu uji owner; daftar rinci ada di backlog tunda, spec terkait, dan changelog. Jangan menyimpulkan sudah diuji dari status deploy hijau.

## Next Actions

- Integrasikan persiapan rilis ke staging setelah CI hijau, lalu merge PR rilis 1.107.100 ke main dengan bukti uji/persetujuan owner dan backup produksi. Pantau deployment serta health produksi dan staging.
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

- Kandidat 1.107.100 menyertakan import gerbang dan mount upload staging yang sebelumnya dipulihkan di server, sehingga deploy main mempertahankan akses staging. Konfigurasi opt-in HRIS/cron dan migrasi fondasi ikut scope yang diizinkan owner; aktivasi layanan HRIS produksi adalah pekerjaan terpisah.
- WIP menyimpan status, bukan salinan aturan. Riwayat panjang WIP sebelum perapihan tersedia di Git; aturan dan izin rilis historis tidak berlaku untuk pekerjaan baru.
- Rujukan HRIS pada WIP ini adalah konteks lintas branch: buka dari `origin/dev_hris`/`origin/staging` bila file belum ada pada checkout `main`. Integrasi aturan tidak membawa kode atau aktivasi HRIS ke produksi.
- `docs/progress-tracker.md` dan `docs/outstanding-bo-tasks.md` bertanda BASI; `_bmad-output/` lokal saja.
- Koreksi `docs/koreksi-ibt-20261006-0004.sql` sudah dijalankan 2026-10-08; jangan diulang. Status koreksi shift 344 harus diperiksa sebelum tindakan produksi.
- Pelunasan piutang bukan pendapatan baru di Laba Rugi; penjualan kredit sudah diakui saat transaksi. Perubahan integrasi pelunasan harus mengikuti aturan kas/shift dan backlog terkait.
