import { describe, expect, it } from 'vitest'
import { judgePromos, type PromoJudgeLine } from './promo-judge'
import type { PromoRule } from './promo-engine'

const A = { productId: 1, uomId: 10 }
const B = { productId: 2, uomId: 10 }
// 13 Okt 2026 pukul 14.00 WIB.
const NOW = new Date('2026-10-13T07:00:00Z')
const ctx = { branchId: 1, customerTier: null, now: NOW }

const potongA: PromoRule = {
  id: 7, name: 'Potong A', kind: 'POTONGAN', branchIds: [1],
  startsAt: '2026-10-01T00:00:00+07:00', endsAt: '2026-11-01T00:00:00+07:00',
  dailyStartMinute: null, dailyEndMinute: null, isMultiple: false, maxPerNote: null, isActive: true,
  conditions: [{ ...A, minQty: 2 }],
  rewards: [{ ...A, type: 'POTONG_PER_PCS', value: 1000, qty: null }],
}

const line = (item: typeof A, qty: number, unitPrice: number, promoAmount = 0, over: Partial<PromoJudgeLine> = {}): PromoJudgeLine => ({
  ...item, qty, unitPrice, priceTier: 'RETAIL',
  discountAmount: promoAmount, subtotal: qty * unitPrice - promoAmount,
  promo: promoAmount > 0 ? { promoId: 7, amount: promoAmount } : null,
  ...over,
})
const totalsOf = (lines: PromoJudgeLine[]) => {
  const sum = lines.reduce((s, l) => s + l.subtotal, 0)
  return { subtotal: sum, discountTotal: 0, grandTotal: sum }
}

describe('judgePromos — server sebagai hakim promo', () => {
  it('kiriman layar sama dengan hitungan server → diterima, potongan per baris dikembalikan', () => {
    const lines = [line(A, 3, 25000, 3000), line(B, 1, 10000)]
    const result = judgePromos(lines, [potongA], ctx, totalsOf(lines))
    expect(result).toEqual({ ok: true, awards: [{ key: '0', promoId: 7, promoName: 'Potong A', units: 3, amount: 3000 }, null] })
  })

  it('tanpa promo berjalan dan tanpa kiriman promo → diterima tanpa potongan (perilaku lama)', () => {
    const lines = [line(A, 1, 25000), line(B, 1, 10000)]
    expect(judgePromos(lines, [potongA], ctx, totalsOf(lines))).toEqual({ ok: true, awards: [null, null] })
    expect(judgePromos(lines, [], ctx, { subtotal: 35000, discountTotal: 5000, grandTotal: 30000 })).toEqual({ ok: true, awards: [null, null] })
  })

  it('layar tidak mengirim promo padahal sedang berlaku → ditolak, layar hitung ulang', () => {
    const lines = [line(A, 2, 25000)]
    expect(judgePromos(lines, [potongA], ctx, totalsOf(lines))).toMatchObject({ ok: false, code: 'PROMO_CHANGED', message: expect.stringContaining('Potong A') })
  })

  it('promo sudah berakhir / dimatikan saklar darurat → kiriman promo ditolak', () => {
    const lines = [line(A, 2, 25000, 2000)]
    const ended = { ...potongA, endsAt: '2026-10-13T13:59:00+07:00' }
    expect(judgePromos(lines, [ended], ctx, totalsOf(lines))).toMatchObject({ ok: false, code: 'PROMO_CHANGED', message: expect.stringContaining('sudah tidak berlaku') })
    expect(judgePromos(lines, [potongA], { ...ctx, enabled: false }, totalsOf(lines))).toMatchObject({ ok: false, code: 'PROMO_CHANGED' })
  })

  it('jumlah potongan atau promo yang dipakai berbeda → ditolak', () => {
    const wrongAmount = [line(A, 2, 25000, 5000)]
    expect(judgePromos(wrongAmount, [potongA], ctx, totalsOf(wrongAmount))).toMatchObject({ ok: false, code: 'PROMO_CHANGED' })
    const wrongPromo = [line(A, 2, 25000, 2000, { promo: { promoId: 99, amount: 2000 } })]
    expect(judgePromos(wrongPromo, [potongA], ctx, totalsOf(wrongPromo))).toMatchObject({ ok: false, code: 'PROMO_CHANGED' })
  })

  it('pelanggan Reseller tidak kena promo', () => {
    const lines = [line(A, 2, 25000, 2000)]
    expect(judgePromos(lines, [potongA], { ...ctx, customerTier: 'RESELLER' }, totalsOf(lines))).toMatchObject({ ok: false, code: 'PROMO_CHANGED' })
    const plain = [line(A, 2, 25000)]
    expect(judgePromos(plain, [potongA], { ...ctx, customerTier: 'RESELLER' }, totalsOf(plain))).toEqual({ ok: true, awards: [null] })
  })

  it('baris promo tidak boleh membawa diskon manual, dan angkanya harus cocok', () => {
    const manual = [line(A, 2, 25000, 2000, { hasManualDiscount: true })]
    expect(judgePromos(manual, [potongA], ctx, totalsOf(manual))).toMatchObject({ ok: false, code: 'PROMO_INVALID', message: 'Barang promo tidak bisa diberi diskon manual' })
    const badSubtotal = [line(A, 2, 25000, 2000, { subtotal: 50000 })]
    expect(judgePromos(badSubtotal, [potongA], ctx, totalsOf(badSubtotal))).toMatchObject({ ok: false, code: 'PROMO_INVALID' })
  })

  it('nota berpromo tidak boleh memakai diskon total nota dan totalnya harus sama dengan jumlah baris', () => {
    const lines = [line(A, 2, 25000, 2000)]
    expect(judgePromos(lines, [potongA], ctx, { subtotal: 48000, discountTotal: 1000, grandTotal: 47000 })).toMatchObject({ ok: false, code: 'PROMO_INVALID', message: 'Promo tidak bisa digabung dengan diskon total nota' })
    expect(judgePromos(lines, [potongA], ctx, { subtotal: 50000, discountTotal: 0, grandTotal: 50000 })).toMatchObject({ ok: false, code: 'PROMO_INVALID' })
  })

  it('ongkos kirim tidak pernah kena promo', () => {
    const ongkirPromo = { ...potongA, conditions: [{ ...B, minQty: 1 }], rewards: [{ ...B, type: 'POTONG_PER_PCS' as const, value: 1000, qty: null }] }
    const lines = [line(B, 1, 10000, 0, { excluded: true })]
    expect(judgePromos(lines, [ongkirPromo], ctx, totalsOf(lines))).toEqual({ ok: true, awards: [null] })
  })

  it('di luar jangkauan promo (Grosir, PO Internal, sinkron offline): tidak dihitung, kiriman promo ditolak', () => {
    const plain = [line(A, 2, 25000)]
    expect(judgePromos(plain, [potongA], { ...ctx, outOfScope: true }, totalsOf(plain))).toEqual({ ok: true, awards: [null] })
    const claimed = [line(A, 2, 25000, 2000)]
    expect(judgePromos(claimed, [potongA], { ...ctx, outOfScope: true }, totalsOf(claimed))).toMatchObject({ ok: false, code: 'PROMO_INVALID' })
  })
})
