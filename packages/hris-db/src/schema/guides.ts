import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { hrisSchema } from './shared';

// Pedoman Lapor (spec F3-5 §2.1, KAR-79): "jenis kasus → lapor ke siapa". Hanya untuk dibaca; tidak mengubah
// penyetuju. Baris tidak dihapus, hanya dinonaktifkan; perubahan tercatat di audit_events (entity report_guide).
export const reportGuides = hrisSchema.table(
  'report_guides',
  {
    id: serial('id').primaryKey(),
    /** Kunci jenis pengajuan (REQUEST_TYPES); kosong = kasus bukan pengajuan (mis. "Mobil mogok"). */
    requestType: text('request_type'),
    caseLabel: text('case_label'),
    reportTo: text('report_to').notNull(),
    sortOrder: integer('sort_order').notNull(),
    active: boolean('active').notNull().default(true),
    /** Kosong hanya untuk isi awal dari migrasi. */
    updatedByAccountId: integer('updated_by_account_id'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('report_guides_active_type_uq').on(t.requestType).where(sql`${t.active} and ${t.requestType} is not null`),
    index('report_guides_sort_idx').on(t.sortOrder),
    check('report_guides_case_label', sql`${t.requestType} is not null or btrim(coalesce(${t.caseLabel}, '')) <> ''`),
    check('report_guides_report_to_not_blank', sql`btrim(${t.reportTo}) <> ''`),
  ],
);
