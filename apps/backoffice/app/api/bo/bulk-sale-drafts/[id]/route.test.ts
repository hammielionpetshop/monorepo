import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const requirePermission = vi.fn()
const eq = vi.fn((left, right) => ({ type: 'eq', left, right }))
const and = vi.fn((...conditions) => ({ type: 'and', conditions }))
const sql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ type: 'sql', text: strings.join('?'), values }))

const deleteChain = { where: vi.fn(), returning: vi.fn() }
const db = { delete: vi.fn() }

vi.mock('@/lib/authz', () => ({ requirePermission }))
vi.mock('@/lib/db', () => ({
  db,
  bulkSaleDrafts: { id: 'bulkSaleDrafts.id', createdById: 'bulkSaleDrafts.createdById', payload: 'bulkSaleDrafts.payload' },
  eq,
  and,
  sql,
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

  it('mengembalikan 404 saat draf sudah dilanjutkan/dihapus admin lain atau beda cabang', async () => {
    deleteChain.returning.mockResolvedValue([])
    const { DELETE } = await import('./route')

    const res = await DELETE({} as NextRequest, makeParams('1'))

    expect(res.status).toBe(404)
  })

  it('rekan secabang boleh menghapus draf (dibatasi cabang sesi, bukan penahan)', async () => {
    const { DELETE } = await import('./route')

    const res = await DELETE({} as NextRequest, makeParams('1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ success: true })
    expect(and).toHaveBeenCalledWith(
      { type: 'eq', left: 'bulkSaleDrafts.id', right: 1 },
      expect.objectContaining({ type: 'sql', values: ['bulkSaleDrafts.payload', '2'] }),
    )
  })

  it('OWNER/GM boleh menghapus draf cabang mana pun', async () => {
    requirePermission.mockResolvedValue({ userId: 1, branchId: 2, role: 'GM' })
    const { DELETE } = await import('./route')

    const res = await DELETE({} as NextRequest, makeParams('1'))

    expect(res.status).toBe(200)
    expect(and).toHaveBeenCalledWith({ type: 'eq', left: 'bulkSaleDrafts.id', right: 1 }, undefined)
  })
})
