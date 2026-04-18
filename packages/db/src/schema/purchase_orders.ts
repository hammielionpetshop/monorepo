import { serial, varchar, integer, decimal, timestamp, boolean, text } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { branches } from './branches';
import { suppliers, unitsOfMeasure } from './master';
import { products } from './products';
import { users } from './users';

export const purchaseOrders = petshop.table('purchase_orders', {
  id: serial('id').primaryKey(),
  poNumber: varchar('po_number', { length: 50 }).notNull().unique(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  supplierId: integer('supplier_id').references(() => suppliers.id).notNull(),
  status: varchar('status', { length: 30 }).default('PENDING_APPROVAL').notNull(), // PENDING_APPROVAL, APPROVED, IN_TRANSIT, COMPLETED, CANCELLED
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const purchaseOrderItems = petshop.table('purchase_order_items', {
  id: serial('id').primaryKey(),
  poId: integer('po_id').references(() => purchaseOrders.id).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  uomId: integer('uom_id').references(() => unitsOfMeasure.id).notNull(),
  qtyOrdered: decimal('qty_ordered', { precision: 10, scale: 2 }).notNull(),
  qtyReceived: decimal('qty_received', { precision: 12, scale: 2 }).default('0').notNull(),
  unitCost: decimal('unit_cost', { precision: 12, scale: 2 }).notNull(),
});

export const poReceivingLogs = petshop.table('po_receiving_logs', {
  id: serial('id').primaryKey(),
  poId: integer('po_id').references(() => purchaseOrders.id).notNull(),
  receivedById: integer('received_by_id').references(() => users.id).notNull(),
  receivedAt: timestamp('received_at').defaultNow().notNull(),
  invoiceReceived: boolean('invoice_received').default(false).notNull(),
  photoUrls: text('photo_urls'), // JSON array of strings
  note: text('note'),
});

export const supplierPayables = petshop.table('supplier_payables', {
  id: serial('id').primaryKey(),
  poId: integer('po_id').references(() => purchaseOrders.id).notNull(),
  supplierId: integer('supplier_id').references(() => suppliers.id).notNull(),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  paidAmount: decimal('paid_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  dueAt: timestamp('due_at'),
  status: varchar('status', { length: 20 }).default('UNPAID').notNull(), // UNPAID, PARTIAL, PAID
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
