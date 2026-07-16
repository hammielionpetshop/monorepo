import { getAuth, hasPermission } from '@/lib/authz'
import { db, roles, permissions, rolePermissions, users, eq, count } from '@/lib/db'
import RolesClient from './_components/roles-client'
import type { PermissionItem, RoleItem } from './_components/types'

export const dynamic = 'force-dynamic'

export default async function RolesPage() {
  const payload = await getAuth()

  // Guard halaman: hanya pemilik hak `user.manage` (OWNER).
  if (!payload || !hasPermission(payload, 'user.manage')) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          Anda tidak memiliki akses ke halaman ini.
        </div>
      </div>
    )
  }

  let roleList: RoleItem[] = []
  let permissionList: PermissionItem[] = []
  let error: string | null = null

  try {
    const [roleRows, permRows, rpRows, userCounts] = await Promise.all([
      db.select({ id: roles.id, name: roles.name, description: roles.description })
        .from(roles)
        .orderBy(roles.id),
      db.select({ id: permissions.id, code: permissions.code, name: permissions.name, description: permissions.description })
        .from(permissions)
        .orderBy(permissions.code),
      db.select({ roleId: rolePermissions.roleId, permissionId: rolePermissions.permissionId })
        .from(rolePermissions),
      db.select({ roleId: users.roleId, total: count() })
        .from(users)
        .where(eq(users.isActive, true))
        .groupBy(users.roleId),
    ])

    const countByRole = new Map(userCounts.map((r) => [r.roleId, r.total]))
    const permsByRole = new Map<number, number[]>()
    for (const row of rpRows) {
      const list = permsByRole.get(row.roleId)
      if (list) list.push(row.permissionId)
      else permsByRole.set(row.roleId, [row.permissionId])
    }

    roleList = roleRows.map((r) => ({
      ...r,
      userCount: countByRole.get(r.id) ?? 0,
      permissionIds: permsByRole.get(r.id) ?? [],
    }))
    permissionList = permRows
  } catch (e) {
    console.error('RolesPage error:', e)
    error = 'Terjadi kesalahan saat mengambil data role dan permission'
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
        <h1 className="text-xl font-semibold text-foreground">Role &amp; Permission</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Atur permission yang dimiliki setiap role
        </p>
      </div>
      <RolesClient roles={roleList} permissions={permissionList} currentRole={payload.role} />
    </div>
  )
}
