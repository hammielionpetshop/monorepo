import { getAuth, hasPermission, scopeFilter } from '@/lib/authz'
import { getDefaultCredentials } from '@/lib/app-settings'
import { db, users, roles, branches, eq, and, isNotNull, sql } from '@/lib/db'
import StaffPinClient from './_components/staff-pin-client'
import type { StaffPinItem } from './_components/types'

export const dynamic = 'force-dynamic'

export default async function StaffPinPage() {
  const payload = await getAuth()

  // Guard halaman: reset PIN orang lain setara sensitif dengan manajemen user.
  if (!payload || !hasPermission(payload, 'user.manage')) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          Anda tidak memiliki akses ke halaman ini.
        </div>
      </div>
    )
  }

  let staff: StaffPinItem[] = []
  let defaultPin = ''
  let error: string | null = null

  try {
    ;[staff, defaultPin] = await Promise.all([
      db
        .select({
          id: users.id,
          name: users.name,
          username: users.username,
          staffNumber: users.staffNumber,
          roleName: roles.name,
          branchName: branches.name,
          isActive: users.isActive,
          // `pin_hash` tidak boleh ikut ke client — cukup kirim ada/tidaknya.
          hasPin: sql<boolean>`${isNotNull(users.pinHash)}`,
          mustChangePin: users.mustChangePin,
          mustChangeCredentials: users.mustChangeCredentials,
          pinSetAt: users.pinSetAt,
        })
        .from(users)
        .innerJoin(roles, eq(users.roleId, roles.id))
        .innerJoin(branches, eq(users.branchId, branches.id))
        .where(and(eq(users.isActive, true), scopeFilter(payload, users.branchId)))
        .orderBy(users.name),

      getDefaultCredentials().then((c) => c.pin),
    ])
  } catch (e) {
    console.error('StaffPinPage error:', e)
    error = 'Terjadi kesalahan saat mengambil data PIN staf'
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
        <h1 className="text-xl font-semibold text-foreground">PIN Staf</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Reset PIN staf yang lupa PIN-nya — password mereka tidak ikut berubah
        </p>
      </div>
      <StaffPinClient staff={staff} defaultPin={defaultPin} currentUserId={payload.userId} />
    </div>
  )
}
