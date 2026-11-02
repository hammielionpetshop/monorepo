import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';
import { NewBadge } from '@/components/ui/new-badge';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/surface';
import type { ClarificationCard, MyTab } from '../server/clarification';
import { TabNav } from './tab-nav';

type Props = { tab: MyTab; all: boolean; counts: Record<MyTab, number>; cards: ClarificationCard[] };

const TONES = { normal: 'info', warn: 'warn', danger: 'danger', over: 'info' } as const;

/** KEH-L35 Perlu Dijelaskan: semua yang harus dijelaskan, batasnya, dan akibatnya bila dibiarkan (tanpa nominal). */
export function MyClarificationsScreen({ tab, all, counts, cards }: Props) {
  const tabs = [
    { key: 'open', label: `Perlu dijelaskan (${counts.open})`, href: '/perlu-dijelaskan' },
    { key: 'waiting', label: `Menunggu keputusan (${counts.waiting})`, href: '/perlu-dijelaskan?tab=waiting' },
    { key: 'done', label: `Selesai (${counts.done})`, href: '/perlu-dijelaskan?tab=done' },
  ];
  return (
    <div className="space-y-4">
      <TabNav label="Perlu Dijelaskan" tabs={tabs} active={tab} />
      {tab === 'open' && (
        <p className="text-sm text-ink-muted">
          Jelaskan paling lambat 3 hari sesudah tanggalnya, pukul 23.59. HR, Pemilik, atau GM yang memutuskan.
        </p>
      )}
      {!cards.length && (
        <EmptyState title={tab === 'open' ? 'Tidak ada yang perlu dijelaskan' : tab === 'waiting' ? 'Tidak ada yang menunggu keputusan' : 'Belum ada'}>
          {tab === 'open' ? 'Alpha, lupa absen, telat, atau pulang cepat yang perlu dijelaskan muncul di sini esok paginya.' : null}
        </EmptyState>
      )}
      <div className="grid gap-3">
        {cards.map((card) => (
          <Card key={card.id}>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{card.title} · {card.dateLabel}</p>
                {card.left ? <Badge tone={TONES[card.urgency]}>{card.left}</Badge> : <Badge>{card.stateLabel}</Badge>}
              </div>
              {tab === 'open' && <p className="text-sm">{card.consequence}</p>}
              {tab === 'open' && <p className="text-xs text-ink-muted">Batas {card.deadline}</p>}
              {card.rejection && card.action === 'resubmit' && (
                <Alert tone="warn">Ditolak{card.rejection.reason ? `: ${card.rejection.reason}` : ''}. Masih bisa diajukan ulang sebelum batas.</Alert>
              )}
              {card.note && <p className="text-sm text-ink-muted">{card.note}</p>}
              <div className="flex flex-wrap gap-2">
                {card.action === 'explain' && <Link className={buttonClass()} href={`/perlu-dijelaskan/${card.id}`}>Jelaskan</Link>}
                {card.action === 'explain' && card.seriesCount > 1 && (
                  <Link className={buttonClass({ variant: 'secondary' })} href={`/perlu-dijelaskan/${card.id}?seri=1`}>
                    Jelaskan sama untuk {card.seriesCount} hari berturut-turut
                  </Link>
                )}
                {card.action === 'resubmit' && card.requestId && (
                  <Link className={buttonClass()} href={`/perlu-dijelaskan/${card.id}?dari=${card.requestId}`}>Ajukan ulang</Link>
                )}
                {card.action === 'late' && (
                  <Link className={buttonClass({ variant: 'secondary' })} href={`/perlu-dijelaskan/${card.id}?terlambat=1`}>Ajukan terlambat <NewBadge feature="fitur/ajukan-terlambat" /></Link>
                )}
                {card.requestId && tab !== 'open' && (
                  <Link className={buttonClass({ variant: 'ghost' })} href={`/pengajuan/${card.requestId}`}>Lihat pengajuan</Link>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
      {tab === 'done' && !all && (
        <Link className="text-sm underline" href="/perlu-dijelaskan?tab=done&semua=1">Muat periode lama</Link>
      )}
    </div>
  );
}
