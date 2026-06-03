# Sprint Change Proposal — Web POS Foundation

**Tanggal:** 2026-05-15
**Author:** Cundus
**Status:** Draft — Menunggu Persetujuan

---

## Section 1: Issue Summary

### Problem Statement

Electron POS (`apps/pos-desktop`) membatasi deployment ke perangkat yang memerlukan instalasi desktop, yang tidak scalable untuk operasional multi-cabang dengan beragam perangkat. Kasir di cabang yang menggunakan tablet atau HP tidak dapat menggunakan sistem POS tanpa PC.

### Konteks Discovery

Inisiatif strategis baru yang muncul setelah selesainya Epic 8 (2026-05-15) — momen yang tepat untuk pivot sebelum memulai sprint baru.

### Keputusan Strategis

Electron POS akan **digantikan jangka panjang** oleh Web POS berbasis browser. V1 difokuskan pada fondasi: autentikasi dan transaksi penjualan dasar.

---

## Section 2: Impact Analysis

### Epic Impact

| Epic | Status Sebelum | Aksi | Alasan |
|------|---------------|------|--------|
| Epic 5 | `in-progress` | → **`done`** (force close) | Hard freeze Electron; retrospective di-skip |
| Epic 6 | `in-progress` | → **`done`** (force close) | Hard freeze Electron; retrospective di-skip |
| Epic 7 | `in-progress` | → **`done`** (konfirmasi) | Semua stories sudah selesai |
| Epic 8 | `done` | Tidak ada perubahan | — |
| **Epic 9 (baru)** | — | Tambah sebagai `backlog` | Web POS Foundation |

### Artifact Conflicts

**PRD (`prd.md`):**
- `classification.projectType` saat ini: `"Desktop App & Web App"`
- Perlu diupdate mencerminkan: `"Web App"` (Web POS + Backoffice, tanpa Desktop)
- Section Executive Summary perlu catatan bahwa Electron POS di-sunset

**Architecture (`architecture.md`):**
- Section `Frontend Architecture` perlu tambahan subseksi Web POS
- ADR baru perlu didokumentasikan (lihat Section 4)

**PRD & Epics tidak konflik secara fungsional** — fitur kasir (transaksi, auth) sudah ada di PRD, hanya client-nya yang berubah dari Electron ke web.

### Technical Impact

- **Tidak ada database migration** — skema PostgreSQL tidak berubah
- **Tidak ada package baru** — Next.js sudah ada di `apps/backoffice`
- **API siap pakai** — `/api/pos/*` sudah production-ready
- **No offline requirement** — menghilangkan kompleksitas Dexie.js / Service Worker

---

## Section 3: Recommended Approach

**Pilihan: Direct Adjustment** — tambah Epic 9 sebagai epic baru, tanpa rollback atau scope reduction.

**Justifikasi:**
- Seluruh infrastruktur server (API, auth, DB) sudah siap
- Next.js sudah ada di monorepo — tidak butuh setup dari nol
- V1 scope sempit (auth + basic transaction) = risiko rendah, delivery cepat
- Hard freeze Electron membebaskan semua kapasitas development

**Effort:** Medium | **Risk:** Low | **Timeline impact:** Tidak ada delay pada deliverable yang sudah committed

---

## Section 4: Detailed Change Proposals

### 4.1 Sprint Status Update

**File:** `_bmad-output/implementation-artifacts/sprint-status.yaml`

```yaml
# SEBELUM
epic-5: in-progress
epic-6: in-progress
epic-7: in-progress

# SESUDAH
epic-5: done
epic-6: done
epic-7: done
# Tambah:
epic-9: backlog
9-1-web-pos-auth: backlog
9-2-web-pos-basic-transaction: backlog
```

### 4.2 Epics File Update

**File:** `_bmad-output/planning-artifacts/epics.md`

Tambah di bagian Epic List:

```markdown
### Epic 9: Web POS Foundation (P0 — Strategic Pivot)
**Goal:** Kasir dapat login dan memproses transaksi penjualan dasar melalui browser
di tablet/HP, sebagai fondasi pengganti Electron POS jangka panjang.
**Priority:** P0 — Inisiatif strategis utama sprint berikutnya
**Stack:** Next.js route group `(pos)` di dalam `apps/backoffice`
**FRs covered:** Transaksi dasar (subset FR2, FR4 — diimplementasi ulang untuk web)
```

### 4.3 Architecture ADRs Baru

**ADR-005: Web POS sebagai route group dalam `apps/backoffice`**
- Keputusan: Web POS diimplementasi sebagai route group `(pos)` di `apps/backoffice`
- Rasional: Auth shared, stack identik, satu deployment, tidak ada duplikasi config
- URL pattern: `/pos/*` untuk kasir, `/bo/*` untuk owner/admin

