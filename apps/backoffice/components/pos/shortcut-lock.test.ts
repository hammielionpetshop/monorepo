import { beforeEach, describe, expect, it } from 'vitest'

import { acquireShortcutLock, isShortcutLocked, resetShortcutLock } from './shortcut-lock'

describe('kunci shortcut POS', () => {
  beforeEach(() => {
    resetShortcutLock()
  })

  it('tidak terkunci selama tidak ada modal', () => {
    expect(isShortcutLocked()).toBe(false)
  })

  it('terkunci selama modal terbuka dan lepas setelah ditutup', () => {
    // Given — modal pembayaran terbuka
    const release = acquireShortcutLock()

    // Then — F2 di panel produk harus diabaikan
    expect(isShortcutLocked()).toBe(true)

    // When — modal ditutup
    release()

    // Then — shortcut POS kembali normal
    expect(isShortcutLocked()).toBe(false)
  })

  it('tetap terkunci sampai modal terluar tertutup saat bertumpuk', () => {
    // Given
    const releaseOuter = acquireShortcutLock()
    const releaseInner = acquireShortcutLock()

    // When
    releaseInner()

    // Then
    expect(isShortcutLocked()).toBe(true)

    // When
    releaseOuter()

    // Then
    expect(isShortcutLocked()).toBe(false)
  })

  it('mengabaikan pelepasan ganda — StrictMode tidak boleh membuat hitungan minus', () => {
    // Given
    const releaseFirst = acquireShortcutLock()
    const releaseSecond = acquireShortcutLock()

    // When
    releaseFirst()
    releaseFirst()

    // Then — kunci milik modal kedua masih berlaku
    expect(isShortcutLocked()).toBe(true)

    // When
    releaseSecond()

    // Then
    expect(isShortcutLocked()).toBe(false)
  })
})
