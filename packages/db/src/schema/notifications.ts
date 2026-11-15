import { serial, varchar, integer, timestamp, text, boolean, jsonb } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { branches } from './branches';

export const notifications = petshop.table('notifications', {
  id: serial('id').primaryKey(),
  type: varchar('type', { length: 50 }).notNull(), // SO_SKIPPED, dll
  branchId: integer('branch_id').references(() => branches.id), // bisa null jika global
  title: varchar('title', { length: 150 }).notNull(),
  message: text('message').notNull(),
  metadata: jsonb('metadata'), // untuk simpan data tambahan misalnya shiftId, cashierId
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
