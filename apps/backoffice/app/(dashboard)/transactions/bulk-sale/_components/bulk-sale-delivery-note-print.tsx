'use client'

import { buildDeliveryNotePages, buildDeliveryNoteRoll, type DeliveryNoteData } from '@/lib/delivery-note-layout'

export type { DeliveryNoteItem } from '@/lib/delivery-note-layout'

// Fallback cetak browser untuk printer dot-matrix continuous 4.75" x 5.5".
// Isinya baris teks yang SAMA persis dengan jalur ESC/P (delivery-note-layout.ts),
// dirender monospace satu blok per lembar — jadi pemecahan halaman, kolom, dan
// isi tidak bisa berbeda dari cetak QZ Tray.
// - @page = ukuran form (bukan A4) agar form-feed & perforasi tidak meleset.
// - Tinggi baris 1/6" (= 6 lpi) & 8pt Courier (≈ lebar karakter 15 cpi), sama dengan ESC/P.
// - Tanpa warna/background/watermark grafis — printer impact monokrom.
//
// paper="thermal": kasir POS yang hanya punya printer termal 80mm — satu gulungan
// tanpa pemecahan lembar, 56 kolom (Font B) ≈ Courier 6.2pt di area cetak ±74mm.
const PAGE_STYLES = {
  'dot-matrix': `@media print { @page { size: 120.65mm 139.7mm; margin: 0 6mm; } }
.bulk-sale-delivery-note-print .sj-page { font-size: 8pt; line-height: 4.2333mm; }`,
  thermal: `@media print { @page { size: 80mm auto; margin: 3mm; } }
.bulk-sale-delivery-note-print .sj-page { font-size: 6.2pt; line-height: 1.3; }`,
}

const PRINT_STYLES = `
@media print {
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
  white-space: pre;
  break-after: page;
  page-break-after: always;
}
.bulk-sale-delivery-note-print .sj-page:last-child { break-after: auto; page-break-after: auto; }
.bulk-sale-delivery-note-print .sj-bold { font-weight: bold; }
`

type BulkSaleDeliveryNotePrintProps = DeliveryNoteData & { paper?: 'dot-matrix' | 'thermal' }

export default function BulkSaleDeliveryNotePrint({ paper = 'dot-matrix', ...data }: BulkSaleDeliveryNotePrintProps) {
  const pages = paper === 'thermal' ? [buildDeliveryNoteRoll(data)] : buildDeliveryNotePages(data)

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES + PAGE_STYLES[paper] }} />
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
