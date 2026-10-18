import { describe, expect, it } from 'vitest'
import {
  applyPromos, checkNewPromo, checkPromoRule, isPromoRunning, promoStatus, promoUnitPrice, isPromoSupported, wibMinuteOfDay,
  type PromoCartLine, type PromoContext, type PromoRule,
} from './promo-engine'

const A = { productId: 1, uomId: 10 }
const B = { productId: 2, uomId: 10 }
const C = { productId: 3, uomId: 10 }

// 13 Okt 2026 pukul 14.00 WIB.
const NOW = new Date('2026-10-13T07:00:00Z')
const ctx = (over: Partial<PromoContext> = {}): PromoContext => ({ branchId: 1, customerTier: null, now: NOW, ...over })

const rule = (over: Partial<PromoRule>): PromoRule => ({
  id: 1, name: 'Promo', kind: 'POTONGAN', branchIds: [1],
  startsAt: '2026-10-01T00:00:00+07:00', endsAt: '2026-11-01T00:00:00+07:00',
  dailyStartMinute: null, dailyEndMinute: null, isMultiple: false, maxPerNote: null, isActive: true,
  conditions: [{ ...A, minQty: 1 }],
  rewards: [{ ...A, type: 'POTONG_PER_PCS', value: 1000, qty: null }],
  ...over,
})

const line = (item: { productId: number; uomId: number }, qty: number, unitPrice: number, over: Partial<PromoCartLine> = {}): PromoCartLine => ({
  key: `${item.productId}:${item.uomId}:RETAIL`, ...item, qty, unitPrice, priceTier: 'RETAIL', ...over,
})

describe('applyPromos — potongan per barang', () => {
  it('memotong semua pcs begitu jumlah minimal terpenuhi (qty hadiah kosong)', () => {
    const promo = rule({ conditions: [{ ...A, minQty: 3 }] })
    expect(applyPromos([line(A, 2, 25000)], [promo], ctx()).total).toBe(0)
    const result = applyPromos([line(A, 5, 25000)], [promo], ctx())
    expect(result.lines).toEqual([{ key: '1:10:RETAIL', promoId: 1, promoName: 'Promo', units: 5, amount: 5000 }])
    expect(result.applied).toEqual([{ promoId: 1, promoName: 'Promo', times: 1, amount: 5000 }])
    expect(result.total).toBe(5000)
  })

  it('tanpa kelipatan hanya satu kali pakai; dengan kelipatan mengikuti jumlah; maksimal per nota membatasi', () => {
    const base = { conditions: [{ ...A, minQty: 3 }], rewards: [{ ...A, type: 'POTONG_PER_PCS' as const, value: 1000, qty: 3 }] }
    const cart = [line(A, 10, 25000)]
    expect(applyPromos(cart, [rule(base)], ctx()).lines[0]).toMatchObject({ units: 3, amount: 3000 })
    expect(applyPromos(cart, [rule({ ...base, isMultiple: true })], ctx()).lines[0]).toMatchObject({ units: 9, amount: 9000 })
    const capped = applyPromos(cart, [rule({ ...base, isMultiple: true, maxPerNote: 2 })], ctx())
    expect(capped.lines[0]).toMatchObject({ units: 6, amount: 6000 })
    expect(capped.applied[0]!.times).toBe(2)
  })

  it('harga jadi memotong selisihnya, dan tidak pernah menaikkan harga', () => {
    const promo = rule({ rewards: [{ ...A, type: 'HARGA_JADI', value: 20000, qty: null }] })
    expect(applyPromos([line(A, 2, 25000)], [promo], ctx()).total).toBe(10000)
    expect(applyPromos([line(A, 2, 18000)], [promo], ctx())).toEqual({ lines: [], applied: [], total: 0 })
  })

  it('potongan tidak pernah melebihi harga barangnya', () => {
    const promo = rule({ rewards: [{ ...A, type: 'POTONG_PER_PCS', value: 50000, qty: null }] })
    expect(applyPromos([line(A, 2, 25000)], [promo], ctx()).total).toBe(50000)
  })

  it('beli A, B lebih murah: hadiah di barang lain, hanya bila B ada di keranjang', () => {
    const promo = rule({ rewards: [{ ...B, type: 'POTONG_PER_PCS', value: 2000, qty: 1 }] })
    expect(applyPromos([line(A, 1, 25000)], [promo], ctx()).total).toBe(0)
    const result = applyPromos([line(A, 1, 25000), line(B, 3, 10000)], [promo], ctx())
    expect(result.lines).toEqual([{ key: '2:10:RETAIL', promoId: 1, promoName: 'Promo', units: 1, amount: 2000 }])
  })

  it('syarat lebih dari satu barang harus terpenuhi semua', () => {
    const promo = rule({
      conditions: [{ ...A, minQty: 1 }, { ...B, minQty: 2 }],
      rewards: [{ ...B, type: 'POTONG_PER_PCS', value: 1500, qty: 2 }],
    })
    expect(applyPromos([line(A, 1, 25000), line(B, 1, 10000)], [promo], ctx()).total).toBe(0)
    expect(applyPromos([line(A, 1, 25000), line(B, 2, 10000)], [promo], ctx()).total).toBe(3000)
  })

  it('barang yang sama di beberapa baris (jasa per kucing) dijumlahkan, potongan dibagi berurutan', () => {
    const promo = rule({ conditions: [{ ...A, minQty: 2 }], rewards: [{ ...A, type: 'POTONG_PER_PCS', value: 5000, qty: 2 }], isMultiple: true })
    const cart = [line(A, 1, 50000, { key: 'kucing-1' }), line(A, 1, 50000, { key: 'kucing-2' }), line(A, 1, 50000, { key: 'kucing-3' })]
    const result = applyPromos(cart, [promo], ctx())
    expect(result.lines.map((l) => [l.key, l.units, l.amount])).toEqual([['kucing-1', 1, 5000], ['kucing-2', 1, 5000]])
  })
})

