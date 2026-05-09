import { db, branches } from '@/lib/db'
import BranchClient from './_components/branch-client'
import type { BranchListItem } from './_components/types'

export const dynamic = 'force-dynamic'

export default async function BranchesPage() {
  let branchList: BranchListItem[] = []
  let error: string | null = null

  try {
    branchList = await db
      .select({
        id: branches.id,
        code: branches.code,
        name: branches.name,
        address: branches.address,
        phone: branches.phone,
        isActive: branches.isActive,
        lastSeenAt: branches.lastSeenAt,
        createdAt: branches.createdAt,
      })
      .from(branches)
      .orderBy(branches.code)
  } catch (e) {
    console.error('BranchesPage error:', e)
    error = 'Terjadi kesalahan saat mengambil data cabang'
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
        <h1 className="text-xl font-semibold text-foreground">Pengaturan Cabang</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Kelola informasi cabang</p>
      </div>
      <BranchClient branches={branchList} />
    </div>
  )
}