import { sql } from 'drizzle-orm';
import { check, index, integer, primaryKey, serial, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { hrisSchema } from './shared';

// Mesin Pengajuan (spec L2f-1 §2.2–2.4, PRI-23, PRI-37). Tidak ada yang dihapus (trigger);
// isi pengajuan tidak bisa diubah, yang berpindah hanya status dan keputusannya.

export const requestStatus = hrisSchema.enum('request_status', [
  'PENDING', 'REVIEWED', 'APPROVED', 'REJECTED', 'CANCELLED', 'REVOKED', 'EXPIRED',
]);

export const requests = hrisSchema.table(
  'requests',
  {
    id: serial('id').primaryKey(),
    // Kunci jenis di daftar kode apps/hris/modules/requests/rules/types.ts.
    typeKey: text('type_key').notNull(),
    // Untuk siapa (hris.employees.id). Tanpa FK supaya schema mesin tidak bergantung pada modul karyawan.
    subjectEmployeeId: integer('subject_employee_id').notNull(),
    submittedByAccountId: integer('submitted_by_account_id').notNull(),
    submittedByEmployeeId: integer('submitted_by_employee_id').notNull(),
    status: requestStatus('status').notNull().default('PENDING'),
    summary: text('summary').notNull(),
    // Cabang orangnya saat diajukan (saring dan lingkup cabang).
    branchId: integer('branch_id'),
    // Penanda "urusan yang sama" dari modul jenisnya; satu yang masih terbuka per (jenis, kunci).
    dedupeKey: text('dedupe_key'),
    resubmittedFromId: integer('resubmitted_from_id'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    decidedByAccountId: integer('decided_by_account_id'),
    decidedByEmployeeId: integer('decided_by_employee_id'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionReason: text('decision_reason'),
    version: integer('version').notNull().default(1),
  },
  (t) => [
    index('requests_subject_idx').on(t.subjectEmployeeId, t.submittedAt),
    index('requests_open_idx').on(t.typeKey, t.submittedAt).where(sql`${t.status} in ('PENDING', 'REVIEWED')`),
    uniqueIndex('requests_one_open_per_key').on(t.typeKey, t.dedupeKey)
      .where(sql`${t.dedupeKey} is not null and ${t.status} in ('PENDING', 'REVIEWED')`),
    check('requests_summary_not_blank', sql`btrim(${t.summary}) <> ''`),
    check('requests_reason_when_needed', sql`${t.status} not in ('REJECTED', 'REVOKED')
      or btrim(coalesce(${t.decisionReason}, '')) <> ''`),
  ],
);

// Satu baris per perpindahan status (riwayat keputusan). Hanya bertambah.
export const requestEvents = hrisSchema.table(
  'request_events',
  {
    id: serial('id').primaryKey(),
    requestId: integer('request_id').notNull().references(() => requests.id),
    fromStatus: requestStatus('from_status'),
    toStatus: requestStatus('to_status').notNull(),
    actorAccountId: integer('actor_account_id').notNull(),
    actorEmployeeId: integer('actor_employee_id').notNull(),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('request_events_request_idx').on(t.requestId, t.createdAt)],
);

export const requestAttachments = hrisSchema.table(
  'request_attachments',
  {
    requestId: integer('request_id').notNull().references(() => requests.id),
    // hris.files.id (modul files); tanpa FK lintas modul.
    fileId: uuid('file_id').notNull(),
    label: text('label').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.requestId, t.fileId] })],
);
