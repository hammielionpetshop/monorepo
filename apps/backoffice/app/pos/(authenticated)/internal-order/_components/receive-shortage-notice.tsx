'use client'

import { summarizeReceive, type ShortageReturnRef } from '@/lib/ibt-receive-shortage'

interface Props {
  items: { qtyShipped: number; qtyReceived: number; costPriceAtTransfer: number }[]
  sourceBranchName: string | null
  shortageReturns: ShortageReturnRef[]
  /** Tautan nomor retur (Back Office: ke nota Bulk Sale). Kosong = teks biasa. */
  returnHref?: string
}

/**
 * Penegasan untuk staf toko: barang yang dikirim tapi tidak diterima sudah kembali sendiri ke
 * stok pengirim dan tidak ditagih — supaya tidak dikira koreksi qty-nya gagal.
 */
export default function ReceiveShortageNotice({ items, sourceBranchName, shortageReturns, returnHref }: Props) {
  const { shortageValue, shortItemCount } = summarizeReceive(items)
  if (shortItemCount === 0) return null

  return (
    <div
      role="note"
      className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <p className="font-semibold">
        ⚠ {shortItemCount} barang tidak diterima penuh (senilai Rp {shortageValue.toLocaleString('id-ID')}).
      </p>
      <p className="mt-1">
        Barangnya sudah <strong>dikembalikan otomatis ke stok {sourceBranchName ?? 'cabang pengirim'}</strong>
        {shortageReturns.length > 0 && (
          <>
            {' '}(Retur{' '}
            {shortageReturns.map((r, idx) => (
              <span key={r.id}>
                {idx > 0 && ', '}
                {returnHref ? (
                  <a href={returnHref} className="font-mono font-medium underline hover:no-underline">
                    {r.returnNumber}
                  </a>
                ) : (
                  <span className="font-mono font-medium">{r.returnNumber}</span>
                )}
              </span>
            ))}
            )
          </>
        )}{' '}
        dan <strong>tidak ditagih</strong>. Tidak perlu tindakan apa-apa.
      </p>
    </div>
  )
}
