import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { verifyAccessToken } from '@/lib/auth'
import { db, stockOpnames, eq, and, inArray } from '@/lib/db'

export const dynamic = 'force-dynamic'

const ALLOWED_MUTATE_ROLES = ['OWNER', 'GM', 'MANAGER']

// SO yang belum tuntas — cabang tidak boleh punya dua sekaligus
const ACTIVE_SO_STATUSES = ['DRAFT', 'PENDING']

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
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null

    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    if (!ALLOWED_MUTATE_ROLES.includes(payload.role)) {
      return NextResponse.json({ error: 'Hanya Owner, GM, atau Manager yang dapat membuat Stock Opname' }, { status: 403 })
    }

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

    if (payload.role === 'MANAGER' && branchId !== payload.branchId) {
      return NextResponse.json(
        { error: 'Manager hanya dapat membuat stock opname untuk cabangnya sendiri' },
        { status: 403 }
      )
    }

    const rows = await db.transaction(async (trx) => {
      const existingPending = await trx
        .select({ id: stockOpnames.id })
        .from(stockOpnames)
        .where(and(eq(stockOpnames.branchId, branchId), inArray(stockOpnames.status, ACTIVE_SO_STATUSES)))
        .limit(1)

      if (existingPending.length > 0) {
        throw new Error('PENDING_EXISTS')
      }

      return trx.insert(stockOpnames).values({
        soNumber: generateSONumber(),
        branchId,
        type: 'FULL',
        // Belum ada hitungan — jangan munculkan di daftar persetujuan sampai POS mengisi item
        status: 'DRAFT',
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
