import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import ReceiptPrint from '@/components/pos/receipt-print'
import type { CartItem } from '@/components/pos/cart-store'
import { buildReceiptEscpos } from './escpos-receipt'
import { toReceiptPrintData, type ReceiptSource } from './receipt-data'
import {
  lineDiscountOf, lineDiscountRows, lineGrossAmount, receiptNoteDiscount, receiptSavings, savingsText,
  type ReceiptLineLike,
} from './receipt-lines'

// receipt-print.tsx tidak mengimpor React (JSX otomatis di Next); penyusun tes memakai JSX klasik.
vi.stubGlobal('React', React)

const line = (o: Partial<ReceiptLineLike> = {}): ReceiptLineLike => ({ qty: 2, unitPrice: 28000, discountAmount: 0, subtotal: 56000, ...o })
const discounted = line({ discountAmount: 6000, subtotal: 50000 })
const freeOngkir = line({ qty: 10, unitPrice: 1000, discountAmount: 10000, subtotal: 0, ongkir: { free: true } })

describe('mesin baris struk — potongan per barang', () => {
  it('baris "qty x harga" memuat nilai sebelum potongan, potongannya di baris sendiri', () => {
    expect(lineGrossAmount(discounted)).toBe(56000)
    expect(lineDiscountRows(discounted)).toEqual([{ label: 'Diskon', amount: -6000 }])
  })

  it('barang tanpa potongan tidak berubah', () => {
    expect(lineGrossAmount(line())).toBe(56000)
    expect(lineDiscountRows(line())).toEqual([])
  })

  it('baris ongkir bukan urusan mesin ini (gratis ongkir dicetak mesin ongkir)', () => {
    expect(lineDiscountOf(freeOngkir)).toBe(0)
    expect(lineDiscountRows(freeOngkir)).toEqual([])
  })

  it('angka potongan yang rusak dianggap tidak ada', () => {
    expect(lineDiscountOf(line({ discountAmount: Number.NaN }))).toBe(0)
    expect(lineDiscountOf(line({ discountAmount: -500 }))).toBe(0)
  })
})

describe('mesin baris struk — diskon nota', () => {
  it('nota lama (diskon total nota, tanpa potongan per barang): persis seperti dulu', () => {
    expect(receiptNoteDiscount({ items: [line()], discountAmount: 5000, grandTotal: 51000 })).toBe(5000)
    expect(receiptNoteDiscount({ items: [line()], discountAmount: 0, grandTotal: 56000 })).toBe(0)
  })

  it('nota kasir berdiskon per barang: tidak ada baris Subtotal / Diskon', () => {
    expect(receiptNoteDiscount({ items: [discounted, line()], discountAmount: 0, grandTotal: 106000 })).toBe(0)
  })

  it('Penjualan Grosir: diskon kepala nota sudah memuat potongan baris — hanya sisanya yang dicetak', () => {
    // potongan baris 6.000 + diskon transaksi 4.000 → kepala nota 10.000, total 46.000
    expect(receiptNoteDiscount({ items: [discounted], discountAmount: 10000, grandTotal: 46000 })).toBe(4000)
    // hanya potongan baris
    expect(receiptNoteDiscount({ items: [discounted], discountAmount: 6000, grandTotal: 50000 })).toBe(0)
  })
})

describe('mesin baris struk — "Anda hemat"', () => {
  it('menjumlahkan potongan per barang dan gratis ongkir', () => {
    expect(receiptSavings([discounted, line(), freeOngkir])).toEqual({ discount: 6000, freeShipping: 10000, total: 16000 })
    expect(receiptSavings([line()]).total).toBe(0)
  })

  it('kalimatnya menyebut sebabnya', () => {
    expect(savingsText(receiptSavings([freeOngkir]))).toBe('Anda hemat Rp 10.000 (gratis ongkir)')
    expect(savingsText(receiptSavings([discounted]))).toBe('Anda hemat Rp 6.000 (diskon)')
    expect(savingsText(receiptSavings([discounted, freeOngkir]))).toBe('Anda hemat Rp 16.000 (diskon + gratis ongkir)')
  })
})

