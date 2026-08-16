import { beforeEach, describe, expect, it, vi } from 'vitest'

const { executeQueue } = vi.hoisted(() => {
  const executeQueue: unknown[][] = []
  return { executeQueue }
})

vi.mock('../db', () => {
  return {
    db: {
      execute: vi.fn(async () => executeQueue.shift() ?? []),
    },
    // Drizzle table stubs — validator hanya pakai raw SQL, jadi shape apapun OK
    productPrices: {},
    productUomCosts: {},
    auditLogs: {},
  }
})

import {
  parsePriceFile,
  validatePriceRows,
  rowsToCsv,
  buildPriceAuditEntry,
  AUDIT_DETAIL_LIMIT,
  IMPORT_TIERS,
  type CurrentValueMap,
} from './price-service'

function csvBuffer(text: string): Buffer {
  return Buffer.from(text, 'utf-8')
}

beforeEach(() => {
  executeQueue.length = 0
})

// -------------------- parsePriceFile --------------------

describe('parsePriceFile', () => {
  it('parses CSV with header + rows, treats empty cells as null (skip)', () => {
    const csv =
      'sku,nama_produk,satuan,modal,harga_retail,harga_reseller,harga_grosir,harga_member\n' +
      'SKU-001,Produk A,PCS,10000,15000,,14000,\n' +
      'SKU-002,Produk B,PCS,,20000,,,'
    const rows = parsePriceFile(csvBuffer(csv), 'test.csv')

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      rowNumber: 2,
      sku: 'SKU-001',
      namaProduk: 'Produk A',
      satuan: 'PCS',
      modal: 10000,
      tiers: { RETAIL: 15000, GROSIR: 14000 },
    })
    // Empty cells NOT in tiers map
    expect(rows[0].tiers.RESELLER).toBeUndefined()
    expect(rows[0].tiers.MEMBER).toBeUndefined()

    expect(rows[1]).toMatchObject({
      rowNumber: 3,
      sku: 'SKU-002',
      modal: null,
      tiers: { RETAIL: 20000 },
    })
  })

  it('marks row with invalid number via NaN modal', () => {
    const csv =
      'sku,nama_produk,satuan,modal,harga_retail,harga_reseller,harga_grosir,harga_member\n' +
      'SKU-001,X,PCS,abc,,,,'
    const rows = parsePriceFile(csvBuffer(csv), 'x.csv')
    expect(Number.isNaN(rows[0].modal)).toBe(true)
  })

  it('rejects unsupported extension', () => {
    expect(() => parsePriceFile(csvBuffer('sku\nA'), 'x.txt')).toThrow(/Format file tidak didukung/)
  })

  it('returns empty array on empty CSV body (only header)', () => {
    const rows = parsePriceFile(csvBuffer('sku,nama_produk,satuan,modal\n'), 'e.csv')
    expect(rows).toEqual([])
  })
})

// -------------------- validatePriceRows --------------------

// Setup helper: seed products + uoms + invalid-conv-check + current-state responses in order.
function seedValidatorQueue(opts: {
  products: Array<{ id: number; sku: string | null; name: string; base_uom_id: number }>
  uoms: Array<{ id: number; code: string }>
  invalidUomPairs?: Array<{ product_id: number; uom_id: number }>
  currentState?: Array<{
    product_id: number
    uom_id: number
    tier_type: string | null
    price: number | null
    cost_price: number | null
  }>
}) {
  // Order matches validatePriceRows:
  // 1. products SELECT
  // 2. uoms SELECT
  // 3. invalid uom check (only if pairs>0)
  // 4. current state (only if validPairs>0)
  executeQueue.push(opts.products)
  executeQueue.push(opts.uoms)
  if (opts.invalidUomPairs !== undefined) executeQueue.push(opts.invalidUomPairs)
  if (opts.currentState !== undefined) executeQueue.push(opts.currentState)
}

