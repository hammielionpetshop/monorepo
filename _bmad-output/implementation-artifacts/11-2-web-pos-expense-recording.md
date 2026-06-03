# Story 11.2: Pencatatan Expense Selama Shift

Status: done

## Story

**As a** Kasir,
**I want** mencatat pengeluaran kas (expense) selama shift berlangsung langsung dari Web POS,
**So that** catatan kas shift akurat tanpa perlu menulis manual atau akses ke Backoffice.

## Acceptance Criteria

**AC-1: Tombol Expense tersedia saat shift aktif**
**Given** Kasir berada di halaman POS utama (`/pos`) dengan shift aktif dan sudah join
**When** halaman dimuat
**Then** tombol "Expense" (dengan ikon kas keluar) terlihat di UI — tidak tersembunyi, mudah dijangkau dengan jari

**AC-2: Dialog expense terbuka**
**Given** Kasir menekan tombol "Expense"
**When** tombol diklik
**Then** sistem menampilkan dialog/modal dengan dua field: "Keterangan" (text, required) dan "Jumlah" (integer Rupiah, required)

**AC-3: Submit expense berhasil**
**Given** Kasir mengisi keterangan dan jumlah yang valid (jumlah > 0)
**When** mereka menekan "Simpan Pengeluaran"
**Then** sistem memanggil `POST /api/pos/shifts/{shiftId}/expenses` dengan payload yang valid
**And** dialog tertutup
**And** total expense yang ditampilkan di UI diperbarui (via `router.refresh()`)

**AC-4: Validasi jumlah nol atau negatif**
**Given** Kasir memasukkan jumlah expense = 0 atau nilai negatif
**When** mereka mencoba mengkonfirmasi
**Then** sistem menampilkan error validasi "Jumlah harus lebih dari 0" secara inline
**And** request ke server TIDAK dikirim

**AC-5: Validasi keterangan kosong**
**Given** Kasir mengosongkan field "Keterangan"
**When** mereka mencoba mengkonfirmasi
**Then** sistem menampilkan error validasi "Keterangan wajib diisi"
**And** request ke server TIDAK dikirim

**AC-6: Error dari server ditampilkan**
**Given** Kasir mengisi form dengan data valid
**When** request ke server gagal (network error atau error 4xx/5xx)
**Then** dialog tetap terbuka dan pesan error ditampilkan secara inline
**And** Kasir dapat mencoba ulang

**AC-7: Total expense terbarui setelah submit**
**Given** Expense berhasil dicatat
**When** dialog tertutup
**Then** total expense shift yang ditampilkan di POS UI (header/info bar) diperbarui dengan nilai baru

---

## Dev Notes

### Konteks Arsitektur Web POS

**Stack (identik dengan Story 11.1, 10.3):**
- Next.js 15 App Router, route group `(pos)` di `apps/backoffice`
- Server Components (`page.tsx`) untuk data fetching, Client Components untuk interaksi
- Tailwind CSS dengan design token: `bg-background`, `text-foreground`, `border-border`, `bg-primary`, `bg-card`, `text-muted-foreground`
- Mobile-first, touch target **≥ 44px** di semua elemen interaktif
- `router.refresh()` setelah mutasi berhasil (BUKAN `router.push()`) — reload Server Component dengan data baru
- `'use client'` directive wajib di baris pertama Client Component

### API yang Digunakan

**POST `/api/pos/shifts/{id}/expenses`** — route ada di `apps/backoffice/app/api/pos/shifts/[id]/expenses/route.ts`

```typescript
// Payload yang dikirim ke API:
{
  cashierId: number,       // WAJIB — dari session Kasir (prop pos-client)
  categoryCustom: string,  // WAJIB jika tidak ada categoryId — gunakan nilai dari field "Keterangan"
  amount: number,          // WAJIB — integer Rupiah (> 0)
  note: string,            // WAJIB — gunakan nilai yang sama dari field "Keterangan"
  categoryId: null,        // null (Web POS tidak pakai kategori terdaftar)
  proofImage: null,        // null (Web POS tidak support upload foto)
}
```

⚠️ **Perhatian penting**: API memvalidasi bahwa `cashierId`, (`categoryId` ATAU `categoryCustom`), `amount`, dan `note` semuanya ada (tidak null/undefined/falsy). Jika salah satu kurang → HTTP 400. Gunakan satu field "Keterangan" dari UI untuk mengisi SEKALIGUS `categoryCustom` dan `note`.

