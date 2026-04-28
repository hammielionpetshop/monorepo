---
epic_id: 2
story_id: 2.3
story_key: 2-3-reprint-receipt
status: done
created_at: 2026-04-28
---

# Story 2.3: Reprint Receipt

## Story

As a Kasir,
I want dapat mencetak ulang struk dari riwayat transaksi yang dipilih,
So that saya bisa memberikan salinan kepada pelanggan jika diminta.

## Acceptance Criteria

1. **Given** Kasir sedang melihat rincian transaksi di `TransactionDetailDialog`
   **When** mereka menekan tombol "Cetak Ulang"
   **Then** thermal printer akan mencetak salinan struk tersebut
   **And** struk hasil cetak ulang harus secara jelas mencantumkan label "*** SALINAN STRUK ***" di bagian atas
   **And** tombol menampilkan state loading (disabled + spinner) selama proses cetak berlangsung

2. **Given** proses cetak ulang selesai (berhasil atau gagal)
   **When** response dari printer diterima
   **Then** toast notifikasi muncul: "Struk berhasil dicetak ulang" (sukses) atau "Gagal mencetak struk: [pesan error]" (gagal)
   **And** tombol kembali ke state normal

3. **Given** printer tidak terhubung (mocked mode)
   **When** Kasir menekan "Cetak Ulang"
   **Then** sistem tetap menganggap sukses (tidak crash) karena IPC handler sudah mengembalikan `{ success: true, mocked: true }`

## Tasks / Subtasks

- [x] **Extend `PrintPayload` di `src/lib/print-service.ts`**
  - [x] Tambah field `isReprint?: boolean` ke interface `PrintPayload`
  - [x] Tidak ada perubahan logika lain di file ini

- [x] **Modifikasi `electron/main.ts` — handler `printer:print`**
  - [x] Destructure `isReprint` dari `payload`
  - [x] Jika `isReprint === true`, cetak blok header "SALINAN STRUK" sebelum konten struk utama:
    ```
    printer.alignCenter()
    printer.bold(true)
    printer.println("*** SALINAN STRUK ***")
    printer.bold(false)
    printer.drawLine()
    ```
  - [x] Letakkan blok ini SETELAH `printer.drawLine()` pertama (setelah header toko) tapi SEBELUM data transaksi
  - [x] Tidak ada perubahan lain pada logika print utama

- [x] **Modifikasi `src/components/history/TransactionDetailDialog.tsx`**
  - [x] Tambah `useState<boolean>` untuk `isPrinting` (init `false`)
  - [x] Tambah fungsi `handleReprint()` (async):
    - Set `isPrinting(true)`
    - Panggil `printService.printReceipt({ trxNumber, items, totals, payments, isReprint: true })`
    - Jika `result.success`: `toast.success('Struk berhasil dicetak ulang')`
    - Jika `!result.success`: `toast.error('Gagal mencetak struk: ' + (result.error ?? 'Unknown error'))`
    - Di blok `finally`: Set `isPrinting(false)`
  - [x] Ganti footer dari satu tombol menjadi dua tombol berdampingan:
    - Tombol "Cetak Ulang" (kiri): brand-colored, icon `Printer`, disabled saat `isPrinting`
    - Tombol "Tutup" (kanan): neutral, lebar lebih sempit

## Dev Notes

### File yang Harus Dimodifikasi

| File | Status | Keterangan |
|---|---|---|
| `src/lib/print-service.ts` | **MODIFY** | Tambah `isReprint?: boolean` ke `PrintPayload` |
| `electron/main.ts` | **MODIFY** | Tambah header "SALINAN STRUK" jika `isReprint === true` |
| `src/components/history/TransactionDetailDialog.tsx` | **MODIFY** | Tambah tombol "Cetak Ulang" + loading state |

**Jangan modifikasi:**
- `src/pages/History.tsx` — tidak ada perubahan di parent
- `src/services/history-service.ts` — tidak ada query baru
- `src/lib/db.ts` — schema tidak berubah

### Konteks Kritis: IPC Chain

```
TransactionDetailDialog
  → printService.printReceipt(payload)          // src/lib/print-service.ts
    → window.ipcRenderer.printer.printReceipt() // electron/preload.ts (sudah ada)
      → ipcMain.handle('printer:print', ...)    // electron/main.ts (perlu dimodifikasi)
        → ThermalPrinter (node-thermal-printer)
```

