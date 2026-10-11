import type { StockMutationMovements } from './types'

export type MovementKey = keyof StockMutationMovements

export const MUTATION_CATEGORIES: { label: string; types: MovementKey[]; hint?: string }[] = [
  { label: 'Pembelian', types: ['PO_IN'] },
  { label: 'Transfer Masuk', types: ['TRANSFER_IN'] },
  { label: 'Retur', types: ['RETURN_IN', 'RETURN_CANCEL_OUT'], hint: 'Bersih: retur pelanggan dikurangi retur yang dibatalkan' },
  {
    label: 'Penjualan',
    types: ['SALE_OUT', 'SALE_VOID', 'EDIT_IN', 'EDIT_OUT'],
    hint: 'Bersih: penjualan dikurangi void & koreksi transaksi',
  },
  { label: 'Transfer Keluar', types: ['TRANSFER_OUT'] },
  { label: 'Rusak', types: ['DAMAGED_OUT'] },
  {
    label: 'Retur Supplier',
    types: ['SUPPLIER_RETURN_OUT', 'SUPPLIER_RETURN_CANCEL_IN'],
    hint: 'Bersih: retur ke supplier dikurangi retur yang dibatalkan',
  },
  {
    label: 'Retur Internal',
    types: ['INTERNAL_RETURN_OUT', 'INTERNAL_RETURN_IN', 'INTERNAL_RETURN_CANCEL_IN', 'INTERNAL_RETURN_CANCEL_OUT'],
    hint: 'Barang Dikembalikan antar cabang: keluar dari penerima, masuk ke pengirim (dikurangi yang dibatalkan)',
  },
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
  RETURN_CANCEL_OUT: 'Batal retur',
  DAMAGED_OUT: 'Rusak',
  SUPPLIER_RETURN_OUT: 'Retur supplier',
  SUPPLIER_RETURN_CANCEL_IN: 'Batal retur supplier',
  INTERNAL_RETURN_OUT: 'Retur internal keluar',
  INTERNAL_RETURN_IN: 'Retur internal masuk',
  INTERNAL_RETURN_CANCEL_IN: 'Batal retur internal (masuk)',
  INTERNAL_RETURN_CANCEL_OUT: 'Batal retur internal (keluar)',
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
