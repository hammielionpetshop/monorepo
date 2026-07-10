# WIP

Last updated: 2026-07-10
Owner: repo session state

## Current Focus

- Baseline repo kerja aktif sudah dipusatkan ke `docs/work/`
- Menjaga repo bersih dari artefak lokal/non-source-of-truth
- Menyiapkan triage backlog aplikasi berikutnya setelah housekeeping selesai

## In Progress

### Repo housekeeping

- Dokumen backlog, plan, dan spec aktif sudah dipusatkan ke `docs/work/{backlog,plans,specs}`
- `_bmad-output/` diperlakukan sebagai local-only dan tidak lagi menjadi sumber kebenaran repo
- Artefak lokal root yang tidak relevan untuk version control sudah di-ignore
- Skill lokal `wip-formatting` ditambahkan untuk menjaga format `docs/work/WIP.md` konsisten antar sesi

### Product WIP

- Inisiatif staff dashboard/onboarding sudah bukan kandidat awal; implementasi utamanya sudah lewat beberapa commit sesi sebelumnya dan perlu ditinjau sebagai baseline terbaru
- Kandidat pekerjaan aplikasi berikutnya perlu ditentukan ulang dari backlog aktif yang tersisa
- Sumber konteks backlog staff: `docs/work/backlog/2026-07-08-staff-dashboard-onboarding.md`
- Sumber konteks plan staff: `docs/work/plans/2026-07-08-staff-dashboard-plan.md`

## Next Actions

- Commit housekeeping repo: `.gitignore`, `docs/work/`, penghapusan tracking `_bmad-output`, penghapusan tracking artefak patch/report lokal, dan penambahan skill `.agents/skills/wip-formatting/`
- Setelah baseline repo bersih, audit backlog aktif dan tentukan prioritas implementasi berikutnya
- Jika agent baru butuh konteks cepat, baca file ini lalu `docs/work/README.md`

## Open Decisions

- Belum ada keputusan baru tentang prioritas implementasi setelah housekeeping repo selesai
- `RBAC role-permission editor` tetap ditunda
- `Customer Order Portal` tetap sesudah staff dashboard/onboarding

## Deferred / Parked

- `docs/work/backlog/2026-07-09-rbac-roles-permissions-editor.md`
- `docs/work/backlog/2026-07-08-customer-order-portal.md`
- `docs/work/specs/2026-07-08-customer-order-portal-plan.md`

## Source Of Truth

- Struktur dan aturan dokumen kerja: `docs/work/README.md`
- Backlog aktif: `docs/work/backlog/`
- Plans aktif: `docs/work/plans/`
- Specs aktif: `docs/work/specs/`

## Notes For New Session

- Jangan gunakan `_bmad-output/` sebagai sumber utama status kerja karena sekarang lokal-only
- Untuk pertanyaan "apa WIP sekarang?", baca file ini lebih dulu sebelum menjelajah backlog penuh
