import Big from 'big.js'
import { poDiscountFactor } from './po-discount'

type PoTotalItem = {
  qtyOrdered: number | string
  qtyReceived: number | string
  qtyDamaged?: number | string
  unitCost: number | string
  invoiceUnitCost: number | string | null
}

/** Qty dasar Total PO per baris: barang yang datang melebihi pesanan ikut dihitung. */
export function poLineQty(item: Pick<PoTotalItem, 'qtyOrdered' | 'qtyReceived'>): number {
  return Math.max(Number(item.qtyOrdered) || 0, Number(item.qtyReceived) || 0)
}

/** Harga berlaku: harga faktur bila sudah diisi (> 0), selain itu harga PO. */
function lineCost(item: Pick<PoTotalItem, 'unitCost' | 'invoiceUnitCost'>): number {
  const invoice = Number(item.invoiceUnitCost)
  return invoice > 0 ? invoice : Number(item.unitCost) || 0
}

/** Total PO = Σ max(qty pesan, qty diterima) × harga berlaku, dibulatkan ke rupiah. */
export function poTotalAmount(items: PoTotalItem[]): number {
  return Number(
    items.reduce((sum, i) => sum.plus(new Big(poLineQty(i)).times(lineCost(i))), new Big(0)).round(0),
  )
}

/** Qty yang benar-benar masuk stok per baris: diterima − rusak, tidak minus. */
export function poReceivedNetQty(item: Pick<PoTotalItem, 'qtyReceived' | 'qtyDamaged'>): number {
  return Math.max((Number(item.qtyReceived) || 0) - (Number(item.qtyDamaged) || 0), 0)
}

/**
 * Total Diterima = Σ (diterima − rusak) × harga berlaku × faktor diskon PO, dibulatkan ke rupiah.
 * Rumusnya sama dengan hutang supplier saat penerimaan disetujui (lib/po-batch-updater.ts).
 */
export function poReceivedTotal(items: PoTotalItem[], discountAmount: number): number {
  const factor = poDiscountFactor(poTotalAmount(items), discountAmount)
  return Number(
    items
      .reduce((sum, i) => sum.plus(new Big(poReceivedNetQty(i)).times(lineCost(i)).times(factor)), new Big(0))
      .round(0),
  )
}
