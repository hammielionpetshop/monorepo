import { sql } from 'drizzle-orm';
import { check, index, integer, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { hrisSchema } from './shared';

// Pemberitahuan di dalam aplikasi (spec L2f-1 §2.6, BER-L02, TAM-25). Hanya `read_at` dan `popup_acked_at`
// yang boleh berubah, masing-masing sekali; baris lebih dari 90 hari dibuang job `notifications-purge`.
export const notifications = hrisSchema.table(
  'notifications',
  {
    id: serial('id').primaryKey(),
    recipientAccountId: integer('recipient_account_id').notNull(),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    link: text('link'),
    entity: text('entity'),
    entityId: integer('entity_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp('read_at', { withTimezone: true }),
    /** Antrean sekali baca (spec F3-4 §6): jendelanya sudah di-"OK, sudah baca". */
    popupAckedAt: timestamp('popup_acked_at', { withTimezone: true }),
  },
  (t) => [
    index('notifications_recipient_idx').on(t.recipientAccountId, t.createdAt),
    index('notifications_unread_idx').on(t.recipientAccountId).where(sql`${t.readAt} is null`),
    index('notifications_created_idx').on(t.createdAt),
    index('notifications_popup_idx').on(t.recipientAccountId, t.createdAt).where(sql`${t.popupAckedAt} is null and ${t.readAt} is null`),
    check('notifications_title_not_blank', sql`btrim(${t.title}) <> ''`),
    check('notifications_link_internal', sql`${t.link} is null or ${t.link} like '/%'`),
  ],
);
