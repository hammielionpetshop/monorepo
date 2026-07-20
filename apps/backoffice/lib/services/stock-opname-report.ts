import { alias } from 'drizzle-orm/pg-core'
import type { AnyColumn } from 'drizzle-orm'
import {
  db,
  stockOpnames,
  stockOpnameItems,
  branches,
  users,
  products,
  unitsOfMeasure,
  eq,
  and,
  inArray,
  sql,
  desc,
} from '@/lib/db'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

/**
 * Hanya SO APPROVED yang benar-benar mengubah stok. Hitungan SO yang DITOLAK tetap
 * data lapangan yang sah — tapi kalau nilainya ikut dijumlah ke ringkasan, angka
 * kerugiannya jadi bohong karena stok tidak pernah berubah. Jadi dipisah:
 * ringkasan uang hanya dari APPROVED, sedangkan daftar produk bermasalah ikut
 * memakai REJECTED (dengan penanda) karena di sana yang dicari pola, bukan rupiah.
 */
const VALUED_STATUS = 'APPROVED'
const COUNTED_STATUSES = ['APPROVED', 'REJECTED']

/**
 * Satu-satunya cara sebuah SO berstatus REJECTED tanpa `rejectedById` adalah lewat
 * penulisan langsung ke DB (mis. script maintenance 2026-07-17 yang menolak 150 SO
 * sekaligus). Kolomnya sengaja dibiarkan NULL — mengisinya dengan ID seseorang akan
 * mencatat bahwa orang itu meninjau SO yang tidak pernah dia lihat.
 */
const SYSTEM_ACTOR_LABEL = 'Sistem (maintenance)'

function decidedByExpr(approverName: AnyColumn, rejecterName: AnyColumn) {
  return sql<string | null>`
    CASE
      WHEN ${approverName} IS NOT NULL THEN ${approverName}
      WHEN ${rejecterName} IS NOT NULL THEN ${rejecterName}
      WHEN ${stockOpnames.status} = 'REJECTED' THEN ${SYSTEM_ACTOR_LABEL}
      ELSE NULL
    END
  `
}

export interface SOReportRow {
  id: number
  soNumber: string
  branchName: string
  type: string
  method: string | null
  status: string
  createdByName: string
  decidedByName: string | null
  createdAt: Date
  itemCount: number
  mismatchCount: number
  accuracyPct: number
  minusValue: number
  plusValue: number
}

export interface SOMismatchProduct {
  productId: number
  productName: string
  sku: string | null
  uomCode: string
  occurrence: number
  rejectedOccurrence: number
  totalVarianceQty: number
  totalVarianceValue: number
  topCategory: string | null
}

export interface SOReportSummary {
  soCount: number
  approvedCount: number
  rejectedCount: number
  openCount: number
  itemCount: number
  mismatchCount: number
  accuracyPct: number
  minusValue: number
  plusValue: number
}

export interface SOReportData {
  summary: SOReportSummary
  rows: SOReportRow[]
  mismatchProducts: SOMismatchProduct[]
}

export interface SODetailItem {
  productId: number
  productName: string
  sku: string | null
  uomCode: string
  systemQty: number
  physicalQty: number
  varianceQty: number
  varianceCostValue: number | null
  varianceCategory: string | null
  varianceReason: string | null
}

export interface SODetailHeader {
  id: number
  soNumber: string
  branchId: number
  branchName: string
  type: string
  method: string | null
  status: string
  createdByName: string
  decidedByName: string | null
  createdAt: Date
  completedAt: Date | null
  notes: string | null
  rejectionNote: string | null
}

export interface SODetailData {
  header: SODetailHeader
  items: SODetailItem[]
}

export interface SOReportFilter {
  startDate: string
  endDate: string
  branchId?: number | null
  status?: string | null
}

function assertValidRange(startDate: string, endDate: string) {
  if (!DATE_REGEX.test(startDate) || !DATE_REGEX.test(endDate)) {
    throw new Error('Format tanggal harus YYYY-MM-DD')
  }
  if (startDate > endDate) {
    throw new Error('Tanggal mulai tidak boleh lebih besar dari tanggal selesai')
  }
}

function buildFilter(params: SOReportFilter) {
  return and(
    sql`(${stockOpnames.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date >= ${params.startDate}::date`,
    sql`(${stockOpnames.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date <= ${params.endDate}::date`,
    params.branchId != null ? eq(stockOpnames.branchId, params.branchId) : undefined,
    params.status ? eq(stockOpnames.status, params.status) : undefined
  )
}

function accuracy(itemCount: number, mismatchCount: number): number {
  if (itemCount === 0) return 0
  return Math.round(((itemCount - mismatchCount) / itemCount) * 1000) / 10
}

