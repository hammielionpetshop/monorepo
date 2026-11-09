import { cashFlowCategories, cashFlowEntries, sql } from '@/lib/db'

/** Tanggal simpan catatan Arus Kas dalam WIB (YYYY-MM-DD) — aturan "pencatat sendiri hari yang sama". */
export const createdOnWibSql = sql<string>`to_char(${cashFlowEntries.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD')`

/** Kolom kategori Arus Kas untuk layar Kategori & form catat, termasuk jumlah pemakaian. */
export const categorySelect = {
  id: cashFlowCategories.id,
  name: cashFlowCategories.name,
  type: cashFlowCategories.type,
  reportKind: cashFlowCategories.reportKind,
  isActive: cashFlowCategories.isActive,
  isSystem: cashFlowCategories.isSystem,
  ownerOnly: cashFlowCategories.ownerOnly,
  noteRequired: cashFlowCategories.noteRequired,
  usedCount: sql<number>`(SELECT count(*)::int FROM ${cashFlowEntries} e WHERE e.category_id = ${cashFlowCategories.id})`,
}
