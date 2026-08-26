'use client';

import { formatWIB } from '@petshop/shared';

export interface POReceivingNoteItem {
  productName: string | null;
  productSku: string | null;
  uomCode: string | null;
  qtyReceived: number;
  qtyDamaged: number;
}

interface POReceivingNotePrintProps {
  poNumber: string;
  supplierName: string;
  branchName: string;
  receivedByName: string;
  receivedAt: Date;
  note: string | null;
  items: POReceivingNoteItem[];
  storeName?: string;
}

function formatDateTime(date: Date): string {
  return formatWIB(date, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function POReceivingNotePrint({
  poNumber,
  supplierName,
  branchName,
  receivedByName,
  receivedAt,
  note,
  items,
  storeName = 'HAMMIELION',
}: POReceivingNotePrintProps) {
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
              .print-container-po-receiving,
              .print-container-po-receiving * {
                visibility: visible !important;
              }
              .print-container-po-receiving {
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
        className="hidden print:block fixed top-0 left-0 w-full z-[9999] bg-white text-black print-container-po-receiving"
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
            <p style={{ fontSize: '15px' }}>Purchase Order dari Supplier</p>
          </div>

          {/* Info */}
          <div style={{ marginBottom: '8px' }}>
            <p>No PO: {poNumber}</p>
            <p>Tgl: {formatDateTime(receivedAt)}</p>
            <p>Supplier: {supplierName}</p>
            <p>Cabang: {branchName}</p>
            <p>Penerima: {receivedByName}</p>
          </div>

          {/* Items */}
          <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', paddingTop: '4px', paddingBottom: '4px', marginBottom: '8px' }}>
            {items.map((item, index) => (
              <div key={index} style={{ marginBottom: '6px' }}>
                <p style={{ fontWeight: 'bold' }}>{item.productName ?? '-'}</p>
                {item.productSku && <p style={{ fontSize: '14px' }}>{item.productSku}</p>}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 'bold' }}>Terima: {item.qtyReceived} {item.uomCode}</span>
                  {item.qtyDamaged > 0 && <span>Rusak: {item.qtyDamaged} {item.uomCode}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Ringkasan */}
          <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
            <span>Total Jenis Barang</span>
            <span>{items.length}</span>
          </div>

          {note && (
            <div style={{ marginBottom: '12px' }}>
              <p style={{ fontWeight: 'bold' }}>Catatan:</p>
              <p style={{ fontStyle: 'italic' }}>{note}</p>
            </div>
          )}

          {/* Tanda tangan */}
          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <p>Penerima,</p>
            <div style={{ height: '40px' }} />
            <p>( ______________________ )</p>
          </div>

          <div style={{ textAlign: 'center', borderTop: '1px dashed #000', paddingTop: '8px', marginTop: '8px' }}>
            <p>Dokumen bukti serah-terima barang</p>
            <p>dari supplier.</p>
          </div>
        </div>
      </div>
    </>
  );
}
