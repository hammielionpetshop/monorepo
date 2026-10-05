import { describe, expect, it } from 'vitest'
import { buildPoDocumentPages, PO_DOC_LINES, PO_DOC_WIDTH, type PoDocumentData } from './po-document-layout'
import { buildImagePdf } from './image-pdf'

function makeData(n: number, extra: Partial<PoDocumentData> = {}): PoDocumentData {
  return {
    poNumber: 'PO-20261005-0001',
    poDate: '05/10/2026',
    supplierName: 'CV Sumber Pakan',
    supplierPhone: '0812-000-111',
    branchName: 'Toko Pusat',
    targetDate: '10/10/2026',
    notes: 'Kirim pagi hari sebelum jam 10',
    items: Array.from({ length: n }, (_, i) => ({
      productName: `Produk ${i + 1}`,
      productSku: `SKU${i + 1}`,
      uomCode: 'SAK',
      qtyOrdered: 3,
    })),
    printedAt: new Date('2026-10-05T02:00:00Z'),
    ...extra,
  }
}

const allText = (pages: ReturnType<typeof buildPoDocumentPages>) => pages.flat().map((l) => l.text).join('\n')

describe('buildPoDocumentPages', () => {
  it('memuat supplier, cabang tujuan, item, tanpa harga sama sekali', () => {
    const text = allText(buildPoDocumentPages(makeData(3)))
    expect(text).toContain('PURCHASE ORDER')
    expect(text).toContain('PO-20261005-0001')
    expect(text).toContain('CV Sumber Pakan')
    expect(text).toContain('Kirim ke: Toko Pusat')
    expect(text).toContain('Produk 3')
    expect(text).not.toMatch(/Rp|Harga Satuan|Subtotal|Total:/i)
  })

  it('tiap halaman ≤ batas baris & lebar; semua item tercetak tepat sekali lintas halaman', () => {
    const pages = buildPoDocumentPages(makeData(120))
    expect(pages.length).toBeGreaterThan(1)
    for (const page of pages) {
      expect(page.length).toBeLessThanOrEqual(PO_DOC_LINES)
      for (const line of page) expect(line.text.length).toBeLessThanOrEqual(PO_DOC_WIDTH)
    }
    const numbers = pages.flat().map((l) => l.text.match(/^(\d+)\s+SKU\1\b/)?.[1]).filter(Boolean).map(Number)
    expect(numbers).toEqual(Array.from({ length: 120 }, (_, i) => i + 1))
    expect(allText([pages[0]])).toContain(`Hal 1/${pages.length}`)
    expect(allText([pages.at(-1)!])).toContain('Supplier')
  })

  it('nama produk panjang dipotong, qty & satuan tetap utuh', () => {
    const page = buildPoDocumentPages(
      makeData(1, { items: [{ productName: 'X'.repeat(120), productSku: 'A1', uomCode: 'KARTON', qtyOrdered: 12500 }] }),
    )[0]
    const row = page.find((l) => l.text.startsWith('1 '))!.text
    expect(row.length).toBe(PO_DOC_WIDTH)
    expect(row).toContain('12.500')
    expect(row.trimEnd().endsWith('KARTON')).toBe(true)
  })
})

describe('buildImagePdf', () => {
  it('xref menunjuk tepat ke setiap objek & satu halaman per gambar', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
    const pdf = buildImagePdf([
      { jpeg, widthPx: 10, heightPx: 14 },
      { jpeg, widthPx: 10, heightPx: 14 },
    ])
    const text = new TextDecoder('latin1').decode(pdf)
    expect(text.startsWith('%PDF-1.4')).toBe(true)
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true)
    expect(text).toContain('/Count 2')

    const startxref = Number(text.match(/startxref\n(\d+)/)![1])
    expect(text.slice(startxref, startxref + 4)).toBe('xref')
    const entries = text.slice(startxref).match(/^(\d{10}) 00000 n $/gm)!
    expect(entries).toHaveLength(8)
    entries.forEach((entry, i) => {
      const offset = Number(entry.slice(0, 10))
      expect(text.slice(offset, offset + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`)
    })
  })

  it('menolak PDF kosong', () => {
    expect(() => buildImagePdf([])).toThrow()
  })
})
