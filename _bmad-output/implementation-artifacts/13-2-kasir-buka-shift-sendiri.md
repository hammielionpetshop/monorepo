# Story 13.2: Kasir Dapat Membuka Shift Sendiri

Status: done

## Story

**As a** Kasir,
**I want** bisa membuka shift baru sendiri ketika belum ada shift aktif,
**So that** saya tidak perlu menunggu Manager hadir untuk memulai operasional.

## Acceptance Criteria

**AC-1: Kasir role dapat melihat tombol "Buka Shift Baru"**
**Given** Kasir dengan role `KASIR` mengakses `/pos` dan tidak ada shift aktif
**When** halaman dimuat
**Then** sistem menampilkan tombol "Buka Shift Baru" (sama seperti yang dilihat Manager)

**AC-2: Buka shift berhasil**
**Given** Kasir mengisi form buka shift (modal awal + pilih kasir)
**When** submit berhasil
**Then** shift terbuka dan Kasir otomatis join — masuk ke halaman POS normal

**AC-3: Validasi modal awal**
**Given** Kasir submit form dengan modal awal = 0
**When** validasi dijalankan
**Then** error "Modal awal harus lebih dari 0" tampil, form tidak tersubmit

## Dev Notes

### File yang Dimodifikasi (UPDATE — 1 baris saja)

**`apps/backoffice/components/pos/shift-gate-client.tsx`** baris 30:

```typescript
// OLD:
const canOpenShift = ['OWNER', 'GM', 'MANAGER'].includes(userRole)

// NEW:
const canOpenShift = true
```

Parameter `userRole` masih ada di props — tidak perlu dihapus karena dipakai oleh logika lain di luar component ini.

### Yang TIDAK Perlu Diubah

- `OpenShiftDialog` — sudah berfungsi untuk semua role
- API `POST /api/pos/shifts` — tidak ada role check di server
- Case C (shift ada, kasir tidak ditugaskan) — pesan "Hubungi Manager" tetap benar karena kasir tidak bisa assign dirinya ke shift yang sedang berjalan

## Tasks / Subtasks

- [x] Task 1: Ubah `canOpenShift` di `shift-gate-client.tsx`
  - [x] 1.1 Ganti `['OWNER', 'GM', 'MANAGER'].includes(userRole)` dengan `true`
  - [x] 1.2 Verifikasi TypeScript `tsc --noEmit` — zero error

## Dev Agent Record

### Completion Notes

Implementasi selesai — satu baris perubahan di `shift-gate-client.tsx` baris 30. TypeScript zero error.

## File List

- apps/backoffice/components/pos/shift-gate-client.tsx (UPDATE)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Story created & implemented | bmad-dev-story |
