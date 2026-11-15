# Backlog — Dashboard Staff, First-Login Onboarding, Username & Default Kredensial

**Status:** ✅ **SELESAI** (S1–S8) — CHANGELOG `1.57.0`–`1.64.0`. Checkbox disinkronkan dengan commit
pada audit backlog 2026-07-13 (sebelumnya tertinggal tak tercentang meski kode sudah merge).

**Tanggal:** 2026-07-08
**Sumber rencana:** `docs/work/plans/2026-07-08-staff-dashboard-plan.md`
**Scope:** `apps/backoffice` + `packages/shared` + `packages/db`
**Urutan global:** **INISIATIF #2** (setelah RBAC — memanfaatkan `scopeFilter` untuk widget per-cabang)

> ⚠️ **Sekaligus menambal kebocoran data aktif:** saat ini GUDANG/FINANCE mendarat di `/dashboard`
> dan **melihat omzet + laba kotor global**. S7+S8 menutup ini.

Empat fitur digabung dalam satu inisiatif karena saling bergantung pada tabel `users`, alur login,
dan routing.

## Keputusan yang sudah difinalisasi
| Topik | Keputusan |
|---|---|
| **Dashboard staff** | Route terpisah. `/dashboard` khusus OWNER/GM; `/staff` untuk MANAGER/GUDANG/FINANCE (tanpa laba/omzet global). |
| **Username** | Kolom baru, `staffNumber` tetap. Login BO pakai **email atau username** (bukan staffNumber); POS tetap staffNumber. Username **wajib** saat create. |
| **First login** | Wajib ganti password + isi PIN. PIN wajib **semua role** (termasuk FINANCE). |
| **Default kredensial** | Configurable (di `app_settings`, bisa diubah OWNER). Seed awal: password `password123`, PIN `123456`. |
| **OWNER/GM akses `/staff`** | Diizinkan, read-only (guard tak menendang OWNER/GM). |
| **Login by `staffNumber` di BO** | Tidak. Resolver BO hanya email/username. |

## Urutan pengerjaan
`S1 → S2 → S3 → S4 → S5 → S6 → S7 → S8`. Tiap langkah aditif/backward-compatible.

---

## S1 — Schema `users` + `app_settings` + migrasi + seed
**Prioritas:** Tinggi · **Effort:** M · **Depends:** —

### Scope teknis
- `packages/db/src/schema/users.ts`: tambah `username` (varchar 50, unique, nullable di DB tapi wajib di API),
  `mustChangeCredentials` (boolean default true notNull), `credentialsSetAt` (timestamp nullable).
- File baru `packages/db/src/schema/settings.ts`: tabel `app_settings` (key PK, value text, updatedAt, updatedBy→users). Daftarkan di `schema/index.ts`.
- Migrasi + **backfill**: user lama `must_change_credentials = false` (jangan paksa reset akun eksisting).
- Seed `app_settings`: `default_password → password123`, `default_pin → 123456`.

### Catatan keamanan
`default_password` disimpan **plaintext** (memang harus — OWNER perlu melihatnya untuk disampaikan ke
staf). `passwordHash`/`pinHash` di `users` tetap argon2. `mustChangeCredentials` memaksa rotasi saat login pertama.

### Kriteria selesai
- [x] Kolom `users` + tabel `app_settings` ada; terdaftar di `index.ts`.
- [x] Backfill user lama `false`; default seed masuk.
- [x] `pnpm typecheck` + migrasi jalan.

---

## S2 — Shared schemas (login, onboarding, JWTPayload)
**Prioritas:** Tinggi · **Effort:** S · **Depends:** —

### Scope teknis
- `packages/shared/src/schemas/auth.ts`: **pertahankan** `loginStaffPinSchema` (POS). **Tambah**
  `loginBoSchema` (`mode:'bo'`, `identifier`, `credential`, `credentialType: 'password'|'pin'`).
  Gabung ke `loginSchema` discriminatedUnion.
- Tambah `onboardingSchema` (`newPassword` min 6, `newPin` regex 4–6 digit).
- `packages/shared/src/types/user.ts`: tambah `mustChangeCredentials: boolean` ke `JWTPayload`.

### Kriteria selesai
- [x] Schema baru diekspor; POS schema tak berubah.
- [x] `pnpm typecheck` hijau.

---

## S3 — Login backend (identifier resolver + credentialType)
**Prioritas:** Tinggi · **Effort:** M · **Depends:** S1, S2

### Scope teknis
- `apps/backoffice/app/api/auth/login/route.ts`:
  - `mode:'staff_pin'` (POS) tetap.
  - `mode:'bo'` baru: resolve `identifier` → `WHERE email = ? OR username = ?` (LIMIT 1, **tanpa staff_number**).
  - Verifikasi argon2 ke `passwordHash` **atau** `pinHash` sesuai `credentialType`.
  - Sertakan `mustChangeCredentials` di JWT. Error generik ("Kredensial salah") — jangan bocorkan identifier valid.

### Titik rawan
Jangan sampai `username`/`email`/`staffNumber` bertabrakan antar user — cek urutan match.

### Kriteria selesai
- [x] Login BO via email & via username berhasil (password & PIN).
- [x] Staf POS-only (tanpa email/username) tak bisa masuk BO.
- [x] JWT membawa `mustChangeCredentials`.

---

## S4 — Onboarding (route + page + middleware first-login gate)
**Prioritas:** Tinggi · **Effort:** M · **Depends:** S2, S3

