import Big from 'big.js'

/**
 * Tampilan selisih terima PO Internal (kirim > terima). Saat penerima mengoreksi qty, selisihnya
 * sudah otomatis balik ke stok pengirim (lewat retur nota Bulk Sale, atau langsung untuk transfer
 * manual) dan tidak ditagih — lihat `api/bo/internal-transfers/[id]/status/route.ts`. Berkas ini
 * hanya merangkum angka untuk layar; aman dipakai di client component (tanpa akses DB).
 */

/** Label status `PARTIALLY_RECEIVED`: "Sebagian" terkesan masih menunggu sisa barang. */
export const RECEIVED_WITH_SHORTAGE_LABEL = 'Diterima – Ada Selisih'

/** Alasan retur nota Bulk Sale yang dibuat otomatis saat terima — harus sama dengan status route. */
export function shortageReturnReason(ibtNumber: string) {
  return `Selisih terima ${ibtNumber}`
}

export interface ShortageReturnRef {
  id: string
  returnNumber: string
  totalRefundAmount: number
}

interface ReceiveLine {
  qtyShipped: number
  qtyReceived: number
  costPriceAtTransfer: number
}

export function isReceivedStatus(status: string) {
  return status === 'PARTIALLY_RECEIVED' || status === 'FULLY_RECEIVED'
}

/** Qty yang dikirim tapi tidak diterima (0 bila cocok). */
export function receiveShortQty(line: Pick<ReceiveLine, 'qtyShipped' | 'qtyReceived'>) {
  return Math.max(0, line.qtyShipped - line.qtyReceived)
}

export function summarizeReceive(lines: ReceiveLine[]) {
  let shipped = new Big(0)
  let received = new Big(0)
  let shortItemCount = 0
  for (const line of lines) {
    shipped = shipped.plus(new Big(line.qtyShipped).times(line.costPriceAtTransfer))
    received = received.plus(new Big(line.qtyReceived).times(line.costPriceAtTransfer))
    if (receiveShortQty(line) > 0) shortItemCount++
  }
  return {
    shippedValue: shipped.toNumber(),
    receivedValue: received.toNumber(),
    shortageValue: shipped.minus(received).toNumber(),
    shortItemCount,
  }
}
