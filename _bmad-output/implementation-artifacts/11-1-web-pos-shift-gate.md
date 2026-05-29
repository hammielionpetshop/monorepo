# Story 11.1: Buka / Gabung Shift (Shift Gate Screen)

Status: done

## Story

**As a** Kasir,
**I want** melihat layar gate saat tidak ada shift aktif atau belum bergabung ke shift, dan bisa membuka shift baru atau bergabung ke shift yang sudah ada,
**So that** saya dapat mulai beroperasi dari Web POS tanpa harus pergi ke Backoffice atau Electron POS.

## Acceptance Criteria

**AC-1: Kasir tanpa shift aktif (Kasir role)**
**Given** Kasir mengakses `/pos` dan tidak ada shift aktif di cabang
**When** halaman dimuat
**Then** sistem menampilkan Shift Gate Screen dengan pesan "Belum Ada Shift Aktif" dan informasi agar menghubungi Manager

**AC-2: Kasir dengan role MANAGER/OWNER — tidak ada shift aktif**
**Given** User dengan role MANAGER, OWNER, atau GM mengakses `/pos` dan tidak ada shift
**When** halaman dimuat
**Then** sistem menampilkan tombol "Buka Shift Baru" yang bisa diklik untuk membuka form buka shift

**AC-3: Form buka shift**
**Given** User menekan "Buka Shift Baru"
**When** form terbuka
**Then** form menampilkan: field Modal Awal (Rupiah, integer), daftar kasir yang bisa dipilih (dari `/api/pos/users?branchId={n}`), target selesai opsional

**AC-4: Submit buka shift berhasil**
**Given** User mengisi form buka shift dengan modal awal > 0 dan minimal 1 kasir dipilih
**When** User menekan "Konfirmasi Buka Shift"
**Then** sistem memanggil `POST /api/pos/shifts` dengan payload `{ branchId, openingCash, assignedCashiers, openedById, targetEndTime? }`
**And** shift baru terbuka; halaman di-refresh (`router.refresh()`) sehingga Server Component reload; jika userId ada di `assignedCashiers` sistem otomatis join dan masuk ke halaman POS

**AC-5: Shift aktif — kasir ditugaskan tapi belum join**
**Given** Shift aktif ada, user ada di `assignedCashiers` shift tersebut, tapi belum ada di `joinedCashierIds`
**When** User mengakses `/pos`
**Then** Shift Gate Screen menampilkan info shift (nomor shift, jam buka, modal awal) dan tombol "Mulai Kerja / Gabung Shift"

**AC-6: Join shift berhasil**
**Given** User menekan "Mulai Kerja"
**When** request berhasil
**Then** sistem memanggil `POST /api/pos/shifts/{id}/join` dengan `{ cashierId: userId }`
**And** halaman di-refresh; POS normal terbuka karena `isCashierInShift` sekarang `true`

**AC-7: Shift aktif — kasir TIDAK ditugaskan**
**Given** Shift aktif ada tapi user tidak ada di `assignedCashiers`
**When** User mengakses `/pos`
**Then** Shift Gate Screen menampilkan pesan "Akses Dibatasi — Anda tidak ditugaskan di shift ini" tanpa tombol aksi transaksi

**AC-8: Shift aktif — kasir sudah join**
**Given** User sudah ada di `joinedCashierIds` (isCashierInShift = true)
**When** User mengakses `/pos`
**Then** Shift Gate Screen TIDAK muncul; POS normal langsung ditampilkan (behavior sudah ada, jangan rusak)

---

## Dev Notes

### Konteks Arsitektur

**Stack Web POS:**
- Next.js 15 App Router, route group `(pos)` di `apps/backoffice`
- Server Components untuk data fetching + auth, Client Components untuk interaksi
- Tailwind CSS dengan design token (`bg-background`, `text-foreground`, `border-border`, `bg-primary`, dll)
- Mobile-first, touch target ≥ 44px di semua interactive element
- `router.refresh()` untuk reload Server Component setelah mutasi (pola dari Story 10.3)

**Shift model (`shifts` table):**
- `id`, `branchId`, `openedById`, `shiftNumber`, `assignedCashiers` (array of userId integer), `openingCash` (integer, disimpan sebagai string di DB lama — tapi sekarang bisa integer), `targetEndTime` (nullable), `status` ('OPEN' | 'SETTLED'), `openedAt`
- `shiftCashierSessions` table: `shiftId`, `cashierId`, `status` ('ACTIVE')

