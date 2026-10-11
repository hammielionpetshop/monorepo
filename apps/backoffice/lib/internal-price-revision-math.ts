import Big from 'big.js'

/**
 * Hitungan satu baris Revisi Harga Beli — dipakai popup penyetuju (pratinjau) dengan rumus yang
 * sama persis dengan `approvePriceRevision`. Harga per satuan kiriman, `ratio` = isi satuan itu
 * dalam satuan dasar, `remainingBase` = sisa stok kiriman (satuan dasar) yang modalnya masih bisa diganti.
 */
export function estimatePriceRevisionLine(params: {
  qty: number
  ratio: number
  oldUnitPrice: number
  finalUnitPrice: number
  remainingBase: number
}) {
  const { qty, ratio, oldUnitPrice, finalUnitPrice, remainingBase } = params
  const lineValue = Math.round(new Big(oldUnitPrice).minus(finalUnitPrice).times(qty).toNumber())
  const oldCostBase = Math.round(new Big(oldUnitPrice).div(ratio).toNumber())
  const newCostBase = Math.round(new Big(finalUnitPrice).div(ratio).toNumber())
  const qtyBase = Math.round(new Big(qty).times(ratio).toNumber())
  const stockCorrection = remainingBase * (oldCostBase - newCostBase)
  return {
    /** qty × (harga lama − harga final): positif = tagihan turun, negatif = tagihan naik. */
    lineValue,
    qtyBase,
    qtyConsumedBase: Math.max(0, qtyBase - remainingBase),
    /** Koreksi nilai stok yang masih ada. */
    stockCorrection,
    /** Penyesuaian Modal untuk bagian yang sudah terpakai (masuk Laba Rugi cabang penerima). */
    cogsAdjustment: lineValue - stockCorrection,
  }
}
