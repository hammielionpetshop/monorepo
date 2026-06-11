import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted shared state ─────────────────────────────────────────────────────
const { mockSelectResults, selectCallIdx, mockExecuteResult, mockCookiesGet, mockVerify } = vi.hoisted(() => {
  const mockSelectResults: unknown[][] = []
  const selectCallIdx = { value: 0 }
  const mockExecuteResult = { value: [{ total: '5' }] as unknown }
  const mockCookiesGet = vi.fn()
  const mockVerify = vi.fn()
  return { mockSelectResults, selectCallIdx, mockExecuteResult, mockCookiesGet, mockVerify }
})

// ── Module mocks ─────────────────────────────────────────────────────────────
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: mockCookiesGet }),
}))

vi.mock('@/lib/auth', () => ({
  verifyAccessToken: mockVerify,
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          const result = mockSelectResults[selectCallIdx.value++] ?? []
          return Object.assign(Promise.resolve(result), {
            limit: vi.fn().mockResolvedValue(result),
          })
        }),
      }),
    })),
    execute: vi.fn().mockImplementation(() => Promise.resolve(mockExecuteResult.value)),
  },
  branches: { id: 'branches.id' },
  eq: vi.fn().mockReturnValue('eq'),
}))

import { POST } from './route'

// ── Test helpers ─────────────────────────────────────────────────────────────
const makeReq = (body: object, qs = '', contentType = 'application/json') =>
  new NextRequest(`http://localhost/api/bo/master-data/prices/copy-branch${qs}`, {
    method: 'POST',
    headers: { 'content-type': contentType },
    body: JSON.stringify(body),
  })

const setAuth = (role: string | null) => {
  if (!role) {
    mockCookiesGet.mockReturnValue(undefined)
    mockVerify.mockResolvedValue(null)
  } else {
    mockCookiesGet.mockReturnValue({ value: 'tok' })
    mockVerify.mockResolvedValue({ userId: 1, role, branchId: 1 })
  }
}

const validBody = { sourceBranchId: 1, targetBranchId: 2, markupPercent: 0 }

// ── Auth & role tests ─────────────────────────────────────────────────────────
describe('POST /api/bo/master-data/prices/copy-branch — auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectResults.length = 0
    selectCallIdx.value = 0
    mockExecuteResult.value = [{ rowCount: 5 }]
  })

  it('returns 401 tanpa token', async () => {
    setAuth(null)
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toContain('Sesi tidak valid')
  })

  it('returns 403 untuk role KASIR', async () => {
    setAuth('KASIR')
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toContain('Owner dan GM')
  })

  it('returns 403 untuk role MANAGER', async () => {
    setAuth('MANAGER')
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(403)
  })

  it('returns 403 untuk role GUDANG', async () => {
    setAuth('GUDANG')
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(403)
  })

  it('returns 403 untuk role FINANCE', async () => {
    setAuth('FINANCE')
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(403)
  })

  it('returns 415 untuk content-type bukan JSON', async () => {
    setAuth('OWNER')
    const res = await POST(makeReq(validBody, '', 'text/plain'))
    expect(res.status).toBe(415)
  })
})

