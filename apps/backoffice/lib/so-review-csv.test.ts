import { describe, expect, it } from 'vitest'

import { buildSOExportCsv, type SOExportRow } from './so-review-csv'

function makeRow(overrides: Partial<SOExportRow> = {}): SOExportRow {
  return {
    productName: 'Whiskas Adult',
    sku: 'WA-01',
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
    counted: true,
    ...overrides,
  }
}

describe('buildSOExportCsv', () => {
  it('mengawali dengan BOM UTF-8 dan baris header berkolom "status hitung"', () => {
    const csv = buildSOExportCsv([makeRow()])
    expect(csv.startsWith('﻿')).toBe(true)
    const head = csv.split('\r\n')[0]
    expect(head).toContain('"produk"')
    expect(head).toContain('"status hitung"')
    expect(head).toContain('"catatan keputusan"')
  })

  it('memetakan status item ke label Indonesia dan menulis angka apa adanya', () => {
    const row = buildSOExportCsv([makeRow()]).split('\r\n')[1]
    expect(row).toContain('"Whiskas Adult"')
    expect(row).toContain('"Sudah dihitung"')
    expect(row).toContain('"Menunggu"')
    expect(row).toContain('"30000"')
    expect(row).toContain('"-2"')
  })

  it('menandai baris yang belum dihitung dan mengosongkan qty fisik/selisih', () => {
    const csv = buildSOExportCsv([
      makeRow({ counted: false, physicalQty: null, varianceQty: null, varianceCostValue: null }),
    ])
    const cells = csv.split('\r\n')[1].split(',')
    // produk, sku, satuan, status hitung, qty sistem, qty fisik, selisih, nilai selisih, ...
    expect(cells[3]).toBe('"Belum dihitung"')
    expect(cells[5]).toBe('""')
    expect(cells[6]).toBe('""')
    expect(cells[7]).toBe('""')
  })

  it('mengisi kolom hitung ulang hanya saat item sudah dihitung ulang', () => {
    const belum = buildSOExportCsv([makeRow({ isRecounted: false, recountPhysicalQty: 5 })])
    expect(belum.split('\r\n')[1].split(',').slice(-3, -1)).toEqual(['""', '""'])

    const sudah = buildSOExportCsv([
      makeRow({ isRecounted: true, recountPhysicalQty: 11, recountVarianceQty: -1 }),
    ])
    expect(sudah.split('\r\n')[1].split(',').slice(-3, -1)).toEqual(['"11"', '"-1"'])
  })

  it('menetralkan sel string yang berpotensi formula injection', () => {
    const csv = buildSOExportCsv([makeRow({ varianceReason: '=cmd()' })])
    expect(csv.split('\r\n')[1]).toContain('"\'=cmd()"')
  })
})
