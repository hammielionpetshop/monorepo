import { sql } from 'drizzle-orm';
import { check, date, index, integer, jsonb, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { hrisSchema } from './shared';

// Modul pengaturan (spec L2e §2.1). Nilai bertanggal berlaku; tidak pernah dihapus atau ditimpa (trigger).

export const settingTargetKind = hrisSchema.enum('setting_target_kind', ['ALL', 'POSITION', 'BRANCH']);
export const settingStatus = hrisSchema.enum('setting_status', ['PROPOSED', 'ACTIVE', 'CANCELLED']);

export const settingValues = hrisSchema.table(
  'setting_values',
  {
    id: serial('id').primaryKey(),
    key: text('key').notNull(),
    targetKind: settingTargetKind('target_kind').notNull().default('ALL'),
    // positions.id / branches.id menurut target_kind; tanpa FK karena jenisnya berganti-ganti.
    targetId: integer('target_id'),
    value: jsonb('value').notNull(),
    // Tanggal WIB; berlaku mulai pukul 00.00 WIB.
    effectiveFrom: date('effective_from', { mode: 'string' }).notNull(),
    status: settingStatus('status').notNull(),
    reason: text('reason').notNull(),
    // Null = isi awal oleh sistem (migrasi).
    createdByAccountId: integer('created_by_account_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    approvedByAccountId: integer('approved_by_account_id'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    cancelledByAccountId: integer('cancelled_by_account_id'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelReason: text('cancel_reason'),
  },
  (t) => [
    uniqueIndex('setting_values_one_active_per_day')
      .on(t.key, t.targetKind, sql`coalesce(${t.targetId}, 0)`, t.effectiveFrom)
      .where(sql`${t.status} = 'ACTIVE'`),
    index('setting_values_lookup_idx').on(t.key, t.targetKind, t.targetId, t.effectiveFrom),
    check('setting_values_target_pair', sql`(${t.targetKind} = 'ALL') = (${t.targetId} is null)`),
    check('setting_values_reason_not_blank', sql`btrim(${t.reason}) <> ''`),
    check('setting_values_cancel_complete', sql`(${t.status} = 'CANCELLED') = (${t.cancelledAt} is not null)
      and (${t.cancelledAt} is null or (${t.cancelledByAccountId} is not null and btrim(coalesce(${t.cancelReason}, '')) <> ''))`),
  ],
);

// Isi khas pengajuan Usulan Pengaturan Jabatan (KAR-73, spec L2f-2 §2). Status pengajuannya di hris.requests
// (Mesin Pengajuan); request_id sengaja tanpa FK lintas modul, sama dengan identity_changes.
export const positionSettingProposals = hrisSchema.table('position_setting_proposals', {
  requestId: integer('request_id').primaryKey(),
  settingValueId: integer('setting_value_id').notNull().references(() => settingValues.id),
  // Nilai berlaku pada tanggal itu saat diusulkan; null bila belum ada nilai.
  beforeValue: jsonb('before_value'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('position_setting_proposals_value_unique').on(t.settingValueId)]);
