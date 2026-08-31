import type { SOReviewHeader, SOReviewItem } from '@/app/(dashboard)/inventory/stock-opname/page'

const ITEM_STATUS_LABELS: Record<string, string> = {
  MATCHED: 'Cocok Otomatis',
  PENDING: 'Menunggu',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
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
 * Ekspor seluruh item pada modal review SO (terutama SO Besar yang bisa ribuan
 * baris) supaya penyetuju bisa menelusurinya di Excel. Sengaja dibangun dari data
 * yang sudah dimuat modal, bukan query ulang, supaya isinya persis sama dengan yang
 * dilihat penyetuju. BOM (﻿) di depan supaya Excel Windows mengenali UTF-8 —
 * nama produk beraksen tidak jadi mojibake.
 */
export function buildSOReviewCsv(items: SOReviewItem[]): string {
  const rows: (string | number)[][] = [
    [
      'produk',
      'satuan',
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
    ...items.map((item) => [
      item.productName,
      item.uomCode,
      item.systemQty,
      item.physicalQty,
      item.varianceQty,
      item.varianceCostValue ?? '',
      item.varianceReason ?? '',
      item.itemStatus ? ITEM_STATUS_LABELS[item.itemStatus] ?? item.itemStatus : '',
      item.isRecounted ? item.recountPhysicalQty ?? '' : '',
      item.isRecounted ? item.recountVarianceQty ?? '' : '',
      item.decisionNote ?? '',
    ]),
  ]

  const csv = rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(',')).join('\r\n')
  return '﻿' + csv
}

export function soReviewCsvFilename(header: Pick<SOReviewHeader, 'soNumber'>): string {
  return `${header.soNumber}-review.csv`
}
