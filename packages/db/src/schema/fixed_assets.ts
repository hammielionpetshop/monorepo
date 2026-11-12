import { serial, integer, timestamp, varchar, date, text, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { branches } from './branches';
import { users } from './users';
import { cashFlowEntries } from './cash_flow';

/**
 * F2-6d-1 Aset & Penyusutan (spec docs/work/specs/2026-11-12-f2-6d-aset-penyusutan-design.md §1): barang tahan lama
 * ≥ Rp1 juta. Pembelian bercermin satu catatan Arus Kas "Beli aset" (Bukan biaya); penyusutan dihitung saat dibaca.
 * Tidak dihapus/diubah (trigger migrasi 0068); hanya pindah keadaan sekali dan batal beralasan.
 */
export const fixedAssets = petshop.table('fixed_assets', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  /** ELECTRONICS | MACHINE | FURNITURE | VEHICLE | LEASEHOLD_IMPROVEMENT */
  assetType: varchar('asset_type', { length: 30 }).notNull(),
  /** Kosong = Kantor (bersama). */
  branchId: integer('branch_id').references(() => branches.id),
  purchasePrice: integer('purchase_price').notNull(),
  purchasedOn: date('purchased_on').notNull(),
  usefulLifeMonths: integer('useful_life_months').notNull(),
  purchaseCashFlowEntryId: integer('purchase_cash_flow_entry_id').references(() => cashFlowEntries.id).notNull(),
  proofPhotoUrl: text('proof_photo_url'),
  note: text('note'),
  /** IN_USE | DAMAGED | LOST | SOLD */
  status: varchar('status', { length: 10 }).default('IN_USE').notNull(),
  disposedOn: date('disposed_on'),
  disposalReason: text('disposal_reason'),
  saleAmount: integer('sale_amount'),
  saleCashFlowEntryId: integer('sale_cash_flow_entry_id').references(() => cashFlowEntries.id),
  disposedBy: integer('disposed_by').references(() => users.id),
  disposedAt: timestamp('disposed_at'),
  createdBy: integer('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  cancelledAt: timestamp('cancelled_at'),
  cancelledBy: integer('cancelled_by').references(() => users.id),
  cancelReason: text('cancel_reason'),
}, (t) => [
  uniqueIndex('fixed_assets_purchase_entry_unique').on(t.purchaseCashFlowEntryId),
  uniqueIndex('fixed_assets_sale_entry_unique').on(t.saleCashFlowEntryId),
  index('fixed_assets_branch_idx').on(t.branchId),
]);
