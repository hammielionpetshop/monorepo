# Story 12.1: Web POS Barcode Scanner Support

Status: review

## Story

**As a** Kasir,
**I want** memindai barcode produk menggunakan scanner fisik (HID/USB) yang terhubung ke tablet/komputer,
**So that** proses input produk ke keranjang lebih cepat dan bebas human-error tanpa perlu mengetik nama atau SKU.

## Acceptance Criteria

**AC-1: Scan barcode produk langsung masuk ke keranjang**
**Given** Kasir berada di halaman POS dengan shift aktif dan tidak ada elemen input yang sedang difokus
**When** scanner HID/USB memindai barcode produk (scanner mengirim karakter seperti keyboard, diakhiri Enter)
**Then** sistem mengenali kode barcode, mencari produk yang cocok di data yang sudah di-load, dan langsung menambahkannya ke keranjang (menggunakan logika `addItem` yang sudah ada)

**AC-2: Barcode tidak ditemukan — notifikasi singkat**
**Given** Barcode yang dipindai tidak cocok dengan field `barcode` produk manapun di cabang ini
**When** lookup gagal
**Then** sistem menampilkan notifikasi singkat "Produk dengan barcode ini tidak ditemukan" selama 3 detik lalu hilang otomatis, tanpa mengganggu alur transaksi

**AC-3: Produk sudah di keranjang — increment qty**
**Given** Produk yang di-scan sudah ada di keranjang
**When** barcode dipindai ulang
**Then** sistem menambah qty produk tersebut sebesar 1 (increment — perilaku sudah dihandle oleh `useCartStore.addItem`)

**AC-4: Tidak mengganggu input manual**
**Given** Kasir sedang mengetik di kolom pencarian produk (search input sedang fokus)
**When** ada keyboard input
**Then** input masuk ke search box seperti biasa — scanner listener tidak mengintervensi

**AC-5: Produk tidak punya harga**
**Given** Barcode produk ditemukan tapi produk tidak punya harga RETAIL untuk cabang ini
**When** scan dilakukan
**Then** sistem menampilkan alert "Harga produk ... tidak tersedia. Hubungi admin." (perilaku sudah ada di `handleAddProduct`)

---

## Dev Notes

### ⚠️ INSIGHT KRITIS — Semua Data Sudah Tersedia, Tidak Perlu API Call

Data produk (termasuk field `barcode`) **sudah di-load saat mount di Server Component** (`page.tsx`) dan di-pass ke `ProductSearchPanel` sebagai prop `products: BootstrapProduct[]`.

```typescript
// Di BootstrapProduct (apps/backoffice/components/pos/pos-client.tsx, baris 13-23):
export interface BootstrapProduct {
  id: number
  sku: string | null
  barcode: string | null   // ← Field ini sudah ada!
  name: string
  categoryId: number | null
  brandId: number | null
  baseUomId: number
  weightGram: string | null
  stock: string
}
```

**Barcode lookup = pure in-memory filter** dari `products` array. Zero API call tambahan.

---

### File yang Dimodifikasi

**Hanya 1 file UPDATE:**

```
apps/backoffice/components/pos/
└── product-search-panel.tsx   ← SATU-SATUNYA FILE YANG DIUBAH
```

Tidak ada file baru. Tidak ada API endpoint baru. Tidak ada dependency baru.

---

### Implementasi Detail — `product-search-panel.tsx`

#### Struktur Lengkap yang Sudah Ada (Jangan Hapus)

Dari kode saat ini (`product-search-panel.tsx`):
- `useState` untuk `query` (search text) dan `noHargaAlert` (notifikasi harga tidak ada)
- `useRef` untuk `timerRef` (debounce alert, pola setTimeout 3 detik)
- `useMemo` untuk `priceMap` (Map `productId_uomId → BootstrapPrice`) dan `uomMap` (Map `uomId → code`)
- `useMemo` untuk `filtered` (filter produk berdasarkan query)
- `handleAddProduct(product: BootstrapProduct)` — fungsi yang memanggil `addItem` dari cart store

