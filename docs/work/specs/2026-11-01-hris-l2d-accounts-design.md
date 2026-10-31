# Spec HRIS L2d — Akun & Tautan

Tanggal: 2026-11-01 · Status: **disetujui owner 2026-11-01 (§8 seluruhnya); dikode di `feat/hris-l2d-accounts`**
Cakupan: bagian L2d di [plan L2](../plans/2026-11-01-hris-l2.md). Sumber: PRD
[04](../../hris_planning/PRD/fase_1/04-karyawan-dan-akses.md) §3.1–3.2, §5; v3 `01-karyawan.md` (KAR-31, 33, 34,
69, 70, 72); `karyawan-dan-akses-spec` KAR-L04, L05, L10, L14, L40. Dasar kode: L2c (`employees`, `can()`),
kontrak L1 di `packages/auth` dan pintu internal `/api/internal/hris/*` di backoffice.
Aliran migrasi: **tanpa migrasi** bila §8 butir 4 disetujui (lihat §2).

## 1. Batas

**Dikerjakan:** buat akun pusat untuk karyawan (email + password awal, wajib ganti saat masuk pertama);
tautkan akun pusat yang sudah ada (pengguna backoffice lama) ke karyawan; lepas tautan; beri / ubah / cabut
akses kasir (role backoffice + cabang utama + cabang tugas) lewat pintu internal backoffice; reset password
oleh Pemilik/GM; keluarkan dari semua perangkat; layar Akun & Tautan, kartu Akun di Halaman orang,
Perangkat dan riwayat masuk saya (L14), Riwayat Masuk Semua Orang (L40).

**Tidak dikerjakan (usulan, lihat §8):**

| Hal | Di mana |
|---|---|
| Lupa password mandiri (L04) dan kode dari GM (L05) — butuh pemberitahuan ke GM + tabel kode (migrasi `auth`) | L2f (bersama Pemberitahuan) |
| Saran role backoffice per jabatan ("saran bawaan") | L2e (pengaturan per jabatan) |
| Muat data lama + tautkan massal pengguna backoffice lama | L2g (memakai fungsi tautan dari L2d) |
| Lihat sebagai (L41) | Ditunda (PRD 04) |
| Halaman Pengguna backoffice jadi "hanya lihat + kelola di HRIS" | Bersama cutover L1 (PRD 02 butir 3), bukan L2d |

## 2. Data

Tidak ada tabel baru. Sumber kebenaran akun tetap `auth`:

- `auth.accounts` (login: email asli + password, KAR-69), `auth.account_links` (`hris` → `employees.id`,
  `backoffice` → `petshop.users.id`), `auth.sessions`, `auth.login_events`, `auth.audit_events`.
- `auth.provisioning_requests` dipakai ulang untuk idempotensi pembuatan akun HRIS (`app_code = 'hris'`).
- Satu orang paling banyak satu akun (KAR-31): satu karyawan ↔ satu tautan `hris`; satu akun ↔ paling banyak
  satu tautan `backoffice`. Indeks unik yang ada sudah menjaga ini.
- Jejak HRIS: setiap aksi juga ditulis ke `hris.audit_events` (entity `account`, sebelum/sesudah), selain
  `auth.audit_events`.

## 3. Fungsi baru di `packages/auth`

Kontrak L1 (`resetPassword`, `revokeAccountLink`, `deactivateAccount`) hanya menerima pelaku bersesi
**backoffice** OWNER/GM, jadi HRIS tidak bisa memakainya — masalah yang sama dengan L2c. Polanya mengikuti
`setHrisLinkedAccountActive`: pemanggil tepercaya (route HRIS sesudah `can()` lolos), `actorAccountId`
dicatat di audit. Fungsi L1 lama tidak diubah.

