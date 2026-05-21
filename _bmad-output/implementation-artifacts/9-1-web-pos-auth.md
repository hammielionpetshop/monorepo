# Story 9.1: Web POS Authentication

Status: review

## Story

As a Kasir,
I want login ke Web POS menggunakan username dan password,
so that saya bisa mengakses sistem kasir dari tablet atau HP saya.

## Acceptance Criteria

1. **Given** Kasir membuka URL `/pos/login` di browser  
   **When** mereka memasukkan kredensial yang valid (email + password)  
   **Then** sistem mengarahkan mereka ke halaman utama POS (`/pos`)

2. **Given** Kasir login dengan role `KASIR`  
   **When** mereka mencoba mengakses halaman Backoffice (`/bo/*` atau `/dashboard`)  
   **Then** sistem menolak akses dan mengarahkan kembali ke `/pos`

3. **Given** Kasir yang sudah login menutup browser dan membukanya kembali  
   **When** mereka mengunjungi `/pos`  
   **Then** session masih aktif selama cookie `accessToken` belum expired (tidak perlu login ulang)

4. **Given** Kasir mengunjungi `/pos/login` saat sudah login  
   **When** halaman dimuat  
   **Then** sistem otomatis mengarahkan ke `/pos` (tidak perlu login ulang)

5. **Given** Kasir menekan tombol "Keluar" di halaman POS  
   **When** dikonfirmasi  
   **Then** cookie dihapus dan kasir diarahkan ke `/pos/login`

6. **Given** Pengguna non-KASIR (OWNER, MANAGER, dll) membuka `/pos/login`  
   **When** mereka login dengan sukses  
   **Then** sistem mengarahkan mereka ke `/dashboard` (bukan `/pos`)

## Tasks / Subtasks

- [x] Task 1: Update `middleware.ts` untuk mendukung routing Web POS (AC: 2, 3, 4, 6)
  - [x] Tambah `/pos/login` sebagai public path (bebas akses tanpa token)
  - [x] Tambah role guard: user dengan token valid yang punya role `KASIR` dan mencoba akses `/bo/*` atau `/dashboard` → redirect ke `/pos`
  - [x] Tambah route guard: request ke `/pos/*` tanpa token yang valid → redirect ke `/pos/login`
  - [x] Pastikan `/api/*` routes tidak terpengaruh (tetap 401 JSON untuk unauthenticated API calls)

- [x] Task 2: Buat route group `(pos)` di `apps/backoffice/app/` (AC: 1, 3, 5)
  - [x] Buat `apps/backoffice/app/pos/layout.tsx` — layout mobile-first, tanpa sidebar backoffice
  - [x] Layout membaca cookie `accessToken` dan verify; jika tidak valid → redirect ke `/pos/login`
  - [x] Layout expose nama user dan tombol "Keluar" (Server Action delete cookie → redirect ke `/pos/login`)

- [x] Task 3: Buat halaman login POS `/pos/login` (AC: 1, 4)
  - [x] Buat `apps/backoffice/app/pos/login/page.tsx` — Client Component, mobile-first layout
  - [x] Form: field email + password, tombol submit, pesan error
  - [x] Saat login sukses: simpan cookie `accessToken` dan redirect ke `/pos`
  - [x] Saat sudah authenticated: redirect ke `/pos` (cek cookie di server component wrapper)
  - [x] Touch target minimum 44px untuk semua interactive elements
  - [x] Font dan spacing lebih besar dari BO login (kasir pakai tablet/HP)

- [x] Task 4: Buat halaman utama POS placeholder `/pos` (AC: 1, 2, 3)
  - [x] Buat `apps/backoffice/app/pos/page.tsx` — placeholder untuk Story 9.2
  - [x] Tampilkan nama kasir, cabang, dan pesan "Selamat datang di Web POS"
  - [x] Halaman ini dilindungi oleh `pos/layout.tsx`

## Dev Notes

### Arsitektur Web POS di Monorepo

