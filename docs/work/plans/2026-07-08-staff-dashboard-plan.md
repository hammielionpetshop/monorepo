# Rencana — Dashboard Staff, First-Login Onboarding, Username & Default Kredensial

> Status: **Draft untuk review** · Scope: `apps/backoffice` + `packages/shared` + `packages/db`
> Fitur bergabung dalam satu inisiatif karena saling bergantung pada perubahan tabel `users`,
> alur login, dan routing.
>
> 📋 **Backlog eksekusi:** [`docs/work/backlog/2026-07-08-staff-dashboard-onboarding.md`](../backlog/2026-07-08-staff-dashboard-onboarding.md)
> — rencana ini dipecah jadi item `S1–S8` yang bisa dikerjakan per sesi.
> **Urutan global: inisiatif #2** (setelah RBAC; sekaligus menutup kebocoran laba/omzet ke non-owner).

---

## 1. Keputusan yang Sudah Difinalisasi

| Topik | Keputusan |
|---|---|
| **Dashboard staff** | Route **terpisah**. `/dashboard` khusus **OWNER/GM**; `/staff` untuk **MANAGER/GUDANG/FINANCE** (tanpa metrik laba/omzet global). |
| **Username** | Kolom **baru**, `staffNumber` tetap ada. Login BO pakai **email atau username**; POS tetap `staffNumber`. Username **wajib** saat create user. |
| **First login** | Wajib **ganti password + isi PIN**. PIN **wajib untuk semua role** (termasuk FINANCE). |
| **Default kredensial** | **Configurable** (disimpan di settings, bisa diubah OWNER). Nilai awal seed: password `password123`, PIN `123456`. Form create pre-fill default (editable); edit punya tombol reset ke default. |

---

## 2. Kondisi Kode Sekarang (Baseline)

- **Login** hanya 2 mode (`packages/shared/src/schemas/auth.ts`): `staff_pin` (staffNumber+PIN, dipakai POS) & `email_password`. Belum ada `username`.
- **`/dashboard`** (`app/(dashboard)/dashboard/page.tsx`) menampilkan data owner-level: total pendapatan, estimasi laba kotor, semua cabang. Non-owner (GUDANG/FINANCE) saat ini **mendarat di sini** → kebocoran data.
- **`users`** (`packages/db/src/schema/users.ts`): `id, staffNumber, email, passwordHash, pinHash, name, roleId, branchId, isActive`. **Tidak ada** `username` maupun flag first-login.
- **Tidak ada** route ganti-password / onboarding.
- **Tidak ada** tabel settings/config apa pun di schema.
- **Create user** (`api/bo/settings/users/route.ts`) mewajibkan ketik `password` manual; tanpa PIN, tanpa default.
- **Middleware** (`middleware.ts`) redirect login: `KASIR → /pos`, `OWNER/GM/MANAGER → /pos/select-branch`, sisanya → `/dashboard`. `KASIR` diblok dari BO.

---

## 3. Perubahan Database

### 3.1 Kolom baru di `users` (`packages/db/src/schema/users.ts`)
```typescript
username: varchar('username', { length: 50 }).unique(),            // login BO, nullable di DB (wajib di API create)
mustChangeCredentials: boolean('must_change_credentials')
  .default(true).notNull(),                                         // gate first-login
credentialsSetAt: timestamp('credentials_set_at'),                 // audit kapan terakhir reset (opsional)
```

### 3.2 Tabel settings key-value baru (`packages/db/src/schema/settings.ts`)
Generik agar bisa dipakai ulang untuk setting lain di masa depan.
```typescript
import { varchar, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { users } from './users';

export const appSettings = petshop.table('app_settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  updatedBy: integer('updated_by').references(() => users.id),
});
```
Daftarkan di `packages/db/src/schema/index.ts`.

### 3.3 Migrasi & Seed
- Kolom `users` bersifat **aditif**.
- **Backfill:** user lama `must_change_credentials = false` (jangan paksa reset akun eksisting). Default `true` hanya untuk user baru.
- Seed `app_settings`:
  ```
  default_password → password123
  default_pin      → 123456
  ```

> **Catatan keamanan:** `default_password` disimpan **plaintext** (bukan hash) — memang harus, karena
> OWNER perlu **melihat**-nya untuk disampaikan ke staf baru. Risiko rendah: `mustChangeCredentials`
> memaksa rotasi saat login pertama. Nilai `passwordHash`/`pinHash` di `users` tetap di-hash (argon2).

---

## 4. Shared (`packages/shared`)

