import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Big from 'big.js'
import { verifyAccessToken } from '@/lib/auth'

function safeBig(value: string): Big {
  try {
    return new Big(value)
  } catch {
    return new Big(0)
  }
}
import {
  db,
  stockAdjustments,
  products,
  branches,
  users,
  eq,
  and,
  desc,
  sql,
} from '@/lib/db'
import AdjustmentLogsClient from './_components/adjustment-logs-client'
import type { SQL } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export interface AdjustmentLogEntry {
  id: number
  productName: string
  productSku: string | null
  branchName: string
  adjustedByName: string
  previousQty: string
  newQty: string
  deltaQty: string
  deltaFormatted: string
  reason: string
  createdAt: Date | string
}

export default async function AdjustmentLogsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  if (!payload) redirect('/login')

  const conditions: SQL<unknown>[] = []
  if (payload.role !== 'OWNER') {
    conditions.push(eq(stockAdjustments.branchId, payload.branchId))
  }

  let logs: AdjustmentLogEntry[] = []
  let error: string | null = null

  try {
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

    logs = rows.map((row) => {
      const prev = safeBig(row.previousQty)
      const next = safeBig(row.newQty)
      const delta = next.minus(prev)
      return {
        ...row,
        deltaQty: delta.toFixed(2),
        deltaFormatted: delta.eq(0) ? '0' : (delta.gte(0) ? `+${delta.toFixed(2)}` : delta.toFixed(2)),
      }
    })
  } catch (e) {
    console.error('AdjustmentLogsPage error:', e)
    error = 'Terjadi kesalahan saat mengambil data adjustment logs'
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-foreground mb-1">Riwayat Penyesuaian Stok</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Riwayat semua penyesuaian stok manual. Menampilkan maksimal 100 entri terbaru.
      </p>
      <AdjustmentLogsClient initialData={logs} />
    </div>
  )
}
