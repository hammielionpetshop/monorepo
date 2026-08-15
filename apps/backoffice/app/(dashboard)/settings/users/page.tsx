import { db, users, roles, branches, permissions, eq, asc } from '@/lib/db'
import { listBranchAssignments } from '@/lib/services/user-branch-assignments'
import UserClient from './_components/user-client'
import type { UserListItem, PermissionOption } from './_components/types'

export const dynamic = 'force-dynamic'

// Hasil dari halaman tambah/edit dibawa lewat query, bukan state klien: setelah simpan
// halamannya ditinggalkan, jadi tidak ada komponen yang tersisa untuk memegang pesannya.
const FLASH: Record<string, string> = {
  created: 'Pengguna berhasil ditambahkan',
  updated: 'Pengguna berhasil diperbarui',
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams?: Promise<{ success?: string }>
}) {
  const params = await searchParams
  const flash = params?.success ? FLASH[params.success] ?? null : null

  let userList: UserListItem[] = []
  let permissionOptions: PermissionOption[] = []
  let error: string | null = null

  try {
    let baseUsers: Omit<UserListItem, 'assignedBranches'>[] = []
    ;[baseUsers, permissionOptions] = await Promise.all([
      db.select({
        id: users.id,
        name: users.name,
        username: users.username,
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

      db.select({
        id: permissions.id,
        code: permissions.code,
        name: permissions.name,
        description: permissions.description,
      })
        .from(permissions)
        .orderBy(asc(permissions.name)),
    ])

    const assignments = await listBranchAssignments(baseUsers.map((u) => u.id))
    userList = baseUsers.map((u) => ({
      ...u,
      assignedBranches: assignments.get(u.id) ?? [],
    }))
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
      <UserClient users={userList} permissions={permissionOptions} flash={flash} />
    </div>
  )
}