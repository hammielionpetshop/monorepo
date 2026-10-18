import { describe, expect, it } from 'vitest'
import {
  buildPromoPayload, describePromo, emptyPromoForm, formatPromoPeriod, parseWholeNumber,
  promoPricePreview, timeToMinute, wibDateTime, type PromoFormState,
} from './promo-form'

const A = { productId: 1, uomId: 10 }
const B = { productId: 2, uomId: 20 }

function form(over: Partial<PromoFormState> = {}): PromoFormState {
  return {
    ...emptyPromoForm('2026-10-13', [1]),
    name: 'Promo Uji',
    endDate: '2026-10-20',
    cutValue: '2.000',
    target: A,
    ...over,
  }
}

function payloadOf(f: PromoFormState) {
  const built = buildPromoPayload(f)
  if ('error' in built) throw new Error(built.error)
  return built.payload
}

describe('isian form promo', () => {
  it('angka, jam, dan tanggal WIB', () => {
    expect(parseWholeNumber('Rp 12.500')).toBe(12500)
    expect(parseWholeNumber('')).toBeNull()
    expect(timeToMinute('08:30')).toBe(510)
    expect(timeToMinute('24:00')).toBeNull()
    expect(wibDateTime('2026-10-13', '08:00')).toBe('2026-10-13T08:00:00+07:00')
    expect(wibDateTime('2026-13-40', '08:00')).toBeNull()
    expect(wibDateTime('', '08:00')).toBeNull()
  })

  it('potongan satu barang: syarat 1 pcs, semua pcs dipotong, tanpa kelipatan', () => {
    const p = payloadOf(form())
    expect(p.kind).toBe('POTONGAN')
    expect(p.startsAt).toBe('2026-10-13T00:00:00+07:00')
    expect(p.endsAt).toBe('2026-10-20T23:59:00+07:00')
    expect(p.conditions).toEqual([{ ...A, minQty: 1 }])
    expect(p.rewards).toEqual([{ ...A, type: 'POTONG_PER_PCS', value: 2000, qty: null }])
    expect(p.isMultiple).toBe(false)
    expect(p.dailyStartMinute).toBeNull()
  })

  it('mulai N pcs memakai jumlah minimal; 1 pcs ditolak', () => {
    expect(payloadOf(form({ shape: 'MULAI_N', minQty: '3' })).conditions).toEqual([{ ...A, minQty: 3 }])
    expect(buildPromoPayload(form({ shape: 'MULAI_N', minQty: '1' }))).toHaveProperty('error')
    expect(buildPromoPayload(form({ shape: 'MULAI_N', minQty: '' }))).toHaveProperty('error')
  })

  it('flash sale dengan jam tiap hari', () => {
    const p = payloadOf(form({ shape: 'FLASH_SALE', useDailyHours: true, dailyFrom: '22:00', dailyTo: '02:00', cutType: 'HARGA_JADI' }))
    expect(p.kind).toBe('FLASH_SALE')
    expect([p.dailyStartMinute, p.dailyEndMinute]).toEqual([1320, 120])
    expect(p.rewards[0]!.type).toBe('HARGA_JADI')
    expect(buildPromoPayload(form({ shape: 'FLASH_SALE', useDailyHours: true, dailyFrom: '22:00' }))).toHaveProperty('error')
  })

  it('beli A, B lebih murah: syarat & hadiah terpisah, kelipatan dan batas per nota', () => {
    const p = payloadOf(form({
      shape: 'BELI_A_POTONG_B', target: null,
      conditions: [{ ...A, minQty: '2' }], rewards: [{ ...B, qty: '1' }], isMultiple: true, maxPerNote: '3',
    }))
    expect(p.conditions).toEqual([{ ...A, minQty: 2 }])
    expect(p.rewards).toEqual([{ ...B, type: 'POTONG_PER_PCS', value: 2000, qty: 1 }])
    expect([p.isMultiple, p.maxPerNote]).toEqual([true, 3])
    expect(buildPromoPayload(form({ shape: 'BELI_A_POTONG_B', conditions: [], rewards: [{ ...B, qty: '1' }] }))).toHaveProperty('error')
    expect(buildPromoPayload(form({ shape: 'BELI_A_POTONG_B', conditions: [{ ...A, minQty: '2' }], rewards: [{ ...B, qty: '' }] }))).toHaveProperty('error')
  })

  it('beli X gratis Y: hadiah GRATIS tanpa nilai potongan, syarat & hadiah terpisah', () => {
    const p = payloadOf(form({
      shape: 'BELI_GRATIS', target: null, cutValue: '',
      conditions: [{ ...A, minQty: '2' }], rewards: [{ ...B, qty: '1' }], isMultiple: true, maxPerNote: '5',
    }))
    expect(p.kind).toBe('BELI_GRATIS')
    expect(p.conditions).toEqual([{ ...A, minQty: 2 }])
    expect(p.rewards).toEqual([{ ...B, type: 'GRATIS', value: 0, qty: 1 }])
    expect([p.isMultiple, p.maxPerNote]).toEqual([true, 5])
  })

  it('beli 2 gratis 1 barang yang sama', () => {
    const p = payloadOf(form({
      shape: 'BELI_GRATIS', target: null, cutValue: '',
      conditions: [{ ...A, minQty: '2' }], rewards: [{ ...A, qty: '1' }],
    }))
    expect(p.conditions).toEqual([{ ...A, minQty: 2 }])
    expect(p.rewards).toEqual([{ ...A, type: 'GRATIS', value: 0, qty: 1 }])
  })

  it('beli X gratis Y: hadiah tanpa pcs gratis / tanpa syarat ditolak', () => {
    expect(buildPromoPayload(form({ shape: 'BELI_GRATIS', target: null, cutValue: '', conditions: [{ ...A, minQty: '2' }], rewards: [{ ...B, qty: '' }] }))).toHaveProperty('error')
    expect(buildPromoPayload(form({ shape: 'BELI_GRATIS', target: null, cutValue: '', conditions: [], rewards: [{ ...B, qty: '1' }] }))).toHaveProperty('error')
  })

  it('bundling: beberapa barang syarat → potongan pada barang yang dipilih', () => {
    const C = { productId: 3, uomId: 30 }
    const p = payloadOf(form({
      shape: 'BUNDLING', target: null, cutType: 'HARGA_JADI', cutValue: '15.000',
      conditions: [{ ...A, minQty: '1' }, { ...B, minQty: '1' }], rewards: [{ ...C, qty: '1' }],
    }))
    expect(p.kind).toBe('BUNDLING')
    expect(p.conditions).toEqual([{ ...A, minQty: 1 }, { ...B, minQty: 1 }])
    expect(p.rewards).toEqual([{ ...C, type: 'HARGA_JADI', value: 15000, qty: 1 }])
  })

  it('kuota pcs & nota per cabang + syarat stok masuk ke kiriman', () => {
    const pcs = payloadOf(form({ quotaKind: 'PCS', quotaPerBranch: '25', requireStock: true }))
    expect([pcs.quotaKind, pcs.quotaPerBranch, pcs.requireStock]).toEqual(['PCS', 25, true])
    const nota = payloadOf(form({ quotaKind: 'NOTA', quotaPerBranch: '10' }))
    expect([nota.quotaKind, nota.quotaPerBranch, nota.requireStock]).toEqual(['NOTA', 10, false])
    const none = payloadOf(form())
    expect([none.quotaKind, none.quotaPerBranch, none.requireStock]).toEqual([null, null, false])
  })

  it('kuota dipilih tetapi jatah kosong / nol ditolak', () => {
    expect(buildPromoPayload(form({ quotaKind: 'PCS', quotaPerBranch: '' }))).toHaveProperty('error')
    expect(buildPromoPayload(form({ quotaKind: 'NOTA', quotaPerBranch: '0' }))).toHaveProperty('error')
  })

  it('isian kurang ditolak dengan pesan, termasuk pemeriksaan mesin promo', () => {
    expect(buildPromoPayload(form({ target: null }))).toEqual({ error: 'Pilih barang promonya' })
    expect(buildPromoPayload(form({ cutValue: '' }))).toHaveProperty('error')
    expect(buildPromoPayload(form({ name: '  ' }))).toEqual({ error: 'Nama promo wajib diisi' })
    expect(buildPromoPayload(form({ branchIds: [] }))).toEqual({ error: 'Pilih sekurangnya satu cabang' })
    expect(buildPromoPayload(form({ endDate: '2026-10-12' }))).toEqual({ error: 'Promo harus berakhir sesudah waktu mulainya' })
  })
})