describe('applyPromos — siapa dan kapan', () => {
  const cart = [line(A, 1, 25000)]

  it('hanya golongan Retail: pelanggan Reseller / Grosir dan baris berharga lain tidak kena', () => {
    expect(applyPromos(cart, [rule({})], ctx({ customerTier: 'RETAIL' })).total).toBe(1000)
    expect(applyPromos(cart, [rule({})], ctx({ customerTier: 'RESELLER' })).total).toBe(0)
    expect(applyPromos(cart, [rule({})], ctx({ customerTier: 'GROSIR' })).total).toBe(0)
    expect(applyPromos([line(A, 1, 22000, { priceTier: 'GROSIR' })], [rule({})], ctx()).total).toBe(0)
  })

  it('hanya cabang yang dipilih, hanya promo aktif, hanya dalam masa berlakunya', () => {
    expect(applyPromos(cart, [rule({})], ctx({ branchId: 2 })).total).toBe(0)
    expect(applyPromos(cart, [rule({ isActive: false })], ctx()).total).toBe(0)
    expect(applyPromos(cart, [rule({})], ctx({ now: new Date('2026-09-30T16:59:59Z') })).total).toBe(0)
    expect(applyPromos(cart, [rule({})], ctx({ now: new Date('2026-09-30T17:00:00Z') })).total).toBe(1000)
    expect(applyPromos(cart, [rule({})], ctx({ now: new Date('2026-10-31T17:00:00Z') })).total).toBe(0)
  })

  it('flash sale mengikuti jam WIB, termasuk jam yang melewati tengah malam', () => {
    const flash = rule({ kind: 'FLASH_SALE', dailyStartMinute: 13 * 60, dailyEndMinute: 15 * 60 })
    expect(wibMinuteOfDay(NOW)).toBe(14 * 60)
    expect(isPromoRunning(flash, ctx())).toBe(true)
    expect(isPromoRunning(flash, ctx({ now: new Date('2026-10-13T05:59:00Z') }))).toBe(false)
    expect(isPromoRunning(flash, ctx({ now: new Date('2026-10-13T08:00:00Z') }))).toBe(false)
    const malam = rule({ dailyStartMinute: 22 * 60, dailyEndMinute: 2 * 60 })
    expect(isPromoRunning(malam, ctx({ now: new Date('2026-10-13T16:30:00Z') }))).toBe(true)
    expect(isPromoRunning(malam, ctx({ now: new Date('2026-10-13T18:30:00Z') }))).toBe(true)
    expect(isPromoRunning(malam, ctx())).toBe(false)
  })

  it('saklar darurat dan nota PO Internal mematikan semua promo', () => {
    expect(applyPromos(cart, [rule({})], ctx({ enabled: false })).total).toBe(0)
    expect(applyPromos(cart, [rule({})], ctx({ internalPo: true })).total).toBe(0)
  })

  it('baris ongkir, qty tidak bulat, promo cacat, dan promo barang gratis dilewati', () => {
    expect(applyPromos([line(A, 1, 25000, { excluded: true })], [rule({})], ctx()).total).toBe(0)
    expect(applyPromos([line(A, 0.5, 25000)], [rule({})], ctx()).total).toBe(0)
    expect(applyPromos(cart, [rule({ conditions: [] })], ctx()).total).toBe(0)
    const gratis = rule({ kind: 'BELI_GRATIS', rewards: [{ ...A, type: 'GRATIS', value: 0, qty: 1 }] })
    expect(isPromoSupported(gratis)).toBe(false)
    expect(applyPromos([line(A, 2, 25000)], [gratis], ctx()).total).toBe(0)
  })
})

