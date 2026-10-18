import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  db, branches, unitsOfMeasure, products, productPrices, productUomCosts, roles, users, shifts, paymentMethods,
  promoBranchUsage, transactions, appSettings, and, eq,
} from '../db'
import { StockService } from './stock-service'
import { TransactionService } from './transaction-service'
import { PromoSaleError } from './promo-sale-service'
import { performVoid } from './void-service'
import { createPromo, setPromoEnabled, PROMO_SWITCH_SETTING_KEY } from './promo-service'

// Kuota per cabang & syarat stok — server sebagai hakim (P3c). Saat nota disimpan server membaca
// sisa jatah sambil mengunci promo_branch_usage, menolak kiriman layar yang berbeda, lalu menambah
// pemakaian di transaksi yang sama. Batal nota mengembalikan jatah; retur tidak (owner 2026-10-18).
// Tiap promo memakai PRODUK sendiri supaya promo antar-tes tidak berebut barang yang sama
// (satu barang satu promo → engine memilih salah satu, bukan yang kita kirim).
const run = randomUUID().slice(0, 8)
let toko: number
let userId: number
let pcs: number
let cashMethodId: number
let shiftId: number
let seq = 0
let switchBefore: string | undefined

const NOW = new Date()
const hours = (h: number) => new Date(NOW.getTime() + h * 3600_000).toISOString()
const actor = () => ({ userId, branchId: toko })

type Line = { productId: number; qty: number; unitPrice: number; promo?: { promoId: number; amount: number } }

const sale = (lines: Line[]) => {
  const items = lines.map((l) => {
    const discountAmount = l.promo?.amount ?? 0
    return {
      productId: l.productId, uomId: pcs, qty: l.qty, unitPrice: l.unitPrice, priceTier: 'RETAIL',
      discountAmount, subtotal: l.qty * l.unitPrice - discountAmount,
      ...(l.promo ? { promo: l.promo } : {}),
    }
  })
  const sum = items.reduce((s, i) => s + i.subtotal, 0)
  return TransactionService.createTransaction({
    branchId: toko, cashierId: userId, shiftId, localTrxNumber: `KU-${randomUUID()}`,
    items, payments: [{ paymentMethodId: cashMethodId, amount: sum }],
    totals: { subtotal: sum, discountTotal: 0, grandTotal: sum }, amountPaid: sum, change: 0,
  } as never) as Promise<{ id: number; trxNumber: string }>
}

const errorOf = async (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e)

const usageOf = async (promoId: number) => {
  const [row] = await db
    .select({ usedPcs: promoBranchUsage.usedPcs, usedNotes: promoBranchUsage.usedNotes })
    .from(promoBranchUsage)
    .where(and(eq(promoBranchUsage.promoId, promoId), eq(promoBranchUsage.branchId, toko)))
  return row ?? { usedPcs: 0, usedNotes: 0 }
}

/** Produk baru (harga Retail 25.000, modal 1.000) dengan stok awal opsional. */
const newProduct = async (stock = 0) => {
  seq += 1
  const id = (await db.insert(products).values({ name: `Brg ${run}-${seq}`, baseUomId: pcs, defaultCostPrice: 1000 }).returning())[0].id
  await db.insert(productPrices).values({ productId: id, branchId: toko, uomId: pcs, tierType: 'RETAIL', price: 25000 })
  await db.insert(productUomCosts).values({ productId: id, branchId: toko, uomId: pcs, costPrice: 1000 })
  if (stock > 0) await db.transaction((tx) => StockService.addStock(tx, toko, id, pcs, String(stock), '1000'))
  return id
}

/** Promo POTONGAN Rp 1.000/pcs atas satu produk; `extra` menambah kuota / syarat stok. */
const makePromo = (product: number, extra: Record<string, unknown> = {}) =>
  createPromo({
    name: `Kuota ${run} ${randomUUID().slice(0, 4)}`, kind: 'POTONGAN', note: null, branchIds: [toko],
    startsAt: hours(-1), endsAt: hours(24), dailyStartMinute: null, dailyEndMinute: null, isMultiple: false, maxPerNote: null,
    conditions: [{ productId: product, uomId: pcs, minQty: 1 }],
    rewards: [{ productId: product, uomId: pcs, type: 'POTONG_PER_PCS', value: 1000, qty: null }],
    ...extra,
  }, actor()).then((p) => p.id)

beforeAll(async () => {
  toko = (await db.insert(branches).values({ code: `KU${run}`, name: `Toko Kuota ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `KU${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `Kasir KU ${run}`, roleId, branchId: toko }).returning())[0].id
  pcs = (await db.insert(unitsOfMeasure).values({ code: `KU${run}`, name: 'Pcs tes', isBase: true }).returning())[0].id
  cashMethodId = (await db.insert(paymentMethods).values({ name: `Tunai KU ${run}`, type: 'CASH' }).returning())[0].id
  shiftId = (await db.insert(shifts).values({ branchId: toko, openedById: userId, shiftNumber: 1, assignedCashiers: [userId], openingCash: 0 }).returning())[0].id
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, PROMO_SWITCH_SETTING_KEY))
  switchBefore = row?.value
  await setPromoEnabled(true, actor())
})

afterAll(async () => {
  if (switchBefore === undefined) await db.delete(appSettings).where(eq(appSettings.key, PROMO_SWITCH_SETTING_KEY))
  else await db.update(appSettings).set({ value: switchBefore }).where(eq(appSettings.key, PROMO_SWITCH_SETTING_KEY))
})

