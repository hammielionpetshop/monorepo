import { sql } from 'drizzle-orm';
import {
  check, date, index, integer, serial, text, timestamp, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { branches, positions } from './access';
import { hrisSchema } from './shared';

// Modul karyawan (spec L2c §2). Tidak ada hapus (trigger); riwayat hanya bertambah.

export const workStatus = hrisSchema.enum('work_status', ['TRAINING', 'EMPLOYEE']);
export const employeeSource = hrisSchema.enum('employee_source', ['HRIS', 'LEGACY', 'FIXTURE']);
export const gender = hrisSchema.enum('gender', ['MALE', 'FEMALE']);
export const placementKind = hrisSchema.enum('placement_kind', ['INITIAL', 'BRANCH', 'POSITION', 'WORK_STATUS']);
export const employmentEventKind = hrisSchema.enum('employment_event_kind', ['DEACTIVATE', 'REACTIVATE']);
export const deactivationReason = hrisSchema.enum('deactivation_reason', ['RESIGNED', 'DISMISSED', 'OTHER']);
export const resignationNotice = hrisSchema.enum('resignation_notice', ['WITH_NOTICE', 'WITHOUT_NOTICE']);
export const fieldPermitKind = hrisSchema.enum('field_permit_kind', ['DRIVE', 'ASSIST']);
export const trainingDecision = hrisSchema.enum('training_decision', ['APPROVE', 'DEFER']);

// id = local_user_id tautan HRIS di auth.account_links.
export const employees = hrisSchema.table(
  'employees',
  {
    id: serial('id').primaryKey(),
    // Diberi server lewat hris.next_employee_code(); trigger menolak perubahan (KAR-02).
    code: text('code').notNull(),
    name: text('name').notNull(),
    joinedOn: date('joined_on').notNull(),
    phone: text('phone'),
    email: text('email'),
    birthDate: date('birth_date'),
    gender: gender('gender'),
    birthPlace: text('birth_place'),
    address: text('address'),
    emergencyContactName: text('emergency_contact_name'),
    emergencyContactPhone: text('emergency_contact_phone'),
    religion: text('religion'),
    maritalStatus: text('marital_status'),
    dependents: integer('dependents'),
    education: text('education'),
    bankName: text('bank_name'),
    bankAccountNumber: text('bank_account_number'),
    bankAccountHolder: text('bank_account_holder'),
    source: employeeSource('source').notNull().default('HRIS'),
    createdByAccountId: integer('created_by_account_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('employees_code_unique').on(t.code),
    uniqueIndex('employees_phone_unique').on(t.phone).where(sql`${t.phone} is not null`),
    index('employees_name_idx').on(sql`lower(${t.name})`),
    check('employees_name_not_blank', sql`btrim(${t.name}) <> ''`),
    check('employees_dependents_range', sql`${t.dependents} between 0 and 50`),
  ],
);

// Setiap baris = penempatan lengkap sesudah perubahan. Penempatan pada tanggal X = baris tak dibatalkan
// dengan effective_from <= X terbaru (lalu id terbesar). Batal hanya untuk yang bertanggal depan.
export const placements = hrisSchema.table(
  'placements',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    kind: placementKind('kind').notNull(),
    branchId: integer('branch_id').notNull().references(() => branches.id),
    positionId: integer('position_id').notNull().references(() => positions.id),
    workStatus: workStatus('work_status').notNull(),
    effectiveFrom: date('effective_from').notNull(),
    reason: text('reason'),
    createdByAccountId: integer('created_by_account_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledByAccountId: integer('cancelled_by_account_id'),
    cancelReason: text('cancel_reason'),
  },
  (t) => [
    index('placements_employee_date_idx').on(t.employeeId, t.effectiveFrom),
    index('placements_branch_date_idx').on(t.branchId, t.effectiveFrom),
    index('placements_position_idx').on(t.positionId),
    uniqueIndex('placements_one_initial').on(t.employeeId).where(sql`${t.kind} = 'INITIAL'`),
    check('placements_cancel_complete', sql`(${t.cancelledAt} is null) = (${t.cancelReason} is null)`),
  ],
);

// Status aktif pada tanggal X = kejadian terakhir dengan effective_on <= X; tanpa kejadian = aktif.
// Nonaktif: effective_on = hari sesudah tanggal terakhir bekerja.
export const employmentEvents = hrisSchema.table(
  'employment_events',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    kind: employmentEventKind('kind').notNull(),
    effectiveOn: date('effective_on').notNull(),
    reasonKind: deactivationReason('reason_kind'),
    resignationNotice: resignationNotice('resignation_notice'),
    note: text('note').notNull(),
    createdByAccountId: integer('created_by_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    // Kapan akun pusat sudah diikutkan (langsung atau oleh job harian).
    accountAppliedAt: timestamp('account_applied_at', { withTimezone: true }),
  },
  (t) => [
    index('employment_events_employee_idx').on(t.employeeId, t.effectiveOn),
    index('employment_events_pending_idx').on(t.effectiveOn).where(sql`${t.accountAppliedAt} is null`),
    check('employment_events_reason_by_kind', sql`(${t.kind} = 'DEACTIVATE') = (${t.reasonKind} is not null)`),
    check('employment_events_notice_only_resigned',
      sql`(${t.resignationNotice} is not null) = (${t.reasonKind} is not distinct from 'RESIGNED')`),
    check('employment_events_note_not_blank', sql`btrim(${t.note}) <> ''`),
  ],
);

export const fieldPermits = hrisSchema.table(
  'field_permits',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    kind: fieldPermitKind('kind').notNull(),
    grantedByAccountId: integer('granted_by_account_id').notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedByAccountId: integer('revoked_by_account_id'),
    revokeReason: text('revoke_reason'),
  },
  (t) => [
    uniqueIndex('field_permits_one_active').on(t.employeeId, t.kind).where(sql`${t.revokedAt} is null`),
    check('field_permits_revoke_complete',
      sql`(${t.revokedAt} is null) = (${t.revokeReason} is null) and (${t.revokedAt} is null) = (${t.revokedByAccountId} is null)`),
  ],
);

// Keputusan promosi training; tidak bisa diubah (KAR-23).
export const trainingReviews = hrisSchema.table(
  'training_reviews',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    decision: trainingDecision('decision').notNull(),
    reviewAgainOn: date('review_again_on'),
    promotionEffectiveOn: date('promotion_effective_on'),
    placementId: integer('placement_id').references(() => placements.id),
    reason: text('reason'),
    decidedByAccountId: integer('decided_by_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('training_reviews_employee_idx').on(t.employeeId, t.createdAt),
    check('training_reviews_shape', sql`case ${t.decision}
      when 'APPROVE' then ${t.promotionEffectiveOn} is not null and ${t.placementId} is not null and ${t.reviewAgainOn} is null
      else ${t.reviewAgainOn} is not null and ${t.reason} is not null and btrim(${t.reason}) <> '' and ${t.placementId} is null end`),
  ],
);
