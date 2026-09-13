import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  clampPageIndex,
  getPaginationSummary,
  readPersistedPageIndex,
  writePersistedPageIndex,
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

describe('persisted page index', () => {
  function stubWindow() {
    const store = new Map<string, string>()
    const sessionStorage = {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
    }
    vi.stubGlobal('window', { sessionStorage })
    return sessionStorage
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns 0 when there is nothing persisted, no persistKey, or no window (SSR)', () => {
    stubWindow()
    expect(readPersistedPageIndex('products')).toBe(0)
    expect(readPersistedPageIndex(undefined)).toBe(0)

    vi.unstubAllGlobals()
    expect(readPersistedPageIndex('products')).toBe(0)
  })

  it('round-trips the page index per persistKey', () => {
    stubWindow()
    writePersistedPageIndex('products', 3)
    writePersistedPageIndex('customers', 1)

    expect(readPersistedPageIndex('products')).toBe(3)
    expect(readPersistedPageIndex('customers')).toBe(1)
  })

  it('ignores writes without a persistKey or window', () => {
    const sessionStorage = stubWindow()
    writePersistedPageIndex(undefined, 5)
    expect(sessionStorage.getItem('dataTablePageIndex:undefined')).toBeNull()

    vi.unstubAllGlobals()
    expect(() => writePersistedPageIndex('products', 5)).not.toThrow()
  })

  it('falls back to 0 on garbage stored values', () => {
    const sessionStorage = stubWindow()
    sessionStorage.setItem('dataTablePageIndex:products', 'not-a-number')
    expect(readPersistedPageIndex('products')).toBe(0)

    sessionStorage.setItem('dataTablePageIndex:products', '-1')
    expect(readPersistedPageIndex('products')).toBe(0)
  })
})
