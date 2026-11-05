import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createGroomingHold, listGroomingHolds } from '@/lib/services/grooming-hold-service'
import { GROOMING_CONDITION_MAX, DELIVERY_ADDRESS_MAX } from '@/lib/services/grooming-order-service'
import { groomingOrderErrorResponse, requireGroomingPos, wibDayStart } from '@/lib/grooming-order-http'
import { MANUAL_DISCOUNT_NOTE_MAX } from '@/lib/manual-discount'

export const dynamic = 'force-dynamic'

const DAY_MS = 24 * 60 * 60 * 1000

const createSchema = z.object({
  customerId: z.number().int().positive('Pilih pemilik kucing dulu'),
  lines: z
    .array(
      z.object({
        petId: z.number().int().positive(),
        productId: z.number().int().positive(),
        groomerId: z.number().int().positive('Pilih groomer yang mengerjakan'),
        condition: z.string().trim().min(1, 'Kondisi kucing wajib diisi').max(GROOMING_CONDITION_MAX, 'Kondisi kucing terlalu panjang'),
        discount: z
          .object({
            mode: z.enum(['PER_PCS', 'PER_BARIS', 'PERSEN']),
            value: z.number().positive(),
            reasonCode: z.string().trim().min(1).max(30),
            reasonNote: z.string().trim().max(MANUAL_DISCOUNT_NOTE_MAX).optional().nullable(),
          })
          .optional()
          .nullable(),
      }),
    )
    .min(1, 'Belum ada kucing di daftar')
    .max(20, 'Terlalu banyak kucing dalam satu tahanan'),
  delivery: z
    .object({
      courierId: z.number().int().positive('Pilih pengantar-jemputnya'),
      address: z.string().trim().min(1, 'Alamat delivery wajib diisi').max(DELIVERY_ADDRESS_MAX, 'Alamat terlalu panjang'),
      qty: z.number().int().positive('Isi qty ongkos kirim'),
      free: z.boolean(),
    })
    .nullable(),
})

// Grooming Ditahan di kasir (docs/work/specs/2026-11-05-grooming-tahan-design.md).
//   GET  ?view=aktif   → tahanan yang masih menunggu nota (tampil di "Sedang Dikerjakan")
//   GET  ?view=selesai → tahanan yang dibatalkan; ?from=&to= (YYYY-MM-DD, WIB)
//   POST               → simpan tahanan (tanpa shift — belum ada uang)
export async function GET(req: NextRequest) {
  try {
    const gate = await requireGroomingPos()
    if (gate instanceof NextResponse) return gate
    const { searchParams } = req.nextUrl
    const from = wibDayStart(searchParams.get('from'))
    const toDay = wibDayStart(searchParams.get('to'))
    return NextResponse.json(await listGroomingHolds({
      branchId: gate.branchId,
      view: searchParams.get('view') === 'selesai' ? 'SELESAI' : 'AKTIF',
      q: (searchParams.get('q') ?? '').slice(0, 100) || undefined,
      from: from ?? undefined,
      to: toDay ? new Date(toDay.getTime() + DAY_MS) : undefined,
    }))
  } catch (error) {
    return groomingOrderErrorResponse(error, 'GET /api/pos/grooming/holds')
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requireGroomingPos()
    if (gate instanceof NextResponse) return gate
    const parsed = createSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tahanan tidak valid' }, { status: 400 })
    }
    return NextResponse.json(await createGroomingHold(parsed.data, gate), { status: 201 })
  } catch (error) {
    return groomingOrderErrorResponse(error, 'POST /api/pos/grooming/holds')
  }
}