describe('Kuota per cabang & syarat stok (DB lokal)', () => {
  it('kuota pcs: pemakaian bertambah sebanyak pcs yang kena promo', async () => {
    const brg = await newProduct(1000)
    const promoId = await makePromo(brg, { quotaKind: 'PCS', quotaPerBranch: 10 })
    await sale([{ productId: brg, qty: 3, unitPrice: 25000, promo: { promoId, amount: 3000 } }])
    expect(await usageOf(promoId)).toMatchObject({ usedPcs: 3, usedNotes: 0 })
    await sale([{ productId: brg, qty: 2, unitPrice: 25000, promo: { promoId, amount: 2000 } }])
    expect(await usageOf(promoId)).toMatchObject({ usedPcs: 5 })
  })

  it('jatah mepet dipotong sebagian; jatah habis → promo berhenti', async () => {
    const brg = await newProduct(1000)
    const promoId = await makePromo(brg, { quotaKind: 'PCS', quotaPerBranch: 2 })
    // Sisa 2, beli 5 → 2 pcs kena promo (Rp 2.000), 3 sisanya normal.
    await sale([{ productId: brg, qty: 5, unitPrice: 25000, promo: { promoId, amount: 2000 } }])
    expect(await usageOf(promoId)).toMatchObject({ usedPcs: 2 })
    // Jatah habis: kirim promo lagi → ditolak; nota tanpa promo tetap jalan.
    const err = await errorOf(sale([{ productId: brg, qty: 1, unitPrice: 25000, promo: { promoId, amount: 1000 } }]))
    expect(err).toMatchObject({ code: 'PROMO_CHANGED', status: 409 })
    await sale([{ productId: brg, qty: 1, unitPrice: 25000 }])
    expect(await usageOf(promoId)).toMatchObject({ usedPcs: 2 })
  })

  it('kuota nota: satu nota satu jatah; jatah habis → promo tidak berlaku', async () => {
    const brg = await newProduct(1000)
    const promoId = await makePromo(brg, { quotaKind: 'NOTA', quotaPerBranch: 1 })
    await sale([{ productId: brg, qty: 2, unitPrice: 25000, promo: { promoId, amount: 2000 } }])
    expect(await usageOf(promoId)).toMatchObject({ usedNotes: 1, usedPcs: 0 })
    const err = await errorOf(sale([{ productId: brg, qty: 2, unitPrice: 25000, promo: { promoId, amount: 2000 } }]))
    expect(err).toMatchObject({ code: 'PROMO_CHANGED' })
    await sale([{ productId: brg, qty: 2, unitPrice: 25000 }])
    expect(await usageOf(promoId)).toMatchObject({ usedNotes: 1 })
  })

  it('batal nota mengembalikan jatah (pcs & nota)', async () => {
    const brgPcs = await newProduct(1000)
    const promoId = await makePromo(brgPcs, { quotaKind: 'PCS', quotaPerBranch: 10 })
    const trx = await sale([{ productId: brgPcs, qty: 4, unitPrice: 25000, promo: { promoId, amount: 4000 } }])
    expect(await usageOf(promoId)).toMatchObject({ usedPcs: 4 })
    await performVoid({ txId: trx.id, branchId: toko, trxNumber: trx.trxNumber, actorUserId: userId })
    expect(await usageOf(promoId)).toMatchObject({ usedPcs: 0 })

    const brgNota = await newProduct(1000)
    const nota = await makePromo(brgNota, { quotaKind: 'NOTA', quotaPerBranch: 1 })
    const t2 = await sale([{ productId: brgNota, qty: 2, unitPrice: 25000, promo: { promoId: nota, amount: 2000 } }])
    expect(await usageOf(nota)).toMatchObject({ usedNotes: 1 })
    await performVoid({ txId: t2.id, branchId: toko, trxNumber: t2.trxNumber, actorUserId: userId })
    expect(await usageOf(nota)).toMatchObject({ usedNotes: 0 })
  })

  it('rebutan dua kasir: jatah tidak jebol — satu lolos, satu ditolak', async () => {
    const brg = await newProduct(1000)
    const promoId = await makePromo(brg, { quotaKind: 'PCS', quotaPerBranch: 3 })
    const line = { productId: brg, qty: 2, unitPrice: 25000, promo: { promoId, amount: 2000 } }
    const [a, b] = await Promise.allSettled([sale([line]), sale([line])])
    const statuses = [a.status, b.status].sort()
    expect(statuses).toEqual(['fulfilled', 'rejected'])
    const rejected = (a.status === 'rejected' ? a.reason : (b as PromiseRejectedResult).reason) as unknown
    expect(rejected).toBeInstanceOf(PromoSaleError)
    expect(rejected).toMatchObject({ code: 'PROMO_CHANGED' })
    // Hanya nota yang lolos yang terpakai; sisa jatah tidak pernah minus.
    expect((await usageOf(promoId)).usedPcs).toBe(2)
  })

  it('syarat stok: stok 0 → promo berhenti; ada stok → promo jalan', async () => {
    const brg = await newProduct(0) // belum ada stok
    const promoId = await makePromo(brg, { requireStock: true })
    const err = await errorOf(sale([{ productId: brg, qty: 1, unitPrice: 25000, promo: { promoId, amount: 1000 } }]))
    expect(err).toMatchObject({ code: 'PROMO_CHANGED' })
    await sale([{ productId: brg, qty: 1, unitPrice: 25000 }])
    // Isi stok → promo kembali berlaku.
    await db.transaction((tx) => StockService.addStock(tx, toko, brg, pcs, '10', '1000'))
    const trx = await sale([{ productId: brg, qty: 1, unitPrice: 25000, promo: { promoId, amount: 1000 } }])
    const [header] = await db.select().from(transactions).where(eq(transactions.id, trx.id))
    expect(header.payableAmount).toBe(24000)
  })
})
