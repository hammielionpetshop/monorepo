import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const requirePermission = vi.fn()
const transaction = vi.fn()
const eq = vi.fn((field, value) => ({ type: 'eq', field, value }))

const shifts = { id: 'shifts.id' }
const auditLogs = { id: 'auditLogs.id' }

vi.mock('@/lib/authz', () => ({ requirePermission }))
vi.mock('@/lib/db', () => ({ db: { transaction }, shifts, auditLogs, eq }))

const baseShift = {
  id: 7,
  branchId: 2,
  status: 'CLOSED',
  origin: 'POS',
  totalClosingCashReal: 2_000_000,
  totalClosingCashExpected: 2_000_000,
  depositReceivedCash: null,
  depositVariance: null,
  depositVerifiedById: null,
  depositVerifiedAt: null,
  depositNotes: null,
}

const financePayload = { userId: 9, userName: 'Finance', role: 'FINANCE', branchId: 2, branchScope: 'OWN' }

let shiftRow: Record<string, unknown> | null
let updates: Record<string, unknown>[]
let audits: Record<string, unknown>[]

function buildTx() {
  return {
    select: () => ({ from: () => ({ where: () => ({ for: async () => (shiftRow ? [shiftRow] : []) }) }) }),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        updates.push(values)
        return { where: () => ({ returning: async () => [{ ...shiftRow, ...values }] }) }
      },
    }),
    insert: () => ({ values: async (v: Record<string, unknown>) => { audits.push(v) } }),
  }
}

function post(body: unknown) {
  return new Request('http://localhost/api/bo/shifts/7/deposit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function call(body: unknown) {
  const { POST } = await import('./route')
  return POST(post(body), { params: Promise.resolve({ id: '7' }) })
}

beforeEach(() => {
  shiftRow = { ...baseShift }
  updates = []
  audits = []
  requirePermission.mockReset().mockResolvedValue(financePayload)
  transaction.mockReset().mockImplementation(async (fn: (tx: unknown) => unknown) => fn(buildTx()))
})

describe('POST /api/bo/shifts/[id]/deposit', () => {
  it('mencatat kas diterima dan selisih serah-terima terhadap angka kasir', async () => {
    const res = await call({ receivedCash: 1_850_000, notes: 'kurang 150rb' })
    expect(res.status).toBe(200)
    expect(updates[0]).toMatchObject({ depositReceivedCash: 1_850_000, depositVariance: -150_000, depositVerifiedById: 9 })
    expect(audits[0]).toMatchObject({ action: 'SHIFT_DEPOSIT_VERIFY', recordId: '7', oldData: null })
  })

  it('menolak selisih tanpa catatan', async () => {
    const res = await call({ receivedCash: 1_850_000 })
    expect(res.status).toBe(400)
    expect(updates).toHaveLength(0)
  })

  it('tidak butuh catatan bila cocok', async () => {
    const res = await call({ receivedCash: 2_000_000 })
    expect(res.status).toBe(200)
    expect(updates[0]).toMatchObject({ depositVariance: 0, depositNotes: null })
  })

  it('shift tutup paksa dibandingkan dengan kas sistem', async () => {
    shiftRow = { ...baseShift, status: 'FORCE_CLOSED', totalClosingCashReal: null, totalClosingCashExpected: 500_000 }
    const res = await call({ receivedCash: 450_000, notes: 'kurang' })
    expect(res.status).toBe(200)
    expect(updates[0]).toMatchObject({ depositVariance: -50_000 })
  })

  it('menolak shift yang masih berjalan', async () => {
    shiftRow = { ...baseShift, status: 'OPEN' }
    expect((await call({ receivedCash: 0 })).status).toBe(400)
  })

  it('menolak shift backoffice tanpa laci', async () => {
    shiftRow = { ...baseShift, origin: 'BACKOFFICE' }
    expect((await call({ receivedCash: 0 })).status).toBe(400)
  })

  it('finance cabang lain ditolak', async () => {
    shiftRow = { ...baseShift, branchId: 3 }
    expect((await call({ receivedCash: 2_000_000 })).status).toBe(403)
  })

  it('finance tidak bisa mengubah verifikasi yang sudah ada', async () => {
    shiftRow = { ...baseShift, depositVerifiedAt: new Date(), depositReceivedCash: 1_850_000, depositVariance: -150_000 }
    expect((await call({ receivedCash: 2_000_000 })).status).toBe(409)
    expect(updates).toHaveLength(0)
  })

  it('owner boleh mengoreksi dan jejak lamanya tersimpan', async () => {
    requirePermission.mockResolvedValue({ ...financePayload, role: 'OWNER', branchScope: 'ALL', branchId: 1 })
    shiftRow = { ...baseShift, depositVerifiedAt: new Date(), depositReceivedCash: 1_850_000, depositVariance: -150_000 }
    const res = await call({ receivedCash: 2_000_000 })
    expect(res.status).toBe(200)
    expect(audits[0].action).toBe('SHIFT_DEPOSIT_CORRECT')
    expect(JSON.parse(audits[0].oldData as string)).toMatchObject({ depositReceivedCash: 1_850_000 })
  })

  it('meneruskan penolakan izin', async () => {
    requirePermission.mockResolvedValue(NextResponse.json({ error: 'Akses ditolak untuk aksi ini' }, { status: 403 }))
    expect((await call({ receivedCash: 1 })).status).toBe(403)
    expect(transaction).not.toHaveBeenCalled()
  })
})
