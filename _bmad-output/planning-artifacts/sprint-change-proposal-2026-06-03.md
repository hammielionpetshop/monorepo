# Sprint Change Proposal — 2026-06-03

**Proyek:** hammielion-monorepo
**Dibuat oleh:** Cundus (via bmad-correct-course)
**Tanggal:** 2026-06-03
**Status:** Disetujui

---

## 1. Ringkasan Masalah

Setelah Epic 12 selesai, dua gap operasional teridentifikasi yang menyebabkan friction harian bagi kasir:

1. **Tidak ada navigasi Backoffice → POS** — Kasir harus mengetik URL `/pos` secara manual karena tidak ada link dari sidebar Backoffice.
2. **Kasir tidak bisa buka shift sendiri** — Business rule di Story 11.1 membatasi pembukaan shift hanya untuk role MANAGER/OWNER/GM. Kasir dengan role `KASIR` harus menunggu Manager hadir sebelum bisa memulai operasional.
3. **Tidak ada menu shift di Web POS** — Settlement page sudah ada di `/pos/settlement` tapi tidak terhubung ke navigasi POS. Kasir tidak tahu cara aksesnya selain hafal URL.

---

## 2. Analisis Dampak

### Epic Impact
- **Epic 11 (done):** Business rule di Story 11.1 (`canOpenShift`) perlu diubah via story baru — tidak perlu rollback story lama.
- **Epic 13 (baru):** Ditambahkan untuk menampung 3 story perbaikan.

### Story Impact
| Story | Tipe | File Terdampak |
|-------|------|----------------|
| 13.1 Link POS Sidebar | Baru | `(dashboard)/layout.tsx` |
| 13.2 Kasir Buka Shift | Baru (ubah business rule) | `shift-gate-client.tsx` |
| 13.3 Menu Shift POS | Baru | `pos-nav-tabs.tsx`, new `shift/page.tsx`, new `shift-dashboard-client.tsx` |

### Artifact yang Diperbarui
- `epics.md` — Epic 13 ditambahkan (list + detail)
- `sprint-status.yaml` — Epic 13 + 3 story ditambahkan dengan status `backlog`

### Dampak Teknis
- Tidak ada perubahan database atau schema
- Tidak ada perubahan API
- Semua perubahan di layer UI/frontend Next.js
- Semua component yang di-reuse sudah tersedia (`ExpenseDialog`, `/pos/settlement`)

---

## 3. Pendekatan yang Direkomendasikan

**Direct Adjustment** — tambah epic baru tanpa mempengaruhi pekerjaan yang sudah selesai.

Story 13.1 dan 13.2 sangat kecil (masing-masing < 1 jam implementasi). Story 13.3 moderat (buat halaman + component baru tapi reuse semua logic yang ada).

**Estimasi effort:**
- 13.1: XS — satu blok `<a>` di sidebar
- 13.2: XS — satu baris kode (`canOpenShift = true`)
- 13.3: S — halaman baru + component dashboard shift

---

## 4. Detail Perubahan

### 4.1 `epics.md` — Tambah Epic 13

**Tambahan di Epic List:**
```markdown
### Epic 13: Web POS Accessibility & Shift Self-Service (P1 — Operasional)
**Goal:** Kasir dapat mengakses Web POS langsung dari sidebar Backoffice, membuka shift sendiri
tanpa bergantung pada Manager, dan memiliki menu dedicated shift di POS untuk navigasi expense
dan settlement.
**Priority:** P1 — Menghilangkan friction operasional harian kasir
```

**Detail story ditambahkan di bagian bawah file** (Story 13.1, 13.2, 13.3 lengkap dengan AC dan Technical Notes).

### 4.2 `sprint-status.yaml` — Tambah Epic 13

```yaml
epic-13: backlog
13-1-backoffice-pos-nav-link: backlog
13-2-kasir-buka-shift-sendiri: backlog
13-3-menu-shift-web-pos: backlog
epic-13-retrospective: optional
```

### 4.3 Story 13.2 — Perubahan Business Rule

```typescript
// shift-gate-client.tsx
// OLD:
const canOpenShift = ['OWNER', 'GM', 'MANAGER'].includes(userRole)

// NEW:
const canOpenShift = true
```

---

## 5. Handoff Implementasi

**Scope:** Minor — dapat langsung diimplementasikan oleh Developer agent.

**Urutan implementasi yang disarankan:**
1. **13.1** (paling kecil, isolated, zero risk)
2. **13.2** (satu baris perubahan, zero risk)
3. **13.3** (buat halaman + component baru)

**Next step:** Jalankan `bmad-create-story` untuk membuat story file 13.1 dan mulai implementasi.

---

## Kriteria Sukses

- [ ] Link "Web POS" muncul di sidebar Backoffice dan navigasi berfungsi
- [ ] Kasir dengan role `KASIR` dapat membuka shift baru tanpa bantuan Manager
- [ ] Tab "Shift" muncul di nav POS dan menampilkan info shift aktif, tombol expense, dan tombol settlement
- [ ] Semua fitur POS yang sudah ada (transaksi, history, void, settlement) tidak terganggu
