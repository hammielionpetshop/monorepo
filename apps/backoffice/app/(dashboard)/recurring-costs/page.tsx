import { redirect } from 'next/navigation'
import { getAuth, hasPermission } from '@/lib/authz'
import { todayWibDate } from '@/lib/payment-date'
import { db, cashFlowCategories, moneyPlaces, branches, eq, ne, and, asc } from '@/lib/db'
import { canManageRecurringCosts, canViewRecurringCosts } from '@/lib/recurring-cost-access'
import { prepayLimit } from '@/lib/services/recurring-cost-service'
import RecurringCostClient, { type Option, type PlaceOption } from './_components/recurring-cost-client'

export const dynamic = 'force-dynamic'

export default async function RecurringCostsPage() {
  const payload = await getAuth()
  if (!payload) redirect('/login')
  if (!canViewRecurringCosts(payload)) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          Biaya Rutin hanya untuk Owner, GM, dan Finance.
        </div>
      </div>
    )
  }

  const [categories, places, branchOptions] = await Promise.all([
    db
      .select({ id: cashFlowCategories.id, name: cashFlowCategories.name })
      .from(cashFlowCategories)
      .where(and(eq(cashFlowCategories.type, 'EXPENSE'), eq(cashFlowCategories.reportKind, 'COST'), eq(cashFlowCategories.isActive, true)))
      .orderBy(asc(cashFlowCategories.name)) as Promise<Option[]>,
    db
      .select({ id: moneyPlaces.id, name: moneyPlaces.name, kind: moneyPlaces.kind })
      .from(moneyPlaces)
      .where(and(eq(moneyPlaces.isActive, true), ne(moneyPlaces.kind, 'DRAWER')))
      .orderBy(asc(moneyPlaces.kind), asc(moneyPlaces.sortOrder), asc(moneyPlaces.name)) as Promise<PlaceOption[]>,
    db.select({ id: branches.id, name: branches.name }).from(branches).where(eq(branches.isActive, true)).orderBy(asc(branches.name)),
  ])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Biaya Rutin</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Biaya yang angkanya tetap tiap bulan: sewa toko, sewa kendaraan, sewa lain. Setiap bulan muncul tagihan; tombol Sudah dibayar
          langsung mencatatnya di Pendapatan & Pengeluaran untuk bulan tagihannya. Listrik, air, dan biaya yang angkanya berubah tetap dicatat
          di Pendapatan & Pengeluaran.
        </p>
      </div>
      <RecurringCostClient
        categories={categories}
        places={places}
        branches={branchOptions}
        canManage={canManageRecurringCosts(payload)}
        canPay={hasPermission(payload, 'cashflow.record')}
        isOwner={payload.role === 'OWNER'}
        today={todayWibDate()}
        prepayLimit={prepayLimit()}
      />
    </div>
  )
}
