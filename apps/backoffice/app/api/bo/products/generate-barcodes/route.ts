import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { verifyAccessToken } from '@/lib/auth'
import { db, products, eq, inArray } from '@/lib/db'
import { generateInternalEan13 } from '@/lib/barcode/ean13'

export const dynamic = 'force-dynamic'

const ALLOWED_MUTATE_ROLES = ['OWNER', 'GM']

const schema = z.object({
  productIds: z.array(z.number().int().positive()).min(1, 'Pilih minimal satu produk'),
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
      return NextResponse.json({ error: 'Anda tidak memiliki akses untuk membuat barcode' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }

    const ids = Array.from(new Set(parsed.data.productIds))

    const result = await db.transaction(async (trx) => {
      const rows = await trx
        .select({ id: products.id, barcode: products.barcode })
        .from(products)
        .where(inArray(products.id, ids))

      const generated: { id: number; barcode: string }[] = []
      for (const row of rows) {
        // Lewati produk yang sudah punya barcode agar idempoten
        if (row.barcode) {
          generated.push({ id: row.id, barcode: row.barcode })
          continue
        }
        const barcode = generateInternalEan13(row.id)
        await trx.update(products).set({ barcode, updatedAt: new Date() }).where(eq(products.id, row.id))
        generated.push({ id: row.id, barcode })
      }
      return generated
    })

    return NextResponse.json({ generated: result })
  } catch (error: unknown) {
    console.error('POST /api/bo/products/generate-barcodes error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat membuat barcode' }, { status: 500 })
  }
}
