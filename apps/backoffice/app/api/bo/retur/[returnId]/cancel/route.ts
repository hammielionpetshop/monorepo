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

    // Verifikasi PIN Owner
    const [ownerAssignment] = await db
      .select({ userId: ownerAssignments.userId })
      .from(ownerAssignments)
      .where(and(eq(ownerAssignments.branchId, payload.branchId), eq(ownerAssignments.isActive, true)))
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
      branchId: payload.branchId,
      cancelledById: payload.userId,
      cancelReason: reason,
    })

    return NextResponse.json({ success: true, returnNumber: result.returnNumber })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal membatalkan retur'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
