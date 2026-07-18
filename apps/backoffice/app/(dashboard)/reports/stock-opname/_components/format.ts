export {
  STATUS_LABELS,
  TYPE_LABELS,
  METHOD_LABELS,
  CATEGORY_LABELS,
} from '@/lib/stock-opname-labels'

export function formatRupiah(value: number | null): string {
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value ?? 0)
  } catch {
    return 'Rp 0'
  }
}

export function formatDateTime(value: Date | string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(value))
  } catch {
    return String(value)
  }
}
