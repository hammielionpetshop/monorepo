import { describe, it, expect } from 'vitest'
import {
  decideStatus,
  nextProbeDelay,
  HEALTHY_INTERVAL_MS,
  SUSPECT_INTERVAL_MS,
  RETRY_BACKOFF_MS,
} from './connection-logic'

const OK = { ok: true, fromOurServer: true, failed: false }
const NETWORK_ERROR = { ok: false, fromOurServer: false, failed: true }
// Captive portal: balasan 200 tapi bukan dari server kita.
const CAPTIVE_PORTAL = { ok: true, fromOurServer: false, failed: false }
// Server kita hidup tapi membalas 5xx.
const SERVER_ERROR = { ok: false, fromOurServer: true, failed: false }

describe('decideStatus', () => {
  it('probe sukses → online dan reset hitungan gagal', () => {
    expect(decideStatus(OK, { current: 'offline', failureCount: 4, manual: false })).toEqual({
      status: 'online',
      failureCount: 0,
    })
  })

  it('satu kegagalan saat online belum mengubah status (anti-kedip)', () => {
    expect(decideStatus(NETWORK_ERROR, { current: 'online', failureCount: 0, manual: false })).toEqual({
      status: 'online',
      failureCount: 1,
    })
  })

  it('kegagalan kedua beruntun baru dinyatakan offline', () => {
    expect(decideStatus(NETWORK_ERROR, { current: 'online', failureCount: 1, manual: false })).toEqual({
      status: 'offline',
      failureCount: 2,
    })
  })

  it('probe manual langsung dipercaya pada kegagalan pertama', () => {
    expect(decideStatus(NETWORK_ERROR, { current: 'online', failureCount: 0, manual: true })).toEqual({
      status: 'offline',
      failureCount: 1,
    })
  })

  it('captive portal (200 tanpa header penanda) dihitung offline, bukan online', () => {
    expect(decideStatus(CAPTIVE_PORTAL, { current: 'online', failureCount: 1, manual: false })).toEqual({
      status: 'offline',
      failureCount: 2,
    })
  })

  it('server kita membalas error → server-down, bukan offline', () => {
    expect(decideStatus(SERVER_ERROR, { current: 'online', failureCount: 1, manual: false })).toEqual({
      status: 'server-down',
      failureCount: 2,
    })
  })

  it('saat sudah bermasalah, satu kegagalan cukup untuk berpindah jenis masalah', () => {
    expect(decideStatus(SERVER_ERROR, { current: 'offline', failureCount: 0, manual: false })).toEqual({
      status: 'server-down',
      failureCount: 1,
    })
  })
})

describe('nextProbeDelay', () => {
  it('sehat tanpa kegagalan → selang panjang', () => {
    expect(nextProbeDelay('online', 0, 0)).toBe(HEALTHY_INTERVAL_MS)
  })

  it('sehat tapi sudah sekali gagal → probe cepat untuk memastikan', () => {
    expect(nextProbeDelay('online', 1, 0)).toBe(SUSPECT_INTERVAL_MS)
  })

  it('putus → backoff menaik lalu menetap di nilai terbesar', () => {
    const delays = [0, 1, 2, 3, 4, 5, 9].map((attempt) => nextProbeDelay('offline', 2, attempt))
    expect(delays).toEqual([
      ...RETRY_BACKOFF_MS,
      RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1],
      RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1],
    ])
  })

  it('server-down memakai backoff yang sama dengan offline', () => {
    expect(nextProbeDelay('server-down', 2, 1)).toBe(RETRY_BACKOFF_MS[1])
  })
})
