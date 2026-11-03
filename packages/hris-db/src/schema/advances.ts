import { sql } from 'drizzle-orm';
import { boolean, check, date, index, integer, serial, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { employees } from './employees';
import { files } from './files';
import { paymentSources, payslips } from './payroll';
import { requests } from './requests';
import { hrisSchema } from './shared';

// Kasbon L5 (spec L5 §2; DRV-54 s.d. 79, 121 s.d. 142). Tidak ada yang dihapus (PRI-02, DRV-83): pembatalan = tanda.

/**
 * Satu kasbon. `state` sebelum uang diberikan: OPEN (pengajuan menunggu / diperiksa), APPROVED (disetujui), REJECTED,
 * WITHDRAWN (ditarik pengaju), CANCELLED (dibatalkan Pemilik/GM sesudah disetujui). "Sudah diberikan" = ada serah uang
 * ACTIVE; Berjalan / Lunas / Dialihkan dihitung dari sisa (DRV-71, 131), tidak disimpan.
 */
export const advances = hrisSchema.table(
  'advances',
  {
    id: serial('id').primaryKey(),
    /** KB-0001, urut satu perusahaan (spec L5 §9 butir 7). */
    number: text('number').notNull(),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    /** REGULAR biasa · SPECIAL Kasbon Khusus (L5b) · LEGACY bawaan sistem lama (L9). */
    kind: text('kind').notNull().default('REGULAR'),
    requestId: integer('request_id').references(() => requests.id),
    /** Akun yang mengisi; berbeda dari akun orangnya bila diisikan atas nama (DRV-123). */
    filledByAccountId: integer('filled_by_account_id').notNull(),
    filledByEmployeeId: integer('filled_by_employee_id').notNull().references(() => employees.id),
    requestedAmount: integer('requested_amount').notNull(),
    requestedInstallments: integer('requested_installments').notNull(),
    reason: text('reason').notNull(),
    /** Dana Kasbon saat diajukan (DRV-121): MONTHLY / WEEKLY. */
    fund: text('fund').notNull(),
    reviewAmount: integer('review_amount'),
    reviewInstallments: integer('review_installments'),
    reviewNote: text('review_note'),
    reviewedByAccountId: integer('reviewed_by_account_id'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    finalAmount: integer('final_amount'),
    finalInstallments: integer('final_installments'),
    decisionNote: text('decision_note'),
    decidedByAccountId: integer('decided_by_account_id'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    /** Diputuskan tanpa menunggu pemeriksaan Finance (DRV-124, K2). */
    withoutReview: boolean('without_review').notNull().default(false),
    state: text('state').notNull().default('OPEN'),
    closeReason: text('close_reason'),
    closedByAccountId: integer('closed_by_account_id'),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    /** Kasbon Khusus (L5b, DRV-141). */
    eventKind: text('event_kind'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('advances_number_unique').on(t.number),
    uniqueIndex('advances_request_unique').on(t.requestId).where(sql`${t.requestId} is not null`),
    index('advances_employee_idx').on(t.employeeId, t.state),
    check('advances_kind', sql`${t.kind} in ('REGULAR', 'SPECIAL', 'LEGACY')`),
    check('advances_fund', sql`${t.fund} in ('MONTHLY', 'WEEKLY')`),
    check('advances_state', sql`${t.state} in ('OPEN', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'CANCELLED')`),
    check('advances_amounts', sql`${t.requestedAmount} > 0 and ${t.requestedInstallments} >= 1
      and (${t.finalAmount} is null or (${t.finalAmount} > 0 and ${t.finalAmount} <= ${t.requestedAmount}))
      and (${t.reviewAmount} is null or (${t.reviewAmount} > 0 and ${t.reviewAmount} <= ${t.requestedAmount}))`),
    check('advances_regular_request', sql`${t.kind} <> 'REGULAR' or ${t.requestId} is not null`),
    check('advances_approved_final', sql`${t.state} <> 'APPROVED' or (${t.finalAmount} is not null and ${t.finalInstallments} is not null and ${t.decidedAt} is not null)`),
    check('advances_closed_reason', sql`${t.state} not in ('CANCELLED') or (${t.closeReason} is not null and ${t.closedAt} is not null)`),
    check('advances_reason_not_blank', sql`btrim(${t.reason}) <> ''`),
  ],
);

/** Serah uang kasbon (DRV-63, 126, 127). Satu ACTIVE per kasbon: cair sekali. Batal serah = CANCELLED (DRV-128). */
export const advanceHandovers = hrisSchema.table(
  'advance_handovers',
  {
    id: serial('id').primaryKey(),
    advanceId: integer('advance_id').notNull().references(() => advances.id),
    amount: integer('amount').notNull(),
    moneyDate: date('money_date', { mode: 'string' }).notNull(),
    sourceId: integer('source_id').notNull().references(() => paymentSources.id),
    method: text('method').notNull(),
    handedByAccountId: integer('handed_by_account_id').notNull(),
    /** Kosong = langsung ke orangnya; selain itu dititipkan lewat orang ini (K5). */
    viaEmployeeId: integer('via_employee_id').references(() => employees.id),
    proofFileId: uuid('proof_file_id').references(() => files.id),
    dateReason: text('date_reason'),
    /** Tanggal uang sebelum tanggal disetujui (spec L5 §9 butir 5). */
    beforeApproval: boolean('before_approval').notNull().default(false),
    status: text('status').notNull().default('ACTIVE'),
    cancelReason: text('cancel_reason'),
    cancelledByAccountId: integer('cancelled_by_account_id'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('advance_handovers_one_active').on(t.advanceId).where(sql`${t.status} = 'ACTIVE'`),
    check('advance_handovers_amount', sql`${t.amount} > 0`),
    check('advance_handovers_method', sql`${t.method} in ('CASH', 'TRANSFER')`),
    check('advance_handovers_status', sql`${t.status} in ('ACTIVE', 'CANCELLED')`),
    check('advance_handovers_cancelled', sql`(${t.status} = 'CANCELLED') = (${t.cancelledAt} is not null and ${t.cancelReason} is not null)`),
  ],
);

/**
 * Jadwal cicilan (DRV-65, 132). Tidak diedit: tiap pemasangan ulang menandai yang lama REPLACED dan menulis versi baru.
 * `periodStart` = periode slip utama tujuan; kosong sebelum uang diberikan. TAKEN / PARTIAL ditulis "tandai cicilan"
 * saat slip ditutup (DRV-133).
 */
export const advanceInstallments = hrisSchema.table(
  'advance_installments',
  {
    id: serial('id').primaryKey(),
    advanceId: integer('advance_id').notNull().references(() => advances.id),
    version: integer('version').notNull(),
    sequence: integer('sequence').notNull(),
    total: integer('total').notNull(),
    amount: integer('amount').notNull(),
    periodStart: date('period_start', { mode: 'string' }),
    /** Jalur slip utama tujuan (L7b-2): MONTHLY = periode 26–25, WEEKLY = minggu upah (awal minggu bertanggal). */
    slipKind: text('slip_kind').notNull().default('MONTHLY'),
    status: text('status').notNull().default('SCHEDULED'),
    cause: text('cause').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('advance_installments_advance_idx').on(t.advanceId, t.status),
    index('advance_installments_period_idx').on(t.periodStart),
    check('advance_installments_amount', sql`${t.amount} > 0 and ${t.sequence} between 1 and ${t.total}`),
    check('advance_installments_period', sql`${t.periodStart} is null or ${t.slipKind} = 'WEEKLY' or extract(day from ${t.periodStart}) = 26`),
    check('advance_installments_slip_kind', sql`${t.slipKind} in ('MONTHLY', 'WEEKLY')`),
    check('advance_installments_status', sql`${t.status} in ('SCHEDULED', 'TAKEN', 'PARTIAL', 'REPLACED', 'CANCELLED', 'WAITING_WEEKLY')`),
    check('advance_installments_cause', sql`${t.cause} in ('APPROVE', 'HANDOVER', 'HANDOVER_UNDO', 'POSTPONE', 'RESCHEDULE', 'PAY_TRACK', 'REPAY', 'WRITE_OFF', 'UNDO', 'MAIN_SLIP')`),
  ],
);

/**
 * Catatan berkurang (DRV-67, 131): SLIP terpotong di slip · CASH dilunasi tunai · WRITE_OFF dihapus · TO_RECEIVABLE dialihkan
 * ke Piutang Lain. Sisa = nominal diberikan − jumlah ACTIVE. Dibalik = REVERSED (slip dibuka kembali, batal pelunasan).
 */
export const advanceMovements = hrisSchema.table(
  'advance_movements',
  {
    id: serial('id').primaryKey(),
    advanceId: integer('advance_id').notNull().references(() => advances.id),
    kind: text('kind').notNull(),
    amount: integer('amount').notNull(),
    payslipId: integer('payslip_id').references(() => payslips.id),
    installmentId: integer('installment_id').references(() => advanceInstallments.id),
    moneyDate: date('money_date', { mode: 'string' }),
    sourceId: integer('source_id').references(() => paymentSources.id),
    proofFileId: uuid('proof_file_id').references(() => files.id),
    reason: text('reason'),
    recordedByAccountId: integer('recorded_by_account_id').notNull(),
    status: text('status').notNull().default('ACTIVE'),
    reversedReason: text('reversed_reason'),
    reversedByAccountId: integer('reversed_by_account_id'),
    reversedAt: timestamp('reversed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('advance_movements_advance_idx').on(t.advanceId, t.status),
    index('advance_movements_payslip_idx').on(t.payslipId),
    check('advance_movements_kind', sql`${t.kind} in ('SLIP', 'CASH', 'WRITE_OFF', 'TO_RECEIVABLE')`),
    check('advance_movements_amount', sql`${t.amount} > 0`),
    check('advance_movements_status', sql`${t.status} in ('ACTIVE', 'REVERSED')`),
    check('advance_movements_slip', sql`${t.kind} not in ('SLIP', 'TO_RECEIVABLE') or ${t.payslipId} is not null`),
    check('advance_movements_reversed', sql`(${t.status} = 'REVERSED') = (${t.reversedAt} is not null)`),
  ],
);

/**
 * Pengajuan lanjutan atas satu kasbon (Mesin Pengajuan): CANCEL "Minta dibatalkan" (DRV-129), NOT_RECEIVED "Uang kasbon
 * belum diterima" (K5), POSTPONE "Tunda cicilan" (L5b, DRV-134). Isi khasnya hanya tautan pengajuan → kasbon.
 */
export const advanceFollowups = hrisSchema.table(
  'advance_followups',
  {
    id: serial('id').primaryKey(),
    requestId: integer('request_id').notNull().references(() => requests.id),
    advanceId: integer('advance_id').notNull().references(() => advances.id),
    kind: text('kind').notNull(),
    handoverId: integer('handover_id').references(() => advanceHandovers.id),
    decisionNote: text('decision_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('advance_followups_request_unique').on(t.requestId),
    index('advance_followups_advance_idx').on(t.advanceId, t.kind),
    check('advance_followups_kind', sql`${t.kind} in ('CANCEL', 'NOT_RECEIVED', 'POSTPONE')`),
  ],
);
