import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessToken } from '@/lib/auth'
import { db, branches, users, categories, eq } from '@/lib/db'
import SOInitiatorClient from './_components/so-initiator-client'

export const dynamic = 'force-dynamic'

export interface BranchOption {
  id: number
  name: string
}

export interface UserOption {
  id: number
  name: string
  staffNumber: string | null
}

export interface CategoryOption {
  id: number
  name: string
}

export default async function NewStockOpnamePage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null

  if (!payload) redirect('/login')
  if (payload.role !== 'OWNER' && payload.role !== 'MANAGER') {
    redirect('/inventory/stock-opname')
  }

  const [branchList, userList, categoryList] = await Promise.all([
    db.select({ id: branches.id, name: branches.name })
      .from(branches)
      .orderBy(branches.name),

    db.select({ id: users.id, name: users.name, staffNumber: users.staffNumber })
      .from(users)
      .where(eq(users.isActive, true))
      .orderBy(users.name),

    db.select({ id: categories.id, name: categories.name })
      .from(categories)
      .orderBy(categories.name),
  ])

  return (
    <div className="p-6 max-w-xl">
      <div className="mb-6">
        <a href="/inventory/stock-opname" className="text-sm text-muted-foreground hover:underline">
          &larr; Kembali ke Stock Opname
        </a>
      </div>
      <h1 className="text-xl font-semibold text-foreground mb-1">Mulai SO Besar</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Inisiasi Stock Opname Besar dari Backoffice. SO akan muncul di POS cabang yang dipilih.
      </p>
      <SOInitiatorClient
        branches={branchList}
        users={userList}
        categories={categoryList}
      />
    </div>
  )
}