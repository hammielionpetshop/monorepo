# Rencana Implementasi — Owner Approval & Input Barang Rusak

> Dibuat: 2026-07-02
> Scope: `apps/backoffice` (Web POS di `app/pos/` + dashboard). Bukan pos-desktop (Electron).
> Keputusan desain: **Owner Approval = model Hybrid** (PIN owner sync + inbox async). **Barang rusak = kerugian masuk Laporan Laba Rugi saja.**

## Ringkasan Kesiapan (asesmen awal)

Fondasi DB untuk kedua fitur **sudah ada** (tabel sudah ikut migrasi integer 0007). Kekurangan utama di layer aplikasi.

| Fitur | Fondasi DB | API | UI | Integrasi Laporan | Kesiapan |
|---|:-:|:-:|:-:|:-:|:-:|
| Owner Approval | ✅ | ~50% | ❌ | ❌ | ~35% |
| Barang Rusak | ✅ | ~40% (tak aman) | ❌ | ❌ | ~30% |

Temuan penting:
- **Void sync sudah jalan end-to-end** (`VoidPinDialog` → `/api/pos/void/validate-pin` → `/api/pos/transactions/[id]/void`). Restore stok FIFO + audit log OK.
- **Jalur void async setengah jadi**: tabel `void_requests` + status `PENDING_VOID` ada, tapi tak ada endpoint approve/reject & tak ada inbox owner → tabel orphan. `void-request` route tidak set transaksi ke `PENDING_VOID`.
- **Oversell diizinkan diam-diam** (`transaction-service.ts` ~baris 21, stok minus tercatat tanpa kontrol) → perlu gerbang approval.
- **API `pos/damaged-goods` TIDAK ada auth check** — `branchId`/`reportedById` dari body (bisa dipalsukan). Lubang keamanan.
- **P&L (`getProfitLossReport`) belum memperhitungkan kerugian barang rusak.**

---

## 🟢 FITUR 2 — Input Barang Rusak → Laba Rugi (quick win, kerjakan dulu)

DB sudah siap: `damaged_goods`, `damaged_goods_items` (reason RUSAK/EXPIRED/HILANG, lossValue FIFO). **Tanpa migrasi baru.**

### A. Perbaikan keamanan API (wajib)
`apps/backoffice/app/api/pos/damaged-goods/route.ts` — rombak:
- Tambah `verifyAccessToken` (pola cookie standar).
- `branchId` & `reportedById` dari token, bukan body.
- `shiftId` otomatis dari shift OPEN cabang.
- Validasi Zod: `reason ∈ {RUSAK,EXPIRED,HILANG}`, `items[]` (`productId`,`uomId`,`qty>0`), `notes?`.
- Pertahankan FIFO `StockService.deductStock` + hitung `lossValue`.
- Guard: stok kurang untuk barang rusak → tolak (jangan bikin stok minus).
- Tambah handler `GET`: daftar barang rusak shift/cabang aktif.

### B. UI input di Web POS
- NEW `apps/backoffice/app/pos/(authenticated)/barang-rusak/page.tsx` (server: cek shift OPEN, ambil branchId).
- NEW `_components/barang-rusak-client.tsx` (form: cari produk via `/api/products`, pilih UOM, qty, alasan, catatan; submit multi-item; riwayat hari ini + total kerugian).
- NEW `_components/types.ts`.
- Referensi field: `apps/pos-desktop/src/components/damaged/DamagedForm.tsx` (ditulis ulang dengan konvensi Web POS).

### C. Navigasi POS
- `apps/backoffice/components/pos/pos-nav-model.ts` — tambah item `/pos/barang-rusak` (label "Barang Rusak", mobile "Rusak", icon `damaged`).
- `apps/backoffice/components/pos/pos-nav-tabs.tsx` — tambah ikon `damaged` (mis. `PackageX`/`TriangleAlert`) ke `POS_NAV_ICONS` + tipe `PosNavIcon`.

### D. Integrasi Laporan Laba Rugi
- `apps/backoffice/lib/services/report-service.ts`:
  - Query agregat kerugian per cabang & periode dari `damaged_goods` (filter `reportedAt` WIB, `SUM(totalLossValue)`; breakdown per reason opsional).
  - `PLReportItem` + `damagedLoss: string`, `netProfit: string` (`grossProfit − damagedLoss`).
  - `PLReportData` + `totalDamagedLoss`, `totalNetProfit`.
- UI P&L `apps/backoffice/app/(dashboard)/reports/` — kolom "Kerugian Barang Rusak" & "Laba Bersih".
- `apps/backoffice/app/api/bo/reports/profit-loss/export/route.ts` — kolom sama di export.

### E. (Rekomendasi) Riwayat barang rusak di dashboard BO
- NEW `apps/backoffice/app/(dashboard)/reports/damaged-goods/page.tsx` + client.
- NEW `GET /api/bo/damaged-goods/route.ts` (auth, filter tanggal/cabang, role global lihat semua).

### F. CHANGELOG
- `### Added` (input & laporan barang rusak) + `### Fixed` (auth API damaged-goods).

---

## 🟠 FITUR 1 — Owner Approval (Hybrid: PIN sync + inbox async)

### A. Schema baru (approval terpusat)
- NEW `packages/db/src/schema/approvals.ts` — tabel `approval_requests`:
  `id, branchId, type (VOID|OVERSELL|PRICE_OVERRIDE|DAMAGED_HIGH_VALUE|...), status (PENDING|APPROVED|REJECTED), requestById, approvedById?, targetTable?, targetId?, payload (text JSON), reason, resolutionNote?, resolvedAt?, createdAt, updatedAt`.
