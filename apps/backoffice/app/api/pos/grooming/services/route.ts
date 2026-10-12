import { NextResponse } from 'next/server'
import { db, products, productPrices, unitsOfMeasure, eq, and, inArray, asc } from '@/lib/db'
import { groomingOrderErrorResponse, requireGroomingPos } from '@/lib/grooming-order-http'

export const dynamic = 'force-dynamic'

export interface GroomingServiceOption {
  productId: number
  name: string
  uomId: number
  uomCode: string
  /** Harga per golongan pelanggan (tierType → harga) pada satuan dasar, cabang POS ini. */
  tierPrices: Record<string, string>
}

// Pilihan untuk tab Grooming: jasa grooming aktif yang punya harga di cabang ini, dan produk
// ongkos kirim (untuk delivery). Jasa tanpa harga tidak ditampilkan — tidak bisa dijual.
export async function GET() {
  try {
    const gate = await requireGroomingPos()
    if (gate instanceof NextResponse) return gate

    const rows = await db
      .select({
        productId: products.id,
        name: products.name,
        productKind: products.productKind,
        uomId: products.baseUomId,
        uomCode: unitsOfMeasure.code,
        tierType: productPrices.tierType,
        price: productPrices.price,
      })
      .from(products)
      .innerJoin(unitsOfMeasure, eq(unitsOfMeasure.id, products.baseUomId))
      .innerJoin(productPrices, and(
        eq(productPrices.productId, products.id),
        eq(productPrices.branchId, gate.branchId),
        eq(productPrices.uomId, products.baseUomId),
      ))
      .where(and(eq(products.isActive, true), inArray(products.productKind, ['JASA_GROOMING', 'JASA_ONGKIR'])))
      .orderBy(asc(products.name))

    const byProduct = new Map<number, GroomingServiceOption & { productKind: string }>()
    for (const r of rows) {
      const entry = byProduct.get(r.productId) ?? {
        productId: r.productId, name: r.name, uomId: r.uomId, uomCode: r.uomCode, tierPrices: {}, productKind: r.productKind,
      }
      entry.tierPrices[r.tierType] = String(r.price)
      byProduct.set(r.productId, entry)
    }
    const all = [...byProduct.values()]
    const strip = (p: GroomingServiceOption & { productKind: string }): GroomingServiceOption => ({
      productId: p.productId, name: p.name, uomId: p.uomId, uomCode: p.uomCode, tierPrices: p.tierPrices,
    })
    return NextResponse.json({
      services: all.filter((p) => p.productKind === 'JASA_GROOMING').map(strip),
      // Satu produk ongkir saja yang dipakai delivery; bila ada lebih dari satu, yang pertama menurut nama.
      ongkir: all.filter((p) => p.productKind === 'JASA_ONGKIR').map(strip)[0] ?? null,
    })
  } catch (error) {
    return groomingOrderErrorResponse(error, 'GET /api/pos/grooming/services')
  }
}
