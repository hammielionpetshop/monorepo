import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { verifyAccessToken } from '@/lib/auth'
import {
  db,
  customerOrders,
  customerOrderItems,
  customers,
  branches,
  transactions,
  eq,
  and,
} from '@/lib/db'
import { OrderDetailClient } from './_components/order-detail-client'
import type { OrderDetail } from '../_components/types'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['OWNER', 'GM', 'MANAGER']
const GLOBAL_ROLES = ['OWNER', 'GM']

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const orderId = parseInt(id)

  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null

  if (!payload) redirect('/login')

  if (!ALLOWED_ROLES.includes(payload.role)) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-semibold text-foreground">Akses Ditolak</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hanya Owner, GM, dan Manager yang dapat mengelola order masuk.
          </p>
        </div>
      </div>
    )
  }

  if (isNaN(orderId)) return notFound()

  const isGlobal = GLOBAL_ROLES.includes(payload.role)

  const [orderRow] = await db
    .select({
      id: customerOrders.id,
      orderNumber: customerOrders.orderNumber,
      customerId: customerOrders.customerId,
      customerName: customers.name,
      customerPhone: customers.phone,
      branchId: customerOrders.branchId,
      branchName: branches.name,
      status: customerOrders.status,
      note: customerOrders.note,
      estimatedTotal: customerOrders.estimatedTotal,
      convertedTransactionId: customerOrders.convertedTransactionId,
      convertedTrxNumber: transactions.trxNumber,
      rejectReason: customerOrders.rejectReason,
      createdAt: customerOrders.createdAt,
    })
    .from(customerOrders)
    .leftJoin(customers, eq(customerOrders.customerId, customers.id))
    .leftJoin(branches, eq(customerOrders.branchId, branches.id))
    .leftJoin(transactions, eq(customerOrders.convertedTransactionId, transactions.id))
    .where(
      and(
        eq(customerOrders.id, orderId),
        isGlobal ? undefined : eq(customerOrders.branchId, payload.branchId),
      ),
    )
    .limit(1)

  if (!orderRow) return notFound()

  const itemRows = await db
    .select({
      productId: customerOrderItems.productId,
      productName: customerOrderItems.productName,
      uomId: customerOrderItems.uomId,
      uomCode: customerOrderItems.uomCode,
      qty: customerOrderItems.qty,
      priceTier: customerOrderItems.priceTier,
      unitPriceSnapshot: customerOrderItems.unitPriceSnapshot,
      subtotalSnapshot: customerOrderItems.subtotalSnapshot,
    })
    .from(customerOrderItems)
    .where(eq(customerOrderItems.orderId, orderId))
    .orderBy(customerOrderItems.id)

  const order: OrderDetail = {
    ...orderRow,
    status: orderRow.status as OrderDetail['status'],
    createdAt: orderRow.createdAt.toISOString(),
    items: itemRows,
  }

  return (
    <div className="p-6 max-w-4xl">
      <OrderDetailClient order={order} />
    </div>
  )
}
