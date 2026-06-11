export const DISPLAY_TIERS = ['RETAIL', 'RESELLER', 'GROSIR', 'MEMBER'] as const
export type DisplayTier = typeof DISPLAY_TIERS[number]

export interface PriceRow {
  product_id: number
  product_name: string
  uom_id: number
  uom_code: string
  uom_name: string
  prices: Partial<Record<string, number>>
  cost_price: number | null
}

export interface Branch {
  id: number
  name: string
}

export interface Category {
  id: number
  name: string
}