**JWT Payload** (tersedia via `verifyAccessTokenCached(token)` di Server Component):
```typescript
interface JWTPayload {
  userId: number
  userName: string
  staffNumber: string | null
  branchId: number
  branchName: string
  role: 'OWNER' | 'GM' | 'MANAGER' | 'KASIR' | 'GUDANG' | 'FINANCE'
  permissions: string[]
}
```
`role` sudah tersedia di payload — **TIDAK perlu query DB tambahan**.

**Role yang boleh buka shift:** `OWNER`, `GM`, `MANAGER`
**Role yang hanya boleh join:** `KASIR`, `GUDANG`, `FINANCE`

### State yang Sudah Ada di `page.tsx`

`apps/backoffice/app/pos/(authenticated)/page.tsx` sudah menghitung:
```typescript
const isCashierInShift = joinedCashierIds.includes(payload.userId)
// shiftWithSessions = { ...activeShift, joinedCashierIds } | null
```

Dan sudah pass ke `PosClient`:
```tsx
<PosClient
  shift={shiftWithSessions}   // null jika tidak ada shift aktif
  isCashierInShift={isCashierInShift}
  cashierId={payload.userId}
  branchId={branchId}
  branchName={payload.branchName}
  // ...
/>
```

**Tambahan yang diperlukan:** pass `userRole={payload.role}` ke `PosClient`.

### State yang Harus Ditambahkan di `page.tsx`

Tambahkan satu kondisi lagi: apakah kasir ditugaskan ke shift tapi belum join.

```typescript
// Di dalam if (activeShift) block yang sudah ada:
const assignedCashiers = (activeShift.assignedCashiers as number[]) ?? []
const isCashierAssigned = assignedCashiers.includes(payload.userId)
// isCashierInShift sudah ada (joinedCashierIds.includes(payload.userId))
```

Pass `isCashierAssigned` ke `PosClient` juga, atau cukup pass `shift.assignedCashiers` dan hitung di client.

### File yang Harus Dimodifikasi (UPDATE)

#### 1. `apps/backoffice/app/pos/(authenticated)/page.tsx`

**Perubahan:**
- Tambah `userRole: payload.role` ke props `PosClient`
- `PosClientProps` interface di `pos-client.tsx` perlu menerima `userRole`

**Bagian yang tidak boleh diubah:**
- Semua query produk, konversi, harga, UOM, payment methods
- Logic `shiftWithSessions` dan `isCashierInShift`
- Semua props lain yang sudah ada

#### 2. `apps/backoffice/components/pos/pos-client.tsx`

**Perubahan minimal:**
- Tambah `userRole: string` ke `PosClientProps` interface
- Ganti blok `if (!shift)` dan `if (!isCashierInShift)` yang mengembalikan static message dengan `<ShiftGateClient>` yang interaktif

**Current code (yang akan diganti):**
```typescript
if (!shift) {
  return (
    <div className="flex flex-col items-center justify-center ...">
      <div className="text-5xl mb-4">⚠️</div>
      <h2>Tidak Ada Shift Aktif</h2>
      <p>Tidak ada shift aktif untuk cabang ini. Hubungi manager...</p>
    </div>
  )
}

if (!isCashierInShift) {
  return (
    <div className="flex flex-col items-center justify-center ...">
      <div className="text-5xl mb-4">🚫</div>
      <h2>Akses POS Dibatasi</h2>
      <p>Anda tidak terdaftar...</p>
    </div>
  )
}
```

**Diganti dengan:**
```typescript
// Jika tidak ada shift ATAU cashier belum join → render ShiftGateClient
if (!shift || !isCashierInShift) {
  // Tentukan state untuk ShiftGateClient
  const isAssigned = shift
    ? (shift.assignedCashiers as number[] ?? []).includes(cashierId)
    : false
  return (
    <ShiftGateClient
      shift={shift}
      isAssigned={isAssigned}
      isCashierInShift={isCashierInShift}
      cashierId={cashierId}
      branchId={branchId}
      userRole={userRole}
    />
  )
}
```

**Yang TIDAK boleh diubah:** seluruh render POS normal (return utama), `CheckoutModal`, imports produk, dll.

