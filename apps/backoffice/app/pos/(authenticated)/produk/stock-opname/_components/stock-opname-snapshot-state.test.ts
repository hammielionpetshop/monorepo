import { describe, expect, it } from 'vitest'

import {
  applySnapshotFailure,
  applySnapshotSuccess,
  markLineForRecount,
  type SnapshotStateLine,
} from './stock-opname-snapshot-state'

function makeLine(overrides: Partial<SnapshotStateLine> = {}): SnapshotStateLine {
  return {
    uomId: 1,
    physicalQty: '10',
    snapshotToken: 'token-lama',
    snapshotPending: false,
    snapshotVersion: 2,
    ...overrides,
  }
}

describe('stock opname snapshot state', () => {
  it('langsung menandai pending saat qty berubah, tanpa menunggu debounce', () => {
    const result = markLineForRecount(makeLine(), { physicalQty: '11' })

    expect(result).toEqual({
      shouldSchedule: true,
      requestVersion: 3,
      line: makeLine({
        physicalQty: '11',
        snapshotToken: null,
        snapshotPending: true,
        snapshotVersion: 3,
      }),
    })
  })

  it('mengosongkan snapshot tanpa pending bila qty dikosongkan', () => {
    const result = markLineForRecount(makeLine(), { physicalQty: '' })

    expect(result).toEqual({
      shouldSchedule: false,
      requestVersion: null,
      line: makeLine({
        physicalQty: '',
        snapshotToken: null,
        snapshotPending: false,
        snapshotVersion: 3,
      }),
    })
  })

  it('hanya menerima response sukses dari request snapshot terbaru', () => {
    const pending = markLineForRecount(makeLine(), { physicalQty: '11' })
    const newer = markLineForRecount(pending.line, { physicalQty: '12' })

    const staleApplied = applySnapshotSuccess(newer.line, {
      requestVersion: pending.requestVersion!,
      uomId: 1,
      snapshotToken: 'token-stale',
    })

    expect(staleApplied).toEqual(newer.line)

    const latestApplied = applySnapshotSuccess(newer.line, {
      requestVersion: newer.requestVersion!,
      uomId: 1,
      snapshotToken: 'token-baru',
    })

    expect(latestApplied).toEqual(
      makeLine({
        physicalQty: '12',
        snapshotToken: 'token-baru',
        snapshotPending: false,
        snapshotVersion: 4,
      })
    )
  })

  it('mengabaikan kegagalan dari request lama agar pending request terbaru tidak hilang', () => {
    const pending = markLineForRecount(makeLine(), { physicalQty: '11' })
    const newer = markLineForRecount(pending.line, { physicalQty: '12' })

    const staleFailure = applySnapshotFailure(newer.line, pending.requestVersion!)

    expect(staleFailure).toEqual(newer.line)

    const latestFailure = applySnapshotFailure(newer.line, newer.requestVersion!)

    expect(latestFailure).toEqual(
      makeLine({
        physicalQty: '12',
        snapshotToken: null,
        snapshotPending: false,
        snapshotVersion: 4,
      })
    )
  })
})
