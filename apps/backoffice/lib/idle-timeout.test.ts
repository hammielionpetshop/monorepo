import { describe, expect, it } from 'vitest'
import { idleRemainingMs } from './idle-timeout'

const MIN = 60_000

describe('idleRemainingMs', () => {
  it('menghitung dari aktivitas terakhir', () => {
    expect(
      idleRemainingMs({ now: 20 * MIN, lastActivityAt: 15 * MIN, sessionStartedAt: 0, timeoutMs: 10 * MIN }),
    ).toBe(5 * MIN)
  })

  it('negatif bila sudah lewat batas (mis. PC tidur / browser dibuka lagi)', () => {
    expect(
      idleRemainingMs({ now: 120 * MIN, lastActivityAt: 15 * MIN, sessionStartedAt: 0, timeoutMs: 30 * MIN }),
    ).toBeLessThan(0)
  })

  it('catatan basi dari sesi sebelumnya tidak menendang orang yang baru login', () => {
    expect(
      idleRemainingMs({ now: 101 * MIN, lastActivityAt: 5 * MIN, sessionStartedAt: 100 * MIN, timeoutMs: 10 * MIN }),
    ).toBe(9 * MIN)
  })

  it('tanpa catatan aktivitas dihitung dari waktu login', () => {
    expect(
      idleRemainingMs({ now: 103 * MIN, lastActivityAt: null, sessionStartedAt: 100 * MIN, timeoutMs: 10 * MIN }),
    ).toBe(7 * MIN)
  })
})
