import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';
import { NewBadge } from '@/components/ui/new-badge';
import { Alert, Badge, Card } from '@/components/ui/surface';
import type { mySlipScreen } from '../server/my-pay';
import { PayIssuesBox } from './my-pay-screen';
import { SlipDocument } from './slip-document';

type Data = NonNullable<Awaited<ReturnType<typeof mySlipScreen>>>;

const timeFormat = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });

/** GAJ-L40 Slip Saya: bentuk slip yang sama dengan kantor, keadaan dan status bayar dari sisi karyawan. */
export function MySlipScreen({ data }: { data: Data }) {
  const back = `/pendapatan?periode=${data.view.period.start}`;
  if (data.old) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Link className={buttonClass({ variant: 'ghost' })} href={`/pendapatan/slip/${data.view.slipId}`}>Kembali ke versi terbaru</Link>
        </div>
        <Alert tone="info">Versi {data.view.version} (lama, hanya baca). Versi berlaku sekarang: {data.current}.</Alert>
        <Card><SlipDocument slip={data.view} self /></Card>
      </div>
    );
  }
  const estimate = data.view.status === 'ESTIMATE';
  const tone = data.state.key === 'PAID' || data.state.key === 'NO_MONEY' ? 'ok' : data.state.key === 'LATE' || data.state.key === 'HELD' || data.state.key === 'REOPENED' ? 'warn' : 'info';
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link className={buttonClass({ variant: 'ghost' })} href={back}>Kembali ke Pendapatan Saya</Link>
        {data.canDownload && <Link className={buttonClass({ variant: 'secondary' })} href={`/pendapatan/slip/${data.view.slipId}/cetak`} target="_blank">Unduh PDF</Link>}
      </div>
      {estimate && <PayIssuesBox issues={data.issues} consequence={data.consequence} />}
      <Card className="space-y-1 text-sm">
        <p className="flex items-center gap-2 font-medium">Keadaan <Badge tone={tone}>{data.state.label}</Badge></p>
        <p>{data.state.text}</p>
        {data.cancelled.map((c) => <p key={c.text} className="text-ink-muted">{c.text}</p>)}
      </Card>
      {estimate && (
        <Alert tone="warn" title="Perkiraan, belum final">
          Angka bisa berubah sampai slip ditutup. Dihitung pukul {timeFormat.format(new Date(data.computedAt))}. Perkiraan tidak bisa diunduh.
        </Alert>
      )}
      <Card><SlipDocument slip={data.view} self /></Card>
      {data.versions.length > 0 && (
        <Card className="space-y-1 text-sm">
          <p className="font-medium">Versi lama</p>
          <ul className="flex flex-wrap gap-2">
            {data.versions.map((v) => (
              <li key={v}><Link className="underline" href={`/pendapatan/slip/${data.view.slipId}?versi=${v}`}>Lihat versi {v}</Link></li>
            ))}
          </ul>
        </Card>
      )}
      <ObjectionCard data={data.objections} slipId={data.view.slipId} />
    </div>
  );
}

/** Tombol keberatan slip + status keberatan yang pernah diajukan (spec L4g §3.5–3.6). */
function ObjectionCard({ data, slipId }: { data: Extract<Data, { old: false }>['objections']; slipId: number }) {
  return (
    <Card className="space-y-3 text-sm">
      <p className="flex items-center gap-2 font-medium">Keberatan slip <NewBadge feature="fitur/keberatan-slip" /></p>
      {data.options.map((o) => (
        <div key={o.kind} className="space-y-1">
          {o.open ? (
            <>
              <Link className={buttonClass({ variant: 'secondary' })} href={`/pendapatan/slip/${slipId}/keberatan?macam=${o.kind}`}>{o.label}</Link>
              <p className="text-xs text-ink-muted">Bisa diajukan {o.until ? `sampai ${o.until}` : 'selama slip masih Perkiraan, lalu sampai 3 hari sesudah ditutup'}.</p>
            </>
          ) : o.pendingRequestId ? (
            <p>{o.label}: menunggu keputusan. <Link className="underline" href={`/pengajuan/${o.pendingRequestId}`}>Lihat</Link></p>
          ) : (
            <p className="text-xs text-ink-muted">{o.reason}</p>
          )}
        </div>
      ))}
      {data.list.length > 0 && (
        <ul className="divide-y divide-line">
          {data.list.map((x) => (
            <li key={x.requestId} className="py-2">
              <p><Link className="font-medium underline" href={`/pengajuan/${x.requestId}`}>{x.kind}</Link> · {x.state} · {x.at}</p>
              {x.decisionReason && <p className="text-ink-muted">Alasan ditolak: {x.decisionReason}</p>}
              {x.fix && <p>{x.fix}</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
