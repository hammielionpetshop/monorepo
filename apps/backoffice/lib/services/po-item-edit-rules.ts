/**
 * Aturan ubah isi PO Supplier (spec 2026-11-06-po-edit-items-design) — tanpa akses DB supaya
 * bisa dipakai layar dan server. Stok & hutang baru dibuat saat Setujui Penerimaan (COMPLETED),
 * jadi sebelum itu isi PO masih rencana.
 */
export const PO_ITEM_EDITABLE_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'IN_TRANSIT',
  'PARTIALLY_RECEIVED',
  'FULLY_RECEIVED',
] as const

/** PO yang sudah disetujui kembali ke Menunggu Persetujuan bila isinya diubah (keputusan owner butir 1). */
export const PO_REAPPROVAL_STATUSES = ['APPROVED', 'IN_TRANSIT'] as const

/** Selain Draft bongkaran, hanya OWNER/GM yang boleh mengubah isi PO (keputusan owner butir 2). */
export const PO_ITEM_EDITOR_ROLES = ['OWNER', 'GM'] as const

export function canEditPoItems(status: string, role: string): boolean {
  if (!(PO_ITEM_EDITABLE_STATUSES as readonly string[]).includes(status)) return false
  return status === 'DRAFT' || (PO_ITEM_EDITOR_ROLES as readonly string[]).includes(role)
}

export function needsReapproval(status: string): boolean {
  return (PO_REAPPROVAL_STATUSES as readonly string[]).includes(status)
}
