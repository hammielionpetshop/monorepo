import { describe, expect, it } from 'vitest'
import { receivingWarnings, type ReceivingLineInput } from './receiving-warnings'

const line = (over: Partial<ReceivingLineInput>): ReceivingLineInput => ({
  name: 'ACTIVE -2',
  uomCode: 'SAK',
  remaining: 10,
  qty: 10,
  damaged: 0,
  price: 170_250,
  referencePrice: 168_000,
  ...over,
})

describe('receivingWarnings', () => {
  it('semua terisi wajar → tanpa peringatan', () => {
    expect(receivingWarnings([line({})])).toEqual([])
  })

  it('qty 0 pada barang yang masih bersisa → peringatan tidak datang', () => {
    const w = receivingWarnings([line({ qty: 0, price: 0 }), line({ name: 'B' })])
    expect(w.map(x => x.kind)).toEqual(['ZERO_QTY'])
    expect(w[0].lines).toEqual(['ACTIVE -2 (sisa 10 SAK)'])
  })

  it('barang yang sudah habis diterima (sisa 0) tidak diperingatkan', () => {
    expect(receivingWarnings([line({ remaining: 0, qty: 0, price: 0 }), line({ name: 'B' })])).toEqual([])
  })

  it('harga kosong pada barang bagus → peringatan belum ada harga; semua rusak → tidak', () => {
    expect(receivingWarnings([line({ price: 0 })]).map(x => x.kind)).toEqual(['NO_PRICE'])
    expect(receivingWarnings([line({ price: 0, damaged: 10 })])).toEqual([])
  })

  it('harga beda ≥30% dari pembanding → peringatan; tanpa pembanding → tidak', () => {
    const w = receivingWarnings([line({ price: 1_702_500 })])
    expect(w.map(x => x.kind)).toEqual(['COST_JUMP'])
    expect(w[0].lines[0]).toContain('+913%')
    expect(receivingWarnings([line({ price: 200_000 })])).toEqual([])
    expect(receivingWarnings([line({ price: 999_999, referencePrice: 0 })])).toEqual([])
  })

  it('urutan peringatan: qty 0 → harga kosong → harga melonjak', () => {
    const w = receivingWarnings([
      line({ name: 'A', qty: 0, price: 0 }),
      line({ name: 'B', price: 0 }),
      line({ name: 'C', price: 500_000 }),
    ])
    expect(w.map(x => x.kind)).toEqual(['ZERO_QTY', 'NO_PRICE', 'COST_JUMP'])
  })
})
