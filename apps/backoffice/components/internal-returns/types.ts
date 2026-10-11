import type { InternalReturnStatus, InternalReturnView } from '@/lib/services/internal-return-queries'

export type { InternalReturnItemView, InternalReturnStatus, InternalReturnView } from '@/lib/services/internal-return-queries'

export type ReturnedGoodsReason = 'TIDAK_DATANG' | 'SALAH_KIRIM' | 'LAINNYA'

export const RETURNED_GOODS_REASONS: ReturnedGoodsReason[] = ['TIDAK_DATANG', 'SALAH_KIRIM', 'LAINNYA']

export const INTERNAL_REASON_LABELS: Record<string, string> = {
  TIDAK_DATANG: 'Barang tidak datang / kurang kirim',
  SALAH_KIRIM: 'Salah kirim (tercatat tapi tidak ada)',
  SALAH_HARGA: 'Salah harga',
  LAINNYA: 'Lainnya',
}

export const INTERNAL_KIND_LABELS: Record<string, string> = {
  BARANG_DIKEMBALIKAN: 'Barang Dikembalikan',
  REVISI_HARGA: 'Revisi Harga Beli',
}

export const INTERNAL_STATUS_LABELS: Record<InternalReturnStatus, string> = {
  PENDING: 'Menunggu Persetujuan',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  WITHDRAWN: 'Ditarik',
  CANCELLED: 'Dibatalkan',
}

/** Hasil pencarian kode transaksi (`/lookup?code=`): kiriman, nota, hutang, dan barang yang bisa dikembalikan. */
export interface ReturnableTransfer {
  transfer: {
    id: number
    ibtNumber: string
    status: string
    receivedAt: string | null
    senderBranchId: number
    senderBranchName: string
    receiverBranchId: number
    receiverBranchName: string
  }
  sale: { id: number; trxNumber: string }
  payable: { id: number; totalAmount: number; paidAmount: number; status: string } | null
  items: {
    id: number
    productId: number
    productName: string
    uomId: number
    uomCode: string
    qtyReceived: number
    unitPrice: number
    alreadyReturned: number
    returnableQty: number
  }[]
}

/**
 * Perkiraan pembagian nilai retur untuk dokumen yang MASIH MENUNGGU: potong sisa hutang internal
 * kiriman itu dulu, kelebihannya jadi Saldo Internal. Angka pastinya dihitung server saat disetujui.
 */
export function estimateInternalReturnSplit(row: Pick<InternalReturnView, 'totalValue' | 'payableRemaining'>) {
  const payableDeduction = Math.min(row.totalValue, row.payableRemaining ?? 0)
  return { payableDeduction, creditAmount: row.totalValue - payableDeduction }
}
