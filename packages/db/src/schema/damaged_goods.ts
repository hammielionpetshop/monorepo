import { serial, varchar, integer, timestamp, text, index } from 'drizzle-orm/pg-core';
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
  // costPrice/lossValue item ESTIMASI sampai di-approve (lihat komentar di route POS) —
  // totalLossValue ikut estimasi selama PENDING, ditulis ulang dengan nilai FIFO nyata saat approve.
  totalLossValue: integer('total_loss_value').notNull(),
  // PENDING | APPROVED | REJECTED. Stok BELUM dipotong selama PENDING — baru dipotong
  // (StockService.deductStock) saat status berubah jadi APPROVED. Kalau REJECTED, stok
  // tidak pernah tersentuh sama sekali.
  status: varchar('status', { length: 20 }).notNull().default('PENDING'),
  resolvedById: integer('resolved_by_id').references(() => users.id),
  resolvedAt: timestamp('resolved_at'),
  // MUSNAHKAN | RETUR_SUPPLIER | JUAL_DISKON | LAINNYA — diisi saat APPROVED
  resolutionAction: varchar('resolution_action', { length: 20 }),
  resolutionNotes: text('resolution_notes'),
  // Diisi saat REJECTED
  rejectionReason: text('rejection_reason'),
}, (t) => [
  index('idx_damaged_goods_status_branch').on(t.status, t.branchId),
]);

export const damagedGoodsItems = petshop.table('damaged_goods_items', {
  id: serial('id').primaryKey(),
  damagedGoodsId: integer('damaged_goods_id').references(() => damagedGoods.id).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  uomId: integer('uom_id').references(() => unitsOfMeasure.id).notNull(),
  qty: integer('qty').notNull(),
  costPrice: integer('cost_price').notNull(), // harga modal FIFO — estimasi selama PENDING, nyata setelah APPROVED
  lossValue: integer('loss_value').notNull(), // qty × costPrice
  photoUrl: text('photo_url'), // foto bukti per item, diambil/diupload kasir sebelum submit
});
