import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessTokenCached } from '@/lib/auth-cache'
import { getPosBranchId } from '@/lib/pos-branch'
import {
  db,
  interBranchTransfers,
  interBranchTransferItems,
  branches,
  products,
  unitsOfMeasure,
  users,
  eq,
  and,
  inArray,
} from '@/lib/db'
import { alias } from 'drizzle-orm/pg-core'
import { IncomingTransfersClient } from './_components/incoming-transfers-client'

export const dynamic = 'force-dynamic'

export default async function IncomingTransfersPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessTokenCached(token) : null
  if (!payload) redirect('/pos/login')

  const currentBranchId = getPosBranchId(payload, cookieStore)
  const sourceBranchAlias = alias(branches, 'source_branch')

  const transfers = await db
    .select({
      id: interBranchTransfers.id,
      ibtNumber: interBranchTransfers.ibtNumber,
      sourceBranchId: interBranchTransfers.sourceBranchId,
      sourceBranchName: sourceBranchAlias.name,
      status: interBranchTransfers.status,
      notes: interBranchTransfers.notes,
      createdAt: interBranchTransfers.createdAt,
      requestedByName: users.name,
    })
    .from(interBranchTransfers)
    .leftJoin(sourceBranchAlias, eq(interBranchTransfers.sourceBranchId, sourceBranchAlias.id))
    .leftJoin(users, eq(interBranchTransfers.requestedById, users.id))
    .where(
      and(
        eq(interBranchTransfers.destinationBranchId, currentBranchId),
        eq(interBranchTransfers.status, 'IN_TRANSIT')
      )
    )
    .orderBy(interBranchTransfers.createdAt)

  const transferIds = transfers.map((t) => t.id)

  const itemRows =
    transferIds.length > 0
      ? await db
          .select({
            id: interBranchTransferItems.id,
            transferId: interBranchTransferItems.transferId,
            productId: interBranchTransferItems.productId,
            productName: products.name,
            productSku: products.sku,
            uomId: interBranchTransferItems.uomId,
            uomCode: unitsOfMeasure.code,
            qtyRequested: interBranchTransferItems.qtyRequested,
            qtyShipped: interBranchTransferItems.qtyShipped,
            costPriceAtTransfer: interBranchTransferItems.costPriceAtTransfer,
          })
          .from(interBranchTransferItems)
          .leftJoin(products, eq(interBranchTransferItems.productId, products.id))
          .leftJoin(unitsOfMeasure, eq(interBranchTransferItems.uomId, unitsOfMeasure.id))
          .where(inArray(interBranchTransferItems.transferId, transferIds))
      : []

  const itemsByTransferId = itemRows.reduce<Record<number, typeof itemRows>>(
    (acc, item) => {
      if (!acc[item.transferId]) acc[item.transferId] = []
      acc[item.transferId].push(item)
      return acc
    },
    {}
  )

  const serialized = transfers.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    items: itemsByTransferId[t.id] ?? [],
  }))

  return (
    <div className="p-4">
      <IncomingTransfersClient transfers={serialized} />
    </div>
  )
}