// Tiga jalur cetak harus memperlihatkan angka yang sama untuk nota yang sama — struk pertama
// (keranjang kasir) maupun cetak ulang (baris nota dari riwayat membawa field yang sama).
describe('struk nota berdiskon per barang — printer kasir & cetak browser', () => {
  const cartItem = (o: Partial<CartItem>): CartItem => ({
    productId: 1, productName: 'WHISKAS TUNA 1KG', uomId: 1, uomCode: 'PCS', qty: 2, unitPrice: '28000',
    priceTier: 'RETAIL', discountAmount: '0', subtotal: '56000', tierPrices: {}, ...o,
  })
  const source: ReceiptSource = {
    receiptNumber: 'TRX-1',
    items: [
      cartItem({ discountAmount: '6000', subtotal: '50000' }),
      cartItem({ productId: 2, productName: 'PASIR KUCING 5L', qty: 1, unitPrice: '40000', subtotal: '40000' }),
      cartItem({ productId: 3, productName: 'ONGKIR', productKind: 'JASA_ONGKIR', ongkirFree: true, uomCode: 'METER', qty: 10, unitPrice: '1000', discountAmount: '10000', subtotal: '0' }),
    ],
    grandTotal: '90000',
    amountPaid: '100000',
    kembalian: '10000',
    paymentMethodName: 'Tunai',
    storeName: 'HAMMIELION',
    transactionDate: new Date('2026-10-12T05:00:00Z'),
    cashierName: 'Ani',
  }

  const printProps = { ...source, customerName: undefined, branchName: 'Toko' }

  it('printer kasir: nilai penuh, "Diskon -6.000" di bawah barangnya, tanpa Subtotal, hemat digabung', () => {
    const out = buildReceiptEscpos(toReceiptPrintData(source)).replace(/[\x00-\x09\x0b-\x1f]/g, '')
    expect(out).toMatch(/2 PCS x 28\.000\s+56\.000\n\s+Diskon\s+-6\.000\n/)
    expect(out).toMatch(/1 PCS x 40\.000\s+40\.000\n/)
    expect(out).not.toContain('Subtotal')
    expect(out.match(/Diskon/g)).toHaveLength(1)
    expect(out).toMatch(/TOTAL\s+90\.000/)
    expect(out.indexOf('Anda hemat Rp 16.000 (diskon + gratis ongkir)')).toBeGreaterThan(out.indexOf('TOTAL'))
  })

  it('cetak browser: isi yang sama', () => {
    const html = renderToStaticMarkup(createElement(ReceiptPrint, printProps))
    const text = html.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<[^>]+>/g, '|').replace(/&nbsp;/g, ' ').replace(/ /g, ' ')
    expect(text).toMatch(/2 PCS x Rp 28\.000\|+Rp 56\.000\|+\s*Diskon\|+-Rp 6\.000/)
    expect(text).toMatch(/1 PCS x Rp 40\.000\|+Rp 40\.000/)
    expect(text).not.toContain('Subtotal')
    expect(text.match(/Diskon/g)).toHaveLength(1)
    expect(text).toMatch(/TOTAL\|+Rp 90\.000/)
    expect(text).toContain('Anda hemat Rp 16.000 (diskon + gratis ongkir)')
  })

  it('cetak browser nota lama berdiskon total: Subtotal / Diskon tetap seperti dulu, tanpa baris hemat', () => {
    const html = renderToStaticMarkup(createElement(ReceiptPrint, {
      ...printProps, items: [cartItem({})], grandTotal: '51000', discountAmount: '5000',
    }))
    const text = html.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<[^>]+>/g, '|').replace(/ /g, ' ')
    expect(text).toMatch(/Subtotal\|+Rp 56\.000/)
    expect(text).toMatch(/Diskon\|+-Rp 5\.000/)
    expect(text).toMatch(/TOTAL\|+Rp 51\.000/)
    expect(text).not.toContain('Anda hemat')
  })
})