| Fungsi | Isi |
|---|---|
| `provisionHrisAccount(sql, { idempotencyKey, employeeId, email, initialPassword, actorAccountId })` | Buat akun baru (email dinormalkan, `must_change_password = true`) + tautan `hris`. Email dipakai akun lain → `LINK_CONFLICT`; karyawan sudah bertaut → kembalikan akun itu. Aman diulang |
| `linkExistingAccountToEmployee(sql, { accountId, employeeId, actorAccountId })` | Tautkan akun yang sudah ada (mis. hasil backfill pengguna backoffice lama) ke karyawan. Ditolak bila akun sudah punya tautan `hris` aktif, atau karyawan sudah bertaut |
| `unlinkEmployeeAccount(sql, { employeeId, actorAccountId, reason })` | Cabut tautan `hris` + akses sesi HRIS-nya. Akun dan tautan backoffice tidak tersentuh |
| `resetPasswordByTrustedCaller(sql, { accountId, newPassword, actorAccountId })` | Sama dengan `resetPassword` (wajib ganti, semua sesi dicabut) tanpa syarat sesi backoffice |
| `revokeAllSessions(sql, { accountId, actorAccountId, reason })` | Keluarkan dari semua perangkat (`sessions.revoke`, KAR-69) |
| `linkBackofficeUser(sql, { accountId, localUserId, actorAccountId })` | Tautkan pengguna backoffice baru ke akun yang **sudah ada** (dipakai pintu internal §4); `provisionBackofficeAccount` lama menolak kasus ini (`LINK_CONFLICT`) |
| `listLoginEvents(sql, { accountId?, outcome?, from, to, limit })` | Baca `auth.login_events` + username/email akun, tanpa rahasia |

Pagar: tidak bisa mereset, mencabut tautan, atau mengeluarkan **dirinya sendiri** lewat jalur ini (KAR-34,
KAR-72 butir 1); ganti password sendiri tetap lewat pintu L1d.

## 4. Akses kasir — pintu internal backoffice

Backoffice tetap satu-satunya penulis tabel `petshop` (spec L1 §5). Pintu baru:

`POST /api/internal/hris/backoffice-access` (pagar `authorizeInternalRequest`, header `Idempotency-Key`)

```
{ accountId, employeeName, employeeCode, roleName, branchId, assignedBranchIds[], active }
```

- Akun belum punya tautan `backoffice` dan `active = true` → buat `petshop.users` (nama karyawan,
  `username` = bagian depan email bila belum dipakai, `staff_number` = kode karyawan, role, cabang utama,
  cabang tugas, `must_change_credentials = true`, PIN bawaan dari `app_settings` seperti layar Pengguna),
  lalu `linkBackofficeUser`. Kasir mengisi PIN sendiri saat masuk pertama di POS.
- Sudah bertaut → ubah role, cabang utama, cabang tugas, aktif/nonaktif pengguna itu. Mencabut akses kasir =
  `users.is_active = false` + akses sesi backoffice dicabut; akun pusat dan HRIS tetap jalan.
- `roleName` hanya dari daftar `OWNER, GM, MANAGER, KASIR, GUDANG, FINANCE`; OWNER/GM hanya bila pelaku
  OWNER/GM (selalu, karena tindakan ini `ownerOnly`). `branchId` harus cabang kasir aktif.

**Pelaku pintu internal.** Pagar sekarang menuntut token sesi yang sudah membuka **backoffice**; Pemilik
yang bekerja di HRIS belum tentu membukanya di sesi itu. Usulan (§8 butir 2): pagar juga menerima token
sesi yang valid untuk **hris**, lalu tetap memeriksa bahwa akun pelaku punya tautan backoffice ke pengguna
aktif ber-role OWNER/GM. Kunci layanan membuktikan pemanggilnya HRIS; sesi membuktikan orangnya; role
backoffice tetap jadi pagar kedua.

HRIS memanggil lewat jaringan internal (`BACKOFFICE_INTERNAL_URL` + `HRIS_INTERNAL_KEY`, variabel baru di
HRIS; staging lewat `.env` server dan `check-env.mjs`). Bila panggilan gagal, layar menyebut "Akses kasir
belum tersimpan, coba lagi" — aman diulang karena idempoten.

## 5. Hak dan pelaku

Tindakan baru di `modules/access/rules/actions.ts` (hak awal: tidak ada baris = hanya Pemilik/GM):

| Tindakan | Bendera |
|---|---|
| `account.manage` — buat akun, tautkan, lepas tautan | `ownerOnly`, `selfForbidden` |
| `account.reset_password` | `ownerOnly`, `selfForbidden` |
| `backoffice_access.manage` — beri/ubah/cabut akses kasir | `ownerOnly`, `selfForbidden` |