Tidak perlu mengubah `preload.ts` — method `printReceipt` sudah ada dan hanya mem-pass payload apa adanya.

### Data yang Tersedia di Dialog (tidak perlu query ulang)

```typescript
// Data sudah ada di scope komponen — gunakan langsung:
const payload = transaction.payload ?? {}
const items: CartItem[]            = payload.items ?? []
const totals: CartTotals           = payload.totals ?? {}
const payments: TransactionPayment[] = payload.payments ?? []

// Build PrintPayload dari data yang sudah ada:
const printPayload: PrintPayload = {
  trxNumber: transaction.trxNumber,
  items,
  totals,
  payments,
  isReprint: true,
}
```

**Anti-pattern yang DILARANG:**
```typescript
// ❌ DILARANG: query ulang ke Dexie hanya untuk dapat data print
const trx = await historyService.getById(transaction.id) // Tidak perlu — data sudah ada
```

### Implementasi Tombol Footer yang Diharapkan

```tsx
{/* Footer */}
<div className="px-6 py-4 border-t border-white/5 shrink-0 flex gap-3">
  <button
    onClick={handleReprint}
    disabled={isPrinting}
    className="flex-1 py-2.5 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-950 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
  >
    {isPrinting
      ? <Loader2 className="w-4 h-4 animate-spin" />
      : <Printer className="w-4 h-4" />
    }
    {isPrinting ? 'Mencetak...' : 'Cetak Ulang'}
  </button>
  <button
    onClick={onClose}
    className="w-28 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all"
  >
    Tutup
  </button>
</div>
```

### Implementasi `handleReprint` yang Diharapkan

```typescript
const [isPrinting, setIsPrinting] = useState(false)

const handleReprint = async () => {
  setIsPrinting(true)
  try {
    const result = await printService.printReceipt({
      trxNumber: transaction.trxNumber,
      items,
      totals,
      payments,
      isReprint: true,
    })
    if (result.success) {
      toast.success('Struk berhasil dicetak ulang')
    } else {
      toast.error(`Gagal mencetak struk: ${result.error ?? 'Printer tidak merespons'}`)
    }
  } catch (err) {
    toast.error('Gagal mencetak struk: ' + (err as Error).message)
  } finally {
    setIsPrinting(false)
  }
}
```

### Modifikasi `electron/main.ts` — Blok yang Diubah

Tambahkan pengecekan `isReprint` setelah header toko dicetak:

```typescript
// Di dalam ipcMain.handle('printer:print', ...)
const { items, totals, payments, trxNumber, isReprint } = payload;

// ... (header toko: alignCenter, bold, println "HAMMIELION PETSHOP", drawLine — TIDAK BERUBAH)

// TAMBAHKAN di sini, setelah drawLine pertama:
if (isReprint) {
  printer.alignCenter()
  printer.bold(true)
  printer.println("*** SALINAN STRUK ***")
  printer.bold(false)
  printer.drawLine()
}

printer.alignLeft()
printer.println(`Trx: ${trxNumber}`)
// ... (sisa kode tidak berubah)
```

### Import Tambahan di `TransactionDetailDialog.tsx`

```typescript
import { useState } from 'react'
import { X, Printer, Loader2 } from 'lucide-react'  // tambah Printer, Loader2
import { toast } from 'sonner'                        // tambah toast
import { printService } from '@/lib/print-service'   // tambah printService
```

### Pola Error Handling

- `printService.printReceipt()` sudah diimplementasi dengan try/catch internal yang mengembalikan `{ success: false, error: message }` — tidak akan throw exception ke caller.
- Tetap wrap dengan try/catch di `handleReprint` sebagai safety net untuk error tak terduga.
- Error message ke user dalam **Bahasa Indonesia** (sesuai aturan project).

### Learnings dari Story 2.1 & 2.2