**ADR-006: Web POS tanpa offline capability**
- Keputusan: Web POS V1 berjalan pure online, tidak ada Service Worker / Dexie.js
- Rasional: Menyederhanakan arsitektur V1; offline dapat ditambahkan di sprint berikutnya jika dibutuhkan
- Konsekuensi: Kasir memerlukan koneksi internet stabil

**ADR-007: Auth Web POS menggunakan HTTP-only Cookie (shared dengan Backoffice)**
- Keputusan: Mekanisme auth identik dengan Backoffice — satu session system
- Rasional: Konsistensi, keamanan (tidak ada JWT di localStorage), reuse middleware

### 4.4 Epic 9 Stories (Draft)

#### Story 9.1: Web POS Authentication

As a Kasir,
I want login ke Web POS menggunakan username dan password,
So that saya bisa mengakses sistem kasir dari tablet atau HP saya.

**Acceptance Criteria:**

**Given** Kasir membuka URL `/pos/login` di browser
**When** mereka memasukkan kredensial yang valid
**Then** sistem mengarahkan mereka ke halaman utama POS (`/pos`)

**Given** Kasir login dengan role `KASIR`
**When** mereka mencoba mengakses halaman Backoffice (`/bo/*`)
**Then** sistem menolak akses dan mengarahkan kembali ke `/pos`

**Given** Kasir yang sudah login menutup browser dan membukanya kembali
**When** mereka mengunjungi `/pos`
**Then** session masih aktif (tidak perlu login ulang) selama cookie belum expired

**Technical Notes:**
- Gunakan auth middleware Next.js yang sudah ada
- Layout Web POS harus mobile/tablet-first (min touch target 44px)
- Halaman `/pos/login` terpisah dari `/bo/login` tapi share komponen form yang sama

---

#### Story 9.2: Web POS Basic Sales Transaction

As a Kasir,
I want mencari produk, memasukkannya ke keranjang, dan menyelesaikan pembayaran,
So that saya dapat melayani pelanggan secara penuh dari perangkat web.

**Acceptance Criteria:**

**Given** Kasir berada di halaman utama POS
**When** mereka mengetik nama atau SKU produk di kolom pencarian
**Then** daftar produk yang cocok muncul dalam waktu < 200ms

**Given** Kasir memilih produk dari hasil pencarian
**When** produk ditambahkan ke keranjang
**Then** keranjang menampilkan item, kuantitas, harga satuan, dan subtotal

**Given** Kasir menekan tombol "Bayar"
**When** metode pembayaran dipilih dan jumlah dimasukkan
**Then** transaksi tersimpan ke server via `POST /api/pos/transactions`
**And** halaman menampilkan konfirmasi transaksi berhasil

**Given** transaksi berhasil
**When** Kasir menekan "Cetak Struk"
**Then** browser membuka print dialog dengan layout struk thermal

**Technical Notes:**
- State keranjang menggunakan Zustand (client component)
- Pencarian produk via `GET /api/pos/products?q=` (API sudah ada)
- Layout: split-view di tablet (produk kiri, keranjang kanan), stacked di mobile
- Tidak ada offline queue — gagal transaksi = tampilkan error, kasir coba ulang

---

## Section 5: Implementation Handoff

### Change Scope: **Major**

Ini adalah perubahan strategis yang mengubah arah jangka panjang proyek — pergantian client POS dari Electron ke Web.

### Handoff Plan

| Role | Tanggung Jawab |
|------|---------------|
| **Developer (Amelia)** | Implementasi Epic 9 stories setelah proposal disetujui |
| **Product Manager (John)** | Update PRD untuk mencerminkan sunset Electron POS |
| **Architect (Winston)** | Update architecture.md dengan ADR-005, ADR-006, ADR-007 |

### Success Criteria

- [ ] Kasir dapat login di `/pos/login` dari browser mobile
- [ ] Kasir dapat memproses transaksi penjualan end-to-end
- [ ] Data transaksi tersimpan ke PostgreSQL via API yang sudah ada
- [ ] Layout responsif dan nyaman digunakan di tablet (768px+) dan HP (375px+)

### Next Steps Setelah Approval

1. Update `sprint-status.yaml` (Epic 5/6/7 → done, Epic 9 → backlog)
2. Update `epics.md` (tambah Epic 9 + stories 9.1 & 9.2)
3. Jalankan `bmad-create-story` untuk Story 9.1
4. Implement dengan `bmad-dev-story`

---

*Dokumen ini di-generate via bmad-correct-course workflow pada 2026-05-15*
