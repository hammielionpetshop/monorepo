import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderDeliveryNoteImages } from './delivery-note-image'
import {
  buildDeliveryNotePages,
  type DeliveryNoteData,
} from './delivery-note-layout'

const data: DeliveryNoteData = {
  transactionNumber: 'TRX/001',
  transactionDate: '03/10/2026 12:00',
  branchName: 'Pusat',
  customerName: 'Toko Tujuan',
  customerPhone: '08123456789',
  customerAddress: 'Jalan Mawar',
  staffName: 'Kasir',
  printedAt: '2026-10-03T05:00:00Z',
  grandTotal: 125000,
  items: [
    {
      id: 1,
      productCode: 'SKU1',
      productName: 'Pakan Kucing',
      uomCode: 'PCS',
      qty: 1,
      unitPrice: 125000,
      subtotal: 125000,
      weightGram: 1000,
    },
  ],
}

function canvasDocument(
  options: { noContext?: boolean; noBlob?: boolean } = {}
) {
  const drawn: string[][] = []
  const canvases: { width: number; height: number }[] = []
  vi.stubGlobal('document', {
    fonts: { ready: Promise.resolve() },
    createElement: () => {
      const lines: string[] = []
      drawn.push(lines)
      const canvas = {
        width: 0,
        height: 0,
        getContext: () =>
          options.noContext
            ? null
            : {
                font: '',
                fillStyle: '',
                textBaseline: '',
                measureText: (text: string) => ({ width: text.length * 12 }),
                fillRect: vi.fn(),
                fillText: (text: string) => lines.push(text),
              },
        toBlob: (cb: (blob: Blob | null) => void) =>
          cb(options.noBlob ? null : new Blob(['png'], { type: 'image/png' })),
      }
      canvases.push(canvas)
      return canvas
    },
  })
  return { drawn, canvases }
}

afterEach(() => vi.unstubAllGlobals())

describe('PNG surat jalan dan nota', () => {
  it.each([false, true])(
    'memuat isi dokumen cetak lengkap, withPrice=%s',
    async (withPrice) => {
      const { drawn, canvases } = canvasDocument()
      const input = { ...data, withPrice, isVoided: true }
      const result = await renderDeliveryNoteImages(input)
      expect(drawn).toEqual(
        buildDeliveryNotePages(input).map((page) =>
          page.map((line) => line.text)
        )
      )
      expect(drawn.flat().join('\n')).toContain('VOID')
      expect(drawn.flat().join('\n')).toContain('08123456789')
      expect(drawn.flat().join('\n').includes('125.000')).toBe(withPrice)
      expect(result[0].fileName).toBe('Toko Tujuan-TRX-001.png')
      expect(result[0].blob.type).toBe('image/png')
      expect(
        canvases.every((canvas) => canvas.width > 0 && canvas.height > 0)
      ).toBe(true)
    }
  )

  it('mengekspor semua halaman beserta nama unik tanpa kehilangan item', async () => {
    const { drawn } = canvasDocument()
    const input = {
      ...data,
      items: Array.from({ length: 80 }, (_, i) => ({
        ...data.items[0],
        id: i,
        productName: `Produk ${i}`,
      })),
    }
    const result = await renderDeliveryNoteImages(input)
    expect(result.length).toBeGreaterThan(1)
    expect(drawn).toEqual(
      buildDeliveryNotePages(input).map((page) => page.map((line) => line.text))
    )
    expect(result.map((image) => image.fileName)).toEqual(
      result.map((_, i) => `Toko Tujuan-TRX-001-halaman-${i + 1}.png`)
    )
  })

  it('tidak memotong kolom angka dan satuan yang melampaui 64 karakter', async () => {
    const { drawn, canvases } = canvasDocument()
    const input = {
      ...data,
      withPrice: true,
      items: [
        {
          ...data.items[0],
          uomCode: 'ABCDEFGHIJ',
          qty: 1_000_000_000,
          unitPrice: 1,
          subtotal: 1_000_000_000,
        },
        {
          ...data.items[0],
          id: 2,
          uomCode: 'ABCDEFGHIJ',
          qty: 1,
          unitPrice: 1_000_000_000,
          subtotal: 1_000_000_000,
        },
      ],
    }
    await renderDeliveryNoteImages(input)
    const maxLength = Math.max(...drawn.flat().map((line) => line.length))
    expect(maxLength).toBeGreaterThan(64)
    expect(canvases[0].width).toBeGreaterThanOrEqual(maxLength * 12 + 96)
  })

  it('tidak memakai label customer Umum jika transaksi tidak memiliki customer', async () => {
    canvasDocument()
    const result = await renderDeliveryNoteImages({
      ...data,
      customerName: 'Umum',
      filenameCustomerName: null,
    })
    expect(result[0].fileName).toBe('TRX-001.png')
  })

  it.each([{ noContext: true }, { noBlob: true }])(
    'melaporkan gambar gagal dibuat: %j',
    async (options) => {
      canvasDocument(options)
      await expect(renderDeliveryNoteImages(data)).rejects.toThrow(
        'Gambar gagal dibuat'
      )
    }
  )
})
