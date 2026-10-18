import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  db, branches, unitsOfMeasure, products, productUomConversions, productPrices, productUomCosts,
  roles, users, appSettings, auditLogs, and, eq,
} from '../db'
import {
  createPromo, deactivatePromo, findPromoLosses, getPromoEnabled, listPromoItemOptions, listPromos, setPromoEnabled,
  PromoLossError, PromoServiceError, PROMO_SWITCH_SETTING_KEY, type NewPromoInput,
} from './promo-service'

// Layanan promo Back Office (P2b): buat, daftar, nonaktifkan, peringatan jual rugi, saklar darurat.
const run = randomUUID().slice(0, 8)
let toko: number
let tokoLain: number
let userId: number
let pcs: number
let dus: number
let pakan: number
let pasir: number
let ongkir: number
let switchBefore: string | undefined

const actor = () => ({ userId, branchId: toko })
const NOW = new Date()
const hours = (h: number) => new Date(NOW.getTime() + h * 3600_000).toISOString()

const promo = (over: Partial<NewPromoInput> = {}): NewPromoInput => ({
  name: `Promo ${run}`, kind: 'POTONGAN', note: null, branchIds: [toko],
  startsAt: hours(-1), endsAt: hours(24), dailyStartMinute: null, dailyEndMinute: null,
  isMultiple: false, maxPerNote: null,
  conditions: [{ productId: pakan, uomId: pcs, minQty: 1 }],
  rewards: [{ productId: pakan, uomId: pcs, type: 'POTONG_PER_PCS', value: 1000, qty: null }],
  ...over,
})

const errorOf = async (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e)

beforeAll(async () => {
  toko = (await db.insert(branches).values({ code: `PM${run}`, name: `Toko Promo ${run}` }).returning())[0].id
  tokoLain = (await db.insert(branches).values({ code: `PL${run}`, name: `Toko Lain ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `PM${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `Owner PM ${run}`, roleId, branchId: toko }).returning())[0].id
  pcs = (await db.insert(unitsOfMeasure).values({ code: `PP${run}`, name: 'Pcs tes', isBase: true }).returning())[0].id
  dus = (await db.insert(unitsOfMeasure).values({ code: `PX${run}`, name: 'Dus tes', isBase: false }).returning())[0].id
  pakan = (await db.insert(products).values({ name: `Pakan Promo ${run}`, baseUomId: pcs }).returning())[0].id
  pasir = (await db.insert(products).values({ name: `Pasir Promo ${run}`, baseUomId: pcs }).returning())[0].id
  ongkir = (await db.insert(products).values({ name: `Ongkir PM ${run}`, baseUomId: pcs, productKind: 'JASA_ONGKIR' }).returning())[0].id
  await db.insert(productUomConversions).values({ productId: pakan, uomId: dus, ratio: 10 })
  // Pakan: harga 10.000, modal 9.000 di toko; di toko lain modal 6.000.
  await db.insert(productPrices).values([
    { productId: pakan, branchId: toko, uomId: pcs, tierType: 'RETAIL', price: 10000 },
    { productId: pakan, branchId: tokoLain, uomId: pcs, tierType: 'RETAIL', price: 10000 },
    { productId: pakan, branchId: toko, uomId: pcs, tierType: 'GROSIR', price: 8500 },
  ])
  await db.insert(productUomCosts).values([
    { productId: pakan, branchId: toko, uomId: pcs, costPrice: 9000 },
    { productId: pakan, branchId: tokoLain, uomId: pcs, costPrice: 6000 },
  ])
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, PROMO_SWITCH_SETTING_KEY))
  switchBefore = row?.value
})

afterAll(async () => {
  if (switchBefore === undefined) await db.delete(appSettings).where(eq(appSettings.key, PROMO_SWITCH_SETTING_KEY))
  else await db.update(appSettings).set({ value: switchBefore }).where(eq(appSettings.key, PROMO_SWITCH_SETTING_KEY))
})

