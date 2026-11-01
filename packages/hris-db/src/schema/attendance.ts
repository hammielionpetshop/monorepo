import { sql } from 'drizzle-orm';
import { boolean, check, date, index, integer, primaryKey, serial, smallint, text, time, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { branches } from './access';
import { employees } from './employees';
import { hrisSchema } from './shared';

// L3a Jam Kerja & Jadwal (spec 2026-11-01-hris-l3a-schedule-design). Tidak ada baris yang dihapus (PRI-02).

export const shiftAssignmentOrigin = hrisSchema.enum('shift_assignment_origin', ['MACHINE', 'INITIAL', 'MANUAL']);

// Identitas shift milik cabang (KEH-01); jamnya ada di versi bertanggal.
export const workShifts = hrisSchema.table(
  'work_shifts',
  {
    id: serial('id').primaryKey(),
    branchId: integer('branch_id').notNull().references(() => branches.id),
    name: text('name').notNull(),
    position: smallint('position').notNull(),
    active: boolean('active').notNull().default(true),
    createdByAccountId: integer('created_by_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('work_shifts_branch_name_unique').on(t.branchId, sql`lower(${t.name})`),
    check('work_shifts_name_not_blank', sql`btrim(${t.name}) <> ''`),
  ],
);

// Jam kerja bertanggal berlaku (KEH-02) + istirahat per shift (KEH-82).
export const workShiftVersions = hrisSchema.table(
  'work_shift_versions',
  {
    id: serial('id').primaryKey(),
    shiftId: integer('shift_id').notNull().references(() => workShifts.id),
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
    breakMinutes: smallint('break_minutes'),
    breakStartFrom: time('break_start_from'),
    breakStartUntil: time('break_start_until'),
    effectiveFrom: date('effective_from', { mode: 'string' }).notNull(),
    effectiveUntil: date('effective_until', { mode: 'string' }),
    reason: text('reason').notNull(),
    createdByAccountId: integer('created_by_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledByAccountId: integer('cancelled_by_account_id'),
    cancelReason: text('cancel_reason'),
  },
  (t) => [
    uniqueIndex('work_shift_versions_one_per_day').on(t.shiftId, t.effectiveFrom).where(sql`${t.cancelledAt} is null`),
    check('work_shift_versions_hours_differ', sql`${t.startTime} <> ${t.endTime}`),
    check('work_shift_versions_break_complete', sql`(${t.breakMinutes} is null) = (${t.breakStartFrom} is null)
      and (${t.breakMinutes} is null) = (${t.breakStartUntil} is null)`),
    check('work_shift_versions_range', sql`${t.effectiveUntil} is null or ${t.effectiveUntil} >= ${t.effectiveFrom}`),
    check('work_shift_versions_reason_not_blank', sql`btrim(${t.reason}) <> ''`),
  ],
);

// Dua kelompok giliran per cabang; minggu acuan = Senin saat giliran awal diisi (KEH-06, KEH-102).
export const shiftGroups = hrisSchema.table(
  'shift_groups',
  {
    id: serial('id').primaryKey(),
    branchId: integer('branch_id').notNull().references(() => branches.id),
    position: smallint('position').notNull(),
    name: text('name').notNull(),
    anchorWeek: date('anchor_week', { mode: 'string' }).notNull(),
    createdByAccountId: integer('created_by_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('shift_groups_branch_position_unique').on(t.branchId, t.position),
    check('shift_groups_two_per_branch', sql`${t.position} in (0, 1)`),
  ],
);

export const shiftGroupMembers = hrisSchema.table(
  'shift_group_members',
  {
    id: serial('id').primaryKey(),
    groupId: integer('group_id').notNull().references(() => shiftGroups.id),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    effectiveFrom: date('effective_from', { mode: 'string' }).notNull(),
    effectiveUntil: date('effective_until', { mode: 'string' }),
    createdByAccountId: integer('created_by_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('shift_group_members_one_open').on(t.employeeId).where(sql`${t.effectiveUntil} is null`),
    index('shift_group_members_group_idx').on(t.groupId),
  ],
);

// Shift seseorang untuk satu minggu Senin-Minggu (KEH-05). Kunci unik membuat mesin aman diulang.
export const shiftAssignments = hrisSchema.table(
  'shift_assignments',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    branchId: integer('branch_id').notNull().references(() => branches.id),
    weekStart: date('week_start', { mode: 'string' }).notNull(),
    shiftId: integer('shift_id').notNull().references(() => workShifts.id),
    origin: shiftAssignmentOrigin('origin').notNull(),
    createdByAccountId: integer('created_by_account_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('shift_assignments_person_week_unique').on(t.employeeId, t.branchId, t.weekStart),
    index('shift_assignments_branch_week_idx').on(t.branchId, t.weekStart),
    check('shift_assignments_monday', sql`extract(isodow from ${t.weekStart}) = 1`),
  ],
);

// Ubah shift mendadak per hari (KEH-45, keputusan owner spec L3a §9 butir 1). Baris terbaru yang berlaku.
export const shiftDayChanges = hrisSchema.table(
  'shift_day_changes',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    branchId: integer('branch_id').notNull().references(() => branches.id),
    workDate: date('work_date', { mode: 'string' }).notNull(),
    shiftId: integer('shift_id').notNull().references(() => workShifts.id),
    previousShiftId: integer('previous_shift_id').references(() => workShifts.id),
    reason: text('reason').notNull(),
    createdByAccountId: integer('created_by_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('shift_day_changes_person_date_idx').on(t.employeeId, t.workDate),
    check('shift_day_changes_reason_not_blank', sql`btrim(${t.reason}) <> ''`),
  ],
);

// Satu QR aktif per cabang (KEH-11). Buat ulang mengisi dead_at pada QR lama.
export const branchQrCodes = hrisSchema.table(
  'branch_qr_codes',
  {
    id: serial('id').primaryKey(),
    branchId: integer('branch_id').notNull().references(() => branches.id),
    code: text('code').notNull(),
    createdByAccountId: integer('created_by_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deadAt: timestamp('dead_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('branch_qr_codes_code_unique').on(t.code),
    uniqueIndex('branch_qr_codes_one_alive').on(t.branchId).where(sql`${t.deadAt} is null`),
  ],
);

// Hari tutup (KEH-79, KEH-105). Cabang kosong = semua cabang.
export const branchClosures = hrisSchema.table(
  'branch_closures',
  {
    id: serial('id').primaryKey(),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }).notNull(),
    branchId: integer('branch_id').references(() => branches.id),
    reason: text('reason').notNull(),
    backdated: boolean('backdated').notNull(),
    createdByAccountId: integer('created_by_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledByAccountId: integer('cancelled_by_account_id'),
    cancelReason: text('cancel_reason'),
  },
  (t) => [
    index('branch_closures_dates_idx').on(t.startDate, t.endDate),
    check('branch_closures_range', sql`${t.endDate} >= ${t.startDate}`),
    check('branch_closures_reason_not_blank', sql`btrim(${t.reason}) <> ''`),
    check('branch_closures_cancel_complete', sql`(${t.cancelledAt} is null) = (${t.cancelReason} is null)`),
  ],
);

// Peringatan pemeriksa giliran paling banyak sekali per cabang per minggu (spec L3a §6).
export const shiftCheckNotices = hrisSchema.table(
  'shift_check_notices',
  {
    branchId: integer('branch_id').notNull().references(() => branches.id),
    weekStart: date('week_start', { mode: 'string' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.branchId, t.weekStart] })],
);
