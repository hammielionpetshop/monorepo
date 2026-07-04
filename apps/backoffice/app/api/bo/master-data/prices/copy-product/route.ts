import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { verifyAccessToken } from '@/lib/auth'
import {
  db,
  products,
  productPrices,
  productUomCosts,
  productUomConversions,
  unitsOfMeasure,
  eq,
  and,
  inArray,
} from '@/lib/db'

export const dynamic = 'force-dynamic'

const ALLOWED_MUTATE_ROLES = ['OWNER', 'GM']

const bodySchema = z.object({
  sourceProductId: z.number().int().positive('Produk sumber wajib dipilih'),
  targetProductId: z.number().int().positive('Produk tujuan wajib dipilih'),
  branchId: z.number().int().positive('branchId wajib diisi'),
  uomIds: z.array(z.number().int().positive()).max(50).optional(),
})

interface PreviewRow {
  uomId: number
  uomCode: string
  uomName: string
  ratio: number | null // null = UOM dasar (tidak butuh konversi)
  weightGram: number | null
  prices: Record<string, number>
  costPrice: number | null
  targetExistingRatio: number | null // konversi sudah ada di produk tujuan
  copyable: boolean
  blockReason: string | null
}

async function buildPreview(sourceProductId: number, targetProductId: number, branchId: number) {
  const [sourceRows, targetRows] = await Promise.all([
    db
      .select({ id: products.id, name: products.name, baseUomId: products.baseUomId })
      .from(products)
      .where(eq(products.id, sourceProductId))
      .limit(1),
    db
      .select({ id: products.id, name: products.name, baseUomId: products.baseUomId })
      .from(products)
      .where(eq(products.id, targetProductId))
      .limit(1),
  ])
  if (sourceRows.length === 0 || targetRows.length === 0) return null
  const source = sourceRows[0]
  const target = targetRows[0]

  const [srcPrices, srcCosts, srcConversions, tgtConversions] = await Promise.all([
    db
      .select({ uomId: productPrices.uomId, tierType: productPrices.tierType, price: productPrices.price })
      .from(productPrices)
      .where(and(eq(productPrices.productId, sourceProductId), eq(productPrices.branchId, branchId))),
    db
      .select({ uomId: productUomCosts.uomId, costPrice: productUomCosts.costPrice })
      .from(productUomCosts)
      .where(and(eq(productUomCosts.productId, sourceProductId), eq(productUomCosts.branchId, branchId))),
    db
      .select({
        uomId: productUomConversions.uomId,
        ratio: productUomConversions.ratio,
        weightGram: productUomConversions.weightGram,
      })
      .from(productUomConversions)
      .where(eq(productUomConversions.productId, sourceProductId)),
    db
      .select({ uomId: productUomConversions.uomId, ratio: productUomConversions.ratio })
      .from(productUomConversions)
      .where(eq(productUomConversions.productId, targetProductId)),
  ])

  const uomIds = [...new Set(srcPrices.map((p) => p.uomId))]
  if (uomIds.length === 0) {
    return { source, target, rows: [] as PreviewRow[] }
  }
  const uoms = await db
    .select({ id: unitsOfMeasure.id, code: unitsOfMeasure.code, name: unitsOfMeasure.name })
    .from(unitsOfMeasure)
    .where(inArray(unitsOfMeasure.id, uomIds))
  const uomMap = new Map(uoms.map((u) => [u.id, u]))
  const srcConvMap = new Map(srcConversions.map((c) => [c.uomId, c]))
  const tgtConvMap = new Map(tgtConversions.map((c) => [c.uomId, c]))
  const costMap = new Map(srcCosts.map((c) => [c.uomId, c.costPrice]))

  const rows: PreviewRow[] = uomIds.map((uomId) => {
    const uom = uomMap.get(uomId)
    const srcConv = srcConvMap.get(uomId)
    const tgtConv = tgtConvMap.get(uomId)
    const prices: Record<string, number> = {}
    for (const p of srcPrices) {
      if (p.uomId === uomId) prices[p.tierType] = p.price
    }

    const isTargetBase = uomId === target.baseUomId
    const isSourceBase = uomId === source.baseUomId

    let copyable = true
    let blockReason: string | null = null
    if (!isTargetBase) {
      if (!srcConv && isSourceBase) {
        // UOM dasar sumber ≠ UOM dasar tujuan — ratio antar keduanya tidak diketahui
        copyable = false
        blockReason = `UOM dasar produk sumber (${uom?.code ?? uomId}) berbeda dengan UOM dasar produk tujuan`
      } else if (!srcConv) {
        copyable = false
        blockReason = 'Produk sumber tidak punya konversi untuk satuan ini'
      } else if (tgtConv && tgtConv.ratio !== srcConv.ratio) {
        copyable = false
        blockReason = `Ratio bentrok — produk tujuan sudah punya ratio ${tgtConv.ratio}, sumber ${srcConv.ratio}`
      }
    }

    return {
      uomId,
      uomCode: uom?.code ?? String(uomId),
      uomName: uom?.name ?? '',
      ratio: isTargetBase ? null : (srcConv?.ratio ?? null),
      weightGram: srcConv?.weightGram ?? null,
      prices,
      costPrice: costMap.get(uomId) ?? null,
      targetExistingRatio: tgtConv?.ratio ?? null,
      copyable,
      blockReason,
    }
  })

  return { source, target, rows }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }
    if (!ALLOWED_MUTATE_ROLES.includes(payload.role)) {
      return NextResponse.json({ error: 'Akses ditolak. Hanya Owner dan GM yang dapat mengubah harga.' }, { status: 403 })
    }

    let body: unknown
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
    }
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }
    const { sourceProductId, targetProductId, branchId, uomIds } = parsed.data
    if (sourceProductId === targetProductId) {
      return NextResponse.json({ error: 'Produk sumber dan tujuan tidak boleh sama' }, { status: 400 })
    }

    const preview = await buildPreview(sourceProductId, targetProductId, branchId)
    if (!preview) {
      return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 })
    }

    const isPreview = req.nextUrl.searchParams.get('preview') === '1'
    if (isPreview) {
      return NextResponse.json({
        sourceName: preview.source.name,
        targetName: preview.target.name,
        rows: preview.rows,
      })
    }

    if (!uomIds || uomIds.length === 0) {
      return NextResponse.json({ error: 'Pilih minimal satu satuan untuk disalin' }, { status: 400 })
    }

    const selected = preview.rows.filter((r) => uomIds.includes(r.uomId))
    const blocked = selected.filter((r) => !r.copyable)
    if (blocked.length > 0) {
      return NextResponse.json(
        { error: `Satuan ${blocked.map((r) => r.uomCode).join(', ')} tidak dapat disalin: ${blocked[0].blockReason}` },
        { status: 409 }
      )
    }

    let createdConversions = 0
    let copiedPrices = 0
    let copiedCosts = 0

    await db.transaction(async (trx) => {
      for (const row of selected) {
        // Konversi (global) — hanya dibuat bila belum ada di produk tujuan
        if (row.ratio !== null && row.targetExistingRatio === null) {
          await trx.insert(productUomConversions).values({
            productId: targetProductId,
            uomId: row.uomId,
            ratio: row.ratio,
            weightGram: row.weightGram,
          })
          createdConversions++
        }

        // Harga tier — cabang aktif saja
        const priceEntries = Object.entries(row.prices)
        if (priceEntries.length > 0) {
          await trx
            .insert(productPrices)
            .values(priceEntries.map(([tierType, price]) => ({
              productId: targetProductId,
              branchId,
              uomId: row.uomId,
              tierType,
              price,
            })))
            .onConflictDoUpdate({
              target: [productPrices.productId, productPrices.branchId, productPrices.uomId, productPrices.tierType],
              set: { price: sql`excluded.price` },
            })
          copiedPrices += priceEntries.length
        }

        // Harga modal — cabang aktif saja
        if (row.costPrice !== null) {
          await trx
            .insert(productUomCosts)
            .values({ productId: targetProductId, branchId, uomId: row.uomId, costPrice: row.costPrice })
            .onConflictDoUpdate({
              target: [productUomCosts.productId, productUomCosts.branchId, productUomCosts.uomId],
              set: { costPrice: sql`excluded.cost_price` },
            })
          copiedCosts++
        }
      }
    })

    return NextResponse.json({ createdConversions, copiedPrices, copiedCosts })
  } catch (error) {
    console.error('POST /api/bo/master-data/prices/copy-product error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menyalin dari produk lain' }, { status: 500 })
  }
}
