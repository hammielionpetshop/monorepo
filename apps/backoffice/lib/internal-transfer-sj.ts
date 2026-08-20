// Item Surat Jalan transfer internal — dipakai oleh internal-transfer-detail-client.tsx.
// Modul terpisah supaya logikanya bisa diuji tanpa merender komponen React.

// Struktural & minimal: cocok dengan TransferItem tanpa mengikatnya.
export type ShippableItem = {
  qtyShipped: number
}

/**
 * Item yang benar-benar ikut dicetak di Surat Jalan pengiriman.
 *
 * Hanya item dengan qtyShipped > 0 yang dikirim secara fisik — item yang qty
 * kirimnya dikosongkan approver (mis. stok habis saat konfirmasi pengiriman)
 * bukan bagian dari pengiriman ini, jadi tidak boleh muncul di Surat Jalan
 * seolah-olah ikut terkirim.
 */
export function filterShippedSjItems<T extends ShippableItem>(items: T[]): T[] {
  return items.filter((item) => item.qtyShipped > 0)
}
