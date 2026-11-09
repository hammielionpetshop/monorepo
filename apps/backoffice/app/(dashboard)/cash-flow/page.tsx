import { redirect } from 'next/navigation'
import { getAuth, hasPermission } from '@/lib/authz'
import { todayWibDate } from '@/lib/payment-date'
import { db, cashFlowCategories, moneyPlaces, branches, eq, ne, and, asc } from '@/lib/db'
import EntryClient from './_components/entry-client'
import type { BranchOption, CashFlowCategoryOption, MoneyPlaceOption } from './_components/types'

export const dynamic = 'force-dynamic'

export default async function CashFlowPage() {
  const payload = await getAuth()
  if (!payload) redirect('/login')

  let categories: CashFlowCategoryOption[] = []
  let places: MoneyPlaceOption[] = []
  let branchOptions: BranchOption[] = []
  let error: string | null = null

  try {
    categories = (await db
      .select({
        id: cashFlowCategories.id,
        name: cashFlowCategories.name,
        type: cashFlowCategories.type,
        reportKind: cashFlowCategories.reportKind,
        isActive: cashFlowCategories.isActive,
        isSystem: cashFlowCategories.isSystem,
        ownerOnly: cashFlowCategories.ownerOnly,
        noteRequired: cashFlowCategories.noteRequired,
      })
      .from(cashFlowCategories)
      .orderBy(cashFlowCategories.type, cashFlowCategories.name)) as CashFlowCategoryOption[]
    places = (await db
      .select({ id: moneyPlaces.id, name: moneyPlaces.name, kind: moneyPlaces.kind, branchName: branches.name })
      .from(moneyPlaces)
      .innerJoin(branches, eq(branches.id, moneyPlaces.branchId))
      .where(and(eq(moneyPlaces.isActive, true), ne(moneyPlaces.kind, 'DRAWER')))
      .orderBy(asc(moneyPlaces.kind), asc(moneyPlaces.sortOrder), asc(moneyPlaces.name))) as MoneyPlaceOption[]
    branchOptions = await db
      .select({ id: branches.id, name: branches.name })
      .from(branches)
      .where(eq(branches.isActive, true))
      .orderBy(asc(branches.name))
  } catch (e) {
    console.error('CashFlowPage error:', e)
    error = 'Terjadi kesalahan saat mengambil data'
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      </div>
    )
  }

  const canRecord = hasPermission(payload, 'cashflow.record')
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Pendapatan & Pengeluaran</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {canRecord
            ? 'Satu tempat mencatat uang masuk dan keluar (listrik, air, perbaikan, dll.) untuk semua cabang. Gaji, bensin, dan bayar supplier dicatat di menunya masing-masing.'
            : `Catatan arus kas cabang ${payload.branchName}. Pencatatan dilakukan Owner, GM, atau Finance.`}
        </p>
      </div>
      <EntryClient
        categories={categories}
        places={places}
        branches={branchOptions}
        currentUserName={payload.userName}
        activeBranchId={payload.branchId}
        canRecord={canRecord}
        isOwner={payload.role === 'OWNER'}
        today={todayWibDate()}
      />
    </div>
  )
}
