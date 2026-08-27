import {
  and,
  branches,
  db,
  desc,
  eq,
  ilike,
  isNull,
  or,
  products,
  sql,
  soResolutionEmployeeCharges,
  soVarianceResolutions,
  stockOpnameItems,
  stockOpnames,
  unitsOfMeasure,
} from '@/lib/db'
import { assertValidRange, type SOReportFilter } from './stock-opname-report'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export interface ResolutionQueueFilter {
  branchId?: number | null
  startDate?: string | null
  endDate?: string | null
  search?: string | null
}

export interface SOResolutionQueueItem {
  itemId: number
  soId: number
  soNumber: string
  branchId: number
  branchName: string
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
  decidedAt: Date | null
}

/**
 * Antrean item selisih SO Besar yang sudah APPROVED tapi belum diresolusi lebih lanjut
 * (belum ada baris `so_variance_resolutions` aktif). `branchId` null berarti semua
 * cabang (OWNER/GM); dipakai bersama oleh halaman resolusi dan route API-nya supaya
 * query-nya tidak dobel ditulis.
 *
 * `startDate`/`endDate` menyaring berdasarkan `decidedAt` (kapan item diputuskan saat
 * approval SO) — bukan tanggal resolusi, karena baris ini justru BELUM punya resolusi.
 * `search` mencari lintas nama produk, SKU, dan nomor SO sekaligus (ilike, case-insensitive).
 */
export async function getResolutionQueue(params: ResolutionQueueFilter): Promise<SOResolutionQueueItem[]> {
  if (params.startDate && !DATE_REGEX.test(params.startDate)) {
    throw new Error('Format tanggal mulai harus YYYY-MM-DD')
  }
  if (params.endDate && !DATE_REGEX.test(params.endDate)) {
    throw new Error('Format tanggal selesai harus YYYY-MM-DD')
  }
  if (params.startDate && params.endDate && params.startDate > params.endDate) {
    throw new Error('Tanggal mulai tidak boleh lebih besar dari tanggal selesai')
  }

  const search = params.search?.trim()

  return db
    .select({
      itemId: stockOpnameItems.id,
      soId: stockOpnames.id,
      soNumber: stockOpnames.soNumber,
      branchId: stockOpnames.branchId,
      branchName: branches.name,
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
      decidedAt: stockOpnameItems.decidedAt,
    })
    .from(stockOpnameItems)
    .innerJoin(stockOpnames, eq(stockOpnameItems.soId, stockOpnames.id))
    .innerJoin(branches, eq(stockOpnames.branchId, branches.id))
    .leftJoin(products, eq(stockOpnameItems.productId, products.id))
    .leftJoin(unitsOfMeasure, eq(stockOpnameItems.uomId, unitsOfMeasure.id))
    .leftJoin(
      soVarianceResolutions,
      and(eq(soVarianceResolutions.soItemId, stockOpnameItems.id), isNull(soVarianceResolutions.voidedAt))
    )
    .where(
      and(
        eq(stockOpnames.type, 'FULL'),
        eq(stockOpnames.status, 'APPROVED'),
        eq(stockOpnameItems.itemStatus, 'APPROVED'),
        sql`${stockOpnameItems.varianceQty} <> 0`,
        isNull(soVarianceResolutions.id),
        params.branchId != null ? eq(stockOpnames.branchId, params.branchId) : undefined,
        params.startDate
          ? sql`(${stockOpnameItems.decidedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date >= ${params.startDate}::date`
          : undefined,
        params.endDate
          ? sql`(${stockOpnameItems.decidedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date <= ${params.endDate}::date`
          : undefined,
        search
          ? or(
              ilike(products.name, `%${search}%`),
              ilike(products.sku, `%${search}%`),
              ilike(stockOpnames.soNumber, `%${search}%`)
            )
          : undefined
      )
    )
    .orderBy(desc(stockOpnameItems.decidedAt))
}

