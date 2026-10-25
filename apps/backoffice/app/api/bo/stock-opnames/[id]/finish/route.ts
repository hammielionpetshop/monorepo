import { StockConflictError } from '@/lib/services/stock-validation'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { db, eq, sql, stockOpnameItems, stockOpnames } from '@/lib/db'
import { InsufficientStockError } from '@/lib/services/stock-service'
import { closeFullSoIfResolved } from '@/lib/services/stock-opname'

export const dynamic = 'force-dynamic'

// Selesaikan (tutup) SO Besar secara manual. Menggantikan penutupan otomatis lama:
// menyetujui tiap item cuma mengunci angka & memperbarui stoknya, lalu admin menutup
// dokumennya di sini begitu semua item sudah diputuskan. Syarat: SO Besar berstatus
// PENDING, punya item, dan tidak ada lagi item yang menunggu keputusan.
const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID tidak valid'),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const soId = Number(paramParsed.data.id)

    await db.transaction(async (tx) => {
      const soRows = await tx
        .select({
          id: stockOpnames.id,
          type: stockOpnames.type,
          status: stockOpnames.status,
          branchId: stockOpnames.branchId,
        })
        .from(stockOpnames)
        .where(eq(stockOpnames.id, soId))
        .for('update')
        .limit(1)

      if (soRows.length === 0) throw new Error('SO_NOT_FOUND')
      const so = soRows[0]

      if (so.type !== 'FULL') throw new Error('NOT_FULL_SO')
      if (so.status === 'DRAFT') throw new Error('STILL_COUNTING')
      if (so.status !== 'PENDING') throw new Error('ALREADY_PROCESSED')

      if (payload.branchScope !== 'ALL' && payload.branchId !== so.branchId) {
        throw new Error('BRANCH_FORBIDDEN')
      }

      const [counts] = await tx
        .select({
          total: sql<number>`count(*)::int`,
          pending: sql<number>`count(*) filter (where ${stockOpnameItems.itemStatus} = 'PENDING')::int`,
        })
        .from(stockOpnameItems)
        .where(eq(stockOpnameItems.soId, soId))

      const total = Number(counts?.total ?? 0)
      const pending = Number(counts?.pending ?? 0)

      if (total === 0) throw new Error('SO_HAS_NO_ITEMS')
      if (pending > 0) throw new Error(`HAS_PENDING:${pending}`)

      // Semua item sudah diputuskan → tutup dokumen + rekonsiliasi item MATCHED.
      const closed = await closeFullSoIfResolved(tx, soId, currentUserId)
      // Mustahil false di sini (pending sudah 0), tapi jaga-jaga balapan.
      if (!closed) throw new Error('HAS_PENDING:0')
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (error instanceof StockConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    if (error instanceof InsufficientStockError) {
      return NextResponse.json(
        {
          error: `Stok tidak cukup saat menyelesaikan SO — kemungkinan ada penjualan setelah dihitung. ${error.message} Lakukan hitung ulang produk terkait lalu coba lagi.`,
        },
        { status: 422 }
      )
    }

    if (error instanceof Error) {
      if (error.message === 'SO_NOT_FOUND') {
        return NextResponse.json({ error: 'Stock opname tidak ditemukan' }, { status: 404 })
      }
      if (error.message === 'NOT_FULL_SO') {
        return NextResponse.json({ error: 'Hanya SO Besar yang diselesaikan lewat aksi ini' }, { status: 400 })
      }
      if (error.message === 'STILL_COUNTING') {
        return NextResponse.json({ error: 'Stock opname masih dihitung di POS, belum bisa diselesaikan' }, { status: 400 })
      }
      if (error.message === 'ALREADY_PROCESSED') {
        return NextResponse.json({ error: 'Stock opname sudah selesai diproses' }, { status: 400 })
      }
      if (error.message === 'BRANCH_FORBIDDEN') {
        return NextResponse.json(
          { error: 'Akses ditolak. Anda hanya dapat menyelesaikan stock opname cabang Anda sendiri.' },
          { status: 403 }
        )
      }
      if (error.message === 'SO_HAS_NO_ITEMS') {
        return NextResponse.json({ error: 'Stock opname belum memiliki item, tidak dapat diselesaikan' }, { status: 400 })
      }
      if (error.message.startsWith('HAS_PENDING:')) {
        const n = Number(error.message.split(':')[1] || 0)
        return NextResponse.json(
          {
            error:
              n > 0
                ? `Masih ada ${n} item yang menunggu keputusan. Setujui atau tolak semua item dulu sebelum menyelesaikan SO.`
                : 'Masih ada item yang menunggu keputusan. Setujui atau tolak semua item dulu sebelum menyelesaikan SO.',
          },
          { status: 400 }
        )
      }
    }

    console.error('POST /api/bo/stock-opnames/[id]/finish error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menyelesaikan stock opname' }, { status: 500 })
  }
}