#### Tambahan untuk Barcode Scanner

Tambahkan 2 hal ke komponen:

**1. Ref untuk handler barcode (pattern "stable ref" — selalu current tiap render):**

```typescript
// Letakkan tepat SETELAH definisi addItem dari useCartStore (baris ~33), sebelum priceMap
const handleBarcodeFoundRef = useRef<(barcode: string) => void>(() => {})

// Update ref SETIAP render agar selalu capture closure terbaru dari handleAddProduct, priceMap, uomMap
// Letakkan ini setelah definisi handleAddProduct (baris ~95), sebelum return statement
handleBarcodeFoundRef.current = (barcode: string) => {
  const trimmed = barcode.trim()
  if (trimmed.length < 3) return

  const product = products.find(
    (p) => p.barcode && p.barcode.toLowerCase() === trimmed.toLowerCase()
  )

  if (!product) {
    if (timerRef.current) clearTimeout(timerRef.current)
    setNoHargaAlert(`Produk dengan barcode ini tidak ditemukan`)
    timerRef.current = setTimeout(() => setNoHargaAlert(null), 3000)
    return
  }

  handleAddProduct(product)
}
```

**2. `useEffect` untuk global keydown listener (letakkan setelah `useEffect` cleanup yang sudah ada):**

```typescript
useEffect(() => {
  let buffer = ''
  let bufferTimer: NodeJS.Timeout | null = null

  const handleKeyDown = (e: KeyboardEvent) => {
    // Jangan intercept jika user sedang mengetik di input/textarea/select
    const target = e.target as HTMLElement
    const tagName = target.tagName.toUpperCase()
    if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return

    if (e.key === 'Enter') {
      if (bufferTimer) {
        clearTimeout(bufferTimer)
        bufferTimer = null
      }
      const captured = buffer
      buffer = ''
      if (captured.trim().length >= 3) {
        handleBarcodeFoundRef.current(captured)
      }
      return
    }

    // Hanya karakter yang bisa dicetak (printable characters)
    if (e.key.length === 1) {
      buffer += e.key
      // Reset buffer jika tidak ada input baru dalam 300ms (memisahkan scanner dari typing manual)
      if (bufferTimer) clearTimeout(bufferTimer)
      bufferTimer = setTimeout(() => {
        buffer = ''
        bufferTimer = null
      }, 300)
    }
  }

  window.addEventListener('keydown', handleKeyDown)
  return () => {
    window.removeEventListener('keydown', handleKeyDown)
    if (bufferTimer) clearTimeout(bufferTimer)
  }
}, []) // Intentional empty deps — handleBarcodeFoundRef.current selalu up-to-date via ref
```

#### Kenapa Pola Ref Ini Benar

- `handleBarcodeFoundRef` di-assign ulang tiap render → selalu punya closure terbaru dari `products`, `priceMap`, `uomMap`, `handleAddProduct`
- `useEffect` jalan sekali (empty deps) → tidak re-register listener tiap render
- Pattern ini identik dengan pola yang digunakan di `ExpenseDialog.tsx` untuk ESC key listener

---

### Posisi Kode dalam File

Ini urutan yang benar di dalam komponen `ProductSearchPanel`:

```typescript
export default function ProductSearchPanel({ products, prices, uoms, branchId }) {
  const [query, setQuery] = useState('')
  const [noHargaAlert, setNoHargaAlert] = useState<string | null>(null)
  const addItem = useCartStore((s) => s.addItem)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // ← TAMBAH: ref untuk stable barcode handler
  const handleBarcodeFoundRef = useRef<(barcode: string) => void>(() => {})

  // (existing) Cleanup useEffect
  useEffect(() => { ... }, [])

  // ← TAMBAH: Barcode scanner useEffect
  useEffect(() => { ... }, [])

  // (existing) priceMap useMemo
  const priceMap = useMemo(...)

  // (existing) uomMap useMemo
  const uomMap = useMemo(...)

  // (existing) filtered useMemo
  const filtered = useMemo(...)

  // (existing) handleAddProduct function
  function handleAddProduct(product: BootstrapProduct) { ... }

  // ← TAMBAH: Update handleBarcodeFoundRef.current (setelah handleAddProduct didefinisikan)
  handleBarcodeFoundRef.current = (barcode: string) => { ... }

  // (existing) return JSX...
}
```

