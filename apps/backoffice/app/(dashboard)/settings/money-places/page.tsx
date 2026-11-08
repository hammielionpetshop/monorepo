import { getAuth, hasPermission } from '@/lib/authz'
import { db, branches, eq, asc } from '@/lib/db'
import { NewBadge } from '@/components/ui/new-badge'
import { getPaymentLinkMatrix, listMoneyPlaces, type MoneyPlaceRow, type PaymentLinkMatrix } from '@/lib/services/money-place-service'
import { listCashDepositDefaults } from '@/lib/services/deposit-queries'
import MoneyPlaceClient from './_components/money-place-client'

export const dynamic = 'force-dynamic'

export default async function MoneyPlacesPage() {
  const payload = await getAuth()
  if (!payload || !hasPermission(payload, 'money_place.read')) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          Halaman ini hanya untuk Owner, GM, dan Finance. Bila Anda baru saja mendapat izin ini, keluar lalu masuk lagi.
        </div>
      </div>
    )
  }

  let places: MoneyPlaceRow[] = []
  let matrix: PaymentLinkMatrix = { branches: [], methods: [], links: [] }
  let branchOptions: { id: number; name: string }[] = []
  let cashDefaults: { branchId: number; moneyPlaceId: number }[] = []
  let error: string | null = null
  try {
    ;[places, matrix, branchOptions, cashDefaults] = await Promise.all([
      listMoneyPlaces(),
      getPaymentLinkMatrix(),
      db.select({ id: branches.id, name: branches.name }).from(branches).where(eq(branches.isActive, true)).orderBy(asc(branches.name)),
      listCashDepositDefaults(),
    ])
  } catch (e) {
    console.error('MoneyPlacesPage error:', e)
    error = 'Terjadi kesalahan saat mengambil daftar Tempat Uang'
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">
          Tempat Uang <NewBadge feature="/settings/money-places" />
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5 max-w-3xl">
          Satu daftar laci kasir, kas tunai, dan rekening untuk semua web. Setiap uang masuk dan keluar nantinya menyebut
          &quot;dari mana&quot; dan &quot;ke mana&quot; memakai daftar ini. Tempat Uang tidak dihapus, cukup dinonaktifkan.
          Laci kasir dibuat otomatis untuk tiap cabang.
        </p>
      </div>
      {error ? (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">{error}</div>
      ) : (
        <MoneyPlaceClient
          initialPlaces={places}
          initialMatrix={matrix}
          branchOptions={branchOptions}
          canManage={hasPermission(payload, 'money_place.manage')}
          initialCashDefaults={cashDefaults}
        />
      )}
    </div>
  )
}