describe('validatePriceRows', () => {
  it('happy path: insert modal + tier when nothing exists yet', async () => {
    seedValidatorQueue({
      products: [{ id: 1, sku: 'SKU-1', name: 'Prod', base_uom_id: 10 }],
      uoms: [{ id: 10, code: 'PCS' }],
      currentState: [
        { product_id: 1, uom_id: 10, tier_type: null, price: null, cost_price: null },
      ],
    })

    const result = await validatePriceRows(
      [
        {
          rowNumber: 2,
          sku: 'SKU-1',
          namaProduk: 'Prod',
          satuan: 'PCS',
          modal: 5000,
          tiers: { RETAIL: 8000 },
        },
      ],
      1,
    )

    expect(result.summary).toMatchObject({
      totalRows: 1,
      insert: 1,
      update: 0,
      unchanged: 0,
      rejected: 0,
      fieldsToApply: 2,
    })
    expect(result.rows[0].status).toBe('insert')
    expect(result.costChanges).toEqual([{ productId: 1, uomId: 10, costPrice: 5000 }])
    expect(result.changes).toEqual([{ productId: 1, uomId: 10, tierType: 'RETAIL', price: 8000 }])
  })

  it('update: emits change only for tiers that differ, ignores unchanged', async () => {
    seedValidatorQueue({
      products: [{ id: 1, sku: 'SKU-1', name: 'P', base_uom_id: 10 }],
      uoms: [{ id: 10, code: 'PCS' }],
      currentState: [
        { product_id: 1, uom_id: 10, tier_type: null, price: null, cost_price: 5000 },
        { product_id: 1, uom_id: 10, tier_type: 'RETAIL', price: 8000, cost_price: null },
        { product_id: 1, uom_id: 10, tier_type: 'GROSIR', price: 7000, cost_price: null },
      ],
    })

    const result = await validatePriceRows(
      [
        {
          rowNumber: 2,
          sku: 'SKU-1',
          namaProduk: 'P',
          satuan: 'PCS',
          modal: 5000, // same
          tiers: { RETAIL: 8500, GROSIR: 7000 }, // RETAIL updated, GROSIR same
        },
      ],
      1,
    )

    expect(result.rows[0].status).toBe('update')
    expect(result.changes).toEqual([{ productId: 1, uomId: 10, tierType: 'RETAIL', price: 8500 }])
    expect(result.costChanges).toEqual([])
    expect(result.summary.update).toBe(1)
  })

  it('unchanged: no changes when all values match current', async () => {
    seedValidatorQueue({
      products: [{ id: 1, sku: 'SKU-1', name: 'P', base_uom_id: 10 }],
      uoms: [{ id: 10, code: 'PCS' }],
      currentState: [
        { product_id: 1, uom_id: 10, tier_type: null, price: null, cost_price: 5000 },
        { product_id: 1, uom_id: 10, tier_type: 'RETAIL', price: 8000, cost_price: null },
      ],
    })

    const result = await validatePriceRows(
      [{ rowNumber: 2, sku: 'SKU-1', namaProduk: 'P', satuan: 'PCS', modal: 5000, tiers: { RETAIL: 8000 } }],
      1,
    )

    expect(result.rows[0].status).toBe('unchanged')
    expect(result.summary.unchanged).toBe(1)
    expect(result.changes).toEqual([])
    expect(result.costChanges).toEqual([])
  })

  it('rejects when SKU not found', async () => {
    seedValidatorQueue({
      products: [{ id: 1, sku: 'OTHER', name: 'X', base_uom_id: 10 }],
      uoms: [{ id: 10, code: 'PCS' }],
    })

    const result = await validatePriceRows(
      [{ rowNumber: 2, sku: 'MISSING', namaProduk: null, satuan: 'PCS', modal: 5000, tiers: {} }],
      1,
    )

    expect(result.rows[0].status).toBe('rejected')
    expect(result.rows[0].reason).toMatch(/SKU "MISSING" tidak ditemukan/)
    expect(result.summary.rejected).toBe(1)
  })

  it('rejects when name matches multiple products (ambiguous)', async () => {
    seedValidatorQueue({
      products: [
        { id: 1, sku: null, name: 'DUP NAME', base_uom_id: 10 },
        { id: 2, sku: null, name: 'DUP NAME', base_uom_id: 10 },
      ],
      uoms: [{ id: 10, code: 'PCS' }],
    })

    const result = await validatePriceRows(
      [{ rowNumber: 2, sku: null, namaProduk: 'Dup Name', satuan: 'PCS', modal: 5000, tiers: {} }],
      1,
    )

    expect(result.rows[0].status).toBe('rejected')
    expect(result.rows[0].reason).toMatch(/ambigu/)
  })

  it('rejects second duplicate row with same (productId, uomId)', async () => {
    seedValidatorQueue({
      products: [{ id: 1, sku: 'SKU-1', name: 'P', base_uom_id: 10 }],
      uoms: [{ id: 10, code: 'PCS' }],
      currentState: [
        { product_id: 1, uom_id: 10, tier_type: null, price: null, cost_price: null },
      ],
    })

    const result = await validatePriceRows(
      [
        { rowNumber: 2, sku: 'SKU-1', namaProduk: 'P', satuan: 'PCS', modal: 5000, tiers: {} },
        { rowNumber: 3, sku: 'SKU-1', namaProduk: 'P', satuan: 'PCS', modal: 6000, tiers: {} },
      ],
      1,
    )

    expect(result.rows[0].status).not.toBe('rejected')
    expect(result.rows[1].status).toBe('rejected')
    expect(result.rows[1].reason).toMatch(/duplikat/)
  })

  it('rejects non-baseUom without conversion', async () => {
    seedValidatorQueue({
      products: [{ id: 1, sku: 'SKU-1', name: 'P', base_uom_id: 10 }],
      uoms: [
        { id: 10, code: 'PCS' },
        { id: 20, code: 'BOX' }, // non-base
      ],
      invalidUomPairs: [{ product_id: 1, uom_id: 20 }],
    })

    const result = await validatePriceRows(
      [{ rowNumber: 2, sku: 'SKU-1', namaProduk: 'P', satuan: 'BOX', modal: 5000, tiers: {} }],
      1,
    )

    expect(result.rows[0].status).toBe('rejected')
    expect(result.rows[0].reason).toMatch(/konversi ke satuan dasar/)
  })

  it('rejects negative modal', async () => {
    seedValidatorQueue({
      products: [{ id: 1, sku: 'SKU-1', name: 'P', base_uom_id: 10 }],
      uoms: [{ id: 10, code: 'PCS' }],
      currentState: [{ product_id: 1, uom_id: 10, tier_type: null, price: null, cost_price: null }],
    })

    const result = await validatePriceRows(
      [{ rowNumber: 2, sku: 'SKU-1', namaProduk: 'P', satuan: 'PCS', modal: -1, tiers: {} }],
      1,
    )

    expect(result.rows[0].status).toBe('rejected')
    expect(result.rows[0].reason).toMatch(/negatif/)
  })

  it('rejects tier price <= 0', async () => {
    seedValidatorQueue({
      products: [{ id: 1, sku: 'SKU-1', name: 'P', base_uom_id: 10 }],
      uoms: [{ id: 10, code: 'PCS' }],
      currentState: [{ product_id: 1, uom_id: 10, tier_type: null, price: null, cost_price: null }],
    })

    const result = await validatePriceRows(
      [{ rowNumber: 2, sku: 'SKU-1', namaProduk: 'P', satuan: 'PCS', modal: null, tiers: { RETAIL: 0 } }],
      1,
    )

    expect(result.rows[0].status).toBe('rejected')
    expect(result.rows[0].reason).toMatch(/harus lebih dari 0/)
  })

  it('rejects row with NaN modal (parse error propagated)', async () => {
    seedValidatorQueue({
      products: [{ id: 1, sku: 'SKU-1', name: 'P', base_uom_id: 10 }],
      uoms: [{ id: 10, code: 'PCS' }],
    })

    const result = await validatePriceRows(
      [{ rowNumber: 2, sku: 'SKU-1', namaProduk: 'P', satuan: 'PCS', modal: Number.NaN, tiers: {} }],
      1,
    )

    expect(result.rows[0].status).toBe('rejected')
    expect(result.rows[0].reason).toMatch(/tidak valid/)
  })

  it('rejects row with empty satuan', async () => {
    seedValidatorQueue({
      products: [{ id: 1, sku: 'SKU-1', name: 'P', base_uom_id: 10 }],
      uoms: [{ id: 10, code: 'PCS' }],
    })

    const result = await validatePriceRows(
      [{ rowNumber: 2, sku: 'SKU-1', namaProduk: 'P', satuan: null, modal: 5000, tiers: {} }],
      1,
    )

    expect(result.rows[0].status).toBe('rejected')
    expect(result.rows[0].reason).toMatch(/satuan/)
  })
})

