/**
 * Clone ke Bulk Sale hanya untuk nota yang sedang/sudah dibatalkan. Clone nota yang masih
 * berlaku membuat dua nota aktif berisi barang yang sama — stok dan omzet terhitung dobel.
 */
export const CLONEABLE_STATUSES = ['PENDING_VOID', 'VOIDED'] as const

export function canCloneTransaction(status: string): boolean {
  return (CLONEABLE_STATUSES as readonly string[]).includes(status)
}

export const CLONE_NOT_ALLOWED_MESSAGE =
  'Nota hanya bisa di-clone bila sedang menunggu persetujuan void atau sudah di-void. Ajukan void dulu.'
