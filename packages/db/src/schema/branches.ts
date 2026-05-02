import { serial, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';

export const branches = petshop.table('branches', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  address: text('address'),
  phone: varchar('phone', { length: 20 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at'),
});
