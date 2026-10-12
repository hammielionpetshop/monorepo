export interface BranchOption {
  id: number
  name: string
}

export interface ReportFilters {
  startDate: string
  endDate: string
  branchId: string
  source: string
  q: string
}

export function formatRp(value: number): string {
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`
}

export function formatDateTime(value: string | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
