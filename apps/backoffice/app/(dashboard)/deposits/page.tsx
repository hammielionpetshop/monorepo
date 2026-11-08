import { getAuth, hasPermission, scopeFilter } from '@/lib/authz'
import { db, branches, paymentMethods, eq, and, asc, notInArray } from '@/lib/db'
import { NewBadge } from '@/components/ui/new-badge'
import { listCashDepositDefaults, listDepositDestinations } from '@/lib/services/deposit-queries'
import { getDepositSettings } from '@/lib/services/deposit-service'
import { DEPOSIT_CORRECTOR_ROLES } from '@/lib/services/deposit-rules'
import DepositsClient from './_components/deposits-client'

export const dynamic = 'force-dynamic'

const TABS = ['pending', 'noncash', 'undeposited', 'history'] as const

export default async function DepositsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const payload = await getAuth()
  if (!payload || !hasPermission(payload, 'shift.deposit.verify')) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          Halaman ini hanya untuk Owner, GM, dan Finance.
        </div>
      </div>
    )
  }

  const { tab } = await searchParams
  const initialTab = (TABS as readonly string[]).includes(tab ?? '') ? (tab as (typeof TABS)[number]) : 'pending'

  let data: {
    branches: { id: number; name: string }[]
    destinations: Awaited<ReturnType<typeof listDepositDestinations>>
    defaults: { branchId: number; moneyPlaceId: number }[]
    methods: { id: number; name: string }[]
    settings: Awaited<ReturnType<typeof getDepositSettings>>
  } | null = null
  try {
    const [branchRows, destinations, defaults, methods, settings] = await Promise.all([
      db.select({ id: branches.id, name: branches.name }).from(branches)
        .where(and(eq(branches.isActive, true), scopeFilter(payload, branches.id))).orderBy(asc(branches.name)),
      listDepositDestinations(),
      listCashDepositDefaults(),
      db.select({ id: paymentMethods.id, name: paymentMethods.name }).from(paymentMethods)
        .where(notInArray(paymentMethods.type, ['CASH', 'DEBT'])).orderBy(asc(paymentMethods.name)),
      getDepositSettings(),
    ])
    data = { branches: branchRows, destinations, defaults, methods, settings }
  } catch (e) {
    console.error('DepositsPage error:', e)
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Setoran <NewBadge feature="/deposits" /></h1>
        <p className="text-sm text-muted-foreground mt-0.5 max-w-3xl">
          Verifikasi uang shift yang benar-benar diterima. Tunai per setoran (≥1 shift utuh satu cabang): cabang yang setor bank
          melapor di POS › Setor Tunai, uang yang diantar ke kantor dicatat lewat <strong>Terima Setoran</strong>. Non-tunai
          diverifikasi per shift per metode dari mutasi rekening. Angka diterima selalu diketik; perpindahan uang tercatat
          otomatis saat Verifikasi.
        </p>
      </div>
      {!data ? (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          Terjadi kesalahan saat memuat menu Setoran
        </div>
      ) : (
        <DepositsClient
          initialTab={initialTab}
          branches={data.branches}
          destinations={data.destinations}
          defaults={data.defaults}
          paymentMethods={data.methods}
          initialSettings={data.settings}
          canCorrect={DEPOSIT_CORRECTOR_ROLES.includes(payload.role)}
        />
      )}
    </div>
  )
}
