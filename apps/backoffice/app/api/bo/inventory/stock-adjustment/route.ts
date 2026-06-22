import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { verifyAccessToken } from '@/lib/auth'
import Big from 'big.js'
import { db, products, productStocks, productUomConversions, eq, and } from '@/lib/db'
import { applyManualStockAdjustment } from '@/lib/stock-adjustment'
import { getProductsWithStock } from '@/lib/services/stock-service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid' }, { status: 401 })
    }

    const branchIdParam = new URL(req.url).searchParams.get('branchId')
    const branchId = branchIdParam ? parseInt(branchIdParam) : payload.branchId

    if (payload.role !== 'OWNER' && branchId !== payload.branchId) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    const data = await getProductsWithStock(branchId)
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'Gagal mengambil data produk' }, { status: 500 })
  }
}

const adjustmentSchema = z.object({
  productId: z.number().int().positive(),
  adjustmentType: z.enum(['add', 'subtract']),
  qty: z.string().regex(/^\d+(\.\d+)?$/, 'Jumlah tidak valid').or(z.number().min(0)),
  reason: z.string().min(1, 'Alasan penyesuaian wajib diisi'),
  branchId: z.number().int().positive().optional(),
  uomId: z.number().int().positive().optional(),
  costPricePerUnit: z.number().int().min(0).optional(),
}).refine((data) => {
  const val = typeof data.qty === 'string' ? parseFloat(data.qty) : data.qty
  return val > 0
}, {
  message: 'Jumlah penyesuaian harus lebih dari 0',
  path: ['qty'],
})

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = adjustmentSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Data tidak valid'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { productId, reason, costPricePerUnit, adjustmentType } = parsed.data
    const inputQty = parsed.data.qty.toString()
    const { userId } = payload
    const branchId = (payload.role === 'OWNER' && parsed.data.branchId)
      ? parsed.data.branchId
      : payload.branchId

    // Ambil baseUomId dari produk
    const productRows = await db
      .select({ baseUomId: products.baseUomId })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1)

    if (productRows.length === 0) {
      return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 })
    }

    const { baseUomId } = productRows[0]

    // Resolusi rasio konversi: input qty & HPP dikirim dalam satuan yang dipilih user,
    // konversi ke base UOM sebelum diterapkan ke stok.
    const inputUomId = parsed.data.uomId ?? baseUomId
    let ratio = 1
    if (inputUomId !== baseUomId) {
      const [conv] = await db
        .select({ ratio: productUomConversions.ratio })
        .from(productUomConversions)
        .where(and(
          eq(productUomConversions.productId, productId),
          eq(productUomConversions.uomId, inputUomId),
        ))
        .limit(1)
      if (!conv) {
        return NextResponse.json({ error: 'Satuan tidak valid untuk produk ini' }, { status: 400 })
      }
      ratio = conv.ratio
    }

    // Jumlah penyesuaian dalam base UOM (selalu positif dari input)
    const deltaBase = new Big(inputQty).times(ratio)
    // HPP per unit base UOM = HPP per satuan input / ratio
    const costPricePerUnitBase = costPricePerUnit !== undefined
      ? Math.round(new Big(costPricePerUnit).div(ratio).toNumber())
      : undefined

    // Ambil currentQty
    const stockRows = await db
      .select({ qty: productStocks.qty })
      .from(productStocks)
      .where(
        and(
          eq(productStocks.productId, productId),
          eq(productStocks.branchId, branchId),
          eq(productStocks.uomId, baseUomId)
        )
      )
      .limit(1)

    const previousQty = stockRows.length > 0 ? String(stockRows[0].qty) : '0'
    // newQty absolut = stok saat ini ± jumlah penyesuaian
    const newQtyBig = adjustmentType === 'add'
      ? new Big(previousQty).plus(deltaBase)
      : new Big(previousQty).minus(deltaBase)

    if (newQtyBig.lt(0)) {
      return NextResponse.json(
        { error: `Stok tidak cukup untuk dikurangi. Tersedia: ${previousQty}, Dikurangi: ${deltaBase.toString()}` },
        { status: 400 },
      )
    }
    const newQty = newQtyBig.toString()

    await db.transaction(async (tx) => {
      await applyManualStockAdjustment(tx, {
        productId,
        branchId,
        uomId: baseUomId,
        previousQty,
        newQty,
        reason,
        adjustedById: userId,
        costPricePerUnit: costPricePerUnitBase,
      })
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal menyimpan penyesuaian stok'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
