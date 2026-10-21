import { alias } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import {
  db, transactions, transactionItems, transactionItemDiscounts, branches, users, customers, unitsOfMeasure,
  eq, and, gt, gte, lt, desc, sql,
} from '../db'
import type { DiscountHistoryRow } from '../discount-history'
import { noteHeaderDiscount } from '../line-net-value'
import { DISCOUNT_KIND_PROMO, manualDiscountReasonLabel } from '../manual-discount'
import { freeShippingOfItemSql } from '../ongkir-server'

// Laporan Riwayat Diskon (P1f) — hanya membaca nota yang sudah ada, tidak menulis apa pun.
// Pengelompokan & tulisannya di `lib/discount-history.ts`. Yang dihitung hanya nota yang masih
// berlaku (bukan nota batal) dan baris yang tidak dikeluarkan lewat Koreksi; gratis ongkir
// bukan diskon (urusan mesin ongkir). Lihat docs/work/specs/2026-10-12-promo-otomatis-design.md.

export interface DiscountHistoryParams {
  /** Batas cabang dari hak akses pengguna (`scopeFilter(payload, transactions.branchId)`). */
  branchScope?: SQL
  branchId?: number
  from: Date
  to: Date
}

const UNRECORDED_BULK = 'Potongan Penjualan Grosir'
const UNRECORDED_RETAIL = 'Potongan per barang (tanpa alasan)'
const NOTE_BULK = 'Diskon transaksi Penjualan Grosir'
const NOTE_RETAIL = 'Diskon nota (cara lama)'
const NOTE_PRODUCT = 'Diskon nota (tidak per barang)'

const iso = (value: Date | string) => new Date(value).toISOString()

