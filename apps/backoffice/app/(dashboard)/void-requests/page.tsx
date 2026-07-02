import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessToken } from '@/lib/auth'
import VoidRequestsClient from './_components/void-requests-client'

export const dynamic = 'force-dynamic'

const APPROVER_ROLES = ['OWNER', 'GM']

export default async function VoidRequestsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null

  if (!payload) redirect('/login')

  if (!APPROVER_ROLES.includes(payload.role)) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-semibold text-foreground">Akses Ditolak</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hanya Owner dan GM yang dapat memproses persetujuan void.
          </p>
        </div>
      </div>
    )
  }

  return <VoidRequestsClient />
}
