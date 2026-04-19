import { serial, varchar, integer, decimal, timestamp, text, boolean, jsonb } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { branches } from './branches';
import { users } from './users';
import { products } from './products';
import { unitsOfMeasure } from './master';
import { shifts } from './shifts';

export const stockOpnames = petshop.table('stock_opnames', {
  id: serial('id').primaryKey(),
  soNumber: varchar('so_number', { length: 50 }).notNull().unique(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  shiftId: integer('shift_id').references(() => shifts.id),
  type: varchar('type', { length: 20 }).notNull(), // DAILY, FULL
  method: varchar('method', { length: 20 }), // BEST_SELLER, SOLD_TODAY, MANUAL
  status: varchar('status', { length: 20 }).default('PENDING').notNull(), // PENDING, APPROVED, REJECTED
  categoryScope: jsonb('category_scope'), // array of category IDs for FULL SO
  assignedUserIds: jsonb('assigned_user_ids'), // array of user IDs
  skipReason: text('skip_reason'),
  isSkipped: boolean('is_skipped').default(false).notNull(),
  createdById: integer('created_by_id').references(() => users.id).notNull(),
  approvedById: integer('approved_by_id').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  rejectedById: integer('rejected_by_id').references(() => users.id),
  rejectedAt: timestamp('rejected_at'),
  rejectionNote: text('rejection_note'),
  notes: text('notes'),
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
  varianceCostValue: decimal('variance_cost_value', { precision: 15, scale: 2 }), // |varianceQty| × FIFO cost
  varianceCategory: varchar('variance_category', { length: 20 }), // EXPIRED, RUSAK, HILANG, SALAH_INPUT
  varianceReason: text('variance_reason'),
  isRecounted: boolean('is_recounted').default(false).notNull(),
  recountPhysicalQty: decimal('recount_physical_qty', { precision: 12, scale: 2 }),
});
