import { sql } from 'drizzle-orm';
import { check, integer, serial, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { accounts, authSchema } from './accounts';

// Catatan idempotensi pintu provisioning. Satu kunci = satu maksud permintaan; kunci yang sama
// dengan isi berbeda ditolak. accountId terisi hanya setelah akun dan tautan lengkap.
export const provisioningRequests = authSchema.table('provisioning_requests', {
  id: serial('id').primaryKey(),
  idempotencyKey: varchar('idempotency_key', { length: 100 }).notNull(),
  requestHash: varchar('request_hash', { length: 64 }).notNull(),
  appCode: varchar('app_code', { length: 50 }).notNull(),
  localUserId: integer('local_user_id').notNull(),
  actorAccountId: integer('actor_account_id').references(() => accounts.id),
  accountId: integer('account_id').references(() => accounts.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('provisioning_requests_key_unique').on(table.idempotencyKey),
  check('provisioning_requests_key_valid', sql`${table.idempotencyKey} ~ '^[A-Za-z0-9_.:-]{8,100}$'`),
  check('provisioning_requests_hash_valid', sql`${table.requestHash} ~ '^[a-f0-9]{64}$'`),
  check('provisioning_requests_local_user_positive', sql`${table.localUserId} > 0`),
]);
