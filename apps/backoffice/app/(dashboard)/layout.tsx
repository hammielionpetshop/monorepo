import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessToken, verifyAccessTokenSignatureOnly } from '@/lib/auth'
import { db, branches, eq, and, inArray } from '@/lib/db'
import { allowedBranchIds, canSwitchBranch } from '@/lib/active-branch'
import { revokeSession } from '@/lib/services/user-session'
import Sidebar from './_components/sidebar'
import BranchSwitcher from './_components/branch-switcher'
import OfflineBanner from '@/components/connection/offline-banner'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null

  if (!payload) {
    // Bedakan "tidak punya sesi" dari "sesinya direbut perangkat lain". Tanda tangan yang
    // masih sah padahal payload ditolak hanya bisa berarti yang kedua — dan orangnya berhak
    // tahu itu, bukan sekadar mendarat di halaman login tanpa penjelasan.
    if (token && (await verifyAccessTokenSignatureOnly(token))) {
      redirect('/api/auth/session-ended')
    }
    redirect('/login')
  }

  // Hanya ditarik kalau orangnya memang punya lebih dari satu cabang — staf bercabang tunggal
  // tidak menambah query apa pun ke tiap render layout.
  const allowed = canSwitchBranch(payload) ? allowedBranchIds(payload) : null
  const switchableBranches = allowed
    ? await db
        .select({ id: branches.id, name: branches.name, code: branches.code })
        .from(branches)
        .where(
          allowed === 'ALL'
            ? eq(branches.isActive, true)
            : and(eq(branches.isActive, true), inArray(branches.id, allowed)),
        )
        .orderBy(branches.name)
    : []

  const sessionId = payload.sessionId

  async function logoutAction() {
    'use server'
    // Cabut sesinya, jangan cuma hapus cookie: token yang sama masih sah sampai kedaluwarsa
    // kalau sesinya dibiarkan hidup, dan siapa pun yang sempat menyalinnya tetap bisa masuk.
    if (sessionId !== undefined) await revokeSession(sessionId, 'LOGOUT')
    const cs = await cookies()
    cs.delete('accessToken')
    redirect('/login')
  }

  return (
    <div className="flex h-screen bg-muted/30">
      <Sidebar
        role={payload.role}
        userName={payload.userName}
        branchName={payload.branchName}
      />

      {/* Konten Utama */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="bg-card border-b border-border px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="md:hidden pl-10">
            <span className="text-sm font-bold text-foreground">Hammielion</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {switchableBranches.length > 1 && (
              <BranchSwitcher
                branches={switchableBranches}
                currentBranchId={payload.branchId}
                currentBranchName={payload.branchName}
              />
            )}
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-foreground">{payload.userName}</p>
              <p className="text-xs text-muted-foreground">{payload.role}</p>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-medium text-muted-foreground border border-border rounded-md hover:bg-accent hover:text-foreground transition-colors"
              >
                Keluar
              </button>
            </form>
          </div>
        </header>

        <OfflineBanner mode="backoffice" />

        {/* Konten Halaman */}
        <main className="flex-1 overflow-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  )
}
