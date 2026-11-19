import { describe, expect, it } from 'vitest'
import { buildConversionAuditEntry, describeUomHistoryEntry } from './uom-change-audit'

const actor = { userId: 7, branchId: 1 }

describe('buildConversionAuditEntry', () => {
  it('mencatat produk sebagai recordId dan menyimpan nilai sebelum/sesudah', () => {
    const entry = buildConversionAuditEntry({
      action: 'UOM_CONVERSION_UPDATE',
      productId: 2495,
      productName: 'VITACIK',
      actor,
      before: { uomId: 3, uomCode: 'DUS', ratio: 40, weightGram: 200 },
      after: { uomId: 3, uomCode: 'DUS', ratio: 24, weightGram: 200 },
    })
    expect(entry).toMatchObject({ action: 'UOM_CONVERSION_UPDATE', tableName: 'product_uom_conversions', recordId: '2495', userId: 7, branchId: 1 })
    expect(JSON.parse(entry.oldData!)).toMatchObject({ productName: 'VITACIK', ratio: 40 })
    expect(JSON.parse(entry.newData!)).toMatchObject({ ratio: 24 })
  })

  it('hapus satuan: data baru hanya berisi keterangan tambahan', () => {
    const entry = buildConversionAuditEntry({
      action: 'UOM_CONVERSION_DELETE',
      productId: 2495,
      productName: 'VITACIK',
      actor,
      before: { uomId: 3, uomCode: 'DUS', ratio: 40, weightGram: null },
      after: null,
      extra: { deletedPrices: 10, deletedCosts: 5 },
    })
    expect(JSON.parse(entry.newData!)).toEqual({ productName: 'VITACIK', deletedPrices: 10, deletedCosts: 5 })
  })
})

describe('describeUomHistoryEntry', () => {
  it('tambah satuan, termasuk hasil salin produk', () => {
    expect(
      describeUomHistoryEntry({ action: 'UOM_CONVERSION_ADD', oldData: null, newData: JSON.stringify({ uomCode: 'BOX', ratio: 12 }) })
    ).toBe('Satuan BOX ditambahkan (1 BOX = 12 satuan dasar)')
    expect(
      describeUomHistoryEntry({
        action: 'UOM_CONVERSION_ADD',
        oldData: null,
        newData: JSON.stringify({ uomCode: 'BOX', ratio: 12, source: 'COPY', sourceProductName: 'GROWSSY' }),
      })
    ).toBe('Satuan BOX ditambahkan (1 BOX = 12 satuan dasar) — disalin dari GROWSSY')
  })

  it('ubah isi dan berat', () => {
    expect(
      describeUomHistoryEntry({
        action: 'UOM_CONVERSION_UPDATE',
        oldData: JSON.stringify({ uomCode: 'DUS', ratio: 40, weightGram: 200 }),
        newData: JSON.stringify({ uomCode: 'DUS', ratio: 24, weightGram: 120 }),
      })
    ).toBe('Satuan DUS diubah: isi 40 → 24, berat 200 g → 120 g')
  })

  it('hapus satuan beserta harga/modal yang ikut terhapus', () => {
    expect(
      describeUomHistoryEntry({
        action: 'UOM_CONVERSION_DELETE',
        oldData: JSON.stringify({ uomCode: 'DUS', ratio: 40 }),
        newData: JSON.stringify({ deletedPrices: 10, deletedCosts: 5 }),
      })
    ).toBe('Satuan DUS dihapus (dulu 1 DUS = 40 satuan dasar); ikut terhapus 10 harga jual & 5 modal')
  })

  it('ganti satuan dasar dan ganti nama master satuan', () => {
    expect(
      describeUomHistoryEntry({
        action: 'BASE_UOM_CHANGE',
        oldData: JSON.stringify({ baseUomCode: 'SAK' }),
        newData: JSON.stringify({ baseUomCode: 'PCS', ratio: 3 }),
      })
    ).toBe('Satuan dasar diganti SAK → PCS (1 SAK = 3 PCS)')
    expect(
      describeUomHistoryEntry({
        action: 'UOM_MASTER_UPDATE',
        oldData: JSON.stringify({ code: 'KLG', name: 'Kaleng', isBase: false }),
        newData: JSON.stringify({ code: 'KLG', name: 'KALENG', isBase: false }),
      })
    ).toBe('Master Satuan Ukur KLG diubah (berlaku untuk semua produk): nama "Kaleng" → "KALENG"')
  })

  it('data rusak tidak membuat galat', () => {
    expect(describeUomHistoryEntry({ action: 'UOM_CONVERSION_ADD', oldData: null, newData: '{rusak' })).toBe(
      'Satuan - ditambahkan (1 - = - satuan dasar)'
    )
  })
})
