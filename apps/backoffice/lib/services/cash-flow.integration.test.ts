import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { db, branches, roles, users, moneyPlaces, cashFlowCategories, cashFlowEntries, eq, and, sql } from '../db'

// F2-4b Arus Kas (spec docs/work/specs/2026-11-09-f2-4-supplier-arus-kas-design.md §3) di DB lokal.
let actor = { userId: 0, branchId: 0, role: 'FINANCE', permissions: ['cashflow.record'] as string[] }
vi.mock('@/lib/authz', () => ({
  getAuth: async () => ({ ...actor, userName: 'Uji', branchName: 'Uji', branchScope: 'ALL' }),
  hasPermission: (p: { permissions: string[] }, code: string) => p.permissions.includes(code),
  requirePermission: async () => ({ ...actor, branchScope: 'ALL' }),
}))

import { POST as createEntry, GET as listEntries } from '../../app/api/bo/cash-flow/entries/route'
import { POST as cancelEntry } from '../../app/api/bo/cash-flow/entries/[id]/cancel/route'
import { todayWibDate } from '../payment-date'

const run = randomUUID().slice(0, 8)
let branchId: number
let financeId: number
let ownerId: number
let bankId: number
let costCategoryId: number
let systemCategoryId: number

const json = (body: unknown) =>
  new NextRequest('http://localhost', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const today = todayWibDate()

beforeAll(async () => {
  branchId = (await db.insert(branches).values({ code: `CF${run}`, name: `Toko Arus Kas ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `CF${run}` }).returning())[0].id
  financeId = (await db.insert(users).values({ name: `Finance ${run}`, roleId, branchId }).returning())[0].id
  ownerId = (await db.insert(users).values({ name: `Owner ${run}`, roleId, branchId }).returning())[0].id
  bankId = (await db.insert(moneyPlaces).values({
    name: `Rekening Arus Kas ${run}`, kind: 'BANK', branchId, bankName: 'BCA', accountNumber: '99', accountHolder: 'Uji',
  }).returning())[0].id
  costCategoryId = (await db.insert(cashFlowCategories).values({ name: `Listrik ${run}`, type: 'EXPENSE', reportKind: 'COST' }).returning())[0].id
  const [system] = await db.select({ id: cashFlowCategories.id }).from(cashFlowCategories)
    .where(and(eq(cashFlowCategories.name, 'Bayar Hutang Internal'), eq(cashFlowCategories.type, 'EXPENSE')))
  systemCategoryId = system?.id ?? (await db.insert(cashFlowCategories).values({ name: 'Bayar Hutang Internal', type: 'EXPENSE', isSystem: true, reportKind: 'NON_COST' }).returning())[0].id
  actor = { userId: financeId, branchId, role: 'FINANCE', permissions: ['cashflow.record'] }
})

const valid = () => ({
  type: 'EXPENSE', categoryId: costCategoryId, amount: 125_000, occurredOn: today, forMonth: '2026-10',
  branchId, moneyPlaceId: bankId, note: 'Listrik Oktober',
})

describe('Arus Kas F2-4b (DB lokal)', () => {
  it('mencatat dengan tanggal uang, untuk bulan, cabang, dan Tempat Uang', async () => {
    const res = await createEntry(json(valid()))
    expect(res.status).toBe(201)
    const row = await res.json()
    expect(row).toMatchObject({ occurredOn: today, forMonth: '2026-10-01', moneyPlaceId: bankId, branchId, cancelledAt: null })
  })

  it('"Bersama" = cabang kosong; Tempat Uang wajib; kategori sistem ditolak', async () => {
    expect((await createEntry(json({ ...valid(), branchId: null }))).status).toBe(201)
    expect((await createEntry(json({ ...valid(), moneyPlaceId: undefined }))).status).toBe(400)
    expect((await createEntry(json({ ...valid(), categoryId: systemCategoryId }))).status).toBe(400)
  })

  it('tanpa hak cashflow.record tidak boleh mencatat', async () => {
    const saved = actor
    actor = { ...actor, permissions: [] }
    expect((await createEntry(json(valid()))).status).toBe(403)
    actor = saved
  })

  it('database menolak ubah & hapus catatan', async () => {
    const row = await (await createEntry(json(valid()))).json()
    await expect(db.update(cashFlowEntries).set({ amount: 1 }).where(eq(cashFlowEntries.id, row.id))).rejects.toThrow()
    await expect(db.delete(cashFlowEntries).where(eq(cashFlowEntries.id, row.id))).rejects.toThrow()
  })

  it('batal: pencatat hari yang sama boleh; orang lain tanpa cashflow.cancel ditolak; Owner/GM boleh', async () => {
    const mine = await (await createEntry(json(valid()))).json()
    const params = (id: number) => ({ params: Promise.resolve({ id: String(id) }) })
    expect((await cancelEntry(json({ reason: '' }), params(mine.id))).status).toBe(400)
    expect((await cancelEntry(json({ reason: 'salah ketik' }), params(mine.id))).status).toBe(200)
    expect((await cancelEntry(json({ reason: 'lagi' }), params(mine.id))).status).toBe(409)

    const other = await (await createEntry(json(valid()))).json()
    actor = { userId: ownerId, branchId, role: 'GM', permissions: ['cashflow.record'] }
    expect((await cancelEntry(json({ reason: 'bukan punya saya' }), params(other.id))).status).toBe(409)
    actor = { userId: ownerId, branchId, role: 'OWNER', permissions: ['cashflow.record', 'cashflow.cancel'] }
    expect((await cancelEntry(json({ reason: 'dobel catat' }), params(other.id))).status).toBe(200)

    const [row] = await db.select().from(cashFlowEntries).where(eq(cashFlowEntries.id, other.id))
    expect(row.cancelledBy).toBe(ownerId)
    expect(row.cancelReason).toBe('dobel catat')
    actor = { userId: financeId, branchId, role: 'FINANCE', permissions: ['cashflow.record'] }
  })

  it('catatan kemarin oleh pencatatnya sendiri tidak bisa dibatalkan tanpa cashflow.cancel', async () => {
    const [old] = await db.insert(cashFlowEntries).values({
      type: 'EXPENSE', categoryId: costCategoryId, branchId, amount: 5_000, createdBy: financeId,
      createdAt: sql`now() - interval '2 days'`, moneyPlaceId: bankId,
    }).returning()
    expect((await cancelEntry(json({ reason: 'telat' }), { params: Promise.resolve({ id: String(old.id) }) })).status).toBe(409)
  })

  it('daftar menyembunyikan yang batal kecuali diminta, dan memberi tanda canCancel', async () => {
    const url = (q: string) => new NextRequest(`http://localhost/api/bo/cash-flow/entries?branch=${branchId}&from=2020-01-01${q}`)
    const visible = await (await listEntries(url(''))).json()
    const all = await (await listEntries(url('&includeCancelled=1'))).json()
    expect(all.length).toBe(visible.length + 2)
    expect(visible.every((r: { cancelledAt: string | null }) => r.cancelledAt === null)).toBe(true)
    expect(visible.some((r: { canCancel: boolean }) => r.canCancel)).toBe(true)
  })
})
