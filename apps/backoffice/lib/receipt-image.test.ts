import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReceiptSource } from './receipt-data'
import { renderReceiptImages } from './receipt-image'

const source: ReceiptSource = {
  storeName: 'Toko Cabang Selatan',
  storeAddress: 'Jalan Mawar Nomor 10',
  storePhone: '08123456789',
  receiptNumber: 'TRX/123',
  transactionDate: new Date('2026-10-03T05:00:00Z'),
  cashierName: 'Ani',
  customerName: 'Budi',
  grandTotal: '90000',
  discountAmount: '10000',
  amountPaid: '100000',
  kembalian: '10000',
  paymentMethodName: 'Tunai + QRIS',
  payments: [
    { name: 'Tunai', amount: '60000' },
    { name: 'QRIS', amount: '40000' },
  ],
  items: [
    {
      productId: 1,
      productName: 'Pakan Kucing',
      uomId: 1,
      uomCode: 'PCS',
      qty: 2,
      unitPrice: '50000',
      subtotal: '90000',
      discountAmount: '10000',
      priceTier: 'RETAIL',
      tierPrices: {},
    },
  ],
}

function stubCanvas(failure?: 'context' | 'blob') {
  const pages: { texts: string[]; width: number; height: number }[] = []
  vi.stubGlobal('document', {
    fonts: { ready: Promise.resolve() },
    createElement: () => {
      const page = { texts: [] as string[], width: 0, height: 0 }
      const canvas = Object.assign(page, {
        getContext: () =>
          failure === 'context'
            ? null
            : {
                font: '',
                textAlign: '',
                textBaseline: '',
                fillStyle: '',
                measureText: (text: string) => ({
                  width: Array.from(text).length * 16,
                }),
                fillRect: vi.fn(),
                fillText: (text: string) => page.texts.push(text),
              },
        toBlob: (cb: (blob: Blob | null) => void) =>
          cb(
            failure === 'blob' ? null : new Blob(['png'], { type: 'image/png' })
          ),
      })
      pages.push(page)
      return canvas
    },
  })
  return pages
}

afterEach(() => vi.unstubAllGlobals())

describe('PNG struk kasir', () => {
  it('memuat identitas cabang, tanggal WIB, diskon, total, split payment dan kembalian', async () => {
    const pages = stubCanvas()
    const result = await renderReceiptImages({ ...source, isReprint: true })
    const texts = pages.flatMap((page) => page.texts)
    for (const value of [
      'Toko Cabang Selatan',
      'Jalan Mawar Nomor 10',
      'Telp: 08123456789',
      'STRUK PENJUALAN',
      '*** COPY / CETAK ULANG ***',
      'No: TRX/123',
      'Kasir: Ani',
      'Pelanggan: Budi',
      'Pakan Kucing',
      'Subtotal',
      'Diskon',
      'TOTAL',
      'Tunai',
      'QRIS',
      'Kembalian',
      'Rp 100.000',
      '-Rp 10.000',
      'Rp 90.000',
      'Rp 60.000',
      'Rp 40.000',
      'Rp 10.000',
    ]) {
      expect(texts).toContain(value)
    }
    expect(texts.find((text) => text.startsWith('Tgl:'))).toContain('12.00.00')
    expect(result[0].fileName).toBe('Budi-TRX-123.png')
    expect(result[0].blob.type).toBe('image/png')
  })

  it('menandai VOID dan memakai pembayaran tunggal jika payments kosong', async () => {
    const pages = stubCanvas()
    await renderReceiptImages({
      ...source,
      isVoided: true,
      isReprint: true,
      payments: [],
      paymentMethodName: 'Transfer',
    })
    const texts = pages.flatMap((page) => page.texts)
    expect(texts).toContain('*** VOID / BATAL ***')
    expect(texts).not.toContain('*** COPY / CETAK ULANG ***')
    expect(texts).toContain('Transfer')
    expect(texts).toContain('Rp 100.000')
  })

  it('membungkus nama panjang dan mengekspor struk panjang tanpa kehilangan item', async () => {
    const pages = stubCanvas()
    const input = {
      ...source,
      items: Array.from({ length: 180 }, (_, i) => ({
        ...source.items[0],
        productId: i,
        productName: `Produk-${i}`,
      })),
    }
    input.items[0].productName = 'X'.repeat(150)
    const result = await renderReceiptImages(input)
    expect(result.length).toBeGreaterThan(1)
    const texts = pages.flatMap((page) => page.texts)
    expect(texts.filter((text) => /^X+$/.test(text)).join('')).toBe(
      'X'.repeat(150)
    )
    for (let i = 1; i < 180; i++) expect(texts).toContain(`Produk-${i}`)
    expect(result.map((image) => image.fileName)).toEqual(
      result.map((_, i) => `Budi-TRX-123-halaman-${i + 1}.png`)
    )
    expect(pages.every((page) => page.height < 8192)).toBe(true)
    expect(texts.every((text) => Array.from(text).length * 16 <= 880)).toBe(
      true
    )
  })

  it('memakai nomor transaksi saja jika customer kosong', async () => {
    stubCanvas()
    const result = await renderReceiptImages({ ...source, customerName: null })
    expect(result[0].fileName).toBe('TRX-123.png')
  })

  it.each(['context', 'blob'] as const)(
    'melaporkan kegagalan %s',
    async (failure) => {
      stubCanvas(failure)
      await expect(renderReceiptImages(source)).rejects.toThrow(
        'Gambar gagal dibuat'
      )
    }
  )
})
