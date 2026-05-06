---
epic_id: UAT
story_id: BUG-3
story_key: bug-uat-printer-error-handling
status: done
created_at: 2026-05-06
---

# Bug Fix UAT: Printer Error Handling — Pesan Ramah & Loading State

## Story

As a Kasir,
I want melihat pesan error yang mudah dipahami dan loading state yang benar saat printer bermasalah,
So that saya tidak melihat pesan teknis "no driver set" dan tahu bahwa aplikasi sedang memproses permintaan cetak ulang.

## Acceptance Criteria

1. **Given** tombol "Cetak Ulang" ditekan di `TransactionDetailDialog`
   **When** printer belum dikonfigurasi (driver tidak tersedia di sistem)
   **Then** toast error menampilkan pesan ramah: "Printer belum dikonfigurasi. Hubungi Administrator." — BUKAN "no driver set"

2. **Given** tombol "Cetak Ulang" ditekan
   **When** proses print sedang berjalan (menunggu respons IPC dari main process)
   **Then** tombol berubah ke state loading: disabled + spinner + teks "Mencetak..." ditampilkan sebelum error/sukses muncul

3. **Given** proses print gagal karena alasan apapun
   **When** respons error diterima
   **Then** toast error ditampilkan dengan pesan dalam Bahasa Indonesia; tombol kembali ke state normal (tidak disabled)

4. **Given** printer tidak terhubung sama sekali (mode mock — `isPrinterConnected()` = false)
   **When** tombol "Cetak Ulang" ditekan
   **Then** toast sukses muncul (behavior yang sudah ada dipertahankan: `{ success: true, mocked: true }`)

## Tasks / Subtasks

- [x] **Modifikasi `apps/pos-desktop/electron/main.ts` — IPC handler `printer:print`**
  - [x] Pindahkan `new ThermalPrinter(...)` ke LUAR try-catch utama, atau bungkus sendiri dalam try-catch
  - [x] Jika konstruktor `ThermalPrinter` throw → return `{ success: false, error: 'Printer belum dikonfigurasi. Hubungi Administrator.' }`
  - [x] Jika `printer.isPrinterConnected()` throw → return `{ success: false, error: 'Printer tidak merespons. Periksa koneksi printer.' }`
  - [x] Modifikasi catch block global: sanitize error message sebelum dikembalikan ke renderer
  - [x] Terapkan fix yang sama ke handler `printer:print-settlement` (copy pola yang sama)

- [x] **Modifikasi `apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx`**
  - [x] Tambahkan `import { flushSync } from 'react-dom'`
  - [x] Di `handleReprint`, ganti `setIsPrinting(true)` menjadi `flushSync(() => setIsPrinting(true))` untuk memastikan loading state ter-render SEBELUM IPC call dikirim
  - [x] Verifikasi existing error message format sudah sesuai: `toast.error(\`Gagal mencetak struk: \${result.error ?? 'Printer tidak merespons'}\`)` — sudah benar, tidak perlu diubah (pesan datang dari main.ts yang sudah disanitasi)

## Dev Notes

### Root Cause Analysis

**Bug #6 (pesan teknis "no driver set"):**
Di `electron/main.ts`, handler `printer:print`:
```typescript
ipcMain.handle('printer:print', async (_, payload: any) => {
  try {
    let printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: 'printer:Generic', // ← throws "no driver set" jika driver tidak ada
    });
    const isConnected = await printer.isPrinterConnected(); // ← juga bisa throw
    ...
  } catch (err) {
    return { success: false, error: (err as Error).message }; // ← raw "no driver set" ke renderer
  }
})
```

`node-thermal-printer` melempar error "no driver set" (atau sejenisnya) saat sistem tidak memiliki driver printer yang sesuai. Error ini terekspos langsung ke kasir melalui `result.error`.

**Bug #7 (loading state tidak muncul):**
Di `TransactionDetailDialog.tsx`:
```typescript
const handleReprint = async () => {
  setIsPrinting(true)       // ← queued re-render (belum di-commit ke DOM)
  try {
    const result = await printService.printReceipt({...})  // ← jika resolve cepat...
    ...
  } finally {
    setIsPrinting(false)    // ← langsung di-queue juga
  }
}
```

React 18 automatic batching: jika `await` resolve sangat cepat (IPC lokal sangat cepat), React bisa batch `setIsPrinting(true)` dan `setIsPrinting(false)` dalam satu render cycle — hasilnya: loading state tidak pernah terlihat.

**Fix dengan `flushSync`:** `flushSync(() => setIsPrinting(true))` memaksa React untuk flush pending state updates secara synchronous dan commit ke DOM SEBELUM melanjutkan kode berikutnya. Ini menjamin loading state terlihat sebelum IPC call dikirim.

### Fix: `electron/main.ts` — Printer Handler

