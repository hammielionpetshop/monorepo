# Implementation Plan: Phase 3 — Settlement & Expenses

**Tanggal:** 2026-04-18
**Scope:** T-030, T-031, T-032, T-033, T-034, T-035, T-036
**PRD Referensi:** `pos_prd_1/05.6-settlement.md`, `pos_prd_1/05.9-daily-expenses.md`, `pos_prd_1/10-business-rules.md`

---

## Keputusan Desain (Hasil Klarifikasi)

| # | Topik | Keputusan |
|---|-------|-----------|
| D-001 | Shift Number | Auto-increment, **reset setiap hari** (Shift 1 pagi, Shift 2 siang, besok mulai lagi dari 1) |
| D-002 | Manager sebagai kasir | Manager **ikut masuk** sebagai kasir di `assignedCashiers`, transaksinya ikut terhitung di breakdown |
| D-003 | Threshold flag variance | **Semua variance negatif (berapapun)** langsung di-flag — tidak ada toleransi minimum |
| D-004 | Cashier stop | Wajib **tercatat di DB** via tabel `shift_cashier_sessions` |
| D-005 | Seed expense categories | **Belum ada** — wajib ditambahkan ke seed script |
| D-006 | Force close settlement | Tetap **hitung settlement otomatis**, status = `FORCE_CLOSED`, tanpa input real cash dari Manager |

---

## Ringkasan Fitur

Phase 3 membangun sistem shift dan settlement multi-kasir:

- **T-030** — Manager buka shift, kasir join
- **T-031** — Multi-kasir bersamaan dalam 1 shift (2–3 kasir, termasuk Manager)
- **T-032** — Kalkulasi expected cash per kasir secara otomatis
- **T-033** — Input real cash per kasir, hitung dan flag selisih
- **T-034** — Print settlement report multi-kasir (3 rangkap)
- **T-035** — UI input pengeluaran harian dari laci kasir
- **T-036** — Force-close shift oleh Owner/Manager

---

## Gap Analysis

### Yang sudah ada ✅

- Tabel `shifts`, `shift_cashier_breakdown`, `shift_expenses` sudah ada di DB schema
- Tabel `transactions` sudah punya `shiftId`
- `expenseCategories` sudah ada di master schema
- `paymentMethods` dengan `type` (CASH, QRIS, dll) sudah ada
- `node-thermal-printer` sudah terintegrasi (dipakai di struk)

### Yang belum ada / perlu diubah ❌

#### DB Schema
- `transactions` **tidak punya `cashierId`** — kritis untuk kalkulasi per-kasir
- `shifts` kurang kolom: `assignedCashiers`, `shiftNumber`, `targetEndTime`, `totalVariance`, `forceClosedById`, `forceClosedAt`, `settlementNotes`; status belum support `FORCE_CLOSED`
- `shift_cashier_breakdown` **perlu redesign total** — saat ini struktur per payment method per kasir, PRD butuh 1 row per kasir dengan semua total payment di dalamnya
- `shift_expenses` kurang kolom `categoryCustom` untuk input kategori manual
- **Tabel baru `shift_cashier_sessions`** — untuk mencatat kapan kasir join dan stop di dalam shift (D-004)

#### Seed Data
- `expenseCategories` belum di-seed sama sekali (D-005)

#### Backend API
- Tidak ada endpoint `/api/pos/shifts/*` sama sekali

#### POS Desktop
- Tidak ada shift store (`shift-store.ts`)
- Tidak ada komponen UI apapun untuk shift/settlement/pengeluaran
- Tidak ada alur login yang mendeteksi shift aktif

---

## Arsitektur Data Flow

