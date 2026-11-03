import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';
import { NewBadge } from '@/components/ui/new-badge';
import { Alert, Badge, Card } from '@/components/ui/surface';
import type { myPayScreen } from '../server/my-pay';
import type { PayIssue } from '../rules/my-pay';
import { longDate, rupiah } from '../rules/salary';

type Data = NonNullable<Awaited<ReturnType<typeof myPayScreen>>>;
export type MyPayTab = 'ringkasan' | 'upah' | 'bonus' | 'potongan' | 'hitungan';
export const MY_PAY_TABS: { key: MyPayTab; label: string }[] = [
  { key: 'ringkasan', label: 'Ringkasan' }, { key: 'upah', label: 'Upah' }, { key: 'bonus', label: 'Bonus' }, { key: 'potongan', label: 'Potongan' }, { key: 'hitungan', label: 'Hitungan' },
];

const timeFormat = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });

/** Kotak "gaji bisa mundur" (GAJ-108): tidak bisa ditutup, hilang sendiri saat urusannya selesai. */
export function PayIssuesBox({ issues, consequence }: { issues: PayIssue[]; consequence: string }) {
  if (!issues.length) return null;
  return (
    <Alert tone="warn" title="Gaji Anda bisa mundur">
      <ul className="mt-1 space-y-1">
        {issues.map((i) => (
          <li key={i.text} className="flex flex-wrap items-center gap-2">
            <Badge tone={i.who === 'YOU' ? 'danger' : 'info'}>{i.who === 'YOU' ? 'Anda' : 'Kantor'}</Badge>
            <span>{i.text}</span>
            {i.link && <Link className="underline" href={i.link}>Isi sekarang</Link>}
          </li>
        ))}
      </ul>
      <p className="mt-2">{consequence}</p>
    </Alert>
  );
}

const Empty = ({ what }: { what: string }) => <p className="text-sm text-ink-muted">Belum ada {what} di periode ini.</p>;

/** GAJ-L39 Pendapatan Saya (HP): pemilih periode, kotak peringatan, tiga angka, lima tab yang selalu tampil. */
export function MyPayScreen({ data, tab }: { data: Data; tab: MyPayTab }) {
  const base = `/pendapatan?periode=${data.period.start}`;
  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-end gap-2" method="get">
        <select name="periode" defaultValue={data.period.start} className="min-h-11 rounded-md border border-line px-3" aria-label="Periode">
          {data.periods.map((p) => <option key={p.start} value={p.start}>{p.label}</option>)}
        </select>
        <input type="hidden" name="tab" value={tab} />
        <button type="submit" className={buttonClass({ variant: 'secondary' })}>Tampilkan</button>
      </form>

      <PayIssuesBox issues={data.issues} consequence={data.consequence} />

      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 sm:p-3">
          <p className="text-xs text-ink-muted">Pendapatan periode ini{data.head.estimate ? ' (perkiraan)' : ''}</p>
          <p className="font-semibold tabular-nums">{rupiah(data.head.income)}</p>
        </Card>
        <Card className="p-3 sm:p-3">
          <p className="text-xs text-ink-muted">Sudah diterima</p>
          <p className="font-semibold tabular-nums">{rupiah(data.head.received)}</p>
        </Card>
        <Card className="p-3 sm:p-3">
          <p className="text-xs text-ink-muted">Belum diterima</p>
          <p className="font-semibold tabular-nums">{rupiah(data.head.pending)}</p>
          {data.head.pending > 0 && data.head.pendingDue && <p className="text-xs text-ink-muted">jatuh bayar {data.head.pendingDue}</p>}
        </Card>
      </div>

      <nav className="flex flex-wrap gap-1" aria-label="Tab Pendapatan Saya">
        {MY_PAY_TABS.map((t) => (
          <Link key={t.key} href={`${base}&tab=${t.key}`} className={buttonClass({ variant: tab === t.key ? 'secondary' : 'ghost', size: 'sm' })}>{t.label}</Link>
        ))}
      </nav>

      {tab === 'ringkasan' && <SummaryTab data={data} />}
      {tab === 'upah' && <UpahTab data={data} />}
      {tab === 'bonus' && <BonusTab data={data} />}
      {tab === 'potongan' && <DeductionsTab data={data} />}
      {tab === 'hitungan' && <HitunganTab data={data} />}

      {data.closedPeriods.length > 0 && <DownloadMany periods={data.closedPeriods} />}
    </div>
  );
}

function SummaryTab({ data }: { data: Data }) {
  if (!data.slip && !data.claims.length) return <Empty what="pendapatan" />;
  return (
    <div className="space-y-2">
      {data.slip && (
        <Link href={`/pendapatan/slip/${data.slip.id}`} className="block rounded-card border border-line bg-surface p-4 hover:bg-canvas">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium">Slip gaji bulanan {data.slip.number ?? ''}</p>
            <Badge tone={data.slip.state.key === 'PAID' || data.slip.state.key === 'NO_MONEY' ? 'ok' : data.slip.state.key === 'LATE' || data.slip.state.key === 'HELD' ? 'warn' : 'info'}>{data.slip.state.label}</Badge>
          </div>
          <p className="text-sm text-ink-muted">Periode {data.period.label}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{data.slip.hasSalary ? rupiah(data.slip.net) : '—'}</p>
          <p className="text-sm">{data.slip.state.text}</p>
          {data.slip.estimate && <p className="text-xs text-ink-muted">Dihitung pukul {timeFormat.format(new Date(data.computedAt))}. Ketuk untuk melihat rinciannya.</p>}
        </Link>
      )}
      {data.claims.map((c) => (
        <Card key={c.id} className="space-y-1 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium">Bayar di luar slip: {c.label}</p>
            <Badge tone={c.paymentText ? 'ok' : 'info'}>{c.status}</Badge>
          </div>
          <p className="font-semibold tabular-nums">{rupiah(c.amount)}</p>
          <p>{c.paymentText ?? 'Belum dibayar.'}</p>
        </Card>
      ))}
    </div>
  );
}

