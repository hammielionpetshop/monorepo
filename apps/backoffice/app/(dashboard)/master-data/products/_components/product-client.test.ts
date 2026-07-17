import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import ProductClient from './product-client'

const baseProps = {
  products: [
    {
      id: 1,
      sku: 'SKU-001',
      barcode: '8991234567890',
      name: 'Royal Canin Kitten 1kg',
      categoryId: 1,
      categoryName: 'Makanan Kucing',
      brandId: 1,
      brandName: 'Royal Canin',
      baseUomId: 1,
      uomCode: 'PCS',
      uomName: 'Pieces',
      weightGram: 1000,
      defaultCostPrice: 95000,
      isActive: true,
    },
  ],
  categories: [{ id: 1, name: 'Makanan Kucing' }],
  brands: [{ id: 1, name: 'Royal Canin' }],
  uoms: [{ id: 1, code: 'PCS', name: 'Pieces', isBase: true }],
}

describe('ProductClient', () => {
  it('renders filter controls and product data', () => {
    const html = renderToStaticMarkup(React.createElement(ProductClient, baseProps))

    expect(html).toContain('Cari nama, SKU, atau barcode...')
    expect(html).toContain('Semua Kategori')
    expect(html).toContain('Semua Brand')
    expect(html).toContain('Semua Status')
    expect(html).toContain('Royal Canin Kitten 1kg')
    expect(html).toContain('SKU-001')
    expect(html).toContain('+ Tambah Produk')
  })

  it('populates kategori and brand options from master data', () => {
    const html = renderToStaticMarkup(React.createElement(ProductClient, baseProps))

    expect(html).toContain('<option value="1">Makanan Kucing</option>')
    expect(html).toContain('<option value="1">Royal Canin</option>')
  })

  it('does not render reset button when no filter is applied', () => {
    const html = renderToStaticMarkup(React.createElement(ProductClient, baseProps))

    expect(html).not.toContain('>Reset<')
  })
})
