import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';
import { NewBadge } from '@/components/ui/new-badge';
import { Badge, Card, EmptyState } from '@/components/ui/surface';
import { rupiah } from '../rules/advance';
import type { OfficeTab } from '../server/screens';

type Row = {
  id: number; number: string; name: string; branchName: string; requestedAmount: number; finalAmount: number | null; installments: number;
  remaining: number; handed: number; stageLabel: string; tone: 'info' | 'ok' | 'warn' | 'danger'; waitingDays: number | null;
  requestId: number | null; requestOpen: boolean; nextInstallment: string | null; labels: string[]; waitingWeekly: number;
};

type Money = {
  month: string; months: string[];
  rows: { id: number; date: string; kind: 'OUT' | 'IN' | 'WRITE_OFF'; number: string; name: string; branchName: string; sourceName: string; amount: number }[];
  groups: { kind: 'OUT' | 'IN' | 'WRITE_OFF'; label: string; branchName: string; sourceName: string; amount: number; count: number }[];
  totals: { out: number; in: number; writeOff: number }; kindLabels: Record<'OUT' | 'IN' | 'WRITE_OFF', string>;
};

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const monthText = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

/** Tab Uang Kasbon (spec L5 §9 butir 4): uang keluar, uang masuk, dan utang dihapus per bulan, per cabang dan Sumber Uang. */
function MoneyTab({ money }: { money: Money }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <form className="flex gap-2" action="/gaji/kasbon">
          <input type="hidden" name="tab" value="uang" />
          <select name="bulan" defaultValue={money.month} className="min-h-9 rounded-lg border border-line bg-surface px-3 text-sm">
            {money.months.map((m) => <option key={m} value={m}>{monthText(m)}</option>)}
          </select>
          <button type="submit" className={buttonClass({ variant: 'secondary', size: 'sm' })}>Tampilkan</button>
        </form>
        <a href={`/api/advances/money?bulan=${money.month}`} className={buttonClass({ size: 'sm' })}>Unduh CSV</a>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><p className="text-sm text-ink-muted">Uang keluar (diberikan)</p><p className="text-lg font-semibold tabular-nums">{rupiah(money.totals.out)}</p></Card>
        <Card><p className="text-sm text-ink-muted">Uang masuk (pelunasan tunai)</p><p className="text-lg font-semibold tabular-nums">{rupiah(money.totals.in)}</p></Card>
        <Card><p className="text-sm text-ink-muted">Utang kasbon dihapus (biaya)</p><p className="text-lg font-semibold tabular-nums">{rupiah(money.totals.writeOff)}</p></Card>
      </div>
      <p className="text-sm text-ink-muted">Cicilan yang terpotong di slip tidak ada di sini (uangnya tidak bergerak; tercatat di slip). Salin ke pembukuan sampai app Keuangan ada.</p>
      {!money.rows.length ? <EmptyState title={`Tidak ada uang kasbon di ${monthText(money.month)}`} /> : (
        <>
          <Card className="overflow-x-auto">
            <h3 className="mb-2 font-semibold">Per cabang dan sumber uang</h3>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-ink-muted"><th className="py-1 pr-3 font-medium">Jenis</th><th className="py-1 pr-3 font-medium">Cabang</th><th className="py-1 pr-3 font-medium">Sumber uang</th><th className="py-1 pr-3 font-medium">Catatan</th><th className="py-1 text-right font-medium">Jumlah</th></tr></thead>
              <tbody className="divide-y divide-line">
                {money.groups.map((g) => (
                  <tr key={`${g.kind}|${g.branchName}|${g.sourceName}`}>
                    <td className="py-1.5 pr-3">{g.label}</td><td className="py-1.5 pr-3">{g.branchName}</td><td className="py-1.5 pr-3">{g.sourceName}</td>
                    <td className="py-1.5 pr-3">{g.count}</td><td className="py-1.5 text-right tabular-nums">{rupiah(g.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card className="overflow-x-auto">
            <h3 className="mb-2 font-semibold">Rincian</h3>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-ink-muted"><th className="py-1 pr-3 font-medium">Tanggal</th><th className="py-1 pr-3 font-medium">Jenis</th><th className="py-1 pr-3 font-medium">Kasbon</th><th className="py-1 pr-3 font-medium">Cabang</th><th className="py-1 pr-3 font-medium">Sumber uang</th><th className="py-1 text-right font-medium">Nominal</th></tr></thead>
              <tbody className="divide-y divide-line">
                {money.rows.map((r) => (
                  <tr key={`${r.kind}-${r.id}`}>
                    <td className="py-1.5 pr-3">{r.date}</td><td className="py-1.5 pr-3">{money.kindLabels[r.kind]}</td>
                    <td className="py-1.5 pr-3">{r.number} · {r.name}</td><td className="py-1.5 pr-3">{r.branchName}</td><td className="py-1.5 pr-3">{r.sourceName}</td>
                    <td className="py-1.5 text-right tabular-nums">{rupiah(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

/** DRV-L26 Kasbon (daftar kantor) + DRV-L38 Kasbon Berjalan. Kepala sisa Dana Kasbon hanya untuk Pemilik dan GM. */
export function OfficeScreen({ tab, q, counts, rows, funds, canFillFor, canSpecial, canLegacy, tabs, people, money }: {
  tab: OfficeTab; q: string; counts: Record<OfficeTab, { count: number; amount: number }>; rows: Row[];
  funds: { monthly: { used: number; size: number }; weekly: { used: number; size: number } } | null; canFillFor: boolean; canSpecial: boolean; canLegacy: boolean;
  tabs: { key: OfficeTab; label: string }[];
  people: { name: string; branchName: string; count: number; remaining: number; waitingWeekly: number }[];
  money: Money | null;
}) {
  const amountText = (r: Row) => (r.finalAmount != null && r.finalAmount !== r.requestedAmount ? `${rupiah(r.requestedAmount)} → ${rupiah(r.finalAmount)}` : rupiah(r.finalAmount ?? r.requestedAmount));
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
              {t.key === 'uang' ? <><NewBadge feature="fitur/uang-kasbon" /> {t.label}</> : <>{t.label} ({counts[t.key].count}{counts[t.key].amount ? `, ${rupiah(counts[t.key].amount)}` : ''})</>}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap gap-2">
          {canLegacy && <Link href="/gaji/kasbon/bawaan" className={buttonClass({ size: 'sm', variant: 'secondary' })}><NewBadge feature="fitur/kasbon-bawaan" /> Bawaan sistem lama</Link>}
          {canSpecial && <Link href="/gaji/kasbon/khusus" className={buttonClass({ size: 'sm' })}><NewBadge feature="fitur/kasbon-khusus" /> Kasbon Khusus</Link>}
          {canFillFor && <Link href="/gaji/kasbon/isikan" className={buttonClass({ size: 'sm', variant: 'secondary' })}>Isikan atas nama</Link>}
        </div>
      </div>
      {tab === 'uang' && money ? <MoneyTab money={money} /> : (
        <>
          <form className="flex gap-2" action="/gaji/kasbon">
            <input type="hidden" name="tab" value={tab} />
            <input name="q" defaultValue={q} placeholder="Cari nama atau nomor" className="min-h-9 w-full max-w-xs rounded-lg border border-line bg-surface px-3 text-sm" />
            <button type="submit" className={buttonClass({ variant: 'secondary', size: 'sm' })}>Cari</button>
          </form>
          {tab === 'berjalan' && people.length > 0 && (
            <Card className="overflow-x-auto">
              <h3 className="mb-2 font-semibold">Sisa per orang</h3>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-ink-muted"><th className="py-1 pr-3 font-medium">Orang</th><th className="py-1 pr-3 font-medium">Kasbon</th><th className="py-1 pr-3 text-right font-medium">Sisa</th><th className="py-1 font-medium">Catatan</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {people.map((p) => (
                    <tr key={p.name}>
                      <td className="py-1.5 pr-3">{p.name}<span className="block text-xs text-ink-muted">{p.branchName}</span></td>
                      <td className="py-1.5 pr-3">{p.count}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{rupiah(p.remaining)}</td>
                      <td className="py-1.5">{p.waitingWeekly ? <Badge tone="danger">Menunggu slip mingguan {rupiah(p.waitingWeekly)}</Badge> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
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
                      <td className="py-1.5 pr-3 text-right tabular-nums">{amountText(r)}</td>
                      <td className="py-1.5 pr-3">{r.installments}</td>
                      {tab === 'berjalan' || tab === 'selesai'
                        ? <><td className="py-1.5 pr-3 text-right tabular-nums">{rupiah(r.remaining)}</td><td className="py-1.5 pr-3">{r.nextInstallment ?? '—'}</td></>
                        : <td className="py-1.5 pr-3">{r.waitingDays == null ? '—' : `${r.waitingDays} hari`}</td>}
                      <td className="py-1.5">
                        <div className="flex flex-wrap gap-1">
                          <Badge tone={r.tone}>{r.stageLabel}</Badge>
                          {r.labels.map((l) => <Badge key={l} tone={l.startsWith('Lewat') || l === 'Akan berhenti' || l === 'Belum diterima' || l === 'Menunggu slip mingguan' ? 'danger' : 'warn'}>{l}</Badge>)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
