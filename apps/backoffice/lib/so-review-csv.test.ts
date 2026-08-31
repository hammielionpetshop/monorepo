import { describe, expect, it } from 'vitest'

import { buildSOReviewCsv, soReviewCsvFilename } from './so-review-csv'
import type { SOReviewItem } from '@/app/(dashboard)/inventory/stock-opname/page'

function makeItem(overrides: Partial<SOReviewItem> = {}): SOReviewItem {
  return {
    id: 1,
    productId: 10,
    productName: 'Whiskas Adult',
    uomId: 2,
    uomCode: 'PCS',
    systemQty: 12,
    physicalQty: 10,
    varianceQty: -2,
    varianceCostValue: 30000,
    varianceReason: 'Rusak di rak',
    itemStatus: 'PENDING',
    isRecounted: false,
    recountPhysicalQty: null,
    recountVarianceQty: null,
    decisionNote: null,
    ...overrides,
  }
}

describe('buildSOReviewCsv', () => {
  it('mengawali dengan BOM UTF-8 dan baris header', () => {
    const csv = buildSOReviewCsv([makeItem()])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv.split('\r\n')[0]).toContain('"produk"')
    expect(csv.split('\r\n')[0]).toContain('"catatan keputusan"')
  })

  it('memetakan status item ke label Indonesia dan mengisi nilai selisih apa adanya', () => {
    const csv = buildSOReviewCsv([makeItem()])
    const row = csv.split('\r\n')[1]
    expect(row).toContain('"Whiskas Adult"')
    expect(row).toContain('"Menunggu"')
    expect(row).toContain('"30000"')
    expect(row).toContain('"-2"')
  })

  it('mengosongkan kolom hitung ulang saat item belum dihitung ulang', () => {
    const csv = buildSOReviewCsv([makeItem({ isRecounted: false, recountPhysicalQty: 5 })])
    const cells = csv.split('\r\n')[1].split(',')
    expect(cells[8]).toBe('""')
    expect(cells[9]).toBe('""')
  })

  it('mengisi kolom hitung ulang saat item sudah dihitung ulang', () => {
    const csv = buildSOReviewCsv([
      makeItem({ isRecounted: true, recountPhysicalQty: 11, recountVarianceQty: -1 }),
    ])
    const cells = csv.split('\r\n')[1].split(',')
    expect(cells[8]).toBe('"11"')
    expect(cells[9]).toBe('"-1"')
  })

  it('menetralkan sel yang berpotensi formula injection', () => {
    const csv = buildSOReviewCsv([makeItem({ varianceReason: '=cmd()' })])
    expect(csv.split('\r\n')[1]).toContain('"\'=cmd()"')
  })

  it('menamai berkas dengan nomor SO', () => {
    expect(soReviewCsvFilename({ soNumber: 'SO-2026-08-0007' })).toBe('SO-2026-08-0007-review.csv')
  })
})
