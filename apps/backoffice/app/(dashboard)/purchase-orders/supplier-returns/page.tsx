import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/authz'
import { db, branches, eq } from '@/lib/db'
import { listSupplierReturns } from '@/lib/services/supplier-return-queries'
import { SupplierReturnsClient } from './_components/supplier-returns-client'

export const dynamic = 'force-dynamic'

export default async function SupplierReturnsPage() {
  const payload = await getAuth()
  if (!payload) redirect('/login')

  const allBranches = payload.branchScope === 'ALL'
  const [rows, branchOptions] = await Promise.all([
    listSupplierReturns({ branchId: allBranches ? null : payload.branchId }),
    // Akun lintas cabang memilih cabang retur sendiri; akun cabang terkunci ke cabangnya.
    allBranches
      ? db.select({ id: branches.id, name: branches.name }).from(branches).where(eq(branches.isActive, true)).orderBy(branches.name)
      : Promise.resolve([]),
  ])

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Retur ke Supplier</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Barang yang sudah diterima lalu dikembalikan ke supplier (rusak/expired). Pengajuan disetujui Owner/GM di
          Permintaan Persetujuan — saat itu stok keluar dan tagihan PO asal dipotong; kelebihannya jadi saldo supplier.
          {!allBranches && (
            <> Pengajuan baru dibuat untuk cabang <b>{payload.branchName}</b>.</>
          )}
        </p>
      </div>
      <SupplierReturnsClient rows={rows} branchId={payload.branchId} branchOptions={branchOptions} />
    </div>
  )
}
