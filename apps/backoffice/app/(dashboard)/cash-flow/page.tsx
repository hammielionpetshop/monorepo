import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'
import { db, cashFlowCategories } from '@/lib/db'
import EntryClient from './_components/entry-client'
import type { CashFlowCategoryOption } from './_components/types'

export const dynamic = 'force-dynamic'

export default async function CashFlowPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null

  if (!payload) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          Sesi tidak valid, silakan login kembali
        </div>
      </div>
    )
  }

  let categories: CashFlowCategoryOption[] = []
  let error: string | null = null

  try {
    categories = (await db
      .select({ id: cashFlowCategories.id, name: cashFlowCategories.name, type: cashFlowCategories.type })
      .from(cashFlowCategories)
      .orderBy(cashFlowCategories.type, cashFlowCategories.name)) as CashFlowCategoryOption[]
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

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Pendapatan & Pengeluaran</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Catat arus kas masuk dan keluar untuk cabang {payload.branchName}</p>
      </div>
      <EntryClient categories={categories} currentUserName={payload.userName} />
    </div>
  )
}
