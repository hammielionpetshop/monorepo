# Work Documents

Folder ini adalah lokasi baku untuk semua dokumen kerja aktif yang dipakai selama discovery, perencanaan, dan eksekusi.

Entry point tercepat untuk sesi baru adalah `docs/work/WIP.md`.

## Struktur Baku

- `docs/work/backlog/`
  Semua backlog kerja aktif, ide tertriage, deferred item, dan daftar pekerjaan yang siap diprioritaskan.
- `docs/work/plans/`
  Semua implementation plan, milestone plan, dan rencana eksekusi yang sudah cukup konkret untuk dikerjakan.
- `docs/work/specs/`
  Semua dokumen desain, technical spec, dan proposal solusi sebelum implementasi.
- `docs/work/WIP.md`
  Ringkasan status kerja paling mutakhir untuk membantu sesi baru memahami konteks dengan cepat.

## Aturan Penamaan

- Backlog: `YYYY-MM-DD-<slug>.md`
- Plan: `YYYY-MM-DD-<slug>.md`
- Spec/desain: `YYYY-MM-DD-<slug>-design.md`

Jika nama lama sudah telanjur dipakai dan masih jelas, pertahankan nama file agar histori tetap mudah dilacak.

## Aturan Penggunaan

- Semua dokumen kerja baru wajib dibuat di bawah `docs/work/`.
- Jangan buat backlog, plan, atau spec baru di root `docs/`.
- Folder legacy `docs/superpowers/` tidak dipakai lagi untuk dokumen kerja aktif.
- Dokumen referensi jangka panjang seperti PRD, arsitektur, maturity assessment, dan tracker historis tetap boleh berada di luar `docs/work/`.
- Artefak lokal seperti `_bmad-output/` bukan sumber kebenaran repo dan tidak dipakai sebagai lokasi dokumen versioned.

## Panduan Ringkas

- Punya ide atau pekerjaan baru: simpan di `docs/work/backlog/`
- Sudah tahu desain solusi: simpan di `docs/work/specs/`
- Sudah siap memecah langkah implementasi: simpan di `docs/work/plans/`
