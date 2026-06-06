import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessTokenCached } from '@/lib/auth-cache'
import LogoutButton from '@/components/pos/logout-button'
import PosNavTabs from '@/components/pos/pos-nav-tabs'

export default async function PosAuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessTokenCached(token) : null

  if (!payload) {
    redirect('/pos/login')
  }

  async function logoutAction() {
    'use server'
    const cs = await cookies()
    cs.delete('accessToken')
    redirect('/pos/login')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-base font-bold text-foreground leading-tight">{payload.userName}</p>
          <p className="text-sm text-muted-foreground">{payload.branchName}</p>
        </div>
        <LogoutButton logoutAction={logoutAction} />
      </header>

      <PosNavTabs role={payload.role} />

      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}
