import { sql } from 'drizzle-orm';
import { boolean, check, date, index, integer, jsonb, serial, text, timestamp, uniqueIndex, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { branches } from './access';
import { employees } from './employees';
import { files } from './files';
import { requests } from './requests';
import { hrisSchema } from './shared';

// Gaji Bulanan L4a — komponen gaji (spec L4a §2). Tidak ada yang dihapus (PRI-02): pembatalan = tanda.

export const salaryChangeOrigin = hrisSchema.enum('salary_change_origin', ['DIRECT', 'PROPOSAL', 'STANDARD_PROMOTION', 'CORRECTION']);
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
    /** Pembetulan gaji periode lalu (L4g-2, GAJ-112): keberatan slip Disetujui yang ditunjuk; kosong = ditemukan kantor sendiri. */
    objectionId: integer('objection_id').references((): AnyPgColumn => payslipObjections.id),
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
export const deductionRecordStatus = hrisSchema.enum('deduction_record_status', ['PENDING', 'ACTIVE', 'REJECTED', 'CANCELLED', 'WAIVED']);

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

// Gaji Bulanan L4c-2 — Potongan Lain dan Keberatan Potongan (spec L4c §3.5, §3.6). Sisa tidak disimpan: dihitung
// dari cicilan. Ubah jadwal = cicilan lama yang belum terpotong ditandai batal, lalu jadwal baru ditulis.
export const otherDeductionTypes = hrisSchema.table(
  'other_deduction_types',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('other_deduction_types_name_unique').on(sql`lower(${t.name})`),
    check('other_deduction_types_name_not_blank', sql`btrim(${t.name}) <> ''`),
  ],
);

export const otherDeductions = hrisSchema.table(
  'other_deductions',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    typeId: integer('type_id').notNull().references(() => otherDeductionTypes.id),
    amount: integer('amount').notNull(),
    reason: text('reason').notNull(),
    installments: integer('installments').notNull(),
    attachmentFileId: uuid('attachment_file_id').references(() => files.id),
    /** PENDING usulan HR · ACTIVE berjalan · REJECTED ditolak · CANCELLED dibatalkan · WAIVED ditiadakan lewat keberatan. */
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
    /** Hapuskan sisa (L4e-2, Pemilik/GM): cicilan yang belum terpotong ditandai batal; yang sudah terpotong tetap. */
    writtenOffAt: timestamp('written_off_at', { withTimezone: true }),
    writtenOffByAccountId: integer('written_off_by_account_id'),
    writeOffReason: text('write_off_reason'),
  },
  (t) => [
    index('other_deductions_employee_idx').on(t.employeeId),
    check('other_deductions_write_off_complete', sql`(${t.writtenOffAt} is null) = (${t.writeOffReason} is null)`),
    uniqueIndex('other_deductions_request_unique').on(t.requestId).where(sql`${t.requestId} is not null`),
    check('other_deductions_amount_positive', sql`${t.amount} > 0`),
    check('other_deductions_installments_range', sql`${t.installments} between 1 and 3`),
    check('other_deductions_reason_not_blank', sql`btrim(${t.reason}) <> ''`),
    check('other_deductions_not_self', sql`${t.employeeId} <> ${t.recordedByEmployeeId}`),
    check('other_deductions_active_approved', sql`${t.status}::text not in ('ACTIVE', 'WAIVED') or ${t.approvedAt} is not null`),
    check('other_deductions_cancel_complete', sql`(${t.status}::text in ('CANCELLED', 'WAIVED')) = (${t.cancelReason} is not null)`),
  ],
);

export const otherDeductionInstallments = hrisSchema.table(
  'other_deduction_installments',
  {
    id: serial('id').primaryKey(),
    deductionId: integer('deduction_id').notNull().references(() => otherDeductions.id),
    sequence: integer('sequence').notNull(),
    periodStart: date('period_start', { mode: 'string' }).notNull(),
    amount: integer('amount').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** Diganti jadwal baru (Ubah jadwal) atau ikut batal bersama potongannya. */
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  },
  (t) => [
    index('other_deduction_installments_deduction_idx').on(t.deductionId),
    index('other_deduction_installments_period_idx').on(t.periodStart),
    check('other_deduction_installments_amount_positive', sql`${t.amount} > 0`),
    check('other_deduction_installments_period_start', sql`extract(day from ${t.periodStart}) = 26`),
  ],
);

// Keberatan Potongan (GAJ-81): isi khas pengajuan `deduction_objection`. Disetujui = Ditiadakan, ditolak = Tetap.
export const deductionObjectionTarget = hrisSchema.enum('deduction_objection_target', ['CASH_SHORTAGE', 'MANUAL_CASH_SHORTAGE', 'OTHER_DEDUCTION']);

