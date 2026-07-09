import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { db, stockOpnames, stockOpnameItems, eq } from '@/lib/db'
import { applySOStockAdjustment } from '@/lib/stock-adjustment'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID tidak valid'),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePermission('stock_opname.approve')
    if (gate instanceof NextResponse) return gate
    const payload = gate

    const currentUserId = Number(payload.userId)
    if (Number.isNaN(currentUserId)) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const { id } = await params
    const paramParsed = paramsSchema.safeParse({ id })
    if (!paramParsed.success) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }
    const targetId = Number(paramParsed.data.id)

    await db.transaction(async (tx) => {
      const soRows = await tx
        .select({
          id: stockOpnames.id,
          status: stockOpnames.status,
          branchId: stockOpnames.branchId,
        })
        .from(stockOpnames)
        .where(eq(stockOpnames.id, targetId))
        .for('update')
        .limit(1)

      if (soRows.length === 0) {
        throw new Error('SO_NOT_FOUND')
      }

      if (soRows[0].status !== 'PENDING') {
        throw new Error('ALREADY_PROCESSED')
      }

      const soBranchId = soRows[0].branchId

      if (payload.branchScope !== 'ALL' && payload.branchId !== soBranchId) {
        throw new Error('BRANCH_FORBIDDEN')
      }

      const items = await tx
        .select()
        .from(stockOpnameItems)
        .where(eq(stockOpnameItems.soId, targetId))

      if (items.length === 0) {
        throw new Error('SO_HAS_NO_ITEMS')
      }

      for (const item of items) {
        if (item.varianceQty === null || item.varianceQty === undefined) continue
        const varianceQty = Number(item.varianceQty)
        if (Number.isNaN(varianceQty) || varianceQty === 0) continue

        if (item.systemQty === null || item.systemQty === undefined ||
            item.physicalQty === null || item.physicalQty === undefined) {
          throw new Error('INVALID_ITEM_DATA')
        }

        await applySOStockAdjustment(tx, {
          productId: item.productId,
          branchId: soBranchId,
          uomId: item.uomId,
          systemQty: item.systemQty,
          physicalQty: item.physicalQty,
          currentUserId,
        })
      }

      await tx
        .update(stockOpnames)
        .set({
          status: 'APPROVED',
          approvedById: currentUserId,
          approvedAt: new Date(),
        })
        .where(eq(stockOpnames.id, targetId))
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'SO_NOT_FOUND') {
        return NextResponse.json({ error: 'Stock opname tidak ditemukan' }, { status: 404 })
      }
      if (error.message === 'ALREADY_PROCESSED') {
        return NextResponse.json({ error: 'Stock opname sudah diproses sebelumnya' }, { status: 400 })
      }
      if (error.message === 'BRANCH_FORBIDDEN') {
        return NextResponse.json({ error: 'Akses ditolak. Anda hanya dapat menyetujui stock opname cabang Anda sendiri.' }, { status: 403 })
      }
      if (error.message === 'SO_HAS_NO_ITEMS') {
        return NextResponse.json({ error: 'Stock opname belum memiliki item, tidak dapat disetujui' }, { status: 400 })
      }
      if (error.message === 'INVALID_ITEM_DATA') {
        return NextResponse.json({ error: 'Data item stock opname tidak valid, hubungi administrator' }, { status: 422 })
      }
    }
    console.error('PATCH /api/bo/stock-opnames/[id]/approve error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menyetujui stock opname' }, { status: 500 })
  }
}
