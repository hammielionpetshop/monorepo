import { serial, integer, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { branches } from './branches';
import { products } from './products';
import { unitsOfMeasure } from './master';
import { users } from './users';

// Jejak sinkron modal Manajemen Harga (product_uom_costs) dari barang masuk — sekaligus
// antrean tinjauan untuk lompatan modal >= 30% dan usulan pengembalian saat penerimaan PO dibatalkan.
export const productCostSyncs = petshop.table('product_cost_syncs', {
  id: serial('id').primaryKey(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  // PO_RECEIVING | PO_INVOICE | IBT_RECEIVE | STOCK_ADJUSTMENT | PO_REVERSAL
  sourceType: varchar('source_type', { length: 20 }).notNull(),
  sourceId: integer('source_id'),
  sourceRef: varchar('source_ref', { length: 60 }),
  // Modal mentah per satuan masuk — dipakai ulang saat disetujui supaya satuan beli tetap persis
  // (182.500/SAK), bukan hasil bulat per satuan dasar × rasio (182.490).
  sourceUomId: integer('source_uom_id').references(() => unitsOfMeasure.id).notNull(),
  sourceUnitCost: integer('source_unit_cost').notNull(),
  oldCostPerBase: integer('old_cost_per_base'),
  newCostPerBase: integer('new_cost_per_base').notNull(),
  // APPLIED (otomatis) | PENDING | APPROVED | REJECTED | SUPERSEDED
  status: varchar('status', { length: 20 }).notNull(),
  // Waktu barang masuk — pembanding "penerimaan terbaru" untuk koreksi faktur PO lama.
  effectiveAt: timestamp('effective_at').notNull(),
  createdById: integer('created_by_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  resolvedById: integer('resolved_by_id').references(() => users.id),
  resolvedAt: timestamp('resolved_at'),
  resolutionNote: text('resolution_note'),
}, (t) => [
  index('idx_product_cost_syncs_status_branch').on(t.status, t.branchId),
  index('idx_product_cost_syncs_branch_product').on(t.branchId, t.productId, t.effectiveAt),
  index('idx_product_cost_syncs_source').on(t.sourceType, t.sourceId),
]);
