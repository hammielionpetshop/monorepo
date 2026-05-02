---
title: 'UI Contrast Refinement (Light & Dark Mode)'
type: 'feature'
created: '2026-05-03T03:22:00+07:00'
status: 'in-review'
baseline_commit: 'd1b4c171bd971f6cfd4b66dd89eea03e33b4caef'
context: ['_bmad-output/project-context.md', '_bmad-output/implementation-artifacts/epic-5-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Halaman Dashboard dan Laporan saat ini menggunakan warna yang *hardcoded* (seperti `bg-white`, `text-gray-900`) yang tidak menyesuaikan diri saat sistem berada dalam *Dark Mode*, menyebabkan kontras rendah atau elemen yang "hilang" karena warnanya sama dengan latar belakang.

**Approach:** Mengimplementasikan sistem variabel CSS semantik (ala Shadcn) di `globals.css` untuk menangani *Light* dan *Dark Mode* secara elegan, serta merefaktor seluruh komponen UI di Backoffice agar menggunakan variabel tersebut (misal: `bg-card`, `text-foreground`, `border-border`) alih-alih warna *hardcoded*.

## Boundaries & Constraints

**Always:**
- Gunakan variabel CSS semantik di `globals.css` untuk semua warna UI utama.
- Pastikan rasio kontras teks terhadap latar belakang memenuhi standar aksesibilitas (WCAG AA).
- Gunakan pola Tailwind CSS 4 `@theme` untuk memetakan variabel CSS ke utilitas Tailwind.
- Pertahankan nuansa "Premium" dengan palet warna yang harmonis (bukan sekadar hitam-putih murni).

**Ask First:**
- Perubahan drastis pada palet warna *Brand* (Amber/Brown) jika diperlukan untuk kontras mode gelap.

**Never:**
- Jangan gunakan class warna *hardcoded* (seperti `bg-white` atau `bg-gray-100`) di dalam komponen UI utama.
- Jangan mengubah logika bisnis atau query data; fokus hanya pada presentasi UI.

</frozen-after-approval>

## Code Map

- `apps/backoffice/app/globals.css` -- Definisi variabel CSS semantik dan pemetaan `@theme` Tailwind.
- `apps/backoffice/app/(dashboard)/layout.tsx` -- Refaktor Sidebar, Header, dan Main Container.
- `apps/backoffice/app/(dashboard)/dashboard/page.tsx` -- Refaktor MetricCard dan layout dashboard.
- `apps/backoffice/app/(dashboard)/reports/profit-loss/page.tsx` -- Refaktor form input dan tabel laporan.
- `apps/backoffice/app/(dashboard)/dashboard/_components/offline-branch-widget.tsx` -- Refaktor widget status cabang offline.

## Tasks & Acceptance

**Execution:**
- [x] `apps/backoffice/app/globals.css` -- Tambahkan variabel CSS lengkap (background, foreground, card, muted, border, primary, dll) untuk Light dan Dark mode. Map ke `@theme`.
- [x] `apps/backoffice/app/(dashboard)/layout.tsx` -- Ganti `bg-gray-100`, `bg-white`, dan `border-gray-200` dengan variabel semantik.
- [x] `apps/backoffice/app/(dashboard)/dashboard/page.tsx` -- Refaktor `MetricCard` agar menggunakan `bg-card`, `text-card-foreground`, dan `border-border`.
- [x] `apps/backoffice/app/(dashboard)/reports/profit-loss/page.tsx` -- Update form dan tabel agar menggunakan `bg-card` dan warna teks yang sesuai.
- [x] `apps/backoffice/app/(dashboard)/dashboard/_components/offline-branch-widget.tsx` -- Sesuaikan warna tabel dan badge status agar kontras di Dark Mode (gunakan opacity atau varian warna yang lebih tenang).

**Acceptance Criteria:**
- Given aplikasi berjalan di *Light Mode*, when halaman Dashboard dibuka, then semua Card dan Tabel terlihat jelas dengan batas (border) yang tegas.
- Given aplikasi berjalan di *Dark Mode* (simulasi via dev tools atau OS), when halaman Laporan dibuka, then latar belakang menjadi gelap, teks menjadi terang, dan elemen Card tetap memiliki kontras yang baik terhadap background utama.
- Given elemen status (seperti "Online" atau "Offline"), when ditampilkan di Dark Mode, then warna hijau/merah tetap terbaca jelas dan tidak menyilaukan.

## Design Notes

Gunakan palet warna profesional:
- **Light**: Background `#f9fafb` (gray-50), Card `#ffffff`, Border `#e5e7eb` (gray-200).
- **Dark**: Background `#030712` (slate-950), Card `#111827` (slate-900), Border `#1f2937` (slate-800).
- **Foreground**: `gray-900` (Light) / `gray-50` (Dark).

## Verification

**Manual checks:**
- Buka `/dashboard` dan `/reports/profit-loss` di browser.
- Gunakan fitur "Toggle Dark Mode" di browser inspect tool.
- Pastikan tidak ada elemen yang "menghilang" atau memiliki kontras sangat rendah.