async function fetchHeaders(params: SOReportFilter) {
  const approver = alias(users, 'so_approver')
  const rejecter = alias(users, 'so_rejecter')

  return db
    .select({
      id: stockOpnames.id,
      soNumber: stockOpnames.soNumber,
      branchId: stockOpnames.branchId,
      branchName: branches.name,
      type: stockOpnames.type,
      method: stockOpnames.method,
      status: stockOpnames.status,
      createdByName: sql<string>`COALESCE(${users.name}, 'User dihapus')`,
      decidedByName: decidedByExpr(approver.name, rejecter.name),
      createdAt: stockOpnames.createdAt,
    })
    .from(stockOpnames)
    .innerJoin(branches, eq(stockOpnames.branchId, branches.id))
    .leftJoin(users, eq(stockOpnames.createdById, users.id))
    .leftJoin(approver, eq(stockOpnames.approvedById, approver.id))
    .leftJoin(rejecter, eq(stockOpnames.rejectedById, rejecter.id))
    .where(buildFilter(params))
    .orderBy(desc(stockOpnames.createdAt))
}

export type SOExportItem = SODetailItem & {
  soId: number
  soNumber: string
  soStatus: string
  branchName: string
  createdAt: Date
}

/**
 * Item dari SO yang sudah selesai dihitung dalam rentang filter.
 * `onlyMismatch` (default true) hanya membawa item selisih; set false untuk
 * membawa seluruh detail item tiap SO (dipakai export detail per periode).
 */
export async function getStockOpnameItems(
  params: SOReportFilter,
  options: { onlyMismatch?: boolean } = {}
): Promise<SOExportItem[]> {
  const { onlyMismatch = true } = options
  assertValidRange(params.startDate, params.endDate)

  const headers = await fetchHeaders(params)
  const counted = headers.filter((h) => COUNTED_STATUSES.includes(h.status))
  if (counted.length === 0) return []

  const headerById = new Map(counted.map((h) => [h.id, h]))
  const conditions = [inArray(stockOpnameItems.soId, [...headerById.keys()])]
  if (onlyMismatch) conditions.push(sql`${stockOpnameItems.varianceQty} <> 0`)

  const rows = await db
    .select({
      soId: stockOpnameItems.soId,
      productId: stockOpnameItems.productId,
      productName: sql<string>`COALESCE(${products.name}, '(produk terhapus id ' || ${stockOpnameItems.productId} || ')')`,
      sku: products.sku,
      uomCode: sql<string>`COALESCE(${unitsOfMeasure.code}, '-')`,
      systemQty: stockOpnameItems.systemQty,
      physicalQty: stockOpnameItems.physicalQty,
      varianceQty: stockOpnameItems.varianceQty,
      varianceCostValue: stockOpnameItems.varianceCostValue,
      varianceCategory: stockOpnameItems.varianceCategory,
      varianceReason: stockOpnameItems.varianceReason,
    })
    .from(stockOpnameItems)
    .leftJoin(products, eq(stockOpnameItems.productId, products.id))
    .leftJoin(unitsOfMeasure, eq(stockOpnameItems.uomId, unitsOfMeasure.id))
    .where(and(...conditions))
    .orderBy(stockOpnameItems.soId, products.name)

  return rows.map((row) => {
    const header = headerById.get(row.soId)!
    return {
      ...row,
      soNumber: header.soNumber,
      soStatus: header.status,
      branchName: header.branchName,
      createdAt: header.createdAt,
    }
  })
}

/** Item selisih (varianceQty ≠ 0) dari SO yang sudah selesai dihitung dalam rentang filter. */
export function getStockOpnameMismatchItems(params: SOReportFilter): Promise<SOExportItem[]> {
  return getStockOpnameItems(params, { onlyMismatch: true })
}

