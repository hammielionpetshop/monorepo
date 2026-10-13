import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const getAuth = vi.fn()
vi.mock('@/lib/authz', () => ({ getAuth: () => getAuth() }))
vi.mock('@/lib/services/promo-service', () => {
  class PromoServiceError extends Error {
    constructor(message: string, public status = 400) { super(message) }
  }
  class PromoLossError extends PromoServiceError {
    constructor(public losses: unknown[]) { super('Harga sesudah promo di bawah modal', 409) }
  }
  return { PROMO_MANAGER_ROLES: ['OWNER', 'GM'], PromoServiceError, PromoLossError }
})

const { requirePromoManager, promoErrorResponse, newPromoSchema } = await import('./promo-http')
const { PromoLossError, PromoServiceError } = await import('@/lib/services/promo-service')

describe('gerbang & jawaban HTTP layar Promo', () => {
  beforeEach(() => getAuth.mockReset())

  it('hanya Owner dan GM', async () => {
    getAuth.mockResolvedValue(null)
    expect(((await requirePromoManager()) as NextResponse).status).toBe(401)
    for (const role of ['MANAGER', 'KASIR', 'FINANCE']) {
      getAuth.mockResolvedValue({ role })
      expect(((await requirePromoManager()) as NextResponse).status).toBe(403)
    }
    for (const role of ['OWNER', 'GM']) {
      getAuth.mockResolvedValue({ role, userId: 1 })
      expect(await requirePromoManager()).toMatchObject({ role })
    }
  })

  it('jual rugi → 409 berisi daftar barangnya; galat layanan → status & pesannya', async () => {
    const losses = [{ productName: 'Pakan', price: 10000, promoPrice: 8000, cost: 9000 }]
    const res = promoErrorResponse(new PromoLossError(losses as never), 'tes')
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'PROMO_LOSS', losses })
    const notFound = promoErrorResponse(new PromoServiceError('Promo tidak ditemukan', 404), 'tes')
    expect(notFound.status).toBe(404)
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(promoErrorResponse(new Error('db mati'), 'tes').status).toBe(500)
    spy.mockRestore()
  })

  it('bentuk kiriman: waktu wajib bertanda zona, jenis & cara potong dikenal', () => {
    const ok = {
      name: 'Promo', kind: 'POTONGAN', branchIds: [1], startsAt: '2026-10-13T08:00:00+07:00', endsAt: '2026-10-14T08:00:00+07:00',
      dailyStartMinute: null, dailyEndMinute: null, isMultiple: false, maxPerNote: null,
      conditions: [{ productId: 1, uomId: 1, minQty: 1 }], rewards: [{ productId: 1, uomId: 1, type: 'HARGA_JADI', value: 5000, qty: null }],
    }
    expect(newPromoSchema.safeParse(ok).success).toBe(true)
    expect(newPromoSchema.safeParse({ ...ok, startsAt: '2026-10-13 08:00' }).success).toBe(false)
    expect(newPromoSchema.safeParse({ ...ok, kind: 'DISKON' }).success).toBe(false)
    expect(newPromoSchema.safeParse({ ...ok, rewards: [{ ...ok.rewards[0], type: 'POTONG' }] }).success).toBe(false)
  })
})
