import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import {
  BaseUomChangeError, executeBaseUomChange, previewBaseUomChange,
} from '@/lib/services/base-uom-change-service'

export const dynamic = 'force-dynamic'

const schema = z.object({
  mode: z.enum(['preview', 'execute']),
  productId: z.number().int().positive(),
  newBaseUomId: z.number().int().positive(),
  ratio: z.number().int('Isi harus angka bulat'),
  signature: z.string().optional(),
  confirmName: z.string().optional(),
})

// Ganti satuan dasar produk ke satuan lebih kecil (Inventori › Migrasi Satuan Stok).
// mode=preview hanya membaca; mode=execute menjalankan semuanya dalam satu transaksi.
export async function POST(req: NextRequest) {
  const gate = await requirePermission('master.product.manage')
  if (gate instanceof NextResponse) return gate

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
  }
  const { mode, productId, newBaseUomId, ratio, signature, confirmName } = parsed.data

  try {
    if (mode === 'preview') {
      return NextResponse.json({ plan: await previewBaseUomChange({ productId, newBaseUomId, ratio }) })
    }

    if (!signature) {
      return NextResponse.json({ error: 'Lihat pratinjau dulu sebelum menjalankan' }, { status: 400 })
    }
    const preview = await previewBaseUomChange({ productId, newBaseUomId, ratio })
    if ((confirmName ?? '').trim().toLowerCase() !== preview.product.name.trim().toLowerCase()) {
      return NextResponse.json({ error: 'Nama barang yang diketik tidak sama. Ketik persis nama barangnya.' }, { status: 400 })
    }

    const plan = await executeBaseUomChange(
      { productId, newBaseUomId, ratio, signature },
      { userId: gate.userId, branchId: gate.branchId ?? null },
    )
    return NextResponse.json({ plan })
  } catch (error: unknown) {
    if (error instanceof BaseUomChangeError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('POST /api/bo/inventory/stock-uom/base-change error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengganti satuan dasar. Tidak ada data yang berubah.' }, { status: 500 })
  }
}
