import { serial, varchar, integer, timestamp, text, index } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { branches } from './branches';
import { customers, unitsOfMeasure } from './master';
import { products } from './products';
import { users } from './users';
import { transactions } from './transactions';

// Kredensial & identitas login customer portal (order.hammielion.com)
export const customerAuth = petshop.table('customer_auth', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').references(() => customers.id).notNull().unique(),
  phone: varchar('phone', { length: 20 }).notNull().unique(), // nomor login (normalisasi E.164)
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Kode OTP WhatsApp — disimpan sebagai hash argon2, TTL & rate-limit di API
export const customerOtpCodes = petshop.table('customer_otp_codes', {
  id: serial('id').primaryKey(),
  phone: varchar('phone', { length: 20 }).notNull(),
  codeHash: varchar('code_hash', { length: 255 }).notNull(), // hash argon2 OTP, jangan plain
  expiresAt: timestamp('expires_at').notNull(), // TTL 5 menit
  attempts: integer('attempts').default(0).notNull(), // rate-limit verifikasi
  consumedAt: timestamp('consumed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_customer_otp_phone').on(t.phone),
]);

// Order pending dari portal customer — dikonversi jadi bulk sale oleh staff di backoffice
export const customerOrders = petshop.table('customer_orders', {
  id: serial('id').primaryKey(),
  orderNumber: varchar('order_number', { length: 50 }).notNull().unique(), // ORD-YYYYMMDD-xxxx
  customerId: integer('customer_id').references(() => customers.id).notNull(),
  branchId: integer('branch_id').references(() => branches.id).notNull(), // cabang penjual (tetap)
  status: varchar('status', { length: 20 }).default('PENDING').notNull(),
  // PENDING -> CONFIRMED (jadi bulk sale) | REJECTED | CANCELLED
  note: text('note'), // catatan customer (mis. alamat kirim, permintaan)
  estimatedTotal: integer('estimated_total').notNull(), // total snapshot harga saat order (indikatif)
  convertedTransactionId: integer('converted_transaction_id').references(() => transactions.id),
  processedById: integer('processed_by_id').references(() => users.id), // staff yang konfirmasi
  processedAt: timestamp('processed_at'),
  rejectReason: text('reject_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('idx_customer_orders_status_created').on(t.status, t.createdAt),
  index('idx_customer_orders_customer').on(t.customerId),
]);

// Item order — harga snapshot bersifat INDIKATIF; harga final ditentukan staff saat konfirmasi
export const customerOrderItems = petshop.table('customer_order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').references(() => customerOrders.id).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(), // snapshot
  uomId: integer('uom_id').references(() => unitsOfMeasure.id).notNull(),
  uomCode: varchar('uom_code', { length: 10 }).notNull(),
  qty: integer('qty').notNull(),
  priceTier: varchar('price_tier', { length: 20 }).notNull(), // dari customer.defaultTierType
  unitPriceSnapshot: integer('unit_price_snapshot').notNull(), // harga saat order (indikatif)
  subtotalSnapshot: integer('subtotal_snapshot').notNull(),
}, (t) => [
  index('idx_customer_order_items_order').on(t.orderId),
]);
