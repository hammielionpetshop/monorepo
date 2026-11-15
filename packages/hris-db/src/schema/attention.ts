import { date, index, integer, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { hrisSchema } from './shared';

// Antrean berantai (spec F3-1 §3.3, TAM-22 butir 4): "jenis ini sudah tampil ke akun ini hari ini (WIB)".
// Butir antrean sendiri tidak disimpan; asalnya kartu "Perlu perhatian". Hanya tambah; baris lebih dari
// 90 hari dibuang saat akun itu menekan OK berikutnya.
export const queueShown = hrisSchema.table(
  'queue_shown',
  {
    id: serial('id').primaryKey(),
    accountId: integer('account_id').notNull(),
    kind: text('kind').notNull(),
    shownOn: date('shown_on', { mode: 'string' }).notNull(),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('queue_shown_account_kind_day_uq').on(t.accountId, t.kind, t.shownOn),
    index('queue_shown_day_idx').on(t.shownOn),
  ],
);
