# Story 13.1: Link POS di Backoffice Sidebar

Status: done

## Story

**As a** Kasir / Manager,
**I want** melihat link menuju Web POS di sidebar Backoffice,
**So that** saya bisa berpindah ke mode kasir tanpa harus mengetik URL manual.

## Acceptance Criteria

**AC-1: Link "Web POS" muncul di sidebar**
**Given** User sudah login ke Backoffice dan membuka halaman mana saja di dashboard
**When** sidebar ditampilkan (layar ≥ md)
**Then** terdapat link "Web POS" di sidebar yang mengarah ke `/pos`

**AC-2: Navigasi ke POS berhasil — sesi aktif**
**Given** User sudah login Backoffice (punya cookie `accessToken` yang valid)
**When** User mengklik link "Web POS"
**Then** user langsung masuk ke `/pos` tanpa diminta login ulang (cookie `accessToken` digunakan bersama oleh Backoffice dan POS)

**AC-3: Navigasi ke POS — sesi tidak ada / expired**
**Given** Cookie `accessToken` tidak ada atau sudah expired
**When** User mengakses `/pos` via link
**Then** user diarahkan ke `/pos/login` secara otomatis (sudah ditangani oleh `pos/(authenticated)/layout.tsx`, tidak perlu logic tambahan)

**AC-4: Semua role dapat melihat link**
**Given** User login dengan role apapun (OWNER, GM, MANAGER, KASIR, GUDANG, FINANCE)
**When** sidebar ditampilkan
**Then** link "Web POS" terlihat — tidak ada role restriction

---

## Dev Notes

### File yang Dimodifikasi (UPDATE — 1 file saja)

**`apps/backoffice/app/(dashboard)/layout.tsx`**

Ini satu-satunya file yang perlu diubah. Tidak ada file baru.

### Analisis Layout Saat Ini

Sidebar saat ini memiliki struktur:
```
nav.p-3
├── <a href="/dashboard"> Dashboard
├── <a href="/reports/profit-loss"> Laporan Laba Rugi
├── <a href="/reports/stock-valuation"> Laporan Nilai Stok
├── <a href="/inventory/stock-adjustment"> Penyesuaian Stok
├── <Link href="/inventory/stock-opname"> Stock Opname
├── <a href="/purchase-orders"> Purchase Orders
├── <a href="/retur"> Manajemen Retur
├── <a href="/audit-log"> Audit Log
├── div "Master Data" (section header)
│   ├── <Link href="/master-data/products"> Produk
│   ├── <Link href="/master-data/brands"> Brand
│   ├── <Link href="/master-data/categories"> Kategori
│   └── <Link href="/master-data/uom"> Satuan Ukur
└── div "Pengaturan" (section header)
    ├── <Link href="/settings/users"> Pengguna
    └── <Link href="/settings/branches"> Cabang
```

### Posisi Link yang Tepat

Tambahkan **section "Operasional" baru di paling atas nav**, sebelum Dashboard. Ini memberi sinyal visual bahwa POS adalah mode operasional yang berbeda dari manajemen.

```tsx
{/* SECTION BARU — sebelum link Dashboard */}
<div className="pb-1">
  <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
    Operasional
  </p>
</div>
<Link
  href="/pos"
  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-primary transition-colors"
>
  <span>🖥️</span>
  Web POS
</Link>
<div className="pt-3 pb-1">
  <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
    Manajemen
  </p>
</div>
{/* lalu semua link yang sudah ada (Dashboard, Laporan, dll) */}
```

### Pola CSS yang Wajib Diikuti

Class untuk setiap nav link (ambil persis dari link yang sudah ada):
```
flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-primary transition-colors
```

Section header class (ambil persis dari "Master Data" yang sudah ada):
```
px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60
```

### Pakai `<Link>` bukan `<a>`

Beberapa link lama masih pakai `<a>` (Dashboard, Laporan, dll). Untuk link baru `/pos`, pakai **`<Link>` dari `next/link`** — ini Next.js internal navigation dan sudah ada import `Link` di file.

### Kenapa Satu Cookie Bekerja untuk Keduanya

`accessToken` cookie diset di `/api/auth/login` dan dibaca oleh kedua layout:
- `(dashboard)/layout.tsx` → `verifyAccessToken(token)`  
- `pos/(authenticated)/layout.tsx` → `verifyAccessTokenCached(token)`

Kedua fungsi membaca cookie yang sama. Tidak perlu login ulang.

### Yang TIDAK Boleh Diubah

- Class CSS existing nav links — jangan ubah styling yang sudah ada
- Logic auth (`verifyAccessToken`) dan `logoutAction` di layout
- Semua link yang sudah ada (jangan hapus, jangan pindahkan)
- Mobile header (`md:hidden`) — sidebar memang hidden di mobile, ini by design

### Tidak Perlu

- Perubahan API atau DB
- File baru
- State management
- Active state indicator pada link `/pos` (halaman POS punya layout sendiri, tidak pakai dashboard layout ini)

---

## Tasks / Subtasks

- [x] Task 1: Update `apps/backoffice/app/(dashboard)/layout.tsx`
  - [x] 1.1 Tambah import `Link` jika belum ada (sudah ada, cek dulu)
  - [x] 1.2 Tambah section header "Operasional" di atas nav, sebelum link Dashboard
  - [x] 1.3 Tambah `<Link href="/pos">` dengan class dan emoji yang sesuai
  - [x] 1.4 Tambah section header "Manajemen" sebelum link Dashboard (untuk grouping yang jelas)
  - [x] 1.5 Verifikasi TypeScript `tsc --noEmit` — zero error

- [ ] Task 2: Validasi manual
  - [ ] 2.1 Buka Backoffice → link "Web POS" muncul di sidebar
  - [ ] 2.2 Klik link → masuk ke `/pos` langsung (jika sudah punya sesi POS aktif)
  - [ ] 2.3 Klik link tanpa sesi POS → redirect ke `/pos/login`
  - [ ] 2.4 Semua link sidebar yang sudah ada masih berfungsi (tidak ada regresi)

---

## Dev Agent Record

### Completion Notes

Implementasi Story 13.1 selesai. Perubahan:
- Tambah section header "Operasional" di atas nav sidebar Backoffice
- Tambah `<Link href="/pos">` Web POS dengan icon 🖥️, class CSS identik dengan link nav lainnya
- Tambah section header "Manajemen" sebelum link Dashboard untuk grouping yang jelas
- `import Link` sudah ada di file, tidak perlu tambah baru
- TypeScript `tsc --noEmit` zero error

Task 2 (validasi manual) perlu diverifikasi oleh user di browser.

## File List

- apps/backoffice/app/(dashboard)/layout.tsx (UPDATE)

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Story created | bmad-create-story |
| 2026-06-03 | Story implemented — tambah link Web POS di sidebar Backoffice | dev-agent |
