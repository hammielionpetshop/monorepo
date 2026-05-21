import { cookies } from 'next/headers'
import { verifyAccessTokenCached } from '@/lib/auth-cache'

export default async function PosHomePage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessTokenCached(token) : null

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] p-6 text-center">
      <div className="text-6xl mb-6">🛒</div>
      <h2 className="text-2xl font-bold text-foreground mb-2">
        Selamat datang di Web POS
      </h2>
      <p className="text-base text-muted-foreground mb-1">
        {payload?.userName ?? ''}
      </p>
      <p className="text-sm text-muted-foreground">
        {payload?.branchName ?? ''}
      </p>
      <p className="mt-8 text-sm text-muted-foreground/60 italic">
        Fitur transaksi akan tersedia di Story 9.2
      </p>
    </div>
  )
}
