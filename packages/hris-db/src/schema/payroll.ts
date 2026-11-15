import { sql } from 'drizzle-orm';
import { bigint, boolean, check, date, index, integer, jsonb, numeric, serial, text, timestamp, uniqueIndex, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { branches } from './access';
import { casualWorkers, employees } from './employees';
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
    /** Asal kurang serah Terima Uang (B3): cara bayar `TRUCK` (logistics.visit_payments) / `SELF` (logistics.self_trip_payments). */
    moneyCheckSource: text('money_check_source'),
    moneyCheckPaymentId: integer('money_check_payment_id'),
  },
  (t) => [
    index('other_deductions_employee_idx').on(t.employeeId),
    index('other_deductions_money_check_idx').on(t.moneyCheckSource, t.moneyCheckPaymentId).where(sql`${t.moneyCheckPaymentId} is not null`),
    check('other_deductions_money_check_pair', sql`(${t.moneyCheckSource} is null) = (${t.moneyCheckPaymentId} is null) and (${t.moneyCheckSource} is null or ${t.moneyCheckSource} in ('TRUCK', 'SELF'))`),
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

// Tindak lanjut kurang serah Terima Uang selain Potongan Lain (B3): CASH_REPLACED = sudah diganti tunai (Finance, nominal),
// WAIVED = tidak dipotong (Pemilik/GM, alasan). Tidak dihapus; salah catat dibatalkan beralasan.
export const shortHandoverSettlements = hrisSchema.table(
  'short_handover_settlements',
  {
    id: serial('id').primaryKey(),
    source: text('source').notNull(),
    paymentId: integer('payment_id').notNull(),
    kind: text('kind').notNull(),
    amount: integer('amount'),
    proofFileId: uuid('proof_file_id').references(() => files.id),
    note: text('note').notNull(),
    recordedByAccountId: integer('recorded_by_account_id').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidedByAccountId: integer('voided_by_account_id'),
    voidReason: text('void_reason'),
  },
  (t) => [
    index('short_handover_settlements_payment_idx').on(t.source, t.paymentId),
    uniqueIndex('short_handover_settlements_waived_current').on(t.source, t.paymentId).where(sql`${t.kind} = 'WAIVED' and ${t.voidedAt} is null`),
    check('short_handover_settlements_source', sql`${t.source} in ('TRUCK', 'SELF')`),
    check('short_handover_settlements_kind', sql`(${t.kind} = 'CASH_REPLACED' and ${t.amount} > 0) or (${t.kind} = 'WAIVED' and ${t.amount} is null)`),
    check('short_handover_settlements_note_not_blank', sql`btrim(${t.note}) <> ''`),
    check('short_handover_settlements_void_complete', sql`(${t.voidedAt} is null) = (${t.voidReason} is null)`),
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
export const deductionObjectionTarget = hrisSchema.enum('deduction_objection_target', ['CASH_SHORTAGE', 'MANUAL_CASH_SHORTAGE', 'OTHER_DEDUCTION', 'DRIVER_FINE']);

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
    /** Hari terakhir slip mingguan (L7b); kosong untuk slip bulanan (akhirnya selalu tanggal 25). Disegarkan selama Perkiraan. */
    periodEnd: date('period_end', { mode: 'string' }),
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
    check('payslips_kind', sql`${t.kind} in ('MONTHLY', 'WEEKLY', 'WEEKLY_EXTRA')`),
    check('payslips_status', sql`${t.status} in ('ESTIMATE', 'CLOSED')`),
    // Slip mingguan (L7b): awal minggu upah, hari awalnya bertanggal (pengaturan payroll.weekly_start_day).
    check('payslips_period_start', sql`${t.kind} <> 'MONTHLY' or extract(day from ${t.periodStart}) = 26`),
    check('payslips_period_end', sql`(${t.kind} = 'MONTHLY') = (${t.periodEnd} is null) and (${t.periodEnd} is null or ${t.periodEnd} between ${t.periodStart} and ${t.periodStart} + 6)`),
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
    sourceId: integer('source_id').references(() => paymentSources.id),
    /** Tempat Uang Back Office (F2-1b; view `hris.pos_money_places`, tanpa FK lintas schema). `source_id` lama tidak dipakai lagi. */
    moneyPlaceId: integer('money_place_id').notNull(),
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
    /** Tempat Uang Back Office (F2-1b; view `hris.pos_money_places`, tanpa FK lintas schema). `source_id` lama tidak dipakai lagi. */
    moneyPlaceId: integer('money_place_id'),
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
    check('payslip_payments_money', sql`${t.kind} <> 'MONEY' or (${t.amount} > 0 and ${t.batchId} is not null and ${t.moneyPlaceId} is not null and ${t.method} in ('CASH', 'TRANSFER'))`),
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

/**
 * Buku Upah ritase & upah belanja (spec L7 §2, §3.2; DRV-01, 09 s.d. 17, 84). Satu baris rupiah per baris
 * `logistics.trip_wages` (dibaca lewat modul logistics, tanpa foreign key lintas schema). Ditulis satu fungsi penilai;
 * dinilai ulang = baris lama CANCELLED + baris baru (`replacedById`), tidak pernah diubah angkanya atau dihapus.
 * UNRATED = pasangan belum bertarif pada tanggal itu (Rp0, menahan slip mingguan di L7b).
 */
export const tripWageValues = hrisSchema.table(
  'trip_wage_values',
  {
    id: serial('id').primaryKey(),
    /** id `logistics.trip_wages`. */
    wageId: integer('wage_id').notNull(),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    /** RITASE (ritase kirim) · SHOPPING (upah belanja). */
    kind: text('kind').notNull(),
    wageDate: date('wage_date', { mode: 'string' }).notNull(),
    /** Minggu upah: Jumat awal minggu Jumat–Kamis (DRV-19). */
    weekStart: date('week_start', { mode: 'string' }).notNull(),
    role: text('role').notNull(),
    withAssistant: boolean('with_assistant').notNull(),
    vehicleId: integer('vehicle_id').notNull(),
    routeId: integer('route_id').notNull(),
    /** id `logistics.trip_rates` yang dipakai; kosong = belum bertarif. */
    rateId: integer('rate_id'),
    /** Angka tarif menurut peran sebelum aturan Rp0. */
    rateAmount: integer('rate_amount'),
    amount: integer('amount').notNull(),
    /** Dasar gaji jabatan orang itu pada tanggalnya: MONTHLY · WEEKLY. */
    payBasis: text('pay_basis').notNull(),
    /** Status hari yang dibaca untuk orang Bulanan (KEH-81); kosong untuk Mingguan. */
    dayStatus: text('day_status'),
    /** WORKDAY (hari kerja) · NOT_DAY_OFF (izin/sakit/cuti/alpha/belum ditentukan) · NO_ASSISTANT_PAY (rute tanpa upah kenek). */
    zeroReason: text('zero_reason'),
    status: text('status').notNull().default('ACTIVE'),
    /** Tanda Perlu dilihat (U5): Rp0 "bukan hari libur". Tidak menyangkut uang. */
    needsLook: boolean('needs_look').notNull().default(false),
    lookedAt: timestamp('looked_at', { withTimezone: true }),
    lookedByAccountId: integer('looked_by_account_id'),
    lookNote: text('look_note'),
    /** Slip mingguan yang memuat baris ini (L7b). */
    payslipId: integer('payslip_id').references(() => payslips.id),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelReason: text('cancel_reason'),
    replacedById: integer('replaced_by_id').references((): AnyPgColumn => tripWageValues.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('trip_wage_values_one_live').on(t.wageId).where(sql`${t.status} <> 'CANCELLED'`),
    index('trip_wage_values_week_idx').on(t.weekStart, t.employeeId),
    index('trip_wage_values_wage_idx').on(t.wageId),
    check('trip_wage_values_kind', sql`${t.kind} in ('RITASE', 'SHOPPING')`),
    check('trip_wage_values_role', sql`${t.role} in ('DRIVER', 'ASSISTANT')`),
    check('trip_wage_values_basis', sql`${t.payBasis} in ('MONTHLY', 'WEEKLY')`),
    check('trip_wage_values_status', sql`${t.status} in ('ACTIVE', 'UNRATED', 'CANCELLED')`),
    check('trip_wage_values_zero_reason', sql`${t.zeroReason} is null or ${t.zeroReason} in ('WORKDAY', 'NOT_DAY_OFF', 'NO_ASSISTANT_PAY')`),
    check('trip_wage_values_amount', sql`${t.amount} >= 0 and (${t.status} <> 'UNRATED' or ${t.amount} = 0)`),
    check('trip_wage_values_unrated', sql`(${t.status} <> 'UNRATED' or ${t.rateId} is null) and (${t.status} <> 'ACTIVE' or ${t.rateId} is not null)`),
    check('trip_wage_values_cancel', sql`(${t.status} = 'CANCELLED') = (${t.cancelledAt} is not null and ${t.cancelReason} is not null)`),
    check('trip_wage_values_looked', sql`${t.lookedAt} is null or ${t.needsLook}`),
  ],
);

// ---- Denda driver & kenek (spec L7 §3.6, L7c; DRV-29, 30) ----

/** Jenis denda. Nominal dan aktif bertanggal di `driver_fine_kind_versions`; jenis tidak dihapus. */
export const driverFineKinds = hrisSchema.table(
  'driver_fine_kinds',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    /** Contoh perbuatan, tampil di layar Ajukan Denda. */
    example: text('example').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
    createdByAccountId: integer('created_by_account_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('driver_fine_kinds_name_unique').on(sql`lower(${t.name})`),
    check('driver_fine_kinds_name_not_blank', sql`btrim(${t.name}) <> ''`),
  ],
);

/** Nominal + aktif per tanggal berlaku. Naik / jenis baru / aktif lagi ≥ 7 hari, turun / nonaktif ≥ 1 hari (spec L7 §3.6). */
export const driverFineKindVersions = hrisSchema.table(
  'driver_fine_kind_versions',
  {
    id: serial('id').primaryKey(),
    kindId: integer('kind_id').notNull().references(() => driverFineKinds.id),
    effectiveOn: date('effective_on', { mode: 'string' }).notNull(),
    amount: integer('amount').notNull(),
    active: boolean('active').notNull(),
    reason: text('reason').notNull(),
    createdByAccountId: integer('created_by_account_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** Perubahan terjadwal yang dibatalkan sebelum berlaku. */
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledByAccountId: integer('cancelled_by_account_id'),
  },
  (t) => [
    uniqueIndex('driver_fine_kind_versions_live_unique').on(t.kindId, t.effectiveOn).where(sql`${t.cancelledAt} is null`),
    check('driver_fine_kind_versions_amount', sql`${t.amount} > 0`),
  ],
);

/**
 * Denda satu orang satu kejadian. PENDING usulan Kepala Gudang · ACTIVE berlaku · REJECTED ditolak · WITHDRAWN ditarik pengaju ·
 * CANCELLED dibatalkan sebelum terpotong · WAIVED ditiadakan sesudah terpotong (koreksi plus slip berikutnya).
 * Nominal disalin server dari jenis pada tanggal kejadian. Tidak tertagih dibaca dari slip terakhir (sisa kelompok a).
 */
export const driverFines = hrisSchema.table(
  'driver_fines',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    kindId: integer('kind_id').notNull().references(() => driverFineKinds.id),
    occurredOn: date('occurred_on', { mode: 'string' }).notNull(),
    /** Trip logistik orang itu pada tanggal kejadian (boleh kosong). */
    tripId: integer('trip_id'),
    description: text('description').notNull(),
    photoFileId: uuid('photo_file_id').references(() => files.id),
    amount: integer('amount').notNull(),
    status: text('status').notNull(),
    requestId: integer('request_id').references(() => requests.id),
    recordedByAccountId: integer('recorded_by_account_id').notNull(),
    recordedByEmployeeId: integer('recorded_by_employee_id').notNull().references(() => employees.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    approvedByAccountId: integer('approved_by_account_id'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    endedByAccountId: integer('ended_by_account_id'),
    endReason: text('end_reason'),
  },
  (t) => [
    index('driver_fines_employee_idx').on(t.employeeId, t.occurredOn),
    uniqueIndex('driver_fines_request_unique').on(t.requestId).where(sql`${t.requestId} is not null`),
    check('driver_fines_status', sql`${t.status} in ('PENDING', 'ACTIVE', 'REJECTED', 'WITHDRAWN', 'CANCELLED', 'WAIVED')`),
    check('driver_fines_amount', sql`${t.amount} > 0`),
    check('driver_fines_description', sql`length(btrim(${t.description})) >= 15`),
    check('driver_fines_not_self', sql`${t.employeeId} <> ${t.recordedByEmployeeId}`),
    check('driver_fines_approved', sql`${t.status} not in ('ACTIVE', 'WAIVED') or ${t.approvedAt} is not null`),
    check('driver_fines_ended', sql`(${t.status} in ('CANCELLED', 'WAIVED')) = (${t.endReason} is not null and ${t.endedAt} is not null)`),
  ],
);

// ---- L8a Laporan Bongkaran (spec L8 §2, §3.1–3.3; DRV-31 s.d. 46, 101 s.d. 110) ----

/** Berat per satuan yang berlaku sekarang, per produk + satuan kasir (DRV-32). Riwayatnya di `unloading_weight_changes`. */
export const unloadingUnitWeights = hrisSchema.table(
  'unloading_unit_weights',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id').notNull(),
    uomId: integer('uom_id').notNull(),
    weightKg: numeric('weight_kg', { precision: 12, scale: 3 }).notNull(),
    updatedByAccountId: integer('updated_by_account_id').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('unloading_unit_weights_unique').on(t.productId, t.uomId),
    check('unloading_unit_weights_positive', sql`${t.weightKg} > 0`),
  ],
);

/**
 * Satu Laporan Bongkaran. PENDING laporan terlambat menunggu Pemilik/GM · ACTIVE Berlaku (siap dibayar) · REJECTED ditolak ·
 * WITHDRAWN ditarik pembuat · PAID dibayar (L8b) · CANCELLED dibatalkan (L8b). Angka = salinan versi berjalan. Tidak dihapus.
 */
export const unloadingReports = hrisSchema.table(
  'unloading_reports',
  {
    id: serial('id').primaryKey(),
    number: text('number').notNull(),
    workDate: date('work_date', { mode: 'string' }).notNull(),
    supplierId: integer('supplier_id').notNull(),
    supplierName: text('supplier_name').notNull(),
    status: text('status').notNull(),
    version: integer('version').notNull().default(1),
    rate: integer('rate').notNull(),
    totalKg: numeric('total_kg', { precision: 14, scale: 3 }).notNull(),
    totalPay: integer('total_pay').notNull(),
    costBranchId: integer('cost_branch_id').references(() => branches.id),
    lateReason: text('late_reason'),
    requestId: integer('request_id').references(() => requests.id),
    /** Dikonfirmasi "Ini bongkaran lain" terhadap laporan serupa (DRV-37). */
    similarToId: integer('similar_to_id').references((): AnyPgColumn => unloadingReports.id),
    noDeliveryNoteReason: text('no_delivery_note_reason'),
    createdByAccountId: integer('created_by_account_id').notNull(),
    createdByEmployeeId: integer('created_by_employee_id').notNull().references(() => employees.id),
    createdOn: date('created_on', { mode: 'string' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    activatedByAccountId: integer('activated_by_account_id'),
    /** Tanyakan dulu (L8b, DRV-114): tanda, bukan penahan; padam saat dijawab atau dikoreksi. */
    question: text('question'),
    askedByAccountId: integer('asked_by_account_id'),
    askedAt: timestamp('asked_at', { withTimezone: true }),
    answer: text('answer'),
    answeredAt: timestamp('answered_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledByAccountId: integer('cancelled_by_account_id'),
    cancelReason: text('cancel_reason'),
    /** Asal barang (spec 2026-11-06 bongkaran → Draft PO): PO yang ada, atau barang datang dulu → Draft PO di POS. */
    source: text('source').notNull().default('ARRIVED_FIRST'),
    poId: integer('po_id'),
    poNumber: text('po_number'),
    /** Pilihan "Dari PO yang ada": jumlah dibongkar berbeda dengan PO (tanda "Selisih dengan PO"). */
    poMismatch: boolean('po_mismatch').notNull().default(false),
    /** NONE tidak ada yang dikirim · WAITING_APPROVAL tanpa surat jalan menunggu Pemilik/GM · PENDING · SYNCED · FAILED. */
    poSyncStatus: text('po_sync_status').notNull().default('NONE'),
    poSyncError: text('po_sync_error'),
    poSyncedVersion: integer('po_synced_version'),
    poSyncedAt: timestamp('po_synced_at', { withTimezone: true }),
    draftApprovedByAccountId: integer('draft_approved_by_account_id'),
    draftApprovedAt: timestamp('draft_approved_at', { withTimezone: true }),
  },
  (t) => [
    check('unloading_reports_source', sql`${t.source} in ('PO', 'ARRIVED_FIRST')`),
    check('unloading_reports_po_sync', sql`${t.poSyncStatus} in ('NONE', 'WAITING_APPROVAL', 'PENDING', 'SYNCED', 'FAILED')`),
    check('unloading_reports_po_source', sql`${t.source} <> 'PO' or ${t.poId} is not null`),
    uniqueIndex('unloading_reports_number_unique').on(t.number),
    uniqueIndex('unloading_reports_request_unique').on(t.requestId).where(sql`${t.requestId} is not null`),
    index('unloading_reports_work_date_idx').on(t.workDate),
    index('unloading_reports_status_idx').on(t.status),
    check('unloading_reports_status', sql`${t.status} in ('PENDING', 'ACTIVE', 'REJECTED', 'WITHDRAWN', 'PAID', 'CANCELLED')`),
    check('unloading_reports_numbers', sql`${t.rate} >= 0 and ${t.totalKg} > 0 and ${t.totalPay} >= 0 and ${t.version} >= 1`),
    check('unloading_reports_active_branch', sql`${t.status} not in ('ACTIVE', 'PAID') or (${t.costBranchId} is not null and ${t.activatedAt} is not null)`),
    check('unloading_reports_late', sql`${t.lateReason} is null or length(btrim(${t.lateReason})) >= 15`),
    check('unloading_reports_no_note', sql`${t.noDeliveryNoteReason} is null or length(btrim(${t.noDeliveryNoteReason})) >= 15`),
  ],
);

/** Riwayat berat (DRV-33, 105): diisi pertama (`fromKg` kosong) atau diubah dengan alasan. Beda > ambang = ditandai untuk Pemilik/GM. */
export const unloadingWeightChanges = hrisSchema.table(
  'unloading_weight_changes',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id').notNull(),
    uomId: integer('uom_id').notNull(),
    productName: text('product_name').notNull(),
    uomName: text('uom_name').notNull(),
    fromKg: numeric('from_kg', { precision: 12, scale: 3 }),
    toKg: numeric('to_kg', { precision: 12, scale: 3 }).notNull(),
    changePercent: numeric('change_percent', { precision: 10, scale: 2 }),
    reason: text('reason'),
    flagged: boolean('flagged').notNull().default(false),
    reportId: integer('report_id').references(() => unloadingReports.id),
    createdByAccountId: integer('created_by_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedByAccountId: integer('reviewed_by_account_id'),
    reviewNote: text('review_note'),
  },
  (t) => [
    index('unloading_weight_changes_product_idx').on(t.productId, t.uomId),
    index('unloading_weight_changes_flagged_idx').on(t.createdAt).where(sql`${t.flagged} and ${t.reviewedAt} is null`),
    check('unloading_weight_changes_reason', sql`${t.fromKg} is null or length(btrim(coalesce(${t.reason}, ''))) >= 15`),
  ],
);

/** Versi laporan: 1 = dibuat; berikutnya = koreksi (L8b). Isi lama tidak pernah ditimpa. */
export const unloadingReportVersions = hrisSchema.table(
  'unloading_report_versions',
  {
    id: serial('id').primaryKey(),
    reportId: integer('report_id').notNull().references(() => unloadingReports.id),
    version: integer('version').notNull(),
    workDate: date('work_date', { mode: 'string' }).notNull(),
    supplierId: integer('supplier_id').notNull(),
    supplierName: text('supplier_name').notNull(),
    rate: integer('rate').notNull(),
    totalKg: numeric('total_kg', { precision: 14, scale: 3 }).notNull(),
    totalPay: integer('total_pay').notNull(),
    reason: text('reason'),
    createdByAccountId: integer('created_by_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('unloading_report_versions_unique').on(t.reportId, t.version),
    check('unloading_report_versions_reason', sql`${t.version} = 1 or length(btrim(coalesce(${t.reason}, ''))) >= 15`),
  ],
);

/** Barang per versi. Produk kasir (produk + satuan + jumlah + berat dipakai) atau Barang lain (nama + kg + alasan, DRV-34). */
export const unloadingItems = hrisSchema.table(
  'unloading_items',
  {
    id: serial('id').primaryKey(),
    reportId: integer('report_id').notNull().references(() => unloadingReports.id),
    version: integer('version').notNull(),
    productId: integer('product_id'),
    uomId: integer('uom_id'),
    productName: text('product_name').notNull(),
    uomName: text('uom_name'),
    quantity: numeric('quantity', { precision: 12, scale: 3 }),
    weightKg: numeric('weight_kg', { precision: 12, scale: 3 }),
    lineKg: numeric('line_kg', { precision: 14, scale: 3 }).notNull(),
    otherReason: text('other_reason'),
    /** Berat baris ini diubah melewati ambang di laporan ini (tanda "Berat berubah"). */
    weightFlagged: boolean('weight_flagged').notNull().default(false),
    linkedProductId: integer('linked_product_id'),
    linkedProductName: text('linked_product_name'),
    linkedByAccountId: integer('linked_by_account_id'),
    linkedAt: timestamp('linked_at', { withTimezone: true }),
    /** Pilihan "Dari PO yang ada": baris PO kasir yang dicocokkan + sisa jumlah PO saat itu (pembanding selisih). */
    poItemId: integer('po_item_id'),
    poQty: numeric('po_qty', { precision: 12, scale: 3 }),
  },
  (t) => [
    index('unloading_items_report_idx').on(t.reportId, t.version),
    check('unloading_items_shape', sql`(${t.productId} is not null and ${t.uomId} is not null and ${t.quantity} > 0 and ${t.weightKg} > 0 and ${t.otherReason} is null) or (${t.productId} is null and ${t.uomId} is null and ${t.quantity} is null and ${t.weightKg} is null and length(btrim(coalesce(${t.otherReason}, ''))) >= 15)`),
    check('unloading_items_kg', sql`${t.lineKg} > 0`),
    check('unloading_items_link', sql`${t.linkedProductId} is null or ${t.productId} is null`),
  ],
);

/**
 * Buku Upah bongkaran (DRV-46, 108): satu baris per peserta per versi. Karyawan atau pekerja lepas. PENDING = laporan terlambat
 * belum disetujui (belum upah) · ACTIVE berlaku · CANCELLED versi diganti / laporan ditolak atau batal. Tidak pernah masuk slip (DRV-48).
 */
export const unloadingShares = hrisSchema.table(
  'unloading_shares',
  {
    id: serial('id').primaryKey(),
    reportId: integer('report_id').notNull().references(() => unloadingReports.id),
    version: integer('version').notNull(),
    employeeId: integer('employee_id').references(() => employees.id),
    casualWorkerId: integer('casual_worker_id').references(() => casualWorkers.id),
    name: text('name').notNull(),
    amount: integer('amount').notNull(),
    /** Penerima sisa Rp1 (DRV-43). */
    plusOne: boolean('plus_one').notNull().default(false),
    /** Status hari karyawan yang dibaca saat laporan Berlaku (DRV-107). */
    dayStatus: text('day_status'),
    needsLook: boolean('needs_look').notNull().default(false),
    lookedAt: timestamp('looked_at', { withTimezone: true }),
    lookedByAccountId: integer('looked_by_account_id'),
    lookNote: text('look_note'),
    status: text('status').notNull(),
  },
  (t) => [
    index('unloading_shares_report_idx').on(t.reportId, t.version),
    index('unloading_shares_employee_idx').on(t.employeeId).where(sql`${t.employeeId} is not null`),
    index('unloading_shares_casual_idx').on(t.casualWorkerId).where(sql`${t.casualWorkerId} is not null`),
    uniqueIndex('unloading_shares_one_employee').on(t.reportId, t.version, t.employeeId).where(sql`${t.employeeId} is not null`),
    uniqueIndex('unloading_shares_one_casual').on(t.reportId, t.version, t.casualWorkerId).where(sql`${t.casualWorkerId} is not null`),
    check('unloading_shares_person', sql`(${t.employeeId} is null) <> (${t.casualWorkerId} is null)`),
    check('unloading_shares_status', sql`${t.status} in ('PENDING', 'ACTIVE', 'CANCELLED')`),
    check('unloading_shares_amount', sql`${t.amount} >= 0`),
  ],
);

/** Foto surat jalan supplier (1–5) atau foto barang bila tidak ada surat jalan (DRV-103). */
export const unloadingPhotos = hrisSchema.table(
  'unloading_photos',
  {
    id: serial('id').primaryKey(),
    reportId: integer('report_id').notNull().references(() => unloadingReports.id),
    version: integer('version').notNull(),
    fileId: uuid('file_id').notNull().references(() => files.id),
    kind: text('kind').notNull(),
  },
  (t) => [
    index('unloading_photos_report_idx').on(t.reportId),
    check('unloading_photos_kind', sql`${t.kind} in ('DELIVERY_NOTE', 'GOODS')`),
  ],
);

// ---- L8b Bayar Bongkaran (spec L8 §3.4–3.5; DRV-47 s.d. 53, 111 s.d. 120) ----

/** Bayar susulan: lahir dari koreksi sesudah dibayar, satu per koreksi (DRV-117). WAITING menunggu · PAID · CANCELLED. */
export const unloadingTopUps = hrisSchema.table(
  'unloading_top_ups',
  {
    id: serial('id').primaryKey(),
    reportId: integer('report_id').notNull().references(() => unloadingReports.id),
    version: integer('version').notNull(),
    status: text('status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  },
  (t) => [
    index('unloading_top_ups_report_idx').on(t.reportId),
    check('unloading_top_ups_status', sql`${t.status} in ('WAITING', 'PAID', 'CANCELLED')`),
  ],
);

export const unloadingTopUpLines = hrisSchema.table(
  'unloading_top_up_lines',
  {
    id: serial('id').primaryKey(),
    topUpId: integer('top_up_id').notNull().references(() => unloadingTopUps.id),
    employeeId: integer('employee_id').references(() => employees.id),
    casualWorkerId: integer('casual_worker_id').references(() => casualWorkers.id),
    name: text('name').notNull(),
    amount: integer('amount').notNull(),
  },
  (t) => [
    index('unloading_top_up_lines_top_up_idx').on(t.topUpId),
    check('unloading_top_up_lines_person', sql`(${t.employeeId} is null) <> (${t.casualWorkerId} is null)`),
    check('unloading_top_up_lines_amount', sql`${t.amount} > 0`),
  ],
);

/**
 * Pembayaran laporan atau susulan (DRV-47, 111): sekali dan penuh sebesar hitungan server. MONEY / NO_MONEY (semua habis diperhitungkan).
 * Batal bayar = CANCELLED, tidak dihapus. Uraian disimpan untuk app Keuangan kelak (spec L8 §9 butir 7).
 */
export const unloadingPayments = hrisSchema.table(
  'unloading_payments',
  {
    id: serial('id').primaryKey(),
    reportId: integer('report_id').notNull().references(() => unloadingReports.id),
    topUpId: integer('top_up_id').references(() => unloadingTopUps.id),
    kind: text('kind').notNull(),
    amount: integer('amount').notNull(),
    moneyDate: date('money_date', { mode: 'string' }).notNull(),
    dateReason: text('date_reason'),
    sourceId: integer('source_id').references(() => paymentSources.id),
    /** Tempat Uang Back Office (F2-1b; view `hris.pos_money_places`, tanpa FK lintas schema). `source_id` lama tidak dipakai lagi. */
    moneyPlaceId: integer('money_place_id'),
    method: text('method'),
    paidByAccountId: integer('paid_by_account_id').notNull(),
    /** Pembayar Pemilik/GM yang juga peserta atau pembuat (boleh, bertanda, DRV-111). */
    ownerFlag: boolean('owner_flag').notNull().default(false),
    /** "Langsung ke tiap peserta" (kosong) atau satu nama yang dititipi (DRV-113). */
    handedToName: text('handed_to_name'),
    proofFileId: uuid('proof_file_id').references(() => files.id),
    breakdown: jsonb('breakdown'),
    status: text('status').notNull().default('ACTIVE'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledByAccountId: integer('cancelled_by_account_id'),
    cancelReason: text('cancel_reason'),
  },
  (t) => [
    uniqueIndex('unloading_payments_one_active_report').on(t.reportId).where(sql`${t.status} = 'ACTIVE' and ${t.topUpId} is null`),
    uniqueIndex('unloading_payments_one_active_top_up').on(t.topUpId).where(sql`${t.status} = 'ACTIVE' and ${t.topUpId} is not null`),
    check('unloading_payments_kind', sql`${t.kind} in ('MONEY', 'NO_MONEY')`),
    check('unloading_payments_status', sql`${t.status} in ('ACTIVE', 'CANCELLED')`),
    check('unloading_payments_money', sql`${t.kind} <> 'MONEY' or (${t.amount} > 0 and ${t.moneyPlaceId} is not null and ${t.method} in ('CASH', 'TRANSFER'))`),
    check('unloading_payments_no_money', sql`${t.kind} <> 'NO_MONEY' or ${t.amount} = 0`),
    check('unloading_payments_cancelled', sql`(${t.status} = 'CANCELLED') = (${t.cancelledAt} is not null)`),
  ],
);

/** Rincian per peserta: bagian, diperhitungkan lebih bayar, diterima (DRV-111, 120). */
export const unloadingPaymentLines = hrisSchema.table(
  'unloading_payment_lines',
  {
    id: serial('id').primaryKey(),
    paymentId: integer('payment_id').notNull().references(() => unloadingPayments.id),
    employeeId: integer('employee_id').references(() => employees.id),
    casualWorkerId: integer('casual_worker_id').references(() => casualWorkers.id),
    name: text('name').notNull(),
    share: integer('share').notNull(),
    offset: integer('offset').notNull().default(0),
    received: integer('received').notNull(),
  },
  (t) => [
    index('unloading_payment_lines_payment_idx').on(t.paymentId),
    index('unloading_payment_lines_employee_idx').on(t.employeeId).where(sql`${t.employeeId} is not null`),
    check('unloading_payment_lines_person', sql`(${t.employeeId} is null) <> (${t.casualWorkerId} is null)`),
    check('unloading_payment_lines_sum', sql`${t.share} >= 0 and ${t.offset} >= 0 and ${t.received} = ${t.share} - ${t.offset}`),
  ],
);

/** Lebih bayar satu orang dari satu koreksi (DRV-118). Sisa dihitung dari pemakaiannya. OPEN · COLLECT (ditagih tunai) · WRITTEN_OFF. */
export const unloadingOverpayments = hrisSchema.table(
  'unloading_overpayments',
  {
    id: serial('id').primaryKey(),
    reportId: integer('report_id').notNull().references(() => unloadingReports.id),
    version: integer('version').notNull(),
    employeeId: integer('employee_id').references(() => employees.id),
    casualWorkerId: integer('casual_worker_id').references(() => casualWorkers.id),
    name: text('name').notNull(),
    amount: integer('amount').notNull(),
    status: text('status').notNull().default('OPEN'),
    flaggedAt: timestamp('flagged_at', { withTimezone: true }),
    decidedByAccountId: integer('decided_by_account_id'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionReason: text('decision_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('unloading_overpayments_employee_idx').on(t.employeeId).where(sql`${t.employeeId} is not null`),
    index('unloading_overpayments_casual_idx').on(t.casualWorkerId).where(sql`${t.casualWorkerId} is not null`),
    check('unloading_overpayments_person', sql`(${t.employeeId} is null) <> (${t.casualWorkerId} is null)`),
    check('unloading_overpayments_amount', sql`${t.amount} > 0`),
    check('unloading_overpayments_status', sql`${t.status} in ('OPEN', 'COLLECT', 'WRITTEN_OFF')`),
  ],
);

/**
 * Pemakaian lebih bayar: OFFSET diperhitungkan di pembayaran · REFUND dikembalikan tunai · CORRECTION dikurangi koreksi plus laporan yang sama ·
 * WRITE_OFF dihapus. Batal bayar membatalkan OFFSET-nya (lebih bayar hidup lagi).
 */
export const unloadingOverpaymentUses = hrisSchema.table(
  'unloading_overpayment_uses',
  {
    id: serial('id').primaryKey(),
    overpaymentId: integer('overpayment_id').notNull().references(() => unloadingOverpayments.id),
    kind: text('kind').notNull(),
    amount: integer('amount').notNull(),
    paymentId: integer('payment_id').references(() => unloadingPayments.id),
    sourceId: integer('source_id').references(() => paymentSources.id),
    /** Tempat Uang Back Office (F2-1b; view `hris.pos_money_places`, tanpa FK lintas schema). `source_id` lama tidak dipakai lagi. */
    moneyPlaceId: integer('money_place_id'),
    moneyDate: date('money_date', { mode: 'string' }),
    status: text('status').notNull().default('ACTIVE'),
    createdByAccountId: integer('created_by_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('unloading_overpayment_uses_overpayment_idx').on(t.overpaymentId),
    check('unloading_overpayment_uses_kind', sql`${t.kind} in ('OFFSET', 'REFUND', 'CORRECTION', 'WRITE_OFF')`),
    check('unloading_overpayment_uses_amount', sql`${t.amount} > 0`),
    check('unloading_overpayment_uses_status', sql`${t.status} in ('ACTIVE', 'CANCELLED')`),
    check('unloading_overpayment_uses_offset', sql`${t.kind} <> 'OFFSET' or ${t.paymentId} is not null`),
    check('unloading_overpayment_uses_refund', sql`${t.kind} <> 'REFUND' or (${t.moneyPlaceId} is not null and ${t.moneyDate} is not null)`),
  ],
);

/** "Uang belum saya terima" (DRV-113): pengajuan peserta atas satu pembayaran. */
export const unloadingReceiptClaims = hrisSchema.table(
  'unloading_receipt_claims',
  {
    id: serial('id').primaryKey(),
    paymentId: integer('payment_id').notNull().references(() => unloadingPayments.id),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    requestId: integer('request_id').notNull().references(() => requests.id),
    note: text('note').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('unloading_receipt_claims_request_unique').on(t.requestId)],
);

// Uji banding L9b (spec L9 §4; SIS-15, 16, 41). Data salinan sistem lama, hanya di staging, dihapus `--purge` sesudah uji.

/** Satu uji banding = satu periode 26–25. `computed_count` = berapa kali hitungan HRIS disimpan (maks 2, SIS-16). */
export const comparisonRuns = hrisSchema.table(
  'comparison_runs',
  {
    id: serial('id').primaryKey(),
    periodStart: date('period_start').notNull(),
    label: text('label').notNull(),
    /** LOADED dipakai · PURGED data salinan sudah dihapus (barisnya tetap sebagai jejak). */
    status: text('status').notNull().default('LOADED'),
    sourceFiles: jsonb('source_files').$type<string[]>().notNull().default([]),
    computedCount: integer('computed_count').notNull().default(0),
    loadedAt: timestamp('loaded_at', { withTimezone: true }).notNull().defaultNow(),
    purgedAt: timestamp('purged_at', { withTimezone: true }),
  },
  (t) => [
    check('comparison_runs_period_day', sql`extract(day from ${t.periodStart}) = 26`),
    check('comparison_runs_status', sql`${t.status} in ('LOADED', 'PURGED')`),
    check('comparison_runs_computed', sql`${t.computedCount} between 0 and 2`),
    check('comparison_runs_purged', sql`(${t.status} = 'PURGED') = (${t.purgedAt} is not null)`),
  ],
);

/** Komponen slip lama / hitungan HRIS yang disimpan: pendapatan (INCOME) atau potongan (DEDUCTION). */
export type ComparisonComponent = { label: string; side: 'INCOME' | 'DEDUCTION'; amount: number };

/**
 * Satu slip lama satu orang beserta hitungan HRIS yang disimpan (hitungan 1 dan, bila perlu, hitungan ulang 2) dan
 * sebab selisih dari Pemilik/GM: INTENDED beda disengaja (nomor aturan wajib) · FIX perlu diperbaiki.
 */
export const comparisonSlips = hrisSchema.table(
  'comparison_slips',
  {
    id: serial('id').primaryKey(),
    runId: integer('run_id').notNull().references(() => comparisonRuns.id),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    /** Kode karyawan di sistem lama (EMP-xxx), untuk dicocokkan dengan berkas owner. */
    legacyCode: text('legacy_code').notNull(),
    /** MONTHLY · WEEKLY · WEEKLY_EXTRA (sama dengan jenis slip HRIS). */
    slipKind: text('slip_kind').notNull(),
    /** Awal periode (26) atau tanggal minggu upah yang ditulis di berkas. */
    slipStart: date('slip_start').notNull(),
    oldTotal: integer('old_total').notNull(),
    oldComponents: jsonb('old_components').$type<ComparisonComponent[]>().notNull(),
    firstTotal: integer('first_total'),
    firstComponents: jsonb('first_components').$type<ComparisonComponent[]>(),
    secondTotal: integer('second_total'),
    secondComponents: jsonb('second_components').$type<ComparisonComponent[]>(),
    cause: text('cause'),
    ruleRef: text('rule_ref'),
    note: text('note'),
    decidedByAccountId: integer('decided_by_account_id'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('comparison_slips_unique').on(t.runId, t.employeeId, t.slipKind, t.slipStart),
    index('comparison_slips_run_idx').on(t.runId),
    check('comparison_slips_kind', sql`${t.slipKind} in ('MONTHLY', 'WEEKLY', 'WEEKLY_EXTRA')`),
    check('comparison_slips_cause', sql`${t.cause} is null or ${t.cause} in ('INTENDED', 'FIX')`),
    check('comparison_slips_rule', sql`${t.cause} is distinct from 'INTENDED' or (${t.ruleRef} is not null and btrim(${t.ruleRef}) <> '')`),
    check('comparison_slips_decided', sql`(${t.cause} is null) = (${t.decidedAt} is null)`),
  ],
);

/**
 * Tanda COMPARISON (spec L9 §4 butir 2): setiap baris tabel operasional yang dimuat dari data salinan dicatat di sini
 * (nama tabel lengkap + id) supaya `--purge` menghapus tepat baris itu, urut terbalik dari pemuatan.
 */
export const comparisonRows = hrisSchema.table(
  'comparison_rows',
  {
    id: serial('id').primaryKey(),
    runId: integer('run_id').notNull().references(() => comparisonRuns.id),
    tableName: text('table_name').notNull(),
    rowId: bigint('row_id', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('comparison_rows_unique').on(t.tableName, t.rowId),
    index('comparison_rows_run_idx').on(t.runId),
    check('comparison_rows_table', sql`${t.tableName} ~ '^(hris|logistics)\\.[a-z_]+$'`),
  ],
);
