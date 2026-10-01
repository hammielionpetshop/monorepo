import { describe, expect, it } from 'vitest'
import { NOTE_WIDTH, buildDeliveryNotePages, buildDeliveryNoteRoll, type DeliveryNoteData } from './delivery-note-layout'
import { FEED_AND_CUT, INIT, SELECT_FONT_B, THERMAL_COLUMNS } from './escpos-common'
import { buildDeliveryNoteThermalEscpos } from './escpos-delivery-note'

function makeData(n: number, extra: Partial<DeliveryNoteData> = {}): DeliveryNoteData {
  return {
    transactionNumber: 'TRX-20261002-0001',
    transactionDate: '02/10/2026 09:00',
    branchName: 'Gudang',
    customerName: 'Toko Depan',
    staffName: 'Budi',
    items: Array.from({ length: n }, (_, i) => ({
      id: i,
      productCode: '',
      productName: `Produk ${i + 1}`,
      uomCode: 'PCS',
      qty: 1,
      unitPrice: 1000,
      subtotal: 1000,
    })),
    ...extra,
  }
}

describe('Surat Jalan termal 80mm', () => {
  it('lebar nota = lebar Font B termal, jadi baris dot-matrix muat apa adanya', () => {
    expect(NOTE_WIDTH).toBe(THERMAL_COLUMNS)
  })

  it('satu gulungan tanpa pemecahan halaman meski item banyak', () => {
    const roll = buildDeliveryNoteRoll(makeData(60))
    const text = roll.map((l) => l.text).join('\n')
    expect(text).not.toContain('Hal ')
    expect(text).not.toContain('Bersambung')
    expect(text.match(/NOTA PENJUALAN|SURAT JALAN/g)).toHaveLength(1)
    expect(roll.filter((l) => /^\d+ +Produk/.test(l.text))).toHaveLength(60)
  })

  it('isi gulungan = gabungan halaman dot-matrix untuk nota satu lembar', () => {
    const data = makeData(3, { withPrice: true, grandTotal: 3000 })
    expect(buildDeliveryNoteRoll(data)).toEqual(buildDeliveryNotePages(data)[0])
  })

  it('ESC/POS: init, Font B, isi, potong kertas', () => {
    const escpos = buildDeliveryNoteThermalEscpos(makeData(2))
    expect(escpos.startsWith(INIT)).toBe(true)
    expect(escpos).toContain(SELECT_FONT_B)
    expect(escpos.endsWith(FEED_AND_CUT)).toBe(true)
    expect(escpos).toContain('SURAT JALAN')
  })

  it('karakter non-ASCII dibersihkan sebelum disusun sehingga kolom tetap lurus', () => {
    const data = makeData(1)
    data.items[0].productName = 'Café Snack'
    const lines = buildDeliveryNoteThermalEscpos(data).split('\n')
    const row = lines.find((l) => l.startsWith('1 '))!
    expect(row).toContain('Caf Snack')
    expect(row.length).toBe(NOTE_WIDTH)
  })
})