// -------------------- rowsToCsv --------------------

describe('rowsToCsv', () => {
  it('renders header + rows with proper escaping', () => {
    const csv = rowsToCsv([
      {
        sku: 'SKU-1',
        nama_produk: 'Produk "Special", A',
        kategori: null,
        satuan: 'PCS',
        modal: 5000,
        harga_retail: 8000,
        harga_reseller: null,
        harga_grosir: null,
        harga_member: null,
      },
    ])

    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe('sku,nama_produk,kategori,satuan,modal,harga_retail,harga_reseller,harga_grosir,harga_member')
    expect(lines[1]).toBe('SKU-1,"Produk ""Special"", A",,PCS,5000,8000,,,')
  })

  it('renders empty body when no rows', () => {
    const csv = rowsToCsv([])
    expect(csv).toBe('sku,nama_produk,kategori,satuan,modal,harga_retail,harga_reseller,harga_grosir,harga_member\n')
  })
})

// -------------------- Pengaman rumus Excel --------------------

describe('formula injection', () => {
  it('prefixes cells starting with = + - @ so Excel treats them as text', () => {
    const csv = rowsToCsv([
      {
        sku: 'SKU-1',
        nama_produk: '=cmd|calc',
        kategori: '+62 Import',
        satuan: 'PCS',
        modal: 100,
        harga_retail: 200,
        harga_reseller: null,
        harga_grosir: null,
        harga_member: null,
      },
    ])
    const dataLine = csv.trim().split('\n')[1]
    expect(dataLine).toContain(`'=cmd|calc`)
    expect(dataLine).toContain(`'+62 Import`)
  })

  it('strips that prefix again on import, so an exported file round-trips', () => {
    const csv =
      'sku,nama_produk,satuan,modal,harga_retail,harga_reseller,harga_grosir,harga_member\n' +
      "SKU-1,'=cmd|calc,PCS,100,200,,,"
    const rows = parsePriceFile(csvBuffer(csv), 'export.csv')
    expect(rows[0].namaProduk).toBe('=cmd|calc')
  })

  it('leaves a normal apostrophe inside a name alone', () => {
    const csv =
      'sku,nama_produk,satuan,modal,harga_retail,harga_reseller,harga_grosir,harga_member\n' +
      "SKU-1,'Special Pet,PCS,100,200,,,"
    const rows = parsePriceFile(csvBuffer(csv), 'x.csv')
    expect(rows[0].namaProduk).toBe("'Special Pet")
  })
})

