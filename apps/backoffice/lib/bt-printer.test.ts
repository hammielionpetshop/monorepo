import { describe, expect, it } from 'vitest'
import { BT_CHUNK_SIZE, chunkBytes, escposToBytes } from './bt-printer'
import { buildReceiptEscpos } from './escpos-receipt'

describe('escposToBytes', () => {
  it('memetakan byte perintah dan teks ASCII apa adanya', () => {
    const bytes = escposToBytes('\x1B@AB\x1DV\x42\x00')
    expect(Array.from(bytes)).toEqual([0x1b, 0x40, 0x41, 0x42, 0x1d, 0x56, 0x42, 0x00])
  })

  it('panjang byte sama dengan panjang string struk', () => {
    const escpos = buildReceiptEscpos({
      storeName: 'HAMMIELION',
      storeAddress: 'Jl. Contoh No. 1',
      receiptNumber: 'TRX-20261002-0001',
      transactionDate: '02/10/2026 10.00.00',
      cashierName: 'Budi',
      items: [
        { productName: 'WHISKAS TUNA 1KG', uomCode: 'PCS', qty: 2, unitPrice: 28000, discountAmount: 0, subtotal: 56000 },
      ],
      discountAmount: 0,
      grandTotal: 56000,
      amountPaid: 100000,
      change: 44000,
      paymentMethodName: 'Tunai',
    })
    const bytes = escposToBytes(escpos)
    expect(bytes.length).toBe(escpos.length)
    expect(bytes.every((b, i) => b === escpos.charCodeAt(i))).toBe(true)
  })
})

describe('chunkBytes', () => {
  it('memotong sesuai ukuran dan sisa jadi potongan terakhir', () => {
    const chunks = chunkBytes(new Uint8Array(250), 100)
    expect(chunks.map((c) => c.length)).toEqual([100, 100, 50])
  })

  it('data kosong menghasilkan nol potongan', () => {
    expect(chunkBytes(new Uint8Array(0))).toEqual([])
  })

  it('menyambung kembali menjadi data semula', () => {
    const src = Uint8Array.from({ length: 333 }, (_, i) => i % 256)
    const joined = chunkBytes(src).flatMap((c) => Array.from(c))
    expect(joined).toEqual(Array.from(src))
    expect(chunkBytes(src).every((c) => c.length <= BT_CHUNK_SIZE)).toBe(true)
  })

  it('menolak ukuran nol', () => {
    expect(() => chunkBytes(new Uint8Array(5), 0)).toThrow()
  })
})
