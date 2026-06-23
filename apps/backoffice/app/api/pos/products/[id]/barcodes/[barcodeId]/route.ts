import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { verifyAccessTokenCached } from '@/lib/auth-cache'
import { db, productBarcodes, eq, and } from '@/lib/db'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID produk tidak valid'),
  barcodeId: z.string().regex(/^\d+$/, 'ID barcode tidak valid'),
})

// DELETE — hapus barcode tambahan (barcode utama di products.barcode tidak
// dihapus lewat endpoint ini).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; barcodeId: string }> }
) {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessTokenCached(token) : null
  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  }

  const parsed = paramsSchema.safeParse(await params)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Parameter tidak valid' }, { status: 400 })
  }
  const productId = Number(parsed.data.id)
  const barcodeId = Number(parsed.data.barcodeId)

  const deleted = await db
    .delete(productBarcodes)
    .where(and(eq(productBarcodes.id, barcodeId), eq(productBarcodes.productId, productId)))
    .returning({ id: productBarcodes.id })

  if (deleted.length === 0) {
    return NextResponse.json({ error: 'Barcode tidak ditemukan' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
