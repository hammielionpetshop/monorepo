import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import Big from 'big.js'
import { verifyAccessToken } from '@/lib/auth'
import { db, productUomConversions, productPrices, productUomCosts, branches, eq, and } from '@/lib/db'

export const dynamic = 'force-dynamic'

const ALLOWED_MUTATE_ROLES = ['OWNER', 'GM']

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID produk tidak valid'),
  convId: z.string().regex(/^\d+$/, 'ID konversi tidak valid'),
})

const updateSchema = z.object({
  ratio: z.string().min(1, 'Ratio wajib diisi'),
  weightGram: z.string().optional().nullable(),
})

export async function PATCH(
  req: NextRequest,
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

    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }

    let ratioBig: Big
    try {
      ratioBig = new Big(parsed.data.ratio)
      if (ratioBig.lte(0)) throw new Error()
    } catch {
      return NextResponse.json({ error: 'Ratio harus lebih dari 0' }, { status: 400 })
    }

    // weightGram: tidak dikirim = tidak diubah; null/kosong = dikosongkan; string = di-set
    const updateValues: { ratio: number; weightGram?: number | null } = {
      ratio: Math.round(ratioBig.toNumber()),
    }
    if (parsed.data.weightGram !== undefined) {
      if (parsed.data.weightGram) {
        try {
          const w = new Big(parsed.data.weightGram)
          if (w.lte(0)) throw new Error()
          updateValues.weightGram = Math.round(w.toNumber())
        } catch {
          return NextResponse.json({ error: 'Berat harus lebih dari 0' }, { status: 400 })
        }
      } else {
        updateValues.weightGram = null
      }
    }

    const existing = await db
      .select({ id: productUomConversions.id, productId: productUomConversions.productId })
      .from(productUomConversions)
      .where(eq(productUomConversions.id, conversionId))
      .limit(1)

    if (existing.length === 0 || existing[0].productId !== productId) {
      return NextResponse.json({ error: 'Konversi UOM tidak ditemukan' }, { status: 404 })
    }

    const result = await db
      .update(productUomConversions)
      .set(updateValues)
      .where(eq(productUomConversions.id, conversionId))
      .returning()

    return NextResponse.json(result[0])
  } catch (error: unknown) {
    console.error('PATCH /api/bo/master-data/products/[id]/uom-conversions/[convId] error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat memperbarui konversi UOM' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
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
    const cascade = req.nextUrl.searchParams.get('cascade') === '1'

    // Cek entri ada DAN milik produk ini (cegah URL manipulation)
    const existing = await db
      .select({
        id: productUomConversions.id,
        productId: productUomConversions.productId,
        uomId: productUomConversions.uomId,
      })
      .from(productUomConversions)
      .where(eq(productUomConversions.id, conversionId))
      .limit(1)

    if (existing.length === 0 || existing[0].productId !== productId) {
      return NextResponse.json({ error: 'Konversi UOM tidak ditemukan' }, { status: 404 })
    }
    const uomId = existing[0].uomId

    // Konversi global — cek harga yang masih memakai satuan ini di semua cabang
    const priceBranchRows = await db
      .selectDistinct({ branchName: branches.name })
      .from(productPrices)
      .innerJoin(branches, eq(productPrices.branchId, branches.id))
      .where(and(eq(productPrices.productId, productId), eq(productPrices.uomId, uomId)))
    const branchNames = priceBranchRows.map((r) => r.branchName).sort()

    if (branchNames.length > 0 && !cascade) {
      return NextResponse.json(
        {
          error: `Satuan ini masih memiliki harga di cabang: ${branchNames.join(', ')}. Hapus akan ikut menghapus semua harga & modal satuan ini di semua cabang.`,
          branches: branchNames,
        },
        { status: 409 }
      )
    }

    await db.transaction(async (trx) => {
      await trx
        .delete(productPrices)
        .where(and(eq(productPrices.productId, productId), eq(productPrices.uomId, uomId)))
      await trx
        .delete(productUomCosts)
        .where(and(eq(productUomCosts.productId, productId), eq(productUomCosts.uomId, uomId)))
      await trx.delete(productUomConversions).where(eq(productUomConversions.id, conversionId))
    })

    return NextResponse.json({ message: 'Konversi UOM berhasil dihapus', affectedBranches: branchNames })
  } catch (error: unknown) {
    console.error('DELETE /api/bo/master-data/products/[id]/uom-conversions/[convId] error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menghapus konversi UOM' }, { status: 500 })
  }
}
