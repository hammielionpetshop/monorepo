import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { verifyAccessToken } from '@/lib/auth'
import { db, interBranchTransfers, eq } from '@/lib/db'
import { getPosBranchId } from '@/lib/pos-branch'
import {
  applyInternalTransferItemEdits,
  InternalTransferEditError,
  REQUESTER_EDITABLE_STATUSES,
} from '@/lib/services/internal-transfer-items-service'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

const editItemSchema = z
  .object({
    id: z.number().int().positive().optional(),
    productId: z.number().int().positive('productId tidak valid').optional(),
    uomId: z.number().int().positive('uomId tidak valid').optional(),
    qtyRequested: z.number().int().min(1, 'Qty minimal 1'),
  })
  .refine((item) => item.id !== undefined || (item.productId !== undefined && item.uomId !== undefined), {
    message: 'Item baru wajib menyertakan productId dan uomId',
  })

const editItemsSchema = z.object({
  items: z.array(editItemSchema).min(1, 'Minimal satu item wajib diisi'),
})

/**
 * PATCH — tambah/hapus/ubah qty produk pada PO Internal yang dibuat cabang sendiri, dari
 * halaman kasir (`/pos → PO Internal`). Beda dari `PATCH /api/bo/internal-transfers/[id]`:
 * ini khusus fase requester (status belum diproses cabang pengirim), cabang tujuan tidak
 * bisa diubah, dan tanpa permission khusus — mengikuti pola `POST /api/bo/internal-transfers`
 * yang juga cuma menggerbang lewat cocok-tidaknya cabang, bukan permission (siapa pun yang
 * bisa membuat PO Internal dari kasir boleh menambahnya juga).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      .select()
      .from(interBranchTransfers)
      .where(eq(interBranchTransfers.id, transferId))
      .limit(1)

    if (!transfer) {
      return NextResponse.json({ error: 'PO Internal tidak ditemukan' }, { status: 404 })
    }

    const branchId = getPosBranchId(payload, cookieStore)
    if (payload.branchScope !== 'ALL' && transfer.destinationBranchId !== branchId) {
      return NextResponse.json({ error: 'PO Internal ini bukan milik cabang Anda' }, { status: 403 })
    }

    if (!REQUESTER_EDITABLE_STATUSES.includes(transfer.status)) {
      return NextResponse.json(
        {
          error: `PO Internal ini sudah diproses cabang pengirim (status '${transfer.status}') dan tidak bisa ditambah dari kasir lagi. Hubungi cabang pengirim atau ubah lewat backoffice.`,
        },
        { status: 409 }
      )
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

    const parsed = editItemsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }

    const result = await applyInternalTransferItemEdits(
      transferId,
      { sourceBranchId: transfer.sourceBranchId, destinationBranchId: transfer.destinationBranchId },
      transfer.destinationBranchId,
      parsed.data.items,
      REQUESTER_EDITABLE_STATUSES
    )

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof InternalTransferEditError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('PATCH /api/pos/internal-order/[id] error:', error)
    return NextResponse.json({ error: 'Gagal memperbarui PO Internal' }, { status: 500 })
  }
}