### Scope teknis
- Route baru `api/auth/onboarding/route.ts` (POST, butuh auth): validasi `onboardingSchema`, **tolak
  bila nilai == default** (paksa benar-benar ganti), hash argon2, set `mustChangeCredentials=false` +
  `credentialsSetAt=now()`, re-issue accessToken.
- Page baru `app/(auth)/onboarding/page.tsx`: form password baru + konfirmasi, PIN baru + konfirmasi.
- `middleware.ts` — first-login gate (prioritas tertinggi): `if mustChangeCredentials && path != '/onboarding' && !path.startsWith('/api/auth') → redirect /onboarding`. Cegah loop (kecualikan `/onboarding` & `/api/auth/*`).

### Kriteria selesai
- [x] User baru dipaksa onboarding sebelum akses halaman lain.
- [x] Onboarding menolak nilai == default.
- [x] Tidak ada redirect loop.

---

## S5 — Settings security (route + page + helper)
**Prioritas:** Sedang · **Effort:** S · **Depends:** S1

### Scope teknis
- Route baru `api/bo/settings/security/route.ts`: GET/PUT `default_password` & `default_pin` dari/ke
  `app_settings`. Guard `['OWNER']`. `updatedBy = payload.userId`.
- Helper baru `lib/app-settings.ts`: `getSetting(key)`, `getDefaultCredentials()`.
- Page baru `app/(dashboard)/settings/security/page.tsx`: form OWNER ubah default.

### Kriteria selesai
- [x] OWNER bisa lihat & ubah default password/PIN; non-OWNER 403.
- [x] Helper dipakai S6.

---

## S6 — Users create/edit (username wajib, default, reset)
**Prioritas:** Tinggi · **Effort:** M · **Depends:** S1, S5

### Scope teknis
- `api/bo/settings/users/route.ts` (POST): tambah `username` (wajib, unique). `password`/`pin`
  opsional → bila kosong ambil dari `app_settings`. Hash keduanya. Set `mustChangeCredentials=true`. Cek duplikat username (409).
- `api/bo/settings/users/[id]/route.ts` (PATCH): `username` boleh diubah (unique); aksi
  `resetCredentials:boolean` → set password & PIN ke default, `mustChangeCredentials=true`.
- Form `settings/users/_components/*`: field `username` (wajib); `password`/`pin` pre-fill default
  (fetch dari `/api/bo/settings/security`), editable; tombol **Reset ke default** saat edit.

### Kriteria selesai
- [x] Create user wajib username; password/PIN default bila kosong; duplikat username → 409.
- [x] Edit: reset ke default berfungsi.

---

## S7 — Landing routing (/staff + middleware guard + login redirect)
**Prioritas:** Tinggi · **Effort:** M · **Depends:** S2 · **Menutup kebocoran data**

### Scope teknis
- `middleware.ts` — landing per role: `OWNER/GM → /dashboard`, `MANAGER/GUDANG/FINANCE → /staff`,
  `KASIR → /pos`. Guard `/dashboard`: role non-(OWNER/GM) → redirect `/staff`. Guard `/staff`:
  OWNER/GM boleh (read-only).
- `app/(auth)/login/page.tsx`: ganti hardcode `router.push('/dashboard')` → arahkan berdasarkan role.
- `app/(dashboard)/_components/sidebar.tsx`: link "Dashboard" → `/staff` untuk MANAGER/GUDANG/FINANCE;
  tambah menu "Keamanan" (roles `['OWNER']`).

### Kriteria selesai
- [x] GUDANG/FINANCE **tidak lagi** bisa melihat `/dashboard` (omzet/laba global) — di-redirect ke `/staff`.
- [x] Login mengarahkan tiap role ke landing yang benar.

---

## S8 — `/staff` dashboard UI (widget per role)
**Prioritas:** Tinggi · **Effort:** M–L · **Depends:** S7 · (idealnya pakai `scopeFilter` dari RBAC)

### Scope teknis
- Page baru `app/(dashboard)/staff/page.tsx`. Widget per role, **tanpa laba/omzet global**:
  - MANAGER → shift & transaksi cabang sendiri.
  - GUDANG → opname/transfer pending.
  - FINANCE → piutang & pembayaran pending.
- Reuse `MetricCard`/`ShiftBadge`, service `dashboard-service`, nav-badges. Batasi query ke cabang
  user (pakai `scopeFilter` bila RBAC sudah ada; jika belum, `eq(branchId, payload.branchId)`).

### Terbuka (diputus saat eksekusi)
Detail metrik final per role belum dikunci — sesuaikan dengan service yang ada.

### Kriteria selesai
- [x] `/staff` menampilkan widget sesuai role; tidak ada data laba/omzet global.
- [x] Data dibatasi ke cabang user.

---

## Catatan lintas-item
- Semua pesan error/label/komentar **Bahasa Indonesia**; harga **big.js** + integer.
- **Setiap item** yang mengubah perilaku → update `apps/backoffice/CHANGELOG.md` (kemungkinan beberapa
  entry minor: username+login, onboarding, staff dashboard, default kredensial).
- Reuse pola auth (`jose` HS256), response shape, Drizzle query style yang ada.
- Estimasi rencana: ~3 hari termasuk testing manual per role.
- Terkait: [[2026-07-08-rbac-permission-plumbing]] (scopeFilter untuk S8).
