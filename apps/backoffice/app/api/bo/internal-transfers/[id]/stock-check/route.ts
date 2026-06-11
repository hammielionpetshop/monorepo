import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'
import {
  db,
  interBranchTransfers,
  interBranchTransferItems,
  productStocks,
  products,
  productUomConversions,
  eq,
  and,
  inArray,
} from '@/lib/db'

export const dynamic = 'force-dynamic'

const STOCK_ROLES = ['OWNER', 'GM', 'MANAGER', 'GUDANG']

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    if (!STOCK_ROLES.includes(payload.role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    const { id } = await params
    const transferId = parseInt(id)
    if (isNaN(transferId)) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }

    const [transfer] = await db
      .select({ id: interBranchTransfers.id, sourceBranchId: interBranchTransfers.sourceBranchId })
      .from(interBranchTransfers)
      .where(eq(interBranchTransfers.id, transferId))
      .limit(1)

    if (!transfer) {
      return NextResponse.json({ error: 'Transfer tidak ditemukan' }, { status: 404 })
    }

    const isGlobal = ['OWNER', 'GM'].includes(payload.role)
    if (!isGlobal && payload.branchId !== transfer.sourceBranchId) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    const items = await db
      .select({
        id: interBranchTransferItems.id,
        productId: interBranchTransferItems.productId,
        uomId: interBranchTransferItems.uomId,
      })
      .from(interBranchTransferItems)
      .where(eq(interBranchTransferItems.transferId, transferId))

    if (items.length === 0) return NextResponse.json([])

    // Batch semua query — 3 query flat untuk semua item, bukan 3×N
    const productIds = [...new Set(items.map((i) => i.productId))]

    const [productRows, convRows, stockRows] = await Promise.all([
      db
        .select({ id: products.id, baseUomId: products.baseUomId })
        .from(products)
        .where(inArray(products.id, productIds)),
      db
        .select({ productId: productUomConversions.productId, uomId: productUomConversions.uomId, ratio: productUomConversions.ratio })
        .from(productUomConversions)
        .where(inArray(productUomConversions.productId, productIds)),
      db
        .select({ productId: productStocks.productId, uomId: productStocks.uomId, qty: productStocks.qty })
        .from(productStocks)
        .where(
          and(
            inArray(productStocks.productId, productIds),
            eq(productStocks.branchId, transfer.sourceBranchId)
          )
        ),
    ])

    // Index hasil query per productId
    const productMap = new Map(productRows.map((p) => [p.id, p]))
    const convsByProduct = new Map<number, { uomId: number; ratio: number }[]>()
    for (const c of convRows) {
      const list = convsByProduct.get(c.productId) ?? []
      list.push(c)
      convsByProduct.set(c.productId, list)
    }
    const stocksByProduct = new Map<number, { uomId: number; qty: number }[]>()
    for (const s of stockRows) {
      const list = stocksByProduct.get(s.productId) ?? []
      list.push(s)
      stocksByProduct.set(s.productId, list)
    }

    const result = items.map((item) => {
      const prod = productMap.get(item.productId)

      // Bangun ratio map per produk: uomId → rasio terhadap base UOM
      const ratioMap = new Map<number, number>()
      if (prod?.baseUomId !== undefined) ratioMap.set(prod.baseUomId, 1)
      for (const c of convsByProduct.get(item.productId) ?? []) {
        ratioMap.set(c.uomId, c.ratio)
      }

      const transferRatio = ratioMap.get(item.uomId)
      if (transferRatio === undefined) {
        throw Object.assign(
          new Error('UOM_TIDAK_TERDEFINISI'),
          { productId: item.productId, uomId: item.uomId }
        )
      }

      const allStocks = stocksByProduct.get(item.productId) ?? []

      // Kumpulkan total base unit dulu, baru floor sekali — konsisten dengan validasi ship
      let totalBaseQty = 0
      for (const stock of allStocks) {
        const stockRatio = ratioMap.get(stock.uomId)
        if (stockRatio === undefined) {
          throw Object.assign(
            new Error('UOM_STOK_TIDAK_TERDEFINISI'),
            { productId: item.productId, uomId: stock.uomId }
          )
        }
        totalBaseQty += stock.qty * stockRatio
      }

      return {
        itemId: item.id,
        currentQty: Math.floor(totalBaseQty / transferRatio),
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UOM_TIDAK_TERDEFINISI') {
        return NextResponse.json(
          { error: 'Satuan ukur transfer belum terdefinisi dalam konversi satuan produk ini. Pastikan konversi UOM sudah diatur di master data produk.' },
          { status: 409 }
        )
      }
      if (error.message === 'UOM_STOK_TIDAK_TERDEFINISI') {
        return NextResponse.json(
          { error: 'Stok produk ini tersimpan dalam satuan ukur yang tidak terdefinisi di konversi satuan. Hubungi administrator untuk memperbaiki data stok.' },
          { status: 409 }
        )
      }
    }
    console.error('GET stock-check error:', error)
    return NextResponse.json({ error: 'Gagal mengambil data stok' }, { status: 500 })
  }
}
