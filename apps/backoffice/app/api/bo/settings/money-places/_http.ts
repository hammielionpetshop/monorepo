import { NextResponse } from 'next/server'
import { z } from 'zod'
import { MoneyPlaceError } from '@/lib/services/money-place-service'

const optionalText = (label: string, max: number) =>
  z.string().trim().max(max, `${label} maksimal ${max} karakter`).nullable().optional()

export const moneyPlaceSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi').max(100, 'Nama maksimal 100 karakter'),
  kind: z.enum(['CASH', 'BANK'], { message: 'Jenis harus Tunai atau Rekening' }),
  branchId: z.number().int().positive('Cabang wajib dipilih'),
  bankName: optionalText('Nama bank', 50),
  accountNumber: optionalText('Nomor rekening', 50),
  accountHolder: optionalText('Atas nama', 100),
  heldBy: z.enum(['FINANCE', 'STORE', 'OTHER'], { message: 'Pilih dipegang oleh' }),
  holderNote: optionalText('Catatan pemegang', 100),
  sortOrder: z.number().int().min(0).max(9999).optional(),
})

export const idParam = z.string().regex(/^\d+$/, 'ID tidak valid')

export function moneyPlaceErrorResponse(error: unknown, context: string): NextResponse {
  if (error instanceof MoneyPlaceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
  }
  console.error(`${context} error:`, error)
  return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 })
}
