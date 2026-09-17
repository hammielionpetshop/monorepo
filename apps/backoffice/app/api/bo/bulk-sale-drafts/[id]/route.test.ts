import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const requirePermission = vi.fn()
const eq = vi.fn((left, right) => ({ type: 'eq', left, right }))
const and = vi.fn((...conditions) => ({ type: 'and', conditions }))

const deleteChain = { where: vi.fn(), returning: vi.fn() }
const db = { delete: vi.fn() }

vi.mock('@/lib/authz', () => ({ requirePermission }))
vi.mock('@/lib/db', () => ({
  db,
  bulkSaleDrafts: { id: 'bulkSaleDrafts.id', createdById: 'bulkSaleDrafts.createdById' },
  eq,
  and,
}))

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  requirePermission.mockResolvedValue({ userId: 9, branchId: 2, role: 'MANAGER' })
  deleteChain.where.mockReturnValue(deleteChain)
  deleteChain.returning.mockResolvedValue([{ id: 1 }])
  db.delete.mockReturnValue(deleteChain)
})

describe('DELETE /api/bo/bulk-sale-drafts/[id]', () => {
  it('menolak tanpa izin', async () => {
    requirePermission.mockResolvedValue(
      NextResponse.json({ error: 'Akses ditolak untuk aksi ini' }, { status: 403 }),
    )
    const { DELETE } = await import('./route')

    const res = await DELETE({} as NextRequest, makeParams('1'))

    expect(res.status).toBe(403)
  })

  it('menolak id tidak valid', async () => {
    const { DELETE } = await import('./route')

    const res = await DELETE({} as NextRequest, makeParams('abc'))

    expect(res.status).toBe(400)
  })

  it('mengembalikan 404 saat draft bukan milik user sesi / tidak ada', async () => {
    deleteChain.returning.mockResolvedValue([])
    const { DELETE } = await import('./route')

    const res = await DELETE({} as NextRequest, makeParams('1'))

    expect(res.status).toBe(404)
  })

  it('menghapus draft milik user sesi', async () => {
    const { DELETE } = await import('./route')

    const res = await DELETE({} as NextRequest, makeParams('1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ success: true })
  })
})
