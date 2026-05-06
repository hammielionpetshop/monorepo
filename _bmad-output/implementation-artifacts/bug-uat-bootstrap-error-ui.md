---
epic_id: UAT
story_id: BUG-2
story_key: bug-uat-bootstrap-error-ui
status: ready-for-dev
created_at: 2026-05-06
---

# Bug Fix UAT: Bootstrap Error UI — Pesan Ramah & Tombol Retry

## Story

As a Kasir,
I want melihat pesan error yang mudah dipahami saat aplikasi gagal memeriksa pembaruan,
So that saya tidak bingung dengan kode teknis dan bisa mencoba ulang tanpa perlu restart aplikasi.

## Acceptance Criteria

1. **Given** aplikasi POS sedang memeriksa pembaruan saat startup
   **When** koneksi internet tidak tersedia (atau auto-updater gagal)
   **Then** layar error menampilkan pesan ramah dalam Bahasa Indonesia, BUKAN kode teknis seperti `net::ERR_INTERNET_DISCONNECTED`
   **And** pesan teknis seperti `net::ERR_*` atau error Chromium lainnya TIDAK terekspos ke pengguna

2. **Given** layar error update ditampilkan
   **When** pengguna membaca pesan error
   **Then** terdapat tombol "Coba Lagi" yang dapat diklik untuk mencoba ulang pemeriksaan pembaruan

3. **Given** pengguna menekan tombol "Coba Lagi"
   **When** tombol diklik
   **Then** aplikasi kembali ke state "checking" dan mencoba pemeriksaan pembaruan ulang via `updater.checkForUpdates()`

4. **Given** aplikasi gagal memeriksa pembaruan karena tidak ada koneksi
   **When** error state ditampilkan
   **Then** tombol "Coba Lagi" tetap tersedia dan aplikasi tidak langsung auto-dismiss terlalu cepat (teks "Melanjutkan..." tetap ada tapi pengguna punya waktu untuk membaca)

## Tasks / Subtasks

- [ ] **Modifikasi `apps/pos-desktop/src/components/update/UpdateOverlay.tsx`**
  - [ ] Buat fungsi helper `sanitizeUpdateError(msg: string): string`:
    - Jika `msg` mengandung `net::ERR_` → return `'Tidak ada koneksi internet. Periksa jaringan Anda.'`
    - Jika `msg` mengandung kata `network` atau `connection` (case-insensitive) → return `'Gagal terhubung ke server pembaruan. Periksa koneksi internet.'`
    - Fallback → return `'Gagal memeriksa pembaruan. Coba lagi atau lanjutkan menggunakan versi saat ini.'`
  - [ ] Ganti `setErrorMsg(msg)` menjadi `setErrorMsg(sanitizeUpdateError(msg))` di `updater.onUpdateError(...)` handler
  - [ ] Tambahkan tombol "Coba Lagi" di error state block (di samping atau di bawah teks "Melanjutkan...")
  - [ ] Tombol "Coba Lagi" memanggil: `updater.checkForUpdates?.()` lalu reset state ke `"checking"`
  - [ ] Pertimbangkan memperpanjang auto-dismiss dari 2500ms ke 5000ms untuk memberi pengguna cukup waktu membaca pesan dan tombol

## Dev Notes

### Konteks: Komponen dan Sumbernya

File: `apps/pos-desktop/src/components/update/UpdateOverlay.tsx`

Komponen ini muncul saat aplikasi pertama buka (hanya di production build). Ia mengelola state update dari Electron `autoUpdater`:
- `checking` → spinner "Memeriksa pembaruan..."
- `error` → **ini yang perlu diperbaiki** — saat ini menampilkan raw `errorMsg` dari Electron

State yang relevan:
```typescript
const [errorMsg, setErrorMsg] = useState("")
// Diisi di:
updater.onUpdateError((msg: string) => {
  setErrorMsg(msg) // ← msg bisa berisi "net::ERR_INTERNET_DISCONNECTED"
  setState("error")
  setTimeout(() => setVisible(false), 2500) // ← auto-dismiss 2.5 detik
})
```

