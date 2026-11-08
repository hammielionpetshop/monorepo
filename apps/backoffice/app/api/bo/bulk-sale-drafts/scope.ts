import { bulkSaleDrafts, sql } from '@/lib/db'

// Sama dengan GLOBAL_ROLES di halaman Bulk Sale: hanya OWNER/GM yang boleh memilih cabang lain.
const GLOBAL_ROLES = ['OWNER', 'GM']

type DraftViewer = { role: string; branchId: number }

export function canSeeAllBranches(viewer: DraftViewer) {
  return GLOBAL_ROLES.includes(viewer.role)
}

/**
 * Daftar Tunggu Bulk Sale dibagi per cabang seperti Daftar Tunggu POS: siapa pun di cabang itu
 * bisa melihat, melanjutkan, atau menghapus draf — bukan hanya penahannya. OWNER/GM melihat
 * semua cabang. Kembalikan `undefined` bila tanpa batas cabang.
 */
export function draftBranchFilter(viewer: DraftViewer) {
  if (canSeeAllBranches(viewer)) return undefined
  return sql`${bulkSaleDrafts.payload}->>'branchId' = ${String(viewer.branchId)}`
}