export interface SOResolutionSummary {
  foundValue: number
  writtenOffValue: number
  // Porsi yang benar-benar ditagih ke karyawan vs porsi sisa yang otomatis jadi
  // kerugian toko (nominal EMPLOYEE_CHARGE boleh sebagian, lihat items/[itemId]/resolution).
  employeeChargeTotal: number
  employeeChargeStorePortion: number
  overageExplainedValue: number
  unresolvedShortageValue: number
  unresolvedOverageValue: number
  caseCounts: {
    found: number
    writtenOff: number
    employeeCharge: number
    overageExplained: number
    unresolvedShortage: number
    unresolvedOverage: number
  }
}

export interface SOEmployeeChargeBreakdownRow {
  employeeName: string
  employeeId: number | null
  caseCount: number
  totalCharged: number
}

function resolutionDateFilter(params: SOReportFilter) {
  return and(
    sql`(${soVarianceResolutions.resolvedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date >= ${params.startDate}::date`,
    sql`(${soVarianceResolutions.resolvedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date <= ${params.endDate}::date`,
    params.branchId != null ? eq(soVarianceResolutions.branchId, params.branchId) : undefined,
    isNull(soVarianceResolutions.voidedAt)
  )
}

export async function getResolutionSummary(params: SOReportFilter): Promise<SOResolutionSummary> {
  assertValidRange(params.startDate, params.endDate)

  const [resolvedAgg] = await db
    .select({
      foundValue: sql<number>`(coalesce(sum(${soVarianceResolutions.varianceCostValue}) filter (where ${soVarianceResolutions.disposition} = 'FOUND'), 0))::int`,
      foundCount: sql<number>`(count(*) filter (where ${soVarianceResolutions.disposition} = 'FOUND'))::int`,
      writtenOffValue: sql<number>`(coalesce(sum(${soVarianceResolutions.varianceCostValue}) filter (where ${soVarianceResolutions.disposition} = 'WRITTEN_OFF'), 0))::int`,
      writtenOffCount: sql<number>`(count(*) filter (where ${soVarianceResolutions.disposition} = 'WRITTEN_OFF'))::int`,
      employeeChargeTotal: sql<number>`(coalesce(sum(${soVarianceResolutions.employeeChargedTotal}) filter (where ${soVarianceResolutions.disposition} = 'EMPLOYEE_CHARGE'), 0))::int`,
      employeeChargeStorePortion: sql<number>`(coalesce(sum(${soVarianceResolutions.varianceCostValue} - ${soVarianceResolutions.employeeChargedTotal}) filter (where ${soVarianceResolutions.disposition} = 'EMPLOYEE_CHARGE'), 0))::int`,
      employeeChargeCount: sql<number>`(count(*) filter (where ${soVarianceResolutions.disposition} = 'EMPLOYEE_CHARGE'))::int`,
      overageExplainedValue: sql<number>`(coalesce(sum(${soVarianceResolutions.varianceCostValue}) filter (where ${soVarianceResolutions.disposition} = 'OVERAGE_EXPLAINED'), 0))::int`,
      overageExplainedCount: sql<number>`(count(*) filter (where ${soVarianceResolutions.disposition} = 'OVERAGE_EXPLAINED'))::int`,
    })
    .from(soVarianceResolutions)
    .where(resolutionDateFilter(params))

  // Belum diresolusi: item APPROVED dari SO Besar APPROVED, tanpa resolusi aktif.
  // Dasarnya tanggal item DIPUTUSKAN (decidedAt), bukan resolvedAt — karena memang
  // belum ada resolusi sama sekali untuk baris-baris ini.
  const [unresolvedAgg] = await db
    .select({
      unresolvedShortageValue: sql<number>`(coalesce(sum(${stockOpnameItems.varianceCostValue}) filter (where ${stockOpnameItems.varianceQty} < 0), 0))::int`,
      unresolvedShortageCount: sql<number>`(count(*) filter (where ${stockOpnameItems.varianceQty} < 0))::int`,
      unresolvedOverageValue: sql<number>`(coalesce(sum(${stockOpnameItems.varianceCostValue}) filter (where ${stockOpnameItems.varianceQty} > 0), 0))::int`,
      unresolvedOverageCount: sql<number>`(count(*) filter (where ${stockOpnameItems.varianceQty} > 0))::int`,
    })
    .from(stockOpnameItems)
    .innerJoin(stockOpnames, eq(stockOpnameItems.soId, stockOpnames.id))
    .leftJoin(
      soVarianceResolutions,
      and(eq(soVarianceResolutions.soItemId, stockOpnameItems.id), isNull(soVarianceResolutions.voidedAt))
    )
    .where(
      and(
        eq(stockOpnames.type, 'FULL'),
        eq(stockOpnames.status, 'APPROVED'),
        eq(stockOpnameItems.itemStatus, 'APPROVED'),
        sql`${stockOpnameItems.varianceQty} <> 0`,
        isNull(soVarianceResolutions.id),
        sql`(${stockOpnameItems.decidedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date >= ${params.startDate}::date`,
        sql`(${stockOpnameItems.decidedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date <= ${params.endDate}::date`,
        params.branchId != null ? eq(stockOpnames.branchId, params.branchId) : undefined
      )
    )

  return {
    foundValue: resolvedAgg?.foundValue ?? 0,
    writtenOffValue: resolvedAgg?.writtenOffValue ?? 0,
    employeeChargeTotal: resolvedAgg?.employeeChargeTotal ?? 0,
    employeeChargeStorePortion: resolvedAgg?.employeeChargeStorePortion ?? 0,
    overageExplainedValue: resolvedAgg?.overageExplainedValue ?? 0,
    unresolvedShortageValue: unresolvedAgg?.unresolvedShortageValue ?? 0,
    unresolvedOverageValue: unresolvedAgg?.unresolvedOverageValue ?? 0,
    caseCounts: {
      found: resolvedAgg?.foundCount ?? 0,
      writtenOff: resolvedAgg?.writtenOffCount ?? 0,
      employeeCharge: resolvedAgg?.employeeChargeCount ?? 0,
      overageExplained: resolvedAgg?.overageExplainedCount ?? 0,
      unresolvedShortage: unresolvedAgg?.unresolvedShortageCount ?? 0,
      unresolvedOverage: unresolvedAgg?.unresolvedOverageCount ?? 0,
    },
  }
}