Tindakan yang sudah ada dipakai: `sessions.revoke` (tambah `selfForbidden`; sendiri lewat
`own_account.manage`), `login_history.view_all` (L40), `login_history.view_own` dan `own_account.manage` (L14).
Akun milik orang berhak tinggi (KAR-74) hanya diubah Pemilik/GM — otomatis karena semua tindakan di atas
`ownerOnly`. Tidak ada yang bisa mengubah akun / akses kasir dirinya sendiri (KAR-34).

## 6. Layar

Komponen L2a, mobile-first (layar pengelolaan nyaman di PC). Menu grup "Sistem": **Akun & Tautan**,
**Riwayat Masuk**.

- **Akun & Tautan** `/akun` — daftar akun pusat: nama karyawan (atau "Belum tertaut"), email/username, status
  akun (aktif / nonaktif / wajib ganti password / terkunci sementara), tautan HRIS, akses kasir (role +
  cabang). Saring: belum tertaut, punya akses kasir, nonaktif. Akun "belum tertaut" adalah pengguna
  backoffice lama hasil backfill → tombol **Tautkan ke karyawan** (pilih karyawan yang belum punya akun;
  periksa → simpan).
- **Kartu Akun di Halaman orang** `/karyawan/[id]` (pengganti kartu hanya-baca L2c):
  - Belum punya akun → **Buat akun** (2 langkah): email (wajib, asli) + password awal (≥ 8 karakter,
    tombol "Buat acak", ditampilkan sekali dengan pesan "Berikan ke orangnya; ia wajib menggantinya saat
    masuk pertama") → periksa → simpan. Atau **Tautkan akun yang ada**.
  - Sudah punya akun → email, status, terakhir masuk; tombol **Reset password**, **Keluarkan dari semua
    perangkat**, **Lepas tautan** (alasan wajib; kalimat akibat: "orang ini tidak bisa masuk HRIS").
  - **Akses kasir**: sakelar "Punya akses kasir" → role, cabang utama, cabang tugas → periksa → simpan
    (ditahan 3 detik). Bila sudah ada: ubah atau **Cabut akses kasir**.
  - Karyawan nonaktif: semua tombol mati kecuali lihat; akun ikut nonaktif (L2c §5).
- **Perangkat dan riwayat masuk saya (KAR-L14)** — dari Profil saya: perangkat yang sedang masuk (label
  perangkat, app, terakhir aktif), tombol **Keluarkan perangkat lain**; riwayat masuk 30 hari terakhir.
- **Riwayat Masuk Semua Orang (KAR-L40)** `/riwayat-masuk` — kapan, siapa, app, cara masuk, perangkat, hasil
  (berhasil / salah password / jeda / ditolak). Saring orang, hasil, tanggal; bawaan 7 hari; per halaman.

Route mutasi di `app/api/accounts/**` memakai pola L2b/L2c: `checkMutation` → `requireMutationAction` dengan
target orang → panggil fungsi §3 → `hris.audit_events`.

## 7. Tes (non-UI)

- `packages/auth` (integrasi DB): `provisionHrisAccount` idempoten dan menolak email kembar; tautkan akun
  lama; lepas tautan mencabut akses sesi HRIS tetapi bukan backoffice; reset mencabut semua sesi + wajib
  ganti; `linkBackofficeUser` menolak akun yang sudah punya tautan backoffice; tidak bisa diri sendiri.
- Backoffice (integrasi): pintu `backoffice-access` — buat pengguna + tautan, ubah role/cabang, cabut;
  idempoten; ditolak tanpa kunci (404), tanpa pelaku, pelaku bukan OWNER/GM, role/cabang tak valid.
- Hak HRIS: tiap tindakan baru sebagai tiap jabatan awal + `selfForbidden` (kunci jawaban L2b diperluas).
- `pnpm check:candidate` sekali pada kandidat akhir. Uji UI oleh owner di staging dengan skenario kriteria
  PRD: buat karyawan → buat akun → beri akses kasir → orang itu masuk POS (PIN baru) **dan** HRIS.

### Catatan implementasi (2026-11-01, tanpa keputusan baru)

- Fungsi auth ada di `packages/auth/src/hris-accounts.ts`. `revokeAllSessions` di tabel §3 menjadi
  `revokeAccountSessions` (dengan `exceptSessionId` untuk "keluarkan perangkat lain" milik sendiri). Tambahan:
  `findBackofficeUserOfAccount`, `listAccounts`, `findEmployeeAccount`, `listActiveSessions`.
- Tautan HRIS yang pernah dicabut dipakai ulang (indeks unik per akun dan per karyawan), jadi salah tautan
  dibetulkan dengan lepas lalu tautkan ke akun yang benar.
- Pintu internal: `POST` dan `GET /api/internal/hris/backoffice-access`. POST berbentuk "setel keadaan" sehingga
  aman diulang tanpa header `Idempotency-Key`; pengguna kasir yang terbuat tetapi gagal ditautkan dipakai ulang
  lewat nomor staf. GET memberi keadaan akses kasir per akun + daftar role/cabang, karena HRIS tidak membaca
  tabel `petshop` langsung. Hash password akun pusat disalin ke pengguna kasir baru (jalur rollback tetap jalan).
- Mengubah role/cabang atau mencabut akses kasir mencabut akses backoffice yang sedang terbuka
  (`ACCESS_CHANGED`/`ACCOUNT_DISABLED`) dan sesi lama; mencabut tidak mengubah akun pusat. Owner aktif terakhir
  tidak bisa diturunkan/dicabut.
- HRIS memanggil dengan `BACKOFFICE_INTERNAL_URL` + `HRIS_INTERNAL_KEY` (staging: compose). Compose produksi
  HRIS belum punya variabel auth sama sekali; mengisinya bagian cutover HRIS produksi.
- Jejak HRIS (`hris.audit_events`, entity `account`) ditulis sesudah panggilan auth/backoffice berhasil
  (koneksi berbeda, bukan satu transaksi); `auth.audit_events` tetap tercatat di transaksi auth.
- `sessions.revoke` diberi `selfForbidden`; hak HR lingkup Semua tetap berlaku untuk orang lain.
- Kartu Akun milik modul `accounts`, disisipkan halaman `/karyawan/[id]` lewat `accountSlot`; kartu hanya-baca
  L2c dan `loadAccountInfo` dihapus. Profil saya menampilkan kartu Perangkat dan riwayat masuk.
- Tes: `packages/db-roles/tests/auth-hris-accounts.integration.test.mjs` (6),
  `apps/backoffice/lib/hris-backoffice-access.integration.test.ts` (6, lewat `vitest.central-integration.config.ts`),
  `apps/hris/modules/accounts/rules/accounts.test.ts` + hak akun di `access.test.ts`.

## 8. Keputusan yang perlu disetujui

1. **Pangkas lingkup** seperti tabel §1: lupa password mandiri + kode GM → L2f; saran role per jabatan → L2e.
   Sampai L2f, orang yang lupa password minta **Reset password** ke Pemilik/GM.
2. **Pelaku pintu internal** boleh bersesi HRIS (bukan hanya backoffice), dengan pagar kedua role
   backoffice OWNER/GM (§4). Perlu perluasan klaim ke `apps/backoffice/lib/internal-gate.ts`.
3. **Pengguna kasir baru**: nomor staf = kode karyawan (`HML-0001`), username = bagian depan email,
   PIN bawaan + wajib ganti saat masuk pertama — sama dengan layar Pengguna sekarang.
4. **Tanpa migrasi** `auth`/`hris`/`petshop`: semua memakai tabel yang ada. Klaim path tetap mencakup
   `packages/auth/src/**`, `apps/backoffice/app/api/internal/hris/**`, `apps/backoffice/lib/internal-gate.ts`,
   `apps/backoffice/lib/services/central-provisioning.ts`, `apps/hris/**` (modul akun), infra env staging HRIS.
5. **Akses kasir hanya untuk karyawan aktif yang punya akun**; mencabut akses kasir menonaktifkan pengguna
   backoffice (tidak dihapus), akun pusat tetap.