export async function getStockOpnameReport(params: SOReportFilter): Promise<SOReportData> {
  assertValidRange(params.startDate, params.endDate)

  const headers = await fetchHeaders(params)

  const emptySummary: SOReportSummary = {
    soCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    openCount: 0,
    itemCount: 0,
    mismatchCount: 0,
    accuracyPct: 0,
    minusValue: 0,
    plusValue: 0,
  }

  if (headers.length === 0) {
    return { summary: emptySummary, rows: [], mismatchProducts: [] }
  }

  const soIds = headers.map((h) => h.id)
  const aggregates = await db
    .select({
      soId: stockOpnameItems.soId,
      itemCount: sql<number>`count(*)::int`,
      mismatchCount: sql<number>`(count(*) filter (where ${stockOpnameItems.varianceQty} <> 0))::int`,
      minusValue: sql<number>`(coalesce(sum(${stockOpnameItems.varianceCostValue}) filter (where ${stockOpnameItems.varianceQty} < 0), 0))::int`,
      plusValue: sql<number>`(coalesce(sum(${stockOpnameItems.varianceCostValue}) filter (where ${stockOpnameItems.varianceQty} > 0), 0))::int`,
    })
    .from(stockOpnameItems)
    .where(inArray(stockOpnameItems.soId, soIds))
    .groupBy(stockOpnameItems.soId)

  const aggById = new Map(aggregates.map((a) => [a.soId, a]))

  const rows: SOReportRow[] = headers.map((header) => {
    const agg = aggById.get(header.id)
    const itemCount = agg?.itemCount ?? 0
    const mismatchCount = agg?.mismatchCount ?? 0
    return {
      id: header.id,
      soNumber: header.soNumber,
      branchName: header.branchName,
      type: header.type,
      method: header.method,
      status: header.status,
      createdByName: header.createdByName,
      decidedByName: header.decidedByName,
      createdAt: header.createdAt,
      itemCount,
      mismatchCount,
      accuracyPct: accuracy(itemCount, mismatchCount),
      minusValue: agg?.minusValue ?? 0,
      plusValue: agg?.plusValue ?? 0,
    }
  })

  const summary = rows.reduce<SOReportSummary>((acc, row) => {
    acc.soCount += 1
    if (row.status === 'REJECTED') acc.rejectedCount += 1
    else if (row.status === VALUED_STATUS) acc.approvedCount += 1
    else acc.openCount += 1

    if (row.status === VALUED_STATUS) {
      acc.itemCount += row.itemCount
      acc.mismatchCount += row.mismatchCount
      acc.minusValue += row.minusValue
      acc.plusValue += row.plusValue
    }
    return acc
  }, { ...emptySummary })
  summary.accuracyPct = accuracy(summary.itemCount, summary.mismatchCount)

  const mismatchItems = await getStockOpnameMismatchItems(params)
  const productMap = new Map<number, SOMismatchProduct & { categoryTally: Map<string, number> }>()
  for (const item of mismatchItems) {
    let entry = productMap.get(item.productId)
    if (!entry) {
      entry = {
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        uomCode: item.uomCode,
        occurrence: 0,
        rejectedOccurrence: 0,
        totalVarianceQty: 0,
        totalVarianceValue: 0,
        topCategory: null,
        categoryTally: new Map(),
      }
      productMap.set(item.productId, entry)
    }
    entry.occurrence += 1
    if (item.soStatus === 'REJECTED') entry.rejectedOccurrence += 1
    entry.totalVarianceQty += item.varianceQty
    if (item.soStatus === VALUED_STATUS) {
      entry.totalVarianceValue += item.varianceCostValue ?? 0
    }
    if (item.varianceCategory) {
      entry.categoryTally.set(item.varianceCategory, (entry.categoryTally.get(item.varianceCategory) ?? 0) + 1)
    }
  }

  const mismatchProducts: SOMismatchProduct[] = [...productMap.values()]
    .map(({ categoryTally, ...rest }) => {
      const top = [...categoryTally.entries()].sort((a, b) => b[1] - a[1])[0]
      return { ...rest, topCategory: top?.[0] ?? null }
    })
    .sort((a, b) => b.occurrence - a.occurrence || b.totalVarianceValue - a.totalVarianceValue)

  return { summary, rows, mismatchProducts }
}

export async function getStockOpnameDetail(soId: number): Promise<SODetailData | null> {
  const approver = alias(users, 'so_detail_approver')
  const rejecter = alias(users, 'so_detail_rejecter')

  const headerRows = await db
    .select({
      id: stockOpnames.id,
      soNumber: stockOpnames.soNumber,
      branchId: stockOpnames.branchId,
      branchName: branches.name,
      type: stockOpnames.type,
      method: stockOpnames.method,
      status: stockOpnames.status,
      createdByName: sql<string>`COALESCE(${users.name}, 'User dihapus')`,
      decidedByName: decidedByExpr(approver.name, rejecter.name),
      createdAt: stockOpnames.createdAt,
      completedAt: stockOpnames.completedAt,
      notes: stockOpnames.notes,
      rejectionNote: stockOpnames.rejectionNote,
    })
    .from(stockOpnames)
    .innerJoin(branches, eq(stockOpnames.branchId, branches.id))
    .leftJoin(users, eq(stockOpnames.createdById, users.id))
    .leftJoin(approver, eq(stockOpnames.approvedById, approver.id))
    .leftJoin(rejecter, eq(stockOpnames.rejectedById, rejecter.id))
    .where(eq(stockOpnames.id, soId))
    .limit(1)

  const header = headerRows[0]
  if (!header) return null

  const items = await db
    .select({
      productId: stockOpnameItems.productId,
      productName: sql<string>`COALESCE(${products.name}, '(produk terhapus id ' || ${stockOpnameItems.productId} || ')')`,
      sku: products.sku,
      uomCode: sql<string>`COALESCE(${unitsOfMeasure.code}, '-')`,
      systemQty: stockOpnameItems.systemQty,
      physicalQty: stockOpnameItems.physicalQty,
      varianceQty: stockOpnameItems.varianceQty,
      varianceCostValue: stockOpnameItems.varianceCostValue,
      varianceCategory: stockOpnameItems.varianceCategory,
      varianceReason: stockOpnameItems.varianceReason,
    })
    .from(stockOpnameItems)
    .leftJoin(products, eq(stockOpnameItems.productId, products.id))
    .leftJoin(unitsOfMeasure, eq(stockOpnameItems.uomId, unitsOfMeasure.id))
    .where(eq(stockOpnameItems.soId, soId))
    .orderBy(products.name)

  return { header, items }
}
