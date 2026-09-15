import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { auditLogs, db, damagedGoods, eq, and } from '@/lib/db'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID tidak valid'),
})

const bodySchema = z.object({
  rejectionReason: z.string().trim().min(1, 'Alasan penolakan wajib diisi').max(500),
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
    const { rejectionReason } = parsed.data

    const result = await db.transaction(async (tx) => {
      const [header] = await tx
        .select()
        .from(damagedGoods)
        .where(eq(damagedGoods.id, id))
        .for('update')
        .limit(1)

      if (!header) throw new Error('NOT_FOUND')
      if (header.status !== 'PENDING') throw new Error('NOT_PENDING')

      // Stok tidak pernah disentuh selama PENDING, jadi menolak tidak perlu mengembalikan apa pun.
      const [updated] = await tx
        .update(damagedGoods)
        .set({
          status: 'REJECTED',
          resolvedById: payload.userId,
          resolvedAt: new Date(),
          rejectionReason,
        })
        .where(and(eq(damagedGoods.id, id), eq(damagedGoods.status, 'PENDING')))
        .returning()

      await tx.insert(auditLogs).values({
        branchId: header.branchId,
        userId: payload.userId,
        action: 'DAMAGED_GOODS_REJECT',
        tableName: 'damaged_goods',
        recordId: String(id),
        newData: JSON.stringify({ rejectionReason }),
      })

      return updated
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error: unknown) {
    if (error instanceof Error) {
      switch (error.message) {
        case 'NOT_FOUND':
          return NextResponse.json({ error: 'Laporan barang rusak tidak ditemukan' }, { status: 404 })
        case 'NOT_PENDING':
          return NextResponse.json({ error: 'Laporan ini sudah diproses sebelumnya' }, { status: 409 })
      }
    }
    console.error('PATCH /api/bo/damaged-goods/[id]/reject error:', error)
    return NextResponse.json({ error: 'Gagal menolak laporan barang rusak' }, { status: 500 })
  }
}
