# WIP

Last updated: 2026-10-11
Owner: repo session state

## Status 2026-10-11 (baca ini dulu)

Versi tayang: **1.107.58**. Push ke `main` yang menyentuh `apps/`, `packages/`, `infra/apps`
atau `pnpm-lock.yaml` = langsung deploy ke toko (`.github/workflows/deploy-vps.yml`).
Perubahan `docs/` saja tidak memicu deploy.

**Tayang belakangan ini (belum semuanya diuji di layar toko):**

| Versi | Isi | Dokumen |
|---|---|---|
| 1.107.55 | Hutang Supplier (halaman, catat bayar, jatuh tempo dari termin supplier) | [`specs/2026-10-10-hutang-supplier-design.md`](specs/2026-10-10-hutang-supplier-design.md) |
| 1.107.56 | Alur PO baru (tahap PO, harga menyusul / menunggu faktur, batalkan input penerimaan) | [`specs/2026-10-10-alur-po-baru-design.md`](specs/2026-10-10-alur-po-baru-design.md) |
| 1.107.58 | Retur ke Supplier + saldo supplier (migrasi 0031) — belum diuji di layar sebelum rilis | [`specs/2026-10-10-retur-supplier-design.md`](specs/2026-10-10-retur-supplier-design.md) |
| 1.107.57 | Estafet shift: rekap hari di struk shift 2, kotak Shift Ditutup dikunci, Riwayat Shift digabung | [`specs/2026-10-11-estafet-shift-design.md`](specs/2026-10-11-estafet-shift-design.md) |


**Belum dikerjakan / menggantung:**

- `docs/koreksi-ibt-20261006-0004.sql` — koreksi stok Gudang, **belum dijalankan** di produksi.
- [`backlog/2026-10-03-hasil-rekonsiliasi-stok.md`](backlog/2026-10-03-hasil-rekonsiliasi-stok.md)
  — ratusan pasangan produk/cabang stok ringkas ≠ rincian batch; usulan hitung ulang fisik.
- Klaim `docs/usulan-laporan` (Codex) basi: kodenya sudah tayang (1.107.31), dua dokumen
  rencananya tidak pernah masuk repo.
- `docs/progress-tracker.md` & `docs/outstanding-bo-tasks.md` basi (April 2026) — jangan jadi acuan.

**Istilah bisnis owner:** [`../glosarium-bisnis.md`](../glosarium-bisnis.md) — baca dulu.

**Direncanakan (bertahap, dibahas 2026-10-11):** Retur Internal & Revisi Harga Beli ➡️ [`specs/2026-10-11-retur-internal-design.md`](specs/2026-10-11-retur-internal-design.md) · backlog RI0–RI9 [`backlog/2026-10-11-retur-internal.md`](backlog/2026-10-11-retur-internal.md)

**Aturan kerja yang berlaku (owner bukan programmer):** analisa & jelaskan risiko dulu,
kerja di branch, jalankan typecheck/lint/test/`changelog:check`/`migrations:check`, uji di DB
lokal salinan prod, owner coba di laptop, push ke `main` hanya dengan izin per perubahan,
backup DB produksi sebelum rilis. Fitur baru → dokumen desain di `docs/work/specs/`;
migrasi baru → ambil kunci di `docs/agents/claims.md` lebih dulu.

---

## Arsip status 2026-07-13

> Bagian di bawah ini tidak diperbarui sejak Juli; status tiap butir perlu dicek ulang.

### Current Focus (Juli)

