import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { verifyAccessToken } from '@/lib/auth'
import { db, productUomConversions, eq } from '@/lib/db'

export const dynamic = 'force-dynamic'

const ALLOWED_MUTATE_ROLES = ['OWNER', 'GM']

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID produk tidak valid'),
  convId: z.string().regex(/^\d+$/, 'ID konversi tidak valid'),
})

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; convId: string }> }
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }
    if (!ALLOWED_MUTATE_ROLES.includes(payload.role)) {
      return NextResponse.json({ error: 'Akses ditolak. Hanya Owner dan GM yang dapat mengubah data master.' }, { status: 403 })
    }

    const { id, convId } = await params
    const paramParsed = paramsSchema.safeParse({ id, convId })
    if (!paramParsed.success) {
      return NextResponse.json({ error: paramParsed.error.issues[0]?.message ?? 'Parameter tidak valid' }, { status: 400 })
    }
    const productId = Number(paramParsed.data.id)
    const conversionId = Number(paramParsed.data.convId)

    // Cek entri ada DAN milik produk ini (cegah URL manipulation)
    const existing = await db
      .select({ id: productUomConversions.id, productId: productUomConversions.productId })
      .from(productUomConversions)
      .where(eq(productUomConversions.id, conversionId))
      .limit(1)

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Konversi UOM tidak ditemukan' }, { status: 404 })
    }
    if (existing[0].productId !== productId) {
      return NextResponse.json({ error: 'Konversi UOM tidak ditemukan' }, { status: 404 })
    }

    await db.delete(productUomConversions).where(eq(productUomConversions.id, conversionId))

    return NextResponse.json({ message: 'Konversi UOM berhasil dihapus' })
  } catch (error: unknown) {
    console.error('DELETE /api/bo/master-data/products/[id]/uom-conversions/[convId] error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menghapus konversi UOM' }, { status: 500 })
  }
}
