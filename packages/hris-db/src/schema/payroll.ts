import { sql } from 'drizzle-orm';
import { boolean, check, date, index, integer, jsonb, serial, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { branches } from './access';
import { employees } from './employees';
import { files } from './files';
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

// Gaji Bulanan L4b — peniadaan potongan telat dan denda kehadiran (spec L4b §2, GAJ-L10). Hitungan sendiri
// tidak disimpan (dihitung saat dibaca); yang disimpan hanya keputusan Pemilik/GM. Batal = tanda, bukan hapus.
export const payWaiverKind = hrisSchema.enum('pay_waiver_kind', ['LATE', 'FINE']);
export const payWaiverFineKind = hrisSchema.enum('pay_waiver_fine_kind', ['IN', 'OUT', 'RETURN', 'DAY_OFF_MISSING']);

export const payWaivers = hrisSchema.table(
  'pay_waivers',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    kind: payWaiverKind('kind').notNull(),
    workDate: date('work_date', { mode: 'string' }).notNull(),
    fineKind: payWaiverFineKind('fine_kind'),
    reason: text('reason').notNull(),
    createdByAccountId: integer('created_by_account_id').notNull(),
    createdByEmployeeId: integer('created_by_employee_id').notNull().references(() => employees.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledByAccountId: integer('cancelled_by_account_id'),
    cancelReason: text('cancel_reason'),
  },
  (t) => [
    uniqueIndex('pay_waivers_one_active_late').on(t.employeeId, t.workDate).where(sql`${t.kind} = 'LATE' and ${t.cancelledAt} is null`),
    uniqueIndex('pay_waivers_one_active_fine').on(t.employeeId, t.workDate, t.fineKind).where(sql`${t.kind} = 'FINE' and ${t.cancelledAt} is null`),
    index('pay_waivers_person_date_idx').on(t.employeeId, t.workDate),
    check('pay_waivers_fine_kind', sql`(${t.kind} = 'FINE') = (${t.fineKind} is not null)`),
    check('pay_waivers_not_self', sql`${t.employeeId} <> ${t.createdByEmployeeId}`),
    check('pay_waivers_reason_not_blank', sql`btrim(${t.reason}) <> ''`),
    check('pay_waivers_cancel_complete', sql`(${t.cancelledAt} is null) = (${t.cancelReason} is null)`),
  ],
);

// Gaji Bulanan L4c-1 — kehilangan barang dan minus kas (spec L4c §2). Bagian tiap orang dihitung saat dibaca;
// yang disimpan hanya catatan dan keputusan manusia. Tidak ada yang dihapus: batal/ditolak = status.
export const deductionRecordStatus = hrisSchema.enum('deduction_record_status', ['PENDING', 'ACTIVE', 'REJECTED', 'CANCELLED']);

// GAJ-76: satu kejadian kehilangan barang per cabang per tanggal ditemukan; lampiran hasil opname wajib.
export const inventoryLosses = hrisSchema.table(
  'inventory_losses',
  {
    id: serial('id').primaryKey(),
    branchId: integer('branch_id').notNull().references(() => branches.id),
    foundOn: date('found_on', { mode: 'string' }).notNull(),
    amount: integer('amount').notNull(),
    description: text('description').notNull(),
    attachmentFileId: uuid('attachment_file_id').notNull().references(() => files.id),
    status: deductionRecordStatus('status').notNull(),
    requestId: integer('request_id').references(() => requests.id),
    recordedByAccountId: integer('recorded_by_account_id').notNull(),
    recordedByEmployeeId: integer('recorded_by_employee_id').notNull().references(() => employees.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    approvedByAccountId: integer('approved_by_account_id'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledByAccountId: integer('cancelled_by_account_id'),
    cancelReason: text('cancel_reason'),
  },
  (t) => [
    index('inventory_losses_branch_date_idx').on(t.branchId, t.foundOn),
    uniqueIndex('inventory_losses_request_unique').on(t.requestId).where(sql`${t.requestId} is not null`),
    check('inventory_losses_amount_positive', sql`${t.amount} > 0`),
    check('inventory_losses_description_not_blank', sql`btrim(${t.description}) <> ''`),
    check('inventory_losses_active_approved', sql`${t.status} <> 'ACTIVE' or ${t.approvedAt} is not null`),
    check('inventory_losses_cancel_complete', sql`(${t.status} = 'CANCELLED') = (${t.cancelReason} is not null)`),
  ],
);

// Tautan akun kasir POS → karyawan (spec L4c §9 butir 6). Satu orang boleh banyak akun; satu akun satu orang.
export const posCashierLinks = hrisSchema.table(
  'pos_cashier_links',
  {
    id: serial('id').primaryKey(),
    // id pengguna POS (petshop.users); sengaja tanpa FK lintas schema.
    posUserId: integer('pos_user_id').notNull(),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    createdByAccountId: integer('created_by_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    releasedByAccountId: integer('released_by_account_id'),
    releaseReason: text('release_reason'),
  },
  (t) => [
    uniqueIndex('pos_cashier_links_one_active').on(t.posUserId).where(sql`${t.releasedAt} is null`),
    index('pos_cashier_links_employee_idx').on(t.employeeId),
    check('pos_cashier_links_release_complete', sql`(${t.releasedAt} is null) = (${t.releaseReason} is null)`),
  ],
);

// Usulan pengesahan minus kas POS: satu per orang per periode (+ susulan). OPEN → REVIEWED (HR) → APPROVED (Pemilik/GM).
export const cashShortageApprovals = hrisSchema.table(
  'cash_shortage_approvals',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    periodStart: date('period_start', { mode: 'string' }).notNull(),
    sequence: integer('sequence').notNull(),
    status: text('status').notNull().default('OPEN'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    reviewedByAccountId: integer('reviewed_by_account_id'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    approvedByAccountId: integer('approved_by_account_id'),
    approvedByEmployeeId: integer('approved_by_employee_id').references(() => employees.id),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('cash_shortage_approvals_unique').on(t.employeeId, t.periodStart, t.sequence),
    check('cash_shortage_approvals_status', sql`${t.status} in ('OPEN', 'REVIEWED', 'APPROVED')`),
    check('cash_shortage_approvals_period_start', sql`extract(day from ${t.periodStart}) = 26`),
    check('cash_shortage_approvals_not_self', sql`${t.approvedByEmployeeId} is null or ${t.approvedByEmployeeId} <> ${t.employeeId}`),
  ],
);

// Bagian satu kasir di satu shift POS terverifikasi (salinan mesin `cash-shortage-sync`, spec L4c §3.3).
export const cashShortages = hrisSchema.table(
  'cash_shortages',
  {
    id: serial('id').primaryKey(),
    posShiftId: integer('pos_shift_id').notNull(),
    posShiftNumber: integer('pos_shift_number').notNull(),
    posUserId: integer('pos_user_id').notNull(),
    kasirBranchId: integer('kasir_branch_id').notNull(),
    kasirBranchName: text('kasir_branch_name').notNull(),
    closedOn: date('closed_on', { mode: 'string' }).notNull(),
    category: text('category').notNull(),
    shiftVariance: integer('shift_variance'),
    cash: integer('cash').notNull(),
    shareTenths: integer('share_tenths').notNull(),
    /** Minus bernilai negatif, plus positif, tak wajar 0. */
    amount: integer('amount').notNull(),
    approvalId: integer('approval_id').references(() => cashShortageApprovals.id),
    /** Angka POS berubah sesudah usulannya disahkan: catatan angka lama untuk ditinjau ulang. */
    posChangedNote: text('pos_changed_note'),
    waivedAt: timestamp('waived_at', { withTimezone: true }),
    waivedByAccountId: integer('waived_by_account_id'),
    waiveReason: text('waive_reason'),
    syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('cash_shortages_shift_user_unique').on(t.posShiftId, t.posUserId),
    index('cash_shortages_closed_idx').on(t.closedOn),
    index('cash_shortages_approval_idx').on(t.approvalId),
    check('cash_shortages_category', sql`${t.category} in ('MINUS', 'PLUS', 'ANOMALY', 'TOLERATED')`),
    check('cash_shortages_waive_complete', sql`(${t.waivedAt} is null) = (${t.waiveReason} is null)`),
  ],
);

// Minus kas catat tangan (GAJ-79): bernama atau tanpa nama; penanggung dibekukan saat Berlaku.
export const manualCashShortages = hrisSchema.table(
  'manual_cash_shortages',
  {
    id: serial('id').primaryKey(),
    branchId: integer('branch_id').notNull().references(() => branches.id),
    occurredOn: date('occurred_on', { mode: 'string' }).notNull(),
    amount: integer('amount').notNull(),
    reason: text('reason').notNull(),
    /** Bernama: penanggung tunggal. Kosong = tanpa nama, dibagi rata ke yang hadir. */
    namedEmployeeId: integer('named_employee_id').references(() => employees.id),
    attachmentFileId: uuid('attachment_file_id').references(() => files.id),
    status: deductionRecordStatus('status').notNull(),
    requestId: integer('request_id').references(() => requests.id),
    recordedByAccountId: integer('recorded_by_account_id').notNull(),
    recordedByEmployeeId: integer('recorded_by_employee_id').notNull().references(() => employees.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    approvedByAccountId: integer('approved_by_account_id'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledByAccountId: integer('cancelled_by_account_id'),
    cancelReason: text('cancel_reason'),
  },
  (t) => [
    index('manual_cash_shortages_date_idx').on(t.occurredOn),
    uniqueIndex('manual_cash_shortages_request_unique').on(t.requestId).where(sql`${t.requestId} is not null`),
    check('manual_cash_shortages_amount_positive', sql`${t.amount} > 0`),
    check('manual_cash_shortages_reason_not_blank', sql`btrim(${t.reason}) <> ''`),
    check('manual_cash_shortages_active_approved', sql`${t.status} <> 'ACTIVE' or ${t.approvedAt} is not null`),
    check('manual_cash_shortages_cancel_complete', sql`(${t.status} = 'CANCELLED') = (${t.cancelReason} is not null)`),
  ],
);

export const manualCashShortageShares = hrisSchema.table(
  'manual_cash_shortage_shares',
  {
    id: serial('id').primaryKey(),
    manualCashShortageId: integer('manual_cash_shortage_id').notNull().references(() => manualCashShortages.id),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    amount: integer('amount').notNull(),
  },
  (t) => [
    uniqueIndex('manual_cash_shortage_shares_unique').on(t.manualCashShortageId, t.employeeId),
    check('manual_cash_shortage_shares_non_negative', sql`${t.amount} >= 0`),
  ],
);