describe('mesin baris struk — nama promo di baris (P2e)', () => {
  it('potongan berlabel nama promo saat discountLabel diisi', () => {
    expect(lineDiscountRows(line({ discountAmount: 6000, subtotal: 50000, discountLabel: 'Promo Pakan Hemat' })))
      .toEqual([{ label: 'Promo Pakan Hemat', amount: -6000 }])
    // Label kosong kembali ke "Diskon".
    expect(lineDiscountRows(line({ discountAmount: 6000, subtotal: 50000, discountLabel: '  ' })))
      .toEqual([{ label: 'Diskon', amount: -6000 }])
  })
})

describe('struk nota berpromo — nama promo di bawah barangnya', () => {
  const cartItem = (o: Partial<CartItem>): CartItem => ({
    productId: 1, productName: 'WHISKAS TUNA 1KG', uomId: 1, uomCode: 'PCS', qty: 2, unitPrice: '28000',
    priceTier: 'RETAIL', discountAmount: '0', subtotal: '56000', tierPrices: {}, ...o,
  })
  // Layar bayar mengirim potongan promo terpisah (belum ada di keranjang) — struk harus
  // menurunkan nilai baris & mencetak nama promonya, bukan "Diskon".
  const source: ReceiptSource = {
    receiptNumber: 'TRX-PROMO',
    items: [cartItem({}), cartItem({ productId: 2, productName: 'PASIR 5L', qty: 1, unitPrice: '40000', subtotal: '40000' })],
    promos: [{ name: 'Promo Whiskas', amount: 6000 }, null],
    grandTotal: '90000',
    amountPaid: '100000',
    kembalian: '10000',
    paymentMethodName: 'Tunai',
    storeName: 'HAMMIELION',
    transactionDate: new Date('2026-10-15T05:00:00Z'),
    cashierName: 'Ani',
  }

  it('printer kasir: nilai penuh, "Promo Whiskas -6.000" di bawah barangnya, tanpa "Diskon"', () => {
    const out = buildReceiptEscpos(toReceiptPrintData(source)).replace(/[\x00-\x09\x0b-\x1f]/g, '')
    expect(out).toMatch(/2 PCS x 28\.000\s+56\.000\n\s+Promo Whiskas\s+-6\.000\n/)
    expect(out).not.toContain('Diskon')
    expect(out).toMatch(/TOTAL\s+90\.000/)
    expect(out).toContain('Anda hemat Rp 6.000 (diskon)')
  })

  it('cetak browser: nama promo di bawah barangnya, nilai baris turun', () => {
    const html = renderToStaticMarkup(createElement(ReceiptPrint, { ...source, customerName: undefined, branchName: 'Toko' }))
    const text = html.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<[^>]+>/g, '|').replace(/&nbsp;/g, ' ').replace(/ /g, ' ')
    // Nilai baris penuh (sebelum promo), nama promo + potongannya di baris sendiri.
    expect(text).toMatch(/2 PCS x Rp\s28\.000\|+Rp\s56\.000/)
    expect(text).toMatch(/Promo Whiskas\|+-Rp\s6\.000/)
    expect(text).not.toContain('Diskon')
    expect(text).toContain('Anda hemat Rp 6.000 (diskon)')
  })
})

// Penjaga: tiga penyusun struk tidak boleh menghitung potongan sendiri lagi.
describe('penjaga mesin baris struk', () => {
  it.each(['lib/escpos-receipt.ts', 'lib/receipt-image.ts', 'components/pos/receipt-print.tsx'])('%s memakai mesin baris struk', (rel) => {
    const text = readFileSync(join(__dirname, '..', rel), 'utf8')
    for (const fn of ['lineGrossAmount(', 'lineDiscountRows(', 'receiptNoteDiscount(', 'receiptSavings(', 'savingsText(']) {
      expect(text).toContain(fn)
    }
    expect(text).not.toMatch(/discountAmount\s*>\s*0/)
  })
})