### File Baru (CREATE)

#### 3. `apps/backoffice/components/pos/shift-gate-client.tsx` — NEW

**Props:**
```typescript
interface ShiftGateClientProps {
  shift: ActiveShift | null   // null = tidak ada shift aktif
  isAssigned: boolean         // apakah user ada di assignedCashiers
  isCashierInShift: boolean   // apakah user sudah join (harusnya false kalau sampai sini)
  cashierId: number
  branchId: number
  userRole: string
}
```

**State cases yang harus dirender:**

**Case A — Tidak ada shift aktif:**
- Jika `!shift`:
  - Jika `canOpenShift` (OWNER/GM/MANAGER): tampilkan tombol "Buka Shift Baru" → buka `OpenShiftDialog`
  - Jika tidak: tampilkan pesan "Belum ada shift aktif. Hubungi Manager."

**Case B — Shift ada, kasir ditugaskan, belum join:**
- Jika `shift && isAssigned && !isCashierInShift`:
  - Tampilkan info shift (nomor shift, jam buka, modal awal)
  - Tombol "Mulai Kerja" → POST `/api/pos/shifts/{shift.id}/join`
  - Setelah berhasil: `router.refresh()`

**Case C — Shift ada, kasir tidak ditugaskan:**
- Jika `shift && !isAssigned`:
  - Tampilkan pesan "Akses Dibatasi — Anda tidak ditugaskan di shift ini. Hubungi Manager."

**Helper:**
```typescript
const canOpenShift = ['OWNER', 'GM', 'MANAGER'].includes(userRole)
```

**Join handler:**
```typescript
const handleJoin = async () => {
  setIsLoading(true)
  try {
    const res = await fetch(`/api/pos/shifts/${shift!.id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cashierId }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Gagal bergabung ke shift')
      return
    }
    router.refresh()
  } catch {
    setError('Terjadi kesalahan jaringan. Coba lagi.')
  } finally {
    setIsLoading(false)
  }
}
```

#### 4. `apps/backoffice/components/pos/open-shift-dialog.tsx` — NEW

**Props:**
```typescript
interface OpenShiftDialogProps {
  isOpen: boolean
  branchId: number
  cashierId: number   // untuk auto-select dan sebagai openedById
  onClose: () => void
  onSuccess: () => void  // panggil router.refresh() di parent
}
```

**State:**
- `openingCash: string` — input integer Rupiah (display, simpan sebagai integer)
- `users: { id: number, name: string, role: string }[]` — dari `/api/pos/users?branchId={n}`
- `selectedCashiers: number[]` — default: [cashierId] jika cashierId ada di users list
- `isSubmitting: boolean`
- `error: string`

**User list fetch:** `GET /api/pos/users?branchId={branchId}` — fetch saat dialog terbuka (`useEffect` on `isOpen`)

**Submit handler:**
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  const openingCashInt = parseInt(openingCash.replace(/\D/g, ''), 10)
  if (isNaN(openingCashInt) || openingCashInt <= 0) {
    setError('Modal awal harus lebih dari 0')
    return
  }
  if (selectedCashiers.length === 0) {
    setError('Pilih minimal satu kasir')
    return
  }
  setIsSubmitting(true)
  try {
    const res = await fetch('/api/pos/shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branchId,
        openingCash: openingCashInt,
        assignedCashiers: selectedCashiers,
        openedById: cashierId,
      }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Gagal membuka shift')
      return
    }
    onSuccess()
    onClose()
  } catch {
    setError('Terjadi kesalahan jaringan. Coba lagi.')
  } finally {
    setIsSubmitting(false)
  }
}
```

**Perhatian khusus untuk `POST /api/pos/shifts`:**

API route ini (`apps/backoffice/app/api/pos/shifts/route.ts`) **tidak melakukan auth via cookie** — menggunakan `branchId` dan `openedById` dari body. Ini adalah desain lama yang kompatibel. Pastikan:
- `openingCash` dikirim sebagai integer (bukan string)
- `openedById` = `cashierId` dari JWT (user yang sedang login)
- `assignedCashiers` adalah array of integer userId

**Format input Modal Awal:** gunakan input numerik biasa `type="number"` atau text dengan filter `\D`. Tampilkan sebagai Rupiah untuk clarity tapi parse integer sebelum submit.

