import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const requirePermission = vi.fn()
const getDefaultCredentials = vi.fn()
const syncUserBranchAssignments = vi.fn()
const insertedValues = vi.fn()

vi.mock('@/lib/authz', () => ({
  requirePermission,
  getAuth: vi.fn(),
}))

vi.mock('@/lib/app-settings', () => ({ getDefaultCredentials }))

vi.mock('@/lib/services/user-branch-assignments', () => ({
  syncUserBranchAssignments,
  listBranchAssignments: vi.fn(),
}))

vi.mock('argon2', () => ({ hash: vi.fn(async (v: string) => `hash:${v}`) }))

// Stub trx: select(...).from(...).where(...).limit(1) selalu kosong (tidak ada duplikat),
// kecuali lookup role & branch yang harus menemukan satu baris.
vi.mock('@/lib/db', () => {
  const table = (name: string) => ({ __table: name })
  const selectChain = (rows: unknown[]) => {
    const chain = {
      from: (t: { __table: string }) => (t.__table === 'roles' || t.__table === 'branches' ? selectChain([{ id: 1 }]) : chain),
      where: () => chain,
      limit: async () => rows,
    }
    return chain
  }
  const trx = {
    select: () => selectChain([]),
    insert: () => ({
      values: (v: unknown) => {
        insertedValues(v)
        return { returning: async () => [{ id: 99, name: 'Staf Baru' }] }
      },
    }),
  }
  return {
    db: { transaction: async (fn: (t: typeof trx) => unknown) => fn(trx) },
    users: table('users'),
    roles: table('roles'),
    branches: table('branches'),
    eq: () => ({}),
    and: () => ({}),
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
  }
})

const { POST } = await import('./route')

function request(body: unknown) {
  return new NextRequest('http://localhost/api/bo/settings/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// Bentuk body persis seperti yang dikirim user-form.tsx saat tambah pengguna.
function formBody(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Staf Baru',
    username: 'stafbaru',
    email: null,
    staffNumber: null,
    password: '',
    pin: '',
    roleId: 1,
    branchId: 1,
    assignedBranchIds: [],
    ...overrides,
  }
}

describe('POST /api/bo/settings/users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requirePermission.mockResolvedValue({ userId: 7, role: 'OWNER' })
    getDefaultCredentials.mockResolvedValue({ password: 'password123', pin: '123456' })
  })

  it('menerima email/staffNumber null dan password/pin kosong dari form', async () => {
    const res = await POST(request(formBody()))
    expect(res.status).toBe(201)
    expect(insertedValues).toHaveBeenCalledWith(
      expect.objectContaining({
        email: null,
        staffNumber: null,
        passwordHash: 'hash:password123',
        pinHash: 'hash:123456',
        mustChangeCredentials: true,
      }),
    )
  })

  it('memakai password & PIN dari input bila diisi', async () => {
    const res = await POST(request(formBody({ password: 'rahasia123', pin: '4321' })))
    expect(res.status).toBe(201)
    expect(insertedValues).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: 'hash:rahasia123', pinHash: 'hash:4321' }),
    )
  })

  it('menyimpan email & nomor staf bila diisi', async () => {
    const res = await POST(request(formBody({ email: 'staf@contoh.com', staffNumber: 'S-01' })))
    expect(res.status).toBe(201)
    expect(insertedValues).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'staf@contoh.com', staffNumber: 'S-01' }),
    )
  })

  it('menyimpan username & email dalam huruf kecil', async () => {
    // Login membandingkan keduanya case-insensitive, jadi penyimpanannya harus dinormalkan —
    // kalau tidak, "Budi" dan "budi" bisa hidup berdampingan dan login jadi ambigu.
    const res = await POST(
      request(formBody({ username: 'StafBaru', email: 'Staf@Contoh.COM', staffNumber: 'M-001' })),
    )

    expect(res.status).toBe(201)
    expect(insertedValues).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'stafbaru',
        email: 'staf@contoh.com',
        // Nomor staf sengaja TIDAK diturunkan: kodenya memang sering berhuruf besar.
        staffNumber: 'M-001',
      }),
    )
  })

  it('menolak email yang formatnya salah', async () => {
    const res = await POST(request(formBody({ email: 'bukan-email' })))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'Format email tidak valid' })
  })

  it('menolak PIN yang bukan 4–6 digit', async () => {
    const res = await POST(request(formBody({ pin: '12' })))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'PIN harus 4–6 digit angka' })
  })
})
