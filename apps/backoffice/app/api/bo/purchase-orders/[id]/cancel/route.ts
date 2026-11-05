import { NextResponse } from 'next/server'
import * as argon2 from 'argon2'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { db, purchaseOrders, ownerAssignments, users, eq, and } from '@/lib/db'
import {
  PoCancelError,
  cancelCompletedPurchaseOrder,
  cancelOpenPurchaseOrder,
  checkCompletedCancellation,
} from '@/lib/services/po-cancel-service'
import { StockConflictError } from '@/lib/services/stock-validation'

export const dynamic = 'force-dynamic'

const cancelSchema = z.object({
  reason: z
    .string({ message: 'Alasan pembatalan wajib diisi' })
    .trim()
    .min(5, 'Alasan pembatalan wajib diisi (minimal 5 huruf)')
    .max(500, 'Alasan maksimal 500 karakter'),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN Owner 4–6 angka').optional(),
})

function parsePoId(id: string) {
  return /^\d+$/.test(id) ? Number.parseInt(id, 10) : null
}

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof PoCancelError) return NextResponse.json({ error: error.message }, { status: error.status })
  if (error instanceof StockConflictError) return NextResponse.json({ error: error.message }, { status: 409 })
  console.error(fallback, error)
  return NextResponse.json({ error: fallback }, { status: 500 })
}

/** Syarat batal PO Selesai untuk ditampilkan di panduan sebelum admin memasukkan PIN. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requirePermission('po.approve')
    if (gate instanceof NextResponse) return gate
    const poId = parsePoId((await params).id)
    if (!poId) return NextResponse.json({ error: 'ID Purchase Order tidak valid' }, { status: 400 })

    const scopeBranchId = gate.branchScope === 'ALL' ? null : gate.branchId
    return NextResponse.json(await db.transaction(tx => checkCompletedCancellation(tx, poId, scopeBranchId)))
  } catch (error) {
    return errorResponse(error, 'Gagal memeriksa syarat pembatalan PO')
  }
}

async function verifyOwnerPin(branchId: number, pin: string): Promise<string | null> {
  const [assignment] = await db
    .select({ userId: ownerAssignments.userId })
    .from(ownerAssignments)
    .where(and(eq(ownerAssignments.branchId, branchId), eq(ownerAssignments.isActive, true)))
    .limit(1)
  if (!assignment) return 'Owner belum diatur untuk cabang PO ini. Hubungi Administrator.'

  const [owner] = await db.select({ pinHash: users.pinHash }).from(users).where(eq(users.id, assignment.userId)).limit(1)
  if (!owner?.pinHash) return 'PIN Owner belum diatur. Hubungi Administrator.'

  if (!(await argon2.verify(owner.pinHash, pin))) {
    await new Promise(resolve => setTimeout(resolve, 1000))
    return 'PIN Owner salah. PO tidak dibatalkan.'
  }
  return null
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requirePermission('po.approve')
    if (gate instanceof NextResponse) return gate
    const poId = parsePoId((await params).id)
    if (!poId) return NextResponse.json({ error: 'ID Purchase Order tidak valid' }, { status: 400 })

    const parsed = cancelSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }
    const { reason, pin } = parsed.data

    const scopeBranchId = gate.branchScope === 'ALL' ? null : gate.branchId
    const scoped = scopeBranchId === null
      ? eq(purchaseOrders.id, poId)
      : and(eq(purchaseOrders.id, poId), eq(purchaseOrders.branchId, scopeBranchId))
    const [po] = await db
      .select({ status: purchaseOrders.status, branchId: purchaseOrders.branchId })
      .from(purchaseOrders)
      .where(scoped)
      .limit(1)
    if (!po) return NextResponse.json({ error: 'Purchase Order tidak ditemukan' }, { status: 404 })

    const input = { poId, actorUserId: gate.userId, reason, scopeBranchId }

    if (po.status === 'COMPLETED') {
      if (!pin) return NextResponse.json({ error: 'PIN Owner wajib diisi untuk membatalkan PO Selesai' }, { status: 400 })
      // PIN mengikuti Owner cabang PO itu sendiri, bukan cabang yang sedang dibuka operator.
      const pinError = await verifyOwnerPin(po.branchId, pin)
      if (pinError) return NextResponse.json({ error: pinError }, { status: 400 })
      const result = await db.transaction(tx => cancelCompletedPurchaseOrder(tx, input))
      return NextResponse.json({
        success: true,
        message: `${result.poNumber} dibatalkan. Stok ditarik kembali dan hutang supplier ditandai Dihapus.`,
      })
    }

    const result = await db.transaction(tx => cancelOpenPurchaseOrder(tx, input))
    return NextResponse.json({ success: true, message: `${result.poNumber} dibatalkan.` })
  } catch (error) {
    return errorResponse(error, 'Gagal membatalkan Purchase Order')
  }
}
