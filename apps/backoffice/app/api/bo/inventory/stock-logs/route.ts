import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { verifyAccessToken } from '@/lib/auth'
import { sql } from '@/lib/db'
import {
  STOCK_LEDGER_MOVEMENT_TYPES,
  fetchStockLedger,
} from '@/lib/services/stock-ledger'

export const dynamic = 'force-dynamic'

export type { StockLogEntry } from '@/lib/services/stock-ledger'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// OWNER & GM melihat semua cabang; peran lain dikunci ke cabangnya sendiri.
const GLOBAL_ROLES = ['OWNER', 'GM']

const querySchema = z.object({
  startDate: z.string().regex(ISO_DATE_RE).refine(v => !isNaN(new Date(v).getTime())).optional(),
  endDate: z.string().regex(ISO_DATE_RE).refine(v => !isNaN(new Date(v).getTime())).optional(),
  branchId: z.coerce.number().int().positive().optional(),
  movementType: z.enum(STOCK_LEDGER_MOVEMENT_TYPES).optional(),
  q: z.string().max(100).optional(),
}).refine(data => {
  if (!data.startDate || !data.endDate) return true
  return data.startDate <= data.endDate
}, { message: 'startDate tidak boleh lebih besar dari endDate' })

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const parsed = querySchema.safeParse({
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
      branchId: searchParams.get('branchId') ?? undefined,
      movementType: searchParams.get('movementType') ?? undefined,
      q: searchParams.get('q') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Parameter tidak valid' },
        { status: 400 }
      )
    }

    const { startDate, endDate, movementType, q } = parsed.data
    const isGlobal = GLOBAL_ROLES.includes(payload.role)
    const branchId = isGlobal ? parsed.data.branchId : payload.branchId

    // Build dynamic WHERE conditions
    const filters: ReturnType<typeof sql>[] = []
    if (!isGlobal) {
      filters.push(sql`sm.branch_id = ${payload.branchId}`)
    } else if (branchId) {
      filters.push(sql`sm.branch_id = ${branchId}`)
    }
    if (movementType) filters.push(sql`sm.movement_type = ${movementType}`)
    if (startDate) filters.push(sql`sm.created_at >= ${startDate + 'T00:00:00.000+07:00'}`)
    if (endDate) filters.push(sql`sm.created_at <= ${endDate + 'T23:59:59.999+07:00'}`)
    if (q) {
      const qLike = `%${q}%`
      filters.push(sql`(p.name ILIKE ${qLike} OR p.sku ILIKE ${qLike})`)
    }

    const data = await fetchStockLedger(filters)

    return NextResponse.json({ data, total: data.length })
  } catch (error) {
    console.error('[stock-logs] GET error:', error)
    return NextResponse.json({ error: 'Gagal mengambil data mutasi stok' }, { status: 500 })
  }
}
