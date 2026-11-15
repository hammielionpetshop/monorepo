import { sql } from 'drizzle-orm';
import { boolean, check, date, index, integer, jsonb, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { hrisSchema } from './shared';

// Pengumuman (spec F3-2 §3.1): EMERGENCY = darurat; RULE = Papan Perubahan Aturan (spec F3-3 §3.1).
export const announcementKind = hrisSchema.enum('announcement_kind', ['EMERGENCY', 'RULE']);
// UNFAVORABLE = merugikan atau mengubah cara hitung (jarak 7 hari); FAVORABLE = murni menguntungkan (1 hari).
export const ruleChangeKind = hrisSchema.enum('rule_change_kind', ['UNFAVORABLE', 'FAVORABLE']);
export const announcementDraftStatus = hrisSchema.enum('announcement_draft_status', ['DRAFT', 'SUBMITTED', 'PUBLISHED', 'REJECTED', 'DISCARDED']);

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
    /** Darurat: wajib. Aturan: kosong (tidak punya masa tayang). */
    showsUntil: timestamp('shows_until', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    endedByAccountId: integer('ended_by_account_id'),
    endReason: text('end_reason'),
    createdByAccountId: integer('created_by_account_id').notNull(),
    createdByEmployeeId: integer('created_by_employee_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    // Kolom khas RULE (spec F3-3 §3.1). Untuk aturan, `message` = "Sekarang", `shows_from` = jadwal terbit,
    // `ended_*` = Tarik (hanya sebelum berlaku).
    beforeText: text('before_text'),
    askWhom: text('ask_whom'),
    effectiveOn: date('effective_on', { mode: 'string' }),
    changeKind: ruleChangeKind('change_kind'),
    affectsMoney: boolean('affects_money'),
    /** Ralat: pengumuman yang dikoreksi (yang lama tampil "Diralat"). */
    correctsAnnouncementId: integer('corrects_announcement_id'),
    /** Aturan lama yang digantikan perubahan ini (pindah ke Riwayat sejak tanggal berlaku yang baru). */
    supersedesAnnouncementId: integer('supersedes_announcement_id'),
    approvedByAccountId: integer('approved_by_account_id'),
    requestId: integer('request_id'),
  },
  (t) => [
    index('announcements_kind_until_idx').on(t.kind, t.showsUntil),
    index('announcements_corrects_idx').on(t.correctsAnnouncementId),
    index('announcements_supersedes_idx').on(t.supersedesAnnouncementId),
    check('announcements_emergency_until', sql`${t.kind}::text <> 'EMERGENCY' or ${t.showsUntil} is not null`),
    check('announcements_rule_complete', sql`${t.kind}::text <> 'RULE' or (${t.beforeText} is not null and ${t.askWhom} is not null
      and ${t.effectiveOn} is not null and ${t.changeKind} is not null and ${t.affectsMoney} is not null)`),
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

// Konsep perubahan aturan (spec F3-3 §3.1): boleh diubah selama DRAFT; tidak dihapus ("Buang konsep" = DISCARDED).
// Baris pengumuman baru dibuat saat Terbitkan/Jadwalkan, atau saat pengajuan uangnya disetujui.
export const announcementDrafts = hrisSchema.table(
  'announcement_drafts',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull().default(''),
    beforeText: text('before_text').notNull().default(''),
    afterText: text('after_text').notNull().default(''),
    askWhom: text('ask_whom').notNull().default(''),
    changeKind: ruleChangeKind('change_kind').notNull().default('UNFAVORABLE'),
    affectsMoney: boolean('affects_money').notNull().default(false),
    /** `{ all: true }` atau `{ all: false, branchIds, positionIds }` (arti sama dengan darurat). */
    target: jsonb('target').notNull(),
    /** Kosong = terbit saat ditekan Terbitkan (atau saat disetujui). */
    publishesAt: timestamp('publishes_at', { withTimezone: true }),
    effectiveOn: date('effective_on', { mode: 'string' }),
    correctsAnnouncementId: integer('corrects_announcement_id'),
    supersedesAnnouncementId: integer('supersedes_announcement_id'),
    status: announcementDraftStatus('status').notNull().default('DRAFT'),
    requestId: integer('request_id'),
    announcementId: integer('announcement_id'),
    closeReason: text('close_reason'),
    createdByAccountId: integer('created_by_account_id').notNull(),
    createdByEmployeeId: integer('created_by_employee_id').notNull(),
    submittedByAccountId: integer('submitted_by_account_id'),
    submittedByEmployeeId: integer('submitted_by_employee_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedByAccountId: integer('updated_by_account_id').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('announcement_drafts_status_idx').on(t.status),
    uniqueIndex('announcement_drafts_request_uq').on(t.requestId).where(sql`${t.requestId} is not null`),
  ],
);
