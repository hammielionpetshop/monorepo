import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessTokenCached } from '@/lib/auth-cache'
import { getPosBranchId } from '@/lib/pos-branch'
import { db, purchaseOrders, suppliers, inArray, eq, and, desc } from '@/lib/db'
import { ReceivingClient } from './_components/receiving-client'

export const dynamic = 'force-dynamic'

export default async function ReceivingPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessTokenCached(token) : null

  if (!payload) {
    redirect('/pos/login')
  }

  if (payload.role === 'KASIR') {
    redirect('/pos')
  }

  let pos: any[] = []

  try {
    const rows = await db
      .select({
        id: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        status: purchaseOrders.status,
        totalAmount: purchaseOrders.totalAmount,
        notes: purchaseOrders.notes,
        targetDeliveryDate: purchaseOrders.targetDeliveryDate,
        createdAt: purchaseOrders.createdAt,
        updatedAt: purchaseOrders.updatedAt,
        supplierId: purchaseOrders.supplierId,
        supplierName: suppliers.name,
        supplierPhone: suppliers.phone,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(
        and(
          eq(purchaseOrders.branchId, getPosBranchId(payload, cookieStore)),
          inArray(purchaseOrders.status, ['APPROVED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'])
        )
      )
      .orderBy(desc(purchaseOrders.createdAt))

    pos = rows.map(r => ({
      ...r,
      supplier: { id: r.supplierId, name: r.supplierName ?? '-', phone: r.supplierPhone },
    }))
  } catch (e) {
    console.error('ReceivingPage error:', e)
  }

  return (
    <div className="p-4">
      <ReceivingClient
        pos={pos}
        currentUserId={payload.userId}
        branchId={getPosBranchId(payload, cookieStore)}
      />
    </div>
  )
}
