import { serial, varchar, integer, timestamp, boolean, date, text, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { customers } from './master';
import { users } from './users';
import { branches } from './branches';
import { products } from './products';
import { transactions, transactionItems } from './transactions';

// Jasa grooming (J2) — lihat docs/work/specs/2026-10-11-jasa-grooming-design.md.
// Tidak ada hapus: groomer dan kucing hanya bisa dinonaktifkan, supaya riwayat grooming
// (dan bonus groomer) yang menunjuk ke sini tidak pernah yatim.

// Orang yang mengerjakan grooming. Bukan akun pengguna — hanya nama yang didaftarkan
// Owner/GM, bisa dipilih di cabang mana pun.
export const groomers = petshop.table('groomers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  // Satu daftar nama untuk dua peran (migrasi 0040): yang memandikan dan/atau yang mengantar-jemput.
  isGroomer: boolean('is_groomer').default(true).notNull(),
  isCourier: boolean('is_courier').default(false).notNull(),
  createdById: integer('created_by_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Kucing milik pelanggan. Pemiliknya selalu baris `customers` (pemilik yang didaftarkan lewat
// grooming otomatis menjadi pelanggan). Kondisi kucing TIDAK disimpan di sini — itu ditulis
// per kunjungan.
export const pets = petshop.table('pets', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').references(() => customers.id).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  species: varchar('species', { length: 60 }).notNull(), // jenis/ras, mis. Persia, Domestik
  color: varchar('color', { length: 60 }).notNull(),
  // Umur diisi kasir dalam tahun & bulan, disimpan sebagai perkiraan tanggal lahir supaya
  // umurnya bertambah sendiri di kunjungan berikutnya.
  birthDate: date('birth_date'),
  isActive: boolean('is_active').default(true).notNull(),
  createdById: integer('created_by_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('idx_pets_customer').on(t.customerId),
]);

// Satu baris = satu ekor kucing pada satu kunjungan grooming (J3). Selalu menempel ke satu baris
// nota (`transaction_items`) — uangnya tetap di nota; tabel ini hanya mencatat SIAPA kucingnya,
// SIAPA groomernya, dan sudah diambil atau belum. Status:
//   DIKERJAKAN → DIAMBIL, atau DIBATALKAN bila notanya dibatalkan / barisnya diretur.
// Tidak ada hapus.
export const groomingOrders = petshop.table('grooming_orders', {
  id: serial('id').primaryKey(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id).notNull(),
  transactionItemId: integer('transaction_item_id').references(() => transactionItems.id).notNull(),
  // Urutan kucing di dalam nota (1, 2, …) — nomor karcis = nomor nota / urutan.
  sequence: integer('sequence').notNull(),
  customerId: integer('customer_id').references(() => customers.id).notNull(),
  petId: integer('pet_id').references(() => pets.id).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  groomerId: integer('groomer_id').references(() => groomers.id).notNull(),
  // Kondisi kucing saat diterima — ditulis manual tiap kunjungan, tidak dibawa ke kunjungan berikut.
  condition: text('condition').notNull(),
  status: varchar('status', { length: 20 }).default('DIKERJAKAN').notNull(),
  receivedById: integer('received_by_id').references(() => users.id),
  receivedAt: timestamp('received_at').defaultNow().notNull(),
  pickedUpById: integer('picked_up_by_id').references(() => users.id),
  pickedUpAt: timestamp('picked_up_at'),
  cancelledAt: timestamp('cancelled_at'),
  // 'VOID' = nota dibatalkan, 'RETUR' = baris jasa diretur (pulih bila returnya dibatalkan).
  cancelSource: varchar('cancel_source', { length: 10 }),
  cancelReason: text('cancel_reason'),
  // Berapa kali karcis dicetak; > 1 berarti cetak ulang (karcis bertanda "CETAK ULANG").
  ticketPrintCount: integer('ticket_print_count').default(0).notNull(),
}, (t) => [
  uniqueIndex('uq_grooming_orders_transaction_item').on(t.transactionItemId),
  index('idx_grooming_orders_branch_status').on(t.branchId, t.status, t.receivedAt),
  index('idx_grooming_orders_transaction').on(t.transactionId),
  index('idx_grooming_orders_pet').on(t.petId),
  index('idx_grooming_orders_groomer').on(t.groomerId, t.receivedAt),
]);

// Delivery (antar-jemput) pada satu nota grooming (migrasi 0040). Satu nota = paling banyak satu
// delivery, menempel ke baris ongkir nota itu. Pengantarnya mendapat bonus 50% dari ongkir, jadi
// namanya wajib. Status: DIPROSES → SELESAI (semua kucing di nota sudah diserahkan), atau
// DIBATALKAN bila notanya dibatalkan / baris ongkirnya diretur.
export const serviceDeliveries = petshop.table('service_deliveries', {
  id: serial('id').primaryKey(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id).notNull(),
  transactionItemId: integer('transaction_item_id').references(() => transactionItems.id).notNull(),
  customerId: integer('customer_id').references(() => customers.id).notNull(),
  courierId: integer('courier_id').references(() => groomers.id).notNull(),
  // Alamat saat itu (disalin juga ke data pelanggan supaya kunjungan berikutnya tinggal melengkapi).
  address: text('address').notNull(),
  status: varchar('status', { length: 20 }).default('DIPROSES').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  cancelledAt: timestamp('cancelled_at'),
  cancelSource: varchar('cancel_source', { length: 10 }),
  cancelReason: text('cancel_reason'),
}, (t) => [
  uniqueIndex('uq_service_deliveries_transaction').on(t.transactionId),
  uniqueIndex('uq_service_deliveries_transaction_item').on(t.transactionItemId),
  index('idx_service_deliveries_courier').on(t.courierId, t.createdAt),
]);
