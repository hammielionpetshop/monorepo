<!-- markdownlint-disable MD013 MD024 -->

# Changelog

## [1.66.0] - 2026-07-10

### Added
- **Scaffold `apps/order-web` (Inisiatif #3 — C1).** App Next.js 15 baru & terpisah untuk Customer Order Portal (`order.hammielion.com`), dev port `7070`. Bundle **tidak** membawa kode admin backoffice.
  - Wiring `@petshop/db` & `@petshop/shared` (workspace deps), Tailwind v4 + Lucide, konvensi config sama dengan `apps/backoffice` (tsconfig, eslint, postcss).
  - **JWT customer terpisah**: `lib/customer-auth.ts` (`signCustomerToken`/`verifyCustomerToken`, `jose` HS256, secret `CUSTOMER_JWT_SECRET` — beda dari `JWT_SECRET` staff, exp 7d). Tipe `CustomerJWTPayload` baru di `@petshop/shared`.
  - **Middleware auth**: proteksi semua route kecuali `/login` & `/api/auth/*`; cookie `customerToken` tidak valid/absen → redirect `/login` (halaman) atau 401 (API).
  - Halaman placeholder `/` & `/login`; UI login OTP sungguhan menyusul di C2.
  - Env baru terdaftar di `turbo.json` globalEnv: `CUSTOMER_JWT_SECRET`, `ORDER_BRANCH_ID`, `OTP_PROVIDER`, `OTP_TTL_SECONDS`, `FONNTE_TOKEN`.

## [1.65.0] - 2026-07-10

### Added
- **Fondasi Customer Order Portal (Inisiatif #3 — C0).** Skema & shared untuk portal order self-service customer (`order.hammielion.com`); belum ada UI/API — hanya fondasi DB & abstraksi OTP.
  - **Schema baru** `packages/db/src/schema/customer_portal.ts`: `customer_auth` (kredensial login E.164), `customer_otp_codes` (hash argon2 + TTL + rate-limit), `customer_orders` (order PENDING → CONFIRMED/REJECTED/CANCELLED, `estimatedTotal` indikatif, `convertedTransactionId`, `sourceOrderId` guard konversi), `customer_order_items` (snapshot nama/harga **indikatif** — harga final ditentukan staff saat konfirmasi).
  - **Kolom baru** `customers.defaultTierType` (varchar20 default `RETAIL`) & `customers.canOrderOnline` (bool default false, gate whitelist owner); `products.imageUrl` (varchar500 nullable, foto katalog); `transactions.sourceOrderId` (integer cross-ref ke `customer_orders`, analog `sourceIbtId`, plain integer untuk hindari circular import).
  - **Abstraksi OTP** `packages/shared/src/otp/`: interface `OtpChannel`, `ConsoleOtpChannel` (dev — OTP di-log), factory `createOtpChannel(OTP_PROVIDER)` (provider produksi Fonnte/WA Cloud menyusul di C2).
  - Migrasi `0006_salty_wolf_cub.sql`.

## [1.64.0] - 2026-07-10

### Added
- **Dashboard `/staff`: widget per-peran dengan data nyata (Inisiatif #2 — S8, menutup inisiatif).** Service baru `lib/services/staff-service.ts` — semua query **dibatasi ke cabang user** (`payload.branchId`), **tanpa omzet/laba GLOBAL**:
  - **MANAGER** → status shift cabang hari ini, jumlah transaksi selesai hari ini, omzet hari ini (cabang sendiri, tanpa laba kotor), PO menunggu approval.
  - **GUDANG** → stock opname menunggu, transfer internal berjalan, PO menunggu penerimaan.
  - **FINANCE** → piutang pelanggan belum lunas, hutang internal belum lunas.
  - Kartu widget bisa diklik menuju halaman terkait; kondisi hitung selaras dengan badge navigasi (nav-badges). OWNER/GM tetap melihat `/staff` read-only (banner + arahan ke `/dashboard`). Placeholder statis S7 diganti.

## [1.63.0] - 2026-07-10

### Added
- **Manajemen user: username wajib, kredensial default, & reset (Inisiatif #2 — S6).**
  - Create user (`POST api/bo/settings/users`): `username` **wajib & unik** (huruf/angka/`._-`); `password` & `pin` kini **opsional** — bila dikosongkan diambil dari default `app_settings`. Keduanya di-hash argon2. User baru di-set `must_change_credentials=true` (wajib onboarding). Duplikat username → 409.
  - Edit user (`PATCH api/bo/settings/users/[id]`): `username` bisa diubah (unik, exclude diri sendiri). Aksi baru `resetCredentials: true` → set password & PIN ke default, `must_change_credentials=true`, `credentials_set_at=null` (paksa onboarding ulang).
  - Form user: field **Username** (wajib, create & edit); saat create, **Password/PIN Awal** pre-fill dari default (fetch `/api/bo/settings/security`) & bisa diedit/dikosongkan; saat edit, tombol **Reset kredensial ke default** (dengan konfirmasi). Tabel daftar user kini menampilkan kolom **Username**.

### Changed
- Pesan duplikat pada create/edit user kini menyebut username (`Username sudah digunakan`, dan fallback `Username, email, atau nomor staf sudah digunakan`).

## [1.62.0] - 2026-07-10

### Added
- **Settings › Keamanan: OWNER kelola default kredensial staf (Inisiatif #2 — S5).**
  - Route baru `api/bo/settings/security` (GET/PUT) — baca & ubah `default_password` / `default_pin` di `app_settings`. Guard `requirePermission('user.manage')` (OWNER-only); non-OWNER → 403. PUT validasi (password min 6, PIN 4–6 digit), simpan `updated_by = userId`.
  - Halaman baru `app/(dashboard)/settings/security` — form OWNER ubah default password & PIN, dengan toggle tampil/sembunyi dan peringatan keamanan. Guard halaman via `hasPermission('user.manage')` (non-OWNER lihat pesan akses ditolak).
  - Helper `lib/app-settings.ts`: tambah `setSetting(key, value, updatedBy)` (upsert `onConflictDoUpdate`).
  - Sidebar: tambah menu **Keamanan** (grup Pengaturan, `roles: ['OWNER']`) — melengkapi item tertunda dari S7.

## [1.61.0] - 2026-07-10

### Added
- **First-login onboarding: paksa ganti password + buat PIN (Inisiatif #2 — S4).**
  - Route baru `api/auth/onboarding` (POST, butuh auth): validasi `onboardingSchema`, **tolak bila `newPassword`/`newPin` == default** (dibaca dari `app_settings`), hash argon2 ke `password_hash`/`pin_hash`, set `must_change_credentials=false` + `credentials_set_at=now()`, lalu **re-issue accessToken** (`mustChangeCredentials=false`) agar gerbang langsung terbuka tanpa login ulang.
  - Halaman baru `app/(auth)/onboarding/page.tsx`: form password baru + konfirmasi, PIN baru + konfirmasi (4–6 digit angka); konfirmasi dicek di klien, redirect ke landing per-peran setelah sukses.
  - `middleware.ts`: gerbang first-login berprioritas tertinggi setelah auth — `mustChangeCredentials && path != '/onboarding'` → redirect `/onboarding`. Anti-loop: `/api/auth/*` sudah publik dan `/onboarding` dikecualikan.
  - Helper baru `lib/app-settings.ts` (`getSetting`, `getDefaultCredentials`) — ditarik lebih awal dari S5 karena onboarding perlu membaca default kredensial untuk menolak nilai == default. Ada fallback bila seed terlewat.

## [1.60.0] - 2026-07-10

### Added
- **Login backoffice mode `bo`: email atau username, password atau PIN (Inisiatif #2 — S3).** Route `api/auth/login` kini menangani `mode:'bo'` — resolver `identifier` → `WHERE (email = ? OR username = ?) AND is_active`, **tanpa** `staff_number` (staf POS-only tak bisa masuk BO). Verifikasi argon2 ke `password_hash` **atau** `pin_hash` sesuai `credentialType`. Error generik `"Kredensial salah"` (tak membocorkan apakah identifier valid). JWT kini menyertakan `mustChangeCredentials` (semua mode) untuk gerbang onboarding S4. `loginBoSchema` digabung ke `loginSchema` union.
  - **Mode `staff_pin` & `email_password` tidak berubah** — `email_password` sengaja dipertahankan karena web-POS (`app/pos/login`) masih memakainya.
  - Verifikasi manual (dev server + user uji sementara): login bo via email/username × password/PIN → 200; password salah → 401; POS-only via staff_number → 401; JWT membawa `mustChangeCredentials:true`; regresi `staff_pin`/`email_password` → 200. `typecheck` backoffice hijau.

## [1.59.0] - 2026-07-10

### Added
- **Shared schemas untuk login BO generik & onboarding (Inisiatif #2 — S2).** Di `@petshop/shared`:
  - `loginBoSchema` (`mode:'bo'`, `identifier`, `credential`, `credentialType: 'password'|'pin'`) — fondasi login backoffice via email **atau** username, dengan password **atau** PIN. `credential` hanya divalidasi non-empty (verifikasi sebenarnya via argon2 agar kredensial legacy tak tertolak). **Sengaja belum digabung ke `loginSchema`** — penggabungan union ditunda ke S3 agar atomik dengan penulisan ulang route login.
  - `onboardingSchema` (`newPassword` min 6, `newPin` regex 4–6 digit) untuk first-login gate.
  - `JWTPayload.mustChangeCredentials?: boolean` — penanda first-login onboarding (opsional agar additif; token lama tanpa field ini → falsy → tak dipaksa). Diisi login di S3.
  - Schema/type POS (`loginStaffPinSchema`) **tidak berubah**. `typecheck` shared + backoffice hijau.

## [1.58.0] - 2026-07-10

### Added
- **Fondasi kredensial staf & pengaturan aplikasi (Inisiatif #2 — S1).** Migrasi `0005_curvy_ikaris`:
  - Tabel baru `petshop.app_settings` (key PK, value, updated_at, updated_by→users) — penyimpanan key-value pengaturan global. Di-seed `default_password=password123` & `default_pin=123456` (default kredensial staf; plaintext by design agar OWNER bisa menyampaikan ke staf, dapat diubah via Settings › Keamanan nanti di S5).
  - Kolom baru `users`: `username` (varchar 50, unique) untuk login BO via email **atau** username; `must_change_credentials` (boolean, default true) sebagai gerbang first-login onboarding; `credentials_set_at` (timestamp) penanda waktu ganti kredensial.
  - **Backfill:** seluruh akun eksisting di-set `must_change_credentials=false` — akun lama tidak dipaksa onboarding, hanya user baru yang wajib.
  - Verifikasi: migrasi jalan, 9 user eksisting ter-backfill, seed masuk, `typecheck @petshop/db` hijau. Fondasi untuk S2–S6 (login resolver, onboarding, settings security, users create/edit).

## [1.57.1] - 2026-07-10

### Changed
- **Login backoffice kini mengarahkan per peran, tidak lagi hardcode `/dashboard` (Inisiatif #2 — S7, lanjutan).** Setelah login sukses, redirect ditentukan dari `role`: OWNER/GM → `/dashboard`, MANAGER/GUDANG/FINANCE → `/staff`, KASIR → `/pos`. Sebelumnya semua peran didorong ke `/dashboard` lalu dipantulkan middleware ke `/staff`; sekarang tujuan sudah benar sejak awal (menghilangkan satu bounce redirect & ketergantungan pada jaring pengaman middleware). Guard middleware tetap dipertahankan sebagai lapis kedua.

## [1.57.0] - 2026-07-10

### Security
- **Tutup kebocoran data: `/dashboard` (omzet & laba kotor global) kini hanya untuk OWNER/GM (Inisiatif #2 — S7, sebagian).** Sebelumnya MANAGER/GUDANG/FINANCE bisa mendarat & mengakses `/dashboard` dan melihat omzet + laba global. Middleware kini: (a) guard `/dashboard` → non-(OWNER/GM) di-redirect ke `/staff`; (b) landing GUDANG/FINANCE saat login diarahkan ke `/staff`, bukan `/dashboard`; (c) `/staff` masuk daftar path backoffice sehingga KASIR tetap diarahkan ke `/pos`.

### Added
- **Halaman `/staff` (placeholder Dashboard Staff).** Sapaan per peran + pratinjau widget yang akan datang (MANAGER: shift & transaksi cabang; GUDANG: opname/transfer pending; FINANCE: piutang & pembayaran). **Sengaja tanpa omzet/laba global.** OWNER/GM boleh membuka (read-only). Widget rinci menyusul di S8.
- Link "Dashboard" di sidebar kini mengarah ke `/staff` untuk MANAGER/GUDANG/FINANCE (OWNER/GM tetap `/dashboard`).

## [1.56.0] - 2026-07-10

### Changed
- **Verifikasi menyeluruh & DoD RBAC R6 selesai (M8).** Seluruh gerbang otorisasi `app/api/bo/**` kini permission-level — **nol konstanta role** (`_ROLES`/`ALLOWED_*`/`GLOBAL_ROLES`) tersisa di server gate.
  - **Transaksi**: `transactions` (list, `[trxNumber]`, `[trxNumber]/detail`, `[trxNumber]/void-request`) dimigrasi dari `verifyAccessToken` + `isPrivileged = ['OWNER','GM']` → `getAuth()` + `branchScope === 'ALL'`. Menutup role-literal scope terakhir di API. **Parity** (privileged lihat semua cabang, lainnya cabang sendiri).
  - **Sengaja dibiarkan (terdaftar di backlog):** (a) `purchase-orders/[id]/approve` ambang PO > Rp5jt (`role !== 'OWNER'`) — eskalasi nilai di dalam route yang sudah ber-gate `po.approve`, bukan gate domain; (b) route auth-only tanpa gate role (`cash-flow/entries`, `customers/*`, `products/without-barcode`, `reports/*/export`) — adopsi `getAuth` kosmetik, ditunda; (c) role-literal read-side/UI dashboard (show/hide tombol) — bukan gate API.
  - Verifikasi: `pnpm typecheck` hijau (backoffice + `@petshop/db`); **203 unit test hijau**. Anomali A1–A4 final di komentar seed & backlog. **TODO pra-rilis:** uji manual matriks per role.

## [1.55.0] - 2026-07-10

### Changed
- **Otorisasi Payables, Transaksi, Retur & Void pindah ke permission-level + scope cabang (RBAC R6 — M7).** 15 route dimigrasi ke `getAuth()`/`requirePermission()`/`hasPermission()` + `scopeFilter`/`scopeFilterAny`/`branchScope` dari `lib/authz`, menggantikan konstanta role lokal (`GLOBAL_ROLES`, `PAYABLE_PAYMENT_ROLES`, `APPROVER_ROLES`, `VOID_PAYMENT_ROLES`, `ALLOWED_ROLES`, helper `isGlobalRole`/`isAllowedRole`). **Parity penuh** — tanpa perubahan siapa-boleh-apa. Semua kode permission sudah ada di seed (tak ada seed baru).
  - **Gate (capability):** `supplier-payables/[id]/pay` & `inter-branch-payables/[id]/pay` → `payable.pay`; `inter-branch-payables/[id]/waive` → `payable.waive`; `void-requests` (+`[id]/approve`,`/reject`) → `void.approve`; `customers/[id]/debts/[debtId]/payments/[paymentId]/void` → `debt.payment_void`; `retur/[returnId]/cancel` → `return.cancel` **(A2 final: OWNER-only, dipertahankan)**; `bulk-sales` (POST) & `bulk-sale-products` (GET) → `transaction.bulk_sale`.
  - **Scope (tanpa gate role):** `supplier-payables` (list) → `branchScope` pada `purchaseOrders.branchId` (single-column, pertahankan override param untuk peran global); `inter-branch-payables` (list) → **`scopeFilterAny(debtorBranchId, creditorBranchId)`** (kasus utama debitur/kreditur); `damaged-goods` → global-view via `hasPermission('damaged_goods.read_global')`; `nav-badges` → `branchScope`; `retur` (POST) → hanya `getAuth` (branch dari payload).
  - Guard harga custom di bawah tier pada `bulk-sales` kini via `branchScope === 'ALL'` (parity: OWNER/GM bebas, lainnya tak boleh menurunkan). Guard scope pembayaran hutang antar-cabang tetap terbatas **cabang debitur**.
- Test `supplier-payables/[id]/pay` & `bulk-sales` diperbarui (mock payload menyertakan `permissions` + `branchScope`).

## [1.54.0] - 2026-07-10

### Changed
- **Otorisasi Internal Transfers (IBT) pindah ke permission-level + scope cabang (RBAC R6 — M6).** 4 route (`internal-transfers` create/list, `[id]` detail, `[id]/stock-check`, `[id]/status`) kini memakai `getAuth()`/`requirePermission()`/`hasPermission()` + `scopeFilterAny`/`branchScope` dari `lib/authz`, menggantikan konstanta role lokal (`GLOBAL_ROLES`, `MANAGER_ROLES`, `STOCK_ROLES`, `RECEIVE_ROLES`). **Parity penuh** — tiap transisi state machine dipetakan ke permission yang meniru role set aktualnya:
  - `status: approve`/`cancel` → `internal_transfer.approve` (OWNER/GM/MANAGER) + scope cabang **sumber**.
  - `status: prepare`/`ship` → `internal_transfer.stock_check` (OWNER/GM/MANAGER/GUDANG) + scope cabang **sumber**.
  - `status: receive` → `internal_transfer.receive` (OWNER/GM/MANAGER/GUDANG/FINANCE/KASIR) + scope cabang **tujuan**.
  - `stock-check` (GET) → `internal_transfer.stock_check` + scope cabang **sumber**.
  - `create` (POST) & `list`/`detail` (GET): **tanpa gate role** (scope-only via `scopeFilterAny(sumber, tujuan)`) — `GLOBAL_ROLES` di sini adalah **scope**, bukan gate. Membuat/melihat IBT tetap terbuka untuk semua role operasional (mis. POS internal-order oleh KASIR), dibatasi cabang sendiri. Perilaku identik.
- **Seed permission**: tambah kode baru `internal_transfer.approve` (OWNER/GM/MANAGER) agar approve/cancel IBT tetap parity (kode `internal_transfer.manage` yang ada hanya OWNER/GM). Matriks `role_permissions` bertambah 3 baris.
- Test `internal-transfers/[id]/status/route.test.ts` diperbarui (mock payload kini menyertakan `permissions` + `branchScope`).

## [1.53.0] - 2026-07-10

### Changed
- **Otorisasi Purchase Orders pindah ke permission-level + scope cabang (RBAC R6 — M5).** 9 route PO kini memakai `requirePermission()` + `getAuth()` + `branchScope` dari `lib/authz`, menggantikan konstanta role lokal (`GLOBAL_ROLES`, `PO_MUTATE_ROLES`, `ALLOWED_ROLES`) & cek `role` manual:
  - `po.manage` (OWNER/GM/MANAGER): buat PO (`route.ts` POST) & ubah/hapus PO (`[id]/route.ts`).
  - `po.approve` (OWNER/GM): approve, reject, mark-transit, cancel-remaining, approve-receiving, reverse-receiving.
  - `po.financial` (OWNER/GM): update-invoice.
  - Scope cabang **konsisten memakai `branchScope`**: OWNER & GM = semua cabang (`ALL`), lainnya = cabang sendiri — filter `poWhere` menyertakan `branchId` untuk non-global. **Parity** untuk route yang sebelumnya sudah bergerbang.

### Security
- **Tutup celah: `mark-transit` & `cancel-remaining` sebelumnya TANPA autentikasi apa pun** — endpoint PATCH mutasi status PO bisa dipanggil siapa saja tanpa login. Kini keduanya bergerbang `po.approve` + scope cabang + validasi ID + 404 bila PO di luar cabang.
- **Perbaikan bug M5: `reverse-receiving` gagal kompilasi** karena migrasi sebelumnya ikut menghapus import `argon2`, `zod`, dan definisi `reverseSchema` yang masih dipakai (verifikasi PIN Owner & validasi body). Ketiganya dikembalikan.

## [1.52.0] - 2026-07-09

### Changed
- **Otorisasi Stock Opname & Inventory pindah ke permission-level + scope cabang (RBAC R6 — M4).** 8 route (stock-opnames create/history/pending, approve, reject, inventory stock-adjustment, adjustment-logs, stock-logs) kini memakai `requirePermission()` + `scopeFilter`/`branchScope` dari `lib/authz`, menggantikan konstanta role & cek `role === 'MANAGER'/'OWNER'` manual.
  - Scope cabang kini **konsisten memakai `branchScope`**: OWNER & GM = semua cabang (`ALL`), lainnya = cabang sendiri (`OWN`). Riwayat/pending/approve stock opname untuk MANAGER tetap terbatas cabang sendiri (parity).

### Security
- **GM kini dapat approve/reject Stock Opname** (kode `stock_opname.approve` — sebelumnya hanya OWNER & MANAGER; keputusan anomali A1). GM juga melihat daftar pending & dapat approve lintas cabang.
- **Stock Adjustment kini dibatasi OWNER/GM/MANAGER** (kode `inventory.adjustment.manage` — sebelumnya **tanpa gate role**, semua user login bisa adjustment cabang sendiri; keputusan anomali A3). KASIR/GUDANG/FINANCE kehilangan akses adjustment.
- **GM kini konsisten lintas cabang pada Inventory** (stock adjustment view+tulis, adjustment-logs, stock-logs, pending SO) — sebelumnya sebagian route hanya OWNER yang lintas cabang (GM tereksklusi). Kini mengikuti `branchScope='ALL'` untuk OWNER & GM. MANAGER & role lain tetap cabang sendiri.

## [1.51.0] - 2026-07-09

### Changed
- **Otorisasi Cash-flow (kategori) & Shifts pindah ke permission-level (RBAC R6 — M3).** `cash-flow/categories` (+`[id]`) → `cashflow.category.manage` (OWNER/GM/MANAGER); `shifts` (+`[id]`) → `shift.read` (OWNER/GM). **Parity** — perilaku tetap. Bonus: guard shift kini memisahkan 401 (belum login) dari 403 (tanpa akses), sebelumnya keduanya 403. `cash-flow/entries` sengaja dibiarkan (operasi kas per-cabang tanpa gate role & tanpa kode di katalog).

## [1.50.0] - 2026-07-09

### Changed
- **Otorisasi Settings (User & Cabang) pindah ke permission-level (RBAC R6 — M2).** Route `settings/users` (+`[id]`) → `user.manage`; `settings/branches` (+`[id]`) → `branch.manage`, menggantikan konstanta `ALLOWED_MUTATE_ROLES = ['OWNER']`. **Parity** — perilaku tetap sama (OWNER-only), tanpa perubahan siapa-boleh-apa.

## [1.49.0] - 2026-07-09

### Changed
- **Otorisasi Master Data pindah ke permission-level (RBAC R6 — M1).** Semua route master-data kini memakai `requirePermission(kode)` + `getAuth()` dari `lib/authz.ts`, menggantikan konstanta role lokal (`ALLOWED_MUTATE_ROLES`). Perilaku untuk route yang sudah bergerbang **tetap sama** (OWNER/GM): kategori, brand, supplier, satuan (UOM), metode bayar, konversi UOM, barcode, harga jual/beli, salin harga.
  - Kode permission: `master.category.manage`, `master.brand.manage`, `master.supplier.manage`, `master.uom.manage`, `master.payment_method.manage`, `master.product.manage`, `master.price.manage`.

### Security
- **Celah otorisasi ditutup: create & edit produk kini dibatasi OWNER/GM** (sebelumnya **tanpa gate role** — user login apa pun bisa menambah/mengubah produk). Route `POST /api/bo/master-data/products` & `PATCH /api/bo/master-data/products/[id]` kini butuh `master.product.manage`. (Keputusan anomali A4, 2026-07-09.)

## [1.48.0] - 2026-07-09

### Added
- **Fondasi RBAC permission-level (fase plumbing, aditif — belum mengubah otorisasi route mana pun)**. Membangun dua sumbu otorisasi terpisah: **capability** (permission code) & **scope cabang** (`branchScope`), siap dipakai saat migrasi domain (fase R6, terpisah).
  - **Tipe** (`@petshop/shared`): `type BranchScope = 'ALL' | 'OWN'`; `JWTPayload` kini membawa `permissions: string[]` (terisi) + `branchScope?` (R1).
  - **Katalog & matriks** (`packages/db/src/seed/permissions.ts`, script `db:seed-permissions`, idempotent): 28 permission code + 67 baris `role_permissions` (OWNER 28, GM 24, MANAGER 10, FINANCE 2, GUDANG 2, KASIR 1) — **parity** dengan konstanta `_ROLES` yang berlaku sekarang, tak mengubah siapa boleh apa (R2).
  - **Helper** (`apps/backoffice/lib/authz.ts`): `getAuth`, `hasPermission`, `requirePermission` (guard 401/403), `scopeFilter`, `scopeFilterAny` (OR multi-kolom). Belum dipakai route mana pun (R3).
  - **Login** (`app/api/auth/login/route.ts`): JWT kini diisi kode permission nyata (join `role_permissions ⋈ permissions`) + `branchScope = (OWNER|GM) ? 'ALL' : 'OWN'`. `payload.role` tetap ada → semua route lama utuh & backward-compatible (R4).

## [1.47.0] - 2026-07-08

### Changed
- **Modal toko = harga jual gudang saat IBT dikonversi jadi Bulk Sale** (G7 — menutup loop akuntansi desentralisasi, keputusan R2a). Ketika Internal PO (IBT) diproses menjadi bulk sale, `TransactionService.createTransaction` kini **menimpa `interBranchTransferItems.costPriceAtTransfer` tiap item = harga jual (unitPrice) transaksi bulk sale** (dicocokkan per `productId + uomId`), bukan HPP FIFO gudang. Akibatnya saat toko tujuan menerima barang (IBT `receive`), batch masuk toko memakai **harga beli dari gudang** sebagai modal → P&L gudang membukukan untung, P&L toko memakai modal lebih tinggi, konsisten & tanpa dobel stok (potong stok gudang sudah di-skip di G5).
  - `costPriceAtTransfer` & `unitPrice` sama-sama per satuan transfer, jadi tanpa konversi ratio.
  - Hanya dijalankan saat IBT **baru** tertaut (belum pernah terkonversi) — dalam transaksi DB yang sama (atomik). Item yang satuannya diubah operator sehingga tak cocok → nilai `costPriceAtTransfer` lama dipertahankan.
  - Test baru `lib/services/transaction-service.test.ts`: IBT baru terkonversi → `costPriceAtTransfer` di-set ke harga jual; IBT sudah terkonversi / tanpa `sourceIbtId` → tidak diubah.

## [1.46.0] - 2026-07-08

### Added
- **Customer internal per cabang toko + auto-pilih di import Bulk Sale** (G6 — model gudang→toko = penjualan). Karena penjualan gudang ditagihkan ke toko tujuan, tiap cabang toko kini punya 1 record `customers` khusus (ditandai `is_internal_branch`, tertaut `linked_branch_id` ke cabangnya).
  - Migrasi non-breaking `0004_talented_revanche.sql`: kolom baru `customers.is_internal_branch` (boolean, default `false`) + `customers.linked_branch_id` (FK nullable ke `branches`).
  - Seed 4 customer internal (Toko Pusat/Depan/Raja/Gudang) via `apps/excel-tools/seed-internal-customers.js` (idempotent, upsert by kode `INT-<KODE_CABANG>`).
  - **Import IBT → Bulk Sale (G4) kini otomatis memilih customer = toko tujuan IBT.** `GET /api/bo/internal-transfers/[id]` menyertakan `destinationCustomerId`/`destinationCustomerName` (join `customers` pada `linked_branch_id = destination_branch_id`); prefill Bulk Sale men-set customer tsb otomatis (operator tetap bisa mengganti manual). Banner diperbarui: "Customer toko tujuan terpilih otomatis".
  - Efek lanjutan: penjualan gudang dapat difilter per toko lewat customer internal ini di Riwayat Transaksi.

## [1.45.0] - 2026-07-05

### Changed
- **Konfirmasi pengiriman IBT jalur bulk sale tidak lagi melakukan cek stok** (G8). Untuk IBT yang sudah dijual via Bulk Sale (`converted_transaction_id` terisi), form "Konfirmasi Pengiriman" **melewati** panggilan `GET .../stock-check` dan **menyembunyikan kolom "Stok Sistem"** — karena validasi stok nyata sudah terjadi di transaksi bulk sale (FIFO) dan pengiriman ini tidak memotong stok gudang lagi (lihat G5). Menghindari validasi ganda & tampilan stok yang menyesatkan (stok sudah berkurang).
  - IBT transfer murni (non-bulk) **tetap** memuat stok sistem & memvalidasi kekurangan seperti sebelumnya (termasuk alur PIN Owner).

## [1.44.0] - 2026-07-05

### Fixed
- **Guard dobel-potong stok gudang saat IBT dijual via Bulk Sale** (G5 — mitigasi risiko R1). IBT yang sudah diproses jadi bulk sale (`converted_transaction_id` terisi) stok cabang pengirimnya **sudah dipotong** saat transaksi bulk sale (FIFO). Kini aksi **`ship`** pada IBT terkonversi **tidak memotong stok gudang lagi** — hanya menandai barang keluar (update `qtyShipped` + status `IN_TRANSIT`). Sebelumnya stok gudang terpotong dua kali (bulk sale + ship). Cabang tujuan tetap menerima stok normal saat `receive`.
  - Alur PIN Owner stok-kurang di-**skip** untuk IBT terkonversi (tak relevan karena tak ada pemotongan stok) — di server maupun UI.
  - Test baru `internal-transfers/[id]/status/route.test.ts`: IBT terkonversi → `ship` tidak menyentuh `product_stocks`/`product_stock_batches`; IBT biasa → tetap memotong stok.

### Added
- **Tautan & peringatan IBT terkonversi** di detail Transfer Internal (`purchase-orders/internal/[id]`):
  - Badge **"Dijual via Bulk Sale {No. Transaksi}"** yang menaut ke Riwayat Transaksi (`/transactions?q=`).
  - Banner info di form konfirmasi pengiriman: menjelaskan stok gudang sudah dipotong saat bulk sale dan pengiriman ini tidak memotong stok lagi.
  - `GET /api/bo/internal-transfers/[id]` & query detail server kini menyertakan `convertedTransactionId` + nomor transaksinya (join `transactions`).

## [1.43.0] - 2026-07-04

### Added
- **Proses Internal PO (IBT) menjadi Bulk Sale** (G4 — model penjualan antar-cabang; penjual = cabang pengirim). Tombol **"Proses via Bulk Sale"** di halaman detail Transfer Internal (`purchase-orders/internal/[id]`) — untuk OWNER/GM/MANAGER di **cabang pengirim mana pun** (bukan hanya Gudang; toko yang mengirim ke toko lain pun bisa), saat IBT masih pending (`PENDING_APPROVAL`/`APPROVED`) & belum terkonversi. Klik → membuka `transactions/bulk-sale?fromIbt={id}`.
  - **Prefill otomatis** di halaman Bulk Sale: cabang di-set ke cabang pengirim IBT, dan tiap item IBT (produk, satuan, qty) ditarik sebagai baris dengan harga tier cabang tsb (dapat diedit sesuai aturan harga custom B1). Banner biru "Dari Internal PO {No} → tujuan {cabang}" + tombol **"Batalkan & mulai kosong"**.
  - **Item tanpa harga di cabang atau produk nonaktif dilewati & dilaporkan** (daftar item yang di-skip ditampilkan di banner) — tidak menggagalkan seluruh prefill. Customer tetap dipilih manual (auto-pilih toko tujuan menyusul di G6).
  - **Tautan IBT ↔ transaksi**: saat bulk sale hasil import disimpan, `transactions.source_ibt_id` diisi (`sale_type='BULK'`) dan IBT sumber ditautkan lewat kolom baru `inter_branch_transfers.converted_transaction_id` — dalam transaksi DB yang sama (atomik). Dipakai G5 untuk mencegah pemotongan stok gudang kedua saat `ship`.
  - **Guard anti dobel-proses** di `POST /api/bo/bulk-sales`: bila `sourceIbtId` dikirim, IBT divalidasi (ada, cabang pengirim = cabang transaksi, belum dibatalkan, **belum terkonversi** → `409`). Badge **"Dijual via Bulk Sale"** muncul di detail IBT yang sudah dikonversi (tombol proses disembunyikan).
- **Migrasi DB** (drizzle `0003_cheerful_stellaris`): kolom `inter_branch_transfers.converted_transaction_id integer NULL`. Non-breaking. **Belum di-apply ke DB remote** (jalankan `pnpm --filter @petshop/db db:migrate` saat siap, bersama `0002` yang masih pending).

### Changed
- **`GET /api/bo/bulk-sale-products` mendukung parameter `ids`** (daftar id produk dipisah koma) untuk mengambil produk spesifik + harga/UOM/modal per cabang — dipakai prefill IBT. Mode pencarian (search/barcode) tetap seperti semula.
- `GET /api/bo/internal-transfers/[id]` kini menyertakan `convertedTransactionId`. Halaman Bulk Sale kini dibungkus `Suspense` (untuk `useSearchParams`).
- Test: 3 skenario baru di `bulk-sales/route.test.ts` (teruskan `sourceIbtId`, tolak IBT terkonversi `409`, tolak cabang pengirim beda `400`). Suite backoffice hijau (198 test).

## [1.42.0] - 2026-07-04

### Added
- **Diskriminator jenis penjualan pada transaksi** (G9, fondasi import Internal PO → Bulk Sale). Kolom baru `transactions.sale_type` (`'RETAIL'` default | `'BULK'`, ber-index) + `transactions.source_ibt_id` (nullable, FK ke `inter_branch_transfers`) untuk menautkan bulk sale ke Internal PO sumbernya nanti. Migrasi non-breaking (drizzle `0002_deep_sue_storm`): semua transaksi lama otomatis `RETAIL`.
  - Semua transaksi lewat `POST /api/bo/bulk-sales` kini tersimpan sebagai `sale_type='BULK'`; transaksi POS/retail tetap `RETAIL`. `sourceIbtId` sudah diterima payload (opsional) untuk dipakai fitur import IBT (G4).
  - **Riwayat Transaksi**: filter baru **"Jenis Penjualan"** (Semua / Retail / Bulk Sale) di `GET /api/bo/transactions?saleType=` + badge **"Bulk"** di baris agar bulk sale bisa dibedakan/disaring dari retail.
  - Laporan laba-rugi **tidak berubah** — tetap mengagregasi semua transaksi `COMPLETED` lintas jenis.
  - Test: `saleType='BULK'` + penerusan `sourceIbtId` diverifikasi di `bulk-sales/route.test.ts`.

## [1.41.0] - 2026-07-04

### Added
- **Manajemen satuan (konversi UOM) menyatu di grid Manajemen Harga** (`master-data/prices`) — operator tidak perlu lagi bolak-balik ke tab Satuan halaman produk (asal backlog: friksi import Gudang, kategori `KONVERSI_HILANG_KOSONG`):
  - **Kolom "Konversi (global)"** baru menampilkan ratio tiap baris UOM (`= N {UOM dasar}`; baris UOM dasar bertanda "dasar") dan **bisa diedit inline** (warna ungu = kelas global, beda dari harga).
  - **Dialog konfirmasi batch** saat simpan bila ada perubahan ratio: merinci tiap perubahan (produk, satuan, ratio lama → baru, daftar cabang yang sudah punya harga satuan itu) dan wajib dikonfirmasi eksplisit sebelum tersimpan — anti ubah-ratio diam-diam (pelajaran kasus `BERAS MERAH` Gudang vs Toko). Perubahan harga murni tetap tersimpan tanpa dialog.
  - **"+ satuan" memunculkan baris draft inline** di grup produk: pilih UOM (atau buat satuan baru: kode + nama), isi ratio, harga per tier, dan modal dalam satu baris — semuanya tersimpan bersama Ctrl+S. UOM yang sudah punya konversi global tapi belum ber-harga di cabang aktif muncul di dropdown dengan ratio ter-prefill.
  - **Aksi hapus per baris** (ikon tempat sampah) dengan dua pilihan eksplisit: **"Hapus harga cabang ini"** (hanya harga + modal cabang aktif; konversi & cabang lain tidak disentuh) dan **"Hapus satuan GLOBAL"** (konversi + semua harga & modal di SEMUA cabang, dengan konfirmasi keras menampilkan cabang terdampak).
  - **"Salin" dari produk lain**: modal cari produk sumber → preview satuan + ratio + harga tier + modal di cabang aktif dengan checkbox per UOM → salin. Konversi ditulis global (ratio bentrok dengan konversi target ditandai tidak dapat disalin, bukan ditimpa), harga & modal ditulis ke cabang aktif saja.
- **Endpoint baru/berubah**:
  - `PATCH /api/bo/master-data/products/[id]/uom-conversions/[convId]` — ubah ratio/berat konversi (OWNER/GM); `weightGram` yang tidak dikirim tidak disentuh.
  - `DELETE /api/bo/master-data/prices?branchId&productId&uomId` — hapus harga tier + modal satu produk-UOM di satu cabang.
  - `POST /api/bo/master-data/prices/copy-product` (`?preview=1` untuk pratinjau) — salin satuan + harga + modal antar produk.
  - `GET .../uom-conversions` kini menyertakan `priceBranches` (cabang yang sudah punya harga per UOM); `GET .../prices` kini menyertakan ratio konversi + UOM dasar per baris.
  - 26 unit test baru (PATCH, DELETE harga cabang, copy-product: auth, role, validasi, konflik ratio, cascade).

### Changed
- **`DELETE uom-conversions/[convId]` kini bertingkat**: bila satuan masih punya harga di cabang mana pun → `409` + daftar cabang; lanjut dengan `?cascade=1` menghapus konversi beserta seluruh harga & modal satuan itu di semua cabang dalam satu transaksi (sebelumnya konversi dihapus diam-diam meninggalkan harga yatim). Tab Satuan halaman produk ikut memakai alur konfirmasi ini.
- **Form konversi UOM di tab Satuan diperkuat sinyal scope global**: badge **"GLOBAL — berlaku untuk semua cabang"** selalu tampil; memilih UOM yang sudah terpasang masuk mode ubah (menampilkan ratio existing + cabang pemakai harga) dan tombol simpan terkunci sampai checkbox konfirmasi dicentang.

### Changed
- **Guard tier di Bulk Sale dilonggarkan** (`POST /api/bo/bulk-sales`). Semua role yang boleh bulk sale (OWNER/GM/MANAGER) kini dapat memilih tier apa pun (RETAIL/RESELLER/GROSIR/…), tidak lagi dibatasi hanya RETAIL untuk role non-global. Diperlukan agar kasir/manajer cabang **Gudang** bisa menjual di harga GROSIR/RESELLER yang baru diimpor. Tier yang tidak memiliki harga di cabang tsb tetap ditolak otomatis (400 `Harga produk tidak valid untuk cabang dan tier ini`). Guard harga custom (role non-global tidak boleh menurunkan harga di bawah tier) **tetap utuh**.
  - Fungsi `isAllowedPriceTierForRole` dihapus; sisi client sudah menampilkan semua tier yang tersedia (tanpa filter role), jadi tidak perlu perubahan UI.

## [1.39.0] - 2026-07-04

### Fixed
- **HPP (COGS) tidak lagi 0 saat batch FIFO kosong/kurang** (`StockService.deductStock`). Porsi penjualan yang tidak tertutup batch (oversell, atau cabang belum pernah terima barang via sistem — kasus cabang Gudang) kini diberi harga modal fallback bertingkat: **cost matrix UOM dasar** (`product_uom_costs` per cabang) → **cost matrix UOM besar ÷ ratio konversi** (dipilih ratio terbesar = satuan pembelian grosir) → `defaultCostPrice` produk. Sebelumnya hanya `defaultCostPrice`, sehingga produk yang modalnya diisi per SAK/DUS di cost matrix tetap ber-HPP 0 → laba kotor menggelembung.
  - Berlaku juga untuk batch yang ada tapi tanpa harga modal (`totalCogs = 0`).
  - `TransactionService.createTransaction` mem-prefetch `product_uom_costs` sekali per transaksi (tanpa query tambahan per item). Jalur lain (`retur`, `stock adjustment`, `reverse receiving`, `barang rusak`) otomatis ikut memakai fallback ini.
  - Kalkulasi memakai `big.js`; shortfall tetap tercatat ke audit log `OVERSELL` seperti sebelumnya.
  - Unit test: batch penuh tanpa modal, batch sebagian, tanpa batch, fallback UOM dasar/UOM besar/default, modal 0 diabaikan.
- **7 unit test lama yang gagal diperbaiki** (mock basi — tertinggal saat route-nya berevolusi, bukan bug produksi): mock `@/lib/db` di test `prices` bulk belum punya `db.transaction` + `productUomCosts` (route PUT kini menyimpan harga+modal dalam satu transaksi); test `pos/bootstrap` belum meng-mock sesi (`cookies`/`verifyAccessToken`/`getPosBranchId`) & export `productUomCosts`; test `pos/stock-opnames` (POST & add-items) belum punya export `productUomConversions` + chain `leftJoin` untuk agregasi stok lintas UOM (`computeItemVariance`). Suite backoffice kini hijau penuh (173 test).

## [1.38.1] - 2026-07-04

### Added
- **Data harga jual & modal cabang Gudang terisi** dari sheet `GUDANG` (`DAFTAR PRODUK 03-07-2026.xlsx`): 1.214 harga jual (tier RETAIL/RESELLER/GROSIR per UOM, 415 produk), 367 harga modal per UOM besar (`product_uom_costs`), dan 19 konversi UOM baru. Konversi yang bentrok dengan DB **tidak ditimpa** (keputusan: DB always win).
  - Skrip import: `apps/excel-tools/import-gudang.js` (dry-run default, `--execute`, idempotent, batch multi-row upsert; laporan lengkap ke `import-gudang-report.txt`).
  - Skrip `apps/excel-tools/export-admin-corrections.js` menghasilkan **`koreksi-admin-gudang.csv`** (245 baris, berprioritas) — daftar tindak lanjut manual admin: produk baru (86), modal kosong (125), cek fisik ratio MEO/PUSSBITE (21), satuan diskip/typo (8), info typo sheet (5).
  - Terverifikasi: harga UOM besar Gudang tampil di pencarian produk **Bulk Sale** (`bulk-sale-products` per cabang) dan modal Gudang per UOM tampil & dapat diedit di tab **Harga Modal** produk (cost matrix); tidak ada baris harga/modal yatim tanpa konversi.

## [1.38.0] - 2026-07-03

### Added
- **Cetak Bukti Penerimaan Barang (BPB) saat penerimaan transfer internal** (`pos/incoming-transfers`). Setelah cabang tujuan menekan "Konfirmasi Diterima", struk thermal 80mm otomatis tercetak berisi: No. IBT, tanggal terima, cabang asal → cabang penerima, nama penerima, dan daftar item (qty dikirim vs qty diterima, selisih + alasan bila kurang), serta blok tanda tangan penerima.
  - Data penerimaan di-snapshot sebelum `router.refresh()` sehingga struk tetap dapat dicetak walau transfer sudah hilang dari daftar.
  - Tombol **"Cetak BPB"** pada notifikasi sukses untuk cetak ulang.
  - Komponen baru `receiving-note-print.tsx` mengikuti pola thermal `receipt-print.tsx` (qty saja, tanpa nominal).
- **Cetak ulang BPB dari halaman detail transfer internal** (`purchase-orders/internal/[id]`). Tombol **"Cetak Ulang BPB"** muncul untuk transfer berstatus `PARTIALLY_RECEIVED`/`FULLY_RECEIVED`, mencetak ulang struk penerimaan (thermal, bertanda `*** CETAK ULANG ***`) berdasarkan qty yang sudah tercatat diterima.
  - Print halaman detail kini memakai `printMode` (`surat-jalan` | `bpb`) agar dokumen A4 Surat Jalan dan struk BPB thermal tidak saling bentrok saat dicetak.
- **Pencatatan penerima & waktu penerimaan transfer internal** (kolom baru `received_by_id` & `received_at` di `inter_branch_transfers`, nullable). Aksi `receive` kini menyimpan siapa yang menerima dan kapan.
  - BPB cetak ulang dari halaman detail kini menampilkan **nama penerima** dan **waktu terima** yang sebenarnya (sebelumnya `-` dan memakai `updated_at`). Transfer lama yang diterima sebelum perubahan ini tetap fallback ke `updated_at`.
  - **Perlu migrasi DB:** `pnpm db:migrate` (migrasi `0001_melted_mantis.sql` — hanya menambah 2 kolom nullable, tanpa perubahan destruktif).
- **Modal tinjau transaksi (review summary) sebelum simpan di Bulk Sale** (`transactions/bulk-sale`). Klik "Simpan Bulk Sale" kini memvalidasi lalu membuka dialog ringkasan: data customer (+ belanja 30 hari & sisa hutang), cabang, metode pembayaran (atau Hutang + DP + jatuh tempo), tabel item (menandai harga custom), serta subtotal/diskon item/diskon transaksi/grand total/bayar/kembali atau sisa hutang. POST hanya terjadi setelah menekan "Konfirmasi & Simpan". `Esc` / klik luar / "Kembali" menutup tanpa kehilangan data; tombol konfirmasi difokus otomatis.
- **Harga custom per item di Bulk Sale** (`transactions/bulk-sale` + `POST /api/bo/bulk-sales`). Kolom harga di tiap baris kini benar-benar tersimpan (sebelumnya selalu ditimpa harga tier oleh server).
  - **OWNER/GM**: bebas mengisi harga berapa pun (> 0), termasuk di bawah harga tier.
  - **Role lain (MANAGER)**: hanya boleh **menaikkan** harga; harga di bawah harga tier resmi ditolak (HTTP 403).
  - Setiap harga yang berbeda dari harga tier dicatat ke tabel **`owner_price_overrides`** (transaksi, produk, user, harga asal → harga override) dalam transaksi DB yang sama.
  - Baris dengan harga custom ditandai visual (border kuning + label "custom (tier …)").
- **Diskon keseluruhan transaksi (nominal) di Bulk Sale** (`transactions/bulk-sale`). Field baru **"Diskon Transaksi"** di panel ringkasan; dihitung setelah diskon per item. Grand total & kembalian/sisa hutang menyesuaikan otomatis. Diskon di-clamp ke maksimal (subtotal − diskon item) dan submit ditolak bila melebihinya.
  - Saat simpan, diskon transaksi **dialokasikan proporsional** ke tiap item (terhadap nilai bersih baris) lalu digabung ke `discountAmount` item — sehingga penyimpanan per item di DB tetap konsisten dan header transaksi mencatat total diskon gabungan. Tanpa perubahan kontrak/skema server.
  - Fungsi murni `allocateTransactionDiscount` menjamin jumlah alokasi tepat (sisa pembulatan dibagikan ke baris ber-fraksi terbesar) dan tidak pernah melebihi bruto per baris. Ditutup unit test.
- **Hotkey di halaman Bulk Sale** (`transactions/bulk-sale`). Mempercepat entri transaksi grosir tanpa mouse:
  - **F2** — fokus + seleksi kolom "Cari Produk" dari posisi manapun di halaman.
  - **F4** — fokus + seleksi kolom "Customer".
  - **Delete** — hapus baris produk yang sedang difokus; fokus otomatis kembali ke kolom cari produk (`Backspace` tetap untuk mengedit karakter di dalam field).
  - **F6** — fokus + seleksi kolom "Diskon Transaksi".
  - **F9** — tinjau & simpan transaksi (membuka modal review).
  - Label kolom, tombol simpan, & tombol hapus kini menampilkan petunjuk hotkey-nya.
- **Default cabang di Bulk Sale = Gudang** (`transactions/bulk-sale`). Saat halaman dibuka, dropdown cabang otomatis memilih cabang bernama/berkode "Gudang" (fallback ke cabang user bila tidak ada). Memudahkan penjualan grosir yang sumber stoknya dari gudang.
- **Info pelanggan di halaman Bulk Sale** (`transactions/bulk-sale`). Saat pelanggan dipilih, muncul dua chip di bawah kolom Customer: **"Belanja 30 hari: Rp …"** dan **"Sisa hutang: Rp …"** (disorot kuning bila > 0). Info di-reset saat pelanggan diganti/dihapus atau cabang diganti.
  - Endpoint **`GET /api/customers/[id]/summary`** diperluas dengan field **`outstandingDebt`** — `SUM(customer_debts.remaining_amount)` untuk hutang berstatus bukan `PAID`.

### Changed
- **Metode pembayaran & penjualan kredit di Bulk Sale disatukan** (`transactions/bulk-sale`). Checkbox "Penjualan Kredit (Hutang)" **dihapus**; "Hutang" kini menjadi salah satu opsi di dropdown **Metode Pembayaran** dan **default terpilih**. Status kredit diturunkan dari metode terpilih (`type === 'DEBT'`), menghilangkan kondisi tak sinkron antara checkbox dan dropdown.
  - Saat "Hutang" dipilih → muncul field **Uang Muka (DP)**, dropdown **Metode Uang Muka (DP)** (hanya metode non-hutang, tampil bila DP > 0), dan **Jatuh Tempo**.
  - Saat metode non-hutang dipilih → alur bayar normal (Jumlah Bayar + Kembali).
  - Payload ke `POST /api/bo/bulk-sales` tetap sama: saat kredit, `paymentMethodId` = metode DP; kontrak server tidak berubah.

### Fixed
- **Penjualan kredit Bulk Sale gagal tersimpan** karena klien mengirim `change` bernilai negatif (`amountPaid - grandTotal`) sedangkan skema server mewajibkan `change >= 0`, menyebabkan HTTP 400. Nilai `change` kini di-clamp ke minimal 0 (`Math.max(0, ...)`).

## [1.37.0] - 2026-07-03

### Changed
- **Baseline ulang migrasi database dengan drizzle-kit** (`packages/db`). Journal drizzle-kit lama sudah usang (berhenti di `0007`, sementara migrasi nyata ditulis-tangan & diterapkan manual). Setelah memverifikasi schema Drizzle sinkron 1:1 dengan produksi (58 tabel, 491 kolom, 16 index — via `drizzle-kit pull` + diff snapshot), seluruh riwayat di-squash menjadi satu baseline `packages/db/src/migrations/0000_baseline.sql`. Produksi ditandai sudah berada di baseline (row di `drizzle.__drizzle_migrations`, `created_at=1783016739763`) tanpa mengeksekusi ulang DDL, via `apps/db-compare/baseline-drizzle-20260703.mjs`. Diverifikasi end-to-end: `drizzle-kit migrate` = no-op, `drizzle-kit generate` = "No schema changes".
  - Migrasi lama dipindah ke `packages/db/legacy-migrations/` (di luar `out` dir drizzle) sebagai arsip historis; lihat README di sana.
  - Ke depan: cukup `pnpm --filter @petshop/db db:generate` lalu `db:migrate` — hentikan pola SQL tulis-tangan + runner manual.

### Removed
- **6 tabel backup ad-hoc di produksi** (`bak_20260703_*` dan `transaction_items_cogs_bak_20260701`) sisa script ops di-drop setelah dipastikan tanpa FK-masuk. Produksi kini 58 tabel, cocok 1:1 dengan schema Drizzle.

## [1.36.0] - 2026-07-03

### Changed
- **Rekonsiliasi & penambahan index database** (`packages/db/src/schema/*`). Introspeksi DB produksi (`drizzle-kit pull`) menemukan 2 index yang ada di DB tapi belum tercermin di schema Drizzle — kini dideklarasikan agar schema setia terhadap DB: `idx_product_barcodes_product` (`product_barcodes`) dan `cash_flow_entries_branch_created_idx` (`cash_flow_entries`).
- **10 index baru pada kolom FK/filter jalur-panas** yang selama ini tanpa index (Postgres tidak mengindeks FK otomatis), dipilih dari pola query nyata di backoffice. Migrasi `packages/db/src/migrations/20260703000001_add_hot_path_indexes.sql` (idempotent) + diterapkan ke produksi via `apps/db-compare/create-hot-path-indexes-20260703.mjs` (`CREATE INDEX CONCURRENTLY`):
  - `transactions (branch_id, created_at)` & `transactions (shift_id)` — laporan/dashboard per cabang-tanggal & settlement shift.
  - `transaction_items (transaction_id)` & `transaction_payments (transaction_id)` — join detail transaksi (struk, laporan, void, retur).
  - `product_stock_batches (product_id, branch_id)` — FIFO & perhitungan COGS tiap penjualan.
  - `customer_debts (customer_id)`, `customer_debts (transaction_id)`, `debt_payments (debt_id)` — hutang & pembayaran hutang customer.
  - `shifts (branch_id, status)` & `shift_expenses (shift_id)` — cari shift OPEN per cabang (tiap load POS) & join biaya per shift.

## [1.35.0] - 2026-07-03

### Added
- **Info belanja 30 hari pelanggan di kasir POS** (`components/pos/cart-panel.tsx`). Saat kasir memilih pelanggan pada keranjang, di bawah nama muncul chip **"Belanja 30 hari: Rp …"** — total nilai transaksi (`payable_amount`) pelanggan tersebut selama 30 hari terakhir, tidak termasuk transaksi `VOIDED`. Ditampilkan status "Memuat belanja..." saat fetch berlangsung.
  - Endpoint baru **`GET /api/customers/[id]/summary`** — auth via `accessToken`, mengembalikan `{ customerId, days, total, transactionCount }` untuk agregat 30 hari terakhir.

### Changed
- **Index baru `idx_transactions_customer_created`** pada `petshop.transactions (customer_id, created_at)` — sebelumnya tabel `transactions` tidak punya index apa pun sehingga query summary belanja pelanggan melakukan sequential scan (lambat, memburuk seiring bertambahnya transaksi). Ditambahkan ke schema Drizzle (`packages/db/src/schema/transactions.ts`), dicatat sebagai migrasi `packages/db/src/migrations/20260703000000_add_transactions_customer_index.sql` (idempotent), dan diterapkan ke DB produksi via `apps/db-compare/create-index-trx-customer-20260703.mjs` (`CREATE INDEX CONCURRENTLY`).

## [1.34.0] - 2026-07-03

### Added
- **Riwayat & koreksi pembayaran hutang customer** (detail customer → seksi Hutang/Piutang). Setiap hutang kini punya tombol **Riwayat (n)** yang membuka daftar pembayaran (tanggal, metode, nominal, keterangan). Owner/GM dapat **membatalkan** satu pembayaran (soft-void, dengan alasan opsional): baris pembayaran ditandai `Dibatalkan`, lalu `paid_amount`/`remaining_amount`/`status` hutang dihitung ulang dari total pembayaran yang masih aktif, dan dicatat ke `audit_logs` (`VOID_DEBT_PAYMENT`).
  - Endpoint baru **`POST /api/bo/customers/[id]/debts/[debtId]/payments/[paymentId]/void`** — role-gated OWNER/GM, kunci baris hutang (`FOR UPDATE`), tolak pembayaran yang sudah dibatalkan (409).
  - Kolom baru di `petshop.debt_payments`: `voided_at`, `voided_by`, `void_reason` (schema `packages/db/finance.ts` + ALTER pada DB produksi).
  - `POST .../debts/[debtId]/pay` kini mengembalikan objek `payment` yang dibuat (field hutang tetap di top-level, backward-compatible) sehingga pembayaran baru langsung muncul di riwayat, dan menambahkan kunci baris (`FOR UPDATE`) untuk mencegah race pada pelunasan paralel.

## [1.33.3] - 2026-07-03

### Fixed
- **Hutang hantu saat invoice di-void** (`lib/services/void-service.ts`). Void transaksi hanya mengembalikan stok & menulis audit log, tanpa menyentuh `customer_debts` — sehingga hutang customer yang terbit dari penjualan bertipe `DEBT` tetap `UNPAID` dengan sisa penuh meski penjualannya sudah dibatalkan (piutang menggelembung & bisa salah tagih). Sekarang `performVoidWithinTx` mengunci (`FOR UPDATE`) lalu **membatalkan hutang** transaksi tersebut (status `VOIDED`, `remainingAmount` = 0). Jika hutang sudah menerima pembayaran (`paidAmount > 0`, uang riil sudah masuk), void **diblokir** dengan error `DEBT_HAS_PAYMENT` — kasir/owner harus mengoreksi pembayaran hutang lebih dulu.
- **Filter status `VOIDED` pada piutang**: Laporan Piutang (`reports/receivables/page.tsx`) kini mengecualikan hutang `VOIDED` (`notInArray(['PAID','VOIDED'])`), dan detail customer (`customer-detail-client.tsx`) menampilkan badge "Dibatalkan", menyembunyikan tombol Catat Pembayaran, serta mengeluarkannya dari Total Outstanding. Badge navigasi (`nav-badges`) sudah aman karena memakai whitelist `UNPAID/PARTIAL`.

## [1.33.2] - 2026-07-03

### Fixed
- **HPP membengkak & profit minus untuk penjualan satuan non-dasar** (`lib/services/transaction-service.ts`). Regresi dari refactor performa `create transaction` (prefetch + batch insert): objek prefetched mengirim `ratio: ratioToQty` ke `StockService.deductStock`, padahal qty sudah dikonversi ke base UOM (`baseQtyToDeduct`) dan `uomId` yang dikirim sudah `baseUomId`. Akibatnya rasio konversi diterapkan dua kali (`qty × ratio²`) sehingga HPP dan pengurangan stok membengkak sebesar faktor rasio untuk produk yang dijual per Dus/Pak/Lusin (mis. Dus isi 12 → HPP & stok terpotong 12× lipat), membuat laba rugi minus. Satuan dasar (ratio=1) tidak terpengaruh — karena itu bug hanya muncul saat penjualan produk bersatuan. Diperbaiki dengan mengirim `ratio: 1`. Catatan: transaksi test yang tercatat selama periode bug punya snapshot `cogs` yang salah — perlu di-void/koreksi manual.

## [1.33.1] - 2026-07-02

### Changed
- **Update harga & satuan produk Toko Pusat** dari `DAFTAR PRODUK 02-07-2026.xlsx` via script baru `apps/excel-tools/update-daftarproduk-020726.js` (diff-based: hanya menyentuh baris yang beda antara file dan DB, dry-run default). Diterapkan: 5 update modal (ACTIVE -2/-3/-4/-5, BIO PC CHIC TUNA IN GRAVY), 15 update harga (ACTIVE, BOLT FRESHPACK, MR VET KLG OMEGA 3, TOPSONG), 1 hapus tier harga (ASAHI PCS/GROSIR), 3 konversi DUS=120 (LOQY PC CHICKEN/SALMON/TUNA). Catatan: baris `MR VET KLG OMEGA 3` di Excel punya grup satuan DUS ganda dengan harga retail konflik (345.000 vs 445.000) — dipakai 345.000 (konsisten dengan produk MR VET KLG lain); mohon dikoreksi di file sumber.

## [1.33.0] - 2026-07-02

### Added
- **Inbox Persetujuan Void** (`app/(dashboard)/void-requests/`). Halaman baru untuk Owner/GM meninjau pengajuan void: tab Menunggu/Disetujui/Ditolak, kartu pengajuan (nomor & nominal transaksi, cabang, pengaju, alasan, waktu), tombol Setujui (modal konfirmasi + peringatan bila shift sudah settle) dan Tolak (catatan opsional). Menu "Persetujuan Void" ditambahkan ke grup Transaksi di sidebar (hanya OWNER/GM) dengan badge jumlah pengajuan `PENDING` via `GET /api/bo/nav-badges`.
- **Jalur approval void async (backend)** — pengajuan void kini bisa diproses Owner/GM tanpa PIN di tempat:
  - **`GET /api/bo/void-requests`** — daftar pengajuan void (default `PENDING`, filter `?status=`) beserta nomor transaksi, nominal, cabang, pengaju, dan alasan. Hanya OWNER/GM.
  - **`POST /api/bo/void-requests/[id]/approve`** — setujui pengajuan: void transaksi (kembalikan stok FIFO + audit log via `performVoidWithinTx`) dan tandai pengajuan `APPROVED` dalam satu transaksi DB. Baris pengajuan dikunci (`FOR UPDATE`) agar approve/reject tidak balapan; pengajuan yang sudah diproses ditolak (409).
  - **`POST /api/bo/void-requests/[id]/reject`** — tolak pengajuan (catatan opsional): tandai `REJECTED`, pulihkan status transaksi `PENDING_VOID` → `COMPLETED`, tulis audit log `VOID_REQUEST_REJECTED`.
- **Peringatan void setelah settlement**. Void pada shift yang sudah di-settle tidak otomatis mencatat refund ke pelanggan — angka settlement adalah snapshot historis. Ditambahkan: (a) catatan peringatan di modal "Ajukan Void Transaksi" (`transaction-list-client.tsx`) agar pengeluaran refund dicatat manual di Keuangan → Pendapatan & Pengeluaran; (b) field `shiftSettled` di `GET /api/bo/void-requests` serta `shiftSettled` + `warning` di response approve, untuk ditampilkan inbox owner.

### Changed
- **Pengajuan void kini men-set transaksi ke `PENDING_VOID`** (`app/api/bo/transactions/[trxNumber]/void-request/route.ts`). Sebelumnya hanya membuat baris `void_requests` tanpa mengubah status transaksi, padahal UI riwayat sudah menampilkan badge "Menunggu Void". Selama menunggu keputusan, transaksi tidak dihitung dalam laporan (laporan hanya menghitung `COMPLETED`); ditolak → kembali `COMPLETED`, disetujui → `VOIDED`.
- **`void-service`**: `assertVoidable` & `performVoidWithinTx` menerima opsi `fromStatuses` (default `['COMPLETED']`) agar jalur approval async dapat mem-void transaksi berstatus `PENDING_VOID`. Jalur sync (PIN Owner) tetap hanya menerima `COMPLETED` — transaksi yang sedang menunggu approval harus diputuskan lewat inbox.

## [1.32.1] - 2026-07-02

### Changed
- **Refactor logika void jadi service reusable** (`lib/services/void-service.ts`). Inti void (validasi kelayakan, pengembalian stok FIFO, set status VOIDED, audit log) diekstrak dari route `app/api/pos/transactions/[id]/void/route.ts` menjadi `assertVoidable`, `performVoidWithinTx` (komposabel di dalam transaksi DB lain), dan `performVoid`. Perilaku & status code jalur void sync (PIN Owner) tidak berubah; ini fondasi untuk jalur approval void async. Ada guard status ganda di dalam transaksi untuk mencegah double-void.

## [1.32.0] - 2026-07-02

### Added
- **Laporan Barang Rusak di dashboard Back Office** (`app/(dashboard)/reports/damaged-goods/`). Halaman baru untuk melihat riwayat barang rusak/kadaluarsa/hilang per periode: filter tanggal (+ filter cabang untuk OWNER/GM), kartu ringkasan (total kerugian, jumlah catatan, breakdown per alasan), dan tabel detail (waktu, cabang, alasan, item + qty + nilai, pelapor, catatan). Peran non-global otomatis dikunci ke cabangnya. Ditambahkan ke menu **Laporan** di sidebar.
- **`GET /api/bo/damaged-goods`** — endpoint laporan barang rusak (auth, filter `startDate`/`endDate`/`branchId`; OWNER/GM lihat semua cabang atau filter, peran lain dikunci ke cabangnya).
- **`getDamagedGoodsReport`** (`lib/services/report-service.ts`) — agregasi catatan barang rusak beserta item, total kerugian, dan breakdown per alasan dalam periode (WIB).

## [1.31.0] - 2026-07-02

### Added
- **Input Barang Rusak di Web POS** (`app/pos/(authenticated)/produk/barang-rusak/`). Halaman baru untuk mencatat barang rusak/kadaluarsa/hilang: cari produk, tambah beberapa item + qty, pilih alasan (RUSAK/EXPIRED/HILANG) dan catatan, lalu simpan. Stok dipotong FIFO dan nilai kerugian (HPP) dihitung otomatis. Menampilkan riwayat shift aktif (atau hari ini bila tidak ada shift) beserta total kerugian. Entry point berupa kartu "Barang Rusak" di hub Produk (`app/pos/(authenticated)/produk/page.tsx`).
- **Kerugian Barang Rusak masuk Laporan Laba Rugi** (`lib/services/report-service.ts`). `getProfitLossReport` kini mengagregasi `damaged_goods.total_loss_value` per cabang dalam periode dan menambah kolom **Kerugian Rusak** serta **Laba Bersih** (`Laba Kotor − Kerugian Rusak`) di halaman (`app/(dashboard)/reports/profit-loss/page.tsx`) dan export CSV (`app/api/bo/reports/profit-loss/export/route.ts`).
- **`GET /api/pos/damaged-goods`** — daftar barang rusak shift/hari ini untuk cabang sesi POS.

### Fixed
- **Celah keamanan API barang rusak** (`app/api/pos/damaged-goods/route.ts`). Endpoint sebelumnya tidak memverifikasi `accessToken` dan mengambil `branchId`/`reportedById` mentah dari body (bisa dipalsukan). Sekarang wajib auth; `branchId` dari sesi POS, `reportedById` dari token, `shiftId` diisi otomatis dari shift OPEN, payload divalidasi Zod, dan barang rusak ditolak (409) bila stok tidak mencukupi (tidak lagi membuat stok minus).

## [1.30.2] - 2026-07-01

### Fixed
- **React warning "Each child in a list should have a unique key" di halaman Hutang/Piutang Internal** (`app/(dashboard)/purchase-orders/internal/payables/_components/payables-client.tsx`). Baris tabel dibungkus Fragment `<>` sementara `key` dipasang pada `<tr>` di dalamnya, bukan pada elemen terluar list. Diganti ke `<Fragment key={p.id}>`.

## [1.30.1] - 2026-07-01

### Added
- **Badge di nav tab Web POS** (`components/pos/pos-nav-tabs.tsx`). Endpoint baru `GET /api/pos/nav-badges` (di-scope ke cabang sesi POS) mengembalikan jumlah item yang perlu tindakan; badge kecil ditumpuk di pojok ikon tab. Di-refresh saat mount, pindah halaman, dan tiap 60 detik.
  - **Kasir** (`/pos`) — jumlah open bill (transaksi ditahan) cabang.
  - **Transfer Masuk** (`/pos/incoming-transfers`) — transfer antar cabang berstatus `IN_TRANSIT` menuju cabang (barang perlu diterima).

## [1.30.0] - 2026-07-01

### Added
- **Badge jumlah item pending di menu sidebar** (`app/(dashboard)/_components/sidebar.tsx`). Endpoint baru `GET /api/bo/nav-badges` mengembalikan jumlah item yang butuh aksi per menu, di-scope ke cabang & peran (OWNER/GM lihat semua cabang, peran lain hanya cabangnya). Badge muncul di item menu; saat grup diciutkan, total badge grup tampil di header. Di-refresh saat mount, pindah halaman, dan tiap 60 detik.
  - **Purchase Orders** — PO `PENDING_APPROVAL`.
  - **Transfer Internal** — transfer antar cabang yang masih berjalan (belum `FULLY_RECEIVED`/`CANCELLED`) yang melibatkan cabang.
  - **Hutang/Piutang Internal** — inter-branch payables `UNPAID`/`PARTIAL`.
  - **Stock Opname** — opname `PENDING`.
  - **Piutang** — piutang pelanggan `UNPAID`/`PARTIAL`.

## [1.29.3] - 2026-07-01

### Added
- **Badge jumlah open bill di tombol "Daftar Tunggu"** (`components/pos/pos-client.tsx`). Jumlah bill tertahan cabang aktif ditampilkan sebagai badge; di-refresh saat halaman dimuat, setelah menahan transaksi, dan setelah drawer Daftar Tunggu ditutup (mencakup lanjutkan/hapus). Badge disembunyikan saat tidak ada bill.

## [1.29.2] - 2026-07-01

### Added
- **Hotkey Web POS: `F8` → Tahan transaksi, `F9` → Pilih pelanggan** (`components/pos/pos-client.tsx`). Aktif dari mana saja saat tidak ada modal terbuka; `F8` hanya jalan bila keranjang berisi item. Hint `kbd` ditambahkan pada tombol Tahan dan baris Pilih Pelanggan di keranjang (`cart-panel.tsx`).

## [1.29.1] - 2026-07-01

### Fixed
- **Hapus/lanjutkan open bill selalu error "Open bill tidak ditemukan"** padahal bill terhapus di DB (`app/api/pos/open-bills/[id]/route.ts`). Penyebab: driver `postgres-js` mengembalikan `RowList` array-like dengan `length === 0` saat `DELETE` tanpa `RETURNING`, sehingga cek 404 selalu terpicu. Route kini memakai `.returning({ id })` dan menentukan 404 dari jumlah baris yang benar-benar terhapus.

## [1.29.0] - 2026-07-01

### Added
- **Open Bill (Tahan Transaksi) di Web POS** (`components/pos/`). Backend (`/api/pos/open-bills`) & tabel `open_bills` sudah ada sebelumnya, kini punya UI penuh:
  - **Tombol "Tahan"** di keranjang (desktop `cart-panel.tsx` & mobile `mobile-cart-bar.tsx`) membuka dialog `hold-bill-dialog.tsx` untuk menyimpan keranjang aktif sebagai bill tertahan (nama bill opsional, default otomatis berdasarkan jam). Keranjang dikosongkan setelah berhasil ditahan.
  - **Drawer "Daftar Tunggu"** (`open-bills-drawer.tsx`) di bar info shift menampilkan daftar bill tertahan cabang aktif (nama, waktu, jumlah item, total). Aksi **Lanjutkan** memuat kembali item ke keranjang lalu menghapus bill dari daftar; aksi **Hapus** membuang bill. Konfirmasi muncul bila keranjang aktif akan tergantikan saat melanjutkan bill.
  - Cart store menambah `restoreCart(items)` untuk memuat ulang item bill ke keranjang (`cart-store.ts`).

## [1.28.2] - 2026-07-01

### Fixed
- **HPP Laporan Penjualan per Produk salah untuk sebagian produk (memakai harga modal UOM tertinggi).** Penyebab: snapshot `transaction_items.cogs` historis sebagian korup — sebagian memakai harga modal UOM tertinggi (mis. per SAK/DUS diterapkan per unit base) dan sebagian ×1000 dari format desimal lama sebelum migrasi 21 Mei 2026. Master cost (`default_cost_price` & `product_uom_costs`) saat ini sudah benar per base UOM.
  - **Report kini menghitung ulang HPP** dari harga modal per base UOM saat ini (`product_uom_costs` UOM dasar → `default_cost_price`) × qty base (`qty × ratio`), memakai snapshot lama hanya bila master cost tidak tersedia (`lib/services/report-service.ts`).
  - **Migrasi data:** 174 baris `transaction_items.cogs` yang menyimpang materiil (>2% & >Rp100) diperbaiki dengan formula yang sama (total HPP baris tsb Rp 223.344.607 → Rp 6.169.555). Backup di tabel `petshop.transaction_items_cogs_bak_20260701`. Laporan Laba Rugi (yang membaca kolom `cogs`) ikut terkoreksi. Script: `apps/db-compare/fix-cogs-highest-uom-20260701.mjs`.
- **Duplikat `product_uom_conversions` menggelembungkan SUM di laporan.** 7 baris duplikat (UOM DUS, rasio identik) dihapus, dan ditambahkan unique constraint `(product_id, uom_id)` untuk mencegah terulang (`packages/db/src/schema/products.ts`).

## [1.28.1] - 2026-07-01

### Changed
- **Laporan Penjualan per Produk — layout muat 1 layar penuh** (`app/(dashboard)/reports/sales-by-product/`). Halaman kini memakai tinggi penuh (`h-full flex flex-col`) sehingga header, filter, kartu nilai stok, dan tabel muat tanpa scroll halaman.
  - **Tabel transaksi produk kini scroll mandiri** di area sendiri (`flex-1 min-h-0 overflow-auto`) dengan header tabel sticky.
  - Saat produk dipilih, tabel laporan menyusut ringkas (produk tunggal) dan sisa ruang diberikan ke tabel transaksi; saat tanpa filter produk, tabel laporan yang mengisi sisa tinggi dan scroll mandiri (header + baris TOTAL sticky).
  - Padding sel tabel & kartu dirampingkan (`py-3`, kartu `p-4`) agar lebih padat.

## [1.28.0] - 2026-07-01

### Added
- **Laporan Penjualan per Produk — filter toko, daftar transaksi, & kartu nilai stok** (`app/(dashboard)/reports/sales-by-product/`).
  - **Filter Toko (opsional)** di form filter — kosong = semua toko. Diteruskan ke `getSalesByProductReport()` (memfilter `transactions.branchId`) dan ikut ke Export CSV (`branchId`).
  - **Kartu Nilai Stok** produk terpilih: total nilai stok saat ini (`qtyRemaining × costPrice`) beserta sisa qty (base UOM), dengan rincian per toko bila stok tersebar di lebih dari satu toko. Service baru `getProductStockValue()`.
  - **Daftar transaksi yang memuat produk terpilih** pada periode & toko terpilih (No. Transaksi, Tanggal, Toko, Qty, Subtotal Produk), maksimal 200 transaksi terbaru. Service baru `getTransactionsWithProduct()`.
  - Kartu nilai stok & daftar transaksi hanya muncul saat sebuah produk dipilih.

## [1.27.0] - 2026-07-01

### Fixed
- **Error `Processing image failed — The PNG is not in RGBA format!` saat dev/build.** `app/favicon.ico` (dan sumbernya `public/icon-512.png`) tersimpan sebagai PNG **RGB** tanpa alpha, sedangkan decoder gambar Next.js/Turbopack mewajibkan **RGBA** untuk entri PNG di dalam ICO. Kedua file digenerate ulang sebagai RGBA (favicon multi-ukuran 16/32/48/64/256 px).

### Added
- **Laporan Penjualan per Produk** (`app/(dashboard)/reports/sales-by-product/`). Halaman laporan baru yang merinci penjualan per produk pada periode pilihan: **Qty Terjual**, **Jumlah Transaksi**, **Pendapatan**, **HPP**, dan **Laba Kotor**, lengkap dengan baris **TOTAL**.
  - Filter tanggal (dengan preset **Hari Ini / Kemarin / Minggu Ini / Bulan Ini**) plus **selector produk opsional** memakai komponen `ProductSelect` yang sudah ada (`components/ui/product-select.tsx`) — kosong = semua produk.
  - Service `getSalesByProductReport()` di `lib/services/report-service.ts` mengagregasi `transactionItems` dari transaksi `COMPLETED`, memakai HPP fallback (`cogs` → `productUomCosts` → `defaultCostPrice × ratio`) yang konsisten dengan Laporan Laba Rugi. Pendapatan = `totalPrice - discountAmount`, diurutkan menurun berdasarkan pendapatan.
  - Export CSV via `app/api/bo/reports/sales-by-product/export/route.ts`.
  - Menu ditambahkan di sidebar grup **Laporan**.

## [1.26.9] - 2026-07-01

### Added
- **Rincian pengeluaran di cetak settlement shift** (`components/pos/settlement-print.tsx`). Struk settlement kini menampilkan section **RINCIAN PENGELUARAN** berisi tiap item pengeluaran (kategori, nominal, waktu, kasir, dan catatan) beserta baris **Total Pengeluaran**, tidak lagi hanya angka total. Berlaku untuk cetak saat tutup shift maupun cetak ulang dari Riwayat Shift.
  - API settle (`app/api/pos/shifts/[id]/settle/route.ts`) kini mengembalikan daftar `expenses` (join ke kategori) pada response settlement.
  - Tipe `ShiftBreakdownSummary` ditambah field `expenses?: ShiftExpenseDetail[]` (`packages/shared/src/types/shift.ts`).

## [1.26.8] - 2026-07-01

### Changed
- **Favicon web kini sama dengan icon PWA.** `app/favicon.ico` (sebelumnya favicon default Next.js) diganti dengan logo Hammielion (kucing + anjing + kasir) yang dibuat dari `public/icon-512.png`. File ICO multi-ukuran (16/32/48/64/256 px) agar tajam di tab browser maupun bookmark.

## [1.26.7] - 2026-07-01

### Added
- **Hotkey di modal pembayaran Web POS** (`components/pos/checkout-modal.tsx`) untuk transaksi lebih cepat tanpa mouse:
  - **`Esc`** → tutup/batal modal (nonaktif saat sedang memproses).
  - **`Alt+1` … `Alt+9`** → pilih metode pembayaran sesuai urutan tombol (mode bayar tunggal).
  - **`F1`** → isi **Uang Pas** (nominal pas sebesar total).
  - **`F2` / `F3` / `F4`** → isi pecahan tunai **20rb / 50rb / 100rb** (hanya saat metode tunai).
  - Setiap tombol terkait diberi label `kbd` kecil sebagai petunjuk hotkey.

## [1.26.6] - 2026-07-01

### Fixed
- **Tombol "Bayar" di Web POS tertutup / harus scroll dulu pada PWA desktop (mode standalone).** Root layout POS (`app/pos/(authenticated)/layout.tsx`) memakai `min-h-dvh` (tinggi *minimum*), sehingga keranjang dengan banyak item membuat seluruh dokumen membesar & ikut ter-scroll, mendorong tombol Bayar ke bawah lipatan. Diubah ke `h-dvh` + `overflow-hidden` (tinggi *tetap* sebesar viewport) agar tombol Bayar selalu terkunci di bawah panel keranjang. `<main>` diberi `overflow-y-auto` supaya halaman menu POS yang panjang (mis. Kelola Produk) tetap bisa di-scroll di dalam area konten.

## [1.26.5] - 2026-07-01

### Added
- **Notifikasi update PWA.** Saat service worker versi baru terdeteksi (deploy baru) sementara tab masih terbuka, muncul banner "Versi baru tersedia" + tombol **Muat ulang** (`app/_components/service-worker-register.tsx`). SW baru kini **menunggu** (tidak `skipWaiting` otomatis) dan hanya mengambil alih setelah user menekan tombol — menghindari mismatch chunk di tengah sesi. Instalasi pertama tetap aktif langsung tanpa banner.
- **Identitas app stabil di manifest** (`id: '/'`) agar browser mengenali PWA sebagai aplikasi yang sama lintas perubahan `start_url`.

### Changed
- **Cache aset statis SW dibatasi maksimal 100 entri** (`public/sw.js`, `trimCache` FIFO) supaya chunk `_next/static` ber-hash dari deploy lama tidak menumpuk tanpa batas. Halaman `/offline` dikecualikan dari pembersihan.

### Fixed
- **Manifest gagal di-parse browser ("Manifest: Line 1, column 1, Syntax error").** `middleware.ts` memproteksi semua path, sedangkan browser mem-fetch `/manifest.webmanifest` **tanpa cookie** → di-redirect 307 ke `/login` (HTML) sehingga gagal di-parse sebagai JSON. Aset PWA (`/manifest.webmanifest`, `/sw.js`, `/offline`, `/icon*`) kini dikecualikan dari proteksi auth. Route lain tetap terjaga.

## [1.26.4] - 2026-06-30

### Added
- **Halaman fallback offline untuk PWA** (`app/offline/page.tsx`). Saat service worker aktif dan koneksi putus, navigasi/refresh tidak lagi menampilkan layar putih melainkan halaman "Tidak ada koneksi" bermerek dengan tombol **Coba lagi**.
  - `public/sw.js` di-naikkan ke `hammielion-static-v2`: precache `/offline` saat `install`, dan request navigasi (`request.mode === 'navigate'`) memakai strategi network-first dengan fallback ke `/offline` bila network gagal. Aset statis & strategi HTML/API-selalu-network lainnya tidak berubah.

### Fixed
- **Atribut `lang` root layout diperbaiki dari `en` → `id`** (`app/layout.tsx`) agar konsisten dengan `lang: 'id'` pada manifest dan konten dashboard berbahasa Indonesia.

## [1.26.3] - 2026-06-30

### Fixed
- **Scan barcode di checkout POS kini mengenali barcode alternatif (`product_barcodes`).** Sebelumnya `GET /api/pos/products?barcode=` hanya mencocokkan `products.barcode` & `products.sku`, sehingga produk dengan barcode tambahan tidak ditemukan saat transaksi (padahal bisa di stock-opname). Query ditambah subquery ke `product_barcodes` agar konsisten dengan `findProductByBarcode`.
- **Scan HID scanner ke kotak cari membuka produk salah.** Saat kotak cari sedang fokus, karakter scanner masuk ke query dan Enter tiba sebelum debounce 300ms, sehingga produk yang dibuka diambil dari daftar basi. Ditambahkan deteksi burst keystroke (`<50ms`/karakter) di `onKeyDown`: bila terdeteksi scan, panel langsung melakukan lookup barcode persis alih-alih membuka item ter-highlight.
- **Scanner kamera tidak fokus pada barcode kecil.** Komponen `BarcodeScanner` kini meminta resolusi tinggi (1920×1080), mengaktifkan continuous autofocus via `applyConstraints({ advanced: [{ focusMode: 'continuous' }] })` setelah stream jalan, dan menampilkan slider zoom bila perangkat mendukungnya — sehingga barcode kecil bisa difokuskan/diperbesar.

## [1.26.2] - 2026-06-29

### Added
- **Copy harga antar cabang kini juga menyalin harga modal (cost price).** Endpoint `POST /api/bo/master-data/prices/copy-branch` menambahkan INSERT kedua ke `product_uom_costs` (tanpa markup). Preview menampilkan jumlah harga jual dan harga modal secara terpisah. Response mencatat total gabungan.

## [1.26.1] - 2026-06-29

### Fixed
- **Harga modal per-satuan (matriks cost) kosong setelah reset master.** `product_uom_costs` ikut terhapus saat wipe dan tidak diisi importer (file hanya punya 1 angka MODAL per produk). Dibangun ulang untuk cabang Toko Pusat dari `default_cost_price`: satuan dasar = modal, satuan konversi = modal × rasio (1.379 baris). `products.default_cost_price` sendiri tetap terisi (932/966; 34 sisanya memang tanpa MODAL di sumber).

## [1.26.0] - 2026-06-29

### Changed
- **Reset total master produk + reimport bersih dari `DAFTARPRODUK.xlsx` (sheet TOKO PUSAT).** Master lama kotor (48 grup nama duplikat/typo → base unit & modal banyak salah). Seluruh produk (1.566) + relasinya dihapus, lalu dibangun ulang 966 produk kanonik dari file.
  - Base unit, modal, harga (tier A=RETAIL, B=RESELLER, C=GROSIR), dan konversi satuan kini bersumber langsung dari file → konsisten, tanpa duplikat.
  - Berat (`weight_gram`) & SKU diisi dari `apps/db-compare/product-weights.csv`.
  - **Histori transaksi aman:** `transaction_items` mempertahankan snapshot nama; 1.274 item di-relink otomatis ke produk baru via nama, 233 sisanya tetap bernama lewat snapshot (product_id NULL).
  - **Konsekuensi yang disetujui:** harga/katalog cabang selain Toko Pusat dikosongkan; histori non-transaksi yang terhapus = `stock_adjustments` (478) & `inter_branch_transfer_items` (131).
  - Tooling di `apps/excel-tools`: `backup-wipe.js`, `wipe-products.js`, `import-daftarproduk.js`, `relink-txn-items.js` (semua punya dry-run). Backup penuh tersimpan sebelum eksekusi.

## [1.25.0] - 2026-06-29

### Added
- **Snapshot identitas produk di item transaksi.** `transaction_items` kini menyimpan `product_name` & `product_sku` yang dibekukan saat penjualan, sehingga struk & riwayat lama tetap akurat walau master produk diubah, di-merge, atau dihapus.
  - Migration `20260629000000_transaction_item_product_snapshot.sql`: tambah kolom + backfill 1.507 baris lama dari master saat ini.
  - `TransactionService.createTransaction` (jalur tunggal untuk POS online, offline-sync, & bulk sale) mengisi snapshot saat insert.
  - Pembacaan riwayat (`api/bo/transactions/[trxNumber]/detail`, halaman POS `history`) memakai `COALESCE(snapshot, nama master)` agar tahan terhadap produk yang hilang.

### Changed
- **FK `transaction_items.product_id` dilonggarkan** jadi nullable + `ON DELETE SET NULL`. Produk yang benar-benar dihapus tidak lagi merusak histori transaksi — `product_id` menjadi NULL, nama tetap terbaca dari snapshot.
  - Void transaksi & proses retur kini melewati / menolak item yang produknya sudah dihapus (stok tidak bisa dikembalikan ke produk yang tiada).
  - Clone-to-cart menyaring item produk terhapus; cetak ulang struk tetap menampilkannya via snapshot.

## [1.24.0] - 2026-06-29

### Changed
- **Re-import katalog produk cabang Toko Pusat dari `DAFTARPRODUK.xlsx`** (sheet TOKO PUSAT, 966 produk) via `apps/excel-tools/import-daftarproduk.js`. Operasi **branch-scoped** agar transaksi & cabang lain tetap utuh:
  - **Harga** cabang Toko Pusat dihapus lalu dibangun ulang (3.098 baris); tier dipetakan **HARGA JUAL A→RETAIL, B→RESELLER, C→GROSIR**. Harga cabang lain **tidak** disentuh.
  - **Konversi satuan** dibangun ulang per-produk dari kolom KONVERSI (`SATUAN 1/2/3`).
  - **Produk** di-upsert by name (95 insert, 871 update); **base unit dipertahankan** untuk produk lama (aman terhadap stok). 28 produk leftover Toko Pusat dinonaktifkan; 572 produk milik cabang lain dibiarkan aktif.
  - **Berat/tonase** (`weight_gram`) & **SKU** diisi dari `apps/db-compare/product-weights.csv` (join by name).
  - 913 transaksi, 1.507 item, dan 567 baris stok tetap utuh (0 orphan).

### Added
- **Tooling impor & backup produk** di `apps/excel-tools`: `import-daftarproduk.js` (dry-run default, `--execute`), `backup-products.js` (dump JSON tabel `products`, `product_prices`, `product_uom_conversions`), dan `restore-products.js` untuk restore dari backup.

## [1.23.0] - 2026-06-28

### Added
- **Backoffice kini menjadi PWA (installable / app-like).** Dashboard bisa di-**Install / Add to Home Screen** dan dibuka mode standalone (fullscreen tanpa address bar) di desktop maupun HP:
  - **Web App Manifest** (`app/manifest.ts` → `/manifest.webmanifest`): nama, `display: standalone`, `theme_color` brand amber `#d97706`, `background_color` `#f9fafb`.
  - **Icon PWA** persegi `192×192`, `512×512`, dan versi **maskable** (`public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`).
  - **Service worker minimal** (`public/sw.js`) yang **hanya** men-cache aset statis (`/_next/static`, icon, manifest); HTML & API **selalu** dari network agar data dashboard ber-auth tidak pernah basi. SW hanya diregistrasi di **production** (`ServiceWorkerRegister`).
  - Metadata `manifest`, `themeColor`, `appleWebApp`, dan apple-touch-icon ditambahkan di `app/layout.tsx`.
  - **Catatan:** ini PWA installable, **bukan** offline penuh — tetap butuh koneksi untuk data.

## [1.22.1] - 2026-06-28

### Fixed
- **Error tipe pada refactor performa create transaction.** `productIds` di `transaction-service.ts` ter-infer sebagai `unknown[]` (karena `items` bertipe `any`), sehingga `inArray(...)` gagal kompilasi. Ditambahkan anotasi `: number[]` agar typecheck backoffice lolos.

## [1.22.0] - 2026-06-28

### Added
- **Ubah Tier Harga massal di keranjang Web POS.** Tombol **"Ubah Tier"** di header keranjang (`/pos`) membuka dialog pemilih tier; saat dipilih, **semua item di keranjang** langsung di-_re-price_ ke tier tersebut tanpa perlu menghapus & menambah ulang.
  - Tiap item kini menyimpan peta tier harga (`tierPrices`) saat ditambahkan, sehingga ganti tier massal tidak perlu fetch ulang harga.
  - Item yang tidak memiliki tier terpilih **dibiarkan apa adanya** (dialog menampilkan berapa item yang tercakup tiap tier).
  - Item yang menjadi identik (produk+UOM+tier sama) setelah diubah **otomatis digabung** dan qty-nya dijumlahkan.

## [1.21.0] - 2026-06-28

### Added
- **Fitur Pendapatan & Pengeluaran (Arus Kas).** Menu baru **Keuangan** di sidebar untuk mencatat arus kas masuk/keluar per cabang:
  - **CRUD Kategori Kas** (`/cash-flow/categories`): kelola kategori terpisah untuk tipe **Pendapatan** dan **Pengeluaran**. Nama unik per tipe (kategori dengan nama sama boleh ada di tipe berbeda). Kategori yang sudah dipakai transaksi tidak bisa dihapus. Akses mutasi: OWNER, GM, MANAGER.
  - **Pencatatan transaksi kas** (`/cash-flow`): form input dengan **tipe** (pendapatan/pengeluaran), **user input** (otomatis dari sesi login/JWT), **kategori** (daftar mengikuti tipe yang dipilih), **total**, dan **catatan** (opsional). Halaman menampilkan ringkasan total pendapatan, pengeluaran, dan selisih, beserta riwayat transaksi cabang dengan filter per tipe.
- **Tabel baru** `petshop.cash_flow_categories` dan `petshop.cash_flow_entries` (migrasi `20260628000000_cash_flow.sql`). Total disimpan sebagai **integer** (Rupiah), `branch_id` dan `created_by` diisi otomatis dari JWT.
- **Endpoint API**: `GET/POST /api/bo/cash-flow/categories`, `PATCH/DELETE /api/bo/cash-flow/categories/[id]`, `GET/POST /api/bo/cash-flow/entries` (daftar transaksi otomatis difilter per cabang sesuai JWT).

## [1.20.0] - 2026-06-25

### Added
- **Generator & Cetak Label Barcode massal** untuk produk yang belum punya barcode (`Master Data → Cetak Barcode`, `/master-data/products/barcode-print`).
  - **Generate barcode internal EAN-13** (prefix GS1 in-store `2`) yang deterministik & unik dari ID produk. Kode dijamin terbaca scanner dan tidak bentrok dengan barcode pabrikan. Hasil generate **disimpan ke `products.barcode`** sehingga produk langsung bisa di-scan di kasir.
  - **Cetak massal dalam lembar**: pilih produk (multi-select + pilih semua hasil filter), atur **jumlah label per produk**, pilih **preset layout lembar A4** (3×8, 3×11, 4×10, 5×13), dan **offset awal** untuk memakai sisa lembar stiker yang sudah terpakai sebagian. Preview tampil sebelum cetak; render via `window.print()` (bisa Simpan sebagai PDF).
  - Toggle tampilkan **nama produk** & **kode angka** pada label.
- **Endpoint `GET /api/bo/products/without-barcode`** — daftar produk aktif yang belum memiliki barcode.
- **Endpoint `POST /api/bo/products/generate-barcodes`** — bulk-generate barcode EAN-13 internal (idempoten, hanya untuk role `OWNER`/`GM`).
- Dependency baru: `jsbarcode` untuk render barcode EAN-13 ke SVG di sisi client.

## [1.19.0] - 2026-06-24

### Added
- **Stock Opname Besar (FULL) dari admin kini bisa dikerjakan kasir di Web POS.** Sebelumnya admin sudah bisa **memulai SO Besar** dari dashboard (`Inventory → Stock Opname → Mulai SO Besar`) dan endpoint POS-nya (`active-full`, `add-items`) sudah ada, tetapi **belum ada tampilan di POS** untuk mengerjakannya. Kini:
  - Saat ada SO Besar aktif untuk cabang, halaman SO mandiri (`/pos/produk/stock-opname`) menampilkan **banner pemberitahuan** yang mengarahkan kasir ke `/pos/produk/stock-opname/besar`.
  - Alur penghitungan **sama dengan SO mandiri** (hitung buta → review selisih, alasan wajib untuk item ber-selisih), namun hasil hitungan **disimpan ke SO Besar yang dibuat admin** (`PATCH /api/pos/stock-opnames/[id]/add-items`), bukan membuat SO baru.
  - Penghitungan bersifat **bertahap**: kasir bisa menyimpan sebagian, lalu lanjut menghitung produk lain (item di-_upsert_ per produk+UOM). Admin menyetujui SO di dashboard saat sudah lengkap.

### Changed
- Komponen `stock-opname-client.tsx` digeneralisasi dengan prop `mode` (`MANDIRI` | `FULL`) agar UI hitung-buta, scanner, pemilih UOM, dan review selisih dipakai ulang oleh kedua alur. Mode `FULL` mendeteksi SO aktif via `GET /api/pos/stock-opnames/active-full` dan menampilkan status muat/kosong bila tidak ada SO.

## [1.18.0] - 2026-06-24

### Added
- **Stock Opname mandiri dari Web POS (mobile).** Menu **Kelola Produk → Stock Opname** (`/pos/produk/stock-opname`) kini aktif, memungkinkan kasir melakukan SO harian (`DAILY`) lewat HP dengan alur **2 tahap**:
  - **Tahap 1 — Hitung (buta):** pilih produk via pencarian manual, daftar **Produk Laris**/**Terjual Hari Ini**, atau **scan barcode** kamera. Stok sistem **disembunyikan** selama penghitungan agar hitungan objektif. Tiap baris bisa memilih satuan (UOM) dan input jumlah fisik.
  - **Tahap 2 — Review Selisih:** sistem menghitung selisih; hanya item ber-selisih yang ditampilkan (qty sistem vs fisik + nilai rupiah). **Alasan wajib diisi** untuk tiap item ber-selisih sebelum diajukan. SO masuk antrian persetujuan admin di dashboard (status `PENDING`).
- **Endpoint `POST /api/pos/stock-opname/preview`** — menghitung selisih per item tanpa menyimpan (dipakai Tahap 2).
- **Endpoint `GET /api/pos/stock-opname/count-candidates`** — daftar produk kandidat SO tanpa stok (blind count), lengkap dengan opsi UOM; mendukung mode `method`/`q` (browse) dan `barcode` (hasil scan).

### Changed
- Logika perhitungan selisih SO (agregasi UOM + FIFO) diekstrak ke `lib/services/stock-opname.ts` dan dipakai bersama oleh endpoint submit & preview.
- `POST /api/pos/stock-opnames` kini memvalidasi **alasan wajib** dari sisi server bila sebuah item memiliki selisih (pengaman dari bypass).

## [1.17.2] - 2026-06-23

### Fixed
- **Mutasi stok dari transfer antar cabang (PO internal) kini tercatat di halaman Mutasi Stok.** Sebelumnya stok yang masuk ke cabang penerima saat transfer diterima — dan stok yang keluar dari cabang pengirim saat dikirim — tidak pernah muncul di laporan Mutasi Stok karena view mutasi tidak membaca tabel `inter_branch_transfer_items`.
  - Ditambahkan dua sumber mutasi baru: **Transfer Keluar** (`TRANSFER_OUT`, stok berkurang di cabang pengirim, berbasis `qty_shipped`) dan **Transfer Masuk** (`TRANSFER_IN`, stok bertambah di cabang penerima, berbasis `qty_received`).
  - Filter "Jenis Mutasi" di halaman Mutasi Stok kini punya opsi Transfer Keluar & Transfer Masuk; harga satuan memakai HPP saat transfer (`cost_price_at_transfer`).

## [1.17.1] - 2026-06-23

### Changed
- **Catatan pada form PO Internal (Web POS) kini wajib diisi.** Label diubah dari "Catatan (opsional)" menjadi "Catatan *" dan ditambahkan validasi: permintaan transfer tidak dapat dikirim bila catatan kosong.

## [1.17.0] - 2026-06-23

### Added
- **Daftar & detail PO Internal di Web POS.** Tab **PO Internal** (`/pos/internal-order`) kini menampilkan **daftar PO internal yang sudah dibuat di cabang tersebut** (transfer dengan cabang tujuan = cabang aktif), lengkap dengan nomor IBT, cabang pengirim, tanggal, status, dan estimasi nilai.
  - Setiap baris dapat diklik untuk membuka **modal detail** (status, pemohon, penyetuju, daftar produk beserta qty minta/kirim/terima, catatan) via `GET /api/bo/internal-transfers/[id]`.
  - Form pembuatan PO dipindah ke tampilan terpisah yang dibuka lewat tombol **+ Buat PO Internal**; setelah berhasil dibuat, tampilan otomatis kembali ke daftar dan me-refresh data.

### Changed
- **Refactor komponen tab PO Internal.** `internal-order-client.tsx` kini menjadi orkestrator daftar/detail/buat; form pembuatan dipisah ke `internal-order-form.tsx` dan detail ditampilkan oleh `internal-order-detail-modal.tsx`.

## [1.16.0] - 2026-06-23

### Changed
- **Kasir kini dapat melihat & mengonfirmasi Transfer Masuk di Web POS.** Tab **Transfer Masuk** (`/pos/incoming-transfers`) sebelumnya disembunyikan dan diblokir untuk role `KASIR`; kini tab tampil untuk semua role POS dan kasir dapat menerima barang transfer internal yang ditujukan ke cabangnya.
  - Tab navigasi POS selalu menampilkan **Transfer Masuk** (gate `role !== 'KASIR'` dihapus).
  - Halaman `/pos/incoming-transfers` tidak lagi me-redirect kasir ke `/pos`.
  - API `PATCH /api/bo/internal-transfers/[id]/status` menambahkan `KASIR` ke daftar role yang boleh melakukan aksi `receive`. Pembatasan cabang tetap berlaku — kasir hanya bisa menerima transfer yang ditujukan ke cabangnya sendiri.

## [1.15.0] - 2026-06-23

### Added
- **Bypass stok kurang saat konfirmasi pengiriman Transfer Internal (otorisasi PIN Owner).** Pada detail transfer internal, saat admin/gudang mengonfirmasi pengiriman dan qty kirim melebihi **stok sistem** cabang pengirim, pengiriman kini tetap bisa dilanjutkan tanpa harus menurunkan qty.
  - Form pengiriman mendeteksi kekurangan stok dan menampilkan peringatan; tombol berubah menjadi **"Kirim dengan Otorisasi Owner"**.
  - Sebelum dikirim, muncul **challenge PIN Owner** cabang pengirim. PIN divalidasi di server (`argon2`) terhadap owner aktif cabang sumber.
  - Setelah PIN valid, stok cabang pengirim **dipotong penuh sebesar qty kirim** sehingga baris stok produk (unik per cabang) menjadi **minus** sebesar kekurangannya — deficit tetap terekam dan dapat direkonsiliasi via Stock Adjustment / Stock Opname.
  - Aksi bypass dicatat di `audit_logs` (`INTERNAL_TRANSFER_SHIP_STOCK_BYPASS`) berisi user, cabang, nomor IBT, dan rincian item yang kekurangan stok.
  - API `PATCH /api/bo/internal-transfers/[id]/status` menerima parameter opsional `ownerPin`. Tanpa PIN, perilaku lama dipertahankan (pengiriman melebihi stok ditolak `409`).

## [1.14.1] - 2026-06-23

### Added
- **Pagination di Riwayat Transaksi Web POS.** Halaman Riwayat (`/pos/history`) kini dipaginasi (20 transaksi per halaman) sehingga kasir dapat melihat **seluruh** transaksi pada shift aktif, tidak lagi terbatas 50 transaksi terakhir (mode tanggal sebelumnya terbatas 100).
  - Kontrol **‹ Sebelumnya / Berikutnya ›** dengan indikator **Halaman X dari Y** di bagian bawah daftar; nomor halaman tersinkron ke URL (`?page=`).
  - Label ringkasan kini menampilkan **total transaksi sebenarnya** (hasil `COUNT`), bukan jumlah baris yang sedang ditampilkan.
  - Berlaku untuk mode **Shift Aktif** maupun **Pilih Tanggal**. Saat mencari nomor struk, semua hasil yang cocok tetap dimuat sekaligus (pagination nonaktif) dan halaman otomatis kembali ke awal.

## [1.14.0] - 2026-06-23

### Added
- **Filter Customer & Metode Bayar di Riwayat Transaksi.** Halaman Riwayat Transaksi (Dashboard Back Office) menambahkan dua filter baru:
  - **Customer** — input **autocomplete** yang mengambil dari daftar customer yang sudah ada (`GET /api/customers`, cari nama/telepon, debounce 300 ms, navigasi keyboard ↑/↓/Enter, tombol × untuk menghapus). Filter dilakukan berdasarkan customer terpilih (`customerId`), bukan teks bebas.
  - **Metode Bayar** — dropdown daftar metode pembayaran; menampilkan transaksi yang memuat metode terpilih (mendukung transaksi pembayaran campuran), diterapkan via subquery `EXISTS`.
  - Kedua filter ikut tersinkron ke URL (shareable) dan ke tombol **Terapkan**/**Reset Filter**. API `GET /api/bo/transactions` menerima parameter `customerId` dan `paymentMethodId`; total & paginasi tetap akurat.

## [1.13.1] - 2026-06-23

### Changed
- **Header struk tidak lagi menampilkan baris nama cabang.** Karena Nama di Struk sudah dapat diatur per cabang (mewakili identitas cabang), baris nama cabang yang terpisah dihapus dari header struk penjualan & settlement. Header kini ringkas: **Nama di Struk**, alamat, lalu **Telp: kontak**.

## [1.13.0] - 2026-06-23

### Added
- **Konfigurasi header struk per cabang.** Header struk (penjualan & settlement) yang sebelumnya hardcode `HAMMIELION` kini dapat diatur per cabang.
  - **Skema `branches.receipt_name`.** Kolom baru `receipt_name` (varchar 100, NOT NULL, default `HAMMIELION`) untuk menyimpan teks header besar struk per cabang. Migrasi: `20260623000000_add_receipt_name_to_branches.sql`. Field `address` & `phone` cabang yang sudah ada kini ikut dipakai sebagai alamat & kontak di struk.
  - **Pengaturan Cabang.** Form edit cabang (Settings → Cabang) menambahkan input **Nama di Struk** (default `HAMMIELION`). API `PATCH /api/bo/settings/branches/[id]` menerima & memvalidasi `receiptName` (1–100 karakter); hanya OWNER yang dapat mengubah.
  - **Tampilan struk.** Header struk penjualan & laporan settlement kini menampilkan **Nama di Struk** (header besar), nama cabang, **alamat**, dan **Telp: kontak** — semua diambil dari data cabang aktif (mendukung override cabang multi-branch). Default tetap `HAMMIELION` bila belum diisi.

### Fixed
- **Pembayaran non-tunai (Transfer Bank / E-Wallet) tidak terhitung di total omzet settlement shift.** Pada cetak settlement, pembayaran via `BANK_TRANSFER` (mis. TRANSFER_BCA) atau `E-WALLET` muncul di daftar "TRANSAKSI NON-TUNAI" tetapi **tidak ikut** dijumlahkan ke total **Non-Tunai** maupun **OMZET**.
  - **Penyebab:** route `breakdown` (`GET .../breakdown`) dan `settle` (`POST .../settle`) membagi pembayaran per metode hanya menangani tipe `QRIS`, `DEBIT`, dan `CREDIT` untuk non-tunai. Tipe `DEBIT`/`CREDIT` bahkan tidak ada di sistem (legacy), sedangkan tipe non-tunai yang sebenarnya — `BANK_TRANSFER` dan `E-WALLET` — tidak masuk bucket manapun, sehingga nilainya hilang dari total non-tunai dan omzet.
  - **Perbaikan:** logika pembagian dibuat menyeluruh — `BANK_TRANSFER` dipetakan ke `totalSalesDebit`, dan `E-WALLET` (serta metode non-tunai lain di luar `CASH`/`DEBT`/`QRIS`) ke `totalSalesCredit`. Ketiga kolom non-tunai memang selalu dijumlahkan sebagai satu nilai "Non-Tunai" di tampilan, sehingga total kini benar tanpa perubahan skema DB.
  - **Catatan data lama:** shift yang sudah ditutup sebelum perbaikan (mis. 22 Juni) sudah menyimpan breakdown lama di tabel `shift_cashier_breakdown`, sehingga cetak ulang dari Back Office masih menampilkan angka lama. Perbaikan berlaku untuk shift yang ditutup setelah ini.

## [1.12.1] - 2026-06-23

### Fixed
- **Scanner barcode menampilkan kamera blank di HP.** Dua perbaikan: (1) elemen video memakai `autoPlay` dengan `muted`/`playsinline` yang di-set langsung pada properti elemen (bukan hanya atribut React) untuk mengatasi kebijakan autoplay browser mobile; (2) start kamera ditunda satu tick (`setTimeout`) agar tahan terhadap pemanggilan ganda React Strict Mode di dev — sebelumnya preview muncul sepersekian detik lalu blank karena `stop()` dari stream mount pertama ikut menghapus `srcObject` milik stream mount kedua. Constraint kamera belakang juga dilonggarkan ke `facingMode: { ideal: 'environment' }`.
- **Sidebar dashboard backoffice tidak muncul di tampilan mobile.** Sidebar sebelumnya `hidden md:flex` tanpa tombol pembuka, sehingga di layar < 768px navigasi dashboard tidak bisa diakses sama sekali. Kini sidebar menjadi **drawer geser** di mobile: tombol hamburger di pojok kiri header membuka drawer (dengan backdrop), menutup otomatis saat pindah halaman, dan mengunci scroll body saat terbuka. Definisi menu tetap satu sumber (dipakai ulang untuk tampilan desktop & drawer mobile).

## [1.12.0] - 2026-06-22

### Added
- **Menu Kelola Produk mobile di POS Web (barcode & stock opname).** *(dalam pengerjaan)*
  - **Skema `product_barcodes`.** Tabel baru untuk menampung barcode tambahan/alternatif per produk (kasus "kemasan sama, barcode berbeda"). Bersifat additive — `products.barcode` tetap menjadi barcode utama sehingga alur POS, sync bootstrap, dan master-data yang ada tidak terpengaruh. Migrasi: `20260622000000_add_product_barcodes.sql`.
  - **API barcode POS.** Helper lookup terpusat (`lib/services/barcode.ts`) yang mencari produk di kedua sumber barcode sekaligus, plus endpoint: `GET /api/pos/barcodes/lookup` (cari produk dari hasil scan), `GET`/`POST /api/pos/products/[id]/barcodes` (lihat & tambah barcode), `DELETE /api/pos/products/[id]/barcodes/[barcodeId]`. Saat menambah barcode: bila produk belum punya barcode utama, nilai diisi ke `products.barcode`; jika sudah, disimpan sebagai barcode tambahan. Uniqueness divalidasi lintas kedua tabel (konflik → 409).
  - **Menu "Produk" di POS Web (mobile).** Tab baru di navigasi POS berisi hub Kelola Produk. Halaman **Tambah / Scan Barcode**: cari & pilih produk, lihat barcode terdaftar (utama + tambahan), tambah barcode manual atau lewat **kamera HP** (`@zxing/browser`), dan hapus barcode tambahan. Scanner menampilkan peringatan bila bukan koneksi aman (kamera butuh HTTPS).

## [1.11.8] - 2026-06-22

### Fixed
- **Form PO Internal di POS Web: cabang yang dikunci ke kasir sekarang cabang tujuan (penerima), bukan cabang pengirim.** PO Internal adalah permintaan stok **masuk** ke cabang kasir dari cabang lain, sehingga yang seharusnya terkunci adalah cabang tujuan.
  - **Front-end:** untuk role non-global (KASIR, dll), **Cabang Tujuan** kini terkunci ke cabang kasir dan **Cabang Pengirim** yang dapat dipilih. Role OWNER/GM tetap bisa mengubah keduanya.
  - **Back-end:** validasi pembuatan transfer diubah dari `sourceBranchId === branchId` menjadi `destinationBranchId === branchId` agar konsisten — non-global user hanya boleh membuat permintaan transfer **ke** cabangnya sendiri.

## [1.11.7] - 2026-06-22

### Fixed
- **Settlement shift tidak menggabung penjualan kasir yang menyusul (gabung di tengah shift).** Saat kasir 1 buka shift lalu kasir 2 gabung dan melanjutkan sampai tutup toko, ringkasan settlement hanya menampilkan penjualan kasir 1 — transaksi kasir 2 tidak ikut dihitung.
  - **Penyebab:** breakdown (`GET .../breakdown`) dan settle (`POST .../settle`) menghitung per-kasir hanya dengan looping `shifts.assignedCashiers`, yang merupakan snapshot saat **buka** shift. Route `join` hanya membuat baris `shiftCashierSessions` tanpa menambahkan kasir ke `assignedCashiers`, sehingga transaksi kasir yang menyusul tidak pernah masuk perhitungan.
  - **Perbaikan:** daftar kasir untuk breakdown & settle kini diambil dari gabungan (union) `assignedCashiers` + sesi kasir (`shiftCashierSessions`) + `cashierId` aktual pada transaksi & expense shift tersebut. Bersifat self-healing — shift yang sedang terbuka pun kini tutup dengan total yang benar.
  - Route `join` juga ikut menambahkan kasir ke `assignedCashiers` agar jumlah kasir pada laporan shift akurat.
  - **Sembunyikan kasir tanpa aktivitas dari rincian settlement.** Kasir yang gabung shift tapi tidak melakukan penjualan dan tidak ada pengeluaran tidak lagi ditampilkan sebagai baris bernilai 0 di breakdown maupun settlement (dan tidak disimpan ke `shift_cashier_breakdown`).
- **Perbaiki error TypeScript yang menggagalkan build deployment.**
  - `stock-service.ts`: `batches` kini di-resolve dengan `??` sehingga selalu bertipe array (sebelumnya `possibly undefined` saat FIFO deduction).
  - `bootstrap-route.test.ts`: argumen `Request` di-cast agar cocok dengan tipe `NextRequest` yang diharapkan handler `GET`.

## [1.11.6] - 2026-06-22

### Added
- **Pilih produk minim mouse di POS Web (alur keyboard penuh).**
  - **Navigasi panah pada hasil cari.** Tekan `↑`/`↓` untuk memindah sorotan antar kartu produk, lalu `Enter` membuka produk yang **disorot** (sebelumnya `Enter` selalu mengambil produk pertama). Kartu tersorot otomatis di-scroll agar tetap terlihat, dan sorotan ikut mengikuti posisi mouse.
  - **Auto-refokus kotak cari.** Setelah menekan "Tambah ke Keranjang" atau menutup dialog, fokus otomatis kembali ke kotak cari sehingga alur "ketik → Enter → ketik → Enter" berjalan tanpa menyentuh mouse.
  - **Navigasi satuan & harga via keyboard di dialog.** Di dialog Pilih UOM & Harga: `←`/`→` mengganti satuan, `↑`/`↓` mengganti tier harga (petunjuk shortcut muncul di label bila ada lebih dari satu pilihan). `Enter` tetap menambah ke keranjang, `Esc` membatalkan.

## [1.11.5] - 2026-06-22

### Changed
- **Sederhanakan modal Pembayaran POS Web agar muat di layar kecil tanpa scroll.** Tata letak dirapatkan dan disusun ulang supaya kasir bisa fokus tanpa menggulir:
  - **Input Diskon kini collapsible** — disembunyikan di balik chip **+ Diskon** (otomatis tampil bila ada diskon). Tidak lagi memakan ruang di setiap transaksi yang umumnya tanpa diskon.
  - **Toggle Diskon & Bayar Gabungan (Split) digabung jadi sebaris chip** yang ringkas dan menunjukkan status aktif.
  - **Ringkasan total dipadatkan** jadi satu baris (item · subtotal · diskon di kiri, Total besar di kanan).
  - Ritme vertikal antar-bagian dirapatkan (`mb-5/mb-6` → `mb-3/mb-4`) tanpa mengubah ukuran target sentuh tombol utama. Semua fitur (split, hutang, quick fill nominal, kembalian) tetap lengkap.

## [1.11.4] - 2026-06-22

### Added
- **Pilihan satuan + konversi di form Penyesuaian Stok.** User kini bisa memilih satuan (satuan dasar maupun satuan konversi seperti Dus/Karton) saat menyesuaikan stok. Service `getProductsWithStock` mengembalikan `baseUomName` dan daftar `uoms` (base UOM + konversi dari `product_uom_conversions`) per produk.

### Changed
- **Rombak UX form Penyesuaian Stok jadi berbasis tambah/kurang (delta).** Sebelumnya user harus mengetik kuantitas absolut akhir; sekarang cukup memilih mode **+ Tambah Stok** / **− Kurangi Stok**, mengisi jumlah, dan satuan dipilih lewat dropdown inline di sebelah input. Form menampilkan pratinjau "Stok akhir" hasil konversi ke base UOM dan memvalidasi stok tidak cukup sebelum submit.
  - API `POST /api/bo/inventory/stock-adjustment` kini menerima `adjustmentType` (`add`/`subtract`), `qty`, dan `uomId`; jumlah dikonversi ke base UOM (×ratio), HPP dikonversi (÷ratio), lalu kuantitas akhir dihitung dari stok saat ini ± delta sebelum diterapkan.

## [1.11.3] - 2026-06-21

### Fixed
- **Perbaikan pergeseran zona waktu transaksi (+7 jam) di database lokal.** Koneksi database (`createDb` di `@petshop/db`) kini otomatis memaksa parameter session timezone ke `UTC` dengan menyisipkan `options=-c timezone=UTC` ke `DATABASE_URL`. Hal ini memastikan `now()` PostgreSQL mengevaluasi sebagai UTC untuk kolom `timestamp` tanpa timezone, menyelaraskan penyimpanan data baru baik di lingkungan lokal maupun produksi.
- **Sinkronisasi filter rentang tanggal di API dan Web POS.** API filter rentang tanggal (`transactions`, `stock-logs`, `adjustment-logs`, `shifts`, `audit-log`) dan halaman riwayat POS (`resolvedFrom`/`resolvedTo`) kini diparse menggunakan batas offset WIB (`+07:00`) alih-alih `Z` (UTC) atau parser lokal server, agar pencarian filter riwayat transaksi tepat mencakup batas hari WIB (00:00:00 sampai 23:59:59.999 WIB) secara konsisten di semua lingkungan.

## [1.11.2] - 2026-06-21

### Added
- **Bagian "PENJUALAN" di cetak settlement** menampilkan omzet per metode (Tunai / Non-Tunai / Hutang) dengan total **OMZET**. Komponen Tunai = kas penjualan net kembalian (sebelum dipotong pengeluaran).

### Changed
- **Rombak layout cetak settlement untuk hilangkan redundansi.** Sebelumnya beberapa angka tampil berulang (Tunai = Kas Bersih di tiap kasir; Non-Tunai muncul 3x di per-kasir/omzet/total; Kas Penjualan Harus Ada = Kas Bersih). Sekarang:
  - **PENJUALAN** (omzet per metode) jadi ringkasan tunggal di atas.
  - **RINCIAN PER KASIR** selalu tampil (termasuk bila hanya 1 kasir). Baris Tunai = penjualan tunai net, sehingga Tunai − Pengeluaran = Kas Bersih (tidak lagi dua angka kembar). Baris "TOTAL SEMUA KASIR" dihapus.
  - **TRANSAKSI NON-TUNAI** tidak lagi menampilkan baris "Total Non-Tunai" (sudah ada di PENJUALAN).
  - **REKONSILIASI KAS**: derivasi `Kas Penjualan Tunai − Pengeluaran` hanya muncul bila ada pengeluaran; "Kas Penjualan Harus Ada" → "Kas Harus Ada"; modal awal jadi baris info di bawah.

### Fixed
- **Tendered (uang tunai diterima) tidak pernah lagi dicatat sebagai penjualan.** Sebelumnya `totalSalesCash` & `totalSales` di breakdown shift menyimpan nilai *tendered* (termasuk kembalian), sehingga kolom "Cash" & "Total Jual" di detail Riwayat Shift menggelembung sebesar kembalian. Sekarang yang disimpan adalah nilai **NET** (setelah kembalian): `totalSalesCash = ΣCASH − kembalian`, `totalSales = net penjualan (omzet)`, `expectedCash = totalSalesCash(net) − pengeluaran`. Diterapkan di endpoint `settle`, `force-close`, dan `breakdown` (preview). Nilai `expectedCash`/variance tidak berubah. (Catatan: data shift lama yang sudah ditutup perlu di-backfill agar ikut terkoreksi.)

### Changed
- **Baris "Tunai" di RINCIAN PER KASIR cetak settlement kini menampilkan nilai kas bersih** (sudah dikurangi kembalian & pengeluaran), bukan lagi penjualan tunai bruto. Sebelumnya nilainya ambigu karena berbeda dengan baris "Kas Bersih" sehingga membingungkan user. Berlaku juga untuk baris Tunai pada "TOTAL SEMUA KASIR".

## [1.11.1] - 2026-06-21

### Fixed
- **Semua tampilan & cetakan tanggal/waktu kini konsisten WIB (Asia/Jakarta).** Sebelumnya format tanggal tidak meng-set timezone, sehingga yang dirender di server (UTC) tergeser 7 jam dari WIB (mis. cetak settlement, header tanggal dashboard, "Dibuat pada" laporan nilai stok, nama bill default). Timestamp di DB tetap UTC; perbaikan murni di lapisan format.
  - Helper bersama baru `formatWIB(date, options)` di `@petshop/shared` (memaksa `timeZone: 'Asia/Jakarta'`), plus preset `formatDate`, `formatDateTime`, `formatDateTimeShort`, `formatTime`, `formatDateLong`.
  - Semua call site `toLocaleDateString`/`toLocaleTimeString`/`Intl.DateTimeFormat` untuk tanggal di backoffice dialihkan ke helper ini (struk POS, riwayat transaksi & shift, settlement, PO, transfer internal, audit log, stock/adjustment logs, retur, piutang, dll).

## [1.11.0] - 2026-06-20

### Added
- **Daftar transaksi non-tunai di cetak settlement** (kolom: Tgl | Nominal | Metode, Nominal rata kiri) beserta total non-tunai. Data diambil dari pembayaran bertipe QRIS/Debit/Kredit pada shift (`CASH` & `DEBT`/Hutang tidak termasuk).
  - Field baru `nonCashPayments` di `ShiftBreakdownSummary` (`@petshop/shared`), diisi oleh endpoint `settle` & `GET /api/bo/shifts/[id]`.
- **Baris "TOTAL SEMUA KASIR"** pada rincian per kasir di cetak settlement (muncul bila shift punya lebih dari satu kasir): total tunai, non-tunai, hutang, pengeluaran, dan kas bersih.

### Changed
- **Hapus footer tanda tangan** (Kasir/Penyetor) pada cetak settlement.

## [1.10.0] - 2026-06-20

### Added
- **Cetak laporan settlement shift (thermal 80mm).** Setelah shift ditutup, muncul layar sukses dengan tombol "🖨️ Cetak Settlement" dan "Selesai".
  - Komponen baru `settlement-print.tsx`: header toko, info shift (buka/tutup/ditutup oleh), rincian penjualan per kasir (tunai, non-tunai, hutang, pengeluaran, kas bersih), rekonsiliasi (modal terpisah, kas harus ada, kas disetor, selisih), catatan settlement, dan kolom tanda tangan kasir/penyetor.
  - `settlement-client.tsx` kini menahan respons `settle` untuk menampilkan ringkasan + opsi cetak sebelum kembali ke POS (sebelumnya langsung redirect).
  - `page.tsx` settlement meneruskan `branchName` & `cashierName` dari JWT untuk dicetak.
- **Cetak ulang settlement dari Riwayat Shift.** Modal detail shift (`shift-history-client.tsx`) kini punya tombol "🖨️ Cetak Settlement" untuk shift yang sudah ditutup (CLOSED/FORCE_CLOSED), memakai ulang komponen `settlement-print.tsx`.

## [1.9.1] - 2026-06-20

### Changed
- **Modal dipisahkan dari rekonsiliasi kas settlement (modal terpisah, dikembalikan utuh).** Melengkapi 1.9.0:
  - Ekspektasi kas = **net cash penjualan** = `Σ(tunai diterima) − kembalian − pengeluaran tunai` (pengurangan kembalian dari 1.9.0 tetap dipertahankan).
  - `total_closing_cash_expected` & input kas fisik kini **hanya net cash penjualan (di luar modal)**; modal awal **tidak lagi dijumlahkan** ke ekspektasi kas.
  - UI settlement (`settlement-client.tsx`): input berlabel "Total Uang Tunai di Luar Modal", modal ditampilkan terpisah sebagai info, selisih dihitung dari net cash penjualan saja.
  - Riwayat shift: kolom breakdown "Kas Bersih" diganti "Kas Penjualan".
  - Berlaku di `settle`, `breakdown`, dan `force-close`.

## [1.9.0] - 2026-06-20

### Fixed
- **Settlement shift salah hitung kas (kembalian & modal):** kalkulasi kas yang harus ada di laci sebelumnya keliru sehingga setiap shift dengan kembalian selalu tampak "kurang".
  - **Kembalian kini dikurangi dari kas tunai.** Sebelumnya `totalSalesCash` memakai nominal uang yang diserahkan customer (tendered) tanpa mengurangi kembalian (`changeAmount`) yang keluar dari laci. Rumus diperbaiki menjadi `kas tunai bersih = Σ(tunai diterima) − Σ(kembalian)`.
  - **Modal awal tidak lagi dibagi per kasir.** Sebelumnya modal dibagi rata (`floor(openingCash / jumlahKasir)`) sehingga sisa pembagian hilang dan ekspektasi kas per kasir tidak akurat. Kini modal dihitung utuh sekali di level shift.
  - Rumus final: `Kas Harus Ada = Modal Awal + Σ(kas tunai bersih per kasir) − Σ(pengeluaran tunai)`.
  - Berlaku di `POST /api/pos/shifts/[id]/settle`, `GET /api/pos/shifts/[id]/breakdown`, dan `POST /api/pos/shifts/[id]/force-close`. Shift yang sudah ditutup sebelumnya tidak ikut dihitung ulang (data lama tetap).

### Changed
- **Rekonsiliasi kas settlement jadi per-shift (satu laci), bukan per kasir.** Karena kasir berbagi satu laci, input kas fisik saat settlement (`settlement-client.tsx`) kini berupa **satu** kolom "Kas Fisik di Laci" beserta selisihnya, bukan input per kasir. Rincian penjualan per kasir tetap ditampilkan sebagai informasi.
  - Di riwayat shift (`shift-history`), tabel breakdown kasir menyederhanakan kolom rekonsiliasi per-kasir (Modal Share/Kas Expected/Kas Real/Selisih) menjadi satu kolom "Kas Bersih"; angka Expected/Real/Selisih level shift tetap di header detail.

### Added
- **Verifikasi auth pada API shift settlement:** route `settle`, `breakdown`, dan `force-close` kini memverifikasi `accessToken` (sebelumnya tidak ada). Operasi `settle` dan `force-close` juga dibungkus dalam satu transaksi DB agar tidak setengah jalan bila gagal.

## [1.8.2] - 2026-06-20

### Fixed
- **History POS web kosong saat shift dibuka akun lain:** mode shift pada halaman riwayat (`/pos/history`) sebelumnya memfilter `cashierId = user yang login`, sehingga ketika shift dibuka/diisi transaksi oleh akun lain lalu dibuka oleh akun berbeda (mis. owner yang join shift), daftar transaksi tampil kosong. Filter `cashierId` dihapus di mode shift sehingga menampilkan semua transaksi pada shift aktif tersebut, lintas kasir yang join.

## [1.8.1] - 2026-06-20

### Changed
- **Struk penjualan dirapatkan & ganti font:** font struk diganti dari `monospace` ke jenis condensed (`Arial Narrow`) dengan `letter-spacing` dirapatkan (-0.4px) dan `line-height` lebih padat, sehingga karakter tidak terlalu renggang (`receipt-print.tsx`).

### Added
- **Nama pelanggan & diskon tampil di struk:** nama customer (jika ada) kini ikut tercetak di struk penjualan, baik saat checkout (`checkout-modal.tsx` → `pos-client.tsx`) maupun cetak ulang dari riwayat transaksi (query history di-`leftJoin` ke tabel `customers`). Baris diskon juga dipastikan muncul saat transaksi memiliki potongan.

## [1.8.0] - 2026-06-20

### Added
- **Split payment (bayar gabungan) di POS web:** kasir dapat melunasi satu transaksi dengan beberapa metode pembayaran sekaligus pada modal pembayaran (`checkout-modal.tsx`).
  - Tombol "Bayar Gabungan (Split)" mengalihkan modal ke editor multi-metode; "← Bayar Tunggal" untuk kembali ke mode lama.
  - Setiap baris pembayaran punya dropdown metode + input nominal (format ribuan otomatis). Tombol "+ Tambah Metode" menambah baris, dan tombol "Isi Sisa" mengisi kekurangan ke baris terkait.
  - Ringkasan menampilkan Total Terbayar, Sisa (jika kurang), dan Jumlah Hutang (jika ada baris bertipe Hutang). Tombol proses aktif saat total terbayar ≥ total transaksi.
  - Baris bertipe Hutang menghasilkan pencatatan piutang otomatis (memerlukan customer terpilih) lengkap dengan input jatuh tempo; kembalian dihitung saat ada kelebihan bayar tunai tanpa hutang.
  - Rincian semua metode pembayaran dikirim ke `POST /api/pos/transactions` lewat array `payments` (sudah didukung `TransactionService`), serta tercetak per baris di struk penjualan dan ringkasan transaksi berhasil.

## [1.7.1] - 2026-06-20

### Changed
- **Semua fitur terkait pelanggan kini dapat diakses oleh semua role:** seluruh batasan role pada modul pelanggan dihapus, sehingga setiap pengguna yang sudah login (termasuk KASIR dan GUDANG) dapat:
  - Menambah, mengubah, dan menghapus data customer (`POST/PUT/DELETE /api/bo/customers` & `/api/bo/customers/[id]`).
  - Melihat dan mencatat utang customer serta mencatat pembayaran utang (`POST /api/bo/customers/[id]/debts` & `/api/bo/customers/[id]/debts/[debtId]/pay`).
  - Membuka tab Hutang pada halaman detail customer (sebelumnya hanya OWNER/GM/MANAGER/FINANCE).
  - Mengakses Laporan Piutang (`/reports/receivables`) — menu sidebar dan halaman tidak lagi dibatasi role.

## [1.7.0] - 2026-06-20

### Added
- **Master Data Metode Pembayaran — CRUD lengkap:** halaman `/master-data/payment-methods` untuk mengelola daftar metode pembayaran yang tersedia di kasir.
  - Tabel menampilkan nama dan tipe (Tunai, Transfer Bank, E-Wallet, QRIS, Hutang).
  - Form tambah/edit di modal dengan field nama dan dropdown tipe.
  - Konfirmasi hapus; metode pembayaran yang sudah dipakai pada transaksi tidak dapat dihapus.
  - API route `GET/POST /api/bo/master-data/payment-methods` dan `PATCH/DELETE /api/bo/master-data/payment-methods/[id]` dengan auth, validasi Zod, cek duplikat nama, dan proteksi role (hanya OWNER & GM).
  - Menu "Metode Pembayaran" ditambahkan ke grup Master Data pada sidebar.

## [1.6.0] - 2026-06-20

### Added
- **Diskon nominal per transaksi di POS web:** kasir dapat memasukkan potongan harga berupa nominal rupiah langsung (bukan persentase) pada modal pembayaran (`checkout-modal.tsx`).
  - Input "Diskon (Rp)" dengan format ribuan otomatis. Diskon dibatasi maksimal sebesar subtotal (tidak bisa membuat total negatif).
  - Ringkasan pembayaran menampilkan Subtotal, Diskon, dan Total bersih. Validasi jumlah bayar, tombol "Uang Pas", pecahan cepat, dan jumlah hutang semuanya mengikuti total bersih (setelah diskon).
  - Diskon dikirim ke `POST /api/pos/transactions` lewat `totals.discountTotal` (subtotal kotor di `totals.subtotal`, total bersih di `totals.grandTotal`) dan tersimpan di `transactions.discount_amount`.
  - Struk penjualan mencetak baris Subtotal dan Diskon saat diskon > 0.

## [1.5.0] - 2026-06-20

### Changed
- **Penjualan produk stok 0 (oversell) kini diizinkan — stok minus tetap tercatat:** kasir dapat menjual produk meski stok 0 atau tidak mencukupi, tanpa otorisasi tambahan. Stok agregat (`product_stocks.qty`) akan turun menjadi negatif dan tercatat apa adanya.
  - **Backend:** `TransactionService.createTransaction` tidak lagi memblokir transaksi karena stok kurang (validasi inventory dihapus). `StockService.deductStock` menerima parameter `allowNegative` (transaksi POS mengirim `true`): batch yang ada dikuras via FIFO, sisa kekurangan dicatat sebagai stok minus. Jika row aggregate belum ada, dibuat baru dengan nilai negatif (upsert).
  - **HPP porsi oversell:** untuk qty yang melebihi stok batch, HPP dihitung dari `products.defaultCostPrice`.
  - **FIFO engine (`fifoDeduct`):** menerima flag `allowNegative` dan mengembalikan `shortfallQty` (qty yang tidak tertutup batch). Tanpa flag, perilaku lama (gagal jika stok kurang) tetap dipertahankan untuk retur, barang rusak, dan reverse-receiving.
  - **POS web:** dialog UOM & harga tidak lagi memblokir qty melebihi stok — qty bisa dinaikkan bebas, satuan dengan stok habis tetap dapat dipilih, dengan peringatan "Stok akan tercatat minus". Kartu produk menandai stok 0/minus dengan warna amber.

## [1.4.0] - 2026-06-19

### Added
- **Master Data Supplier — CRUD lengkap:** halaman `/master-data/suppliers` untuk mengelola daftar supplier.
  - Tabel menampilkan nama, kontak, telepon, email, dan termin pembayaran.
  - Form tambah/edit di modal dengan field: nama, nama kontak, telepon, email, rekening bank, alamat, dan termin pembayaran (hari).
  - Konfirmasi hapus; supplier yang memiliki riwayat purchase order tidak dapat dihapus.
  - API route `GET/POST /api/bo/master-data/suppliers` dan `PUT/DELETE /api/bo/master-data/suppliers/[id]` dengan auth, validasi Zod, dan cek duplikat nama.
  - Hanya role Owner dan GM yang dapat menambah, mengubah, atau menghapus supplier.

## [1.3.0] - 2026-06-13

### Added
- **Utang Piutang Customer — penjualan kredit & laporan piutang:** fitur hutang customer kini berfungsi penuh dari hulu ke hilir.
  - **Pembuatan hutang terpusat:** `TransactionService.createTransaction` otomatis mencatat `customer_debts` ketika ada baris pembayaran bertipe `DEBT`. Karena Bulk Sale, POS online, dan POS offline-sync semua memakai service ini, ketiganya langsung mendukung penjualan kredit.
  - **Bulk Sale:** opsi "Penjualan Kredit (Hutang)" dengan uang muka (DP) opsional dan tanggal jatuh tempo. Sisa setelah DP dicatat sebagai hutang.
  - **POS:** memilih metode pembayaran "Hutang" mencatat seluruh total sebagai hutang (wajib pilih customer, jatuh tempo opsional).
  - **Input hutang manual:** endpoint `POST /api/bo/customers/[id]/debts` dan tombol "Tambah Hutang Manual" di halaman detail customer untuk mencatat hutang tanpa transaksi (mis. saldo awal piutang).
  - **Laporan Piutang terpusat:** halaman `/reports/receivables` (menu Laporan → Piutang) menampilkan seluruh hutang belum lunas lintas customer & cabang, ringkasan total outstanding & jatuh tempo terlewat, filter status/pencarian, dan aksi catat pembayaran. Akses: Owner, GM, Manager, Finance.
  - **Jatuh tempo:** kolom `due_at` kini diisi; hutang yang lewat jatuh tempo ditandai di halaman detail customer & laporan piutang.

### Changed
- **Schema `customer_debts` & `debt_payments`:** penambahan kolom `branch_id`, `note`, `created_by` (customer_debts) dan `note`, `created_by` (debt_payments) untuk pelaporan per cabang, keterangan, dan audit. Catatan pembayaran (`note`) kini benar-benar tersimpan.

## [1.2.78] - 2026-06-13

### Fixed
- **Master Data Customer — gagal tambah customer baru:** form mengirim `null` untuk field opsional yang dikosongkan (telepon, email, alamat), tetapi `createSchema` di API POST hanya menerima `string | undefined` sehingga validasi Zod selalu gagal dengan status 400. Field `code`, `phone`, `email`, dan `address` pada schema create kini diberi `.nullable()` agar konsisten dengan schema update (PUT) yang sudah berfungsi.

---

## [1.2.77] - 2026-06-13

### Fixed
- **Bulk Sale — tier harga & harga kosong setelah produk dipilih:** API mengembalikan kolom harga dengan nama field `tierType`, padahal komponen klien (tipe `BulkSalePriceOption` & dropdown Tier) membaca `priceTier`. Akibatnya tier harga selalu blank dan harga/subtotal tidak terisi. API bulk sale kini menambahkan field `priceTier` (dipetakan dari `tierType`) pada tiap harga sehingga dropdown tier dan harga otomatis terisi saat produk ditambahkan.

---

## [1.2.76] - 2026-06-13

### Fixed
- **Bulk Sale — produk tidak muncul di kolom pencarian:** seluruh produk memiliki `sku` kosong (NULL) sehingga API mengembalikan `code: null`, lalu divalidasi gugur di sisi klien (`code` wajib string) dan setiap produk tersaring habis — dropdown selalu kosong. API bulk sale kini mengisi `code` dengan `COALESCE(sku, barcode, '')` sehingga selalu berupa string dan menampilkan barcode sebagai identitas produk.

---

## [1.2.75] - 2026-06-13

### Fixed
- **Master Data Produk — gagal simpan "UOM yang dipilih bukan UOM dasar":** validasi pembuatan/perubahan produk mengharuskan `units_of_measure.is_base = true`, padahal tidak ada satu pun UOM yang ditandai sebagai satuan dasar sehingga semua produk gagal disimpan. Validasi `isBase` dihapus dari API produk; UOM mana pun kini bisa dijadikan satuan dasar produk (konsisten dengan cara `isBase` diturunkan per-produk di halaman detail). Pengecekan keberadaan UOM tetap dipertahankan.

---

## [1.2.74] - 2026-06-13

### Changed
- **POS — keyboard shortcut untuk minim klik di PC:**
  - `F2` → fokus ke kotak pencarian produk dari mana saja
  - `Enter` di kotak cari → langsung buka produk pertama di hasil
  - Kotak cari auto-focus saat halaman dimuat
  - `Enter` di dialog pilih UOM/harga → konfirmasi tambah ke keranjang (input qty auto-focus)
  - `F10` → buka modal pembayaran (Bayar) dari mana saja
  - `Enter` di input nominal bayar → proses pembayaran
  - `Enter` di layar sukses transaksi → langsung transaksi baru
  - Hint shortcut ditampilkan di tombol Bayar (`F10`), Tambah ke Keranjang (`Enter`), dan Proses Pembayaran (`Enter`)

---

## [1.2.73] - 2026-06-13

### Changed
- **POS — sembunyikan menu Penerimaan:** tab navigasi Penerimaan dihapus dari nav POS.

---

## [1.2.72] - 2026-06-13

### Fixed
- **POS — nomor struk salah (TRX-1):** client membaca field `receiptNumber` yang tidak ada, seharusnya `trxNumber`. Nomor struk kini menampilkan format yang benar, contoh `TRX-20260613-XXXX`.

---

## [1.2.71] - 2026-06-13

### Fixed
- **Tambah Produk — dropdown UOM kosong:** dropdown UOM Dasar di form tambah/edit produk tidak menampilkan pilihan karena hanya memfilter UOM dengan `isBase = true`, padahal default saat buat UOM adalah `false`. Filter dihapus sehingga semua satuan ukur kini tampil di dropdown.

---

## [1.2.70] - 2026-06-12

### Added
- Menambahkan halaman **Bulk Sale** di backoffice untuk input transaksi penjualan banyak produk dengan pilihan customer, branch, UOM, tier harga, diskon nominal, cetak struk, dan cetak surat jalan.

---

## [1.2.69] - 2026-06-12

### Fixed
- **Manajemen Harga — build backoffice gagal karena type error:** hasil query `cost_price` dari `db.execute` kini diberi tipe row secara eksplisit sehingga Next.js build tidak lagi gagal pada cast data harga modal.

---
## [1.2.68] - 2026-06-12

### Added
- **Manajemen Harga — hint shortcut keyboard di atas tabel:** ↑↓, Enter, Tab, dan Ctrl+S ditampilkan sebagai badge `<kbd>` di sebelah kanan baris summary, tepat sebelum tabel harga.

---

## [1.2.67] - 2026-06-12

### Fixed
- **Manajemen Harga — 500 error saat ambil data harga:** query `cost_price` dipisah ke query terpisah dengan try/catch; jika tabel `product_uom_costs` belum ada di DB (migration belum jalan), halaman tetap bisa dimuat dan kolom Harga Modal tampil kosong (null) tanpa mematikan seluruh endpoint.

---

## [1.2.66] - 2026-06-12

### Fixed
- **Manajemen Harga — loading state awal salah:** `isLoading` diinisialisasi `true` sehingga skeleton langsung tampil saat halaman dibuka; sebelumnya nilai awal `false` menyebabkan "Tidak ada data" muncul sesaat sebelum data dimuat.

### Added
- **Manajemen Harga — skeleton loading tabel:** tampilan loading kini berupa skeleton tabel 8 baris yang menyerupai struktur kolom asli (Produk, UOM, Harga Modal, RETAIL/RESELLER/GROSIR/MEMBER), menggantikan teks "Memuat data..." yang kurang informatif.

---

## [1.2.65] - 2026-06-12

### Added
- **Manajemen Harga — kolom Harga Modal per UOM:** Halaman `/master-data/prices` kini menampilkan kolom "Harga Modal" di samping harga jual per tier. Pengguna dapat mengedit harga modal langsung dari tabel (inline edit), dan perubahan disimpan bersama harga jual dalam satu kali klik Simpan atau Ctrl+S.

---
## [1.2.64] - 2026-06-12

### Fixed
- **Internal Transfer — type error `expiryDate` saat ship:** `firstExpiryDate` bertipe `Date` (dari kolom timestamp `productStockBatches`) dikonversi ke ISO string sebelum di-set ke `interBranchTransferItems.expiryDate` yang bertipe `varchar`; sebelumnya build gagal dengan type error.

---

## [1.2.63] - 2026-06-11

### Fixed

- Memperketat stock opname POS agar submit, tambah item, approve, reject, skip, dan baca data selalu mengambil cabang serta pengguna dari sesi terautentikasi, sekaligus menolak spoofing branch dan actor dari payload request.
- Memperketat create, history, dan halaman stock opname Backoffice agar akses manager tetap terbatas pada cabang sesi dan error dikembalikan secara aman.

---

## [1.2.62] - 2026-06-11

### Fixed

- Memperketat endpoint penerimaan Purchase Order POS agar actor, cabang, item PO, dan qty diterima tidak dapat dipalsukan dari payload request.

---

## [1.2.61] - 2026-06-11

### Fixed

- Memperketat endpoint bootstrap, snapshot stok, user POS, dan open bill agar akses cabang selalu mengikuti sesi POS.

---

## [1.2.60] - 2026-06-11

### Fixed

- Memperketat sinkronisasi transaksi POS agar branch, kasir, shift, dan flag oversell tidak dapat dipalsukan dari payload request.

---

## [1.2.59] - 2026-06-11

### Fixed

- Memperketat otorisasi Purchase Order dan hutang supplier agar role, actor, branch, dan pembayaran tidak dapat dipalsukan dari payload request.

---
## [1.2.58] - 2026-06-12

### Fixed
- **Internal Transfer — false STOK_PERLU_PECAH saat UOM ratio desimal:** kondisi `remainingInBase > 0` diganti `> 1e-9` untuk toleransi floating-point; sebelumnya aritmetika JS bisa meninggalkan residu `1e-15` setelah deduct cukup stok dengan ratio seperti 0.1 atau 0.5, menyebabkan transfer valid diblok dengan error palsu.

---

## [1.2.57] - 2026-06-12

### Fixed
- **Internal Transfer — pesan error STOK_PERLU_PECAH lebih informatif (M-1):** error kini menyertakan nomor produk (`#ID`) yang bermasalah dan menjelaskan dua opsi tindakan: kurangi qty agar sesuai kelipatan satuan, atau pecah stok via Stock Adjustment.
- **Internal Transfer — validasi notes partial receive di client (M-2):** `handleReceiveSubmit` sekarang memvalidasi sebelum request dikirim bahwa setiap item yang qty-terimanya kurang dari sisa kirim sudah diisi alasannya; error muncul langsung di UI dengan nama produk spesifik tanpa perlu round-trip ke server.

---

## [1.2.56] - 2026-06-12

### Fixed
- **Internal Transfer — kalkulasi stok tersedia konsisten dengan logika pengiriman:** stock-check kini mengumpulkan total base unit dari semua baris stok terlebih dahulu lalu membagi sekali dengan `Math.floor`, menggantikan pola sum-of-floors per baris yang bisa menghasilkan angka lebih kecil dari aktual. Hasilnya sekarang konsisten dengan validasi di ship action.
- **Internal Transfer — batch query stock-check (M-3):** query stock-check tidak lagi N+1 per item; semua produk, konversi UOM, dan stok diambil dalam 3 query flat lalu di-group di memory, mengurangi beban DB secara signifikan untuk transfer dengan banyak item.

---

## [1.2.55] - 2026-06-12

### Fixed
- **Internal Transfer — eliminasi race condition penomoran IBT:** generasi nomor IBT (COUNT + 1) kini dilindungi `pg_advisory_xact_lock` level transaksi; request simultan antri satu per satu dan tidak lagi menghasilkan duplikat nomor yang berakhir dengan error 409.

---

## [1.2.54] - 2026-06-12

### Fixed
- **Internal Transfer — expiry date batch diteruskan ke cabang tujuan:** saat ship, expiry date batch pertama yang dideduct (FIFO = tertua) kini disimpan ke `interBranchTransferItems.expiryDate`; saat receive, nilai tersebut diteruskan ke `StockService.addStock` sehingga batch baru di cabang tujuan mewarisi expiry date asli dari batch sumber, bukan null.

---

## [1.2.53] - 2026-06-12

### Added
- **Payable Antar Cabang — fitur hapus hutang (waive):** endpoint `PATCH /api/bo/inter-branch-payables/[id]/waive` untuk Owner dan GM; melengkapi status `WAIVED` yang sudah ada di guard pembayaran dan display UI tetapi belum punya endpoint. UI payables menambahkan tab "Dihapus" dan tombol "Hapus Hutang" dengan konfirmasi inline.

---

## [1.2.52] - 2026-06-12

### Fixed
- **Internal Transfer — validasi UOM conversion wajib saat ship & stock-check:** fallback diam-diam ke ratio = 1 ketika satuan ukur transfer atau stok tidak terdefinisi di `productUomConversions` dihapus. Sekarang sistem melempar error eksplisit (`409`) dengan pesan yang mengarahkan user ke master data produk, mencegah deduction stok yang salah tanpa peringatan.
- **Internal Transfer — penyatuan update status transaksi:** pola double-update pada action `receive` (update pertama tanpa mengubah status, update kedua mengisi status final) diganti menjadi satu SELECT fail-fast di awal dan satu UPDATE tunggal di akhir untuk semua action, mencegah potensi inconsistent state dan memperjelas alur transaksi DB.
- **Internal Transfer — auto-fill harga modal saat buat transfer:** item dengan `costPrice = 0` kini otomatis diisi dari `productUomCosts` cabang sumber (per produk + satuan), dengan fallback ke `defaultCostPrice × ratio konversi UOM`, sebelum transfer disimpan; mencegah payable tercatat dengan nilai nol akibat kelalaian input.

---

## [1.2.51] - 2026-06-11

### Added

- **POS API — sinkronisasi harga modal per cabang & UOM:** bootstrap POS
  dan pencarian produk POS kini mengirim `product_uom_costs` sesuai cabang.
  POS desktop, payload transaksi penjualan, sync batch, HPP server, cart,
  dan grid kasir tidak diubah pada milestone ini.

---

## [1.2.50] - 2026-06-11

### Fixed
- **Laporan Laba Rugi — fallback HPP per cabang & UOM:** item transaksi lama tanpa `cogs` kini menghitung HPP dari `product_uom_costs` sesuai cabang, produk, dan satuan transaksi sebelum fallback ke `defaultCostPrice`; nilai `cogs` transaksi yang sudah tersimpan tetap dipakai apa adanya.

---

## [1.2.49] - 2026-06-11

### Added

- **Inventory — harga modal default per cabang & UOM:** penambahan stok dari stock opname dan manual adjustment tanpa HPP eksplisit kini memakai `product_uom_costs` sebagai fallback. HPP eksplisit dari PO, retur, void transaksi, dan internal transfer tetap tidak diubah.

---

## [1.2.48] - 2026-06-11

### Added

- **Master Data Produk — harga modal per cabang & UOM:** tambah tabel `product_uom_costs`, API detail produk untuk simpan/muat harga modal per cabang dan satuan, serta tab "Harga Modal" di detail produk. Milestone ini hanya mengelola data master; stok, laporan, dan POS belum diubah.

---

## [1.2.47] - 2026-06-11

### Fixed

- **Manajemen Harga — debounce double-fetch:** filter cabang, kategori, search, dan page digabung ke satu state objek; reset `page` ke 1 kini atomik dengan perubahan search sehingga tidak ada lagi dua request berurutan saat mengetik di kotak pencarian

### Changed

- **Manajemen Harga — grouping multi-UOM:** produk dengan lebih dari satu UOM kini ditampilkan dalam baris yang dikelompokkan — nama produk muncul sekali dengan `rowspan`, baris UOM ke-2 dst di-indent ringan dan bertanda badge jumlah UOM
- **Manajemen Harga — format angka:** kolom harga beralih dari `type="number"` ke `type="text" inputMode="numeric"`; nilai ditampilkan dengan pemisah ribuan format Indonesia (contoh: `150.000`); input menerima angka mentah maupun yang sudah diformat (strip otomatis titik/koma saat parse), sehingga tidak ada lagi konflik ArrowUp/Down dengan increment bawaan browser
- **Manajemen Harga — keyboard navigation:** navigasi tanpa mouse — ↑↓ atau Enter untuk pindah baris, Tab untuk pindah kolom; Ctrl+S menyimpan dari mana saja; semua cell auto-select saat difokus sehingga bisa langsung ketik nilai baru

---

## [1.2.46] - 2026-06-11

### Added

- **API GET /api/bo/master-data/prices:** endpoint bulk harga produk — mengembalikan data flatten product × UOM dengan harga per tier (RETAIL/RESELLER/GROSIR/dll), mendukung filter `branchId`, `categoryId`, `search`, dan pagination 50 baris per halaman
- **API PUT /api/bo/master-data/prices:** endpoint batch upsert harga — terima array hingga 500 perubahan `{productId, uomId, tierType, price}` sekaligus, hanya OWNER dan GM yang dapat mengakses
- **API POST /api/bo/master-data/prices/copy-branch:** salin semua harga dari cabang sumber ke cabang tujuan dengan opsional markup persentase; mendukung `?preview=1` untuk cek jumlah data sebelum eksekusi
- **Halaman Manajemen Harga** (`/master-data/prices`): tabel inline-edit harga massal per cabang — filter cabang, kategori, dan search; highlight sel yang diubah; tombol simpan batch hingga 500 perubahan sekaligus; pagination 50 baris; link ditambahkan di sidebar Master Data
- **Modal Salin Harga Antar Cabang:** tombol "Salin dari Cabang Lain" di halaman Manajemen Harga — pilih cabang sumber, atur markup %, preview jumlah harga sebelum eksekusi, konfirmasi salin

---

## [1.2.45] - 2026-06-11

### Changed

- **Struk POS:** Ukuran cetak dikunci ke 80mm (`@page { size: 80mm auto; margin: 3mm }`); konten mengisi lebar penuh halaman (`width: 100%`) tanpa batasan `maxWidth` berbasis pixel; tambah `padding: 0 4mm` agar harga di sisi kanan tidak terpotong tepi kertas; font dinaikkan ke 18px (1.5x dari sebelumnya)

---

## [1.2.44] - 2026-06-11

### Fixed

- **Deployment B — Normalisasi stok (write layer):** Semua operasi tulis stok kini menyimpan dalam base UOM secara otomatis, sehingga tidak akan ada lagi row duplikat per (productId, branchId) dengan UOM berbeda.
  - `StockService.addStock()` — konversi qty dan costPrice ke base UOM sebelum insert batch dan upsert aggregate; batch menyimpan uomId asli sebagai audit trail
  - `StockService.deductStock()` — FIFO deduction lintas semua batch (tanpa filter uomId); update aggregate selalu di row base UOM
  - `applySOStockAdjustment()` — refactor menggunakan `StockService.deductStock/addStock` untuk konsistensi base UOM
  - Receive action internal transfer — mengganti direct insert `productStocks`/`productStockBatches` dengan `StockService.addStock()` agar qty diterima langsung tersimpan di base UOM
- **Schema:** Ditambahkan `UNIQUE INDEX(productId, branchId)` pada tabel `productStocks` untuk mencegah regresi multi-row setelah migrasi data
- **Skrip migrasi data:** `scripts/migrate-stock-to-base-uom.ts` — menggabungkan semua row `productStocks` per (productId, branchId) ke satu row base UOM; harus dijalankan sekali dalam maintenance window sebelum `pnpm db:push`

---

## [1.2.43] - 2026-06-11

### Fixed

- **Deployment A — Normalisasi stok (read layer):** Semua operasi baca stok kini mengagregasi semua UOM row dan mengonversi ke base UOM, sehingga produk yang stoknya tersimpan dalam SAK/UOM besar tidak lagi tampil 0 di listing, validasi POS, laporan nilai stok, dan stock opname.
  - `getProductsWithStock()` — subquery agregasi cross-UOM dengan konversi ratio ke base UOM
  - `asyncValidateInventory()` — agregasi semua UOM sebelum bandingkan dengan qty transaksi (fix potensi double-count SAK + PCS)
  - `getStockValuationReport()` — `totalQty` kini dalam base UOM via konversi ratio; `totalValue` tetap benar
  - Stock opname create & add-items — `systemQty` dihitung dari total semua UOM yang dikonversi ke UOM item opname; FIFO cost calculation juga dilakukan dalam base UOM

---

## [1.2.42] - 2026-06-11

### Fixed

- **Internal transfer — stok sistem salah (0) saat UOM transfer berbeda dari UOM stok** — stock-check dan aksi ship kini mendukung konversi lintas UOM menggunakan `productUomConversions`. Stok yang tersimpan dalam SAK dapat memenuhi transfer yang meminta PCS (dan sebaliknya), dengan deduction diprioritaskan ke UOM yang sama dulu lalu fallback ke UOM lain. Jika qty tidak habis terbagi secara bulat (butuh pecah stok), sistem menampilkan pesan error yang jelas.

---

## [1.2.41] - 2026-06-10

### Changed

- **Semua popup/modal tidak bisa ditutup dengan klik di luar area** — backdrop click dihapus dari seluruh dialog dan modal (expense, void PIN, open shift, checkout, customer search, UOM price, transaction detail, shift history, void transaksi) agar tidak ada yang tidak sengaja menutup popup saat sedang bekerja.

---

## [1.2.40] - 2026-06-10

### Fixed

- **Internal transfer — stok tidak terbarukan saat proses selesai** — aksi `ship` kini juga melakukan FIFO deduction dari `productStockBatches` di cabang sumber (sebelumnya hanya mengurangi aggregate `productStocks`), dan aksi `receive` kini membuat entri batch baru di `productStockBatches` cabang tujuan dengan HPP dari transfer, sehingga FIFO tracking konsisten dan produk yang diterima bisa langsung dijual.

---

## [1.2.39] - 2026-06-10

### Fixed

- **Tooling gate lint backoffice** — `@typescript-eslint` kini dioverride ke versi kompatibel ESLint 9 untuk `eslint-config-next`, sehingga lint tidak crash sebelum memeriksa kode dan tetap cocok dengan lint phase Next build.

---

## [1.2.38] - 2026-06-09

### Fixed

- **Hardening login backoffice dan POS** — endpoint login kini menyetel `accessToken` dan `refreshToken` sebagai cookie HTTP-only dari server, tidak lagi mengirim token lewat JSON response, dan halaman login tidak lagi membuat cookie token dari client-side JavaScript.
- **Konfigurasi JWT wajib eksplisit** — signing/verifikasi token kini gagal jika `JWT_SECRET` atau `JWT_REFRESH_SECRET` belum dikonfigurasi, sehingga tidak ada fallback secret di runtime.

### Added

- **Regression test login session response** — menambah guard Vitest untuk memastikan token login dikirim via cookie HTTP-only dan tidak bocor ke body JSON.

---

## [1.2.37] - 2026-06-09

### Fixed

- **Atomic status transition transfer internal** — update status kini dijaga dengan kondisi status lama di dalam transaction sebelum efek samping stok/payable, sehingga double-submit ship/receive/cancel tidak bisa memproses status yang sudah berubah.
- **Pembayaran payable anti-overpay** — pembayaran hutang internal kini memakai guarded update di database; request paralel yang melebihi sisa hutang ditolak dengan 409 dan tidak membuat payment log baru.
- **Branch-scope authorization** — MANAGER/non-global kini hanya bisa create, approve, cancel, prepare, ship, receive, dan membaca transfer/payable yang terkait cabang sesinya.
- **Receive parsial lanjutan** — transfer `PARTIALLY_RECEIVED` bisa diproses lagi untuk sisa qty yang belum diterima; payable existing ditambah sesuai nilai penerimaan lanjutan tanpa membuat duplikat payable.
- **Detail transfer internal** — halaman detail kini mengambil `receiveNotes` langsung dari query server dan tidak lagi menutup mismatch type dengan cast paksa.
- **UI aksi transfer internal** — tombol aksi hanya tampil untuk role/cabang yang sesuai dengan aturan API; qty kirim/terima dikunci ke batas maksimal valid saat input.
- **POS internal order** — hanya OWNER/GM yang dapat memilih cabang pengirim lintas cabang; MANAGER mengikuti cabang sesi.

---

## [1.2.36] - 2026-06-09

### Added

- **Route `GET /api/bo/internal-transfers/[id]/stock-check`** — endpoint baru dengan autentikasi penuh; hanya role GUDANG/MANAGER/GM/OWNER yang boleh akses, dan non-global hanya boleh melihat stok cabang sendiri.
- **Unique index `idx_ibp_transfer_unique`** pada kolom `transfer_id` di tabel `inter_branch_payables` — DB-level guard agar satu transfer tidak bisa memiliki dua payable (migration `20260609000005`).

### Fixed

- **Spoofing `requestedById`** — field ini dihapus dari payload POST create transfer; server selalu pakai `userId` dari JWT, client tidak bisa spoof identitas user lain.
- **Default status transfer dari POS** — transfer yang dibuat dari POS kini langsung berstatus `PENDING_APPROVAL` (sebelumnya `DRAFT`), sehingga wajib melalui approval manager sebelum diproses.
- **Validasi cabang asal untuk non-global role** — user biasa (bukan OWNER/GM/MANAGER) tidak bisa membuat transfer dari cabang lain selain cabang sesinya sendiri.
- **Validasi cabang aktif saat create** — API menolak jika cabang asal atau tujuan tidak aktif.
- **Atomic stock deduction saat ship** — pengurangan stok kini memakai kondisi `qty >= qty_kirim` di level SQL; jika stok tidak mencukupi, transfer tidak berubah ke `IN_TRANSIT` dan API mengembalikan 409.
- **Validasi qty kirim tidak melebihi qty request** — API menolak jika qty kirim per item melebihi `qtyRequested`, meski client dimanipulasi.
- **Authorization per aksi status** — prepare/ship hanya boleh dilakukan GUDANG/MANAGER/GM/OWNER dari cabang asal; receive hanya boleh dilakukan dari cabang tujuan; approve/cancel hanya MANAGER/GM/OWNER.
- **Idempotency receive/payable** — sebelum insert payable, API cek dulu apakah sudah ada; jika sudah ada, skip insert (tidak duplikat). Race condition dijaga oleh unique index DB.
- **Cancel IN_TRANSIT diblokir jika sudah ada payable** — transfer yang sudah berdampak finansial tidak bisa dibatalkan; API mengembalikan 409.
- **Pembayaran payable dibatasi ke cabang sendiri** — MANAGER/FINANCE non-global hanya bisa mencatat pembayaran untuk hutang cabangnya sendiri (sebagai debitur).
- **Pesan sukses POS** — setelah submit permintaan transfer, pesan kini berbunyi "berhasil dibuat dan menunggu approval" sesuai lifecycle baru.
- **Hapus `as any` di halaman detail transfer** — `payload?.role` kini diakses dengan type-safe tanpa cast.
- **Hapus `currentUserId` dari props POS internal-order** — props tidak lagi dikirim dari server ke client karena server sudah handle via JWT.

### Changed

- **Nomor IBT digenerate di dalam transaction** — mengurangi potensi race condition pada nomor urut; unique constraint menangkap konflik yang tersisa dengan respon 409.

---

## [1.2.35] - 2026-06-09

### Added

- **Kolom `receive_notes`** di tabel `inter_branch_transfer_items` — menyimpan alasan selisih penerimaan per item.
- **Kolom "Alasan Selisih"** di tabel item halaman detail transfer internal — tampil oranye jika ada alasan.

### Fixed

- **Status `PARTIALLY_RECEIVED`** — penerimaan yang tidak penuh kini mengubah status transfer menjadi `Diterima Sebagian` (bukan `Diterima Penuh`). Status ditentukan otomatis: semua item `qtyReceived = qtyShipped` → `FULLY_RECEIVED`, ada yang kurang → `PARTIALLY_RECEIVED`.
- **Alasan selisih wajib diisi** — jika qty terima < qty dikirim pada item manapun, field alasan wajib diisi sebelum konfirmasi. API menolak request dengan error 400 jika ada item parsial tanpa alasan. Field alasan tampil otomatis di form (backoffice & POS) hanya saat qty dikurangi.
- **Aksi tersembunyi setelah `PARTIALLY_RECEIVED`** — section aksi di halaman detail tidak lagi tampil setelah status `PARTIALLY_RECEIVED` (sebelumnya masih muncul karena hanya `FULLY_RECEIVED` dan `CANCELLED` yang dikecualikan).

---

## [1.2.34] - 2026-06-09

### Added

- **Halaman Transfer Masuk POS** (`/pos/incoming-transfers`) — halaman baru di POS untuk non-KASIR melihat semua transfer internal berstatus `IN_TRANSIT` yang ditujukan ke cabang ini. Menampilkan daftar transfer dengan item (produk, qty dikirim), tombol "Terima Barang", dan inline form input qty terima per item sebelum konfirmasi.
- **Tab "Transfer Masuk"** di navigasi POS — muncul untuk semua role selain KASIR.

### Fixed

- **Penerimaan Transfer Internal** — tombol "Konfirmasi Diterima" sebelumnya langsung eksekusi tanpa validasi manual (stok langsung ditambah sejumlah `qtyShipped`). Kini diganti dengan form konfirmasi: staff input qty aktual yang diterima per item (pre-fill dari `qtyShipped`, bisa dikurangi jika ada selisih), dilengkapi warning oranye jika qty kurang dari yang dikirim.
- **API `PATCH /api/bo/internal-transfers/[id]/status` (receive)** — kini wajib menerima `items: [{itemId, qty}]` sebagai qty terima aktual. Validasi: `qty ≤ qtyShipped`, minimal satu item > 0. Stok cabang tujuan diperbarui berdasarkan `qtyReceived` (bukan `qtyShipped`). Hutang piutang juga dihitung dari `qtyReceived × costPrice`.
- **API `PATCH /api/bo/internal-transfers/[id]/status` (ship)** — payload item diubah dari `{itemId, qtyShipped}` menjadi `{itemId, qty}` untuk konsistensi.

---

## [1.2.33] - 2026-06-09

### Added

- **Hutang Piutang Transfer Internal (desentralisasi)** — saat cabang penerima konfirmasi barang diterima, sistem otomatis mencatat hutang ke tabel `inter_branch_payables`: debitur = cabang penerima, kreditur = cabang pengirim, nilai = `sum(qtyShipped × costPriceAtTransfer)`.
- **Halaman Hutang Piutang Internal** (`/purchase-orders/internal/payables`) — list semua hutang piutang antar cabang dengan tab filter (Belum Bayar / Sebagian / Lunas), summary total belum lunas, dan inline form catat pembayaran (jumlah, no. bukti transfer bank, catatan). Hanya role OWNER/GM/MANAGER/FINANCE yang bisa mencatat pembayaran.
- **API `GET /api/bo/inter-branch-payables`** — list semua hutang piutang antar cabang dengan join nama cabang debitur/kreditur dan nomor IBT.
- **API `POST /api/bo/inter-branch-payables/[id]/pay`** — catat pembayaran: validasi sisa hutang, insert ke `inter_branch_payments`, update `paidAmount` dan status (`PARTIAL` / `PAID`) secara atomic dalam satu transaksi.
- **DB migration** — tabel `petshop.inter_branch_payables` dan `petshop.inter_branch_payments` dengan index pada `transfer_id`, `debtor_branch_id`, `creditor_branch_id`, `status`.
- **Sidebar** — tambah link "Hutang Piutang Internal" di grup Pembelian.

---

## [1.2.32] - 2026-06-09

### Fixed

- **Transfer Internal** — tab filter di halaman list tidak lagi menampilkan scrollbar horizontal; hapus `overflow-x-auto` dan sesuaikan struktur container tab dengan pola standar halaman lain.

---

## [1.2.31] - 2026-06-09

### Changed

- **Konfirmasi Pengiriman Transfer Internal** — aksi "Tandai Sudah Dikirim" kini tidak otomatis menggunakan qty permintaan. Admin harus mengisi qty kirim aktual per item melalui inline form (pre-fill dari qty request, bisa dikurangi). Form menampilkan kolom **Stok Sistem** (merah jika di bawah qty permintaan) dan warning per baris: merah ⚠ jika qty kirim melebihi stok sistem, oranye jika qty kirim kurang dari permintaan. Pengiriman tetap bisa diproses meski stok kurang — validasi fisik tanggung jawab admin.
- **API `PATCH /api/bo/internal-transfers/[id]/status` (ship)** — terima body `items: [{itemId, qtyShipped}]`; hapus logika blokir stok tidak cukup; validasi total qty kirim > 0; item dengan qty 0 tidak dideduct.

### Added

- **API `GET /api/bo/internal-transfers/[id]/stock-check`** — return stok sistem per item transfer di cabang asal (`[{itemId, currentQty}]`); dipakai form konfirmasi pengiriman untuk menampilkan warning stok.

---

## [1.2.30] - 2026-06-09

### Added

- **Print Surat Jalan** — halaman detail Transfer Internal kini menyertakan layout cetak surat jalan yang dioptimalkan untuk printer dot-matrix: font monospace (Courier New), border solid sederhana, tabel items (No, Nama Produk, SKU, Qty, Satuan, kolom Terima kosong untuk paraf), kolom catatan, dan tiga blok tanda tangan (Pengirim, Kurir/Pengantar, Penerima). Layout hanya muncul saat `window.print()` — semua elemen UI disembunyikan via `@media print`. Tombol print muncul saat status `IN_TRANSIT`, `PARTIALLY_RECEIVED`, atau `FULLY_RECEIVED`.

---

## [1.2.29] - 2026-06-09

### Added

- **Halaman Transfer Internal** — halaman list di `/purchase-orders/internal` menampilkan semua transfer antar cabang dengan filter tab status (Draft, Menunggu, Disetujui, Disiapkan, Pengiriman, Diterima, Dibatalkan) dan dropdown filter cabang asal/tujuan; badge status berwarna sesuai kondisi.
- **Halaman Detail Transfer Internal** — halaman `/purchase-orders/internal/[id]` menampilkan header transfer (nomor IBT, status, arah cabang pengirim → tujuan, pemohon, catatan), tabel items (qty request/kirim/terima, satuan, est. HPP), dan panel aksi kontekstual sesuai status dan role.
- **Panel aksi Transfer Internal** — tombol Ajukan & Setujui / Setujui / Batalkan untuk role OWNER/GM/MANAGER; tombol Mulai Persiapan untuk semua role; tombol Tandai Sudah Dikirim dan Konfirmasi Diterima; tombol Print Surat Jalan (`window.print()`) saat status IN_TRANSIT, PARTIALLY_RECEIVED, atau FULLY_RECEIVED.
- **Sidebar** — tambah link "Transfer Internal" di grup Pembelian, di bawah "Purchase Orders".

---

## [1.2.28] - 2026-06-09

### Added

- **API PO Internal** — `POST /api/bo/internal-transfers`: buat transfer antar cabang baru dengan generate nomor `IBT-YYYYMMDD-XXXX`, insert header + items dalam satu transaksi DB.
- **API PO Internal** — `GET /api/bo/internal-transfers`: list transfer dengan filter `status`, `sourceBranchId`, `destinationBranchId`, `limit`, `offset`; join nama cabang asal/tujuan dan nama pemohon.
- **API PO Internal** — `GET /api/bo/internal-transfers/[id]`: detail satu transfer beserta semua items (join nama produk, SKU, kode & nama UOM).
- **API PO Internal** — `PATCH /api/bo/internal-transfers/[id]/status`: lifecycle transfer via `action` (`approve`, `prepare`, `ship`, `receive`, `cancel`); aksi `ship` mengurangi stok cabang asal secara atomic dengan cek stok tidak minus; aksi `receive` melakukan upsert stok cabang tujuan; aksi `cancel` dari status `IN_TRANSIT` mengembalikan stok ke cabang asal.

---

## [1.2.27] - 2026-06-09

### Changed

- **PO Internal** — tombol "Kirim Permintaan" kini membuka dialog konfirmasi terlebih dahulu, menampilkan ringkasan lengkap (cabang pengirim & tujuan, daftar produk, qty, satuan, estimasi HPP per item dan total, catatan) sebelum permintaan dikirim.

---

## [1.2.26] - 2026-06-09

### Fixed

- **PO Internal** — Tab dari field Qty kini mengikuti urutan yang benar: Qty → UOM → Harga, bukan langsung ke search box. Tab dari field Harga di baris terakhir akan fokus ke search, dan dari baris non-terakhir akan fokus ke Qty baris berikutnya.

---

## [1.2.25] - 2026-06-09

### Fixed

- **PO Internal** — dropdown hasil pencarian produk kini auto-scroll mengikuti item yang di-highlight saat navigasi dengan Arrow Up/Down, sehingga item yang berada di luar viewport tetap terlihat tanpa perlu scroll manual.

---

## [1.2.24] - 2026-06-09

### Added

- **Form PO Internal** di `/pos/internal-order`: halaman keyboard-first untuk kasir/manager membuat permintaan transfer stok antar cabang.
- Search produk dengan debounce 300ms, navigasi keyboard (Arrow Up/Down, Enter untuk pilih, Escape untuk tutup dropdown).
- Auto-fokus ke input Qty setelah produk dipilih; search box otomatis re-fokus setelah item ditambah atau dihapus.
- Auto-fill HPP estimasi dari `defaultCostPrice` produk; saat UOM diubah, HPP dikalikan ulang dengan rasio konversi.
- Dropdown cabang pengirim hanya bisa diubah oleh role OWNER, GM, dan MANAGER; KASIR otomatis menggunakan cabang sendiri.
- Tab navigasi "PO Internal" ditambahkan di `PosNavTabs` (tampil untuk semua role).
- Submit placeholder menangani endpoint `/api/bo/internal-transfers` yang belum ada (404/405) dengan menampilkan toast "Fitur segera tersedia".

---

## [1.2.23] - 2026-06-09

### Added

- **Schema Inter Branch Transfer**: Tambah tabel `inter_branch_transfers` (header) dan `inter_branch_transfer_items` (detail) di `packages/db/src/schema/inter_branch_transfers.ts` untuk pencatatan transfer stok antar cabang.
- **Migration SQL** `20260609000002_inter_branch_transfers.sql`: DDL lengkap kedua tabel dalam namespace `petshop`.
- Tabel `inter_branch_transfers` mendukung lifecycle status: `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `PREPARING`, `IN_TRANSIT`, `PARTIALLY_RECEIVED`, `FULLY_RECEIVED`, `CANCELLED`.
- Field `cost_price_at_transfer` di `inter_branch_transfer_items` untuk mencatat HPP FIFO cabang pengirim saat barang dikirim (diisi saat status → `IN_TRANSIT`).

---

## [1.2.22] - 2026-06-09

### Added

- **Schema PO Internal**: Tambah kolom `po_type` (default `'EXTERNAL'`) dan `source_branch_id` (nullable, FK ke `branches`) di tabel `purchase_orders` untuk mendukung Purchase Order antar cabang.
- **Migration SQL** `20260609000001_po_internal_schema.sql`: Migrasi non-breaking — semua PO existing tetap valid dengan `po_type = 'EXTERNAL'`.

### Changed

- Kolom `supplier_id` di tabel `purchase_orders` diubah menjadi nullable untuk mengakomodasi PO internal yang tidak memerlukan supplier eksternal.

---

## [1.2.21] - 2026-06-09

### Changed

- **Sidebar**: Diekstrak dari `layout.tsx` ke komponen terpisah `_components/sidebar.tsx` (client component).
- **Sidebar**: Reorganisasi nav menjadi 9 group — Operasional, Transaksi, Inventori, Pembelian, Laporan, Shift, Master Data, Pengaturan, Lainnya.
- **Sidebar**: Semua emoji diganti dengan icon Lucide React yang sesuai.
- **Sidebar**: Tambah collapsible per group dengan state tersimpan di `localStorage`; group yang berisi halaman aktif otomatis terbuka.
- **Sidebar**: Tambah active link highlight — item aktif tampil dengan `bg-primary/10 text-primary font-semibold` menggunakan `usePathname()`.
- **Sidebar**: Tambah info nama user dan cabang di bagian bawah sidebar.
- **Sidebar**: Tambah item "Supplier" di group Master Data.

---

## [1.2.20] - 2026-06-09

### Fixed

- Hapus import `useSearchParams` dan penggunaan variabel `searchParams` yang tidak terpakai di `transaction-list-client.tsx` — menghilangkan TypeScript error "declared but its value is never read".

---

## [1.2.19] - 2026-06-09

### Added

- **Halaman Riwayat Transaksi** (`/transactions`): Daftar semua transaksi penjualan dengan server-side pagination (20 per halaman).
  - Filter: No. Transaksi (search), Status (COMPLETED/PENDING_VOID/VOIDED), rentang tanggal, dan pilihan cabang (khusus OWNER/GM).
  - Role gate cabang: KASIR otomatis terkunci ke cabang sendiri; OWNER/GM bisa lihat semua cabang.
  - Kolom tabel: No. Transaksi, Tanggal, Cabang, Kasir, Customer, Metode Bayar, Total, Status (badge warna), Aksi.
  - Status badge: Selesai = hijau, Dibatalkan = merah, Menunggu Void = kuning.
  - Tombol "Ajukan Void" muncul hanya untuk transaksi berstatus COMPLETED — membuka modal konfirmasi dengan input alasan.
  - Setelah void request berhasil, status baris di-update ke PENDING_VOID tanpa reload halaman.
  - Filter dan pagination disimpan di URL query params (bookmarkable).
- **API `GET /api/bo/transactions`**: Query dengan pagination, filter multi-kriteria, dan agregasi metode pembayaran per transaksi (dipisah koma).
- **API `POST /api/bo/transactions/[trxNumber]/void-request`**: Insert ke `voidRequests` dengan status PENDING; validasi transaksi harus COMPLETED dan belum ada void request PENDING.
- **Sidebar**: Tambah link "Transaksi" di section Manajemen.

---

## [1.2.18] - 2026-06-09

### Added

- **Hutang/Piutang Customer**: Tambah section "Hutang / Piutang" di halaman detail customer, hanya tampil untuk role OWNER, GM, MANAGER, dan FINANCE.
  - Summary bar total outstanding (hutang UNPAID + PARTIAL yang belum lunas).
  - Tabel hutang dengan kolom No. Transaksi, Tanggal, Total Hutang, Sudah Dibayar, Sisa, Status (badge UNPAID=merah / PARTIAL=kuning / PAID=hijau).
  - Tombol "Catat Pembayaran" per baris hutang yang belum lunas — membuka modal form dengan input nominal (wajib, validasi max = sisa hutang), metode pembayaran (dropdown dari tabel `paymentMethods`), dan keterangan (opsional).
  - API endpoint `POST /api/bo/customers/[id]/debts/[debtId]/pay` — mencatat `debtPayments`, update `paidAmount`, `remainingAmount`, dan status hutang (PARTIAL/PAID) dalam satu transaksi DB.

---

## [1.2.17] - 2026-06-09

### Added

- **Halaman Detail Customer**: Tambah halaman `/master-data/customers/[id]` yang menampilkan info lengkap customer (Kode, Nama, Telepon, Email, Alamat, Status, Tanggal daftar) beserta tabel riwayat transaksi (No. Transaksi, Tanggal, Total, Status) — 50 transaksi terbaru, diurutkan dari yang terbaru.
- **Tabel Customer — tombol Detail**: Tambah link "Detail" di kolom Aksi pada tabel daftar customer, mengarah ke halaman detail masing-masing customer.

---

## [1.2.16] - 2026-06-09

### Added

- **Web POS — Quick-add customer baru dari dialog pencarian**: Ketika hasil pencarian kosong, muncul tombol "+ Tambah '[nama]' sebagai customer baru". Klik tombol tersebut membuka form inline di dalam dialog dengan field Nama (wajib, pre-filled dari query) dan Telepon (opsional). Submit langsung POST ke `/api/bo/customers`, dan jika sukses customer otomatis terpilih di cart tanpa perlu search ulang.

---

## [1.2.15] - 2026-06-09

### Added

- **Halaman Master Data Customer**: Tambah halaman `/master-data/customers` dengan fitur CRUD lengkap — tabel daftar customer (kolom Kode, Nama, Telepon, Email, Status), pencarian client-side by nama/kode/telepon, form tambah/edit via modal dialog, konfirmasi sebelum hapus, dan badge status Aktif/Nonaktif.
- **Sidebar — entry Customer**: Tambah link "Customer" di section Master Data pada sidebar navigasi.

---

## [1.2.14] - 2026-06-09

### Fixed

- **API Customer** — perbaiki TypeScript error: ganti `z.string().email()` (deprecated di Zod v4) ke `z.email()` di `route.ts` dan `[id]/route.ts`; ubah parameter `req` yang tidak dipakai di handler DELETE menjadi `_req`.

---

## [1.2.13] - 2026-06-09

### Added

- **API Customer — CRUD lengkap**: Tambah dua route baru untuk manajemen customer.
  - `GET /api/bo/customers` — list semua customer, support query param `q` (search by name/phone/code) dan `isActive` filter. Semua role boleh akses.
  - `POST /api/bo/customers` — buat customer baru. Auto-generate kode `CST-XXXXXX` jika tidak diisi. Role: Owner, GM, Manager, Finance.
  - `PUT /api/bo/customers/[id]` — edit customer, cek duplikat kode. Role: Owner, GM, Manager.
  - `DELETE /api/bo/customers/[id]` — hapus permanen, ditolak jika customer punya riwayat transaksi. Role: Owner, GM.

---

## [1.2.12] - 2026-06-09

### Added

- **DB Schema — kolom `code` pada tabel `customers`**: Tambah kolom `code VARCHAR(20) UNIQUE` (nullable) untuk menyimpan kode pelanggan, baik yang di-generate otomatis maupun diisi manual.

---

## [1.2.11] - 2026-06-08

### Changed

- **POS — UOM selector hanya tampilkan UOM yang punya harga di branch aktif**: Pilihan satuan (UOM) pada produk kini difilter berdasarkan entry harga yang tersedia di branch tersebut. UOM tanpa harga tidak akan muncul di selector. Efeknya, setiap branch bisa mengontrol UOM mana yang bisa dipilih kasir cukup dengan mengisi atau tidak mengisi harga untuk UOM tersebut.

---

## [1.2.10] - 2026-06-08

### Fixed

- **POS Produk — stok & harga salah untuk Owner di branch non-HQ**: API `/api/pos/products` mengambil `branchId` dari JWT payload (selalu HQ untuk Owner), sehingga stok dan harga produk yang ditampilkan adalah milik HQ bukan cabang yang dipilih. Diperbaiki dengan menggunakan `getPosBranchId()` yang membaca cookie `posBranchId` untuk role multi-branch (OWNER, GM, MANAGER).

---

## [1.2.9] - 2026-06-08

### Fixed

- **POS Open Shift — list kasir kosong untuk Owner di branch non-HQ**: API `/api/pos/users` sebelumnya memfilter semua user berdasarkan `branchId` di record mereka, sehingga Owner (yang hanya punya satu `branchId` = HQ) tidak muncul saat membuka shift di cabang lain. Query diubah agar KASIR dan MANAGER tetap difilter per cabang, sedangkan OWNER ditampilkan untuk semua cabang tanpa filter branch.
- Tambahkan filter `users.isActive = true` pada query yang sama agar user yang sudah dinonaktifkan tidak muncul di daftar kasir shift.

---

## [1.2.8] - 2026-06-08

### Added

- **Navigation Progress Bar**: top loading bar tipis (3px) yang muncul otomatis saat navigasi antar halaman berlangsung
  - Muncul segera saat user mengklik link internal
  - Animasi progres bertahap secara acak hingga 90%, lalu selesai ke 100% saat halaman baru sudah dirender
  - Warna mengikuti `--primary` (amber brand color), dengan efek glow
  - Aksesibel via `role="progressbar"` dan `aria-label`
  - Implementasi tanpa library tambahan menggunakan `usePathname` dari `next/navigation`

---

## [1.2.7] - 2026-06-08

### Added

- **Batalkan Penerimaan PO**: endpoint `POST /api/bo/purchase-orders/[id]/reverse-receiving` untuk membatalkan penerimaan barang yang sudah di-approve
  - Hanya dapat dilakukan oleh role **OWNER** atau **GM** dengan verifikasi PIN Owner
  - Stok yang sebelumnya masuk dari approve-receiving akan dipotong kembali via FIFO
  - Hutang supplier (`supplier_payables`) dihapus jika masih berstatus `UNPAID` dan belum ada pembayaran
  - Diblokir jika hutang supplier sudah dibayar sebagian atau penuh
  - Status PO dikembalikan ke `PARTIALLY_RECEIVED`
  - Seluruh aksi dicatat di `audit_logs` dengan action `PO_RECEIVING_REVERSED`

---

## [1.2.6] - 2026-06-08

### Added

- **Batalkan Retur**: endpoint `POST /api/bo/retur/[returnId]/cancel` untuk membatalkan retur yang sudah diproses
  - Hanya dapat dilakukan oleh role **OWNER** dengan verifikasi PIN
  - Stok yang sebelumnya dikembalikan oleh retur akan dipotong kembali via FIFO
  - Retur ditandai soft-delete (`cancelled_at`, `cancelled_by_id`, `cancel_reason`) — data tetap tersimpan untuk audit trail
  - Qty retur yang sudah dibatalkan tidak dihitung lagi sebagai "sudah diretur" pada transaksi asal
- Migration `20260608000003`: tambah kolom `cancelled_at`, `cancelled_by_id`, `cancel_reason` pada tabel `petshop.returns`

---

## [1.2.5] - 2026-06-08

### Changed

- **Stock Adjustment**: saat penambahan stok, selalu membuat batch FIFO baru (bukan menambah ke batch lama) agar cost tracking tetap akurat
- **Stock Adjustment**: tambah input opsional **Harga Beli per Unit (HPP)** yang muncul saat qty baru lebih besar dari stok saat ini — nilai diteruskan ke batch baru sebagai `costPrice`

---

## [1.2.4] - 2026-06-08

### Added

- **Auto Pricing Multi-UOM**: saat user mengisi harga satu UOM pada tab Harga produk, harga UOM lain dalam tier yang sama otomatis dikalkulasi berdasarkan rasio konversi — berlaku dua arah (mengisi harga UOM besar menghitung UOM kecil, dan sebaliknya)

---

## [1.2.3] - 2026-06-08

### Added

- Field **Harga Modal Default** per produk (master data) — fallback HPP saat data FIFO batch belum tersedia
- Kolom `default_cost_price` di tabel `petshop.products` (migration `20260608000001`)
- Tampilkan **Harga Modal Default** di halaman detail produk — format Rupiah jika diisi, "Belum diatur" jika kosong

### Changed

- **Laporan Laba Rugi**: item transaksi dengan `cogs = NULL` kini diestimasikan menggunakan `defaultCostPrice × qty × ratio_ke_base` dari data produk, bukan dihitung sebagai 0
- **StockService.deductStock**: jika FIFO menghasilkan `totalCogs = 0` (batch tanpa harga modal), otomatis fallback ke `defaultCostPrice × baseQty` dari produk

---

## [1.2.2] - 2026-06-08

### Added

- Filter rentang tanggal cepat di halaman **Laporan Laba Rugi** — tombol shortcut: Hari Ini, Kemarin, Minggu Ini, Bulan Ini

---

## [1.2.1] - 2026-06-08

### Fixed

- Error `ERR_INVALID_ARG_TYPE` di halaman Mutasi Stok — parameter tanggal dikirim sebagai `Date` object ke Drizzle `sql` template, diperbaiki dengan menggunakan ISO string langsung

---

## [1.2.0] - 2026-06-08

### Added

- Halaman **Mutasi Stok** (`/inventory/stock-logs`) — riwayat komprehensif semua pergerakan stok dari 7 sumber: penjualan, void penjualan, penerimaan PO, penyesuaian manual, stock opname, pecah satuan (break), dan retur
- API `GET /api/bo/inventory/stock-logs` dengan filter cabang, jenis mutasi, rentang tanggal, dan pencarian produk
- Kolom tabel: Tanggal, Jenis Mutasi (badge warna), Produk, Cabang, Satuan, Qty (merah/hijau), Harga Satuan, Referensi, Petugas, Keterangan
- Link "Mutasi Stok" di sidebar navigasi backoffice

---

## [1.1.9] - 2026-06-08

### Fixed

- Error `trim is not a function` saat menyimpan harga tier di halaman detail produk — `price` dari API dikembalikan sebagai `number` bukan `string`, diperbaiki dengan konversi `String(entry.price)` saat data harga dimuat

---

## [1.1.8] - 2026-06-08

### Fixed

- Data duplikat di tabel `product_prices` — 3.209 baris duplikat dihapus, menyisakan harga terendah per kombinasi produk/cabang/satuan/tier
- Tambah unique constraint `product_prices_unique_tier` pada kolom `(product_id, branch_id, uom_id, tier_type)` untuk mencegah duplikat harga di masa depan

---

## [1.1.7] - 2026-06-07

### Fixed

- Cetak struk dari checkout menghasilkan 2 lembar — diperbaiki dengan menambahkan `print:hidden` pada success dialog dan menghapus `inset-0` (full-height) dari container receipt agar tinggi container menyesuaikan konten
- Cetak ulang struk dari halaman riwayat transaksi menghasilkan halaman kosong — diperbaiki dengan memindahkan `ReceiptPrint` ke luar wrapper `print:hidden` di `TransactionHistoryClient` agar tidak ter-hide saat print

---

## [1.1.6] - 2026-06-07

### Fixed

- OWNER/GM di Web POS terus diredirect balik ke halaman pilih cabang setelah memilih cabang — diganti dari `router.push` ke `window.location.href` agar Next.js router cache tidak serve redirect lama sebelum cookie `posBranchId` ter-set

---

## [1.1.5] - 2026-06-07

### Added

- Tombol "Dashboard" di header Web POS untuk navigasi kembali ke dashboard backoffice — hanya tampil untuk role OWNER dan GM

---

## [1.1.4] - 2026-06-07

### Fixed

- Stok produk di Web POS tidak berkurang setelah transaksi selesai (stale state) — daftar produk kini di-refresh otomatis dari server setelah tombol "Transaksi Baru" diklik

---

## [1.1.3] - 2026-06-07

### Fixed

- Stok produk di daftar produk POS tidak berkurang setelah transaksi selesai (stale state) — daftar produk kini di-refresh otomatis dari Dexie setelah pengurangan stok lokal berhasil

---

## [1.1.2] - 2026-06-07

### Added

- `CLAUDE.md` di root monorepo — dokumentasi arsitektur, tech stack, konvensi kode, dan aturan wajib untuk mempercepat development dengan Claude Code
- Hook otomatis di `.claude/settings.json` — mengingatkan update `CHANGELOG.md` setiap kali ada perubahan file kode

---

## [1.1.1] - 2026-06-07

### Added

- Tombol **+ Buat satuan baru** di form tambah konversi UOM pada halaman detail produk — pengguna dapat membuat satuan ukur baru langsung dari halaman `/master-data/products/:id` tanpa perlu berpindah ke halaman Master Satuan

---

## [1.1.0] - 2026-06-07

### Added

- Branch isolation untuk Web POS — OWNER, GM, dan MANAGER kini dapat memilih cabang saat membuka POS melalui halaman `/pos/select-branch`
- Tombol **Ganti Cabang** di header POS untuk berpindah cabang tanpa logout
- Endpoint `GET /api/pos/branches` dan `POST /api/pos/set-branch` untuk manajemen sesi cabang aktif
- Helper `lib/pos-branch.ts` dengan fungsi `getPosBranchId()` dan `getPosBranchName()` yang dipakai di seluruh halaman POS
- Filter **Cabang** di halaman Riwayat Shift (hanya tampil untuk OWNER/GM)
- Filter **Cabang** di halaman Riwayat Penyesuaian Stok (hanya tampil untuk OWNER)
- Dropdown **Cabang** di halaman Penyesuaian Stok — OWNER dapat menyesuaikan stok untuk cabang manapun
- Endpoint `GET /api/bo/inventory/stock-adjustment?branchId=` untuk memuat ulang produk saat cabang diganti
- Komponen reusable `ProductSelect` dengan fitur pencarian client-side (filter nama & SKU)
- Halaman Changelog ini

### Fixed

- MANAGER kini hanya dapat melihat Stock Opname pending milik cabang sendiri (sebelumnya dapat melihat semua cabang)
- OWNER/GM/MANAGER yang login via `/pos/login` diarahkan ke halaman pilih cabang, bukan ke `/dashboard`

### Changed

- Seluruh halaman POS (`shift`, `page`, `settlement`, `history`, `receiving`) kini membaca `branchId` dari cookie `posBranchId` untuk OWNER/GM/MANAGER, bukan dari JWT

---

## [1.0.0] - 2026-05-21

### Added

- Rilis pertama sistem backoffice dan Web POS Hammielion
- Manajemen produk, kategori, brand, dan satuan ukur
- Manajemen stok: stock adjustment dan stock opname
- Purchase orders dan penerimaan barang
- Manajemen shift kasir dan settlement
- Laporan laba rugi dan nilai stok
- Sistem retur transaksi
- Audit log aktivitas pengguna
- Manajemen pengguna dan cabang
- Web POS dengan transaksi, open bill, dan void
