import { PrintButton } from '@/components/supplier-returns/print-button'
import { formatDateTimeWib, formatRupiah } from '@/components/supplier-returns/types'
import {
  INTERNAL_KIND_LABELS,
  INTERNAL_REASON_LABELS,
  INTERNAL_STATUS_LABELS,
  isPriceRevision,
  revisionValueLabel,
  type InternalReturnView,
} from './types'

/**
 * Dokumen retur internal — dicetak dari browser (Ctrl+P). "Barang Dikembalikan" menyertai barang
 * yang kembali ke cabang pengirim; "Revisi Harga Beli" jadi bukti harga lama → harga baru.
 */
export function InternalReturnPrint({ row }: { row: InternalReturnView }) {
  const price = isPriceRevision(row)
  const decided = row.status === 'APPROVED' || row.status === 'CANCELLED'
  return (
    <>
    {/* Halaman ini dibuka di dalam layout (sidebar/menu) — saat dicetak hanya dokumennya yang tampil. */}
    <style
      dangerouslySetInnerHTML={{
        __html: `
          @page { size: A4; margin: 12mm; }
          @media print {
            body * { visibility: hidden !important; }
            .print-container-internal-return, .print-container-internal-return * { visibility: visible !important; }
            .print-container-internal-return { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; }
          }
        `,
      }}
    />
    <div className="print-container-internal-return mx-auto max-w-3xl bg-white p-8 text-black print:p-0">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <div className="flex items-start justify-between border-b-2 border-black pb-3">
        <div>
          <h1 className="text-xl font-bold">{price ? 'SURAT REVISI HARGA BELI' : 'SURAT RETUR INTERNAL'}</h1>
          <p className="text-sm font-semibold">{INTERNAL_KIND_LABELS[row.kind] ?? row.kind}</p>
          <p className="text-sm">Hammielion Petshop</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-mono text-base font-bold">{row.returnNumber}</p>
          <p>{formatDateTimeWib(row.requestedAt)}</p>
          {row.status !== 'APPROVED' && <p className="font-semibold">Status: {INTERNAL_STATUS_LABELS[row.status]}</p>}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs uppercase text-gray-600">{price ? 'Cabang penerima kiriman' : 'Dikembalikan oleh (cabang penerima)'}</p>
          <p className="font-semibold">{row.receiverBranchName}</p>
          <p className="mt-2 text-xs uppercase text-gray-600">{price ? 'Cabang pengirim' : 'Kembali ke (cabang pengirim)'}</p>
          <p className="font-semibold">{row.senderBranchName}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-gray-600">Keterangan</p>
          <p>Transfer asal: <span className="font-mono">{row.ibtNumber}</span></p>
          <p>Nota Bulk Sale: <span className="font-mono">{row.saleTrxNumber}</span></p>
          <p>Alasan: {INTERNAL_REASON_LABELS[row.reason] ?? row.reason}</p>
          <p className="whitespace-pre-line">{row.notes}</p>
        </div>
      </div>

      <table className="mt-5 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-black">
            <th className="py-1.5 text-left w-8">No</th>
            <th className="py-1.5 text-left">Barang</th>
            <th className="py-1.5 text-right">Qty</th>
            <th className="py-1.5 text-right">{price ? 'Harga Lama' : 'Harga Nota'}</th>
            {price && <th className="py-1.5 text-right">{decided ? 'Harga Baru' : 'Harga Usulan'}</th>}
            <th className="py-1.5 text-right">{price ? 'Tagihan' : 'Jumlah'}</th>
          </tr>
        </thead>
        <tbody>
          {row.items.map((it, i) => (
            <tr key={it.id} className="border-b border-gray-300">
              <td className="py-1.5">{i + 1}</td>
              <td className="py-1.5">
                {it.productName}
                {it.productSku && <span className="text-xs text-gray-600"> ({it.productSku})</span>}
              </td>
              <td className="py-1.5 text-right whitespace-nowrap">{it.qty} {it.uomCode}</td>
              <td className="py-1.5 text-right whitespace-nowrap">{formatRupiah(it.unitPrice)}</td>
              {price && (
                <td className="py-1.5 text-right whitespace-nowrap">
                  {formatRupiah(it.finalUnitPrice ?? it.proposedUnitPrice ?? 0)}
                  {it.finalUnitPrice != null && it.proposedUnitPrice != null && it.proposedUnitPrice !== it.finalUnitPrice && (
                    <span className="block text-xs text-gray-600">usulan {formatRupiah(it.proposedUnitPrice)}</span>
                  )}
                </td>
              )}
              <td className="py-1.5 text-right whitespace-nowrap">{price ? revisionValueLabel(it.lineValue) : formatRupiah(it.lineValue)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-black">
            <td colSpan={price ? 5 : 4} className="py-2 text-right font-semibold">
              {price ? 'Perubahan Tagihan Kiriman' : 'Total Nilai Retur'}
            </td>
            <td className="py-2 text-right font-bold whitespace-nowrap">
              {price ? revisionValueLabel(row.totalValue) : formatRupiah(row.totalValue)}
            </td>
          </tr>
        </tfoot>
      </table>

      {row.status === 'APPROVED' && (
        <p className="mt-3 text-sm">
          Penyelesaian:{' '}
          {[
            row.payableDeduction > 0 && `potong hutang internal ${row.ibtNumber} ${formatRupiah(row.payableDeduction)}`,
            row.payableDeduction < 0 && `tagihan internal ${row.ibtNumber} bertambah ${formatRupiah(-row.payableDeduction)}`,
            row.creditAmount > 0 && `Saldo Internal ${row.receiverBranchName} di ${row.senderBranchName} ${formatRupiah(row.creditAmount)}`,
            price && row.cogsAdjustment !== 0 && `modal barang yang sudah terjual di ${row.receiverBranchName} dikoreksi ${revisionValueLabel(row.cogsAdjustment)}`,
          ].filter(Boolean).join('; ') || '-'}
          .
        </p>
      )}
      {row.status === 'REJECTED' && row.rejectionReason && (
        <p className="mt-3 text-sm font-semibold">
          DITOLAK — alasan: {row.rejectionReason}. {price ? 'Harga, modal' : 'Stok'} dan hutang internal tidak berubah.
        </p>
      )}
      {row.status === 'CANCELLED' && (
        <p className="mt-3 text-sm font-semibold">
          DIBATALKAN{row.cancelledByName ? ` oleh ${row.cancelledByName}` : ''}
          {row.cancelledAt ? `, ${formatDateTimeWib(row.cancelledAt)}` : ''} — alasan: {row.cancellationReason}.{' '}
          {price ? 'Modal stok, tagihan' : 'Stok, potongan hutang'} internal, dan saldo internal dari dokumen ini sudah dibalik.
        </p>
      )}

      <div className="mt-12 grid grid-cols-3 gap-6 text-center text-sm">
        <div>
          <p>Dibuat oleh,</p>
          <div className="mt-16 border-t border-black pt-1">{row.requestedByName}</div>
        </div>
        <div>
          <p>Disetujui,</p>
          <div className="mt-16 border-t border-black pt-1">{decided ? (row.resolvedByName ?? ' ') : ' '}</div>
        </div>
        <div>
          <p>{price ? 'Mengetahui' : 'Diterima'} ({row.senderBranchName}),</p>
          <div className="mt-16 border-t border-black pt-1">&nbsp;</div>
        </div>
      </div>
    </div>
    </>
  )
}