### Fix: Fungsi Sanitize Error

Tambahkan sebelum `return` statement utama:

```typescript
function sanitizeUpdateError(msg: string): string {
  const lower = msg.toLowerCase()
  if (msg.includes('net::ERR_') || lower.includes('network') || lower.includes('connection')) {
    return 'Tidak ada koneksi internet. Periksa jaringan Anda.'
  }
  return 'Gagal memeriksa pembaruan. Coba lagi atau lanjutkan menggunakan versi saat ini.'
}
```

### Fix: Handler yang Dimodifikasi

```typescript
updater.onUpdateError((msg: string) => {
  setErrorMsg(sanitizeUpdateError(msg))
  setState("error")
  setTimeout(() => setVisible(false), 5000) // perpanjang dari 2500 ke 5000
})
```

### Fix: Error State Block yang Dimodifikasi

```tsx
{state === "error" && (
  <div className="flex flex-col items-center gap-3">
    <p className="text-sm text-red-400">Gagal memeriksa pembaruan</p>
    {errorMsg && <p className="text-xs text-zinc-400 text-center max-w-xs">{errorMsg}</p>}
    <div className="flex gap-3 mt-1">
      <button
        onClick={() => {
          setState("checking")
          setErrorMsg("")
          ;(window as any).ipcRenderer?.updater?.checkForUpdates?.()
        }}
        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
      >
        Coba Lagi
      </button>
    </div>
    <p className="text-xs text-zinc-600">Melanjutkan...</p>
  </div>
)}
```

### Catatan: Preload API untuk updater

`updater` object di renderer berasal dari `window.ipcRenderer.updater` yang di-expose via preload.ts. Pastikan `checkForUpdates` tersedia di preload — cek `apps/pos-desktop/electron/preload.ts` untuk melihat apa saja yang di-expose. Jika belum ada, tambahkan:
```typescript
checkForUpdates: () => ipcRenderer.invoke('updater:check')
// dan di main.ts: ipcMain.handle('updater:check', () => autoUpdater.checkForUpdates())
```
Jika `checkForUpdates` belum di-expose, wrap tombol retry dengan optional chaining dan fallback reload:
```typescript
onClick={() => {
  const updater = (window as any).ipcRenderer?.updater
  if (updater?.checkForUpdates) {
    setState("checking")
    setErrorMsg("")
    updater.checkForUpdates()
  } else {
    window.location.reload() // fallback: reload app
  }
}}
```

### Anti-Patterns (DILARANG)

- JANGAN tampilkan raw error message dari Electron tanpa sanitasi
- JANGAN gunakan `error.code` atau property non-standard — `msg` adalah string
- JANGAN hapus teks "Melanjutkan..." — tetap tampilkan sebagai info bahwa app akan lanjut otomatis

### Files yang Dimodifikasi

| File | Status | Keterangan |
|------|--------|-----------|
| `apps/pos-desktop/src/components/update/UpdateOverlay.tsx` | MODIFY | Sanitize errorMsg + tombol Coba Lagi |
| `apps/pos-desktop/electron/preload.ts` | MODIFY (jika perlu) | Expose `checkForUpdates` jika belum ada |
| `apps/pos-desktop/electron/main.ts` | MODIFY (jika perlu) | Handle `updater:check` IPC jika perlu |

### Scope Batasan

- Story ini TIDAK mengubah logika auto-updater di `main.ts` (autoUpdater config)
- Story ini TIDAK mengubah retry logic untuk bootstrap data (`useBootstrap.ts`) — itu sudah ditangani di story lain
- Story ini HANYA memperbaiki UI error state di `UpdateOverlay.tsx`

## Dev Agent Record

### Agent Model Used
(diisi saat implementasi)

### Completion Notes List

### File List

### Change Log
