import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'
import {
  db,
  interBranchTransfers,
  interBranchTransferItems,
  productStocks,
  eq,
  and,
} from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const { id } = await params
    const transferId = parseInt(id)
    if (isNaN(transferId)) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }

    const [transfer] = await db
      .select({ sourceBranchId: interBranchTransfers.sourceBranchId })
      .from(interBranchTransfers)
      .where(eq(interBranchTransfers.id, transferId))
      .limit(1)

    if (!transfer) {
      return NextResponse.json({ error: 'Transfer tidak ditemukan' }, { status: 404 })
    }

    const items = await db
      .select({
        itemId: interBranchTransferItems.id,
        productId: interBranchTransferItems.productId,
        uomId: interBranchTransferItems.uomId,
      })
      .from(interBranchTransferItems)
      .where(eq(interBranchTransferItems.transferId, transferId))

    const result = await Promise.all(
      items.map(async (item) => {
        const [stockRow] = await db
          .select({ qty: productStocks.qty })
          .from(productStocks)
          .where(
            and(
              eq(productStocks.productId, item.productId),
              eq(productStocks.branchId, transfer.sourceBranchId),
              eq(productStocks.uomId, item.uomId)
            )
          )
          .limit(1)

        return {
          itemId: item.itemId,
          currentQty: stockRow?.qty ?? 0,
        }
      })
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET stock-check error:', error)
    return NextResponse.json({ error: 'Gagal mengambil data stok' }, { status: 500 })
  }
}
