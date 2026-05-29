# Sprint Change Proposal — 2026-05-22

**Generated:** 2026-05-22  
**Workflow:** correct-course  
**Scope Classification:** Minor (additive — no existing stories modified)  
**Status:** Approved

---

## 1. Issue Summary

**Trigger:** Developer (cundus) meminta penambahan fitur-fitur baru ke Web POS setelah Story 10.3 selesai diimplementasi.

**Context:** Epic 9 dan Epic 10 telah memberikan fondasi Web POS yang solid (auth, transaksi, riwayat, void). Namun Web POS masih belum bisa beroperasi mandiri karena kasir tidak bisa membuka/menutup shift dari Web POS — mereka harus tetap bergantung pada Backoffice atau Electron POS (yang sudah di-freeze). Selain itu, ada dua fitur produktivitas (barcode scanner, pemilihan pelanggan) yang signifikan meningkatkan kecepatan kasir.

**Discovery:** Analisis gap antara fitur Electron POS yang sudah ada dan Web POS yang baru dibangun, diperkuat dengan ketersediaan backend API shift yang sudah lengkap.

---

## 2. Impact Analysis

### Epic Impact
- **Epic 9 & 10:** Tidak ada perubahan — semua story sudah `done`
- **Epic 11 (BARU):** Web POS Shift Operations — P0, blocks full operational independence
- **Epic 12 (BARU):** Web POS UX Enhancement — P1, productivity improvements

### Story Impact
Tidak ada story yang dimodifikasi. Hanya penambahan:

| Story | Title | Priority | Blocks |
|-------|-------|----------|--------|
| 11.1 | Buka / Gabung Shift (Shift Gate Screen) | P0 | 11.2, 11.3 |
| 11.2 | Pencatatan Expense Selama Shift | P0 | 11.3 |
| 11.3 | Settlement & Tutup Shift | P0 | — |
| 12.1 | Barcode Scanner Support | P1 | — |
| 12.2 | Pemilihan Pelanggan di Transaksi | P1 | — |

### Artifact Conflicts
- **PRD:** Tidak ada perubahan — fitur baru masuk sebagai extension dari requirements yang sudah ada (operational completeness)
- **Architecture:** Tidak ada perubahan — semua mengikuti pola Epic 9/10 (Next.js route group `(pos)`, Server + Client Components, mobile-first)
- **epics.md:** UPDATED — Epic 11 & 12 ditambahkan ke Epic List dan detailed epic sections
- **sprint-status.yaml:** UPDATED — Epic 11 & 12 + semua story-nya ditambahkan dengan status `backlog`

### Technical Impact
- Semua backend API shift sudah tersedia (`/api/pos/shifts/*`)
- API customers sudah tersedia (`/api/customers`)
- Zero new dependencies untuk Epic 11 (pure UI)
- Zero new dependencies untuk Epic 12 (Web API native untuk barcode)
- Risiko regresi: minimal — additive changes only

---

## 3. Recommended Approach

**Chosen Path:** Direct Adjustment — tambah Epic 11 & 12 ke backlog tanpa mengubah pekerjaan yang sudah selesai.

**Rationale:**
- Backend sudah siap → effort murni UI, bisa jalan cepat
- Epic 11 adalah P0 operational gate — Web POS tidak bisa fully replace Electron POS tanpa ini
- Epic 12 adalah P1, bisa dikerjakan paralel atau setelah Epic 11
- Pola implementasi identik dengan Epic 9/10 — learning curve minimal

**Urutan Implementasi yang Disarankan:**
1. Epic 11 Story 11.1 (Shift Gate) → prerequisite untuk 11.2 & 11.3
2. Epic 11 Story 11.2 (Expense) → bisa paralel dengan 11.3 setelah 11.1 selesai
3. Epic 11 Story 11.3 (Settlement) → memerlukan 11.1 & 11.2
4. Epic 12 Story 12.1 & 12.2 → bisa paralel, tidak blocking

**Effort Estimate:**
- Epic 11: ~3 stories × 1-2 hari = 3-5 hari
- Epic 12: ~2 stories × 1 hari = 1-2 hari
- Total: ~5-7 hari developer

---

## 4. Detailed Change Proposals

### 4.1 epics.md — Epic List Section

Ditambahkan ke Epic List:

```
### Epic 10: Web POS Advanced Features (P1 — Web POS Continuation)
[sudah ada]

### Epic 11: Web POS Shift Operations (P0 — Operational Gate)
Goal: Kasir dapat membuka, bergabung, mencatat expense, dan menutup shift langsung dari Web POS.
Priority: P0 — Tanpa ini Web POS tidak bisa beroperasi mandiri

### Epic 12: Web POS UX Enhancement (P1 — Productivity)
Goal: Kasir dapat mempercepat transaksi via barcode scanner dan pemilihan pelanggan.
Priority: P1 — Meningkatkan produktivitas operasional
```

### 4.2 epics.md — Detailed Epic Sections

Epic 11 dan Epic 12 dengan BDD acceptance criteria ditambahkan setelah Epic 10 (line 756). Format mengikuti pola Epic 9/10.

### 4.3 sprint-status.yaml — New Backlog Entries

```yaml
# Epic 11: Web POS Shift Operations (P0 — Operational Gate)
  epic-11: backlog
  11-1-web-pos-shift-gate: backlog
  11-2-web-pos-expense-recording: backlog
  11-3-web-pos-settlement: backlog
  epic-11-retrospective: optional

# Epic 12: Web POS UX Enhancement (P1 — Productivity)
  epic-12: backlog
  12-1-web-pos-barcode-scanner: backlog
  12-2-web-pos-customer-selection: backlog
  epic-12-retrospective: optional
```

---

## 5. Implementation Handoff

**Scope:** Minor — additive changes only, no existing work disrupted.

**Next Steps untuk Developer Agent:**
1. Jalankan `create-story 11.1` untuk membuat story file 11-1-web-pos-shift-gate.md
2. Jalankan `dev-story 11.1` untuk implementasi
3. Ulangi untuk 11.2, 11.3, kemudian 12.1 dan 12.2

**Success Criteria:**
- Kasir bisa membuka/menutup shift penuh dari Web POS (Epic 11 done)
- Barcode scanner dan customer selection berfungsi (Epic 12 done)
- Semua story 11.x & 12.x berstatus `done` di sprint-status.yaml
- Electron POS (`apps/pos-desktop`) tidak dimodifikasi

---

*Correct Course workflow complete. Sprint Change Proposal disetujui dan telah diimplementasikan langsung ke artifacts.*
