# Sprint Change Proposal — 2026-05-21

**Diajukan oleh:** Cundus  
**Tanggal:** 2026-05-21  
**Scope:** Minor — langsung implementasi oleh Developer agent

---

## 1. Issue Summary

Epic 9 (Web POS Foundation) telah selesai dengan 2 story: autentikasi (9.1) dan transaksi dasar (9.2). Kasir kini dapat login dan memproses pembayaran dari browser, namun belum bisa melihat riwayat transaksi atau membatalkan transaksi yang salah.

Fitur-fitur ini sebelumnya sudah ada di Electron POS (Epic 2, 3, 4) tetapi Electron POS di-freeze per 2026-05-15. Web POS perlu membawa fitur lanjutan ini dengan arsitektur pure online (tanpa IndexedDB/offline layer).

---

## 2. Impact Analysis

| Area | Dampak |
|------|--------|
| Epic 9 | Tidak berubah — sudah done |
| Epic 10 | **Baru** — 3 stories ditambahkan |
| PRD | Tidak berubah — FR8-FR16 sudah tercakup |
| Architecture | Tidak berubah — ikuti pola Epic 9 |
| Sprint Status | Tambah epic-10 + 3 story entries |
| Kode | Belum ada — dikerjakan di create-story |

**FR yang di-cover ulang untuk Web POS:**
- FR8, FR12, FR13 → Story 10.1 (History & Reprint)
- FR9, FR10, FR11 → Story 10.2 (Search & Filter)
- FR14, FR15, FR16 → Story 10.3 (Void + Clone to Cart)

---

## 3. Recommended Approach

**Direct Adjustment** — tambah Epic 10 ke epics.md dan sprint-status.yaml. Tidak ada rollback atau perubahan MVP yang diperlukan.

Alasan:
- FRs sudah ada di PRD, hanya perlu diimplementasi ulang untuk Web POS
- Arsitektur Web POS sudah established di Epic 9 — tidak perlu keputusan baru
- Effort tiga story ini independen satu sama lain, bisa dikerjakan berurutan

---

## 4. Perubahan yang Diterapkan

### epics.md
- **FR Coverage Map**: FR8-FR16 diupdate untuk mencantumkan Epic 10 sebagai Web POS implementation
- **Epic 10 ditambahkan** dengan 3 stories:
  - Story 10.1: Web POS Transaction History & Reprint
  - Story 10.2: Web POS History Search & Filter
  - Story 10.3: Web POS Void Transaction (PIN Owner + Clone to Cart)

### sprint-status.yaml
```yaml
epic-10: in-progress
10-1-web-pos-transaction-history: backlog
10-2-web-pos-history-search-filter: backlog
10-3-web-pos-void-transaction: backlog
epic-10-retrospective: optional
```

---

## 5. Implementation Handoff

**Scope: Minor** → Developer agent (`bmad-create-story`)

**Langkah selanjutnya:**
1. Jalankan `/bmad-create-story` → akan auto-pick `10-1-web-pos-transaction-history`
2. Setelah done + code review: create-story lagi → `10-2`
3. Setelah done + code review: create-story lagi → `10-3`

**Success criteria:**
- Kasir dapat melihat daftar transaksi shift aktif di `/pos/history`
- Kasir dapat search/filter transaksi
- Kasir dapat void transaksi dengan PIN Owner dari Web POS
- Clone to Cart berfungsi setelah void berhasil
