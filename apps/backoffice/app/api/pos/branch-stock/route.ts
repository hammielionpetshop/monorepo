import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import { verifyAccessToken } from '@/lib/auth'
import {
  db,
  products,
  productStocks,
  productUomConversions,
  unitsOfMeasure,
  eq,
  and,
  inArray,
} from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

const MAX_PRODUCT_IDS = 50

/**
 * Stok tersedia di sebuah cabang untuk sejumlah produk, diringkas ke base UOM.
 *
 * Dipakai form "Buat PO Internal" di kasir: saat kasir memilih produk, ia perlu tahu
 * berapa stok cabang pengirim supaya tidak meminta lebih dari yang ada. Agregasi lintas
 * satuan mengikuti pola `app/api/bo/internal-transfers/[id]/stock-check/route.ts` —
 * jumlahkan `qty × rasio` dalam base UOM.
 */
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const { searchParams } = req.nextUrl
    const branchId = parseInt(searchParams.get('branchId') ?? '', 10)
    if (isNaN(branchId) || branchId <= 0) {
      return NextResponse.json({ error: 'branchId tidak valid' }, { status: 400 })
    }

    const productIds = [
      ...new Set(
        (searchParams.get('productIds') ?? '')
          .split(',')
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n) && n > 0),
      ),
    ]
    if (productIds.length === 0) {
      return NextResponse.json({ error: 'productIds wajib diisi' }, { status: 400 })
    }
    if (productIds.length > MAX_PRODUCT_IDS) {
      return NextResponse.json(
        { error: `Maksimal ${MAX_PRODUCT_IDS} produk per permintaan` },
        { status: 400 },
      )
    }

    const [productRows, convRows, stockRows] = await Promise.all([
      db
        .select({
          id: products.id,
          baseUomId: products.baseUomId,
          baseUomCode: unitsOfMeasure.code,
        })
        .from(products)
        .leftJoin(unitsOfMeasure, eq(products.baseUomId, unitsOfMeasure.id))
        .where(inArray(products.id, productIds)),
      db
        .select({
          productId: productUomConversions.productId,
          uomId: productUomConversions.uomId,
          ratio: productUomConversions.ratio,
        })
        .from(productUomConversions)
        .where(inArray(productUomConversions.productId, productIds)),
      db
        .select({
          productId: productStocks.productId,
          uomId: productStocks.uomId,
          qty: productStocks.qty,
        })
        .from(productStocks)
        .where(
          and(
            inArray(productStocks.productId, productIds),
            eq(productStocks.branchId, branchId),
          ),
        ),
    ])

    const productMap = new Map(productRows.map((p) => [p.id, p]))
    const convByProduct = new Map<number, { uomId: number; ratio: number }[]>()
    for (const c of convRows) {
      const list = convByProduct.get(c.productId) ?? []
      list.push(c)
      convByProduct.set(c.productId, list)
    }
    const stockByProduct = new Map<number, { uomId: number; qty: number }[]>()
    for (const s of stockRows) {
      const list = stockByProduct.get(s.productId) ?? []
      list.push(s)
      stockByProduct.set(s.productId, list)
    }

    // Entri dikembalikan untuk SETIAP produk yang diminta — produk tanpa baris stok = 0,
    // bukan hilang dari hasil, supaya pemanggil tak perlu menebak yang mana yang belum termuat.
    const stocks: Record<string, { baseQty: number | null; baseUomCode: string | null }> = {}
    for (const pid of productIds) {
      const prod = productMap.get(pid)
      const baseUomCode = prod?.baseUomCode ?? null

      const ratioMap = new Map<number, number>()
      if (prod?.baseUomId != null) ratioMap.set(prod.baseUomId, 1)
      for (const c of convByProduct.get(pid) ?? []) ratioMap.set(c.uomId, c.ratio)

      let totalBase = 0
      let uomKnown = true
      for (const s of stockByProduct.get(pid) ?? []) {
        const r = ratioMap.get(s.uomId)
        if (r === undefined) {
          uomKnown = false
          break
        }
        totalBase += s.qty * r
      }

      // null = ada baris stok bersatuan yang tak terdefinisi di konversi -> tak bisa dihitung.
      stocks[pid] = { baseQty: uomKnown ? Math.floor(totalBase) : null, baseUomCode }
    }

    return NextResponse.json({ branchId, stocks })
  } catch (error) {
    console.error('GET /api/pos/branch-stock error:', error)
    return NextResponse.json({ error: 'Gagal mengambil data stok cabang' }, { status: 500 })
  }
}
