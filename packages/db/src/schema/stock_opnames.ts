import { serial, varchar, integer, decimal, timestamp, text } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { branches } from './branches';
import { users } from './users';
import { products } from './products';
import { unitsOfMeasure } from './master';

export const stockOpnames = petshop.table('stock_opnames', {
  id: serial('id').primaryKey(),
  soNumber: varchar('so_number', { length: 50 }).notNull().unique(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // DAILY, FULL
  status: varchar('status', { length: 20 }).default('PENDING').notNull(), // PENDING, APPROVED, REJECTED
  createdById: integer('created_by_id').references(() => users.id).notNull(),
  approvedById: integer('approved_by_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

export const stockOpnameItems = petshop.table('stock_opname_items', {
  id: serial('id').primaryKey(),
  soId: integer('so_id').references(() => stockOpnames.id).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  uomId: integer('uom_id').references(() => unitsOfMeasure.id).notNull(),
  systemQty: decimal('system_qty', { precision: 12, scale: 2 }).notNull(),
  physicalQty: decimal('physical_qty', { precision: 12, scale: 2 }).notNull(),
  varianceQty: decimal('variance_qty', { precision: 12, scale: 2 }).notNull(),
  varianceReason: text('variance_reason'),
});
