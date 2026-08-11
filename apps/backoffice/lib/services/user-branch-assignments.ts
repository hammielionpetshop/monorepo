import { db, branches, userBranchAssignments, eq, and, inArray } from '@/lib/db'

type Trx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Tulis ulang penugasan cabang seorang user.
 *
 * Cabang utama SELALU ikut, apa pun isi `assignedBranchIds`. Tanpa jaminan itu, mengubah cabang
 * utama seseorang tanpa menyertakan daftar penugasan akan membuatnya tidak berhak atas
 * cabangnya sendiri — login berhasil, tapi tidak ada satu cabang pun yang boleh ia pilih.
 *
 * Ganti-total (hapus lalu isi), bukan tambah-saja: mencabut penugasan harus semudah memberinya.
 */
export async function syncUserBranchAssignments(
  trx: Trx,
  userId: number,
  primaryBranchId: number,
  assignedBranchIds: number[] | undefined,
  assignedBy: number | null,
): Promise<void> {
  const target = Array.from(new Set([primaryBranchId, ...(assignedBranchIds ?? [])]))

  const valid = await trx
    .select({ id: branches.id })
    .from(branches)
    .where(and(inArray(branches.id, target), eq(branches.isActive, true)))

  if (valid.length !== target.length) throw new Error('BRANCH_NOT_FOUND')

  await trx.delete(userBranchAssignments).where(eq(userBranchAssignments.userId, userId))

  await trx.insert(userBranchAssignments).values(
    target.map((branchId) => ({ userId, branchId, assignedBy })),
  )
}

/** Cabang tugas per user, untuk daftar & form. */
export async function listBranchAssignments(
  userIds: number[],
): Promise<Map<number, { id: number; name: string }[]>> {
  const map = new Map<number, { id: number; name: string }[]>()
  if (userIds.length === 0) return map

  const rows = await db
    .select({
      userId: userBranchAssignments.userId,
      branchId: userBranchAssignments.branchId,
      branchName: branches.name,
    })
    .from(userBranchAssignments)
    .innerJoin(branches, eq(userBranchAssignments.branchId, branches.id))
    .where(inArray(userBranchAssignments.userId, userIds))
    .orderBy(branches.name)

  for (const row of rows) {
    const list = map.get(row.userId) ?? []
    list.push({ id: row.branchId, name: row.branchName })
    map.set(row.userId, list)
  }
  return map
}
