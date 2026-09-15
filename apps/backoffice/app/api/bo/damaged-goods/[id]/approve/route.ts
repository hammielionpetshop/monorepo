import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { auditLogs, db, damagedGoods, damagedGoodsItems, eq, and } from '@/lib/db'
import { StockService, InsufficientStockError } from '@/lib/services/stock-service'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID tidak valid'),
})

const bodySchema = z.object({
  resolutionAction: z.enum(['MUSNAHKAN', 'RETUR_SUPPLIER', 'JUAL_DISKON', 'LAINNYA'], {
    message: 'Tindak lanjut tidak valid',
  }),
  resolutionNotes: z.string().max(500).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requirePermission('damaged_goods.approve')
    if (gate instanceof NextResponse) return gate
    const payload = gate

    if (req.headers.get('content-type')?.includes('application/json') !== true) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }

    const paramParsed = paramsSchema.safeParse(await params)
    if (!paramParsed.success) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }
    const id = Number(paramParsed.data.id)

    const parsed = bodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }
    const { resolutionAction, resolutionNotes } = parsed.data

    const result = await db.transaction(async (tx) => {
      const [header] = await tx
        .select()
        .from(damagedGoods)
        .where(eq(damagedGoods.id, id))
        .for('update')
        .limit(1)

      if (!header) throw new Error('NOT_FOUND')
      if (header.status !== 'PENDING') throw new Error('NOT_PENDING')

      const items = await tx.select().from(damagedGoodsItems).where(eq(damagedGoodsItems.damagedGoodsId, id))

      // Baru di sini stok BENAR-BENAR dipotong — dengan nilai FIFO nyata (batch bisa saja
      // berubah sejak laporan dibuat), bukan estimasi yang tersimpan di kolom costPrice/lossValue.
      // allowNegative=false: kalau stok sudah tidak cukup, approval ditolak (409) — sejalan
      // dengan perilaku lama, barang rusak tidak pernah boleh membuat stok minus.
      let totalLossValue = 0
      for (const item of items) {
        const deduction = await StockService.deductStock(
          tx,
          header.branchId,
          item.productId,
          item.uomId,
          item.qty,
          false,
        )
        const lossValue = Math.round(deduction.totalCogs)
        totalLossValue += lossValue

        await tx
          .update(damagedGoodsItems)
          .set({
            costPrice: item.qty > 0 ? Math.round(lossValue / item.qty) : 0,
            lossValue,
          })
          .where(eq(damagedGoodsItems.id, item.id))
      }

      const [updated] = await tx
        .update(damagedGoods)
        .set({
          status: 'APPROVED',
          resolvedById: payload.userId,
          resolvedAt: new Date(),
          resolutionAction,
          resolutionNotes: resolutionNotes ?? null,
          totalLossValue,
        })
        .where(and(eq(damagedGoods.id, id), eq(damagedGoods.status, 'PENDING')))
        .returning()

      await tx.insert(auditLogs).values({
        branchId: header.branchId,
        userId: payload.userId,
        action: 'DAMAGED_GOODS_APPROVE',
        tableName: 'damaged_goods',
        recordId: String(id),
        newData: JSON.stringify({ resolutionAction, resolutionNotes, totalLossValue }),
      })

      return updated
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error: unknown) {
    if (error instanceof InsufficientStockError) {
      return NextResponse.json(
        { error: `Stok tidak lagi cukup untuk salah satu item (produk #${error.productId}). Cek ulang laporan ini sebelum approve.` },
        { status: 409 }
      )
    }
    if (error instanceof Error) {
      switch (error.message) {
        case 'NOT_FOUND':
          return NextResponse.json({ error: 'Laporan barang rusak tidak ditemukan' }, { status: 404 })
        case 'NOT_PENDING':
          return NextResponse.json({ error: 'Laporan ini sudah diproses sebelumnya' }, { status: 409 })
      }
    }
    console.error('PATCH /api/bo/damaged-goods/[id]/approve error:', error)
    return NextResponse.json({ error: 'Gagal approve laporan barang rusak' }, { status: 500 })
  }
}
