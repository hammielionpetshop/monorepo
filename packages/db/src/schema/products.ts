import { serial, varchar, integer, timestamp, boolean } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { unitsOfMeasure, categories, brands } from './master';

export const products = petshop.table('products', {
  id: serial('id').primaryKey(),
  sku: varchar('sku', { length: 50 }).unique(),
  barcode: varchar('barcode', { length: 50 }).unique(),
  name: varchar('name', { length: 255 }).notNull(),
  categoryId: integer('category_id').references(() => categories.id),
  brandId: integer('brand_id').references(() => brands.id),
  baseUomId: integer('base_uom_id').references(() => unitsOfMeasure.id).notNull(),
  weightGram: integer('weight_gram'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const productUomConversions = petshop.table('product_uom_conversions', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id).notNull(),
  uomId: integer('uom_id').references(() => unitsOfMeasure.id).notNull(),
  ratio: integer('ratio').notNull(), // 1 Big UOM = ratio * Base UOM
  weightGram: integer('weight_gram'), // Berat per 1 unit UOM ini (dalam gram), nullable
});

export const productPrices = petshop.table('product_prices', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id).notNull(),
  branchId: integer('branch_id').notNull(), // Can reference branches.id
  uomId: integer('uom_id').references(() => unitsOfMeasure.id).notNull(),
  tierType: varchar('tier_type', { length: 20 }).notNull(), // RETAIL, GROSIR, MEMBER, etc.
  price: integer('price').notNull(),
});
