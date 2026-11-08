import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const requirePermission = vi.fn()
const eq = vi.fn((left, right) => ({ type: 'eq', left, right }))
const desc = vi.fn((column) => ({ type: 'desc', column }))
const sql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ type: 'sql', text: strings.join('?'), values }))

const selectChain = { from: vi.fn(), leftJoin: vi.fn(), where: vi.fn(), orderBy: vi.fn() }
const insertChain = { values: vi.fn(), returning: vi.fn() }
const db = { select: vi.fn(), insert: vi.fn(), delete: vi.fn() }

vi.mock('@/lib/authz', () => ({ requirePermission }))
vi.mock('@/lib/db', () => ({
  db,
  bulkSaleDrafts: {
    id: 'bulkSaleDrafts.id',
    createdById: 'bulkSaleDrafts.createdById',
    name: 'bulkSaleDrafts.name',
    payload: 'bulkSaleDrafts.payload',
    createdAt: 'bulkSaleDrafts.createdAt',
  },
  users: { id: 'users.id', name: 'users.name' },
  eq,
  desc,
  sql,
}))

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    createdById: 9,
    name: 'Toko Sebelah',
    payload: { branchId: 2, branchName: 'Toko Pusat', rows: [{ productId: 1 }], grandTotal: 1000, itemCount: 1, source: null },
    createdAt: new Date('2026-09-17T00:00:00.000Z'),
    ...overrides,
  }
}

function postPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Toko Sebelah',
    branchId: 2,
    branchName: 'Toko Pusat',
    customerId: null,
    customerName: '',
    customerPhone: null,
    paymentMethodId: 1,
    dpMethodId: 1,
    amountPaid: 0,
    transactionDiscount: 0,
    dueAt: '',
    rows: [{ productId: 1 }],
    grandTotal: 1000,
    itemCount: 1,
    source: null,
    ...overrides,
  }
}

function jsonRequest(body: unknown) {
  return new Request('http://localhost/api/bo/bulk-sale-drafts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  requirePermission.mockResolvedValue({ userId: 9, userName: 'Admin Gudang', branchId: 2, role: 'MANAGER' })

  selectChain.from.mockReturnValue(selectChain)
  selectChain.leftJoin.mockReturnValue(selectChain)
  selectChain.where.mockReturnValue(selectChain)
  selectChain.orderBy.mockResolvedValue([])
  db.select.mockReturnValue(selectChain)

  insertChain.values.mockReturnValue(insertChain)
  insertChain.returning.mockResolvedValue([makeRow()])
  db.insert.mockReturnValue(insertChain)

  db.delete.mockReturnValue({ where: vi.fn().mockResolvedValue([]) })
})

describe('GET /api/bo/bulk-sale-drafts', () => {
  it('menolak tanpa izin', async () => {
    requirePermission.mockResolvedValue(
      NextResponse.json({ error: 'Akses ditolak untuk aksi ini' }, { status: 403 }),
    )
    const { GET } = await import('./route')

    const res = await GET()

    expect(res.status).toBe(403)
  })

  it('mengembalikan draf seluruh cabang sesi (bukan hanya milik user) beserta nama penahan', async () => {
    selectChain.orderBy.mockResolvedValue([makeRow({ createdByName: 'Admin Lain' })])
    const { GET } = await import('./route')

    const res = await GET()
    const json = await res.json()

    expect(json).toHaveLength(1)
    expect(json[0].id).toBe('1')
    expect(json[0].name).toBe('Toko Sebelah')
    expect(json[0].branchId).toBe(2)
    expect(json[0].createdByName).toBe('Admin Lain')
    const where = selectChain.where.mock.calls[0][0]
    expect(where).toMatchObject({ type: 'sql', values: ['bulkSaleDrafts.payload', '2'] })
  })

  it('OWNER/GM melihat draf semua cabang (tanpa filter)', async () => {
    requirePermission.mockResolvedValue({ userId: 1, userName: 'Owner', branchId: 2, role: 'OWNER' })
    const { GET } = await import('./route')

    await GET()

    expect(selectChain.where).toHaveBeenCalledWith(undefined)
  })
})

describe('POST /api/bo/bulk-sale-drafts', () => {
  it('menolak tanpa izin', async () => {
    requirePermission.mockResolvedValue(
      NextResponse.json({ error: 'Akses ditolak untuk aksi ini' }, { status: 403 }),
    )
    const { POST } = await import('./route')

    const res = await POST(jsonRequest(postPayload()))

    expect(res.status).toBe(403)
  })

  it('menolak Content-Type bukan application/json', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/bo/bulk-sale-drafts', {
      method: 'POST',
      body: JSON.stringify(postPayload()),
    })

    const res = await POST(req)

    expect(res.status).toBe(415)
  })

  it('menolak body tidak valid (rows kosong)', async () => {
    const { POST } = await import('./route')

    const res = await POST(jsonRequest(postPayload({ rows: [] })))

    expect(res.status).toBe(400)
  })

  it('menyimpan draft milik user sesi, bukan dari body', async () => {
    const { POST } = await import('./route')

    const res = await POST(jsonRequest(postPayload()))
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ createdById: 9, name: 'Toko Sebelah' }),
    )
    expect(json.id).toBe('1')
  })

  it('menolak draf untuk cabang selain cabang sesi (non OWNER/GM)', async () => {
    const { POST } = await import('./route')

    const res = await POST(jsonRequest(postPayload({ branchId: 5 })))

    expect(res.status).toBe(403)
    expect(insertChain.values).not.toHaveBeenCalled()
  })

  it('membuang draft tertua saat melewati batas 20', async () => {
    const overflowRows = Array.from({ length: 21 }, (_, i) => makeRow({ id: i + 1 }))
    selectChain.orderBy.mockResolvedValue(overflowRows)
    const deleteWhere = vi.fn().mockResolvedValue([])
    db.delete.mockReturnValue({ where: deleteWhere })

    const { POST } = await import('./route')
    await POST(jsonRequest(postPayload()))

    // 21 baris setelah insert, batas 20 → 1 baris tertua (slice setelah index 20) dihapus.
    expect(deleteWhere).toHaveBeenCalledTimes(1)
  })
})
