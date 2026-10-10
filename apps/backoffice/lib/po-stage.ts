/**
 * Harga beli belum ada (menunggu faktur). Dua sumber:
 * - Form terima barang menyimpan harga yang diketik ke `invoiceUnitCost`; dikosongkan → disimpan
 *   0 sebagai tanda "menunggu faktur", walau PO punya harga rencana.
 * - PO lama (sebelum form terima punya kolom harga): `invoiceUnitCost` kosong (null), dianggap
 *   berharga selama harga rencana PO-nya > 0 — jadi PO lama tetap tampil Selesai.
 * Stoknya tetap boleh diterima — batch memakai harga rencana / modal terakhir sebagai perkiraan
 * sampai harga faktur dimasukkan. Padanan SQL: `pricePendingSql` di lib/po-stage-sql.ts.
 */
export function isPricePending(item: { unitCost: number | string; invoiceUnitCost: number | string | null }) {
  const invoice = item.invoiceUnitCost
  if (invoice !== null && invoice !== undefined && invoice !== '') return !(Number(invoice) > 0)
  return Number(item.unitCost) <= 0
}

/**
 * Tahap PO yang dilihat pengguna. "Belum Ada Harga" dan "Selesai" sengaja DIHITUNG, bukan status
 * baru di database: status COMPLETED dipakai pembuatan hutang (po-batch-updater) dan Batalkan
 * Penerimaan, dan keduanya tidak perlu tahu soal harga faktur.
 */
export type PoStage =
  | 'RENCANA'
  | 'DISETUJUI'
  | 'DITERIMA'
  | 'BELUM_HARGA'
  | 'SELESAI'
  | 'DITOLAK'
  | 'DIBATALKAN'

export function poStage(status: string, pricePendingItems: number): PoStage {
  switch (status) {
    case 'PENDING_APPROVAL':
    case 'DRAFT':
      return 'RENCANA'
    case 'APPROVED':
    case 'IN_TRANSIT':
      return 'DISETUJUI'
    case 'PARTIALLY_RECEIVED':
    case 'FULLY_RECEIVED':
      return 'DITERIMA'
    case 'COMPLETED':
      return pricePendingItems > 0 ? 'BELUM_HARGA' : 'SELESAI'
    case 'REJECTED':
      return 'DITOLAK'
    default:
      return 'DIBATALKAN'
  }
}

export const PO_STAGE_INFO: Record<PoStage, { label: string; color: string }> = {
  RENCANA:     { label: 'Rencana',         color: 'bg-yellow-100 text-yellow-800' },
  DISETUJUI:   { label: 'Disetujui',       color: 'bg-blue-100 text-blue-800' },
  DITERIMA:    { label: 'Diterima',        color: 'bg-orange-100 text-orange-800' },
  BELUM_HARGA: { label: 'Belum Ada Harga', color: 'bg-amber-100 text-amber-800' },
  SELESAI:     { label: 'Selesai',         color: 'bg-green-100 text-green-800' },
  DITOLAK:     { label: 'Ditolak',         color: 'bg-red-100 text-red-700' },
  DIBATALKAN:  { label: 'Dibatalkan',      color: 'bg-gray-100 text-gray-600' },
}
