import { PrintButton } from './print-button'
import { REASON_LABELS, STATUS_LABELS, formatDateTimeWib, formatRupiah, type SupplierReturnView } from './types'

/** Dokumen retur untuk diserahkan ke supplier/sopir — dicetak dari browser (Ctrl+P). */
export function SupplierReturnPrint({ row }: { row: SupplierReturnView }) {
  return (
    <>
    {/* Halaman ini dibuka di dalam layout (sidebar/menu) — saat dicetak hanya dokumennya yang tampil. */}
    <style
      dangerouslySetInnerHTML={{
        __html: `
          @page { size: A4; margin: 12mm; }
          @media print {
            body * { visibility: hidden !important; }
            .print-container-supplier-return, .print-container-supplier-return * { visibility: visible !important; }
            .print-container-supplier-return { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; }
          }
        `,
      }}
    />
    <div className="print-container-supplier-return mx-auto max-w-3xl bg-white p-8 text-black print:p-0">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <div className="flex items-start justify-between border-b-2 border-black pb-3">
        <div>
          <h1 className="text-xl font-bold">SURAT RETUR BARANG KE SUPPLIER</h1>
          <p className="text-sm">Hammielion Petshop · {row.branchName}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-mono text-base font-bold">{row.returnNumber}</p>
          <p>{formatDateTimeWib(row.requestedAt)}</p>
          {row.status !== 'APPROVED' && <p className="font-semibold">Status: {STATUS_LABELS[row.status]}</p>}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs uppercase text-gray-600">Kepada (Supplier)</p>
          <p className="font-semibold">{row.supplierName}</p>
          {row.supplierPhone && <p>{row.supplierPhone}</p>}
          {row.supplierAddress && <p className="whitespace-pre-line">{row.supplierAddress}</p>}
        </div>
        <div>
          <p className="text-xs uppercase text-gray-600">Keterangan</p>
          <p>PO asal: <span className="font-mono">{row.poNumber ?? '-'}</span></p>
          <p>Alasan: {REASON_LABELS[row.reason] ?? row.reason}</p>
          <p className="whitespace-pre-line">{row.notes}</p>
        </div>
      </div>

      <table className="mt-5 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-black">
            <th className="py-1.5 text-left w-8">No</th>
            <th className="py-1.5 text-left">Barang</th>
            <th className="py-1.5 text-right">Qty</th>
            <th className="py-1.5 text-right">Harga</th>
            <th className="py-1.5 text-right">Jumlah</th>
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
              <td className="py-1.5 text-right whitespace-nowrap">{formatRupiah(it.lineValue)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-black">
            <td colSpan={4} className="py-2 text-right font-semibold">Total Nilai Retur</td>
            <td className="py-2 text-right font-bold whitespace-nowrap">{formatRupiah(row.totalValue)}</td>
          </tr>
        </tfoot>
      </table>

      {row.status === 'APPROVED' && (
        <p className="mt-3 text-sm">
          Penyelesaian:{' '}
          {row.payableDeduction > 0 && <>potong tagihan {row.poNumber} {formatRupiah(row.payableDeduction)}</>}
          {row.payableDeduction > 0 && row.creditAmount > 0 && '; '}
          {row.creditAmount > 0 && <>saldo/potongan tagihan berikutnya {formatRupiah(row.creditAmount)}</>}
          .
        </p>
      )}

      <div className="mt-12 grid grid-cols-3 gap-6 text-center text-sm">
        <div>
          <p>Dibuat oleh,</p>
          <div className="mt-16 border-t border-black pt-1">{row.requestedByName}</div>
        </div>
        <div>
          <p>Disetujui,</p>
          <div className="mt-16 border-t border-black pt-1">{row.resolvedByName ?? ' '}</div>
        </div>
        <div>
          <p>Diterima (Supplier/Sopir),</p>
          <div className="mt-16 border-t border-black pt-1">&nbsp;</div>
        </div>
      </div>
    </div>
    </>
  )
}
