import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { auditLogs, db, eq, isNull, and, stockShortfalls } from '@/lib/db'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID tidak valid'),
})

const bodySchema = z.object({
  reason: z.string().trim().min(1, 'Alasan wajib diisi').max(255),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requirePermission('inventory.stock_shortfall.manage')
    if (gate instanceof NextResponse) return gate
    const payload = gate

    const currentUserId = Number(payload.userId)
    if (Number.isNaN(currentUserId)) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    if (req.headers.get('content-type')?.includes('application/json') !== true) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }

    const paramParsed = paramsSchema.safeParse(await params)
    if (!paramParsed.success) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }
    const shortfallId = Number(paramParsed.data.id)

    const parsed = bodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }
    const { reason } = parsed.data

    const result = await db.transaction(async (tx) => {
      const rows = await tx
        .select({
          id: stockShortfalls.id,
          branchId: stockShortfalls.branchId,
          productId: stockShortfalls.productId,
          qtyRemaining: stockShortfalls.qtyRemaining,
          closedAt: stockShortfalls.closedAt,
          writtenOffAt: stockShortfalls.writtenOffAt,
        })
        .from(stockShortfalls)
        .where(eq(stockShortfalls.id, shortfallId))
        .for('update')
        .limit(1)

      const shortfall = rows[0]
      if (!shortfall) throw new Error('SHORTFALL_NOT_FOUND')

      if (payload.branchScope !== 'ALL' && payload.branchId !== shortfall.branchId) {
        throw new Error('BRANCH_FORBIDDEN')
      }

      if (shortfall.closedAt != null || shortfall.writtenOffAt != null) {
        throw new Error('ALREADY_CLOSED')
      }

      // Sengaja TIDAK menyentuh qtyRemaining/batch/agregat — utangnya sudah tercermin di
      // product_stocks.qty (minus) sejak shortfall ini dibuat. Tulis-off cuma berarti
      // "berhenti mengharapkan pelunasan & berhenti tampil di laporan", bukan pergerakan
      // stok baru (lihat komentar invarian di StockService.deductStock/addStock).
      await tx
        .update(stockShortfalls)
        .set({ writtenOffAt: new Date(), writtenOffById: currentUserId, writeOffReason: reason })
        .where(and(eq(stockShortfalls.id, shortfallId), isNull(stockShortfalls.closedAt), isNull(stockShortfalls.writtenOffAt)))

      await tx.insert(auditLogs).values({
        branchId: shortfall.branchId,
        userId: currentUserId,
        action: 'STOCK_SHORTFALL_WRITE_OFF',
        tableName: 'stock_shortfalls',
        recordId: String(shortfallId),
        newData: JSON.stringify({ reason, qtyRemaining: shortfall.qtyRemaining }),
      })

      return { id: shortfallId }
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    if (error instanceof Error) {
      switch (error.message) {
        case 'SHORTFALL_NOT_FOUND':
          return NextResponse.json({ error: 'Shortfall tidak ditemukan' }, { status: 404 })
        case 'BRANCH_FORBIDDEN':
          return NextResponse.json(
            { error: 'Akses ditolak. Anda hanya dapat mengelola shortfall cabang Anda sendiri.' },
            { status: 403 }
          )
        case 'ALREADY_CLOSED':
          return NextResponse.json({ error: 'Shortfall ini sudah lunas atau sudah ditulis-off' }, { status: 409 })
      }
    }
    console.error('PATCH /api/bo/inventory/stock-shortfalls/[id]/write-off error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menutup shortfall' }, { status: 500 })
  }
}
