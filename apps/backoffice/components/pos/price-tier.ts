import type { BootstrapPrice } from './pos-client'

// Urutan prioritas tier saat POS harus memilih satu harga secara otomatis
export const TIER_PRIORITY = ['RETAIL', 'GROSIR', 'MEMBER', 'RESELLER', 'DISTRIBUTOR', 'PROMO']

// Tier yang dipakai saat tier pelanggan tidak tersedia untuk produk/satuan tsb.
export const FALLBACK_TIER = 'RETAIL'

export function tierRank(tier: string): number {
  const idx = TIER_PRIORITY.indexOf(tier)
  return idx === -1 ? TIER_PRIORITY.length : idx
}

/**
 * Tier mana yang dipakai untuk pelanggan tertentu di antara tier yang tersedia.
 *
 * Keputusan user 2026-08-11: pelanggan RESELLER yang produknya belum punya harga
 * RESELLER tetap boleh dijual — harganya jatuh ke RETAIL, produknya tidak ditolak.
 * `isFallback` menandai kasus itu supaya layar bisa memberi tahu kasir; tanpa
 * penanda ini "memang RETAIL" dan "harga RESELLER lupa diisi" keluar sebagai
 * angka yang sama persis.
 */
export function resolveTierForCustomer(
  availableTiers: string[],
  customerTier?: string | null
): { tier: string | null; isFallback: boolean } {
  if (availableTiers.length === 0) return { tier: null, isFallback: false }

  if (customerTier && availableTiers.includes(customerTier)) {
    return { tier: customerTier, isFallback: false }
  }

  const tier = availableTiers.includes(FALLBACK_TIER)
    ? FALLBACK_TIER
    : [...availableTiers].sort((a, b) => tierRank(a) - tierRank(b))[0]!

  return { tier, isFallback: !!customerTier && customerTier !== tier }
}

/**
 * Harga yang ditampilkan di kartu produk. Prioritas: tier terbaik pada satuan
 * dasar, lalu tier terbaik pada satuan lain. Tanpa fallback ini produk yang
 * harganya hanya diisi pada satuan konversi (mis. SAK/DUS) atau pada tier
 * non-RETAIL salah tampil sebagai "No harga" padahal harganya ada.
 *
 * `customerTier` menaikkan tier pelanggan ke urutan teratas — satuan dasar tetap
 * didahulukan, karena harga yang tampil harus sebanding antar produk.
 */
export function pickDisplayPrice(
  prices: BootstrapPrice[],
  baseUomId: number,
  customerTier?: string | null
): BootstrapPrice | null {
  if (!prices.length) return null
  const rank = (tier: string) => (customerTier && tier === customerTier ? -1 : tierRank(tier))
  return [...prices].sort((a, b) => {
    const baseA = a.uomId === baseUomId ? 0 : 1
    const baseB = b.uomId === baseUomId ? 0 : 1
    if (baseA !== baseB) return baseA - baseB
    return rank(a.tierType) - rank(b.tierType)
  })[0]
}
