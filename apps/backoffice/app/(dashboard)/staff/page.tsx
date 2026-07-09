import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { verifyAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  GM: 'General Manager',
  MANAGER: 'Manager',
  GUDANG: 'Gudang',
  FINANCE: 'Finance',
  KASIR: 'Kasir',
}

// Ringkasan widget yang akan tampil per peran (diisi penuh di S8).
const ROLE_WIDGETS: Record<string, { title: string; items: string[] }> = {
  MANAGER: {
    title: 'Ringkasan Cabang Anda',
    items: ['Status shift kasir hari ini', 'Transaksi cabang sendiri', 'Approval yang menunggu'],
  },
  GUDANG: {
    title: 'Tugas Gudang',
    items: ['Stock opname menunggu', 'Transfer antar cabang berjalan', 'Penerimaan barang PO'],
  },
  FINANCE: {
    title: 'Tugas Finance',
    items: ['Piutang jatuh tempo', 'Pembayaran hutang menunggu', 'Pengajuan void menunggu'],
  },
}

export default async function StaffDashboardPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  if (!payload) {
    redirect('/login')
  }

  const roleLabel = ROLE_LABELS[payload.role] ?? payload.role
  const widgets = ROLE_WIDGETS[payload.role]
  const isReadOnlyPreview = payload.role === 'OWNER' || payload.role === 'GM'

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">Halo, {payload.userName}</h1>
        <p className="text-sm text-muted-foreground">
          {roleLabel}
          {payload.branchName ? ` · ${payload.branchName}` : ''}
        </p>
      </div>

      {isReadOnlyPreview && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
          Anda melihat halaman staf sebagai <strong>{roleLabel}</strong> (read-only). Data omzet & laba
          global tetap tersedia di <a className="underline" href="/dashboard">Dashboard</a>.
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-6 shadow-xs">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {widgets?.title ?? 'Ringkasan'}
        </h2>
        {widgets ? (
          <ul className="mt-4 flex flex-col gap-2">
            {widgets.items.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-card-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Ringkasan untuk peran Anda akan segera tersedia.
          </p>
        )}
        <p className="mt-6 text-xs text-muted-foreground/70">
          Widget rinci per peran sedang disiapkan. Halaman ini sengaja tidak menampilkan omzet & laba
          kotor global.
        </p>
      </div>
    </div>
  )
}