```
Manager buka shift (POST /shifts) → shiftNumber = jumlah shift hari ini + 1
        ↓
Shift OPEN disimpan di DB dengan assignedCashiers[] (termasuk Manager)
        ↓
Kasir/Manager login → GET /shifts/active → tampil "Join Shift"
POST /shifts/:id/join → insert shift_cashier_sessions (joined_at, status=ACTIVE)
        ↓
Kasir mulai bertransaksi → setiap transaksi menyimpan cashierId + shiftId
Kasir input pengeluaran (POST /shifts/:id/expenses)
        ↓
Kasir stop → POST /shifts/:id/stop → update shift_cashier_sessions (stopped_at, status=STOPPED)
        ↓
Manager klik Settlement → GET /shifts/:id/breakdown
→ sistem aggregate transactions per cashier per payment type
→ hitung expected cash per kasir
→ cek variance: jika variance < 0 → otomatis flag (berapapun)
        ↓
Manager input real cash per kasir
POST /shifts/:id/settle → simpan breakdown, tutup shift (CLOSED)
        ↓
Print settlement report (thermal printer, 3x)

--- (Alternatif) ---

Owner force close → POST /shifts/:id/force-close
→ breakdown dihitung otomatis, real cash TIDAK diinput
→ status = FORCE_CLOSED
```

---

## File yang Terdampak

| No | File | Jenis Perubahan |
|----|------|-----------------|
| 1 | `packages/db/src/schema/transactions.ts` | Tambah `cashierId` |
| 2 | `packages/db/src/schema/shifts.ts` | Update `shifts` + redesign `shiftCashierBreakdown` + update `shiftExpenses` + **tambah tabel baru `shiftCashierSessions`** |
| 3 | `packages/db/migrations/XXXX_phase3_shift_settlement.sql` | Migration baru |
| 4 | `packages/db/src/seed/expense-categories.ts` | **Seed baru** untuk 7 kategori pengeluaran default |
| 5 | `packages/shared/src/types/shift.ts` | Buat file types baru |
| 6 | `apps/backoffice/app/api/pos/shifts/route.ts` | Buat: open shift, list active |
| 7 | `apps/backoffice/app/api/pos/shifts/[id]/join/route.ts` | Buat: kasir join shift |
| 8 | `apps/backoffice/app/api/pos/shifts/[id]/stop/route.ts` | Buat: kasir stop |
| 9 | `apps/backoffice/app/api/pos/shifts/[id]/breakdown/route.ts` | Buat: kalkulasi breakdown per kasir |
| 10 | `apps/backoffice/app/api/pos/shifts/[id]/settle/route.ts` | Buat: submit real cash + tutup shift |
| 11 | `apps/backoffice/app/api/pos/shifts/[id]/force-close/route.ts` | Buat: force close shift |
| 12 | `apps/backoffice/app/api/pos/shifts/[id]/expenses/route.ts` | Buat: CRUD pengeluaran |
| 13 | `apps/pos-desktop/src/store/shift-store.ts` | Buat: Zustand store untuk shift state |
| 14 | `apps/pos-desktop/src/components/shift/ShiftGateScreen.tsx` | Buat: layar intermediate saat belum ada shift aktif |
| 15 | `apps/pos-desktop/src/components/shift/OpenShiftDialog.tsx` | Buat: dialog Manager buka shift baru |
| 16 | `apps/pos-desktop/src/components/shift/JoinShiftScreen.tsx` | Buat: layar kasir join shift |
| 17 | `apps/pos-desktop/src/components/shift/ExpenseDialog.tsx` | Buat: form input pengeluaran harian |
| 18 | `apps/pos-desktop/src/components/shift/SettlementDialog.tsx` | Buat: dialog multi-step settlement |
| 19 | `apps/pos-desktop/src/components/layout/POSHeader.tsx` | Update: tambah tombol Pengeluaran & Tutup Shift |
| 20 | `apps/pos-desktop/src/pages/POS.tsx` | Update: wrap dengan ShiftGate check |
| 21 | `apps/pos-desktop/src/lib/settlement-printer.ts` | Buat: logic print settlement report |

---

## Detail Perubahan Per File

---

### 1. DB Schema — `packages/db/src/schema/transactions.ts`

Tambah `cashierId` ke tabel `transactions`. Ini **kritis** — tanpa ini tidak bisa kalkulasi per-kasir.

```typescript
// Tambahkan setelah shiftId:
cashierId: integer('cashier_id').references(() => users.id).notNull(),
```

