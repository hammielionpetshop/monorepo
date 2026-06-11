import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { verifyAccessToken } from '@/lib/auth'
import { db, branches, eq } from '@/lib/db'

export const dynamic = 'force-dynamic'

const ALLOWED_MUTATE_ROLES = ['OWNER', 'GM']

const schema = z.object({
  sourceBranchId: z.number().int().positive('sourceBranchId wajib diisi'),
  targetBranchId: z.number().int().positive('targetBranchId wajib diisi'),
  markupPercent:  z.number().min(-99, 'Markup minimal -99%').max(999, 'Markup maksimal 999%').default(0),
}).refine(d => d.sourceBranchId !== d.targetBranchId, {
  message: 'Cabang sumber dan tujuan tidak boleh sama',
})

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    if (!ALLOWED_MUTATE_ROLES.includes(payload.role)) {
      return NextResponse.json({ error: 'Akses ditolak. Hanya Owner dan GM yang dapat menyalin harga.' }, { status: 403 })
    }

    const contentType = req.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }

    let body: unknown
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
    }

    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }

    const { sourceBranchId, targetBranchId, markupPercent } = parsed.data

    const [source, target] = await Promise.all([
      db.select({ id: branches.id }).from(branches).where(eq(branches.id, sourceBranchId)).limit(1),
      db.select({ id: branches.id }).from(branches).where(eq(branches.id, targetBranchId)).limit(1),
    ])
    if (source.length === 0) return NextResponse.json({ error: 'Cabang sumber tidak ditemukan' }, { status: 404 })
    if (target.length === 0) return NextResponse.json({ error: 'Cabang tujuan tidak ditemukan' }, { status: 404 })

    // Hitung jumlah harga yang akan disalin (untuk preview count)
    const countPreview = req.nextUrl.searchParams.get('preview') === '1'
    if (countPreview) {
      const result = await db.execute(sql`
        SELECT COUNT(*) AS total
        FROM petshop.product_prices
        WHERE branch_id = ${sourceBranchId}
      `)
      return NextResponse.json({ total: Number((result[0] as { total: string }).total) })
    }

    // Salin harga dengan markup: ROUND(price * (1 + markup / 100))
    const multiplier = 1 + markupPercent / 100
    const result = await db.execute(sql`
      INSERT INTO petshop.product_prices (product_id, branch_id, uom_id, tier_type, price)
      SELECT
        product_id,
        ${targetBranchId},
        uom_id,
        tier_type,
        GREATEST(0, ROUND(price * ${multiplier}))::integer
      FROM petshop.product_prices
      WHERE branch_id = ${sourceBranchId}
      ON CONFLICT ON CONSTRAINT product_prices_unique_tier
      DO UPDATE SET price = EXCLUDED.price
    `)

    return NextResponse.json({ copied: (result as unknown as { rowCount: number }).rowCount ?? 0 })
  } catch (error) {
    console.error('POST /api/bo/master-data/prices/copy-branch error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menyalin harga' }, { status: 500 })
  }
}
