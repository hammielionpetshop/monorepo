import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/surface';
import type { TeamTab } from '../server/clarification';
import { StreakSeenButton } from './streak-seen-button';
import { TabNav } from './tab-nav';

type Props = {
  tab: TeamTab; branchId: number | null; kind: string | null;
  branches: { id: number; name: string }[]; kinds: { value: string; label: string }[];
  rows: { id: number; name: string; branch: string; title: string; dateLabel: string; left: string; urgency: string }[];
  waiting: { requestId: number; name: string; branch: string; title: string; dateLabel: string; waitingDays: number; canOpen: boolean }[];
  streaks: {
    id: number; name: string; branch: string; startLabel: string; flaggedLabel: string; causes: string[]; seen: boolean; note: string | null;
    at: string | null; canMark: boolean;
  }[];
};

const TONES: Record<string, 'info' | 'warn' | 'danger'> = { normal: 'info', warn: 'warn', danger: 'danger' };

/** KEH-L37 Perlu Dijelaskan Tim. Hanya baca kecuali Sudah dilihat; keputusan tetap di kotak Persetujuan. */
export function TeamClarificationScreen(props: Props) {
  const query = (tab: string) => {
    const params = new URLSearchParams();
    if (tab !== 'open') params.set('tab', tab);
    if (props.branchId) params.set('branch', String(props.branchId));
    if (props.kind) params.set('kind', props.kind);
    const text = params.toString();
    return `/kehadiran/perlu-dijelaskan${text ? `?${text}` : ''}`;
  };
  const tabs = [
    { key: 'open', label: 'Belum dijelaskan', href: query('open') },
    { key: 'soon', label: 'Hampir lewat batas', href: query('soon') },
    { key: 'waiting', label: 'Menunggu keputusan', href: query('waiting') },
    { key: 'streak', label: 'Tidak masuk berturut-turut', href: query('streak') },
  ];
  return (
    <div className="space-y-4">
      <TabNav label="Perlu Dijelaskan Tim" tabs={tabs} active={props.tab} />
      {props.tab !== 'streak' && (
        <form method="get" className="flex flex-wrap items-end gap-2">
          {props.tab !== 'open' && <input type="hidden" name="tab" value={props.tab} />}
          <label className="text-sm">Cabang{' '}
            <select name="branch" defaultValue={props.branchId ?? ''} className="rounded border border-line bg-surface px-2 py-1">
              <option value="">Semua</option>
              {props.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="text-sm">Jenis{' '}
            <select name="kind" defaultValue={props.kind ?? ''} className="rounded border border-line bg-surface px-2 py-1">
              <option value="">Semua</option>
              {props.kinds.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </label>
          <button type="submit" className={buttonClass({ variant: 'secondary', size: 'sm' })}>Saring</button>
        </form>
      )}

      {(props.tab === 'open' || props.tab === 'soon') && (
        props.rows.length ? (
          <div className="overflow-x-auto rounded-card border border-line bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-canvas text-left text-ink-muted">
                <tr><th className="px-3 py-2">Nama</th><th className="px-3 py-2">Cabang</th><th className="px-3 py-2">Jenis</th><th className="px-3 py-2">Tanggal</th><th className="px-3 py-2">Sisa waktu</th></tr>
              </thead>
              <tbody>
                {props.rows.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <td className="px-3 py-2">{row.name}</td><td className="px-3 py-2">{row.branch}</td><td className="px-3 py-2">{row.title}</td>
                    <td className="px-3 py-2">{row.dateLabel}</td><td className="px-3 py-2"><Badge tone={TONES[row.urgency] ?? 'info'}>{row.left}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="Tidak ada">Semua kejadian di lingkup Anda sudah dijelaskan.</EmptyState>
      )}

      {props.tab === 'waiting' && (
        props.waiting.length ? (
          <div className="grid gap-2">
            {props.waiting.map((row) => (
              <Card key={row.requestId}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{row.name} · {row.branch}</p>
                    <p className="text-sm text-ink-muted">{row.title} {row.dateLabel} · menunggu {row.waitingDays < 1 ? 'kurang dari 1 hari' : `${row.waitingDays} hari`}</p>
                  </div>
                  {row.canOpen && <Link className={buttonClass({ size: 'sm' })} href={`/persetujuan/${row.requestId}`}>Buka di Persetujuan</Link>}
                </div>
              </Card>
            ))}
          </div>
        ) : <EmptyState title="Tidak ada penjelasan menunggu" />
      )}

      {props.tab === 'streak' && (
        <div className="space-y-2">
          <Alert>Tanda muncul pada hari kerja ke-7 berturut-turut sakit tanpa surat, izin, atau alpha. Tidak ada penonaktifan otomatis; keputusan lewat data karyawan.</Alert>
          {!props.streaks.length && <EmptyState title="Tidak ada tanda" />}
          {props.streaks.map((row) => (
            <Card key={row.id}>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{row.name} · {row.branch}</p>
                  <Badge tone={row.seen ? 'ok' : 'warn'}>{row.seen ? 'Sudah dilihat' : 'Belum dilihat'}</Badge>
                </div>
                <p className="text-sm">Mulai {row.startLabel}, hari ke-7 jatuh {row.flaggedLabel}: {row.causes.join(', ')}</p>
                {row.note && <p className="text-xs text-ink-muted">Catatan: {row.note}</p>}
                {row.canMark && <StreakSeenButton flagId={row.id} seen={row.seen} />}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
