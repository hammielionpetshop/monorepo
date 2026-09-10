import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { alias } from 'drizzle-orm/pg-core'

import { verifyAccessToken } from '@/lib/auth'
import { hasPermission } from '@/lib/authz'
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
import { getPosBranchId } from '@/lib/pos-branch'
import { ibtTransferValueSql } from '@/lib/ibt-transfer-value'

export const dynamic = 'force-dynamic'
// Ikut terpanggil dari halaman kasir (badge + drawer), jadi ikut antrean pool yang sama —
// lihat alasan lengkapnya di `app/pos/(authenticated)/page.tsx`.
export const maxDuration = 20

// Status IBT yang belum diproses cabang pengirim: kandidat untuk diimpor ke keranjang kasir.
// Setelah diproses jadi bulk sale, status naik ke APPROVED + convertedTransactionId terisi,
// jadi keduanya otomatis keluar dari daftar ini.
const PENDING_STATUSES = ['DRAFT', 'PENDING_APPROVAL']

/**
 * Daftar PO Internal (IBT) yang MASUK ke cabang sesi POS ini sebagai cabang pengirim dan
 * belum diproses. Dipakai badge "PO Internal" + drawer di halaman kasir.
 */
export async function GET() {
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

    const branchId = getPosBranchId(payload, cookieStore)
    const destBranchAlias = alias(branches, 'dest_branch')

    const rows = await db
      .select({
        id: interBranchTransfers.id,
        ibtNumber: interBranchTransfers.ibtNumber,
        status: interBranchTransfers.status,
        destinationBranchId: interBranchTransfers.destinationBranchId,
        destinationBranchName: destBranchAlias.name,
        requestedByName: users.name,
        notes: interBranchTransfers.notes,
        createdAt: interBranchTransfers.createdAt,
        totalValue: ibtTransferValueSql(),
        itemCount: sql<number>`(
          SELECT CAST(COUNT(*) AS INTEGER) FROM ${interBranchTransferItems}
          WHERE ${interBranchTransferItems.transferId} = ${interBranchTransfers.id}
        )`,
      })
      .from(interBranchTransfers)
      .leftJoin(destBranchAlias, eq(interBranchTransfers.destinationBranchId, destBranchAlias.id))
      .leftJoin(users, eq(interBranchTransfers.requestedById, users.id))
      .where(
        and(
          eq(interBranchTransfers.sourceBranchId, branchId),
          inArray(interBranchTransfers.status, PENDING_STATUSES),
          sql`${interBranchTransfers.convertedTransactionId} IS NULL`,
        ),
      )
      .orderBy(desc(interBranchTransfers.createdAt))

    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET /api/pos/internal-po error:', error)
    return NextResponse.json({ error: 'Gagal mengambil daftar PO Internal masuk' }, { status: 500 })
  }
}
