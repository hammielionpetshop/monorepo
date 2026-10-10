import { NextResponse } from 'next/server'
import { db, purchaseOrders, eq } from '@/lib/db'
import {
  createSupplierReturnRequest,
  supplierReturnErrorResponse,
  supplierReturnRequestSchema,
} from '@/lib/services/supplier-return-service'
import {
  listReturnablePoItemOptions,
  listReturnablePurchaseOrders,
  listSupplierOptions,
} from '@/lib/services/supplier-return-queries'

function positiveInt(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null
  const n = Number(value)
  return n > 0 ? n : null
}

/**
 * Isi form retur (dipakai POS & Back Office): tanpa parameter → daftar supplier;
 * `supplierId` → PO selesai milik supplier itu di cabang ini; `poId` → barang PO + sisa qty.
 */
export async function handleSupplierReturnOptions(req: Request, branchId: number) {
  try {
    const { searchParams } = new URL(req.url)
    const poId = positiveInt(searchParams.get('poId'))
    if (poId) {
      const [po] = await db.select({ branchId: purchaseOrders.branchId }).from(purchaseOrders).where(eq(purchaseOrders.id, poId)).limit(1)
      if (!po || po.branchId !== branchId) {
        return NextResponse.json({ error: 'PO tidak ditemukan di cabang ini' }, { status: 404 })
      }
      return NextResponse.json({ items: await listReturnablePoItemOptions(poId) })
    }
    const supplierId = positiveInt(searchParams.get('supplierId'))
    if (supplierId) {
      return NextResponse.json({ purchaseOrders: await listReturnablePurchaseOrders(supplierId, branchId) })
    }
    return NextResponse.json({ suppliers: await listSupplierOptions() })
  } catch (error) {
    console.error('GET supplier-returns/options error:', error)
    return NextResponse.json({ error: 'Gagal mengambil data form retur' }, { status: 500 })
  }
}

export async function handleSupplierReturnCreate(
  req: Request,
  ctx: { branchId: number; userId: number; source: 'POS' | 'BO' },
) {
  if (!req.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
  }
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
  }
  const parsed = supplierReturnRequestSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
  }
  try {
    const created = await createSupplierReturnRequest({ input: parsed.data, ...ctx })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    const known = supplierReturnErrorResponse(error)
    if (known) return NextResponse.json({ error: known.error }, { status: known.status })
    console.error('POST supplier-returns error:', error)
    return NextResponse.json({ error: 'Gagal mengajukan retur supplier' }, { status: 500 })
  }
}
