import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { GroomingMasterError } from './services/grooming-master-service'

/** Baca badan JSON + validasi; kembalikan data atau NextResponse galat (415/400). */
export async function parseJsonBody<T extends z.ZodTypeAny>(req: NextRequest, schema: T): Promise<z.infer<T> | NextResponse> {
  if (!req.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
  }
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
  return parsed.data
}

export function groomingMasterErrorResponse(error: unknown, context: string): NextResponse {
  if (error instanceof GroomingMasterError) {
    return NextResponse.json(
      { error: error.message, code: error.code, ...(error.existingOwner ? { existingOwner: error.existingOwner } : {}) },
      { status: error.status },
    )
  }
  console.error(`${context} error:`, error)
  return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 })
}

export const idParam = z.string().regex(/^\d+$/, 'ID tidak valid')

const text = (label: string, max: number) =>
  z.string().trim().min(1, `${label} wajib diisi`).max(max, `${label} maksimal ${max} karakter`)

export const groomerNameSchema = text('Nama groomer', 100)

export const petFieldSchemas = {
  name: text('Nama kucing', 100),
  species: text('Jenis kucing', 60),
  color: text('Warna kucing', 60),
  ageYears: z.number().int().min(0, 'Umur tidak valid').max(40, 'Umur tidak valid').nullable().optional(),
  ageMonths: z.number().int().min(0, 'Umur tidak valid').max(11, 'Bulan maksimal 11').nullable().optional(),
}

export const newOwnerSchema = z.object({
  name: text('Nama pemilik', 100),
  phone: text('Nomor telepon pemilik', 20),
})
