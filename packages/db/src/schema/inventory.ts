import { serial, integer, timestamp, text, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { products } from './products';
import { branches } from './branches';
import { unitsOfMeasure } from './master';
import { users } from './users';

export const productStocks = petshop.table('product_stocks', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id).notNull(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  uomId: integer('uom_id').references(() => unitsOfMeasure.id).notNull(),
  qty: integer('qty').notNull(),
}, (t) => [
  uniqueIndex('product_stocks_product_branch_uniq').on(t.productId, t.branchId),
]);

export const productStockBatches = petshop.table('product_stock_batches', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id).notNull(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  uomId: integer('uom_id').references(() => unitsOfMeasure.id).notNull(), // Purchase UOM
  qtyReceived: integer('qty_received').notNull(),
  qtyRemaining: integer('qty_remaining').notNull(), // In Base UOM for FIFO
  costPrice: integer('cost_price').notNull(), // Cost per Base UOM
  receivedAt: timestamp('received_at').defaultNow().notNull(),
  expiryDate: timestamp('expiry_date'),
}, (t) => [
  index('idx_product_stock_batches_product_branch').on(t.productId, t.branchId),
]);

export const stockAutoBreaks = petshop.table('stock_auto_breaks', {
  id: serial('id').primaryKey(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  fromUomId: integer('from_uom_id').references(() => unitsOfMeasure.id).notNull(), // Big
  toUomId: integer('to_uom_id').references(() => unitsOfMeasure.id).notNull(), // Small
  qtyBroken: integer('qty_broken').notNull(), // Qty of Big
  qtyGained: integer('qty_gained').notNull(), // Qty of Small
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const stockAdjustments = petshop.table('stock_adjustments', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id).notNull(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  adjustedById: integer('adjusted_by_id').references(() => users.id).notNull(),
  previousQty: integer('previous_qty').notNull(),
  newQty: integer('new_qty').notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