**Response berhasil:** HTTP 200 dengan objek expense baru.
**Response gagal:** HTTP 400 `{ error: 'Missing required fields' }` atau HTTP 500.

### Amount: Integer Rupiah

- Gunakan `parseInt(rawInput.replace(/\D/g, ''), 10)` untuk parse integer dari input user
- Validasi: `isNaN(amount) || amount <= 0` → tampilkan error
- **Jangan gunakan desimal** — semua nilai Rupiah di Web POS adalah integer
- DB menyimpan sebagai string (`amount.toString()` di API route sudah di-handle oleh server, tidak perlu dikonversi di client)

### Total Expense di UI (AC-7)

Untuk menampilkan total expense shift yang terupdate:

1. **Di `page.tsx`**: Tambahkan query untuk sum total expenses dari tabel `shiftExpenses` jika ada shift aktif
2. **Pass ke PosClient**: Tambah prop `totalExpenses: number` ke `PosClientProps`
3. **Tampilkan di `pos-client.tsx`**: Tunjukkan total expense di area info POS (di atas product panel atau di header cart)
4. **Update trigger**: Setelah expense sukses, `router.refresh()` → page.tsx re-fetch → total ter-update otomatis

**Query di `page.tsx`** (tambahkan ke `Promise.all` yang sudah ada):
```typescript
import { shiftExpenses, sum } from '@/lib/db'
// Di dalam Promise.all, jika activeShift exists — query setelah shift query:
const expenseTotal = activeShift
  ? await db
      .select({ total: sql<number>`COALESCE(SUM(${shiftExpenses.amount}), 0)` })
      .from(shiftExpenses)
      .where(eq(shiftExpenses.shiftId, activeShift.id))
      .then((r) => Number(r[0]?.total ?? 0))
  : 0
```

> Catatan: `shiftExpenses.amount` di DB adalah `numeric/decimal` — Drizzle kembalikan sebagai string atau number tergantung migration. Gunakan `Number()` untuk konversi aman.

### Penempatan Tombol "Expense" di UI

Letakkan tombol "Expense" di `pos-client.tsx` dalam blok render POS normal (setelah guard `!shift || !isCashierInShift`). Opsi terbaik: tambahkan **info bar** di atas layout utama yang menampilkan info shift dan tombol Expense.

**Layout baru di `pos-client.tsx` (tambahkan sebelum flex row utama):**
```tsx
{/* Shift info bar — tampil di atas area produk & keranjang */}
<div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border text-sm flex-shrink-0 print:hidden">
  <span className="text-muted-foreground">
    Shift #{shift.shiftNumber} · Total Expense:{' '}
    <span className="text-foreground font-medium">{formatRupiah(totalExpenses)}</span>
  </span>
  <button
    type="button"
    onClick={() => setExpenseOpen(true)}
    className="min-h-[44px] px-4 py-2 rounded-lg border border-border bg-background hover:bg-muted text-sm font-medium text-foreground transition-colors"
    aria-label="Catat pengeluaran"
  >
    + Expense
  </button>
</div>
```

`formatRupiah` sudah ada di `./cart-store` — import dari sana.

### File yang Harus Dimodifikasi (UPDATE)

#### 1. `apps/backoffice/app/pos/(authenticated)/page.tsx`

**Perubahan:**
- Import `shiftExpenses` dan `sql` dari `@/lib/db` (sql sudah ada di imports)
- Tambah query total expenses untuk shift aktif (jalankan SETELAH `activeShift` di-resolve, bukan paralel karena butuh `activeShift.id`)
- Tambah prop `totalExpenses={expenseTotal}` ke `<PosClient>`

