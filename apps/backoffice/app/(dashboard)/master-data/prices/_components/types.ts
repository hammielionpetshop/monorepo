export const DISPLAY_TIERS = ['RETAIL', 'RESELLER', 'GROSIR', 'MEMBER'] as const
export type DisplayTier = typeof DISPLAY_TIERS[number]

export interface PriceRow {
  product_id: number
  product_name: string
  base_uom_id: number
  base_uom_code: string
  uom_id: number
  uom_code: string
  uom_name: string
  conversion_id: number | null
  conversion_ratio: number | null
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

export interface UomOption {
  id: number
  code: string
  name: string
  isBase?: boolean
}

export interface ProductConversion {
  id: number
  uomId: number | null
  uomCode: string | null
  uomName: string | null
  ratio: number | null
  weightGram: number | null
  priceBranches?: string[]
}

// Baris draft "+ satuan" — belum tersimpan, ikut Ctrl+S
export interface DraftUomRow {
  key: string
  productId: number
  productName: string
  baseUomId: number
  baseUomCode: string
  uomId: number | null
  newUom: { code: string; name: string } | null
  ratio: string
  prices: Record<string, number | null>
  cost: number | null
}

// Edit ratio konversi yang sedang diketik user. Menyimpan metadata baris (bukan
// cuma angka) supaya save tidak perlu mencari row di `rows` — yang hanya berisi
// halaman aktif dan bisa saja sudah berganti (pindah halaman/kategori/pencarian)
// sebelum Simpan ditekan.
export interface DirtyRatioEntry {
  productId: number
  uomId: number
  productName: string
  uomCode: string
  conversionId: number | null
  oldRatio: number | null
  newRatio: number
}

// Perubahan ratio global yang butuh konfirmasi eksplisit sebelum simpan
export interface RatioChangePlan {
  productId: number
  productName: string
  uomId: number
  uomCode: string
  conversionId: number
  oldRatio: number | null
  newRatio: number
  branches: string[]
}
