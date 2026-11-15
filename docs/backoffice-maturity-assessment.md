# Analisis Maturitas Backoffice Hammielion

Tanggal analisis: 2026-06-08

Lingkup: `apps/backoffice`

## Ringkasan Eksekutif

`apps/backoffice` sudah cukup matang sebagai **internal MVP / beta
operasional**. Sistem ini bukan prototype kosong: cakupan fiturnya luas,
domain bisnisnya nyata, dan banyak alur operasional sudah tersedia untuk
backoffice maupun Web POS.

Namun, sistem ini belum siap disebut **production-grade** karena fondasi
keamanan, otorisasi, quality gate, dokumentasi, dan pengujian belum setara
dengan kedalaman fiturnya.

Skor maturitas keseluruhan: **6/10**.

Kesimpulan utama:

> Fitur cukup matang, tetapi fondasi keamanan dan quality gate belum matang.

## Metode Penilaian

Analisis dilakukan terhadap struktur aplikasi, route API, UI, service layer,
auth/session, dokumentasi, changelog, dan hasil verifikasi build/lint/LSP.

Aktivitas yang dilakukan:

- Membaca struktur `apps/backoffice`.
- Meninjau `package.json`, `README.md`, `middleware.ts`, `CHANGELOG.md`, dan
  struktur route `app/`.
- Meninjau contoh route matang dan route berisiko tinggi.
- Menjalankan pemeriksaan build, lint, dan diagnostics.
- Menggabungkan temuan arsitektur, UI/UX, dan backend/API.

## Skor Per Area

- **Cakupan fitur: 8/10**  
  Modul luas: dashboard, master data, inventory, purchase order, retur, shift,
  reports, audit log, settings, dan Web POS.
- **Struktur aplikasi: 7/10**  
  App Router cukup rapi, pemisahan dashboard/POS/API jelas, dan sudah ada
  service layer untuk domain kompleks.
- **Business logic: 6.5/10**  
  Ada FIFO stock, batch stock, PO receiving/reversal, retur, reports HPP, dan
  owner PIN. Konsistensi validasi dan transaksi belum merata.
- **UI/UX operasional: 6.5/10**  
  Core flow usable, banyak empty/error/success state. Mobile nav, tabel
  responsif, modal, active nav, dan polish masih perlu ditingkatkan.
- **Auth/session: 4/10**  
  Risiko utama: fallback JWT secret, token dikembalikan dalam JSON, cookie
  HTTP-only tidak diset di login route, refresh token belum punya lifecycle
  jelas.
- **Authorization/branch isolation: 4.5/10**  
  Beberapa route masih percaya `role`, `createdById`, dan `branchId` dari
  client. Branch scoping belum konsisten.
- **API robustness: 5/10**  
  Ada route matang, tetapi banyak route mutasi belum konsisten memakai auth,
  Zod, transaksi DB, dan error shape Bahasa Indonesia.
- **Tooling/verifikasi: 4/10**  
  Build berhasil, tetapi lint pipeline rusak dan LSP diagnostics tidak berjalan.
- **Test coverage: 2/10**  
  Tidak terlihat test suite yang melindungi flow kritikal.
- **Dokumentasi: 2/10**  
  README masih default Next.js dan belum menjelaskan sistem backoffice.

## Kekuatan Sistem

### 1. Cakupan Modul Sudah Luas

Backoffice memiliki banyak area operasional yang relevan untuk bisnis petshop:

- Dashboard.
- Master data produk, kategori, brand, dan satuan ukur.
- Inventory: stock adjustment, stock logs, adjustment logs, stock opname.
- Purchase orders: daftar, create, detail, approval, receiving, reversal.
- Retur.
- Reports: profit-loss dan stock valuation.
- Settings: users dan branches.
- Audit log.
- Shift history.
- Web POS: branch selection, login, shift gate, product search, cart,
  checkout, customer search, expenses, settlement, receiving, dan history.

Ini menunjukkan aplikasi sudah melewati tahap proof-of-concept.

### 2. Struktur App Router Cukup Jelas

Struktur folder sudah mengikuti pemisahan domain yang dapat dipahami:

- `app/(dashboard)` untuk halaman admin/backoffice.
- `app/pos` untuk Web POS.
- `app/api/auth` untuk autentikasi.
- `app/api/bo` untuk API backoffice.
- `app/api/pos` untuk API POS.
- `app/api/products` dan `app/api/customers` untuk API public/search.

