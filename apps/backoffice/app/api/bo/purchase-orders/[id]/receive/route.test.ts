import { beforeEach, describe, expect, it, vi } from 'vitest'
import { purchaseOrders } from '@petshop/db'
const { insert, permission, updates } = vi.hoisted(() => ({ insert: vi.fn(), permission: vi.fn(), updates: [] as Record<string, unknown>[] }))
let lockedStatus = 'APPROVED'
let received = 0
vi.mock('@/lib/authz', () => ({ requirePermission: permission }))
vi.mock('@/lib/db', async () => {
  const schema = await import('@petshop/db')
  const select = (inside: boolean) => ({ from: (table: unknown) => {
    const rows = table === schema.purchaseOrders ? [{ id: 1, status: inside ? lockedStatus : 'APPROVED' }]
      : [{ id: 1, qtyOrdered: 5, qtyReceived: received, qtyDamaged: 0 }]
    const chain: any = { where: () => chain, for: () => chain, limit: () => chain,
      then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject) }
    return chain
  } })
  return { ...schema, db: { select: () => select(false), transaction: async (callback: any) => callback({ select: () => select(true),
    insert: () => ({ values: (...args: any[]) => { insert(...args); return { returning: async () => [{ id: 1 }] } } }),
    update: () => ({ set: (v: Record<string, unknown>) => { updates.push(v); return { where: async () => [] } } }),
  }) } }
})
import { POST } from './route'

beforeEach(() => { vi.clearAllMocks(); updates.length = 0; lockedStatus = 'APPROVED'; received = 0; permission.mockResolvedValue({ userId: 1, branchId: 1, branchScope: 'ALL' }) })
async function receive(item: Record<string, unknown> = {}) {
  return POST(new Request('http://localhost', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: [{ poItemId: 1, qtyReceived: 2, qtyDamaged: 0, ...item }] }) }), { params: Promise.resolve({ id: '1' }) })
}
const itemUpdate = () => updates.find(u => 'qtyReceived' in u)!
describe('pencatatan penerimaan PO BO', () => {
  it('penerimaan valid tercatat', async () => { expect((await receive()).status).toBe(200) })
  it('approval di sela precheck ditolak tanpa membuat receiving log', async () => {
    lockedStatus = 'COMPLETED'
    expect((await receive()).status).toBe(409)
    expect(insert).not.toHaveBeenCalled()
  })
  it('qty terbaru pada header terkunci dipakai untuk validasi sisa', async () => {
    received = 4
    expect((await receive()).status).toBe(400)
  })
})

describe('harga beli diisi saat terima barang', () => {
  it('harga diketik disimpan sebagai harga faktur', async () => {
    expect((await receive({ unitPrice: 170250 })).status).toBe(200)
    expect(itemUpdate().invoiceUnitCost).toBe(170250)
  })
  it('harga dikosongkan (0) ditandai menunggu faktur tanpa menimpa harga yang sudah ada', async () => {
    expect((await receive({ unitPrice: 0 })).status).toBe(200)
    const value = itemUpdate().invoiceUnitCost
    expect(value).not.toBe(0)
    // Ekspresi SQL (CASE WHEN harga lama > 0 THEN harga lama ELSE 0), bukan angka 0 polos
    expect(value).toHaveProperty('queryChunks')
  })
  it('klien lama tanpa harga → harga faktur tidak disentuh', async () => {
    expect((await receive()).status).toBe(200)
    expect('invoiceUnitCost' in itemUpdate()).toBe(false)
  })
  it('barang yang tidak datang (qty 0) tidak menyimpan harga', async () => {
    expect((await receive({ qtyReceived: 0, unitPrice: 5000 })).status).toBe(200)
    expect('invoiceUnitCost' in itemUpdate()).toBe(false)
  })
  it('harga negatif ditolak', async () => {
    expect((await receive({ unitPrice: -1 })).status).toBe(400)
  })
})
