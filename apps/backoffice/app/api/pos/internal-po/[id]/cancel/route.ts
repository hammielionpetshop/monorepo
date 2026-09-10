import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { verifyAccessToken } from '@/lib/auth'
import { hasPermission } from '@/lib/authz'
import { db, interBranchTransfers, eq, and, inArray } from '@/lib/db'
import { getPosBranchId } from '@/lib/pos-branch'

export const dynamic = 'force-dynamic'

// Kasir hanya boleh membatalkan PO Internal yang belum disentuh cabang pengirim. Begitu
// diproses jadi transaksi (convertedTransactionId terisi) atau statusnya sudah maju,
// pembatalan harus lewat backoffice.
const CANCELLABLE = ['DRAFT', 'PENDING_APPROVAL']

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
    if (transfer.convertedTransactionId) {
      return NextResponse.json(
        { error: 'PO Internal sudah diproses jadi transaksi, tidak bisa dibatalkan dari kasir' },
        { status: 409 },
      )
    }
    if (!CANCELLABLE.includes(transfer.status)) {
      return NextResponse.json(
        { error: `PO Internal dengan status '${transfer.status}' tidak bisa dibatalkan dari kasir` },
        { status: 409 },
      )
    }

    // Optimistic lock: batalkan hanya bila status masih salah satu CANCELLABLE.
    const [updated] = await db
      .update(interBranchTransfers)
      .set({ status: 'CANCELLED', updatedAt: new Date() })
      .where(
        and(
          eq(interBranchTransfers.id, transferId),
          inArray(interBranchTransfers.status, CANCELLABLE),
        ),
      )
      .returning({ id: interBranchTransfers.id, status: interBranchTransfers.status })

    if (!updated) {
      return NextResponse.json({ error: 'Status PO Internal sudah berubah, silakan refresh' }, { status: 409 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/pos/internal-po/[id]/cancel error:', error)
    return NextResponse.json({ error: 'Gagal membatalkan PO Internal' }, { status: 500 })
  }
}
