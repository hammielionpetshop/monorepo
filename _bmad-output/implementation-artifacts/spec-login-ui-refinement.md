---
title: 'Login UI Refinement (Premium & Dark Mode)'
type: 'feature'
created: '2026-05-03T03:26:00+07:00'
status: 'in-progress'
baseline_commit: '74d90b58e86e9b8f749ab7320efb9b2245fe814c'
context: ['_bmad-output/project-context.md', '_bmad-output/implementation-artifacts/spec-ui-contrast-refinement.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Halaman Login saat ini memiliki tampilan yang terlalu sederhana dan tidak konsisten dengan tema premium yang baru diimplementasikan, serta tidak mendukung *Dark Mode* karena penggunaan warna *hardcoded*.

**Approach:** Merefaktor halaman login agar menggunakan variabel CSS semantik (`bg-background`, `bg-card`, `text-foreground`, `bg-primary`) dan menambahkan sentuhan desain premium seperti bayangan halus, tipografi yang lebih baik, dan layout yang lebih seimbang.

## Boundaries & Constraints

**Always:**
- Gunakan variabel CSS semantik yang didefinisikan di `globals.css`.
- Pertahankan fungsionalitas form login (email/password dan integrasi API).
- Gunakan warna *Brand* (Amber) untuk tombol utama dan aksen branding.

**Ask First:**
- Penambahan gambar latar belakang atau ilustrasi jika diperlukan.

**Never:**
- Jangan mengubah endpoint API `/api/auth/login`.
- Jangan menggunakan library UI eksternal baru jika bisa diselesaikan dengan Tailwind dan variabel CSS yang ada.

</frozen-after-approval>

## Code Map

- `apps/backoffice/app/(auth)/login/page.tsx` -- Komponen utama halaman login yang akan direfaktor.

## Tasks & Acceptance

**Execution:**
- [x] `apps/backoffice/app/(auth)/login/page.tsx` -- Update struktur HTML dan class Tailwind agar menggunakan variabel semantik. Tambahkan elemen branding "Hammielion".

**Acceptance Criteria:**
- Given halaman Login dibuka di *Light Mode*, when dilihat, then latar belakang berwarna abu-abu sangat muda dan kartu login berwarna putih bersih dengan bayangan halus.
- Given halaman Login dibuka di *Dark Mode*, when dilihat, then latar belakang menjadi gelap (slate-950) dan kartu login menjadi slate-900 dengan teks putih bersih.
- Given form login diisi, when tombol "Masuk" ditekan, then proses autentikasi tetap berjalan normal seperti sebelumnya.

## Verification

**Manual checks:**
- Buka `/login` di browser.
- Cek tampilan di Light dan Dark mode.
- Lakukan simulasi login untuk memastikan form masih berfungsi.
