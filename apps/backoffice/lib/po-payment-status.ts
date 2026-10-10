import { daysUntilDue } from './supplier-due-date'
import type { PoStage } from './po-stage'

export interface PoPayableSummary {
  status: string
  totalAmount: number
  paidAmount: number
  /** YYYY-MM-DD (WIB); null = termin supplier belum diatur. */
  dueDate: string | null
}

export interface PoPaymentBadge {
  label: string
  color: string
}

/**
 * Label "Status Bayar" di daftar PO. Hanya PO yang barangnya sudah masuk (punya hutang) yang
 * diberi label; PO yang harganya belum lengkap ditandai "Menunggu Faktur", bukan "Belum Bayar",
 * karena nominal tagihannya masih perkiraan.
 */
export function poPaymentBadge(
  stage: PoStage,
  payable: PoPayableSummary | null,
  today: string,
): PoPaymentBadge | null {
  if (!payable) return null
  if (stage === 'BELUM_HARGA' && payable.status !== 'PAID') {
    return { label: 'Menunggu Faktur', color: 'bg-amber-100 text-amber-800' }
  }
  switch (payable.status) {
    case 'PAID':
      return { label: 'Lunas', color: 'bg-green-100 text-green-800' }
    case 'WAIVED':
      return { label: 'Dihapus', color: 'bg-gray-100 text-gray-500' }
  }
  const late = payable.dueDate ? -daysUntilDue(payable.dueDate, today) : 0
  if (late > 0) return { label: `Terlambat ${late} hari`, color: 'bg-red-600 text-white' }
  if (payable.status === 'PARTIAL') return { label: 'Sebagian', color: 'bg-yellow-100 text-yellow-800' }
  return { label: 'Belum Bayar', color: 'bg-red-100 text-red-700' }
}
