import Link from 'next/link';
import { Badge, Card, EmptyState } from '@/components/ui/surface';
import { rupiah } from '../rules/salary';
import type { totalsPersonScreen } from '../server/former';

type Data = NonNullable<Awaited<ReturnType<typeof totalsPersonScreen>>>;

const money = (v: number) => <span className="tabular-nums">{rupiah(v)}</span>;

/** Rincian Total Diterima satu orang per periode (bentuk Pendapatan Saya, hanya baca). */
export function TotalsPersonScreen({ data }: { data: Data }) {
  return (
    <div className="space-y-4 text-sm">
      <p className="flex flex-wrap items-center gap-2">
        <span>{data.person.code} · Rentang {data.range.label}</span>
        {data.person.former && <Badge tone="warn">Mantan karyawan</Badge>}
      </p>
      {data.totals && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card><p className="text-ink-muted">Diterima</p><p className="text-lg font-semibold">{money(data.totals.received)}</p></Card>
          <Card><p className="text-ink-muted">Belum dibayar</p><p className="text-lg font-semibold">{money(data.totals.pending)}</p></Card>
          <Card><p className="text-ink-muted">Jumlah</p><p className="text-lg font-semibold">{money(data.totals.total)}</p></Card>
        </div>
      )}
      {!data.periods.length && <Card><EmptyState title="Tidak ada slip tertutup atau bayar di luar slip di rentang ini." /></Card>}
      {data.periods.map((p) => (
        <Card key={p.start} className="space-y-2">
          <p className="font-medium">Periode {p.label}</p>
          <ul className="divide-y divide-line">
            {p.slips.map((s) => (
              <li key={`s${s.id}`} className="flex flex-wrap justify-between gap-2 py-1.5">
                <span>
                  Slip bulanan <Link className="underline" href={`/gaji/slip/${s.id}`}>{s.number ?? '-'}</Link> · {s.branchName}
                </span>
                <span className="flex items-center gap-2">{money(s.net)} <Badge tone={s.paid ? 'ok' : 'warn'}>{s.paid ? 'Dibayar' : 'Belum dibayar'}</Badge></span>
              </li>
            ))}
            {p.claims.map((c) => (
              <li key={`c${c.id}`} className="flex flex-wrap justify-between gap-2 py-1.5">
                <span>Bayar di luar slip: {c.label}</span>
                <span className="flex items-center gap-2">{money(c.amount)} <Badge tone={c.paid ? 'ok' : 'warn'}>{c.paid ? 'Dibayar' : 'Belum dibayar'}</Badge></span>
              </li>
            ))}
          </ul>
          {p.totals && (
            <p className="flex flex-wrap gap-x-4 text-ink-muted">
              <span>Diterima {money(p.totals.received)}</span>
              <span>Belum dibayar {money(p.totals.pending)}</span>
              <span>Jumlah <b className="text-ink">{money(p.totals.total)}</b></span>
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}
