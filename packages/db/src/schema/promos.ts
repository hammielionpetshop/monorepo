import { serial, varchar, text, integer, boolean, timestamp, index, primaryKey, unique } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { branches } from './branches';
import { users } from './users';
import { products } from './products';
import { unitsOfMeasure } from './master';

// Promo otomatis (migrasi 0044) — lihat docs/work/specs/2026-10-12-promo-otomatis-design.md.
// Satu promo = syarat + hadiah + batas. Aturannya hanya dihitung mesin promo
// (`apps/backoffice/lib/promo/promo-engine.ts`). Tanpa edit/hapus sesudah terpakai: promo
// hanya dinonaktifkan; nota menyimpan salinan aturannya di `transaction_item_discounts`.
// Tabel `promotions` (developer lama) tidak dipakai.
export const promos = petshop.table('promos', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  kind: varchar('kind', { length: 20 }).notNull(), // POTONGAN, FLASH_SALE, BELI_GRATIS, BUNDLING, HADIAH_PILIHAN
  note: text('note'),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  // Jam berlaku tiap hari (menit sejak 00.00 WIB); dua-duanya kosong = sepanjang hari.
  dailyStartMinute: integer('daily_start_minute'),
  dailyEndMinute: integer('daily_end_minute'),
  isMultiple: boolean('is_multiple').default(false).notNull(), // berlaku kelipatan
  maxPerNote: integer('max_per_note'), // paling banyak sekian kali per nota; kosong = tanpa batas
  // Kuota total per cabang (migrasi 0045). Jatah dihitung terpisah tiap cabang, tidak dicampur.
  // quotaKind kosong = tanpa kuota. PCS = jatah berapa pcs barang hadiah; NOTA = jatah berapa nota.
  quotaKind: varchar('quota_kind', { length: 10 }), // null, PCS, NOTA
  quotaPerBranch: integer('quota_per_branch'), // jatah per cabang; wajib terisi bila quotaKind terisi
  requireStock: boolean('require_stock').default(false).notNull(), // promo hanya jalan bila stok hadiah > 0
  isActive: boolean('is_active').default(true).notNull(),
  createdById: integer('created_by_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  deactivatedById: integer('deactivated_by_id').references(() => users.id),
  deactivatedAt: timestamp('deactivated_at'),
}, (t) => [
  index('idx_promos_active_period').on(t.isActive, t.startsAt, t.endsAt),
]);

export const promoBranches = petshop.table('promo_branches', {
  promoId: integer('promo_id').references(() => promos.id).notNull(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
}, (t) => [
  primaryKey({ name: 'promo_branches_pk', columns: [t.promoId, t.branchId] }),
  index('idx_promo_branches_branch').on(t.branchId),
]);

// Barang syarat: harus ada di keranjang sekurangnya `minQty`.
export const promoConditions = petshop.table('promo_conditions', {
  id: serial('id').primaryKey(),
  promoId: integer('promo_id').references(() => promos.id).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  uomId: integer('uom_id').references(() => unitsOfMeasure.id).notNull(),
  minQty: integer('min_qty').notNull(),
}, (t) => [
  unique('uq_promo_conditions_item').on(t.promoId, t.productId, t.uomId),
]);

// Pemakaian kuota per cabang (migrasi 0045). Bertambah di dalam transaksi DB yang sama dengan
// simpan nota; nota batal menguranginya kembali (retur tidak). Tiap cabang satu baris per promo.
export const promoBranchUsage = petshop.table('promo_branch_usage', {
  promoId: integer('promo_id').references(() => promos.id).notNull(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  usedPcs: integer('used_pcs').default(0).notNull(),
  usedNotes: integer('used_notes').default(0).notNull(),
}, (t) => [
  primaryKey({ name: 'promo_branch_usage_pk', columns: [t.promoId, t.branchId] }),
]);

// Barang hadiah: barang yang dipotong dan caranya.
export const promoRewards = petshop.table('promo_rewards', {
  id: serial('id').primaryKey(),
  promoId: integer('promo_id').references(() => promos.id).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  uomId: integer('uom_id').references(() => unitsOfMeasure.id).notNull(),
  rewardType: varchar('reward_type', { length: 20 }).notNull(), // POTONG_PER_PCS, HARGA_JADI, GRATIS
  value: integer('value').notNull(), // rupiah per pcs (potongan atau harga jadi); 0 untuk GRATIS
  // Sekian pcs per satu kali pakai promo; kosong = semua pcs barang itu di nota.
  qty: integer('qty'),
}, (t) => [
  unique('uq_promo_rewards_item').on(t.promoId, t.productId, t.uomId),
]);
