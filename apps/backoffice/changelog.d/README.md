<!-- markdownlint-disable MD013 -->

# changelog.d — potongan changelog

Setiap perubahan (fitur, perbaikan, penghapusan) menulis **satu file baru di direktori ini**,
bukan mengedit `../CHANGELOG.md` langsung.

Alasannya: `CHANGELOG.md` selalu diisi di baris paling atas. Kalau beberapa branch atau agent
bekerja paralel, semuanya menulis di baris yang sama dan setiap merge pasti konflik. Dengan satu
file per pekerjaan, tidak ada dua branch yang menyentuh file yang sama.

## Cara pakai

Nama file = nama branch, tanda `/` diganti `-`:

```
feat/laporan-kas   →  changelog.d/feat-laporan-kas.md
harden-po-payables →  changelog.d/harden-po-payables.md
```

Isinya langsung heading section, tanpa heading versi:

```markdown
### Fixed
- **Ringkasan satu kalimat yang berdiri sendiri.** Penjelasannya di sini.
  - Detail tambahan sebagai sub-bullet.

### Added
- **Hal baru yang bisa dipakai pengguna.** Penjelasan.
```

Aturan:

- Section yang boleh hanya `### Added`, `### Changed`, `### Fixed`, `### Removed`.
- **Jangan** tulis `## [x.y.z] - tanggal` — nomor versi ditentukan saat rilis, bukan saat menulis.
- Tulis dalam Bahasa Indonesia.
- Satu file boleh berisi beberapa section.

## Saat rilis

```bash
pnpm changelog:release 1.95.0     # atau: patch | minor | major
pnpm changelog:release patch --dry-run
```

Skrip menggabungkan semua potongan ke satu entry versi baru di `../CHANGELOG.md`, mengurutkan
section (Added → Changed → Fixed → Removed), lalu menghapus file potongannya.

`pnpm changelog:check` memvalidasi format semua potongan tanpa mengubah apa pun — dipakai CI.
