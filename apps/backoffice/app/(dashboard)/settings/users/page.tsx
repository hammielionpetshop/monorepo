import { db, users, roles, branches, eq } from '@/lib/db'
import UserClient from './_components/user-client'
import type { UserListItem, RoleOption, BranchOption } from './_components/types'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  let userList: UserListItem[] = []
  let roleOptions: RoleOption[] = []
  let branchOptions: BranchOption[] = []
  let error: string | null = null

  try {
    ;[userList, roleOptions, branchOptions] = await Promise.all([
      db.select({
        id: users.id,
        name: users.name,
        staffNumber: users.staffNumber,
        email: users.email,
        roleId: users.roleId,
        roleName: roles.name,
        branchId: users.branchId,
        branchName: branches.name,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .innerJoin(branches, eq(users.branchId, branches.id))
      .orderBy(users.name),

      db.select({ id: roles.id, name: roles.name }).from(roles).orderBy(roles.name),

      db.select({ id: branches.id, code: branches.code, name: branches.name })
        .from(branches)
        .where(eq(branches.isActive, true))
        .orderBy(branches.name),
    ])
  } catch (e) {
    console.error('UsersPage error:', e)
    error = 'Terjadi kesalahan saat mengambil data pengguna'
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
        <h1 className="text-xl font-semibold text-foreground">Manajemen Pengguna</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Kelola akun pengguna sistem</p>
      </div>
      <UserClient users={userList} roles={roleOptions} branches={branchOptions} />
    </div>
  )
}