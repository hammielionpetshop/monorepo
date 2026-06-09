import { serial, varchar, integer, timestamp, text, date } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { branches } from './branches';
import { unitsOfMeasure } from './master';
import { products } from './products';
import { users } from './users';

export const interBranchTransfers = petshop.table('inter_branch_transfers', {
  id: serial('id').primaryKey(),
  ibtNumber: varchar('ibt_number', { length: 50 }).notNull().unique(),
  sourceBranchId: integer('source_branch_id').references(() => branches.id).notNull(),
  destinationBranchId: integer('destination_branch_id').references(() => branches.id).notNull(),
  requestedById: integer('requested_by_id').references(() => users.id).notNull(),
  approvedById: integer('approved_by_id').references(() => users.id),
  status: varchar('status', { length: 20 }).default('DRAFT').notNull(),
  totalTransferValue: integer('total_transfer_value').default(0).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const interBranchTransferItems = petshop.table('inter_branch_transfer_items', {
  id: serial('id').primaryKey(),
  transferId: integer('transfer_id').references(() => interBranchTransfers.id, { onDelete: 'cascade' }).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  uomId: integer('uom_id').references(() => unitsOfMeasure.id).notNull(),
  qtyRequested: integer('qty_requested').notNull(),
  qtyShipped: integer('qty_shipped').default(0).notNull(),
  qtyReceived: integer('qty_received').default(0).notNull(),
  costPriceAtTransfer: integer('cost_price_at_transfer').default(0).notNull(),
  expiryDate: date('expiry_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
