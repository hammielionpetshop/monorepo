import { describe, expect, it } from 'vitest'
import { sortItemsForPrint } from './print-item-order'

describe('sortItemsForPrint', () => {
  it('mengurutkan nama produk A–Z tanpa peduli huruf besar/kecil', () => {
    const items = [{ productName: 'whiskas tuna' }, { productName: 'BOLT SALMON' }, { productName: 'Royal Canin' }]
    expect(sortItemsForPrint(items).map((i) => i.productName)).toEqual(['BOLT SALMON', 'Royal Canin', 'whiskas tuna'])
  })

  it('angka dalam nama diurutkan secara numerik', () => {
    const items = [{ productName: 'PASIR 10KG' }, { productName: 'PASIR 2KG' }]
    expect(sortItemsForPrint(items).map((i) => i.productName)).toEqual(['PASIR 2KG', 'PASIR 10KG'])
  })

  it('nama sama tetap mengikuti urutan input dan array asli tidak diubah', () => {
    const items = [
      { productName: 'ZOO', uom: 'PCS' },
      { productName: 'CAT CHOIZE', uom: 'SAK' },
      { productName: 'CAT CHOIZE', uom: 'PCS' },
    ]
    expect(sortItemsForPrint(items).map((i) => i.uom)).toEqual(['SAK', 'PCS', 'PCS'])
    expect(items[0].productName).toBe('ZOO')
  })
})
