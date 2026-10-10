import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import {
  db,
  interBranchPayables,
  interBranchTransfers,
  auditLogs,
  eq,
  and,
  sql,
} from '@/lib/db'

export const dynamic = 'force-dynamic'

const waiveSchema = z.object({
  reason: z
    .string({ message: 'Alasan penghapusan wajib diisi' })
    .trim()
    .min(5, 'Alasan penghapusan wajib diisi (minimal 5 huruf)')
    .max(500, 'Alasan maksimal 500 karakter'),
})

// Hapus hutang = cabang pengirim (kreditur) merelakan sisa tagihan. Hanya status yang berubah:
// stok, nota Bulk Sale, dan pembayaran yang sudah masuk TIDAK ikut dibalik. Karena tidak bisa
// dibatalkan, alasannya wajib dan pelaku + waktunya direkam di audit_logs (IBP_WAIVED).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requirePermission('payable.waive')
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

    const parsed = waiveSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }
    const { reason } = parsed.data

    const [payable] = await db
      .select({
        id: interBranchPayables.id,
        status: interBranchPayables.status,
        creditorBranchId: interBranchPayables.creditorBranchId,
        debtorBranchId: interBranchPayables.debtorBranchId,
        totalAmount: interBranchPayables.totalAmount,
        paidAmount: interBranchPayables.paidAmount,
        notes: interBranchPayables.notes,
        ibtNumber: interBranchTransfers.ibtNumber,
      })
      .from(interBranchPayables)
      .leftJoin(interBranchTransfers, eq(interBranchPayables.transferId, interBranchTransfers.id))
      .where(eq(interBranchPayables.id, payableId))
      .limit(1)

    if (!payable) {
      return NextResponse.json({ error: 'Data hutang tidak ditemukan' }, { status: 404 })
    }

    // Yang merelakan tagihan adalah cabang pengirim (kreditur), jadi non-global hanya boleh
    // menghapus hutang yang piutangnya milik cabangnya sendiri.
    if (payload.branchScope !== 'ALL' && payload.branchId !== payable.creditorBranchId) {
      return NextResponse.json(
        { error: 'Akses ditolak. Hanya cabang pengirim (pemilik piutang) yang dapat menghapus hutang ini.' },
        { status: 403 }
      )
    }

    if (payable.status === 'PAID') {
      return NextResponse.json({ error: 'Hutang yang sudah lunas tidak dapat dihapuskan' }, { status: 409 })
    }

    if (payable.status === 'WAIVED') {
      return NextResponse.json({ error: 'Hutang ini sudah dihapuskan sebelumnya' }, { status: 409 })
    }

    const waivedNote = `Dihapus: ${reason}`
    const newNotes = (payable.notes?.trim() ? `${payable.notes.trim()}\n${waivedNote}` : waivedNote)

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(interBranchPayables)
        .set({
          status: 'WAIVED',
          notes: newNotes,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(interBranchPayables.id, payableId),
            sql`${interBranchPayables.status} NOT IN ('PAID', 'WAIVED')`
          )
        )
        .returning()

      if (!row) return null

      await tx.insert(auditLogs).values({
        branchId: payable.creditorBranchId,
        userId: payload.userId,
        action: 'IBP_WAIVED',
        tableName: 'inter_branch_payables',
        recordId: String(payableId),
        oldData: JSON.stringify({ status: payable.status, notes: payable.notes }),
        newData: JSON.stringify({
          status: 'WAIVED',
          reason,
          ibtNumber: payable.ibtNumber,
          totalAmount: payable.totalAmount,
          paidAmount: payable.paidAmount,
          waivedAmount: payable.totalAmount - payable.paidAmount,
        }),
      })

      return row
    })

    if (!updated) {
      return NextResponse.json(
        { error: 'Status hutang sudah berubah, silakan refresh halaman' },
        { status: 409 }
      )
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH inter-branch-payables waive error:', error)
    return NextResponse.json({ error: 'Gagal menghapuskan hutang' }, { status: 500 })
  }
}
