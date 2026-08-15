import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAuth, hasPermission } from '@/lib/authz'
import { db, users, eq } from '@/lib/db'
import { listBranchAssignments } from '@/lib/services/user-branch-assignments'
import { getUserFormOptions } from '../_components/form-options'
import UserForm from '../_components/user-form'
import type { UserEditData } from '../_components/types'

export const dynamic = 'force-dynamic'

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!/^\d+$/.test(id)) notFound()
  const userId = Number(id)

  const payload = await getAuth()

  // Guard halaman disamakan dengan PATCH /api/bo/settings/users/[id].
  if (!payload || !hasPermission(payload, 'user.manage')) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          Anda tidak memiliki akses ke halaman ini.
        </div>
      </div>
    )
  }

  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      email: users.email,
      staffNumber: users.staffNumber,
      roleId: users.roleId,
      branchId: users.branchId,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!row) notFound()

  const [{ roles, branches }, assignments] = await Promise.all([
    getUserFormOptions(),
    listBranchAssignments([row.id]),
  ])

  const user: UserEditData = {
    ...row,
    assignedBranches: assignments.get(row.id) ?? [],
  }

  return (
    <div className="p-6 max-w-3xl">
      <Link
        href="/settings/users"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        ← Kembali ke Manajemen Pengguna
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-foreground">{user.name}</h1>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
              user.isActive ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'
            }`}
          >
            {user.isActive ? 'Aktif' : 'Nonaktif'}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">Ubah data akun dan cabang tugasnya.</p>
      </div>

      <UserForm user={user} roles={roles} branches={branches} />
    </div>
  )
}