export const deductionObjections = hrisSchema.table(
  'deduction_objections',
  {
    id: serial('id').primaryKey(),
    requestId: integer('request_id').notNull().references(() => requests.id),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    target: deductionObjectionTarget('target').notNull(),
    /** id usulan minus POS (cash_shortage_approvals), minus catat tangan, atau Potongan Lain. */
    targetId: integer('target_id').notNull(),
    reason: text('reason').notNull(),
    /** OPEN menunggu; WAIVED ditiadakan; KEPT tetap; CLOSED dibatalkan pengaju. */
    state: text('state').notNull().default('OPEN'),
  },
  (t) => [
    uniqueIndex('deduction_objections_request_unique').on(t.requestId),
    index('deduction_objections_target_idx').on(t.target, t.targetId),
    check('deduction_objections_state', sql`${t.state} in ('OPEN', 'WAIVED', 'KEPT', 'CLOSED')`),
  ],
);

// ---- L4d-1 Buku Bonus (spec L4d §2) ----

/**
 * Jenis bonus yang diketik (L4d-2, spec L4d §2, §3.1): isi awal "Bonus Bebas"; Pemilik/GM boleh menambah jenis.
 * Grooming dan Ongkir tetap ditetapkan di kode (lahir dari kasir). Tidak dihapus: dinonaktifkan.
 */
export const bonusTypes = hrisSchema.table(
  'bonus_types',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    /** Sumber dana bawaan saat dicatat: OFFICE (uang kantor) atau DISCIPLINE_FUND (Dana Disiplin). */
    defaultFund: text('default_fund').notNull().default('OFFICE'),
    sortOrder: integer('sort_order').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('bonus_types_name_unique').on(sql`lower(${t.name})`),
    check('bonus_types_name_not_blank', sql`btrim(${t.name}) <> ''`),
    check('bonus_types_default_fund', sql`${t.defaultFund} in ('OFFICE', 'DISCIPLINE_FUND')`),
  ],
);

