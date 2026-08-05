import type { BootstrapPrice } from './pos-client'

// Urutan prioritas tier saat POS harus memilih satu harga secara otomatis
export const TIER_PRIORITY = ['RETAIL', 'GROSIR', 'MEMBER', 'RESELLER', 'DISTRIBUTOR', 'PROMO']

export function tierRank(tier: string): number {
  const idx = TIER_PRIORITY.indexOf(tier)
  return idx === -1 ? TIER_PRIORITY.length : idx
}

/**
 * Harga yang ditampilkan di kartu produk. Prioritas: tier terbaik pada satuan
 * dasar, lalu tier terbaik pada satuan lain. Tanpa fallback ini produk yang
 * harganya hanya diisi pada satuan konversi (mis. SAK/DUS) atau pada tier
 * non-RETAIL salah tampil sebagai "No harga" padahal harganya ada.
 */
export function pickDisplayPrice(
  prices: BootstrapPrice[],
  baseUomId: number
): BootstrapPrice | null {
  if (!prices.length) return null
  return [...prices].sort((a, b) => {
    const baseA = a.uomId === baseUomId ? 0 : 1
    const baseB = b.uomId === baseUomId ? 0 : 1
    if (baseA !== baseB) return baseA - baseB
    return tierRank(a.tierType) - tierRank(b.tierType)
  })[0]
}
