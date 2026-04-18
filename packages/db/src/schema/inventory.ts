import { serial, integer, decimal, timestamp, varchar } from 'drizzle-orm/pg-core';
import { petshop } from './_schema.js';
import { products } from './products.js';
import { branches } from './branches.js';
import { unitsOfMeasure } from './master.js';

export const productStocks = petshop.table('product_stocks', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id).notNull(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  uomId: integer('uom_id').references(() => unitsOfMeasure.id).notNull(),
  qty: decimal('qty', { precision: 12, scale: 2 }).notNull(),
});

export const productStockBatches = petshop.table('product_stock_batches', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id).notNull(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  uomId: integer('uom_id').references(() => unitsOfMeasure.id).notNull(), // Purchase UOM
  qtyReceived: decimal('qty_received', { precision: 12, scale: 2 }).notNull(),
  qtyRemaining: decimal('qty_remaining', { precision: 12, scale: 2 }).notNull(), // In Base UOM for FIFO
  costPrice: decimal('cost_price', { precision: 12, scale: 2 }).notNull(), // Cost per Base UOM
  receivedAt: timestamp('received_at').defaultNow().notNull(),
  expiryDate: timestamp('expiry_date'),
});

export const stockAutoBreaks = petshop.table('stock_auto_breaks', {
  id: serial('id').primaryKey(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  fromUomId: integer('from_uom_id').references(() => unitsOfMeasure.id).notNull(), // Big
  toUomId: integer('to_uom_id').references(() => unitsOfMeasure.id).notNull(), // Small
  qtyBroken: decimal('qty_broken', { precision: 10, scale: 2 }).notNull(), // Qty of Big
  qtyGained: decimal('qty_gained', { precision: 12, scale: 2 }).notNull(), // Qty of Small
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
