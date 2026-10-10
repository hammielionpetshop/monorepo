import type { StockMutationMovements } from './types'

export type MovementKey = keyof StockMutationMovements

export const MUTATION_CATEGORIES: { label: string; types: MovementKey[]; hint?: string }[] = [
  { label: 'Pembelian', types: ['PO_IN'] },
  { label: 'Transfer Masuk', types: ['TRANSFER_IN'] },
  { label: 'Retur', types: ['RETURN_IN'] },
  {
    label: 'Penjualan',
    types: ['SALE_OUT', 'SALE_VOID', 'EDIT_IN', 'EDIT_OUT'],
    hint: 'Bersih: penjualan dikurangi void & koreksi transaksi',
  },
  { label: 'Transfer Keluar', types: ['TRANSFER_OUT'] },
  { label: 'Rusak', types: ['DAMAGED_OUT'] },
  { label: 'Retur Supplier', types: ['SUPPLIER_RETURN_OUT'] },
  { label: 'Opname', types: ['OPNAME'] },
  { label: 'Penyesuaian', types: ['ADJUSTMENT', 'BREAK_OUT', 'BREAK_IN'], hint: 'Penyesuaian manual & pecah satuan' },
]

export const MOVEMENT_LABEL: Record<MovementKey, string> = {
  SALE_OUT: 'Penjualan',
  SALE_VOID: 'Void penjualan',
  EDIT_IN: 'Koreksi masuk',
  EDIT_OUT: 'Koreksi keluar',
  PO_IN: 'Pembelian',
  ADJUSTMENT: 'Penyesuaian',
  OPNAME: 'Opname',
  BREAK_OUT: 'Pecah keluar',
  BREAK_IN: 'Pecah masuk',
  RETURN_IN: 'Retur',
  DAMAGED_OUT: 'Rusak',
  SUPPLIER_RETURN_OUT: 'Retur supplier',
  TRANSFER_OUT: 'Transfer keluar',
  TRANSFER_IN: 'Transfer masuk',
}

const qtyFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })

export function formatQty(value: number, signed = false): string {
  if (value === 0) return '-'
  const text = qtyFormat.format(Math.abs(value))
  if (!signed) return value < 0 ? `-${text}` : text
  return value > 0 ? `+${text}` : `−${text}`
}

export function formatBalance(value: number): string {
  return value === 0 ? '0' : formatQty(value)
}

export function qtyTone(value: number): string {
  if (value > 0) return 'text-emerald-600 dark:text-emerald-400'
  if (value < 0) return 'text-destructive'
  return 'text-muted-foreground'
}

export function categoryOf(type: string): string | undefined {
  return MUTATION_CATEGORIES.find((c) => c.types.includes(type as MovementKey))?.label
}
