import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { db, auditLogs } from '@/lib/db'
import { rejectCostReview } from '@/lib/services/cost-sync-service'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  reason: z.string().trim().min(1, 'Alasan penolakan wajib diisi').max(500),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requirePermission('master.price.manage')
    if (gate instanceof NextResponse) return gate
    const payload = gate

    if (req.headers.get('content-type')?.includes('application/json') !== true) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }

    const { id } = await params
    if (!/^\d+$/.test(id)) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }

    await db.transaction(async (tx) => {
      await rejectCostReview(tx, { id: Number(id), userId: payload.userId, reason: parsed.data.reason })
      await tx.insert(auditLogs).values({
        branchId: payload.branchId,
        userId: payload.userId,
        action: 'COST_REVIEW_REJECT',
        tableName: 'product_cost_syncs',
        recordId: id,
        newData: JSON.stringify({ reason: parsed.data.reason }),
      })
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (error instanceof Error) {
      switch (error.message) {
        case 'NOT_FOUND':
          return NextResponse.json({ error: 'Usulan modal tidak ditemukan' }, { status: 404 })
        case 'NOT_PENDING':
          return NextResponse.json({ error: 'Usulan ini sudah diproses sebelumnya' }, { status: 409 })
      }
    }
    console.error('PATCH /api/bo/cost-reviews/[id]/reject error:', error)
    return NextResponse.json({ error: 'Gagal menolak usulan modal' }, { status: 500 })
  }
}
