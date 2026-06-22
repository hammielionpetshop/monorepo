import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { verifyAccessToken } from '@/lib/auth'
import {
  db,
  interBranchTransfers,
  interBranchTransferItems,
  branches,
  users,
  products,
  productUomConversions,
  productUomCosts,
  eq,
  and,
  or,
  inArray,
  sql,
  desc,
} from '@/lib/db'
import { alias } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const GLOBAL_ROLES = ['OWNER', 'GM']

const createTransferSchema = z.object({
  sourceBranchId: z.number().int().positive('sourceBranchId tidak valid'),
  destinationBranchId: z.number().int().positive('destinationBranchId tidak valid'),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive('productId tidak valid'),
        uomId: z.number().int().positive('uomId tidak valid'),
        qtyRequested: z.number().int().min(1, 'Qty minimal 1'),
        costPrice: z.number().int().min(0, 'Harga tidak boleh negatif'),
      })
    )
    .min(1, 'Minimal satu item wajib diisi'),
}).refine((data) => data.sourceBranchId !== data.destinationBranchId, {
  message: 'Cabang asal dan cabang tujuan tidak boleh sama',
  path: ['destinationBranchId'],
})

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const sourceBranchIdParam = searchParams.get('sourceBranchId')
    const destinationBranchIdParam = searchParams.get('destinationBranchId')
    const limit = parseInt(searchParams.get('limit') ?? '50')
    const offset = parseInt(searchParams.get('offset') ?? '0')

    const sourceBranchAlias = alias(branches, 'source_branch')
    const destBranchAlias = alias(branches, 'dest_branch')

    const conditions: SQL<unknown>[] = []

    if (status) {
      conditions.push(inArray(interBranchTransfers.status, status.split(',')))
    }
    if (sourceBranchIdParam) {
      conditions.push(eq(interBranchTransfers.sourceBranchId, parseInt(sourceBranchIdParam)))
    }
    if (destinationBranchIdParam) {
      conditions.push(eq(interBranchTransfers.destinationBranchId, parseInt(destinationBranchIdParam)))
    }
    if (!GLOBAL_ROLES.includes(payload.role)) {
      conditions.push(
        or(
          eq(interBranchTransfers.sourceBranchId, payload.branchId),
          eq(interBranchTransfers.destinationBranchId, payload.branchId)
        )!
      )
    }

    const rows = await db
      .select({
        id: interBranchTransfers.id,
        ibtNumber: interBranchTransfers.ibtNumber,
        sourceBranchId: interBranchTransfers.sourceBranchId,
        destinationBranchId: interBranchTransfers.destinationBranchId,
        requestedById: interBranchTransfers.requestedById,
        approvedById: interBranchTransfers.approvedById,
        status: interBranchTransfers.status,
        totalTransferValue: interBranchTransfers.totalTransferValue,
        notes: interBranchTransfers.notes,
        createdAt: interBranchTransfers.createdAt,
        updatedAt: interBranchTransfers.updatedAt,
        sourceBranchName: sourceBranchAlias.name,
        destinationBranchName: destBranchAlias.name,
        requestedByName: users.name,
      })
      .from(interBranchTransfers)
      .leftJoin(sourceBranchAlias, eq(interBranchTransfers.sourceBranchId, sourceBranchAlias.id))
      .leftJoin(destBranchAlias, eq(interBranchTransfers.destinationBranchId, destBranchAlias.id))
      .leftJoin(users, eq(interBranchTransfers.requestedById, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(interBranchTransfers.createdAt))
      .limit(limit)
      .offset(offset)

    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET internal-transfers error:', error)
    return NextResponse.json({ error: 'Gagal mengambil data transfer antar cabang' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    if (!req.headers.get('content-type')?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
    }

    const parsed = createTransferSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }

    const { sourceBranchId, destinationBranchId, notes, items } = parsed.data

    // Non-global user hanya boleh meminta transfer masuk ke cabang sendiri
    if (!GLOBAL_ROLES.includes(payload.role)) {
      if (destinationBranchId !== payload.branchId) {
        return NextResponse.json(
          { error: 'Anda hanya dapat membuat permintaan transfer ke cabang Anda sendiri' },
          { status: 403 }
        )
      }
    }

    // Validasi kedua cabang aktif
    const branchRows = await db
      .select({ id: branches.id, isActive: branches.isActive })
      .from(branches)
      .where(inArray(branches.id, [sourceBranchId, destinationBranchId]))

    const sourceBranch = branchRows.find((b) => b.id === sourceBranchId)
    const destBranch = branchRows.find((b) => b.id === destinationBranchId)

    if (!sourceBranch) {
      return NextResponse.json({ error: 'Cabang asal tidak ditemukan' }, { status: 400 })
    }
    if (!destBranch) {
      return NextResponse.json({ error: 'Cabang tujuan tidak ditemukan' }, { status: 400 })
    }
    if (!sourceBranch.isActive) {
      return NextResponse.json({ error: 'Cabang asal tidak aktif' }, { status: 400 })
    }
    if (!destBranch.isActive) {
      return NextResponse.json({ error: 'Cabang tujuan tidak aktif' }, { status: 400 })
    }

    // Auto-fill costPrice = 0 dari master data agar nilai payable tidak nol secara tidak sengaja
    // Prioritas: productUomCosts (per cabang sumber + UOM) → defaultCostPrice × ratio → tetap 0
    const zeroItems = items.filter((item) => item.costPrice === 0)
    let resolvedItems = [...items]

    if (zeroItems.length > 0) {
      const productIds = [...new Set(zeroItems.map((i) => i.productId))]

      const [uomCostRows, productRows, convRows] = await Promise.all([
        db
          .select({
            productId: productUomCosts.productId,
            uomId: productUomCosts.uomId,
            costPrice: productUomCosts.costPrice,
          })
          .from(productUomCosts)
          .where(
            and(
              inArray(productUomCosts.productId, productIds),
              eq(productUomCosts.branchId, sourceBranchId)
            )
          ),
        db
          .select({ id: products.id, baseUomId: products.baseUomId, defaultCostPrice: products.defaultCostPrice })
          .from(products)
          .where(inArray(products.id, productIds)),
        db
          .select({ productId: productUomConversions.productId, uomId: productUomConversions.uomId, ratio: productUomConversions.ratio })
          .from(productUomConversions)
          .where(inArray(productUomConversions.productId, productIds)),
      ])

      const uomCostMap = new Map(uomCostRows.map((r) => [`${r.productId}-${r.uomId}`, r.costPrice]))
      const productMap = new Map(productRows.map((r) => [r.id, r]))
      const convMap = new Map(convRows.map((r) => [`${r.productId}-${r.uomId}`, r.ratio]))

      resolvedItems = items.map((item) => {
        if (item.costPrice !== 0) return item

        // Coba dari productUomCosts cabang sumber (paling akurat)
        const branchUomCost = uomCostMap.get(`${item.productId}-${item.uomId}`)
        if (branchUomCost !== undefined) return { ...item, costPrice: branchUomCost }

        // Fallback: defaultCostPrice × ratio konversi UOM
        const prod = productMap.get(item.productId)
        if (!prod || !prod.defaultCostPrice) return item

        if (item.uomId === prod.baseUomId) return { ...item, costPrice: prod.defaultCostPrice }

        const ratio = convMap.get(`${item.productId}-${item.uomId}`)
        if (ratio === undefined) return item
        return { ...item, costPrice: Math.round(prod.defaultCostPrice * ratio) }
      })
    }

    const totalTransferValue = resolvedItems.reduce((sum, item) => sum + item.qtyRequested * item.costPrice, 0)

    const result = await db.transaction(async (tx) => {
      // Kunci advisory level-transaksi agar penomoran IBT tidak race condition.
      // Lock otomatis dilepas saat transaksi commit/rollback.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('ibt_number_generation'))`)

      const [countRow] = await tx
        .select({ count: sql<number>`COUNT(*)` })
        .from(interBranchTransfers)
        .where(sql`DATE(${interBranchTransfers.createdAt}) = CURRENT_DATE`)

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const increment = ((Number(countRow?.count) || 0) + 1).toString().padStart(4, '0')
      const ibtNumber = `IBT-${dateStr}-${increment}`

      const [newTransfer] = await tx
        .insert(interBranchTransfers)
        .values({
          ibtNumber,
          sourceBranchId,
          destinationBranchId,
          requestedById: payload.userId,
          status: 'PENDING_APPROVAL',
          totalTransferValue,
          notes: notes ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()

      const transferItems = resolvedItems.map((item) => ({
        transferId: newTransfer.id,
        productId: item.productId,
        uomId: item.uomId,
        qtyRequested: item.qtyRequested,
        qtyShipped: 0,
        qtyReceived: 0,
        costPriceAtTransfer: item.costPrice,
      }))

      await tx.insert(interBranchTransferItems).values(transferItems)

      return newTransfer
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    // Tangani race condition pada ibtNumber unique constraint
    if (
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === '23505'
    ) {
      return NextResponse.json(
        { error: 'Terjadi konflik nomor transfer, silakan coba lagi' },
        { status: 409 }
      )
    }
    console.error('POST internal-transfers error:', error)
    return NextResponse.json({ error: 'Gagal membuat transfer antar cabang' }, { status: 500 })
  }
}
