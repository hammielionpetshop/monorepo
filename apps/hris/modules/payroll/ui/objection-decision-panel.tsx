import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';
import { NewBadge } from '@/components/ui/new-badge';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { rupiah } from '../rules/salary';
import type { objectionDecisionPanel } from '../server/slip-objection';

type Data = NonNullable<Awaited<ReturnType<typeof objectionDecisionPanel>>>;

/** GAJ-L42 isi khas Putuskan Keberatan Slip: slip dan baris yang ditandai, keadaan slip, jalan pembetulan, Tautkan pembetulan. */
export function ObjectionDecisionPanel({ data, requestId }: { data: Data; requestId: number }) {
  return (
    <Card className="space-y-3 text-sm">
      <h3 className="flex items-center gap-2 font-semibold">Slip yang dikeberati <NewBadge feature="fitur/keberatan-slip-putuskan" /></h3>
      <p>
        <Link className="font-medium text-brand-700 underline" href={`/gaji/slip/${data.slip.id}`}>{data.slip.number ?? 'Slip Perkiraan'}</Link>
        {' '}· {data.slip.name} · periode {data.slip.period}
      </p>
      <p>Keadaan sekarang: {data.slip.state}</p>
      {data.slip.changedSince && <Alert tone="info">Keadaan slip sudah berubah sejak keberatan diajukan.</Alert>}
      {data.markedLines.length > 0 && (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {data.markedLines.map((l) => (
            <li key={l.label} className="flex justify-between gap-2 bg-warn-bg/40 px-3 py-1.5"><span>{l.label}</span><span className="tabular-nums">{rupiah(l.amount)}</span></li>
          ))}
        </ul>
      )}
      {data.state === 'APPROVED' && (
        <div className="space-y-2">
          <p className="flex flex-wrap items-center gap-2">
            Jalan pembetulan: <b>{data.fixPath}</b>
            <Badge tone={data.fixText ? 'ok' : 'warn'}>{data.fixStatus}</Badge>
            {data.waitingDays != null && <span className="text-ink-muted">sejak {data.waitingDays < 1 ? 'hari ini' : `${data.waitingDays} hari lalu`}</span>}
          </p>
          {data.fixText && <p>{data.fixText}</p>}
          {data.destinations.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.destinations.map((d) => <Link key={d.href} className={buttonClass({ variant: 'secondary' })} href={d.href}>{d.label}</Link>)}
            </div>
          )}
          {data.canLink && <Link className={buttonClass()} href={`/persetujuan/${requestId}/tautkan`}>Tautkan pembetulan</Link>}
        </div>
      )}
    </Card>
  );
}
