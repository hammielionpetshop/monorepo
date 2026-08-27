import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessToken } from '@/lib/auth'
import { hasPermission } from '@/lib/authz'
import { db, users, eq } from '@/lib/db'
import { getResolutionQueue } from '@/lib/services/stock-opname-resolution-report'
import ResolusiClient from './_components/resolusi-client'

export const dynamic = 'force-dynamic'

export interface EmployeeOption {
  id: number
  name: string
}

export default async function StockOpnameResolusiPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  if (!payload) redirect('/login')

  if (!hasPermission(payload, 'stock_opname.resolve')) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-semibold text-foreground">Akses Ditolak</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hanya Owner dan GM yang dapat meresolusi selisih SO Besar.
          </p>
        </div>
      </div>
    )
  }

  const branchId = payload.branchScope === 'ALL' ? null : payload.branchId

  const [queue, employeeOptions] = await Promise.all([
    getResolutionQueue({ branchId }),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.isActive, true)).orderBy(users.name),
  ])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-foreground">Resolusi Selisih SO Besar</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Item selisih SO Besar yang sudah disetujui masih perlu ditindaklanjuti: ternyata ditemukan,
        hangus jadi kerugian toko, dibebankan ke karyawan (bisa dibagi/sebagian), atau lebih dengan
        alasan tertentu.
      </p>

      <ResolusiClient initialQueue={queue} employeeOptions={employeeOptions} />
    </div>
  )
}