describe('applyPromos — beberapa promo', () => {
  it('promo di barang berbeda berlaku bersama', () => {
    const promoA = rule({ id: 1, name: 'Promo A' })
    const promoB = rule({ id: 2, name: 'Promo B', conditions: [{ ...B, minQty: 1 }], rewards: [{ ...B, type: 'POTONG_PER_PCS', value: 500, qty: null }] })
    const result = applyPromos([line(A, 1, 25000), line(B, 2, 10000)], [promoB, promoA], ctx())
    expect(result.applied.map((p) => [p.promoName, p.amount])).toEqual([['Promo A', 1000], ['Promo B', 1000]])
    expect(result.total).toBe(2000)
  })

  it('satu barang cocok dua promo → hanya satu, yang paling murah untuk pelanggan', () => {
    const kecil = rule({ id: 1, name: 'Kecil' })
    const besar = rule({ id: 2, name: 'Besar', rewards: [{ ...A, type: 'HARGA_JADI', value: 20000, qty: null }] })
    const result = applyPromos([line(A, 1, 25000)], [kecil, besar], ctx())
    expect(result.applied).toEqual([{ promoId: 2, promoName: 'Besar', times: 1, amount: 5000 }])
    expect(result.lines).toHaveLength(1)
  })

  it('bila potongannya sama, promo yang dibuat lebih dulu yang dipakai', () => {
    const result = applyPromos([line(A, 1, 25000)], [rule({ id: 7, name: 'Baru' }), rule({ id: 3, name: 'Lama' })], ctx())
    expect(result.applied.map((p) => p.promoId)).toEqual([3])
  })

  it('memilih gabungan terbaik, bukan promo tunggal terbesar', () => {
    // Promo 1 memakai A dan B sekaligus (potongan 3.000); promo 2 hanya A (2.000) dan promo 3
    // hanya B (2.000). Gabungan 2 + 3 = 4.000 lebih murah untuk pelanggan daripada promo 1.
    const paket = rule({ id: 1, name: 'Paket', conditions: [{ ...A, minQty: 1 }, { ...B, minQty: 1 }], rewards: [{ ...B, type: 'POTONG_PER_PCS', value: 3000, qty: 1 }] })
    const hanyaA = rule({ id: 2, name: 'A', rewards: [{ ...A, type: 'POTONG_PER_PCS', value: 2000, qty: null }] })
    const hanyaB = rule({ id: 3, name: 'B', conditions: [{ ...B, minQty: 1 }], rewards: [{ ...B, type: 'POTONG_PER_PCS', value: 2000, qty: null }] })
    const cart = [line(A, 1, 25000), line(B, 1, 10000), line(C, 1, 5000)]
    const result = applyPromos(cart, [paket, hanyaA, hanyaB], ctx())
    expect(result.applied.map((p) => p.promoId)).toEqual([2, 3])
    expect(result.total).toBe(4000)
    expect(new Set(result.lines.map((l) => l.key)).size).toBe(result.lines.length)
  })

  it('barang syarat satu promo tidak bisa sekaligus dipotong promo lain', () => {
    const beliAPotongB = rule({ id: 1, name: 'Beli A potong B', rewards: [{ ...B, type: 'POTONG_PER_PCS', value: 4000, qty: 1 }] })
    const potongA = rule({ id: 2, name: 'Potong A', rewards: [{ ...A, type: 'POTONG_PER_PCS', value: 1000, qty: null }] })
    const result = applyPromos([line(A, 1, 25000), line(B, 1, 10000)], [beliAPotongB, potongA], ctx())
    expect(result.applied.map((p) => p.promoId)).toEqual([1])
  })

  it('banyak promo sekaligus tetap menghasilkan satu promo per barang', () => {
    const many = Array.from({ length: 20 }, (_, i) => rule({ id: i + 1, name: `P${i + 1}`, rewards: [{ ...A, type: 'POTONG_PER_PCS', value: 100 * (i + 1), qty: null }] }))
    const result = applyPromos([line(A, 1, 25000)], many, ctx())
    expect(result.applied).toEqual([{ promoId: 20, promoName: 'P20', times: 1, amount: 2000 }])
  })
})

