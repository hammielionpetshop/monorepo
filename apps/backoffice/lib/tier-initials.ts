/**
 * Inisial kelas harga (ret/res/gro/mem) untuk tampilan internal — dipakai di Detail Transaksi,
 * popup Transaksi per kasir (Riwayat Shift), dan daftar Riwayat Transaksi. Bukan untuk konsumen.
 */
const TIER_ORDER = ['RETAIL', 'RESELLER', 'GROSIR', 'MEMBER']

/** Urutkan & buang duplikat kode kelas harga: Retail→Reseller→Grosir→Member, sisanya di belakang (alfabet). */
export function orderTiers(tiers: (string | null | undefined)[]): string[] {
  const uniq = [...new Set(tiers.filter((t): t is string => !!t))]
  return uniq.sort((a, b) => {
    const ia = TIER_ORDER.indexOf(a)
    const ib = TIER_ORDER.indexOf(b)
    const sa = ia === -1 ? TIER_ORDER.length : ia
    const sb = ib === -1 ? TIER_ORDER.length : ib
    return sa !== sb ? sa - sb : a.localeCompare(b)
  })
}

/** 3 huruf depan, huruf kecil: RETAIL → "ret". Aturan owner: tier baru pun cukup 3 huruf depannya. */
export function tierInitial(tier: string): string {
  return tier.slice(0, 3).toLowerCase()
}
