import type { InternalTransfer } from './types'

export interface TransferFilters {
  search: string
  sourceBranchId: string
  destinationBranchId: string
  requestedById: string
  startDate: string
  endDate: string
}

export const EMPTY_TRANSFER_FILTERS: TransferFilters = {
  search: '',
  sourceBranchId: '',
  destinationBranchId: '',
  requestedById: '',
  startDate: '',
  endDate: '',
}

// Tanggal kalender WIB (YYYY-MM-DD) supaya filter tanggal cocok dengan tanggal yang tampil
// di tabel — transfer jam 01:00 WIB tercatat hari sebelumnya kalau dibandingkan dalam UTC.
export function toWibDateKey(value: string | Date): string {
  return new Date(value).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
}

export function hasActiveTransferFilters(filters: TransferFilters): boolean {
  return Object.values(filters).some((value) => value.trim() !== '')
}

export function filterTransfers(
  transfers: InternalTransfer[],
  filters: TransferFilters
): InternalTransfer[] {
  const terms = filters.search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const sourceId = filters.sourceBranchId ? Number(filters.sourceBranchId) : null
  const destId = filters.destinationBranchId ? Number(filters.destinationBranchId) : null
  const requesterId = filters.requestedById ? Number(filters.requestedById) : null

  return transfers.filter((transfer) => {
    if (sourceId !== null && transfer.sourceBranchId !== sourceId) return false
    if (destId !== null && transfer.destinationBranchId !== destId) return false
    if (requesterId !== null && transfer.requestedById !== requesterId) return false

    if (filters.startDate || filters.endDate) {
      const dateKey = toWibDateKey(transfer.createdAt)
      if (filters.startDate && dateKey < filters.startDate) return false
      if (filters.endDate && dateKey > filters.endDate) return false
    }

    if (terms.length > 0) {
      const haystack = [
        transfer.ibtNumber,
        transfer.sourceBranchName,
        transfer.destinationBranchName,
        transfer.requestedByName,
        transfer.notes,
        transfer.productNames,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!terms.every((term) => haystack.includes(term))) return false
    }

    return true
  })
}