### API Response Shape

**GET `/api/pos/shifts?branchId={n}`** → `ActiveShift | null`:
```typescript
{
  id: number,
  branchId: number,
  shiftNumber: number,
  status: 'OPEN',
  openedAt: Date | string,
  openingCash: string,  // disimpan sebagai string di DB
  assignedCashiers: number[],
  joinedCashierIds: number[],
}
```

**POST `/api/pos/shifts/{id}/join`** → `{ success: true, shift, alreadyJoined: boolean }` (status 200)
- Error 403 jika cashierId tidak ada di assignedCashiers
- Error 400 jika shift tidak OPEN

### Format Rupiah

Gunakan `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })` untuk display. Jangan gunakan library eksternal baru.

### UX Patterns (dari Electron POS referensi)

- **Shift Gate Screen** minimal dan terfokus: centered card/container, tidak pakai sidebar
- Tampilkan info shift di "Case B": nomor shift + jam buka + modal awal
- Loading state pada tombol saat request berlangsung (disabled + spinner text)
- Error message inline (bukan toast) untuk konsistensi dengan pola Web POS
- ESC key tidak perlu di-handle di Shift Gate (ini bukan modal)

### Pola dari Story Sebelumnya (yang HARUS diikuti)

Dari Story 10.3 (`void-pin-dialog.tsx`, `transaction-detail-modal.tsx`):
1. `router.refresh()` setelah mutasi berhasil — BUKAN `router.push()`; ini reload Server Component dengan data baru
2. Error state: `setError(data.error ?? 'Pesan default')` — tampilkan di bawah form
3. `finally { setIsLoading(false) }` — selalu reset loading state
4. `disabled={isLoading}` pada tombol submit
5. Touch target minimum `min-h-[44px]` pada semua button
6. `'use client'` directive di baris pertama Client Component

Dari Story 9.1 (auth login):
- Tidak ada form-level validation library — gunakan HTML5 validation + manual JS check

### Penanganan `openingCash` di DB

API lama `POST /api/pos/shifts` memiliki: `openingCash: openingCash.toString()` saat insert (line 108 di route.ts). Ini menyimpan sebagai string di DB. **Tidak perlu diubah** — ini bagian dari existing API yang tidak boleh dimodifikasi di story ini.

### Test Plan (Manual)

1. **Happy path — Kasir MANAGER, tidak ada shift:** Buka `/pos` → gate screen muncul → klik "Buka Shift Baru" → isi modal awal → pilih kasir (termasuk diri sendiri) → submit → POS terbuka normal
2. **Happy path — Kasir role biasa, shift ada, belum join:** Buka `/pos` → gate screen "Gabung Shift" → klik "Mulai Kerja" → POS terbuka normal
3. **Happy path — Kasir sudah join:** Buka `/pos` → langsung ke POS, tidak ada gate screen
4. **Edge case — Kasir tidak ditugaskan:** Buka `/pos` → gate screen "Akses Dibatasi" tanpa tombol
5. **Edge case — Kasir role biasa, tidak ada shift:** Buka `/pos` → gate screen "Hubungi Manager" tanpa tombol buka shift
6. **Error case — submit buka shift dengan modal 0:** Error message muncul, form tidak tersubmit
7. **Error case — jaringan gagal saat join:** Error message inline muncul

---

## Tasks / Subtasks

- [x] Task 1: Update `PosClientProps` dan `page.tsx` untuk pass `userRole`
  - [x] 1.1 Tambah `userRole: string` ke `PosClientProps` interface di `pos-client.tsx`
  - [x] 1.2 Tambah `userRole={payload.role}` ke props `PosClient` di `page.tsx`
  - [x] 1.3 Verifikasi TypeScript tidak error

- [x] Task 2: Buat `ShiftGateClient` component
  - [x] 2.1 Buat file `apps/backoffice/components/pos/shift-gate-client.tsx` dengan `'use client'`
  - [x] 2.2 Implementasi Case A (tidak ada shift): role check untuk show/hide tombol "Buka Shift Baru"
  - [x] 2.3 Implementasi Case B (shift ada, assigned, belum join): info shift + tombol "Mulai Kerja" dengan join handler
  - [x] 2.4 Implementasi Case C (shift ada, tidak assigned): pesan akses dibatasi
  - [x] 2.5 Loading state, error state, touch targets ≥44px

