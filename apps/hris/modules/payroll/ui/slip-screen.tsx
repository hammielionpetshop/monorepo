import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';
import { Alert, Card } from '@/components/ui/surface';
import type { SlipView } from '../server/payslip';
import type { SlipHold } from '../rules/payslip';
import { SlipDocument } from './slip-document';

const timeFormat = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });

/** GAJ-L29 Slip: bentuk slip, kotak penahan, dan tombol menurut keadaan. */
export function SlipScreen({ slip, holds, window: win, computedAt, can, closeBlocked }: {
  slip: SlipView; holds: SlipHold[]; window: { opensText: string; testMode: boolean }; computedAt: string;
  can: { close: boolean; print: boolean }; closeBlocked: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Link className={buttonClass({ variant: 'ghost' })} href={`/gaji/periode/${slip.period.start}`}>Kembali ke periode</Link>
        {can.close && <Link className={buttonClass({})} href={`/gaji/periode/${slip.period.start}/tutup?slip=${slip.slipId}`}>Tutup slip</Link>}
        {can.print && <Link className={buttonClass({ variant: 'secondary' })} href={`/gaji/slip/${slip.slipId}/cetak`} target="_blank">Cetak</Link>}
        <Link className={buttonClass({ variant: 'ghost' })} href={`/gaji/${slip.employeeId}`}>Gaji {slip.name}</Link>
      </div>
      {slip.status === 'ESTIMATE' && closeBlocked && !holds.length && <Alert tone="info">{closeBlocked}</Alert>}
      {win.testMode && slip.status === 'ESTIMATE' && <Alert tone="warn">Mode uji staging: Tutup boleh sebelum {win.opensText}.</Alert>}
      {holds.length > 0 && (
        <Alert tone="warn" title="Slip ini tertahan">
          <ul className="mt-1 space-y-1">
            {holds.map((h) => (
              <li key={h.kind}>{h.text} · penyelesai {h.resolver} · <Link className="underline" href={h.link}>Buka urusannya</Link></li>
            ))}
          </ul>
          <p className="mt-1">Tidak ada tutup paksa: slip ditutup begitu urusannya diputuskan.</p>
        </Alert>
      )}
      <Card>
        {slip.status === 'ESTIMATE' && <p className="mb-3 text-xs text-ink-muted">Perkiraan dihitung pukul {timeFormat.format(new Date(computedAt))}.</p>}
        <SlipDocument slip={slip} />
      </Card>
    </div>
  );
}
