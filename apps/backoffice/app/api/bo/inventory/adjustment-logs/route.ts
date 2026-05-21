import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import Big from 'big.js'
import { verifyAccessToken } from '@/lib/auth'
import {
  db,
  stockAdjustments,
  products,
  branches,
  users,
  eq,
  and,
  desc,
  gte,
  lte,
  sql,
} from '@/lib/db'
import type { SQL } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const querySchema = z
  .object({
    startDate: z
      .string()
      .regex(ISO_DATE_RE, 'Format startDate tidak valid (gunakan YYYY-MM-DD)')
      .refine((v) => !isNaN(new Date(v).getTime()), { message: 'startDate tidak valid' })
      .optional(),
    endDate: z
      .string()
      .regex(ISO_DATE_RE, 'Format endDate tidak valid (gunakan YYYY-MM-DD)')
      .refine((v) => !isNaN(new Date(v).getTime()), { message: 'endDate tidak valid' })
      .optional(),
  })
  .refine(
    (data) => {
      if (!data.startDate || !data.endDate) return true
      return data.startDate <= data.endDate
    },
    { message: 'startDate tidak boleh lebih besar dari endDate' }
  )

function safeBig(value: string): Big {
  try {
    return new Big(value)
  } catch {
    return new Big(0)
  }
}

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json(
        { error: 'Sesi tidak valid, silakan login kembali' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const parsed = querySchema.safeParse({
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Parameter tidak valid' },
        { status: 400 }
      )
    }

    const conditions: SQL<unknown>[] = []

    // OWNER lihat semua cabang; MANAGER dan role lain dibatasi ke cabang sendiri
    if (payload.role !== 'OWNER') {
      conditions.push(eq(stockAdjustments.branchId, payload.branchId))
    }

    if (parsed.data.startDate) {
      conditions.push(gte(stockAdjustments.createdAt, new Date(parsed.data.startDate + 'T00:00:00.000Z')))
    }
    if (parsed.data.endDate) {
      conditions.push(lte(stockAdjustments.createdAt, new Date(parsed.data.endDate + 'T23:59:59.999Z')))
    }

    const rows = await db
      .select({
        id: stockAdjustments.id,
        previousQty: stockAdjustments.previousQty,
        newQty: stockAdjustments.newQty,
        reason: stockAdjustments.reason,
        createdAt: stockAdjustments.createdAt,
        productName: products.name,
        productSku: products.sku,
        branchName: branches.name,
        adjustedByName: sql<string>`COALESCE(${users.name}, 'User dihapus')`,
      })
      .from(stockAdjustments)
      .innerJoin(products, eq(stockAdjustments.productId, products.id))
      .innerJoin(branches, eq(stockAdjustments.branchId, branches.id))
      .leftJoin(users, eq(stockAdjustments.adjustedById, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(stockAdjustments.createdAt))
      .limit(100)

    const data = rows.map((row) => {
      const prev = safeBig(row.previousQty)
      const next = safeBig(row.newQty)
      const delta = next.minus(prev)
      return {
        ...row,
        deltaQty: delta.toFixed(2),
        deltaFormatted: delta.eq(0) ? '0' : (delta.gte(0) ? `+${delta.toFixed(2)}` : delta.toFixed(2)),
      }
    })

    return NextResponse.json({ data, total: data.length })
  } catch (error: unknown) {
    console.error('[adjustment-logs] GET error:', error)
    return NextResponse.json(
      { error: 'Gagal mengambil data adjustment logs' },
      { status: 500 }
    )
  }
}
