import { describe, expect, it } from 'vitest'
import {
  BODY_LINES,
  NOTE_WIDTH,
  PAGE_LINES,
  buildDeliveryNotePages,
  itemColumnWidths,
  paginateItems,
  wrapLabeled,
  type DeliveryNoteData,
  type DeliveryNoteItem,
} from './delivery-note-layout'
import { buildDeliveryNoteEscp } from './qz-print'

function makeItems(n: number, weightGram: number | null = 1000): DeliveryNoteItem[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    productCode: `SKU${i + 1}`,
    productName: `Produk ${i + 1}`,
    uomCode: 'PCS',
    qty: 2,
    unitPrice: 15000,
    subtotal: 30000,
    weightGram,
  }))
}

function makeData(n: number, extra: Partial<DeliveryNoteData> = {}): DeliveryNoteData {
  return {
    transactionNumber: 'TRX-20261001-0001',
    transactionDate: '01/10/2026 10:00',
    branchName: 'Toko Pusat',
    customerName: 'Pelanggan Grosir',
    staffName: 'Andi',
    items: makeItems(n),
    ...extra,
  }
}

function itemNumbers(pages: ReturnType<typeof buildDeliveryNotePages>) {
  return pages.flatMap((page) =>
    page.map((l) => l.text.match(/^(\d+)\s+Produk \1\b/)?.[1]).filter(Boolean).map(Number),
  )
}

describe('paginateItems', () => {
  const cap = (full: number, last: number) => (_page: number, isLast: boolean) => (isLast ? last : full)

  it('muat satu halaman bila jumlah item ≤ kapasitas halaman terakhir', () => {
    expect(paginateItems([1, 2, 3], cap(5, 3))).toEqual([[1, 2, 3]])
  })

  it('halaman terakhir tidak pernah kosong (tanda tangan butuh minimal satu item)', () => {
    // 4 item, halaman penuh muat 5 tapi halaman akhir cuma 3 → jangan [4 item] + [].
    expect(paginateItems([1, 2, 3, 4], cap(5, 3))).toEqual([[1, 2, 3], [4]])
  })

  it('halaman tengah diisi penuh', () => {
    const pages = paginateItems(Array.from({ length: 12 }, (_, i) => i), cap(5, 3))
    expect(pages.map((p) => p.length)).toEqual([5, 5, 2])
  })

  it('kapasitas boleh beda per halaman (lembar pertama membawa blok customer)', () => {
    const capacity = (page: number, isLast: boolean) => (isLast ? 3 : 5) - (page === 0 ? 2 : 0)
    const pages = paginateItems(Array.from({ length: 10 }, (_, i) => i), capacity)
    expect(pages.map((p) => p.length)).toEqual([3, 5, 2])
  })

  it('daftar kosong tetap menghasilkan satu halaman', () => {
    expect(paginateItems([], cap(5, 3))).toEqual([[]])
  })
})

describe('wrapLabeled', () => {
  it('membungkus per kata dengan indent selebar label', () => {
    expect(wrapLabeled('Alamat: ', 'Jl. Mawar No. 12 Blok C Kel. Sukamaju', 24, 3)).toEqual([
      'Alamat: Jl. Mawar No. 12',
      '        Blok C Kel.',
      '        Sukamaju',
    ])
  })

  it('memotong kelebihan baris dengan penanda ..', () => {
    const lines = wrapLabeled('Alamat: ', 'satu dua tiga empat lima enam tujuh delapan', 20, 2)
    expect(lines).toHaveLength(2)
    expect(lines[1].endsWith('..')).toBe(true)
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(20)
  })
})