Tiga pekerjaan, hasil audit backlog menyeluruh 2026-07-13. Semua inisiatif besar (#1 RBAC, #2 Staff
Dashboard, #3 Customer Order Portal C0–C5) **sudah selesai di kode** — yang tersisa adalah
**verifikasi, kontrol akses, dan satu lubang akuntansi**.

1. **🔴 Verifikasi manual matriks otorisasi per role** — satu-satunya kriteria RBAC R6 yang masih terbuka.
   ➡️ [`plans/2026-07-13-rbac-manual-role-matrix-verification.md`](plans/2026-07-13-rbac-manual-role-matrix-verification.md)
2. **🟢 Editor Role → Permission di Settings** — prasyarat (R6) sudah beres, tak lagi ditunda.
   ➡️ [`backlog/2026-07-09-rbac-roles-permissions-editor.md`](backlog/2026-07-09-rbac-roles-permissions-editor.md)
3. **🔴 Pelunasan piutang masuk kas & rekonsiliasi shift** — ditunda sejak 2026-07-03, masih terbuka.
   ➡️ [`backlog/2026-07-13-debt-payment-cash-integration.md`](backlog/2026-07-13-debt-payment-cash-integration.md)

**Urutan yang disarankan: 1 → 2 → 3.** Verifikasi (1) dulu karena editor (2) membuat peta permission
jadi bergerak — tanpa baseline yang tepercaya, bug otorisasi tak bisa dibedakan antara salah-seed dan
salah-edit. Item (3) independen, boleh diparalelkan bila ada kapasitas.

## Temuan Kritis yang Belum Ditindaklanjuti

Dua hal ini muncul saat audit dan **berpotensi merusak produksi**. Baca sebelum mulai apa pun.

### 🚨 Seed permission kemungkinan belum dijalankan ulang setelah M6

M6 menambah kode permission **baru** `internal_transfer.approve`. `permissions` di JWT diisi saat login
dari tabel `role_permissions`. **Bila seed belum dijalankan ulang ke DB, approve/batalkan Transfer
Internal akan 403 untuk SEMUA role — termasuk OWNER.**

```bash
pnpm --filter @petshop/db db:seed-permissions   # idempotent, aman diulang
```

Ekspektasi setelah seed: **29 permission / 71 baris** `role_permissions` (OWNER 29, GM 26, MANAGER 11,
GUDANG 2, FINANCE 2, KASIR 1). Detail + query verifikasi ada di dokumen verifikasi (fokus #1, bagian P0).

Semua user juga **wajib login ulang** — `permissions` & `branchScope` disematkan di JWT saat login.

### 🚨 Pelunasan piutang JANGAN dimasukkan ke Laba Rugi

Framing lama keliru. `getProfitLossReport` menghitung omzet dari `SUM(transactions.payableAmount)` untuk
semua transaksi `COMPLETED` **tanpa memandang metode bayar** → penjualan kredit **sudah diakui sebagai
omzet saat penjualan** (akrual). Menambahkan pelunasan sebagai pendapatan = **omzet dobel-hitung**.

Yang bocor **hanya sumbu kas**: arus kas + rekonsiliasi shift. P&L jangan disentuh. Sudah dikunci sebagai
keputusan di backlog fokus #3.

## Selesai (audit 2026-07-13)

| Inisiatif | Status |
|---|---|
| Bulk Sale enhancements (B1–B7) | ✅ `1.37.1` |
| Harga Gudang + IBT→Bulk Sale (G1–G9) | ✅ s/d `1.47.0` |
| Manajemen satuan inline di grid harga | ✅ `1.41.0` |
| **#1** RBAC permission-level (R1–R5, M1–M8) | ✅ `1.48.0`–`1.56.0` — *kecuali uji manual (fokus #1)* |
| **#2** Staff dashboard & onboarding (S1–S8) | ✅ `1.57.0`–`1.64.0` |
| **#3** Customer Order Portal (C0–C5) | ✅ s/d `1.70.0` |
| Surat Jalan dot-matrix (QZ Tray) | ✅ `1.73.0`–`1.75.0` — *validasi printer fisik pending* |
| Owner Approval & Barang Rusak | ✅ void async inbox, fix celah auth, kerugian masuk P&L |

Checkbox di backlog staff-dashboard, bulk-sale, dan rbac-domain-migration sudah disinkronkan dengan
commit pada audit ini (sebelumnya tertinggal tak tercentang meski kode sudah merge).

## Menunggu Pihak Lain / Non-Koding

Bukan pekerjaan agent — butuh akses akun, perangkat fisik, atau keputusan Owner.

- **C6 Deployment Order Portal** — sisi repo ✅ selesai (`vercel.json`, workflow CI, `infra/waha/`).
  Sisanya manual: project Vercel + domain `order.hammielion.com`, WAHA di server + scan QR nomor toko,
  verifikasi OTP sungguhan. ➡️ [`specs/2026-07-10-order-web-deployment-runbook.md`](specs/2026-07-10-order-web-deployment-runbook.md)
- **Validasi Surat Jalan di printer dot-matrix asli** — kode siap, belum pernah dicetak di perangkat nyata.
- **`koreksi-admin-gudang.csv`** (245 baris) — 86 produk baru, 125 modal kosong, 21 ratio MEO/PUSSBITE
  perlu cek fisik. Tindak lanjut admin.
- **Daftar produk base GRAM yang sebenarnya 500gr** — menunggu Owner.

## Deferred / Parked

- **C7 — Polish Order Portal** (fast-follow, prioritas rendah): notifikasi WA saat order dikonfirmasi/
  ditolak, upload foto produk. ➡️ [`backlog/2026-07-08-customer-order-portal.md`](backlog/2026-07-08-customer-order-portal.md) §C7
- **Audit pembayaran hutang supplier** — apakah punya lubang kas serupa (uang **keluar** tanpa entri kas)?
  Belum diperiksa; ditangani sebagai bagian dari fokus #3 (D1).

## Source Of Truth

- Struktur dan aturan dokumen kerja: `docs/work/README.md`
- Backlog aktif: `docs/work/backlog/` · Plans: `docs/work/plans/` · Specs: `docs/work/specs/`
- `_bmad-output/` = lokal-only, **bukan** sumber kebenaran.

## Notes For New Session

- Untuk "apa WIP sekarang?" → baca file ini dulu, jangan menjelajah backlog penuh.
- Sebelum menyentuh RBAC apa pun: baca dua Temuan Kritis di atas.
- Setiap perubahan fitur/bugfix **wajib** update `apps/backoffice/CHANGELOG.md` (lihat `CLAUDE.md`).
  Perubahan dokumen kerja saja (seperti audit ini) **tidak** perlu entri CHANGELOG.
