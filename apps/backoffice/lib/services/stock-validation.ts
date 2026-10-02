import Big from 'big.js'
import { products, productUomConversions, eq, and } from '../db'
import type { Tx } from '../stock-adjustment'

export class StockConflictError extends Error {
  readonly status = 409
}

export function stockQtyBase(qty: string | number, ratio: number, allowZero = false): number {
  let value: Big
  try { value = new Big(qty).times(ratio) } catch { throw new StockConflictError('Jumlah stok tidak valid') }
  const number = value.toNumber()
  if (!Number.isFinite(ratio) || ratio <= 0 || !Number.isSafeInteger(number) || number < 0 || (!allowZero && number === 0)) {
    throw new StockConflictError('Jumlah stok dalam satuan dasar harus berupa bilangan bulat positif')
  }
  return number
}

export async function resolveStockUom(tx: Tx, productId: number, uomId: number, prefetched?: { product?: any; ratio?: number }) {
  const prod = prefetched?.product ?? (await tx.select({ baseUomId: products.baseUomId, defaultCostPrice: products.defaultCostPrice })
    .from(products).where(eq(products.id, productId)).limit(1))[0]
  if (!prod) throw new StockConflictError('Produk stok tidak ditemukan')
  let ratio = 1
  if (uomId !== prod.baseUomId) {
    ratio = prefetched?.ratio ?? (await tx.select({ ratio: productUomConversions.ratio }).from(productUomConversions)
      .where(and(eq(productUomConversions.productId, productId), eq(productUomConversions.uomId, uomId))).limit(1))[0]?.ratio
    if (!Number.isFinite(ratio) || ratio <= 0) throw new StockConflictError('Konversi satuan produk tidak ditemukan atau tidak valid')
  }
  return { product: prod, baseUomId: prod.baseUomId as number, ratio }
}