- **Toast**: Gunakan `sonner` (`from 'sonner'`), bukan `useToast` dari `@/components/ui/use-toast`. Lihat `PaymentDialog.tsx` dan `History.tsx` untuk konfirmasi pola ini.
- **Loading state**: Pattern `useState<boolean>` untuk `isPrinting` — sama seperti `PaymentDialog.tsx` yang menggunakan `isLoading`.
- **Custom dialog pola**: Dialog sudah menggunakan custom `fixed` overlay (bukan Radix). Footer adalah `div` terakhir dengan `border-t border-white/5 shrink-0`.
- **Printer**: Lucide icon yang tersedia dan valid: `Printer` (sudah dikonfirmasi ada di lucide-react terbaru).
- **`printService.printReceipt`**: Mengembalikan `{ success: boolean, error?: string, mocked?: boolean }`. Kalau `mocked: true` berarti printer tidak terhubung tapi dianggap sukses.

### Scope Batasan — Story Ini TIDAK Mencakup

- Filter berdasarkan tanggal → Story 3.2
- Search berdasarkan pelanggan → Story 3.1
- Void dari dialog detail → Story 4.1
- Konfigurasi jenis/interface printer → di luar scope MVP

## Referensi Konteks Proyek

- `apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx` — file utama yang dimodifikasi (tambah tombol + handler)
- `apps/pos-desktop/src/lib/print-service.ts` — extend `PrintPayload` interface
- `apps/pos-desktop/electron/main.ts` — tambah logika SALINAN STRUK di IPC handler
- `apps/pos-desktop/src/components/pos/PaymentDialog.tsx` — referensi pola loading state + toast

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
Tidak ada blocker. Semua 3 task selesai dalam satu sesi.

### Completion Notes List
- Tambah `isReprint?: boolean` ke `PrintPayload` interface di `print-service.ts`
- Tambah destructure `isReprint` di `electron/main.ts` handler `printer:print`; blok header "*** SALINAN STRUK ***" dicetak setelah `drawLine()` pertama (header toko) jika `isReprint === true`
- Refactor footer `TransactionDetailDialog.tsx` dari satu tombol "Tutup" menjadi dua tombol: "Cetak Ulang" (brand-colored, dengan Printer/Loader2 icon, disabled saat `isPrinting`) dan "Tutup" (neutral, lebar tetap `w-28`)
- `handleReprint` menggunakan pattern try/catch/finally dengan `toast.success`/`toast.error` dari `sonner`
- Semua 25 unit test pass, tidak ada regresi

### File List
- `apps/pos-desktop/src/lib/print-service.ts`
- `apps/pos-desktop/electron/main.ts`
- `apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx`

### Change Log
- 2026-04-28: Implementasi Story 2.3 — Fitur Cetak Ulang Struk dari TransactionDetailDialog (tambah `isReprint` di PrintPayload, header SALINAN STRUK di main.ts, tombol Cetak Ulang + loading state di dialog)

### Review Findings

- [x] [Review][Defer] Posisi label "SALINAN STRUK" — deferred (pilihan user). Label diletakkan di bawah nama toko. Perlu konfirmasi apakah ini sudah sesuai definisi "bagian atas" di spec.
- [x] [Review][Patch] Penutupan dialog saat mencetak [TransactionDetailDialog.tsx] — User bisa menutup dialog saat `isPrinting` masih true, menyebabkan state update pada unmounted component.
- [x] [Review][Patch] Tipe data `any` pada `PrintPayload` [print-service.ts] — Interface menggunakan `any`, menghilangkan manfaat TypeScript untuk validasi data transaksi.
- [x] [Review][Patch] Label "SALINAN STRUK" hardcoded [main.ts] — Teks label di-hardcode di `main.ts`, menyulitkan internasionalisasi di masa depan.
- [x] [Review][Patch] Ketidakseimbangan lebar tombol [TransactionDetailDialog.tsx] — Tombol "Cetak Ulang" (`flex-1`) vs "Tutup" (`w-28`) dapat terlihat aneh di layar lebar.
- [x] [Review][Defer] Validasi Payload IPC [main.ts] — deferred, pre-existing. Handler `printer:print` melakukan destructuring payload tanpa validasi tipe atau keberadaan properti.
- [x] [Review][Defer] Pengecekan inisialisasi printer [main.ts] — deferred, pre-existing. Mencoba melakukan alignment dan cetak tanpa mengecek apakah objek `printer` berhasil diinisialisasi.
