import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { applyMarginPrices, getMarginAlerts } from '@/lib/services/cost-sync-service'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  branchId: z.string().regex(/^\d+$/).optional(),
  q: z.string().max(100).optional(),
  tierType: z.enum(['RETAIL', 'GROSIR', 'MEMBER', 'DISTRIBUTOR', 'RESELLER', 'PROMO']).optional(),
  status: z.enum(['LOSS', 'THIN']).optional(),
})

export async function GET(req: Request) {
  const gate = await requirePermission('master.price.manage')
  if (gate instanceof NextResponse) return gate

  const { searchParams } = new URL(req.url)
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Parameter tidak valid' }, { status: 400 })
  }

  try {
    const data = await getMarginAlerts({
      branchId: parsed.data.branchId ? Number(parsed.data.branchId) : null,
      q: parsed.data.q ?? null,
      tierType: parsed.data.tierType ?? null,
      status: parsed.data.status ?? null,
    })
    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('GET /api/bo/cost-reviews/margins error:', error)
    return NextResponse.json({ error: 'Gagal mengambil daftar margin' }, { status: 500 })
  }
}

const tierSchema = z.enum(['RETAIL', 'GROSIR', 'MEMBER', 'DISTRIBUTOR', 'RESELLER', 'PROMO'])

const saveSchema = z.object({
  items: z
    .array(
      z.object({
        branchId: z.number().int().positive(),
        productId: z.number().int().positive(),
        uomId: z.number().int().positive(),
        tierType: tierSchema,
        price: z.number().int().positive('Harga jual harus lebih dari 0'),
      }),
    )
    .min(1, 'Tidak ada harga yang disimpan')
    .max(500, 'Maksimal 500 harga sekali simpan'),
})

// Simpan harga jual baru langsung dari tab Margin (tanpa pindah ke Manajemen Harga).
export async function POST(req: Request) {
  const gate = await requirePermission('master.price.manage')
  if (gate instanceof NextResponse) return gate

  const body = await req.json().catch(() => null)
  const parsed = saveSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
  }

  try {
    return NextResponse.json(await applyMarginPrices(parsed.data.items, gate.userId))
  } catch (error: unknown) {
    console.error('POST /api/bo/cost-reviews/margins error:', error)
    return NextResponse.json({ error: 'Gagal menyimpan harga jual' }, { status: 500 })
  }
}