describe('applyPromos — kuota & syarat stok (P3)', () => {
  it('kuota pcs membatasi jumlah pcs hadiah; jatah mepet dipotong sebagian', () => {
    const promo = rule({ quotaKind: 'PCS', quotaPerBranch: 25 })
    // Tanpa sisa jatah yang disuplai → dianggap penuh, semua pcs kena.
    expect(applyPromos([line(A, 5, 25000)], [promo], ctx()).total).toBe(5000)
    // Sisa jatah 2 → hanya 2 pcs kena promo, sisanya harga normal.
    const r = applyPromos([line(A, 5, 25000)], [promo], ctx({ remainingQuota: new Map([[1, 2]]) }))
    expect(r.lines).toEqual([{ key: '1:10:RETAIL', promoId: 1, promoName: 'Promo', units: 2, amount: 2000 }])
    expect(r.total).toBe(2000)
  })

  it('kuota pcs menyebar sisa jatah ke beberapa baris lalu berhenti', () => {
    const promo = rule({ conditions: [{ ...A, minQty: 1 }], quotaKind: 'PCS', quotaPerBranch: 10 })
    const cart = [line(A, 3, 25000, { key: 'baris-1' }), line(A, 3, 25000, { key: 'baris-2' })]
    const r = applyPromos(cart, [promo], ctx({ remainingQuota: new Map([[1, 4]]) }))
    expect(r.lines.map((l) => [l.key, l.units])).toEqual([['baris-1', 3], ['baris-2', 1]])
    expect(r.total).toBe(4000)
  })

  it('kuota pcs habis (sisa 0) → promo tidak berlaku', () => {
    const promo = rule({ quotaKind: 'PCS', quotaPerBranch: 25 })
    expect(applyPromos([line(A, 5, 25000)], [promo], ctx({ remainingQuota: new Map([[1, 0]]) })).total).toBe(0)
  })

  it('kuota nota: sisa >= 1 berlaku penuh, sisa 0 tidak sama sekali (satu nota makan 1 jatah)', () => {
    const promo = rule({ quotaKind: 'NOTA', quotaPerBranch: 100 })
    expect(applyPromos([line(A, 5, 25000)], [promo], ctx({ remainingQuota: new Map([[1, 1]]) })).total).toBe(5000)
    expect(applyPromos([line(A, 5, 25000)], [promo], ctx({ remainingQuota: new Map([[1, 0]]) })).total).toBe(0)
  })

  it('syarat stok: barang hadiah berstok 0 tidak kena promo; tersedia atau tak disuplai tetap kena', () => {
    const promo = rule({ requireStock: true })
    expect(applyPromos([line(A, 2, 25000)], [promo], ctx({ stock: new Map([['1:10', 0]]) })).total).toBe(0)
    expect(applyPromos([line(A, 2, 25000)], [promo], ctx({ stock: new Map([['1:10', 3]]) })).total).toBe(2000)
    expect(applyPromos([line(A, 2, 25000)], [promo], ctx()).total).toBe(2000)
  })
})