- `packages/db/src/schema/index.ts` — `export * from './approvals'`.
- NEW migrasi `packages/db/src/migrations/xxxx_approval_requests.sql` (generate via drizzle) → `pnpm db:migrate`.
- `void_requests`: retire — `approval_requests type=VOID` jadi sumber kebenaran; tabel lama disimpan untuk histori.

### B. Service terpusat (inti fitur)
- NEW `apps/backoffice/lib/services/approval-service.ts`:
  - `createRequest({type,branchId,requestById,payload,reason})` (cek duplikat PENDING).
  - `listPending({branchId,isGlobal})`.
  - `approve(id,approverId)` → dispatcher per type: VOID → jalankan logika void (refactor dari `pos/transactions/[id]/void`), OVERSELL → izinkan commit, DAMAGED_HIGH_VALUE → posting barang rusak. Semua 1 transaksi + `auditLogs`.
  - `reject(id,approverId,note)`.
  - Refactor logika void keluar dari route ke fungsi reusable (dipakai sync & async).

### C. API async (inbox)
- NEW `GET /api/bo/approvals/route.ts` (daftar PENDING; OWNER/GM lihat semua, lainnya per cabang).
- NEW `POST /api/bo/approvals/route.ts` (buat pengajuan).
- NEW `POST /api/bo/approvals/[id]/approve/route.ts` & `/reject/route.ts`.
- `apps/backoffice/app/api/bo/transactions/[trxNumber]/void-request/route.ts` — arahkan ke `approval-service.createRequest({type:'VOID'})`; set transaksi `PENDING_VOID`.

### D. API sync (PIN di tempat) — sebagian sudah ada
- `apps/backoffice/app/api/pos/void/validate-pin/route.ts` — generalisasi jadi `POST /api/pos/approvals/validate-pin` (verifikasi PIN owner cabang; logika sudah ada).
- Jalur void sync tetap seperti sekarang.

### E. Gerbang Oversell (titik yang sekarang bocor)
- `apps/backoffice/lib/services/transaction-service.ts` (~baris 21): tambah cek stok. Stok kurang → lempar `OVERSELL_NEEDS_APPROVAL` (+daftar item kurang), jangan commit diam-diam.
- Web POS checkout tangkap sinyal → modal: (a) PIN owner (sync, commit dengan flag override) atau (b) "Ajukan ke Owner" (async → `createRequest type=OVERSELL`).
- Keputusan: kebijakan default (blokir keras vs izinkan-dengan-approval), bisa jadi setting cabang.

### F. UI
- Inbox owner: NEW `apps/backoffice/app/(dashboard)/approvals/page.tsx` + `_components/approvals-client.tsx` (daftar PENDING, detail payload, Setujui/Tolak + catatan).
- Badge BO: `apps/backoffice/app/api/bo/nav-badges/route.ts` — hitung `approval_requests` PENDING → key `/approvals`; tambah ke sidebar.
- Dialog PIN reusable: generalisasi `apps/backoffice/components/pos/void-pin-dialog.tsx` → `approval-pin-dialog.tsx` (dipakai void & oversell).
- Modal oversell: NEW komponen di layar kasir Web POS (referensi Electron `OversellWarningModal.tsx`).

### G. CHANGELOG
- `### Added` (approval terpusat, inbox owner, gerbang oversell) + `### Changed` (void memakai approval_requests).

---

## Urutan eksekusi

| Tahap | Isi | Est. |
|---|---|---|
| 1 | Fitur 2 A–D (fix auth + input POS + integrasi P&L) | Kecil |
| 2 | Fitur 2 E–F (riwayat BO + changelog) | Kecil |
| 3 | Fitur 1 A–B (schema + service + refactor void) | Sedang |
| 4 | Fitur 1 C–D–F (inbox async + PIN reusable + badge) | Sedang |
| 5 | Fitur 1 E (gerbang oversell + modal) | Sedang |

## Titik keputusan (SUDAH DIPUTUSKAN 2026-07-02)
- **Oversell = "Izinkan + catat"** (bukan blokir keras / bukan gerbang approval blocking). Checkout stok minus tetap boleh, tapi direkam/flag untuk ditinjau owner. → Tahap 5 disederhanakan: tak ada modal blokir, cukup pencatatan (`transaction-service.ts` tetap commit, tapi log/flag oversell; opsional buat `approval_requests type=OVERSELL` status informatif untuk visibilitas owner).
- **Barang rusak bernilai tinggi: TIDAK perlu approval.** Tak ada `DAMAGED_HIGH_VALUE`, tak ada ambang.
- Konsekuensi: inti approval blocking hanya **VOID** (inbox async + PIN sync). Fitur 1 mengecil.

## Status
- **Tahap 1 & 2 SELESAI** (Fitur 2 Barang Rusak) — rilis [1.31.0] & [1.32.0]. Entry point input = kartu di hub Produk (`/pos/produk/barang-rusak`), riwayat BO di `/reports/damaged-goods`.
- Berikutnya: Tahap 3 (schema `approval_requests` + service + refactor void jadi fungsi reusable).

## Konsistensi (CLAUDE.md)
- Uang pakai `big.js`, simpan integer. Pesan/label Bahasa Indonesia. Response error `{ error }`. Update `apps/backoffice/CHANGELOG.md` tiap tahap.
