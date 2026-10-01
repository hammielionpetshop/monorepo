import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { db } from '@/lib/db'
import { approveCostReview } from '@/lib/services/cost-sync-service'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  note: z.string().trim().max(500).optional(),
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
      await approveCostReview(tx, { id: Number(id), userId: payload.userId, note: parsed.data.note || null })
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (error instanceof Error) {
      switch (error.message) {
        case 'NOT_FOUND':
          return NextResponse.json({ error: 'Usulan modal tidak ditemukan' }, { status: 404 })
        case 'NOT_PENDING':
          return NextResponse.json({ error: 'Usulan ini sudah diproses sebelumnya' }, { status: 409 })
        case 'NO_CONVERSION':
          return NextResponse.json(
            { error: 'Konversi satuan produk ini sudah berubah, usulan tidak bisa diterapkan. Tolak lalu atur modal di Manajemen Harga.' },
            { status: 409 },
          )
      }
    }
    console.error('PATCH /api/bo/cost-reviews/[id]/approve error:', error)
    return NextResponse.json({ error: 'Gagal menyetujui usulan modal' }, { status: 500 })
  }
}
