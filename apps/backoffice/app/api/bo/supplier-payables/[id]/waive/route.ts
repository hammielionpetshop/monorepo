import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { loadPendingPriceEstimates } from '@/lib/po-pending-estimate'
import {
  db,
  supplierPayables,
  purchaseOrders,
  suppliers,
  auditLogs,
  eq,
  and,
} from '@/lib/db'

export const dynamic = 'force-dynamic'

const waiveSchema = z.object({
  reason: z
    .string({ message: 'Alasan wajib diisi' })
    .trim()
    .min(5, 'Alasan wajib diisi (minimal 5 huruf)')
    .max(500, 'Alasan maksimal 500 karakter'),
})

// Bebaskan hutang supplier = tagihan PO direlakan tanpa uang keluar (mis. barang modal owner yang
// dikembalikan rekan sebelum sistem ada). Hanya status yang berubah menjadi WAIVED: stok, batch,
// modal, dan nilai PO tetap utuh, Arus Kas tidak disentuh. Tidak bisa dibatalkan, jadi hanya untuk
// hutang yang nominalnya sudah final (PO Selesai, harga faktur lengkap) dan belum dibayar sama
// sekali; alasan + pelaku direkam di audit_logs (SUPPLIER_PAYABLE_WAIVED).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requirePermission('payable.supplier_waive')
    if (gate instanceof NextResponse) return gate
    const payload = gate

    const { id } = await params
    const payableId = Number.parseInt(id, 10)
    if (!Number.isInteger(payableId) || payableId <= 0) {
      return NextResponse.json({ error: 'ID hutang supplier tidak valid' }, { status: 400 })
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
        id: supplierPayables.id,
        poId: supplierPayables.poId,
        status: supplierPayables.status,
        totalAmount: supplierPayables.totalAmount,
        paidAmount: supplierPayables.paidAmount,
        poNumber: purchaseOrders.poNumber,
        poStatus: purchaseOrders.status,
        branchId: purchaseOrders.branchId,
        supplierName: suppliers.name,
      })
      .from(supplierPayables)
      .innerJoin(purchaseOrders, eq(supplierPayables.poId, purchaseOrders.id))
      .leftJoin(suppliers, eq(supplierPayables.supplierId, suppliers.id))
      .where(eq(supplierPayables.id, payableId))
      .limit(1)

    if (!payable) {
      return NextResponse.json({ error: 'Hutang supplier tidak ditemukan' }, { status: 404 })
    }

    if (payload.branchScope !== 'ALL' && payload.branchId !== payable.branchId) {
      return NextResponse.json({ error: 'Akses ditolak. Hutang ini milik cabang lain.' }, { status: 403 })
    }

    if (payable.status === 'WAIVED') {
      return NextResponse.json({ error: 'Hutang ini sudah dibebaskan sebelumnya' }, { status: 409 })
    }
    if (payable.status !== 'UNPAID' || payable.paidAmount !== 0) {
      return NextResponse.json(
        { error: 'Hutang yang sudah dibayar (sebagian atau lunas) tidak dapat dibebaskan' },
        { status: 409 }
      )
    }
    if (payable.poStatus !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Hutang hanya bisa dibebaskan setelah penerimaan PO disetujui (PO Selesai)' },
        { status: 409 }
      )
    }

    const pending = (await loadPendingPriceEstimates([payable.poId])).get(payable.poId)
    if (pending && pending.pendingItems > 0) {
      return NextResponse.json(
        { error: `Isi harga faktur dulu — ${pending.pendingItems} barang di PO ini belum ada harganya` },
        { status: 409 }
      )
    }

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(supplierPayables)
        .set({ status: 'WAIVED' })
        .where(
          and(
            eq(supplierPayables.id, payableId),
            eq(supplierPayables.status, 'UNPAID'),
            eq(supplierPayables.paidAmount, 0)
          )
        )
        .returning()

      if (!row) return null

      await tx.insert(auditLogs).values({
        branchId: payable.branchId,
        userId: payload.userId,
        action: 'SUPPLIER_PAYABLE_WAIVED',
        tableName: 'supplier_payables',
        recordId: String(payableId),
        oldData: JSON.stringify({ status: payable.status, paidAmount: payable.paidAmount }),
        newData: JSON.stringify({
          status: 'WAIVED',
          reason,
          poNumber: payable.poNumber,
          supplierName: payable.supplierName,
          totalAmount: row.totalAmount,
          waivedAmount: row.totalAmount,
        }),
      })

      return row
    })

    if (!updated) {
      return NextResponse.json(
        { error: 'Status hutang sudah berubah, silakan muat ulang halaman' },
        { status: 409 }
      )
    }

    return NextResponse.json({ id: updated.id, status: updated.status })
  } catch (error) {
    console.error('PATCH supplier-payables waive error:', error)
    return NextResponse.json({ error: 'Gagal membebaskan hutang supplier' }, { status: 500 })
  }
}
