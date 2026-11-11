import { redirect } from 'next/navigation'
import { getAuth, hasPermission } from '@/lib/authz'
import { todayWibDate } from '@/lib/payment-date'
import { db, moneyPlaces, branches, eq, ne, and, asc } from '@/lib/db'
import TransferClient, { type TransferPlace } from './_components/transfer-client'

export const dynamic = 'force-dynamic'

export default async function MoneyTransfersPage() {
  const payload = await getAuth()
  if (!payload) redirect('/login')
  const canRecord = hasPermission(payload, 'cashflow.record')
  if (!canRecord && !hasPermission(payload, 'cashflow.cancel')) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          Pindah Dana hanya untuk Owner, GM, dan Finance.
        </div>
      </div>
    )
  }

  const places = (await db
    .select({ id: moneyPlaces.id, name: moneyPlaces.name, kind: moneyPlaces.kind, branchName: branches.name })
    .from(moneyPlaces)
    .innerJoin(branches, eq(branches.id, moneyPlaces.branchId))
    .where(and(eq(moneyPlaces.isActive, true), ne(moneyPlaces.kind, 'DRAWER')))
    .orderBy(asc(moneyPlaces.kind), asc(moneyPlaces.sortOrder), asc(moneyPlaces.name))) as TransferPlace[]

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Pindah Dana</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Catat uang yang pindah antar Tempat Uang: Brankas → rekening (setor bank), rekening → Brankas (tarik tunai), Brankas → kas pegangan.
          Bukan biaya dan bukan pendapatan. Biaya transfer (bila ada) dicatat terpisah di Pendapatan & Pengeluaran kategori Biaya bank.
          Setoran toko tetap lewat menu Setoran.
        </p>
      </div>
      <TransferClient places={places} canRecord={canRecord} isOwner={payload.role === 'OWNER'} today={todayWibDate()} />
    </div>
  )
}