describe('checkPromoRule', () => {
  it('menerima promo yang lengkap', () => {
    expect(checkPromoRule(rule({}))).toBeNull()
    expect(checkPromoRule(rule({ dailyStartMinute: 780, dailyEndMinute: 900, isMultiple: true, maxPerNote: 2 }))).toBeNull()
    expect(checkPromoRule(rule({ quotaKind: 'PCS', quotaPerBranch: 25 }))).toBeNull()
    expect(checkPromoRule(rule({ quotaKind: 'NOTA', quotaPerBranch: 100, requireStock: true }))).toBeNull()
  })

  it('menolak isian yang tidak lengkap atau tidak masuk akal', () => {
    const bad: Partial<PromoRule>[] = [
      { name: '  ' },
      { name: 'x'.repeat(101) },
      { kind: 'LAIN' as PromoRule['kind'] },
      { branchIds: [] },
      { endsAt: '2026-10-01T00:00:00+07:00' },
      { startsAt: 'ngawur' },
      { dailyStartMinute: 600 },
      { dailyStartMinute: 600, dailyEndMinute: 600 },
      { dailyStartMinute: -1, dailyEndMinute: 600 },
      { maxPerNote: 0 },
      { conditions: [] },
      { rewards: [] },
      { conditions: [{ ...A, minQty: 0 }] },
      { conditions: [{ ...A, minQty: 1 }, { ...A, minQty: 2 }] },
      { rewards: [{ ...A, type: 'POTONG_PER_PCS', value: 0, qty: null }] },
      { rewards: [{ ...A, type: 'HARGA_JADI', value: 1000, qty: 0 }] },
      { rewards: [{ ...A, type: 'POTONG_PER_PCS', value: 1000, qty: null }, { ...A, type: 'HARGA_JADI', value: 500, qty: null }] },
      { quotaKind: 'LAIN' as PromoRule['quotaKind'], quotaPerBranch: 10 },
      { quotaKind: 'PCS' },
      { quotaKind: 'PCS', quotaPerBranch: 0 },
      { quotaPerBranch: 25 },
    ]
    for (const over of bad) expect(checkPromoRule(rule(over)), JSON.stringify(over)).not.toBeNull()
  })
})

describe('pembuatan promo (P2b)', () => {
  const base: Omit<PromoRule, 'id'> = rule({})

  it('potongan dan flash sale boleh dibuat; bentuk yang belum didukung ditolak', () => {
    expect(checkNewPromo(base)).toBeNull()
    expect(checkNewPromo({ ...base, kind: 'FLASH_SALE', dailyStartMinute: 600, dailyEndMinute: 660 })).toBeNull()
    expect(checkNewPromo({ ...base, kind: 'BELI_GRATIS' })).toMatch(/belum bisa dibuat/)
    expect(checkNewPromo({ ...base, rewards: [{ ...A, type: 'GRATIS', value: 0, qty: 1 }] })).toMatch(/belum bisa dibuat/)
    expect(checkNewPromo({ ...base, name: ' ' })).toBe('Nama promo wajib diisi')
  })

  it('harga sesudah promo: potong per pcs, harga jadi, tidak pernah naik atau minus', () => {
    expect(promoUnitPrice({ type: 'POTONG_PER_PCS', value: 2000 }, 10000)).toBe(8000)
    expect(promoUnitPrice({ type: 'HARGA_JADI', value: 7500 }, 10000)).toBe(7500)
    expect(promoUnitPrice({ type: 'HARGA_JADI', value: 12000 }, 10000)).toBe(10000)
    expect(promoUnitPrice({ type: 'POTONG_PER_PCS', value: 15000 }, 10000)).toBe(0)
  })

  it('keadaan promo menurut masa berlaku', () => {
    expect(promoStatus(base, NOW)).toBe('BERJALAN')
    expect(promoStatus({ ...base, isActive: false }, NOW)).toBe('NONAKTIF')
    expect(promoStatus({ ...base, startsAt: '2026-10-14T00:00:00+07:00' }, NOW)).toBe('BELUM_MULAI')
    expect(promoStatus({ ...base, endsAt: '2026-10-13T14:00:00+07:00' }, NOW)).toBe('BERAKHIR')
  })
})
