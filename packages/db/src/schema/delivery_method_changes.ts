import { serial, varchar, integer, text, timestamp, index } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { branches } from './branches';
import { users } from './users';

// Riwayat ubah cara kirim nota / PO Internal (migrasi 0050). Tidak bisa diubah/dihapus (trigger).
export const deliveryMethodChanges = petshop.table('delivery_method_changes', {
  id: serial('id').primaryKey(),
  documentType: varchar('document_type', { length: 20 }).notNull(), // TRANSACTION / INTERNAL_TRANSFER
  documentId: integer('document_id').notNull(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  oldMethod: varchar('old_method', { length: 20 }),
  newMethod: varchar('new_method', { length: 20 }).notNull(),
  reason: text('reason').notNull(),
  changedById: integer('changed_by_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('idx_delivery_method_changes_document').on(t.documentType, t.documentId),
]);
