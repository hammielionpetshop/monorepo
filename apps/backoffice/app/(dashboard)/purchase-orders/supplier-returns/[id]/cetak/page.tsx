import { notFound, redirect } from 'next/navigation'
import { getAuth } from '@/lib/authz'
import { getSupplierReturn } from '@/lib/services/supplier-return-queries'
import { SupplierReturnPrint } from '@/components/supplier-returns/supplier-return-print'

export const dynamic = 'force-dynamic'

export default async function CetakReturSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const payload = await getAuth()
  if (!payload) redirect('/login')

  const { id } = await params
  if (!/^\d+$/.test(id)) notFound()
  const row = await getSupplierReturn(Number(id))
  if (!row) notFound()
  if (payload.branchScope !== 'ALL' && row.branchId !== payload.branchId) notFound()

  return <SupplierReturnPrint row={row} />
}
