import { sql } from 'drizzle-orm';
import { check, index, integer, serial, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { accounts, authSchema } from './accounts';

// Lupa password (KAR-70, spec L2f-2 §4.4). Tiket dan kode hanya tersimpan sebagai hash.

// Hitungan salah per identifier, terpisah dari salah password saat masuk. Identifier tak terdaftar ikut dihitung.
export const recoveryThrottles = authSchema.table('recovery_throttles', {
  identifier: varchar('identifier', { length: 255 }).primaryKey(),
  failedCount: integer('failed_count').default(0).notNull(),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  lockCount: integer('lock_count').default(0).notNull(),
  firstLockAt: timestamp('first_lock_at', { withTimezone: true }),
  closedUntil: timestamp('closed_until', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Tiket langkah 2 sesudah email, HP, dan tanggal lahir cocok. Sekali pakai.
export const recoveryTickets = authSchema.table('recovery_tickets', {
  id: serial('id').primaryKey(),
  accountId: integer('account_id').references(() => accounts.id).notNull(),
  tokenHash: varchar('token_hash', { length: 64 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('recovery_tickets_token_unique').on(table.tokenHash),
  index('recovery_tickets_account_idx').on(table.accountId),
  check('recovery_tickets_token_valid', sql`${table.tokenHash} ~ '^[a-f0-9]{64}$'`),
]);

// Kode 6 angka dari Pemilik/GM. Berlaku 1 jam, sekali pakai, hangus sesudah 5 kali salah.
export const recoveryCodes = authSchema.table('recovery_codes', {
  id: serial('id').primaryKey(),
  accountId: integer('account_id').references(() => accounts.id).notNull(),
  codeHash: text('code_hash').notNull(),
  createdByAccountId: integer('created_by_account_id').references(() => accounts.id).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  failedCount: integer('failed_count').default(0).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('recovery_codes_one_live_per_account').on(table.accountId).where(sql`${table.usedAt} is null and ${table.voidedAt} is null`),
]);
