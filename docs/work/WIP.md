# WIP

Last updated: 2026-10-29
Owner: repo session state

## Current Focus

- Produk: HRIS L0a–L0e **tayang staging — menunggu uji owner**. Sesudah owner mencoba L0, langkah berikutnya L1 auth terpusat; belum dimulai.
- Backoffice: pagination Riwayat Shift **tayang staging — menunggu uji owner** (PR #34, commit `d45bb2d2`).
- Aturan/tooling: development rules sudah terintegrasi ke staging (PR #32), main (PR #33), dan branch fix shift. `AGENTS.md` menjadi sumber tunggal; `CLAUDE.md` mengimpornya.

## In Progress

- Fix shift: typecheck, review, uji browser komponen dengan API simulasi, changelog check, dan CI PR #34 lulus. Deployment staging `40838813648` hijau, tag `staging-d45bb2d2f2fff007a4ade0b2f3366e32595c4076`; tiga aplikasi sehat, gerbang anonim 401 dan job publik 404, health produksi 200. Belum ada persetujuan rilis produksi atau nomor changelog baru.
- Tidak ada implementasi HRIS L1–L9 yang dimulai pada sesi ini.
- L0 staging tersedia di `bo.staginghml.my.id`, `hris.staginghml.my.id`, `order.staginghml.my.id`; pipeline 40829443028 hijau, tag `staging-08f81aa589c94e75089c389525aec7899081b730`. Role staging terisolasi, upload terlindungi, job publik 404, heartbeat berhasil; detail di `docs/work/plans/2026-10-29-hris-l0-foundation.md`.
- Baseline produksi terakhir yang dicatat pada branch HRIS: **1.107.99**; bukan hasil pemeriksaan live sesi ini. HRIS produksi belum diaktifkan dan belum ada migrasi schema HRIS produksi.
- Beberapa fitur produksi lama masih menunggu uji owner; daftar rinci ada di backlog tunda, spec terkait, dan changelog. Jangan menyimpulkan sudah diuji dari status deploy hijau.

## Next Actions

- Owner mencoba Riwayat Shift di `https://bo.staginghml.my.id/shift-history`: buka halaman 2/3, lalu buka/tutup Estafet, Detail, dan Detail Hari; pagination harus tetap. Terapkan Filter/Reset harus kembali ke halaman awal.
- Setelah uji owner, siapkan kandidat rilis fix shift terpilih dari main, pastikan kandidat persis diuji di staging, lalu minta persetujuan rilis sebelum PR produksi.
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

- Deploy produksi PR aturan menimpa prasyarat Caddy staging. Import gerbang dan mount upload dipulihkan di server dengan backup konfigurasi pada 2026-10-29; container aplikasi/DB produksi tidak berubah. Sebelum deploy produksi berikutnya, kandidat harus mempertahankan prasyarat itu di `infra/apps/Caddyfile` dan compose agar staging tidak hilang lagi.
- WIP menyimpan status, bukan salinan aturan. Riwayat panjang WIP sebelum perapihan tersedia di Git; aturan dan izin rilis historis tidak berlaku untuk pekerjaan baru.
- Rujukan HRIS pada WIP ini adalah konteks lintas branch: buka dari `origin/dev_hris`/`origin/staging` bila file belum ada pada checkout `main`. Integrasi aturan tidak membawa kode atau aktivasi HRIS ke produksi.
- `docs/progress-tracker.md` dan `docs/outstanding-bo-tasks.md` bertanda BASI; `_bmad-output/` lokal saja.
- Koreksi `docs/koreksi-ibt-20261006-0004.sql` sudah dijalankan 2026-10-08; jangan diulang. Status koreksi shift 344 harus diperiksa sebelum tindakan produksi.
- Pelunasan piutang bukan pendapatan baru di Laba Rugi; penjualan kredit sudah diakui saat transaksi. Perubahan integrasi pelunasan harus mengikuti aturan kas/shift dan backlog terkait.
