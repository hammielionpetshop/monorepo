import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'
import {
  db,
  interBranchTransfers,
  interBranchTransferItems,
  branches,
  users,
  products,
  unitsOfMeasure,
  eq,
  and,
  or,
} from '@/lib/db'
import { alias } from 'drizzle-orm/pg-core'
import { notFound } from 'next/navigation'
import { InternalTransferDetailClient } from './_components/internal-transfer-detail-client'
import type { InternalTransferDetail } from './_components/types'

export const dynamic = 'force-dynamic'

const GLOBAL_ROLES = ['OWNER', 'GM']

export default async function InternalTransferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const transferId = parseInt(id)

  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  const role = payload?.role ?? 'GUEST'
  const currentBranchId = payload?.branchId ?? null

  let transfer: InternalTransferDetail | null = null
  let error: string | null = null

  try {
    const sourceBranchAlias = alias(branches, 'source_branch')
    const destBranchAlias = alias(branches, 'dest_branch')
    const approvedByAlias = alias(users, 'approved_by_user')
    const receivedByAlias = alias(users, 'received_by_user')
    const transferWhere = payload && GLOBAL_ROLES.includes(payload.role)
      ? eq(interBranchTransfers.id, transferId)
      : and(
          eq(interBranchTransfers.id, transferId),
          or(
            eq(interBranchTransfers.sourceBranchId, currentBranchId ?? -1),
            eq(interBranchTransfers.destinationBranchId, currentBranchId ?? -1)
          )
        )

    const [transferRows, itemRows] = await Promise.all([
      db
        .select({
          id: interBranchTransfers.id,
          ibtNumber: interBranchTransfers.ibtNumber,
          sourceBranchId: interBranchTransfers.sourceBranchId,
          destinationBranchId: interBranchTransfers.destinationBranchId,
          requestedById: interBranchTransfers.requestedById,
          approvedById: interBranchTransfers.approvedById,
          receivedById: interBranchTransfers.receivedById,
          receivedAt: interBranchTransfers.receivedAt,
          status: interBranchTransfers.status,
          totalTransferValue: interBranchTransfers.totalTransferValue,
          notes: interBranchTransfers.notes,
          createdAt: interBranchTransfers.createdAt,
          updatedAt: interBranchTransfers.updatedAt,
          sourceBranchName: sourceBranchAlias.name,
          destinationBranchName: destBranchAlias.name,
          requestedByName: users.name,
          approvedByName: approvedByAlias.name,
          receivedByName: receivedByAlias.name,
        })
        .from(interBranchTransfers)
        .leftJoin(sourceBranchAlias, eq(interBranchTransfers.sourceBranchId, sourceBranchAlias.id))
        .leftJoin(destBranchAlias, eq(interBranchTransfers.destinationBranchId, destBranchAlias.id))
        .leftJoin(users, eq(interBranchTransfers.requestedById, users.id))
        .leftJoin(approvedByAlias, eq(interBranchTransfers.approvedById, approvedByAlias.id))
        .leftJoin(receivedByAlias, eq(interBranchTransfers.receivedById, receivedByAlias.id))
        .where(transferWhere)
        .limit(1),

      db
        .select({
          id: interBranchTransferItems.id,
          transferId: interBranchTransferItems.transferId,
          productId: interBranchTransferItems.productId,
          productName: products.name,
          productSku: products.sku,
          uomId: interBranchTransferItems.uomId,
          uomCode: unitsOfMeasure.code,
          uomName: unitsOfMeasure.name,
          qtyRequested: interBranchTransferItems.qtyRequested,
          qtyShipped: interBranchTransferItems.qtyShipped,
          qtyReceived: interBranchTransferItems.qtyReceived,
          receiveNotes: interBranchTransferItems.receiveNotes,
          costPriceAtTransfer: interBranchTransferItems.costPriceAtTransfer,
          expiryDate: interBranchTransferItems.expiryDate,
          createdAt: interBranchTransferItems.createdAt,
        })
        .from(interBranchTransferItems)
        .leftJoin(products, eq(interBranchTransferItems.productId, products.id))
        .leftJoin(unitsOfMeasure, eq(interBranchTransferItems.uomId, unitsOfMeasure.id))
        .where(eq(interBranchTransferItems.transferId, transferId)),
    ])

    if (!transferRows[0]) return notFound()

    transfer = {
      ...transferRows[0],
      items: itemRows,
    }
  } catch (e) {
    console.error('InternalTransferDetailPage error:', e)
    error = 'Terjadi kesalahan saat mengambil data transfer'
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
    <div className="p-6 max-w-5xl">
      <InternalTransferDetailClient transfer={transfer!} role={role} currentBranchId={currentBranchId} />
    </div>
  )
}