/**
 * Rekap per karyawan. Dikelompokkan lewat lower(employeeName), bukan employeeId —
 * employeeId cuma link opsional (lihat schema/stock_opname_resolutions.ts), employeeName
 * bebas teks adalah sumber kebenaran karena penanggung jawab tidak selalu punya akun
 * sistem. min()/max() dipakai supaya tetap bisa SELECT satu nilai representatif per grup.
 */
export async function getEmployeeChargeBreakdown(params: SOReportFilter): Promise<SOEmployeeChargeBreakdownRow[]> {
  assertValidRange(params.startDate, params.endDate)

  return db
    .select({
      employeeName: sql<string>`min(${soResolutionEmployeeCharges.employeeName})`,
      employeeId: sql<number | null>`max(${soResolutionEmployeeCharges.employeeId})`,
      caseCount: sql<number>`count(*)::int`,
      totalCharged: sql<number>`coalesce(sum(${soResolutionEmployeeCharges.amount}), 0)::int`,
    })
    .from(soResolutionEmployeeCharges)
    .innerJoin(soVarianceResolutions, eq(soResolutionEmployeeCharges.resolutionId, soVarianceResolutions.id))
    .where(and(resolutionDateFilter(params), eq(soVarianceResolutions.disposition, 'EMPLOYEE_CHARGE')))
    .groupBy(sql`lower(${soResolutionEmployeeCharges.employeeName})`)
    .orderBy(sql`coalesce(sum(${soResolutionEmployeeCharges.amount}), 0) desc`)
}
