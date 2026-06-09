import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { verifyAccessToken } from '@/lib/auth'
import {
  db,
  interBranchTransfers,
  interBranchTransferItems,
  interBranchPayables,
  productStocks,
  eq,
  and,
  sql,
} from '@/lib/db'

export const dynamic = 'force-dynamic'

const shipItemSchema = z.object({
  itemId: z.number().int().positive(),
  qtyShipped: z.number().int().min(0),
})

const statusSchema = z.object({
  action: z.enum(['approve', 'prepare', 'ship', 'receive', 'cancel']),
  items: z.array(shipItemSchema).optional(),
})

const MANAGER_ROLES = ['OWNER', 'GM', 'MANAGER']

type TransferStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PREPARING' | 'IN_TRANSIT' | 'FULLY_RECEIVED' | 'CANCELLED'

const VALID_TRANSITIONS: Record<string, { from: TransferStatus[]; to: TransferStatus; requiresManagerRole: boolean }> = {
  approve:  { from: ['DRAFT', 'PENDING_APPROVAL'], to: 'APPROVED',        requiresManagerRole: true },
  prepare:  { from: ['APPROVED'],                   to: 'PREPARING',       requiresManagerRole: false },
  ship:     { from: ['PREPARING'],                  to: 'IN_TRANSIT',      requiresManagerRole: false },
  receive:  { from: ['IN_TRANSIT'],                 to: 'FULLY_RECEIVED',  requiresManagerRole: false },
  cancel:   { from: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_TRANSIT'], to: 'CANCELLED', requiresManagerRole: true },
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const { id } = await params
    const transferId = parseInt(id)
    if (isNaN(transferId)) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }

    if (!req.headers.get('content-type')?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
    }

    const parsed = statusSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }

    const { action, items: shipItems } = parsed.data

    if (action === 'ship' && (!shipItems || shipItems.length === 0)) {
      return NextResponse.json(
        { error: 'Data qty pengiriman per item wajib diisi untuk aksi pengiriman' },
        { status: 400 }
      )
    }
    const transition = VALID_TRANSITIONS[action]

    if (transition.requiresManagerRole && !MANAGER_ROLES.includes(payload.role)) {
      return NextResponse.json(
        { error: 'Akses ditolak. Hanya Manager, GM, dan Owner yang dapat melakukan aksi ini.' },
        { status: 403 }
      )
    }

    const [transfer] = await db
      .select()
      .from(interBranchTransfers)
      .where(eq(interBranchTransfers.id, transferId))
      .limit(1)

    if (!transfer) {
      return NextResponse.json({ error: 'Transfer tidak ditemukan' }, { status: 404 })
    }

    if (!transition.from.includes(transfer.status as TransferStatus)) {
      return NextResponse.json(
        { error: `Aksi '${action}' tidak valid untuk status transfer saat ini (${transfer.status})` },
        { status: 409 }
      )
    }

    const items = await db
      .select()
      .from(interBranchTransferItems)
      .where(eq(interBranchTransferItems.transferId, transferId))

    const result = await db.transaction(async (tx) => {
      if (action === 'ship') {
        const shipMap = new Map((shipItems ?? []).map((s) => [s.itemId, s.qtyShipped]))
        let totalShipped = 0

        for (const item of items) {
          const qty = shipMap.get(item.id) ?? 0
          if (qty < 0) throw new Error('QTY_NEGATIF')

          await tx
            .update(interBranchTransferItems)
            .set({ qtyShipped: qty })
            .where(eq(interBranchTransferItems.id, item.id))

          if (qty > 0) {
            await tx
              .update(productStocks)
              .set({ qty: sql`${productStocks.qty} - ${qty}` })
              .where(
                and(
                  eq(productStocks.productId, item.productId),
                  eq(productStocks.branchId, transfer.sourceBranchId),
                  eq(productStocks.uomId, item.uomId)
                )
              )
            totalShipped += qty
          }
        }

        if (totalShipped === 0) {
          throw new Error('SEMUA_QTY_NOL')
        }
      }

      if (action === 'receive') {
        let payableTotal = 0

        for (const item of items) {
          const [existing] = await tx
            .select({ id: productStocks.id })
            .from(productStocks)
            .where(
              and(
                eq(productStocks.productId, item.productId),
                eq(productStocks.branchId, transfer.destinationBranchId),
                eq(productStocks.uomId, item.uomId)
              )
            )
            .limit(1)

          if (existing) {
            await tx
              .update(productStocks)
              .set({ qty: sql`${productStocks.qty} + ${item.qtyShipped}` })
              .where(eq(productStocks.id, existing.id))
          } else {
            await tx.insert(productStocks).values({
              productId: item.productId,
              branchId: transfer.destinationBranchId,
              uomId: item.uomId,
              qty: item.qtyShipped,
            })
          }

          await tx
            .update(interBranchTransferItems)
            .set({ qtyReceived: item.qtyShipped })
            .where(eq(interBranchTransferItems.id, item.id))

          payableTotal += item.qtyShipped * item.costPriceAtTransfer
        }

        if (payableTotal > 0) {
          await tx.insert(interBranchPayables).values({
            transferId,
            debtorBranchId: transfer.destinationBranchId,
            creditorBranchId: transfer.sourceBranchId,
            totalAmount: payableTotal,
            paidAmount: 0,
            status: 'UNPAID',
          })
        }
      }

      if (action === 'cancel' && transfer.status === 'IN_TRANSIT') {
        for (const item of items) {
          await tx
            .update(productStocks)
            .set({ qty: sql`${productStocks.qty} + ${item.qtyShipped}` })
            .where(
              and(
                eq(productStocks.productId, item.productId),
                eq(productStocks.branchId, transfer.sourceBranchId),
                eq(productStocks.uomId, item.uomId)
              )
            )
        }
      }

      const updateData: {
        status: TransferStatus
        updatedAt: Date
        approvedById?: number
      } = {
        status: transition.to,
        updatedAt: new Date(),
      }

      if (action === 'approve') {
        updateData.approvedById = payload.userId
      }

      const [updated] = await tx
        .update(interBranchTransfers)
        .set(updateData)
        .where(eq(interBranchTransfers.id, transferId))
        .returning()

      return updated
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'SEMUA_QTY_NOL') {
        return NextResponse.json(
          { error: 'Minimal satu item harus memiliki qty kirim lebih dari 0' },
          { status: 400 }
        )
      }
      if (error.message === 'QTY_NEGATIF') {
        return NextResponse.json({ error: 'Qty kirim tidak boleh negatif' }, { status: 400 })
      }
    }
    console.error('PATCH internal-transfer status error:', error)
    return NextResponse.json({ error: 'Gagal memperbarui status transfer' }, { status: 500 })
  }
}
