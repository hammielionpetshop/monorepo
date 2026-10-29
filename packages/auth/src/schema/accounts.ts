import { sql } from 'drizzle-orm';
import { boolean, check, integer, pgSchema, serial, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';

export const authSchema = pgSchema('auth');

// Samakan batas identifier dengan String.trim() pada login JavaScript, termasuk NBSP dan BOM.
const identifierWhitespace = sql.raw("U&'\\0009\\000A\\000B\\000C\\000D\\0020\\00A0\\1680\\2000\\2001\\2002\\2003\\2004\\2005\\2006\\2007\\2008\\2009\\200A\\2028\\2029\\202F\\205F\\3000\\FEFF'");

export const accounts = authSchema.table('accounts', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }),
  email: varchar('email', { length: 255 }),
  passwordHash: text('password_hash'),
  isActive: boolean('is_active').default(true).notNull(),
  mustChangePassword: boolean('must_change_password').default(true).notNull(),
  legacyBackofficeUserId: integer('legacy_backoffice_user_id'),
  importedAt: timestamp('imported_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('accounts_username_unique').on(table.username),
  uniqueIndex('accounts_email_unique').on(table.email),
  uniqueIndex('accounts_legacy_backoffice_user_unique').on(table.legacyBackofficeUserId),
  check('accounts_username_normalized', sql`${table.username} IS NULL OR (${table.username} <> '' AND ${table.username} = lower(btrim(${table.username}, ${identifierWhitespace})))`),
  check('accounts_email_normalized', sql`${table.email} IS NULL OR (${table.email} <> '' AND ${table.email} = lower(btrim(${table.email}, ${identifierWhitespace})))`),
]);

export const accountLinks = authSchema.table('account_links', {
  id: serial('id').primaryKey(),
  accountId: integer('account_id').references(() => accounts.id).notNull(),
  appCode: varchar('app_code', { length: 50 }).notNull(),
  localUserId: integer('local_user_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('account_links_account_app_unique').on(table.accountId, table.appCode),
  uniqueIndex('account_links_app_local_user_unique').on(table.appCode, table.localUserId),
  check('account_links_app_code_valid', sql`${table.appCode} <> '' AND ${table.appCode} = btrim(${table.appCode})`),
  check('account_links_local_user_positive', sql`${table.localUserId} > 0`),
]);