Library pendukung juga sudah mulai terpusat:

- `lib/auth.ts`.
- `lib/db.ts`.
- `lib/auth-cache.ts`.
- `lib/pos-branch.ts`.
- `lib/services/*`.

### 3. Ada Business Logic Nyata

Beberapa domain sudah memiliki logika bisnis yang cukup dalam:

- FIFO stock dan batch stock.
- Stock opname dengan approval dan row locking.
- Purchase order receiving dan reversal.
- Retur.
- Laporan profit-loss dengan fallback HPP.
- Owner PIN dan guard untuk perubahan tertentu.
- Validasi cabang pada beberapa alur.

Contoh route yang lebih matang ditemukan pada alur stock opname approval:

- Auth berbasis cookie.
- Role check.
- Branch check.
- Validasi parameter.
- Row lock.
- Transaksi DB.
- Mapping domain error.

Ini bisa dijadikan pola standar untuk route lain.

### 4. Changelog Aktif

`apps/backoffice/CHANGELOG.md` aktif dan menunjukkan aplikasi terus berkembang.
Versi terbaru yang ditemukan adalah `1.2.7` pada `2026-06-08`.

Isi changelog memperlihatkan banyak perbaikan operasional, termasuk:

- PO receiving reversal endpoint.
- Retur cancel.
- Stock adjustment FIFO batch/cost input.
- Multi-UOM auto pricing.
- Default cost price.
- Profit-loss default HPP fallback.
- Stock logs.
- Branch isolation.
- Web POS fixes.

## Risiko Utama

### 1. Auth dan Session Belum Production-Grade

Temuan berisiko:

- `lib/auth.ts` masih punya fallback JWT secret jika environment variable tidak
  tersedia.
- `app/api/auth/login/route.ts` mengembalikan `accessToken` dan `refreshToken`
  lewat JSON.
- Login route tidak menyetel cookie HTTP-only secara langsung.
- `permissions` pada JWT masih `[]` dengan komentar TODO.
- Refresh token dibuat, tetapi lifecycle refresh/revoke belum jelas.

Dampak:

- Risiko konfigurasi deployment lemah.
- Token lebih mudah terekspos ke client-side JavaScript.
- Permission model terlihat belum selesai.
- Session invalidation dan refresh flow belum kuat.

### 2. Otorisasi API Belum Konsisten

Beberapa route mutasi masih mempercayai data otorisasi dari request body atau
query, bukan dari JWT/server session.

Contoh berisiko:

- `app/api/bo/purchase-orders/route.ts` mempercayai `role`, `createdById`, dan
  `branchId` dari body.
- `app/api/bo/purchase-orders/[id]/approve/route.ts` mempercayai `body.role`.
- Beberapa route POS belum punya auth/branch/device boundary yang kuat.

Dampak:

- Client berpotensi memalsukan role atau actor ID.
- Branch isolation bisa bocor jika tidak dikunci dari token/session.
- Approval atau mutasi high-impact bisa dieksekusi tanpa trust boundary yang
  benar.

### 3. API Robustness Tidak Merata

Ada route yang matang, tetapi ada juga route yang masih prototype-grade.

Risiko yang ditemukan:

- Validasi Zod belum konsisten di semua route mutasi.
- Sebagian route masih mengembalikan pesan error Bahasa Inggris.
- Beberapa route menampilkan raw error ke response 500.
- Beberapa write flow multi-step belum jelas memakai transaksi DB.
- POS sync belum terlihat punya idempotency/replay protection yang kuat.

Route yang perlu perhatian awal:

- `/api/bo/purchase-orders/**`.
- `/api/pos/sync/batch`.
- `/api/pos/transactions`.
- `/api/pos/shifts/**`.
- `/api/pos/open-bills/**`.
- `/api/pos/heartbeat`.

### 4. Branch Isolation Belum Menjadi Primitive Bersama

Branch scoping sudah ada di sebagian tempat, tetapi belum menjadi aturan
terpusat yang konsisten.

Sistem membutuhkan helper bersama seperti:

- `requireAuth()`.
- `requireRole()`.
- `requireBranchScope()`.
- `requireOwnerOrAllowedBranch()`.

Tanpa primitive bersama, tiap route berisiko mengimplementasikan otorisasi
dengan cara berbeda.

### 5. Tooling Quality Gate Bermasalah

Hasil verifikasi:

