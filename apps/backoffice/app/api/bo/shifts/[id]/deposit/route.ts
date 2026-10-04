import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db, shifts, auditLogs, eq } from '@/lib/db'
import { requirePermission } from '@/lib/authz'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  receivedCash: z
    .number({ message: 'Jumlah kas diterima wajib diisi' })
    .int('Jumlah kas diterima harus bilangan bulat')
    .min(0, 'Jumlah kas diterima tidak boleh negatif'),
  notes: z.string().trim().max(500, 'Catatan maksimal 500 karakter').optional(),
})

const CORRECTOR_ROLES = ['OWNER', 'GM']

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePermission('shift.deposit.verify')
    if (gate instanceof NextResponse) return gate
    const payload = gate

    const { id } = await params
    const shiftId = parseInt(id)
    if (isNaN(shiftId)) {
      return NextResponse.json({ error: 'ID shift tidak valid' }, { status: 400 })
    }

    if (!req.headers.get('content-type')?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }
    const { receivedCash } = parsed.data
    const notes = parsed.data.notes || null

    const result = await db.transaction(async (trx) => {
      const [shift] = await trx
        .select()
        .from(shifts)
        .where(eq(shifts.id, shiftId))
        .for('update')

      if (!shift) throw new Error('NOT_FOUND')
      if (payload.branchScope !== 'ALL' && shift.branchId !== payload.branchId) throw new Error('FORBIDDEN_BRANCH')
      if (shift.status === 'OPEN') throw new Error('SHIFT_OPEN')
      if (shift.origin === 'BACKOFFICE') throw new Error('NO_DRAWER')
      // Verifikasi adalah tanda tangan finance atas uang yang diterima. Mengubahnya
      // belakangan sama dengan mengubah bukti serah-terima, jadi hanya atasan yang boleh.
      if (shift.depositVerifiedAt && !CORRECTOR_ROLES.includes(payload.role)) throw new Error('ALREADY_VERIFIED')

      // Shift tutup paksa tidak punya angka hitungan kasir; pembandingnya kas sistem.
      const cashierFigure = shift.totalClosingCashReal ?? shift.totalClosingCashExpected ?? 0
      const depositVariance = receivedCash - cashierFigure

      if (depositVariance !== 0 && !notes) throw new Error('NOTES_REQUIRED')

      const now = new Date()
      const [updated] = await trx
        .update(shifts)
        .set({
          depositReceivedCash: receivedCash,
          depositVariance,
          depositVerifiedById: payload.userId,
          depositVerifiedAt: now,
          depositNotes: notes,
        })
        .where(eq(shifts.id, shiftId))
        .returning()

      await trx.insert(auditLogs).values({
        branchId: shift.branchId,
        userId: payload.userId,
        action: shift.depositVerifiedAt ? 'SHIFT_DEPOSIT_CORRECT' : 'SHIFT_DEPOSIT_VERIFY',
        tableName: 'shifts',
        recordId: String(shiftId),
        oldData: shift.depositVerifiedAt
          ? JSON.stringify({
              depositReceivedCash: shift.depositReceivedCash,
              depositVariance: shift.depositVariance,
              depositVerifiedById: shift.depositVerifiedById,
              depositVerifiedAt: shift.depositVerifiedAt,
              depositNotes: shift.depositNotes,
            })
          : null,
        newData: JSON.stringify({ depositReceivedCash: receivedCash, depositVariance, cashierFigure, depositNotes: notes }),
      })

      return updated
    })

    return NextResponse.json({
      depositReceivedCash: result.depositReceivedCash,
      depositVariance: result.depositVariance,
      depositVerifiedAt: result.depositVerifiedAt,
      depositVerifiedByName: payload.userName,
      depositNotes: result.depositNotes,
    })
  } catch (error: unknown) {
    if (error instanceof Error) {
      switch (error.message) {
        case 'NOT_FOUND':
          return NextResponse.json({ error: 'Shift tidak ditemukan' }, { status: 404 })
        case 'FORBIDDEN_BRANCH':
          return NextResponse.json({ error: 'Shift ini bukan milik cabang Anda' }, { status: 403 })
        case 'SHIFT_OPEN':
          return NextResponse.json({ error: 'Shift masih berjalan — setoran baru bisa diverifikasi setelah shift ditutup' }, { status: 400 })
        case 'NO_DRAWER':
          return NextResponse.json({ error: 'Shift backoffice (bulk sale) tidak punya laci kas untuk disetorkan' }, { status: 400 })
        case 'ALREADY_VERIFIED':
          return NextResponse.json({ error: 'Setoran shift ini sudah diverifikasi. Koreksi hanya bisa dilakukan Owner/GM' }, { status: 409 })
        case 'NOTES_REQUIRED':
          return NextResponse.json({ error: 'Kas diterima berbeda dengan setoran kasir — catatan wajib diisi' }, { status: 400 })
      }
    }
    console.error('[bo/shifts/[id]/deposit] POST error:', error)
    return NextResponse.json({ error: 'Gagal menyimpan verifikasi setoran' }, { status: 500 })
  }
}
