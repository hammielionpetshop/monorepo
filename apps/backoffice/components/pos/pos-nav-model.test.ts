import { describe, expect, it } from 'vitest'

import {
  getVisiblePosNavItems,
  isPosNavItemActive,
} from './pos-nav-model'

describe('POS navigation model', () => {
  it('hides transfer masuk for kasir role', () => {
    // Given
    const cashierRole = 'KASIR'

    // When
    const items = getVisiblePosNavItems(cashierRole)

    // Then
    expect(items.map((item) => item.href)).toEqual([
      '/pos',
      '/pos/internal-order',
      '/pos/produk',
      '/pos/history',
      '/pos/shift',
    ])
  })

  it('keeps transfer masuk visible for non-kasir roles', () => {
    // Given
    const managerRole = 'MANAGER'

    // When
    const items = getVisiblePosNavItems(managerRole)

    // Then
    expect(items.map((item) => item.href)).toContain('/pos/incoming-transfers')
  })

  it('matches exact kasir route without activating every POS route', () => {
    // Given
    const kasirItem = getVisiblePosNavItems('KASIR')[0]

    // When
    const exactMatch = isPosNavItemActive(kasirItem, '/pos')
    const childRouteMatch = isPosNavItemActive(kasirItem, '/pos/history')

    // Then
    expect(exactMatch).toBe(true)
    expect(childRouteMatch).toBe(false)
  })

  it('matches nested routes for section tabs', () => {
    // Given
    const produkItem = getVisiblePosNavItems('KASIR').find((item) => item.href === '/pos/produk')

    // When
    const barcodeRouteMatch = produkItem ? isPosNavItemActive(produkItem, '/pos/produk/barcode') : false

    // Then
    expect(barcodeRouteMatch).toBe(true)
  })
})