describe('Layanan promo Back Office (DB lokal)', () => {
  it('membuat promo: tersimpan lengkap, tampil di daftar sebagai Berjalan, berjejak', async () => {
    const { id } = await createPromo(promo({
      name: `  Pakan hemat ${run} `, note: 'Akhir bulan', isMultiple: true, maxPerNote: 3,
      conditions: [{ productId: pakan, uomId: pcs, minQty: 2 }],
      rewards: [{ productId: pasir, uomId: pcs, type: 'HARGA_JADI', value: 5000, qty: 1 }],
    }), actor())

    const item = (await listPromos({ branchId: toko })).find((p) => p.id === id)
    expect(item).toMatchObject({
      name: `Pakan hemat ${run}`, kind: 'POTONGAN', note: 'Akhir bulan', status: 'BERJALAN', isActive: true,
      branchIds: [toko], branchNames: [`Toko Promo ${run}`], isMultiple: true, maxPerNote: 3, createdByName: `Owner PM ${run}`,
      conditions: [{ productId: pakan, uomId: pcs, minQty: 2, productName: `Pakan Promo ${run}`, uomCode: `PP${run}` }],
      rewards: [{ productId: pasir, type: 'HARGA_JADI', value: 5000, qty: 1, productName: `Pasir Promo ${run}` }],
    })
    const logs = await db.select().from(auditLogs).where(and(eq(auditLogs.action, 'PROMO_CREATE'), eq(auditLogs.recordId, String(id))))
    expect(logs).toHaveLength(1)
  })

  it('menolak bentuk yang belum didukung, barang tidak aktif, ongkir, satuan asing, cabang tidak dikenal', async () => {
    // HADIAH_PILIHAN (gratis barang pilihan) belum bisa dibuat lewat layar sampai P5. BELI_GRATIS
    // & BUNDLING sudah bisa sejak P4b.
    expect(await errorOf(createPromo(promo({ kind: 'HADIAH_PILIHAN' }), actor()))).toBeInstanceOf(PromoServiceError)
    expect(await errorOf(createPromo(promo({ branchIds: [] }), actor()))).toMatchObject({ message: 'Pilih sekurangnya satu cabang' })
    expect(await errorOf(createPromo(promo({ branchIds: [999_999_999] }), actor()))).toMatchObject({ message: /Cabang promo/ })
    expect(await errorOf(createPromo(promo({ rewards: [{ productId: ongkir, uomId: pcs, type: 'POTONG_PER_PCS', value: 1000, qty: null }] }), actor())))
      .toMatchObject({ message: 'Ongkos kirim tidak bisa dipromo' })
    expect(await errorOf(createPromo(promo({ conditions: [{ productId: pasir, uomId: dus, minQty: 1 }] }), actor())))
      .toMatchObject({ message: /Satuan barang promo/ })
    // Satuan besar yang terdaftar di barangnya boleh.
    await expect(createPromo(promo({ conditions: [{ productId: pakan, uomId: dus, minQty: 1 }] }), actor())).resolves.toHaveProperty('id')
    const nonaktif = (await db.insert(products).values({ name: `Lama ${run}`, baseUomId: pcs, isActive: false }).returning())[0].id
    expect(await errorOf(createPromo(promo({ conditions: [{ productId: nonaktif, uomId: pcs, minQty: 1 }] }), actor())))
      .toMatchObject({ message: /tidak aktif/ })
  })

  it('jual rugi: harga promo di bawah modal ditolak sampai pembuat memilih tetap buat', async () => {
    const rugi = promo({
      name: `Rugi ${run}`, branchIds: [toko, tokoLain],
      rewards: [{ productId: pakan, uomId: pcs, type: 'HARGA_JADI', value: 8000, qty: null }],
    })
    const losses = await findPromoLosses(rugi)
    // Hanya toko dengan modal 9.000; toko lain modal 6.000 masih untung. Harga Grosir tidak dipakai.
    expect(losses).toEqual([{ productName: `Pakan Promo ${run}`, uomCode: `PP${run}`, branchName: `Toko Promo ${run}`, price: 10000, promoPrice: 8000, cost: 9000 }])

    const error = await errorOf(createPromo(rugi, actor()))
    expect(error).toBeInstanceOf(PromoLossError)
    expect((error as PromoLossError).status).toBe(409)
    expect((await listPromos()).some((p) => p.name === `Rugi ${run}`)).toBe(false)

    const { id } = await createPromo(rugi, actor(), { acceptLoss: true })
    const [log] = await db.select().from(auditLogs).where(and(eq(auditLogs.action, 'PROMO_CREATE'), eq(auditLogs.recordId, String(id))))
    expect(JSON.parse(log.newData ?? '{}').acceptedLoss).toHaveLength(1)

    // Potongan kecil yang masih di atas modal: tidak ada peringatan.
    expect(await findPromoLosses(promo({ rewards: [{ productId: pakan, uomId: pcs, type: 'POTONG_PER_PCS', value: 500, qty: null }] }))).toEqual([])
  })

  it('nonaktifkan: status Dinonaktifkan dengan pelakunya; tidak bisa dua kali; promo tak dikenal 404', async () => {
    const { id } = await createPromo(promo({ name: `Dimatikan ${run}` }), actor())
    await deactivatePromo(id, actor())
    const item = (await listPromos()).find((p) => p.id === id)
    expect(item).toMatchObject({ isActive: false, status: 'NONAKTIF', deactivatedByName: `Owner PM ${run}` })
    expect(item?.deactivatedAt).toBeInstanceOf(Date)
    expect(await errorOf(deactivatePromo(id, actor()))).toMatchObject({ status: 409 })
    expect(await errorOf(deactivatePromo(999_999_999, actor()))).toMatchObject({ status: 404 })
  })

  it('daftar per cabang hanya memuat promo cabang itu; keadaan Belum mulai & Berakhir', async () => {
    const lain = await createPromo(promo({ name: `Toko lain ${run}`, branchIds: [tokoLain] }), actor())
    const nanti = await createPromo(promo({ name: `Nanti ${run}`, startsAt: hours(5) }), actor())
    const ids = (await listPromos({ branchId: toko })).map((p) => p.id)
    expect(ids).not.toContain(lain.id)
    expect(ids).toContain(nanti.id)
    expect((await listPromos({ branchId: toko })).find((p) => p.id === nanti.id)?.status).toBe('BELUM_MULAI')
    expect((await listPromos({ branchId: toko, now: new Date(NOW.getTime() + 48 * 3600_000) })).find((p) => p.id === nanti.id)?.status).toBe('BERAKHIR')
  })

  it('saklar darurat: bawaan menyala, bisa dimatikan & dinyalakan, berjejak', async () => {
    await db.delete(appSettings).where(eq(appSettings.key, PROMO_SWITCH_SETTING_KEY))
    expect(await getPromoEnabled()).toBe(true)
    expect(await setPromoEnabled(false, actor())).toBe(false)
    expect(await getPromoEnabled()).toBe(false)
    expect(await setPromoEnabled(true, actor())).toBe(true)
    expect(await getPromoEnabled()).toBe(true)
    const logs = await db.select().from(auditLogs).where(and(eq(auditLogs.action, 'PROMO_SWITCH_UPDATE'), eq(auditLogs.userId, userId)))
    expect(logs).toHaveLength(2)
  })

  it('pilihan barang form: satuan dasar + konversi dengan harga Retail cabang; ongkir tidak ikut', async () => {
    const options = await listPromoItemOptions(toko)
    expect(options.find((o) => o.productId === pakan)?.uoms).toEqual([
      { uomId: pcs, code: `PP${run}`, price: 10000 },
      { uomId: dus, code: `PX${run}`, price: null },
    ])
    expect(options.find((o) => o.productId === pasir)?.uoms).toEqual([{ uomId: pcs, code: `PP${run}`, price: null }])
    expect(options.some((o) => o.productId === ongkir)).toBe(false)
  })
})