describe('kalimat daftar promo', () => {
  const named = (i: { productId: number; uomId: number }, productName: string) => ({ ...i, productName, uomCode: 'PCS' })

  it('potongan satu barang & mulai N pcs', () => {
    expect(describePromo({
      kind: 'POTONGAN', isMultiple: false, maxPerNote: null,
      conditions: [{ ...named(A, 'Barang A'), minQty: 3 }],
      rewards: [{ ...named(A, 'Barang A'), type: 'HARGA_JADI', value: 9000, qty: null }],
    })).toEqual(['Barang A (PCS): mulai 3 pcs, harga jadi Rp 9.000 per pcs (semua pcs)'])
  })

  it('beli A, B lebih murah', () => {
    expect(describePromo({
      kind: 'POTONGAN', isMultiple: true, maxPerNote: 2,
      conditions: [{ ...named(A, 'Barang A'), minQty: 2 }],
      rewards: [{ ...named(B, 'Barang B'), type: 'POTONG_PER_PCS', value: 1000, qty: 1 }],
    })).toEqual([
      'Syarat: 2 pcs Barang A (PCS)',
      'Dipotong: Barang B (PCS) — potong Rp 1.000 per pcs, 1 pcs tiap kali terpakai',
      'Berlaku kelipatan, paling banyak 2× per nota',
    ])
  })

  it('beli X gratis Y tampil sebagai hadiah gratis', () => {
    expect(describePromo({
      kind: 'BELI_GRATIS', isMultiple: true, maxPerNote: null,
      conditions: [{ ...named(A, 'Barang A'), minQty: 2 }],
      rewards: [{ ...named(B, 'Barang B'), type: 'GRATIS', value: 0, qty: 1 }],
    })).toEqual([
      'Syarat: 2 pcs Barang A (PCS)',
      'Gratis: Barang B (PCS) — 1 pcs tiap kali terpakai',
      'Berlaku kelipatan',
    ])
  })

  it('kuota per cabang & syarat stok tampil di rincian promo', () => {
    expect(describePromo({
      kind: 'POTONGAN', isMultiple: false, maxPerNote: null, quotaKind: 'PCS', quotaPerBranch: 25, requireStock: true,
      conditions: [{ ...named(A, 'Barang A'), minQty: 1 }],
      rewards: [{ ...named(A, 'Barang A'), type: 'POTONG_PER_PCS', value: 2000, qty: null }],
    })).toEqual([
      'Barang A (PCS): potong Rp 2.000 per pcs (semua pcs)',
      'Kuota: 25 pcs hadiah per cabang',
      'Hanya selama stok barang hadiah di cabang itu masih ada',
    ])
  })

  it('masa berlaku dalam WIB dan pratinjau harga', () => {
    const text = formatPromoPeriod({ startsAt: '2026-10-13T01:00:00Z', endsAt: '2026-10-20T15:00:00Z', dailyStartMinute: 600, dailyEndMinute: 720 })
    expect(text).toContain('13 Okt 2026')
    expect(text).toContain('08.00')
    expect(text).toContain('22.00')
    expect(text).toContain('tiap hari 10.00–12.00')
    expect(promoPricePreview({ type: 'POTONG_PER_PCS', value: 2000 }, 10000)).toBe('Rp 10.000 → Rp 8.000')
    expect(promoPricePreview({ type: 'HARGA_JADI', value: 12000 }, 10000)).toBe('Rp 10.000 → Rp 10.000')
  })
})
