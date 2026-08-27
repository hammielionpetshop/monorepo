import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { and, auditLogs, db, eq, isNull, soVarianceResolutions } from '@/lib/db'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({
  resolutionId: z.string().regex(/^\d+$/, 'ID tidak valid'),
})

const bodySchema = z.object({
  reason: z.string().trim().max(255).optional().nullable(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ resolutionId: string }> }
) {
  try {
    const gate = await requirePermission('stock_opname.resolve')
    if (gate instanceof NextResponse) return gate
    const payload = gate

    const currentUserId = Number(payload.userId)
    if (Number.isNaN(currentUserId)) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    if (req.headers.get('content-type')?.includes('application/json') !== true) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }

    const { resolutionId } = await params
    const paramParsed = paramsSchema.safeParse({ resolutionId })
    if (!paramParsed.success) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }
    const resolutionIdNum = Number(paramParsed.data.resolutionId)

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }
    const reason = parsed.data.reason?.trim() ? parsed.data.reason.trim() : null

    const result = await db.transaction(async (tx) => {
      const rows = await tx
        .select({
          id: soVarianceResolutions.id,
          branchId: soVarianceResolutions.branchId,
          disposition: soVarianceResolutions.disposition,
          stockAdjustmentId: soVarianceResolutions.stockAdjustmentId,
        })
        .from(soVarianceResolutions)
        .where(and(eq(soVarianceResolutions.id, resolutionIdNum), isNull(soVarianceResolutions.voidedAt)))
        .for('update')
        .limit(1)

      const resolution = rows[0]
      if (!resolution) throw new Error('RESOLUTION_NOT_FOUND')

      if (payload.branchScope !== 'ALL' && payload.branchId !== resolution.branchId) {
        throw new Error('BRANCH_FORBIDDEN')
      }

      const now = new Date()
      await tx
        .update(soVarianceResolutions)
        .set({ voidedAt: now, voidedBy: currentUserId, voidReason: reason })
        .where(eq(soVarianceResolutions.id, resolutionIdNum))

      await tx.insert(auditLogs).values({
        branchId: resolution.branchId,
        userId: currentUserId,
        action: 'SO_VARIANCE_RESOLUTION_VOID',
        tableName: 'so_variance_resolutions',
        recordId: String(resolution.id),
        oldData: JSON.stringify({ voidedAt: null }),
        newData: JSON.stringify({ voidedAt: now, voidReason: reason }),
      })

      return { id: resolution.id, hadStockAdjustment: resolution.stockAdjustmentId != null }
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'RESOLUTION_NOT_FOUND') {
        return NextResponse.json({ error: 'Resolusi tidak ditemukan atau sudah di-void' }, { status: 404 })
      }
      if (error.message === 'BRANCH_FORBIDDEN') {
        return NextResponse.json(
          { error: 'Akses ditolak. Anda hanya dapat mem-void resolusi cabang Anda sendiri.' },
          { status: 403 }
        )
      }
    }
    console.error('POST /api/bo/stock-opnames/resolutions/[resolutionId]/void error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat mem-void resolusi' }, { status: 500 })
  }
}
