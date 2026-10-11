import { serial, varchar, integer, timestamp, boolean, date, index } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { customers } from './master';
import { users } from './users';

// Jasa grooming (J2) — lihat docs/work/specs/2026-10-11-jasa-grooming-design.md.
// Tidak ada hapus: groomer dan kucing hanya bisa dinonaktifkan, supaya riwayat grooming
// (dan bonus groomer) yang menunjuk ke sini tidak pernah yatim.

// Orang yang mengerjakan grooming. Bukan akun pengguna — hanya nama yang didaftarkan
// Owner/GM, bisa dipilih di cabang mana pun.
export const groomers = petshop.table('groomers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
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
