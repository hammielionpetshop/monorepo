import type { InternalReturnStatus, InternalReturnView } from '@/lib/services/internal-return-queries'
import { formatRupiah } from '@/components/supplier-returns/types'

export type { InternalReturnItemView, InternalReturnStatus, InternalReturnView } from '@/lib/services/internal-return-queries'

export type ReturnedGoodsReason = 'TIDAK_DATANG' | 'SALAH_KIRIM' | 'LAINNYA'

export const RETURNED_GOODS_REASONS: ReturnedGoodsReason[] = ['TIDAK_DATANG', 'SALAH_KIRIM', 'LAINNYA']

export const INTERNAL_REASON_LABELS: Record<string, string> = {
  TIDAK_DATANG: 'Barang tidak datang / kurang kirim',
  SALAH_KIRIM: 'Salah kirim (tercatat tapi tidak ada)',
  SALAH_HARGA: 'Salah harga',
  LAINNYA: 'Lainnya',
}

export const INTERNAL_KIND_GOODS = 'BARANG_DIKEMBALIKAN'
export const INTERNAL_KIND_PRICE = 'REVISI_HARGA'

export const isPriceRevision = (row: Pick<InternalReturnView, 'kind'>) => row.kind === INTERNAL_KIND_PRICE

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

/** Hasil pencarian kode transaksi untuk Revisi Harga Beli (`/lookup?kind=REVISI_HARGA`). */
export interface RevisableTransfer extends Omit<ReturnableTransfer, 'items'> {
  items: {
    id: number
    productId: number
    productName: string
    uomId: number
    uomCode: string
    qtyReceived: number
    /** Harga di nota Bulk Sale. */
    notaUnitPrice: number
    /** Harga yang berlaku sekarang (harga nota, atau harga final revisi sebelumnya). */
    unitPrice: number
    /** Qty yang ikut direvisi = diterima − yang sudah dikembalikan. */
    revisableQty: number
    hasPendingRevision: boolean
  }[]
}

/** Pratinjau popup penyetuju Revisi Harga Beli (`/[id]/preview`) — keadaan kiriman saat ini per baris dokumen. */
export interface PriceRevisionPreview {
  id: number
  returnNumber: string
  items: {
    itemId: number
    qty: number
    /** Isi satuan kiriman dalam satuan dasar. */
    ratio: number
    currentUnitPrice: number
    proposedUnitPrice: number
    /** Sisa stok kiriman ini di cabang penerima (satuan dasar). */
    remainingBase: number
  }[]
}

/**
 * Nilai Revisi Harga Beli dalam kata: positif = turun (harga dibetulkan lebih murah), negatif = naik.
 * Dipakai untuk tagihan, penjualan pengirim, dan koreksi modal — arahnya selalu sama.
 */
export function revisionValueLabel(value: number): string {
  if (value === 0) return 'tidak berubah'
  return `${value > 0 ? 'turun' : 'naik'} ${formatRupiah(Math.abs(value))}`
}

/** Qty yang bisa pecahan (mis. satuan dasar dibagi isi satuan) — paling banyak 2 angka di belakang koma. */
export function formatQty(value: number): string {
  return (Math.round(value * 100) / 100).toLocaleString('id-ID')
}

/**
 * Perkiraan pembagian nilai retur untuk dokumen yang MASIH MENUNGGU: potong sisa hutang internal
 * kiriman itu dulu, kelebihannya jadi Saldo Internal. Angka pastinya dihitung server saat disetujui.
 */
export function estimateInternalReturnSplit(row: Pick<InternalReturnView, 'totalValue' | 'payableRemaining'>) {
  const payableDeduction = Math.min(row.totalValue, row.payableRemaining ?? 0)
  return { payableDeduction, creditAmount: row.totalValue - payableDeduction }
}
