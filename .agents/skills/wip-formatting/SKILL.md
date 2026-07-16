---
name: wip-formatting
description: Use when updating or creating docs/work/WIP.md so the current session state stays brief, consistent, and easy for a new agent session to scan first
---

# WIP Formatting

## Overview

Gunakan skill ini saat membuat atau memperbarui `docs/work/WIP.md`.
Tujuannya bukan menulis backlog lengkap, tetapi menjaga satu file ringkas yang memberi agent baru konteks operasional tercepat.

## Required Output Shape

`docs/work/WIP.md` harus selalu memakai urutan section ini:

1. `# WIP`
2. `Last updated`
3. `Owner`
4. `## Current Focus`
5. `## In Progress`
6. `## Next Actions`
7. `## Open Decisions`
8. `## Deferred / Parked`
9. `## Source Of Truth`
10. `## Notes For New Session`

## Writing Rules

- Tulis singkat dan operasional.
- Fokus pada keadaan sekarang, bukan histori panjang.
- Gunakan bullet list datar.
- Sebut path repo yang benar bila menunjuk dokumen sumber.
- Bedakan jelas antara:
  - pekerjaan repo/tooling yang sedang dibereskan
  - pekerjaan produk/aplikasi yang benar-benar jadi prioritas berikutnya
- `Next Actions` harus berisi tindakan konkret terdekat, bukan wishlist umum.
- `Open Decisions` hanya untuk keputusan yang benar-benar belum final.
- `Deferred / Parked` hanya untuk item yang sengaja tidak dikerjakan sekarang.

## Scope Guard

- Jangan salin isi backlog penuh ke `WIP.md`.
- Jangan jadikan `WIP.md` sebagai changelog.
- Jangan menaruh detail teknis implementasi panjang yang lebih cocok di spec atau plan.
- Jangan pakai `_bmad-output/` sebagai source of truth versioned.

## Update Workflow

Saat memperbarui `WIP.md`, lakukan urutan ini:

1. Baca `docs/work/README.md`
2. Baca `docs/work/WIP.md`
3. Baca hanya backlog/plan/spec yang sedang relevan
4. Ringkas status aktual ke format tetap
5. Pastikan `Last updated` mencerminkan tanggal sesi terbaru

## Good WIP Characteristics

- Agent baru bisa paham prioritas dalam kurang dari 1 menit
- Ada satu langkah jelas setelah membaca file
- Tidak perlu membuka 10 dokumen hanya untuk tahu fokus saat ini

## Red Flags

- `WIP.md` lebih terasa seperti backlog penuh
- Tidak ada `Next Actions`
- Prioritas produk dan housekeeping repo tercampur
- Section order berubah-ubah antar sesi
