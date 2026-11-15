import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, serial, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { accounts, accountLinks, authSchema } from './accounts';

export const sessions = authSchema.table('sessions', {
  id: serial('id').primaryKey(),
  accountId: integer('account_id').references(() => accounts.id).notNull(),
  tokenHash: varchar('token_hash', { length: 64 }).notNull(),
  authMethod: varchar('auth_method', { length: 20 }).notNull(),
  deviceLabel: varchar('device_label', { length: 200 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedReason: varchar('revoked_reason', { length: 50 }),
}, (table) => [
  uniqueIndex('sessions_token_hash_unique').on(table.tokenHash),
  index('sessions_account_idx').on(table.accountId),
  check('sessions_auth_method_valid', sql`${table.authMethod} IN ('PASSWORD', 'PIN')`),
  check('sessions_token_hash_valid', sql`${table.tokenHash} ~ '^[a-f0-9]{64}$'`),
]);

export const sessionAppAccess = authSchema.table('session_app_access', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').references(() => sessions.id).notNull(),
  appCode: varchar('app_code', { length: 50 }).notNull(),
  accountLinkId: integer('account_link_id').references(() => accountLinks.id).notNull(),
  localUserId: integer('local_user_id').notNull(),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedReason: varchar('revoked_reason', { length: 50 }),
}, (table) => [
  uniqueIndex('session_app_access_session_app_unique').on(table.sessionId, table.appCode),
  check('session_app_access_app_valid', sql`${table.appCode} IN ('backoffice', 'hris')`),
]);

export const loginEvents = authSchema.table('login_events', {
  id: serial('id').primaryKey(),
  accountId: integer('account_id').references(() => accounts.id),
  appCode: varchar('app_code', { length: 50 }).notNull(),
  authMethod: varchar('auth_method', { length: 20 }).notNull(),
  outcome: varchar('outcome', { length: 50 }).notNull(),
  deviceLabel: varchar('device_label', { length: 200 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index('login_events_account_time_idx').on(table.accountId, table.createdAt)]);

export const auditEvents = authSchema.table('audit_events', {
  id: serial('id').primaryKey(),
  accountId: integer('account_id').references(() => accounts.id).notNull(),
  actorAccountId: integer('actor_account_id').references(() => accounts.id),
  action: varchar('action', { length: 50 }).notNull(),
  metadata: jsonb('metadata').$type<Record<string, string | number | boolean | null>>().notNull(),
  description: text('description').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index('audit_events_account_time_idx').on(table.accountId, table.createdAt)]);
