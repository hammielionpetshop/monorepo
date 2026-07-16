import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import {
  db,
  interBranchPayables,
  interBranchPayments,
  eq,
  and,
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
    const gate = await requirePermission('payable.pay')
    if (gate instanceof NextResponse) return gate
    const payload = gate

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

    // Non-global role hanya boleh mencatat pembayaran untuk hutang cabang sendiri (sebagai debitur)
    const isGlobal = payload.branchScope === 'ALL'
    if (!isGlobal && payload.branchId !== payable.debtorBranchId) {
      return NextResponse.json(
        { error: 'Akses ditolak. Anda hanya dapat mencatat pembayaran untuk hutang cabang Anda.' },
        { status: 403 }
      )
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
      const [updated] = await tx
        .update(interBranchPayables)
        .set({
          paidAmount: sql`${interBranchPayables.paidAmount} + ${amount}`,
          status: sql`CASE WHEN ${interBranchPayables.paidAmount} + ${amount} >= ${interBranchPayables.totalAmount} THEN 'PAID' ELSE 'PARTIAL' END`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(interBranchPayables.id, payableId),
            sql`${interBranchPayables.status} NOT IN ('PAID', 'WAIVED')`,
            sql`${interBranchPayables.paidAmount} + ${amount} <= ${interBranchPayables.totalAmount}`
          )
        )
        .returning()

      if (!updated) throw new Error('PAYMENT_CONFLICT')

      await tx.insert(interBranchPayments).values({
        payableId,
        amount,
        paidByUserId: payload.userId,
        referenceNumber: referenceNumber ?? null,
        notes: notes ?? null,
      })

      return updated
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Error && error.message === 'PAYMENT_CONFLICT') {
      return NextResponse.json(
        { error: 'Sisa hutang sudah berubah, silakan refresh halaman' },
        { status: 409 }
      )
    }
    console.error('POST inter-branch-payables pay error:', error)
    return NextResponse.json({ error: 'Gagal mencatat pembayaran' }, { status: 500 })
  }
}
