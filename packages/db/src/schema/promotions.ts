import { serial, varchar, text, decimal, timestamp, boolean, integer } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';

export const promotions = petshop.table('promotions', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 30 }).notNull(), // PERCENTAGE, FIXED_AMOUNT, BUY_X_GET_Y, COMBO
  value: decimal('value', { precision: 12, scale: 2 }),
  minPurchase: decimal('min_purchase', { precision: 12, scale: 2 }).default('0'),
  maxDiscount: decimal('max_discount', { precision: 12, scale: 2 }),
  startedAt: timestamp('started_at').notNull(),
  endedAt: timestamp('ended_at').notNull(),
  usageLimit: integer('usage_limit'),
  usageCount: integer('usage_count').default(0),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
