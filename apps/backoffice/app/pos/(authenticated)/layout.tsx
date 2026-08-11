import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessTokenCached } from '@/lib/auth-cache'
import { getPosBranchName, canSelectPosBranch } from '@/lib/pos-branch'
import LogoutButton from '@/components/pos/logout-button'
import PosNavTabs from '@/components/pos/pos-nav-tabs'
import ConnectionIndicator from '@/components/connection/connection-indicator'
import OfflineBanner from '@/components/connection/offline-banner'
import Link from 'next/link'
import { LayoutDashboard, Fingerprint } from 'lucide-react'

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

  const canSwitch = canSelectPosBranch(payload)

  if (canSwitch && !cookieStore.get('posBranchId')?.value) {
    redirect('/pos/select-branch')
  }

  const branchName = getPosBranchName(payload, cookieStore)

  async function logoutAction() {
    'use server'
    const cs = await cookies()
    cs.delete('accessToken')
    cs.delete('posBranchId')
    cs.delete('posBranchName')
    redirect('/pos/login')
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-base font-bold text-foreground leading-tight">{payload.userName}</p>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">{branchName}</p>
            {canSwitch && (
              <Link
                href="/pos/select-branch"
                className="text-xs text-primary hover:underline font-medium"
              >
                Ganti
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ConnectionIndicator />
          {(['OWNER', 'GM'] as const).includes(payload.role as 'OWNER' | 'GM') && (
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-md px-3 py-1.5 hover:bg-accent transition-colors"
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>
          )}
          {/* Kasir tidak pernah masuk backoffice, jadi ini satu-satunya pintu ganti PIN mereka. */}
          <Link
            href="/change-pin"
            title="Ganti PIN"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-md px-3 py-1.5 hover:bg-accent transition-colors"
          >
            <Fingerprint className="w-4 h-4" />
            <span className="hidden sm:inline">Ganti PIN</span>
          </Link>
          <LogoutButton logoutAction={logoutAction} />
        </div>
      </header>

      <OfflineBanner mode="pos" />

      <PosNavTabs role={payload.role} />

      <main className="flex min-h-0 flex-1 overflow-y-auto [&>*]:min-w-0 [&>*]:w-full">
        {children}
      </main>
    </div>
  )
}
