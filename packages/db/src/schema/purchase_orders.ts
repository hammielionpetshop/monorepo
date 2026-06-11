import { serial, varchar, integer, timestamp, boolean, text } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { branches } from './branches';
import { suppliers, unitsOfMeasure } from './master';
import { products } from './products';
import { users } from './users';

export const purchaseOrders = petshop.table('purchase_orders', {
  id: serial('id').primaryKey(),
  poNumber: varchar('po_number', { length: 50 }).notNull().unique(),
  poType: varchar('po_type', { length: 20 }).default('EXTERNAL').notNull(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  sourceBranchId: integer('source_branch_id').references(() => branches.id),
  supplierId: integer('supplier_id').references(() => suppliers.id),
  status: varchar('status', { length: 30 }).default('PENDING_APPROVAL').notNull(), // DRAFT, PENDING_APPROVAL, APPROVED, IN_TRANSIT, PARTIALLY_RECEIVED, FULLY_RECEIVED, CANCELLED
  totalAmount: integer('total_amount').notNull(),
  createdById: integer('created_by_id').references(() => users.id).notNull(),
  approvedById: integer('approved_by_id').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  rejectedById: integer('rejected_by_id').references(() => users.id),
  rejectedAt: timestamp('rejected_at'),
  rejectionNote: text('rejection_note'),
  notes: text('notes'),
  targetDeliveryDate: timestamp('target_delivery_date'),
  invoiceNumber: varchar('invoice_number', { length: 100 }),
  invoiceUpdatedAt: timestamp('invoice_updated_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const purchaseOrderItems = petshop.table('purchase_order_items', {
  id: serial('id').primaryKey(),
  poId: integer('po_id').references(() => purchaseOrders.id).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  uomId: integer('uom_id').references(() => unitsOfMeasure.id).notNull(),
  qtyOrdered: integer('qty_ordered').notNull(),
  qtyReceived: integer('qty_received').default(0).notNull(),
  qtyDamaged: integer('qty_damaged').default(0).notNull(),
  unitCost: integer('unit_cost').notNull(),
  invoiceUnitCost: integer('invoice_unit_cost'),
  expiryDate: timestamp('expiry_date'),
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
  totalAmount: integer('total_amount').notNull(),
  paidAmount: integer('paid_amount').default(0).notNull(),
  dueAt: timestamp('due_at'),
  status: varchar('status', { length: 20 }).default('UNPAID').notNull(), // UNPAID, PARTIAL, PAID
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const poReceivingItems = petshop.table('po_receiving_items', {
  id: serial('id').primaryKey(),
  poItemId: integer('po_item_id').references(() => purchaseOrderItems.id).notNull(),
  logId: integer('log_id').references(() => poReceivingLogs.id).notNull(),
  qtyReceived: integer('qty_received').notNull(),
  qtyDamaged: integer('qty_damaged').default(0).notNull(),
  expiryDate: timestamp('expiry_date'),
  note: text('note'),
});

export const supplierPayablePayments = petshop.table('supplier_payable_payments', {
  id: serial('id').primaryKey(),
  payableId: integer('payable_id').references(() => supplierPayables.id).notNull(),
  amount: integer('amount').notNull(),
  method: varchar('method', { length: 20 }).notNull(), // CASH, TRANSFER, CEK
  referenceNumber: varchar('reference_number', { length: 100 }),
  note: text('note'),
  paidById: integer('paid_by_id').references(() => users.id).notNull(),
  paidAt: timestamp('paid_at').defaultNow().notNull(),
});
