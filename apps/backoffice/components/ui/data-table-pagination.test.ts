import { describe, expect, it } from 'vitest'

import {
  clampPageIndex,
  getPaginationSummary,
} from './data-table-pagination'

describe('data table pagination helpers', () => {
  it('keeps page index within the last available page', () => {
    expect(clampPageIndex(3, 10, 12)).toBe(1)
    expect(clampPageIndex(1, 10, 0)).toBe(0)
  })

  it('builds a human-readable row summary', () => {
    expect(getPaginationSummary(0, 10, 24)).toBe('Menampilkan 1-10 dari 24 data')
    expect(getPaginationSummary(2, 10, 24)).toBe('Menampilkan 21-24 dari 24 data')
    expect(getPaginationSummary(0, 10, 0)).toBe('Menampilkan 0 dari 0 data')
  })
})
