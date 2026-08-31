const ITEM_STATUS_LABELS: Record<string, string> = {
  MATCHED: 'Cocok Otomatis',
  PENDING: 'Menunggu',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
}

export interface SOExportRow {
  productName: string
  sku?: string | null
  uomCode: string
  systemQty: number
  // Bisa null untuk baris SO Besar yang belum dihitung.
  physicalQty: number | null
  varianceQty: number | null
  varianceCostValue: number | null
  varianceReason: string | null
  itemStatus: string | null
  isRecounted: boolean
  recountPhysicalQty: number | null
  recountVarianceQty: number | null
  decisionNote: string | null
  // true = sudah ada baris di stock_opname_items (sudah dihitung).
  counted: boolean
}

function escapeCsvCell(val: string | number): string {
  // Angka ditulis apa adanya — jangan diberi prefix `'` (mis. selisih -2 di SO
  // sangat lazim; kalau jadi "'-2" Excel membacanya sebagai teks, bukan angka).
  if (typeof val === 'number') return `"${val}"`
  const sanitized =
    val.startsWith('=') || val.startsWith('+') || val.startsWith('-') || val.startsWith('@')
      ? `'${val}`
      : val
  return `"${sanitized.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`
}

/**
 * CSV seluruh item SO — untuk SO Besar termasuk produk dalam cakupan yang BELUM
 * dihitung (qty fisik & selisih kosong, kolom "status hitung" = "Belum dihitung"),
 * supaya penyetuju bisa menelusuri keseluruhannya di Excel. BOM (﻿) di depan supaya
 * Excel Windows mengenali UTF-8 — nama produk beraksen tidak jadi mojibake.
 */
export function buildSOExportCsv(rows: SOExportRow[]): string {
  const table: (string | number)[][] = [
    [
      'produk',
      'sku',
      'satuan',
      'status hitung',
      'qty sistem',
      'qty fisik',
      'selisih',
      'nilai selisih',
      'alasan selisih',
      'status item',
      'qty hitung ulang',
      'selisih hitung ulang',
      'catatan keputusan',
    ],
    ...rows.map((row) => [
      row.productName,
      row.sku ?? '',
      row.uomCode,
      row.counted ? 'Sudah dihitung' : 'Belum dihitung',
      row.systemQty,
      row.physicalQty ?? '',
      row.varianceQty ?? '',
      row.varianceCostValue ?? '',
      row.varianceReason ?? '',
      row.itemStatus ? ITEM_STATUS_LABELS[row.itemStatus] ?? row.itemStatus : '',
      row.isRecounted ? row.recountPhysicalQty ?? '' : '',
      row.isRecounted ? row.recountVarianceQty ?? '' : '',
      row.decisionNote ?? '',
    ]),
  ]

  const csv = table.map((row) => row.map((cell) => escapeCsvCell(cell)).join(',')).join('\r\n')
  return '﻿' + csv
}
