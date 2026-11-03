import type { SlipView } from '../server/payslip';
import { PrintSlipButton } from './print-slip-button';
import { SlipDocument } from './slip-document';

/** GAJ-L32 Cetakan Slip: A4 tegak, satu slip satu lembar; "Simpan sebagai PDF" dari jendela cetak browser (spec L4e §9 butir 4). */
export function SlipPrint({ slips, printedAt }: { slips: SlipView[]; printedAt: string }) {
  return (
    <div className="mx-auto max-w-[210mm] bg-white text-black">
      <style>{'@page { size: A4 portrait; margin: 14mm; } @media print { .slip-sheet { break-after: page; } .slip-sheet:last-child { break-after: auto; } }'}</style>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="text-sm">{slips.length} slip · pilih &ldquo;Simpan sebagai PDF&rdquo; di jendela cetak untuk mengunduh.</p>
        <PrintSlipButton />
      </div>
      {slips.map((s) => (
        <section key={s.slipId} className="slip-sheet mb-8 border border-line p-6 print:mb-0 print:border-0 print:p-0">
          <SlipDocument slip={s} printing />
          <p className="mt-6 text-xs">Dicetak {printedAt} · versi {s.version}</p>
        </section>
      ))}
    </div>
  );
}