describe('buildDeliveryNotePages — kertas 9.5" x 5.5"', () => {
  it.each([
    ['tanpa harga', false],
    ['dengan harga', true],
  ])('setiap halaman ≤ %s baris isi & ≤ lebar kolom (%s)', (_label, withPrice) => {
    for (const n of [1, 5, 9, 10, 14, 15, 16, 30, 60]) {
      const pages = buildDeliveryNotePages(
        makeData(n, {
          withPrice,
          grandTotal: 30000 * n,
          isVoided: true,
          customerPhone: '081234567890',
          customerAddress: 'Jl. Raya Cibubur No. 123 RT 004/RW 005 Kel. Cibubur Kec. Ciracas Jakarta Timur 13720',
        }),
      )
      for (const page of pages) {
        expect(page.length).toBeLessThanOrEqual(BODY_LINES)
        for (const line of page) expect(line.text.length).toBeLessThanOrEqual(NOTE_WIDTH)
      }
    }
  })

  it('semua item tercetak tepat sekali dan nomor urut berlanjut lintas halaman', () => {
    const pages = buildDeliveryNotePages(makeData(45))
    expect(pages.length).toBeGreaterThan(1)
    expect(itemNumbers(pages)).toEqual(Array.from({ length: 45 }, (_, i) => i + 1))
  })

  it('nota pendek = satu lembar tanpa label halaman', () => {
    const pages = buildDeliveryNotePages(makeData(5))
    expect(pages).toHaveLength(1)
    expect(pages[0].some((l) => l.text.includes('Hal '))).toBe(false)
  })

  it('nota panjang: header diulang, label Hal x/y, tanda tangan & tonase hanya di lembar terakhir', () => {
    const pages = buildDeliveryNotePages(makeData(40, { withPrice: true, grandTotal: 1_200_000 }))
    const total = pages.length
    pages.forEach((page, i) => {
      const text = page.map((l) => l.text).join('\n')
      const isLast = i === total - 1
      expect(text).toContain('NOTA PENJUALAN')
      expect(text).not.toContain('SURAT JALAN')
      expect(text).toContain('TRX-20261001-0001')
      expect(text).toContain(`Hal ${i + 1}/${total}`)
      expect(text.includes('Penerima')).toBe(isLast)
      expect(text.includes('TONASE')).toBe(isLast)
      expect(text.includes('TOTAL: Rp')).toBe(isLast)
      expect(text.includes('Bersambung')).toBe(!isLast)
      expect(text.includes('2x24 jam')).toBe(isLast)
    })
  })

  it('judul: tanpa harga = SURAT JALAN, dengan harga = NOTA PENJUALAN', () => {
    const title = (withPrice: boolean) => buildDeliveryNotePages(makeData(1, { withPrice }))[0][1].text.trim()
    expect(title(false)).toBe('SURAT JALAN')
    expect(title(true)).toBe('NOTA PENJUALAN')
  })

  it('kolom Qty sebelum Satuan, header memakai "Satuan" bukan "UOM"', () => {
    for (const withPrice of [false, true]) {
      const page = buildDeliveryNotePages(makeData(1, { withPrice }))[0]
      const header = page.find((l) => l.text.includes('Nama Produk'))!.text
      expect(header).not.toContain('UOM')
      expect(header.indexOf('Qty')).toBeLessThan(header.indexOf('Satuan'))
      const row = page.find((l) => l.text.startsWith('1 '))!.text
      expect(row.indexOf(' 2 ')).toBeLessThan(row.indexOf('PCS'))
    }
  })

  it('telepon & alamat customer hanya di lembar pertama; baris dihilangkan bila kosong', () => {
    const withContact = buildDeliveryNotePages(
      makeData(45, { customerPhone: '0812-111-222', customerAddress: 'Jl. Melati 5, Bogor' }),
    )
    const first = withContact[0].map((l) => l.text).join('\n')
    expect(first).toContain('Telp  : 0812-111-222')
    expect(first).toContain('Alamat: Jl. Melati 5, Bogor')
    for (const page of withContact.slice(1)) {
      expect(page.some((l) => l.text.startsWith('Telp') || l.text.startsWith('Alamat'))).toBe(false)
    }

    const without = buildDeliveryNotePages(makeData(3, { customerPhone: null, customerAddress: '  ' }))[0]
    expect(without.some((l) => l.text.startsWith('Telp') || l.text.startsWith('Alamat'))).toBe(false)
  })

  it('catatan cek barang & komplain 2x24 jam di atas jam cetak', () => {
    const page = buildDeliveryNotePages(makeData(3))[0]
    expect(page.at(-3)!.text).toContain('cek jumlah & kondisi barang')
    expect(page.at(-2)!.text).toContain('2x24 jam')
  })

  it('jam cetak (WIB) rata kanan di baris paling bawah lembar terakhir saja', () => {
    // 02:15 UTC = 09:15 WIB
    const pages = buildDeliveryNotePages(makeData(45, { printedAt: new Date('2026-10-02T02:15:00Z') }))
    const last = pages.at(-1)!.at(-1)!.text
    expect(last.length).toBe(NOTE_WIDTH)
    expect(last.trimStart()).toMatch(/^Dicetak: 02\/10\/2026,? 09[.:]15$/)
    for (const page of pages.slice(0, -1)) expect(page.some((l) => l.text.includes('Dicetak'))).toBe(false)
  })

  it('nama customer dicetak lebar ganda & tebal, muat setengah lebar nota; staf di baris sendiri', () => {
    const page = buildDeliveryNotePages(makeData(1, { customerName: 'PT Sumber Makmur Jaya' }))[0]
    const name = page.find((l) => l.text.startsWith('Kepada:'))!
    expect(name).toMatchObject({ bold: true, wide: true })
    expect(name.text.length).toBe(NOTE_WIDTH / 2)
    expect(name.text.trimEnd()).toBe('Kepada: PT Sumber Makmur Jaya')
    expect(page.some((l) => l.text.trimEnd() === 'Staf  : Andi' && !l.wide)).toBe(true)
  })

  it('nama customer panjang dibungkus maksimal 2 baris lebar ganda', () => {
    const page = buildDeliveryNotePages(makeData(1, { customerName: 'KATA '.repeat(30) }))[0]
    const wide = page.filter((l) => l.wide)
    expect(wide).toHaveLength(2)
    for (const l of wide) expect(l.text.length).toBe(NOTE_WIDTH / 2)
    expect(wide[1].text.trimEnd().endsWith('..')).toBe(true)
  })
})

