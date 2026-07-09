import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { db, stockOpnames, eq, and } from '@/lib/db'

export const dynamic = 'force-dynamic'

const createSOSchema = z.object({
  branchId: z.number().int().positive('Cabang wajib dipilih'),
  categoryScope: z.array(z.number().int().positive()).optional().nullable(),
  assignedUserIds: z.array(z.number().int().positive()).optional().nullable(),
  notes: z.string().trim().max(500, 'Catatan maksimal 500 karakter').optional().nullable(),
})

function generateSONumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
  return `SO-FULL-${dateStr}-${random}`
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requirePermission('stock_opname.create')
    if (gate instanceof NextResponse) return gate
    const payload = gate

    const userId = Number(payload.userId)
    if (Number.isNaN(userId)) {
      return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
    }

    const parsed = createSOSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Data tidak valid'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { branchId, categoryScope, assignedUserIds, notes } = parsed.data

    if (payload.branchScope !== 'ALL' && branchId !== payload.branchId) {
      return NextResponse.json(
        { error: 'Anda hanya dapat membuat stock opname untuk cabang sendiri' },
        { status: 403 }
      )
    }

    const rows = await db.transaction(async (trx) => {
      const existingPending = await trx
        .select({ id: stockOpnames.id })
        .from(stockOpnames)
        .where(and(eq(stockOpnames.branchId, branchId), eq(stockOpnames.status, 'PENDING')))
        .limit(1)

      if (existingPending.length > 0) {
        throw new Error('PENDING_EXISTS')
      }

      return trx.insert(stockOpnames).values({
        soNumber: generateSONumber(),
        branchId,
        type: 'FULL',
        status: 'PENDING',
        createdById: userId,
        categoryScope: categoryScope ?? null,
        assignedUserIds: assignedUserIds ?? null,
        notes: notes ?? null,
      }).returning({ id: stockOpnames.id, soNumber: stockOpnames.soNumber })
    })

    const header = rows[0]
    if (!header) {
      return NextResponse.json({ error: 'Gagal membuat stock opname, silakan coba lagi' }, { status: 500 })
    }

    return NextResponse.json({ success: true, so: header }, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'PENDING_EXISTS') {
      return NextResponse.json(
        { error: 'Sudah ada Stock Opname aktif untuk cabang ini, selesaikan terlebih dahulu' },
        { status: 409 }
      )
    }
    console.error('POST /api/bo/stock-opnames error:', error)
    return NextResponse.json({ error: 'Gagal membuat stock opname, silakan coba lagi' }, { status: 500 })
  }
}
