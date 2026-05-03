import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessToken } from '@/lib/auth'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null

  if (!payload) {
    redirect('/login')
  }

  async function logoutAction() {
    'use server'
    const cs = await cookies()
    cs.delete('accessToken')
    redirect('/login')
  }

  return (
    <div className="flex h-screen bg-muted/30">
      {/* Sidebar */}
      <aside className="w-60 bg-card shadow-sm flex-shrink-0 hidden md:flex flex-col border-r border-border">
        <div className="px-6 py-5 border-b border-border/50">
          <h2 className="text-base font-bold text-foreground">Hammielion</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Backoffice</p>
        </div>
        <nav className="p-3 flex-1 space-y-1">
          <a
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-primary transition-colors"
          >
            <span>📊</span>
            Dashboard
          </a>
          <a
            href="/reports/profit-loss"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-primary transition-colors"
          >
            <span>📈</span>
            Laporan Laba Rugi
          </a>
          <a
            href="/reports/stock-valuation"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-primary transition-colors"
          >
            <span>📦</span>
            Laporan Nilai Stok
          </a>
          <a
            href="/inventory/stock-adjustment"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-primary transition-colors"
          >
            <span>🔧</span>
            Penyesuaian Stok
          </a>
        </nav>
      </aside>

      {/* Konten Utama */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="bg-card border-b border-border px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="md:hidden">
            <span className="text-sm font-bold text-foreground">Hammielion</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
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

        {/* Konten Halaman */}
        <main className="flex-1 overflow-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  )
}
