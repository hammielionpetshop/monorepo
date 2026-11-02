import { sql } from 'drizzle-orm';
import { boolean, check, date, index, integer, jsonb, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { employees } from './employees';
import { requests } from './requests';
import { hrisSchema } from './shared';

// Gaji Bulanan L4a — komponen gaji (spec L4a §2). Tidak ada yang dihapus (PRI-02): pembatalan = tanda.

export const salaryChangeOrigin = hrisSchema.enum('salary_change_origin', ['DIRECT', 'PROPOSAL', 'STANDARD_PROMOTION']);
export const salaryStandardKind = hrisSchema.enum('salary_standard_kind', ['TRAINING', 'EMPLOYEE']);

// Daftar jenis komponen gaji (GAJ-65). Hanya Pemilik/GM mengubah.
export const salaryComponentTypes = hrisSchema.table(
  'salary_component_types',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull(),
    active: boolean('active').notNull().default(true),
    createdByAccountId: integer('created_by_account_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('salary_component_types_name_unique').on(sql`lower(${t.name})`),
    check('salary_component_types_name_not_blank', sql`btrim(${t.name}) <> ''`),
  ],
);

// Riwayat nama jenis komponen (GAJ-39: slip yang ditutup kelak menyimpan nama saat ditutup).
export const salaryComponentTypeNames = hrisSchema.table(
  'salary_component_type_names',
  {
    id: serial('id').primaryKey(),
    componentTypeId: integer('component_type_id').notNull().references(() => salaryComponentTypes.id),
    oldName: text('old_name').notNull(),
    newName: text('new_name').notNull(),
    changedByAccountId: integer('changed_by_account_id').notNull(),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('salary_component_type_names_type_idx').on(t.componentTypeId)],
);

// Satu baris = paket lengkap gaji seseorang mulai satu tanggal 26 (GAJ-63).
export const salaryChanges = hrisSchema.table(
  'salary_changes',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    effectiveFrom: date('effective_from', { mode: 'string' }).notNull(),
    origin: salaryChangeOrigin('origin').notNull(),
    reason: text('reason').notNull(),
    createdByAccountId: integer('created_by_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** Pengusul (HR) bila asalnya usulan. */
    proposedByAccountId: integer('proposed_by_account_id'),
    requestId: integer('request_id').references(() => requests.id),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledByAccountId: integer('cancelled_by_account_id'),
    cancelReason: text('cancel_reason'),
  },
  (t) => [
    index('salary_changes_person_idx').on(t.employeeId, t.effectiveFrom),
    uniqueIndex('salary_changes_one_per_date').on(t.employeeId, t.effectiveFrom).where(sql`${t.cancelledAt} is null`),
    check('salary_changes_period_start', sql`extract(day from ${t.effectiveFrom}) = 26`),
    check('salary_changes_reason_not_blank', sql`btrim(${t.reason}) <> ''`),
    check('salary_changes_cancel_complete', sql`(${t.cancelledAt} is null) = (${t.cancelReason} is null)`),
  ],
);

export const salaryChangeLines = hrisSchema.table(
  'salary_change_lines',
  {
    id: serial('id').primaryKey(),
    changeId: integer('change_id').notNull().references(() => salaryChanges.id),
    componentTypeId: integer('component_type_id').notNull().references(() => salaryComponentTypes.id),
    amount: integer('amount').notNull(),
  },
  (t) => [
    uniqueIndex('salary_change_lines_unique').on(t.changeId, t.componentTypeId),
    check('salary_change_lines_positive', sql`${t.amount} > 0`),
  ],
);

// Dua paket Gaji Standar (GAJ-64): isian awal, tidak mengubah gaji siapa pun.
export const salaryStandards = hrisSchema.table(
  'salary_standards',
  {
    id: serial('id').primaryKey(),
    kind: salaryStandardKind('kind').notNull(),
    effectiveFrom: date('effective_from', { mode: 'string' }).notNull(),
    reason: text('reason').notNull(),
    createdByAccountId: integer('created_by_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledByAccountId: integer('cancelled_by_account_id'),
    cancelReason: text('cancel_reason'),
  },
  (t) => [
    uniqueIndex('salary_standards_one_per_date').on(t.kind, t.effectiveFrom).where(sql`${t.cancelledAt} is null`),
    check('salary_standards_period_start', sql`extract(day from ${t.effectiveFrom}) = 26`),
    check('salary_standards_reason_not_blank', sql`btrim(${t.reason}) <> ''`),
    check('salary_standards_cancel_complete', sql`(${t.cancelledAt} is null) = (${t.cancelReason} is null)`),
  ],
);

export const salaryStandardLines = hrisSchema.table(
  'salary_standard_lines',
  {
    id: serial('id').primaryKey(),
    standardId: integer('standard_id').notNull().references(() => salaryStandards.id),
    componentTypeId: integer('component_type_id').notNull().references(() => salaryComponentTypes.id),
    amount: integer('amount').notNull(),
  },
  (t) => [
    uniqueIndex('salary_standard_lines_unique').on(t.standardId, t.componentTypeId),
    check('salary_standard_lines_positive', sql`${t.amount} > 0`),
  ],
);

// Isi khas pengajuan "Usulan ubah gaji" (GAJ-62). Status di hris.requests; paket baru lahir saat disetujui.
export const salaryChangeProposals = hrisSchema.table(
  'salary_change_proposals',
  {
    id: serial('id').primaryKey(),
    requestId: integer('request_id').notNull().references(() => requests.id),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    effectiveFrom: date('effective_from', { mode: 'string' }).notNull(),
    /** [{ componentTypeId, amount }] */
    lines: jsonb('lines').notNull(),
    /** Paket yang berlaku di tanggal itu saat diusulkan: [{ componentTypeId, amount }] atau null. */
    beforeLines: jsonb('before_lines'),
    reason: text('reason').notNull(),
    deadlineOn: date('deadline_on', { mode: 'string' }).notNull(),
    proposedByAccountId: integer('proposed_by_account_id').notNull(),
    /** OPEN = menunggu; APPROVED = jadi paket; CLOSED = ditolak, dibatalkan, atau hangus. Diisi handler pengajuannya. */
    state: text('state').notNull().default('OPEN'),
    salaryChangeId: integer('salary_change_id').references(() => salaryChanges.id),
  },
  (t) => [
    uniqueIndex('salary_change_proposals_request_unique').on(t.requestId),
    index('salary_change_proposals_person_idx').on(t.employeeId),
    check('salary_change_proposals_period_start', sql`extract(day from ${t.effectiveFrom}) = 26`),
    check('salary_change_proposals_state', sql`${t.state} in ('OPEN', 'APPROVED', 'CLOSED')`),
  ],
);
