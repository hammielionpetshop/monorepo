'use client'

import { formatTonaseLine } from '@/lib/delivery-note-weight'

// Hanya field yang benar-benar dicetak — sengaja lebih sempit dari BulkSaleRow agar
// komponen ini bisa dipakai ulang dari detail transaksi (reprint) tanpa membawa
// seluruh state baris form bulk sale. BulkSaleRow tetap kompatibel (superset).
// unitPrice/subtotal opsional: hanya dipakai saat withPrice=true.
export type DeliveryNoteItem = {
  id: string | number
  productCode: string
  productName: string
  uomCode: string
  qty: number
  unitPrice?: number
  subtotal?: number
  // Berat 1 unit UOM baris ini (gram) — sudah diselesaikan lewat resolveUomWeightGram.
  // null/undefined = produk belum punya data berat; baris itu tidak ikut dihitung tonase.
  weightGram?: number | null
}

type BulkSaleDeliveryNotePrintProps = {
  transactionNumber: string
  transactionDate: string
  branchName: string
  customerName: string
  staffName?: string
  items: DeliveryNoteItem[]
  isVoided?: boolean
  withPrice?: boolean
  grandTotal?: number
}

// Label toko dicetak hardcode di header nota (bukan nama cabang).
const STORE_LABEL = 'HAMMIELION'

// Layout khusus continuous form dot-matrix 9.5" x 11" (80 kolom):
// - @page diset ke ukuran form (bukan A4) agar form-feed & perforasi tidak meleset.
// - Monospace, TANPA warna/background/shading/watermark grafis — printer impact
//   itu monokrom & lambat di mode grafis; warna semi-transparan malah bisa
//   tercetak hitam menimpa teks. Penanda VOID = teks polos.
// - Border minimal (garis horizontal saja), tanpa rule vertikal, biar cepat & rapi.
const PRINT_STYLES = `
@media print {
  @page { size: 241mm 279mm; margin: 6mm 8mm; }
  body * { visibility: hidden !important; }
  .bulk-sale-delivery-note-print,
  .bulk-sale-delivery-note-print * { visibility: visible !important; }
  .bulk-sale-delivery-note-print {
    display: block !important;
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    background: #fff !important;
    color: #000 !important;
  }
}
.bulk-sale-delivery-note-print {
  display: none;
  font-family: 'Courier New', Courier, monospace;
  font-size: 11pt;
  line-height: 1.3;
  color: #000;
}
.bulk-sale-delivery-note-print .sj-title {
  text-align: center; font-weight: bold; font-size: 13pt; letter-spacing: 3px;
}
.bulk-sale-delivery-note-print .sj-sub { text-align: center; font-size: 10pt; }
.bulk-sale-delivery-note-print .sj-void {
  text-align: center; font-weight: bold; font-size: 12pt; letter-spacing: 2px;
  border: 2pt solid #000; padding: 3pt 0; margin: 5pt 0 3pt;
}
.bulk-sale-delivery-note-print .sj-rule { border-top: 1px solid #000; margin: 4pt 0; }
.bulk-sale-delivery-note-print .sj-meta {
  display: flex; justify-content: space-between; font-size: 10pt;
}
.bulk-sale-delivery-note-print .sj-info { font-size: 10pt; margin-top: 2pt; }
.bulk-sale-delivery-note-print table {
  width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10pt; margin: 4pt 0;
}
.bulk-sale-delivery-note-print th {
  text-align: left; border-top: 1px solid #000; border-bottom: 1px solid #000;
  padding: 2pt 4pt; font-weight: bold;
}
.bulk-sale-delivery-note-print td { padding: 1pt 4pt; vertical-align: top; word-break: break-word; }
.bulk-sale-delivery-note-print td.r, .bulk-sale-delivery-note-print th.r { text-align: right; }
.bulk-sale-delivery-note-print .sj-total {
  text-align: right; font-weight: bold; font-size: 11pt;
  border-top: 1px solid #000; padding-top: 3pt; margin-top: 2pt;
}
.bulk-sale-delivery-note-print .sj-sign { display: flex; gap: 24pt; margin-top: 22pt; font-size: 10pt; }
.bulk-sale-delivery-note-print .sj-sign > div { flex: 1; text-align: center; }
.bulk-sale-delivery-note-print .sj-sign-line { margin-top: 40pt; }
`

export default function BulkSaleDeliveryNotePrint({
  transactionNumber,
  transactionDate,
  customerName,
  staffName,
  items,
  isVoided = false,
  withPrice = false,
  grandTotal,
}: BulkSaleDeliveryNotePrintProps) {
  const fmt = (value: number) => value.toLocaleString('id-ID')
  const tonaseLine = formatTonaseLine(items)

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />
      <div id="bulk-sale-delivery-note-print" className="bulk-sale-delivery-note-print">
        <div className="sj-title">{STORE_LABEL}</div>
        <div className="sj-sub">NOTA PENJUALAN</div>
        {isVoided && <div className="sj-void">*** BATAL / VOID ***</div>}

        <div className="sj-rule" />
        <div className="sj-meta">
          <div>No: <strong>{transactionNumber}</strong></div>
          <div>Tanggal: <strong>{transactionDate}</strong></div>
        </div>
        <div className="sj-info">Kepada: <strong>{customerName}</strong></div>
        {staffName && <div className="sj-info">Staf: <strong>{staffName}</strong></div>}
        <div className="sj-rule" />

        <table>
          <colgroup>
            <col style={{ width: '3ch' }} />
            <col />
            <col style={{ width: withPrice ? '5ch' : '6ch' }} />
            <col style={{ width: withPrice ? '6ch' : '8ch' }} />
            {withPrice && <col style={{ width: '12ch' }} />}
            {withPrice && <col style={{ width: '13ch' }} />}
          </colgroup>
          <thead>
            <tr>
              <th>No</th>
              <th>Nama Produk</th>
              <th>UOM</th>
              <th className="r">Qty</th>
              {withPrice && <th className="r">Harga</th>}
              {withPrice && <th className="r">Subtotal</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id}>
                <td>{index + 1}</td>
                <td>{item.productName}</td>
                <td>{item.uomCode}</td>
                <td className="r">{fmt(item.qty)}</td>
                {withPrice && <td className="r">{item.unitPrice != null ? fmt(item.unitPrice) : '-'}</td>}
                {withPrice && <td className="r">{item.subtotal != null ? fmt(item.subtotal) : '-'}</td>}
              </tr>
            ))}
          </tbody>
        </table>

        {tonaseLine && <div className="sj-total">{tonaseLine}</div>}

        {withPrice && grandTotal != null && (
          <div className="sj-total">TOTAL: Rp {fmt(grandTotal)}</div>
        )}

        <div className="sj-sign">
          <div>Disiapkan<div className="sj-sign-line">( _______________ )</div></div>
          <div>Pengantar<div className="sj-sign-line">( _______________ )</div></div>
          <div>Penerima<div className="sj-sign-line">( _______________ )</div></div>
        </div>
      </div>
    </>
  )
}
