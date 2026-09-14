import { afterEach, describe, expect, it, vi } from 'vitest'

import { readPersistedFilterField, writePersistedFilterField } from './use-persisted-filter-state'

describe('persisted filter field', () => {
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

  it('returns the fallback when nothing is persisted or there is no window (SSR)', () => {
    stubWindow()
    expect(readPersistedFilterField('receivables', 'search', '')).toBe('')

    vi.unstubAllGlobals()
    expect(readPersistedFilterField('receivables', 'search', 'fallback')).toBe('fallback')
  })

  it('round-trips a field value', () => {
    stubWindow()
    writePersistedFilterField('receivables', 'search', 'budi')
    expect(readPersistedFilterField('receivables', 'search', '')).toBe('budi')
  })

  it('keeps multiple fields under the same storage key without clobbering each other', () => {
    stubWindow()
    writePersistedFilterField('receivables', 'search', 'budi')
    writePersistedFilterField('receivables', 'statusFilter', 'UNPAID')

    expect(readPersistedFilterField('receivables', 'search', '')).toBe('budi')
    expect(readPersistedFilterField('receivables', 'statusFilter', 'ALL')).toBe('UNPAID')
  })

  it('keeps different storage keys independent', () => {
    stubWindow()
    writePersistedFilterField('receivables', 'search', 'budi')
    writePersistedFilterField('customers', 'search', 'siti')

    expect(readPersistedFilterField('receivables', 'search', '')).toBe('budi')
    expect(readPersistedFilterField('customers', 'search', '')).toBe('siti')
  })

  it('ignores writes without a window and does not throw', () => {
    expect(() => writePersistedFilterField('receivables', 'search', 'budi')).not.toThrow()
  })

  it('falls back on garbage stored JSON', () => {
    const sessionStorage = stubWindow()
    sessionStorage.setItem('listFilters:receivables', 'not-json')
    expect(readPersistedFilterField('receivables', 'search', 'fallback')).toBe('fallback')
  })
})