### 4.1 Login schema (`src/schemas/auth.ts`)
**Pertahankan** `loginStaffPinSchema` yang ada (POS: staffNumber+PIN) — jangan dilebur.
**Tambah** schema BO baru bermodel **identifier × credential**:
```typescript
// POS — TETAP seperti sekarang
export const loginStaffPinSchema = z.object({
  mode: z.literal('staff_pin'),
  staffNumber: z.string().min(1, 'Nomor staff wajib diisi'),
  pin: z.string().min(4).max(6),
});

// BO — BARU. Identifier HANYA email atau username (bukan staffNumber).
export const loginBoSchema = z.object({
  mode: z.literal('bo'),
  identifier: z.string().min(1, 'Email/username wajib diisi'),   // email | username
  credential: z.string().min(1, 'Password/PIN wajib diisi'),
  credentialType: z.enum(['password', 'pin']),
});

export const loginSchema = z.discriminatedUnion('mode', [
  loginStaffPinSchema,
  loginBoSchema,
]);
```
Backend meresolusi `identifier` BO dengan mencocokkan `email` **atau** `username` saja —
**`staffNumber` sengaja tidak dipakai untuk login BO** (lihat §9.3). Staf POS-only yang tak punya
email/username otomatis tak bisa masuk BO.

### 4.2 Onboarding schema (`src/schemas/auth.ts`)
```typescript
export const onboardingSchema = z.object({
  newPassword: z.string().min(6, 'Password minimal 6 karakter'),
  newPin: z.string().regex(/^\d{4,6}$/, 'PIN harus 4-6 digit'),
});
```

### 4.3 `JWTPayload` (`src/types/user.ts`)
Tambah field agar middleware bisa gate tanpa query DB:
```typescript
mustChangeCredentials: boolean;
```

---

## 5. Backend API

| Route | Perubahan |
|---|---|
| `api/auth/login/route.ts` | **`mode: 'staff_pin'`** (POS) tetap seperti sekarang. **`mode: 'bo'`** (baru): resolve `identifier` → `WHERE email = ? OR username = ?` (LIMIT 1, **tanpa staff_number**). Verifikasi argon2 ke `passwordHash` **atau** `pinHash` sesuai `credentialType`. Sertakan `mustChangeCredentials` di JWT. Pesan error generik ("Kredensial salah") agar tidak membocorkan identifier mana yang valid. |
| `api/auth/onboarding/route.ts` **(baru)** | POST, butuh auth. Validasi `onboardingSchema`. Tolak bila `newPassword` == default_password atau `newPin` == default_pin (paksa benar-benar ganti). Hash argon2, set `mustChangeCredentials=false`, `credentialsSetAt=now()`, re-issue accessToken (flag di JWT ikut berubah). |
| `api/bo/settings/users/route.ts` (POST) | Tambah `username` (wajib, unique). `password` & `pin` opsional → bila kosong ambil dari `app_settings`. Hash keduanya. Set `mustChangeCredentials=true`. Cek duplikat `username`. |
| `api/bo/settings/users/[id]/route.ts` (PATCH) | Tambah `username` (unique, boleh diubah). Tambah aksi `resetCredentials: boolean` → set password & PIN ke default dari `app_settings`, `mustChangeCredentials=true`. |
| `api/bo/settings/security/route.ts` **(baru)** | GET/PUT `default_password` & `default_pin` dari/ke `app_settings`. Guard `['OWNER']`. `updatedBy = payload.userId`. |

Helper baru `lib/app-settings.ts`: `getSetting(key)`, `getDefaultCredentials()` — baca dari `app_settings`.

---

## 6. Middleware & Routing (`middleware.ts`)

Dua guard baru (urutan penting, taruh setelah verifikasi token):

1. **First-login gate** — tertinggi prioritas:
   ```
   if (payload.mustChangeCredentials
       && pathname !== '/onboarding'
       && !pathname.startsWith('/api/auth'))
     → redirect /onboarding
   ```
   Cegah loop: `/onboarding` & `/api/auth/*` dikecualikan.

2. **Landing per role**:
   - Redirect di halaman login (`/login`): `OWNER/GM → /dashboard`, `MANAGER/GUDANG/FINANCE → /staff`, `KASIR → /pos`.
   - Guard `/dashboard`: role non-(OWNER/GM) → redirect `/staff`.
   - Guard `/staff`: OWNER/GM boleh akses (untuk preview) atau di-redirect ke `/dashboard` — **keputusan minor**, lihat §9.

`app/(auth)/login/page.tsx`: ganti hardcode `router.push('/dashboard')` → arahkan berdasarkan role dari response login.

---

## 7. Frontend

