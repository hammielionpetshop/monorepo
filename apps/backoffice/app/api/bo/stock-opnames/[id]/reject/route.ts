import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { and, db, eq, stockOpnameItems, stockOpnames } from '@/lib/db'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID tidak valid'),
})

const rejectSchema = z.object({
  reason: z.string().trim().min(1, 'Alasan penolakan wajib diisi').max(500, 'Alasan maksimal 500 karakter'),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePermission('stock_opname.approve')
    if (gate instanceof NextResponse) return gate
    const payload = gate

    const currentUserId = Number(payload.userId)
    if (Number.isNaN(currentUserId)) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const { id } = await params
    const paramParsed = paramsSchema.safeParse({ id })
    if (!paramParsed.success) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }
    const targetId = Number(paramParsed.data.id)

    const contentType = req.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
    }

    const parsed = rejectSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }

    await db.transaction(async (tx) => {
      const soRows = await tx
        .select({
          id: stockOpnames.id,
          type: stockOpnames.type,
          status: stockOpnames.status,
          branchId: stockOpnames.branchId,
        })
        .from(stockOpnames)
        .where(eq(stockOpnames.id, targetId))
        .for('update')
        .limit(1)

      if (soRows.length === 0) {
        throw new Error('SO_NOT_FOUND')
      }

      // DRAFT ikut boleh ditolak: itulah jalan membatalkan SO Besar yang salah dibuat.
      // Tanpa ini SO tersangkut selamanya sekaligus memblokir pembuatan SO baru,
      // karena DRAFT dihitung sebagai SO aktif.
      if (soRows[0].status !== 'PENDING' && soRows[0].status !== 'DRAFT') {
        throw new Error('ALREADY_PROCESSED')
      }

      if (payload.branchScope !== 'ALL' && payload.branchId !== soRows[0].branchId) {
        throw new Error('BRANCH_FORBIDDEN')
      }

      const now = new Date()

      // SO Besar yang sudah punya item boleh dibatalkan borongan SELAMA belum ada item
      // yang disetujui. Begitu satu item APPROVED, stok cabang sudah bergeser karenanya —
      // membatalkan headernya cuma akan meninggalkan catatan yang menyimpang dari stok
      // sebenarnya, jadi sisanya wajib diselesaikan per item lewat /items/decide.
      if (soRows[0].type === 'FULL' && soRows[0].status === 'PENDING') {
        const approved = await tx
          .select({ id: stockOpnameItems.id })
          .from(stockOpnameItems)
          .where(and(eq(stockOpnameItems.soId, targetId), eq(stockOpnameItems.itemStatus, 'APPROVED')))
          .limit(1)

        if (approved.length > 0) {
          throw new Error('HAS_APPROVED_ITEMS')
        }

        // Item yang masih PENDING ikut ditutup. Bukan sekadar kerapian: selama masih ada
        // item PENDING, POS tetap bisa mengirim hitung ulang ke SO yang sudah dibatalkan.
        // Item MATCHED sengaja dibiarkan — "cocok" itu fakta tentang hitungannya, benar
        // juga pada SO yang batal, dan tidak ada jalur yang bisa menyentuhnya lagi.
        // Jejaknya cukup di decisionNote + header (rejectedById/rejectedAt); tidak
        // menulis auditLogs per item supaya membatalkan SO ratusan item tidak
        // membanjiri tabel audit.
        await tx
          .update(stockOpnameItems)
          .set({
            itemStatus: 'REJECTED',
            decidedById: currentUserId,
            decidedAt: now,
            decisionNote: `Dibatalkan bersama SO: ${parsed.data.reason}`,
          })
          .where(and(eq(stockOpnameItems.soId, targetId), eq(stockOpnameItems.itemStatus, 'PENDING')))
      }

      await tx
        .update(stockOpnames)
        .set({
          status: 'REJECTED',
          rejectedById: currentUserId,
          rejectedAt: now,
          rejectionNote: parsed.data.reason,
          completedAt: now,
        })
        .where(eq(stockOpnames.id, targetId))
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'SO_NOT_FOUND') {
        return NextResponse.json({ error: 'Stock opname tidak ditemukan' }, { status: 404 })
      }
      if (error.message === 'ALREADY_PROCESSED') {
        return NextResponse.json({ error: 'Stock opname sudah diproses sebelumnya' }, { status: 400 })
      }
      if (error.message === 'HAS_APPROVED_ITEMS') {
        return NextResponse.json(
          {
            error:
              'SO Besar ini sudah punya item yang disetujui, stoknya sudah berubah. Selesaikan sisa itemnya per item lewat halaman Review, bukan dibatalkan.',
          },
          { status: 409 }
        )
      }
      if (error.message === 'BRANCH_FORBIDDEN') {
        return NextResponse.json({ error: 'Akses ditolak. Anda hanya dapat menolak stock opname cabang Anda sendiri.' }, { status: 403 })
      }
    }
    console.error('PATCH /api/bo/stock-opnames/[id]/reject error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menolak stock opname' }, { status: 500 })
  }
}