- `pnpm --filter backoffice build` berhasil compile dan generate routes.
- `pnpm --filter backoffice lint` gagal karena error tooling/config.
- `lsp_diagnostics apps/backoffice` gagal karena TypeScript LSP exit dengan
  code `-4058`.

Error lint yang ditemukan:

```text
Cannot read properties of undefined (reading 'allowShortCircuit')
```

Error berasal dari rule `@typescript-eslint/no-unused-expressions`, kemungkinan
karena mismatch versi ESLint 9 dan `@typescript-eslint`.

Dampak:

- Build berhasil, tetapi lint tidak bisa dijadikan quality gate.
- Diagnostics TypeScript dari LSP tidak tersedia.
- Error source code bisa lolos lebih lama karena gate otomatis tidak sehat.

### 6. Test Coverage Belum Terlihat

Tidak ditemukan sinyal test suite yang melindungi flow kritikal.

Area yang seharusnya diproteksi dengan regression tests:

- POS transaction create.
- FIFO stock deduction.
- Offline sync behavior.
- Purchase order approval.
- Purchase order receiving dan reversal.
- Retur dan cancel retur.
- Stock adjustment.
- Stock opname approval.
- Branch isolation.
- User role and permission boundaries.

### 7. Dokumentasi Belum Mewakili Sistem

`apps/backoffice/README.md` masih default create-next-app dan menyebut instruksi
generik, termasuk port default yang tidak sesuai konteks proyek.

Dokumentasi yang belum tersedia:

- Overview backoffice.
- Setup environment.
- Auth/session model.
- Role dan permission model.
- Branch isolation rules.
- API conventions.
- POS sync behavior.
- Operational runbook.
- Testing dan deployment notes.

## Temuan UI/UX

### Area yang Sudah Cukup Kuat

- Dashboard sudah memakai data nyata dan refresh.
- Master data produk cukup kaya, termasuk price tiers dan UOM conversions.
- Reports memiliki validasi, totals, dan export-oriented behavior.
- Web POS memiliki alur kasir yang cukup lengkap.
- Banyak halaman sudah punya empty state, error state, success state, dan
  refresh-after-mutation.

### Area yang Perlu Dipoles

- Sidebar dashboard tersembunyi di mobile tanpa replacement navigation yang
  jelas.
- Active nav state belum konsisten.
- Campuran `Link` dan raw `<a>`.
- Masih ada emoji icon di beberapa UI.
- Destructive confirmation belum konsisten, beberapa masih memakai
  `window.confirm`.
- Table-heavy layout berisiko buruk di mobile.
- Loading state belum universal.
- Aksesibilitas ada di beberapa modal/alert, tetapi belum konsisten.

## Temuan Backend/API

### Route yang Menunjukkan Pola Matang

Contoh terbaik adalah route stock opname approval:

- Auth dari cookie.
- Role dan branch check.
- Validasi parameter.
- Row-level lock.
- Transaksi DB.
- Domain error mapping.

Pola ini sebaiknya dijadikan standar semua route mutasi penting.

### Route yang Perlu Hardening

Prioritas tinggi:

1. `app/api/bo/purchase-orders/route.ts`.
2. `app/api/bo/purchase-orders/[id]/approve/route.ts`.
3. `app/api/pos/sync/batch/route.ts`.
4. `app/api/pos/transactions/route.ts`.
5. `app/api/pos/open-bills/route.ts`.
6. `app/api/pos/shifts/[id]/settle/route.ts`.
7. `app/api/pos/heartbeat/route.ts`.

Masalah umum pada route tersebut:

- Auth tidak eksplisit atau tidak konsisten.
- Actor, role, atau branch dipercaya dari client.
- Validasi body/query/params belum lengkap.
- Error handling belum sesuai standar Bahasa Indonesia.
- Transaksi DB belum selalu digunakan pada multi-write flow.

## Status Verifikasi

### Build

Perintah:

```bash
pnpm --filter backoffice build
```

Hasil:

- Compile berhasil.
- Static generation selesai.
- Route list berhasil dihasilkan.
- Build tetap memunculkan error lint internal, tetapi proses build selesai.

### Lint

Perintah:

```bash
pnpm --filter backoffice lint
```

Hasil:

- Gagal dengan exit code `2`.
- Penyebab: error tooling/config pada rule `@typescript-eslint/no-unused-expressions`.
- Ini bukan bukti source lint bersih atau kotor; lint gate sedang tidak sehat.

### LSP Diagnostics

Target:

```text
apps/backoffice
```

Hasil:

- Tidak tersedia.
- TypeScript LSP exit dengan code `-4058`.