describe('itemColumnWidths — kolom angka selebar isinya, sisa untuk nama', () => {
  it('nota seperti sistem lama: nama 26 karakter muat utuh di versi harga', () => {
    const items = makeItems(16).map((i) => ({
      ...i,
      productName: 'CRYSTAL HAMSTER STRAWBERRY',
      unitPrice: 335000,
      subtotal: 335000,
      uomCode: 'SAK',
    }))
    const pages = buildDeliveryNotePages(makeData(16, { items, withPrice: true, grandTotal: 6402000 }))
    const row = pages[0].find((l) => l.text.startsWith('1 '))!.text
    expect(row).toContain('CRYSTAL HAMSTER STRAWBERRY')
    expect(row.length).toBe(NOTE_WIDTH)
  })

  it('kolom angka tidak pernah memotong angka besar; nama yang menyempit', () => {
    const items = makeItems(1).map((i) => ({ ...i, qty: 12000, unitPrice: 12500000, subtotal: 150000000000 }))
    const w = itemColumnWidths(items, true, NOTE_WIDTH)
    expect(w.subtotal).toBe('150.000.000.000'.length)
    const page = buildDeliveryNotePages(makeData(1, { items, withPrice: true }))[0]
    const row = page.find((l) => l.text.startsWith('1 '))!.text
    expect(row).toContain('12.000')
    expect(row).toContain('12.500.000')
    expect(row).toContain('150.000.000.000')
    expect(row.length).toBe(NOTE_WIDTH)
  })

  it('lebar kolom minimal = judul kolom; total pas selebar nota', () => {
    const w = itemColumnWidths(makeItems(1).map((i) => ({ ...i, qty: 1, uomCode: 'KG' })), true, NOTE_WIDTH)
    expect(w).toMatchObject({ no: 2, qty: 3, uom: 6, price: 6, subtotal: 8 })
    expect(w.no + w.name + w.qty + w.uom + w.price + w.subtotal + 5).toBe(NOTE_WIDTH)
  })
})

describe('buildDeliveryNoteEscp', () => {
  it('menyetel condensed 17 cpi dan panjang lembar 33 baris pada 6 lpi sebelum isi', () => {
    const escp = buildDeliveryNoteEscp(makeData(3))
    expect(PAGE_LINES).toBe(33)
    expect(escp.startsWith('\x1B@\x1BP\x0F\x1B2\x1BC' + String.fromCharCode(33))).toBe(true)
  })

  it('baris nama customer diapit ESC W 1 / ESC W 0 (lebar ganda)', () => {
    const escp = buildDeliveryNoteEscp(makeData(3, { customerName: 'Budi' }))
    expect(escp).toMatch(/\x1BE\x1BW\x01Kepada: Budi\s*\x1BW\x00\x1BF/)
  })

  it('satu form feed per lembar', () => {
    const data = makeData(45)
    const pages = buildDeliveryNotePages(data).length
    const escp = buildDeliveryNoteEscp(data)
    expect(escp.split('\x0C').length - 1).toBe(pages)
    expect(escp.endsWith('\x0C')).toBe(true)
  })
})