> ⚠️ Breaking change untuk data lama. Migration perlu backfill dari `shifts.openedById`.

---

### 2. DB Schema — `packages/db/src/schema/shifts.ts`

#### Tabel `shifts` — tambah kolom yang kurang:

```typescript
export const shifts = petshop.table('shifts', {
  id: serial('id').primaryKey(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  openedById: integer('opened_by_id').references(() => users.id).notNull(),
  shiftNumber: integer('shift_number').notNull(),                                          // ← TAMBAH (auto, reset harian)
  assignedCashiers: jsonb('assigned_cashiers').notNull(),                                  // ← TAMBAH [userId, userId, ...]
  openingCash: decimal('opening_cash', { precision: 12, scale: 2 }).notNull(),
  targetEndTime: timestamp('target_end_time'),                                             // ← TAMBAH
  status: varchar('status', { length: 20 }).default('OPEN').notNull(),                    // OPEN | CLOSED | FORCE_CLOSED
  openedAt: timestamp('opened_at').defaultNow().notNull(),
  // Settlement:
  closedById: integer('closed_by_id').references(() => users.id),
  closedAt: timestamp('closed_at'),
  totalClosingCashReal: decimal('total_closing_cash_real', { precision: 12, scale: 2 }),
  totalClosingCashExpected: decimal('total_closing_cash_expected', { precision: 12, scale: 2 }),
  totalVariance: decimal('total_variance', { precision: 12, scale: 2 }),                  // ← TAMBAH
  settlementNotes: text('settlement_notes'),                                               // ← TAMBAH
  // Force close:
  forceClosedById: integer('force_closed_by_id').references(() => users.id),              // ← TAMBAH
  forceClosedAt: timestamp('force_closed_at'),                                             // ← TAMBAH
});
```

#### Tabel `shiftCashierBreakdown` — redesign total (1 row per kasir):

```typescript
export const shiftCashierBreakdown = petshop.table('shift_cashier_breakdown', {
  id: serial('id').primaryKey(),
  shiftId: integer('shift_id').references(() => shifts.id).notNull(),
  cashierId: integer('cashier_id').references(() => users.id).notNull(),
  totalSalesCash: decimal('total_sales_cash', { precision: 12, scale: 2 }).default('0').notNull(),
  totalSalesQris: decimal('total_sales_qris', { precision: 12, scale: 2 }).default('0').notNull(),
  totalSalesDebit: decimal('total_sales_debit', { precision: 12, scale: 2 }).default('0').notNull(),
  totalSalesCredit: decimal('total_sales_credit', { precision: 12, scale: 2 }).default('0').notNull(),
  totalSalesDebt: decimal('total_sales_debt', { precision: 12, scale: 2 }).default('0').notNull(),
  totalSales: decimal('total_sales', { precision: 12, scale: 2 }).default('0').notNull(),
  totalTransactions: integer('total_transactions').default(0).notNull(),
  totalExpenses: decimal('total_expenses', { precision: 12, scale: 2 }).default('0').notNull(),
  modalShare: decimal('modal_share', { precision: 12, scale: 2 }),
  expectedCash: decimal('expected_cash', { precision: 12, scale: 2 }),
  realCash: decimal('real_cash', { precision: 12, scale: 2 }),
  variance: decimal('variance', { precision: 12, scale: 2 }),
  isVarianceFlagged: boolean('is_variance_flagged').default(false).notNull(),             // ← variance < 0 → true
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

#### Tabel `shiftExpenses` — update:

```typescript
// Ubah categoryId menjadi nullable:
categoryId: integer('category_id').references(() => expenseCategories.id),  // hapus .notNull()

