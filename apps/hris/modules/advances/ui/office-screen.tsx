import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';
import { Badge, Card, EmptyState } from '@/components/ui/surface';
import { rupiah } from '../rules/advance';
import type { OfficeTab } from '../server/screens';

type Row = {
  id: number; number: string; name: string; branchName: string; requestedAmount: number; finalAmount: number | null; installments: number;
  remaining: number; handed: number; stageLabel: string; tone: 'info' | 'ok' | 'warn' | 'danger'; waitingDays: number | null;
  requestId: number | null; requestOpen: boolean; nextInstallment: string | null; labels: string[];
};

/** DRV-L26 Kasbon (daftar kantor). Kepala sisa Dana Kasbon hanya untuk Pemilik dan GM. */
export function OfficeScreen({ tab, q, counts, rows, funds, canFillFor, tabs }: {
  tab: OfficeTab; q: string; counts: Record<OfficeTab, { count: number; amount: number }>; rows: Row[];
  funds: { monthly: { used: number; size: number }; weekly: { used: number; size: number } } | null; canFillFor: boolean;
  tabs: { key: OfficeTab; label: string }[];
}) {
  const money = (r: Row) => (r.finalAmount != null && r.finalAmount !== r.requestedAmount ? `${rupiah(r.requestedAmount)} → ${rupiah(r.finalAmount)}` : rupiah(r.finalAmount ?? r.requestedAmount));
  return (
    <div className="space-y-4">
      {funds && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <p className="text-sm text-ink-muted">Dana Kasbon slip bulanan</p>
            <p className="text-lg font-semibold tabular-nums">Terpakai {rupiah(funds.monthly.used)} dari {rupiah(funds.monthly.size)}</p>
            <p className="text-sm">Sisa {rupiah(Math.max(0, funds.monthly.size - funds.monthly.used))}{funds.monthly.used > funds.monthly.size ? ' · pengajuan baru di dana ini tertahan' : ''}</p>
          </Card>
          <Card>
            <p className="text-sm text-ink-muted">Dana Kasbon slip mingguan</p>
            <p className="text-lg font-semibold tabular-nums">Terpakai {rupiah(funds.weekly.used)} dari {rupiah(funds.weekly.size)}</p>
            <p className="text-sm text-ink-muted">Mulai dipakai bersama slip mingguan (driver dan kenek).</p>
          </Card>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav className="flex flex-wrap gap-1" aria-label="Tab kasbon">
          {tabs.map((t) => (
            <Link key={t.key} href={`/gaji/kasbon?tab=${t.key}`} className={buttonClass({ variant: t.key === tab ? 'primary' : 'secondary', size: 'sm' })}>
              {t.label} ({counts[t.key].count}{counts[t.key].amount ? `, ${rupiah(counts[t.key].amount)}` : ''})
            </Link>
          ))}
        </nav>
        {canFillFor && <Link href="/gaji/kasbon/isikan" className={buttonClass({ size: 'sm' })}>Isikan atas nama</Link>}
      </div>
      <form className="flex gap-2" action="/gaji/kasbon">
        <input type="hidden" name="tab" value={tab} />
        <input name="q" defaultValue={q} placeholder="Cari nama atau nomor" className="min-h-9 w-full max-w-xs rounded-lg border border-line bg-surface px-3 text-sm" />
        <button type="submit" className={buttonClass({ variant: 'secondary', size: 'sm' })}>Cari</button>
      </form>
      {!rows.length ? <EmptyState title="Tidak ada kasbon di tab ini" /> : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-muted">
                <th className="py-1 pr-3 font-medium">Nomor</th>
                <th className="py-1 pr-3 font-medium">Orang</th>
                <th className="py-1 pr-3 text-right font-medium">Nominal</th>
                <th className="py-1 pr-3 font-medium">Kali</th>
                {tab === 'berjalan' || tab === 'selesai'
                  ? <><th className="py-1 pr-3 text-right font-medium">Sisa</th><th className="py-1 pr-3 font-medium">Cicilan berikutnya</th></>
                  : <th className="py-1 pr-3 font-medium">Menunggu</th>}
                <th className="py-1 font-medium">Tanda</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-1.5 pr-3"><Link className="font-medium text-brand-700" href={r.requestOpen && r.requestId ? `/persetujuan/${r.requestId}` : `/gaji/kasbon/${r.id}`}>{r.number}</Link></td>
                  <td className="py-1.5 pr-3">{r.name}<span className="block text-xs text-ink-muted">{r.branchName}</span></td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{money(r)}</td>
                  <td className="py-1.5 pr-3">{r.installments}</td>
                  {tab === 'berjalan' || tab === 'selesai'
                    ? <><td className="py-1.5 pr-3 text-right tabular-nums">{rupiah(r.remaining)}</td><td className="py-1.5 pr-3">{r.nextInstallment ?? '—'}</td></>
                    : <td className="py-1.5 pr-3">{r.waitingDays == null ? '—' : `${r.waitingDays} hari`}</td>}
                  <td className="py-1.5">
                    <div className="flex flex-wrap gap-1">
                      <Badge tone={r.tone}>{r.stageLabel}</Badge>
                      {r.labels.map((l) => <Badge key={l} tone={l.startsWith('Lewat') || l === 'Akan berhenti' || l === 'Belum diterima' ? 'danger' : 'warn'}>{l}</Badge>)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
