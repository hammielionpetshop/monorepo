import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { verifyAccessToken } from '@/lib/auth'
import { hasPermission } from '@/lib/authz'
import { db, interBranchTransfers, interBranchTransferItems, eq, and } from '@/lib/db'
import { getPosBranchId } from '@/lib/pos-branch'
import { resolveBulkSaleQtyByItem } from '@/lib/services/ibt-bulk-sale-match'

export const dynamic = 'force-dynamic'

/**
 * Konfirmasi pengiriman PO Internal yang sudah dijual via Bulk Sale (task kanban #38
 * Bagian C) — sebelumnya ini otomatis terjadi tepat setelah transaksi dibuat
 * (`TransactionService.createTransaction`, lihat riwayat "autoShipIbt"); sekarang kasir
 * yang mengonfirmasi secara manual, dan IBT tetap terlihat ("Menunggu Pengiriman") di
 * antara kedua momen itu.
 *
 * Qty yang dikirim dikunci ke qty yang benar-benar terjual (`resolveBulkSaleQtyByItem`,
 * dicocokkan lewat base UOM) — sama seperti perilaku ship untuk IBT terkonversi di
 * `PATCH /api/bo/internal-transfers/[id]/status`. Tidak memotong stok gudang: sudah
 * dipotong FIFO oleh transaksi Bulk Sale itu sendiri (mitigasi dobel-potong R1/G5).
 */
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const [transfer] = await db
      .select({
        id: interBranchTransfers.id,
        sourceBranchId: interBranchTransfers.sourceBranchId,
        status: interBranchTransfers.status,
        convertedTransactionId: interBranchTransfers.convertedTransactionId,
      })
      .from(interBranchTransfers)
      .where(eq(interBranchTransfers.id, transferId))
      .limit(1)

    if (!transfer) {
      return NextResponse.json({ error: 'PO Internal tidak ditemukan' }, { status: 404 })
    }
    if (transfer.sourceBranchId !== branchId) {
      return NextResponse.json({ error: 'PO Internal ini bukan permintaan ke cabang Anda' }, { status: 403 })
    }
    if (!transfer.convertedTransactionId) {
      return NextResponse.json(
        { error: 'PO Internal ini belum diproses jadi transaksi, tidak ada yang bisa dikonfirmasi kirim' },
        { status: 409 },
      )
    }
    if (transfer.status !== 'APPROVED') {
      return NextResponse.json(
        { error: `PO Internal dengan status '${transfer.status}' tidak bisa dikonfirmasi kirim dari sini` },
        { status: 409 },
      )
    }

    const updated = await db.transaction(async (tx) => {
      // Fail-fast: verifikasi status belum berubah sebelum mulai proses.
      const [locked] = await tx
        .select({ id: interBranchTransfers.id })
        .from(interBranchTransfers)
        .where(and(eq(interBranchTransfers.id, transferId), eq(interBranchTransfers.status, 'APPROVED')))
        .limit(1)
      if (!locked) throw new Error('STATUS_SUDAH_BERUBAH')

      const items = await tx
        .select({
          id: interBranchTransferItems.id,
          productId: interBranchTransferItems.productId,
          uomId: interBranchTransferItems.uomId,
        })
        .from(interBranchTransferItems)
        .where(eq(interBranchTransferItems.transferId, transferId))

      const qtyByItem = await resolveBulkSaleQtyByItem(tx, transfer.convertedTransactionId as number, items)

      for (const item of items) {
        await tx
          .update(interBranchTransferItems)
          .set({ qtyShipped: qtyByItem.get(item.id) ?? 0 })
          .where(eq(interBranchTransferItems.id, item.id))
      }

      const [result] = await tx
        .update(interBranchTransfers)
        .set({ status: 'IN_TRANSIT', updatedAt: new Date() })
        .where(and(eq(interBranchTransfers.id, transferId), eq(interBranchTransfers.status, 'APPROVED')))
        .returning({ id: interBranchTransfers.id, status: interBranchTransfers.status })

      if (!result) throw new Error('STATUS_SUDAH_BERUBAH')
      return result
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof Error && error.message === 'STATUS_SUDAH_BERUBAH') {
      return NextResponse.json({ error: 'Status PO Internal sudah berubah, silakan refresh' }, { status: 409 })
    }
    console.error('PATCH /api/pos/internal-po/[id]/ship error:', error)
    return NextResponse.json({ error: 'Gagal mengonfirmasi pengiriman PO Internal' }, { status: 500 })
  }
}
