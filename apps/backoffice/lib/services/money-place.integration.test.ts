import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { db, branches, roles, users, paymentMethods, moneyPlaces, auditLogs, eq, and, inArray } from '../db'
import {
  createMoneyPlace, updateMoneyPlace, setMoneyPlaceActive, setPaymentLink, listMoneyPlaces, getPaymentLinkMatrix,
} from './money-place-service'

// F2-1a Tempat Uang: laci otomatis per cabang, rekening wajib bank+nomor, tidak dihapus,
// tidak bisa dinonaktifkan/diubah jenis selama masih ditautkan metode bayar.
const run = randomUUID().slice(0, 8)
let actor: { userId: number; branchId: number }
let branchB: number
let qrisId: number
let cashMethodId: number

beforeAll(async () => {
  const branchA = (await db.insert(branches).values({ code: `MA${run}`, name: `Toko A ${run}` }).returning())[0].id
  branchB = (await db.insert(branches).values({ code: `MB${run}`, name: `Toko B ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `MP${run}` }).returning())[0].id
  const userId = (await db.insert(users).values({ name: `MP${run}`, roleId, branchId: branchA }).returning())[0].id
  actor = { userId, branchId: branchA }
  qrisId = (await db.insert(paymentMethods).values({ name: `QRIS ${run}`, type: 'QRIS' }).returning())[0].id
  cashMethodId = (await db.insert(paymentMethods).values({ name: `Tunai ${run}`, type: 'CASH' }).returning())[0].id
})

describe('Tempat Uang (DB lokal)', () => {
  it('cabang baru otomatis punya Laci Kasir, ikut berganti nama, dan tidak bisa diubah/dinonaktifkan', async () => {
    const drawers = await db.select().from(moneyPlaces).where(and(eq(moneyPlaces.branchId, branchB), eq(moneyPlaces.kind, 'DRAWER')))
    expect(drawers).toHaveLength(1)
    expect(drawers[0]).toMatchObject({ name: `Laci Kasir Toko B ${run}`, heldBy: 'STORE', isActive: true })

    await db.update(branches).set({ name: `Toko B Baru ${run}` }).where(eq(branches.id, branchB))
    const [renamed] = await db.select().from(moneyPlaces).where(eq(moneyPlaces.id, drawers[0].id))
    expect(renamed.name).toBe(`Laci Kasir Toko B Baru ${run}`)

    await expect(setMoneyPlaceActive(drawers[0].id, false, actor)).rejects.toMatchObject({ code: 'DRAWER_READONLY' })
    await expect(updateMoneyPlace(drawers[0].id, { name: 'x', kind: 'CASH', branchId: branchB, heldBy: 'FINANCE' }, actor))
      .rejects.toMatchObject({ code: 'DRAWER_READONLY' })
  })

  it('rekening wajib bank + nomor; nama kembar ditolak tanpa peduli huruf besar-kecil; tunai tidak menyimpan isian rekening', async () => {
    await expect(createMoneyPlace({ name: `Rek B ${run}`, kind: 'BANK', branchId: branchB, bankName: 'BCA', heldBy: 'FINANCE' }, actor))
      .rejects.toMatchObject({ code: 'BANK_FIELDS_REQUIRED', status: 400 })

    const rek = await createMoneyPlace({
      name: ` Rek B ${run} `, kind: 'BANK', branchId: branchB, bankName: 'BCA', accountNumber: '1234567890', accountHolder: 'Toko B', heldBy: 'FINANCE',
    }, actor)
    expect(rek).toMatchObject({ name: `Rek B ${run}`, kind: 'BANK', accountNumber: '1234567890', linkCount: 0 })

    await expect(createMoneyPlace({ name: `REK B ${run}`, kind: 'CASH', branchId: branchB, heldBy: 'FINANCE' }, actor))
      .rejects.toMatchObject({ code: 'DUPLICATE_NAME', status: 409 })

    const kas = await createMoneyPlace({ name: `Kas ${run}`, kind: 'CASH', branchId: branchB, bankName: 'abaikan', accountNumber: '9', heldBy: 'OTHER', holderNote: 'Driver Andi' }, actor)
    expect(kas).toMatchObject({ bankName: null, accountNumber: null, holderNote: 'Driver Andi' })

    // Penghapusan dijaga database.
    await expect(db.delete(moneyPlaces).where(eq(moneyPlaces.id, kas.id))).rejects.toThrow()
  })

  it('tautan metode bayar: hanya non-tunai ke rekening aktif; yang ditautkan tidak bisa dinonaktifkan/ganti jenis; semua berjejak', async () => {
    const rek = await createMoneyPlace({
      name: `Rek Link ${run}`, kind: 'BANK', branchId: branchB, bankName: 'BRI', accountNumber: '555', heldBy: 'FINANCE',
    }, actor)
    const kas = await createMoneyPlace({ name: `Kas Link ${run}`, kind: 'CASH', branchId: branchB, heldBy: 'FINANCE' }, actor)

    await expect(setPaymentLink({ paymentMethodId: cashMethodId, branchId: branchB, moneyPlaceId: rek.id }, actor))
      .rejects.toMatchObject({ code: 'METHOD_NOT_LINKABLE' })
    await expect(setPaymentLink({ paymentMethodId: qrisId, branchId: branchB, moneyPlaceId: kas.id }, actor))
      .rejects.toMatchObject({ code: 'PLACE_NOT_BANK' })

    await setPaymentLink({ paymentMethodId: qrisId, branchId: branchB, moneyPlaceId: rek.id }, actor)
    const matrix = await getPaymentLinkMatrix()
    expect(matrix.links).toContainEqual({ paymentMethodId: qrisId, branchId: branchB, moneyPlaceId: rek.id })
    expect(matrix.methods.map((m) => m.id)).toContain(qrisId)
    expect(matrix.methods.map((m) => m.id)).not.toContain(cashMethodId)

    await expect(setMoneyPlaceActive(rek.id, false, actor)).rejects.toMatchObject({ code: 'IN_USE', status: 409 })
    await expect(updateMoneyPlace(rek.id, { name: rek.name, kind: 'CASH', branchId: branchB, heldBy: 'FINANCE' }, actor))
      .rejects.toMatchObject({ code: 'IN_USE' })
    // Ubah nama/pemegang tetap boleh.
    const renamed = await updateMoneyPlace(rek.id, {
      name: `Rek Link Baru ${run}`, kind: 'BANK', branchId: branchB, bankName: 'BRI', accountNumber: '555', heldBy: 'STORE',
    }, actor)
    expect(renamed).toMatchObject({ heldBy: 'STORE', linkCount: 1 })

    // Lepas tautan → boleh dinonaktifkan; yang nonaktif tidak bisa ditautkan lagi.
    await setPaymentLink({ paymentMethodId: qrisId, branchId: branchB, moneyPlaceId: null }, actor)
    const off = await setMoneyPlaceActive(rek.id, false, actor)
    expect(off.isActive).toBe(false)
    await expect(setPaymentLink({ paymentMethodId: qrisId, branchId: branchB, moneyPlaceId: rek.id }, actor))
      .rejects.toMatchObject({ code: 'PLACE_INACTIVE' })
    expect((await listMoneyPlaces({ activeOnly: true })).map((p) => p.id)).not.toContain(rek.id)
    expect((await listMoneyPlaces()).map((p) => p.id)).toContain(rek.id)

    const trail = await db.select({ action: auditLogs.action }).from(auditLogs)
      .where(and(eq(auditLogs.tableName, 'money_places'), inArray(auditLogs.recordId, [String(rek.id), `${qrisId}:${branchB}`])))
    expect(trail.map((t) => t.action).sort()).toEqual([
      'MONEY_PLACE_CREATE', 'MONEY_PLACE_DEACTIVATE', 'MONEY_PLACE_LINK_REMOVE', 'MONEY_PLACE_LINK_SET', 'MONEY_PLACE_UPDATE',
    ])
  })
})
