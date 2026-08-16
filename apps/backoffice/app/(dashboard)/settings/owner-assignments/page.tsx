import { getAuth, hasPermission } from '@/lib/authz'
import {
  db,
  users,
  roles,
  branches,
  ownerAssignments,
  eq,
  and,
  asc,
  isNotNull,
} from '@/lib/db'
import OwnerAssignmentsClient from './_components/owner-assignments-client'
import type { BranchOwnerRow, EligibleOwner } from './_components/types'

export const dynamic = 'force-dynamic'

export default async function OwnerAssignmentsPage() {
  const payload = await getAuth()

  // Lintas-cabang, jadi butuh `user.manage` (OWNER-only) + lingkup ALL.
  if (!payload || !hasPermission(payload, 'user.manage') || payload.branchScope !== 'ALL') {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          Anda tidak memiliki akses ke halaman ini.
        </div>
      </div>
    )
  }

  let branchList: BranchOwnerRow[] = []
  let eligibleOwners: EligibleOwner[] = []
  let error: string | null = null

  try {
    const [branchRows, assignmentRows, ownerRows] = await Promise.all([
      db
        .select({
          id: branches.id,
          code: branches.code,
          name: branches.name,
          isActive: branches.isActive,
        })
        .from(branches)
        .orderBy(asc(branches.name)),

      db
        .select({
          branchId: ownerAssignments.branchId,
          userId: users.id,
          userName: users.name,
          username: users.username,
        })
        .from(ownerAssignments)
        .innerJoin(users, eq(users.id, ownerAssignments.userId))
        .where(eq(ownerAssignments.isActive, true)),

      db
        .select({
          id: users.id,
          name: users.name,
          username: users.username,
        })
        .from(users)
        .innerJoin(roles, eq(roles.id, users.roleId))
        .where(
          and(eq(roles.name, 'OWNER'), eq(users.isActive, true), isNotNull(users.pinHash))
        )
        .orderBy(asc(users.name)),
    ])

    const currentByBranch = new Map<
      number,
      { id: number; name: string; username: string | null }
    >()
    for (const row of assignmentRows) {
      currentByBranch.set(row.branchId, {
        id: row.userId,
        name: row.userName,
        username: row.username,
      })
    }

    branchList = branchRows.map((b) => ({
      id: b.id,
      code: b.code,
      name: b.name,
      isActive: b.isActive,
      currentOwner: currentByBranch.get(b.id) ?? null,
    }))
    eligibleOwners = ownerRows
  } catch (e) {
    console.error('OwnerAssignmentsPage error:', e)
    error = 'Terjadi kesalahan saat mengambil data penugasan owner'
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Penugasan Owner</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Tentukan owner yang bertanggung jawab untuk setiap cabang — dipakai POS saat
          verifikasi PIN void.
        </p>
      </div>
      <OwnerAssignmentsClient branches={branchList} eligibleOwners={eligibleOwners} />
    </div>
  )
}
