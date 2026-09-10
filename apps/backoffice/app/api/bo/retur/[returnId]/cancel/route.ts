import { NextRequest, NextResponse } from 'next/server'
import * as argon2 from 'argon2'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { db, users, ownerAssignments, eq, and } from '@/lib/db'
import { ReturService } from '@/lib/services/retur-service'

export const dynamic = 'force-dynamic'

const cancelSchema = z.object({
  pin: z.string().min(4).max(6),
  reason: z.string().min(1, 'Alasan pembatalan wajib diisi'),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ returnId: string }> }
) {
  try {
    const gate = await requirePermission('return.cancel')
    if (gate instanceof NextResponse) return gate
    const payload = gate

    const { returnId } = await params
    if (!returnId) {
      return NextResponse.json({ error: 'ID retur tidak valid' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const parsed = cancelSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Data tidak valid'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { pin, reason } = parsed.data

    // OWNER/GM (`branchScope === 'ALL'`) boleh membatalkan retur cabang mana pun tanpa
    // harus mengganti cabang aktif; selain itu dibatasi ke cabang sendiri.
    const scopedBranchId = payload.branchScope === 'ALL' ? null : payload.branchId
    const detail = await ReturService.getReturnDetail(returnId, scopedBranchId)
    if (!detail) {
      return NextResponse.json({ error: 'Retur tidak ditemukan' }, { status: 404 })
    }
    if (detail.cancelledAt) {
      return NextResponse.json({ error: 'Retur sudah dibatalkan sebelumnya' }, { status: 400 })
    }

    // PIN yang diverifikasi & stok/piutang yang dibalik mengikuti cabang retur itu sendiri,
    // bukan cabang aktif operator.
    const targetBranchId = detail.branchId

    // Verifikasi PIN Owner cabang retur
    const [ownerAssignment] = await db
      .select({ userId: ownerAssignments.userId })
      .from(ownerAssignments)
      .where(and(eq(ownerAssignments.branchId, targetBranchId), eq(ownerAssignments.isActive, true)))
      .limit(1)

    if (!ownerAssignment) {
      return NextResponse.json({ error: 'Owner tidak dikonfigurasi untuk cabang ini' }, { status: 404 })
    }

    const [owner] = await db
      .select({ pinHash: users.pinHash })
      .from(users)
      .where(eq(users.id, ownerAssignment.userId))
      .limit(1)

    if (!owner?.pinHash) {
      return NextResponse.json({ error: 'PIN Owner belum dikonfigurasi. Hubungi Administrator.' }, { status: 404 })
    }

    const isValidPin = await argon2.verify(owner.pinHash, pin)
    if (!isValidPin) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      return NextResponse.json({ error: 'PIN Owner tidak valid. Pembatalan dibatalkan.' }, { status: 400 })
    }

    const result = await ReturService.cancelReturn({
      returnId,
      branchId: targetBranchId,
      cancelledById: payload.userId,
      cancelReason: reason,
    })

    return NextResponse.json({ success: true, returnNumber: result.returnNumber })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal membatalkan retur'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
