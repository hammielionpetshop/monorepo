import { db, unitsOfMeasure } from '@/lib/db'
import UomClient from './_components/uom-client'
import type { Uom } from './_components/types'

export const dynamic = 'force-dynamic'

export default async function UomPage() {
  let data: Uom[] = []
  let error: string | null = null

  try {
    data = await db
      .select({
        id: unitsOfMeasure.id,
        code: unitsOfMeasure.code,
        name: unitsOfMeasure.name,
        isBase: unitsOfMeasure.isBase,
      })
      .from(unitsOfMeasure)
      .orderBy(unitsOfMeasure.name)
  } catch (e) {
    console.error('UomPage error:', e)
    error = 'Terjadi kesalahan saat mengambil data satuan ukur'
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Manajemen Satuan Ukur</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Kelola daftar satuan ukur (UOM) produk</p>
      </div>
      <UomClient uoms={data} />
    </div>
  )
}
