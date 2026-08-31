import { describe, expect, it } from 'vitest'
import { buildGoodsReceiptEscpos, type GoodsReceiptData, type GoodsReceiptItem } from './escpos-goods-receipt'

const COLUMNS = 56

function item(overrides: Partial<GoodsReceiptItem> = {}): GoodsReceiptItem {
  return {
    productName: 'WHISKAS TUNA 1KG',
    productSku: 'WHK-TUNA-1KG',
    uomCode: 'PCS',
    qtyShipped: 10,
    qtyReceived: 10,
    notes: null,
    ...overrides,
  }
}

function data(overrides: Partial<GoodsReceiptData> = {}): GoodsReceiptData {
  return {
    ibtNumber: 'IBT-20260831-0007',
    sourceBranchName: 'Toko Pusat',
    destinationBranchName: 'Toko Depan',
    receivedByName: 'Budi',
    receivedAt: new Date('2026-08-31T10:00:00Z'),
    items: [item()],
    ...overrides,
  }
}

/** Buang semua perintah ESC/POS, sisakan baris teks yang benar-benar tercetak. */
function printedLines(escpos: string): string[] {
  return escpos
    .replace(/\x1B@/g, '')
    .replace(/\x1B[Mat]./g, '')
    .replace(/\x1BE./g, '')
    .replace(/\x1Bd./g, '')
    .replace(/\x1D!./g, '')
    .replace(/\x1DV../g, '')
    .split('\n')
    .filter((line) => line.length > 0)
}

describe('lebar kertas', () => {
  it('tidak ada baris yang melebihi lebar kolom, walau nama/alasan panjang', () => {
    const escpos = buildGoodsReceiptEscpos(
      data({
        sourceBranchName: 'Gudang Regional Jakarta Barat Cengkareng Kawasan Pergudangan Blok C',
        receivedByName: 'Bapak Muhammad Abdurrahman Wahid Yang Terhormat Sekali',
        items: [
          item({
            productName: 'ROYAL CANIN PERSIAN ADULT DRY CAT FOOD KEMASAN BESAR 10 KILOGRAM',
            productSku: 'RC-PERSIAN-ADULT-10KG-IMPORT',
            qtyReceived: 7,
            notes: 'Tiga sak rusak saat bongkar muat, kemasan sobek dan isinya tumpah tercampur pasir',
          }),
        ],
      })
    )
    for (const line of printedLines(escpos)) {
      expect(line.length).toBeLessThanOrEqual(COLUMNS)
    }
  })
})

describe('isi BPB', () => {
  it('hanya menampilkan item dengan qty terima > 0', () => {
    const lines = printedLines(
      buildGoodsReceiptEscpos(
        data({
          items: [
            item({ productName: 'PRODUK DITERIMA', qtyReceived: 5 }),
            item({ productName: 'PRODUK NIHIL', qtyReceived: 0 }),
          ],
        })
      )
    )
    expect(lines.some((l) => l.includes('PRODUK DITERIMA'))).toBe(true)
    expect(lines.some((l) => l.includes('PRODUK NIHIL'))).toBe(false)
    expect(lines.find((l) => l.startsWith('Total Jenis Barang'))!.trim().endsWith('1')).toBe(true)
  })

  it('menampilkan selisih dan alasan hanya bila kurang terima', () => {
    const pas = printedLines(buildGoodsReceiptEscpos(data({ items: [item({ qtyShipped: 10, qtyReceived: 10 })] })))
    expect(pas.some((l) => l.includes('Selisih'))).toBe(false)

    const kurang = printedLines(
      buildGoodsReceiptEscpos(
        data({ items: [item({ qtyShipped: 10, qtyReceived: 7, notes: 'dus penyok' })] })
      )
    )
    expect(kurang.some((l) => l.includes('Selisih: -3'))).toBe(true)
    expect(kurang.some((l) => l.includes('Alasan: dus penyok'))).toBe(true)
  })

  it('menandai cetak ulang bila diminta', () => {
    const biasa = printedLines(buildGoodsReceiptEscpos(data()))
    expect(biasa.some((l) => l.includes('CETAK ULANG'))).toBe(false)

    const ulang = printedLines(buildGoodsReceiptEscpos(data({ isReprint: true })))
    expect(ulang.some((l) => l.includes('*** CETAK ULANG ***'))).toBe(true)
  })

  it('nama toko jatuh ke HAMMIELION bila tidak diberikan', () => {
    expect(printedLines(buildGoodsReceiptEscpos(data()))[0]).toBe('HAMMIELION')
  })

  it('membawa nomor, tujuan, dan penerima', () => {
    const lines = printedLines(buildGoodsReceiptEscpos(data()))
    expect(lines.some((l) => l.includes('IBT-20260831-0007'))).toBe(true)
    expect(lines.some((l) => l.includes('Toko Depan'))).toBe(true)
    expect(lines.some((l) => l.includes('Penerima: Budi'))).toBe(true)
  })

  it('cabang asal kosong ditulis "-"', () => {
    const lines = printedLines(buildGoodsReceiptEscpos(data({ sourceBranchName: null })))
    expect(lines.some((l) => l.trim() === 'Dari: -')).toBe(true)
  })
})

describe('keamanan CP437', () => {
  it('seluruh keluaran bebas dari karakter di luar ASCII cetak', () => {
    const escpos = buildGoodsReceiptEscpos(
      data({
        items: [item({ productName: 'CAT FOOD × PREMIUM …', notes: 'kemasan “sobek” – parah' })],
        receivedByName: 'Budi “Bos”',
      })
    )
    for (const line of printedLines(escpos)) {
      expect(line).toMatch(/^[\x20-\x7E]*$/)
    }
  })
})

describe('perintah printer', () => {
  it('diawali inisialisasi, tabel kode, dan pemilihan font', () => {
    expect(buildGoodsReceiptEscpos(data()).startsWith('\x1B@\x1Bt\x00\x1BM')).toBe(true)
  })

  it('diakhiri feed lalu potong kertas', () => {
    expect(buildGoodsReceiptEscpos(data()).endsWith('\x1Bd\x04\x1DV\x42\x00')).toBe(true)
  })

  it('tidak meninggalkan bold atau rata tengah menyala di akhir', () => {
    const escpos = buildGoodsReceiptEscpos(data({ isReprint: true }))
    expect(escpos.lastIndexOf('\x1BE\x00')).toBeGreaterThan(escpos.lastIndexOf('\x1BE\x01'))
    expect(escpos.lastIndexOf('\x1Ba\x00')).toBeGreaterThan(escpos.lastIndexOf('\x1Ba\x01'))
  })
})
