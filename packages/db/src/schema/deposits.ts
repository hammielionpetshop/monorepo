import { serial, integer, timestamp, varchar, text, date, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { branches } from './branches';
import { users } from './users';
import { shifts } from './shifts';
import { paymentMethods } from './master';
import { moneyPlaces } from './money_places';
import { interBranchPayables, interBranchPayments } from './inter_branch_payables';

/**
 * F2-2 Setoran (spec docs/work/specs/2026-11-08-f2-2-setoran-design.md). Aturan isian dijaga CHECK
 * di migrasi 0056; aturan antar-tabel (shift satu cabang, tujuan bukan Laci) dijaga deposit-service.
 */

/** Setoran Tunai: ≥1 shift utuh satu cabang ke Rekening (setor bank) atau Tunai (mis. Brankas). */
export const cashDeposits = petshop.table('cash_deposits', {
  id: serial('id').primaryKey(),
  /** STN-<kode cabang>-<YYMMDD>-<urut>. */
  depositNumber: varchar('deposit_number', { length: 40 }).notNull().unique(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  destinationMoneyPlaceId: integer('destination_money_place_id').references(() => moneyPlaces.id).notNull(),
  depositDate: date('deposit_date').notNull(),
  reportedAmount: integer('reported_amount').notNull(),
  slipPhotoUrl: text('slip_photo_url'),
  /** POS (tim cabang melapor setor bank) · BACKOFFICE (Finance Terima Setoran, langsung terverifikasi). */
  reportChannel: varchar('report_channel', { length: 12 }).notNull(),
  reportedBy: integer('reported_by').references(() => users.id).notNull(),
  reportedAt: timestamp('reported_at').defaultNow().notNull(),
  /** PENDING · VERIFIED · CANCELLED · CORRECTED (terverifikasi lalu digantikan setoran koreksi). */
  status: varchar('status', { length: 12 }).notNull().default('PENDING'),
  receivedAmount: integer('received_amount'),
  verifiedBy: integer('verified_by').references(() => users.id),
  verifiedAt: timestamp('verified_at'),
  /** Salinan `money_places.held_by` tujuan saat diverifikasi. */
  verifiedHeldBy: varchar('verified_held_by', { length: 10 }),
  notes: text('notes'),
  cancelledBy: integer('cancelled_by').references(() => users.id),
  cancelledAt: timestamp('cancelled_at'),
  cancelReason: varchar('cancel_reason', { length: 255 }),
  correctsDepositId: integer('corrects_deposit_id').references((): AnyPgColumn => cashDeposits.id),
}, (t) => [
  index('idx_cash_deposits_branch_status').on(t.branchId, t.status),
  uniqueIndex('uq_cash_deposits_corrects').on(t.correctsDepositId).where(sql`${t.correctsDepositId} IS NOT NULL`),
]);

/** Shift di dalam setoran. Batal/koreksi mengisi `released_at`; baris tidak dihapus. */
export const cashDepositShifts = petshop.table('cash_deposit_shifts', {
  id: serial('id').primaryKey(),
  depositId: integer('deposit_id').references(() => cashDeposits.id).notNull(),
  shiftId: integer('shift_id').references(() => shifts.id).notNull(),
  cashAmount: integer('cash_amount').notNull(),
  releasedAt: timestamp('released_at'),
}, (t) => [
  uniqueIndex('uq_cash_deposit_shifts_active').on(t.shiftId).where(sql`${t.releasedAt} IS NULL`),
  index('idx_cash_deposit_shifts_deposit').on(t.depositId),
]);

/** Rincian sebab selisih setoran (diterima − Σ kas shift). Jumlah baris = selisih. */
export const cashDepositVariances = petshop.table('cash_deposit_variances', {
  id: serial('id').primaryKey(),
  depositId: integer('deposit_id').references(() => cashDeposits.id).notNull(),
  amount: integer('amount').notNull(),
  /** BANK_FEE biaya setor bank · CASHIER_SHORT kurang dari kasir · CASHIER_OVER lebih dari kasir · OTHER. */
  cause: varchar('cause', { length: 20 }).notNull(),
  shiftId: integer('shift_id').references(() => shifts.id),
  cashierId: integer('cashier_id').references(() => users.id),
  note: varchar('note', { length: 255 }),
}, (t) => [
  index('idx_cash_deposit_variances_deposit').on(t.depositId),
  index('idx_cash_deposit_variances_shift').on(t.shiftId),
]);

/**
 * Verifikasi non-tunai per shift per metode (atau per cabang per hari untuk pelunasan BO tanpa shift).
 * Koreksi = baris baru; baris lama diberi `superseded_at` + `superseded_by_id`.
 */
export const noncashVerifications = petshop.table('noncash_verifications', {
  id: serial('id').primaryKey(),
  shiftId: integer('shift_id').references(() => shifts.id),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  businessDate: date('business_date').notNull(),
  paymentMethodId: integer('payment_method_id').references(() => paymentMethods.id).notNull(),
  expectedAmount: integer('expected_amount').notNull(),
  moneyPlaceId: integer('money_place_id').references(() => moneyPlaces.id).notNull(),
  heldBy: varchar('held_by', { length: 10 }).notNull(),
  /** AWAITING_FUNDS dana belum cair · VERIFIED. */
  status: varchar('status', { length: 16 }).notNull(),
  receivedAmount: integer('received_amount'),
  variance: integer('variance'),
  /** BANK_FEE · AWAITING_FUNDS · CASHIER_INPUT (masuk Minus Kasir) · OTHER. */
  cause: varchar('cause', { length: 20 }),
  /** Kasir yang salah input (opsional; kosong = dibagi porsi kas). */
  cashierId: integer('cashier_id').references(() => users.id),
  note: varchar('note', { length: 255 }),
  verifiedBy: integer('verified_by').references(() => users.id),
  verifiedAt: timestamp('verified_at'),
  createdBy: integer('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  supersededAt: timestamp('superseded_at'),
  supersededById: integer('superseded_by_id').references((): AnyPgColumn => noncashVerifications.id),
}, (t) => [
  uniqueIndex('uq_noncash_verifications_shift').on(t.shiftId, t.paymentMethodId)
    .where(sql`${t.shiftId} IS NOT NULL AND ${t.supersededAt} IS NULL`),
  uniqueIndex('uq_noncash_verifications_bo_day').on(t.branchId, t.businessDate, t.paymentMethodId)
    .where(sql`${t.shiftId} IS NULL AND ${t.supersededAt} IS NULL`),
]);

/** Catatan perpindahan uang (dibaca F2-3/F2-4). Tidak pernah diubah/dihapus (trigger); pembalikan bernilai negatif. */
export const moneyMovements = petshop.table('money_movements', {
  id: serial('id').primaryKey(),
  fromMoneyPlaceId: integer('from_money_place_id').references(() => moneyPlaces.id),
  toMoneyPlaceId: integer('to_money_place_id').references(() => moneyPlaces.id).notNull(),
  amount: integer('amount').notNull(),
  occurredOn: date('occurred_on').notNull(),
  /** CASH_DEPOSIT · NONCASH_VERIFICATION · TRANSFER (F2-4c Pindah Dana, sumber = money_transfers.id). */
  sourceType: varchar('source_type', { length: 30 }).notNull(),
  sourceId: integer('source_id').notNull(),
  reversalOfId: integer('reversal_of_id').unique().references((): AnyPgColumn => moneyMovements.id),
  createdBy: integer('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_money_movements_source').on(t.sourceType, t.sourceId),
  index('idx_money_movements_to').on(t.toMoneyPlaceId, t.occurredOn),
]);

/** Tujuan bawaan setoran tunai per cabang (Rekening atau Tunai, bukan Laci). */
export const cashDepositDefaults = petshop.table('cash_deposit_defaults', {
  branchId: integer('branch_id').references(() => branches.id, { onDelete: 'cascade' }).primaryKey(),
  moneyPlaceId: integer('money_place_id').references(() => moneyPlaces.id).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  updatedBy: integer('updated_by').references(() => users.id),
});

/**
 * F2-3 Pelunasan Otomatis (spec docs/work/specs/2026-11-08-f2-3-pelunasan-otomatis-design.md): satu
 * baris per potongan alokasi setoran terverifikasi. `payableId` kosong = setoran bebas cabang itu.
 * Tidak pernah diubah/dihapus (trigger migrasi 0057); koreksi = baris pembalikan bernilai negatif.
 */
export const depositSettlements = petshop.table('deposit_settlements', {
  id: serial('id').primaryKey(),
  /** CASH_DEPOSIT · NONCASH_VERIFICATION · LEGACY_RUN (F2-3b-2, sumber = legacy_settlement_runs.id). */
  sourceType: varchar('source_type', { length: 30 }).notNull(),
  sourceId: integer('source_id').notNull(),
  /** 1 =cabang penyetor, 2 = pemasoknya, dst. */
  level: integer('level').notNull(),
  parentId: integer('parent_id').references((): AnyPgColumn => depositSettlements.id),
  payerBranchId: integer('payer_branch_id').references(() => branches.id).notNull(),
  payableId: integer('payable_id').references(() => interBranchPayables.id),
  paymentId: integer('payment_id').references(() => interBranchPayments.id),
  amount: integer('amount').notNull(),
  reversalOfId: integer('reversal_of_id').unique().references((): AnyPgColumn => depositSettlements.id),
  createdBy: integer('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_deposit_settlements_source').on(t.sourceType, t.sourceId),
  index('idx_deposit_settlements_payable').on(t.payableId),
]);

/**
 * F2-3b-2 Pelunasan susulan utang lama (spec docs/work/specs/2026-11-08-f2-3b-utang-lama-design.md §4):
 * satu baris per pelaksanaan oleh Owner. Hanya satu `ACTIVE` (indeks unik parsial, migrasi 0058);
 * rinciannya di `deposit_settlements` sumber `LEGACY_RUN`.
 */
export const legacySettlementRuns = petshop.table('legacy_settlement_runs', {
  id: serial('id').primaryKey(),
  fromDate: date('from_date', { mode: 'string' }).notNull(),
  cutoffDate: date('cutoff_date', { mode: 'string' }).notNull(),
  includeNoncash: boolean('include_noncash').notNull(),
  subtractManual: boolean('subtract_manual').notNull(),
  settledAmount: integer('settled_amount').notNull(),
  payablesCount: integer('payables_count').notNull(),
  freeAmount: integer('free_amount').notNull(),
  notes: text('notes').notNull(),
  /** ACTIVE · CANCELLED. */
  status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
  createdBy: integer('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  cancelledBy: integer('cancelled_by').references(() => users.id),
  cancelledAt: timestamp('cancelled_at'),
  cancelReason: text('cancel_reason'),
}, (t) => [
  uniqueIndex('uq_legacy_settlement_runs_active').on(t.status).where(sql`${t.status} = 'ACTIVE'`),
]);
