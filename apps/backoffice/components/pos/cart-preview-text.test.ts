import { describe, it, expect } from 'vitest'
import {
  buildCartPreviewText,
  buildPreviewFileName,
  formatQty,
  formatRupiahPlain,
} from './cart-preview-text'
import type { CartItem } from './cart-store'

const item = (over: Partial<CartItem> = {}): CartItem => ({
  productId: 1,
  productName: 'TROPICAL FISH FOOD 100GR',
  uomId: 5,
  uomCode: 'PCS',
  qty: 2,
  unitPrice: '25000',
  priceTier: 'RESELLER',
  discountAmount: '0',
  subtotal: '50000',
  tierPrices: { RETAIL: '30000', RESELLER: '25000' },
  ...over,
})

const meta = {
  storeName: 'HAMMIELION',
  dateLabel: '08 Sep 2026 14:32',
}

describe('formatRupiahPlain', () => {
  it('memberi pemisah ribuan tanpa spasi tak-putus', () => {
    expect(formatRupiahPlain('1234000')).toBe('Rp 1.234.000')
    expect(formatRupiahPlain('0')).toBe('Rp 0')
    expect(formatRupiahPlain('999')).toBe('Rp 999')
  })

  it('membulatkan pecahan ke rupiah utuh', () => {
    expect(formatRupiahPlain('12500.4')).toBe('Rp 12.500')
  })
})

describe('formatQty', () => {
  it('memakai koma sebagai pemisah desimal', () => {
    expect(formatQty(1.5)).toBe('1,5')
    expect(formatQty(3)).toBe('3')
  })
})

describe('buildCartPreviewText', () => {
  it('mencantumkan tiap item beserta harga satuan dan subtotalnya', () => {
    const text = buildCartPreviewText([item(), item({ productId: 2, productName: 'JAGUNG TT', uomCode: 'KG', qty: 4, unitPrice: '9000', subtotal: '36000' })], meta)

    expect(text).toContain('1. TROPICAL FISH FOOD 100GR')
    expect(text).toContain('2 PCS x Rp 25.000 = Rp 50.000')
    expect(text).toContain('2. JAGUNG TT')
    expect(text).toContain('4 KG x Rp 9.000 = Rp 36.000')
    expect(text).toContain('2 produk')
    expect(text).toContain('*TOTAL: Rp 86.000*')
  })

  it('memakai nama di struk saja sebagai kop, tanpa nama cabang', () => {
    const text = buildCartPreviewText([item()], meta)

    expect(text.split('\n')[0]).toBe('*HAMMIELION*')
  })

  it('menyebut nama pelanggan hanya kalau ada', () => {
    expect(buildCartPreviewText([item()], meta)).not.toContain('Pelanggan:')
    expect(buildCartPreviewText([item()], { ...meta, customerName: 'Budi' })).toContain('Pelanggan: Budi')
  })

  it('menghapus semua angka harga saat showPrices dimatikan', () => {
    const text = buildCartPreviewText([item()], { ...meta, showPrices: false })

    expect(text).toContain('2 PCS')
    expect(text).not.toContain('Rp')
    expect(text).not.toContain('TOTAL')
  })

  it('tidak menghitung total untuk keranjang kosong', () => {
    const text = buildCartPreviewText([], meta)

    expect(text).toContain('(keranjang kosong)')
    expect(text).not.toContain('TOTAL')
  })
})

describe('buildPreviewFileName', () => {
  const at = new Date(2026, 8, 8, 14, 32)

  it('menyusun nama berkas dari toko, pelanggan, dan waktunya', () => {
    expect(buildPreviewFileName({ storeName: 'HAMMIELION', customerName: 'Budi Santoso', at })).toBe(
      'Rincian-Pesanan_HAMMIELION_Budi-Santoso_20260908-1432'
    )
  })

  it('melewati bagian pelanggan kalau belum dipilih', () => {
    expect(buildPreviewFileName({ storeName: 'HAMMIELION', at })).toBe(
      'Rincian-Pesanan_HAMMIELION_20260908-1432'
    )
  })

  it('membuang karakter yang tidak boleh jadi nama berkas', () => {
    const name = buildPreviewFileName({
      storeName: 'Toko A/B: "Petshop"',
      customerName: 'PT. Maju\\Jaya',
      at,
    })

    expect(name).toBe('Rincian-Pesanan_Toko-A-B-Petshop_PT-Maju-Jaya_20260908-1432')
    expect(name).not.toMatch(/[\\/:*?"<>|]/)
  })
})
