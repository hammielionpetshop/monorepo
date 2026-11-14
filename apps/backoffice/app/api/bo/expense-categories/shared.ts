import { z } from 'zod'
import { db, cashFlowCategories, eq } from '@/lib/db'

/** Aturan bersama kelola kategori Pengeluaran Kasir (permintaan owner 2026-11-14). */
export const nameSchema = z.string({ message: 'Nama wajib diisi' }).trim().min(2, 'Nama minimal 2 huruf').max(50, 'Nama maksimal 50 karakter')

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === '23505'
}

/** Kategori Arus Kas tujuan sambungan harus pengeluaran biasa (bukan pendapatan atau kategori sistem). */
export async function linkTargetProblem(cashFlowCategoryId: number): Promise<string | null> {
  const [target] = await db
    .select({ type: cashFlowCategories.type, isSystem: cashFlowCategories.isSystem })
    .from(cashFlowCategories)
    .where(eq(cashFlowCategories.id, cashFlowCategoryId))
    .limit(1)
  if (!target) return 'Kategori Arus Kas tidak ditemukan'
  if (target.type !== 'EXPENSE' || target.isSystem) return 'Pilih kategori pengeluaran biasa (bukan pendapatan atau kategori sistem)'
  return null
}
