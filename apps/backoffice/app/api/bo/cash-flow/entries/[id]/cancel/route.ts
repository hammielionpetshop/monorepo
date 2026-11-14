import { NextRequest, NextResponse } from 'next/server'
import { closedMonthMessage } from '@/lib/db-errors'
import { z } from 'zod'
import { getAuth, hasPermission } from '@/lib/authz'
import { todayWibDate } from '@/lib/payment-date'
import { checkCancel } from '@/lib/services/cash-flow-rules'
import { createdOnWibSql } from '@/lib/services/cash-flow-sql'
import { db, cashFlowEntries, cashFlowCategories, recurringCostPayments, eq, and, isNull, sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  reason: z.string({ message: 'Alasan pembatalan wajib diisi' }).trim().min(3, 'Alasan pembatalan wajib diisi (minimal 3 huruf)').max(255),
})

class CancelError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

/** Batalkan catatan Arus Kas (F2-4b): tidak dihapus, tetap terlihat bertanda Batal. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuth()
    if (!payload) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    if (!hasPermission(payload, 'cashflow.record') && !hasPermission(payload, 'cashflow.cancel')) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }
    const { id } = await params
    const entryId = Number(id)
    if (!Number.isInteger(entryId) || entryId <= 0) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
    }
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })

    await db.transaction(async (trx) => {
      const [entry] = await trx
        .select({
          createdBy: cashFlowEntries.createdBy,
          createdOn: createdOnWibSql,
          cancelledAt: cashFlowEntries.cancelledAt,
          categoryId: cashFlowEntries.categoryId,
        })
        .from(cashFlowEntries)
        .where(eq(cashFlowEntries.id, entryId))
        .for('update')
        .limit(1)
      if (!entry) throw new CancelError('Catatan tidak ditemukan', 404)
      const [category] = await trx
        .select({ isSystem: cashFlowCategories.isSystem })
        .from(cashFlowCategories)
        .where(eq(cashFlowCategories.id, entry.categoryId))
        .limit(1)
      // Catatan dari Biaya Rutin dibatalkan lewat layar Biaya Rutin supaya tagihannya ikut terbuka lagi.
      const [fromRecurring] = await trx
        .select({ id: recurringCostPayments.id })
        .from(recurringCostPayments)
        .where(eq(recurringCostPayments.cashFlowEntryId, entryId))
        .limit(1)
      const error = checkCancel({
        isCancelled: entry.cancelledAt !== null,
        isSystemCategory: (category?.isSystem ?? false) || !!fromRecurring,
        createdBy: entry.createdBy,
        createdOn: entry.createdOn,
        actorId: payload.userId,
        actorCanCancelAny: hasPermission(payload, 'cashflow.cancel'),
        today: todayWibDate(),
      })
      if (error) throw new CancelError(error, 409)
      const updated = await trx
        .update(cashFlowEntries)
        .set({ cancelledAt: sql`now()`, cancelledBy: payload.userId, cancelReason: parsed.data.reason })
        .where(and(eq(cashFlowEntries.id, entryId), isNull(cashFlowEntries.cancelledAt)))
        .returning({ id: cashFlowEntries.id })
      if (updated.length === 0) throw new CancelError('Catatan ini sudah dibatalkan', 409)
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    const closedMonth = closedMonthMessage(error)
    if (closedMonth) return NextResponse.json({ error: closedMonth }, { status: 409 })
    if (error instanceof CancelError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('POST /api/bo/cash-flow/entries/[id]/cancel error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat membatalkan catatan' }, { status: 500 })
  }
}
