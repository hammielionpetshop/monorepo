import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { JWTPayload } from '@petshop/shared'
import { getAuth } from '@/lib/authz'
import { PROMO_KINDS, PROMO_REWARD_TYPES } from './promo-engine'
import { PROMO_MANAGER_ROLES, PromoLossError, PromoServiceError } from '@/lib/services/promo-service'

// Bagian HTTP layar Promo (P2b): gerbang peran Owner/GM, bentuk kiriman, dan jawaban galat.

/** Owner & GM saja (keputusan owner 13 Okt: tanpa izin baru). */
export async function requirePromoManager(): Promise<JWTPayload | NextResponse> {
  const payload = await getAuth()
  if (!payload) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  if (!PROMO_MANAGER_ROLES.includes(payload.role)) {
    return NextResponse.json({ error: 'Promo hanya bisa diatur Owner dan GM' }, { status: 403 })
  }
  return payload
}

const id = z.number().int().positive()
const item = { productId: id, uomId: id }

export const newPromoSchema = z.object({
  name: z.string(),
  kind: z.enum(PROMO_KINDS),
  note: z.string().max(500, 'Catatan maksimal 500 karakter').nullish(),
  branchIds: z.array(id),
  startsAt: z.string().datetime({ offset: true, message: 'Waktu mulai tidak sah' }),
  endsAt: z.string().datetime({ offset: true, message: 'Waktu selesai tidak sah' }),
  dailyStartMinute: z.number().int().nullable(),
  dailyEndMinute: z.number().int().nullable(),
  isMultiple: z.boolean(),
  maxPerNote: z.number().int().nullable(),
  conditions: z.array(z.object({ ...item, minQty: z.number().int() })).max(20, 'Barang syarat paling banyak 20'),
  rewards: z.array(z.object({
    ...item, type: z.enum(PROMO_REWARD_TYPES), value: z.number().int(), qty: z.number().int().nullable(),
  })).max(20, 'Barang yang dipotong paling banyak 20'),
  acceptLoss: z.boolean().optional(),
})

export function promoErrorResponse(error: unknown, context: string): NextResponse {
  if (error instanceof PromoLossError) {
    return NextResponse.json({ error: error.message, code: 'PROMO_LOSS', losses: error.losses }, { status: error.status })
  }
  if (error instanceof PromoServiceError) return NextResponse.json({ error: error.message }, { status: error.status })
  console.error(`${context} error:`, error)
  return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 })
}
