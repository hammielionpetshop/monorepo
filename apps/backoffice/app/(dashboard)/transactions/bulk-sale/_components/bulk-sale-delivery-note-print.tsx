'use client'

import { buildDeliveryNotePages, type DeliveryNoteData } from '@/lib/delivery-note-layout'

export type { DeliveryNoteItem } from '@/lib/delivery-note-layout'

// Fallback cetak browser untuk printer dot-matrix continuous 9.5" x 5.5".
// Isinya baris teks yang SAMA persis dengan jalur ESC/P (delivery-note-layout.ts),
// dirender monospace satu blok per lembar — jadi pemecahan halaman, kolom, dan
// isi tidak bisa berbeda dari cetak QZ Tray.
// - @page = ukuran form (bukan A4) agar form-feed & perforasi tidak meleset.
// - Tinggi baris 1/6" (= 6 lpi, sama dengan ESC/P) sehingga 33 baris tepat 1 lembar.
// - Tanpa warna/background/watermark grafis — printer impact monokrom.
const PRINT_STYLES = `
@media print {
  @page { size: 241mm 139.7mm; margin: 0 8mm; }
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
.bulk-sale-delivery-note-print { display: none; color: #000; }
.bulk-sale-delivery-note-print .sj-page {
  margin: 0;
  font-family: 'Courier New', Courier, monospace;
  font-size: 10pt;
  line-height: 4.2333mm;
  white-space: pre;
  break-after: page;
  page-break-after: always;
}
.bulk-sale-delivery-note-print .sj-page:last-child { break-after: auto; page-break-after: auto; }
.bulk-sale-delivery-note-print .sj-bold { font-weight: bold; }
`

export default function BulkSaleDeliveryNotePrint(props: DeliveryNoteData) {
  const pages = buildDeliveryNotePages(props)

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />
      <div id="bulk-sale-delivery-note-print" className="bulk-sale-delivery-note-print">
        {pages.map((page, pageIndex) => (
          <div key={pageIndex} className="sj-page">
            {page.map((line, lineIndex) => (
              <div key={lineIndex} className={line.bold ? 'sj-bold' : undefined}>
                {line.text || ' '}
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
