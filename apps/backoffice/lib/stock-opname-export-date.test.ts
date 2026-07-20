import { describe, expect, it } from 'vitest'

import { validateStockOpnameExportDate } from './stock-opname-export-date'

describe('validateStockOpnameExportDate', () => {
  it('menerima ekspor untuk satu tanggal', () => {
    expect(validateStockOpnameExportDate('2026-07-21', '2026-07-21')).toBeNull()
  })

  it('menolak ekspor dengan rentang lebih dari satu tanggal', () => {
    expect(validateStockOpnameExportDate('2026-07-20', '2026-07-21')).toBe(
      'Ekspor laporan stock opname hanya dapat dilakukan untuk satu tanggal'
    )
  })
})
