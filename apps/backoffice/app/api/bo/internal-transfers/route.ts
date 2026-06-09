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
  eq,
  and,
  inArray,
  sql,
  desc,
} from '@/lib/db'
import { alias } from 'drizzle-orm/pg-core'

export const dynamic = 'force-dynamic'

const createTransferSchema = z.object({
  sourceBranchId: z.number().int().positive('sourceBranchId tidak valid'),
  destinationBranchId: z.number().int().positive('destinationBranchId tidak valid'),
  requestedById: z.number().int().positive('requestedById tidak valid'),
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

    const conditions: ReturnType<typeof eq>[] = []

    if (status) {
      conditions.push(inArray(interBranchTransfers.status, status.split(',')))
    }
    if (sourceBranchIdParam) {
      conditions.push(eq(interBranchTransfers.sourceBranchId, parseInt(sourceBranchIdParam)))
    }
    if (destinationBranchIdParam) {
      conditions.push(eq(interBranchTransfers.destinationBranchId, parseInt(destinationBranchIdParam)))
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

    const { sourceBranchId, destinationBranchId, requestedById, notes, items } = parsed.data

    const today = new Date()
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')

    const [countRow] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(interBranchTransfers)
      .where(sql`DATE(${interBranchTransfers.createdAt}) = CURRENT_DATE`)

    const increment = ((Number(countRow?.count) || 0) + 1).toString().padStart(4, '0')
    const ibtNumber = `IBT-${dateStr}-${increment}`

    const totalTransferValue = items.reduce((sum, item) => sum + item.qtyRequested * item.costPrice, 0)

    const result = await db.transaction(async (tx) => {
      const [newTransfer] = await tx
        .insert(interBranchTransfers)
        .values({
          ibtNumber,
          sourceBranchId,
          destinationBranchId,
          requestedById,
          status: 'DRAFT',
          totalTransferValue,
          notes: notes ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()

      const transferItems = items.map((item) => ({
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
    console.error('POST internal-transfers error:', error)
    return NextResponse.json({ error: 'Gagal membuat transfer antar cabang' }, { status: 500 })
  }
}
