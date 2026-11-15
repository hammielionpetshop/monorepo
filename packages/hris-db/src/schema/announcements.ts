import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { hrisSchema } from './shared';

// Pengumuman (spec F3-2 §3.1). F3-2 hanya jenis EMERGENCY; Papan Perubahan Aturan (F3-3) menambah RULE.
export const announcementKind = hrisSchema.enum('announcement_kind', ['EMERGENCY']);

// Tidak diubah, tidak dihapus (PRI-36): pemicu DB hanya mengizinkan mengisi `ended_*` sekali (Akhiri sekarang).
// "Masih tayang" dihitung dari shows_from/shows_until/ended_at saat dibaca, tidak disimpan sebagai status.
export const announcements = hrisSchema.table(
  'announcements',
  {
    id: serial('id').primaryKey(),
    kind: announcementKind('kind').notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    targetAll: boolean('target_all').notNull(),
    showsFrom: timestamp('shows_from', { withTimezone: true }).notNull().defaultNow(),
    showsUntil: timestamp('shows_until', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    endedByAccountId: integer('ended_by_account_id'),
    endReason: text('end_reason'),
    createdByAccountId: integer('created_by_account_id').notNull(),
    createdByEmployeeId: integer('created_by_employee_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('announcements_kind_until_idx').on(t.kind, t.showsUntil),
    check('announcements_title_not_blank', sql`btrim(${t.title}) <> ''`),
    check('announcements_message_not_blank', sql`btrim(${t.message}) <> ''`),
    check('announcements_shows_range', sql`${t.showsUntil} > ${t.showsFrom}`),
    check('announcements_end_complete', sql`(${t.endedAt} is null) = (${t.endedByAccountId} is null)`),
  ],
);

// Sasaran: tanpa baris = hanya bila target_all. Cabang dan jabatan dibaca sebagai irisan (spec F3-2 §3.1).
export const announcementTargets = hrisSchema.table(
  'announcement_targets',
  {
    id: serial('id').primaryKey(),
    announcementId: integer('announcement_id').notNull().references(() => announcements.id),
    branchId: integer('branch_id'),
    positionId: integer('position_id'),
  },
  (t) => [
    index('announcement_targets_announcement_idx').on(t.announcementId),
    check('announcement_targets_one_kind', sql`(${t.branchId} is null) <> (${t.positionId} is null)`),
  ],
);

// "Sudah saya baca": sekali per orang, hanya tambah.
export const announcementReads = hrisSchema.table(
  'announcement_reads',
  {
    id: serial('id').primaryKey(),
    announcementId: integer('announcement_id').notNull().references(() => announcements.id),
    employeeId: integer('employee_id').notNull(),
    accountId: integer('account_id').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('announcement_reads_person_uq').on(t.announcementId, t.employeeId),
    index('announcement_reads_employee_idx').on(t.employeeId),
  ],
);