// Pasangkan Groomer & Pengantar (PRD 04 §3.3): nama di daftar groomer POS → karyawan, atau "bukan karyawan HRIS".
export const posGroomerLinks = hrisSchema.table(
  'pos_groomer_links',
  {
    id: serial('id').primaryKey(),
    // id petshop.groomers; sengaja tanpa FK lintas schema.
    posGroomerId: integer('pos_groomer_id').notNull(),
    employeeId: integer('employee_id').references(() => employees.id),
    /** Bukan karyawan HRIS (mis. pekerja lepas): bonusnya tidak dicatat di HRIS (spec L4d §9 butir 5). */
    notEmployee: boolean('not_employee').notNull().default(false),
    note: text('note'),
    createdByAccountId: integer('created_by_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    releasedByAccountId: integer('released_by_account_id'),
    releaseReason: text('release_reason'),
  },
  (t) => [
    uniqueIndex('pos_groomer_links_one_active').on(t.posGroomerId).where(sql`${t.releasedAt} is null`),
    index('pos_groomer_links_employee_idx').on(t.employeeId),
    check('pos_groomer_links_target', sql`(${t.employeeId} is not null) <> ${t.notEmployee}`),
    check('pos_groomer_links_not_employee_note', sql`not ${t.notEmployee} or ${t.note} is not null`),
    check('pos_groomer_links_release_complete', sql`(${t.releasedAt} is null) = (${t.releaseReason} is null)`),
  ],
);

/**
 * Satu baris Buku Bonus (GAJ-24, 83). Hanya ditulis pintu `recordBonus`. Tidak dihapus: salah = Ditolak/Dibatalkan beralasan.
 * HELD Ditahan → PENDING Menunggu → APPROVED Disahkan; REJECTED Ditolak; CANCELLED Dibatalkan (termasuk diganti baris baru).
 */
export const bonusEntries = hrisSchema.table(
  'bonus_entries',
  {
    id: serial('id').primaryKey(),
    /** GROOMING, DELIVERY (ongkir), TYPED (jenis ketik L4d-2: Bonus Bebas dan jenis tambahan, lihat `typeId`). */
    kind: text('kind').notNull(),
    /** Jenis ketik (L4d-2); wajib untuk TYPED. */
    typeId: integer('type_id').references(() => bonusTypes.id),
    /** Usulan HR lewat Mesin Pengajuan (L4d-2, `free_bonus`). */
    requestId: integer('request_id').references(() => requests.id),
    /** Pencatat Bonus Bebas (L4d-2); bukan penerimanya sendiri. */
    recordedByAccountId: integer('recorded_by_account_id'),
    recordedByEmployeeId: integer('recorded_by_employee_id').references(() => employees.id),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    occurredOn: date('occurred_on', { mode: 'string' }).notNull(),
    periodStart: date('period_start', { mode: 'string' }).notNull(),
    kasirBranchId: integer('kasir_branch_id'),
    branchName: text('branch_name').notNull(),
    /** Dasar hitungan (nilai bersih jasa/ongkir); koreksi = selisih nominal. */
    baseAmount: integer('base_amount').notNull(),
    percent: integer('percent'),
    amount: integer('amount').notNull(),
    fund: text('fund').notNull().default('OFFICE'),
    status: text('status').notNull(),
    /** GROOMER_CHANGED (⚠ ganti groomer), CHANGED_FROM_POS (berubah dari kasir), CORRECTION (koreksi sesudah disahkan). */
    flag: text('flag'),
    /** Kunci asal pencegah dobel, mis. GROOMING:123, DELIVERY:45, CORRECTION:7. */
    originKey: text('origin_key').notNull(),
    posRefId: integer('pos_ref_id'),
    posGroomerId: integer('pos_groomer_id'),
    trxNumber: text('trx_number'),
    serviceName: text('service_name'),
    /** Baris yang digantikan baris ini (perubahan dari kasir sebelum final). */
    replacesId: integer('replaces_id'),
    /** "berubah dari … menjadi …" atau periode asal koreksi. */
    note: text('note'),
    reason: text('reason'),
    decidedByAccountId: integer('decided_by_account_id'),
    decidedByEmployeeId: integer('decided_by_employee_id').references(() => employees.id),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    /** Slip tertutup yang memuat baris ini (status IN_SLIP, L4e-1). */
    payslipId: integer('payslip_id').references(() => payslips.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('bonus_entries_origin_live').on(t.originKey).where(sql`${t.status} <> 'CANCELLED'`),
    index('bonus_entries_employee_period_idx').on(t.employeeId, t.periodStart),
    index('bonus_entries_period_idx').on(t.periodStart, t.kind),
    check('bonus_entries_status', sql`${t.status} in ('HELD', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'IN_SLIP', 'FORFEITED', 'PAID_OUTSIDE')`),
    // PAID_OUTSIDE Dibayar di luar slip (L4f-2, GAJ-89): lewat tagihan `off_slip_claims`, tanpa slip.
    // FORFEITED Hangus (L4e-2, GAJ-58): slip terakhir berhenti tanpa pemberitahuan; slipnya dicatat supaya Buka kembali bisa membalik.
    check('bonus_entries_in_slip', sql`(${t.status} in ('IN_SLIP', 'FORFEITED')) = (${t.payslipId} is not null)`),
    check('bonus_entries_kind', sql`${t.kind} in ('GROOMING', 'DELIVERY', 'TYPED')`),
    check('bonus_entries_typed_type', sql`(${t.kind} = 'TYPED') = (${t.typeId} is not null)`),
    check('bonus_entries_not_self_recorded', sql`${t.recordedByEmployeeId} is null or ${t.recordedByEmployeeId} <> ${t.employeeId}`),
    uniqueIndex('bonus_entries_request_unique').on(t.requestId).where(sql`${t.requestId} is not null`),
    check('bonus_entries_fund', sql`${t.fund} in ('OFFICE', 'DISCIPLINE_FUND')`),
    check('bonus_entries_period_start', sql`extract(day from ${t.periodStart}) = 26`),
    check('bonus_entries_amount_sign', sql`${t.amount} >= 0 or ${t.flag} = 'CORRECTION'`),
    check('bonus_entries_reason_needed', sql`${t.status} not in ('REJECTED', 'CANCELLED') or ${t.reason} is not null`),
    check('bonus_entries_not_self', sql`${t.decidedByEmployeeId} is null or ${t.decidedByEmployeeId} <> ${t.employeeId}`),
  ],
);

/** Perubahan dari kasir atas bonus yang sudah final (GAJ-90, PRI-41): HR memilih Terima perubahan atau Biarkan. */
export const bonusPosChanges = hrisSchema.table(
  'bonus_pos_changes',
  {
    id: serial('id').primaryKey(),
    entryId: integer('entry_id').notNull().references(() => bonusEntries.id),
    /** Keadaan POS terbaru: { cancelled, posGroomerId, employeeId, baseAmount, amount, text }. */
    after: jsonb('after').notNull(),
    status: text('status').notNull().default('OPEN'),
    reason: text('reason'),
    correctionEntryId: integer('correction_entry_id').references(() => bonusEntries.id),
    decidedByAccountId: integer('decided_by_account_id'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('bonus_pos_changes_one_open').on(t.entryId).where(sql`${t.status} = 'OPEN'`),
    check('bonus_pos_changes_status', sql`${t.status} in ('OPEN', 'ACCEPTED', 'IGNORED')`),
    check('bonus_pos_changes_decided', sql`${t.status} = 'OPEN' or ${t.reason} is not null`),
  ],
);

// ---- L4d-2 Dana Disiplin & Dana Tidak Hadir (spec L4d §2, §3.4) ----

/**
 * Buku mutasi dua dana perusahaan (GAJ-33 s.d. 35, 87, 88). Saldo = jumlah `amount` (bertanda). Tidak diubah dan tidak
 * dihapus: salah isi dibetulkan dengan penyesuaian baru. Pindah = dua baris dengan `transferGroup` yang sama.
 * Mutasi saat slip ditutup (telat/denda, alpha/izin/sakit, lembur/kompensasi, bonus bersumber dana) ditambah 4E-5a.
 */
export const fundEntries = hrisSchema.table(
  'fund_entries',
  {
    id: serial('id').primaryKey(),
    /** DISCIPLINE (Dana Disiplin) · ABSENCE (Dana Tidak Hadir). */
    fund: text('fund').notNull(),
    /** OPENING saldo awal · ADJUSTMENT sesuaikan · TRANSFER pindah. */
    kind: text('kind').notNull(),
    amount: integer('amount').notNull(),
    /** Cabang asal (mutasi slip 4E-5a); kosong untuk saldo awal, penyesuaian, dan pindah. */
    branchId: integer('branch_id').references(() => branches.id),
    periodStart: date('period_start', { mode: 'string' }),
    reason: text('reason').notNull(),
    transferGroup: uuid('transfer_group'),
    bonusEntryId: integer('bonus_entry_id').references(() => bonusEntries.id),
    /** Slip yang ditutup (jenis SLIP, L4e-1). */
    payslipId: integer('payslip_id').references(() => payslips.id),
    /** Tagihan bayar di luar slip (jenis OFF_SLIP, L4f-2). */
    claimId: integer('claim_id').references(() => offSlipClaims.id),
    createdByAccountId: integer('created_by_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('fund_entries_fund_idx').on(t.fund, t.createdAt),
    uniqueIndex('fund_entries_one_opening').on(t.fund).where(sql`${t.kind} = 'OPENING'`),
    check('fund_entries_fund', sql`${t.fund} in ('DISCIPLINE', 'ABSENCE')`),
    check('fund_entries_kind', sql`${t.kind} in ('OPENING', 'ADJUSTMENT', 'TRANSFER', 'SLIP', 'OFF_SLIP')`),
    check('fund_entries_off_slip', sql`(${t.kind} = 'OFF_SLIP') = (${t.claimId} is not null)`),
    check('fund_entries_slip', sql`(${t.kind} = 'SLIP') = (${t.payslipId} is not null)`),
    check('fund_entries_amount', sql`${t.amount} <> 0 or ${t.kind} = 'OPENING'`),
    check('fund_entries_opening_positive', sql`${t.kind} <> 'OPENING' or ${t.amount} >= 0`),
    check('fund_entries_reason_not_blank', sql`btrim(${t.reason}) <> ''`),
    check('fund_entries_transfer_group', sql`(${t.kind} = 'TRANSFER') = (${t.transferGroup} is not null)`),
  ],
);

// ---- L4e-1 Periode Slip dan Tutup Slip (spec L4e §2) ----

/**
 * Satu slip bulanan per orang per periode (GAJ-91). Lahir sebagai kerangka ESTIMATE (angka dihitung saat diminta);
 * CLOSED = angka tersimpan di `payslip_lines`. Nomor diberikan saat pertama ditutup dan tidak berubah (GAJ-97).
 */
export const payslips = hrisSchema.table(
  'payslips',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    periodStart: date('period_start', { mode: 'string' }).notNull(),
    kind: text('kind').notNull().default('MONTHLY'),
    status: text('status').notNull().default('ESTIMATE'),
    number: text('number'),
    version: integer('version').notNull().default(0),
    branchId: integer('branch_id').references(() => branches.id),
    branchName: text('branch_name'),
    positionName: text('position_name'),
    income: integer('income'),
    taken: integer('taken'),
    net: integer('net'),
    carried: integer('carried'),
    lastSlip: boolean('last_slip').notNull().default(false),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    closedByAccountId: integer('closed_by_account_id'),
    objectionUntil: timestamp('objection_until', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('payslips_person_period_kind').on(t.employeeId, t.periodStart, t.kind),
    uniqueIndex('payslips_number_unique').on(t.number).where(sql`${t.number} is not null`),
    index('payslips_period_idx').on(t.periodStart, t.status),
    check('payslips_kind', sql`${t.kind} in ('MONTHLY')`),
    check('payslips_status', sql`${t.status} in ('ESTIMATE', 'CLOSED')`),
    check('payslips_period_start', sql`extract(day from ${t.periodStart}) = 26`),
    check('payslips_closed_complete', sql`${t.status} <> 'CLOSED' or (${t.number} is not null and ${t.net} is not null and ${t.closedAt} is not null and ${t.objectionUntil} is not null)`),
    check('payslips_net_not_negative', sql`${t.net} is null or ${t.net} >= 0`),
  ],
);

/** Baris slip tersimpan saat ditutup (GAJ-94 langkah 4). Tidak diubah; versi lama ditandai REPLACED saat dibuka kembali (L4e-2). */
export const payslipLines = hrisSchema.table(
  'payslip_lines',
  {
    id: serial('id').primaryKey(),
    payslipId: integer('payslip_id').notNull().references(() => payslips.id),
    version: integer('version').notNull(),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    /** INCOME · DEDUCTION · NOTE. */
    section: text('section').notNull(),
    /** Kelompok potongan a–d (hanya DEDUCTION). */
    deductionGroup: text('deduction_group'),
    /** Kunci sumber, mis. att:LATE, bonus:12, loss:7, pos:2026-10-26, manual:4, other:55, carry:9. */
    sourceKey: text('source_key').notNull(),
    /** Jenis baris asal (mis. LATE, ALPHA, BASE, GROOMING) untuk mutasi dana dan sisa potongan. */
    lineKind: text('line_kind').notNull(),
    label: text('label').notNull(),
    originPeriod: date('origin_period', { mode: 'string' }),
    amount: integer('amount').notNull(),
    taken: integer('taken').notNull().default(0),
    remaining: integer('remaining').notNull().default(0),
    details: jsonb('details'),
    sortOrder: integer('sort_order').notNull(),
    status: text('status').notNull().default('ACTIVE'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('payslip_lines_slip_idx').on(t.payslipId, t.version),
    index('payslip_lines_source_idx').on(t.employeeId, t.sourceKey),
    check('payslip_lines_section', sql`${t.section} in ('INCOME', 'DEDUCTION', 'NOTE')`),
    check('payslip_lines_group', sql`(${t.section} = 'DEDUCTION') = (${t.deductionGroup} is not null)`),
    check('payslip_lines_status', sql`${t.status} in ('ACTIVE', 'REPLACED')`),
    check('payslip_lines_amounts', sql`${t.amount} >= 0 and ${t.taken} >= 0 and ${t.remaining} >= 0 and ${t.taken} + ${t.remaining} <= ${t.amount}`),
  ],
);

/** Sisa potongan yang tidak tertampung slip (GAJ-52, 75): Dibawa ke slip berikutnya dan diambil lebih dulu di kelompoknya. */
export const deductionCarryovers = hrisSchema.table(
  'deduction_carryovers',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    fromPayslipId: integer('from_payslip_id').notNull().references(() => payslips.id),
    deductionGroup: text('deduction_group').notNull(),
    lineKind: text('line_kind').notNull(),
    label: text('label').notNull(),
    originPeriod: date('origin_period', { mode: 'string' }).notNull(),
    amount: integer('amount').notNull(),
    /** CARRIED Dibawa · TAKEN Terpotong · CANCELLED (slip asal dibuka kembali, L4e-2). */
    status: text('status').notNull().default('CARRIED'),
    /** Kunci sumber baris asal (L4e-2): sisa dari sumber yang kemudian ditiadakan lewat keberatan tidak diambil lagi. */
    sourceKey: text('source_key'),
    takenInPayslipId: integer('taken_in_payslip_id').references(() => payslips.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('deduction_carryovers_person_idx').on(t.employeeId, t.status),
    check('deduction_carryovers_group', sql`${t.deductionGroup} in ('a', 'b', 'c', 'd')`),
    check('deduction_carryovers_status', sql`${t.status} in ('CARRIED', 'TAKEN', 'CANCELLED')`),
    check('deduction_carryovers_amount', sql`${t.amount} > 0`),
    check('deduction_carryovers_taken_in', sql`(${t.status} = 'TAKEN') = (${t.takenInPayslipId} is not null)`),
  ],
);

/** Jejak langkah slip (GAJ-L28 tab Riwayat): tutup, cetak; buka kembali di L4e-2. Hanya tambah. */
export const payslipSteps = hrisSchema.table(
  'payslip_steps',
  {
    id: serial('id').primaryKey(),
    payslipId: integer('payslip_id').references(() => payslips.id),
    periodStart: date('period_start', { mode: 'string' }).notNull(),
    action: text('action').notNull(),
    reason: text('reason'),
    summary: jsonb('summary'),
    actorAccountId: integer('actor_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('payslip_steps_period_idx').on(t.periodStart, t.createdAt),
    index('payslip_steps_slip_idx').on(t.payslipId),
    check('payslip_steps_action', sql`${t.action} in ('CLOSE', 'PRINT', 'PRINT_MANY', 'REOPEN', 'REOPEN_REQUEST', 'EARLY_CLOSE', 'PAY', 'PAY_CANCEL', 'PAY_ZERO', 'TRANSFER_VIEW', 'TRANSFER_DOWNLOAD', 'SELF_DOWNLOAD', 'SELF_DOWNLOAD_MANY', 'TOTALS_DOWNLOAD')`),
  ],
);

// ---- L4e-2 Piutang Lain (spec L4e §2, §3.7; GAJ-82, 96) ----

/**
 * Sisa potongan kelompok (b) dan (c) yang tidak tertampung slip terakhir: satu baris per kelompok per slip.
 * OPEN Terbuka · WRITTEN_OFF Dihapuskan (Pemilik/GM, alasan) · REVERSED slip asalnya dibuka kembali. Tidak dihapus.
 */
export const otherReceivables = hrisSchema.table(
  'other_receivables',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    payslipId: integer('payslip_id').notNull().references(() => payslips.id),
    deductionGroup: text('deduction_group').notNull(),
    amount: integer('amount').notNull(),
    status: text('status').notNull().default('OPEN'),
    reason: text('reason'),
    decidedByAccountId: integer('decided_by_account_id'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** SLIP sisa slip terakhir (L4e-2) · PAST_CORRECTION koreksi minus sesudah slip terakhir Dibayar (L4g-2, spec L4g §9 butir 8). */
    origin: text('origin').notNull().default('SLIP'),
    /** Kunci koreksi asal, mis. `corr:2026-09-26:LATE` (hanya PAST_CORRECTION). */
    sourceKey: text('source_key'),
    /** Uraian koreksi (hanya PAST_CORRECTION). */
    label: text('label'),
  },
  (t) => [
    index('other_receivables_employee_idx').on(t.employeeId, t.status),
    index('other_receivables_payslip_idx').on(t.payslipId),
    // Kelompok (a) hanya untuk koreksi minus kehadiran sesudah slip terakhir (PAST_CORRECTION).
    check('other_receivables_group', sql`${t.deductionGroup} in ('b', 'c', 'd') or (${t.deductionGroup} = 'a' and ${t.origin} = 'PAST_CORRECTION')`),
    check('other_receivables_origin', sql`${t.origin} in ('SLIP', 'PAST_CORRECTION')`),
    check('other_receivables_origin_key', sql`(${t.origin} = 'PAST_CORRECTION') = (${t.sourceKey} is not null)`),
    // SETTLED Lunas (L4f-2): habis dipotong tagihan bayar di luar slip (`receivable_settlements`).
    check('other_receivables_status', sql`${t.status} in ('OPEN', 'WRITTEN_OFF', 'REVERSED', 'SETTLED')`),
    check('other_receivables_amount', sql`${t.amount} > 0`),
    check('other_receivables_written_off', sql`${t.status} <> 'WRITTEN_OFF' or (${t.reason} is not null and ${t.decidedAt} is not null)`),
  ],
);

// ---- L4f-1 Bayar Slip (spec L4f §2) ----

/** Sumber Uang untuk membayar gaji (PRD 06 §3.3). Tidak dihapus, hanya dinonaktifkan. */
export const paymentSources = hrisSchema.table(
  'payment_sources',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    /** CASH tunai · TRANSFER rekening. */
    method: text('method').notNull(),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('payment_sources_name_unique').on(sql`lower(${t.name})`),
    check('payment_sources_method', sql`${t.method} in ('CASH', 'TRANSFER')`),
    check('payment_sources_name_not_blank', sql`btrim(${t.name}) <> ''`),
  ],
);

/** Satu kali menekan Bayar (satu sumber uang, satu tanggal uang, satu foto bukti untuk banyak slip). */
export const payBatches = hrisSchema.table(
  'pay_batches',
  {
    id: serial('id').primaryKey(),
    paidByAccountId: integer('paid_by_account_id').notNull(),
    sourceId: integer('source_id').notNull().references(() => paymentSources.id),
    moneyDate: date('money_date', { mode: 'string' }).notNull(),
    /** Wajib bila tanggal uang mundur lebih dari 7 hari (GAJ-99). */
    dateReason: text('date_reason'),
    proofFileId: uuid('proof_file_id').references(() => files.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
);

/**
 * Pembayaran slip (GAJ-48, 98): sekali dan penuh sebesar bersih slip. Slip "Dibayar" = punya pembayaran ACTIVE (status slip tetap CLOSED).
 * MONEY dibayar dengan uang · NO_MONEY slip bersih Rp0 (GAJ-102). Batal bayar = CANCELLED, tidak dihapus.
 */
export const payslipPayments = hrisSchema.table(
  'payslip_payments',
  {
    id: serial('id').primaryKey(),
    /** Slip yang dibayar; kosong untuk pembayaran tagihan luar slip (L4f-2). Tepat satu dari `payslipId` / `claimId`. */
    payslipId: integer('payslip_id').references(() => payslips.id),
    claimId: integer('claim_id').references(() => offSlipClaims.id),
    batchId: integer('batch_id').references(() => payBatches.id),
    kind: text('kind').notNull(),
    amount: integer('amount').notNull(),
    moneyDate: date('money_date', { mode: 'string' }).notNull(),
    method: text('method'),
    sourceId: integer('source_id').references(() => paymentSources.id),
    paidByAccountId: integer('paid_by_account_id').notNull(),
    /** Uraian untuk app Keuangan kelak (GAJ-56): cabang slip, gaji Pemilik/GM, pendapatan, terpotong per kelompok, dana. */
    breakdown: jsonb('breakdown'),
    /** 4 angka terakhir rekening tujuan saat dibayar (transfer saja), untuk status bayar di Slip Saya (spec L4g §2). */
    accountTail: text('account_tail'),
    status: text('status').notNull().default('ACTIVE'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledByAccountId: integer('cancelled_by_account_id'),
    cancelReason: text('cancel_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('payslip_payments_one_active').on(t.payslipId).where(sql`${t.status} = 'ACTIVE'`),
    uniqueIndex('payslip_payments_one_active_claim').on(t.claimId).where(sql`${t.status} = 'ACTIVE'`),
    check('payslip_payments_target', sql`(${t.payslipId} is null) <> (${t.claimId} is null)`),
    index('payslip_payments_batch_idx').on(t.batchId),
    check('payslip_payments_kind', sql`${t.kind} in ('MONEY', 'NO_MONEY')`),
    check('payslip_payments_status', sql`${t.status} in ('ACTIVE', 'CANCELLED')`),
    check('payslip_payments_money', sql`${t.kind} <> 'MONEY' or (${t.amount} > 0 and ${t.batchId} is not null and ${t.sourceId} is not null and ${t.method} in ('CASH', 'TRANSFER'))`),
    check('payslip_payments_no_money', sql`${t.kind} <> 'NO_MONEY' or (${t.amount} = 0 and ${t.batchId} is null)`),
    check('payslip_payments_cancelled', sql`(${t.status} = 'CANCELLED') = (${t.cancelledAt} is not null)`),
  ],
);

// ---- L4f-2 Bayar di luar slip (spec L4f §2, §3.7; GAJ-89, 96, 106) ----

/**
 * Tagihan bayar di luar slip: bonus Disahkan atau koreksi plus untuk orang yang slip terakhirnya sudah Dibayar.
 * Lahir otomatis (kunci asal unik selama tidak dibatalkan). WAITING Menunggu · PAID Dibayar · CANCELLED Dibatalkan. Tidak dihapus.
 */
export const offSlipClaims = hrisSchema.table(
  'off_slip_claims',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    /** Slip terakhir orang itu yang sudah Dibayar saat tagihan lahir. */
    lastPayslipId: integer('last_payslip_id').notNull().references(() => payslips.id),
    /** Kunci asal unik, mis. `bonus:123` atau `corr:2026-10-26:LATE#1`. */
    originKey: text('origin_key').notNull(),
    /** Kunci sumber tanpa urutan, mis. `corr:2026-10-26:LATE` (koreksi bisa bertambah lagi sesudah dibayar). */
    sourceKey: text('source_key').notNull(),
    /** BONUS · CORRECTION (koreksi plus dan pengembalian). */
    kind: text('kind').notNull(),
    /** Jenis baris asal (GROOMING, TYPED, LATE, …): dasar mutasi dana. */
    lineKind: text('line_kind').notNull(),
    label: text('label').notNull(),
    bonusEntryId: integer('bonus_entry_id').references(() => bonusEntries.id),
    /** DISCIPLINE_FUND bila bonus bersumber Dana Disiplin. */
    fund: text('fund'),
    branchId: integer('branch_id').references(() => branches.id),
    branchName: text('branch_name'),
    originPeriod: date('origin_period', { mode: 'string' }),
    amount: integer('amount').notNull(),
    status: text('status').notNull().default('WAITING'),
    cancelReason: text('cancel_reason'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('off_slip_claims_origin_live').on(t.originKey).where(sql`${t.status} <> 'CANCELLED'`),
    index('off_slip_claims_employee_idx').on(t.employeeId, t.status),
    check('off_slip_claims_kind', sql`${t.kind} in ('BONUS', 'CORRECTION')`),
    check('off_slip_claims_status', sql`${t.status} in ('WAITING', 'PAID', 'CANCELLED')`),
    check('off_slip_claims_amount', sql`${t.amount} > 0`),
    check('off_slip_claims_bonus', sql`(${t.kind} = 'BONUS') = (${t.bonusEntryId} is not null)`),
    check('off_slip_claims_cancelled', sql`(${t.status} = 'CANCELLED') = (${t.cancelledAt} is not null)`),
  ],
);

/** Cicilan Piutang Lain dari tagihan luar slip, tanpa uang bergerak (Y5). ACTIVE · REVERSED (batal bayar). Tidak dihapus. */
export const receivableSettlements = hrisSchema.table(
  'receivable_settlements',
  {
    id: serial('id').primaryKey(),
    receivableId: integer('receivable_id').notNull().references(() => otherReceivables.id),
    claimId: integer('claim_id').notNull().references(() => offSlipClaims.id),
    amount: integer('amount').notNull(),
    status: text('status').notNull().default('ACTIVE'),
    createdByAccountId: integer('created_by_account_id').notNull(),
    reversedAt: timestamp('reversed_at', { withTimezone: true }),
    reversedByAccountId: integer('reversed_by_account_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('receivable_settlements_receivable_idx').on(t.receivableId, t.status),
    index('receivable_settlements_claim_idx').on(t.claimId),
    check('receivable_settlements_amount', sql`${t.amount} > 0`),
    check('receivable_settlements_status', sql`${t.status} in ('ACTIVE', 'REVERSED')`),
    check('receivable_settlements_reversed', sql`(${t.status} = 'REVERSED') = (${t.reversedAt} is not null)`),
  ],
);

// ---- L4g-2 Keberatan Slip (spec L4g §2, §3.5–3.6; GAJ-110, 111) ----

/**
 * Isi khas pengajuan keberatan slip. WRONG "Ada yang salah di slip" · NOT_RECEIVED "Uang belum saya terima".
 * `state`: PENDING menunggu · APPROVED disetujui · REJECTED ditolak · CLOSED dibatalkan/hangus. Satu PENDING per slip per macam.
 * Sesudah disetujui `fixStatus` WAITING_FIX sampai penyetuju menautkan catatan pembetulnya (FIXED). Tidak dihapus.
 */
export const payslipObjections = hrisSchema.table(
  'payslip_objections',
  {
    id: serial('id').primaryKey(),
    requestId: integer('request_id').notNull().references(() => requests.id),
    payslipId: integer('payslip_id').notNull().references(() => payslips.id),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    /** Versi slip saat diajukan; status slip saat diajukan (ESTIMATE / CLOSED). */
    slipVersion: integer('slip_version').notNull(),
    slipStatus: text('slip_status').notNull(),
    kind: text('kind').notNull(),
    /** Baris yang dikeberati: kunci sumber + label + nominal saat diajukan; kosong = Lainnya. */
    lines: jsonb('lines').notNull().default(sql`'[]'::jsonb`),
    /** Pembayaran yang dikeberati (NOT_RECEIVED). */
    paymentId: integer('payment_id').references(() => payslipPayments.id),
    reason: text('reason').notNull(),
    state: text('state').notNull().default('PENDING'),
    /** Jalan pembetulan yang dipilih penyetuju saat menyetujui. */
    fixPath: text('fix_path'),
    fixStatus: text('fix_status').notNull().default('NONE'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedByAccountId: integer('approved_by_account_id'),
    /** Catatan pembetul: jenis (lihat FIX_KINDS di modul gaji) + id + uraian saat ditautkan. */
    fixKind: text('fix_kind'),
    fixId: integer('fix_id'),
    fixText: text('fix_text'),
    linkedAt: timestamp('linked_at', { withTimezone: true }),
    linkedByAccountId: integer('linked_by_account_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('payslip_objections_request_unique').on(t.requestId),
    uniqueIndex('payslip_objections_one_pending').on(t.payslipId, t.kind).where(sql`${t.state} = 'PENDING'`),
    index('payslip_objections_employee_idx').on(t.employeeId, t.state),
    index('payslip_objections_fix_idx').on(t.fixStatus),
    check('payslip_objections_kind', sql`${t.kind} in ('WRONG', 'NOT_RECEIVED')`),
    check('payslip_objections_slip_status', sql`${t.slipStatus} in ('ESTIMATE', 'CLOSED')`),
    check('payslip_objections_state', sql`${t.state} in ('PENDING', 'APPROVED', 'REJECTED', 'CLOSED')`),
    check('payslip_objections_fix_path', sql`${t.fixPath} is null or ${t.fixPath} in ('SOURCE', 'REOPEN', 'PAST_CORRECTION', 'SALARY_CORRECTION', 'CANCEL_PAYMENT')`),
    check('payslip_objections_fix_status', sql`${t.fixStatus} in ('NONE', 'WAITING_FIX', 'FIXED')`),
    check('payslip_objections_payment', sql`(${t.kind} = 'NOT_RECEIVED') = (${t.paymentId} is not null)`),
    check('payslip_objections_approved', sql`(${t.state} = 'APPROVED') = (${t.approvedAt} is not null and ${t.fixPath} is not null)`),
    check('payslip_objections_waiting', sql`${t.fixStatus} = 'NONE' or ${t.state} = 'APPROVED'`),
    check('payslip_objections_linked', sql`(${t.fixStatus} = 'FIXED') = (${t.linkedAt} is not null and ${t.fixKind} is not null)`),
    check('payslip_objections_reason', sql`length(btrim(${t.reason})) >= 20`),
  ],
);