```typescript
ipcMain.handle('printer:print', async (_, payload: any) => {
  console.log('[Printer] Received print payload:', payload.trxNumber);

  // Inisialisasi printer — tangani error driver secara terpisah
  let printer: ThermalPrinter;
  try {
    printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: 'printer:Generic',
    });
  } catch {
    console.warn('[Printer] Gagal inisialisasi printer: driver tidak tersedia');
    return { success: false, error: 'Printer belum dikonfigurasi. Hubungi Administrator.' };
  }

  try {
    const { items, totals, trxNumber, isReprint } = payload;

    const isConnected = await printer.isPrinterConnected();
    if (!isConnected) {
      console.warn('[Printer] No physical printer found. Previewing in logs...');
      return { success: true, mocked: true };
    }

    // ... (sisa logika print TIDAK BERUBAH)
    
    printer.cut();
    await printer.execute();
    return { success: true };
  } catch (err) {
    console.error('[Printer] Error:', err);
    const rawMsg = (err as Error).message ?? ''
    const userMsg = rawMsg.toLowerCase().includes('driver') || rawMsg.toLowerCase().includes('interface')
      ? 'Printer belum dikonfigurasi. Hubungi Administrator.'
      : 'Printer tidak merespons. Periksa koneksi printer.'
    return { success: false, error: userMsg };
  }
})
```

**Terapkan pola yang sama ke `printer:print-settlement` handler** di baris setelahnya.

### Fix: `TransactionDetailDialog.tsx` — Loading State dengan flushSync

```typescript
import { flushSync } from 'react-dom'  // tambahkan import ini

const handleReprint = async () => {
  flushSync(() => setIsPrinting(true))  // ← force synchronous re-render sebelum IPC
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

### IPC Chain (tidak berubah)

```
TransactionDetailDialog
  → printService.printReceipt(payload)           // src/lib/print-service.ts
    → window.ipcRenderer.printer.printReceipt()  // electron/preload.ts
      → ipcMain.handle('printer:print', ...)     // electron/main.ts ← DIMODIFIKASI
        → ThermalPrinter (node-thermal-printer)
```

### Catatan Penting

- `flushSync` di dalam event handler adalah pattern yang aman di React 18 — digunakan khusus ketika HARUS ada re-render synchronous sebelum operasi async
- Jangan gunakan `flushSync` di tempat lain kecuali ada kebutuhan yang jelas sama
- Error message di handler `printer:print-settlement` juga perlu disanitasi dengan pola yang sama
- Interface `'printer:Generic'` dipertahankan as-is — ini adalah konfigurasi yang membutuhkan setup oleh Administrator, BUKAN diubah di kode

### Files yang Dimodifikasi

| File | Status | Keterangan |
|------|--------|-----------|
| `apps/pos-desktop/electron/main.ts` | MODIFY | Wrap ThermalPrinter constructor, sanitize error msg (2 handler: print + print-settlement) |
| `apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx` | MODIFY | Tambah `flushSync` untuk loading state + import `flushSync` |

**Jangan modifikasi:**
- `src/lib/print-service.ts` — interface sudah benar
- `electron/preload.ts` — IPC bridge sudah benar

### Scope Batasan

- Story ini TIDAK mengubah konfigurasi printer (interface, driver setup) — itu tanggung jawab Administrator
- Story ini TIDAK menambahkan printer settings UI — di luar scope
- Story ini HANYA memperbaiki error handling dan loading state UX

## Dev Agent Record

### Agent Model Used
deepseek-v4-flash / opencode-go

### Completion Notes List
- **Bug #6 (pesan teknis "no driver set")**: Di `electron/main.ts`, konstruktor `ThermalPrinter` dipindahkan ke luar try-catch utama dan dibungkus dalam try-catch sendiri. Jika throw, return pesan ramah "Printer belum dikonfigurasi. Hubungi Administrator." Catch block global juga disanitasi: error yg mengandung "driver" atau "interface" ditampilkan sebagai "Printer belum dikonfigurasi", sisanya "Printer tidak merespons. Periksa koneksi printer." Pola yang sama diterapkan ke handler `printer:print-settlement`.
- **Bug #7 (loading state tidak muncul)**: Di `TransactionDetailDialog.tsx`, `setIsPrinting(true)` diganti dengan `flushSync(() => setIsPrinting(true))` untuk memaksa React commit state update secara synchronous sebelum IPC call, mencegah React 18 automatic batching menyembunyikan loading state.
- Semua acceptance criteria terpenuhi. 67 tests passing, 0 regresi.
- ✅ Code review selesai — 4 patch diterapkan, 3 defer dicatat

### File List
- `apps/pos-desktop/electron/main.ts` (MODIFY) — fix printer error handling + sanitasi pesan error
- `apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx` (MODIFY) — loading state dengan flushSync

### Change Log
2026-05-06: Implementasi bug fix printer error handling — sanitasi error message di main.ts (printer:print + printer:print-settlement) dan fix loading state dengan flushSync di TransactionDetailDialog.tsx

### Review Findings

- [x] [Review][Patch] Unsafe error casting crashes catch handler on non-Error throws [electron/main.ts:188,316]
- [x] [Review][Patch] tableCustom column widths exceed 1.0 and corrupt receipt layout [electron/main.ts:255-266]
- [x] [Review][Patch] Missing explicit try-catch for printer.isPrinterConnected() throws [electron/main.ts:112,216]
- [x] [Review][Patch] Printer initialization catch should log actual error for debugging [electron/main.ts:125,198]
- [x] [Review][Defer] Zero payload validation on any-typed IPC payloads [electron/main.ts:120,196] — deferred, pre-existing
- [x] [Review][Defer] NaN variance and "Invalid Date" on malformed settlement summary [electron/main.ts:231,282] — deferred, pre-existing
- [x] [Review][Defer] Concurrent print jobs race on the same printer:Generic interface [electron/main.ts:124-128] — deferred, pre-existing
