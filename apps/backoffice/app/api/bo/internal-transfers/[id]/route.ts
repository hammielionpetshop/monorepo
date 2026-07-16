import { NextRequest, NextResponse } from 'next/server'
import { getAuth, scopeFilterAny } from '@/lib/authz'
import {
  db,
  interBranchTransfers,
  interBranchTransferItems,
  branches,
  users,
  products,
  unitsOfMeasure,
  customers,
  eq,
  and,
} from '@/lib/db'
import { alias } from 'drizzle-orm/pg-core'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuth()
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const { id } = await params
    const transferId = parseInt(id)
    if (isNaN(transferId)) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }

    const sourceBranchAlias = alias(branches, 'source_branch')
    const destBranchAlias = alias(branches, 'dest_branch')
    const approvedByAlias = alias(users, 'approved_by_user')

    const [transferRows, itemRows] = await Promise.all([
      db
        .select({
          id: interBranchTransfers.id,
          ibtNumber: interBranchTransfers.ibtNumber,
          sourceBranchId: interBranchTransfers.sourceBranchId,
          destinationBranchId: interBranchTransfers.destinationBranchId,
          requestedById: interBranchTransfers.requestedById,
          approvedById: interBranchTransfers.approvedById,
          status: interBranchTransfers.status,
          totalTransferValue: interBranchTransfers.totalTransferValue,
          convertedTransactionId: interBranchTransfers.convertedTransactionId,
          notes: interBranchTransfers.notes,
          createdAt: interBranchTransfers.createdAt,
          updatedAt: interBranchTransfers.updatedAt,
          sourceBranchName: sourceBranchAlias.name,
          destinationBranchName: destBranchAlias.name,
          requestedByName: users.name,
          approvedByName: approvedByAlias.name,
          destinationCustomerId: customers.id,
          destinationCustomerName: customers.name,
        })
        .from(interBranchTransfers)
        .leftJoin(sourceBranchAlias, eq(interBranchTransfers.sourceBranchId, sourceBranchAlias.id))
        .leftJoin(destBranchAlias, eq(interBranchTransfers.destinationBranchId, destBranchAlias.id))
        .leftJoin(users, eq(interBranchTransfers.requestedById, users.id))
        .leftJoin(approvedByAlias, eq(interBranchTransfers.approvedById, approvedByAlias.id))
        .leftJoin(
          customers,
          and(
            eq(customers.linkedBranchId, interBranchTransfers.destinationBranchId),
            eq(customers.isInternalBranch, true)
          )
        )
        .where(
          and(
            eq(interBranchTransfers.id, transferId),
            scopeFilterAny(
              payload,
              interBranchTransfers.sourceBranchId,
              interBranchTransfers.destinationBranchId
            )
          )
        )
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

    if (!transferRows[0]) {
      return NextResponse.json({ error: 'Transfer tidak ditemukan' }, { status: 404 })
    }

    const transfer = {
      ...transferRows[0],
      items: itemRows,
    }

    return NextResponse.json(transfer)
  } catch (error) {
    console.error('GET internal-transfer detail error:', error)
    return NextResponse.json({ error: 'Gagal mengambil detail transfer' }, { status: 500 })
  }
}
