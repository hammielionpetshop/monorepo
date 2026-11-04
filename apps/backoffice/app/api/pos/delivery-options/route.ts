import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/authz'
import { getPosBranchId } from '@/lib/pos-branch'
import { db, products, productPrices, unitsOfMeasure, eq, and, asc } from '@/lib/db'
import { ONGKIR_KIND } from '@/lib/ongkir'
import { getFreeShippingValue } from '@/lib/ongkir-server'
import { getDeliverySettings } from '@/lib/delivery-method-server'
import { listGroomers } from '@/lib/services/grooming-master-service'

export const dynamic = 'force-dynamic'

export interface PosOngkirProduct {
  productId: number
  name: string
  uomId: number
  uomCode: string
  /** Harga per golongan pelanggan pada satuan dasar, cabang POS ini (biasanya Rp 1.000 per qty). */
  tierPrices: Record<string, string>
}

export interface PosDeliveryOptions {
  /** Saklar Pengaturan Cabang: false = pilihan Truk Gudang disembunyikan. */
  truckEnabled: boolean
  /** Tombol "Dikirim truk Gudang" paling depan di cabang ini. */
  truckFirst: boolean
  ongkir: PosOngkirProduct | null
  freeShippingValue: number
  couriers: { id: number; name: string }[]
}

// Bahan langkah Pengiriman di tab Kasir: produk ongkos kirim + harganya di cabang ini, nilai gratis
// ongkir, daftar pengantar aktif, dan saklar truk. Dibaca sekali tiap langkah dibuka.
export async function GET() {
  try {
    const payload = await getAuth()
    if (!payload) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    const branchId = getPosBranchId(payload, await cookies())

    const [settings, freeShippingValue, couriers, rows] = await Promise.all([
      getDeliverySettings(),
      getFreeShippingValue(),
      listGroomers({ activeOnly: true, role: 'courier' }),
      db
        .select({
          productId: products.id,
          name: products.name,
          uomId: products.baseUomId,
          uomCode: unitsOfMeasure.code,
          tierType: productPrices.tierType,
          price: productPrices.price,
        })
        .from(products)
        .innerJoin(unitsOfMeasure, eq(unitsOfMeasure.id, products.baseUomId))
        .innerJoin(productPrices, and(
          eq(productPrices.productId, products.id),
          eq(productPrices.branchId, branchId),
          eq(productPrices.uomId, products.baseUomId),
        ))
        .where(and(eq(products.isActive, true), eq(products.productKind, ONGKIR_KIND)))
        .orderBy(asc(products.name)),
    ])

    // Satu produk ongkir saja (sama dengan tab Grooming): bila lebih dari satu, yang pertama menurut nama.
    let ongkir: PosOngkirProduct | null = null
    for (const r of rows) {
      if (ongkir && ongkir.productId !== r.productId) break
      ongkir ??= { productId: r.productId, name: r.name, uomId: r.uomId, uomCode: r.uomCode, tierPrices: {} }
      ongkir.tierPrices[r.tierType] = String(r.price)
    }

    const body: PosDeliveryOptions = {
      truckEnabled: settings.required,
      truckFirst: settings.truckFirstBranchIds.includes(branchId),
      ongkir,
      freeShippingValue,
      couriers: couriers.map((c) => ({ id: c.id, name: c.name })),
    }
    return NextResponse.json(body)
  } catch (error) {
    console.error('GET /api/pos/delivery-options error:', error)
    return NextResponse.json({ error: 'Gagal memuat pilihan pengiriman' }, { status: 500 })
  }
}