// ── Input validation tests ────────────────────────────────────────────────────
describe('POST /api/bo/master-data/prices/copy-branch — validasi input', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectResults.length = 0
    selectCallIdx.value = 0
    mockExecuteResult.value = [{ rowCount: 5 }]
  })

  it('returns 400 ketika sourceBranchId sama dengan targetBranchId', async () => {
    setAuth('OWNER')
    const res = await POST(makeReq({ sourceBranchId: 1, targetBranchId: 1, markupPercent: 0 }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('tidak boleh sama')
  })

  it('returns 400 ketika markup di bawah -99%', async () => {
    setAuth('OWNER')
    const res = await POST(makeReq({ sourceBranchId: 1, targetBranchId: 2, markupPercent: -100 }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('-99%')
  })

  it('returns 400 ketika markup di atas 999%', async () => {
    setAuth('OWNER')
    const res = await POST(makeReq({ sourceBranchId: 1, targetBranchId: 2, markupPercent: 1000 }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('999%')
  })

  it('returns 400 ketika sourceBranchId tidak ada', async () => {
    setAuth('OWNER')
    const res = await POST(makeReq({ targetBranchId: 2, markupPercent: 0 }))
    expect(res.status).toBe(400)
  })

  it('returns 400 ketika targetBranchId tidak ada', async () => {
    setAuth('OWNER')
    const res = await POST(makeReq({ sourceBranchId: 1, markupPercent: 0 }))
    expect(res.status).toBe(400)
  })

  it('menerima markup 0 (default, tanpa markup)', async () => {
    setAuth('OWNER')
    mockSelectResults.push([{ id: 1 }]) // source branch
    mockSelectResults.push([{ id: 2 }]) // target branch
    mockExecuteResult.value = [{ rowCount: 3 }]
    const res = await POST(makeReq({ sourceBranchId: 1, targetBranchId: 2 }))
    expect(res.status).toBe(200)
  })

  it('menerima markup pada batas -99%', async () => {
    setAuth('OWNER')
    mockSelectResults.push([{ id: 1 }])
    mockSelectResults.push([{ id: 2 }])
    mockExecuteResult.value = [{ rowCount: 3 }]
    const res = await POST(makeReq({ sourceBranchId: 1, targetBranchId: 2, markupPercent: -99 }))
    expect(res.status).toBe(200)
  })

  it('menerima markup pada batas 999%', async () => {
    setAuth('OWNER')
    mockSelectResults.push([{ id: 1 }])
    mockSelectResults.push([{ id: 2 }])
    mockExecuteResult.value = [{ rowCount: 3 }]
    const res = await POST(makeReq({ sourceBranchId: 1, targetBranchId: 2, markupPercent: 999 }))
    expect(res.status).toBe(200)
  })
})

// ── Branch lookup tests ───────────────────────────────────────────────────────
describe('POST /api/bo/master-data/prices/copy-branch — lookup cabang', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectResults.length = 0
    selectCallIdx.value = 0
    mockExecuteResult.value = [{ rowCount: 5 }]
  })

  it('returns 404 ketika cabang sumber tidak ditemukan', async () => {
    setAuth('OWNER')
    mockSelectResults.push([]) // source not found
    mockSelectResults.push([{ id: 2 }]) // target found
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(404)
    expect((await res.json()).error).toContain('Cabang sumber tidak ditemukan')
  })

  it('returns 404 ketika cabang tujuan tidak ditemukan', async () => {
    setAuth('OWNER')
    mockSelectResults.push([{ id: 1 }]) // source found
    mockSelectResults.push([])          // target not found
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(404)
    expect((await res.json()).error).toContain('Cabang tujuan tidak ditemukan')
  })
})

// ── Preview & copy tests ──────────────────────────────────────────────────────
describe('POST /api/bo/master-data/prices/copy-branch — preview & copy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectResults.length = 0
    selectCallIdx.value = 0
  })

  it('mengembalikan jumlah harga yang akan disalin saat ?preview=1', async () => {
    setAuth('OWNER')
    mockSelectResults.push([{ id: 1 }])
    mockSelectResults.push([{ id: 2 }])
    mockExecuteResult.value = [{ total: '25' }]
    const res = await POST(makeReq(validBody, '?preview=1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('total', 25)
    expect(body).not.toHaveProperty('copied')
  })

  it('mengembalikan jumlah harga yang disalin saat copy aktual', async () => {
    setAuth('OWNER')
    mockSelectResults.push([{ id: 1 }])
    mockSelectResults.push([{ id: 2 }])
    mockExecuteResult.value = { rowCount: 42 } // route baca result.rowCount langsung (bukan array)
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('copied', 42)
    expect(body).not.toHaveProperty('total')
  })

  it('OWNER bisa copy dengan markup positif', async () => {
    setAuth('OWNER')
    mockSelectResults.push([{ id: 1 }])
    mockSelectResults.push([{ id: 2 }])
    mockExecuteResult.value = { rowCount: 10 }
    const res = await POST(makeReq({ sourceBranchId: 1, targetBranchId: 2, markupPercent: 10 }))
    expect(res.status).toBe(200)
    expect((await res.json()).copied).toBe(10)
  })

  it('GM bisa copy dengan markup negatif (diskon)', async () => {
    setAuth('GM')
    mockSelectResults.push([{ id: 1 }])
    mockSelectResults.push([{ id: 2 }])
    mockExecuteResult.value = { rowCount: 8 }
    const res = await POST(makeReq({ sourceBranchId: 1, targetBranchId: 2, markupPercent: -20 }))
    expect(res.status).toBe(200)
    expect((await res.json()).copied).toBe(8)
  })
})