- [x] Task 3: Buat `OpenShiftDialog` component
  - [x] 3.1 Buat file `apps/backoffice/components/pos/open-shift-dialog.tsx` dengan `'use client'`
  - [x] 3.2 Fetch users dari `/api/pos/users?branchId=` saat dialog buka
  - [x] 3.3 Form: input modal awal (integer Rupiah), checkboxes/buttons pilih kasir
  - [x] 3.4 Auto-select current cashier di daftar assignedCashiers
  - [x] 3.5 Submit handler: validasi → POST `/api/pos/shifts` → call `onSuccess()` → `onClose()`
  - [x] 3.6 Error handling inline, loading state pada tombol submit

- [x] Task 4: Integrasikan `ShiftGateClient` ke `PosClient`
  - [x] 4.1 Import `ShiftGateClient` di `pos-client.tsx`
  - [x] 4.2 Ganti dua blok static error (`if (!shift)` dan `if (!isCashierInShift)`) dengan single `if (!shift || !isCashierInShift)` yang render `ShiftGateClient`
  - [x] 4.3 Kalkulasi `isAssigned` dari `shift?.assignedCashiers` dan `cashierId`
  - [x] 4.4 Pastikan POS normal flow (return utama) tidak berubah

- [x] Task 5: Integrasikan `OpenShiftDialog` ke `ShiftGateClient`
  - [x] 5.1 Import dan render `OpenShiftDialog` di `ShiftGateClient`
  - [x] 5.2 `onSuccess` callback memanggil `router.refresh()`

- [x] Task 6: Validasi end-to-end
  - [x] 6.1 Jalankan `tsc --noEmit` di workspace `apps/backoffice` — zero error
  - [ ] 6.2 Test manual: semua 7 skenario di Test Plan
  - [x] 6.3 Verifikasi tidak ada regresi di POS normal flow (transaksi masih bisa dilakukan setelah join shift)

---

## Dev Agent Record

### Completion Notes

Implementasi Story 11.1 selesai. Perubahan utama:

1. **`pos-client.tsx`**: Extended `ActiveShift` interface dengan field `openingCash: number` dan `assignedCashiers: number[]`. Tambah `userRole: string` ke `PosClientProps`. Ganti dua blok static error dengan satu kondisi `if (!shift || !isCashierInShift)` yang merender `ShiftGateClient`.

2. **`page.tsx`**: Pass `userRole={payload.role}` ke `PosClient`. Cast `assignedCashiers` dari `unknown` ke `number[]` saat membangun `shiftWithSessions`.

3. **`shift-gate-client.tsx`** (NEW): Client Component yang menangani 3 case:
   - Case A: Tidak ada shift aktif — OWNER/GM/MANAGER melihat tombol "Buka Shift Baru", KASIR melihat pesan hubungi manager
   - Case B: Shift ada, kasir assigned tapi belum join — info shift + tombol "Mulai Kerja"
   - Case C: Shift ada, kasir tidak assigned — pesan "Akses Dibatasi"

4. **`open-shift-dialog.tsx`** (NEW): Dialog buka shift baru dengan fetch user list, checkbox selection, auto-select current user, submit POST `/api/pos/shifts`.

**Fix TypeScript**: `assignedCashiers` di Drizzle schema adalah `jsonb` tanpa type annotation (inferred `unknown`) — di-cast ke `number[]` di `page.tsx`.

### Debug Log

- `openingCash` di DB schema adalah `number` (integer migration done), bukan `string` seperti yang tertulis di Dev Notes lama → update interface ke `number`.
- `assignedCashiers` di Drizzle schema adalah `jsonb` tanpa type annotation → inferred sebagai `unknown` → perlu explicit cast di `page.tsx`.

---

## File List

- apps/backoffice/app/pos/(authenticated)/page.tsx (UPDATE)
- apps/backoffice/components/pos/pos-client.tsx (UPDATE)
- apps/backoffice/components/pos/shift-gate-client.tsx (CREATE)
- apps/backoffice/components/pos/open-shift-dialog.tsx (CREATE)

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-05-22 | Story created | bmad-create-story |
| 2026-05-22 | Story implemented — ShiftGateClient + OpenShiftDialog, update PosClient + page.tsx | dev-agent |
