import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { verifyAccessToken } from '@/lib/auth'
import {
  db,
  interBranchPayables,
  interBranchPayments,
  eq,
  sql,
} from '@/lib/db'

export const dynamic = 'force-dynamic'

const paySchema = z.object({
  amount: z.number().int().positive({ message: 'Jumlah pembayaran harus lebih dari 0' }),
  referenceNumber: z.string().max(100).optional(),
  notes: z.string().optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    if (!['OWNER', 'GM', 'MANAGER', 'FINANCE'].includes(payload.role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    const { id } = await params
    const payableId = parseInt(id)
    if (isNaN(payableId)) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }

    if (!req.headers.get('content-type')?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }

    const parsed = paySchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }

    const { amount, referenceNumber, notes } = parsed.data

    const [payable] = await db
      .select()
      .from(interBranchPayables)
      .where(eq(interBranchPayables.id, payableId))
      .limit(1)

    if (!payable) {
      return NextResponse.json({ error: 'Data hutang tidak ditemukan' }, { status: 404 })
    }

    if (payable.status === 'PAID' || payable.status === 'WAIVED') {
      return NextResponse.json({ error: 'Hutang ini sudah lunas atau telah dihapuskan' }, { status: 409 })
    }

    const remaining = payable.totalAmount - payable.paidAmount
    if (amount > remaining) {
      return NextResponse.json(
        { error: `Jumlah pembayaran (${amount}) melebihi sisa hutang (${remaining})` },
        { status: 400 }
      )
    }

    const result = await db.transaction(async (tx) => {
      await tx.insert(interBranchPayments).values({
        payableId,
        amount,
        paidByUserId: payload.userId,
        referenceNumber: referenceNumber ?? null,
        notes: notes ?? null,
      })

      const newPaid = payable.paidAmount + amount
      const newStatus = newPaid >= payable.totalAmount ? 'PAID' : 'PARTIAL'

      const [updated] = await tx
        .update(interBranchPayables)
        .set({
          paidAmount: sql`${interBranchPayables.paidAmount} + ${amount}`,
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(interBranchPayables.id, payableId))
        .returning()

      return updated
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('POST inter-branch-payables pay error:', error)
    return NextResponse.json({ error: 'Gagal mencatat pembayaran' }, { status: 500 })
  }
}
