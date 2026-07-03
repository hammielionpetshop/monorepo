'use client'

import { formatWIB } from '@petshop/shared'

export interface ReceivingNoteItem {
  productName: string | null
  productSku: string | null
  uomCode: string | null
  qtyShipped: number
  qtyReceived: number
  notes: string | null
}

interface ReceivingNotePrintProps {
  ibtNumber: string
  sourceBranchName: string | null
  destinationBranchName: string
  receivedByName: string
  receivedAt: Date
  items: ReceivingNoteItem[]
  storeName?: string
  isReprint?: boolean
}

function formatDateTime(date: Date): string {
  return formatWIB(date, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ReceivingNotePrint({
  ibtNumber,
  sourceBranchName,
  destinationBranchName,
  receivedByName,
  receivedAt,
  items,
  storeName = 'HAMMIELION',
  isReprint = false,
}: ReceivingNotePrintProps) {
  const receivedItems = items.filter((i) => i.qtyReceived > 0)

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @page {
              size: 80mm auto;
              margin: 3mm;
            }
            @media print {
              body * {
                visibility: hidden !important;
              }
              .print-container-receiving,
              .print-container-receiving * {
                visibility: visible !important;
              }
              .print-container-receiving {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                background: white !important;
                color: black !important;
                padding: 0 !important;
              }
            }
          `,
        }}
      />
      <div
        className="hidden print:block fixed top-0 left-0 w-full z-[9999] bg-white text-black print-container-receiving"
        style={{
          fontFamily: '"Arial Narrow", "Liberation Sans Narrow", Arial, Helvetica, sans-serif',
          fontSize: '17px',
          lineHeight: 1.25,
          letterSpacing: '-0.4px',
          padding: '0 4mm',
        }}
      >
        <div>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <p style={{ fontWeight: 'bold', fontSize: '21px' }}>{storeName}</p>
            <p style={{ borderTop: '1px dashed #000', marginTop: '4px', paddingTop: '4px', fontWeight: 'bold' }}>
              BUKTI PENERIMAAN BARANG
            </p>
            <p style={{ fontSize: '15px' }}>Transfer Internal Antar-Cabang</p>
            {isReprint && (
              <p style={{ fontWeight: 'bold', border: '1px solid #000', padding: '2px 8px', marginTop: '4px', display: 'inline-block' }}>
                *** CETAK ULANG ***
              </p>
            )}
          </div>

          {/* Info */}
          <div style={{ marginBottom: '8px' }}>
            <p>No: {ibtNumber}</p>
            <p>Tgl: {formatDateTime(receivedAt)}</p>
            <p>Dari: {sourceBranchName ?? '-'}</p>
            <p>Ke: {destinationBranchName}</p>
            <p>Penerima: {receivedByName}</p>
          </div>

          {/* Items */}
          <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', paddingTop: '4px', paddingBottom: '4px', marginBottom: '8px' }}>
            {receivedItems.map((item, index) => {
              const selisih = item.qtyShipped - item.qtyReceived
              return (
                <div key={index} style={{ marginBottom: '6px' }}>
                  <p style={{ fontWeight: 'bold' }}>{item.productName ?? '-'}</p>
                  {item.productSku && <p style={{ fontSize: '14px' }}>{item.productSku}</p>}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Kirim: {item.qtyShipped} {item.uomCode}</span>
                    <span style={{ fontWeight: 'bold' }}>Terima: {item.qtyReceived} {item.uomCode}</span>
                  </div>
                  {selisih > 0 && (
                    <div>
                      <p>Selisih: -{selisih} {item.uomCode}</p>
                      {item.notes && <p style={{ fontStyle: 'italic' }}>Alasan: {item.notes}</p>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Ringkasan */}
          <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
            <span>Total Jenis Barang</span>
            <span>{receivedItems.length}</span>
          </div>

          {/* Tanda tangan */}
          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <p>Penerima,</p>
            <div style={{ height: '40px' }} />
            <p>( ______________________ )</p>
          </div>

          <div style={{ textAlign: 'center', borderTop: '1px dashed #000', paddingTop: '8px', marginTop: '8px' }}>
            <p>Dokumen bukti serah-terima barang</p>
            <p>transfer internal.</p>
          </div>
        </div>
      </div>
    </>
  )
}
