'use client'

import { groomingTicketLines, type GroomingTicketData } from '@/lib/escpos-grooming-ticket'

/**
 * Jalur cadangan cetak karcis lewat `window.print()` (bila printer raw tidak tersedia).
 * Isinya memakai baris yang sama dengan karcis termal, supaya dua jalur tidak pernah berbeda.
 * Tidak terlihat di layar — hanya muncul saat mencetak.
 */
export default function GroomingTicketPrint({ tickets }: { tickets: GroomingTicketData[] }) {
  if (tickets.length === 0) return null
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @page { size: 80mm auto; margin: 3mm; }
            @media print {
              body * { visibility: hidden !important; }
              .print-container-grooming-ticket, .print-container-grooming-ticket * { visibility: visible !important; }
              .print-container-grooming-ticket {
                position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important;
                background: white !important; color: black !important; padding: 0 !important;
              }
              .grooming-ticket-copy { page-break-after: always; break-after: page; }
            }
          `,
        }}
      />
      <div
        className="hidden print:block fixed top-0 left-0 w-full z-[9999] bg-white text-black print-container-grooming-ticket"
        style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: '11px', lineHeight: 1.3, padding: '0 3mm' }}
      >
        {tickets.flatMap((ticket) =>
          (['KONSUMEN', 'GROOMER'] as const).map((copy) => (
            <div key={`${ticket.ticketNumber}-${copy}`} className="grooming-ticket-copy">
              <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '14px' }}>{ticket.storeName}</div>
              <div style={{ textAlign: 'center', fontWeight: 700 }}>
                {copy === 'KONSUMEN' ? 'BUKTI AMBIL KUCING' : 'KARCIS GROOMER'}
              </div>
              {ticket.isReprint && <div style={{ textAlign: 'center', fontWeight: 700 }}>*** CETAK ULANG ***</div>}
              <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />
              <pre style={{ margin: 0, fontFamily: 'inherit', whiteSpace: 'pre-wrap' }}>
                {groomingTicketLines(ticket, copy).join('\n')}
              </pre>
              <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />
              <div style={{ textAlign: 'center' }}>
                {copy === 'KONSUMEN' ? 'Tunjukkan karcis ini saat mengambil kucing' : 'Bukti pengerjaan untuk groomer'}
              </div>
            </div>
          )),
        )}
      </div>
    </>
  )
}
