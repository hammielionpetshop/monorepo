export const SALES_PRICE_TIERS = ['RETAIL', 'GROSIR', 'RESELLER'] as const
export type SalesPriceTier = (typeof SALES_PRICE_TIERS)[number]

export const SALES_PRICE_TIER_LABELS: Record<SalesPriceTier, string> = {
  RETAIL: 'Retail',
  GROSIR: 'Grosir',
  RESELLER: 'Reseller',
}

export interface SalesByProductQuery {
  productIds: number[]
  categoryId: number | null
  brandId: number | null
  priceTier: SalesPriceTier | null
  branchId: number | null
  customerId: number | null
}

type RawParams = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function toId(value: string | string[] | undefined): number | null {
  const v = first(value)
  return v && /^\d+$/.test(v) ? Number(v) : null
}

/** `productIds` berisi daftar id dipisah koma; `productId` tunggal tetap diterima untuk tautan lama. */
export function parseSalesByProductQuery(params: RawParams): SalesByProductQuery {
  const rawIds = [first(params.productIds), first(params.productId)]
    .filter((v): v is string => !!v)
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter((v) => /^\d+$/.test(v))
    .map(Number)

  const tier = first(params.priceTier)

  return {
    productIds: [...new Set(rawIds)],
    categoryId: toId(params.categoryId),
    brandId: toId(params.brandId),
    priceTier: SALES_PRICE_TIERS.includes(tier as SalesPriceTier) ? (tier as SalesPriceTier) : null,
    branchId: toId(params.branchId),
    customerId: toId(params.customerId),
  }
}

export function buildSalesByProductSearch(query: Partial<SalesByProductQuery>): URLSearchParams {
  const search = new URLSearchParams()
  if (query.productIds && query.productIds.length > 0) search.set('productIds', query.productIds.join(','))
  if (query.categoryId != null) search.set('categoryId', String(query.categoryId))
  if (query.brandId != null) search.set('brandId', String(query.brandId))
  if (query.priceTier) search.set('priceTier', query.priceTier)
  if (query.branchId != null) search.set('branchId', String(query.branchId))
  if (query.customerId != null) search.set('customerId', String(query.customerId))
  return search
}
