'use client'

// Hanya field yang benar-benar dicetak — sengaja lebih sempit dari BulkSaleRow agar
// komponen ini bisa dipakai ulang dari detail transaksi (reprint) tanpa membawa
// seluruh state baris form bulk sale. BulkSaleRow tetap kompatibel (superset).
export type DeliveryNoteItem = {
  id: string | number
  productCode: string
  productName: string
  uomCode: string
  qty: number
}

type BulkSaleDeliveryNotePrintProps = {
  transactionNumber: string
  transactionDate: string
  branchName: string
  customerName: string
  items: DeliveryNoteItem[]
  isVoided?: boolean
}

const PRINT_STYLES = `
@media print {
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
  @page {
    size: A4;
    margin: 12mm 14mm;
  }
}
.bulk-sale-delivery-note-print {
  display: none;
  position: relative;
  font-family: 'Courier New', Courier, monospace;
  font-size: 11pt;
  color: #000;
  line-height: 1.4;
}
.bulk-sale-delivery-note-print .sj-watermark {
  position: absolute;
  top: 42%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-28deg);
  font-size: 110pt;
  font-weight: bold;
  letter-spacing: 10pt;
  color: rgba(200, 0, 0, 0.16);
  border: 8pt solid rgba(200, 0, 0, 0.16);
  padding: 6pt 36pt;
  border-radius: 10pt;
  white-space: nowrap;
  pointer-events: none;
  z-index: 9999;
}
.bulk-sale-delivery-note-print .sj-void-badge {
  display: inline-block;
  margin-top: 4pt;
  padding: 2pt 10pt;
  border: 2pt solid #c00000;
  color: #c00000;
  font-weight: bold;
  font-size: 11pt;
  letter-spacing: 2px;
}
.bulk-sale-delivery-note-print .sj-header {
  text-align: center;
  border-bottom: 2px solid #000;
  padding-bottom: 6pt;
  margin-bottom: 8pt;
}
.bulk-sale-delivery-note-print .sj-title {
  font-size: 16pt;
  font-weight: bold;
  letter-spacing: 2px;
}
.bulk-sale-delivery-note-print .sj-subtitle { font-size: 10pt; }
.bulk-sale-delivery-note-print .sj-meta {
  display: flex;
  justify-content: space-between;
  gap: 16pt;
  margin-bottom: 8pt;
  font-size: 10pt;
}
.bulk-sale-delivery-note-print .sj-section {
  border: 1px solid #000;
  padding: 6pt 8pt;
  margin-bottom: 8pt;
  display: flex;
  gap: 24pt;
}
.bulk-sale-delivery-note-print .sj-field { flex: 1; }
.bulk-sale-delivery-note-print .sj-label { font-size: 9pt; text-transform: uppercase; }
.bulk-sale-delivery-note-print .sj-value { font-weight: bold; font-size: 11pt; }
.bulk-sale-delivery-note-print table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 12pt;
  font-size: 10pt;
}
.bulk-sale-delivery-note-print table th {
  border: 1px solid #000;
  padding: 4pt 6pt;
  text-align: left;
  background: #f0f0f0;
  font-size: 9pt;
  text-transform: uppercase;
}
.bulk-sale-delivery-note-print table td {
  border: 1px solid #000;
  padding: 4pt 6pt;
}
.bulk-sale-delivery-note-print table td.right { text-align: right; }
.bulk-sale-delivery-note-print .sj-signatures {
  display: flex;
  gap: 8pt;
  margin-top: 12pt;
}
.bulk-sale-delivery-note-print .sj-sig {
  flex: 1;
  border: 1px solid #000;
  padding: 6pt 8pt;
  text-align: center;
}
.bulk-sale-delivery-note-print .sj-sig-title { font-size: 9pt; font-weight: bold; text-transform: uppercase; }
.bulk-sale-delivery-note-print .sj-sig-space { height: 44pt; }
.bulk-sale-delivery-note-print .sj-sig-name { border-top: 1px solid #000; padding-top: 4pt; font-size: 9pt; }
`

export default function BulkSaleDeliveryNotePrint({
  transactionNumber,
  transactionDate,
  branchName,
  customerName,
  items,
  isVoided = false,
}: BulkSaleDeliveryNotePrintProps) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />
      <div id="bulk-sale-delivery-note-print" className="bulk-sale-delivery-note-print">
        {isVoided && <div className="sj-watermark">VOID</div>}
        <div className="sj-header">
          <div className="sj-title">SURAT JALAN</div>
          <div className="sj-subtitle">Bulk Sale Hammielion</div>
          {isVoided && <div className="sj-void-badge">*** BATAL / VOID ***</div>}
        </div>

        <div className="sj-meta">
          <div>
            <span>No. Transaksi: </span>
            <strong>{transactionNumber}</strong>
          </div>
          <div>
            <span>Tanggal: </span>
            <strong>{transactionDate}</strong>
          </div>
        </div>

        <div className="sj-section">
          <div className="sj-field">
            <div className="sj-label">Cabang</div>
            <div className="sj-value">{branchName}</div>
          </div>
          <div className="sj-field">
            <div className="sj-label">Customer</div>
            <div className="sj-value">{customerName}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style={{ width: '28pt' }}>No</th>
              <th style={{ width: '70pt' }}>Kode</th>
              <th>Nama Produk</th>
              <th style={{ width: '42pt' }}>UOM</th>
              <th className="right" style={{ width: '48pt' }}>Qty</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id}>
                <td>{index + 1}</td>
                <td style={{ fontFamily: 'monospace' }}>{item.productCode}</td>
                <td>{item.productName}</td>
                <td>{item.uomCode}</td>
                <td className="right">{item.qty.toLocaleString('id-ID')}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="sj-signatures">
          <div className="sj-sig">
            <div className="sj-sig-title">Disiapkan Oleh</div>
            <div className="sj-sig-space" />
            <div className="sj-sig-name">( _________________________ )</div>
          </div>
          <div className="sj-sig">
            <div className="sj-sig-title">Pengantar</div>
            <div className="sj-sig-space" />
            <div className="sj-sig-name">( _________________________ )</div>
          </div>
          <div className="sj-sig">
            <div className="sj-sig-title">Penerima</div>
            <div className="sj-sig-space" />
            <div className="sj-sig-name">( _________________________ )</div>
          </div>
        </div>
      </div>
    </>
  )
}
