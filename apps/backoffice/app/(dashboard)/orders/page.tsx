import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessToken } from '@/lib/auth'
import { db, customerOrders, customerOrderItems, customers, eq, desc, inArray, count } from '@/lib/db'
import { OrdersListClient } from './_components/orders-list-client'
import type { CustomerOrderStatus } from './_components/types'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['OWNER', 'GM', 'MANAGER']
const GLOBAL_ROLES = ['OWNER', 'GM']

export default async function OrdersPage() {
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

  const isGlobal = GLOBAL_ROLES.includes(payload.role)

  const orderRows = await db
    .select({
      id: customerOrders.id,
      orderNumber: customerOrders.orderNumber,
      customerName: customers.name,
      customerPhone: customers.phone,
      status: customerOrders.status,
      estimatedTotal: customerOrders.estimatedTotal,
      createdAt: customerOrders.createdAt,
    })
    .from(customerOrders)
    .leftJoin(customers, eq(customerOrders.customerId, customers.id))
    .where(isGlobal ? undefined : eq(customerOrders.branchId, payload.branchId))
    .orderBy(desc(customerOrders.createdAt))
    .limit(200)

  const orderIds = orderRows.map((row) => row.id)
  const itemCountRows = orderIds.length
    ? await db
        .select({ orderId: customerOrderItems.orderId, c: count() })
        .from(customerOrderItems)
        .where(inArray(customerOrderItems.orderId, orderIds))
        .groupBy(customerOrderItems.orderId)
    : []
  const itemCountByOrder = new Map(itemCountRows.map((row) => [row.orderId, Number(row.c)]))

  const orders = orderRows.map((row) => ({
    id: row.id,
    orderNumber: row.orderNumber,
    customerName: row.customerName ?? '-',
    customerPhone: row.customerPhone,
    status: row.status as CustomerOrderStatus,
    estimatedTotal: row.estimatedTotal,
    itemCount: itemCountByOrder.get(row.id) ?? 0,
    createdAt: row.createdAt.toISOString(),
  }))

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-foreground">Order Masuk</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Order dari Customer Order Portal. Review, konfirmasi jadi bulk sale, atau tolak.
        </p>
      </div>
      <OrdersListClient orders={orders} />
    </div>
  )
}