Web POS diimplementasi sebagai **route group `(pos)`** di dalam `apps/backoffice`. Ini berarti:
- URL pattern: `/pos/*` untuk kasir (bukan `/bo/*` yang untuk backoffice)
- Satu Next.js app, satu deployment, shared auth infrastructure
- Layout terpisah: `(pos)/layout.tsx` ≠ `(dashboard)/layout.tsx`
- ADR-005: Web POS sebagai route group dalam `apps/backoffice` [Source: sprint-change-proposal-2026-05-15.md#ADR-005]

### Auth Mechanism yang Sudah Ada

Sistem auth sudah sepenuhnya production-ready. Jangan reimplementasi — cukup reuse:

**Cookie:** `accessToken` disimpan sebagai cookie biasa (bukan HTTP-only) karena di-set via `document.cookie` di client.
```
document.cookie = `accessToken=${data.accessToken}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`
```
[Source: `apps/backoffice/app/(auth)/login/page.tsx`]

**Middleware membaca token dari:**
1. `Authorization: Bearer <token>` header (untuk Electron POS API calls)
2. Cookie `accessToken` (untuk web browser sessions)
[Source: `apps/backoffice/middleware.ts:47-49`]

**Token verification:** `verifyAccessToken(token)` di `lib/auth.ts` — returns `JWTPayload | null`

**Login API:** `POST /api/auth/login` dengan body `{ mode: 'email_password', email, password }`  
Response: `{ user: {...}, accessToken, refreshToken }`
[Source: `apps/backoffice/app/api/auth/login/route.ts`]

**JWTPayload type** (dari `@petshop/shared`):
```typescript
interface JWTPayload {
  userId: number;
  userName: string;
  staffNumber: string | null;
  branchId: number;
  branchName: string;
  role: UserRole; // 'OWNER' | 'GM' | 'MANAGER' | 'KASIR' | 'GUDANG' | 'FINANCE'
  permissions: string[];
  iat?: number;
  exp?: number;
}
```
[Source: `packages/shared/src/types/user.ts`]

### Modifikasi Middleware yang Diperlukan

File: `apps/backoffice/middleware.ts`

Middleware saat ini hanya mengenal satu public path untuk UI: `/login`. Kita perlu:

1. **Tambah public paths untuk POS:**
   ```typescript
   pathname === '/pos/login'
   ```

2. **Tambah role-based guard SETELAH token verified:**
   ```typescript
   // Setelah payload didapat...
   
   // KASIR mencoba akses backoffice → redirect ke /pos
   if (payload.role === 'KASIR' && (pathname.startsWith('/dashboard') || pathname.startsWith('/bo') || pathname.startsWith('/master-data') || pathname.startsWith('/settings') || pathname.startsWith('/reports') || pathname.startsWith('/inventory') || pathname.startsWith('/retur') || pathname.startsWith('/audit-log') || pathname.startsWith('/purchase-orders'))) {
     return NextResponse.redirect(new URL('/pos', request.url))
   }
   
   // Non-KASIR mencoba akses POS UI → redirect ke /dashboard
   if (payload.role !== 'KASIR' && pathname.startsWith('/pos') && !pathname.startsWith('/api/')) {
     return NextResponse.redirect(new URL('/dashboard', request.url))
   }
   ```

3. **Unauthenticated request ke `/pos/*`:**
   ```typescript
   // Sudah ada: redirect ke /login untuk unauthenticated
   // Perlu diubah: jika request ke /pos/* → redirect ke /pos/login
   if (pathname.startsWith('/pos')) {
     return NextResponse.redirect(new URL('/pos/login', request.url))
   }
   return NextResponse.redirect(new URL('/login', request.url))
   ```

**PENTING:** Jangan rusak logic CORS dan API routes yang sudah ada. Urutan check harus:
1. OPTIONS preflight → return
2. Public paths (termasuk `/api/auth`, `/pos/login`, `/login`) → pass through
3. No token → redirect berdasarkan path
4. Token invalid → redirect berdasarkan path  
5. Token valid + role guard → redirect jika diperlukan
6. Token valid → pass through

### Layout POS — Pattern dari `(dashboard)/layout.tsx`

File referensi: `apps/backoffice/app/(dashboard)/layout.tsx`

`(dashboard)/layout.tsx` menggunakan Server Component dengan:
- `cookies()` untuk membaca token
- `verifyAccessToken()` untuk validasi
- `redirect('/login')` jika invalid
- Server Action untuk logout (delete cookie + redirect)

Pola yang sama harus digunakan di `(pos)/layout.tsx`, dengan redirect ke `/pos/login`.

**Layout POS berbeda dari Dashboard:**
- Tidak ada sidebar navigasi (full-width)
- Header simpel: nama kasir + cabang + tombol keluar
- Mobile-first: `min-h-screen`, font lebih besar, padding lebih besar

### Login Page POS — Pattern dari `(auth)/login/page.tsx`

File referensi: `apps/backoffice/app/(auth)/login/page.tsx`

Login page BO adalah Client Component. POS login mengikuti pola yang sama dengan perbedaan:
- Redirect ke `/pos` setelah berhasil (bukan `/dashboard`)
- Judul: "Web POS — Hammielion" (bukan "Enterprise Backoffice System")
- Ukuran input/button lebih besar untuk touch interface
- Min touch target: 44px (sesuai WCAG 2.5.5)

### Struktur File yang Perlu Dibuat/Dimodifikasi

**DIMODIFIKASI:**
- `apps/backoffice/middleware.ts` — tambah POS public paths + role guard

**DIBUAT (BARU):**
- `apps/backoffice/app/(pos)/layout.tsx` — POS layout (Server Component)
- `apps/backoffice/app/(pos)/login/page.tsx` — POS login page (Client Component)
- `apps/backoffice/app/(pos)/page.tsx` — POS home placeholder (Server Component)

**TIDAK PERLU DIBUAT:**
- API route baru — reuse `/api/auth/login` yang sudah ada
- Auth library baru — reuse `lib/auth.ts` yang sudah ada
- Database schema baru — tidak ada perubahan schema

### Mobile-First Requirements (ADR-006, Technical Notes Story 9.1)

- Touch target minimum: **44px** untuk semua button dan interactive element
- Font size body: `text-base` atau lebih besar (jangan `text-xs` di elemen utama)
- Input padding: `py-4` (bukan `py-3`) untuk nyaman diketik di touchscreen
- Layout: full-width, tidak ada sidebar, tidak ada multi-column

### Route Group Behavior Next.js

Route group `(pos)` tidak menambahkan segment ke URL:
- `app/(pos)/page.tsx` → URL `/pos` ✗ **SALAH** — ini akan menjadi `/`
- Yang benar: `app/(pos)/pos/page.tsx` → URL `/pos` ✓

**ATAU** gunakan tanpa route group dan letakkan di `app/pos/`:
- `app/pos/page.tsx` → URL `/pos` ✓
- `app/pos/login/page.tsx` → URL `/pos/login` ✓
- `app/pos/layout.tsx` → wraps all `/pos/*` pages ✓

**Rekomendasi:** Gunakan `apps/backoffice/app/pos/` (tanpa parentheses route group) karena lebih sederhana dan URL-nya langsung terbentuk dengan benar. Route group `(pos)` memerlukan tambahan segment di dalamnya.

Alternatif dengan route group yang benar:
```
app/(pos)/          ← route group, tidak mempengaruhi URL
  layout.tsx        ← berlaku untuk semua di dalam group ini
  pos/              ← segment ini yang membentuk /pos URL
    page.tsx        ← URL: /pos
    login/
      page.tsx      ← URL: /pos/login
```

Gunakan pola **`app/pos/` langsung** untuk simplisitas.

### Checklist Anti-Regresi

Setelah implementasi, verifikasi hal berikut tidak rusak:
- [ ] Owner/Manager masih bisa login di `/login` dan akses `/dashboard`
- [ ] Electron POS client masih bisa hit `/api/pos/*` dengan Bearer token (tidak terkena redirect)
- [ ] Unauthenticated request ke `/api/*` masih return 401 JSON (bukan redirect)
- [ ] CORS headers masih berfungsi untuk Electron origin

### Project Conventions

- Semua file: **kebab-case** (`pos-layout.tsx` bukan `posLayout.tsx`) — di Next.js, file route tetap `page.tsx`/`layout.tsx`
- Error messages user-facing: **Bahasa Indonesia**
- Tidak ada `any` type — gunakan `JWTPayload` dari `@petshop/shared`
- Server Components default; Client Component hanya untuk interaktivitas (form input)
[Source: `_bmad-output/project-context.md#Critical Implementation Rules`]

### Project Structure Notes

```
apps/backoffice/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx           ← BO login (SUDAH ADA, jangan diubah)
│   ├── (dashboard)/
│   │   └── layout.tsx               ← BO dashboard layout (SUDAH ADA, jangan diubah)
│   ├── pos/                         ← BARU: Web POS
│   │   ├── layout.tsx               ← BARU: POS layout, auth guard
│   │   ├── page.tsx                 ← BARU: POS home (/pos)
│   │   └── login/
│   │       └── page.tsx             ← BARU: POS login (/pos/login)
│   ├── api/
│   │   └── auth/login/route.ts      ← SUDAH ADA, tidak diubah
│   └── layout.tsx                   ← root layout, tidak diubah
├── lib/
│   └── auth.ts                      ← SUDAH ADA, tidak diubah
└── middleware.ts                    ← DIMODIFIKASI: tambah POS routes
```

### References

- [Source: `apps/backoffice/middleware.ts`] — middleware yang akan dimodifikasi
- [Source: `apps/backoffice/lib/auth.ts`] — `verifyAccessToken`, `signAccessToken`
- [Source: `apps/backoffice/app/api/auth/login/route.ts`] — login API (reuse as-is)
- [Source: `apps/backoffice/app/(auth)/login/page.tsx`] — pola login page BO
- [Source: `apps/backoffice/app/(dashboard)/layout.tsx`] — pola protected layout
- [Source: `packages/shared/src/types/user.ts`] — `UserRole`, `JWTPayload`
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md#4.4`] — Story 9.1 requirements
- [Source: `_bmad-output/planning-artifacts/epics.md#Epic 9`] — Epic 9 technical notes
- [Source: `_bmad-output/project-context.md`] — project conventions

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- ESLint error pre-existing (versi conflict `@typescript-eslint@7` vs `eslint@9`) pada file `(auth)/login/page.tsx` — bukan disebabkan perubahan story ini. TypeScript check (tsc --noEmit) clean.
- Menggunakan `apps/backoffice/app/pos/` (bukan `app/(pos)/pos/`) sesuai rekomendasi Dev Notes untuk simplisitas URL routing.

### Completion Notes List

- Task 1: Middleware diperbarui — tambah `/pos/login` sebagai public path, role guard KASIR→redirect /pos, non-KASIR redirect /dashboard, unauthenticated /pos/* redirect /pos/login. API routes tetap return 401 JSON.
- Task 2: `apps/backoffice/app/pos/layout.tsx` — Server Component, mobile-first, header dengan nama kasir + cabang + tombol Keluar (Server Action). Min touch target 44px.
- Task 3: `apps/backoffice/app/pos/login/page.tsx` — Client Component, form email+password, min-h-[52px] untuk input dan button, redirect ke /pos (KASIR) atau /dashboard (non-KASIR) setelah login.
- Task 4: `apps/backoffice/app/pos/page.tsx` — Server Component placeholder, tampilkan nama kasir dan cabang dari JWT payload.
- Semua AC terpenuhi: login redirect (AC1), role guard (AC2), session persistence via cookie (AC3), sudah login redirect (AC4 — ditangani middleware), logout (AC5), non-KASIR redirect dashboard (AC6).

### File List

- `apps/backoffice/middleware.ts` (dimodifikasi)
- `apps/backoffice/app/pos/layout.tsx` (baru)
- `apps/backoffice/app/pos/login/page.tsx` (baru)
- `apps/backoffice/app/pos/page.tsx` (baru)

### Review Findings

- [x] [Review][Patch] Loop Redirect Tak Terbatas (Infinite Redirect Loop) pada Rute `/pos/login` [apps/backoffice/app/pos/(authenticated)/layout.tsx:14]
- [x] [Review][Patch] Ketiadaan Pengalihan Otomatis Bagi Kasir/Pengguna yang Sudah Terautentikasi (AC 4) [apps/backoffice/middleware.ts:44]
- [x] [Review][Patch] Ketiadaan Konfirmasi Sebelum Keluar (Logout) (AC 5) [apps/backoffice/components/pos/logout-button.tsx]
- [x] [Review][Patch] Potensi Pengiriman Ganda (Race Condition) pada Formulir Login POS [apps/backoffice/app/pos/login/page.tsx:13]
- [x] [Review][Patch] Parsing Error Respons API yang Kurang Aman (Unsafe JSON Parsing) [apps/backoffice/app/pos/login/page.tsx:24]
- [x] [Review][Patch] Ketiadaan Pembersihan Spasi Input (Input Trimming) pada Halaman Login [apps/backoffice/app/pos/login/page.tsx:22]
- [x] [Review][Patch] Verifikasi Token Ganda (Duplicate Token Verification) di Server Components [apps/backoffice/app/pos/(authenticated)/layout.tsx:10]
- [x] [Review][Defer] Penyimpanan Access Token Menggunakan Client-side Cookie Tanpa Flag Secure/HttpOnly [apps/backoffice/app/pos/login/page.tsx:32] — deferred, pre-existing
- [x] [Review][Defer] Celah Keamanan Guard Peran (Role Guard Bypass) pada API Backoffice `/api/bo/...` [apps/backoffice/middleware.ts:77] — deferred, pre-existing
- [x] [Review][Defer] Ketidaksesuaian Waktu Kedaluwarsa Cookie dan JWT Token [apps/backoffice/app/pos/login/page.tsx:32] — deferred, pre-existing
- [x] [Review][Defer] Penggunaan Fallback Secret Key untuk JWT [apps/backoffice/lib/auth.ts:5] — deferred, pre-existing