## Rekomendasi Prioritas

### Prioritas 0: Hardening Trust Boundary

Perbaikan paling mendesak:

1. Hapus fallback JWT secret di `lib/auth.ts`.
2. Login route harus menyetel cookie HTTP-only dari server.
3. Jangan kembalikan access/refresh token ke JSON response kecuali ada alasan
   eksplisit dan aman.
4. Implementasikan lifecycle refresh token atau hapus refresh token sementara.
5. Isi permissions dari DB atau keluarkan claim `permissions` sampai modelnya
   siap.

### Prioritas 1: Shared Authz Primitive

Buat helper bersama untuk semua API route:

- `requireAuth()` untuk mengambil dan memverifikasi session.
- `requireRole(allowedRoles)` untuk role gate.
- `requireBranchScope()` untuk memastikan branch request sesuai session.
- `requireJson()` untuk validasi content type pada mutasi JSON.
- Error helper untuk response `{ error: string }` dalam Bahasa Indonesia.

Setelah itu, migrasikan route high-risk terlebih dahulu.

### Prioritas 2: Purchase Order dan POS API Hardening

Urutan hardening yang disarankan:

1. Purchase order create/list/approve.
2. POS transaction create.
3. POS sync batch.
4. POS open bills.
5. POS shift settlement.
6. POS heartbeat.

Prinsipnya:

- Actor selalu dari JWT/session.
- Branch selalu dari JWT/session atau cabang terotorisasi.
- Role tidak pernah dari body.
- Multi-write flow wajib dalam transaksi DB.
- State transition harus atomic.
- Error response wajib konsisten.

### Prioritas 3: Pulihkan Quality Gate

Perbaiki mismatch ESLint dan `@typescript-eslint` agar:

```bash
pnpm --filter backoffice lint
pnpm typecheck
```

bisa menjadi gate yang dipercaya.

Setelah itu, aktifkan kembali pemeriksaan yang sebelumnya dilemahkan secara
bertahap, terutama `no-explicit-any` pada area backend kritikal.

### Prioritas 4: Tambah Regression Tests untuk Flow Kritikal

Minimal test yang disarankan:

- Auth login dan cookie/session behavior.
- Role enforcement untuk route BO.
- Branch isolation untuk route BO dan POS.
- PO create/approve/receive/reverse.
- POS transaction stock deduction FIFO.
- Offline sync idempotency.
- Shift settlement atomicity.
- Retur cancel dan stock restoration.

### Prioritas 5: Dokumentasi Operasional

Ganti README default dengan dokumentasi backoffice yang menjelaskan:

- Tujuan aplikasi.
- Modul utama.
- Setup environment.
- Script development.
- Auth/session model.
- Role dan permission model.
- Branch isolation.
- API conventions.
- Deployment notes.
- Known risks.

## Roadmap Production Readiness

### Fase 1: Security Baseline

- Hapus fallback secret.
- Server-set HTTP-only cookie.
- Shared auth/authz helper.
- Migrasi route high-risk.
- Standardisasi error response.

### Fase 2: Data Integrity Baseline

- Audit semua multi-write route.
- Pastikan transaksi DB pada write flow kompleks.
- Perkuat PO state transition.
- Perkuat POS sync idempotency.
- Pastikan branch isolation di semua query sensitif.

### Fase 3: Quality Gate Baseline

- Perbaiki lint pipeline.
- Perbaiki LSP/typecheck diagnostics.
- Tambah regression tests untuk flow kritikal.
- Kurangi `any` di service dan API route high-risk.

### Fase 4: UX dan Operasional

- Mobile navigation untuk dashboard.
- Table responsiveness.
- Konsistensi modal dan destructive confirmation.
- Active nav state.
- Dokumentasi operator dan admin.

## Penilaian Akhir

`apps/backoffice` punya fondasi fitur yang kuat dan sudah mencakup banyak
kebutuhan operasional. Secara product surface, sistem ini terlihat jauh lebih
maju daripada prototype.

Namun, kematangan production bukan hanya jumlah fitur. Untuk sistem backoffice
yang menangani stok, transaksi, purchase order, shift, dan laporan keuangan,
trust boundary harus jauh lebih ketat.

Status saat ini paling tepat disebut:

> Internal MVP/beta yang feature-rich dan aktif berkembang, tetapi perlu
> hardening auth, authorization, branch isolation, API consistency, testing, dan
> tooling sebelum dianggap production-grade.
