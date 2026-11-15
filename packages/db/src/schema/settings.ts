import { varchar, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { users } from './users';

// Pengaturan aplikasi global (key-value). Dipakai a.l. untuk default kredensial
// staf (default_password, default_pin) yang bisa diubah OWNER.
//
// CATATAN KEAMANAN: `default_password` & `default_pin` disimpan PLAINTEXT karena
// OWNER perlu melihatnya untuk disampaikan ke staf. Hash argon2 tetap dipakai di
// `users.passwordHash`/`pinHash`; nilai default di sini hanya template awal.
export const appSettings = petshop.table('app_settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  updatedBy: integer('updated_by').references(() => users.id),
});