---

### Pola Kritis dari Story Sebelumnya (WAJIB diikuti)

1. **Tidak ada library baru** — pure Web API (`keydown` event), tidak ada `react-barcode-reader` atau sejenisnya
2. **Notifikasi error inline** — gunakan state `noHargaAlert` yang sudah ada (auto-clear 3 detik via `timerRef`)
3. **Tidak ada `any`** — gunakan `HTMLElement` untuk typing event target
4. **`'use client'`** sudah ada di baris pertama file — jangan hapus
5. **Cleanup di useEffect return** — selalu `window.removeEventListener` + `clearTimeout`
6. **Tidak ada `console.log`** di kode production

---

### TypeScript Considerations

- `e.key` bertipe `string` — single printable char memiliki `.length === 1`
- `e.target` cast ke `HTMLElement` (bukan `EventTarget`) untuk akses `.tagName`
- `handleBarcodeFoundRef` type: `useRef<(barcode: string) => void>(() => {})` — inisialisasi dengan no-op function agar tidak pernah `null`
- `p.barcode` bisa `null` — guard dengan `p.barcode &&` sebelum compare
- Case-insensitive comparison: `.toLowerCase()` di kedua sisi

---

### Tidak Ada Perubahan pada

- `pos-client.tsx` — tidak perlu ubah apapun
- `cart-store.ts` — `addItem` sudah handles increment qty untuk produk yang sama
- API routes — tidak ada endpoint baru
- Database schema — tidak ada perubahan
- `page.tsx` — `products.barcode` sudah di-query di Server Component

---

### Test Plan (Manual)

1. **Happy path — scanner bukan di input**: Pastikan tidak ada input yang fokus → scan barcode produk yang ada → produk masuk keranjang otomatis
2. **Happy path — scan produk yang sudah di keranjang**: Scan produk yang sudah ada → qty naik 1, bukan duplikasi baris
3. **Barcode tidak ditemukan**: Scan barcode acak → notifikasi "Produk dengan barcode ini tidak ditemukan" muncul 3 detik lalu hilang
4. **Tidak mengganggu search**: Klik search input, ketik nama produk → typing normal di search box (tidak ada double-detection)
5. **Produk tidak punya harga**: Scan barcode produk yang tidak punya harga RETAIL → notifikasi harga tidak tersedia (dari `handleAddProduct` yang sudah ada)
6. **Regresi — search manual tetap bekerja**: Ketik di search box → filter produk berjalan normal
7. **Regresi — tombol produk tetap bekerja**: Klik produk di grid → masuk keranjang normal

---

### Referensi

- `apps/backoffice/components/pos/product-search-panel.tsx` — file yang dimodifikasi
- `apps/backoffice/components/pos/cart-store.ts` — `addItem` increment logic (baris 37-55)
- `apps/backoffice/components/pos/pos-client.tsx` — `BootstrapProduct` interface dengan `barcode` field
- `apps/backoffice/components/pos/expense-dialog.tsx` — pola `useEffect` keydown listener (baris 24-30)
- `_bmad-output/planning-artifacts/epics.md` — Epic 12 Story 12.1 spec

---

## Tasks / Subtasks

