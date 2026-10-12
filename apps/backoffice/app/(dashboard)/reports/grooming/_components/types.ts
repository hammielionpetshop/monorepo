export interface BranchOption {
  id: number
  name: string
}

export interface GroomerOption {
  id: number
  name: string
  isActive: boolean
  isGroomer: boolean
}

export interface ReportFilters {
  startDate: string
  endDate: string
  branchId: string
  groomerId: string
  payment: string
  q: string
}

export function formatRp(value: number): string {
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`
}

export function formatDateTime(value: Date | string | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export const STATUS_LABEL: Record<string, string> = {
  DIKERJAKAN: 'Sedang dikerjakan',
  DIAMBIL: 'Sudah diambil',
  DIBATALKAN: 'Dibatalkan',
  DIPROSES: 'Diproses',
  SELESAI: 'Selesai',
}
