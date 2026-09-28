export type ActionOption = { value: string; label: string }

export const AUDIT_ACTION_GROUPS: { group: string; actions: ActionOption[] }[] = [
  {
    group: 'Transaksi',
    actions: [
      { value: 'EDIT_TRANSACTION', label: 'Edit transaksi' },
      { value: 'OVERSELL', label: 'Jual melebihi stok (oversell)' },
      { value: 'VOID_TRANSACTION', label: 'Void transaksi' },
      { value: 'VOID_REQUEST_APPROVED', label: 'Permintaan void disetujui' },
      { value: 'VOID_REQUEST_REJECTED', label: 'Permintaan void ditolak' },
      { value: 'VOID_REQUEST_AUTO_REJECTED', label: 'Permintaan void ditolak otomatis' },
    ],
  },
  {
    group: 'Retur',
    actions: [
      { value: 'RETURN_PROCESSED', label: 'Retur diproses' },
      { value: 'RETURN_CANCELLED', label: 'Retur dibatalkan' },
    ],
  },
  {
    group: 'Stok',
    actions: [
      { value: 'MANUAL_STOCK_ADJUSTMENT', label: 'Penyesuaian stok manual' },
      { value: 'STOCK_BATCH_CORRECT_COST', label: 'Koreksi modal batch' },
      { value: 'STOCK_UOM_MOVE', label: 'Pindah satuan stok' },
      { value: 'STOCK_UOM_ROW_DELETE', label: 'Hapus baris satuan stok' },
      { value: 'STOCK_SHORTFALL_WRITE_OFF', label: 'Hapus buku kekurangan stok' },
      { value: 'DAMAGED_GOODS_APPROVE', label: 'Barang rusak disetujui' },
      { value: 'DAMAGED_GOODS_REJECT', label: 'Barang rusak ditolak' },
      { value: 'INTERNAL_TRANSFER_SHIP_STOCK_BYPASS', label: 'Kirim IBT melewati cek stok' },
    ],
  },
  {
    group: 'Stock Opname',
    actions: [
      { value: 'STOCK_OPNAME_ADJUSTMENT', label: 'Penyesuaian dari stock opname' },
      { value: 'STOCK_OPNAME_ITEM_EDIT', label: 'Edit item SO' },
      { value: 'STOCK_OPNAME_ITEM_DELETE', label: 'Hapus item SO' },
      { value: 'STOCK_OPNAME_ITEM_RECOUNT', label: 'Hitung ulang item SO' },
      { value: 'STOCK_OPNAME_ITEM_APPROVE', label: 'Item SO disetujui' },
      { value: 'STOCK_OPNAME_ITEM_REJECT', label: 'Item SO ditolak' },
      { value: 'SO_VARIANCE_RESOLUTION_CREATE', label: 'Resolusi selisih SO dibuat' },
      { value: 'SO_VARIANCE_RESOLUTION_VOID', label: 'Resolusi selisih SO dibatalkan' },
    ],
  },
  {
    group: 'Pembelian',
    actions: [
      { value: 'PO_RECEIVING', label: 'Penerimaan barang PO' },
      { value: 'PO_RECEIVING_REVERSED', label: 'Penerimaan PO dibatalkan' },
    ],
  },
  {
    group: 'Harga',
    actions: [
      { value: 'PRICE_BULK_UPDATE', label: 'Ubah harga (grid)' },
      { value: 'PRICE_IMPORT', label: 'Impor harga' },
    ],
  },
  {
    group: 'Keuangan & Shift',
    actions: [
      { value: 'VOID_DEBT_PAYMENT', label: 'Batal pembayaran hutang' },
      { value: 'SHIFT_EXPENSE_UPDATED', label: 'Ubah pengeluaran shift' },
      { value: 'SHIFT_EXPENSE_DELETED', label: 'Hapus pengeluaran shift' },
    ],
  },
  {
    group: 'Pengguna & Pengaturan',
    actions: [
      { value: 'USER_PIN_RESET', label: 'Reset PIN pengguna' },
      { value: 'OWNER_ASSIGNMENT_SET', label: 'Tetapkan owner cabang' },
      { value: 'OWNER_ASSIGNMENT_CLEARED', label: 'Hapus owner cabang' },
    ],
  },
]

const KNOWN_LABELS = new Map(
  AUDIT_ACTION_GROUPS.flatMap((g) => g.actions.map((a) => [a.value, a.label] as const)),
)

export function actionLabel(action: string): string {
  return KNOWN_LABELS.get(action) ?? action
}

// Aksi lama yang masih ada di DB tapi tidak lagi ditulis kode tetap harus bisa difilter.
export function otherActions(dbActions: string[]): ActionOption[] {
  return dbActions
    .filter((a) => !KNOWN_LABELS.has(a))
    .sort()
    .map((a) => ({ value: a, label: a }))
}