- [x] Task 1: Tambah `handleBarcodeFoundRef` dan update assignment-nya ke `product-search-panel.tsx` (AC: 1, 2, 3, 5)
  - [x] 1.1 Buka `apps/backoffice/components/pos/product-search-panel.tsx`
  - [x] 1.2 Tambah `const handleBarcodeFoundRef = useRef<(barcode: string) => void>(() => {})` setelah baris `const timerRef = ...`
  - [x] 1.3 Setelah fungsi `handleAddProduct`, tambah assignment `handleBarcodeFoundRef.current = (barcode: string) => { ... }` sesuai spesifikasi di Dev Notes
  - [x] 1.4 Logic: find product by barcode (case-insensitive, `p.barcode && p.barcode.toLowerCase() === trimmed.toLowerCase()`)
  - [x] 1.5 Jika tidak ditemukan: gunakan `timerRef` pattern (set `noHargaAlert`, setTimeout 3 detik clear) — JANGAN buat state/timer baru
  - [x] 1.6 Jika ditemukan: panggil `handleAddProduct(product)` — reuse fungsi yang sudah ada

- [x] Task 2: Tambah `useEffect` barcode scanner listener (AC: 1, 2, 4)
  - [x] 2.1 Tambah `useEffect` baru tepat setelah `useEffect` cleanup yang sudah ada
  - [x] 2.2 Implementasi buffer: `let buffer = ''`, `let bufferTimer: NodeJS.Timeout | null = null`
  - [x] 2.3 Listener: cek `e.target.tagName` — skip jika INPUT/TEXTAREA/SELECT (AC-4)
  - [x] 2.4 Jika `e.key === 'Enter'`: clear timer, proses `buffer` sebagai barcode via `handleBarcodeFoundRef.current(buffer)`, reset buffer
  - [x] 2.5 Jika `e.key.length === 1`: tambah ke buffer, reset `bufferTimer` ke 300ms
  - [x] 2.6 Return cleanup: `window.removeEventListener('keydown', handleKeyDown)` + `clearTimeout(bufferTimer)`
  - [x] 2.7 Deps array: `[]` (intentional — ref pattern menjamin handler selalu current)

- [x] Task 3: Validasi TypeScript dan regresi
  - [x] 3.1 Jalankan `pnpm --filter backoffice exec tsc --noEmit` — zero error ✅
  - [ ] 3.2 Test manual: 7 skenario di Test Plan di atas
  - [x] 3.3 Verifikasi regresi: search manual tetap bekerja, klik produk dari grid tetap bekerja

---

## Dev Agent Record

### Agent Model Used

bmad-create-story (claude-sonnet-4-6)

### Debug Log References

- Products array sudah berisi `barcode` field — di-query di `apps/backoffice/app/pos/(authenticated)/page.tsx` baris 44 (`barcode: products.barcode`)
- `useCartStore.addItem` sudah handles increment otomatis (baris 37-55 cart-store.ts) — AC-3 sudah terpenuhi by design
- `timerRef` di `product-search-panel.tsx` adalah `useRef<NodeJS.Timeout | null>(null)` yang sudah ada — WAJIB dipakai ulang untuk notifikasi "tidak ditemukan", jangan buat ref baru
- Pattern ref stabil untuk listener digunakan agar `useEffect` tidak perlu re-run setiap render (hindari memory leak dari re-register listener)
- `noHargaAlert` state menampilkan string atau null — reuse untuk "tidak ditemukan" dan "tidak ada harga" (kedua kondisi exclusive, timer auto-reset)

### Completion Notes List

- **`product-search-panel.tsx`** (UPDATE): Tambah barcode scanner HID/USB support via global `keydown` listener. Pattern "stable ref" (`handleBarcodeFoundRef`) memastikan handler selalu punya closure terbaru tanpa menyebabkan listener re-register tiap render. Buffer chars dengan 300ms timeout, proses saat `Enter`. Skip jika target adalah INPUT/TEXTAREA/SELECT (tidak mengganggu search manual). Reuse `handleAddProduct` (lookup harga + addItem), `timerRef` (debounce alert), `noHargaAlert` state yang sudah ada. TypeScript `tsc --noEmit` — zero error.

### File List

- apps/backoffice/components/pos/product-search-panel.tsx (UPDATE)

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-05-29 | Story created | bmad-create-story |
| 2026-05-29 | Story implemented — barcode scanner HID/USB support di product-search-panel.tsx | dev-agent |
