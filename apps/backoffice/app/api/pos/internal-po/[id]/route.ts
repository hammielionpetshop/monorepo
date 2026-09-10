import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { alias } from 'drizzle-orm/pg-core'

import { verifyAccessToken } from '@/lib/auth'
import { hasPermission } from '@/lib/authz'
import {
  db,
  interBranchTransfers,
  interBranchTransferItems,
  branches,
  users,
  products,
  productPrices,
  productStocks,
  productUomConversions,
  unitsOfMeasure,
  customers,
  eq,
  and,
  inArray,
} from '@/lib/db'
import { getPosBranchId } from '@/lib/pos-branch'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

// PO Internal diproses di kasir memakai harga RETAIL cabang pengirim (kasir menyesuaikan
// setelahnya) — sejalan dengan catatan di kartu kanban.
const RETAIL_TIER = 'RETAIL'

/**
 * Detail satu PO Internal (IBT) untuk cabang pengirim: item yang diminta + stok yang ada di
 * cabang ini + harga retail per item + customer internal cabang tujuan (untuk jalur piutang).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }
    if (!hasPermission(payload, 'internal_transfer.process_pos')) {
      return NextResponse.json({ error: 'Akses ditolak untuk memproses PO Internal di kasir' }, { status: 403 })
    }

    const { id } = await params
    const transferId = parseInt(id)
    if (isNaN(transferId)) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }

    const branchId = getPosBranchId(payload, cookieStore)
    const destBranchAlias = alias(branches, 'dest_branch')

    const [transfer] = await db
      .select({
        id: interBranchTransfers.id,
        ibtNumber: interBranchTransfers.ibtNumber,
        status: interBranchTransfers.status,
        sourceBranchId: interBranchTransfers.sourceBranchId,
        destinationBranchId: interBranchTransfers.destinationBranchId,
        destinationBranchName: destBranchAlias.name,
        requestedByName: users.name,
        convertedTransactionId: interBranchTransfers.convertedTransactionId,
        notes: interBranchTransfers.notes,
        createdAt: interBranchTransfers.createdAt,
      })
      .from(interBranchTransfers)
      .leftJoin(destBranchAlias, eq(interBranchTransfers.destinationBranchId, destBranchAlias.id))
      .leftJoin(users, eq(interBranchTransfers.requestedById, users.id))
      .where(eq(interBranchTransfers.id, transferId))
      .limit(1)

    if (!transfer) {
      return NextResponse.json({ error: 'PO Internal tidak ditemukan' }, { status: 404 })
    }

    // Kasir hanya boleh melihat PO yang cabang pengirimnya = cabang sesi POS ini.
    if (transfer.sourceBranchId !== branchId) {
      return NextResponse.json(
        { error: 'PO Internal ini bukan permintaan ke cabang Anda' },
        { status: 403 },
      )
    }

    const itemRows = await db
      .select({
        id: interBranchTransferItems.id,
        productId: interBranchTransferItems.productId,
        productName: products.name,
        productSku: products.sku,
        baseUomId: products.baseUomId,
        uomId: interBranchTransferItems.uomId,
        uomCode: unitsOfMeasure.code,
        qtyRequested: interBranchTransferItems.qtyRequested,
      })
      .from(interBranchTransferItems)
      .leftJoin(products, eq(interBranchTransferItems.productId, products.id))
      .leftJoin(unitsOfMeasure, eq(interBranchTransferItems.uomId, unitsOfMeasure.id))
      .where(eq(interBranchTransferItems.transferId, transferId))

    const productIds = [...new Set(itemRows.map((i) => i.productId))]

    const [convRows, stockRows, priceRows, internalCustomerRows] = await Promise.all([
      productIds.length
        ? db
            .select({
              productId: productUomConversions.productId,
              uomId: productUomConversions.uomId,
              ratio: productUomConversions.ratio,
            })
            .from(productUomConversions)
            .where(inArray(productUomConversions.productId, productIds))
        : Promise.resolve([] as { productId: number; uomId: number; ratio: number }[]),
      productIds.length
        ? db
            .select({ productId: productStocks.productId, uomId: productStocks.uomId, qty: productStocks.qty })
            .from(productStocks)
            .where(and(inArray(productStocks.productId, productIds), eq(productStocks.branchId, branchId)))
        : Promise.resolve([] as { productId: number; uomId: number; qty: number }[]),
      productIds.length
        ? db
            .select({
              productId: productPrices.productId,
              uomId: productPrices.uomId,
              tierType: productPrices.tierType,
              price: productPrices.price,
            })
            .from(productPrices)
            .where(
              and(
                inArray(productPrices.productId, productIds),
                eq(productPrices.branchId, branchId),
              ),
            )
        : Promise.resolve([] as { productId: number; uomId: number; tierType: string; price: number }[]),
      db
        .select({ id: customers.id, name: customers.name })
        .from(customers)
        .where(
          and(
            eq(customers.linkedBranchId, transfer.destinationBranchId),
            eq(customers.isInternalBranch, true),
          ),
        )
        .limit(1),
    ])

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
    // Semua tier harga per (produk, satuan) di cabang ini — dibawa ke keranjang sebagai
    // `tierPrices` supaya kasir bisa "Ubah Tier" setelah impor (default tetap RETAIL).
    const tierPricesByKey = new Map<string, Record<string, number>>()
    for (const p of priceRows) {
      const key = `${p.productId}-${p.uomId}`
      const m = tierPricesByKey.get(key) ?? {}
      m[p.tierType] = Number(p.price)
      tierPricesByKey.set(key, m)
    }

    const items = itemRows.map((item) => {
      // ratio map: uomId -> rasio ke base UOM (base = 1). Pola sama seperti
      // `app/api/bo/internal-transfers/[id]/stock-check/route.ts`: jumlahkan dalam base,
      // baru floor sekali ke satuan transfer supaya konsisten dengan validasi ship.
      const ratioMap = new Map<number, number>()
      if (item.baseUomId != null) ratioMap.set(item.baseUomId, 1)
      for (const c of convByProduct.get(item.productId) ?? []) ratioMap.set(c.uomId, c.ratio)

      const transferRatio = ratioMap.get(item.uomId)
      let currentQty: number | null = null
      if (transferRatio !== undefined) {
        let totalBase = 0
        let uomKnown = true
        for (const s of stockByProduct.get(item.productId) ?? []) {
          const r = ratioMap.get(s.uomId)
          if (r === undefined) {
            uomKnown = false
            break
          }
          totalBase += s.qty * r
        }
        currentQty = uomKnown ? Math.floor(totalBase / transferRatio) : null
      }

      const tierPrices = tierPricesByKey.get(`${item.productId}-${item.uomId}`) ?? {}
      const retailPrice = tierPrices[RETAIL_TIER] ?? null

      return {
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku,
        uomId: item.uomId,
        uomCode: item.uomCode,
        qtyRequested: item.qtyRequested,
        // null = satuan transfer/stok tak terdefinisi di konversi -> tak bisa dihitung di sini.
        currentQty,
        // null = produk belum punya harga RETAIL di cabang ini (lihat tierPrices untuk alternatif).
        retailPrice,
        // Semua tier harga produk+satuan ini di cabang. {} = tak ada harga sama sekali.
        tierPrices,
        insufficient: currentQty === null ? true : currentQty < item.qtyRequested,
      }
    })

    return NextResponse.json({
      id: transfer.id,
      ibtNumber: transfer.ibtNumber,
      status: transfer.status,
      sourceBranchId: transfer.sourceBranchId,
      destinationBranchId: transfer.destinationBranchId,
      destinationBranchName: transfer.destinationBranchName,
      destinationCustomerId: internalCustomerRows[0]?.id ?? null,
      destinationCustomerName: internalCustomerRows[0]?.name ?? null,
      requestedByName: transfer.requestedByName,
      convertedTransactionId: transfer.convertedTransactionId,
      notes: transfer.notes,
      createdAt: transfer.createdAt,
      items,
    })
  } catch (error) {
    console.error('GET /api/pos/internal-po/[id] error:', error)
    return NextResponse.json({ error: 'Gagal mengambil detail PO Internal' }, { status: 500 })
  }
}
