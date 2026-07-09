import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { db, products, eq, inArray } from '@/lib/db'
import { generateInternalEan13 } from '@/lib/barcode/ean13'

export const dynamic = 'force-dynamic'

const schema = z.object({
  productIds: z.array(z.number().int().positive()).min(1, 'Pilih minimal satu produk'),
})

export async function POST(req: NextRequest) {
  try {
    const gate = await requirePermission('master.product.manage')
    if (gate instanceof NextResponse) return gate

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