**Pattern fetch (SETELAH blok `Promise.all` yang sudah ada):**
```typescript
let expenseTotal = 0
if (activeShift) {
  const expResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${shiftExpenses.amount}), '0')` })
    .from(shiftExpenses)
    .where(eq(shiftExpenses.shiftId, activeShift.id))
  expenseTotal = Number(expResult[0]?.total ?? 0)
}
```

**Yang TIDAK boleh diubah:**
- Semua query di `Promise.all` (`products`, `conversions`, `prices`, `uoms`, `payments`, `activeShift`)
- Logic `shiftWithSessions` dan `isCashierInShift`
- Semua props lain yang sudah ada di `<PosClient>`

#### 2. `apps/backoffice/components/pos/pos-client.tsx`

**Perubahan minimal:**
- Tambah `totalExpenses: number` ke `PosClientProps` interface
- Tambah `totalExpenses` ke destructured props
- Tambah `const [expenseOpen, setExpenseOpen] = useState(false)` di atas state lain
- Import `ExpenseDialog` (file baru)
- Tambah shift info bar dengan tombol "Expense" dan display total expense (lihat contoh di atas)
- Render `<ExpenseDialog>` dengan kondisi `expenseOpen`

**Contoh props ke ExpenseDialog:**
```tsx
{expenseOpen && (
  <ExpenseDialog
    shiftId={shift.id}
    cashierId={cashierId}
    onClose={() => setExpenseOpen(false)}
    onSuccess={() => {
      setExpenseOpen(false)
      router.refresh()
    }}
  />
)}
```

> Tambahkan `import { useRouter } from 'next/navigation'` dan `const router = useRouter()` ke pos-client.tsx jika belum ada.

**Yang TIDAK boleh diubah:**
- Guard `if (!shift || !isCashierInShift)` dan render `ShiftGateClient`
- Semua ProductSearchPanel, CartPanel, MobileCartBar, CheckoutModal
- Semua cart-related state dan logic

### File Baru (CREATE)

#### 3. `apps/backoffice/components/pos/expense-dialog.tsx`

**Interface:**
```typescript
interface ExpenseDialogProps {
  shiftId: number
  cashierId: number
  onClose: () => void
  onSuccess: () => void
}
```

**State internal:**
```typescript
const [keterangan, setKeterangan] = useState('')
const [amount, setAmount] = useState('')
const [isSubmitting, setIsSubmitting] = useState(false)
const [error, setError] = useState('')
```

**Validasi sebelum submit:**
```typescript
const amountInt = parseInt(amount.replace(/\D/g, ''), 10)
if (!keterangan.trim()) {
  setError('Keterangan wajib diisi')
  return
}
if (isNaN(amountInt) || amountInt <= 0) {
  setError('Jumlah harus lebih dari 0')
  return
}
```

**Submit handler:**
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setError('')
  const amountInt = parseInt(amount.replace(/\D/g, ''), 10)
  if (!keterangan.trim()) {
    setError('Keterangan wajib diisi')
    return
  }
  if (isNaN(amountInt) || amountInt <= 0) {
    setError('Jumlah harus lebih dari 0')
    return
  }
  setIsSubmitting(true)
  try {
    const res = await fetch(`/api/pos/shifts/${shiftId}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cashierId,
        categoryId: null,
        categoryCustom: keterangan.trim(),
        note: keterangan.trim(),
        amount: amountInt,
        proofImage: null,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Gagal mencatat pengeluaran')
      return
    }
    onSuccess()
  } catch {
    setError('Terjadi kesalahan jaringan. Coba lagi.')
  } finally {
    setIsSubmitting(false)
  }
}
```

**UI Pattern (ikuti pola dari `void-pin-dialog.tsx` dan `open-shift-dialog.tsx`):**
- Modal overlay: `fixed inset-0 z-50 flex items-end md:items-center justify-center`
- Backdrop: `bg-black/50` dengan `onClick={onClose}`
- Dialog container: `relative w-full max-w-md bg-card rounded-t-2xl md:rounded-2xl border border-border p-6`
- Judul: "Catat Pengeluaran" dengan sub "Shift Expense"
- Field "Keterangan": `<input type="text" required placeholder="Contoh: Beli air galon 2 buah">` — tidak perlu textarea besar
- Field "Jumlah (Rp)": `<input type="number" min="1" step="1" placeholder="0">`
- Error: `<p className="text-sm text-destructive mt-1">{error}</p>`
- Tombol: "Batal" (sekunder) + "Simpan" (primary, `disabled={isSubmitting}`)
- Touch target minimum: `min-h-[44px]` pada semua button

**Reset state saat dialog ditutup:** Gunakan `onClose` untuk menutup dari luar; state di-reset karena komponen di-unmount.

### Pola Penting dari Story Sebelumnya (WAJIB diikuti)

Dari Story 11.1 (`shift-gate-client.tsx`, `open-shift-dialog.tsx`) dan Story 10.3 (`void-pin-dialog.tsx`):

1. **`router.refresh()`** setelah mutasi berhasil — bukan `router.push()` atau state manual
2. **Error inline**: `setError(data.error ?? 'Pesan default')` — di bawah form, bukan toast
3. **`finally { setIsSubmitting(false) }`** — selalu reset loading
4. **`disabled={isSubmitting}`** pada tombol submit saat request berlangsung
5. **`'use client'`** di baris pertama Client Component
6. **Touch target `min-h-[44px]`** wajib pada semua button
7. **Jangan gunakan library baru** — tidak ada `sonner`, tidak ada `react-hook-form`, tidak ada upload image

### Format Rupiah Display

```typescript
// Sudah ada di cart-store.ts — import dari sana:
import { formatRupiah } from './cart-store'
// Contoh: formatRupiah(50000) → "Rp 50.000"
```

### Referensi Electron POS (Pattern UX, BUKAN code)

`apps/pos-desktop/src/components/shift/ExpenseDialog.tsx` — punya: kategori dropdown, upload foto, note. Web POS **sengaja disederhanakan**: cukup keterangan + jumlah. Jangan copy-paste logika Electron karena menggunakan store (Zustand), apiClient, dan toast yang berbeda.

### TypeScript Strict Mode

- Tidak ada `any` — gunakan tipe eksplisit
- `parseInt()` bisa return `NaN` — selalu guard dengan `isNaN()`
- Props interface harus lengkap dan diekspor jika diperlukan cross-file

### Test Plan (Manual)

1. **Happy path**: Shift aktif → klik "+ Expense" → isi keterangan + jumlah valid → submit → dialog tutup → total expense di info bar bertambah
2. **Validasi jumlah 0**: Isi jumlah = 0 → error "Jumlah harus lebih dari 0" muncul, tidak submit
3. **Validasi keterangan kosong**: Kosongkan keterangan → error "Keterangan wajib diisi" muncul
4. **Validasi negatif**: Isi jumlah negatif (misal -100) → error muncul
5. **Error server**: Simulasi network error → error inline muncul, dialog tetap terbuka
6. **Tutup dialog**: Klik backdrop atau tombol "Batal" → dialog tutup, form kosong jika dibuka ulang (karena di-unmount)
7. **Regresi**: Pastikan tombol Checkout masih berfungsi, cart tidak terganggu, ShiftGate tidak muncul jika shift sudah aktif

---

## Tasks / Subtasks

- [x] Task 1: Update `page.tsx` — tambah query total expenses dan prop ke PosClient (AC: 7)
  - [x] 1.1 Import `shiftExpenses` ke `apps/backoffice/app/pos/(authenticated)/page.tsx`
  - [x] 1.2 Tambah query `expenseTotal` setelah blok `Promise.all` (hanya jika `activeShift` tidak null)
  - [x] 1.3 Tambah prop `totalExpenses={expenseTotal}` ke `<PosClient>` di return JSX
  - [x] 1.4 Jalankan `tsc --noEmit` — zero error

- [x] Task 2: Update `PosClientProps` dan render di `pos-client.tsx` (AC: 1, 7)
  - [x] 2.1 Tambah `totalExpenses: number` ke `PosClientProps` interface
  - [x] 2.2 Tambah `totalExpenses` ke destructured props
  - [x] 2.3 Import `useRouter` dari `next/navigation` dan init `const router = useRouter()`
  - [x] 2.4 Tambah `const [expenseOpen, setExpenseOpen] = useState(false)`
  - [x] 2.5 Tambah shift info bar (shift number + total expense + tombol "+ Expense") di atas flex row utama (dalam blok render normal, setelah guard shift check)
  - [x] 2.6 Import dan render `<ExpenseDialog>` dengan props yang benar dan `onSuccess` yang call `router.refresh()`
  - [x] 2.7 Verifikasi POS normal flow tidak terpengaruh (checkout, cart masih berfungsi)

- [x] Task 3: Buat `expense-dialog.tsx` (AC: 2, 3, 4, 5, 6)
  - [x] 3.1 Buat file `apps/backoffice/components/pos/expense-dialog.tsx` dengan `'use client'`
  - [x] 3.2 Definisikan `ExpenseDialogProps` interface (shiftId, cashierId, onClose, onSuccess)
  - [x] 3.3 Implementasi form dengan field "Keterangan" (text) dan "Jumlah" (number)
  - [x] 3.4 Implementasi validasi inline (keterangan kosong, jumlah ≤ 0)
  - [x] 3.5 Implementasi submit handler: validasi → fetch POST → error handling → onSuccess()
  - [x] 3.6 UI: modal overlay, backdrop click menutup, touch target ≥ 44px, error display inline
  - [x] 3.7 Loading state pada tombol "Simpan" saat isSubmitting

- [x] Task 4: Validasi TypeScript dan regresi
  - [x] 4.1 Jalankan `tsc --noEmit` di workspace `apps/backoffice` — zero TypeScript error
  - [x] 4.2 Test manual: 7 skenario di Test Plan di atas
  - [x] 4.3 Verifikasi tidak ada regresi: ShiftGate masih muncul jika shift null, checkout masih bekerja

### Review Findings

- [x] [Review][Patch] Bug Validasi Angka Negatif dan Desimal pada Input amount [apps/backoffice/components/pos/expense-dialog.tsx:32]
- [x] [Review][Patch] Tombol Expense Belum Memiliki Ikon Kas Keluar [apps/backoffice/components/pos/pos-client.tsx:125]
- [x] [Review][Patch] Eliminasi Waterfall Latency Query Database [apps/backoffice/app/pos/(authenticated)/page.tsx:75]
- [x] [Review][Patch] Validasi Batas Maksimum Nilai Amount [apps/backoffice/components/pos/expense-dialog.tsx:32]
- [x] [Review][Patch] Validasi Batas Panjang Teks Keterangan [apps/backoffice/components/pos/expense-dialog.tsx:25]
- [x] [Review][Patch] Peningkatan Aksesibilitas (A11y) dan Dukungan Keyboard Dialog Expense [apps/backoffice/components/pos/expense-dialog.tsx:1]
- [x] [Review][Patch] Perbaikan Layout Tinggi POS yang Fragil (Robust Flexbox) [apps/backoffice/components/pos/pos-client.tsx:120]

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `formatRupiah()` di `cart-store.ts` menerima `string`, bukan `number` — dikonversi dengan `String(totalExpenses)` di pos-client.tsx
- `shiftExpenses` sudah tersedia via re-export `export * from '@petshop/db'` di `apps/backoffice/lib/db.ts`
- API `POST /api/pos/shifts/{id}/expenses` membutuhkan `cashierId`, `categoryCustom` (atau `categoryId`), `amount`, dan `note` semua required — field "Keterangan" dari UI dikirim sebagai keduanya (`categoryCustom` dan `note`)
- Height calc di main area disesuaikan dari `calc(100vh-64px-44px)` → `calc(100vh-64px-44px-41px)` untuk akomodasi info bar 41px

### Completion Notes List

- **`page.tsx`**: Tambah import `shiftExpenses`, query `expenseTotal` via SUM aggregation setelah `activeShift` di-resolve, pass `totalExpenses={expenseTotal}` ke `<PosClient>`
- **`pos-client.tsx`**: Tambah `totalExpenses: number` ke `PosClientProps`, `useRouter`, `expenseOpen` state, shift info bar dengan display total expense dan tombol "+ Expense", render `<ExpenseDialog>` conditional, `onSuccess` memanggil `router.refresh()`
- **`expense-dialog.tsx`** (NEW): Client Component dengan form 2 field (Keterangan + Jumlah), validasi inline, submit handler ke `POST /api/pos/shifts/{id}/expenses`, error handling, loading state, modal overlay dengan backdrop click to close, touch target ≥ 44px
- TypeScript `tsc --noEmit` — zero error

### File List

- apps/backoffice/app/pos/(authenticated)/page.tsx (UPDATE)
- apps/backoffice/components/pos/pos-client.tsx (UPDATE)
- apps/backoffice/components/pos/expense-dialog.tsx (CREATE)

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-05-22 | Story created | bmad-create-story |
| 2026-05-22 | Story implemented — ExpenseDialog, update PosClient + page.tsx | dev-agent |