function UpahTab({ data }: { data: Data }) {
  if (!data.upah.length) return <Empty what="upah" />;
  return (
    <Card className="text-sm">
      <ul className="divide-y divide-line">
        {data.upah.map((r, i) => (
          <li key={`${r.date}-${r.label}-${i}`} className="flex flex-wrap justify-between gap-2 py-2">
            <span><span className="text-ink-muted">{longDate(r.date)}</span> · {r.label}{r.note ? <span className="text-ink-muted"> · {r.note}</span> : null}</span>
            <span className="tabular-nums">{rupiah(r.amount)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-ink-muted">Ritase dan bongkaran akan tampil di sini setelah fitur gaji driver tersedia.</p>
    </Card>
  );
}

function BonusTab({ data }: { data: Data }) {
  if (!data.bonus.length) return <Empty what="bonus" />;
  return (
    <Card className="text-sm">
      <ul className="divide-y divide-line">
        {data.bonus.map((b) => (
          <li key={b.id} className="flex flex-wrap justify-between gap-2 py-2">
            <span>
              <span className="text-ink-muted">{longDate(b.date)}</span> · {b.label}{b.note ? <span className="text-ink-muted"> · {b.note}</span> : null} <Badge tone="info">{b.status}</Badge>
            </span>
            <span className="tabular-nums">{rupiah(b.amount)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-ink-muted">Hanya bonus Disahkan yang masuk slip.</p>
    </Card>
  );
}

function DeductionsTab({ data }: { data: Data }) {
  if (!data.potongan.length) return <Empty what="potongan" />;
  return (
    <Card className="space-y-2 text-sm">
      <table className="w-full">
        <thead><tr className="text-left text-xs text-ink-muted"><th>Potongan</th><th className="text-right">Nominal</th><th className="text-right">Terpotong</th><th className="text-right">Sisa</th></tr></thead>
        <tbody>
          {data.potongan.map((d) => (
            <tr key={d.key} className="align-top">
              <td className="py-1">
                {d.label}
                {d.objectionLink && (
                  <> · <Link className="underline" href={d.objectionLink}>Ajukan keberatan</Link></>
                )}
              </td>
              <td className="py-1 text-right tabular-nums">{rupiah(d.amount)}</td>
              <td className="py-1 text-right tabular-nums">{rupiah(d.taken)}</td>
              <td className="py-1 text-right tabular-nums">{d.remaining ? rupiah(d.remaining) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.potonganTotals && (
        <p className="border-t border-line pt-2 font-medium">Jumlah terpotong <span className="tabular-nums">{rupiah(data.potonganTotals.taken)}</span>
          {data.potonganTotals.carried > 0 ? <span className="font-normal text-ink-muted"> · sisa {rupiah(data.potonganTotals.carried)} dibawa ke slip berikutnya</span> : null}</p>
      )}
      <Link className="underline" href="/panduan/aturan-potongan">Lihat aturan urutan potongan</Link>
    </Card>
  );
}

function HitunganTab({ data }: { data: Data }) {
  if (data.noHitungan) return <p className="text-sm text-ink-muted">{data.noHitungan}</p>;
  if (!data.hitungan?.length) return <Empty what="hitungan kehadiran" />;
  return (
    <div className="space-y-2">
      {data.hitungan.map((line) => (
        <Card key={line.key} className="text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium">{line.label}</p>
            <span className="font-semibold tabular-nums">{line.key === 'BASE' ? '' : line.sign === 1 ? '+ ' : '− '}{rupiah(line.amount)}</span>
          </div>
          {line.key !== 'BASE' && line.days.length > 0 && (
            <ul className="mt-2 divide-y divide-line">
              {line.days.map((d, i) => (
                <li key={`${d.workDate}-${i}`} className="flex flex-wrap justify-between gap-2 py-1">
                  <span><span className="text-ink-muted">{longDate(d.workDate)}</span> · {d.text}{d.note ? <> <Badge tone="info">{d.note}</Badge></> : null}</span>
                  <span className="tabular-nums">{rupiah(d.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}
    </div>
  );
}

/** Unduh beberapa slip tertutup sekaligus (paling banyak 12), lewat halaman cetak A4. */
function DownloadMany({ periods }: { periods: { start: string; label: string; number: string | null }[] }) {
  return (
    <Card className="text-sm">
      <details>
        <summary className="flex cursor-pointer items-center gap-2 font-medium">Unduh beberapa slip <NewBadge feature="fitur/unduh-slip-saya" /></summary>
        <form action="/pendapatan/cetak" method="get" target="_blank" className="mt-2 space-y-2">
          <p className="text-ink-muted">Pilih paling banyak 12 slip yang sudah ditutup. Di halaman berikutnya pilih &ldquo;Simpan sebagai PDF&rdquo;.</p>
          <ul className="space-y-1">
            {periods.map((p) => (
              <li key={p.start}>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="periode" value={p.start} /> {p.label}{p.number ? ` · ${p.number}` : ''}
                </label>
              </li>
            ))}
          </ul>
          <button type="submit" className={buttonClass({ variant: 'secondary' })}>Unduh terpilih</button>
        </form>
      </details>
    </Card>
  );
}
