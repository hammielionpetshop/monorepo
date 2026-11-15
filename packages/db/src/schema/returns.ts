import { uuid, varchar, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { transactions, transactionItems } from './transactions';
import { branches } from './branches';
import { users } from './users';
import { products } from './products';
import { unitsOfMeasure } from './master';

export const returns = petshop.table('returns', {
  id: uuid('id').defaultRandom().primaryKey(),
  returnNumber: varchar('return_number', { length: 50 }).notNull().unique(),
  transactionId: integer('transaction_id').notNull().references(() => transactions.id),
  branchId: integer('branch_id').notNull().references(() => branches.id),
  processedById: integer('processed_by_id').notNull().references(() => users.id),
  reason: text('reason').notNull(),
  totalRefundAmount: integer('total_refund_amount').notNull(),
  // Berapa dari `totalRefundAmount` yang benar-benar dipotongkan ke piutang pelanggan saat
  // retur diproses. Disimpan, bukan dihitung ulang: pembatalan retur harus mengembalikan
  // angka yang persis sama, sementara sisa hutangnya bisa sudah berubah sejak itu.
  // Selisih `totalRefundAmount - debtReductionAmount` = uang tunai yang dikembalikan manual.
  debtReductionAmount: integer('debt_reduction_amount').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  cancelledAt: timestamp('cancelled_at'),
  cancelledById: integer('cancelled_by_id').references(() => users.id),
  cancelReason: text('cancel_reason'),
});

export const returnItems = petshop.table('return_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  returnId: uuid('return_id').notNull().references(() => returns.id),
  transactionItemId: integer('transaction_item_id').notNull().references(() => transactionItems.id),
  productId: integer('product_id').notNull().references(() => products.id),
  uomId: integer('uom_id').notNull().references(() => unitsOfMeasure.id),
  qty: integer('qty').notNull(),
  unitPrice: integer('unit_price').notNull(),
  cogs: integer('cogs').notNull(),
  refundAmount: integer('refund_amount').notNull(),
});