// Tambahkan setelah categoryId:
categoryCustom: varchar('category_custom', { length: 100 }),
```

#### Tabel baru `shiftCashierSessions` (D-004):

Mencatat kapan tiap kasir join dan stop dalam sebuah shift.

```typescript
export const shiftCashierSessions = petshop.table('shift_cashier_sessions', {
  id: serial('id').primaryKey(),
  shiftId: integer('shift_id').references(() => shifts.id).notNull(),
  cashierId: integer('cashier_id').references(() => users.id).notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  stoppedAt: timestamp('stopped_at'),
  status: varchar('status', { length: 20 }).default('ACTIVE').notNull(), // ACTIVE | STOPPED
});
```

---

### 3. Migration — `packages/db/migrations/XXXX_phase3_shift_settlement.sql`

```sql
-- 1. Tambah cashierId ke transactions
ALTER TABLE petshop.transactions
  ADD COLUMN cashier_id INTEGER REFERENCES petshop.users(id);

UPDATE petshop.transactions t
  SET cashier_id = s.opened_by_id
  FROM petshop.shifts s
  WHERE t.shift_id = s.id AND t.cashier_id IS NULL;

ALTER TABLE petshop.transactions
  ALTER COLUMN cashier_id SET NOT NULL;

-- 2. Update tabel shifts
ALTER TABLE petshop.shifts
  ADD COLUMN shift_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN assigned_cashiers JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN target_end_time TIMESTAMP,
  ADD COLUMN total_closing_cash_real DECIMAL(12,2),
  ADD COLUMN total_variance DECIMAL(12,2),
  ADD COLUMN settlement_notes TEXT,
  ADD COLUMN force_closed_by_id INTEGER REFERENCES petshop.users(id),
  ADD COLUMN force_closed_at TIMESTAMP;

ALTER TABLE petshop.shifts
  RENAME COLUMN expected_cash TO total_closing_cash_expected;

-- 3. Drop & recreate shift_cashier_breakdown
DROP TABLE IF EXISTS petshop.shift_cashier_breakdown;

CREATE TABLE petshop.shift_cashier_breakdown (
  id SERIAL PRIMARY KEY,
  shift_id INTEGER NOT NULL REFERENCES petshop.shifts(id),
  cashier_id INTEGER NOT NULL REFERENCES petshop.users(id),
  total_sales_cash DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_sales_qris DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_sales_debit DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_sales_credit DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_sales_debt DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_sales DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_transactions INTEGER NOT NULL DEFAULT 0,
  total_expenses DECIMAL(12,2) NOT NULL DEFAULT 0,
  modal_share DECIMAL(12,2),
  expected_cash DECIMAL(12,2),
  real_cash DECIMAL(12,2),
  variance DECIMAL(12,2),
  is_variance_flagged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(shift_id, cashier_id)
);

-- 4. Update shift_expenses
ALTER TABLE petshop.shift_expenses
  ADD COLUMN category_custom VARCHAR(100),
  ALTER COLUMN category_id DROP NOT NULL;

