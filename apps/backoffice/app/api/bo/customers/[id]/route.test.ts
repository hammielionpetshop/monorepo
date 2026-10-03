import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ verify: vi.fn(), transaction: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'token' }) }) }))
vi.mock('@/lib/auth', () => ({ verifyAccessToken: mocks.verify }))
vi.mock('@/lib/db', () => ({
  db: { transaction: mocks.transaction },
  customers: { id: 'id', phone: 'phone', code: 'code' },
  transactions: {},
  eq: vi.fn(), and: vi.fn(), ne: vi.fn(),
}))

import { PUT } from './route'

let customer: Record<string, unknown>
let otherCustomers: { id: number; phone: string | null }[]
let saved: Record<string, unknown>

async function update(body: Record<string, unknown>) {
  return PUT(new NextRequest('http://localhost/api/bo/customers/11', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }), { params: Promise.resolve({ id: '11' }) })
}

describe('customer online order access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    customer = { id: 11, phone: '085223666617', isActive: true, canOrderOnline: false }
    otherCustomers = []
    saved = {}
    mocks.verify.mockResolvedValue({ role: 'OWNER' })
    let selects = 0
    mocks.transaction.mockImplementation(async (callback) => callback({
      select: () => {
        const rows = selects++ === 0 ? [customer] : otherCustomers
        const chain = {
          from: () => chain, where: () => chain, for: () => chain,
          limit: async () => rows,
          then: (resolve: (value: unknown) => unknown) => Promise.resolve(rows).then(resolve),
        }
        return chain
      },
      update: () => ({ set: (values: Record<string, unknown>) => {
        saved = values
        return { where: () => ({ returning: async () => [{ ...customer, ...values }] }) }
      } }),
    }))
  })

  it('activates and normalizes the phone used for OTP', async () => {
    const res = await update({ canOrderOnline: true })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ canOrderOnline: true, phone: '+6285223666617' })
  })

  it.each(['MANAGER', 'KASIR'])('rejects access changes from %s', async (role) => {
    mocks.verify.mockResolvedValue({ role })
    expect((await update({ canOrderOnline: true })).status).toBe(403)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('rejects an expired session', async () => {
    mocks.verify.mockResolvedValue(null)
    expect((await update({ canOrderOnline: true })).status).toBe(401)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it.each([null, 'abc'])('rejects activation with phone %s', async (phone) => {
    customer.phone = phone
    expect((await update({ canOrderOnline: true })).status).toBe(400)
    expect(saved).toEqual({})
  })

  it('rejects activation of an inactive customer', async () => {
    customer.isActive = false
    expect((await update({ canOrderOnline: true })).status).toBe(400)
  })

  it('rejects another customer with the same normalized phone', async () => {
    otherCustomers = [{ id: 12, phone: '0852 2366 6617' }]
    expect((await update({ canOrderOnline: true })).status).toBe(409)
    expect(saved).toEqual({})
  })

  it('allows GM to disable access even if the phone is no longer valid', async () => {
    mocks.verify.mockResolvedValue({ role: 'GM' })
    customer.canOrderOnline = true
    customer.phone = null
    const res = await update({ canOrderOnline: false })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ canOrderOnline: false })
  })

  it('keeps online customer phone normalized after a normal edit', async () => {
    customer.canOrderOnline = true
    const res = await update({ phone: '085223666617' })
    expect(res.status).toBe(200)
    expect(saved.phone).toBe('+6285223666617')
  })
})
