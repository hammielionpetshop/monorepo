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
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-60 bg-white shadow-sm flex-shrink-0 hidden md:flex flex-col">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Hammielion</h2>
          <p className="text-xs text-gray-400 mt-0.5">Backoffice</p>
        </div>
        <nav className="p-3 flex-1">
          <a
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors"
          >
            <span>📊</span>
            Dashboard
          </a>
          <a
            href="/reports/profit-loss"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors"
          >
            <span>📈</span>
            Laporan Laba Rugi
          </a>
        </nav>
      </aside>

      {/* Konten Utama */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="md:hidden">
            <span className="text-sm font-bold text-gray-900">Hammielion</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{payload.userName}</p>
              <p className="text-xs text-gray-500">{payload.role}</p>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Keluar
              </button>
            </form>
          </div>
        </header>

        {/* Konten Halaman */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
