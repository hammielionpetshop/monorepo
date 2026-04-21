import { serial, varchar, integer, decimal, timestamp, text } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { branches } from './branches';
import { shifts } from './shifts';
import { products } from './products';
import { unitsOfMeasure } from './master';
import { users } from './users';

export const damagedGoods = petshop.table('damaged_goods', {
  id: serial('id').primaryKey(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  shiftId: integer('shift_id').references(() => shifts.id),
  reportedById: integer('reported_by_id').references(() => users.id).notNull(),
  reportedAt: timestamp('reported_at').defaultNow().notNull(),
  reason: varchar('reason', { length: 50 }).notNull(), // RUSAK | EXPIRED | HILANG
  notes: text('notes'),
  totalLossValue: decimal('total_loss_value', { precision: 15, scale: 2 }).notNull(),
});

export const damagedGoodsItems = petshop.table('damaged_goods_items', {
  id: serial('id').primaryKey(),
  damagedGoodsId: integer('damaged_goods_id').references(() => damagedGoods.id).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  uomId: integer('uom_id').references(() => unitsOfMeasure.id).notNull(),
  qty: decimal('qty', { precision: 12, scale: 2 }).notNull(),
  costPrice: decimal('cost_price', { precision: 12, scale: 2 }).notNull(), // harga modal FIFO saat itu
  lossValue: decimal('loss_value', { precision: 15, scale: 2 }).notNull(), // qty × costPrice
});