-- 5. Tabel baru: shift_cashier_sessions
CREATE TABLE petshop.shift_cashier_sessions (
  id SERIAL PRIMARY KEY,
  shift_id INTEGER NOT NULL REFERENCES petshop.shifts(id),
  cashier_id INTEGER NOT NULL REFERENCES petshop.users(id),
  joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
  stopped_at TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE INDEX idx_cashier_sessions_shift ON petshop.shift_cashier_sessions(shift_id);
CREATE INDEX idx_cashier_sessions_cashier ON petshop.shift_cashier_sessions(cashier_id, status);
```

---

### 4. Seed — `packages/db/src/seed/expense-categories.ts` *(file baru)*

```typescript
import { db } from '../index';
import { expenseCategories } from '../schema/master';

const DEFAULT_CATEGORIES = [
  { name: 'Transport' },       // bensin, parkir, ojek
  { name: 'Konsumsi' },        // makan karyawan
  { name: 'Utilitas' },        // listrik, air, internet
  { name: 'Maintenance' },     // service AC, kebersihan
  { name: 'Supplies' },        // plastik, tisu, ATK
  { name: 'Insentif/Tip' },    // insentif karyawan
  { name: 'Lain-lain' },
];

export async function seedExpenseCategories() {
  await db.insert(expenseCategories)
    .values(DEFAULT_CATEGORIES)
    .onConflictDoNothing();
}
```

---

### 5. Shared Types — `packages/shared/src/types/shift.ts` *(file baru)*

```typescript
export interface Shift {
  id: number;
  branchId: number;
  openedById: number;
  shiftNumber: number;
  assignedCashiers: number[];
  openingCash: number;
  targetEndTime?: Date | null;
  status: 'OPEN' | 'CLOSED' | 'FORCE_CLOSED';
  openedAt: Date;
  closedAt?: Date | null;
  closedById?: number | null;
  totalClosingCashReal?: number | null;
  totalClosingCashExpected?: number | null;
  totalVariance?: number | null;
  settlementNotes?: string | null;
  forceClosedById?: number | null;
  forceClosedAt?: Date | null;
}

export interface ShiftCashierBreakdown {
  cashierId: number;
  cashierName: string;
  totalSalesCash: number;
  totalSalesQris: number;
  totalSalesDebit: number;
  totalSalesCredit: number;
  totalSalesDebt: number;
  totalSales: number;
  totalTransactions: number;
  totalExpenses: number;
  modalShare: number;
  expectedCash: number;
  realCash?: number | null;
  variance?: number | null;
  isVarianceFlagged: boolean;     // true jika variance < 0
}

export interface ShiftBreakdownSummary {
  shift: Shift;
  breakdowns: ShiftCashierBreakdown[];
  totalExpectedCash: number;
  totalRealCash?: number;
  totalVariance?: number;
}

export interface ShiftCashierSession {
  id: number;
  shiftId: number;
  cashierId: number;
  joinedAt: Date;
  stoppedAt?: Date | null;
  status: 'ACTIVE' | 'STOPPED';
}

export interface ShiftExpense {
  id: number;
  shiftId: number;
  cashierId: number;
  cashierName?: string;
  categoryId?: number | null;
  categoryName?: string | null;
  categoryCustom?: string | null;
  amount: number;
  note: string;
  proofImage?: string | null;
  createdAt: Date;
}
```

---

### 6. API — `POST /api/pos/shifts` — Buka shift baru

Request body:
```typescript
{
  branchId: number;
  openingCash: number;           // default 200000
  assignedCashiers: number[];    // wajib include Manager sendiri jika ikut transaksi
  targetEndTime?: string;
}
```

Logic:
1. Cek role: MANAGER atau OWNER
2. Cek tidak ada shift OPEN lain di branch yang sama
3. **Hitung `shiftNumber`**: `COUNT(shifts WHERE branch_id = branchId AND DATE(opened_at) = TODAY) + 1`
4. Insert shifts → return shift data

---

### 7. API — `GET /api/pos/shifts/active?branchId=1`

Return shift yang statusnya `OPEN` untuk branch. Dipakai saat login untuk detect apakah ada shift yang bisa di-join.

---

### 8. API — `POST /api/pos/shifts/:id/join` — Kasir join shift

Logic:
1. Cek shift masih `OPEN`
2. Cek `cashierId` ada di `assignedCashiers`
3. **Insert ke `shift_cashier_sessions`**: `{ shiftId, cashierId, joinedAt: NOW(), status: 'ACTIVE' }`
4. Return shift data

---

### 9. API — `POST /api/pos/shifts/:id/stop` — Kasir stop kerja

Logic:
1. Cek ada session `ACTIVE` untuk cashier ini di shift ini
2. **Update `shift_cashier_sessions`**: `stoppedAt = NOW(), status = 'STOPPED'`
3. Shift tetap `OPEN` (kasir lain masih bisa jalan)

---

### 10. API — `GET /api/pos/shifts/:id/breakdown` — Kalkulasi breakdown per kasir

Logic kalkulasi untuk setiap cashier di `assignedCashiers`:

```
1. Query transactions WHERE shift_id = :id AND cashier_id = kasirIni
2. JOIN transaction_payments, pisah per type:
   - payment_methods.type = 'CASH'   → totalSalesCash
   - payment_methods.type = 'QRIS'   → totalSalesQris
   - payment_methods.type = 'DEBIT'  → totalSalesDebit
   - payment_methods.type = 'CREDIT' → totalSalesCredit
   - payment_methods.type = 'DEBT'   → totalSalesDebt
3. totalSales = sum semua
4. totalTransactions = COUNT(transactions)
5. totalExpenses = SUM(shift_expenses WHERE cashier_id = kasirIni)
6. modalShare = FLOOR(openingCash / jumlah_assignedCashiers)
7. expectedCash = modalShare + totalSalesCash - totalExpenses
8. isVarianceFlagged = (variance !== null && variance < 0)
```

---

### 11. API — `POST /api/pos/shifts/:id/settle` — Submit settlement & tutup shift

Request body:
```typescript
{
  cashierInputs: Array<{
    cashierId: number;
    realCash: number;
  }>;
  settlementNotes?: string;
}
```

Logic:
1. Cek shift masih `OPEN`
2. Cek role: MANAGER atau OWNER
3. Cek semua kasir di `assignedCashiers` sudah punya session `STOPPED` (tidak ada yang masih `ACTIVE`)
   - Jika masih ada yang `ACTIVE` → return error: `"Kasir [nama] masih aktif"`
4. Recalculate breakdown (sama seperti GET breakdown)
5. Hitung variance per kasir: `variance = realCash - expectedCash`
6. Set `isVarianceFlagged = variance < 0` (D-003)
7. Upsert `shift_cashier_breakdown` untuk setiap kasir
8. Update `shifts`: `status = 'CLOSED'`, `closedAt`, `closedById`, `totalClosingCashReal`, `totalClosingCashExpected`, `totalVariance`, `settlementNotes`
9. Return full breakdown untuk print

---

### 12. API — `POST /api/pos/shifts/:id/force-close` — Force close shift

Request body:
```typescript
{ reason: string }
```

Logic:
1. Cek role: OWNER saja
2. **Hitung breakdown otomatis** (sama seperti GET breakdown) — tanpa input real cash
3. Upsert `shift_cashier_breakdown` dengan `realCash = null`, `variance = null`
4. Update `shifts`: `status = 'FORCE_CLOSED'`, `forceClosedById`, `forceClosedAt`, `settlementNotes = reason`

---

### 13. API — `POST /api/pos/shifts/:id/expenses` — Input pengeluaran

Request body:
```typescript
{
  cashierId: number;
  categoryId?: number;
  categoryCustom?: string;   // wajib jika categoryId null
  amount: number;
  note: string;              // wajib
  proofImage?: string;
}
```

Validasi: `categoryId` ATAU `categoryCustom` wajib ada salah satu.

---

### 14. Shift Store — `apps/pos-desktop/src/store/shift-store.ts` *(file baru)*

```typescript
import { create } from 'zustand';
import { Shift } from '@petshop/shared';

interface ShiftState {
  activeShift: Shift | null;
  activeCashierId: number | null;
  isShiftLoading: boolean;
  setActiveShift: (shift: Shift | null) => void;
  setActiveCashier: (cashierId: number | null) => void;
  setShiftLoading: (loading: boolean) => void;
  clearShift: () => void;
}

export const useShiftStore = create<ShiftState>((set) => ({
  activeShift: null,
  activeCashierId: null,
  isShiftLoading: false,
  setActiveShift: (shift) => set({ activeShift: shift }),
  setActiveCashier: (cashierId) => set({ activeCashierId: cashierId }),
  setShiftLoading: (loading) => set({ isShiftLoading: loading }),
  clearShift: () => set({ activeShift: null, activeCashierId: null }),
}));
```

---

### 15. UI — `ShiftGateScreen.tsx`

State machine setelah login:

```
Login success
    ↓
GET /shifts/active?branchId=X
    ├── Tidak ada shift OPEN
    │   ├── Role MANAGER / OWNER → tampil tombol "Buka Shift Baru" → OpenShiftDialog
    │   └── Role CASHIER         → tampil "Belum ada shift, hubungi Manager"
    └── Ada shift OPEN
        ├── User ada di assignedCashiers → tampil JoinShiftScreen
        └── User tidak ada              → tampil "Kamu tidak ditugaskan di shift ini"
```

---

### 16. UI — `OpenShiftDialog.tsx`

Form untuk Manager/Owner buka shift. Field:
- **Modal Awal** — number input, default Rp 200.000
- **Kasir yang Ditugaskan** — multi-select dari daftar user role CASHIER + Manager sendiri
- **Target Selesai** — time picker (optional)

Shift number **tidak ditampilkan ke user** — dihitung otomatis di backend.

Setelah submit → `POST /api/pos/shifts` → `setActiveShift()` di store → masuk ke POS.

---

### 17. UI — `JoinShiftScreen.tsx`

Layar konfirmasi untuk kasir/manager. Tampilkan:
- Shift #X, waktu mulai, modal awal
- Daftar kasir yang ditugaskan
- Siapa saja yang sudah join (dari `shift_cashier_sessions` status ACTIVE)
- Tombol "Mulai Kerja"

Setelah klik → `POST /api/pos/shifts/:id/join` → `setActiveCashier()` di store → masuk ke POS.

---

### 18. UI — `ExpenseDialog.tsx`

Form input pengeluaran harian. Field:
- **Kategori** — dropdown dari `expenseCategories` (7 default) + opsi "Lainnya..."
- Jika "Lainnya" dipilih → muncul text input untuk ketik kategori manual
- **Nominal** — number input
- **Keterangan** — text input (wajib)
- **Bukti** — file upload (optional)

Setelah submit → `POST /api/pos/shifts/:id/expenses`.

---

### 19. UI — `SettlementDialog.tsx`

Dialog multi-step untuk Manager/Owner:

**Step 1 — Review Breakdown**
- `GET /api/pos/shifts/:id/breakdown`
- Cek semua kasir status STOPPED — jika ada yang ACTIVE, tampilkan warning dan blokir lanjut
- Tabel per kasir: Cash, QRIS, Debit, Kredit, Piutang, Total Penjualan, Pengeluaran, Modal Share, Expected Cash
- Total shift di bagian bawah
- Tombol "Lanjut"

**Step 2 — Input Real Cash**
- Per kasir: input "Cash Real (Rp)"
- Live hitung selisih: `variance = realCash - expectedCash`
- Jika `variance < 0` → row highlight merah + badge "⚠️ Selisih Kurang" (D-003: flag semua variance negatif)
- Jika `variance >= 0` → row highlight hijau
- Tombol "Konfirmasi Settlement"

**Step 3 — Konfirmasi & Print**
- Summary final semua kasir
- Optional field: catatan settlement
- Tombol "Tutup Shift & Print"
- `POST /api/pos/shifts/:id/settle` → print 3x → `clearShift()` → redirect ke ShiftGateScreen

---

### 20. POSHeader Update

Tambahkan di area kanan header:

```tsx
{/* Tombol Pengeluaran — semua kasir bisa akses */}
<button onClick={() => setShowExpenseDialog(true)}>
  <Receipt className="w-4 h-4" />
  <span className="text-xs">Pengeluaran</span>
</button>

{/* Tombol Tutup Shift — Manager / Owner only */}
{isManagerOrOwner && (
  <button onClick={() => setShowSettlementDialog(true)}>
    <LogOut className="w-4 h-4" />
    <span className="text-xs">Tutup Shift</span>
  </button>
)}

{/* Info shift aktif */}
<span className="text-xs text-neutral-500">
  Shift #{activeShift?.shiftNumber} | {format(activeShift?.openedAt, 'HH:mm')}
</span>
```

---

### 21. POS Page Update — `apps/pos-desktop/src/pages/POS.tsx`

```tsx
useEffect(() => {
  const checkShift = async () => {
    const shift = await fetchActiveShift(branchId);
    if (!shift) navigate('/shift-gate');
    else setActiveShift(shift);
  };
  checkShift();
}, []);
```

Setiap transaksi dibuat: sertakan `cashierId` dari `useShiftStore().activeCashierId` di request body ke API transaksi.

---

### 22. Settlement Printer — `apps/pos-desktop/src/lib/settlement-printer.ts` *(file baru)*

Gunakan `node-thermal-printer`. Format mengikuti template PRD §5.6.4 persis:
- Header: nama toko, tanggal, shift number, jam buka–tutup, nama kasir
- Seksi per kasir: penjualan per payment method, pengeluaran, modal share, expected, real cash, selisih (+ tanda ⚠️ jika flagged)
- Total shift gabungan
- Footer: total cash setor, modal return, 3 baris tanda tangan

Print dipanggil 3x dari `SettlementDialog` setelah settle berhasil.

---

## Urutan Implementasi yang Direkomendasikan

| Urutan | Task | Alasan |
|--------|------|--------|
| 1 | DB Migration + Schema update | Foundation, semua yang lain depends ini |
| 2 | Seed `expenseCategories` | Dibutuhkan sebelum UI expense bisa dipakai |
| 3 | Shared types `shift.ts` | Dibutuhkan oleh API dan frontend |
| 4 | API: `POST /shifts`, `GET /shifts/active` | Dibutuhkan untuk buka shift |
| 5 | API: `POST /shifts/:id/join`, `stop` | Dibutuhkan untuk kasir mulai kerja |
| 6 | Shift Store | Dibutuhkan oleh semua komponen POS |
| 7 | ShiftGateScreen + OpenShiftDialog + JoinShiftScreen | Alur masuk ke POS |
| 8 | POS.tsx update (cashierId di transaksi) | Dibutuhkan sebelum data breakdown akurat |
| 9 | API: `POST /shifts/:id/expenses` + `ExpenseDialog` | Bisa paralel dengan no.8 |
| 10 | API: `GET /shifts/:id/breakdown` | Depends data transaksi dengan cashierId |
| 11 | API: `POST /shifts/:id/settle` + `POST /shifts/:id/force-close` | Depends breakdown |
| 12 | SettlementDialog | Depends semua API settlement |
| 13 | Settlement Printer | Bisa paralel dengan no.12 |
| 14 | POSHeader update | Terakhir, setelah semua dialog siap |

---

## Business Rules Ringkasan

| Rule | Detail |
|------|--------|
| Shift dibuka oleh | Manager atau Owner saja |
| Shift number | Auto-increment per hari per branch, reset setiap hari |
| Manager sebagai kasir | Ikut di `assignedCashiers`, breakdown dihitung |
| Modal awal | Shared, dibagi rata ke semua kasir (`FLOOR(openingCash / jumlah_kasir)`) |
| Expected cash per kasir | `modalShare + totalSalesCash - totalExpenses` |
| Flag variance | **Semua variance < 0 di-flag**, berapapun nominalnya |
| Settlement syarat | Semua kasir harus `STOPPED` dulu (tercatat di `shift_cashier_sessions`) |
| Settlement final | FINAL — tidak bisa dibuka ulang |
| Force close | Owner only, breakdown tetap dihitung, real cash tidak diinput |
| Shift estafet | Tidak ada — setiap shift mulai dengan modal fresh |

---

## Edge Cases

- 1 kasir saja → `modalShare = openingCash` penuh
- Manager tidak bertransaksi (hanya buka shift) → boleh tidak masuk `assignedCashiers`, breakdown kosong untuk Manager
- Shift dengan 0 transaksi bisa di-settle (semua 0, variance 0, tidak di-flag)
- Kasir join beberapa kali dalam shift yang sama (keluar-masuk) → boleh, tiap join buat session baru, breakdown aggregate semua transaksinya
- `categoryId` dan `categoryCustom` di expense: salah satu wajib, tidak boleh keduanya null bersamaan
- FLOOR pada pembagian modal: sisa sen tidak dialokasikan (diabaikan)

---

## Out of Scope Phase 3

- Loyalty points saat settlement (Phase 2 — T-022)
- Void transaksi dalam shift (Phase 6 — T-060)
- Piutang customer (Phase 6 — T-063)
- Backoffice view settlement report