export async function listDiscountHistory(params: DiscountHistoryParams): Promise<DiscountHistoryRow[]> {
  const cashier = alias(users, 'cashier')
  const recorder = alias(users, 'recorder')
  const noteFilter = and(
    eq(transactions.status, 'COMPLETED'),
    gte(transactions.createdAt, params.from),
    lt(transactions.createdAt, params.to),
    params.branchScope,
    params.branchId ? eq(transactions.branchId, params.branchId) : undefined,
  )
  const note = {
    transactionId: transactions.id,
    trxNumber: transactions.trxNumber,
    createdAt: transactions.createdAt,
    branchId: transactions.branchId,
    branchName: branches.name,
    cashierName: cashier.name,
    saleType: transactions.saleType,
    customerName: customers.name,
  }
  const line = {
    itemId: transactionItems.id,
    productId: transactionItems.productId,
    productName: transactionItems.productName,
    productSku: transactionItems.productSku,
    uomCode: unitsOfMeasure.code,
    qty: transactionItems.qty,
    unitPrice: transactionItems.unitPrice,
  }

  const [recorded, unrecorded, noteLevel] = await Promise.all([
    // 1. Potongan yang tercatat: diskon kasir (beralasan) dan promo.
    db
      .select({
        ...note, ...line,
        discountId: transactionItemDiscounts.id,
        kind: transactionItemDiscounts.kind,
        amount: transactionItemDiscounts.amount,
        reasonCode: transactionItemDiscounts.reasonCode,
        reasonNote: transactionItemDiscounts.reasonNote,
        percent: transactionItemDiscounts.percent,
        promotionName: transactionItemDiscounts.promotionName,
        recorderName: recorder.name,
      })
      .from(transactionItemDiscounts)
      .innerJoin(transactionItems, eq(transactionItems.id, transactionItemDiscounts.transactionItemId))
      .innerJoin(transactions, eq(transactions.id, transactionItemDiscounts.transactionId))
      .innerJoin(branches, eq(branches.id, transactions.branchId))
      .innerJoin(cashier, eq(cashier.id, transactions.cashierId))
      .innerJoin(unitsOfMeasure, eq(unitsOfMeasure.id, transactionItems.uomId))
      .leftJoin(recorder, eq(recorder.id, transactionItemDiscounts.createdById))
      .leftJoin(customers, eq(customers.id, transactions.customerId))
      .where(and(noteFilter, eq(transactionItems.isRemoved, false)))
      .orderBy(desc(transactions.createdAt), transactionItemDiscounts.id),
    // 2. Potongan baris tanpa catatan: Penjualan Grosir, dan nota kasir sebelum ada catatan potongan.
    db
      .select({ ...note, ...line, amount: transactionItems.discountAmount })
      .from(transactionItems)
      .innerJoin(transactions, eq(transactions.id, transactionItems.transactionId))
      .innerJoin(branches, eq(branches.id, transactions.branchId))
      .innerJoin(cashier, eq(cashier.id, transactions.cashierId))
      .innerJoin(unitsOfMeasure, eq(unitsOfMeasure.id, transactionItems.uomId))
      .leftJoin(customers, eq(customers.id, transactions.customerId))
      .where(and(
        noteFilter,
        eq(transactionItems.isRemoved, false),
        gt(transactionItems.discountAmount, 0),
        sql`NOT EXISTS (SELECT 1 FROM petshop.transaction_item_discounts d WHERE d.transaction_item_id = ${transactionItems.id})`,
        sql`NOT ${freeShippingOfItemSql(transactionItems.id)}`,
      ))
      .orderBy(desc(transactions.createdAt), transactionItems.id),
    // 3. Nota yang kepalanya berdiskon — dipisahkan dari potongan barisnya oleh mesin nilai bersih.
    db
      .select({
        ...note,
        totalAmount: transactions.totalAmount,
        discountAmount: transactions.discountAmount,
        lineDiscount: sql<number>`COALESCE((
          SELECT SUM(GREATEST(ti.discount_amount, 0)) FROM petshop.transaction_items ti WHERE ti.transaction_id = ${transactions.id}
        ), 0)::integer`,
        linesTotal: sql<number>`COALESCE((
          SELECT SUM(ti.total_price) FROM petshop.transaction_items ti WHERE ti.transaction_id = ${transactions.id}
        ), 0)::integer`,
      })
      .from(transactions)
      .innerJoin(branches, eq(branches.id, transactions.branchId))
      .innerJoin(cashier, eq(cashier.id, transactions.cashierId))
      .leftJoin(customers, eq(customers.id, transactions.customerId))
      .where(and(noteFilter, gt(transactions.discountAmount, 0)))
      .orderBy(desc(transactions.createdAt)),
  ])

  const noteOf = (r: (typeof noteLevel)[number] | (typeof unrecorded)[number]) => ({
    transactionId: r.transactionId,
    trxNumber: r.trxNumber,
    createdAt: iso(r.createdAt),
    branchId: r.branchId,
    branchName: r.branchName,
    saleType: r.saleType,
    customerName: r.customerName ?? null,
  })
  const lineOf = (r: (typeof unrecorded)[number]) => ({
    productId: r.productId,
    productName: r.productName ?? '(produk tanpa nama)',
    productSku: r.productSku,
    uomCode: r.uomCode,
    qty: r.qty,
    unitPrice: r.unitPrice,
  })

  const rows: DiscountHistoryRow[] = []
  for (const r of recorded) {
    const promo = r.kind === DISCOUNT_KIND_PROMO
    rows.push({
      ...noteOf(r), ...lineOf(r),
      key: `d${r.discountId}`,
      source: promo ? 'PROMO' : 'MANUAL',
      byName: r.recorderName ?? r.cashierName,
      amount: r.amount,
      reason: promo
        ? r.promotionName?.trim() || 'Promo'
        : manualDiscountReasonLabel(r.reasonCode, r.reasonNote) + (r.percent != null ? ` (${r.percent}%)` : ''),
    })
  }
  for (const r of unrecorded) {
    rows.push({
      ...noteOf(r), ...lineOf(r),
      key: `i${r.itemId}`,
      source: 'GROSIR',
      byName: r.cashierName,
      amount: r.amount,
      reason: r.saleType === 'BULK' ? UNRECORDED_BULK : UNRECORDED_RETAIL,
    })
  }
  for (const r of noteLevel) {
    const { headerOnly } = noteHeaderDiscount(
      { totalAmount: r.totalAmount, discountAmount: r.discountAmount },
      [{ totalPrice: Number(r.linesTotal), discountAmount: Number(r.lineDiscount) }],
    )
    if (headerOnly <= 0) continue
    rows.push({
      ...noteOf(r),
      key: `n${r.transactionId}`,
      source: 'NOTA',
      byName: r.cashierName,
      productId: null,
      productName: NOTE_PRODUCT,
      productSku: null,
      uomCode: null,
      qty: 0,
      unitPrice: 0,
      amount: headerOnly,
      reason: r.saleType === 'BULK' ? NOTE_BULK : NOTE_RETAIL,
    })
  }
  return rows
}
