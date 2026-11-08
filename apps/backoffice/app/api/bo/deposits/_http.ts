import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { JWTPayload } from '@petshop/shared'
import { requirePermission } from '@/lib/authz'
import { proofPhotoUrlSchema } from '@/lib/proof-photo'
import { DepositError, type DepositActor } from '@/lib/services/deposit-service'

// Bantuan rute F2-2 Setoran (BO & POS).

export const idParam = z.string().regex(/^\d+$/, 'ID tidak valid')
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal tidak valid')
const rupiah = (label: string) =>
  z.number({ message: `${label} wajib diisi` }).int(`${label} harus rupiah bulat`).min(0, `${label} tidak boleh negatif`)

export const varianceLineSchema = z.object({
  amount: z.number().int('Nominal sebab harus rupiah bulat'),
  cause: z.enum(['BANK_FEE', 'CASHIER_SHORT', 'CASHIER_OVER', 'OTHER'], { message: 'Sebab selisih tidak valid' }),
  shiftId: z.number().int().positive().nullable().optional(),
  cashierId: z.number().int().positive().nullable().optional(),
  note: z.string().trim().max(255, 'Catatan maksimal 255 karakter').nullable().optional(),
})

export const verifySchema = z.object({
  receivedAmount: rupiah('Nominal diterima'),
  variances: z.array(varianceLineSchema).max(20),
  destinationMoneyPlaceId: z.number().int().positive().nullable().optional(),
  notes: z.string().trim().max(500, 'Catatan maksimal 500 karakter').nullable().optional(),
})

export const reportSchema = z.object({
  shiftIds: z.array(z.number().int().positive()).min(1, 'Pilih minimal satu shift').max(60),
  destinationMoneyPlaceId: z.number().int().positive('Pilih rekening tujuan'),
  reportedAmount: rupiah('Nominal setor'),
  depositDate: isoDate,
  slipPhotoUrl: proofPhotoUrlSchema.nullable(),
  notes: z.string().trim().max(500, 'Catatan maksimal 500 karakter').nullable().optional(),
})

export const receiveSchema = z.object({
  branchId: z.number().int().positive('Pilih cabang'),
  shiftIds: z.array(z.number().int().positive()).min(1, 'Pilih minimal satu shift').max(60),
  destinationMoneyPlaceId: z.number().int().positive('Pilih tujuan'),
  receivedAmount: rupiah('Nominal diterima'),
  depositDate: isoDate,
  variances: z.array(varianceLineSchema).max(20),
  notes: z.string().trim().max(500, 'Catatan maksimal 500 karakter').nullable().optional(),
})

export const reasonSchema = z.object({
  reason: z.string().trim().min(1, 'Alasan wajib diisi').max(255, 'Alasan maksimal 255 karakter'),
})

export const noncashSchema = z.object({
  shiftId: z.number().int().positive().nullable(),
  branchId: z.number().int().positive(),
  businessDate: isoDate.nullable(),
  paymentMethodId: z.number().int().positive(),
  awaitingFunds: z.boolean(),
  receivedAmount: rupiah('Nominal diterima').nullable().optional(),
  cause: z.enum(['BANK_FEE', 'CASHIER_INPUT', 'OTHER']).nullable().optional(),
  cashierId: z.number().int().positive().nullable().optional(),
  note: z.string().trim().max(255, 'Catatan maksimal 255 karakter').nullable().optional(),
})

export const noncashCorrectSchema = z.object({
  receivedAmount: rupiah('Nominal diterima'),
  cause: z.enum(['BANK_FEE', 'CASHIER_INPUT', 'OTHER']).nullable().optional(),
  cashierId: z.number().int().positive().nullable().optional(),
  note: z.string().trim().max(255, 'Catatan maksimal 255 karakter').nullable().optional(),
  reason: z.string().trim().min(1, 'Alasan koreksi wajib diisi').max(200, 'Alasan maksimal 200 karakter'),
})

export function actorOf(payload: JWTPayload): DepositActor {
  return { userId: payload.userId, branchId: payload.branchId, role: payload.role }
}

/** Cabang yang boleh dilihat: semua (null) untuk branchScope ALL, selain itu cabang login. */
export function scopedBranch(payload: JWTPayload, requested: string | null): number | null {
  if (payload.branchScope !== 'ALL') return payload.branchId
  const n = requested && /^\d+$/.test(requested) ? Number(requested) : null
  return n
}

export function assertBranchAllowed(payload: JWTPayload, branchId: number): NextResponse | null {
  if (payload.branchScope !== 'ALL' && branchId !== payload.branchId) {
    return NextResponse.json({ error: 'Cabang ini di luar akses Anda' }, { status: 403 })
  }
  return null
}

/** Lihat & verifikasi Setoran: OWNER, GM, FINANCE (`shift.deposit.verify`). */
export function requireDepositVerifier() {
  return requirePermission('shift.deposit.verify')
}

export function depositErrorResponse(error: unknown, context: string): NextResponse {
  if (error instanceof DepositError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
  }
  console.error(`${context} error:`, error)
  return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 })
}
