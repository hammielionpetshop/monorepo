export interface BranchOption {
  id: number
  name: string
}

export interface PromoReportFilters {
  startDate: string
  endDate: string
  branchId: string
}

export function formatRp(value: number): string {
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`
}

export function formatQty(value: number): string {
  return value.toLocaleString('id-ID')
}

export function formatDate(value: string | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric',
  })
}