| Halaman | Kerja |
|---|---|
| `app/(auth)/login/page.tsx` | Toggle **identifier** (Email / Username) & **credential** (Password / PIN). Sekarang hanya email+password. Kirim `{ identifier, credential, credentialType }`. |
| `app/(auth)/onboarding/page.tsx` **(baru)** | Form wajib: password baru + konfirmasi, PIN baru + konfirmasi. Tampil setelah first login. Submit → `/api/auth/onboarding` → redirect ke landing sesuai role. |
| `app/(dashboard)/staff/page.tsx` **(baru)** | Dashboard staff, widget **per role**: MANAGER → shift & transaksi cabang sendiri; GUDANG → opname/transfer pending; FINANCE → piutang & pembayaran pending. Reuse pola `MetricCard`/`ShiftBadge`. Tanpa laba/omzet global. |
| `app/(dashboard)/settings/security/page.tsx` **(baru)** | Form OWNER ubah `default_password` & `default_pin`. |
| `settings/users/_components/*` | Field `username` (wajib). Field `password` & `pin` pre-fill default (di-fetch dari `/api/bo/settings/security`), editable. Tombol **Reset ke default** saat edit → kirim `resetCredentials:true`. |
| `app/(dashboard)/_components/sidebar.tsx` | Link "Dashboard" → `/staff` untuk MANAGER/GUDANG/FINANCE. Tambah menu **Keamanan** di grup Pengaturan (roles `['OWNER']`). |

---

## 8. Urutan Eksekusi

Tiap langkah tidak merusak yang lama (aditif / backward-compatible):

1. **Schema + migrasi + seed** — kolom `users`, tabel `app_settings`, backfill, seed default.
2. **Shared** — `loginSchema`, `onboardingSchema`, `JWTPayload.mustChangeCredentials` → `pnpm typecheck`.
3. **Login backend** — identifier resolver + credentialType. (Frontend lama masih bisa dimigrasikan bertahap.)
4. **Onboarding** — route + page + middleware first-login gate.
5. **Settings security** — tabel sudah ada; buat route + page + helper `getDefaultCredentials()`.
6. **Users create/edit** — username wajib, default dari settings, reset ke default.
7. **Landing routing** — `/staff` + middleware role guard + redirect login page.
8. **`/staff` dashboard UI** — widget per role.
9. **`CHANGELOG.md`** — update (fitur → wajib; kemungkinan beberapa entry minor: username+login, onboarding, staff dashboard, default kredensial).

**Estimasi:** ~3 hari termasuk testing manual per role.

**Titik rawan:**
- Login resolver: jangan sampai `username`/`email`/`staffNumber` bertabrakan antar user (semua unique, tapi cek urutan match).
- Middleware first-login gate: hindari redirect loop (kecualikan `/onboarding` & `/api/auth`).
- Onboarding wajib menolak nilai == default agar rotasi benar-benar terjadi.

---

## 9. Keputusan Minor

1. **OWNER/GM akses `/staff`?** → **FINAL: diizinkan, read-only.** Guard `/staff` tidak menendang OWNER/GM.
3. **Login by `staffNumber` di BO?** → **FINAL: tidak.** Resolver BO hanya email/username. Staf POS-only (tanpa email/username) tidak bisa masuk BO. POS tetap login via `staff_pin` (staffNumber+PIN). Lihat §4.1 & §5.

**Masih terbuka (diputus saat eksekusi UI, langkah 8):**
2. **Isi widget `/staff` per role** — detail metrik final belum dikunci; akan disesuaikan dengan service yang sudah ada (`dashboard-service`, nav-badges).

---

## 10. Ringkasan File

**Baru (6):**
`packages/db/src/schema/settings.ts`, `app/api/auth/onboarding/route.ts`,
`app/api/bo/settings/security/route.ts`, `app/(auth)/onboarding/page.tsx`,
`app/(dashboard)/staff/page.tsx`, `app/(dashboard)/settings/security/page.tsx`

**Diubah (~9):**
`packages/db/src/schema/users.ts` (+`index.ts`), `packages/shared/src/schemas/auth.ts`,
`packages/shared/src/types/user.ts`, `app/api/auth/login/route.ts`,
`app/api/bo/settings/users/route.ts`, `app/api/bo/settings/users/[id]/route.ts`,
`middleware.ts`, `app/(auth)/login/page.tsx`, `app/(dashboard)/_components/sidebar.tsx`,
form di `settings/users/_components/*`

**Migrasi DB:** kolom `users` (username, must_change_credentials, credentials_set_at) + tabel `app_settings` + seed default.
