import Big from 'big.js'

type PoTotalItem = {
  qtyOrdered: number | string
  qtyReceived: number | string
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