// -------------------- buildPriceAuditEntry --------------------

function emptyBefore(): CurrentValueMap {
  return { priceByKey: new Map(), costByKey: new Map() }
}

describe('buildPriceAuditEntry', () => {
  it('records old value next to new value per field', () => {
    const before = emptyBefore()
    before.priceByKey.set('7:3:RETAIL', 4000)

    const entry = buildPriceAuditEntry({
      branchId: 4,
      changes: [{ productId: 7, uomId: 3, tierType: 'RETAIL', price: 5000 }],
      costChanges: [{ productId: 7, uomId: 3, costPrice: 3000 }],
      actor: { userId: 12, source: 'IMPORT', fileName: 'harga.xlsx' },
      before,
    })

    expect(entry).toMatchObject({
      branchId: 4,
      userId: 12,
      action: 'PRICE_IMPORT',
      tableName: 'product_prices',
      recordId: 'branch:4',
    })

    const oldData = JSON.parse(entry.oldData)
    const newData = JSON.parse(entry.newData)
    expect(oldData.prices).toEqual([{ p: 7, u: 3, t: 'RETAIL', v: 4000 }])
    expect(newData.prices).toEqual([{ p: 7, u: 3, t: 'RETAIL', v: 5000 }])
    // Modal belum pernah ada → old null, bukan 0
    expect(oldData.costs).toEqual([{ p: 7, u: 3, v: null }])
    expect(newData.costs).toEqual([{ p: 7, u: 3, v: 3000 }])
    expect(newData.fileName).toBe('harga.xlsx')
    expect(newData.summary).toEqual({ priceCount: 1, costCount: 1 })
    expect(oldData.truncated).toBe(false)
  })

  it('marks MANUAL edits with a different action', () => {
    const entry = buildPriceAuditEntry({
      branchId: 1,
      changes: [{ productId: 1, uomId: 1, tierType: 'RETAIL', price: 100 }],
      costChanges: [],
      actor: { userId: 3, source: 'MANUAL' },
      before: emptyBefore(),
    })
    expect(entry.action).toBe('PRICE_BULK_UPDATE')
    expect(JSON.parse(entry.newData).fileName).toBeNull()
  })

  it('truncates detail past the limit but keeps the summary exact', () => {
    const changes = Array.from({ length: AUDIT_DETAIL_LIMIT + 25 }, (_, i) => ({
      productId: i + 1,
      uomId: 1,
      tierType: 'RETAIL' as const,
      price: 1000 + i,
    }))

    const entry = buildPriceAuditEntry({
      branchId: 2,
      changes,
      costChanges: [],
      actor: { userId: 9, source: 'IMPORT', fileName: 'besar.csv' },
      before: emptyBefore(),
    })

    const newData = JSON.parse(entry.newData)
    expect(newData.prices).toHaveLength(AUDIT_DETAIL_LIMIT)
    expect(newData.truncated).toBe(true)
    // Ringkasan tetap menghitung semua, bukan cuma yang tercatat detailnya
    expect(newData.summary.priceCount).toBe(AUDIT_DETAIL_LIMIT + 25)
  })
})

// Sanity: IMPORT_TIERS aligns with docs
describe('constants', () => {
  it('IMPORT_TIERS matches 4 UI tiers', () => {
    expect(IMPORT_TIERS).toEqual(['RETAIL', 'RESELLER', 'GROSIR', 'MEMBER'])
  })
})
